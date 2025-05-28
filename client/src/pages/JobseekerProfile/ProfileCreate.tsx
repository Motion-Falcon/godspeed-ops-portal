import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "../../lib/supabaseClient";
import { PersonalInfoForm } from "./PersonalInfoForm";
import { AddressQualificationsForm } from "./AddressQualificationsForm";
import { CompensationForm } from "./CompensationForm";
import { DocumentUploadForm } from "./DocumentUploadForm";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { AppHeader } from "../../components/AppHeader";
import {
  submitProfile,
  saveDraft as saveDraftAPI,
  getDraft,
  checkEmailAvailability,
  getJobseekerProfile,
  updateProfile,
  updateJobseekerStatus,
  getJobseekerDraft,
  saveJobseekerDraft,
} from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import "../../styles/components/form.css";
import "../../styles/pages/JobseekerProfileStyles.css";
import "../../styles/components/header.css";
import { ArrowLeft, Check, Save } from "lucide-react";
import { validateSIN, validateDOB, logValidation } from "../../utils/validation";

// Define the form schema types for each step
export const personalInfoSchema = z
  .object({
    firstName: z.string().min(1, { message: "First name is required" }),
    lastName: z.string().min(1, { message: "Last name is required" }),
    dob: z.string().min(1, { message: "Date of birth is required" }),
    email: z.string().email({ message: "Valid email is required" }),
    mobile: z.string().min(1, { message: "Mobile number is required" }),
    licenseNumber: z.string().optional(),
    passportNumber: z.string().optional(),
    sinNumber: z.string().optional(),
    sinExpiry: z.string().optional(),
    businessNumber: z.string().optional(),
    corporationName: z.string().optional(),
  })
  .refine((data) => data.licenseNumber || data.passportNumber, {
    message: "Either a license number or passport number is required",
    path: ["licenseNumber"],
  });

// Define schema for address and qualifications
export const addressQualificationsSchema = z.object({
  // Address fields
  street: z.string().min(1, { message: "Street address is required" }),
  city: z.string().min(1, { message: "City is required" }),
  province: z.string().min(1, { message: "Province is required" }),
  postalCode: z.string().min(1, { message: "Postal code is required" }),

  // Qualifications fields
  workPreference: z.string().min(10, {
    message: "Work preference is required and must be at least 10 characters",
  }),
  bio: z
    .string()
    .min(100, {
      message: "Bio is required and must be at least 100 characters",
    })
    .max(500, { message: "Bio must be 500 characters or less" }),
  licenseType: z.string().min(1, { message: "License type is required" }),
  experience: z.string().min(1, { message: "Experience level is required" }),
  manualDriving: z.enum(["NA", "Yes", "No"]),
  availability: z.enum(["Full-Time", "Part-Time"]),
  weekendAvailability: z.boolean().default(false),
});

// Define schema for compensation
export const compensationSchema = z.object({
  payrateType: z.enum(["Hourly", "Daily", "Monthly"]).optional(),
  billRate: z.string().optional(),
  payRate: z.string().optional(),
  paymentMethod: z.string().min(1, { message: "Payment method is required" }),
  hstGst: z.string().optional(),
  cashDeduction: z.string().optional(),
  overtimeEnabled: z.boolean().default(false),
  overtimeHours: z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      // Get the form values to check if overtime is enabled
      const formData = ctx.path[0] as unknown as JobseekerProfileFormData;
      if (formData?.overtimeEnabled && !val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Overtime hours is required when overtime is enabled",
          path: [],
        });
      }
    }),
  overtimeBillRate: z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      const formData = ctx.path[0] as unknown as JobseekerProfileFormData;
      if (formData?.overtimeEnabled && !val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Overtime bill rate is required when overtime is enabled",
          path: [],
        });
      }
    }),
  overtimePayRate: z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      const formData = ctx.path[0] as unknown as JobseekerProfileFormData;
      if (formData?.overtimeEnabled && !val) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Overtime pay rate is required when overtime is enabled",
          path: [],
        });
      }
    }),
});

// Document Upload Schema
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = ["application/pdf"];

// Single document schema
const singleDocumentSchema = z
  .object({
    documentType: z.string().min(1, { message: "Document type is required" }),
    documentTitle: z.string().optional(),
    documentFile: z
      .instanceof(File, { message: "Document file is required" })
      .refine((file) => file?.size <= MAX_FILE_SIZE, `Max file size is 2MB.`)
      .refine(
        (file) => ALLOWED_FILE_TYPES.includes(file?.type),
        "Only .pdf files are accepted."
      )
      .optional(), // Keep optional initially to allow adding rows without immediate file selection
    documentNotes: z.string().optional(),
    documentPath: z.string().optional(), // For storing uploaded file path
    documentFileName: z.string().optional(), // For storing the file name when saving drafts
    id: z.string().optional(), // Unique identifier for each document
  })
  .refine(
    (data) => {
      // File is required ONLY if a path doesn't already exist (meaning it's not uploaded yet)
      return !!data.documentPath || !!data.documentFile;
    },
    {
      message: "Document file is required for new entries",
      path: ["documentFile"], // Associate error with the file input
    }
  );

// Array of documents schema
export const documentUploadSchema = z.object({
  documents: z
    .array(singleDocumentSchema)
    .min(1, { message: "At least one document is required" }),
});

