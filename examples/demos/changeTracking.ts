import { Grid } from '../../src';
import { makeSales } from '../data';
import { Demo } from './types';

export const changeTracking: Demo = {
  id: 'change-tracking',
  title: 'Change tracking',
  tagline: 'trackChanges records edited, added, and removed rows on the collection view.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const addBtn = button('+ Add row');
    const removeBtn = button('− Remove selected');
    const clearBtn = button('Clear changes');
    const status = document.createElement('span');
    status.className = 'apg-demo-readout';
    toolbar.append(addBtn, removeBtn, clearBtn, status);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const data = makeSales(500);
    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 60, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 150, editable: true },
        { binding: 'country', header: 'Country', width: 140, editable: true },
        { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number', editable: true },
      ],
      itemsSource: data,
      trackChanges: true,
    });

    const cv = grid.collectionView;
    const render = () => {
      status.textContent = `edited ${cv.itemsEdited.length} · added ${cv.itemsAdded.length} · removed ${cv.itemsRemoved.length}`;
    };
    const off = grid.on('collectionChanged', render);
    render();

    addBtn.addEventListener('click', () => {
      const nextId = data.reduce((max, r) => Math.max(max, Number(r.id)), 0) + 1;
      cv.addNew({ id: nextId, product: 'New product', country: 'US', sales: 0 }, true);
      grid.scrollTo(cv.items.length - 1);
    });
    removeBtn.addEventListener('click', () => {
      const cell = grid.selectedCell;
      if (cell) cv.removeAt(cell.row);
    });
    clearBtn.addEventListener('click', () => {
      cv.clearChanges();
      render();
    });

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
