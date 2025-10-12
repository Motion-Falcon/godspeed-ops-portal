-- Migration: Add Notes Column to Timesheets
-- Description: Adds a notes TEXT column to store additional information for timesheets
-- Author: System Generated
-- Date: 2025

-- Add notes column to timesheets table
ALTER TABLE public.timesheets 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.timesheets.notes IS 'Additional notes or comments about the timesheet';

-- Verification query (uncomment to test after running migration)
-- SELECT id, invoice_number, notes FROM public.timesheets WHERE notes IS NOT NULL LIMIT 5;

