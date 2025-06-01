import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
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
  getClients,
  getClient,
  generatePositionCode,
} from "../../services/api";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { ArrowLeft, ChevronDown, Save } from "lucide-react";
import "../../styles/pages/PositionManagement.css";
import "../../styles/components/form.css";
import "../../styles/components/header.css";
import { AppHeader } from "../../components/AppHeader";

// Helper function for date formatting and validation
const formatDateForInput = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

const getTodayFormatted = (): string => {
  return formatDateForInput(new Date());
};

// Add a server response type interface at the top of the file (after the imports)
interface ServerClientData {
  id: string;
  company_name: string;
  client_manager?: string;
  sales_person?: string;
  street_address1?: string;
  city1?: string;
  province1?: string;
  postal_code1?: string;
  // Add other properties as needed
}

interface ActualClientResponse {
  id: string;
  company_name: string;
  billing_name?: string;
  short_code?: string;
  // Add other snake_case properties as needed
}

// Define form schema
const positionFormSchema = z.object({
  // Basic Details
  client: z.string().min(1, { message: "Client is required" }),
  title: z.string().min(1, { message: "Title is required" }),
  positionCode: z.string().optional(),
  startDate: z
    .string()
    .min(1, { message: "Start date is required" })
    .refine(
      (date) => {
        if (!date) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day
        const selectedDate = new Date(date);
        selectedDate.setHours(0, 0, 0, 0); // Reset time to start of day
        return selectedDate >= today;
      },
      { message: "Start date must be today or in the future" }
    ),
  endDate: z.string().min(1, { message: "End date is required" }),
  showOnJobPortal: z.boolean().default(false),
  clientManager: z.string().optional(),
  salesManager: z.string().optional(),
  positionNumber: z.string().optional(),
  description: z.string().min(1, { message: "Description is required" }),

  // Address Details
  streetAddress: z.string().min(1, { message: "Street address is required" }),
  city: z.string().min(1, { message: "City is required" }),
  province: z.string().min(1, { message: "Province is required" }),
  postalCode: z.string().min(1, { message: "Postal code is required" }),

  // Employment Categorization
  employmentTerm: z.string().min(1, { message: "Employment term is required" }),
  employmentType: z.string().min(1, { message: "Employment type is required" }),
  positionCategory: z
    .string()
    .min(1, { message: "Position category is required" }),
  experience: z.string().min(1, { message: "Experience is required" }),

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
        message: "At least one document must be selected",
        path: ["documentsRequired"],
      }
    ),

  // Position Details
  payrateType: z.string().min(1, { message: "Payrate type is required" }),
  numberOfPositions: z.coerce
    .number()
    .min(1, { message: "Number of positions is required" }),
  regularPayRate: z
    .string()
    .min(1, { message: "Regular pay rate is required" }),
  markup: z.string().optional(),
  billRate: z.string().min(1, { message: "Bill rate is required" }),

  // Overtime
  overtimeEnabled: z.boolean().default(false),
  overtimeHours: z.string().optional(),
  overtimeBillRate: z.string().optional(),
  overtimePayRate: z.string().optional(),

  // Payment & Billings
  preferredPaymentMethod: z
    .string()
    .min(1, { message: "Payment method is required" }),
  terms: z.string().min(1, { message: "Terms are required" }),

  // Notes & Task
  notes: z.string().min(1, { message: "Notes are required" }),
  assignedTo: z.string().optional(),
  projCompDate: z.string().optional(),
  taskTime: z.string().optional(),
});

