import { DataMap } from './DataMap';
import { DataMapEditor } from './DataMapEditor';
import type { CellEditorFactory } from '../editing/CellEditor';

export type DataType = 'String' | 'Number' | 'Boolean' | 'Date';
export type CellAlign = 'left' | 'center' | 'right';
export type AggregateType = 'sum' | 'avg' | 'min' | 'max' | 'count';

/** An entry in a column's dataMap (combo box choices). */
export type DataMapEntry = string | { value: unknown; text: string };

export interface CellTemplateContext<T = Record<string, unknown>> {
  value: unknown;
  item: T;
  row: number;
  column: Column<T>;
}

/** Inline styles as a plain object, e.g. `{ color: 'red', backgroundColor: '#fee' }`. */
export type CellStyle = Partial<CSSStyleDeclaration> & Record<string, string>;

/** Resolves a cell's CSS classes from its value/row. Return one or more class names. */
export type CellClassFn<T = Record<string, unknown>> = (
  ctx: CellTemplateContext<T>,
) => string | string[] | null | undefined;

/** Resolves a cell's inline styles from its value/row. */
export type CellStyleFn<T = Record<string, unknown>> = (
  ctx: CellTemplateContext<T>,
) => CellStyle | null | undefined;

/** Map of class name to a predicate; each class is applied when its predicate is true. */
export type CellClassRules<T = Record<string, unknown>> = Record<
  string,
  (ctx: CellTemplateContext<T>) => boolean
>;

export interface ColumnDef<T = Record<string, unknown>> {
  /** Field to bind to. Optional for calculated columns that use `valueGetter`. */
  binding?: string;
  header?: string;
  width?: number;
  editable?: boolean;
  dataType?: DataType;
  align?: CellAlign;
  /** Compute the value from the row. Makes the column calculated (read-only). */
  valueGetter?: (item: T) => unknown;
  valueFormatter?: (value: unknown, item: T) => string;
  /** Choices for a combo-box cell. Accepts a simple list, value/text pairs, or a DataMap. */
  dataMap?: DataMapEntry[] | DataMap;
  /** Which editor a data-mapped cell uses. Default DropDownList. */
  dataMapEditor?: DataMapEditor;
  /** Aggregate shown for this column on group-header rows. */
  aggregate?: AggregateType;
  /** Allow a filter dialog on this column. Overrides the grid's `allowFiltering`. */
  filter?: boolean;
  /** Let this column merge adjacent equal-valued cells. Overrides the grid's `allowMerging`. */
  allowMerging?: boolean;
  /** CSS class(es) for the cell. A function receives the cell context for conditional styling. */
  cellClass?: string | string[] | CellClassFn<T>;
  /** Inline styles for the cell. A function receives the cell context for conditional styling. */
  cellStyle?: CellStyle | CellStyleFn<T>;
  /** Class-name → predicate map; each class is applied when its predicate returns true. */
  cellClassRules?: CellClassRules<T>;
  /** Return custom cell HTML. Overrides the default text/checkbox rendering. */
  cellTemplate?: (ctx: CellTemplateContext<T>) => string;
  /** Placeholder text shown in the built-in text editor when the cell is empty. */
  placeholder?: string;
  /**
   * A custom editor for this column, replacing the built-in text/dropdown/
   * radio editors. Called once (lazily, on first edit) with the same
   * commit/cancel callbacks the built-in editors receive; the returned
   * instance is then reused across every edit on this column.
   */
  editor?: CellEditorFactory<T>;
}

const DEFAULT_WIDTH = 100;

function defaultAlign(dataType: DataType): CellAlign {
  if (dataType === 'Number' || dataType === 'Date') return 'right';
  if (dataType === 'Boolean') return 'center';
  return 'left';
}

function toDataMap(map: DataMapEntry[] | DataMap): DataMap {
  if (map instanceof DataMap) return map;
  if (map.length > 0 && typeof map[0] === 'object') {
    return new DataMap(map as { value: unknown; text: string }[], 'value', 'text');
  }
  return new DataMap(map as string[]);
}

export class Column<T = Record<string, unknown>> {
  readonly binding: string;
  readonly header: string;
  width: number;
  editable: boolean;
  readonly dataType: DataType;
  readonly align: CellAlign;
  readonly dataMapEditor: DataMapEditor;
  readonly aggregate?: AggregateType;
  /** Whether the header shows a filter button. Resolved from the grid + column options. */
  filterable = false;
  /** Whether this column participates in cell merging. Resolved from the grid + column options. */
  allowMerging = false;
  /** Excluded from layout/rendering/selection when true. Driven by collapsed column groups. */
  hidden = false;
  readonly cellTemplate?: (ctx: CellTemplateContext<T>) => string;
  readonly placeholder?: string;
  readonly editorFactory?: CellEditorFactory<T>;

  private readonly valueGetter?: (item: T) => unknown;
  private readonly valueFormatter?: (value: unknown, item: T) => string;
  private readonly map?: DataMap;
  private readonly cellClassDef?: string | string[] | CellClassFn<T>;
  private readonly cellStyleDef?: CellStyle | CellStyleFn<T>;
  private readonly cellClassRules?: CellClassRules<T>;

