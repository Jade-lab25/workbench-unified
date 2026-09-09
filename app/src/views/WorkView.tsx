import { useState } from 'react';
import {
  ListTodo, Flame, Timer, Trophy, ShoppingBag, Lightbulb, Plus, Play, Square,
  Trash2, CheckCircle2, Circle, Pin, Pencil, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { AppState, CheckInProject, TodoTag, ShopCategory } from '../types';
import { Seg, Modal, Empty, useTicker } from '../components/ui';
import { todayISO, fmtDate, fmtTime, fmtDuration, fmtClock, parseISO } from '../utils/dates';

type Sub = 'todo' | 'checkin' | 'time' | 'achievement' | 'shop' | 'inspiration';

interface Props {
  state: AppState;
  store: any;
  selectedDate: string;
  onSelectDate: (d: string) => void;
  toast: (t: string, type?: 'info' | 'success' | 'error') => void;
}

export function WorkView({ state, store, selectedDate, onSelectDate, toast }: Props) {
  const [sub, setSub] = useState<Sub>('todo');
  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">工作状态</div>
          <div className="page-desc">待办 · 打卡 · 时间 · 成就 · 商店 · 灵感</div>
        </div>
      </div>
      <div className="mb16"><Seg<Sub>
        value={sub}
        onChange={setSub}
        items={[
          { key: 'todo', label: '待办', count: state.todos.filter(t => !t.isCompleted).length },
          { key: 'checkin', label: '打卡', count: state.checkInProjects.length },
          { key: 'time', label: '时间' },
          { key: 'achievement', label: '成就' },
          { key: 'shop', label: '商店', count: state.shopItems.filter(i => !i.isPurchased).length },
          { key: 'inspiration', label: '灵感', count: state.inspirations.length },
        ]}
      /></div>
      {sub === 'todo' && <TodoPane state={state} store={store} toast={toast} />}
      {sub === 'checkin' && <CheckInPane state={state} store={store} toast={toast} />}
      {sub === 'time' && <TimePane state={state} store={store} selectedDate={selectedDate} onSelectDate={onSelectDate} toast={toast} />}
      {sub === 'achievement' && <AchievementPane state={state} />}
      {sub === 'shop' && <ShopPane state={state} store={store} toast={toast} />}
      {sub === 'inspiration' && <InspirationPane state={state} store={store} toast={toast} />}
    </div>
  );
}

