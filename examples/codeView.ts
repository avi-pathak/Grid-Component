/**
 * A dependency-free TypeScript syntax highlighter and source panel.
 *
 * The demo app ships zero runtime dependencies, and so does its site — pulling
 * in a full highlighter would be far more machinery than the handful of token
 * classes this needs. The tokenizer below is deliberately shallow: it is good
 * enough for the demo sources (which share one consistent house style) and
 * degrades to plain text rather than mangling anything it does not recognise.
 */

const KEYWORDS =
  'as|async|await|break|case|catch|class|const|continue|declare|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|keyof|let|new|of|private|protected|public|readonly|return|satisfies|set|static|super|switch|this|throw|try|type|typeof|var|void|while|yield';

const LITERALS = 'true|false|null|undefined|NaN|Infinity';

// Ordered alternation: comments and strings must win over everything else, or
// a keyword inside a string would be coloured as code.
const TOKENS = new RegExp(
  [
    '(?<comment>/\\*[\\s\\S]*?\\*/|//[^\\n]*)',
    '(?<string>`(?:\\\\.|[^`\\\\])*`|\'(?:\\\\.|[^\'\\\\\\n])*\'|"(?:\\\\.|[^"\\\\\\n])*")',
    '(?<number>\\b\\d[\\d_]*(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b)',
    `(?<keyword>\\b(?:${KEYWORDS})\\b)`,
    `(?<literal>\\b(?:${LITERALS})\\b)`,
    '(?<type>\\b[A-Z][A-Za-z0-9_]*\\b)',
    '(?<fn>\\b[a-z_$][\\w$]*(?=\\s*[(<]))',
    '(?<prop>(?<=\\.)[a-z_$][\\w$]*)',
  ].join('|'),
  'gy',
);

const CLASS_OF: Record<string, string> = {
  comment: 'tok-comment',
  string: 'tok-string',
  number: 'tok-number',
  keyword: 'tok-keyword',
  literal: 'tok-literal',
  type: 'tok-type',
  fn: 'tok-fn',
  prop: 'tok-prop',
};

interface Token {
  text: string;
  cls: string | null;
}

const escapeHtml = (text: string): string =>
  text.replace(/[&<>]/g, (ch) => (ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'));

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    TOKENS.lastIndex = index;
    const match = TOKENS.exec(source);

    if (!match) {
      // Nothing matches at this position — emit one plain character and retry.
      // Scanning character by character keeps the tokenizer total: it can never
      // stall or drop input, whatever the source contains.
      tokens.push({ text: source[index], cls: null });
      index += 1;
      continue;
    }

    const name = Object.keys(match.groups ?? {}).find((key) => match.groups?.[key] != null);
    tokens.push({ text: match[0], cls: name ? CLASS_OF[name] : null });
    index += match[0].length;
  }

  return tokens;
}

/**
 * Render source as one `<span class="code-line">` per line. Tokens that span
 * newlines (block comments, template literals) are split at the line break so
 * each line stays a self-contained, well-formed element — which is what lets
 * the line numbers come from a plain CSS counter.
 */
export function highlightTs(source: string): string {
  const lines: string[] = [];
  let current = '';

  for (const token of tokenize(source)) {
    const parts = token.text.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) {
        lines.push(current);
        current = '';
      }
      if (!part) return;
      current += token.cls
        ? `<span class="${token.cls}">${escapeHtml(part)}</span>`
        : escapeHtml(part);
    });
  }
  lines.push(current);

  return lines.map((line) => `<span class="code-line">${line || ' '}</span>`).join('');
}

export interface CodeViewOptions {
  source: string;
  /** Shown in the panel's title bar, e.g. `grouping.ts`. */
  fileName: string;
  /** Rendered to the right of the copy button — used for the sandbox link. */
  actions?: HTMLElement[];
}

/** Build a titled, line-numbered, copyable source panel. */
export function createCodeView({ source, fileName, actions = [] }: CodeViewOptions): HTMLElement {
  const panel = document.createElement('figure');
  panel.className = 'code-panel';

  const bar = document.createElement('figcaption');
  bar.className = 'code-bar';

  const name = document.createElement('span');
  name.className = 'code-file';
  name.textContent = fileName;

  const lineCount = document.createElement('span');
  lineCount.className = 'code-meta';
  const total = source.split('\n').length;
  lineCount.textContent = `${total} lines`;

  const tools = document.createElement('div');
  tools.className = 'code-tools';
  tools.append(...actions, createCopyButton(source));

  bar.append(name, lineCount, tools);

  const pre = document.createElement('pre');
  pre.className = 'code-body';
  pre.tabIndex = 0;
  const code = document.createElement('code');
  code.innerHTML = highlightTs(source);
  pre.appendChild(code);

  panel.append(bar, pre);
  return panel;
}

function createCopyButton(source: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-ghost btn-sm';
  button.innerHTML = `${copyIcon}<span>Copy</span>`;

  let resetTimer: number | undefined;
  button.addEventListener('click', () => {
    void navigator.clipboard
      .writeText(source)
      .then(() => flash('Copied', true))
      .catch(() => flash('Press ctrl+C', false));
  });

  function flash(message: string, ok: boolean): void {
    button.classList.toggle('is-ok', ok);
    button.innerHTML = `${ok ? checkIcon : copyIcon}<span>${message}</span>`;
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      button.classList.remove('is-ok');
      button.innerHTML = `${copyIcon}<span>Copy</span>`;
    }, 1600);
  }

  return button;
}

const copyIcon =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="9" rx="1.5"/><path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-7a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h1"/></svg>';

const checkIcon =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.5 3.5 3.5L13 5"/></svg>';
