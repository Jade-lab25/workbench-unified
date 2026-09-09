import { useMemo, useState } from 'react';
import { Target, Flame, Timer, Trophy, AlertCircle, Lightbulb } from 'lucide-react';
import type { AppState, FdTask } from '../types';
import { computeHabitStats } from '../utils/stats';
import { todayISO, fmtDuration, fmtDate } from '../utils/dates';
import { Progress, Modal } from '../components/ui';

interface Props { state: AppState; }

const RANGES = [
  { key: 7, label: '近7天' },
  { key: 30, label: '近30天' },
  { key: 90, label: '近90天' },
  { key: 0, label: '全部' },
];

/** 目标拆解子任务叶子收集（目标 → 任务 → subtasks 树叶子） */
function collectLeaves(tasks: FdTask[]): { task: FdTask; leaf: any }[] {
  const out: { task: FdTask; leaf: any }[] = [];
  const walk = (list: any[], task: FdTask) => list.forEach((s: any) => {
    if (s.children && s.children.length) walk(s.children, task); else out.push({ task, leaf: s });
  });
  tasks.forEach(t => walk(t.subtasks || [], t));
  return out;
}

export function StatsView({ state }: Props) {
  const [rangeDays, setRangeDays] = useState(30);
  const today = todayISO();
  const [customStart, setCustomStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const [customEnd, setCustomEnd] = useState(today);
  const [kpiModal, setKpiModal] = useState<{ title: string; rows: any[] } | null>(null);

  const start = rangeDays ? (rangeDays === 30 ? customStart : (() => { const d = new Date(); d.setDate(d.getDate() - (rangeDays - 1)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })()) : '2000-01-01';
  const end = rangeDays ? customEnd : today;

  const allTasks = useMemo(() => state.fdTasks.filter(t => t.fdType === 'task'), [state.fdTasks]);
  const allIdeas = useMemo(() => state.fdTasks.filter(t => t.fdType === 'idea'), [state.fdTasks]);

  const dash = useMemo(() => {
    const inRange = (d: string) => d && d >= start && d <= end;
    const tasksInRange = allTasks.filter(t => inRange((t.createdAt || '').slice(0, 10)));
    const completedInRange = allTasks.filter(t => (t.status === 'done' || t.status === 'archived') && inRange((t.completedAt || '').slice(0, 10)));
    const doing = tasksInRange.filter(t => t.status === 'doing');
    const todo = tasksInRange.filter(t => t.status === 'todo');
    const overdue = allTasks.filter(t => t.status !== 'done' && t.status !== 'archived' && t.dueDate && t.dueDate < today);
    const ideasPending = allIdeas.filter(i => i.status === 'idea');
    const total = tasksInRange.length;
    const done = completedInRange.length;
    const completionRate = total ? Math.round(done / total * 100) : 0;
    const isActive = (t: FdTask) => t.status !== 'done' && t.status !== 'archived';
    const p0 = tasksInRange.filter(t => t.priority === 'P0' && isActive(t)).length;
    const p1 = tasksInRange.filter(t => t.priority === 'P1' && isActive(t)).length;
    const p2 = tasksInRange.filter(t => t.priority === 'P2' && isActive(t)).length;
    const p3 = tasksInRange.filter(t => (t.priority === 'P3' || !t.priority) && isActive(t)).length;
    return { tasksInRange, completedInRange, doing, todo, overdue, ideasPending, total, done, completionRate, p0, p1, p2, p3 };
  }, [allTasks, allIdeas, start, end, today]);

  // 今日摘要：今日完成 + 未完成（逾期/今天到期/进行中）
  const todayStats = useMemo(() => {
    let done = 0, todo = 0;
    allTasks.forEach(t => {
      if (t.status === 'done' || t.status === 'archived') {
        if ((t.completedAt || '').slice(0, 10) === today) done++;
      } else if (t.status !== 'idea' && (t.dueDate && t.dueDate <= today || t.status === 'doing')) {
        todo++;
      }
    });
    return { done, todo };
  }, [allTasks, today]);

  const habit = useMemo(() => computeHabitStats(state.fdHabits, state.fdHabitLogs), [state.fdHabits, state.fdHabitLogs]);
  const totalTime = useMemo(() => {
    let s = 0;
    state.timeRecords.forEach(r => { if (r.endTime) s += (new Date(r.endTime).getTime() - (r.startTimestamp || new Date(r.startTime).getTime())) / 1000; });
    return s;
  }, [state.timeRecords]);

  // 完成趋势（逐日；跨度 > 120 天按周聚合）
  const trend = useMemo(() => {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    const spanDays = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    const bucketSize = spanDays > 120 ? 7 : 1;
    const buckets: { label: string; count: number }[] = [];
    const doneMap = new Map<string, number>();
    dash.completedInRange.forEach(t => {
      const d = (t.completedAt || '').slice(0, 10);
      doneMap.set(d, (doneMap.get(d) || 0) + 1);
    });
    const pad = (n: number) => String(n).padStart(2, '0');
    for (let i = 0; i < spanDays; i += bucketSize) {
      let count = 0;
      for (let j = 0; j < bucketSize && i + j < spanDays; j++) {
        const dt = new Date(s.getTime() + (i + j) * 86400000);
        const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
        count += doneMap.get(key) || 0;
      }
      const dt = new Date(s.getTime() + i * 86400000);
      buckets.push({ label: `${dt.getMonth() + 1}/${dt.getDate()}`, count });
    }
    return buckets;
  }, [start, end, dash.completedInRange]);

  const maxTrend = Math.max(1, ...trend.map(t => t.count));
  const maxP = Math.max(1, dash.p0, dash.p1, dash.p2, dash.p3);
  const ring = dash.completionRate;
  const R = 40, C = 2 * Math.PI * R;

  const kpiRows: Record<string, { title: string; rows: any[] }> = useMemo(() => ({
    new: { title: `范围内新建任务（${dash.total}）`, rows: dash.tasksInRange.slice(0, 200).map(t => ({ task: t })) },
    done: { title: `范围内已完成（${dash.done} 项）`, rows: dash.completedInRange.slice(0, 200).map(t => ({ task: t })) },
    doing: { title: `进行中（${dash.doing.length}）`, rows: dash.doing.slice(0, 200).map(t => ({ task: t })) },
    overdue: { title: `当前逾期任务（${dash.overdue.length}）`, rows: dash.overdue.slice(0, 200).map(t => ({ task: t })) },
  }), [dash]);

  const md = (d: string) => { if (!d) return ''; const p = d.split('-'); return `${+p[1]}月${+p[2]}日`; };
  const prioClass = (p: string) => p === 'P0' ? 'badge-red' : p === 'P1' ? 'badge-amber' : 'badge-slate';
  const daysOverdue = (dueDate: string) => Math.max(0, Math.round((new Date(today + 'T00:00:00').getTime() - new Date(dueDate + 'T00:00:00').getTime()) / 86400000));

  const goalPct = (g: any) => {
    const gts = allTasks.filter(t => t.goalId === g.id);
    const leaves = collectLeaves(gts);
    const total = leaves.length;
    const done = leaves.filter(l => l.leaf.done).length;
    return total ? Math.round(done / total * 100) : 0;
  };

  return (
    <div>
      <div className="page-head" style={{ flexWrap: 'wrap' }}>
        <div>
          <div className="page-title">数据仪表盘</div>
          <div className="page-desc">任务统计 / 优先级 / 完成趋势按所选范围；目标进度 / 逾期任务 / 待转化灵感为当前状态</div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="seg">
            {RANGES.map(r => (
              <button key={r.key} className={`seg-item${rangeDays === r.key ? ' active' : ''}`} onClick={() => setRangeDays(r.key)}>{r.label}</button>
            ))}
          </div>
          {rangeDays !== 0 && (
            <div className="row" style={{ gap: 4, alignItems: 'center' }}>
              <input className="input" type="date" style={{ width: 128, padding: '5px 8px' }} value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span className="tiny muted-3">至</span>
              <input className="input" type="date" style={{ width: 128, padding: '5px 8px' }} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {/* 今日摘要 */}
      <div className="card mb16" style={{ padding: '10px 16px' }}>
        <div className="row wrap" style={{ gap: 14, fontSize: 13 }}>
          <span>今日已完成 <b style={{ color: 'var(--green)', fontSize: 15 }}>{todayStats.done}</b> 项</span>
          <span style={{ width: 1, height: 14, background: 'var(--border)' }} />
          <span>还有 <b style={{ color: 'var(--red)', fontSize: 15 }}>{todayStats.todo}</b> 项未完成</span>
          <span className="tiny muted-3" style={{ marginLeft: 'auto' }}>范围 {fmtDate(start)}{start !== end ? ' ~ ' + fmtDate(end) : ''}</span>
        </div>
      </div>

      {/* KPI 4 卡（可点击查看关联任务） */}
      <div className="kpi-grid mb16">
        <button className="kpi" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setKpiModal(kpiRows.new)}>
          <div className="kpi-label"><Target size={14} color="var(--accent)" /> 范围内新建任务</div>
          <div className="kpi-value">{dash.total}</div>
        </button>
        <button className="kpi" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setKpiModal(kpiRows.done)}>
          <div className="kpi-label"><Trophy size={14} color="var(--green)" /> 范围内已完成</div>
          <div className="kpi-value" style={{ color: 'var(--green)' }}>{dash.done}<small style={{ color: 'var(--text-3)' }}> ({dash.completionRate}%)</small></div>
        </button>
        <button className="kpi" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setKpiModal(kpiRows.doing)}>
          <div className="kpi-label"><Flame size={14} color="var(--amber)" /> 进行中</div>
          <div className="kpi-value" style={{ color: 'var(--amber)' }}>{dash.doing.length}</div>
        </button>
        <button className="kpi" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setKpiModal(kpiRows.overdue)}>
          <div className="kpi-label"><AlertCircle size={14} color="var(--red)" /> 当前逾期任务</div>
          <div className="kpi-value" style={{ color: dash.overdue.length ? 'var(--red)' : undefined }}>{dash.overdue.length}</div>
        </button>
      </div>

      <div className="grid-2">
        {/* 完成率环 + 优先级 */}
        <div className="card">
          <div className="card-title mb12">范围内任务完成率 <span className="tiny muted-3">{ring}%</span></div>
          <div className="row" style={{ gap: 18 }}>
            <div style={{ position: 'relative', width: 104, height: 104, flexShrink: 0 }}>
              <svg width="104" height="104" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
                <circle cx="50" cy="50" r={R} fill="none" stroke="#10b981" strokeWidth="9"
                  strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ring / 100)}
                  transform="rotate(-90 50 50)" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 19, fontWeight: 700 }}>{ring}%</span>
                <span className="tiny muted-3">完成率</span>
              </div>
            </div>
            <div className="col grow" style={{ gap: 5, fontSize: 12 }}>
              <div className="row-between"><span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#10b981', marginRight: 5 }} />已完成</span><b>{dash.done}</b></div>
              <div className="row-between"><span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#f59e0b', marginRight: 5 }} />进行中</span><b>{dash.doing.length}</b></div>
              <div className="row-between"><span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#9ca3af', marginRight: 5 }} />待处理</span><b>{dash.todo.length}</b></div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0 10px' }} />
          <div className="card-title mb8">优先级分布（范围内未完成）</div>
          <div className="col" style={{ gap: 8 }}>
            {([['P0', dash.p0, 'var(--red)'], ['P1', dash.p1, 'var(--amber)'], ['P2', dash.p2, 'var(--accent)'], ['P3', dash.p3, 'var(--text-3)']] as const).map(([label, val, color]) => (
              <div key={label}>
                <div className="row-between tiny muted" style={{ marginBottom: 3 }}><span>{label}</span><span>{val}</span></div>
                <div className="progress"><i style={{ width: `${val / maxP * 100}%`, background: color as string }} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* 完成趋势折线 */}
        <div className="card">
          <div className="card-title mb12">完成趋势 <span className="tiny muted-3">{fmtDate(start)}{start !== end ? ' ~ ' + fmtDate(end) : ''}</span></div>
          <TrendLine trend={trend} max={maxTrend} />
        </div>
      </div>

      {/* 目标进度（当前状态） */}
      <div className="card mt16">
        <div className="card-title mb12"><Target size={16} /> 目标进度 <span className="tiny muted-3">{state.fdGoals.filter(g => g.status !== 'done').length} 个进行中</span></div>
        {state.fdGoals.filter(g => g.status !== 'done').length === 0 ? (
          <div className="empty" style={{ padding: '20px' }}><div className="empty-text">还没有进行中的目标</div></div>
        ) : (
          <div className="col" style={{ gap: 12 }}>
            {state.fdGoals.filter(g => g.status !== 'done').map(g => {
              const pct = goalPct(g);
              const gts = allTasks.filter(t => t.goalId === g.id);
              return (
                <div key={g.id}>
                  <div className="row-between mb8">
                    <span className="small bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</span>
                    <span className="row" style={{ gap: 6, flexShrink: 0 }}>
                      <span className={`badge ${g.status === 'active' ? 'badge-accent' : 'badge-muted'}`}>{g.status === 'active' ? '进行中' : '已暂停'}</span>
                      <span className="tiny muted">{pct}%</span>
                    </span>
                  </div>
                  <Progress value={pct} />
                  <div className="tiny muted-3 mt4">{gts.length} 个任务 · 拆解完成度</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 逾期任务 + 待转化灵感 */}
      <div className="grid-2 mt16">
        <div className="card">
          <div className="card-head">
            <div className="card-title"><AlertCircle size={16} color="var(--red)" /> 逾期任务 <span className="tiny muted-3">当前状态</span></div>
            {dash.overdue.length > 0 && <span className="badge badge-red">{dash.overdue.length}</span>}
          </div>
          {dash.overdue.length === 0 ? (
            <div className="empty" style={{ padding: '18px' }}><div className="empty-text">没有逾期任务</div></div>
          ) : (
            dash.overdue.slice(0, 10).map(t => {
              const g = state.fdGoals.find(x => x.id === t.goalId);
              return (
                <div className="list-item" key={t.id} style={{ padding: '7px 2px' }}>
                  <div className="list-item-main">
                    <div className="list-item-title" style={{ fontSize: 13 }}>{t.title}</div>
                    <div className="list-item-sub">
                      {g && <span className="badge badge-slate" style={{ marginRight: 6 }}>{g.title}</span>}
                      <span className="tiny muted-3">截止 {md(t.dueDate)}</span>
                    </div>
                  </div>
                  <span className="badge badge-red">逾期{daysOverdue(t.dueDate)}天</span>
                </div>
              );
            })
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title"><Lightbulb size={16} color="var(--amber)" /> 待转化灵感 <span className="tiny muted-3">当前状态</span></div>
            {dash.ideasPending.length > 0 && <span className="badge badge-muted">{dash.ideasPending.length}</span>}
          </div>
          {dash.ideasPending.length === 0 ? (
            <div className="empty" style={{ padding: '18px' }}><div className="empty-text">没有待转化灵感</div></div>
          ) : (
            dash.ideasPending.slice(0, 10).map(i => (
              <div className="list-item" key={i.id} style={{ padding: '7px 2px' }}>
                <div className="list-item-main">
                  <div className="list-item-title" style={{ fontSize: 13 }}>{i.title}</div>
                  <div className="list-item-sub">{fmtDate(i.createdAt)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 一体化附加卡：成就 / 专注 / 习惯 */}
      <div className="kpi-grid mt16">
        <div className="kpi"><div className="kpi-label"><Trophy size={14} color="var(--violet)" /> 累计成就</div>
          <div className="kpi-value">{state.totalAchievements}</div><div className="kpi-note">+{state.totalEarned} / -{state.totalSpent}</div></div>
        <div className="kpi"><div className="kpi-label"><Timer size={14} color="var(--teal)" /> 累计专注</div>
          <div className="kpi-value">{fmtDuration(totalTime)}</div><div className="kpi-note">{state.timeRecords.length} 条计时</div></div>
        <div className="kpi"><div className="kpi-label"><Flame size={14} color="var(--amber)" /> 习惯达成</div>
          <div className="kpi-value">{habit.rate}<small>%</small></div><div className="kpi-note">{habit.monthlyActual}/{habit.monthlyExpected} 次 · 累计 {habit.cumulative}</div></div>
      </div>

      {/* KPI 关联任务弹窗（只读） */}
      <Modal open={!!kpiModal} title={kpiModal?.title || ''} onClose={() => setKpiModal(null)} width={620}>
        {kpiModal && (
          <div className="col" style={{ gap: 6, maxHeight: 420, overflow: 'auto' }}>
            {kpiModal.rows.length === 0 && <div className="empty" style={{ padding: '18px' }}><div className="empty-text">暂无数据</div></div>}
            {kpiModal.rows.map(({ task }: { task: FdTask }, i) => (
              <div className="list-item" key={task.id + i} style={{ padding: '7px 2px' }}>
                <div className="list-item-main">
                  <div className="list-item-title" style={{ fontSize: 13 }}>
                    {task.priority && <span className={`badge ${prioClass(task.priority)}`} style={{ marginRight: 6 }}>{task.priority}</span>}
                    {task.title}
                  </div>
                  <div className="list-item-sub">
                    <span className={`badge ${task.status === 'done' || task.status === 'archived' ? 'badge-green' : task.status === 'doing' ? 'badge-amber' : 'badge-muted'}`} style={{ marginRight: 6 }}>
                      {task.status === 'todo' ? '待处理' : task.status === 'doing' ? '进行中' : task.status === 'done' ? '已完成' : task.status === 'archived' ? '已归档' : '待转化'}
                    </span>
                    {task.dueDate && <span className="tiny muted-3" style={{ marginRight: 6 }}>截止 {md(task.dueDate)}</span>}
                    {task.completedAt && <span className="tiny muted-3">完成 {fmtDate(task.completedAt)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

/** 折线趋势图（纯 SVG） */
function TrendLine({ trend, max }: { trend: { label: string; count: number }[]; max: number }) {
  const W = 560, H = 150, PAD = 14;
  const n = trend.length;
  const step = n > 1 ? (W - PAD * 2) / (n - 1) : 0;
  const pts = trend.map((t, i) => `${(PAD + i * step).toFixed(1)},${(H - PAD - (t.count / max) * (H - PAD * 2)).toFixed(1)}`);
  const labelEvery = Math.max(1, Math.ceil(n / 9));
  if (n === 0) return <div className="empty" style={{ padding: '30px' }}><div className="empty-text">范围内没有完成记录</div></div>;
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 14}`} preserveAspectRatio="xMidYMid meet" style={{ minWidth: n > 24 ? 560 : '100%', display: 'block' }}>
        {/* 网格线 */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1={PAD} x2={W - PAD} y1={H - PAD - f * (H - PAD * 2)} y2={H - PAD - f * (H - PAD * 2)} stroke="rgba(0,0,0,0.06)" strokeDasharray="3 4" />
        ))}
        {/* 折线 */}
        <polyline points={pts.join(' ')} fill="none" stroke="#3B6EF6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* 数据点 */}
        {trend.map((t, i) => (
          <circle key={i} cx={PAD + i * step} cy={H - PAD - (t.count / max) * (H - PAD * 2)} r={t.count ? 2.6 : 1.6} fill={t.count ? '#3B6EF6' : 'rgba(0,0,0,0.15)'}>
            <title>{t.label}：完成 {t.count}</title>
          </circle>
        ))}
        {/* x 轴标签 */}
        {trend.map((t, i) => i % labelEvery === 0 || i === n - 1 ? (
          <text key={i} x={PAD + i * step} y={H + 10} fontSize="9" fill="#9CA3AF" textAnchor="middle">{t.label}</text>
        ) : null)}
        {/* y 轴峰值提示 */}
        <text x={W - PAD} y={14} fontSize="9.5" fill="#9CA3AF" textAnchor="end">峰值 {max}</text>
      </svg>
    </div>
  );
}
