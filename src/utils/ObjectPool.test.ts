import { describe, it, expect } from 'vitest';
import { ObjectPool } from './ObjectPool';

describe('ObjectPool', () => {
  it('reuses released items', () => {
    let created = 0;
    const pool = new ObjectPool(() => ({ id: created++ }));
    const a = pool.acquire();
    pool.release(a);
    const b = pool.acquire();
    expect(b).toBe(a);
    expect(created).toBe(1);
  });

  it('creates new items when none are free', () => {
    let created = 0;
    const pool = new ObjectPool(() => ({ id: created++ }));
    pool.acquire();
    pool.acquire();
    expect(created).toBe(2);
  });

  it('runs reset on release', () => {
    const pool = new ObjectPool(
      () => ({ dirty: true }),
      (item) => {
        item.dirty = false;
      },
    );
    const a = pool.acquire();
    a.dirty = true;
    pool.release(a);
    expect(a.dirty).toBe(false);
  });
});
