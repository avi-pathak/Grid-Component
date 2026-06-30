/**
 * Editor types for a data-mapped column, matching Wijmo's DataMapEditor values.
 * The grid picks the matching editor when a column with a {@link DataMap} enters
 * edit mode.
 */
export enum DataMapEditor {
  /** Input with an autocomplete list; accepts typed values when the map is editable. */
  AutoComplete = 0,
  /** Dropdown list (a native select). The default. */
  DropDownList = 1,
  /** Radio buttons with mouse and keyboard support. */
  RadioButtons = 2,
  /** Dropdown only, no accompanying input. */
  Menu = 3,
}
