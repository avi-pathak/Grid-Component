import { describe, it, expect } from 'vitest';
import { Column } from './Column';
import { ColumnGroup, ColumnGroupLeaf } from './ColumnGroup';
import { buildColumnGroups } from '../data/buildColumnGroups';

function cols(...bindings: string[]): Column[] {
  return bindings.map((binding) => new Column({ binding }));
}

// Resolve a single top-level group from a def (the realistic construction path).
function group(def: Parameters<typeof buildColumnGroups>[1][number], ...bindings: string[]) {
  return buildColumnGroups(cols(...bindings), [def])[0];
}

describe('ColumnGroup', () => {
  it('defaults collapsed to false and collapsible to true', () => {
    const g = group({ header: 'Perf', columns: ['ytd', 'm1'] }, 'ytd', 'm1');
    expect(g.collapsed).toBe(false);
    expect(g.collapsible).toBe(true);
  });

  it('honors explicit collapsed and collapsible', () => {
    const g = group(
      { header: 'Perf', columns: ['ytd'], collapsed: true, collapsible: false },
      'ytd',
    );
    expect(g.collapsed).toBe(true);
    expect(g.collapsible).toBe(false);
  });

  it('derives a slug key from the header when none is given', () => {
    expect(group({ header: 'Perf', columns: ['a'] }, 'a').key).toBe('perf');
    expect(group({ header: '12 Month Return!', columns: ['a'] }, 'a').key).toBe('12-month-return');
  });

  it('uses an explicit key over the derived slug', () => {
    expect(group({ header: 'Perf', columns: ['a'], key: 'perf-group' }, 'a').key).toBe(
      'perf-group',
    );
  });

  it('exposes leaf children referencing their bindings', () => {
    const g = group({ header: 'Perf', columns: ['ytd', 'm1'] }, 'ytd', 'm1');
    expect(g.children.every((c) => c instanceof ColumnGroupLeaf)).toBe(true);
    expect(g.leafBindings()).toEqual(['ytd', 'm1']);
  });

  it('reports depth 1 for a flat group and 2 for one nested level', () => {
    const flat = group({ header: 'Perf', columns: ['a', 'b'] }, 'a', 'b');
    expect(flat.depth()).toBe(1);
    const nested = group(
      { header: 'Perf', columns: ['a', { header: 'Sub', columns: ['b', 'c'] }] },
      'a',
      'b',
      'c',
    );
    expect(nested.depth()).toBe(2);
  });

  it('descendantGroups includes itself and every nested group', () => {
    const g = group(
      {
        header: 'Alloc',
        columns: ['a', { header: 'Detail', columns: [{ header: 'Sub', columns: ['b'] }] }],
      },
      'a',
      'b',
    );
    expect(g.descendantGroups().map((x) => x.header)).toEqual(['Alloc', 'Detail', 'Sub']);
  });

  it('defaults collapseTo to the first descendant leaf', () => {
    const g = group(
      { header: 'Perf', columns: [{ header: 'Sub', columns: ['ytd', 'm1'] }] },
      'ytd',
      'm1',
    );
    expect(g.collapseTo).toBe('ytd');
  });

  it('honors an explicit collapseTo that is any descendant leaf', () => {
    const g = group(
      {
        header: 'Perf',
        columns: ['ytd', { header: 'Sub', columns: ['m6', 'm12'] }],
        collapseTo: 'm12',
      },
      'ytd',
      'm6',
      'm12',
    );
    expect(g.collapseTo).toBe('m12');
  });

  it('falls back to the first descendant leaf when collapseTo is not a member', () => {
    const g = group({ header: 'Perf', columns: ['ytd', 'm1'], collapseTo: 'bogus' }, 'ytd', 'm1');
    expect(g.collapseTo).toBe('ytd');
  });

  it('allows collapseTo: null to mean "hide every column"', () => {
    const g = group({ header: 'Perf', columns: ['ytd', 'm1'], collapseTo: null }, 'ytd', 'm1');
    expect(g.collapseTo).toBeNull();
  });

  it('constructs directly from a def and resolved children', () => {
    // The low-level constructor is (def, children); exercised here for coverage.
    const g = new ColumnGroup({ header: 'X' }, [
      new ColumnGroupLeaf('a'),
      new ColumnGroupLeaf('b'),
    ]);
    expect(g.leafBindings()).toEqual(['a', 'b']);
    expect(g.collapseTo).toBe('a');
  });
});
