import { Column } from '../models/Column';
import { ColumnFilter, filterKey } from '../models/ColumnFilter';
import { CollectionView } from './CollectionView';

/**
 * Owns a {@link ColumnFilter} per column binding and composes the active ones
 * into a single predicate installed on the collection view. Column filtering
 * therefore owns `CollectionView.filter` while it's in use.
 */
export class FilterModel<T = Record<string, unknown>> {
  private filters = new Map<string, ColumnFilter<T>>();

  constructor(private view: CollectionView<T>) {}

  /** The filter for a column, created on first access. */
  get(column: Column<T>): ColumnFilter<T> {
    let f = this.filters.get(column.binding);
    if (!f) {
      f = new ColumnFilter<T>(column);
      this.filters.set(column.binding, f);
    }
    return f;
  }

  isActive(binding: string): boolean {
    return this.filters.get(binding)?.isActive ?? false;
  }

  get hasAny(): boolean {
    for (const f of this.filters.values()) if (f.isActive) return true;
    return false;
  }

  /**
   * Distinct display values to offer for a column. Reflects the other active
   * column filters (like a spreadsheet) but ignores this column's own filter, so
   * its list doesn't collapse to just the values already selected.
   */
  distinctValues(column: Column<T>): string[] {
    const others = [...this.filters.values()].filter(
      (f) => f.isActive && f.column.binding !== column.binding,
    );
    const seen = new Set<string>();
    for (const item of this.view.sourceCollection) {
      if (others.every((f) => f.test(item))) seen.add(filterKey(column, item));
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }

  /** Recompose the active filters and install (or clear) the view predicate. */
  apply(): void {
    const active = [...this.filters.values()].filter((f) => f.isActive);
    this.view.filter = active.length ? (item) => active.every((f) => f.test(item)) : null;
  }

  clearAll(): void {
    for (const f of this.filters.values()) f.clear();
    this.apply();
  }
}
