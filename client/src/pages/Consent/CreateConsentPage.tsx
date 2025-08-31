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
} from "lucide-react";
import { createConsentRequest } from "../../services/api/consent";
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
  selectedRecipients: (ClientOption | JobseekerOption)[];
}

export function CreateConsentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Step 1 state
  const [step1Data, setStep1Data] = useState<Step1Data>({
    recipientType: null,
  });

  // Step 2 state
  const [step2Data, setStep2Data] = useState<Step2Data>({
    fileName: "",
    file: null,
    selectedRecipients: [],
  });

  // Recipients selection state
  const [availableRecipients, setAvailableRecipients] = useState<
    (ClientOption | JobseekerOption)[]
  >([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [showRecipientModal, setShowRecipientModal] = useState(false);

  // PDF preview state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Reset form when component mounts
  useEffect(() => {
    setCurrentStep(1);
    setStep1Data({ recipientType: null });
    setStep2Data({ fileName: "", file: null, selectedRecipients: [] });
    setError(null);
    setMessage(null);
  }, []);

  // Cleanup PDF URL when component unmounts
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

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
  }, [step1Data.recipientType]);

  // Fetch recipients and clear selection when recipient type changes
  useEffect(() => {
    if (step1Data.recipientType) {
      // Clear selected recipients and available recipients when switching types
      setStep2Data((prev) => ({
        ...prev,
        selectedRecipients: [],
      }));
      setAvailableRecipients([]);
      setRecipientSearch("");
      fetchRecipients();
    }
  }, [step1Data.recipientType, fetchRecipients]);

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
      setPdfUrl(url);

      setStep2Data((prev) => ({
        ...prev,
        file,
        fileName: file.name,
      }));
    }
  };

  const handleRecipientSelect = (recipient: ClientOption | JobseekerOption) => {
    const isAlreadySelected = step2Data.selectedRecipients.some(
      (r) => r.id === recipient.id
    );

    if (!isAlreadySelected) {
      setStep2Data((prev) => ({
        ...prev,
        selectedRecipients: [...prev.selectedRecipients, recipient],
      }));
    }
  };

  const handleRecipientRemove = (recipientId: string) => {
    setStep2Data((prev) => ({
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
        !step2Data.selectedRecipients.some(
          (selected) => selected.id === recipient.id
        )
    );

    setStep2Data((prev) => ({
      ...prev,
      selectedRecipients: [...prev.selectedRecipients, ...recipientsToAdd],
    }));
  };

  const handleUnselectAll = () => {
    // Unselect all filtered recipients
    const filteredIds = filteredRecipients.map((r) => r.id);
    setStep2Data((prev) => ({
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
      step2Data.selectedRecipients.some(
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
    if (!step2Data.file) {
      setError(t("consent.create.messages.selectDocument"));
      return;
    }

    if (step2Data.selectedRecipients.length === 0) {
      setError(t("consent.create.messages.selectRecipients"));
      return;
    }

    if (!step1Data.recipientType) {
      setError(t("consent.create.messages.invalidRecipientType"));
      return;
    }

    if (!user?.id) {
      setError(t("consent.create.messages.authenticationRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First, upload the file to Supabase storage
      const fileToUpload = step2Data.file;
      const fileExt = fileToUpload.name.split(".").pop();
      const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user.id}/${Date.now()}/${uniqueFileName}`;



      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("consent-documents")
        .upload(filePath, fileToUpload);

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        throw new Error(`Failed to upload document: ${uploadError.message}`);
      }



      // Now create the consent request with the actual file path
      const requestData = {
        fileName: step2Data.fileName,
        filePath: uploadData?.path || filePath,
        recipientIds: step2Data.selectedRecipients.map((r) => r.id),
        recipientType: step1Data.recipientType,
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
      // Clear recipients search when going back
      setRecipientSearch("");
    } else {
      navigate("/consent-dashboard");
    }
  };

  return (
    <div className="page-container">
      <AppHeader
        title=""
        actions={
          currentStep === 2 ? (
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
              <div className="step-label">{t("consent.create.steps.uploadSend")}</div>
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

          {/* Step 2: Upload document and select recipients */}
          {currentStep === 2 && (
            <div className="step-container animate-slide-in">
              <div className="card create-consent-card">
                <div className="card-header">
                  <h2>{t("consent.create.step2.title")}</h2>
                  <p>
                    {t("consent.create.step2.description")}
                  </p>
                </div>
                <div className="card-body">
                  <div className="step2-layout-container">
                    {/* Left Side - Recipients Selection */}
                    <div className="step2-left-section">
                      <div className="form-section recipients-form-section">
                        <div className="recipients-section-header">
                          <label className="form-label">
                            <Users size={16} />
                            <span>
                              {t("consent.create.step2.selectedRecipients")} (
                              {step2Data.selectedRecipients.length})
                            </span>
                          </label>
                          <button
                            className="button secondary button-icon"
                            onClick={() => setShowRecipientModal(true)}
                          >
                            <Users size={16} />
                            <span>
                              {step2Data.selectedRecipients.length > 0
                                ? t("consent.create.step2.addMoreRecipients")
                                : t("consent.create.step2.selectRecipients")}
                            </span>
                          </button>
                        </div>

                        <div className="recipients-section">
                          {step2Data.selectedRecipients.length > 0 && (
                            <div className="selected-recipients">
                              {step2Data.selectedRecipients.map((recipient) => (
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
                                      "consent.create.step2.removeRecipient"
                                    )}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side - Document Upload and Preview */}
                    <div className="step2-right-section">
                      <div className="form-section document-form-section">
                        <label className="form-label">
                          <Upload size={16} />
                          <span>
                            {t("consent.create.step2.uploadDocument")}
                          </span>
                        </label>
                        {/* PDF Preview Section */}
                        {step2Data.file && pdfUrl && (
                          <div className="pdf-preview-section">
                            <div className="pdf-preview-header">
                              <h4>
                                {t("consent.create.step2.documentPreview")}
                              </h4>
                              {/* <button
                                type="button"
                                className="button secondary button-icon"
                                onClick={() => setShowPdfModal(true)}
                              >
                                <Eye size={16} />
                                <span>{t("consent.create.step2.viewFullDocument")}</span>
                              </button> */}
                            </div>
                            <div className="pdf-preview-container">
                              <PDFThumbnail
                                pdfUrl={pdfUrl}
                                onClick={() => setShowPdfModal(true)}
                              />
                            </div>
                          </div>
                        )}
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
                      </div>
                    </div>
                  </div>

                  {error && <div className="error-message">{error}</div>}

                  <div className="form-actions recipient-submit-button">
                    <button
                      className="button primary button-icon"
                      onClick={handleSubmit}
                      disabled={
                        loading ||
                        !step2Data.file ||
                        step2Data.selectedRecipients.length === 0
                      }
                    >
                      <Send size={16} />
                      <span>
                        {loading
                          ? t("consent.create.step2.creating")
                          : t("consent.create.step2.createRequest")}
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
                            step2Data.selectedRecipients.length > 0
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
                          const isSelected = step2Data.selectedRecipients.some(
                            (r) => r.id === recipient.id
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
          {showPdfModal && (
            <PDFViewerModal
              pdfUrl={pdfUrl}
                             documentName={step2Data.fileName || t("consent.create.defaultDocumentName")}
              isOpen={showPdfModal}
              onClose={() => setShowPdfModal(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
