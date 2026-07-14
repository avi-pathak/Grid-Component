import { Grid, DataMap } from '../../src';
import { Demo } from './types';

// Cities grouped by country. The City data map filters its choices to the row's
// country, so the City dropdown only ever offers cities in that country.
const citiesByCountry: Record<string, string[]> = {
  US: ['Washington', 'Miami', 'Seattle', 'Boston', 'Chicago'],
  Germany: ['Bonn', 'Munich', 'Berlin', 'Hamburg', 'Cologne'],
  UK: ['London', 'Manchester', 'Liverpool', 'Bristol'],
  Japan: ['Tokyo', 'Osaka', 'Kyoto', 'Nagoya'],
};
const countries = Object.keys(citiesByCountry);

const cityItems = countries.flatMap((country) =>
  citiesByCountry[country].map((city) => ({ country, city })),
);

const cityMap = new DataMap(cityItems, 'city', 'city');
cityMap.itemsFilter = (row) => {
  const country = (row as { country?: string }).country;
  return country ? cityItems.filter((c) => c.country === country) : cityItems;
};

function makeRows(n: number) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const country = countries[i % countries.length];
    const cities = citiesByCountry[country];
    rows.push({
      country,
      city: cities[i % cities.length],
      downloads: Math.round(1000 + Math.random() * 12000),
      sales: Math.round(2000 + Math.random() * 6000),
    });
  }
  return rows;
}

export const dynamicDataMaps: Demo = {
  id: 'dynamic-data-maps',
  title: 'Dynamic data maps',
  tagline: 'The City choices depend on the row’s Country — change one and the other follows.',
  mount(host) {
    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'country', header: 'Country', width: 140, editable: true, dataMap: countries },
        { binding: 'city', header: 'City', width: 160, editable: true, dataMap: cityMap },
        {
          binding: 'downloads',
          header: 'Downloads',
          width: 130,
          dataType: 'Number',
          editable: true,
        },
        { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number', editable: true },
      ],
      itemsSource: makeRows(500),
    });

    // When Country changes, reset City if it no longer belongs to that country.
    const off = grid.on('cellEditEnd', ({ row, col }) => {
      if (col !== 0) return;
      const item = grid.collectionView.items[row] as { country: string; city: string };
      const cities = citiesByCountry[item.country] ?? [];
      if (!cities.includes(item.city)) grid.setCellValue(row, 1, cities[0]);
    });

    return {
    grid,
    dispose: () => {
      off();
      grid.dispose();
      gridHost.remove();
    },
  };
  },
};
