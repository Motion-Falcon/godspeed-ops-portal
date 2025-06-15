import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
      if (positionIdFilter.trim()) params.positionIdFilter = positionIdFilter.trim();
      if (positionCodeFilter.trim()) params.positionCodeFilter = positionCodeFilter.trim();
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

      setSuccess("Draft deleted successfully");

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
        title="Position Drafts"
        actions={
          <button className="button" onClick={handleNavigateBack}>
            <ArrowLeft size={16} />
            <span>Back to Position Management</span>
          </button>
        }
        statusMessage={success || error}
        statusType={error ? "error" : "success"}
      />

      <div className="content-container">
        {error && <div className="error-message">{error}</div>}

        <div className="card">
          <div className="card-header">
            <h2>Your Saved Drafts</h2>
            <div className="filter-container">
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Global search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button
                  className="button secondary button-icon reset-filters-btn"
                  onClick={resetFilters}
                >
                  <span>Reset Filters</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pagination Controls - Top */}
          <div className="pagination-controls top">
            <div className="pagination-info">
              <span className="pagination-text">
                Showing{" "}
                {Math.min(
                  (pagination.page - 1) * pagination.limit + 1,
                  pagination.total
                )}{" "}
                to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total} entries
                {pagination.totalFiltered !== pagination.total && (
                  <span className="filtered-info">
                    {" "}
                    (filtered from {pagination.total} total entries)
                  </span>
                )}
              </span>
            </div>
            <div className="pagination-size-selector">
              <label htmlFor="pageSize" className="page-size-label">
                Show:
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
              <span className="page-size-label">per page</span>
            </div>
          </div>

          <div className="table-container">
            <table className="common-table">
              <thead>
                <tr>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Title</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search title..."
                          value={titleFilter}
                          onChange={(e) => setTitleFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Client</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search client..."
                          value={clientFilter}
                          onChange={(e) => setClientFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Position ID</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search position ID..."
                          value={positionIdFilter}
                          onChange={(e) => setPositionIdFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Position Code</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search position code..."
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
                      <div className="column-title">Start Date</div>
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
                      <div className="column-title">Created At</div>
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
                      <div className="column-title">Last Updated</div>
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
                      <div className="column-title">Created By</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search creator..."
                          value={creatorFilter}
                          onChange={(e) => setCreatorFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Last Updated By</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search updater..."
                          value={updaterFilter}
                          onChange={(e) => setUpdaterFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Actions</div>
                      <div className="column-search">
                        <div className="actions-info">
                          <span className="actions-help-text">
                            Edit • Delete
                          </span>
                        </div>
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="loading-cell">
                      <div className="loading">Loading drafts...</div>
                    </td>
                  </tr>
                ) : drafts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="empty-state-cell">
                      <div className="empty-state">
                        <p>
                          No drafts found. Create a new position to save a
                          draft.
                        </p>
                        <button
                          className="button primary"
                          onClick={() =>
                            navigate("/position-management/create", {
                              state: { isNewForm: true },
                            })
                          }
                        >
                          Create New Position
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  drafts.map((draft) => (
                    <tr key={draft.id}>
                      <td>{draft.title || "Untitled"}</td>
                      <td>{draft.clientName || "N/A"}</td>
                      <td>{draft.positionCode || "N/A"}</td>
                      <td>{draft.positionNumber || "N/A"}</td>
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
                            title="Edit this draft"
                            aria-label="Edit draft"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="action-icon-btn delete-btn"
                            onClick={() => confirmDeleteDraft(draft.id)}
                            title="Delete this draft"
                            aria-label="Delete draft"
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
                  Page {pagination.page} of {pagination.totalPages}
                </span>
              </div>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn prev"
                  onClick={handlePreviousPage}
                  disabled={!pagination.hasPrevPage}
                  title="Previous page"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
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
                          aria-label={`Go to page ${pageNum}`}
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
                  title="Next page"
                  aria-label="Next page"
                >
                  <span>Next</span>
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
          title="Delete Draft"
          message="Are you sure you want to delete this draft? This action cannot be undone."
          confirmText="Delete Draft"
          cancelText="Cancel"
          confirmButtonClass="danger"
          onConfirm={handleDeleteDraft}
          onCancel={() => setShowDeleteConfirmation(false)}
        />
      )}
    </div>
  );
}
