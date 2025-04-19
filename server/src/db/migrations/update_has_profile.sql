-- Migration to update existing users with hasProfile flag
-- This script will:
-- 1. Find all users in 'auth.users' who have profiles in 'jobseeker_profiles'
-- 2. Set 'hasProfile' to true in their user_metadata

-- First, create a function to safely update user metadata
CREATE OR REPLACE FUNCTION update_user_has_profile()
RETURNS VOID AS $$
DECLARE
    user_rec RECORD;
    profile_exists BOOLEAN;
    curr_metadata JSONB;
    new_metadata JSONB;
BEGIN
    -- Iterate over all users with jobseeker role
    FOR user_rec IN 
        SELECT id, raw_user_meta_data 
        FROM auth.users 
        WHERE raw_user_meta_data->>'user_type' = 'jobseeker'
    LOOP
        -- Check if user has a profile
        SELECT EXISTS (
            SELECT 1 FROM jobseeker_profiles WHERE user_id = user_rec.id
        ) INTO profile_exists;
        
        -- Get current metadata
        curr_metadata := user_rec.raw_user_meta_data;
        
        -- Update metadata only if profile exists and hasProfile isn't already true
        IF profile_exists AND (curr_metadata->>'hasProfile' IS NULL OR curr_metadata->>'hasProfile' <> 'true') THEN
            -- Create new metadata with hasProfile set to true
            new_metadata := jsonb_set(
                curr_metadata, 
                '{hasProfile}', 
                'true'::jsonb, 
                true
            );
            
            -- Update user metadata
            UPDATE auth.users 
            SET raw_user_meta_data = new_metadata 
            WHERE id = user_rec.id;
            
            RAISE NOTICE 'Updated user % with hasProfile=true', user_rec.id;
        ELSIF NOT profile_exists AND curr_metadata->>'hasProfile' = 'true' THEN
            -- If no profile exists but hasProfile is true, set it to false
            new_metadata := jsonb_set(
                curr_metadata, 
                '{hasProfile}', 
                'false'::jsonb, 
                true
            );
            
            -- Update user metadata
            UPDATE auth.users 
            SET raw_user_meta_data = new_metadata 
            WHERE id = user_rec.id;
            
            RAISE NOTICE 'Updated user % with hasProfile=false', user_rec.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the function
SELECT update_user_has_profile();

-- Drop the function after use
DROP FUNCTION update_user_has_profile();

-- Create a trigger to automatically update hasProfile when profiles are created/deleted
CREATE OR REPLACE FUNCTION update_user_has_profile_on_profile_change()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
    curr_metadata JSONB;
    new_metadata JSONB;
BEGIN
    -- Set user_id based on whether this is an INSERT, UPDATE or DELETE operation
    IF TG_OP = 'DELETE' THEN
        user_id := OLD.user_id;
    ELSE
        user_id := NEW.user_id;
    END IF;
    
    -- Get current metadata
    SELECT raw_user_meta_data INTO curr_metadata 
    FROM auth.users 
    WHERE id = user_id;
    
    IF curr_metadata IS NULL THEN
        -- Skip if user not found
        RETURN NULL;
    END IF;
    
    -- For INSERT/UPDATE, set hasProfile to true
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        new_metadata := jsonb_set(
            curr_metadata, 
            '{hasProfile}', 
            'true'::jsonb, 
            true
        );
        
        UPDATE auth.users 
        SET raw_user_meta_data = new_metadata 
        WHERE id = user_id;
        
    -- For DELETE, check if any profiles still exist
    ELSIF TG_OP = 'DELETE' THEN
        -- Check if user has any other profiles
        IF NOT EXISTS (SELECT 1 FROM jobseeker_profiles WHERE user_id = user_id) THEN
            -- If no profiles left, set hasProfile to false
            new_metadata := jsonb_set(
                curr_metadata, 
                '{hasProfile}', 
                'false'::jsonb, 
                true
            );
            
            UPDATE auth.users 
            SET raw_user_meta_data = new_metadata 
            WHERE id = user_id;
        END IF;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for INSERT, UPDATE and DELETE
CREATE TRIGGER trg_jobseeker_profile_insert
AFTER INSERT ON jobseeker_profiles
FOR EACH ROW 
EXECUTE FUNCTION update_user_has_profile_on_profile_change();

CREATE TRIGGER trg_jobseeker_profile_update
AFTER UPDATE OF user_id ON jobseeker_profiles
FOR EACH ROW 
EXECUTE FUNCTION update_user_has_profile_on_profile_change();

CREATE TRIGGER trg_jobseeker_profile_delete
AFTER DELETE ON jobseeker_profiles
FOR EACH ROW 
EXECUTE FUNCTION update_user_has_profile_on_profile_change(); 