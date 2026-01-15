-- Food Tracker Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  weight DECIMAL(5,2),
  calorie_goal INTEGER DEFAULT 2200,
  protein_goal INTEGER DEFAULT 200,
  fat_goal INTEGER DEFAULT 80,
  carb_goal INTEGER DEFAULT 200,
  eating_window_start TIME DEFAULT '12:00:00',
  eating_window_end TIME DEFAULT '20:00:00'
);

-- Foods table (common foods + user custom foods)
CREATE TABLE IF NOT EXISTS public.foods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  serving_size TEXT NOT NULL,
  serving_unit TEXT NOT NULL,
  calories DECIMAL(10,2) NOT NULL,
  protein DECIMAL(10,2) NOT NULL DEFAULT 0,
  fat DECIMAL(10,2) NOT NULL DEFAULT 0,
  carbs DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_custom BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usda_fdc_id INTEGER
);

-- Food log entries
CREATE TABLE IF NOT EXISTS public.food_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT, -- breakfast, lunch, dinner, snack
  servings DECIMAL(10,2) NOT NULL DEFAULT 1,
  calories DECIMAL(10,2) NOT NULL,
  protein DECIMAL(10,2) NOT NULL,
  fat DECIMAL(10,2) NOT NULL,
  carbs DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User favorites
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, food_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_food_log_user_date ON public.food_log(user_id, date);
CREATE INDEX IF NOT EXISTS idx_food_log_user_id ON public.food_log(user_id);
CREATE INDEX IF NOT EXISTS idx_foods_name ON public.foods(name);
CREATE INDEX IF NOT EXISTS idx_foods_user_id ON public.foods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON public.user_favorites(user_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- Users policies: Users can read/update their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Foods policies: Users can view common foods and their own custom foods
CREATE POLICY "Anyone can view common foods" ON public.foods
  FOR SELECT USING (is_custom = FALSE OR user_id = auth.uid());

CREATE POLICY "Users can insert custom foods" ON public.foods
  FOR INSERT WITH CHECK (auth.uid() = user_id OR (is_custom = FALSE AND user_id IS NULL));

CREATE POLICY "Users can update own custom foods" ON public.foods
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own custom foods" ON public.foods
  FOR DELETE USING (user_id = auth.uid());

-- Food log policies: Users can only access their own logs
CREATE POLICY "Users can view own food logs" ON public.food_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own food logs" ON public.food_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own food logs" ON public.food_log
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own food logs" ON public.food_log
  FOR DELETE USING (auth.uid() = user_id);

-- User favorites policies: Users can only access their own favorites
CREATE POLICY "Users can view own favorites" ON public.user_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites" ON public.user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" ON public.user_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on food_log
CREATE TRIGGER update_food_log_updated_at
  BEFORE UPDATE ON public.food_log
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

