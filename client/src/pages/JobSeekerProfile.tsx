import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  ArrowLeft,
  User,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Download,
  Eye,
  FileWarning,
  Trash2,
  Pencil,
  AlertCircle,
  CheckSquare,
  Shield,
  CircleAlert,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import {
  getJobseekerProfile,
  updateJobseekerStatus,
  deleteJobseeker,
} from "../services/api";
import { DocumentRecord } from "../types/jobseeker";
import { supabase } from "../lib/supabaseClient";
import PDFThumbnail from "../components/PDFThumbnail";
import PDFViewerModal from "../components/PDFViewerModal";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { AppHeader } from "../components/AppHeader";
import "../styles/components/header.css";
import "../styles/pages/JobseekerProfileStyles.css";

// Define a local comprehensive type reflecting the backend response
// TODO: Move this to shared types (e.g., client/src/types/jobseeker.ts) and update JobSeekerDetailedProfile
interface FullJobseekerProfile {
  id: string;
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  dob?: string | null;
  email?: string | null;
  mobile?: string | null;
  licenseNumber?: string | null; // Potentially encrypted
  passportNumber?: string | null; // Potentially encrypted
  sinNumber?: string | null; // Potentially encrypted
  sinExpiry?: string | null;
  businessNumber?: string | null; // Potentially encrypted
  corporationName?: string | null;
  street?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  workPreference?: string | null;
  bio?: string | null; // Brief professional description (max 100 chars)
  licenseType?: string | null;
  experience?: string | null;
  manualDriving?: "NA" | "Yes" | "No" | null;
  availability?: "Full-Time" | "Part-Time" | null;
  weekendAvailability?: boolean | null;
  payrateType?: "Hourly" | "Daily" | "Monthly" | null;
  billRate?: string | null;
  payRate?: string | null;
  paymentMethod?: string | null;
  hstGst?: string | null;
  cashDeduction?: string | null;
  overtimeEnabled?: boolean | null;
  overtimeHours?: string | null;
  overtimeBillRate?: string | null;
  overtimePayRate?: string | null;
  documents?: DocumentRecord[] | null;
  verificationStatus?: "pending" | "verified" | "rejected" | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdById?: string | null; // Legacy field
  createdByUserId?: string | null; // New field for creator user ID
  updatedByUserId?: string | null; // New field for last updater user ID
  creatorDetails?: {
    id: string;
    email: string;
    name: string;
    userType: string;
    createdAt: string;
  } | null; // New field for creator details
  updaterDetails?: {
    id: string;
    email: string;
    name: string;
    userType: string;
    updatedAt: string;
  } | null; // New field for updater details
  rejectionReason?: string | null;
  employeeId?: string | null;
  // Add any other potential fields from the DB
}

