-- Migration: Add is_subcategory flag to positions table
-- Position subcategories are invoicing-only positions excluded from position matching and jobseeker assignment.

ALTER TABLE positions ADD COLUMN is_subcategory BOOLEAN DEFAULT FALSE NOT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN positions.is_subcategory IS 'When true, position is an invoicing-only subcategory excluded from position matching, jobseeker assignment, calendar events, and slot/fill metrics.';
