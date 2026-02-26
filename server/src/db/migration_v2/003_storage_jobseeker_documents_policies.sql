-- Consolidated migration_v2: storage policies for jobseeker-documents

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to view their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow recruiters and admins to access all documents" ON storage.objects;

DROP POLICY IF EXISTS "Allow authenticated users to upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to select own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete own documents" ON storage.objects;

DROP POLICY IF EXISTS "Allow authenticated users to upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous users to view documents" ON storage.objects;

CREATE POLICY "Allow authenticated users to upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'jobseeker-documents');

CREATE POLICY "Allow authenticated users to view documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'jobseeker-documents');

CREATE POLICY "Allow authenticated users to update documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'jobseeker-documents')
WITH CHECK (bucket_id = 'jobseeker-documents');

CREATE POLICY "Allow authenticated users to delete documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'jobseeker-documents');

CREATE POLICY "Allow anonymous users to view documents"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'jobseeker-documents');
