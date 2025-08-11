import { useState, useEffect } from 'react';
import { AlertCircle} from 'lucide-react';
import '../styles/components/IframeViewer.css';

interface IframeViewerProps {
  url: string;
  title?: string;
  allowedUserTypes?: ('admin' | 'recruiter' | 'jobseeker')[];
  currentUserType?: 'admin' | 'recruiter' | 'jobseeker';
  onAccessDenied?: () => void;
}

export function IframeViewer({
  url,
  title = 'External Content',
  allowedUserTypes = ['admin', 'recruiter', 'jobseeker'],
  currentUserType,
  onAccessDenied
}: IframeViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Check if user has access to this content
  const hasAccess = !currentUserType || allowedUserTypes.includes(currentUserType);

  useEffect(() => {
    if (!hasAccess) {
      setHasError(true);
      setErrorMessage('Access denied. You do not have permission to view this content.');
      onAccessDenied?.();
      return;
    }

    // Reset states when URL changes
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
  }, [url, hasAccess, onAccessDenied]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
    setErrorMessage('Failed to load the external content. Please check the URL and try again.');
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
    // Force iframe refresh by changing the key
    setRefreshKey(prev => prev + 1);
  };

  if (!hasAccess) {
    return (
      <div className="iframe-viewer-container">
        <div className="iframe-error">
          <AlertCircle size={48} className="error-icon" />
          <h3>Access Denied</h3>
          <p>{errorMessage}</p>
          <button 
            className="button primary"
            onClick={() => onAccessDenied?.()}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="iframe-viewer-container">

      <div className="iframe-content">
        {isLoading && (
          <div className="iframe-loading">
            <div className="loading-spinner"></div>
            <p>Loading content...</p>
          </div>
        )}
        
        {hasError && (
          <div className="iframe-error">
            <AlertCircle size={48} className="error-icon" />
            <h3>Error Loading Content</h3>
            <p>{errorMessage}</p>
            <button 
              className="button primary"
              onClick={handleRefresh}
            >
              Try Again
            </button>
          </div>
        )}

        <iframe
          key={refreshKey}
          src={url}
          title={title}
          className="content-iframe"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          loading="lazy"
        />
      </div>
    </div>
  );
} 