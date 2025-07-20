import { useEffect, useState } from "react";
import { getRateListReport, RateListFilter, RateListRow } from "../../services/api/reports";
import { getClients, ClientData } from "../../services/api/client";
import { AppHeader } from "../../components/AppHeader";
import { CustomDropdown, DropdownOption } from "../../components/CustomDropdown";
import { Loader2, Building } from "lucide-react";
import "../../styles/pages/CommonReportsStyles.css";
import { exportToCSV } from '../../utils/csvExport';

// Define the columns for the rate list report
const TABLE_COLUMNS: { key: string; label: string; format?: (val: unknown) => string }[] = [
  { key: 'client_name', label: 'Client Name', format: (val) => String(val ?? '') },
  { key: 'position_details', label: 'Position Details', format: (val) => String(val ?? '') },
  { key: 'position_category', label: 'Position Category', format: (val) => String(val ?? '') },
  { key: 'bill_rate', label: 'Bill Rate', format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'pay_rate', label: 'Pay Rate', format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'overtime_hours', label: 'Overtime after how many hours', format: (val) => val !== undefined && val !== 'N/A' ? `${val} hrs` : String(val ?? '') },
  { key: 'overtime_bill_rate', label: 'Overtime Bill Rate', format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'overtime_pay_rate', label: 'Overtime Pay Rate', format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
];

// For CSV export
const CSV_COLUMNS = TABLE_COLUMNS.map(col => ({
  ...col,
  format: (val: unknown) => {
    if (col.key === 'bill_rate' || col.key === 'pay_rate' || col.key === 'overtime_bill_rate' || col.key === 'overtime_pay_rate') {
      return val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '');
    }
    if (col.key === 'overtime_hours') {
      return val !== undefined && val !== 'N/A' ? `${val} hrs` : String(val ?? '');
    }
    return String(val ?? '');
  }
}));

export function RateList() {
  // Filter state
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClients, setSelectedClients] = useState<ClientData[]>([]);
  const [clientLoading, setClientLoading] = useState(false);

  // Data state
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<RateListRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients on mount
  useEffect(() => {
    setClientLoading(true);
    getClients({ limit: 10000 })
      .then((res) => {
        setClients(res.clients);
      })
      .catch(() => setClients([]))
      .finally(() => setClientLoading(false));
  }, []);

  // Fetch report when filters change
  useEffect(() => {
    // Only fetch if clients are selected
    if (selectedClients.length === 0) {
      setReportRows([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    
    const filter: RateListFilter = {
      clientIds: selectedClients.map((c) => c.id ?? ""),
    };

    getRateListReport(filter)
      .then(setReportRows)
      .catch((e) => setError(e.message || "Failed to fetch rate list"))
      .finally(() => setLoading(false));
  }, [selectedClients]);

  // Dropdown options for clients
  const clientOptions: DropdownOption[] = clients.map((c) => ({
    id: c.id ?? "",
    label: c.companyName || "Unknown",
    sublabel: c.shortCode || "",
    value: c,
  }));

  return (
    <div className="page-container common-report-container">
      <AppHeader title="Rate List" />
      <div className="common-report-card">
        <div className="timesheet-selection-bar">
          <div className="selection-row">
            <div className="selection-section client-section">
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
                  maxVisibleTagsOverride={13}
                />
              )}
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
                    const val = row[col.key as keyof typeof row];
                    csvRow[col.label] = col.format ? col.format(val) : (val !== undefined && val !== null ? String(val) : 'N/A');
                  });
                  return csvRow;
                });
                exportToCSV(
                  csvData,
                  'Rate List.csv',
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
            <div className="empty-state">No rate data found for selected filters.</div>
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

export default RateList; 