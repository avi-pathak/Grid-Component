import { RenderContext } from './RenderContext';
import { ViewportRenderer } from './ViewportRenderer';
import { RowRenderer } from './RowRenderer';
import { HeaderRenderer } from './HeaderRenderer';
import { RowHeaderRenderer } from './RowHeaderRenderer';
import { FrozenRenderer } from './FrozenRenderer';

/** Runs one render pass: headers, then body rows, then the pinned bands. */
export class Renderer {
  private frozen: FrozenRenderer;

  constructor(
    private viewport: ViewportRenderer,
    private rows: RowRenderer,
    private header: HeaderRenderer,
    private rowHeader: RowHeaderRenderer,
    private showRowHeader: boolean,
  ) {
    this.frozen = new FrozenRenderer(viewport);
  }

  /** Resize the scroll canvas to the current totals. Call when layout changes. */
  resize(ctx: RenderContext): void {
    this.viewport.resize(ctx.layout.totalWidth, ctx.layout.totalHeight);
  }

  render(ctx: RenderContext): void {
    this.header.render(ctx);
    this.rows.render(ctx);
    if (this.showRowHeader) {
      this.rowHeader.render(ctx);
    }
    this.frozen.render(ctx);
  }
}
