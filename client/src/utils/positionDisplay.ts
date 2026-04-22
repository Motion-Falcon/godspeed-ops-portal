export interface PositionDisplayFields {
  title?: string | null;
  isSubcategory?: boolean | null;
  is_subcategory?: boolean | null;
  subcategoryPortion?: string[] | string | null;
  subcategory_portion?: string[] | string | null;
}

function cleanPortionLabel(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function normalizeStringSubcategoryPortions(value: string): string[] {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return normalizeSubcategoryPortions(JSON.parse(trimmed));
    } catch {
      // Fall through to comma splitting below.
    }
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map(cleanPortionLabel)
      .filter((item) => item.length > 0);
  }

  return trimmed
    .split(",")
    .map(cleanPortionLabel)
    .filter((item) => item.length > 0);
}

export function normalizeSubcategoryPortions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) =>
        typeof item === "string"
          ? normalizeStringSubcategoryPortions(item)
          : [cleanPortionLabel(item)]
      )
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return normalizeStringSubcategoryPortions(value);
  }

  return [];
}

export function getPositionDisplayTitle(
  position: PositionDisplayFields,
  fallbackTitle = "Unknown Position"
): string {
  const title = position.title?.trim() || fallbackTitle;
  const isSubcategory =
    position.isSubcategory === true || position.is_subcategory === true;
  const portions = normalizeSubcategoryPortions(
    position.subcategoryPortion ?? position.subcategory_portion
  );

  if (!isSubcategory || portions.length === 0) {
    return title;
  }

  return `${title} - (Subcategory - ${portions.join(", ")})`;
}
