import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
  AlertTriangle
} from 'lucide-react';
import { getJobseekerProfiles, deleteJobseeker } from '../services/api';
import { JobSeekerProfile } from '../types/jobseeker';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { AppHeader } from '../components/AppHeader';
import '../styles/pages/JobSeekerManagement.css';
import '../styles/components/header.css';
import '../styles/components/CommonTable.css';

// Extend the JobSeekerProfile type to include documents
interface ExtendedJobSeekerProfile extends JobSeekerProfile {
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

export function JobSeekerManagement() {
  const [profiles, setProfiles] = useState<ExtendedJobSeekerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [experienceFilter, setExperienceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<ExtendedJobSeekerProfile | null>(null);
  const [profileToEdit, setProfileToEdit] = useState<ExtendedJobSeekerProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { isAdmin, isRecruiter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  useEffect(() => {
    // Check if user has access
    if (!isAdmin && !isRecruiter) {
      navigate('/dashboard');
      return;
    }

    const fetchProfiles = async () => {
      try {
        console.log('Fetching jobseeker profiles...');
        setLoading(true);
        const data = await getJobseekerProfiles();
        console.log('Fetched profiles:', data);
        setProfiles(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching profiles';
        console.error('Error fetching profiles:', err);
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
    };

    fetchProfiles();
  }, [isAdmin, isRecruiter, navigate]);

  // Check if a profile needs attention based on AI validation
  const profileNeedsAttention = (profile: ExtendedJobSeekerProfile): boolean => {
    // Only check for pending profiles
    if (profile.status !== 'pending') return false;
    
    // Check if profile has documents with AI validation issues
    if (!profile.documents || profile.documents.length === 0) return false;
    
    return profile.documents.some(doc => {
      if (!doc.aiValidation) return false;
      
      return (
        doc.aiValidation.is_tampered === true ||
        doc.aiValidation.is_blurry === true ||
        doc.aiValidation.is_text_clear === true ||
        doc.aiValidation.is_resubmission_required === true
      );
    });
  };

  // Get the effective status for display (including the 'need attention' status)
  const getEffectiveStatus = (profile: ExtendedJobSeekerProfile): string => {
    if (profile.status === 'pending' && profileNeedsAttention(profile)) {
      return 'need-attention';
    }
    return profile.status;
  };

  // Filter profiles based on all filter criteria
  const filteredProfiles = profiles.filter(profile => {
    // Get the effective status for filtering
    const effectiveStatus = getEffectiveStatus(profile);
    
    // Global search filter
    const matchesGlobalSearch = searchTerm === '' || 
      profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (profile.experience && profile.experience.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (profile.location && profile.location.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Individual column filters
    const matchesName = nameFilter === '' || 
      profile.name.toLowerCase().includes(nameFilter.toLowerCase());
    
    const matchesEmail = emailFilter === '' || 
      profile.email.toLowerCase().includes(emailFilter.toLowerCase());
    
    const matchesLocation = locationFilter === '' || 
      (profile.location && profile.location.toLowerCase().includes(locationFilter.toLowerCase()));
    
    const matchesExperience = experienceFilter === 'all' || 
      profile.experience === experienceFilter;
    
    // Status filter handling for 'need-attention'
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'need-attention' && effectiveStatus === 'need-attention') ||
      (statusFilter !== 'need-attention' && profile.status === statusFilter);
    
    // Date filter
    const matchesDate = dateFilter === '' || 
      (new Date(profile.createdAt).toISOString().split('T')[0] === dateFilter);
    
    return matchesGlobalSearch && matchesName && matchesEmail && 
           matchesLocation && matchesExperience && matchesStatus && matchesDate;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="status-icon verified" size={16} />;
      case 'rejected':
        return <XCircle className="status-icon rejected" size={16} />;
      case 'pending':
        return <Clock className="status-icon pending" size={16} />;
      case 'need-attention':
        return <AlertTriangle className="status-icon need-attention" size={16} />;
      default:
        return <Clock className="status-icon pending" size={16} />;
    }
  };

  const formatStatusLabel = (status: string): string => {
    if (status === 'need-attention') return 'Needs Attention';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleCreateProfile = () => {
    navigate('/profile/create', { state: { isNewForm: true } });
  };

  const handleViewDrafts = () => {
    navigate('/jobseekers/drafts');
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
      
      // Remove the deleted profile from the state
      setProfiles(prevProfiles => 
        prevProfiles.filter(profile => profile.id !== profileToDelete.id)
      );
      
      // Close the modal
      setIsDeleteModalOpen(false);
      setProfileToDelete(null);
      setMessage("Profile deleted successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete profile';
      setDeleteError(errorMessage);
      console.error('Error deleting profile:', err);
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
    setNameFilter('');
    setEmailFilter('');
    setLocationFilter('');
    setExperienceFilter('all');
    setStatusFilter('all');
    setDateFilter('');
  };

  return (
    <div className="page-container">
      <AppHeader
        title="Job Seeker Management"
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
              onClick={handleCreateProfile}
            >
              <Plus size={16} />
              <span>New Job Seeker</span>
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
            <h2>Job Seeker Profiles</h2>
            <div className="filter-container">
              <div className="search-box">
                <Search size={18} className="search-icon" />
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

          <div className="table-container">
            {loading ? (
              <div className="loading">Loading profiles...</div>
            ) : (
              <table className="common-table">
                <thead>
                  <tr>
                    <th>
                      <div className="column-filter">
                        <div className="column-title">Name</div>
                        <div className="column-search">
                          <input
                            type="text"
                            placeholder="Search name..."
                            value={nameFilter}
                            onChange={(e) => setNameFilter(e.target.value)}
                            className="column-search-input"
                          />
                        </div>
                      </div>
                    </th>
                    <th>
                      <div className="column-filter">
                        <div className="column-title">Email</div>
                        <div className="column-search">
                          <input
                            type="text"
                            placeholder="Search email..."
                            value={emailFilter}
                            onChange={(e) => setEmailFilter(e.target.value)}
                            className="column-search-input"
                          />
                        </div>
                      </div>
                    </th>
                    <th>
                      <div className="column-filter">
                        <div className="column-title">Location</div>
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
                        <div className="column-title">Experience</div>
                        <div className="column-search">
                          <select
                            value={experienceFilter}
                            onChange={(e) => setExperienceFilter(e.target.value)}
                            className="column-filter-select"
                          >
                            <option value="all">All Experience</option>
                            <option value="0-6 Months">0-6 Months</option>
                            <option value="6-12 Months">6-12 Months</option>
                            <option value="1-2 Years">1-2 Years</option>
                            <option value="2-3 Years">2-3 Years</option>
                            <option value="3-4 Years">3-4 Years</option>
                            <option value="4-5 Years">4-5 Years</option>
                            <option value="5+ Years">5+ Years</option>
                          </select>
                        </div>
                      </div>
                    </th>
                    <th>
                      <div className="column-filter">
                        <div className="column-title">Status</div>
                        <div className="column-search">
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="column-filter-select"
                          >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="verified">Verified</option>
                            <option value="rejected">Rejected</option>
                            <option value="need-attention">Needs Attention</option>
                          </select>
                        </div>
                      </div>
                    </th>
                    <th>
                      <div className="column-filter">
                        <div className="column-title">Joined Date</div>
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
                        <div className="column-title">Actions</div>
                        <div className="column-search">
                          {/* Empty space to maintain consistent alignment */}
                          <div className="actions-placeholder"></div>
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-state-cell">
                        <div className="empty-state">
                          <p>No profiles match your search criteria.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map(profile => {
                      const effectiveStatus = getEffectiveStatus(profile);
                      return (
                        <tr key={profile.id}>
                          <td className="name-cell">{profile.name}</td>
                          <td className="email-cell">{profile.email}</td>
                          <td className="location-cell">{profile.location || 'N/A'}</td>
                          <td className="experience-cell">{profile.experience}</td>
                          <td className="status-cell">
                            <div className="status-display">
                              {getStatusIcon(effectiveStatus)}
                              <span className={`status-text ${effectiveStatus}`}>
                                {formatStatusLabel(effectiveStatus)}
                              </span>
                            </div>
                          </td>
                          <td className="date-cell">
                            {new Date(profile.createdAt).toLocaleDateString()}
                          </td>
                          <td className="actions-cell">
                            <div className="action-buttons">
                              <button 
                                className="action-icon-btn view-btn"
                                onClick={() => handleViewProfile(profile.id)}
                                title="View profile details"
                                aria-label="View profile"
                              >
                                <Eye size={20} />
                              </button>
                              <button 
                                className="action-icon-btn edit-btn"
                                onClick={() => handleEditClick(profile)}
                                title="Edit this profile"
                                aria-label="Edit profile"
                              >
                                <Pencil size={20} />
                              </button>
                              <button 
                                className="action-icon-btn delete-btn"
                                onClick={() => handleDeleteClick(profile)}
                                title="Delete this profile"
                                aria-label="Delete profile"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Delete Profile"
        message={`Are you sure you want to delete the profile for ${profileToDelete?.name}? This action cannot be undone.${deleteError ? `\n\nError: ${deleteError}` : ''}`}
        confirmText={isDeleting ? "Deleting..." : "Delete Profile"}
        cancelText="Cancel"
        confirmButtonClass="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Edit Confirmation Modal */}
      <ConfirmationModal
        isOpen={isEditModalOpen}
        title="Edit Profile"
        message={`Are you sure you want to edit the profile for ${profileToEdit?.name}? You will be redirected to the profile editor.`}
        confirmText="Edit Profile"
        cancelText="Cancel"
        confirmButtonClass="primary"
        onConfirm={handleConfirmEdit}
        onCancel={handleCancelEdit}
      />
    </div>
  );
} 