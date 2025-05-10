-- Migration: Update jobseeker_profile_drafts table
-- Purpose: Support multiple drafts per recruiter by removing the unique constraint on user_id 
-- and adding email and tracking fields

-- Step 1: Drop the existing unique constraint on user_id
ALTER TABLE jobseeker_profile_drafts 
DROP CONSTRAINT IF EXISTS jobseeker_profile_drafts_user_id_key;

-- Step 2: Add email field (to allow searching and ensure uniqueness with profiles)
ALTER TABLE jobseeker_profile_drafts
ADD COLUMN email TEXT;

-- Step 3: Add tracking fields
ALTER TABLE jobseeker_profile_drafts
ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN updated_by_user_id UUID REFERENCES auth.users(id);

-- Step 4: Add similar tracking fields to the jobseeker_profiles table if not already present
ALTER TABLE jobseeker_profiles
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES auth.users(id);

-- Note: This migration allows recruiters to create multiple jobseeker profile drafts
-- Each draft will have its own ID and can be uniquely identified by either ID or email.
-- The user_id field will represent the creator (recruiter) of the draft 
-- The tracking fields will store creation and update information 