// Combined schema for the entire form - avoid using .extend() after refine()
const formSchema = z
  .object({
    // Personal info fields
    firstName: z.string().min(1, { message: "First name is required" }),
    lastName: z.string().min(1, { message: "Last name is required" }),
    dob: z.string().min(1, { message: "Date of birth is required" }),
    email: z.string().email({ message: "Valid email is required" }),
    mobile: z.string().min(1, { message: "Mobile number is required" }),
    licenseNumber: z.string().optional(),
    passportNumber: z.string().optional(),
    sinNumber: z.string().optional(),
    sinExpiry: z.string().optional(),
    businessNumber: z.string().optional(),
    corporationName: z.string().optional(),

    // Address & Qualifications fields
    street: z.string().min(1, { message: "Street address is required" }),
    city: z.string().min(1, { message: "City is required" }),
    province: z.string().min(1, { message: "Province is required" }),
    postalCode: z.string().min(1, { message: "Postal code is required" }),
    workPreference: z.string().min(10, {
      message: "Work preference is required and must be at least 10 characters",
    }),
    bio: z
      .string()
      .min(100, {
        message: "Bio is required and must be at least 100 characters",
      })
      .max(500, { message: "Bio must be 500 characters or less" }),
    licenseType: z.string().min(1, { message: "License type is required" }),
    experience: z.string().min(1, { message: "Experience level is required" }),
    manualDriving: z.enum(["NA", "Yes", "No"]),
    availability: z.enum(["Full-Time", "Part-Time"]),
    weekendAvailability: z.boolean().default(false),

    // Compensation fields - modified to be conditional based on user type
    payrateType: z.enum(["Hourly", "Daily", "Monthly"]).optional(),
    billRate: z.string().optional(),
    payRate: z.string().optional(),
    paymentMethod: z.string().optional(),
    hstGst: z.string().optional(),
    cashDeduction: z.string().optional(),
    overtimeEnabled: z.boolean().default(false),
    overtimeHours: z.string().optional(),
    overtimeBillRate: z.string().optional(),
    overtimePayRate: z.string().optional(),

    // Document upload fields - updated to handle multiple documents
    documents: z
      .array(singleDocumentSchema)
      .min(1, { message: "At least one document is required" }),
  })
  .refine((data) => data.licenseNumber || data.passportNumber, {
    message: "Either a license number or passport number is required",
    path: ["licenseNumber"],
  });

// Type inference for form data
type JobseekerProfileFormData = z.infer<typeof formSchema>;

// Interface for ProfileCreate props
interface ProfileCreateProps {
  isEditMode?: boolean;
  isDraftEditMode?: boolean;
  isNewForm?: boolean; // Add new prop to indicate creating a fresh form
}

