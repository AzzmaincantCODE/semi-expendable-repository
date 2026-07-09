import * as XLSX from 'xlsx';

/**
 * Utility to export an array of JSON objects to an Excel (.xlsx) file.
 * 
 * @param data Array of objects to be exported. The keys will be used as column headers.
 * @param filename The name of the file to be saved (e.g., 'Export.xlsx'). Should include .xlsx extension.
 * @param sheetName The name of the worksheet inside the Excel file. Defaults to 'Sheet1'.
 */
export const exportToExcel = (data: any[], filename: string, sheetName: string = 'Sheet1') => {
  // Convert JSON to Worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-size columns based on content length
  const columnWidths = getColumnWidths(data);
  worksheet['!cols'] = columnWidths;

  // Create Workbook and append the Worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Trigger download
  XLSX.writeFile(workbook, filename);
};

/**
 * Calculates optimal column widths for the worksheet
 */
const getColumnWidths = (data: any[]) => {
  if (!data || data.length === 0) return [];

  // Get keys from first object
  const keys = Object.keys(data[0]);

  return keys.map((key) => {
    // Start with the header length
    let maxWidth = key.length;

    // Iterate over data to find the longest value
    for (let i = 0; i < data.length; i++) {
      const value = data[i][key];
      if (value !== null && value !== undefined) {
        const valLength = String(value).length;
        if (valLength > maxWidth) {
          maxWidth = valLength;
        }
      }
    }

    // Add some padding
    return { wch: Math.min(maxWidth + 2, 50) }; // Cap width at 50 characters
  });
};
