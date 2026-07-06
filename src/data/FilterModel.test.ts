import { describe, it, expect } from 'vitest';
import { Column } from '../models/Column';
import { CollectionView } from './CollectionView';
import { FilterModel } from './FilterModel';

interface Row {
  country: string;
  product: string;
  [key: string]: unknown;
}

const rows: Row[] = [
  { country: 'US', product: 'Widget' },
  { country: 'US', product: 'Gadget' },
  { country: 'UK', product: 'Gizmo' },
  { country: 'Japan', product: 'Widget' },
];

const countryCol = new Column<Row>({ binding: 'country' });
const productCol = new Column<Row>({ binding: 'product' });

describe('FilterModel.distinctValues', () => {
  it('lists all distinct values when no other filter is active', () => {
    const model = new FilterModel(new CollectionView<Row>(rows.slice()));
    expect(model.distinctValues(productCol)).toEqual(['Gadget', 'Gizmo', 'Widget']);
  });

  it('narrows a column value list by the other active filters', () => {
    const model = new FilterModel(new CollectionView<Row>(rows.slice()));
    // Filter country to US, then the product list should only show US products.
    model.get(countryCol).values = new Set(['US']);
    model.apply();
    expect(model.distinctValues(productCol)).toEqual(['Gadget', 'Widget']); // no Gizmo (UK)
  });

  it("ignores the column's own filter so its list stays complete", () => {
    const model = new FilterModel(new CollectionView<Row>(rows.slice()));
    model.get(productCol).values = new Set(['Widget']);
    model.apply();
    // Reopening the product filter still offers every product, not just Widget.
    expect(model.distinctValues(productCol)).toEqual(['Gadget', 'Gizmo', 'Widget']);
  });
});
