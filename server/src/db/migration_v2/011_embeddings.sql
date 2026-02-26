-- Consolidated migration_v2: embeddings (from live DB + AI repo schema usage)

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE public.jobseeker_profiles
  ADD COLUMN IF NOT EXISTS bio_embedding extensions.vector(1536);

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS job_embedding extensions.vector(1536);

CREATE INDEX IF NOT EXISTS jobseeker_profiles_bio_embedding_idx
  ON public.jobseeker_profiles
  USING hnsw (bio_embedding extensions.vector_cosine_ops);

CREATE INDEX IF NOT EXISTS positions_job_embedding_idx
  ON public.positions
  USING hnsw (job_embedding extensions.vector_cosine_ops);

DROP TRIGGER IF EXISTS embed_bio_on_insert ON public.jobseeker_profiles;
DROP TRIGGER IF EXISTS embed_bio_on_update ON public.jobseeker_profiles;

DO $$
BEGIN
  IF to_regprocedure('util.queue_embeddings()') IS NOT NULL THEN
    CREATE TRIGGER embed_bio_on_insert
      AFTER INSERT ON public.jobseeker_profiles
      FOR EACH ROW
      EXECUTE FUNCTION util.queue_embeddings('embedding_input_jobseeker_bio', 'bio_embedding');

    CREATE TRIGGER embed_bio_on_update
      AFTER UPDATE OF bio ON public.jobseeker_profiles
      FOR EACH ROW
      EXECUTE FUNCTION util.queue_embeddings('embedding_input_jobseeker_bio', 'bio_embedding');
  ELSE
    RAISE NOTICE 'util.queue_embeddings() not found; embedding triggers were skipped.';
  END IF;
END
$$;

COMMENT ON COLUMN public.jobseeker_profiles.bio_embedding IS 'Vector embedding (1536 dims) for semantic profile matching';
COMMENT ON COLUMN public.positions.job_embedding IS 'Vector embedding (1536 dims) for semantic job matching';
