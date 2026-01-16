-- Migration: Add timestamps to food log and intermittent fasting settings
-- Run this in Supabase SQL Editor

-- 1. Add logged_at timestamp to food_log for tracking when food was actually consumed
-- This is separate from created_at which tracks when the entry was created
ALTER TABLE public.food_log 
ADD COLUMN IF NOT EXISTS logged_at TIME DEFAULT NULL;

-- 2. Add intermittent fasting toggle to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS uses_intermittent_fasting BOOLEAN DEFAULT FALSE;

-- 3. Add onboarding completion flag to track if user has completed initial setup
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;

-- Update existing users: set onboarding_complete to true if they have weight set (existing users)
UPDATE public.users SET onboarding_complete = TRUE WHERE weight IS NOT NULL;

-- Comment: logged_at stores just the time portion (e.g., "14:30:00") for comparing against eating window
-- The date is already stored in the 'date' column

