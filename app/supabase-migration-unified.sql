-- ============================================================
-- Workbench-Unified 合并应用新增表
-- (FocusDesk 目标追踪 + Summary Desk 内容总结 + 用户设置)
-- 风格与 supabase-migrations.sql 保持一致：客户端生成 TEXT 主键、
-- user_id 外键、synced_at 同步时间戳、逐表 RLS。
-- ============================================================

-- FocusDesk 目标表
CREATE TABLE IF NOT EXISTS fd_goals (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'done')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE
);

-- FocusDesk 任务/灵感表（统一记录模型：fd_type 区分任务与灵感）
CREATE TABLE IF NOT EXISTS fd_tasks (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  goal_id TEXT REFERENCES fd_goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  fd_type TEXT NOT NULL DEFAULT 'task' CHECK (fd_type IN ('task', 'idea')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done', 'idea', 'archived')),
  priority TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  subtasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort BIGINT NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE
);

-- FocusDesk 习惯表（长期打卡）
CREATE TABLE IF NOT EXISTS fd_habits (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  weekdays JSONB NOT NULL DEFAULT '[0,1,2,3,4,5,6]'::jsonb,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE
);

-- FocusDesk 习惯打卡记录表（按日期去重：habit_id + log_date 唯一）
CREATE TABLE IF NOT EXISTS fd_habit_logs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  habit_id TEXT NOT NULL,
  log_date TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE
);

-- Summary Desk 总结记录表（日报/周报/自定义总结生成结果）
CREATE TABLE IF NOT EXISTS summary_docs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'weekly' CHECK (kind IN ('daily', 'weekly', 'custom')),
  template_code TEXT,
  range_start TEXT,
  range_end TEXT,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE
);

-- Summary Desk 灵感库（方向：work/growth/none；tags 为字符串数组）
CREATE TABLE IF NOT EXISTS summary_ideas (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  direction TEXT NOT NULL DEFAULT 'none' CHECK (direction IN ('work', 'growth', 'none')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE
);

-- Summary Desk 工作日志（按 date 维度结构化记录）
CREATE TABLE IF NOT EXISTS summary_logs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date TEXT NOT NULL,
  matter TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL DEFAULT '',
  issue TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE
);

-- 用户设置表（LLM 供应商与 API Key，跨设备同步；仅本人可读写）
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  llm_provider TEXT,
  llm_api_key TEXT,
  llm_model TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_fd_goals_user_id ON fd_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_fd_tasks_user_id ON fd_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_fd_tasks_goal_id ON fd_tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_summary_docs_user_id ON summary_docs(user_id);
CREATE INDEX IF NOT EXISTS idx_summary_ideas_user_id ON summary_ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_summary_logs_user_id ON summary_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_summary_logs_date ON summary_logs(user_id, date);

-- 启用 RLS
ALTER TABLE fd_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE fd_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fd_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE fd_habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE summary_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE summary_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE summary_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS 策略：fd_goals
CREATE POLICY "Users can view their own fd_goals" ON fd_goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own fd_goals" ON fd_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own fd_goals" ON fd_goals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own fd_goals" ON fd_goals
  FOR DELETE USING (auth.uid() = user_id);

-- RLS 策略：fd_tasks
CREATE POLICY "Users can view their own fd_tasks" ON fd_tasks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own fd_tasks" ON fd_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own fd_tasks" ON fd_tasks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own fd_tasks" ON fd_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- RLS 策略：fd_habits
CREATE POLICY "Users can view their own fd_habits" ON fd_habits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own fd_habits" ON fd_habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own fd_habits" ON fd_habits
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own fd_habits" ON fd_habits
  FOR DELETE USING (auth.uid() = user_id);

-- RLS 策略：fd_habit_logs
CREATE POLICY "Users can view their own fd_habit_logs" ON fd_habit_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own fd_habit_logs" ON fd_habit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own fd_habit_logs" ON fd_habit_logs
  FOR DELETE USING (auth.uid() = user_id);

-- RLS 策略：summary_docs
CREATE POLICY "Users can view their own summary_docs" ON summary_docs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own summary_docs" ON summary_docs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own summary_docs" ON summary_docs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own summary_docs" ON summary_docs
  FOR DELETE USING (auth.uid() = user_id);

-- RLS 策略：summary_ideas
CREATE POLICY "Users can view their own summary_ideas" ON summary_ideas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own summary_ideas" ON summary_ideas
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own summary_ideas" ON summary_ideas
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own summary_ideas" ON summary_ideas
  FOR DELETE USING (auth.uid() = user_id);

-- RLS 策略：summary_logs
CREATE POLICY "Users can view their own summary_logs" ON summary_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own summary_logs" ON summary_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own summary_logs" ON summary_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own summary_logs" ON summary_logs
  FOR DELETE USING (auth.uid() = user_id);

-- RLS 策略：user_settings
CREATE POLICY "Users can view their own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own settings" ON user_settings
  FOR DELETE USING (auth.uid() = user_id);
