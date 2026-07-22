import {
  ThemeParams,
  presets,
  defaultPreset,
  themeToCss,
  clearTheme,
  deriveTokens,
  parseColor,
  toHex,
} from '@avi-pathak/apgrid/theming';
import { mountControls } from './controls';
import { mountPreview } from './preview';
import { createCodeView } from '../codeView';
import { icon } from '../icons';

// The Theme Builder page: a control rail on the left, a live preview grid and the
// generated CSS on the right. Every change runs the library's real `applyTheme`
// against the preview and regenerates `themeToCss` output — so what you see and
// what you copy come from the same derivation a consumer would run.

const SELECTOR = '.apg-theme-custom';

/** Fill in any optional param (e.g. an unset header background) with a concrete
 *  hex value, so every colour input has something valid to show. */
function normalize(params: ThemeParams): ThemeParams {
  const headerBg =
    params.headerBackgroundColor ?? toHex(parseColor(deriveTokens(params)['header-bg']));
  return {
    ...params,
    headerBackgroundColor: headerBg,
    selectionRingWidth: params.selectionRingWidth ?? 1,
  };
}

export function renderThemeBuilder(main: HTMLElement): () => void {
  let params = normalize(structuredClone(defaultPreset.params));

  main.innerHTML = `
    <div class="tb">
      <aside class="tb-controls" id="tb-controls">
        <div class="tb-presets">
          <span class="tb-presets-label">Start from a preset</span>
          <div class="tb-preset-chips" id="tb-presets"></div>
        </div>
      </aside>
      <div class="tb-stage">
        <header class="tb-stage-head">
          <div>
            <span class="demo-eyebrow">Theming</span>
            <h1>Theme Builder</h1>
            <p>Tune the tokens and watch the grid update live. Copy the generated CSS, or start from a preset.</p>
          </div>
        </header>
        <section class="tb-preview" id="tb-preview"></section>
        <section class="tb-output" id="tb-output"></section>
      </div>
    </div>`;

  const controlsHost = main.querySelector('#tb-controls') as HTMLElement;
  const presetsHost = main.querySelector('#tb-presets') as HTMLElement;
  const previewHost = main.querySelector('#tb-preview') as HTMLElement;
  const outputHost = main.querySelector('#tb-output') as HTMLElement;

  const preview = mountPreview(previewHost);

  const controls = mountControls(controlsHost, params, (field, value) => {
    params = { ...params, [field]: value };
    preview.update(params);
    scheduleOutput();
  });

  // Preset chips.
  for (const preset of presets) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tb-preset-chip';
    chip.dataset.id = preset.id;
    chip.textContent = preset.label;
    chip.addEventListener('click', () => {
      params = normalize(structuredClone(preset.params));
      controls.sync(params);
      preview.update(params);
      renderOutput();
      markPreset(preset.id);
    });
    presetsHost.appendChild(chip);
  }

  function markPreset(id: string | null): void {
    for (const chip of presetsHost.querySelectorAll<HTMLElement>('.tb-preset-chip')) {
      chip.classList.toggle('active', chip.dataset.id === id);
    }
  }

  // Output regeneration is debounced so dragging a slider doesn't rebuild the
  // highlighted panel on every pixel; theming itself is applied immediately.
  let outputTimer: number | undefined;
  function scheduleOutput(): void {
    markPreset(null);
    window.clearTimeout(outputTimer);
    outputTimer = window.setTimeout(renderOutput, 140);
  }

  function renderOutput(): void {
    const css = themeToCss(SELECTOR, params);
    outputHost.innerHTML = '';
    const usage = document.createElement('p');
    usage.className = 'code-note';
    usage.innerHTML = `${icon('bolt', 15)}<span>Add <strong>styles.css</strong>, then this rule, then put
      <strong>class="apg apg-theme-custom"</strong> on your grid host — or apply the class to
      <strong>&lt;body&gt;</strong> to theme the pop-up menus and dialogs too.</span>`;
    outputHost.append(createCodeView({ source: css, fileName: 'apgrid-theme.css' }), usage);
  }

  // Initial paint.
  preview.update(params);
  renderOutput();
  markPreset(defaultPreset.id);

  return () => {
    window.clearTimeout(outputTimer);
    preview.dispose();
    // Remove the tokens we wrote to <body> so demos aren't left themed.
    clearTheme(document.body);
  };
}
