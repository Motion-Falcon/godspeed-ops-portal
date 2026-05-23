import { useCallback, useEffect, useState } from "react";
import { generateInvoiceNumber } from "../../../services/api/timesheet";
import type { JobSeekerProfile } from "../../../types/jobseeker";
import {
  filterTimesheetsForWeekAndPosition,
  buildWeeklyTimesheetSeed,
} from "../functions/timesheetWeek";
import { mapWeeklyTimesheetSeedToForm } from "../functions/timesheetFormMap";
import {
  calculateTimesheetTotals,
  type PayrollComputationContext,
} from "../functions/timesheetCalculations";
import type {
  BulkPositionRow,
  ClientPosition,
  TimesheetDayEntry,
  WeekTimesheetRecord,
} from "../types";

function newEmptyRow(): BulkPositionRow {
  const rowId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    rowId,
    position: null,
    form: null,
    formLoading: false,
    emailSent: false,
  };
}

export interface UseBulkJobseekerPositionFormsParams {
  jobseeker: JobSeekerProfile | null;
  selectedClientId: string | null;
  selectedWeekStart: string;
  hoursLoading: boolean;
  weekTimesheetsForJobseeker: WeekTimesheetRecord[];
}

export function useBulkJobseekerPositionForms({
  jobseeker,
  selectedClientId,
  selectedWeekStart,
  hoursLoading,
  weekTimesheetsForJobseeker,
}: UseBulkJobseekerPositionFormsParams) {
  const [rows, setRows] = useState<BulkPositionRow[]>([]);

  /** Clear rows when picker context changes */
  useEffect(() => {
    setRows([]);
  }, [
    jobseeker?.userId ?? "",
    selectedClientId ?? "",
    selectedWeekStart,
  ]);

  /** One empty row when workbench context is ready and week data landed */
  useEffect(() => {
    if (
      !jobseeker?.userId ||
      !selectedClientId ||
      !selectedWeekStart ||
      hoursLoading
    ) {
      return;
    }
    setRows((prev) => (prev.length === 0 ? [newEmptyRow()] : prev));
  }, [
    jobseeker?.userId,
    selectedClientId,
    selectedWeekStart,
    hoursLoading,
  ]);

  const payrollCtxForPosition = useCallback(
    (
      position: ClientPosition | null | undefined,
      js: JobSeekerProfile | null | undefined
    ): PayrollComputationContext | null =>
      position && js
        ? {
            positions: [position],
            selectedPositionId: position.id,
            jobseeker: js,
          }
        : null,
    []
  );

  /** Hydrate forms for rows awaiting seed (position chosen, week data ready) */
  useEffect(() => {
    if (!jobseeker || !selectedWeekStart || hoursLoading) {
      return;
    }

    const pending = rows.filter(
      (r) => r.position && r.formLoading && !r.form
    );
    if (pending.length === 0) {
      return;
    }

    let cancelled = false;

    for (const { rowId, position } of pending) {
      if (!position) continue;
      const targetId = position.id;

      void (async () => {
        try {
          const matching = filterTimesheetsForWeekAndPosition(
            weekTimesheetsForJobseeker,
            selectedWeekStart,
            targetId
          );

          const seed = await buildWeeklyTimesheetSeed(selectedWeekStart, matching, {
            generateInvoiceNumber,
          });

          const ctx = payrollCtxForPosition(position, jobseeker);
          if (!ctx) return;

          const form = mapWeeklyTimesheetSeedToForm(
            seed,
            position.id,
            ctx
          );

          if (cancelled) return;

          setRows((prev) =>
            prev.map((row) => {
              if (row.rowId !== rowId) return row;
              if (row.position?.id !== targetId) return row;
              return { ...row, form, formLoading: false };
            })
          );
        } catch {
          if (cancelled) return;
          setRows((prev) =>
            prev.map((row) =>
              row.rowId === rowId && row.position?.id === targetId
                ? { ...row, form: null, formLoading: false }
                : row
            )
          );
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [
    rows,
    hoursLoading,
    jobseeker,
    payrollCtxForPosition,
    selectedWeekStart,
    weekTimesheetsForJobseeker,
  ]);

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

  const setRowPosition = useCallback(
    (rowId: string, position: ClientPosition | null) => {
      if (!position) {
        setRows((prev) =>
          prev.map((row) =>
            row.rowId === rowId
              ? {
                  ...row,
                  position: null,
                  form: null,
                  formLoading: false,
                }
              : row
          )
        );
        return;
      }

      setRows((prev) =>
        prev.map((row) =>
          row.rowId === rowId
            ? {
                ...row,
                position,
                form: null,
                formLoading: true,
              }
            : row
        )
      );
    },
    []
  );

  const addRow = useCallback(() => {
    setRows((prev) => [newEmptyRow(), ...prev]);
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((r) => r.rowId !== rowId)
    );
  }, []);

  const updateRowEntry = useCallback(
    (rowId: string, date: string, hours: number) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.rowId !== rowId || !row.form || !row.position) return row;

          const updatedEntries = row.form.entries.map((entry) =>
            entry.date === date
              ? { ...entry, hours, overtimeHours: 0 }
              : entry
          );

          const ctx = payrollCtxForPosition(row.position, jobseeker);
          if (!ctx) return row;

          const totals = calculateTimesheetTotals(
            updatedEntries,
            ctx,
            row.form.bonusAmount,
            row.form.deductionAmount
          );

          const overtimeEnabled = !!row.position.overtimeEnabled;
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
    [distributeOvertimeHours, jobseeker, payrollCtxForPosition]
  );

  const updateRowBonus = useCallback(
    (rowId: string, bonus: number) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.rowId !== rowId || !row.form || !row.position) return row;
          const ctx = payrollCtxForPosition(row.position, jobseeker);
          if (!ctx) return row;
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
    [jobseeker, payrollCtxForPosition]
  );

  const updateRowDeduction = useCallback(
    (rowId: string, deduction: number) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.rowId !== rowId || !row.form || !row.position) return row;
          const ctx = payrollCtxForPosition(row.position, jobseeker);
          if (!ctx) return row;
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
    [jobseeker, payrollCtxForPosition]
  );

  const updateRowNotes = useCallback((rowId: string, notes: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.rowId === rowId && row.form && row.position
          ? { ...row, form: { ...row.form, notes } }
          : row
      )
    );
  }, []);

  const updateRowEmailSent = useCallback(
    (rowId: string, emailSent: boolean) => {
      setRows((prev) =>
        prev.map((row) =>
          row.rowId === rowId ? { ...row, emailSent } : row
        )
      );
    },
    []
  );

  const updateAllRowsEmailSent = useCallback((emailSent: boolean) => {
    setRows((prev) => prev.map((row) => ({ ...row, emailSent })));
  }, []);

  const clearRows = useCallback(() => {
    setRows([]);
  }, []);

  return {
    rows,
    setRowPosition,
    addRow,
    removeRow,
    updateRowEntry,
    updateRowBonus,
    updateRowDeduction,
    updateRowNotes,
    updateRowEmailSent,
    updateAllRowsEmailSent,
    clearRowsAndDraft: clearRows,
    payrollCtxForRow: (row: BulkPositionRow): PayrollComputationContext | null =>
      payrollCtxForPosition(row.position, jobseeker),
  };
}
