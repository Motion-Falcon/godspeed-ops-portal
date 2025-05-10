import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  getClients, 
  ClientData, 
  deleteClient
} from '../services/api';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { Plus, Trash2, Pencil, FileText, Eye } from 'lucide-react';
import '../styles/pages/ClientManagement.css';

// Extended ClientData interface that can handle both camelCase and snake_case properties
interface ExtendedClientData extends ClientData {
  company_name?: string;
  contact_person_name1?: string;
  work_province?: string;
  [key: string]: unknown; // Allow string indexing for dynamic access
}

export function ClientManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const [clients, setClients] = useState<ExtendedClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<string | null>(null);
  const [showEditConfirmation, setShowEditConfirmation] = useState(false);

  // Function to convert snake_case keys to camelCase
  const convertToCamelCase = (data: Record<string, unknown>): ExtendedClientData => {
    const result: Record<string, unknown> = { ...data };
    
    Object.keys(data).forEach(key => {
      if (key.includes('_')) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        result[camelKey] = data[key];
      }
    });
    
    return result as ExtendedClientData;
  };

  // Get field value, checking both camelCase and snake_case properties
  const getFieldValue = (client: ExtendedClientData, field: string): string => {
    // Check camelCase version
    if (client[field] !== undefined) {
      return String(client[field] || '');
    }
    
    // Check snake_case version
    const snakeField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (client[snakeField] !== undefined) {
      return String(client[snakeField] || '');
    }
    
    // If we have a direct property accessor for this field
    switch (field) {
      case 'companyName':
        return String(client.company_name || client.companyName || '');
      case 'contactPersonName1':
        return String(client.contact_person_name1 || client.contactPersonName1 || '');
      case 'workProvince':
        return String(client.work_province || client.workProvince || '');
      default:
        return '';
    }
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

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const fetchedClients = await getClients();
        console.log('Fetched clients:', fetchedClients);
        
        // Convert each client's snake_case keys to camelCase
        const formattedClients = fetchedClients.map(client => 
          convertToCamelCase(client as unknown as Record<string, unknown>)
        );
        console.log('Formatted clients:', formattedClients);
        
        setClients(formattedClients);
      } catch (err) {
        console.error('Error fetching clients:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch clients';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  const handleCreateClient = () => {
    navigate('/client-management/create');
  };
  
  const handleViewDrafts = () => {
    navigate('/client-management/drafts');
  };

  const handleViewClient = (id: string) => {
    navigate(`/client-management/view/${id}`);
  };

  const confirmEditClient = (id: string) => {
    setClientToEdit(id);
    setShowEditConfirmation(true);
  };

  const confirmDeleteClient = (id: string) => {
    setClientToDelete(id);
    setShowDeleteConfirmation(true);
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    
    try {
      await deleteClient(clientToDelete);
      
      // Remove deleted client from state
      setClients((prevClients) => 
        prevClients.filter((client) => client.id !== clientToDelete)
      );
      
      setMessage('Client deleted successfully');
      
      // Auto-hide message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (err) {
      console.error('Error deleting client:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete client';
      setError(errorMessage);
      
      // Auto-hide error after 3 seconds
      setTimeout(() => {
        setError(null);
      }, 3000);
    } finally {
      setClientToDelete(null);
      setShowDeleteConfirmation(false);
    }
  };

  // Basic component structure - detailed client table to be added
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Client Management</h1>
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
            onClick={handleCreateClient}
          >
            <Plus size={16} />
            <span>New Client</span>
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
            <h2>Client List</h2>
          </div>

          <div className="table-container">
            {loading ? (
              <div className="loading">Loading clients...</div>
            ) : clients.length === 0 ? (
              <div className="empty-state">
                <p>No clients found. Click "New Client" to add one.</p>
              </div>
            ) : (
              <table className="drafts-table">
                <thead>
                  <tr>
                    <th>Company Name</th>
                    <th>Contact Person</th>
                    <th>Province</th>
                    <th>Currency</th>
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
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <td>{getFieldValue(client, 'companyName')}</td>
                      <td>{getFieldValue(client, 'contactPersonName1')}</td>
                      <td>{getFieldValue(client, 'workProvince')}</td>
                      <td>{client.currency}</td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="action-icon-btn view-btn"
                            onClick={() => handleViewClient(client.id as string)}
                            title="View client details"
                            aria-label="View client"
                          >
                            <Eye size={20} />
                          </button>
                          <button 
                            className="action-icon-btn edit-btn"
                            onClick={() => confirmEditClient(client.id as string)}
                            title="Edit client details"
                            aria-label="Edit client"
                          >
                            <Pencil size={20} />
                          </button>
                          <button 
                            className="action-icon-btn delete-btn"
                            onClick={() => confirmDeleteClient(client.id as string)}
                            title="Delete client"
                            aria-label="Delete client"
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
          title="Delete Client"
          message="Are you sure you want to delete this client? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDeleteClient}
          onCancel={() => setShowDeleteConfirmation(false)}
        />
      )}

      {showEditConfirmation && (
        <ConfirmationModal
          isOpen={showEditConfirmation}
          title="Edit Client"
          message="Are you sure you want to edit this client's information?"
          confirmText="Edit"
          cancelText="Cancel"
          onConfirm={() => {
            navigate(`/client-management/edit/${clientToEdit}`);
            setShowEditConfirmation(false);
          }}
          onCancel={() => {
            setClientToEdit(null);
            setShowEditConfirmation(false);
          }}
        />
      )}
    </div>
  );
} 