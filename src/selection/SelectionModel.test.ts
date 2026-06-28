import { describe, it, expect } from 'vitest';
import { SelectionModel } from './SelectionModel';

const bounds = { rowCount: 100, colCount: 5 };

describe('SelectionModel', () => {
  it('starts empty', () => {
    const sel = new SelectionModel();
    expect(sel.getActive()).toBeNull();
    expect(sel.getRange(bounds)).toBeNull();
  });

  it('Cell mode selects a single cell', () => {
    const sel = new SelectionModel('Cell');
    sel.moveTo({ row: 3, col: 2 }, false);
    expect(sel.getActive()).toEqual({ row: 3, col: 2 });
    expect(sel.getRange(bounds)).toEqual({ topRow: 3, leftCol: 2, bottomRow: 3, rightCol: 2 });
  });

  it('Cell mode ignores extend', () => {
    const sel = new SelectionModel('Cell');
    sel.moveTo({ row: 1, col: 1 }, false);
    sel.moveTo({ row: 4, col: 3 }, true);
    expect(sel.getRange(bounds)).toEqual({ topRow: 4, leftCol: 3, bottomRow: 4, rightCol: 3 });
  });

  it('CellRange mode extends from the anchor', () => {
    const sel = new SelectionModel('CellRange');
    sel.moveTo({ row: 2, col: 1 }, false);
    sel.moveTo({ row: 5, col: 3 }, true);
    expect(sel.getRange(bounds)).toEqual({ topRow: 2, leftCol: 1, bottomRow: 5, rightCol: 3 });
    expect(sel.getActive()).toEqual({ row: 5, col: 3 });
  });

  it('CellRange normalizes when extending up and left', () => {
    const sel = new SelectionModel('CellRange');
    sel.moveTo({ row: 5, col: 4 }, false);
    sel.moveTo({ row: 2, col: 1 }, true);
    expect(sel.getRange(bounds)).toEqual({ topRow: 2, leftCol: 1, bottomRow: 5, rightCol: 4 });
  });

  it('Row mode selects the whole row but keeps the active column', () => {
    const sel = new SelectionModel('Row');
    sel.moveTo({ row: 7, col: 2 }, false);
    expect(sel.getRange(bounds)).toEqual({ topRow: 7, leftCol: 0, bottomRow: 7, rightCol: 4 });
    expect(sel.getActive()).toEqual({ row: 7, col: 2 });
  });

  it('RowRange spans rows full width', () => {
    const sel = new SelectionModel('RowRange');
    sel.moveTo({ row: 3, col: 1 }, false);
    sel.moveTo({ row: 8, col: 4 }, true);
    expect(sel.getRange(bounds)).toEqual({ topRow: 3, leftCol: 0, bottomRow: 8, rightCol: 4 });
  });

  it('Column mode selects the whole column', () => {
    const sel = new SelectionModel('Column');
    sel.moveTo({ row: 4, col: 2 }, false);
    expect(sel.getRange(bounds)).toEqual({ topRow: 0, leftCol: 2, bottomRow: 99, rightCol: 2 });
  });

  it('ColumnRange spans columns full height', () => {
    const sel = new SelectionModel('ColumnRange');
    sel.moveTo({ row: 1, col: 1 }, false);
    sel.moveTo({ row: 9, col: 3 }, true);
    expect(sel.getRange(bounds)).toEqual({ topRow: 0, leftCol: 1, bottomRow: 99, rightCol: 3 });
  });

  it('None mode selects nothing', () => {
    const sel = new SelectionModel('None');
    expect(sel.moveTo({ row: 1, col: 1 }, false)).toBe(false);
    expect(sel.getRange(bounds)).toBeNull();
  });

  it('switching to None clears the selection', () => {
    const sel = new SelectionModel('Cell');
    sel.moveTo({ row: 1, col: 1 }, false);
    sel.setMode('None');
    expect(sel.getRange(bounds)).toBeNull();
    expect(sel.getActive()).toBeNull();
  });

  it('reports no change when moving to the same cell', () => {
    const sel = new SelectionModel('Cell');
    sel.moveTo({ row: 2, col: 2 }, false);
    expect(sel.moveTo({ row: 2, col: 2 }, false)).toBe(false);
  });

  it('switching mode collapses the anchor to the active cell', () => {
    const sel = new SelectionModel('CellRange');
    sel.moveTo({ row: 2, col: 1 }, false);
    sel.moveTo({ row: 6, col: 4 }, true);
    sel.setMode('Cell');
    expect(sel.getRange(bounds)).toEqual({ topRow: 6, leftCol: 4, bottomRow: 6, rightCol: 4 });
  });
});
