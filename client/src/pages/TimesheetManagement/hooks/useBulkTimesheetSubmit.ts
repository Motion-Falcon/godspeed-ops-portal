import { useCallback, useState } from "react";
import type { TimesheetRow } from "../../../services/types/timesheet";
import { mapAssignmentToJobseeker } from "../functions/mapAssignmentToJobseeker";
import { submitWeeklyTimesheets } from "../functions/timesheetSubmit";
import type { BulkJobseekerRow, ClientPosition } from "../types";

export type BulkTimesheetT = (
  key: string,
  params?: Record<string, string | number>
) => string;

export interface UseBulkTimesheetSubmitParams {
  t: BulkTimesheetT;
  onSuccessReset: () => void;
}

export function useBulkTimesheetSubmit({
  t,
  onSuccessReset,
}: UseBulkTimesheetSubmitParams) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [currentInvoiceNumber, setCurrentInvoiceNumber] = useState("");

  const generateBulkTimesheets = useCallback(
    async (
      rows: BulkJobseekerRow[],
      clientPosition: ClientPosition,
      weekStart: string
    ) => {
      const withHours = rows.filter((row) => {
        const total =
          row.form.totalRegularHours + row.form.totalOvertimeHours;
        return total > 0;
      });

      if (withHours.length === 0) {
        setGenerationError(
          t("bulkTimesheetManagement.messages.noJobseekersWithHours")
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
        for (let i = 0; i < withHours.length; i++) {
          const row = withHours[i];
          const profile = row.assignment.jobseekerProfile;
          const jobseekerName =
            `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
            "Unknown";

          setGenerationMessage(
            t("bulkTimesheetManagement.messages.processing", {
              current: i + 1,
              total: withHours.length,
              jobseekerName,
            })
          );

          const jobseeker = mapAssignmentToJobseeker(row.assignment);
          if (!jobseeker) {
            failed.push({
              jobseeker: jobseekerName,
              error: "Missing jobseeker profile",
            });
            continue;
          }

          try {
            const result = await submitWeeklyTimesheets({
              timesheetsToProcess: [row.form],
              jobseeker,
              selectedPosition: clientPosition,
              selectedWeekStart: weekStart,
              emailPreferences: {
                [clientPosition.id]: row.emailSent,
              },
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
                t("bulkTimesheetManagement.messages.duplicateDetected", {
                  jobseekerName,
                })
              );
              setTimeout(() => setGenerationMessage(""), 5000);
            }
          }
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
              t("bulkTimesheetManagement.messages.allTimesheetsCreated", {
                count: countLabel,
                totalHours: grandTotalHours.toFixed(2),
                totalPay: grandTotalPay.toFixed(2),
              })
            );
          } else {
            setGenerationMessage(
              t("bulkTimesheetManagement.messages.partialTimesheetsCreated", {
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
            setGenerationError(
              t("bulkTimesheetManagement.messages.allTimesheetsExist")
            );
          } else {
            setGenerationError(
              t("bulkTimesheetManagement.messages.allTimesheetsFailed", {
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
          `${t("bulkTimesheetManagement.messages.failedToCreate")} ${
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
    [onSuccessReset, t]
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
