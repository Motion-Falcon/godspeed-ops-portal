import { ChangeEvent, useState, useEffect } from 'react';
import { 
  useFormContext, 
  useFieldArray, 
  useWatch, 
  Control, 
  UseFormRegister, 
  UseFormSetValue,
  FieldErrors
} from 'react-hook-form';
import { supabase } from '../../lib/supabaseClient';
import PDFThumbnail from '../../components/PDFThumbnail';
import PDFViewerModal from '../../components/PDFViewerModal';
import { FileText, Eye, Download, FileWarning, AlertCircle } from 'lucide-react';
import '../../styles/components/form.css';
import '../../styles/pages/JobseekerProfile.css';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = ['application/pdf'];

interface DocumentUploadFormProps {
  currentStep: number;
  allFields: string[];
}

// Type for document field errors
interface DocumentFieldError {
  message: string;
  type: string;
}

// Define the type for a single document item
type DocumentItemData = {
  id?: string;
  documentType?: string;
  documentTitle?: string;
  documentNotes?: string;
  documentPath?: string;
  documentFileName?: string;
  documentFile?: File;
};

// *** Define the overall form data structure (ideally imported from shared types) ***
type JobseekerProfileFormData = {
  // Add other fields from ProfileCreate.tsx if needed for context, 
  // but documents is the primary one needed here.
  documents: DocumentItemData[];
  // ... other fields like firstName, lastName etc.
};

// Type for our PDF cache
interface PDFCache {
  [key: string]: string | null;
}

// Sub-component for rendering a single document item
interface DocumentItemProps {
  index: number;
  control: Control<JobseekerProfileFormData>; 
  remove: (index: number) => void;
  register: UseFormRegister<JobseekerProfileFormData>; 
  setValue: UseFormSetValue<JobseekerProfileFormData>; 
  getDocumentFieldError: (index: number, fieldName: string) => string | undefined;
  pdfCache: PDFCache;
  onPreviewPdf: (url: string | null, name: string) => void;
  isLoading: boolean;
  onFileChange: (file: File) => void;
}

