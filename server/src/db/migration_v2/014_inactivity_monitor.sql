-- Migration: Inactivity Monitor for Clients (30 days) and Jobseekers (60 days)
-- Adds last_activity_at column to clients and jobseeker_profiles tables
-- Creates triggers to auto-update last_activity_at on related entity actions

-- ============================================================================
-- STEP 1: Add last_activity_at columns
-- ============================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.jobseeker_profiles
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

-- Add indexes for efficient inactivity queries
CREATE INDEX IF NOT EXISTS idx_clients_last_activity_at
  ON public.clients(last_activity_at);

CREATE INDEX IF NOT EXISTS idx_jobseeker_profiles_last_activity_at
  ON public.jobseeker_profiles(last_activity_at);

-- ============================================================================
-- STEP 2: Backfill existing records from recent_activities
-- ============================================================================

-- Backfill clients: use the most recent activity referencing the client,
-- falling back to updated_at, then created_at
UPDATE public.clients c
SET last_activity_at = COALESCE(
  (
    SELECT MAX(ra.created_at)
    FROM public.recent_activities ra
    WHERE ra.is_deleted = FALSE
      AND (
        (ra.primary_entity_type = 'client' AND ra.primary_entity_id = c.id)
        OR (ra.secondary_entity_type = 'client' AND ra.secondary_entity_id = c.id)
        OR (ra.tertiary_entity_type = 'client' AND ra.tertiary_entity_id = c.id)
      )
  ),
  c.updated_at,
  c.created_at
);

-- Backfill jobseekers: use the most recent activity referencing the jobseeker,
-- falling back to updated_at, then created_at
UPDATE public.jobseeker_profiles jp
SET last_activity_at = COALESCE(
  (
    SELECT MAX(ra.created_at)
    FROM public.recent_activities ra
    WHERE ra.is_deleted = FALSE
      AND (
        (ra.primary_entity_type = 'jobseeker' AND ra.primary_entity_id = jp.id)
        OR (ra.secondary_entity_type = 'jobseeker' AND ra.secondary_entity_id = jp.id)
        OR (ra.tertiary_entity_type = 'jobseeker' AND ra.tertiary_entity_id = jp.id)
      )
  ),
  jp.updated_at,
  jp.created_at
);

-- ============================================================================
-- STEP 3: Trigger function to update client last_activity_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_client_last_activity()
RETURNS TRIGGER AS $$
DECLARE
  target_client_id UUID;
BEGIN
  -- Determine the client ID based on the source table
  CASE TG_TABLE_NAME
    WHEN 'clients' THEN
      -- Direct client update
      target_client_id := NEW.id;

    WHEN 'positions' THEN
      -- Position created/updated for a client
      target_client_id := NEW.client;

    WHEN 'timesheets' THEN
      -- Timesheet created/updated → resolve client via position
      IF NEW.position_id IS NOT NULL THEN
        SELECT p.client INTO target_client_id
        FROM public.positions p
        WHERE p.id = NEW.position_id;
      END IF;

    WHEN 'invoices' THEN
      -- Invoice created/updated for a client
      target_client_id := NEW.client_id;

    WHEN 'position_candidate_assignments' THEN
      -- Jobseeker assigned to a position → resolve client via position
      IF NEW.position_id IS NOT NULL THEN
        SELECT p.client INTO target_client_id
        FROM public.positions p
        WHERE p.id = NEW.position_id;
      END IF;
  END CASE;

  -- Update the client's last_activity_at if we found a valid client
  IF target_client_id IS NOT NULL THEN
    UPDATE public.clients
    SET last_activity_at = NOW()
    WHERE id = target_client_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Trigger function to update jobseeker last_activity_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_jobseeker_last_activity()
RETURNS TRIGGER AS $$
DECLARE
  target_jobseeker_id UUID;
  ts_element JSONB;
