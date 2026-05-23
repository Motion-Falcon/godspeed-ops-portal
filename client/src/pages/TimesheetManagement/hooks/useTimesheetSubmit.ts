import { useCallback, useState } from "react";
import { submitWeeklyTimesheets } from "../functions/timesheetSubmit";
import type { JobSeekerProfile } from "../../../types/jobseeker";
import type { ClientPosition, WeeklyTimesheet } from "../types";

export interface GenerateTimesheetSubmitParams {
  timesheetsToProcess: WeeklyTimesheet[];
  jobseeker: JobSeekerProfile;
  position: ClientPosition;
  weekStart: string;
  emailPreferences: Record<string, boolean>;
  refetchWeekTimesheets?: () => Promise<void>;
}

export function useTimesheetSubmit() {
  const [emailPreferences, setEmailPreferences] = useState<
    Record<string, boolean>
  >({});
  const [isGeneratingTimesheet, setIsGeneratingTimesheet] = useState(false);
  const [generationMessage, setGenerationMessage] = useState("");
  const [generationError, setGenerationError] = useState("");

  const updateEmailPreference = useCallback(
    (positionId: string | undefined, sendEmail: boolean) => {
      if (!positionId) return;
      setEmailPreferences((prev) => ({
        ...prev,
        [positionId]: sendEmail,
      }));
    },
    []
  );

  const generateSingleTimesheet = useCallback(
    async ({
      timesheetsToProcess,
      jobseeker,
      position,
      weekStart,
      emailPreferences: prefs,
      refetchWeekTimesheets,
    }: GenerateTimesheetSubmitParams) => {
      if (!timesheetsToProcess.length || !jobseeker || !position || !weekStart) {
        setGenerationError(
          "Cannot generate timesheet data: Missing required information"
        );
        return;
      }

      setIsGeneratingTimesheet(true);
      setGenerationMessage("");
      setGenerationError("");

      try {
        const { updatedCount, createdCount, emailCount } =
          await submitWeeklyTimesheets({
            timesheetsToProcess,
            jobseeker,
            selectedPosition: position,
            selectedWeekStart: weekStart,
            emailPreferences: prefs,
          });

        let message = "";
        if (updatedCount > 0 && createdCount > 0) {
          message = `Successfully updated ${updatedCount} and created ${createdCount} timesheet(s) for ${jobseeker.name}`;
        } else if (updatedCount > 0) {
          message = `Successfully updated ${updatedCount} timesheet(s) for ${jobseeker.name}`;
        } else {
          message = `Successfully created ${createdCount} timesheet(s) for ${jobseeker.name}`;
        }

        if (emailCount > 0) {
          message += ` (${emailCount} sent via email)`;
        }

        setGenerationMessage(message);
        await refetchWeekTimesheets?.();
      } catch (error) {
        console.error("Error processing timesheets:", error);
        setGenerationError(
          error instanceof Error
            ? error.message
            : "Failed to process timesheets"
        );
      } finally {
        setIsGeneratingTimesheet(false);
      }
    },
    []
  );

  return {
    emailPreferences,
    updateEmailPreference,
    isGeneratingTimesheet,
    generationMessage,
    generationError,
    generateSingleTimesheet,
  };
}
