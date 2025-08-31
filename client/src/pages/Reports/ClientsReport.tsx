import { useEffect, useState } from "react";
import { getClientsReport, ClientsReportFilter, ClientsReportRow } from "../../services/api/reports";
import { AppHeader } from "../../components/AppHeader";
import { CustomDropdown, DropdownOption } from "../../components/CustomDropdown";
import { useLanguage } from "../../contexts/language/language-provider";
import { Loader2, User, CreditCard, FileText } from "lucide-react";
import "../../styles/pages/CommonReportsStyles.css";
import { exportToCSV } from '../../utils/csvExport';
import { PAYMENT_METHODS, PAYMENT_TERMS } from "../../constants/formOptions";

// Define the columns for the clients report
const getTableColumns = (t: (key: string) => string): { key: string; label: string; format?: (val: unknown) => string; className?: string }[] => [
  { key: 'company_name', label: t('reports.columns.companyName'), format: (val) => String(val ?? '') },
  { key: 'billing_name', label: t('reports.columns.billingName'), format: (val) => String(val ?? '') },
  { key: 'short_code', label: t('reports.columns.shortCode'), format: (val) => String(val ?? '') },
  { key: 'list_name', label: t('reports.columns.listName'), format: (val) => String(val ?? '') },
  { key: 'accounting_person', label: t('reports.columns.accountingPerson'), format: (val) => String(val ?? '') },
  { key: 'sales_person', label: t('reports.columns.salesPersonCol'), format: (val) => String(val ?? '') },
  { key: 'client_manager', label: t('reports.columns.clientManager'), format: (val) => String(val ?? '') },
  { key: 'contact_person_name1', label: t('reports.columns.contactPersonName'), format: (val) => String(val ?? '') },
  { key: 'email_address1', label: t('reports.columns.emailAddress'), format: (val) => String(val ?? '') },
  { key: 'mobile1', label: t('reports.columns.mobile'), format: (val) => String(val ?? '') },
  { 
    key: 'address', 
    label: t('reports.columns.address'), 
    format: (val) => String(val ?? ''),
    className: 'address-column'
  },
  { key: 'preferred_payment_method', label: t('reports.columns.preferredPaymentMethod'), format: (val) => String(val ?? '') },
  { key: 'pay_cycle', label: t('reports.columns.paymentCycle'), format: (val) => String(val ?? '') },
  { key: 'terms', label: t('reports.columns.terms'), format: (val) => String(val ?? '') },
  { 
    key: 'notes', 
    label: t('reports.columns.notes'), 
    format: (val) => String(val ?? ''),
    className: 'notes-column'
  },
];

// For CSV export
const getCsvColumns = (tableColumns: ReturnType<typeof getTableColumns>) => tableColumns.map(col => ({
  ...col,
  format: (val: unknown) => String(val ?? ''),
}));