BEGIN
  -- Determine the jobseeker profile ID based on the source table
  CASE TG_TABLE_NAME
    WHEN 'jobseeker_profiles' THEN
      -- Direct jobseeker profile update
      target_jobseeker_id := NEW.id;

    WHEN 'timesheets' THEN
      -- Timesheet created/updated for a jobseeker
      target_jobseeker_id := NEW.jobseeker_profile_id;

    WHEN 'position_candidate_assignments' THEN
      -- Jobseeker assigned to a position (candidate_id is auth.users.id, not jobseeker_profiles.id)
      IF NEW.candidate_id IS NOT NULL THEN
        UPDATE public.jobseeker_profiles
        SET last_activity_at = NOW()
        WHERE user_id = NEW.candidate_id;
      END IF;
      RETURN NEW;

    WHEN 'invoices' THEN
      -- Invoice created/updated → extract all jobseeker IDs from JSONB timesheets array
      IF NEW.invoice_data IS NOT NULL AND NEW.invoice_data -> 'timesheets' IS NOT NULL THEN
        FOR ts_element IN SELECT jsonb_array_elements(NEW.invoice_data -> 'timesheets')
        LOOP
          IF ts_element -> 'jobseekerProfile' ->> 'jobseekerProfileId' IS NOT NULL THEN
            UPDATE public.jobseeker_profiles
            SET last_activity_at = NOW()
            WHERE id = (ts_element -> 'jobseekerProfile' ->> 'jobseekerProfileId')::UUID;
          END IF;
        END LOOP;
      END IF;
      -- Already handled all jobseekers in the loop, skip the single-update below
      RETURN NEW;
  END CASE;

  -- Update the jobseeker's last_activity_at if we found a valid ID
  IF target_jobseeker_id IS NOT NULL THEN
    UPDATE public.jobseeker_profiles
    SET last_activity_at = NOW()
    WHERE id = target_jobseeker_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: Create triggers on relevant tables for CLIENT activity
-- ============================================================================

-- Trigger on clients table (UPDATE only — create sets default NOW())
DROP TRIGGER IF EXISTS trg_client_activity_on_client_update ON public.clients;
CREATE TRIGGER trg_client_activity_on_client_update
  AFTER UPDATE ON public.clients
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION update_client_last_activity();

-- Trigger on positions table (INSERT and UPDATE)
DROP TRIGGER IF EXISTS trg_client_activity_on_position ON public.positions;
CREATE TRIGGER trg_client_activity_on_position
  AFTER INSERT OR UPDATE ON public.positions
  FOR EACH ROW
  EXECUTE FUNCTION update_client_last_activity();

-- Trigger on timesheets table for client activity (INSERT and UPDATE)
DROP TRIGGER IF EXISTS trg_client_activity_on_timesheet ON public.timesheets;
CREATE TRIGGER trg_client_activity_on_timesheet
  AFTER INSERT OR UPDATE ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION update_client_last_activity();

-- Trigger on invoices table (INSERT and UPDATE)
DROP TRIGGER IF EXISTS trg_client_activity_on_invoice ON public.invoices;
CREATE TRIGGER trg_client_activity_on_invoice
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_client_last_activity();

-- Trigger on position_candidate_assignments for client activity (INSERT)
DROP TRIGGER IF EXISTS trg_client_activity_on_assignment ON public.position_candidate_assignments;
CREATE TRIGGER trg_client_activity_on_assignment
  AFTER INSERT ON public.position_candidate_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_client_last_activity();

-- ============================================================================
-- STEP 6: Create triggers on relevant tables for JOBSEEKER activity
-- ============================================================================

-- Trigger on jobseeker_profiles table (UPDATE only — create sets default NOW())
DROP TRIGGER IF EXISTS trg_jobseeker_activity_on_profile_update ON public.jobseeker_profiles;
CREATE TRIGGER trg_jobseeker_activity_on_profile_update
  AFTER UPDATE ON public.jobseeker_profiles
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION update_jobseeker_last_activity();

-- Trigger on timesheets table for jobseeker activity (INSERT and UPDATE)
DROP TRIGGER IF EXISTS trg_jobseeker_activity_on_timesheet ON public.timesheets;
CREATE TRIGGER trg_jobseeker_activity_on_timesheet
  AFTER INSERT OR UPDATE ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION update_jobseeker_last_activity();

-- Trigger on position_candidate_assignments for jobseeker activity (INSERT)
DROP TRIGGER IF EXISTS trg_jobseeker_activity_on_assignment ON public.position_candidate_assignments;
CREATE TRIGGER trg_jobseeker_activity_on_assignment
  AFTER INSERT ON public.position_candidate_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_jobseeker_last_activity();

-- Trigger on invoices table for jobseeker activity (INSERT and UPDATE)
DROP TRIGGER IF EXISTS trg_jobseeker_activity_on_invoice ON public.invoices;
CREATE TRIGGER trg_jobseeker_activity_on_invoice
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_jobseeker_last_activity();
