-- Add target weight column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS target_weight DECIMAL(5,2);

