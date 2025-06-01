import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllJobseekerDrafts,
  deleteJobseekerDraft,
} from "../../services/api";
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

      // Only apply filters if they meet the minimum character requirement
      const effectiveEmailFilter = emailFilter.length >= 3 ? emailFilter : "";
      const effectiveCreatorFilter =
        creatorFilter.length >= 3 ? creatorFilter : "";
      const effectiveUpdaterFilter =
        updaterFilter.length >= 3 ? updaterFilter : "";

      const data = await getAllJobseekerDrafts({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        emailFilter: effectiveEmailFilter,
        creatorFilter: effectiveCreatorFilter,
        updaterFilter: effectiveUpdaterFilter,
        dateFilter,
        createdDateFilter,
      });

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
    // Only include text filters in dependencies when they meet minimum length or are empty
    emailFilter.length >= 3 || emailFilter === "" ? emailFilter : "inactive",
    creatorFilter.length >= 3 || creatorFilter === ""
      ? creatorFilter
      : "inactive",
    updaterFilter.length >= 3 || updaterFilter === ""
      ? updaterFilter
      : "inactive",
    dateFilter,
    createdDateFilter,
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
    // Only reset pagination for text filters when they meet the minimum length or are empty
    emailFilter.length >= 3 || emailFilter === "" ? emailFilter : null,
    creatorFilter.length >= 3 || creatorFilter === "" ? creatorFilter : null,
    updaterFilter.length >= 3 || updaterFilter === "" ? updaterFilter : null,
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

  // Helper function to get email display
  const getEmailDisplay = (draft: JobseekerDraft): string => {
    // Use the email field from the draft if available
    if (draft.email) {
      return draft.email;
    }

    // Try to extract from form data as fallback
    if (typeof draft.data === "object" && draft.data && "email" in draft.data) {
      return String(draft.data.email || "");
    }

    return "No email";
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
        title="Job Seeker Profile Drafts"
        actions={
          <button className="button" onClick={handleNavigateBack}>
            <ArrowLeft size={16} />
            <span>Back to Job Seekers Management</span>
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
                      <div className="column-title">Title/Email</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search email..."
                          value={emailFilter}
                          onChange={(e) => setEmailFilter(e.target.value)}
                          className="column-search-input"
                        />
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
                    {" "}
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
                    <td colSpan={6} className="loading-cell">
                      <div className="loading">Loading drafts...</div>
                    </td>
                  </tr>
                ) : drafts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state-cell">
                      <div className="empty-state">
                        <p>
                          No drafts found. Create a new jobseeker profile to
                          save a draft.
                        </p>
                        <button
                          className="button primary"
                          onClick={() =>
                            navigate("/profile/create", {
                              state: { isNewForm: true },
                            })
                          }
                        >
                          Create New Profile
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
