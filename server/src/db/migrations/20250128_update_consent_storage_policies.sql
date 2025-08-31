-- Digital Consent Feature: Updated Storage RLS Policies
-- Run this with the Service Role key (or via the Supabase Dashboard "Run as admin")
-- Updates consent-documents bucket policies to use simplified authentication

-- Drop any existing consent‑documents policies (idempotent)
DROP POLICY IF EXISTS "Admins and recruiters can upload consent documents"
    ON storage.objects;
DROP POLICY IF EXISTS "Admins and recruiters can view consent documents"
    ON storage.objects;
DROP POLICY IF EXISTS "Admins and recruiters can update consent documents"
    ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete consent documents"
    ON storage.objects;
DROP POLICY IF EXISTS "Public can view consent documents for consent process"
    ON storage.objects;

-- Policy for uploading consent documents (any authenticated user)
CREATE POLICY "Allow authenticated users to upload consent documents"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'consent-documents'
    );

-- Policy for viewing consent documents (public access for consent process)
CREATE POLICY "Allow public access to view consent documents"
    ON storage.objects
    FOR SELECT
    TO anon
    USING (
        bucket_id = 'consent-documents'
    );

-- Policy for updating consent documents (any authenticated user)
CREATE POLICY "Allow authenticated users to update consent documents"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'consent-documents'
    )
    WITH CHECK (
        bucket_id = 'consent-documents'
    );

-- Policy for deleting consent documents (any authenticated user)
CREATE POLICY "Allow authenticated users to delete consent documents"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'consent-documents'
    );