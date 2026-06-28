/**
 * A simple reuse pool. The renderer pulls row/cell elements from here while
 * scrolling instead of creating new DOM, and returns them when they leave the
 * viewport. `reset` runs on release so recycled items come back clean.
 */
export class ObjectPool<T> {
  private free: T[] = [];

  constructor(
    private readonly create: () => T,
    private readonly reset?: (item: T) => void,
  ) {}

  acquire(): T {
    return this.free.pop() ?? this.create();
  }

  release(item: T): void {
    this.reset?.(item);
    this.free.push(item);
  }

  get available(): number {
    return this.free.length;
  }
}
