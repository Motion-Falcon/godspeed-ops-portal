import {
  PositionData,
  SubcategoryPositionDetailRow,
} from "../../services/api/position";
import { PAYRATE_TYPES } from "../../constants/formOptions";
import { normalizeSubcategoryPositionArray } from "../../utils/positionDisplay";
import { PositionFormData } from "./positionCreateSchema";

export function normalizeSubcategoryPositionToForm(value: unknown): string[] {
  return normalizeSubcategoryPositionArray(value);
}

export function defaultSubcategoryDetailRow(
  label: string
): SubcategoryPositionDetailRow {
  return {
    subcategoryPosition: label,
    payrateType: PAYRATE_TYPES[0],
    numberOfPositions: 1,
    regularPayRate: "",
    premiumPayRate: "",
    markup: "",
    billRate: "",
  };
}

export function readIsSubcategory(value: unknown): boolean {
  const record = value as {
    isSubcategory?: unknown;
    is_subcategory?: unknown;
  };
  return record.isSubcategory === true || record.is_subcategory === true;
}

export function convertPositionToFormData(
  data: PositionData | Record<string, unknown>
): PositionFormData {
  const result: Record<string, unknown> = {};

  Object.entries(data).forEach(([key, value]) => {
    if (key === "client_id") {
      result.client = value;
      return;
    }
    if (key === "subcategory_position") {
      result.subcategoryPosition = value;
      return;
    }
    if (key === "subcategory_position_details") {
      result.subcategoryPositionDetails = value;
      return;
    }

    const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
      letter.toUpperCase()
    );

    result[camelKey] = value;
  });

  const rawSubcategoryPosition =
    result.subcategoryPosition ?? result.subcategory_position;
  result.subcategoryPosition = normalizeSubcategoryPositionToForm(
    rawSubcategoryPosition
  );
  delete result.subcategory_position;

  let details = result.subcategoryPositionDetails as
    | SubcategoryPositionDetailRow[]
    | undefined;
  const labelsForDetails = result.subcategoryPosition as string[] | undefined;
  if (
    (!details || details.length === 0) &&
    Array.isArray(labelsForDetails) &&
    labelsForDetails.length > 0
  ) {
    details = labelsForDetails.map((label) => ({
      subcategoryPosition: label,
      payrateType: String(result.payrateType || PAYRATE_TYPES[0]),
      numberOfPositions: Number(result.numberOfPositions ?? 1),
      regularPayRate: String(result.regularPayRate ?? ""),
      premiumPayRate: String(result.premiumPayRate ?? ""),
      markup: String(result.markup ?? ""),
      billRate: String(result.billRate ?? ""),
    }));
    result.subcategoryPositionDetails = details;
  }

  result.isSubcategoryForm = readIsSubcategory(result);

  return result as PositionFormData;
}
