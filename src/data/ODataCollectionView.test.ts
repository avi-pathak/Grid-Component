import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ODataCollectionView } from './ODataCollectionView';
import { ODataVirtualCollectionView } from './ODataVirtualCollectionView';
import { SortDescription } from '../models/SortDescription';

const SVC_URL = 'https://example.org/svc/';

interface Customer {
  CustomerID: string;
  CompanyName: string;
}

// A fake OData service over a fixed array that honors $top/$skip/$orderby/$count.
function fakeServer(rows: Customer[]) {
  return vi.fn((input: string) => {
    const u = new URL(input);
    const params = u.searchParams;
    let data = rows.slice();
    const orderby = params.get('$orderby');
    if (orderby) {
      const [prop, dir] = decodeURIComponent(orderby).split(' ');
      data.sort((a, b) =>
        String((a as unknown as Record<string, unknown>)[prop]).localeCompare(
          String((b as unknown as Record<string, unknown>)[prop]),
        ),
      );
      if (dir === 'desc') data.reverse();
    }
    const total = data.length;
    const skip = Number(params.get('$skip') ?? 0);
    const top = Number(params.get('$top') ?? 0);
    if (top > 0) data = data.slice(skip, skip + top);
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ '@odata.count': total, value: data }),
    } as Response);
  });
}

const customers: Customer[] = Array.from({ length: 25 }, (_, i) => ({
  CustomerID: `C${String(i).padStart(2, '0')}`,
  CompanyName: `Company ${String.fromCharCode(90 - i)}`, // Z, Y, X ... reverse alpha
}));

describe('ODataCollectionView', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fakeServer(customers));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the first server page on construction', async () => {
    const view = new ODataCollectionView<Customer>(SVC_URL, 'Customers', { pageSize: 10 });
    await vi.waitFor(() => expect(view.isLoading).toBe(false));
    expect(view.items).toHaveLength(10);
    expect(view.totalItemCount).toBe(25);
    expect(view.pageCount).toBe(3);
  });

  it('requests the next page from the server', async () => {
    const view = new ODataCollectionView<Customer>(SVC_URL, 'Customers', { pageSize: 10 });
    await vi.waitFor(() => expect(view.items).toHaveLength(10));
    view.moveToNextPage();
    await vi.waitFor(() => expect(view.pageIndex).toBe(1));
    await vi.waitFor(() => expect(view.items[0].CustomerID).toBe('C10'));
    expect(view.items).toHaveLength(10);
  });

  it('builds a $orderby query when sorting on the server', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const view = new ODataCollectionView<Customer>(SVC_URL, 'Customers', { pageSize: 5 });
    await vi.waitFor(() => expect(view.items).toHaveLength(5));
    view.sortDescriptions = [new SortDescription('CompanyName', true)];
    await vi.waitFor(() => expect(view.isLoading).toBe(false));
    const lastUrl = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
    expect(lastUrl).toContain('$orderby=');
    expect(lastUrl).toContain('CompanyName');
    // Names run Company Z..Company B; ascending puts Company B first.
    expect(view.items[0].CompanyName).toBe('Company B');
  });

  it('emits loading then loaded events', async () => {
    const events: string[] = [];
    const view = new ODataCollectionView<Customer>(SVC_URL, 'Customers', { pageSize: 10 });
    view.onLoading(() => events.push('loading'));
    view.onLoaded(() => events.push('loaded'));
    view.load();
    await vi.waitFor(() => expect(events).toContain('loaded'));
    expect(events).toContain('loading');
  });

  it('reports an error when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 500 } as Response)),
    );
    const view = new ODataCollectionView<Customer>(SVC_URL, 'Customers', { pageSize: 10 });
    let failed = false;
    view.onError(() => (failed = true));
    view.load();
    await vi.waitFor(() => expect(failed).toBe(true));
  });
});

describe('ODataVirtualCollectionView', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fakeServer(customers));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the first chunk and appends more on demand', async () => {
    const view = new ODataVirtualCollectionView<Customer>(SVC_URL, 'Order', { pageSize: 10 });
    await vi.waitFor(() => expect(view.items).toHaveLength(10));
    expect(view.allLoaded).toBe(false);

    view.loadMore();
    await vi.waitFor(() => expect(view.items).toHaveLength(20));

    view.loadMore();
    await vi.waitFor(() => expect(view.items).toHaveLength(25));
    expect(view.allLoaded).toBe(true);

    view.loadMore(); // no-op once everything is loaded
    await Promise.resolve();
    expect(view.items).toHaveLength(25);
  });
});
