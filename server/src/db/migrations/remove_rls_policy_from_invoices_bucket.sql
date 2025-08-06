-- Migration: Create Single Invoices Table
-- Description: Creates a comprehensive invoices table that stores the complete Invoice Data Object
-- Uses JSONB for complex nested data while keeping key fields normalized for performance
-- Author: System Generated
-- Date: 2024

-- ===== SUPABASE STORAGE BUCKETS =====
-- Create single storage bucket for all invoice-related files

-- Create unified bucket for all invoice files (attachments and documents)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'invoices',
    'invoices', 
    false, -- Private bucket
    52428800, -- 50MB limit per file (covers both attachments and PDFs)
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- ===== INVOICES TABLE =====

-- Create the invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Core invoice fields (normalized for performance and querying)
    invoice_number VARCHAR(10) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, sent, paid, overdue, cancelled
    currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
    
    -- Client reference (normalized for foreign key relationship)
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
    
    -- Financial totals (normalized for easy reporting and querying)
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_tax DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_hst DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_gst DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_qst DECIMAL(12,2) NOT NULL DEFAULT 0,
    grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
    
    -- Email and document flags (normalized for easy filtering)
    email_sent BOOLEAN DEFAULT FALSE NOT NULL,
    email_sent_date TIMESTAMPTZ,
    document_generated BOOLEAN DEFAULT FALSE NOT NULL,
    document_path TEXT,
    document_file_name TEXT,
    document_file_size BIGINT,
    document_mime_type TEXT DEFAULT 'application/pdf',
    document_generated_at TIMESTAMPTZ,
    
    -- Complete Invoice Data Object stored as JSONB
    -- This contains the full nested structure from the frontend
    invoice_data JSONB NOT NULL,
    
    -- Search optimization (generated column for full-text search)
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', 
            COALESCE(invoice_number, '') || ' ' ||
            COALESCE(invoice_data->'client'->>'companyName', '') || ' ' ||
            COALESCE(invoice_data->'client'->>'shortCode', '') || ' ' ||
            COALESCE(invoice_data->'additionalInfo'->>'messageOnInvoice', '')
        )
    ) STORED,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by_user_id UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_by_user_id UUID REFERENCES auth.users(id),
    version INTEGER DEFAULT 1 NOT NULL,
    
    -- Constraints
    CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'void')),
    CONSTRAINT invoices_currency_check CHECK (currency IN ('CAD', 'USD')),
    CONSTRAINT invoices_totals_check CHECK (
        subtotal >= 0 AND total_tax >= 0 AND grand_total >= 0 AND total_hours >= 0
    ),
    CONSTRAINT invoices_dates_check CHECK (due_date >= invoice_date),
    CONSTRAINT invoices_email_sent_date_check CHECK (
        (email_sent = TRUE AND email_sent_date IS NOT NULL) OR 
        (email_sent = FALSE AND email_sent_date IS NULL)
    ),
    CONSTRAINT invoices_document_consistency_check CHECK (
        (document_generated = TRUE AND document_path IS NOT NULL AND document_generated_at IS NOT NULL) OR 
        (document_generated = FALSE)
    )
);

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq 
START WITH 1 
INCREMENT BY 1 
MINVALUE 1 
MAXVALUE 9999999999 
CACHE 1;

-- Create function to generate formatted invoice numbers
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

-- Set default value for invoice_number column
ALTER TABLE public.invoices 
ALTER COLUMN invoice_number SET DEFAULT generate_invoice_number();

-- Create comprehensive indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_email_sent ON public.invoices(email_sent);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_grand_total ON public.invoices(grand_total);
CREATE INDEX IF NOT EXISTS idx_invoices_document_generated ON public.invoices(document_generated);
CREATE INDEX IF NOT EXISTS idx_invoices_document_generated_at ON public.invoices(document_generated_at);

-- JSONB specific indexes for querying nested data
CREATE INDEX IF NOT EXISTS idx_invoices_client_company_name ON public.invoices 
USING BTREE ((invoice_data->'client'->>'companyName'));

CREATE INDEX IF NOT EXISTS idx_invoices_line_items ON public.invoices 
USING GIN ((invoice_data->'lineItems'));

CREATE INDEX IF NOT EXISTS idx_invoices_payment_terms ON public.invoices 
USING BTREE ((invoice_data->>'paymentTerms'));

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_invoices_search_vector ON public.invoices 
USING GIN (search_vector);

-- General JSONB index for flexible querying
CREATE INDEX IF NOT EXISTS idx_invoices_data_gin ON public.invoices 
USING GIN (invoice_data);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at and version
CREATE TRIGGER update_invoices_updated_at 
    BEFORE UPDATE ON public.invoices 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to ensure invoice_number is always generated for new records
CREATE OR REPLACE FUNCTION ensure_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL THEN
        NEW.invoice_number := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_invoice_number
    BEFORE INSERT ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION ensure_invoice_number();

