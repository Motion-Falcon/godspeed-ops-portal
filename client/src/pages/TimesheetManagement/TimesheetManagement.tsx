import { useState, useEffect } from "react";
import { JobSeekerProfile } from "../../types/jobseeker";
import { AppHeader } from "../../components/AppHeader";
import {
  CustomDropdown,
  DropdownOption,
} from "../../components/CustomDropdown";
import {
  Clock,
  Calendar,
  FileText,
  User,
  DollarSign,
  Plus,
  RefreshCw,
  Loader2,
  Building,
} from "lucide-react";
import { getClientPositions } from "../../services/api/position";
import { getJobseekerProfiles } from "../../services/api/jobseeker";
import { getClients, ClientData } from "../../services/api/client";
import {
  createTimesheetFromFrontendData,
  getJobseekerTimesheets,
  TimesheetData,
  TimesheetResponse,
  updateTimesheet,
  generateInvoiceNumber,
} from "../../services/api/timesheet";
import "../../styles/pages/TimesheetManagement.css";
import { generateWeekOptions, formatDate } from "../../utils/weekUtils";

// Types for timesheet
interface TimesheetEntry {
  date: string;
  hours: number;
  overtimeHours: number;
}

interface WeeklyTimesheet {
  positionId: string;
  invoiceNumber: string;
  weekStartDate: string;
  weekEndDate: string;
  entries: TimesheetEntry[];
  totalRegularHours: number;
  totalOvertimeHours: number;
  jobseekerPay: number;
  clientBill: number;
  bonusAmount: number;
  deductionAmount: number;
  existingTimesheetId?: string; // Track if this is an existing timesheet
}

// Extended position type that includes overtime properties
export interface PositionWithOvertime {
  id: string;
  positionCode: string;
  title: string;
  clientName: string;
  city: string;
  province: string;
  employmentTerm: string;
  employmentType: string;
  positionCategory: string;
  experience: string;
  showOnJobPortal: boolean;
  startDate: string;
  endDate?: string;
  regularPayRate: string;
  billRate: string;
  numberOfPositions: number;
  overtimeEnabled?: boolean;
  overtimeHours?: string; // This is the overtime threshold
  overtimePayRate?: string;
  overtimeBillRate?: string;
  markup?: string;
}

// Interface for client positions
interface ClientPosition {
  id: string;
  positionCode: string;
  title: string;
  regularPayRate: string;
  billRate: string;
  overtimeEnabled?: boolean;
  overtimeHours?: string;
  overtimePayRate?: string;
  overtimeBillRate?: string;
  markup?: string;
}

// Interface for existing timesheet data from API
interface ExistingTimesheetData {
  id?: string;
  invoiceNumber: string;
  positionId?: string;
  weekStartDate: string;
  weekEndDate: string;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalJobseekerPay: number;
  totalClientBill: number;
  bonusAmount?: number;
  deductionAmount?: number;
  dailyHours: Array<{
    date: string;
    hours: number;
  }>;
}

