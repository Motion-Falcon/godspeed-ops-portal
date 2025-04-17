import { ChangeEvent, useState } from 'react';
import { 
  useFormContext, 
  useFieldArray, 
  useWatch, 
  Control, 
  UseFormRegister, 
  UseFormSetValue 
} from 'react-hook-form';
import { supabase } from '../../lib/supabaseClient';
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

// Sub-component for rendering a single document item
interface DocumentItemProps {
  index: number;
  // Use specific types from react-hook-form
  control: Control<JobseekerProfileFormData>; 
  remove: (index: number) => void;
  register: UseFormRegister<JobseekerProfileFormData>; 
  setValue: UseFormSetValue<JobseekerProfileFormData>; 
  getDocumentFieldError: (index: number, fieldName: string) => string | undefined;
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
  getDocumentFieldError 
}: DocumentItemProps) {
  // Watch for changes within this specific item
  const documentPath = useWatch({ control, name: `documents.${index}.documentPath` });
  const documentFileName = useWatch({ control, name: `documents.${index}.documentFileName` });
  // Watch the file object itself to display the name of the selected file
  const documentFile = useWatch({ control, name: `documents.${index}.documentFile` }); 
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Handle file selection for this specific document
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

      // Set the file in the form data
      setValue(`documents.${index}.documentFile`, file);
       // Clear path if a new file is selected (forces re-upload on save)
      setValue(`documents.${index}.documentPath`, undefined); 
      setValue(`documents.${index}.documentFileName`, undefined);
    }
  };
  
  // Handle replacing a file
  const handleReplaceFile = () => {
    // Clear the path, name, and file object for this index
    setValue(`documents.${index}.documentPath`, undefined);
    setValue(`documents.${index}.documentFileName`, undefined);
    setValue(`documents.${index}.documentFile`, undefined);
    // Optionally reset the file input visually if needed
    const fileInput = document.getElementById(`documentFile-${index}`) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Handler for file preview
  const handlePreviewFile = async () => {
    // Decode the path before using it
    const decodedPath = decodePath(documentPath);
    
    console.log(`Preview requested for original path: '${documentPath}'`); 
    console.log(`Preview using decoded path: '${decodedPath}'`); 

    if (!decodedPath) { // Check decodedPath
       console.error("Preview attempted with no valid documentPath.");
       setPreviewError("Cannot preview: document path is missing or invalid.");
       return;
    }

    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      // Generate a signed URL (expires in 60 seconds)
      const { data, error } = await supabase.storage
        .from('jobseeker-documents')
        .createSignedUrl(decodedPath, 60); // Use decodedPath

      if (error) {
        console.error("Supabase createSignedUrl error:", error);
        throw error;
      }

      if (data?.signedUrl) {
        console.log("Signed URL generated:", data.signedUrl);
        window.open(data.signedUrl, '_blank'); // Open in new tab
      } else {
        throw new Error('Could not retrieve signed URL.');
      }
    } catch (err) {
      console.error("Error in handlePreviewFile:", err);
      setPreviewError(err instanceof Error ? err.message : 'Could not generate preview link.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  return (
    <div className="document-item"> 
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

      <div className="document-form-row">
        {/* Document Type */}
        <div className="form-group document-type">
          <label htmlFor={`documentType-${index}`} className="form-label" data-required="*">Type</label>
          <select
            id={`documentType-${index}`}
            className="form-input"
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
          {getDocumentFieldError(index, 'documentType') && (
            <p className="error-message">
              {getDocumentFieldError(index, 'documentType')}
            </p>
          )}
        </div>

        {/* Document Title */}
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

        {/* Document File Input/Status - Updated */} 
        <div className="form-group document-file">
          {/* Label is now visually the button OR just a label */} 
          <label 
             htmlFor={`documentFile-${index}`} 
             className={documentPath ? "form-label" : "button secondary file-upload-button"} 
             data-required="*"
           >
             {documentPath ? 'File' : 'Choose File'} 
           </label>
          {documentPath ? (
            <div className="document-uploaded-status">
              <span className="uploaded-filename">{documentFileName || 'File Uploaded'}</span>
              <button 
                type="button"
                className="button preview-button"
                onClick={handlePreviewFile}
                disabled={isPreviewLoading}
              >
                {isPreviewLoading ? 'Loading...' : 'Preview'}
              </button>
              <button 
                type="button"
                className="button replace-button"
                onClick={handleReplaceFile} 
                disabled={isPreviewLoading}
              >
                Replace File
              </button>
            </div>
          ) : (
            <div className="file-input-container">
              {/* Hidden actual file input */}
              <input
                type="file"
                id={`documentFile-${index}`}
                onChange={handleFileChange} 
                className="form-input-file-hidden" // New class to hide it
                accept=".pdf"
                style={{ display: 'none' }} // Hide the default input
              />
              {/* Display selected file name (if not uploaded yet) */}
              {documentFile && (
                  <span className="selected-filename">{(documentFile as File).name}</span>
              )}
               {/* Error message display */}
               {getDocumentFieldError(index, 'documentFile') && (
                 <p className="error-message file-error-message">
                   {getDocumentFieldError(index, 'documentFile')}
                 </p>
               )}
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
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
    </div>
  );
}

// Main DocumentUploadForm Component
export function DocumentUploadForm({ allFields }: DocumentUploadFormProps) {
  const { register, setValue, control, formState } = useFormContext<JobseekerProfileFormData>(); // Specify the type here
  const { errors: allErrors } = formState;
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: "documents",
  });

  const shouldShowError = (fieldName: string) => {
    return allFields.includes(fieldName) && allErrors[fieldName as keyof typeof allErrors];
  };

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
    append({
      documentType: '',
      documentTitle: '',
      documentNotes: '',
      id: crypto.randomUUID()
    } as DocumentItemData); // Cast to the defined type
  };

  return (
    <div className="form-step-container">
      <h2>Document Upload</h2>
      <p className="form-description">
        Upload required documents (PDF format, max 2MB). At least one document is required.
      </p>

      {shouldShowError('documents') && (
        <p className="error-message">
          {typeof allErrors.documents?.message === 'string' ? allErrors.documents.message : 'Documents are required'}
        </p>
      )}

      {/* Render the sub-component for each document */}
      {fields.map((field, index) => (
        <DocumentItem 
          key={field.id} 
          index={index} 
          control={control}
          remove={remove} 
          register={register}
          setValue={setValue}
          getDocumentFieldError={getDocumentFieldError}
        />
      ))}

      <div className="add-document-container">
        <button 
          type="button" 
          className="button secondary add-document" 
          onClick={handleAddDocument}
        >
          Add Another Document
        </button>
      </div>

      {/* Styles remain the same */}
      <div className="document-styles">
        <style>
          {`
            .document-item {
              border: 1px solid #e0e0e0;
              padding: 15px;
              margin-bottom: 20px;
              border-radius: 5px;
              background-color: #f9f9f9;
            }
            
            .document-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 15px;
            }
            
            .document-header h3 {
              margin: 0;
              font-size: 1.1rem;
            }
            
            .document-form-row {
              display: flex;
              flex-wrap: wrap;
              gap: 15px;
              margin-bottom: 15px;
            }
            
            .document-type {
              flex: 1;
              min-width: 180px;
            }
            
            .document-title {
              flex: 1;
              min-width: 180px;
            }
            
            .document-file {
              flex: 1;
              min-width: 180px;
            }
            
            .document-uploaded-status {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 8px 0; /* Adjust padding as needed */
              flex-wrap: wrap; /* Allow buttons to wrap on small screens */
            }
            .uploaded-filename {
              font-style: italic;
              color: #555;
              flex-grow: 1; /* Allow filename to take space */
              margin-right: 10px;
            }
            .preview-button, .replace-button {
              padding: 3px 8px;
              font-size: 0.8rem;
              color: white;
              border: none;
              cursor: pointer;
              white-space: nowrap; /* Prevent button text wrapping */
            }
            .preview-button {
               background-color: #337ab7; /* Info color */
            }
            .preview-button:disabled {
               background-color: #a7c7e7;
               cursor: not-allowed;
            }
            .replace-button {
              background-color: #f0ad4e; /* Warning color */
            }
             .replace-button:disabled {
               background-color: #f8d5a1;
               cursor: not-allowed;
            }
            .preview-error {
              color: #dc3545; /* Error color */
              margin-top: 5px;
              font-size: 0.9em;
            }
            .add-document-container {
              margin-top: 20px;
              text-align: center;
            }
            
            .remove-document {
              background-color: #ff6b6b;
              color: white;
              border: none;
              padding: 5px 10px;
              font-size: 0.8rem;
            }
            
            .add-document {
              background-color: #4caf50;
              color: white;
            }

            .file-input-container {
                display: flex;
                align-items: center;
                gap: 10px;
                position: relative; /* For error message positioning */
            }

            /* Style the label like a button */
            .file-upload-button {
                /* Inherit button styles or add specific ones */
                padding: 8px 15px; /* Adjust as needed */
                cursor: pointer;
                display: inline-block; /* Behave like a button */
                 /* Add styles from your .button.secondary */
                 background-color: #6c757d; 
                 color: white;
                 border: 1px solid #6c757d;
                 border-radius: 4px;
                 text-align: center;
                 vertical-align: middle;
                 user-select: none;
                 font-size: 1rem; /* Match button font size */
                 line-height: 1.5;
                 transition: color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out;
            }
             .file-upload-button:hover {
                background-color: #5a6268;
                border-color: #545b62;
            }

            .selected-filename {
                font-style: italic;
                color: #555;
                margin-left: 10px;
                font-size: 0.9em;
            }
            
             .file-error-message {
                 /* Position error message if needed, or let it flow */
                 margin-left: 10px; /* Align with filename */
                 font-size: 0.9em;
                 width: 100%; /* Take full width if needed */
                 padding-top: 5px; 
            }
          `}
        </style>
      </div>
    </div>
  );
} 