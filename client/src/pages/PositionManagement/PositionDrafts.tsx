import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllPositionDrafts, deletePositionDraft, PositionData } from '../../services/api';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { Pencil, Trash2, ArrowLeft } from 'lucide-react';
import '../../styles/pages/PositionManagement.css';

export function PositionDrafts() {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<PositionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        const fetchedDrafts = await getAllPositionDrafts();
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
    navigate('/position-management');
  };

  const handleEditDraft = (id: string) => {
    navigate(`/position-management/drafts/edit/${id}`);
  };

  const confirmDeleteDraft = (id: string) => {
    setDraftToDelete(id);
    setShowDeleteConfirmation(true);
  };

  const handleDeleteDraft = async () => {
    if (!draftToDelete) return;
    
    try {
      await deletePositionDraft(draftToDelete);
      
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

  return (
    <div className="page-container">
      <div className="page-header">
        <button 
          className="button ghost button-icon" 
          onClick={handleNavigateBack}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <h1>Position Drafts</h1>
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
            <h2>Saved Drafts</h2>
          </div>

          <div className="table-container">
            {loading ? (
              <div className="loading">Loading drafts...</div>
            ) : drafts.length === 0 ? (
              <div className="empty-state">
                <p>No drafts found. Create a new position and save as draft.</p>
              </div>
            ) : (
              <table className="drafts-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Client</th>
                    <th>Last Updated</th>
                    <th>
                      <div className="column-filter">
                        <div className="column-title">Actions</div>
                        <div className="column-search">
                          <div className="actions-placeholder"></div>
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((draft) => (
                    <tr key={draft.id}>
                      <td>{draft.title || 'Untitled'}</td>
                      <td>{draft.clientName || 'N/A'}</td>
                      <td>
                        <div className="date-display">
                          {draft.lastUpdated 
                            ? new Date(draft.lastUpdated).toLocaleString() 
                            : 'Unknown'}
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="action-icon-btn edit-btn"
                            onClick={() => handleEditDraft(draft.id as string)}
                            title="Edit this draft"
                            aria-label="Edit draft"
                          >
                            <Pencil size={20} />
                          </button>
                          <button 
                            className="action-icon-btn delete-btn"
                            onClick={() => confirmDeleteDraft(draft.id as string)}
                            title="Delete this draft"
                            aria-label="Delete draft"
                          >
                            <Trash2 size={20} />
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
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDeleteDraft}
          onCancel={() => setShowDeleteConfirmation(false)}
        />
      )}
    </div>
  );
} 