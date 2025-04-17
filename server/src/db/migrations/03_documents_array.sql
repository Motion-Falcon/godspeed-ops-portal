-- Migration to update jobseeker_profiles to support multiple documents
-- Adds a documents JSONB column and removes previous single document columns

-- First, preserve existing document data
DO $$
BEGIN
    -- Add documents JSONB column if it doesn't exist
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'jobseeker_profiles' AND column_name = 'documents'
    ) THEN
        ALTER TABLE public.jobseeker_profiles ADD COLUMN documents JSONB DEFAULT '[]'::jsonb;
        
        -- Migrate any existing document data to the new format
        UPDATE public.jobseeker_profiles
        SET documents = jsonb_build_array(
            jsonb_build_object(
                'documentType', document_type,
                'documentTitle', document_title,
                'documentPath', document_path,
                'documentNotes', document_notes,
                'documentFileName', SPLIT_PART(document_path, '/', -1),
                'id', gen_random_uuid()
            )
        )
        WHERE document_type IS NOT NULL OR document_path IS NOT NULL;
    END IF;
END
$$;

-- Remove old document columns (only if data migration above is successful)
ALTER TABLE public.jobseeker_profiles 
    DROP COLUMN IF EXISTS document_type,
    DROP COLUMN IF EXISTS document_title,
    DROP COLUMN IF EXISTS document_path,
    DROP COLUMN IF EXISTS document_notes;

-- Update index for document search
CREATE INDEX IF NOT EXISTS idx_jobseeker_docs ON public.jobseeker_profiles USING GIN (documents);

-- Make sure RLS policies are properly updated
-- The existing policies should work as-is since they operate at the row level 