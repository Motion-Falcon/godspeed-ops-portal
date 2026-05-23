import { useCallback, useEffect, useState } from "react";
import type { JobSeekerProfile } from "../../../types/jobseeker";
import { generateInvoiceNumber } from "../../../services/api/timesheet";
import { buildWeeklyTimesheetSeed } from "../functions/timesheetWeek";
import type { WeekTimesheetRecord } from "../types";
import { mapWeeklyTimesheetSeedToForm } from "../functions/timesheetFormMap";
import {
  calculateTimesheetTotals,
  type PayrollComputationContext,
} from "../functions/timesheetCalculations";
import type { WeeklyTimesheet, TimesheetDayEntry, ClientPosition } from "../types";

export interface UseWeeklyTimesheetFormArgs {
  selectedJobseeker: JobSeekerProfile | null;
  selectedPosition: ClientPosition | null;
  selectedWeekStart: string;
  matchingTimesheets: WeekTimesheetRecord[];
  weekTimesheetsLoading: boolean;
  payrollCtx: PayrollComputationContext;
}

export function useWeeklyTimesheetForm({
  selectedJobseeker,
  selectedPosition,
  selectedWeekStart,
  matchingTimesheets,
  weekTimesheetsLoading,
  payrollCtx,
}: UseWeeklyTimesheetFormArgs) {
  const [timesheets, setTimesheets] = useState<WeeklyTimesheet[]>([]);

  useEffect(() => {
    if (
      !selectedJobseeker ||
      !selectedPosition ||
      !selectedWeekStart ||
      weekTimesheetsLoading
    ) {
      if (!selectedWeekStart || !selectedPosition || !selectedJobseeker) {
        setTimesheets([]);
      }
      return;
    }

    let cancelled = false;

    const applyWeekTimesheetForm = async () => {
      const seed = await buildWeeklyTimesheetSeed(selectedWeekStart, matchingTimesheets, {
        generateInvoiceNumber,
      });

      if (cancelled) return;

      setTimesheets([
        mapWeeklyTimesheetSeedToForm(seed, selectedPosition.id, payrollCtx),
      ]);
    };

    void applyWeekTimesheetForm();

    return () => {
      cancelled = true;
    };
  }, [
    selectedJobseeker,
    selectedPosition,
    selectedWeekStart,
    matchingTimesheets,
    weekTimesheetsLoading,
    payrollCtx,
  ]);

  const updateTimesheetEntry = useCallback(
    (date: string, hours: number) => {
      setTimesheets((prev) =>
        prev.map((timesheet) => {
          const updatedEntries = timesheet.entries.map((entry) => {
            if (entry.date !== date) return entry;
            return {
              ...entry,
              hours,
              overtimeHours: 0,
            };
          });

          const totals = calculateTimesheetTotals(
            updatedEntries,
            payrollCtx,
            timesheet.bonusAmount,
            timesheet.deductionAmount
          );

          const assignment = payrollCtx.positions.find(
            (p) => p.id === payrollCtx.selectedPositionId
          );
          const position = assignment;

          let finalEntries: TimesheetDayEntry[] = updatedEntries;
          if (position?.overtimeEnabled && totals.totalOvertimeHours > 0) {
            const totalWeeklyHours = updatedEntries.reduce(
              (sum, entry) => sum + entry.hours,
              0
            );
            finalEntries = updatedEntries.map((entry) => {
              if (entry.hours === 0 || totalWeeklyHours === 0) {
                return { ...entry, overtimeHours: 0 };
              }
              const proportion = entry.hours / totalWeeklyHours;
              const entryOvertimeHours =
                totals.totalOvertimeHours * proportion;
              return {
                ...entry,
                overtimeHours: entryOvertimeHours,
              };
            });
          } else {
            finalEntries = updatedEntries.map((entry) => ({
              ...entry,
              overtimeHours: 0,
            }));
          }

          return {
            ...timesheet,
            entries: finalEntries,
            ...totals,
          };
        })
      );
    },
    [payrollCtx]
  );

  const updateTimesheetBonus = useCallback(
    (bonusAmount: number) => {
      setTimesheets((prev) =>
        prev.map((timesheet) => {
          const updated = {
            ...timesheet,
            bonusAmount: bonusAmount || 0,
          };
          const totals = calculateTimesheetTotals(
            updated.entries,
            payrollCtx,
            updated.bonusAmount,
            updated.deductionAmount
          );
          return {
            ...updated,
            ...totals,
          };
        })
      );
    },
    [payrollCtx]
  );

  const updateTimesheetDeduction = useCallback(
    (deductionAmount: number) => {
      setTimesheets((prev) =>
        prev.map((timesheet) => {
          const updated = {
            ...timesheet,
            deductionAmount: deductionAmount || 0,
          };
          const totals = calculateTimesheetTotals(
            updated.entries,
            payrollCtx,
            updated.bonusAmount,
            updated.deductionAmount
          );
          return {
            ...updated,
            ...totals,
          };
        })
      );
    },
    [payrollCtx]
  );

  const updateTimesheetNotes = useCallback((notes: string) => {
    setTimesheets((prev) =>
      prev.map((timesheet) => ({
        ...timesheet,
        notes: notes || "",
      }))
    );
  }, []);

  return {
    timesheets,
    updateTimesheetEntry,
    updateTimesheetBonus,
    updateTimesheetDeduction,
    updateTimesheetNotes,
  };
}
