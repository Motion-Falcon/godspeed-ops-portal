-- Add rejection_reason column to jobseeker_profiles table
ALTER TABLE jobseeker_profiles ADD COLUMN rejection_reason TEXT DEFAULT NULL;

-- Add comment to explain column purpose
COMMENT ON COLUMN jobseeker_profiles.rejection_reason IS 'Stores the reason for profile rejection provided by recruiters when verification_status is set to rejected'; 