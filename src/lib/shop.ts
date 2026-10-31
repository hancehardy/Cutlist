// Shop-wide configuration edited on the Admin page: the materials table, the dropdown choices for
// hardware, the panel saw settings and the construction methods. Stored as one JSON document in SQLite.
import {
  BOX_FIELD, BUILD_STYLES, BUILTIN_CATALOG, DEFAULTS, DEFAULT_PANEL, FACE_H_RULES, HARDWARE_FIELDS, MAT_SLOTS, PANEL_BANDS, RULE_KEYS, SAW_FIELDS, fmt, newFace, parseDim,
  type BuildStyle, type CabCatalog, type CabCategory, type CabType, type DefaultKey, type FaceSpec, type FrontStyle, type Hinge, type JobMaterials, type Kind, type Material, type PanelSpec, type RawDefaults,
} from './engine';
import { OPTIONS, PRESETS, type Preset } from './presets';

/** Hardware fields that offer a dropdown of shop choices (the rest are free text), plus the drawer box type. */
export const HARDWARE_OPTION_KEYS: DefaultKey[] = HARDWARE_FIELDS.map(([k]) => k).filter(k => OPTIONS[k]);
export const OPTION_KEYS: DefaultKey[] = [...HARDWARE_OPTION_KEYS, BOX_FIELD[0]];
export const optionLabel = (k: DefaultKey) => [...HARDWARE_FIELDS, BOX_FIELD, ...SAW_FIELDS].find(([x]) => x === k)?.[1] ?? k;

const style = (name: string, slab = true, grain: 'Vertical' | 'Horizontal' = 'Vertical'): FrontStyle => ({ name, slab, grain });
export const BUILTIN_DOOR_STYLES: FrontStyle[] = [style('Slab (Melamine)'), style('Slab (Veneer)'), style('Slab (Paint)'), style('Shaker (5 piece)', false)];
export const BUILTIN_DRAWER_FRONT_STYLES: FrontStyle[] = [
  style('Slab (Melamine)'), style('Slab (Melamine), horizontal grain', true, 'Horizontal'), style('Slab (Veneer)'), style('Slab (Paint)'), style('Shaker (5 piece)', false),
];
export const styleByName = (styles: FrontStyle[], name: string) => styles.find(s => s.name === name.trim());
/** Same style: name and slab flag, and grain when it matters (drawer fronts). */
export const sameStyle = (a: FrontStyle, b: FrontStyle, grain: boolean) => a.name.trim() === b.name.trim() && a.slab === b.slab && (!grain || a.grain === b.grain);

export type ShopOptions = Partial<Record<DefaultKey, string[]>>;
export interface SawSettings { kerf: string; edgeTrim: string }

/** Bump `version` when a migration must run once on stored documents (see normalizeShopConfig). */
export interface ShopConfig {
  version: 3;
  /** Sheet goods in display order. */
  materials: Material[];
  /** Dropdown choices per hardware field, in display order. An empty list turns the field into free text. */
  options: ShopOptions;
  /** Door and drawer front styles offered on job setup. */
  doorStyles: FrontStyle[];
  drawerFrontStyles: FrontStyle[];
  /** Panel saw settings, applied to every job. */
  saw: SawSettings;
  /** Construction methods. The first one is the default for new jobs. */
  presets: Preset[];
  /** Cabinet categories and box types offered on the cabinet list. */
  catalog: CabCatalog;
}

export const cloneCatalog = (c: CabCatalog): CabCatalog => ({
  categories: c.categories.map(x => ({ ...x })),
  types: c.types.map(t => ({ ...t, faces: t.faces.map(f => ({ ...f })) })),
});

const SHEET_W = fmt(DEFAULTS.sheetW), SHEET_L = fmt(DEFAULTS.sheetL);
const mat = (name: string, thk: string, w = SHEET_W, l = SHEET_L): Material => ({ name, thk, w, l });
export const BUILTIN_MATERIALS: Material[] = [
  mat('3/4 2s Melamine', '3/4'), mat('1/4 1s Melamine', '1/4'), mat('1/2 2s Melamine', '1/2'),
  mat('3/4 Prefinished Maple Ply', '3/4'), mat('1/4 Prefinished Maple Ply', '1/4'),
  mat('3/4 Baltic Birch', '3/4', '60', '60'), mat('3/4 MDF', '3/4'), mat('3/4 Maple Veneer Ply', '3/4'), mat('3/4 TFL', '3/4'),
];

