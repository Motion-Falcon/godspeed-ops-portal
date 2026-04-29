import { type MouseEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save } from "lucide-react";
import {
  createPosition,
  deletePositionDraft,
  generatePositionCode,
  getPosition,
  getPositionDraftById,
  PositionData,
  savePositionDraft,
  SubcategoryPositionDetailRow,
  updatePosition,
} from "../../services/api/position";
import { getClient } from "../../services/api/client";
import { useLanguage } from "../../contexts/language/language-provider";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { AppHeader } from "../../components/AppHeader";
import { DropdownOption } from "../../components/CustomDropdown";
import "../../styles/pages/PositionManagement.css";
import "../../styles/components/form.css";
import "../../styles/components/header.css";
import {
  createPositionFormSchema,
  PositionFormData,
} from "./positionCreateSchema";
import {
  convertPositionToFormData,
  defaultSubcategoryDetailRow,
  readIsSubcategory,
} from "./positionCreateUtils";
import { useCopyFromPosition } from "./hooks/useCopyFromPosition";
import { usePositionClients } from "./hooks/usePositionClients";
import { usePositionCreateOptions } from "./hooks/usePositionCreateOptions";
import { usePositionRateCalculations } from "./hooks/usePositionRateCalculations";
import { AddressDetailsSection } from "./components/AddressDetailsSection";
import { BasicDetailsSection } from "./components/BasicDetailsSection";
import { CopyFromPositionCard } from "./components/CopyFromPositionCard";
import { DocumentsRequiredSection } from "./components/DocumentsRequiredSection";
import { EmploymentCategorizationSection } from "./components/EmploymentCategorizationSection";
import { NormalPositionDetailsSection } from "./components/NormalPositionDetailsSection";
import { NotesTasksSection } from "./components/NotesTasksSection";
import { OvertimeSection } from "./components/OvertimeSection";
import { SubcategoryPositionDetailsSection } from "./components/SubcategoryPositionDetailsSection";

const DEFAULT_POSITION_PAYMENT_METHOD = "N/A";
const DEFAULT_POSITION_TERMS = "N/A";

interface PositionCreateProps {
  isEditMode?: boolean;
  isEditDraftMode?: boolean;
  defaultSubcategory?: boolean;
}

