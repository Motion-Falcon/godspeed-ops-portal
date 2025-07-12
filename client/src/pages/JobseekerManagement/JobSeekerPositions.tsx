import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { 
  Calendar,
  MapPin,
  Clock,
  Building,
  Briefcase,
  Search,
  X,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getCandidateAssignments, CandidateAssignment, CandidateAssignmentFilters } from '../../services/api/position';
import { AppHeader } from '../../components/AppHeader';
import '../../styles/pages/JobSeekerPositions.css';
import '../../styles/components/header.css';
import { EMPLOYMENT_TYPES, POSITION_CATEGORIES } from '../../constants/formOptions';
import { useLanguage } from '../../contexts/language/language-provider';

/**
 * FILTER IMPLEMENTATION NOTES:
 * 
 * API Supported Filters (server-side):
 * - page, limit (pagination)
 * - status (assignment status)
 * - startDate, endDate (date range filters - not currently used in UI)
 * - search (title, client, location, position code)
 * - employmentType (Full-Time, Part-Time, Contract)
 * - positionCategory (AZ, DZ, Admin, General Labour, Warehouse)
 * 
 * This means all data is fetched from the API and filtered in the backend.
 * For better performance, these filters should be moved to the backend in the future.
 */

type PositionStatus = 'current' | 'past' | 'future' | 'all';

