import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/language/language-provider";
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
  Briefcase,
  Building,
  MapPin,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileCheck,
} from "lucide-react";
import {
  getJobseekerProfile,
  updateJobseekerStatus,
  deleteJobseeker,
} from "../../services/api/jobseeker";
import { DocumentRecord } from "../../types/jobseeker";
import { supabase } from "../../lib/supabaseClient";
import PDFThumbnail from "../../components/PDFThumbnail";
import PDFViewerModal from "../../components/PDFViewerModal";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { AppHeader } from "../../components/AppHeader";
import "../../styles/components/header.css";
import "../../styles/pages/JobseekerProfileStyles.css";
import {
  getCandidateAssignments,
  CandidateAssignment,
} from "../../services/api/position";
import {
  getConsentRecordsByEntity,
  ConsentRecordWithDocument,
} from "../../services/api/consent";
import "../../styles/pages/JobSeekerPositions.css";

// Define a local comprehensive type reflecting the backend response
// TODO: Move this to shared types (e.g., client/src/types/jobseeker.ts) and update JobSeekerDetailedProfile
interface FullJobseekerProfile {
  id: string;
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  dob?: string | null;
  email?: string | null;
  billingEmail?: string | null;
  mobile?: string | null;
  licenseNumber?: string | null; // Potentially encrypted
  passportNumber?: string | null; // Potentially encrypted
  sinNumber?: string | null; // Potentially encrypted
  sinExpiry?: string | null;
  workPermitUci?: string | null; // Work/Study permit UCI for temporary residents
  workPermitExpiry?: string | null; // Work/Study permit expiry date for temporary residents
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
const getDisplayName = (
  profile: FullJobseekerProfile | null,
  t: (key: string) => string
): string => {
  if (!profile) return t("jobSeekerProfile.unknownUser");
  return (
    `${profile.firstName || ""} ${profile.lastName || ""}`.trim() ||
    t("jobSeekerProfile.unnamedProfile")
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
const profileNeedsAttention = (
  profile: FullJobseekerProfile | null
): boolean => {
  // Only check for pending profiles
  if (!profile || profile.verificationStatus !== "pending") return false;

  // Check if profile has documents with AI validation issues
  if (!profile.documents || profile.documents.length === 0) return false;

  return profile.documents.some((doc) => {
    if (!doc.aiValidation) return false;

    return (
      doc.aiValidation.is_tampered === true ||
      doc.aiValidation.is_blurry === true ||
      doc.aiValidation.is_text_clear === false ||
      doc.aiValidation.is_resubmission_required === true
    );
  });
};

// Helper function to calculate days until SIN expiry
const calculateDaysUntilExpiry = (expiryDate: string | null): number | null => {
  if (!expiryDate) return null;

  try {
    const expiry = new Date(expiryDate);
    const today = new Date();

    // Reset time to start of day for accurate day calculation
    expiry.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const timeDiff = expiry.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return daysDiff;
  } catch (error) {
    console.error("Error calculating days until SIN expiry:", error);
    return null;
  }
};

// Helper function to get SIN expiry alert info
const getSinExpiryAlert = (
  profile: FullJobseekerProfile | null,
  t?: (key: string, interpolations?: Record<string, string | number>) => string
): {
  type: "expired" | "warning-30" | "warning-60" | "warning-90" | null;
  daysUntilExpiry: number | null;
  message: string;
  icon: React.ReactNode;
} | null => {
  if (!profile?.sinExpiry) return null;
  const daysUntilExpiry = calculateDaysUntilExpiry(profile.sinExpiry);
  if (daysUntilExpiry === null) return null;
  if (!t) t = (k) => k; // fallback if t not provided
  if (daysUntilExpiry < 0) {
    return {
      type: "expired",
      daysUntilExpiry,
      message: t("jobSeekerProfile.sinExpired", {
        days: Math.abs(daysUntilExpiry),
      }),
      icon: <AlertTriangle size={20} />,
    };
  } else if (daysUntilExpiry <= 30) {
    return {
      type: "warning-30",
      daysUntilExpiry,
      message: t("jobSeekerProfile.sinExpiresIn", { days: daysUntilExpiry }),
      icon: <AlertTriangle size={20} />,
    };
  } else if (daysUntilExpiry <= 60) {
    return {
      type: "warning-60",
      daysUntilExpiry,
      message: t("jobSeekerProfile.sinExpiresIn", { days: daysUntilExpiry }),
      icon: <AlertCircle size={20} />,
    };
  } else if (daysUntilExpiry <= 90) {
    return {
      type: "warning-90",
      daysUntilExpiry,
      message: t("jobSeekerProfile.sinExpiresIn", { days: daysUntilExpiry }),
      icon: <CircleAlert size={20} />,
    };
  }
  return null;
};

// Helper function to get Work Permit expiry alert info
const getWorkPermitExpiryAlert = (
  profile: FullJobseekerProfile | null,
  t?: (key: string, interpolations?: Record<string, string | number>) => string
): {
  type: "expired" | "warning-30" | "warning-60" | "warning-90" | null;
  daysUntilExpiry: number | null;
  message: string;
  icon: React.ReactNode;
} | null => {
  if (!profile?.workPermitExpiry) return null;
  const daysUntilExpiry = calculateDaysUntilExpiry(profile.workPermitExpiry);
  if (daysUntilExpiry === null) return null;
  if (!t) t = (k) => k; // fallback if t not provided
  if (daysUntilExpiry < 0) {
    return {
      type: "expired",
      daysUntilExpiry,
      message: t("jobSeekerProfile.workPermitExpired", {
        days: Math.abs(daysUntilExpiry),
      }),
      icon: <AlertTriangle size={20} />,
    };
  } else if (daysUntilExpiry <= 30) {
    return {
      type: "warning-30",
      daysUntilExpiry,
      message: t("jobSeekerProfile.workPermitExpiresIn", {
        days: daysUntilExpiry,
      }),
      icon: <AlertTriangle size={20} />,
    };
  } else if (daysUntilExpiry <= 60) {
    return {
      type: "warning-60",
      daysUntilExpiry,
      message: t("jobSeekerProfile.workPermitExpiresIn", {
        days: daysUntilExpiry,
      }),
      icon: <AlertCircle size={20} />,
    };
  } else if (daysUntilExpiry <= 90) {
    return {
      type: "warning-90",
      daysUntilExpiry,
      message: t("jobSeekerProfile.workPermitExpiresIn", {
        days: daysUntilExpiry,
      }),
      icon: <CircleAlert size={20} />,
    };
  }
  return null;
};

// Helper function to decode HTML entities for slashes
const decodePath = (path: string | undefined): string | undefined => {
  return path ? path.replace(/&#x2F;/g, "/") : undefined;
};

// Type for our PDF cache
interface PDFCache {
  [key: string]: string | null;
}

const SkeletonCard = () => (
  <div className="jsp-skeleton-card">
    <div className="jsp-skeleton-card-header">
      <div className="jsp-skeleton-card-title-section">
        <div className="jsp-skeleton-card-title skeleton-text"></div>
        <div className="jsp-skeleton-card-code skeleton-text"></div>
      </div>
      <div className="jsp-skeleton-card-status skeleton-badge"></div>
    </div>
    <div className="jsp-skeleton-card-details">
      <div className="jsp-skeleton-detail-row">
        <div className="jsp-skeleton-detail-icon skeleton-icon"></div>
        <div className="jsp-skeleton-detail-text medium skeleton-text"></div>
      </div>
      <div className="jsp-skeleton-detail-row">
        <div className="jsp-skeleton-detail-icon skeleton-icon"></div>
        <div className="jsp-skeleton-detail-text short skeleton-text"></div>
      </div>
      <div className="jsp-skeleton-detail-row">
        <div className="jsp-skeleton-detail-icon skeleton-icon"></div>
        <div className="jsp-skeleton-detail-text long skeleton-text"></div>
      </div>
      <div className="jsp-skeleton-detail-row">
        <div className="jsp-skeleton-detail-icon skeleton-icon"></div>
        <div className="jsp-skeleton-detail-text medium skeleton-text"></div>
      </div>
    </div>
    <div className="jsp-skeleton-card-meta">
      <div className="jsp-skeleton-meta-tags">
        <div className="jsp-skeleton-tag medium skeleton-badge"></div>
        <div className="jsp-skeleton-tag small skeleton-badge"></div>
        <div className="jsp-skeleton-tag large skeleton-badge"></div>
        <div className="jsp-skeleton-tag medium skeleton-badge"></div>
      </div>
    </div>
  </div>
);

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
  const [rejectionReasonError, setRejectionReasonError] = useState<
    string | null
  >(null);
  const [expandedNotesIds, setExpandedNotesIds] = useState<Set<string>>(
    new Set()
  );
  const [showFullRejectionReason, setShowFullRejectionReason] =
    useState<boolean>(false);
  const { id } = useParams<{ id: string }>();
  const { isAdmin, isRecruiter, isJobSeeker } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Update selectedPdfName with translation when t is available
  useEffect(() => {
    setSelectedPdfName(t("jobSeekerProfile.document"));
  }, [t]);

  // Add state for positions
  const [assignments, setAssignments] = useState<CandidateAssignment[]>([]);
  const [positionsLoading, setPositionsLoading] = useState<boolean>(true);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [positionsPagination, setPositionsPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 6,
  });

  // Add state for consent records
  const [consentRecords, setConsentRecords] = useState<
    ConsentRecordWithDocument[]
  >([]);
  const [consentLoading, setConsentLoading] = useState<boolean>(true);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentPagination, setConsentPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 6,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        if (!id) throw new Error(t("messages.profileIdMissing"));
        const data = await getJobseekerProfile(id);
        console.log("Fetched detailed profile:", data);
        setProfile(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("messages.errorOccurred")
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

  // Fetch jobseeker positions when profile is loaded
  useEffect(() => {
    const fetchAssignments = async (page = 1) => {
      if (!profile?.userId) return;
      setPositionsLoading(true);
      setPositionsError(null);
      try {
        const response = await getCandidateAssignments(profile.userId, {
          page,
          limit: positionsPagination.itemsPerPage,
        });
        setAssignments(response.assignments);
        setPositionsPagination((prev) => ({
          ...prev,
          currentPage: response.pagination.page,
          totalPages: response.pagination.totalPages,
          totalItems: response.pagination.total,
          itemsPerPage: response.pagination.limit,
        }));
      } catch (err) {
        setPositionsError(
          err instanceof Error
            ? err.message
            : t("messages.failedToFetchPositions")
        );
        setAssignments([]);
        setPositionsPagination((prev) => ({
          ...prev,
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
        }));
      } finally {
        setPositionsLoading(false);
      }
    };
    if (profile?.userId) {
      fetchAssignments(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.userId]);

  // Pagination handlers for positions
  const handlePositionsPageChange = (page: number) => {
    setPositionsPagination((prev) => ({ ...prev, currentPage: page }));
  };
  useEffect(() => {
    if (profile?.userId) {
      const fetchAssignments = async () => {
        setPositionsLoading(true);
        setPositionsError(null);
        try {
          const response = await getCandidateAssignments(profile.userId, {
            page: positionsPagination.currentPage,
            limit: positionsPagination.itemsPerPage,
          });
          setAssignments(response.assignments);
          setPositionsPagination((prev) => ({
            ...prev,
            currentPage: response.pagination.page,
            totalPages: response.pagination.totalPages,
            totalItems: response.pagination.total,
            itemsPerPage: response.pagination.limit,
          }));
        } catch (err) {
          setPositionsError(
            err instanceof Error
              ? err.message
              : t("messages.failedToFetchPositions")
          );
          setAssignments([]);
          setPositionsPagination((prev) => ({
            ...prev,
            currentPage: 1,
            totalPages: 1,
            totalItems: 0,
          }));
        } finally {
          setPositionsLoading(false);
        }
      };
      fetchAssignments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsPagination.currentPage, profile?.userId]);

  // Fetch consent records when profile is loaded
  useEffect(() => {
    const fetchConsentRecords = async (page = 1) => {
      if (!profile?.id) return;
      setConsentLoading(true);
      setConsentError(null);
      try {
        const response = await getConsentRecordsByEntity(profile.id, {
          page,
          limit: consentPagination.itemsPerPage,
          consentableType: "jobseeker_profile",
        });
        setConsentRecords(response.records);
        setConsentPagination((prev) => ({
          ...prev,
          currentPage: response.pagination.page,
          totalPages: response.pagination.totalPages,
          totalItems: response.pagination.total,
          itemsPerPage: response.pagination.limit,
        }));
      } catch (err) {
        setConsentError(
          err instanceof Error
            ? err.message
            : t("messages.failedToFetchConsentRecords")
        );
        setConsentRecords([]);
        setConsentPagination((prev) => ({
          ...prev,
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
        }));
      } finally {
        setConsentLoading(false);
      }
    };
    if (profile?.id) {
      fetchConsentRecords(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Pagination handlers for consent records
  const handleConsentPageChange = (page: number) => {
    setConsentPagination((prev) => ({ ...prev, currentPage: page }));
  };
  useEffect(() => {
    if (profile?.id) {
      const fetchConsentRecords = async () => {
        setConsentLoading(true);
        setConsentError(null);
        try {
          const response = await getConsentRecordsByEntity(profile.id, {
            page: consentPagination.currentPage,
            limit: consentPagination.itemsPerPage,
            consentableType: "jobseeker_profile",
          });
          setConsentRecords(response.records);
          setConsentPagination((prev) => ({
            ...prev,
            currentPage: response.pagination.page,
            totalPages: response.pagination.totalPages,
            totalItems: response.pagination.total,
            itemsPerPage: response.pagination.limit,
          }));
        } catch (err) {
          setConsentError(
            err instanceof Error
              ? err.message
              : t("messages.failedToFetchConsentRecords")
          );
          setConsentRecords([]);
          setConsentPagination((prev) => ({
            ...prev,
            currentPage: 1,
            totalPages: 1,
            totalItems: 0,
          }));
        } finally {
          setConsentLoading(false);
        }
      };
      fetchConsentRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentPagination.currentPage, profile?.id]);

  const handleStatusUpdate = async (
    newStatus: "verified" | "rejected" | "pending"
  ) => {
    if (!profile || !id) return;

    // Clear previous error
    setRejectionReasonError(null);

    // Require rejection reason when rejecting a profile
    if (newStatus === "rejected" && !rejectionReason.trim()) {
      setRejectionReasonError(t("messages.rejectionReasonRequired"));
      return;
    }

    try {
      setUpdateStatus("Updating status...");
      const response = await updateJobseekerStatus(
        id,
        newStatus,
        newStatus === "rejected" ? rejectionReason : null
      );

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
        err instanceof Error ? err.message : t("messages.failedToUpdateStatus")
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
        setSelectedPdfName(documentFileName || t("jobSeekerProfile.document"));
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
        state: { message: t("jobSeekerProfile.profileDeleted") },
      });
    } catch (err) {
      console.error("Error deleting profile:", err);
      setUpdateStatus(
        err instanceof Error ? err.message : t("messages.failedToDeleteProfile")
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
    if (
      profile?.verificationStatus === "rejected" &&
      profile?.rejectionReason
    ) {
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
      setRejectionReasonError(t("messages.rejectionReasonRequired"));
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
    if (
      profile?.verificationStatus !== "rejected" ||
      !profile?.rejectionReason
    ) {
      return null;
    }

    const showToggle = profile.rejectionReason.length > 200;

    return (
      <div className="profile-rejection-reason">
        <div className="rejection-reason-header">
          <AlertCircle size={16} className="rejection-reason-icon" />
          <span className="rejection-reason-title">Rejection Reason</span>
        </div>
        <div
          className={`rejection-reason-content ${
            showFullRejectionReason ? "expanded" : ""
          }`}
        >
          {profile.rejectionReason}
        </div>
        {showToggle && (
          <button
            className="toggle-rejection-btn"
            onClick={() => setShowFullRejectionReason(!showFullRejectionReason)}
          >
            {showFullRejectionReason
              ? t("jobSeekerProfile.showLess")
              : t("jobSeekerProfile.showFullReason")}
          </button>
        )}
      </div>
    );
  };

  // Skeleton loader component
  const renderSkeletonLoader = () => {
    return (
      <div className="profile-container">
        <AppHeader
          title={t("jobSeekerProfile.title")}
          actions={
            <button className="button" disabled>
              <ArrowLeft size={16} className="icon" />
              <span>{t("jobSeekerProfile.backToManagement")}</span>
            </button>
          }
        />

        <main className="profile-main">
          {/* Profile Overview Skeleton */}
          <div className="profile-overview section-card">
            <div className="profile-banner">
              <div className="profile-banner-status-container">
                <div className="profile-status skeleton-status">
                  <div className="skeleton-icon"></div>
                  <div
                    className="skeleton-text"
                    style={{ width: "120px", height: "16px" }}
                  ></div>
                </div>
              </div>
              <div className="profile-actions-container">
                <div className="profile-actions" style={{ padding: 0 }}>
                  <div
                    className="skeleton-text"
                    style={{
                      width: "100px",
                      height: "32px",
                      borderRadius: "2rem",
                    }}
                  ></div>
                </div>
                <div className="profile-actions">
                  <div
                    className="skeleton-icon"
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "2rem",
                    }}
                  ></div>
                  <div
                    className="skeleton-icon"
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "2rem",
                    }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="profile-details">
              <div className="profile-avatar-container">
                <div className="profile-avatar skeleton-avatar">
                  <div
                    className="skeleton-icon"
                    style={{ width: "40px", height: "40px" }}
                  ></div>
                </div>
                <div
                  className="skeleton-text"
                  style={{ width: "200px", height: "32px", margin: "8px 0" }}
                ></div>
              </div>
              <div className="profile-info-header">
                <div className="profile-info-details">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="detail-item">
                      <div
                        className="skeleton-text"
                        style={{ width: "80px", height: "14px" }}
                      ></div>
                      <div
                        className="skeleton-text"
                        style={{
                          width: "120px",
                          height: "16px",
                          marginLeft: "10px",
                        }}
                      ></div>
                    </div>
                  ))}
                </div>
                <div className="profile-info-details">
                  {[1, 2].map((i) => (
                    <div key={i} className="detail-item">
                      <div
                        className="skeleton-text"
                        style={{ width: "80px", height: "14px" }}
                      ></div>
                      <div
                        className="skeleton-text"
                        style={{
                          width: "120px",
                          height: "16px",
                          marginLeft: "10px",
                        }}
                      ></div>
                    </div>
                  ))}
                </div>
                <div className="profile-info-details">
                  {[1, 2].map((i) => (
                    <div key={i} className="detail-item">
                      <div
                        className="skeleton-text"
                        style={{ width: "80px", height: "14px" }}
                      ></div>
                      <div
                        className="skeleton-text"
                        style={{
                          width: "120px",
                          height: "16px",
                          marginLeft: "10px",
                        }}
                      ></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Documents Section Skeleton */}
          <div className="documents-section section-card">
            <div
              className="skeleton-text"
              style={{ width: "180px", height: "24px", marginBottom: "20px" }}
            ></div>
            <div className="document-list">
              {[1].map((i) => (
                <div key={i} className="document-item skeleton-document">
                  <div className="document-content">
                    <div
                      className="skeleton-icon"
                      style={{ width: "18px", height: "18px" }}
                    ></div>
                    <div className="document-info">
                      <div
                        className="skeleton-text"
                        style={{
                          width: "150px",
                          height: "16px",
                          marginBottom: "8px",
                        }}
                      ></div>
                      <div
                        className="skeleton-text"
                        style={{
                          width: "100px",
                          height: "14px",
                          marginBottom: "8px",
                        }}
                      ></div>
                      <div className="document-actions">
                        <div
                          className="skeleton-text"
                          style={{
                            width: "80px",
                            height: "32px",
                            borderRadius: "6px",
                          }}
                        ></div>
                        <div
                          className="skeleton-text"
                          style={{
                            width: "90px",
                            height: "32px",
                            borderRadius: "6px",
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className="document-validation">
                      <div className="validation-header">
                        <div
                          className="skeleton-icon"
                          style={{ width: "16px", height: "16px" }}
                        ></div>
                        <div
                          className="skeleton-text"
                          style={{ width: "140px", height: "16px" }}
                        ></div>
                      </div>
                      <div className="authentication-score">
                        <div className="score-gauge skeleton-score-gauge">
                          <div
                            className="skeleton-progress-fill"
                            style={{ width: "60%" }}
                          ></div>
                        </div>
                        <div
                          className="skeleton-text"
                          style={{ width: "120px", height: "14px" }}
                        ></div>
                      </div>
                      <div className="validation-status-list">
                        {[1, 2, 3, 4].map((j) => (
                          <div key={j} className="validation-status-item">
                            <div
                              className="skeleton-icon"
                              style={{ width: "16px", height: "16px" }}
                            ></div>
                            <div
                              className="skeleton-text"
                              style={{ width: "120px", height: "14px" }}
                            ></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="document-preview">
                    <div
                      className="skeleton-text"
                      style={{
                        width: "100%",
                        height: "120px",
                        borderRadius: "8px",
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Profile Content Grid Skeleton */}
          <div className="profile-content grid-container">
            {[
              t("jobSeekerProfile.personalInformation"),
              t("jobSeekerProfile.identification"),
              t("jobSeekerProfile.address"),
              t("jobSeekerProfile.qualifications"),
              t("jobSeekerProfile.compensation"),
              t("jobSeekerProfile.metaInformation"),
            ].map((index) => (
              <div key={index} className="section-card">
                <div
                  className="skeleton-text"
                  style={{
                    width: "180px",
                    height: "20px",
                    marginBottom: "20px",
                  }}
                ></div>
                <div className="detail-group">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="detail-item">
                      <div
                        className="skeleton-text"
                        style={{ width: "100px", height: "14px" }}
                      ></div>
                      <div
                        className="skeleton-text"
                        style={{
                          width: "140px",
                          height: "16px",
                          marginLeft: "10px",
                        }}
                      ></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  };

  if (loading) {
    return renderSkeletonLoader();
  }

  if (error || !profile) {
    return (
      <div className="profile-container">
        <AppHeader
          title={t("jobSeekerProfile.title")}
          actions={
            <button
              className="button"
              onClick={() => navigate("/jobseeker-management")}
            >
              <ArrowLeft size={16} className="icon" />
              <span>
                {isJobSeeker
                  ? t("jobSeekerProfile.backToDashboard")
                  : t("jobSeekerProfile.backToJobSeekerManagement")}
              </span>
            </button>
          }
          statusMessage={updateStatus}
        />
        <div className="error-container">
          <p className="error-message">
            {error || t("jobSeekerProfile.failedToLoadProfile")}
          </p>
          <div className="error-actions">
            <button className="button " onClick={() => navigate("/jobseekers")}>
              {t("buttons.back")}
            </button>
            <button
              className="button primary"
              onClick={() => window.location.reload()}
            >
              {t("buttons.tryAgain")}
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
        ? t("jobSeekerProfile.nA")
        : typeof value === "boolean"
        ? value
          ? t("jobSeekerProfile.yes")
          : t("jobSeekerProfile.no")
        : value;

    let finalDisplayValue: string | number = displayValue;
    if (
      typeof displayValue === "string" &&
      displayValue !== t("jobSeekerProfile.nA")
    ) {
      if (
        [
          t("jobSeekerProfile.licenseNumber"),
          t("jobSeekerProfile.passportNumber"),
          t("jobSeekerProfile.sinNumber"),
          t("jobSeekerProfile.businessNumber"),
        ].includes(label)
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

  const displayName = getDisplayName(profile, t);
  const displayLocation = getDisplayLocation(profile);

  // Helper functions for rendering positions (copied from JobSeekerPositions)
  const formatDuration = (startDate: string, endDate?: string) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 30) {
      return `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? "s" : ""}`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} year${years > 1 ? "s" : ""}`;
    }
  };
  const getStatusBadgeClass = (assignment: CandidateAssignment) => {
    const statusMap = {
      active: "current",
      completed: "past",
      upcoming: "future",
    };
    const cssStatus =
      statusMap[assignment.status as keyof typeof statusMap] ||
      assignment.status;
    return `jsp-status-badge ${cssStatus}`;
  };
  const getStatusText = (assignment: CandidateAssignment) => {
    switch (assignment.status) {
      case "active":
        return t("jobSeekerProfile.statusActive");
      case "completed":
        return t("jobSeekerProfile.statusCompleted");
      case "upcoming":
        return t("jobSeekerProfile.statusUpcoming");
      default:
        return t("jobSeekerProfile.statusUnknown");
    }
  };

  return (
    <div className="profile-container">
      <AppHeader
        title={t("jobSeekerProfile.title")}
        actions={
          <button
            className="button"
            onClick={() => navigate("/jobseeker-management")}
          >
            <ArrowLeft size={16} className="icon" />
            <span>
              {isJobSeeker
                ? t("jobSeekerProfile.backToDashboard")
                : t("jobSeekerProfile.backToJobSeekerManagement")}
            </span>
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
                    ? `${t("jobSeekerProfile.status", {
                        status:
                          profile.verificationStatus.charAt(0).toUpperCase() +
                          profile.verificationStatus.slice(1),
                      })}`
                    : `${t("jobSeekerProfile.status", {
                        status: t("jobSeekerProfile.pending"),
                      })}`}
                </span>
              </div>
              {profileNeedsAttention(profile) && (
                <div className="profile-status need-attention">
                  <AlertTriangle
                    className="status-icon need-attention"
                    size={16}
                  />
                  <span className="status-text need-attention">
                    {t("jobSeekerProfile.needsAttention")}
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
                    title={t("jobSeekerProfile.updateStatus")}
                    aria-label={t("jobSeekerProfile.updateStatus")}
                  >
                    <span className="status-text">
                      {t("jobSeekerProfile.updateStatus")}
                    </span>{" "}
                    <RefreshCw size={16} className="icon" />
                  </button>
                </div>
              )}
              <div className="profile-actions">
                <button
                  className="action-icon-btn edit-btn"
                  onClick={handleEditProfile}
                  title={t("jobSeekerProfile.editProfile")}
                  aria-label={t("jobSeekerProfile.editProfile")}
                >
                  <Pencil size={20} className="icon" />
                </button>
                {(isAdmin || isRecruiter) && (
                  <button
                    className="action-icon-btn delete-btn"
                    onClick={handleDeleteProfile}
                    title={t("jobSeekerProfile.deleteProfile")}
                    aria-label={t("jobSeekerProfile.deleteProfile")}
                  >
                    <Trash2 size={20} className="icon" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="profile-details">
            {renderRejectionReason()}

            {/* SIN Expiry Alert */}
            {(() => {
              const sinAlert = getSinExpiryAlert(profile, t);
              if (!sinAlert) return null;

              return (
                <div className={`sin-expiry-alert ${sinAlert.type}`}>
                  <div className="sin-alert-icon">{sinAlert.icon}</div>
                  <div className="sin-alert-content">
                    <div className="sin-alert-message">{sinAlert.message}</div>
                    <div className="sin-alert-details">
                      {t("jobSeekerProfile.sinExpiry", {
                        date: formatDate(profile.sinExpiry, false),
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Work Permit Expiry Alert */}
            {(() => {
              const workPermitAlert = getWorkPermitExpiryAlert(profile, t);
              if (!workPermitAlert) return null;

              return (
                <div className={`sin-expiry-alert ${workPermitAlert.type}`}>
                  <div className="sin-alert-icon">{workPermitAlert.icon}</div>
                  <div className="sin-alert-content">
                    <div className="sin-alert-message">
                      {workPermitAlert.message}
                    </div>
                    <div className="sin-alert-details">
                      {t("jobSeekerProfile.workPermitExpiryLabel", {
                        date: formatDate(profile.workPermitExpiry, false),
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="profile-avatar-container">
              <div className="profile-avatar">
                <User size={40} />
              </div>
              <h1 className="profile-name">{displayName}</h1>
            </div>
            <div className="profile-info-header">
              <div className="profile-info-details">
                {renderDetailItem(
                  t("jobSeekerProfile.employeeId"),
                  profile.employeeId
                )}
                {renderDetailItem(t("jobSeekerProfile.email"), profile.email)}
                {renderDetailItem(
                  t("jobSeekerProfile.billingEmail"),
                  profile.billingEmail
                )}
                {renderDetailItem(t("jobSeekerProfile.mobile"), profile.mobile)}
              </div>
              <div className="profile-info-details">
                {renderDetailItem(
                  t("jobSeekerProfile.location"),
                  displayLocation
                )}
                {renderDetailItem(
                  t("jobSeekerProfile.joined"),
                  formatDate(profile.createdAt)
                )}
              </div>
              <div className="profile-info-details">
                {renderDetailItem(
                  t("jobSeekerProfile.lastUpdated"),
                  formatDate(profile.updatedAt)
                )}
                {renderDetailItem(
                  t("jobSeekerProfile.dob"),
                  formatDate(profile.dob, false)
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="documents-section section-card">
          <h2 className="section-title">
            {t("jobSeekerProfile.uploadedDocuments")}
          </h2>
          {downloadError && (
            <div className="error-message download-error">
              <p>{downloadError}</p>
            </div>
          )}
          {loadingPdfs && (
            <div className="loading-pdfs">
              <div className="pdf-loading-spinner"></div>
              <p>{t("jobSeekerProfile.loadingDocumentPreviews")}</p>
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
                            {doc.documentFileName ||
                              t("jobSeekerProfile.unnamedDocument")}
                          </p>
                          <p className="document-type">
                            {t("jobSeekerProfile.documentType", {
                              type: doc.documentType,
                            })}
                          </p>
                          {doc.documentTitle && (
                            <p className="document-title">
                              {t("jobSeekerProfile.documentTitle", {
                                title: doc.documentTitle,
                              })}
                            </p>
                          )}
                          {doc.documentNotes && (
                            <p className="document-notes">
                              {t("jobSeekerProfile.documentNotes", {
                                notes: doc.documentNotes,
                              })}
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
                              <Eye size={16} className="icon" />{" "}
                              {t("jobSeekerProfile.previewDocument")}
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
                                  {t("jobSeekerProfile.downloading")}...
                                </>
                              ) : (
                                <>
                                  <Download size={16} className="icon" />{" "}
                                  {t("jobSeekerProfile.downloadDocument")}
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* AI Document Validation - Now with consistent data from cache */}
                        <div className="document-validation">
                          <div className="validation-header">
                            <Shield size={16} />
                            <h3>
                              {t("jobSeekerProfile.aiDocumentValidation")}
                            </h3>
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
                                {t("jobSeekerProfile.aiValidationInProgress")}
                              </h4>
                              <p className="validation-progress-message">
                                {t(
                                  "jobSeekerProfile.aiValidationInProgressMessage"
                                )}
                              </p>
                              <p className="validation-progress-note">
                                {t(
                                  "jobSeekerProfile.aiValidationInProgressNote"
                                )}
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
                                  {t("jobSeekerProfile.authenticationScore")}
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
                                      ? t("jobSeekerProfile.notTampered")
                                      : t("jobSeekerProfile.tampered")}
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
                                      ? t("jobSeekerProfile.notBlurry")
                                      : t("jobSeekerProfile.blurry")}
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
                                      ? t("jobSeekerProfile.textClear")
                                      : t("jobSeekerProfile.textUnclear")}
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
                                      ? t(
                                          "jobSeekerProfile.noResubmissionRequired"
                                        )
                                      : t(
                                          "jobSeekerProfile.resubmissionRequired"
                                        )}
                                  </span>
                                </div>
                              </div>

                              <div className="validation-notes">
                                <div className="validation-notes-header">
                                  <AlertCircle size={14} />
                                  <span>
                                    {t("jobSeekerProfile.aiAnalysisNotes")}
                                  </span>
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
                                    ? t("jobSeekerProfile.showLess")
                                    : t("jobSeekerProfile.showFullNotes")}
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
                            <span>
                              {t("jobSeekerProfile.noPreviewAvailable")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            <p className="empty-documents">
              {t("jobSeekerProfile.noDocumentsUploaded")}
            </p>
          )}
        </div>
        <div className="profile-content grid-container">
          <div className="personal-details-section section-card">
            <h2 className="section-title">
              {t("jobSeekerProfile.personalInformation")}
            </h2>
            <div className="detail-group">
              {renderDetailItem(
                t("jobSeekerProfile.firstName"),
                profile.firstName
              )}
              {renderDetailItem(
                t("jobSeekerProfile.lastName"),
                profile.lastName
              )}
              {renderDetailItem(t("jobSeekerProfile.email"), profile.email)}
              {renderDetailItem(
                t("jobSeekerProfile.billingEmail"),
                profile.billingEmail
              )}
              {renderDetailItem(t("jobSeekerProfile.mobile"), profile.mobile)}
              {renderDetailItem(
                t("jobSeekerProfile.dateOfBirth"),
                formatDate(profile.dob, false)
              )}
            </div>
          </div>

          <div className="identification-section section-card">
            <h2 className="section-title">
              {t("jobSeekerProfile.identification")}
            </h2>
            <div className="detail-group">
              {renderDetailItem(
                t("jobSeekerProfile.licenseNumber"),
                profile.licenseNumber
              )}
              {renderDetailItem(
                t("jobSeekerProfile.passportNumber"),
                profile.passportNumber
              )}
              {renderDetailItem(
                t("jobSeekerProfile.sinNumber"),
                profile.sinNumber
              )}
              {renderDetailItem(
                t("jobSeekerProfile.sinExpiry"),
                formatDate(profile.sinExpiry, false)
              )}
              {renderDetailItem(
                t("jobSeekerProfile.workPermitUci"),
                profile.workPermitUci
              )}
              {renderDetailItem(
                t("jobSeekerProfile.workPermitExpiry"),
                formatDate(profile.workPermitExpiry, false)
              )}
              {renderDetailItem(
                t("jobSeekerProfile.businessNumber"),
                profile.businessNumber
              )}
              {renderDetailItem(
                t("jobSeekerProfile.corporationName"),
                profile.corporationName
              )}
            </div>
          </div>

          <div className="address-section section-card">
            <h2 className="section-title">{t("jobSeekerProfile.address")}</h2>
            <div className="detail-group">
              {renderDetailItem(t("jobSeekerProfile.street"), profile.street)}
              {renderDetailItem(t("jobSeekerProfile.city"), profile.city)}
              {renderDetailItem(
                t("jobSeekerProfile.province"),
                profile.province
              )}
              {renderDetailItem(
                t("jobSeekerProfile.postalCode"),
                profile.postalCode
              )}
            </div>
          </div>

          <div className="qualifications-section section-card">
            <h2 className="section-title">
              {t("jobSeekerProfile.qualifications")}
            </h2>
            <div className="detail-group">
              {renderDetailItem(
                t("jobSeekerProfile.workPreference"),
                profile?.workPreference
              )}
              {renderDetailItem(t("jobSeekerProfile.bio"), profile?.bio)}
              {renderDetailItem(
                t("jobSeekerProfile.licenseType"),
                profile?.licenseType
              )}
              {renderDetailItem(
                t("jobSeekerProfile.experience"),
                profile?.experience
              )}
              {renderDetailItem(
                t("jobSeekerProfile.manualDriving"),
                profile?.manualDriving
              )}
              {renderDetailItem(
                t("jobSeekerProfile.availability"),
                profile?.availability
              )}
              {renderDetailItem(
                t("jobSeekerProfile.weekendAvailability"),
                profile?.weekendAvailability
              )}
            </div>
          </div>

          {/* Only show compensation section for admins and recruiters */}
          {!isJobSeeker && (
            <div className="compensation-section section-card">
              <h2 className="section-title">
                {t("jobSeekerProfile.compensation")}
              </h2>
              <div className="detail-group">
                {renderDetailItem(
                  t("jobSeekerProfile.payrateType"),
                  profile.payrateType
                )}
                {renderDetailItem(
                  t("jobSeekerProfile.billRate"),
                  profile.billRate
                )}
                {renderDetailItem(
                  t("jobSeekerProfile.payRate"),
                  profile.payRate
                )}
                {renderDetailItem(
                  t("jobSeekerProfile.paymentMethod"),
                  profile.paymentMethod
                )}
                {renderDetailItem(t("jobSeekerProfile.hstGst"), profile.hstGst)}
                {renderDetailItem(
                  t("jobSeekerProfile.cashDeduction"),
                  profile.cashDeduction
                )}
                {renderDetailItem(
                  t("jobSeekerProfile.overtimeEnabled"),
                  profile.overtimeEnabled
                )}
                {profile.overtimeEnabled && (
                  <>
                    {renderDetailItem(
                      t("jobSeekerProfile.overtimeHoursAfter"),
                      profile.overtimeHours
                    )}
                    {renderDetailItem(
                      t("jobSeekerProfile.overtimeBillRate"),
                      profile.overtimeBillRate
                    )}
                    {renderDetailItem(
                      t("jobSeekerProfile.overtimePayRate"),
                      profile.overtimePayRate
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="meta-section section-card">
            <h2 className="section-title">
              {t("jobSeekerProfile.metaInformation")}
            </h2>
            <div className="detail-group">
              {profile.creatorDetails ? (
                <div className="detail-section">
                  <h3>{t("jobSeekerProfile.createdBy")}</h3>
                  {renderDetailItem(
                    t("jobSeekerProfile.name"),
                    profile.creatorDetails.name
                  )}
                  {renderDetailItem(
                    t("jobSeekerProfile.email"),
                    profile.creatorDetails.email
                  )}
                  {renderDetailItem(
                    t("jobSeekerProfile.userType"),
                    profile.creatorDetails.userType
                  )}
                  {renderDetailItem(
                    t("jobSeekerProfile.accountCreatedAt"),
                    formatDate(profile.creatorDetails.createdAt)
                  )}
                </div>
              ) : null}

              {profile.updaterDetails ? (
                <div className="detail-section">
                  <h3>{t("jobSeekerProfile.lastUpdatedBy")}</h3>
                  {renderDetailItem(
                    t("jobSeekerProfile.name"),
                    profile.updaterDetails.name
                  )}
                  {renderDetailItem(
                    t("jobSeekerProfile.email"),
                    profile.updaterDetails.email
                  )}
                  {renderDetailItem(
                    t("jobSeekerProfile.userType"),
                    profile.updaterDetails.userType
                  )}
                  {renderDetailItem(
                    t("jobSeekerProfile.lastUpdatedAt"),
                    formatDate(profile.updaterDetails.updatedAt)
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Jobseeker Positions Section */}
        <section className="" style={{ marginTop: 40 }}>
          <h2 className="section-title">
            {t("jobSeekerProfile.positions", { name: displayName })}
          </h2>
          <div className="jsp-positions-content">
            {positionsLoading ? (
              <div className="jsp-positions-list">
                {Array.from(
                  { length: positionsPagination.itemsPerPage },
                  (_, index) => (
                    <SkeletonCard key={index} />
                  )
                )}
              </div>
            ) : positionsError ? (
              <div className="error-container">
                <p className="error-message">{positionsError}</p>
                <button
                  className="button primary"
                  onClick={() => handlePositionsPageChange(1)}
                >
                  {t("jobSeekerProfile.tryAgain")}
                </button>
              </div>
            ) : (
              <div className="jsp-positions-list">
                {assignments.length === 0 ? (
                  <div className="jsp-empty-state">
                    <Briefcase size={48} className="jsp-empty-icon" />
                    <h3>{t("jobSeekerProfile.noPositionsFound")}</h3>
                    <p>{t("jobSeekerProfile.noPositionsMessage")}</p>
                  </div>
                ) : (
                  assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="jsp-position-card"
                      data-status={(() => {
                        const statusMap = {
                          active: "current",
                          completed: "past",
                          upcoming: "future",
                        };
                        return (
                          statusMap[
                            assignment.status as keyof typeof statusMap
                          ] || assignment.status
                        );
                      })()}
                    >
                      <div className="jsp-position-header">
                        <div className="jsp-position-title-section">
                          <h3 className="jsp-position-title">
                            {assignment.position?.title}
                          </h3>
                          <div className="jsp-position-code">
                            {assignment.position?.positionCode}
                          </div>
                        </div>
                        <div className={getStatusBadgeClass(assignment)}>
                          {getStatusText(assignment)}
                        </div>
                      </div>
                      <div className="jsp-position-details">
                        <div className="jsp-detail-row">
                          <Building size={16} />
                          <span>{assignment.position?.clientName}</span>
                        </div>
                        <div className="jsp-detail-row">
                          <MapPin size={16} />
                          <span>
                            {assignment.position?.city},{" "}
                            {assignment.position?.province}
                          </span>
                        </div>
                        {assignment.position?.startDate && (
                          <div className="jsp-detail-row">
                            <Calendar size={16} />
                            <span>
                              {t("jobSeekerProfile.positionPeriod", {
                                startDate: formatDate(
                                  assignment.position.startDate,
                                  false
                                ),
                                endDate: assignment.position.endDate
                                  ? formatDate(
                                      assignment.position.endDate,
                                      false
                                    )
                                  : "",
                              })}
                            </span>
                          </div>
                        )}
                        <div className="jsp-detail-row">
                          <Clock size={16} />
                          <span>
                            {t("jobSeekerProfile.duration", {
                              duration: formatDuration(
                                assignment.startDate,
                                assignment.endDate
                              ),
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="jsp-position-meta">
                        <div className="jsp-meta-tags">
                          <span className="jsp-tag employment-type">
                            {assignment.position?.employmentType}
                          </span>
                          {assignment.position?.employmentTerm && (
                            <span className="jsp-tag employment-term">
                              {assignment.position.employmentTerm}
                            </span>
                          )}
                          <span className="jsp-tag position-category">
                            {assignment.position?.positionCategory}
                          </span>
                          <span className="jsp-tag experience">
                            {assignment.position?.experience}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {/* Pagination Controls */}
            {!positionsLoading && positionsPagination.totalPages > 1 && (
              <div className="jsp-pagination-controls bottom">
                <div className="jsp-pagination-info">
                  <span className="jsp-pagination-text">
                    {t("jobSeekerProfile.paginationInfo", {
                      currentPage: positionsPagination.currentPage,
                      totalPages: positionsPagination.totalPages,
                    })}
                  </span>
                </div>
                <div className="jsp-pagination-buttons">
                  <button
                    className="jsp-pagination-btn prev"
                    onClick={() =>
                      handlePositionsPageChange(
                        positionsPagination.currentPage - 1
                      )
                    }
                    disabled={positionsPagination.currentPage === 1}
                    title={t("jobSeekerProfile.previousPage")}
                    aria-label={t("jobSeekerProfile.previousPage")}
                  >
                    <ChevronLeft size={16} />
                    <span>{t("jobSeekerProfile.previous")}</span>
                  </button>
                  <div className="jsp-page-numbers">
                    {Array.from(
                      { length: Math.min(5, positionsPagination.totalPages) },
                      (_, i) => {
                        let pageNum;
                        if (positionsPagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (positionsPagination.currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (
                          positionsPagination.currentPage >=
                          positionsPagination.totalPages - 2
                        ) {
                          pageNum = positionsPagination.totalPages - 4 + i;
                        } else {
                          pageNum = positionsPagination.currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            className={`jsp-page-number-btn ${
                              pageNum === positionsPagination.currentPage
                                ? "active"
                                : ""
                            }`}
                            onClick={() => handlePositionsPageChange(pageNum)}
                            aria-label={t("jobSeekerProfile.goToPage", {
                              page: pageNum,
                            })}
                          >
                            {pageNum}
                          </button>
                        );
                      }
                    )}
                  </div>
                  <button
                    className="jsp-pagination-btn next"
                    onClick={() =>
                      handlePositionsPageChange(
                        positionsPagination.currentPage + 1
                      )
                    }
                    disabled={
                      positionsPagination.currentPage ===
                      positionsPagination.totalPages
                    }
                    title={t("jobSeekerProfile.nextPage")}
                    aria-label={t("jobSeekerProfile.nextPage")}
                  >
                    <span>{t("jobSeekerProfile.next")}</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Consent Records Section */}
        <section className="" style={{ marginTop: 40 }}>
          <h2 className="section-title">
            {t("jobSeekerProfile.digitalConsentRecords", { name: displayName })}
          </h2>
          <div className="jsp-consent-content">
            {consentLoading ? (
              <div className="jsp-consent-list">
                {Array.from(
                  { length: consentPagination.itemsPerPage },
                  (_, index) => (
                    <SkeletonCard key={index} />
                  )
                )}
              </div>
            ) : consentError ? (
              <div className="error-container">
                <p className="error-message">{consentError}</p>
                <button
                  className="button primary"
                  onClick={() => handleConsentPageChange(1)}
                >
                  {t("jobSeekerProfile.tryAgain")}
                </button>
              </div>
            ) : (
              <div className="jsp-consent-list">
                {consentRecords.length === 0 ? (
                  <div className="jsp-empty-state">
                    <FileCheck size={48} className="jsp-empty-icon" />
                    <h3>{t("jobSeekerProfile.noConsentRecords")}</h3>
                    <p>{t("jobSeekerProfile.noConsentMessage")}</p>
                  </div>
                ) : (
                  consentRecords.map((record) => (
                    <div
                      key={record.id}
                      className="jsp-consent-card"
                      data-status={record.status}
                    >
                      <div className="jsp-consent-header">
                        <div className="jsp-consent-title-section">
                          <h3 className="jsp-consent-title">
                            {record.consent_documents.file_name}
                          </h3>
                        </div>
                        <div className={`jsp-status-badge ${record.status}`}>
                          {record.status.charAt(0).toUpperCase() +
                            record.status.slice(1)}
                        </div>
                      </div>
                      <div className="jsp-consent-details">
                        <div className="jsp-detail-row">
                          <Calendar size={16} />
                          <span>
                            {t("jobSeekerProfile.consentSent", {
                              date: formatDate(record.sent_at),
                            })}
                          </span>
                        </div>
                        <div className="jsp-detail-row">
                          <CheckCircle size={16} />
                          <span>
                            {t("jobSeekerProfile.consentCompleted", {
                              date: formatDate(record.completed_at),
                            })}
                          </span>
                        </div>
                        <div className="jsp-detail-row">
                          <User size={16} />
                          <span>
                            {t("jobSeekerProfile.consentedName", {
                              name: record.consented_name
                                ? record.consented_name
                                : t("jobSeekerProfile.nA"),
                            })}
                          </span>
                        </div>
                        <div className="jsp-detail-row">
                          <Clock size={16} />
                          <span>
                            {t("jobSeekerProfile.consentStatus", {
                              status: record.status,
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="jsp-consent-actions">
                        <button
                          className="button primary"
                          onClick={() =>
                            navigate(`/consent-dashboard/${record.document_id}`)
                          }
                        >
                          <Eye size={16} />
                          {t("jobSeekerProfile.viewConsentRecord")}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {/* Consent Pagination Controls */}
            {!consentLoading && consentPagination.totalPages > 1 && (
              <div className="jsp-pagination-controls bottom">
                <div className="jsp-pagination-info">
                  <span className="jsp-pagination-text">
                    {t("jobSeekerProfile.paginationInfo", {
                      currentPage: consentPagination.currentPage,
                      totalPages: consentPagination.totalPages,
                    })}
                  </span>
                </div>
                <div className="jsp-pagination-buttons">
                  <button
                    className="jsp-pagination-btn prev"
                    onClick={() =>
                      handleConsentPageChange(consentPagination.currentPage - 1)
                    }
                    disabled={consentPagination.currentPage === 1}
                    title={t("jobSeekerProfile.previousPage")}
                    aria-label={t("jobSeekerProfile.previousPage")}
                  >
                    <ChevronLeft size={16} />
                    <span>{t("jobSeekerProfile.previous")}</span>
                  </button>
                  <div className="jsp-page-numbers">
                    {Array.from(
                      { length: Math.min(5, consentPagination.totalPages) },
                      (_, i) => {
                        let pageNum;
                        if (consentPagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (consentPagination.currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (
                          consentPagination.currentPage >=
                          consentPagination.totalPages - 2
                        ) {
                          pageNum = consentPagination.totalPages - 4 + i;
                        } else {
                          pageNum = consentPagination.currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            className={`jsp-page-number-btn ${
                              pageNum === consentPagination.currentPage
                                ? "active"
                                : ""
                            }`}
                            onClick={() => handleConsentPageChange(pageNum)}
                            aria-label={t("jobSeekerProfile.goToPage", {
                              page: pageNum,
                            })}
                          >
                            {pageNum}
                          </button>
                        );
                      }
                    )}
                  </div>
                  <button
                    className="jsp-pagination-btn next"
                    onClick={() =>
                      handleConsentPageChange(consentPagination.currentPage + 1)
                    }
                    disabled={
                      consentPagination.currentPage ===
                      consentPagination.totalPages
                    }
                    title={t("jobSeekerProfile.nextPage")}
                    aria-label={t("jobSeekerProfile.nextPage")}
                  >
                    <span>{t("jobSeekerProfile.next")}</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
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
        title={t("jobSeekerProfile.profileStatusChangeNoticeTitle")}
        message={t("jobSeekerProfile.profileStatusChangeNoticeMessage")}
        confirmText={t("jobSeekerProfile.continueToEdit")}
        cancelText={t("jobSeekerProfile.cancel")}
        confirmButtonClass="primary"
        onConfirm={confirmEdit}
        onCancel={() => setIsEditConfirmationOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteConfirmationOpen}
        title={t("jobSeekerProfile.deleteProfileTitle")}
        message={t("jobSeekerProfile.deleteProfileMessage")}
        confirmText={
          isDeleting
            ? t("jobSeekerProfile.deleting")
            : t("jobSeekerProfile.deleteProfile")
        }
        cancelText={t("jobSeekerProfile.cancel")}
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
            <h3>{t("jobSeekerProfile.updateProfileStatus")}</h3>
            <button
              className="close-button"
              onClick={() => setIsStatusModalOpen(false)}
            >
              <XCircle size={20} className="icon" />
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
                  <span>{t("jobSeekerProfile.verified")}</span>
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
                  <span>{t("jobSeekerProfile.rejected")}</span>
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
                  <span>{t("jobSeekerProfile.pending")}</span>
                </label>
              </div>
            </div>

            {/* Rejection reason textarea - only visible when rejected status is selected */}
            {selectedStatus === "rejected" && (
              <div className="rejection-reason-container">
                <label htmlFor="rejection-reason" className="form-label">
                  {t("jobSeekerProfile.rejectionReasonLabel")}{" "}
                  <span className="required">*</span>
                </label>
                <textarea
                  id="rejection-reason"
                  className={`form-textarea ${
                    rejectionReasonError ? "error-input" : ""
                  }`}
                  placeholder={t("jobSeekerProfile.rejectionReasonPlaceholder")}
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
                  <p className="error-message rejection-error">
                    {rejectionReasonError}
                  </p>
                )}
                <p className="field-note">
                  {t("jobSeekerProfile.rejectionReasonNote")}
                </p>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="button secondary"
              onClick={() => setIsStatusModalOpen(false)}
            >
              {t("jobSeekerProfile.cancel")}
            </button>
            <button
              className="button primary"
              onClick={handleUpdateStatusFromModal}
            >
              {t("jobSeekerProfile.updateStatus")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
