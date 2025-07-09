import { useEffect, useState } from "react";
import { getSalesReport, SalesReportRow } from "../../services/api/reports";
import { getJobseekerProfiles } from "../../services/api/jobseeker";
import { getClients, ClientData } from "../../services/api/client";
import { AppHeader } from "../../components/AppHeader";
import { CustomDropdown, DropdownOption } from "../../components/CustomDropdown";
import { Loader2, Calendar, User, Building, Users } from "lucide-react";
import { JobSeekerProfile } from "../../types/jobseeker";
import { formatDate as formatWeekDate } from "../../utils/weekUtils";
import { BackendClientData } from "../ClientManagement/ClientManagement";
import "../../styles/pages/CommonReportsStyles.css";
import { exportToCSV } from '../../utils/csvExport';

// Define the columns and headers as used in the UI table
const TABLE_COLUMNS: { key: string; label: string; format?: (val: unknown, row?: Record<string, unknown>) => string }[] = [
  { key: 'client_name', label: 'Client Name', format: (val) => String(val ?? '') },
  { key: 'contact_person_name', label: 'Contact Person', format: (val) => String(val ?? '') },
  { key: 'sales_person', label: 'Sales Person', format: (val) => String(val ?? '') },
  { key: 'invoice_number', label: 'Invoice #', format: (val) => String(val ?? '') },
  { key: 'from_to_date', label: 'From & To (date)', format: (_val, row) => {
    if (row && typeof row === 'object' && 'from_date' in row && 'to_date' in row) {
      return `${formatWeekDate(String((row as Record<string, unknown>).from_date))} - ${formatWeekDate(String((row as Record<string, unknown>).to_date))}`;
    }
    return '';
  } },
  { key: 'invoice_date', label: 'Invoice Date', format: (val) => formatWeekDate(String(val ?? '')) },
  { key: 'due_date', label: 'Due Date', format: (val) => formatWeekDate(String(val ?? '')) },
  { key: 'terms', label: 'Terms', format: (val) => String(val ?? '') },
  { key: 'item_position', label: 'Item/Position', format: (val) => String(val ?? '') },
  { key: 'position_category', label: 'Position Category', format: (val) => String(val ?? '') },
  { key: 'jobseeker_number', label: 'Jobseeker #', format: (val) => val ? `#${val}` : '' },
  { key: 'jobseeker_name', label: 'Name of jobseeker', format: (val) => String(val ?? '') },
  { key: 'description', label: 'Description', format: (val) => String(val ?? '') },
  { key: 'hours', label: 'Hours', format: (val) => String(val ?? '') },
  { key: 'bill_rate', label: 'Bill Rate', format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'amount', label: 'Amount', format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'discount', label: 'Discount', format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'tax_rate', label: 'Tax Rate (%)', format: (val) => val !== undefined && val !== 'N/A' ? `${val}%` : String(val ?? '') },
  { key: 'gst_hst', label: 'GST/HST', format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'total', label: 'Total', format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'currency', label: 'Currency', format: (val) => String(val ?? '') },
];

// For CSV: Match UI table order
const CSV_COLUMNS = [
  ...TABLE_COLUMNS
];

