import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabaseClient';
import { PersonalInfoForm } from './PersonalInfoForm';
import { AddressQualificationsForm } from './AddressQualificationsForm';
import { CompensationForm } from './CompensationForm';
import { DocumentUploadForm } from './DocumentUploadForm';
import { submitProfile, saveDraft as saveDraftAPI, getDraft } from '../../services/api';
import '../../styles/components/form.css';
import '../../styles/pages/JobseekerProfile.css';

// Define the form schema types for each step
export const personalInfoSchema = z.object({
  firstName: z.string().min(1, { message: 'First name is required' }),
  lastName: z.string().min(1, { message: 'Last name is required' }),
  dob: z.string().min(1, { message: 'Date of birth is required' }),
  email: z.string().email({ message: 'Valid email is required' }),
  mobile: z.string().min(1, { message: 'Mobile number is required' }),
  licenseNumber: z.string().optional(),
  passportNumber: z.string().optional(),
  sinNumber: z.string().optional(),
  sinExpiry: z.string().optional(),
  businessNumber: z.string().optional(),
  corporationName: z.string().optional(),
}).refine(
  data => data.licenseNumber || data.passportNumber, 
  { message: 'Either a license number or passport number is required', path: ['licenseNumber'] }
);

// Define schema for address and qualifications
export const addressQualificationsSchema = z.object({
  // Address fields
  street: z.string().min(1, { message: 'Street address is required' }),
  city: z.string().min(1, { message: 'City is required' }),
  province: z.string().min(1, { message: 'Province is required' }),
  postalCode: z.string().min(1, { message: 'Postal code is required' }),
  
  // Qualifications fields
  workPreference: z.string().optional(),
  licenseType: z.string().min(1, { message: 'License type is required' }),
  experience: z.string().min(1, { message: 'Experience level is required' }),
  manualDriving: z.enum(['NA','Yes', 'No']),
  availability: z.enum(['Full-Time', 'Part-Time']),
  weekendAvailability: z.boolean().default(false),
});

// Define schema for compensation
export const compensationSchema = z.object({
  payrateType: z.enum(['Hourly', 'Daily', 'Monthly']),
  billRate: z.string().min(1, { message: 'Bill rate is required' }),
  payRate: z.string().min(1, { message: 'Pay rate is required' }),
  paymentMethod: z.string().min(1, { message: 'Payment method is required' }),
  hstGst: z.string().optional(),
  cashDeduction: z.string().optional(),
  overtimeEnabled: z.boolean().default(false),
  overtimeHours: z.string().optional(),
  overtimeBillRate: z.string().optional(),
  overtimePayRate: z.string().optional(),
});

// Document Upload Schema
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = ['application/pdf'];

// Single document schema
const singleDocumentSchema = z.object({
  documentType: z.string().min(1, { message: 'Document type is required' }),
  documentTitle: z.string().optional(),
  documentFile: z.instanceof(File, { message: "Document file is required" })
    .refine((file) => file?.size <= MAX_FILE_SIZE, `Max file size is 2MB.`)
    .refine(
      (file) => ALLOWED_FILE_TYPES.includes(file?.type),
      "Only .pdf files are accepted."
    ),
  documentNotes: z.string().optional(),
  documentPath: z.string().optional(), // For storing uploaded file path
  documentFileName: z.string().optional(), // For storing the file name when saving drafts
  id: z.string().optional(), // Unique identifier for each document
});

// Array of documents schema
export const documentUploadSchema = z.object({
  documents: z.array(singleDocumentSchema).min(1, { message: 'At least one document is required' }),
});

