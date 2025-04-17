import React, { useState } from 'react';
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

  if (!isOpen) return null;

  return (
    <div className="pdf-modal-overlay" onClick={onClose}>
      <div className="pdf-modal-content" onClick={e => e.stopPropagation()}>
        <div className="pdf-modal-header">
          <h3 className="pdf-modal-title">{documentName}</h3>
          <button className="pdf-modal-close-btn" onClick={onClose}>
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
                width={Math.min(window.innerWidth * 0.8, 800)}
              />
            </Document>
          )}
        </div>

        {numPages && numPages > 0 && (
          <div className="pdf-modal-footer">
            <div className="pdf-pagination">
              <button 
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