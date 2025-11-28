import { useEffect, useState } from "react";
import { getTimesheetReport, TimesheetReportFilter, TimesheetReportRow } from "../../services/api/reports";
import { getJobseekerProfiles } from "../../services/api/jobseeker";
import { getClients, ClientData } from "../../services/api/client";
import { AppHeader } from "../../components/AppHeader";
import { CustomDropdown, DropdownOption } from "../../components/CustomDropdown";
import { useLanguage } from "../../contexts/language/language-provider";
import { Loader2, Calendar, User, Building } from "lucide-react";
import { JobSeekerProfile } from "../../types/jobseeker";
import { generateWeekOptions, formatDate as formatWeekDate } from "../../utils/weekUtils";
import { PAY_CYCLES, LIST_NAMES } from "../../constants/formOptions";
import "../../styles/pages/CommonReportsStyles.css";
import { exportToCSV } from '../../utils/csvExport';

// Format date utility function (similar to ClientDrafts)
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString();
};

// Define the columns and headers as used in the UI table (excluding HST)
const getTableColumns = (t: (key: string) => string): { key: string; label: string; format?: (val: unknown, row?: Record<string, unknown>) => string }[] => [
  { key: 'week_period', label: t('reports.columns.weekPeriod'), format: (_val, row) => {
    if (row && typeof row === 'object' && 'week_start_date' in row && 'week_end_date' in row) {
      return `${formatWeekDate(String((row as Record<string, unknown>).week_start_date))} - ${formatWeekDate(String((row as Record<string, unknown>).week_end_date))}`;
    }
    return '';
  } },
  { key: 'employee_id', label: t('reports.columns.jobseekerNumber'), format: (val) => val ? `#${val}` : '' },
  { key: 'position_code', label: t('reports.columns.positionNumber'), format: (val) => val ? `#${val}` : '' },
  { key: 'title', label: t('reports.columns.positionDetail'), format: (val) => String(val ?? '') },
  { key: 'total_regular_hours', label: t('reports.columns.regularHours'), format: (val) => String(val ?? '') },
  { key: 'total_overtime_hours', label: t('reports.columns.overtimeHours'), format: (val) => String(val ?? '') },
  { key: 'regular_pay_rate', label: t('reports.columns.regularPay'), format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'overtime_pay_rate', label: t('reports.columns.overtimePay'), format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'total_jobseeker_pay', label: t('reports.columns.totalPay'), format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'bonus_amount', label: t('reports.columns.bonus'), format: (val) => val !== undefined && val !== 'N/A' ? `+$${val}` : String(val ?? '') },
  { key: 'deduction_amount', label: t('reports.columns.deduction'), format: (val) => val !== undefined && val !== 'N/A' ? `-$${val}` : String(val ?? '') },
  { key: 'company_name', label: t('reports.columns.companyName'), format: (val) => String(val ?? '') },
  { key: 'list_name', label: t('reports.columns.listName'), format: (val) => String(val ?? '') },
  { key: 'name', label: t('reports.columns.name'), format: (val) => String(val ?? '') },
  { key: 'mobile', label: t('reports.columns.mobile'), format: (val) => String(val ?? '') },
  { key: 'email', label: t('reports.columns.email'), format: (val) => String(val ?? '') },
  { key: 'position_category', label: t('reports.columns.positionCategory'), format: (val) => String(val ?? '') },
  { key: 'client_manager', label: t('reports.columns.clientManager'), format: (val) => String(val ?? '') },
  { key: 'regular_bill_rate', label: t('reports.columns.regularBillRate'), format: (val) => String(val ?? '') },
  { key: 'overtime_bill_rate', label: t('reports.columns.overtimeBillRate'), format: (val) => String(val ?? '') },
  { key: 'currency', label: t('reports.columns.currency'), format: (val) => String(val ?? '') },
  { key: 'payment_method', label: t('reports.columns.paymentMethod'), format: (val) => String(val ?? '') },
  { key: 'pay_cycle', label: t('reports.columns.payCycle'), format: (val) => String(val ?? '') },
  { key: 'notes', label: t('reports.columns.notes'), format: (val) => String(val ?? '') },
  { key: 'timesheet_created_at', label: t('reports.columns.createdAt'), format: (val) => formatDate(String(val ?? '')) },
  { key: 'invoice_number', label: t('reports.columns.timesheetNumber'), format: (val) => String(val ?? '') },
];

