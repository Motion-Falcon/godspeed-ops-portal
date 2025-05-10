import { ChangeEvent, useState, useEffect, useRef, useCallback } from 'react';
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
import { FileText, Eye, Download, FileWarning, AlertCircle, CheckCircle, Upload } from 'lucide-react';
import '../../styles/components/form.css';
import '../../styles/pages/JobseekerProfile.css';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = ['application/pdf'];

interface DocumentUploadFormProps {
  currentStep?: number;
  allFields?: string[];
  disableSubmit?: boolean;
  isEditMode?: boolean;
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
  isEditMode?: boolean;
  disableSubmit?: boolean;
}

// Helper function to decode HTML entities for slashes and handle URL encoding issues
const decodePath = (path: string | undefined): string | undefined => {
  if (!path) return undefined;
  
  // First decode HTML entities 
  let decodedPath = path.replace(/&#x2F;/g, '/');
  
  // Then handle any URL encoding issues - convert double encoded slashes
  decodedPath = decodedPath.replace(/%2F/g, '/');
  
  // Remove any potential URL parameters or fragments that might be causing issues
  if (decodedPath.includes('?')) {
    decodedPath = decodedPath.split('?')[0];
  }
  
  console.log(`Original path: ${path}`);
  console.log(`Decoded path: ${decodedPath}`);
  
  return decodedPath;
};

// Add this function to render file status indicators
const renderFileStatus = (doc: DocumentItemData) => {
  if (doc.documentPath && doc.documentFileName) {
    return (
      <div className="file-status file-status-success">
        <CheckCircle size={16} />
        <span>Uploaded: {doc.documentFileName}</span>
      </div>
    );
  } else if (doc.documentFile instanceof File) {
    return (
      <div className="file-status file-status-pending">
        <Upload size={16} />
        <span>File selected, will be uploaded when you save</span>
      </div>
    );
  }
  return null;
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
  onFileChange,
  isEditMode = false,
  disableSubmit = false
}: DocumentItemProps) {
  // Watch for changes within this specific item
  const documentType = useWatch({ control, name: `documents.${index}.documentType` });
  const documentTitle = useWatch({ control, name: `documents.${index}.documentTitle` });
  const documentFile = useWatch({ control, name: `documents.${index}.documentFile` });
  const documentPath = useWatch({ control, name: `documents.${index}.documentPath` });
  const documentFileName = useWatch({ control, name: `documents.${index}.documentFileName` });
  const documentNotes = useWatch({ control, name: `documents.${index}.documentNotes` });
  
  // Local states for this document card
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  
  // Create an object that represents the current document data
  const currentDoc = {
    documentPath,
    documentFileName,
    documentType,
    documentTitle,
    documentFile,
    documentNotes,
    id: useWatch({ control, name: `documents.${index}.id` })
  };
  
  // Check if we have a field error for the file
  const hasFileError = !!getDocumentFieldError(index, 'documentFile');

  // Add conditional text/behavior based on edit mode
  const documentLabel = isEditMode ? 
    `Document ${index + 1} (Edit Mode)` : 
    `Document ${index + 1}`;

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

  // Check if this document has any validation errors
  const hasTypeError = getDocumentFieldError(index, 'documentType') !== undefined;
  const hasAnyError = hasFileError || hasTypeError;

  return (
    <div className={`document-item${hasAnyError ? ' document-item-error' : ''}`}>
      <div className="document-content">
        <FileText size={18} className="document-icon" />
        <div className="document-info">
          <div className="document-header">
            <h3>{documentLabel}</h3>
            {index > 0 && !isEditMode && (
              <button 
                type="button" 
                className="button remove-document" 
                onClick={() => remove(index)}
              >
                Remove
              </button>
            )}
            {index > 0 && isEditMode && (
              <button 
                type="button" 
                className="button secondary remove-document" 
                onClick={() => remove(index)}
              >
                Remove in Edit Mode
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
            <div className="file-upload-container">
              <input
                id={`documentFile-${index}`}
                type="file"
                accept=".pdf"
                className="form-input file-input"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileChange(e);
                  }
                }}
                disabled={isLoading || disableSubmit}
              />
              
              {renderFileStatus(currentDoc)}
              
              {getDocumentFieldError(index, 'documentFile') && (
                <p className="error-message">{getDocumentFieldError(index, 'documentFile')}</p>
              )}
            </div>

            <div className="document-actions">
              {localPdfUrl && (
                <>
                  <button 
                    type="button"
                    onClick={handlePreviewFile} 
                    className="button primary"
                    disabled={isLoading || isPreviewLoading || disableSubmit}
                  >
                    <Eye size={16} /> Preview
                  </button>
                  <button 
                    type="button"
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

      <div className="document-preview-container">
        {isPreviewLoading ? (
          <div className="document-preview-loading">
            <span className="loading-spinner"></span>
            <span>Loading preview...</span>
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
        
        {renderFileStatus(currentDoc)}
      </div>
    </div>
  );
}

// Function to determine if we should show errors for a specific field
const shouldShowError = (fieldName: string, errors: FieldErrors<JobseekerProfileFormData>, allFields: string[]) => {
  return allFields.includes(fieldName) && errors.documents?.[fieldName as keyof typeof errors.documents];
};

// Main DocumentUploadForm Component
export function DocumentUploadForm({ allFields = [], disableSubmit = false, isEditMode = false }: DocumentUploadFormProps) {
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

  // Add a specific effect to handle initial load in edit mode
  useEffect(() => {
    if (isEditMode) {
      console.log("In edit mode - disabling initial validation");
      
      // Forcefully disable validation triggering in edit mode
      setForceShowErrors(false);
      
      // Prevent any automatic validation for the first 2 seconds in edit mode
      const timer = setTimeout(() => {
        console.log("Edit mode initial protection period ended");
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isEditMode]);

  // Track if we're in the initial loading phase
  const initialLoading = useRef(true);

  // Reset initialLoading after timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      initialLoading.current = false;
      console.log("Initial loading phase ended");
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  // Override trigger function to prevent accidental validation in edit mode
  const safeTrigger = useCallback((...args: Parameters<typeof trigger>) => {
    if (isEditMode && initialLoading.current) {
      console.log("BLOCKED: Preventing validation trigger during initial load in edit mode");
      return Promise.resolve(false);
    }
    return trigger(...args);
  }, [trigger, isEditMode, initialLoading]);

  // Force validation check after mount
  useEffect(() => {
    // Skip auto-validation in edit mode to prevent accidental form submission
    if (isEditMode || initialLoading.current) {
      console.log("Skipping automatic validation in edit mode");
      return;
    }

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
          safeTrigger('documents');
          setForceShowErrors(true);
        }
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [safeTrigger, isSubmitted, submitCount, getValues, isEditMode]);
  
  // Track when a document is added or removed
  useEffect(() => {
    if (fields.length > 0) {
      // Re-run validation
      safeTrigger('documents');
    }
  }, [fields.length, safeTrigger]);

  // Effect to load cached URLs for existing documents
  useEffect(() => {
    const documents = fields as DocumentItemData[];
    
    if (documents && documents.length > 0) {
      // Add a flag to prevent automatic form submission during document loading
      let isMounted = true;
      
      const loadPdfs = async () => {
        if (!isMounted) return;
        
        setLoadingPdfs(true);
        const newCache: PDFCache = {};
        
        try {
          // Process all documents with paths in parallel
          await Promise.all(
            documents.map(async (doc) => {
              if (doc.documentPath && isMounted) {
                try {
                  const signedUrl = await getSignedUrl(doc.documentPath);
                  if (signedUrl && isMounted) {
                    newCache[doc.documentPath] = signedUrl;
                  }
                } catch (err) {
                  console.error(`Error getting signed URL for ${doc.documentPath}:`, err);
                }
              }
            })
          );
          
          if (isMounted) {
            setPdfCache(newCache);
          }
        } catch (err) {
          console.error('Error loading PDFs:', err);
        } finally {
          if (isMounted) {
            setLoadingPdfs(false);
            
            // Prevent triggering validation or form submission in edit mode
            if (isEditMode) {
              console.log("PDF loading complete in edit mode - not triggering validation");
            } else {
              // Only trigger validation in create mode if needed
              if ((isSubmitted || submitCount > 0) && !isEditMode) {
                console.log("PDF loading complete - running validation in create mode");
                safeTrigger('documents');
              }
            }
          }
        }
      };
      
      // Add a longer delay in edit mode to ensure the component is fully mounted
      // and prevent accidental validation triggering
      const loadTimeout = setTimeout(() => {
        loadPdfs();
      }, isEditMode ? 700 : 200);
      
      // Cleanup function to prevent updates after unmount
      return () => {
        isMounted = false;
        clearTimeout(loadTimeout);
      };
    }
  }, [fields, isEditMode, isSubmitted, submitCount, safeTrigger]);

  // Function to get signed URL for a document
  const getSignedUrl = async (documentPath: string): Promise<string | null> => {
    try {
      // Decode the path before using it
      const decodedPath = decodePath(documentPath);
      
      if (!decodedPath) {
        console.error("Cannot get signed URL: document path is missing or invalid.");
        return null;
      }

      console.log(`Getting signed URL for: ${decodedPath}`);

      const { data, error } = await supabase.storage
        .from('jobseeker-documents')
        .createSignedUrl(decodedPath, 300); // 5 minutes expiry

      if (error) {
        console.error("Error creating signed URL:", error);
        return null;
      }

      console.log(`Signed URL created successfully: ${data?.signedUrl?.substring(0, 100)}...`);
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
    safeTrigger('documents');
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

  // Add an escape hatch to prevent accidental form submission in edit mode
  useEffect(() => {
    if (!isEditMode) return;

    // Function to intercept form submissions
    const interceptFormSubmission = (e: Event) => {
      if (initialLoading.current) {
        console.log('BLOCKED: Intercepted form submission during initial loading');
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Find the closest form element
    const formElement = document.querySelector('form');
    if (formElement) {
      formElement.addEventListener('submit', interceptFormSubmission, true);
      
      return () => {
        formElement.removeEventListener('submit', interceptFormSubmission, true);
      };
    }
  }, [isEditMode]);

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
            isEditMode={isEditMode}
            disableSubmit={disableSubmit}
          />
        ))}
      </div>

      <div className="add-document-container">
        <button 
          type="button" 
          className="button primary add-document" 
          onClick={handleAddDocument}
          disabled={disableSubmit}
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