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
  createTimesheet,
  getJobseekerTimesheets,
  TimesheetData,
  TimesheetResponse,
  updateTimesheet,
  generateInvoiceNumber,
} from "../../services/api/timesheet";
import {
  buildTimesheetRowsForPayroll,
  profileUsesCashDeductionField,
  isHybridPaymentMethod,
  hybridSecondLinePaymentMethod,
  SIN_DIRECT_DEPOSIT,
  type ComputedTimesheetRow,
} from "../../lib/hybridPayrollSplit";
import "../../styles/pages/TimesheetManagement.css";
import { generateWeekOptions, formatDate } from "../../utils/weekUtils";
import { getPositionDisplayTitle } from "../../utils/positionDisplay";

// Types for timesheet
interface TimesheetEntry {
  date: string;
  hours: number;
  overtimeHours: number;
}

type PaySplitSegmentKey = "single" | "sin" | "cash" | "e_transfer";

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
  notes: string;
  existingTimesheetId?: string;
  /** When multiple DB rows exist for this week (hybrid pay), map segment → timesheet id */
  splitExistingIds?: Partial<Record<PaySplitSegmentKey, string>>;
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
  premiumPayRate?: string;
  billRate: string;
  numberOfPositions: number;
  overtimeEnabled?: boolean;
  overtimeHours?: string; // This is the overtime threshold
  overtimePayRate?: string;
  overtimeBillRate?: string;
  markup?: string;
  isSubcategory?: boolean;
  subcategoryPortion?: string[] | null;
}

