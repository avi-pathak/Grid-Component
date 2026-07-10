import { Grid } from '../../src';
import { Demo } from './types';

// Alpha Vantage demo key. Free tier is limited (~25 requests/day), so this demo
// seeds a few real quotes, fills the rest with a synthetic universe, then ticks
// live locally. Swap in your own key from https://www.alphavantage.co/support/#api-key.
const API_KEY = 'EO4KBNLGPBPLBNPC';

const REAL: Record<string, { name: string; price: number }> = {
  AAPL: { name: 'Apple', price: 225 },
  MSFT: { name: 'Microsoft', price: 430 },
  GOOGL: { name: 'Alphabet', price: 178 },
  AMZN: { name: 'Amazon', price: 185 },
  NVDA: { name: 'NVIDIA', price: 120 },
  META: { name: 'Meta Platforms', price: 505 },
  TSLA: { name: 'Tesla', price: 250 },
  IBM: { name: 'IBM', price: 195 },
};
const REAL_SYMBOLS = Object.keys(REAL);

type Dir = 'up' | 'down' | 'flat';
type Field = 'bid' | 'ask' | 'last';

interface Quote {
  v: number;
  open: number;
  pct: number;
  dir: Dir;
  hist: number[];
}

interface Stock {
  symbol: string;
  name: string;
  bid: Quote;
  ask: Quote;
  last: Quote;
  bidSize: number;
  [key: string]: unknown;
}

const money = (v: number): string =>
  v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signedPct = (n: number): string => `${n >= 0 ? '' : '-'}${Math.abs(n).toFixed(1)}%`;

// A small inline sparkline from a field's recent history.
function spark(hist: number[]): string {
  if (hist.length < 2) return '';
  const w = 48;
  const h = 18;
  const min = Math.min(...hist);
  const max = Math.max(...hist);
  const range = max - min || 1;
  const step = w / (hist.length - 1);
  const pts = hist
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ');
  return `<svg class="demo-q-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" /></svg>`;
}

const dirClass = (d: Dir): string =>
  d === 'up' ? 'demo-q-up' : d === 'down' ? 'demo-q-down' : 'demo-q-flat';
const glyph = (d: Dir): string => (d === 'up' ? '▲' : d === 'down' ? '▼' : '●');

