/**
 * How a cell edit was entered. `'full'` (F2/double-click) shows the existing
 * value with everything selected; `'quick'` (typing over a selected cell)
 * seeds the editor with just the typed character instead.
 */
export interface EditorOpenOptions {
  mode?: 'quick' | 'full';
  initialChar?: string;
}
