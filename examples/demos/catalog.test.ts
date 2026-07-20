import { describe, it, expect } from 'vitest';
import { demos } from './index';
import { catalog, categories, categoryOf, uncategorizedIds } from './catalog';
import { demoSources, exportNameOf, fileNameOf } from './sources';

/**
 * The site's sidebar, overview page, Code tab, and StackBlitz launcher are all
 * driven by two hand-maintained tables — `catalog.ts` and `sources.ts`. Adding a
 * demo without updating them would silently drop it from the navigation or
 * leave its Code tab empty, which is exactly the kind of omission that survives
 * a manual check. These tests make it a build failure instead.
 */
describe('demo catalog', () => {
  it('assigns every registered demo to a category', () => {
    expect(uncategorizedIds()).toEqual([]);
  });

  it('lists only real demo ids', () => {
    const known = new Set(demos.map((d) => d.id));
    const listed = categories.flatMap((c) => c.demoIds);
    expect(listed.filter((id) => !known.has(id))).toEqual([]);
  });

  it('places each demo in exactly one category', () => {
    const listed = categories.flatMap((c) => c.demoIds);
    expect(new Set(listed).size).toBe(listed.length);
    expect(catalog).toHaveLength(demos.length);
  });

  it('gives every category a unique id, label, blurb, and icon', () => {
    expect(new Set(categories.map((c) => c.id)).size).toBe(categories.length);
    for (const category of categories) {
      expect(category.label).not.toBe('');
      expect(category.blurb).not.toBe('');
      expect(category.icon).not.toBe('');
      expect(category.demoIds.length).toBeGreaterThan(0);
    }
  });

  it('resolves a category for any demo id', () => {
    for (const demo of demos) {
      expect(categoryOf(demo.id)?.label).toBeTruthy();
    }
  });
});

describe('demo sources', () => {
  it('has source for every registered demo', () => {
    const missing = demos.map((d) => d.id).filter((id) => !demoSources[id]);
    expect(missing).toEqual([]);
  });

  it('maps no source to an unregistered id', () => {
    const known = new Set(demos.map((d) => d.id));
    expect(Object.keys(demoSources).filter((id) => !known.has(id))).toEqual([]);
  });

  it('pairs each id with the source of that same demo', () => {
    // Guards against a copy/paste slip in the id-to-import table: the file's
    // own `id:` field must match the key it is filed under.
    for (const demo of demos) {
      expect(demoSources[demo.id]).toContain(`id: '${demo.id}'`);
    }
  });

  it('derives a usable export and file name from every source', () => {
    for (const demo of demos) {
      const source = demoSources[demo.id];
      const name = exportNameOf(source);
      expect(name).not.toBe('demo');
      expect(source).toContain(`export const ${name}: Demo`);
      expect(fileNameOf(source)).toBe(`${name}.ts`);
    }
  });
});
