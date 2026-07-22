const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const entry = path.resolve(__dirname, 'src/index.ts');
const themingEntry = path.resolve(__dirname, 'src/theming/index.ts');
const dist = path.resolve(__dirname, 'dist');

const tsRule = {
  test: /\.ts$/,
  loader: 'ts-loader',
  options: { transpileOnly: true },
  exclude: /node_modules/,
};

const base = {
  mode: 'production',
  devtool: 'source-map',
  entry,
  resolve: { extensions: ['.ts', '.js'] },
  optimization: {
    minimizer: [new TerserPlugin({ extractComments: false }), new CssMinimizerPlugin()],
  },
};

// Styles live in src/index.ts as a single SCSS import. Only the UMD build
// extracts it to dist/apgrid.css; the ESM and CJS builds replace the import with
// an empty module so the bundle has no CSS reference at all (an IgnorePlugin
// would instead stub it to throw at runtime). Consumers load the compiled
// stylesheet separately via "@avi-pathak/apgrid/styles.css".
const dropCss = new webpack.NormalModuleReplacementPlugin(
  /\.s?css$/,
  path.resolve(__dirname, 'build/empty.js'),
);

const scssRule = {
  test: /\.scss$/,
  use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
};

module.exports = [
  {
    ...base,
    name: 'umd',
    output: {
      path: dist,
      filename: 'umd/apgrid.umd.js',
      library: { name: 'ap', type: 'umd' },
      globalObject: 'this',
    },
    module: {
      rules: [tsRule, scssRule],
    },
    plugins: [new MiniCssExtractPlugin({ filename: 'apgrid.css' })],
  },
  {
    ...base,
    name: 'esm',
    experiments: { outputModule: true },
    output: {
      path: path.join(dist, 'esm'),
      filename: 'apgrid.mjs',
      library: { type: 'module' },
      module: true,
    },
    module: { rules: [tsRule] },
    plugins: [dropCss],
  },
  {
    ...base,
    name: 'cjs',
    output: {
      path: path.join(dist, 'cjs'),
      filename: 'apgrid.cjs',
      library: { type: 'commonjs2' },
    },
    module: { rules: [tsRule] },
    plugins: [dropCss],
  },
  // Theming subpath (@avi-pathak/apgrid/theming) — a separate entry so the core
  // grid bundle carries none of it. Pure TS, no styles.
  {
    ...base,
    name: 'theming-esm',
    entry: themingEntry,
    experiments: { outputModule: true },
    output: {
      path: path.join(dist, 'theming'),
      filename: 'apgrid-theming.mjs',
      library: { type: 'module' },
      module: true,
    },
    module: { rules: [tsRule] },
  },
  {
    ...base,
    name: 'theming-cjs',
    entry: themingEntry,
    output: {
      path: path.join(dist, 'theming'),
      filename: 'apgrid-theming.cjs',
      library: { type: 'commonjs2' },
    },
    module: { rules: [tsRule] },
  },
];