export function PositionCreate({
  isEditMode = false,
  isEditDraftMode = false,
  defaultSubcategory = false,
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
  const [minEndDate, setMinEndDate] = useState<string>("");
  const [isSubcategory, setIsSubcategory] =
    useState<boolean>(defaultSubcategory);
  const {
    titleOptions,
    subcategoryPositionDropdownOptions,
    employmentTermOptions,
    employmentTypeOptions,
    positionCategoryOptions,
    experienceOptions,
    payrateTypeOptions,
  } = usePositionCreateOptions();

  const id = params.id || location.state?.id;
  const methods = useForm<PositionFormData>({
    resolver: zodResolver(createPositionFormSchema(t)),
    defaultValues: {
      showOnJobPortal: false,
      stat: false,
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
      preferredPaymentMethod: DEFAULT_POSITION_PAYMENT_METHOD,
      terms: DEFAULT_POSITION_TERMS,
      isSubcategoryForm: defaultSubcategory,
      subcategoryPosition: [],
      subcategoryPositionDetails: [],
    },
    mode: "onBlur",
  });
  const { control, formState, handleSubmit, reset, watch } = methods;
  const { isDirty } = formState;
  const { fields: subcategoryDetailFields, replace: replaceSubcategoryDetails } =
    useFieldArray({ control, name: "subcategoryPositionDetails" });
  const watchedSubcategoryPosition = watch("subcategoryPosition");
  const watchedSubcategoryDetails = watch("subcategoryPositionDetails");
  const { clients, clientLoading, clientOptions, copyFromClientOptions } =
    usePositionClients({ t, setError });
  const {
    copyFromClientId,
    setCopyFromClientId,
    copyFromPositionOptions,
    copyFromPositionsLoading,
    copyFromPositionLoading,
    copyFromSelectedPosition,
    setCopyFromSelectedPosition,
    setCopyFromPositions,
    handleCopyFromPositionSelect,
  } = useCopyFromPosition({
    isSubcategory,
    methods,
    setError,
    setHasUnsavedChanges,
    t,
  });
  usePositionRateCalculations(methods);

  function navigateBack() {
    navigate(isEditDraftMode ? "/position-management/drafts" : "/position-management");
  }

  async function fetchClientDetails(clientId: string) {
    try {
      const client = await getClient(clientId);
      methods.setValue("clientManager", client.clientManager || "");
      methods.setValue("salesManager", client.salesPerson || "");
      methods.setValue("streetAddress", client.streetAddress1 || "");
      methods.setValue("city", client.city1 || "");
      methods.setValue("province", client.province1 || "");
      methods.setValue("postalCode", client.postalCode1 || "");
    } catch (err) {
      console.error("Error fetching client details:", err);
    }
  }

  async function handleClientSelect(option: DropdownOption | DropdownOption[]) {
    if (Array.isArray(option)) return;
    const clientId = option.value as string;
    methods.setValue("client", clientId);
    fetchClientDetails(clientId);
    try {
      const result = await generatePositionCode(clientId);
      console.log("Generated position code:", result);
      const currentPositionCode = methods.getValues("positionCode");
      if (!isEditMode || !currentPositionCode) {
        methods.setValue("positionCode", result.positionCode);
      }
    } catch (err) {
      console.error("Error generating position code:", err);
    }
  }

  function handleTitleSelect(option: DropdownOption | DropdownOption[]) {
    if (Array.isArray(option)) return;
    methods.setValue("title", option.value as string);
  }

  async function handleSaveDraft() {
    const formData = methods.getValues();
    if (!formData.client) {
      setError(t("positionCreate.errors.clientRequired"));
      setTimeout(() => setError(null), 3000);
      return;
    }
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
      const response = await savePositionDraft({
        ...formData,
        id: draftId || undefined,
        isDraft: true,
      });
      if (response && response.draft) {
        setDraftId((response.draft.id as string) || null);
        setLastSaved(response.lastUpdated || new Date().toISOString());
        setHasUnsavedChanges(false);
        setSuccess(t("positionCreate.messages.draftSaved"));
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      console.error("Error saving draft:", err);
      setError(
        err instanceof Error
          ? err.message
          : t("positionCreate.errors.failedToSaveDraft")
      );
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleFormSubmit(data: PositionFormData) {
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
      const subcategoryPositionPayload = data.isSubcategoryForm
        ? (data.subcategoryPosition || [])
            .map((value) => String(value).trim())
            .filter(Boolean)
        : undefined;
      const dataToSubmit = {
        ...data,
        preferredPaymentMethod:
          data.preferredPaymentMethod || DEFAULT_POSITION_PAYMENT_METHOD,
        terms: data.terms || DEFAULT_POSITION_TERMS,
        isSubcategory: data.isSubcategoryForm,
        subcategoryPosition: subcategoryPositionPayload,
        subcategoryPositionDetails: data.isSubcategoryForm
          ? data.subcategoryPositionDetails
          : undefined,
      };
      if ("clientName" in dataToSubmit) {
        delete (dataToSubmit as Record<string, unknown>).clientName;
      }
      if (isEditMode && positionId) {
        await updatePosition(positionId, dataToSubmit as unknown as PositionData);
        setSuccess(t("positionCreate.messages.positionUpdated"));
      } else {
        await createPosition(dataToSubmit as unknown as PositionData);
        if (isEditDraftMode && draftId) {
          await deletePositionDraft(draftId);
        }
        setSuccess(t("positionCreate.messages.positionCreated"));
      }
      setTimeout(() => {
        setSuccess(null);
        navigateBack();
      }, 1000);
    } catch (err) {
      console.error("Error creating/updating position:", err);
      setError(
        err instanceof Error
          ? err.message
          : t("positionCreate.errors.failedToCreateUpdatePosition")
      );
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  }

  function scrollToFirstFormError() {
    window.setTimeout(() => {
      const errorElement =
        document.querySelector(".client-form .form-error") ||
        document.querySelector(".error-message");
      errorElement?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  function handleFormInvalid() {
    scrollToFirstFormError();
  }

  function handleCreateClick(event: MouseEvent<HTMLButtonElement>) {
    const selectedSubcategoryTypes = methods.getValues("subcategoryPosition") || [];
    const isMissingSubcategoryType =
      isSubcategory &&
      selectedSubcategoryTypes
        .map((value) => String(value).trim())
        .filter(Boolean).length === 0;

    if (!isMissingSubcategoryType) return;

    event.preventDefault();
    methods.setError("subcategoryPosition", {
      type: "manual",
      message: t("positionCreate.errors.subcategoryPositionRequired"),
    });
    scrollToFirstFormError();
  }

  function handleCancel() {
    if (hasUnsavedChanges && !isEditMode) {
      setShowExitConfirmation(true);
    } else {
      navigateBack();
    }
  }

  useEffect(() => {
    if (isDirty) setHasUnsavedChanges(true);
  }, [watch(), isDirty]);

  useEffect(() => {
    if ((isEditMode || isEditDraftMode) && clients.length > 0) {
      const currentClientValue = methods.getValues("client");
      if (currentClientValue && clients.some((client) => client.id === currentClientValue)) {
        methods.setValue("client", currentClientValue);
      }
    }
  }, [clients, isEditMode, isEditDraftMode, methods]);

  useEffect(() => {
    if (isEditMode) {
      setPageTitle(
        isSubcategory
          ? t("positionCreate.editPositionSubcategory")
          : t("positionCreate.editPosition")
      );
    } else if (isEditDraftMode) {
      setPageTitle(t("positionCreate.editPositionDraft"));
    } else {
      setPageTitle(
        isSubcategory
          ? t("positionCreate.createPositionSubcategory")
          : t("positionCreate.createPosition")
      );
    }
  }, [isEditMode, isEditDraftMode, isSubcategory, t]);

  useEffect(() => {
    if (!isEditMode || !id) return;
    const loadPosition = async () => {
      setLoading(true);
      try {
        const position = await getPosition(id);
        if (position) {
          const formattedPosition = convertPositionToFormData(position);
          setPositionId(id);
          reset(formattedPosition);
          setIsSubcategory(readIsSubcategory(formattedPosition));
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error("Error loading position:", err);
        setError(
          err instanceof Error
            ? err.message
            : t("positionCreate.errors.errorLoadingPosition")
        );
        setTimeout(() => setError(null), 3000);
      } finally {
        setLoading(false);
      }
    };
    loadPosition();
  }, [id, isEditMode, reset, t]);

  useEffect(() => {
    if (!isEditDraftMode || !id) return;
    const loadDraft = async () => {
      setLoading(true);
      try {
        const { draft, lastUpdated } = await getPositionDraftById(id);
        if (draft) {
          const formattedDraft = convertPositionToFormData(draft);
          setDraftId(draft.id as string);
          setLastSaved(lastUpdated);
          reset(formattedDraft);
          setIsSubcategory(readIsSubcategory(formattedDraft));
          if (formattedDraft.client) {
            try {
              const result = await generatePositionCode(formattedDraft.client);
              methods.setValue("positionCode", result.positionCode);
              setHasUnsavedChanges(true);
            } catch (err) {
              console.error("Error regenerating position code for draft:", err);
            }
          }
        }
      } catch (err) {
        console.error("Error loading draft:", err);
        setError(
          err instanceof Error
            ? err.message
            : t("positionCreate.errors.errorLoadingDraft")
        );
        setTimeout(() => setError(null), 3000);
      } finally {
        setLoading(false);
      }
    };
    loadDraft();
  }, [id, isEditDraftMode, methods, reset, t]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    let saveDraftInterval: ReturnType<typeof setInterval>;
    if (hasUnsavedChanges && !isEditMode) {
      saveDraftInterval = setInterval(() => {
        handleSaveDraft();
      }, 60000);
    }
    return () => {
      if (saveDraftInterval) clearInterval(saveDraftInterval);
    };
  }, [hasUnsavedChanges, isEditMode, watch()]);

  useEffect(() => {
    const startDateValue = methods.watch("startDate");
    setMinEndDate(startDateValue || "");
  }, [methods.watch("startDate")]);

  useEffect(() => {
    if (isSubcategory) methods.setValue("showOnJobPortal", false);
  }, [isSubcategory, methods]);

  useEffect(() => {
    methods.setValue("isSubcategoryForm", isSubcategory);
  }, [isSubcategory, methods]);

  useEffect(() => {
    if (!isSubcategory) return;
    const labels = (watchedSubcategoryPosition || [])
      .map((value) => String(value).trim())
      .filter(Boolean);
    const prev = methods.getValues("subcategoryPositionDetails") || [];
    const map = new Map(
      prev.map((row) => [String(row.subcategoryPosition).trim(), row])
    );
    const next: SubcategoryPositionDetailRow[] = labels.map((label) => {
      const existing = map.get(label);
      return existing ?? defaultSubcategoryDetailRow(label);
    });
    replaceSubcategoryDetails(next);
  }, [
    isSubcategory,
    watchedSubcategoryPosition,
    methods,
    replaceSubcategoryDetails,
  ]);

  useEffect(() => {
    if (!isSubcategory) return;
    const first = (watchedSubcategoryDetails || [])[0];
    if (!first) return;
    methods.setValue("payrateType", first.payrateType);
    methods.setValue("numberOfPositions", first.numberOfPositions);
    methods.setValue("regularPayRate", first.regularPayRate);
    methods.setValue("premiumPayRate", first.premiumPayRate ?? "");
    methods.setValue("markup", first.markup ?? "");
    methods.setValue("billRate", first.billRate);
  }, [isSubcategory, watchedSubcategoryDetails, methods]);

  useEffect(() => {
    const overtimeEnabled = methods.watch("overtimeEnabled");
    if (!overtimeEnabled) {
      methods.setValue("overtimeHours", "");
      methods.setValue("overtimeBillRate", "");
      methods.setValue("overtimePayRate", "");
      methods.clearErrors([
        "overtimeHours",
        "overtimeBillRate",
        "overtimePayRate",
      ]);
    }
  }, [methods.watch("overtimeEnabled"), methods]);

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
              <span>{t("positionCreate.buttons.backToPositionManagement")}</span>
            </button>
          </>
        }
      />

      <div className="client-create">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        {lastSaved && (
          <div className="last-saved">
            {t("positionCreate.info.lastSaved", {
              date: new Date(lastSaved).toLocaleString(),
            })}
          </div>
        )}

        {defaultSubcategory && !isEditMode && !isEditDraftMode && (
          <div className="card subcategory-banner-card">
            <strong className="subcategory-banner-title">
              {t("positionCreate.subcategory.bannerTitle")}
            </strong>
            <p className="subcategory-banner-subtitle">
              {t("positionCreate.subcategory.sectionSubtitle")}
            </p>
          </div>
        )}

        {!isEditMode && !isEditDraftMode && (
          <CopyFromPositionCard
            copyFromClientOptions={copyFromClientOptions}
            copyFromClientId={copyFromClientId}
            copyFromPositionOptions={copyFromPositionOptions}
            copyFromPositionsLoading={copyFromPositionsLoading}
            copyFromPositionLoading={copyFromPositionLoading}
            copyFromSelectedPosition={copyFromSelectedPosition}
            onClientSelect={(option) => {
              if (Array.isArray(option)) return;
              setCopyFromClientId((option?.value as string) || null);
              setCopyFromSelectedPosition(null);
            }}
            onClientClear={() => {
              setCopyFromClientId(null);
              setCopyFromPositions([]);
              setCopyFromSelectedPosition(null);
            }}
            onPositionSelect={handleCopyFromPositionSelect}
            onPositionClear={() => setCopyFromSelectedPosition(null)}
          />
        )}

        <FormProvider {...methods}>
          <form
            onSubmit={handleSubmit(handleFormSubmit, handleFormInvalid)}
            className="client-form"
          >
            <div className="form-card">
              <BasicDetailsSection
                clientLoading={clientLoading}
                clientOptions={clientOptions}
                clients={clients}
                isEditDraftMode={isEditDraftMode}
                isSubcategory={isSubcategory}
                minEndDate={minEndDate}
                onClientSelect={handleClientSelect}
                onTitleSelect={handleTitleSelect}
                subcategoryPositionDropdownOptions={
                  subcategoryPositionDropdownOptions
                }
                titleOptions={titleOptions}
              />
              <AddressDetailsSection />
              <EmploymentCategorizationSection
                employmentTermOptions={employmentTermOptions}
                employmentTypeOptions={employmentTypeOptions}
                positionCategoryOptions={positionCategoryOptions}
                experienceOptions={experienceOptions}
              />
              {!isSubcategory && <DocumentsRequiredSection />}
              {!isSubcategory && (
                <NormalPositionDetailsSection
                  payrateTypeOptions={payrateTypeOptions}
                />
              )}
              {isSubcategory && (
                <SubcategoryPositionDetailsSection
                  fields={subcategoryDetailFields}
                  payrateTypeOptions={payrateTypeOptions}
                />
              )}
              <OvertimeSection />
              <NotesTasksSection />
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
                onClick={handleCreateClick}
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
