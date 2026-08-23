import { useEffect, useState } from "react";
import { getTimesheetReport, TimesheetReportFilter, TimesheetReportRow } from "../../services/api/reports";
import { getJobseekerProfiles } from "../../services/api/jobseeker";
import { getClients, ClientData } from "../../services/api/client";
import { AppHeader } from "../../components/AppHeader";
import { CustomDropdown, DropdownOption } from "../../components/CustomDropdown";
import { useLanguage } from "../../contexts/language/language-provider";
import { Loader2, Calendar, User, Building } from "lucide-react";
import { JobSeekerProfile } from "../../types/jobseeker";
import { generateWeekOptions, formatDate as formatWeekDate } from "../TimesheetManagement/functions/weekUtils";
import { PAY_CYCLES } from "../../constants/formOptions";
import "../../styles/pages/CommonReportsStyles.css";
import { exportToCSV } from '../../utils/csvExport';
import { getDropdownOptions } from '../../services/api/dropdownOptions';

import { useColumnSearch } from "../../hooks/useColumnSearch";
import { ReportTableToolbar } from "../../components/ReportTableToolbar";
import { ColumnSearchInput } from "../../components/ColumnSearchInput";


// Define the columns and headers as used in the UI table and CSV export (matching old CSV structure)
const getTableColumns = (_t: (key: string) => string): { key: string; label: string; format?: (val: unknown, row?: Record<string, unknown>, index?: number) => string }[] => [
  { key: 'sr_no', label: 'Sr.', format: (_val, _row, index) => String((index ?? 0) + 1) },
  { key: 'employee_id', label: 'Jobseeker #', format: (val) => val ? `#${val}` : '' },
  { key: 'license_passport', label: 'Driver License/Passport No.', format: (_val, row) => (row as any)?.license_number || (row as any)?.passport_number || 'N/A' },
  { key: 'name', label: 'Jobseeker Name', format: (val) => String(val ?? '') },
  { key: 'mobile', label: 'Mobile', format: (val) => String(val ?? '') },
  { key: 'email', label: 'Email', format: (val) => String(val ?? '') },
  { key: 'company_name', label: 'Customer', format: (val) => String(val ?? '') },
  { key: 'list_name', label: 'List Name', format: (val) => String(val ?? '') },
  { key: 'title', label: 'Position details', format: (val, row) => {
    const code = (row as any)?.position_code;
    return val ? `${val}${code ? ` [#${code}]` : ''}` : '';
  } },
  { key: 'position_category', label: 'Position Category', format: (val) => String(val ?? '') },
  { key: 'client_manager', label: 'Client Manager', format: (val) => String(val ?? '') },
  { key: 'week_period', label: 'Date', format: (_val, row) => {
    if (row && typeof row === 'object' && 'week_start_date' in row && 'week_end_date' in row) {
      return `${formatWeekDate(String((row as Record<string, unknown>).week_start_date))} - ${formatWeekDate(String((row as Record<string, unknown>).week_end_date))}`;
    }
    return '';
  } },
  { key: 'total_regular_hours', label: 'Reg. Hrs.', format: (val) => String(val ?? '0') },
  { key: 'total_overtime_hours', label: 'OT. Hrs', format: (val) => String(val ?? '0') },
  { key: 'regular_pay_rate', label: 'Reg. Pay', format: (val) => val !== undefined && val !== null && val !== 'N/A' && val !== '' ? `$${val}` : '$0.00' },
  { key: 'overtime_pay_rate', label: 'OT Pay', format: (val) => val !== undefined && val !== null && val !== 'N/A' && val !== '' ? `$${val}` : '$0.00' },
  { key: 'sub_total', label: 'Sub Total', format: (_val, row) => {
    const regHrs = Number((row as any)?.total_regular_hours || 0);
    const regPay = Number((row as any)?.regular_pay_rate || 0);
    const otHrs = Number((row as any)?.total_overtime_hours || 0);
    const otPay = Number((row as any)?.overtime_pay_rate || 0);
    const sub = (regHrs * regPay) + (otHrs * otPay);
    return `$${sub.toFixed(2)}`;
  } },
  { key: 'bonus_amount', label: 'Bonus', format: (val) => val !== undefined && val !== null && val !== 'N/A' && val !== '' && Number(val) > 0 ? `+$${val}` : '$0.00' },
  { key: 'deduction_amount', label: 'Deductions', format: (val) => val !== undefined && val !== null && val !== 'N/A' && val !== '' && Number(val) > 0 ? `-$${val}` : '$0.00' },
  { key: 'hst_gst', label: 'HST', format: (val) => val !== undefined && val !== null && val !== 'N/A' && val !== '' ? `${val}%` : 'N/A' },
  { key: 'total_jobseeker_pay', label: 'Total Pay', format: (val) => val !== undefined && val !== null && val !== 'N/A' && val !== '' ? `$${val}` : '$0.00' },
  { key: 'status', label: 'Status', format: (_val, row) => {
    const clientStatus = (row as any)?.client_is_inactive ? 'Client Inactive' : 'Client Active';
    const jsStatus = (row as any)?.jobseeker_is_inactive ? 'JS Inactive' : 'JS Active';
    return `${clientStatus} / ${jsStatus}`;
  } },
  { key: 'on_hold', label: 'On Hold', format: () => '' },
  { key: 'payment_method', label: 'Payment Method', format: (val) => String(val ?? 'N/A') },
  { key: 'pay_cycle', label: 'Pay Cycle', format: (val) => String(val ?? 'N/A') },
  { key: 'sin_hours', label: 'SIN Hrs', format: (_val, row) => {
    const pm = String((row as any)?.payment_method || '').toLowerCase();
    if (pm.includes('sin')) return String((row as any)?.total_regular_hours || '0');
    return '0';
  } },
  { key: 'cash_hours', label: 'Cash Hrs', format: (_val, row) => {
    const pm = String((row as any)?.payment_method || '').toLowerCase();
    if (pm.includes('cash')) return String((row as any)?.total_regular_hours || '0');
    return '0';
  } },
  { key: 'notes', label: 'Notes', format: (val) => String(val ?? '') },
  { key: 'supporting_document', label: 'Supporting Document', format: () => '' },
  { key: 'remarks', label: 'Remarks', format: () => '' },
];

const getCsvColumns = (tableColumns: ReturnType<typeof getTableColumns>) => [
  ...tableColumns
];

export function WeeklyTimesheet() {
  const { t } = useLanguage();
  const tableColumns = getTableColumns(t);
  const csvColumns = getCsvColumns(tableColumns);
  // Filter state
  const [jobseekers, setJobseekers] = useState<JobSeekerProfile[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedJobseekers, setSelectedJobseekers] = useState<JobSeekerProfile[]>([]);
  const [selectedClients, setSelectedClients] = useState<ClientData[]>([]);
  const [weekOptions, setWeekOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedWeeks, setSelectedWeeks] = useState<Array<{ start: string; end: string }>>([]);
  const [selectedPayCycles, setSelectedPayCycles] = useState<string[]>([]);
  const [selectedListNames, setSelectedListNames] = useState<string[]>([]);
  const [availableListNames, setAvailableListNames] = useState<string[]>([]);

  // Data state
  const [jobseekerLoading, setJobseekerLoading] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<TimesheetReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    columnFilters,
    setColumnFilter,
    clearAllFilters,
    hasActiveFilters,
    filteredData: searchedReportRows,
    totalCount,
    filteredCount,
  } = useColumnSearch(reportRows, (row, columnKey) => {
    const colDef = tableColumns.find(c => c.key === columnKey);
    const val = row[columnKey as keyof TimesheetReportRow];
    return colDef?.format ? colDef.format(val, row as unknown as Record<string, unknown>) : String(val ?? '');
  });

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

  // Fetch list names from DB on mount
  useEffect(() => {
    getDropdownOptions('list_name')
      .then((opts) => setAvailableListNames(opts.map((o) => o.name)))
      .catch(() => setAvailableListNames([]));
  }, []);

  // Fetch report when filters change
  useEffect(() => {
    if (selectedJobseekers.length === 0 || selectedWeeks.length === 0) {
      setReportRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    const filter: TimesheetReportFilter = {
      jobseekerIds: selectedJobseekers.map(j => j.id ?? ""),
      clientIds: selectedClients.map((c) => c.id ?? ""),
      weekPeriods: selectedWeeks,
      payCycles: selectedPayCycles,
      listNames: selectedListNames,
    };
    getTimesheetReport(filter)
      .then(setReportRows)
      .catch((e) => setError(e.message || "Failed to fetch report"))
      .finally(() => setLoading(false));
  }, [selectedJobseekers, selectedClients, selectedWeeks, selectedPayCycles, selectedListNames]);

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
      isInactive: j.isInactive,
    };
  });
  const clientOptions: DropdownOption[] = clients.map((c) => ({
    id: c.id ?? "",
    label: c.companyName || "Unknown",
    sublabel: c.shortCode || "",
    value: c,
    isInactive: c.isInactive,
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
  const payCycleOptions: DropdownOption[] = PAY_CYCLES.map((pc) => ({ id: pc, label: pc, value: pc }));
  const listNameOptions: DropdownOption[] = availableListNames.map((ln) => ({ id: ln, label: ln, value: ln }));

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
                  selectedOptions={selectedJobseekers.length > 0 ? (selectedJobseekers.map((j) => jobseekerOptions.find((o) => o.id === j.id) as DropdownOption).filter(Boolean)) : []}
                  onSelect={(opts) => {
                    if (Array.isArray(opts)) setSelectedJobseekers(opts.map((o) => o.value as JobSeekerProfile));
                    else if (opts && typeof opts === 'object') setSelectedJobseekers([opts.value as JobSeekerProfile]);
                    else setSelectedJobseekers([]);
                  }}
                  placeholder={t('reports.placeholders.selectJobSeeker')}
                  multiSelect={true}
                  showSelectAll={true}
                  icon={<User size={16} />}
                  emptyMessage={t('reports.emptyMessages.noJobSeekers')}
                  maxVisibleTagsOverride={2}
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
                selectedOptions={selectedPayCycles.length > 0 ? (selectedPayCycles.map((pc) => payCycleOptions.find((o) => o.value === pc) as DropdownOption).filter(Boolean)) : []}
                onSelect={(opts) => {
                  if (Array.isArray(opts)) setSelectedPayCycles(opts.map((o) => o.value as string));
                  else if (opts && typeof opts === 'object') setSelectedPayCycles([opts.value as string]);
                  else setSelectedPayCycles([]);
                }}
                placeholder={t('reports.placeholders.selectPayCycle')}
                multiSelect={true}
                showSelectAll={true}
                maxVisibleTagsOverride={2}
              />
            </div>
            <div className="selection-section">
              <label className="selection-label">{t('reports.filters.listName')}</label>
              <CustomDropdown
                options={listNameOptions}
                searchable={false}
                selectedOptions={selectedListNames.length > 0 ? (selectedListNames.map((ln) => listNameOptions.find((o) => o.value === ln) as DropdownOption).filter(Boolean)) : []}
                onSelect={(opts) => {
                  if (Array.isArray(opts)) setSelectedListNames(opts.map((o) => o.value as string));
                  else if (opts && typeof opts === 'object') setSelectedListNames([opts.value as string]);
                  else setSelectedListNames([]);
                }}
                placeholder={t('reports.placeholders.selectListName')}
                multiSelect={true}
                showSelectAll={true}
                maxVisibleTagsOverride={2}
              />
            </div>
          </div>
        </div>
        {reportRows.length > 0 && (
          <ReportTableToolbar
            hasActiveFilters={hasActiveFilters}
            totalCount={totalCount}
            filteredCount={filteredCount}
            onClearSearch={clearAllFilters}
            onDownloadCSV={() => {
              const csvData = searchedReportRows.map((row, index) => {
                const csvRow: Record<string, unknown> = {};
                csvColumns.forEach(col => {
                  const val = row[col.key as keyof typeof row];
                  csvRow[col.label] = col.format ? col.format(val, row as unknown as Record<string, unknown>, index) : (val !== undefined && val !== null ? String(val) : 'N/A');
                });
                return csvRow;
              });
              exportToCSV(
                csvData,
                'Weekly Timesheet Report.csv',
                csvColumns.map(col => col.label)
              );
            }}
          />
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
                    <th key={col.key} className="th-header-cell">
                      <div className="column-header-content">
                        <span className="column-header-title">{col.label}</span>
                        <ColumnSearchInput
                          value={columnFilters[col.key] || ''}
                          onChange={(val) => setColumnFilter(col.key, val)}
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {searchedReportRows.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumns.length} className="empty-table-cell">
                      {t('reports.states.noMatchingRecords') || 'No matching records found.'}
                    </td>
                  </tr>
                ) : (
                  searchedReportRows.map((row, idx) => (
                    <tr key={idx} className={(row.client_is_inactive || row.jobseeker_is_inactive) ? 'inactive-row' : ''}>
                      {tableColumns.map((col, i) => {
                        const val = row[col.key as keyof typeof row];
                        const displayValue = col.format ? col.format(val, row as unknown as Record<string, unknown>) : (val !== undefined && val !== null ? String(val) : 'N/A');
                        return <td key={i}>{displayValue}</td>;
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default WeeklyTimesheet; 