-- Add WSIB code column to clients table
-- WSIB code format: 1 Alpha + 1 Number (e.g., A1, B2, C3)
-- This field is optional (nullable)

ALTER TABLE "public"."clients" 
ADD COLUMN "wsib_code" VARCHAR(2) NULL;

-- Add a check constraint to ensure the format is correct (1 letter followed by 1 number)
ALTER TABLE "public"."clients" 
ADD CONSTRAINT "clients_wsib_code_format_check" 
CHECK (wsib_code IS NULL OR wsib_code ~ '^[A-Z][0-9]$');

-- Add a comment to document the column
COMMENT ON COLUMN "public"."clients"."wsib_code" IS 'WSIB (Workplace Safety and Insurance Board) code - Format: 1 Alpha + 1 Number (e.g., A1, B2)'; 