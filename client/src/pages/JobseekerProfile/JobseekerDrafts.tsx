import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllJobseekerDrafts,
  deleteJobseekerDraft,
} from "../../services/api/jobseeker";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { AppHeader } from "../../components/AppHeader";
import { useLanguage } from "../../contexts/language/language-provider";
import {
  Pencil,
  Trash2,
  ArrowLeft,
  Clock,
  User,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import "../../styles/pages/JobSeekerManagement.css";
import "../../styles/components/header.css";
import "../../styles/components/CommonTable.css";

// Enhanced interface for JobseekerDraft to include creator/updater info
interface JobseekerDraft {
  id: string;
  user_id: string;
  email?: string;
  title?: string;
  data: Record<string, unknown>;
  lastUpdated: string;
  createdAt: string;
  createdByUserId: string;
  updatedAt: string;
  updatedByUserId: string;
  creatorDetails?: {
    id: string;
    email?: string;
    name: string;
    userType: string;
    createdAt: string;
  } | null;
  updaterDetails?: {
    id: string;
    email?: string;
    name: string;
    userType: string;
    updatedAt: string;
  } | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalFiltered: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function JobseekerDrafts() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [drafts, setDrafts] = useState<JobseekerDraft[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalFiltered: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("");
  const [updaterFilter, setUpdaterFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [createdDateFilter, setCreatedDateFilter] = useState<string>("");

  // Debounced fetch function
  const fetchDrafts = useCallback(async () => {
    try {
      console.log("Fetching jobseeker drafts...");
      setLoading(true);

      const data = await getAllJobseekerDrafts({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        emailFilter: emailFilter,
        creatorFilter: creatorFilter,
        updaterFilter: updaterFilter,
        dateFilter,
        createdDateFilter,
      });

      console.log("Fetched drafts:", data);
      setDrafts(data.drafts);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Error fetching drafts:", err);
      const errorMessage =
        err instanceof Error ? err.message : t('jobseekerDrafts.failedToDeleteDraft');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    emailFilter,
    creatorFilter,
    updaterFilter,
    dateFilter,
    createdDateFilter,
    t,
  ]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  // Reset to first page when filters change
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [
    searchTerm,
    emailFilter,
    creatorFilter,
    updaterFilter,
    dateFilter,
    createdDateFilter,
  ]);

  const handleNavigateBack = () => {
    navigate("/jobseeker-management");
  };

  const handleEditDraft = (id: string) => {
    navigate(`/jobseekers/drafts/edit/${id}`);
  };

  const confirmDeleteDraft = (id: string) => {
    setDraftToDelete(id);
    setShowDeleteConfirmation(true);
  };

  const handleDeleteDraft = async () => {
    if (!draftToDelete) return;

    try {
      await deleteJobseekerDraft(draftToDelete);

      // Remove deleted draft from state
      setDrafts((prevDrafts) =>
        prevDrafts.filter((draft) => draft.id !== draftToDelete)
      );

      setSuccess(t('jobseekerDrafts.draftDeletedSuccess'));

      // Auto-hide message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error("Error deleting draft:", err);
      const errorMessage =
        err instanceof Error ? err.message : t('jobseekerDrafts.failedToDeleteDraft');
      setError(errorMessage);

      // Auto-hide error after 3 seconds
      setTimeout(() => {
        setError(null);
      }, 3000);
    } finally {
      setDraftToDelete(null);
      setShowDeleteConfirmation(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Helper function to get email display
  const getEmailDisplay = (draft: JobseekerDraft): string => {
    // Use the email field from the draft if available
    if (draft.email) {
      return draft.email;
    }

    return t('jobseekerDrafts.noEmail');
  };

  // Helper to format user information
  const formatUserInfo = (
    details: { name: string; email?: string } | null | undefined
  ): string => {
    if (!details) return t('jobseekerDrafts.unknown');

    if (details.name && details.email) {
      return `${details.name} (${details.email})`;
    } else if (details.name) {
      return details.name;
    } else if (details.email) {
      return details.email;
    }
    return t('jobseekerDrafts.unknown');
  };

  const resetFilters = () => {
    setSearchTerm("");
    setEmailFilter("");
    setCreatorFilter("");
    setUpdaterFilter("");
    setDateFilter("");
    setCreatedDateFilter("");
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

  return (
    <div className="page-container">
      <AppHeader
        title={t('jobseekerDrafts.title')}
        actions={
          <button className="button" onClick={handleNavigateBack}>
            <ArrowLeft size={16} />
            <span>{t('jobseekerDrafts.backToManagement')}</span>
          </button>
        }
        statusMessage={success || error}
        statusType={error ? "error" : "success"}
      />

      <div className="content-container">
        {error && <div className="error-message">{error}</div>}

        <div className="card">
          <div className="card-header">
            <h2>{t('jobseekerDrafts.yourSavedDrafts')}</h2>
            <div className="filter-container">
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder={t('jobseekerDrafts.globalSearch')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button
                  className="button secondary button-icon reset-filters-btn"
                  onClick={resetFilters}
                >
                  <span>{t('jobseekerDrafts.resetFilters')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pagination Controls - Top */}
          <div className="pagination-controls top">
            <div className="pagination-info">
              <span className="pagination-text">
                {t('jobseekerDrafts.pagination.showing')}{" "}
                {Math.min(
                  (pagination.page - 1) * pagination.limit + 1,
                  pagination.total
                )}{" "}
                {t('jobseekerDrafts.pagination.to')}{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                {t('jobseekerDrafts.pagination.of')} {pagination.total} {t('jobseekerDrafts.pagination.entries')}
                {pagination.totalFiltered !== pagination.total && (
                  <span className="filtered-info">
                    {" "}
                    ({t('jobseekerDrafts.pagination.filteredFrom')} {pagination.total} {t('jobseekerDrafts.pagination.totalEntries')})
                  </span>
                )}
              </span>
            </div>
            <div className="pagination-size-selector">
              <label htmlFor="pageSize" className="page-size-label">
                {t('jobseekerDrafts.pagination.show')}
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
              <span className="page-size-label">{t('jobseekerDrafts.pagination.perPage')}</span>
            </div>
          </div>

          <div className="table-container">
            <table className="common-table">
              <thead>
                <tr>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('jobseekerDrafts.columns.titleEmail')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('jobseekerDrafts.placeholders.searchEmail')}
                          value={emailFilter}
                          onChange={(e) => setEmailFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('jobseekerDrafts.columns.lastUpdated')}</div>
                      <div className="column-search">
                        <div className="date-picker-wrapper">
                          <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="date-picker-input"
                            onClick={(e) => e.currentTarget.showPicker()}
                          />
                        </div>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('jobseekerDrafts.columns.createdAt')}</div>
                      <div className="column-search">
                        <div className="date-picker-wrapper">
                          <input
                            type="date"
                            value={createdDateFilter}
                            onChange={(e) =>
                              setCreatedDateFilter(e.target.value)
                            }
                            className="date-picker-input"
                            onClick={(e) => e.currentTarget.showPicker()}
                          />
                        </div>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('jobseekerDrafts.columns.createdBy')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('jobseekerDrafts.placeholders.searchCreator')}
                          value={creatorFilter}
                          onChange={(e) => setCreatorFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('jobseekerDrafts.columns.lastUpdatedBy')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('jobseekerDrafts.placeholders.searchUpdater')}
                          value={updaterFilter}
                          onChange={(e) => setUpdaterFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    {" "}
                    <div className="column-filter">
                      <div className="column-title">{t('jobseekerDrafts.columns.actions')}</div>
                      <div className="column-search">
                        <div className="actions-info">
                          <span className="actions-help-text">
                            {t('jobseekerDrafts.actions.editDelete')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                   // Skeleton loading rows
                   <>
                   {Array.from({ length: pagination.limit }, (_, index) => (
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
                       {/* Actions skeleton - needs special styling */}
                       <td className="skeleton-cell">
                         <div className="skeleton-actions">
                           <div className="skeleton-icon skeleton-action-btn"></div>
                           <div className="skeleton-icon skeleton-action-btn"></div>
                         </div>
                       </td>
                     </tr>
                   ))}
                 </>
                ) : drafts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state-cell">
                      <div className="empty-state">
                        <p>
                          {t('jobseekerDrafts.emptyState.noDraftsFound')}
                        </p>
                        <button
                          className="button primary"
                          onClick={() =>
                            navigate("/profile/create", {
                              state: { isNewForm: true },
                            })
                          }
                        >
                          {t('jobseekerDrafts.emptyState.createNewProfile')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  drafts.map((draft) => (
                    <tr key={draft.id}>
                      <td>{getEmailDisplay(draft)}</td>
                      <td>
                        {draft.lastUpdated && (
                          <div className="date-with-icon">
                            <Clock size={12} />
                            <span>{formatDate(draft.lastUpdated)}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        {draft.createdAt && (
                          <div className="date-with-icon">
                            <Clock size={12} />
                            <span>{formatDate(draft.createdAt)}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="user-with-icon">
                          <User size={12} />
                          <span>{formatUserInfo(draft.creatorDetails)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="user-with-icon">
                          <User size={12} />
                          <span>{formatUserInfo(draft.updaterDetails)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="action-icon-btn edit-btn"
                            onClick={() => handleEditDraft(draft.id)}
                            title={t('jobseekerDrafts.actions.editDraft')}
                            aria-label={t('jobseekerDrafts.actions.editDraft')}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="action-icon-btn delete-btn"
                            onClick={() => confirmDeleteDraft(draft.id)}
                            title={t('jobseekerDrafts.actions.deleteDraft')}
                            aria-label={t('jobseekerDrafts.actions.deleteDraft')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
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
                  {t('jobseekerDrafts.pagination.page')} {pagination.page} {t('jobseekerDrafts.pagination.of')} {pagination.totalPages}
                </span>
              </div>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn prev"
                  onClick={handlePreviousPage}
                  disabled={!pagination.hasPrevPage}
                  title={t('jobseekerDrafts.pagination.previousPage')}
                  aria-label={t('jobseekerDrafts.pagination.previousPage')}
                >
                  <ChevronLeft size={16} />
                  <span>{t('jobseekerDrafts.pagination.previous')}</span>
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
                          aria-label={`${t('jobseekerDrafts.pagination.goToPage')} ${pageNum}`}
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
                  title={t('jobseekerDrafts.pagination.nextPage')}
                  aria-label={t('jobseekerDrafts.pagination.nextPage')}
                >
                  <span>{t('jobseekerDrafts.pagination.next')}</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirmation && (
        <ConfirmationModal
          isOpen={showDeleteConfirmation}
          title={t('jobseekerDrafts.deleteModal.title')}
          message={t('jobseekerDrafts.deleteModal.message')}
          confirmText={t('jobseekerDrafts.deleteModal.confirmText')}
          cancelText={t('jobseekerDrafts.deleteModal.cancelText')}
          confirmButtonClass="danger"
          onConfirm={handleDeleteDraft}
          onCancel={() => setShowDeleteConfirmation(false)}
        />
      )}
    </div>
  );
}
