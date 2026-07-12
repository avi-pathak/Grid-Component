import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { demos } from './index';

// Mount every registered demo and confirm it builds a grid and cleans up. This
// guards against a change in the library breaking any feature demo (the demos
// exercise sorting, grouping, filtering, freezing, merging, editing, etc.).
describe('demos', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
    // A couple of demos reach out to a network service; keep them offline.
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(''),
        } as unknown as Response),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers demos with unique ids', () => {
    expect(demos.length).toBeGreaterThan(0);
    const ids = demos.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const demo of demos) {
    it(`mounts and disposes "${demo.id}"`, () => {
      // Demos that poll on a timer keep their intervals; cleanup() clears them
      // right away, so nothing fires during the test.
      const cleanup = demo.mount(host);

      // A grid (or its toolbar + grid host) landed in the demo container.
      expect(host.querySelector('.apg, .apg-demo-grid')).not.toBeNull();

      expect(() => cleanup()).not.toThrow();
    });
  }
});
