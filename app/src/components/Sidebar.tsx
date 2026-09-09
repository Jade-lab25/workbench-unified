import { LayoutDashboard, Target, Briefcase, Sparkles, CalendarDays, BarChart3, Settings, LogOut, Cloud, CloudOff, HardDrive } from 'lucide-react';

export type TabType = 'today' | 'goals' | 'work' | 'summary' | 'calendar' | 'stats' | 'settings';

export const NAV_ITEMS: { key: TabType; label: string; icon: typeof Target }[] = [
  { key: 'today', label: '今日', icon: LayoutDashboard },
  { key: 'goals', label: '目标', icon: Target },
  { key: 'work', label: '工作', icon: Briefcase },
  { key: 'summary', label: '总结', icon: Sparkles },
  { key: 'calendar', label: '日历', icon: CalendarDays },
  { key: 'stats', label: '统计', icon: BarChart3 },
  { key: 'settings', label: '设置', icon: Settings },
];

interface SidebarProps {
  active: TabType;
  onChange: (t: TabType) => void;
  counts?: Partial<Record<TabType, number>>;
  authMode: 'local' | 'cloud' | null;
  userEmail: string | null;
  onLogout: () => void;
}

function SyncHint({ authMode }: { authMode: 'local' | 'cloud' | null }) {
  if (authMode === 'cloud') {
    return <span className="row" style={{ gap: 5 }}><Cloud size={13} color="var(--green)" /> 云同步已开启</span>;
  }
  if (authMode === 'local') {
    return <span className="row" style={{ gap: 5 }}><HardDrive size={13} /> 本地模式</span>;
  }
  return <span className="row" style={{ gap: 5 }}><CloudOff size={13} /> 未登录</span>;
}

export function SidebarBody({ active, onChange, counts, authMode, userEmail, onLogout }: SidebarProps) {
  return (
    <>
      <div className="sidebar-brand">
        <div className="sidebar-logo"><Target size={16} strokeWidth={2.4} /></div>
        <div>
          <div className="sidebar-name">工作台</div>
          <div className="sidebar-sub">Workbench · 三合一</div>
        </div>
      </div>
      <nav className="sidebar-nav" aria-label="主导航">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`nav-item${active === key ? ' active' : ''}`}
            onClick={() => onChange(key)}
          >
            <span className="ic"><Icon size={17} strokeWidth={2} /></span>
            {label}
            {counts?.[key] ? <span className="nav-count">{counts[key]}</span> : null}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="row-between">
          <SyncHint authMode={authMode} />
          {authMode && (
            <button className="btn-icon" onClick={onLogout} title="退出登录" style={{ width: 26, height: 26 }}>
              <LogOut size={14} />
            </button>
          )}
        </div>
        {userEmail && <div className="tiny muted-3 mt8" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>}
      </div>
    </>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="sidebar">
      <SidebarBody {...props} />
    </aside>
  );
}
