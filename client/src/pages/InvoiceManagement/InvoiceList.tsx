import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { Eye, Trash2, Plus, Search, ChevronLeft, ChevronRight, Mail } from 'lucide-react';
import {
  getInvoices,
  deleteInvoice,
  InvoiceData,
  formatInvoiceForDisplay,
  updateInvoice,
} from '../../services/api/invoice';
import { AppHeader } from '../../components/AppHeader';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import '../../styles/pages/InvoiceManagement.css';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalFiltered: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

function getClientDisplayName(client: Record<string, unknown> | undefined): string {
  return (
    String(
      client?.companyName ||
      client?.company_name ||
      client?.shortCode ||
      client?.short_code ||
      'Unknown Client'
    )
  );
}

function getClientEmail(client: Record<string, unknown> | undefined): string {
  return String(client?.emailAddress1 || client?.email_address1 || '');
}

export function InvoiceList() {
  // State management
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceNumberFilter, setInvoiceNumberFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [clientEmailFilter, setClientEmailFilter] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [dueDateStart, setDueDateStart] = useState('');
  const [dueDateEnd, setDueDateEnd] = useState('');
  const [emailSentFilter, setEmailSentFilter] = useState('');
  const [invoiceSentFilter, setInvoiceSentFilter] = useState('');
  const [documentGeneratedFilter, setDocumentGeneratedFilter] = useState('');

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
  const [invoiceToDelete, setInvoiceToDelete] = useState<InvoiceData | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Send email state
  const [sendingEmailInvoiceId, setSendingEmailInvoiceId] = useState<string | null>(null);

  // Utility functions
  const resetFilters = () => {
    setSearchTerm('');
    setInvoiceNumberFilter('');
    setClientFilter('');
    setClientEmailFilter('');
    setDateRangeStart('');
    setDateRangeEnd('');
    setDueDateStart('');
    setDueDateEnd('');
    setEmailSentFilter('');
    setInvoiceSentFilter('');
    setDocumentGeneratedFilter('');
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

  // Fetch invoices with filters
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        searchTerm: searchTerm,
        clientFilter: clientFilter,
        clientEmailFilter: clientEmailFilter,
        invoiceNumberFilter: invoiceNumberFilter,
        dateRangeStart: dateRangeStart,
        dateRangeEnd: dateRangeEnd,
        dueDateStart: dueDateStart,
        dueDateEnd: dueDateEnd,
        emailSentFilter: emailSentFilter,
        invoiceSentFilter: invoiceSentFilter,
        documentGeneratedFilter: documentGeneratedFilter,
      };
      const response = await getInvoices(params);
      setInvoices(response.invoices);
      setPagination(response.pagination);
    } catch (err) {
      setError('Failed to fetch invoices. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    clientFilter,
    clientEmailFilter,
    invoiceNumberFilter,
    dateRangeStart,
    dateRangeEnd,
    dueDateStart,
    dueDateEnd,
    emailSentFilter,
    invoiceSentFilter,
    documentGeneratedFilter,
  ]);

  // Debounced fetch effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchInvoices();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchInvoices]);

  // Reset to first page when filters change
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [
    searchTerm,
    invoiceNumberFilter,
    clientFilter,
    clientEmailFilter,
    dateRangeStart,
    dateRangeEnd,
    dueDateStart,
    dueDateEnd,
    emailSentFilter,
    invoiceSentFilter,
    documentGeneratedFilter,
  ]);

  // --- New: Initialize filters from query params on mount ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get('searchTerm') || '');
    setInvoiceNumberFilter(params.get('invoiceNumber') || '');
    setClientFilter(params.get('client') || '');
    setClientEmailFilter(params.get('clientEmail') || '');
    setDateRangeStart(params.get('dateRangeStart') || '');
    setDateRangeEnd(params.get('dateRangeEnd') || '');
    setDueDateStart(params.get('dueDateStart') || '');
    setDueDateEnd(params.get('dueDateEnd') || '');
    setEmailSentFilter(params.get('emailSent') || '');
    setInvoiceSentFilter(params.get('invoiceSent') || '');
    setDocumentGeneratedFilter(params.get('documentGenerated') || '');
    // Example: How to use filter params in the URL
    //
    //   /invoice-management/list?searchTerm=Acme&invoiceNumber=INV-123&client=Acme%20Corp&clientEmail=acme%40email.com&dateRangeStart=2024-07-01&dateRangeEnd=2024-07-31&dueDateStart=2024-08-01&dueDateEnd=2024-08-31&emailSent=true&invoiceSent=true&documentGenerated=true
    //
    // Any combination of these params can be used to pre-populate filters on page load.
  }, [location.search]);
  // --- End new code ---

  // Event handlers
  const handleCreateInvoice = () => {
    navigate('/invoice-management/create');
  };

  const handleViewInvoice = (id: string) => {
    navigate(`/invoice-management/create?id=${id}`);
  };

  const handleDeleteClick = (invoice: InvoiceData) => {
    setInvoiceToDelete(invoice);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!invoiceToDelete?.id) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteInvoice(invoiceToDelete.id as string);
      setInvoices(invoices.filter(i => i.id !== invoiceToDelete.id));
      setMessage(`Invoice "${invoiceToDelete.invoiceNumber}" deleted successfully.`);
      
      // Close modal and reset state after successful deletion
      setIsDeleteModalOpen(false);
      setInvoiceToDelete(null);
      setDeleteError(null);
      
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete invoice';
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setInvoiceToDelete(null);
    setDeleteError(null);
  };

  // Function to send invoice to client (same logic as InvoiceManagement modal)
  const sendInvoiceToClient = async (invoice: InvoiceData) => {
    if (!invoice.id) {
      setError("Missing invoice ID");
      return;
    }

    const emailToSend = invoice.invoice_sent_to || 
      getClientEmail(invoice.client) || 
      '';

    if (!emailToSend) {
      setError("No email address found for this invoice");
      return;
    }

    setSendingEmailInvoiceId(invoice.id as string);
    setError(null);
    
    try {
      console.log("=== SENDING INVOICE TO CLIENT ===");
      console.log("Invoice ID:", invoice.id);
      console.log("Email to send:", emailToSend);
      
      // Update the invoice record with email-related fields
      const updateData = {
        emailSent: true,
        emailSentDate: new Date().toISOString(),
        invoice_sent_to: emailToSend
      };
      
      console.log("Update data:", updateData);
      
      // Make API call to update the invoice
      const response = await updateInvoice(invoice.id as string, updateData);
      
      console.log("Update response:", response);
      
      if (response.success) {
        // Update the local invoice in the list
        setInvoices(prevInvoices => 
          prevInvoices.map(inv => 
            inv.id === invoice.id 
              ? { ...inv, emailSent: true, emailSentDate: updateData.emailSentDate, invoice_sent_to: emailToSend }
              : inv
          )
        );
        
        setMessage(`Invoice sent successfully to ${emailToSend}`);
        setTimeout(() => {
          setMessage(null);
        }, 5000);
        
        console.log("Invoice updated successfully with email info");
      } else {
        throw new Error(response.message || "Failed to update invoice");
      }
    } catch (err) {
      console.error("Error sending invoice:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to send invoice. Please try again.";
      setError(errorMessage);
      setTimeout(() => {
        setError(null);
      }, 5000);
    } finally {
      setSendingEmailInvoiceId(null);
    }
  };

  return (
    <div className="page-container">
      <AppHeader
        title=" Client Invoices List"
        actions={
          <>
            <button
              className="button primary button-icon"
              onClick={handleCreateInvoice}
            >
              <Plus size={16} />
              <span>New Invoice</span>
            </button>
          </>
        }
        statusMessage={message || error}
        statusType={error ? 'error' : 'success'}
      />
      <div className="content-container">
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}
        <div className="card">
          <div className="card-header">
            <h2>Invoice List</h2>
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
                      <div className="column-title">Invoice #</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search invoice #..."
                          value={invoiceNumberFilter}
                          onChange={(e) => setInvoiceNumberFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Client</div>
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
                      <div className="column-title">Client Email</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search email..."
                          value={clientEmailFilter}
                          onChange={(e) => setClientEmailFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter" style={{alignItems: 'center' }}>
                      <div className="column-title">Invoice Date</div>
                      <div className="column-search" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px' }}>
                        <div className="date-picker-wrapper">
                          <input
                            type="date"
                            value={dateRangeStart}
                            onChange={(e) => setDateRangeStart(e.target.value)}
                            className="date-picker-input"
                            onClick={(e) => e.currentTarget.showPicker()}
                          />
                        </div>
                        <span style={{ margin: '0 4px' }}>to</span>
                        <div className="date-picker-wrapper">
                          <input
                            type="date"
                            value={dateRangeEnd}
                            onChange={(e) => setDateRangeEnd(e.target.value)}
                            className="date-picker-input"
                            onClick={(e) => e.currentTarget.showPicker()}
                          />
                        </div>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter" >
                      <div className="column-title">Invoice Emailed</div>
                      <div className="column-search">
                        <select
                          value={invoiceSentFilter}
                          onChange={(e) => setInvoiceSentFilter(e.target.value)}
                          className="column-search-input"
                        >
                          <option value="">All</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                      <div className="column-title">Invoice PDF Generated</div>
                      <div className="column-search">
                        <select
                          value={documentGeneratedFilter}
                          onChange={(e) => setDocumentGeneratedFilter(e.target.value)}
                          className="column-search-input"
                        >
                          <option value="">All</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter" style={{alignItems: 'center' }}>
                      <div className="column-title">Send Email</div>
                      <div className="column-search">
                        <div className="actions-info">
                          <span className="actions-help-text">Send • Resend</span>
                        </div>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter" style={{alignItems: 'flex-end', marginRight: '10px' }}>
                      <div className="column-title">Actions</div>
                      <div className="column-search">
                        <div className="actions-info">
                          <span className="actions-help-text">View • Delete</span>
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
                        
                        {/* Actions skeleton - needs special styling */}
                        <td className="skeleton-cell">
                          <div className="skeleton-actions">
                            <div className="skeleton-icon skeleton-action-btn"></div>
                            <div className="skeleton-icon skeleton-action-btn"></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-state-cell">
                      <div className="empty-state">
                        <p>No invoices match your search criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  invoices.map(invoice => {
                    const formatted = formatInvoiceForDisplay(invoice);
                    const clientEmail = invoice.invoice_sent_to || getClientEmail(invoice.client);
                    const isCurrentlySending = sendingEmailInvoiceId === invoice.id;
                    const hasEmail = !!clientEmail;
                    
                    return (
                      <tr key={String(invoice.id)}>
                        <td className="invoice-number-cell">{invoice.invoiceNumber}</td>
                        <td className="client-cell">{getClientDisplayName(invoice.client)}</td>
                        <td className="client-email-cell">{getClientEmail(invoice.client)}</td>
                        <td className="date-cell" style={{textAlign: 'center'}}>{formatted.formattedInvoiceDate}</td>
                        <td className="email-sent-cell">{invoice.emailSent ? 'Yes' : 'No'}</td>
                        <td className="pdf-generated-cell">{invoice.documentGenerated ? 'Yes' : 'No'}</td>
                        <td className="send-email-cell">
                          <button
                            className={`button button-xs send-email-cell ${invoice.emailSent ? 'resend-email' : 'send-email'}`}
                            onClick={() => sendInvoiceToClient(invoice)}
                            disabled={isCurrentlySending || !hasEmail || !invoice.documentGenerated}
                            title={
                              !hasEmail 
                                ? "No email address available" 
                                : !invoice.documentGenerated 
                                  ? "PDF must be generated first"
                                  : invoice.emailSent 
                                    ? `Send again to ${clientEmail}` 
                                    : `Send to ${clientEmail}`
                            }
                          >
                            {isCurrentlySending ? (
                              <>
                                <Mail size={14} className="mail-icon" /> Sending...
                              </>
                            ) : invoice.emailSent ? (
                              <>
                                <Mail size={14} className="mail-icon" /> Resend
                              </>
                            ) : (
                              <>
                                <Mail size={14} className="mail-icon" /> Send Email
                              </>
                            )}
                          </button>
                        </td>
                        <td className="actions-cell">
                          <div className="action-buttons">
                            <button
                              className="action-icon-btn view-btn"
                              onClick={() => handleViewInvoice(String(invoice.id))}
                              title="View invoice details"
                              aria-label="View invoice"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              className="action-icon-btn delete-btn"
                              onClick={() => handleDeleteClick(invoice)}
                              title="Delete invoice"
                              aria-label="Delete invoice"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
        title="Delete Invoice"
        message={`Are you sure you want to delete the invoice "${invoiceToDelete ? invoiceToDelete.invoiceNumber : 'Unknown'}"? This action cannot be undone.${deleteError ? `\n\nError: ${deleteError}` : ''}`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete Invoice'}
        cancelText="Cancel"
        confirmButtonClass="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
} 