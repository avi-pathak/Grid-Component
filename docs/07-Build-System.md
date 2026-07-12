# 07 — Build System

How `@avi-pathak/apgrid` is compiled, bundled, and published.

## Toolchain

| Concern | Tool |
| --- | --- |
| Language | TypeScript 5 (strict) |
| Bundler | Webpack 5 |
| Type declarations | `tsc --emitDeclarationOnly` |
| Styles | SCSS via `sass` + `sass-loader`, extracted with `mini-css-extract-plugin` + `css-minimizer-webpack-plugin` |
| Minification | `terser-webpack-plugin` |
| Lint / format | ESLint + Prettier |
| Hooks | Husky + lint-staged |
| Versioning | Changesets |
| Dev server | `webpack-dev-server` |

Runtime dependencies: **none**. Everything above is a dev dependency.

## Output layout

`npm run build` produces:

```
dist/
├── esm/apgrid.mjs        # ES module (import)
├── cjs/apgrid.cjs        # CommonJS (require)
├── umd/apgrid.umd.js     # UMD, global "ApGrid" (script tag)
├── apgrid.css            # extracted stylesheet (light + dark)
├── apgrid-light.css      # light-only theme
├── apgrid-dark.css       # dark-first theme
├── *.map                 # source maps for each bundle
└── types/                # .d.ts tree, entry at types/index.d.ts
```

The three JS formats are produced by a Webpack **multi-compiler** (an array of
configs) sharing one base. See [webpack.config.js](../webpack.config.js).

## How the formats are produced

| Format | `output.library.type` | Notes |
| --- | --- | --- |
| UMD | `umd` | `globalObject: 'this'`, global name `ApGrid` |
| ESM | `module` | needs `experiments.outputModule` |
| CJS | `commonjs2` | classic `require` interop |

### Styles (SCSS)

Styles are authored in **SCSS** under `src/styles/`: a token layer
(`_tokens.scss`) plus feature partials (`_base`, `_header`, `_cells`, `_frozen`,
`_editors`, `_grouping`, `_overlays`, `_theme-dark`), composed by the entry
`apgrid.scss`. `sass-loader` compiles it and the library imports it exactly once
from `src/index.ts`.

Only the **UMD** build extracts it to `dist/apgrid.css` (via
`mini-css-extract-plugin`); the ESM and CJS builds drop the import with
`webpack.IgnorePlugin` so the three compilers never write the same file in
parallel. A separate `build:themes` step compiles the single-theme entries
`apgrid-light.scss` / `apgrid-dark.scss` to `dist/apgrid-light.css` and
`dist/apgrid-dark.css` with the Sass CLI.

Consumers load a stylesheet separately:

```ts
import '@avi-pathak/apgrid/styles.css';        // light + dark (class-gated)
// or a single theme:
import '@avi-pathak/apgrid/styles-light.css';
import '@avi-pathak/apgrid/styles-dark.css';
// or compose the SCSS partials directly:
// @use '@avi-pathak/apgrid/scss/apgrid';
```

**Theming.** Every value is a `--apg-*` CSS custom property on `.apg`, so a
consumer retheme is just a variable override — no recompile. Dark mode ships in
the default stylesheet, opt-in via the `apg-theme-dark` class on the grid host
(or any ancestor); `apg-theme-auto` follows `prefers-color-scheme`. This mirrors
how AG Grid (Quartz/Alpine) and Wijmo ship token-driven, class-switchable themes
while keeping the JS free of injected styles.

## package.json wiring

```jsonc
"main":   "./dist/cjs/apgrid.cjs",   // require()
"module": "./dist/esm/apgrid.mjs",   // bundler import
"types":  "./dist/types/index.d.ts",
"exports": {
  ".": {
    "types":   "./dist/types/index.d.ts",
    "import":  "./dist/esm/apgrid.mjs",
    "require": "./dist/cjs/apgrid.cjs"
  },
  "./styles.css": "./dist/apgrid.css"
},
"sideEffects": ["**/*.css"]   // everything else is tree-shakeable
```

`sideEffects` lists only CSS, so bundlers can drop any unused exports from the JS while
keeping the stylesheet.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with the example app on `:5173` |
| `npm run build` | Clean, bundle the three formats, emit `.d.ts` |
| `npm run build:js` | Webpack library build only |
| `npm run build:types` | Type declarations only |
| `npm run typecheck` | `tsc --noEmit` against the strict config |
| `npm run lint` | ESLint over `src` |
| `npm run format` | Prettier write |
| `npm run test` | Vitest unit tests |
| `npm run release` | Build, then `changeset publish` |

## TypeScript configs

- [tsconfig.json](../tsconfig.json) — strict base used by the editor, ts-loader, and
  `typecheck`. `noEmit` is applied via the CLI flag.
- [tsconfig.build.json](../tsconfig.build.json) — extends the base, emits **declarations
  only** into `dist/types`.

`ts-loader` runs in `transpileOnly` mode for fast bundling; type safety is enforced
separately by `npm run typecheck` (and in CI). This keeps the bundle step quick while
still failing the pipeline on type errors.

## Publishing

1. `npm run changeset` — record the change and the semver bump.
2. `changeset version` — apply the bump and update the changelog.
3. `npm run release` — `prepublishOnly` rebuilds `dist`, then `changeset publish`
   pushes to npm. `files` limits the package to `dist`.

The package name is scoped (`@avi-pathak/apgrid`) and the changeset access is `public`.

## Verifying a build

```bash
npm run build
npm pack --dry-run    # inspect exactly what would publish
```

Expect `dist/esm`, `dist/cjs`, `dist/umd`, `dist/apgrid.css`, source maps, and
`dist/types/index.d.ts` in the output.
