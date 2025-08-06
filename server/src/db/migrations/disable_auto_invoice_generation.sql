-- Migration: Disable Auto Invoice Number Generation
-- Description: Removes automatic invoice number generation to allow manual control
-- Author: System Generated
-- Date: 2024

-- Remove the default value for invoice_number column
ALTER TABLE public.timesheets 
ALTER COLUMN invoice_number DROP DEFAULT;

-- Drop the trigger that ensures invoice number generation
DROP TRIGGER IF EXISTS trigger_ensure_invoice_number ON public.timesheets;

-- Drop the function that was used by the trigger
DROP FUNCTION IF EXISTS ensure_invoice_number();

-- Make invoice_number nullable temporarily (will be set manually via API)
ALTER TABLE public.timesheets 
ALTER COLUMN invoice_number DROP NOT NULL;

-- Update the unique constraint to allow NULL values
ALTER TABLE public.timesheets 
DROP CONSTRAINT IF EXISTS timesheets_invoice_number_key;

-- Add a new unique constraint that allows NULL but ensures uniqueness for non-NULL values
CREATE UNIQUE INDEX IF NOT EXISTS idx_timesheets_invoice_number_unique 
ON public.timesheets(invoice_number) 
WHERE invoice_number IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN public.timesheets.invoice_number IS 'Manually generated invoice number in format 000001, 000002, etc. Generated via API call.'; 