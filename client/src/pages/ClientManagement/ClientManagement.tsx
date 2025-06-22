import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Trash2, Plus, FileText, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  getClients, 
  ClientData, 
  deleteClient
} from '../../services/api/client';
import { AppHeader } from '../../components/AppHeader';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import '../../styles/components/CommonTable.css';
import '../../styles/pages/ClientManagement.css';

interface ExtendedClientData extends ClientData {
  company_name?: string;
  contact_person_name1?: string;
  work_province?: string;
  [key: string]: unknown;
}

// Backend response interface with snake_case properties
export interface BackendClientData {
  id?: string;
  company_name?: string;
  short_code?: string;
  list_name?: string;
  contact_person_name1?: string;
  contact_person_name2?: string;
  email_address1?: string;
  email_address2?: string;
  mobile1?: string;
  mobile2?: string;
  landline1?: string;
  landline2?: string;
  preferred_payment_method?: string;
  pay_cycle?: string;
  created_at?: string;
  updated_at?: string;
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

export function ClientManagement() {
  // State management
  const [clients, setClients] = useState<ExtendedClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [companyNameFilter, setCompanyNameFilter] = useState('');
  const [shortCodeFilter, setShortCodeFilter] = useState('');
  const [listNameFilter, setListNameFilter] = useState('');
  const [contactFilter, setContactFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [mobileFilter, setMobileFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [paymentCycleFilter, setPaymentCycleFilter] = useState('');

  // Pagination state
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 25,
    total: 0,
    totalFiltered: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Delete confirmation state
  const [clientToDelete, setClientToDelete] = useState<ExtendedClientData | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Edit confirmation state
  const [clientToEdit, setClientToEdit] = useState<ExtendedClientData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const getFieldValue = (client: ExtendedClientData, field: string): string => {
    const value = client[field] || client[field.toLowerCase()] || client[field.replace(/([A-Z])/g, '_$1').toLowerCase()];
    
    if (value === null || value === undefined) {
      return 'N/A';
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    return String(value);
  };

  // Utility functions
  const resetFilters = () => {
    setSearchTerm('');
    setCompanyNameFilter('');
    setShortCodeFilter('');
    setListNameFilter('');
    setContactFilter('');
    setEmailFilter('');
    setMobileFilter('');
    setPaymentMethodFilter('');
    setPaymentCycleFilter('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const handlePreviousPage = () => {
    if (pagination.hasPrevPage) {
      setPagination(prev => ({ ...prev, page: prev.page - 1 }));
    }
  };

  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    }
  };

  // Fetch clients with filters
  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        searchTerm: searchTerm,
        companyNameFilter: companyNameFilter,
        shortCodeFilter: shortCodeFilter,
        listNameFilter: listNameFilter,
        contactFilter: contactFilter,
        emailFilter: emailFilter,
        mobileFilter: mobileFilter,
        paymentMethodFilter: paymentMethodFilter,
        paymentCycleFilter: paymentCycleFilter
      };

      const response = await getClients(params);
      
      // Convert snake_case to camelCase for frontend use
      // Backend returns snake_case, frontend expects camelCase
      const convertedClients = (response.clients as BackendClientData[]).map((client: BackendClientData) => ({
        ...client,
        companyName: client.company_name,
        shortCode: client.short_code,
        listName: client.list_name,
        contactPersonName1: client.contact_person_name1,
        contactPersonName2: client.contact_person_name2,
        emailAddress1: client.email_address1,
        emailAddress2: client.email_address2,
        mobile1: client.mobile1,
        mobile2: client.mobile2,
        landline1: client.landline1,
        landline2: client.landline2,
        preferredPaymentMethod: client.preferred_payment_method,
        payCycle: client.pay_cycle,
        createdAt: client.created_at,
        updatedAt: client.updated_at
      }));

      setClients(convertedClients);
      setPagination(response.pagination);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('Failed to fetch clients. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    companyNameFilter,
    shortCodeFilter,
    listNameFilter,
    contactFilter,
    emailFilter,
    mobileFilter,
    paymentMethodFilter,
    paymentCycleFilter
  ]);

  // Debounced fetch effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchClients();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [fetchClients]);

  // Reset to first page when filters change
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [
    searchTerm,
    companyNameFilter,
    shortCodeFilter,
    listNameFilter,
    contactFilter,
    emailFilter,
    mobileFilter,
    paymentMethodFilter,
    paymentCycleFilter
  ]);

  // Event handlers
  const handleCreateClient = () => {
    navigate('/client-management/create');
  };
  
  const handleViewDrafts = () => {
    navigate('/client-management/drafts');
  };

  const handleViewClient = (id: string) => {
    navigate(`/client-management/view/${id}`);
  };

  const handleEditClick = (client: ExtendedClientData) => {
    setClientToEdit(client);
    setIsEditModalOpen(true);
  };

  const handleConfirmEdit = () => {
    if (clientToEdit?.id) {
      navigate(`/client-management/edit/${clientToEdit.id}`);
    }
    setIsEditModalOpen(false);
    setClientToEdit(null);
  };

  const handleCancelEdit = () => {
    setIsEditModalOpen(false);
    setClientToEdit(null);
  };

