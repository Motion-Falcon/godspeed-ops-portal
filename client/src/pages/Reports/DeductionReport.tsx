import { useEffect, useState } from "react";
import { getDeductionReport, DeductionReportFilter, DeductionReportRow } from "../../services/api/reports";
import { AppHeader } from "../../components/AppHeader";
import { Loader2, Calendar } from "lucide-react";
import "../../styles/pages/CommonReportsStyles.css";
import { exportToCSV } from '../../utils/csvExport';

// Format date utility function
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString();
};

// Define the columns for the deduction report
const TABLE_COLUMNS: { key: string; label: string; format?: (val: unknown) => string }[] = [
  { key: 'invoice_number', label: 'Invoice Number', format: (val) => String(val ?? '') },
  { key: 'client_name', label: 'Client Name', format: (val) => String(val ?? '') },
  { key: 'accounting_person', label: 'Accounting Person', format: (val) => String(val ?? '') },
  { key: 'total_amount', label: 'Total Amount', format: (val) => val ? `$${val}` : 'N/A' },
  { key: 'jobseeker_deductions', label: 'Jobseeker(s) & Deducted Amount', format: (val) => String(val ?? '') },
  { key: 'total_deductions_amount', label: 'Total Deductions Amount', format: (val) => val ? `-$${val}` : 'N/A' },
  { key: 'invoice_date', label: 'Invoice Date', format: (val) => formatDate(String(val ?? '')) },
];

// For CSV export
const CSV_COLUMNS = TABLE_COLUMNS.map(col => ({
  ...col,
  format: (val: unknown) => {
    if (col.key === 'invoice_date') {
      return formatDate(String(val ?? ''));
    }
    if (col.key === 'total_amount' || col.key === 'total_deductions_amount') {
      return val ? `$${val}` : 'N/A';
    }
    return String(val ?? '');
  }
}));

export function DeductionReport() {
  // Filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Data state
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<DeductionReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch report when filters change
  useEffect(() => {
    if (!startDate || !endDate) {
      setReportRows([]);
      return;
    }

    setLoading(true);
    setError(null);
    
    const filter: DeductionReportFilter = {
      startDate,
      endDate,
    };

    getDeductionReport(filter)
      .then(setReportRows)
      .catch((e) => setError(e.message || "Failed to fetch deduction report"))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  return (
    <div className="page-container common-report-container">
      <AppHeader title="Deduction Report" />
      <div className="common-report-card">
        <div className="timesheet-selection-bar">
          <div className="selection-row">
            <div className="selection-section">
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
            <div className="selection-section">
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
                  'Deduction Report.csv',
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
            <div className="empty-state">No deduction data found for selected date range.</div>
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

export default DeductionReport; 