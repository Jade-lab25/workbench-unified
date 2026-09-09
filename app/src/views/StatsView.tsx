import { useMemo, useState } from 'react';
import { Target, Flame, Timer, Trophy, CheckCircle2, AlertCircle } from 'lucide-react';
import type { AppState } from '../types';
import { computeDashStats, computeHabitStats } from '../utils/stats';
import { rangeStart, todayISO, fmtDuration } from '../utils/dates';
import { Progress } from '../components/ui';

interface Props { state: AppState; }

const RANGES = [
  { key: 7, label: '近 7 天' },
  { key: 30, label: '近 30 天' },
  { key: 90, label: '近 90 天' },
  { key: 0, label: '全部' },
];

export function StatsView({ state }: Props) {
  const [rangeDays, setRangeDays] = useState(30);
  const end = todayISO();
  const start = rangeDays ? rangeStart(rangeDays) : '2000-01-01';

  const dash = useMemo(() => computeDashStats(state.fdTasks, state.fdGoals, start, end), [state.fdTasks, state.fdGoals, start, end]);
  const habit = useMemo(() => computeHabitStats(state.fdHabits, state.fdHabitLogs), [state.fdHabits, state.fdHabitLogs]);
  const totalTime = useMemo(() => {
    let s = 0;
    state.timeRecords.forEach(r => { if (r.endTime) s += (new Date(r.endTime).getTime() - (r.startTimestamp || new Date(r.startTime).getTime())) / 1000; });
    return s;
  }, [state.timeRecords]);

  const maxTrend = Math.max(1, ...dash.trend.map(t => t.count));
  const maxPri = Math.max(1, dash.p0, dash.p1, dash.p2, dash.p3);
  const ring = dash.completionRate;
  const R = 40, C = 2 * Math.PI * R;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">统计</div>
          <div className="page-desc">目标进度 · 任务趋势 · 习惯达成 · 成就总览</div>
        </div>
        <div className="seg">
          {RANGES.map(r => (
            <button key={r.key} className={`seg-item${rangeDays === r.key ? ' active' : ''}`} onClick={() => setRangeDays(r.key)}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-grid mb16">
        <div className="kpi"><div className="kpi-label"><CheckCircle2 size={14} color="var(--green)" /> 完成任务</div>
          <div className="kpi-value">{dash.done}</div><div className="kpi-note">共创建 {dash.total} 个任务</div></div>
        <div className="kpi"><div className="kpi-label"><Target size={14} color="var(--accent)" /> 完成率</div>
          <div className="kpi-value">{dash.completionRate}<small>%</small></div><div className="kpi-note">已完成 / 已创建</div></div>
        <div className="kpi"><div className="kpi-label"><AlertCircle size={14} color="var(--red)" /> 逾期</div>
          <div className="kpi-value" style={{ color: dash.overdueCount ? 'var(--red)' : undefined }}>{dash.overdueCount}</div><div className="kpi-note">进行中且已过期</div></div>
        <div className="kpi"><div className="kpi-label"><Flame size={14} color="var(--amber)" /> 习惯达成</div>
          <div className="kpi-value">{habit.rate}<small>%</small></div><div className="kpi-note">{habit.monthlyActual}/{habit.monthlyExpected} 次 · 累计 {habit.cumulative}</div></div>
        <div className="kpi"><div className="kpi-label"><Trophy size={14} color="var(--violet)" /> 累计成就</div>
          <div className="kpi-value">{state.totalAchievements}</div><div className="kpi-note">+{state.totalEarned} / -{state.totalSpent}</div></div>
        <div className="kpi"><div className="kpi-label"><Timer size={14} color="var(--teal)" /> 累计专注</div>
          <div className="kpi-value">{fmtDuration(totalTime)}</div><div className="kpi-note">{state.timeRecords.length} 条计时</div></div>
      </div>

      <div className="grid-2">
        {/* 完成率环 + 优先级 */}
        <div className="card">
          <div className="card-title mb12">完成率与优先级</div>
          <div className="row" style={{ gap: 20 }}>
            <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
              <svg width="110" height="110" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
                <circle cx="50" cy="50" r={R} fill="none" stroke="var(--accent)" strokeWidth="10"
                  strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ring / 100)}
                  transform="rotate(-90 50 50)" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{ring}%</span>
                <span className="tiny muted-3">完成率</span>
              </div>
            </div>
            <div className="col grow" style={{ gap: 8 }}>
              {([['P0', dash.p0, 'var(--red)'], ['P1', dash.p1, 'var(--amber)'], ['P2', dash.p2, 'var(--accent)'], ['P3/无', dash.p3, 'var(--text-3)']] as const).map(([label, val, color]) => (
                <div key={label}>
                  <div className="row-between tiny muted" style={{ marginBottom: 3 }}>
                    <span>{label} · 进行中 {val}</span>
                  </div>
                  <div className="progress"><i style={{ width: `${val / maxPri * 100}%`, background: color as string }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 趋势 */}
        <div className="card">
          <div className="card-title mb12">完成趋势</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 130, paddingTop: 8 }}>
            {dash.trend.map((t, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
                <span className="tiny muted-3" style={{ fontSize: 9.5 }}>{t.count || ''}</span>
                <div style={{ width: '100%', maxWidth: 26, height: `${Math.max(2, t.count / maxTrend * 92)}px`, background: t.count ? 'var(--accent)' : 'var(--surface-2)', borderRadius: '4px 4px 0 0' }} />
                {i % Math.max(1, Math.floor(dash.trend.length / 8)) === 0 && (
                  <span className="tiny muted-3" style={{ fontSize: 9, transform: 'rotate(-40deg)', transformOrigin: 'left', whiteSpace: 'nowrap' }}>{t.label}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 目标进度 */}
      <div className="card mt16">
        <div className="card-title mb12"><Target size={16} /> 目标进度</div>
        {state.fdGoals.length === 0 ? (
          <div className="empty" style={{ padding: '20px' }}><div className="empty-text">还没有目标</div></div>
        ) : (
          <div className="col" style={{ gap: 12 }}>
            {state.fdGoals.map(g => {
              const gts = state.fdTasks.filter(t => t.goalId === g.id && t.fdType === 'task');
              const total = gts.reduce((s, t) => s + countAll(t.subtasks), 0);
              const done = gts.reduce((s, t) => s + countDone(t.subtasks), 0);
              const pct = total ? Math.round(done / total * 100) : 0;
              return (
                <div key={g.id}>
                  <div className="row-between mb8">
                    <span className="small bold">{g.title}</span>
                    <span className="row" style={{ gap: 6 }}>
                      <span className={`badge ${g.status === 'done' ? 'badge-green' : g.status === 'paused' ? 'badge-muted' : 'badge-accent'}`}>
                        {g.status === 'active' ? '进行中' : g.status === 'done' ? '已完成' : '已暂停'}
                      </span>
                      <span className="tiny muted">{total ? `${done}/${total} 拆解` : `${gts.length} 任务`}</span>
                    </span>
                  </div>
                  <Progress value={pct} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function countAll(subs: any[]): number {
  const leaves: any[] = [];
  const walk = (list: any[]) => list.forEach(s => s.children?.length ? walk(s.children) : leaves.push(s));
  walk(subs);
  return leaves.length;
}
function countDone(subs: any[]): number {
  const leaves: any[] = [];
  const walk = (list: any[]) => list.forEach(s => s.children?.length ? walk(s.children) : leaves.push(s));
  walk(subs);
  return leaves.filter(s => s.done).length;
}
