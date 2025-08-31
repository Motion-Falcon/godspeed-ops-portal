import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  User,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import {
  getConsentRecords,
  resendConsentEmails,
  ConsentDocument,
  ConsentRecord,
} from "../../services/api/consent";
import { AppHeader } from "../../components/AppHeader";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import PDFViewerModal from "../../components/PDFViewerModal";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../contexts/language/language-provider";
import "../../styles/components/CommonTable.css";
import "../../styles/pages/ConsentListAndDetailPage.css";

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalFiltered: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function ConsentDetailPage() {
  const { t } = useLanguage();
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();

  // State management
  const [document, setDocument] = useState<ConsentDocument | null>(null);
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

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

  // Selection and resend state
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(
    new Set()
  );
  const [isResendModalOpen, setIsResendModalOpen] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // PDF viewer state
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const formatDate = (dateString?: string): string => {
    if (!dateString) return t("consent.common.notAvailable");
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return t("consent.common.notAvailable");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle size={16} className="status-icon completed" />;
      case "pending":
        return <Clock size={16} className="status-icon pending" />;
      case "expired":
        return <XCircle size={16} className="status-icon expired" />;
      default:
        return <Clock size={16} className="status-icon" />;
    }
  };

  const getTypeDisplay = (type: string): string => {
    return type === "client" ? t("consent.filters.client") : t("consent.filters.jobseeker");
  };

  // Helper function to decode HTML entities from file paths
  const decodeFilePath = (filePath: string): string => {
    // Decode HTML entities like &#x2F; back to /
    return filePath
      .replace(/&#x2F;/g, "/")
      .replace(/&#x5C;/g, "\\")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');
  };

  // Function to generate signed URL for document preview
  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    try {
      // Decode HTML entities from the file path
      const decodedPath = decodeFilePath(filePath);


      const { data, error } = await supabase.storage
        .from("consent-documents")
        .createSignedUrl(decodedPath, 300); // 5 minutes expiry

      if (error) {
        return null;
      }


      return data?.signedUrl || null;
    } catch (err) {
      console.error("Error in getSignedUrl:", err);
      return null;
    }
  };

  // Handle document preview
  const handlePreviewDocument = async () => {
    if (!document?.filePath) {
      setError(t("consent.detail.noDocumentPath"));
      return;
    }

    setLoadingPdf(true);
    try {
      const signedUrl = await getSignedUrl(document.filePath);
      if (signedUrl) {
        setPdfUrl(signedUrl);
        setShowPdfModal(true);
      } else {
        setError(t("consent.detail.failedToGeneratePreview"));
      }
    } catch (err) {
      setError(t("consent.detail.failedToLoadPreview"));
    } finally {
      setLoadingPdf(false);
    }
  };

  // Utility functions
  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setTypeFilter("");
    setNameFilter("");
    setDateFilter("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

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

  // Selection handlers
  const handleSelectRecord = (recordId: string, isSelected: boolean) => {
    const newSelectedRecords = new Set(selectedRecords);
    if (isSelected) {
      newSelectedRecords.add(recordId);
    } else {
      newSelectedRecords.delete(recordId);
    }
    setSelectedRecords(newSelectedRecords);
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      const allRecordIds = records.map((record) => record.id);
      setSelectedRecords(new Set(allRecordIds));
    } else {
      setSelectedRecords(new Set());
    }
  };

  const isAllSelected =
    records.length > 0 && selectedRecords.size === records.length;
  const isIndeterminate =
    selectedRecords.size > 0 && selectedRecords.size < records.length;

  // Fetch consent records with filters
  const fetchRecords = useCallback(async () => {
    if (!documentId) return;

    setLoading(true);
    setError(null);

    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        statusFilter: statusFilter,
        typeFilter: typeFilter,
        nameFilter: nameFilter,
        dateFilter: dateFilter,
      };

      const response = await getConsentRecords(documentId, params);

      setDocument(response.document);
      setRecords(response.records);
      setPagination(response.pagination);
    } catch (err) {
      setError(t("consent.detail.failedToFetchRecords"));
    } finally {
      setLoading(false);
    }
  }, [
    documentId,
    pagination.page,
    pagination.limit,
    searchTerm,
    statusFilter,
    typeFilter,
    nameFilter,
    dateFilter,
  ]);

  // Debounced fetch effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchRecords();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [fetchRecords]);

  // Reset to first page when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [searchTerm, statusFilter, typeFilter, nameFilter, dateFilter]);

  // Event handlers
  const handleBack = () => {
    navigate("/consent-dashboard");
  };

  const handleResendEmails = async () => {
    if (selectedRecords.size === 0) {
      setError(t("consent.detail.messages.selectRecordsToResend"));
      return;
    }

    setIsResending(true);
    try {
      const recordIds = Array.from(selectedRecords);
      await resendConsentEmails(recordIds);
      setMessage(t("consent.detail.messages.successfullyResent", { count: recordIds.length }));
      setSelectedRecords(new Set());
      setIsResendModalOpen(false);

      // Refresh the records
      await fetchRecords();

      // Clear message after delay
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error("Error resending emails:", err);
      setError(err instanceof Error ? err.message : t("consent.detail.messages.failedToResend"));
    } finally {
      setIsResending(false);
    }
  };

  if (!documentId) {
    return <div>{t("consent.detail.invalidDocumentId")}</div>;
  }

  return (
    <div className="page-container">
      <AppHeader
        title={t("consent.detail.title")}
        actions={
          <>
            {selectedRecords.size > 0 && (
              <button
                className="button primary button-icon"
                onClick={() => setIsResendModalOpen(true)}
                disabled={isResending}
              >
                <Send size={16} />
                                 <span>{t("consent.detail.resendEmails")} ({selectedRecords.size})</span>
              </button>
            )}
            <button
              className="button secondary button-icon"
              onClick={handleBack}
            >
              <ArrowLeft size={16} />
                             <span>{t("consent.detail.backToList")}</span>
            </button>
          </>
        }
        statusMessage={message || error}
        statusType={error ? "error" : "success"}
      />

      <div className="content-container">
        {error && !message && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        {/* Document info card */}
        {loading ? (
          <div className="modern-document-card">
            <div className="modern-doc-header">
              <div className="modern-doc-info">
                <div className="skeleton-text modern-doc-title-skeleton"></div>
                <div className="modern-doc-meta">
                  <div className="skeleton-text modern-doc-date-skeleton"></div>
                  <span className="modern-doc-divider">•</span>
                  <div className="skeleton-badge modern-doc-status-skeleton"></div>
                </div>
              </div>
              <div className="skeleton-text modern-doc-btn-skeleton"></div>
            </div>
          </div>
        ) : (
          document && (
            <div className="modern-document-card">
              <div className="modern-doc-header">
                <div className="modern-doc-info">
                  <h3 className="modern-doc-title">{document.fileName}</h3>
                  <div className="modern-doc-meta">
                    <span className="modern-doc-date">
                                             {t("consent.detail.created")} {formatDate(document.createdAt)}
                    </span>
                    <span className="modern-doc-divider">•</span>
                    <span
                      className={`modern-doc-status ${
                        document.isActive ? "active" : "inactive"
                      }`}
                    >
                                             {document.isActive ? t("consent.filters.active") : t("consent.filters.inactive")}
                    </span>
                  </div>
                </div>
                <button
                  className="modern-doc-preview-btn"
                  onClick={handlePreviewDocument}
                  disabled={loadingPdf}
                                     title={t("consent.detail.previewDocument")}
                >
                  <Eye size={16} />
                                     <span>{loadingPdf ? t("consent.detail.loading") : t("consent.detail.preview")}</span>
                </button>
              </div>
            </div>
          )
        )}

        <div className="card">
          <div className="card-header">
                         <h2>{t("consent.detail.recipients")}</h2>
            <div className="card-actions">
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                                     placeholder={t("consent.management.globalSearch")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button
                  className="button secondary button-icon"
                  onClick={resetFilters}
                >
                                     <span>{t("consent.management.resetFilters")}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pagination Controls - Top */}
          <div className="pagination-controls top">
            <div className="pagination-info">
              <span className="pagination-text">
                                 {t("pagination.showing", {
                   start: Math.min(
                     (pagination.page - 1) * pagination.limit + 1,
                     pagination.total
                   ),
                   end: Math.min(pagination.page * pagination.limit, pagination.total),
                   total: pagination.total,
                 })}
                {pagination.totalFiltered !== pagination.total && (
                  <span className="filtered-info">
                    {" "}
                                         ({t("pagination.filteredFromTotal", { total: pagination.total })}
                  </span>
                )}
              </span>
            </div>
            <div className="pagination-size-selector">
              <label htmlFor="pageSize" className="page-size-label">
                                 {t("consent.pagination.show")}
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
                             <span className="page-size-label">{t("consent.pagination.perPage")}</span>
            </div>
          </div>

          <div className="table-container">
            <table className="common-table">
              <thead>
                <tr>
                  <th className="checkbox-column">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isIndeterminate;
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="checkbox-input"
                    />
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">
                                                 <span>{t("consent.detail.table.recipientName")}</span>
                      </div>
                      <div className="column-search">
                        <input
                          type="text"
                                                     placeholder={t("consent.detail.table.searchName")}
                          value={nameFilter}
                          onChange={(e) => setNameFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                                             <div className="column-title">{t("consent.detail.table.email")}</div>
                      <div className="column-search">
                                                 <span className="column-info">{t("consent.detail.table.contactInfo")}</span>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                                             <div className="column-title">{t("consent.detail.table.type")}</div>
                      <div className="column-search">
                        <select
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                          className="column-filter-select"
                        >
                                                     <option value="">{t("consent.filters.all")}</option>
                           <option value="client">{t("consent.filters.client")}</option>
                           <option value="jobseeker_profile">{t("consent.filters.jobseeker")}</option>
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                                             <div className="column-title">{t("consent.detail.table.status")}</div>
                      <div className="column-search">
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="column-filter-select"
                        >
                                                     <option value="">{t("consent.filters.all")}</option>
                           <option value="pending">{t("consent.detail.status.pending")}</option>
                           <option value="completed">{t("consent.detail.status.completed")}</option>
                           <option value="expired">{t("consent.detail.status.expired")}</option>
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">
                                                 <span>{t("consent.detail.table.sentDate")}</span>
                      </div>
                      <div className="column-search">
                        <input
                          type="date"
                          value={dateFilter}
                          onChange={(e) => setDateFilter(e.target.value)}
                          className="date-picker-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                                             <div className="column-title">{t("consent.detail.table.completedDate")}</div>
                      <div className="column-search">
                        <span className="column-info">
                                                     {t("consent.detail.table.whenConsentGiven")}
                        </span>
                      </div>
                    </div>
                  </th>
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
                          <td className="skeleton-cell">
                            <div className="skeleton-checkbox"></div>
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
                        </tr>
                      )
                    )}
                  </>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state-cell">
                      <div className="empty-state">
                                                 <p>{t("consent.detail.emptyState")}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id}>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={selectedRecords.has(record.id)}
                          onChange={(e) =>
                            handleSelectRecord(record.id, e.target.checked)
                          }
                          className="checkbox-input"
                        />
                      </td>
                      <td>
                        <div className="user-with-icon">
                          <User size={16} className="entity-icon" />
                                                     <span>{record.entityName || t("consent.common.unknown")}</span>
                        </div>
                      </td>
                                             <td>{record.entityEmail || t("consent.common.notAvailable")}</td>
                      <td>
                        <span
                          className={`type-badge ${record.consentableType}`}
                        >
                          {getTypeDisplay(record.consentableType)}
                        </span>
                      </td>
                      <td>
                        <div className="status-display">
                          {getStatusIcon(record.status)}
                          <span className={`status-text ${record.status}`}>
                            {record.status === 'completed' ? t("consent.detail.status.completed") :
                             record.status === 'pending' ? t("consent.detail.status.pending") :
                             record.status === 'expired' ? t("consent.detail.status.expired") :
                             record.status}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="date-with-icon">
                          <Calendar size={16} className="date-icon" />
                          <span>{formatDate(record.sentAt)}</span>
                        </div>
                      </td>
                      <td>
                        {record.completedAt
                          ? formatDate(record.completedAt)
                                                     : t("consent.detail.notCompleted")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls - Bottom */}
          {!loading && pagination.totalPages > 1 && (
            <div className="pagination-controls bottom">
              <div className="pagination-info">
                <span className="pagination-text">
                                     {t("pagination.pageOf", { page: pagination.page, totalPages: pagination.totalPages })}
                </span>
              </div>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn prev"
                  onClick={handlePreviousPage}
                  disabled={!pagination.hasPrevPage}
                  title={t("pagination.previousPage")}
                  aria-label={t("pagination.previousPage")}
                >
                  <ChevronLeft size={16} />
                  <span>{t("consent.pagination.previous")}</span>
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
                          aria-label={t("pagination.goToPage", { page: pageNum })}
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
                  title={t("pagination.nextPage")}
                  aria-label={t("pagination.nextPage")}
                >
                  <span>{t("consent.pagination.next")}</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resend Confirmation Modal */}
      <ConfirmationModal
        isOpen={isResendModalOpen}
                 title={t("consent.detail.resendEmailsModal.title")}
                 message={t("consent.detail.resendEmailsModal.message", { count: selectedRecords.size })}
                 confirmText={isResending ? t("consent.detail.loading") : t("consent.detail.resendEmails")}
                 cancelText={t("consent.detail.resendEmailsModal.cancel")}
        confirmButtonClass="primary"
        onConfirm={handleResendEmails}
        onCancel={() => setIsResendModalOpen(false)}
      />

      {/* PDF Viewer Modal */}
      {showPdfModal && document && pdfUrl && (
        <PDFViewerModal
          pdfUrl={pdfUrl}
          documentName={document.fileName}
          isOpen={showPdfModal}
          onClose={() => {
            setShowPdfModal(false);
            setPdfUrl(null);
          }}
        />
      )}
    </div>
  );
}