// Helper function to generate display name
const getDisplayName = (profile: FullJobseekerProfile | null): string => {
  if (!profile) return "Unknown User";
  return (
    `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
    "Unnamed Profile"
  );
};

// Helper function to generate display location
const getDisplayLocation = (
  profile: FullJobseekerProfile | null
): string | undefined => {
  if (!profile) return undefined;
  const parts = [profile.city, profile.province].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
};

// Helper function to check if profile needs attention based on document validation issues
const profileNeedsAttention = (profile: FullJobseekerProfile | null): boolean => {
  // Only check for pending profiles
  if (!profile || profile.verificationStatus !== "pending") return false;
  
  // Check if profile has documents with AI validation issues
  if (!profile.documents || profile.documents.length === 0) return false;
  
  return profile.documents.some(doc => {
    if (!doc.aiValidation) return false;
    
    return (
      doc.aiValidation.is_tampered === true ||
      doc.aiValidation.is_blurry === true ||
      doc.aiValidation.is_text_clear === false ||
      doc.aiValidation.is_resubmission_required === true
    );
  });
};

// Helper function to decode HTML entities for slashes
const decodePath = (path: string | undefined): string | undefined => {
  return path ? path.replace(/&#x2F;/g, "/") : undefined;
};

// Type for our PDF cache
interface PDFCache {
  [key: string]: string | null;
}

export function JobSeekerProfile() {
  const [profile, setProfile] = useState<FullJobseekerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfName, setSelectedPdfName] = useState<string>("Document");
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [pdfCache, setPdfCache] = useState<PDFCache>({});
  const [loadingPdfs, setLoadingPdfs] = useState<boolean>(false);
  const [isEditConfirmationOpen, setIsEditConfirmationOpen] =
    useState<boolean>(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<
    "pending" | "verified" | "rejected"
  >("pending");
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [rejectionReasonError, setRejectionReasonError] = useState<string | null>(null);
  const [expandedNotesIds, setExpandedNotesIds] = useState<Set<string>>(
    new Set()
  );
  const [showFullRejectionReason, setShowFullRejectionReason] = useState<boolean>(false);
  const { id } = useParams<{ id: string }>();
  const { isAdmin, isRecruiter, isJobSeeker } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        if (!id) throw new Error("Profile ID is missing");
        const data = await getJobseekerProfile(id);
        console.log("Fetched detailed profile:", data);
        setProfile(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while fetching the profile"
        );
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProfile();
    }
  }, [id, isAdmin, isRecruiter, navigate]);

  useEffect(() => {
    if (profile?.verificationStatus) {
      setSelectedStatus(
        profile.verificationStatus as "pending" | "verified" | "rejected"
      );
    }
  }, [profile?.verificationStatus]);

  // Effect to load all PDFs once profile is loaded and has documents
  useEffect(() => {
    if (profile?.documents && profile.documents.length > 0) {
      const loadAllPdfs = async () => {
        setLoadingPdfs(true);
        const newCache: PDFCache = {};

        try {
          // Process all documents in parallel
          await Promise.all(
            // Use optional chaining to safely access documents
            profile.documents?.map(async (doc) => {
              if (doc.documentPath) {
                try {
                  const signedUrl = await getSignedUrl(doc.documentPath);
                  newCache[doc.documentPath] = signedUrl;
                } catch (err) {
                  console.error(
                    `Error getting signed URL for ${doc.documentPath}:`,
                    err
                  );
                  newCache[doc.documentPath] = null;
                }
              }
            }) || []
          );

          setPdfCache(newCache);
        } catch (err) {
          console.error("Error loading PDFs:", err);
        } finally {
          setLoadingPdfs(false);
        }
      };

      loadAllPdfs();
    }
  }, [profile?.documents]);

  const handleStatusUpdate = async (
    newStatus: "verified" | "rejected" | "pending"
  ) => {
    if (!profile || !id) return;

    // Clear previous error
    setRejectionReasonError(null);

    // Require rejection reason when rejecting a profile
    if (newStatus === "rejected" && !rejectionReason.trim()) {
      setRejectionReasonError("Please provide a reason for rejection");
      return;
    }

    try {
      setUpdateStatus("Updating status...");
      const response = await updateJobseekerStatus(id, newStatus, newStatus === "rejected" ? rejectionReason : null);

      // Check the structure of the response to find the correct property
      console.log("Status update response:", response);

      // Preserve the original documents with AI validation data
      const preservedDocuments = profile.documents || [];

      // If response includes profile data with the updated status
      if (response.profile) {
        // Make sure we preserve the correct structure and documents
        setProfile({
          ...profile,
          ...response.profile,
          // Keep the original documents with AI validation intact
          documents: preservedDocuments,
          verificationStatus:
            response.profile.status ||
            response.profile.verificationStatus ||
            newStatus,
          rejectionReason: newStatus === "rejected" ? rejectionReason : null,
        });
      } else {
        // If direct response or unknown structure, just update the local status
        setProfile({
          ...profile,
          verificationStatus: newStatus,
          rejectionReason: newStatus === "rejected" ? rejectionReason : null,
        });
      }

      // Clear rejection reason after successful update
      if (newStatus === "rejected") {
        setRejectionReason("");
      }

      setUpdateStatus(`Profile status updated to ${newStatus}`);

      setTimeout(() => setUpdateStatus(null), 3000);
    } catch (err) {
      setUpdateStatus(
        err instanceof Error ? err.message : "Failed to update status"
      );
      console.error("Error updating status:", err);

      setTimeout(() => setUpdateStatus(null), 3000);
    }
  };

  const getStatusIcon = () => {
    const status = profile?.verificationStatus || "pending";

    switch (status) {
      case "verified":
        return <CheckCircle className="status-icon verified" />;
      case "rejected":
        return <XCircle className="status-icon rejected" />;
      case "pending":
        return <Clock className="status-icon pending" />;
      default:
        return <Clock className="status-icon pending" />; // Default to pending icon
    }
  };

  const formatDate = (dateString?: string | null, showTime: boolean = true) => {
    if (!dateString) return "N/A";
    try {
      // Setup options based on whether to show time
      const options: Intl.DateTimeFormatOptions = {
        timeZone: "America/Toronto",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        ...(showTime && {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
      };

      let date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString("en-CA", options);
      }

      const datePart = dateString.split("T")[0];
      date = new Date(datePart + "T00:00:00Z");
      if (!isNaN(date.getTime())) {
        return date.toLocaleString("en-CA", options);
      }
    } catch (e) {
      console.warn(`Failed to parse date: ${dateString}`, e);
    }
    return dateString;
  };

  // Function to get signed URL for a document (for preview)
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

  // Function to handle previewing a document
  const handlePreviewDocument = async (
    documentPath?: string | null,
    documentFileName?: string | null
  ) => {
    if (!documentPath) {
      setDownloadError("Document path is missing.");
      setTimeout(() => setDownloadError(null), 3000);
      return;
    }

    try {
      // Use the cached signed URL if available
      const signedUrl =
        pdfCache[documentPath] || (await getSignedUrl(documentPath));

      if (signedUrl) {
        setSelectedPdfUrl(signedUrl);
        setSelectedPdfName(documentFileName || "Document");
        setIsPdfModalOpen(true);

        // Cache the URL if not already cached
        if (!pdfCache[documentPath]) {
          setPdfCache({
            ...pdfCache,
            [documentPath]: signedUrl,
          });
        }
      } else {
        throw new Error("Could not generate preview URL.");
      }
    } catch (err) {
      console.error("Error preparing document preview:", err);
      setDownloadError(
        err instanceof Error ? err.message : "Could not preview the document."
      );
      setTimeout(() => setDownloadError(null), 5000);
    }
  };

  const handleDownloadDocument = async (
    documentPath?: string | null,
    docId?: string,
    documentFileName?: string
  ) => {
    if (!documentPath) {
      setDownloadError("Document path is missing.");
      setTimeout(() => setDownloadError(null), 3000);
      return;
    }

    // Set loading state for this specific document
    setDownloadingDocId(docId || "unknown");
    setDownloadError(null);

    try {
      // Use cached URL if available or get a new one
      let signedUrl = pdfCache[documentPath];

      if (!signedUrl) {
        // Decode the path before using it
        const decodedPath = decodePath(documentPath);

        console.log(`Download requested for path: '${documentPath}'`);
        console.log(`Using decoded path: '${decodedPath}'`);

        if (!decodedPath) {
          throw new Error("Document path is missing or invalid.");
        }

        // Generate a signed URL (expires in 300 seconds)
        const { data, error } = await supabase.storage
          .from("jobseeker-documents")
          .createSignedUrl(decodedPath, 300); // 5 minutes expiry

        if (error) {
          console.error("Supabase download URL error:", error);
          throw error;
        }

        signedUrl = data?.signedUrl || null;

        // Cache the URL
        if (signedUrl) {
          setPdfCache({
            ...pdfCache,
            [documentPath]: signedUrl,
          });
        }
      }

      if (signedUrl) {
        console.log("Download URL generated:", signedUrl);

        // Create a temporary anchor element to trigger download
        const downloadLink = document.createElement("a");
        downloadLink.href = signedUrl;

        // Use the documentFileName if provided, otherwise extract from path or use a default
        let filename = "document.pdf";
        if (documentFileName) {
          filename = documentFileName;
        } else {
          const pathFilename = documentPath.split("/").pop();
          if (pathFilename) filename = pathFilename;
        }

        downloadLink.download = filename;

        // Append to body, click, and remove to trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      } else {
        throw new Error("Could not retrieve signed URL for download.");
      }
    } catch (err) {
      console.error("Error in handleDownloadDocument:", err);
      setDownloadError(
        err instanceof Error ? err.message : "Could not download the document."
      );
      setTimeout(() => setDownloadError(null), 5000); // Clear error after 5 seconds
    } finally {
      setDownloadingDocId(null); // Clear loading state
    }
  };

  const handleEditProfile = () => {
    if (!id) return;

    // If the user is a jobseeker, show confirmation dialog
    if (isJobSeeker) {
      setIsEditConfirmationOpen(true);
    } else {
      // For recruiters/admins, go directly to edit
      navigate(`/jobseekers/${id}/edit`);
    }
  };

  const confirmEdit = () => {
    // Close the modal and navigate to the edit page
    setIsEditConfirmationOpen(false);
    if (id) {
      navigate(`/jobseekers/${id}/edit`);
    }
  };

  const handleDeleteProfile = () => {
    if (!id) return;
    setIsDeleteConfirmationOpen(true);
  };

  const confirmDelete = async () => {
    if (!id) return;

    try {
      setIsDeleting(true);
      await deleteJobseeker(id);
      setIsDeleteConfirmationOpen(false);
      navigate("/jobseekers", {
        state: { message: "Profile deleted successfully" },
      });
    } catch (err) {
      console.error("Error deleting profile:", err);
      setUpdateStatus(
        err instanceof Error ? err.message : "Failed to delete profile"
      );
      setTimeout(() => setUpdateStatus(null), 3000);
      setIsDeleting(false);
    }
  };

  const openStatusModal = () => {
    // Set the current status from profile
    setSelectedStatus(
      (profile?.verificationStatus as "pending" | "verified" | "rejected") ||
        "pending"
    );
    
    // If profile is rejected, prefill the rejection reason from profile data
    if (profile?.verificationStatus === "rejected" && profile?.rejectionReason) {
      setRejectionReason(profile.rejectionReason);
    } else {
      // Otherwise clear the rejection reason
      setRejectionReason("");
    }
    
    // Clear any error message
    setRejectionReasonError(null);
    
    setIsStatusModalOpen(true);
  };

  const handleUpdateStatusFromModal = () => {
    // If status is rejected and no reason is provided, show error but don't close the modal
    if (selectedStatus === "rejected" && !rejectionReason.trim()) {
      setRejectionReasonError("Please provide a reason for rejection");
      return;
    }
    
    // Clear any error before proceeding
    setRejectionReasonError(null);
    
    // Only proceed with status update and close modal if validation passes
    handleStatusUpdate(selectedStatus);
    setIsStatusModalOpen(false);
  };

  const toggleNotes = (docId?: string) => {
    if (!docId) return;

    setExpandedNotesIds((prevIds) => {
      const newIds = new Set(prevIds);
      if (newIds.has(docId)) {
        newIds.delete(docId);
      } else {
        newIds.add(docId);
      }
      return newIds;
    });
  };

  // Helper function to get score color class based on percentage
  const getScoreColorClass = (percentage: number): string => {
    if (percentage >= 80) return "success";
    if (percentage >= 40) return "pending";
    return "failure";
  };

  const renderRejectionReason = () => {
    if (profile?.verificationStatus !== "rejected" || !profile?.rejectionReason) {
      return null;
    }
    
    const showToggle = profile.rejectionReason.length > 200;
    
    return (
      <div className="profile-rejection-reason">
        <div className="rejection-reason-header">
          <AlertCircle size={16} className="rejection-reason-icon" />
          <span className="rejection-reason-title">Rejection Reason</span>
        </div>
        <div className={`rejection-reason-content ${showFullRejectionReason ? 'expanded' : ''}`}>
          {profile.rejectionReason}
        </div>
        {showToggle && (
          <button 
            className="toggle-rejection-btn"
            onClick={() => setShowFullRejectionReason(!showFullRejectionReason)}
          >
            {showFullRejectionReason ? 'Show less' : 'Show full reason'}
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-container">
          <span className="loading-spinner"></span>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="profile-container">
        <div className="error-container">
          <p className="error-message">{error || "Failed to load profile"}</p>
          <div className="error-actions">
            <button className="button " onClick={() => navigate("/jobseekers")}>
              Back to List
            </button>
            <button
              className="button primary"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderDetailItem = (
    label: string,
    value?: string | number | boolean | null
  ) => {
    const displayValue =
      value === null || value === undefined || value === ""
        ? "N/A"
        : typeof value === "boolean"
        ? value
          ? "Yes"
          : "No"
        : value;

    let finalDisplayValue: string | number = displayValue;
    if (typeof displayValue === "string" && displayValue !== "N/A") {
      if (
        [
          "licenseNumber",
          "passportNumber",
          "sinNumber",
          "businessNumber",
        ].includes(label.toLowerCase().replace(/ /g, ""))
      ) {
        finalDisplayValue =
          displayValue.length > 20 ? "********" : displayValue;
      }
    }

    return (
      <div className="detail-item">
        <p className="detail-label">{label}:</p>
        <p className="detail-value">{finalDisplayValue}</p>
      </div>
    );
  };

  const displayName = getDisplayName(profile);
  const displayLocation = getDisplayLocation(profile);

  return (
    <div className="profile-container">
      <AppHeader
        title="Job Seeker Profile"
        actions={
          <button className="button" onClick={() => navigate("/jobseeker-management")}>
            <ArrowLeft size={16} />
            <span>{isJobSeeker ? "Back to Dashboard" : "Back to Job Seeker Management"}</span>
          </button>
        }
        statusMessage={updateStatus}
      />

      <main className="profile-main">
        <div className="profile-overview section-card">
          <div className="profile-banner">
            <div className="profile-banner-status-container">
              <div
                className={`profile-status ${
                  profile?.verificationStatus || "pending"
                }`}
              >
                {getStatusIcon()}
                <span
                  className={`status-text ${
                    profile?.verificationStatus || "pending"
                  }`}
                >
                  {profile?.verificationStatus
                    ? `Status: ${
                        profile.verificationStatus.charAt(0).toUpperCase() +
                        profile.verificationStatus.slice(1)
                      }`
                    : "Status: Pending"}
                </span>
              </div>
              {profileNeedsAttention(profile) && (
                <div className="profile-status need-attention">
                  <AlertTriangle className="status-icon need-attention" size={16} />
                  <span className="status-text need-attention">
                    Needs Attention
                  </span>
                </div>
              )}
            </div>
            <div className="profile-actions-container">
              {(isAdmin || isRecruiter) && (
                <div className="profile-actions">
                  <button
                    className="action-icon-btn update-status-btn"
                    onClick={openStatusModal}
                    title="Update status"
                    aria-label="Update status"
                  >
                    <span className="status-text">Update Status</span>{" "}
                    <RefreshCw size={16} />
                  </button>
                </div>
              )}
              <div className="profile-actions">
                <button
                  className="action-icon-btn edit-btn"
                  onClick={handleEditProfile}
                  title="Edit this profile"
                  aria-label="Edit profile"
                >
                  <Pencil size={20} />
                </button>
                {(isAdmin || isRecruiter) && (
                  <button
                    className="action-icon-btn delete-btn"
                    onClick={handleDeleteProfile}
                    title="Delete this profile"
                    aria-label="Delete profile"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="profile-details">
            {renderRejectionReason()}
            <div className="profile-avatar-container">
              <div className="profile-avatar">
                <User size={40} />
              </div>
              <h1 className="profile-name">{displayName}</h1>
            </div>
            <div className="profile-info-header">
              <div className="profile-info-details">
                {renderDetailItem("Employee ID", profile.employeeId)}
                {renderDetailItem("Email", profile.email)}
                {renderDetailItem("Phone", profile.mobile)}
              </div>
              <div className="profile-info-details">
                {renderDetailItem("Location", displayLocation)}
                {renderDetailItem("Joined", formatDate(profile.createdAt))}
              </div>
              <div className="profile-info-details">
                {renderDetailItem(
                  "Last Updated",
                  formatDate(profile.updatedAt)
                )}
                {renderDetailItem("DOB", formatDate(profile.dob, false))}
              </div>
            </div>
          </div>
        </div>
        <div className="documents-section section-card">
          <h2 className="section-title">Uploaded Documents</h2>
          {downloadError && (
            <div className="error-message download-error">
              <p>{downloadError}</p>
            </div>
          )}
          {loadingPdfs && (
            <div className="loading-pdfs">
              <div className="pdf-loading-spinner"></div>
              <p>Loading document previews...</p>
            </div>
          )}
          {profile?.documents && profile.documents.length > 0 ? (
            <div className="document-list">
              {(profile.documents || []).map(
                (doc: DocumentRecord, index: number) => {
                  const scoreClass = getScoreColorClass(
                    doc.aiValidation?.document_authentication_percentage || 0
                  );
                  return (
                    <div key={doc.id || index} className="document-item">
                      <div className="document-content">
                        <FileText size={18} className="document-icon" />
                        <div className="document-info">
                          <p
                            className="document-name"
                            title={doc.documentFileName}
                          >
                            {doc.documentFileName || "Unnamed Document"}
                          </p>
                          <p className="document-type">
                            Type: {doc.documentType}
                          </p>
                          {doc.documentTitle && (
                            <p className="document-title">
                              Title: {doc.documentTitle}
                            </p>
                          )}
                          {doc.documentNotes && (
                            <p className="document-notes">
                              Notes: {doc.documentNotes}
                            </p>
                          )}

                          <div className="document-actions">
                            <button
                              onClick={() =>
                                handlePreviewDocument(
                                  doc.documentPath,
                                  doc.documentFileName
                                )
                              }
                              className="button primary"
                            >
                              <Eye size={16} /> Preview
                            </button>
                            <button
                              onClick={() =>
                                handleDownloadDocument(
                                  doc.documentPath,
                                  doc.id,
                                  doc.documentFileName
                                )
                              }
                              className="button primary"
                              disabled={downloadingDocId === doc.id}
                            >
                              {downloadingDocId === doc.id ? (
                                <>
                                  <span className="download-spinner"></span>{" "}
                                  Downloading...
                                </>
                              ) : (
                                <>
                                  <Download size={16} /> Download
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* AI Document Validation - Now with consistent data from cache */}
                        <div className="document-validation">
                          <div className="validation-header">
                            <Shield size={16} />
                            <h3>AI Document Validation</h3>
                          </div>

                          {doc.aiValidation === null ? (
                            // Fallback UI when AI validation is null/in progress
                            <div className="validation-in-progress">
                              <div className="validation-loading">
                                <div className="validation-spinner">
                                  <div className="validation-spinner-inner"></div>
                                </div>
                              </div>
                              <h4 className="validation-progress-title">
                                AI Validation in Progress
                              </h4>
                              <p className="validation-progress-message">
                                Our AI is analyzing this document for
                                authenticity and quality. This process typically
                                takes a few minutes.
                              </p>
                              <p className="validation-progress-note">
                                Please check back later for the complete
                                analysis results.
                              </p>
                            </div>
                          ) : (
                            // Regular UI when AI validation data is available
                            <>
                              <div className="authentication-score">
                                <div className="score-gauge">
                                  <div
                                    className={`score-fill ${scoreClass}`}
                                    style={{
                                      width: `${doc.aiValidation?.document_authentication_percentage}%`,
                                    }}
                                  ></div>
                                  <span className="score-value">
                                    {
                                      doc.aiValidation
                                        ?.document_authentication_percentage
                                    }
                                    %
                                  </span>
                                </div>
                                <span className="score-label">
                                  Authentication Score
                                </span>
                              </div>

                              <div className="validation-status-list">
                                <div
                                  className={`validation-status-item ${
                                    !doc.aiValidation?.is_tampered
                                      ? "valid"
                                      : "invalid"
                                  }`}
                                >
                                  {!doc.aiValidation?.is_tampered ? (
                                    <CheckSquare size={16} />
                                  ) : (
                                    <CircleAlert size={16} />
                                  )}
                                  <span>
                                    {!doc.aiValidation?.is_tampered
                                      ? "Not Tampered"
                                      : "Tampered"}
                                  </span>
                                </div>
                                <div
                                  className={`validation-status-item ${
                                    !doc.aiValidation?.is_blurry
                                      ? "valid"
                                      : "invalid"
                                  }`}
                                >
                                  {!doc.aiValidation?.is_blurry ? (
                                    <CheckSquare size={16} />
                                  ) : (
                                    <CircleAlert size={16} />
                                  )}
                                  <span>
                                    {!doc.aiValidation?.is_blurry
                                      ? "Not Blurry"
                                      : "Blurry"}
                                  </span>
                                </div>
                                <div
                                  className={`validation-status-item ${
                                    doc.aiValidation?.is_text_clear
                                      ? "valid"
                                      : "invalid"
                                  }`}
                                >
                                  {doc.aiValidation?.is_text_clear ? (
                                    <CheckSquare size={16} />
                                  ) : (
                                    <CircleAlert size={16} />
                                  )}
                                  <span>
                                    {doc.aiValidation?.is_text_clear
                                      ? "Text Clear"
                                      : "Text Unclear"}
                                  </span>
                                </div>
                                <div
                                  className={`validation-status-item ${
                                    !doc.aiValidation?.is_resubmission_required
                                      ? "valid"
                                      : "invalid"
                                  }`}
                                >
                                  {!doc.aiValidation
                                    ?.is_resubmission_required ? (
                                    <CheckSquare size={16} />
                                  ) : (
                                    <CircleAlert size={16} />
                                  )}
                                  <span>
                                    {!doc.aiValidation?.is_resubmission_required
                                      ? "No Resubmission Required"
                                      : "Resubmission Required"}
                                  </span>
                                </div>
                              </div>

                              <div className="validation-notes">
                                <div className="validation-notes-header">
                                  <AlertCircle size={14} />
                                  <span>AI Analysis Notes</span>
                                </div>
                                <p
                                  className={`validation-notes-content ${
                                    expandedNotesIds.has(doc.id || "")
                                      ? "expanded"
                                      : ""
                                  }`}
                                >
                                  {doc.aiValidation?.notes}
                                </p>
                                <button
                                  className="toggle-notes-btn"
                                  onClick={() => toggleNotes(doc.id)}
                                >
                                  {expandedNotesIds.has(doc.id || "")
                                    ? "Show less"
                                    : "Show full notes"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="document-preview">
                        {doc.documentPath ? (
                          <PDFThumbnail
                            pdfUrl={pdfCache[doc.documentPath] || null}
                            onClick={() =>
                              handlePreviewDocument(
                                doc.documentPath,
                                doc.documentFileName
                              )
                            }
                          />
                        ) : (
                          <div className="document-preview-placeholder">
                            <FileWarning
                              size={24}
                              className="document-preview-placeholder-icon"
                            />
                            <span>No preview available</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            <p className="empty-documents">No documents uploaded.</p>
          )}
        </div>
        <div className="profile-content grid-container">
          <div className="personal-details-section section-card">
            <h2 className="section-title">Personal Information</h2>
            <div className="detail-group">
              {renderDetailItem("First Name", profile.firstName)}
              {renderDetailItem("Last Name", profile.lastName)}
              {renderDetailItem("Email", profile.email)}
              {renderDetailItem("Mobile", profile.mobile)}
              {renderDetailItem(
                "Date of Birth",
                formatDate(profile.dob, false)
              )}
            </div>
          </div>

          <div className="identification-section section-card">
            <h2 className="section-title">Identification</h2>
            <div className="detail-group">
              {renderDetailItem("License Number", profile.licenseNumber)}
              {renderDetailItem("Passport Number", profile.passportNumber)}
              {renderDetailItem("SIN Number", profile.sinNumber)}
              {renderDetailItem(
                "SIN Expiry",
                formatDate(profile.sinExpiry, false)
              )}
              {renderDetailItem("Business Number", profile.businessNumber)}
              {renderDetailItem("Corporation Name", profile.corporationName)}
            </div>
          </div>

          <div className="address-section section-card">
            <h2 className="section-title">Address</h2>
            <div className="detail-group">
              {renderDetailItem("Street", profile.street)}
              {renderDetailItem("City", profile.city)}
              {renderDetailItem("Province", profile.province)}
              {renderDetailItem("Postal Code", profile.postalCode)}
            </div>
          </div>

          <div className="qualifications-section section-card">
            <h2 className="section-title">Qualifications</h2>
            <div className="detail-group">
              {renderDetailItem("Work Preference", profile?.workPreference)}
              {renderDetailItem("Bio", profile?.bio)}
              {renderDetailItem("License Type", profile?.licenseType)}
              {renderDetailItem("Experience", profile?.experience)}
              {renderDetailItem("Manual Driving", profile?.manualDriving)}
              {renderDetailItem("Availability", profile?.availability)}
              {renderDetailItem(
                "Weekend Availability",
                profile?.weekendAvailability
              )}
            </div>
          </div>

          <div className="compensation-section section-card">
            <h2 className="section-title">Compensation</h2>
            <div className="detail-group">
              {renderDetailItem("Payrate Type", profile.payrateType)}
              {renderDetailItem("Bill Rate", profile.billRate)}
              {renderDetailItem("Pay Rate", profile.payRate)}
              {renderDetailItem("Payment Method", profile.paymentMethod)}
              {renderDetailItem("HST/GST", profile.hstGst)}
              {renderDetailItem("Cash Deduction", profile.cashDeduction)}
              {renderDetailItem("Overtime Enabled", profile.overtimeEnabled)}
              {profile.overtimeEnabled && (
                <>
                  {renderDetailItem(
                    "Overtime Hours After",
                    profile.overtimeHours
                  )}
                  {renderDetailItem(
                    "Overtime Bill Rate",
                    profile.overtimeBillRate
                  )}
                  {renderDetailItem(
                    "Overtime Pay Rate",
                    profile.overtimePayRate
                  )}
                </>
              )}
            </div>
          </div>

          <div className="meta-section section-card">
            <h2 className="section-title">Meta Information</h2>
            <div className="detail-group">
              {profile.creatorDetails ? (
                <div className="detail-section">
                  <h3>Created By</h3>
                  {renderDetailItem("Name", profile.creatorDetails.name)}
                  {renderDetailItem("Email", profile.creatorDetails.email)}
                  {renderDetailItem(
                    "User Type",
                    profile.creatorDetails.userType
                  )}
                  {renderDetailItem(
                    "Account Created At",
                    formatDate(profile.creatorDetails.createdAt)
                  )}
                </div>
              ) : null}

              {profile.updaterDetails ? (
                <div className="detail-section">
                  <h3>Last Updated By</h3>
                  {renderDetailItem("Name", profile.updaterDetails.name)}
                  {renderDetailItem("Email", profile.updaterDetails.email)}
                  {renderDetailItem(
                    "User Type",
                    profile.updaterDetails.userType
                  )}
                  {renderDetailItem(
                    "Last Updated At",
                    formatDate(profile.updaterDetails.updatedAt)
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      {/* PDF Viewer Modal */}
      <PDFViewerModal
        pdfUrl={selectedPdfUrl}
        documentName={selectedPdfName}
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
      />

      {/* Edit Confirmation Modal for Jobseekers */}
      <ConfirmationModal
        isOpen={isEditConfirmationOpen}
        title="Profile Status Change Notice"
        message="Editing your profile will reset your verification status to 'pending'. While your profile is in pending status, it will not be visible to employers until our team reviews and approves the changes. Do you want to proceed to the edit page?"
        confirmText="Yes, Continue to Edit"
        cancelText="Cancel"
        confirmButtonClass="primary"
        onConfirm={confirmEdit}
        onCancel={() => setIsEditConfirmationOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteConfirmationOpen}
        title="Delete Profile"
        message={`Are you sure you want to delete this profile? This action cannot be undone.`}
        confirmText={isDeleting ? "Deleting..." : "Delete Profile"}
        cancelText="Cancel"
        confirmButtonClass="danger"
        onConfirm={confirmDelete}
        onCancel={() => setIsDeleteConfirmationOpen(false)}
      />

      {/* Status Update Modal */}
      <div
        className={`modal ${isStatusModalOpen ? "open" : ""}`}
        onClick={() => setIsStatusModalOpen(false)}
      >
        <div
          className="status-modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3>Update Profile Status</h3>
            <button
              className="close-button"
              onClick={() => setIsStatusModalOpen(false)}
            >
              <XCircle size={20} />
            </button>
          </div>
          <div className="modal-body">
            <div className="status-options">
              <div className="status-option">
                <input
                  type="radio"
                  id="status-verified"
                  name="status"
                  value="verified"
                  checked={selectedStatus === "verified"}
                  onChange={() => setSelectedStatus("verified")}
                  disabled={profile?.verificationStatus === "verified"}
                />
                <label
                  htmlFor="status-verified"
                  className={`status-label ${
                    profile?.verificationStatus === "verified" ? "disabled" : ""
                  }`}
                >
                  <CheckCircle className="status-icon verified" size={18} />
                  <span>Verified</span>
                </label>
              </div>

              <div className="status-option">
                <input
                  type="radio"
                  id="status-rejected"
                  name="status"
                  value="rejected"
                  checked={selectedStatus === "rejected"}
                  onChange={() => setSelectedStatus("rejected")}
                  disabled={profile?.verificationStatus === "rejected"}
                />
                <label
                  htmlFor="status-rejected"
                  className={`status-label ${
                    profile?.verificationStatus === "rejected" ? "disabled" : ""
                  }`}
                >
                  <XCircle className="status-icon rejected" size={18} />
                  <span>Rejected</span>
                </label>
              </div>

              <div className="status-option">
                <input
                  type="radio"
                  id="status-pending"
                  name="status"
                  value="pending"
                  checked={selectedStatus === "pending"}
                  onChange={() => setSelectedStatus("pending")}
                  disabled={profile?.verificationStatus === "pending"}
                />
                <label
                  htmlFor="status-pending"
                  className={`status-label ${
                    profile?.verificationStatus === "pending" ? "disabled" : ""
                  }`}
                >
                  <Clock className="status-icon pending" size={18} />
                  <span>Pending</span>
                </label>
              </div>
            </div>

            {/* Rejection reason textarea - only visible when rejected status is selected */}
            {selectedStatus === "rejected" && (
              <div className="rejection-reason-container">
                <label htmlFor="rejection-reason" className="form-label">Rejection Reason <span className="required">*</span></label>
                <textarea
                  id="rejection-reason"
                  className={`form-textarea ${rejectionReasonError ? 'error-input' : ''}`}
                  placeholder="Please provide a reason for rejecting this profile"
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    if (e.target.value.trim()) {
                      setRejectionReasonError(null);
                    }
                  }}
                  required
                />
                {rejectionReasonError && (
                  <p className="error-message rejection-error">{rejectionReasonError}</p>
                )}
                <p className="field-note">This reason will be stored with the profile and may be shown to the user</p>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              onClick={() => setIsStatusModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              onClick={handleUpdateStatusFromModal}
            >
              Update Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
