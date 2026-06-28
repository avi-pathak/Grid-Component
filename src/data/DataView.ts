/**
 * Read-only window over the grid's items. Everything reads rows through this
 * class instead of touching the source array, so sorting, filtering, or remote
 * data can slot in later without changing the renderer.
 */
export class DataView<T = Record<string, unknown>> {
  private items: T[];

  constructor(items: T[] = []) {
    this.items = items;
  }

  get length(): number {
    return this.items.length;
  }

  item(index: number): T {
    return this.items[index];
  }

  setItems(items: T[]): void {
    this.items = items;
  }
}