// Combined schema for the entire form - avoid using .extend() after refine()
const formSchema = z.object({
  // Personal info fields
  firstName: z.string().min(1, { message: 'First name is required' }),
  lastName: z.string().min(1, { message: 'Last name is required' }),
  dob: z.string().min(1, { message: 'Date of birth is required' }),
  email: z.string().email({ message: 'Valid email is required' }),
  mobile: z.string().min(1, { message: 'Mobile number is required' }),
  licenseNumber: z.string().optional(),
  passportNumber: z.string().optional(),
  sinNumber: z.string().optional(),
  sinExpiry: z.string().optional(),
  businessNumber: z.string().optional(),
  corporationName: z.string().optional(),
  
  // Address & Qualifications fields
  street: z.string().min(1, { message: 'Street address is required' }),
  city: z.string().min(1, { message: 'City is required' }),
  province: z.string().min(1, { message: 'Province is required' }),
  postalCode: z.string().min(1, { message: 'Postal code is required' }),
  workPreference: z.string().optional(),
  licenseType: z.string().min(1, { message: 'License type is required' }),
  experience: z.string().min(1, { message: 'Experience level is required' }),
  manualDriving: z.enum(['NA','Yes', 'No']),
  availability: z.enum(['Full-Time', 'Part-Time']),
  weekendAvailability: z.boolean().default(false),

  // Compensation fields
  payrateType: z.enum(['Hourly', 'Daily', 'Monthly']),
  billRate: z.string().min(1, { message: 'Bill rate is required' }),
  payRate: z.string().min(1, { message: 'Pay rate is required' }),
  paymentMethod: z.string().min(1, { message: 'Payment method is required' }),
  hstGst: z.string().optional(),
  cashDeduction: z.string().optional(),
  overtimeEnabled: z.boolean().default(false),
  overtimeHours: z.string().optional(),
  overtimeBillRate: z.string().optional(),
  overtimePayRate: z.string().optional(),
  
  // Document upload fields - updated to handle multiple documents
  documents: z.array(singleDocumentSchema).min(1, { message: 'At least one document is required' }),
}).refine(
  data => data.licenseNumber || data.passportNumber, 
  { message: 'Either a license number or passport number is required', path: ['licenseNumber'] }
);

// Type inference for form data
type JobseekerProfileFormData = z.infer<typeof formSchema>;

