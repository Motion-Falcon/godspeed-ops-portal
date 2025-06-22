-- Migration to add clientName column to positions and position_drafts tables
-- This adds a varchar column to store client name directly in both tables

-- Add client_name column to positions table
ALTER TABLE positions 
ADD COLUMN client_name VARCHAR(255);

-- Add client_name column to position_drafts table
ALTER TABLE position_drafts 
ADD COLUMN client_name VARCHAR(255);

-- Optional: Update existing records to populate the new column with client names
-- This will copy the company_name from the clients table to the new client_name column

-- Update positions table
UPDATE positions 
SET client_name = clients.company_name
FROM clients 
WHERE positions.client = clients.id;

-- Update position_drafts table
UPDATE position_drafts 
SET client_name = clients.company_name
FROM clients 
WHERE position_drafts.client = clients.id;

-- Optional: Add indexes on the new columns for better query performance
CREATE INDEX idx_positions_client_name ON positions(client_name);
CREATE INDEX idx_position_drafts_client_name ON position_drafts(client_name);

-- Optional: Add comments to document the columns
COMMENT ON COLUMN positions.client_name IS 'Denormalized client company name for easier querying';
COMMENT ON COLUMN position_drafts.client_name IS 'Denormalized client company name for easier querying'; 