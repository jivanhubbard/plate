-- Add water tracking settings to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS water_goal_cups INTEGER DEFAULT 8,
ADD COLUMN IF NOT EXISTS water_serving_oz INTEGER DEFAULT 8;

-- Create water log table
CREATE TABLE IF NOT EXISTS public.water_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  cups INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.water_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for water_log
DROP POLICY IF EXISTS "Users can view own water logs" ON public.water_log;
DROP POLICY IF EXISTS "Users can insert own water logs" ON public.water_log;
DROP POLICY IF EXISTS "Users can update own water logs" ON public.water_log;
DROP POLICY IF EXISTS "Users can delete own water logs" ON public.water_log;

CREATE POLICY "Users can view own water logs" ON public.water_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own water logs" ON public.water_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own water logs" ON public.water_log
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own water logs" ON public.water_log
  FOR DELETE USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_water_log_user_date ON public.water_log(user_id, date);

