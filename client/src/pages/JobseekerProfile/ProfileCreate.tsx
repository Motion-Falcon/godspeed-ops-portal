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
import { submitProfile, saveDraft as saveDraftAPI, getDraft, checkEmailAvailability } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
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
  workPreference: z.string().min(10, { message: 'Work preference is required and must be at least 10 characters' }),
  bio: z.string().max(100, { message: 'Bio must be 100 characters or less' }).min(1, { message: 'Bio is required' }),
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
  overtimeHours: z.string()
    .optional()
    .superRefine((val, ctx) => {
      // Get the form values to check if overtime is enabled
      const formData = ctx.path[0] as unknown as JobseekerProfileFormData;
      if (formData?.overtimeEnabled && !val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Overtime hours is required when overtime is enabled',
          path: [],
        });
      }
    }),
  overtimeBillRate: z.string()
    .optional()
    .superRefine((val, ctx) => {
      const formData = ctx.path[0] as unknown as JobseekerProfileFormData;
      if (formData?.overtimeEnabled && !val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Overtime bill rate is required when overtime is enabled',
          path: [],
        });
      }
    }),
  overtimePayRate: z.string()
    .optional()
    .superRefine((val, ctx) => {
      const formData = ctx.path[0] as unknown as JobseekerProfileFormData;
      if (formData?.overtimeEnabled && !val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Overtime pay rate is required when overtime is enabled',
          path: [],
        });
      }
    }),
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
    ).optional(), // Keep optional initially to allow adding rows without immediate file selection
  documentNotes: z.string().optional(),
  documentPath: z.string().optional(), // For storing uploaded file path
  documentFileName: z.string().optional(), // For storing the file name when saving drafts
  id: z.string().optional(), // Unique identifier for each document
}).refine(data => {
  // File is required ONLY if a path doesn't already exist (meaning it's not uploaded yet)
  return !!data.documentPath || !!data.documentFile;
}, {
  message: "Document file is required for new entries",
  path: ["documentFile"], // Associate error with the file input
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
  workPreference: z.string().min(10, { message: 'Work preference is required and must be at least 10 characters' }),
  bio: z.string().min(100, { message: 'Bio is required and must be at least 100 characters' }),
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
  const [error, setError] = useState<string | null>(null);
  const [isEmailAvailable, setIsEmailAvailable] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { isJobSeeker, user } = useAuth();
  
  // New loading states object to track different operations
  const [loadingStates, setLoadingStates] = useState({
    formLoading: true,     // Initial form loading
    draftSaving: false,    // Saving draft
    emailChecking: false,  // Checking email availability
    submitting: false,     // Form submission
    fileUploading: false   // File uploads
  });

  // Helper function to update specific loading state
  const setLoading = (key: keyof typeof loadingStates, value: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  };

  // Compute overall loading state
  const isLoading = Object.values(loadingStates).some(state => state);

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
      email: isJobSeeker && user?.email ? user.email : '',
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

  // Helper function to scroll to first error
  const scrollToError = () => {
    setTimeout(() => {
      const errorElement = document.querySelector('.error-message');
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100); // Short delay to ensure DOM is updated
  };

  // Fetch any existing draft on component mount
  useEffect(() => {
    const fetchDraft = async () => {
      try {
        setLoading('formLoading', true);
        const { draft, currentStep: savedStep } = await getDraft();
        
        if (draft) {
          // If user is a jobseeker, preserve their email
          if (isJobSeeker && user?.email) {
            draft.email = user.email;
          }
          
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
        setLoading('formLoading', false);
      }
    };
    
    fetchDraft();
  }, [methods, isJobSeeker, user]);

  // Reset email availability state when moving away from step 1
  useEffect(() => {
    // Only execute this effect if the step changes
    if (currentStep !== 1) {
      // We only need to reset if it's not already null
      if (isEmailAvailable !== null) {
        setIsEmailAvailable(null); // Reset when moving to other steps
      }
    } else if (currentStep === 1) {
      // If returning to step 1, only check if:
      // 1. We have a valid email
      // 2. We haven't checked already (isEmailAvailable is null)
      const currentEmail = methods.getValues('email');
      if (currentEmail && currentEmail.includes('@') && currentEmail.length > 5 && isEmailAvailable === null) {
        // Use a flag to prevent duplicate calls
        let isMounted = true;
        
        // Check email availability
        const checkEmail = async () => {
          try {
            setLoading('emailChecking', true);
            const result = await checkEmailAvailability(currentEmail);
            // Only update state if component is still mounted
            if (isMounted) {
              setIsEmailAvailable(result.available);
            }
          } catch (error) {
            console.error('Error checking email availability:', error);
            // Only update state if component is still mounted
            if (isMounted) {
              setIsEmailAvailable(null);
            }
          } finally {
            if (isMounted) {
              setLoading('emailChecking', false);
            }
          }
        };
        
        checkEmail();
        
        // Clean up function
        return () => {
          isMounted = false;
        };
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]); 

  const totalSteps = 5;

  // Centralized validation function for the current step
  const validateCurrentStep = async () => {
    const values = methods.getValues();
    const currentFields = getStepFields(currentStep);
    
    // Trigger validation only for fields in the current step
    const isValid = await methods.trigger(currentFields as Array<keyof JobseekerProfileFormData>);
    
    // Special case for step 1 (ID document requirement)
    if (currentStep === 1 && isValid && !values.licenseNumber && !values.passportNumber) {
      methods.setError('licenseNumber', { 
        type: 'custom', 
        message: 'Either a license number or passport number is required' 
      });
      return false;
    }
    
    return isValid;
  };

  // Function to save form data to draft
  const saveDraft = async () => {
    try {
      // Check email availability first if on first step
      if (currentStep === 1) {
        const email = methods.getValues('email');
        if (email) {
          // Only check if not already validated as available
          if (isEmailAvailable !== true) {
            try {
              setLoading('emailChecking', true);
              const result = await checkEmailAvailability(email);
              setIsEmailAvailable(result.available);
              
              if (!result.available) {
                setError('This email is already in use. Please use a different email to continue.');
                setLoading('emailChecking', false);
                return false;
              }
            } catch (emailError) {
              console.error('Error checking email availability:', emailError);
              setError('Unable to verify email availability. Please try again.');
              setLoading('emailChecking', false);
              return false;
            } finally {
              setLoading('emailChecking', false);
            }
          }
        } else {
          setError('Email is required to save draft.');
          return false;
        }
      }

      setLoading('draftSaving', true);
      setError(null); // Clear previous errors
      const formData = methods.getValues();

      // Check if user is authenticated - needed for file uploads
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // If saving draft requires file upload, user must be logged in.
        throw new Error('User must be logged in to save draft with file uploads.');
      }

      // Create a deep copy of form data to avoid mutating the original
      const draftData = structuredClone(formData);

      // Handle document uploads before saving draft
      if (draftData.documents && draftData.documents.length > 0) {
        for (const doc of draftData.documents) {
          // Only upload if it's a new file without a path
          if (doc.documentFile instanceof File && !doc.documentPath) {
            console.log(`Draft Save: Found file for document ID ${doc.id}, Type: ${doc.documentType}. Uploading...`);
            setLoading('fileUploading', true);
            
            const fileToUpload = doc.documentFile;
            const fileExt = fileToUpload.name.split('.').pop();
            const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `${user.id}/${doc.documentType || 'uncategorized'}/${uniqueFileName}`;

            console.log(`Draft Save: Uploading to Supabase path: ${filePath}`);

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('jobseeker-documents')
              .upload(filePath, fileToUpload);

            if (uploadError) {
              console.error(`Draft Save: Supabase upload error for doc ${doc.id}:`, uploadError);
              // Throw error, stop draft save
              setLoading('fileUploading', false);
              throw new Error(`Failed to upload document '${fileToUpload.name}' during draft save: ${uploadError.message}`);
            } else {
              // Update document with path info
              doc.documentPath = uploadData?.path || '';
              doc.documentFileName = fileToUpload.name; // Store the original file name
              console.log(`Draft Save: File uploaded successfully to ${doc.documentPath}`);
            }
          } else if (doc.documentFile && doc.documentPath) {
             console.log(`Draft Save: File for document ID ${doc.id} already has a path (${doc.documentPath}), skipping upload.`);
          } else {
             console.log(`Draft Save: No new file selected for document ID ${doc.id}, skipping upload.`);
          }

          // Always remove the file object before saving the draft JSON
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { documentFile, ...docWithoutFile } = doc;
          Object.assign(doc, docWithoutFile); // Update the object in the array
          doc.documentFile = undefined; // Explicitly set to undefined
        }
        setLoading('fileUploading', false);
      }

      // Save the potentially modified draft data (with documentPaths)
      const response = await saveDraftAPI({
        ...draftData,
        currentStep
      });
      console.log("Draft saved successfully:", response);

      setLoading('draftSaving', false);
      // Show success message (using whatever toast system is available)
      console.log("Draft saved successfully (including file uploads if any)");

      return true;
    } catch (error) {
      console.error("Error saving draft:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unexpected error occurred while saving draft");
      }
      return false;
    } finally {
      setLoading('draftSaving', false);
      setLoading('fileUploading', false);
    }
  };

  // Function to handle "Continue" button click
  const handleContinue = async () => {
    if (currentStep < totalSteps) {
      // Validate the current step
      const isValid = await validateCurrentStep();
      
      if (!isValid) {
        scrollToError();
        return;
      }
      
      // For the first step, explicitly verify email availability
      if (currentStep === 1) {
        const email = methods.getValues('email');
        
        if (email) {
          try {
            setLoading('emailChecking', true);
            const result = await checkEmailAvailability(email);
            setIsEmailAvailable(result.available);
            
            if (!result.available) {
              setError('This email is already in use. Please use a different email to continue.');
              setLoading('emailChecking', false);
              return;
            }
            
            // If email is available, proceed to save and continue
            const saveSuccess = await saveDraft();
            if (saveSuccess) {
              setCurrentStep(prevStep => prevStep + 1);
            }
          } catch (error) {
            console.error('Error checking email availability:', error);
            setError('Unable to verify email availability. Please try again.');
          } finally {
            setLoading('emailChecking', false);
          }
        } else {
          // If no email provided, trigger validation errors
          await methods.trigger('email');
          setError('Email is required to continue.');
        }
      } else {
        // For other steps, proceed with normal save and continue
        const saveSuccess = await saveDraft();
        if (saveSuccess) {
          setCurrentStep(prevStep => prevStep + 1);
        }
      }
    }
  };

  // Function to handle "Back" button click with option to save
  const handleBack = async (saveBeforeBack = true) => {
    if (currentStep > 1) {
      if (saveBeforeBack) {
        // Optional save when going back
        await saveDraft();
      }
      setCurrentStep(prevStep => prevStep - 1);
    }
  };

  // Function to handle final form submission
  const handleSubmit = async (data: JobseekerProfileFormData) => {
    setLoading('submitting', true);
    setError(null);
    
    try {
      // Check email availability before submission - skip for jobseekers using their own email
      if (!isJobSeeker) {
        try {
          setLoading('emailChecking', true);
          const result = await checkEmailAvailability(data.email);
          if (!result.available) {
            setError('This email is already in use. Please use a different email to continue.');
            setLoading('emailChecking', false);
            setLoading('submitting', false);
            return;
          }
          setLoading('emailChecking', false);
        } catch (emailError) {
          console.error('Error checking email availability:', emailError);
          setError('Unable to verify email availability. Please try again.');
          setLoading('emailChecking', false);
          setLoading('submitting', false);
          return;
        }
      }
      
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
        setLoading('fileUploading', true);
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
              setLoading('fileUploading', false);
              throw new Error(`Failed to upload document: ${uploadError.message}`);
            }

            // Update document with path info
            doc.documentPath = uploadData?.path || '';
            doc.documentFileName = fileToUpload.name;
            console.log(`File uploaded successfully: ${doc.documentPath}`); // Debug log
            
            // Remove the file object before submission
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { documentFile, ...docWithoutFile } = doc;
            Object.assign(doc, docWithoutFile);
            doc.documentFile = undefined;
          }
        }
        setLoading('fileUploading', false);
      }

      // Submit the complete profile data to the server
      const response = await submitProfile(profileData);

      // If the user is a jobseeker who created their own profile, redirect to verification pending page
      if (isJobSeeker) {
        navigate('/profile-verification-pending');
        return;
      }

      // For recruiter-created profiles, continue with existing logic
      // Check if a new account was created (only relevant for recruiter-created profiles)
      if (response.accountCreated) {
        // Navigate to the account created page with credentials and profile
        navigate('/profile-account-created', { 
          state: { 
            email: response.email,
            password: response.password,
            profile: response.profile,
            accountCreated: true
          }
        });
      } else {
        // Navigate to account created page with just the profile data
        navigate('/profile-account-created', { 
          state: { 
            email: profileData.email,
            profile: response.profile,
            accountCreated: false
          }
        });
      }
    } catch (error) {
      console.error('Form submission error:', error); // Log detailed error
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred during submission');
      }
    } finally {
      setLoading('submitting', false);
      setLoading('fileUploading', false);
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
        return ['licenseType', 'experience', 'availability', 'manualDriving', 'workPreference', 'bio', 'weekendAvailability'];
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
        return <PersonalInfoForm 
          currentStep={currentStep} 
          allFields={getStepFields(currentStep)} 
          onEmailAvailabilityChange={(isAvailable) => setIsEmailAvailable(isAvailable)}
          disableEmail={isJobSeeker}
        />;
      case 2:
      case 3:
        return <AddressQualificationsForm currentStep={currentStep} allFields={getStepFields(currentStep)} />;
      case 4:
        return <CompensationForm currentStep={currentStep} allFields={getStepFields(currentStep)} />;
      case 5:
        return <DocumentUploadForm currentStep={currentStep} allFields={getStepFields(currentStep)} />;
      default:
        return <PersonalInfoForm 
          currentStep={1} 
          allFields={getStepFields(1)}
          onEmailAvailabilityChange={(isAvailable) => setIsEmailAvailable(isAvailable)}
          disableEmail={isJobSeeker}
        />;
    }
  };

  // --- Step Indicator Logic ---
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

  // Render loading indicator based on specific loading states
  const renderLoadingIndicator = () => {
    if (loadingStates.formLoading) {
      return <div className="loading-indicator">Loading saved draft...</div>;
    }
    if (loadingStates.fileUploading) {
      return <div className="loading-indicator">Uploading files...</div>;
    }
    if (loadingStates.draftSaving) {
      return <div className="loading-indicator">Saving draft...</div>;
    }
    if (loadingStates.submitting) {
      return <div className="loading-indicator">Submitting profile...</div>;
    }
    if (loadingStates.emailChecking) {
      return <div className="loading-indicator">Checking email availability...</div>;
    }
    return null;
  };

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

      {currentStep === 1 && isEmailAvailable === false && !error && (
        <div className="error-container">
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
            <span>The email address is already in use. Please use a different email to continue.</span>
          </div>
        </div>
      )}

      {renderLoadingIndicator()}

      <div className={`form-card ${isLoading ? 'form-loading' : ''}`}>
        <FormProvider {...methods}>
          <form 
            onSubmit={methods.handleSubmit(
              // On valid submission
              (data) => handleSubmit(data),
              // On validation error
              (errors) => {
                console.log("Validation errors:", errors);
                scrollToError();
              }
            )} 
            className={isLoading ? 'form-loading' : ''}
          >
            <div className="form-content">
              {renderStep()}
            </div>

            <div className="form-navigation">
              {currentStep > 1 && (
                <button 
                  type="button" 
                  className="button secondary"
                  onClick={() => handleBack(true)}
                  disabled={isLoading}
                >
                  Back
                </button>
              )}
              
              <button
                type="button"
                className="button secondary draft-button"
                onClick={() => saveDraft()}
                disabled={isLoading || (currentStep === 1 && isEmailAvailable === false)}
                title={currentStep === 1 && isEmailAvailable === false ? 'Email is already in use. Please choose a different email.' : ''}
              >
                {loadingStates.draftSaving ? <span className="loading-spinner"></span> : 'Save Draft'}
              </button>

              {currentStep < totalSteps ? (
                <button
                  type="button"
                  className="button primary"
                  onClick={handleContinue}
                  disabled={isLoading}
                >
                  {isLoading ? <span className="loading-spinner"></span> : 'Continue'}
                </button>
              ) : (
                <button
                  type="submit"
                  className="button primary"
                  disabled={isLoading}
                >
                  {loadingStates.submitting ? <span className="loading-spinner"></span> : 'Submit'}
                </button>
              )}
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
} 