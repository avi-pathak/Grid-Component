import { EventBus, EventHandler } from '../events/EventBus';

export type ChangeAction = 'add' | 'remove' | 'change' | 'reset';

export interface CollectionChange<T> {
  action: ChangeAction;
  item?: T;
  index?: number;
}

interface CollectionViewEvents<T> {
  collectionChanged: CollectionChange<T>;
  currentChanged: void;
}

export interface CollectionViewOptions<T> {
  trackChanges?: boolean;
  newItemCreator?: () => T;
}

/**
 * Exposes a plain array as an editable view and, when {@link trackChanges} is on,
 * records which items were added, removed, or edited so callers can sync a server.
 * Modeled on Wijmo's CollectionView, scoped to current-item navigation and change
 * tracking (no sorting/filtering/paging yet — the view mirrors the source order).
 */
export class CollectionView<T = Record<string, unknown>> {
  /** Items added since tracking was enabled (via addNew/commitNew). */
  readonly itemsAdded: T[] = [];
  /** Items removed since tracking was enabled (via remove/removeAt). */
  readonly itemsRemoved: T[] = [];
  /** Items edited since tracking was enabled (via editItem/commitEdit). */
  readonly itemsEdited: T[] = [];

  newItemCreator?: () => T;

  private source: T[];
  private view: T[] = [];
  private events = new EventBus<CollectionViewEvents<T>>();
  private _trackChanges: boolean;
  private _position = -1;

  private editTarget: T | null = null;
  private editSnapshot: Record<string, unknown> | null = null;
  private addTarget: T | null = null;

  private updateDepth = 0;
  private refreshPending = false;

  constructor(source: T[] = [], options: CollectionViewOptions<T> = {}) {
    this.source = source;
    this._trackChanges = options.trackChanges ?? false;
    this.newItemCreator = options.newItemCreator;
    this.refresh();
  }

  on<K extends keyof CollectionViewEvents<T>>(
    type: K,
    handler: EventHandler<CollectionViewEvents<T>[K]>,
  ): () => void {
    return this.events.on(type, handler);
  }

  /** The items in view order. Holds the same object references as the source. */
  get items(): T[] {
    return this.view;
  }

  get sourceCollection(): T[] {
    return this.source;
  }

  set sourceCollection(value: T[]) {
    this.source = value ?? [];
    this.clearChanges();
    this.refresh();
  }

  get trackChanges(): boolean {
    return this._trackChanges;
  }

  set trackChanges(value: boolean) {
    this._trackChanges = value;
  }

  get isEmpty(): boolean {
    return this.view.length === 0;
  }

  get itemCount(): number {
    return this.view.length;
  }

  get currentItem(): T | null {
    return this._position >= 0 && this._position < this.view.length
      ? this.view[this._position]
      : null;
  }

  get currentPosition(): number {
    return this._position;
  }

  get isAddingNew(): boolean {
    return this.addTarget != null;
  }

  get isEditingItem(): boolean {
    return this.editTarget != null;
  }

  get currentAddItem(): T | null {
    return this.addTarget;
  }

  get currentEditItem(): T | null {
    return this.editTarget;
  }

  contains(item: T): boolean {
    return this.view.indexOf(item) >= 0;
  }

  moveCurrentToPosition(index: number): boolean {
    if (index >= -1 && index < this.view.length && index !== this._position) {
      this._position = index;
      this.events.emit('currentChanged', undefined);
    }
    return true;
  }

  moveCurrentToFirst(): boolean {
    return this.moveCurrentToPosition(this.view.length ? 0 : -1);
  }

  moveCurrentToLast(): boolean {
    return this.moveCurrentToPosition(this.view.length - 1);
  }

  moveCurrentToNext(): boolean {
    return this._position < this.view.length - 1 && this.moveCurrentToPosition(this._position + 1);
  }

  moveCurrentToPrevious(): boolean {
    return this._position > 0 && this.moveCurrentToPosition(this._position - 1);
  }

  moveCurrentTo(item: T): boolean {
    return this.moveCurrentToPosition(this.view.indexOf(item));
  }

