import type { ThemeParams } from '@avi-pathak/apgrid/theming';

// The control schema. Each entry binds one ThemeParams field to an input; the
// panel is generated from this list so adding a knob is a one-line change.

type Field = keyof ThemeParams;

interface ColorControl {
  kind: 'color';
  field: Field;
  label: string;
}
interface RangeControl {
  kind: 'range';
  field: Field;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}
interface SelectControl {
  kind: 'select';
  field: Field;
  label: string;
  options: { value: string; label: string }[];
}
interface ToggleControl {
  kind: 'toggle';
  field: Field;
  label: string;
}

type Control = ColorControl | RangeControl | SelectControl | ToggleControl;

interface ControlGroup {
  title: string;
  controls: Control[];
}

// These must match the stacks used by the presets (src/theming/presets.ts) exactly,
// so loading a preset selects the right option instead of showing a blank value.
const SANS_TAIL = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const FONT_STACKS: { value: string; label: string }[] = [
  {
    value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    label: 'System sans',
  },
  { value: `'IBM Plex Sans', ${SANS_TAIL}`, label: 'IBM Plex Sans' },
  { value: `'Inter', ${SANS_TAIL}`, label: 'Inter' },
  { value: `'Space Grotesk', ${SANS_TAIL}`, label: 'Space Grotesk' },
  { value: "'Instrument Serif', Georgia, serif", label: 'Instrument Serif' },
  {
    value: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    label: 'Monospace',
  },
];

export const controlGroups: ControlGroup[] = [
  {
    title: 'General',
    controls: [
      { kind: 'select', field: 'fontFamily', label: 'Font family', options: FONT_STACKS },
      {
        kind: 'range',
        field: 'fontSize',
        label: 'Font size',
        min: 10,
        max: 20,
        step: 1,
        unit: 'px',
      },
      { kind: 'color', field: 'backgroundColor', label: 'Background' },
      { kind: 'color', field: 'foregroundColor', label: 'Text' },
      { kind: 'color', field: 'accentColor', label: 'Accent' },
    ],
  },
  {
    title: 'Borders & spacing',
    controls: [
      { kind: 'color', field: 'borderColor', label: 'Border' },
      {
        kind: 'select',
        field: 'borders',
        label: 'Borders',
        options: [
          { value: 'all', label: 'All' },
          { value: 'horizontal', label: 'Horizontal only' },
          { value: 'none', label: 'None' },
        ],
      },
      {
        kind: 'range',
        field: 'selectionRingWidth',
        label: 'Selection ring',
        min: 0,
        max: 4,
        step: 1,
        unit: 'px',
      },
      { kind: 'range', field: 'spacing', label: 'Spacing', min: 2, max: 16, step: 1, unit: 'px' },
      {
        kind: 'range',
        field: 'wrapperRadius',
        label: 'Wrapper radius',
        min: 0,
        max: 20,
        step: 1,
        unit: 'px',
      },
      {
        kind: 'range',
        field: 'widgetRadius',
        label: 'Widget radius',
        min: 0,
        max: 16,
        step: 1,
        unit: 'px',
      },
    ],
  },
  {
    title: 'Header & rows',
    controls: [
      { kind: 'color', field: 'headerBackgroundColor', label: 'Header background' },
      { kind: 'toggle', field: 'oddRowStriping', label: 'Alternating row stripes' },
    ],
  },
  {
    title: 'Density',
    controls: [
      {
        kind: 'range',
        field: 'rowHeight',
        label: 'Row height',
        min: 20,
        max: 52,
        step: 1,
        unit: 'px',
      },
      {
        kind: 'range',
        field: 'headerHeight',
        label: 'Header height',
        min: 24,
        max: 60,
        step: 1,
        unit: 'px',
      },
    ],
  },
];

export interface ControlPanelHandle {
  /** Push external state (e.g. after a preset change) back into the inputs. */
  sync(params: ThemeParams): void;
}

/**
 * Render the control panel into `host`. `onChange` fires with the changed field
 * and its new value whenever any input moves.
 */
export function mountControls(
  host: HTMLElement,
  initial: ThemeParams,
  onChange: <K extends Field>(field: K, value: ThemeParams[K]) => void,
): ControlPanelHandle {
  const inputs = new Map<Field, HTMLInputElement | HTMLSelectElement>();
  const valueLabels = new Map<Field, HTMLElement>();

  for (const group of controlGroups) {
    const section = document.createElement('section');
    section.className = 'tb-group';
    const heading = document.createElement('h3');
    heading.className = 'tb-group-title';
    heading.textContent = group.title;
    section.appendChild(heading);

    for (const control of group.controls) {
      section.appendChild(buildControl(control, initial, inputs, valueLabels, onChange));
    }
    host.appendChild(section);
  }

  return {
    sync(params) {
      for (const [field, input] of inputs) {
        const value = params[field];
        if (input instanceof HTMLInputElement && input.type === 'checkbox') {
          input.checked = Boolean(value);
        } else {
          input.value = String(value ?? '');
        }
        const label = valueLabels.get(field);
        if (label) label.textContent = String(value ?? '');
      }
    },
  };
}

function buildControl(
  control: Control,
  initial: ThemeParams,
  inputs: Map<Field, HTMLInputElement | HTMLSelectElement>,
  valueLabels: Map<Field, HTMLElement>,
  onChange: <K extends Field>(field: K, value: ThemeParams[K]) => void,
): HTMLElement {
  const row = document.createElement('label');
  row.className = 'tb-control';

  const label = document.createElement('span');
  label.className = 'tb-control-label';
  label.textContent = control.label;
  row.appendChild(label);

  const current = initial[control.field];

  if (control.kind === 'color') {
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'tb-color';
    input.value = toHexish(current);
    input.addEventListener('input', () => onChange(control.field, input.value as never));
    inputs.set(control.field, input);
    row.appendChild(input);
  } else if (control.kind === 'range') {
    const wrap = document.createElement('span');
    wrap.className = 'tb-range-wrap';
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'tb-range';
    input.min = String(control.min);
    input.max = String(control.max);
    input.step = String(control.step);
    input.value = String(current);
    const readout = document.createElement('span');
    readout.className = 'tb-range-value';
    readout.textContent = `${current}${control.unit}`;
    input.addEventListener('input', () => {
      readout.textContent = `${input.value}${control.unit}`;
      onChange(control.field, Number(input.value) as never);
    });
    inputs.set(control.field, input);
    valueLabels.set(control.field, readout);
    wrap.append(input, readout);
    row.appendChild(wrap);
  } else if (control.kind === 'select') {
    const select = document.createElement('select');
    select.className = 'tb-select';
    for (const opt of control.options) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      select.appendChild(o);
    }
    select.value = String(current);
    select.addEventListener('change', () => onChange(control.field, select.value as never));
    inputs.set(control.field, select);
    row.appendChild(select);
  } else {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'tb-toggle';
    input.checked = Boolean(current);
    input.addEventListener('change', () => onChange(control.field, input.checked as never));
    inputs.set(control.field, input);
    row.appendChild(input);
  }

  return row;
}

// Colour inputs need `#rrggbb`. Preset colours are already hex; anything else
// falls back to a neutral so the input is never left empty/invalid.
function toHexish(value: ThemeParams[keyof ThemeParams]): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
}