  const handleDeleteClick = (client: ExtendedClientData) => {
    setClientToDelete(client);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!clientToDelete?.id) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);
      
      await deleteClient(clientToDelete.id as string);
      
      setClients(clients.filter(c => c.id !== clientToDelete.id));
      setMessage(`Client "${getFieldValue(clientToDelete, 'companyName')}" deleted successfully.`);
      
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (err) {
      console.error('Error deleting client:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete client';
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setClientToDelete(null);
    setDeleteError(null);
  };

  return (
    <div className="page-container">
      <AppHeader
        title="Client Management"
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
              onClick={handleCreateClient}
            >
              <Plus size={16} />
              <span>New Client</span>
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
            <h2>Client List</h2>
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
                      <div className="column-title">Company Name</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search company..."
                          value={companyNameFilter}
                          onChange={(e) => setCompanyNameFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Short Code</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search code..."
                          value={shortCodeFilter}
                          onChange={(e) => setShortCodeFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">List Name</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search list..."
                          value={listNameFilter}
                          onChange={(e) => setListNameFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Primary Contact</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search contact..."
                          value={contactFilter}
                          onChange={(e) => setContactFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Primary Email</div>
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
                      <div className="column-title">Primary Mobile</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search mobile..."
                          value={mobileFilter}
                          onChange={(e) => setMobileFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Payment Method</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search method..."
                          value={paymentMethodFilter}
                          onChange={(e) => setPaymentMethodFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Payment Cycle</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search cycle..."
                          value={paymentCycleFilter}
                          onChange={(e) => setPaymentCycleFilter(e.target.value)}
                          className="column-search-input"
                        />
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
                  // Skeleton loading rows
                  <>
                    {Array.from({ length: pagination.limit || 10 }, (_, index) => (
                      <tr key={`skeleton-${index}`} className="skeleton-row">
                        {/* Regular columns - using generic skeleton-text */}
                        <td className="skeleton-cell">
                          <div className="skeleton-text"></div>
                        </td>
                        <td className="skeleton-cell">
                          <div className="skeleton-text"></div>
                        </td>
                        <td className="skeleton-cell">
                          <div className="skeleton-text"></div>
                        </td>
                        <td className="skeleton-cell">
                          <div className="skeleton-text"></div>
                        </td>
                        <td className="skeleton-cell">
                          <div className="skeleton-text"></div>
                        </td>
                        <td className="skeleton-cell">
                          <div className="skeleton-text"></div>
                        </td>
                        <td className="skeleton-cell">
                          <div className="skeleton-text"></div>
                        </td>
                        <td className="skeleton-cell">
                          <div className="skeleton-text"></div>
                        </td>
                        
                        {/* Actions skeleton - needs special styling */}
                        <td className="skeleton-cell">
                          <div className="skeleton-actions">
                            <div className="skeleton-icon skeleton-action-btn"></div>
                            <div className="skeleton-icon skeleton-action-btn"></div>
                            <div className="skeleton-icon skeleton-action-btn"></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty-state-cell">
                      <div className="empty-state">
                        <p>No clients match your search criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  clients.map(client => (
                    <tr key={String(client.id)}>
                      <td className="name-cell">{getFieldValue(client, 'companyName')}</td>
                      <td className="shortcode-cell">{getFieldValue(client, 'shortCode')}</td>
                      <td className="listname-cell">{getFieldValue(client, 'listName')}</td>
                      <td className="contact-cell">{getFieldValue(client, 'primaryContactPersonName1')}</td>
                      <td className="email-cell">{getFieldValue(client, 'emailAddress1')}</td>
                      <td className="mobile-cell">{getFieldValue(client, 'mobile1')}</td>
                      <td className="payment-method-cell">{getFieldValue(client, 'preferredPaymentMethod')}</td>
                      <td className="payment-cycle-cell">{getFieldValue(client, 'payCycle')}</td>
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button 
                            className="action-icon-btn view-btn"
                            onClick={() => handleViewClient(String(client.id))}
                            title="View client details"
                            aria-label="View client"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            className="action-icon-btn edit-btn"
                            onClick={() => handleEditClick(client)}
                            title="Edit this client"
                            aria-label="Edit client"
                          >
                            <Pencil size={16} />
                          </button>
                          <button 
                            className="action-icon-btn delete-btn"
                            onClick={() => handleDeleteClick(client)}
                            title="Delete this client"
                            aria-label="Delete client"
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
        isOpen={isDeleteModalOpen}
          title="Delete Client"
        message={`Are you sure you want to delete the client "${clientToDelete ? getFieldValue(clientToDelete, 'companyName') : 'Unknown'}"? This action cannot be undone.${deleteError ? `\n\nError: ${deleteError}` : ''}`}
        confirmText={isDeleting ? "Deleting..." : "Delete Client"}
          cancelText="Cancel"
        confirmButtonClass="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        />

      {/* Edit Confirmation Modal */}
        <ConfirmationModal
        isOpen={isEditModalOpen}
          title="Edit Client"
        message={`Are you sure you want to edit the client "${clientToEdit ? getFieldValue(clientToEdit, 'companyName') : 'Unknown'}"? You will be redirected to the client editor.`}
        confirmText="Edit Client"
          cancelText="Cancel"
        confirmButtonClass="primary"
        onConfirm={handleConfirmEdit}
        onCancel={handleCancelEdit}
      />
    </div>
  );
} 