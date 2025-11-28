import { useEffect, useState } from "react";
import { getSalesReport, SalesReportRow } from "../../services/api/reports";
import { getJobseekerProfiles } from "../../services/api/jobseeker";
import { getClients, ClientData } from "../../services/api/client";
import { AppHeader } from "../../components/AppHeader";
import { CustomDropdown, DropdownOption } from "../../components/CustomDropdown";
import { useLanguage } from "../../contexts/language/language-provider";
import { Loader2, Calendar, User, Building, Users } from "lucide-react";
import { JobSeekerProfile } from "../../types/jobseeker";
import { formatDate as formatWeekDate } from "../../utils/weekUtils";
import "../../styles/pages/CommonReportsStyles.css";
import { exportToCSV } from '../../utils/csvExport';

// Define the columns and headers as used in the UI table
const getTableColumns = (t: (key: string) => string): { key: string; label: string; format?: (val: unknown, row?: Record<string, unknown>) => string }[] => [
  { key: 'client_name', label: t('reports.columns.clientName'), format: (val) => String(val ?? '') },
  { key: 'contact_person_name', label: t('reports.columns.contactPerson'), format: (val) => String(val ?? '') },
  { key: 'sales_person', label: t('reports.columns.salesPersonCol'), format: (val) => String(val ?? '') },
  { key: 'invoice_number', label: t('reports.columns.invoiceNumber'), format: (val) => String(val ?? '') },
  { key: 'from_to_date', label: t('reports.columns.fromToDate'), format: (_val, row) => {
    if (row && typeof row === 'object' && 'from_date' in row && 'to_date' in row) {
      return `${formatWeekDate(String((row as Record<string, unknown>).from_date))} - ${formatWeekDate(String((row as Record<string, unknown>).to_date))}`;
    }
    return '';
  } },
  { key: 'invoice_date', label: t('reports.columns.invoiceDate'), format: (val) => formatWeekDate(String(val ?? '')) },
  { key: 'due_date', label: t('reports.columns.dueDate'), format: (val) => formatWeekDate(String(val ?? '')) },
  { key: 'terms', label: t('reports.columns.terms'), format: (val) => String(val ?? '') },
  { key: 'item_position', label: t('reports.columns.itemPosition'), format: (val) => String(val ?? '') },
  { key: 'position_category', label: t('reports.columns.positionCategory'), format: (val) => String(val ?? '') },
  { key: 'jobseeker_number', label: t('reports.columns.jobseekerNumberCol'), format: (val) => val ? `#${val}` : '' },
  { key: 'jobseeker_name', label: t('reports.columns.nameOfJobseeker'), format: (val) => String(val ?? '') },
  { key: 'description', label: t('reports.columns.description'), format: (val) => String(val ?? '') },
  { key: 'hours', label: t('reports.columns.hours'), format: (val) => String(val ?? '') },
  { key: 'bill_rate', label: t('reports.columns.billRate'), format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'amount', label: t('reports.columns.amount'), format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'discount', label: t('reports.columns.discount'), format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'tax_rate', label: t('reports.columns.taxRate'), format: (val) => val !== undefined && val !== 'N/A' ? `${val}%` : String(val ?? '') },
  { key: 'gst_hst', label: t('reports.columns.gstHst'), format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'total', label: t('reports.columns.total'), format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'currency', label: t('reports.columns.currency'), format: (val) => String(val ?? '') },
];

// For CSV: Match UI table order
const getCsvColumns = (tableColumns: ReturnType<typeof getTableColumns>) => [
  ...tableColumns
];

export function SalesReport() {
  const { t } = useLanguage();
  const tableColumns = getTableColumns(t);
  const csvColumns = getCsvColumns(tableColumns);
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
        setClients(res.clients);
        
        // Extract unique sales persons from backend data
        const uniqueSalesPersons = [...new Set(res.clients.map(c => c.salesPerson).filter(Boolean) as string[])];
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
      <AppHeader title={t('reports.types.salesReport.title')} />
      <div className="common-report-card">
        <div className="timesheet-selection-bar">
          <div className="selection-row">
            <div className="selection-section">
              <label className="selection-label">{t('reports.filters.clients')}</label>
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
                  placeholder={t('reports.placeholders.selectClients')}
                  multiSelect={true}
                  showSelectAll={true}
                  icon={<Building size={16} />}
                  emptyMessage={t('reports.emptyMessages.noClients')}
                  maxVisibleTagsOverride={4}
                />
              )}
              <div style={{ marginTop: 8, color: '#555', fontSize: 13 }}>
                {t('reports.notes.autoGenerate')}
              </div>
            </div>
            <div className="selection-section date-input-wrapper">
              <div className="start-end-date-section">
                <div className="start-date-section">
                    <label className="selection-label" htmlFor="start-date-input" onClick={() => document.getElementById('start-date-input')?.focus()}>
                      <Calendar size={16} /> {t('reports.filters.startDate')}
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
                    <Calendar size={16} /> {t('reports.filters.endDate')}
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
                <strong>Note:</strong> {t('reports.notes.dateFilter')} <b>{t('reports.notes.invoiceDate')}</b>.
              </div>
            </div>
          </div>
          <div className="selection-row">
            <div className="selection-section">
              <label className="selection-label">{t('reports.filters.jobseekers')}</label>
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
                  placeholder={t('reports.placeholders.selectJobseekers')}
                  multiSelect={true}
                  showSelectAll={true}
                  icon={<User size={16} />}
                  emptyMessage={t('reports.emptyMessages.noJobseekers')}
                  maxVisibleTagsOverride={3}
                />
              )}
            </div>
            <div className="selection-section salespers-section">
              <label className="selection-label">{t('reports.filters.salesPerson')}</label>
              <CustomDropdown
                options={salesPersonDropdownOptions}
                selectedOptions={selectedSalesPersons.length > 0 ? (selectedSalesPersons.map((sp) => salesPersonDropdownOptions.find((o) => o.id === sp) as DropdownOption).filter(Boolean)) : []}
                onSelect={(opts) => {
                  if (Array.isArray(opts)) setSelectedSalesPersons(opts.map((o) => o.value as string));
                  else if (opts && typeof opts === 'object') setSelectedSalesPersons([opts.value as string]);
                  else setSelectedSalesPersons([]);
                }}
                placeholder={t('reports.placeholders.selectSalesPersons')}
                multiSelect={true}
                showSelectAll={true}
                icon={<Users size={16} />}
                emptyMessage={t('reports.emptyMessages.noSalesPersons')}
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
                const csvData = reportRows.map((row, index) => {
                  const csvRow: Record<string, unknown> = {
                    [t("reports.columns.serialNumber") || "S.No."]: index + 1,
                  };
                  csvColumns.forEach(col => {
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
                  [t("reports.columns.serialNumber") || "S.No.", ...csvColumns.map(col => col.label)]
                );
              }}
            >
              {t('reports.states.downloadCSV')}
            </button>
          </div>
        )}
        <div className="report-table-container timesheet-selection-bar">
          {loading ? (
            <div className="loading-indicator"><Loader2 size={24} className="spin" /> {t('reports.states.loading')}</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : reportRows.length === 0 ? (
            <div className="empty-state">{t('reports.states.noDataFound')}</div>
          ) : (
            <table className="common-table">
              <thead>
                <tr>
                  {tableColumns.map(col => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row, idx) => (
                  <tr key={idx}>
                    {tableColumns.map((col, i) => {
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