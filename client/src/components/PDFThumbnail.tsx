import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Search } from 'lucide-react';
import '../styles/components/PDFThumbnail.css';

// Set worker path if not already set in the application
if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
}

interface PDFThumbnailProps {
  pdfUrl: string | null;
  onClick: () => void;
}

const PDFThumbnail: React.FC<PDFThumbnailProps> = ({ pdfUrl, onClick }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hover, setHover] = useState<boolean>(false);

  // Function to handle successful document loading
  const onDocumentLoadSuccess = () => {
    setLoading(false);
    setError(null);
  };

  // Function to handle document loading error
  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF thumbnail:', error);
    setError('Failed to load preview');
    setLoading(false);
  };

  return (
    <div 
      className="pdf-thumbnail-container"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* No URL yet — show a static PDF icon instead of a stuck spinner */}
      {!pdfUrl ? (
        <div className="pdf-thumbnail-placeholder">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="15" y2="17"/>
            <polyline points="9 9 10 9"/>
          </svg>
          <span className="pdf-thumbnail-label">PDF</span>
        </div>
      ) : (
        <>
          {loading && (
            <div className="pdf-thumbnail-loading">
              <div className="pdf-thumbnail-spinner"></div>
            </div>
          )}

          {error && (
            <div className="pdf-thumbnail-error">
              <p>{error}</p>
            </div>
          )}

          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            className="pdf-thumbnail-document"
          >
            <Page 
              pageNumber={1} 
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="pdf-thumbnail-page"
              width={300} 
              height={424}// Approximately A4 ratio
            />
          </Document>
        </>
      )}
      
      {hover && (
        <div className="pdf-thumbnail-overlay">
          <div className="pdf-thumbnail-overlay-content">
            <Search size={24} />
            <span>Preview</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFThumbnail; 