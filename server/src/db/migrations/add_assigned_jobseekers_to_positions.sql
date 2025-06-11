-- Migration: Add assigned_jobseekers column to positions table
-- Date: 2024-01-15
-- Description: Add column to store array of jobseeker profile IDs assigned to each position

-- Add column to store array of assigned jobseeker profile IDs
ALTER TABLE positions 
ADD COLUMN assigned_jobseekers UUID[] DEFAULT '{}' NOT NULL;

-- Add comment to describe the column
COMMENT ON COLUMN positions.assigned_jobseekers IS 'Array of jobseeker profile IDs assigned to this position';

-- Add index for better query performance when searching for specific jobseekers
CREATE INDEX idx_positions_assigned_jobseekers ON positions USING GIN(assigned_jobseekers);

-- Add index for positions that have any assigned jobseekers
CREATE INDEX idx_positions_has_assigned_jobseekers ON positions ((array_length(assigned_jobseekers, 1) > 0));

-- Example usage queries (commented out for reference):
-- 
-- Add jobseekers to a position:
-- UPDATE positions 
-- SET assigned_jobseekers = ARRAY['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43d1-b789-123456789abc']
-- WHERE id = 'your-position-id';
-- 
-- Add a single jobseeker to existing array:
-- UPDATE positions 
-- SET assigned_jobseekers = array_append(assigned_jobseekers, '123e4567-e89b-12d3-a456-426614174000')
-- WHERE id = 'your-position-id';
-- 
-- Find positions assigned to a specific jobseeker:
-- SELECT * FROM positions 
-- WHERE '123e4567-e89b-12d3-a456-426614174000' = ANY(assigned_jobseekers);
-- 
-- Find positions with any assigned jobseekers:
-- SELECT * FROM positions 
-- WHERE array_length(assigned_jobseekers, 1) > 0;
-- 
-- Count assigned jobseekers per position:
-- SELECT id, title, array_length(assigned_jobseekers, 1) as jobseeker_count
-- FROM positions; 