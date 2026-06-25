-- Migration: Purge cron.job_run_details log bloat and add auto-cleanup job
-- The cron.job_run_details table (pg_cron extension) accumulates a log row for
-- every scheduled job execution. With jobs running every 10 seconds this table
-- can grow to hundreds of MB with no automatic cleanup. This migration:
--   1. Clears all historical run logs (safe: purely observability data)
--   2. Schedules a weekly purge cron job to keep only the last 7 days of logs

-- ============================================================================
-- STEP 1: Clear accumulated log history
-- ============================================================================

-- Safe to truncate: cron.job_run_details is a diagnostic log only.
-- It has no FK dependencies and no impact on app data or scheduled jobs.
TRUNCATE cron.job_run_details;

-- ============================================================================
-- STEP 2: Schedule weekly auto-purge (runs every Sunday at 3:00 AM UTC)
-- ============================================================================

-- Remove existing purge job if it was previously added (idempotent)
SELECT cron.unschedule('purge-cron-job-run-details')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'purge-cron-job-run-details'
);

SELECT cron.schedule(
  'purge-cron-job-run-details',
  '0 3 * * 0',
  $$
    DELETE FROM cron.job_run_details
    WHERE end_time < NOW() - INTERVAL '7 days';
  $$
);

-- ============================================================================
-- Verification queries (uncomment to test after running migration)
-- ============================================================================

-- Confirm table is cleared:
-- SELECT COUNT(*) FROM cron.job_run_details;

-- Confirm purge job was registered:
-- SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname = 'purge-cron-job-run-details';
