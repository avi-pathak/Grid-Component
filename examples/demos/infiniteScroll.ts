import { Grid, ODataVirtualCollectionView } from '@avi-pathak/apgrid';
import { Demo } from './types';

const NORTHWIND = 'https://services.odata.org/V4/Northwind/Northwind.svc/';

export const infiniteScroll: Demo = {
  id: 'infinite-scroll',
  title: 'Infinite scrolling',
  tagline: 'A virtual OData view loads more rows as you scroll toward the bottom.',
  mount(host) {
    const status = document.createElement('div');
    status.className = 'apg-demo-toolbar';
    const readout = document.createElement('span');
    readout.className = 'apg-demo-readout';
    readout.textContent = 'Loading…';
    status.appendChild(readout);
    host.appendChild(status);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const view = new ODataVirtualCollectionView(NORTHWIND, 'Order_Details', {
      fields: ['OrderID', 'ProductID', 'UnitPrice', 'Quantity', 'Discount'],
      pageSize: 40,
    });

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'OrderID', header: 'Order', width: 100, dataType: 'Number' },
        { binding: 'ProductID', header: 'Product', width: 110, dataType: 'Number' },
        { binding: 'UnitPrice', header: 'Unit Price', width: 120, dataType: 'Number' },
        { binding: 'Quantity', header: 'Qty', width: 90, dataType: 'Number' },
        { binding: 'Discount', header: 'Discount', width: 110, dataType: 'Number' },
      ],
      itemsSource: view,
    });

    const update = () => {
      readout.textContent = view.isLoading
        ? `Loaded ${view.items.length} of ${view.totalItemCount}… (loading)`
        : view.allLoaded
          ? `All ${view.items.length} rows loaded`
          : `Loaded ${view.items.length} of ${view.totalItemCount} — scroll for more`;
    };
    const offLoaded = view.onLoaded(update);
    const offLoading = view.onLoading(update);
    update();

    // When the scroll nears the bottom, ask the view for the next chunk. We
    // listen to the viewport scroll directly so loads fire as soon as the user
    // reaches the end, without waiting on a throttled render frame.
    const viewport = gridHost.querySelector('.apg-viewport') as HTMLElement;
    const onScroll = () => {
      const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      if (remaining < viewport.clientHeight) view.loadMore();
    };
    viewport?.addEventListener('scroll', onScroll);

    return {
      grid,
      dispose: () => {
        offLoaded();
        offLoading();
        viewport?.removeEventListener('scroll', onScroll);
        grid.dispose();
        status.remove();
        gridHost.remove();
      },
    };
  },
};
