import { useCallback, useEffect, useMemo, useState } from "react";
import type { WeekTimesheetRecord } from "../types";
import {
  fetchJobseekerWeekTimesheets,
  filterTimesheetsForWeekAndPosition,
} from "../functions/timesheetWeek";

export interface UseJobseekerWeekTimesheetsParams {
  /** Auth user id (candidate_id), not profile id */
  jobseekerUserId?: string | null;
  weekStartDate?: string | null;
  positionId?: string | null;
  /** When false, skips fetch even if ids are set */
  enabled?: boolean;
}

export interface UseJobseekerWeekTimesheetsResult {
  /** All timesheet rows returned for this jobseeker in the selected week */
  weekTimesheets: WeekTimesheetRecord[];
  /** Rows matching weekStartDate + positionId (empty if position not selected) */
  matchingTimesheets: WeekTimesheetRecord[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches timesheets for a jobseeker for the selected week and exposes
 * rows filtered to the current position (supports hybrid multi-row weeks).
 */
export function useJobseekerWeekTimesheets({
  jobseekerUserId,
  weekStartDate,
  positionId,
  enabled = true,
}: UseJobseekerWeekTimesheetsParams): UseJobseekerWeekTimesheetsResult {
  const [weekTimesheets, setWeekTimesheets] = useState<WeekTimesheetRecord[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canFetch = Boolean(
    enabled && jobseekerUserId && weekStartDate
  );

  const refetch = useCallback(async () => {
    if (!canFetch || !jobseekerUserId || !weekStartDate) {
      setWeekTimesheets([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rows = await fetchJobseekerWeekTimesheets(
        jobseekerUserId,
        weekStartDate
      );
      setWeekTimesheets(rows);
    } catch (err) {
      console.error("Error fetching jobseeker week timesheets:", err);
      setWeekTimesheets([]);
      setError(
        err instanceof Error ? err.message : "Failed to load timesheets"
      );
    } finally {
      setLoading(false);
    }
  }, [canFetch, jobseekerUserId, weekStartDate]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const matchingTimesheets = useMemo(() => {
    if (!weekStartDate || !positionId) {
      return [];
    }
    return filterTimesheetsForWeekAndPosition(
      weekTimesheets,
      weekStartDate,
      positionId
    );
  }, [weekTimesheets, weekStartDate, positionId]);

  return {
    weekTimesheets,
    matchingTimesheets,
    loading,
    error,
    refetch,
  };
}
