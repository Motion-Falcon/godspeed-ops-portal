import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Plus, Search, ChevronLeft, ChevronRight, FileText, Calendar, User, Building2, UserCircle } from 'lucide-react';
import { getConsentDocuments, ConsentDocument } from '../../services/api/consent';
import { AppHeader } from '../../components/AppHeader';
import { useLanguage } from '../../contexts/language/language-provider';
import '../../styles/components/CommonTable.css';
import '../../styles/pages/ConsentListAndDetailPage.css';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalFiltered: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function ConsentListPage() {
  const { t } = useLanguage();
  // State management
  const [documents, setDocuments] = useState<ConsentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message] = useState<string | null>(null);
  const navigate = useNavigate();

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [fileNameFilter, setFileNameFilter] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [recipientTypeFilter, setRecipientTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

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

  const getFieldValue = (document: ConsentDocument, field: keyof ConsentDocument): string => {
    const value = document[field];
    
    if (value === null || value === undefined) {
      return 'N/A';
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    return String(value);
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  const getUploaderName = (document: ConsentDocument): string => {
    if (document.uploader?.name && document.uploader?.email) {
      return document.uploader?.name + ' - ' + document.uploader?.email;
    }

    return 'Unknown';
  };



  const getRecipientTypeDisplay = (document: ConsentDocument): { text: string; icon: JSX.Element } => {
    switch (document.recipientType) {
      case 'client':
        return { text: 'Client', icon: <Building2 size={14} /> };
      case 'jobseeker_profile':
        return { text: 'Jobseeker', icon: <UserCircle size={14} /> };
      default:
        return { text: 'Unknown', icon: <User size={14} /> };
    }
  };

  // Utility functions
  const resetFilters = () => {
    setSearchTerm('');
    setFileNameFilter('');
    setUploaderFilter('');
    setStatusFilter('');
    setRecipientTypeFilter('');
    setDateFilter('');
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

  // Fetch consent documents with filters
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        fileNameFilter: fileNameFilter,
        uploaderFilter: uploaderFilter,
        statusFilter: statusFilter,
        recipientTypeFilter: recipientTypeFilter,
        dateFilter: dateFilter
      };

      const response = await getConsentDocuments(params);
      
      setDocuments(response.documents);
      setPagination(response.pagination);
    } catch (err) {
      console.error('Error fetching consent documents:', err);
      setError('Failed to fetch consent documents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    fileNameFilter,
    uploaderFilter,
    statusFilter,
    recipientTypeFilter,
    dateFilter
  ]);

  // Debounced fetch effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchDocuments();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [fetchDocuments]);

  // Reset to first page when filters change
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [
    searchTerm,
    fileNameFilter,
    uploaderFilter,
    statusFilter,
    recipientTypeFilter,
    dateFilter,
    pagination.page
  ]);

  // Event handlers
  const handleCreateConsent = () => {
    navigate('/consent-dashboard/new');
  };

  const handleViewDocument = (id: string) => {
    navigate(`/consent-dashboard/${id}`);
  };

  return (
    <div className="page-container">
      <AppHeader
        title="Consent Management"
        actions={
          <button 
            className="button primary button-icon" 
            onClick={handleCreateConsent}
          >
            <Plus size={16} />
            <span>{t('consent.management.newRequest')}</span>
          </button>
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
            <h2>{t('consent.management.documents')}</h2>
            <div className="filter-container">
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                                     placeholder={t('consent.management.globalSearch')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button 
                  className="button secondary button-icon reset-filters-btn" 
                  onClick={resetFilters}
                >
                                     <span>{t('consent.management.resetFilters')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pagination Controls - Top */}
          <div className="pagination-controls top">
            <div className="pagination-info">
              <span className="pagination-text">
                                 {t('pagination.showing', {
                   start: Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total),
                   end: Math.min(pagination.page * pagination.limit, pagination.total),
                   total: pagination.total,
                 })}
                {pagination.totalFiltered !== pagination.total && (
                  <span className="filtered-info"> ({t('pagination.filteredFromTotal', { total: pagination.total })})</span>
                )}
              </span>
            </div>
            <div className="pagination-size-selector">
                             <label htmlFor="pageSize" className="page-size-label">{t('consent.pagination.show')}</label>
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
                             <span className="page-size-label">{t('consent.pagination.perPage')}</span>
            </div>
          </div>

          <div className="table-container">
            <table className="common-table">
              <thead>
                <tr>
                  <th>
                    <div className="column-filter">
                                             <div className="column-title">{t('consent.table.documentName')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                                                     placeholder={t('consent.table.searchDocument')}
                          value={fileNameFilter}
                          onChange={(e) => setFileNameFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                                             <div className="column-title">{t('consent.table.uploadedBy')}</div>
                      <div className="column-search">
                        <input
                          type="text"
                                                     placeholder={t('consent.table.searchUploader')}
                          value={uploaderFilter}
                          onChange={(e) => setUploaderFilter(e.target.value)}
                          className="column-search-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                                             <div className="column-title">{t('consent.table.recipientType')}</div>
                      <div className="column-search">
                        <select
                          value={recipientTypeFilter}
                          onChange={(e) => setRecipientTypeFilter(e.target.value)}
                          className="column-filter-select"
                        >
                                                     <option value="">{t('consent.filters.all')}</option>
                           <option value="client">{t('consent.filters.client')}</option>
                           <option value="jobseeker_profile">{t('consent.filters.jobseeker')}</option>
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                                             <div className="column-title">{t('consent.table.status')}</div>
                      <div className="column-search">
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="column-filter-select"
                        >
                                                     <option value="">{t('consent.filters.all')}</option>
                           <option value="active">{t('consent.filters.active')}</option>
                           <option value="inactive">{t('consent.filters.inactive')}</option>
                        </select>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                                             <div className="column-title">{t('consent.table.consentStatus')}</div>
                      <div className="column-search">
                        <div className="actions-info">
                                                     <span className="actions-help-text">{t('consent.table.completedTotal')}</span>
                        </div>
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                                             <div className="column-title">{t('consent.table.createdDate')}</div>
                      <div className="column-search">
                        <input
                          type="date"
                          value={dateFilter}
                          onChange={(e) => setDateFilter(e.target.value)}
                          className="date-picker-input"
                        />
                      </div>
                    </div>
                  </th>
                  <th>
                    <div className="column-filter">
                                             <div className="column-title">{t('consent.table.actions')}</div>
                      <div className="column-search">
                        <div className="actions-info">
                                                     <span className="actions-help-text">{t('consent.table.viewDetails')}</span>
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
                          <div className="skeleton-actions">
                            <div className="skeleton-icon skeleton-action-btn"></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state-cell">
                      <div className="empty-state">
                                                 <p>{t('consent.management.noDocumentsMatch')}</p>
                        <button 
                          className="button primary"
                          onClick={handleCreateConsent}
                        >
                                                     {t('consent.management.createFirstRequest')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  documents.map(document => (
                    <tr key={document.id}>
                      <td className="name-cell">
                        <div className="file-info">
                          <FileText size={16} className="file-icon" />
                          <span>{getFieldValue(document, 'fileName')}</span>
                        </div>
                      </td>
                      <td className="uploader-cell">
                        <div className="user-info">
                          <User size={16} className="user-icon" />
                          <span>{getUploaderName(document)}</span>
                        </div>
                      </td>
                      <td className="recipient-type-cell">
                        <div className="recipient-type-info">
                          <span className={`recipient-type-badge ${document.recipientType}`}>
                            {getRecipientTypeDisplay(document).icon}
                            {getRecipientTypeDisplay(document).text}
                          </span>
                        </div>
                      </td>
                      <td className="status-cell">
                        <span className={`status-badge ${document.isActive ? 'active' : 'inactive'}`}>
                                                     {document.isActive ? t('consent.filters.active') : t('consent.filters.inactive')}
                        </span>
                      </td>
                      <td className="consent-status-cell">
                        <div className="consent-status-info">
                          <span className={`consent-progress ${document.completedRecipients === document.totalRecipients ? 'complete' : 'pending'}`}>
                            {document.completedRecipients} / {document.totalRecipients}
                          </span>
                        </div>
                      </td>
                      <td className="date-cell">
                        <div className="date-info">
                          <Calendar size={16} className="date-icon" />
                          <span>{formatDate(document.createdAt)}</span>
                        </div>
                      </td>
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button 
                            className="action-icon-btn view-btn"
                            onClick={() => handleViewDocument(document.id)}
                                                         title={t('consent.common.viewConsentDetails')}
                             aria-label={t('consent.common.viewConsentDetails')}
                          >
                            <Eye size={16} />
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
                                     {t('pagination.pageOf', { page: pagination.page, totalPages: pagination.totalPages })}
                </span>
              </div>
              <div className="pagination-buttons">
                <button
                  className="pagination-btn prev"
                  onClick={handlePreviousPage}
                  disabled={!pagination.hasPrevPage}
                                     title={t('pagination.previousPage')}
                   aria-label={t('pagination.previousPage')}
                >
                  <ChevronLeft size={16} />
                                     <span>{t('consent.pagination.previous')}</span>
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
                                                 aria-label={t('pagination.goToPage', { page: pageNum })}
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
                                     title={t('pagination.nextPage')}
                   aria-label={t('pagination.nextPage')}
                >
                                     <span>{t('consent.pagination.next')}</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
