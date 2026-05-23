import type { PositionData } from "../../../services/api/position";
import type { ClientPosition } from "../types";

/** Map GET /clients/:id/positions rows into the dropdown model used by Timesheet flows. */
export function mapPositionsFromApiResponse(
  positions: PositionData[]
): ClientPosition[] {
  return positions.map((pos) => ({
    id: pos.id!,
    positionCode: pos.positionCode!,
    title: pos.title!,
    regularPayRate: pos.regularPayRate!,
    premiumPayRate: pos.premiumPayRate,
    billRate: pos.billRate!,
    overtimeEnabled: pos.overtimeEnabled,
    overtimeHours: pos.overtimeHours,
    overtimePayRate: pos.overtimePayRate,
    overtimeBillRate: pos.overtimeBillRate,
    markup: pos.markup,
    positionNumber: pos.positionNumber,
    isSubcategory:
      pos.isSubcategory ??
      (pos as { is_subcategory?: boolean }).is_subcategory,
    subcategoryPosition:
      pos.subcategoryPosition ??
      (pos as { subcategory_position?: string[] | null })
        .subcategory_position,
  }));
}
