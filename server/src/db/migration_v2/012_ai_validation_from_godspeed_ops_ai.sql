-- Consolidated migration_v2: AI validation table (ported from GodspeedOps AI schema usage)

CREATE TABLE IF NOT EXISTS public.ai_validation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL,
  ai_response JSONB NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  llm_model_name TEXT NOT NULL DEFAULT 'gpt-4o',
  document_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_validation_user_document_unique UNIQUE (user_id, document_id),
  CONSTRAINT ai_validation_document_status_check CHECK (document_status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_ai_validation_user_id ON public.ai_validation(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_validation_document_status ON public.ai_validation(document_status);
CREATE INDEX IF NOT EXISTS idx_ai_validation_created_at ON public.ai_validation(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_validation_ai_response ON public.ai_validation USING GIN(ai_response);

CREATE OR REPLACE FUNCTION public.update_ai_validation_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_ai_validation_updated_at ON public.ai_validation;

CREATE TRIGGER update_ai_validation_updated_at
BEFORE UPDATE ON public.ai_validation
FOR EACH ROW
EXECUTE FUNCTION public.update_ai_validation_updated_at_column();

ALTER TABLE public.ai_validation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ai validation" ON public.ai_validation;
DROP POLICY IF EXISTS "Users can insert own ai validation" ON public.ai_validation;
DROP POLICY IF EXISTS "Users can update own ai validation" ON public.ai_validation;
DROP POLICY IF EXISTS "Service role can do anything with ai validation" ON public.ai_validation;

CREATE POLICY "Users can view own ai validation"
  ON public.ai_validation FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai validation"
  ON public.ai_validation FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai validation"
  ON public.ai_validation FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can do anything with ai validation"
  ON public.ai_validation FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE public.ai_validation IS 'AI document validation records used by GodspeedOps AI service.';
COMMENT ON COLUMN public.ai_validation.document_id IS 'Document UUID/string as passed from profile documents payload.';
COMMENT ON COLUMN public.ai_validation.ai_response IS 'Structured model output (authentication %, tampering flags, notes, etc.)';
