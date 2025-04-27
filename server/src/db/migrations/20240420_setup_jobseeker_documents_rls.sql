-- Migration: 20240420_setup_jobseeker_documents_rls.sql
-- Description: Sets up Row Level Security policies for the jobseeker-documents storage bucket

-- NOTE: This migration assumes the 'jobseeker-documents' bucket has already been created
-- using the Supabase API or Dashboard as described in the previous migration.

-- Enable RLS on the storage.objects table if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- First drop existing policies
DROP POLICY IF EXISTS "Allow users to upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow recruiters and admins to access all documents" ON storage.objects;

-- Set up more permissive policies
-- 1. Create a policy that allows all authenticated users to insert files
CREATE POLICY "Allow authenticated users to upload documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'jobseeker-documents');

-- 2. Create a policy that allows authenticated users to select files
CREATE POLICY "Allow authenticated users to view documents" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'jobseeker-documents');

-- 3. Create a policy that allows authenticated users to update files
CREATE POLICY "Allow authenticated users to update documents" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'jobseeker-documents')
WITH CHECK (bucket_id = 'jobseeker-documents');

-- 4. Create a policy that allows authenticated users to delete files
CREATE POLICY "Allow authenticated users to delete documents" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'jobseeker-documents');

-- 5. Create a policy that allows anonymous users to select files (for public sharing)
CREATE POLICY "Allow anonymous users to view documents" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'jobseeker-documents');

-- Create a comment to document this migration
COMMENT ON TABLE storage.objects IS 'RLS policies for jobseeker-documents bucket added on 2024-04-20.'; 