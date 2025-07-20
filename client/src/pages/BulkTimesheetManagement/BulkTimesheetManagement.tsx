import { useState, useEffect } from "react";
import { AppHeader } from "../../components/AppHeader";
import { CustomDropdown, DropdownOption } from "../../components/CustomDropdown";
import { getClients, ClientData } from "../../services/api/client";
import { getClientPositions, PositionData } from "../../services/api/position";
import { getPositionAssignments, AssignmentRecord } from "../../services/api/position";
import { generateWeekOptions, formatDate } from "../../utils/weekUtils";
import { generateInvoiceNumber, createBulkTimesheetFromFrontendData } from "../../services/api/bulkTimesheet";
import { Building } from "lucide-react";
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
  totalRegularHours: number;
  totalOvertimeHours: number;
  jobseekerPay: number;
  clientBill: number;
}

export function BulkTimesheetManagement() {
  // State for client selection
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  // State for position selection
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<PositionData | null>(null);
  const [positionLoading, setPositionLoading] = useState(false);

  // State for week selection
  const [weekOptions, setWeekOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>("");

  // State for invoice number
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");

  // State for assigned jobseekers
  const [assignedJobseekers, setAssignedJobseekers] = useState<AssignmentRecord[]>([]);
  const [jobseekerTimesheets, setJobseekerTimesheets] = useState<JobseekerTimesheet[]>([]);

  // State for email sending preference
  const [sendEmail, setSendEmail] = useState<boolean>(false);

  // State for bulk timesheet generation
  const [isGeneratingBulkTimesheet, setIsGeneratingBulkTimesheet] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string>("");
  const [generationError, setGenerationError] = useState<string>("");

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
          entries: weekDates.map((date) => ({ date, hours: 0, overtimeHours: 0 })),
          bonusAmount: 0,
          deductionAmount: 0,
          totalRegularHours: 0,
          totalOvertimeHours: 0,
          jobseekerPay: 0,
          clientBill: 0,
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

  // Generate invoice number when client and position are selected
  useEffect(() => {
    if (selectedClient && selectedPosition) {
      generateAndSetInvoiceNumber();
    }
  }, [selectedClient, selectedPosition]);

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

  // Generate invoice number
  const generateAndSetInvoiceNumber = async () => {
    try {
      const newInvoiceNumber = await generateInvoiceNumber();
      setInvoiceNumber(newInvoiceNumber);
    } catch (error) {
      console.error("Failed to generate invoice number:", error);
      setInvoiceNumber("TBD");
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
  const calculateTimesheetTotals = (entries: TimesheetEntry[], bonusAmount = 0, deductionAmount = 0) => {
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
  const getBaseJobseekerPay = (timesheet: JobseekerTimesheet, position: PositionWithOvertime) => {
    const regularPay = timesheet.totalRegularHours * parseFloat(position.regularPayRate || "0");
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
        const totals = calculateTimesheetTotals(updatedEntries, ts.bonusAmount, ts.deductionAmount);

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
        const totals = calculateTimesheetTotals(ts.entries, bonus, ts.deductionAmount);
        return { ...ts, bonusAmount: bonus, ...totals };
      })
    );
  };

  const updateDeduction = (jobseekerId: string, deduction: number) => {
    setJobseekerTimesheets((prev) =>
      prev.map((ts) => {
        if (ts.jobseeker.id !== jobseekerId) return ts;
        const totals = calculateTimesheetTotals(ts.entries, ts.bonusAmount, deduction);
        return { ...ts, deductionAmount: deduction, ...totals };
      })
    );
  };

  // Dropdown options
  const clientOptions: DropdownOption[] = clients.map((client) => ({
    id: client.id!,
    label: client.companyName || "Unknown Client",
    sublabel: client.shortCode || "",
    value: client,
  }));
  const positionOptions: DropdownOption[] = positions.map((position) => ({
    id: position.id || "",
    label: position.title || "Unknown Position",
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
    console.log("selected client", option)
    setSelectedClient(option.value as ClientData);
  };

  // Grand totals
  const grandTotalRegularHours = jobseekerTimesheets.reduce((sum, ts) => sum + ts.totalRegularHours, 0);
  const grandTotalOvertimeHours = jobseekerTimesheets.reduce((sum, ts) => sum + ts.totalOvertimeHours, 0);
  const grandTotalPay = jobseekerTimesheets.reduce((sum, ts) => sum + ts.jobseekerPay, 0);
  const grandTotalBonus = jobseekerTimesheets.reduce((sum, ts) => sum + ts.bonusAmount, 0);
  const grandTotalDeduction = jobseekerTimesheets.reduce((sum, ts) => sum + ts.deductionAmount, 0);
  // const grandTotalBill = jobseekerTimesheets.reduce((sum, ts) => sum + ts.clientBill, 0);

  const generateBulkTimesheetData = async () => {
    if (!selectedClient || !selectedPosition || !selectedWeekStart || jobseekerTimesheets.length === 0) {
      console.warn("Cannot generate bulk timesheet data: Missing required information");
      setGenerationError("Cannot generate bulk timesheet data: Missing required information");
      return;
    }

    setIsGeneratingBulkTimesheet(true);
    setGenerationMessage("");
    setGenerationError("");

    try {
      console.log("Starting bulk timesheet creation...");

      // Calculate additional grand totals
      const grandTotalBill = jobseekerTimesheets.reduce((sum, ts) => sum + ts.clientBill, 0);
      const grandTotalBonus = jobseekerTimesheets.reduce((sum, ts) => sum + ts.bonusAmount, 0);
      const grandTotalDeduction = jobseekerTimesheets.reduce((sum, ts) => sum + ts.deductionAmount, 0);
      const grandTotalHours = grandTotalRegularHours + grandTotalOvertimeHours;
      
      // Calculate overtime pay specifically
      const position = selectedPosition as PositionWithOvertime;
      let overtimePayRate = parseFloat(position.regularPayRate || "0");
      if (position.overtimeEnabled && position.overtimePayRate) {
        overtimePayRate = parseFloat(position.overtimePayRate);
      }
      const grandTotalOvertimePay = grandTotalOvertimeHours * overtimePayRate;

      // Calculate week end date
      const weekEndDate = new Date(selectedWeekStart);
      weekEndDate.setDate(weekEndDate.getDate() + 6);

      // Create flattened bulk timesheet object for API submission
      const bulkTimesheetData = {
        clientId: selectedClient.id!,
        positionId: selectedPosition.id!,
        invoiceNumber: invoiceNumber,
        weekStartDate: selectedWeekStart,
        weekEndDate: weekEndDate.toISOString().split("T")[0],
        weekPeriod: `${formatDate(selectedWeekStart)} - ${formatDate(weekEndDate.toISOString().split("T")[0])}`,
        emailSent: sendEmail,
        totalHours: grandTotalHours,
        totalRegularHours: grandTotalRegularHours,
        totalOvertimeHours: grandTotalOvertimeHours,
        totalOvertimePay: grandTotalOvertimePay,
        totalJobseekerPay: grandTotalPay,
        totalClientBill: grandTotalBill,
        totalBonus: grandTotalBonus,
        totalDeductions: grandTotalDeduction,
        netPay: grandTotalPay, // This already includes bonus and deductions
        numberOfJobseekers: jobseekerTimesheets.length,
        averageHoursPerJobseeker: grandTotalHours / jobseekerTimesheets.length,
        averagePayPerJobseeker: grandTotalPay / jobseekerTimesheets.length,
        jobseekerTimesheets: jobseekerTimesheets.map(ts => ({
          jobseeker: {
            id: ts.jobseeker.id,
            jobseekerProfile: {
              first_name: ts.jobseeker.jobseekerProfile?.first_name || '',
              last_name: ts.jobseeker.jobseekerProfile?.last_name || '',
              email: ts.jobseeker.jobseekerProfile?.email || '',
            },
            assignmentId: ts.jobseeker.id,
          },
          entries: ts.entries,
          bonusAmount: ts.bonusAmount,
          deductionAmount: ts.deductionAmount,
          totalRegularHours: ts.totalRegularHours,
          totalOvertimeHours: ts.totalOvertimeHours,
          jobseekerPay: ts.jobseekerPay,
          clientBill: ts.clientBill,
        })),
      };

      // Submit to API
      const result = await createBulkTimesheetFromFrontendData(bulkTimesheetData);
      
      console.log("Bulk timesheet created successfully:", result);
      
      // Show success message with details
      setGenerationMessage(`Bulk timesheet created successfully! Invoice Number: ${result.bulkTimesheet.invoiceNumber} | ${jobseekerTimesheets.length} jobseeker(s) | ${grandTotalHours.toFixed(1)} total hours | $${grandTotalPay.toFixed(2)} total pay | Email ${sendEmail ? 'will be sent' : 'will not be sent'}`);
      
      return result;
    } catch (error) {
      console.error("Error creating bulk timesheet:", error);
      setGenerationError(`Failed to create bulk timesheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingBulkTimesheet(false);
    }
  };

  return (
    <div className="bulk-timesheet-page-container timesheet-page-container">
      <AppHeader 
        title="Create Bulk Timesheet" 
        hideHamburgerMenu={false} 
        statusMessage={generationMessage || generationError}
        statusType={
          generationError ? "error" : generationMessage ? "success" : undefined
        }
      />
      <div className="timesheet-content-container">
        <div className="timesheet-selection-bar">
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
                placeholder="Search and select client..."
                loading={false}
                icon={<Building size={16} />}
                emptyMessage="No clients found"
              />
            )}
          </div>
          <div className="selection-section">
            <label className="selection-label">Position</label>
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
                selectedOption={selectedPosition ? positionOptions.find((opt) => opt.id === selectedPosition.id) : null}
                onSelect={(option) => {
                  if (Array.isArray(option)) return;
                  const selectedPosition  = positions.filter((position) => position.id === option.id )
                  setSelectedPosition(selectedPosition[0]);
                }}
                placeholder={selectedClient ? "Search and select position..." : "Please select a client first"}
                disabled={!selectedClient}
                loading={false}
                icon={null}
                emptyMessage={selectedClient ? "No positions found" : "Please select a client first to view positions"}
              />
            )}
          </div>
          <div className="selection-section">
            <label className="selection-label">Week Period</label>
            <CustomDropdown
              options={weekDropdownOptions}
              selectedOption={selectedWeekStart ? weekDropdownOptions.find((opt) => opt.value === selectedWeekStart) : null}
              onSelect={(option) => {
                if (Array.isArray(option)) return;
                setSelectedWeekStart(option.value as string);
              }}
              placeholder="Select week range..."
              loading={false}
              icon={null}
              emptyMessage="No week options found"
              searchable={false}
            />
          </div>
        </div>
        {/* Move client info header below selection bar, as a separate section */}
        {selectedClient && (
          <div className="timesheet-unified-header">
            <div className="timesheet-header-sections">
              <div className="timesheet-section timesheet-client-section">
                <h4 className="timesheet-section-title">Client & Position</h4>
                <div className="timesheet-section-content">
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">Client Name:</span>
                    <span className="timesheet-detail-value">{selectedClient.companyName}</span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">Position Title:</span>
                    <span className="timesheet-detail-value">{selectedPosition?.title || "N/A"}</span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">Position Code:</span>
                    <span className="timesheet-detail-value">{selectedPosition?.positionCode || "N/A"}</span>
                  </div>
                </div>
              </div>

              <div className="timesheet-section timesheet-invoice-section">
                <h4 className="timesheet-section-title">Invoice & Period</h4>
                <div className="timesheet-section-content">
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">Invoice Number:</span>
                    <span className="timesheet-detail-value">#{invoiceNumber || "TBD"}</span>
                  </div>
                  <div className="timesheet-detail-item">
                    <span className="timesheet-detail-label">Period:</span>
                    <span className="timesheet-detail-value">
                      {selectedWeekStart ? (
                        <>
                          {formatDate(selectedWeekStart)} - {formatDate(
                            new Date(new Date(selectedWeekStart).getTime() + 6 * 24 * 60 * 60 * 1000)
                              .toISOString()
                              .split("T")[0]
                          )}
                        </>
                      ) : (
                        "N/A"
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timesheet input for each jobseeker */}
        {selectedClient && selectedPosition && selectedWeekStart && jobseekerTimesheets.length > 0 && (
          <div className="bulk-timesheet-forms-container">
            {jobseekerTimesheets.map((ts) => (
              <div className="timesheet-assignment-card" key={ts.jobseeker.id}>
                <div className="timesheet-hours-adjustments-container">
                  <div className="timesheet-hours-section">
                    <h4 className="timesheet-hours-title">Daily Hours | {ts.jobseeker.jobseekerProfile?.first_name} {ts.jobseeker.jobseekerProfile?.last_name} • {ts.jobseeker.jobseekerProfile?.email}</h4>
                    <div className="timesheet-days-grid">
                      {ts.entries.map((entry) => (
                        <div key={entry.date} className="timesheet-day-entry">
                          <label className="timesheet-day-label">
                            <div className="timesheet-day-name">{new Date(entry.date).toLocaleDateString("en-CA", { weekday: "short" })}</div>
                            <div className="timesheet-day-date">({entry.date})</div>
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            step="0.5"
                            value={entry.hours}
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
                    <h4 className="timesheet-hours-title">Pay Adjustments</h4>
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
                          value={ts.bonusAmount || ""}
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
                          <div className="timesheet-day-name">Deduction</div>
                          <div className="timesheet-day-date">Amount</div>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={ts.deductionAmount || ""}
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
                            ?.overtimeHours || "40"}{" "}
                          hours
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Invoice Style Summary - Exact same as TimesheetManagement */}
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
                          {ts.totalRegularHours.toFixed(1)}
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
                              Overtime Hours
                            </div>
                            <div className="timesheet-item-subtitle">
                              Hours exceeding{" "}
                              {(selectedPosition as PositionWithOvertime)
                                ?.overtimeHours || "40"}{" "}
                                hours/week
                              </div>
                            </div>
                            <div className="timesheet-col-hours">
                              {ts.totalOvertimeHours.toFixed(1)}
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
                              Bonus
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
                              Deduction
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
                          Total Hours:
                        </div>
                        <div className="timesheet-total-value">
                          {(
                            ts.totalRegularHours +
                            ts.totalOvertimeHours
                          ).toFixed(1)}
                        </div>
                      </div>
                      {(() => {
                        const position = selectedPosition as PositionWithOvertime;
                        const basePay = getBaseJobseekerPay(ts, position);
                        const subtotal = basePay;
                        const employeePay = subtotal + (ts.bonusAmount || 0) - (ts.deductionAmount || 0);
                        return <>
                          <div className="timesheet-total-line timesheet-subtotal">
                            <div className="timesheet-total-label">
                              Subtotal:
                            </div>
                            <div className="timesheet-total-value">
                              ${subtotal.toFixed(2)}
                            </div>
                          </div>
                          {ts.bonusAmount > 0 && (
                            <div className="timesheet-total-line">
                              <div className="timesheet-total-label">
                                Bonus:
                              </div>
                              <div className="timesheet-total-value">
                                +${ts.bonusAmount.toFixed(2)}
                              </div>
                            </div>
                          )}
                          {ts.deductionAmount > 0 && (
                            <div className="timesheet-total-line">
                              <div className="timesheet-total-label">
                                Deduction:
                              </div>
                              <div className="timesheet-total-value">
                                -${ts.deductionAmount.toFixed(2)}
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
                </div>
              </div>
            ))}
            
            {/* Separate Final Summary Table */}
            <div className="timesheet-invoice-container">
              <div className="timesheet-invoice-table">
                <div className="timesheet-invoice-table-header">
                  <div className="timesheet-col-description">Final Summary</div>
                  <div className="timesheet-col-hours">Hours</div>
                  <div className="timesheet-col-rate">Rate</div>
                  <div className="timesheet-col-amount">Amount</div>
                </div>
                <div className="timesheet-invoice-table-body">
                  <div className="timesheet-invoice-line-item">
                    <div className="timesheet-col-description">
                      <div className="timesheet-item-title">Total Regular Hours</div>
                    </div>
                    <div className="timesheet-col-hours">{grandTotalRegularHours.toFixed(1)}</div>
                    <div className="timesheet-col-rate">${selectedPosition?.regularPayRate || "0.00"}</div>
                    <div className="timesheet-col-amount">
                      ${(grandTotalRegularHours * parseFloat(selectedPosition?.regularPayRate || "0")).toFixed(2)}
                    </div>
                  </div>
                  {grandTotalOvertimeHours > 0 && (
                    <div className="timesheet-invoice-line-item">
                      <div className="timesheet-col-description">
                        <div className="timesheet-item-title">Total Overtime Hours</div>
                      </div>
                      <div className="timesheet-col-hours">{grandTotalOvertimeHours.toFixed(1)}</div>
                      <div className="timesheet-col-rate">
                        ${(selectedPosition as PositionWithOvertime)?.overtimePayRate || selectedPosition?.regularPayRate || "0.00"}
                      </div>
                      <div className="timesheet-col-amount">
                        ${(grandTotalOvertimeHours * parseFloat((selectedPosition as PositionWithOvertime)?.overtimePayRate || selectedPosition?.regularPayRate || "0")).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="timesheet-invoice-totals">
                  <div className="timesheet-total-line">
                    <div className="timesheet-total-label">Grand Total Hours:</div>
                    <div className="timesheet-total-value">{(grandTotalRegularHours + grandTotalOvertimeHours).toFixed(1)}</div>
                  </div>
                  {grandTotalBonus > 0 && (
                    <div className="timesheet-total-line">
                      <div className="timesheet-total-label">Grand Total Bonus:</div>
                      <div className="timesheet-total-value">+${grandTotalBonus.toFixed(2)}</div>
                    </div>
                  )}
                  {grandTotalDeduction > 0 && (
                    <div className="timesheet-total-line">
                      <div className="timesheet-total-label">Grand Total Deduction:</div>
                      <div className="timesheet-total-value">-${grandTotalDeduction.toFixed(2)}</div>
                    </div>
                  )}
                  <div className="timesheet-total-line timesheet-grand-total">
                    <div className="timesheet-total-label">Grand Total Pay:</div>
                    <div className="timesheet-total-value">${grandTotalPay.toFixed(2)}</div>
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
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="timesheet-checkbox"
                  />
                  <span className="timesheet-checkbox-text">
                    Send timesheets via email to all jobseekers
                  </span>
                </label>
              </div>
              <button
                className="button"
                onClick={generateBulkTimesheetData}
                disabled={jobseekerTimesheets.length === 0 || isGeneratingBulkTimesheet}
              >
                {isGeneratingBulkTimesheet ? "Generating..." : "Generate Bulk Timesheet"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 