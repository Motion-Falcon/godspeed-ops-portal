import { useFormContext } from 'react-hook-form';
import { personalInfoSchema } from './ProfileCreate';
import { z } from 'zod';
import { useState, useEffect, useRef } from 'react';
import { checkEmailAvailability } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';

type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;

interface PersonalInfoFormProps {
  currentStep: number;
  allFields: string[];
  onEmailAvailabilityChange?: (isAvailable: boolean | null) => void;
  disableEmail?: boolean;
}

export function PersonalInfoForm({ allFields, onEmailAvailabilityChange, disableEmail = false }: PersonalInfoFormProps) {
  const { register, formState, watch, setError, clearErrors } = useFormContext<PersonalInfoFormData>();
  const { errors: allErrors } = formState;
  const navigate = useNavigate();
  
  // Add state for email validation
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailAvailabilityMessage, setEmailAvailabilityMessage] = useState<string | null>(null);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [existingProfileId, setExistingProfileId] = useState<string | null>(null);
  const [existingDraftId, setExistingDraftId] = useState<string | null>(null);
  
  // Watch the email field for changes
  const watchedEmail = watch('email');
  const emailTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Add a ref to track the latest request
  const latestRequestRef = useRef<number>(0);
  
  // Function to check if we should show an error for a specific field
  const shouldShowError = (fieldName: string) => {
    return allFields.includes(fieldName) && allErrors[fieldName as keyof typeof allErrors];
  };

  // Handle the navigation to view a profile or edit a draft
  const handleViewProfile = () => {
    if (existingProfileId) {
      navigate(`/jobseekers/${existingProfileId}`);
    }
  };

  const handleEditDraft = () => {
    if (existingDraftId) {
      navigate(`/jobseekers/drafts/edit/${existingDraftId}`);
    }
  };

  // Effect to check email availability when the email changes
  useEffect(() => {
    // If email is disabled (for jobseekers using their own email), skip validation
    if (disableEmail) {
      setEmailAvailabilityMessage(null);
      setEmailAvailable(true); // Assume email is available since it's their own
      if (onEmailAvailabilityChange) {
        onEmailAvailabilityChange(true);
      }
      return;
    }
    
    // Clear any previous timeout
    if (emailTimeoutRef.current) {
      clearTimeout(emailTimeoutRef.current);
    }
    
    // Reset states when email changes
    setExistingProfileId(null);
    setExistingDraftId(null);
    
    // Don't do anything if the email is empty or invalid format
    if (!watchedEmail || watchedEmail.length < 5 || !watchedEmail.includes('@')) {
      setEmailAvailabilityMessage(null);
      setEmailAvailable(null);
      // Only call the callback if our state is actually changing to avoid render loops
      if (emailAvailable !== null) {
        if (onEmailAvailabilityChange) {
          onEmailAvailabilityChange(null);
        }
      }
      return;
    }
    
    // Store the current email to compare later to avoid stale closures
    const currentEmail = watchedEmail;
    
    // Create a reference to the current request to track the latest
    const requestId = Date.now();
    latestRequestRef.current = requestId;
    
    setIsCheckingEmail(true);
    setEmailAvailabilityMessage('Checking availability...');
    
    // Set a timeout to delay the API call (similar to debounce)
    emailTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('Checking email availability for:', currentEmail);
        const result = await checkEmailAvailability(currentEmail);
        console.log('Email check result:', result);
        
        // Only update state if this is still the latest request
        if (latestRequestRef.current !== requestId) return;
        
        // Store response values in state
        setEmailAvailable(result.available);
        setExistingProfileId(result.existingProfileId || null);
        setExistingDraftId(result.existingDraftId || null);
        
        // Notify parent component about availability change
        if (onEmailAvailabilityChange) {
          onEmailAvailabilityChange(result.available);
        }
        
        // Set the appropriate message based on the response
        if (result.available) {
          clearErrors('email');
          setEmailAvailabilityMessage('✓ Email is available');
        } else if (result.existingProfileId) {
          setError('email', { 
            type: 'manual', 
            message: 'A jobseeker profile already exists with this email. Please use a different email.'
          });
          setEmailAvailabilityMessage('✗ A jobseeker profile already exists with this email.');
        } else if (result.existingDraftId) {
          setError('email', { 
            type: 'manual', 
            message: 'A draft with this email already exists.'
          });
          setEmailAvailabilityMessage('✗ A draft with this email already exists.');
        } else {
          setError('email', { 
            type: 'manual', 
            message: 'This email is already in use.'
          });
          setEmailAvailabilityMessage('✗ Email is already in use');
        }
      } catch (error) {
        // Only update state if this is still the latest request
        if (latestRequestRef.current !== requestId) return;
        
        console.error('Error checking email:', error);
        setEmailAvailabilityMessage(null);
        setEmailAvailable(null);
        
        // Only call if our value is changing to prevent loops
        if (emailAvailable !== null && onEmailAvailabilityChange) {
          onEmailAvailabilityChange(null);
        }
      } finally {
        if (latestRequestRef.current === requestId) {
          setIsCheckingEmail(false);
        }
      }
    }, 500); // 500ms delay
    
    // Clean up timeout on unmount
    return () => {
      if (emailTimeoutRef.current) {
        clearTimeout(emailTimeoutRef.current);
      }
    };
  // Disable the ESLint exhaustive-deps warning since we're handling dependencies manually
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedEmail, disableEmail]);

  return (
    <div className="form-containerform-step-container">
      <h2>Personal Information</h2>
      <p className="form-description">Please provide your basic personal information. Fields marked with * are required.</p>

      <div className="form-row name-dob-row">
        <div className="form-group">
          <label htmlFor="firstName" className="form-label" data-required="*">First Name</label>
          <input
            id="firstName"
            type="text"
            className="form-input"
            placeholder="Your first name"
            {...register('firstName')}
          />
          {shouldShowError('firstName') && (
            <p className="error-message">{allErrors.firstName?.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="lastName" className="form-label" data-required="*">Last Name</label>
          <input
            id="lastName"
            type="text"
            className="form-input"
            placeholder="Your last name"
            {...register('lastName')}
          />
          {shouldShowError('lastName') && (
            <p className="error-message">{allErrors.lastName?.message}</p>
          )}
        </div>

        <div className="form-group dob-group">
          <label htmlFor="dob" className="form-label" data-required="*">Date of Birth</label>
          <div className="date-picker-container">
            <Calendar size={14} className="date-picker-icon" />
            <input
              id="dob"
              type="date"
              className="form-input"
              {...register('dob')}
              onClick={(e) => e.currentTarget.showPicker()}
            />
          </div>
          {shouldShowError('dob') && (
            <p className="error-message">{allErrors.dob?.message}</p>
          )}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="email" className="form-label" data-required="*">Email</label>
          <input
            id="email"
            type="email"
            className="form-input"
            placeholder="your.email@example.com"
            {...register('email')}
            disabled={disableEmail}
            readOnly={disableEmail}
          />
          {disableEmail && (
            <p className="field-note">Email cannot be changed as it's used as a unique identifier for this profile.</p>
          )}
          {!disableEmail && emailAvailabilityMessage && (
            <div className="email-validation-container">
              <p className={`availability-message ${emailAvailable ? 'success' : 'error'}`}>
                {isCheckingEmail ? 'Checking...' : emailAvailabilityMessage}
              </p>
              
              {/* Show View Profile button if email exists in a profile */}
              {existingProfileId && !isCheckingEmail && (
                <button 
                  type="button" 
                  className="button secondary sm" 
                  onClick={handleViewProfile}
                >
                  View Profile
                </button>
              )}
              
              {/* Show Edit Draft button if email exists in a draft */}
              {existingDraftId && !isCheckingEmail && (
                <button 
                  type="button" 
                  className="button secondary sm" 
                  onClick={handleEditDraft}
                >
                  Edit Draft
                </button>
              )}
            </div>
          )}
          {shouldShowError('email') && !disableEmail && (
            <p className="error-message">{allErrors.email?.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="mobile" className="form-label" data-required="*">Mobile Number</label>
          <input
            id="mobile"
            type="tel"
            className="form-input"
            placeholder="(XXX) XXX-XXXX"
            {...register('mobile')}
          />
          {shouldShowError('mobile') && (
            <p className="error-message">{allErrors.mobile?.message}</p>
          )}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="licenseNumber" className="form-label" data-required={!allErrors.licenseNumber?.message?.includes('Either a license') ? "" : "*"}>
            License Number {!allErrors.licenseNumber?.message?.includes('Either a license') && '(At least one ID required)'}
          </label>
          <input
            id="licenseNumber"
            type="text"
            className="form-input"
            placeholder="Enter your license number"
            {...register('licenseNumber')}
          />
          {shouldShowError('licenseNumber') && (
            <p className="error-message">{allErrors.licenseNumber?.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="passportNumber" className="form-label" data-required={!allErrors.licenseNumber?.message?.includes('Either a license') ? "" : "*"}>
            Passport Number
            {!allErrors.licenseNumber?.message?.includes('Either a license') && '(At least one ID required)'}
          </label>
          <input
            id="passportNumber"
            type="text"
            className="form-input"
            placeholder="Enter your passport number"
            {...register('passportNumber')}
          />
          {shouldShowError('passportNumber') && (
            <p className="error-message">{allErrors.passportNumber?.message}</p>
          )}
        </div>
      </div>

      <div className="form-section">
        <h3>Additional Information</h3>
        <p className="section-description">The following fields are optional but may be required for certain positions.</p>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="sinNumber" className="form-label">SIN (Social Insurance Number)</label>
            <input
              id="sinNumber"
              type="text"
              className="form-input"
              placeholder="XXX-XXX-XXX"
              {...register('sinNumber')}
            />
            <p className="field-note">This information is encrypted and securely stored.</p>
          </div>

          <div className="form-group">
            <label htmlFor="sinExpiry" className="form-label">SIN Expiry Date</label>
            <div className="date-picker-container">
              <Calendar size={14} className="date-picker-icon" />
              <input
                id="sinExpiry"
                type="date"
                className="form-input"
                {...register('sinExpiry')}
                onClick={(e) => e.currentTarget.showPicker()}
              />
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="businessNumber" className="form-label">Business/HST/GST Number</label>
            <input
              id="businessNumber"
              type="text"
              className="form-input"
              placeholder="Enter your business number"
              {...register('businessNumber')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="corporationName" className="form-label">Corporation Name/Number</label>
            <input
              id="corporationName"
              type="text"
              className="form-input"
              placeholder="Enter corporation name or number"
              {...register('corporationName')}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 