import { ExportFormat } from './types';
import { csvFormat } from './formats/csv';
import { xlsxFormat } from './formats/xlsx';
import { pdfFormat } from './formats/pdf';

/**
 * Registry of output formats. New formats are added by registering an
 * {@link ExportFormat}; the manager looks them up by id. Ships csv/xlsx/pdf.
 */
export class ExportRegistry {
  private formats = new Map<string, ExportFormat>();

  constructor() {
    this.register(csvFormat);
    this.register(xlsxFormat);
    this.register(pdfFormat);
  }

  register(format: ExportFormat): void {
    this.formats.set(format.id, format);
  }

  get(id: string): ExportFormat | undefined {
    return this.formats.get(id);
  }

  ids(): string[] {
    return [...this.formats.keys()];
  }
}
