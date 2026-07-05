import { describe, it, expect } from 'vitest';
import { icons, iconEl } from './icons';

describe('iconEl', () => {
  it('wraps the named SVG in an .apg-icon span', () => {
    const el = iconEl('chevron');
    expect(el.classList.contains('apg-icon')).toBe(true);
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('appends extra classes', () => {
    const el = iconEl('close', 'apg-group-chip-remove');
    expect(el.className).toBe('apg-icon apg-group-chip-remove');
  });

  it('exposes every icon as inline SVG markup using currentColor', () => {
    for (const svg of Object.values(icons)) {
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('currentColor');
    }
  });
});
