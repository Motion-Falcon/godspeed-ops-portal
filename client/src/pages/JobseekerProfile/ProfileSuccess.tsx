import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { User, CheckCircle, Clock, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../contexts/language/language-provider';
import '../../styles/pages/JobseekerProfileStyles.css';

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
  work_permit_uci?: string;
  work_permit_expiry?: string;
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
  const { t } = useLanguage();
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
    if (!dateString) return t('jobSeekerProfile.nA');
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
    const displayValue = value === null || value === undefined || value === '' ? t('jobSeekerProfile.nA') : 
                         typeof value === 'boolean' ? (value ? t('jobSeekerProfile.yes') : t('jobSeekerProfile.no')) : 
                         value;
    
    let finalDisplayValue: string | number = displayValue;
    if (typeof displayValue === 'string' && displayValue !== t('jobSeekerProfile.nA')) {
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
          className="button" 
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeft size={16} />
          <span>{t('jobSeekerProfile.backToDashboard')}</span>
        </button>
        
        <div className="success-header">
          <div className="success-icon">
            <CheckCircle size={48} color="#4CAF50" />
          </div>
          
          <h1>{t('profileSuccess.title')}</h1>
          
          <p className="success-message">
            {t('profileSuccess.title')}
          </p>
        </div>
        
        <div className="profile-main">
          <div className="profile-overview section-card">
            <div className="profile-banner">
              <div className="profile-status pending">
                <Clock className="status-icon pending" />
                <span className="status-text pending">{t('status.pending')}</span>
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
                  {renderDetailItem(t('jobSeekerProfile.email'), profile.email)}
                  {renderDetailItem(t('profileSuccess.phone'), profile.mobile)}
                </div>
              </div>
            </div>
          </div>
          
          <div className="profile-content grid-container">
            <div className="personal-details-section section-card">
              <h2 className="section-title">{t('jobSeekerProfile.personalInformation')}</h2>
              <div className="detail-group">
                {renderDetailItem(t('jobSeekerProfile.firstName'), profile.first_name)}
                {renderDetailItem(t('jobSeekerProfile.lastName'), profile.last_name)}
                {renderDetailItem(t('jobSeekerProfile.email'), profile.email)}
                {renderDetailItem(t('jobSeekerProfile.mobile'), profile.mobile)}
                {renderDetailItem(t('jobSeekerProfile.dateOfBirth'), formatDate(profile.dob))}
              </div>
            </div>

            <div className="identification-section section-card">
              <h2 className="section-title">{t('jobSeekerProfile.identification')}</h2>
              <div className="detail-group">
                {renderDetailItem(t('jobSeekerProfile.licenseNumber'), profile.license_number)}
                {renderDetailItem(t('jobSeekerProfile.passportNumber'), profile.passport_number)}
                {renderDetailItem(t('jobSeekerProfile.sinNumber'), profile.sin_number)}
                {renderDetailItem(t('jobSeekerProfile.sinExpiry'), formatDate(profile.sin_expiry))}
                {profile.work_permit_uci && renderDetailItem(t('profileCreate.personalInfo.workPermitUci'), profile.work_permit_uci)}
                {profile.work_permit_expiry && renderDetailItem(t('profileCreate.personalInfo.workPermitExpiry'), formatDate(profile.work_permit_expiry))}
                {renderDetailItem(t('jobSeekerProfile.businessNumber'), profile.business_number)}
                {renderDetailItem(t('jobSeekerProfile.corporationName'), profile.corporation_name)}
              </div>
            </div>

            <div className="address-section section-card">
              <h2 className="section-title">{t('jobSeekerProfile.address')}</h2>
              <div className="detail-group">
                {renderDetailItem(t('jobSeekerProfile.street'), profile.street)}
                {renderDetailItem(t('jobSeekerProfile.city'), profile.city)}
                {renderDetailItem(t('jobSeekerProfile.province'), profile.province)}
                {renderDetailItem(t('jobSeekerProfile.postalCode'), profile.postal_code)}
              </div>
            </div>

            <div className="qualifications-section section-card">
              <h2 className="section-title">{t('jobSeekerProfile.qualifications')}</h2>
              <div className="detail-group">
                {renderDetailItem(t('jobSeekerProfile.workPreference'), profile.work_preference)}
                {renderDetailItem(t('jobSeekerProfile.bio'), profile.bio)}
                {renderDetailItem(t('jobSeekerProfile.licenseType'), profile.license_type)}
                {renderDetailItem(t('jobSeekerProfile.experience'), profile.experience)}
                {renderDetailItem(t('jobSeekerProfile.manualDriving'), profile.manual_driving)}
                {renderDetailItem(t('jobSeekerProfile.availability'), profile.availability)}
                {renderDetailItem(t('jobSeekerProfile.weekendAvailability'), profile.weekend_availability)}
              </div>
            </div>

            <div className="compensation-section section-card">
              <h2 className="section-title">{t('jobSeekerProfile.compensation')}</h2>
              <div className="detail-group">
                {renderDetailItem(t('jobSeekerProfile.payrateType'), profile.payrate_type)}
                {renderDetailItem(t('jobSeekerProfile.billRate'), profile.bill_rate)}
                {renderDetailItem(t('jobSeekerProfile.payRate'), profile.pay_rate)}
                {renderDetailItem(t('jobSeekerProfile.paymentMethod'), profile.payment_method)}
                {renderDetailItem(t('jobSeekerProfile.hstGst'), profile.hst_gst)}
                {renderDetailItem(t('jobSeekerProfile.cashDeduction'), profile.cash_deduction)}
                {renderDetailItem(t('jobSeekerProfile.overtimeEnabled'), profile.overtime_enabled)}
                {profile.overtime_enabled && (
                  <>
                    {renderDetailItem(t('jobSeekerProfile.overtimeHoursAfter'), profile.overtime_hours)}
                    {renderDetailItem(t('jobSeekerProfile.overtimeBillRate'), profile.overtime_bill_rate)}
                    {renderDetailItem(t('jobSeekerProfile.overtimePayRate'), profile.overtime_pay_rate)}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="verification-note">
          {t('profileSuccess.verificationNote')}
        </div>
        
        <div className="actions">
          <button 
            className="button primary"
            onClick={() => navigate('/dashboard')}
          >
            {t('profileSuccess.returnToDashboard')}
          </button>
          
          <button 
            className="button secondary"
            onClick={() => navigate('/jobseekers')}
          >
            {t('profileSuccess.viewAllJobseekers')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileSuccess; 