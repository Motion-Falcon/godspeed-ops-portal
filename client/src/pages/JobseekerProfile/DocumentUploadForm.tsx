import { ChangeEvent, useState, useEffect, useRef, useCallback } from "react";
import {
  useFormContext,
  useFieldArray,
  useWatch,
  Control,
  UseFormRegister,
  UseFormSetValue,
  FieldErrors,
} from "react-hook-form";
import { supabase } from "../../lib/supabaseClient";
import PDFThumbnail from "../../components/PDFThumbnail";
import PDFViewerModal from "../../components/PDFViewerModal";
import {
  FileText,
  Eye,
  FileWarning,
  AlertCircle,
  CheckCircle,
  Upload,
  Trash,
  Plus,
} from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";
import "../../styles/components/form.css";
import "../../styles/pages/JobseekerProfileStyles.css";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

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
  getDocumentFieldError: (
    index: number,
    fieldName: string
  ) => string | undefined;
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
  let decodedPath = path.replace(/&#x2F;/g, "/");

  // Then handle any URL encoding issues - convert double encoded slashes
  decodedPath = decodedPath.replace(/%2F/g, "/");

  // Remove any potential URL parameters or fragments that might be causing issues
  if (decodedPath.includes("?")) {
    decodedPath = decodedPath.split("?")[0];
  }

  return decodedPath;
};

