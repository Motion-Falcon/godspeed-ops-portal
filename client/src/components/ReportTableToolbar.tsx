import { RotateCcw } from "lucide-react";
import { useLanguage } from "../contexts/language/language-provider";

interface ReportTableToolbarProps {
  hasActiveFilters: boolean;
  filteredCount: number;
  totalCount: number;
  onClearSearch: () => void;
  onDownloadCSV: () => void;
  downloadLabel?: string;
}

export function ReportTableToolbar({
  hasActiveFilters,
  filteredCount,
  onClearSearch,
  onDownloadCSV,
  downloadLabel,
}: ReportTableToolbarProps) {
  const { t } = useLanguage();

  return (
    <div className="report-table-toolbar">
      <div className="toolbar-left-group">
        <button
          type="button"
          className="button csv-download-btn"
          onClick={onDownloadCSV}
        >
          {downloadLabel || t("reports.states.downloadCSV")}
        </button>

        {hasActiveFilters && (
          <span className="search-csv-info-badge">
            {t("reports.info.csvFiltered", { count: filteredCount })}
          </span>
        )}
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          className="button secondary reset-search-btn-right"
          onClick={onClearSearch}
        >
          <RotateCcw size={14} />
          <span>{t("reports.buttons.clearSearch")}</span>
        </button>
      )}
    </div>
  );
}

export default ReportTableToolbar;
