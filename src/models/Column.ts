export type DataType = 'String' | 'Number' | 'Boolean' | 'Date';
export type CellAlign = 'left' | 'center' | 'right';

/** An entry in a column's dataMap (combo box choices). */
export type DataMapEntry = string | { value: unknown; text: string };

export interface CellTemplateContext<T = Record<string, unknown>> {
  value: unknown;
  item: T;
  row: number;
  column: Column<T>;
}

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
  /** Choices for a combo-box cell. The cell shows the mapped text and edits via a dropdown. */
  dataMap?: DataMapEntry[];
  /** Return custom cell HTML. Overrides the default text/checkbox rendering. */
  cellTemplate?: (ctx: CellTemplateContext<T>) => string;
}

interface MapOption {
  value: unknown;
  text: string;
  key: string;
}

const DEFAULT_WIDTH = 100;

function defaultAlign(dataType: DataType): CellAlign {
  if (dataType === 'Number' || dataType === 'Date') return 'right';
  if (dataType === 'Boolean') return 'center';
  return 'left';
}

function normalizeMap(entries: DataMapEntry[]): MapOption[] {
  return entries.map((e) => {
    const value = typeof e === 'string' ? e : e.value;
    const text = typeof e === 'string' ? e : e.text;
    return { value, text, key: String(value) };
  });
}

export class Column<T = Record<string, unknown>> {
  readonly binding: string;
  readonly header: string;
  width: number;
  editable: boolean;
  readonly dataType: DataType;
  readonly align: CellAlign;
  readonly cellTemplate?: (ctx: CellTemplateContext<T>) => string;

  private readonly valueGetter?: (item: T) => unknown;
  private readonly valueFormatter?: (value: unknown, item: T) => string;
  private readonly mapOptions?: MapOption[];

  constructor(def: ColumnDef<T>) {
    this.binding = def.binding ?? '';
    this.header = def.header ?? def.binding ?? '';
    this.width = def.width ?? DEFAULT_WIDTH;
    this.dataType = def.dataType ?? 'String';
    this.align = def.align ?? defaultAlign(this.dataType);
    this.valueGetter = def.valueGetter;
    this.valueFormatter = def.valueFormatter;
    this.cellTemplate = def.cellTemplate;
    this.mapOptions = def.dataMap ? normalizeMap(def.dataMap) : undefined;
    // Calculated columns are read-only; combo cells stay editable.
    this.editable = (def.editable ?? false) && !this.isCalculated;
  }

  /** A column driven by `valueGetter` has no writable field, so it can't be edited. */
  get isCalculated(): boolean {
    return this.valueGetter != null;
  }

  get dataMap(): MapOption[] | undefined {
    return this.mapOptions;
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
    if (this.mapOptions) {
      const opt = this.mapOptions.find((o) => o.key === text);
      return opt ? opt.value : text;
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

  format(item: T): string {
    const value = this.getValue(item);
    if (this.valueFormatter) return this.valueFormatter(value, item);
    if (this.mapOptions) {
      const opt = this.mapOptions.find((o) => o.value === value);
      return opt ? opt.text : value == null ? '' : String(value);
    }
    if (value == null) return '';
    if (this.dataType === 'Boolean') return ''; // rendered as a checkbox
    if (this.dataType === 'Date' && value instanceof Date) return value.toLocaleDateString();
    return String(value);
  }
}