// Helper function to format file size
const formatFileSize = (bytes: number, t: (key: string) => string): string => {
  if (bytes === 0) return `0 ${t("profileCreate.documents.fileSizeBytes")}`;
  const k = 1024;
  const sizes = [
    t("profileCreate.documents.fileSizeBytes"),
    t("profileCreate.documents.fileSizeKB"),
    t("profileCreate.documents.fileSizeMB"),
    t("profileCreate.documents.fileSizeGB"),
  ];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Helper function to check if a file is an image
const isImageFile = (file: File | string | undefined): boolean => {
  if (!file) return false;

  if (file instanceof File) {
    const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png"];
    return allowedImageTypes.includes(file.type);
  }

  // Check by filename extension
  if (typeof file === "string") {
    const extension = file.toLowerCase().split(".").pop();
    return ["jpg", "jpeg", "png"].includes(extension || "");
  }

  return false;
};

// Add this function to render file status indicators
const renderFileStatus = (
  doc: DocumentItemData,
  t: (key: string) => string
) => {
  if (doc.documentPath && doc.documentFileName) {
    return (
      <div className="file-status file-status-success">
        <CheckCircle size={16} />
        <div className="file-status-content">
          <span className="file-status-name">
            {t("profileCreate.documents.uploadedStatus").replace(
              "{{fileName}}",
              doc.documentFileName
            )}
          </span>
          {/* Note: For uploaded files, we don't have size info stored, but we could enhance this in the future */}
          <span className="file-status-note">
            {" "}
            • {t("profileCreate.documents.previouslyUploadedNote")}
          </span>
        </div>
      </div>
    );
  } else if (doc.documentFile instanceof File) {
    return (
      <div className="file-status file-status-pending">
        <Upload size={16} />
        <div className="file-status-content">
          <span className="file-status-name">{doc.documentFile.name}</span>
          <span className="file-status-details">
            {t("profileCreate.documents.fileSize")}:{" "}
            {formatFileSize(doc.documentFile.size, t)} •{" "}
            {t("profileCreate.documents.willBeUploadedNote")}
          </span>
        </div>
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
  disableSubmit = false,
}: DocumentItemProps) {
  const { t } = useLanguage();

  // Watch for changes within this specific item
  const documentType = useWatch({
    control,
    name: `documents.${index}.documentType`,
  });
  const documentTitle = useWatch({
    control,
    name: `documents.${index}.documentTitle`,
  });
  const documentFile = useWatch({
    control,
    name: `documents.${index}.documentFile`,
  });
  const documentPath = useWatch({
    control,
    name: `documents.${index}.documentPath`,
  });
  const documentFileName = useWatch({
    control,
    name: `documents.${index}.documentFileName`,
  });
  const documentNotes = useWatch({
    control,
    name: `documents.${index}.documentNotes`,
  });

  // Local states for this document card
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Create an object that represents the current document data
  const currentDoc = {
    documentPath,
    documentFileName,
    documentType,
    documentTitle,
    documentFile,
    documentNotes,
    id: useWatch({ control, name: `documents.${index}.id` }),
  };

  // Check if we have a field error for the file
  const hasFileError = !!getDocumentFieldError(index, "documentFile");

  // Check if this is a mandatory document (first 2 documents)
  const isMandatoryDocument = index < 2;

  // Add conditional text/behavior based on edit mode and mandatory status
  const documentLabel = isMandatoryDocument
    ? `${t("profileCreate.documents.mandatoryDocument")} ${index + 1} - ${t(
        `profileCreate.documents.documentTypes.${
          documentType || (index === 0 ? "sin" : "work_permit")
        }`
      )}`
    : `${t("profileCreate.documents.documentLabel").replace(
        "{{number}}",
        (index + 1).toString()
      )}`;

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
      if (objectUrl && objectUrl.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [documentPath, documentFile, pdfCache]);

  // Helper function to validate file
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return t("profileCreate.documents.invalidFileType");
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return t("profileCreate.documents.fileSizeExceeded").replace(
        "{{size}}",
        formatFileSize(file.size, t)
      );
    }

    return null;
  };

  // Modified handleFileChange to use the new prop
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Validate file and set error state instead of using alert
      const validationError = validateFile(file);
      if (validationError) {
        setFileError(validationError);
        e.target.value = "";
        return;
      }

      // Clear any previous error
      setFileError(null);

      // Call the parent's file change handler
      onFileChange(file);
    }
  };

  // Handle replacing a file
  const handleReplaceFile = () => {
    // First revoke any existing object URL to prevent memory leaks
    if (localPdfUrl && localPdfUrl.startsWith("blob:")) {
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
    const fileInput = document.getElementById(
      `documentFile-${index}`
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  // Handler for file preview that uses the modal instead of opening in a new tab
  const handlePreviewFile = async () => {
    if (localPdfUrl) {
      // Use the local URL or cached URL directly
      onPreviewPdf(localPdfUrl, documentFileName || t("common.user"));
      return;
    }

    // If no local URL but we have a path, try to get a signed URL
    if (documentPath) {
      // Decode the path before using it
      const decodedPath = decodePath(documentPath);

      if (!decodedPath) {
        console.error("Preview attempted with no valid documentPath.");
        setPreviewError(t("profileCreate.documents.cannotPreview"));
        return;
      }

      setIsPreviewLoading(true);
      setPreviewError(null);
      try {
        // Generate a signed URL (expires in 300 seconds)
        const { data, error } = await supabase.storage
          .from("jobseeker-documents")
          .createSignedUrl(decodedPath, 300);

        if (error) {
          console.error("Supabase createSignedUrl error:", error);
          throw error;
        }

        if (data?.signedUrl) {
          onPreviewPdf(data.signedUrl, documentFileName || t("common.user"));
        } else {
          throw new Error(
            t("profileCreate.documents.couldNotRetrieveSignedUrl")
          );
        }
      } catch (err) {
        console.error("Error in handlePreviewFile:", err);
        setPreviewError(
          err instanceof Error
            ? err.message
            : t("profileCreate.documents.couldNotGeneratePreview")
        );
      } finally {
        setIsPreviewLoading(false);
      }
    }
  };

  // Check if this document has any validation errors
  const hasTypeError =
    getDocumentFieldError(index, "documentType") !== undefined;
  const hasAnyError = hasFileError || hasTypeError;

  return (
    <div
      className={`document-item${hasAnyError ? " document-item-error" : ""}`}
    >
      <div className="document-content">
        <FileText size={18} className="document-icon" />
        <div className="document-upload-info">
          <div className="document-header">
            <h3>{documentLabel}</h3>
          </div>

          {/* Display preview error if any */}
          {previewError && (
            <p className="error-message preview-error">
              {t("profileCreate.documents.previewError").replace(
                "{{error}}",
                previewError
              )}
            </p>
          )}

          <div className="form-group document-type">
            <label
              htmlFor={`documentType-${index}`}
              className="form-label"
              data-required="*"
            >
              {t("profileCreate.documents.type")}
              {isMandatoryDocument && (
                <span className="mandatory-indicator">
                  (
                  {t("profileCreate.documents.mandatoryDocumentType").replace(
                    "{{type}}",
                    t(
                      `profileCreate.documents.documentTypes.${
                        documentType || (index === 0 ? "sin" : "work_permit")
                      }`
                    ).toLowerCase()
                  )}
                  )
                </span>
              )}
            </label>
            {isMandatoryDocument ? (
              // Disabled input for mandatory documents
              <div className="mandatory-document-type-container">
                <input
                  type="text"
                  className="form-input mandatory-document-type"
                  value={t(
                    `profileCreate.documents.documentTypes.${
                      documentType || (index === 0 ? "sin" : "work_permit")
                    }`
                  )}
                  disabled
                  readOnly
                />
                <input
                  type="hidden"
                  {...register(`documents.${index}.documentType`)}
                  value={documentType || (index === 0 ? "sin" : "work_permit")}
                />
                <div className="mandatory-reason">
                  {index === 0
                    ? t("profileCreate.documents.sinMandatoryReason")
                    : t("profileCreate.documents.workPermitMandatoryReason")}
                </div>
              </div>
            ) : (
              // Regular select for optional documents
              <select
                id={`documentType-${index}`}
                className={`form-input${hasTypeError ? " error-input" : ""}`}
                {...register(`documents.${index}.documentType`)}
              >
                <option value="">
                  {t("profileCreate.documents.selectType")}
                </option>
                <option value="resume">
                  {t("profileCreate.documents.documentTypes.resume")}
                </option>
                <option value="drivers_license">
                  {t("profileCreate.documents.documentTypes.drivers_license")}
                </option>
                <option value="passport">
                  {t("profileCreate.documents.documentTypes.passport")}
                </option>
                <option value="sin">
                  {t("profileCreate.documents.documentTypes.sin")}
                </option>
                <option value="work_permit">
                  {t("profileCreate.documents.documentTypes.work_permit")}
                </option>
                <option value="void_cheque">
                  {t("profileCreate.documents.documentTypes.void_cheque")}
                </option>
                <option value="hst_registration">
                  {t("profileCreate.documents.documentTypes.hst_registration")}
                </option>
                <option value="business_registration">
                  {t(
                    "profileCreate.documents.documentTypes.business_registration"
                  )}
                </option>
                <option value="forklift_license">
                  {t("profileCreate.documents.documentTypes.forklift_license")}
                </option>
                <option value="other">
                  {t("profileCreate.documents.documentTypes.other")}
                </option>
              </select>
            )}
          </div>

          <div className="form-group document-title">
            <label htmlFor={`documentTitle-${index}`} className="form-label">
              {t("profileCreate.documents.title")}
            </label>
            <input
              id={`documentTitle-${index}`}
              type="text"
              className="form-input"
              placeholder={t("profileCreate.documents.titlePlaceholder")}
              {...register(`documents.${index}.documentTitle`)}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`documentNotes-${index}`} className="form-label">
              {t("profileCreate.documents.notes")}
            </label>
            <textarea
              id={`documentNotes-${index}`}
              className="form-input"
              placeholder={t("profileCreate.documents.notesPlaceholder")}
              rows={2}
              {...register(`documents.${index}.documentNotes`)}
            />
          </div>

          <div className="document-file-section">
            {/* Display file validation error */}
            {fileError && (
              <div className="attachment-error">
                <AlertCircle size={16} />
                <span>{fileError}</span>
              </div>
            )}

            <div className="file-upload-container">
              {/* Hidden file input */}
              <input
                id={`documentFile-${index}`}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="attachment-file-input"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileChange(e);
                  }
                }}
                disabled={isLoading || disableSubmit}
              />

              {/* Styled upload button */}
              <label
                htmlFor={`documentFile-${index}`}
                className={`attachment-upload-button ${
                  isLoading || disableSubmit ? "disabled" : ""
                }`}
              >
                <Plus size={16} />
                {documentFile || documentPath
                  ? t("profileCreate.documents.replaceDocument")
                  : t("profileCreate.documents.uploadDocument")}
              </label>

              {renderFileStatus(currentDoc, t)}

              {getDocumentFieldError(index, "documentFile") && (
                <p className="error-message">
                  {getDocumentFieldError(index, "documentFile")}
                </p>
              )}
            </div>

            <div className="document-actions">
              {localPdfUrl && (
                <>
                  <button
                    type="button"
                    onClick={handlePreviewFile}
                    className="attachment-action-btn preview"
                    disabled={isLoading || isPreviewLoading || disableSubmit}
                    title={t("profileCreate.documents.preview")}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleReplaceFile}
                    className="attachment-action-btn delete"
                    disabled={isLoading}
                    title={t("profileCreate.documents.removeFile")}
                  >
                    <Trash size={16} />
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
            <span>{t("profileCreate.documents.loadingPreview")}</span>
          </div>
        ) : localPdfUrl ? (
          isImageFile(documentFile || documentFileName) ? (
            <div className="image-thumbnail" onClick={handlePreviewFile}>
              <img
                src={localPdfUrl}
                alt={documentTitle || t("common.user")}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  cursor: "pointer",
                  borderRadius: "4px",
                }}
              />
            </div>
          ) : (
            <PDFThumbnail pdfUrl={localPdfUrl} onClick={handlePreviewFile} />
          )
        ) : (
          <div
            className={`document-preview-placeholder${
              hasFileError ? " document-preview-error" : ""
            }`}
            onClick={() => {
              // Trigger the file input when clicking the placeholder if no file is selected
              const fileInput = document.getElementById(
                `documentFile-${index}`
              ) as HTMLInputElement;
              if (fileInput) fileInput.click();
            }}
          >
            <FileWarning
              size={40}
              className="document-preview-placeholder-icon"
            />
            <span>
              {hasFileError
                ? t("profileCreate.documents.documentRequired")
                : t("profileCreate.documents.noFileSelected")}
            </span>
            <span className="upload-note">
              {t("profileCreate.documents.clickToUpload")}
            </span>
          </div>
        )}

        <div className="remove-document-container">
          {index > 1 && (
            <button
              type="button"
              className="button attachment-upload-button"
              onClick={() => remove(index)}
            >
              <Trash size={16} />{" "}
              {t("profileCreate.documents.remove").replace(
                "{{documentLabel}}",
                documentLabel
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Function to determine if we should show errors for a specific field
const shouldShowError = (
  fieldName: string,
  errors: FieldErrors<JobseekerProfileFormData>,
  allFields: string[]
) => {
  return (
    allFields.includes(fieldName) &&
    errors.documents?.[fieldName as keyof typeof errors.documents]
  );
};

// Main DocumentUploadForm Component
export function DocumentUploadForm({
  allFields = [],
  disableSubmit = false,
  isEditMode = false,
}: DocumentUploadFormProps) {
  const { t } = useLanguage();
  const { register, setValue, control, formState, trigger, getValues } =
    useFormContext<JobseekerProfileFormData>();
  const { errors: allErrors, isSubmitted, submitCount } = formState;
  const [pdfCache, setPdfCache] = useState<PDFCache>({});
  const [loadingPdfs, setLoadingPdfs] = useState<boolean>(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfName, setSelectedPdfName] = useState<string>(
    t("common.user")
  );
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [forceShowErrors, setForceShowErrors] = useState(false);
  const [mandatoryDocsInitialized, setMandatoryDocsInitialized] =
    useState(false);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "documents",
  });

  // Initialize mandatory documents if not already present
  useEffect(() => {
    // Case 1: No documents exist - create mandatory documents
    if (!mandatoryDocsInitialized && fields.length === 0) {
      // Add SIN document (mandatory)
      const sinDoc = {
        documentType: "sin",
        documentTitle: "",
        documentNotes: "",
        id: crypto.randomUUID(),
      } as DocumentItemData;

      const workPermitDoc = {
        documentType: "work_permit",
        documentTitle: "",
        documentNotes: "",
        id: crypto.randomUUID(),
      } as DocumentItemData;

      append(sinDoc);
      append(workPermitDoc);

      setMandatoryDocsInitialized(true);
    }
    // Case 2: Documents exist but first two don't have mandatory types (edit mode)
    else if (!mandatoryDocsInitialized && fields.length > 0) {
      const needsFixing =
        fields.length >= 2 &&
        (fields[0].documentType !== "sin" ||
          fields[1].documentType !== "work_permit");

      if (needsFixing) {
        // Set first document to SIN if it's not already
        if (fields[0].documentType !== "sin") {
          setValue("documents.0.documentType", "sin");
        }

        // Set second document to Work Permit if it's not already
        if (fields[1].documentType !== "work_permit") {
          setValue("documents.1.documentType", "work_permit");
        }

        // Trigger validation after fixing the types
        setTimeout(() => {
          trigger("documents");
        }, 100);
      } else if (fields.length < 2) {
        // If we have less than 2 documents, we need to add them
        const documentsToAdd = [];

        if (fields.length === 0) {
          documentsToAdd.push({
            documentType: "sin",
            documentTitle: "",
            documentNotes: "",
            id: crypto.randomUUID(),
          });
        } else if (fields[0].documentType !== "sin") {
          setValue("documents.0.documentType", "sin");
        }

        if (fields.length <= 1) {
          documentsToAdd.push({
            documentType: "work_permit",
            documentTitle: "",
            documentNotes: "",
            id: crypto.randomUUID(),
          });
        }

        documentsToAdd.forEach((doc) => {
          append(doc);
        });

        // Trigger validation after adding documents
        if (documentsToAdd.length > 0) {
          setTimeout(() => {
            trigger("documents");
          }, 100);
        }
      }

      setMandatoryDocsInitialized(true);
    }
  }, [
    fields.length,
    append,
    mandatoryDocsInitialized,
    isEditMode,
    setValue,
    fields,
  ]);

  // Add a specific effect to handle initial load in edit mode
  useEffect(() => {
    if (isEditMode) {
      // Forcefully disable validation triggering in edit mode
      setForceShowErrors(false);

      // Prevent any automatic validation for the first 2 seconds in edit mode
      const timer = setTimeout(() => {
        // Timer ended
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
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Override trigger function to prevent accidental validation in edit mode
  const safeTrigger = useCallback(
    (...args: Parameters<typeof trigger>) => {
      if (isEditMode && initialLoading.current) {
        return Promise.resolve(false);
      }

      // Also prevent validation if we just initialized mandatory documents and user hasn't interacted
      if (
        mandatoryDocsInitialized &&
        !userInteracted &&
        !isSubmitted &&
        submitCount === 0
      ) {
        return Promise.resolve(true); // Return true to avoid blocking form flow
      }

      return trigger(...args);
    },
    [
      trigger,
      isEditMode,
      initialLoading,
      mandatoryDocsInitialized,
      userInteracted,
      isSubmitted,
      submitCount,
    ]
  );

  // Force validation check after mount
  useEffect(() => {
    // Skip auto-validation in edit mode to prevent accidental form submission
    if (isEditMode || initialLoading.current) {
      return;
    }

    const timer = setTimeout(() => {
      // Check if we already have documents with no file
      const documents = getValues().documents || [];

      if (documents.length > 0) {
        // Check if any document is missing a file
        const hasMissingFile = documents.some(
          (doc) => !doc.documentFile && !doc.documentPath
        );

        // Only validate if form was actually submitted, not just because documents are initialized
        if ((isSubmitted || submitCount > 0) && hasMissingFile) {
          safeTrigger("documents");
          setForceShowErrors(true);
        } else if (documents.length > 0 && !hasMissingFile) {
          safeTrigger("documents");
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [safeTrigger, isSubmitted, submitCount, getValues, isEditMode]);

  // Track when a document is added or removed
  useEffect(() => {
    if (fields.length > 0) {
      // Only trigger validation if user has interacted or form was submitted
      if (userInteracted || isSubmitted || submitCount > 0) {
        safeTrigger("documents");
      }
    }
  }, [fields.length, safeTrigger, userInteracted, isSubmitted, submitCount]);

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
                  console.error(
                    `Error getting signed URL for ${doc.documentPath}:`,
                    err
                  );
                }
              }
            })
          );

          if (isMounted) {
            setPdfCache(newCache);
          }
        } catch (err) {
          console.error("Error loading PDFs:", err);
        } finally {
          if (isMounted) {
            setLoadingPdfs(false);

            // Prevent triggering validation or form submission in edit mode
            if (!isEditMode) {
              // Only trigger validation in create mode if needed
              if ((isSubmitted || submitCount > 0) && !isEditMode) {
                safeTrigger("documents");
              }
            }
          }
        }
      };

      // Add a longer delay in edit mode to ensure the component is fully mounted
      // and prevent accidental validation triggering
      const loadTimeout = setTimeout(
        () => {
          loadPdfs();
        },
        isEditMode ? 700 : 200
      );

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
        console.error(
          "Cannot get signed URL: document path is missing or invalid."
        );
        return null;
      }

      const { data, error } = await supabase.storage
        .from("jobseeker-documents")
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
  const getDocumentFieldError = (
    index: number,
    fieldName: string
  ): string | undefined => {
    if (!allErrors.documents) {
      return undefined;
    }
    const documentsErrors = allErrors.documents as Record<
      string,
      Record<string, DocumentFieldError>
    >;
    // Check if the error exists at the specific index and field
    if (documentsErrors[index] && documentsErrors[index][fieldName]) {
      const errorMessage = String(documentsErrors[index][fieldName].message);
      return errorMessage;
    }
    return undefined;
  };

  const handleAddDocument = () => {
    setUserInteracted(true);
    append({
      documentType: "",
      documentTitle: "",
      documentNotes: "",
      id: crypto.randomUUID(),
    } as DocumentItemData);
  };

  const handleFileChange = (index: number, file: File) => {
    setUserInteracted(true);
    setValue(`documents.${index}.documentFile`, file);
    setValue(`documents.${index}.documentPath`, undefined);
    setValue(`documents.${index}.documentFileName`, file.name);

    // Trigger validation after file change
    safeTrigger("documents");
  };

  // Function to handle document item removal
  const handleRemoveDocument = (index: number) => {
    setUserInteracted(true);
    remove(index);
  };

  // Check if we have document-level errors
  const hasDocumentsError = shouldShowError("documents", allErrors, allFields);

  // Should we show document errors?
  const shouldDisplayErrors =
    isSubmitted || submitCount > 0 || userInteracted || forceShowErrors;

  // Add an escape hatch to prevent accidental form submission in edit mode
  useEffect(() => {
    if (!isEditMode) return;

    // Function to intercept form submissions
    const interceptFormSubmission = (e: Event) => {
      if (initialLoading.current) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Find the closest form element
    const formElement = document.querySelector("form");
    if (formElement) {
      formElement.addEventListener("submit", interceptFormSubmission, true);

      return () => {
        formElement.removeEventListener(
          "submit",
          interceptFormSubmission,
          true
        );
      };
    }
  }, [isEditMode]);

  return (
    <div className="form-step-container">
      <h2>{t("profileCreate.documents.sectionTitle")}</h2>
      <p className="form-description">
        {t("profileCreate.documents.sectionDescription")}
      </p>

      {/* Mandatory Documents Information */}
      <div className="mandatory-documents-info">
        <div className="mandatory-info-header">
          <AlertCircle size={20} className="info-icon" />
          <h3>{t("profileCreate.documents.mandatoryDocumentsInfo")}</h3>
        </div>
        <div className="mandatory-requirements">
          <div className="mandatory-requirement">
            <div className="requirement-icon">
              <FileText size={16} />
            </div>
            <div className="requirement-content">
              <strong>{t("profileCreate.documents.documentTypes.sin")}</strong>
              <p>{t("profileCreate.documents.sinMandatoryReason")}</p>
            </div>
          </div>
          <div className="mandatory-requirement">
            <div className="requirement-icon">
              <FileText size={16} />
            </div>
            <div className="requirement-content">
              <strong>
                {t("profileCreate.documents.documentTypes.work_permit")}
              </strong>
              <p>{t("profileCreate.documents.workPermitMandatoryReason")}</p>
            </div>
          </div>
        </div>
      </div>

      {shouldDisplayErrors && hasDocumentsError && (
        <div className="documents-error-banner">
          <AlertCircle size={20} />
          <p className="error-message">
            {typeof allErrors.documents?.message === "string"
              ? allErrors.documents.message
              : t("profileCreate.documents.errorBanner")}
          </p>
        </div>
      )}

      {loadingPdfs && (
        <div className="loading-pdfs">
          <div className="pdf-loading-spinner"></div>
          <p>{t("profileCreate.documents.loadingDocumentPreviews")}</p>
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
          className={`attachment-upload-button ${
            disableSubmit ? "disabled" : ""
          }`}
          onClick={handleAddDocument}
          disabled={disableSubmit}
        >
          <Plus size={16} /> {t("profileCreate.documents.addAnotherDocument")}
        </button>
      </div>

      {/* PDF Viewer Modal */}
      <PDFViewerModal
        pdfUrl={selectedPdfUrl}
        documentName={selectedPdfName}
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
      />
    </div>
  );
}
