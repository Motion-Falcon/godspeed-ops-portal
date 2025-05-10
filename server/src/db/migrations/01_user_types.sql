-- Migration to enforce user types in auth.users table
-- Note: Supabase handles auth.users table automatically through Auth API
-- This migration adds role-based access functions and policies

-- Create an enum for user types if it doesn't exist yet
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('jobseeker', 'recruiter', 'admin');
    END IF;
END$$;

-- Function to get user role from the metadata
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS public.user_role
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT 
        CASE 
            WHEN raw_user_meta_data->>'user_type' = 'admin' THEN 'admin'::public.user_role
            WHEN raw_user_meta_data->>'user_type' = 'recruiter' THEN 'recruiter'::public.user_role
            ELSE 'jobseeker'::public.user_role
        END
    FROM auth.users
    WHERE id = user_id;
$$;

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(role public.user_role)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT 
        CASE 
            WHEN role = 'admin' THEN 
                (SELECT raw_user_meta_data->>'user_type' = 'admin' FROM auth.users WHERE id = auth.uid())
            WHEN role = 'recruiter' THEN 
                (SELECT raw_user_meta_data->>'user_type' IN ('recruiter', 'admin') FROM auth.users WHERE id = auth.uid())
            WHEN role = 'jobseeker' THEN 
                (SELECT raw_user_meta_data->>'user_type' = 'jobseeker' FROM auth.users WHERE id = auth.uid())
            ELSE false
        END;
$$;

-- Create a function to check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT has_role('admin'::public.user_role);
$$;

-- Create a function to check if the current user is a recruiter
CREATE OR REPLACE FUNCTION public.is_recruiter()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT has_role('recruiter'::public.user_role);
$$;

-- Create a function to check if the current user is a jobseeker
CREATE OR REPLACE FUNCTION public.is_jobseeker()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT has_role('jobseeker'::public.user_role);
$$; 