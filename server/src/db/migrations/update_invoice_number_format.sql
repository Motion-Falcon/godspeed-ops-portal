-- Migration: Update invoice number format to remove INV- prefix
-- Date: 2024-12-20
-- Description: Updates the generate_invoice_number function to return just the padded number without INV- prefix

-- Update the function to return just the number without INV- prefix
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR(10) AS $$
DECLARE
    next_val INTEGER;
    formatted_number VARCHAR(10);
BEGIN
    next_val := nextval('invoice_number_seq');
    -- Format as 000001 (without INV- prefix)
    formatted_number := LPAD(next_val::TEXT, 6, '0');
    RETURN formatted_number;
END;
$$ LANGUAGE plpgsql;

-- Update the comment to reflect the new format
COMMENT ON COLUMN public.invoices.invoice_number IS 'Auto-generated unique invoice number in format 000001 (6-digit padded)';

-- Ensure the invoice_number column can handle both old and new formats
-- The column is already VARCHAR(10) which is sufficient for both formats 