import { Eye, Mail, Pencil, Trash2 } from "lucide-react";
import { DateRangePicker } from "../../../components/DateRangePicker";
import type { TimesheetListItem } from "../../../services/api/timesheet";
import {
  getTimesheetListClientDisplayName,
  getTimesheetListPositionDisplayName,
  type TimesheetListT,
} from "../functions/timesheetListDisplay";
import { useAuth } from "../../../contexts/AuthContext";
import { hasAnyExactAccessRole } from "../../../lib/auth";
import { DELETE_TIMESHEET_ROLES } from "../../../constants/accessControl";

const LIST_COLUMNS = 9;

interface TimesheetListRowProps {
  timesheet: TimesheetListItem;
  t: TimesheetListT;
  sendingJobseekerEmail: Record<string, boolean>;
  onSendEmail: (timesheetId: string, jobseekerName: string) => Promise<void>;
  onEditTimesheet: (timesheet: TimesheetListItem) => void;
  onViewTimesheet?: (timesheet: TimesheetListItem) => void;
  onDeleteTimesheet?: (timesheet: TimesheetListItem) => void;
}

function TimesheetListRow({
  timesheet,
  t,
  sendingJobseekerEmail,
  onSendEmail,
  onEditTimesheet,
  onViewTimesheet,
  onDeleteTimesheet,
}: TimesheetListRowProps) {
  const { user } = useAuth();
  const canDeleteTimesheet = hasAnyExactAccessRole(user, DELETE_TIMESHEET_ROLES);
  const profile = timesheet.jobseeker_profiles;
  const fullName = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
    : "Unknown";
  const email = profile?.email || "";
  const billingEmail = profile?.billing_email || "";
  const emailSent = timesheet.email_sent || false;
  const isSending = Boolean(sendingJobseekerEmail[timesheet.id || ""]);
  const weekPeriod = `${timesheet.week_start_date} - ${timesheet.week_end_date}`;

  return (
    <tr>
      <td className="invoice-number-cell" style={{ width: "90px" }}>
        # {timesheet.invoice_number}
      </td>
      <td className="client-cell">{getTimesheetListClientDisplayName(timesheet, t)}</td>
      <td className="position-cell">{getTimesheetListPositionDisplayName(timesheet, t)}</td>
      <td className="date-cell">{weekPeriod}</td>
      <td className="jobseekers-cell">
        <div className="jobseeker-row">
          <div className="jobseeker-info">
            <span className="jobseeker-name">{fullName}</span>
            <span className="jobseeker-email">{email}</span>
          </div>
        </div>
      </td>
      <td className="billing-email-cell">{billingEmail || "-"}</td>
      <td
        className="total-pay-cell"
        style={{ minWidth: "130px", textAlign: "center", fontWeight: "bold" }}
      >
        ${timesheet.total_jobseeker_pay.toFixed(2)}
      </td>
      <td className="email-status-cell" style={{ textAlign: "center" }}>
        <div className="jobseeker-actions" style={{ justifyContent: "center" }}>
          <button
            className={`button button-xs send-email-cell ${
              emailSent ? "resend-email" : "send-email"
            }`}
            type="button"
            disabled={isSending}
            onClick={() =>
              void onSendEmail(timesheet.id || "", fullName)
            }
            title={
              emailSent ? `Resend to ${fullName}` : `Send to ${fullName}`
            }
          >
            {isSending ? (
              <>
                <Mail size={14} className="mail-icon" />{" "}
                {t("bulkTimesheetManagement.email.sending")}
              </>
            ) : emailSent ? (
              <>
                <Mail size={14} className="mail-icon" />{" "}
                {t("bulkTimesheetManagement.email.resend")}
              </>
            ) : (
              <>
                <Mail size={14} className="mail-icon" />{" "}
                {t("bulkTimesheetManagement.email.sendEmail")}
              </>
            )}
          </button>
        </div>
      </td>
      <td className="actions-cell">
        <div className="action-buttons">
          <button
            className="action-icon-btn view-btn"
            type="button"
            onClick={() => onViewTimesheet?.(timesheet)}
            title={`View timesheet for ${fullName}`}
            aria-label="View Timesheet"
          >
            <Eye size={16} />
          </button>
          <button
            className="action-icon-btn edit-btn"
            type="button"
            onClick={() => onEditTimesheet(timesheet)}
            title={`Edit timesheet for ${fullName}`}
            aria-label="Edit Timesheet"
          >
            <Pencil size={16} />
          </button>
          {canDeleteTimesheet && (
            <button
              className="action-icon-btn delete-btn"
              type="button"
              onClick={() => onDeleteTimesheet?.(timesheet)}
              title={`Delete timesheet for ${fullName}`}
              aria-label="Delete Timesheet"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function SkeletonRows({ rowCount }: { rowCount: number }) {
  return (
    <>
      {Array.from({ length: rowCount }, (_, index) => (
        <tr key={`skeleton-${index}`} className="skeleton-row">
          {Array.from({ length: LIST_COLUMNS }, (_, c) => (
            <td key={c} className="skeleton-cell">
              <div className="skeleton-text"></div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

interface TimesheetListTableProps {
  t: TimesheetListT;
  loading: boolean;
  timesheets: TimesheetListItem[];
  pagination: { limit: number; total: number };
  invoiceNumberFilter: string;
  setInvoiceNumberFilter: (v: string) => void;
  clientFilter: string;
  setClientFilter: (v: string) => void;
  positionFilter: string;
  setPositionFilter: (v: string) => void;
  jobseekerFilter: string;
  setJobseekerFilter: (v: string) => void;
  billingEmailFilter: string;
  setBillingEmailFilter: (v: string) => void;
  dateRangeStart: string;
  setDateRangeStart: (v: string) => void;
  dateRangeEnd: string;
  setDateRangeEnd: (v: string) => void;
  emailSentFilter: string;
  setEmailSentFilter: (v: string) => void;
  sendingJobseekerEmail: Record<string, boolean>;
  onSendEmail: (timesheetId: string, jobseekerName: string) => Promise<void>;
  onEditTimesheet: (timesheet: TimesheetListItem) => void;
  onViewTimesheet?: (timesheet: TimesheetListItem) => void;
  onDeleteTimesheet?: (timesheet: TimesheetListItem) => void;
}

export function TimesheetListTable(props: TimesheetListTableProps) {
  const {
    t,
    loading,
    timesheets,
    pagination,
    invoiceNumberFilter,
    setInvoiceNumberFilter,
    clientFilter,
    setClientFilter,
    positionFilter,
    setPositionFilter,
    jobseekerFilter,
    setJobseekerFilter,
    billingEmailFilter,
    setBillingEmailFilter,
    dateRangeStart,
    setDateRangeStart,
    dateRangeEnd,
    setDateRangeEnd,
    emailSentFilter,
    setEmailSentFilter,
    sendingJobseekerEmail,
    onSendEmail,
    onEditTimesheet,
    onViewTimesheet,
    onDeleteTimesheet,
  } = props;

  const rowSkeletonCount = pagination.limit || 10;

  return (
    <div className="table-container">
      <table className="common-table">
        <thead>
          <tr>
            <th style={{ width: "90px" }}>
              <div className="column-filter">
                <div className="column-title">
                  {t("bulkTimesheetManagement.columns.invoiceNumber")}
                </div>
                <div className="column-search">
                  <input
                    type="text"
                    placeholder={t(
                      "bulkTimesheetManagement.placeholders.searchInvoice"
                    )}
                    value={invoiceNumberFilter}
                    onChange={(e) => setInvoiceNumberFilter(e.target.value)}
                    className="column-search-input"
                  />
                </div>
              </div>
            </th>
            <th>
              <div className="column-filter">
                <div className="column-title">
                  {t("bulkTimesheetManagement.columns.client")}
                </div>
                <div className="column-search">
                  <input
                    type="text"
                    placeholder={t(
                      "bulkTimesheetManagement.placeholders.searchClient"
                    )}
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className="column-search-input"
                  />
                </div>
              </div>
            </th>
            <th>
              <div className="column-filter">
                <div className="column-title">
                  {t("bulkTimesheetManagement.columns.position")}
                </div>
                <div className="column-search">
                  <input
                    type="text"
                    placeholder={t(
                      "bulkTimesheetManagement.placeholders.searchPosition"
                    )}
                    value={positionFilter}
                    onChange={(e) => setPositionFilter(e.target.value)}
                    className="column-search-input"
                  />
                </div>
              </div>
            </th>
            <th>
              <div className="column-filter" style={{ alignItems: "center" }}>
                <div className="column-title">
                  {t("bulkTimesheetManagement.columns.weekPeriod")}
                </div>
                <div className="column-search">
                  <DateRangePicker
                    startDate={dateRangeStart}
                    endDate={dateRangeEnd}
                    onStartChange={setDateRangeStart}
                    onEndChange={setDateRangeEnd}
                    placeholder={t("invoiceManagement.filterDateRange") || "Select Range"}
                  />
                </div>
              </div>
            </th>
            <th>
              <div className="column-filter" style={{ alignItems: "center" }}>
                <div className="column-title">
                  {t("bulkTimesheetManagement.columns.jobseekers")}
                </div>
                <div className="column-search">
                  <input
                    type="text"
                    placeholder={t(
                      "bulkTimesheetManagement.placeholders.searchJobseeker"
                    )}
                    value={jobseekerFilter}
                    onChange={(e) => setJobseekerFilter(e.target.value)}
                    className="column-search-input"
                  />
                </div>
              </div>
            </th>
            <th>
              <div className="column-filter">
                <div className="column-title">
                  {t("bulkTimesheetManagement.columns.billingEmail")}
                </div>
                <div className="column-search">
                  <input
                    type="text"
                    placeholder={t(
                      "bulkTimesheetManagement.placeholders.searchBillingEmail"
                    )}
                    value={billingEmailFilter}
                    onChange={(e) => setBillingEmailFilter(e.target.value)}
                    className="column-search-input"
                  />
                </div>
              </div>
            </th>
            <th style={{ minWidth: "130px" }}>
              <div className="column-filter" style={{ alignItems: "center" }}>
                <div className="column-title">Total Pay</div>
                <div className="column-search">
                  <div className="actions-info">
                    <span className="actions-help-text">Pay ($)</span>
                  </div>
                </div>
              </div>
            </th>
            <th>
              <div className="column-filter" style={{ alignItems: "center" }}>
                <div className="column-title">
                  {t("bulkTimesheetManagement.columns.emailStatus")}
                </div>
                <div className="column-search">
                  <select
                    value={emailSentFilter}
                    onChange={(e) => setEmailSentFilter(e.target.value)}
                    className="column-search-input"
                  >
                    <option value="">
                      {t("bulkTimesheetManagement.filters.allEmailStatus")}
                    </option>
                    <option value="true">
                      {t("bulkTimesheetManagement.filters.emailSent")}
                    </option>
                    <option value="false">
                      {t("bulkTimesheetManagement.filters.emailNotSent")}
                    </option>
                  </select>
                </div>
              </div>
            </th>
            <th>
              <div className="column-filter" style={{ alignItems: "center" }}>
                <div className="column-title">Actions</div>
                <div className="column-search">
                  <div className="actions-info">
                    <span className="actions-help-text">View • Edit • Delete</span>
                  </div>
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows rowCount={rowSkeletonCount} />
          ) : timesheets.length === 0 ? (
            <tr>
              <td colSpan={LIST_COLUMNS} className="empty-state-cell">
                <div className="empty-state">
                  <p>
                    {t("bulkTimesheetManagement.messages.noBulkTimesheets")}
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            timesheets.map((timesheet) => (
              <TimesheetListRow
                key={String(timesheet.id)}
                timesheet={timesheet}
                t={t}
                sendingJobseekerEmail={sendingJobseekerEmail}
                onSendEmail={onSendEmail}
                onEditTimesheet={onEditTimesheet}
                onViewTimesheet={onViewTimesheet}
                onDeleteTimesheet={onDeleteTimesheet}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
