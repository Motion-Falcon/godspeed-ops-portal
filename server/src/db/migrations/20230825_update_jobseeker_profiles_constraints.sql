-- Migration: Update jobseeker_profiles table constraints
-- Purpose: Allow multiple profiles per user (recruiter) with email as the unique identifier

-- Step 1: Drop the existing unique constraint on user_id
ALTER TABLE jobseeker_profiles 
DROP CONSTRAINT IF EXISTS jobseeker_profiles_user_id_key;

-- Step 2: Add a unique constraint on email
ALTER TABLE jobseeker_profiles
ADD CONSTRAINT jobseeker_profiles_email_key UNIQUE (email);

-- Note: This migration allows recruiters to create multiple jobseeker profiles
-- Each jobseeker profile will now be uniquely identified by their email address
-- The user_id field will be retained but will now represent the creator of the profile 