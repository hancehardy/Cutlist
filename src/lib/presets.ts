import { DEFAULTS, parseDim, type DefaultKey, type RawDefaults } from './engine';

/** A named frameless construction method: materials, hardware and any rule overrides. */
export interface Preset { key: string; label: string; blurb: string; values: RawDefaults }

export const PRESETS: Preset[] = [
  {
    key: 'frameless-melamine', label: 'Frameless – Melamine', blurb: 'Shop standard. Melamine case, back and slab fronts.',
    values: {},
  },
  {
    key: 'frameless-ply', label: 'Frameless – Plywood', blurb: 'Prefinished maple ply case and back, veneer slab fronts.',
    values: { caseMat: '3/4 Prefinished Maple Ply', backMat: '1/4 Prefinished Maple Ply', frontMat: '3/4 Maple Veneer Ply', doorStyle: 'Slab (Veneer)', drawerStyle: 'Dovetail Drawer' },
  },
  {
    key: 'frameless-painted', label: 'Frameless – Painted fronts', blurb: 'Melamine case, MDF fronts for paint.',
    values: { frontMat: '3/4 MDF', doorStyle: 'Slab (Paint)' },
  },
];
export const DEFAULT_PRESET = PRESETS[0].key;
export const presetFor = (key: string | undefined) => PRESETS.find(p => p.key === key) ?? PRESETS[0];

/** True when the job's materials and rules differ from what its preset sets. */
export function isCustomized(presetKey: string | undefined, defaults: RawDefaults): boolean {
  const p = presetFor(presetKey).values;
  const keys = new Set([...Object.keys(p), ...Object.keys(defaults)]) as Set<DefaultKey>;
  for (const k of keys) {
    const want = p[k] ?? DEFAULTS[k], have = defaults[k] ?? DEFAULTS[k];
    // Numeric rules compare by value, so "3/4" matches 0.75.
    if (typeof DEFAULTS[k] === 'number' && parseDim(want) === parseDim(have)) continue;
    if (String(want).trim() !== String(have).trim()) return true;
  }
  return false;
}

/** Dropdown choices for the materials & hardware fields; anything else is entered through "Other…". */
export const OPTIONS: Partial<Record<DefaultKey, string[]>> = {
  caseMat: ['3/4 2s Melamine', '3/4 Prefinished Maple Ply', '3/4 Baltic Birch', '3/4 MDF'],
  backMat: ['1/4 1s Melamine', '1/4 Prefinished Maple Ply', '1/2 2s Melamine'],
  frontMat: ['3/4 2s Melamine', '3/4 Maple Veneer Ply', '3/4 MDF', '3/4 TFL'],
  glideSeries: ['563H', '569H'],
  pull: ['4in C-Pull', '96mm Bar Pull', '128mm Bar Pull', 'Knob', 'None (push to open)'],
  hinge: ['Blum 110° Clip-top', 'Blum 110° Clip-top Blumotion', 'Blum 170° Clip-top'],
  drawerStyle: ['5 Piece Drawer', 'Dovetail Drawer', 'Melamine Box', 'Metal Box'],
  doorStyle: ['Slab (Melamine)', 'Slab (Veneer)', 'Slab (Paint)', 'Shaker (5 piece)'],
};