export const liveData: Demo = {
  id: 'live-data',
  title: 'Live data',
  tagline:
    'A streaming market ticker: rich cells with value, percent change, direction arrow and a sparkline, updating live.',
  mount(host) {
    let customCells = true;
    let batchSize = 100;

    // A price cell: value + percent + arrow + sparkline, or a plain number when
    // custom cells are switched off.
    const quoteCell = (s: Stock, field: Field): string => {
      const q = s[field];
      if (!customCells) return money(q.v);
      return (
        `<span class="demo-q-val">${money(q.v)}</span>` +
        `<span class="demo-q-pct">${signedPct(q.pct)}</span>` +
        `<span class="demo-q-arrow ${dirClass(q.dir)}">${glyph(q.dir)}</span>` +
        spark(q.hist)
      );
    };
    const quoteClass = (s: Stock, field: Field): string => `demo-q ${dirClass(s[field].dir)}`;

    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const customChk = checkbox('Custom Cells', customCells);
    const autoChk = checkbox('Auto Update', true);
    const intervalInput = numberField('Update Interval (ms)', 100);
    const batchInput = numberField('Batch Size (# items)', batchSize);
    const readout = document.createElement('span');
    readout.className = 'apg-demo-readout';
    toolbar.append(customChk.wrap, autoChk.wrap, intervalInput.wrap, batchInput.wrap, readout);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const stocks = buildUniverse(600);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'symbol', header: '', width: 80, cellClass: () => 'demo-q-sym' },
        { binding: 'name', header: 'Name', width: 200 },
        {
          binding: 'bid',
          header: 'Bid',
          width: 200,
          cellTemplate: ({ item }) => quoteCell(item as Stock, 'bid'),
          cellClass: ({ item }) => quoteClass(item as Stock, 'bid'),
        },
        {
          binding: 'ask',
          header: 'Ask',
          width: 200,
          cellTemplate: ({ item }) => quoteCell(item as Stock, 'ask'),
          cellClass: ({ item }) => quoteClass(item as Stock, 'ask'),
        },
        {
          binding: 'last',
          header: 'Last Sale',
          width: 200,
          cellTemplate: ({ item }) => quoteCell(item as Stock, 'last'),
          cellClass: ({ item }) => quoteClass(item as Stock, 'last'),
        },
        {
          binding: 'bidSize',
          header: 'Bid Size',
          width: 110,
          dataType: 'Number',
          valueFormatter: (v) => (v == null ? '' : String(v)),
        },
      ],
      itemsSource: stocks,
    });

    let ticks = 0;
    let source = 'simulated';
    const status = (): void => {
      readout.textContent = `${stocks.length} symbols · ${source} · ${ticks} updates/s`;
    };
    status();

    const bump = (q: Quote): void => {
      const delta = (Math.random() - 0.5) * q.open * 0.01;
      q.v = Math.max(0.5, q.v + delta);
      q.pct = ((q.v - q.open) / q.open) * 100;
      // Arrow and color follow the percent change so they always agree.
      q.dir = q.pct > 0.05 ? 'up' : q.pct < -0.05 ? 'down' : 'flat';
      q.hist.push(q.v);
      if (q.hist.length > 16) q.hist.shift();
    };

    // Each tick moves a random batch of rows. Only the visible ones repaint.
    const tick = (): void => {
      const moves = Math.min(stocks.length, batchSize);
      for (let i = 0; i < moves; i++) {
        const s = stocks[(Math.random() * stocks.length) | 0];
        bump(s.bid);
        bump(s.ask);
        bump(s.last);
        s.bidSize = 50 + ((Math.random() * 950) | 0);
      }
      ticks++;
      grid.invalidate();
    };

    let interval = intervalInput.input.valueAsNumber || 100;
    let timer = window.setInterval(tick, interval);
    const statusTimer = window.setInterval(() => {
      status();
      ticks = 0;
    }, 1000);

    const restart = (): void => {
      window.clearInterval(timer);
      if (autoChk.input.checked) timer = window.setInterval(tick, interval);
    };

    customChk.input.addEventListener('change', () => {
      customCells = customChk.input.checked;
      grid.invalidate();
    });
    autoChk.input.addEventListener('change', restart);
    intervalInput.input.addEventListener('change', () => {
      interval = Math.max(10, intervalInput.input.valueAsNumber || 100);
      restart();
    });
    batchInput.input.addEventListener('change', () => {
      batchSize = Math.max(1, batchInput.input.valueAsNumber || 1);
    });

    // Seed a few real prices from Alpha Vantage (best-effort, sequential to
    // respect the rate limit). Falls back to synthetic prices on any failure.
    let cancelled = false;
    void (async () => {
      let got = 0;
      for (const symbol of REAL_SYMBOLS) {
        if (cancelled) return;
        const s = stocks.find((x) => x.symbol === symbol);
        if (!s) continue;
        try {
          const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
          const json = await (await fetch(url)).json();
          const price = Number(json['Global Quote']?.['05. price']);
          if (Number.isFinite(price) && price > 0) {
            seedQuotes(s, price);
            got++;
          }
        } catch {
          // ignore — keep the synthetic price
        }
      }
      if (!cancelled && got > 0) {
        source = `${got} live from Alpha Vantage`;
        grid.invalidate();
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearInterval(statusTimer);
      grid.dispose();
      toolbar.remove();
      gridHost.remove();
    };
  },
};

function newQuote(price: number): Quote {
  return { v: price, open: price, pct: 0, dir: 'flat', hist: [price] };
}

function seedQuotes(s: Stock, price: number): void {
  s.bid = newQuote(price * 0.999);
  s.ask = newQuote(price * 1.001);
  s.last = newQuote(price);
}

// Build a scrollable universe: the real symbols first, then synthetic tickers.
function buildUniverse(count: number): Stock[] {
  const make = (symbol: string, name: string, price: number): Stock => ({
    symbol,
    name,
    bid: newQuote(price * 0.999),
    ask: newQuote(price * 1.001),
    last: newQuote(price),
    bidSize: 50 + ((Math.random() * 950) | 0),
  });

  const out: Stock[] = REAL_SYMBOLS.map((symbol) =>
    make(symbol, REAL[symbol].name, REAL[symbol].price),
  );

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const suffixes = ['Holdings', 'Group', 'Corp', 'Industries', 'Partners', 'Systems', 'Global'];
  const seen = new Set(REAL_SYMBOLS);
  while (out.length < count) {
    let symbol = '';
    for (let i = 0; i < 4; i++) symbol += letters[(Math.random() * 26) | 0];
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    const name = `${symbol[0]}${symbol.slice(1).toLowerCase()} ${suffixes[(Math.random() * suffixes.length) | 0]}`;
    const price = Math.round((5 + Math.random() * 800) * 100) / 100;
    out.push(make(symbol, name, price));
  }
  return out;
}

function checkbox(
  label: string,
  checked: boolean,
): { wrap: HTMLLabelElement; input: HTMLInputElement } {
  const wrap = document.createElement('label');
  wrap.className = 'apg-demo-field apg-demo-check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  wrap.append(input, document.createTextNode(` ${label}`));
  return { wrap, input };
}

function numberField(
  label: string,
  value: number,
): { wrap: HTMLLabelElement; input: HTMLInputElement } {
  const wrap = document.createElement('label');
  wrap.className = 'apg-demo-field';
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'apg-demo-input';
  input.value = String(value);
  wrap.append(document.createTextNode(`${label} `), input);
  return { wrap, input };
}
