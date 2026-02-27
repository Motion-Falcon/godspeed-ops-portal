-- Add stat (STAT Yes/No) column to positions and position_drafts
-- Use IF NOT EXISTS so this is safe to run on DBs that already have the column (e.g. from migration_v2).

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS stat BOOLEAN DEFAULT FALSE;

ALTER TABLE public.position_drafts
  ADD COLUMN IF NOT EXISTS stat BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.positions.stat IS 'Whether this position is STAT (Yes/No)';
COMMENT ON COLUMN public.position_drafts.stat IS 'Whether this position is STAT (Yes/No)';
