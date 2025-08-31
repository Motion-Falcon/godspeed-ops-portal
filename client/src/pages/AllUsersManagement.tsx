import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getUserRolesFromRaw } from "../lib/auth";
import { AllAuthUserListItem, AllAuthUserListResponse } from "../types/auth";
import { AppHeader } from "../components/AppHeader";
import { useLanguage } from "../contexts/language/language-provider";
import {
  Search,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Edit,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import "../styles/pages/JobSeekerManagement.css";
import "../styles/components/CommonTable.css";
import "../styles/pages/AllUsersManagement.css";
import { USER_ROLES } from "../constants/formOptions";
import { getAllAuthUsersAPI, setUserManagerAPI, setUserRolesAPI, resendInvitationAPI } from "../services/api/user";
import { clearCacheFor } from "../services/api";
import { CustomDropdown, DropdownOption } from "../components/CustomDropdown";

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
  const location = useLocation();
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
  const [userRoleFilter, setUserRoleFilter] = useState("");
  const [managerIdFilter, setManagerIdFilter] = useState("");
  const { isAdmin, isRecruiter } = useAuth();

  // Manager modal state
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
  const [managerModalUser, setManagerModalUser] = useState<AllAuthUserListItem | null>(null);
  const [managerOptions, setManagerOptions] = useState<DropdownOption[]>([]);
  const [selectedManagerOption, setSelectedManagerOption] = useState<DropdownOption | null>(null);
  const [savingManager, setSavingManager] = useState(false);
  const [managerError, setManagerError] = useState<string | null>(null);
  const [managerLoading, setManagerLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | 'pending'>('success');

  // Roles modal state
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false);
  const [rolesModalUser, setRolesModalUser] = useState<AllAuthUserListItem | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [rolesSaving, setRolesSaving] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);

  // Resend invitation state
  const [resendingInvitation, setResendingInvitation] = useState<string | null>(null);

  const pushStatus = (msg: string, ttlMs = 3000, type: 'success' | 'error' | 'pending' = 'success') => {
    setStatusType(type);
    setStatusMessage(msg);
    if (ttlMs > 0) {
      setTimeout(() => setStatusMessage((curr) => (curr === msg ? null : curr)), ttlMs);
    }
  };

  // Initialize filters from URL query params on mount (similar to JobSeekerManagement)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get("search") || "");
    setNameFilter(params.get("name") || "");
    setEmailFilter(params.get("email") || "");
    setMobileFilter(params.get("phone") || "");
    setUserTypeFilter(params.get("userType") || "");
    setEmailVerifiedFilter(params.get("emailVerified") || "");
    setUserRoleFilter(params.get("userRole") || "");
    setManagerIdFilter(params.get("managerId") || "");

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
        userRoleFilter,
        managerIdFilter,
      });
      setUsers(data.users.filter(user => user.userType !== "jobseeker"));
      setPagination(data.pagination);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t('userManagement.errorFetchingUsers');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchTerm, nameFilter, emailFilter, mobileFilter, userTypeFilter, emailVerifiedFilter, userRoleFilter, managerIdFilter, t]);

  useEffect(() => {
    if (!isAdmin && !isRecruiter) return;
    fetchUsers();
  }, [isAdmin, isRecruiter, fetchUsers, pagination.page]);

  // Reset to first page when filters change
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [searchTerm, nameFilter, emailFilter, mobileFilter, userTypeFilter, emailVerifiedFilter, userRoleFilter, managerIdFilter]);

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
    setUserRoleFilter("");
    setManagerIdFilter("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Prepare manager options (admins + recruiters) for filtering and assignment
  useEffect(() => {
    const loadManagers = async () => {
      try {
        setManagerLoading(true);
        const [adminsResp, recruitersResp] = await Promise.all([
          getAllAuthUsersAPI({ userTypeFilter: 'admin', page: 1, limit: 5000 }) as Promise<AllAuthUserListResponse>,
          getAllAuthUsersAPI({ userTypeFilter: 'recruiter', page: 1, limit: 5000 }) as Promise<AllAuthUserListResponse>,
        ]);
        const merged = [
          ...(adminsResp?.users || []),
          ...(recruitersResp?.users || []),
        ];
        const dedupMap = new Map<string, AllAuthUserListItem>();
        for (const u of merged) dedupMap.set(u.id, u);
        const allowed = Array.from(dedupMap.values());
        const opts: DropdownOption[] = allowed.map((u) => ({ id: u.id, label: u.name || u.email, sublabel: u.email, value: u.id }));
        setManagerOptions(opts);
      } finally {
        setManagerLoading(false);
      }
    };
    loadManagers();
  }, []);

  type RawHierarchy = { manager_id?: string };
  type RawMeta = { hierarchy?: RawHierarchy; onboarding_complete?: unknown };
  type RawContainer = { user_metadata?: RawMeta; raw_user_meta_data?: RawMeta };
  const getUsersManagerFromRaw = (raw: Record<string, unknown>): string | null => {
    try {
      const container = (raw as unknown as RawContainer) || {} as RawContainer;
      const meta = (container.user_metadata || container.raw_user_meta_data) as RawMeta | undefined;
      const mgr = meta?.hierarchy?.manager_id;
      return typeof mgr === 'string' && mgr.length > 0 ? mgr : null;
    } catch {
      return null;
    }
  };

  // Read onboarding_complete flag from user raw metadata
  const getOnboardingCompleteFromRaw = (raw: Record<string, unknown>): boolean | null => {
    try {
      const container = (raw as unknown as RawContainer) || ({} as RawContainer);
      const meta = (container.user_metadata || container.raw_user_meta_data) as RawMeta | undefined;
      const flag = meta?.onboarding_complete;
      return typeof flag === 'boolean' ? flag : null;
    } catch {
      return null;
    }
  };

  const updateManagerInRaw = (raw: Record<string, unknown>, managerId: string | null): Record<string, unknown> => {
    const container = (raw as unknown as RawContainer) || ({} as RawContainer);
    const meta: RawMeta = (container.user_metadata || container.raw_user_meta_data || {}) as RawMeta;
    const hierarchy: RawHierarchy = { ...(meta.hierarchy || {}) };
    hierarchy.manager_id = managerId || null as unknown as string | undefined;
    const nextMeta: RawMeta = { ...meta, hierarchy };

    // Prefer updating user_metadata if present; else fall back to raw_user_meta_data
    if (container.user_metadata) {
      return { ...raw, user_metadata: nextMeta } as Record<string, unknown>;
    }
    if (container.raw_user_meta_data) {
      return { ...raw, raw_user_meta_data: nextMeta } as Record<string, unknown>;
    }
    // If neither existed, set user_metadata
    return { ...raw, user_metadata: nextMeta } as Record<string, unknown>;
  };

  const updateRolesInRaw = (raw: Record<string, unknown>, roles: string[]): Record<string, unknown> => {
    const container = (raw as unknown as RawContainer) || ({} as RawContainer);
    const meta: RawMeta = (container.user_metadata || container.raw_user_meta_data || {}) as RawMeta & { user_role?: unknown };
    const nextMeta: RawMeta & { user_role?: string[] } = { ...meta, user_role: roles };

    if (container.user_metadata) {
      return { ...raw, user_metadata: nextMeta } as Record<string, unknown>;
    }
    if (container.raw_user_meta_data) {
      return { ...raw, raw_user_meta_data: nextMeta } as Record<string, unknown>;
    }
    return { ...raw, user_metadata: nextMeta } as Record<string, unknown>;
  };

  const openRolesModal = (user: AllAuthUserListItem) => {
    // Prevent editing roles for admin users
    if (user.userType && user.userType.toLowerCase() === 'admin') {
      pushStatus(t('messages.error'), 3000, 'error');
      return;
    }
    setRolesModalUser(user);
    setRolesError(null);
    const roles = getUserRolesFromRaw(user.raw);
    setSelectedRoles(roles);
    setIsRolesModalOpen(true);
  };

  const toggleRoleSelection = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const saveRoles = async () => {
    if (!rolesModalUser) return;
    try {
      setRolesSaving(true);
      setRolesError(null);
      await setUserRolesAPI(rolesModalUser.id, selectedRoles);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === rolesModalUser.id
            ? { ...u, roles: [...selectedRoles], raw: updateRolesInRaw(u.raw as Record<string, unknown>, selectedRoles) }
            : u
        )
      );
      clearCacheFor('/api/users');
      setIsRolesModalOpen(false);
      pushStatus(t('messages.updated'), 3000, 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('messages.error');
      setRolesError(msg);
      pushStatus(msg, 6000, 'error');
    } finally {
      setRolesSaving(false);
    }
  };

  const openManagerModal = async (user: AllAuthUserListItem) => {
    setManagerModalUser(user);
    try {
      setManagerError(null);
      setManagerLoading(true);
      // Fetch admins and recruiters explicitly, then merge
      const [adminsResp, recruitersResp] = await Promise.all([
        getAllAuthUsersAPI({ userTypeFilter: 'admin', page: 1, limit: 5000 }) as Promise<AllAuthUserListResponse>,
        getAllAuthUsersAPI({ userTypeFilter: 'recruiter', page: 1, limit: 5000 }) as Promise<AllAuthUserListResponse>,
      ]);
      const merged = [
        ...(adminsResp?.users || []),
        ...(recruitersResp?.users || []),
      ];
      const dedupMap = new Map<string, AllAuthUserListItem>();
      for (const u of merged) dedupMap.set(u.id, u);
      const allowed = Array.from(dedupMap.values());
      const opts: DropdownOption[] = allowed.map((u) => ({ id: u.id, label: u.name || u.email, sublabel: u.email, value: u.id }));
      setManagerOptions(opts);
      if (opts.length === 0) {
        pushStatus(t('userManagement.errorFetchingUsers'), 3000, 'error');
      }
      const currentManagerId = getUsersManagerFromRaw(user.raw as Record<string, unknown>);
      const currentOpt = opts.find(o => o.id === currentManagerId) || null;
      setSelectedManagerOption(currentOpt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('messages.error');
      setManagerError(msg);
      pushStatus(msg, 6000, 'error');
    } finally {
      setManagerLoading(false);
    }
    setIsManagerModalOpen(true);
  };

  const saveManager = async () => {
    if (!managerModalUser) return;
    try {
      setSavingManager(true);
      setManagerError(null);
      const managerId = selectedManagerOption ? String(selectedManagerOption.value) : null;
      await setUserManagerAPI(managerModalUser.id, managerId);
      // Optimistically update local state so UI reflects immediately
      setUsers((prev) =>
        prev.map((u) =>
          u.id === managerModalUser.id
            ? { ...u, raw: updateManagerInRaw(u.raw as Record<string, unknown>, managerId) }
            : u
        )
      );
      // Invalidate cached lists so future visits see fresh data
      clearCacheFor('/api/users');
      setIsManagerModalOpen(false);
      pushStatus(t('messages.updated'), 3000, 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('messages.error');
      setManagerError(msg);
      pushStatus(msg, 6000, 'error');
    } finally {
      setSavingManager(false);
    }
  };

  const handleResendInvitation = async (user: AllAuthUserListItem) => {
    try {
      setResendingInvitation(user.id);
      const response = await resendInvitationAPI(user.id);
      
      // Check if it was an onboarding reminder or regular invitation
      if (response.message && response.message.includes('Onboarding reminder sent')) {
        pushStatus(t('messages.onboardingReminderSentSuccess', { email: user.email }), 3000, 'success');
      } else {
        pushStatus(t('messages.invitationResentSuccess', { email: user.email }), 3000, 'success');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('messages.invitationResentFailure');
      pushStatus(msg, 6000, 'error');
    } finally {
      setResendingInvitation(null);
    }
  };

  return (
    <div className="page-container all-users-management">
      <AppHeader
        title={t('userManagement.title')}
        statusMessage={managerError || error || statusMessage || undefined}
        statusType={(managerError || error) ? 'error' : statusType}
      />
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
                      <div className="column-title">{t('userManagement.columns.userRole')}</div>
                      <div className="column-search">
                        <select
                          value={userRoleFilter}
                          onChange={(e) => setUserRoleFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="">{t('userManagement.filters.allUserRoles')}</option>
                          {USER_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {t(`roles.${role}`)}
                            </option>
                          ))}
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
                    <div className="column-filter">
                      <div className="column-title">{t('userManagement.columns.managerNames')}</div>
                      <div className="column-search">
                        <select
                          value={managerIdFilter}
                          onChange={(e) => setManagerIdFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="">{t('userManagement.filters.allManagers')}</option>
                          {managerOptions.map((opt) => (
                            <option key={opt.id} value={String(opt.value)}>
                              {opt.label}
                            </option>
                          ))}
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
                      <td className="user-role-cell skeleton-cell">
                        <div className="skeleton-text"></div>
                      </td>
                      <td className="email-verified-cell skeleton-cell">
                        <div className="skeleton-status">
                          <div className="skeleton-icon skeleton-status-icon"></div>
                          <div className="skeleton-badge skeleton-status-text"></div>
                        </div>
                      </td>
                      <td className="manager-cell skeleton-cell">
                        <div className="skeleton-text"></div>
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
                    <td colSpan={8} className="empty-state-cell">
                      <div className="empty-state">
                        <p>{t('userManagement.noUsersMessage')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const rolesArr = getUserRolesFromRaw(user.raw);
                    const managerId = getUsersManagerFromRaw(user.raw as Record<string, unknown>);
                    const manager = managerId ? users.find(u => u.id === managerId) : null;
                    const managerOption = managerId ? managerOptions.find(o => o.id === managerId) : null;
                    const managerLabel = managerOption ? managerOption.label : (manager ? (manager.name || manager.email) : null);

                    return (
                      <tr key={user.id} className={`user-row ${getUserTypeBadgeClass(user.userType)}`}>
                        <td className="name-cell">
                          {user.name || t('userManagement.status.na')}
                          {(() => {
                            const onboardingComplete = getOnboardingCompleteFromRaw(user.raw as Record<string, unknown>);
                            return onboardingComplete === false ? (
                              <span className="onboarding-badge invited" title={t('userManagement.status.invitationNotCompleted')}>{t('userManagement.status.invited')}</span>
                            ) : null;
                          })()}
                        </td>
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
                        <td className="user-role-cell">
                          {user.userType && user.userType.toLowerCase() !== 'recruiter' ? (
                            <span className="muted">{t('roles.admin')}</span>
                          ) : (
                            <button
                              className="user-role-badge"
                              onClick={() => openRolesModal(user)}
                              disabled={user.userType?.toLowerCase() === 'admin'}
                              title={t('userManagement.setRoles')}
                              aria-label={t('userManagement.setRoles')}
                            >
                              {rolesArr.join(', ')} <Edit size={14} className="edit-icon" />
                            </button>
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
                        <td className="manager-cell">
                          {user.userType && user.userType.toLowerCase() === 'recruiter' ? (
                            <button
                              className="user-role-badge"
                              onClick={() => openManagerModal(user)}
                              title={t('userManagement.setManager')}
                              aria-label={t('userManagement.setManager')}
                            >
                              {managerLabel || t('buttons.assign')} <Edit size={14} className="edit-icon" />
                            </button>
                          ) : (
                            <span className="muted">{t('userManagement.status.na')}</span>
                          )}
                        </td>
                        <td className="created-at-cell">{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td className="last-signin-cell">
                          {(() => {
                            const onboardingComplete = getOnboardingCompleteFromRaw(user.raw as Record<string, unknown>);
                            const isInvited = onboardingComplete === false;
                            
                            if (isInvited) {
                              return (
                                <button
                                  className="button secondary small"
                                  onClick={() => handleResendInvitation(user)}
                                  disabled={resendingInvitation === user.id}
                                  title={t('buttons.sendInvitationAgain')}
                                >
                                  {resendingInvitation === user.id ? (
                                    <span className="loading-spinner-small"></span>
                                  ) : (
                                    t('buttons.inviteAgain')
                                  )}
                                </button>
                              );
                            }
                            
                            return user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString() : "-";
                          })()}
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

      {/* Manager Modal */}
      {isManagerModalOpen && (
        <div className="modal open" onClick={() => setIsManagerModalOpen(false)}>
          <div className="status-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('userManagement.setManager')}{managerModalUser ? `: ${managerModalUser.name || managerModalUser.email}` : ''}</h3>
              <button className="close-button" onClick={() => setIsManagerModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <CustomDropdown
                options={managerOptions.filter(o => o.id !== managerModalUser?.id)}
                selectedOption={selectedManagerOption}
                onSelect={(opt) => setSelectedManagerOption(opt as DropdownOption)}
                placeholder={t('userManagement.selectManagerPlaceholder')}
                searchable
                loading={managerLoading}
                clearable
                onClear={() => setSelectedManagerOption(null)}
              />
              {managerError && <div className="error-message" style={{ marginTop: 12 }}>{managerError}</div>}
            </div>
            <div className="modal-footer">
              <button className="button secondary" onClick={() => setIsManagerModalOpen(false)}>
                {t('buttons.cancel')}
              </button>
              <button className="button primary" onClick={saveManager} disabled={savingManager}>
                {savingManager ? t('messages.loading') : t('buttons.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roles Modal */}
      {isRolesModalOpen && (
        <div className="modal open" onClick={() => setIsRolesModalOpen(false)}>
          <div className="status-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('userManagement.setRoles')}{rolesModalUser ? `: ${rolesModalUser.name || rolesModalUser.email}` : ''}</h3>
              <button className="close-button" onClick={() => setIsRolesModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div role="group" aria-label={t('userManagement.availableRoles')} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {USER_ROLES.filter((r) => r !== 'admin').map((role) => (
                  <label key={role} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role)}
                      onChange={() => toggleRoleSelection(role)}
                    />
                    <span>{t(`roles.${role}`)}</span>
                  </label>
                ))}
              </div>
              {rolesError && <div className="error-message" style={{ marginTop: 12 }}>{rolesError}</div>}
            </div>
            <div className="modal-footer">
              <button className="button secondary" onClick={() => setIsRolesModalOpen(false)}>
                {t('buttons.cancel')}
              </button>
              <button className="button primary" onClick={saveRoles} disabled={rolesSaving}>
                {rolesSaving ? t('messages.loading') : t('buttons.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 