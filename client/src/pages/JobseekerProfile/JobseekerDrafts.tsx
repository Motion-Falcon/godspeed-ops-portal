import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllJobseekerDrafts, deleteJobseekerDraft } from '../../services/api';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { Pencil, Trash2, ArrowLeft, Clock, User } from 'lucide-react';
import '../../styles/pages/JobSeekerManagement.css';

// Enhanced interface for JobseekerDraft to include creator/updater info
interface JobseekerDraft {
  id: string;
  user_id: string;
  email?: string;
  title?: string;
  data: Record<string, unknown>;
  lastUpdated: string;
  createdAt: string;
  createdByUserId: string;
  updatedAt: string;
  updatedByUserId: string;
  creatorDetails?: {
    id: string;
    email?: string;
    name: string;
    userType: string;
    createdAt: string;
  } | null;
  updaterDetails?: {
    id: string;
    email?: string;
    name: string;
    userType: string;
    updatedAt: string;
  } | null;
}

export function JobseekerDrafts() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<JobseekerDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        const fetchedDrafts = await getAllJobseekerDrafts();
        setDrafts(fetchedDrafts);
      } catch (err) {
        console.error('Error fetching drafts:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch drafts';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchDrafts();
  }, []);

  const handleNavigateBack = () => {
    navigate('/jobseeker-management');
  };

  const handleEditDraft = (id: string) => {
    navigate(`/jobseekers/drafts/edit/${id}`);
  };

  const confirmDeleteDraft = (id: string) => {
    setDraftToDelete(id);
    setShowDeleteConfirmation(true);
  };

  const handleDeleteDraft = async () => {
    if (!draftToDelete) return;
    
    try {
      await deleteJobseekerDraft(draftToDelete);
      
      // Remove deleted draft from state
      setDrafts((prevDrafts) => 
        prevDrafts.filter((draft) => draft.id !== draftToDelete)
      );
      
      setSuccess('Draft deleted successfully');
      
      // Auto-hide message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error deleting draft:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete draft';
      setError(errorMessage);
      
      // Auto-hide error after 3 seconds
      setTimeout(() => {
        setError(null);
      }, 3000);
    } finally {
      setDraftToDelete(null);
      setShowDeleteConfirmation(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Helper function to get email display
  const getEmailDisplay = (draft: JobseekerDraft): string => {
    // Use the email field from the draft if available
    if (draft.email) {
      return draft.email;
    }
    
    // Try to extract from form data as fallback
    if (typeof draft.data === 'object' && draft.data && 'email' in draft.data) {
      return String(draft.data.email || '');
    }
    
    return 'No email';
  };

  // Helper to format user information
  const formatUserInfo = (details: { name: string; email?: string } | null | undefined): string => {
    if (!details) return 'Unknown';
    
    if (details.name && details.email) {
      return `${details.name} (${details.email})`;
    } else if (details.name) {
      return details.name;
    } else if (details.email) {
      return details.email;
    }
    return 'Unknown';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-content">
          <button 
            className="button ghost back-button" 
            onClick={handleNavigateBack}
          >
            <ArrowLeft size={16} />
            <span>Back to Job Seekers</span>
          </button>
          <h1>Job Seeker Profile Drafts</h1>
        </div>
      </div>

      <div className="content-container">
        {error && (
          <div className="error-message">{error}</div>
        )}
        {success && (
          <div className="success-message">{success}</div>
        )}

        <div className="card">
          <div className="card-header">
            <h2>Your Saved Drafts</h2>
          </div>

          <div className="table-container">
            {loading ? (
              <div className="loading">Loading drafts...</div>
            ) : drafts.length === 0 ? (
              <div className="empty-state">
                <p>No drafts found. Create a new jobseeker profile to save a draft.</p>
                <button 
                  className="button primary"
                  onClick={() => navigate('/profile/create', { state: { isNewForm: true } })}
                >
                  Create New Profile
                </button>
              </div>
            ) : (
              <table className="profiles-table">
                <thead>
                  <tr>
                    <th>Title/Email</th>
                    <th>Last Updated</th>
                    <th>Created At</th>
                    <th>Created By</th>
                    <th>Last Updated By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((draft) => (
                    <tr key={draft.id}>
                      <td>{getEmailDisplay(draft)}</td>
                      <td>
                        {draft.lastUpdated && (
                          <div className="date-with-icon">
                            <Clock size={14} />
                            <span>{formatDate(draft.lastUpdated)}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        {draft.createdAt && (
                          <div className="date-with-icon">
                            <Clock size={14} />
                            <span>{formatDate(draft.createdAt)}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="user-with-icon">
                          <User size={14} />
                          <span>{formatUserInfo(draft.creatorDetails)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="user-with-icon">
                          <User size={14} />
                          <span>{formatUserInfo(draft.updaterDetails)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="button secondary button-icon"
                            onClick={() => handleEditDraft(draft.id)}
                            title="Edit this draft"
                          >
                            <Pencil size={16} />
                            <span>Edit</span>
                          </button>
                          <button 
                            className="button danger button-icon"
                            onClick={() => confirmDeleteDraft(draft.id)}
                            title="Delete this draft"
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

      {showDeleteConfirmation && (
        <ConfirmationModal
          isOpen={showDeleteConfirmation}
          title="Delete Draft"
          message="Are you sure you want to delete this draft? This action cannot be undone."
          confirmText="Delete Draft"
          cancelText="Cancel"
          confirmButtonClass="danger"
          onConfirm={handleDeleteDraft}
          onCancel={() => setShowDeleteConfirmation(false)}
        />
      )}
    </div>
  );
} 