import React, { useState } from 'react';
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
      
      {pdfUrl && (
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