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
import { formatDate as formatWeekDate } from "../TimesheetManagement/functions/weekUtils";
import { PAY_CYCLES } from "../../constants/formOptions";
import { exportToCSV } from "../../utils/csvExport";
import { getDropdownOptions } from "../../services/api/dropdownOptions";
import { useColumnSearch } from "../../hooks/useColumnSearch";
import { ReportTableToolbar } from "../../components/ReportTableToolbar";
import { ColumnSearchInput } from "../../components/ColumnSearchInput";

const formatCurrency = (value: unknown): string => {
  if (value === undefined || value === null || value === "" || value === "N/A") {
    return "N/A";
  }

  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return `$${numericValue.toFixed(2)}`;
};

const formatPhoneNumber = (value: unknown): string => {
  const phone = String(value ?? "").trim();
  if (!phone) return "";

  const digits = phone.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(
      7,
      11
    )}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(
      6,
      10
    )}`;
  }

  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}`;
  }

  return phone;
};

const getTableColumns = (
  t: (key: string) => string
): {
  key: keyof EnvelopePrintingReportRow | "report_generated_date";
  label: string;
  format?: (val: unknown, row?: EnvelopePrintingReportRow) => string;
}[] => [
  { key: "sequence_number", label: t("reports.columns.sequenceNumber") || "#" },
  { key: "sr_no", label: t("reports.columns.srNo") || "SR. NO." },
  { key: "invoice_number", label: t("reports.columns.invoiceNumber") },
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
  {
    key: "phone_number",
    label: t("reports.columns.phoneNumber"),
    format: (val) => formatPhoneNumber(val),
  },
  { key: "email_id", label: t("reports.columns.emailId") },
  {
    key: "billing_email",
    label: t("reports.columns.billingEmail"),
    format: (val, row) => {
      const billing = String(val ?? "").trim();
      if (billing) return billing;
      return String(row?.email_id ?? "").trim();
    },
  },
  { key: "pay_method", label: t("reports.columns.payMethod") },
  { key: "position_category", label: t("reports.columns.positionCategory") },
  { key: "position_name", label: t("reports.columns.positionName") },
  { key: "hours", label: t("reports.columns.hours") },
  { key: "overtime_hours", label: t("reports.columns.overtimeHours") },
  {
    key: "regular_pay_rate",
    label: t("reports.columns.regularPay"),
    format: (val) => formatCurrency(val),
  },
  {
    key: "premium_pay_rate",
    label: t("reports.columns.premiumPayRate"),
    format: (val) => formatCurrency(val),
  },
  {
    key: "overtime_pay_rate",
    label: t("reports.columns.overtimePayRate"),
    format: (val) => formatCurrency(val),
  },
  {
    key: "total_amount",
    label: t("reports.columns.totalAmount"),
    format: (val) => formatCurrency(val),
  },
  {
    key: "tax_rate",
    label: t("reports.columns.taxRate"),
    format: (val) =>
      val !== undefined && val !== null && val !== "" && val !== "N/A"
        ? `${Number.parseFloat(String(val)).toFixed(2)}%`
        : String(val ?? ""),
  },
  {
    key: "hst_gst",
    label: t("reports.columns.hstGst"),
    format: (val) => formatCurrency(val),
  },
  {
    key: "line_amount",
    label: t("reports.columns.lineAmount") || "Line Amount",
    format: (val) => formatCurrency(val),
  },
  {
    key: "invoice_date",
    label: t("reports.columns.invoiceDate"),
    format: (val) => {
      const s = String(val ?? "").trim();
      if (!s) return "";
      return formatWeekDate(s);
    },
  },
  {
    key: "payment_due_date",
    label: t("reports.columns.paymentDueDate"),
    format: (val) => {
      const s = String(val ?? "").trim();
      if (!s) return "";
      return formatWeekDate(s);
    },
  },
  { key: "currency", label: t("reports.columns.currency") },
  {
    key: "report_generated_date",
    label: t("reports.columns.reportGeneratedDate") || "Report Generated Date",
    format: () => new Date().toLocaleDateString(),
  },
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
  const [availableListNames, setAvailableListNames] = useState<string[]>([]);
  const [selectedListNames, setSelectedListNames] = useState<string[]>([]);
  const [selectedPayCycles, setSelectedPayCycles] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>(defaultDates.startDate);
  const [endDate, setEndDate] = useState<string>(defaultDates.endDate);
  const [clientLoading, setClientLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<EnvelopePrintingReportRow[]>([]);
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
    if (columnKey === 'report_generated_date') return new Date().toLocaleDateString();
    const colDef = tableColumns.find(c => c.key === columnKey);
    const val = row[columnKey as keyof EnvelopePrintingReportRow];
    return colDef?.format ? colDef.format(val, row) : String(val ?? '');
  });

  useEffect(() => {
    setClientLoading(true);
    getClients({ limit: 10000 })
      .then((res) => {
        setClients(res.clients);
      })
      .catch(() => setClients([]))
      .finally(() => setClientLoading(false));
  }, []);

  useEffect(() => {
    getDropdownOptions('list_name')
      .then((opts) => {
        const names = opts.map((o) => o.name);
        setAvailableListNames(names);
      })
      .catch(() => setAvailableListNames([]));
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
    isInactive: c.isInactive,
  }));

  const listNameOptions: DropdownOption[] = availableListNames.map((ln) => ({
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
                searchable={true}
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
          <ReportTableToolbar
            hasActiveFilters={hasActiveFilters}
            totalCount={totalCount}
            filteredCount={filteredCount}
            onClearSearch={clearAllFilters}
            onDownloadCSV={() => {
              const reportGeneratedDate = new Date().toLocaleDateString();
              const sortedRows = [...searchedReportRows].sort((a, b) => {
                const clientA = (a.client_name || "").toLowerCase();
                const clientB = (b.client_name || "").toLowerCase();
                if (clientA < clientB) return -1;
                if (clientA > clientB) return 1;
                const nameA = (a.jobseeker_name || "").toLowerCase();
                const nameB = (b.jobseeker_name || "").toLowerCase();
                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return 0;
              });
              const csvData = sortedRows.map((row, index) => {
                const newSequenceNumber = index + 1;
                const newSrNo = row.sr_no
                  ? `${row.sr_no.substring(0, row.sr_no.lastIndexOf('-') + 1)}${String(newSequenceNumber).padStart(3, '0')}`
                  : `NA-NA-${String(newSequenceNumber).padStart(3, '0')}`;

                const csvRow: Record<string, unknown> = {};
                csvColumns.forEach((col) => {
                  if (col.key === "report_generated_date") return;
                  let val: unknown = row[col.key as keyof EnvelopePrintingReportRow];
                  if (col.key === "sequence_number") {
                    val = newSequenceNumber;
                  } else if (col.key === "sr_no") {
                    val = newSrNo;
                  }
                  csvRow[col.label] = col.format
                    ? col.format(val, row)
                    : val !== undefined && val !== null
                    ? String(val)
                    : "N/A";
                });
                // Add report generated date at the end
                csvRow[
                  t("reports.columns.reportGeneratedDate") ||
                    "Report Generated Date"
                ] = reportGeneratedDate;
                return csvRow;
              });
              exportToCSV(csvData, "Envelope Printing Report.csv", [
                ...csvColumns
                  .filter((col) => col.key !== "report_generated_date")
                  .map((col) => col.label),
                t("reports.columns.reportGeneratedDate") ||
                  "Report Generated Date",
              ]);
            }}
          />
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
                      {t("reports.states.noMatchingRecords") || "No matching records found."}
                    </td>
                  </tr>
                ) : (
                  searchedReportRows.map((row, idx) => (
                    <tr key={idx} className={(row.client_is_inactive || row.jobseeker_is_inactive) ? 'inactive-row' : ''}>
                      {tableColumns.map((col, i) => {
                        let displayValue: string;
                        if (col.key === "report_generated_date") {
                          displayValue = new Date().toLocaleDateString();
                        } else {
                          const val =
                            row[col.key as keyof EnvelopePrintingReportRow];
                          displayValue = col.format
                            ? col.format(val, row)
                            : val !== undefined && val !== null
                            ? String(val)
                            : "N/A";
                        }
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
