-- Consolidated migration_v2: digital consent
-- Includes: consent documents, consent records, consent document templates,
-- consent autofill (consent_mode, autofill_fields, filled_document_*), RLS, storage bucket, activity types.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consent-documents',
  'consent-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.consent_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_description TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  field_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT consent_document_templates_field_mappings_check CHECK (jsonb_typeof(field_mappings) = 'array')
);

CREATE TABLE IF NOT EXISTS public.consent_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  consent_mode TEXT NOT NULL DEFAULT 'standard',
  autofill_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  template_id UUID REFERENCES public.consent_document_templates(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  CONSTRAINT consent_documents_consent_mode_check CHECK (consent_mode IN ('standard', 'autofill'))
);

CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.consent_documents(id) ON DELETE CASCADE,
  consentable_id UUID NOT NULL,
  consentable_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  consent_token TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  consented_name TEXT,
  ip_address TEXT,
  filled_document_file_path TEXT,
  filled_document_file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_consentable_document_version UNIQUE (consentable_id, consentable_type, document_id),
  CONSTRAINT check_consentable_type CHECK (consentable_type IN ('client', 'jobseeker_profile')),
  CONSTRAINT check_status CHECK (status IN ('pending', 'completed', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_consent_documents_uploaded_by ON public.consent_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_consent_documents_created_at ON public.consent_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_documents_active ON public.consent_documents(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_documents_consent_mode ON public.consent_documents(consent_mode);
CREATE INDEX IF NOT EXISTS idx_consent_documents_template_id ON public.consent_documents(template_id);
CREATE INDEX IF NOT EXISTS idx_consent_document_templates_created_by ON public.consent_document_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_consent_document_templates_created_at ON public.consent_document_templates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_document_templates_active ON public.consent_document_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_consent_records_document_id ON public.consent_records(document_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_consentable ON public.consent_records(consentable_id, consentable_type);
CREATE INDEX IF NOT EXISTS idx_consent_records_token ON public.consent_records(consent_token);
CREATE INDEX IF NOT EXISTS idx_consent_records_status ON public.consent_records(status);
CREATE INDEX IF NOT EXISTS idx_consent_records_sent_at ON public.consent_records(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_records_filled_document_path
  ON public.consent_records(filled_document_file_path)
  WHERE filled_document_file_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consent_records_document_status ON public.consent_records(document_id, status);
CREATE INDEX IF NOT EXISTS idx_consent_records_active_pending ON public.consent_records(status, sent_at DESC) WHERE status = 'pending';

ALTER TABLE public.consent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and recruiters can view all consent documents" ON public.consent_documents;
DROP POLICY IF EXISTS "Admins and recruiters can insert consent documents" ON public.consent_documents;
DROP POLICY IF EXISTS "Admins and recruiters can update consent documents" ON public.consent_documents;
DROP POLICY IF EXISTS "Only admins can delete consent documents" ON public.consent_documents;
DROP POLICY IF EXISTS "Admins and recruiters can view consent templates" ON public.consent_document_templates;
DROP POLICY IF EXISTS "Only admins can insert consent templates" ON public.consent_document_templates;
DROP POLICY IF EXISTS "Only admins can update consent templates" ON public.consent_document_templates;
DROP POLICY IF EXISTS "Only admins can delete consent templates" ON public.consent_document_templates;

DROP POLICY IF EXISTS "Admins and recruiters can view all consent records" ON public.consent_records;
DROP POLICY IF EXISTS "Admins and recruiters can insert consent records" ON public.consent_records;
DROP POLICY IF EXISTS "Admins and recruiters can update consent records" ON public.consent_records;
DROP POLICY IF EXISTS "Public can submit consent with valid token" ON public.consent_records;

CREATE POLICY "Admins and recruiters can view all consent documents"
  ON public.consent_documents FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Admins and recruiters can insert consent documents"
  ON public.consent_documents FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Admins and recruiters can update consent documents"
  ON public.consent_documents FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Only admins can delete consent documents"
  ON public.consent_documents FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' = 'admin'
    )
  );

CREATE POLICY "Admins and recruiters can view consent templates"
  ON public.consent_document_templates FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Only admins can insert consent templates"
  ON public.consent_document_templates FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' = 'admin'
    )
  );

CREATE POLICY "Only admins can update consent templates"
  ON public.consent_document_templates FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' = 'admin'
    )
  );

CREATE POLICY "Only admins can delete consent templates"
  ON public.consent_document_templates FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' = 'admin'
    )
  );

CREATE POLICY "Admins and recruiters can view all consent records"
  ON public.consent_records FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Admins and recruiters can insert consent records"
  ON public.consent_records FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Admins and recruiters can update consent records"
  ON public.consent_records FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Public can submit consent with valid token"
  ON public.consent_records FOR UPDATE
  USING (auth.uid() IS NULL AND status = 'pending');

INSERT INTO public.activity_action_types (code, name, description) VALUES
  ('create_consent_request', 'Create Consent Request', 'Create a new digital consent request'),
  ('submit_consent', 'Submit Consent', 'Submit digital consent response'),
  ('resend_consent_request', 'Resend Consent Request', 'Resend digital consent request email')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.activity_categories (code, name, description) VALUES
  ('consent_management', 'Consent Management', 'Activities related to digital consent requests and submissions')
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_consent_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_consent_documents_updated_at ON public.consent_documents;
DROP TRIGGER IF EXISTS update_consent_document_templates_updated_at ON public.consent_document_templates;
DROP TRIGGER IF EXISTS update_consent_records_updated_at ON public.consent_records;

CREATE TRIGGER update_consent_documents_updated_at
BEFORE UPDATE ON public.consent_documents
FOR EACH ROW EXECUTE FUNCTION public.update_consent_updated_at_column();

CREATE TRIGGER update_consent_document_templates_updated_at
BEFORE UPDATE ON public.consent_document_templates
FOR EACH ROW EXECUTE FUNCTION public.update_consent_updated_at_column();

CREATE TRIGGER update_consent_records_updated_at
BEFORE UPDATE ON public.consent_records
FOR EACH ROW EXECUTE FUNCTION public.update_consent_updated_at_column();

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and recruiters can upload consent documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins and recruiters can view consent documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins and recruiters can update consent documents" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete consent documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view consent documents for consent process" ON storage.objects;

DROP POLICY IF EXISTS "Allow authenticated users to upload consent documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to view consent documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update consent documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete consent documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public and authenticated access to view consent documents" ON storage.objects;

CREATE POLICY "Allow authenticated users to upload consent documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'consent-documents');

CREATE POLICY "Allow public and authenticated access to view consent documents"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'consent-documents');

CREATE POLICY "Allow authenticated users to update consent documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'consent-documents')
  WITH CHECK (bucket_id = 'consent-documents');

CREATE POLICY "Allow authenticated users to delete consent documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'consent-documents');
