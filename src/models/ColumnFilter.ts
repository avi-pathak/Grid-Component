import { Column } from './Column';

export type FilterOperator =
  | 'contains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'empty'
  | 'notEmpty'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

export interface FilterCondition {
  op: FilterOperator;
  value: string;
}

export interface OperatorChoice {
  op: FilterOperator;
  label: string;
}

export const TEXT_OPERATORS: OperatorChoice[] = [
  { op: 'contains', label: 'Contains' },
  { op: 'equals', label: 'Equals' },
  { op: 'notEquals', label: 'Does not equal' },
  { op: 'startsWith', label: 'Starts with' },
  { op: 'endsWith', label: 'Ends with' },
  { op: 'empty', label: 'Is empty' },
  { op: 'notEmpty', label: 'Is not empty' },
];

export const NUMBER_OPERATORS: OperatorChoice[] = [
  { op: 'equals', label: '=' },
  { op: 'notEquals', label: '≠' },
  { op: 'gt', label: '>' },
  { op: 'gte', label: '≥' },
  { op: 'lt', label: '<' },
  { op: 'lte', label: '≤' },
];

/** The operator choices to offer for a column, based on its data type. */
export function operatorsFor<T>(column: Column<T>): OperatorChoice[] {
  return column.dataType === 'Number' || column.dataType === 'Date'
    ? NUMBER_OPERATORS
    : TEXT_OPERATORS;
}

/** Canonical string used both to list distinct values and to match the value set. */
export function filterKey<T>(column: Column<T>, item: T): string {
  const raw = column.getValue(item);
  if (column.dataType === 'Boolean') return raw === true ? 'True' : 'False';
  return column.formatValue(raw, item);
}

/**
 * Holds the filter state for one column: a set of selected display values (null
 * means "all", i.e. no value filter) and an optional operator/value condition.
 * A row passes only when it satisfies both parts.
 */
export class ColumnFilter<T = Record<string, unknown>> {
  values: Set<string> | null = null;
  condition: FilterCondition | null = null;

  constructor(readonly column: Column<T>) {}

  get isActive(): boolean {
    return this.values != null || this.condition != null;
  }

  clear(): void {
    this.values = null;
    this.condition = null;
  }

  test(item: T): boolean {
    if (this.values && !this.values.has(filterKey(this.column, item))) return false;
    if (this.condition) {
      const raw = this.column.getValue(item);
      const display = this.column.formatValue(raw, item);
      if (!testCondition(this.column, raw, display, this.condition)) return false;
    }
    return true;
  }
}

function testCondition<T>(
  column: Column<T>,
  raw: unknown,
  display: string,
  cond: FilterCondition,
): boolean {
  const { op } = cond;
  if (op === 'empty') return raw == null || display === '';
  if (op === 'notEmpty') return !(raw == null || display === '');

  if (column.dataType === 'Number' || column.dataType === 'Date') {
    const a = toNumber(raw);
    const b = column.dataType === 'Date' ? Date.parse(cond.value) : Number(cond.value);
    if (a == null || Number.isNaN(b)) return true; // no usable bound → don't constrain
    switch (op) {
      case 'equals':
        return a === b;
      case 'notEquals':
        return a !== b;
      case 'gt':
        return a > b;
      case 'gte':
        return a >= b;
      case 'lt':
        return a < b;
      case 'lte':
        return a <= b;
      default:
        return true;
    }
  }

  const needle = cond.value.toLowerCase();
  if (needle === '') return true;
  const hay = display.toLowerCase();
  switch (op) {
    case 'contains':
      return hay.includes(needle);
    case 'equals':
      return hay === needle;
    case 'notEquals':
      return hay !== needle;
    case 'startsWith':
      return hay.startsWith(needle);
    case 'endsWith':
      return hay.endsWith(needle);
    default:
      return true;
  }
}

function toNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return raw.getTime();
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}
