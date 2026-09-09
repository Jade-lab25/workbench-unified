# Workbench · 个人工作台

将三个个人应用 **合并独立化重写** 为一套统一工作台：

- **Achievement 工作状态**（待办 / 打卡 / 时间 / 成就 / 商店 / 灵感）
- **FocusDesk 目标待办**（目标 / 任务看板 / 习惯打卡）
- **SummaryDesk 内容总结**（素材库 + LLM 生成日报/周报）

技术栈：React 18 + Vite 6 + TypeScript · Supabase（PostgreSQL + RLS）· Vercel 部署。

## 功能（7 个视图）

| 视图 | 内容 |
|---|---|
| 今日 | KPI 聚合：待办 / 目标任务 / 习惯 / 时间 / 快捷记录 |
| 目标 | 目标列表 · 任务看板（P0-P3 优先级）· 子任务拆解 · 习惯热力 |
| 工作 | 待办（秒级计时）· 打卡（不限次数）· 时间 · 成就流水 · 商店 · 灵感 |
| 总结 | LLM 生成日报/周报（4 家供应商 8 套模板）· 素材库 · 生成历史 |
| 日历 | 月视图等高格子：每天成就值 + 待办任务，点击事项直接编辑 |
| 统计 | 完成率 · 优先级分布 · 趋势 · 目标进度 · KPI |
| 设置 | 账号 · 云同步 · LLM 密钥 · 备份导出 |

## 目录结构

```
├── _originals/            # 三个应用合并前的只读存档（不入库）
├── 需求梳理-三合一工作台.md
├── 交付说明-独立化重写.md
└── app/                   # 应用源码（Vercel Root Directory）
    ├── supabase-migrations.sql          # 旧 8 张表（Achieve-system 原样）
    ├── supabase-migration-unified.sql   # 新 8 张表（fd_*/summary_*/user_settings）
    ├── vercel.json                      # SPA rewrite
    └── src/
        ├── store/         # 状态 + 积分规则 + 同步脏标记
        ├── supabase/      # 数据库层（snake/camel 转换、upsert、deleteBatch）
        ├── hooks/useSync.ts  # 云同步协议（is_dirty/synced_at 双字段）
        ├── components/    # Sidebar / AuthScreen / ui
        ├── views/         # 7 个视图
        └── utils/         # dates / llm / stats
```

## 数据库（16 张表，RLS 按 user_id 隔离）

| 来源 | 表 |
|---|---|
| Achieve-system（旧库已有） | todos / check_in_projects / check_in_records / time_records / achievement_logs / shop_items / inspirations / user_stats |
| FocusDesk（新建） | fd_goals / fd_tasks / fd_habits / fd_habit_logs |
| SummaryDesk（新建） | summary_docs / summary_ideas / summary_logs / user_settings |

## 部署

1. **数据库**：Supabase SQL Editor 执行 `app/supabase-migration-unified.sql`（补新 8 表，幂等）
2. **前端**：Vercel 导入本仓库 → Root Directory 设为 `app` → 环境变量 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（见 `.env.example`）
3. **域名**：绑定 自定义域名（已解析到 Vercel，DNS 无需改动）

## 同步机制

本地优先：数据先存 localStorage，登录后按 `is_dirty/synced_at` 双字段与 Supabase 增量对账（upsert onConflict:id，snake/camel 互转，append 型表批量去重，删除走墓碑）。同一账号跨设备自动归并。
