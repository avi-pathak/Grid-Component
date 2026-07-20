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

// Extract the tarball into node_modules ourselves instead of running
// `npm install`.
//
// npm cannot be trusted to refresh this: package-lock.json pins an integrity
// hash for the `file:` dependency, and npm will happily restore the *cached*
// tarball matching that old hash rather than the new one on disk — even after
// deleting node_modules/@avi-pathak first. That silently serves a stale build
// to the demo app, so source changes appear not to take effect at all.
//
// Extracting is also exactly what npm itself would do with the tarball (it
// unpacks the `package/` prefix), so the demo still consumes the package
// through its own package.json `exports`/`main`, not monorepo source.
const installDir = path.join(root, 'node_modules', '@avi-pathak', 'apgrid');
fs.rmSync(installDir, { recursive: true, force: true });
fs.mkdirSync(installDir, { recursive: true });
execFileSync('tar', ['-xzf', tarballPath, '-C', installDir, '--strip-components=1']);

console.log(`\nPacked and installed ${filename} as examples/${tarballName}`);
