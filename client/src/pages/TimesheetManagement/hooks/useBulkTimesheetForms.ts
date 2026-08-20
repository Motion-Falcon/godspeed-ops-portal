import { useCallback, useEffect, useState } from "react";
import { generateInvoiceNumber } from "../../../services/api/timesheet";
import type { AssignmentRecord } from "../../../services/api/position";
import { mapAssignmentToJobseeker } from "../functions/mapAssignmentToJobseeker";
import { mapWeeklyTimesheetSeedToForm } from "../functions/timesheetFormMap";
import {
  buildWeeklyTimesheetSeed,
  type WeekTimesheetRecord,
} from "../functions/timesheetWeek";
import {
  calculateTimesheetTotals,
  type PayrollComputationContext,
} from "../functions/timesheetCalculations";
import type {
  BulkJobseekerRow,
  ClientPosition,
  TimesheetDayEntry,
} from "../types";

export interface UseBulkTimesheetFormsParams {
  assignments: AssignmentRecord[];
  selectedWeekStart: string;
  clientPosition: ClientPosition | null;
  hoursLoading: boolean;
  getMatchingForAssignment: (assignment: AssignmentRecord) => WeekTimesheetRecord[];
}

export function useBulkTimesheetForms({
  assignments,
  selectedWeekStart,
  clientPosition,
  hoursLoading,
  getMatchingForAssignment,
}: UseBulkTimesheetFormsParams) {
  const [rows, setRows] = useState<BulkJobseekerRow[]>([]);

  useEffect(() => {
    if (
      !selectedWeekStart ||
      !clientPosition ||
      hoursLoading ||
      assignments.length === 0
    ) {
      if (!selectedWeekStart || !clientPosition || assignments.length === 0) {
        setRows([]);
      }
      return;
    }

    let cancelled = false;

    const buildRows = async () => {
      const built: BulkJobseekerRow[] = [];

      for (const assignment of assignments) {
        const matching = getMatchingForAssignment(assignment);
        const seed = await buildWeeklyTimesheetSeed(
          selectedWeekStart,
          matching,
          { generateInvoiceNumber }
        );

        const jobseeker = mapAssignmentToJobseeker(assignment);
        const payrollCtx: PayrollComputationContext = {
          positions: [clientPosition],
          selectedPositionId: clientPosition.id,
          jobseeker,
        };

        const form = mapWeeklyTimesheetSeedToForm(
          seed,
          clientPosition.id,
          payrollCtx
        );

        built.push({
          assignment,
          form,
          emailSent: false,
        });
      }

      if (!cancelled) {
        built.sort((a, b) => {
          const nameA = mapAssignmentToJobseeker(a.assignment)?.name || "";
          const nameB = mapAssignmentToJobseeker(b.assignment)?.name || "";
          return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
        });
        setRows(built);
      }
    };

    void buildRows();

    return () => {
      cancelled = true;
    };
  }, [
    assignments,
    selectedWeekStart,
    clientPosition,
    hoursLoading,
    getMatchingForAssignment,
  ]);

  const payrollCtxForRow = useCallback(
    (assignment: AssignmentRecord): PayrollComputationContext => ({
      positions: clientPosition ? [clientPosition] : [],
      selectedPositionId: clientPosition?.id,
      jobseeker: mapAssignmentToJobseeker(assignment),
    }),
    [clientPosition]
  );

  const distributeOvertimeHours = useCallback(
    (
      entries: TimesheetDayEntry[],
      totalOvertimeHours: number,
      overtimeEnabled: boolean
    ): TimesheetDayEntry[] => {
      if (!overtimeEnabled || totalOvertimeHours <= 0) {
        return entries.map((entry) => ({ ...entry, overtimeHours: 0 }));
      }

      const totalWeeklyHours = entries.reduce((sum, e) => sum + e.hours, 0);
      if (totalWeeklyHours === 0) {
        return entries.map((entry) => ({ ...entry, overtimeHours: 0 }));
      }

      return entries.map((entry) => {
        if (entry.hours === 0) {
          return { ...entry, overtimeHours: 0 };
        }
        const proportion = entry.hours / totalWeeklyHours;
        return {
          ...entry,
          overtimeHours: totalOvertimeHours * proportion,
        };
      });
    },
    []
  );

  const updateEntry = useCallback(
    (assignmentId: string, date: string, hours: number) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.assignment.id !== assignmentId) return row;

          const updatedEntries = row.form.entries.map((entry) =>
            entry.date === date
              ? { ...entry, hours, overtimeHours: 0 }
              : entry
          );

          const ctx = payrollCtxForRow(row.assignment);
          const totals = calculateTimesheetTotals(
            updatedEntries,
            ctx,
            row.form.bonusAmount,
            row.form.deductionAmount
          );

          const overtimeEnabled = !!clientPosition?.overtimeEnabled;
          const finalEntries = distributeOvertimeHours(
            updatedEntries,
            totals.totalOvertimeHours,
            overtimeEnabled
          );

          return {
            ...row,
            form: {
              ...row.form,
              entries: finalEntries,
              ...totals,
            },
          };
        })
      );
    },
    [clientPosition, distributeOvertimeHours, payrollCtxForRow]
  );

  const updateBonus = useCallback(
    (assignmentId: string, bonus: number) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.assignment.id !== assignmentId) return row;
          const ctx = payrollCtxForRow(row.assignment);
          const totals = calculateTimesheetTotals(
            row.form.entries,
            ctx,
            bonus,
            row.form.deductionAmount
          );
          return {
            ...row,
            form: { ...row.form, bonusAmount: bonus, ...totals },
          };
        })
      );
    },
    [payrollCtxForRow]
  );

  const updateDeduction = useCallback(
    (assignmentId: string, deduction: number) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.assignment.id !== assignmentId) return row;
          const ctx = payrollCtxForRow(row.assignment);
          const totals = calculateTimesheetTotals(
            row.form.entries,
            ctx,
            row.form.bonusAmount,
            deduction
          );
          return {
            ...row,
            form: { ...row.form, deductionAmount: deduction, ...totals },
          };
        })
      );
    },
    [payrollCtxForRow]
  );

  const updateNotes = useCallback((assignmentId: string, notes: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.assignment.id === assignmentId
          ? { ...row, form: { ...row.form, notes } }
          : row
      )
    );
  }, []);

  const removeJobseeker = useCallback((assignmentId: string) => {
    setRows((prev) => prev.filter((row) => row.assignment.id !== assignmentId));
  }, []);

  const updateJobseekerEmailSent = useCallback(
    (assignmentId: string, emailSent: boolean) => {
      setRows((prev) =>
        prev.map((row) =>
          row.assignment.id === assignmentId ? { ...row, emailSent } : row
        )
      );
    },
    []
  );

  const updateAllJobseekersEmailSent = useCallback((emailSent: boolean) => {
    setRows((prev) => prev.map((row) => ({ ...row, emailSent })));
  }, []);

  const clearRows = useCallback(() => {
    setRows([]);
  }, []);

  return {
    rows,
    updateEntry,
    updateBonus,
    updateDeduction,
    updateNotes,
    removeJobseeker,
    updateJobseekerEmailSent,
    updateAllJobseekersEmailSent,
    clearRows,
    payrollCtxForRow,
  };
}
