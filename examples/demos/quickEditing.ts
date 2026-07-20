import { Grid } from '@avi-pathak/apgrid';
import { makeSales } from '../data';
import { Demo } from './types';

export const quickEditing: Demo = {
  id: 'quick-editing',
  title: 'Quick editing',
  tagline: 'Type over a selected cell to start editing; arrow keys commit and move.',
  mount(host) {
    const hint = document.createElement('p');
    hint.className = 'apg-demo-readout';
    hint.style.margin = '0 0 12px';
    hint.textContent =
      'Click a cell to select it (not edit), then just type — the old value is replaced, ' +
      'not appended to. While typing, press an arrow key instead of Enter: it commits the ' +
      'value and moves the active cell that direction. F2 or double-click still enter ' +
      '"full" mode instead: the existing value is shown selected, and arrow keys move the ' +
      'caret through the text as usual. (This also composes correctly with CJK/IME input — ' +
      "an Enter that's really confirming a composition doesn't commit the cell early.)";
    host.appendChild(hint);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 70, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 150, editable: true },
        { binding: 'country', header: 'Country', width: 140, editable: true },
        { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number', editable: true },
        { binding: 'expenses', header: 'Expenses', width: 120, dataType: 'Number', editable: true },
      ],
      itemsSource: makeSales(500),
      selectionMode: 'Cell',
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
