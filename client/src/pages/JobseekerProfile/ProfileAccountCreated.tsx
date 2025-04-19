import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { User, CheckCircle, Clock, Eye, EyeOff, Copy, ArrowLeft } from 'lucide-react';
import '../../styles/pages/JobseekerProfile.css';

// Define a profile type based on the Supabase DB fields
interface JobseekerProfile {
  id: string;
  user_id: string;
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

interface AccountCreatedState {
  email: string;
  password?: string;
  profile: JobseekerProfile;
  accountCreated: boolean;
}

export function ProfileAccountCreated() {
  const location = useLocation();
  const navigate = useNavigate();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'credentials' | 'profile'>('credentials');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isValidState, setIsValidState] = useState<boolean>(false);
  
  // Get data from state
  const state = location.state as AccountCreatedState;
  
  // Check if we have valid state data on component mount
  useEffect(() => {
    // Validate that we have the required state data with strict validation
    if (!state || !state.profile || !state.email || state.accountCreated === undefined) {
      console.log('Invalid state detected, redirecting to dashboard');
      // Redirect to dashboard if accessed directly
      navigate('/dashboard', { replace: true });
      return;
    }
    
    // Add an additional check for accountCreated status if password is expected
    if (state.accountCreated && !state.password) {
      console.log('Account created but password missing, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
      return;
    }
    
    setIsValidState(true);
  }, [state, navigate]);

  // If no valid state, show nothing while redirecting
  if (!isValidState) {
    return null;
  }
  
  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };
  
  const handleCopyCredentials = () => {
    const credentials = `Email: ${state.email}${state.password ? `\nPassword: ${state.password}` : ''}`;
    navigator.clipboard.writeText(credentials)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy credentials:', err);
        alert('Failed to copy credentials. Please copy them manually.');
      });
  };

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
    const firstName = state.profile.first_name || '';
    const lastName = state.profile.last_name || '';
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
            {state.accountCreated 
              ? 'A new account has been created for this jobseeker profile.' 
              : 'The jobseeker profile has been created successfully.'}
          </p>
        </div>
        
        <div className="profile-tabs">
          <button 
            className={`tab-button ${activeTab === 'credentials' ? 'active' : ''}`}
            onClick={() => setActiveTab('credentials')}
          >
            Credentials
          </button>
          <button 
            className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile Details
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'credentials' && (
            <div className="account-details">
              <h2>Account Information</h2>
              <div className="important-note">
                <strong>Important:</strong> {state.accountCreated 
                  ? 'Please provide these credentials to the jobseeker. They will need them to log in to their account.' 
                  : 'The profile is associated with this email address.'}
              </div>
              
              <div className="credentials-box">
                <div className="credential-row">
                  <span className="credential-label">Email:</span>
                  <span className="credential-value">{state.email}</span>
                </div>
                
                {state.accountCreated && state.password && (
                  <div className="credential-row">
                    <span className="credential-label">Password:</span>
                    <div className="password-container">
                      <span className="credential-value">
                        {passwordVisible ? state.password : '••••••••'}
                      </span>
                      <button 
                        className="toggle-password-btn"
                        onClick={togglePasswordVisibility}
                        aria-label={passwordVisible ? "Hide password" : "Show password"}
                      >
                        {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                )}
                
                <button 
                  className={`copy-btn ${copySuccess ? 'success' : ''}`} 
                  onClick={handleCopyCredentials}
                >
                  {copySuccess ? (
                    <>
                      <CheckCircle size={16} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copy Credentials
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
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
                </div>
              </div>

              <div className="profile-details-grid">
                <div className="details-section">
                  <h3 className="section-title">Personal Information</h3>
                  {renderDetailItem('First Name', state.profile.first_name)}
                  {renderDetailItem('Last Name', state.profile.last_name)}
                  {renderDetailItem('Email', state.profile.email)}
                  {renderDetailItem('Mobile', state.profile.mobile)}
                  {renderDetailItem('Date of Birth', formatDate(state.profile.dob))}
                </div>

                <div className="details-section">
                  <h3 className="section-title">Identification</h3>
                  {renderDetailItem('License Number', state.profile.license_number)}
                  {renderDetailItem('Passport Number', state.profile.passport_number)}
                  {renderDetailItem('SIN Number', state.profile.sin_number)}
                  {renderDetailItem('SIN Expiry', formatDate(state.profile.sin_expiry))}
                  {renderDetailItem('Business Number', state.profile.business_number)}
                  {renderDetailItem('Corporation Name', state.profile.corporation_name)}
                </div>

                <div className="details-section">
                  <h3 className="section-title">Address</h3>
                  {renderDetailItem('Street', state.profile.street)}
                  {renderDetailItem('City', state.profile.city)}
                  {renderDetailItem('Province', state.profile.province)}
                  {renderDetailItem('Postal Code', state.profile.postal_code)}
                </div>

                <div className="details-section">
                  <h3 className="section-title">Qualifications</h3>
                  {renderDetailItem('Work Preference', state.profile.work_preference)}
                  {renderDetailItem('Bio', state.profile.bio)}
                  {renderDetailItem('License Type', state.profile.license_type)}
                  {renderDetailItem('Experience', state.profile.experience)}
                  {renderDetailItem('Manual Driving', state.profile.manual_driving)}
                  {renderDetailItem('Availability', state.profile.availability)}
                  {renderDetailItem('Weekend Availability', state.profile.weekend_availability)}
                </div>

                <div className="details-section">
                  <h3 className="section-title">Compensation</h3>
                  {renderDetailItem('Payrate Type', state.profile.payrate_type)}
                  {renderDetailItem('Bill Rate', state.profile.bill_rate)}
                  {renderDetailItem('Pay Rate', state.profile.pay_rate)}
                  {renderDetailItem('Payment Method', state.profile.payment_method)}
                  {renderDetailItem('HST/GST', state.profile.hst_gst)}
                  {renderDetailItem('Cash Deduction', state.profile.cash_deduction)}
                  {renderDetailItem('Overtime Enabled', state.profile.overtime_enabled)}
                  {state.profile.overtime_enabled && (
                    <>
                      {renderDetailItem('Overtime Hours After', state.profile.overtime_hours)}
                      {renderDetailItem('Overtime Bill Rate', state.profile.overtime_bill_rate)}
                      {renderDetailItem('Overtime Pay Rate', state.profile.overtime_pay_rate)}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="verification-note">
          The profile is currently pending verification. Once verified, the jobseeker
          will be able to access all platform features{state.accountCreated ? ' using these credentials' : ''}.
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

export default ProfileAccountCreated; 