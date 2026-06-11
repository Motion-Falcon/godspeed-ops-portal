-- Consolidated migration_v2: invoices

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
    'text/plain', 'text/csv', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number VARCHAR(10) UNIQUE NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  currency VARCHAR(3) NOT NULL DEFAULT 'CAD',
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_tax DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_hst DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_gst DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_qst DECIMAL(12,2) NOT NULL DEFAULT 0,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  email_sent BOOLEAN DEFAULT FALSE NOT NULL,
  email_sent_date TIMESTAMPTZ,
  invoice_sent_to TEXT,
  document_generated BOOLEAN DEFAULT FALSE NOT NULL,
  document_path TEXT,
  document_file_name TEXT,
  document_file_size BIGINT,
  document_mime_type TEXT DEFAULT 'application/pdf',
  document_generated_at TIMESTAMPTZ,
  invoice_data JSONB NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      COALESCE(invoice_number, '') || ' ' ||
      COALESCE(invoice_data->'client'->>'companyName', '') || ' ' ||
      COALESCE(invoice_data->'client'->>'shortCode', '') || ' ' ||
      COALESCE(invoice_data->'additionalInfo'->>'messageOnInvoice', '')
    )
  ) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_by_user_id UUID REFERENCES auth.users(id),
  version INTEGER DEFAULT 1 NOT NULL,
  version_history JSONB DEFAULT '[]'::jsonb,
  CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'void')),
  CONSTRAINT invoices_currency_check CHECK (currency IN ('CAD', 'USD')),
  CONSTRAINT invoices_totals_check CHECK (subtotal >= 0 AND total_tax >= 0 AND grand_total >= 0 AND total_hours >= 0),
  CONSTRAINT invoices_dates_check CHECK (due_date >= invoice_date),
  CONSTRAINT invoices_sent_to_email_check CHECK (
    invoice_sent_to IS NULL OR invoice_sent_to ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ),
  CONSTRAINT invoices_email_sent_consistency_check CHECK (
    (email_sent = TRUE AND email_sent_date IS NOT NULL AND invoice_sent_to IS NOT NULL)
    OR
    (email_sent = FALSE AND email_sent_date IS NULL)
  ),
  CONSTRAINT invoices_document_consistency_check CHECK (
    (document_generated = TRUE AND document_path IS NOT NULL AND document_generated_at IS NOT NULL)
    OR
    (document_generated = FALSE)
  )
);

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq
START WITH 1
INCREMENT BY 1
MINVALUE 1
MAXVALUE 9999999999
CACHE 1;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS VARCHAR(10)
LANGUAGE plpgsql
AS $$
DECLARE
  next_val INTEGER;
  formatted_number VARCHAR(10);
BEGIN
  next_val := nextval('public.invoice_number_seq');
  formatted_number := LPAD(next_val::TEXT, 6, '0');
  RETURN formatted_number;
END;
$$;

ALTER TABLE public.invoices
ALTER COLUMN invoice_number SET DEFAULT public.generate_invoice_number();

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
CREATE INDEX IF NOT EXISTS idx_invoices_client_company_name ON public.invoices USING BTREE ((invoice_data->'client'->>'companyName'));
CREATE INDEX IF NOT EXISTS idx_invoices_line_items ON public.invoices USING GIN ((invoice_data->'lineItems'));
CREATE INDEX IF NOT EXISTS idx_invoices_payment_terms ON public.invoices USING BTREE ((invoice_data->>'paymentTerms'));
CREATE INDEX IF NOT EXISTS idx_invoices_search_vector ON public.invoices USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_invoices_data_gin ON public.invoices USING GIN (invoice_data);
CREATE INDEX IF NOT EXISTS idx_invoices_sent_to ON public.invoices(invoice_sent_to);
CREATE INDEX IF NOT EXISTS idx_invoices_version_history ON public.invoices USING GIN(version_history);

CREATE OR REPLACE FUNCTION public.update_invoices_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_invoice_number_for_invoices()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := public.generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
DROP TRIGGER IF EXISTS trigger_ensure_invoice_number ON public.invoices;

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_invoices_updated_at_column();

CREATE TRIGGER trigger_ensure_invoice_number
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.ensure_invoice_number_for_invoices();

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can create invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update own draft invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admin and recruiters can view all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admin and recruiters can update any invoice" ON public.invoices;
DROP POLICY IF EXISTS "Admin can delete invoices" ON public.invoices;

CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can create invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update own draft invoices"
  ON public.invoices FOR UPDATE
  USING (created_by_user_id = auth.uid() AND status = 'draft')
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Admin and recruiters can view all invoices"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE id = auth.uid()
        AND (
          raw_user_meta_data->>'role' IN ('admin', 'recruiter')
          OR raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
        )
    )
  );

CREATE POLICY "Admin and recruiters can update any invoice"
  ON public.invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE id = auth.uid()
        AND (
          raw_user_meta_data->>'role' IN ('admin', 'recruiter')
          OR raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
        )
    )
  );

CREATE POLICY "Admin can delete invoices"
  ON public.invoices FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE id = auth.uid()
        AND (
          raw_user_meta_data->>'role' = 'admin'
          OR raw_user_meta_data->>'user_type' = 'admin'
        )
    )
  );

COMMENT ON TABLE public.invoices IS 'Single table design storing complete invoice data with normalized financial fields and JSON payload.';
COMMENT ON COLUMN public.invoices.invoice_number IS 'Auto-generated unique invoice number in format 000001 (6-digit padded)';
COMMENT ON COLUMN public.invoices.invoice_sent_to IS 'Email address where the invoice was sent to.';
COMMENT ON COLUMN public.invoices.version_history IS 'Optional JSON audit metadata for versioned updates';
COMMENT ON COLUMN public.invoices.notes IS 'Additional notes or comments about the invoice';

-- ===== STORAGE BUCKET RLS POLICIES =====
-- Files in the 'invoices' bucket are stored under {client_id}/{invoice_number}/...
-- (NOT under user_id), so policies must allow any authenticated user to access them.

DROP POLICY IF EXISTS "Allow authenticated users to upload invoice attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to select invoice attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update invoice attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete invoice attachments" ON storage.objects;

CREATE POLICY "Allow authenticated users to upload invoice attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Allow authenticated users to select invoice attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices');

CREATE POLICY "Allow authenticated users to update invoice attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'invoices')
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Allow authenticated users to delete invoice attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'invoices');
