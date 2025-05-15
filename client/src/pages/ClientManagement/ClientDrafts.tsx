import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Clock, Pencil } from 'lucide-react';
import { getAllClientDrafts, deleteClientDraft } from '../../services/api';
import { ClientData } from '../../services/api';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { AppHeader } from '../../components/AppHeader';
import '../../styles/pages/ClientManagement.css';
import '../../styles/components/header.css';
import '../../styles/components/CommonTable.css';

export function ClientDrafts() {
  const [drafts, setDrafts] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<ClientData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        setLoading(true);
        const data = await getAllClientDrafts();
        setDrafts(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching drafts';
        console.error('Error fetching drafts:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchDrafts();
  }, []);

  const handleEditDraft = (draft: ClientData) => {
    if (draft.id) {
      navigate(`/client-management/drafts/edit/${draft.id}`);
    } else {
      setError('Cannot edit draft: Missing ID');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteClick = (draft: ClientData) => {
    setDraftToDelete(draft);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!draftToDelete?.id) return;
    
    try {
      setIsDeleting(true);
      await deleteClientDraft(draftToDelete.id);
      
      // Remove from state
      setDrafts(prevDrafts => prevDrafts.filter(d => d.id !== draftToDelete.id));
      setSuccessMessage('Draft deleted successfully');
      
      // Auto-dismiss the success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete draft';
      setError(errorMessage);
      
      // Auto-dismiss the error message after 3 seconds
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setDraftToDelete(null);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Get the best available date from a draft
  const getLastUpdatedDate = (draft: ClientData): string | undefined => {
    // Try different possible date fields in order of preference
    return draft.lastUpdated || draft.updatedAt || draft.createdAt;
  };

  return (
    <div className="page-container">
      <AppHeader
        title="Client Drafts"
        actions={
          <button 
            className="button button-icon"
            onClick={() => navigate('/client-management')}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
        }
        statusMessage={error || successMessage}
        statusType={error ? 'error' : 'success'}
      />

      <div className="content-container">
        {loading ? (
          <div className="loading">Loading drafts...</div>
        ) : drafts.length === 0 ? (
          <div className="empty-state">
            <p>No saved drafts found.</p>
            <button 
              className="button primary"
              onClick={() => navigate('/client-management/create')}
            >
              Create New Client
            </button>
          </div>
        ) : (
          <div className="card">
            <h2>Saved Drafts</h2>
            <p>Continue working on previously saved client drafts.</p>
            
            <div className="table-container">
              <table className="common-table">
                <thead>
                  <tr>
                    <th>Company Name</th>
                    <th>Last Updated</th>
                    <th>Contact Person</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map(draft => (
                    <tr key={draft.id}>
                      <td>{draft.companyName || 'Unnamed Company'}</td>
                      <td>
                        <div className="date-display">
                          <Clock size={14} />
                          <span>{formatDate(getLastUpdatedDate(draft))}</span>
                        </div>
                      </td>
                      <td>{draft.contactPersonName1 || 'N/A'}</td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="action-icon-btn edit-btn"
                            onClick={() => handleEditDraft(draft)}
                            title="Edit this draft"
                            aria-label="Edit draft"
                          >
                            <Pencil size={20} />
                          </button>
                          <button 
                            className="action-icon-btn delete-btn"
                            onClick={() => handleDeleteClick(draft)}
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
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Delete Draft"
        message={`Are you sure you want to delete this draft${draftToDelete?.companyName ? ` for "${draftToDelete.companyName}"` : ''}? This action cannot be undone.`}
        confirmText={isDeleting ? "Deleting..." : "Delete Draft"}
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setDraftToDelete(null);
        }}
      />
    </div>
  );
} 