  /** Begin an edit transaction. Snapshots the item so cancelEdit can restore it. */
  editItem(item: T): void {
    if (this.editTarget === item) return;
    if (this.editTarget) this.commitEdit();
    this.editTarget = item;
    this.editSnapshot = { ...(item as Record<string, unknown>) };
  }

  commitEdit(): void {
    const item = this.editTarget;
    if (!item) return;
    this.editTarget = null;
    this.editSnapshot = null;
    if (this._trackChanges) this.trackEdit(item);
    this.onChanged('change', item, this.view.indexOf(item));
  }

  cancelEdit(): void {
    const item = this.editTarget;
    if (!item) return;
    if (this.editSnapshot) Object.assign(item as Record<string, unknown>, this.editSnapshot);
    this.editTarget = null;
    this.editSnapshot = null;
    this.onChanged('change', item, this.view.indexOf(item));
  }

  /** Add an item to the collection. Defers tracking until commitNew unless commit is true. */
  addNew(item?: T, commit = false): T {
    const created = item ?? (this.newItemCreator ? this.newItemCreator() : ({} as T));
    this.source.push(created);
    this.addTarget = created;
    this.refresh();
    this._position = this.view.indexOf(created);
    if (commit) this.commitNew();
    return created;
  }

  commitNew(): void {
    const item = this.addTarget;
    if (!item) return;
    this.addTarget = null;
    if (this._trackChanges && this.itemsAdded.indexOf(item) < 0) this.itemsAdded.push(item);
    this.onChanged('add', item, this.view.indexOf(item));
  }

  cancelNew(): void {
    const item = this.addTarget;
    if (!item) return;
    this.addTarget = null;
    const i = this.source.indexOf(item);
    if (i >= 0) this.source.splice(i, 1);
    this.refresh();
    this.onChanged('remove', item);
  }

  remove(item: T): void {
    if (this.addTarget === item) {
      this.cancelNew();
      return;
    }
    const i = this.source.indexOf(item);
    if (i < 0) return;
    this.source.splice(i, 1);
    if (this._trackChanges) this.trackRemove(item);
    this.refresh();
    this.onChanged('remove', item, i);
  }

  removeAt(index: number): void {
    const item = this.view[index];
    if (item != null) this.remove(item);
  }

  /** Drop all tracked changes. Call after pushing them to a server. */
  clearChanges(): void {
    this.itemsAdded.length = 0;
    this.itemsRemoved.length = 0;
    this.itemsEdited.length = 0;
  }

  beginUpdate(): void {
    this.updateDepth++;
  }

  endUpdate(): void {
    if (this.updateDepth > 0) this.updateDepth--;
    if (this.updateDepth === 0 && this.refreshPending) {
      this.refreshPending = false;
      this.refresh();
    }
  }

  get isUpdating(): boolean {
    return this.updateDepth > 0;
  }

  deferUpdate(fn: () => void): void {
    this.beginUpdate();
    try {
      fn();
    } finally {
      this.endUpdate();
    }
  }

  refresh(): void {
    if (this.updateDepth > 0) {
      this.refreshPending = true;
      return;
    }
    this.view = this.source.slice();
    if (this._position >= this.view.length) this._position = this.view.length - 1;
    this.onChanged('reset');
  }

  private trackEdit(item: T): void {
    if (this.itemsAdded.indexOf(item) >= 0) return; // new items count as added, not edited
    if (this.itemsEdited.indexOf(item) < 0) this.itemsEdited.push(item);
  }

  private trackRemove(item: T): void {
    const added = this.itemsAdded.indexOf(item);
    if (added >= 0) {
      this.itemsAdded.splice(added, 1);
      return; // added then removed in the same session: a no-op for the server
    }
    const edited = this.itemsEdited.indexOf(item);
    if (edited >= 0) this.itemsEdited.splice(edited, 1);
    if (this.itemsRemoved.indexOf(item) < 0) this.itemsRemoved.push(item);
  }

  private onChanged(action: ChangeAction, item?: T, index?: number): void {
    if (this.updateDepth > 0) return;
    this.events.emit('collectionChanged', { action, item, index });
  }
}
