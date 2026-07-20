/**
 * How a cell edit was entered.
 *
 * `mode` governs the arrow keys while the editor is open: `'full'`
 * (F2/double-click) lets them move the caret through the text; `'quick'`
 * commits the value and moves the active cell instead, like typing straight
 * into a spreadsheet.
 *
 * `initialChar` governs the starting text: set it (quick editing, where the
 * keystroke that opened the editor is the first character) to replace the
 * value outright, or leave it off to show the existing value selected.
 * Always-edit opens `'quick'` with no `initialChar` — existing value kept,
 * but arrows still move between cells.
 */
export interface EditorOpenOptions {
  mode?: 'quick' | 'full';
  initialChar?: string;
}
