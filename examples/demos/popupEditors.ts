import { Grid } from '@avi-pathak/apgrid';
import { makeSales } from '../data';
import { Demo } from './types';

export const popupEditors: Demo = {
  id: 'popup-editors',
  title: 'Popup editors',
  tagline: 'A pencil button in the row header opens the whole row as one Save/Cancel form.',
  mount(host) {
    const hint = document.createElement('p');
    hint.className = 'apg-demo-readout';
    hint.style.margin = '0 0 12px';
    hint.textContent =
      'Hover a row header to see the pencil button, then click it: every editable field ' +
      'opens in one form. Save commits every changed field as a single undo step (try ' +
      'Ctrl+Z after saving); Cancel, Escape, an outside click, or scrolling all discard it.';
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
        { binding: 'active', header: 'Active', width: 90, dataType: 'Boolean', editable: true },
      ],
      itemsSource: makeSales(500),
      popupEditors: true,
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
