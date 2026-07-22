import { describe, it, expect } from 'vitest';
import { applyThemeScope } from './theme-scope';

describe('applyThemeScope', () => {
  it('copies apg-theme-* classes from the host onto the portal', () => {
    const host = document.createElement('div');
    host.className = 'apg apg-theme-quill-dark';
    const portal = document.createElement('div');
    applyThemeScope(portal, host);
    expect(portal.classList.contains('apg-theme-quill-dark')).toBe(true);
  });

  it('resolves the host from a descendant source element', () => {
    const host = document.createElement('div');
    host.className = 'apg apg-theme-vivid';
    const inner = document.createElement('div');
    host.appendChild(inner);
    const portal = document.createElement('div');
    applyThemeScope(portal, inner);
    expect(portal.classList.contains('apg-theme-vivid')).toBe(true);
  });

  it('copies the horizontal-borders class too', () => {
    const host = document.createElement('div');
    host.className = 'apg apg-borders-horizontal';
    const portal = document.createElement('div');
    applyThemeScope(portal, host);
    expect(portal.classList.contains('apg-borders-horizontal')).toBe(true);
  });

  it('ignores non-theme classes including apg itself', () => {
    const host = document.createElement('div');
    host.className = 'apg apg-animated my-grid';
    const portal = document.createElement('div');
    applyThemeScope(portal, host);
    expect(portal.classList.contains('apg')).toBe(false);
    expect(portal.classList.contains('apg-animated')).toBe(false);
    expect(portal.classList.contains('my-grid')).toBe(false);
  });

  it('does nothing when there is no grid ancestor', () => {
    const orphan = document.createElement('div');
    const portal = document.createElement('div');
    expect(() => applyThemeScope(portal, orphan)).not.toThrow();
    expect(() => applyThemeScope(portal, null)).not.toThrow();
    expect(portal.classList.length).toBe(0);
  });
});
