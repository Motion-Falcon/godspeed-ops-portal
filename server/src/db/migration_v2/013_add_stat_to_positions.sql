-- Add stat (STAT Yes/No) column to positions and position_drafts for existing databases
-- New installs get this via 004_clients_and_positions.sql; this migration is for existing DBs.

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS stat BOOLEAN DEFAULT FALSE;

ALTER TABLE public.position_drafts
  ADD COLUMN IF NOT EXISTS stat BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.positions.stat IS 'Whether this position is STAT (Yes/No)';
COMMENT ON COLUMN public.position_drafts.stat IS 'Whether this position is STAT (Yes/No)';