/* ═══════════ 待办 ═══════════ */
function TodoPane({ state, store, toast }: any) {
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState<TodoTag>('one-time');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done' | TodoTag>('all');

  const add = () => {
    if (!title.trim()) return;
    store.addTodo(title.trim(), tag);
    setTitle('');
    toast('已添加待办', 'success');
  };
  const list = state.todos.filter((t: any) => {
    if (filter === 'pending') return !t.isCompleted;
    if (filter === 'done') return t.isCompleted;
    if (filter === 'long-term' || filter === 'one-time') return t.tag === filter;
    return true;
  });
  // 有待办正在计时时，每秒刷新
  const now = useTicker(list.some((t: any) => t.isTiming));

  return (
    <div className="card">
      <div className="row mb16 wrap">
        <input className="input grow" placeholder="添加待办…" value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <button className={`btn ${tag === 'long-term' ? 'btn-soft' : 'btn-ghost'} btn-sm`} onClick={() => setTag(tag === 'one-time' ? 'long-term' : 'one-time')}>
          {tag === 'one-time' ? '一次性' : '长期'}
        </button>
        <button className="btn btn-primary btn-sm" onClick={add}><Plus size={14} /> 添加</button>
      </div>
      <div className="row mb12 wrap" style={{ gap: 6 }}>
        {([['all', '全部'], ['pending', '未完成'], ['done', '已完成'], ['one-time', '一次性'], ['long-term', '长期']] as const).map(([k, label]) => (
          <button key={k} className={`chip${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>{label}</button>
        ))}
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { store.clearCompletedTodos(); toast('已清除已完成项'); }}>
          清除已完成
        </button>
      </div>
      {list.length === 0 ? <Empty icon={<ListTodo size={28} />} text="没有待办" /> : list.map((t: any) => (
        <div className="list-item" key={t.id}>
          <button className="btn-icon" style={{ color: t.isCompleted ? 'var(--green)' : 'var(--text-3)' }}
            onClick={() => { store.completeTodo(t.id); toast(t.isCompleted ? '已恢复未完成' : '完成 +5 成就值', 'success'); }}>
            {t.isCompleted ? <CheckCircle2 size={19} /> : <Circle size={19} />}
          </button>
          <div className="list-item-main">
            <div className={`list-item-title${t.isCompleted ? ' done' : ''}`}>{t.title}</div>
            <div className="list-item-sub">
              <span className={`badge ${t.tag === 'long-term' ? 'badge-violet' : 'badge-muted'}`} style={{ marginRight: 6 }}>{t.tag === 'long-term' ? '长期' : '一次性'}</span>
              {t.isDelayed && <span className="badge badge-amber" style={{ marginRight: 6 }}>拖延 {t.delayCount} 次</span>}
              {t.isTiming
                ? <span className="badge badge-accent" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtClock(t.totalTime + (now - new Date(t.timingStartTime).getTime()) / 1000)}</span>
                : t.totalTime > 0 && <span className="badge badge-muted">{fmtDuration(t.totalTime)}</span>}
            </div>
          </div>
          {!t.isCompleted && (
            <>
              <button className="btn-icon" title={t.isTiming ? '结束计时' : '开始计时'}
                onClick={() => t.isTiming ? store.endTodoTiming(t.id) : store.startTodoTiming(t.id)}>
                {t.isTiming ? <Square size={15} color="var(--red)" /> : <Play size={15} />}
              </button>
              <button className="btn-icon" title="标记拖延"
                onClick={() => { store.toggleDelayTodo(t.id); toast('已标记拖延 -2', 'info'); }}>
                <Timer size={15} />
              </button>
              <button className="btn-icon" title="置顶"
                onClick={() => store.pinTodo(t.id)}>
                <Pin size={15} />
              </button>
            </>
          )}
          <button className="btn-icon danger" onClick={() => store.deleteTodo(t.id)}><Trash2 size={15} /></button>
        </div>
      ))}
    </div>
  );
}

/* ═══════════ 打卡 ═══════════ */
function CheckInPane({ state, store, toast }: any) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'task' | 'commodity'>('task');
  const [points, setPoints] = useState(5);
  const today = todayISO();

  const add = () => {
    if (!name.trim()) return;
    store.addCheckInProject(name.trim(), type, points);
    setName(''); setPoints(type === 'task' ? 5 : -5);
    toast('打卡项目已创建', 'success');
  };
  /** 累计次数 / 今日次数 / 最后一次打卡（按原版 Achieve-system：不限制一天一次，实时统计） */
  const statsOf = (p: CheckInProject) => {
    const rs = state.checkInRecords.filter((r: any) => r.projectId === p.id);
    const total = rs.length;
    const todayN = rs.filter((r: any) => parseISO(r.createdAt) === today).length;
    const last = rs.length ? rs.reduce((a: any, b: any) => (a.createdAt > b.createdAt ? a : b)) : null;
    return { total, todayN, last };
  };

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-title mb12"><Flame size={16} /> 打卡项目</div>
        {state.checkInProjects.length === 0 && <Empty icon={<Flame size={28} />} text="还没有打卡项目" />}
        {state.checkInProjects.map((p: CheckInProject) => {
          const s = statsOf(p);
          const positive = p.type === 'task';
          return (
            <div className="list-item" key={p.id}>
              <button
                className={`btn btn-sm ${positive ? 'btn-green' : 'btn-red'}`}
                style={{ flexShrink: 0 }}
                onClick={() => {
                  store.checkIn(p.id);
                  toast(positive ? `打卡成功 +${p.points}` : `记录消费 ${p.points}`, positive ? 'success' : 'info');
                }}
              >
                打卡
              </button>
              <div className="list-item-main">
                <div className="list-item-title">{p.name}</div>
                <div className="list-item-sub">
                  <span className={`badge ${positive ? 'badge-green' : 'badge-amber'}`} style={{ marginRight: 6 }}>
                    {positive ? '任务型 +' : '消费型 '}{p.points}
                  </span>
                  <span className="badge badge-muted">累计 {s.total} 次</span>
                  {s.todayN > 0 && <span className="badge badge-muted">今日 {s.todayN} 次</span>}
                  {s.last && <span className="badge badge-muted">最后打卡 {fmtDate(s.last.createdAt)} {fmtTime(s.last.createdAt)}</span>}
                </div>
              </div>
              <button className="btn-icon danger" onClick={() => store.deleteCheckInProject(p.id)}><Trash2 size={15} /></button>
            </div>
          );
        })}
      </div>
      <div className="card">
        <div className="card-title mb12">新建打卡项目</div>
        <div className="col">
          <div className="field"><label className="field-label">项目名称</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="例如：晨跑 5 公里" /></div>
          <div className="row">
            <div className="field grow">
              <label className="field-label">类型</label>
              <div className="seg">
                <button className={`seg-item${type === 'task' ? ' active' : ''}`} onClick={() => { setType('task'); setPoints(5); }}>任务型（加分）</button>
                <button className={`seg-item${type === 'commodity' ? ' active' : ''}`} onClick={() => { setType('commodity'); setPoints(-10); }}>消费型（扣分）</button>
              </div>
            </div>
            <div className="field" style={{ width: 110 }}>
              <label className="field-label">分值</label>
              <input className="input" type="number" value={points} onChange={e => setPoints(Number(e.target.value))} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={add}><Plus size={15} /> 创建项目</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ 时间 ═══════════ */
function TimePane({ state, store, selectedDate, onSelectDate, toast }: any) {
  const [content, setContent] = useState('');
  const running = state.timeRecords.find((r: any) => !r.endTime);
  const dayRecords = state.timeRecords
    .filter((r: any) => parseISO(r.startTime) === selectedDate)
    .sort((a: any, b: any) => b.startTime.localeCompare(a.startTime));

  // 有计时进行中时每秒刷新
  const now = useTicker(!!running);
  const secOf = (r: any) => (new Date(r.endTime).getTime() - (r.startTimestamp || new Date(r.startTime).getTime())) / 1000;
  const liveRunning = running && parseISO(running.startTime) === selectedDate ? (now - (running.startTimestamp || new Date(running.startTime).getTime())) / 1000 : 0;
  const total = dayRecords.reduce((s: number, r: any) => s + (r.endTime ? secOf(r) : 0), 0) + liveRunning;

  const start = () => {
    if (!content.trim()) return;
    store.startTimer(content.trim());
    setContent('');
    toast('计时开始', 'success');
  };

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-head">
          <div className="card-title"><Timer size={16} /> 计时</div>
          {running && <span className="badge badge-accent">进行中</span>}
        </div>
        {running ? (
          <div className="col">
            <div className="card" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent-line)', textAlign: 'center', padding: '20px 12px' }}>
              <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: 2, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {fmtClock((now - (running.startTimestamp || new Date(running.startTime).getTime())) / 1000)}
              </div>
              <div className="small bold mt8">{running.content}</div>
              <div className="tiny muted mt8">开始于 {fmtTime(running.startTime)}</div>
            </div>
            <button className="btn btn-danger" onClick={() => { store.endTimer(running.id); toast('计时结束'); }}>
              <Square size={15} /> 结束计时
            </button>
          </div>
        ) : (
          <div className="row">
            <input className="input grow" placeholder="开始计时：在做什么？" value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') start(); }} />
            <button className="btn btn-primary" onClick={start}><Play size={15} /> 开始</button>
          </div>
        )}
        <div className="mt16" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div className="row-between mb8">
            <div className="row" style={{ gap: 4 }}>
              <button className="btn-icon" onClick={() => onSelectDate(fmtDateOffset(selectedDate, -1))}><ChevronLeft size={16} /></button>
              <span className="small bold">{fmtDate(selectedDate)}</span>
              <button className="btn-icon" onClick={() => onSelectDate(fmtDateOffset(selectedDate, 1))}><ChevronRight size={16} /></button>
            </div>
            <span className="badge badge-accent" style={{ fontVariantNumeric: 'tabular-nums' }}>合计 {fmtClock(total)}</span>
          </div>
          {dayRecords.length === 0 && <Empty icon={<Timer size={26} />} text="这一天还没有计时" />}
          {dayRecords.map((r: any) => (
            <div className="list-item" key={r.id}>
              <div className="list-item-main">
                <div className="list-item-title">{r.content}</div>
                <div className="list-item-sub">{fmtTime(r.startTime)} → {r.endTime ? fmtTime(r.endTime) : '进行中'}</div>
                {r.note && <div className="tiny muted-3 mt8">{r.note}</div>}
              </div>
              <span className="badge badge-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {r.endTime ? fmtClock(secOf(r)) : fmtClock((now - (r.startTimestamp || new Date(r.startTime).getTime())) / 1000)}
              </span>
              <button className="btn-icon danger" onClick={() => store.deleteTimeRecord(r.id)}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-title mb12">最近记录</div>
        {state.timeRecords.filter((r: any) => r.endTime).slice(0, 12).map((r: any) => (
          <div className="list-item" key={r.id}>
            <div className="list-item-main">
              <div className="list-item-title" style={{ fontSize: 13 }}>{r.content}</div>
              <div className="list-item-sub">{fmtDate(r.startTime)} · {fmtTime(r.startTime)}–{fmtTime(r.endTime)}</div>
            </div>
            <span className="badge badge-muted">{fmtDuration((new Date(r.endTime).getTime() - (r.startTimestamp || new Date(r.startTime).getTime())) / 1000)}</span>
          </div>
        ))}
        {state.timeRecords.filter((r: any) => r.endTime).length === 0 && <Empty icon={<Timer size={26} />} text="暂无记录" />}
      </div>
    </div>
  );
}

function fmtDateOffset(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ═══════════ 成就 ═══════════ */
function AchievementPane({ state }: any) {
  const logs = state.achievementLogs;
  const typeMeta: Record<string, { label: string; cls: string }> = {
    todo: { label: '待办', cls: 'badge-accent' },
    task: { label: '任务', cls: 'badge-green' },
    commodity: { label: '消费', cls: 'badge-amber' },
    shop_purchase: { label: '兑换', cls: 'badge-violet' },
  };
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label"><Trophy size={14} color="var(--accent)" /> 当前成就</div>
          <div className="kpi-value">{state.totalAchievements}</div></div>
        <div className="kpi"><div className="kpi-label" style={{ color: 'var(--green)' }}>累计获得</div>
          <div className="kpi-value" style={{ color: 'var(--green)' }}>+{state.totalEarned}</div></div>
        <div className="kpi"><div className="kpi-label" style={{ color: 'var(--amber)' }}>累计消耗</div>
          <div className="kpi-value" style={{ color: 'var(--amber)' }}>-{state.totalSpent}</div></div>
      </div>
      <div className="card">
        <div className="card-title mb12">积分流水</div>
        {logs.length === 0 && <Empty icon={<Trophy size={28} />} text="还没有积分记录，完成待办或打卡试试" />}
        {logs.slice(0, 40).map((l: any) => {
          const meta = typeMeta[l.type] || typeMeta.todo;
          return (
            <div className="list-item" key={l.id}>
              <div className="list-item-main">
                <div className="list-item-title" style={{ fontSize: 13 }}>{l.title}</div>
                <div className="list-item-sub">{fmtDate(l.createdAt)} · {fmtTime(l.createdAt)}</div>
              </div>
              <span className={`badge ${meta.cls}`} style={{ marginRight: 4 }}>{meta.label}</span>
              <span className="bold" style={{ color: l.points >= 0 ? 'var(--green)' : 'var(--red)', width: 52, textAlign: 'right' }}>
                {l.points >= 0 ? '+' : ''}{l.points}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════ 商店 ═══════════ */
const SHOP_CATS: { key: ShopCategory | 'all'; label: string }[] = [
  { key: 'all', label: '全部' }, { key: 'life', label: '生活' }, { key: 'study', label: '学习' },
  { key: 'work', label: '工作' }, { key: 'entertainment', label: '娱乐' }, { key: 'other', label: '其他' },
];
function ShopPane({ state, store, toast }: any) {
  const [cat, setCat] = useState<ShopCategory | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState(''); const [price, setPrice] = useState(50);
  const [category, setCategory] = useState<ShopCategory>('life'); const [desc, setDesc] = useState('');
  const items = state.shopItems.filter((i: any) => cat === 'all' || i.category === cat);

  const add = () => {
    if (!name.trim()) return;
    store.addShopItem(name.trim(), price, category, desc.trim());
    setName(''); setPrice(50); setDesc(''); setShowAdd(false);
    toast('商品已上架', 'success');
  };
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="card row-between wrap">
        <div className="row" style={{ gap: 12 }}>
          <div>
            <div className="tiny muted-3">当前成就值</div>
            <div className="bold" style={{ fontSize: 20 }}>{state.totalAchievements}</div>
          </div>
          <div>
            <div className="tiny muted-3">已兑换</div>
            <div className="bold" style={{ fontSize: 20 }}>{state.shopItems.filter((i: any) => i.isPurchased).length} 件</div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={15} /> 上架商品</button>
      </div>
      <div className="row mb8 wrap" style={{ gap: 6 }}>
        {SHOP_CATS.map(c => (
          <button key={c.key} className={`chip${cat === c.key ? ' active' : ''}`} onClick={() => setCat(c.key)}>{c.label}</button>
        ))}
      </div>
      {items.length === 0 && <div className="card"><Empty icon={<ShoppingBag size={28} />} text="这个分类下没有商品" /></div>}
      <div className="grid-3">
        {items.map((i: any) => (
          <div className="card" key={i.id} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="row-between">
              <span className="badge badge-slate">{SHOP_CATS.find(c => c.key === i.category)?.label}</span>
              {i.isPurchased ? <span className="badge badge-green">已兑换</span> : <span className="badge badge-accent">{i.price} 分</span>}
            </div>
            <div className="bold" style={{ fontSize: 14 }}>{i.name}</div>
            {i.description && <div className="small muted">{i.description}</div>}
            <div className="row" style={{ marginTop: 'auto' }}>
              {i.isPurchased
                ? <span className="tiny muted-3">兑换于 {i.purchasedAt ? fmtDate(i.purchasedAt) : ''}</span>
                : <button className="btn btn-soft btn-sm" disabled={state.totalAchievements < i.price}
                  onClick={() => {
                    const ok = store.purchaseShopItem(i.id);
                    toast(ok ? `已兑换「${i.name}」` : '成就值不足，先完成待办赚积分吧', ok ? 'success' : 'error');
                  }}>兑换</button>}
              <button className="btn-icon danger" style={{ marginLeft: 'auto' }} onClick={() => store.deleteShopItem(i.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={showAdd} title="上架商品" onClose={() => setShowAdd(false)}>
        <div className="col">
          <div className="field"><label className="field-label">商品名称</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="例如：周末看一场电影" autoFocus /></div>
          <div className="row">
            <div className="field grow"><label className="field-label">价格（成就值）</label>
              <input className="input" type="number" value={price} onChange={e => setPrice(Number(e.target.value))} /></div>
            <div className="field grow"><label className="field-label">分类</label>
              <select className="select" value={category} onChange={e => setCategory(e.target.value as ShopCategory)}>
                <option value="life">生活</option><option value="study">学习</option>
                <option value="work">工作</option><option value="entertainment">娱乐</option><option value="other">其他</option>
              </select></div>
          </div>
          <div className="field"><label className="field-label">描述（可选）</label>
            <textarea className="textarea" rows={2} value={desc} onChange={e => setDesc(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={add}>上架</button>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════ 灵感 ═══════════ */
function InspirationPane({ state, store, toast }: any) {
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const add = () => {
    if (!content.trim()) return;
    store.addInspiration(content.trim());
    setContent('');
    toast('灵感已记录', 'success');
  };
  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-title mb12"><Lightbulb size={16} /> 记一条灵感</div>
        <textarea className="textarea" rows={4} placeholder="想到什么就记什么…" value={content} onChange={e => setContent(e.target.value)} />
        <button className="btn btn-primary mt12" onClick={add}><Plus size={15} /> 记录</button>
        <div className="tiny muted-3 mt12">灵感可以一键转为待办，进入待办清单</div>
      </div>
      <div className="card">
        <div className="card-title mb12">灵感板</div>
        {state.inspirations.length === 0 && <Empty icon={<Lightbulb size={28} />} text="还没有灵感" />}
        {state.inspirations.map((i: any) => (
          <div className="list-item" key={i.id}>
            {editing === i.id ? (
              <>
                <input className="input grow" value={editText} onChange={e => setEditText(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') { store.updateInspiration(i.id, editText.trim()); setEditing(null); } }} />
                <button className="btn btn-soft btn-sm" onClick={() => { store.updateInspiration(i.id, editText.trim()); setEditing(null); toast('已更新'); }}>保存</button>
              </>
            ) : (
              <>
                <div className="list-item-main">
                  <div className="list-item-title" style={{ fontSize: 13 }}>{i.content}</div>
                  <div className="list-item-sub">{fmtDate(i.createdAt)}</div>
                </div>
                <button className="btn-icon" title="转为待办" onClick={() => { store.moveInspirationToTodo(i.id); toast('已转为待办', 'success'); }}>
                  <ListTodo size={15} />
                </button>
                <button className="btn-icon" title="编辑" onClick={() => { setEditing(i.id); setEditText(i.content); }}><Pencil size={14} /></button>
                <button className="btn-icon danger" onClick={() => store.deleteInspiration(i.id)}><Trash2 size={15} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
