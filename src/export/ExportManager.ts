import { Column } from '../models/Column';
import { ExportRegistry } from './registry';
import {
  buildExportData,
  buildExportDataAsync,
  BuildExportInput,
  ExportColumnGroupSpan,
  ExportMergeRange,
  ExportSource,
} from './buildExportData';
import { downloadBlob } from './download';
import { ProgressOverlay } from './ProgressOverlay';
import { ExportData, ExportOptions } from './types';

/** Everything the manager needs from the grid, injected as getters. */
export interface ExportDeps {
  /** Visible columns in display order. */
  columns: () => Column[];
  /** The row source (the grid's DataView satisfies this — filtered + grouped view). */
  source: () => ExportSource;
  /**
   * The full, unfiltered, ungrouped source. Used when exporting a native Excel
   * AutoFilter so the file contains every row for Excel to filter. Optional; the
   * filtered `source` is used when absent.
   */
  fullSource?: () => ExportSource;
  /** Current selection rectangle, or null. */
  selection: () => {
    topRow: number;
    bottomRow: number;
    leftCol: number;
    rightCol: number;
  } | null;
  /** Multi-level header bands for the current columns, or empty. */
  headerGroups: () => { spans: ExportColumnGroupSpan[]; rows: number };
  /** Cell-merge lookup in grid coordinates, or undefined when merging is off. */
  merge?: () => ((displayRow: number, gridCol: number) => ExportMergeRange | null) | undefined;
  /** Whether the grid has column filtering enabled (drives the AutoFilter default). */
  filterable?: () => boolean;
  /**
   * Active value-based column filters, as `{ binding, values }`. Reflected in
   * the exported AutoFilter so Excel opens showing the same filtered result.
   */
  activeFilters?: () => { binding: string; values: string[] }[];
  /** Cancelable "before" hook; return false to abort. */
  onExporting: (options: ExportOptions) => boolean;
  /** "After" hook, fired once the artifact is produced. */
  onExported: (options: ExportOptions) => void;
  /** Host element the progress overlay mounts into (the grid host). */
  host?: () => HTMLElement | null;
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
  private overlay?: ProgressOverlay;

  constructor(private deps: ExportDeps) {}

  /** Register a custom output format. */
  registerFormat = this.registry.register.bind(this.registry);

  /** Ids of the available formats. */
  formats(): string[] {
    return this.registry.ids();
  }

  /**
   * Run an export synchronously. Returns the artifact + metadata, or null if a
   * handler canceled it or the format/columns are invalid. Downloads unless
   * `options.download === false`. For large datasets prefer {@link exportAsync}.
   */
  export(options: ExportOptions = {}): ExportResult | null {
    const format = this.resolveFormat(options);
    if (!format) return null;
    if (this.deps.onExporting(options) === false) return null;

    const data = buildExportData(this.buildInput(options), options);
    return this.finishExport(data, format, options);
  }

  /**
   * Run an export asynchronously: rows are built in chunks that yield to the
   * event loop, so the page stays responsive. Reports progress via
   * `options.onProgress` and shows the built-in overlay when
   * `options.showProgress` is true. Honors `options.signal` for cancellation.
   * Resolves to the artifact (null if canceled), rejects only on unexpected
   * errors — an abort resolves to null.
   */
  async exportAsync(options: ExportOptions = {}): Promise<ExportResult | null> {
    const format = this.resolveFormat(options);
    if (!format) return null;
    if (this.deps.onExporting(options) === false) return null;

    const showProgress = options.showProgress ?? false;
    const host = this.deps.host?.() ?? null;
    if (showProgress && host) {
      this.overlay = new ProgressOverlay(host);
      this.overlay.show();
    }

    // Chain the caller's progress into the overlay.
    const onProgress = (f: number): void => {
      this.overlay?.set(f);
      options.onProgress?.(f);
    };

    try {
      const data = await buildExportDataAsync(this.buildInput(options), {
        ...options,
        onProgress,
      });
      // Rendering the artifact is synchronous but usually fast.
      const result = this.finishExport(data, format, options);
      return result;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null;
      throw err;
    } finally {
      this.overlay?.hide();
      this.overlay = undefined;
    }
  }

  /** Build just the IR (useful for tests or custom rendering). */
  buildData(options: ExportOptions = {}): ExportData {
    return buildExportData(this.buildInput(options), options);
  }

  dispose(): void {
    this.overlay?.hide();
    this.overlay = undefined;
  }

  // ---- internals ------------------------------------------------------------

  private resolveFormat(options: ExportOptions) {
    const formatId = options.format ?? 'csv';
    const format = this.registry.get(formatId);
    if (!format) warn(`unknown export format "${formatId}"`);
    return format;
  }

  private finishExport(
    data: ExportData,
    format: NonNullable<ReturnType<ExportManager['resolveFormat']>>,
    options: ExportOptions,
  ): ExportResult {
    const content = format.render(data, options);
    const fileName = `${options.fileName ?? 'export'}.${format.extension}`;
    if (options.download ?? true) {
      downloadBlob(content, fileName, format.mimeType);
    }
    this.deps.onExported(options);
    return { content, fileName, mimeType: format.mimeType };
  }

  private buildInput(options: ExportOptions): BuildExportInput {
    const allColumns = this.deps.columns();
    const columns = pickColumns(allColumns, options.columns);
    const selectionScoped = (options.rows ?? 'all') === 'selection';
    const selection = selectionScoped ? this.deps.selection() : null;
    const hg = this.deps.headerGroups();
    const merge = this.deps.merge?.();
    // Map an export-column index to its position in the grid's visible columns,
    // which is the coordinate space the merge lookup uses.
    const gridIndex = new Map(allColumns.map((c, i) => [c, i]));
    const gridColOf = (exportCol: number): number => gridIndex.get(columns[exportCol]) ?? exportCol;

    const filterable = this.deps.filterable?.() ?? false;
    const autoFilter = options.autoFilter ?? filterable;
    const filtered = this.deps.source();
    // When emitting a native Excel AutoFilter, export every row (unfiltered) so
    // Excel has data to filter — but only when we aren't grouped or
    // selection-scoped, where the visible view is what the user means.
    const useFull =
      autoFilter && !selectionScoped && !filtered.grouped && this.deps.fullSource != null;
    const source = useFull ? this.deps.fullSource!() : filtered;

    // Map active value-filters to export-column indices (only when the AutoFilter
    // is actually emitted and we exported the full data set — otherwise the rows
    // are already filtered and re-applying would double up).
    const colByBinding = new Map(columns.map((c, i) => [c.binding, i]));
    const filters =
      autoFilter && useFull
        ? (this.deps.activeFilters?.() ?? [])
            .map((f) => ({ col: colByBinding.get(f.binding) ?? -1, values: f.values }))
            .filter((f) => f.col >= 0 && f.values.length > 0)
        : undefined;

    return {
      columns,
      
      source,
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
      merge: merge ?? undefined,
      gridColOf: merge ? gridColOf : undefined,
      filterable,
      filters: filters && filters.length ? filters : undefined,
    };
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
