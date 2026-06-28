export interface ColumnDef<T = Record<string, unknown>> {
  binding: string;
  header?: string;
  width?: number;
  editable?: boolean;
  valueGetter?: (item: T) => unknown;
  valueFormatter?: (value: unknown, item: T) => string;
}

const DEFAULT_WIDTH = 100;

export class Column<T = Record<string, unknown>> {
  readonly binding: string;
  readonly header: string;
  width: number;
  editable: boolean;

  private readonly valueGetter?: (item: T) => unknown;
  private readonly valueFormatter?: (value: unknown, item: T) => string;

  constructor(def: ColumnDef<T>) {
    this.binding = def.binding;
    this.header = def.header ?? def.binding;
    this.width = def.width ?? DEFAULT_WIDTH;
    this.editable = def.editable ?? false;
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

  format(item: T): string {
    const value = this.getValue(item);
    if (this.valueFormatter) return this.valueFormatter(value, item);
    return value == null ? '' : String(value);
  }
}
