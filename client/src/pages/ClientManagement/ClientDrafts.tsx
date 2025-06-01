import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Trash2,
  Clock,
  Pencil,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getAllClientDrafts,
  deleteClientDraft,
  ClientDraft,
  ClientDraftPaginationParams,
  PaginatedClientDraftResponse,
} from "../../services/api";
import { ClientData } from "../../services/api";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { AppHeader } from "../../components/AppHeader";
import "../../styles/pages/ClientManagement.css";
import "../../styles/components/header.css";
import "../../styles/components/CommonTable.css";

// Enhanced interface for pagination info
interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalFiltered: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Format date utility function
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString();
};

export function ClientDrafts() {
  const [drafts, setDrafts] = useState<ClientDraft[]>([]);
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<ClientDraft | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  // Filter states
  const [globalSearch, setGlobalSearch] = useState("");
  const [companyNameFilter, setCompanyNameFilter] = useState("");
  const [shortCodeFilter, setShortCodeFilter] = useState("");
  const [listNameFilter, setListNameFilter] = useState("");
  const [contactPersonFilter, setContactPersonFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [createdDateFilter, setCreatedDateFilter] = useState("");

  // Debounced fetch function
  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Only apply filters if they meet the minimum character requirement
      const effectiveGlobalSearch =
        globalSearch.length >= 3 ? globalSearch : "";
      const effectiveCompanyNameFilter =
        companyNameFilter.length >= 3 ? companyNameFilter : "";
      const effectiveShortCodeFilter =
        shortCodeFilter.length >= 3 ? shortCodeFilter : "";
      const effectiveListNameFilter =
        listNameFilter.length >= 3 ? listNameFilter : "";
      const effectiveContactPersonFilter =
        contactPersonFilter.length >= 3 ? contactPersonFilter : "";

      const params: ClientDraftPaginationParams = {
        page: pagination.page,
        limit: pagination.limit,
        search: effectiveGlobalSearch,
        companyNameFilter: effectiveCompanyNameFilter,
        shortCodeFilter: effectiveShortCodeFilter,
        listNameFilter: effectiveListNameFilter,
        contactPersonFilter: effectiveContactPersonFilter,
        dateFilter: dateFilter || undefined,
        createdDateFilter: createdDateFilter || undefined,
      };

      const response: PaginatedClientDraftResponse = await getAllClientDrafts(
        params
      );
      setDrafts(response.drafts);
      setPagination(response.pagination);
    } catch (err) {
      setError("Failed to fetch client drafts");
      console.error("Error fetching client drafts:", err);
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    // Only include text filters in dependencies when they meet minimum length or are empty
    globalSearch.length >= 3 || globalSearch === "" ? globalSearch : "inactive",
    companyNameFilter.length >= 3 || companyNameFilter === ""
      ? companyNameFilter
      : "inactive",
    shortCodeFilter.length >= 3 || shortCodeFilter === ""
      ? shortCodeFilter
      : "inactive",
    listNameFilter.length >= 3 || listNameFilter === ""
      ? listNameFilter
      : "inactive",
    contactPersonFilter.length >= 3 || contactPersonFilter === ""
      ? contactPersonFilter
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
    // Only reset pagination for text filters when they meet the minimum length or are empty
    globalSearch.length >= 3 || globalSearch === "" ? globalSearch : null,
    companyNameFilter.length >= 3 || companyNameFilter === ""
      ? companyNameFilter
      : null,
    shortCodeFilter.length >= 3 || shortCodeFilter === ""
      ? shortCodeFilter
      : null,
    listNameFilter.length >= 3 || listNameFilter === "" ? listNameFilter : null,
    contactPersonFilter.length >= 3 || contactPersonFilter === ""
      ? contactPersonFilter
      : null,
    dateFilter,
    createdDateFilter,
  ]);

  const handleEditDraft = (draft: ClientData) => {
    if (draft.id) {
      navigate(`/client-management/drafts/edit/${draft.id}`);
    } else {
      setError("Cannot edit draft: Missing ID");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteDraft = async (draft: ClientDraft) => {
    setDraftToDelete(draft);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!draftToDelete?.id) return;

    try {
      setIsDeleting(true);
      await deleteClientDraft(draftToDelete.id);

      // Remove deleted draft from state
      setDrafts((prevDrafts) =>
        prevDrafts.filter((draft) => draft.id !== draftToDelete.id)
      );

      setSuccessMessage("Draft deleted successfully");

      // Auto-dismiss the success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete draft";
      setError(errorMessage);

      // Auto-dismiss the error message after 3 seconds
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setDraftToDelete(null);
    }
  };

  const getLastUpdatedDate = (draft: ClientData): string | undefined => {
    // Try different possible date fields in order of preference
    return draft.lastUpdated || draft.updatedAt || draft.createdAt;
  };

  const resetFilters = () => {
    setGlobalSearch("");
    setCompanyNameFilter("");
    setShortCodeFilter("");
    setListNameFilter("");
    setContactPersonFilter("");
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
        title="Client Drafts"
        actions={
          <button
            className="button button-icon"
            onClick={() => navigate("/client-management")}
          >
            <ArrowLeft size={16} />
            <span>Back to Client Management</span>
          </button>
        }
        statusMessage={error || successMessage}
        statusType={error ? "error" : "success"}
      />

      <div className="content-container">
        <div className="card">
          <div className="card-header">
            <h2>Saved Drafts</h2>
            <p>Continue working on previously saved client drafts.</p>
            <div className="filter-container">
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Global search (min 3 chars)..."
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
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
                  pagination.totalFiltered
                )}{" "}
                to{" "}
                {Math.min(
                  pagination.page * pagination.limit,
                  pagination.totalFiltered
                )}{" "}
                of {pagination.totalFiltered} entries
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
                      <div className="column-title">Company Name</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search (min 3 chars)..."
                          value={companyNameFilter}
                          onChange={(e) => setCompanyNameFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Short Code</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search (min 3 chars)..."
                          value={shortCodeFilter}
                          onChange={(e) => setShortCodeFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">List Name</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search (min 3 chars)..."
                          value={listNameFilter}
                          onChange={(e) => setListNameFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Contact Person</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search (min 3 chars)..."
                          value={contactPersonFilter}
                          onChange={(e) =>
                            setContactPersonFilter(e.target.value)
                          }
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Created at</div>
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
                    <td colSpan={7} className="loading-cell">
                      <div className="loading">Loading drafts...</div>
                    </td>
                  </tr>
                ) : drafts.length === 0 && pagination.total === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state-cell">
                      <div className="empty-state">
                        <p>No saved drafts found.</p>
                        <button
                          className="button primary"
                          onClick={() => navigate("/client-management/create")}
                        >
                          Create New Client
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : drafts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state-cell">
                      <div className="empty-state">
                        <p>No drafts found matching your filters.</p>
                        <button
                          className="button primary"
                          onClick={resetFilters}
                        >
                          Clear Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  drafts.map((draft) => (
                    <tr key={draft.id}>
                      <td>{draft.companyName || "Unnamed Company"}</td>
                      <td>{draft.shortCode || "N/A"}</td>
                      <td>{draft.listName || "N/A"}</td>
                      <td>{draft.contactPersonName1 || "N/A"}</td>
                      <td>
                        <div className="date-with-icon">
                          <Clock size={12} />
                          <span>{formatDate(draft.createdAt)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="date-with-icon">
                          <Clock size={12} />
                          <span>{formatDate(getLastUpdatedDate(draft))}</span>
                        </div>
                      </td>
                     
                      <td>
                        <div className="action-buttons">
                          <button
                            className="action-icon-btn edit-btn"
                            onClick={() => handleEditDraft(draft)}
                            title="Edit this draft"
                            aria-label="Edit draft"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="action-icon-btn delete-btn"
                            onClick={() => handleDeleteDraft(draft)}
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

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Delete Draft"
        message={`Are you sure you want to delete this draft${
          draftToDelete?.companyName
            ? ` for "${draftToDelete.companyName}"`
            : ""
        }? This action cannot be undone.`}
        confirmText={isDeleting ? "Deleting..." : "Delete Draft"}
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setDraftToDelete(null);
        }}
      />
    </div>
  );
}
