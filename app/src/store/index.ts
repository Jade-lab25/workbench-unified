import { useState, useEffect, useCallback } from 'react';
import type { Todo, CheckInProject, CheckInRecord, TimeRecord, AchievementLog, AppState, CheckInType, Inspiration, Syncable, ShopItem, ShopCategory, FdGoal, FdTask, FdStatus, FdSubtask, FdHabit, FdHabitLog, SummaryDoc, SummaryIdea, SummaryLog, UserSettings } from '../types';
import { addDeletedId, addDeletedIds } from '../utils/syncState';
import { prepareImportedState } from '../utils/importState';

const STORAGE_KEY = 'work-status-app-data';

const initialState: AppState = {
  todos: [],
  checkInProjects: [],
  checkInRecords: [],
  timeRecords: [],
  achievementLogs: [],
  inspirations: [],
  shopItems: [],
  totalAchievements: 0,
  totalEarned: 0,
  totalSpent: 0,
  userStats: {},
  fdGoals: [],
  fdTasks: [],
  fdHabits: [],
  fdHabitLogs: [],
  summaryDocs: [],
  summaryIdeas: [],
  summaryLogs: [],
  userSettings: { llmProvider: '', llmApiKey: '', llmModel: '' },
};

/** 生成唯一 ID（避免同毫秒内 Date.now() 碰撞） */
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * 标记记录为需要同步的脏数据
 * 增量同步时只会同步 is_dirty = true 的记录
 */
function markDirty<T extends object>(item: T): T & { is_dirty: boolean; isDirty: boolean; synced_at: null; syncedAt: null } {
  return {
    ...item,
    is_dirty: true,
    isDirty: true,
    synced_at: null,
    syncedAt: null,
  } as T & { is_dirty: boolean; isDirty: boolean; synced_at: null; syncedAt: null };
}

/**
 * 标记数组中指定 ID 的记录为脏数据
 */
function markDirtyById<T extends { id: string } & Syncable>(items: T[], id: string): T[] {
  return items.map(item => item.id === id ? markDirty(item) as T : item);
}

