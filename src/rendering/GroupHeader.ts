import { CollectionViewGroup } from '../data/CollectionViewGroup';

/** What a {@link GroupHeaderTemplate} receives for one group-header row. */
export interface GroupHeaderContext<T = Record<string, unknown>> {
  group: CollectionViewGroup<T>;
  /** Nesting depth, 0 for the outermost groups. */
  level: number;
  collapsed: boolean;
  itemCount: number;
}

/**
 * Renders the inner content of a group-header row (the part after the
 * expand/collapse chevron). Return an HTML string or an element. Mirrors the
 * "inner renderer" idea from other grids: the chevron and aggregate cells stay
 * grid-managed while the label is yours to customize.
 */
export type GroupHeaderTemplate<T = Record<string, unknown>> = (
  ctx: GroupHeaderContext<T>,
) => string | HTMLElement;
