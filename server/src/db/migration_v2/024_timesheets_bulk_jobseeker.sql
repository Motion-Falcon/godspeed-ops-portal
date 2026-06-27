-- Migration to support bulk (aggregated) timesheets for Job Seekers
ALTER TABLE public.timesheets 
ADD COLUMN IF NOT EXISTS is_bulk BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS bulk_breakdown JSONB DEFAULT '[]'::jsonb NOT NULL;

COMMENT ON COLUMN public.timesheets.is_bulk IS 'True if this timesheet is an aggregated bulk timesheet combining multiple positions.';
COMMENT ON COLUMN public.timesheets.bulk_breakdown IS 'JSON array storing the details (hours, rates, position ID) of each aggregated position in a bulk timesheet.';