-- Enable Row Level Security (RLS)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Users can view invoices they created
CREATE POLICY "Users can view own invoices"
    ON public.invoices FOR SELECT
    USING (created_by_user_id = auth.uid());

-- Policy: Users can create invoices
CREATE POLICY "Users can create invoices"
    ON public.invoices FOR INSERT
    WITH CHECK (created_by_user_id = auth.uid());

-- Policy: Users can update invoices they created (draft status only)
CREATE POLICY "Users can update own draft invoices"
    ON public.invoices FOR UPDATE
    USING (created_by_user_id = auth.uid() AND status = 'draft')
    WITH CHECK (created_by_user_id = auth.uid());

-- Policy: Admin and recruiters can view all invoices
CREATE POLICY "Admin and recruiters can view all invoices"
    ON public.invoices FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND (raw_user_meta_data->>'role' IN ('admin', 'recruiter'))
        )
    );

-- Policy: Admin and recruiters can update any invoice
CREATE POLICY "Admin and recruiters can update any invoice"
    ON public.invoices FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND (raw_user_meta_data->>'role' IN ('admin', 'recruiter'))
        )
    );

-- Policy: Admin can delete invoices
CREATE POLICY "Admin can delete invoices"
    ON public.invoices FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND (raw_user_meta_data->>'role' = 'admin')
        )
    );

-- Add helpful comments
COMMENT ON TABLE public.invoices IS 'Single table design storing complete invoice data. Uses JSONB for complex nested structures while keeping key fields normalized for performance.';

COMMENT ON COLUMN public.invoices.invoice_number IS 'Auto-generated unique invoice number in format INV-000001';
COMMENT ON COLUMN public.invoices.invoice_data IS 'Complete Invoice Data Object from frontend stored as JSONB - contains client info, line items, totals, attachments, etc.';
COMMENT ON COLUMN public.invoices.search_vector IS 'Generated tsvector for full-text search across invoice content';
COMMENT ON COLUMN public.invoices.client_id IS 'Foreign key to clients table for relational integrity';
COMMENT ON COLUMN public.invoices.subtotal IS 'Denormalized subtotal for quick reporting (also stored in invoice_data)';
COMMENT ON COLUMN public.invoices.grand_total IS 'Denormalized grand total for quick reporting (also stored in invoice_data)';
COMMENT ON COLUMN public.invoices.total_hours IS 'Denormalized total hours for quick reporting (also stored in invoice_data)';
COMMENT ON COLUMN public.invoices.email_sent IS 'Flag indicating if invoice email has been sent';
COMMENT ON COLUMN public.invoices.document_path IS 'Path to generated PDF document in invoices bucket (format: user_id/invoice_id/documents/invoice_number.pdf)';
COMMENT ON COLUMN public.invoices.document_file_name IS 'Original filename of generated PDF document';
COMMENT ON COLUMN public.invoices.document_file_size IS 'Size of generated PDF document in bytes';
COMMENT ON COLUMN public.invoices.document_mime_type IS 'MIME type of generated document (default: application/pdf)';
COMMENT ON COLUMN public.invoices.document_generated_at IS 'Timestamp when PDF document was generated';
COMMENT ON COLUMN public.invoices.version IS 'Version number for optimistic locking and audit trail';

-- ===== STORAGE BUCKET STRUCTURE =====
-- 
-- Single 'invoices' bucket with organized folder structure:
-- └── user_id/
--     └── invoice_id/
--         ├── attachments/
--         │   ├── attachment1.pdf
--         │   ├── attachment2.jpg
--         │   └── attachment3.xlsx
--         └── documents/
--             └── INV-000001.pdf
--
-- File paths stored in invoice_data JSONB:
-- - attachments[].filePath: "user_id/invoice_id/attachments/filename.ext"
-- - document.filePath: "user_id/invoice_id/documents/invoice_number.pdf"
-- - bucketName: "invoices" (for both attachments and documents)

-- Example queries for testing (uncomment to test after running migration)
/*
-- Insert sample invoice data
INSERT INTO public.invoices (
    client_id, 
    invoice_date, 
    due_date, 
    subtotal, 
    grand_total, 
    total_hours,
    invoice_data,
    created_by_user_id
) VALUES (
    'client-uuid-here',
    '2024-01-15',
    '2024-02-14',
    1000.00,
    1130.00,
    40.0,
    '{
        "client": {"companyName": "Test Company", "currency": "CAD"},
        "lineItems": [{"hours": 40, "rate": 25, "description": "Development work"}],
        "totals": {"subtotal": 1000.00, "grandTotal": 1130.00}
    }'::jsonb,
    auth.uid()
);

-- Query examples
SELECT invoice_number, status, grand_total, invoice_data->'client'->>'companyName' as client_name FROM public.invoices;
SELECT * FROM public.invoices WHERE invoice_data->'client'->>'companyName' = 'Test Company';
SELECT * FROM public.invoices WHERE invoice_data->'totals'->>'grandTotal' > '500';
*/ 