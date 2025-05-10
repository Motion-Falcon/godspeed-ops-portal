-- SQL for the migration file: YYYYMMDDHHMMSS_add_storage_rls_policies.sql
-- Replace YYYYMMDDHHMMSS with the actual timestamp when running migrations

-- RLS policies for jobseeker-documents bucket

-- Drop policies first if they exist to ensure idempotency
DROP POLICY IF EXISTS "Allow authenticated users to upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to select own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete own documents" ON storage.objects;

-- Create the policy for INSERT (Upload)
CREATE POLICY "Allow authenticated users to upload own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'jobseeker-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create the policy for SELECT (Download/View)
CREATE POLICY "Allow authenticated users to select own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'jobseeker-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create the policy for UPDATE (Replace)
CREATE POLICY "Allow authenticated users to update own documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'jobseeker-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'jobseeker-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create the policy for DELETE
CREATE POLICY "Allow authenticated users to delete own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'jobseeker-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
); 