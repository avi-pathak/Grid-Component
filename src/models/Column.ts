import { DataMap } from './DataMap';
import { DataMapEditor } from './DataMapEditor';

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
  /** Choices for a combo-box cell. Accepts a simple list, value/text pairs, or a DataMap. */
  dataMap?: DataMapEntry[] | DataMap;
  /** Which editor a data-mapped cell uses. Default DropDownList. */
  dataMapEditor?: DataMapEditor;
  /** Return custom cell HTML. Overrides the default text/checkbox rendering. */
  cellTemplate?: (ctx: CellTemplateContext<T>) => string;
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
  readonly cellTemplate?: (ctx: CellTemplateContext<T>) => string;

  private readonly valueGetter?: (item: T) => unknown;
  private readonly valueFormatter?: (value: unknown, item: T) => string;
  private readonly map?: DataMap;

  constructor(def: ColumnDef<T>) {
    this.binding = def.binding ?? '';
    this.header = def.header ?? def.binding ?? '';
    this.width = def.width ?? DEFAULT_WIDTH;
    this.dataType = def.dataType ?? 'String';
    this.align = def.align ?? defaultAlign(this.dataType);
    this.valueGetter = def.valueGetter;
    this.valueFormatter = def.valueFormatter;
    this.cellTemplate = def.cellTemplate;
    this.map = def.dataMap ? toDataMap(def.dataMap) : undefined;
    this.dataMapEditor = def.dataMapEditor ?? DataMapEditor.DropDownList;
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

  format(item: T): string {
    const value = this.getValue(item);
    if (this.valueFormatter) return this.valueFormatter(value, item);
    if (this.map) {
      const text = this.map.getDisplayValue(value);
      return text !== '' ? text : value == null ? '' : String(value);
    }
    if (value == null) return '';
    if (this.dataType === 'Boolean') return ''; // rendered as a checkbox
    if (this.dataType === 'Date' && value instanceof Date) return value.toLocaleDateString();
    return String(value);
  }
}
