import { Demo } from './demos/types';
import { demoSources, sharedSources, exportNameOf } from './demos/sources';

/**
 * Opens the current demo in a live, editable StackBlitz sandbox.
 *
 * The sandbox is assembled from the demo's *real* source — the same text the
 * Code tab shows — plus the two modules every demo imports and the shared demo
 * stylesheet. It runs Vite over the published npm package, so what opens is a
 * genuine consumer project a reader can edit, not a rehearsed snippet.
 *
 * StackBlitz's `/run` endpoint takes a plain multipart form POST, which is why
 * this needs no SDK: build a hidden form, submit it into a new tab, done.
 */

const ENDPOINT = 'https://stackblitz.com/run';

// Deliberately `latest` rather than the running VERSION: the sandbox installs
// from the public registry, and a locally-built version may not be published
// yet. A playground wants "works when clicked" over exact version parity.
const PACKAGE_SPEC = 'latest';

/** Files are flat in the sandbox, so `../data` has to become `./data`. */
const flattenImports = (source: string): string => source.replace(/'\.\.\/data'/g, "'./data'");

/** The sandbox's file map. Exported so it can be asserted on without a network. */
export function buildSandboxFiles(demo: Demo, source: string): Record<string, string> {
  const entry = exportNameOf(source);

  return {
    'index.html': [
      '<!doctype html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      `    <title>apgrid — ${demo.title}</title>`,
      '  </head>',
      '  <body>',
      '    <main id="app"></main>',
      '    <script type="module" src="/index.ts"></script>',
      '  </body>',
      '</html>',
      '',
    ].join('\n'),

    'index.ts': [
      "import '@avi-pathak/apgrid/styles.css';",
      "import './demo.css';",
      "import './app.css';",
      `import { ${entry} } from './demo';`,
      '',
      `// Mount the demo exactly as the docs site does. Edit demo.ts and Vite`,
      `// will hot-reload the grid.`,
      "const host = document.getElementById('app') as HTMLElement;",
      `${entry}.mount(host);`,
      '',
    ].join('\n'),

    'demo.ts': flattenImports(source),
    'data.ts': sharedSources.data,
    'types.ts': sharedSources.types,
    'demo.css': sharedSources.css,

    'app.css': [
      'body {',
      '  margin: 0;',
      '  padding: 24px;',
      '  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
      '  color: #1f2937;',
      '  background: #f4f6fa;',
      '}',
      '',
      "/* Add the class below to <body> to see the grid's built-in dark theme. */",
      'body.apg-theme-dark {',
      '  color: #e6e9ee;',
      '  background: #12151b;',
      '}',
      '',
    ].join('\n'),

    'package.json': `${JSON.stringify(
      {
        name: `apgrid-${demo.id}`,
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build' },
        dependencies: { '@avi-pathak/apgrid': PACKAGE_SPEC },
        devDependencies: { typescript: '^5.4.5', vite: '^5.2.0' },
      },
      null,
      2,
    )}\n`,

    'tsconfig.json': `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2018',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          lib: ['ES2018', 'DOM', 'DOM.Iterable'],
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ['.'],
      },
      null,
      2,
    )}\n`,

    '.stackblitzrc': `${JSON.stringify(
      { installDependencies: true, startCommand: 'npm run dev' },
      null,
      2,
    )}\n`,

    'README.md': [
      `# apgrid — ${demo.title}`,
      '',
      demo.tagline,
      '',
      'This sandbox is the `' + demo.id + '` demo from the apgrid docs site, running against the',
      'published npm package. `demo.ts` is the demo itself — edit it and the preview',
      'reloads.',
      '',
      '- Docs: https://github.com/avi-pathak/Grid-Component',
      '- Package: https://www.npmjs.com/package/@avi-pathak/apgrid',
      '',
    ].join('\n'),
  };
}

/** POST the assembled project to StackBlitz, opening it in a new tab. */
export function openInStackBlitz(demo: Demo): void {
  const source = demoSources[demo.id];
  if (!source) return;

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = ENDPOINT;
  form.target = '_blank';
  form.style.display = 'none';

  const field = (name: string, value: string): void => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };

  field('project[title]', `apgrid — ${demo.title}`);
  field('project[description]', demo.tagline);
  field('project[template]', 'node');
  for (const [path, contents] of Object.entries(buildSandboxFiles(demo, source))) {
    field(`project[files][${path}]`, contents);
  }

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export const hasSandbox = (demo: Demo): boolean => demoSources[demo.id] != null;
