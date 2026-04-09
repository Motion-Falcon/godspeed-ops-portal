-- Migration: Add jobseeker onboarding consent support
-- Adds is_jobseeker_onboarding flag to consent_documents and consent_records,
-- and expands consentable_type to include 'user' for auth.users references.

-- 1. Add is_jobseeker_onboarding column to consent_documents
ALTER TABLE public.consent_documents
  ADD COLUMN IF NOT EXISTS is_jobseeker_onboarding BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_consent_documents_jobseeker_onboarding
  ON public.consent_documents(is_jobseeker_onboarding)
  WHERE is_jobseeker_onboarding = TRUE;

-- 2. Add is_jobseeker_onboarding column to consent_records
ALTER TABLE public.consent_records
  ADD COLUMN IF NOT EXISTS is_jobseeker_onboarding BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_consent_records_jobseeker_onboarding
  ON public.consent_records(consentable_id, consentable_type)
  WHERE is_jobseeker_onboarding = TRUE;

-- 3. Update CHECK constraint on consentable_type to allow 'user'
ALTER TABLE public.consent_records
  DROP CONSTRAINT IF EXISTS check_consentable_type;

ALTER TABLE public.consent_records
  ADD CONSTRAINT check_consentable_type
  CHECK (consentable_type IN ('client', 'jobseeker_profile', 'user'));
