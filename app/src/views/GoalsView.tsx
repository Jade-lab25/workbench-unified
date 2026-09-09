import { useMemo, useState } from 'react';
import {
  Plus, Flag, CheckSquare, Flame, Archive, Trash2, RotateCcw, ChevronDown, ChevronRight,
  Circle, CheckCircle2, Pencil, ListPlus,
} from 'lucide-react';
import type { AppState, FdGoal, FdHabit, FdSubtask, FdTask } from '../types';
import { Seg, Modal, Empty, Progress } from '../components/ui';
import { computeHabitStats, countAllSubtasks, countDoneSubtasks } from '../utils/stats';
import { todayISO, fmtDate } from '../utils/dates';

type Sub = 'goals' | 'board' | 'habits' | 'archive';

interface Props {
  state: AppState;
  store: any;
  userId: string | null;
  toast: (t: string, type?: 'info' | 'success' | 'error') => void;
}

export function GoalsView({ state, store, toast }: Props) {
  const [sub, setSub] = useState<Sub>('goals');
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDesc, setGoalDesc] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskGoal, setTaskGoal] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [habitName, setHabitName] = useState('');
  const [habitDays, setHabitDays] = useState<number[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<FdGoal | null>(null);

  const today = todayISO();
  const activeGoals = state.fdGoals.filter(g => g.status === 'active');
  const tasks = state.fdTasks;
  const habitStats = useMemo(() => computeHabitStats(state.fdHabits, state.fdHabitLogs), [state.fdHabits, state.fdHabitLogs]);
  const editingTask = editingTaskId ? state.fdTasks.find(t => t.id === editingTaskId) ?? null : null;

  const addGoal = () => {
    if (!goalTitle.trim()) return;
    store.addFdGoal(goalTitle.trim(), goalDesc.trim());
    setGoalTitle(''); setGoalDesc(''); setShowAddGoal(false);
    toast('目标已创建', 'success');
  };
  const addTask = () => {
    if (!taskTitle.trim()) return;
    store.addFdTask({
      title: taskTitle.trim(),
      priority: taskPriority,
      dueDate: taskDue,
      goalId: taskGoal || null,
      fdType: 'task',
    } as any);
    setTaskTitle(''); setTaskPriority(''); setTaskDue(''); setTaskGoal(''); setShowAddTask(false);
    toast('任务已添加', 'success');
  };
  const addHabit = () => {
    if (!habitName.trim()) return;
    store.addFdHabit(habitName.trim(), habitDays.length ? habitDays : [0, 1, 2, 3, 4, 5, 6]);
    setHabitName(''); setHabitDays([]); setShowAddHabit(false);
    toast('习惯已创建', 'success');
  };
  const toggleDay = (d: number) => {
    setHabitDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };

  const goalTasks = (gid: string) => tasks.filter(t => t.goalId === gid && t.fdType === 'task' && t.status !== 'archived');

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">目标追踪</div>
          <div className="page-desc">目标拆解 · 看板流转 · 习惯打卡 · 归档复盘</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAddTask(true)}><Plus size={15} /> 新任务</button>
          <button className="btn btn-soft" onClick={() => setShowAddGoal(true)}><Flag size={15} /> 新目标</button>
        </div>
      </div>

      <div className="mb16"><Seg<Sub>
        value={sub}
        onChange={setSub}
        items={[
          { key: 'goals', label: '目标', count: activeGoals.length },
          { key: 'board', label: '看板', count: tasks.filter(t => t.fdType === 'task' && t.status !== 'done' && t.status !== 'archived').length },
          { key: 'habits', label: '习惯打卡', count: state.fdHabits.length },
          { key: 'archive', label: '归档', count: tasks.filter(t => t.status === 'archived').length },
        ]}
      /></div>

      {/* ── 目标列表 ── */}
      {sub === 'goals' && (
        <div className="col" style={{ gap: 12 }}>
          {activeGoals.length === 0 && (
            <div className="card"><Empty icon={<Flag size={28} />} text="还没有目标，点击右上角「新目标」开始" /></div>
          )}
          {activeGoals.map(g => {
            const gts = goalTasks(g.id);
            const all = gts.reduce((s, t) => s + countAllSubtasks(t.subtasks), 0);
            const doneSub = gts.reduce((s, t) => s + countDoneSubtasks(t.subtasks), 0);
            const open = !!expanded[g.id];
            return (
              <div className="card" key={g.id}>
                <div className="row-between">
                  <div className="row" style={{ gap: 10, flex: 1, minWidth: 0 }}>
                    <button className="btn-icon" onClick={() => setExpanded({ ...expanded, [g.id]: !open })}>
                      {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <button className="grow" style={{ textAlign: 'left' }} onClick={() => setEditingGoal(g)}>
                      <div className="bold" style={{ fontSize: 14.5 }}>{g.title}</div>
                      {g.description && <div className="small muted" style={{ marginTop: 2 }}>{g.description}</div>}
                    </button>
                  </div>
                  <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                    <span className="badge badge-muted">{g.status === 'active' ? '进行中' : g.status === 'paused' ? '已暂停' : '已完成'}</span>
                    <span className="badge badge-accent">{gts.length} 个任务</span>
                    <span className="badge badge-muted">拆解 {all ? Math.round(doneSub / all * 100) : 0}%</span>
                    <button className="btn-icon" title="编辑目标" onClick={() => setEditingGoal(g)}><Pencil size={14} /></button>
                    <button className="btn-icon danger" onClick={() => { store.deleteFdGoal(g.id); toast('目标已删除'); }}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="mt12">
                  <Progress value={g.progress > 0 ? g.progress : (all ? Math.round(doneSub / all * 100) : 0)} />
                </div>
                {open && (
                  <div className="mt12" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    {gts.length === 0 && <div className="empty" style={{ padding: '14px 8px' }}><div className="empty-text">还没有任务，点击「新任务」添加</div></div>}
                    {gts.map(t => (
                      <div className="list-item" key={t.id}>
                        <button className="btn-icon" style={{ color: t.status === 'done' ? 'var(--green)' : 'var(--text-3)' }}
                          onClick={() => { store.setFdTaskStatus(t.id, t.status === 'done' ? 'todo' : 'done'); }}>
                          {t.status === 'done' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                        </button>
                        <button className="list-item-main" style={{ textAlign: 'left' }} onClick={() => setEditingTaskId(t.id)}>
                          <div className={`list-item-title${t.status === 'done' ? ' done' : ''}`}>{t.title}</div>
                          <div className="list-item-sub">
                            {t.priority && <span className={`badge ${t.priority === 'P0' ? 'badge-red' : 'badge-amber'}`} style={{ marginRight: 6 }}>{t.priority}</span>}
                            {t.dueDate && <span className="badge badge-muted">{fmtDate(t.dueDate)}{t.dueDate < today ? ' 已逾期' : ''}</span>}
                            {countAllSubtasks(t.subtasks) > 0 && <span className="badge badge-slate" style={{ marginLeft: 6 }}>{countDoneSubtasks(t.subtasks)}/{countAllSubtasks(t.subtasks)} 拆解</span>}
                          </div>
                        </button>
                        <button className="btn-icon" title="编辑任务" onClick={() => setEditingTaskId(t.id)}><Pencil size={14} /></button>
                        <button className="btn-icon danger" onClick={() => store.deleteFdTask(t.id)}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 看板 ── */}
      {sub === 'board' && <BoardView state={state} store={store} onEdit={setEditingTaskId} />}

      {/* ── 习惯打卡 ── */}
      {sub === 'habits' && (
        <div className="col" style={{ gap: 12 }}>
          <div className="card">
            <div className="row-between">
              <div className="card-title"><Flame size={16} /> 习惯打卡</div>
              <button className="btn btn-soft btn-sm" onClick={() => setShowAddHabit(true)}><Plus size={14} /> 新习惯</button>
            </div>
            <div className="row mt8 wrap" style={{ gap: 8 }}>
              <span className="badge badge-accent">本月 {habitStats.monthlyActual}/{habitStats.monthlyExpected}</span>
              <span className="badge badge-green">达成率 {habitStats.rate}%</span>
              <span className="badge badge-muted">累计 {habitStats.cumulative} 次</span>
              {habitStats.lastCheckIn && <span className="badge badge-muted">上次 {fmtDate(habitStats.lastCheckIn)}</span>}
            </div>
          </div>
          {state.fdHabits.length === 0 && (
            <div className="card"><Empty icon={<Flame size={28} />} text="还没有习惯，创建一个长期打卡吧" /></div>
          )}
          {state.fdHabits.map(h => (
            <div className="card" key={h.id}>
              <div className="row-between mb12">
                <div className="row" style={{ gap: 8 }}>
                  <span className="bold">{h.name}</span>
                  <span className="badge badge-muted">
                    {h.weekdays.length === 7 ? '每天' : h.weekdays.map(d => '一二三四五六日'[d]).join('·')}
                  </span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="badge badge-green">{state.fdHabitLogs.filter(l => l.habitId === h.id).length} 次</span>
                  <button className="btn-icon danger" onClick={() => { store.deleteFdHabit(h.id); toast('习惯已删除'); }}><Trash2 size={14} /></button>
                </div>
              </div>
              <HabitHeat habit={h} state={state} store={store} today={today} />
            </div>
          ))}
        </div>
      )}

      {/* ── 归档 ── */}
      {sub === 'archive' && (
        <div className="card">
          {tasks.filter(t => t.status === 'archived').length === 0 ? (
            <Empty icon={<Archive size={28} />} text="归档区是空的" />
          ) : (
            tasks.filter(t => t.status === 'archived').map(t => (
              <div className="list-item" key={t.id}>
                <div className="list-item-main">
                  <div className="list-item-title">{t.title}</div>
                  <div className="list-item-sub">
                    {state.fdGoals.find(g => g.id === t.goalId)?.title && <span className="badge badge-slate" style={{ marginRight: 6 }}>{state.fdGoals.find(g => g.id === t.goalId)?.title}</span>}
                    <span className="badge badge-muted">完成于 {t.completedAt ? fmtDate(t.completedAt) : '—'}</span>
                  </div>
                </div>
                <button className="btn-icon" title="恢复" onClick={() => { store.setFdTaskStatus(t.id, 'todo'); toast('已恢复到待处理'); }}>
                  <RotateCcw size={15} />
                </button>
                <button className="btn-icon danger" title="永久删除" onClick={() => { store.deleteFdTask(t.id); toast('已永久删除'); }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* 新目标弹窗 */}
      <Modal open={showAddGoal} title="创建新目标" onClose={() => setShowAddGoal(false)}>
        <div className="col">
          <div className="field"><label className="field-label">目标名称</label>
            <input className="input" value={goalTitle} onChange={e => setGoalTitle(e.target.value)} placeholder="例如：Q3 亚马逊利润表自动化" autoFocus /></div>
          <div className="field"><label className="field-label">描述（可选）</label>
            <textarea className="textarea" rows={3} value={goalDesc} onChange={e => setGoalDesc(e.target.value)} placeholder="为什么要做这个目标？" /></div>
          <button className="btn btn-primary" onClick={addGoal}>创建</button>
        </div>
      </Modal>

      {/* 新任务弹窗 */}
      <Modal open={showAddTask} title="添加任务" onClose={() => setShowAddTask(false)}>
        <div className="col">
          <div className="field"><label className="field-label">任务内容</label>
            <input className="input" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="要做什么？" autoFocus /></div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field grow">
              <label className="field-label">优先级</label>
              <select className="select" value={taskPriority} onChange={e => setTaskPriority(e.target.value)}>
                <option value="">无</option><option>P0</option><option>P1</option><option>P2</option><option>P3</option>
              </select>
            </div>
            <div className="field grow">
              <label className="field-label">截止日期</label>
              <input className="input" type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)} />
            </div>
            <div className="field grow">
              <label className="field-label">所属目标</label>
              <select className="select" value={taskGoal} onChange={e => setTaskGoal(e.target.value)}>
                <option value="">无</option>
                {activeGoals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={addTask}>添加</button>
        </div>
      </Modal>

      {/* 新习惯弹窗 */}
      <Modal open={showAddHabit} title="创建习惯打卡" onClose={() => setShowAddHabit(false)}>
        <div className="col">
          <div className="field"><label className="field-label">习惯名称</label>
            <input className="input" value={habitName} onChange={e => setHabitName(e.target.value)} placeholder="例如：每周跑步 3 次" autoFocus /></div>
          <div className="field">
            <label className="field-label">每周哪几天（不选默认每天）</label>
            <div className="row wrap" style={{ gap: 6 }}>
              {['一', '二', '三', '四', '五', '六', '日'].map((d, i) => (
                <button key={d} className={`chip${habitDays.includes(i) ? ' active' : ''}`} onClick={() => toggleDay(i)}>{d}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={addHabit}>创建</button>
        </div>
      </Modal>

      {/* 任务编辑器（详情 + 拆解） */}
      {editingTask && (
        <TaskEditor
          key={editingTask.id}
          task={editingTask}
          state={state}
          store={store}
          toast={toast}
          onClose={() => setEditingTaskId(null)}
        />
      )}

      {/* 目标编辑器 */}
      {editingGoal && (
        <GoalEditor
          key={editingGoal.id}
          goal={editingGoal}
          store={store}
          toast={toast}
          onClose={() => setEditingGoal(null)}
        />
      )}
    </div>
  );
}

/* ═══════════ 任务编辑器 ═══════════ */
export function TaskEditor({ task, state, store, toast, onClose }: {
  task: FdTask; state: AppState; store: any;
  toast: (t: string, type?: 'info' | 'success' | 'error') => void; onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [goalId, setGoalId] = useState(task.goalId || '');
  const [note, setNote] = useState(task.note);
  const [tags, setTags] = useState(task.tags);
  const [subText, setSubText] = useState('');
  const [childOpen, setChildOpen] = useState<Record<string, boolean>>({});
  const [childInputs, setChildInputs] = useState<Record<string, string>>({});

  const all = countAllSubtasks(task.subtasks);
  const done = countDoneSubtasks(task.subtasks);

  const save = () => {
    if (!title.trim()) { toast('任务内容不能为空', 'error'); return; }
    store.updateFdTask(task.id, {
      title: title.trim(),
      priority,
      dueDate,
      goalId: goalId || null,
      note: note.trim(),
      tags: tags.trim(),
    });
    toast('已保存修改', 'success');
    onClose();
  };
  const addSub = () => {
    if (!subText.trim()) return;
    store.addFdSubtask(task.id, subText.trim());
    setSubText('');
  };
  const addChild = (parentId: string) => {
    const t = (childInputs[parentId] || '').trim();
    if (!t) return;
    store.addFdSubtaskChild(task.id, parentId, t);
    setChildInputs({ ...childInputs, [parentId]: '' });
  };

  return (
    <Modal open title={task.status === 'done' ? '任务详情（已完成）' : '任务详情'} onClose={onClose} width={560}>
      <div className="col" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <div className="field grow"><label className="field-label">任务内容</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} autoFocus /></div>
          <div className="field" style={{ width: 108 }}><label className="field-label">优先级</label>
            <select className="select" value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="">无</option><option>P0</option><option>P1</option><option>P2</option><option>P3</option>
            </select></div>
        </div>
        <div className="row">
          <div className="field grow"><label className="field-label">截止日期</label>
            <input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
          <div className="field grow"><label className="field-label">所属目标</label>
            <select className="select" value={goalId} onChange={e => setGoalId(e.target.value)}>
              <option value="">无</option>
              {state.fdGoals.filter(g => g.status !== 'done').map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select></div>
        </div>
        <div className="row">
          <div className="field grow"><label className="field-label">标签</label>
            <input className="input" value={tags} onChange={e => setTags(e.target.value)} placeholder="用逗号分隔，如：选品, 竞品分析" /></div>
          <div className="field grow"><label className="field-label">状态</label>
            <select className="select" value={task.status} onChange={e => { store.setFdTaskStatus(task.id, e.target.value as any); }}>
              <option value="todo">待处理</option><option value="doing">进行中</option>
              <option value="done">已完成</option><option value="archived">已归档</option>
            </select></div>
        </div>
        <div className="field"><label className="field-label">备注</label>
          <textarea className="textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="背景、上下文、验收标准…" /></div>

        {/* 子任务拆解 */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div className="row-between mb8">
            <div className="card-title" style={{ marginBottom: 0 }}><ListPlus size={15} /> 拆解 {done}/{all}</div>
            <div style={{ width: 90 }}><Progress value={all ? Math.round(done / all * 100) : 0} /></div>
          </div>
          {all > 0 && (
            <div className="mb8" style={{ maxHeight: 190, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 10px' }}>
              <Subtree
                subs={task.subtasks} taskId={task.id} store={store} depth={0}
                childOpen={childOpen} setChildOpen={setChildOpen}
                childInputs={childInputs} setChildInputs={setChildInputs}
                addChild={addChild}
              />
            </div>
          )}
          <div className="row">
            <input className="input grow" placeholder="添加一个拆解步骤，回车确认" value={subText}
              onChange={e => setSubText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSub(); }} />
            <button className="btn btn-soft btn-sm" onClick={addSub}>添加</button>
          </div>
          <div className="tiny muted-3 mt8">子项还可以再拆一层（点击子项右侧 + 号）</div>
        </div>

        <div className="row" style={{ gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <button className="btn btn-primary grow" onClick={save}>保存修改</button>
          <button className="btn btn-soft" onClick={() => { store.setFdTaskStatus(task.id, 'archived'); toast('已归档'); onClose(); }}>
            <Archive size={14} /> 归档
          </button>
          <button className="btn btn-danger" onClick={() => { if (window.confirm('确定永久删除该任务？')) { store.deleteFdTask(task.id); toast('已删除'); onClose(); } }}>
            <Trash2 size={14} /> 删除
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── 子任务树（递归，支持两层展开） ── */
function Subtree({ subs, taskId, store, depth, childOpen, setChildOpen, childInputs, setChildInputs, addChild }: {
  subs: FdSubtask[]; taskId: string; store: any; depth: number;
  childOpen: Record<string, boolean>; setChildOpen: (v: Record<string, boolean>) => void;
  childInputs: Record<string, string>; setChildInputs: (v: Record<string, string>) => void;
  addChild: (parentId: string) => void;
}) {
  return (
    <>
      {subs.map(s => (
        <div key={s.id}>
          <div className="row" style={{ gap: 6, padding: '5px 0', paddingLeft: depth * 20, alignItems: 'center' }}>
            <button className="btn-icon" style={{ color: s.done ? 'var(--green)' : 'var(--text-3)', flexShrink: 0 }}
              onClick={() => store.toggleFdSubtask(taskId, s.id)}>
              {s.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            </button>
            <span className={`small grow${s.done ? ' done' : ''}`} style={{ wordBreak: 'break-word' }}>{s.text}</span>
            {depth < 1 && (
              <button className="btn-icon" title="再拆一层" onClick={() => setChildOpen({ ...childOpen, [s.id]: !childOpen[s.id] })}>
                <Plus size={12} />
              </button>
            )}
            <button className="btn-icon danger" title="删除子项" onClick={() => store.deleteFdSubtask(taskId, s.id)}>
              <Trash2 size={12} />
            </button>
          </div>
          {depth < 1 && childOpen[s.id] && (
            <div className="row" style={{ gap: 6, paddingLeft: depth * 20 + 30, paddingBottom: 4 }}>
              <input className="input" style={{ height: 28, fontSize: 12.5 }} placeholder="子步骤…"
                value={childInputs[s.id] || ''}
                onChange={e => setChildInputs({ ...childInputs, [s.id]: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') addChild(s.id); }} />
              <button className="btn btn-soft btn-sm" onClick={() => addChild(s.id)}>添加</button>
            </div>
          )}
          {s.children?.length ? (
            <Subtree subs={s.children} taskId={taskId} store={store} depth={depth + 1}
              childOpen={childOpen} setChildOpen={setChildOpen}
              childInputs={childInputs} setChildInputs={setChildInputs}
              addChild={addChild} />
          ) : null}
        </div>
      ))}
    </>
  );
}

/* ═══════════ 目标编辑器 ═══════════ */
function GoalEditor({ goal, store, toast, onClose }: {
  goal: FdGoal; store: any;
  toast: (t: string, type?: 'info' | 'success' | 'error') => void; onClose: () => void;
}) {
  const [title, setTitle] = useState(goal.title);
  const [desc, setDesc] = useState(goal.description);
  const [status, setStatus] = useState(goal.status);
  const save = () => {
    if (!title.trim()) { toast('目标名称不能为空', 'error'); return; }
    store.updateFdGoal(goal.id, { title: title.trim(), description: desc.trim(), status });
    toast('已保存目标', 'success');
    onClose();
  };
  return (
    <Modal open title="编辑目标" onClose={onClose} width={440}>
      <div className="col">
        <div className="field"><label className="field-label">目标名称</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} autoFocus /></div>
        <div className="field"><label className="field-label">描述</label>
          <textarea className="textarea" rows={3} value={desc} onChange={e => setDesc(e.target.value)} /></div>
        <div className="field"><label className="field-label">状态</label>
          <select className="select" value={status} onChange={e => setStatus(e.target.value as FdGoal['status'])}>
            <option value="active">进行中</option><option value="paused">已暂停</option><option value="done">已完成</option>
          </select></div>
        <button className="btn btn-primary" onClick={save}>保存</button>
      </div>
    </Modal>
  );
}

/* ── 看板 ── */
function BoardView({ state, store, onEdit }: { state: AppState; store: any; onEdit: (id: string) => void }) {
  const cols: { key: string; title: string }[] = [
    { key: 'todo', title: '待处理' },
    { key: 'doing', title: '进行中' },
    { key: 'done', title: '已完成' },
  ];
  const items = state.fdTasks.filter(t => t.fdType === 'task' && t.status !== 'archived' && t.status !== 'idea');
  const next: Record<string, string> = { todo: 'doing', doing: 'done', done: 'todo' };
  return (
    <div className="kanban">
      {cols.map(c => {
        const list = items.filter(t => t.status === c.key);
        return (
          <div className="kb-col" key={c.key}>
            <div className="kb-col-head"><span>{c.title}</span><span>{list.length}</span></div>
            {list.length === 0 && <div className="tiny muted-3" style={{ padding: '8px 4px' }}>点击卡片可编辑，按钮流转状态 →</div>}
            {list.map(t => (
              <div className="kb-card" key={t.id}>
                <div className="row-between" style={{ alignItems: 'flex-start', gap: 8 }}>
                  <button className="grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => onEdit(t.id)}>
                    <div className="small" style={{ fontWeight: 600, wordBreak: 'break-word' }}>{t.title}</div>
                    <div className="row mt8 wrap" style={{ gap: 5 }}>
                      {t.priority && <span className={`badge ${t.priority === 'P0' ? 'badge-red' : 'badge-amber'}`}>{t.priority}</span>}
                      {t.dueDate && <span className={`badge ${t.dueDate < todayISO() && c.key !== 'done' ? 'badge-red' : 'badge-muted'}`}>{fmtDate(t.dueDate)}</span>}
                      {state.fdGoals.find(g => g.id === t.goalId) && <span className="badge badge-slate">{state.fdGoals.find(g => g.id === t.goalId)?.title}</span>}
                      {t.note && <span className="tiny muted-3" style={{ width: '100%', wordBreak: 'break-word' }}>{t.note}</span>}
                    </div>
                    {countAllSubtasks(t.subtasks) > 0 && (
                      <div className="mt8"><Progress value={Math.round(countDoneSubtasks(t.subtasks) / countAllSubtasks(t.subtasks) * 100)} /></div>
                    )}
                  </button>
                  <button className="btn-icon" title="流转状态" onClick={(e) => { e.stopPropagation(); store.setFdTaskStatus(t.id, next[c.key]); }}>
                    <CheckSquare size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ── 习惯热力条（近 12 周） ── */
function HabitHeat({ habit, state, store, today }: { habit: FdHabit; state: AppState; store: any; today: string }) {
  const weeks = 12;
  const cells: { date: string; done: boolean; future: boolean }[] = [];
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const wd = (d.getDay() + 6) % 7;
    if (!(habit.weekdays || []).includes(wd)) continue;
    const done = state.fdHabitLogs.some(l => l.habitId === habit.id && l.logDate === iso);
    cells.push({ date: iso, done, future: iso > today });
  }
  return (
    <div className="row wrap" style={{ gap: 4 }}>
      {cells.map(c => (
        <button
          key={c.date}
          title={c.date + (c.done ? ' ✓' : c.future ? '（未到）' : '')}
          onClick={() => { if (c.future) return; store.toggleFdHabitLog(habit.id, c.date); }}
          style={{
            width: 22, height: 22, borderRadius: 6, fontSize: 10, fontWeight: 600,
            background: c.future ? 'var(--surface-3)' : c.done ? 'var(--green)' : 'var(--surface-2)',
            color: c.done ? '#fff' : 'var(--text-3)',
            border: '1px solid var(--border)', cursor: c.future ? 'default' : 'pointer',
            opacity: c.future ? 0.45 : 1,
          }}
        >{c.done ? '✓' : ''}</button>
      ))}
      <span className="tiny muted-3" style={{ marginLeft: 8 }}>近 {weeks} 周（点击补打/取消）</span>
    </div>
  );
}
