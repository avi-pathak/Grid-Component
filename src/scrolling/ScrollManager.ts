/**
 * Coalesces native scroll events into a single callback per animation frame.
 * A fast scroll fires many `scroll` events; we only want to re-render once per
 * frame, reading the latest scroll position inside the rAF callback.
 */
export class ScrollManager {
  private frame = 0;

  private readonly onScroll = (): void => {
    if (this.frame) return;
    this.frame = requestAnimationFrame(this.run);
  };

  private readonly run = (): void => {
    this.frame = 0;
    this.tick();
  };

  constructor(
    private scroller: HTMLElement,
    private tick: () => void,
  ) {
    this.scroller.addEventListener('scroll', this.onScroll, { passive: true });
  }

  dispose(): void {
    this.scroller.removeEventListener('scroll', this.onScroll);
    if (this.frame) cancelAnimationFrame(this.frame);
  }
}
