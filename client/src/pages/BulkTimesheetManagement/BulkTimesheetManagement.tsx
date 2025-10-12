import { useState, useEffect } from "react";
import { AppHeader } from "../../components/AppHeader";
import {
  CustomDropdown,
  DropdownOption,
} from "../../components/CustomDropdown";
import { useLanguage } from "../../contexts/language/language-provider";
import { getClients, ClientData } from "../../services/api/client";
import { getClientPositions, PositionData } from "../../services/api/position";
import {
  getPositionAssignments,
  AssignmentRecord,
} from "../../services/api/position";
import { generateWeekOptions, formatDate } from "../../utils/weekUtils";
import {
  generateInvoiceNumber,
  createTimesheet,
  TimesheetData,
} from "../../services/api/timesheet";
import { Building, Minus } from "lucide-react";
import "../../styles/pages/BulkTimesheetManagement.css";
import { PositionWithOvertime } from "../TimesheetManagement/TimesheetManagement";

interface TimesheetEntry {
  date: string;
  hours: number;
  overtimeHours: number;
}

interface JobseekerTimesheet {
  jobseeker: AssignmentRecord;
  entries: TimesheetEntry[];
  bonusAmount: number;
  deductionAmount: number;
  notes: string;
  totalRegularHours: number;
  totalOvertimeHours: number;
  jobseekerPay: number;
  clientBill: number;
  emailSent: boolean;
}

