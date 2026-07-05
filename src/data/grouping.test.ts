import { describe, it, expect } from 'vitest';
import { CollectionView } from './CollectionView';
import { DataView } from './DataView';
import { PropertyGroupDescription } from '../models/GroupDescription';
import { SortDescription } from '../models/SortDescription';

interface Row {
  country: string;
  city: string;
  sales: number;
  [key: string]: unknown;
}

const rows: Row[] = [
  { country: 'US', city: 'NYC', sales: 10 },
  { country: 'US', city: 'LA', sales: 20 },
  { country: 'UK', city: 'London', sales: 30 },
  { country: 'US', city: 'NYC', sales: 5 },
];

describe('CollectionView grouping', () => {
  it('builds one group per key with all leaves under it', () => {
    const cv = new CollectionView<Row>(rows.slice());
    cv.groupDescriptions = [new PropertyGroupDescription('country')];
    expect(cv.groups.map((g) => g.name)).toEqual(['UK', 'US']); // ordered by key
    const us = cv.groups.find((g) => g.name === 'US')!;
    expect(us.itemCount).toBe(3);
  });

  it('nests groups for multiple descriptions and keeps leaves contiguous', () => {
    const cv = new CollectionView<Row>(rows.slice());
    cv.groupDescriptions = [
      new PropertyGroupDescription('country'),
      new PropertyGroupDescription('city'),
    ];
    const us = cv.groups.find((g) => g.name === 'US')!;
    expect(us.groups.map((g) => g.name)).toEqual(['LA', 'NYC']);
    // View is reordered so each group's leaves sit together.
    const countries = cv.items.map((r) => r.country);
    expect(countries).toEqual(['UK', 'US', 'US', 'US']);
  });

  it('clears the tree when grouping is removed', () => {
    const cv = new CollectionView<Row>(rows.slice());
    cv.groupDescriptions = [new PropertyGroupDescription('country')];
    cv.groupDescriptions = [];
    expect(cv.groups).toEqual([]);
  });

  it('orders groups descending when the grouped column is sorted descending', () => {
    const cv = new CollectionView<Row>(rows.slice());
    cv.groupDescriptions = [new PropertyGroupDescription('country')];
    expect(cv.groups.map((g) => g.name)).toEqual(['UK', 'US']); // ascending default

    cv.sortDescriptions = [new SortDescription('country', false)];
    expect(cv.groups.map((g) => g.name)).toEqual(['US', 'UK']); // reversed by sort

    cv.sortDescriptions = [new SortDescription('country', true)];
    expect(cv.groups.map((g) => g.name)).toEqual(['UK', 'US']); // ascending again
  });
});

describe('DataView group rows', () => {
  function grouped(): DataView<Row> {
    const cv = new CollectionView<Row>(rows.slice());
    cv.groupDescriptions = [new PropertyGroupDescription('country')];
    const dv = new DataView<Row>(cv);
    dv.refreshGroups();
    return dv;
  }

  it('interleaves group headers with data rows', () => {
    const dv = grouped();
    // UK header, 1 UK row, US header, 3 US rows = 6 display rows
    expect(dv.length).toBe(6);
    expect(dv.rowType(0)).toBe('group');
    expect(dv.rowType(1)).toBe('data');
    expect(dv.groupRow(0)?.group.name).toBe('UK');
  });

  it('hides child rows when a group is collapsed', () => {
    const dv = grouped();
    const uk = dv.groupRow(0)!;
    dv.toggleGroup(uk.pathKey);
    // UK collapsed: UK header, US header, 3 US rows = 5 rows
    expect(dv.length).toBe(5);
    expect(dv.rowType(1)).toBe('group');
    expect(dv.groupRow(1)?.group.name).toBe('US');
  });

  it('maps data rows back to view leaves', () => {
    const dv = grouped();
    // row 1 is the first UK leaf → view index 0
    expect(dv.dataIndexAt(1)).toBe(0);
    expect(dv.dataIndexAt(0)).toBe(-1); // group header
    expect((dv.item(1) as Row).country).toBe('UK');
  });
});
