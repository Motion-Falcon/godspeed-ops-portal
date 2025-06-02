-- Comprehensive script to create/fix the get_user_id_by_email function
-- This script can be run multiple times safely

-- First, drop the function if it exists to ensure a clean slate
DROP FUNCTION IF EXISTS public.get_user_id_by_email(TEXT);

-- Create the function with correct syntax
CREATE FUNCTION public.get_user_id_by_email(user_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Find the user with the given email
    RETURN (
        SELECT id
        FROM auth.users
        WHERE email = user_email
        LIMIT 1
    );
END;
$$;

-- Add comment to document the function
COMMENT ON FUNCTION public.get_user_id_by_email(TEXT) IS 'Looks up a user ID by email address. Returns NULL if no user is found.';

-- Create phone lookup function
DROP FUNCTION IF EXISTS public.get_user_id_by_phone(TEXT);

CREATE FUNCTION public.get_user_id_by_phone(user_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Find the user with the given phone number
    -- Check both the phone field and phoneNumber in user_metadata
    RETURN (
        SELECT id
        FROM auth.users
        WHERE phone = user_phone 
           OR raw_user_meta_data->>'phoneNumber' = user_phone
        LIMIT 1
    );
END;
$$;

-- Add comment to document the function
COMMENT ON FUNCTION public.get_user_id_by_phone(TEXT) IS 'Looks up a user ID by phone number. Checks both phone field and phoneNumber in user_metadata. Returns NULL if no user is found.';

-- Notify of successful function creation/update
DO $$
BEGIN
    RAISE NOTICE 'Functions get_user_id_by_email and get_user_id_by_phone have been created/updated successfully';
END $$;