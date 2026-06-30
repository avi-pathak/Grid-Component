import { describe, it, expect } from 'vitest';
import { DataMap } from './DataMap';
import { CollectionView } from '../data/CollectionView';

describe('DataMap', () => {
  it('maps a plain list of strings to itself', () => {
    const map = new DataMap(['US', 'UK', 'Japan']);
    expect(map.getDisplayValue('UK')).toBe('UK');
    expect(map.getKeyValue('Japan')).toBe('Japan');
    expect(map.getKeyValues()).toContain('US');
  });

  it('maps keys to display values using value/display paths', () => {
    const map = new DataMap(
      [
        { code: 'us', name: 'United States' },
        { code: 'uk', name: 'United Kingdom' },
      ],
      'code',
      'name',
    );
    expect(map.getDisplayValue('uk')).toBe('United Kingdom');
    expect(map.getKeyValue('United States')).toBe('us');
    expect(map.getDataItem('uk')).toEqual({ code: 'uk', name: 'United Kingdom' });
  });

  it('compares keys by string form (serializeKeys)', () => {
    const map = new DataMap([{ id: 1, label: 'One' }], 'id', 'label');
    expect(map.getDisplayValue(1)).toBe('One');
    expect(map.getDisplayValue('1')).toBe('One');
  });

  it('returns empty/null for unknown keys and displays', () => {
    const map = new DataMap(['a', 'b']);
    expect(map.getDisplayValue('z')).toBe('');
    expect(map.getKeyValue('z')).toBeNull();
  });

  it('orders display values when sortByDisplayValues is on', () => {
    const map = new DataMap(['Charlie', 'Alpha', 'Bravo']);
    expect(map.getDisplayValues()).toEqual(['Alpha', 'Bravo', 'Charlie']);
    map.sortByDisplayValues = false;
    expect(map.getDisplayValues()).toEqual(['Charlie', 'Alpha', 'Bravo']);
  });

  it('filters choices per row through itemsFilter (dynamic map)', () => {
    const cities = [
      { country: 'US', city: 'Seattle' },
      { country: 'US', city: 'Miami' },
      { country: 'UK', city: 'London' },
    ];
    const map = new DataMap(cities, 'city', 'city');
    map.itemsFilter = (row) => {
      const country = (row as { country?: string }).country;
      return country ? cities.filter((c) => c.country === country) : cities;
    };
    expect(map.getDisplayValues({ country: 'US' })).toEqual(['Miami', 'Seattle']);
    expect(map.getKeyValues({ country: 'UK' })).toEqual(['London']);
    // without a row item, all values are returned
    expect(map.getDisplayValues()).toEqual(['London', 'Miami', 'Seattle']);
    // format/parse still resolve against the full map regardless of the filter
    expect(map.getDisplayValue('London')).toBe('London');
  });

  it('accepts a CollectionView as its source and raises mapChanged', () => {
    const cv = new CollectionView<Record<string, unknown>>([{ k: 1, v: 'One' }], {
      trackChanges: false,
    });
    const map = new DataMap(cv, 'k', 'v');
    let changed = 0;
    map.on('mapChanged', () => changed++);
    cv.addNew({ k: 2, v: 'Two' }, true);
    expect(map.getDisplayValue(2)).toBe('Two');
    expect(changed).toBeGreaterThan(0);
  });
});