  constructor(def: ColumnDef<T>) {
    this.binding = def.binding ?? '';
    this.header = def.header ?? def.binding ?? '';
    this.width = def.width ?? DEFAULT_WIDTH;
    this.dataType = def.dataType ?? 'String';
    this.align = def.align ?? defaultAlign(this.dataType);
    this.valueGetter = def.valueGetter;
    this.valueFormatter = def.valueFormatter;
    this.cellTemplate = def.cellTemplate;
    this.placeholder = def.placeholder;
    this.editorFactory = def.editor;
    this.map = def.dataMap ? toDataMap(def.dataMap) : undefined;
    this.dataMapEditor = def.dataMapEditor ?? DataMapEditor.DropDownList;
    this.aggregate = def.aggregate;
    this.cellClassDef = def.cellClass;
    this.cellStyleDef = def.cellStyle;
    this.cellClassRules = def.cellClassRules;
    // Calculated columns are read-only; combo cells stay editable.
    this.editable = (def.editable ?? false) && !this.isCalculated;
  }

  /** A column driven by `valueGetter` has no writable field, so it can't be edited. */
  get isCalculated(): boolean {
    return this.valueGetter != null;
  }

  get dataMap(): DataMap | undefined {
    return this.map;
  }

  getValue(item: T): unknown {
    if (this.valueGetter) return this.valueGetter(item);
    return (item as Record<string, unknown>)[this.binding];
  }

  setValue(item: T, value: unknown): void {
    (item as Record<string, unknown>)[this.binding] = value;
  }

  /** Turn editor text into a typed value matching the column's dataType or dataMap. */
  parse(text: string): unknown {
    if (this.map) {
      const key = this.map.getKeyValue(text);
      return key != null ? key : text;
    }
    switch (this.dataType) {
      case 'Number': {
        if (text.trim() === '') return null;
        const n = Number(text);
        return Number.isNaN(n) ? null : n;
      }
      case 'Boolean':
        return text === 'true' || text === '1';
      case 'Date': {
        const d = new Date(text);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      default:
        return text;
    }
  }

  /**
   * Like {@link parse}, but reports whether the text failed type coercion
   * (`ok: false`) rather than just returning `null` — which `parse` also
   * returns for an intentionally cleared cell. Lets a validation hook tell
   * "invalid input" apart from "the user cleared this".
   */
  tryParse(text: string): { value: unknown; ok: boolean } {
    if (this.map) {
      const key = this.map.getKeyValue(text);
      return { value: key != null ? key : text, ok: true };
    }
    switch (this.dataType) {
      case 'Number': {
        if (text.trim() === '') return { value: null, ok: true };
        const n = Number(text);
        return Number.isNaN(n) ? { value: null, ok: false } : { value: n, ok: true };
      }
      case 'Boolean':
        return { value: text === 'true' || text === '1', ok: true };
      case 'Date': {
        if (text.trim() === '') return { value: null, ok: true };
        const d = new Date(text);
        return Number.isNaN(d.getTime()) ? { value: null, ok: false } : { value: d, ok: true };
      }
      default:
        return { value: text, ok: true };
    }
  }

  format(item: T): string {
    return this.formatValue(this.getValue(item), item);
  }

  /** Format a raw value the way this column formats cells. Also used for aggregates. */
  formatValue(value: unknown, item?: T): string {
    if (this.valueFormatter) return this.valueFormatter(value, item as T);
    if (this.map) {
      const text = this.map.getDisplayValue(value);
      return text !== '' ? text : value == null ? '' : String(value);
    }
    if (value == null) return '';
    if (this.dataType === 'Boolean') return ''; // rendered as a checkbox
    if (this.dataType === 'Date' && value instanceof Date) return value.toLocaleDateString();
    return String(value);
  }

  /** The CSS classes for a cell, from `cellClass` plus any matching `cellClassRules`. */
  cellClasses(item: T, row: number): string[] {
    if (!this.cellClassDef && !this.cellClassRules) return [];
    const ctx = this.cellContext(item, row);
    const out: string[] = [];
    const cc = typeof this.cellClassDef === 'function' ? this.cellClassDef(ctx) : this.cellClassDef;
    addClasses(out, cc);
    if (this.cellClassRules) {
      for (const name in this.cellClassRules) {
        if (this.cellClassRules[name](ctx)) addClasses(out, name);
      }
    }
    return out;
  }

  /** The inline styles for a cell, or null when `cellStyle` is unset or returns nothing. */
  cellInlineStyle(item: T, row: number): CellStyle | null {
    if (!this.cellStyleDef) return null;
    if (typeof this.cellStyleDef !== 'function') return this.cellStyleDef;
    return this.cellStyleDef(this.cellContext(item, row)) ?? null;
  }

  private cellContext(item: T, row: number): CellTemplateContext<T> {
    return { value: this.getValue(item), item, row, column: this };
  }
}

// Push class name(s) as individual tokens (space-separated strings are split).
function addClasses(out: string[], value: string | string[] | null | undefined): void {
  if (!value) return;
  const list = Array.isArray(value) ? value : [value];
  for (const entry of list) {
    for (const token of entry.split(/\s+/)) if (token) out.push(token);
  }
}
