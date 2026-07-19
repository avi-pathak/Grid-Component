#!/usr/bin/env node
// Packs the current build into a tarball and installs it into examples/ as a
// real npm dependency (via `file:`), so the demo app exercises exactly what a
// real consumer gets from `npm install @avi-pathak/apgrid` — resolved through
// the package's own `exports`/`files`/`main` fields against the built `dist/`
// — instead of a registry version or a symlink into the monorepo. Run `npm
// run build` first (or use `npm run pack:examples`, which does both).
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const examplesDir = path.join(root, 'examples');
const tarballName = 'apgrid-local.tgz';
const tarballPath = path.join(examplesDir, tarballName);

// `npm pack --json` reports the exact filename it produced (it's versioned,
// e.g. avi-pathak-apgrid-0.1.4.tgz) so we don't have to guess it.
const packOutput = execFileSync(
  'npm',
  ['pack', '--json', '--pack-destination', examplesDir],
  { cwd: root, encoding: 'utf8' },
);
const [{ filename }] = JSON.parse(packOutput);
const producedPath = path.join(examplesDir, filename);

fs.rmSync(tarballPath, { force: true });
fs.renameSync(producedPath, tarballPath);

// npm workspaces hoist @avi-pathak/apgrid to the root node_modules. Remove it
// before reinstalling — npm can otherwise skip re-extracting a `file:`
// dependency whose path didn't change, even though its contents did.
fs.rmSync(path.join(root, 'node_modules', '@avi-pathak'), { recursive: true, force: true });

execFileSync('npm', ['install'], { cwd: root, stdio: 'inherit' });

console.log(`\nPacked and installed ${filename} as examples/${tarballName}`);
