export type DataType = 'String' | 'Number' | 'Boolean' | 'Date';
export type CellAlign = 'left' | 'center' | 'right';

export interface ColumnDef<T = Record<string, unknown>> {
  binding: string;
  header?: string;
  width?: number;
  editable?: boolean;
  dataType?: DataType;
  align?: CellAlign;
  valueGetter?: (item: T) => unknown;
  valueFormatter?: (value: unknown, item: T) => string;
}

const DEFAULT_WIDTH = 100;

function defaultAlign(dataType: DataType): CellAlign {
  if (dataType === 'Number' || dataType === 'Date') return 'right';
  if (dataType === 'Boolean') return 'center';
  return 'left';
}

export class Column<T = Record<string, unknown>> {
  readonly binding: string;
  readonly header: string;
  width: number;
  editable: boolean;
  readonly dataType: DataType;
  readonly align: CellAlign;

  private readonly valueGetter?: (item: T) => unknown;
  private readonly valueFormatter?: (value: unknown, item: T) => string;

  constructor(def: ColumnDef<T>) {
    this.binding = def.binding;
    this.header = def.header ?? def.binding;
    this.width = def.width ?? DEFAULT_WIDTH;
    this.editable = def.editable ?? false;
    this.dataType = def.dataType ?? 'String';
    this.align = def.align ?? defaultAlign(this.dataType);
    this.valueGetter = def.valueGetter;
    this.valueFormatter = def.valueFormatter;
  }

  getValue(item: T): unknown {
    if (this.valueGetter) return this.valueGetter(item);
    return (item as Record<string, unknown>)[this.binding];
  }

  setValue(item: T, value: unknown): void {
    (item as Record<string, unknown>)[this.binding] = value;
  }

  /** Turn editor text into a typed value matching the column's dataType. */
  parse(text: string): unknown {
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
    if (value == null) return '';
    if (this.dataType === 'Boolean') return ''; // rendered as a checkbox
    if (this.dataType === 'Date' && value instanceof Date) return value.toLocaleDateString();
    return String(value);
  }
}
