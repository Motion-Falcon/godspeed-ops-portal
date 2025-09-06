import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  CircleAlert,
} from "lucide-react";
import {
  getJobseekerProfiles,
} from "../../services/api/jobseeker";
import { JobSeekerProfile } from "../../types/jobseeker";
import { AppHeader } from "../../components/AppHeader";
import { useLanguage } from "../../contexts/language/language-provider";
import "../../styles/pages/JobSeekerManagement.css";
import "../../styles/components/header.css";
import "../../styles/components/CommonTable.css";

// Extended interface to include the SIN and Work Permit fields
interface SinWorkPermitProfile extends JobSeekerProfile {
  sinNumber?: string;
  sinExpiry?: string;
  workPermitUci?: string;
  workPermitExpiry?: string;
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

// Helper function to calculate days until expiry
const calculateDaysUntilExpiry = (expiryDate: string | null | undefined): number | null => {
  if (!expiryDate) return null;

  try {
    const expiry = new Date(expiryDate);
    const today = new Date();

    // Reset time to start of day for accurate day calculation
    expiry.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const timeDiff = expiry.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return daysDiff;
  } catch (error) {
    console.error("Error calculating days until expiry:", error);
    return null;
  }
};

// Helper function to get expiry status and styling class
const getExpiryStatus = (
  expiryDate: string | null | undefined,
  t: (key: string, interpolations?: Record<string, string | number>) => string
): {
  type: "expired" | "warning-30" | "warning-60" | "warning-90" | "normal" | null;
  daysUntilExpiry: number | null;
  message: string;
  className: string;
} | null => {
  if (!expiryDate) return null;
  
  const daysUntilExpiry = calculateDaysUntilExpiry(expiryDate);
  if (daysUntilExpiry === null) return null;

  if (daysUntilExpiry < 0) {
    return {
      type: "expired",
      daysUntilExpiry,
      message: t('sinWorkPermitManagement.expiredDaysAgo', { days: Math.abs(daysUntilExpiry) }),
      className: "expiry-status expired"
    };
  } else if (daysUntilExpiry <= 30) {
    return {
      type: "warning-30",
      daysUntilExpiry,
      message: t('sinWorkPermitManagement.expiresInDays', { days: daysUntilExpiry }),
      className: "expiry-status warning-30"
    };
  } else if (daysUntilExpiry <= 60) {
    return {
      type: "warning-60",
      daysUntilExpiry,
      message: t('sinWorkPermitManagement.expiresInDays', { days: daysUntilExpiry }),
      className: "expiry-status warning-60"
    };
  } else if (daysUntilExpiry <= 90) {
    return {
      type: "warning-90",
      daysUntilExpiry,
      message: t('sinWorkPermitManagement.expiresInDays', { days: daysUntilExpiry }),
      className: "expiry-status warning-90"
    };
  } else {
    return {
      type: "normal",
      daysUntilExpiry,
      message: t('sinWorkPermitManagement.expiresInDays', { days: daysUntilExpiry }),
      className: "expiry-status normal"
    };
  }
};

// Helper function to get the appropriate icon for expiry status
const getExpiryIcon = (type: string | null) => {
  switch (type) {
    case "expired":
    case "warning-30":
      return <AlertTriangle size={14} />;
    case "warning-60":
      return <AlertCircle size={14} />;
    case "warning-90":
      return <CircleAlert size={14} />;
    default:
      return null;
  }
};

export function SinWorkPermitManagement() {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<SinWorkPermitProfile[]>([]);
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
  const [nameFilter, setNameFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [sinNumberFilter, setSinNumberFilter] = useState("");
  const [sinExpiryFilter, setSinExpiryFilter] = useState("");
  const [workPermitUciFilter, setWorkPermitUciFilter] = useState("");
  const [workPermitExpiryFilter, setWorkPermitExpiryFilter] = useState("");
  const [sinExpiryStatusFilter, setSinExpiryStatusFilter] = useState("all");
  const [workPermitExpiryStatusFilter, setWorkPermitExpiryStatusFilter] = useState("all");
  const { isAdmin, isRecruiter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize filters from query params on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setNameFilter(params.get("name") || "");
    setEmailFilter(params.get("email") || "");
    setPhoneFilter(params.get("phone") || "");
    setSinNumberFilter(params.get("sinNumber") || "");
    setSinExpiryFilter(params.get("sinExpiry") || "");
    setWorkPermitUciFilter(params.get("workPermitUci") || "");
    setWorkPermitExpiryFilter(params.get("workPermitExpiry") || "");
    setSinExpiryStatusFilter(params.get("sinExpiryStatus") || "all");
    setWorkPermitExpiryStatusFilter(params.get("workPermitExpiryStatus") || "all");
    setSearchTerm(params.get("search") || "");
  }, [location.search]);

  // Check for success message in navigation state
  useEffect(() => {
    if (location.state?.message) {
      setMessage(location.state.message);
      window.history.replaceState({}, document.title);
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    }
  }, [location]);

  // Fetch profiles function with SIN/Work Permit filters
  const fetchProfiles = useCallback(async () => {
    try {
      console.log("Fetching jobseeker profiles for SIN/Work Permit view...");
      setLoading(true);

      const data = await getJobseekerProfiles({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        nameFilter,
        emailFilter,
        phoneFilter,
        sinNumberFilter,
        sinExpiryFilter,
        workPermitUciFilter,
        workPermitExpiryFilter,
        sinExpiryStatusFilter,
        workPermitExpiryStatusFilter,
      });
      
      console.log("Fetched profiles:", data);
      setProfiles(data.profiles);
      setPagination(data.pagination);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred while fetching profiles";
      console.error("Error fetching profiles:", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    nameFilter,
    emailFilter,
    phoneFilter,
    sinNumberFilter,
    sinExpiryFilter,
    workPermitUciFilter,
    workPermitExpiryFilter,
    sinExpiryStatusFilter,
    workPermitExpiryStatusFilter,
  ]);

  useEffect(() => {
    // Check if user has access
    if (!isAdmin && !isRecruiter) {
      navigate("/dashboard");
      return;
    }

    fetchProfiles();
  }, [isAdmin, isRecruiter, navigate, fetchProfiles]);

  // Reset to first page when filters change
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [
    searchTerm,
    nameFilter,
    emailFilter,
    phoneFilter,
    sinNumberFilter,
    sinExpiryFilter,
    workPermitUciFilter,
    workPermitExpiryFilter,
    sinExpiryStatusFilter,
    workPermitExpiryStatusFilter,
    pagination.page,
  ]);

  const handleViewProfile = (id: string) => {
    navigate(`/jobseekers/${id}`);
  };

  // Helper to reset all filters
  const resetFilters = () => {
    setSearchTerm("");
    setNameFilter("");
    setEmailFilter("");
    setPhoneFilter("");
    setSinNumberFilter("");
    setSinExpiryFilter("");
    setWorkPermitUciFilter("");
    setWorkPermitExpiryFilter("");
    setSinExpiryStatusFilter("all");
    setWorkPermitExpiryStatusFilter("all");
    setPagination((prev) => ({ ...prev, page: 1 }));
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
  const formatDate = (dateString?: string) => {
    if (!dateString) return t('sinWorkPermitManagement.na');
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return t('sinWorkPermitManagement.na');
    }
  };

  return (
    <div className="page-container">
      <AppHeader
        title={t('sinWorkPermitManagement.title')}
        statusMessage={message || error}
        statusType={error ? "error" : "success"}
      />

      <div className="content-container">
        <div className="card">
          <div className="card-header">
            <h2>{t('sinWorkPermitManagement.tableTitle')}</h2>
            <div className="filter-container">
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder={t('sinWorkPermitManagement.globalSearch')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button
                  className="button secondary button-icon reset-filters-btn"
                  onClick={resetFilters}
                >
                  <span>{t('sinWorkPermitManagement.resetFilters')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pagination Controls - Top */}
          <div className="pagination-controls top">
            <div className="pagination-info">
              <span className="pagination-text">
                {t('sinWorkPermitManagement.pagination.showing', {
                  start: Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total),
                  end: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: pagination.total
                })}
                {pagination.totalFiltered !== pagination.total && (
                  <span className="filtered-info">
                    {t('sinWorkPermitManagement.pagination.filteredFrom', { total: pagination.total })}
                  </span>
                )}
              </span>
            </div>
            <div className="pagination-size-selector">
              <label htmlFor="pageSize" className="page-size-label">
                {t('sinWorkPermitManagement.pagination.show')}
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
              <span className="page-size-label">{t('sinWorkPermitManagement.pagination.perPage')}</span>
            </div>
          </div>

          <div
            className={`table-container ${
              loading ? "skeleton-table-container" : ""
            }`}
          >
            <table className="common-table">
              <thead>
                <tr>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('sinWorkPermitManagement.columns.name')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('sinWorkPermitManagement.placeholders.searchName')}
                          value={nameFilter}
                          onChange={(e) => setNameFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('sinWorkPermitManagement.columns.email')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('sinWorkPermitManagement.placeholders.searchEmail')}
                          value={emailFilter}
                          onChange={(e) => setEmailFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('sinWorkPermitManagement.columns.phone')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('sinWorkPermitManagement.placeholders.searchPhone')}
                          value={phoneFilter}
                          onChange={(e) => setPhoneFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('sinWorkPermitManagement.columns.sinNumber')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('sinWorkPermitManagement.placeholders.searchSinNumber')}
                          value={sinNumberFilter}
                          onChange={(e) => setSinNumberFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('sinWorkPermitManagement.columns.sinExpiry')}</div>
                      <div className="column-search">
                        <div className="date-picker-wrapper">
                          <input
                            type="date"
                            value={sinExpiryFilter}
                            onChange={(e) => setSinExpiryFilter(e.target.value)}
                            className="date-picker-input"
                            onClick={(e) => e.currentTarget.showPicker()}
                          />
                        </div>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('sinWorkPermitManagement.columns.workPermitUci')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('sinWorkPermitManagement.placeholders.searchWorkPermitUci')}
                          value={workPermitUciFilter}
                          onChange={(e) => setWorkPermitUciFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('sinWorkPermitManagement.columns.workPermitExpiry')}</div>
                      <div className="column-search">
                        <div className="date-picker-wrapper">
                          <input
                            type="date"
                            value={workPermitExpiryFilter}
                            onChange={(e) => setWorkPermitExpiryFilter(e.target.value)}
                            className="date-picker-input"
                            onClick={(e) => e.currentTarget.showPicker()}
                          />
                        </div>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('sinWorkPermitManagement.columns.sinExpiryStatus')}</div>
                      <div className="column-search">
                        <select
                          value={sinExpiryStatusFilter}
                          onChange={(e) => setSinExpiryStatusFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="all">{t('sinWorkPermitManagement.filters.allStatuses')}</option>
                          <option value="expired">{t('sinWorkPermitManagement.filters.expired')}</option>
                          <option value="expiring-30">{t('sinWorkPermitManagement.filters.expiringUnder30')}</option>
                          <option value="expiring-60">{t('sinWorkPermitManagement.filters.expiringUnder60')}</option>
                          <option value="expiring-90">{t('sinWorkPermitManagement.filters.expiringUnder90')}</option>
                          <option value="expiring-after-90">{t('sinWorkPermitManagement.filters.expiringAfter90')}</option>
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('sinWorkPermitManagement.columns.workPermitExpiryStatus')}</div>
                      <div className="column-search">
                        <select
                          value={workPermitExpiryStatusFilter}
                          onChange={(e) => setWorkPermitExpiryStatusFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="all">{t('sinWorkPermitManagement.filters.allStatuses')}</option>
                          <option value="expired">{t('sinWorkPermitManagement.filters.expired')}</option>
                          <option value="expiring-30">{t('sinWorkPermitManagement.filters.expiringUnder30')}</option>
                          <option value="expiring-60">{t('sinWorkPermitManagement.filters.expiringUnder60')}</option>
                          <option value="expiring-90">{t('sinWorkPermitManagement.filters.expiringUnder90')}</option>
                          <option value="expiring-after-90">{t('sinWorkPermitManagement.filters.expiringAfter90')}</option>
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('sinWorkPermitManagement.columns.actions')}</div>
                      <div className="column-search">
                        <div className="actions-info">
                          <span className="actions-help-text">
                            {t('sinWorkPermitManagement.actions.helpText')}
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
                        {Array.from({ length: 10 }, (_, colIndex) => (
                          <td key={colIndex} className="skeleton-cell">
                            <div className="skeleton-text"></div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ) : profiles.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="empty-state-cell">
                      <div className="empty-state">
                        <p>{t('sinWorkPermitManagement.emptyState.noProfiles')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  profiles.map((profile) => {
                    const sinExpiryStatus = getExpiryStatus(profile.sinExpiry, t);
                    const workPermitExpiryStatus = getExpiryStatus(profile.workPermitExpiry, t);
                    
                    return (
                      <tr key={profile.id}>
                        <td className="name-cell">{profile.name}</td>
                        <td className="email-cell">{profile.email}</td>
                        <td className="phone-cell">
                          {profile.phoneNumber || t('sinWorkPermitManagement.na')}
                        </td>
                        <td className="sin-number-cell">
                          {profile.sinNumber || t('sinWorkPermitManagement.na')}
                        </td>
                        <td className="sin-expiry-cell">
                          {formatDate(profile.sinExpiry)}
                        </td>
                        <td className="work-permit-uci-cell">
                          {profile.workPermitUci || t('sinWorkPermitManagement.na')}
                        </td>
                        <td className="work-permit-expiry-cell">
                          {formatDate(profile.workPermitExpiry)}
                        </td>
                        <td className="sin-expiry-status-cell">
                          {sinExpiryStatus ? (
                            <div className={sinExpiryStatus.className}>
                              {getExpiryIcon(sinExpiryStatus.type)}
                              <span>{sinExpiryStatus.message}</span>
                            </div>
                          ) : (
                            <span className="no-data">{t('sinWorkPermitManagement.na')}</span>
                          )}
                        </td>
                        <td className="work-permit-expiry-status-cell">
                          {workPermitExpiryStatus ? (
                            <div className={workPermitExpiryStatus.className}>
                              {getExpiryIcon(workPermitExpiryStatus.type)}
                              <span>{workPermitExpiryStatus.message}</span>
                            </div>
                          ) : (
                            <span className="no-data">{t('sinWorkPermitManagement.na')}</span>
                          )}
                        </td>
                        <td className="actions-cell">
                          <div className="action-buttons">
                            <button
                              className="action-icon-btn view-btn"
                              onClick={() => handleViewProfile(profile.id)}
                              title={t('sinWorkPermitManagement.actions.viewProfile')}
                              aria-label={t('sinWorkPermitManagement.actions.viewProfile')}
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </td>
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
                  {t('sinWorkPermitManagement.pagination.pageOf', { current: pagination.page, total: pagination.totalPages })}
                </span>
              </div>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn prev"
                  onClick={handlePreviousPage}
                  disabled={!pagination.hasPrevPage}
                  title={t('sinWorkPermitManagement.pagination.previousPage')}
                  aria-label={t('sinWorkPermitManagement.pagination.previousPage')}
                >
                  <ChevronLeft size={16} />
                  <span>{t('sinWorkPermitManagement.pagination.previous')}</span>
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
                          aria-label={t('sinWorkPermitManagement.pagination.goToPage', { page: pageNum })}
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
                  title={t('sinWorkPermitManagement.pagination.nextPage')}
                  aria-label={t('sinWorkPermitManagement.pagination.nextPage')}
                >
                  <span>{t('sinWorkPermitManagement.pagination.next')}</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
