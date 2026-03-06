-- Combined migration: consent autofill support + consent document templates
-- Run this single script in production to apply both features.
--
-- Part 1: Consent document templates (reusable PDF template mappings)
-- Part 2: Consent autofill support (consent_mode, autofill_fields, filled documents)

-- =============================================================================
-- Part 1: Consent document templates
-- =============================================================================

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
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.consent_document_templates
  DROP CONSTRAINT IF EXISTS consent_document_templates_field_mappings_check;

ALTER TABLE public.consent_document_templates
  ADD CONSTRAINT consent_document_templates_field_mappings_check
  CHECK (jsonb_typeof(field_mappings) = 'array');

ALTER TABLE public.consent_documents
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.consent_document_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_consent_document_templates_created_by
  ON public.consent_document_templates(created_by);

CREATE INDEX IF NOT EXISTS idx_consent_document_templates_created_at
  ON public.consent_document_templates(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consent_document_templates_active
  ON public.consent_document_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_consent_documents_template_id
  ON public.consent_documents(template_id);

ALTER TABLE public.consent_document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and recruiters can view consent templates" ON public.consent_document_templates;
DROP POLICY IF EXISTS "Only admins can insert consent templates" ON public.consent_document_templates;
DROP POLICY IF EXISTS "Only admins can update consent templates" ON public.consent_document_templates;
DROP POLICY IF EXISTS "Only admins can delete consent templates" ON public.consent_document_templates;

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

DROP TRIGGER IF EXISTS update_consent_document_templates_updated_at ON public.consent_document_templates;

CREATE OR REPLACE FUNCTION public.update_consent_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_consent_document_templates_updated_at
BEFORE UPDATE ON public.consent_document_templates
FOR EACH ROW EXECUTE FUNCTION public.update_consent_updated_at_column();

-- =============================================================================
-- Part 2: Consent autofill support
-- consent_documents.consent_mode: standard | autofill
-- consent_documents.autofill_fields: template field placements
-- consent_records.filled_document_file_path/name: per-recipient generated PDF
-- =============================================================================

ALTER TABLE public.consent_documents
  ADD COLUMN IF NOT EXISTS consent_mode TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS autofill_fields JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.consent_documents
  DROP CONSTRAINT IF EXISTS consent_documents_consent_mode_check;

ALTER TABLE public.consent_documents
  ADD CONSTRAINT consent_documents_consent_mode_check
  CHECK (consent_mode IN ('standard', 'autofill'));

ALTER TABLE public.consent_records
  ADD COLUMN IF NOT EXISTS filled_document_file_path TEXT,
  ADD COLUMN IF NOT EXISTS filled_document_file_name TEXT;

CREATE INDEX IF NOT EXISTS idx_consent_documents_consent_mode
  ON public.consent_documents(consent_mode);

CREATE INDEX IF NOT EXISTS idx_consent_records_filled_document_path
  ON public.consent_records(filled_document_file_path)
  WHERE filled_document_file_path IS NOT NULL;