// For CSV: Match UI table order: Timesheet #, Week Period, then the rest
const getCsvColumns = (tableColumns: ReturnType<typeof getTableColumns>) => [
  { key: 'invoice_number', label: tableColumns.find(col => col.key === 'invoice_number')?.label || 'Timesheet #', format: (val: unknown) => String(val ?? '') },
  { key: 'week_period', label: tableColumns.find(col => col.key === 'week_period')?.label || 'Week Period', format: (_val: unknown, row?: Record<string, unknown>) => {
    if (row && typeof row === 'object' && 'week_start_date' in row && 'week_end_date' in row) {
      return `${formatWeekDate(String((row as Record<string, unknown>).week_start_date))} - ${formatWeekDate(String((row as Record<string, unknown>).week_end_date))}`;
    }
    return '';
  } },
  ...tableColumns.filter(col => col.key !== 'week_period' && col.key !== 'invoice_number')
];

export function WeeklyTimesheet() {
  const { t } = useLanguage();
  const tableColumns = getTableColumns(t);
  const csvColumns = getCsvColumns(tableColumns);
  // Filter state
  const [jobseekers, setJobseekers] = useState<JobSeekerProfile[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedJobseeker, setSelectedJobseeker] = useState<JobSeekerProfile | null>(null);
  const [selectedClients, setSelectedClients] = useState<ClientData[]>([]);
  const [weekOptions, setWeekOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedWeeks, setSelectedWeeks] = useState<Array<{ start: string; end: string }>>([]);
  const [payCycle, setPayCycle] = useState<string>("");
  const [listName, setListName] = useState<string>("");

  // Data state
  const [jobseekerLoading, setJobseekerLoading] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<TimesheetReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch jobseekers and clients on mount
  useEffect(() => {
    setJobseekerLoading(true);
    getJobseekerProfiles({ limit: 10000 })
      .then((res) => setJobseekers(res.profiles || []))
      .catch(() => setJobseekers([]))
      .finally(() => setJobseekerLoading(false));
    setClientLoading(true);
    getClients({ limit: 10000 })
      .then((res) => {
        setClients(res.clients);
      })
      .catch(() => setClients([]))
      .finally(() => setClientLoading(false));
  }, []);

  // Set week options on mount
  useEffect(() => {
    setWeekOptions(generateWeekOptions());
  }, []);

  // Fetch report when filters change
  useEffect(() => {
    if (!selectedJobseeker || selectedWeeks.length === 0) {
      setReportRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    const filter: TimesheetReportFilter = {
      jobseekerId: selectedJobseeker.id,
      clientIds: selectedClients.map((c) => c.id ?? ""),
      weekPeriods: selectedWeeks,
      payCycle: payCycle || undefined,
      listName: listName || undefined,
    };
    getTimesheetReport(filter)
      .then(setReportRows)
      .catch((e) => setError(e.message || "Failed to fetch report"))
      .finally(() => setLoading(false));
  }, [selectedJobseeker, selectedClients, selectedWeeks, payCycle, listName]);

  // Dropdown options
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
  const clientOptions: DropdownOption[] = clients.map((c) => ({
    id: c.id ?? "",
    label: c.companyName || "Unknown",
    sublabel: c.shortCode || "",
    value: c,
  }));
  const weekDropdownOptions: DropdownOption[] = weekOptions.map((w) => {
    const start = w.value;
    const startDate = new Date(start);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    const end = endDate.toISOString().split("T")[0];
    return {
      id: start + "_" + end,
      label: w.label,
      value: { start, end },
    };
  });
  // Add a 'Select (None)' option to both dropdowns
  const payCycleOptions: DropdownOption[] = [
    { id: '', label: t('reports.placeholders.selectNone'), value: '' },
    ...PAY_CYCLES.map((pc) => ({ id: pc, label: pc, value: pc }))
  ];
  const listNameOptions: DropdownOption[] = [
    { id: '', label: t('reports.placeholders.selectNone'), value: '' },
    ...LIST_NAMES.map((ln) => ({ id: ln, label: ln, value: ln }))
  ];

  return (
    <div className="page-container common-report-container">
      <AppHeader title={t('reports.types.weeklyTimesheet.title')} />
      <div className="common-report-card">
        <div className="timesheet-selection-bar">
          <div className="selection-row">
            <div className="selection-section">
              <label className="selection-label">{t('reports.filters.jobSeeker')}</label>
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
                  selectedOption={selectedJobseeker ? jobseekerOptions.find((o) => o.id === selectedJobseeker.id) || null : null}
                  onSelect={(opt) => {
                    if (!Array.isArray(opt) && opt && typeof opt === 'object') setSelectedJobseeker(opt.value as JobSeekerProfile);
                  }}
                  placeholder={t('reports.placeholders.selectJobSeeker')}
                  icon={<User size={16} />}
                  emptyMessage={t('reports.emptyMessages.noJobSeekers')}
                />
              )}
            </div>
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
                  maxVisibleTagsOverride={5}
                />
              )}
            </div>
          </div>
          <div className="selection-row">
            <div className="selection-section">
              <label className="selection-label">{t('reports.filters.weekPeriods')}</label>
              <CustomDropdown
                options={weekDropdownOptions}
                selectedOptions={selectedWeeks.length > 0 ? (selectedWeeks.map((w) => weekDropdownOptions.find((o) => o.id === w.start + "_" + w.end) as DropdownOption).filter(Boolean)) : []}
                onSelect={(opts) => {
                  if (Array.isArray(opts)) setSelectedWeeks(opts.map((o) => o.value as { start: string; end: string }));
                  else if (opts && typeof opts === 'object') setSelectedWeeks([opts.value as { start: string; end: string }]);
                  else setSelectedWeeks([]);
                }}
                placeholder={t('reports.placeholders.selectWeekPeriods')}
                multiSelect={true}
                searchable={false}
                showSelectAll={true}
                icon={<Calendar size={16} />}
                maxVisibleTagsOverride={2}
              />
            </div>
            <div className="selection-section">
              <label className="selection-label">{t('reports.filters.payCycle')}</label>
              <CustomDropdown
                options={payCycleOptions}
                searchable={false}
                selectedOption={payCycleOptions.find((o) => o.value === payCycle) || null}
                onSelect={(opt) => {
                  if (!Array.isArray(opt) && opt && typeof opt === 'object') {
                    setPayCycle(opt.value as string);
                  } else {
                    setPayCycle('');
                  }
                }}
                placeholder={t('reports.placeholders.selectPayCycle')}
              />
            </div>
            <div className="selection-section">
              <label className="selection-label">{t('reports.filters.listName')}</label>
              <CustomDropdown
                options={listNameOptions}
                searchable={false}
                selectedOption={listNameOptions.find((o) => o.value === listName) || null}
                onSelect={(opt) => {
                  if (!Array.isArray(opt) && opt && typeof opt === 'object') {
                    setListName(opt.value as string);
                  } else {
                    setListName('');
                  }
                }}
                placeholder={t('reports.placeholders.selectListName')}
              />
            </div>
          </div>
        </div>
        {reportRows.length > 0 && (
          <div className="csv-download-section">
            <button
              className="button"
              onClick={() => {
                // Prepare CSV data to match the table exactly (order: S.No., Timesheet #, Week Period, ...)
                const csvData = reportRows.map((row, index) => {
                  const csvRow: Record<string, unknown> = {
                    [t("reports.columns.serialNumber") || "S.No."]: index + 1,
                  };
                  csvColumns.forEach(col => {
                    if (col.key === 'week_period') {
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
                  'Weekly Timesheet Report.csv',
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
                  {/* UI table: Timesheet #, Week Period, then the rest */}
                  <th>{t('reports.columns.timesheetNumber')}</th>
                  <th>{t('reports.columns.weekPeriod')}</th>
                  {tableColumns.filter(col => col.key !== 'week_period' && col.key !== 'invoice_number').map(col => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.invoice_number ? String(row.invoice_number) : ''}</td>
                    <td>{tableColumns[0].format ? tableColumns[0].format(undefined, row as unknown as Record<string, unknown>) : ''}</td>
                    {tableColumns.filter(col => col.key !== 'week_period' && col.key !== 'invoice_number').map((col, i) => {
                      const val = row[col.key as keyof typeof row];
                      const displayValue = col.format ? col.format(val) : (val !== undefined && val !== null ? String(val) : 'N/A');
                      return <td key={i}>{displayValue}</td>;
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

export default WeeklyTimesheet; 