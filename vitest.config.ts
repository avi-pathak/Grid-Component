import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // The example demos import the package by name. Unit tests don't need the
      // built artifacts, so resolve the name to the source barrel — keeping
      // `npm test` fast and build-free. The example *app* (webpack) resolves the
      // same name to the built dist instead, validating the real package.
      '@avi-pathak/apgrid/styles.css': resolve(__dirname, 'src/styles/apgrid.scss'),
      '@avi-pathak/apgrid': resolve(__dirname, 'src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'examples/**/*.test.ts'],
  },
});
