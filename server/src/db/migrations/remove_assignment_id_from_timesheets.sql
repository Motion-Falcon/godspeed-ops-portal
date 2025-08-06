-- Migration: Remove assignment_id from timesheets table
-- Description: Removes the assignment_id column and related constraints/indexes
-- Author: System Generated
-- Date: 2024

-- Drop the unique constraint that includes assignment_id
ALTER TABLE public.timesheets DROP CONSTRAINT IF EXISTS timesheets_unique;

-- Drop the foreign key constraint for assignment_id
ALTER TABLE public.timesheets DROP CONSTRAINT IF EXISTS timesheets_assignment_id_fkey;

-- Drop the index on assignment_id
DROP INDEX IF EXISTS idx_timesheets_assignment_id;

-- Drop the assignment_id column
ALTER TABLE public.timesheets DROP COLUMN IF EXISTS assignment_id;

-- Create new unique constraint without assignment_id
-- This ensures one timesheet per jobseeker per position per week
ALTER TABLE public.timesheets 
ADD CONSTRAINT timesheets_unique_per_position_week 
UNIQUE (jobseeker_profile_id, position_id, week_start_date);

-- Update table comment
COMMENT ON TABLE public.timesheets IS 'Stores weekly timesheet submissions - one record per jobseeker per position per week. Includes document storage for PDF files and auto-generated invoice numbers.'; 