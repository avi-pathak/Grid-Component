import { Column } from '../models/Column';
import { ExportRegistry } from './registry';
import { buildExportData, ExportColumnGroupSpan, ExportSource } from './buildExportData';
import { downloadBlob } from './download';
import { ExportData, ExportOptions } from './types';

/** Everything the manager needs from the grid, injected as getters. */
export interface ExportDeps {
  /** Visible columns in display order. */
  columns: () => Column[];
  /** The row source (the grid's DataView satisfies this). */
  source: () => ExportSource;
  /** Current selection rectangle, or null. */
  selection: () => {
    topRow: number;
    bottomRow: number;
    leftCol: number;
    rightCol: number;
  } | null;
  /** Multi-level header bands for the current columns, or empty. */
  headerGroups: () => { spans: ExportColumnGroupSpan[]; rows: number };
  /** Cancelable "before" hook; return false to abort. */
  onExporting: (options: ExportOptions) => boolean;
  /** "After" hook, fired once the artifact is produced. */
  onExported: (options: ExportOptions) => void;
}

/** The result of an export: the artifact plus its file metadata. */
export interface ExportResult {
  content: string | Uint8Array;
  fileName: string;
  mimeType: string;
}

/**
 * Orchestrates an export: assembles the {@link ExportData} IR from the grid,
 * hands it to the selected {@link ExportFormat}, fires the cancelable
 * `exporting` / `exported` events, and (by default) downloads the file.
 * Grid-agnostic beyond the injected {@link ExportDeps}.
 */
export class ExportManager {
  private registry = new ExportRegistry();

  constructor(private deps: ExportDeps) {}

  /** Register a custom output format. */
  registerFormat = this.registry.register.bind(this.registry);

  /** Ids of the available formats. */
  formats(): string[] {
    return this.registry.ids();
  }

  /**
   * Run an export. Returns the artifact + metadata, or null if a handler
   * canceled it or the format/columns are invalid. Downloads unless
   * `options.download === false`.
   */
  export(options: ExportOptions = {}): ExportResult | null {
    const formatId = options.format ?? 'csv';
    const format = this.registry.get(formatId);
    if (!format) {
      warn(`unknown export format "${formatId}"`);
      return null;
    }
    if (this.deps.onExporting(options) === false) return null;

    const data = this.buildData(options);
    const content = format.render(data, options);
    const fileName = `${options.fileName ?? 'export'}.${format.extension}`;

    if (options.download ?? true) {
      downloadBlob(content, fileName, format.mimeType);
    }
    this.deps.onExported(options);
    return { content, fileName, mimeType: format.mimeType };
  }

  /** Build just the IR (useful for tests or custom rendering). */
  buildData(options: ExportOptions = {}): ExportData {
    const allColumns = this.deps.columns();
    const columns = pickColumns(allColumns, options.columns);
    const selection = (options.rows ?? 'all') === 'selection' ? this.deps.selection() : null;
    const hg = this.deps.headerGroups();
    return buildExportData(
      {
        columns,
        source: this.deps.source(),
        selection: selection
          ? {
              topRow: selection.topRow,
              bottomRow: selection.bottomRow,
              leftCol: 0,
              rightCol: columns.length - 1,
            }
          : null,
        // Header groups only make sense with the full, unfiltered column set.
        headerGroups: options.columns ? undefined : hg.spans,
        headerRows: options.columns ? undefined : hg.rows,
      },
      options,
    );
  }

  dispose(): void {
    // Nothing owned (no listeners); present for construction/dispose symmetry.
  }
}

// Resolve the requested column bindings to Column objects, in the requested
// order. Unknown bindings are skipped; omitting `bindings` keeps all columns.
function pickColumns(columns: Column[], bindings?: string[]): Column[] {
  if (!bindings || bindings.length === 0) return columns;
  const byBinding = new Map(columns.map((c) => [c.binding, c]));
  const out: Column[] = [];
  for (const b of bindings) {
    const c = byBinding.get(b);
    if (c) out.push(c);
  }
  return out.length ? out : columns;
}

function warn(message: string): void {
  if (typeof console !== 'undefined') console.warn(`apgrid: ${message}`);
}
