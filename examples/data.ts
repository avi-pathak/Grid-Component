const countries = 'US,Germany,UK,Japan,Italy,Greece,France,Spain,Brazil,India'.split(',');
const products = 'Widget,Gadget,Gizmo,Sprocket,Cog,Lever,Spring,Bolt'.split(',');

export interface SalesRow {
  id: number;
  product: string;
  country: string;
  sales: number;
  expenses: number;
  active: boolean;
  joined: Date;
  [key: string]: unknown;
}

export function makeSales(count: number): SalesRow[] {
  const rows: SalesRow[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i + 1,
      product: products[i % products.length],
      country: countries[i % countries.length],
      sales: Math.round(Math.random() * 10000),
      expenses: Math.round(Math.random() * 5000),
      active: i % 3 === 0,
      joined: new Date(2020, 0, 1 + (i % 1500)),
    });
  }
  return rows;
}