/** The built-in materials, choices, saw settings and method the app ships with. */
export function defaultShopConfig(): ShopConfig {
  return {
    version: 3,
    materials: BUILTIN_MATERIALS.map(m => ({ ...m })),
    options: Object.fromEntries(OPTION_KEYS.map(k => [k, [...OPTIONS[k]!]])),
    doorStyles: BUILTIN_DOOR_STYLES.map(s => ({ ...s })),
    drawerFrontStyles: BUILTIN_DRAWER_FRONT_STYLES.map(s => ({ ...s })),
    saw: { kerf: fmt(DEFAULTS.kerf), edgeTrim: fmt(DEFAULTS.edgeTrim) },
    presets: PRESETS.map(p => ({ ...p, values: { ...p.values } })),
    catalog: cloneCatalog(BUILTIN_CATALOG),
  };
}

/** Choices for a field as the setup form wants them: `undefined` means free text. */
export const optionsFor = (options: ShopOptions, k: DefaultKey): string[] | undefined =>
  options[k]?.length ? options[k] : undefined;

export const materialByName = (materials: Material[], name: string) => materials.find(m => m.name === name.trim());
/** Same name and dimensions (compared by value, so "3/4" matches 0.75). */
export const sameMaterial = (a: Material, b: Material) =>
  a.name.trim() === b.name.trim() && parseDim(a.thk) === parseDim(b.thk) && parseDim(a.w) === parseDim(b.w) && parseDim(a.l) === parseDim(b.l);
/** "3/4 2s Melamine · 3/4 · 49 x 97", dimensions as typed on the Admin page (so 0.71 is not shown rounded to 11/16). */
export const materialLabel = (m: Material) => `${m.name} · ${m.thk.trim()} · ${m.w.trim()} x ${m.l.trim()}`;

/** A new job's materials: the first material for the case and fronts, the thinnest for the back. */
export function defaultJobMaterials(materials: Material[]): JobMaterials {
  const list = materials.length ? materials : BUILTIN_MATERIALS;
  const first = list[0];
  const thin = list.reduce((a, m) => (parseDim(m.thk) < parseDim(a.thk) ? m : a), first);
  return { case: { ...first }, back: { ...thin }, front: { ...first } };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** A stable id for a method, unique among `taken`. */
export function presetKey(label: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  const base = slug(label) || 'method';
  let key = base;
  for (let n = 2; used.has(key); n++) key = `${base}-${n}`;
  return key;
}

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
/** The text as typed when it is a positive dimension, else the fallback. */
const dim = (v: unknown, fallback: string) => { const s = str(v).trim(), n = parseDim(s); return isNaN(n) || n <= 0 ? fallback : s; };

/** Validate one material: a name is required; bad dimensions fall back to 3/4" on a 49 x 97 sheet. */
export function normMaterial(raw: unknown): Material | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = str(o.name).trim();
  if (!name) return null;
  return { name, thk: dim(o.thk, fmt(DEFAULTS.caseThk)), w: dim(o.w, SHEET_W), l: dim(o.l, SHEET_L) };
}

/** Validate one front style: a name is required; without a flag, a name containing "slab" is a slab. */
export function normStyle(raw: unknown): FrontStyle | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = str(o.name).trim();
  if (!name) return null;
  return { name, slab: typeof o.slab === 'boolean' ? o.slab : /slab/i.test(name), grain: o.grain === 'Horizontal' ? 'Horizontal' : 'Vertical' };
}
/** A style list: unique names, first wins; falls back to names from an older document's dropdown, then the built-ins. */
function normStyles(raw: unknown, oldNames: string[], builtin: FrontStyle[]): FrontStyle[] {
  const out: FrontStyle[] = [];
  const push = (s: FrontStyle | null) => { if (s && !out.some(x => x.name === s.name)) out.push(s); };
  if (Array.isArray(raw)) for (const s of raw) push(normStyle(s));
  else for (const name of oldNames) push(normStyle({ name }));
  return out.length ? out : builtin.map(s => ({ ...s }));
}

