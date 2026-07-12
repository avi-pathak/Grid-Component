/**
 * Renders on scroll. Browsers fire `scroll` at most once per frame, so we render
 * synchronously in the handler instead of deferring to the next animation frame —
 * deferring leaves a blank frame on a fast drag, where the viewport has already
 * moved but the rows for the new position haven't been placed yet.
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
