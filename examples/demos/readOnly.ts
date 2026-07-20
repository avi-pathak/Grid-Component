import { Grid } from '@avi-pathak/apgrid';
import { makeSales, SalesRow } from '../data';
import { Demo } from './types';

export const readOnly: Demo = {
  id: 'read-only',
  title: 'Read-only levels',
  tagline: 'Grid-wide, per-row, and per-column read-only — column/cell levels stay untouched.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';

    const gridLabel = document.createElement('label');
    const gridToggle = document.createElement('input');
    gridToggle.type = 'checkbox';
    gridLabel.append(gridToggle, ' Lock the whole grid (isReadOnly)');

    const rowLabel = document.createElement('label');
    const rowToggle = document.createElement('input');
    rowToggle.type = 'checkbox';
    rowToggle.checked = true;
    rowLabel.append(rowToggle, ' Lock inactive rows (rowReadOnly)');

    const hint = document.createElement('span');
    hint.className = 'apg-demo-readout';
    hint.textContent = "'ID' is never editable (column.editable); try double-clicking any cell.";

    toolbar.append(gridLabel, rowLabel, hint);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 70, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 150, editable: true },
        { binding: 'country', header: 'Country', width: 140, editable: true },
        { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number', editable: true },
        {
          binding: 'active',
          header: 'Active (locks its row)',
          width: 150,
          dataType: 'Boolean',
          editable: true,
        },
      ],
      itemsSource: makeSales(500),
      isReadOnly: gridToggle.checked,
      rowReadOnly: ({ item }) => rowToggle.checked && !(item as SalesRow).active,
    });

    gridToggle.addEventListener('change', () => (grid.isReadOnly = gridToggle.checked));
    // rowReadOnly is a predicate consulted fresh every time an edit is
    // attempted (like the other GridOptions predicates), so toggling the
    // checkbox it closes over is all that's needed — no redraw required.

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
