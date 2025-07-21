-- Add version column to bulk_timesheets table
ALTER TABLE bulk_timesheets 
ADD COLUMN version INTEGER DEFAULT 1;

-- Add comment for documentation
COMMENT ON COLUMN bulk_timesheets.version IS 'Version number for tracking changes to bulk timesheet';

-- Add version_history column to bulk_timesheets table
ALTER TABLE bulk_timesheets 
ADD COLUMN version_history JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN bulk_timesheets.version_history IS 'JSONB array containing version history entries with user info and timestamps';

-- Update existing records to have version 1 and empty version history array
UPDATE bulk_timesheets 
SET version = 1, version_history = '[]'::jsonb 
WHERE version IS NULL OR version_history IS NULL;

-- Make version NOT NULL after setting default values
ALTER TABLE bulk_timesheets 
ALTER COLUMN version SET NOT NULL;

-- Make version_history NOT NULL after setting default values
ALTER TABLE bulk_timesheets 
ALTER COLUMN version_history SET NOT NULL;

-- Add constraint to ensure version_history is always an array
ALTER TABLE bulk_timesheets 
ADD CONSTRAINT bulk_timesheets_version_history_check 
CHECK (jsonb_typeof(version_history) = 'array');

-- Add constraint to ensure version is always positive
ALTER TABLE bulk_timesheets 
ADD CONSTRAINT bulk_timesheets_version_positive_check 
CHECK (version > 0); 