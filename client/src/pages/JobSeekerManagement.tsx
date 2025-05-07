import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Eye, 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock 
} from 'lucide-react';
import { getJobseekerProfiles, deleteJobseeker } from '../services/api';
import { JobSeekerProfile } from '../types/jobseeker';
import { ConfirmationModal } from '../components/ConfirmationModal';
import '../styles/pages/JobSeekerManagement.css';

export function JobSeekerManagement() {
  const [profiles, setProfiles] = useState<JobSeekerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<JobSeekerProfile | null>(null);
  const [profileToEdit, setProfileToEdit] = useState<JobSeekerProfile | null>(null);
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

  // Filter profiles based on search term and status filter
  const filteredProfiles = profiles.filter(profile => {
    const matchesSearch = 
      profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (profile.skills && profile.skills.some(skill => 
        skill.toLowerCase().includes(searchTerm.toLowerCase())
      )) ||
      (profile.location && profile.location.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || profile.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="status-icon verified" size={16} />;
      case 'rejected':
        return <XCircle className="status-icon rejected" size={16} />;
      case 'pending':
        return <Clock className="status-icon pending" size={16} />;
      default:
        return <Clock className="status-icon pending" size={16} />;
    }
  };

  const handleCreateProfile = () => {
    navigate('/profile/create');
  };

  const handleViewProfile = (id: string) => {
    // Navigate to detailed view
    navigate(`/jobseekers/${id}`);
  };

  const handleEditClick = (profile: JobSeekerProfile) => {
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

  const handleDeleteClick = (profile: JobSeekerProfile) => {
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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Job Seeker Management</h1>
        <div className="header-actions">
          <button 
            className="button primary button-icon" 
            onClick={handleCreateProfile}
          >
            <Plus size={16} />
            <span>New Job Seeker</span>
          </button>
        </div>
      </div>

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
                  placeholder="Search by name, email, skills or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              
              <div className="status-filter">
                <Filter size={18} className="filter-icon" />
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          <div className="table-container">
            {loading ? (
              <div className="loading">Loading profiles...</div>
            ) : filteredProfiles.length === 0 ? (
              <div className="empty-state">
                <p>No profiles match your search criteria.</p>
              </div>
            ) : (
              <table className="profiles-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Location</th>
                    <th>Skills</th>
                    <th>Status</th>
                    <th>Joined Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.map(profile => (
                    <tr key={profile.id}>
                      <td className="name-cell">{profile.name}</td>
                      <td className="email-cell">{profile.email}</td>
                      <td className="location-cell">{profile.location || 'N/A'}</td>
                      <td className="skills-cell">
                        {profile.skills && profile.skills.length > 0 ? (
                          <div className="skills-list">
                            {profile.skills.slice(0, 2).map((skill, index) => (
                              <span key={index} className="skill-tag">{skill}</span>
                            ))}
                            {profile.skills.length > 2 && (
                              <span className="more-skills">+{profile.skills.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="status-cell">
                        <div className="status-display">
                          {getStatusIcon(profile.status)}
                          <span className={`status-text ${profile.status}`}>
                            {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="date-cell">
                        {new Date(profile.createdAt).toLocaleDateString()}
                      </td>
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button 
                            className="button primary button-icon"
                            onClick={() => handleViewProfile(profile.id)}
                            title="View profile details"
                          >
                            <Eye size={16} />
                            <span>View</span>
                          </button>
                          <button 
                            className="button secondary button-icon"
                            onClick={() => handleEditClick(profile)}
                            title="Edit this profile"
                          >
                            <Edit size={16} />
                            <span>Edit</span>
                          </button>
                          <button 
                            className="button danger button-icon"
                            onClick={() => handleDeleteClick(profile)}
                            title="Delete this profile"
                          >
                            <Trash2 size={16} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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