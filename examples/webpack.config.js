const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// This is a standalone demo app that depends on `@avi-pathak/apgrid` like any
// downstream consumer. In this workspace the dependency is symlinked from the
// repo root, so imports of `@avi-pathak/apgrid` (and its CSS subpaths) resolve
// through the package's own `exports` map to the built `dist/` — no aliases.
// Run `npm run build` at the repo root first so `dist/` exists.

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
