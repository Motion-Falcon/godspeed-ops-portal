import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Plus, ChevronLeft, ChevronRight, Mail } from "lucide-react";
import {
  getTimesheets,
  TimesheetData,
  TimesheetFilters,
  PaginatedTimesheetResponse,
  sendTimesheetEmails,
} from "../../services/api/timesheet";
import { AppHeader } from "../../components/AppHeader";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { useLanguage } from "../../contexts/language/language-provider";
import "../../styles/pages/InvoiceManagement.css";

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalFiltered: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

function getClientDisplayName(
  timesheet: TimesheetData,
  t: (key: string) => string
): string {
  return String(
    timesheet.position?.clientName ||
      t("bulkTimesheetManagement.constants.unknownClient")
  );
}

function getPositionDisplayName(
  timesheet: TimesheetData,
  t: (key: string) => string
): string {
  return String(
    timesheet.position?.title ||
      timesheet.position?.positionCode ||
      t("bulkTimesheetManagement.constants.unknownPosition")
  );
}

export function BulkTimesheetList() {
  const { t } = useLanguage();

  // State management
  const [timesheets, setTimesheets] = useState<TimesheetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const location = useLocation();

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [invoiceNumberFilter, setInvoiceNumberFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [jobseekerFilter, setJobseekerFilter] = useState("");
  const [billingEmailFilter, setBillingEmailFilter] = useState("");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [emailSentFilter, setEmailSentFilter] = useState("");

  // Pagination state
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 25,
    total: 0,
    totalFiltered: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Delete confirmation state
  const [timesheetToDelete, setTimesheetToDelete] =
    useState<TimesheetData | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Track which jobseeker is being emailed (by timesheetId)
  const [sendingJobseekerEmail, setSendingJobseekerEmail] = useState<{
    [key: string]: boolean;
  }>({});

  // Utility functions
  // const resetFilters = () => {
  //   setSearchTerm('');
  //   setInvoiceNumberFilter('');
  //   setClientFilter('');
  //   setPositionFilter('');
  //   setJobseekerFilter('');
  //   setDateRangeStart('');
  //   setDateRangeEnd('');
  //   setEmailSentFilter('');
  //   setPagination(prev => ({ ...prev, page: 1 }));
  // };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const handlePreviousPage = () => {
    if (pagination.hasPrevPage) {
      setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
    }
  };

  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
    }
  };

  // Fetch timesheets with filters
  const fetchTimesheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: TimesheetFilters = {
        page: pagination.page,
        limit: pagination.limit,
        searchTerm: searchTerm,
        jobseekerFilter: jobseekerFilter,
        clientFilter: clientFilter,
        positionFilter: positionFilter,
        invoiceNumberFilter: invoiceNumberFilter,
        billingEmailFilter: billingEmailFilter,
        dateRangeStart: dateRangeStart,
        dateRangeEnd: dateRangeEnd,
        emailSentFilter: emailSentFilter,
      };
      const response: PaginatedTimesheetResponse = await getTimesheets(params);
      setTimesheets(response.timesheets);
      setPagination(response.pagination);
    } catch (err) {
      setError(t("bulkTimesheetManagement.messages.failedToFetch"));
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    jobseekerFilter,
    clientFilter,
    invoiceNumberFilter,
    positionFilter,
    billingEmailFilter,
    dateRangeStart,
    dateRangeEnd,
    emailSentFilter,
    t,
  ]);

  // Debounced fetch effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchTimesheets();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchTimesheets]);

  // Reset to first page when filters change
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [
    searchTerm,
    jobseekerFilter,
    clientFilter,
    invoiceNumberFilter,
    positionFilter,
    billingEmailFilter,
    dateRangeStart,
    dateRangeEnd,
    emailSentFilter,
    pagination.page, // Added missing dependency
  ]);

  // Initialize filters from query params on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get("searchTerm") || "");
    setInvoiceNumberFilter(params.get("invoiceNumber") || "");
    setClientFilter(params.get("client") || "");
    setPositionFilter(params.get("position") || "");
    setJobseekerFilter(params.get("jobseeker") || "");
    setBillingEmailFilter(params.get("billingEmail") || "");
    setDateRangeStart(params.get("dateRangeStart") || "");
    setDateRangeEnd(params.get("dateRangeEnd") || "");
    setEmailSentFilter(params.get("emailSent") || "");

    const pageParam = params.get("page");
    const limitParam = params.get("limit");
    if (pageParam || limitParam) {
      setPagination((prev) => ({
        ...prev,
        page: pageParam ? Math.max(1, parseInt(pageParam)) : prev.page,
        limit: limitParam ? Math.max(1, parseInt(limitParam)) : prev.limit,
      }));
    }
  }, [location.search]);

  // Event handlers
  const handleCreateBulkTimesheet = () => {
    window.location.href = "/bulk-timesheet-management";
  };

  // const handleViewTimesheet = (id: string) => {
  //   // Keep UI but remove functionality for now
  //   console.log('View timesheet:', id);
  // };

  // const handleDeleteClick = (timesheet: TimesheetData) => {
  //   // Keep UI but remove functionality for now
  //   console.log('Delete timesheet:', timesheet.id);
  // };

  const handleConfirmDelete = async () => {
    // Keep UI but remove functionality for now
    console.log("Confirm delete");
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setTimesheetToDelete(null);
    setDeleteError(null);
  };

  // Function to send timesheet email to jobseeker (keeping existing functionality)
  const sendEmailToJobseeker = async (
    timesheetId: string,
    jobseekerName: string
  ) => {
    const key = timesheetId;
    setSendingJobseekerEmail((prev) => ({ ...prev, [key]: true }));
    setError(null);
    try {
      const response = await sendTimesheetEmails(timesheetId);
      setMessage(
        response.message ||
          t("bulkTimesheetManagement.messages.emailSentTo", {
            name: jobseekerName,
          })
      );
      setTimeout(() => setMessage(null), 4000);

      // Update local state for instant UI feedback
      setTimesheets((prevTimesheets) =>
        prevTimesheets.map((ts) =>
          ts.id === timesheetId ? { ...ts, emailSent: true } : ts
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("bulkTimesheetManagement.messages.failedToSendEmail", {
              name: jobseekerName,
            })
      );
      setTimeout(() => setError(null), 4000);
    } finally {
      setSendingJobseekerEmail((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="page-container bulk-timesheet-list">
      <AppHeader
        title={t("bulkTimesheetManagement.listTitle")}
        actions={
          <>
            <button
              className="button primary button-icon"
              onClick={handleCreateBulkTimesheet}
            >
              <Plus size={16} />
              <span>{t("bulkTimesheetManagement.newBulkTimesheet")}</span>
            </button>
          </>
        }
        statusMessage={message || error}
        statusType={error ? "error" : "success"}
      />
      <div className="content-container">
        <div className="card">
          <div className="card-header">
            <h2>{t("bulkTimesheetManagement.listTitle")}</h2>
            {/* <div className="filter-container">
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder={t('bulkTimesheetManagement.globalSearch')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button
                  className="button secondary button-icon reset-filters-btn"
                  onClick={resetFilters}
                >
                  <span>{t('bulkTimesheetManagement.resetFilters')}</span>
                </button>
              </div>
            </div> */}
          </div>
          {/* Pagination Controls - Top */}
          <div className="pagination-controls top">
            <div className="pagination-info">
              <span className="pagination-text">
                {t("bulkTimesheetManagement.pagination.showing")}{" "}
                {Math.min(
                  (pagination.page - 1) * pagination.limit + 1,
                  pagination.total
                )}{" "}
                {t("bulkTimesheetManagement.pagination.to")}{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                {t("bulkTimesheetManagement.pagination.of")} {pagination.total}{" "}
                {t("bulkTimesheetManagement.pagination.entries")}
                {pagination.totalFiltered !== pagination.total && (
                  <span className="filtered-info">
                    {" "}
                    ({t("bulkTimesheetManagement.pagination.filteredFrom")}{" "}
                    {pagination.total}{" "}
                    {t("bulkTimesheetManagement.pagination.totalEntries")})
                  </span>
                )}
              </span>
            </div>
            <div className="pagination-size-selector">
              <label htmlFor="pageSize" className="page-size-label">
                {t("bulkTimesheetManagement.pagination.show")}
              </label>
              <select
                id="pageSize"
                value={pagination.limit}
                onChange={(e) => handleLimitChange(parseInt(e.target.value))}
                className="page-size-select"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="page-size-label">
                {t("bulkTimesheetManagement.pagination.perPage")}
              </span>
            </div>
          </div>
          <div className="table-container">
            <table className="common-table">
              <thead>
                <tr>
                  <th>
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
                          onChange={(e) =>
                            setInvoiceNumberFilter(e.target.value)
                          }
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
                    <div
                      className="column-filter"
                      style={{ alignItems: "center" }}
                    >
                      <div className="column-title">
                        {t("bulkTimesheetManagement.columns.weekPeriod")}
                      </div>
                      <div
                        className="column-search"
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <div className="date-picker-wrapper">
                          <input
                            type="date"
                            value={dateRangeStart}
                            onChange={(e) => setDateRangeStart(e.target.value)}
                            className="date-picker-input"
                            onClick={(e) => e.currentTarget.showPicker()}
                          />
                        </div>
                        <span style={{ margin: "0 4px" }}>
                          {t("bulkTimesheetManagement.filters.to")}
                        </span>
                        <div className="date-picker-wrapper">
                          <input
                            type="date"
                            value={dateRangeEnd}
                            onChange={(e) => setDateRangeEnd(e.target.value)}
                            className="date-picker-input"
                            onClick={(e) => e.currentTarget.showPicker()}
                          />
                        </div>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div
                      className="column-filter"
                      style={{ alignItems: "center" }}
                    >
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
                    <div
                      className="column-filter"
                      style={{ alignItems: "center" }}
                    >
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
                          onChange={(e) =>
                            setBillingEmailFilter(e.target.value)
                          }
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div
                      className="column-filter"
                      style={{ alignItems: "center" }}
                    >
                      <div className="column-title">
                        {t("bulkTimesheetManagement.columns.emailStatus")}
                      </div>
                      <div className="column-search">
                        <select
                          value={emailSentFilter}
                          onChange={(e) => setEmailSentFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="">
                            {t(
                              "bulkTimesheetManagement.filters.allEmailStatus"
                            )}
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
                    <div
                      className="column-filter"
                      style={{ alignItems: "center" }}
                    >
                      <div className="column-title">Total Pay</div>
                    </div>
                  </th>
                  {/* <th>
                    <div className="column-filter" style={{alignItems: 'flex-end', marginRight: '10px' }}>
                      <div className="column-title">{t('bulkTimesheetManagement.columns.actions')}</div>
                      <div className="column-search">
                        <div className="actions-info">
                          <span className="actions-help-text">{t('bulkTimesheetManagement.actions.viewDelete')}</span>
                        </div>
                      </div>
                    </div>
                  </th> */}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  // Skeleton loading rows
                  <>
                    {Array.from(
                      { length: pagination.limit || 10 },
                      (_, index) => (
                        <tr key={`skeleton-${index}`} className="skeleton-row">
                          {/* Regular columns - using generic skeleton-text */}
                          <td className="skeleton-cell">
                            <div className="skeleton-text"></div>
                          </td>
                          <td className="skeleton-cell">
                            <div className="skeleton-text"></div>
                          </td>
                          <td className="skeleton-cell">
                            <div className="skeleton-text"></div>
                          </td>
                          <td className="skeleton-cell">
                            <div className="skeleton-text"></div>
                          </td>
                          <td className="skeleton-cell">
                            <div className="skeleton-text"></div>
                          </td>
                          <td className="skeleton-cell">
                            <div className="skeleton-text"></div>
                          </td>
                          <td className="skeleton-cell">
                            <div className="skeleton-text"></div>
                          </td>
                          <td className="skeleton-cell">
                            <div className="skeleton-text"></div>
                          </td>
                          <td className="skeleton-cell">
                            <div className="skeleton-text"></div>
                          </td>
                          <td className="skeleton-cell">
                            <div className="skeleton-text"></div>
                          </td>
                          {/* Actions skeleton - needs special styling */}
                          {/* <td className="skeleton-cell">
                          <div className="skeleton-actions">
                            <div className="skeleton-icon skeleton-action-btn"></div>
                            <div className="skeleton-icon skeleton-action-btn"></div>
                          </div>
                        </td> */}
                        </tr>
                      )
                    )}
                  </>
                ) : timesheets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty-state-cell">
                      <div className="empty-state">
                        <p>
                          {t(
                            "bulkTimesheetManagement.messages.noBulkTimesheets"
                          )}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  timesheets.map((timesheet) => {
                    const profile = timesheet.jobseekerProfile;
                    const fullName = profile
                      ? `${profile.firstName || ""} ${
                          profile.lastName || ""
                        }`.trim()
                      : "Unknown";
                    const email = profile?.email || "";
                    const billingEmail = profile?.billingEmail || "";
                    const emailSent = timesheet.emailSent || false;
                    const statusClass = emailSent
                      ? "email-status-yes"
                      : "email-status-no";
                    const isSending =
                      !!sendingJobseekerEmail[timesheet.id || ""];
                    const weekPeriod = `${timesheet.weekStartDate} - ${timesheet.weekEndDate}`;

                    return (
                      <tr key={String(timesheet.id)}>
                        <td className="invoice-number-cell">
                          # {timesheet.invoiceNumber}
                        </td>
                        <td className="client-cell">
                          {getClientDisplayName(timesheet, t)}
                        </td>
                        <td className="position-cell">
                          {getPositionDisplayName(timesheet, t)}
                        </td>
                        <td className="date-cell">{weekPeriod}</td>
                        <td className="jobseekers-cell">
                          <div className="jobseeker-row">
                            <div className="jobseeker-info">
                              <span className="jobseeker-name">{fullName}</span>
                              <span className="jobseeker-email">{email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="billing-email-cell">
                          {billingEmail || "-"}
                        </td>
                        <td className="email-status-cell">
                          <div className="jobseeker-actions">
                            <span
                              className={`email-status-dot ${statusClass}`}
                              title={
                                emailSent
                                  ? t("bulkTimesheetManagement.email.emailSent")
                                  : t("bulkTimesheetManagement.email.notSent")
                              }
                            ></span>
                            <button
                              className={`button button-xs send-email-cell ${
                                emailSent ? "resend-email" : "send-email"
                              }`}
                              disabled={isSending}
                              onClick={() =>
                                sendEmailToJobseeker(
                                  timesheet.id || "",
                                  fullName
                                )
                              }
                              title={
                                emailSent
                                  ? `Resend to ${fullName}`
                                  : `Send to ${fullName}`
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
                        <td className="total-pay-cell">
                          ${timesheet.totalJobseekerPay.toFixed(2)}
                        </td>
                        {/* <td className="actions-cell">
                          <div className="action-buttons">
                            <button
                              className="action-icon-btn view-btn"
                              onClick={() => handleViewTimesheet(String(timesheet.id))}
                              title={t('bulkTimesheetManagement.actions.viewDetails')}
                              aria-label={t('bulkTimesheetManagement.actions.viewDetails')}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              className="action-icon-btn delete-btn"
                              onClick={() => handleDeleteClick(timesheet)}
                              title={t('bulkTimesheetManagement.actions.deleteTimesheet')}
                              aria-label={t('bulkTimesheetManagement.actions.deleteTimesheet')}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td> */}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination Controls - Bottom */}
          {!loading && pagination.totalPages > 1 && (
            <div className="pagination-controls bottom">
              <div className="pagination-info">
                <span className="pagination-text">
                  {t("bulkTimesheetManagement.pagination.page")}{" "}
                  {pagination.page} {t("bulkTimesheetManagement.pagination.of")}{" "}
                  {pagination.totalPages}
                </span>
              </div>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn prev"
                  onClick={handlePreviousPage}
                  disabled={!pagination.hasPrevPage}
                  title={t("bulkTimesheetManagement.pagination.previousPage")}
                  aria-label={t(
                    "bulkTimesheetManagement.pagination.previousPage"
                  )}
                >
                  <ChevronLeft size={16} />
                  <span>
                    {t("bulkTimesheetManagement.pagination.previous")}
                  </span>
                </button>
                {/* Page numbers */}
                <div className="page-numbers">
                  {Array.from(
                    { length: Math.min(5, pagination.totalPages) },
                    (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          className={`page-number-btn ${
                            pageNum === pagination.page ? "active" : ""
                          }`}
                          onClick={() => handlePageChange(pageNum)}
                          aria-label={t(
                            "bulkTimesheetManagement.pagination.goToPage",
                            { page: pageNum }
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                  )}
                </div>
                <button
                  className="pagination-btn next"
                  onClick={handleNextPage}
                  disabled={!pagination.hasNextPage}
                  title={t("bulkTimesheetManagement.pagination.nextPage")}
                  aria-label={t("bulkTimesheetManagement.pagination.nextPage")}
                >
                  <span>{t("bulkTimesheetManagement.pagination.next")}</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title={t("bulkTimesheetManagement.deleteModal.title")}
        message={
          t("bulkTimesheetManagement.deleteModal.message", {
            invoiceNumber: timesheetToDelete
              ? timesheetToDelete.invoiceNumber
              : t("bulkTimesheetManagement.constants.unknown"),
          }) + (deleteError ? `\n\nError: ${deleteError}` : "")
        }
        confirmText={t("bulkTimesheetManagement.deleteModal.confirmText")}
        cancelText={t("bulkTimesheetManagement.deleteModal.cancel")}
        confirmButtonClass="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
