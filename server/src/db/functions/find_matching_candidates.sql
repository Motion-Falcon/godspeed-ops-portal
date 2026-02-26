-- Git record: find_matching_candidates (Supabase RPC)
-- Used by: GET /api/jobseekers/position-candidates/:positionId
-- Position matching: returns candidates with similarity score and is_available.
-- Stored as-is from Supabase for version control.

CREATE OR REPLACE FUNCTION public.find_matching_candidates(p_position_id uuid, p_limit integer DEFAULT 25, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(candidate_id uuid, first_name text, last_name text, email text, mobile text, bio text, experience text, weekend_availability boolean, availability text, similarity_score double precision, is_available boolean)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_position_embedding vector;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- Get position details
    SELECT 
        p.job_embedding,
        p.start_date,
        p.end_date
    INTO 
        v_position_embedding,
        v_start_date,
        v_end_date
    FROM positions p
    WHERE p.id = p_position_id;
    
    -- Return matching candidates
    RETURN QUERY
    WITH available_candidates AS (
        SELECT 
            jp.user_id,
            jp.id,
            jp.first_name,
            jp.last_name,
            jp.email,
            jp.mobile,
            jp.bio,
            jp.experience,
            jp.weekend_availability,
            jp.availability,
            jp.bio_embedding,
            TRUE AS is_available
        FROM jobseeker_profiles jp
        -- LEFT JOIN: if match found, candidate is busy; NULL means available
        LEFT JOIN position_candidate_assignments pca
            ON pca.candidate_id = jp.user_id  -- Now correctly using user_id
            AND pca.status IN ('active', 'upcoming')
            AND daterange(pca.start_date, COALESCE(pca.end_date, 'infinity'::date), '[]') 
                && daterange(v_start_date, COALESCE(v_end_date, 'infinity'::date), '[]')
        WHERE jp.verification_status = 'verified'
        AND jp.bio_embedding IS NOT NULL
    ),
    filtered_candidates AS (
        SELECT *
        FROM available_candidates ac
        WHERE 
            -- Apply dynamic filters from JSONB
            (p_filters->>'weekend_availability' IS NULL OR 
             ac.weekend_availability = (p_filters->>'weekend_availability')::BOOLEAN)
            AND
            (p_filters->>'experience' IS NULL OR 
             ac.experience = p_filters->>'experience')
            AND
            (p_filters->>'availability' IS NULL OR 
             ac.availability = p_filters->>'availability')
            AND
            (p_filters->>'city' IS NULL OR 
             EXISTS (
                SELECT 1 FROM jobseeker_profiles jp2 
                WHERE jp2.id = ac.id 
                AND LOWER(jp2.city) = LOWER(p_filters->>'city')
             ))
            AND
            (p_filters->>'province' IS NULL OR 
             EXISTS (
                SELECT 1 FROM jobseeker_profiles jp2 
                WHERE jp2.id = ac.id 
                AND LOWER(jp2.province) = LOWER(p_filters->>'province')
             ))
            AND
            (p_filters->>'only_available' IS NULL OR 
             p_filters->>'only_available' = 'false' OR 
             ac.is_available = TRUE)
    )
    SELECT 
        fc.user_id AS candidate_id,  -- Return user_id as candidate_id
        fc.first_name,
        fc.last_name,
        fc.email,
        fc.mobile,
        fc.bio,
        fc.experience,
        fc.weekend_availability,
        fc.availability,
        1 - (fc.bio_embedding <=> v_position_embedding) AS similarity_score,
        fc.is_available
    FROM filtered_candidates fc
    WHERE v_position_embedding IS NOT NULL
    ORDER BY 
        1 - (fc.bio_embedding <=> v_position_embedding) DESC -- Then by similarity
    LIMIT p_limit;
END;
$function$;
