-- Add goal type columns to users table
-- Run this in Supabase SQL Editor to add support for goal types

-- Goal types: 'target' (try to hit this number) or 'limit' (stay under this number)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS calorie_goal_type TEXT DEFAULT 'limit',
ADD COLUMN IF NOT EXISTS protein_goal_type TEXT DEFAULT 'target',
ADD COLUMN IF NOT EXISTS fat_goal_type TEXT DEFAULT 'target',
ADD COLUMN IF NOT EXISTS carb_goal_type TEXT DEFAULT 'target';

-- Add constraint to ensure valid values
ALTER TABLE public.users
ADD CONSTRAINT valid_calorie_goal_type CHECK (calorie_goal_type IN ('target', 'limit')),
ADD CONSTRAINT valid_protein_goal_type CHECK (protein_goal_type IN ('target', 'limit')),
ADD CONSTRAINT valid_fat_goal_type CHECK (fat_goal_type IN ('target', 'limit')),
ADD CONSTRAINT valid_carb_goal_type CHECK (carb_goal_type IN ('target', 'limit'));

