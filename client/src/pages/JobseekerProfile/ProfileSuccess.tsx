import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { User, CheckCircle, Clock, ArrowLeft } from 'lucide-react';
import '../../styles/pages/JobseekerProfile.css';

// Define a profile type based on the Supabase DB fields
interface JobseekerProfile {
  id: string;
  user_id?: string;
  first_name?: string;
  last_name?: string;
  dob?: string;
  email?: string;
  mobile?: string;
  license_number?: string;
  passport_number?: string;
  sin_number?: string;
  sin_expiry?: string;
  business_number?: string;
  corporation_name?: string;
  street?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  work_preference?: string;
  bio?: string;
  license_type?: string;
  experience?: string;
  manual_driving?: string;
  availability?: string;
  weekend_availability?: boolean;
  payrate_type?: string;
  bill_rate?: string;
  pay_rate?: string;
  payment_method?: string;
  hst_gst?: string;
  cash_deduction?: string;
  overtime_enabled?: boolean;
  overtime_hours?: string;
  overtime_bill_rate?: string;
  overtime_pay_rate?: string;
  documents?: Array<{
    id?: string;
    documentType: string;
    documentTitle?: string;
    documentPath?: string;
    documentFileName?: string;
    documentNotes?: string;
  }>;
  verification_status?: string;
  created_at?: string;
  updated_at?: string;
  created_by_user_id?: string;
}

interface SuccessState {
  message: string;
  profileId?: string;
  profile?: JobseekerProfile;
}

