import { Grid } from '@avi-pathak/apgrid';
import { makeSales } from '../data';
import { Demo } from './types';

export const columnGroups: Demo = {
  id: 'columnGroups',
  title: 'Column groups',
  tagline:
    'Group related columns under a spanning header. Click a group header (or its chevron) to collapse the group and hide its columns; use the toolbar to collapse or expand every group at once.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const collapseBtn = button('Collapse all');
    const expandBtn = button('Expand all');
    const readout = document.createElement('span');
    readout.className = 'apg-demo-readout';
    toolbar.append(collapseBtn, expandBtn, readout);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const data = makeSales(5000);
    const columns = [
      { binding: 'id', header: 'ID', width: 70, dataType: 'Number' as const },
      { binding: 'product', header: 'Product', width: 150 },
      { binding: 'country', header: 'Country', width: 150 },
      quarter('Q1', 0.22),
      quarter('Q2', 0.26),
      quarter('Q3', 0.24),
      quarter('Q4', 0.28),
      { binding: 'sales', header: 'Total', width: 120, dataType: 'Number' as const },
      { binding: 'expenses', header: 'Expenses', width: 120, dataType: 'Number' as const },
    ];

    const grid = new Grid(gridHost, {
      columns,
      itemsSource: data,
      columnGroups: [
        { header: 'Quarterly Sales', columns: ['q1', 'q2', 'q3', 'q4'], collapseTo: 'q4' },
        { header: 'Totals', columns: ['sales', 'expenses'], collapseTo: 'sales' },
      ],
    });

    const status = (): void => {
      const collapsed = grid.columnGroups.filter((g) => g.collapsed).map((g) => g.header);
      readout.textContent = collapsed.length
        ? `Collapsed: ${collapsed.join(', ')}`
        : 'All groups expanded';
    };
    status();
    grid.on('columnGroupCollapsedChanged', status);

    collapseBtn.addEventListener('click', () => grid.collapseAllColumnGroups());
    expandBtn.addEventListener('click', () => grid.expandAllColumnGroups());

    return {
      grid,
      dispose: () => {
        grid.dispose();
        toolbar.remove();
        gridHost.remove();
      },
    };
  },
};

function quarter(header: string, share: number) {
  const binding = header.toLowerCase();
  return {
    binding,
    header,
    width: 110,
    dataType: 'Number' as const,
    valueGetter: (item: Record<string, unknown>) => Math.round((item.sales as number) * share),
  };
}

function button(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'apg-demo-btn';
  b.textContent = text;
  return b;
}
