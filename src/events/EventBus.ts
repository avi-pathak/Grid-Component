export type EventHandler<T> = (payload: T) => void;

/**
 * Minimal typed pub/sub. `Events` maps an event name to its payload type, so
 * `on`/`emit` are checked against the same shape. Replaces the old stringly-typed
 * event bus.
 */
export class EventBus<Events> {
  private handlers = new Map<keyof Events, Set<EventHandler<unknown>>>();

  on<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as EventHandler<unknown>);
    return () => {
      this.handlers.get(type)?.delete(handler as EventHandler<unknown>);
    };
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of set) (handler as EventHandler<Events[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
