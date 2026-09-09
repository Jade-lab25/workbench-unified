import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AppState, FdTask } from '../types';
import { monthGrid, todayISO, fmtDate, fmtClock } from '../utils/dates';
import { Modal } from '../components/ui';
import { TaskEditor } from './GoalsView';

interface Props {
  state: AppState;
  selectedDate: string;
  onSelectDate: (d: string) => void;
  store: any;
  toast: (t: string, type?: 'info' | 'success' | 'error') => void;
}

const DOW = ['一', '二', '三', '四', '五', '六', '日'];
const PRI_COLOR: Record<string, string> = { P0: 'var(--red)', P1: 'var(--amber)', P2: 'var(--accent)', P3: 'var(--accent)' };

interface DayInfo {
  pts: number;
  todos: { id: string; title: string }[];          // 当天完成的待办
  tasks: FdTask[];                                  // 当天到期或完成的任务
  checkIns: number;
  habits: number;
  logs: number;
  ideas: number;
  timeCount: number;
  timeSec: number;
}

/** 某天的格子摘要行（任务优先，按优先级排，再补完成待办）；每条可点击编辑 */
interface Snippet { mark: string; title: string; color: string; kind: 'task' | 'todo'; id: string }

function snippets(day: DayInfo | undefined): Snippet[] {
  const out: Snippet[] = [];
  const tasks = [...(day?.tasks || [])].sort((a, b) => {
    const pa = a.priority === 'P0' ? 0 : a.priority === 'P1' ? 1 : a.priority === 'P2' ? 2 : 3;
    const pb = b.priority === 'P0' ? 0 : b.priority === 'P1' ? 1 : b.priority === 'P2' ? 2 : 3;
    return pa - pb;
  });
  tasks.forEach(t => {
    out.push({
      mark: t.status === 'done' ? '✓' : '◆',
      title: t.title,
      color: t.status === 'done' ? 'var(--green)' : (PRI_COLOR[t.priority] || 'var(--accent)'),
      kind: 'task',
      id: t.id,
    });
  });
  (day?.todos || []).forEach(t => out.push({ mark: '✓', title: t.title, color: 'var(--green)', kind: 'todo', id: t.id }));
  return out;
}

/** 轻量待办编辑器（日历格子内点完成待办 → 直接改标题） */
function TodoEditor({ todo, store, toast, onClose }: {
  todo: { id: string; title: string }; store: any;
  toast: (t: string, type?: 'info' | 'success' | 'error') => void; onClose: () => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const save = () => {
    if (!title.trim()) { toast('内容不能为空', 'error'); return; }
    store.updateTodo(todo.id, title.trim());
    toast('已保存', 'success');
    onClose();
  };
  return (
    <Modal open title="编辑待办" onClose={onClose} width={440}>
      <div className="col" style={{ gap: 12 }}>
        <div className="field"><label className="field-label">内容</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} autoFocus /></div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={save}>保存</button>
        </div>
      </div>
    </Modal>
  );
}

