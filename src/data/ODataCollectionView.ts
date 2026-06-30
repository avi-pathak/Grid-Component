import { CollectionView, CollectionViewOptions } from './CollectionView';
import { EventBus, EventHandler } from '../events/EventBus';

type FieldType = 'Number' | 'Date' | 'Boolean' | 'String';

export interface ODataOptions<T> extends CollectionViewOptions<T> {
  /** Fields to retrieve ($select). Empty means all fields. */
  fields?: string[];
  /** Sort on the server via $orderby. Default true. */
  sortOnServer?: boolean;
  /** Filter on the server via $filter. Default true. */
  filterOnServer?: boolean;
  /** Page on the server via $top/$skip. Default true. */
  pageOnServer?: boolean;
  /** OData $filter expression applied on the server. */
  filterDefinition?: string;
  requestHeaders?: Record<string, string>;
  /** Coerce specific fields after loading (e.g. { Freight: 'Number' }). */
  dataTypes?: Record<string, FieldType>;
}

interface LoadEvents {
  loading: void;
  loaded: void;
  error: unknown;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;

/**
 * A {@link CollectionView} backed by an OData service. Sorting, filtering, and
 * paging run on the server through $orderby/$filter/$top/$skip; the view holds
 * the current server page.
 */
export class ODataCollectionView<T = Record<string, unknown>> extends CollectionView<T> {
  readonly url: string;
  readonly tableName: string;
  fields: string[];
  filterDefinition: string;
  sortOnServer: boolean;
  filterOnServer: boolean;
  pageOnServer: boolean;
  requestHeaders: Record<string, string>;
  dataTypes: Record<string, FieldType>;

  protected loadEvents = new EventBus<LoadEvents>();
  protected _isLoading = false;

  constructor(url: string, tableName: string, options: ODataOptions<T> = {}) {
    super([], options);
    this.url = /\/$/.test(url) ? url : `${url}/`;
    this.tableName = tableName;
    this.fields = options.fields ?? [];
    this.filterDefinition = options.filterDefinition ?? '';
    this.sortOnServer = options.sortOnServer ?? true;
    this.filterOnServer = options.filterOnServer ?? true;
    this.pageOnServer = options.pageOnServer ?? true;
    this.requestHeaders = options.requestHeaders ?? {};
    this.dataTypes = options.dataTypes ?? {};
    this.load();
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  onLoading(handler: EventHandler<void>): () => void {
    return this.loadEvents.on('loading', handler);
  }

  onLoaded(handler: EventHandler<void>): () => void {
    return this.loadEvents.on('loaded', handler);
  }

  onError(handler: EventHandler<unknown>): () => void {
    return this.loadEvents.on('error', handler);
  }

  // The base setters (pageSize, sort, filter) call refresh(); reload from server.
  refresh(): void {
    if (!this.url) return; // guard: base constructor calls refresh() before url is set
    this.load();
  }

  /** Load (or reload) the current page from the server. */
  load(): void {
    if (!this.url) return;
    const top = this.pageOnServer ? this.pageSize : 0;
    const skip = top > 0 ? this.pageIndex * top : 0;
    this.fetchPage(skip, top)
      .then(({ items, total }) => {
        this._totalItemCount = total;
        this.applyServerPage(items);
      })
      .catch((err) => this.failLoad(err));
  }

  protected applyServerPage(items: T[]): void {
    this.source = items;
    this.view = items;
    this._position = items.length ? 0 : -1;
    this.finishLoad();
  }

  protected finishLoad(): void {
    this._isLoading = false;
    this.loadEvents.emit('loaded', undefined);
    this.onChanged('reset');
  }

  protected failLoad(err: unknown): void {
    this._isLoading = false;
    this.loadEvents.emit('error', err);
  }

  protected fetchPage(skip: number, top: number): Promise<{ items: T[]; total: number }> {
    this._isLoading = true;
    this.loadEvents.emit('loading', undefined);
    const requestUrl = `${this.url}${this.tableName}?${this.buildQuery(skip, top)}`;
    return fetch(requestUrl, { headers: this.requestHeaders })
      .then((res) => {
        if (!res.ok) throw new Error(`OData request failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        const value = (data.value ?? data) as T[];
        const total = (data['@odata.count'] as number) ?? value.length;
        this.coerceTypes(value);
        return { items: value, total };
      });
  }

  protected buildQuery(skip: number, top: number): string {
    const params = ['$count=true'];
    if (this.fields.length) params.push(`$select=${this.fields.join(',')}`);
    if (this.sortOnServer && this.sortDescriptions.length) {
      const orderby = this.sortDescriptions
        .map((s) => encodeURIComponent(`${s.property} ${s.ascending ? 'asc' : 'desc'}`))
        .join(',');
      params.push(`$orderby=${orderby}`);
    }
    if (this.filterOnServer && this.filterDefinition) {
      params.push(`$filter=${encodeURIComponent(this.filterDefinition)}`);
    }
    if (top > 0) params.push(`$top=${top}`);
    if (skip > 0) params.push(`$skip=${skip}`);
    return params.join('&');
  }

  // JSON has no Date type, so coerce configured fields (or anything that looks
  // like an ISO date when no types are given).
  private coerceTypes(items: T[]): void {
    const types = this.dataTypes;
    const hasTypes = Object.keys(types).length > 0;
    for (const item of items) {
      const rec = item as Record<string, unknown>;
      for (const key in rec) {
        const value = rec[key];
        const type = types[key];
        if (type === 'Date') rec[key] = value != null ? new Date(value as string) : null;
        else if (type === 'Number') rec[key] = value != null ? Number(value) : null;
        else if (!hasTypes && typeof value === 'string' && ISO_DATE.test(value)) {
          rec[key] = new Date(value);
        }
      }
    }
  }
}