// Helper function to decode HTML entities for slashes
const decodePath = (path: string | undefined): string | undefined => {
  return path ? path.replace(/&#x2F;/g, '/') : undefined;
};

function DocumentItem({ 
  index, 
  control, 
  remove, 
  register, 
  setValue, 
  getDocumentFieldError,
  pdfCache,
  onPreviewPdf,
  isLoading,
  onFileChange
}: DocumentItemProps) {
  // Watch for changes within this specific item
  const documentPath = useWatch({ control, name: `documents.${index}.documentPath` });
  const documentFileName = useWatch({ control, name: `documents.${index}.documentFileName` });
  const documentType = useWatch({ control, name: `documents.${index}.documentType` });
  const documentTitle = useWatch({ control, name: `documents.${index}.documentTitle` });
  const documentNotes = useWatch({ control, name: `documents.${index}.documentNotes` });
  // Watch the file object itself to display the name of the selected file
  const documentFile = useWatch({ control, name: `documents.${index}.documentFile` }); 
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null);

  // Update local PDF URL when a new file is selected or from cache when document path changes
  useEffect(() => {
    let objectUrl: string | null = null;
    
    if (documentPath && pdfCache[documentPath]) {
      setLocalPdfUrl(pdfCache[documentPath]);
    } else if (documentFile instanceof File) {
      // Generate a local object URL for the new file
      objectUrl = URL.createObjectURL(documentFile);
      setLocalPdfUrl(objectUrl);
    } else {
      setLocalPdfUrl(null);
    }
    
    // Cleanup function to revoke URL when component unmounts or dependencies change
    return () => {
      if (objectUrl && objectUrl.startsWith('blob:')) {
        console.log(`Cleaning up object URL: ${objectUrl}`);
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [documentPath, documentFile, pdfCache]);

  // Modified handleFileChange to use the new prop
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        alert('Invalid file type. Only PDF files are allowed.');
        e.target.value = ''; 
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        alert('File size exceeds the 2MB limit.');
        e.target.value = '';
        return;
      }

      // Call the parent's file change handler
      onFileChange(file);
    }
  };
  
  // Handle replacing a file
  const handleReplaceFile = () => {
    // First revoke any existing object URL to prevent memory leaks
    if (localPdfUrl && localPdfUrl.startsWith('blob:')) {
      console.log(`Revoking object URL: ${localPdfUrl}`);
      URL.revokeObjectURL(localPdfUrl);
      setLocalPdfUrl(null);
    }
    
    // Important: Set state to null first to avoid React rendering with stale data
    setLocalPdfUrl(null);
    
    // Then clear all form values related to the file
    setValue(`documents.${index}.documentPath`, undefined);
    setValue(`documents.${index}.documentFileName`, undefined);
    setValue(`documents.${index}.documentFile`, undefined);
    
    // Reset the file input element
    const fileInput = document.getElementById(`documentFile-${index}`) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Handler for file preview that uses the modal instead of opening in a new tab
  const handlePreviewFile = async () => {
    if (localPdfUrl) {
      // Use the local URL or cached URL directly
      onPreviewPdf(localPdfUrl, documentFileName || 'Document');
      return;
    }
    
    // If no local URL but we have a path, try to get a signed URL
    if (documentPath) {
      // Decode the path before using it
      const decodedPath = decodePath(documentPath);
      
      console.log(`Preview requested for original path: '${documentPath}'`); 
      console.log(`Preview using decoded path: '${decodedPath}'`); 

      if (!decodedPath) {
        console.error("Preview attempted with no valid documentPath.");
        setPreviewError("Cannot preview: document path is missing or invalid.");
        return;
      }

      setIsPreviewLoading(true);
      setPreviewError(null);
      try {
        // Generate a signed URL (expires in 300 seconds)
        const { data, error } = await supabase.storage
          .from('jobseeker-documents')
          .createSignedUrl(decodedPath, 300);

        if (error) {
          console.error("Supabase createSignedUrl error:", error);
          throw error;
        }

        if (data?.signedUrl) {
          console.log("Signed URL generated:", data.signedUrl);
          onPreviewPdf(data.signedUrl, documentFileName || 'Document');
        } else {
          throw new Error('Could not retrieve signed URL.');
        }
      } catch (err) {
        console.error("Error in handlePreviewFile:", err);
        setPreviewError(err instanceof Error ? err.message : 'Could not generate preview link.');
      } finally {
        setIsPreviewLoading(false);
      }
    }
  };

  // Display filename from either the selected file or saved filename
  const displayFileName = documentFileName || (documentFile instanceof File ? documentFile.name : 'No file selected');

  // Check if this document has any validation errors
  const hasFileError = getDocumentFieldError(index, 'documentFile') !== undefined;
  const hasTypeError = getDocumentFieldError(index, 'documentType') !== undefined;
  const hasAnyError = hasFileError || hasTypeError;

  return (
    <div className={`document-item${hasAnyError ? ' document-item-error' : ''}`}>
      <div className="document-content">
        <FileText size={18} className="document-icon" />
        <div className="document-info">
          <div className="document-header">
            <h3>Document {index + 1}</h3>
            {index > 0 && (
              <button 
                type="button" 
                className="button remove-document" 
                onClick={() => remove(index)}
              >
                Remove
              </button>
            )}
          </div>

          {/* Display preview error if any */}
          {previewError && <p className="error-message preview-error">Preview Error: {previewError}</p>}

          <div className="form-group document-type">
            <label htmlFor={`documentType-${index}`} className="form-label" data-required="*">Type</label>
            <select
              id={`documentType-${index}`}
              className={`form-input${hasTypeError ? ' error-input' : ''}`}
              {...register(`documents.${index}.documentType`)}
            >
              <option value="">Select type</option>
              <option value="resume">Resume</option>
              <option value="drivers_license">Driver's License</option>
              <option value="passport">Passport</option>
              <option value="sin">SIN Document</option>
              <option value="work_permit">Work Permit</option>
              <option value="void_cheque">Void Cheque</option>
              <option value="hst_registration">HST Registration</option>
              <option value="business_registration">Business Registration</option>
              <option value="forklift_license">Forklift License</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group document-title">
            <label htmlFor={`documentTitle-${index}`} className="form-label">Title</label>
            <input
              id={`documentTitle-${index}`}
              type="text"
              className="form-input"
              placeholder="Document title (optional)"
              {...register(`documents.${index}.documentTitle`)}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`documentNotes-${index}`} className="form-label">Notes</label>
            <textarea
              id={`documentNotes-${index}`}
              className="form-input"
              placeholder="Add notes about this document (optional)"
              rows={2}
              {...register(`documents.${index}.documentNotes`)}
            />
          </div>

          <div className="document-file-section">
            {/* We'll always have a hidden file input */}
            <input
              type="file"
              id={`documentFile-${index}`}
              onChange={handleFileChange} 
              className="form-input-file-hidden"
              accept=".pdf"
              style={{ display: 'none' }}
            />

            {localPdfUrl ? (
              <div className="document-uploaded-info">
                <p className="document-name" title={displayFileName}>{displayFileName}</p>
                {documentType && <p className="document-type">Type: {documentType}</p>}
                {documentTitle && <p className="document-title">Title: {documentTitle}</p>}
                {documentNotes && <p className="document-notes">Notes: {documentNotes}</p>}
              </div>
            ) : (
              <div className="document-upload-placeholder">
                <label 
                  htmlFor={`documentFile-${index}`} 
                  className={`button secondary file-upload-button${hasFileError ? ' error-button' : ''}`}
                >
                  Choose PDF File {hasFileError && '(Required)*'}
                </label>
                {hasFileError && (
                  <p className="error-message file-missing-error">
                    {getDocumentFieldError(index, 'documentFile') || 'A document file is required'}
                  </p>
                )}
              </div>
            )}

            <div className="document-actions">
              {localPdfUrl && (
                <>
                  <button 
                    onClick={handlePreviewFile} 
                    className="button primary"
                    disabled={isLoading || isPreviewLoading}
                  >
                    <Eye size={16} /> Preview
                  </button>
                  <button 
                    onClick={handleReplaceFile} 
                    className="button secondary"
                    disabled={isLoading}
                  >
                    <Download size={16} /> Replace File
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="document-preview">
        {isPreviewLoading ? (
          <div className="loading-pdfs">
            <div className="pdf-loading-spinner"></div>
            <p>Loading preview...</p>
          </div>
        ) : localPdfUrl ? (
          <PDFThumbnail 
            pdfUrl={localPdfUrl}
            onClick={handlePreviewFile}
          />
        ) : (
          <div className={`document-preview-placeholder${hasFileError ? ' document-preview-error' : ''}`} onClick={() => {
            // Trigger the file input when clicking the placeholder if no file is selected
            const fileInput = document.getElementById(`documentFile-${index}`) as HTMLInputElement;
            if (fileInput) fileInput.click();
          }}>
            <FileWarning size={40} className="document-preview-placeholder-icon" />
            <span>{hasFileError ? 'Document required' : 'No file selected'}</span>
            <span className="upload-note">Click to upload a PDF</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Modified shouldShowError to make errors visible
const shouldShowError = (fieldName: string, errors: FieldErrors<JobseekerProfileFormData>, allFields: string[]) => {
  return allFields.includes(fieldName) && fieldName in errors;
};

// Main DocumentUploadForm Component
export function DocumentUploadForm({ allFields }: DocumentUploadFormProps) {
  const { register, setValue, control, formState, trigger, getValues } = useFormContext<JobseekerProfileFormData>();
  const { errors: allErrors, isSubmitted, submitCount } = formState;
  const [pdfCache, setPdfCache] = useState<PDFCache>({});
  const [loadingPdfs, setLoadingPdfs] = useState<boolean>(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfName, setSelectedPdfName] = useState<string>('Document');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [forceShowErrors, setForceShowErrors] = useState(false);
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: "documents",
  });

  // Force validation check after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      // Check if we already have documents with no file
      const documents = getValues().documents || [];
      if (documents.length > 0) {
        // Check if any document is missing a file
        const hasMissingFile = documents.some(doc => 
          !doc.documentFile && !doc.documentPath
        );
        
        // If form was previously submitted or we have missing files
        if (isSubmitted || submitCount > 0 || hasMissingFile) {
          console.log("Forcing validation to run and show errors");
          trigger('documents');
          setForceShowErrors(true);
        }
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [trigger, isSubmitted, submitCount, getValues]);
  
  // Track when a document is added or removed
  useEffect(() => {
    if (fields.length > 0) {
      // Re-run validation
      trigger('documents');
    }
  }, [fields.length, trigger]);

  // Effect to load cached URLs for existing documents
  useEffect(() => {
    const documents = fields as DocumentItemData[];
    
    if (documents && documents.length > 0) {
      const loadPdfs = async () => {
        setLoadingPdfs(true);
        const newCache: PDFCache = {};
        
        try {
          // Process all documents with paths in parallel
          await Promise.all(
            documents.map(async (doc) => {
              if (doc.documentPath) {
                try {
                  const signedUrl = await getSignedUrl(doc.documentPath);
                  if (signedUrl) {
                    newCache[doc.documentPath] = signedUrl;
                  }
                } catch (err) {
                  console.error(`Error getting signed URL for ${doc.documentPath}:`, err);
                }
              }
            })
          );
          
          setPdfCache(newCache);
        } catch (err) {
          console.error('Error loading PDFs:', err);
        } finally {
          setLoadingPdfs(false);
        }
      };
      
      loadPdfs();
    }
  }, [fields]);

  // Function to get signed URL for a document
  const getSignedUrl = async (documentPath: string): Promise<string | null> => {
    try {
      // Decode the path before using it
      const decodedPath = decodePath(documentPath);
      
      if (!decodedPath) {
        console.error("Cannot get signed URL: document path is missing or invalid.");
        return null;
      }

      const { data, error } = await supabase.storage
        .from('jobseeker-documents')
        .createSignedUrl(decodedPath, 300); // 5 minutes expiry

      if (error) {
        console.error("Error creating signed URL:", error);
        return null;
      }

      return data?.signedUrl || null;
    } catch (err) {
      console.error("Error in getSignedUrl:", err);
      return null;
    }
  };

  const handlePreviewPdf = (url: string | null, name: string) => {
    if (url) {
      setSelectedPdfUrl(url);
      setSelectedPdfName(name);
      setIsPdfModalOpen(true);
    }
  };

  // Get if an error should be displayed
  const getDocumentFieldError = (index: number, fieldName: string): string | undefined => {
    if (!allErrors.documents) return undefined;
    const documentsErrors = allErrors.documents as Record<string, Record<string, DocumentFieldError>>;
    // Check if the error exists at the specific index and field
    if (documentsErrors[index] && documentsErrors[index][fieldName]) {
       return String(documentsErrors[index][fieldName].message);
    }
    return undefined;
  };
  
  const handleAddDocument = () => {
    setUserInteracted(true);
    append({
      documentType: '',
      documentTitle: '',
      documentNotes: '',
      id: crypto.randomUUID()
    } as DocumentItemData);
  };

  const handleFileChange = (index: number, file: File) => {
    setUserInteracted(true);
    setValue(`documents.${index}.documentFile`, file);
    setValue(`documents.${index}.documentPath`, undefined); 
    setValue(`documents.${index}.documentFileName`, file.name);
    
    // Trigger validation after file change
    trigger('documents');
  };

  // Function to handle document item removal
  const handleRemoveDocument = (index: number) => {
    setUserInteracted(true);
    remove(index);
  };

  // Check if we have document-level errors 
  const hasDocumentsError = shouldShowError('documents', allErrors, allFields);

  // Should we show document errors?
  const shouldDisplayErrors = isSubmitted || submitCount > 0 || userInteracted || forceShowErrors;

  return (
    <div className="form-step-container">
      <h2>Document Upload</h2>
      <p className="form-description">
        Upload required documents (PDF format, max 2MB). At least one document is required.
      </p>

      {shouldDisplayErrors && hasDocumentsError && (
        <div className="documents-error-banner">
          <AlertCircle size={20} />
          <p className="error-message">
            {typeof allErrors.documents?.message === 'string' 
              ? allErrors.documents.message 
              : 'At least one document with a valid file and type is required'}
          </p>
        </div>
      )}

      {loadingPdfs && (
        <div className="loading-pdfs">
          <div className="pdf-loading-spinner"></div>
          <p>Loading document previews...</p>
        </div>
      )}

      <div className="document-list">
        {/* Render the sub-component for each document */}
        {fields.map((field, index) => (
          <DocumentItem 
            key={field.id} 
            index={index}
            control={control}
            remove={handleRemoveDocument}
            register={register}
            setValue={setValue}
            getDocumentFieldError={getDocumentFieldError}
            pdfCache={pdfCache}
            onPreviewPdf={handlePreviewPdf}
            isLoading={loadingPdfs}
            onFileChange={(file) => handleFileChange(index, file)}
          />
        ))}
      </div>

      <div className="add-document-container">
        <button 
          type="button" 
          className="button primary add-document" 
          onClick={handleAddDocument}
        >
          Add Another Document
        </button>
      </div>

      {/* PDF Viewer Modal */}
      <PDFViewerModal
        pdfUrl={selectedPdfUrl}
        documentName={selectedPdfName}
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
      />

      {/* Additional styles for document upload form */}
      <style>
        {`
          .document-upload-placeholder {
            margin-bottom: 15px;
          }
          
          .document-uploaded-info {
            margin-bottom: 15px;
          }
          
          .file-missing-error {
            margin-top: 8px;
            font-size: 0.9rem;
          }
          
          .document-file-section {
            border-top: 1px dashed var(--color-border-light, #e0e0e0);
            padding-top: 15px;
            margin-top: 10px;
          }
          
          .upload-note {
            display: block;
            font-size: 0.75rem;
            margin-top: 8px;
            opacity: 0.7;
          }
          
          .add-document-container {
            margin-top: 30px;
            text-align: center;
          }
          
          .add-document {
            padding: 10px 20px;
            font-size: 1rem;
          }
          
          .form-input-file-hidden {
            display: none;
          }
          
          .file-upload-button {
            display: inline-block;
            padding: 8px 15px;
          }
          
          .document-actions {
            display: flex;
            gap: 10px;
            margin-top: 15px;
          }
          
          .document-actions button {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            padding: 8px 12px;
            font-size: 0.875rem;
          }

          .documents-error-banner {
            background-color: rgba(220, 53, 69, 0.1);
            border: 1px solid rgba(220, 53, 69, 0.3);
            border-left: 4px solid #dc3545;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          
          .documents-error-banner svg {
            color: #dc3545;
          }
          
          .documents-error-banner .error-message {
            margin: 0;
            color: #dc3545;
            font-weight: 500;
          }
          
          .document-validation-error {
            background-color: rgba(220, 53, 69, 0.1);
            border-left: 3px solid #dc3545;
            padding: 10px 15px;
            margin-bottom: 15px;
            border-radius: 4px;
            display: flex;
            align-items: flex-start;
            gap: 12px;
          }
          
          .document-validation-error svg {
            color: #dc3545;
            flex-shrink: 0;
            margin-top: 3px;
          }
          
          .document-validation-error .error-message {
            margin: 0 0 5px 0;
            color: #dc3545;
            font-weight: 500;
          }
          
          .document-item-error {
            border-color: var(--danger, #dc3545);
            box-shadow: 0 0 0 1px rgba(var(--danger-rgb, 220, 53, 69), 0.25);
          }
          
          .error-input {
            border-color: var(--danger, #dc3545) !important;
          }
          
          .error-button {
            border-color: var(--danger, #dc3545) !important;
          }
          
          .document-preview-error {
            border: 1px dashed var(--danger, #dc3545);
            background-color: rgba(var(--danger-rgb, 220, 53, 69), 0.05);
          }
          
          @media (max-width: 768px) {
            .document-actions {
              flex-direction: column;
            }
          }
        `}
      </style>
    </div>
  );
} 