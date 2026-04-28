-- Rename subcategory_portion -> subcategory_position; child table for per-type details; draft JSONB.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'positions' AND column_name = 'subcategory_portion'
  ) THEN
    ALTER TABLE public.positions RENAME COLUMN subcategory_portion TO subcategory_position;
  END IF;
END $$;

COMMENT ON COLUMN public.positions.subcategory_position IS
  'For is_subcategory positions: one or more labels from configurable dropdown (list_type subcategory_position); NULL for regular positions.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'position_drafts' AND column_name = 'subcategory_portion'
  ) THEN
    ALTER TABLE public.position_drafts RENAME COLUMN subcategory_portion TO subcategory_position;
  END IF;
END $$;

COMMENT ON COLUMN public.position_drafts.subcategory_position IS
  'Draft copy of subcategory_position (text[]) when applicable.';

UPDATE public.client_dropdown_options SET list_type = 'subcategory_position' WHERE list_type = 'subcategory_portion';

ALTER TABLE public.position_drafts
  ADD COLUMN IF NOT EXISTS subcategory_position_details JSONB DEFAULT NULL;

COMMENT ON COLUMN public.position_drafts.subcategory_position_details IS
  'Draft-only: array of per–subcategory-position-type rate rows until the draft is saved as a position.';

CREATE TABLE IF NOT EXISTS public.position_subcategory_position_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  subcategory_position VARCHAR(100) NOT NULL,
  payrate_type VARCHAR(50) NOT NULL,
  number_of_positions INTEGER NOT NULL,
  regular_pay_rate VARCHAR(50) NOT NULL,
  premium_pay_rate VARCHAR(50),
  markup VARCHAR(50),
  bill_rate VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(position_id, subcategory_position)
);

CREATE INDEX IF NOT EXISTS idx_position_subcat_details_position_id
  ON public.position_subcategory_position_details(position_id);

COMMENT ON TABLE public.position_subcategory_position_details IS
  'Per selected subcategory position type (Bonus, Miles, …): rate rows. Main positions row duplicates the first row for legacy readers.';
COMMENT ON COLUMN public.position_subcategory_position_details.subcategory_position IS
  'Label matching an element of positions.subcategory_position and client_dropdown_options (list_type subcategory_position).';

ALTER TABLE public.position_subcategory_position_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and recruiters can view position subcategory details" ON public.position_subcategory_position_details;
DROP POLICY IF EXISTS "Admins and recruiters can insert position subcategory details" ON public.position_subcategory_position_details;
DROP POLICY IF EXISTS "Admins and recruiters can update position subcategory details" ON public.position_subcategory_position_details;
DROP POLICY IF EXISTS "Admins and recruiters can delete position subcategory details" ON public.position_subcategory_position_details;

CREATE POLICY "Admins and recruiters can view position subcategory details"
  ON public.position_subcategory_position_details FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Admins and recruiters can insert position subcategory details"
  ON public.position_subcategory_position_details FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Admins and recruiters can update position subcategory details"
  ON public.position_subcategory_position_details FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );

CREATE POLICY "Admins and recruiters can delete position subcategory details"
  ON public.position_subcategory_position_details FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'user_type' IN ('admin', 'recruiter')
    )
  );
