import { describe, it, expect, beforeEach } from 'vitest';
import { Renderer } from './Renderer';
import { ViewportRenderer } from './ViewportRenderer';
import { RowRenderer } from './RowRenderer';
import { HeaderRenderer } from './HeaderRenderer';
import { RowHeaderRenderer } from './RowHeaderRenderer';
import { CellRenderer } from './CellRenderer';
import { RenderContext } from './RenderContext';
import { GridState } from '../core/GridState';
import { GridViewport } from '../core/GridViewport';
import { LayoutEngine } from '../virtualization/LayoutEngine';
import { DataView } from '../data/DataView';
import { Column } from '../models/Column';

const columns = [
  new Column({ binding: 'id', header: 'ID', width: 80 }),
  new Column({ binding: 'country', header: 'Country', width: 120 }),
  new Column({ binding: 'sales', header: 'Sales', width: 100 }),
];

function makeData(n: number) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push({ id: i, country: 'UK', sales: i * 2 });
  return new DataView(rows);
}

function setup(rowCount: number) {
  const host = document.createElement('div');
  document.body.appendChild(host);

  const data = makeData(rowCount);
  const layout = new LayoutEngine(data.length, 24, columns);
  const state = new GridState();

  const vr = new ViewportRenderer(host, {
    showColumnHeader: true,
    showRowHeader: true,
    headerHeight: 28,
    rowHeaderWidth: 48,
  });
  const rows = new RowRenderer(vr.cells, new CellRenderer());
  const header = new HeaderRenderer(vr.headerInner);
  const rowHeader = new RowHeaderRenderer(vr.rowHeaderInner);
  const renderer = new Renderer(vr, rows, header, rowHeader, true);

  const viewport = new GridViewport(state, layout);
  viewport.setSize(300, 480);

  const ctx: RenderContext = { layout, columns, data, state };
  renderer.resize(ctx);

  return { host, renderer, viewport, ctx };
}

describe('Renderer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders row headers and pins them with a single scroller', () => {
    const { host, renderer, viewport, ctx } = setup(100_000);
    viewport.update(24 * 1000, 0); // scroll to row 1000
    renderer.render(ctx);

    // The pinned corner counter-translates by the scroll so it stays in place.
    const corner = host.querySelector('.apg-corner') as HTMLElement;
    expect(corner.style.transform).toBe('translate3d(0px, 24000px, 0)');

    const nums = [...host.querySelectorAll('.apg-rowheader-cell')].map((c) =>
      Number(c.textContent),
    );
    // row index 1000 shows as "1001" (1-based)
    expect(nums).toContain(1001);
    expect(host.querySelectorAll('.apg-rowheader-cell').length).toBeLessThan(30);
  });

  it('renders only the visible window plus a buffer', () => {
    const { host, renderer, viewport, ctx } = setup(100_000);
    viewport.update(0, 0);
    renderer.render(ctx);

    // 480 / 24 = 20 visible rows, +3 buffer each side, clamped at the top
    const rowEls = host.querySelectorAll('.apg-row').length;
    expect(rowEls).toBeGreaterThan(20);
    expect(rowEls).toBeLessThan(30);

    // cells = rows * visible columns (all 3 fit in 300px)
    expect(host.querySelectorAll('.apg-cell').length).toBe(rowEls * columns.length);
  });

  it('keeps the DOM bounded after scrolling far down', () => {
    const { host, renderer, viewport, ctx } = setup(1_000_000);

    viewport.update(0, 0);
    renderer.render(ctx);
    const initial = host.querySelectorAll('.apg-row').length;

    viewport.update(24 * 500_000, 0); // jump to the middle
    renderer.render(ctx);
    const afterScroll = host.querySelectorAll('.apg-row').length;

    // Jumping 500k rows must not grow the DOM; it stays at the visible window.
    expect(afterScroll).toBeGreaterThanOrEqual(initial);
    expect(afterScroll).toBeLessThan(30);
  });

  it('fills cells with formatted values', () => {
    const { host, renderer, viewport, ctx } = setup(100);
    viewport.update(0, 0);
    renderer.render(ctx);

    const headers = [...host.querySelectorAll('.apg-header-cell')].map((el) => el.textContent);
    expect(headers).toContain('Country');

    const firstCell = host.querySelector('.apg-cell');
    expect(firstCell?.textContent).toBe('0');
  });

  it('reuses pooled rows instead of creating new DOM each scroll', () => {
    const { host, renderer, viewport, ctx } = setup(10_000);

    let created = 0;
    const realCreate = document.createElement.bind(document);
    document.createElement = ((tag: string) => {
      if (tag === 'div') created++;
      return realCreate(tag);
    }) as typeof document.createElement;

    try {
      viewport.update(0, 0);
      renderer.render(ctx);
      const afterFirst = created;

      for (let top = 0; top < 24 * 200; top += 24) {
        viewport.update(top, 0);
        renderer.render(ctx);
      }
      // Scrolling 200 rows must not allocate 200 rows worth of DOM.
      expect(created - afterFirst).toBeLessThan(afterFirst);
    } finally {
      document.createElement = realCreate;
    }

    expect(host.querySelectorAll('.apg-row').length).toBeLessThan(30);
  });
});
