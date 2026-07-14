import type { Grid } from '../../src';

export interface Demo {
  id: string;
  title: string;
  tagline: string;
  /**
   * Build the demo into the given host. Return a cleanup function, or an object
   * with `dispose` plus the demo's `grid` so the shell can offer a global export
   * control for it.
   */
  mount(host: HTMLElement): DemoHandle;
}

export type DemoHandle = (() => void) | { dispose: () => void; grid?: Grid | (() => Grid) };

