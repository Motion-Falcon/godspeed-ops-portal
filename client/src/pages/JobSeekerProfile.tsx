import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, User, CheckCircle, XCircle, Clock, FileText, Download } from 'lucide-react';
import { getJobseekerProfile, updateJobseekerStatus } from '../services/api';
import { DocumentRecord } from '../types/jobseeker';
import '../styles/pages/JobSeekerProfile.css';

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
  createdById?: string | null; // Added field
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

export function JobSeekerProfile() {
  const [profile, setProfile] = useState<FullJobseekerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();
  const { isAdmin, isRecruiter } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has access
    if (!isAdmin && !isRecruiter) {
      navigate('/dashboard');
      return;
    }

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

  const handleStatusUpdate = async (newStatus: 'verified' | 'rejected' | 'pending') => {
    if (!profile || !id) return;
    
    try {
      setUpdateStatus('Updating status...');
      const { profile: updatedProfileData } = await updateJobseekerStatus(id, newStatus);
      
      setProfile(updatedProfileData);
      setUpdateStatus(`Profile status updated to ${newStatus}`);
      
      setTimeout(() => setUpdateStatus(null), 3000);
    } catch (err) {
      setUpdateStatus(err instanceof Error ? err.message : 'Failed to update status');
      console.error('Error updating status:', err);
      
      setTimeout(() => setUpdateStatus(null), 3000);
    }
  };

  const getStatusIcon = () => {
    if (!profile?.verificationStatus) return null;
    
    switch (profile.verificationStatus) {
      case 'verified':
        return <CheckCircle className="status-icon verified" />;
      case 'rejected':
        return <XCircle className="status-icon rejected" />;
      case 'pending':
        return <Clock className="status-icon pending" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
      let date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
      const datePart = dateString.split('T')[0];
      date = new Date(datePart + 'T00:00:00Z');
       if (!isNaN(date.getTime())) {
         return date.toLocaleDateString();
       }
    } catch (e) {
       console.warn(`Failed to parse date: ${dateString}`, e);
    }
    return dateString;
  };

  const handleDownloadDocument = (documentPath?: string | null) => {
    if (!documentPath) {
      alert('Document path is missing.');
      return;
    }
    alert('Download functionality needs backend implementation (e.g., signed URLs or download endpoint).');
    console.log("Attempting download for path:", documentPath);
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
              className="button ghost" 
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
      <header className="profile-header">
        <div className="header-content">
          <button 
            className="button ghost back-button" 
            onClick={() => navigate('/jobseekers')}
          >
            <ArrowLeft size={16} />
            <span>Back to Job Seekers</span>
          </button>
          <div className="status-actions">
            {updateStatus && (
              <span className="status-update-message">{updateStatus}</span>
            )}
            <div className="status-buttons">
              <button 
                className={`button ${profile.verificationStatus === 'verified' ? 'success' : 'outline'}`}
                onClick={() => handleStatusUpdate('verified')}
                disabled={profile.verificationStatus === 'verified'}
              >
                <CheckCircle size={16} />
                Verify
              </button>
              <button 
                className={`button ${profile.verificationStatus === 'rejected' ? 'error' : 'outline'}`}
                onClick={() => handleStatusUpdate('rejected')}
                disabled={profile.verificationStatus === 'rejected'}
              >
                <XCircle size={16} />
                Reject
              </button>
              <button 
                className={`button ${profile.verificationStatus === 'pending' ? 'warning' : 'outline'}`}
                onClick={() => handleStatusUpdate('pending')}
                disabled={profile.verificationStatus === 'pending'}
              >
                <Clock size={16} />
                Mark Pending
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="profile-main">
        <div className="profile-overview section-card">
          <div className="profile-banner">
            <div className="profile-status">
              {getStatusIcon()}
              <span className={`status-text ${profile.verificationStatus}`}>
                {(profile.verificationStatus || 'pending').charAt(0).toUpperCase() + (profile.verificationStatus || 'pending').slice(1)}
              </span>
            </div>
          </div>
          
          <div className="profile-details">
            <div className="profile-avatar">
              <User size={40} />
            </div>
            <div className="profile-info-header">
              <h1 className="profile-name">{displayName}</h1>
              {renderDetailItem('Email', profile.email)}
              {renderDetailItem('Phone', profile.mobile)}
              {renderDetailItem('Location', displayLocation)}
              {renderDetailItem('Joined', formatDate(profile.createdAt))}
              {renderDetailItem('Last Updated', formatDate(profile.updatedAt))}
              {renderDetailItem('DOB', formatDate(profile.dob))}
            </div>
          </div>
        </div>
        
        <div className="profile-content grid-container">
          <div className="personal-details-section section-card">
            <h2 className="section-title">Personal & ID</h2>
            {renderDetailItem('First Name', profile.firstName)}
            {renderDetailItem('Last Name', profile.lastName)}
            {renderDetailItem('Street', profile.street)}
            {renderDetailItem('City', profile.city)}
            {renderDetailItem('Province', profile.province)}
            {renderDetailItem('Postal Code', profile.postalCode)}
            {renderDetailItem('License Number', profile.licenseNumber)}
            {renderDetailItem('Passport Number', profile.passportNumber)}
            {renderDetailItem('SIN Number', profile.sinNumber)}
            {renderDetailItem('SIN Expiry', formatDate(profile.sinExpiry))}
            {renderDetailItem('Business Number', profile.businessNumber)}
            {renderDetailItem('Corporation Name', profile.corporationName)}
            {renderDetailItem('Profile Created By User ID', profile.createdById)}
          </div>
          
          <div className="skills-qualifications-section section-card">
            <h2 className="section-title">Skills & Qualifications</h2>
            {renderDetailItem('Work Preference', profile.workPreference)}
            {renderDetailItem('License Type', profile.licenseType)}
            {renderDetailItem('Experience Summary', profile.experience)}
            {renderDetailItem('Manual Driving', profile.manualDriving)}
            {renderDetailItem('Availability', profile.availability)}
            {renderDetailItem('Weekend Availability', profile.weekendAvailability)}
          </div>
          
          <div className="compensation-section section-card">
            <h2 className="section-title">Compensation</h2>
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
          
          <div className="documents-section section-card">
            <h2 className="section-title">Uploaded Documents</h2>
            {(profile.documents && profile.documents.length > 0) ? (
              <div className="document-list">
                {profile.documents.map((doc: DocumentRecord, index: number) => (
                  <div key={doc.id || index} className="document-item">
                    <FileText size={18} className="document-icon" />
                    <div className="document-info">
                      <p className="document-name" title={doc.documentFileName}>{doc.documentFileName || 'Unnamed Document'}</p>
                      <p className="document-type">Type: {doc.documentType}</p>
                      {doc.documentTitle && <p className="document-title">Title: {doc.documentTitle}</p>}
                      {doc.documentNotes && <p className="document-notes">Notes: {doc.documentNotes}</p>}
                    </div>
                    <button 
                      className="button icon-button secondary"
                      onClick={() => handleDownloadDocument(doc.documentPath)}
                      disabled={!doc.documentPath} 
                      title={doc.documentPath ? "Download Document (Requires Backend Implementation)" : "Document path missing"}
                    >
                      <Download size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-section">No documents uploaded.</p>
            )}
          </div>
          
        </div>
      </main>
    </div>
  );
} 