/**
 * Renders on scroll. Browsers already fire `scroll` at most once per frame, so
 * we render synchronously in the handler instead of deferring to the next
 * animation frame — deferring leaves one blank frame on a fast drag, where the
 * canvas has already scrolled but the new rows haven't been painted yet.
 */
export class ScrollManager {
  private readonly onScroll = (): void => {
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
  }
}
