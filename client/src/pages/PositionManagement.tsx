import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, FileText, Eye, Trash2, Pencil } from 'lucide-react';
import { getPositions, deletePosition, PositionData } from '../services/api';
import { ConfirmationModal } from '../components/ConfirmationModal';
import '../styles/pages/PositionManagement.css';
import '../styles/components/header.css';

export function PositionManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [positionToDelete, setPositionToDelete] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [positionToEdit, setPositionToEdit] = useState<string | null>(null);
  const [showEditConfirmation, setShowEditConfirmation] = useState(false);

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
  };

  const handleDeletePosition = async () => {
    if (!positionToDelete) return;
    
    try {
      await deletePosition(positionToDelete);
      
      // Remove deleted position from state
      setPositions((prevPositions) => 
        prevPositions.filter((position) => position.id !== positionToDelete)
      );
      
      setMessage('Position deleted successfully');
      
      // Auto-hide message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (err) {
      console.error('Error deleting position:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete position';
      setError(errorMessage);
      
      // Auto-hide error after 3 seconds
      setTimeout(() => {
        setError(null);
      }, 3000);
    } finally {
      setPositionToDelete(null);
      setShowDeleteConfirmation(false);
    }
  };

  // Fetch positions on component mount
  useEffect(() => {
    const fetchPositions = async () => {
      setLoading(true);
      try {
        const data = await getPositions();
        console.log('Fetched positions:', data);
        setPositions(data);
      } catch (err) {
        console.error('Error fetching positions:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch positions';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchPositions();
  }, []);

  // Format date for display
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="page-container">
      <header className="common-header">
        <div className="header-main">
          <h1>Position Management</h1>
          <div className="header-actions">
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
          </div>
        </div>
        
        {(error || message) && (
          <div className="status-update-container">
            {error && <span className="status-update-message error">{error}</span>}
            {message && <span className="status-update-message">{message}</span>}
          </div>
        )}
      </header>

      <div className="content-container">
        <div className="card">
          <div className="card-header">
            <h2>Position List</h2>
          </div>

          <div className="table-container">
            {loading ? (
              <div className="loading">Loading positions...</div>
            ) : positions.length === 0 ? (
              <div className="empty-state">
                <p>No positions found. Click "New Position" to add one.</p>
              </div>
            ) : (
              <table className="drafts-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Client</th>
                    <th>Start Date</th>
                    <th>Location</th>
                    <th>Status</th>
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
                  {positions.map((position) => (
                    <tr key={position.id}>
                      <td>{position.title}</td>
                      <td>{position.clientName}</td>
                      <td>{formatDate(position.startDate)}</td>
                      <td>{position.city}, {position.province}</td>
                      <td>
                        <span className={`status-badge ${position.showOnJobPortal ? 'active' : 'inactive'}`}>
                          {position.showOnJobPortal ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="action-icon-btn view-btn"
                            onClick={() => handleViewPosition(position.id as string)}
                            title="View position details"
                            aria-label="View position"
                          >
                            <Eye size={20} />
                          </button>
                          <button 
                            className="action-icon-btn edit-btn"
                            onClick={() => confirmEditPosition(position.id as string)}
                            title="Edit position"
                            aria-label="Edit position"
                          >
                            <Pencil size={20} />
                          </button>
                          <button 
                            className="action-icon-btn delete-btn"
                            onClick={() => confirmDeletePosition(position.id as string)}
                            title="Delete position"
                            aria-label="Delete position"
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
          title="Delete Position"
          message="Are you sure you want to delete this position? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDeletePosition}
          onCancel={() => setShowDeleteConfirmation(false)}
        />
      )}

      {showEditConfirmation && (
        <ConfirmationModal
          isOpen={showEditConfirmation}
          title="Edit Position"
          message="Are you sure you want to edit this position's information?"
          confirmText="Edit"
          cancelText="Cancel"
          onConfirm={() => {
            navigate(`/position-management/edit/${positionToEdit}`);
            setShowEditConfirmation(false);
          }}
          onCancel={() => {
            setPositionToEdit(null);
            setShowEditConfirmation(false);
          }}
        />
      )}
    </div>
  );
} 