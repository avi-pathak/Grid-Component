import { ThemeParams, ThemePreset } from './types';

// =============================================================================
// apgrid — built-in theme presets
// =============================================================================
// Four families, each with a light and dark variant, tuned to feel as polished
// as a modern commercial grid (ag-Grid Quartz / Material and friends): generous
// row height, real typographic hierarchy, hairline borders, and one confident
// accent. The defaults lean airy and border-light because that is what reads as
// "premium"; Ledger is the deliberate dense-spreadsheet exception.
//
// Each is a plain `ThemeParams`; `deriveTokens` turns it into the full palette,
// and `dist/apgrid-themes.css` bakes the same params into CSS classes so the two
// never drift.

// Accent colours are all dark enough that the derived checkmark/contrast colour
// comes out white — the standard, crisp look on a filled checkbox.

const PLEX = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const INTER = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const GROTESK =
  "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const SYSTEM =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// ---- Quill: modern, airy, the flagship (Quartz in spirit) -------------------

const quillLight: ThemeParams = {
  fontFamily: PLEX,
  fontSize: 14,
  backgroundColor: '#ffffff',
  foregroundColor: '#181d1f',
  accentColor: '#2563eb',
  borderColor: '#dfe3ea',
  borders: 'horizontal',
  oddRowStriping: false,
  spacing: 8,
  wrapperRadius: 10,
  widgetRadius: 6,
  rowHeight: 44,
  headerHeight: 50,
};

const quillDark: ThemeParams = {
  ...quillLight,
  backgroundColor: '#1b2027',
  foregroundColor: '#e6eaf0',
  accentColor: '#5b9bff',
  borderColor: '#333b45',
};

// ---- Ledger: dense spreadsheet (Balham in spirit) ---------------------------

const ledgerLight: ThemeParams = {
  fontFamily: SYSTEM,
  fontSize: 13,
  backgroundColor: '#ffffff',
  foregroundColor: '#14181d',
  accentColor: '#1a56db',
  borderColor: '#d3d8e0',
  borders: 'all',
  headerBackgroundColor: '#f2f4f7',
  oddRowStriping: true,
  spacing: 6,
  wrapperRadius: 3,
  widgetRadius: 2,
  rowHeight: 30,
  headerHeight: 34,
};

const ledgerDark: ThemeParams = {
  ...ledgerLight,
  backgroundColor: '#15181e',
  foregroundColor: '#dde2e9',
  accentColor: '#5b8def',
  borderColor: '#2a2f38',
  headerBackgroundColor: '#1c2028',
};

// ---- Slate: minimal, flat, calm (Material in spirit) ------------------------

const slateLight: ThemeParams = {
  fontFamily: INTER,
  fontSize: 14,
  backgroundColor: '#ffffff',
  foregroundColor: '#1f2430',
  accentColor: '#4f46e5',
  borderColor: '#ecedf1',
  borders: 'horizontal',
  oddRowStriping: false,
  spacing: 11,
  wrapperRadius: 14,
  widgetRadius: 9,
  rowHeight: 48,
  headerHeight: 52,
};

const slateDark: ThemeParams = {
  ...slateLight,
  backgroundColor: '#1a1c22',
  foregroundColor: '#d9dce3',
  accentColor: '#8b83ff',
  borderColor: '#2a2d36',
};

// ---- Vivid: expressive, branded --------------------------------------------

const vividLight: ThemeParams = {
  fontFamily: GROTESK,
  fontSize: 14,
  backgroundColor: '#ffffff',
  foregroundColor: '#181225',
  accentColor: '#7c3aed',
  borderColor: '#ece7f5',
  borders: 'horizontal',
  headerBackgroundColor: '#faf7ff',
  oddRowStriping: true,
  spacing: 10,
  wrapperRadius: 14,
  widgetRadius: 10,
  rowHeight: 46,
  headerHeight: 52,
};

const vividDark: ThemeParams = {
  ...vividLight,
  backgroundColor: '#171020',
  foregroundColor: '#ece7f4',
  accentColor: '#a97dff',
  borderColor: '#2d2440',
  headerBackgroundColor: '#1f1730',
};

// ---- Terminal: green-on-black phosphor CRT, monospace -----------------------
// Dark-only by nature — a light variant of a terminal makes no sense.

const terminal: ThemeParams = {
  fontFamily: MONO,
  fontSize: 14,
  backgroundColor: '#0b100c',
  foregroundColor: '#7ee787',
  accentColor: '#3fb950',
  borderColor: '#1f3a28',
  borders: 'horizontal',
  headerBackgroundColor: '#0e150f',
  oddRowStriping: false,
  spacing: 9,
  wrapperRadius: 8,
  widgetRadius: 4,
  rowHeight: 44,
  headerHeight: 48,
};

/** All built-in presets, ordered light-then-dark within each family. */
export const presets: ThemePreset[] = [
  { id: 'quill', label: 'Quill Light', scheme: 'light', params: quillLight },
  { id: 'quill-dark', label: 'Quill Dark', scheme: 'dark', params: quillDark },
  { id: 'ledger', label: 'Ledger Light', scheme: 'light', params: ledgerLight },
  { id: 'ledger-dark', label: 'Ledger Dark', scheme: 'dark', params: ledgerDark },
  { id: 'slate', label: 'Slate Light', scheme: 'light', params: slateLight },
  { id: 'slate-dark', label: 'Slate Dark', scheme: 'dark', params: slateDark },
  { id: 'vivid', label: 'Vivid Light', scheme: 'light', params: vividLight },
  { id: 'vivid-dark', label: 'Vivid Dark', scheme: 'dark', params: vividDark },
  { id: 'terminal', label: 'Terminal', scheme: 'dark', params: terminal },
];

/** Look up a preset by its id. */
export const presetById = (id: string): ThemePreset | undefined => presets.find((p) => p.id === id);

/** The default theme — Quill Light. */
export const defaultPreset: ThemePreset = presets[0];
