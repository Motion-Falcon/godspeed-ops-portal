import { useEffect, useState } from "react";
import { getEnvelopePrintingReport, EnvelopePrintingReportRow } from "../../services/api/reports";
import { getClients, ClientData } from "../../services/api/client";
import { AppHeader } from "../../components/AppHeader";
import { CustomDropdown, DropdownOption } from "../../components/CustomDropdown";
import { Loader2, Calendar, Building, List, Repeat } from "lucide-react";
import { formatDate as formatWeekDate } from "../../utils/weekUtils";
import { LIST_NAMES, PAY_CYCLES } from "../../constants/formOptions";
import "../../styles/pages/CommonReportsStyles.css";
import { exportToCSV } from '../../utils/csvExport';

const TABLE_COLUMNS: { key: keyof EnvelopePrintingReportRow; label: string; format?: (val: unknown, row?: EnvelopePrintingReportRow) => string }[] = [
  { key: 'city', label: 'City' },
  { key: 'list_name', label: 'List Name' },
  { key: 'week_ending', label: 'Week Ending', format: (val) => formatWeekDate(String(val ?? '')) },
  { key: 'client_name', label: 'Client Name' },
  { key: 'sales_person', label: 'Sales Person' },
  { key: 'short_code', label: 'Short Code' },
  { key: 'work_province', label: 'Work Province' },
  { key: 'pay_cycle', label: 'Pay Cycle' },
  { key: 'jobseeker_id', label: 'Jobseeker ID' },
  { key: 'license_number', label: 'License No.' },
  { key: 'passport_number', label: 'Passport No.' },
  { key: 'jobseeker_name', label: 'Jobseeker Name' },
  { key: 'phone_number', label: 'Phone Number' },
  { key: 'email_id', label: 'Email ID' },
  { key: 'pay_method', label: 'Pay Method' },
  { key: 'position_category', label: 'Position Category' },
  { key: 'position_name', label: 'Position Name' },
  { key: 'hours', label: 'Hours' },
  { key: 'total_amount', label: 'Total Amount', format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'tax_rate', label: 'Tax Rate (%)', format: (val) => val !== undefined && val !== 'N/A' ? `${val}%` : String(val ?? '') },
  { key: 'hst_gst', label: 'HST/GST', format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'invoice_number', label: 'Invoice #' },
  { key: 'invoice_date', label: 'Invoice Date', format: (val) => formatWeekDate(String(val ?? '')) },
  { key: 'currency', label: 'Currency' },
];

const CSV_COLUMNS = [...TABLE_COLUMNS];

export function EnvelopePrintingReport() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClients, setSelectedClients] = useState<ClientData[]>([]);
  const [selectedListName, setSelectedListName] = useState<string | null>(null);
  const [selectedPayCycle, setSelectedPayCycle] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [clientLoading, setClientLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<EnvelopePrintingReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setClientLoading(true);
    getClients({ limit: 10000 })
      .then((res) => {
        const backendClients = res.clients;
        setClients(backendClients);
      })
      .catch(() => setClients([]))
      .finally(() => setClientLoading(false));
  }, []);

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
      listName: selectedListName || undefined,
      payCycle: selectedPayCycle || undefined,
    };
    getEnvelopePrintingReport(filter)
      .then(setReportRows)
      .catch((e) => setError(e.message || "Failed to fetch report"))
      .finally(() => setLoading(false));
  }, [selectedClients, startDate, endDate, selectedListName, selectedPayCycle]);

  const clientOptions: DropdownOption[] = clients.map((c) => ({
    id: c.id ?? "",
    label: c.companyName || "Unknown",
    sublabel: c.shortCode || "",
    value: c,
  }));

  const listNameOptions: DropdownOption[] = [
    { id: '', label: 'Select (None)', value: '' },
    ...LIST_NAMES.map((ln) => ({ id: ln, label: ln, value: ln })),
  ];

  const payCycleOptions: DropdownOption[] = [
    { id: '', label: 'Select (None)', value: '' },
    ...PAY_CYCLES.map((pc) => ({ id: pc, label: pc, value: pc })),
  ];

  return (
    <div className="page-container common-report-container">
      <AppHeader title="Envelope Printing (Position Details)" />
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
            </div>
          </div>
          <div className="selection-row">
            <div className="selection-section">
              <label className="selection-label">List Name</label>
              <CustomDropdown
                options={listNameOptions}
                selectedOption={selectedListName ? listNameOptions.find((o) => o.id === selectedListName) || null : null}
                onSelect={(opt) => {
                  if (!Array.isArray(opt) && opt && typeof opt === 'object' && typeof opt.value === 'string') setSelectedListName(opt.value);
                  else setSelectedListName(null);
                }}
                placeholder="Select list name..."
                searchable={false}
                icon={<List size={16} />}
                emptyMessage="No list names found"
              />
            </div>
            <div className="selection-section">
              <label className="selection-label">Pay Cycle</label>
              <CustomDropdown
                options={payCycleOptions}
                selectedOption={selectedPayCycle ? payCycleOptions.find((o) => o.id === selectedPayCycle) || null : null}
                onSelect={(opt) => {
                  if (!Array.isArray(opt) && opt && typeof opt === 'object' && typeof opt.value === 'string') setSelectedPayCycle(opt.value);
                  else setSelectedPayCycle(null);
                }}
                placeholder="Select pay cycle..."
                searchable={false}
                icon={<Repeat size={16} />}
                emptyMessage="No pay cycles found"
              />
            </div>
          </div>
        </div>
        {reportRows.length > 0 && (
          <div className="csv-download-section">
            <button
              className="button"
              onClick={() => {
                const csvData = reportRows.map(row => {
                  const csvRow: Record<string, unknown> = {};
                  CSV_COLUMNS.forEach(col => {
                    const val = row[col.key];
                    csvRow[col.label] = col.format ? col.format(val, row) : (val !== undefined && val !== null ? String(val) : 'N/A');
                  });
                  return csvRow;
                });
                exportToCSV(
                  csvData,
                  'Envelope Printing Report.csv',
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
                      const val = row[col.key];
                      const displayValue = col.format ? col.format(val, row) : (val !== undefined && val !== null ? String(val) : 'N/A');
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