import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../contexts/language/language-provider";
import {
  getAllPositionDrafts,
  deletePositionDraft,
  PositionDraft,
} from "../../services/api/position";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { AppHeader } from "../../components/AppHeader";
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
import "../../styles/pages/PositionManagement.css";
import "../../styles/components/header.css";
import "../../styles/components/CommonTable.css";

// Enhanced interface for PositionDraft to include creator/updater info
// interface PositionDraft {
//   id: string;
//   userId: string;
//   title?: string;
//   clientName?: string;
//   positionCode?: string;
//   positionNumber?: string;
//   startDate?: string;
//   showOnJobPortal?: boolean;
//   createdAt: string;
//   lastUpdated: string;
//   createdByUserId: string;
//   updatedAt: string;
//   updatedByUserId: string;
//   creatorDetails?: {
//     id: string;
//     email?: string;
//     name: string;
//     userType: string;
//     createdAt: string;
//   } | null;
//   updaterDetails?: {
//     id: string;
//     email?: string;
//     name: string;
//     userType: string;
//     updatedAt: string;
//   } | null;
// }

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalFiltered: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function PositionDrafts() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [drafts, setDrafts] = useState<PositionDraft[]>([]);
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
  const [titleFilter, setTitleFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [positionIdFilter, setPositionIdFilter] = useState("");
  const [positionCodeFilter, setPositionCodeFilter] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("");
  const [updaterFilter, setUpdaterFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [createdDateFilter, setCreatedDateFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");

  // Debounced fetch function
  const fetchDrafts = useCallback(async () => {
    try {
      console.log("Fetching position drafts...");
      setLoading(true);

      const params: {
        page: number;
        limit: number;
        search?: string;
        titleFilter?: string;
        clientFilter?: string;
        positionIdFilter?: string;
        positionCodeFilter?: string;
        creatorFilter?: string;
        updaterFilter?: string;
        dateFilter?: string;
        createdDateFilter?: string;
        startDateFilter?: string;
      } = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (titleFilter.trim()) params.titleFilter = titleFilter.trim();
      if (clientFilter.trim()) params.clientFilter = clientFilter.trim();
      if (positionIdFilter.trim())
        params.positionIdFilter = positionIdFilter.trim();
      if (positionCodeFilter.trim())
        params.positionCodeFilter = positionCodeFilter.trim();
      if (creatorFilter.trim()) params.creatorFilter = creatorFilter.trim();
      if (updaterFilter.trim()) params.updaterFilter = updaterFilter.trim();
      if (dateFilter) params.dateFilter = dateFilter;
      if (createdDateFilter) params.createdDateFilter = createdDateFilter;
      if (startDateFilter) params.startDateFilter = startDateFilter;

      const data = await getAllPositionDrafts(params);

      console.log("Fetched drafts:", data);
      setDrafts(data.drafts);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Error fetching drafts:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch drafts";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    titleFilter,
    clientFilter,
    positionIdFilter,
    positionCodeFilter,
    creatorFilter,
    updaterFilter,
    dateFilter,
    createdDateFilter,
    startDateFilter,
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
    titleFilter,
    clientFilter,
    positionIdFilter,
    positionCodeFilter,
    creatorFilter,
    updaterFilter,
    dateFilter,
    createdDateFilter,
    startDateFilter,
  ]);

  const handleNavigateBack = () => {
    navigate("/position-management");
  };

  const handleEditDraft = (id: string) => {
    navigate(`/position-management/drafts/edit/${id}`);
  };

  const confirmDeleteDraft = (id: string) => {
    setDraftToDelete(id);
    setShowDeleteConfirmation(true);
  };

  const handleDeleteDraft = async () => {
    if (!draftToDelete) return;

    try {
      await deletePositionDraft(draftToDelete);

      // Remove deleted draft from state
      setDrafts((prevDrafts) =>
        prevDrafts.filter((draft) => draft.id !== draftToDelete)
      );

      setSuccess(t("positionDrafts.messages.draftDeletedSuccess"));

      // Auto-hide message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error("Error deleting draft:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete draft";
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

  // Helper to format user information
  const formatUserInfo = (
    details: { name: string; email?: string } | null | undefined
  ): string => {
    if (!details) return "Unknown";

    if (details.name && details.email) {
      return `${details.name} (${details.email})`;
    } else if (details.name) {
      return details.name;
    } else if (details.email) {
      return details.email;
    }
    return "Unknown";
  };

  const resetFilters = () => {
    setSearchTerm("");
    setTitleFilter("");
    setClientFilter("");
    setPositionIdFilter("");
    setPositionCodeFilter("");
    setCreatorFilter("");
    setUpdaterFilter("");
    setDateFilter("");
    setCreatedDateFilter("");
    setStartDateFilter("");
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
        title={t("positionDrafts.title")}
        actions={
          <button className="button" onClick={handleNavigateBack}>
            <ArrowLeft size={16} />
            <span>{t("positionDrafts.backToPositionManagement")}</span>
          </button>
        }
        statusMessage={success || error}
        statusType={error ? "error" : "success"}
      />

      <div className="content-container">
        {error && <div className="error-message">{error}</div>}

        <div className="card">
          <div className="card-header">
            <h2>{t("positionDrafts.yourSavedDrafts")}</h2>
            <div className="filter-container">
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder={t("positionDrafts.globalSearch")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button
                  className="button secondary button-icon reset-filters-btn"
                  onClick={resetFilters}
                >
                  <span>{t("positionDrafts.resetFilters")}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pagination Controls - Top */}
          <div className="pagination-controls top">
            <div className="pagination-info">
              <span className="pagination-text">
                {t("positionDrafts.pagination.showing", {
                  start: Math.min(
                    (pagination.page - 1) * pagination.limit + 1,
                    pagination.total
                  ),
                  end: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: pagination.total
                })}
                {pagination.totalFiltered !== pagination.total && (
                  <span className="filtered-info">
                    {" "}
                    {t("positionDrafts.pagination.filtered", { total: pagination.total })}
                  </span>
                )}
              </span>
            </div>
            <div className="pagination-size-selector">
              <label htmlFor="pageSize" className="page-size-label">
                {t("positionDrafts.pagination.show")}:
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
              <span className="page-size-label">{t("positionDrafts.pagination.perPage")}</span>
            </div>
          </div>

          <div className="table-container">
            <table className="common-table">
              <thead>
                <tr>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t("positionDrafts.table.title")}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t("positionDrafts.table.searchTitle")}
                          value={titleFilter}
                          onChange={(e) => setTitleFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t("positionDrafts.table.client")}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t("positionDrafts.table.searchClient")}
                          value={clientFilter}
                          onChange={(e) => setClientFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t("positionDrafts.table.positionId")}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t("positionDrafts.table.searchPositionId")}
                          value={positionIdFilter}
                          onChange={(e) => setPositionIdFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t("positionDrafts.table.positionCode")}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t("positionDrafts.table.searchPositionCode")}
                          value={positionCodeFilter}
                          onChange={(e) =>
                            setPositionCodeFilter(e.target.value)
                          }
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t("positionDrafts.table.startDate")}</div>
                      <div className="column-search">
                        <div className="date-picker-wrapper">
                          <input
                            type="date"
                            value={startDateFilter}
                            onChange={(e) => setStartDateFilter(e.target.value)}
                            className="date-picker-input"
                            onClick={(e) => e.currentTarget.showPicker()}
                          />
                        </div>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t("positionDrafts.table.createdAt")}</div>
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
                      <div className="column-title">{t("positionDrafts.table.lastUpdated")}</div>
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
                      <div className="column-title">{t("positionDrafts.table.createdBy")}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t("positionDrafts.table.searchCreator")}
                          value={creatorFilter}
                          onChange={(e) => setCreatorFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t("positionDrafts.table.lastUpdatedBy")}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t("positionDrafts.table.searchUpdater")}
                          value={updaterFilter}
                          onChange={(e) => setUpdaterFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t("positionDrafts.table.actions")}</div>
                      <div className="column-search">
                        <div className="actions-info">
                          <span className="actions-help-text">
                            {t("positionDrafts.table.actionsHelp")}
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

                        {/* Status skeleton - needs special styling */}
                        <td className="skeleton-cell">
                          <div className="skeleton-status">
                            <div className="skeleton-icon skeleton-status-icon"></div>
                            <div className="skeleton-badge skeleton-status-text"></div>
                          </div>
                        </td>
                        <td className="skeleton-cell">
                          <div className="skeleton-status">
                            <div className="skeleton-icon skeleton-status-icon"></div>
                            <div className="skeleton-badge skeleton-status-text"></div>
                          </div>
                        </td>
                        <td className="skeleton-cell">
                          <div className="skeleton-status">
                            <div className="skeleton-icon skeleton-status-icon"></div>
                            <div className="skeleton-badge skeleton-status-text"></div>
                          </div>
                        </td>
                        <td className="skeleton-cell">
                          <div className="skeleton-status">
                            <div className="skeleton-icon skeleton-status-icon"></div>
                            <div className="skeleton-badge skeleton-status-text"></div>
                          </div>
                        </td>
                        <td className="skeleton-cell">
                          <div className="skeleton-status">
                            <div className="skeleton-icon skeleton-status-icon"></div>
                            <div className="skeleton-badge skeleton-status-text"></div>
                          </div>
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
                    <td colSpan={10} className="empty-state-cell">
                      <div className="empty-state">
                        <p>
                          {t("positionDrafts.emptyState.noDrafts")}
                        </p>
                        <button
                          className="button primary"
                          onClick={() =>
                            navigate("/position-management/create", {
                              state: { isNewForm: true },
                            })
                          }
                        >
                          {t("positionDrafts.emptyState.createNewPosition")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  drafts.map((draft) => (
                    <tr key={draft.id}>
                      <td>{draft.title || t("positionDrafts.table.untitled")}</td>
                      <td>{draft.clientName || t("common.notAvailable")}</td>
                      <td>{draft.positionCode || t("common.notAvailable")}</td>
                      <td>{draft.positionNumber || t("common.notAvailable")}</td>
                      <td>
                        {draft.startDate && (
                          <div className="date-with-icon">
                            <Clock size={12} />
                            <span>
                              {new Date(draft.startDate).toLocaleDateString()}
                            </span>
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
                        {draft.lastUpdated && (
                          <div className="date-with-icon">
                            <Clock size={12} />
                            <span>{formatDate(draft.lastUpdated)}</span>
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
                            title={t("positionDrafts.table.editDraft")}
                            aria-label={t("positionDrafts.table.editDraft")}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="action-icon-btn delete-btn"
                            onClick={() => confirmDeleteDraft(draft.id)}
                            title={t("positionDrafts.table.deleteDraft")}
                            aria-label={t("positionDrafts.table.deleteDraft")}
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
                  {t("positionDrafts.pagination.pageOf", { current: pagination.page, total: pagination.totalPages })}
                </span>
              </div>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn prev"
                  onClick={handlePreviousPage}
                  disabled={!pagination.hasPrevPage}
                  title={t("positionDrafts.pagination.previousPage")}
                  aria-label={t("positionDrafts.pagination.previousPage")}
                >
                  <ChevronLeft size={16} />
                  <span>{t("buttons.previous")}</span>
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
                          aria-label={t("positionDrafts.pagination.goToPage", { page: pageNum })}
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
                  title={t("positionDrafts.pagination.nextPage")}
                  aria-label={t("positionDrafts.pagination.nextPage")}
                >
                  <span>{t("buttons.next")}</span>
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
          title={t("positionDrafts.modal.deleteDraft")}
          message={t("positionDrafts.modal.deleteConfirmation")}
          confirmText={t("positionDrafts.modal.deleteDraft")}
          cancelText={t("buttons.cancel")}
          confirmButtonClass="danger"
          onConfirm={handleDeleteDraft}
          onCancel={() => setShowDeleteConfirmation(false)}
        />
      )}
    </div>
  );
}