export function ClientsReport() {
  const { t } = useLanguage();
  const tableColumns = getTableColumns(t);
  const csvColumns = getCsvColumns(tableColumns);
  // Filter state
  const [selectedClientManagers, setSelectedClientManagers] = useState<string[]>([]);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [selectedTerms, setSelectedTerms] = useState<string[]>([]);
  const [clientManagerOptions, setClientManagerOptions] = useState<DropdownOption[]>([]);

  // Data state
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<ClientsReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Generate filter options
  const paymentMethodOptions: DropdownOption[] = PAYMENT_METHODS.map((method) => ({
    id: method,
    label: method,
    value: method,
  }));

  const termsOptions: DropdownOption[] = PAYMENT_TERMS.map((term) => ({
    id: term,
    label: term,
    value: term,
  }));

  // Set default selections (select all)
  useEffect(() => {
    setSelectedPaymentMethods(PAYMENT_METHODS.slice());
    setSelectedTerms(PAYMENT_TERMS.slice());
  }, []);

  // Fetch initial data to get client managers
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    const filter: ClientsReportFilter = {};

    getClientsReport(filter)
      .then((data) => {
        setReportRows(data);
        
        // Extract unique client managers
        const uniqueClientManagers = [...new Set(data.map(row => row.client_manager).filter(Boolean))];
        const managerOptions = uniqueClientManagers.map(manager => ({
          id: manager,
          label: manager,
          value: manager,
        }));
        setClientManagerOptions(managerOptions);
        setSelectedClientManagers(uniqueClientManagers);
      })
      .catch((e) => setError(e.message || "Failed to fetch clients report"))
      .finally(() => setLoading(false));
  }, []);

  // Fetch report when filters change
  useEffect(() => {
    if (clientManagerOptions.length === 0) return;

    setLoading(true);
    setError(null);
    
    const filter: ClientsReportFilter = {
      clientManagerIds: selectedClientManagers.length > 0 ? selectedClientManagers : undefined,
      paymentMethods: selectedPaymentMethods.length > 0 ? selectedPaymentMethods : undefined,
      terms: selectedTerms.length > 0 ? selectedTerms : undefined,
    };

    getClientsReport(filter)
      .then(setReportRows)
      .catch((e) => setError(e.message || "Failed to fetch clients report"))
      .finally(() => setLoading(false));
  }, [selectedClientManagers, selectedPaymentMethods, selectedTerms, clientManagerOptions]);

  return (
    <div className="page-container common-report-container">
      <AppHeader title={t('reports.types.clients.title')} />
      <div className="common-report-card">
        <div className="timesheet-selection-bar">
          <div className="selection-row">
            <div className="selection-section">
              <label className="selection-label">{t('reports.filters.clientManager')}</label>
              <CustomDropdown
                options={clientManagerOptions}
                selectedOptions={selectedClientManagers.length > 0 ? (selectedClientManagers.map(manager => clientManagerOptions.find(opt => opt.value === manager) as DropdownOption).filter(Boolean)) : []}
                onSelect={(opts) => {
                  if (Array.isArray(opts)) setSelectedClientManagers(opts.map(opt => opt.value as string));
                  else if (opts && typeof opts === 'object') setSelectedClientManagers([opts.value as string]);
                  else setSelectedClientManagers([]);
                }}
                placeholder={t('reports.placeholders.selectClientManagers')}
                multiSelect={true}
                showSelectAll={true}
                icon={<User size={16} />}
                emptyMessage={t('reports.emptyMessages.noClientManagers')}
                maxVisibleTagsOverride={3}
              />
            </div>
            <div className="selection-section">
              <label className="selection-label">{t('reports.filters.paymentMethod')}</label>
              <CustomDropdown
                options={paymentMethodOptions}
                selectedOptions={selectedPaymentMethods.length > 0 ? (selectedPaymentMethods.map(method => paymentMethodOptions.find(opt => opt.value === method) as DropdownOption).filter(Boolean)) : []}
                onSelect={(opts) => {
                  if (Array.isArray(opts)) setSelectedPaymentMethods(opts.map(opt => opt.value as string));
                  else if (opts && typeof opts === 'object') setSelectedPaymentMethods([opts.value as string]);
                  else setSelectedPaymentMethods([]);
                }}
                placeholder={t('reports.placeholders.selectPaymentMethods')}
                multiSelect={true}
                showSelectAll={true}
                icon={<CreditCard size={16} />}
                emptyMessage={t('reports.emptyMessages.noPaymentMethods')}
                maxVisibleTagsOverride={3}
              />
            </div>
            <div className="selection-section">
              <label className="selection-label">{t('reports.filters.terms')}</label>
              <CustomDropdown
                options={termsOptions}
                selectedOptions={selectedTerms.length > 0 ? (selectedTerms.map(term => termsOptions.find(opt => opt.value === term) as DropdownOption).filter(Boolean)) : []}
                onSelect={(opts) => {
                  if (Array.isArray(opts)) setSelectedTerms(opts.map(opt => opt.value as string));
                  else if (opts && typeof opts === 'object') setSelectedTerms([opts.value as string]);
                  else setSelectedTerms([]);
                }}
                placeholder={t('reports.placeholders.selectTerms')}
                multiSelect={true}
                showSelectAll={true}
                icon={<FileText size={16} />}
                emptyMessage={t('reports.emptyMessages.noTerms')}
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
                  'Clients Report.csv',
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
            <div className="empty-state">{t('reports.states.noClientsData')}</div>
          ) : (
            <table className="common-table">
              <thead>
                <tr>
                  {tableColumns.map(col => (
                    <th 
                      key={col.key}
                      className={col.className}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row, idx) => (
                  <tr key={idx}>
                    {tableColumns.map((col, i) => {
                      const val = row[col.key as keyof typeof row];
                      const displayValue = col.format ? col.format(val) : (val !== undefined && val !== null ? String(val) : 'N/A');
                      return (
                        <td 
                          key={i}
                          className={col.className}
                          title={col.key === 'address' || col.key === 'notes' ? displayValue : undefined}
                        >
                          {displayValue}
                        </td>
                      );
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

export default ClientsReport; 