-- Activity-informed nutrition foundation.

CREATE TABLE IF NOT EXISTS public.workout_session_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL,
  default_intensity SMALLINT NOT NULL DEFAULT 5,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, slug),
  CONSTRAINT workout_session_tags_category_check
    CHECK (category IN ('strength', 'cardio', 'mobility', 'sport', 'recovery', 'other')),
  CONSTRAINT workout_session_tags_intensity_check
    CHECK (default_intensity BETWEEN 1 AND 10)
);

CREATE TABLE IF NOT EXISTS public.workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  healthkit_uuid TEXT,
  source_bundle_id TEXT,
  raw_activity_type TEXT NOT NULL,
  display_name TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  active_calories DECIMAL(10,2),
  total_calories DECIMAL(10,2),
  distance_meters DECIMAL(12,2),
  average_heart_rate DECIMAL(8,2),
  session_tag_id UUID REFERENCES public.workout_session_tags(id) ON DELETE SET NULL,
  perceived_exertion SMALLINT,
  notes TEXT,
  classified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT workouts_time_check CHECK (ended_at >= started_at),
  CONSTRAINT workouts_exertion_check
    CHECK (perceived_exertion IS NULL OR perceived_exertion BETWEEN 1 AND 10),
  UNIQUE(user_id, healthkit_uuid)
);

CREATE TABLE IF NOT EXISTS public.planned_workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  planned_date DATE NOT NULL,
  session_tag_id UUID REFERENCES public.workout_session_tags(id) ON DELETE SET NULL,
  title TEXT,
  expected_duration_minutes INTEGER,
  notes TEXT,
  completed_workout_id UUID REFERENCES public.workouts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT planned_workouts_duration_check
    CHECK (expected_duration_minutes IS NULL OR expected_duration_minutes > 0)
);

CREATE TABLE IF NOT EXISTS public.daily_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  calories INTEGER NOT NULL,
  protein INTEGER NOT NULL,
  fat INTEGER NOT NULL,
  carbs INTEGER NOT NULL,
  fiber INTEGER NOT NULL DEFAULT 30,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  calculation_version TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_weigh_in_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  daily_weigh_in_time TIME NOT NULL DEFAULT '08:00:00',
  daily_insights_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_review_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_review_weekday SMALLINT NOT NULL DEFAULT 1,
  weekly_review_time TIME NOT NULL DEFAULT '18:00:00',
  monthly_review_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_weekday_check
    CHECK (weekly_review_weekday BETWEEN 1 AND 7)
);

CREATE TABLE IF NOT EXISTS public.insight_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_date DATE NOT NULL,
  insight_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  reason_codes TEXT[] NOT NULL DEFAULT '{}',
  structured_data JSONB NOT NULL DEFAULT '{}',
  dismissed_at TIMESTAMP WITH TIME ZONE,
  acted_on_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT insight_events_severity_check
    CHECK (severity IN ('info', 'positive', 'warning', 'urgent'))
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_started
  ON public.workouts(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_unclassified
  ON public.workouts(user_id, started_at DESC)
  WHERE classified_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_planned_workouts_user_date
  ON public.planned_workouts(user_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_daily_targets_user_date
  ON public.daily_targets(user_id, date);
CREATE INDEX IF NOT EXISTS idx_insight_events_user_date
  ON public.insight_events(user_id, insight_date DESC);

ALTER TABLE public.workout_session_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own workout tags" ON public.workout_session_tags
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own workouts" ON public.workouts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own planned workouts" ON public.planned_workouts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own daily targets" ON public.daily_targets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own notification preferences" ON public.notification_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view and update own insights" ON public.insight_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own insights" ON public.insight_events
  FOR UPDATE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_workout_session_tags_updated_at ON public.workout_session_tags;
CREATE TRIGGER update_workout_session_tags_updated_at
  BEFORE UPDATE ON public.workout_session_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workouts_updated_at ON public.workouts;
CREATE TRIGGER update_workouts_updated_at
  BEFORE UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_planned_workouts_updated_at ON public.planned_workouts;
CREATE TRIGGER update_planned_workouts_updated_at
  BEFORE UPDATE ON public.planned_workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_targets_updated_at ON public.daily_targets;
CREATE TRIGGER update_daily_targets_updated_at
  BEFORE UPDATE ON public.daily_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
