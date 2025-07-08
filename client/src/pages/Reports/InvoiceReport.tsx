import { useEffect, useState } from "react";
import { getInvoiceReport, InvoiceReportFilter, InvoiceReportRow } from "../../services/api/reports";
import { getClients, ClientData } from "../../services/api/client";
import { AppHeader } from "../../components/AppHeader";
import { CustomDropdown, DropdownOption } from "../../components/CustomDropdown";
import { Loader2, Calendar, Building } from "lucide-react";
import { BackendClientData } from "../ClientManagement/ClientManagement";
import "../../styles/pages/CommonReportsStyles.css";
import { exportToCSV } from '../../utils/csvExport';

// Format date utility function
const formatDate = (dateString: string | undefined) => {
  if (!dateString || dateString === "N/A") return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
};

// Define the columns for the invoice report
const TABLE_COLUMNS: { key: string; label: string; format?: (val: unknown) => string }[] = [
  { key: 'invoice_number', label: 'Invoice Number', format: (val) => String(val ?? '') },
  { key: 'client_name', label: 'Client Name', format: (val) => String(val ?? '') },
  { key: 'contact_person', label: 'Contact Person', format: (val) => String(val ?? '') },
  { key: 'terms', label: 'Terms', format: (val) => String(val ?? '') },
  { key: 'invoice_date', label: 'Invoice Date', format: (val) => formatDate(String(val ?? '')) },
  { key: 'due_date', label: 'Due Date', format: (val) => formatDate(String(val ?? '')) },
  { key: 'total_amount', label: 'Total Amount', format: (val) => val ? `$${val}` : 'N/A' },
  { key: 'currency', label: 'Currency', format: (val) => String(val ?? '') },
  { key: 'email_sent', label: 'Email Sent', format: (val) => String(val ?? '') },
  { key: 'email_sent_date', label: 'Email Sent Date', format: (val) => formatDate(String(val ?? '')) },
];

// For CSV export
const CSV_COLUMNS = TABLE_COLUMNS.map(col => ({
  ...col,
  format: (val: unknown) => {
    if (col.key === 'invoice_date' || col.key === 'due_date' || col.key === 'email_sent_date') {
      return formatDate(String(val ?? ''));
    }
    if (col.key === 'total_amount') {
      return val ? `$${val}` : 'N/A';
    }
    return String(val ?? '');
  }
}));

export function InvoiceReport() {
  // Filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClients, setSelectedClients] = useState<ClientData[]>([]);

  // Data state
  const [clientLoading, setClientLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<InvoiceReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients on mount
  useEffect(() => {
    setClientLoading(true);
    getClients({ limit: 10000 })
      .then((res) => {
        // Map backend fields to frontend fields (camelCase) using BackendClientData
        const convertedClients = (res.clients as BackendClientData[]).map((client: BackendClientData) => ({
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
      })
      .catch(() => setClients([]))
      .finally(() => setClientLoading(false));
  }, []);

  // Fetch report when filters change
  useEffect(() => {
    if (!startDate || !endDate) {
      setReportRows([]);
      return;
    }

    setLoading(true);
    setError(null);
    
    const filter: InvoiceReportFilter = {
      startDate,
      endDate,
      clientIds: selectedClients.length > 0 ? selectedClients.map((c) => c.id ?? "") : undefined,
    };

    getInvoiceReport(filter)
      .then(setReportRows)
      .catch((e) => setError(e.message || "Failed to fetch invoice report"))
      .finally(() => setLoading(false));
  }, [startDate, endDate, selectedClients]);

  // Dropdown options
  const clientOptions: DropdownOption[] = clients.map((c) => ({
    id: c.id ?? "",
    label: c.companyName || "Unknown",
    sublabel: c.shortCode || "",
    value: c,
  }));

  return (
    <div className="page-container common-report-container">
      <AppHeader title="Invoice Report" />
      <div className="common-report-card">
        <div className="timesheet-selection-bar">
          <div className="selection-row">
            <div className="selection-section date-input-container">
              <label 
                className="selection-label"
                htmlFor="start-date-input"
                onClick={() => document.getElementById('start-date-input')?.focus()}
              >
                <Calendar size={16} />
                Start Date
              </label>
              <input
                id="start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="invoice-date-input"
              />
            </div>
            <div className="selection-section date-input-container">
              <label 
                className="selection-label"
                htmlFor="end-date-input"
                onClick={() => document.getElementById('end-date-input')?.focus()}
              >
                <Calendar size={16} />
                End Date
              </label>
              <input
                id="end-date-input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="invoice-date-input"
              />
            </div>
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
                  placeholder="Select clients (optional)..."
                  multiSelect={true}
                  showSelectAll={true}
                  icon={<Building size={16} />}
                  emptyMessage="No clients found"
                  maxVisibleTagsOverride={3}
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
                  'Invoice Report.csv',
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
            <div className="empty-state">No invoice data found for selected date range.</div>
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

export default InvoiceReport; 