import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { DropdownOption } from "../../../components/CustomDropdown";
import {
  generatePositionCode,
  getClientPositions,
  getPosition,
  PositionData,
} from "../../../services/api/position";
import {
  getPositionDisplayTitle,
  positionMatchingStyleDropdownSublabel,
} from "../../../utils/positionDisplay";
import { PositionFormData } from "../positionCreateSchema";
import {
  convertPositionToFormData,
  readIsSubcategory,
} from "../positionCreateUtils";

interface UseCopyFromPositionArgs {
  isSubcategory: boolean;
  methods: UseFormReturn<PositionFormData>;
  setError: Dispatch<SetStateAction<string | null>>;
  setHasUnsavedChanges: Dispatch<SetStateAction<boolean>>;
  t: (key: string) => string;
}

export function useCopyFromPosition({
  isSubcategory,
  methods,
  setError,
  setHasUnsavedChanges,
  t,
}: UseCopyFromPositionArgs) {
  const [copyFromClientId, setCopyFromClientId] = useState<string | null>(null);
  const [copyFromPositions, setCopyFromPositions] = useState<PositionData[]>([]);
  const [copyFromSelectedPosition, setCopyFromSelectedPosition] =
    useState<PositionData | null>(null);
  const [copyFromPositionsLoading, setCopyFromPositionsLoading] =
    useState(false);
  const [copyFromPositionLoading, setCopyFromPositionLoading] = useState(false);

  const copyFromPositionOptions: DropdownOption[] = useMemo(
    () =>
      copyFromPositions.map((position) => ({
        id: position.id || "",
        value: position.id || "",
        label: `${getPositionDisplayTitle(position, t("positionCreate.copyFrom.notSpecified"))} - ${position.positionNumber || t("positionCreate.copyFrom.notSpecified")}`,
        sublabel: positionMatchingStyleDropdownSublabel(position, t),
      })),
    [copyFromPositions, t]
  );

  useEffect(() => {
    if (!copyFromClientId) {
      setCopyFromPositions([]);
      setCopyFromSelectedPosition(null);
      return;
    }
    const fetchCopyFromPositions = async () => {
      setCopyFromPositionsLoading(true);
      try {
        const response = await getClientPositions(copyFromClientId, {
          limit: 1000,
        });
        const positions = response.positions || [];
        const filtered = isSubcategory
          ? positions
          : positions.filter((position) => !readIsSubcategory(position));
        setCopyFromPositions(filtered);
        setCopyFromSelectedPosition(null);
      } catch (err) {
        console.error("Error fetching positions for copy:", err);
        setCopyFromPositions([]);
        setCopyFromSelectedPosition(null);
      } finally {
        setCopyFromPositionsLoading(false);
      }
    };
    fetchCopyFromPositions();
  }, [copyFromClientId, isSubcategory]);

  const handleCopyFromPositionSelect = async (
    option: DropdownOption | DropdownOption[]
  ) => {
    if (Array.isArray(option)) return;
    const positionId = option.value as string;
    if (!positionId) {
      setCopyFromSelectedPosition(null);
      return;
    }
    setCopyFromPositionLoading(true);
    try {
      const position = await getPosition(positionId);
      if (!position) return;
      const formatted = convertPositionToFormData(
        position as unknown as Record<string, unknown>
      ) as PositionFormData & { id?: string };
      const { id: _id, ...rest } = formatted;
      const sourceIsSubcategory = readIsSubcategory(formatted);
      const formData: PositionFormData = {
        ...(rest as PositionFormData),
        positionCode: "",
        isSubcategoryForm: isSubcategory,
        ...(isSubcategory && !sourceIsSubcategory
          ? {
              subcategoryPosition: [],
              subcategoryPositionDetails: [],
            }
          : {}),
      };
      methods.reset(formData);
      setCopyFromSelectedPosition(formatted as unknown as PositionData);
      setHasUnsavedChanges(true);

      const clientId = formData.client;
      if (clientId) {
        try {
          const result = await generatePositionCode(clientId);
          methods.setValue("positionCode", result.positionCode);
        } catch {
          // Non-blocking; the form can still be submitted after validation.
        }
      }
    } catch (err) {
      console.error("Error loading position for copy:", err);
      setCopyFromSelectedPosition(null);
      setError(
        err instanceof Error
          ? err.message
          : t("positionCreate.copyFrom.errorLoadingPosition")
      );
      setTimeout(() => setError(null), 3000);
    } finally {
      setCopyFromPositionLoading(false);
    }
  };

  return {
    copyFromClientId,
    setCopyFromClientId,
    copyFromPositionOptions,
    copyFromPositionsLoading,
    copyFromPositionLoading,
    copyFromSelectedPosition,
    setCopyFromSelectedPosition,
    setCopyFromPositions,
    handleCopyFromPositionSelect,
  };
}
