import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, Trash2, Plus, Search, ChevronLeft, ChevronRight, Mail } from 'lucide-react';
import {
  getBulkTimesheets,
  deleteBulkTimesheet,
  BulkTimesheetData,
  sendBulkTimesheetEmails,
} from '../../services/api/bulkTimesheet';
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

function getPositionDisplayName(position: Record<string, unknown> | undefined): string {
  return (
    String(
      position?.title ||
      position?.positionCode ||
      position?.position_code ||
      'Unknown Position'
    )
  );
}

export function BulkTimesheetList() {
  // State management
  const [bulkTimesheets, setBulkTimesheets] = useState<BulkTimesheetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const location = useLocation();

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceNumberFilter, setInvoiceNumberFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [emailSentFilter, setEmailSentFilter] = useState('');

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
  const [bulkTimesheetToDelete, setBulkTimesheetToDelete] = useState<BulkTimesheetData | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Track which jobseeker is being emailed (by bulkTimesheetId + jobseekerId)
  const [sendingJobseekerEmail, setSendingJobseekerEmail] = useState<{ [key: string]: boolean }>({});

  // Utility functions
  const resetFilters = () => {
    setSearchTerm('');
    setInvoiceNumberFilter('');
    setClientFilter('');
    setPositionFilter('');
    setDateRangeStart('');
    setDateRangeEnd('');
    setEmailSentFilter('');
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

  // Fetch bulk timesheets with filters
  const fetchBulkTimesheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        searchTerm: searchTerm,
        clientFilter: clientFilter,
        positionFilter: positionFilter,
        invoiceNumberFilter: invoiceNumberFilter,
        dateRangeStart: dateRangeStart,
        dateRangeEnd: dateRangeEnd,
        emailSentFilter: emailSentFilter,
      };
      const response = await getBulkTimesheets(params);
      setBulkTimesheets(response.bulkTimesheets);
      setPagination(response.pagination);
    } catch (err) {
      setError('Failed to fetch bulk timesheets. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    clientFilter,
    positionFilter,
    invoiceNumberFilter,
    dateRangeStart,
    dateRangeEnd,
    emailSentFilter,
  ]);

  // Debounced fetch effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchBulkTimesheets();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchBulkTimesheets]);

  // Reset to first page when filters change
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [
    searchTerm,
    invoiceNumberFilter,
    clientFilter,
    positionFilter,
    dateRangeStart,
    dateRangeEnd,
    emailSentFilter,
  ]);

  // Initialize filters from query params on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get('searchTerm') || '');
    setInvoiceNumberFilter(params.get('invoiceNumber') || '');
    setClientFilter(params.get('client') || '');
    setPositionFilter(params.get('position') || '');
    setDateRangeStart(params.get('dateRangeStart') || '');
    setDateRangeEnd(params.get('dateRangeEnd') || '');
    setEmailSentFilter(params.get('emailSent') || '');
  }, [location.search]);

  // Event handlers
  const handleCreateBulkTimesheet = () => {
    window.location.href = '/bulk-timesheet-management';
  };

  const handleViewBulkTimesheet = (id: string) => {
    window.location.href = `/bulk-timesheet-management?id=${id}`;
  };

  const handleDeleteClick = (bulkTimesheet: BulkTimesheetData) => {
    setBulkTimesheetToDelete(bulkTimesheet);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!bulkTimesheetToDelete?.id) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteBulkTimesheet(bulkTimesheetToDelete.id as string);
      setBulkTimesheets(bulkTimesheets.filter(bt => bt.id !== bulkTimesheetToDelete.id));
      setMessage(`Bulk timesheet "${bulkTimesheetToDelete.invoiceNumber}" deleted successfully.`);
      
      // Close modal and reset state after successful deletion
      setIsDeleteModalOpen(false);
      setBulkTimesheetToDelete(null);
      setDeleteError(null);
      
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete bulk timesheet';
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setBulkTimesheetToDelete(null);
    setDeleteError(null);
  };

  // Function to send bulk timesheet to jobseekers
  const sendEmailToJobseeker = async (bulkTimesheetId: string, jobseekerId: string, jobseekerName: string) => {
    const key = `${bulkTimesheetId}_${jobseekerId}`;
    setSendingJobseekerEmail(prev => ({ ...prev, [key]: true }));
    setError(null);
    try {
      const response = await sendBulkTimesheetEmails(bulkTimesheetId, [jobseekerId]);
      setMessage(response.message || `Email sent to ${jobseekerName}`);
      setTimeout(() => setMessage(null), 4000);
      // Update local state for instant UI feedback
      setBulkTimesheets(prevBulkTimesheets => prevBulkTimesheets.map(bt => {
        if (bt.id !== bulkTimesheetId) return bt;
        return {
          ...bt,
          jobseekerTimesheets: bt.jobseekerTimesheets.map(ts =>
            ts.jobseeker.id === jobseekerId ? { ...ts, emailSent: true } : ts
          ),
        };
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to send email to ${jobseekerName}`);
      setTimeout(() => setError(null), 4000);
    } finally {
      setSendingJobseekerEmail(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="page-container bulk-timesheet-list">
      <AppHeader
        title="Bulk Timesheet List"
        actions={
          <>
            <button
              className="button primary button-icon"
              onClick={handleCreateBulkTimesheet}
            >
              <Plus size={16} />
              <span>New Bulk Timesheet</span>
            </button>
          </>
        }
        statusMessage={message || error}
        statusType={error ? 'error' : 'success'}
      />
      <div className="content-container">
        <div className="card">
          <div className="card-header">
            <h2>Bulk Timesheet List</h2>
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
                      <div className="column-title">Position</div>
                      <div className="column-search">
                        <input
                          type="text"
                          placeholder="Search position..."
                          value={positionFilter}
                          onChange={(e) => setPositionFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter" style={{alignItems: 'center' }}>
                      <div className="column-title">Week Period</div>
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
                    <div className="column-filter"  style={{alignItems: 'center' }}>
                      <div className="column-title">Jobseekers</div>
                      <div className="column-search">
                        <div className="actions-info">
                          <span className="actions-help-text">Names & Emails (click to send email)</span>
                        </div>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter" style={{alignItems: 'center' }}>
                      <div className="column-title">Total Pay</div>
                      <div className="column-search">
                        <div className="actions-info">
                          <span className="actions-help-text">Amount</span>
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
                ) : bulkTimesheets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty-state-cell">
                      <div className="empty-state">
                        <p>No bulk timesheets match your search criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  bulkTimesheets.map(bulkTimesheet => {
                    
                    return (
                      <tr key={String(bulkTimesheet.id)}>
                        <td className="invoice-number-cell"># {bulkTimesheet.invoiceNumber}</td>
                        <td className="client-cell">{getClientDisplayName(bulkTimesheet.client)}</td>
                        <td className="position-cell">{getPositionDisplayName(bulkTimesheet.position)}</td>
                        <td className="date-cell">{bulkTimesheet.weekPeriod}</td>
                        <td className="jobseekers-cell">
                          {bulkTimesheet.jobseekerTimesheets.map((ts) => {
                            const profile = ts.jobseeker?.jobseekerProfile;
                            if (!profile) return null;
                            const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
                            const email = profile.email || '';
                            const emailSent = ts.emailSent || false;
                            const statusClass = emailSent ? 'email-status-yes' : 'email-status-no';
                            const key = `${bulkTimesheet.id}_${ts.jobseeker.id}`;
                            const isSending = !!sendingJobseekerEmail[key];
                            return (
                              <div key={key} className="jobseeker-row">
                                <div className="jobseeker-info">
                                  <span className="jobseeker-name">{fullName}</span>
                                  <span className="jobseeker-email">{email}</span>
                                </div>
                                <div className="jobseeker-actions">
                                  <span className={`email-status-dot ${statusClass}`} title={emailSent ? 'Email sent' : 'Not sent'}></span>
                                  <button
                                    className={`button button-xs send-email-cell ${emailSent ? 'resend-email' : 'send-email'}`}
                                    disabled={isSending}
                                    onClick={() => sendEmailToJobseeker(bulkTimesheet.id as string, ts.jobseeker.id, fullName)}
                                    title={emailSent ? `Resend to ${fullName}` : `Send to ${fullName}`}
                                  >
                                    {isSending ? (
                                      <>
                                        <Mail size={14} className="mail-icon" /> Sending...
                                      </>
                                    ) : emailSent ? (
                                      <>
                                        <Mail size={14} className="mail-icon" /> Resend
                                      </>
                                    ) : (
                                      <>
                                        <Mail size={14} className="mail-icon" /> Send Email
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </td>
                        <td className="total-pay-cell">
                          ${bulkTimesheet.totalJobseekerPay.toFixed(2)}
                        </td>
                        <td className="actions-cell">
                          <div className="action-buttons">
                            <button
                              className="action-icon-btn view-btn"
                              onClick={() => handleViewBulkTimesheet(String(bulkTimesheet.id))}
                              title="View bulk timesheet details"
                              aria-label="View bulk timesheet"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              className="action-icon-btn delete-btn"
                              onClick={() => handleDeleteClick(bulkTimesheet)}
                              title="Delete bulk timesheet"
                              aria-label="Delete bulk timesheet"
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
        title="Delete Bulk Timesheet"
        message={`Are you sure you want to delete the bulk timesheet "${bulkTimesheetToDelete ? bulkTimesheetToDelete.invoiceNumber : 'Unknown'}"? This action cannot be undone.${deleteError ? `\n\nError: ${deleteError}` : ''}`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete Bulk Timesheet'}
        cancelText="Cancel"
        confirmButtonClass="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
} 