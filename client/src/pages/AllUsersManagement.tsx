import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getAllAuthUsersAPI } from "../services/api/auth";
import { AllAuthUserListItem, AllAuthUserListResponse } from "../types/auth";
import { AppHeader } from "../components/AppHeader";
import { useLanguage } from "../contexts/language/language-provider";
import {
  Search,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import "../styles/pages/JobSeekerManagement.css";
import "../styles/components/CommonTable.css";
import "../styles/pages/AllUsersManagement.css";

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalFiltered: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Helper function to get user type badge class
const getUserTypeBadgeClass = (userType: string | undefined): string => {
  if (!userType) return 'default';
  return userType.toLowerCase();
};

export function AllUsersManagement() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<AllAuthUserListItem[]>([]);
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
  const [searchTerm, setSearchTerm] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [mobileFilter, setMobileFilter] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState("");
  const [emailVerifiedFilter, setEmailVerifiedFilter] = useState("");
  const { isAdmin, isRecruiter } = useAuth();

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data: AllAuthUserListResponse = await getAllAuthUsersAPI({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        nameFilter,
        emailFilter,
        mobileFilter,
        userTypeFilter,
        emailVerifiedFilter,
      });
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t('userManagement.errorFetchingUsers');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchTerm, nameFilter, emailFilter, mobileFilter, userTypeFilter, emailVerifiedFilter, t]);

  useEffect(() => {
    if (!isAdmin && !isRecruiter) return;
    fetchUsers();
  }, [isAdmin, isRecruiter, fetchUsers]);

  // Reset to first page when filters change
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [searchTerm, nameFilter, emailFilter, mobileFilter, userTypeFilter, emailVerifiedFilter]);

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
  const resetFilters = () => {
    setSearchTerm("");
    setNameFilter("");
    setEmailFilter("");
    setMobileFilter("");
    setUserTypeFilter("");
    setEmailVerifiedFilter("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="page-container all-users-management">
      <AppHeader title={t('userManagement.title')} />
      <div className="content-container">
        {error && <div className="error-message">{error}</div>}
        <div className="card">
          <div className="card-header">
            <h2>{t('userManagement.allSignedUpUsers')}</h2>
            <div className="filter-container">
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder={t('userManagement.globalSearch')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button
                  className="button secondary button-icon reset-filters-btn"
                  onClick={resetFilters}
                >
                  <span>{t('userManagement.resetFilters')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pagination Controls - Top */}
          <div className="pagination-controls top">
            <div className="pagination-info">
              <span className="pagination-text">
                {t('userManagement.pagination.showing')} {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.totalFiltered)} {t('userManagement.pagination.to')} {Math.min(pagination.page * pagination.limit, pagination.totalFiltered)} {t('userManagement.pagination.of')} {pagination.totalFiltered} {t('userManagement.pagination.entries')}
                {pagination.totalFiltered !== pagination.total && (
                  <span className="filtered-info"> ({t('userManagement.pagination.filteredFrom')} {pagination.total} {t('userManagement.pagination.totalEntries')})</span>
                )}
              </span>
            </div>
            <div className="pagination-size-selector">
              <label htmlFor="pageSize" className="page-size-label">{t('userManagement.pagination.show')}</label>
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
              <span className="page-size-label">{t('userManagement.pagination.perPage')}</span>
            </div>
          </div>

          <div className={`table-container ${loading ? "skeleton-table-container" : ""}`}>
            <table className="common-table">
              <thead>
                <tr>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('userManagement.columns.name')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('userManagement.placeholders.searchName')}
                          value={nameFilter}
                          onChange={(e) => setNameFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('userManagement.columns.email')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('userManagement.placeholders.searchEmail')}
                          value={emailFilter}
                          onChange={(e) => setEmailFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('userManagement.columns.phone')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('userManagement.placeholders.searchPhone')}
                          value={mobileFilter}
                          onChange={(e) => setMobileFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('userManagement.columns.userType')}</div>
                      <div className="column-search">
                        <select
                          value={userTypeFilter}
                          onChange={(e) => setUserTypeFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="">{t('userManagement.filters.allUserTypes')}</option>
                          <option value="admin">{t('roles.admin')}</option>
                          <option value="recruiter">{t('roles.recruiter')}</option>
                          <option value="jobseeker">{t('roles.jobseeker')}</option>
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('userManagement.columns.emailVerified')}</div>
                      <div className="column-search">
                        <select
                          value={emailVerifiedFilter}
                          onChange={(e) => setEmailVerifiedFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="">{t('userManagement.filters.allEmailStatus')}</option>
                          <option value="true">{t('userManagement.status.verified')}</option>
                          <option value="false">{t('userManagement.status.notVerified')}</option>
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter no-filter">
                      <div className="column-title">{t('userManagement.columns.createdAt')}</div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter no-filter">
                      <div className="column-title">{t('userManagement.columns.lastSignIn')}</div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: pagination.limit }, (_, index) => (
                    <tr key={`skeleton-${index}`} className="skeleton-row">
                      <td className="name-cell skeleton-cell">
                        <div className="skeleton-text"></div>
                      </td>
                      <td className="email-cell skeleton-cell">
                        <div className="skeleton-text"></div>
                      </td>
                      <td className="phone-cell skeleton-cell">
                        <div className="skeleton-text"></div>
                      </td>
                      <td className="user-type-cell skeleton-cell">
                        <div className="skeleton-text"></div>
                      </td>
                      <td className="email-verified-cell skeleton-cell">
                        <div className="skeleton-status">
                          <div className="skeleton-icon skeleton-status-icon"></div>
                          <div className="skeleton-badge skeleton-status-text"></div>
                        </div>
                      </td>
                      <td className="created-at-cell skeleton-cell">
                        <div className="skeleton-text"></div>
                      </td>
                      <td className="last-signin-cell skeleton-cell">
                        <div className="skeleton-text"></div>
                      </td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state-cell">
                      <div className="empty-state">
                        <p>{t('userManagement.noUsersMessage')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className={`user-row ${getUserTypeBadgeClass(user.userType)}`}>
                      <td className="name-cell">{user.name || t('userManagement.status.na')}</td>
                      <td className="email-cell">{user.email}</td>
                      <td className="phone-cell">{user.phoneNumber || t('userManagement.status.na')}</td>
                      <td className="user-type-cell">
                        {user.userType ? (
                          <span className={`user-type-badge ${getUserTypeBadgeClass(user.userType)}`}>
                            {t(`roles.${user.userType}`)}
                          </span>
                        ) : (
                          <span className="user-type-badge default">{t('userManagement.status.na')}</span>
                        )}
                      </td>
                      <td className="email-verified-cell">
                        <span className="status-display">
                          {user.emailVerified ? (
                            <>
                              <CheckCircle className="status-icon verified" size={14} />
                              <span className="status-text verified">{t('userManagement.status.verified')}</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="status-icon rejected" size={14} />
                              <span className="status-text rejected">{t('userManagement.status.notVerified')}</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="created-at-cell">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="last-signin-cell">{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString() : "-"}</td>
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
                  {t('userManagement.pagination.page')} {pagination.page} {t('userManagement.pagination.of')} {pagination.totalPages}
                </span>
              </div>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn prev"
                  onClick={handlePreviousPage}
                  disabled={!pagination.hasPrevPage}
                  title={t('userManagement.pagination.previousPage')}
                  aria-label={t('userManagement.pagination.previousPage')}
                >
                  <ChevronLeft size={16} />
                  <span>{t('buttons.previous')}</span>
                </button>
                <div className="page-numbers">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
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
                        className={`page-number-btn ${pageNum === pagination.page ? "active" : ""}`}
                        onClick={() => handlePageChange(pageNum)}
                        aria-label={`${t('userManagement.pagination.goToPage')} ${pageNum}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  className="pagination-btn next"
                  onClick={handleNextPage}
                  disabled={!pagination.hasNextPage}
                  title={t('userManagement.pagination.nextPage')}
                  aria-label={t('userManagement.pagination.nextPage')}
                >
                  <span>{t('buttons.next')}</span>
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