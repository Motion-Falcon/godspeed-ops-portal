import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, FileText, User, Calendar, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { getJobseekerOnboardingConsent, submitConsent } from '../../services/api/consent';
import { useLanguage } from '../../contexts/language/language-provider';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { AppHeader } from '../../components/AppHeader';
import '../../styles/pages/ConsentPage.css';
import '../../styles/pages/OnboardingConsent.css';

// Set worker path for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface OnboardingConsentData {
  status: string;
  token: string;
  completedAt?: string;
  consentedName?: string;
  document: {
    id: string;
    fileName: string;
    filePath: string;
    consentMode: string;
    version: number;
    createdAt: string;
  };
}

export function OnboardingConsent() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, hasProfile, employmentAgreementSigned } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consentData, setConsentData] = useState<OnboardingConsentData | null>(null);
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

  // Redirect if already signed
  useEffect(() => {
    if (employmentAgreementSigned) {
      navigate(hasProfile ? '/dashboard' : '/profile/create', { replace: true });
    }
  }, [employmentAgreementSigned, hasProfile, navigate]);

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
      const { data, error } = await supabase.storage
        .from('consent-documents')
        .createSignedUrl(decodedPath, 300);

      if (error) {
        console.error("Error creating signed URL:", error);
        return null;
      }
      return data?.signedUrl || null;
    } catch (err) {
      console.error("Error in getSignedUrl:", err);
      return null;
    }
  }, []);

  // Load consent data
  useEffect(() => {
    const loadConsentData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await getJobseekerOnboardingConsent();

        if (response.success) {
          setConsentData(response.data);
          setPageNumber(1);
          setPdfLoading(true);
          setPdfError(null);
          setPdfUrl(null);

          // If already completed, pre-fill name
          if (response.data.status === 'completed' && response.data.consentedName) {
            setConsentedName(response.data.consentedName);
          }

          // Load PDF URL
          if (response.data.document.filePath) {
            try {
              const signedUrl = await getSignedUrl(response.data.document.filePath);
              if (signedUrl) {
                setPdfUrl(signedUrl);
              } else {
                setPdfError(t('consent.pdfLoadError'));
              }
            } catch {
              setPdfError(t('consent.pdfLoadError'));
            }
          }
        } else {
          setError(t('consent.loadFailed'));
        }
      } catch (err) {
        console.error('Error loading onboarding consent:', err);
        setError(t('consent.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadConsentData();
  }, [t, getSignedUrl]);

  // Submit consent
  const handleSubmitConsent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!consentData?.token || !consentedName.trim()) {
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

      const response = await submitConsent(consentData.token, consentedName.trim());

      if (response.success) {
        setIsSubmitted(true);
        setConsentData({
          ...consentData,
          status: 'completed',
          completedAt: response.data.completedAt,
          consentedName: response.data.consentedName
        });

        // Refresh auth session to pick up updated user_metadata
        await supabase.auth.refreshSession();

        // Short delay to let the auth state propagate, then navigate
        setTimeout(() => {
          navigate(hasProfile ? '/dashboard' : '/profile/create', { replace: true });
        }, 1500);
      } else {
        setError(t('consent.submitFailed'));
      }
    } catch (err) {
      console.error('Error submitting onboarding consent:', err);
      if (err instanceof Error && err.message.includes('already been provided')) {
        // Already signed — refresh and redirect
        await supabase.auth.refreshSession();
        navigate(hasProfile ? '/dashboard' : '/profile/create', { replace: true });
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

  if (loading) {
    return (
      <div className="obc-page">
        <AppHeader title={t('consent.employmentAgreement')} />
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
      </div>
    );
  }

  if (error && !consentData) {
    return (
      <div className="obc-page">
        <AppHeader title={t('consent.employmentAgreement')} />
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

  if (!consentData) return null;

  const isCompleted = consentData.status === 'completed';

  return (
    <div className="obc-page">
      <AppHeader title={t('consent.employmentAgreement')} />

      <div className="obc-notice">
        <AlertCircle size={18} />
        <span>{t('consent.mustSignToAccess')}</span>
      </div>

      <div className="ccp-main-layout">
        {/* PDF Viewer Panel */}
        <div className="ccp-pdf-panel">
          <div className="ccp-pdf-header">
            <div className="ccp-pdf-title">
              <FileText className="ccp-pdf-icon" size={20} />
              <span>{consentData.document.fileName}</span>
            </div>
            <div className="ccp-pdf-controls">
              <button type="button" className="ccp-pdf-control-btn" onClick={zoomOut} disabled={scale <= 0.5} title={t('buttons.zoomOut')}>
                <ZoomOut size={16} />
              </button>
              <span className="ccp-zoom-indicator">{Math.round(scale * 100)}%</span>
              <button type="button" className="ccp-pdf-control-btn" onClick={zoomIn} disabled={scale >= 2.0} title={t('buttons.zoomIn')}>
                <ZoomIn size={16} />
              </button>
              <button type="button" className="ccp-pdf-control-btn" onClick={resetZoom} title={t('buttons.resetZoom')}>
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
              <button type="button" className="ccp-pdf-nav-btn" onClick={goToPrevPage} disabled={pageNumber <= 1}>
                {t('buttons.previous')}
              </button>
              <span className="ccp-page-indicator">
                {t('consent.pageOfPages', { current: pageNumber, total: numPages })}
              </span>
              <button type="button" className="ccp-pdf-nav-btn" onClick={goToNextPage} disabled={pageNumber >= (numPages || 1)}>
                {t('buttons.next')}
              </button>
            </div>
          )}
        </div>

        {/* Content Panel */}
        <div className="ccp-content-panel">
          {/* Document Info */}
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
                <span className="ccp-info-value">
                  {(user?.user_metadata as Record<string, unknown>)?.name as string || user?.email || ''}
                </span>
              </div>
              <div className="ccp-info-item">
                <span className="ccp-info-label">{t('forms.email')}:</span>
                <span className="ccp-info-value">{user?.email || ''}</span>
              </div>
              <div className="ccp-info-item">
                <span className="ccp-info-label">{t('consent.created')}:</span>
                <span className="ccp-info-value">{formatDate(consentData.document.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Consent Form or Completion */}
          {isCompleted || isSubmitted ? (
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
                    <span className="ccp-completion-value">{consentData.consentedName || consentedName}</span>
                  </div>
                </div>
                {consentData.completedAt && (
                  <div className="ccp-completion-item">
                    <Calendar className="ccp-completion-detail-icon" size={16} />
                    <div className="ccp-completion-info">
                      <span className="ccp-completion-label">{t('consent.dateTime')}:</span>
                      <span className="ccp-completion-value">{formatDate(consentData.completedAt)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="ccp-completion-note">
                <p className="ccp-completion-text">{t('consent.redirecting')}</p>
              </div>
            </div>
          ) : (
            <div className="ccp-form-section">
              <div className="ccp-form-header">
                <h3 className="ccp-form-title">{t('consent.provideConsent')}</h3>
                <p className="ccp-form-description">{t('consent.employmentAgreementDesc')}</p>
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
                      {t('consent.employmentAgreementConfirmation')}
                    </span>
                  </label>
                </div>

                {error && (
                  <div className="ccp-error-message">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <div className="ccp-form-actions">
                  <button
                    type="submit"
                    className="ccp-button ccp-button-primary"
                    disabled={submitting || !consentedName.trim()}
                  >
                    {submitting ? t('buttons.submitting') : t('consent.agreeAndContinue')}
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

      <footer className="ccp-footer">
        <p className="ccp-footer-text">
          {t('consent.poweredBy')} <strong>{t('app.name')}</strong> • {t('consent.secureDigitalConsent')}
        </p>
      </footer>
    </div>
  );
}
