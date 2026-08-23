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
  assignablePositions: ClientPosition[];
  positionLoading: boolean;
}

export function useBulkJobseekerPositionForms({
  jobseeker,
  selectedClientId,
  selectedWeekStart,
  hoursLoading,
  weekTimesheetsForJobseeker,
  assignablePositions,
  positionLoading,
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

  /** Hydrate rows from existing bulk timesheet if it exists, otherwise one empty row */
  useEffect(() => {
    if (
      !jobseeker?.userId ||
      !selectedClientId ||
      !selectedWeekStart ||
      hoursLoading ||
      positionLoading
    ) {
      return;
    }
    
    setRows((prev) => {
        // If we already have rows with a position, don't re-hydrate
        if (prev.some(r => r.position !== null)) return prev;
        
        // If we only have the default empty row but the user hasn't touched it, we can replace it.
        // Or if prev.length > 0 and there's NO bulk timesheet, just return prev to keep the empty row.
        const bulkTimesheet = weekTimesheetsForJobseeker.find(ts => ts.is_bulk && ts.week_start_date === selectedWeekStart);
        
        if (!bulkTimesheet && prev.length > 0) return prev;
        
        if (bulkTimesheet && Array.isArray(bulkTimesheet.bulk_breakdown)) {
            const initialRows: BulkPositionRow[] = [];
            
            for (const item of bulkTimesheet.bulk_breakdown) {
                const position = assignablePositions.find(p => p.id === item.position_id) || null;
                const row = newEmptyRow();
                if (position) {
                    row.position = position;
                    const ctx = payrollCtxForPosition(position, jobseeker);
                    if (ctx) {
                        const topLevelReg = bulkTimesheet.total_regular_hours || 0;
                        const topLevelOt = bulkTimesheet.total_overtime_hours || 0;
                        const isSingleBreakdown = bulkTimesheet.bulk_breakdown.length === 1;
                        const isOutOfSync = isSingleBreakdown && topLevelReg > 0 && item.regular_hours !== topLevelReg;

                        const regHours = isOutOfSync ? topLevelReg : (item.regular_hours || 0);
                        const otHours = isOutOfSync ? topLevelOt : (item.overtime_hours || 0);
                        const jsPay = isOutOfSync ? (bulkTimesheet.total_jobseeker_pay || item.total_jobseeker_pay) : (item.total_jobseeker_pay || 0);
                        const clBill = isOutOfSync ? (bulkTimesheet.total_client_bill || item.total_client_bill) : (item.total_client_bill || 0);

                        const entriesToUse = isOutOfSync && Array.isArray(bulkTimesheet.daily_hours) && bulkTimesheet.daily_hours.length > 0
                          ? bulkTimesheet.daily_hours.map(dh => ({ date: dh.date, hours: dh.hours, overtimeHours: 0 }))
                          : (item.entries || []);

                        row.form = {
                            positionId: position.id,
                            invoiceNumber: bulkTimesheet.invoice_number || "",
                            weekStartDate: bulkTimesheet.week_start_date,
                            weekEndDate: bulkTimesheet.week_end_date,
                            entries: entriesToUse,
                            totalRegularHours: regHours,
                            totalOvertimeHours: otHours,
                            jobseekerPay: jsPay,
                            clientBill: clBill,
                            bonusAmount: item.bonus_amount || 0,
                            deductionAmount: item.deduction_amount || 0,
                            notes: item.notes || "",
                            existingTimesheetId: bulkTimesheet.id,
                        };
                        row.formLoading = false;
                    }
                }
                initialRows.push(row);
            }
            
            if (initialRows.length > 0) return initialRows;
        }

        return [newEmptyRow()];
    });
  }, [
    jobseeker,
    selectedClientId,
    selectedWeekStart,
    hoursLoading,
    positionLoading,
    weekTimesheetsForJobseeker,
    assignablePositions,
    payrollCtxForPosition
  ]);

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
