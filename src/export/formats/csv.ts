import { ExportData, ExportFormat, ExportOptions } from '../types';

/**
 * CSV writer following RFC 4180: fields containing the delimiter, a quote, or a
 * newline are wrapped in double quotes and inner quotes are doubled. A UTF-8 BOM
 * is prefixed by default so Excel opens the file as UTF-8.
 */
export const csvFormat: ExportFormat = {
  id: 'csv',
  extension: 'csv',
  mimeType: 'text/csv;charset=utf-8',

  render(data: ExportData, options: ExportOptions): string {
    const opts = options.csv ?? {};
    const delimiter = opts.delimiter ?? ',';
    const newline = opts.newline ?? '\r\n';
    const bom = opts.bom ?? true;
    const includeHeaders = options.includeHeaders ?? true;

    const escape = (field: string): string => {
      if (
        field.includes(delimiter) ||
        field.includes('"') ||
        field.includes('\n') ||
        field.includes('\r')
      ) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const lines: string[] = [];
    if (includeHeaders) {
      lines.push(data.columns.map((c) => escape(c.header)).join(delimiter));
    }
    for (const row of data.rows) {
      lines.push(row.cells.map((cell) => escape(cell.text)).join(delimiter));
    }

    const body = lines.join(newline);
    return bom ? `\uFEFF${body}` : body;
  },
};
