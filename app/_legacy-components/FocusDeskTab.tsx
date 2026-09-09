import { useState, useMemo } from 'react';
import {
  Inbox, CalendarDays, Target, Columns3, Repeat, Plus, Check,
  Play, Flag, Trash2, X, ChevronDown, ChevronRight,
  Archive, BarChart3, ChevronLeft, RotateCcw, Eye, EyeOff,
} from 'lucide-react';
import type { FdGoal, FdTask, FdStatus, FdSubtask, FdHabit, FdHabitLog } from '../types';

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-orange-100 text-orange-700',
  P2: 'bg-blue-100 text-blue-700',
  P3: 'bg-gray-100 text-gray-600',
};

const STATUS_LABEL: Record<FdStatus, string> = {
  todo: '待处理',
  doing: '进行中',
  done: '已完成',
  idea: '待转化',
  archived: '已归档',
};

// 日历事件图例（按 kind 配色）
const EVENT_STYLE: Record<string, { dot: string; label: string }> = {
  idea: { dot: 'bg-amber-400', label: '灵感' },
  done: { dot: 'bg-green-400', label: '已完成' },
  overdue: { dot: 'bg-red-400', label: '逾期' },
  doing: { dot: 'bg-blue-400', label: '进行中' },
  task: { dot: 'bg-gray-400', label: '任务' },
  'habit-done': { dot: 'bg-green-500', label: '习惯已打卡' },
  habit: { dot: 'bg-gray-300', label: '习惯待打卡' },
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface FocusDeskTabProps {
  goals: FdGoal[];
  tasks: FdTask[];
  habits: FdHabit[];
  habitLogs: FdHabitLog[];
  onAddGoal: (title: string, description?: string) => void;
  onUpdateGoal: (id: string, updates: Partial<FdGoal>) => void;
  onDeleteGoal: (id: string) => void;
  onAddTask: (partial: {
    title: string; fdType?: 'task' | 'idea'; priority?: string; owner?: string;
    dueDate?: string; tags?: string; note?: string; goalId?: string | null;
  }) => void;
  onUpdateTask: (id: string, updates: Partial<FdTask>) => void;
  onDeleteTask: (id: string) => void;
  onSetTaskStatus: (id: string, status: FdStatus) => void;
  onConvertIdeaToTask: (id: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onToggleSubtask: (taskId: string, subId: string) => void;
  onDeleteSubtask: (taskId: string, subId: string) => void;
  onAddHabit: (name: string, weekdays?: number[]) => void;
  onDeleteHabit: (id: string) => void;
  onToggleHabitLog: (habitId: string, logDate: string) => void;
}

type SubView = 'inbox' | 'today' | 'goals' | 'kanban' | 'habits' | 'calendar' | 'dashboard' | 'archive';

// ─── 仪表盘统计项（任务 + 目标拆解子任务叶子，统一为"任务维度"） ───

interface DashTaskItem {
  id: string;
  title: string;
  status: FdStatus;
  priority: string;
  dueDate: string;
  createdAt: string;
  completedAt: string | null;
  isSubtask: boolean;
  goalTitle: string;
  owner: string;
}

export function FocusDeskTab(props: FocusDeskTabProps) {
  const {
    goals, tasks, habits, habitLogs,
    onAddGoal, onUpdateGoal, onDeleteGoal,
    onAddTask, onUpdateTask, onDeleteTask, onSetTaskStatus, onConvertIdeaToTask,
    onAddSubtask, onToggleSubtask, onDeleteSubtask,
    onAddHabit, onDeleteHabit, onToggleHabitLog,
  } = props;

  const [subView, setSubView] = useState<SubView>('inbox');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState('P2');
  const [quickDue, setQuickDue] = useState('');
  const [quickGoalId, setQuickGoalId] = useState('');
  const [editingTask, setEditingTask] = useState<FdTask | null>(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [habitName, setHabitName] = useState('');

  // 日历
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calHideDone, setCalHideDone] = useState(false);
  // 仪表盘
  const [dashRange, setDashRange] = useState<'7' | '30' | '90' | 'all' | 'custom'>('30');
  const [dashStart, setDashStart] = useState(() => rangeStart(30));
  const [dashEnd, setDashEnd] = useState(() => todayISO());
  // 归档
  const [archiveOwner, setArchiveOwner] = useState('');

  const activeGoals = useMemo(() => goals.filter(g => g.status !== 'done').sort((a, b) => a.sort - b.sort), [goals]);
  const liveTasks = useMemo(() => tasks.filter(t => t.status !== 'archived'), [tasks]);
  const today = todayISO();

  const dueTasks = useMemo(() => {
    return liveTasks.filter(t => t.status !== 'done' && t.status !== 'idea' && t.dueDate && t.dueDate <= today);
  }, [liveTasks, today]);

  const doingTasks = useMemo(() => liveTasks.filter(t => t.status === 'doing'), [liveTasks]);
  const ideaTasks = useMemo(() => liveTasks.filter(t => t.status === 'idea'), [liveTasks]);
  const archivedTasks = useMemo(() => tasks.filter(t => t.status === 'archived'), [tasks]);

  // ─── 仪表盘统计（任务维度：任务 + 目标拆解子任务叶子各算 1 个任务） ───
  const dashStats = useMemo(() => {
    const start = dashStart;
    const end = dashEnd;
    const taskRecords = tasks.filter(t => t.fdType !== 'idea');
    const ideaRecords = tasks.filter(t => t.fdType === 'idea');

    const flat: DashTaskItem[] = [];
    taskRecords.forEach(t => {
      const goalTitle = goals.find(g => g.id === t.goalId)?.title || '';
      flat.push({
        id: t.id, title: t.title, status: t.status, priority: t.priority,
        dueDate: t.dueDate, createdAt: t.createdAt, completedAt: t.completedAt,
        isSubtask: false, goalTitle, owner: t.owner,
      });
      collectLeaves(t.subtasks).forEach(s => {
        flat.push({
          id: `${t.id}:${s.id}`, title: s.text,
          status: s.done ? 'done' : t.status,
          priority: t.priority, dueDate: t.dueDate,
          createdAt: t.createdAt,
          completedAt: s.done ? (t.completedAt || t.createdAt) : null,
          isSubtask: true, goalTitle, owner: t.owner,
        });
      });
    });

    const inRange = (iso: string) => {
      if (!iso) return false;
      const d = iso.slice(0, 10);
      return d >= start && d <= end;
    };
    const isActive = (f: DashTaskItem) => f.status !== 'done' && f.status !== 'archived';
    const isOverdue = (f: DashTaskItem) => !!(f.dueDate) && isActive(f) && daysBetween(todayISO(), f.dueDate) < 0;

    const tasksInRange = flat.filter(f => inRange(f.createdAt));
    const completedInRange = flat.filter(f => (f.status === 'done' || f.status === 'archived') && f.completedAt && inRange(f.completedAt));
    const total = tasksInRange.length;
    const done = completedInRange.length;
    const doing = flat.filter(f => f.status === 'doing').length;
    const todo = flat.filter(f => f.status === 'todo').length;
    const overdue = flat.filter(isOverdue);
    const ideasPending = ideaRecords.filter(r => r.status === 'idea').length;
    const completionRate = total ? Math.round(done / total * 100) : 0;
    const p0 = tasksInRange.filter(f => f.priority === 'P0' && isActive(f)).length;
    const p1 = tasksInRange.filter(f => f.priority === 'P1' && isActive(f)).length;
    const p2 = tasksInRange.filter(f => f.priority === 'P2' && isActive(f)).length;
    const p3 = tasksInRange.filter(f => (f.priority === 'P3' || !f.priority) && isActive(f)).length;

    // 完成趋势（按日期桶累计）
    const dayCount: Record<string, number> = {};
    completedInRange.forEach(f => {
      const k = f.completedAt!.slice(0, 10);
      dayCount[k] = (dayCount[k] || 0) + 1;
    });
    const totalDays = daysBetween(start, end) + 1;
    const step = totalDays > 45 ? 7 : totalDays > 21 ? 2 : 1;
    const trend: { label: string; count: number }[] = [];
    for (let i = 0; i < totalDays; i += step) {
      const d = new Date(start + 'T00:00:00');
      d.setDate(d.getDate() + i);
      let cnt = 0;
      for (let j = 0; j < step && i + j < totalDays; j++) {
        const dd = new Date(start + 'T00:00:00');
        dd.setDate(dd.getDate() + i + j);
        cnt += dayCount[toISODate(dd)] || 0;
      }
      trend.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, count: cnt });
    }

    return {
      total, done, doing, todo, overdue, overdueCount: overdue.length,
      ideasPending, ideaRecords, completionRate, p0, p1, p2, p3,
      trend, goalCount: activeGoals.length, activeGoals,
    };
  }, [tasks, goals, activeGoals, dashStart, dashEnd]);

  // ─── 日历事件 ───
  const calendarEvents = useMemo(() => {
    const map: Record<string, { kind: string; title: string; id: string }[]> = {};
    const push = (date: string, ev: { kind: string; title: string; id: string }) => {
      if (!date) return;
      if (!map[date]) map[date] = [];
      map[date].push(ev);
    };
    const t = todayISO();
    tasks.forEach(r => {
      if (r.status === 'archived') return;
      if (r.fdType === 'idea') {
        if (r.dueDate) push(r.dueDate, { kind: 'idea', title: r.title, id: r.id });
      } else if (r.status === 'done') {
        const dateOn = (r.completedAt ? r.completedAt.slice(0, 10) : r.dueDate) || '';
        if (dateOn) push(dateOn, { kind: 'done', title: r.title, id: r.id });
      } else if (r.dueDate) {
        const d = daysBetween(t, r.dueDate);
        const k = d < 0 ? 'overdue' : r.status === 'doing' ? 'doing' : 'task';
        push(r.dueDate, { kind: k, title: r.title, id: r.id });
      }
    });
    // 习惯（近 120 天 ~ 未来 60 天）
    const todayMs = new Date(t + 'T00:00:00').getTime();
    habits.forEach(h => {
      const startISO = (h.createdAt || '').slice(0, 10);
      const startMs = startISO ? new Date(startISO + 'T00:00:00').getTime() : todayMs - 120 * 86400000;
      const fromMs = Math.max(startMs, todayMs - 120 * 86400000);
      const endMs = todayMs + 60 * 86400000;
      for (let m = fromMs; m <= endMs; m += 86400000) {
        const d = new Date(m);
        const iso = toISODate(d);
        const wd = (d.getDay() + 6) % 7;
        if (!(h.weekdays || []).includes(wd)) continue;
        const done = habitLogs.some(l => l.habitId === h.id && l.logDate === iso);
        push(iso, { kind: done ? 'habit-done' : 'habit', title: h.name, id: h.id });
      }
    });
    return map;
  }, [tasks, habits, habitLogs]);

  // ─── 习惯统计（长期打卡，今日视图底部 + 习惯视图顶部） ───
  const habitStats = useMemo(() => {
    const now = new Date();
    const month = todayISO().slice(0, 7);
    const cumulative = habitLogs.length;
    let lastCheckIn = '';
    habitLogs.forEach(l => { if (l.createdAt > lastCheckIn) lastCheckIn = l.createdAt; });
    const monthlyActual = habitLogs.filter(l => (l.logDate || '').startsWith(month)).length;
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let monthlyExpected = 0;
    habits.forEach(h => {
      for (let d = 1; d <= dim; d++) {
        const iso = `${month}-${String(d).padStart(2, '0')}`;
        const wd = (new Date(iso + 'T00:00:00').getDay() + 6) % 7;
        if ((h.weekdays || []).includes(wd)) monthlyExpected++;
      }
    });
    const rate = monthlyExpected ? Math.round(monthlyActual / monthlyExpected * 100) : 0;
    return { cumulative, lastCheckIn, monthlyActual, monthlyExpected, rate };
  }, [habits, habitLogs]);

  const handleQuickAdd = () => {
    const title = quickTitle.trim();
    if (!title) return;
    onAddTask({
      title,
      priority: quickPriority,
      dueDate: quickDue,
      goalId: quickGoalId || null,
    });
    setQuickTitle('');
    setQuickDue('');
  };

  const handleAddGoal = () => {
    const t = goalTitle.trim();
    if (!t) return;
    onAddGoal(t);
    setGoalTitle('');
  };

  const handleAddHabit = () => {
    const n = habitName.trim();
    if (!n) return;
    onAddHabit(n);
    setHabitName('');
  };

  const statusCycle = (t: FdTask) => {
    if (t.status === 'todo') onSetTaskStatus(t.id, 'doing');
    else if (t.status === 'doing') onSetTaskStatus(t.id, 'done');
    else onSetTaskStatus(t.id, 'todo');
  };

  const taskCard = (t: FdTask) => {
    const doneCount = countDoneSubtasks(t.subtasks);
    const totalCount = countAllSubtasks(t.subtasks);
    const overdue = t.dueDate && t.dueDate < today && t.status !== 'done';
    const goal = goals.find(g => g.id === t.goalId);
    return (
      <div key={t.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-start gap-2 hover:shadow-sm transition-shadow">
        <button
          onClick={() => statusCycle(t)}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            t.status === 'done' ? 'bg-green-500 border-green-500 text-white'
            : t.status === 'doing' ? 'border-blue-500 text-blue-500'
            : 'border-gray-300 text-transparent hover:border-blue-400'
          }`}
          title={STATUS_LABEL[t.status]}
        >
          {t.status === 'done' ? <Check size={12} /> : t.status === 'doing' ? <Play size={9} /> : null}
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => setEditingTask(t)} className="text-left w-full">
            <span className={`text-sm ${t.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              {t.title}
            </span>
          </button>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {t.priority && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_COLORS[t.priority] || 'bg-gray-100 text-gray-600'}`}>
                {t.priority}
              </span>
            )}
            {t.dueDate && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${overdue ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
                📅 {t.dueDate}{overdue ? ' 已逾期' : ''}
              </span>
            )}
            {goal && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">
                🎯 {goal.title}
              </span>
            )}
            {totalCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500">
                ☑ {doneCount}/{totalCount}
              </span>
            )}
            {t.fdType === 'idea' && (
              <button
                onClick={() => onConvertIdeaToTask(t.id)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 hover:bg-amber-100"
                title="转化为任务"
              >
                💡 灵感 → 转为任务
              </button>
            )}
          </div>
        </div>
        <button
          onClick={() => onDeleteTask(t.id)}
          className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors"
          title="删除"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  const subViews: { id: SubView; icon: typeof Inbox; label: string; count?: number }[] = [
    { id: 'inbox', icon: Inbox, label: '收集箱', count: liveTasks.filter(t => t.status !== 'done' && t.status !== 'idea').length },
    { id: 'today', icon: CalendarDays, label: '今日', count: dueTasks.length + doingTasks.length },
    { id: 'goals', icon: Target, label: '目标', count: activeGoals.length },
    { id: 'kanban', icon: Columns3, label: '看板' },
    { id: 'habits', icon: Repeat, label: '习惯', count: habits.length },
    { id: 'calendar', icon: CalendarDays, label: '日历' },
    { id: 'dashboard', icon: BarChart3, label: '仪表盘' },
    { id: 'archive', icon: Archive, label: '归档', count: archivedTasks.length },
  ];

  return (
    <div className="space-y-4">
      {/* 子视图切换 */}
      <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 overflow-x-auto">
        {subViews.map(v => (
          <button
            key={v.id}
            onClick={() => setSubView(v.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs md:text-sm font-medium whitespace-nowrap transition-colors ${
              subView === v.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <v.icon size={14} />
            {v.label}
            {v.count !== undefined && v.count > 0 && (
              <span className={`px-1.5 rounded-full text-[10px] ${subView === v.id ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                {v.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 快速添加 */}
      {subView !== 'goals' && subView !== 'habits' && (
        <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
          <div className="flex gap-2">
            <input
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
              placeholder="添加任务，回车快速收集…"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              onClick={handleQuickAdd}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm"
            >
              <Plus size={14} /> 添加
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <select value={quickPriority} onChange={e => setQuickPriority(e.target.value)} className="border border-gray-200 rounded px-2 py-1">
              {['P0', 'P1', 'P2', 'P3', ''].map(p => <option key={p || 'none'} value={p}>{p || '无优先级'}</option>)}
            </select>
            <input type="date" value={quickDue} onChange={e => setQuickDue(e.target.value)} className="border border-gray-200 rounded px-2 py-1" />
            <select value={quickGoalId} onChange={e => setQuickGoalId(e.target.value)} className="border border-gray-200 rounded px-2 py-1">
              <option value="">不关联目标</option>
              {activeGoals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* 收集箱 */}
      {subView === 'inbox' && (
        <div className="space-y-4">
          {ideaTasks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">灵感待转化</h4>
              <div className="space-y-2">{ideaTasks.map(taskCard)}</div>
            </div>
          )}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">全部任务</h4>
            <div className="space-y-2">
              {liveTasks.filter(t => t.status !== 'idea').length === 0
                ? <EmptyHint text="收集箱是空的，先添加一个任务吧" />
                : liveTasks.filter(t => t.status !== 'idea').map(taskCard)}
            </div>
          </div>
        </div>
      )}

      {/* 今日 */}
      {subView === 'today' && (
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-red-500 uppercase mb-2">已逾期</h4>
            <div className="space-y-2">
              {dueTasks.filter(t => t.dueDate < today).length === 0
                ? <EmptyHint text="没有逾期任务 👍" />
                : dueTasks.filter(t => t.dueDate < today).map(taskCard)}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">今天到期</h4>
            <div className="space-y-2">
              {dueTasks.filter(t => t.dueDate === today).length === 0
                ? <EmptyHint text="今天没有到期任务" />
                : dueTasks.filter(t => t.dueDate === today).map(taskCard)}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-blue-500 uppercase mb-2">进行中</h4>
            <div className="space-y-2">
              {doingTasks.length === 0 ? <EmptyHint text="没有进行中的任务" /> : doingTasks.map(taskCard)}
            </div>
          </div>
          {habitStats.cumulative > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-xs text-gray-500">
              长期打卡统计 · 累计 <b className="text-gray-700">{habitStats.cumulative}</b> 次
              {habitStats.lastCheckIn && <> · 上次 {habitStats.lastCheckIn.slice(0, 10)}</>}
              {' '}· 本月 <b className="text-gray-700">{habitStats.monthlyActual}/{habitStats.monthlyExpected}</b> ({habitStats.rate}%)
            </div>
          )}
        </div>
      )}

      {/* 目标 */}
      {subView === 'goals' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3 flex gap-2">
            <input
              value={goalTitle}
              onChange={e => setGoalTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddGoal()}
              placeholder="新目标名称，如：完成 Q3 自动化改造"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <button onClick={handleAddGoal} className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1 text-sm">
              <Plus size={14} /> 建目标
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {goals.length === 0 && <EmptyHint text="还没有目标，创建一个吧" />}
            {goals.sort((a, b) => a.sort - b.sort).map(g => {
              const linked = tasks.filter(t => t.goalId === g.id && t.status !== 'archived');
              const done = linked.filter(t => t.status === 'done').length;
              return (
                <div key={g.id} className={`bg-white rounded-lg border p-4 space-y-3 ${g.status === 'done' ? 'border-green-200 opacity-75' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h5 className={`text-sm font-semibold ${g.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{g.title}</h5>
                      {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => onUpdateGoal(g.id, { status: g.status === 'done' ? 'active' : 'done' })}
                        className={`px-2 py-1 rounded text-[10px] ${g.status === 'done' ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                        {g.status === 'done' ? '重新激活' : '标记完成'}
                      </button>
                      <button onClick={() => { if (confirm(`删除目标「${g.title}」？关联任务不会删除，只是解除关联。`)) onDeleteGoal(g.id); }}
                        className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>任务 {done}/{linked.length} 完成 · 手动进度 {g.progress}%</span>
                      <span className="font-medium text-gray-700">{g.status === 'done' ? '✓ 达成' : `${g.status === 'paused' ? '暂停' : '进行中'}`}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-400 to-blue-500 transition-all"
                        style={{ width: `${g.status === 'done' ? 100 : g.progress}%` }} />
                    </div>
                    <input type="range" min={0} max={100} value={g.progress}
                      onChange={e => onUpdateGoal(g.id, { progress: Number(e.target.value) })}
                      className="w-full mt-1.5 accent-purple-500" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 看板 */}
      {subView === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['todo', 'doing', 'done'] as FdStatus[]).map(col => (
            <div key={col} className="bg-gray-50 rounded-lg border border-gray-200 p-3">
              <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                {col === 'todo' ? <Flag size={12} /> : col === 'doing' ? <Play size={12} /> : <Check size={12} />}
                {STATUS_LABEL[col]}
                <span className="text-gray-400">({liveTasks.filter(t => t.status === col).length})</span>
              </h4>
              <div className="space-y-2">
                {liveTasks.filter(t => t.status === col).length === 0 && <div className="text-xs text-gray-400 text-center py-4">空</div>}
                {liveTasks.filter(t => t.status === col).sort((a, b) => a.sort - b.sort).map(taskCard)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 习惯 */}
      {subView === 'habits' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3 flex gap-2">
            <input
              value={habitName}
              onChange={e => setHabitName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddHabit()}
              placeholder="新习惯名称，如：每天阅读 30 分钟"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
            />
            <button onClick={handleAddHabit} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 text-sm">
              <Plus size={14} /> 建习惯
            </button>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">本周打卡（点击格子打卡）</h4>
            {habits.length === 0 && <EmptyHint text="还没有习惯，添加一个长期坚持的事吧" />}
            <div className="space-y-2">
              {habits.map(h => (
                <div key={h.id} className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 w-40 md:w-56 min-w-0">
                    <span className="text-sm text-gray-800 truncate flex-1">{h.name}</span>
                    <button onClick={() => { if (confirm(`删除习惯「${h.name}」及其打卡记录？`)) onDeleteHabit(h.id); }}
                      className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 7 }, (_, wd) => {
                      const d = dateOfWeekday(wd);
                      const checked = habitLogs.some(l => l.habitId === h.id && l.logDate === d);
                      const scheduled = h.weekdays.includes(wd);
                      return (
                        <button
                          key={wd}
                          onClick={() => onToggleHabitLog(h.id, d)}
                          disabled={!scheduled}
                          title={d}
                          className={`w-9 h-9 rounded-md text-[10px] flex flex-col items-center justify-center border transition-colors ${
                            checked ? 'bg-green-500 border-green-500 text-white'
                            : scheduled ? 'bg-white border-gray-200 text-gray-500 hover:border-green-400'
                            : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          <span>{'一二三四五六日'[wd]}</span>
                          {checked && <Check size={10} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 日历 */}
      {subView === 'calendar' && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
                title="上个月"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-gray-800 min-w-[90px] text-center">
                {calYear}年{calMonth + 1}月
              </span>
              <button
                onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
                title="下个月"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => { const n = new Date(); setCalYear(n.getFullYear()); setCalMonth(n.getMonth()); }}
                className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100"
                title="回到本月"
              >
                <RotateCcw size={14} />
              </button>
            </div>
            <button
              onClick={() => setCalHideDone(!calHideDone)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${calHideDone ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              {calHideDone ? <EyeOff size={13} /> : <Eye size={13} />} 隐藏已完成
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {['一', '二', '三', '四', '五', '六', '日'].map((w, i) => (
              <div key={i} className="text-center text-xs text-gray-400 py-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGrid(calYear, calMonth).map((iso, i) => {
              if (!iso) return <div key={`pad-${i}`} />;
              const evs = calendarEvents[iso] || [];
              const shown = evs.filter(ev => !(calHideDone && (ev.kind === 'done' || ev.kind === 'habit-done')));
              const isToday = iso === today;
              return (
                <div
                  key={iso}
                  className={`min-h-[68px] rounded-md border p-1 text-xs flex flex-col ${
                    isToday ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className={`text-right ${isToday ? 'font-bold text-blue-600' : 'text-gray-500'}`}>
                    {Number(iso.slice(8, 10))}
                  </div>
                  <div className="space-y-0.5 mt-0.5 overflow-hidden">
                    {shown.slice(0, 3).map(ev => (
                      <div key={ev.id + ev.kind} className="flex items-center gap-1 truncate" title={ev.title}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${(EVENT_STYLE[ev.kind] || EVENT_STYLE.task).dot}`} />
                        <span className="truncate text-gray-600">{ev.title}</span>
                      </div>
                    ))}
                    {shown.length > 3 && <div className="text-gray-400 pl-2.5">+{shown.length - 3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
            {Object.entries(EVENT_STYLE).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${v.dot}`} />{v.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 仪表盘 */}
      {subView === 'dashboard' && (() => {
        const s = dashStats;
        const trendMax = Math.max(1, ...s.trend.map(t => t.count));
        return (
          <div className="space-y-4">
            {/* 范围选择 */}
            <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">统计范围：</span>
              {([['7', '近7天'], ['30', '近30天'], ['90', '近90天'], ['all', '全部'], ['custom', '自定义']] as [('7' | '30' | '90' | 'all' | 'custom'), string][]).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => {
                    setDashRange(v);
                    if (v === '7') setDashStart(rangeStart(7));
                    else if (v === '30') setDashStart(rangeStart(30));
                    else if (v === '90') setDashStart(rangeStart(90));
                    else if (v === 'all') setDashStart('1970-01-01');
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs ${dashRange === v ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
              {dashRange === 'custom' && (
                <>
                  <input type="date" value={dashStart} onChange={e => setDashStart(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs" />
                  <span className="text-xs text-gray-400">至</span>
                  <input type="date" value={dashEnd} onChange={e => setDashEnd(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-xs" />
                </>
              )}
            </div>

            {/* KPI 卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="范围内新建" value={s.total} tone="text-gray-800" />
              <KpiCard label="已完成" value={s.done} tone="text-green-600" />
              <KpiCard label="进行中" value={s.doing} tone="text-blue-600" />
              <KpiCard label="逾期" value={s.overdueCount} tone={s.overdueCount > 0 ? 'text-red-600' : 'text-gray-800'} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 完成率环 */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">完成率</h4>
                <div className="flex items-center gap-4">
                  <CompletionRing rate={s.completionRate} />
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>待处理 <b className="text-gray-700">{s.todo}</b></div>
                    <div>已完成 <b className="text-green-600">{s.done}</b></div>
                    <div>待转化灵感 <b className="text-amber-600">{s.ideasPending}</b></div>
                  </div>
                </div>
              </div>

              {/* 优先级分布 */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">优先级分布（范围内活跃）</h4>
                <div className="space-y-2">
                  {[['P0', s.p0, 'bg-red-400'], ['P1', s.p1, 'bg-orange-400'], ['P2', s.p2, 'bg-blue-400'], ['P3', s.p3, 'bg-gray-400']].map(([p, n, color]) => (
                    <div key={p as string} className="flex items-center gap-2">
                      <span className="text-xs w-6 text-gray-500">{p}</span>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, ((n as number) / Math.max(1, s.p0 + s.p1 + s.p2 + s.p3)) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-4 text-right">{n as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 目标进度 */}
            {s.activeGoals.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">目标进度（{s.goalCount}）</h4>
                <div className="space-y-2.5">
                  {s.activeGoals.slice(0, 6).map(g => (
                    <div key={g.id}>
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span className="truncate">{g.title}</span>
                        <span className="font-medium text-gray-700">{g.progress}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-400 to-blue-500" style={{ width: `${g.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 完成趋势 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">完成趋势</h4>
              <div className="flex items-end gap-1 h-32">
                {s.trend.map((t, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div
                      className="w-full rounded-t bg-green-400 hover:bg-green-500 transition-colors"
                      style={{ height: `${(t.count / trendMax) * 100}%`, minHeight: t.count > 0 ? '4px' : '1px' }}
                      title={`${t.label}：${t.count} 完成`}
                    />
                    <span className="text-[9px] text-gray-400 mt-1 whitespace-nowrap hidden md:block">{t.label}</span>
                  </div>
                ))}
              </div>
              {s.trend.every(t => t.count === 0) && <div className="text-center text-xs text-gray-400 mt-2">该范围内暂无完成记录</div>}
            </div>
          </div>
        );
      })()}

      {/* 归档 */}
      {subView === 'archive' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setArchiveOwner('')}
              className={`px-2.5 py-1 rounded-md text-xs ${archiveOwner === '' ? 'bg-gray-200 text-gray-800 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              全部
            </button>
            {[...new Set(archivedTasks.map(t => t.owner).filter(Boolean))].map(o => (
              <button
                key={o}
                onClick={() => setArchiveOwner(o)}
                className={`px-2.5 py-1 rounded-md text-xs ${archiveOwner === o ? 'bg-gray-200 text-gray-800 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {o}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {archivedTasks.filter(t => !archiveOwner || t.owner === archiveOwner).length === 0
              ? <EmptyHint text="归档区是空的" />
              : archivedTasks.filter(t => !archiveOwner || t.owner === archiveOwner).map(t => (
                  <div key={t.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-500 line-through truncate">{t.title}</div>
                      {t.owner && <div className="text-[10px] text-gray-400 mt-0.5">{t.owner}</div>}
                    </div>
                    <button
                      onClick={() => onSetTaskStatus(t.id, 'todo')}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100"
                      title="恢复到待处理"
                    >
                      <RotateCcw size={13} /> 恢复
                    </button>
                    <button
                      onClick={() => { if (confirm(`永久删除「${t.title}」？此操作不可恢复。`)) onDeleteTask(t.id); }}
                      className="p-1.5 rounded-md text-gray-300 hover:text-red-500"
                      title="永久删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
          </div>
        </div>
      )}

      {/* 任务编辑弹窗 */}
      {editingTask && (
        <TaskEditor
          task={tasks.find(t => t.id === editingTask.id) || editingTask}
          goals={goals}
          onClose={() => setEditingTask(null)}
          onUpdate={onUpdateTask}
          onAddSubtask={onAddSubtask}
          onToggleSubtask={onToggleSubtask}
          onDeleteSubtask={onDeleteSubtask}
          onDelete={id => { onDeleteTask(id); setEditingTask(null); }}
        />
      )}
    </div>
  );
}

// ─── 任务编辑器弹窗 ───────────────────────────

function TaskEditor(props: {
  task: FdTask;
  goals: FdGoal[];
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<FdTask>) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onToggleSubtask: (taskId: string, subId: string) => void;
  onDeleteSubtask: (taskId: string, subId: string) => void;
  onDelete: (id: string) => void;
}) {
  const { task, goals, onClose, onUpdate, onAddSubtask, onToggleSubtask, onDeleteSubtask, onDelete } = props;
  const [subText, setSubText] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">编辑任务</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <input
          value={task.title}
          onChange={e => onUpdate(task.id, { title: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-medium"
        />

        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="space-y-1">
            <span className="text-xs text-gray-500">优先级</span>
            <select value={task.priority} onChange={e => onUpdate(task.id, { priority: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5">
              {['', 'P0', 'P1', 'P2', 'P3'].map(p => <option key={p || 'none'} value={p}>{p || '无'}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">状态</span>
            <select value={task.status} onChange={e => onUpdate(task.id, { status: e.target.value as FdStatus })}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5">
              {(Object.keys(STATUS_LABEL) as FdStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">截止日期</span>
            <input type="date" value={task.dueDate} onChange={e => onUpdate(task.id, { dueDate: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5" />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-gray-500">关联目标</span>
            <select value={task.goalId || ''} onChange={e => onUpdate(task.id, { goalId: e.target.value || null })}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5">
              <option value="">不关联</option>
              {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs text-gray-500">标签（逗号分隔）</span>
          <input value={task.tags} onChange={e => onUpdate(task.id, { tags: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-gray-500">备注</span>
          <textarea value={task.note} onChange={e => onUpdate(task.id, { note: e.target.value })} rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
        </label>

        <div className="space-y-2">
          <span className="text-xs text-gray-500">子任务</span>
          {task.subtasks.length > 0 && (
            <div className="space-y-1">
              {task.subtasks.map(s => (
                <SubtaskRow key={s.id} sub={s} taskId={task.id} onToggle={onToggleSubtask} onDelete={onDeleteSubtask} depth={0} />
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={subText}
              onChange={e => setSubText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && subText.trim()) { onAddSubtask(task.id, subText.trim()); setSubText(''); } }}
              placeholder="添加子任务，回车确认"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button onClick={() => { if (subText.trim()) { onAddSubtask(task.id, subText.trim()); setSubText(''); } }}
              className="px-3 py-1.5 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 text-sm flex items-center">
              <Plus size={13} />
            </button>
          </div>
        </div>

        <div className="flex justify-between pt-2 border-t border-gray-100">
          <button onClick={() => onDelete(task.id)} className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1">
            <Trash2 size={14} /> 删除任务
          </button>
          <button onClick={onClose} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">完成</button>
        </div>
      </div>
    </div>
  );
}

function SubtaskRow(props: {
  sub: FdSubtask;
  taskId: string;
  depth: number;
  onToggle: (taskId: string, subId: string) => void;
  onDelete: (taskId: string, subId: string) => void;
}) {
  const { sub, taskId, depth, onToggle, onDelete } = props;
  const [expanded, setExpanded] = useState(false);
  const hasChildren = sub.children && sub.children.length > 0;
  return (
    <div>
      <div className="flex items-center gap-1.5 py-0.5" style={{ paddingLeft: depth * 16 }}>
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : <span className="w-[17px]" />}
        <button
          onClick={() => onToggle(taskId, sub.id)}
          className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
            sub.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent'
          }`}
        >
          <Check size={10} />
        </button>
        <span className={`text-sm flex-1 ${sub.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{sub.text}</span>
        <button onClick={() => onDelete(taskId, sub.id)} className="text-gray-300 hover:text-red-500"><X size={12} /></button>
      </div>
      {expanded && hasChildren && sub.children!.map(c => (
        <SubtaskRow key={c.id} sub={c} taskId={taskId} depth={depth + 1} onToggle={onToggle} onDelete={onDelete} />
      ))}
    </div>
  );
}

// ─── 工具函数与小组件 ───────────────────────────

function countAllSubtasks(subs: FdSubtask[]): number {
  return subs.reduce((n, s) => n + 1 + countAllSubtasks(s.children || []), 0);
}

function countDoneSubtasks(subs: FdSubtask[]): number {
  return subs.reduce((n, s) => n + (s.done ? 1 : 0) + countDoneSubtasks(s.children || []), 0);
}

/** 递归收集子任务叶子节点（无 children 的子任务） */
function collectLeaves(subs: FdSubtask[]): FdSubtask[] {
  const leaves: FdSubtask[] = [];
  subs.forEach(s => {
    if (s.children && s.children.length > 0) leaves.push(...collectLeaves(s.children));
    else leaves.push(s);
  });
  return leaves;
}

/** a 到 b 的天数差（b - a，可为负） */
function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.round((db - da) / 86400000);
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** N 天前的 ISO 日期 */
function rangeStart(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

/** 月视图网格：返回当月各日的 ISO 字符串，前面补 null 对齐周一 */
function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return cells;
}

function dateOfWeekday(weekday: number): string {
  // 本周一的日期 + weekday 偏移
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 今天是周几（周一=0）
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  const target = new Date(monday);
  target.setDate(monday.getDate() + weekday);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="text-center py-8 text-sm text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
      {text}
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}

function CompletionRing({ rate }: { rate: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, rate) / 100) * c;
  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke="#22c55e" strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-green-600">{rate}%</div>
    </div>
  );
}
