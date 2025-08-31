-- Digital Consent Feature: Storage RLS Policies
-- Run this with the Service Role key (or via the Supabase Dashboard “Run as admin”)
-- No ALTER TABLE needed – storage.objects already has RLS enabled.

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

-- Policy for uploading consent documents (admins and recruiters only)
CREATE POLICY "Admins and recruiters can upload consent documents"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'consent-documents' AND
        auth.uid() IN (
            SELECT id FROM auth.users
            WHERE raw_user_meta_data->>'user_type' IN ('admin','recruiter')
        )
    );

-- Policy for viewing consent documents (admins and recruiters)
CREATE POLICY "Admins and recruiters can view consent documents"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'consent-documents' AND
        auth.uid() IN (
            SELECT id FROM auth.users
            WHERE raw_user_meta_data->>'user_type' IN ('admin','recruiter')
        )
    );

-- Policy for updating consent documents (admins and recruiters only)
CREATE POLICY "Admins and recruiters can update consent documents"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'consent-documents' AND
        auth.uid() IN (
            SELECT id FROM auth.users
            WHERE raw_user_meta_data->>'user_type' IN ('admin','recruiter')
        )
    )
    WITH CHECK (
        bucket_id = 'consent-documents' AND
        auth.uid() IN (
            SELECT id FROM auth.users
            WHERE raw_user_meta_data->>'user_type' IN ('admin','recruiter')
        )
    );

-- Policy for deleting consent documents (admins only)
CREATE POLICY "Only admins can delete consent documents"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'consent-documents' AND
        auth.uid() IN (
            SELECT id FROM auth.users
            WHERE raw_user_meta_data->>'user_type' = 'admin'
        )
    );

-- Public read‑only access for the consent process (anonymous users)
CREATE POLICY "Public can view consent documents for consent process"
    ON storage.objects
    FOR SELECT
    TO anon
    USING (
        bucket_id = 'consent-documents'
        -- Additional validation is handled in the app layer
    );