// Interface for client positions
interface ClientPosition {
  id: string;
  positionCode: string;
  title: string;
  regularPayRate: string;
  premiumPayRate?: string;
  billRate: string;
  overtimeEnabled?: boolean;
  overtimeHours?: string;
  overtimePayRate?: string;
  overtimeBillRate?: string;
  markup?: string;
  positionNumber?: string;
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
  notes?: string;
  paySplitSegment?: string;
  linePaymentMethod?: string | null;
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
          premiumPayRate: pos.premiumPayRate,
          billRate: pos.billRate!,
          overtimeEnabled: pos.overtimeEnabled,
          overtimeHours: pos.overtimeHours,
          overtimePayRate: pos.overtimePayRate,
          overtimeBillRate: pos.overtimeBillRate,
          markup: pos.markup,
          positionNumber: pos.positionNumber,
          isSubcategory: pos.isSubcategory,
          subcategoryPortion: pos.subcategoryPortion,
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
        dateRangeStart: weekStartDate,
        dateRangeEnd: weekEndDate.toISOString().split("T")[0],
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
        notes: timesheet.notes,
        paySplitSegment: timesheet.paySplitSegment,
        linePaymentMethod: timesheet.linePaymentMethod,
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
    const phoneNumber = (
      jobseeker as JobSeekerProfile & { phoneNumber?: string }
    ).phoneNumber;
    const employeeId = (jobseeker as JobSeekerProfile & { employeeId?: string })
      .employeeId;
    return {
      id: jobseeker.id,
      label: jobseeker.name || jobseeker.email || "Unknown",
      sublabel: [jobseeker.email, phoneNumber, employeeId]
        .filter(Boolean)
        .join(" - "),
      value: jobseeker,
      isInactive: jobseeker.isInactive,
    };
  });

  const clientOptions: DropdownOption[] = clients.map((client) => ({
    id: client.id!,
    label: client.companyName || "Unknown Client",
    sublabel: client.shortCode || "",
    value: client,
    isInactive: client.isInactive,
  }));

  const positionOptions: DropdownOption[] = positions.map((position) => ({
    id: position.id,
    label: getPositionDisplayTitle(position),
    sublabel: `${position.positionCode} - ${position.positionNumber}`,
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
  }, [existingTimesheets]);

  const initializeTimesheetsForPosition = async () => {
    if (!selectedJobseeker || !selectedPosition || !selectedWeekStart) {
      setTimesheets([]);
      return;
    }

    const weekEndDate = new Date(selectedWeekStart);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    const weekDates = generateWeekDates(selectedWeekStart);

    const matching = existingTimesheets.filter(
      (timesheet: ExistingTimesheetData) =>
        timesheet.weekStartDate === selectedWeekStart &&
        timesheet.positionId === selectedPosition.id
    );

    const splitExistingIds: Partial<Record<PaySplitSegmentKey, string>> = {};
    for (const m of matching) {
      const seg = (m.paySplitSegment || "single") as PaySplitSegmentKey;
      if (m.id) splitExistingIds[seg] = m.id;
    }

    const byDate: Record<string, number> = {};
    for (const t of matching) {
      for (const d of t.dailyHours || []) {
        byDate[d.date] = (byDate[d.date] || 0) + d.hours;
      }
    }

    let entries: TimesheetEntry[];
    if (matching.length > 0) {
      entries = weekDates.map((date) => ({
        date,
        hours: byDate[date] || 0,
        overtimeHours: 0,
      }));
    } else {
      entries = weekDates.map((date) => ({
        date,
        hours: 0,
        overtimeHours: 0,
      }));
    }

    const primary =
      matching.find((m) => m.paySplitSegment === "sin") ||
      matching.find((m) => m.paySplitSegment === "single") ||
      matching[0];

    let invoiceNumber = primary?.invoiceNumber || "";
    if (matching.length === 0) {
      try {
        invoiceNumber = await generateInvoiceNumber();
      } catch (error) {
        console.error("Error generating invoice number:", error);
        invoiceNumber = "TBD";
      }
    }

    const bonusAmount = primary?.bonusAmount || 0;
    const deductionAmount = primary?.deductionAmount || 0;
    const totals = calculateTimesheetTotals(
      entries,
      bonusAmount,
      deductionAmount
    );

    const timesheet: WeeklyTimesheet = {
      positionId: selectedPosition.id,
      invoiceNumber: invoiceNumber,
      weekStartDate: selectedWeekStart,
      weekEndDate: weekEndDate.toISOString().split("T")[0],
      entries,
      ...totals,
      bonusAmount,
      deductionAmount,
      notes: primary?.notes || "",
      existingTimesheetId: matching.length === 1 ? primary?.id : undefined,
      splitExistingIds:
        matching.length > 1 ? splitExistingIds : undefined,
    };

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
        const totals = calculateTimesheetTotals(
          updated.entries,
          updated.bonusAmount,
          updated.deductionAmount
        );
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
        const totals = calculateTimesheetTotals(
          updated.entries,
          updated.bonusAmount,
          updated.deductionAmount
        );
        return {
          ...updated,
          ...totals,
        };
      });
    });
  };

  const updateTimesheetNotes = (notes: string) => {
    setTimesheets((prev) => {
      return prev.map((timesheet) => ({
        ...timesheet,
        notes: notes || "",
      }));
    });
  };

  const calculateTimesheetTotals = (
    entries: TimesheetEntry[],
    bonusAmount = 0,
    deductionAmount = 0
  ) => {
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
    const regularPayRate = parseFloat(position.regularPayRate || "0");
    const premiumPayRate = parseFloat(position.premiumPayRate || "0");
    const effectivePayRate = regularPayRate + premiumPayRate;
    const regularBillRate = parseFloat(position.billRate || "0");
    let overtimePayRate = effectivePayRate;
    let overtimeBillRate = regularBillRate;
    if (
      position.overtimeEnabled &&
      position.overtimePayRate &&
      position.overtimeBillRate
    ) {
      overtimePayRate = parseFloat(position.overtimePayRate);
      overtimeBillRate = parseFloat(position.overtimeBillRate);
    }

    const daily = entries.map((e) => ({ date: e.date, hours: e.hours }));
    const cap = parseFloat(
      String(selectedJobseeker?.sinPayrollHoursCap ?? "0")
    );
    const rows = buildTimesheetRowsForPayroll({
      entries: daily,
      overtimeEnabled: !!position.overtimeEnabled,
      overtimeHoursRaw: position.overtimeHours,
      effectiveRegularPayRate: effectivePayRate,
      overtimePayRate,
      regularBillRate,
      overtimeBillRate,
      paymentMethod: selectedJobseeker?.paymentMethod || "",
      sinPayrollHoursCap: Number.isFinite(cap) ? cap : 0,
      cashDeductionPct: parseFloat(selectedJobseeker?.cashDeduction || "0"),
      bonusAmount,
      deductionAmount,
    });

    if (rows.length === 0) {
      return {
        totalRegularHours: 0,
        totalOvertimeHours: 0,
        jobseekerPay: 0,
        clientBill: 0,
      };
    }

    return {
      totalRegularHours: rows.reduce((s, r) => s + r.totalRegularHours, 0),
      totalOvertimeHours: rows.reduce((s, r) => s + r.totalOvertimeHours, 0),
      jobseekerPay: rows.reduce((s, r) => s + r.totalJobseekerPay, 0),
      clientBill: rows.reduce((s, r) => s + r.totalClientBill, 0),
    };
  };

  /** Invoice preview rows (one or two lines for hybrid SIN + cash / e-Transfer). */
  const getPayrollPreviewRows = (
    timesheet: WeeklyTimesheet
  ): ComputedTimesheetRow[] => {
    const assignment = positions.find((p) => p.id === selectedPosition?.id);
    if (!assignment || !selectedJobseeker) return [];
    const position = assignment as PositionWithOvertime;
    const regularPayRate = parseFloat(position.regularPayRate || "0");
    const premiumPayRate = parseFloat(position.premiumPayRate || "0");
    const effectivePayRate = regularPayRate + premiumPayRate;
    const regularBillRate = parseFloat(position.billRate || "0");
    let overtimePayRate = effectivePayRate;
    let overtimeBillRate = regularBillRate;
    if (
      position.overtimeEnabled &&
      position.overtimePayRate &&
      position.overtimeBillRate
    ) {
      overtimePayRate = parseFloat(position.overtimePayRate);
      overtimeBillRate = parseFloat(position.overtimeBillRate);
    }
    const daily = timesheet.entries.map((e) => ({ date: e.date, hours: e.hours }));
    const cap = parseFloat(
      String(selectedJobseeker?.sinPayrollHoursCap ?? "0")
    );
    return buildTimesheetRowsForPayroll({
      entries: daily,
      overtimeEnabled: !!position.overtimeEnabled,
      overtimeHoursRaw: position.overtimeHours,
      effectiveRegularPayRate: effectivePayRate,
      overtimePayRate,
      regularBillRate,
      overtimeBillRate,
      paymentMethod: selectedJobseeker?.paymentMethod || "",
      sinPayrollHoursCap: Number.isFinite(cap) ? cap : 0,
      cashDeductionPct: parseFloat(selectedJobseeker?.cashDeduction || "0"),
      bonusAmount: timesheet.bonusAmount || 0,
      deductionAmount: timesheet.deductionAmount || 0,
    });
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

      const results: TimesheetResponse[] = [];
      let updatedCount = 0;
      let createdCount = 0;

      const regularPayRate = parseFloat(selectedPosition.regularPayRate || "0");
      const premiumPayRate = parseFloat(selectedPosition.premiumPayRate || "0");
      const effectivePayRate = regularPayRate + premiumPayRate;
      const regularBillRate = parseFloat(selectedPosition.billRate || "0");
      let overtimePayRate = effectivePayRate;
      let overtimeBillRate = regularBillRate;
      if (
        selectedPosition.overtimeEnabled &&
        selectedPosition.overtimePayRate &&
        selectedPosition.overtimeBillRate
      ) {
        overtimePayRate = parseFloat(selectedPosition.overtimePayRate);
        overtimeBillRate = parseFloat(selectedPosition.overtimeBillRate);
      }

      const sinCap = parseFloat(
        String(selectedJobseeker.sinPayrollHoursCap ?? "0")
      );

      for (const timesheet of timesheetsToProcess) {
        const shouldSendEmail = emailPreferences[timesheet.positionId] || false;

        const dailyHours = timesheet.entries.map((entry) => ({
          date: entry.date,
          hours: entry.hours,
        }));

        const payrollRows = buildTimesheetRowsForPayroll({
          entries: dailyHours,
          overtimeEnabled: !!selectedPosition.overtimeEnabled,
          overtimeHoursRaw: selectedPosition.overtimeHours,
          effectiveRegularPayRate: effectivePayRate,
          overtimePayRate,
          regularBillRate,
          overtimeBillRate,
          paymentMethod: selectedJobseeker.paymentMethod || "",
          sinPayrollHoursCap: Number.isFinite(sinCap) ? sinCap : 0,
          cashDeductionPct: parseFloat(selectedJobseeker.cashDeduction || "0"),
          bonusAmount: timesheet.bonusAmount || 0,
          deductionAmount: timesheet.deductionAmount || 0,
        });

        for (const row of payrollRows) {
          const seg = row.paySplitSegment as PaySplitSegmentKey;
          const existingId =
            timesheet.splitExistingIds?.[seg] ??
            (seg === "single" ? timesheet.existingTimesheetId : undefined);

          const partial: Partial<TimesheetData> = {
            jobseekerProfileId: selectedJobseeker.id,
            jobseekerUserId: selectedJobseeker.userId,
            positionId: selectedPosition.id,
            weekStartDate: selectedWeekStart,
            weekEndDate: weekEndDate.toISOString().split("T")[0],
            dailyHours: row.dailyHours,
            totalRegularHours: row.totalRegularHours,
            totalOvertimeHours: row.totalOvertimeHours,
            regularPayRate,
            premiumPayRate,
            overtimePayRate,
            regularBillRate,
            overtimeBillRate,
            totalJobseekerPay: row.totalJobseekerPay,
            totalClientBill: row.totalClientBill,
            bonusAmount: row.bonusAmount,
            deductionAmount: row.deductionAmount,
            notes: timesheet.notes || "",
            overtimeEnabled: selectedPosition.overtimeEnabled || false,
            markup: selectedPosition.markup
              ? parseFloat(selectedPosition.markup)
              : undefined,
            emailSent: shouldSendEmail,
            paySplitSegment: row.paySplitSegment,
            linePaymentMethod: row.linePaymentMethod,
          };

          if (existingId) {
            const result = await updateTimesheet(existingId, partial);
            results.push(result);
            updatedCount += 1;
          } else {
            const inv = await generateInvoiceNumber();
            const result = await createTimesheet({
              ...(partial as Omit<
                TimesheetData,
                | "id"
                | "createdAt"
                | "updatedAt"
                | "createdByUserId"
                | "updatedByUserId"
              >),
              invoiceNumber: inv,
            });
            results.push(result);
            createdCount += 1;
          }
        }
      }
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

      // navigate("/bulk-timesheet-management/list");
      window.location.reload();

      // Refresh existing timesheets to show updated data
      // fetchExistingTimesheets(selectedJobseeker.userId, selectedWeekStart);

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
  const getBaseJobseekerPay = (
    timesheet: WeeklyTimesheet,
    position: PositionWithOvertime
  ) => {
    const effectivePayRate =
      parseFloat(position.regularPayRate || "0") +
      parseFloat(position.premiumPayRate || "0");
    const regularPay = timesheet.totalRegularHours * effectivePayRate;
    let overtimePayRate = effectivePayRate;
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
        title="Create Single Timesheet"
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
                              <div className="timesheet-detail-item">
                                <span className="timesheet-detail-label">
                                  Position Number:
                                </span>
                                <span className="timesheet-detail-value">
                                  {selectedPosition.positionNumber}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="timesheet-section timesheet-employee-section">
                            <h4 className="timesheet-section-title">
                              Employee Details
                            </h4>
                            <div className="timesheet-section-content timesheet-employee-details-columns">
                              <div className="timesheet-employee-details-col">
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
                                <div className="timesheet-detail-item">
                                  <span className="timesheet-detail-label">
                                    Billing Email:
                                  </span>
                                  <span className="timesheet-detail-value">
                                    {(
                                      selectedJobseeker as JobSeekerProfile & {
                                        billingEmail?: string;
                                      }
                                    ).billingEmail || "N/A"}
                                  </span>
                                </div>
                                <div className="timesheet-detail-item">
                                  <span className="timesheet-detail-label">
                                    Phone Number:
                                  </span>
                                  <span className="timesheet-detail-value">
                                    {(
                                      selectedJobseeker as JobSeekerProfile & {
                                        phoneNumber?: string;
                                      }
                                    ).phoneNumber || "N/A"}
                                  </span>
                                </div>
                                <div className="timesheet-detail-item">
                                  <span className="timesheet-detail-label">
                                    Employee ID:
                                  </span>
                                  <span className="timesheet-detail-value">
                                    {(
                                      selectedJobseeker as JobSeekerProfile & {
                                        employeeId?: string;
                                      }
                                    ).employeeId || "N/A"}
                                  </span>
                                </div>
                              </div>
                              <div className="timesheet-employee-details-col">
                                {(() => {
                                  const pm =
                                    selectedJobseeker.paymentMethod?.trim() ||
                                    "";
                                  const secondLine =
                                    pm && isHybridPaymentMethod(pm)
                                      ? hybridSecondLinePaymentMethod(pm)
                                      : null;
                                  const cashDeductionPct = parseFloat(
                                    selectedJobseeker.cashDeduction || "0"
                                  );
                                  const sinCapRaw =
                                    selectedJobseeker.sinPayrollHoursCap;
                                  const sinCapNum = parseFloat(
                                    String(sinCapRaw ?? "")
                                  );
                                  const sinCapDisplay =
                                    sinCapRaw !== undefined &&
                                    sinCapRaw !== null &&
                                    sinCapRaw !== "" &&
                                    Number.isFinite(sinCapNum)
                                      ? `${sinCapNum} h / week`
                                      : "—";

                                  return (
                                    <>
                                      <div className="timesheet-detail-item">
                                        <span className="timesheet-detail-label">
                                          Payment method:
                                        </span>
                                        <span className="timesheet-detail-value">
                                          {pm || "—"}
                                        </span>
                                      </div>
                                      {secondLine && (
                                        <div className="timesheet-detail-item">
                                          <span className="timesheet-detail-label">
                                            Paid as:
                                          </span>
                                          <span className="timesheet-detail-value">
                                            {SIN_DIRECT_DEPOSIT} + {secondLine}
                                          </span>
                                        </div>
                                      )}
                                      {profileUsesCashDeductionField(pm) && (
                                        <div className="timesheet-detail-item">
                                          <span className="timesheet-detail-label">
                                            Cash deduction:
                                          </span>
                                          <span className="timesheet-detail-value">
                                            {Number.isFinite(cashDeductionPct)
                                              ? `${cashDeductionPct}%`
                                              : "—"}
                                          </span>
                                        </div>
                                      )}
                                      {isHybridPaymentMethod(pm) && (
                                        <div className="timesheet-detail-item">
                                          <span className="timesheet-detail-label">
                                            SIN hours (weekly cap):
                                          </span>
                                          <span className="timesheet-detail-value">
                                            {sinCapDisplay}
                                          </span>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
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
                                  value={entry.hours === 0 ? "" : entry.hours}
                                  onChange={(e) => {
                                    const rawValue = e.target.value;
                                    // Allow clearing the input
                                    if (rawValue === "") {
                                      updateTimesheetEntry(entry.date, 0);
                                      return;
                                    }
                                    // Limit to 2 decimal places
                                    const [intPart, decPart] = rawValue.split(".");
                                    let limitedValue = rawValue;
                                    if (decPart && decPart.length > 2) {
                                      limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                                    }
                                    const hours = parseFloat(limitedValue) || 0;
                                    updateTimesheetEntry(entry.date, hours);
                                  }}
                                  placeholder="0.00"
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
                                value={
                                  timesheet.bonusAmount === 0
                                    ? ""
                                    : timesheet.bonusAmount
                                }
                                onChange={(e) => {
                                  const rawValue = e.target.value;
                                  // Allow clearing the input
                                  if (rawValue === "") {
                                    updateTimesheetBonus(0);
                                    return;
                                  }
                                  // Limit to 2 decimal places
                                  const [intPart, decPart] = rawValue.split(".");
                                  let limitedValue = rawValue;
                                  if (decPart && decPart.length > 2) {
                                    limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                                  }
                                  const amount = parseFloat(limitedValue) || 0;
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
                                value={
                                  timesheet.deductionAmount === 0
                                    ? ""
                                    : timesheet.deductionAmount
                                }
                                onChange={(e) => {
                                  const rawValue = e.target.value;
                                  // Allow clearing the input
                                  if (rawValue === "") {
                                    updateTimesheetDeduction(0);
                                    return;
                                  }
                                  // Limit to 2 decimal places
                                  const [intPart, decPart] = rawValue.split(".");
                                  let limitedValue = rawValue;
                                  if (decPart && decPart.length > 2) {
                                    limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                                  }
                                  const amount = parseFloat(limitedValue) || 0;
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
                            {parseFloat(selectedPosition?.premiumPayRate || "0") > 0 && (
                              <div className="timesheet-pay-info-item">
                                <span className="timesheet-pay-label">
                                  Premium Pay Rate
                                </span>
                                <span className="timesheet-pay-value">
                                  ${selectedPosition?.premiumPayRate}/h
                                </span>
                              </div>
                            )}
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

                      {/* Notes Section */}
                      <div className="timesheet-notes-section">
                        <h4 className="timesheet-notes-title">
                          Additional Notes
                        </h4>
                        <textarea
                          value={timesheet.notes}
                          onChange={(e) => updateTimesheetNotes(e.target.value)}
                          placeholder="Add any additional notes or comments about this timesheet..."
                          className="timesheet-notes-textarea"
                          rows={4}
                        />
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
                            {(() => {
                              const previewRows = getPayrollPreviewRows(timesheet);
                              const positionOt =
                                positions.find(
                                  (p) => p.id === selectedPosition?.id
                                ) as PositionWithOvertime | undefined;
                              const regularPayRate = parseFloat(
                                selectedPosition?.regularPayRate || "0"
                              );
                              const premiumPayRate = parseFloat(
                                selectedPosition?.premiumPayRate || "0"
                              );
                              const effectivePayRate =
                                regularPayRate + premiumPayRate;
                              let overtimePayRate = effectivePayRate;
                              if (
                                positionOt?.overtimeEnabled &&
                                positionOt.overtimePayRate
                              ) {
                                overtimePayRate = parseFloat(
                                  positionOt.overtimePayRate
                                );
                              }
                              const hybridPreview =
                                isHybridPaymentMethod(
                                  selectedJobseeker?.paymentMethod
                                ) && previewRows.length > 0;

                              if (hybridPreview) {
                                return (
                                  <>
                                    {previewRows.map((row) => {
                                      const regH = row.totalRegularHours;
                                      const otH = row.totalOvertimeHours;
                                      const segmentBase =
                                        regH * effectivePayRate +
                                        otH * overtimePayRate;
                                      const rateLabel =
                                        otH > 0 && regH > 0
                                          ? "—"
                                          : otH > 0
                                            ? `$${overtimePayRate.toFixed(2)}`
                                            : `$${effectivePayRate.toFixed(2)}`;
                                      const payLineLabel =
                                        row.linePaymentMethod || "Payroll";
                                      const title =
                                        row.paySplitSegment === "sin"
                                          ? "Regular hours"
                                          : regH > 0 && otH > 0
                                            ? "Regular & overtime"
                                            : otH > 0
                                              ? "Overtime hours"
                                              : "Regular hours";
                                      return (
                                        <div
                                          key={`${row.paySplitSegment}-${payLineLabel}`}
                                          className="timesheet-invoice-line-item"
                                        >
                                          <div className="timesheet-col-description">
                                            <div className="timesheet-item-title">
                                              {title}
                                            </div>
                                            <div className="timesheet-item-subtitle">
                                              {payLineLabel}
                                              {row.paySplitSegment ===
                                                "sin" &&
                                                premiumPayRate > 0 &&
                                                ` (incl. premium $${selectedPosition?.premiumPayRate}/h)`}
                                              {otH > 0 &&
                                                regH > 0 &&
                                                ` — ${regH.toFixed(2)}h reg, ${otH.toFixed(2)}h OT`}
                                            </div>
                                          </div>
                                          <div className="timesheet-col-hours">
                                            {(regH + otH).toFixed(2)}
                                          </div>
                                          <div className="timesheet-col-rate">
                                            {rateLabel}
                                          </div>
                                          <div className="timesheet-col-amount">
                                            ${segmentBase.toFixed(2)}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </>
                                );
                              }

                              return (
                                <>
                                  {/* Regular Hours Line Item */}
                                  <div className="timesheet-invoice-line-item">
                                    <div className="timesheet-col-description">
                                      <div className="timesheet-item-title">
                                        Regular Hours
                                      </div>
                                      <div className="timesheet-item-subtitle">
                                        Standard work hours
                                        {premiumPayRate > 0
                                          ? ` (incl. premium $${selectedPosition?.premiumPayRate}/h)`
                                          : ""}
                                      </div>
                                    </div>
                                    <div className="timesheet-col-hours">
                                      {timesheet.totalRegularHours.toFixed(2)}
                                    </div>
                                    <div className="timesheet-col-rate">
                                      ${effectivePayRate.toFixed(2)}
                                    </div>
                                    <div className="timesheet-col-amount">
                                      $
                                      {(
                                        timesheet.totalRegularHours *
                                        effectivePayRate
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
                                        {timesheet.totalOvertimeHours.toFixed(2)}
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
                                </>
                              );
                            })()}

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
                              const position = positions.find(
                                (p) => p.id === selectedPosition?.id
                              ) as PositionWithOvertime;
                              const basePay = getBaseJobseekerPay(
                                timesheet,
                                position
                              );
                              const subtotal = basePay;
                              const paymentMethod = selectedJobseeker?.paymentMethod;
                              const cashDeductionPct = parseFloat(
                                selectedJobseeker?.cashDeduction || "0"
                              );
                              const employeePay = timesheet.jobseekerPay;
                              const cashDeductionDisplay =
                                profileUsesCashDeductionField(paymentMethod) &&
                                cashDeductionPct > 0
                                  ? Math.max(
                                      0,
                                      subtotal +
                                        (timesheet.bonusAmount || 0) -
                                        (timesheet.deductionAmount || 0) -
                                        employeePay
                                    )
                                  : 0;
                              return (
                                <>
                                  <div className="timesheet-total-line timesheet-subtotal">
                                    <div className="timesheet-total-label">
                                      Subtotal:
                                    </div>
                                    <div className="timesheet-total-value">
                                      ${subtotal.toFixed(2)}
                                    </div>
                                  </div>
                                  {cashDeductionDisplay > 0 && (
                                    <div className="timesheet-total-line">
                                      <div className="timesheet-total-label">
                                        Cash Deduction ({cashDeductionPct}%):
                                      </div>
                                      <div className="timesheet-total-value">
                                        -${cashDeductionDisplay.toFixed(2)}
                                      </div>
                                    </div>
                                  )}
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
                                </>
                              );
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
                            <p
                              className="field-note"
                              style={{ marginTop: "8px", marginLeft: "24px" }}
                            >
                              Email will be sent to billing email if provided,
                              otherwise to primary email
                            </p>
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
                                {timesheet.existingTimesheetId ||
                                (timesheet.splitExistingIds &&
                                  Object.keys(timesheet.splitExistingIds)
                                    .length > 0)
                                  ? "Updating..."
                                  : "Generating..."}
                              </>
                            ) : (
                              <>
                                {timesheet.existingTimesheetId ||
                                (timesheet.splitExistingIds &&
                                  Object.keys(timesheet.splitExistingIds)
                                    .length > 0) ? (
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
                    <div
                      className="skeleton-text"
                      style={{
                        width: "140px",
                        height: "20px",
                        marginBottom: "16px",
                      }}
                    ></div>
                    <div className="timesheet-section-content">
                      {[1, 2, 3].map((index) => (
                        <div key={index} className="timesheet-detail-item">
                          <div
                            className="skeleton-text"
                            style={{ width: "80px", height: "14px" }}
                          ></div>
                          <div
                            className="skeleton-text"
                            style={{ width: "120px", height: "14px" }}
                          ></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="timesheet-section timesheet-employee-section">
                    <div
                      className="skeleton-text"
                      style={{
                        width: "120px",
                        height: "20px",
                        marginBottom: "16px",
                      }}
                    ></div>
                    <div className="timesheet-section-content timesheet-employee-details-columns">
                      <div className="timesheet-employee-details-col">
                        {[1, 2, 3, 4, 5].map((index) => (
                          <div key={index} className="timesheet-detail-item">
                            <div
                              className="skeleton-text"
                              style={{ width: "60px", height: "14px" }}
                            ></div>
                            <div
                              className="skeleton-text"
                              style={{ width: "140px", height: "14px" }}
                            ></div>
                          </div>
                        ))}
                      </div>
                      <div className="timesheet-employee-details-col">
                        {[1, 2, 3, 4].map((index) => (
                          <div key={index + 10} className="timesheet-detail-item">
                            <div
                              className="skeleton-text"
                              style={{ width: "60px", height: "14px" }}
                            ></div>
                            <div
                              className="skeleton-text"
                              style={{ width: "140px", height: "14px" }}
                            ></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="timesheet-section timesheet-invoice-section">
                    <div
                      className="skeleton-text"
                      style={{
                        width: "110px",
                        height: "20px",
                        marginBottom: "16px",
                      }}
                    ></div>
                    <div className="timesheet-section-content">
                      {[1, 2, 3, 4].map((index) => (
                        <div key={index} className="timesheet-detail-item">
                          <div
                            className="skeleton-text"
                            style={{ width: "70px", height: "14px" }}
                          ></div>
                          <div
                            className="skeleton-text"
                            style={{ width: "100px", height: "14px" }}
                          ></div>
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
                    <div
                      className="skeleton-text"
                      style={{ width: "100px", height: "16px" }}
                    ></div>
                  </div>
                  <div className="timesheet-days-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((index) => (
                      <div key={index} className="timesheet-day-entry">
                        <div className="timesheet-day-label">
                          <div
                            className="skeleton-text"
                            style={{
                              width: "80px",
                              height: "14px",
                              marginBottom: "4px",
                            }}
                          ></div>
                          <div
                            className="skeleton-text"
                            style={{ width: "50px", height: "12px" }}
                          ></div>
                        </div>
                        <div
                          className="skeleton-text"
                          style={{ width: "100%", height: "40px" }}
                        ></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pay Info Skeleton */}
                <div className="timesheet-pay-info-section">
                  <div className="timesheet-pay-info-grid">
                    {[1, 2, 3].map((index) => (
                      <div key={index} className="timesheet-pay-info-item">
                        <div
                          className="skeleton-text"
                          style={{
                            width: "90px",
                            height: "14px",
                            marginBottom: "4px",
                          }}
                        ></div>
                        <div
                          className="skeleton-text"
                          style={{ width: "60px", height: "16px" }}
                        ></div>
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
                        <div
                          className="skeleton-text"
                          style={{ width: "80px", height: "14px" }}
                        ></div>
                      </div>
                    ))}
                  </div>
                  <div className="timesheet-invoice-table-body">
                    {[1, 2].map((index) => (
                      <div key={index} className="timesheet-invoice-line-item">
                        {[1, 2, 3, 4].map((colIndex) => (
                          <div key={colIndex} className="timesheet-col">
                            <div
                              className="skeleton-text"
                              style={{
                                width: "90%",
                                height: "16px",
                                marginBottom: "4px",
                              }}
                            ></div>
                            <div
                              className="skeleton-text"
                              style={{ width: "70%", height: "12px" }}
                            ></div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="timesheet-invoice-totals">
                    {[1, 2, 3, 4].map((index) => (
                      <div key={index} className="timesheet-total-line">
                        <div
                          className="skeleton-text"
                          style={{ width: "100px", height: "14px" }}
                        ></div>
                        <div
                          className="skeleton-text"
                          style={{ width: "80px", height: "14px" }}
                        ></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Section Skeleton */}
                <div className="timesheet-action-section">
                  <div className="timesheet-email-option">
                    <div
                      className="skeleton-text"
                      style={{ width: "200px", height: "16px" }}
                    ></div>
                  </div>
                  <div
                    className="skeleton-text"
                    style={{ width: "150px", height: "40px" }}
                  ></div>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