export function ProfileCreate({
  isEditMode = false,
  isDraftEditMode = false,
  isNewForm = false,
}: ProfileCreateProps) {
  const { id: profileId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { isJobSeeker, user, hasProfile } = useAuth();

  // Check if isNewForm is passed via location state
  const locationIsNewForm = location.state?.isNewForm === true;
  const shouldStartWithNewForm = isNewForm || locationIsNewForm;

  // Clear location state after checking
  useEffect(() => {
    if (locationIsNewForm) {
      // Clear the isNewForm from location state to prevent it persisting on refresh
      window.history.replaceState({}, document.title);
    }
  }, [locationIsNewForm]);

  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isEmailAvailable, setIsEmailAvailable] = useState<boolean | null>(
    null
  );
  // const [initialEmail, setInitialEmail] = useState<string | null>(null);
  const [isSubmitConfirmationOpen, setIsSubmitConfirmationOpen] =
    useState<boolean>(false);
  const [formDataToSubmit, setFormDataToSubmit] =
    useState<JobseekerProfileFormData | null>(null);

  // Add a ref to track initial load to prevent auto-submission
  const isInitialLoad = useRef(true);
  // Add state to track user interaction
  const [userInteracted, setUserInteracted] = useState(false);
  const previousUserInteraction = useRef(false); // Add this to track previous interaction state

  // Track created draft ID in the current session
  const [createdDraftId, setCreatedDraftId] = useState<string | null>(null);

  // New loading states object to track different operations
  const [loadingStates, setLoadingStates] = useState({
    formLoading: true, // Initial form loading
    draftSaving: false, // Saving draft
    emailChecking: false, // Checking email availability
    submitting: false, // Form submission
    fileUploading: false, // File uploads
  });

  // Helper function to update specific loading state
  const setLoading = (key: keyof typeof loadingStates, value: boolean) => {
    setLoadingStates((prev) => ({ ...prev, [key]: value }));
  };

  // Compute overall loading state
  const isLoading = Object.values(loadingStates).some((state) => state);

  // Calculate total steps based on user type (hide compensation step for jobseekers)
  const totalSteps = isJobSeeker ? 4 : 5;

  // Initialize form methods with zod resolver
  const methods = useForm<JobseekerProfileFormData>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    criteriaMode: "all",
    defaultValues: {
      // Personal info defaults
      firstName: "",
      lastName: "",
      dob: "",
      email: isJobSeeker && user?.email ? user.email : "",
      mobile: "",
      licenseNumber: "",
      passportNumber: "",
      sinNumber: "",
      sinExpiry: "",
      businessNumber: "",
      corporationName: "",

      // Address & Qualifications defaults
      street: "",
      city: "",
      province: "",
      postalCode: "",
      workPreference: "",
      licenseType: "",
      experience: "",
      manualDriving: "NA",
      availability: "Full-Time",
      weekendAvailability: false,

      // Compensation defaults
      payrateType: "Hourly",
      billRate: "",
      payRate: "",
      paymentMethod: "",
      hstGst: "",
      cashDeduction: "0",
      overtimeEnabled: false,
      overtimeHours: "",
      overtimeBillRate: "",
      overtimePayRate: "",

      // Document upload defaults - Updated for multiple documents
      documents: [
        {
          documentType: "",
          documentTitle: "",
          documentNotes: "",
          id: crypto.randomUUID(),
        },
      ],
      // documentFile is not included in defaultValues since it's a File object
    },
  });

  // Helper function to scroll to first error
  const scrollToError = () => {
    setTimeout(() => {
      const errorElement = document.querySelector(".error-message");
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100); // Short delay to ensure DOM is updated
  };

  useEffect(() => {
    if (isEditMode && profileId) {
      // In edit mode, fetch the existing profile data
      const fetchProfileData = async () => {
        try {
          setLoading("formLoading", true);
          setError(null);

          const profileData = await getJobseekerProfile(profileId);
          if (!profileData) {
            setError("Failed to load profile data");
            return;
          }

          // Set initial email to compare later for availability check
          // setInitialEmail(profileData.email);

          // Map detailed profile data to form format
          // Need to match the exact structure returned from the API
          const formData = {
            firstName: profileData.firstName || "",
            lastName: profileData.lastName || "",
            dob: profileData.dob || "",
            email: profileData.email || "",
            mobile: profileData.mobile || "",
            licenseNumber: profileData.licenseNumber || "",
            passportNumber: profileData.passportNumber || "",
            sinNumber: profileData.sinNumber || "",
            sinExpiry: profileData.sinExpiry || "",
            businessNumber: profileData.businessNumber || "",
            corporationName: profileData.corporationName || "",

            street: profileData.street || "",
            city: profileData.city || "",
            province: profileData.province || "",
            postalCode: profileData.postalCode || "",

            workPreference: profileData.workPreference || "",
            bio: profileData.bio || "No bio provided",
            licenseType: profileData.licenseType || "",
            experience: profileData.experience || "",
            manualDriving:
              (profileData.manualDriving as "Yes" | "No" | "NA") || "NA",
            availability:
              (profileData.availability as "Full-Time" | "Part-Time") ||
              "Full-Time",
            weekendAvailability: profileData.weekendAvailability || false,

            payrateType:
              (profileData.payrateType as "Hourly" | "Daily" | "Monthly") ||
              "Hourly",
            billRate: profileData.billRate || "",
            payRate: profileData.payRate || "",
            paymentMethod: profileData.paymentMethod || "",
            hstGst: profileData.hstGst || "",
            cashDeduction: profileData.cashDeduction || "0",
            overtimeEnabled: profileData.overtimeEnabled || false,
            overtimeHours: profileData.overtimeHours || "",
            overtimeBillRate: profileData.overtimeBillRate || "",
            overtimePayRate: profileData.overtimePayRate || "",

            documents:
              profileData.documents?.map((doc) => ({
                ...doc,
                id: doc.id || crypto.randomUUID(), // Ensure each document has an ID
              })) || [],
          };

          // Reset form with fetched data
          methods.reset(formData);

          // Reset the initialLoad flag after a delay to prevent auto-submission
          setTimeout(() => {
            isInitialLoad.current = false;
            console.log("Reset isInitialLoad flag after data load");
          }, 1000); // Increased from 500ms to 1000ms for more reliability
        } catch (err) {
          console.error("Error loading profile for editing:", err);
          setError(
            err instanceof Error ? err.message : "Failed to load profile data"
          );
        } finally {
          setLoading("formLoading", false);
        }
      };

      fetchProfileData();
    } else if (isDraftEditMode && profileId) {
      // In draft edit mode, fetch the specific draft by ID
      const fetchDraftById = async () => {
        try {
          setLoading("formLoading", true);
          const { draft, currentStep: savedStep } = await getJobseekerDraft(
            profileId
          );

          if (draft) {
            // Set form values from draft
            methods.reset(draft);
            // Set current step
            if (savedStep) {
              setCurrentStep(savedStep);
            }
          }
        } catch (error: unknown) {
          console.error("Error fetching draft by ID:", error);
          // Check if this is a cancellation error due to duplicate requests
          if (
            error instanceof Error &&
            error.name === "CanceledError" &&
            error.message?.includes("duplicate in-flight request")
          ) {
            console.log(
              "Ignoring duplicate request cancellation - this is normal"
            );
            // Don't set an error state for canceled requests
          } else {
            // Only show the error message for genuine errors
            setError(
              "Failed to load draft. It may have been deleted or you do not have permission to view it."
            );
          }
        } finally {
          setLoading("formLoading", false);
          // Reset the initialLoad flag after loading is complete
          setTimeout(() => {
            isInitialLoad.current = false;
            console.log("Reset isInitialLoad flag after draft load");
          }, 500);
        }
      };

      fetchDraftById();
    } else if (!shouldStartWithNewForm) {
      // Only fetch draft if not explicitly creating a new form
      const fetchDraft = async () => {
        try {
          setLoading("formLoading", true);
          const { draft, currentStep: savedStep } = await getDraft();

          if (draft) {
            // If user is a jobseeker, preserve their email
            if (isJobSeeker && user?.email) {
              draft.email = user.email;
            }

            if (draft.id) {
              setCreatedDraftId(draft.id as string);
            }

            // Set form values from draft
            methods.reset(draft);
            // Set current step
            if (savedStep) {
              setCurrentStep(savedStep);
            }
          }
        } catch (error) {
          console.error("Error fetching draft:", error);
          // Non-critical error, don't show to user
        } finally {
          setLoading("formLoading", false);
        }
      };

      fetchDraft();
    } else {
      // When creating a new form, ensure loading state is turned off
      setLoading("formLoading", false);
    }
  }, [
    isEditMode,
    isDraftEditMode,
    shouldStartWithNewForm,
    profileId,
    methods,
    isJobSeeker,
    user,
  ]);

  // Reset email availability state when moving away from step 1
  useEffect(() => {
    // Only execute this effect if the step changes
    if (currentStep !== 1) {
      // We only need to reset if it's not already null
      if (isEmailAvailable !== null) {
        setIsEmailAvailable(null); // Reset when moving to other steps
      }
    } else if (
      currentStep === 1 &&
      !isEditMode &&
      !isDraftEditMode &&
      !isJobSeeker
    ) {
      // If returning to step 1 and not in edit mode, only check if:
      // 1. We have a valid email
      // 2. We haven't checked already (isEmailAvailable is null)
      const currentEmail = methods.getValues("email");
      if (
        currentEmail &&
        currentEmail.includes("@") &&
        currentEmail.length > 5 &&
        isEmailAvailable === null
      ) {
        // Use a flag to prevent duplicate calls
        let isMounted = true;

        // Check email availability
        const checkEmail = async () => {
          try {
            setLoading("emailChecking", true);
            const result = await checkEmailAvailability(currentEmail);
            // Only update state if component is still mounted
            if (isMounted) {
              setIsEmailAvailable(result.available);
            }
          } catch (error) {
            console.error("Error checking email availability:", error);
            // Only update state if component is still mounted
            if (isMounted) {
              setIsEmailAvailable(null);
            }
          } finally {
            if (isMounted) {
              setLoading("emailChecking", false);
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
  }, [currentStep, isEditMode, isDraftEditMode]);

  // Add an effect to ensure document validation on final step - but be careful not to trigger submission
  useEffect(() => {
    // ONLY run in create mode, never in edit mode
    if (
      currentStep === 5 &&
      userInteracted &&
      !isEditMode &&
      !isDraftEditMode
    ) {
      console.log("On document step in CREATE mode, triggering validation");
      // Trigger validation for documents
      setTimeout(() => {
        methods.trigger("documents");
      }, 300);
    }
  }, [currentStep, userInteracted, methods, isEditMode, isDraftEditMode]);

  // Track if the component just mounted
  const justMounted = useRef(true);
  const isFormLoaded = useRef(false); // Add a new flag to track when form is actually loaded

  useEffect(() => {
    // Set justMounted to false after component mounts
    const timer = setTimeout(() => {
      justMounted.current = false;
      console.log("justMounted set to false");
    }, 1500); // Increased from 1000ms to 1500ms for better reliability

    // Track when user has interacted with the form
    return () => {
      clearTimeout(timer);
      previousUserInteraction.current = userInteracted;
    };
  }, [userInteracted]);

  // Add a specific effect to handle draft loading completion
  useEffect(() => {
    if (
      isDraftEditMode &&
      !loadingStates.formLoading &&
      !isFormLoaded.current
    ) {
      console.log("Form loading complete, marking as ready for submission");
      isFormLoaded.current = true;
      isInitialLoad.current = false;
    }
  }, [isDraftEditMode, loadingStates.formLoading]);

  // Centralized validation function for the current step
  const validateCurrentStep = async () => {
    const values = methods.getValues();
    const currentFields = getStepFields(currentStep);

    // Trigger validation only for fields in the current step
    const isValid = await methods.trigger(
      currentFields as Array<keyof JobseekerProfileFormData>
    );

    // Special case for step 1 (Personal info validation)
    if (currentStep === 1) {
      let personalInfoValid = isValid;

      // Check for DOB validation - ensure it's not in the future and user is at least 18
      if (values.dob) {
        const dobResult = validateDOB(values.dob);
        if (!dobResult.isValid && dobResult.errorMessage) {
          methods.setError("dob", {
            type: "custom",
            message: dobResult.errorMessage,
          });
          personalInfoValid = false;
          logValidation("validateCurrentStep: DOB validation failed: " + dobResult.errorMessage);
        }
      }

      // Check for ID document requirement
      if (personalInfoValid && !values.licenseNumber && !values.passportNumber) {
        methods.setError("licenseNumber", {
          type: "custom",
          message: "Either a license number or passport number is required",
        });
        personalInfoValid = false;
      }

      // Check for valid SIN if provided
      if (personalInfoValid && values.sinNumber) {
        const sinResult = validateSIN(values.sinNumber);
        if (!sinResult.isValid && sinResult.errorMessage) {
          methods.setError("sinNumber", {
            type: "custom",
            message: sinResult.errorMessage,
          });
          personalInfoValid = false;
          logValidation("validateCurrentStep: SIN validation failed: " + sinResult.errorMessage);
        }
      }

      if (!personalInfoValid) {
        return false;
      }
    }

    // Special case for step 4 (compensation validation) for non-jobseekers
    if (currentStep === 4 && isValid && !isJobSeeker) {
      // For non-jobseekers, validate payrate, billRate, and payRate as required
      let compensationValid = true;

      if (!values.payrateType) {
        methods.setError("payrateType", {
          type: "custom",
          message: "Payrate type is required",
        });
        compensationValid = false;
      }

      if (!values.billRate) {
        methods.setError("billRate", {
          type: "custom",
          message: "Bill rate is required",
        });
        compensationValid = false;
      }

      if (!values.payRate) {
        methods.setError("payRate", {
          type: "custom",
          message: "Pay rate is required",
        });
        compensationValid = false;
      }

      if (!values.paymentMethod) {
        methods.setError("paymentMethod", {
          type: "custom",
          message: "Payment method is required",
        });
        compensationValid = false;
      }

      if (!compensationValid) {
        return false;
      }
    }

    // Special case for step 5 (documents validation)
    if (currentStep === 5 && isValid) {
      // Check if documents array exists and has items
      if (!values.documents || values.documents.length === 0) {
        methods.setError("documents", {
          type: "custom",
          message: "At least one document is required",
        });
        return false;
      }

      // Check each document has required fields
      let documentsValid = true;
      values.documents.forEach((doc, index) => {
        if (!doc.documentType) {
          methods.setError(
            `documents.${index}.documentType` as `documents.${number}.documentType`,
            {
              type: "custom",
              message: "Document type is required",
            }
          );
          documentsValid = false;
        }

        // Check if document has either a file or path
        if (!doc.documentFile && !doc.documentPath) {
          methods.setError(
            `documents.${index}.documentFile` as `documents.${number}.documentFile`,
            {
              type: "custom",
              message: "Document file is required",
            }
          );
          documentsValid = false;
        }
      });

      return documentsValid;
    }

    return isValid;
  };

  // Helper function to check if the current step is the qualifications step (3)
  // This avoids direct comparison that's causing TypeScript narrowing errors
  const isQualificationsStep = () => currentStep === 3;

  // Function to save form data to draft
  const saveDraft = async () => {
    // Skip draft saving in regular edit mode
    if (isEditMode) {
      console.log("Draft saving skipped in edit mode");
      return true;
    }

    try {
      // Check email availability first if on first step
      if (currentStep === 1) {
        const email = methods.getValues("email");
        if (email) {
          // Only check if not already validated as available
          if (isEmailAvailable !== true) {
            try {
              setLoading("emailChecking", true);
              const result = await checkEmailAvailability(email);
              setIsEmailAvailable(result.available);

              if (!result.available) {
                setError(
                  "This email is already in use. Please use a different email to continue."
                );
                setLoading("emailChecking", false);
                return false;
              }
            } catch (emailError) {
              console.error("Error checking email availability:", emailError);
              setError(
                "Unable to verify email availability. Please try again."
              );
              setLoading("emailChecking", false);
              return false;
            } finally {
              setLoading("emailChecking", false);
            }
          }
        } else {
          setError("Email is required to save draft.");
          return false;
        }
      }

      setLoading("draftSaving", true);
      setError(null); // Clear previous errors
      const formData = methods.getValues();

      // Check if user is authenticated - needed for file uploads
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // If saving draft requires file upload, user must be logged in.
        throw new Error(
          "User must be logged in to save draft with file uploads."
        );
      }

      // Create a deep copy of form data to avoid mutating the original
      const draftData = structuredClone(formData);

      // Handle document uploads before saving draft
      if (draftData.documents && draftData.documents.length > 0) {
        for (const doc of draftData.documents) {
          // Only upload if it's a new file without a path
          if (doc.documentFile instanceof File && !doc.documentPath) {
            console.log(
              `Draft Save: Found file for document ID ${doc.id}, Type: ${doc.documentType}. Uploading...`
            );
            setLoading("fileUploading", true);

            const fileToUpload = doc.documentFile;
            const fileExt = fileToUpload.name.split(".").pop();
            const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `${user.id}/${
              doc.documentType || "uncategorized"
            }/${uniqueFileName}`;

            console.log(`Draft Save: Uploading to Supabase path: ${filePath}`);

            const { data: uploadData, error: uploadError } =
              await supabase.storage
                .from("jobseeker-documents")
                .upload(filePath, fileToUpload);

            if (uploadError) {
              console.error(
                `Draft Save: Supabase upload error for doc ${doc.id}:`,
                uploadError
              );
              // Throw error, stop draft save
              setLoading("fileUploading", false);
              throw new Error(
                `Failed to upload document '${fileToUpload.name}' during draft save: ${uploadError.message}`
              );
            } else {
              // Update document with path info
              doc.documentPath = uploadData?.path || "";
              doc.documentFileName = fileToUpload.name; // Store the original file name
              console.log(
                `Draft Save: File uploaded successfully to ${doc.documentPath}`
              );
            }
          } else if (doc.documentFile && doc.documentPath) {
            console.log(
              `Draft Save: File for document ID ${doc.id} already has a path (${doc.documentPath}), skipping upload.`
            );
          } else {
            console.log(
              `Draft Save: No new file selected for document ID ${doc.id}, skipping upload.`
            );
          }

          // Always remove the file object before saving the draft JSON
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { documentFile, ...docWithoutFile } = doc;
          Object.assign(doc, docWithoutFile); // Update the object in the array
          doc.documentFile = undefined; // Explicitly set to undefined
        }
        setLoading("fileUploading", false);
      }

      // Ensure email is explicitly included at the top level
      const email = draftData.email || "";

      // Save the potentially modified draft data (with documentPaths)
      let response;

      // If we already created a draft in this session, use that ID
      if (createdDraftId) {
        console.log(`Updating existing draft with ID: ${createdDraftId}`);
        response = await saveJobseekerDraft({
          ...draftData,
          id: createdDraftId,
          currentStep,
          email,
        });
      } else if (isDraftEditMode && profileId && !isNewForm) {
        // If we're editing a draft, update it with its ID
        response = await saveJobseekerDraft({
          ...draftData,
          id: profileId,
          currentStep,
          email,
        });
      } else if (isNewForm || !profileId) {
        // If this is a new form, always create a new draft by explicitly setting id to undefined
        response = await saveJobseekerDraft({
          ...draftData,
          id: undefined, // Force creation of a new draft
          currentStep,
          email,
        });

        // Save the ID of the newly created draft
        if (response && response.id) {
          console.log(`New draft created with ID: ${response.id}`);
          setCreatedDraftId(response.id);
        }
      } else {
        // For a new draft, use the old API in regular mode
        response = await saveDraftAPI({
          ...draftData,
          currentStep,
          email,
        });
      }

      console.log("Draft saved successfully:", response);

      setLoading("draftSaving", false);
      // Show success message (using whatever toast system is available)
      console.log("Draft saved successfully (including file uploads if any)");

      return response?.id || true;
    } catch (error) {
      console.error("Error saving draft:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unexpected error occurred while saving draft");
      }
      return false;
    } finally {
      setLoading("draftSaving", false);
      setLoading("fileUploading", false);
    }
  };

  // Function to handle "Continue" button click
  const handleContinue = async () => {
    // Mark user as having interacted with the form
    setUserInteracted(true);
    previousUserInteraction.current = true;

    if (currentStep < totalSteps) {
      // Validate the current step
      const isValid = await validateCurrentStep();

      if (!isValid) {
        scrollToError();
        return;
      }

      // For the first step, explicitly verify email availability
      if (currentStep === 1 && !isEditMode && !isDraftEditMode) {
        const email = methods.getValues("email");

        if (email) {
          try {
            // If email is available, proceed to save and continue
            const saveResult = await saveDraft();
            // If saveResult is a string/number, it's the draft ID
            if (saveResult && typeof saveResult !== "boolean") {
              setCreatedDraftId(saveResult);
            }

            if (saveResult) {
              // For jobseekers, if at qualifications step, skip to documents step
              if (isJobSeeker && isQualificationsStep()) {
                setCurrentStep(5); // Skip to documents step
              } else {
                setCurrentStep((prevStep) => prevStep + 1);
              }
            }
          } catch (error) {
            console.error("Error checking email availability:", error);
            setError("Unable to verify email availability. Please try again.");
          } finally {
            setLoading("emailChecking", false);
          }
        } else {
          // If no email provided, trigger validation errors
          await methods.trigger("email");
          setError("Email is required to continue.");
        }
      } else {
        // For other steps or in edit mode, proceed
        if (isEditMode) {
          // In edit mode, just move to the next step without saving draft
          // For jobseekers, if at qualifications step, skip to documents step
          if (isJobSeeker && isQualificationsStep()) {
            setCurrentStep(5); // Skip to documents step
          } else {
            setCurrentStep((prevStep) => prevStep + 1);
          }
        } else {
          // For other steps in create mode, save draft and continue
          const saveResult = await saveDraft();
          // If saveResult is a string/number, it's the draft ID
          if (saveResult && typeof saveResult !== "boolean") {
            setCreatedDraftId(saveResult);
          }

          if (saveResult) {
            // For jobseekers, if at qualifications step, skip to documents step
            if (isJobSeeker && isQualificationsStep()) {
              setCurrentStep(5); // Skip to documents step
            } else {
              setCurrentStep((prevStep) => prevStep + 1);
            }
          }
        }
      }
    }
  };

  // Function to handle "Back" button click with option to save
  const handleBack = async (saveBeforeBack = true) => {
    // Mark user as having interacted with the form
    setUserInteracted(true);
    previousUserInteraction.current = true;

    if (currentStep > 1) {
      // For jobseekers, if we're at step 5 (documents), go back to step 3 (qualifications)
      if (isJobSeeker && currentStep === 5) {
        if (saveBeforeBack && !isEditMode && !isDraftEditMode) {
          // Only save draft when going back if not in edit mode
          await saveDraft();
        }
        setCurrentStep(3);
      } else {
        if (saveBeforeBack && !isEditMode && !isDraftEditMode) {
          // Only save draft when going back if not in edit mode
          await saveDraft();
        }
        setCurrentStep((prevStep) => prevStep - 1);
      }
    }
  };

  // Function to handle final form submission
  const handleSubmit = async (data: JobseekerProfileFormData) => {
    console.log("Submit handler called with data:", data);

    // AGGRESSIVE protection against auto-submission in edit mode
    if (isEditMode) {
      // If component just mounted or initial load
      if (justMounted.current || isInitialLoad.current) {
        console.log(
          "BLOCKING: Preventing auto-submission on initial load in edit mode"
        );
        return;
      }

      // Additional check - if we haven't seen user interaction
      if (!userInteracted && !previousUserInteraction.current) {
        console.log(
          "BLOCKING: No user interaction detected, preventing submission"
        );
        return;
      }
    }

    // Validate the final step explicitly
    if (currentStep === totalSteps) {
      const isValid = await validateCurrentStep();
      if (!isValid) {
        scrollToError();
        return;
      }
    }

    // If this is a jobseeker in edit mode, show confirmation dialog
    if (isEditMode && isJobSeeker && profileId) {
      setFormDataToSubmit(data);
      setIsSubmitConfirmationOpen(true);
      return;
    }

    // Otherwise, proceed with normal submission
    submitFormData(data);
  };

  // New function to handle the actual submission after confirmation
  const submitFormData = async (data: JobseekerProfileFormData) => {
    try {
      // ... existing code from the handleSubmit function ...

      // Safeguard against automatic submissions
      const isDocumentStep = currentStep === 5;
      const isLoadingDocuments = loadingStates.fileUploading;

      if (isDocumentStep && isLoadingDocuments) {
        console.log("Preventing submission while documents are loading");
        return; // Prevent submission while documents are loading
      }

      setLoading("submitting", true);
      setError(null);

      // Get authenticated user for file paths
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated for file upload");
      }

      // Prepare data for submission
      const profileData = structuredClone(data);

      // Ensure jobseekers have default values for compensation fields if they're empty
      if (isJobSeeker) {
        if (!profileData.payrateType) profileData.payrateType = "Hourly";
        if (!profileData.billRate) profileData.billRate = "0";
        if (!profileData.payRate) profileData.payRate = "0";
        if (!profileData.paymentMethod) profileData.paymentMethod = "Cheque";
      }

      // Handle document file uploads if any exist
      if (profileData.documents && profileData.documents.length > 0) {
        setLoading("fileUploading", true);
        // Process each document with a file
        for (const doc of profileData.documents) {
          if (doc.documentFile instanceof File) {
            const fileToUpload = doc.documentFile;
            const fileExt = fileToUpload.name.split(".").pop();
            // Use a more structured path: userId/documentType/uuid.ext
            const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `${user.id}/${
              doc.documentType || "uncategorized"
            }/${uniqueFileName}`;

            console.log(`Uploading file to: ${filePath}`); // Debug log

            const { data: uploadData, error: uploadError } =
              await supabase.storage
                .from("jobseeker-documents") // Ensure this bucket exists and has policies set
                .upload(filePath, fileToUpload);

            if (uploadError) {
              console.error("Supabase upload error:", uploadError); // Log detailed error
              setLoading("fileUploading", false);
              throw new Error(
                `Failed to upload document: ${uploadError.message}`
              );
            }

            // Update document with path info
            doc.documentPath = uploadData?.path || "";
            doc.documentFileName = fileToUpload.name;
            console.log(`File uploaded successfully: ${doc.documentPath}`); // Debug log

            // Remove the file object before submission
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { documentFile, ...docWithoutFile } = doc;
            Object.assign(doc, docWithoutFile);
            doc.documentFile = undefined;
          }
        }
        setLoading("fileUploading", false);
      }

      let result;

      if (isEditMode && profileId) {
        // Update existing profile
        result = await updateProfile(profileId, profileData);

        // If jobseeker is editing their own profile, set status to pending and redirect to verification page
        if (isJobSeeker) {
          // Update the status to pending
          await updateJobseekerStatus(profileId, "pending");
          window.location.reload();
          return;
        }

        // For recruiter/admin edited profiles, navigate to the jobseekers list with success message
        navigate("/jobseekers", {
          state: { message: "Profile updated successfully", type: "success" },
        });
      } else if (isDraftEditMode && profileId) {
        // We're in draft edit mode and trying to create a profile from the draft
        console.log("Creating profile from draft in isDraftEditMode");

        try {
          // Submit as a new profile (don't use saveJobseekerDraft)
          result = await submitProfile(profileData);
          console.log("Profile created from draft:", result);

          // If the user is a jobseeker who created their own profile, redirect to verification pending page
          if (isJobSeeker) {
            window.location.reload();
            navigate("/profile-verification-pending");
            return;
          }

          // For recruiter-created profiles
          // Check if a new account was created
          if (result.accountCreated) {
            // Navigate to the account created page with credentials
            navigate("/jobseekers/profile/account-created", {
              state: {
                email: result.email,
                password: result.password,
                profile: result.profile,
                accountCreated: true,
              },
            });
          } else {
            // Navigate to success page
            navigate("/jobseekers/profile/success", {
              state: {
                message: "Profile created successfully",
                profileId: result.profile?.id,
                profile: result.profile,
              },
            });
          }
        } catch (submitError) {
          console.error("Error submitting profile from draft:", submitError);
          setError(
            submitError instanceof Error
              ? submitError.message
              : "Failed to create profile from draft"
          );
          throw submitError; // Re-throw to be caught by the outer catch block
        }
      } else {
        // Create new profile
        submitProfile(profileData).then((result) => {
          // If the user is a jobseeker who created their own profile, redirect to verification pending page
          if (isJobSeeker) {
            window.location.reload();
            navigate("/profile-verification-pending");
            return;
          }

          // For recruiter-created profiles
          // Check if a new account was created
          if (result.accountCreated) {
            // Navigate to the account created page with credentials
            navigate("/jobseekers/profile/account-created", {
              state: {
                email: result.email,
                password: result.password,
                profile: result.profile,
                accountCreated: true,
              },
            });
          } else {
            // Navigate to success page
            navigate("/jobseekers/profile/success", {
              state: {
                message: "Profile created successfully",
                profileId: result.profile?.id,
                profile: result.profile,
              },
            });
          }
        });
      }
    } catch (error) {
      console.error("Form submission error:", error); // Log detailed error
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unexpected error occurred during submission");
      }
    } finally {
      setLoading("submitting", false);
      setLoading("fileUploading", false);
    }
  };

  // Add this function to control which validation errors are shown
  const getStepFields = (step: number): string[] => {
    switch (step) {
      case 1:
        return [
          "firstName",
          "lastName",
          "dob",
          "email",
          "mobile",
          "licenseNumber",
          "passportNumber",
          "sinNumber",
          "sinExpiry",
          "businessNumber",
          "corporationName",
        ];
      case 2:
        return ["street", "city", "province", "postalCode"];
      case 3:
        return [
          "licenseType",
          "experience",
          "availability",
          "manualDriving",
          "workPreference",
          "bio",
          "weekendAvailability",
        ];
      case 4:
        return [
          "payrateType",
          "billRate",
          "payRate",
          "paymentMethod",
          "hstGst",
          "cashDeduction",
          "overtimeEnabled",
          "overtimeHours",
          "overtimeBillRate",
          "overtimePayRate",
        ];
      case 5:
        return ["documents"];
      default:
        return [];
    }
  };

  // Render the current step component
  const renderStep = () => {
    // For jobseekers, adjust the step display for the document form
    const displayStep = isJobSeeker && currentStep === 5 ? 4 : currentStep;

    switch (currentStep) {
      case 1:
        return (
          <PersonalInfoForm
            currentStep={currentStep}
            allFields={getStepFields(currentStep)}
            onEmailAvailabilityChange={(isAvailable) =>
              setIsEmailAvailable(isAvailable)
            }
            disableEmail={isJobSeeker || isEditMode || isDraftEditMode}
          />
        );
      case 2:
      case 3:
        return (
          <AddressQualificationsForm
            currentStep={currentStep}
            allFields={getStepFields(currentStep)}
          />
        );
      case 4:
        // Skip compensation form for jobseekers (should never reach here for jobseekers)
        if (isJobSeeker) {
          // If somehow this is reached by jobseekers, redirect to documents
          setCurrentStep(5);
          return null;
        }
        return (
          <CompensationForm
            currentStep={currentStep}
            allFields={getStepFields(currentStep)}
          />
        );
      case 5:
        return (
          <DocumentUploadForm
            currentStep={displayStep}
            allFields={getStepFields(5)}
            disableSubmit={
              loadingStates.fileUploading || loadingStates.submitting
            }
            isEditMode={isEditMode || isDraftEditMode}
          />
        );
      default:
        return (
          <PersonalInfoForm
            currentStep={1}
            allFields={getStepFields(1)}
            onEmailAvailabilityChange={(isAvailable) =>
              setIsEmailAvailable(isAvailable)
            }
            disableEmail={isJobSeeker || isEditMode || isDraftEditMode}
          />
        );
    }
  };

  // --- Step Indicator Logic ---
  const renderStepIndicator = () => {
    // For jobseekers, if on the document step (5), treat it as step 4 for UI
    const adjustedCurrentStep =
      isJobSeeker && currentStep === 5 ? 4 : currentStep;

    // Calculate overall progress percentage - width between first and last step
    const progressWidth =
      adjustedCurrentStep === 1
        ? 0
        : ((adjustedCurrentStep - 1) / (totalSteps - 1)) * 100;

    return (
      <div className="step-journey-container">
        {/* Step markers with connector line */}
        <div className="step-markers">
          {/* Progress fill that shows completion */}
          <div
            className="step-progress-fill"
            style={{ width: `${progressWidth}%` }}
          />

          {Array.from({ length: totalSteps }, (_, i) => {
            const stepNum = i + 1;

            // For jobseekers, if this is the 4th step, use the Documents label (step 5)
            const stepLabel =
              isJobSeeker && stepNum === 4
                ? getStepLabel(5) // Documents label
                : getStepLabel(stepNum);

            // Check if this step should be active
            const isActive = stepNum === adjustedCurrentStep;

            // Check if this step should be marked as completed
            const isCompleted = stepNum < adjustedCurrentStep;

            return (
              <div
                key={stepNum}
                className={`step-marker ${isActive ? "active" : ""} ${
                  isCompleted ? "completed" : ""
                }`}
                style={{ "--index": i } as React.CSSProperties}
              >
                <div className="step-bubble">
                  {isCompleted ? <Check size={20} /> : stepNum}
                </div>
                <div className="step-label">{stepLabel}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Helper function to get step labels
  const getStepLabel = (step: number): string => {
    switch (step) {
      case 1:
        return "Personal Info";
      case 2:
        return "Address";
      case 3:
        return "Qualifications";
      case 4:
        return "Compensation";
      case 5:
        return "Documents";
      default:
        return `Step ${step}`;
    }
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
      return (
        <div className="loading-indicator">Checking email availability...</div>
      );
    }
    return null;
  };

  return (
    <div className="profile-create-container">
      <AppHeader
        title={
          isEditMode
            ? "Edit Jobseeker Profile"
            : isDraftEditMode
            ? "Edit Jobseeker Draft"
            : "Create Jobseeker Profile"
        }
        actions={
          <>
            {isJobSeeker && hasProfile && (
              <button className="button" onClick={() => navigate("/dashboard")}>
                <ArrowLeft size={16} />
                <span>Back to Dashboard</span>
              </button>
            )}
            {!isEditMode && (
              <button
                type="button"
                className="button secondary button-icon"
                onClick={async () => {
                  const saveResult = await saveDraft();
                  // If saveResult is a string/number, it's the draft ID
                  if (saveResult && typeof saveResult !== "boolean") {
                    setCreatedDraftId(saveResult);
                  }
                }}
                disabled={
                  isLoading || (currentStep === 1 && isEmailAvailable === false)
                }
                title={
                  currentStep === 1 && isEmailAvailable === false
                    ? "Email is already in use. Please choose a different email."
                    : ""
                }
              >
                <Save size={16} />
                <span>
                  {loadingStates.draftSaving ? "Saving..." : "Save Draft"}
                </span>
              </button>
            )}
            {!isJobSeeker && (
              <button
                className="button button-icon"
                onClick={() => navigate("/jobseeker-management")}
              >
                <ArrowLeft size={16} />
                <span>Back to Jobseeker Management</span>
              </button>
            )}
          </>
        }
        statusMessage={
          error
            ? error
            : currentStep === 1 && isEmailAvailable === false
            ? "The email address is already in use. Please use a different email to continue."
            : undefined
        }
        statusType={
          error || (currentStep === 1 && isEmailAvailable === false)
            ? "error"
            : undefined
        }
      />

      {renderStepIndicator()}

      {renderLoadingIndicator()}

      <div className={`form-card ${isLoading ? "form-loading" : ""}`}>
        <FormProvider {...methods}>
          <form
            onSubmit={(e) => {
              console.log("Form submit event triggered");
              console.log("Submit flags state:", {
                isEditMode,
                isDraftEditMode,
                justMounted: justMounted.current,
                isInitialLoad: isInitialLoad.current,
                isFormLoaded: isFormLoaded.current,
                userInteracted,
              });

              // Prevent default form submission and manually handle later
              e.preventDefault();

              // Mark user interaction
              setUserInteracted(true);
              previousUserInteraction.current = true;

              // Only prevent auto-submission if we're REALLY in initial load
              if (
                (isEditMode || isDraftEditMode) &&
                (justMounted.current ||
                  (isInitialLoad.current && !isFormLoaded.current))
              ) {
                console.log(
                  "Preventing auto-submission on initial load in edit mode"
                );
                return;
              }

              // If there was any prevention happening but now we're good, log this
              if (isDraftEditMode) {
                console.log("Proceeding with form submission for draft edit!");
              }

              // Call React Hook Form's handleSubmit
              methods.handleSubmit(
                // On valid submission
                (data) => {
                  console.log(
                    "Form validated successfully, calling handleSubmit"
                  );
                  handleSubmit(data);
                },
                // On validation error
                (errors) => {
                  console.log("Validation errors:", errors);
                  scrollToError();
                }
              )();
            }}
            className={isLoading ? "form-loading" : ""}
          >
            <div className="form-content">{renderStep()}</div>

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

              {currentStep < totalSteps ? (
                <>
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => {
                      setUserInteracted(true);
                      handleContinue();
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="loading-spinner"></span>
                    ) : (
                      "Continue"
                    )}
                  </button>
                  {isEditMode && (
                    <button
                      type="submit"
                      className="button primary"
                      onClick={() => {
                        console.log("Submit button clicked");
                        setUserInteracted(true);
                      }}
                      disabled={isLoading && justMounted.current}
                    >
                      {loadingStates.submitting ? (
                        <span className="loading-spinner"></span>
                      ) : isEditMode ? (
                        "Update Profile"
                      ) : (
                        "Create Profile"
                      )}
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="submit"
                  className="button primary"
                  onClick={() => {
                    console.log("Submit button clicked");
                    setUserInteracted(true);
                  }}
                  disabled={isLoading && justMounted.current}
                >
                  {loadingStates.submitting ? (
                    <span className="loading-spinner"></span>
                  ) : isEditMode ? (
                    "Update Profile"
                  ) : (
                    "Create Profile"
                  )}
                </button>
              )}
            </div>
          </form>
        </FormProvider>
      </div>

      {/* Submit Confirmation Modal for Jobseekers */}
      <ConfirmationModal
        isOpen={isSubmitConfirmationOpen}
        title="Profile Status Change Notice"
        message="Your profile has been modified and will require re-verification. After submitting these changes, your profile status will change to 'pending' and your profile will not be visible to employers until our team reviews and approves the changes. Do you want to continue?"
        confirmText="Yes, Submit Changes"
        cancelText="Cancel"
        confirmButtonClass="primary"
        onConfirm={() => {
          setIsSubmitConfirmationOpen(false);
          if (formDataToSubmit) {
            submitFormData(formDataToSubmit);
          }
        }}
        onCancel={() => setIsSubmitConfirmationOpen(false)}
      />
    </div>
  );
}