export function ProfileCreate() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Initialize form methods with zod resolver
  const methods = useForm<JobseekerProfileFormData>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    criteriaMode: 'all',
    defaultValues: {
      // Personal info defaults
      firstName: '',
      lastName: '',
      dob: '',
      email: '',
      mobile: '',
      licenseNumber: '',
      passportNumber: '',
      sinNumber: '',
      sinExpiry: '',
      businessNumber: '',
      corporationName: '',
      
      // Address & Qualifications defaults
      street: '',
      city: '',
      province: '',
      postalCode: '',
      workPreference: '',
      licenseType: '',
      experience: '',
      manualDriving: 'NA',
      availability: 'Full-Time',
      weekendAvailability: false,

      // Compensation defaults
      payrateType: 'Hourly',
      billRate: '',
      payRate: '',
      paymentMethod: '',
      hstGst: '',
      cashDeduction: '0',
      overtimeEnabled: false,
      overtimeHours: '',
      overtimeBillRate: '',
      overtimePayRate: '',
      
      // Document upload defaults - Updated for multiple documents
      documents: [{ 
        documentType: '',
        documentTitle: '',
        documentNotes: '',
        id: crypto.randomUUID()
      }],
      // documentFile is not included in defaultValues since it's a File object
    }
  });

  // Fetch any existing draft on component mount
  useEffect(() => {
    const fetchDraft = async () => {
      try {
        setIsLoading(true);
        const { draft, currentStep: savedStep } = await getDraft();
        
        if (draft) {
          // Set form values from draft
          methods.reset(draft);
          // Set current step
          if (savedStep) {
            setCurrentStep(savedStep);
          }
        }
      } catch (error) {
        console.error('Error fetching draft:', error);
        // Non-critical error, don't show to user
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDraft();
  }, [methods]);

  const totalSteps = 5;

  // Function to save form data to draft
  const saveDraft = async () => {
    try {
      setIsLoading(true);
      const formData = methods.getValues();
      
      // Create a deep copy of form data to avoid mutating the original
      const draftData = JSON.parse(JSON.stringify(formData)) as JobseekerProfileFormData;
      
      // Convert documents for storage
      if (draftData.documents && draftData.documents.length > 0) {
        draftData.documents = draftData.documents.map(doc => {
          const docCopy = { ...doc };
          if (docCopy.documentFile) {
            docCopy.documentFileName = (docCopy.documentFile as File).name;
            delete docCopy.documentFile;
          }
          return docCopy;
        });
      }
      
      // Save the draft
      const response = await saveDraftAPI({
        ...draftData,
        currentStep
      });
      console.log("Draft saved successfully:", response);
      
      setIsLoading(false);
      // Show success message (using whatever toast system is available)
      console.log("Draft saved successfully");
      
      return true;
    } catch (error) {
      setIsLoading(false);
      console.error("Error saving draft:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unexpected error occurred while saving draft");
      }
      return false;
    }
  };

  // Function to handle "Continue" button click
  const handleContinue = async () => {
    if (currentStep < totalSteps) {
      // Save current progress as draft
      await saveDraft();
      // Move to next step
      setCurrentStep(prevStep => prevStep + 1);
    }
  };

  // Function to handle "Back" button click
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prevStep => prevStep - 1);
    }
  };

  // Function to handle final form submission
  const handleSubmit = async (data: JobseekerProfileFormData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // First save as a draft (without the file)
      // We need the user ID for the file path
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated for file upload');
      }

      // Prepare data for submission
      const profileData = structuredClone(data);
      
      // Handle document file uploads if any exist
      if (profileData.documents && profileData.documents.length > 0) {
        // Process each document with a file
        for (const doc of profileData.documents) {
          if (doc.documentFile instanceof File) {
            const fileToUpload = doc.documentFile;
            const fileExt = fileToUpload.name.split('.').pop();
            // Use a more structured path: userId/documentType/uuid.ext
            const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `${user.id}/${doc.documentType || 'uncategorized'}/${uniqueFileName}`;

            console.log(`Uploading file to: ${filePath}`); // Debug log

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('jobseeker-documents') // Ensure this bucket exists and has policies set
              .upload(filePath, fileToUpload);

            if (uploadError) {
              console.error('Supabase upload error:', uploadError); // Log detailed error
              throw new Error(`Failed to upload document: ${uploadError.message}`);
            }

            // Update document with path info
            doc.documentPath = uploadData?.path || '';
            doc.documentFileName = fileToUpload.name;
            console.log(`File uploaded successfully: ${doc.documentPath}`); // Debug log
            
            // Remove the file object before submission
            delete doc.documentFile;
          }
        }
      }

      // Submit the complete profile data to the server
      await submitProfile(profileData);

      // Navigate to verification pending page
      navigate('/profile-verification-pending');
    } catch (error) {
      console.error('Form submission error:', error); // Log detailed error
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred during submission');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Add this function to control which validation errors are shown
  const getStepFields = (step: number): string[] => {
    switch (step) {
      case 1:
        return ['firstName', 'lastName', 'dob', 'email', 'mobile', 'licenseNumber', 'passportNumber', 'sinNumber', 'sinExpiry', 'businessNumber', 'corporationName'];
      case 2:
        return ['street', 'city', 'province', 'postalCode'];
      case 3:
        return ['licenseType', 'experience', 'availability', 'manualDriving', 'workPreference', 'weekendAvailability'];
      case 4:
        return ['payrateType', 'billRate', 'payRate', 'paymentMethod', 'hstGst', 'cashDeduction', 'overtimeEnabled', 'overtimeHours', 'overtimeBillRate', 'overtimePayRate'];
      case 5:
        return ['documents'];
      default:
        return [];
    }
  };

  // Render the current step component
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <PersonalInfoForm currentStep={currentStep} allFields={getStepFields(currentStep)} />;
      case 2:
      case 3:
        return <AddressQualificationsForm currentStep={currentStep} allFields={getStepFields(currentStep)} />;
      case 4:
        return <CompensationForm currentStep={currentStep} allFields={getStepFields(currentStep)} />;
      case 5:
        return <DocumentUploadForm currentStep={currentStep} allFields={getStepFields(currentStep)} />;
      default:
        return <PersonalInfoForm currentStep={1} allFields={getStepFields(1)} />;
    }
  };

  // --- New Step Indicator Logic ---
  const renderStepIndicator = () => {
    const steps = [];
    for (let i = 1; i <= totalSteps; i++) {
      const isActive = i === currentStep;
      const isCompleted = i < currentStep;
      steps.push(
        <div 
          key={i} 
          className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
        >
          <div className="step-circle">{i}</div>
          {i < totalSteps && (
            <div className="step-line">
              <div className="step-line-progress"></div>
            </div>
          )}
        </div>
      );
    }
    return <div className="step-indicator-new">{steps}</div>;
  };
  // -----------------------------

  return (
    <div className="profile-create-container">
      <div className="profile-create-header">
        <h1>Create Your Profile</h1>
        {renderStepIndicator()}
      </div>

      {error && (
        <div className="error-container">
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
          <button 
            className="error-dismiss" 
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <div className="form-card">
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(handleSubmit)} className={isLoading ? 'form-loading' : ''}>
            <div className="form-content">
              {renderStep()}
            </div>

            <div className="form-navigation">
              {currentStep > 1 && (
                <button 
                  type="button" 
                  className="button secondary"
                  onClick={handleBack}
                  disabled={isLoading}
                >
                  Back
                </button>
              )}
              
              <button
                type="button"
                className="button secondary draft-button"
                onClick={() => saveDraft()}
                disabled={isLoading}
              >
                Save Draft
              </button>

              {currentStep < totalSteps ? (
                <button
                  type="button"
                  className="button primary"
                  onClick={async () => {
                    // Get current values for debugging
                    const values = methods.getValues();
                    console.log("Current form values:", values);
                    
                    // Custom validation based on the current step
                    let isValid = false;

                    if (currentStep === 1) {
                      // Special validation for step 1
                      if (!values.licenseNumber && !values.passportNumber) {
                        console.log("Missing required identification: Need either licenseNumber or passportNumber");
                        methods.setError('licenseNumber', { 
                          type: 'custom', 
                          message: 'Either a license number or passport number is required' 
                        });
                        isValid = false;
                      } else {
                        // Trigger validation without storing the result
                        await methods.trigger();
                        
                        // Only consider fields for step 1 when determining validity
                        const errors = methods.formState.errors;
                        const step1ErrorFields = ['firstName', 'lastName', 'dob', 'email', 'mobile', 
                          'licenseNumber', 'passportNumber', 'sinNumber', 'sinExpiry', 
                          'businessNumber', 'corporationName'];
                          
                          // Check if any step 1 fields have errors
                          const hasStep1Errors = step1ErrorFields.some(field => 
                            Object.prototype.hasOwnProperty.call(errors, field));
                            
                          isValid = !hasStep1Errors;
                      }
                    } 
                    else if (currentStep === 2 || currentStep === 3) {
                      // Trigger all validation
                      await methods.trigger();
                      
                      // Only consider fields relevant to the current step
                      const errors = methods.formState.errors;
                      const step2Fields = ['street', 'city', 'province', 'postalCode'];
                      const step3Fields = ['licenseType', 'experience', 'availability', 'manualDriving'];
                      
                      // Check if any fields for this step have errors
                      const relevantFields = currentStep === 2 ? step2Fields : step3Fields;
                      const hasStepErrors = relevantFields.some(field => 
                        Object.prototype.hasOwnProperty.call(errors, field));
                        
                      isValid = !hasStepErrors;
                    }
                    else if (currentStep === 4) {
                      // Trigger all validation
                      await methods.trigger();
                      
                      // Only consider fields for step 4
                      const errors = methods.formState.errors;
                      const step4Fields = ['payrateType', 'billRate', 'payRate', 'paymentMethod'];
                      
                      // Check if any step 4 fields have errors
                      const hasStep4Errors = step4Fields.some(field => 
                        Object.prototype.hasOwnProperty.call(errors, field));
                        
                      isValid = !hasStep4Errors;
                    }
                    else {
                      // Default validation for other steps
                      isValid = await methods.trigger();
                    }
                    
                    if (isValid) {
                      handleContinue();
                    } else {
                      console.log("Validation failed for step", currentStep);
                      // Display which fields have errors
                      console.log("Errors:", methods.formState.errors);
                      
                      // This will help to trigger touched state on fields with errors
                      // so that error messages will be displayed
                      Object.keys(methods.formState.errors).forEach(fieldName => {
                        try {
                          methods.setError(fieldName as keyof JobseekerProfileFormData, { 
                            type: 'validation',
                            message: methods.formState.errors[fieldName as keyof typeof methods.formState.errors]?.message || ''
                          });
                        } catch (e) {
                          console.log("Error setting field error state:", e);
                        }
                      });
                    }
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? <span className="loading-spinner"></span> : 'Continue'}
                </button>
              ) : (
                <button
                  type="submit"
                  className="button primary"
                  onClick={async (e) => {
                    e.preventDefault();
                    // Get current values for debugging
                    const values = methods.getValues();
                    console.log("Form values before submission:", values);
                    
                    // Trigger validation for all fields in the form
                    await methods.trigger();
                    
                    // Check for any errors in the form
                    const errors = methods.formState.errors;
                    console.log("Validation errors:", errors);
                    
                    // Check if form is valid (no errors)
                    const isValid = Object.keys(errors).length === 0;
                    
                    if (isValid) {
                      handleSubmit(methods.getValues());
                    } else {
                      console.log("Validation failed before submission");
                      // Display which fields have errors
                      console.log("Errors:", methods.formState.errors);
                      
                      // This will help to trigger touched state on fields with errors
                      // so that error messages will be displayed
                      Object.keys(methods.formState.errors).forEach(fieldName => {
                        try {
                          methods.setError(fieldName as keyof JobseekerProfileFormData, { 
                            type: 'validation',
                            message: methods.formState.errors[fieldName as keyof typeof methods.formState.errors]?.message || ''
                          });
                        } catch (e) {
                          console.log("Error setting field error state:", e);
                        }
                      });
                    }
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? <span className="loading-spinner"></span> : 'Submit'}
                </button>
              )}
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
} 