-- Migration: Add bonus and deduction columns to timesheets table
-- Description: Adds bonus_amount and deduction_amount columns to support additional pay adjustments
-- Author: System Generated
-- Date: 2024

-- Add bonus_amount and deduction_amount columns to timesheets table
ALTER TABLE public.timesheets 
ADD COLUMN IF NOT EXISTS bonus_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS deduction_amount DECIMAL(10,2) DEFAULT 0 NOT NULL;

-- Add check constraints to ensure non-negative values
ALTER TABLE public.timesheets 
ADD CONSTRAINT timesheets_bonus_positive CHECK (bonus_amount >= 0),
ADD CONSTRAINT timesheets_deduction_positive CHECK (deduction_amount >= 0);

-- Add comments for the new columns
COMMENT ON COLUMN public.timesheets.bonus_amount IS 'Additional bonus amount added to jobseeker pay';
COMMENT ON COLUMN public.timesheets.deduction_amount IS 'Deduction amount subtracted from jobseeker pay';

-- Create indexes for better query performance (optional, if you plan to filter by these columns)
CREATE INDEX IF NOT EXISTS idx_timesheets_bonus_amount ON public.timesheets(bonus_amount) WHERE bonus_amount > 0;
CREATE INDEX IF NOT EXISTS idx_timesheets_deduction_amount ON public.timesheets(deduction_amount) WHERE deduction_amount > 0;

-- Verification query (uncomment to test after running migration)
-- SELECT bonus_amount, deduction_amount, total_jobseeker_pay FROM public.timesheets LIMIT 5; 