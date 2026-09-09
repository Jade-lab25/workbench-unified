/* 统一统计口径（沿用原版：任务维度 = 任务 + 子任务叶子各算 1 个） */
import type { FdGoal, FdTask, FdSubtask, FdHabit, FdHabitLog, Todo, CheckInRecord, TimeRecord, AchievementLog } from '../types';
import { daysBetween, todayISO, toISODate } from './dates';

export function collectLeaves(subs: FdSubtask[]): FdSubtask[] {
  const out: FdSubtask[] = [];
  const walk = (list: FdSubtask[]) => {
    list.forEach(s => {
      if (s.children && s.children.length) walk(s.children);
      else out.push(s);
    });
  };
  walk(subs);
  return out;
}

export function countAllSubtasks(subs: FdSubtask[]): number {
  return collectLeaves(subs).length;
}

export function countDoneSubtasks(subs: FdSubtask[]): number {
  return collectLeaves(subs).filter(s => s.done).length;
}

export interface DashTaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
  createdAt: string;
  completedAt: string | null;
  isSubtask: boolean;
  goalTitle: string;
  owner: string;
}

/** 展开任务 + 子任务叶子 */
export function flattenTasks(tasks: FdTask[], goals: FdGoal[]): DashTaskItem[] {
  const flat: DashTaskItem[] = [];
  tasks.filter(t => t.fdType !== 'idea').forEach(t => {
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
  return flat;
}

export interface DashStats {
  total: number; done: number; doing: number; todo: number;
  overdueCount: number; ideasPending: number; completionRate: number;
  p0: number; p1: number; p2: number; p3: number;
  trend: { label: string; count: number }[];
  goalCount: number; activeGoals: FdGoal[];
}

export function computeDashStats(tasks: FdTask[], goals: FdGoal[], start: string, end: string): DashStats {
  const flat = flattenTasks(tasks, goals);
  const ideaRecords = tasks.filter(t => t.fdType === 'idea');
  const inRange = (iso: string) => !!iso && iso.slice(0, 10) >= start && iso.slice(0, 10) <= end;
  const isActive = (f: DashTaskItem) => f.status !== 'done' && f.status !== 'archived';
  const isOverdue = (f: DashTaskItem) => !!f.dueDate && isActive(f) && daysBetween(todayISO(), f.dueDate) < 0;

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
  const activeGoals = goals.filter(g => g.status === 'active');

  const dayCount: Record<string, number> = {};
  completedInRange.forEach(f => { const k = f.completedAt!.slice(0, 10); dayCount[k] = (dayCount[k] || 0) + 1; });
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

  return { total, done, doing, todo, overdueCount: overdue.length, ideasPending, completionRate, p0, p1, p2, p3, trend, goalCount: activeGoals.length, activeGoals };
}

export interface HabitStats {
  cumulative: number;
  lastCheckIn: string;
  monthlyActual: number;
  monthlyExpected: number;
  rate: number;
}

export function computeHabitStats(habits: FdHabit[], habitLogs: FdHabitLog[]): HabitStats {
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
}

/** 某日工作状态汇总（待办/打卡/时间/成就） */
export function dailyWorkStats(
  date: string,
  todos: Todo[],
  checkInRecords: CheckInRecord[],
  timeRecords: TimeRecord[],
  achievementLogs: AchievementLog[],
): { doneTodos: number; totalTodos: number; checkIns: number; timeSeconds: number; points: number } {
  const day = date.slice(0, 10);
  const dayTodos = todos.filter(t => (t.completedAt || '').slice(0, 10) === day);
  const totalTodos = todos.filter(t => (t.createdAt || '').slice(0, 10) === day).length;
  const checkIns = checkInRecords.filter(r => (r.createdAt || '').slice(0, 10) === day).length;
  let timeSeconds = 0;
  timeRecords.forEach(r => {
    if ((r.startTime || '').slice(0, 10) !== day || !r.endTime) return;
    const end = new Date(r.endTime).getTime();
    const start = r.startTimestamp || new Date(r.startTime).getTime();
    if (end > start) timeSeconds += (end - start) / 1000;
  });
  const points = achievementLogs
    .filter(l => (l.createdAt || '').slice(0, 10) === day)
    .reduce((sum, l) => sum + (l.points || 0), 0);
  return { doneTodos: dayTodos.length, totalTodos, checkIns, timeSeconds, points };
}

/** 目标进度 = 叶子子任务完成占比 */
export function goalProgress(t: FdTask): number {
  const leaves = collectLeaves(t.subtasks);
  if (!leaves.length) return 0;
  return Math.round(leaves.filter(s => s.done).length / leaves.length * 100);
}
