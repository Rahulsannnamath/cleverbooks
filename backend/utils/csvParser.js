/**
 * CSV Parser Utility
 * Parses CSV string content into an array of objects.
 * Supports the courier settlement record format.
 */

/**
 * Parse CSV text into an array of objects
 * @param {string} csvText - Raw CSV string
 * @returns {Array<Object>} Parsed records
 */
export function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must contain a header row and at least one data row');
  }

  // Parse header
  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));

  // Parse data rows
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);

    if (values.length !== headers.length) {
      throw new Error(
        `Row ${i + 1}: expected ${headers.length} columns but got ${values.length}`
      );
    }

    const record = {};
    headers.forEach((header, index) => {
      let value = values[index].trim().replace(/^"|"$/g, '');

      // Auto-convert numeric fields
      const numericFields = [
        'settledCodAmount',
        'chargedWeight',
        'forwardCharge',
        'rtoCharge',
        'codHandlingFee',
      ];
      if (numericFields.includes(header)) {
        value = parseFloat(value) || 0;
      }

      record[header] = value;
    });

    records.push(record);
  }

  return records;
}

/**
 * Parse a single CSV line, handling quoted fields with commas
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);

  return result;
}

/**
 * Convert array of objects to CSV string
 */
export function toCSV(records) {
  if (!records || records.length === 0) return '';

  const headers = Object.keys(records[0]);
  const lines = [headers.join(',')];

  for (const record of records) {
    const values = headers.map((h) => {
      const val = record[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Quote if contains comma, newline, or quotes
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}
