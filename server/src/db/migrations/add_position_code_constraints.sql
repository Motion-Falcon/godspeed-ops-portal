-- Migration: Add position code constraints and indexes
-- This migration adds unique constraints for position codes and updates the positions table

-- First, let's ensure the position_code column exists and is properly typed
ALTER TABLE positions 
ALTER COLUMN position_code TYPE VARCHAR(10);

-- Add a unique constraint on position_code to ensure no duplicates
ALTER TABLE positions 
ADD CONSTRAINT unique_position_code UNIQUE (position_code);

-- Create an index for faster lookups when generating new position codes
CREATE INDEX IF NOT EXISTS idx_positions_client_position_code 
ON positions (client, position_code);

-- Create an index for position codes by client for faster incremental number generation
CREATE INDEX IF NOT EXISTS idx_positions_position_code_pattern 
ON positions (position_code) WHERE position_code IS NOT NULL;

-- Add the same constraints to position_drafts table
ALTER TABLE position_drafts 
ALTER COLUMN position_code TYPE VARCHAR(10);

-- Create an index for drafts as well
CREATE INDEX IF NOT EXISTS idx_position_drafts_client_position_code 
ON position_drafts (client, position_code);

CREATE INDEX IF NOT EXISTS idx_position_drafts_position_code_pattern 
ON position_drafts (position_code) WHERE position_code IS NOT NULL;

-- Create a function to generate the next position code for a client
CREATE OR REPLACE FUNCTION generate_next_position_code(client_short_code TEXT)
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    new_position_code TEXT;
    max_existing_number INTEGER;
BEGIN
    -- Find the highest existing number for this client's short code
    SELECT COALESCE(
        MAX(
            CASE 
                WHEN position_code ~ ('^' || client_short_code || '[0-9]{3}$')
                THEN CAST(RIGHT(position_code, 3) AS INTEGER)
                ELSE 0
            END
        ), 0
    ) INTO max_existing_number
    FROM (
        SELECT position_code FROM positions WHERE position_code LIKE client_short_code || '%'
        UNION ALL
        SELECT position_code FROM position_drafts WHERE position_code LIKE client_short_code || '%'
    ) AS all_codes;
    
    -- Increment the number
    next_number := max_existing_number + 1;
    
    -- Format as 3-digit number with leading zeros
    new_position_code := client_short_code || LPAD(next_number::TEXT, 3, '0');
    
    RETURN new_position_code;
END;
$$ LANGUAGE plpgsql;

-- Add a comment explaining the position code format
COMMENT ON COLUMN positions.position_code IS 'Format: [CLIENT_SHORT_CODE][3-digit-number], e.g., ABC001, XYZ002';
COMMENT ON COLUMN position_drafts.position_code IS 'Format: [CLIENT_SHORT_CODE][3-digit-number], e.g., ABC001, XYZ002';

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION generate_next_position_code(TEXT) TO authenticated; 