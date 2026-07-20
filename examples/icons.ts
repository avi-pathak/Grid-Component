/**
 * The site's icon set: a small, hand-kept collection of 16×16 line glyphs.
 *
 * All of them are stroked with `currentColor` at a single weight (see the
 * `.icon` rule in site.css), so they inherit text colour and stay visually
 * consistent — no emoji, no raster assets, no icon-font dependency.
 */
const paths: Record<string, string> = {
  play: '<path d="M4.5 3.2 12.5 8l-8 4.8z"/>',
  database:
    '<ellipse cx="8" cy="3.8" rx="5" ry="2.3"/><path d="M3 3.8v8.4c0 1.27 2.24 2.3 5 2.3s5-1.03 5-2.3V3.8"/><path d="M3 8c0 1.27 2.24 2.3 5 2.3s5-1.03 5-2.3"/>',
  columns: '<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M6 2.5v11M10 2.5v11"/>',
  grid: '<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M2 10h12M6.5 6.5v7"/>',
  pointer: '<path d="M4 2.5 12.5 7 8.8 8.2 7.4 12z"/>',
  pencil: '<path d="M11.2 2.6 13.4 4.8 5.6 12.6l-3 .8.8-3z"/><path d="m9.8 4 2.2 2.2"/>',
  shield: '<path d="M8 1.8 13 3.6v4c0 3.1-2.1 5.6-5 6.6-2.9-1-5-3.5-5-6.6v-4z"/>',
  filter: '<path d="M2.2 3.2h11.6L9.4 8.4v4.6l-2.8-1.6V8.4z"/>',
  download:
    '<path d="M8 2.2v7.6"/><path d="m5 7 3 3 3-3"/><path d="M2.8 12.4v.4a1 1 0 0 0 1 1h8.4a1 1 0 0 0 1-1v-.4"/>',

  search: '<circle cx="7.2" cy="7.2" r="4.4"/><path d="m10.4 10.4 3 3"/>',
  sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2 3.1 3.1"/>',
  moon: '<path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8z"/>',
  menu: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>',
  close: '<path d="m4 4 8 8M12 4l-8 8"/>',
  chevronRight: '<path d="m6 3.5 4.5 4.5L6 12.5"/>',
  chevronLeft: '<path d="M10 3.5 5.5 8 10 12.5"/>',
  chevronDown: '<path d="m3.5 6 4.5 4.5L12.5 6"/>',
  code: '<path d="m5.5 4.5-4 3.5 4 3.5M10.5 4.5l4 3.5-4 3.5"/>',
  eye: '<path d="M1.5 8S4 3.8 8 3.8 14.5 8 14.5 8 12 12.2 8 12.2 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="1.9"/>',
  bolt: '<path d="M8.8 1.5 3.5 9h3.7l-.8 5.5L12.5 7H8.8z"/>',
  external:
    '<path d="M9.5 2.5H13.5v4"/><path d="m13.5 2.5-6 6"/><path d="M11.5 9.4v3.1a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3.1"/>',
  github:
    '<path d="M6 13.2c-3 .9-3-1.5-4.2-1.8m8.4 3.1v-2.4a2 2 0 0 0-.6-1.6c1.9-.2 3.9-.9 3.9-4.2a3.3 3.3 0 0 0-.9-2.3 3 3 0 0 0-.1-2.3s-.7-.2-2.4.9a8.3 8.3 0 0 0-4.2 0C4.2 1.5 3.5 1.7 3.5 1.7a3 3 0 0 0-.1 2.3 3.3 3.3 0 0 0-.9 2.3c0 3.3 2 4 3.9 4.2a2 2 0 0 0-.6 1.5v2.5"/>',
  layers:
    '<path d="M8 1.8 14.2 5 8 8.2 1.8 5z"/><path d="m1.8 8 6.2 3.2L14.2 8"/><path d="m1.8 11 6.2 3.2L14.2 11"/>',
};

/** Inline SVG markup for `name`, sized `size`px. Unknown names render nothing. */
export function icon(name: string, size = 16, extraClass = ''): string {
  const body = paths[name];
  if (!body) return '';
  const cls = extraClass ? `icon ${extraClass}` : 'icon';
  return `<svg class="${cls}" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}
