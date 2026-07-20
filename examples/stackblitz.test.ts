import { describe, it, expect } from 'vitest';
import { demos } from './demos';
import { demoSources, sharedSources, exportNameOf } from './demos/sources';
import { buildSandboxFiles } from './stackblitz';

/**
 * The sandbox is assembled entirely on the client and then handed to
 * StackBlitz, so a malformed project only shows up as a broken tab for whoever
 * clicked the button. These assertions check the payload here instead — no
 * network involved.
 */
describe('stackblitz sandbox payload', () => {
  const grouping = demos.find((d) => d.id === 'grouping')!;
  const files = buildSandboxFiles(grouping, demoSources.grouping);

  it('includes everything the project needs to boot', () => {
    for (const path of [
      'index.html',
      'index.ts',
      'demo.ts',
      'data.ts',
      'types.ts',
      'demo.css',
      'app.css',
      'package.json',
      'tsconfig.json',
      '.stackblitzrc',
      'README.md',
    ]) {
      expect(Object.keys(files)).toContain(path);
    }
  });

  it('fills every generated file with content', () => {
    // demo.css is excluded here on purpose: Vitest stubs CSS imports, so
    // `sharedSources.css` is empty under test even though the bundler inlines
    // the real stylesheet. The pass-through is asserted separately below.
    for (const [path, contents] of Object.entries(files)) {
      if (path === 'demo.css') continue;
      expect(contents.length, path).toBeGreaterThan(0);
    }
  });

  it('passes the shared sources through untouched', () => {
    expect(files['demo.css']).toBe(sharedSources.css);
    expect(files['data.ts']).toBe(sharedSources.data);
    expect(files['types.ts']).toBe(sharedSources.types);
  });

  it('ships the demo source verbatim apart from the flattened data import', () => {
    // Sandbox files are flat, so `../data` has to resolve to a sibling.
    expect(files['demo.ts']).not.toContain("'../data'");
    expect(files['demo.ts']).toContain("from './data'");
    expect(files['demo.ts']).toContain("id: 'grouping'");
    expect(files['demo.ts'].replace(/'\.\/data'/g, "'../data'")).toBe(demoSources.grouping);
  });

  it('mounts the demo through its real export name', () => {
    const entry = exportNameOf(demoSources.grouping);
    expect(entry).toBe('grouping');
    expect(files['index.ts']).toContain(`import { ${entry} } from './demo';`);
    expect(files['index.ts']).toContain(`${entry}.mount(host);`);
    expect(files['index.html']).toContain('id="app"');
  });

  it('declares a runnable npm project', () => {
    const pkg = JSON.parse(files['package.json']);
    expect(pkg.dependencies['@avi-pathak/apgrid']).toBeTruthy();
    expect(pkg.scripts.dev).toBe('vite');
    expect(pkg.devDependencies.vite).toBeTruthy();

    const rc = JSON.parse(files['.stackblitzrc']);
    expect(rc.installDependencies).toBe(true);
    expect(rc.startCommand).toBe('npm run dev');

    expect(() => JSON.parse(files['tsconfig.json'])).not.toThrow();
  });

  it('builds a valid project for every demo', () => {
    for (const demo of demos) {
      const built = buildSandboxFiles(demo, demoSources[demo.id]);
      const entry = exportNameOf(demoSources[demo.id]);
      expect(built['demo.ts']).not.toContain("'../data'");
      expect(built['index.ts']).toContain(`import { ${entry} } from './demo';`);
      expect(() => JSON.parse(built['package.json'])).not.toThrow();
    }
  });
});
