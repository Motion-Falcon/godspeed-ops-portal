import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import PDFThumbnail from './PDFThumbnail';
import PDFViewerModal from './PDFViewerModal';
import { 
  FileText, 
  Eye, 
  Download, 
  Trash, 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  Image as ImageIcon,
  FileSpreadsheet,
  Mail,
  Plus,
  Loader2 // <-- add Loader2 for spinner
} from 'lucide-react';
import '../styles/components/InvoiceAttachments.css';

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const MAX_FILES = 10;
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/bmp',
  'image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'text/csv',
  'message/rfc822', // .eml files
  'application/octet-stream' // fallback for .eml files
];

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
  '.xls', '.xlsx', '.xlsm', '.csv',
  '.eml'
];

interface AttachmentFile {
  id: string;
  file?: File;
  fileName: string;
  fileSize: number;
  fileType: string;
  filePath?: string;
  previewUrl?: string;
  isUploaded: boolean;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'error';
  bucketName?: string;
}

interface InvoiceAttachmentsProps {
  value: AttachmentFile[];
  onChange: (attachments: AttachmentFile[]) => void;
  disabled?: boolean;
  bucketName?: string;
}

// Helper function to get file icon based on type
const getFileIcon = (fileType: string, fileName: string) => {
  if (fileType.startsWith('image/')) {
    return <ImageIcon size={16} />;
  } else if (fileType === 'application/pdf') {
    return <FileText size={16} />;
  } else if (fileType.includes('excel') || fileType.includes('spreadsheet') || 
             fileType === 'text/csv' || fileName.toLowerCase().endsWith('.csv')) {
    return <FileSpreadsheet size={16} />;
  } else if (fileType === 'message/rfc822' || fileName.toLowerCase().endsWith('.eml')) {
    return <Mail size={16} />;
  }
  return <FileText size={16} />;
};

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to validate file
const validateFile = (file: File): string | null => {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return `File size exceeds the 3MB limit. Current size: ${formatFileSize(file.size)}`;
  }

  // Check file extension
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `File type not allowed. Allowed types: PDF, Images (JPG, PNG, GIF, etc.), Excel (XLS, XLSX), EML files`;
  }

  // Check MIME type (less reliable but additional check)
  if (!ALLOWED_FILE_TYPES.includes(file.type) && file.type !== '') {
    // Special case for .eml files which might have different MIME types
    if (!file.name.toLowerCase().endsWith('.eml')) {
      return `File type not supported. Please use PDF, image, Excel, or EML files.`;
    }
  }

  return null;
};

