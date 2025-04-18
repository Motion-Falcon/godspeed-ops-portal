-- Execute this SQL in the Supabase Dashboard SQL Editor
-- This removes the unique constraint on user_id and adds a unique constraint on email

-- First, identify the constraint name (if you don't know it)
-- SELECT tc.constraint_name, tc.table_name, kcu.column_name
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
-- WHERE tc.constraint_type = 'UNIQUE' 
--   AND tc.table_name = 'jobseeker_profiles'
--   AND kcu.column_name = 'user_id';

-- Drop the user_id unique constraint
ALTER TABLE jobseeker_profiles 
DROP CONSTRAINT jobseeker_profiles_user_id_key;

-- Add email unique constraint
ALTER TABLE jobseeker_profiles
ADD CONSTRAINT jobseeker_profiles_email_key UNIQUE (email);

-- Verify the changes
SELECT tc.constraint_name, tc.table_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE' 
  AND tc.table_name = 'jobseeker_profiles'; 