type PositionFormData = z.infer<typeof positionFormSchema>;

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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [positionId, setPositionId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState("Create Position");
  const [clients, setClients] = useState<
    Array<{ id: string; companyName: string }>
  >([]);
  const [minEndDate, setMinEndDate] = useState<string>(getTodayFormatted());
  const [previousClientValue, setPreviousClientValue] = useState<string>("");

  // Add search/filter states for client dropdown
  const [clientSearchTerm, setClientSearchTerm] = useState<string>("");
  const [isClientDropdownOpen, setIsClientDropdownOpen] =
    useState<boolean>(false);
  const [filteredClients, setFilteredClients] = useState<
    Array<{ id: string; companyName: string }>
  >([]);

  // Add search/filter states for title dropdown
  const [titleSearchTerm, setTitleSearchTerm] = useState<string>("");
  const [isTitleDropdownOpen, setIsTitleDropdownOpen] =
    useState<boolean>(false);
  const [filteredTitles, setFilteredTitles] = useState<string[]>([]);

  // Job title options
  const jobTitles = [
    "310S Mechanic",
    "Account Clerk",
    "Accounting Technician",
    "Accounts Receivable Specialist",
    "Admin Assistant",
    "Admin Coordinator / Support",
    "Administrative Roles (Various)",
    "Amazon Delivery Associate",
    "Analyst (AR/AP, Reporting, QA)",
    "Assembler",
    "Auditor",
    "AV Technician",
    "AZ Driver",
    "Bartender",
    "Basketball Coach/Official",
    "BBQ Station Attendant",
    "Bilingual Customer Service Representative",
    "Billing Clerk",
    "Blaster",
    "Blender / Blending Operator",
    "Blow Mold Operator",
    "Book Department Associate",
    "Boom DZ Driver",
    "Bottle Packer",
    "Business Analyst",
    "Cabinet Maker",
    "Car Cleaner / Shuttler",
    "Car Wash Attendant",
    "Cargo Handler",
    "Chef",
    "Cherry Picker Operator",
    "Class 1/3/5 Driver",
    "Cleaner / Janitor / Housekeeper",
    "CNC Machinist / Operator",
    "Counterbalance Operator",
    "Cuber",
    "Customer Service Representative (CSR)",
    "Data Entry Clerk",
    "Daycab Driver",
    "Decking Labourer",
    "Dishwasher",
    "Dispatch Supervisor / Dispatcher",
    "Dock Worker / Coordinator / Supervisor",
    "Draftsman / Estimator",
    "Driver Coordinator / Helper",
    "DZ Driver",
    "Engineer (Admin, Project, Process)",
    "Equipment Operator (F/L, Machine, Line)",
    "Feeder / Packer",
    "Filler Operator",
    "Fitter / Welder",
    "Foreman",
    "Forklift Operator",
    "Front Desk Manager",
    "G Class Driver",
    "Garment Sorter / Hanger / Inspector",
    "Gear Cutter",
    "General Helper / Labourer",
    "GL / Driver Helper",
    "Handler",
    "Handyman / Technician",
    "Health and Safety Manager",
    "Heavy Lifter / Packer",
    "HR (Coordinator, Support, Generalist)",
    "Industrial Painter",
    "Industrial Sewer",
    "Inspector / Quality Control",
    "Inventory Clerk / Specialist / Supervisor",
    "IT Tech Support",
    "Kitchen Associate",
    "Landscape Labourer",
    "Laser Cutter",
    "Lead Hand / Team Lead",
    "Licensed Mechanic (Truck/Coach, Millwright)",
    "Loader / Unloader",
    "Logistics Coordinator / Associate",
    "Low Voltage Technician",
    "Lumper",
    "Maintenance (Technician, Helper, Millwright)",
    "Material Handler",
    "Mig / TIG Welder",
    "Office Admin / Clerk / Worker",
    "Operations Support",
    "Order Picker / Preparer",
    "Orientation Facilitator",
    "Package / Parcel Handler",
    "Palletizer",
    "Payroll Administrator",
    "Permanent Position",
    "Photographer",
    "Powder Coater Painter",
    "Press Operator",
    "Production Associate (Aftn included)",
    "PSW (Personal Support Worker)",
    "Purchasing Coordinator",
    "QA Associate",
    "Raymond Reach Operator",
    "Receiver",
    "Receptionist",
    "Reimbursements Clerk",
    "Reno Run Driver",
    "Retail Associate / Material Handler",
    "Room Attendant",
    "Runner",
    "Sales Associate / Coordinator",
    "Sanitation Worker (Light / Heavy)",
    "Sawyer",
    "Scanner",
    "Seamstress",
    "Security",
    "Server / Service Agent",
    "Shipper / Receiver",
    "Shunt Driver",
    "Skilled Labourer / Trade",
    "Sorter",
    "Stacker Operator",
    "Stamp Operator",
    "Standby Worker",
    "Straight Truck Driver",
    "Subcontractor",
    "Supervisor",
    "Table Head",
    "TBNS (To Be Named Shift)",
    "Technician",
    "Tire Installer",
    "Training Coordinator",
    "Transportation Associate",
    "Walkie Rider Operator",
    "Warehouse Associate / Manager / Supervisor",
    "Weld Operator / Welder-Fitter",
    "Yard Cleaner / Coordinator",
  ];

  // Get ID from URL params or location state
  const idFromParams = params.id;
  const idFromLocation = location.state?.id;
  const id = idFromParams || idFromLocation;

  // Initialize form with validation
  const methods = useForm<PositionFormData>({
    resolver: zodResolver(positionFormSchema),
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
      payrateType: "Hourly",
    },
    mode: "onBlur",
  });

  const { handleSubmit, reset, formState, watch } = methods;
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
        // Get all clients by setting a high limit
        const response = await getClients({ limit: 1000 });

        const formattedClients = response.clients
          .map((client) => ({
            id: client.id || "",
            companyName: (client as ActualClientResponse).company_name || "",
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
          err instanceof Error ? err.message : "Failed to fetch clients";
        setError(errorMessage);
        setTimeout(() => setError(null), 3000);
      }
    };

    fetchClients();
  }, []);

  // Filter clients based on search term
  useEffect(() => {
    if (clientSearchTerm.trim() === "") {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter((client) =>
        client.companyName
          .toLowerCase()
          .includes(clientSearchTerm.toLowerCase())
      );
      setFilteredClients(filtered);
    }
  }, [clients, clientSearchTerm]);

  // Filter titles based on search term
  useEffect(() => {
    if (titleSearchTerm.trim() === "") {
      setFilteredTitles(jobTitles);
    } else {
      const filtered = jobTitles.filter((title) =>
        title.toLowerCase().includes(titleSearchTerm.toLowerCase())
      );
      setFilteredTitles(filtered);
    }
  }, [jobTitles, titleSearchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".searchable-dropdown")) {
        setIsClientDropdownOpen(false);
        setIsTitleDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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
          // Clear search term so the selected client name shows in placeholder
          setClientSearchTerm("");
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
      setPageTitle("Edit Position");
    } else if (isEditDraftMode) {
      setPageTitle("Edit Position Draft");
    } else {
      setPageTitle("Create Position");
    }
  }, [isEditMode, isEditDraftMode]);

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
            err instanceof Error ? err.message : "Error loading position";
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

            // Draft is already saved, so form is not dirty
            setHasUnsavedChanges(false);
          }
        } catch (err) {
          console.error("Error loading draft:", err);
          const errorMessage =
            err instanceof Error ? err.message : "Error loading draft";
          setError(errorMessage);
          setTimeout(() => setError(null), 3000);
        } finally {
          setLoading(false);
        }
      };

      loadDraft();
    }
  }, [id, isEditDraftMode, reset]);

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

  // Function to handle "Create a new client" option
  const handleCreateNewClient = () => {
    // Save the current client value before navigating
    setPreviousClientValue(methods.getValues("client"));
    // Reset the dropdown in the next render cycle
    setTimeout(() => {
      methods.setValue("client", previousClientValue);
    }, 0);
    // Navigate to the client creation page
    navigate("/client-management/create");
  };

  const handleSaveDraft = async () => {
    const formData = methods.getValues();

    // Check if client is selected before saving draft
    if (!formData.client) {
      setError("Client selection is required to save draft");
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Validate end date is after start date if both are provided
    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);

      if (endDate <= startDate) {
        setError("End date must be after start date");
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
        setSuccess("Draft saved successfully");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error("Error saving draft:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save draft";
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
        setError("End date must be after start date");
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
        setSuccess("Position updated successfully");
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

        setSuccess("Position created successfully");
        setTimeout(() => {
          setSuccess(null);
          navigateBack();
        }, 1000);
      }
    } catch (err) {
      console.error("Error creating/updating position:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create/update position";
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
      const client = (await getClient(clientId)) as unknown as ServerClientData;

      // Auto-fill client manager and sales manager
      methods.setValue("clientManager", client.client_manager || "");
      methods.setValue("salesManager", client.sales_person || "");

      // Auto-fill address fields from client
      methods.setValue("streetAddress", client.street_address1 || "");
      methods.setValue("city", client.city1 || "");
      methods.setValue("province", client.province1 || "");
      methods.setValue("postalCode", client.postal_code1 || "");
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
                <span>{saving ? "Saving..." : "Save Draft"}</span>
              </button>
            )}
            <button className="button button-icon" onClick={handleCancel}>
              <ArrowLeft size={16} />
              <span>Back To Position Management</span>
            </button>
          </>
        }
        statusMessage={error || success}
        statusType={error ? "error" : success ? "success" : undefined}
      />

      <div className="content-container">
        {lastSaved && !isEditMode && (
          <div className="last-saved">
            Last saved: {new Date(lastSaved).toLocaleString()}
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
                <h2>Basic Details</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      htmlFor="client"
                      className="form-label"
                      data-required="*"
                    >
                      Client
                    </label>
                    <div className="searchable-dropdown">
                      {/* Hidden input for form registration */}
                      <input type="hidden" {...methods.register("client")} />
                      <div className="dropdown-container">
                        <input
                          type="text"
                          className="form-input dropdown-input"
                          placeholder={(() => {
                            const selectedClientId =
                              methods.getValues("client");
                            if (selectedClientId && clientSearchTerm === "") {
                              const selectedClient = clients.find(
                                (c) => c.id === selectedClientId
                              );
                              return selectedClient
                                ? selectedClient.companyName
                                : "Select a client";
                            }
                            return "Search clients...";
                          })()}
                          value={clientSearchTerm}
                          onChange={(e) => {
                            setClientSearchTerm(e.target.value);
                            setIsClientDropdownOpen(true);
                          }}
                          onFocus={() => setIsClientDropdownOpen(true)}
                          onBlur={() => {
                            // Delay closing to allow for option clicks
                            setTimeout(
                              () => setIsClientDropdownOpen(false),
                              200
                            );
                          }}
                        />
                        <div
                          className="dropdown-arrow"
                          onClick={() =>
                            setIsClientDropdownOpen(!isClientDropdownOpen)
                          }
                        >
                          <ChevronDown size={16} />
                        </div>
                      </div>

                      {isClientDropdownOpen && (
                        <div className="dropdown-options">
                          <div
                            className="dropdown-option create-client-option"
                            onClick={() => {
                              handleCreateNewClient();
                              setIsClientDropdownOpen(false);
                            }}
                          >
                            ➕ Create a new client
                          </div>
                          {filteredClients.length > 0 ? (
                            filteredClients.map((client) => (
                              <div
                                key={client.id}
                                className={`dropdown-option ${
                                  methods.getValues("client") === client.id
                                    ? "selected"
                                    : ""
                                }`}
                                onClick={async () => {
                                  // Set the client value
                                  methods.setValue("client", client.id);
                                  setPreviousClientValue(client.id);
                                  setClientSearchTerm("");
                                  setIsClientDropdownOpen(false);

                                  // Trigger client data fetch
                                  fetchClientDetails(client.id);

                                  // Generate position code for the selected client
                                  try {
                                    const result = await generatePositionCode(
                                      client.id
                                    );
                                    console.log(
                                      "Generated position code:",
                                      result
                                    );

                                    // Only set position code if we're not in edit mode or if the field is currently empty
                                    const currentPositionCode =
                                      methods.getValues("positionCode");
                                    if (!isEditMode && !isEditDraftMode) {
                                      // For new positions, always generate
                                      methods.setValue(
                                        "positionCode",
                                        result.positionCode
                                      );
                                    } else if (!currentPositionCode) {
                                      // For edit mode, only generate if empty
                                      methods.setValue(
                                        "positionCode",
                                        result.positionCode
                                      );
                                    }
                                  } catch (error) {
                                    console.error(
                                      "Error generating position code:",
                                      error
                                    );
                                    // Don't show error to user as this is automatic
                                  }
                                }}
                              >
                                {client.companyName}
                              </div>
                            ))
                          ) : (
                            <div className="dropdown-option no-results">
                              No clients found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
                      Title
                    </label>
                    <div className="searchable-dropdown">
                      {/* Hidden input for form registration */}
                      <input type="hidden" {...methods.register("title")} />
                      <div className="dropdown-container">
                        <input
                          type="text"
                          className="form-input dropdown-input"
                          placeholder={(() => {
                            const selectedTitle = methods.getValues("title");
                            if (selectedTitle && titleSearchTerm === "") {
                              return selectedTitle;
                            }
                            return "Search job titles...";
                          })()}
                          value={titleSearchTerm}
                          onChange={(e) => {
                            setTitleSearchTerm(e.target.value);
                            setIsTitleDropdownOpen(true);
                          }}
                          onFocus={() => setIsTitleDropdownOpen(true)}
                          onBlur={() => {
                            // Delay closing to allow for option clicks
                            setTimeout(
                              () => setIsTitleDropdownOpen(false),
                              200
                            );
                          }}
                        />
                        <div
                          className="dropdown-arrow"
                          onClick={() =>
                            setIsTitleDropdownOpen(!isTitleDropdownOpen)
                          }
                        >
                          <ChevronDown size={16} />
                        </div>
                      </div>

                      {isTitleDropdownOpen && (
                        <div className="dropdown-options">
                          {filteredTitles.length > 0 ? (
                            filteredTitles.map((title) => (
                              <div
                                key={title}
                                className={`dropdown-option ${
                                  methods.getValues("title") === title
                                    ? "selected"
                                    : ""
                                }`}
                                onClick={() => {
                                  // Set the title value
                                  methods.setValue("title", title);
                                  setTitleSearchTerm("");
                                  setIsTitleDropdownOpen(false);
                                }}
                              >
                                {title}
                              </div>
                            ))
                          ) : (
                            <div className="dropdown-option no-results">
                              No job titles found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {methods.formState.errors.title && (
                      <p className="form-error">
                        {methods.formState.errors.title.message}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="positionNumber" className="form-label">
                      Position Code
                    </label>
                    <input
                      type="text"
                      id="positionNumber"
                      className="form-input"
                      placeholder="Enter position code"
                      {...methods.register("positionNumber")}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="positionCode" className="form-label">
                      Position ID
                    </label>
                    <input
                      type="text"
                      id="positionCode"
                      className="form-input auto-populated"
                      placeholder="Auto-generated from client"
                      disabled
                      {...methods.register("positionCode")}
                    />
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
                      Start Date
                    </label>
                    <div className="date-picker-container">
                      <input
                        type="date"
                        id="startDate"
                        className="form-input"
                        min={getTodayFormatted()}
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
                      End Date
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
                        {...methods.register('showOnJobPortal')}
                      />
                      <label htmlFor="showOnJobPortal" className="label-form">
                        Show on Job Portal
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="clientManager" className="form-label">
                      Client Manager
                    </label>
                    <input
                      type="text"
                      id="clientManager"
                      className="form-input auto-populated"
                      placeholder="Auto-filled from client"
                      disabled
                      {...methods.register("clientManager")}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="salesManager" className="form-label">
                      Sales Manager
                    </label>
                    <input
                      type="text"
                      id="salesManager"
                      className="form-input auto-populated"
                      placeholder="Auto-filled from client"
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
                      Description
                    </label>
                    <textarea
                      id="description"
                      className="form-textarea"
                      placeholder="Enter position description"
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
                <h2>Address Details</h2>

                <div className="form-info" data-required="*">
                  <small>
                    Note: Address details are auto-filled from the selected
                    client but can be modified if needed
                  </small>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      htmlFor="streetAddress"
                      className="form-label"
                      data-required="*"
                    >
                      Street Address
                    </label>
                    <input
                      type="text"
                      id="streetAddress"
                      className="form-input auto-populated"
                      placeholder="Enter street address"
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
                      City
                    </label>
                    <input
                      type="text"
                      id="city"
                      className="form-input auto-populated"
                      placeholder="Enter city"
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
                      Province
                    </label>
                    <input
                      type="text"
                      id="province"
                      className="form-input auto-populated"
                      placeholder="Enter province (e.g., ON)"
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
                      Postal Code
                    </label>
                    <input
                      type="text"
                      id="postalCode"
                      className="form-input auto-populated"
                      placeholder="Enter postal code"
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
                <h2>Employment Categorization</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      htmlFor="employmentTerm"
                      className="form-label"
                      data-required="*"
                    >
                      Employment Term
                    </label>
                    <select
                      id="employmentTerm"
                      className="form-input"
                      {...methods.register("employmentTerm")}
                    >
                      <option value="">Select employment term</option>
                      <option value="Permanent">Permanent</option>
                      <option value="Contract">Contract</option>
                      <option value="Temporary">Temporary</option>
                    </select>
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
                      Employment Type
                    </label>
                    <select
                      id="employmentType"
                      className="form-input"
                      {...methods.register("employmentType")}
                    >
                      <option value="">Select employment type</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Casual">Casual</option>
                    </select>
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
                      Position Category
                    </label>
                    <select
                      id="positionCategory"
                      className="form-input"
                      {...methods.register("positionCategory")}
                    >
                      <option value="">Select position category</option>
                      <option value="Driver">Driver</option>
                      <option value="Warehouse">Warehouse</option>
                      <option value="Office">Office</option>
                      <option value="Management">Management</option>
                      <option value="Sales">Sales</option>
                      <option value="Technician">Technician</option>
                      <option value="Other">Other</option>
                    </select>
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
                      Experience
                    </label>
                    <select
                      id="experience"
                      className="form-input"
                      {...methods.register("experience")}
                    >
                      <option value="">Select experience level</option>
                      <option value="Entry Level">Entry Level</option>
                      <option value="1-2 Years">1-2 Years</option>
                      <option value="3-5 Years">3-5 Years</option>
                      <option value="5-10 Years">5-10 Years</option>
                      <option value="10+ Years">10+ Years</option>
                    </select>
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
                <h2>Documents Required</h2>

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
                      License
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
                      Driver Abstract
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
                      TDG Certificate
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
                      SIN
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
                      Immigration Status
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
                      Passport
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
                      CVOR
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
                      Resume
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
                      Articles of Incorporation
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
                      Direct Deposit
                    </label>
                  </div>
                </div>
              </div>

              {/* Position Details Section */}
              <div className="form-section">
                <h2>Position Details</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      htmlFor="payrateType"
                      className="form-label"
                      data-required="*"
                    >
                      Payrate Type
                    </label>
                    <select
                      id="payrateType"
                      className="form-input"
                      {...methods.register("payrateType")}
                    >
                      <option value="">Select payrate type</option>
                      <option value="Hourly">Hourly</option>
                      <option value="Salary">Salary</option>
                      <option value="Commission">Commission</option>
                    </select>
                    {methods.formState.errors.payrateType && (
                      <p className="form-error">
                        {methods.formState.errors.payrateType.message}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor="numberOfPositions"
                      className="form-label"
                      data-required="*"
                    >
                      Number of Positions
                    </label>
                    <input
                      type="number"
                      id="numberOfPositions"
                      className="form-input"
                      placeholder="Enter number of positions"
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
                      htmlFor="regularPayRate"
                      className="form-label"
                      data-required="*"
                    >
                      Regular Pay Rate
                    </label>
                    <input
                      type="text"
                      id="regularPayRate"
                      className="form-input"
                      placeholder="Enter regular pay rate"
                      {...methods.register("regularPayRate")}
                    />
                    {methods.formState.errors.regularPayRate && (
                      <p className="form-error">
                        {methods.formState.errors.regularPayRate.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="markup" className="form-label">
                      Markup
                    </label>
                    <input
                      type="text"
                      id="markup"
                      className="form-input"
                      placeholder="Enter markup"
                      {...methods.register("markup")}
                    />
                  </div>

                  <div className="form-group">
                    <label
                      htmlFor="billRate"
                      className="form-label"
                      data-required="*"
                    >
                      Bill Rate
                    </label>
                    <input
                      type="text"
                      id="billRate"
                      className="form-input"
                      placeholder="Enter bill rate"
                      {...methods.register("billRate")}
                    />
                    {methods.formState.errors.billRate && (
                      <p className="form-error">
                        {methods.formState.errors.billRate.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Overtime Section */}
              <div className="form-section">
                <h2>Overtime</h2>

                <div className="form-row">
                  <div className="container-form">
                    <input
                      type="checkbox"
                      id="overtimeEnabled"
                      className="toggle-form"
                      {...methods.register("overtimeEnabled")}
                    />
                    <label htmlFor="overtimeEnabled" className="label-form">
                      Enable Overtime
                    </label>
                  </div>
                </div>

                {methods.watch("overtimeEnabled") && (
                  <div className="overtime-fields">
                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="overtimeHours" className="form-label">
                          Overtime Hours
                        </label>
                        <input
                          type="text"
                          id="overtimeHours"
                          className="form-input"
                          placeholder="Enter overtime hours"
                          {...methods.register("overtimeHours")}
                        />
                      </div>

                      <div className="form-group">
                        <label
                          htmlFor="overtimeBillRate"
                          className="form-label"
                        >
                          Overtime Bill Rate
                        </label>
                        <input
                          type="text"
                          id="overtimeBillRate"
                          className="form-input"
                          placeholder="Enter overtime bill rate"
                          {...methods.register("overtimeBillRate")}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="overtimePayRate" className="form-label">
                          Overtime Pay Rate
                        </label>
                        <input
                          type="text"
                          id="overtimePayRate"
                          className="form-input"
                          placeholder="Enter overtime pay rate"
                          {...methods.register("overtimePayRate")}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment & Billings Section */}
              <div className="form-section">
                <h2>Payment & Billings</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      htmlFor="preferredPaymentMethod"
                      className="form-label"
                      data-required="*"
                    >
                      Preferred Payment Method
                    </label>
                    <select
                      id="preferredPaymentMethod"
                      className="form-input"
                      {...methods.register("preferredPaymentMethod")}
                    >
                      <option value="">Select preferred payment method</option>
                      <option value="Direct Deposit">Direct Deposit</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Wire Transfer">Wire Transfer</option>
                    </select>
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
                      Terms
                    </label>
                    <select
                      id="terms"
                      className="form-input"
                      {...methods.register("terms")}
                    >
                      <option value="">Select terms</option>
                      <option value="Due on Receipt">Due on Receipt</option>
                      <option value="Net 15">Net 15</option>
                      <option value="Net 22">Net 22</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 45">Net 45</option>
                      <option value="Net 60">Net 60</option>
                      <option value="Net 65">Net 65</option>
                      <option value="Net 90">Net 90</option>
                    </select>
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
                <h2>Notes</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label
                      htmlFor="notes"
                      className="form-label"
                      data-required="*"
                    >
                      Notes
                    </label>
                    <textarea
                      id="notes"
                      className="form-textarea"
                      placeholder="Enter notes"
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
                <h2>Tasks</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="assignedTo" className="form-label">
                      Assigned To
                    </label>
                    <input
                      type="text"
                      id="assignedTo"
                      className="form-input"
                      placeholder="Enter assigned to"
                      {...methods.register("assignedTo")}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="projCompDate" className="form-label">
                      Project Completion Date
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
                      Task Time
                    </label>
                    <input
                      type="text"
                      id="taskTime"
                      className="form-input"
                      placeholder="Enter task time"
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
                Cancel
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={loading}
              >
                {loading
                  ? isEditMode
                    ? "Updating..."
                    : "Creating..."
                  : isEditMode
                  ? "Update Position"
                  : "Create Position"}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>

      {showExitConfirmation && (
        <ConfirmationModal
          isOpen={showExitConfirmation}
          title="Unsaved Changes"
          message="You have unsaved changes. Do you want to save your draft before leaving?"
          confirmText="Save Draft"
          cancelText="Discard"
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
