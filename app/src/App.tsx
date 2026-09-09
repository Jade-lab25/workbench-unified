import { useState, useEffect, useCallback, useMemo } from 'react';
import { Menu } from 'lucide-react';
import { useAppState } from './store';
import { Sidebar, SidebarBody, type TabType } from './components/Sidebar';
import { useSync } from './hooks/useSync';
import { auth as supabaseAuth } from './supabase/database';
import { useToast } from './components/ui';
import { AuthScreen } from './components/AuthScreen';
import { TodayView } from './views/TodayView';
import { GoalsView } from './views/GoalsView';
import { WorkView } from './views/WorkView';
import { SummaryView } from './views/SummaryView';
import { CalendarView } from './views/CalendarView';
import { StatsView } from './views/StatsView';
import { SettingsView } from './views/SettingsView';
import { todayISO } from './utils/dates';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'local' | 'cloud' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toast, toastNode } = useToast();

  const store = useAppState();
  const {
    state,
    hydrateState,
  } = store;

  const handleDataFetched = useCallback((data: any) => {
    const logs = data.achievementLogs || [];
    const totalEarned = logs
      .filter((log: any) => log.type === 'task' || log.type === 'todo')
      .reduce((sum: number, log: any) => sum + (log.points || 0), 0);
    const totalSpent = logs
      .filter((log: any) => log.type === 'commodity' || log.type === 'shop_purchase')
      .reduce((sum: number, log: any) => sum + Math.abs(log.points || 0), 0);
    hydrateState({
      todos: data.todos,
      checkInProjects: data.checkInProjects,
      checkInRecords: data.checkInRecords,
      timeRecords: data.timeRecords,
      achievementLogs: logs,
      inspirations: data.inspirations,
      shopItems: data.shopItems,
      totalAchievements: totalEarned - totalSpent,
      totalEarned,
      totalSpent,
      fdGoals: data.fdGoals,
      fdTasks: data.fdTasks,
      fdHabits: data.fdHabits,
      fdHabitLogs: data.fdHabitLogs,
      summaryDocs: data.summaryDocs,
      summaryIdeas: data.summaryIdeas,
      summaryLogs: data.summaryLogs,
      userSettings: data.userSettings || state.userSettings,
    });
  }, [hydrateState, state.userSettings]);

  const syncOptions = useMemo(() => ({ onDataFetched: handleDataFetched }), [handleDataFetched]);
  const { syncState, fetchFromCloud, performSync, syncOnChange } = useSync(userId, syncOptions);

  useEffect(() => {
    const checkSession = async () => {
      const user = await supabaseAuth.getCurrentUser();
      if (user) {
        setAuthMode('cloud');
        setUserId(user.id);
        setUserEmail(user.email || null);
        setIsAuthenticated(true);
        await fetchFromCloud(user.id);
      }
    };
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    syncOnChange(userId, state as any);
  }, [userId, state, syncOnChange]);

  const handleLogin = async () => {
    const user = await supabaseAuth.getCurrentUser();
    if (user) {
      setAuthMode('cloud');
      setUserId(user.id);
      setUserEmail(user.email || null);
      setIsAuthenticated(true);
      await fetchFromCloud(user.id);
      toast('登录成功，正在同步数据…', 'success');
    }
  };

  const handleLocalMode = () => {
    setAuthMode('local');
    setUserId(null);
    setUserEmail(null);
    setIsAuthenticated(true);
    toast('已进入本地模式，数据仅保存在本机');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthMode(null);
    setUserId(null);
    setUserEmail(null);
    setDrawerOpen(false);
    toast('已退出登录');
  };

  // 侧边栏角标：今日=待办数，目标=逾期+今日到期，工作=未完成待办
  const sidebarCounts = useMemo(() => {
    const t = todayISO();
    const dueToday = state.fdTasks.filter(x => x.fdType === 'task' && x.status !== 'done' && x.status !== 'archived' && x.dueDate === t).length;
    const overdue = state.fdTasks.filter(x => x.fdType === 'task' && x.status !== 'done' && x.status !== 'archived' && x.dueDate && x.dueDate < t).length;
    const pendingTodos = state.todos.filter(x => !x.isCompleted).length;
    const habitDue = state.fdHabits.filter(h => h.weekdays.includes((new Date().getDay() + 6) % 7)).length;
    return {
      today: pendingTodos + habitDue,
      goals: dueToday + overdue,
      work: pendingTodos,
    };
  }, [state.todos, state.fdTasks, state.fdHabits]);

  const commonProps = { state, store, userId, toast };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <AuthScreen onLogin={handleLogin} onLocalMode={handleLocalMode} />
        {toastNode}
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        active={activeTab}
        onChange={(t) => { setActiveTab(t); setDrawerOpen(false); }}
        counts={sidebarCounts}
        authMode={authMode}
        userEmail={userEmail}
        onLogout={handleLogout}
      />

      {drawerOpen && (
        <>
          <div className="drawer-mask" onClick={() => setDrawerOpen(false)} />
          <div className="drawer">
            <aside className="sidebar" style={{ position: 'relative', height: '100vh' }}>
              <SidebarBody
                active={activeTab}
                onChange={(t) => { setActiveTab(t); setDrawerOpen(false); }}
                counts={sidebarCounts}
                authMode={authMode}
                userEmail={userEmail}
                onLogout={handleLogout}
              />
            </aside>
          </div>
        </>
      )}

      <div className="app-main">
        <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button className="btn-icon menu-btn" onClick={() => setDrawerOpen(true)} aria-label="打开菜单" style={{ width: 34, height: 34 }}>
            <Menu size={18} />
          </button>
          <div className="tiny muted-3" style={{ marginLeft: 'auto' }}>
            {syncState.lastSync ? `上次同步 ${new Date(syncState.lastSync).toLocaleString()}` : ''}
          </div>
        </div>
        <main className="app-content">
          {activeTab === 'today' && <TodayView {...commonProps} />}
          {activeTab === 'goals' && <GoalsView {...commonProps} />}
          {activeTab === 'work' && <WorkView {...commonProps} selectedDate={selectedDate} onSelectDate={setSelectedDate} />}
          {activeTab === 'summary' && <SummaryView {...commonProps} />}
          {activeTab === 'calendar' && <CalendarView state={state} selectedDate={selectedDate} onSelectDate={setSelectedDate} store={store} toast={toast} />}
          {activeTab === 'stats' && <StatsView state={state} />}
          {activeTab === 'settings' && (
            <SettingsView
              {...commonProps}
              authMode={authMode}
              userEmail={userEmail}
              syncState={syncState}
              onPerformSync={() => userId ? performSync(userId) : Promise.resolve()}
              onFetchFromCloud={() => userId ? fetchFromCloud(userId) : Promise.resolve()}
              onLogout={handleLogout}
              onSwitchLocal={handleLocalMode}
            />
          )}
        </main>
      </div>
      {toastNode}
    </div>
  );
}

export default App;
