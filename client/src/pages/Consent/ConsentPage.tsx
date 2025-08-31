import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle, AlertCircle, FileText, User, Calendar, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { viewConsentByToken, submitConsent } from '../../services/api/consent';
import { useLanguage } from '../../contexts/language/language-provider';
import { ThemeToggle } from '../../components/theme-toggle';
import { LanguageToggle } from '../../components/LanguageToggle';
import { supabase } from '../../lib/supabaseClient';
import canhireLogo from '../../assets/logos/canhire-logo-fulllength.png';
import '../../styles/pages/ConsentPage.css';

// Set worker path for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface ConsentData {
  recordId: string;
  status: string;
  completedAt?: string;
  consentedName?: string;
  document: {
    id: string;
    fileName: string;
    filePath: string;
    version: number;
    createdAt: string;
  };
  entity: {
    name: string;
    email: string;
    type: string;
  };
}

export function ConsentPage() {
  const location = useLocation();
  const { t } = useLanguage();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consentData, setConsentData] = useState<ConsentData | null>(null);
  const [consentedName, setConsentedName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // PDF viewer state
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfLoading, setPdfLoading] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1.0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Extract token from URL
  const token = new URLSearchParams(location.search).get('token');

  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // PDF viewer functions
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfLoading(false);
    setPdfError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setPdfError(t('consent.pdfLoadError'));
    setPdfLoading(false);
  };

  const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages || 1));
  const zoomIn = () => setScale(prev => Math.min(prev + 0.1, 2.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));
  const resetZoom = () => setScale(1.0);

  const calculatePdfWidth = () => {
    const containerWidth = Math.min(windowSize.width * 0.65, 750);
    return containerWidth * scale;
  };

  // Helper function to decode HTML entities from file paths
  const decodeFilePath = (filePath: string): string => {
    return filePath
      .replace(/&#x2F;/g, '/')
      .replace(/&#x5C;/g, '\\')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  };

  // Function to generate signed URL for document preview
  const getSignedUrl = useCallback(async (filePath: string): Promise<string | null> => {
    try {
      const decodedPath = decodeFilePath(filePath);
      console.log(`Getting signed URL for consent document: ${decodedPath}`);

      const { data, error } = await supabase.storage
        .from('consent-documents')
        .createSignedUrl(decodedPath, 300); // 5 minutes expiry

      if (error) {
        console.error("Error creating signed URL:", error);
        return null;
      }

      console.log(`Signed URL created successfully for consent document`);
      return data?.signedUrl || null;
    } catch (err) {
      console.error("Error in getSignedUrl:", err);
      return null;
    }
  }, []);

  // Load consent data
  useEffect(() => {
    const loadConsentData = async () => {
      if (!token) {
        setError(t('consent.invalidToken'));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const response = await viewConsentByToken(token);
        
        if (response.success) {
          setConsentData(response.data);
          // Reset PDF state when new document loads
          setPageNumber(1);
          setPdfLoading(true);
          setPdfError(null);
          setPdfUrl(null);
          
          // Load PDF URL if document path exists
          if (response.data.document.filePath) {
            try {
              const signedUrl = await getSignedUrl(response.data.document.filePath);
              if (signedUrl) {
                setPdfUrl(signedUrl);
              } else {
                setPdfError(t('consent.pdfLoadError'));
              }
            } catch (err) {
              console.error('Error loading PDF URL:', err);
              setPdfError(t('consent.pdfLoadError'));
            }
          }
          
          // Pre-fill name if already consented
          if (response.data.status === 'completed' && response.data.consentedName) {
            setConsentedName(response.data.consentedName);
          }
        } else {
          setError(t('consent.loadFailed'));
        }
      } catch (err) {
        console.error('Error loading consent data:', err);
        setError(err instanceof Error ? err.message : t('consent.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadConsentData();
  }, [token, t, getSignedUrl]);

  // Submit consent
  const handleSubmitConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token || !consentedName.trim()) {
      setError(t('consent.nameRequired'));
      return;
    }

    if (consentedName.trim().length < 2) {
      setError(t('consent.nameInvalid'));
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      const response = await submitConsent(token, consentedName.trim());
      
      if (response.success) {
        setIsSubmitted(true);
        // Update the local state to reflect completed status
        if (consentData) {
          setConsentData({
            ...consentData,
            status: 'completed',
            completedAt: response.data.completedAt,
            consentedName: response.data.consentedName
          });
        }
      } else {
        setError(t('consent.submitFailed'));
      }
    } catch (err) {
      console.error('Error submitting consent:', err);
      if (err instanceof Error && err.message.includes('already been provided')) {
        setError(t('consent.alreadyProvided'));
        // Reload the page to show the completion state
        window.location.reload();
      } else {
        setError(err instanceof Error ? err.message : t('consent.submitFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // const getStatusIcon = (status: string) => {
  //   switch (status) {
  //     case 'completed':
  //       return <CheckCircle className="ccp-status-icon ccp-status-completed" size={24} />;
  //     case 'pending':
  //       return <Clock className="ccp-status-icon ccp-status-pending" size={24} />;
  //     case 'expired':
  //       return <AlertCircle className="ccp-status-icon ccp-status-expired" size={24} />;
  //     default:
  //       return <Clock className="ccp-status-icon" size={24} />;
  //   }
  // };

  if (loading) {
    return (
      <div className="ccp-page">
        {/* Skeleton Header */}
        <header className="ccp-header">
          <div className="ccp-header-content">
            <div className="ccp-logo">
              <div className="ccp-skeleton-text" style={{ width: '200px', height: '32px' }}></div>
            </div>
            
            <div className="ccp-header-center">
              <div className="ccp-status-container">
                <div className="ccp-skeleton-icon" style={{ width: '24px', height: '24px' }}></div>
                <div className="ccp-status-text">
                  <div className="ccp-skeleton-text" style={{ width: '180px', height: '18px', marginBottom: '4px' }}></div>
                  <div className="ccp-skeleton-badge" style={{ width: '100px', height: '20px' }}></div>
                </div>
              </div>
            </div>

            <div className="ccp-header-actions">
              <div className="ccp-toggle-container">
                <div className="ccp-skeleton-text" style={{ width: '80px', height: '36px' }}></div>
                <div className="ccp-skeleton-icon" style={{ width: '36px', height: '36px' }}></div>
              </div>
            </div>
          </div>
        </header>

        {/* Skeleton Main Layout */}
        <div className="ccp-main-layout">
          {/* Skeleton PDF Panel */}
          <div className="ccp-pdf-panel">
            <div className="ccp-pdf-header">
              <div className="ccp-pdf-title">
                <div className="ccp-skeleton-icon" style={{ width: '20px', height: '20px' }}></div>
                <div className="ccp-skeleton-text" style={{ width: '150px', height: '16px' }}></div>
              </div>
              <div className="ccp-pdf-controls">
                <div className="ccp-skeleton-icon" style={{ width: '32px', height: '32px' }}></div>
                <div className="ccp-skeleton-text" style={{ width: '40px', height: '16px' }}></div>
                <div className="ccp-skeleton-icon" style={{ width: '32px', height: '32px' }}></div>
                <div className="ccp-skeleton-icon" style={{ width: '32px', height: '32px' }}></div>
              </div>
            </div>
            <div className="ccp-pdf-viewer">
              <div className="ccp-skeleton-text" style={{ width: '100%', height: '600px' }}></div>
            </div>
          </div>

          {/* Skeleton Content Panel */}
          <div className="ccp-content-panel">
            {/* Skeleton Document Info */}
            <div className="ccp-document-info">
              <div className="ccp-info-header">
                <div className="ccp-skeleton-icon" style={{ width: '20px', height: '20px' }}></div>
                <div className="ccp-skeleton-text" style={{ width: '120px', height: '18px' }}></div>
              </div>
              <div className="ccp-info-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="ccp-info-item">
                    <div className="ccp-skeleton-text" style={{ width: '80px', height: '12px' }}></div>
                    <div className="ccp-skeleton-text" style={{ width: '120px', height: '12px' }}></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skeleton Form Section */}
            <div className="ccp-form-section">
              <div className="ccp-form-header">
                <div className="ccp-skeleton-text" style={{ width: '160px', height: '18px', marginBottom: '8px' }}></div>
                <div className="ccp-skeleton-text" style={{ width: '100%', height: '14px' }}></div>
                <div className="ccp-skeleton-text" style={{ width: '80%', height: '14px' }}></div>
              </div>
              <div className="ccp-consent-form">
                <div className="ccp-form-group">
                  <div className="ccp-skeleton-text" style={{ width: '100px', height: '16px', marginBottom: '8px' }}></div>
                  <div className="ccp-skeleton-text" style={{ width: '100%', height: '44px' }}></div>
                </div>
                <div className="ccp-form-group">
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div className="ccp-skeleton-text" style={{ width: '18px', height: '18px', flexShrink: 0 }}></div>
                    <div className="ccp-skeleton-text" style={{ width: '100%', height: '48px' }}></div>
                  </div>
                </div>
                <div className="ccp-form-actions">
                  <div className="ccp-skeleton-text" style={{ width: '140px', height: '44px' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Skeleton Footer */}
        <footer className="ccp-footer">
          <div className="ccp-skeleton-text" style={{ width: '300px', height: '12px', margin: '0 auto' }}></div>
        </footer>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ccp-page">
        <div className="ccp-error-container">
          <div className="ccp-error-content">
            <AlertCircle className="ccp-error-icon" size={48} />
            <h1 className="ccp-error-title">{t('consent.unableToLoad')}</h1>
            <p className="ccp-error-message">{error}</p>
            <button 
              className="ccp-button ccp-button-secondary"
              onClick={() => window.location.reload()}
            >
              {t('buttons.tryAgain')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!consentData) {
    return (
      <div className="ccp-page">
        <div className="ccp-error-container">
          <div className="ccp-error-content">
            <AlertCircle className="ccp-error-icon" size={48} />
            <h1 className="ccp-error-title">{t('consent.documentNotFound')}</h1>
            <p className="ccp-error-message">{t('consent.documentNotFoundDesc')}</p>
          </div>
        </div>
      </div>
    );
  }

  const isCompleted = consentData.status === 'completed';
  const isExpired = consentData.status === 'expired';

  return (
    <div className="ccp-page">
      {/* Header */}
      <header className="ccp-header">
        <div className="ccp-header-content">
          <div className="ccp-logo">
            <img src={canhireLogo} alt={t('app.name')} className="ccp-logo-image" />
          </div>
          
          <div className="ccp-header-center">
            <div className="ccp-status-container">
              {/* {getStatusIcon(consentData.status)} */}
              <div className="ccp-status-text">
                <h2 className="ccp-status-title">{t('consent.digitalConsentRequest')}</h2>
                <p className={`ccp-status-label ccp-status-${consentData.status}`}>
                  {consentData.status === 'completed' ? t('consent.consentProvided') : 
                   consentData.status === 'expired' ? t('consent.expired') : t('consent.pendingConsent')}
                </p>
              </div>
            </div>
          </div>

          <div className="ccp-header-actions">
            <div className="ccp-toggle-container">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="ccp-main-layout">
        {/* PDF Viewer Panel */}
        <div className="ccp-pdf-panel">
          <div className="ccp-pdf-header">
            <div className="ccp-pdf-title">
              <FileText className="ccp-pdf-icon" size={20} />
              <span>{consentData.document.fileName}</span>
            </div>
            <div className="ccp-pdf-controls">
              <button 
                type="button" 
                className="ccp-pdf-control-btn" 
                onClick={zoomOut} 
                title={t('buttons.zoomOut')}
                disabled={scale <= 0.5}
              >
                <ZoomOut size={16} />
              </button>
              <span className="ccp-zoom-indicator">{Math.round(scale * 100)}%</span>
              <button 
                type="button" 
                className="ccp-pdf-control-btn" 
                onClick={zoomIn} 
                title={t('buttons.zoomIn')}
                disabled={scale >= 2.0}
              >
                <ZoomIn size={16} />
              </button>
              <button 
                type="button" 
                className="ccp-pdf-control-btn" 
                onClick={resetZoom} 
                title={t('buttons.resetZoom')}
              >
                <RotateCw size={16} />
              </button>
            </div>
          </div>

          <div className="ccp-pdf-viewer">
            {pdfLoading && !pdfUrl && (
              <div className="ccp-pdf-loading">
                <div className="ccp-skeleton-text" style={{ width: '100%', height: '500px', marginBottom: '16px' }}></div>
                <div className="ccp-skeleton-text" style={{ width: '150px', height: '14px', margin: '0 auto' }}></div>
              </div>
            )}
          
            
            {pdfError && (
              <div className="ccp-pdf-error">
                <AlertCircle size={24} />
                <p>{pdfError}</p>
              </div>
            )}

            {!pdfLoading && !pdfError && !pdfUrl && (
              <div className="ccp-pdf-error">
                <AlertCircle size={24} />
                <p>{t('consent.documentNotAvailable')}</p>
              </div>
            )}

            {pdfUrl && (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                className="ccp-pdf-document"
              >
                <Page 
                  pageNumber={pageNumber} 
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="ccp-pdf-page"
                  width={calculatePdfWidth()}
                  scale={scale}
                />
              </Document>
            )}
          </div>

          {numPages && numPages > 1 && (
            <div className="ccp-pdf-pagination">
              <button 
                type="button"
                className="ccp-pdf-nav-btn" 
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
              >
                {t('buttons.previous')}
              </button>
              <span className="ccp-page-indicator">
                {t('consent.pageOfPages', { current: pageNumber, total: numPages })}
              </span>
              <button 
                type="button"
                className="ccp-pdf-nav-btn" 
                onClick={goToNextPage}
                disabled={pageNumber >= (numPages || 1)}
              >
                {t('buttons.next')}
              </button>
            </div>
          )}
        </div>

        {/* Content Panel */}
        <div className="ccp-content-panel">
          {/* Document Information */}
          <div className="ccp-document-info">
            <div className="ccp-info-header">
              <FileText className="ccp-info-icon" size={20} />
              <h3 className="ccp-info-title">{t('consent.documentDetails')}</h3>
            </div>
            <div className="ccp-info-grid">
              <div className="ccp-info-item">
                <span className="ccp-info-label">{t('consent.documentName')}:</span>
                <span className="ccp-info-value">{consentData.document.fileName}</span>
              </div>
              <div className="ccp-info-item">
                <span className="ccp-info-label">{t('consent.recipient')}:</span>
                <span className="ccp-info-value">{consentData.entity.name}</span>
              </div>
              <div className="ccp-info-item">
                <span className="ccp-info-label">{t('forms.email')}:</span>
                <span className="ccp-info-value">{consentData.entity.email}</span>
              </div>
              <div className="ccp-info-item">
                <span className="ccp-info-label">{t('consent.created')}:</span>
                <span className="ccp-info-value">{formatDate(consentData.document.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Main Content Based on Status */}
          {isCompleted ? (
            /* Completion View */
            <div className="ccp-completion-section">
              <div className="ccp-completion-header">
                <CheckCircle className="ccp-completion-icon" size={48} />
                <h3 className="ccp-completion-title">{t('consent.consentSuccessful')}</h3>
              </div>
              <div className="ccp-completion-details">
                <div className="ccp-completion-item">
                  <User className="ccp-completion-detail-icon" size={16} />
                  <div className="ccp-completion-info">
                    <span className="ccp-completion-label">{t('consent.consentedBy')}:</span>
                    <span className="ccp-completion-value">{consentData.consentedName}</span>
                  </div>
                </div>
                <div className="ccp-completion-item">
                  <Calendar className="ccp-completion-detail-icon" size={16} />
                  <div className="ccp-completion-info">
                    <span className="ccp-completion-label">{t('consent.dateTime')}:</span>
                    <span className="ccp-completion-value">
                      {consentData.completedAt ? formatDate(consentData.completedAt) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="ccp-completion-note">
                <p className="ccp-completion-text">
                  {t('consent.consentRecorded')}
                </p>
              </div>
            </div>
          ) : isExpired ? (
            /* Expired View */
            <div className="ccp-expired-section">
              <div className="ccp-expired-header">
                <AlertCircle className="ccp-expired-icon" size={48} />
                <h3 className="ccp-expired-title">{t('consent.requestExpired')}</h3>
              </div>
              <p className="ccp-expired-text">
                {t('consent.requestExpiredDesc')}
              </p>
            </div>
          ) : (
            /* Consent Form */
            <div className="ccp-form-section">
              <div className="ccp-form-header">
                <h3 className="ccp-form-title">{t('consent.provideConsent')}</h3>
                <p className="ccp-form-description">
                  {t('consent.provideConsentDesc')}
                </p>
              </div>

              <form onSubmit={handleSubmitConsent} className="ccp-consent-form">
                <div className="ccp-form-group">
                  <label htmlFor="consentedName" className="ccp-form-label">
                    <User className="ccp-label-icon" size={16} />
                    {t('forms.fullName')} *
                  </label>
                  <input
                    type="text"
                    id="consentedName"
                    value={consentedName}
                    onChange={(e) => setConsentedName(e.target.value)}
                    className="ccp-form-input"
                    placeholder={t('forms.fullNamePlaceholder')}
                    required
                    disabled={submitting}
                    autoComplete="name"
                  />
                </div>

                <div className="ccp-form-group">
                  <label className="ccp-checkbox-label">
                    <input
                      type="checkbox"
                      required
                      disabled={submitting}
                      className="ccp-form-checkbox"
                    />
                    <span className="ccp-checkbox-text">
                      {t('consent.confirmationText')}
                    </span>
                  </label>
                </div>

                {error && (
                  <div className="ccp-error-message">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                {isSubmitted && (
                  <div className="ccp-success-message">
                    <CheckCircle size={16} />
                    <span>{t('consent.submitSuccess')}</span>
                  </div>
                )}

                <div className="ccp-form-actions">
                  <button
                    type="submit"
                    className="ccp-button ccp-button-primary"
                    disabled={submitting || !consentedName.trim()}
                  >
                    {submitting ? t('buttons.submitting') : t('consent.provideConsentButton')}
                  </button>
                </div>
              </form>

              <div className="ccp-security-note">
                <p className="ccp-security-text">
                  <strong>{t('consent.securityNote')}:</strong> {t('consent.securityNoteDesc')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="ccp-footer">
        <p className="ccp-footer-text">
          {t('consent.poweredBy')} <strong>{t('app.name')}</strong> • {t('consent.secureDigitalConsent')}
        </p>
      </footer>
    </div>
  );
}
