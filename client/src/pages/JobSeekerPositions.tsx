import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar,
  MapPin,
  Clock,
  Building,
  Briefcase,
  Filter,
  Search,
  X,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getCandidateAssignments, CandidateAssignment, CandidateAssignmentFilters } from '../services/api/position';
import { AppHeader } from '../components/AppHeader';
import '../styles/pages/JobSeekerPositions.css';
import '../styles/components/header.css';
import { EMPLOYMENT_TYPES, POSITION_CATEGORIES } from '../constants/formOptions';

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
  const [assignments, setAssignments] = useState<CandidateAssignment[]>([]);
  const [allAssignments, setAllAssignments] = useState<CandidateAssignment[]>([]); // For calculating counts
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PositionStatus>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination settings - set PAGINATION_ENABLED to true to re-enable pagination
  const PAGINATION_ENABLED = false;
  const ITEMS_PER_PAGE = PAGINATION_ENABLED ? 5 : 10000; // High number to get all items when disabled
  
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
      fetchAllAssignmentsForCounts(); // Fetch all assignments for tab counts
    }
  }, [profileId]);

  useEffect(() => {
    if (PAGINATION_ENABLED) {
      fetchAssignments(pagination.currentPage);
    }
  }, [pagination.currentPage]);

  // Reset to first page when filters change
  useEffect(() => {
    fetchAssignments(1); // Reset to first page when filters change
  }, [profileId, activeTab, filters.search, filters.employmentType, filters.positionCategory]);

  // Refetch counts when filters change (except activeTab)
  useEffect(() => {
    if (profileId) {
      fetchAllAssignmentsForCounts();
    }
  }, [profileId, filters.search, filters.employmentType, filters.positionCategory]);

  // Note: The API only supports basic pagination and status filtering
  // Search, employment type, and position category filters are handled client-side
  // This means all data is fetched and filtered in the frontend

  const fetchProfileId = async () => {
    try {
      // For now, use the user ID as profile ID - this might need adjustment based on your data structure
      setProfileId(user?.id || null);
    } catch (error) {
      console.error('Error fetching profile ID:', error);
      setError('Failed to load profile information');
    }
  };

  const fetchAssignments = async (page: number = 1) => {
    if (!profileId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Map frontend tab status to backend status
      let backendStatus: string | undefined;
      if (activeTab === 'current' || activeTab === 'future' || activeTab === 'past') {
        // For current, future, and past, we need active assignments and will filter by date on frontend
        backendStatus = 'active';
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
      
      // Get all assignments and apply universal sorting first
      const allFilteredAssignments = response.assignments || [];
      
      // Sort ALL assignments: active first, then upcoming by start date, then completed last
      allFilteredAssignments.sort((a, b) => {
        const statusA = getPositionStatus(a);
        const statusB = getPositionStatus(b);
        
        // Priority order: current -> future -> past
        const statusPriority = { current: 0, future: 1, past: 2 };
        
        if (statusA !== statusB) {
          const priorityA = statusPriority[statusA as keyof typeof statusPriority] ?? 999;
          const priorityB = statusPriority[statusB as keyof typeof statusPriority] ?? 999;
          return priorityA - priorityB;
        }
        
        // Within the same status category, sort by date
        if (statusA === 'current' || statusA === 'past') {
          // For current and past, sort by start date (newest first)
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        } else if (statusA === 'future') {
          // For upcoming, sort by start date (earliest first)
          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        }
        
        return 0;
      });
      
      // Now apply frontend date-based filtering for specific tabs AFTER sorting
      let finalAssignments = allFilteredAssignments;
      
      if (activeTab === 'current') {
        finalAssignments = allFilteredAssignments.filter(assignment => 
          getPositionStatus(assignment) === 'current'
        );
      } else if (activeTab === 'future') {
        finalAssignments = allFilteredAssignments.filter(assignment => 
          getPositionStatus(assignment) === 'future'
        );
      } else if (activeTab === 'past') {
        finalAssignments = allFilteredAssignments.filter(assignment => 
          getPositionStatus(assignment) === 'past'
        );
      }
      // For 'all' tab, we keep all sorted assignments
      
      setAssignments(finalAssignments);
      
      // Map API pagination structure to local interface
      setPagination({
        currentPage: response.pagination.page,
        totalPages: response.pagination.totalPages,
        totalItems: response.pagination.total,
        itemsPerPage: response.pagination.limit,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch assignments");
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

  // Fetch all assignments for calculating tab counts
  const fetchAllAssignmentsForCounts = async () => {
    if (!profileId) return;
    
    try {
      const filterParams: CandidateAssignmentFilters = {
        page: 1,
        limit: 10000000, // Get a large number to capture all assignments for counting
        search: filters.search || undefined,
        employmentType: filters.employmentType !== 'all' ? filters.employmentType : undefined,
        positionCategory: filters.positionCategory !== 'all' ? filters.positionCategory : undefined,
        // Don't filter by status - we want all assignments for counting
      };

      const response = await getCandidateAssignments(profileId, filterParams);
      setAllAssignments(response.assignments || []);
    } catch (err) {
      console.error('Error fetching all assignments for counts:', err);
    }
  };

  const getPositionStatus = (assignment: CandidateAssignment): PositionStatus => {
    const today = new Date();
    const startDate = new Date(assignment.startDate);
    const endDate = assignment.endDate ? new Date(assignment.endDate) : null;

    // Compare dates without time components to avoid time-of-day issues
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDateOnly = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) : null;

    if (endDateOnly && todayDateOnly > endDateOnly) {
      return 'past';
    } else if (todayDateOnly >= startDateOnly && (!endDateOnly || todayDateOnly <= endDateOnly)) {
      return 'current';
    } else if (todayDateOnly < startDateOnly) {
      return 'future';
    }
    
    return 'current'; // fallback
  };

  const getStatusCounts = () => {
    // Calculate counts from all assignments for tab display
    const counts = {
      all: allAssignments.length,
      current: 0,
      past: 0,
      future: 0
    };

    allAssignments.forEach(assignment => {
      const status = getPositionStatus(assignment);
      counts[status]++;
    });

    return counts;
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
      return `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years > 1 ? 's' : ''}`;
    }
  };

  const getStatusBadgeClass = (assignment: CandidateAssignment) => {
    const status = getPositionStatus(assignment);
    return `jsp-status-badge ${status}`;
  };

  const getStatusText = (assignment: CandidateAssignment) => {
    const status = getPositionStatus(assignment);
    switch (status) {
      case 'current': return 'Active';
      case 'past': return 'Completed';
      case 'future': return 'Upcoming';
      default: return 'Unknown';
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
        <AppHeader title="My Positions" />
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button className="button primary" onClick={() => fetchAssignments(1)}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="jsp-positions-container">
      <AppHeader
        title="My Positions"
        actions={
          <button
            className="button secondary"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
        }
      />

      <div className="jsp-positions-content">
        {/* Header Section */}
        <div className="jsp-positions-header">
          
          <div className="jsp-header-actions">
            <button
              className={`jsp-filter-toggle ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} />
              Filters
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="jsp-filter-panel">
            <div className="jsp-filter-row">
              <div className="jsp-filter-group">
                <label>Search</label>
                <div className="jsp-search-input">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search positions, clients, locations..."
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
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="jsp-filter-group">
                <label>Employment Type</label>
                <select
                  value={filters.employmentType}
                  onChange={(e) => handleFilterChange('employmentType', e.target.value)}
                >
                  <option value="all">All Types</option>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="jsp-filter-group">
                <label>Category</label>
                <select
                  value={filters.positionCategory}
                  onChange={(e) => handleFilterChange('positionCategory', e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {POSITION_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="jsp-filter-actions">
                <button className="button secondary small" onClick={clearFilters}>
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pagination Controls - Top */}
        {PAGINATION_ENABLED && !loading && pagination.totalPages > 1 && (
          <div className="jsp-pagination-controls top">
            <div className="jsp-pagination-info">
              <span className="jsp-pagination-text">
                Showing {Math.min((pagination.currentPage - 1) * pagination.itemsPerPage + 1, pagination.totalItems)} to{' '}
                {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of {pagination.totalItems} entries
              </span>
            </div>
            <div className="jsp-pagination-size-selector">
              <label htmlFor="pageSize" className="jsp-page-size-label">Show:</label>
              <select
                id="pageSize"
                value={pagination.itemsPerPage}
                onChange={(e) => handleFilterChange('itemsPerPage', e.target.value)}
                className="jsp-page-size-select"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="jsp-page-size-label">per page</span>
            </div>
          </div>
        )}

        {/* Status Tabs */}
        {loading ? (
          <div className="jsp-loading-container">
            <div className="jsp-loading-spinner"></div>
            <p>Loading status...</p>
          </div>
        ) : (
          <div className="jsp-status-tabs">
            <button
              className={`jsp-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => handleTabChange('all')}
            >
              All Positions
              <span className="jsp-count">{counts.all}</span>
            </button>
            <button
              className={`jsp-tab ${activeTab === 'current' ? 'active' : ''}`}
              onClick={() => handleTabChange('current')}
            >
              Current
              <span className="jsp-count">{counts.current}</span>
            </button>
            <button
              className={`jsp-tab ${activeTab === 'future' ? 'active' : ''}`}
              onClick={() => handleTabChange('future')}
            >
              Upcoming
              <span className="jsp-count">{counts.future}</span>
            </button>
            <button
              className={`jsp-tab ${activeTab === 'past' ? 'active' : ''}`}
              onClick={() => handleTabChange('past')}
            >
              Completed
              <span className="jsp-count">{counts.past}</span>
            </button>
          </div>
        )}

        {/* Positions List */}
        {loading ? (
          <div className="jsp-loading-container">
            <div className="jsp-loading-spinner"></div>
            <p>Loading your positions...</p>
          </div>
        ) : (
          <div className="jsp-positions-list">
            {assignments.length === 0 ? (
              <div className="jsp-empty-state">
                <Briefcase size={48} className="jsp-empty-icon" />
                <h3>No positions found</h3>
                <p>
                  {activeTab === 'all' 
                    ? "You don't have any position assignments yet."
                    : `No ${activeTab} positions found.`
                  }
                </p>
              </div>
            ) : (
              assignments.map((assignment) => (
                <div key={assignment.id} className="jsp-position-card" data-status={getPositionStatus(assignment)}>
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
                          Position Period: {formatDate(assignment.position.startDate)}
                          {assignment.position.endDate && ` - ${formatDate(assignment.position.endDate)}`}
                        </span>
                      </div>
                    )}

                    <div className="jsp-detail-row">
                      <Clock size={16} />
                      <span>Duration: {formatDuration(assignment.startDate, assignment.endDate)}</span>
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
        {PAGINATION_ENABLED && !loading && pagination.totalPages > 1 && (
          <div className="jsp-pagination-controls bottom">
            <div className="jsp-pagination-info">
              <span className="jsp-pagination-text">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
            </div>
            <div className="jsp-pagination-buttons">
              <button
                className="jsp-pagination-btn prev"
                onClick={handlePreviousPage}
                disabled={pagination.currentPage === 1}
                title="Previous page"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
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
                      aria-label={`Go to page ${pageNum}`}
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
  );
} 