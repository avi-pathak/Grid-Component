export interface Demo {
  id: string;
  title: string;
  tagline: string;
  /** Build the demo into the given host. Return a cleanup function. */
  mount(host: HTMLElement): () => void;
}
