import { Grid } from '../../src';
import { makeSales, SalesRow } from '../data';
import { Demo } from './types';

const money = (v: unknown): string => (v == null ? '' : `$${Number(v).toLocaleString()}`);

export const grouping: Demo = {
  id: 'grouping',
  title: 'Grouping',
  tagline:
    'Drag a column header into the bar to group. Group rows show item counts and column totals.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const collapseBtn = button('Collapse all');
    const expandBtn = button('Expand all');
    const clearBtn = button('Clear grouping');
    const readout = document.createElement('span');
    readout.className = 'apg-demo-readout';
    toolbar.append(collapseBtn, expandBtn, clearBtn, readout);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      groupPanel: true,
      columns: [
        { binding: 'id', header: 'ID', width: 60, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 130 },
        { binding: 'country', header: 'Country', width: 130 },
        {
          binding: 'sales',
          header: 'Sales',
          width: 130,
          dataType: 'Number',
          aggregate: 'sum',
          valueFormatter: money,
        },
        {
          binding: 'expenses',
          header: 'Expenses',
          width: 130,
          dataType: 'Number',
          aggregate: 'sum',
          valueFormatter: money,
        },
        { binding: 'active', header: 'Active', width: 80, dataType: 'Boolean' },
        { binding: 'joined', header: 'Joined', width: 120, dataType: 'Date' },
      ],
      itemsSource: makeSales(1000),
      // Customize the group-header label: name, a count badge, and the group's
      // total sales — like a group cell renderer in other grids.
      groupHeaderTemplate: ({ group, itemCount }) => {
        const total = (group.items as SalesRow[]).reduce((sum, r) => sum + r.sales, 0);
        return (
          `<span class="apg-group-name">${group.name}</span>` +
          `<span class="apg-group-count">${itemCount}</span>` +
          `<span class="demo-group-total">${money(total)} total sales</span>`
        );
      },
    });

    grid.groupBy('country', 'product');

    const update = (): void => {
      const groups = grid.groupDescriptions.map((g) => g.property);
      readout.textContent = groups.length
        ? `Grouped by ${groups.join(' \u203a ')}`
        : 'Not grouped — drag a column header into the bar';
    };
    const off = grid.on('groupsChanged', update);
    update();

    collapseBtn.addEventListener('click', () => grid.collapseAllGroups());
    expandBtn.addEventListener('click', () => grid.expandAllGroups());
    clearBtn.addEventListener('click', () => grid.clearGroups());

    return () => {
      off();
      grid.dispose();
      toolbar.remove();
      gridHost.remove();
    };
  },
};

function button(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'apg-demo-btn';
  b.textContent = text;
  return b;
}
