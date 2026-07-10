export function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

export function setTransform(el: HTMLElement, x: number, y: number): void {
  el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

// Remembers which inline-style properties conditional styling last set on each
// element, so pooled cells/rows reset cleanly instead of accumulating styles.
const conditionalStyleKeys = new WeakMap<HTMLElement, string[]>();

/**
 * Apply conditional inline styles to an element, first clearing any this helper
 * set on a previous pass. Pass null (or an empty object) to just clear.
 */
export function setConditionalStyle(el: HTMLElement, style: Record<string, string> | null): void {
  const prev = conditionalStyleKeys.get(el);
  if (prev) {
    for (const key of prev) el.style[key as never] = '' as never;
    conditionalStyleKeys.delete(el);
  }
  if (style) {
    const keys = Object.keys(style);
    if (keys.length) {
      Object.assign(el.style, style);
      conditionalStyleKeys.set(el, keys);
    }
  }
}
