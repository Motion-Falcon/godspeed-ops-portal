-- Migration: Add UCI and work permit expiry fields to jobseeker_profiles table
-- Date: 2024-01-XX
-- Description: Add work_permit_uci and work_permit_expiry fields for temporary residents (SIN starting with '9')

-- Add work_permit_uci field
ALTER TABLE public.jobseeker_profiles 
ADD COLUMN work_permit_uci text;

-- Add work_permit_expiry field  
ALTER TABLE public.jobseeker_profiles 
ADD COLUMN work_permit_expiry text;

-- Add comments to document the purpose of these fields
COMMENT ON COLUMN public.jobseeker_profiles.work_permit_uci IS 'UCI (Unique Client Identifier) for work permit or student permit - required for temporary residents with SIN starting with 9';
COMMENT ON COLUMN public.jobseeker_profiles.work_permit_expiry IS 'Work permit or student permit expiry date - required for temporary residents with SIN starting with 9';

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'jobseeker_profiles' 
  AND column_name IN ('work_permit_uci', 'work_permit_expiry')
ORDER BY column_name;
