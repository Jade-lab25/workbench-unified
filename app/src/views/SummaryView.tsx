import { useMemo, useState } from 'react';
import {
  Sparkles, Lightbulb, ClipboardList, Plus, Trash2, Pencil, Save, History, Loader2, KeyRound,
  ChevronLeft, ChevronRight, Wand2,
} from 'lucide-react';
import type { AppState, SummaryIdea } from '../types';
import { Seg, Modal, Empty, Markdown } from '../components/ui';
import { PROVIDERS, TEMPLATES, generateWithLLM, loadLLMConfig, saveLLMConfig } from '../utils/llm';
import { todayISO, weekRange, fmtDate } from '../utils/dates';

type Sub = 'generate' | 'ideas' | 'logs';

interface Props {
  state: AppState;
  store: any;
  userId: string | null;
  toast: (t: string, type?: 'info' | 'success' | 'error') => void;
}

export function SummaryView({ state, store, toast }: Props) {
  const [sub, setSub] = useState<Sub>('generate');
  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">内容总结</div>
          <div className="page-desc">灵感 · 日志 → AI 生成日报/周报，历史留存云端</div>
        </div>
      </div>
      <div className="mb16"><Seg<Sub>
        value={sub}
        onChange={setSub}
        items={[
          { key: 'generate', label: '总结生成' },
          { key: 'ideas', label: '灵感库', count: state.summaryIdeas.length },
          { key: 'logs', label: '工作日志', count: state.summaryLogs.length },
        ]}
      /></div>
      {sub === 'generate' && <GeneratePane state={state} store={store} toast={toast} />}
      {sub === 'ideas' && <IdeasPane state={state} store={store} toast={toast} />}
      {sub === 'logs' && <LogsPane state={state} store={store} toast={toast} />}
    </div>
  );
}

