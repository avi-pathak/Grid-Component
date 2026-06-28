import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './EventBus';

interface Events {
  hello: string;
  count: number;
}

describe('EventBus', () => {
  it('delivers payloads to handlers', () => {
    const bus = new EventBus<Events>();
    const seen: string[] = [];
    bus.on('hello', (msg) => seen.push(msg));
    bus.emit('hello', 'world');
    expect(seen).toEqual(['world']);
  });

  it('only calls handlers for the matching event', () => {
    const bus = new EventBus<Events>();
    const hello = vi.fn();
    const count = vi.fn();
    bus.on('hello', hello);
    bus.on('count', count);
    bus.emit('count', 5);
    expect(hello).not.toHaveBeenCalled();
    expect(count).toHaveBeenCalledWith(5);
  });

  it('stops calling a handler after unsubscribe', () => {
    const bus = new EventBus<Events>();
    const handler = vi.fn();
    const off = bus.on('hello', handler);
    off();
    bus.emit('hello', 'x');
    expect(handler).not.toHaveBeenCalled();
  });
});
