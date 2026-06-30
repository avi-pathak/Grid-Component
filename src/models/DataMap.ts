import { CollectionView } from '../data/CollectionView';
import { EventBus, EventHandler } from '../events/EventBus';

interface DataMapEvents {
  mapChanged: void;
}

/** Compare keys by string form, so 123 (number) and '123' (string) match. */
function sameKey(a: unknown, b: unknown): boolean {
  return String(a) === String(b);
}

/**
 * Maps stored key values to display values for a column, so the grid can show a
 * friendly label (a country name) while the cell holds a raw value (a code).
 * Build it from a plain array of strings, an array of objects plus value/display
 * paths, or a {@link CollectionView}.
 */
export class DataMap {
  readonly collectionView: CollectionView;
  selectedValuePath: string;
  displayMemberPath: string;
  /** Allow values that are not on the map (free text). Default false. */
  isEditable = false;
  /** Order the lookup list by display value. Default true. */
  sortByDisplayValues = true;
  /**
   * Optional hook for dynamic data maps: given the row being edited, return the
   * subset of source items allowed for it. Lets one column's choices depend on
   * another (e.g. cities filtered by the row's country).
   */
  itemsFilter?: (dataItem: unknown) => unknown[];

  private events = new EventBus<DataMapEvents>();

  constructor(
    itemsSource: unknown[] | CollectionView,
    selectedValuePath = '',
    displayMemberPath = '',
  ) {
    this.collectionView =
      itemsSource instanceof CollectionView
        ? itemsSource
        : new CollectionView(itemsSource as Record<string, unknown>[]);
    this.selectedValuePath = selectedValuePath;
    this.displayMemberPath = displayMemberPath || selectedValuePath;
    this.collectionView.on('collectionChanged', () => this.onMapChanged());
  }

  on(type: 'mapChanged', handler: EventHandler<void>): () => void {
    return this.events.on(type, handler);
  }

  onMapChanged(): void {
    this.events.emit('mapChanged', undefined);
  }

  /** All keys, ordered by display value when sortByDisplayValues is on. */
  getKeyValues(dataItem?: unknown): unknown[] {
    return this.ordered(dataItem).map((item) => this.keyOf(item));
  }

  /** All display values, in the same order as getKeyValues. */
  getDisplayValues(dataItem?: unknown): string[] {
    return this.ordered(dataItem).map((item) => this.displayOf(item));
  }

  getDisplayValue(key: unknown): string {
    const item = this.items.find((i) => sameKey(this.keyOf(i), key));
    return item !== undefined ? this.displayOf(item) : '';
  }

  getKeyValue(displayValue: string): unknown {
    const item = this.items.find((i) => this.displayOf(i) === displayValue);
    return item !== undefined ? this.keyOf(item) : null;
  }

  getDataItem(key: unknown): unknown {
    return this.items.find((i) => sameKey(this.keyOf(i), key)) ?? null;
  }

  private get items(): unknown[] {
    return this.collectionView.items;
  }

  // The candidate items for a row: the filtered subset for dynamic maps, else all.
  private itemsFor(dataItem?: unknown): unknown[] {
    if (this.itemsFilter && dataItem !== undefined) return this.itemsFilter(dataItem);
    return this.items;
  }

  private keyOf(item: unknown): unknown {
    return this.selectedValuePath
      ? (item as Record<string, unknown>)[this.selectedValuePath]
      : item;
  }

  private displayOf(item: unknown): string {
    const value = this.displayMemberPath
      ? (item as Record<string, unknown>)[this.displayMemberPath]
      : item;
    return value == null ? '' : String(value);
  }

  private ordered(dataItem?: unknown): unknown[] {
    const items = this.itemsFor(dataItem).slice();
    if (this.sortByDisplayValues) {
      items.sort((a, b) => this.displayOf(a).localeCompare(this.displayOf(b)));
    }
    return items;
  }
}
