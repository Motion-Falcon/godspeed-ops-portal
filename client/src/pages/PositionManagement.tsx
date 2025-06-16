import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Plus, 
  FileText, 
  Eye, 
  Trash2, 
  Pencil, 
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getPositions, deletePosition, PositionData, PositionPaginationParams } from '../services/api/position';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { AppHeader } from '../components/AppHeader';
import '../styles/pages/PositionManagement.css';
import '../styles/components/header.css';
import '../styles/components/CommonTable.css';
import { EMPLOYMENT_TERMS, EMPLOYMENT_TYPES, POSITION_CATEGORIES, EXPERIENCE_LEVELS } from "../constants/formOptions";

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
    hasPrevPage: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionIdFilter, setPositionIdFilter] = useState('');
  const [titleFilter, setTitleFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [employmentTermFilter, setEmploymentTermFilter] = useState('all');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('all');
  const [positionCategoryFilter, setPositionCategoryFilter] = useState('all');
  const [experienceFilter, setExperienceFilter] = useState('all');
  const [showOnPortalFilter, setShowOnPortalFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [positionToDelete, setPositionToDelete] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [positionToEdit, setPositionToEdit] = useState<string | null>(null);
  const [showEditConfirmation, setShowEditConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const convertToCamelCase = (data: Record<string, unknown>): ExtendedPositionData => {
    const converted: Record<string, unknown> = {};
    
    Object.entries(data).forEach(([key, value]) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
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
      console.log('Fetching positions...');
      setLoading(true);
      
      const params: PositionPaginationParams = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        positionIdFilter,
        titleFilter,
        clientFilter,
        locationFilter,
        employmentTermFilter,
        employmentTypeFilter,
        positionCategoryFilter,
        experienceFilter,
        showOnPortalFilter,
        dateFilter
      };

      const data = await getPositions(params);
      console.log('Fetched positions:', data);
      
      const convertedPositions = data.positions.map((position) => 
        convertToCamelCase(position as unknown as Record<string, unknown>)
      );
      setPositions(convertedPositions);
      setPagination(data.pagination);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching positions';
      console.error('Error fetching positions:', err);
      setError(errorMessage);
      
      // Show more detailed error info in console
      if (err instanceof Error) {
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name
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
    titleFilter,
    clientFilter,
    locationFilter,
    employmentTermFilter,
    employmentTypeFilter,
    positionCategoryFilter,
    experienceFilter,
    showOnPortalFilter,
    dateFilter
  ]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  // Reset to first page when filters change
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [
    searchTerm, 
    positionIdFilter,
    titleFilter,
    clientFilter,
    locationFilter,
    employmentTermFilter,
    employmentTypeFilter,
    positionCategoryFilter,
    experienceFilter,
    showOnPortalFilter,
    dateFilter
  ]);

  const handleCreatePosition = () => {
    navigate('/position-management/create');
  };
  
  const handleViewDrafts = () => {
    navigate('/position-management/drafts');
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
      
      setMessage('Position deleted successfully');
      
      // Auto-hide message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (err) {
      console.error('Error deleting position:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete position';
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
      setPositionToDelete(null);
      setShowDeleteConfirmation(false);
    }
  };

  // Helper to reset all filters
  const resetFilters = () => {
    setPositionIdFilter('');
    setTitleFilter('');
    setClientFilter('');
    setLocationFilter('');
    setEmploymentTermFilter('all');
    setEmploymentTypeFilter('all');
    setPositionCategoryFilter('all');
    setExperienceFilter('all');
    setShowOnPortalFilter('all');
    setDateFilter('');
    setSearchTerm('');
  };

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
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
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="page-container">
      <AppHeader
        title="Position Management"
        actions={
          <>
            <button 
              className="button secondary button-icon" 
              onClick={handleViewDrafts}
            >
              <FileText size={16} />
              <span>View Drafts</span>
            </button>
            <button 
              className="button primary button-icon" 
              onClick={handleCreatePosition}
            >
              <Plus size={16} />
              <span>New Position</span>
            </button>
          </>
        }
        statusMessage={message || error}
        statusType={error ? 'error' : 'success'}
      />

      <div className="content-container">
        {error && (
          <div className="error-message">{error}</div>
        )}
        {message && (
          <div className="success-message">{message}</div>
        )}

        <div className="card">
          <div className="card-header">
            <h2>Position List</h2>
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
                Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                {pagination.totalFiltered !== pagination.total && (
                  <span className="filtered-info"> (filtered from {pagination.total} total entries)</span>
                )}
              </span>
            </div>
            <div className="pagination-size-selector">
              <label htmlFor="pageSize" className="page-size-label">Show:</label>
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
                      <div className="column-title">Position ID</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search ID..."
                          value={positionIdFilter}
                          onChange={(e) => setPositionIdFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Position Title</div>
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
                      <div className="column-title">Client's Name</div>
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
                      <div className="column-title">Start Date</div>
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
                      <div className="column-title">Client's Location</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search location..."
                          value={locationFilter}
                          onChange={(e) => setLocationFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Employment Term</div>
                      <div className="column-search">
                        <select
                          value={employmentTermFilter}
                          onChange={(e) => setEmploymentTermFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="all">All Terms</option>
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
                      <div className="column-title">Employment Type</div>
                      <div className="column-search">
                        <select
                          value={employmentTypeFilter}
                          onChange={(e) => setEmploymentTypeFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="all">All Types</option>
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
                      <div className="column-title">Position Category</div>
                      <div className="column-search">
                        <select
                          value={positionCategoryFilter}
                          onChange={(e) => setPositionCategoryFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="all">All Categories</option>
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
                      <div className="column-title">Experience</div>
                      <div className="column-search">
                        <select
                          value={experienceFilter}
                          onChange={(e) => setExperienceFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="all">All Experience</option>
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
                      <div className="column-title">Show on Portal</div>
                      <div className="column-search">
                        <select
                          value={showOnPortalFilter}
                          onChange={(e) => setShowOnPortalFilter(e.target.value)}
                          className="column-filter-select"
                        >
                          <option value="all">All</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Actions</div>
                      <div className="column-search">
                        <div className="actions-info">
                          <span className="actions-help-text">View • Edit • Delete</span>
                        </div>
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="loading-cell">
                      <div className="loading">Loading positions...</div>
                    </td>
                  </tr>
                ) : positions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="empty-state-cell">
                      <div className="empty-state">
                        <p>No positions match your search criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  positions.map((position) => (
                    <tr key={position.id}>
                      <td className="position-id-cell">{position.positionCode || 'N/A'}</td>
                      <td className="title-cell">{position.title}</td>
                      <td className="client-cell">{position.clientName}</td>
                      <td className="date-cell">
                        <div className="date-display">{formatDate(position.startDate)}</div>
                      </td>
                      <td className="location-cell">{position.city}, {position.province}</td>
                      <td className="employment-term-cell">{position.employmentTerm || 'N/A'}</td>
                      <td className="employment-type-cell">{position.employmentType || 'N/A'}</td>
                      <td className="position-category-cell">{position.positionCategory || 'N/A'}</td>
                      <td className="experience-cell">{position.experience || 'N/A'}</td>
                      <td className="status-cell">
                        <span className={`status-badge ${position.showOnJobPortal ? 'active' : 'inactive'}`}>
                          {position.showOnJobPortal ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button 
                            className="action-icon-btn view-btn"
                            onClick={() => handleViewPosition(position.id as string)}
                            title="View position details"
                            aria-label="View position"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            className="action-icon-btn edit-btn"
                            onClick={() => confirmEditPosition(position.id as string)}
                            title="Edit position"
                            aria-label="Edit position"
                          >
                            <Pencil size={16} />
                          </button>
                          <button 
                            className="action-icon-btn delete-btn"
                            onClick={() => confirmDeletePosition(position.id as string)}
                            title="Delete position"
                            aria-label="Delete position"
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
                        className={`page-number-btn ${pageNum === pagination.page ? 'active' : ''}`}
                        onClick={() => handlePageChange(pageNum)}
                        aria-label={`Go to page ${pageNum}`}
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
        isOpen={showDeleteConfirmation}
        title="Delete Position"
        message={`Are you sure you want to delete this position? This action cannot be undone.${deleteError ? `\n\nError: ${deleteError}` : ''}`}
        confirmText={isDeleting ? "Deleting..." : "Delete Position"}
        cancelText="Cancel"
        confirmButtonClass="danger"
        onConfirm={handleDeletePosition}
        onCancel={() => setShowDeleteConfirmation(false)}
      />

      {/* Edit Confirmation Modal */}
      <ConfirmationModal
        isOpen={showEditConfirmation}
        title="Edit Position"
        message="Are you sure you want to edit this position's information?"
        confirmText="Edit Position"
        cancelText="Cancel"
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