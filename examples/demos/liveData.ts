import { Grid } from '../../src';
import { Demo } from './types';

// Alpha Vantage demo key. Free tier is limited (~25 requests/day), so this demo
// seeds a few real quotes, fills the rest with a synthetic universe, then ticks
// live locally. Swap in your own key from https://www.alphavantage.co/support/#api-key.
const API_KEY = 'EO4KBNLGPBPLBNPC';
const REAL_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'IBM'];
const REAL_SEED: Record<string, number> = {
  AAPL: 225,
  MSFT: 430,
  GOOGL: 178,
  AMZN: 185,
  NVDA: 120,
  META: 505,
  TSLA: 250,
  IBM: 195,
};

interface Stock {
  symbol: string;
  price: number;
  open: number;
  change: number;
  changePct: number;
  /** Last tick direction; drives the arrow and the brief price flash. */
  dir: 'up' | 'down' | '';
  [key: string]: unknown;
}

const money = (v: unknown): string => (v == null ? '' : `$${Number(v).toFixed(2)}`);

// A colored, arrowed cell for the change columns — green ▲ when up on the day,
// red ▼ when down, matching a real ticker (arrow, color, and sign all agree).
const changeCell = (text: string, s: Stock): string => {
  const up = s.change > 0;
  const down = s.change < 0;
  const cls = up ? 'demo-up' : down ? 'demo-down' : 'demo-flat';
  const glyph = up ? '▲' : down ? '▼' : '•';
  return `<span class="demo-tick ${cls}">${glyph} ${text}</span>`;
};

export const liveData: Demo = {
  id: 'live-data',
  title: 'Live data',
  tagline:
    'A streaming ticker: hundreds of symbols updating live with up/down arrows and price flashes.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const toggleBtn = button('Pause');
    const readout = document.createElement('span');
    readout.className = 'apg-demo-readout';
    toolbar.append(toggleBtn, readout);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const stocks = buildUniverse(600);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'symbol', header: 'Symbol', width: 100 },
        {
          binding: 'price',
          header: 'Price',
          width: 120,
          dataType: 'Number',
          valueFormatter: money,
          // Flash the price green/red on a tick; it fades back via a CSS transition.
          cellClass: ({ item }) => {
            const d = (item as Stock).dir;
            return d === 'up'
              ? 'demo-num demo-flash-up'
              : d === 'down'
                ? 'demo-num demo-flash-down'
                : 'demo-num';
          },
        },
        {
          binding: 'change',
          header: 'Change',
          width: 130,
          dataType: 'Number',
          cellTemplate: ({ value, item }) => changeCell(signed(value), item as Stock),
        },
        {
          binding: 'changePct',
          header: '% Change',
          width: 120,
          dataType: 'Number',
          cellTemplate: ({ value, item }) => changeCell(`${signed(value)}%`, item as Stock),
        },
      ],
      itemsSource: stocks,
    });

    let ticks = 0;
    let source = 'simulated';
    const status = (): void => {
      readout.textContent = `${stocks.length} symbols · ${source} · ${ticks} ticks/s`;
    };
    status();

    // Each tick: clear last flags, then move a random slice of the market. Only
    // touching a subset keeps the render cheap while still looking busy.
    const tick = (): void => {
      for (const s of stocks) s.dir = '';
      const moves = Math.min(stocks.length, 80);
      for (let i = 0; i < moves; i++) {
        const s = stocks[(Math.random() * stocks.length) | 0];
        const delta = (Math.random() - 0.5) * s.open * 0.006;
        s.price = Math.max(0.5, s.price + delta);
        s.change = s.price - s.open;
        s.changePct = (s.change / s.open) * 100;
        s.dir = delta >= 0 ? 'up' : 'down';
      }
      ticks++;
      grid.invalidate();
    };

    // A brisk interval; only the visible rows repaint, so it stays smooth.
    const INTERVAL = 250;
    let timer = window.setInterval(tick, INTERVAL);
    let running = true;
    // Update the ticks/second readout once a second without repainting the grid.
    const statusTimer = window.setInterval(() => {
      status();
      ticks = 0;
    }, 1000);
    toggleBtn.addEventListener('click', () => {
      running = !running;
      toggleBtn.textContent = running ? 'Pause' : 'Resume';
      if (running) timer = window.setInterval(tick, INTERVAL);
      else window.clearInterval(timer);
    });

    // Seed a few real opening prices from Alpha Vantage (best-effort, sequential
    // to respect the rate limit). Falls back to synthetic prices on any failure.
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
            s.open = price;
            s.price = price;
            s.change = 0;
            s.changePct = 0;
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

// Build a scrollable universe: the real symbols first, then synthetic tickers.
function buildUniverse(count: number): Stock[] {
  const out: Stock[] = REAL_SYMBOLS.map((symbol) => {
    const open = REAL_SEED[symbol];
    return { symbol, price: open, open, change: 0, changePct: 0, dir: '' };
  });
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const seen = new Set(REAL_SYMBOLS);
  while (out.length < count) {
    let symbol = '';
    for (let i = 0; i < 4; i++) symbol += letters[(Math.random() * 26) | 0];
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    const open = Math.round((5 + Math.random() * 800) * 100) / 100;
    out.push({ symbol, price: open, open, change: 0, changePct: 0, dir: '' });
  }
  return out;
}

function signed(v: unknown): string {
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;
}

function button(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'apg-demo-btn';
  b.textContent = text;
  return b;
}
