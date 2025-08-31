import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building, Edit, FileCheck, Calendar, CheckCircle, User, Clock, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { getClient, ClientData } from '../../services/api/client';
import { getConsentRecordsByEntity, ConsentRecordWithDocument } from '../../services/api/consent';
import { AppHeader } from '../../components/AppHeader';
import '../../styles/pages/ClientView.css';
import '../../styles/components/header.css';

export function ClientView() {
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Add state for consent records
  const [consentRecords, setConsentRecords] = useState<ConsentRecordWithDocument[]>([]);
  const [consentLoading, setConsentLoading] = useState<boolean>(true);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentPagination, setConsentPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
  });

  // Helper function to get a value with proper type handling
  const getFieldValue = (obj: ClientData | null, key: keyof ClientData): string | number | boolean | null | undefined => {
    if (!obj) return null;
    const value = obj[key];
    
    // Handle complex object types by returning null
    if (typeof value === 'object' && value !== null) {
      return null;
    }
    
    return value as string | number | boolean | null | undefined;
  };

  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        if (!id) throw new Error("Client ID is missing");
        const data = await getClient(id);
        setClient(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching the client');
        console.error('Error fetching client:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchClient();
    }
  }, [id]);

  // Fetch consent records when client is loaded
  useEffect(() => {
    const fetchConsentRecords = async (page = 1) => {
      if (!client?.id) return;
      setConsentLoading(true);
      setConsentError(null);
      try {
        const response = await getConsentRecordsByEntity(client.id, {
          page,
          limit: consentPagination.itemsPerPage,
          consentableType: 'client',
        });
        setConsentRecords(response.records);
        setConsentPagination((prev) => ({
          ...prev,
          currentPage: response.pagination.page,
          totalPages: response.pagination.totalPages,
          totalItems: response.pagination.total,
          itemsPerPage: response.pagination.limit,
        }));
      } catch (err) {
        setConsentError(err instanceof Error ? err.message : 'Failed to fetch consent records');
        setConsentRecords([]);
        setConsentPagination((prev) => ({ ...prev, currentPage: 1, totalPages: 1, totalItems: 0 }));
      } finally {
        setConsentLoading(false);
      }
    };
    if (client?.id) {
      fetchConsentRecords(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);

  // Pagination handlers for consent records
  const handleConsentPageChange = (page: number) => {
    setConsentPagination((prev) => ({ ...prev, currentPage: page }));
  };
  useEffect(() => {
    if (client && client.id) {
      const fetchConsentRecords = async () => {
        setConsentLoading(true);
        setConsentError(null);
        try {
          const response = await getConsentRecordsByEntity(client.id as string, {
            page: consentPagination.currentPage,
            limit: consentPagination.itemsPerPage,
            consentableType: 'client',
          });
          setConsentRecords(response.records);
          setConsentPagination((prev) => ({
            ...prev,
            currentPage: response.pagination.page,
            totalPages: response.pagination.totalPages,
            totalItems: response.pagination.total,
            itemsPerPage: response.pagination.limit,
          }));
        } catch (err) {
          setConsentError(err instanceof Error ? err.message : 'Failed to fetch consent records');
          setConsentRecords([]);
          setConsentPagination((prev) => ({ ...prev, currentPage: 1, totalPages: 1, totalItems: 0 }));
        } finally {
          setConsentLoading(false);
        }
      };
      fetchConsentRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentPagination.currentPage, client?.id]);

  const handleEditClient = () => {
    if (!id) return;
    navigate(`/client-management/edit/${id}`);
  };

  // Format date with type checking
  const formatDate = (dateString?: string | number | boolean | null | undefined) => {
    if (!dateString || typeof dateString !== 'string') return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  // Function to decode HTML entities
  const decodeHtmlEntities = (text: string): string => {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
  };

  // Skeleton card component for consent records
  const SkeletonCard = () => (
    <div className="jsp-consent-card">
      <div className="jsp-consent-header">
        <div className="jsp-consent-title-section">
          <div className="jsp-consent-title skeleton-text" style={{ width: '60%', height: '16px' }}></div>
          <div className="jsp-consent-code skeleton-text" style={{ width: '80px', height: '12px', marginTop: '4px' }}></div>
        </div>
        <div className="jsp-status-badge skeleton-text" style={{ width: '70px', height: '20px' }}></div>
      </div>
      <div className="jsp-consent-details">
        {[1, 2, 3].map((i) => (
          <div key={i} className="jsp-detail-row">
            <div className="skeleton-icon" style={{ width: '16px', height: '16px' }}></div>
            <div className="skeleton-text" style={{ width: '150px', height: '14px' }}></div>
          </div>
        ))}
      </div>
      <div className="jsp-consent-actions">
        <div className="skeleton-text" style={{ width: '140px', height: '32px', borderRadius: '6px' }}></div>
      </div>
    </div>
  );

  // Format date for consent records
  const formatConsentDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-CA', {
        timeZone: 'America/Toronto',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return dateString;
    }
  };

  const renderDetailItem = (label: string, value?: string | number | boolean | null) => {
    const displayValue = value === null || value === undefined || value === '' 
      ? 'N/A' 
      : typeof value === 'boolean' 
        ? (value ? 'Yes' : 'No') 
        : value;
    
    return (
      <div className="detail-item">
        <p className="detail-label">{label}:</p>
        <p className="detail-value">{displayValue}</p>
      </div>
    );
  };

  // Special renderer for website URLs
  const renderWebsiteItem = (label: string, value?: string | number | boolean | null) => {
    if (!value || value === '') {
      return (
        <div className="detail-item">
          <p className="detail-label">{label}:</p>
          <p className="detail-value">N/A</p>
        </div>
      );
    }

    const decodedUrl = typeof value === 'string' ? decodeHtmlEntities(value) : String(value);
    
    // Check if URL has protocol, if not add https://
    let linkUrl = decodedUrl;
    if (decodedUrl && !decodedUrl.match(/^https?:\/\//)) {
      linkUrl = `https://${decodedUrl}`;
    }
    
    return (
      <div className="detail-item">
        <p className="detail-label">{label}:</p>
        <p className="detail-value">
          <a 
            href={linkUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#0066cc', textDecoration: 'underline' }}
          >
            {decodedUrl}
          </a>
        </p>
      </div>
    );
  };

  if (loading) {
    // Skeleton loader modeled after JobSeekerProfile/PositionView
    return (
      <div className="client-view-container">
        <AppHeader
          title="Client Details"
          actions={
            <button className="button" disabled>
              <ArrowLeft size={16} className="icon" />
              <span>Back to Clients</span>
            </button>
          }
        />
        <main className="client-main">
          {/* Overview Skeleton */}
          <div className="client-overview section-card">
            <div className="client-banner"></div>
            <div className="client-details">
              <div className="client-avatar skeleton-avatar">
                <div className="skeleton-icon" style={{ width: '40px', height: '40px' }}></div>
              </div>
              <div className="client-info-header">
                <div className="skeleton-text" style={{ width: '200px', height: '32px', margin: '8px 0' }}></div>
                {[1,2,3,4].map((i) => (
                  <div key={i} className="detail-item">
                    <div className="skeleton-text" style={{ width: '80px', height: '14px' }}></div>
                    <div className="skeleton-text" style={{ width: '120px', height: '16px', marginLeft: '10px' }}></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Details Grid Skeleton */}
          <div className="profile-content grid-container">
            {[
              'Company Information',
              'Primary Contact',
              'Secondary Contact',
              'Tertiary Contact',
              'Department Information',
              'Payment & Billing',
            ].map((section) => (
              <div key={section} className="section-card">
                <div className="skeleton-text" style={{ width: '180px', height: '20px', marginBottom: '20px' }}></div>
                <div className="detail-group">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="detail-item">
                      <div className="skeleton-text" style={{ width: '100px', height: '14px' }}></div>
                      <div className="skeleton-text" style={{ width: '140px', height: '16px', marginLeft: '10px' }}></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="client-view-container">
        <div className="error-container">
          <p className="error-message">{error || 'Failed to load client'}</p>
          <div className="error-actions">
            <button 
              className="button " 
              onClick={() => navigate('/client-management')}
            >
              Back to Clients
            </button>
            <button 
              className="button primary" 
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const companyName = getFieldValue(client, 'companyName') || 'Unnamed Client';

  return (
    <div className="client-view-container">
      <AppHeader
        title={typeof companyName === 'string' ? companyName : 'Client Details'}
        actions={
          <>
            <button 
              className="button" 
              onClick={() => navigate('/client-management')}
            >
              <ArrowLeft size={16} />
              <span>Back to Clients</span>
            </button>
            <button 
              className="button primary"
              onClick={handleEditClient}
            >
              <Edit size={16} />
              Edit Client
            </button>
          </>
        }
        statusMessage={error}
        statusType="error"
      />

      <main className="client-main">
        <div className="client-overview section-card">
          <div className="client-banner"></div>
          
          <div className="client-details">
            <div className="client-avatar">
              <Building size={40} />
            </div>
            <div className="client-info-header">
              <h1 className="client-name">{companyName}</h1>
              {renderDetailItem('Billing Name', getFieldValue(client, 'billingName'))}
              {renderDetailItem('Short Code', getFieldValue(client, 'shortCode'))}
              {renderDetailItem('Created', formatDate(getFieldValue(client, 'createdAt')))}
              {renderDetailItem('Last Updated', formatDate(getFieldValue(client, 'updatedAt') || getFieldValue(client, 'lastUpdated')))}
            </div>
          </div>
        </div>
        
        <div className="profile-content grid-container">
          <div className="personal-details-section section-card">
            <h2 className="section-title">Company Information</h2>
            <div className="detail-group">
              {renderDetailItem('Company Name', getFieldValue(client, 'companyName'))}
              {renderDetailItem('Billing Name', getFieldValue(client, 'billingName'))}
              {renderDetailItem('Short Code', getFieldValue(client, 'shortCode'))}
              {renderDetailItem('List Name', getFieldValue(client, 'listName'))}
              {renderWebsiteItem('Website', getFieldValue(client, 'website'))}
              {renderDetailItem('Client Manager', getFieldValue(client, 'clientManager'))}
              {renderDetailItem('Sales Person', getFieldValue(client, 'salesPerson'))}
              {renderDetailItem('Accounting Person', getFieldValue(client, 'accountingPerson'))}
              {renderDetailItem('Accounting Manager', getFieldValue(client, 'accountingManager'))}
              {renderDetailItem('Client Representative', getFieldValue(client, 'clientRep'))}
              {renderDetailItem('Merge Invoice', getFieldValue(client, 'mergeInvoice'))}
              {renderDetailItem('Currency', getFieldValue(client, 'currency'))}
              {renderDetailItem('Work Province', getFieldValue(client, 'workProvince'))}
              {renderDetailItem('WSIB Code', getFieldValue(client, 'wsibCode'))}
            </div>
          </div>
          
          <div className="contact-section section-card">
            <h2 className="section-title">Primary Contact</h2>
            <div className="detail-group">
              {renderDetailItem('Contact Person', getFieldValue(client, 'contactPersonName1'))}
              {renderDetailItem('Email Address', getFieldValue(client, 'emailAddress1'))}
              {renderDetailItem('Mobile', getFieldValue(client, 'mobile1'))}
              {renderDetailItem('Address', getFieldValue(client, 'streetAddress1'))}
              {renderDetailItem('City', getFieldValue(client, 'city1'))}
              {renderDetailItem('Province', getFieldValue(client, 'province1'))}
              {renderDetailItem('Postal Code', getFieldValue(client, 'postalCode1'))}
            </div>
          </div>
          
          <div className="contact-section section-card">
            <h2 className="section-title">Secondary Contact</h2>
            <div className="detail-group">
              {renderDetailItem('Contact Person', getFieldValue(client, 'contactPersonName2'))}
              {renderDetailItem('Email Address', getFieldValue(client, 'emailAddress2'))}
              {renderDetailItem('Mobile', getFieldValue(client, 'mobile2'))}
              {renderDetailItem('CC on Invoices', getFieldValue(client, 'invoiceCC2'))}
              {renderDetailItem('Address', getFieldValue(client, 'streetAddress2'))}
              {renderDetailItem('City', getFieldValue(client, 'city2'))}
              {renderDetailItem('Province', getFieldValue(client, 'province2'))}
              {renderDetailItem('Postal Code', getFieldValue(client, 'postalCode2'))}
            </div>
          </div>
          
          <div className="contact-section section-card">
            <h2 className="section-title">Tertiary Contact</h2>
            <div className="detail-group">
              {renderDetailItem('Contact Person', getFieldValue(client, 'contactPersonName3'))}
              {renderDetailItem('Email Address', getFieldValue(client, 'emailAddress3'))}
              {renderDetailItem('Mobile', getFieldValue(client, 'mobile3'))}
              {renderDetailItem('CC on Invoices', getFieldValue(client, 'invoiceCC3'))}
              {renderDetailItem('Address', getFieldValue(client, 'streetAddress3'))}
              {renderDetailItem('City', getFieldValue(client, 'city3'))}
              {renderDetailItem('Province', getFieldValue(client, 'province3'))}
              {renderDetailItem('Postal Code', getFieldValue(client, 'postalCode3'))}
            </div>
          </div>
          
          <div className="department-section section-card">
            <h2 className="section-title">Department Information</h2>
            <div className="detail-group">
              {renderDetailItem('Dispatch Department Email', getFieldValue(client, 'dispatchDeptEmail'))}
              {renderDetailItem('CC Dispatch on Invoices', getFieldValue(client, 'invoiceCCDispatch'))}
              {renderDetailItem('Accounts Department Email', getFieldValue(client, 'accountsDeptEmail'))}
              {renderDetailItem('CC Accounts on Invoices', getFieldValue(client, 'invoiceCCAccounts'))}
              {renderDetailItem('Invoice Language', getFieldValue(client, 'invoiceLanguage'))}
            </div>
          </div>
          
          <div className="payment-section section-card">
            <h2 className="section-title">Payment & Billing</h2>
            <div className="detail-group">
              {renderDetailItem('Preferred Payment Method', getFieldValue(client, 'preferredPaymentMethod'))}
              {renderDetailItem('Terms', getFieldValue(client, 'terms'))}
              {renderDetailItem('Pay Cycle', getFieldValue(client, 'payCycle'))}
              {renderDetailItem('Credit Limit', getFieldValue(client, 'creditLimit'))}
              {renderDetailItem('Notes', getFieldValue(client, 'notes'))}
            </div>
          </div>
        </div>

        {/* Consent Records Section */}
        <section className="" style={{ marginTop: 40 }}>
          <h2 className="section-title">Digital Consent Records for {companyName}</h2>
          <div className="jsp-consent-content">
            {consentLoading ? (
              <div className="jsp-consent-list">
                {Array.from({ length: consentPagination.itemsPerPage }, (_, index) => (
                  <SkeletonCard key={index} />
                ))}
              </div>
            ) : consentError ? (
              <div className="error-container">
                <p className="error-message">{consentError}</p>
                <button className="button primary" onClick={() => handleConsentPageChange(1)}>
                  Try Again
                </button>
              </div>
            ) : (
              <div className="jsp-consent-list">
                {consentRecords.length === 0 ? (
                  <div className="jsp-empty-state">
                    <FileCheck size={48} className="jsp-empty-icon" />
                    <h3>No Consent Records Found</h3>
                    <p>No digital consent documents have been sent to this client yet.</p>
                  </div>
                ) : (
                  consentRecords.map((record) => (
                    <div key={record.id} className="jsp-consent-card" data-status={record.status}>
                      <div className="jsp-consent-header">
                        <div className="jsp-consent-title-section">
                          <h3 className="jsp-consent-title">{record.consent_documents.file_name}</h3>
                          <div className="jsp-consent-code">Version {record.consent_documents.version}</div>
                        </div>
                        <div className={`jsp-status-badge ${record.status}`}>
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </div>
                      </div>
                      <div className="jsp-consent-details">
                        <div className="jsp-detail-row">
                          <Calendar size={16} />
                          <span>Sent: {formatConsentDate(record.sent_at)}</span>
                        </div>
                        {record.completed_at && (
                          <div className="jsp-detail-row">
                            <CheckCircle size={16} />
                            <span>Completed: {formatConsentDate(record.completed_at)}</span>
                          </div>
                        )}
                        {record.consented_name && (
                          <div className="jsp-detail-row">
                            <User size={16} />
                            <span>Consented Name: {record.consented_name}</span>
                          </div>
                        )}
                        <div className="jsp-detail-row">
                          <Clock size={16} />
                          <span>Status: {record.status}</span>
                        </div>
                      </div>
                      <div className="jsp-consent-actions">
                        <button
                          className="button primary"
                          onClick={() => navigate(`/consent-dashboard/${record.document_id}`)}
                        >
                          <Eye size={16} />
                          View Consent Record
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {/* Consent Pagination Controls */}
            {!consentLoading && consentPagination.totalPages > 1 && (
              <div className="jsp-pagination-controls bottom">
                <div className="jsp-pagination-info">
                  <span className="jsp-pagination-text">
                    Page {consentPagination.currentPage} of {consentPagination.totalPages}
                  </span>
                </div>
                <div className="jsp-pagination-buttons">
                  <button
                    className="jsp-pagination-btn prev"
                    onClick={() => handleConsentPageChange(consentPagination.currentPage - 1)}
                    disabled={consentPagination.currentPage === 1}
                    title="Previous Page"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft size={16} />
                    <span>Previous</span>
                  </button>
                  <div className="jsp-page-numbers">
                    {Array.from({ length: Math.min(5, consentPagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (consentPagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (consentPagination.currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (consentPagination.currentPage >= consentPagination.totalPages - 2) {
                        pageNum = consentPagination.totalPages - 4 + i;
                      } else {
                        pageNum = consentPagination.currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          className={`jsp-page-number-btn ${pageNum === consentPagination.currentPage ? 'active' : ''}`}
                          onClick={() => handleConsentPageChange(pageNum)}
                          aria-label={`Go to page ${pageNum}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    className="jsp-pagination-btn next"
                    onClick={() => handleConsentPageChange(consentPagination.currentPage + 1)}
                    disabled={consentPagination.currentPage === consentPagination.totalPages}
                    title="Next Page"
                    aria-label="Next Page"
                  >
                    <span>Next</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
} 