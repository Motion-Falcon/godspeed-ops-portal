import { useCallback, useState } from "react";
import type { JobSeekerProfile } from "../../../types/jobseeker";
import type { TimesheetRow } from "../../../services/types/timesheet";
import { submitWeeklyTimesheets } from "../functions/timesheetSubmit";
import type { ClientPosition, WeeklyTimesheet } from "../types";

export type BulkTimesheetT = (
  key: string,
  params?: Record<string, string | number>
) => string;

/** One row submitted in a sequential bulk loop — each maps to one submitWeeklyTimesheets call */
export interface BulkSubmitRow {
  form: WeeklyTimesheet;
  emailSent: boolean;
  clientPosition: ClientPosition;
  jobseeker: JobSeekerProfile;
  /** Shown in progress and failure summaries */
  progressLabel: string;
}

export interface UseBulkTimesheetSubmitParams {
  t: BulkTimesheetT;
  /** Namespace for message keys under `.messages.*` */
  translationNamespace?:
    | "bulkTimesheetManagement"
    | "bulkJobseekerTimesheetManagement";
  onSuccessReset: () => void;
}

export function useBulkTimesheetSubmit({
  t,
  translationNamespace = "bulkTimesheetManagement",
  onSuccessReset,
}: UseBulkTimesheetSubmitParams) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [currentInvoiceNumber, setCurrentInvoiceNumber] = useState("");

  const msg = useCallback(
    (suffix: string, params?: Record<string, string | number>) =>
      t(`${translationNamespace}.messages.${suffix}`, params),
    [t, translationNamespace]
  );

  const generateBulkTimesheets = useCallback(
    async (rows: BulkSubmitRow[], weekStart: string) => {
      const withHours = rows.filter((row) => {
        const total =
          row.form.totalRegularHours + row.form.totalOvertimeHours;
        return total > 0;
      });

      if (withHours.length === 0) {
        setGenerationError(
          msg(
            translationNamespace === "bulkJobseekerTimesheetManagement"
              ? "noRowsWithHours"
              : "noJobseekersWithHours"
          )
        );
        return;
      }

      setIsGenerating(true);
      setGenerationMessage("");
      setGenerationError("");

      const savedRows: TimesheetRow[] = [];
      const failed: Array<{ jobseeker: string; error: string }> = [];
      let totalCreated = 0;
      let totalUpdated = 0;

      try {
        // Group rows by jobseeker ID
        const groupedRows = new Map<string, BulkSubmitRow[]>();
        for (const row of withHours) {
          if (!row.jobseeker?.id) continue;
          if (!groupedRows.has(row.jobseeker.id)) {
            groupedRows.set(row.jobseeker.id, []);
          }
          groupedRows.get(row.jobseeker.id)!.push(row);
        }

        let i = 0;
        for (const [, jobseekerRows] of groupedRows.entries()) {
          const firstRow = jobseekerRows[0];
          const jobseekerName = firstRow.progressLabel;

          setGenerationMessage(
            msg("processing", {
              current: i + 1,
              total: groupedRows.size,
              jobseekerName,
            })
          );

          if (!firstRow.jobseeker?.userId) {
            failed.push({
              jobseeker: jobseekerName,
              error: "Missing jobseeker user ID",
            });
            i++;
            continue;
          }

          try {
            const result = await submitWeeklyTimesheets({
              timesheetsToProcess: jobseekerRows.map((r) => r.form),
              jobseeker: firstRow.jobseeker,
              selectedPosition: firstRow.clientPosition, // Using first position for client linking
              selectedWeekStart: weekStart,
              emailPreferences: jobseekerRows.reduce((acc, r) => {
                acc[r.clientPosition.id] = r.emailSent;
                return acc;
              }, {} as Record<string, boolean>),
              isBulk: true, // We will add this flag to submitWeeklyTimesheets
              bulkRows: jobseekerRows,
            });

            totalCreated += result.createdCount;
            totalUpdated += result.updatedCount;

            for (const mutation of result.results) {
              if (mutation.timesheet) {
                savedRows.push(mutation.timesheet);
                if (mutation.timesheet.invoice_number) {
                  setCurrentInvoiceNumber(mutation.timesheet.invoice_number);
                }
              }
            }
          } catch (error) {
            let errorMessage = "Unknown error";
            if (error instanceof Error) {
              errorMessage = error.message;
            } else if (
              typeof error === "object" &&
              error !== null &&
              "error" in error
            ) {
              errorMessage = (error as { error: string }).error;
            }

            failed.push({ jobseeker: jobseekerName, error: errorMessage });

            if (
              errorMessage.includes("already exists") ||
              errorMessage.includes("duplicate")
            ) {
              setGenerationMessage(
                msg("duplicateDetected", {
                  jobseekerName,
                })
              );
              setTimeout(() => setGenerationMessage(""), 5000);
            }
          }
          i++;
        }

        const savedCount = savedRows.length;
        const grandTotalHours = withHours.reduce(
          (sum, row) =>
            sum +
            row.form.totalRegularHours +
            row.form.totalOvertimeHours,
          0
        );
        const grandTotalPay = withHours.reduce(
          (sum, row) => sum + row.form.jobseekerPay,
          0
        );

        if (savedCount > 0) {
          const countLabel = String(savedCount);
          if (failed.length === 0) {
            setGenerationMessage(
              msg("allTimesheetsCreated", {
                count: countLabel,
                totalHours: grandTotalHours.toFixed(2),
                totalPay: grandTotalPay.toFixed(2),
              })
            );
          } else {
            setGenerationMessage(
              msg("partialTimesheetsCreated", {
                successful: savedCount,
                total: savedCount + failed.length,
                failed: failed.length,
                totalHours: grandTotalHours.toFixed(2),
                totalPay: grandTotalPay.toFixed(2),
              })
            );
          }

          if (totalUpdated > 0 && totalCreated > 0) {
            console.info(
              `Bulk timesheets: ${totalUpdated} updated, ${totalCreated} created`
            );
          }

          setTimeout(() => {
            onSuccessReset();
          }, 8000);
        } else {
          const duplicateErrors = failed.filter(
            (f) =>
              f.error.includes("already exists") ||
              f.error.includes("duplicate")
          );

          if (duplicateErrors.length === failed.length) {
            setGenerationError(msg("allTimesheetsExist"));
          } else {
            setGenerationError(
              msg("allTimesheetsFailed", {
                failureDetails: failed
                  .map((f) => `${f.jobseeker}: ${f.error}`)
                  .join("; "),
              })
            );
          }
          setGenerationMessage("");
          setTimeout(() => setGenerationError(""), 10000);
        }
      } catch (error) {
        console.error("Error in bulk timesheet generation:", error);
        setGenerationError(
          `${msg("failedToCreate")} ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        setGenerationMessage("");
        setTimeout(() => setGenerationError(""), 10000);
      } finally {
        setIsGenerating(false);
        setCurrentInvoiceNumber("");
      }
    },
    [msg, onSuccessReset]
  );

  return {
    isGenerating,
    generationMessage,
    generationError,
    currentInvoiceNumber,
    generateBulkTimesheets,
    setGenerationMessage,
    setGenerationError,
  };
}
