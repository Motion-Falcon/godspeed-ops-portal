import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar,
  MapPin,
  Clock,
  DollarSign,
  Building,
  Briefcase,
  Filter,
  Search,
  X,
  User,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { getCandidateAssignments, CandidateAssignment, CandidateAssignmentFilters } from '../services/api/position';
import { AppHeader } from '../components/AppHeader';
import '../styles/pages/JobSeekerPositions.css';
import '../styles/components/header.css';

type PositionStatus = 'current' | 'past' | 'future' | 'all';

interface FilterState {
  status: string;
  search: string;
  employmentType: string;
  positionCategory: string;
}

export function JobSeekerPositions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<CandidateAssignment[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<CandidateAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PositionStatus>('all');
  const [showFilters, setShowFilters] = useState(false);
  
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
      fetchAssignments();
    }
  }, [profileId]);

  useEffect(() => {
    filterAndSortAssignments();
  }, [assignments, activeTab, filters]);

  const fetchProfileId = async () => {
    try {
      // For now, use the user ID as profile ID - this might need adjustment based on your data structure
      setProfileId(user?.id || null);
    } catch (error) {
      console.error('Error fetching profile ID:', error);
      setError('Failed to load profile information');
    }
  };

  const fetchAssignments = async () => {
    if (!profileId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const params: CandidateAssignmentFilters = {
        page: 1,
        limit: 100, // Get all assignments for now
        status: filters.status === 'all' ? undefined : filters.status
      };

      const response = await getCandidateAssignments(profileId, params);
      setAssignments(response.assignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setError('Failed to load position assignments');
    } finally {
      setLoading(false);
    }
  };

  const getPositionStatus = (assignment: CandidateAssignment): PositionStatus => {
    const today = new Date();
    const startDate = new Date(assignment.startDate);
    const endDate = assignment.endDate ? new Date(assignment.endDate) : null;

    if (endDate && today > endDate) {
      return 'past';
    } else if (today >= startDate && (!endDate || today <= endDate)) {
      return 'current';
    } else if (today < startDate) {
      return 'future';
    }
    
    return 'current'; // fallback
  };

  const filterAndSortAssignments = () => {
    let filtered = assignments.filter(assignment => {
      // Filter by tab status
      if (activeTab !== 'all') {
        const positionStatus = getPositionStatus(assignment);
        if (positionStatus !== activeTab) return false;
      }

      // Filter by search term
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const position = assignment.position;
        if (!position) return false;
        
        const searchableText = [
          position.title,
          position.clientName,
          position.positionCode,
          position.city,
          position.province
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(searchTerm)) return false;
      }

      // Filter by employment type
      if (filters.employmentType !== 'all' && assignment.position?.employmentType !== filters.employmentType) {
        return false;
      }

      // Filter by position category
      if (filters.positionCategory !== 'all' && assignment.position?.positionCategory !== filters.positionCategory) {
        return false;
      }

      return true;
    });

    // Sort by start date (newest first)
    filtered = filtered.sort((a, b) => {
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

    setFilteredAssignments(filtered);
  };

  const getStatusCounts = () => {
    const counts = {
      all: assignments.length,
      current: 0,
      past: 0,
      future: 0
    };

    assignments.forEach(assignment => {
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

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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

  if (loading) {
    return (
      <div className="jsp-positions-container">
        <AppHeader title="My Positions" />
        <div className="jsp-loading-container">
          <div className="jsp-loading-spinner"></div>
          <p>Loading your positions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="jsp-positions-container">
        <AppHeader title="My Positions" />
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button className="button primary" onClick={fetchAssignments}>
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
                      onClick={() => handleFilterChange('search', '')}
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
                  <option value="Full-Time">Full-Time</option>
                  <option value="Part-Time">Part-Time</option>
                  <option value="Contract">Contract</option>
                </select>
              </div>

              <div className="jsp-filter-group">
                <label>Category</label>
                <select
                  value={filters.positionCategory}
                  onChange={(e) => handleFilterChange('positionCategory', e.target.value)}
                >
                  <option value="all">All Categories</option>
                  <option value="Admin">Admin</option>
                  <option value="AZ">AZ Driver</option>
                  <option value="DZ">DZ Driver</option>
                  <option value="General Labour">General Labour</option>
                  <option value="Warehouse">Warehouse</option>
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

        {/* Status Tabs */}
        <div className="jsp-status-tabs">
          <button
            className={`jsp-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Positions
            <span className="jsp-count">{counts.all}</span>
          </button>
          <button
            className={`jsp-tab ${activeTab === 'current' ? 'active' : ''}`}
            onClick={() => setActiveTab('current')}
          >
            Current
            <span className="jsp-count">{counts.current}</span>
          </button>
          <button
            className={`jsp-tab ${activeTab === 'future' ? 'active' : ''}`}
            onClick={() => setActiveTab('future')}
          >
            Upcoming
            <span className="jsp-count">{counts.future}</span>
          </button>
          <button
            className={`jsp-tab ${activeTab === 'past' ? 'active' : ''}`}
            onClick={() => setActiveTab('past')}
          >
            Completed
            <span className="jsp-count">{counts.past}</span>
          </button>
        </div>

        {/* Positions List */}
        <div className="jsp-positions-list">
          {filteredAssignments.length === 0 ? (
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
            filteredAssignments.map((assignment) => (
              <div key={assignment.id} className="jsp-position-card">
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

                  <div className="jsp-detail-row">
                    <Calendar size={16} />
                    <span>
                      Assignment: {formatDate(assignment.startDate)}
                      {assignment.endDate && ` - ${formatDate(assignment.endDate)}`}
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

                  {assignment.position?.regularPayRate && (
                    <div className="jsp-detail-row">
                      <DollarSign size={16} />
                      <span>Pay Rate: ${assignment.position.regularPayRate}/hour</span>
                    </div>
                  )}

                  <div className="jsp-detail-row">
                    <User size={16} />
                    <span>Assignment Status: {assignment.status}</span>
                  </div>

                  {assignment.position?.numberOfPositions && (
                    <div className="jsp-detail-row">
                      <FileText size={16} />
                      <span>Total Positions Available: {assignment.position.numberOfPositions}</span>
                    </div>
                  )}
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
      </div>
    </div>
  );
} 