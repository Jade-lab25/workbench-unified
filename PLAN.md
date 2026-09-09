# Workbench-Unified 第二版规划

> 状态：待确认（用户确认后开始写代码）
> 目标：补齐功能 + 重构体验，PC / 手机双端适配，本地单机 / 云端同步双模式

---

## 一、第一版问题回顾（审查结论）

| # | 严重度 | 问题 |
|---|---|---|
| 1 | 🔴 | `App.tsx` 残留 QA 补丁，硬编码 `setIsAuthenticated(true)`，登录形同虚设 |
| 2 | 🔴 | FocusDesk 丢失「日历 / 数据仪表盘 / 归档区」三视图；SummaryDesk 丢失「灵感库 / 工作日志 / 日历」，6 行业模板只剩 3 个 |
| 3 | 🟠 | 顶部 9 Tab + 底部 8 Tab 双导航并存，命名/顺序不一致 |
| 4 | 🟠 | 内容总结「素材」只存 `useState`，刷新即丢 |
| 5 | 🟡 | `FocusDeskTab.tsx` 渲染时原地 `goals.sort()` 改 props 引用；模板语义错误（「产品研发 D」被误写为「简单日报」） |

---

## 二、三大架构决策

### 1. 导航：统一分组侧边栏
- 桌面端：左侧固定侧边栏，三个可折叠分组
- 移动端：顶部汉堡按钮 → 抽屉侧边栏（复用原 FocusDesk 的 mask + 抽屉交互）
- 结构：

```
┌─────────────┐
│  工作台 Logo │
├─────────────┤
│ ▸ 目标追踪   │ 收集箱 / 今日 / 目标 / 看板 / 日历 / 仪表盘 / 归档区 / 习惯打卡
│ ▸ 工作状态   │ 待办 / 打卡 / 时间记录 / 成就 / 成就商店 / 灵感 / 日历
│ ▸ 内容总结   │ 总结生成 / 灵感库 / 工作日志 / 日历
├─────────────┤
│ 数据同步    │
│ 登录状态    │
└─────────────┘
```

- 删除 `Navigation.tsx` 与 `BottomNavigation.tsx`，统一为一个 `Sidebar` 组件。

### 2. 登录：双模式（本地单机 + 云端同步）
- 移除 QA 硬编码补丁。
- 启动时 `auth.getCurrentUser()` 检测 session：
  - 有 session → 云端模式（`userId` 真实）
  - 无 session → 显示登录页，并增加「本地模式（跳过登录）」入口
- 本地模式：`userId = null`，数据仅存 localStorage，云同步按钮置灰，符合「本地测试通过后再部署公网」。
- 登录后自动 `fetchFromCloud`，退出回到本地模式（保留本地数据）。

### 3. 数据模型扩展（SummaryDesk 补齐 + 持久化）
- 新增 Supabase 表（写入 `supabase-migration-unified.sql`，启用 RLS）：
  - `summary_ideas`：灵感条目（id, text, dir, created_at…）
  - `summary_logs`：工作日志（id, dir, item, data, note, date, created_at…）
- 本地持久化：灵感 / 日志 / 素材全部纳入 `STORAGE_KEY`（`work-status-app-data`）。
- `useSync` 将 `summary_ideas` / `summary_logs` 纳入云同步。

---

## 三、分阶段实施（每阶段可独立验证、独立交付）

| 阶段 | 内容 | 验证点 |
|---|---|---|
| **P1 硬伤修复** | 去 QA 补丁；恢复登录 + 本地模式入口；素材/灵感本地持久化 | 本地 `npm run dev` 跑通、刷新不丢数据 |
| **P2 导航重构** | 分组侧边栏（PC 固定 + 移动抽屉），删双导航 | 双端导航正常、无死链 |
| **P3 FocusDesk 补齐** | 日历视图、数据仪表盘、归档区、习惯统计还原 | 与原版统计口径一致 |
| **P4 SummaryDesk 补齐** | 灵感库、工作日志、日历、8 模板还原、云端持久化 | 与原版功能对等 |
| **P5 同步扩展** | 新表纳入 useSync + 迁移 SQL + 双设备联调 | 换设备上传/下载通过 |

---

## 四、默认假设（如有异议请指出）

1. **历史数据不迁移**：旧 FocusDesk / SummaryDesk 的 localStorage 数据全新开始（沿用既有约定）。
2. **模板还原**：按原版 8 套模板（A 标准职场 / B 简明 / C 销售业务 / D 产品研发 / E OKR 对齐 / F 体制内 / G 标准日报 / H 简洁日报），修正第一版的 D 模板语义错误。
3. **仪表盘口径**：按原版 `computeDashStats` 统计（任务维度、已归档计入完成、不计入逾期）。
4. **视觉风格**：沿用 Achieve-system 的灰白简约风，不引入新设计系统（如需统一视觉，另行排期）。

---

## 五、涉及文件

- 删除：`src/components/Navigation.tsx`、`src/components/BottomNavigation.tsx`
- 新增：`src/components/Sidebar.tsx`、`FocusDeskTab` 内拆出 `FocusCalendar` / `FocusDashboard` / `FocusArchive`；`SummaryDeskTab` 内拆出 `IdeaBoard` / `WorkLog`
- 修改：`App.tsx`（去补丁、双模式、侧边栏接线）、`store/index.ts`、`types/index.ts`、`supabase/database.ts`、`hooks/useSync.ts`、`supabase-migration-unified.sql`
