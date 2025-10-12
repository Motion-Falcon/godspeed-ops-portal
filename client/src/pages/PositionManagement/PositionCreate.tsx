import { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useLanguage } from "../../contexts/language/language-provider";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  savePositionDraft,
  getPositionDraftById,
  createPosition,
  PositionData,
  deletePositionDraft,
  getPosition,
  updatePosition,
  generatePositionCode,
} from "../../services/api/position";
import { getClients, getClient } from "../../services/api/client";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { ArrowLeft, Save } from "lucide-react";
import "../../styles/pages/PositionManagement.css";
import "../../styles/components/form.css";
import "../../styles/components/header.css";
import { AppHeader } from "../../components/AppHeader";
import {
  CustomDropdown,
  DropdownOption,
} from "../../components/CustomDropdown";
import {
  JOB_TITLES,
  EMPLOYMENT_TERMS,
  EMPLOYMENT_TYPES,
  POSITION_CATEGORIES,
  EXPERIENCE_LEVELS,
  PAYRATE_TYPES,
  PAYMENT_METHODS,
  PAYMENT_TERMS,
} from "../../constants/formOptions";

// Helper function for date formatting and validation
const formatDateForInput = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

const getTodayFormatted = (): string => {
  return formatDateForInput(new Date());
};

// Define form schema function to support translations
const createPositionFormSchema = (t: (key: string) => string) =>
  z
    .object({
      // Basic Details
      client: z
        .string()
        .min(1, { message: t("positionCreate.errors.clientRequired") }),
      title: z
        .string()
        .min(1, { message: t("positionCreate.errors.titleRequired") }),
      positionCode: z.string().optional(),
      startDate: z
        .string()
        .min(1, { message: t("positionCreate.errors.startDateRequired") }),
      endDate: z
        .string()
        .min(1, { message: t("positionCreate.errors.endDateRequired") }),
      showOnJobPortal: z.boolean().default(false),
      clientManager: z.string().optional(),
      salesManager: z.string().optional(),
      positionNumber: z.string().optional(),
      description: z
        .string()
        .min(1, { message: t("positionCreate.errors.descriptionRequired") }),

      // Address Details
      streetAddress: z
        .string()
        .min(1, { message: t("positionCreate.errors.streetAddressRequired") }),
      city: z
        .string()
        .min(1, { message: t("positionCreate.errors.cityRequired") }),
      province: z
        .string()
        .min(1, { message: t("positionCreate.errors.provinceRequired") }),
      postalCode: z
        .string()
        .min(1, { message: t("positionCreate.errors.postalCodeRequired") }),

      // Employment Categorization
      employmentTerm: z
        .string()
        .min(1, { message: t("positionCreate.errors.employmentTermRequired") }),
      employmentType: z
        .string()
        .min(1, { message: t("positionCreate.errors.employmentTypeRequired") }),
      positionCategory: z
        .string()
        .min(1, {
          message: t("positionCreate.errors.positionCategoryRequired"),
        }),
      experience: z
        .string()
        .min(1, { message: t("positionCreate.errors.experienceRequired") }),

      // Documents Required
      documentsRequired: z
        .object({
          license: z.boolean().default(false),
          driverAbstract: z.boolean().default(false),
          tdgCertificate: z.boolean().default(false),
          sin: z.boolean().default(false),
          immigrationStatus: z.boolean().default(false),
          passport: z.boolean().default(false),
          cvor: z.boolean().default(false),
          resume: z.boolean().default(false),
          articlesOfIncorporation: z.boolean().default(false),
          directDeposit: z.boolean().default(false),
        })
        .refine(
          // At least one document must be selected
          (data) => Object.values(data).some((value) => value === true),
          {
            message: t("positionCreate.errors.documentsRequired"),
            path: ["root"],
          }
        ),

      // Position Details
      payrateType: z
        .string()
        .min(1, { message: t("positionCreate.errors.payrateTypeRequired") }),
      numberOfPositions: z.coerce
        .number()
        .min(1, {
          message: t("positionCreate.errors.numberOfPositionsRequired"),
        }),
      regularPayRate: z
        .string()
        .min(1, { message: t("positionCreate.errors.regularPayRateRequired") }),
      markup: z.string().optional(),
      billRate: z
        .string()
        .min(1, { message: t("positionCreate.errors.billRateRequired") }),

      // Overtime
      overtimeEnabled: z.boolean().default(false),
      overtimeHours: z.string().optional(),
      overtimeBillRate: z.string().optional(),
      overtimePayRate: z.string().optional(),

      // Payment & Billings
      preferredPaymentMethod: z
        .string()
        .min(1, {
          message: t("positionCreate.errors.preferredPaymentMethodRequired"),
        }),
      terms: z
        .string()
        .min(1, { message: t("positionCreate.errors.termsRequired") }),

      // Notes & Task
      notes: z
        .string()
        .min(1, { message: t("positionCreate.errors.notesRequired") }),
      assignedTo: z.string().optional(),
      projCompDate: z.string().optional(),
      taskTime: z.string().optional(),
    })
    .refine(
      (data) => {
        // If overtime is enabled, require overtime fields
        if (data.overtimeEnabled) {
          return (
            data.overtimeHours &&
            data.overtimeHours.trim() !== "" &&
            data.overtimeBillRate &&
            data.overtimeBillRate.trim() !== "" &&
            data.overtimePayRate &&
            data.overtimePayRate.trim() !== ""
          );
        }
        return true;
      },
      {
        message: t("positionCreate.errors.overtimeFieldsRequired"),
        path: ["overtimeEnabled"],
      }
    )
    .transform((data) => {
      // Clear overtime fields when overtime is disabled
      if (!data.overtimeEnabled) {
        return {
          ...data,
          overtimeHours: "",
          overtimeBillRate: "",
          overtimePayRate: "",
        };
      }
      return data;
    });

type PositionFormData = z.infer<ReturnType<typeof createPositionFormSchema>>;

interface PositionCreateProps {
  isEditMode?: boolean;
  isEditDraftMode?: boolean;
}

