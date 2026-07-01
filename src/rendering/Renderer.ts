import { RenderContext } from './RenderContext';
import { ViewportRenderer } from './ViewportRenderer';
import { RowRenderer } from './RowRenderer';
import { HeaderRenderer } from './HeaderRenderer';
import { RowHeaderRenderer } from './RowHeaderRenderer';

/** Runs one render pass: headers, then body rows. */
export class Renderer {
  constructor(
    private viewport: ViewportRenderer,
    private rows: RowRenderer,
    private header: HeaderRenderer,
    private rowHeader: RowHeaderRenderer,
    private showRowHeader: boolean,
  ) {}

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
  }
}
