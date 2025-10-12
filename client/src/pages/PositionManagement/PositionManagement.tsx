import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Plus,
  FileText,
  Eye,
  Trash2,
  Pencil,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getPositions,
  deletePosition,
  PositionData,
  PositionPaginationParams,
} from "../../services/api/position";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { AppHeader } from "../../components/AppHeader";
import { useLanguage } from "../../contexts/language/language-provider";
import "../../styles/pages/PositionManagement.css";
import "../../styles/components/header.css";
import "../../styles/components/CommonTable.css";
import {
  EMPLOYMENT_TERMS,
  EMPLOYMENT_TYPES,
  POSITION_CATEGORIES,
  EXPERIENCE_LEVELS,
} from "../../constants/formOptions";

interface ExtendedPositionData extends PositionData {
  [key: string]: unknown;
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

export function PositionManagement() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [positions, setPositions] = useState<ExtendedPositionData[]>([]);
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
  const [message, setMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [positionIdFilter, setPositionIdFilter] = useState("");
  const [positionNumberFilter, setPositionNumberFilter] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [employmentTermFilter, setEmploymentTermFilter] = useState("all");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("all");
  const [positionCategoryFilter, setPositionCategoryFilter] = useState("all");
  const [experienceFilter, setExperienceFilter] = useState("all");
  const [showOnPortalFilter, setShowOnPortalFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [positionToDelete, setPositionToDelete] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [positionToEdit, setPositionToEdit] = useState<string | null>(null);
  const [showEditConfirmation, setShowEditConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const convertToCamelCase = (
    data: Record<string, unknown>
  ): ExtendedPositionData => {
    const converted: Record<string, unknown> = {};

    Object.entries(data).forEach(([key, value]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
        letter.toUpperCase()
      );
      converted[camelKey] = value;
    });

    return converted as ExtendedPositionData;
  };

  useEffect(() => {
    // Check for message in location state
    if (location.state?.message) {
      setMessage(location.state.message);

      // Clear the message from location state after displaying
      window.history.replaceState({}, document.title);

      // Auto-hide message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    }
  }, [location]);

  // Simplified fetch function - all filtering is now server-side
  const fetchPositions = useCallback(async () => {
    try {
      console.log("Fetching positions...");
      setLoading(true);

      const params: PositionPaginationParams = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        positionIdFilter,
        positionNumberFilter,
        titleFilter,
        clientFilter,
        locationFilter,
        employmentTermFilter,
        employmentTypeFilter,
        positionCategoryFilter,
        experienceFilter,
        showOnPortalFilter,
        dateFilter,
      };

      const data = await getPositions(params);
      console.log("Fetched positions:", data);

      const convertedPositions = data.positions.map((position) =>
        convertToCamelCase(position as unknown as Record<string, unknown>)
      );
      setPositions(convertedPositions);
      setPagination(data.pagination);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("positionManagement.messages.failedToFetchPositions");
      console.error("Error fetching positions:", err);
      setError(errorMessage);

      // Show more detailed error info in console
      if (err instanceof Error) {
        console.error("Error details:", {
          message: err.message,
          stack: err.stack,
          name: err.name,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    positionIdFilter,
    positionNumberFilter,
    titleFilter,
    clientFilter,
    locationFilter,
    employmentTermFilter,
    employmentTypeFilter,
    positionCategoryFilter,
    experienceFilter,
    showOnPortalFilter,
    dateFilter,
  ]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  // Reset to first page when filters change
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [
    searchTerm,
    positionIdFilter,
    positionNumberFilter,
    titleFilter,
    clientFilter,
    locationFilter,
    employmentTermFilter,
    employmentTypeFilter,
    positionCategoryFilter,
    experienceFilter,
    showOnPortalFilter,
    dateFilter,
  ]);

  // --- New: Initialize filters from query params on mount ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get("search") || "");
    setPositionIdFilter(params.get("positionId") || "");
    setPositionNumberFilter(params.get("positionNumber") || "");
    setTitleFilter(params.get("title") || "");
    setClientFilter(params.get("client") || "");
    setLocationFilter(params.get("location") || "");
    setEmploymentTermFilter(params.get("employmentTerm") || "all");
    setEmploymentTypeFilter(params.get("employmentType") || "all");
    setPositionCategoryFilter(params.get("positionCategory") || "all");
    setExperienceFilter(params.get("experience") || "all");
    setShowOnPortalFilter(params.get("showOnPortal") || "all");
    setDateFilter(params.get("date") || "");
    // Example: How to use filter params in the URL
    //
    //   /position-management?search=Developer&positionId=POS123&positionNumber=P001&title=Frontend&client=Acme%20Corp&location=Toronto&employmentTerm=Full-Time&employmentType=Permanent&positionCategory=IT&experience=Senior&showOnPortal=true&date=2024-07-01
    //
    // Any combination of these params can be used to pre-populate filters on page load.
  }, [location.search]);
  // --- End new code ---

  const handleCreatePosition = () => {
    navigate("/position-management/create");
  };

  const handleViewDrafts = () => {
    navigate("/position-management/drafts");
  };

  const handleViewPosition = (id: string) => {
    navigate(`/position-management/view/${id}`);
  };

  const confirmEditPosition = (id: string) => {
    setPositionToEdit(id);
    setShowEditConfirmation(true);
  };

  const confirmDeletePosition = (id: string) => {
    setPositionToDelete(id);
    setShowDeleteConfirmation(true);
    setDeleteError(null);
  };

  const handleDeletePosition = async () => {
    if (!positionToDelete) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);

      await deletePosition(positionToDelete);

      // Refresh the positions list
      await fetchPositions();

      setMessage(t("positionManagement.messages.positionDeleted"));

      // Auto-hide message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (err) {
      console.error("Error deleting position:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("positionManagement.messages.failedToDeletePosition");
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
      setPositionToDelete(null);
      setShowDeleteConfirmation(false);
    }
  };

  // Helper to reset all filters
  const resetFilters = () => {
    setPositionIdFilter("");
    setPositionNumberFilter("");
    setTitleFilter("");
    setClientFilter("");
    setLocationFilter("");
    setEmploymentTermFilter("all");
    setEmploymentTypeFilter("all");
    setPositionCategoryFilter("all");
    setExperienceFilter("all");
    setShowOnPortalFilter("all");
    setDateFilter("");
    setSearchTerm("");
  };

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const handlePreviousPage = () => {
    if (pagination.hasPrevPage) {
      handlePageChange(pagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      handlePageChange(pagination.page + 1);
    }
  };

  // Format date for display
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return t("positionManagement.nA");
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="page-container">
      <AppHeader
        title={t("positionManagement.title")}
        actions={
          <>
            <button
              className="button secondary button-icon"
              onClick={handleViewDrafts}
            >
              <FileText size={16} />
              <span>{t("positionManagement.viewDrafts")}</span>
            </button>
            <button
              className="button primary button-icon"
              onClick={handleCreatePosition}
            >
              <Plus size={16} />
              <span>{t("positionManagement.newPosition")}</span>
            </button>
          </>
        }
        statusMessage={message || error}
        statusType={error ? "error" : "success"}
      />

      <div className="content-container">
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <div className="card">
          <div className="card-header">
            <h2>{t("positionManagement.positionsTitle")}</h2>
            <div className="filter-container">
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder={t("positionManagement.globalSearch")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button
                  className="button secondary button-icon reset-filters-btn"
                  onClick={resetFilters}
                >
                  <span>{t("positionManagement.resetFilters")}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pagination Controls - Top */}
          <div className="pagination-controls top">
            <div className="pagination-info">
              <span className="pagination-text">
                {t("positionManagement.pagination.showing", {
                  start: Math.min(
                    (pagination.page - 1) * pagination.limit + 1,
                    pagination.total
                  ),
                  end: Math.min(
                    pagination.page * pagination.limit,
                    pagination.total
                  ),
                  total: pagination.total,
                })}
                {pagination.totalFiltered !== pagination.total && (
                  <span className="filtered-info">
                    {" "}
                    {t("positionManagement.pagination.filteredFrom", {
                      total: pagination.total,
                    })}
                  </span>
                )}
              </span>
            </div>
            <div className="pagination-size-selector">
              <label htmlFor="pageSize" className="page-size-label">
                {t("positionManagement.pagination.show")}
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
                {t("positionManagement.pagination.perPage")}
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
                        {t("positionManagement.columns.positionId")}
                      </div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t(
                            "positionManagement.placeholders.searchPositionId"
                          )}
                          value={positionIdFilter}
                          onChange={(e) => setPositionIdFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">
                        {t("positionManagement.columns.positionNumber")}
                      </div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t(
                            "positionManagement.placeholders.searchPositionNumber"
                          )}
                          value={positionNumberFilter}
                          onChange={(e) =>
                            setPositionNumberFilter(e.target.value)
                          }
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">
                        {t("positionManagement.columns.title")}
                      </div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t(
                            "positionManagement.placeholders.searchTitle"
                          )}
                          value={titleFilter}
                          onChange={(e) => setTitleFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">
                        {t("positionManagement.columns.client")}
                      </div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t(
                            "positionManagement.placeholders.searchClient"
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
                        {t("positionManagement.columns.startDate")}
                      </div>
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
                      <div className="column-title">
                        {t("positionManagement.columns.location")}
                      </div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t(
                            "positionManagement.placeholders.searchLocation"
                          )}
                          value={locationFilter}
                          onChange={(e) => setLocationFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">
                        {t("positionManagement.columns.employmentTerm")}
                      </div>
                      <div className="column-search">
                        <select
                          value={employmentTermFilter}
                          onChange={(e) =>
                            setEmploymentTermFilter(e.target.value)
                          }
                          className="column-filter-select"
                        >
                          <option value="all">
                            {t("positionManagement.filters.allEmploymentTerms")}
                          </option>
                          {EMPLOYMENT_TERMS.map((term) => (
                            <option key={term} value={term}>
                              {term}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">
                        {t("positionManagement.columns.employmentType")}
                      </div>
                      <div className="column-search">
                        <select
                          value={employmentTypeFilter}
                          onChange={(e) =>
                            setEmploymentTypeFilter(e.target.value)
                          }
                          className="column-filter-select"
                        >
                          <option value="all">
                            {t("positionManagement.filters.allEmploymentTypes")}
                          </option>
                          {EMPLOYMENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">
                        {t("positionManagement.columns.category")}
                      </div>
                      <div className="column-search">
                        <select
                          value={positionCategoryFilter}
                          onChange={(e) =>
                            setPositionCategoryFilter(e.target.value)
                          }
                          className="column-filter-select"
                        >
                          <option value="all">
                            {t("positionManagement.filters.allCategories")}
                          </option>
                          {POSITION_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">
                        {t("positionManagement.columns.experience")}
                      </div>
                      <div className="column-search">
                        <select
                          value={experienceFilter}
                          onChange={(e) => setExperienceFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="all">
                            {t("positionManagement.filters.allExperience")}
                          </option>
                          {EXPERIENCE_LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {level}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </th>
                  {/* <th>
                    <div className="column-filter">
                      <div className="column-title">{t("positionManagement.columns.showOnPortal")}</div>
                      <div className="column-search">
                        <select
                          value={showOnPortalFilter}
                          onChange={(e) =>
                            setShowOnPortalFilter(e.target.value)
                          }
                          className="column-filter-select"
                        >
                          <option value="all">{t("positionManagement.filters.allPortalStatus")}</option>
                          <option value="true">{t("positionManagement.yes")}</option>
                          <option value="false">{t("positionManagement.no")}</option>
                        </select>
                      </div>
                    </div>
                  </th> */}
                  <th>
                    <div className="column-filter">
                      <div className="column-title">
                        {t("positionManagement.columns.actions")}
                      </div>
                      <div className="column-search">
                        <div className="actions-info">
                          <span className="actions-help-text">
                            {t("positionManagement.actions.helpText")}
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
                        {/* <td className="skeleton-cell">
                          <div className="skeleton-text"></div>
                        </td> */}

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
                ) : positions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="empty-state-cell">
                      <div className="empty-state">
                        <p>{t("positionManagement.emptyState.noPositions")}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  positions.map((position) => (
                    <tr key={position.id}>
                      <td className="position-id-cell">
                        {position.positionCode || t("positionManagement.nA")}
                      </td>
                      <td className="position-number-cell">
                        {position.positionNumber || t("positionManagement.nA")}
                      </td>
                      <td className="title-cell">{position.title}</td>
                      <td className="client-cell">{position.clientName}</td>
                      <td className="date-cell">
                        <div className="date-display">
                          {formatDate(position.startDate)}
                        </div>
                      </td>
                      <td className="location-cell">
                        {position.city}, {position.province}
                      </td>
                      <td className="employment-term-cell">
                        {position.employmentTerm || t("positionManagement.nA")}
                      </td>
                      <td className="employment-type-cell">
                        {position.employmentType || t("positionManagement.nA")}
                      </td>
                      <td className="position-category-cell">
                        {position.positionCategory ||
                          t("positionManagement.nA")}
                      </td>
                      <td className="experience-cell">
                        {position.experience || t("positionManagement.nA")}
                      </td>
                      {/* <td className="status-cell">
                        <span
                          className={`status-badge ${
                            position.showOnJobPortal ? "active" : "inactive"
                          }`}
                        >
                          {position.showOnJobPortal ? t("positionManagement.yes") : t("positionManagement.no")}
                        </span>
                      </td> */}
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button
                            className="action-icon-btn view-btn"
                            onClick={() =>
                              handleViewPosition(position.id as string)
                            }
                            title={t("positionManagement.actions.viewPosition")}
                            aria-label={t(
                              "positionManagement.actions.viewPosition"
                            )}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className="action-icon-btn edit-btn"
                            onClick={() =>
                              confirmEditPosition(position.id as string)
                            }
                            title={t("positionManagement.actions.editPosition")}
                            aria-label={t(
                              "positionManagement.actions.editPosition"
                            )}
                          >
                            <Pencil size={16} />
                          </button>
                          {false && (
                            <button
                              className="action-icon-btn delete-btn"
                              onClick={() =>
                                confirmDeletePosition(position.id as string)
                              }
                              title={t(
                                "positionManagement.actions.deletePosition"
                              )}
                              aria-label={t(
                                "positionManagement.actions.deletePosition"
                              )}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
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
                  {t("positionManagement.pagination.pageOf", {
                    current: pagination.page,
                    total: pagination.totalPages,
                  })}
                </span>
              </div>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn prev"
                  onClick={handlePreviousPage}
                  disabled={!pagination.hasPrevPage}
                  title={t("positionManagement.pagination.previousPage")}
                  aria-label={t("positionManagement.pagination.previousPage")}
                >
                  <ChevronLeft size={16} />
                  <span>{t("positionManagement.pagination.previous")}</span>
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
                            "positionManagement.pagination.goToPage",
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
                  title={t("positionManagement.pagination.nextPage")}
                  aria-label={t("positionManagement.pagination.nextPage")}
                >
                  <span>{t("positionManagement.pagination.next")}</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        title={t("positionManagement.deleteModal.title")}
        message={`${t("positionManagement.deleteModal.message", {
          title: "",
        })}${
          deleteError
            ? `\n\n${t("positionManagement.deleteModal.error", {
                error: deleteError,
              })}`
            : ""
        }`}
        confirmText={
          isDeleting
            ? t("positionManagement.deleteModal.deleting")
            : t("positionManagement.deleteModal.confirm")
        }
        cancelText={t("positionManagement.deleteModal.cancel")}
        confirmButtonClass="danger"
        onConfirm={handleDeletePosition}
        onCancel={() => setShowDeleteConfirmation(false)}
      />

      {/* Edit Confirmation Modal */}
      <ConfirmationModal
        isOpen={showEditConfirmation}
        title={t("positionManagement.editModal.title")}
        message={t("positionManagement.editModal.message", { title: "" })}
        confirmText={t("positionManagement.editModal.confirm")}
        cancelText={t("positionManagement.editModal.cancel")}
        confirmButtonClass="primary"
        onConfirm={() => {
          navigate(`/position-management/edit/${positionToEdit}`);
          setShowEditConfirmation(false);
        }}
        onCancel={() => {
          setPositionToEdit(null);
          setShowEditConfirmation(false);
        }}
      />
    </div>
  );
}
