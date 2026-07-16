import { Grid, ODataCollectionView } from '@avi-pathak/apgrid';
import { Demo } from './types';

const NORTHWIND = 'https://services.odata.org/V4/Northwind/Northwind.svc/';

export const odata: Demo = {
  id: 'odata',
  title: 'OData API',
  tagline: 'Bind to a live OData service; sorting and paging run on the server.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const prev = button('‹ Prev');
    const next = button('Next ›');
    const status = document.createElement('span');
    status.className = 'apg-demo-readout';
    status.textContent = 'Loading…';
    toolbar.append(prev, next, status);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const view = new ODataCollectionView(NORTHWIND, 'Customers', {
      fields: ['CustomerID', 'CompanyName', 'ContactName', 'ContactTitle', 'City', 'Country'],
      pageSize: 12,
    });

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'CustomerID', header: 'ID', width: 90 },
        { binding: 'CompanyName', header: 'Company', width: 200 },
        { binding: 'ContactName', header: 'Contact', width: 150 },
        { binding: 'ContactTitle', header: 'Title', width: 160 },
        { binding: 'City', header: 'City', width: 120 },
        { binding: 'Country', header: 'Country', width: 110 },
      ],
      itemsSource: view,
    });

    const update = () => {
      status.textContent = view.isLoading
        ? 'Loading…'
        : `Page ${view.pageIndex + 1} of ${view.pageCount} · ${view.totalItemCount} customers`;
      prev.disabled = view.isLoading || view.pageIndex === 0;
      next.disabled = view.isLoading || view.pageIndex >= view.pageCount - 1;
    };
    const offLoading = view.onLoading(update);
    const offLoaded = view.onLoaded(update);
    const offError = view.onError(() => (status.textContent = 'Failed to load OData service'));
    update();

    prev.addEventListener('click', () => view.moveToPreviousPage());
    next.addEventListener('click', () => view.moveToNextPage());

    return {
      grid,
      dispose: () => {
        offLoading();
        offLoaded();
        offError();
        grid.dispose();
        toolbar.remove();
        gridHost.remove();
      },
    };
  },
};

function button(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'apg-demo-btn';
  b.textContent = text;
  return b;
}
