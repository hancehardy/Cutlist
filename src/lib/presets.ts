import { DEFAULTS, RULE_KEYS, parseDim, type DefaultKey, type RawDefaults } from './engine';

/** A named construction method: rule overrides only. Materials, hardware and saw settings live elsewhere. */
export interface Preset { key: string; label: string; blurb: string; values: RawDefaults }

/** The built-in method the app ships with; the shop adds its own on the Admin page. */
export const PRESETS: Preset[] = [
  { key: 'frameless', label: 'Frameless', blurb: 'Frameless, full-overlay fronts. Shop standard reveals, gaps and deducts.', values: {} },
];
export const DEFAULT_PRESET = PRESETS[0].key;
/** The method with this key, or the shop's default (first) method when the key is unknown. */
export const presetFor = (key: string | undefined, presets: Preset[] = PRESETS) => presets.find(p => p.key === key) ?? presets[0] ?? PRESETS[0];

/** True when the job's construction rules differ from its method. Hardware and materials are not part of a method. */
export function isCustomized(presetKey: string | undefined, defaults: RawDefaults, presets: Preset[] = PRESETS): boolean {
  const p = presetFor(presetKey, presets).values;
  for (const k of RULE_KEYS) {
    // Compare by value, so "3/4" matches 0.75.
    if (parseDim(p[k] ?? DEFAULTS[k]) !== parseDim(defaults[k] ?? DEFAULTS[k])) return true;
  }
  return false;
}

/** Built-in dropdown choices for the hardware fields; anything else is entered through "Other…". */
export const OPTIONS: Partial<Record<DefaultKey, string[]>> = {
  glideSeries: ['563H', '569H'],
  pull: ['4in C-Pull', '96mm Bar Pull', '128mm Bar Pull', 'Knob', 'None (push to open)'],
  hinge: ['Blum 110° Clip-top', 'Blum 110° Clip-top Blumotion', 'Blum 170° Clip-top'],
  drawerStyle: ['5 Piece Drawer', 'Dovetail Drawer', 'Melamine Box', 'Metal Box'],
};
