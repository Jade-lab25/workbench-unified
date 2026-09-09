/* LLM 供应商 + 8 套模板 + 生成调用（提取自原 Summary Desk，D 模板已修正） */

export interface ProviderDef {
  label: string;
  endpoint: string;
  model: string;
  models: string[];
}

export const PROVIDERS: Record<string, ProviderDef> = {
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

export interface TemplateDef {
  code: string;
  name: string;
  kind: 'daily' | 'weekly';
  markdown: string;
}

export const TEMPLATES: TemplateDef[] = [
  {
    code: 'A', name: '标准职场', kind: 'weekly',
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
    code: 'B', name: '简明', kind: 'weekly',
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
    code: 'C', name: '销售业务', kind: 'weekly',
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
    code: 'D', name: '产品研发', kind: 'weekly',
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
    code: 'E', name: 'OKR 对齐', kind: 'weekly',
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
    code: 'F', name: '体制内', kind: 'weekly',
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
    code: 'G', name: '标准日报', kind: 'daily',
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
    code: 'H', name: '简洁日报', kind: 'daily',
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

export const POLISH_GUIDE = [
  '1. 只使用素材中出现的信息，绝不编造数据或事实；',
  '2. 尽量量化：数字、百分比、对比变化优先呈现；',
  '3. 动词开头、短句为主，删除空话套话；',
  '4. 保持模板的 Markdown 结构，用素材内容填充 {占位符}；无法填充的占位符整行删除；',
  '5. 语言风格：客观、专业、数据导向。',
].join('\n');

export interface GenerateOptions {
  provider: string;
  apiKey: string;
  model: string;
  customEndpoint?: string;
  kindLabel: string;
  templateMarkdown: string;
  workMaterial: string[];
  growthMaterial: string[];
  rangeStart: string;
  rangeEnd: string;
  timeoutMs?: number;
}

/** 调用 OpenAI 兼容接口生成总结（浏览器直连，60s 超时） */
export async function generateWithLLM(opts: GenerateOptions): Promise<string> {
  const prov = PROVIDERS[opts.provider] || PROVIDERS.deepseek;
  const endpoint = opts.provider === 'custom' ? (opts.customEndpoint || '').trim() : prov.endpoint;
  if (!endpoint) throw new Error('自定义供应商必须填写 API 端点');
  if (!opts.apiKey.trim()) throw new Error('请先填写 API Key');

  const modelToUse = opts.model.trim() || prov.model;
  const systemPrompt =
    `你是一位专业的职场写作助手，擅长根据工作素材生成结构清晰、数据导向的${opts.kindLabel}。\n\n` +
    `【写作原则】\n${POLISH_GUIDE}\n\n` +
    `【模板格式】\n请严格遵循以下模板结构，用素材内容填充对应位置：\n\n${opts.templateMarkdown}\n`;

  let userPrompt =
    `【时间范围】${opts.rangeStart}${opts.rangeStart !== opts.rangeEnd ? ' ~ ' + opts.rangeEnd : ''}\n\n` +
    `【以下素材用于生成${opts.kindLabel}的工作内容部分】：\n\n${opts.workMaterial.join('\n\n')}\n\n`;
  if (opts.growthMaterial.length) {
    userPrompt +=
      `【以下素材用于生成${opts.kindLabel}的个人成长部分】：\n\n${opts.growthMaterial.join('\n\n')}\n\n` +
      `要求：\n1. 严格按照模板格式输出完整 Markdown\n2. 从素材中提取信息，不要编造没有的内容\n`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 60000);
  const url = endpoint.includes('/chat/completions') ? endpoint : endpoint.replace(/\/+$/, '') + '/v1/chat/completions';
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${opts.apiKey}` },
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
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`API 返回 ${resp.status}：${errText.slice(0, 300)}`);
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('API 未返回内容');
    return content;
  } catch (e) {
    const err = e as Error;
    if (err.name === 'AbortError') throw new Error('请求超时（60 秒），请检查网络或换更快的模型');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