function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const state = { ...initialState, ...parsed };

      // ✅ 从 achievementLogs 实时计算成就值，不依赖 userStats
      const logs = state.achievementLogs || [];
      const totalEarned = logs
        .filter((log: any) => log.type === 'task' || log.type === 'todo')
        .reduce((sum: number, log: any) => sum + (log.points || 0), 0);
      const totalSpent = logs
        .filter((log: any) => log.type === 'commodity' || log.type === 'shop_purchase')
        .reduce((sum: number, log: any) => sum + Math.abs(log.points || 0), 0);

      state.totalAchievements = totalEarned - totalSpent;
      state.totalEarned = totalEarned;
      state.totalSpent = totalSpent;

      return state;
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  return initialState;
}

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const addTodo = useCallback((title: string, tag: 'long-term' | 'one-time' = 'one-time') => {
    const newTodo: Todo = markDirty({
      id: Date.now().toString(),
      title,
      createdAt: new Date().toISOString(),
      completedAt: null,
      isCompleted: false,
      isDelayed: false,
      delayCount: 0,
      totalTime: 0,
      isTiming: false,
      timingStartTime: null,
      timingRecordId: null,
      tag,
    });
    setState(prev => ({ ...prev, todos: [...prev.todos, newTodo] }));
  }, []);

  const completeTodo = useCallback((id: string) => {
    setState(prev => {
      const todo = prev.todos.find(t => t.id === id);
      if (!todo) return prev;

      if (todo.isCompleted) {
        const uncompletedTodo: Todo = markDirty({
          ...todo,
          isCompleted: false,
          completedAt: null,
        });

        const log: AchievementLog = markDirty({
          id: Date.now().toString(),
          type: 'todo',
          title: todo.title,
          points: -5,
          createdAt: new Date().toISOString(),
        });

        return {
          ...prev,
          todos: prev.todos.map(t => t.id === id ? uncompletedTodo : t),
          achievementLogs: [log, ...prev.achievementLogs],
          totalAchievements: Math.max(0, prev.totalAchievements - 5),
          totalEarned: Math.max(0, prev.totalEarned - 5),
        };
      } else {
        const completedAt = new Date().toISOString();
        const completedTodo: Todo = markDirty({
          ...todo,
          isCompleted: true,
          completedAt,
          isTiming: false,
          timingStartTime: null,
        });

        const log: AchievementLog = markDirty({
          id: Date.now().toString(),
          type: 'todo',
          title: todo.title,
          points: 5,
          createdAt: completedAt,
        });

        return {
          ...prev,
          todos: prev.todos.map(t => t.id === id ? completedTodo : t),
          achievementLogs: [log, ...prev.achievementLogs],
          totalAchievements: prev.totalAchievements + 5,
          totalEarned: prev.totalEarned + 5,
        };
      }
    });
  }, []);

  const deleteTodo = useCallback((id: string) => {
    addDeletedId('todos', id);
    setState(prev => ({ ...prev, todos: prev.todos.filter(t => t.id !== id) }));
  }, []);

  const clearCompletedTodos = useCallback(() => {
    setState(prev => {
      const completedIds = prev.todos.filter(t => t.isCompleted).map(t => t.id);
      if (completedIds.length > 0) {
        addDeletedIds('todos', completedIds);
      }
      return { ...prev, todos: prev.todos.filter(t => !t.isCompleted) };
    });
  }, []);

  const toggleDelayTodo = useCallback((id: string) => {
    setState(prev => {
      const todo = prev.todos.find(t => t.id === id);
      if (!todo) return prev;

      const now = new Date().toISOString();
      const log: AchievementLog = markDirty({
        id: Date.now().toString(),
        type: 'task',
        title: `${todo.title} - 标记拖延`,
        points: -2,
        createdAt: now,
      });

      return {
        ...prev,
        todos: markDirtyById(prev.todos, id).map(t => t.id === id ? {
          ...t,
          isDelayed: true,
          delayCount: t.delayCount + 1,
        } : t),
        achievementLogs: [log, ...prev.achievementLogs],
        totalAchievements: Math.max(0, prev.totalAchievements - 2),
        totalSpent: prev.totalSpent + 2,
      };
    });
  }, []);

  const updateTodo = useCallback((id: string, title: string) => {
    setState(prev => ({
      ...prev,
      todos: markDirtyById(prev.todos, id).map(t => t.id === id ? { ...t, title } : t),
    }));
  }, []);

  const pinTodo = useCallback((id: string) => {
    setState(prev => {
      const todo = prev.todos.find(t => t.id === id);
      if (!todo) return prev;
      // 置顶不需要同步，只是本地排序
      return {
        ...prev,
        todos: [todo, ...prev.todos.filter(t => t.id !== id)],
      };
    });
  }, []);

  const startTodoTiming = useCallback((id: string) => {
    setState(prev => {
      const todo = prev.todos.find(t => t.id === id);
      if (!todo || todo.isCompleted || todo.isTiming) return prev;

      const now = new Date();
      const startTime = now.toISOString();
      const startTimestamp = now.getTime();

      const timeRecord: TimeRecord = markDirty({
        id: Date.now().toString(),
        startTime,
        endTime: '',
        content: todo.title,
        note: '',
        createdAt: now.toISOString(),
        todoId: todo.id,
        startTimestamp,
      });

      return {
        ...prev,
        todos: markDirtyById(prev.todos, id).map(t => t.id === id ? { ...t, isTiming: true, timingStartTime: startTime, timingRecordId: timeRecord.id } : t),
        timeRecords: [timeRecord, ...prev.timeRecords],
      };
    });
  }, []);

  const endTodoTiming = useCallback((id: string) => {
    setState(prev => {
      const todo = prev.todos.find(t => t.id === id);
      if (!todo || !todo.isTiming || !todo.timingStartTime) return prev;

      const now = new Date();
      const endTime = now.toISOString();

      const record = prev.timeRecords.find(r => r.id === todo.timingRecordId);
      const durationSeconds = record ? (now.getTime() - record.startTimestamp) / 1000 : 0;

      return {
        ...prev,
        todos: markDirtyById(prev.todos, id).map(t => t.id === id ? {
          ...t,
          isTiming: false,
          timingStartTime: null,
          timingRecordId: null,
          totalTime: t.totalTime + durationSeconds,
        } : t),
        timeRecords: markDirtyById(prev.timeRecords, todo.timingRecordId!).map(r =>
          r.id === todo.timingRecordId ? { ...r, endTime } : r
        ),
      };
    });
  }, []);

  const addCheckInProject = useCallback((name: string, type: CheckInType, points: number) => {
    const project: CheckInProject = markDirty({
      id: Date.now().toString(),
      name,
      type,
      points,
      createdAt: new Date().toISOString(),
    });
    setState(prev => ({ ...prev, checkInProjects: [...prev.checkInProjects, project] }));
  }, []);

  const deleteCheckInProject = useCallback((id: string) => {
    addDeletedId('checkInProjects', id);
    // 同时删除关联的打卡记录
    const associatedIds = state.checkInRecords.filter(r => r.projectId === id).map(r => r.id);
    if (associatedIds.length > 0) {
      addDeletedIds('checkInRecords', associatedIds);
    }
    setState(prev => ({
      ...prev,
      checkInProjects: prev.checkInProjects.filter(p => p.id !== id),
      checkInRecords: prev.checkInRecords.filter(r => r.projectId !== id),
    }));
  }, [state.checkInRecords]);

  const checkIn = useCallback((projectId: string) => {
    setState(prev => {
      const project = prev.checkInProjects.find(p => p.id === projectId);
      if (!project) return prev;

      const now = new Date();
      const localDateTime = now.toISOString();

      const record: CheckInRecord = markDirty({
        id: Date.now().toString(),
        projectId: project.id,
        projectName: project.name,
        type: project.type,
        points: project.points,
        createdAt: localDateTime,
      });

      const log: AchievementLog = markDirty({
        id: Date.now().toString(),
        type: project.type,
        title: project.name,
        points: project.type === 'task' ? project.points : -project.points,
        createdAt: localDateTime,
      });

      const pointsChange = project.type === 'task' ? project.points : -project.points;

      return {
        ...prev,
        checkInRecords: [record, ...prev.checkInRecords],
        achievementLogs: [log, ...prev.achievementLogs],
        totalAchievements: prev.totalAchievements + pointsChange,
        totalEarned: project.type === 'task' ? prev.totalEarned + project.points : prev.totalEarned,
        totalSpent: project.type === 'commodity' ? prev.totalSpent + project.points : prev.totalSpent,
      };
    });
  }, []);

  const addTimeRecord = useCallback((startTime: string, endTime: string, content: string) => {
    const record: TimeRecord = markDirty({
      id: Date.now().toString(),
      startTime,
      endTime,
      content,
      note: '',
      createdAt: new Date().toISOString(),
      todoId: null,
      startTimestamp: new Date().getTime(),
    });
    setState(prev => ({ ...prev, timeRecords: [record, ...prev.timeRecords] }));
  }, []);

  const deleteTimeRecord = useCallback((id: string) => {
    addDeletedId('timeRecords', id);
    setState(prev => ({ ...prev, timeRecords: prev.timeRecords.filter(r => r.id !== id) }));
  }, []);

  const updateTimeRecordNote = useCallback((id: string, note: string) => {
    setState(prev => ({
      ...prev,
      timeRecords: markDirtyById(prev.timeRecords, id).map(r => r.id === id ? { ...r, note } : r),
    }));
  }, []);

  const startTimer = useCallback((content: string) => {
    const now = new Date();
    const startTime = now.toISOString();
    const startTimestamp = now.getTime();

    const record: TimeRecord = markDirty({
      id: Date.now().toString(),
      startTime,
      endTime: '',
      content,
      note: '',
      createdAt: now.toISOString(),
      todoId: null,
      startTimestamp,
    });

    setState(prev => ({ ...prev, timeRecords: [record, ...prev.timeRecords] }));
    return record.id;
  }, []);

  const endTimer = useCallback((recordId: string) => {
    setState(prev => {
      const record = prev.timeRecords.find(r => r.id === recordId);
      if (!record) return prev;

      const now = new Date();
      const endTime = now.toISOString();

      return {
        ...prev,
        timeRecords: markDirtyById(prev.timeRecords, recordId).map(r => r.id === recordId ? { ...r, endTime } : r),
      };
    });
  }, []);

  const addInspiration = useCallback((content: string) => {
    const now = new Date().toISOString();
    const inspiration: Inspiration = markDirty({
      id: Date.now().toString(),
      content,
      createdAt: now,
      updatedAt: now,
    });
    setState(prev => ({ ...prev, inspirations: [inspiration, ...prev.inspirations] }));
  }, []);

  const deleteInspiration = useCallback((id: string) => {
    addDeletedId('inspirations', id);
    setState(prev => ({ ...prev, inspirations: prev.inspirations.filter(i => i.id !== id) }));
  }, []);

  const updateInspiration = useCallback((id: string, content: string) => {
    setState(prev => ({
      ...prev,
      inspirations: markDirtyById(prev.inspirations, id).map(i => i.id === id ? { ...i, content, updatedAt: new Date().toISOString() } : i),
    }));
  }, []);

  const moveInspirationToTodo = useCallback((id: string) => {
    setState(prev => {
      const inspiration = prev.inspirations.find(i => i.id === id);
      if (!inspiration) return prev;

      const newTodo: Todo = markDirty({
        id: Date.now().toString(),
        title: inspiration.content,
        createdAt: new Date().toISOString(),
        completedAt: null,
        isCompleted: false,
        isDelayed: false,
        delayCount: 0,
        totalTime: 0,
        isTiming: false,
        timingStartTime: null,
        timingRecordId: null,
        tag: 'one-time',
      });

      addDeletedId('inspirations', id);

      return {
        ...prev,
        inspirations: prev.inspirations.filter(i => i.id !== id),
        todos: [newTodo, ...prev.todos],
      };
    });
  }, []);

  const pinInspiration = useCallback((id: string) => {
    setState(prev => {
      const inspiration = prev.inspirations.find(i => i.id === id);
      if (!inspiration) return prev;
      // 置顶不需要同步，只是本地排序
      return {
        ...prev,
        inspirations: [inspiration, ...prev.inspirations.filter(i => i.id !== id)],
      };
    });
  }, []);

  const exportData = useCallback(() => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const importData = useCallback((data: string) => {
    try {
      const parsed = JSON.parse(data);
      setState(prepareImportedState(parsed, initialState));
      return true;
    } catch {
      return false;
    }
  }, []);

  const getDailyStats = useCallback((date: string): { totalAchievements: number; checkInCount: number } => {
    const targetDate = date.slice(0, 10);

    const getLocalDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const dayLogs = state.achievementLogs.filter(log => {
      const logDate = getLocalDate(log.createdAt);
      return logDate === targetDate;
    });

    const taskCheckIns = state.checkInRecords.filter(record => {
      const recordDate = getLocalDate(record.createdAt);
      return recordDate === targetDate && record.type === 'task';
    });

    return {
      totalAchievements: dayLogs.reduce((sum, log) => sum + log.points, 0),
      checkInCount: taskCheckIns.length,
    };
  }, [state.achievementLogs, state.checkInRecords]);

  const getRecordsByDate = useCallback((date: string) => {
    const targetDate = date.slice(0, 10);

    const getLocalDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      checkInRecords: state.checkInRecords.filter(record => {
        const recordDate = getLocalDate(record.createdAt);
        return recordDate === targetDate;
      }),
      timeRecords: state.timeRecords.filter(record => {
        const recordDate = getLocalDate(record.createdAt);
        return recordDate === targetDate;
      }),
      achievementLogs: state.achievementLogs.filter(log => {
        const logDate = getLocalDate(log.createdAt);
        return logDate === targetDate;
      }),
    };
  }, [state.checkInRecords, state.timeRecords, state.achievementLogs]);

  const getMonthlyStats = useCallback((date: string): { totalAchievements: number; checkInCount: number; todoCount: number; timeRecordCount: number } => {
    const targetYearMonth = date.slice(0, 7);

    const getLocalYearMonth = (dateStr: string) => {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    };

    const monthLogs = state.achievementLogs.filter(log => {
      const logYearMonth = getLocalYearMonth(log.createdAt);
      return logYearMonth === targetYearMonth;
    });

    const taskCheckIns = state.checkInRecords.filter(record => {
      const recordYearMonth = getLocalYearMonth(record.createdAt);
      return recordYearMonth === targetYearMonth && record.type === 'task';
    });

    const monthTodos = state.todos.filter(todo => {
      const todoYearMonth = getLocalYearMonth(todo.createdAt);
      return todoYearMonth === targetYearMonth;
    });

    const monthTimeRecords = state.timeRecords.filter(record => {
      const recordYearMonth = getLocalYearMonth(record.createdAt);
      return recordYearMonth === targetYearMonth && record.endTime;
    });

    return {
      totalAchievements: monthLogs.reduce((sum, log) => sum + log.points, 0),
      checkInCount: taskCheckIns.length,
      todoCount: monthTodos.length,
      timeRecordCount: monthTimeRecords.length,
    };
  }, [state.achievementLogs, state.checkInRecords, state.timeRecords, state.todos]);

  const getYearlyStats = useCallback((date: string): { totalAchievements: number; checkInCount: number; todoCount: number; timeRecordCount: number } => {
    const targetYear = date.slice(0, 4);

    const getLocalYear = (dateStr: string) => {
      const date = new Date(dateStr);
      return String(date.getFullYear());
    };

    const yearLogs = state.achievementLogs.filter(log => {
      const logYear = getLocalYear(log.createdAt);
      return logYear === targetYear;
    });

    const taskCheckIns = state.checkInRecords.filter(record => {
      const recordYear = getLocalYear(record.createdAt);
      return recordYear === targetYear && record.type === 'task';
    });

    const yearTodos = state.todos.filter(todo => {
      const todoYear = getLocalYear(todo.createdAt);
      return todoYear === targetYear;
    });

    const yearTimeRecords = state.timeRecords.filter(record => {
      const recordYear = getLocalYear(record.createdAt);
      return recordYear === targetYear && record.endTime;
    });

    return {
      totalAchievements: yearLogs.reduce((sum, log) => sum + log.points, 0),
      checkInCount: taskCheckIns.length,
      todoCount: yearTodos.length,
      timeRecordCount: yearTimeRecords.length,
    };
  }, [state.achievementLogs, state.checkInRecords, state.timeRecords, state.todos]);

  // ========== 成就商店 ==========

  /** 添加商店商品 */
  const addShopItem = useCallback((name: string, price: number, category: ShopCategory, description: string = '') => {
    const newItem: ShopItem = markDirty({
      id: Date.now().toString(),
      name,
      description,
      price,
      category,
      isPurchased: false,
      createdAt: new Date().toISOString(),
    });
    setState(prev => ({ ...prev, shopItems: [...prev.shopItems, newItem] }));
  }, []);

  /** 更新商店商品 */
  const updateShopItem = useCallback((id: string, updates: Partial<ShopItem>) => {
    setState(prev => ({
      ...prev,
      shopItems: markDirtyById(prev.shopItems, id).map(item =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  }, []);

  /** 删除商店商品 */
  const deleteShopItem = useCallback((id: string) => {
    addDeletedId('shopItems', id);
    setState(prev => ({
      ...prev,
      shopItems: prev.shopItems.filter(item => item.id !== id),
    }));
  }, []);

  /**
   * 购买商品
   * @returns 是否购买成功（余额不足返回 false）
   */
  const purchaseShopItem = useCallback((itemId: string): boolean => {
    setState(prev => {
      const item = prev.shopItems.find(i => i.id === itemId);
      if (!item || item.isPurchased) return prev;

      // 检查余额
      if (prev.totalAchievements < item.price) {
        return prev;
      }

      const now = new Date().toISOString();

      // 成就流水
      const log: AchievementLog = markDirty({
        id: Date.now().toString(),
        type: 'shop_purchase',
        title: `购买：${item.name}`,
        points: -item.price,
        createdAt: now,
        shopItemId: item.id,
      });

      // 标记商品为已购买
      const updatedItems = prev.shopItems.map(i =>
        i.id === itemId
          ? markDirty({ ...i, isPurchased: true, purchasedAt: now })
          : i
      );

      return {
        ...prev,
        shopItems: updatedItems,
        achievementLogs: [log, ...prev.achievementLogs],
        totalAchievements: prev.totalAchievements - item.price,
        totalSpent: prev.totalSpent + item.price,
      };
    });

    // 验证是否成功
    const item = state.shopItems.find(i => i.id === itemId);
    return item ? state.totalAchievements >= item.price : false;
  }, [state.shopItems, state.totalAchievements]);

  /** 按分类筛选商品 */
  const getShopItemsByCategory = useCallback((category?: ShopCategory) => {
    if (!category) return state.shopItems;
    return state.shopItems.filter(item => item.category === category);
  }, [state.shopItems]);

  // ════════════════════════════════════════════
  // FocusDesk（目标追踪）
  // ════════════════════════════════════════════

  const addFdGoal = useCallback((title: string, description: string = '') => {
    const now = new Date().toISOString();
    const goal: FdGoal = markDirty({
      id: uid(),
      title,
      description,
      status: 'active',
      progress: 0,
      sort: Date.now(),
      createdAt: now,
      updatedAt: now,
    });
    setState(prev => ({ ...prev, fdGoals: [...prev.fdGoals, goal] }));
    return goal;
  }, []);

  const updateFdGoal = useCallback((id: string, updates: Partial<FdGoal>) => {
    setState(prev => ({
      ...prev,
      fdGoals: markDirtyById(prev.fdGoals, id).map(g =>
        g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
      ),
    }));
  }, []);

  const deleteFdGoal = useCallback((id: string) => {
    addDeletedId('fdGoals', id);
    setState(prev => ({
      ...prev,
      fdGoals: prev.fdGoals.filter(g => g.id !== id),
      // 目标删除后，关联任务解除关联（云端 FK 为 ON DELETE SET NULL）
      fdTasks: prev.fdTasks.map(t =>
        t.goalId === id ? markDirty({ ...t, goalId: null, updatedAt: new Date().toISOString() }) as FdTask : t
      ),
    }));
  }, []);

  const addFdTask = useCallback((partial: {
    title: string;
    fdType?: 'task' | 'idea';
    priority?: string;
    owner?: string;
    dueDate?: string;
    tags?: string;
    note?: string;
    goalId?: string | null;
  }) => {
    const now = new Date().toISOString();
    const fdType = partial.fdType || 'task';
    const task: FdTask = markDirty({
      id: uid(),
      title: partial.title,
      fdType,
      status: fdType === 'idea' ? 'idea' : 'todo',
      priority: partial.priority || '',
      owner: partial.owner || '',
      dueDate: partial.dueDate || '',
      tags: partial.tags || '',
      note: partial.note || '',
      goalId: partial.goalId ?? null,
      subtasks: [],
      sort: Date.now(),
      createdAt: now,
      completedAt: null,
      updatedAt: now,
    });
    setState(prev => ({ ...prev, fdTasks: [task, ...prev.fdTasks] }));
    return task;
  }, []);

  const updateFdTask = useCallback((id: string, updates: Partial<FdTask>) => {
    setState(prev => ({
      ...prev,
      fdTasks: markDirtyById(prev.fdTasks, id).map(t =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      ),
    }));
  }, []);

  const deleteFdTask = useCallback((id: string) => {
    addDeletedId('fdTasks', id);
    setState(prev => ({ ...prev, fdTasks: prev.fdTasks.filter(t => t.id !== id) }));
  }, []);

  const setFdTaskStatus = useCallback((id: string, status: FdStatus) => {
    setState(prev => ({
      ...prev,
      fdTasks: markDirtyById(prev.fdTasks, id).map(t =>
        t.id === id
          ? {
              ...t,
              status,
              completedAt: status === 'done' ? new Date().toISOString() : null,
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    }));
  }, []);

  const convertFdIdeaToTask = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      fdTasks: markDirtyById(prev.fdTasks, id).map(t =>
        t.id === id
          ? { ...t, fdType: 'task' as const, status: 'todo' as const, updatedAt: new Date().toISOString() }
          : t
      ),
    }));
  }, []);

  const addFdSubtask = useCallback((taskId: string, text: string) => {
    const sub: FdSubtask = { id: uid(), text, done: false };
    setState(prev => ({
      ...prev,
      fdTasks: markDirtyById(prev.fdTasks, taskId).map(t =>
        t.id === taskId
          ? { ...t, subtasks: [...t.subtasks, sub], updatedAt: new Date().toISOString() }
          : t
      ),
    }));
  }, []);

  const addFdSubtaskChild = useCallback((taskId: string, parentId: string, text: string) => {
    const sub: FdSubtask = { id: uid(), text, done: false };
    setState(prev => ({
      ...prev,
      fdTasks: markDirtyById(prev.fdTasks, taskId).map(t => {
        if (t.id !== taskId) return t;
        const addDeep = (subs: FdSubtask[]): FdSubtask[] =>
          subs.map(s =>
            s.id === parentId
              ? { ...s, children: [...(s.children || []), sub] }
              : { ...s, children: s.children ? addDeep(s.children) : s.children }
          );
        return { ...t, subtasks: addDeep(t.subtasks), updatedAt: new Date().toISOString() };
      }),
    }));
  }, []);

  const toggleFdSubtask = useCallback((taskId: string, subId: string) => {
    setState(prev => ({
      ...prev,
      fdTasks: markDirtyById(prev.fdTasks, taskId).map(t => {
        if (t.id !== taskId) return t;
        const toggleDeep = (subs: FdSubtask[]): FdSubtask[] =>
          subs.map(s => s.id === subId ? { ...s, done: !s.done } : { ...s, children: s.children ? toggleDeep(s.children) : s.children });
        return { ...t, subtasks: toggleDeep(t.subtasks), updatedAt: new Date().toISOString() };
      }),
    }));
  }, []);

  const deleteFdSubtask = useCallback((taskId: string, subId: string) => {
    setState(prev => ({
      ...prev,
      fdTasks: markDirtyById(prev.fdTasks, taskId).map(t => {
        if (t.id !== taskId) return t;
        const removeDeep = (subs: FdSubtask[]): FdSubtask[] =>
          subs.filter(s => s.id !== subId).map(s => ({ ...s, children: s.children ? removeDeep(s.children) : s.children }));
        return { ...t, subtasks: removeDeep(t.subtasks), updatedAt: new Date().toISOString() };
      }),
    }));
  }, []);

  const addFdHabit = useCallback((name: string, weekdays: number[] = [0, 1, 2, 3, 4, 5, 6]) => {
    const habit: FdHabit = markDirty({
      id: uid(),
      name,
      weekdays,
      sort: Date.now(),
      createdAt: new Date().toISOString(),
    });
    setState(prev => ({ ...prev, fdHabits: [...prev.fdHabits, habit] }));
    return habit;
  }, []);

  const deleteFdHabit = useCallback((id: string) => {
    addDeletedId('fdHabits', id);
    setState(prev => {
      const logIds = prev.fdHabitLogs.filter(l => l.habitId === id).map(l => l.id);
      if (logIds.length > 0) addDeletedIds('fdHabitLogs', logIds);
      return {
        ...prev,
        fdHabits: prev.fdHabits.filter(h => h.id !== id),
        fdHabitLogs: prev.fdHabitLogs.filter(l => l.habitId !== id),
      };
    });
  }, []);

  const toggleFdHabitLog = useCallback((habitId: string, logDate: string) => {
    setState(prev => {
      const existing = prev.fdHabitLogs.find(l => l.habitId === habitId && l.logDate === logDate);
      if (existing) {
        addDeletedId('fdHabitLogs', existing.id);
        return { ...prev, fdHabitLogs: prev.fdHabitLogs.filter(l => l.id !== existing.id) };
      }
      const log: FdHabitLog = markDirty({
        id: uid(),
        habitId,
        logDate,
        createdAt: new Date().toISOString(),
      });
      return { ...prev, fdHabitLogs: [...prev.fdHabitLogs, log] };
    });
  }, []);

  // ════════════════════════════════════════════
  // Summary Desk（内容总结）
  // ════════════════════════════════════════════

  const addSummaryDoc = useCallback((doc: Omit<SummaryDoc, 'id' | 'createdAt' | 'synced_at' | 'syncedAt' | 'is_dirty' | 'isDirty'>) => {
    const newDoc: SummaryDoc = markDirty({
      ...doc,
      id: uid(),
      createdAt: new Date().toISOString(),
    });
    setState(prev => ({ ...prev, summaryDocs: [newDoc, ...prev.summaryDocs] }));
    return newDoc;
  }, []);

  const deleteSummaryDoc = useCallback((id: string) => {
    addDeletedId('summaryDocs', id);
    setState(prev => ({ ...prev, summaryDocs: prev.summaryDocs.filter(d => d.id !== id) }));
  }, []);

  // ─── 灵感库 ───

  const addSummaryIdea = useCallback((content: string, direction: 'work' | 'growth' | 'none' = 'none', tags: string[] = []) => {
    const idea: SummaryIdea = markDirty({
      id: uid(),
      content,
      tags,
      direction,
      createdAt: new Date().toISOString(),
    });
    setState(prev => ({ ...prev, summaryIdeas: [idea, ...prev.summaryIdeas] }));
    return idea;
  }, []);

  const updateSummaryIdea = useCallback((id: string, updates: Partial<SummaryIdea>) => {
    setState(prev => ({
      ...prev,
      summaryIdeas: markDirtyById(prev.summaryIdeas, id).map(i => (i.id === id ? { ...i, ...updates } : i)),
    }));
  }, []);

  const deleteSummaryIdea = useCallback((id: string) => {
    addDeletedId('summaryIdeas', id);
    setState(prev => ({ ...prev, summaryIdeas: prev.summaryIdeas.filter(i => i.id !== id) }));
  }, []);

  // ─── 工作日志 ───

  const addSummaryLog = useCallback((log: { date: string; matter: string; result?: string; data?: string; issue?: string }) => {
    const entry: SummaryLog = markDirty({
      id: uid(),
      date: log.date,
      matter: log.matter,
      result: log.result || '',
      data: log.data || '',
      issue: log.issue || '',
      createdAt: new Date().toISOString(),
    });
    setState(prev => ({ ...prev, summaryLogs: [entry, ...prev.summaryLogs] }));
    return entry;
  }, []);

  const updateSummaryLog = useCallback((id: string, updates: Partial<SummaryLog>) => {
    setState(prev => ({
      ...prev,
      summaryLogs: markDirtyById(prev.summaryLogs, id).map(l => (l.id === id ? { ...l, ...updates } : l)),
    }));
  }, []);

  const deleteSummaryLog = useCallback((id: string) => {
    addDeletedId('summaryLogs', id);
    setState(prev => ({ ...prev, summaryLogs: prev.summaryLogs.filter(l => l.id !== id) }));
  }, []);

  const saveUserSettings = useCallback((settings: UserSettings) => {
    setState(prev => ({ ...prev, userSettings: settings }));
  }, []);

  /**
   * 同步数据后更新整个状态
   * 用于从云端拉取数据后，替换本地 state
   */
  const hydrateState = useCallback((newState: Partial<AppState>) => {
    setState(prev => ({
      ...prev,
      ...newState,
    }));
  }, []);

  return {
    state,
    hydrateState,
    addTodo,
    completeTodo,
    deleteTodo,
    clearCompletedTodos,
    toggleDelayTodo,
    updateTodo,
    pinTodo,
    startTodoTiming,
    endTodoTiming,
    addCheckInProject,
    deleteCheckInProject,
    checkIn,
    addTimeRecord,
    deleteTimeRecord,
    updateTimeRecordNote,
    startTimer,
    endTimer,
    addInspiration,
    deleteInspiration,
    updateInspiration,
    moveInspirationToTodo,
    pinInspiration,
    exportData,
    importData,
    getDailyStats,
    getRecordsByDate,
    getMonthlyStats,
    getYearlyStats,
    // 成就商店
    addShopItem,
    updateShopItem,
    deleteShopItem,
    purchaseShopItem,
    getShopItemsByCategory,
    // FocusDesk（目标追踪）
    addFdGoal,
    updateFdGoal,
    deleteFdGoal,
    addFdTask,
    updateFdTask,
    deleteFdTask,
    setFdTaskStatus,
    convertFdIdeaToTask,
    addFdSubtask,
    addFdSubtaskChild,
    toggleFdSubtask,
    deleteFdSubtask,
    addFdHabit,
    deleteFdHabit,
    toggleFdHabitLog,
    // Summary Desk（内容总结）
    addSummaryDoc,
    deleteSummaryDoc,
    addSummaryIdea,
    updateSummaryIdea,
    deleteSummaryIdea,
    addSummaryLog,
    updateSummaryLog,
    deleteSummaryLog,
    saveUserSettings,
  };
}