export function ProfileSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isValidState, setIsValidState] = useState<boolean>(false);
  
  // Get data from state
  const state = location.state as SuccessState;
  
  console.log('[ProfileSuccess] Received state:', state);
  
  // Check if we have valid state data on component mount
  useEffect(() => {
    // Validate that we have the required state data
    if (!state || !state.message || (!state.profile && !state.profileId)) {
      console.log('[ProfileSuccess] Invalid state detected, redirecting to dashboard');
      // Redirect to dashboard if accessed directly
      navigate('/dashboard', { replace: true });
      return;
    }
    
    setIsValidState(true);
  }, [state, navigate]);

  // If no valid state, show nothing while redirecting
  if (!isValidState || !state.profile) {
    return null;
  }
  
  // At this point, state.profile is guaranteed to be defined
  const profile = state.profile;
  
  // Helper function to format date
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

  // Helper function to render detail items
  const renderDetailItem = (label: string, value?: string | number | boolean | null) => {
    const displayValue = value === null || value === undefined || value === '' ? 'N/A' : 
                         typeof value === 'boolean' ? (value ? 'Yes' : 'No') : 
                         value;
    
    let finalDisplayValue: string | number = displayValue;
    if (typeof displayValue === 'string' && displayValue !== 'N/A') {
        if (['license_number', 'passport_number', 'sin_number', 'business_number'].includes(label.toLowerCase().replace(/ /g, ''))) {
             finalDisplayValue = displayValue.length > 20 ? '********' : displayValue; 
        }
    }

    return (
      <div className="detail-item">
        <p className="detail-label">{label}</p>
        <p className="detail-value">{finalDisplayValue}</p>
      </div>
    );
  };

  // Get name from profile
  const getDisplayName = (): string => {
    const firstName = profile.first_name || '';
    const lastName = profile.last_name || '';
    return `${firstName} ${lastName}`.trim() || 'Unnamed Profile';
  };
  
  return (
    <div className="profile-created-container">
      <div className="success-card wide-card">
        <button 
          className="back-button" 
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
        
        <div className="success-header">
          <div className="success-icon">
            <CheckCircle size={48} color="#4CAF50" />
          </div>
          
          <h1>Profile Created Successfully!</h1>
          
          <p className="success-message">
            {state.message || 'The jobseeker profile has been created successfully.'}
          </p>
        </div>
        
        <div className="profile-overview">
          <div className="profile-banner">
            <div className="profile-status">
              <Clock className="status-icon pending" />
              <span className="status-text pending">Pending</span>
            </div>
          </div>
          
          <div className="profile-details">
            <div className="profile-avatar">
              <User size={40} />
            </div>
            <div className="profile-info-header">
              <h1 className="profile-name">{getDisplayName()}</h1>
              <p className="profile-email">{profile.email || 'No email provided'}</p>
            </div>
          </div>

          <div className="profile-details-grid">
            <div className="details-section">
              <h3 className="section-title">Personal Information</h3>
              {renderDetailItem('First Name', profile.first_name)}
              {renderDetailItem('Last Name', profile.last_name)}
              {renderDetailItem('Email', profile.email)}
              {renderDetailItem('Mobile', profile.mobile)}
              {renderDetailItem('Date of Birth', formatDate(profile.dob))}
            </div>

            <div className="details-section">
              <h3 className="section-title">Identification</h3>
              {renderDetailItem('License Number', profile.license_number)}
              {renderDetailItem('Passport Number', profile.passport_number)}
              {renderDetailItem('SIN Number', profile.sin_number)}
              {renderDetailItem('SIN Expiry', formatDate(profile.sin_expiry))}
              {renderDetailItem('Business Number', profile.business_number)}
              {renderDetailItem('Corporation Name', profile.corporation_name)}
            </div>

            <div className="details-section">
              <h3 className="section-title">Address</h3>
              {renderDetailItem('Street', profile.street)}
              {renderDetailItem('City', profile.city)}
              {renderDetailItem('Province', profile.province)}
              {renderDetailItem('Postal Code', profile.postal_code)}
            </div>

            <div className="details-section">
              <h3 className="section-title">Qualifications</h3>
              {renderDetailItem('Work Preference', profile.work_preference)}
              {renderDetailItem('Bio', profile.bio)}
              {renderDetailItem('License Type', profile.license_type)}
              {renderDetailItem('Experience', profile.experience)}
              {renderDetailItem('Manual Driving', profile.manual_driving)}
              {renderDetailItem('Availability', profile.availability)}
              {renderDetailItem('Weekend Availability', profile.weekend_availability)}
            </div>

            <div className="details-section">
              <h3 className="section-title">Compensation</h3>
              {renderDetailItem('Payrate Type', profile.payrate_type)}
              {renderDetailItem('Bill Rate', profile.bill_rate)}
              {renderDetailItem('Pay Rate', profile.pay_rate)}
              {renderDetailItem('Payment Method', profile.payment_method)}
              {renderDetailItem('HST/GST', profile.hst_gst)}
              {renderDetailItem('Cash Deduction', profile.cash_deduction)}
              {renderDetailItem('Overtime Enabled', profile.overtime_enabled)}
              {profile.overtime_enabled && (
                <>
                  {renderDetailItem('Overtime Hours After', profile.overtime_hours)}
                  {renderDetailItem('Overtime Bill Rate', profile.overtime_bill_rate)}
                  {renderDetailItem('Overtime Pay Rate', profile.overtime_pay_rate)}
                </>
              )}
            </div>
            
            {profile.documents && profile.documents.length > 0 && (
              <div className="details-section">
                <h3 className="section-title">Documents</h3>
                {profile.documents.map((doc, index) => (
                  <div key={doc.id || index} className="document-item">
                    {renderDetailItem(`Document ${index + 1}`, doc.documentType)}
                    {doc.documentTitle && renderDetailItem('Title', doc.documentTitle)}
                    {doc.documentFileName && renderDetailItem('File', doc.documentFileName)}
                    {doc.documentNotes && renderDetailItem('Notes', doc.documentNotes)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="verification-note">
          The profile is currently pending verification. Once verified, the jobseeker
          will be able to access all platform features.
        </div>
        
        <div className="actions">
          <button 
            className="button primary"
            onClick={() => navigate('/dashboard')}
          >
            Return to Dashboard
          </button>
          
          <button 
            className="button secondary"
            onClick={() => navigate('/jobseekers')}
          >
            View All Jobseekers
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileSuccess; 