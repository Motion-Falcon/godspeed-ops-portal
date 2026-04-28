export interface PositionDisplayFields {
  title?: string | null;
  isSubcategory?: boolean | null;
  is_subcategory?: boolean | null;
  subcategoryPosition?: string[] | string | null;
  subcategory_position?: string[] | string | null;
}

function cleanSubcategoryLabel(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function normalizeStringSubcategoryPositionValues(value: string): string[] {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return normalizeSubcategoryPositionArray(JSON.parse(trimmed));
    } catch {
      // Fall through to comma splitting below.
    }
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map(cleanSubcategoryLabel)
      .filter((item) => item.length > 0);
  }

  return trimmed
    .split(",")
    .map(cleanSubcategoryLabel)
    .filter((item) => item.length > 0);
}

export function normalizeSubcategoryPositionArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) =>
        typeof item === "string"
          ? normalizeStringSubcategoryPositionValues(item)
          : [cleanSubcategoryLabel(item)]
      )
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return normalizeStringSubcategoryPositionValues(value);
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
  const subcategoryLabels = normalizeSubcategoryPositionArray(
    position.subcategoryPosition ?? position.subcategory_position
  );

  if (!isSubcategory || subcategoryLabels.length === 0) {
    return title;
  }

  return `${title} - (Subcategory - ${subcategoryLabels.join(", ")})`;
}
