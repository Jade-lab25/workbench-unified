import { useState, useEffect, useMemo } from 'react';
import {
  Settings, FileText, Sparkles, Save, Trash2, Plus, KeyRound, Loader2, X, History,
  Lightbulb, ClipboardList, CalendarDays, ChevronLeft, ChevronRight, RotateCcw, Edit3,
} from 'lucide-react';
import type { SummaryDoc, SummarySource, SummaryIdea, SummaryLog, UserSettings } from '../types';
import { userSettings as userSettingsApi } from '../supabase/database';

// ─── LLM 供应商配置（与原 Summary Desk 保持一致） ───

const PROVIDERS: Record<string, { label: string; endpoint: string; model: string; models: string[] }> = {
  deepseek: {
    label: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  volcengine: {
    label: '火山引擎 Agent Plan',
    endpoint: 'https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions',
    model: 'ark-code-latest',
    models: ['ark-code-latest', 'deepseek-v4-pro', 'glm-5.1', 'doubao-seed-2.0-pro', 'doubao-1.5-pro-32k'],
  },
  openai: {
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-3.5-turbo'],
  },
  zhipu: {
    label: '智谱 GLM',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
    models: ['glm-4-flash', 'glm-4.5'],
  },
  custom: {
    label: '自定义',
    endpoint: '',
    model: '',
    models: [],
  },
};

// ─── 内置模板（8 套，取自原 Summary Desk，已修正 D 模板语义） ───

interface TemplateDef {
  code: string;
  name: string;
  kind: 'daily' | 'weekly';
  markdown: string;
}

const TEMPLATES: TemplateDef[] = [
  {
    code: 'A',
    name: '标准职场',
    kind: 'weekly',
    markdown: `# 本周工作周报

**汇报人：** {姓名}
**部门：** {部门}
**日期：** {周一日期} - {周日日期}

---

## 一、本周工作总结

### 1. 重点项目进展
| 项目 | 本周进展 | 完成度 | 下周计划 |
|------|---------|--------|---------|
| {项目A} | {具体进展} | {百分比}% | {下周动作} |
| {项目B} | {具体进展} | {百分比}% | {下周动作} |

### 2. 日常工作
- {事项1}：{结果}
- {事项2}：{结果}

### 3. 关键数据指标
| 指标 | 上周 | 本周 | 变化 |
|------|------|------|------|
| {指标1} | {值} | {值} | {↑↓百分比} |

---

## 二、问题与风险
| 问题 | 影响范围 | 当前状态 | 需要的支持 |
|------|---------|---------|-----------|
| {问题1} | {范围} | {处理中/已解决} | {需要什么帮助} |

---

## 三、下周工作计划
1. {计划1}（优先级：P0）
2. {计划2}（优先级：P1）
3. {计划3}（优先级：P2）

---

## 四、需要协调的事项
- {跨部门协作需求}
- {资源申请}`,
  },
  {
    code: 'B',
    name: '简明',
    kind: 'weekly',
    markdown: `# 周报 | {姓名} | {日期}

## 做了什么
1. {成果1} → {数据结果}
2. {成果2} → {数据结果}
3. {成果3} → {数据结果}

## 遇到什么问题
- {问题} → {解决方案/需要的帮助}

## 下周做什么
1. {计划1}
2. {计划2}`,
  },
  {
    code: 'C',
    name: '销售业务',
    kind: 'weekly',
    markdown: `# 业务周报

**汇报人：** {姓名}
**周期：** {日期}

---

## 一、业绩概览
| 指标 | 目标 | 实际 | 达成率 |
|------|------|------|--------|
| 新增客户 | {N} | {N} | {%} |
| 成单金额 | ¥{N} | ¥{N} | {%} |
| 跟进线索 | {N} | {N} | {%} |

## 二、重点客户动态
| 客户 | 阶段 | 本周动作 | 下周计划 | 预计签约 |
|------|------|---------|---------|---------|
| {客户A} | {阶段} | {动作} | {计划} | {日期} |

## 三、赢单/输单分析
- 赢单：{客户}，金额 ¥{N}，赢的原因：{关键因素}
- 输单：{客户}，金额 ¥{N}，输的原因：{关键因素}

## 四、下周重点
1. {计划1}
2. {计划2}

## 五、需要支持
- {资源/协调需求}`,
  },
  {
    code: 'D',
    name: '产品研发',
    kind: 'weekly',
    markdown: `# 产品周报 | {产品线} | {日期}

## 一、产品迭代
| 需求/功能 | 状态 | 预计上线 | 备注 |
|----------|------|---------|------|
| {功能A} | 开发中/测试中/已上线 | {日期} | {备注} |

## 二、核心数据
| 指标 | 上周 | 本周 | 环比 |
|------|------|------|------|
| DAU | {N} | {N} | {%} |
| 转化率 | {%} | {%} | {%} |
| 留存率 | {%} | {%} | {%} |

## 三、用户反馈 TOP3
1. {反馈1}（{来源}，{影响人数}）
2. {反馈2}
3. {反馈3}

## 四、下周计划
1. {计划1}（P0）
2. {计划2}（P1）

## 五、风险项
- {风险} → {应对方案}`,
  },
  {
    code: 'E',
    name: 'OKR 对齐',
    kind: 'weekly',
    markdown: `# OKR 周报 | {姓名} | {日期}

## O1: {目标1}
- KR1: {关键结果} — 进度 {N}%（上周 {N}%）
  - 本周动作：{具体行动}
  - 阻塞项：{如有}
- KR2: {关键结果} — 进度 {N}%
  - 本周动作：{具体行动}

## O2: {目标2}
- KR1: {关键结果} — 进度 {N}%
  - 本周动作：{具体行动}

## 信心指数
| OKR | 上周信心 | 本周信心 | 变化原因 |
|-----|---------|---------|---------|
| O1 | {N}/10 | {N}/10 | {原因} |

## 下周聚焦
1. {最重要的1件事}`,
  },
  {
    code: 'F',
    name: '体制内',
    kind: 'weekly',
    markdown: `# 关于{部门}{时间段}工作情况的汇报

{姓名}
{日期}

一、本周主要工作完成情况

（一）{类别一}
1. {事项}。{具体做法和成效}。
2. {事项}。{具体做法和成效}。

（二）{类别二}
1. {事项}。{具体做法和成效}。

二、存在的主要问题

1. {问题}。{原因分析}。
2. {问题}。{原因分析}。

三、下周工作安排

1. {安排}。
2. {安排}。

四、意见建议

1. {建议}。`,
  },
  {
    code: 'G',
    name: '标准日报',
    kind: 'daily',
    markdown: `# 日报 | {姓名} | {日期}

**部门：** {部门}

## 一、今日完成

### 1. 重点工作
- {事项1}：{结果}
- {事项2}：{结果}

### 2. 关键数据
| 指标 | 目标 | 实际 |
|------|------|------|
| {指标1} | {值} | {值} |

## 二、问题与风险
- {问题} → {应对方案/需要的支持}

## 三、明日计划
1. {计划1}（优先级：P0）
2. {计划2}（优先级：P1）`,
  },
  {
    code: 'H',
    name: '简洁日报',
    kind: 'daily',
    markdown: `# 日报 | {姓名} | {日期}

## 今日完成
1. {成果1} → {数据结果}
2. {成果2} → {数据结果}

## 遇到的问题
- {问题} → {解决方案/需要的帮助}

## 明日计划
1. {计划1}
2. {计划2}`,
  },
];

const POLISH_GUIDE = [
  '1. 只使用素材中出现的信息，绝不编造数据或事实；',
  '2. 尽量量化：数字、百分比、对比变化优先呈现；',
  '3. 动词开头、短句为主，删除空话套话；',
  '4. 保持模板的 Markdown 结构，用素材内容填充 {占位符}；无法填充的占位符整行删除；',
  '5. 语言风格：客观、专业、数据导向。',
].join('\n');

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekRange(): { start: string; end: string } {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(monday), end: fmt(sunday) };
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO 时间戳 → 本地 'YYYY-MM-DD' */
function localDateFromIso(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return toISODate(d);
}

/** 从文本提取 #标签（含 # 前缀） */
function parseTags(text: string): string[] {
  const tags: string[] = [];
  const re = /#(\S+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const tag = '#' + m[1];
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

/** 月视图网格：返回当月各日 ISO 字符串，前面补 null 对齐周一 */
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

// ─── 组件 ───

interface SummaryDeskTabProps {
  docs: SummaryDoc[];
  ideas: SummaryIdea[];
  logs: SummaryLog[];
  settings: UserSettings;
  userId: string | null;
  onSaveSettings: (settings: UserSettings) => void;
  onAddDoc: (doc: Omit<SummaryDoc, 'id' | 'createdAt' | 'synced_at' | 'syncedAt' | 'is_dirty' | 'isDirty'>) => void;
  onDeleteDoc: (id: string) => void;
  onAddIdea: (content: string, direction?: SummaryIdea['direction'], tags?: string[]) => void;
  onUpdateIdea: (id: string, updates: Partial<SummaryIdea>) => void;
  onDeleteIdea: (id: string) => void;
  onAddLog: (log: { date: string; matter: string; result?: string; data?: string; issue?: string }) => void;
  onUpdateLog: (id: string, updates: Partial<SummaryLog>) => void;
  onDeleteLog: (id: string) => void;
}

type RangeKind = 'daily' | 'weekly' | 'custom';
type SubTab = 'summary' | 'idea' | 'log' | 'calendar';

// ─── 素材库本地持久化（按用户隔离，本地模式用 'local'） ───

const SOURCES_STORAGE_PREFIX = 'summary-sources';

function loadSources(userId: string | null): SummarySource[] {
  try {
    const key = `${SOURCES_STORAGE_PREFIX}-${userId || 'local'}`;
    const saved = localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSources(userId: string | null, sources: SummarySource[]) {
  try {
    const key = `${SOURCES_STORAGE_PREFIX}-${userId || 'local'}`;
    localStorage.setItem(key, JSON.stringify(sources));
  } catch (e) {
    console.error('Failed to save sources:', e);
  }
}

function uidLocal(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function SummaryDeskTab(props: SummaryDeskTabProps) {
  const {
    docs, ideas, logs, settings, userId,
    onSaveSettings, onAddDoc, onDeleteDoc,
    onAddIdea, onUpdateIdea, onDeleteIdea,
    onAddLog, onUpdateLog, onDeleteLog,
  } = props;

  // ─── 子页签 ───
  const [subTab, setSubTab] = useState<SubTab>('summary');

  // ─── API 设置 ───
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider] = useState(settings.llmProvider || 'deepseek');
  const [apiKey, setApiKey] = useState(settings.llmApiKey || '');
  const [model, setModel] = useState(settings.llmModel || '');
  const [customEndpoint, setCustomEndpoint] = useState('');

  // ─── 总结生成 ───
  const [rangeKind, setRangeKind] = useState<RangeKind>('weekly');
  const [templateCode, setTemplateCode] = useState('A');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  const [sourceText, setSourceText] = useState('');
  const [sourceDir, setSourceDir] = useState<'work' | 'growth'>('work');
  const [sourceDate, setSourceDate] = useState(todayISO());
  const [sources, setSources] = useState<SummarySource[]>(() => loadSources(userId));

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [viewDoc, setViewDoc] = useState<SummaryDoc | null>(null);
  const [savedTip, setSavedTip] = useState('');

  // ─── 灵感库 ───
  const [ideaInput, setIdeaInput] = useState('');
  const [ideaDir, setIdeaDir] = useState<'work' | 'growth'>('work');
  const [ideaFilter, setIdeaFilter] = useState<'' | 'work' | 'growth'>('');
  const [ideaTag, setIdeaTag] = useState<string | null>(null);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);

  // ─── 工作日志 ───
  const [logDate, setLogDate] = useState(todayISO());
  const [logMatter, setLogMatter] = useState('');
  const [logResult, setLogResult] = useState('');
  const [logData, setLogData] = useState('');
  const [logIssue, setLogIssue] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // ─── 日历 ───
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calSelected, setCalSelected] = useState<string | null>(null);

  // 首次渲染同步云端已有配置
  useEffect(() => {
    setProvider(settings.llmProvider || 'deepseek');
    setApiKey(settings.llmApiKey || '');
    setModel(settings.llmModel || '');
  }, [settings]);

  // 素材库：userId 变化时重新加载对应用户的素材
  useEffect(() => {
    setSources(loadSources(userId));
  }, [userId]);

  // 素材库：变化时持久化到本地，刷新不丢
  useEffect(() => {
    saveSources(userId, sources);
  }, [userId, sources]);

  useEffect(() => {
    const wk = weekRange();
    if (rangeKind === 'daily') {
      setRangeStart(todayISO());
      setRangeEnd(todayISO());
    } else if (rangeKind === 'weekly') {
      setRangeStart(wk.start);
      setRangeEnd(wk.end);
    } else if (!rangeStart) {
      setRangeStart(wk.start);
      setRangeEnd(todayISO());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKind]);

  const activeTemplate = useMemo(
    () => TEMPLATES.find(t => t.code === templateCode) || TEMPLATES[0],
    [templateCode]
  );

  const kindLabel = rangeKind === 'daily' ? '日报' : rangeKind === 'weekly' ? '周报' : '总结';
  const workSources = sources.filter(s => s.dir !== 'growth');
  const growthSources = sources.filter(s => s.dir === 'growth');

  const handleSaveSettings = async () => {
    const next: UserSettings = { llmProvider: provider, llmApiKey: apiKey, llmModel: model };
    onSaveSettings(next);
    if (userId) {
      const { error } = await userSettingsApi.upsert(userId, next);
      setSavedTip(error ? `保存失败: ${error.message}` : '设置已保存（云端同步，换设备免重输）');
    } else {
      setSavedTip('设置已保存到本地');
    }
    setTimeout(() => setSavedTip(''), 3000);
  };

  const handleAddSource = () => {
    const text = sourceText.trim();
    if (!text) return;
    setSources(prev => [...prev, { id: uidLocal(), text, dir: sourceDir, date: sourceDate }]);
    setSourceText('');
  };

  // ─── 灵感库操作 ───
  const submitIdea = () => {
    const text = ideaInput.trim();
    if (!text) return;
    const tags = parseTags(text);
    if (editingIdeaId) {
      onUpdateIdea(editingIdeaId, { content: text, tags, direction: ideaDir });
      setEditingIdeaId(null);
    } else {
      onAddIdea(text, ideaDir, tags);
    }
    setIdeaInput('');
  };

  const startEditIdea = (idea: SummaryIdea) => {
    setEditingIdeaId(idea.id);
    setIdeaInput(idea.content);
    setIdeaDir(idea.direction === 'growth' ? 'growth' : 'work');
  };

  const ideaToLog = (idea: SummaryIdea) => {
    const matter = idea.content.split('\n')[0].slice(0, 50);
    const rest = idea.content.length > matter.length ? idea.content.slice(matter.length).trim().slice(0, 80) : '';
    setSubTab('log');
    setLogDate(todayISO());
    setLogMatter(matter);
    setLogResult(rest);
    setLogData('');
    setLogIssue('');
    setEditingLogId(null);
  };

  const ideaToSource = (idea: SummaryIdea) => {
    setSources(prev => [...prev, {
      id: uidLocal(),
      text: idea.content,
      dir: idea.direction === 'growth' ? 'growth' : 'work',
      date: localDateFromIso(idea.createdAt) || todayISO(),
    }]);
    setSubTab('summary');
  };

  // ─── 工作日志操作 ───
  const saveLog = () => {
    const matter = logMatter.trim();
    if (!matter) return;
    if (editingLogId) {
      onUpdateLog(editingLogId, { date: logDate, matter, result: logResult, data: logData, issue: logIssue });
      setEditingLogId(null);
    } else {
      onAddLog({ date: logDate, matter, result: logResult, data: logData, issue: logIssue });
    }
    setLogMatter('');
    setLogResult('');
    setLogData('');
    setLogIssue('');
  };

  const startEditLog = (log: SummaryLog) => {
    setEditingLogId(log.id);
    setLogMatter(log.matter);
    setLogResult(log.result || '');
    setLogData(log.data || '');
    setLogIssue(log.issue || '');
  };

  const changeLogDate = (delta: number) => {
    const d = new Date(logDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setLogDate(toISODate(d));
  };

  // 汇总范围内日志 + 灵感 + 素材，供生成使用
  const gatherRangeMaterial = (start: string, end: string) => {
    const work: string[] = [];
    const growth: string[] = [];
    logs.filter(l => l.date >= start && l.date <= end).forEach(l => {
      work.push(`【日志·${l.date}】事项：${l.matter}${l.result ? `\n结果：${l.result}` : ''}${l.data ? `\n数据：${l.data}` : ''}${l.issue ? `\n问题：${l.issue}` : ''}`);
    });
    ideas.filter(i => {
      const d = localDateFromIso(i.createdAt);
      return d >= start && d <= end;
    }).forEach(i => {
      const dirLabel = i.direction === 'growth' ? '个人成长' : '工作';
      const text = `【灵感·${dirLabel}】${i.content}`;
      if (i.direction === 'growth') growth.push(text);
      else work.push(text);
    });
    sources.filter(s => s.date >= start && s.date <= end).forEach(s => {
      const dirLabel = s.dir === 'growth' ? '个人成长' : '工作';
      const text = `【素材·${dirLabel}】${s.text}`;
      if (s.dir === 'growth') growth.push(text);
      else work.push(text);
    });
    return { work, growth };
  };

  const handleGenerate = async () => {
    setErrorMsg('');
    setResult('');
    const key = apiKey.trim();
    if (!key) {
      setErrorMsg('请先在「API 设置」中填写 API Key');
      setShowSettings(true);
      return;
    }
    const { work: materialWork, growth: materialGrowth } = gatherRangeMaterial(rangeStart, rangeEnd);
    if (!materialWork.length && !materialGrowth.length) {
      setErrorMsg('该时间范围内没有日志、灵感或素材，请先补充内容');
      return;
    }

    const prov = PROVIDERS[provider] || PROVIDERS.deepseek;
    const endpoint = provider === 'custom' ? customEndpoint.trim() : prov.endpoint;
    const modelToUse = model.trim() || prov.model;
    if (!endpoint) {
      setErrorMsg('自定义供应商必须填写 API 端点');
      setShowSettings(true);
      return;
    }

    const systemPrompt =
      `你是一位专业的职场写作助手，擅长根据工作素材生成结构清晰、数据导向的${kindLabel}。\n\n` +
      `【写作原则】\n${POLISH_GUIDE}\n\n` +
      `【模板格式】\n请严格遵循以下模板结构，用素材内容填充对应位置：\n\n${activeTemplate.markdown}\n`;

    let userPrompt =
      `【时间范围】${rangeStart}${rangeStart !== rangeEnd ? ' ~ ' + rangeEnd : ''}\n\n` +
      `【以下素材用于生成${kindLabel}的工作内容部分】：\n\n${materialWork.join('\n\n')}\n\n`;
    if (materialGrowth.length) {
      userPrompt +=
        `【以下素材用于生成${kindLabel}的个人成长部分】：\n\n${materialGrowth.join('\n\n')}\n\n` +
        `要求：\n1. 严格按照模板格式输出完整 Markdown\n2. 从素材中提取信息，不要编造没有的内容\n`;
    }

    setGenerating(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      const url = endpoint.includes('/chat/completions') ? endpoint : endpoint.replace(/\/+$/, '') + '/v1/chat/completions';
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.4,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`API 返回 ${resp.status}：${errText.slice(0, 300)}`);
      }
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('API 未返回内容');
      setResult(content);
    } catch (e) {
      const err = e as Error;
      setErrorMsg(err.name === 'AbortError' ? '请求超时（60 秒），请检查网络或换更快的模型' : `生成失败：${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDoc = () => {
    if (!result) return;
    onAddDoc({
      title: `${kindLabel} ${rangeStart}${rangeStart !== rangeEnd ? '~' + rangeEnd : ''}`,
      kind: rangeKind,
      templateCode: activeTemplate.code,
      rangeStart,
      rangeEnd,
      sources,
      summary: result,
      provider,
      model: model.trim() || PROVIDERS[provider]?.model || '',
    });
    setSavedTip(userId ? '已保存到云端' : '已保存到本地');
    setTimeout(() => setSavedTip(''), 3000);
  };

  const currentModels = PROVIDERS[provider]?.models || [];
  const noKey = !apiKey.trim();

  // ─── 派生数据 ───
  const today = todayISO();

  const allIdeaTags = useMemo(() => {
    const map: Record<string, number> = {};
    ideas.forEach(i => (i.tags || []).forEach(t => { map[t] = (map[t] || 0) + 1; }));
    return Object.keys(map).sort();
  }, [ideas]);

  const filteredIdeas = useMemo(() => {
    return ideas
      .filter(i => !ideaFilter || i.direction === ideaFilter)
      .filter(i => !ideaTag || (i.tags || []).includes(ideaTag));
  }, [ideas, ideaFilter, ideaTag]);

  const logsOfDay = useMemo(() => {
    return logs.filter(l => l.date === logDate);
  }, [logs, logDate]);

  const calCounts = useMemo(() => {
    const map: Record<string, { log: number; idea: number; material: number; total: number }> = {};
    const bump = (date: string, type: 'log' | 'idea' | 'material') => {
      if (!date) return;
      if (!map[date]) map[date] = { log: 0, idea: 0, material: 0, total: 0 };
      map[date][type]++;
      map[date].total++;
    };
    logs.forEach(l => bump(l.date, 'log'));
    ideas.forEach(i => bump(localDateFromIso(i.createdAt), 'idea'));
    sources.forEach(s => bump(s.date, 'material'));
    return map;
  }, [logs, ideas, sources]);

  const calDetail = useMemo(() => {
    if (!calSelected) return null;
    const dayLogs = logs.filter(l => l.date === calSelected);
    const dayIdeas = ideas.filter(i => localDateFromIso(i.createdAt) === calSelected);
    const daySources = sources.filter(s => s.date === calSelected);
    return { logs: dayLogs, ideas: dayIdeas, sources: daySources };
  }, [calSelected, logs, ideas, sources]);

  const logDateLabel = useMemo(() => {
    const diff = Math.round((new Date(logDate + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000);
    if (diff === 0) return '今天 · ' + logDate;
    if (diff === -1) return '昨天 · ' + logDate;
    if (diff === 1) return '明天 · ' + logDate;
    return logDate;
  }, [logDate, today]);

  const subTabs: { id: SubTab; icon: typeof Settings; label: string; count?: number }[] = [
    { id: 'summary', icon: Sparkles, label: '总结生成', count: docs.length },
    { id: 'idea', icon: Lightbulb, label: '灵感库', count: ideas.length },
    { id: 'log', icon: ClipboardList, label: '工作日志', count: logs.length },
    { id: 'calendar', icon: CalendarDays, label: '日历' },
  ];

  return (
    <div className="space-y-4">
      {/* 子页签切换 */}
      <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 overflow-x-auto">
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs md:text-sm font-medium whitespace-nowrap transition-colors ${
              subTab === t.id ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <t.icon size={14} />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`px-1.5 rounded-full text-[10px] ${subTab === t.id ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-100 text-gray-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════ 总结生成 ══════════ */}
      {subTab === 'summary' && (
        <div className="space-y-4">
          {/* 工具栏 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                noKey ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {noKey ? <KeyRound size={14} /> : <Settings size={14} />}
              {noKey ? 'API 设置（未配置）' : 'API 设置'}
            </button>
            <select value={rangeKind} onChange={e => setRangeKind(e.target.value as RangeKind)}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white">
              <option value="daily">日报</option>
              <option value="weekly">周报</option>
              <option value="custom">自定义总结</option>
            </select>
            <select value={templateCode} onChange={e => setTemplateCode(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white">
              {TEMPLATES.filter(t => rangeKind === 'custom' || t.kind === rangeKind).map(t => (
                <option key={t.code} value={t.code}>{t.code} · {t.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 text-sm">
              <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-gray-200" />
              <span className="text-gray-400">~</span>
              <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-gray-200" />
            </div>
          </div>

          {/* API 设置面板 */}
          {showSettings && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-700">LLM API 设置</h4>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <label className="space-y-1">
                  <span className="text-xs text-gray-500">供应商</span>
                  <select value={provider} onChange={e => { setProvider(e.target.value); setModel(PROVIDERS[e.target.value]?.model || ''); }}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5">
                    {Object.entries(PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-500">模型</span>
                  <input value={model} onChange={e => setModel(e.target.value)} list="sd-model-list"
                    placeholder={PROVIDERS[provider]?.model || '输入模型名'}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5" />
                  <datalist id="sd-model-list">
                    {currentModels.map(m => <option key={m} value={m} />)}
                  </datalist>
                </label>
                {provider === 'custom' && (
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs text-gray-500">自定义端点（支持裸 base URL，自动补 /v1/chat/completions）</span>
                    <input value={customEndpoint} onChange={e => setCustomEndpoint(e.target.value)}
                      placeholder="https://api.example.com/v1/chat/completions"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5" />
                  </label>
                )}
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs text-gray-500">API Key（保存到你的 Supabase，仅本人可见；换设备登录后自动带上）</span>
                  <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 font-mono" />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleSaveSettings} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1">
                  <Save size={13} /> 保存设置
                </button>
                {savedTip && <span className="text-xs text-green-600">{savedTip}</span>}
              </div>
            </div>
          )}

          {/* 素材录入 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <FileText size={14} /> 素材库
              <span className="text-xs font-normal text-gray-400">（工作 {workSources.length} 条 · 成长 {growthSources.length} 条）</span>
            </h4>
            <div className="flex flex-wrap gap-2 text-sm">
              <select value={sourceDir} onChange={e => setSourceDir(e.target.value as 'work' | 'growth')}
                className="border border-gray-200 rounded-lg px-2 py-1.5">
                <option value="work">工作素材</option>
                <option value="growth">个人成长</option>
              </select>
              <input type="date" value={sourceDate} onChange={e => setSourceDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5" />
            </div>
            <textarea
              value={sourceText}
              onChange={e => setSourceText(e.target.value)}
              rows={3}
              placeholder={'粘贴今天/本周做过的 raw 素材：项目进展、数据、沟通结论、踩坑记录…支持多段'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button onClick={handleAddSource} className="px-3 py-1.5 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 flex items-center gap-1">
              <Plus size={13} /> 添加素材
            </button>
            {sources.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {sources.map(s => (
                  <div key={s.id} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${
                      s.dir === 'growth' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {s.dir === 'growth' ? '成长' : '工作'}
                    </span>
                    <span className="text-xs text-gray-500 flex-shrink-0 mt-0.5">{s.date}</span>
                    <p className="text-xs text-gray-700 flex-1 line-clamp-2 whitespace-pre-wrap">{s.text}</p>
                    <button onClick={() => setSources(prev => prev.filter(x => x.id !== s.id))}
                      className="text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 生成 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Sparkles size={14} /> 生成{kindLabel}
                <span className="text-xs font-normal text-gray-400">模板：{activeTemplate.code} · {activeTemplate.name}</span>
              </h4>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {generating ? '生成中…' : '生成'}
              </button>
            </div>
            {errorMsg && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</div>}
            {result && (
              <>
                <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 rounded-lg p-4 max-h-[420px] overflow-y-auto font-sans">{result}</pre>
                <button onClick={handleSaveDoc} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-1">
                  <Save size={13} /> 保存到{userId ? '云端' : '本地'}
                </button>
              </>
            )}
            {savedTip && !showSettings && <span className="text-xs text-green-600">{savedTip}</span>}
          </div>

          {/* 历史记录 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
              <History size={14} /> 历史报告（{docs.length}）
            </h4>
            {docs.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                还没有生成记录
              </div>
            ) : (
              <div className="space-y-1.5">
                {docs.map(d => (
                  <div key={d.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <button onClick={() => setViewDoc(d)} className="flex-1 text-left min-w-0">
                      <span className="text-sm text-gray-800 truncate block">{d.title}</span>
                      <span className="text-[10px] text-gray-400">{d.provider} · {d.model} · {new Date(d.createdAt).toLocaleString('zh-CN')}</span>
                    </button>
                    <button onClick={() => onDeleteDoc(d.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ 灵感库 ══════════ */}
      {subTab === 'idea' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Lightbulb size={14} /> {editingIdeaId ? '编辑灵感' : '记录灵感'}
              {editingIdeaId && (
                <button onClick={() => { setEditingIdeaId(null); setIdeaInput(''); }} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
              )}
            </h4>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setIdeaDir('work')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${ideaDir === 'work' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'border-gray-200 text-gray-500'}`}>
                工作
              </button>
              <button onClick={() => setIdeaDir('growth')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${ideaDir === 'growth' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'border-gray-200 text-gray-500'}`}>
                个人成长
              </button>
            </div>
            <textarea
              value={ideaInput}
              onChange={e => setIdeaInput(e.target.value)}
              rows={3}
              placeholder="随手记录灵感、想法、碎片思考… 用 #标签 可自动归类"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            <button onClick={submitIdea} className="px-4 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 flex items-center gap-1">
              <Plus size={13} /> {editingIdeaId ? '保存修改' : '记录'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setIdeaFilter('')}
              className={`px-2.5 py-1 rounded-md text-xs ${ideaFilter === '' ? 'bg-gray-200 text-gray-800 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
              全部（{ideas.length}）
            </button>
            <button onClick={() => setIdeaFilter('work')}
              className={`px-2.5 py-1 rounded-md text-xs ${ideaFilter === 'work' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
              工作
            </button>
            <button onClick={() => setIdeaFilter('growth')}
              className={`px-2.5 py-1 rounded-md text-xs ${ideaFilter === 'growth' ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
              个人成长
            </button>
            <span className="w-px h-4 bg-gray-200" />
            {allIdeaTags.map(t => (
              <button key={t} onClick={() => setIdeaTag(ideaTag === t ? null : t)}
                className={`px-2.5 py-1 rounded-md text-xs ${ideaTag === t ? 'bg-amber-100 text-amber-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>
                {t}
              </button>
            ))}
          </div>

          {filteredIdeas.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              还没有灵感记录
            </div>
          ) : (
            <div className="space-y-2">
              {filteredIdeas.map(i => (
                <div key={i.id} className="bg-white rounded-lg border border-gray-200 p-3">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{i.content}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[10px] text-gray-400">🕒 {new Date(i.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      i.direction === 'growth' ? 'bg-purple-100 text-purple-600' : i.direction === 'work' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {i.direction === 'growth' ? '个人成长' : i.direction === 'work' ? '工作' : '未分类'}
                    </span>
                    {(i.tags || []).map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">{t}</span>)}
                    <span className="flex-1" />
                    <button onClick={() => startEditIdea(i)} className="text-[11px] text-gray-400 hover:text-blue-500 flex items-center gap-0.5"><Edit3 size={11} /> 修改</button>
                    <button onClick={() => ideaToLog(i)} className="text-[11px] text-gray-400 hover:text-indigo-500">转日志</button>
                    <button onClick={() => ideaToSource(i)} className="text-[11px] text-gray-400 hover:text-green-500">转素材</button>
                    <button onClick={() => { if (confirm('确定删除这条灵感？')) onDeleteIdea(i.id); }} className="text-[11px] text-gray-300 hover:text-red-500">删除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ 工作日志 ══════════ */}
      {subTab === 'log' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <ClipboardList size={14} /> {editingLogId ? '编辑日志' : '记录工作日志'}
              </h4>
              <div className="flex items-center gap-1">
                <button onClick={() => changeLogDate(-1)} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"><ChevronLeft size={16} /></button>
                <button onClick={() => setLogDate(todayISO())} className="text-xs text-gray-600 px-2 py-1 rounded-md hover:bg-gray-100">{logDateLabel}</button>
                <button onClick={() => changeLogDate(1)} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"><ChevronRight size={16} /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <input value={logMatter} onChange={e => setLogMatter(e.target.value)} placeholder="事项（必填），如：完成影刀流程 Python 迁移"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input value={logResult} onChange={e => setLogResult(e.target.value)} placeholder="结果"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input value={logData} onChange={e => setLogData(e.target.value)} placeholder="数据"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input value={logIssue} onChange={e => setLogIssue(e.target.value)} placeholder="问题"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={saveLog} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-1">
                <Save size={13} /> {editingLogId ? '保存修改' : '记录'}
              </button>
              {editingLogId && (
                <button onClick={() => { setEditingLogId(null); setLogMatter(''); setLogResult(''); setLogData(''); setLogIssue(''); }}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">取消</button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">当天记录（{logsOfDay.length}）</h4>
            {logsOfDay.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                当天还没有工作记录
              </div>
            ) : (
              <div className="space-y-2">
                {logsOfDay.map(l => (
                  <div key={l.id} className="bg-gray-50 rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800">{l.matter}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => startEditLog(l)} className="text-gray-400 hover:text-blue-500"><Edit3 size={13} /></button>
                        <button onClick={() => { if (confirm('确定删除这条记录？')) onDeleteLog(l.id); }} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                      {l.result && <div><span className="text-gray-400">结果：</span>{l.result}</div>}
                      {l.data && <div><span className="text-gray-400">数据：</span>{l.data}</div>}
                      {l.issue && <div><span className="text-gray-400">问题：</span>{l.issue}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ 日历 ══════════ */}
      {subTab === 'calendar' && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"><ChevronLeft size={16} /></button>
              <span className="text-sm font-semibold text-gray-800 min-w-[90px] text-center">{calYear}年{calMonth + 1}月</span>
              <button
                onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"><ChevronRight size={16} /></button>
              <button onClick={() => { const n = new Date(); setCalYear(n.getFullYear()); setCalMonth(n.getMonth()); }}
                className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100"><RotateCcw size={14} /></button>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400" />日志</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />灵感</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />素材</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {['一', '二', '三', '四', '五', '六', '日'].map((w, i) => (
              <div key={i} className="text-center text-xs text-gray-400 py-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthGrid(calYear, calMonth).map((iso, i) => {
              if (!iso) return <div key={`pad-${i}`} />;
              const c = calCounts[iso];
              const isToday = iso === today;
              const isSel = calSelected === iso;
              return (
                <button
                  key={iso}
                  onClick={() => setCalSelected(isSel ? null : iso)}
                  className={`min-h-[56px] rounded-md border p-1.5 text-xs flex flex-col items-center justify-start gap-1 transition-colors ${
                    isSel ? 'border-indigo-400 bg-indigo-50' : isToday ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <span className={`${isToday ? 'font-bold text-blue-600' : 'text-gray-500'}`}>{Number(iso.slice(8, 10))}</span>
                  {c && c.total > 0 && (
                    <div className="flex items-center gap-0.5">
                      {c.log > 0 && <span className="w-2 h-2 rounded-full bg-indigo-400" title={`日志 ${c.log}`} />}
                      {c.idea > 0 && <span className="w-2 h-2 rounded-full bg-amber-400" title={`灵感 ${c.idea}`} />}
                      {c.material > 0 && <span className="w-2 h-2 rounded-full bg-blue-400" title={`素材 ${c.material}`} />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* 日期详情 */}
          {calDetail && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <div className="text-xs font-semibold text-gray-600 mb-2">
                {calSelected} · 共 {calDetail.logs.length + calDetail.ideas.length + calDetail.sources.length} 条记录
              </div>
              <div className="space-y-2">
                {calDetail.logs.map(l => (
                  <div key={l.id} className="text-xs text-gray-700 bg-indigo-50 rounded-lg px-3 py-2">
                    <b>📋 {l.matter}</b>{l.result ? ` · ${l.result}` : ''}
                  </div>
                ))}
                {calDetail.ideas.map(i => (
                  <div key={i.id} className="text-xs text-gray-700 bg-amber-50 rounded-lg px-3 py-2">
                    💡 {i.content.slice(0, 60)}
                  </div>
                ))}
                {calDetail.sources.map(s => (
                  <div key={s.id} className="text-xs text-gray-700 bg-blue-50 rounded-lg px-3 py-2">
                    📦 {s.text.slice(0, 60)}
                  </div>
                ))}
                {calDetail.logs.length + calDetail.ideas.length + calDetail.sources.length === 0 && (
                  <div className="text-xs text-gray-400">当天没有记录</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 查看历史文档 */}
      {viewDoc && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setViewDoc(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">{viewDoc.title}</h3>
              <button onClick={() => setViewDoc(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-800 p-4 overflow-y-auto font-sans">{viewDoc.summary}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
