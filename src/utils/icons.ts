import { createEl } from './DOM';

/**
 * Inline SVG icons shared across the grid. Each uses a 16×16 viewBox and
 * `currentColor`, so size and color come from CSS on the wrapping element.
 * They are static markup (no interpolation), so injecting them with innerHTML
 * is safe.
 */
export const icons = {
  // Right-pointing chevron. Rotate it with CSS for expand/collapse or to point
  // in another direction.
  chevron:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 3.5 10.5 8 6 12.5"/></svg>',
  // Six-dot grip shown on draggable chips.
  dragHandle:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="6" cy="4" r="1.15"/><circle cx="10" cy="4" r="1.15"/><circle cx="6" cy="8" r="1.15"/><circle cx="10" cy="8" r="1.15"/><circle cx="6" cy="12" r="1.15"/><circle cx="10" cy="12" r="1.15"/></svg>',
  close:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"/></svg>',
  sortAsc:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 4.5 12 10.5H4z"/></svg>',
  sortDesc:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 11.5 4 5.5h8z"/></svg>',
  // Outline carets used in menus for expand/collapse actions.
  caretUp:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 10.5 8 5.5l4 5"/></svg>',
  caretRight:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 4l5 4-5 4"/></svg>',
  // Filled dot — reads as "clear/remove sort".
  dot: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="3"/></svg>',
  // Stacked, indented bars — reads as "grouping".
  group:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><rect x="2" y="3" width="12" height="2" rx="1"/><rect x="5" y="7" width="9" height="2" rx="1"/><rect x="5" y="11" width="9" height="2" rx="1"/></svg>',
  // Funnel outline — a column filter that isn't active yet.
  filter:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2.5 3.5h11l-4.2 5v4l-2.6 1.3V8.5z"/></svg>',
  // Funnel filled — shown when the column has an active filter.
  filterActive:
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M2.5 3.5h11l-4.2 5v4l-2.6 1.3V8.5z"/></svg>',
  // Pencil outline — opens a row's popup editor.
  edit: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M10.5 2.5 13.5 5.5 5 14H2v-3z"/></svg>',
} as const;

export type IconName = keyof typeof icons;

/** Build a span holding an inline SVG icon. Extra classes are appended. */
export function iconEl(name: IconName, className?: string): HTMLSpanElement {
  const span = createEl('span', className ? `apg-icon ${className}` : 'apg-icon');
  span.innerHTML = icons[name];
  return span;
}
