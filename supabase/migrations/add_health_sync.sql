-- Apple Health sync: daily health summaries pushed from the iPhone app, and
-- a per-device record of when each device last synced.
--
-- Requires add_workouts_and_insights.sql (workouts table) and the
-- update_updated_at_column() function from schema.sql.

CREATE TABLE IF NOT EXISTS public.health_daily_metrics (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  steps INTEGER,
  active_energy_kcal DECIMAL(10,2),
  resting_heart_rate DECIMAL(6,2),
  hrv_sdnn_ms DECIMAL(8,2),
  sleep_asleep_minutes DECIMAL(8,2),
  sleep_start TIMESTAMP WITH TIME ZONE,
  sleep_end TIMESTAMP WITH TIME ZONE,
  weight_kg DECIMAL(7,3),
  body_fat_percentage DECIMAL(5,4),
  time_zone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date),
  CONSTRAINT health_daily_metrics_steps_check CHECK (steps IS NULL OR steps >= 0),
  CONSTRAINT health_daily_metrics_sleep_check
    CHECK (sleep_asleep_minutes IS NULL OR sleep_asleep_minutes BETWEEN 0 AND 1440),
  CONSTRAINT health_daily_metrics_body_fat_check
    CHECK (body_fat_percentage IS NULL OR body_fat_percentage BETWEEN 0 AND 1)
);

CREATE TABLE IF NOT EXISTS public.health_sync_status (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL,
  synced_from DATE,
  synced_through DATE,
  PRIMARY KEY (user_id, device_id)
);

ALTER TABLE public.health_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_sync_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own health metrics" ON public.health_daily_metrics;
CREATE POLICY "Users manage own health metrics" ON public.health_daily_metrics
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own health sync status" ON public.health_sync_status;
CREATE POLICY "Users manage own health sync status" ON public.health_sync_status
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_health_daily_metrics_updated_at ON public.health_daily_metrics;
CREATE TRIGGER update_health_daily_metrics_updated_at
  BEFORE UPDATE ON public.health_daily_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