export function TimesheetManagement() {
  // State for jobseeker selection
  const [jobseekers, setJobseekers] = useState<JobSeekerProfile[]>([]);
  const [selectedJobseeker, setSelectedJobseeker] =
    useState<JobSeekerProfile | null>(null);
  const [jobseekerLoading, setJobseekerLoading] = useState(false);

  // State for client selection
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  // State for position selection
  const [positions, setPositions] = useState<ClientPosition[]>([]);
  const [selectedPosition, setSelectedPosition] =
    useState<ClientPosition | null>(null);
  const [positionLoading, setPositionLoading] = useState(false);

  // State for timesheet
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>("");
  const [timesheets, setTimesheets] = useState<WeeklyTimesheet[]>([]);
  const [weekOptions, setWeekOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  // State for existing timesheets (prefetched)
  const [existingTimesheets, setExistingTimesheets] = useState<
    ExistingTimesheetData[]
  >([]);
  const [timesheetsLoading, setTimesheetsLoading] = useState(false);

  // State for timesheet generation
  const [isGeneratingTimesheet, setIsGeneratingTimesheet] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string>("");
  const [generationError, setGenerationError] = useState<string>("");

  // State for email sending preference per timesheet
  const [emailPreferences, setEmailPreferences] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    // Fetch jobseekers on component mount
    fetchJobseekers();

    // Generate week options (past 52 weeks)
    setWeekOptions(generateWeekOptions());
  }, []);

  // Fetch clients when jobseeker is selected
  useEffect(() => {
    if (selectedJobseeker) {
      fetchClients();
      // Reset client and position selection
      setSelectedClient(null);
      setSelectedPosition(null);
      setPositions([]);
    }
  }, [selectedJobseeker]);

  // Fetch positions when client is selected
  useEffect(() => {
    if (selectedClient) {
      fetchClientPositions(selectedClient.id!);
      // Reset position selection
      setSelectedPosition(null);
    }
  }, [selectedClient]);

  const fetchJobseekers = async () => {
    try {
      setJobseekerLoading(true);
      const response = await getJobseekerProfiles({ limit: 100000000 }); // Get all jobseekers
      setJobseekers(response.profiles);
    } catch (error) {
      console.error("Error fetching jobseekers:", error);
    } finally {
      setJobseekerLoading(false);
    }
  };

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
    try {
      setPositionLoading(true);
      const response = await getClientPositions(clientId, { limit: 10000000 });
      // Transform positions to match our interface
      const transformedPositions: ClientPosition[] = response.positions.map(
        (pos) => ({
          id: pos.id!,
          positionCode: pos.positionCode!,
          title: pos.title!,
          regularPayRate: pos.regularPayRate!,
          billRate: pos.billRate!,
          overtimeEnabled: pos.overtimeEnabled,
          overtimeHours: pos.overtimeHours,
          overtimePayRate: pos.overtimePayRate,
          overtimeBillRate: pos.overtimeBillRate,
          markup: pos.markup,
        })
      );
      setPositions(transformedPositions);
    } catch (error) {
      console.error("Error fetching client positions:", error);
      setPositions([]);
    } finally {
      setPositionLoading(false);
    }
  };

  const fetchExistingTimesheets = async (
    jobseekerUserId: string,
    weekStartDate: string
  ) => {
    if (!jobseekerUserId || !weekStartDate) return;

    try {
      setTimesheetsLoading(true);
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 6);

      const response = await getJobseekerTimesheets(jobseekerUserId, {
        weekStartFilter: weekStartDate,
        weekEndFilter: weekEndDate.toISOString().split("T")[0],
        limit: 100,
      });

      // Transform TimesheetData to ExistingTimesheetData format
      const transformedTimesheets: ExistingTimesheetData[] = (
        response.timesheets || []
      ).map((timesheet) => ({
        id: timesheet.id,
        invoiceNumber: timesheet.invoiceNumber, // Using id as invoice number for now
        positionId: timesheet.positionId, // Map the positionId field
        weekStartDate: timesheet.weekStartDate,
        weekEndDate: timesheet.weekEndDate,
        totalRegularHours: timesheet.totalRegularHours,
        totalOvertimeHours: timesheet.totalOvertimeHours,
        totalJobseekerPay: timesheet.totalJobseekerPay,
        totalClientBill: timesheet.totalClientBill,
        bonusAmount: timesheet.bonusAmount,
        deductionAmount: timesheet.deductionAmount,
        dailyHours: timesheet.dailyHours,
      }));

      setExistingTimesheets(transformedTimesheets);
    } catch (error) {
      console.error("Error fetching existing timesheets:", error);
      setExistingTimesheets([]);
    } finally {
      setTimesheetsLoading(false);
    }
  };

  // Convert data to dropdown options
  const jobseekerOptions: DropdownOption[] = jobseekers.map((jobseeker) => {
    const phoneNumber = (jobseeker as JobSeekerProfile & { phoneNumber?: string }).phoneNumber;
    const employeeId = (jobseeker as JobSeekerProfile & { employeeId?: string }).employeeId;
    return {
      id: jobseeker.id,
      label: jobseeker.name || jobseeker.email || "Unknown",
      sublabel: [
        jobseeker.email,
        phoneNumber,
        employeeId
      ].filter(Boolean).join(" - "),
      value: jobseeker,
    };
  });

  const clientOptions: DropdownOption[] = clients.map((client) => ({
    id: client.id!,
    label: client.companyName || "Unknown Client",
    sublabel: client.shortCode || "",
    value: client,
  }));

  const positionOptions: DropdownOption[] = positions.map((position) => ({
    id: position.id,
    label: position.title || "Unknown Position",
    sublabel: position.positionCode || "",
    value: position,
  }));

  const weekDropdownOptions: DropdownOption[] = weekOptions.map((week) => ({
    id: week.value,
    label: week.label,
    value: week.value,
  }));

  const selectedJobseekerOption = selectedJobseeker
    ? jobseekerOptions.find((opt) => opt.id === selectedJobseeker.id)
    : null;

  const selectedClientOption = selectedClient
    ? clientOptions.find((opt) => opt.id === selectedClient.id)
    : null;

  const selectedPositionOption = selectedPosition
    ? positionOptions.find((opt) => opt.id === selectedPosition.id)
    : null;

  const selectedWeekOption = selectedWeekStart
    ? weekDropdownOptions.find((opt) => opt.value === selectedWeekStart)
    : null;

  const handleJobseekerSelect = (option: DropdownOption | DropdownOption[]) => {
    if (Array.isArray(option)) return; // Ignore multi-select
    const jobseeker = option.value as JobSeekerProfile;
    setSelectedJobseeker(jobseeker);
    // Reset other selections
    setSelectedClient(null);
    setSelectedPosition(null);
    setTimesheets([]);
  };

  const handleClientSelect = (option: DropdownOption | DropdownOption[]) => {
    if (Array.isArray(option)) return;
    const client = option.value as ClientData;
    setSelectedClient(client);
    // Reset position selection and timesheets
    setSelectedPosition(null);
    setTimesheets([]);
  };

  const handlePositionSelect = (option: DropdownOption | DropdownOption[]) => {
    if (Array.isArray(option)) return;
    const position = option.value as ClientPosition;
    setSelectedPosition(position);
    // Reset timesheets
    setTimesheets([]);
  };

  const handleWeekSelect = (option: DropdownOption | DropdownOption[]) => {
    if (Array.isArray(option)) return;
    const weekValue = option.value as string;
    setSelectedWeekStart(weekValue);
  };

  // Initialize timesheets when week, jobseeker, and position are selected
  useEffect(() => {
    if (selectedJobseeker && selectedPosition && selectedWeekStart) {
      fetchExistingTimesheets(selectedJobseeker.userId, selectedWeekStart);
    }
  }, [selectedJobseeker, selectedPosition, selectedWeekStart]);

  // Update timesheets when existing timesheets data changes
  useEffect(() => {
    if (selectedJobseeker && selectedPosition && selectedWeekStart) {
      initializeTimesheetsForPosition();
    }
  }, [
    selectedJobseeker,
    selectedPosition,
    selectedWeekStart,
    existingTimesheets,
  ]);

  const initializeTimesheetsForPosition = async () => {
    if (!selectedJobseeker || !selectedPosition || !selectedWeekStart) {
      setTimesheets([]);
      return;
    }

    const weekEndDate = new Date(selectedWeekStart);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    const weekDates = generateWeekDates(selectedWeekStart);

    // Check if there's an existing timesheet for this specific position and week
    const existingTimesheet = existingTimesheets.find(
      (timesheet: ExistingTimesheetData) => {
        return (
          timesheet.weekStartDate === selectedWeekStart &&
          timesheet.positionId === selectedPosition.id // Only match if positionId matches
        );
      }
    );

    let entries: TimesheetEntry[];

    if (existingTimesheet && existingTimesheet.dailyHours) {
      // Prefill with existing data only if position matches
      entries = weekDates.map((date) => {
        const existingEntry = existingTimesheet.dailyHours.find(
          (entry: { date: string; hours: number }) => entry.date === date
        );
        return {
          date,
          hours: existingEntry ? existingEntry.hours : 0,
          overtimeHours: 0, // Will be calculated
        };
      });
    } else {
      // Initialize with empty data if no matching timesheet found
      entries = weekDates.map((date) => ({
        date,
        hours: 0,
        overtimeHours: 0,
      }));
    }
    // Generate invoice number for new timesheets
    let invoiceNumber = existingTimesheet?.invoiceNumber || "";
    if (!existingTimesheet) {
      try {
        invoiceNumber = await generateInvoiceNumber();
      } catch (error) {
        console.error("Error generating invoice number:", error);
        invoiceNumber = "TBD"; // Fallback if generation fails
      }
    }

    const timesheet: WeeklyTimesheet = {
      positionId: selectedPosition.id,
      invoiceNumber: invoiceNumber,
      weekStartDate: selectedWeekStart,
      weekEndDate: weekEndDate.toISOString().split("T")[0],
      entries,
      totalRegularHours: existingTimesheet?.totalRegularHours || 0,
      totalOvertimeHours: existingTimesheet?.totalOvertimeHours || 0,
      jobseekerPay: existingTimesheet?.totalJobseekerPay || 0,
      clientBill: existingTimesheet?.totalClientBill || 0,
      bonusAmount: existingTimesheet?.bonusAmount || 0,
      deductionAmount: existingTimesheet?.deductionAmount || 0,
      existingTimesheetId: existingTimesheet?.id,
    };

    // Calculate totals for the timesheet
    const bonusAmount = existingTimesheet?.bonusAmount || 0;
    const deductionAmount = existingTimesheet?.deductionAmount || 0;
    calculateTimesheetTotals(entries, bonusAmount, deductionAmount);

    setTimesheets([timesheet]);
  };

  const updateTimesheetEntry = (date: string, hours: number) => {
    setTimesheets((prev) => {
      return prev.map((timesheet) => {
        // Update the specific entry with raw hours
        const updatedEntries = timesheet.entries.map((entry) => {
          if (entry.date !== date) return entry;

          return {
            ...entry,
            hours: hours, // Store raw hours entered
            overtimeHours: 0, // Will be calculated weekly
          };
        });

        // Recalculate totals for this assignment (this will handle weekly overtime)
        const totals = calculateTimesheetTotals(updatedEntries);

        // Get the assignment to check if overtime is enabled
        const assignment = positions.find((p) => p.id === selectedPosition?.id);
        const position = assignment as PositionWithOvertime;

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
          ...timesheet,
          entries: finalEntries,
          ...totals,
        };
      });
    });
  };

  const updateTimesheetBonus = (bonusAmount: number) => {
    setTimesheets((prev) => {
      return prev.map((timesheet) => {
        const updated = {
          ...timesheet,
          bonusAmount: bonusAmount || 0,
        };
        const totals = calculateTimesheetTotals(updated.entries, updated.bonusAmount, updated.deductionAmount);
        return {
          ...updated,
          ...totals,
        };
      });
    });
  };

  const updateTimesheetDeduction = (deductionAmount: number) => {
    setTimesheets((prev) => {
      return prev.map((timesheet) => {
        const updated = {
          ...timesheet,
          deductionAmount: deductionAmount || 0,
        };
        const totals = calculateTimesheetTotals(updated.entries, updated.bonusAmount, updated.deductionAmount);
        return {
          ...updated,
          ...totals,
        };
      });
    });
  };

  const calculateTimesheetTotals = (entries: TimesheetEntry[], bonusAmount = 0, deductionAmount = 0) => {
    const assignment = positions.find((p) => p.id === selectedPosition?.id);
    if (!assignment) {
      return {
        totalRegularHours: 0,
        totalOvertimeHours: 0,
        jobseekerPay: 0,
        clientBill: 0,
      };
    }

    const position = assignment as PositionWithOvertime;

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
        : 40;

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

  const getDayName = (dateString: string): string => {
    // Parse the date string properly to avoid timezone issues
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("en-CA", {
      weekday: "short",
    });
  };

  const updateEmailPreference = (sendEmail: boolean) => {
    if (!selectedPosition?.id) return;

    setEmailPreferences((prev) => ({
      ...prev,
      [selectedPosition.id]: sendEmail,
    }));
  };

  const generateTimesheetData = async (
    timesheetsToProcess: WeeklyTimesheet[] = timesheets
  ) => {
    if (
      !selectedJobseeker ||
      !selectedPosition ||
      !selectedWeekStart ||
      timesheetsToProcess.length === 0
    ) {
      console.warn(
        "Cannot generate timesheet data: Missing required information"
      );
      setGenerationError(
        "Cannot generate timesheet data: Missing required information"
      );
      return;
    }

    setIsGeneratingTimesheet(true);
    setGenerationMessage("");
    setGenerationError("");

    try {
      const weekEndDate = new Date(selectedWeekStart);
      weekEndDate.setDate(weekEndDate.getDate() + 6);

      const results: (TimesheetResponse | TimesheetResponse[])[] = [];

      // Process each timesheet - either update existing or create new
      for (const timesheet of timesheetsToProcess) {
        const shouldSendEmail = emailPreferences[timesheet.positionId] || false;

        const timesheetData: Partial<TimesheetData> = {
          jobseekerProfileId: selectedJobseeker.id,
          jobseekerUserId: selectedJobseeker.userId,
          positionId: selectedPosition.id,
          weekStartDate: selectedWeekStart,
          weekEndDate: weekEndDate.toISOString().split("T")[0],
          dailyHours: timesheet.entries.map((entry) => ({
            date: entry.date,
            hours: entry.hours,
          })),
          totalRegularHours: timesheet.totalRegularHours,
          totalOvertimeHours: timesheet.totalOvertimeHours,
          regularPayRate: parseFloat(selectedPosition.regularPayRate || "0"),
          overtimePayRate: selectedPosition.overtimePayRate
            ? parseFloat(selectedPosition.overtimePayRate)
            : parseFloat(selectedPosition.regularPayRate || "0"),
          regularBillRate: parseFloat(selectedPosition.billRate || "0"),
          overtimeBillRate: selectedPosition.overtimeBillRate
            ? parseFloat(selectedPosition.overtimeBillRate)
            : parseFloat(selectedPosition.billRate || "0"),
          totalJobseekerPay: timesheet.jobseekerPay,
          totalClientBill: timesheet.clientBill,
          bonusAmount: timesheet.bonusAmount || 0,
          deductionAmount: timesheet.deductionAmount || 0,
          overtimeEnabled: selectedPosition.overtimeEnabled || false,
          markup: selectedPosition.markup
            ? parseFloat(selectedPosition.markup)
            : undefined,
          emailSent: shouldSendEmail,
        };

        if (timesheet.existingTimesheetId) {
          // Update existing timesheet
          console.log(
            `Updating existing timesheet ${timesheet.existingTimesheetId} for position ${selectedPosition.id}`
          );
          const result = await updateTimesheet(
            timesheet.existingTimesheetId,
            timesheetData
          );
          results.push(result);
        } else {
          // Create new timesheet using the existing function structure
          const frontendData = {
            jobseeker_profile_id: selectedJobseeker.id,
            jobseeker_user_id: selectedJobseeker.userId,
            week_start_date: selectedWeekStart,
            week_end_date: weekEndDate.toISOString().split("T")[0],
            email_sent: shouldSendEmail,
            assignments: [
              {
                position_id: selectedPosition.id,
                daily_hours: timesheet.entries.map((entry) => ({
                  date: entry.date,
                  hours: entry.hours,
                })),
                total_regular_hours: timesheet.totalRegularHours,
                total_overtime_hours: timesheet.totalOvertimeHours,
                regular_pay_rate: parseFloat(
                  selectedPosition.regularPayRate || "0"
                ),
                overtime_pay_rate: selectedPosition.overtimePayRate
                  ? parseFloat(selectedPosition.overtimePayRate)
                  : parseFloat(selectedPosition.regularPayRate || "0"),
                regular_bill_rate: parseFloat(selectedPosition.billRate || "0"),
                overtime_bill_rate: selectedPosition.overtimeBillRate
                  ? parseFloat(selectedPosition.overtimeBillRate)
                  : parseFloat(selectedPosition.billRate || "0"),
                total_jobseeker_pay: timesheet.jobseekerPay,
                total_client_bill: timesheet.clientBill,
                bonus_amount: timesheet.bonusAmount || 0,
                deduction_amount: timesheet.deductionAmount || 0,
                overtime_enabled: selectedPosition.overtimeEnabled || false,
                markup: selectedPosition.markup
                  ? parseFloat(selectedPosition.markup)
                  : undefined,
              },
            ],
          };

          console.log(
            `Creating new timesheet for position ${selectedPosition.id}`
          );
          const newResults = await createTimesheetFromFrontendData(
            frontendData
          );
          results.push(...newResults);
        }
      }

      const updatedCount = timesheetsToProcess.filter(
        (t) => t.existingTimesheetId
      ).length;
      const createdCount = timesheetsToProcess.filter(
        (t) => !t.existingTimesheetId
      ).length;
      const emailCount = timesheetsToProcess.filter(
        (t) => emailPreferences[t.positionId]
      ).length;

      let message = "";
      if (updatedCount > 0 && createdCount > 0) {
        message = `Successfully updated ${updatedCount} and created ${createdCount} timesheet(s) for ${selectedJobseeker.name}`;
      } else if (updatedCount > 0) {
        message = `Successfully updated ${updatedCount} timesheet(s) for ${selectedJobseeker.name}`;
      } else {
        message = `Successfully created ${createdCount} timesheet(s) for ${selectedJobseeker.name}`;
      }

      if (emailCount > 0) {
        message += ` (${emailCount} sent via email)`;
      }

      setGenerationMessage(message);

      // Refresh existing timesheets to show updated data
      fetchExistingTimesheets(selectedJobseeker.userId, selectedWeekStart);

      // Optional: Reset the form or provide next steps
      console.log("Timesheet operation results:", results);
    } catch (error) {
      console.error("Error processing timesheets:", error);
      setGenerationError(
        error instanceof Error ? error.message : "Failed to process timesheets"
      );
    } finally {
      setIsGeneratingTimesheet(false);
    }
  };

  // Helper function to generate a single timesheet
  const generateSingleTimesheet = async (
    timesheetsToProcess: WeeklyTimesheet[]
  ) => {
    await generateTimesheetData(timesheetsToProcess);
  };

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

  // Helper to calculate base pay (regular + overtime, no bonus/deduction)
  const getBaseJobseekerPay = (timesheet: WeeklyTimesheet, position: PositionWithOvertime) => {
    const regularPay = timesheet.totalRegularHours * parseFloat(position.regularPayRate || "0");
    let overtimePayRate = parseFloat(position.regularPayRate || "0");
    if (position.overtimeEnabled && position.overtimePayRate) {
      overtimePayRate = parseFloat(position.overtimePayRate);
    }
    const overtimePay = timesheet.totalOvertimeHours * overtimePayRate;
    return regularPay + overtimePay;
  };

  console.log("Debug - Current state:", {
    selectedJobseeker,
    selectedWeekStart,
    timesheetsCount: timesheets.length,
    weekOptions: weekOptions.length,
  });

  return (
    <div className="timesheet-page-container">
      <AppHeader
        title="Timesheet Management"
        hideHamburgerMenu={false}
        statusMessage={generationMessage || generationError}
        statusType={
          generationError ? "error" : generationMessage ? "success" : undefined
        }
      />

      <div className="timesheet-content-container">
        {/* Combined Selection Bar */}
        <div className="timesheet-selection-bar">
          <div className="selection-section">
            <label className="selection-label">
              <User size={16} />
              Job Seeker
            </label>
            {jobseekerLoading ? (
              <div className="invoice-dropdown-skeleton">
                <div className="skeleton-dropdown-trigger">
                  <div className="skeleton-icon"></div>
                  <div className="skeleton-text skeleton-dropdown-text"></div>
                  <div className="skeleton-icon skeleton-chevron"></div>
                </div>
              </div>
            ) : (
              <CustomDropdown
                options={jobseekerOptions}
                selectedOption={selectedJobseekerOption}
                onSelect={handleJobseekerSelect}
                placeholder="Search and select job seeker..."
                loading={false}
                icon={<User size={16} />}
                emptyMessage="No job seekers found"
              />
            )}
          </div>

          {/* Client Selection */}
          <div className="selection-section">
            <label className="selection-label">
              <Building size={16} />
              Client
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
                placeholder={
                  selectedJobseeker
                    ? "Search and select client..."
                    : "Please select a job seeker first"
                }
                disabled={!selectedJobseeker}
                loading={false}
                icon={<Building size={16} />}
                emptyMessage={
                  selectedJobseeker
                    ? "No clients found"
                    : "Please select a job seeker first to view clients"
                }
              />
            )}
          </div>

          {/* Position Selection */}
          <div className="selection-section">
            <label className="selection-label">
              <FileText size={16} />
              Position
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
                selectedOption={selectedPositionOption}
                onSelect={handlePositionSelect}
                placeholder={
                  selectedClient
                    ? "Search and select position..."
                    : selectedJobseeker
                    ? "Please select a client first"
                    : "Please select a job seeker and client first"
                }
                disabled={!selectedClient}
                loading={false}
                icon={<FileText size={16} />}
                emptyMessage={
                  selectedClient
                    ? "No positions found"
                    : !selectedJobseeker
                    ? "Please select a job seeker and client first to view positions"
                    : "Please select a client first to view positions"
                }
              />
            )}
          </div>

          <div className="selection-section">
            <label className="selection-label">
              <Calendar size={16} />
              Week Period
            </label>
            <CustomDropdown
              options={weekDropdownOptions}
              selectedOption={selectedWeekOption}
              onSelect={handleWeekSelect}
              placeholder="Select week range..."
              loading={false}
              icon={<Calendar size={16} />}
              emptyMessage="No week options found"
              searchable={false}
            />
          </div>
        </div>

        {/* No Clients State */}
        {selectedJobseeker && !clientLoading && clients.length === 0 && (
          <div className="timesheet-card empty-state-card">
            <div className="timesheet-empty-state">
              <Building size={48} />
              <h3>No Clients Available</h3>
              <p>No clients found for timesheet creation.</p>
            </div>
          </div>
        )}

        {/* No Positions State */}
        {selectedClient && !positionLoading && positions.length === 0 && (
          <div className="timesheet-card empty-state-card">
            <div className="timesheet-empty-state">
              <FileText size={48} />
              <h3>No Positions Available</h3>
              <p>No positions found for this client.</p>
            </div>
          </div>
        )}

        {/* Timesheets Container */}
        {selectedJobseeker &&
          selectedClient &&
          selectedPosition &&
          selectedWeekStart &&
          !timesheetsLoading && (
            <div className="timesheet-forms-container">
              {/* Timesheet Forms */}
              <div className="timesheet-forms-grid">
                {timesheets.map((timesheet) => {
                  return (
                    <div
                      key={timesheet.positionId}
                      className="timesheet-assignment-card"
                    >
                      {/* Streamlined Unified Header */}
                      <div className="timesheet-unified-header">
                        <div className="timesheet-header-sections">
                          <div className="timesheet-section timesheet-client-section">
                            <h4 className="timesheet-section-title">
                              Client & Position
                            </h4>
                            <div className="timesheet-section-content">
                              <div className="timesheet-detail-item">
                                <span className="timesheet-detail-label">
                                  Client Name:
                                </span>
                                <span className="timesheet-detail-value">
                                  {selectedClient.companyName}
                                </span>
                              </div>
                              <div className="timesheet-detail-item">
                                <span className="timesheet-detail-label">
                                  Position Title:
                                </span>
                                <span className="timesheet-detail-value">
                                  {selectedPosition.title}
                                </span>
                              </div>
                              <div className="timesheet-detail-item">
                                <span className="timesheet-detail-label">
                                  Position Code:
                                </span>
                                <span className="timesheet-detail-value">
                                  {selectedPosition.positionCode}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="timesheet-section timesheet-employee-section">
                            <h4 className="timesheet-section-title">
                              Employee Details
                            </h4>
                            <div className="timesheet-section-content">
                              <div className="timesheet-detail-item">
                                <span className="timesheet-detail-label">
                                  Name:
                                </span>
                                <span className="timesheet-detail-value">
                                  {selectedJobseeker.name}
                                </span>
                              </div>
                              <div className="timesheet-detail-item">
                                <span className="timesheet-detail-label">
                                  Email:
                                </span>
                                <span className="timesheet-detail-value">
                                  {selectedJobseeker.email}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="timesheet-section timesheet-invoice-section">
                            <h4 className="timesheet-section-title">
                              Invoice & Period
                            </h4>
                            <div className="timesheet-section-content">
                              <div className="timesheet-detail-item">
                                <span className="timesheet-detail-label">
                                  Invoice Number:
                                </span>
                                <span className="timesheet-detail-value">
                                  #{timesheet.invoiceNumber || "TBD"}
                                </span>
                              </div>
                              <div className="timesheet-detail-item">
                                <span className="timesheet-detail-label">
                                  Period:
                                </span>
                                <span className="timesheet-detail-value">
                                  {formatDate(selectedWeekStart)} -{" "}
                                  {formatDate(
                                    new Date(
                                      new Date(selectedWeekStart).getTime() +
                                        6 * 24 * 60 * 60 * 1000
                                    )
                                      .toISOString()
                                      .split("T")[0]
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Hours and Pay Adjustments Container - Side by Side */}
                      <div className="timesheet-hours-adjustments-container">
                        {/* Daily Hours Input */}
                        <div className="timesheet-hours-section">
                          <h4 className="timesheet-hours-title">
                            <Clock size={16} />
                            Daily Hours
                          </h4>
                          <div className="timesheet-days-grid">
                            {timesheet.entries.map((entry) => (
                              <div
                                key={entry.date}
                                className="timesheet-day-entry"
                              >
                                <label className="timesheet-day-label">
                                  <div className="timesheet-day-name">
                                    {getDayName(entry.date)}
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
                                  value={entry.hours}
                                  onChange={(e) => {
                                    const hours =
                                      parseFloat(e.target.value) || 0;
                                    updateTimesheetEntry(entry.date, hours);
                                  }}
                                  placeholder="0.0"
                                  className="timesheet-hours-input"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Pay Adjustments Section */}
                        <div className="timesheet-hours-section adjustments-section">
                          <h4 className="timesheet-hours-title">
                            <DollarSign size={16} />
                            Pay Adjustments
                          </h4>

                          <div className="timesheet-days-grid">
                            <div className="timesheet-day-entry">
                              <label className="timesheet-day-label">
                                <div className="timesheet-day-name">Bonus</div>
                                <div className="timesheet-day-date">Amount</div>
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={timesheet.bonusAmount || ""}
                                onChange={(e) => {
                                  const amount =
                                    parseFloat(e.target.value) || 0;
                                  updateTimesheetBonus(amount);
                                }}
                                placeholder="0.00"
                                className="timesheet-hours-input"
                              />
                            </div>

                            <div className="timesheet-day-entry">
                              <label className="timesheet-day-label">
                                <div className="timesheet-day-name">
                                  Deduction
                                </div>
                                <div className="timesheet-day-date">Amount</div>
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={timesheet.deductionAmount || ""}
                                onChange={(e) => {
                                  const amount =
                                    parseFloat(e.target.value) || 0;
                                  updateTimesheetDeduction(amount);
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
                                Regular Pay Rate
                              </span>
                              <span className="timesheet-pay-value">
                                ${selectedPosition?.regularPayRate || "N/A"}/h
                              </span>
                            </div>
                            {selectedPosition?.overtimeEnabled && (
                              <div className="timesheet-pay-info-item">
                                <span className="timesheet-pay-label">
                                  Overtime Pay Rate
                                </span>
                                <span className="timesheet-pay-value">
                                  ${selectedPosition?.overtimePayRate || "N/A"}
                                  /h
                                </span>
                              </div>
                            )}
                            <div className="timesheet-pay-info-item">
                              <span className="timesheet-pay-label">
                                Overtime Threshold
                              </span>
                              <span className="timesheet-pay-value">
                                {(selectedPosition as PositionWithOvertime)
                                  ?.overtimeHours || "8"}{" "}
                                hours
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Invoice Style Summary */}
                      <div className="timesheet-invoice-container">
                        <div className="timesheet-invoice-table">
                          <div className="timesheet-invoice-table-header">
                            <div className="timesheet-col-description">
                              Description
                            </div>
                            <div className="timesheet-col-hours">Hours</div>
                            <div className="timesheet-col-rate">Rate</div>
                            <div className="timesheet-col-amount">Amount</div>
                          </div>

                          <div className="timesheet-invoice-table-body">
                            {/* Regular Hours Line Item */}
                            <div className="timesheet-invoice-line-item">
                              <div className="timesheet-col-description">
                                <div className="timesheet-item-title">
                                  Regular Hours
                                </div>
                                <div className="timesheet-item-subtitle">
                                  Standard work hours
                                </div>
                              </div>
                              <div className="timesheet-col-hours">
                                {timesheet.totalRegularHours.toFixed(1)}
                              </div>
                              <div className="timesheet-col-rate">
                                ${selectedPosition?.regularPayRate || "0.00"}
                              </div>
                              <div className="timesheet-col-amount">
                                $
                                {(
                                  timesheet.totalRegularHours *
                                  parseFloat(
                                    selectedPosition?.regularPayRate || "0"
                                  )
                                ).toFixed(2)}
                              </div>
                            </div>

                            {/* Overtime Hours Line Item (if applicable) */}
                            {timesheet.totalOvertimeHours > 0 && (
                              <div className="timesheet-invoice-line-item">
                                <div className="timesheet-col-description">
                                  <div className="timesheet-item-title">
                                    Overtime Hours
                                  </div>
                                  <div className="timesheet-item-subtitle">
                                    Hours exceeding{" "}
                                    {(selectedPosition as PositionWithOvertime)
                                      ?.overtimeHours || "8"}{" "}
                                    hours/week
                                  </div>
                                </div>
                                <div className="timesheet-col-hours">
                                  {timesheet.totalOvertimeHours.toFixed(1)}
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
                                    timesheet.totalOvertimeHours *
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
                            {timesheet.bonusAmount > 0 && (
                              <div className="timesheet-invoice-line-item">
                                <div className="timesheet-col-description">
                                  <div className="timesheet-item-title">
                                    Bonus
                                  </div>
                                </div>
                                <div className="timesheet-col-hours">-</div>
                                <div className="timesheet-col-rate">-</div>
                                <div className="timesheet-col-amount">
                                  ${timesheet.bonusAmount.toFixed(2)}
                                </div>
                              </div>
                            )}

                            {/* Deduction Line Item (if applicable) */}
                            {timesheet.deductionAmount > 0 && (
                              <div className="timesheet-invoice-line-item">
                                <div className="timesheet-col-description">
                                  <div className="timesheet-item-title">
                                    Deduction
                                  </div>
                                </div>
                                <div className="timesheet-col-hours">-</div>
                                <div className="timesheet-col-rate">-</div>
                                <div className="timesheet-col-amount">
                                  -${timesheet.deductionAmount.toFixed(2)}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="timesheet-invoice-totals">
                            <div className="timesheet-total-line">
                              <div className="timesheet-total-label">
                                Total Hours:
                              </div>
                              <div className="timesheet-total-value">
                                {(
                                  timesheet.totalRegularHours +
                                  timesheet.totalOvertimeHours
                                ).toFixed(1)}
                              </div>
                            </div>
                            {(() => {
                              const position = positions.find((p) => p.id === selectedPosition?.id) as PositionWithOvertime;
                              const basePay = getBaseJobseekerPay(timesheet, position);
                              const subtotal = basePay;
                              const employeePay = subtotal + (timesheet.bonusAmount || 0) - (timesheet.deductionAmount || 0);
                              return <>
                                <div className="timesheet-total-line timesheet-subtotal">
                                  <div className="timesheet-total-label">
                                    Subtotal:
                                  </div>
                                  <div className="timesheet-total-value">
                                    ${subtotal.toFixed(2)}
                                  </div>
                                </div>
                                {timesheet.bonusAmount > 0 && (
                                  <div className="timesheet-total-line">
                                    <div className="timesheet-total-label">
                                      Bonus:
                                    </div>
                                    <div className="timesheet-total-value">
                                      +${timesheet.bonusAmount.toFixed(2)}
                                    </div>
                                  </div>
                                )}
                                {timesheet.deductionAmount > 0 && (
                                  <div className="timesheet-total-line">
                                    <div className="timesheet-total-label">
                                      Deduction:
                                    </div>
                                    <div className="timesheet-total-value">
                                      -${timesheet.deductionAmount.toFixed(2)}
                                    </div>
                                  </div>
                                )}
                                <div className="timesheet-total-line timesheet-grand-total">
                                  <div className="timesheet-total-label">
                                    Employee Pay:
                                  </div>
                                  <div className="timesheet-total-value">
                                    ${employeePay.toFixed(2)}
                                  </div>
                                </div>
                              </>;
                            })()}
                          </div>
                        </div>
                        {/* Generate/Update Button for this timesheet */}
                        <div className="timesheet-action-section">
                          <div className="timesheet-email-option">
                            <label className="timesheet-checkbox-label">
                              <input
                                type="checkbox"
                                checked={
                                  emailPreferences[timesheet.positionId] ||
                                  false
                                }
                                onChange={(e) =>
                                  updateEmailPreference(e.target.checked)
                                }
                                className="timesheet-checkbox"
                              />
                              <span className="timesheet-checkbox-text">
                                Send timesheet via email to jobseeker
                              </span>
                            </label>
                          </div>

                          <button
                            className={`button ${
                              timesheet.totalRegularHours +
                                timesheet.totalOvertimeHours <
                              1
                                ? "disabled"
                                : ""
                            }`}
                            onClick={() => {
                              // Generate timesheet for just this assignment
                              const singleTimesheet = [timesheet];
                              generateSingleTimesheet(singleTimesheet);
                            }}
                            disabled={
                              timesheet.totalRegularHours +
                                timesheet.totalOvertimeHours <
                                1 || isGeneratingTimesheet
                            }
                            title={
                              timesheet.totalRegularHours +
                                timesheet.totalOvertimeHours <
                              1
                                ? "At least 1 hour must be entered to generate timesheet"
                                : ""
                            }
                          >
                            {isGeneratingTimesheet ? (
                              <>
                                <Loader2
                                  size={16}
                                  className="timesheet-loading-spinner"
                                />
                                {timesheet.existingTimesheetId
                                  ? "Updating..."
                                  : "Generating..."}
                              </>
                            ) : (
                              <>
                                {timesheet.existingTimesheetId ? (
                                  <>
                                    <RefreshCw size={16} />
                                    Update Timesheet
                                  </>
                                ) : (
                                  <>
                                    <Plus size={16} />
                                    Generate Timesheet
                                  </>
                                )}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* Skeleton Loading for Timesheet Forms */}
        {selectedJobseeker &&
          selectedClient &&
          selectedPosition &&
          selectedWeekStart &&
          timesheetsLoading && (
            <div className="invoice-skeleton-container">
              {/* Unified Header Skeleton */}
              <div className="timesheet-unified-header">
                <div className="timesheet-header-sections">
                  <div className="timesheet-section timesheet-client-section">
                    <div className="skeleton-text" style={{ width: "140px", height: "20px", marginBottom: "16px" }}></div>
                    <div className="timesheet-section-content">
                      {[1, 2, 3].map((index) => (
                        <div key={index} className="timesheet-detail-item">
                          <div className="skeleton-text" style={{ width: "80px", height: "14px" }}></div>
                          <div className="skeleton-text" style={{ width: "120px", height: "14px" }}></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="timesheet-section timesheet-employee-section">
                    <div className="skeleton-text" style={{ width: "120px", height: "20px", marginBottom: "16px" }}></div>
                    <div className="timesheet-section-content">
                      {[1, 2].map((index) => (
                        <div key={index} className="timesheet-detail-item">
                          <div className="skeleton-text" style={{ width: "60px", height: "14px" }}></div>
                          <div className="skeleton-text" style={{ width: "140px", height: "14px" }}></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="timesheet-section timesheet-invoice-section">
                    <div className="skeleton-text" style={{ width: "110px", height: "20px", marginBottom: "16px" }}></div>
                    <div className="timesheet-section-content">
                      {[1, 2, 3, 4].map((index) => (
                        <div key={index} className="timesheet-detail-item">
                          <div className="skeleton-text" style={{ width: "70px", height: "14px" }}></div>
                          <div className="skeleton-text" style={{ width: "100px", height: "14px" }}></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily Hours Input Grid Skeleton */}
              <div className="timesheet-grid-container timesheet-hours-adjustments-container">
                <div className="timesheet-week-grid">
                  <div className="timesheet-grid-header">
                    <div className="skeleton-text" style={{ width: "100px", height: "16px" }}></div>
                  </div>
                  <div className="timesheet-days-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) => (
                      <div key={index} className="timesheet-day-entry">
                        <div className="timesheet-day-label">
                          <div className="skeleton-text" style={{ width: "80px", height: "14px", marginBottom: "4px" }}></div>
                          <div className="skeleton-text" style={{ width: "50px", height: "12px" }}></div>
                        </div>
                        <div className="skeleton-text" style={{ width: "100%", height: "40px" }}></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pay Info Skeleton */}
                <div className="timesheet-pay-info-section">
                  <div className="timesheet-pay-info-grid">
                    {[1, 2, 3].map((index) => (
                      <div key={index} className="timesheet-pay-info-item">
                        <div className="skeleton-text" style={{ width: "90px", height: "14px", marginBottom: "4px" }}></div>
                        <div className="skeleton-text" style={{ width: "60px", height: "16px" }}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Invoice Table Skeleton */}
              <div className="timesheet-invoice-container">
                <div className="timesheet-invoice-table">
                  <div className="timesheet-invoice-table-header">
                    {[1, 2, 3, 4].map((index) => (
                      <div key={index} className="timesheet-col">
                        <div className="skeleton-text" style={{ width: "80px", height: "14px" }}></div>
                      </div>
                    ))}
                  </div>
                  <div className="timesheet-invoice-table-body">
                    {[1, 2].map((index) => (
                      <div key={index} className="timesheet-invoice-line-item">
                        {[1, 2, 3, 4].map((colIndex) => (
                          <div key={colIndex} className="timesheet-col">
                            <div className="skeleton-text" style={{ width: "90%", height: "16px", marginBottom: "4px" }}></div>
                            <div className="skeleton-text" style={{ width: "70%", height: "12px" }}></div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="timesheet-invoice-totals">
                    {[1, 2, 3, 4].map((index) => (
                      <div key={index} className="timesheet-total-line">
                        <div className="skeleton-text" style={{ width: "100px", height: "14px" }}></div>
                        <div className="skeleton-text" style={{ width: "80px", height: "14px" }}></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Section Skeleton */}
                <div className="timesheet-action-section">
                  <div className="timesheet-email-option">
                    <div className="skeleton-text" style={{ width: "200px", height: "16px" }}></div>
                  </div>
                  <div className="skeleton-text" style={{ width: "150px", height: "40px" }}></div>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
