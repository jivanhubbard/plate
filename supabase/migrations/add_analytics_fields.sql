-- Migration: Add fields for analytics and weight tracking
-- Run this in Supabase SQL Editor

-- 1. Add profile fields for BMR/TDEE calculation
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS height_inches DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'not_specified',
ADD COLUMN IF NOT EXISTS activity_level TEXT DEFAULT 'moderate';

-- Add constraints for valid values
DO $$ BEGIN
  ALTER TABLE public.users
  ADD CONSTRAINT valid_gender CHECK (gender IN ('male', 'female', 'not_specified'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.users
  ADD CONSTRAINT valid_activity_level CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create weight log table for tracking weight over time
CREATE TABLE IF NOT EXISTS public.weight_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight DECIMAL(5,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.weight_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for weight_log
DROP POLICY IF EXISTS "Users can view own weight logs" ON public.weight_log;
DROP POLICY IF EXISTS "Users can insert own weight logs" ON public.weight_log;
DROP POLICY IF EXISTS "Users can update own weight logs" ON public.weight_log;
DROP POLICY IF EXISTS "Users can delete own weight logs" ON public.weight_log;

CREATE POLICY "Users can view own weight logs" ON public.weight_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight logs" ON public.weight_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight logs" ON public.weight_log
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight logs" ON public.weight_log
  FOR DELETE USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_weight_log_user_date ON public.weight_log(user_id, date);

-- 3. Migrate current weight to weight_log if not already there
-- This creates an initial weight log entry from the user's current weight
INSERT INTO public.weight_log (user_id, date, weight, notes)
SELECT id, CURRENT_DATE, weight, 'Initial weight from profile'
FROM public.users
WHERE weight IS NOT NULL
ON CONFLICT (user_id, date) DO NOTHING;