interface FilterState {
  status: string;
  search: string;
  employmentType: string;
  positionCategory: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export function JobSeekerPositions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [assignments, setAssignments] = useState<CandidateAssignment[]>([]);
  const [statusCounts, setStatusCounts] = useState({
    active: 0,
    completed: 0,
    upcoming: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PositionStatus>('all');
  
  const ITEMS_PER_PAGE = 10;
  
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: ITEMS_PER_PAGE
  });
  
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    search: '',
    employmentType: 'all',
    positionCategory: 'all'
  });

  // --- New: Initialize filters and active tab from query params on mount ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status') || 'all';
    const validTabs: PositionStatus[] = ['all', 'current', 'past', 'future'];
    setFilters({
      status: statusParam,
      search: params.get('search') || '',
      employmentType: params.get('employmentType') || 'all',
      positionCategory: params.get('positionCategory') || 'all',
    });
    if (validTabs.includes(statusParam as PositionStatus)) {
      setActiveTab(statusParam as PositionStatus);
    } else {
      setActiveTab('all');
    }
    // Example: How to use filter params in the URL
    //
    //   /jobseeker-positions?status=current&search=driver&employmentType=Full-Time&positionCategory=AZ
    //
    // Any combination of these params can be used to pre-populate filters and tab on page load.
  }, [location.search]);
  // --- End new code ---

  // Get user's profile ID for fetching assignments
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      // Get profile ID from user metadata or fetch from API
      fetchProfileId();
    }
  }, [user]);

  useEffect(() => {
    if (profileId) {
      fetchAssignments(1);
    }
  }, [profileId]);

  useEffect(() => {
    fetchAssignments(pagination.currentPage);
  }, [pagination.currentPage]);

  // Reset to first page when filters change
  useEffect(() => {
    fetchAssignments(1); // Reset to first page when filters change
  }, [profileId, activeTab, filters.search, filters.employmentType, filters.positionCategory, t]);

  // Note: The API only supports basic pagination and status filtering
  // Search, employment type, and position category filters are handled client-side
  // This means all data is fetched and filtered in the frontend

  const fetchProfileId = async () => {
    try {
      // For now, use the user ID as profile ID - this might need adjustment based on your data structure
      setProfileId(user?.id || null);
    } catch (error) {
      console.error('Error fetching profile ID:', error);
      setError(t('jobSeekerPositions.errorLoadingProfile'));
    }
  };

  const fetchAssignments = async (page: number = 1) => {
    if (!profileId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Map frontend tab status to backend status
      let backendStatus: string | undefined;
      if (activeTab !== 'all') {
        // Map frontend tabs to backend status values
        const statusMap = {
          current: 'active',
          future: 'upcoming', 
          past: 'completed'
        };
        backendStatus = statusMap[activeTab as keyof typeof statusMap];
      }
      // For 'all' tab, don't send status filter to get all assignments
      
      const filterParams: CandidateAssignmentFilters = {
        page,
        limit: ITEMS_PER_PAGE,
        // Send search filter to API
        search: filters.search || undefined,
        // Send employment type filter to API  
        employmentType: filters.employmentType !== 'all' ? filters.employmentType : undefined,
        // Send position category filter to API
        positionCategory: filters.positionCategory !== 'all' ? filters.positionCategory : undefined,
        // Send mapped backend status
        status: backendStatus,
      };

      const response = await getCandidateAssignments(profileId, filterParams);
      
      // Set status counts and assignments from the API response
      setStatusCounts(response.statusCounts);
      setAssignments( response.assignments);
      
      // Map API pagination structure to local interface
      setPagination({
        currentPage: response.pagination.page,
        totalPages: response.pagination.totalPages,
        totalItems: response.pagination.total,
        itemsPerPage: response.pagination.limit,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('jobSeekerPositions.errorFetchingAssignments'));
      setAssignments([]);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: ITEMS_PER_PAGE,
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusCounts = () => {
    // Use the status counts from the API response instead of calculating client-side
    return {
      all: statusCounts.total,
      current: statusCounts.active,
      past: statusCounts.completed,
      future: statusCounts.upcoming
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDuration = (startDate: string, endDate?: string) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return diffDays === 1 
        ? t('jobSeekerPositions.duration.days', { count: diffDays })
        : t('jobSeekerPositions.duration.days_plural', { count: diffDays });
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1
        ? t('jobSeekerPositions.duration.months', { count: months })
        : t('jobSeekerPositions.duration.months_plural', { count: months });
    } else {
      const years = Math.floor(diffDays / 365);
      return years === 1
        ? t('jobSeekerPositions.duration.years', { count: years })
        : t('jobSeekerPositions.duration.years_plural', { count: years });
    }
  };

  const getStatusBadgeClass = (assignment: CandidateAssignment) => {
    // Map backend status to CSS class names
    const statusMap = {
      active: 'current',
      completed: 'past', 
      upcoming: 'future'
    };
    const cssStatus = statusMap[assignment.status as keyof typeof statusMap] || assignment.status;
    return `jsp-status-badge ${cssStatus}`;
  };

  const getStatusText = (assignment: CandidateAssignment) => {
    // Use the assignment status directly from the backend
    switch (assignment.status) {
      case 'active': return t('jobSeekerPositions.status.active');
      case 'completed': return t('jobSeekerPositions.status.completed');
      case 'upcoming': return t('jobSeekerPositions.status.upcoming');
      default: return assignment.status || t('jobSeekerPositions.status.unknown');
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, currentPage: 1 })); // Reset to first page
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      search: '',
      employmentType: 'all',
      positionCategory: 'all'
    });
  };

  const counts = getStatusCounts();

  // Skeleton Loading Components
  const SkeletonFilterPanel = () => (
    <div className="jsp-skeleton-filter-panel">
      <div className="jsp-skeleton-filter-row">
        <div className="jsp-skeleton-filter-group">
          <div className="jsp-skeleton-filter-label skeleton-text"></div>
          <div className="jsp-skeleton-filter-input skeleton-text"></div>
        </div>
        <div className="jsp-skeleton-filter-group">
          <div className="jsp-skeleton-filter-label skeleton-text"></div>
          <div className="jsp-skeleton-filter-input skeleton-text"></div>
        </div>
        <div className="jsp-skeleton-filter-group">
          <div className="jsp-skeleton-filter-label skeleton-text"></div>
          <div className="jsp-skeleton-filter-input skeleton-text"></div>
        </div>
        <div className="jsp-filter-actions">
          <div className="jsp-skeleton-filter-button skeleton-button"></div>
        </div>
      </div>
    </div>
  );

  const SkeletonTabs = () => (
    <div className="jsp-skeleton-tabs">
      {[1, 2, 3, 4].map((index) => (
        <div key={index} className={`jsp-skeleton-tab skeleton-button`}>
          <div className="jsp-skeleton-tab-text skeleton-text"></div>
          <div className="jsp-skeleton-tab-count skeleton-badge"></div>
        </div>
      ))}
    </div>
  );

  const SkeletonCard = () => (
    <div className="jsp-skeleton-card">
      <div className="jsp-skeleton-card-header">
        <div className="jsp-skeleton-card-title-section">
          <div className="jsp-skeleton-card-title skeleton-text"></div>
          <div className="jsp-skeleton-card-code skeleton-text"></div>
        </div>
        <div className="jsp-skeleton-card-status skeleton-badge"></div>
      </div>

      <div className="jsp-skeleton-card-details">
        <div className="jsp-skeleton-detail-row">
          <div className="jsp-skeleton-detail-icon skeleton-icon"></div>
          <div className="jsp-skeleton-detail-text medium skeleton-text"></div>
        </div>
        <div className="jsp-skeleton-detail-row">
          <div className="jsp-skeleton-detail-icon skeleton-icon"></div>
          <div className="jsp-skeleton-detail-text short skeleton-text"></div>
        </div>
        <div className="jsp-skeleton-detail-row">
          <div className="jsp-skeleton-detail-icon skeleton-icon"></div>
          <div className="jsp-skeleton-detail-text long skeleton-text"></div>
        </div>
        <div className="jsp-skeleton-detail-row">
          <div className="jsp-skeleton-detail-icon skeleton-icon"></div>
          <div className="jsp-skeleton-detail-text medium skeleton-text"></div>
        </div>
      </div>

      <div className="jsp-skeleton-card-meta">
        <div className="jsp-skeleton-meta-tags">
          <div className="jsp-skeleton-tag medium skeleton-badge"></div>
          <div className="jsp-skeleton-tag small skeleton-badge"></div>
          <div className="jsp-skeleton-tag large skeleton-badge"></div>
          <div className="jsp-skeleton-tag medium skeleton-badge"></div>
        </div>
      </div>
    </div>
  );

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, currentPage: page }));
  };

  const handleTabChange = (tab: PositionStatus) => {
    setActiveTab(tab);
    setPagination((prev) => ({ ...prev, currentPage: 1 })); // Reset to first page
  };

  const handlePreviousPage = () => {
    if (pagination.currentPage > 1) {
      handlePageChange(pagination.currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      handlePageChange(pagination.currentPage + 1);
    }
  };

  if (error) {
    return (
      <div className="jsp-positions-container">
        <AppHeader title={t('jobSeekerPositions.title')} />
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button className="button primary" onClick={() => fetchAssignments(1)}>
            {t('jobSeekerPositions.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="jsp-positions-container">
      <AppHeader
        title={t('jobSeekerPositions.title')}
        actions={
          <button
            className="button secondary"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={16} />
            {t('jobSeekerPositions.backToDashboard')}
          </button>
        }
      />

      <div className="jsp-positions-content">
        {/* Filter Panel */}
        {loading ? (
          <SkeletonFilterPanel />
        ) : (
          <div className="jsp-filter-panel">
            <div className="jsp-filter-row">
              <div className="jsp-filter-group">
                <label>{t('jobSeekerPositions.filters.search')}</label>
                <div className="jsp-search-input">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder={t('jobSeekerPositions.filters.searchPlaceholder')}
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                  />
                  {filters.search && (
                    <button 
                      className="jsp-clear-search"
                      onClick={(e) => {
                        e.preventDefault();
                        handleFilterChange('search', '');
                      }}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>

              <div className="jsp-filter-group">
                <label>{t('jobSeekerPositions.filters.employmentType')}</label>
                <select
                  value={filters.employmentType}
                  onChange={(e) => handleFilterChange('employmentType', e.target.value)}
                >
                  <option value="all">{t('jobSeekerPositions.filters.allTypes')}</option>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="jsp-filter-group">
                <label>{t('jobSeekerPositions.filters.category')}</label>
                <select
                  value={filters.positionCategory}
                  onChange={(e) => handleFilterChange('positionCategory', e.target.value)}
                >
                  <option value="all">{t('jobSeekerPositions.filters.allCategories')}</option>
                  {POSITION_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="jsp-filter-actions">
                <button className="button secondary small" onClick={clearFilters}>
                  {t('jobSeekerPositions.filters.clearAll')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status Tabs */}
        {loading ? (
          <SkeletonTabs />
        ) : (
          <div className="jsp-status-tabs">
            <button
              className={`jsp-tab all ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => handleTabChange('all')}
            >
              {t('jobSeekerPositions.tabs.allPositions')}
              <span className="jsp-count">{counts.all}</span>
            </button>
            <button
              className={`jsp-tab current ${activeTab === 'current' ? 'active' : ''}`}
              onClick={() => handleTabChange('current')}
            >
              {t('jobSeekerPositions.tabs.current')}
              <span className="jsp-count">{counts.current}</span>
            </button>
            <button
              className={`jsp-tab future ${activeTab === 'future' ? 'active' : ''}`}
              onClick={() => handleTabChange('future')}
            >
              {t('jobSeekerPositions.tabs.upcoming')}
              <span className="jsp-count">{counts.future}</span>
            </button>
            <button
              className={`jsp-tab past ${activeTab === 'past' ? 'active' : ''}`}
              onClick={() => handleTabChange('past')}
            >
              {t('jobSeekerPositions.tabs.completed')}
              <span className="jsp-count">{counts.past}</span>
            </button>
          </div>
        )}

        {/* Pagination Controls - Top */}
        {!loading && pagination.totalPages > 1 && (
          <div className="jsp-pagination-controls top">
            <div className="jsp-pagination-info">
              <span className="jsp-pagination-text">
                {t('jobSeekerPositions.pagination.showing', {
                  start: Math.min((pagination.currentPage - 1) * pagination.itemsPerPage + 1, pagination.totalItems),
                  end: Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems),
                  total: pagination.totalItems
                })}
              </span>
            </div>
          </div>
        )}

        {/* Positions List */}
        {loading ? (
          <div className="jsp-positions-list">
            {Array.from({ length: ITEMS_PER_PAGE }, (_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : (
          <div className="jsp-positions-list">
            {assignments.length === 0 ? (
              <div className="jsp-empty-state">
                <Briefcase size={48} className="jsp-empty-icon" />
                <h3>{t('jobSeekerPositions.emptyState.noPositionsFound')}</h3>
                <p>
                  {activeTab === 'all' 
                    ? t('jobSeekerPositions.emptyState.noAssignments')
                    : t('jobSeekerPositions.emptyState.noTabPositions', { status: activeTab })
                  }
                </p>
              </div>
            ) : (
              assignments.map((assignment) => (
                <div key={assignment.id} className="jsp-position-card" data-status={(() => {
                  const statusMap = {
                    active: 'current',
                    completed: 'past',
                    upcoming: 'future'
                  };
                  return statusMap[assignment.status as keyof typeof statusMap] || assignment.status;
                })()}>
                  <div className="jsp-position-header">
                    <div className="jsp-position-title-section">
                      <h3 className="jsp-position-title">{assignment.position?.title}</h3>
                    <div className="jsp-position-code">
                      {assignment.position?.positionCode}
                    </div>
                    </div>
                      <div className={getStatusBadgeClass(assignment)}>
                        {getStatusText(assignment)}
                      </div>
                  </div>

                  <div className="jsp-position-details">
                    <div className="jsp-detail-row">
                      <Building size={16} />
                      <span>{assignment.position?.clientName}</span>
                    </div>
                    
                    <div className="jsp-detail-row">
                      <MapPin size={16} />
                      <span>
                        {assignment.position?.city}, {assignment.position?.province}
                      </span>
                    </div>

                    {assignment.position?.startDate && (
                      <div className="jsp-detail-row">
                        <Calendar size={16} />
                        <span>
                          {t('jobSeekerPositions.positionDetails.positionPeriod')}: {formatDate(assignment.position.startDate)}
                          {assignment.position.endDate && ` - ${formatDate(assignment.position.endDate)}`}
                        </span>
                      </div>
                    )}

                    <div className="jsp-detail-row">
                      <Clock size={16} />
                      <span>{t('jobSeekerPositions.positionDetails.duration')}: {formatDuration(assignment.startDate, assignment.endDate)}</span>
                    </div>
                  </div>

                  <div className="jsp-position-meta">
                    <div className="jsp-meta-tags">
                      <span className="jsp-tag employment-type">
                        {assignment.position?.employmentType}
                      </span>
                      {assignment.position?.employmentTerm && (
                        <span className="jsp-tag employment-term">
                          {assignment.position.employmentTerm}
                        </span>
                      )}
                      <span className="jsp-tag position-category">
                        {assignment.position?.positionCategory}
                      </span>
                      <span className="jsp-tag experience">
                        {assignment.position?.experience}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pagination Controls - Bottom */}
        {!loading && pagination.totalPages > 1 && (
          <div className="jsp-pagination-controls bottom">
            <div className="jsp-pagination-info">
              <span className="jsp-pagination-text">
                {t('jobSeekerPositions.pagination.page', {
                  current: pagination.currentPage,
                  total: pagination.totalPages
                })}
              </span>
            </div>
            <div className="jsp-pagination-buttons">
              <button
                className="jsp-pagination-btn prev"
                onClick={handlePreviousPage}
                disabled={pagination.currentPage === 1}
                title={t('jobSeekerPositions.pagination.previousPage')}
                aria-label={t('jobSeekerPositions.pagination.previousPage')}
              >
                <ChevronLeft size={16} />
                <span>{t('jobSeekerPositions.pagination.previous')}</span>
              </button>
              
              {/* Page numbers */}
              <div className="jsp-page-numbers">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.currentPage >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      className={`jsp-page-number-btn ${pageNum === pagination.currentPage ? 'active' : ''}`}
                      onClick={() => handlePageChange(pageNum)}
                      aria-label={t('jobSeekerPositions.pagination.goToPage', { page: pageNum })}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                className="jsp-pagination-btn next"
                onClick={handleNextPage}
                disabled={pagination.currentPage === pagination.totalPages}
                title={t('jobSeekerPositions.pagination.nextPage')}
                aria-label={t('jobSeekerPositions.pagination.nextPage')}
              >
                <span>{t('jobSeekerPositions.pagination.next')}</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 