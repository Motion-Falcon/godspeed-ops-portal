-- Migration to add created_by_user_id to jobseeker_profiles table
-- This field tracks which user actually created the profile (could be different from user_id)

-- Add created_by_user_id column to jobseeker_profiles if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'jobseeker_profiles' 
        AND column_name = 'created_by_user_id'
    ) 
    THEN
        ALTER TABLE public.jobseeker_profiles 
        ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id);
        
        -- Update existing records to set created_by_user_id = user_id
        UPDATE public.jobseeker_profiles
        SET created_by_user_id = user_id
        WHERE created_by_user_id IS NULL;
    END IF;
END $$;

-- Comments for documentation
COMMENT ON COLUMN public.jobseeker_profiles.created_by_user_id IS 'The user ID of the person who created this profile (may differ from the profile owner)';