import { describe, it, expect, vi } from 'vitest';
import { ScrollManager } from './ScrollManager';

describe('ScrollManager', () => {
  it('renders synchronously on each scroll event', () => {
    const scroller = document.createElement('div');
    const tick = vi.fn();
    const sm = new ScrollManager(scroller, tick);

    scroller.dispatchEvent(new Event('scroll'));
    expect(tick).toHaveBeenCalledTimes(1);

    scroller.dispatchEvent(new Event('scroll'));
    expect(tick).toHaveBeenCalledTimes(2);

    sm.dispose();
  });

  it('stops ticking after dispose', () => {
    const scroller = document.createElement('div');
    const tick = vi.fn();
    const sm = new ScrollManager(scroller, tick);

    sm.dispose();
    scroller.dispatchEvent(new Event('scroll'));
    expect(tick).not.toHaveBeenCalled();
  });
});
