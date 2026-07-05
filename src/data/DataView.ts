import { CollectionView } from './CollectionView';
import { GroupRowModel, GroupDisplayRow } from './GroupRowModel';

/**
 * Read-only window over the grid's items. Everything reads rows through this
 * class instead of touching the source array. It is backed by a
 * {@link CollectionView}, so edits routed through {@link applyEdit} are tracked
 * when the view has trackChanges enabled.
 *
 * When the view is grouped, the grid renders a flattened list of display rows
 * (group headers interleaved with data rows). This class maps a display-row
 * index to the underlying leaf item and reports which rows are group headers.
 */
export class DataView<T = Record<string, unknown>> {
  private view: CollectionView<T>;
  private groupModel = new GroupRowModel<T>();

  constructor(source: T[] | CollectionView<T> = []) {
    this.view = source instanceof CollectionView ? source : new CollectionView<T>(source);
  }

  get collectionView(): CollectionView<T> {
    return this.view;
  }

  /** Rebuild the display-row list from the view's current group tree. */
  refreshGroups(): void {
    this.groupModel.rebuild(this.view.groups);
  }

  get grouped(): boolean {
    return this.groupModel.active;
  }

  /** Number of rows the grid renders (data rows plus visible group headers). */
  get length(): number {
    return this.grouped ? this.groupModel.length : this.view.items.length;
  }

  /** The leaf item at a display-row index, or undefined for group-header rows. */
  item(index: number): T {
    if (!this.grouped) return this.view.items[index];
    const leaf = this.dataIndexAt(index);
    return leaf >= 0 ? this.view.items[leaf] : (undefined as unknown as T);
  }

  rowType(index: number): 'group' | 'data' {
    if (!this.grouped) return 'data';
    return this.groupModel.rowAt(index)?.kind === 'group' ? 'group' : 'data';
  }

  /** The group-header descriptor at a display-row index, or null for data rows. */
  groupRow(index: number): GroupDisplayRow<T> | null {
    if (!this.grouped) return null;
    const row = this.groupModel.rowAt(index);
    return row && row.kind === 'group' ? row : null;
  }

  /** Map a display-row index to a leaf index in the view, or -1 for group rows. */
  dataIndexAt(index: number): number {
    if (!this.grouped) return index;
    const row = this.groupModel.rowAt(index);
    return row && row.kind === 'data' ? row.viewIndex : -1;
  }

  toggleGroup(pathKey: string): void {
    this.groupModel.toggle(pathKey);
    this.refreshGroups();
  }

  collapseAllGroups(): void {
    this.groupModel.collapseAll();
    this.refreshGroups();
  }

  expandAllGroups(): void {
    this.groupModel.expandAll();
    this.refreshGroups();
  }

  setItems(items: T[]): void {
    this.view.sourceCollection = items;
  }

  /** Run a mutation inside an edit transaction so the change view can record it. */
  applyEdit(item: T, mutate: () => void): void {
    this.view.editItem(item);
    mutate();
    this.view.commitEdit();
  }
}
