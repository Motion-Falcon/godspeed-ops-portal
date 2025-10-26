import { useEffect, useState } from "react";
import {
  getEnvelopePrintingReport,
  EnvelopePrintingReportRow,
  EnvelopePrintingReportFilter,
} from "../../services/api/reports";
import { getClients, ClientData } from "../../services/api/client";
import { AppHeader } from "../../components/AppHeader";
import {
  CustomDropdown,
  DropdownOption,
} from "../../components/CustomDropdown";
import { useLanguage } from "../../contexts/language/language-provider";
import { Loader2, Calendar, Building, List, Repeat } from "lucide-react";
import { formatDate as formatWeekDate } from "../../utils/weekUtils";
import { LIST_NAMES, PAY_CYCLES } from "../../constants/formOptions";
import "../../styles/pages/CommonReportsStyles.css";
import { exportToCSV } from "../../utils/csvExport";

const getTableColumns = (
  t: (key: string) => string
): {
  key: keyof EnvelopePrintingReportRow;
  label: string;
  format?: (val: unknown, row?: EnvelopePrintingReportRow) => string;
}[] => [
  { key: "city", label: t("reports.columns.city") },
  { key: "list_name", label: t("reports.columns.listName") },
  {
    key: "week_ending",
    label: t("reports.columns.weekEnding"),
    format: (val) => formatWeekDate(String(val ?? "")),
  },
  { key: "client_name", label: t("reports.columns.clientName") },
  { key: "sales_person", label: t("reports.columns.salesPersonCol") },
  { key: "short_code", label: t("reports.columns.shortCode") },
  { key: "work_province", label: t("reports.columns.workProvince") },
  { key: "pay_cycle", label: t("reports.columns.payCycle") },
  { key: "jobseeker_id", label: t("reports.columns.jobseekerId") },
  { key: "license_number", label: t("reports.columns.licenseNumber") },
  { key: "passport_number", label: t("reports.columns.passportNumber") },
  { key: "jobseeker_name", label: t("reports.columns.jobseekerName") },
  { key: "phone_number", label: t("reports.columns.phoneNumber") },
  { key: "email_id", label: t("reports.columns.emailId") },
  { key: "pay_method", label: t("reports.columns.payMethod") },
  { key: "position_category", label: t("reports.columns.positionCategory") },
  { key: "position_name", label: t("reports.columns.positionName") },
  { key: "hours", label: t("reports.columns.hours") },
  {
    key: "total_amount",
    label: t("reports.columns.totalAmount"),
    format: (val) =>
      val !== undefined && val !== "N/A" ? `$${val}` : String(val ?? ""),
  },
  {
    key: "tax_rate",
    label: t("reports.columns.taxRate"),
    format: (val) =>
      val !== undefined && val !== "N/A" ? `${val}%` : String(val ?? ""),
  },
  {
    key: "hst_gst",
    label: t("reports.columns.hstGst"),
    format: (val) =>
      val !== undefined && val !== "N/A" ? `$${val}` : String(val ?? ""),
  },
  { key: "invoice_number", label: t("reports.columns.invoiceNumber") },
  {
    key: "invoice_date",
    label: t("reports.columns.invoiceDate"),
    format: (val) => formatWeekDate(String(val ?? "")),
  },
  { key: "currency", label: t("reports.columns.currency") },
];

const getCsvColumns = (tableColumns: ReturnType<typeof getTableColumns>) => [
  ...tableColumns,
];

