// csvExport.ts
/**
 * Utility to export an array of objects as a CSV file and trigger download in the browser.
 * @param data Array of objects to export
 * @param filename Name of the CSV file (default: 'export.csv')
 * @param columns Optional: Array of column keys (to control order/headers). If not provided, uses keys from first object.
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename = 'export.csv',
  columns?: Array<string | symbol>
) {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }
  // Use provided columns or keys from first object
  const keys = columns || Object.keys(data[0]);
  // CSV header
  const header = keys.map((k) => `"${String(k)}"`).join(',');
  // CSV rows
  const rows = data.map(row =>
    keys.map((k) => {
      let val = row[String(k)];
      if (val === null || val === undefined) val = '';
      // Escape quotes and commas
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  );
  // Add BOM for Excel compatibility
  const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default exportToCSV; 