export function PositionCreate({
  isEditMode = false,
  isEditDraftMode = false,
}: PositionCreateProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [positionId, setPositionId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState(
    t("positionCreate.createPosition")
  );
  const [clients, setClients] = useState<
    Array<{ id: string; companyName: string }>
  >([]);
  const [minEndDate, setMinEndDate] = useState<string>(getTodayFormatted());
  const [clientLoading, setClientLoading] = useState(false);

  // Job title options
  const titleOptions: DropdownOption[] = JOB_TITLES.map((title) => ({
    id: title,
    value: title,
    label: title,
  }));

  // Employment term options
  const employmentTermOptions: DropdownOption[] = EMPLOYMENT_TERMS.map(
    (term) => ({
      id: term,
      value: term,
      label: term,
    })
  );

  // Employment type options
  const employmentTypeOptions: DropdownOption[] = EMPLOYMENT_TYPES.map(
    (type) => ({
      id: type,
      value: type,
      label: type,
    })
  );

  // Position category options
  const positionCategoryOptions: DropdownOption[] = POSITION_CATEGORIES.map(
    (category) => ({
      id: category,
      value: category,
      label: category,
    })
  );

  // Experience level options
  const experienceOptions: DropdownOption[] = EXPERIENCE_LEVELS.map(
    (level) => ({
      id: level,
      value: level,
      label: level,
    })
  );

  // Payrate type options
  const payrateTypeOptions: DropdownOption[] = PAYRATE_TYPES.map((type) => ({
    id: type,
    value: type,
    label: type,
  }));

  // Payment method options
  const paymentMethodOptions: DropdownOption[] = PAYMENT_METHODS.map(
    (method) => ({
      id: method,
      value: method,
      label: method,
    })
  );

  // Payment terms options
  const paymentTermsOptions: DropdownOption[] = PAYMENT_TERMS.map((term) => ({
    id: term,
    value: term,
    label: term,
  }));

  // Get ID from URL params or location state
  const idFromParams = params.id;
  const idFromLocation = location.state?.id;
  const id = idFromParams || idFromLocation;

  // Initialize form with validation
  const methods = useForm<PositionFormData>({
    resolver: zodResolver(createPositionFormSchema(t)),
    defaultValues: {
      showOnJobPortal: false,
      documentsRequired: {
        license: false,
        driverAbstract: false,
        tdgCertificate: false,
        sin: false,
        immigrationStatus: false,
        passport: false,
        cvor: false,
        resume: false,
        articlesOfIncorporation: false,
        directDeposit: false,
      },
      payrateType: t("positionCreate.defaults.hourly"),
    },
    mode: "onBlur",
  });

  const { handleSubmit, reset, formState, watch, setValue, getValues } =
    methods;
  const { isDirty } = formState;

  // Function to convert snake_case keys to camelCase
  const convertToCamelCase = (
    data: PositionData | Record<string, unknown>
  ): PositionFormData => {
    const result: Record<string, unknown> = {};

    // Process each key-value pair
    Object.entries(data).forEach(([key, value]) => {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
        letter.toUpperCase()
      );

      // Handle special case: map client_id to client for the form
      if (key === "client_id") {
        result["client"] = value;
      } else {
        result[camelKey] = value;
      }
    });

    return result as PositionFormData;
  };

  // Load clients for the dropdown
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setClientLoading(true);
        // Get all clients by setting a high limit
        const response = await getClients({ limit: 1000 });

        const formattedClients = response.clients
          .map((client) => ({
            id: client.id || "",
            companyName: client.companyName || "",
          }))
          .filter((client) => client.id && client.companyName); // Filter after mapping to see what we get

        setClients(formattedClients);
        console.log(
          "Clients loaded:",
          formattedClients.length,
          formattedClients
        );
        console.log("Current form client value:", methods.getValues("client"));
      } catch (err) {
        console.error("Error fetching clients:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : t("positionCreate.errors.failedToFetchClients");
        setError(errorMessage);
        setTimeout(() => setError(null), 3000);
      } finally {
        setClientLoading(false);
      }
    };

    fetchClients();
  }, []);

  // Watch for form changes
  useEffect(() => {
    if (isDirty) {
      setHasUnsavedChanges(true);
    }
  }, [watch(), isDirty]);

  // Fix client dropdown selection: Re-set client value when clients are loaded in edit mode
  useEffect(() => {
    if ((isEditMode || isEditDraftMode) && clients.length > 0) {
      const currentClientValue = methods.getValues("client");
      if (currentClientValue) {
        // Check if the client exists in the loaded clients
        const clientExists = clients.some(
          (client) => client.id === currentClientValue
        );
        if (clientExists) {
          // Re-set the value to trigger the dropdown to show the selection
          methods.setValue("client", currentClientValue);
          console.log(
            "Re-set client value for dropdown display:",
            currentClientValue
          );
        }
      }
    }
  }, [clients, isEditMode, isEditDraftMode, methods]);

  // Set page title based on mode
  useEffect(() => {
    if (isEditMode) {
      setPageTitle(t("positionCreate.editPosition"));
    } else if (isEditDraftMode) {
      setPageTitle(t("positionCreate.editPositionDraft"));
    } else {
      setPageTitle(t("positionCreate.createPosition"));
    }
  }, [isEditMode, isEditDraftMode, t]);

  // Update load position effect
  useEffect(() => {
    if (isEditMode && id) {
      console.log("Loading position for editing with ID:", id);
      const loadPosition = async () => {
        setLoading(true);
        try {
          const position = await getPosition(id);
          console.log("Position data loaded:", position);

          if (position) {
            // Convert snake_case keys to camelCase for the form
            const formattedPosition = convertToCamelCase(position);
            console.log("Formatted position data:", formattedPosition);

            setPositionId(id);

            // Reset form with position data
            reset(formattedPosition);
            console.log("Form reset with position data");
            console.log("Client value after reset:", formattedPosition.client);

            // Position is already saved, so form is not dirty
            setHasUnsavedChanges(false);
          }
        } catch (err) {
          console.error("Error loading position:", err);
          const errorMessage =
            err instanceof Error
              ? err.message
              : t("positionCreate.errors.errorLoadingPosition");
          setError(errorMessage);
          setTimeout(() => setError(null), 3000);
        } finally {
          setLoading(false);
        }
      };

      loadPosition();
    }
  }, [id, isEditMode, reset]);

  // Update load draft effect
  useEffect(() => {
    if (isEditDraftMode && id) {
      console.log("Loading draft for editing with ID:", id);
      const loadDraft = async () => {
        setLoading(true);
        try {
          const { draft, lastUpdated } = await getPositionDraftById(id);
          console.log("Draft data loaded:", draft);

          if (draft) {
            // Ensure data is in camelCase format
            const formattedDraft = convertToCamelCase(draft);
            console.log("Formatted draft data:", formattedDraft);

            setDraftId(draft.id as string);
            setLastSaved(lastUpdated);

            // Reset form with draft data
            reset(formattedDraft);
            console.log("Form reset with draft data");
            console.log("Client value after reset:", formattedDraft.client);

            // Regenerate position code to ensure it's still unique
            if (formattedDraft.client) {
              try {
                const result = await generatePositionCode(
                  formattedDraft.client
                );
                console.log("Regenerated position code for draft:", result);
                methods.setValue("positionCode", result.positionCode);

                // Mark form as having changes since we updated the position code
                setHasUnsavedChanges(true);
              } catch (error) {
                console.error(
                  "Error regenerating position code for draft:",
                  error
                );
                // Continue loading the draft even if position code regeneration fails
              }
            }

            // Don't set form as clean since we regenerated the position code
            // setHasUnsavedChanges(false);
          }
        } catch (err) {
          console.error("Error loading draft:", err);
          const errorMessage =
            err instanceof Error
              ? err.message
              : t("positionCreate.errors.errorLoadingDraft");
          setError(errorMessage);
          setTimeout(() => setError(null), 3000);
        } finally {
          setLoading(false);
        }
      };

      loadDraft();
    }
  }, [id, isEditDraftMode, reset, methods]);

  // Prevent accidental navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Save draft periodically (only if not in position edit mode)
  useEffect(() => {
    let saveDraftInterval: NodeJS.Timeout;

    if (hasUnsavedChanges && !isEditMode) {
      saveDraftInterval = setInterval(() => {
        handleSaveDraft();
      }, 60000); // Auto-save every minute
    }

    return () => {
      if (saveDraftInterval) clearInterval(saveDraftInterval);
    };
  }, [hasUnsavedChanges, isEditMode, watch()]);

  // Add an effect to update minEndDate when startDate changes
  useEffect(() => {
    const startDateValue = methods.watch("startDate");
    if (startDateValue) {
      setMinEndDate(startDateValue);
    } else {
      setMinEndDate(getTodayFormatted());
    }
  }, [methods.watch("startDate")]);

  // Clear overtime fields when overtime is disabled
  useEffect(() => {
    const overtimeEnabled = methods.watch("overtimeEnabled");
    if (!overtimeEnabled) {
      methods.setValue("overtimeHours", "");
      methods.setValue("overtimeBillRate", "");
      methods.setValue("overtimePayRate", "");
      // Clear any validation errors for overtime fields
      methods.clearErrors([
        "overtimeHours",
        "overtimeBillRate",
        "overtimePayRate",
      ]);
    }
  }, [methods.watch("overtimeEnabled"), methods]);

  // Auto-calculate bill rate when markup or pay rate changes
  useEffect(() => {
    let isCalculating = false; // Prevent infinite loops

    const subscription = methods.watch((value, { name, type }) => {
      // Skip if we're in the middle of a calculation or not a user change
      if (isCalculating || type !== "change") return;

      const payRate = parseFloat(value.regularPayRate || "0");
      const markup = value.markup ? parseFloat(value.markup) : null;
      const billRate = value.billRate ? parseFloat(value.billRate) : null;

      isCalculating = true;

      try {
        // Priority 1: If markup is entered/changed, calculate bill rate
        if (
          name === "markup" &&
          payRate > 0 &&
          markup !== null &&
          !isNaN(markup)
        ) {
          const calculatedBillRate = payRate * (1 + markup / 100);
          methods.setValue("billRate", calculatedBillRate.toFixed(2), {
            shouldValidate: true,
          });
        }
        // Priority 2: If bill rate is entered/changed, calculate markup
        else if (
          name === "billRate" &&
          payRate > 0 &&
          billRate !== null &&
          !isNaN(billRate) &&
          billRate > 0
        ) {
          const calculatedMarkup = ((billRate - payRate) / payRate) * 100;
          methods.setValue("markup", calculatedMarkup.toFixed(2), {
            shouldValidate: false,
          });
        }
        // Priority 3: If pay rate changes and markup exists, recalculate bill rate
        else if (name === "regularPayRate" && payRate > 0) {
          if (markup !== null && !isNaN(markup)) {
            const calculatedBillRate = payRate * (1 + markup / 100);
            methods.setValue("billRate", calculatedBillRate.toFixed(2), {
              shouldValidate: true,
            });
          } else if (billRate !== null && !isNaN(billRate) && billRate > 0) {
            const calculatedMarkup = ((billRate - payRate) / payRate) * 100;
            methods.setValue("markup", calculatedMarkup.toFixed(2), {
              shouldValidate: false,
            });
          }
        }
      } finally {
        isCalculating = false;
      }
    });

    return () => subscription.unsubscribe();
  }, [methods]);

  // Create client options for CustomDropdown
  const clientOptions: DropdownOption[] = clients.map((client) => ({
    id: client.id,
    value: client.id,
    label: client.companyName,
  }));

  // Handle client selection for CustomDropdown
  const handleClientSelect = async (
    option: DropdownOption | DropdownOption[]
  ) => {
    if (Array.isArray(option)) return;
    const clientId = option.value as string;

    // Set the client value
    methods.setValue("client", clientId);

    // Trigger client data fetch
    fetchClientDetails(clientId);

    // Generate position code for the selected client
    try {
      const result = await generatePositionCode(clientId);
      console.log("Generated position code:", result);

      // Always generate new position code for new positions and draft edits
      // For regular position edits, only generate if empty
      const currentPositionCode = methods.getValues("positionCode");
      if (!isEditMode) {
        // For new positions and draft edits, always regenerate to ensure uniqueness
        methods.setValue("positionCode", result.positionCode);
      } else if (!currentPositionCode) {
        // For position edit mode, only generate if empty
        methods.setValue("positionCode", result.positionCode);
      }
    } catch (error) {
      console.error("Error generating position code:", error);
      // Don't show error to user as this is automatic
    }
  };

  // Handle title selection for CustomDropdown
  const handleTitleSelect = (option: DropdownOption | DropdownOption[]) => {
    if (Array.isArray(option)) return;
    methods.setValue("title", option.value as string);
  };

  const handleSaveDraft = async () => {
    const formData = methods.getValues();

    // Check if client is selected before saving draft
    if (!formData.client) {
      setError(t("positionCreate.errors.clientRequired"));
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Validate end date is after start date if both are provided
    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);

      if (endDate <= startDate) {
        setError(t("positionCreate.errors.endDateAfterStart"));
        setTimeout(() => setError(null), 3000);
        return;
      }
    }

    setSaving(true);

    try {
      const draftData = {
        ...formData,
        id: draftId || undefined, // Use undefined instead of null for API
        isDraft: true,
      };

      const response = await savePositionDraft(draftData);

      if (response && response.draft) {
        setDraftId((response.draft.id as string) || null);
        setLastSaved(response.lastUpdated || new Date().toISOString());
        setHasUnsavedChanges(false);
        setSuccess(t("positionCreate.messages.draftSaved"));
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error("Error saving draft:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("positionCreate.errors.failedToSaveDraft");
      setError(errorMessage);
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleFormSubmit = async (data: PositionFormData) => {
    // Validate end date is after start date if both are provided
    if (data.startDate && data.endDate) {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);

      if (endDate <= startDate) {
        setError(t("positionCreate.errors.endDateAfterStart"));
        setTimeout(() => setError(null), 3000);
        return;
      }
    }

    setLoading(true);

    try {
      if (isEditMode && positionId) {
        // Update existing position
        const dataToSubmit = { ...data };
        // Remove clientName property if it exists
        if ("clientName" in dataToSubmit) {
          delete (dataToSubmit as Record<string, unknown>).clientName;
        }

        await updatePosition(
          positionId,
          dataToSubmit as unknown as PositionData
        );
        setSuccess(t("positionCreate.messages.positionUpdated"));
        setTimeout(() => {
          setSuccess(null);
          navigateBack();
        }, 1000);
      } else {
        // Create new position regardless of whether we're in create mode or draft edit mode
        const dataToSubmit = { ...data };
        // Remove clientName property if it exists
        if ("clientName" in dataToSubmit) {
          delete (dataToSubmit as Record<string, unknown>).clientName;
        }

        await createPosition(dataToSubmit as unknown as PositionData);

        // If we were in draft edit mode, delete the draft after creating position
        if (isEditDraftMode && draftId) {
          await deletePositionDraft(draftId);
        }

        setSuccess(t("positionCreate.messages.positionCreated"));
        setTimeout(() => {
          setSuccess(null);
          navigateBack();
        }, 1000);
      }
    } catch (err) {
      console.error("Error creating/updating position:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("positionCreate.errors.failedToCreateUpdatePosition");
      setError(errorMessage);
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges && !isEditMode) {
      setShowExitConfirmation(true);
    } else {
      navigateBack();
    }
  };

  const navigateBack = () => {
    if (isEditDraftMode) {
      navigate("/position-management/drafts");
    } else {
      navigate("/position-management");
    }
  };

  // Function to fetch client details and autofill form fields
  const fetchClientDetails = async (clientId: string) => {
    try {
      const client = await getClient(clientId);

      // Auto-fill client manager and sales manager
      methods.setValue("clientManager", client.clientManager || "");
      methods.setValue("salesManager", client.salesPerson || "");

      // Auto-fill address fields from client
      methods.setValue("streetAddress", client.streetAddress1 || "");
      methods.setValue("city", client.city1 || "");
      methods.setValue("province", client.province1 || "");
      methods.setValue("postalCode", client.postalCode1 || "");
    } catch (err) {
      console.error("Error fetching client details:", err);
    }
  };

  return (
    <div className="page-container">
      <AppHeader
        title={pageTitle}
        actions={
          <>
            {!isEditMode && (
              <button
                className="button secondary button-icon"
                onClick={handleSaveDraft}
                disabled={saving || !hasUnsavedChanges}
              >
                <Save size={16} />
                <span>
                  {saving
                    ? t("positionCreate.buttons.saving")
                    : t("positionCreate.buttons.saveDraft")}
                </span>
              </button>
            )}
            <button className="button button-icon" onClick={handleCancel}>
              <ArrowLeft size={16} />
              <span>
                {t("positionCreate.buttons.backToPositionManagement")}
              </span>
            </button>
          </>
        }
        statusMessage={error || success}
        statusType={error ? "error" : success ? "success" : undefined}
      />

      <div className="content-container">
        {lastSaved && !isEditMode && (
          <div className="last-saved">
            {t("positionCreate.info.lastSaved", {
              date: new Date(lastSaved).toLocaleString(),
            })}
          </div>
        )}

        <FormProvider {...methods}>
          <form
            onSubmit={handleSubmit(handleFormSubmit)}
            className="client-form"
          >
            <div className="form-card">
              {/* Basic Details Section */}
              <div className="form-section">
                <h2>{t("positionCreate.sections.basicDetails")}</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      htmlFor="client"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.client")}
                    </label>
                    {/* Hidden input for form registration */}
                    <input type="hidden" {...methods.register("client")} />
                    {clientLoading ? (
                      <div className="invoice-dropdown-skeleton">
                        <div className="skeleton-dropdown-trigger">
                          <div className="skeleton-icon"></div>
                          <div className="skeleton-text skeleton-dropdown-text"></div>
                          <div className="skeleton-icon skeleton-chevron"></div>
                        </div>
                      </div>
                    ) : (
                      <CustomDropdown
                        options={clientOptions}
                        selectedOption={(() => {
                          const selectedClientId = methods.getValues("client");
                          if (selectedClientId) {
                            const selectedClient = clients.find(
                              (c) => c.id === selectedClientId
                            );
                            return selectedClient
                              ? {
                                  id: selectedClient.id,
                                  label: selectedClient.companyName,
                                  value: selectedClient.id,
                                }
                              : null;
                          }
                          return null;
                        })()}
                        onSelect={(option) => {
                          if (Array.isArray(option)) return;
                          handleClientSelect(option);
                        }}
                        placeholder={t(
                          "positionCreate.placeholders.searchClients"
                        )}
                        searchable={true}
                        clearable={true}
                        onClear={() => methods.setValue("client", "")}
                        emptyMessage="No clients found"
                      />
                    )}
                    {methods.formState.errors.client && (
                      <p className="form-error">
                        {methods.formState.errors.client.message}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor="title"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.title")}
                    </label>
                    {/* Hidden input for form registration */}
                    <input type="hidden" {...methods.register("title")} />
                    <CustomDropdown
                      options={titleOptions}
                      selectedOption={
                        methods.getValues("title")
                          ? {
                              id: methods.getValues("title"),
                              label: methods.getValues("title"),
                              value: methods.getValues("title"),
                            }
                          : null
                      }
                      onSelect={(option) => {
                        if (Array.isArray(option)) return;
                        handleTitleSelect(option);
                      }}
                      placeholder={t(
                        "positionCreate.placeholders.searchJobTitles"
                      )}
                      searchable={true}
                      clearable={true}
                      onClear={() => methods.setValue("title", "")}
                      emptyMessage={t(
                        "positionCreate.emptyMessages.noJobTitles"
                      )}
                    />
                    {methods.formState.errors.title && (
                      <p className="form-error">
                        {methods.formState.errors.title.message}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="positionNumber" className="form-label">
                      {t("positionCreate.fields.positionNumber")}
                    </label>
                    <input
                      type="text"
                      id="positionNumber"
                      className="form-input"
                      placeholder={t(
                        "positionCreate.placeholders.positionCode"
                      )}
                      {...methods.register("positionNumber")}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="positionCode" className="form-label">
                      {t("positionCreate.fields.positionId")}
                    </label>
                    <input
                      type="text"
                      id="positionCode"
                      className="form-input auto-populated"
                      placeholder={
                        isEditDraftMode
                          ? t("positionCreate.placeholders.autoRegenerated")
                          : t("positionCreate.placeholders.autoGenerated")
                      }
                      disabled
                      {...methods.register("positionCode")}
                    />
                    {isEditDraftMode && (
                      <div className="form-info">
                        <small>
                          {t("positionCreate.info.positionIdRegenerated")}
                        </small>
                      </div>
                    )}
                    {methods.formState.errors.positionCode && (
                      <p className="form-error">
                        {methods.formState.errors.positionCode.message}
                      </p>
                    )}
                  </div>
                  <div className="form-group">
                    <label
                      htmlFor="startDate"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.startDate")}
                    </label>
                    <div className="date-picker-container">
                      <input
                        type="date"
                        id="startDate"
                        className="form-input"
                        {...methods.register("startDate")}
                        onClick={(e) => e.currentTarget.showPicker()}
                      />
                    </div>
                    {methods.formState.errors.startDate && (
                      <p className="form-error">
                        {methods.formState.errors.startDate.message}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor="endDate"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.endDate")}
                    </label>
                    <div className="date-picker-container">
                      <input
                        type="date"
                        id="endDate"
                        className="form-input"
                        min={minEndDate}
                        {...methods.register("endDate")}
                        onClick={(e) => e.currentTarget.showPicker()}
                      />
                    </div>
                    {methods.formState.errors.endDate && (
                      <p className="form-error">
                        {methods.formState.errors.endDate.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <div className="container-form">
                      <input
                        type="checkbox"
                        id="showOnJobPortal"
                        className="toggle-form"
                        {...methods.register("showOnJobPortal")}
                      />
                      <label htmlFor="showOnJobPortal" className="label-form">
                        {t("positionCreate.fields.showOnJobPortal")}
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="clientManager" className="form-label">
                      {t("positionCreate.fields.clientManager")}
                    </label>
                    <input
                      type="text"
                      id="clientManager"
                      className="form-input auto-populated"
                      placeholder={t("positionCreate.placeholders.autoFilled")}
                      disabled
                      {...methods.register("clientManager")}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="salesManager" className="form-label">
                      {t("positionCreate.fields.salesManager")}
                    </label>
                    <input
                      type="text"
                      id="salesManager"
                      className="form-input auto-populated"
                      placeholder={t("positionCreate.placeholders.autoFilled")}
                      disabled
                      {...methods.register("salesManager")}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      htmlFor="description"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.description")}
                    </label>
                    <textarea
                      id="description"
                      className="form-textarea"
                      placeholder={t(
                        "positionCreate.placeholders.positionDescription"
                      )}
                      rows={4}
                      {...methods.register("description")}
                    />
                    {methods.formState.errors.description && (
                      <p className="form-error">
                        {methods.formState.errors.description.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Address Details Section */}
              <div className="form-section">
                <h2>{t("positionCreate.sections.addressDetails")}</h2>

                <div className="form-info" data-required="*">
                  <small>{t("positionCreate.info.addressAutoFill")}</small>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      htmlFor="streetAddress"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.streetAddress")}
                    </label>
                    <input
                      type="text"
                      id="streetAddress"
                      className="form-input auto-populated"
                      placeholder={t(
                        "positionCreate.placeholders.streetAddress"
                      )}
                      {...methods.register("streetAddress")}
                    />
                    {methods.formState.errors.streetAddress && (
                      <p className="form-error">
                        {methods.formState.errors.streetAddress.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      htmlFor="city"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.city")}
                    </label>
                    <input
                      type="text"
                      id="city"
                      className="form-input auto-populated"
                      placeholder={t("positionCreate.placeholders.city")}
                      {...methods.register("city")}
                    />
                    {methods.formState.errors.city && (
                      <p className="form-error">
                        {methods.formState.errors.city.message}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor="province"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.province")}
                    </label>
                    <input
                      type="text"
                      id="province"
                      className="form-input auto-populated"
                      placeholder={t("positionCreate.placeholders.province")}
                      {...methods.register("province")}
                    />
                    {methods.formState.errors.province && (
                      <p className="form-error">
                        {methods.formState.errors.province.message}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor="postalCode"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.postalCode")}
                    </label>
                    <input
                      type="text"
                      id="postalCode"
                      className="form-input auto-populated"
                      placeholder={t("positionCreate.placeholders.postalCode")}
                      {...methods.register("postalCode")}
                    />
                    {methods.formState.errors.postalCode && (
                      <p className="form-error">
                        {methods.formState.errors.postalCode.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Employment Categorization Section */}
              <div className="form-section">
                <h2>{t("positionCreate.sections.employmentCategorization")}</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      htmlFor="employmentTerm"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.employmentTerm")}
                    </label>
                    <input
                      type="hidden"
                      {...methods.register("employmentTerm")}
                    />
                    <CustomDropdown
                      options={employmentTermOptions}
                      selectedOption={
                        employmentTermOptions.find(
                          (option) =>
                            option.value === getValues("employmentTerm")
                        ) || null
                      }
                      onSelect={(option) => {
                        if (Array.isArray(option)) return;
                        setValue("employmentTerm", option.value as string, {
                          shouldValidate: true,
                        });
                      }}
                      placeholder={t(
                        "positionCreate.selectOptions.selectEmploymentTerm"
                      )}
                      searchable={true}
                      clearable={true}
                      onClear={() =>
                        setValue("employmentTerm", "", { shouldValidate: true })
                      }
                    />
                    {methods.formState.errors.employmentTerm && (
                      <p className="form-error">
                        {methods.formState.errors.employmentTerm.message}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor="employmentType"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.employmentType")}
                    </label>
                    <input
                      type="hidden"
                      {...methods.register("employmentType")}
                    />
                    <CustomDropdown
                      options={employmentTypeOptions}
                      selectedOption={
                        employmentTypeOptions.find(
                          (option) =>
                            option.value === getValues("employmentType")
                        ) || null
                      }
                      onSelect={(option) => {
                        if (Array.isArray(option)) return;
                        setValue("employmentType", option.value as string, {
                          shouldValidate: true,
                        });
                      }}
                      placeholder={t(
                        "positionCreate.selectOptions.selectEmploymentType"
                      )}
                      searchable={true}
                      clearable={true}
                      onClear={() =>
                        setValue("employmentType", "", { shouldValidate: true })
                      }
                    />
                    {methods.formState.errors.employmentType && (
                      <p className="form-error">
                        {methods.formState.errors.employmentType.message}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor="positionCategory"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.positionCategory")}
                    </label>
                    <input
                      type="hidden"
                      {...methods.register("positionCategory")}
                    />
                    <CustomDropdown
                      options={positionCategoryOptions}
                      selectedOption={
                        positionCategoryOptions.find(
                          (option) =>
                            option.value === getValues("positionCategory")
                        ) || null
                      }
                      onSelect={(option) => {
                        if (Array.isArray(option)) return;
                        setValue("positionCategory", option.value as string, {
                          shouldValidate: true,
                        });
                      }}
                      placeholder={t(
                        "positionCreate.selectOptions.selectPositionCategory"
                      )}
                      searchable={true}
                      clearable={true}
                      onClear={() =>
                        setValue("positionCategory", "", {
                          shouldValidate: true,
                        })
                      }
                    />
                    {methods.formState.errors.positionCategory && (
                      <p className="form-error">
                        {methods.formState.errors.positionCategory.message}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor="experience"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.experience")}
                    </label>
                    <input type="hidden" {...methods.register("experience")} />
                    <CustomDropdown
                      options={experienceOptions}
                      selectedOption={
                        experienceOptions.find(
                          (option) => option.value === getValues("experience")
                        ) || null
                      }
                      onSelect={(option) => {
                        if (Array.isArray(option)) return;
                        setValue("experience", option.value as string, {
                          shouldValidate: true,
                        });
                      }}
                      placeholder={t(
                        "positionCreate.selectOptions.selectExperienceLevel"
                      )}
                      searchable={true}
                      clearable={true}
                      onClear={() =>
                        setValue("experience", "", { shouldValidate: true })
                      }
                    />
                    {methods.formState.errors.experience && (
                      <p className="form-error">
                        {methods.formState.errors.experience.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Documents Required Section */}
              <div className="form-section">
                <h2>{t("positionCreate.sections.documentsRequired")}</h2>

                <div className="form-row">
                  {/* <div className="form-group"> */}
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id="license"
                      className="form-checkbox"
                      {...methods.register("documentsRequired.license")}
                    />
                    <label htmlFor="license" className="checkbox-label">
                      {t("positionCreate.documents.license")}
                    </label>
                  </div>
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id="driverAbstract"
                      className="form-checkbox"
                      {...methods.register("documentsRequired.driverAbstract")}
                    />
                    <label htmlFor="driverAbstract" className="checkbox-label">
                      {t("positionCreate.documents.driverAbstract")}
                    </label>
                  </div>
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id="tdgCertificate"
                      className="form-checkbox"
                      {...methods.register("documentsRequired.tdgCertificate")}
                    />
                    <label htmlFor="tdgCertificate" className="checkbox-label">
                      {t("positionCreate.documents.tdgCertificate")}
                    </label>
                  </div>
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id="sin"
                      className="form-checkbox"
                      {...methods.register("documentsRequired.sin")}
                    />
                    <label htmlFor="sin" className="checkbox-label">
                      {t("positionCreate.documents.sin")}
                    </label>
                  </div>
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id="immigrationStatus"
                      className="form-checkbox"
                      {...methods.register(
                        "documentsRequired.immigrationStatus"
                      )}
                    />
                    <label
                      htmlFor="immigrationStatus"
                      className="checkbox-label"
                    >
                      {t("positionCreate.documents.immigrationStatus")}
                    </label>
                  </div>
                </div>

                <div className="form-row">
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id="passport"
                      className="form-checkbox"
                      {...methods.register("documentsRequired.passport")}
                    />
                    <label htmlFor="passport" className="checkbox-label">
                      {t("positionCreate.documents.passport")}
                    </label>
                  </div>
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id="cvor"
                      className="form-checkbox"
                      {...methods.register("documentsRequired.cvor")}
                    />
                    <label htmlFor="cvor" className="checkbox-label">
                      {t("positionCreate.documents.cvor")}
                    </label>
                  </div>
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id="resume"
                      className="form-checkbox"
                      {...methods.register("documentsRequired.resume")}
                    />
                    <label htmlFor="resume" className="checkbox-label">
                      {t("positionCreate.documents.resume")}
                    </label>
                  </div>
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id="articlesOfIncorporation"
                      className="form-checkbox"
                      {...methods.register(
                        "documentsRequired.articlesOfIncorporation"
                      )}
                    />
                    <label
                      htmlFor="articlesOfIncorporation"
                      className="checkbox-label"
                    >
                      {t("positionCreate.documents.articlesOfIncorporation")}
                    </label>
                  </div>
                  <div className="checkbox-container">
                    <input
                      type="checkbox"
                      id="directDeposit"
                      className="form-checkbox"
                      {...methods.register("documentsRequired.directDeposit")}
                    />
                    <label htmlFor="directDeposit" className="checkbox-label">
                      {t("positionCreate.documents.directDeposit")}
                    </label>
                  </div>
                </div>

                {(methods.formState.errors.documentsRequired?.root ||
                  methods.formState.errors.documentsRequired?.message) && (
                  <p className="form-error">
                    {methods.formState.errors.documentsRequired?.root
                      ?.message ||
                      methods.formState.errors.documentsRequired?.message ||
                      t("positionCreate.errors.documentsRequired")}
                  </p>
                )}
              </div>

              {/* Position Details Section */}
              <div className="form-section">
                <h2>{t("positionCreate.sections.positionDetails")}</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      htmlFor="numberOfPositions"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.numberOfPositions")}
                    </label>
                    <input
                      type="number"
                      id="numberOfPositions"
                      className="form-input"
                      placeholder={t(
                        "positionCreate.placeholders.numberOfPositions"
                      )}
                      min="1"
                      required
                      {...methods.register("numberOfPositions")}
                    />
                    {methods.formState.errors.numberOfPositions && (
                      <p className="form-error">
                        {methods.formState.errors.numberOfPositions.message}
                      </p>
                    )}
                  </div>
                  <div className="form-group">
                    <label
                      htmlFor="payrateType"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.payrateType")}
                    </label>
                    <input type="hidden" {...methods.register("payrateType")} />
                    <CustomDropdown
                      options={payrateTypeOptions}
                      selectedOption={
                        payrateTypeOptions.find(
                          (option) => option.value === getValues("payrateType")
                        ) || null
                      }
                      onSelect={(option) => {
                        if (Array.isArray(option)) return;
                        setValue("payrateType", option.value as string, {
                          shouldValidate: true,
                        });
                      }}
                      placeholder={t(
                        "positionCreate.selectOptions.selectPayrateType"
                      )}
                      searchable={true}
                      clearable={true}
                      onClear={() =>
                        setValue("payrateType", "", { shouldValidate: true })
                      }
                    />
                    {methods.formState.errors.payrateType && (
                      <p className="form-error">
                        {methods.formState.errors.payrateType.message}
                      </p>
                    )}
                  </div>
                  <div className="form-group">
                    <label
                      htmlFor="regularPayRate"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.regularPayRate")}
                    </label>
                    <input
                      type="text"
                      id="regularPayRate"
                      className="form-input"
                      placeholder={t(
                        "positionCreate.placeholders.regularPayRate"
                      )}
                      {...methods.register("regularPayRate")}
                    />
                    {methods.formState.errors.regularPayRate && (
                      <p className="form-error">
                        {methods.formState.errors.regularPayRate.message}
                      </p>
                    )}
                  </div>
                  <div className="form-group">
                    <label
                      htmlFor="billRate"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.billRate")}
                    </label>
                    <input
                      type="text"
                      id="billRate"
                      className="form-input"
                      placeholder={t("positionCreate.placeholders.billRate")}
                      {...methods.register("billRate")}
                    />
                    <div className="form-info">
                      <small>{t("positionCreate.info.billRateAutoCalc")}</small>
                    </div>
                    {methods.formState.errors.billRate && (
                      <p className="form-error">
                        {methods.formState.errors.billRate.message}
                      </p>
                    )}
                  </div>
                  <div className="form-group">
                    <label htmlFor="markup" className="form-label">
                      {t("positionCreate.fields.markup")}
                    </label>
                    <input
                      type="text"
                      id="markup"
                      className="form-input"
                      placeholder={t("positionCreate.placeholders.markup")}
                      {...methods.register("markup")}
                    />
                    <div className="form-info">
                      <small>{t("positionCreate.info.markupAutoCalc")}</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Overtime Section */}
              <div className="form-section">
                <h2>{t("positionCreate.sections.overtime")}</h2>

                <div className="form-row">
                  <div className="container-form">
                    <input
                      type="checkbox"
                      id="overtimeEnabled"
                      className="toggle-form"
                      {...methods.register("overtimeEnabled")}
                    />
                    <label htmlFor="overtimeEnabled" className="label-form">
                      {t("positionCreate.fields.overtimeEnabled")}
                    </label>
                  </div>
                </div>

                {methods.watch("overtimeEnabled") && (
                  <div className="overtime-fields">
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="overtimeHours" className="form-label">
                          {t("positionCreate.fields.overtimeHours")}
                        </label>
                        <input
                          type="text"
                          id="overtimeHours"
                          className="form-input"
                          placeholder={t(
                            "positionCreate.placeholders.overtimeHours"
                          )}
                          {...methods.register("overtimeHours")}
                        />
                        {methods.formState.errors.overtimeHours && (
                          <p className="form-error">
                            {methods.formState.errors.overtimeHours.message}
                          </p>
                        )}
                      </div>

                      <div className="form-group">
                        <label
                          htmlFor="overtimeBillRate"
                          className="form-label"
                        >
                          {t("positionCreate.fields.overtimeBillRate")}
                        </label>
                        <input
                          type="text"
                          id="overtimeBillRate"
                          className="form-input"
                          placeholder={t(
                            "positionCreate.placeholders.overtimeBillRate"
                          )}
                          {...methods.register("overtimeBillRate")}
                        />
                        {methods.formState.errors.overtimeBillRate && (
                          <p className="form-error">
                            {methods.formState.errors.overtimeBillRate.message}
                          </p>
                        )}
                      </div>

                      <div className="form-group">
                        <label htmlFor="overtimePayRate" className="form-label">
                          {t("positionCreate.fields.overtimePayRate")}
                        </label>
                        <input
                          type="text"
                          id="overtimePayRate"
                          className="form-input"
                          placeholder={t(
                            "positionCreate.placeholders.overtimePayRate"
                          )}
                          {...methods.register("overtimePayRate")}
                        />
                        {methods.formState.errors.overtimePayRate && (
                          <p className="form-error">
                            {methods.formState.errors.overtimePayRate.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {methods.formState.errors.overtimeEnabled && (
                  <p className="form-error">
                    {methods.formState.errors.overtimeEnabled.message}
                  </p>
                )}
              </div>

              {/* Payment & Billings Section */}
              <div className="form-section">
                <h2>{t("positionCreate.sections.paymentBillings")}</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      htmlFor="preferredPaymentMethod"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.preferredPaymentMethod")}
                    </label>
                    <input
                      type="hidden"
                      {...methods.register("preferredPaymentMethod")}
                    />
                    <CustomDropdown
                      options={paymentMethodOptions}
                      selectedOption={
                        paymentMethodOptions.find(
                          (option) =>
                            option.value === getValues("preferredPaymentMethod")
                        ) || null
                      }
                      onSelect={(option) => {
                        if (Array.isArray(option)) return;
                        setValue(
                          "preferredPaymentMethod",
                          option.value as string,
                          { shouldValidate: true }
                        );
                      }}
                      placeholder={t(
                        "positionCreate.selectOptions.selectPaymentMethod"
                      )}
                      searchable={true}
                      clearable={true}
                      onClear={() =>
                        setValue("preferredPaymentMethod", "", {
                          shouldValidate: true,
                        })
                      }
                    />
                    {methods.formState.errors.preferredPaymentMethod && (
                      <p className="form-error">
                        {
                          methods.formState.errors.preferredPaymentMethod
                            .message
                        }
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor="terms"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.terms")}
                    </label>
                    <input type="hidden" {...methods.register("terms")} />
                    <CustomDropdown
                      options={paymentTermsOptions}
                      selectedOption={
                        paymentTermsOptions.find(
                          (option) => option.value === getValues("terms")
                        ) || null
                      }
                      onSelect={(option) => {
                        if (Array.isArray(option)) return;
                        setValue("terms", option.value as string, {
                          shouldValidate: true,
                        });
                      }}
                      placeholder={t(
                        "positionCreate.selectOptions.selectTerms"
                      )}
                      searchable={true}
                      clearable={true}
                      onClear={() =>
                        setValue("terms", "", { shouldValidate: true })
                      }
                    />
                    {methods.formState.errors.terms && (
                      <p className="form-error">
                        {methods.formState.errors.terms.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes & Task Section */}
              <div className="form-section">
                <h2>{t("positionCreate.sections.notes")}</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      htmlFor="notes"
                      className="form-label"
                      data-required="*"
                    >
                      {t("positionCreate.fields.notes")}
                    </label>
                    <textarea
                      id="notes"
                      className="form-textarea"
                      placeholder={t("positionCreate.placeholders.notes")}
                      rows={4}
                      {...methods.register("notes")}
                    />
                    {methods.formState.errors.notes && (
                      <p className="form-error">
                        {methods.formState.errors.notes.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Tasks Section */}
              <div className="form-section">
                <h2>{t("positionCreate.sections.tasks")}</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="assignedTo" className="form-label">
                      {t("positionCreate.fields.assignedTo")}
                    </label>
                    <input
                      type="text"
                      id="assignedTo"
                      className="form-input"
                      placeholder={t("positionCreate.placeholders.assignedTo")}
                      {...methods.register("assignedTo")}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="projCompDate" className="form-label">
                      {t("positionCreate.fields.projCompDate")}
                    </label>
                    <div className="date-picker-container">
                      <input
                        type="date"
                        id="projCompDate"
                        className="form-input"
                        {...methods.register("projCompDate")}
                        onClick={(e) => e.currentTarget.showPicker()}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="taskTime" className="form-label">
                      {t("positionCreate.fields.taskTime")}
                    </label>
                    <input
                      type="text"
                      id="taskTime"
                      className="form-input"
                      placeholder={t("positionCreate.placeholders.taskTime")}
                      {...methods.register("taskTime")}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="form-navigation">
              <button
                type="button"
                className="button secondary"
                onClick={handleCancel}
                disabled={loading}
              >
                {t("buttons.cancel")}
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={loading}
              >
                {loading
                  ? isEditMode
                    ? t("positionCreate.buttons.updating")
                    : t("positionCreate.buttons.creating")
                  : isEditMode
                  ? t("positionCreate.buttons.updatePosition")
                  : t("positionCreate.buttons.createPosition")}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>

      {showExitConfirmation && (
        <ConfirmationModal
          isOpen={showExitConfirmation}
          title={t("positionCreate.modal.unsavedChanges")}
          message={t("positionCreate.modal.unsavedChangesMessage")}
          confirmText={t("positionCreate.buttons.saveDraft")}
          cancelText={t("positionCreate.buttons.discard")}
          onConfirm={async () => {
            await handleSaveDraft();
            setShowExitConfirmation(false);
            navigateBack();
          }}
          onCancel={() => {
            setShowExitConfirmation(false);
            navigateBack();
          }}
        />
      )}
    </div>
  );
}
