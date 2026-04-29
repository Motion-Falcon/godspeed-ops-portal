import type { PositionData, SubcategoryPositionDetailInput } from "./types.js";

export type { SubcategoryPositionDetailInput };

export type SubcategoryDetailsValidation =
  | { ok: true; orderedRows: SubcategoryPositionDetailInput[] }
  | { ok: false; error: string };

function trimLabel(s: string): string {
  return String(s ?? "").trim();
}

/**
 * DB may return text[] (array), a single VARCHAR (legacy), or a JSON string.
 * Must not pass a raw string to code that does `(labels ?? []).map` — strings are
 * truthy so `("Miles").map` throws.
 */
export function coerceSubcategoryPositionLabels(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((x) => trimLabel(String(x))).filter((s) => s.length > 0);
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return [];
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.map((x) => trimLabel(String(x))).filter((x) => x.length > 0);
        }
      } catch {
        // fall through to single label
      }
    }
    return [trimLabel(s)];
  }
  return [];
}

/**
 * Validates detail rows against the selected subcategory_position labels and returns rows in array order.
 */
export function validateSubcategoryPositionDetails(
  subcategoryPosition: unknown,
  details: SubcategoryPositionDetailInput[] | null | undefined
): SubcategoryDetailsValidation {
  const labels = coerceSubcategoryPositionLabels(subcategoryPosition);
  if (labels.length === 0) {
    return { ok: false, error: "subcategoryPosition must have at least one label" };
  }
  const rows = details ?? [];
  if (rows.length !== labels.length) {
    return {
      ok: false,
      error:
        "subcategoryPositionDetails must have exactly one row per selected subcategory position type",
    };
  }

  const byLabel = new Map<string, SubcategoryPositionDetailInput>();
  for (const row of rows) {
    const lab = trimLabel(row.subcategoryPosition);
    if (!lab) {
      return { ok: false, error: "Each detail row must include subcategoryPosition" };
    }
    if (byLabel.has(lab)) {
      return { ok: false, error: `Duplicate detail row for "${lab}"` };
    }
    byLabel.set(lab, row);
  }

  for (const lab of labels) {
    if (!byLabel.has(lab)) {
      return {
        ok: false,
        error: `Missing position details row for subcategory position "${lab}"`,
      };
    }
  }

  for (const lab of byLabel.keys()) {
    if (!labels.includes(lab)) {
      return {
        ok: false,
        error: `Unexpected detail row for "${lab}" not in subcategoryPosition`,
      };
    }
  }

  const orderedRows = labels.map((lab) => byLabel.get(lab)!);

  for (const row of orderedRows) {
    if (!trimLabel(row.payrateType)) {
      return { ok: false, error: "payrateType is required for each subcategory position row" };
    }
    if (
      row.numberOfPositions === undefined ||
      row.numberOfPositions === null ||
      Number(row.numberOfPositions) < 1
    ) {
      return {
        ok: false,
        error: "numberOfPositions must be at least 1 for each subcategory position row",
      };
    }
    if (!trimLabel(row.regularPayRate)) {
      return {
        ok: false,
        error: "regularPayRate is required for each subcategory position row",
      };
    }
    if (!trimLabel(row.billRate)) {
      return {
        ok: false,
        error: "billRate is required for each subcategory position row",
      };
    }
  }

  return { ok: true, orderedRows };
}

/** Copies first detail row onto main position fields (legacy single-row consumers). */
export function applyFirstSubcategoryDetailToMainPosition(
  target: PositionData,
  first: SubcategoryPositionDetailInput
): void {
  target.payrateType = first.payrateType;
  target.numberOfPositions = Number(first.numberOfPositions);
  target.regularPayRate = first.regularPayRate;
  target.premiumPayRate = first.premiumPayRate;
  target.markup = first.markup;
  target.billRate = first.billRate;
}

export function detailRowToDbInsert(
  positionId: string,
  row: SubcategoryPositionDetailInput
): Record<string, unknown> {
  return {
    position_id: positionId,
    subcategory_position: trimLabel(row.subcategoryPosition),
    payrate_type: trimLabel(row.payrateType),
    number_of_positions: Number(row.numberOfPositions),
    regular_pay_rate: trimLabel(row.regularPayRate),
    premium_pay_rate: row.premiumPayRate != null ? trimLabel(row.premiumPayRate) : null,
    markup: row.markup != null ? trimLabel(row.markup) : null,
    bill_rate: trimLabel(row.billRate),
    updated_at: new Date().toISOString(),
  };
}

export function dbDetailRowToApi(row: Record<string, unknown>): SubcategoryPositionDetailInput {
  return {
    subcategoryPosition: String(row.subcategory_position ?? ""),
    payrateType: String(row.payrate_type ?? ""),
    numberOfPositions: Number(row.number_of_positions ?? 0),
    regularPayRate: String(row.regular_pay_rate ?? ""),
    premiumPayRate:
      row.premium_pay_rate != null ? String(row.premium_pay_rate) : undefined,
    markup: row.markup != null ? String(row.markup) : undefined,
    billRate: String(row.bill_rate ?? ""),
  };
}

/** Order DB rows to match positions.subcategory_position[] when possible. */
export function orderDetailRowsForResponse(
  labels: unknown,
  rawRows: Record<string, unknown>[]
): SubcategoryPositionDetailInput[] {
  const map = new Map(
    rawRows.map((r) => [trimLabel(String(r.subcategory_position ?? "")), r])
  );
  const labelOrder = coerceSubcategoryPositionLabels(labels);
  const keysToEmit =
    labelOrder.length > 0 ? labelOrder : [...map.keys()].sort();
  const result: SubcategoryPositionDetailInput[] = [];
  for (const lab of keysToEmit) {
    const row = map.get(lab);
    if (row) result.push(dbDetailRowToApi(row));
  }
  return result;
}
