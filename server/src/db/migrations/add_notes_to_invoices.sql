-- Migration: Add Notes Column to Invoices
-- Description: Adds a notes TEXT column to store additional information for invoices
-- Author: System Generated
-- Date: 2025

-- Add notes column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.invoices.notes IS 'Additional notes or comments about the invoice';

-- Verification query (uncomment to test after running migration)
-- SELECT id, invoice_number, notes FROM public.invoices WHERE notes IS NOT NULL LIMIT 5;