export function EnvelopePrintingReport() {
  const { t } = useLanguage();
  const tableColumns = getTableColumns(t);
  const csvColumns = getCsvColumns(tableColumns);

  // Calculate default dates: end date = today, start date = 1 month ago
  const getDefaultDates = () => {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    return {
      endDate: today.toISOString().split("T")[0],
      startDate: oneMonthAgo.toISOString().split("T")[0],
    };
  };

  const defaultDates = getDefaultDates();

  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClients, setSelectedClients] = useState<ClientData[]>([]);
  const [selectedListNames, setSelectedListNames] = useState<string[]>([]);
  const [selectedPayCycles, setSelectedPayCycles] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>(defaultDates.startDate);
  const [endDate, setEndDate] = useState<string>(defaultDates.endDate);
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
        // Set default selection to all clients
        setSelectedClients(backendClients);
      })
      .catch(() => setClients([]))
      .finally(() => setClientLoading(false));
  }, []);

  // Set default selections for list names and pay cycles on component mount
  useEffect(() => {
    setSelectedListNames([...LIST_NAMES]);
    setSelectedPayCycles([...PAY_CYCLES]);
  }, []);

  useEffect(() => {
    if (selectedClients.length === 0) {
      setReportRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    const filter: EnvelopePrintingReportFilter = {
      clientIds: selectedClients.map((c) => c.id ?? ""),
      startDate,
      endDate,
      listName: selectedListNames.length > 0 ? selectedListNames : undefined,
      payCycle: selectedPayCycles.length > 0 ? selectedPayCycles : undefined,
    };
    getEnvelopePrintingReport(filter)
      .then(setReportRows)
      .catch((e) => setError(e.message || "Failed to fetch report"))
      .finally(() => setLoading(false));
  }, [
    selectedClients,
    startDate,
    endDate,
    selectedListNames,
    selectedPayCycles,
  ]);

  const clientOptions: DropdownOption[] = clients.map((c) => ({
    id: c.id ?? "",
    label: c.companyName || "Unknown",
    sublabel: c.shortCode || "",
    value: c,
  }));

  const listNameOptions: DropdownOption[] = LIST_NAMES.map((ln) => ({
    id: ln,
    label: ln,
    value: ln,
  }));

  const payCycleOptions: DropdownOption[] = PAY_CYCLES.map((pc) => ({
    id: pc,
    label: pc,
    value: pc,
  }));

  return (
    <div className="page-container common-report-container">
      <AppHeader title={t("reports.types.envelopePrinting.title")} />
      <div className="common-report-card">
        <div className="timesheet-selection-bar">
          <div className="selection-row">
            <div className="selection-section">
              <label className="selection-label">
                {t("reports.filters.clients")}
              </label>
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
                  selectedOptions={
                    selectedClients.length > 0
                      ? selectedClients
                          .map(
                            (c) =>
                              clientOptions.find(
                                (o) => o.id === c.id
                              ) as DropdownOption
                          )
                          .filter(Boolean)
                      : []
                  }
                  onSelect={(opts) => {
                    if (Array.isArray(opts))
                      setSelectedClients(
                        opts.map((o) => o.value as ClientData)
                      );
                    else if (opts && typeof opts === "object")
                      setSelectedClients([opts.value as ClientData]);
                    else setSelectedClients([]);
                  }}
                  placeholder={t("reports.placeholders.selectClients")}
                  multiSelect={true}
                  showSelectAll={true}
                  icon={<Building size={16} />}
                  emptyMessage={t("reports.emptyMessages.noClients")}
                  maxVisibleTagsOverride={4}
                />
              )}
            </div>
            <div className="selection-section date-input-wrapper">
              <div className="start-end-date-section">
                <div className="start-date-section">
                  <label
                    className="selection-label"
                    htmlFor="start-date-input"
                    onClick={() =>
                      document.getElementById("start-date-input")?.focus()
                    }
                  >
                    <Calendar size={16} /> {t("reports.filters.startDate")}
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
                  <label
                    className="selection-label"
                    htmlFor="end-date-input"
                    onClick={() =>
                      document.getElementById("end-date-input")?.focus()
                    }
                  >
                    <Calendar size={16} /> {t("reports.filters.endDate")}
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
              <p
                className="date-info-text"
                style={{
                  marginTop: "8px",
                  fontSize: "0.875rem",
                  color: "#6b7280",
                  fontStyle: "italic",
                }}
              >
                {t("reports.info.defaultDateRange") ||
                  "Default date range: Last 1 month"}
              </p>
            </div>
          </div>
          <div className="selection-row">
            <div className="selection-section">
              <label className="selection-label">
                {t("reports.filters.listName")}
              </label>
              <CustomDropdown
                options={listNameOptions}
                selectedOptions={
                  selectedListNames.length > 0
                    ? selectedListNames
                        .map(
                          (ln) =>
                            listNameOptions.find(
                              (o) => o.id === ln
                            ) as DropdownOption
                        )
                        .filter(Boolean)
                    : []
                }
                onSelect={(opts) => {
                  if (Array.isArray(opts))
                    setSelectedListNames(opts.map((o) => String(o.value)));
                  else if (opts && typeof opts === "object")
                    setSelectedListNames([String(opts.value)]);
                  else setSelectedListNames([]);
                }}
                placeholder={t("reports.placeholders.selectListName")}
                multiSelect={true}
                showSelectAll={true}
                searchable={false}
                icon={<List size={16} />}
                emptyMessage={t("reports.emptyMessages.noListNames")}
                maxVisibleTagsOverride={5}
              />
            </div>
            <div className="selection-section">
              <label className="selection-label">
                {t("reports.filters.payCycle")}
              </label>
              <CustomDropdown
                options={payCycleOptions}
                selectedOptions={
                  selectedPayCycles.length > 0
                    ? selectedPayCycles
                        .map(
                          (pc) =>
                            payCycleOptions.find(
                              (o) => o.id === pc
                            ) as DropdownOption
                        )
                        .filter(Boolean)
                    : []
                }
                onSelect={(opts) => {
                  if (Array.isArray(opts))
                    setSelectedPayCycles(opts.map((o) => String(o.value)));
                  else if (opts && typeof opts === "object")
                    setSelectedPayCycles([String(opts.value)]);
                  else setSelectedPayCycles([]);
                }}
                placeholder={t("reports.placeholders.selectPayCycle")}
                multiSelect={true}
                showSelectAll={true}
                searchable={false}
                icon={<Repeat size={16} />}
                emptyMessage={t("reports.emptyMessages.noPayCycles")}
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
                const csvData = reportRows.map((row) => {
                  const csvRow: Record<string, unknown> = {};
                  csvColumns.forEach((col) => {
                    const val = row[col.key];
                    csvRow[col.label] = col.format
                      ? col.format(val, row)
                      : val !== undefined && val !== null
                      ? String(val)
                      : "N/A";
                  });
                  return csvRow;
                });
                exportToCSV(
                  csvData,
                  "Envelope Printing Report.csv",
                  csvColumns.map((col) => col.label)
                );
              }}
            >
              {t("reports.states.downloadCSV")}
            </button>
          </div>
        )}
        <div className="report-table-container timesheet-selection-bar">
          {loading ? (
            <div className="loading-indicator">
              <Loader2 size={24} className="spin" />{" "}
              {t("reports.states.loading")}
            </div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : reportRows.length === 0 ? (
            <div className="empty-state">{t("reports.states.noDataFound")}</div>
          ) : (
            <table className="common-table">
              <thead>
                <tr>
                  {tableColumns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row, idx) => (
                  <tr key={idx}>
                    {tableColumns.map((col, i) => {
                      const val = row[col.key];
                      const displayValue = col.format
                        ? col.format(val, row)
                        : val !== undefined && val !== null
                        ? String(val)
                        : "N/A";
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
