import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Plus,
  Trash2,
  Eye,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Pencil,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getJobseekerProfiles,
  deleteJobseeker,
} from "../../services/api/jobseeker";
import { JobSeekerProfile } from "../../types/jobseeker";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { AppHeader } from "../../components/AppHeader";
import { EXPERIENCE_LEVELS } from "../../constants/formOptions";
import { useLanguage } from "../../contexts/language/language-provider";
import "../../styles/pages/JobSeekerManagement.css";
import "../../styles/components/header.css";
import "../../styles/components/CommonTable.css";

// Extend the JobSeekerProfile type to include documents
interface ExtendedJobSeekerProfile extends JobSeekerProfile {
  employeeId?: string;
  documents?: Array<{
    id?: string;
    documentType: string;
    documentPath?: string;
    documentTitle?: string;
    documentFileName?: string;
    documentNotes?: string;
    aiValidation?: {
      document_authentication_percentage: number;
      is_tampered: boolean;
      is_blurry: boolean;
      is_text_clear: boolean;
      is_resubmission_required: boolean;
      notes: string;
      document_status?: string;
    } | null;
  }>;
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

export function JobSeekerManagement() {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<ExtendedJobSeekerProfile[]>([]);
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
  const [locationFilter, setLocationFilter] = useState("");
  const [employeeIdFilter, setEmployeeIdFilter] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] =
    useState<ExtendedJobSeekerProfile | null>(null);
  const [profileToEdit, setProfileToEdit] =
    useState<ExtendedJobSeekerProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { isAdmin, isRecruiter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // --- New: Initialize filters from query params on mount ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setNameFilter(params.get("name") || "");
    setEmailFilter(params.get("email") || "");
    setPhoneFilter(params.get("phone") || "");
    setLocationFilter(params.get("location") || "");
    setEmployeeIdFilter(params.get("employeeId") || "");
    setExperienceFilter(params.get("experience") || "all");
    setStatusFilter(params.get("status") || "all");
    setDateFilter(params.get("date") || "");
    setSearchTerm(params.get("search") || "");
    // Optionally: setPagination if you want to support page/limit in URL

    // Example: How to use filter params in the URL
    //
    //   /jobseeker-management?name=John&email=john@example.com&phone=1234567890&location=New%20York&employeeId=EMP001&experience=Senior&status=verified&date=2024-06-01&search=developer
    //
    // Any combination of these params can be used to pre-populate filters on page load.
  }, [location.search]);
  // --- End new code ---

  // Check for success message in navigation state (e.g., from edit page)
  useEffect(() => {
    if (location.state?.message) {
      setMessage(location.state.message);

      // Clear the message from location state to prevent showing it again on refresh
      window.history.replaceState({}, document.title);

      // Auto-dismiss the success message after 5 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    }
  }, [location]);

  // Simplified fetch function - all filtering is now server-side
  const fetchProfiles = useCallback(async () => {
    try {
      console.log("Fetching jobseeker profiles...");
      setLoading(true);

      const data = await getJobseekerProfiles({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        nameFilter,
        emailFilter,
        phoneFilter,
        locationFilter,
        employeeIdFilter,
        experienceFilter,
        statusFilter,
        dateFilter,
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
    nameFilter,
    emailFilter,
    phoneFilter,
    locationFilter,
    employeeIdFilter,
    experienceFilter,
    statusFilter,
    dateFilter,
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
    locationFilter,
    employeeIdFilter,
    experienceFilter,
    statusFilter,
    dateFilter,
  ]);

  // Check if a profile needs attention based on AI validation
  const profileNeedsAttention = (
    profile: ExtendedJobSeekerProfile
  ): boolean => {
    // Only check for pending profiles
    if (profile.status !== "pending") return false;

    // Check if profile has documents with AI validation issues
    if (!profile.documents || profile.documents.length === 0) return false;

    return profile.documents.some((doc) => {
      if (!doc.aiValidation) return false;

      return (
        doc.aiValidation.is_tampered === true ||
        doc.aiValidation.is_blurry === true ||
        doc.aiValidation.is_text_clear === false ||
        doc.aiValidation.is_resubmission_required === true
      );
    });
  };

  // Get the effective status for display (including the 'need attention' status)
  const getEffectiveStatus = (profile: ExtendedJobSeekerProfile): string => {
    if (profile.status === "pending" && profileNeedsAttention(profile)) {
      return "need-attention";
    }
    return profile.status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="status-icon verified" size={12} />;
      case "rejected":
        return <XCircle className="status-icon rejected" size={12} />;
      case "pending":
        return <Clock className="status-icon pending" size={12} />;
      case "need-attention":
      case "needs attention":
        return (
          <AlertTriangle className="status-icon need-attention" size={12} />
        );
      default:
        return <Clock className="status-icon pending" size={12} />;
    }
  };

  const formatStatusLabel = (status: string): string => {
    if (status === "need-attention") return t('jobseekerManagement.status.needsAttention');
    return t(`jobseekerManagement.status.${status}`) || status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleCreateProfile = () => {
    navigate("/profile/create", { state: { isNewForm: true } });
  };

  const handleViewDrafts = () => {
    navigate("/jobseekers/drafts");
  };

  const handleViewProfile = (id: string) => {
    // Navigate to detailed view
    navigate(`/jobseekers/${id}`);
  };

  const handleEditClick = (profile: ExtendedJobSeekerProfile) => {
    setProfileToEdit(profile);
    setIsEditModalOpen(true);
  };

  const handleConfirmEdit = () => {
    if (!profileToEdit) return;

    // Navigate to edit page with the profile ID
    navigate(`/jobseekers/${profileToEdit.id}/edit`);
    setIsEditModalOpen(false);
    setProfileToEdit(null);
  };

  const handleCancelEdit = () => {
    setIsEditModalOpen(false);
    setProfileToEdit(null);
  };

  const handleDeleteClick = (profile: ExtendedJobSeekerProfile) => {
    setProfileToDelete(profile);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!profileToDelete) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);

      await deleteJobseeker(profileToDelete.id);

      // Refresh the profiles list
      await fetchProfiles();

      // Close the modal
      setIsDeleteModalOpen(false);
      setProfileToDelete(null);
      setMessage("Profile deleted successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete profile";
      setDeleteError(errorMessage);
      console.error("Error deleting profile:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setProfileToDelete(null);
    setDeleteError(null);
  };

  // Helper to reset all filters
  const resetFilters = () => {
    setSearchTerm("");
    setNameFilter("");
    setEmailFilter("");
    setPhoneFilter("");
    setLocationFilter("");
    setEmployeeIdFilter("");
    setExperienceFilter("all");
    setStatusFilter("all");
    setDateFilter("");
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

  return (
    <div className="page-container">
      <AppHeader
        title={t('jobseekerManagement.title')}
        actions={
          <>
            <button
              className="button secondary button-icon"
              onClick={handleViewDrafts}
            >
              <FileText size={16} />
              <span>{t('jobseekerManagement.viewDrafts')}</span>
            </button>
            <button
              className="button primary button-icon"
              onClick={handleCreateProfile}
            >
              <Plus size={16} />
              <span>{t('jobseekerManagement.newJobSeeker')}</span>
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
            <h2>{t('jobseekerManagement.profilesTitle')}</h2>
            <div className="filter-container">
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder={t('jobseekerManagement.globalSearch')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button
                  className="button secondary button-icon reset-filters-btn"
                  onClick={resetFilters}
                >
                  <span>{t('jobseekerManagement.resetFilters')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pagination Controls - Top */}
          <div className="pagination-controls top">
            <div className="pagination-info">
              <span className="pagination-text">
                {t('jobseekerManagement.pagination.showing', {
                  start: Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total),
                  end: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: pagination.total
                })}
                {pagination.totalFiltered !== pagination.total && (
                  <span className="filtered-info">
                    {t('jobseekerManagement.pagination.filteredFrom', { total: pagination.total })}
                  </span>
                )}
              </span>
            </div>
            <div className="pagination-size-selector">
              <label htmlFor="pageSize" className="page-size-label">
                {t('jobseekerManagement.pagination.show')}
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
              <span className="page-size-label">{t('jobseekerManagement.pagination.perPage')}</span>
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
                      <div className="column-title">{t('jobseekerManagement.columns.name')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('jobseekerManagement.placeholders.searchName')}
                          value={nameFilter}
                          onChange={(e) => setNameFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('jobseekerManagement.columns.email')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('jobseekerManagement.placeholders.searchEmail')}
                          value={emailFilter}
                          onChange={(e) => setEmailFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('jobseekerManagement.columns.phone')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('jobseekerManagement.placeholders.searchPhone')}
                          value={phoneFilter}
                          onChange={(e) => setPhoneFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('jobseekerManagement.columns.location')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('jobseekerManagement.placeholders.searchLocation')}
                          value={locationFilter}
                          onChange={(e) => setLocationFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('jobseekerManagement.columns.employeeId')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder={t('jobseekerManagement.placeholders.searchEmployeeId')}
                          value={employeeIdFilter}
                          onChange={(e) => setEmployeeIdFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('jobseekerManagement.columns.experience')}</div>
                      <div className="column-search">
                        <select
                          value={experienceFilter}
                          onChange={(e) => setExperienceFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="all">{t('jobseekerManagement.filters.allExperience')}</option>
                          {EXPERIENCE_LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {level}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('jobseekerManagement.columns.status')}</div>
                      <div className="column-search">
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="all">{t('jobseekerManagement.filters.allStatuses')}</option>
                          <option value="pending">{t('jobseekerManagement.status.pending')}</option>
                          <option value="verified">{t('jobseekerManagement.status.verified')}</option>
                          <option value="rejected">{t('jobseekerManagement.status.rejected')}</option>
                          <option value="need-attention">{t('jobseekerManagement.status.needsAttention')}</option>
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">{t('jobseekerManagement.columns.joinedDate')}</div>
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
                      <div className="column-title">{t('jobseekerManagement.columns.actions')}</div>
                      <div className="column-search">
                        <div className="actions-info">
                          <span className="actions-help-text">
                            {t('jobseekerManagement.actions.helpText')}
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

                        {/* Status skeleton - needs special styling */}
                        <td className="skeleton-cell">
                          <div className="skeleton-status">
                            <div className="skeleton-icon skeleton-status-icon"></div>
                            <div className="skeleton-badge skeleton-status-text"></div>
                          </div>
                        </td>

                        {/* Date skeleton */}
                        <td className="skeleton-cell">
                          <div className="skeleton-text"></div>
                        </td>

                        {/* Actions skeleton - needs special styling */}
                        <td className="skeleton-cell">
                          <div className="skeleton-actions">
                            <div className="skeleton-icon skeleton-action-btn"></div>
                            <div className="skeleton-icon skeleton-action-btn"></div>
                            <div className="skeleton-icon skeleton-action-btn"></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ) : profiles.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty-state-cell">
                      <div className="empty-state">
                        <p>{t('jobseekerManagement.emptyState.noProfiles')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  profiles.map((profile) => {
                    const effectiveStatus = getEffectiveStatus(profile);
                    return (
                      <tr key={profile.id}>
                        <td className="name-cell">{profile.name}</td>
                        <td className="email-cell">{profile.email}</td>
                        <td className="phone-cell">
                          {profile.phoneNumber || t('jobseekerManagement.na')}
                        </td>
                        <td className="location-cell">
                          {profile.location || t('jobseekerManagement.na')}
                        </td>
                        <td className="employee-id-cell">
                          {profile.employeeId || t('jobseekerManagement.na')}
                        </td>
                        <td className="experience-cell">
                          {profile.experience}
                        </td>
                        <td className="status-cell">
                          <span className="status-display">
                            {getStatusIcon(effectiveStatus)}
                            <span className={`status-text ${effectiveStatus}`}>
                              {formatStatusLabel(effectiveStatus)}
                            </span>
                          </span>
                        </td>
                        <td className="date-cell">
                          {new Date(profile.createdAt).toLocaleDateString()}
                        </td>
                        <td className="actions-cell">
                          <div className="action-buttons">
                            <button
                              className="action-icon-btn view-btn"
                              onClick={() => handleViewProfile(profile.id)}
                              title={t('jobseekerManagement.actions.viewProfile')}
                              aria-label={t('jobseekerManagement.actions.viewProfile')}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              className="action-icon-btn edit-btn"
                              onClick={() => handleEditClick(profile)}
                              title={t('jobseekerManagement.actions.editProfile')}
                              aria-label={t('jobseekerManagement.actions.editProfile')}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="action-icon-btn delete-btn"
                              onClick={() => handleDeleteClick(profile)}
                              title={t('jobseekerManagement.actions.deleteProfile')}
                              aria-label={t('jobseekerManagement.actions.deleteProfile')}
                            >
                              <Trash2 size={16} />
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
                  {t('jobseekerManagement.pagination.pageOf', { current: pagination.page, total: pagination.totalPages })}
                </span>
              </div>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn prev"
                  onClick={handlePreviousPage}
                  disabled={!pagination.hasPrevPage}
                  title={t('jobseekerManagement.pagination.previousPage')}
                  aria-label={t('jobseekerManagement.pagination.previousPage')}
                >
                  <ChevronLeft size={16} />
                  <span>{t('jobseekerManagement.pagination.previous')}</span>
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
                          aria-label={t('jobseekerManagement.pagination.goToPage', { page: pageNum })}
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
                  title={t('jobseekerManagement.pagination.nextPage')}
                  aria-label={t('jobseekerManagement.pagination.nextPage')}
                >
                  <span>{t('jobseekerManagement.pagination.next')}</span>
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
        title={t('jobseekerManagement.deleteModal.title')}
        message={t('jobseekerManagement.deleteModal.message', { name: profileToDelete?.name || '', error: deleteError ? `\n\n${t('jobseekerManagement.deleteModal.error', { error: deleteError })}` : '' })}
        confirmText={isDeleting ? t('jobseekerManagement.deleteModal.deleting') : t('jobseekerManagement.deleteModal.confirm')}
        cancelText={t('jobseekerManagement.deleteModal.cancel')}
        confirmButtonClass="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
      {/* Edit Confirmation Modal */}
      <ConfirmationModal
        isOpen={isEditModalOpen}
        title={t('jobseekerManagement.editModal.title')}
        message={t('jobseekerManagement.editModal.message', { name: profileToEdit?.name || '' })}
        confirmText={t('jobseekerManagement.editModal.confirm')}
        cancelText={t('jobseekerManagement.editModal.cancel')}
        confirmButtonClass="primary"
        onConfirm={handleConfirmEdit}
        onCancel={handleCancelEdit}
      />
    </div>
  );
}
