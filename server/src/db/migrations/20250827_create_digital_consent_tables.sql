-- Digital Consent Feature: Create consent documents and records tables
-- This migration creates the foundational schema for managing digital consent requests and responses

-- ===== SUPABASE STORAGE BUCKET =====
-- Create dedicated bucket for consent documents

-- Create consent-documents bucket for storing uploaded consent documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'consent-documents',
    'consent-documents', 
    false, -- Private bucket for security
    52428800, -- 50MB limit per file
    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png']
) ON CONFLICT (id) DO NOTHING;

-- ===== STORAGE BUCKET STRUCTURE =====
-- 
-- 'consent-documents' bucket with organized folder structure:
-- └── user_id/
--     └── document_id/
--         └── filename.pdf
--
-- File paths stored in consent_documents.file_path:
-- Format: "user_id/document_id/filename.ext"
-- Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890/doc123/privacy-policy.pdf"
-- Bucket: "consent-documents"

-- Table to store the master consent documents uploaded by admins
CREATE TABLE IF NOT EXISTS public.consent_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Path in Supabase Storage
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE
);

-- Table to track each individual consent request and its status
CREATE TABLE IF NOT EXISTS public.consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.consent_documents(id) ON DELETE CASCADE,
    consentable_id UUID NOT NULL, -- Will store the ID from either clients or jobseeker_profiles
    consentable_type TEXT NOT NULL, -- Will store 'client' or 'jobseeker_profile'
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, expired
    consent_token TEXT NOT NULL UNIQUE, -- Secure, encrypted token
    sent_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    consented_name TEXT, -- The name the user typed
    ip_address TEXT, -- For audit purposes
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT unique_consentable_document_version UNIQUE (consentable_id, consentable_type, document_id),
    CONSTRAINT check_consentable_type CHECK (consentable_type IN ('client', 'jobseeker_profile')),
    CONSTRAINT check_status CHECK (status IN ('pending', 'completed', 'expired'))
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_consent_documents_uploaded_by ON public.consent_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_consent_documents_created_at ON public.consent_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_documents_active ON public.consent_documents(is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consent_records_document_id ON public.consent_records(document_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_consentable ON public.consent_records(consentable_id, consentable_type);
CREATE INDEX IF NOT EXISTS idx_consent_records_token ON public.consent_records(consent_token);
CREATE INDEX IF NOT EXISTS idx_consent_records_status ON public.consent_records(status);
CREATE INDEX IF NOT EXISTS idx_consent_records_sent_at ON public.consent_records(sent_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_consent_records_document_status ON public.consent_records(document_id, status);
CREATE INDEX IF NOT EXISTS idx_consent_records_active_pending ON public.consent_records(status, sent_at DESC) WHERE status = 'pending';

-- Enable Row Level Security (RLS)
ALTER TABLE public.consent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for consent_documents table
-- Admin and recruiter can see all consent documents
CREATE POLICY "Admins and recruiters can view all consent documents" 
  ON public.consent_documents FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

-- Only admins and recruiters can insert consent documents
CREATE POLICY "Admins and recruiters can insert consent documents" 
  ON public.consent_documents FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

-- Only admins and recruiters can update consent documents
CREATE POLICY "Admins and recruiters can update consent documents" 
  ON public.consent_documents FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

-- Only admins can delete consent documents
CREATE POLICY "Only admins can delete consent documents" 
  ON public.consent_documents FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' = 'admin'
    )
  );

-- RLS Policies for consent_records table
-- Admin and recruiter can see all consent records
CREATE POLICY "Admins and recruiters can view all consent records" 
  ON public.consent_records FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

-- Only admins and recruiters can insert consent records
CREATE POLICY "Admins and recruiters can insert consent records" 
  ON public.consent_records FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

-- Only admins and recruiters can update consent records
CREATE POLICY "Admins and recruiters can update consent records" 
  ON public.consent_records FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

-- Public access policy for consent submission (token-based access)
-- This allows public users to update consent records when they have a valid token
-- The actual validation will be handled in the application layer
CREATE POLICY "Public can submit consent with valid token" 
  ON public.consent_records FOR UPDATE
  USING (
    -- This policy allows updates from unauthenticated users
    -- Token validation will be handled in the application layer
    auth.uid() IS NULL AND status = 'pending'
  );

-- Update activity action types to include consent-related actions
INSERT INTO activity_action_types (code, name, description) VALUES
    ('create_consent_request', 'Create Consent Request', 'Create a new digital consent request'),
    ('submit_consent', 'Submit Consent', 'Submit digital consent response'),
    ('resend_consent_request', 'Resend Consent Request', 'Resend digital consent request email')
ON CONFLICT (code) DO NOTHING;

-- Update activity categories to include consent management
INSERT INTO activity_categories (code, name, description) VALUES
    ('consent_management', 'Consent Management', 'Activities related to digital consent requests and submissions')
ON CONFLICT (code) DO NOTHING;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_consent_documents_updated_at 
    BEFORE UPDATE ON public.consent_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consent_records_updated_at 
    BEFORE UPDATE ON public.consent_records 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== STORAGE BUCKET RLS POLICIES =====
-- Note: Storage bucket RLS policies need to be created with superuser permissions
-- or through the Supabase Dashboard. These policies should be set up separately:
--
-- Required policies for 'consent-documents' bucket:
-- 1. "Admins and recruiters can upload consent documents" (INSERT for authenticated)
-- 2. "Admins and recruiters can view consent documents" (SELECT for authenticated) 
-- 3. "Admins and recruiters can update consent documents" (UPDATE for authenticated)
-- 4. "Only admins can delete consent documents" (DELETE for authenticated)
-- 5. "Public can view consent documents for consent process" (SELECT for anon)
--
-- These can be created via Supabase Dashboard > Storage > consent-documents > Policies
-- or by running the policies with a superuser role.
