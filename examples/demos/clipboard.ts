import { Grid } from '../../src';
import { makeSales } from '../data';
import { Demo } from './types';

export const clipboard: Demo = {
  id: 'clipboard',
  title: 'Clipboard',
  tagline:
    'Enable allowClipboard, then Ctrl+C / Ctrl+V to copy and paste — including from a spreadsheet.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const hint = document.createElement('span');
    hint.className = 'apg-demo-readout';
    hint.textContent = 'Select cells, Ctrl+C to copy, Ctrl+V to paste. Undo with Ctrl+Z.';
    toolbar.appendChild(hint);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 60, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 140, editable: true },
        { binding: 'country', header: 'Country', width: 130, editable: true },
        { binding: 'sales', header: 'Sales', width: 110, dataType: 'Number', editable: true },
        { binding: 'expenses', header: 'Expenses', width: 110, dataType: 'Number', editable: true },
      ],
      itemsSource: makeSales(2000),
      selectionMode: 'CellRange',
      allowClipboard: true,
    });

    const off = grid.on('pasted', ({ range }) => {
      const rows = range.bottomRow - range.topRow + 1;
      const cols = range.rightCol - range.leftCol + 1;
      hint.textContent = `Pasted ${rows} × ${cols} cell${rows * cols > 1 ? 's' : ''}. Undo with Ctrl+Z.`;
    });

    return () => {
      off();
      grid.dispose();
      toolbar.remove();
      gridHost.remove();
    };
  },
};