export const InvoiceAttachments: React.FC<InvoiceAttachmentsProps> = ({
  value = [],
  onChange,
  disabled = false,
  bucketName = 'invoice-attachments'
}) => {
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfName, setSelectedPdfName] = useState<string>('Document');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate preview URLs for image files
  useEffect(() => {
    const updatePreviewUrls = async () => {
      const updatedAttachments = await Promise.all(
        value.map(async (attachment) => {
          if (attachment.file && attachment.fileType.startsWith('image/') && !attachment.previewUrl) {
            const previewUrl = URL.createObjectURL(attachment.file);
            return { ...attachment, previewUrl };
          } else if (attachment.filePath && attachment.fileType.startsWith('image/') && !attachment.previewUrl) {
            try {
              const bucket = attachment.bucketName || bucketName;
              const decodedFilePath = attachment.filePath.replace(/&#x2F;/g, '/');
              const { data } = await supabase.storage
                .from(bucket)
                .createSignedUrl(decodedFilePath, 300);
              if (data?.signedUrl) {
                return { ...attachment, previewUrl: data.signedUrl };
              }
            } catch (error) {
              console.error('Error creating signed URL for image:', error);
            }
          }
          return attachment;
        })
      );
      
      if (JSON.stringify(updatedAttachments) !== JSON.stringify(value)) {
        onChange(updatedAttachments);
      }
    };

    updatePreviewUrls();
  }, [value, onChange, bucketName]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const newErrors: string[] = [];

    // Check total file count
    if (value.length + files.length > MAX_FILES) {
      newErrors.push(`Maximum ${MAX_FILES} files allowed. You're trying to add ${files.length} files but already have ${value.length}.`);
    }

    // Validate each file
    const validFiles: File[] = [];
    files.forEach((file, index) => {
      const error = validateFile(file);
      if (error) {
        newErrors.push(`File ${index + 1} (${file.name}): ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    setErrors(newErrors);

    // Add valid files to attachments
    if (validFiles.length > 0 && value.length + validFiles.length <= MAX_FILES) {
      const newAttachments: AttachmentFile[] = validFiles.map(file => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        file,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        isUploaded: false,
        uploadStatus: 'pending',
      }));

      onChange([...value, ...newAttachments]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    const attachment = value.find(a => a.id === id);
    
    // Revoke preview URL if it exists
    if (attachment?.previewUrl && attachment.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(attachment.previewUrl);
    }

    onChange(value.filter(a => a.id !== id));
  };

  const handlePreviewFile = async (attachment: AttachmentFile) => {
    if (attachment.fileType === 'application/pdf') {
      let pdfUrl: string | null = null;

      if (attachment.file) {
        // Create object URL for local file
        pdfUrl = URL.createObjectURL(attachment.file);
      } else if (attachment.filePath) {
        // Get signed URL for uploaded file
        try {
          const bucket = attachment.bucketName || bucketName;
          const decodedFilePath = attachment.filePath.replace(/&#x2F;/g, '/');
          const { data } = await supabase.storage
            .from(bucket)
            .createSignedUrl(decodedFilePath, 300);
          pdfUrl = data?.signedUrl || null;
        } catch (error) {
          console.error('Error creating signed URL for PDF:', error);
        }
      }

      if (pdfUrl) {
        setSelectedPdfUrl(pdfUrl);
        setSelectedPdfName(attachment.fileName);
        setIsPdfModalOpen(true);
      }
    } else if (attachment.fileType.startsWith('image/')) {
      // For images, open in new tab or show in modal
      if (attachment.previewUrl) {
        window.open(attachment.previewUrl, '_blank');
      }
    } else {
      // For other file types, download
      handleDownloadFile(attachment);
    }
  };

  const handleDownloadFile = async (attachment: AttachmentFile) => {
    if (attachment.file) {
      // Download local file
      const url = URL.createObjectURL(attachment.file);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (attachment.filePath) {
      // Download uploaded file
      try {
        const bucket = attachment.bucketName || bucketName;
        const decodedFilePath = attachment.filePath.replace(/&#x2F;/g, '/');
        const { data } = await supabase.storage
          .from(bucket)
          .createSignedUrl(decodedFilePath, 300);
        
        if (data?.signedUrl) {
          const a = document.createElement('a');
          a.href = data.signedUrl;
          a.download = attachment.fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } catch (error) {
        console.error('Error downloading file:', error);
      }
    }
  };

  const renderAttachmentThumbnail = (attachment: AttachmentFile) => {
    if (attachment.fileType === 'application/pdf' && (attachment.file || attachment.filePath)) {
      let pdfUrl: string | null = null;
      
      if (attachment.file) {
        pdfUrl = URL.createObjectURL(attachment.file);
      } else if (attachment.previewUrl) {
        pdfUrl = attachment.previewUrl;
      }

      return (
        <PDFThumbnail 
          pdfUrl={pdfUrl}
          onClick={() => handlePreviewFile(attachment)}
        />
      );
    } else if (attachment.fileType.startsWith('image/') && attachment.previewUrl) {
      return (
        <div className="attachment-image-thumbnail" onClick={() => handlePreviewFile(attachment)}>
          <img 
            src={attachment.previewUrl} 
            alt={attachment.fileName}
            className="attachment-image"
          />
          <div className="attachment-image-overlay">
            <Eye size={20} />
          </div>
        </div>
      );
    } else {
      return (
        <div className="attachment-file-placeholder" onClick={() => handlePreviewFile(attachment)}>
          {getFileIcon(attachment.fileType, attachment.fileName)}
          <span className="attachment-file-type">
            {attachment.fileName.split('.').pop()?.toUpperCase() || 'FILE'}
          </span>
        </div>
      );
    }
  };

  return (
    <div className="invoice-attachments-container">
      <div className="invoice-attachments-header">
        <h3>Attachments</h3>
        <p className="attachments-description">
          Upload attachments (PDF, Images, Excel, EML files). Max 10 files, 3MB each.
          Press Ctrl (Windows) or CMD (Mac) to select multiple files.
        </p>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="attachment-errors">
          {errors.map((error, index) => (
            <div key={index} className="attachment-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Upload Section */}
      <div className="attachment-upload-section">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.xls,.xlsx,.xlsm,.csv,.eml"
          onChange={handleFileSelect}
          disabled={disabled || value.length >= MAX_FILES}
          className="attachment-file-input"
          id="invoice-file-input"
        />
        <label 
          htmlFor="invoice-file-input" 
          className={`attachment-upload-button ${disabled || value.length >= MAX_FILES ? 'disabled' : ''}`}
        >
          <Plus size={16} />
          Upload Attachments
          <span className="upload-count">({value.length}/{MAX_FILES})</span>
        </label>
      </div>

      {/* Attachments List */}
      {value.length > 0 && (
        <div className="attachment-list">
          {value.map((attachment) => (
            <div key={attachment.id} className="attachment-item">
              <div className="attachment-thumbnail">
                {renderAttachmentThumbnail(attachment)}
              </div>
              
              <div className="attachment-info">
                <div className="attachment-name" title={attachment.fileName}>
                  {getFileIcon(attachment.fileType, attachment.fileName)}
                  <span>{attachment.fileName}</span>
                </div>
                <div className="attachment-details">
                  <span className="attachment-size">{formatFileSize(attachment.fileSize)}</span>
                  {attachment.uploadStatus === 'uploaded' && (
                    <div className="attachment-status uploaded">
                      <CheckCircle size={14} />
                      <span>Uploaded</span>
                    </div>
                  )}
                  {attachment.uploadStatus === 'uploading' && (
                    <div className="attachment-status uploading">
                      <Loader2 size={14} className="attachment-uploading-spinner" />
                      <span>Uploading...</span>
                    </div>
                  )}
                  {attachment.uploadStatus === 'error' && (
                    <div className="attachment-status error">
                      <AlertCircle size={14} />
                      <span>Upload failed</span>
                    </div>
                  )}
                  {attachment.uploadStatus === 'pending' && (
                    <div className="attachment-status pending">
                      <Upload size={14} />
                      <span>Will upload when saved</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="attachment-actions">
                {(attachment.fileType === 'application/pdf' || 
                  attachment.fileType.startsWith('image/')) && (
                  <button
                    type="button"
                    className="attachment-action-btn preview"
                    onClick={() => handlePreviewFile(attachment)}
                    title="Preview"
                    disabled={attachment.uploadStatus === 'uploading'}
                  >
                    <Eye size={16} />
                  </button>
                )}
                
                <button
                  type="button"
                  className="attachment-action-btn download"
                  onClick={() => handleDownloadFile(attachment)}
                  title="Download"
                  disabled={attachment.uploadStatus === 'uploading'}
                >
                  <Download size={16} />
                </button>
                
                <button
                  type="button"
                  className="attachment-action-btn delete"
                  onClick={() => handleRemoveAttachment(attachment.id)}
                  title="Remove"
                  disabled={disabled || attachment.uploadStatus === 'uploading'}
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF Viewer Modal */}
      <PDFViewerModal
        pdfUrl={selectedPdfUrl}
        documentName={selectedPdfName}
        isOpen={isPdfModalOpen}
        onClose={() => {
          setIsPdfModalOpen(false);
          // Clean up object URL if it was created locally
          if (selectedPdfUrl && selectedPdfUrl.startsWith('blob:')) {
            URL.revokeObjectURL(selectedPdfUrl);
          }
          setSelectedPdfUrl(null);
        }}
      />
    </div>
  );
}

export type { AttachmentFile }; 