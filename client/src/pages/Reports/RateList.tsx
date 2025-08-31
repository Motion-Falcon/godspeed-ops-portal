import { useEffect, useState } from "react";
import { getRateListReport, RateListFilter, RateListRow } from "../../services/api/reports";
import { getClients, ClientData } from "../../services/api/client";
import { AppHeader } from "../../components/AppHeader";
import { CustomDropdown, DropdownOption } from "../../components/CustomDropdown";
import { useLanguage } from "../../contexts/language/language-provider";
import { Loader2, Building } from "lucide-react";
import "../../styles/pages/CommonReportsStyles.css";
import { exportToCSV } from '../../utils/csvExport';

// Define the columns for the rate list report
const getTableColumns = (t: (key: string) => string): { key: string; label: string; format?: (val: unknown) => string }[] => [
  { key: 'client_name', label: t('reports.columns.clientName'), format: (val) => String(val ?? '') },
  { key: 'position_details', label: t('reports.columns.positionDetails'), format: (val) => String(val ?? '') },
  { key: 'position_category', label: t('reports.columns.positionCategory'), format: (val) => String(val ?? '') },
  { key: 'bill_rate', label: t('reports.columns.billRate'), format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'pay_rate', label: t('reports.columns.payRate'), format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'overtime_hours', label: t('reports.columns.overtimeAfterHours'), format: (val) => val !== undefined && val !== 'N/A' ? `${val} hrs` : String(val ?? '') },
  { key: 'overtime_bill_rate', label: t('reports.columns.overtimeBillRateCol'), format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
  { key: 'overtime_pay_rate', label: t('reports.columns.overtimePayRate'), format: (val) => val !== undefined && val !== 'N/A' ? `$${val}` : String(val ?? '') },
];

// For CSV export
const getCsvColumns = (tableColumns: ReturnType<typeof getTableColumns>) => tableColumns.map(col => ({
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
  const { t } = useLanguage();
  const tableColumns = getTableColumns(t);
  const csvColumns = getCsvColumns(tableColumns);
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
      <AppHeader title={t('reports.types.rateList.title')} />
      <div className="common-report-card">
        <div className="timesheet-selection-bar">
          <div className="selection-row">
            <div className="selection-section client-section">
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
                  csvColumns.forEach(col => {
                    const val = row[col.key as keyof typeof row];
                    csvRow[col.label] = col.format ? col.format(val) : (val !== undefined && val !== null ? String(val) : 'N/A');
                  });
                  return csvRow;
                });
                exportToCSV(
                  csvData,
                  'Rate List.csv',
                  csvColumns.map(col => col.label)
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
            <div className="empty-state">{t('reports.states.noRateData')}</div>
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