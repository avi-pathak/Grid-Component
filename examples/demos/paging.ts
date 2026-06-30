import { Grid } from '../../src';
import { makeSales } from '../data';
import { Demo } from './types';

export const paging: Demo = {
  id: 'paging',
  title: 'Paging',
  tagline: 'CollectionView.pageSize splits the data into pages you can navigate.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const first = button('« First');
    const prev = button('‹ Prev');
    const next = button('Next ›');
    const last = button('Last »');
    const status = document.createElement('span');
    status.className = 'apg-demo-readout';
    toolbar.append(first, prev, next, last, status);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 70, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 140 },
        { binding: 'country', header: 'Country', width: 130 },
        { binding: 'sales', header: 'Sales', width: 110, dataType: 'Number' },
        { binding: 'expenses', header: 'Expenses', width: 110, dataType: 'Number' },
      ],
      itemsSource: makeSales(523),
    });

    const cv = grid.collectionView;
    cv.pageSize = 15;

    const update = () => {
      status.textContent = `Page ${cv.pageIndex + 1} of ${cv.pageCount} · ${cv.totalItemCount} rows`;
      first.disabled = prev.disabled = cv.pageIndex === 0;
      next.disabled = last.disabled = cv.pageIndex >= cv.pageCount - 1;
    };
    const off = cv.on('pageChanged', update);
    update();

    first.addEventListener('click', () => cv.moveToFirstPage());
    prev.addEventListener('click', () => cv.moveToPreviousPage());
    next.addEventListener('click', () => cv.moveToNextPage());
    last.addEventListener('click', () => cv.moveToLastPage());

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
