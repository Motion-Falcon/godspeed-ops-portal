import { useState, useMemo } from 'react';

export interface UseTableSearchOptions<T> {
  formatRowSearchText?: (row: T) => string;
}

export function useTableSearch<T>(
  data: T[],
  options?: UseTableSearchOptions<T>
) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase().trim();

    return data.filter((row) => {
      if (!row) return false;
      if (options?.formatRowSearchText) {
        return options.formatRowSearchText(row).toLowerCase().includes(term);
      }
      return Object.values(row).some((val) => {
        if (val === undefined || val === null) return false;
        if (typeof val === 'object') return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }, [data, searchTerm, options?.formatRowSearchText]);

  return {
    searchTerm,
    setSearchTerm,
    filteredData,
    hasSearchTerm: Boolean(searchTerm.trim()),
    resetSearch: () => setSearchTerm(''),
    totalCount: data.length,
    filteredCount: filteredData.length,
  };
}
