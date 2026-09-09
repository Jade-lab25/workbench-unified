import { useMemo, useState } from 'react';
import {
  CheckCircle2, Circle, Plus, Flame, Timer, Sparkles, Target, ChevronRight, Clock,
  Inbox, TrendingUp,
} from 'lucide-react';
import type { AppState, FdTask } from '../types';
import { dailyWorkStats, computeHabitStats, goalProgress } from '../utils/stats';
import { todayISO, fmtDuration, fmtTime, parseISO } from '../utils/dates';

interface Props {
  state: AppState;
  store: any;
  userId: string | null;
  toast: (t: string, type?: 'info' | 'success' | 'error') => void;
}

export function TodayView({ state, store, toast }: Props) {
  const [newTodo, setNewTodo] = useState('');
  const [newIdea, setNewIdea] = useState('');
  const [newLog, setNewLog] = useState('');
  const today = todayISO();
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date().getDay()];

  const work = useMemo(
    () => dailyWorkStats(today, state.todos, state.checkInRecords, state.timeRecords, state.achievementLogs),
    [today, state.todos, state.checkInRecords, state.timeRecords, state.achievementLogs],
  );
  const habitStats = useMemo(
    () => computeHabitStats(state.fdHabits, state.fdHabitLogs),
    [state.fdHabits, state.fdHabitLogs],
  );

  const pendingTodos = state.todos.filter(t => !t.isCompleted);
  const dueTasks = useMemo(() => state.fdTasks.filter(t =>
    t.fdType === 'task' && t.status !== 'done' && t.status !== 'archived' && t.dueDate === today,
  ), [state.fdTasks, today]);
  const overdueTasks = useMemo(() => state.fdTasks.filter(t =>
    t.fdType === 'task' && t.status !== 'done' && t.status !== 'archived' && t.dueDate && t.dueDate < today,
  ), [state.fdTasks, today]);

  const wd = (new Date().getDay() + 6) % 7;
  const dueHabits = state.fdHabits.filter(h => (h.weekdays || []).includes(wd));
  const todayTimeRecords = state.timeRecords
    .filter(r => parseISO(r.startTime) === today)
    .sort((a, b) => b.startTime.localeCompare(a.startTime))
    .slice(0, 6);

  const addTodo = () => {
    const title = newTodo.trim();
    if (!title) return;
    store.addTodo(title, 'one-time');
    setNewTodo('');
    toast('已添加到待办', 'success');
  };
  const addIdea = () => {
    const content = newIdea.trim();
    if (!content) return;
    store.addInspiration(content);
    setNewIdea('');
    toast('灵感已记录', 'success');
  };
  const addLog = () => {
    const matter = newLog.trim();
    if (!matter) return;
    store.addSummaryLog({ date: today, matter, result: '', data: '', issue: '' });
    setNewLog('');
    toast('工作日志已记录', 'success');
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">
            {new Date().getMonth() + 1}月{new Date().getDate()}日 · 周{weekday}
          </div>
          <div className="page-desc">把今天要做的事、该打的卡、想记的话都放在这里</div>
        </div>
      </div>

      {/* KPI 概览 */}
      <div className="kpi-grid mb16">
        <div className="kpi">
          <div className="kpi-label"><CheckCircle2 size={14} color="var(--green)" /> 今日待办</div>
          <div className="kpi-value">{work.doneTodos}<small>/{work.totalTodos} 完成</small></div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><Flame size={14} color="var(--amber)" /> 今日打卡</div>
          <div className="kpi-value">{work.checkIns}<small>次</small></div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><Timer size={14} color="var(--accent)" /> 今日专注</div>
          <div className="kpi-value">{fmtDuration(work.timeSeconds)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><Sparkles size={14} color="var(--violet)" /> 今日成就</div>
          <div className="kpi-value">{work.points > 0 ? '+' : ''}{work.points}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><TrendingUp size={14} color="var(--teal)" /> 累计成就</div>
          <div className="kpi-value">{state.totalAchievements}</div>
        </div>
      </div>

      <div className="grid-2">
        {/* 今日待办 */}
        <div className="card">
          <div className="card-head">
            <div className="card-title"><CheckCircle2 size={16} /> 今日待办</div>
            <span className="badge badge-muted">{pendingTodos.length} 项未完成</span>
          </div>
          <div className="row mb12">
            <input className="input grow" placeholder="添加一个待办，回车确认" value={newTodo}
              onChange={e => setNewTodo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTodo(); }} />
            <button className="btn btn-primary btn-sm" onClick={addTodo}><Plus size={14} />添加</button>
          </div>
          {pendingTodos.length === 0 ? (
            <div className="empty" style={{ padding: '20px 8px' }}>
              <span className="ic"><Circle size={26} /></span>
              <div className="empty-text">今天没有待办，轻松的一天</div>
            </div>
          ) : (
            pendingTodos.slice(0, 8).map(t => (
              <div className="list-item" key={t.id}>
                <button
                  className="btn-icon" style={{ color: 'var(--text-3)' }}
                  onClick={() => { store.completeTodo(t.id); toast('完成 +5 成就值', 'success'); }}
                  title="完成"
                >
                  <Circle size={19} />
                </button>
                <div className="list-item-main">
                  <div className="list-item-title">{t.title}</div>
                  <div className="list-item-sub">
                    {t.isDelayed && <span className="badge badge-amber" style={{ marginRight: 6 }}>拖延 {t.delayCount} 次</span>}
                    {t.isTiming ? <span className="badge badge-accent">计时中</span> : t.totalTime > 0 && <span className="badge badge-muted">{fmtDuration(t.totalTime)}</span>}
                  </div>
                </div>
                <button className="btn-icon danger" onClick={() => store.deleteTodo(t.id)} title="删除">×</button>
              </div>
            ))
          )}
        </div>

        {/* 今日到期任务 + 逾期 */}
        <div className="card">
          <div className="card-head">
            <div className="card-title"><Target size={16} /> 目标任务</div>
            {(dueTasks.length + overdueTasks.length) > 0 && <span className="badge badge-red">{dueTasks.length + overdueTasks.length}</span>}
          </div>
          {dueTasks.length === 0 && overdueTasks.length === 0 ? (
            <div className="empty" style={{ padding: '20px 8px' }}>
              <span className="ic"><Target size={26} /></span>
              <div className="empty-text">今天没有到期任务</div>
            </div>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {overdueTasks.slice(0, 4).map(t => (
                <TaskRow key={t.id} task={t} state={state} store={store} overdue />
              ))}
              {dueTasks.slice(0, 6).map(t => (
                <TaskRow key={t.id} task={t} state={state} store={store} />
              ))}
            </div>
          )}
          <div className="mt12" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div className="row-between">
              <div className="small muted">习惯打卡 · 本月 {habitStats.monthlyActual}/{habitStats.monthlyExpected}</div>
              <div className="row" style={{ gap: 5 }}>
                <span className="badge badge-accent">{habitStats.rate}%</span>
                <span className="badge badge-muted">累计 {habitStats.cumulative} 次</span>
              </div>
            </div>
            <div className="mt8" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {dueHabits.length === 0 && <span className="tiny muted-3">今天没有需要打卡的习惯</span>}
              {dueHabits.map(h => {
                const done = state.fdHabitLogs.some(l => l.habitId === h.id && l.logDate === today);
                return (
                  <button key={h.id} className={`chip${done ? ' active' : ''}`}
                    onClick={() => {
                      store.toggleFdHabitLog(h.id, today);
                      toast(done ? '已取消打卡' : `「${h.name}」打卡成功`, done ? 'info' : 'success');
                    }}>
                    <Flame size={12} /> {h.name} {done ? '· 已打' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 今日时间 */}
        <div className="card">
          <div className="card-head">
            <div className="card-title"><Clock size={16} /> 今日时间记录</div>
            <span className="badge badge-muted">共 {fmtDuration(work.timeSeconds)}</span>
          </div>
          {todayTimeRecords.length === 0 ? (
            <div className="empty" style={{ padding: '20px 8px' }}>
              <span className="ic"><Clock size={26} /></span>
              <div className="empty-text">还没有计时记录，去「工作 → 时间」开始计时</div>
            </div>
          ) : (
            todayTimeRecords.map(r => (
              <div className="list-item" key={r.id}>
                <div className="list-item-main">
                  <div className="list-item-title">{r.content}</div>
                  <div className="list-item-sub">{fmtTime(r.startTime)} → {r.endTime ? fmtTime(r.endTime) : '进行中'}</div>
                </div>
                <span className="badge badge-muted">{fmtDuration(((new Date(r.endTime).getTime() - (r.startTimestamp || new Date(r.startTime).getTime())) / 1000))}</span>
              </div>
            ))
          )}
        </div>

        {/* 快捷记录 */}
        <div className="card">
          <div className="card-head">
            <div className="card-title"><Inbox size={16} /> 快捷记录</div>
          </div>
          <div className="col" style={{ gap: 10 }}>
            <div className="field">
              <label className="field-label">记一条灵感</label>
              <div className="row">
                <input className="input grow" placeholder="突然想到的点子、反思、高光时刻…" value={newIdea}
                  onChange={e => setNewIdea(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addIdea(); }} />
                <button className="btn btn-soft btn-sm" onClick={addIdea}>记录</button>
              </div>
            </div>
            <div className="field">
              <label className="field-label">记一条工作日志</label>
              <div className="row">
                <input className="input grow" placeholder="今天做了什么？结果如何？" value={newLog}
                  onChange={e => setNewLog(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addLog(); }} />
                <button className="btn btn-soft btn-sm" onClick={addLog}>记录</button>
              </div>
            </div>
            <div className="row mt8" style={{ color: 'var(--text-3)', fontSize: 12 }}>
              <ChevronRight size={14} /> 记录会进入「总结」的灵感库与工作日志，自动参与周报生成
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task, state, store, overdue }: { task: FdTask; state: AppState; store: any; overdue?: boolean }) {
  const g = state.fdGoals.find(x => x.id === task.goalId);
  const progress = goalProgress(task);
  return (
    <div className="list-item" style={{ padding: '8px 2px' }}>
      <button
        className="btn-icon" style={{ color: 'var(--text-3)', flexShrink: 0 }}
        onClick={() => { store.setFdTaskStatus(task.id, 'done'); }}
        title="标记完成"
      >
        <Circle size={18} />
      </button>
      <div className="list-item-main">
        <div className="list-item-title" style={{ fontSize: 13 }}>
          {overdue && <span className="badge badge-red" style={{ marginRight: 6 }}>逾期</span>}
          {task.priority && <span className={`badge ${task.priority === 'P0' ? 'badge-red' : 'badge-amber'}`} style={{ marginRight: 6 }}>{task.priority}</span>}
          {task.title}
        </div>
        <div className="list-item-sub">
          {g && <span className="badge badge-slate" style={{ marginRight: 6 }}>{g.title}</span>}
          {progress > 0 && <span className="tiny muted-3">拆解 {progress}%</span>}
        </div>
      </div>
      <button className="btn-icon danger" onClick={() => store.deleteFdTask(task.id)} title="删除">×</button>
    </div>
  );
}