/* ═══════════ 总结生成 ═══════════ */
function GeneratePane({ state, store, toast }: any) {
  const llmInit = loadLLMConfig();
  const [rangeKind, setRangeKind] = useState<'weekly' | 'daily' | 'custom'>('weekly');
  const [customStart, setCustomStart] = useState(todayISO());
  const [customEnd, setCustomEnd] = useState(todayISO());
  const [templateCode, setTemplateCode] = useState('A');
  const [showSettings, setShowSettings] = useState(false);
  const [dirFilter, setDirFilter] = useState<'work' | 'all' | 'growth'>('work');
  const [provider, setProvider] = useState(llmInit.provider || 'deepseek');
  const [model, setModel] = useState(llmInit.model || '');
  const [apiKey, setApiKey] = useState(llmInit.apiKey || '');
  const [customEndpoint, setCustomEndpoint] = useState(llmInit.customEndpoint || '');
  const [extraMaterial, setExtraMaterial] = useState('');
  const [result, setResult] = useState('');
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewDoc, setViewDoc] = useState<{ title: string; summary: string } | null>(null);

  const week = weekRange();
  const range = useMemo(() => {
    if (rangeKind === 'weekly') return week;
    if (rangeKind === 'daily') return { start: todayISO(), end: todayISO() };
    return { start: customStart, end: customEnd };
  }, [rangeKind, customStart, customEnd, week]);

  const templates = TEMPLATES.filter(t => rangeKind === 'custom' || t.kind === rangeKind);
  const activeTemplate = templates.find(t => t.code === templateCode) || templates[0];

  const kindLabel = rangeKind === 'daily' ? '日报' : rangeKind === 'weekly' ? '周报' : '总结';

  /** 聚合素材：灵感 + 工作日志（范围内，按方向筛选）+ 手动补充 */
  const gather = useMemo(() => {
    const work: string[] = [];
    const growth: string[] = [];
    state.summaryLogs.forEach((l: any) => {
      if (!l.date || l.date < range.start || l.date > range.end) return;
      const text = `【日志·${fmtDate(l.date)}】${l.matter}${l.result ? ' → ' + l.result : ''}`;
      work.push(text);
    });
    state.summaryIdeas.forEach((i: SummaryIdea) => {
      const d = (i.createdAt || '').slice(0, 10);
      if (d < range.start || d > range.end) return;
      const dirLabel = i.direction === 'growth' ? '个人成长' : '工作';
      const text = `【灵感·${dirLabel}】${i.content}`;
      if (i.direction === 'growth') growth.push(text); else work.push(text);
    });
    if (extraMaterial.trim()) {
      work.push(`【手动补充】${extraMaterial.trim()}`);
    }
    if (dirFilter === 'work') growth.length = 0;
    if (dirFilter === 'growth') work.length = 0;
    return { work, growth };
  }, [state.summaryLogs, state.summaryIdeas, extraMaterial, range, dirFilter]);

  const saveSettings = () => {
    saveLLMConfig({ provider, apiKey: apiKey.trim(), model: model.trim(), customEndpoint: customEndpoint.trim() });
    setShowSettings(false);
    toast('API 设置已保存到本机浏览器', 'success');
  };

  const handleGenerate = async () => {
    setErrorMsg('');
    setResult('');
    if (!apiKey.trim()) {
      setErrorMsg('请先在「API 设置」中填写 API Key');
      setShowSettings(true);
      return;
    }
    if (!gather.work.length && !gather.growth.length) {
      setErrorMsg('该时间范围内没有日志或灵感，先去「灵感库 / 工作日志」补充内容');
      return;
    }
    setGenerating(true);
    try {
      const content = await generateWithLLM({
        provider,
        apiKey,
        model,
        customEndpoint,
        kindLabel,
        templateMarkdown: activeTemplate.markdown,
        workMaterial: gather.work,
        growthMaterial: gather.growth,
        rangeStart: range.start,
        rangeEnd: range.end,
      });
      setResult(content);
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDoc = () => {
    if (!result) return;
    store.addSummaryDoc({
      title: `${kindLabel} ${range.start}${range.start !== range.end ? '~' + range.end : ''}`,
      kind: rangeKind === 'custom' ? 'custom' : rangeKind,
      templateCode: activeTemplate.code,
      rangeStart: range.start,
      rangeEnd: range.end,
      sources: [],
      summary: result,
      provider,
      model: model.trim() || PROVIDERS[provider]?.model || '',
    });
    toast('已保存到云端/本地', 'success');
  };

  const noKey = !apiKey.trim();

  return (
    <div className="grid-2">
      {/* 左：配置 + 生成 */}
      <div className="col" style={{ gap: 16 }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title"><Wand2 size={16} /> 生成设置</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)}>
              <KeyRound size={13} /> {noKey ? 'API 未配置' : 'API 已配置'}
            </button>
          </div>
          <div className="col" style={{ gap: 12 }}>
            <div className="row wrap">
              <div className="field grow">
                <label className="field-label">周期</label>
                <div className="seg">
                  <button className={`seg-item${rangeKind === 'daily' ? ' active' : ''}`} onClick={() => setRangeKind('daily')}>日报</button>
                  <button className={`seg-item${rangeKind === 'weekly' ? ' active' : ''}`} onClick={() => setRangeKind('weekly')}>周报</button>
                  <button className={`seg-item${rangeKind === 'custom' ? ' active' : ''}`} onClick={() => setRangeKind('custom')}>自定义</button>
                </div>
              </div>
              <div className="field grow">
                <label className="field-label">模板</label>
                <select className="select" value={activeTemplate.code} onChange={e => setTemplateCode(e.target.value)}>
                  {templates.map(t => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
                </select>
              </div>
            </div>
            {rangeKind === 'custom' && (
              <div className="row">
                <div className="field grow"><label className="field-label">开始</label>
                  <input className="input" type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} /></div>
                <div className="field grow"><label className="field-label">结束</label>
                  <input className="input" type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} /></div>
              </div>
            )}
            <div className="row-between" style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '8px 12px' }}>
              <span className="small muted">时间范围</span>
              <span className="small bold">{range.start}{range.start !== range.end ? ' ~ ' + range.end : ''}</span>
            </div>
            <div className="field">
              <label className="field-label">素材方向</label>
              <div className="seg">
                <button className={`seg-item${dirFilter === 'work' ? ' active' : ''}`} onClick={() => setDirFilter('work')}>工作</button>
                <button className={`seg-item${dirFilter === 'all' ? ' active' : ''}`} onClick={() => setDirFilter('all')}>全部</button>
                <button className={`seg-item${dirFilter === 'growth' ? ' active' : ''}`} onClick={() => setDirFilter('growth')}>成长</button>
              </div>
            </div>
            <div className="field">
              <label className="field-label">补充素材（可选，仅本次生成使用）</label>
              <textarea className="textarea" rows={2} placeholder="粘贴额外素材：项目进展、数据、沟通结论…" value={extraMaterial} onChange={e => setExtraMaterial(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-block" style={{ height: 38 }} disabled={generating} onClick={handleGenerate}>
              {generating ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              {generating ? '生成中…' : `生成${kindLabel}（模板 ${activeTemplate.code}）`}
            </button>
            {errorMsg && <div style={{ padding: '9px 12px', borderRadius: 10, background: 'var(--red-soft)', color: 'var(--red)', fontSize: 12.5 }}>{errorMsg}</div>}
            <div className="tiny muted-3">
              素材自动聚合：范围内的工作日志 + 灵感（当前方向：{dirFilter === 'all' ? '工作+成长' : dirFilter === 'work' ? '工作' : '成长'}），共 {gather.work.length + gather.growth.length} 条
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title"><History size={16} /> 生成历史</div>
          </div>
          {state.summaryDocs.length === 0 && <Empty icon={<History size={26} />} text="还没有生成记录" />}
          {state.summaryDocs.slice(0, 10).map((d: any) => (
            <div className="list-item" key={d.id}>
              <button className="list-item-main" style={{ textAlign: 'left' }} onClick={() => setViewDoc({ title: d.title, summary: d.summary })}>
                <div className="list-item-title" style={{ fontSize: 13 }}>{d.title}</div>
                <div className="list-item-sub">{d.kind} · 模板 {d.templateCode} · {fmtDate(d.createdAt)}</div>
              </button>
              <button className="btn-icon danger" onClick={() => store.deleteSummaryDoc(d.id)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* 右：结果 */}
      <div className="card">
        <div className="card-head">
          <div className="card-title"><Sparkles size={16} /> 生成结果</div>
          {result && (
            <button className="btn btn-soft btn-sm" onClick={handleSaveDoc}><Save size={14} /> 保存</button>
          )}
        </div>
        {result ? (
          <Markdown text={result} />
        ) : (
          <Empty icon={<Sparkles size={28} />} text="配置好 API 后，点击生成\n结果会显示在这里" />
        )}
      </div>

      {/* API 设置弹窗 */}
      <Modal open={showSettings} title="LLM API 设置" onClose={() => setShowSettings(false)}>
        <div className="col">
          <div className="field"><label className="field-label">供应商</label>
            <select className="select" value={provider} onChange={e => { setProvider(e.target.value); setModel(PROVIDERS[e.target.value]?.model || ''); }}>
              {Object.entries(PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></div>
          {provider === 'custom' && (
            <div className="field"><label className="field-label">自定义 API 端点</label>
              <input className="input" placeholder="https://api.example.com/v1" value={customEndpoint} onChange={e => setCustomEndpoint(e.target.value)} /></div>
          )}
          <div className="field"><label className="field-label">模型</label>
            {PROVIDERS[provider]?.models?.length ? (
              <select className="select" value={model || PROVIDERS[provider].model} onChange={e => setModel(e.target.value)}>
                {PROVIDERS[provider].models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input className="input" placeholder="输入模型名" value={model} onChange={e => setModel(e.target.value)} />
            )}
          </div>
          <div className="field"><label className="field-label">API Key</label>
            <input className="input mono" type="password" placeholder="sk-…" value={apiKey} onChange={e => setApiKey(e.target.value)} /></div>
          <div className="tiny muted-3">Key 仅保存在本机浏览器 localStorage，不上传任何服务器；换设备需重新填写。浏览器直连调用，60 秒超时。</div>
          <button className="btn btn-primary" onClick={saveSettings}>保存设置</button>
        </div>
      </Modal>

      <Modal open={!!viewDoc} title={viewDoc?.title || ''} onClose={() => setViewDoc(null)} width={640}>
        {viewDoc && <Markdown text={viewDoc.summary} />}
      </Modal>
    </div>
  );
}

/* ═══════════ 灵感库 ═══════════ */
function IdeasPane({ state, store, toast }: any) {
  const [content, setContent] = useState('');
  const [direction, setDirection] = useState<'work' | 'growth' | 'none'>('work');
  const [filterDir, setFilterDir] = useState<'all' | 'work' | 'growth' | 'none'>('all');
  const [filterTag, setFilterTag] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const allTags = useMemo(() => {
    const map: Record<string, number> = {};
    state.summaryIdeas.forEach((i: SummaryIdea) => (i.tags || []).forEach((t: string) => { map[t] = (map[t] || 0) + 1; }));
    return Object.keys(map).sort();
  }, [state.summaryIdeas]);

  const parseTags = (text: string) => Array.from(new Set((text.match(/#[\w\u4e00-\u9fa5]+/g) || []).map(t => t.slice(1))));

  const add = () => {
    if (!content.trim()) return;
    store.addSummaryIdea(content.trim(), direction, parseTags(content));
    setContent('');
    toast('灵感已入库', 'success');
  };

  const list = state.summaryIdeas.filter((i: SummaryIdea) => {
    if (filterDir !== 'all' && i.direction !== filterDir) return false;
    if (filterTag && !(i.tags || []).includes(filterTag)) return false;
    return true;
  });

  const dirLabel = (d: string) => d === 'work' ? '工作' : d === 'growth' ? '成长' : '未分类';

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-title mb12"><Lightbulb size={16} /> 记一条灵感</div>
        <div className="seg mb12">
          {([['work', '工作'], ['growth', '个人成长'], ['none', '未分类']] as const).map(([k, label]) => (
            <button key={k} className={`seg-item${direction === k ? ' active' : ''}`} onClick={() => setDirection(k)}>{label}</button>
          ))}
        </div>
        <textarea className="textarea" rows={4} placeholder="内容，可用 #标签 标注…" value={content} onChange={e => setContent(e.target.value)} />
        <button className="btn btn-primary mt12" onClick={add}><Plus size={15} /> 记录</button>
      </div>
      <div className="card">
        <div className="card-head">
          <div className="card-title">灵感列表</div>
          <div className="row wrap" style={{ gap: 4 }}>
            {allTags.map(t => (
              <button key={t} className={`chip${filterTag === t ? ' active' : ''}`} onClick={() => setFilterTag(filterTag === t ? '' : t)}>#{t}</button>
            ))}
          </div>
        </div>
        <div className="row mb12 wrap" style={{ gap: 6 }}>
          {([['all', '全部'], ['work', '工作'], ['growth', '成长'], ['none', '未分类']] as const).map(([k, label]) => (
            <button key={k} className={`chip${filterDir === k ? ' active' : ''}`} onClick={() => setFilterDir(k)}>{label}</button>
          ))}
        </div>
        {list.length === 0 && <Empty icon={<Lightbulb size={26} />} text="没有匹配的灵感" />}
        {list.map((i: SummaryIdea) => (
          <div className="list-item" key={i.id}>
            {editing === i.id ? (
              <>
                <input className="input grow" value={editText} onChange={e => setEditText(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') { store.updateSummaryIdea(i.id, { content: editText.trim(), tags: parseTags(editText) }); setEditing(null); toast('已更新'); } }} />
                <button className="btn btn-soft btn-sm" onClick={() => { store.updateSummaryIdea(i.id, { content: editText.trim(), tags: parseTags(editText) }); setEditing(null); }}>保存</button>
              </>
            ) : (
              <>
                <div className="list-item-main">
                  <div className="list-item-title" style={{ fontSize: 13 }}>{i.content}</div>
                  <div className="row mt8 wrap" style={{ gap: 4 }}>
                    <span className={`badge ${i.direction === 'work' ? 'badge-accent' : i.direction === 'growth' ? 'badge-green' : 'badge-muted'}`}>{dirLabel(i.direction)}</span>
                    {(i.tags || []).map(t => <span key={t} className="badge badge-muted">#{t}</span>)}
                    <span className="tiny muted-3">{fmtDate(i.createdAt)}</span>
                  </div>
                </div>
                <button className="btn-icon" title="编辑" onClick={() => { setEditing(i.id); setEditText(i.content); }}><Pencil size={14} /></button>
                <button className="btn-icon danger" onClick={() => store.deleteSummaryIdea(i.id)}><Trash2 size={14} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════ 工作日志 ═══════════ */
function LogsPane({ state, store, toast }: any) {
  const [date, setDate] = useState(todayISO());
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ matter: '', result: '', data: '', issue: '' });

  const dayLogs = state.summaryLogs.filter((l: any) => l.date === date).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));

  const startEdit = (l: any) => { setEditing(l.id); setForm({ matter: l.matter, result: l.result || '', data: l.data || '', issue: l.issue || '' }); };
  const saveEdit = () => {
    if (!editing) return;
    if (!form.matter.trim()) { toast('事项不能为空', 'error'); return; }
    store.updateSummaryLog(editing, { matter: form.matter.trim(), result: form.result, data: form.data, issue: form.issue });
    setEditing(null); toast('日志已更新', 'success');
  };
  const addToday = () => {
    if (!form.matter.trim()) { toast('先填写事项', 'error'); return; }
    store.addSummaryLog({ date, matter: form.matter.trim(), result: form.result, data: form.data, issue: form.issue });
    setForm({ matter: '', result: '', data: '', issue: '' });
    toast('日志已记录', 'success');
  };

  return (
    <div className="grid-2">
      <div className="card">
        <div className="row-between mb12">
          <div className="card-title"><ClipboardList size={16} /> 工作日志</div>
          <div className="row" style={{ gap: 4 }}>
            <button className="btn-icon" onClick={() => setDate(offset(date, -1))}><ChevronLeft size={16} /></button>
            <span className="small bold" style={{ minWidth: 88, textAlign: 'center' }}>{fmtDate(date)}</span>
            <button className="btn-icon" onClick={() => setDate(offset(date, 1))}><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="col" style={{ gap: 10 }}>
          <div className="field"><label className="field-label">事项</label>
            <input className="input" value={form.matter} onChange={e => setForm({ ...form, matter: e.target.value })} placeholder="做了什么" /></div>
          <div className="field"><label className="field-label">结果</label>
            <input className="input" value={form.result} onChange={e => setForm({ ...form, result: e.target.value })} placeholder="结果 / 产出" /></div>
          <div className="row">
            <div className="field grow"><label className="field-label">数据</label>
              <input className="input" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} placeholder="数字指标" /></div>
            <div className="field grow"><label className="field-label">问题</label>
              <input className="input" value={form.issue} onChange={e => setForm({ ...form, issue: e.target.value })} placeholder="踩坑 / 待解决" /></div>
          </div>
          <button className="btn btn-primary" onClick={addToday}><Plus size={15} /> 记录</button>
        </div>
      </div>
      <div className="card">
        <div className="card-title mb12">当日记录 · {fmtDate(date)}</div>
        {dayLogs.length === 0 && <Empty icon={<ClipboardList size={26} />} text="这一天还没有日志" />}
        {dayLogs.map((l: any) => (
          <div className="list-item" key={l.id} style={{ alignItems: 'flex-start' }}>
            {editing === l.id ? (
              <div className="col grow">
                <input className="input" value={form.matter} onChange={e => setForm({ ...form, matter: e.target.value })} />
                <input className="input" value={form.result} onChange={e => setForm({ ...form, result: e.target.value })} placeholder="结果" />
                <div className="row">
                  <button className="btn btn-soft btn-sm" onClick={saveEdit}>保存</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>取消</button>
                </div>
              </div>
            ) : (
              <>
                <div className="list-item-main">
                  <div className="list-item-title" style={{ fontSize: 13.5 }}>{l.matter}</div>
                  {l.result && <div className="list-item-sub">结果：{l.result}</div>}
                  {(l.data || l.issue) && (
                    <div className="row mt8 wrap" style={{ gap: 5 }}>
                      {l.data && <span className="badge badge-accent">数据 {l.data}</span>}
                      {l.issue && <span className="badge badge-amber">问题 {l.issue}</span>}
                    </div>
                  )}
                </div>
                <button className="btn-icon" onClick={() => startEdit(l)}><Pencil size={14} /></button>
                <button className="btn-icon danger" onClick={() => store.deleteSummaryLog(l.id)}><Trash2 size={14} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function offset(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
