import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  Users,
  FileText,
  Send,
  X,
  Search,
  History,
  FileCheck,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  createConsentRequest,
  getConsentDocuments,
  getConsentTemplates,
  type ConsentTemplate,
  type ConsentMode,
  type CreateConsentRequestData,
} from "../../services/api/consent";
import { getClients } from "../../services/api/client";
import { getJobseekerProfiles } from "../../services/api/jobseeker";
import { AppHeader } from "../../components/AppHeader";
import PDFThumbnail from "../../components/PDFThumbnail";
import PDFViewerModal from "../../components/PDFViewerModal";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/language/language-provider";
import "../../styles/pages/CreateConsentPage.css";

type RecipientType = "client" | "jobseeker_profile";

interface Step1Data {
  recipientType: RecipientType | null;
}

// Client and Jobseeker interfaces for selection
interface ClientOption {
  id: string;
  companyName: string;
  emailAddress1: string;
  contactPersonName1: string;
}

interface JobseekerOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
}

interface Step2Data {
  fileName: string;
  file: File | null;
  selectedDocumentId: string | null; // For existing documents
  selectedDocumentPath: string | null; // For existing documents
}

interface Step3Data {
  selectedRecipients: (ClientOption | JobseekerOption)[];
}

interface ExistingDocument {
  id: string;
  fileName: string;
  filePath: string;
  createdAt: string;
  signedUrl?: string | null;
}

interface ExistingTemplate extends ConsentTemplate {
  signedUrl?: string | null;
}