export function CalendarView({ state, selectedDate, onSelectDate, store, toast }: Props) {
  const today = todayISO();
  const [viewYear, setViewYear] = useState(Number(selectedDate.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(Number(selectedDate.slice(5, 7)) - 1);
  const [edit, setEdit] = useState<Snippet | null>(null);

  /** 每天聚合：成就值 / 待办 / 任务 / 各类型计数 / 时间 */
  const dayMap = useMemo(() => {
    const map: Record<string, DayInfo> = {};
    const get = (d: string): DayInfo => (map[d] = map[d] || { pts: 0, todos: [], tasks: [], checkIns: 0, habits: 0, logs: 0, ideas: 0, timeCount: 0, timeSec: 0 });
    state.todos.forEach(t => { if (t.completedAt) get(t.completedAt.slice(0, 10)).todos.push({ id: t.id, title: t.title }); });
    state.checkInRecords.forEach(r => get(r.createdAt.slice(0, 10)).checkIns++);
    state.timeRecords.forEach(r => {
      const d = get(r.startTime.slice(0, 10));
      d.timeCount++;
      if (r.endTime) d.timeSec += (new Date(r.endTime).getTime() - (r.startTimestamp || new Date(r.startTime).getTime())) / 1000;
    });
    state.achievementLogs.forEach(l => { get(l.createdAt.slice(0, 10)).pts += l.points || 0; });
    state.fdTasks.forEach(t => {
      const due = t.dueDate && t.status !== 'archived' && t.status !== 'idea' ? get(t.dueDate) : null;
      const done = t.status === 'done' && t.completedAt ? get(t.completedAt.slice(0, 10)) : null;
      if (due) due.tasks.push(t);
      if (done && due !== done) done.tasks.push(t);
    });
    state.fdHabitLogs.forEach(l => get(l.logDate).habits++);
    state.summaryLogs.forEach(l => get(l.date).logs++);
    state.summaryIdeas.forEach(i => get(i.createdAt.slice(0, 10)).ideas++);
    return map;
  }, [state]);

  /** 本月汇总 */
  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const summary = useMemo(() => {
    let pts = 0, todos = 0, checkIns = 0, timeSec = 0;
    state.achievementLogs.forEach(l => { if (l.createdAt.slice(0, 7) === monthKey) pts += l.points || 0; });
    state.todos.forEach(t => { if (t.completedAt && t.completedAt.slice(0, 7) === monthKey) todos++; });
    state.checkInRecords.forEach(r => { if (r.createdAt.slice(0, 7) === monthKey) checkIns++; });
    state.timeRecords.forEach(r => { if (r.endTime && r.startTime.slice(0, 7) === monthKey) timeSec += (new Date(r.endTime).getTime() - (r.startTimestamp || new Date(r.startTime).getTime())) / 1000; });
    return { pts, todos, checkIns, time: timeSec };
  }, [state, monthKey]);

  /** 今日已完成 / 未完成（对齐 FocusDesk 顶部统计条） */
  const todayStats = useMemo(() => {
    const done = state.todos.filter(t => t.completedAt && t.completedAt.slice(0, 10) === today).length
      + state.fdTasks.filter(t => t.status === 'done' && t.completedAt && t.completedAt.slice(0, 10) === today).length;
    const pending = state.fdTasks.filter(t => (t.status === 'todo' || t.status === 'doing')).length
      + state.todos.filter(t => !t.completedAt).length;
    return { done, pending };
  }, [state, today]);

  const cells = useMemo(() => monthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const dayDetail = dayMap[selectedDate];
  const evts = snippets(dayDetail);

  const navMonth = (dir: number) => {
    let m = viewMonth + dir, y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m); setViewYear(y);
  };

  const renderPts = (pts: number | undefined) =>
    pts ? <span className={`cal-pts ${pts > 0 ? 'up' : 'down'}`}>{pts > 0 ? `+${pts}` : pts}</span> : null;

  const renderDots = (day: DayInfo | undefined) => {
    if (!day) return null;
    const items: [string, string, number][] = [
      ['var(--amber)', '打卡', day.checkIns],
      ['var(--teal)', '习惯', day.habits],
      ['var(--slate)', '日志', day.logs],
      ['var(--violet)', '灵感', day.ideas],
      ['var(--text-3)', '时间', day.timeCount],
    ];
    const active = items.filter(([, , n]) => n > 0);
    if (!active.length) return null;
    return (
      <div className="cal-dots">
        {active.map(([c, l, n]) => <span key={l} className="cal-dot" style={{ background: c as string }} title={`${l} ${n}`} />)}
      </div>
    );
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">日历</div>
          <div className="page-desc">每天成就值 · 待办任务 · 打卡习惯 一览</div>
        </div>
      </div>

      {/* 今日完成统计（对齐 FocusDesk） */}
      <div className="row-between mb12" style={{ alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
          今日已完成 <b style={{ color: 'var(--green)' }}>{todayStats.done}</b> 项 · 还有 <b style={{ color: 'var(--amber)' }}>{todayStats.pending}</b> 项未完成
        </span>
      </div>

      {/* 本月汇总 */}
      <div className="cal-summary mb16">
        <div className="cal-sum-item"><div className="cal-sum-label">本月成就</div>
          <div className="cal-sum-value" style={{ color: summary.pts >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {summary.pts > 0 ? '+' : ''}{summary.pts}</div></div>
        <div className="cal-sum-item"><div className="cal-sum-label">完成待办</div>
          <div className="cal-sum-value">{summary.todos}</div></div>
        <div className="cal-sum-item"><div className="cal-sum-label">打卡</div>
          <div className="cal-sum-value">{summary.checkIns}</div></div>
        <div className="cal-sum-item"><div className="cal-sum-label">专注时长</div>
          <div className="cal-sum-value" style={{ fontSize: 15 }}>{fmtClock(summary.time)}</div></div>
      </div>

      <div className="cal-layout">
        <div className="card">
          {/* 导航 */}
          <div className="row-between mb12">
            <div className="row" style={{ gap: 4 }}>
              <button className="btn-icon" onClick={() => navMonth(-1)}><ChevronLeft size={18} /></button>
              <span className="bold" style={{ fontSize: 15, minWidth: 100, textAlign: 'center' }}>{viewYear}年{viewMonth + 1}月</span>
              <button className="btn-icon" onClick={() => navMonth(1)}><ChevronRight size={18} /></button>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              onSelectDate(today);
              setViewYear(Number(today.slice(0, 4)));
              setViewMonth(Number(today.slice(5, 7)) - 1);
            }}>今天</button>
          </div>

          {/* 月视图：全部格子等高，内容截断不撑开 */}
          <div className="cal-grid">
            {DOW.map(d => <div key={d} className="cal-dow">{d}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="cal-cell other" />;
              const day = dayMap[d];
              const isToday = d === today;
              const isSel = d === selectedDate;
              const ss = snippets(day);
              return (
                <div
                  key={i}
                  className={`cal-cell${isToday ? ' today' : ''}${isSel ? ' selected' : ''}`}
                  onClick={() => onSelectDate(d)}
                >
                  <div className="row-between" style={{ alignItems: 'center', flexShrink: 0 }}>
                    <span className="cal-num" style={{ fontWeight: isToday ? 700 : 400 }}>{Number(d.slice(8))}</span>
                    {renderPts(day?.pts)}
                  </div>
                  <div className="cal-evts">
                    {ss.slice(0, 3).map(s => (
                      <button
                        key={s.id}
                        className="cal-evt-btn"
                        style={{ color: s.color }}
                        onClick={e => { e.stopPropagation(); setEdit(s); }}
                        title={s.title}
                      >{s.mark} {s.title}</button>
                    ))}
                    {ss.length > 3 && <div className="cal-more">+{ss.length - 3} 更多</div>}
                  </div>
                  {renderDots(day)}
                </div>
              );
            })}
          </div>

          {/* 图例 */}
          <div className="cal-legend">
            {[['var(--red)', 'P0'], ['var(--amber)', 'P1'], ['var(--green)', '待办✓'], ['var(--accent)', '任务◆'], ['var(--amber)', '打卡'], ['var(--teal)', '习惯'], ['var(--slate)', '日志'], ['var(--violet)', '灵感']].map(([c, l]) => (
              <span key={l as string} className="cal-legend-item">
                <span className="cal-legend-dot" style={{ background: c as string }} />{l}
              </span>
            ))}
          </div>
        </div>

        {/* 当日详情 */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">{fmtDate(selectedDate)}</div>
            <div className="row" style={{ gap: 6 }}>
              {dayDetail && dayDetail.pts !== 0 && (
                <span className={`badge ${dayDetail.pts >= 0 ? 'badge-green' : 'badge-red'}`}>
                  成就 {dayDetail.pts >= 0 ? '+' : ''}{dayDetail.pts}
                </span>
              )}
              <span className="badge badge-muted">{evts.length + (dayDetail?.checkIns || 0) + (dayDetail?.habits || 0) + (dayDetail?.logs || 0) + (dayDetail?.ideas || 0) + (dayDetail?.timeCount || 0)} 条</span>
            </div>
          </div>
          {dayDetail && (dayDetail.pts !== 0 || evts.length > 0 || dayDetail.checkIns > 0 || dayDetail.habits > 0 || dayDetail.logs > 0 || dayDetail.ideas > 0 || dayDetail.timeCount > 0) ? (
            <div className="col" style={{ gap: 4 }}>
              {dayDetail.pts !== 0 && (
                <div className="cal-detail-item"><span style={{ width: 16, textAlign: 'center' }}>🏅</span>
                  <span>当日成就 <b style={{ color: dayDetail.pts >= 0 ? 'var(--green)' : 'var(--red)' }}>{dayDetail.pts >= 0 ? '+' : ''}{dayDetail.pts}</b></span>
                </div>
              )}
              {evts.map(s => (
                <button
                  key={s.id}
                  className="cal-detail-item"
                  style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none', padding: 0, color: 'inherit' }}
                  onClick={() => setEdit(s)}
                >
                  <span style={{ color: s.color, width: 16, textAlign: 'center' }}>{s.mark}</span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                </button>
              ))}
              {dayDetail.checkIns > 0 && (
                <div className="cal-detail-item"><span style={{ width: 16, textAlign: 'center', color: 'var(--amber)' }}>🔥</span>
                  <span>打卡 {dayDetail.checkIns} 次</span></div>
              )}
              {dayDetail.habits > 0 && (
                <div className="cal-detail-item"><span style={{ width: 16, textAlign: 'center', color: 'var(--teal)' }}>✓</span>
                  <span>习惯打卡 {dayDetail.habits} 次</span></div>
              )}
              {dayDetail.timeCount > 0 && (
                <div className="cal-detail-item"><span style={{ width: 16, textAlign: 'center', color: 'var(--text-3)' }}>⏱</span>
                  <span>计时 {dayDetail.timeCount} 条 · {fmtClock(dayDetail.timeSec)}</span></div>
              )}
              {dayDetail.logs > 0 && (
                <div className="cal-detail-item"><span style={{ width: 16, textAlign: 'center', color: 'var(--slate)' }}>📋</span>
                  <span>工作日志 {dayDetail.logs} 条</span></div>
              )}
              {dayDetail.ideas > 0 && (
                <div className="cal-detail-item"><span style={{ width: 16, textAlign: 'center', color: 'var(--violet)' }}>💡</span>
                  <span>灵感 {dayDetail.ideas} 条</span></div>
              )}
            </div>
          ) : (
            <div className="empty" style={{ padding: '28px 8px' }}>
              <div className="empty-text">这一天没有记录</div>
            </div>
          )}
        </div>
      </div>

      {/* 点格子内事项 → 直接编辑 */}
      {edit?.kind === 'task' && (() => {
        const t = state.fdTasks.find(x => x.id === edit.id);
        return t ? <TaskEditor task={t} state={state} store={store} toast={toast} onClose={() => setEdit(null)} /> : null;
      })()}
      {edit?.kind === 'todo' && (() => {
        const t = state.todos.find(x => x.id === edit.id);
        return t ? <TodoEditor todo={t} store={store} toast={toast} onClose={() => setEdit(null)} /> : null;
      })()}
    </div>
  );
}
