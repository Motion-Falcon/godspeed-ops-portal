-- Migration to add bio field to jobseeker_profiles table
-- Adds a bio TEXT column to store a brief professional description (max 100 chars)

-- Add the bio column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'jobseeker_profiles' AND column_name = 'bio'
    ) THEN
        -- Add the bio column after work_preference
        ALTER TABLE public.jobseeker_profiles 
        ADD COLUMN bio TEXT;
        
        -- Add comment for documentation
        COMMENT ON COLUMN public.jobseeker_profiles.bio IS 'Brief professional description (max 100 chars)';
    END IF;
END
$$; 