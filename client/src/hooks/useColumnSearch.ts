import { useState, useMemo, useCallback, useEffect } from 'react';

export type RowSearchTextFormatter<T> = (row: T, columnKey: string) => string;

/**
 * Normalizes search text by removing currency symbols, commas, percent signs, and whitespace.
 * Helps match "$1,250.00" with "$1250" or "1250".
 */
function normalizeSearchText(str: string): string {
  return str.replace(/[\$,%]/g, '').trim().toLowerCase();
}

export function useColumnSearch<T>(
  data: T[],
  formatCellText?: RowSearchTextFormatter<T>
) {
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // Requirement 1: Automatically reset column filters when underlying report data array reference changes (API re-fetch)
  useEffect(() => {
    setColumnFilters({});
  }, [data]);

  const setColumnFilter = useCallback((columnKey: string, value: string) => {
    setColumnFilters((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[columnKey];
        return next;
      }
      return { ...prev, [columnKey]: value };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setColumnFilters({});
  }, []);

  const activeFilterKeys = useMemo(() => {
    return Object.keys(columnFilters).filter((k) => columnFilters[k] && columnFilters[k].trim() !== '');
  }, [columnFilters]);

  const hasActiveFilters = activeFilterKeys.length > 0;

  const filteredData = useMemo(() => {
    if (!hasActiveFilters) return data;

    return data.filter((row) => {
      if (!row) return false;

      return activeFilterKeys.every((key) => {
        const filterRaw = columnFilters[key] || '';
        const filterVal = filterRaw.toLowerCase().trim();
        if (!filterVal) return true;

        const rowObj = row as Record<string, unknown>;
        const rawVal = rowObj[key];

        // Formatted cell text
        let formattedStr = '';
        if (formatCellText) {
          formattedStr = formatCellText(row, key);
        } else {
          formattedStr = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';
        }

        const formattedLower = formattedStr.toLowerCase();

        // 1. Direct substring match on formatted display text
        if (formattedLower.includes(filterVal)) {
          return true;
        }

        // Requirement 2: Stripping commas, dollar signs, and symbols for currency/numeric searches
        const filterNormalized = normalizeSearchText(filterVal);
        const formattedNormalized = normalizeSearchText(formattedStr);
        if (filterNormalized && formattedNormalized.includes(filterNormalized)) {
          return true;
        }

        // Requirement 3: Allow matching against raw ISO date strings or underlying date fields
        if (rawVal !== undefined && rawVal !== null) {
          const rawStr = String(rawVal).toLowerCase();
          if (rawStr !== formattedLower && rawStr.includes(filterVal)) {
            return true;
          }
        }

        // Check composite date fields (e.g. from_to_date or week_period)
        if (key === 'from_to_date' || key === 'week_period') {
          const startDate = String(rowObj['from_date'] || rowObj['week_start_date'] || '').toLowerCase();
          const endDate = String(rowObj['to_date'] || rowObj['week_end_date'] || '').toLowerCase();
          if (startDate.includes(filterVal) || endDate.includes(filterVal)) {
            return true;
          }
        }

        return false;
      });
    });
  }, [data, columnFilters, activeFilterKeys, hasActiveFilters, formatCellText]);

  return {
    columnFilters,
    setColumnFilter,
    clearAllFilters,
    hasActiveFilters,
    filteredData,
    totalCount: data.length,
    filteredCount: filteredData.length,
  };
}
