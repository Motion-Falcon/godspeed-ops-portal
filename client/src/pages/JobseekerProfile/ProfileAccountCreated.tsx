import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { User, CheckCircle, Clock, Eye, EyeOff, Copy, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../contexts/language/language-provider';
import '../../styles/pages/JobseekerProfileStyles.css';

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
  const { t } = useLanguage();
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
    const credentials = `${t('profileAccountCreated.email')}: ${state.email}${state.password ? `\n${t('profileAccountCreated.password')}: ${state.password}` : ''}`;
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
    if (!dateString) return t('profileAccountCreated.na');
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
    const displayValue = value === null || value === undefined || value === '' ? t('profileAccountCreated.na') : 
                         typeof value === 'boolean' ? (value ? t('profileAccountCreated.yes') : t('profileAccountCreated.no')) : 
                         value;
    
    let finalDisplayValue: string | number = displayValue;
    if (typeof displayValue === 'string' && displayValue !== t('profileAccountCreated.na')) {
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
          className="button" 
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft size={16} />
          <span>{t('profileAccountCreated.backToDashboard')}</span>
        </button>
        
        <div className="success-header">
          <div className="success-icon">
            <CheckCircle size={48} color="#4CAF50" />
          </div>
          
          <h1>{t('profileAccountCreated.title')}</h1>
          
          <p className="success-message">
            {state.accountCreated 
              ? t('profileAccountCreated.accountCreatedMessage') 
              : t('profileAccountCreated.profileCreatedMessage')}
          </p>
        </div>
        
        <div className="profile-tabs">
          <button 
            className={`tab-button ${activeTab === 'credentials' ? 'active' : ''}`}
            onClick={() => setActiveTab('credentials')}
          >
            {t('profileAccountCreated.credentialsTab')}
          </button>
          <button 
            className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            {t('profileAccountCreated.profileDetailsTab')}
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'credentials' && (
            <div className="account-details">
              <h2>{t('profileAccountCreated.accountInformation')}</h2>
              <div className="important-note">
                <strong>Important:</strong> {state.accountCreated 
                  ? t('profileAccountCreated.importantAccountNote') 
                  : t('profileAccountCreated.importantProfileNote')}
              </div>
              
              <div className="credentials-box">
                <div className="credential-row">
                  <span className="credential-label">{t('profileAccountCreated.email')}:</span>
                  <span className="credential-value">{state.email}</span>
                </div>
                
                {state.accountCreated && state.password && (
                  <div className="credential-row">
                    <span className="credential-label">{t('profileAccountCreated.password')}:</span>
                    <div className="password-container">
                      <span className="credential-value">
                        {passwordVisible ? state.password : '••••••••'}
                      </span>
                      <button 
                        className="toggle-password-btn"
                        onClick={togglePasswordVisibility}
                        aria-label={passwordVisible ? t('profileAccountCreated.hidePassword') : t('profileAccountCreated.showPassword')}
                      >
                        {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                )}
                
                <button 
                  className={`button ${copySuccess ? 'success' : ''}`} 
                  onClick={handleCopyCredentials}
                >
                  {copySuccess ? (
                    <>
                      <CheckCircle size={16} />
                      {t('profileAccountCreated.copied')}
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      {t('profileAccountCreated.copyCredentials')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="profile-main">
              <div className="profile-overview section-card">
                <div className="profile-banner">
                  <div className="profile-status pending">
                    <Clock className="status-icon pending" />
                    <span className="status-text pending">{t('profileAccountCreated.statusPending')}</span>
                  </div>
                </div>
                
                <div className="profile-details">
                  <div className="profile-avatar-container">
                    <div className="profile-avatar">
                      <User size={40} />
                    </div>
                    <h1 className="profile-name">{getDisplayName()}</h1>
                  </div>
                  <div className="profile-info-header">
                    <div className="profile-info-details">
                      {renderDetailItem(t('profileAccountCreated.email'), state.profile.email)}
                      {renderDetailItem(t('profileAccountCreated.mobile'), state.profile.mobile)}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="profile-content grid-container">
                <div className="personal-details-section section-card">
                  <h2 className="section-title">{t('profileAccountCreated.personalInformation')}</h2>
                  <div className="detail-group">
                    {renderDetailItem(t('profileAccountCreated.firstName'), state.profile.first_name)}
                    {renderDetailItem(t('profileAccountCreated.lastName'), state.profile.last_name)}
                    {renderDetailItem(t('profileAccountCreated.email'), state.profile.email)}
                    {renderDetailItem(t('profileAccountCreated.mobile'), state.profile.mobile)}
                    {renderDetailItem(t('profileAccountCreated.dateOfBirth'), formatDate(state.profile.dob))}
                  </div>
                </div>

                <div className="identification-section section-card">
                  <h2 className="section-title">{t('profileAccountCreated.identification')}</h2>
                  <div className="detail-group">
                    {renderDetailItem(t('profileAccountCreated.licenseNumber'), state.profile.license_number)}
                    {renderDetailItem(t('profileAccountCreated.passportNumber'), state.profile.passport_number)}
                    {renderDetailItem(t('profileAccountCreated.sinNumber'), state.profile.sin_number)}
                    {renderDetailItem(t('profileAccountCreated.sinExpiry'), formatDate(state.profile.sin_expiry))}
                    {renderDetailItem(t('profileAccountCreated.businessNumber'), state.profile.business_number)}
                    {renderDetailItem(t('profileAccountCreated.corporationName'), state.profile.corporation_name)}
                  </div>
                </div>

                <div className="address-section section-card">
                  <h2 className="section-title">{t('profileAccountCreated.address')}</h2>
                  <div className="detail-group">
                    {renderDetailItem(t('profileAccountCreated.street'), state.profile.street)}
                    {renderDetailItem(t('profileAccountCreated.city'), state.profile.city)}
                    {renderDetailItem(t('profileAccountCreated.province'), state.profile.province)}
                    {renderDetailItem(t('profileAccountCreated.postalCode'), state.profile.postal_code)}
                  </div>
                </div>

                <div className="qualifications-section section-card">
                  <h2 className="section-title">{t('profileAccountCreated.qualifications')}</h2>
                  <div className="detail-group">
                    {renderDetailItem(t('profileAccountCreated.workPreference'), state.profile.work_preference)}
                    {renderDetailItem(t('profileAccountCreated.bio'), state.profile.bio)}
                    {renderDetailItem(t('profileAccountCreated.licenseType'), state.profile.license_type)}
                    {renderDetailItem(t('profileAccountCreated.experience'), state.profile.experience)}
                    {renderDetailItem(t('profileAccountCreated.manualDriving'), state.profile.manual_driving)}
                    {renderDetailItem(t('profileAccountCreated.availability'), state.profile.availability)}
                    {renderDetailItem(t('profileAccountCreated.weekendAvailability'), state.profile.weekend_availability)}
                  </div>
                </div>

                <div className="compensation-section section-card">
                  <h2 className="section-title">{t('profileAccountCreated.compensation')}</h2>
                  <div className="detail-group">
                    {renderDetailItem(t('profileAccountCreated.payrateType'), state.profile.payrate_type)}
                    {renderDetailItem(t('profileAccountCreated.billRate'), state.profile.bill_rate)}
                    {renderDetailItem(t('profileAccountCreated.payRate'), state.profile.pay_rate)}
                    {renderDetailItem(t('profileAccountCreated.paymentMethod'), state.profile.payment_method)}
                    {renderDetailItem(t('profileAccountCreated.hstGst'), state.profile.hst_gst)}
                    {renderDetailItem(t('profileAccountCreated.cashDeduction'), state.profile.cash_deduction)}
                    {renderDetailItem(t('profileAccountCreated.overtimeEnabled'), state.profile.overtime_enabled)}
                    {state.profile.overtime_enabled && (
                      <>
                        {renderDetailItem(t('profileAccountCreated.overtimeHoursAfter'), state.profile.overtime_hours)}
                        {renderDetailItem(t('profileAccountCreated.overtimeBillRate'), state.profile.overtime_bill_rate)}
                        {renderDetailItem(t('profileAccountCreated.overtimePayRate'), state.profile.overtime_pay_rate)}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="verification-note">
          {state.accountCreated 
            ? t('profileAccountCreated.verificationNoteWithCredentials')
            : t('profileAccountCreated.verificationNote')}
        </div>
        
        <div className="actions">
          <button 
            className="button primary"
            onClick={() => navigate('/dashboard')}
          >
            {t('profileAccountCreated.returnToDashboard')}
          </button>
          
          <button 
            className="button secondary"
            onClick={() => navigate('/jobseekers')}
          >
            {t('profileAccountCreated.viewAllJobseekers')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileAccountCreated; 