/** Thickness read off the front of a material name such as "3/4 MDF" or "0.71 Ply". */
const leadingThk = (name: string) => {
  const m = name.match(/^(\d+\/\d+|\d*\.\d+|\d+)/);
  const n = m ? parseDim(m[1]) : NaN;
  return isNaN(n) || n <= 0 || n > 2 ? fmt(DEFAULTS.caseThk) : m![1];
};

function normValues(raw: unknown): RawDefaults {
  const out: RawDefaults = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    // Only construction rules belong to a method; material, hardware and sheet keys from older documents are dropped.
    if (!RULE_KEYS.has(k as DefaultKey)) continue;
    const s = str(v).trim();
    if (s) (out as Record<string, string>)[k] = s;
  }
  return out;
}

function normList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    const s = str(v).trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

const KINDS: Kind[] = ['drawer', 'door', 'false', 'open'];
const STYLES = new Set<string>(BUILD_STYLES.map(([k]) => k));
const int = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Math.round(Number(v));
  return isNaN(n) ? fallback : Math.max(min, Math.min(max, n));
};

/** Validate one standard face. */
export function normFace(raw: unknown): FaceSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!KINDS.includes(o.kind as Kind)) return null;
  const kind = o.kind as Kind;
  const hRaw = str(o.h).trim();
  const h = FACE_H_RULES.some(([k]) => k === hRaw) ? hRaw : parseDim(hRaw) > 0 ? hRaw : '';
  const store = kind === 'door' || kind === 'open';
  return {
    kind, h,
    split: kind === 'door' ? int(o.split, 0, 0, 4) : kind === 'drawer' ? int(o.split, 1, 1, 4) : 1,
    shelves: !store ? 0 : o.shelves === 'auto' ? 'auto' : int(o.shelves, 0, 0, 8),
    rollouts: store ? int(o.rollouts, 0, 0, 5) : 0,
    hinge: (o.hinge === 'R' ? 'R' : 'L') as Hinge,
  };
}

/** Validate one box type against the given categories; null when it has no code. */
export function normType(raw: unknown, cats: CabCategory[]): CabType | null {
  if (!raw || typeof raw !== 'object' || !cats.length) return null;
  const o = raw as Record<string, unknown>;
  const code = str(o.code).trim();
  if (!code) return null;
  const faces = Array.isArray(o.faces) ? o.faces.map(normFace).filter((f): f is FaceSpec => !!f) : [];
  const cat = cats.some(c => c.key === o.cat) ? (o.cat as string) : cats[0].key;
  const isPanel = cats.find(c => c.key === cat)?.style === 'panel';
  const type: CabType = {
    code, cat,
    label: str(o.label).trim() || code,
    img: str(o.img).trim(),
    h: dim(o.h, '30'), d: isPanel ? '0' : dim(o.d, '24'),
    toe: (() => { const t = str(o.toe).trim(), n = parseDim(t); return isNaN(n) || n < 0 || isPanel ? '0' : t; })(),
    faces: isPanel ? [] : faces.length ? faces : [newFace('door')],
  };
  const w = str(o.w).trim();
  if (parseDim(w) > 0) type.w = w;
  if (isPanel) {
    const p = (o.panel && typeof o.panel === 'object' ? o.panel : {}) as Record<string, unknown>;
    type.panel = {
      mat: MAT_SLOTS.some(([k]) => k === p.mat) ? (p.mat as PanelSpec['mat']) : DEFAULT_PANEL.mat,
      grain: p.grain === 'Horizontal' ? 'Horizontal' : 'Vertical',
      band: PANEL_BANDS.some(([k]) => k === p.band) ? (p.band as PanelSpec['band']) : DEFAULT_PANEL.band,
    };
  }
  return type;
}

