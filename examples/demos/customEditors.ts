import { Grid, CellEditor, Column } from '@avi-pathak/apgrid';
import { Demo } from './types';

// Grid/Column operate on plain Record<string, unknown> items — a custom
// editor implements the default (untyped) CellEditor and casts internally,
// the same way the other demos cast inside valueGetter/cellClass callbacks.

interface ProductRow {
  id: number;
  product: string;
  rating: number;
  [key: string]: unknown;
}

function makeProducts(count: number): ProductRow[] {
  const names = 'Widget,Gadget,Gizmo,Sprocket,Cog,Lever,Spring,Bolt'.split(',');
  const rows: ProductRow[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({ id: i + 1, product: names[i % names.length], rating: 1 + (i % 5) });
  }
  return rows;
}

// A fully custom editor: five clickable stars instead of a text input. It
// only needs open()/close() (the CellEditor contract) plus the commit/cancel
// callbacks its factory receives — the same callbacks TextEditor/DropDownEditor
// get, so a click here still runs through the grid's own undo stack.
class StarRatingEditor implements CellEditor {
  private root: HTMLElement;
  private stars: HTMLButtonElement[] = [];

  constructor(
    private commit: (value: string) => void,
    cancel: () => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'apg-editor demo-star-editor';
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('button');
      star.type = 'button';
      star.className = 'demo-star-btn';
      star.textContent = '★';
      star.addEventListener('click', () => this.commit(String(i)));
      this.stars.push(star);
      this.root.appendChild(star);
    }
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cancel();
      e.stopPropagation();
    });
    this.root.addEventListener('focusout', (e) => {
      const next = e.relatedTarget as Node | null;
      if (!next || !this.root.contains(next)) cancel();
    });
  }

  open(parent: HTMLElement, _column: Column, item: Record<string, unknown>, rect: DOMRect): void {
    const current = (item as ProductRow).rating;
    this.stars.forEach((star, i) => star.classList.toggle('demo-star-filled', i < current));
    this.root.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    this.root.style.width = `${rect.width}px`;
    this.root.style.height = `${rect.height}px`;
    parent.appendChild(this.root);
    this.stars[current - 1]?.focus();
  }

  close(): void {
    this.root.remove();
  }
}

export const customEditors: Demo = {
  id: 'custom-editors',
  title: 'Custom editors',
  tagline: 'ColumnDef.editor swaps in an app-defined editor — here, a 5-star rating picker.',
  mount(host) {
    const hint = document.createElement('p');
    hint.className = 'apg-demo-readout';
    hint.style.margin = '0 0 12px';
    hint.textContent =
      'Double-click a Rating cell: instead of a text input, a row of stars opens. Clicking ' +
      'one commits through the same undo stack as any other edit (try Ctrl+Z).';
    host.appendChild(hint);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 60, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 160 },
        {
          binding: 'rating',
          header: 'Rating',
          width: 160,
          dataType: 'Number',
          editable: true,
          valueFormatter: (value) => '★'.repeat(Number(value)) + '☆'.repeat(5 - Number(value)),
          editor: (commit, cancel) => new StarRatingEditor(commit, cancel),
        },
      ],
      itemsSource: makeProducts(300),
    });

    return {
      grid,
      dispose: () => {
        grid.dispose();
        hint.remove();
        gridHost.remove();
      },
    };
  },
};