export function BulkTimesheetManagement() {
  const { t } = useLanguage();

  // State for client selection
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  // State for position selection
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<PositionData | null>(
    null
  );
  const [positionLoading, setPositionLoading] = useState(false);

  // State for week selection
  const [weekOptions, setWeekOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>("");

  // Note: Individual invoice numbers are generated during timesheet creation

  // State for assigned jobseekers
  const [assignedJobseekers, setAssignedJobseekers] = useState<
    AssignmentRecord[]
  >([]);
  const [jobseekerTimesheets, setJobseekerTimesheets] = useState<
    JobseekerTimesheet[]
  >([]);

  // State for email sending preference
  const [sendEmail, setSendEmail] = useState<boolean>(false);

  // State for bulk timesheet generation
  const [isGeneratingBulkTimesheet, setIsGeneratingBulkTimesheet] =
    useState(false);
  const [generationMessage, setGenerationMessage] = useState<string>("");
  const [generationError, setGenerationError] = useState<string>("");
  const [currentInvoiceNumber, setCurrentInvoiceNumber] = useState<string>("");

  // Individual invoice numbers are generated during bulk timesheet creation

  // Function to reset form state after successful completion
  const resetFormState = () => {
    setSelectedClient(null);
    setSelectedPosition(null);
    setSelectedWeekStart("");
    setAssignedJobseekers([]);
    setJobseekerTimesheets([]);
    setSendEmail(false);
    setGenerationMessage("");
    setGenerationError("");
    setCurrentInvoiceNumber("");
  };

  useEffect(() => {
    fetchClients();
    setWeekOptions(generateWeekOptions());
  }, []);

  useEffect(() => {
    if (selectedClient) {
      setPositionLoading(true); // Start loading immediately
      fetchClientPositions(selectedClient.id!);
      setSelectedPosition(null);
      setPositions([]);
    }
  }, [selectedClient]);

  useEffect(() => {
    if (assignedJobseekers.length && selectedWeekStart && selectedPosition) {
      // Initialize timesheet for each jobseeker
      const weekDates = generateWeekDates(selectedWeekStart);
      setJobseekerTimesheets(
        assignedJobseekers.map((jobseeker) => ({
          jobseeker,
          entries: weekDates.map((date) => ({
            date,
            hours: 0,
            overtimeHours: 0,
          })),
          bonusAmount: 0,
          deductionAmount: 0,
          notes: "",
          totalRegularHours: 0,
          totalOvertimeHours: 0,
          jobseekerPay: 0,
          clientBill: 0,
          emailSent: false, // Initialize emailSent to false
        }))
      );
    } else {
      setJobseekerTimesheets([]);
    }
  }, [assignedJobseekers, selectedWeekStart, selectedPosition]);

  useEffect(() => {
    if (selectedPosition && selectedPosition.id) {
      fetchAssignedJobseekers(selectedPosition.id);
    }
  }, [selectedPosition]);

  // Note: Invoice numbers are generated individually for each timesheet during creation

  // Sync global sendEmail state with individual jobseeker emailSent states
  useEffect(() => {
    if (jobseekerTimesheets.length > 0) {
      const allEmailsEnabled = jobseekerTimesheets.every((ts) => ts.emailSent);

      // Update global state to reflect individual states
      // Global checkbox is only checked when ALL individual checkboxes are checked
      setSendEmail(allEmailsEnabled);
    }
  }, [jobseekerTimesheets]);

  const fetchClients = async () => {
    try {
      setClientLoading(true);
      const response = await getClients({ limit: 100000000 }); // Get all clients
      // Backend now returns camelCase, so no conversion needed
      setClients(response.clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
    } finally {
      setClientLoading(false);
    }
  };

  const fetchClientPositions = async (clientId: string) => {
    setPositionLoading(true);
    try {
      const response = await getClientPositions(clientId, { limit: 1000000 });
      setPositions(response.positions);
    } catch (e) {
      setPositions([]);
    } finally {
      setPositionLoading(false);
    }
  };

  const fetchAssignedJobseekers = async (positionId: string) => {
    try {
      const response = await getPositionAssignments(positionId);
      setAssignedJobseekers(response.assignments || []);
    } catch (e) {
      setAssignedJobseekers([]);
    }
  };

  // Helper to generate week dates
  const generateWeekDates = (weekStartDate: string): string[] => {
    const dates = [];
    const startDate = new Date(weekStartDate);
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date.toISOString().split("T")[0]);
    }
    return dates;
  };

  // Calculation logic (same as TimesheetManagement.tsx)
  const calculateTimesheetTotals = (
    entries: TimesheetEntry[],
    bonusAmount = 0,
    deductionAmount = 0
  ) => {
    if (!selectedPosition) {
      return {
        totalRegularHours: 0,
        totalOvertimeHours: 0,
        jobseekerPay: 0,
        clientBill: 0,
      };
    }

    const position = selectedPosition as PositionWithOvertime;

    // Calculate total weekly hours from all entries
    const totalWeeklyHours = entries.reduce(
      (sum, entry) => sum + entry.hours,
      0
    );

    let weeklyRegularHours: number;
    let weeklyOvertimeHours: number;

    // Only calculate overtime if overtime is enabled for this position
    if (position.overtimeEnabled) {
      // Get overtime threshold (default to 40 if not specified)
      const overtimeThreshold = position.overtimeHours
        ? parseFloat(position.overtimeHours)
        : 0;

      // Calculate weekly regular and overtime hours
      weeklyRegularHours = Math.min(totalWeeklyHours, overtimeThreshold);
      weeklyOvertimeHours = Math.max(0, totalWeeklyHours - overtimeThreshold);
    } else {
      // If overtime is not enabled, all hours are regular hours
      weeklyRegularHours = totalWeeklyHours;
      weeklyOvertimeHours = 0;
    }

    // Calculate pay rates
    const regularPayRate = parseFloat(position.regularPayRate || "0");
    const regularBillRate = parseFloat(position.billRate || "0");

    let overtimePayRate = regularPayRate;
    let overtimeBillRate = regularBillRate;

    if (
      position.overtimeEnabled &&
      position.overtimePayRate &&
      position.overtimeBillRate
    ) {
      overtimePayRate = parseFloat(position.overtimePayRate);
      overtimeBillRate = parseFloat(position.overtimeBillRate);
    }

    // Calculate base pay
    const baseJobseekerPay =
      weeklyRegularHours * regularPayRate +
      weeklyOvertimeHours * overtimePayRate;

    const totalJobseekerPay = baseJobseekerPay + bonusAmount - deductionAmount;

    // Calculate totals
    const clientBill =
      weeklyRegularHours * regularBillRate +
      weeklyOvertimeHours * overtimeBillRate;

    return {
      totalRegularHours: weeklyRegularHours,
      totalOvertimeHours: weeklyOvertimeHours,
      jobseekerPay: totalJobseekerPay,
      clientBill,
    };
  };

  // Helper to calculate base pay (regular + overtime, no bonus/deduction)
  const getBaseJobseekerPay = (
    timesheet: JobseekerTimesheet,
    position: PositionWithOvertime
  ) => {
    const regularPay =
      timesheet.totalRegularHours * parseFloat(position.regularPayRate || "0");
    let overtimePayRate = parseFloat(position.regularPayRate || "0");
    if (position.overtimeEnabled && position.overtimePayRate) {
      overtimePayRate = parseFloat(position.overtimePayRate);
    }
    const overtimePay = timesheet.totalOvertimeHours * overtimePayRate;
    return regularPay + overtimePay;
  };

  // Handlers for input changes
  const updateEntry = (jobseekerId: string, date: string, hours: number) => {
    setJobseekerTimesheets((prev) =>
      prev.map((ts) => {
        if (ts.jobseeker.id !== jobseekerId) return ts;

        // Update the specific entry with raw hours
        const updatedEntries = ts.entries.map((entry) => {
          if (entry.date !== date) return entry;
          return {
            ...entry,
            hours: hours, // Store raw hours entered
            overtimeHours: 0, // Will be calculated weekly
          };
        });

        // Recalculate totals for this jobseeker (this will handle weekly overtime)
        const totals = calculateTimesheetTotals(
          updatedEntries,
          ts.bonusAmount,
          ts.deductionAmount
        );

        // Get the position to check if overtime is enabled
        const position = selectedPosition as PositionWithOvertime;

        // Only distribute overtime hours if overtime is enabled
        let finalEntries = updatedEntries;
        if (position?.overtimeEnabled && totals.totalOvertimeHours > 0) {
          // Distribute overtime hours proportionally across days
          const totalWeeklyHours = updatedEntries.reduce(
            (sum, entry) => sum + entry.hours,
            0
          );
          finalEntries = updatedEntries.map((entry) => {
            if (entry.hours === 0 || totalWeeklyHours === 0) {
              return { ...entry, overtimeHours: 0 };
            }

            // Calculate this entry's proportion of total hours
            const proportion = entry.hours / totalWeeklyHours;
            const entryOvertimeHours = totals.totalOvertimeHours * proportion;

            return {
              ...entry,
              overtimeHours: entryOvertimeHours,
            };
          });
        } else {
          // If overtime is not enabled, ensure all entries have 0 overtime hours
          finalEntries = updatedEntries.map((entry) => ({
            ...entry,
            overtimeHours: 0,
          }));
        }

        return {
          ...ts,
          entries: finalEntries,
          ...totals,
        };
      })
    );
  };

  const updateBonus = (jobseekerId: string, bonus: number) => {
    setJobseekerTimesheets((prev) =>
      prev.map((ts) => {
        if (ts.jobseeker.id !== jobseekerId) return ts;
        const totals = calculateTimesheetTotals(
          ts.entries,
          bonus,
          ts.deductionAmount
        );
        return { ...ts, bonusAmount: bonus, ...totals };
      })
    );
  };

  const updateDeduction = (jobseekerId: string, deduction: number) => {
    setJobseekerTimesheets((prev) =>
      prev.map((ts) => {
        if (ts.jobseeker.id !== jobseekerId) return ts;
        const totals = calculateTimesheetTotals(
          ts.entries,
          ts.bonusAmount,
          deduction
        );
        return { ...ts, deductionAmount: deduction, ...totals };
      })
    );
  };

  const updateNotes = (jobseekerId: string, notes: string) => {
    setJobseekerTimesheets((prev) =>
      prev.map((ts) =>
        ts.jobseeker.id === jobseekerId ? { ...ts, notes } : ts
      )
    );
  };

  // Add function to remove jobseeker from timesheet
  const removeJobseeker = (jobseekerId: string) => {
    setJobseekerTimesheets((prev) =>
      prev.filter((ts) => ts.jobseeker.id !== jobseekerId)
    );
  };

  // Add function to update emailSent status for individual jobseeker
  const updateJobseekerEmailSent = (
    jobseekerId: string,
    emailSent: boolean
  ) => {
    setJobseekerTimesheets((prev) =>
      prev.map((ts) =>
        ts.jobseeker.id === jobseekerId ? { ...ts, emailSent } : ts
      )
    );
  };

  // Add function to update all jobseekers' emailSent status
  const updateAllJobseekersEmailSent = (emailSent: boolean) => {
    setJobseekerTimesheets((prev) => prev.map((ts) => ({ ...ts, emailSent })));
  };

  // Dropdown options
  const clientOptions: DropdownOption[] = clients.map((client) => ({
    id: client.id!,
    label:
      client.companyName ||
      t("bulkTimesheetManagement.constants.unknownClient"),
    sublabel: client.shortCode || "",
    value: client,
  }));
  const positionOptions: DropdownOption[] = positions.map((position) => ({
    id: position.id || "",
    label:
      position.title || t("bulkTimesheetManagement.constants.unknownPosition"),
    sublabel: position.positionCode || "",
    value: position,
  }));
  const weekDropdownOptions: DropdownOption[] = weekOptions.map((week) => ({
    id: week.value,
    label: week.label,
    value: week.value,
  }));

  const selectedClientOption = selectedClient
    ? clientOptions.find((opt) => opt.id === selectedClient.id)
    : null;

  const handleClientSelect = (option: DropdownOption | DropdownOption[]) => {
    if (Array.isArray(option)) return;
    console.log("selected client", option);
    setSelectedClient(option.value as ClientData);
  };

  // Grand totals
  const grandTotalRegularHours = jobseekerTimesheets.reduce(
    (sum, ts) => sum + ts.totalRegularHours,
    0
  );
  const grandTotalOvertimeHours = jobseekerTimesheets.reduce(
    (sum, ts) => sum + ts.totalOvertimeHours,
    0
  );
  const grandTotalPay = jobseekerTimesheets.reduce(
    (sum, ts) => sum + ts.jobseekerPay,
    0
  );
  const grandTotalBonus = jobseekerTimesheets.reduce(
    (sum, ts) => sum + ts.bonusAmount,
    0
  );
  const grandTotalDeduction = jobseekerTimesheets.reduce(
    (sum, ts) => sum + ts.deductionAmount,
    0
  );
  // const grandTotalBill = jobseekerTimesheets.reduce((sum, ts) => sum + ts.clientBill, 0);

  const generateBulkTimesheetData = async () => {
    if (
      !selectedClient ||
      !selectedPosition ||
      !selectedWeekStart ||
      jobseekerTimesheets.length === 0
    ) {
      console.warn(
        "Cannot generate bulk timesheet data: Missing required information"
      );
      setGenerationError(t("bulkTimesheetManagement.messages.cannotGenerate"));
      return;
    }

    // Filter out jobseekers with 0 total hours
    const jobseekersWithHours = jobseekerTimesheets.filter((ts) => {
      const totalHours = ts.totalRegularHours + ts.totalOvertimeHours;
      return totalHours > 0;
    });

    if (jobseekersWithHours.length === 0) {
      setGenerationError(
        t("bulkTimesheetManagement.messages.noJobseekersWithHours")
      );
      return;
    }

    setIsGeneratingBulkTimesheet(true);
    setGenerationMessage("");
    setGenerationError("");

    try {
      console.log(
        "Starting bulk timesheet creation using individual timesheet API..."
      );

      const position = selectedPosition as PositionWithOvertime;
      const weekEndDate = new Date(selectedWeekStart);
      weekEndDate.setDate(weekEndDate.getDate() + 6);

      const createdTimesheets: TimesheetData[] = [];
      const failedTimesheets: Array<{ jobseeker: string; error: string }> = [];

      // Process each jobseeker sequentially
      for (let i = 0; i < jobseekersWithHours.length; i++) {
        const ts = jobseekersWithHours[i];
        const jobseekerName = `${
          ts.jobseeker.jobseekerProfile?.first_name || ""
        } ${ts.jobseeker.jobseekerProfile?.last_name || ""}`.trim();

        try {
          // Update status message to show progress
          setGenerationMessage(
            t("bulkTimesheetManagement.messages.processing", {
              current: i + 1,
              total: jobseekersWithHours.length,
              jobseekerName: jobseekerName || "Unknown",
            })
          );

          // Generate unique invoice number for each timesheet
          const individualInvoiceNumber = await generateInvoiceNumber();
          setCurrentInvoiceNumber(individualInvoiceNumber);

          // Transform daily hours to the format expected by createTimesheet
          const dailyHours = ts.entries.map((entry) => ({
            date: entry.date,
            hours: entry.hours,
          }));

          // Transform data to the format expected by createTimesheet API, ensuring all payments include bonuses/deductions
          const timesheetData: Omit<
            TimesheetData,
            | "id"
            | "createdAt"
            | "updatedAt"
            | "createdByUserId"
            | "updatedByUserId"
          > = {
            invoiceNumber: individualInvoiceNumber,
            jobseekerProfileId:
              ts.jobseeker.jobseekerProfile?.id || ts.jobseeker.id,
            jobseekerUserId: ts.jobseeker.candidate_id,
            positionId: selectedPosition.id,
            weekStartDate: selectedWeekStart,
            weekEndDate: weekEndDate.toISOString().split("T")[0],
            dailyHours: dailyHours,
            totalRegularHours: ts.totalRegularHours,
            totalOvertimeHours: ts.totalOvertimeHours,
            regularPayRate: parseFloat(position.regularPayRate || "0"),
            overtimePayRate:
              position.overtimeEnabled && position.overtimePayRate
                ? parseFloat(position.overtimePayRate)
                : parseFloat(position.regularPayRate || "0"),
            regularBillRate: parseFloat(position.billRate || "0"),
            overtimeBillRate:
              position.overtimeEnabled && position.overtimeBillRate
                ? parseFloat(position.overtimeBillRate)
                : parseFloat(position.billRate || "0"),
            totalJobseekerPay: ts.jobseekerPay, // This already includes bonus and deductions
            totalClientBill: ts.clientBill,
            overtimeEnabled: position.overtimeEnabled || false,
            bonusAmount: ts.bonusAmount || 0,
            deductionAmount: ts.deductionAmount || 0,
            notes: ts.notes || "",
            emailSent: ts.emailSent,
          };

          // Create individual timesheet
          const result = await createTimesheet(timesheetData);
          createdTimesheets.push(result.timesheet);

          console.log(
            `Created timesheet ${i + 1}/${
              jobseekersWithHours.length
            } for ${jobseekerName}:`,
            result
          );
        } catch (error) {
          let errorMessage = "Unknown error";

          // Handle different types of errors
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (
            typeof error === "object" &&
            error !== null &&
            "error" in error
          ) {
            errorMessage = (error as { error: string }).error;
          }

          failedTimesheets.push({
            jobseeker: jobseekerName || "Unknown",
            error: errorMessage,
          });
          console.error(
            `Failed to create timesheet for ${jobseekerName}:`,
            error
          );

          // If it's a duplicate error, show immediate feedback
          if (
            errorMessage.includes("already exists") ||
            errorMessage.includes("duplicate")
          ) {
            setGenerationMessage(
              t("bulkTimesheetManagement.messages.duplicateDetected", {
                jobseekerName: jobseekerName,
              })
            );

            // Clear duplicate message after a delay
            setTimeout(() => {
              setGenerationMessage("");
            }, 5000);
          }
        }
      }

      // Show results
      if (createdTimesheets.length > 0) {
        const grandTotalHours = jobseekersWithHours.reduce(
          (sum, ts) => sum + ts.totalRegularHours + ts.totalOvertimeHours,
          0
        );
        const grandTotalPay = jobseekersWithHours.reduce(
          (sum, ts) => sum + ts.jobseekerPay,
          0
        );

        if (failedTimesheets.length === 0) {
          // All timesheets created successfully
          setGenerationMessage(
            t("bulkTimesheetManagement.messages.allTimesheetsCreated", {
              count: createdTimesheets.length,
              totalHours: grandTotalHours.toFixed(2),
              totalPay: grandTotalPay.toFixed(2),
            })
          );
        } else {
          // Some timesheets failed
          setGenerationMessage(
            t("bulkTimesheetManagement.messages.partialTimesheetsCreated", {
              successful: createdTimesheets.length,
              total: createdTimesheets.length + failedTimesheets.length,
              failed: failedTimesheets.length,
              totalHours: grandTotalHours.toFixed(2),
              totalPay: grandTotalPay.toFixed(2),
            })
          );
        }

        // Reset form state after successful creation (with longer delay for user to see message)
        setTimeout(() => {
          resetFormState();
        }, 8000);
      } else {
        // All timesheets failed
        const duplicateErrors = failedTimesheets.filter(
          (f) =>
            f.error.includes("already exists") || f.error.includes("duplicate")
        );

        if (duplicateErrors.length === failedTimesheets.length) {
          // All failures were due to duplicates
          setGenerationError(
            t("bulkTimesheetManagement.messages.allTimesheetsExist")
          );
        } else {
          // Mixed or other errors
          setGenerationError(
            t("bulkTimesheetManagement.messages.allTimesheetsFailed", {
              failureDetails: failedTimesheets
                .map((f) => `${f.jobseeker}: ${f.error}`)
                .join("; "),
            })
          );
        }

        // Clear any success message when showing error
        setGenerationMessage("");

        // Clear error message after longer delay
        setTimeout(() => {
          setGenerationError("");
        }, 10000);
      }

      return {
        success: createdTimesheets.length > 0,
        createdTimesheets,
        failedTimesheets,
      };
    } catch (error) {
      console.error("Error in bulk timesheet generation:", error);
      setGenerationError(
        `${t("bulkTimesheetManagement.messages.failedToCreate")} ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setGenerationMessage(""); // Clear any success message when showing error

      // Clear error message after longer delay
      setTimeout(() => {
        setGenerationError("");
      }, 10000);
    } finally {
      setIsGeneratingBulkTimesheet(false);
      setCurrentInvoiceNumber(""); // Clear current invoice number when done
    }
  };

  return (
    <div className="bulk-timesheet-page-container timesheet-page-container">
      {/* Full-screen loader overlay */}
      {isGeneratingBulkTimesheet && (
        <div className="bulk-timesheet-loader-overlay">
          <div className="bulk-timesheet-loader-content">
            <div className="bulk-timesheet-spinner"></div>
            <h3 className="bulk-timesheet-loader-title">
              {t("bulkTimesheetManagement.messages.generating")}
            </h3>
            <p className="bulk-timesheet-loader-message">
              {generationMessage ||
                t("bulkTimesheetManagement.messages.pleaseWait")}
            </p>
            <div className="bulk-timesheet-loader-details">
              <p>{t("bulkTimesheetManagement.messages.processingMultiple")}</p>
              <p>{t("bulkTimesheetManagement.messages.generatingInvoices")}</p>
              {currentInvoiceNumber && (
                <p className="bulk-timesheet-current-invoice">
                  {t("bulkTimesheetManagement.messages.currentInvoice")}: #
                  {currentInvoiceNumber}
                </p>
              )}
              <p>{t("bulkTimesheetManagement.messages.doNotClose")}</p>
            </div>
          </div>
        </div>
      )}

      <AppHeader
        title={t("bulkTimesheetManagement.title")}
        hideHamburgerMenu={false}
        statusMessage={
          generationError ||
          (!isGeneratingBulkTimesheet ? generationMessage : "")
        }
        statusType={
          generationError ? "error" : generationMessage ? "success" : undefined
        }
      />
      <div className="timesheet-content-container">
        <div className="timesheet-selection-bar">
          <div className="selection-section">
            <label className="selection-label">
              <Building size={16} />
              {t("bulkTimesheetManagement.columns.client")}
            </label>
            {clientLoading ? (
              <div className="invoice-dropdown-skeleton">
                <div className="skeleton-dropdown-trigger">
                  <div className="skeleton-icon"></div>
                  <div className="skeleton-text skeleton-dropdown-text"></div>
                  <div className="skeleton-icon skeleton-chevron"></div>
                </div>
              </div>
            ) : (
              <CustomDropdown
                options={clientOptions}
                selectedOption={selectedClientOption}
                onSelect={handleClientSelect}
                placeholder={t(
                  "bulkTimesheetManagement.placeholders.selectClient"
                )}
                loading={false}
                icon={<Building size={16} />}
                emptyMessage={t(
                  "bulkTimesheetManagement.constants.noClientsFound"
                )}
              />
            )}
          </div>
          <div className="selection-section">
            <label className="selection-label">
              {t("bulkTimesheetManagement.columns.position")}
            </label>
            {positionLoading ? (
              <div className="invoice-dropdown-skeleton">
                <div className="skeleton-dropdown-trigger">
                  <div className="skeleton-icon"></div>
                  <div className="skeleton-text skeleton-dropdown-text"></div>
                  <div className="skeleton-icon skeleton-chevron"></div>
                </div>
              </div>
            ) : (
              <CustomDropdown
                options={positionOptions}
                selectedOption={
                  selectedPosition
                    ? positionOptions.find(
                        (opt) => opt.id === selectedPosition.id
                      )
                    : null
                }
                onSelect={(option) => {
                  if (Array.isArray(option)) return;
                  const selectedPosition = positions.filter(
                    (position) => position.id === option.id
                  );
                  setSelectedPosition(selectedPosition[0]);
                }}
                placeholder={
                  selectedClient
                    ? t("bulkTimesheetManagement.placeholders.selectPosition")
                    : t("bulkTimesheetManagement.placeholders.clientFirst")
                }
                disabled={!selectedClient}
                loading={false}
                icon={null}
                emptyMessage={
                  selectedClient
                    ? t("bulkTimesheetManagement.constants.noPositionsFound")
                    : t(
                        "bulkTimesheetManagement.placeholders.positionSelectHelp"
                      )
                }
              />
            )}
          </div>
          <div className="selection-section">
            <label className="selection-label">
              {t("bulkTimesheetManagement.columns.weekPeriod")}
            </label>
            <CustomDropdown
              options={weekDropdownOptions}
              selectedOption={
                selectedWeekStart
                  ? weekDropdownOptions.find(
                      (opt) => opt.value === selectedWeekStart
                    )
                  : null
              }
              onSelect={(option) => {
                if (Array.isArray(option)) return;
                setSelectedWeekStart(option.value as string);
              }}
              placeholder={t("bulkTimesheetManagement.placeholders.selectWeek")}
              loading={false}
              icon={null}
              emptyMessage={t("common.noData")}
              searchable={false}
            />
          </div>
        </div>
        {/* Move client info header below selection bar, as a separate section */}
        {selectedClient && (
          <div className="timesheet-unified-header">
            <div className="timesheet-header-sections">
              <div className="timesheet-section timesheet-client-section">
                <h4 className="timesheet-section-title">
                  {t("bulkTimesheetManagement.form.clientAndPosition")}
                </h4>
                <div className="timesheet-section-content">
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("bulkTimesheetManagement.form.clientName")}:
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedClient.companyName}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("bulkTimesheetManagement.form.positionTitle")}:
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedPosition?.title ||
                        t("bulkTimesheetManagement.constants.na")}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("bulkTimesheetManagement.form.positionCode")}:
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedPosition?.positionCode ||
                        t("bulkTimesheetManagement.constants.na")}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("bulkTimesheetManagement.form.positionNumber")}:
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedPosition?.positionNumber ||
                        t("bulkTimesheetManagement.constants.na")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="timesheet-section timesheet-invoice-section">
                <h4 className="timesheet-section-title">
                  {t("bulkTimesheetManagement.form.invoiceAndPeriod")}
                </h4>
                <div className="timesheet-section-content">
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("bulkTimesheetManagement.form.invoiceNumbers")}:
                    </span>
                    <span className="timesheet-detail-value">
                      {t("bulkTimesheetManagement.form.generatedIndividually")}
                    </span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">
                      {t("bulkTimesheetManagement.form.period")}:
                    </span>
                    <span className="timesheet-detail-value">
                      {selectedWeekStart ? (
                        <>
                          {formatDate(selectedWeekStart)} -{" "}
                          {formatDate(
                            new Date(
                              new Date(selectedWeekStart).getTime() +
                                6 * 24 * 60 * 60 * 1000
                            )
                              .toISOString()
                              .split("T")[0]
                          )}
                        </>
                      ) : (
                        t("bulkTimesheetManagement.constants.na")
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timesheet input for each jobseeker */}
        {selectedClient &&
          selectedPosition &&
          selectedWeekStart &&
          jobseekerTimesheets.length > 0 && (
            <div className="bulk-timesheet-forms-container">
              {jobseekerTimesheets.map((ts) => (
                <div
                  className="timesheet-assignment-card"
                  key={ts.jobseeker.id}
                >
                  <div className="timesheet-hours-adjustments-container">
                    <div className="timesheet-hours-section">
                      <div className="timesheet-hours-header">
                        <h4 className="timesheet-hours-title">
                          {t("bulkTimesheetManagement.form.dailyHours")} |{" "}
                          {ts.jobseeker.jobseekerProfile?.first_name}{" "}
                          {ts.jobseeker.jobseekerProfile?.last_name} |{" "}
                          {ts.jobseeker.jobseekerProfile?.email}
                          {ts.jobseeker.jobseekerProfile?.billing_email && (
                            <>
                              {" "}
                              | Billing:{" "}
                              {ts.jobseeker.jobseekerProfile.billing_email}
                            </>
                          )}
                          {ts.jobseeker.jobseekerProfile?.mobile && (
                            <> | {ts.jobseeker.jobseekerProfile.mobile}</>
                          )}
                          {ts.jobseeker.jobseekerProfile?.employee_id && (
                            <> | {ts.jobseeker.jobseekerProfile.employee_id}</>
                          )}
                        </h4>
                        <button
                          className="button danger"
                          onClick={() => removeJobseeker(ts.jobseeker.id)}
                          title={t(
                            "bulkTimesheetManagement.buttons.removeJobseeker"
                          )}
                          disabled={jobseekerTimesheets.length === 1}
                        >
                          <Minus size={16} />
                        </button>
                      </div>
                      <div className="timesheet-days-grid">
                        {ts.entries.map((entry) => (
                          <div key={entry.date} className="timesheet-day-entry">
                            <label className="timesheet-day-label">
                              <div className="timesheet-day-name">
                                {new Date(entry.date).toLocaleDateString(
                                  "en-CA",
                                  { weekday: "short" }
                                )}
                              </div>
                              <div className="timesheet-day-date">
                                ({entry.date})
                              </div>
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              step="0.5"
                              value={entry.hours === 0 ? "" : entry.hours}
                              onChange={(e) => {
                                const hours = parseFloat(e.target.value) || 0;
                                updateEntry(ts.jobseeker.id, entry.date, hours);
                              }}
                              placeholder="0.0"
                              className="timesheet-hours-input"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="timesheet-hours-section adjustments-section">
                      <h4 className="timesheet-hours-title timesheet-pay-adjustments-title">
                        {t("bulkTimesheetManagement.form.payAdjustments")}
                      </h4>
                      <div className="timesheet-days-grid">
                        <div className="timesheet-day-entry">
                          <label className="timesheet-day-label">
                            <div className="timesheet-day-name">
                              {t("bulkTimesheetManagement.form.bonus")}
                            </div>
                            <div className="timesheet-day-date">
                              {t("bulkTimesheetManagement.form.amount")}
                            </div>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ts.bonusAmount === 0 ? "" : ts.bonusAmount}
                            onChange={(e) => {
                              const amount = parseFloat(e.target.value) || 0;
                              updateBonus(ts.jobseeker.id, amount);
                            }}
                            placeholder="0.00"
                            className="timesheet-hours-input"
                          />
                        </div>
                        <div className="timesheet-day-entry">
                          <label className="timesheet-day-label">
                            <div className="timesheet-day-name">
                              {t("bulkTimesheetManagement.form.deduction")}
                            </div>
                            <div className="timesheet-day-date">
                              {t("bulkTimesheetManagement.form.amount")}
                            </div>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              ts.deductionAmount === 0 ? "" : ts.deductionAmount
                            }
                            onChange={(e) => {
                              const amount = parseFloat(e.target.value) || 0;
                              updateDeduction(ts.jobseeker.id, amount);
                            }}
                            placeholder="0.00"
                            className="timesheet-hours-input"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Position Pay Info */}
                    <div className="timesheet-pay-info-section">
                      <div className="timesheet-pay-info-grid">
                        <div className="timesheet-pay-info-item">
                          <span className="timesheet-pay-label">
                            {t("bulkTimesheetManagement.form.regularPayRate")}
                          </span>
                          <span className="timesheet-pay-value">
                            $
                            {selectedPosition?.regularPayRate ||
                              t("bulkTimesheetManagement.constants.na")}
                            /h
                          </span>
                        </div>
                        {selectedPosition?.overtimeEnabled && (
                          <div className="timesheet-pay-info-item">
                            <span className="timesheet-pay-label">
                              {t(
                                "bulkTimesheetManagement.form.overtimePayRate"
                              )}
                            </span>
                            <span className="timesheet-pay-value">
                              $
                              {selectedPosition?.overtimePayRate ||
                                t("bulkTimesheetManagement.constants.na")}
                              /h
                            </span>
                          </div>
                        )}
                        <div className="timesheet-pay-info-item">
                          <span className="timesheet-pay-label">
                            {t(
                              "bulkTimesheetManagement.form.overtimeThreshold"
                            )}
                          </span>
                          <span className="timesheet-pay-value">
                            {(selectedPosition as PositionWithOvertime)
                              ?.overtimeHours || "40"}{" "}
                            {t("bulkTimesheetManagement.form.hours")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Notes Section */}
                  <div className="timesheet-notes-section">
                    <h4 className="timesheet-notes-title">
                      {t("bulkTimesheetManagement.form.additionalNotes")}
                    </h4>
                    <textarea
                      value={ts.notes}
                      onChange={(e) =>
                        updateNotes(ts.jobseeker.id, e.target.value)
                      }
                      placeholder={t(
                        "bulkTimesheetManagement.form.notesPlaceholder"
                      )}
                      className="timesheet-notes-textarea"
                      rows={4}
                    />
                  </div>
                  {/* Individual Email Control */}
                  <div className="timesheet-email-control">
                    <label className="timesheet-checkbox-label">
                      <input
                        type="checkbox"
                        checked={ts.emailSent}
                        onChange={(e) =>
                          updateJobseekerEmailSent(
                            ts.jobseeker.id,
                            e.target.checked
                          )
                        }
                        className="timesheet-checkbox"
                      />
                      <span className="timesheet-checkbox-text">
                        {t("bulkTimesheetManagement.email.sendToJobseeker")}
                      </span>
                    </label>
                    <p
                      className="field-note"
                      style={{ marginTop: "8px", marginLeft: "24px" }}
                    >
                      {t("bulkTimesheetManagement.email.billingEmailNote")}
                    </p>
                  </div>
                  {/* Invoice Style Summary - Exact same as TimesheetManagement */}
                  <div className="timesheet-invoice-container">
                    <div className="timesheet-invoice-table">
                      <div className="timesheet-invoice-table-header">
                        <div className="timesheet-col-description">
                          {t("bulkTimesheetManagement.form.description")}
                        </div>
                        <div className="timesheet-col-hours">
                          {t("bulkTimesheetManagement.form.totalHours")}
                        </div>
                        <div className="timesheet-col-rate">
                          {t("bulkTimesheetManagement.form.rate")}
                        </div>
                        <div className="timesheet-col-amount">
                          {t("bulkTimesheetManagement.form.amount")}
                        </div>
                      </div>

                      <div className="timesheet-invoice-table-body">
                        {/* Regular Hours Line Item */}
                        <div className="timesheet-invoice-line-item">
                          <div className="timesheet-col-description">
                            <div className="timesheet-item-title">
                              {t(
                                "bulkTimesheetManagement.form.totalRegularHours"
                              )}
                            </div>
                            <div className="timesheet-item-subtitle">
                              {t(
                                "bulkTimesheetManagement.form.standardWorkHours"
                              )}
                            </div>
                          </div>
                          <div className="timesheet-col-hours">
                            {ts.totalRegularHours.toFixed(2)}
                          </div>
                          <div className="timesheet-col-rate">
                            ${selectedPosition?.regularPayRate || "0.00"}
                          </div>
                          <div className="timesheet-col-amount">
                            $
                            {(
                              ts.totalRegularHours *
                              parseFloat(
                                selectedPosition?.regularPayRate || "0"
                              )
                            ).toFixed(2)}
                          </div>
                        </div>

                        {/* Overtime Hours Line Item (if applicable) */}
                        {ts.totalOvertimeHours > 0 && (
                          <div className="timesheet-invoice-line-item">
                            <div className="timesheet-col-description">
                              <div className="timesheet-item-title">
                                {t(
                                  "bulkTimesheetManagement.form.overtimeHours"
                                )}
                              </div>
                              <div className="timesheet-item-subtitle">
                                {t(
                                  "bulkTimesheetManagement.form.exceedingHours"
                                )}{" "}
                                {(selectedPosition as PositionWithOvertime)
                                  ?.overtimeHours || "40"}{" "}
                                {t("bulkTimesheetManagement.form.hoursPerWeek")}
                              </div>
                            </div>
                            <div className="timesheet-col-hours">
                              {ts.totalOvertimeHours.toFixed(2)}
                            </div>
                            <div className="timesheet-col-rate">
                              $
                              {(selectedPosition as PositionWithOvertime)
                                ?.overtimePayRate ||
                                selectedPosition?.regularPayRate ||
                                "0.00"}
                            </div>
                            <div className="timesheet-col-amount">
                              $
                              {(
                                ts.totalOvertimeHours *
                                parseFloat(
                                  (selectedPosition as PositionWithOvertime)
                                    ?.overtimePayRate ||
                                    selectedPosition?.regularPayRate ||
                                    "0"
                                )
                              ).toFixed(2)}
                            </div>
                          </div>
                        )}

                        {/* Bonus Line Item (if applicable) */}
                        {ts.bonusAmount > 0 && (
                          <div className="timesheet-invoice-line-item">
                            <div className="timesheet-col-description">
                              <div className="timesheet-item-title">
                                {t("bulkTimesheetManagement.form.bonus")}
                              </div>
                            </div>
                            <div className="timesheet-col-hours">-</div>
                            <div className="timesheet-col-rate">-</div>
                            <div className="timesheet-col-amount">
                              ${ts.bonusAmount.toFixed(2)}
                            </div>
                          </div>
                        )}

                        {/* Deduction Line Item (if applicable) */}
                        {ts.deductionAmount > 0 && (
                          <div className="timesheet-invoice-line-item">
                            <div className="timesheet-col-description">
                              <div className="timesheet-item-title">
                                {t("bulkTimesheetManagement.form.deduction")}
                              </div>
                            </div>
                            <div className="timesheet-col-hours">-</div>
                            <div className="timesheet-col-rate">-</div>
                            <div className="timesheet-col-amount">
                              -${ts.deductionAmount.toFixed(2)}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="timesheet-invoice-totals">
                        <div className="timesheet-total-line">
                          <div className="timesheet-total-label">
                            {t("bulkTimesheetManagement.form.totalHours")}:
                          </div>
                          <div className="timesheet-total-value">
                            {(
                              ts.totalRegularHours + ts.totalOvertimeHours
                            ).toFixed(2)}
                          </div>
                        </div>
                        {(() => {
                          const position =
                            selectedPosition as PositionWithOvertime;
                          const basePay = getBaseJobseekerPay(ts, position);
                          const subtotal = basePay;
                          const employeePay =
                            subtotal +
                            (ts.bonusAmount || 0) -
                            (ts.deductionAmount || 0);
                          return (
                            <>
                              <div className="timesheet-total-line timesheet-subtotal">
                                <div className="timesheet-total-label">
                                  {t("bulkTimesheetManagement.form.subtotal")}:
                                </div>
                                <div className="timesheet-total-value">
                                  ${subtotal.toFixed(2)}
                                </div>
                              </div>
                              {ts.bonusAmount > 0 && (
                                <div className="timesheet-total-line">
                                  <div className="timesheet-total-label">
                                    {t("bulkTimesheetManagement.form.bonus")}:
                                  </div>
                                  <div className="timesheet-total-value">
                                    +${ts.bonusAmount.toFixed(2)}
                                  </div>
                                </div>
                              )}
                              {ts.deductionAmount > 0 && (
                                <div className="timesheet-total-line">
                                  <div className="timesheet-total-label">
                                    {t(
                                      "bulkTimesheetManagement.form.deduction"
                                    )}
                                    :
                                  </div>
                                  <div className="timesheet-total-value">
                                    -${ts.deductionAmount.toFixed(2)}
                                  </div>
                                </div>
                              )}
                              <div className="timesheet-total-line timesheet-grand-total">
                                <div className="timesheet-total-label">
                                  {t(
                                    "bulkTimesheetManagement.form.employeePay"
                                  )}
                                  :
                                </div>
                                <div className="timesheet-total-value">
                                  ${employeePay.toFixed(2)}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Separate Final Summary Table */}
              <div className="timesheet-invoice-container">
                <div className="timesheet-invoice-table">
                  <div className="timesheet-invoice-table-header">
                    <div className="timesheet-col-description">
                      {t("bulkTimesheetManagement.form.finalSummary")}
                    </div>
                    <div className="timesheet-col-hours">Hours</div>
                    <div className="timesheet-col-rate">Rate</div>
                    <div className="timesheet-col-amount">Amount</div>
                  </div>
                  <div className="timesheet-invoice-table-body">
                    <div className="timesheet-invoice-line-item">
                      <div className="timesheet-col-description">
                        <div className="timesheet-item-title">
                          {t("bulkTimesheetManagement.form.totalRegularHours")}
                        </div>
                      </div>
                      <div className="timesheet-col-hours">
                        {grandTotalRegularHours.toFixed(2)}
                      </div>
                      <div className="timesheet-col-rate">
                        ${selectedPosition?.regularPayRate || "0.00"}
                      </div>
                      <div className="timesheet-col-amount">
                        $
                        {(
                          grandTotalRegularHours *
                          parseFloat(selectedPosition?.regularPayRate || "0")
                        ).toFixed(2)}
                      </div>
                    </div>
                    {grandTotalOvertimeHours > 0 && (
                      <div className="timesheet-invoice-line-item">
                        <div className="timesheet-col-description">
                          <div className="timesheet-item-title">
                            {t(
                              "bulkTimesheetManagement.form.totalOvertimeHours"
                            )}
                          </div>
                        </div>
                        <div className="timesheet-col-hours">
                          {grandTotalOvertimeHours.toFixed(2)}
                        </div>
                        <div className="timesheet-col-rate">
                          $
                          {(selectedPosition as PositionWithOvertime)
                            ?.overtimePayRate ||
                            selectedPosition?.regularPayRate ||
                            "0.00"}
                        </div>
                        <div className="timesheet-col-amount">
                          $
                          {(
                            grandTotalOvertimeHours *
                            parseFloat(
                              (selectedPosition as PositionWithOvertime)
                                ?.overtimePayRate ||
                                selectedPosition?.regularPayRate ||
                                "0"
                            )
                          ).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="timesheet-invoice-totals">
                    <div className="timesheet-total-line">
                      <div className="timesheet-total-label">
                        {t("bulkTimesheetManagement.form.grandTotalHours")}:
                      </div>
                      <div className="timesheet-total-value">
                        {(
                          grandTotalRegularHours + grandTotalOvertimeHours
                        ).toFixed(2)}
                      </div>
                    </div>
                    {grandTotalBonus > 0 && (
                      <div className="timesheet-total-line">
                        <div className="timesheet-total-label">
                          {t("bulkTimesheetManagement.form.grandTotalBonus")}:
                        </div>
                        <div className="timesheet-total-value">
                          +${grandTotalBonus.toFixed(2)}
                        </div>
                      </div>
                    )}
                    {grandTotalDeduction > 0 && (
                      <div className="timesheet-total-line">
                        <div className="timesheet-total-label">
                          {t(
                            "bulkTimesheetManagement.form.grandTotalDeduction"
                          )}
                          :
                        </div>
                        <div className="timesheet-total-value">
                          -${grandTotalDeduction.toFixed(2)}
                        </div>
                      </div>
                    )}
                    <div className="timesheet-total-line timesheet-grand-total">
                      <div className="timesheet-total-label">
                        {t("bulkTimesheetManagement.form.grandTotalPay")}:
                      </div>
                      <div className="timesheet-total-value">
                        ${grandTotalPay.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="timesheet-action-section">
                <div className="timesheet-email-option">
                  <label className="timesheet-checkbox-label">
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => {
                        setSendEmail(e.target.checked);
                        updateAllJobseekersEmailSent(e.target.checked);
                      }}
                      className="timesheet-checkbox"
                    />
                    <span className="timesheet-checkbox-text">
                      {t("bulkTimesheetManagement.email.sendToAll")}
                    </span>
                  </label>
                  <p
                    className="field-note"
                    style={{ marginTop: "8px", marginLeft: "24px" }}
                  >
                    {t("bulkTimesheetManagement.email.billingEmailNote")}
                  </p>
                </div>
                <button
                  className="button"
                  onClick={generateBulkTimesheetData}
                  disabled={
                    jobseekerTimesheets.length === 0 ||
                    isGeneratingBulkTimesheet ||
                    jobseekerTimesheets.every(
                      (ts) => ts.totalRegularHours + ts.totalOvertimeHours === 0
                    )
                  }
                >
                  {isGeneratingBulkTimesheet
                    ? t("bulkTimesheetManagement.buttons.generating")
                    : t(
                        "bulkTimesheetManagement.buttons.generateBulkTimesheet"
                      )}
                </button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
