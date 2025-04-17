import { ChangeEvent } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import '../../styles/components/form.css';
import '../../styles/pages/JobseekerProfile.css';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = ['application/pdf'];

interface DocumentUploadFormProps {
  currentStep: number;
  allFields: string[];
}

export function DocumentUploadForm({ allFields }: DocumentUploadFormProps) {
  const { register, setValue, control, formState } = useFormContext();
  const { errors: allErrors } = formState;
  
  // Using useFieldArray to handle the array of documents
  const { fields, append, remove } = useFieldArray({
    control,
    name: "documents",
  });

  // Function to check if we should show an error for a specific field
  const shouldShowError = (fieldName: string) => {
    return allFields.includes(fieldName) && allErrors[fieldName as keyof typeof allErrors];
  };

  // Format file size helper
  const formatFileSize = (size: number): string => {
    if (size < 1024) return `${size} bytes`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle file selection for a specific document
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
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
    }
  };

  // Add a new document
  const handleAddDocument = () => {
    append({
      documentType: '',
      documentTitle: '',
      documentNotes: '',
      id: crypto.randomUUID()
    });
  };

  return (
    <div className="form-step-container">
      <h2>Document Upload</h2>
      <p className="form-description">
        Upload required documents (PDF format, max 2MB). At least one document is required.
      </p>

      {/* Show the array-level error if it exists */}
      {shouldShowError('documents') && (
        <p className="error-message">
          {typeof allErrors.documents?.message === 'string' ? allErrors.documents.message : 'Documents are required'}
        </p>
      )}

      {/* Render each document in the array */}
      {fields.map((field, index) => (
        <div key={field.id} className="document-item">
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

          <div className="document-form-row">
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
              {allErrors.documents && allErrors.documents[index as any]?.documentType && (
                <p className="error-message">{String(allErrors.documents[index as any]?.documentType?.message)}</p>
              )}
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

            <div className="form-group document-file">
              <label htmlFor={`documentFile-${index}`} className="form-label" data-required="*">File</label>
              <input
                type="file"
                id={`documentFile-${index}`}
                onChange={(e) => handleFileChange(e, index)}
                className="form-input-file"
                accept=".pdf"
              />
              {allErrors.documents && allErrors.documents[index as any]?.documentFile && (
                <p className="error-message">{String(allErrors.documents[index as any]?.documentFile?.message)}</p>
              )}
            </div>
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
        </div>
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
          `}
        </style>
      </div>
    </div>
  );
} 