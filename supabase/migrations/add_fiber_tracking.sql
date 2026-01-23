-- Migration: Add fiber tracking alongside other macros
-- Run this in Supabase SQL Editor

-- 1. Add fiber goal to users table (alongside protein_goal, fat_goal, carb_goal)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS fiber_goal INTEGER DEFAULT 30;

-- 2. Add fiber goal type (target vs limit)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS fiber_goal_type TEXT DEFAULT 'target';

DO $$ BEGIN
  ALTER TABLE public.users
  ADD CONSTRAINT valid_fiber_goal_type CHECK (fiber_goal_type IN ('target', 'limit'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Add fiber column to foods table
ALTER TABLE public.foods
ADD COLUMN IF NOT EXISTS fiber DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 4. Add fiber column to food_log table
ALTER TABLE public.food_log
ADD COLUMN IF NOT EXISTS fiber DECIMAL(10,2) NOT NULL DEFAULT 0;