export function SalesReport() {
  // Filter state
  const [clients, setClients] = useState<ClientData[]>([]);
  const [jobseekers, setJobseekers] = useState<JobSeekerProfile[]>([]);
  const [selectedClients, setSelectedClients] = useState<ClientData[]>([]);
  const [selectedJobseekers, setSelectedJobseekers] = useState<JobSeekerProfile[]>([]);
  const [selectedSalesPersons, setSelectedSalesPersons] = useState<string[]>([]);
  const [salesPersonOptions, setSalesPersonOptions] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Data state
  const [clientLoading, setClientLoading] = useState(false);
  const [jobseekerLoading, setJobseekerLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<SalesReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients and jobseekers on mount
  useEffect(() => {
    setClientLoading(true);
    getClients({ limit: 10000 })
      .then((res) => {
        // Map backend fields to frontend fields (camelCase) using BackendClientData
        const backendClients = res.clients as BackendClientData[];
        const convertedClients = backendClients.map((client: BackendClientData) => ({
          ...client,
          companyName: client.company_name,
          shortCode: client.short_code,
          listName: client.list_name,
          contactPersonName1: client.contact_person_name1,
          contactPersonName2: client.contact_person_name2,
          emailAddress1: client.email_address1,
          emailAddress2: client.email_address2,
          mobile1: client.mobile1,
          mobile2: client.mobile2,
          landline1: client.landline1,
          landline2: client.landline2,
          preferredPaymentMethod: client.preferred_payment_method,
          payCycle: client.pay_cycle,
          createdAt: client.created_at,
          updatedAt: client.updated_at,
        }));
        setClients(convertedClients);
        
        // Extract unique sales persons from backend data
        const uniqueSalesPersons = [...new Set(backendClients.map(c => c.sales_person).filter(Boolean) as string[])];
        setSalesPersonOptions(uniqueSalesPersons);
      })
      .catch(() => setClients([]))
      .finally(() => setClientLoading(false));

    setJobseekerLoading(true);
    getJobseekerProfiles({ limit: 10000 })
      .then((res) => setJobseekers(res.profiles || []))
      .catch(() => setJobseekers([]))
      .finally(() => setJobseekerLoading(false));
  }, []);

  // Fetch report when filters change
  useEffect(() => {
    if (selectedClients.length === 0) {
      setReportRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    const filter = {
      clientIds: selectedClients.map((c) => c.id ?? ""),
      startDate,
      endDate,
      jobseekerIds: selectedJobseekers.length > 0 ? selectedJobseekers.map((j) => j.id ?? "") : undefined,
      salesPersons: selectedSalesPersons.length > 0 ? selectedSalesPersons : undefined,
    };
    getSalesReport(filter)
      .then(setReportRows)
      .catch((e) => setError(e.message || "Failed to fetch report"))
      .finally(() => setLoading(false));
  }, [selectedClients, startDate, endDate, selectedJobseekers, selectedSalesPersons]);

  // Dropdown options
  const clientOptions: DropdownOption[] = clients.map((c) => ({
    id: c.id ?? "",
    label: c.companyName || "Unknown",
    sublabel: c.shortCode || "",
    value: c,
  }));

  const jobseekerOptions: DropdownOption[] = jobseekers.map((j) => {
    const phoneNumber = (j as JobSeekerProfile & { mobile?: string; phone?: string; employeeId?: string }).phoneNumber;
    const employeeId = (j as JobSeekerProfile & { mobile?: string; phone?: string; employeeId?: string }).employeeId;
    return {
      id: j.id ?? "",
      label: j.name || j.email || "Unknown",
      sublabel: [
        j.email,
        phoneNumber,
        employeeId
      ].filter(Boolean).join(" - "),
      value: j,
    };
  });

  const salesPersonDropdownOptions: DropdownOption[] = salesPersonOptions.map((sp) => ({
    id: sp,
    label: sp,
    value: sp,
  }));

  return (
    <div className="page-container common-report-container">
      <AppHeader title="Sales Report" />
      <div className="common-report-card">
        <div className="timesheet-selection-bar">
          <div className="selection-row">
            <div className="selection-section">
              <label className="selection-label">Clients</label>
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
                  selectedOptions={selectedClients.length > 0 ? (selectedClients.map((c) => clientOptions.find((o) => o.id === c.id) as DropdownOption).filter(Boolean)) : []}
                  onSelect={(opts) => {
                    if (Array.isArray(opts)) setSelectedClients(opts.map((o) => o.value as ClientData));
                    else if (opts && typeof opts === 'object') setSelectedClients([opts.value as ClientData]);
                    else setSelectedClients([]);
                  }}
                  placeholder="Select clients..."
                  multiSelect={true}
                  showSelectAll={true}
                  icon={<Building size={16} />}
                  emptyMessage="No clients found"
                  maxVisibleTagsOverride={4}
                />
              )}
              <div style={{ marginTop: 8, color: '#555', fontSize: 13 }}>
                Report will auto-generate as soon as you select a client and date range. Additional filters will further refine the results.
              </div>
            </div>
            <div className="selection-section date-input-wrapper">
              <div className="start-end-date-section">
                <div className="start-date-section">
                    <label className="selection-label" htmlFor="start-date-input" onClick={() => document.getElementById('start-date-input')?.focus()}>
                      <Calendar size={16} /> Start Date
                  </label>
                  <input
                    id="start-date-input"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="invoice-date-input"
                  />
                </div>
                <div className="end-date-section">
                  <label className="selection-label" htmlFor="end-date-input" onClick={() => document.getElementById('end-date-input')?.focus()}>
                    <Calendar size={16} /> End Date
                  </label>
                  <input
                    id="end-date-input"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="invoice-date-input"
                  />
                </div>
              </div>
              <div style={{ marginTop: 4, color: '#888', fontSize: 13 }}>
                <strong>Note:</strong> The date filter is applied on the <b>invoice date</b>.
              </div>
            </div>
          </div>
          <div className="selection-row">
            <div className="selection-section">
              <label className="selection-label">Jobseekers</label>
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
                  selectedOptions={selectedJobseekers.length > 0 ? (selectedJobseekers.map((j) => jobseekerOptions.find((o) => o.id === j.id) as DropdownOption).filter(Boolean)) : []}
                  onSelect={(opts) => {
                    if (Array.isArray(opts)) setSelectedJobseekers(opts.map((o) => o.value as JobSeekerProfile));
                    else if (opts && typeof opts === 'object') setSelectedJobseekers([opts.value as JobSeekerProfile]);
                    else setSelectedJobseekers([]);
                  }}
                  placeholder="Select jobseekers (default: Select All)..."
                  multiSelect={true}
                  showSelectAll={true}
                  icon={<User size={16} />}
                  emptyMessage="No jobseekers found"
                  maxVisibleTagsOverride={3}
                />
              )}
            </div>
            <div className="selection-section salespers-section">
              <label className="selection-label">Sales Person</label>
              <CustomDropdown
                options={salesPersonDropdownOptions}
                selectedOptions={selectedSalesPersons.length > 0 ? (selectedSalesPersons.map((sp) => salesPersonDropdownOptions.find((o) => o.id === sp) as DropdownOption).filter(Boolean)) : []}
                onSelect={(opts) => {
                  if (Array.isArray(opts)) setSelectedSalesPersons(opts.map((o) => o.value as string));
                  else if (opts && typeof opts === 'object') setSelectedSalesPersons([opts.value as string]);
                  else setSelectedSalesPersons([]);
                }}
                placeholder="Select sales persons (default: Select All)..."
                multiSelect={true}
                showSelectAll={true}
                icon={<Users size={16} />}
                emptyMessage="No sales persons found"
                maxVisibleTagsOverride={3}
              />
            </div>
          </div>
        </div>
        {reportRows.length > 0 && (
          <div className="csv-download-section">
            <button
              className="button"
              onClick={() => {
                // Prepare CSV data to match the table exactly
                const csvData = reportRows.map(row => {
                  const csvRow: Record<string, unknown> = {};
                  CSV_COLUMNS.forEach(col => {
                    if (col.key === 'from_to_date') {
                      csvRow[col.label] = col.format ? col.format(undefined, row as unknown as Record<string, unknown>) : '';
                    } else {
                      const val = row[col.key as keyof typeof row];
                      csvRow[col.label] = col.format ? col.format(val) : (val !== undefined && val !== null ? String(val) : 'N/A');
                    }
                  });
                  return csvRow;
                });
                exportToCSV(
                  csvData,
                  'Sales Report.csv',
                  CSV_COLUMNS.map(col => col.label)
                );
              }}
            >
              Download CSV
            </button>
          </div>
        )}
        <div className="report-table-container timesheet-selection-bar">
          {loading ? (
            <div className="loading-indicator"><Loader2 size={24} className="spin" /> Loading...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : reportRows.length === 0 ? (
            <div className="empty-state">No data found for selected filters.</div>
          ) : (
            <table className="common-table">
              <thead>
                <tr>
                  {TABLE_COLUMNS.map(col => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row, idx) => (
                  <tr key={idx}>
                    {TABLE_COLUMNS.map((col, i) => {
                      if (col.key === 'from_to_date') {
                        const displayValue = col.format ? col.format(undefined, row as unknown as Record<string, unknown>) : '';
                        return <td key={i}>{displayValue}</td>;
                      } else {
                        const val = row[col.key as keyof typeof row];
                        const displayValue = col.format ? col.format(val) : (val !== undefined && val !== null ? String(val) : 'N/A');
                        return <td key={i}>{displayValue}</td>;
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default SalesReport; 