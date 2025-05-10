import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X } from 'lucide-react';
import '../styles/components/PDFViewerModal.css';

// Set worker path - this is required for react-pdf to work
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerModalProps {
  pdfUrl: string | null;
  documentName?: string;
  isOpen: boolean;
  onClose: () => void;
}

const PDFViewerModal: React.FC<PDFViewerModalProps> = ({ 
  pdfUrl, 
  documentName = 'Document', 
  isOpen, 
  onClose 
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scale, setScale] = useState<number>(1.0);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Effect to listen for window resize
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

  // Reset to first page whenever a new PDF is loaded
  useEffect(() => {
    if (pdfUrl) {
      setPageNumber(1);
      setLoading(true);
      setError(null);
    }
  }, [pdfUrl]);

  // Function to handle successful document loading
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  // Function to handle document loading error
  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setError('Failed to load PDF. Please try again later.');
    setLoading(false);
  };

  // Functions to navigate between pages
  const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages || 1));

  // Functions to zoom in/out
  const zoomIn = () => setScale(prev => Math.min(prev + 0.1, 2.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));
  const resetZoom = () => setScale(1.0);

  // Calculate optimal width
  const calculateWidth = () => {
    const maxWidth = Math.min(windowSize.width * 0.8, 800);
    return maxWidth * scale;
  };

  if (!isOpen) return null;

  // Prevent form submission if this modal is inside a form
  const preventFormSubmission = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  return (
    <div 
      className="pdf-modal-overlay" 
      onClick={onClose}
      onSubmit={preventFormSubmission}
    >
      <div 
        className="pdf-modal-content" 
        onClick={e => e.stopPropagation()}
        onSubmit={preventFormSubmission}
      >
        <div className="pdf-modal-header">
          <h3 className="pdf-modal-title">{documentName}</h3>
          <div className="pdf-modal-zoom-controls">
            <button type="button" className="pdf-zoom-button" onClick={zoomOut} title="Zoom out">-</button>
            <button type="button" className="pdf-zoom-button" onClick={resetZoom} title="Reset zoom">100%</button>
            <button type="button" className="pdf-zoom-button" onClick={zoomIn} title="Zoom in">+</button>
          </div>
          <button type="button" className="pdf-modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="pdf-modal-body">
          {loading && (
            <div className="pdf-loading-container">
              <div className="pdf-loading-spinner"></div>
              <p>Loading PDF...</p>
            </div>
          )}
          
          {error && (
            <div className="pdf-error-container">
              <p className="pdf-error-message">{error}</p>
            </div>
          )}

          {pdfUrl && (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<div className="pdf-loading">Loading PDF...</div>}
              className="pdf-document"
            >
              <Page 
                pageNumber={pageNumber} 
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="pdf-page"
                width={calculateWidth()}
                scale={scale}
              />
            </Document>
          )}
        </div>

        {numPages && numPages > 0 && (
          <div className="pdf-modal-footer">
            <div className="pdf-pagination">
              <button 
                type="button"
                className="pdf-nav-button" 
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
              >
                Previous
              </button>
              <span className="pdf-page-indicator">
                Page {pageNumber} of {numPages}
              </span>
              <button 
                type="button"
                className="pdf-nav-button" 
                onClick={goToNextPage}
                disabled={pageNumber >= (numPages || 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewerModal; 