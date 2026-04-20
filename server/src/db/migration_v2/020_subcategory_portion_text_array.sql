-- Store multiple subcategory position types per position (was single VARCHAR).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'positions'
      AND column_name = 'subcategory_portion'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE public.positions
      ALTER COLUMN subcategory_portion TYPE text[]
      USING (
        CASE
          WHEN subcategory_portion IS NULL THEN NULL
          WHEN trim(subcategory_portion::text) = '' THEN NULL
          ELSE ARRAY[trim(subcategory_portion::text)]
        END
      );
  END IF;
END $$;

COMMENT ON COLUMN public.positions.subcategory_portion IS
  'For is_subcategory positions: one or more labels from configurable dropdown (list_type subcategory_portion); NULL for regular positions.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'position_drafts'
      AND column_name = 'subcategory_portion'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE public.position_drafts
      ALTER COLUMN subcategory_portion TYPE text[]
      USING (
        CASE
          WHEN subcategory_portion IS NULL THEN NULL
          WHEN trim(subcategory_portion::text) = '' THEN NULL
          ELSE ARRAY[trim(subcategory_portion::text)]
        END
      );
  END IF;
END $$;

COMMENT ON COLUMN public.position_drafts.subcategory_portion IS
  'Draft copy of subcategory_portion (text[]) when applicable.';
