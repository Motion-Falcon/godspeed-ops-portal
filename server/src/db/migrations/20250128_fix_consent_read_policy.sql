-- Fix consent documents read policy to allow both authenticated and anonymous users
-- The current policy only allows anonymous users, but authenticated users also need access

-- Drop the existing public read policy
DROP POLICY IF EXISTS "Allow public access to view consent documents" ON storage.objects;

-- Create a new policy that allows both authenticated and anonymous users
CREATE POLICY "Allow public and authenticated access to view consent documents"
    ON storage.objects
    FOR SELECT
    TO public  -- This includes both authenticated and anon
    USING (
        bucket_id = 'consent-documents'
    );
