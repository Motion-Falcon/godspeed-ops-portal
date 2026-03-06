import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  FileCheck,
  FileText,
  History,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  createConsentTemplate,
  deleteConsentTemplate,
  getConsentDocuments,
  getConsentTemplates,
  type ConsentAutofillField,
  type ConsentTemplate,
} from "../../services/api/consent";
import { AppHeader } from "../../components/AppHeader";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import PDFViewerModal from "../../components/PDFViewerModal";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/language/language-provider";
import "../../styles/pages/CreateConsentPage.css";
import "../../styles/pages/ConsentTemplatePage.css";

if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
}

type FieldType = "consentedName" | "consentDate";

interface ExistingDocument {
  id: string;
  fileName: string;
  filePath: string;
  createdAt: string;
  signedUrl?: string | null;
}

interface TemplateFieldDraft {
  id: string;
  fieldType: FieldType;
  label: string;
  previewValue: string;
  page?: number;
  xPct?: number;
  yPct?: number;
  size: number;
}

interface ExistingTemplate extends ConsentTemplate {}

function decodeFilePath(filePath: string): string {
  return filePath
    .replace(/&#x2F;/g, "/")
    .replace(/&#x5C;/g, "\\")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

export function ConsentTemplatePage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  const [documentSource, setDocumentSource] = useState<"existing" | "new">("existing");
  const [documentSearch, setDocumentSearch] = useState("");
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [existingDocuments, setExistingDocuments] = useState<ExistingDocument[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [existingTemplates, setExistingTemplates] = useState<ExistingTemplate[]>([]);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<ExistingTemplate | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedDocumentPath, setSelectedDocumentPath] = useState<string | null>(null);
  const [selectedDocumentName, setSelectedDocumentName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [templatePages, setTemplatePages] = useState<number>(1);
  const [templatePageNumber, setTemplatePageNumber] = useState<number>(1);
  const [templateLoading, setTemplateLoading] = useState<boolean>(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const [fields, setFields] = useState<TemplateFieldDraft[]>([]);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  const templateCanvasRef = useRef<HTMLDivElement | null>(null);

  const activeField = fields.find((field) => field.id === activeFieldId) || null;

  const getDefaultFieldLabel = useCallback(
    (fieldType: FieldType) =>
      fieldType === "consentedName"
        ? t("consent.create.step2.placeNameField")
        : t("consent.create.step2.placeDateField"),
    [t]
  );

  const getDefaultPreviewValue = useCallback(
    (fieldType: FieldType) =>
      fieldType === "consentedName"
        ? "John Doe"
        : new Date().toISOString().slice(0, 10),
    []
  );

  const resetMapper = useCallback(() => {
    setFields([]);
    setActiveFieldId(null);
    setTemplatePages(1);
    setTemplatePageNumber(1);
    setTemplateLoading(true);
    setTemplateError(null);
  }, []);

  const getSignedUrl = useCallback(async (filePath: string): Promise<string | null> => {
    const decodedPath = decodeFilePath(filePath);
    const { data, error: signedUrlError } = await supabase.storage
      .from("consent-documents")
      .createSignedUrl(decodedPath, 300);

    if (signedUrlError) {
      return null;
    }

    return data?.signedUrl || null;
  }, []);

  const fetchExistingDocuments = useCallback(async () => {
    setLoadingDocuments(true);
    try {
      const response = await getConsentDocuments({
        page: 1,
        limit: 1000,
        search: "",
      });

      const pdfDocuments = response.documents.filter((doc) =>
        doc.fileName.toLowerCase().endsWith(".pdf")
      );

      const documentsWithUrls = await Promise.all(
        pdfDocuments.map(async (doc) => ({
          id: doc.id,
          fileName: doc.fileName,
          filePath: doc.filePath,
          createdAt: doc.createdAt,
          signedUrl: await getSignedUrl(doc.filePath),
        }))
      );

      setExistingDocuments(documentsWithUrls);
    } catch (err) {
      console.error("Error fetching existing documents:", err);
      setError(t("consent.create.messages.failedToFetchDocuments"));
    } finally {
      setLoadingDocuments(false);
    }
  }, [getSignedUrl, t]);

  const fetchExistingTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const response = await getConsentTemplates({ includeInactive: true });
      setExistingTemplates(response.templates);
    } catch (err) {
      console.error("Error fetching consent templates:", err);
      setError(t("consent.templates.messages.failedToFetchTemplates"));
    } finally {
      setLoadingTemplates(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/consent-dashboard");
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    fetchExistingDocuments();
    fetchExistingTemplates();
  }, [fetchExistingDocuments, fetchExistingTemplates]);

  useEffect(() => {
    return () => {
      if (pdfUrl && pdfUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const filteredDocuments = existingDocuments.filter((doc) => {
    if (!documentSearch) return true;
    return doc.fileName.toLowerCase().includes(documentSearch.toLowerCase());
  });

  const onTemplateLoadSuccess = ({ numPages }: { numPages: number }) => {
    setTemplatePages(numPages);
    setTemplatePageNumber((prev) => Math.max(1, Math.min(prev, numPages)));
    setTemplateLoading(false);
    setTemplateError(null);
  };

  const onTemplateLoadError = (err: Error) => {
    console.error("Error loading template PDF for mapping:", err);
    setTemplateError(t("consent.create.step2.templateMapperError"));
    setTemplateLoading(false);
  };

  const addField = (fieldType: FieldType) => {
    const id = crypto.randomUUID();
    const nextField: TemplateFieldDraft = {
      id,
      fieldType,
      label: getDefaultFieldLabel(fieldType),
      previewValue: getDefaultPreviewValue(fieldType),
      size: 14,
    };

    setFields((prev) => [...prev, nextField]);
    setActiveFieldId(id);
  };

  const removeField = (fieldId: string) => {
    setFields((prev) => prev.filter((field) => field.id !== fieldId));
    if (activeFieldId === fieldId) {
      setActiveFieldId(null);
    }
  };

  const updateField = (fieldId: string, updates: Partial<TemplateFieldDraft>) => {
    setFields((prev) =>
      prev.map((field) => (field.id === fieldId ? { ...field, ...updates } : field))
    );
  };

  const handleTemplateCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!templateCanvasRef.current || !activeFieldId) return;

    const rect = templateCanvasRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xPct = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const yPct = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

    updateField(activeFieldId, {
      page: templatePageNumber,
      xPct,
      yPct,
    });

    setTemplateError(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError(t("consent.create.messages.pdfOnly"));
      return;
    }

    setError(null);
    resetMapper();
    setSelectedFile(file);
    setSelectedDocumentId(null);
    setSelectedDocumentPath(null);
    setSelectedDocumentName(file.name);
    setDocumentSource("new");
    setPdfUrl(URL.createObjectURL(file));
  };

  const handleSelectExistingDocument = async (document: ExistingDocument) => {
    setError(null);
    resetMapper();

    let previewUrl = document.signedUrl;
    if (!previewUrl) {
      previewUrl = await getSignedUrl(document.filePath);
    }

    setPdfUrl(previewUrl || null);
    setSelectedFile(null);
    setSelectedDocumentId(document.id);
    setSelectedDocumentPath(document.filePath);
    setSelectedDocumentName(document.fileName);
    setDocumentSource("existing");
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    setDeletingTemplateId(templateToDelete.id);
    setError(null);
    setMessage(null);

    try {
      await deleteConsentTemplate(templateToDelete.id);
      setMessage(t("consent.templates.messages.templateDeleted"));
      setTemplateToDelete(null);
      await fetchExistingTemplates();
    } catch (err) {
      console.error("Error deleting consent template:", err);
      setError(
        err instanceof Error
          ? err.message
          : t("consent.templates.messages.failedToDeleteTemplate")
      );
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const hasMappedFields = fields.some(
    (field) =>
      field.page !== undefined &&
      field.xPct !== undefined &&
      field.yPct !== undefined
  );

  const hasAtLeastOneName = fields.some(
    (field) => field.fieldType === "consentedName" && field.page !== undefined
  );
  const hasAtLeastOneDate = fields.some(
    (field) => field.fieldType === "consentDate" && field.page !== undefined
  );

  const isTemplateReady =
    templateName.trim().length >= 2 &&
    selectedDocumentName.length > 0 &&
    hasMappedFields &&
    hasAtLeastOneName &&
    hasAtLeastOneDate;

  const handleCreateTemplate = async () => {
    if (!user?.id) {
      setError(t("consent.create.messages.authenticationRequired"));
      return;
    }

    if (templateName.trim().length < 2) {
      setError(t("consent.templates.messages.templateNameRequired"));
      return;
    }

    if (!selectedDocumentName) {
      setError(t("consent.create.messages.selectDocument"));
      return;
    }

    if (!hasMappedFields || !hasAtLeastOneName || !hasAtLeastOneDate) {
      setError(t("consent.templates.messages.mapTemplateFields"));
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      let filePath: string;

      if (documentSource === "existing" && selectedDocumentPath) {
        filePath = selectedDocumentPath;
      } else if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
        const uploadPath = `${user.id}/consent-templates/${Date.now()}/${uniqueFileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("consent-documents")
          .upload(uploadPath, selectedFile);

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        filePath = uploadData?.path || uploadPath;
      } else {
        setError(t("consent.create.messages.selectDocument"));
        return;
      }

      const fieldMappings: ConsentAutofillField[] = fields
        .filter(
          (field) =>
            field.page !== undefined &&
            field.xPct !== undefined &&
            field.yPct !== undefined
        )
        .map((field) => ({
          id: field.id,
          fieldType: field.fieldType,
          label: field.label,
          page: field.page!,
          xPct: field.xPct!,
          yPct: field.yPct!,
          size: field.size,
        }));

      await createConsentTemplate({
        templateName: templateName.trim(),
        templateDescription: templateDescription.trim(),
        fileName: selectedDocumentName,
        filePath,
        fieldMappings,
      });

      setMessage(t("consent.templates.messages.templateCreated"));
      setTemplateName("");
      setTemplateDescription("");
      setFields([]);
      setActiveFieldId(null);
      await fetchExistingTemplates();
    } catch (err) {
      console.error("Error creating consent template:", err);
      setError(
        err instanceof Error
          ? err.message
          : t("consent.templates.messages.failedToCreateTemplate")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <AppHeader
        title=""
        actions={
          <button
            className="button secondary button-icon"
            onClick={() => navigate("/consent-dashboard")}
          >
            <ArrowLeft size={16} />
            <span>{t("buttons.back")}</span>
          </button>
        }
        statusMessage={message || error}
        statusType={error ? "error" : "success"}
      />

      <div className="content-container consent-management">
        <div className="dashboard-heading">
          <h1 className="dashboard-title">{t("consent.templates.title")}</h1>
          <div className="user-role-badge">
            <FileText className="role-icon" />
            <span>{t("consent.templates.badge")}</span>
          </div>
        </div>
        <p className="dashboard-subtitle">{t("consent.templates.description")}</p>

        <div className="card create-consent-card">
          <div className="card-header">
            <div>
              <h2>{t("consent.templates.setupTitle")}</h2>
              <p>{t("consent.templates.setupDescription")}</p>
            </div>
            <button
              className="button primary button-icon"
              onClick={handleCreateTemplate}
              disabled={!isTemplateReady || loading}
            >
              <span>
                {loading
                  ? t("consent.templates.buttons.creatingTemplate")
                  : t("consent.templates.buttons.createTemplate")}
              </span>
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="card-body">
            <div className="step2-layout-container">
              <div className="step2-left-section">
                <div className="form-section document-form-section">
                  <label className="form-label">
                    <FileText size={16} />
                    <span>{t("consent.templates.templateInfo")}</span>
                  </label>
                  <div className="consent-template-form-grid">
                    <label className="consent-template-input-group">
                      <span>{t("consent.templates.templateName")}</span>
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder={t("consent.templates.templateNamePlaceholder")}
                      />
                    </label>
                    <label className="consent-template-input-group">
                      <span>{t("consent.templates.templateDescription")}</span>
                      <textarea
                        rows={3}
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                        placeholder={t("consent.templates.templateDescriptionPlaceholder")}
                      />
                    </label>
                  </div>
                </div>

                <div className="form-section document-form-section">
                  <label className="form-label">
                    <Upload size={16} />
                    <span>{t("consent.create.step2.uploadDocument")}</span>
                  </label>

                  <div className="document-source-selection">
                    <button
                      type="button"
                      className={`source-toggle-btn ${documentSource === "new" ? "active" : ""}`}
                      onClick={() => {
                        setDocumentSource("new");
                        setSelectedDocumentId(null);
                        setSelectedDocumentPath(null);
                        setSelectedDocumentName("");
                        setSelectedFile(null);
                        setPdfUrl(null);
                        resetMapper();
                        setError(null);
                      }}
                    >
                      <Upload size={16} />
                      <span>{t("consent.create.step2.uploadNew")}</span>
                    </button>
                    <button
                      type="button"
                      className={`source-toggle-btn ${documentSource === "existing" ? "active" : ""}`}
                      onClick={() => {
                        setDocumentSource("existing");
                        setSelectedFile(null);
                        setSelectedDocumentName("");
                        setPdfUrl(null);
                        resetMapper();
                        setError(null);
                      }}
                    >
                      <History size={16} />
                      <span>{t("consent.create.step2.useExisting")}</span>
                    </button>
                  </div>

                  {documentSource === "existing" && (
                    <div className="existing-documents-section">
                      <div className="search-box">
                        <Search size={16} className="search-icon" />
                        <input
                          type="text"
                          placeholder={t("consent.create.step2.searchDocuments")}
                          value={documentSearch}
                          onChange={(e) => setDocumentSearch(e.target.value)}
                          className="search-input"
                        />
                      </div>
                      {loadingDocuments ? (
                        <div className="loading-state">
                          {t("consent.create.step2.loadingDocuments")}
                        </div>
                      ) : filteredDocuments.length === 0 ? (
                        <div className="empty-state">
                          {documentSearch
                            ? t("consent.create.step2.noDocumentsMatch")
                            : t("consent.create.step2.noDocumentsFound")}
                        </div>
                      ) : (
                        <div className="existing-documents-list">
                          {filteredDocuments.map((doc) => {
                            const isSelected = selectedDocumentId === doc.id;
                            return (
                              <div
                                key={doc.id}
                                className={`existing-document-item ${isSelected ? "selected" : ""}`}
                                onClick={() => handleSelectExistingDocument(doc)}
                              >
                                <div className="document-item-icon">
                                  <FileText size={20} />
                                </div>
                                <div className="document-item-info">
                                  <div className="document-item-name">{doc.fileName}</div>
                                  <div className="document-item-date">
                                    <Clock size={12} />
                                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="selected-indicator">
                                    <FileCheck size={20} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {documentSource === "new" && (
                    <div className="file-upload-area">
                      <input
                        type="file"
                        id="template-document-upload"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="file-input"
                      />
                      <label htmlFor="template-document-upload" className="file-upload-label">
                        <Upload size={24} />
                        <div className="upload-text">
                          <span className="primary-text">
                            {selectedFile
                              ? selectedFile.name
                              : t("consent.create.step2.clickToUpload")}
                          </span>
                          <span className="secondary-text">
                            {selectedFile
                              ? t("consent.create.step2.clickToReplace")
                              : t("consent.create.step2.pdfOnly")}
                          </span>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                <div className="form-section document-form-section">
                  <label className="form-label">
                    <Plus size={16} />
                    <span>{t("consent.templates.fieldSetup")}</span>
                  </label>
                  <div className="consent-template-field-actions">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => addField("consentedName")}
                    >
                      {t("consent.templates.addNameField")}
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => addField("consentDate")}
                    >
                      {t("consent.templates.addDateField")}
                    </button>
                  </div>
                  <div className="template-field-grid">
                    {fields.length === 0 ? (
                      <div className="empty-state">
                        {t("consent.templates.noFieldsMapped")}
                      </div>
                    ) : (
                      fields.map((field) => {
                        const isPlaced =
                          field.page !== undefined &&
                          field.xPct !== undefined &&
                          field.yPct !== undefined;
                        const isActive = activeFieldId === field.id;
                        return (
                          <div
                            key={field.id}
                            className={`template-field-card ${isActive ? "active" : ""}`}
                          >
                            <button
                              type="button"
                              className="template-field-select"
                              onClick={() => setActiveFieldId(field.id)}
                            >
                              <span className="template-field-title">{field.label}</span>
                              <span className="template-field-status">
                                {isPlaced
                                  ? t("consent.create.step2.placedOnPage", { page: field.page ?? 1 })
                                  : t("consent.create.step2.clickToPlace")}
                              </span>
                            </button>
                            <div className="template-field-preview-input">
                              <label htmlFor={`field-preview-${field.id}`}>
                                {t("consent.templates.sampleValue")}
                              </label>
                              <input
                                id={`field-preview-${field.id}`}
                                type="text"
                                value={field.previewValue}
                                onChange={(e) =>
                                  updateField(field.id, {
                                    previewValue: e.target.value,
                                  })
                                }
                                placeholder={t("consent.templates.sampleValuePlaceholder")}
                              />
                            </div>
                            <div className="template-field-size">
                              <label htmlFor={`field-size-${field.id}`}>
                                {t("consent.create.step2.fontSizeLabel")}
                              </label>
                              <input
                                id={`field-size-${field.id}`}
                                type="number"
                                min={6}
                                max={72}
                                value={field.size}
                                onChange={(e) =>
                                  updateField(field.id, {
                                    size: Math.max(
                                      6,
                                      Math.min(72, Number(e.target.value || 14))
                                    ),
                                  })
                                }
                              />
                              <button
                                type="button"
                                className="consent-template-delete-field"
                                onClick={() => removeField(field.id)}
                                title={t("consent.templates.removeField")}
                                aria-label={t("consent.templates.removeField")}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="step2-right-section">
                <div className="form-section document-preview-section">
                  <label className="form-label">
                    <FileText size={16} />
                    <span>{t("consent.create.step2.templateSetupTitle")}</span>
                  </label>
                  {pdfUrl ? (
                    <div className="template-mapper-container">
                      <p className="template-mapper-description">
                        {activeField
                          ? t("consent.templates.activeFieldHint", {
                              field: activeField.label,
                            })
                          : t("consent.templates.selectFieldHint")}
                      </p>

                      <div className="template-page-controls">
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() =>
                            setTemplatePageNumber((prev) => Math.max(1, prev - 1))
                          }
                          disabled={templatePageNumber <= 1}
                        >
                          {t("consent.pagination.previous")}
                        </button>
                        <span className="template-page-indicator">
                          {t("consent.pageOfPages", {
                            current: templatePageNumber,
                            total: templatePages,
                          })}
                        </span>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() =>
                            setTemplatePageNumber((prev) =>
                              Math.min(templatePages, prev + 1)
                            )
                          }
                          disabled={templatePageNumber >= templatePages}
                        >
                          {t("consent.pagination.next")}
                        </button>
                      </div>

                      {templateError && (
                        <div className="error-message template-mapper-error">
                          {templateError}
                        </div>
                      )}

                      <div
                        ref={templateCanvasRef}
                        className={`template-canvas ${templateLoading ? "loading" : ""} ${
                          !activeField ? "inactive" : ""
                        }`}
                        onClick={handleTemplateCanvasClick}
                      >
                        <Document
                          file={pdfUrl}
                          onLoadSuccess={onTemplateLoadSuccess}
                          onLoadError={onTemplateLoadError}
                          loading={null}
                          className="template-pdf-document"
                        >
                          <Page
                            pageNumber={templatePageNumber}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            width={460}
                          />
                        </Document>

                        {fields.map((field) => {
                          if (
                            field.page !== templatePageNumber ||
                            field.xPct === undefined ||
                            field.yPct === undefined
                          ) {
                            return null;
                          }

                          return (
                            <div
                              key={`marker-${field.id}`}
                              className={`template-field-marker ${
                                activeFieldId === field.id ? "active" : ""
                              }`}
                              style={{
                                left: `${field.xPct * 100}%`,
                                top: `${field.yPct * 100}%`,
                                fontSize: `${field.size}px`,
                                lineHeight: 1,
                                transform: `translate(0, -${Math.round(
                                  field.size * 0.72
                                )}px)`,
                              }}
                            >
                              <span>{field.previewValue || field.label}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="preview-actions">
                        <button
                          type="button"
                          className="button secondary button-icon"
                          onClick={() => setShowPdfModal(true)}
                        >
                          <FileText size={16} />
                          <span>{t("consent.create.step2.viewFullDocument")}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="preview-placeholder">
                      <FileText size={48} />
                      <p>{t("consent.create.step2.selectDocumentToMap")}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card create-consent-card consent-template-existing-card">
          <div className="card-header">
            <div>
              <h2>{t("consent.templates.existingTemplatesTitle")}</h2>
              <p>{t("consent.templates.existingTemplatesDescription")}</p>
            </div>
          </div>
          <div className="card-body">
            {loadingTemplates ? (
              <div className="loading-state">{t("consent.templates.loadingTemplates")}</div>
            ) : existingTemplates.length === 0 ? (
              <div className="empty-state">{t("consent.templates.noTemplatesFound")}</div>
            ) : (
              <div className="template-existing-list">
                {existingTemplates.map((template) => (
                  <div key={template.id} className="template-existing-item">
                    <div className="template-existing-info">
                      <div className="template-existing-name">{template.templateName}</div>
                      <div className="template-existing-meta">
                        <span>{template.fileName}</span>
                        <span>
                          {t("consent.detail.created")}{" "}
                          {new Date(template.createdAt).toLocaleDateString()}
                        </span>
                        <span>
                          {t("consent.templates.fieldCount", {
                            count: template.fieldMappings?.length || 0,
                          })}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button danger button-icon"
                      onClick={() => setTemplateToDelete(template)}
                      disabled={deletingTemplateId === template.id}
                    >
                      <Trash2 size={14} />
                      <span>{t("consent.templates.deleteTemplate")}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPdfModal && pdfUrl && (
        <PDFViewerModal
          pdfUrl={pdfUrl}
          documentName={selectedDocumentName || t("consent.create.defaultDocumentName")}
          isOpen={showPdfModal}
          onClose={() => setShowPdfModal(false)}
        />
      )}

      <ConfirmationModal
        isOpen={!!templateToDelete}
        title={t("consent.templates.deleteTemplateTitle")}
        message={t("consent.templates.deleteTemplateMessage", {
          template: templateToDelete?.templateName || "",
        })}
        confirmText={
          deletingTemplateId
            ? t("consent.templates.buttons.deletingTemplate")
            : t("consent.templates.deleteTemplate")
        }
        cancelText={t("buttons.cancel")}
        confirmButtonClass="danger"
        onConfirm={handleDeleteTemplate}
        onCancel={() => {
          if (!deletingTemplateId) {
            setTemplateToDelete(null);
          }
        }}
      />
    </div>
  );
}
