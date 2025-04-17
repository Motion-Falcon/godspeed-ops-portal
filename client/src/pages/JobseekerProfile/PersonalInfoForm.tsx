import { useFormContext } from 'react-hook-form';
import { personalInfoSchema } from './ProfileCreate';
import { z } from 'zod';

type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;

interface PersonalInfoFormProps {
  currentStep: number;
  allFields: string[];
}

export function PersonalInfoForm({ allFields }: PersonalInfoFormProps) {
  const { register, formState } = useFormContext<PersonalInfoFormData>();
  const { errors: allErrors } = formState;
  
  // Function to check if we should show an error for a specific field
  const shouldShowError = (fieldName: string) => {
    return allFields.includes(fieldName) && allErrors[fieldName as keyof typeof allErrors];
  };

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
          <input
            id="dob"
            type="date"
            className="form-input"
            {...register('dob')}
          />
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
          />
          {shouldShowError('email') && (
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
            <input
              id="sinExpiry"
              type="date"
              className="form-input"
              {...register('sinExpiry')}
            />
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