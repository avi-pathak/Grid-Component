const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// This is a standalone demo app that depends on `@avi-pathak/apgrid` like any
// downstream consumer — installed from a local `npm pack` tarball
// (examples/apgrid-local.tgz), not the registry, so it always reflects the
// current source rather than the last published version. Imports of
// `@avi-pathak/apgrid` (and its CSS subpaths) resolve through the package's
// own `exports` map to the built `dist/` inside that tarball — no aliases.
// Run `npm run pack:examples` at the repo root first (or `npm run dev`, which
// does it automatically) so the tarball and its extracted copy exist.

module.exports = {
  mode: 'development',
  entry: './main.ts',
  devtool: 'eval-source-map',
  resolve: { extensions: ['.ts', '.js'] },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: { transpileOnly: true },
        exclude: /node_modules/,
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.scss$/, use: ['style-loader', 'css-loader', 'sass-loader'] },
    ],
  },
  plugins: [new HtmlWebpackPlugin({ template: './index.html' })],
  devServer: {
    static: path.resolve(__dirname),
    port: 5174,
    open: true,
    hot: true,
  },
};