export function CreateConsentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Step 1 state
  const [step1Data, setStep1Data] = useState<Step1Data>({
    recipientType: null,
  });

  // Step 2 state (Document selection)
  const [step2Data, setStep2Data] = useState<Step2Data>({
    fileName: "",
    file: null,
    selectedDocumentId: null,
    selectedDocumentPath: null,
  });

  // Step 3 state (Recipient selection)
  const [step3Data, setStep3Data] = useState<Step3Data>({
    selectedRecipients: [],
  });

  // Document source selection (existing vs new upload)
  const [documentSource, setDocumentSource] = useState<"existing" | "new">("existing");
  
  // Existing documents state
  const [existingDocuments, setExistingDocuments] = useState<ExistingDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [documentSearch, setDocumentSearch] = useState("");

  // Recipients selection state
  const [availableRecipients, setAvailableRecipients] = useState<
    (ClientOption | JobseekerOption)[]
  >([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [showRecipientModal, setShowRecipientModal] = useState(false);

  // PDF preview state
  const [standardPdfUrl, setStandardPdfUrl] = useState<string | null>(null);
  const [templatePdfUrl, setTemplatePdfUrl] = useState<string | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [consentMode, setConsentMode] = useState<ConsentMode>("standard");
  const [existingTemplates, setExistingTemplates] = useState<ExistingTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Reset form when component mounts
  useEffect(() => {
    setCurrentStep(1);
    setStep1Data({ recipientType: null });
    setStep2Data({ 
      fileName: "", 
      file: null, 
      selectedDocumentId: null,
      selectedDocumentPath: null,
    });
    setStep3Data({
      selectedRecipients: [],
    });
    setError(null);
    setMessage(null);
    setDocumentSource("existing");
    setConsentMode("standard");
    setStandardPdfUrl(null);
    setTemplatePdfUrl(null);
    setExistingTemplates([]);
    setTemplateSearch("");
    setSelectedTemplateId(null);
  }, []);

  // Cleanup PDF URL when component unmounts
  useEffect(() => {
    return () => {
      if (standardPdfUrl && standardPdfUrl.startsWith("blob:")) {
        URL.revokeObjectURL(standardPdfUrl);
      }
      if (templatePdfUrl && templatePdfUrl.startsWith("blob:")) {
        URL.revokeObjectURL(templatePdfUrl);
      }
    };
  }, [standardPdfUrl, templatePdfUrl]);

  // Fetch existing consent documents uploaded by current user
  const fetchExistingDocuments = useCallback(async () => {
    if (!user?.id) return;

    setLoadingDocuments(true);
    try {
      // Use the API endpoint which handles authentication properly
      // Fetch all documents with a high limit to get all user's documents
      const response = await getConsentDocuments({
        page: 1,
        limit: 1000, // Get all documents
        search: "",
      });

      // Filter to only show documents uploaded by current user
      const userDocuments = response.documents.filter(
        (doc) => doc.uploadedBy === user.id
      );

      // Get signed URLs for preview
      const documentsWithUrls = await Promise.all(
        userDocuments.map(async (doc) => {
          try {
            const decodedPath = doc.filePath.replace(/&#x2F;/g, "/");
            const { data: signedUrlData } = await supabase.storage
              .from("consent-documents")
              .createSignedUrl(decodedPath, 300);

            return {
              id: doc.id,
              fileName: doc.fileName,
              filePath: doc.filePath,
              createdAt: doc.createdAt,
              signedUrl: signedUrlData?.signedUrl || null,
            };
          } catch (err) {
            console.error("Error getting signed URL for document:", err);
            return {
              id: doc.id,
              fileName: doc.fileName,
              filePath: doc.filePath,
              createdAt: doc.createdAt,
              signedUrl: null,
            };
          }
        })
      );

      setExistingDocuments(documentsWithUrls);
    } catch (err) {
      console.error("Error fetching existing documents:", err);
      setError(t("consent.create.messages.failedToFetchDocuments"));
    } finally {
      setLoadingDocuments(false);
    }
  }, [user?.id, t]);

  const fetchExistingTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const response = await getConsentTemplates();
      setExistingTemplates(response.templates);
    } catch (err) {
      console.error("Error fetching consent templates:", err);
      setError(t("consent.templates.messages.failedToFetchTemplates"));
    } finally {
      setLoadingTemplates(false);
    }
  }, [t]);

  // Filter existing documents based on search
  const filteredDocuments = existingDocuments.filter((doc) => {
    if (!documentSearch) return true;
    const searchLower = documentSearch.toLowerCase();
    return doc.fileName.toLowerCase().includes(searchLower);
  });

  const selectedTemplate =
    existingTemplates.find((template) => template.id === selectedTemplateId) || null;
  const hasSelectedTemplate = !!selectedTemplate;

  const filteredTemplates = existingTemplates.filter((template) => {
    if (!templateSearch) return true;
    const searchLower = templateSearch.toLowerCase();
    return (
      template.templateName.toLowerCase().includes(searchLower) ||
      template.fileName.toLowerCase().includes(searchLower)
    );
  });

  const fetchRecipients = useCallback(async () => {
    if (!step1Data.recipientType) return;

    setLoadingRecipients(true);
    try {
      if (step1Data.recipientType === "client") {
        // Fetch all clients using existing API
        const response = await getClients({
          page: 1,
          limit: 1000,
          searchTerm: "",
          companyNameFilter: "",
          shortCodeFilter: "",
          listNameFilter: "",
          contactFilter: "",
          emailFilter: "",
          mobileFilter: "",
          paymentMethodFilter: "",
          paymentCycleFilter: "",
        });

        // Transform to ClientOption format
        const clients: ClientOption[] = response.clients.map((client) => ({
          id: client.id as string,
          companyName: client.companyName || t("consent.common.unknownCompany"),
          emailAddress1: client.emailAddress1 || "",
          contactPersonName1: client.contactPersonName1 || "",
        }));

        setAvailableRecipients(clients);
      } else {
        // Fetch all verified jobseekers using existing API
        const response = await getJobseekerProfiles({
          page: 1,
          limit: 1000,
          search: "",
          nameFilter: "",
          emailFilter: "",
          phoneFilter: "",
          locationFilter: "",
          employeeIdFilter: "",
          experienceFilter: "all",
          statusFilter: "verified",
          dateFilter: "",
        });

        // Transform to JobseekerOption format
        const jobseekers: JobseekerOption[] = response.profiles.map(
          (profile) => {
            const nameParts = profile.name?.split(" ") || ["", ""];
            return {
              id: profile.id,
              firstName: nameParts[0] || "",
              lastName: nameParts.slice(1).join(" ") || "",
              email: profile.email,
              phoneNumber: profile.phoneNumber || "",
            };
          }
        );

        setAvailableRecipients(jobseekers);
      }
    } catch (err) {
      console.error("Error fetching recipients:", err);
              setError(t("consent.create.messages.failedToFetchRecipients"));
    } finally {
      setLoadingRecipients(false);
    }
  }, [step1Data.recipientType, t]);

  // Fetch existing documents when user is available and on step 2
  useEffect(() => {
    if (currentStep !== 2) return;

    if (consentMode === "autofill") {
      fetchExistingTemplates();
      return;
    }

    if (user?.id) {
      fetchExistingDocuments();
    }
  }, [
    user?.id,
    currentStep,
    consentMode,
    fetchExistingDocuments,
    fetchExistingTemplates,
  ]);

  // Fetch recipients when on step 3
  useEffect(() => {
    if (step1Data.recipientType && currentStep === 3) {
      fetchRecipients();
    }
  }, [step1Data.recipientType, currentStep, fetchRecipients]);

  // Clear recipients when recipient type changes
  useEffect(() => {
    if (step1Data.recipientType) {
      // Clear selected recipients and available recipients when switching types
      setStep3Data({
        selectedRecipients: [],
      });
      setAvailableRecipients([]);
      setRecipientSearch("");
    }
  }, [step1Data.recipientType]);

  // Removed handleStep1Submit - now automatically moving to step 2 on selection

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (file.type !== "application/pdf") {
        setError(t("consent.create.messages.pdfOnly"));
        return;
      }

      // Clear any previous error
      setError(null);

      // Create URL for PDF preview
      const url = URL.createObjectURL(file);
      setStandardPdfUrl(url);

      setStep2Data((prev) => ({
        ...prev,
        file,
        fileName: file.name,
        selectedDocumentId: null,
        selectedDocumentPath: null,
      }));
      setSelectedTemplateId(null);
      setTemplatePdfUrl(null);
      setDocumentSource("new");
    }
  };

  const handleSelectExistingDocument = async (document: ExistingDocument) => {
    setError(null);
    
    // Get signed URL for preview if not already available
    let previewUrl = document.signedUrl;
    if (!previewUrl) {
      try {
        const decodedPath = document.filePath.replace(/&#x2F;/g, "/");
        const { data: signedUrlData } = await supabase.storage
          .from("consent-documents")
          .createSignedUrl(decodedPath, 300);
        previewUrl = signedUrlData?.signedUrl || null;
      } catch (err) {
        console.error("Error getting signed URL:", err);
      }
    }

    setStandardPdfUrl(previewUrl || null);
    setStep2Data((prev) => ({
      ...prev,
      file: null,
      fileName: document.fileName,
      selectedDocumentId: document.id,
      selectedDocumentPath: document.filePath,
    }));
    setSelectedTemplateId(null);
    setTemplatePdfUrl(null);
    setDocumentSource("existing");
  };

  const handleSelectTemplate = async (template: ExistingTemplate) => {
    setError(null);

    let previewUrl = template.signedUrl;
    if (!previewUrl) {
      try {
        const decodedPath = template.filePath.replace(/&#x2F;/g, "/");
        const { data: signedUrlData } = await supabase.storage
          .from("consent-documents")
          .createSignedUrl(decodedPath, 300);
        previewUrl = signedUrlData?.signedUrl || null;
      } catch (err) {
        console.error("Error getting signed URL for template:", err);
      }
    }

    setExistingTemplates((prev) =>
      prev.map((item) =>
        item.id === template.id ? { ...item, signedUrl: previewUrl } : item
      )
    );

    setSelectedTemplateId(template.id);
    setTemplatePdfUrl(previewUrl || null);
  };

  const handleRecipientSelect = (recipient: ClientOption | JobseekerOption) => {
    const isAlreadySelected = step3Data.selectedRecipients.some(
      (r) => r.id === recipient.id
    );

    if (!isAlreadySelected) {
      setStep3Data((prev) => ({
        ...prev,
        selectedRecipients: [...prev.selectedRecipients, recipient],
      }));
    }
  };

  const handleRecipientRemove = (recipientId: string) => {
    setStep3Data((prev) => ({
      ...prev,
      selectedRecipients: prev.selectedRecipients.filter(
        (r) => r.id !== recipientId
      ),
    }));
  };

  const handleSelectAll = () => {
    // Select all filtered recipients
    const recipientsToAdd = filteredRecipients.filter(
      (recipient) =>
        !step3Data.selectedRecipients.some(
          (selected) => selected.id === recipient.id
        )
    );

    setStep3Data((prev) => ({
      ...prev,
      selectedRecipients: [...prev.selectedRecipients, ...recipientsToAdd],
    }));
  };

  const handleUnselectAll = () => {
    // Unselect all filtered recipients
    const filteredIds = filteredRecipients.map((r) => r.id);
    setStep3Data((prev) => ({
      ...prev,
      selectedRecipients: prev.selectedRecipients.filter(
        (r) => !filteredIds.includes(r.id)
      ),
    }));
  };

  // Filter recipients based on search term
  const filteredRecipients = availableRecipients.filter((recipient) => {
    if (!recipientSearch) return true;

    const searchLower = recipientSearch.toLowerCase();
    const name = getRecipientDisplayName(recipient).toLowerCase();
    const email = getRecipientDisplayEmail(recipient).toLowerCase();

    return name.includes(searchLower) || email.includes(searchLower);
  });

  const areAllSelected =
    filteredRecipients.length > 0 &&
    filteredRecipients.every((recipient) =>
      step3Data.selectedRecipients.some(
        (selected) => selected.id === recipient.id
      )
    );

  const getRecipientDisplayName = (
    recipient: ClientOption | JobseekerOption
  ): string => {
    if ("companyName" in recipient) {
      return recipient.companyName;
    } else {
      return `${recipient.firstName} ${recipient.lastName}`;
    }
  };

  const getRecipientDisplayEmail = (
    recipient: ClientOption | JobseekerOption
  ): string => {
    if ("emailAddress1" in recipient) {
      return recipient.emailAddress1;
    } else {
      return recipient.email;
    }
  };

  const handleSubmit = async () => {
    if (step3Data.selectedRecipients.length === 0) {
      setError(t("consent.create.messages.selectRecipients"));
      return;
    }

    if (!step1Data.recipientType) {
      setError(t("consent.create.messages.invalidRecipientType"));
      return;
    }

    if (consentMode === "autofill" && !hasSelectedTemplate) {
      setError(t("consent.templates.messages.selectTemplate"));
      return;
    }

    if (consentMode === "standard") {
      if (documentSource === "new" && !step2Data.file) {
        setError(t("consent.create.messages.selectDocument"));
        return;
      }

      if (documentSource === "existing" && !step2Data.selectedDocumentPath) {
        setError(t("consent.create.messages.selectDocument"));
        return;
      }
    }

    if (!user?.id) {
      setError(t("consent.create.messages.authenticationRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let filePath: string;
      let fileName: string;

      if (consentMode === "autofill" && selectedTemplate) {
        filePath = selectedTemplate.filePath;
        fileName = selectedTemplate.fileName;
      } else {
        if (documentSource === "existing" && step2Data.selectedDocumentPath) {
          // Use existing document path
          filePath = step2Data.selectedDocumentPath;
        } else if (step2Data.file) {
          // Upload new file to Supabase storage
          const fileToUpload = step2Data.file;
          const fileExt = fileToUpload.name.split(".").pop();
          const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
          const uploadPath = `${user.id}/${Date.now()}/${uniqueFileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("consent-documents")
            .upload(uploadPath, fileToUpload);

          if (uploadError) {
            console.error("Supabase upload error:", uploadError);
            throw new Error(`Failed to upload document: ${uploadError.message}`);
          }

          filePath = uploadData?.path || uploadPath;
        } else {
          throw new Error(t("consent.create.messages.selectDocument"));
        }
        fileName = step2Data.fileName;
      }

      // Create the consent request with the file path
      const requestData: CreateConsentRequestData = {
        fileName,
        filePath: filePath,
        recipientIds: step3Data.selectedRecipients.map((r) => r.id),
        recipientType: step1Data.recipientType,
        consentMode,
        templateId: consentMode === "autofill" ? selectedTemplate?.id : undefined,
      };

      await createConsentRequest(requestData);
      setMessage(t("consent.create.messages.success"));

      // Navigate back to list after a delay
      setTimeout(() => {
        navigate("/consent-dashboard");
      }, 2000);
    } catch (err) {
      console.error("Error creating consent request:", err);
      setError(
        err instanceof Error ? err.message : t("consent.create.messages.failedToCreate")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
      setError(null);
    } else if (currentStep === 3) {
      setCurrentStep(2);
      setError(null);
      setRecipientSearch("");
    } else {
      navigate("/consent-dashboard");
    }
  };

  const handleStep2Next = () => {
    if (consentMode === "autofill") {
      if (!hasSelectedTemplate) {
        setError(t("consent.templates.messages.selectTemplate"));
        return;
      }
    } else {
      // Validate document selection before moving to step 3
      if (documentSource === "new" && !step2Data.file) {
        setError(t("consent.create.messages.selectDocument"));
        return;
      }

      if (documentSource === "existing" && !step2Data.selectedDocumentPath) {
        setError(t("consent.create.messages.selectDocument"));
        return;
      }
    }

    setError(null);
    setCurrentStep(3);
  };

  const isStep2Ready =
    consentMode === "autofill"
      ? hasSelectedTemplate
      : (documentSource === "new" && !!step2Data.file) ||
        (documentSource === "existing" && !!step2Data.selectedDocumentPath);

  const previewUrl = consentMode === "autofill" ? templatePdfUrl : standardPdfUrl;
  const previewDocumentName =
    consentMode === "autofill"
      ? selectedTemplate?.fileName || t("consent.create.defaultDocumentName")
      : step2Data.fileName || t("consent.create.defaultDocumentName");

  return (
    <div className="page-container">
      <AppHeader
        title=""
        actions={
          currentStep > 1 ? (
            <button
              className="button secondary button-icon"
              onClick={handleBack}
            >
              <ArrowLeft size={16} />
              <span>{t("buttons.back")}</span>
            </button>
          ) : null
        }
        statusMessage={message || error}
        statusType={error ? "error" : "success"}
      />

      <div className="content-container consent-management">
        {/* Dashboard-style heading */}
        <div className="dashboard-heading">
          <h1 className="dashboard-title">{t("consent.create.title")}</h1>
          <div className="user-role-badge">
            <FileText className="role-icon" />
            <span>{t("consent.create.uploadDocumentSelectRecipients")}</span>
          </div>
        </div>
        <p className="dashboard-subtitle">
          {t("consent.create.description")}
        </p>
        <div className="consent-creation-container">
          {/* Progress indicator */}
          <div className="progress-indicator card">
            <div
              className={`progress-step ${currentStep >= 1 ? "active" : ""}`}
            >
              <div className="step-number">1</div>
              <div className="step-label">{t("consent.create.steps.chooseType")}</div>
            </div>
            <div className="progress-line"></div>
            <div
              className={`progress-step ${currentStep >= 2 ? "active" : ""}`}
            >
              <div className="step-number">2</div>
              <div className="step-label">{t("consent.create.steps.selectDocument")}</div>
            </div>
            <div className="progress-line"></div>
            <div
              className={`progress-step ${currentStep >= 3 ? "active" : ""}`}
            >
              <div className="step-number">3</div>
              <div className="step-label">{t("consent.create.steps.selectRecipients")}</div>
            </div>
          </div>

          {/* Step 1: Choose recipient type */}
          {currentStep === 1 && (
            <div className="step-container animate-slide-in">
              <div className="card create-consent-card">
                <div className="card-header">
                  <h2>{t("consent.create.step1.title")}</h2>
                  <p>{t("consent.create.step1.description")}</p>
                </div>
                <div className="card-body">
                  <div className="recipient-type-selection">
                    <div
                      className={`recipient-type-card ${
                        step1Data.recipientType === "client" ? "selected" : ""
                      }`}
                      onClick={() => {
                        setStep1Data({ recipientType: "client" });
                        setCurrentStep(2);
                      }}
                    >
                      <div className="card-icon">
                        <Users size={28} />
                      </div>
                      <div className="recipient-type-card-content">
                        <h3>{t("consent.create.step1.clients")}</h3>
                        <p>{t("consent.create.step1.clientDescription")}</p>
                      </div>
                    </div>

                    <div
                      className={`recipient-type-card ${
                        step1Data.recipientType === "jobseeker_profile"
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => {
                        setStep1Data({ recipientType: "jobseeker_profile" });
                        setCurrentStep(2);
                      }}
                    >
                      <div className="card-icon">
                        <FileText size={28} />
                      </div>
                      <div className="recipient-type-card-content">
                        <h3>{t("consent.create.step1.jobseekers")}</h3>
                        <p>{t("consent.create.step1.jobseekerDescription")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

           {/* Step 2: Upload/Select Document */}
           {currentStep === 2 && (
             <div className="step-container animate-slide-in">
               <div className="card create-consent-card">
                 <div className="card-header">
                   <div>
                     <h2>{t("consent.create.step2.title")}</h2>
                     <p>
                       {t("consent.create.step2.description")}
                     </p>
                   </div>
                    <button
                      className="button primary button-icon"
                      onClick={handleStep2Next}
                      disabled={!isStep2Ready}
                    >
                     <span>{t("consent.create.step2.next")}</span>
                     <ArrowRight size={16} />
                   </button>
                 </div>
                <div className="card-body">
                  <div className="step2-layout-container">
                    {/* Left Side - Document Selection */}
                    <div className="step2-left-section">
                      <div className="form-section document-form-section">
                        <label className="form-label">
                          <Upload size={16} />
                          <span>
                            {consentMode === "autofill"
                              ? t("consent.create.step2.selectTemplateLabel")
                              : t("consent.create.step2.uploadDocument")}
                          </span>
                        </label>

                        <div className="consent-mode-selection">
                          <div className="consent-mode-label">
                            {t("consent.create.step2.consentTypeLabel")}
                          </div>
                          <div className="consent-mode-options">
                            <button
                              type="button"
                              className={`consent-mode-card ${
                                consentMode === "standard" ? "active" : ""
                              }`}
                              onClick={() => {
                                setConsentMode("standard");
                                setError(null);
                              }}
                            >
                              <span className="consent-mode-title">
                                {t("consent.create.step2.modeStandardTitle")}
                              </span>
                              <span className="consent-mode-description">
                                {t("consent.create.step2.modeStandardDescription")}
                              </span>
                            </button>
                            <button
                              type="button"
                              className={`consent-mode-card ${
                                consentMode === "autofill" ? "active" : ""
                              }`}
                              onClick={() => {
                                setConsentMode("autofill");
                                setError(null);
                              }}
                            >
                              <span className="consent-mode-title">
                                {t("consent.create.step2.modeAutofillTitle")}
                              </span>
                              <span className="consent-mode-description">
                                {t("consent.create.step2.modeAutofillDescription")}
                              </span>
                            </button>
                          </div>
                        </div>

                        {consentMode === "standard" ? (
                          <>
                            {/* Document Source Selection */}
                            <div className="document-source-selection">
                              <button
                                type="button"
                                className={`source-toggle-btn ${documentSource === "new" ? "active" : ""}`}
                                onClick={() => {
                                  setDocumentSource("new");
                                  setStep2Data((prev) => ({
                                    ...prev,
                                    selectedDocumentId: null,
                                    selectedDocumentPath: null,
                                    file: null,
                                    fileName: "",
                                  }));
                                  setStandardPdfUrl(null);
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
                                  setStep2Data((prev) => ({
                                    ...prev,
                                    file: null,
                                    fileName: "",
                                  }));
                                  setStandardPdfUrl(null);
                                  setError(null);
                                }}
                              >
                                <History size={16} />
                                <span>{t("consent.create.step2.useExisting")}</span>
                              </button>
                            </div>

                            {/* Existing Documents Selection */}
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
                                      const isSelected = step2Data.selectedDocumentId === doc.id;
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
                                              <span>
                                                {new Date(doc.createdAt).toLocaleDateString()}
                                              </span>
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

                            {/* New File Upload */}
                            {documentSource === "new" && (
                              <div className="file-upload-area">
                                <input
                                  type="file"
                                  id="document-upload"
                                  accept=".pdf"
                                  onChange={handleFileChange}
                                  className="file-input"
                                />
                                <label
                                  htmlFor="document-upload"
                                  className="file-upload-label"
                                >
                                  <Upload size={24} />
                                  <div className="upload-text">
                                    <span className="primary-text">
                                      {step2Data.file
                                        ? step2Data.file.name
                                        : t("consent.create.step2.clickToUpload")}
                                    </span>
                                    <span className="secondary-text">
                                      {step2Data.file
                                        ? t("consent.create.step2.clickToReplace")
                                        : t("consent.create.step2.pdfOnly")}
                                    </span>
                                  </div>
                                </label>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="existing-documents-section">
                            <div className="search-box">
                              <Search size={16} className="search-icon" />
                              <input
                                type="text"
                                placeholder={t("consent.templates.searchTemplates")}
                                value={templateSearch}
                                onChange={(e) => setTemplateSearch(e.target.value)}
                                className="search-input"
                              />
                            </div>
                            {loadingTemplates ? (
                              <div className="loading-state">
                                {t("consent.templates.loadingTemplates")}
                              </div>
                            ) : filteredTemplates.length === 0 ? (
                              <div className="empty-state">
                                {t("consent.templates.noTemplatesFound")}
                              </div>
                            ) : (
                              <div className="existing-documents-list">
                                {filteredTemplates.map((template) => {
                                  const isSelected = selectedTemplateId === template.id;
                                  return (
                                    <div
                                      key={template.id}
                                      className={`existing-document-item ${isSelected ? "selected" : ""}`}
                                      onClick={() => handleSelectTemplate(template)}
                                    >
                                      <div className="document-item-icon">
                                        <FileText size={20} />
                                      </div>
                                      <div className="document-item-info">
                                        <div className="document-item-name">
                                          {template.templateName}
                                        </div>
                                        <div className="document-item-date">
                                          <Clock size={12} />
                                          <span>{template.fileName}</span>
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
                      </div>
                    </div>

                    {/* Right Side - PDF Preview */}
                    <div className="step2-right-section">
                      <div className="form-section document-preview-section">
                        <label className="form-label">
                          <FileText size={16} />
                          <span>
                            {consentMode === "autofill"
                              ? t("consent.create.step2.templateSelectionTitle")
                              : t("consent.create.step2.documentPreview")}
                          </span>
                        </label>
                        {previewUrl ? (
                          <div className="pdf-preview-container-large">
                            {consentMode === "autofill" && selectedTemplate && (
                              <div className="template-mapper-hint">
                                {t("consent.create.step2.templateSelectedHint", {
                                  template: selectedTemplate.templateName,
                                })}
                              </div>
                            )}
                            <PDFThumbnail
                              pdfUrl={previewUrl}
                              onClick={() => setShowPdfModal(true)}
                            />
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
                            <p>
                              {consentMode === "autofill"
                                ? t("consent.create.step2.selectTemplateToPreview")
                                : t("consent.create.step2.selectDocumentToPreview")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {error && <div className="error-message">{error}</div>}

                  <div className="form-actions">
                    <button
                      className="button primary button-icon"
                      onClick={handleStep2Next}
                      disabled={!isStep2Ready}
                    >
                      <span>{t("consent.create.step2.next")}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Select Recipients */}
          {currentStep === 3 && (
            <div className="step-container animate-slide-in">
              <div className="card create-consent-card">
                <div className="card-header">
                  <h2>{t("consent.create.step3.title")}</h2>
                  <p>
                    {t("consent.create.step3.description")}
                  </p>
                </div>
                <div className="card-body">
                  <div className="form-section recipients-form-section">
                    <div className="recipients-section-header">
                      <label className="form-label">
                        <Users size={16} />
                        <span>
                          {t("consent.create.step3.selectedRecipients")} (
                          {step3Data.selectedRecipients.length})
                        </span>
                      </label>
                      <button
                        className="button secondary button-icon"
                        onClick={() => setShowRecipientModal(true)}
                      >
                        <Users size={16} />
                        <span>
                          {step3Data.selectedRecipients.length > 0
                            ? t("consent.create.step3.addMoreRecipients")
                            : t("consent.create.step3.selectRecipients")}
                        </span>
                      </button>
                    </div>

                    <div className="recipients-section">
                      {step3Data.selectedRecipients.length > 0 ? (
                        <div className="selected-recipients">
                          {step3Data.selectedRecipients.map((recipient) => (
                            <div
                              key={recipient.id}
                              className="recipient-chip"
                            >
                              <div className="recipient-info">
                                <span className="recipient-name">
                                  {getRecipientDisplayName(recipient)}
                                </span>
                                <span className="recipient-email">
                                  {getRecipientDisplayEmail(recipient)}
                                </span>
                              </div>
                              <button
                                className="remove-recipient-btn"
                                onClick={() =>
                                  handleRecipientRemove(recipient.id)
                                }
                                title={t(
                                  "consent.create.step3.removeRecipient"
                                )}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-recipients-state">
                          <Users size={48} />
                          <p>{t("consent.create.step3.noRecipientsSelected")}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {error && <div className="error-message">{error}</div>}

                  <div className="form-actions recipient-submit-button">
                    <button
                      className="button primary button-icon"
                      onClick={handleSubmit}
                      disabled={
                        loading ||
                        step3Data.selectedRecipients.length === 0
                      }
                    >
                      <Send size={16} />
                      <span>
                        {loading
                          ? t("consent.create.step3.creating")
                          : t("consent.create.step3.createRequest")}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recipients selection modal */}
          {showRecipientModal && (
            <div className="consent-modal">
              <div
                className="modal-overlay"
                onClick={() => setShowRecipientModal(false)}
              >
                <div
                  className="modal-content"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="modal-header">
                    <h3>
                      {step1Data.recipientType === "client"
                        ? t("consent.create.modal.selectClients")
                        : t("consent.create.modal.selectJobseekers")}
                    </h3>
                    <button
                      className="modal-close-btn"
                      onClick={() => setShowRecipientModal(false)}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="modal-body">
                    <div className="search-section">
                      <div className="search-box">
                        <Search size={16} className="search-icon" />
                        <input
                          type="text"
                          placeholder={`${t("consent.create.modal.search")} ${
                            step1Data.recipientType === "client"
                              ? t("consent.filters.client")
                              : t("consent.filters.jobseeker")
                          }...`}
                          value={recipientSearch}
                          onChange={(e) => setRecipientSearch(e.target.value)}
                          className="search-input"
                        />
                      </div>
                      <div className="select-all-section">
                        <button
                          className={`button secondary button-icon select-all-btn ${
                            step3Data.selectedRecipients.length > 0
                              ? "has-selections"
                              : ""
                          }`}
                          onClick={
                            areAllSelected ? handleUnselectAll : handleSelectAll
                          }
                          disabled={availableRecipients.length === 0}
                        >
                          <Users size={16} />
                          <span>
                            {areAllSelected
                              ? t("consent.create.modal.unselectAll")
                              : t("consent.create.modal.selectAll")}
                            {filteredRecipients.length > 0 &&
                              ` (${filteredRecipients.length})`}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="recipients-list">
                      {loadingRecipients ? (
                        <div className="loading-state">
                          {t("consent.create.modal.loadingRecipients")}
                        </div>
                      ) : filteredRecipients.length === 0 ? (
                        <div className="empty-state">
                          {recipientSearch
                            ? `${t("consent.create.modal.noMatch")} ${
                                step1Data.recipientType === "client"
                                  ? t("consent.filters.client")
                                  : t("consent.filters.jobseeker")
                              }`
                            : `${t("consent.create.modal.noFound")} ${
                                step1Data.recipientType === "client"
                                  ? t("consent.filters.client")
                                  : t("consent.filters.jobseeker")
                              }`}
                        </div>
                      ) : (
                        filteredRecipients.map((recipient) => {
                          const isSelected = step3Data.selectedRecipients.some(
                            (r: ClientOption | JobseekerOption) => r.id === recipient.id
                          );
                          return (
                            <div
                              key={recipient.id}
                              className={`recipient-option ${
                                isSelected ? "selected" : ""
                              }`}
                              onClick={() =>
                                isSelected
                                  ? handleRecipientRemove(recipient.id)
                                  : handleRecipientSelect(recipient)
                              }
                            >
                              <div className="recipient-details">
                                <div className="recipient-name">
                                  {getRecipientDisplayName(recipient)}
                                </div>
                                <div className="recipient-email">
                                  {getRecipientDisplayEmail(recipient)}
                                </div>
                              </div>
                              {isSelected && (
                                <div className="selected-indicator">{t("consent.create.selectedIndicator")}</div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      className="button secondary"
                      onClick={() => setShowRecipientModal(false)}
                    >
                      {t("consent.create.modal.close")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PDF Viewer Modal */}
          {showPdfModal && previewUrl && (
            <PDFViewerModal
              pdfUrl={previewUrl}
              documentName={previewDocumentName}
              isOpen={showPdfModal}
              onClose={() => setShowPdfModal(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
