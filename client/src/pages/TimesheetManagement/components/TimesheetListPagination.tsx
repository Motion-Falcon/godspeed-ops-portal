import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TimesheetPaginationMeta } from "../../../services/types/timesheet";

type TimesheetsListTranslate = (
  key: string,
  options?: Record<string, string | number>
) => string;

interface TimesheetListPaginationTopProps {
  t: TimesheetsListTranslate;
  pagination: TimesheetPaginationMeta;
  onLimitChange: (limit: number) => void;
}

export function TimesheetListPaginationTop({
  t,
  pagination,
  onLimitChange,
}: TimesheetListPaginationTopProps) {
  return (
    <div className="pagination-controls top">
      <div className="pagination-info">
        <span className="pagination-text">
          {t("bulkTimesheetManagement.pagination.showing")}{" "}
          {Math.min(
            (pagination.page - 1) * pagination.limit + 1,
            pagination.total
          )}{" "}
          {t("bulkTimesheetManagement.pagination.to")}{" "}
          {Math.min(
            pagination.page * pagination.limit,
            pagination.total
          )}{" "}
          {t("bulkTimesheetManagement.pagination.of")} {pagination.total}{" "}
          {t("bulkTimesheetManagement.pagination.entries")}
          {pagination.totalFiltered !== pagination.total && (
            <span className="filtered-info">
              {" "}
              ({t("bulkTimesheetManagement.pagination.filteredFrom")}{" "}
              {pagination.total}{" "}
              {t("bulkTimesheetManagement.pagination.totalEntries")})
            </span>
          )}
        </span>
      </div>
      <div className="pagination-size-selector">
        <label htmlFor="pageSize" className="page-size-label">
          {t("bulkTimesheetManagement.pagination.show")}
        </label>
        <select
          id="pageSize"
          value={pagination.limit}
          onChange={(e) =>
            onLimitChange(Number.parseInt(e.target.value, 10))
          }
          className="page-size-select"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span className="page-size-label">
          {t("bulkTimesheetManagement.pagination.perPage")}
        </span>
      </div>
    </div>
  );
}

interface TimesheetListPaginationBottomProps {
  t: TimesheetsListTranslate;
  pagination: TimesheetPaginationMeta;
  onPageChange: (page: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function TimesheetListPaginationBottom({
  t,
  pagination,
  onPageChange,
  onPreviousPage,
  onNextPage,
}: TimesheetListPaginationBottomProps) {
  if (pagination.totalPages <= 1) return null;

  return (
    <div className="pagination-controls bottom">
      <div className="pagination-info">
        <span className="pagination-text">
          {t("bulkTimesheetManagement.pagination.page")} {pagination.page}{" "}
          {t("bulkTimesheetManagement.pagination.of")} {pagination.totalPages}
        </span>
      </div>
      <div className="pagination-buttons">
        <button
          type="button"
          className="pagination-btn prev"
          onClick={onPreviousPage}
          disabled={!pagination.hasPrevPage}
          title={t("bulkTimesheetManagement.pagination.previousPage")}
          aria-label={t("bulkTimesheetManagement.pagination.previousPage")}
        >
          <ChevronLeft size={16} />
          <span>{t("bulkTimesheetManagement.pagination.previous")}</span>
        </button>
        <div className="page-numbers">
          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
            let pageNum;
            if (pagination.totalPages <= 5) {
              pageNum = i + 1;
            } else if (pagination.page <= 3) {
              pageNum = i + 1;
            } else if (
              pagination.page >=
              pagination.totalPages - 2
            ) {
              pageNum = pagination.totalPages - 4 + i;
            } else {
              pageNum = pagination.page - 2 + i;
            }
            return (
              <button
                type="button"
                key={pageNum}
                className={`page-number-btn ${
                  pageNum === pagination.page ? "active" : ""
                }`}
                onClick={() => onPageChange(pageNum)}
                aria-label={t(
                  "bulkTimesheetManagement.pagination.goToPage",
                  { page: pageNum }
                )}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="pagination-btn next"
          onClick={onNextPage}
          disabled={!pagination.hasNextPage}
          title={t("bulkTimesheetManagement.pagination.nextPage")}
          aria-label={t("bulkTimesheetManagement.pagination.nextPage")}
        >
          <span>{t("bulkTimesheetManagement.pagination.next")}</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
