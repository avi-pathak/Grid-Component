import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScrollManager } from './ScrollManager';

describe('ScrollManager', () => {
  let frames: Array<() => void>;

  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(() => cb(0));
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flushFrame() {
    const pending = frames;
    frames = [];
    pending.forEach((fn) => fn());
  }

  it('collapses a burst of scrolls into one tick per frame', () => {
    const scroller = document.createElement('div');
    const tick = vi.fn();
    const sm = new ScrollManager(scroller, tick);

    scroller.dispatchEvent(new Event('scroll'));
    scroller.dispatchEvent(new Event('scroll'));
    scroller.dispatchEvent(new Event('scroll'));
    expect(tick).not.toHaveBeenCalled();

    flushFrame();
    expect(tick).toHaveBeenCalledTimes(1);

    scroller.dispatchEvent(new Event('scroll'));
    flushFrame();
    expect(tick).toHaveBeenCalledTimes(2);

    sm.dispose();
  });

  it('stops ticking after dispose', () => {
    const scroller = document.createElement('div');
    const tick = vi.fn();
    const sm = new ScrollManager(scroller, tick);

    sm.dispose();
    scroller.dispatchEvent(new Event('scroll'));
    flushFrame();
    expect(tick).not.toHaveBeenCalled();
  });
});
