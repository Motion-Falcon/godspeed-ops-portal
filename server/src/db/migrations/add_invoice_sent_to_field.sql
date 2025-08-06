-- Migration: Add invoiceSentTo field to invoices table
-- Description: Adds a field to track who the invoice was sent to (email address)
-- Author: System Generated
-- Date: 2024

-- Add the invoiceSentTo column to the invoices table
ALTER TABLE public.invoices 
ADD COLUMN invoice_sent_to TEXT;

-- Add a check constraint to ensure it's a valid email format when not null
ALTER TABLE public.invoices 
ADD CONSTRAINT invoices_sent_to_email_check 
CHECK (
    invoice_sent_to IS NULL OR 
    invoice_sent_to ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);

-- Create an index for the new field to improve query performance
CREATE INDEX IF NOT EXISTS idx_invoices_sent_to ON public.invoices(invoice_sent_to);

-- Add a comment to document the field
COMMENT ON COLUMN public.invoices.invoice_sent_to IS 'Email address where the invoice was sent to. Should match client email or be a specific recipient email.';

-- Optional: Update the email_sent constraint to include the new field
-- This ensures that if email_sent is true, then invoice_sent_to should also be populated
ALTER TABLE public.invoices 
DROP CONSTRAINT IF EXISTS invoices_email_sent_date_check;

ALTER TABLE public.invoices 
ADD CONSTRAINT invoices_email_sent_consistency_check 
CHECK (
    (email_sent = TRUE AND email_sent_date IS NOT NULL AND invoice_sent_to IS NOT NULL) OR 
    (email_sent = FALSE AND email_sent_date IS NULL)
);

-- Example usage after migration:
/*
-- Update existing invoices to set invoice_sent_to based on client email
UPDATE public.invoices 
SET invoice_sent_to = invoice_data->'client'->>'email'
WHERE email_sent = TRUE AND invoice_sent_to IS NULL;

-- Query invoices by recipient
SELECT invoice_number, invoice_sent_to, email_sent_date 
FROM public.invoices 
WHERE invoice_sent_to = 'client@example.com';

-- Query all sent invoices with recipient info
SELECT 
    invoice_number,
    invoice_data->'client'->>'companyName' as client_name,
    invoice_sent_to,
    email_sent_date,
    status
FROM public.invoices 
WHERE email_sent = TRUE
ORDER BY email_sent_date DESC;
*/ 