import { CollectionView } from './CollectionView';

/**
 * Read-only window over the grid's items. Everything reads rows through this
 * class instead of touching the source array. It is backed by a
 * {@link CollectionView}, so edits routed through {@link applyEdit} are tracked
 * when the view has trackChanges enabled.
 */
export class DataView<T = Record<string, unknown>> {
  private view: CollectionView<T>;

  constructor(source: T[] | CollectionView<T> = []) {
    this.view = source instanceof CollectionView ? source : new CollectionView<T>(source);
  }

  get collectionView(): CollectionView<T> {
    return this.view;
  }

  get length(): number {
    return this.view.items.length;
  }

  item(index: number): T {
    return this.view.items[index];
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