/** Validate the cabinet catalog: unique category keys and box codes, faces cleaned up, built-ins when nothing survives. */
export function normalizeCatalog(raw: unknown): CabCatalog {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const categories: CabCategory[] = [];
  if (Array.isArray(r.categories)) {
    for (const c of r.categories) {
      if (!c || typeof c !== 'object') continue;
      const o = c as Record<string, unknown>;
      const label = str(o.label).trim();
      if (!label) continue;
      const key = presetKey(slug(str(o.key)) || label, categories.map(x => x.key));
      categories.push({ key, label, style: (STYLES.has(str(o.style)) ? str(o.style) : 'base') as BuildStyle });
    }
  }
  const cats = categories.length ? categories : BUILTIN_CATALOG.categories.map(c => ({ ...c }));
  const types: CabType[] = [];
  if (Array.isArray(r.types)) {
    for (const t of r.types) {
      const nt = normType(t, cats);
      if (nt && !types.some(x => x.code === nt.code)) types.push(nt);
    }
  }
  return { categories: cats, types: types.length ? types : BUILTIN_CATALOG.types.map(t => ({ ...t, cat: cats.some(c => c.key === t.cat) ? t.cat : cats[0].key, faces: t.faces.map(f => ({ ...f })) })) };
}

/** Validate untrusted JSON (request body or stored row) into a ShopConfig. Throws on unusable input. */
export function normalizeShopConfig(raw: unknown): ShopConfig {
  if (!raw || typeof raw !== 'object') throw new Error('Shop settings are not a JSON object.');
  const r = raw as Record<string, unknown>;
  const builtin = defaultShopConfig();
  const rawOpts = (r.options && typeof r.options === 'object' ? r.options : {}) as Record<string, unknown>;

  // Materials: one row per name, first wins. A document without a table keeps the built-ins, or, for a
  // version-1 document, the material names it had in its old case/back/front dropdowns.
  const materials: Material[] = [];
  const seen = new Set<string>();
  const push = (m: Material | null) => { if (m && !seen.has(m.name)) { seen.add(m.name); materials.push(m); } };
  if (Array.isArray(r.materials)) for (const m of r.materials) push(normMaterial(m));
  else for (const k of ['caseMat', 'backMat', 'frontMat']) for (const name of normList(rawOpts[k])) push(materialByName(builtin.materials, name) ?? mat(name, leadingThk(name)));

  const options: ShopOptions = {};
  for (const k of OPTION_KEYS) {
    // A field missing from the document keeps the built-in list; an explicit empty list is kept empty.
    options[k] = k in rawOpts ? normList(rawOpts[k]) : builtin.options[k];
  }

  const rawSaw = (r.saw && typeof r.saw === 'object' ? r.saw : {}) as Record<string, unknown>;
  const sawDim = (v: unknown, fallback: string) => { const s = str(v).trim(), n = parseDim(s); return isNaN(n) || n < 0 ? fallback : s; };
  const saw: SawSettings = { kerf: sawDim(rawSaw.kerf, builtin.saw.kerf), edgeTrim: sawDim(rawSaw.edgeTrim, builtin.saw.edgeTrim) };

  const presets: Preset[] = [];
  if (Array.isArray(r.presets)) {
    for (const p of r.presets) {
      if (!p || typeof p !== 'object') continue;
      const o = p as Record<string, unknown>;
      const label = str(o.label).trim();
      if (!label) continue;
      const wanted = slug(str(o.key));
      presets.push({ key: presetKey(wanted || label, presets.map(x => x.key)), label, blurb: str(o.blurb).trim(), values: normValues(o.values) });
    }
  }
  const catalog = normalizeCatalog(r.catalog);
  // Version 3 added accessories (cut panels). A shop saved before then gets the built-in Accessory category and
  // its panels once; after that the admin owns the list, so deleting them does not bring them back.
  if ((Number(r.version) || 1) < 3 && !catalog.categories.some(c => c.style === 'panel')) {
    const acc = BUILTIN_CATALOG.categories.find(c => c.style === 'panel')!;
    const key = presetKey(acc.key, catalog.categories.map(c => c.key));
    catalog.categories.push({ ...acc, key });
    for (const t of BUILTIN_CATALOG.types.filter(t => t.cat === acc.key)) {
      if (!catalog.types.some(x => x.code === t.code)) catalog.types.push({ ...t, cat: key, faces: [], panel: { ...t.panel! } });
    }
  }
  return {
    version: 3, materials: materials.length ? materials : builtin.materials, options, saw,
    doorStyles: normStyles(r.doorStyles, normList(rawOpts.doorStyle), builtin.doorStyles),
    drawerFrontStyles: normStyles(r.drawerFrontStyles, normList(rawOpts.doorStyle), builtin.drawerFrontStyles),
    presets: presets.length ? presets : builtin.presets,
    catalog,
  };
}
