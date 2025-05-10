import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, User, CheckCircle, XCircle, Clock, FileText, Download, Eye, FileWarning, Trash2, Pencil } from 'lucide-react';
import { getJobseekerProfile, updateJobseekerStatus, deleteJobseeker } from '../services/api';
import { DocumentRecord } from '../types/jobseeker';
import { supabase } from '../lib/supabaseClient';
import PDFThumbnail from '../components/PDFThumbnail';
import PDFViewerModal from '../components/PDFViewerModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import '../styles/pages/JobSeekerProfile.css';
import '../styles/components/header.css';

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
  manualDriving?: 'NA' | 'Yes' | 'No' | null;
  availability?: 'Full-Time' | 'Part-Time' | null;
  weekendAvailability?: boolean | null;
  payrateType?: 'Hourly' | 'Daily' | 'Monthly' | null;
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
  verificationStatus?: 'pending' | 'verified' | 'rejected' | null;
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
  // Add any other potential fields from the DB
}

// Helper function to generate display name
const getDisplayName = (profile: FullJobseekerProfile | null): string => {
  if (!profile) return 'Unknown User';
  return `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unnamed Profile';
};

// Helper function to generate display location
const getDisplayLocation = (profile: FullJobseekerProfile | null): string | undefined => {
  if (!profile) return undefined;
  const parts = [profile.city, profile.province].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
};

// Helper function to decode HTML entities for slashes
const decodePath = (path: string | undefined): string | undefined => {
  return path ? path.replace(/&#x2F;/g, '/') : undefined;
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
  const [selectedPdfName, setSelectedPdfName] = useState<string>('Document');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [pdfCache, setPdfCache] = useState<PDFCache>({});
  const [loadingPdfs, setLoadingPdfs] = useState<boolean>(false);
  const [isEditConfirmationOpen, setIsEditConfirmationOpen] = useState<boolean>(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'verified' | 'rejected'>('pending');
  const { id } = useParams<{ id: string }>();
  const { isAdmin, isRecruiter, isJobSeeker } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {

    const fetchProfile = async () => {
      try {
        setLoading(true);
        if (!id) throw new Error("Profile ID is missing");
        const data = await getJobseekerProfile(id);
        console.log('Fetched detailed profile:', data);
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching the profile');
        console.error('Error fetching profile:', err);
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
      setSelectedStatus(profile.verificationStatus as 'pending' | 'verified' | 'rejected');
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
                  console.error(`Error getting signed URL for ${doc.documentPath}:`, err);
                  newCache[doc.documentPath] = null;
                }
              }
            }) || []
          );
          
          setPdfCache(newCache);
        } catch (err) {
          console.error('Error loading PDFs:', err);
        } finally {
          setLoadingPdfs(false);
        }
      };
      
      loadAllPdfs();
    }
  }, [profile?.documents]);

  const handleStatusUpdate = async (newStatus: 'verified' | 'rejected' | 'pending') => {
    if (!profile || !id) return;
    
    try {
      setUpdateStatus('Updating status...');
      const response = await updateJobseekerStatus(id, newStatus);
      
      // Check the structure of the response to find the correct property
      console.log('Status update response:', response);
      
      // If response includes profile data with the updated status
      if (response.profile) {
        // Make sure we preserve the correct structure
        setProfile({
          ...profile,
          ...response.profile,
          verificationStatus: response.profile.status || response.profile.verificationStatus || newStatus
        });
      } else {
        // If direct response or unknown structure, just update the local status
        setProfile({
          ...profile,
          verificationStatus: newStatus
        });
      }
      
      setUpdateStatus(`Profile status updated to ${newStatus}`);
      
      setTimeout(() => setUpdateStatus(null), 3000);
    } catch (err) {
      setUpdateStatus(err instanceof Error ? err.message : 'Failed to update status');
      console.error('Error updating status:', err);
      
      setTimeout(() => setUpdateStatus(null), 3000);
    }
  };

  const getStatusIcon = () => {
    const status = profile?.verificationStatus || 'pending';
    
    switch (status) {
      case 'verified':
        return <CheckCircle className="status-icon verified" />;
      case 'rejected':
        return <XCircle className="status-icon rejected" />;
      case 'pending':
        return <Clock className="status-icon pending" />;
      default:
        return <Clock className="status-icon pending" />; // Default to pending icon
    }
  };

  const formatDate = (dateString?: string | null, showTime: boolean = true) => {
    if (!dateString) return 'N/A';
    try {
      // Setup options based on whether to show time
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/Toronto',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        ...(showTime && {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      };
      
      let date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('en-CA', options);
      }
      
      const datePart = dateString.split('T')[0];
      date = new Date(datePart + 'T00:00:00Z');
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('en-CA', options);
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

  // Function to handle previewing a document
  const handlePreviewDocument = async (documentPath?: string | null, documentFileName?: string | null) => {
    if (!documentPath) {
      setDownloadError('Document path is missing.');
      setTimeout(() => setDownloadError(null), 3000);
      return;
    }

    try {
      // Use the cached signed URL if available
      const signedUrl = pdfCache[documentPath] || await getSignedUrl(documentPath);
      
      if (signedUrl) {
        setSelectedPdfUrl(signedUrl);
        setSelectedPdfName(documentFileName || 'Document');
        setIsPdfModalOpen(true);
        
        // Cache the URL if not already cached
        if (!pdfCache[documentPath]) {
          setPdfCache({
            ...pdfCache,
            [documentPath]: signedUrl
          });
        }
      } else {
        throw new Error('Could not generate preview URL.');
      }
    } catch (err) {
      console.error("Error preparing document preview:", err);
      setDownloadError(err instanceof Error ? err.message : 'Could not preview the document.');
      setTimeout(() => setDownloadError(null), 5000);
    }
  };

  const handleDownloadDocument = async (documentPath?: string | null, docId?: string, documentFileName?: string) => {
    if (!documentPath) {
      setDownloadError('Document path is missing.');
      setTimeout(() => setDownloadError(null), 3000);
      return;
    }

    // Set loading state for this specific document
    setDownloadingDocId(docId || 'unknown');
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
          .from('jobseeker-documents')
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
            [documentPath]: signedUrl
          });
        }
      }

      if (signedUrl) {
        console.log("Download URL generated:", signedUrl);
        
        // Create a temporary anchor element to trigger download
        const downloadLink = document.createElement('a');
        downloadLink.href = signedUrl;
        
        // Use the documentFileName if provided, otherwise extract from path or use a default
        let filename = 'document.pdf';
        if (documentFileName) {
          filename = documentFileName;
        } else {
          const pathFilename = documentPath.split('/').pop();
          if (pathFilename) filename = pathFilename;
        }
        
        downloadLink.download = filename;
        
        // Append to body, click, and remove to trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      } else {
        throw new Error('Could not retrieve signed URL for download.');
      }
    } catch (err) {
      console.error("Error in handleDownloadDocument:", err);
      setDownloadError(err instanceof Error ? err.message : 'Could not download the document.');
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
      navigate('/jobseekers', { state: { message: 'Profile deleted successfully' } });
    } catch (err) {
      console.error('Error deleting profile:', err);
      setUpdateStatus(err instanceof Error ? err.message : 'Failed to delete profile');
      setTimeout(() => setUpdateStatus(null), 3000);
      setIsDeleting(false);
    }
  };

  const openStatusModal = () => {
    setSelectedStatus(profile?.verificationStatus as 'pending' | 'verified' | 'rejected' || 'pending');
    setIsStatusModalOpen(true);
  };

  const handleUpdateStatusFromModal = () => {
    handleStatusUpdate(selectedStatus);
    setIsStatusModalOpen(false);
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
          <p className="error-message">{error || 'Failed to load profile'}</p>
          <div className="error-actions">
            <button 
              className="button " 
              onClick={() => navigate('/jobseekers')}
            >
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

  const renderDetailItem = (label: string, value?: string | number | boolean | null) => {
    const displayValue = value === null || value === undefined || value === '' ? 'N/A' : 
                         typeof value === 'boolean' ? (value ? 'Yes' : 'No') : 
                         value;
    
    let finalDisplayValue: string | number = displayValue;
    if (typeof displayValue === 'string' && displayValue !== 'N/A') {
        if (['licenseNumber', 'passportNumber', 'sinNumber', 'businessNumber'].includes(label.toLowerCase().replace(/ /g, ''))) {
             finalDisplayValue = displayValue.length > 20 ? '********' : displayValue; 
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
      <header className="common-header">
        <div className="header-main">
          <h1>Job Seeker Profile</h1>
          <button 
            className="button" 
            onClick={() => navigate('/jobseekers')}
          >
            <ArrowLeft size={16} />
            <span>Back to Job Seekers</span>
          </button>
        </div>
        
        {updateStatus && (
          <div className="status-update-container">
            <span className="status-update-message">{updateStatus}</span>
          </div>
        )}
      </header>

      <main className="profile-main">
        <div className="profile-overview section-card">
          <div className="profile-banner">
           <div className={`profile-status ${profile?.verificationStatus || 'pending'}`}>
              {getStatusIcon()}
              <span className={`status-text ${profile?.verificationStatus || 'pending'}`}>
                {profile?.verificationStatus ? `Status: ${profile.verificationStatus.charAt(0).toUpperCase() + profile.verificationStatus.slice(1)}` : 'Status: Pending'}
              </span>
             
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
                 <span className="status-text">Update Status</span> <Pencil size={20} />
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
            <div className="profile-avatar-container">
            <div className="profile-avatar">
              <User size={40} />
            </div>
              <h1 className="profile-name">{displayName}</h1>
              </div>
            <div className="profile-info-header">
              <div className="profile-info-details">
                {renderDetailItem('Email', profile.email)}
                {renderDetailItem('Phone', profile.mobile)}
              </div>
              <div className="profile-info-details">
                {renderDetailItem('Location', displayLocation)}
                {renderDetailItem('Joined', formatDate(profile.createdAt))}
              </div>
              <div className="profile-info-details">
                {renderDetailItem('Last Updated', formatDate(profile.updatedAt))}
                {renderDetailItem('DOB', formatDate(profile.dob, false))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="profile-content grid-container">
          <div className="personal-details-section section-card">
            <h2 className="section-title">Personal Information</h2>
            <div className="detail-group">
              {renderDetailItem('First Name', profile.firstName)}
              {renderDetailItem('Last Name', profile.lastName)}
              {renderDetailItem('Email', profile.email)}
              {renderDetailItem('Mobile', profile.mobile)}
              {renderDetailItem('Date of Birth', formatDate(profile.dob, false))}
            </div>
          </div>
          
          <div className="identification-section section-card">
            <h2 className="section-title">Identification</h2>
            <div className="detail-group">
              {renderDetailItem('License Number', profile.licenseNumber)}
              {renderDetailItem('Passport Number', profile.passportNumber)}
              {renderDetailItem('SIN Number', profile.sinNumber)}
              {renderDetailItem('SIN Expiry', formatDate(profile.sinExpiry, false))}
              {renderDetailItem('Business Number', profile.businessNumber)}
              {renderDetailItem('Corporation Name', profile.corporationName)}
            </div>
          </div>
          
          <div className="address-section section-card">
            <h2 className="section-title">Address</h2>
            <div className="detail-group">
              {renderDetailItem('Street', profile.street)}
              {renderDetailItem('City', profile.city)}
              {renderDetailItem('Province', profile.province)}
              {renderDetailItem('Postal Code', profile.postalCode)}
            </div>
          </div>
          
          <div className="qualifications-section section-card">
            <h2 className="section-title">Qualifications</h2>
            <div className="detail-group">
              {renderDetailItem('Work Preference', profile?.workPreference)}
              {renderDetailItem('Bio', profile?.bio)}
              {renderDetailItem('License Type', profile?.licenseType)}
              {renderDetailItem('Experience', profile?.experience)}
              {renderDetailItem('Manual Driving', profile?.manualDriving)}
              {renderDetailItem('Availability', profile?.availability)}
              {renderDetailItem('Weekend Availability', profile?.weekendAvailability)}
            </div>
          </div>
          
          <div className="compensation-section section-card">
            <h2 className="section-title">Compensation</h2>
            <div className="detail-group">
              {renderDetailItem('Payrate Type', profile.payrateType)}
              {renderDetailItem('Bill Rate', profile.billRate)}
              {renderDetailItem('Pay Rate', profile.payRate)}
              {renderDetailItem('Payment Method', profile.paymentMethod)}
              {renderDetailItem('HST/GST', profile.hstGst)}
              {renderDetailItem('Cash Deduction', profile.cashDeduction)}
              {renderDetailItem('Overtime Enabled', profile.overtimeEnabled)}
              {profile.overtimeEnabled && (
                <>
                  {renderDetailItem('Overtime Hours After', profile.overtimeHours)}
                  {renderDetailItem('Overtime Bill Rate', profile.overtimeBillRate)}
                  {renderDetailItem('Overtime Pay Rate', profile.overtimePayRate)}
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
                  {renderDetailItem('Name', profile.creatorDetails.name)}
                  {renderDetailItem('Email', profile.creatorDetails.email)}
                  {renderDetailItem('User Type', profile.creatorDetails.userType)}
                  {renderDetailItem('Account Created At', formatDate(profile.creatorDetails.createdAt))}
                </div>
              ) : null}
              
              {profile.updaterDetails ? (
                <div className="detail-section">
                  <h3>Last Updated By</h3>
                  {renderDetailItem('Name', profile.updaterDetails.name)}
                  {renderDetailItem('Email', profile.updaterDetails.email)}
                  {renderDetailItem('User Type', profile.updaterDetails.userType)}
                  {renderDetailItem('Last Updated At', formatDate(profile.updaterDetails.updatedAt))}
                </div>
              ) : null}
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
            {(profile?.documents && profile.documents.length > 0) ? (
              <div className="document-list">
                {profile.documents.map((doc: DocumentRecord, index: number) => (
                  <div key={doc.id || index} className="document-item">
                    <div className="document-content">
                      <FileText size={18} className="document-icon" />
                      <div className="document-info">
                        <p className="document-name" title={doc.documentFileName}>{doc.documentFileName || 'Unnamed Document'}</p>
                        <p className="document-type">Type: {doc.documentType}</p>
                        {doc.documentTitle && <p className="document-title">Title: {doc.documentTitle}</p>}
                        {doc.documentNotes && <p className="document-notes">Notes: {doc.documentNotes}</p>}
                        
                        <div className="document-actions">
                          <button 
                            onClick={() => handlePreviewDocument(doc.documentPath, doc.documentFileName)} 
                            className="button primary"
                          >
                            <Eye size={16} /> Preview
                          </button>
                          <button 
                            onClick={() => handleDownloadDocument(doc.documentPath, doc.id, doc.documentFileName)} 
                            className="button primary"
                            disabled={downloadingDocId === doc.id}
                          >
                            {downloadingDocId === doc.id ? (
                              <>
                                <span className="download-spinner"></span> Downloading...
                              </>
                            ) : (
                              <>
                                <Download size={16} /> Download
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="document-preview">
                      {doc.documentPath ? (
                        <PDFThumbnail 
                          pdfUrl={pdfCache[doc.documentPath] || null}
                          onClick={() => handlePreviewDocument(doc.documentPath, doc.documentFileName)}
                        />
                      ) : (
                        <div className="document-preview-placeholder">
                          <FileWarning size={24} className="document-preview-placeholder-icon" />
                          <span>No preview available</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-documents">No documents uploaded.</p>
            )}
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
      <div className={`modal ${isStatusModalOpen ? 'open' : ''}`} onClick={() => setIsStatusModalOpen(false)}>
        <div className="status-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Update Profile Status</h3>
            <button className="close-button" onClick={() => setIsStatusModalOpen(false)}><XCircle size={20} /></button>
          </div>
          <div className="modal-body">
            <div className="status-options">
              <div className="status-option">
                <input 
                  type="radio" 
                  id="status-verified" 
                  name="status" 
                  value="verified"
                  checked={selectedStatus === 'verified'}
                  onChange={() => setSelectedStatus('verified')}
                  disabled={profile?.verificationStatus === 'verified'}
                />
                <label htmlFor="status-verified" className={`status-label ${profile?.verificationStatus === 'verified' ? 'disabled' : ''}`}>
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
                  checked={selectedStatus === 'rejected'}
                  onChange={() => setSelectedStatus('rejected')}
                  disabled={profile?.verificationStatus === 'rejected'}
                />
                <label htmlFor="status-rejected" className={`status-label ${profile?.verificationStatus === 'rejected' ? 'disabled' : ''}`}>
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
                  checked={selectedStatus === 'pending'}
                  onChange={() => setSelectedStatus('pending')}
                  disabled={profile?.verificationStatus === 'pending'}
                />
                <label htmlFor="status-pending" className={`status-label ${profile?.verificationStatus === 'pending' ? 'disabled' : ''}`}>
                  <Clock className="status-icon pending" size={18} />
                  <span>Pending</span>
                </label>
              </div>
            </div>
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