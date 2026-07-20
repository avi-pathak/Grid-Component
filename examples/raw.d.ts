// `?raw` imports resolve to the file's text: webpack maps them to `asset/source`
// (see webpack.config.js) and Vitest/Vite support the suffix natively.
declare module '*?raw' {
  const source: string;
  export default source;
}
