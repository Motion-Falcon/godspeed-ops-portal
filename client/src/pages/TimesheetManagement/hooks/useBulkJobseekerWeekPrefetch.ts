import { useCallback, useEffect, useState } from "react";
import type { AssignmentRecord } from "../../../services/api/position";
import {
  fetchWeekTimesheetsForJobseekers,
  filterTimesheetsForWeekAndPosition,
} from "../functions/timesheetWeek";
import type { WeekTimesheetRecord } from "../types";

export interface UseBulkJobseekerWeekPrefetchParams {
  assignments: AssignmentRecord[];
  weekStartDate: string;
  positionId: string | undefined;
  enabled?: boolean;
}

export function useBulkJobseekerWeekPrefetch({
  assignments,
  weekStartDate,
  positionId,
  enabled = true,
}: UseBulkJobseekerWeekPrefetchParams) {
  const [matchingByUserId, setMatchingByUserId] = useState<
    Map<string, WeekTimesheetRecord[]>
  >(new Map());
  const [hoursLoading, setHoursLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canFetch = Boolean(
    enabled && weekStartDate && positionId && assignments.length > 0
  );

  const refetch = useCallback(async () => {
    if (!canFetch || !positionId) {
      setMatchingByUserId(new Map());
      setError(null);
      return;
    }

    const userIds = assignments
      .map((a) => a.jobseekerProfile?.user_id || a.candidate_id)
      .filter((id): id is string => Boolean(id));

    if (userIds.length === 0) {
      setMatchingByUserId(new Map());
      return;
    }

    setHoursLoading(true);
    setError(null);

    try {
      const allByUser = await fetchWeekTimesheetsForJobseekers(
        userIds,
        weekStartDate
      );
      const filtered = new Map<string, WeekTimesheetRecord[]>();
      for (const [userId, rows] of allByUser) {
        filtered.set(
          userId,
          filterTimesheetsForWeekAndPosition(rows, weekStartDate, positionId)
        );
      }
      setMatchingByUserId(filtered);
    } catch (err) {
      console.error("Error prefetching bulk week timesheets:", err);
      setMatchingByUserId(new Map());
      setError(
        err instanceof Error ? err.message : "Failed to load timesheet hours"
      );
    } finally {
      setHoursLoading(false);
    }
  }, [assignments, canFetch, positionId, weekStartDate]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const getMatchingForAssignment = useCallback(
    (assignment: AssignmentRecord): WeekTimesheetRecord[] => {
      const userId =
        assignment.jobseekerProfile?.user_id || assignment.candidate_id;
      if (!userId) return [];
      return matchingByUserId.get(userId) ?? [];
    },
    [matchingByUserId]
  );

  return {
    hoursLoading,
    error,
    refetch,
    getMatchingForAssignment,
  };
}
