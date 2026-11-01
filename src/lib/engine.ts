// Cabinet cutlist engine — construction rules derived from the 3DB15 sample packet.
// Pure functions only: safe to run on the client and the server.

export type DimFormat = 'fraction' | 'decimal';
export type Kind = 'drawer' | 'door' | 'false' | 'open';
export type Hinge = 'L' | 'R';
export type Grain = 'Vertical' | 'Horizontal';
export type Fmt = (n: number | null | undefined) => string;

export interface SectionInput {
  kind: Kind;
  /** '' = auto (shares remaining height). */
  h: string | number;
  /** Doors: 0 = auto (2 doors above `doorSplit`). Drawers: pieces across. */
  split: number;
  shelves: number;
  rollouts: number;
  hinge: Hinge;
}

export interface CabInput {
  id: number;
  type: string;
  w: string;
  h: string;
  d: string;
  toe: string;
  qty: string;
  layout?: SectionInput[] | null;
  /** Finished interior: the case is cut from the front material and the back from the 1/4" material that matches it. */
  finished?: boolean;
}

export function parseDim(s: unknown): number {
  if (typeof s === 'number') return s;
  const str = String(s ?? '').trim().replace(/["”]/g, '');
  if (!str) return NaN;
  const m = str.match(/^(\d+)?[\s-]*(\d+)\/(\d+)$/);
  if (m) return (m[1] ? +m[1] : 0) + +m[2] / +m[3];
  const n = parseFloat(str);
  return isNaN(n) ? NaN : n;
}

export function fmt(n: number | null | undefined, mode: DimFormat = 'fraction'): string {
  if (n == null || isNaN(n)) return '—';
  if (mode === 'decimal') return (Math.round(n * 1000) / 1000).toString();
  let whole = Math.floor(n), r = Math.round((n - whole) * 16), d = 16;
  if (r === 16) { whole++; r = 0; }
  while (r && r % 2 === 0) { r /= 2; d /= 2; }
  return whole ? (r ? `${whole} ${r}/${d}` : `${whole}`) : (r ? `${r}/${d}` : '0');
}

export const makeFmt = (mode: DimFormat): Fmt => n => fmt(n, mode);

// ---- Cabinet catalog: categories and box types. The built-ins below are the app's defaults; the shop
// edits its own copy on the Admin page and passes it to buildJob.

/** How a category's case goes together. */
export type BuildStyle = 'base' | 'wall' | 'tall' | 'panel';
export const BUILD_STYLES: [BuildStyle, string][] = [
  ['base', 'Base: open top with stretchers, deck, toe kick'],
  ['wall', 'Wall: full top and bottom, two nailers'],
  ['tall', 'Tall: full top, deck, one nailer, toe kick'],
  ['panel', 'Accessory: one cut panel (filler, end panel, toe kick skin), no case or faces'],
];

/** How an accessory panel is cut: which job material, grain, and which edges are banded. */
export interface PanelSpec { mat: MatSlot; grain: Grain; band: 'none' | 'long' | 'all' }

const LETTERS = 'ABCDEFGHIJKLMNOP';

/**
 * Named dimensions a case part can be sized from, besides a plain number. A size is one term, or terms joined with
 * ` + ` or ` - ` (spaces around the sign, so `1-1/2` stays a mixed number); a term can be multiplied: `faceA + 3/4`,
 * `inW - 1/2`, `inW + 2*backGroove`.
 */
export const DIM_TOKENS: [string, string][] = [
  ['inW', 'Inside width'], ['inD', 'Inside depth, to the back'], ['D', 'Depth'], ['W', 'Width'], ['H', 'Height'], ['boxH', 'Box height, less the toe'],
  ['stretcherW', 'Stretcher width'], ['smallFront', 'Top drawer front height'], ['tallLowerDoor', 'Tall lower door height'],
  ['caseThk', 'Case thickness'], ['backThk', 'Back thickness'], ['backGroove', 'Back groove depth'], ['shelfSetback', 'Shelf setback'], ['shelfClear', 'Shelf side clearance'],
  ...[...LETTERS].map((c): [string, string] => [`face${c}`, `Height of face ${c}`]),
];
/** A case part's size as typed: a DIM_TOKENS expression (terms with `*`, joined by ` + ` / ` - `). NaN when a term is unknown. */
export function evalDim(expr: string, ctx: Record<string, number>): number {
  const terms = String(expr ?? '').trim().split(/\s+([+\-−])\s+/);
  if (!terms[0]) return NaN;
  const factor = (t: string) => (Object.hasOwn(ctx, t) ? ctx[t] : parseDim(t));
  let total = 0, sign = 1;
  for (let i = 0; i < terms.length; i += 2) {
    const v = terms[i].split(/\s*[*×]\s*/).map(f => factor(f.trim())).reduce((a, b) => a * b, 1);
    if (isNaN(v)) return NaN;
    total += sign * v;
    sign = terms[i + 1] === '+' ? 1 : -1;
  }
  return total;
}
/** A case part's count as typed: 'auto' (what the layout needs), 'auto+N', or a number. */
export const QTY_RE = /^(auto(\s*\+\s*\d+)?|\d+)$/;
export function resolveQty(q: string, auto: number): number {
  const s = String(q ?? '').trim();
  if (s === 'auto') return auto;
  const m = s.match(/^auto\s*\+\s*(\d+)$/);
  if (m) return auto + +m[1];
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

/** Which edges of a case part get edge banding: `l` runs along its length (the front edge of ends, decks and shelves). */
export type BandEdge = 'none' | 'l' | 'w' | 'long' | 'll' | 'all';
export const BAND_EDGES: [BandEdge, string][] = [['none', 'None'], ['l', 'One length edge'], ['w', 'One width edge'], ['long', 'Longer edge'], ['ll', 'Both length edges'], ['all', 'All four edges']];
export const bandInches = (b: BandEdge, w: number, l: number) =>
  b === 'l' ? l : b === 'w' ? w : b === 'long' ? Math.max(w, l) : b === 'll' ? 2 * l : b === 'all' ? 2 * (w + l) : 0;

/**
 * One part of a box's case. `key` is a STANDARD_PARTS key (the engine knows its automatic count and size) or a custom
 * id; `qty` is 'auto', 'auto+N' or a number; `w` and `l` are DIM_TOKENS expressions ('auto' where the engine sizes the
 * field: a partition's length). A part that is off,
 * or whose size can't be read, is not made.
 */
export interface CasePart { key: string; name: string; on: boolean; qty: string; w: string; l: string; grain: Grain; mat: MatSlot; band: BandEdge }
/** A box's whole case parts list, stored once the admin changes anything from the category default. */
export interface CaseSpec { parts: CasePart[] }
/** The parts a category style builds, in the order they are made. Partitions are sized by the engine. */
export const STANDARD_PARTS = ['leftEnd', 'rightEnd', 'back', 'deck', 'top', 'nailer', 'topStretcher', 'partition', 'drawerStretcher', 'fixedShelf', 'adjShelf'] as const;
export type StandardPart = (typeof STANDARD_PARTS)[number];
/** Parts whose count follows the layout when their qty is 'auto'. */
export const AUTO_QTY_PARTS: StandardPart[] = ['partition', 'drawerStretcher', 'fixedShelf', 'adjShelf'];
/** Fields the engine always sizes itself (shown read-only as 'auto'): a partition is as tall as its drawer section, one per split. */
export const AUTO_SIZED: Partial<Record<string, { w?: true; l?: true; qty?: true }>> = { partition: { l: true, qty: true } };

/** The case a category style builds: what `buildCabinet` made before boxes carried their own parts list. */
export function defaultCaseParts(style: BuildStyle): CasePart[] {
  const wall = style === 'wall', tall = style === 'tall';
  const p = (key: StandardPart, name: string, qty: string, w: string, l: string, grain: Grain, band: BandEdge, on = true, mat: MatSlot = 'case'): CasePart =>
    ({ key, name, on, qty, w, l, grain, mat, band });
  return [
    p('leftEnd', 'Unfinished Left End', '1', 'D', 'boxH', 'Vertical', 'l'),
    p('rightEnd', 'Unfinished Right End', '1', 'D', 'boxH', 'Vertical', 'l'),
    // Captured in a groove on all four sides: the groove depth on each side, inside the ends and the deck and top.
    p('back', 'Unfinished Back', '1', 'inW + 2*backGroove', 'boxH - 2*caseThk + 2*backGroove', 'Vertical', 'none', true, 'back'),
    p('deck', wall ? 'Bottom' : 'Deck', '1', 'D', 'inW', 'Horizontal', 'l'),
    p('top', 'Top', '1', 'D', 'inW', 'Horizontal', 'l', wall || tall),
    p('nailer', 'Nailer', wall ? '2' : '1', 'stretcherW', 'inW', 'Vertical', 'none'),
    p('topStretcher', 'Top Stretcher', '2', 'stretcherW', 'inW', 'Vertical', 'l', !wall && !tall),
    p('partition', 'Drawer Partition', 'auto', 'inD', 'auto', 'Vertical', 'l'),
    p('drawerStretcher', 'Drawer Stretcher', 'auto', 'stretcherW', 'inW', 'Vertical', 'l'),
    p('fixedShelf', 'Fixed Shelf', 'auto', 'inD', 'inW', 'Horizontal', 'l'),
    p('adjShelf', 'Adjustable Shelf', 'auto', 'inD - shelfSetback', 'inW - shelfClear', 'Horizontal', 'l'),
  ];
}
/** Add a custom part where extras go, before the adjustable shelves, with a key no other part uses. */
export function addCasePart(parts: CasePart[], part: CasePart): CasePart[] {
  let key = part.key || 'p';
  for (let n = 2; parts.some(p => p.key === key); n++) key = `${part.key || 'p'}-${n}`;
  const i = parts.findIndex(p => p.key === 'adjShelf');
  const next = [...parts];
  next.splice(i < 0 ? parts.length : i, 0, { ...part, key });
  return next;
}
export const DEFAULT_PANEL: PanelSpec = { mat: 'front', grain: 'Vertical', band: 'long' };
export const PANEL_BANDS: [PanelSpec['band'], string][] = [['none', 'None'], ['long', 'One long edge'], ['all', 'All four edges']];
export interface CabCategory { key: string; label: string; style: BuildStyle }

/** Rules a standard face height can follow instead of a fixed dimension. */
export const FACE_H_RULES: [string, string][] = [['smallFront', 'Top drawer front height'], ['tallLowerDoor', 'Tall lower door height']];
/**
 * One face in a box type's standard layout. `h` is '' (auto), a rule name from FACE_H_RULES, or a
 * dimension as typed. `shelves: 'auto'` means one shelf under 30" tall, two from 30".
 */
export interface FaceSpec { kind: Kind; h: string; split: number; shelves: number | 'auto'; rollouts: number; hinge: Hinge }
/**
 * A box type: the code jobs refer to, its category, picker image (blank = drawn from the faces), default size and standard
 * faces. `w` is a default width applied when the box is picked (fillers, toe kicks); `panel` is how an accessory is cut.
 */
export interface CabType { code: string; cat: string; label: string; img: string; h: string; d: string; toe: string; faces: FaceSpec[]; w?: string; panel?: PanelSpec; case?: CaseSpec }
export interface CabCatalog { categories: CabCategory[]; types: CabType[] }

export const newFace = (kind: Kind, h = '', o: Partial<FaceSpec> = {}): FaceSpec =>
  ({ kind, h, split: kind === 'door' ? 0 : 1, shelves: 0, rollouts: 0, hinge: 'L', ...o });
const F = newFace;
const T = (code: string, cat: string, img: string, label: string, h: string, d: string, toe: string, faces: FaceSpec[]): CabType =>
  ({ code, cat, label, img: `/assets/sku/${img}.png`, h, d, toe, faces });

/** The rail behind a sink base's false front: 3/4" taller than the false front (face A), the inside width long. */
export const SINK_SKIRT: CasePart = { key: 'sinkSkirt', name: 'Sink Skirt', on: true, qty: '1', w: 'faceA + 3/4', l: 'inW', grain: 'Vertical', mat: 'case', band: 'none' };
/** A sink base's case: the skirt behind the false front takes the place of the drawer stretcher. */
export const sinkBaseParts = (style: BuildStyle = 'base'): CasePart[] =>
  addCasePart(defaultCaseParts(style).map(p => (p.key === 'drawerStretcher' ? { ...p, on: false } : p)), SINK_SKIRT);

export const BUILTIN_CATEGORIES: CabCategory[] = [
  { key: 'base', label: 'Base', style: 'base' }, { key: 'wall', label: 'Wall', style: 'wall' },
  { key: 'tall', label: 'Tall', style: 'tall' }, { key: 'vanity', label: 'Vanity', style: 'base' },
  { key: 'accessory', label: 'Accessory', style: 'panel' },
];
const A = (code: string, label: string, w: string, h: string, panel: Partial<PanelSpec> = {}): CabType =>
  ({ code, cat: 'accessory', label, img: '', h, d: '0', toe: '0', faces: [], w, panel: { ...DEFAULT_PANEL, ...panel } });
export const BUILTIN_TYPES: CabType[] = [
  T('B', 'base', 'base-1td', '1 drawer, doors', '34 1/2', '24', '4 1/2', [F('drawer', 'smallFront'), F('door', '', { shelves: 1 })]),
  T('BD', 'base', 'base-fh', 'Full-height doors', '34 1/2', '24', '4 1/2', [F('door', '', { shelves: 1 })]),
  T('2DB', 'base', 'base-2d', '2 drawer', '34 1/2', '24', '4 1/2', [F('drawer'), F('drawer')]),
  T('3DB', 'base', 'base-3d', '3 drawer', '34 1/2', '24', '4 1/2', [F('drawer', 'smallFront'), F('drawer'), F('drawer')]),
  T('4DB', 'base', 'base-4d', '4 drawer', '34 1/2', '24', '4 1/2', [F('drawer', 'smallFront'), F('drawer'), F('drawer'), F('drawer')]),
  { ...T('SB', 'base', 'base-sink', 'Sink base', '34 1/2', '24', '4 1/2', [F('false', 'smallFront'), F('door')]), case: { parts: sinkBaseParts() } },
  T('W', 'wall', 'wall-std', 'Doors', '30', '12', '0', [F('door', '', { shelves: 'auto' })]),
  T('WO', 'wall', 'wall-open', 'Open shelf', '30', '12', '0', [F('open', '', { shelves: 'auto' })]),
  T('T', 'tall', 'tall-std', 'Pantry, upper + lower doors', '84', '24', '4 1/2', [F('door', '', { shelves: 3 }), F('door', 'tallLowerDoor', { shelves: 1 })]),
  T('TD', 'tall', 'tall-po', 'Pantry, full-height doors', '84', '24', '4 1/2', [F('door', '', { shelves: 4 })]),
  T('V', 'vanity', 'van-fh', 'Doors', '30', '21', '0', [F('door')]),
  { ...T('VSB', 'vanity', 'van-sink', 'Sink, false front + doors', '30', '21', '0', [F('false', 'smallFront'), F('door')]), case: { parts: sinkBaseParts() } },
  T('V3DB', 'vanity', 'van-3d', '3 drawer', '30', '21', '0', [F('drawer', 'smallFront'), F('drawer'), F('drawer')]),
  A('FIL', 'Filler', '3', '34 1/2'),
  A('EP', 'End panel', '24', '34 1/2'),
  A('TK', 'Toe kick skin', '96', '4 1/2', { mat: 'toe', grain: 'Horizontal', band: 'none' }),
];
export const BUILTIN_CATALOG: CabCatalog = { categories: BUILTIN_CATEGORIES, types: BUILTIN_TYPES };

export const typeFor = (catalog: CabCatalog, code: string | undefined) => catalog.types.find(t => t.code === code);
export const categoryFor = (catalog: CabCatalog, key: string | undefined) => catalog.categories.find(c => c.key === key);
export const categoryLabel = (catalog: CabCatalog, key: string | undefined) => categoryFor(catalog, key)?.label ?? '';
export const typesIn = (catalog: CabCatalog, key: string | undefined) => catalog.types.filter(t => t.cat === key);

export const DEFAULTS = {
  caseThk: 0.75, backThk: 0.25, backGroove: 0.375, backInset: 0.75, stretcherW: 4, toeRecess: 3,
  frontGap: 0.125, sideReveal: 0.0625, topReveal: 0.0625, bottomReveal: 0.125,
  smallFront: 6.1875, glideClear: 0.4375, smallBoxH: 4, bigBoxH: 8, xlBoxH: 10,
  rolloutH: 3.5, rolloutSpacer: 1,
  glideSeries: '563H', glideLens: '9, 12, 15, 18, 21', glideDeduct: 3,
  kerf: 0.187, sheetL: 97, sheetW: 49, edgeTrim: 0.25,
  caseMat: '3/4 2s Melamine', backMat: '1/4 1s Melamine', frontMat: '3/4 2s Melamine', toeMat: '1/4 1s Melamine',
  doorSplit: 24, tallLowerDoor: 30, pull: '4in C-Pull', hinge: 'Blum 110° Clip-top', shelfSetback: 1, shelfClear: 0.0625,
  drawerStyle: '5 Piece Drawer', doorStyle: 'Slab (Melamine)',
};
type DefaultsShape = typeof DEFAULTS;
export type DefaultKey = keyof DefaultsShape;
export type RawDefaults = Partial<Record<DefaultKey, string>>;

/** Construction rules a method sets. Thickness and sheet size come from the materials, kerf and edge trim from the shop's saw settings. */
/** The construction rules a method sets, in the three groups the setup and admin pages show them in. */
export const RULE_GROUPS: { label: string; fields: [DefaultKey, string][] }[] = [
  { label: 'Case', fields: [
    ['backGroove', 'Back groove depth'], ['backInset', 'Back inset from rear edge'], ['stretcherW', 'Stretcher width'], ['toeRecess', 'Toe recess'], ['shelfSetback', 'Shelf setback'],
  ] },
  { label: 'Fronts and reveals', fields: [
    ['sideReveal', 'Side reveal (each)'], ['topReveal', 'Top reveal'], ['bottomReveal', 'Bottom reveal'], ['frontGap', 'Gap between fronts'],
    ['smallFront', 'Top drawer front height'], ['tallLowerDoor', 'Tall lower door height'], ['doorSplit', 'Two doors above width'],
  ] },
  { label: 'Drawer boxes and roll-outs', fields: [
    ['glideClear', 'Drawer guide clearance (both sides)'], ['glideDeduct', 'Glide deduct from depth'],
    ['smallBoxH', 'Small drawer box height'], ['bigBoxH', 'Large drawer box height'], ['xlBoxH', 'Extra-large drawer box height'],
    ['rolloutH', 'Roll-out height'], ['rolloutSpacer', 'Roll-out spacer (hinge side)'],
  ] },
];
export const RULE_FIELDS: [DefaultKey, string][] = RULE_GROUPS.flatMap(g => g.fields);
export const RULE_KEYS = new Set<DefaultKey>(RULE_FIELDS.map(f => f[0]));

/**
 * Rules saved under an older key. `boxDeduct` was the whole deduct from the cabinet's inside width to the drawer box,
 * case sides included; `glideClear` is just the guides' clearance, so the old value less two case thicknesses.
 */
export function migrateRules(defaults: Record<string, string>, caseThk: number = DEFAULTS.caseThk): void {
  if ('boxDeduct' in defaults) {
    const old = parseDim(defaults.boxDeduct);
    if (!('glideClear' in defaults) && !isNaN(old) && old - 2 * caseThk > 0) defaults.glideClear = fmt(old - 2 * caseThk);
    delete defaults.boxDeduct;
  }
}
/** Shop-wide panel saw settings. */
export const SAW_FIELDS: [DefaultKey, string][] = [['kerf', 'Kerf'], ['edgeTrim', 'Edge trim (1 long + 1 short edge)']];
/** Hardware picked per job. */
export const HARDWARE_FIELDS: [DefaultKey, string][] = [
  ['glideSeries', 'Glide series'], ['glideLens', 'Glide lengths'], ['pull', 'Pull'], ['hinge', 'Hinge'],
];
/** The drawer box construction, picked with the fronts. */
export const BOX_FIELD: [DefaultKey, string] = ['drawerStyle', 'Drawer box type'];
const NUM_KEYS = new Set<DefaultKey>((Object.keys(DEFAULTS) as DefaultKey[]).filter(k => typeof DEFAULTS[k] === 'number'));

/** A sheet good: name, thickness and stock sheet size, in inches as typed. */
export interface Material { name: string; thk: string; w: string; l: string }
export type MatSlot = 'case' | 'back' | 'front' | 'toe';
export const MAT_SLOTS: [MatSlot, string][] = [['case', 'Case material'], ['back', 'Back material'], ['front', 'Front material'], ['toe', 'Toe kick material']];
/** The materials a job is built from: thickness drives the case and back rules, sheet size drives the saw plan. */
export type JobMaterials = Record<MatSlot, Material>;

/** Edge banding thickness: flat tape or 1 mm. */
export type BandThk = 'flat' | '1mm';
export const BAND_THKS: [BandThk, string][] = [['flat', 'Flat'], ['1mm', '1 mm']];
export const bandThkLabel = (t: BandThk) => BAND_THKS.find(([k]) => k === t)?.[1] ?? t;
/** An edge banding product as named by the shop, and its thickness. */
export interface Banding { name: string; thk: BandThk }
/** The edge banding a job uses: one on case parts, one on doors and drawer fronts. */
export interface JobBanding { case: Banding; front: Banding }
export const defaultBanding = (): JobBanding => ({ case: { name: '', thk: 'flat' }, front: { name: '', thk: 'flat' } });

/** A door or drawer front style. Slab styles are cut in the shop; any other is ordered and only listed on the door list. Grain applies to drawer and false fronts. */
export interface FrontStyle { name: string; slab: boolean; grain: Grain }
export interface JobFronts { door: FrontStyle; drawer: FrontStyle }
/** How the resolved front styles drive the engine. */
export interface FrontRules { doorSlab: boolean; drawerSlab: boolean; drawerGrain: Grain; drawerFrontStyle: string }

export type Resolved = { [K in DefaultKey]: DefaultsShape[K] } & {
  glideLenList: number[]; sheets: Record<string, { L: number; W: number }>; fronts: FrontRules;
  /** The 1/4" material a finished interior's back is cut from: the front material's thin mate, when the shop has one. */
  finishedBack: { name: string; thk: number } | null;
};

/** A material name without its leading thickness or a 1s/2s face count, for matching a 3/4 sheet with its 1/4 mate. */
const matKey = (name: string) => name.toLowerCase().replace(/^\s*(\d+\/\d+|\d*\.\d+|\d+)(["”]|in\b)?\s*/, '').replace(/\b\d+s\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/** The 1/4" (about 3/16" to 5/16") material whose name matches the front material's: "3/4 2s Melamine" → "1/4 1s Melamine". */
export function finishedBackFor(front: Material, all: Material[]): Material | null {
  const key = matKey(front.name);
  if (!key) return null;
  return all.find(m => { const t = parseDim(m.thk); return t >= 0.18 && t <= 0.32 && matKey(m.name) === key; }) ?? null;
}

const posDim = (v: unknown, fallback: number) => { const n = parseDim(v); return isNaN(n) || n <= 0 ? fallback : n; };

export function resolveDefaults(raw?: RawDefaults | null, materials?: JobMaterials | null, fronts?: JobFronts | null, shopMaterials?: Material[] | null): Resolved {
  const d = {} as Record<string, unknown>;
  for (const k of Object.keys(DEFAULTS) as DefaultKey[]) {
    const v = raw?.[k] ?? DEFAULTS[k];
    d[k] = NUM_KEYS.has(k) ? (isNaN(parseDim(v)) ? DEFAULTS[k] : parseDim(v)) : v;
  }
  const r = d as Resolved;
  r.glideLenList = String(r.glideLens).split(/[,\s]+/).map(Number).filter(n => n > 0).sort((a, b) => a - b);
  r.sheets = {};
  r.finishedBack = null;
  // Without styles every front is a slab cut in the shop with vertical grain, as before styles existed.
  r.fronts = { doorSlab: true, drawerSlab: true, drawerGrain: 'Vertical', drawerFrontStyle: r.doorStyle };
  if (fronts) {
    r.doorStyle = fronts.door.name.trim() || DEFAULTS.doorStyle;
    r.fronts = { doorSlab: fronts.door.slab, drawerSlab: fronts.drawer.slab, drawerGrain: fronts.drawer.grain, drawerFrontStyle: fronts.drawer.name.trim() || r.doorStyle };
  }
  if (materials) {
    r.caseMat = materials.case.name.trim() || DEFAULTS.caseMat;
    r.backMat = materials.back.name.trim() || DEFAULTS.backMat;
    r.frontMat = materials.front.name.trim() || DEFAULTS.frontMat;
    r.toeMat = materials.toe.name.trim() || DEFAULTS.toeMat;
    r.caseThk = posDim(materials.case.thk, DEFAULTS.caseThk);
    r.backThk = posDim(materials.back.thk, DEFAULTS.backThk);
    // Sheet size per material name; when two slots share a name the case wins (it has the most parts).
    for (const [slot, name] of [['case', r.caseMat], ['back', r.backMat], ['front', r.frontMat], ['toe', r.toeMat]] as [MatSlot, string][]) {
      const m = materials[slot];
      if (!(name in r.sheets)) r.sheets[name] = { L: posDim(m.l, r.sheetL), W: posDim(m.w, r.sheetW) };
    }
    // The shop's list first; a job built without it can still match one of its own four materials.
    const fb = finishedBackFor(materials.front, [...(shopMaterials ?? []), materials.back, materials.toe, materials.case]);
    if (fb) {
      r.finishedBack = { name: fb.name.trim(), thk: posDim(fb.thk, DEFAULTS.backThk) };
      if (!(r.finishedBack.name in r.sheets)) r.sheets[r.finishedBack.name] = { L: posDim(fb.l, r.sheetL), W: posDim(fb.w, r.sheetW) };
    }
  }
  return r;
}

export function cabCode(c: Pick<CabInput, 'type' | 'w'>, f: Fmt = n => fmt(n)) {
  const w = parseDim(c.w);
  return `${c.type}${isNaN(w) ? '' : f(w).replace(' ', '-')}`;
}

export function newSection(kind: Kind, h: string | number = '', o: Partial<SectionInput> = {}): SectionInput {
  return { kind, h, split: kind === 'door' ? 0 : 1, shelves: 0, rollouts: 0, hinge: 'L', ...o };
}

/** Turn a box type's standard faces into section inputs for a cabinet `H` tall, resolving rule heights and auto shelves. */
export function resolveFaces(faces: FaceSpec[], d: Resolved, H: number): SectionInput[] {
  return faces.map(fc => {
    const rule = FACE_H_RULES.find(([k]) => k === fc.h);
    const n = parseDim(fc.h);
    const h: string | number = rule ? (d[fc.h as 'smallFront' | 'tallLowerDoor'] as number) : !isNaN(n) && n > 0 ? n : '';
    return { kind: fc.kind, h, split: fc.split, shelves: fc.shelves === 'auto' ? (H >= 30 ? 2 : 1) : fc.shelves, rollouts: fc.rollouts, hinge: fc.hinge };
  });
}

/**
 * The reverse of resolveFaces: a cabinet's faces, as configured on a job, as box faces for the catalog.
 * A height equal to a rule (top drawer front, tall lower door) is saved as that rule so the box follows the method.
 */
export function facesFromSections(layout: SectionInput[], d: Resolved, keep?: { prev: FaceSpec[]; H: number }): FaceSpec[] {
  return layout.map((s, i) => {
    const n = parseDim(s.h);
    const fixed = !isNaN(n) && n > 0;
    const rule = fixed ? FACE_H_RULES.find(([k]) => Math.abs((d[k as 'smallFront' | 'tallLowerDoor'] as number) - n) < 1e-6)?.[0] : undefined;
    const shelves = s.kind === 'door' || s.kind === 'open' ? Math.max(0, +s.shelves || 0) : 0;
    // A face whose shelves were "auto" stays auto while the count is what auto gives at this height.
    const autoShelves = !!keep && keep.prev[i]?.shelves === 'auto' && shelves === (keep.H >= 30 ? 2 : 1);
    return {
      kind: s.kind,
      h: !fixed ? '' : rule ?? (typeof s.h === 'string' ? s.h.trim() : fmt(n)),
      split: s.kind === 'door' ? Math.max(0, +s.split || 0) : s.kind === 'drawer' ? Math.max(1, +s.split || 1) : 1,
      shelves: autoShelves ? 'auto' : shelves,
      rollouts: s.kind === 'door' || s.kind === 'open' ? Math.max(0, +s.rollouts || 0) : 0,
      hinge: s.hinge === 'R' ? 'R' : 'L',
    };
  });
}

/** The standard layout of a box type; an unknown type gets the catalog's first box. */
export function defaultLayout(type: string, d: Resolved, H: number, catalog: CabCatalog = BUILTIN_CATALOG): SectionInput[] {
  const t = typeFor(catalog, type) ?? catalog.types[0];
  return t ? resolveFaces(t.faces, d, H) : [newSection('door')];
}

/** `band` is the lineal inches of edge banding on one part: fronts all round, case parts along the exposed edge, backs and nailers none. */
/** `cut`: cut from sheet stock in the shop. Ordered fronts (non-slab styles) are listed on the door list but kept off the cut list, saw plans and banding. */
export interface Part { qty: number; desc: string; w: number; l: number; grain: Grain; mat: string; band: number; cut: boolean }
export interface DrawerBox { qty: number; kind: 'Drawer' | 'Roll-out'; w: number; dp: number; h: number; sec: string }
export interface HardwareItem { qty: number; item: string; spec: string }
export interface Piece { x: number; w: number }
export interface Section {
  i: number; tag: string; kind: Kind; y: number; h: number; n: number; pw: number;
  shelves: number; rollouts: number; hinge: Hinge; auto: boolean; pieces: Piece[];
  /** Roll-out spacer sides: one on the hinge side of a single door, both sides behind a pair, none in open shelving. */
  spacerL: boolean; spacerR: boolean;
}
export interface BuiltCabinet {
  idx: number; type: string; cat: string; catLabel: string; typeLabel: string; code: string; label: string; W: number; H: number; D: number; toe: number;
  parts: Part[]; fronts: Part[]; drawers: DrawerBox[]; hardware: HardwareItem[]; sections: Section[];
  warn: string; custom: boolean; bad: boolean; qty: number;
  /** Case parts not made because a size or count could not be read, for the admin preview. */
  skipped: string[];
  /** An accessory: a single cut panel, no case, faces or hardware. */
  panel: boolean;
  /** Finished interior: case parts cut from the front material, the back from its 1/4" mate. */
  finished: boolean;
  boxH: number; isWall: boolean; isTall: boolean; autoH: number; avail: number;
}

export function buildCabinet(c: CabInput, d: Resolved, idx: number, f: Fmt = n => fmt(n), catalog: CabCatalog = BUILTIN_CATALOG): BuiltCabinet {
  const W = parseDim(c.w), H = parseDim(c.h), D = parseDim(c.d);
  const toe = isNaN(parseDim(c.toe)) ? 0 : parseDim(c.toe);
  const known = typeFor(catalog, c.type);
  const t = known ?? catalog.types[0] ?? BUILTIN_TYPES[0];
  const style = categoryFor(catalog, t.cat)?.style ?? 'base';
  const panel = style === 'panel';
  const finished = !!c.finished && !panel;
  // A panel needs only a width and height; a case needs a depth too.
  const bad = panel ? [W, H].some(isNaN) || W <= 0 || H <= 0 : [W, H, D].some(isNaN) || W <= 0 || H <= 0 || D <= 0 || toe >= H;
  const out: BuiltCabinet = {
    idx, type: c.type, cat: t.cat, catLabel: categoryLabel(catalog, t.cat), typeLabel: t.label, code: cabCode(c, f), label: `${f(W)}" ${t.label}`, W, H, D, toe,
    parts: [], fronts: [], drawers: [], hardware: [], sections: [], warn: '', custom: !!c.layout, bad, skipped: [],
    qty: Math.max(1, parseInt(c.qty) || 1), boxH: 0, isWall: false, isTall: false, autoH: 0, avail: 0, panel, finished,
  };
  if (bad) return out;
  if (panel) {
    // An accessory is one panel W wide by H high in the chosen job material; no case, faces or hardware.
    const spec = t.panel ?? DEFAULT_PANEL;
    const mat = spec.mat === 'case' ? d.caseMat : spec.mat === 'back' ? d.backMat : spec.mat === 'toe' ? d.toeMat : d.frontMat;
    const band = spec.band === 'all' ? 2 * (W + H) : spec.band === 'long' ? Math.max(W, H) : 0;
    out.parts.push({ qty: 1, desc: t.label, w: W, l: H, grain: spec.grain, mat, band, cut: true });
    out.label = `${f(W)}" x ${f(H)}" ${t.label}`;
    out.boxH = H; out.toe = 0;
    if (!known) out.warn = `Unknown cabinet type ${c.type}: built as ${t.code}. Pick a box from the list.`;
    return out;
  }
  const thk = d.caseThk, boxH = H - toe, inW = W - 2 * thk;
  const isWall = style === 'wall', isTall = style === 'tall';
  out.boxH = boxH; out.isWall = isWall; out.isTall = isTall;
  if (!known) out.warn = `Unknown cabinet type ${c.type}: built as ${t.code}. Pick a box from the list.`;
  const P = (qty: number, desc: string, w: number, l: number, grain: Grain, mat: string, band = 0) => out.parts.push({ qty, desc, w, l, grain, mat, band, cut: true });
  // Doors run vertical; drawer and false fronts follow the drawer front style's grain. Only slab styles are cut (and banded) here.
  const F = (qty: number, desc: string, w: number, l: number, kind: Kind) => {
    const cut = kind === 'door' ? d.fronts.doorSlab : d.fronts.drawerSlab;
    out.fronts.push({ qty, desc, w, l, grain: kind === 'door' ? 'Vertical' : d.fronts.drawerGrain, mat: d.frontMat, band: cut ? 2 * (w + l) : 0, cut });
  };
  const layout = c.layout && c.layout.length ? c.layout : defaultLayout(c.type, d, H, catalog);
  // Frameless back: captured in a groove on all four sides, set in from the rear edge so
  // nailers fit behind it. Usable depth inside the box stops at the back's front face.
  // A finished interior takes its back from the front material's 1/4" mate; without one it keeps the job's back.
  const backMat = finished && d.finishedBack ? d.finishedBack.name : d.backMat;
  const backThk = finished && d.finishedBack ? d.finishedBack.thk : d.backThk;
  if (finished && !d.finishedBack && !out.warn) out.warn = `No 1/4" material matches ${d.frontMat} for a finished interior; the back is cut from ${d.backMat}.`;
  const inD = D - d.backInset - backThk;
  // Faces (the case parts follow, once the layout has fixed the counts and face heights)
  const gap = d.frontGap, openH = boxH - d.topReveal - d.bottomReveal, frontW = W - 2 * d.sideReveal;
  const hs = layout.map(s => { const v = parseDim(s.h); return isNaN(v) || v <= 0 ? null : v; });
  const fixed = hs.reduce<number>((a, v) => a + (v || 0), 0), nAuto = hs.filter(v => v == null).length;
  const avail = openH - (layout.length - 1) * gap;
  const autoH = nAuto ? (avail - fixed) / nAuto : 0;
  if (nAuto && autoH < 3 && !out.warn) out.warn = `Fixed faces leave only ${f(Math.max(0, autoH))}" for each auto section.`;
  if (!nAuto && Math.abs(avail - fixed) > 0.01 && !out.warn) out.warn = `Faces total ${f(fixed)}" but the opening is ${f(avail)}". Clear one height to make it auto.`;
  out.autoH = autoH; out.avail = avail;
  const glide = glideLen(D, d);
  let y = d.topReveal, spacers = 0, drawerStretch = 0, fixedShelves = 0, shelves = 0, rollouts = 0, drawerPulls = 0, doorPulls = 0, hinges = 0, drawerCount = 0;
  // Partitions between drawers side by side: one group per split drawer section, as tall as the section.
  const partitions: { qty: number; l: number }[] = [];
  const drawerish = (k: Kind) => k === 'drawer' || k === 'false';
  layout.forEach((s, i) => {
    const h = hs[i] ?? Math.max(autoH, 0);
    let n = s.kind === 'door' ? (+s.split || (W > d.doorSplit ? 2 : 1)) : Math.max(1, +s.split || 1);
    if (s.kind === 'false' || s.kind === 'open') n = 1;
    const pw = (frontW - (n - 1) * gap) / n;
    const tag = LETTERS[i] || String(i + 1);
    const sec: Section = {
      i, tag, kind: s.kind, y, h, n, pw, shelves: +s.shelves || 0, rollouts: +s.rollouts || 0, hinge: s.hinge || 'L', auto: hs[i] == null,
      pieces: Array.from({ length: n }, (_, j) => ({ x: d.sideReveal + j * (pw + gap), w: pw })),
      spacerL: s.kind === 'door' && (n > 1 || (s.hinge || 'L') === 'L'),
      spacerR: s.kind === 'door' && (n > 1 || s.hinge === 'R'),
    };
    out.sections.push(sec);
    const nm = ({ drawer: 'Drawer Front', door: 'Door', false: 'False Front' } as Partial<Record<Kind, string>>)[s.kind];
    if (nm) F(n, `${nm} ${tag}`, pw, h, s.kind);
    if (s.kind === 'drawer') {
      const openW = (inW - (n - 1) * thk) / n;
      const bh = h < 7 ? d.smallBoxH : h < 10 ? Math.min(6, d.bigBoxH) : h < 13 ? d.bigBoxH : d.xlBoxH;
      // Box width: the opening between case sides (or partitions) less the guides' side-to-side clearance.
      out.drawers.push({ qty: n, kind: 'Drawer', w: openW - d.glideClear, dp: glide, h: bh, sec: tag });
      if (n > 1) partitions.push({ qty: n - 1, l: h + gap });
      drawerPulls += n; drawerCount += n;
    }
    if (s.kind === 'door') { doorPulls += n; hinges += n * (h > 60 ? 4 : h > 40 ? 3 : 2); }
    if (s.kind === 'door' || s.kind === 'open') {
      shelves += sec.shelves;
      if (sec.rollouts) {
        const nSp = +sec.spacerL + +sec.spacerR;
        out.drawers.push({ qty: sec.rollouts, kind: 'Roll-out', w: inW - nSp * d.rolloutSpacer - d.glideClear, dp: glide, h: d.rolloutH, sec: tag });
        rollouts += sec.rollouts; spacers += sec.rollouts * nSp;
      }
    }
    if (i < layout.length - 1) {
      const a = s.kind, b = layout[i + 1].kind;
      if (drawerish(a) && drawerish(b)) { /* fronts share a stretcher-less opening */ }
      else if (drawerish(a) || drawerish(b)) drawerStretch++;
      else fixedShelves++;
    }
    y += h + gap;
  });
  if (!isWall && !isTall && layout.some(s => s.kind === 'drawer')) drawerStretch = Math.max(drawerStretch, 1);
  // Case: the box's parts list (or what its category style builds), each sized from the named dimensions.
  // Edge banding: the front edge of ends, decks, tops, shelves and partitions, the long edge of stretchers.
  const ctx = { ...caseDims(out, d), inD, backThk };
  const autoQty: Record<string, number> = { drawerStretcher: drawerStretch, fixedShelf: fixedShelves, adjShelf: shelves };
  const autoSize: Record<string, { w?: number; l?: number }> = { partition: { w: inD } };
  const matOf = (m: MatSlot) => (m === 'back' ? backMat : m === 'front' ? d.frontMat : m === 'toe' ? d.toeMat : finished ? d.frontMat : d.caseMat);
  let adjShelves = 0;
  for (const part of t.case?.parts ?? defaultCaseParts(style)) {
    if (!part.on) continue;
    const size = (k: 'w' | 'l') => (part[k].trim() === 'auto' ? (autoSize[part.key]?.[k] ?? NaN) : evalDim(part[k], ctx));
    const skip = (k: 'w' | 'l') => out.skipped.push(`${part.name}: can't read ${k === 'w' ? 'width' : 'length'} "${part[k]}"`);
    const w = size('w');
    if (isNaN(w) || w <= 0) { skip('w'); continue; }
    if (part.key === 'partition') {
      for (const s of partitions) P(s.qty, part.name, w, s.l, part.grain, matOf(part.mat), bandInches(part.band, w, s.l));
      continue;
    }
    const qty = resolveQty(part.qty, autoQty[part.key] ?? 1);
    if (qty <= 0) continue;
    const l = size('l');
    if (isNaN(l) || l <= 0) { skip('l'); continue; }
    if (part.key === 'adjShelf') adjShelves += qty;
    P(qty, part.name, w, l, part.grain, matOf(part.mat), bandInches(part.band, w, l));
  }
  // Hardware
  const spec = `${d.glideSeries}${Math.round(glide * 25.4)}0B ${f(glide)}"`;
  if (drawerPulls) out.hardware.push({ qty: drawerPulls, item: 'Drawer Pull', spec: d.pull });
  if (doorPulls) out.hardware.push({ qty: doorPulls, item: 'Door Pull', spec: d.pull });
  if (drawerCount) out.hardware.push({ qty: drawerCount, item: 'Drawer Guide (pair)', spec });
  if (rollouts) {
    out.hardware.push({ qty: rollouts, item: 'Roll-out Guide (pair)', spec });
    if (spacers) out.hardware.push({ qty: spacers, item: 'Roll-out Spacer', spec: `${f(d.rolloutSpacer)} x 3 x ${f(inD - 1)}` });
  }
  if (hinges) out.hardware.push({ qty: hinges, item: 'Hinge', spec: d.hinge });
  if (adjShelves) out.hardware.push({ qty: adjShelves * 4, item: 'Shelf Pin', spec: '5mm' });
  return out;
}

/** The DIM_TOKENS values for a built cabinet: its sizes, the method's rules and each face's height (faceA, faceB, …). */
export function caseDims(cab: Pick<BuiltCabinet, 'W' | 'H' | 'D' | 'boxH' | 'sections'>, d: Resolved): Record<string, number> {
  const ctx: Record<string, number> = {
    inW: cab.W - 2 * d.caseThk, inD: cab.D - d.backInset - d.backThk, D: cab.D, W: cab.W, H: cab.H, boxH: cab.boxH,
    stretcherW: d.stretcherW, smallFront: d.smallFront, tallLowerDoor: d.tallLowerDoor,
    caseThk: d.caseThk, backThk: d.backThk, backGroove: d.backGroove, shelfSetback: d.shelfSetback, shelfClear: d.shelfClear,
  };
  cab.sections.forEach((s, i) => { if (i < LETTERS.length) ctx[`face${LETTERS[i]}`] = s.h; });
  return ctx;
}

function glideLen(D: number, d: Resolved) {
  const max = D - d.glideDeduct;
  const fit = d.glideLenList.filter(l => l <= max);
  return fit.length ? fit[fit.length - 1] : d.glideLenList[0] || max;
}

export interface MaterialRow { desc: string; w: number; l: number; grain: Grain; qty: number; cabs: string[]; size: string; grainTxt: string; cabsTxt: string }
/** Parts of one material, grouped for the cut list. `bandLf`: estimated lineal feet of edge banding on them. */
export interface MaterialGroup { name: string; rows: MaterialRow[]; rips: string; bandLf: number }
/** `cut`: a slab front cut in the shop; otherwise the row is an ordered front, listed only. */
export interface DoorRow { w: number; l: number; type: 'DR' | 'FF' | 'DF'; grain: Grain; cut: boolean; qty: number; cabs: string[]; size: string; cabsTxt: string }
export interface DrawerRow extends DrawerBox { cabs: string[]; wTxt: string; dTxt: string; hTxt: string; cabsTxt: string }
/** A part placed on a sheet. Drawing coordinates: x along the sheet length (grain), y across its width. */
export interface SawPart {
  id: number; name: string; along: number; across: number; grain: Grain; cab: number;
  alongTxt: string; acrossTxt: string; label: string; sub: string;
  x: number; y: number; tx: number; ty: number; arrow: string;
  /** Cut from a wider strip, so it needs an extra rip down to width. */
  recut: boolean;
}
/** One saw cut, numbered in the order the operator makes it. */
export interface SawCut { n: number; kind: 'trim' | 'rip' | 'cross' | 'recut'; x1: number; y1: number; x2: number; y2: number; text: string }
export interface SawSheet { title: string; yieldTxt: string; parts: SawPart[]; cuts: SawCut[]; strips: { y: number; w: number }[] }
export interface SawPlan { name: string; L: number; W: number; trim: number; oversize: { name: string; along: number; across: number }[]; sheets: SawSheet[] }
/** Sheets of one material a job needs, totalled from its saw plan. */
export interface SheetTotal { name: string; L: number; W: number; sheets: number; parts: number; yieldPct: number; oversize: number; bandLf: number }
export function sheetTotals(plans: SawPlan[], groups: MaterialGroup[] = []): SheetTotal[] {
  return plans.map(p => {
    const parts = p.sheets.reduce((n, s) => n + s.parts.length, 0);
    const used = p.sheets.reduce((a, s) => a + s.parts.reduce((b, q) => b + q.along * q.across, 0), 0);
    const total = p.sheets.length * p.L * p.W;
    return { name: p.name, L: p.L, W: p.W, sheets: p.sheets.length, parts, yieldPct: total ? (100 * used) / total : 0, oversize: p.oversize.length, bandLf: groups.find(g => g.name === p.name)?.bandLf ?? 0 };
  });
}

export interface JobResult {
  d: Resolved; cabs: BuiltCabinet[]; materials: MaterialGroup[]; doors: DoorRow[]; drawers: DrawerRow[];
  hardware: HardwareItem[]; sawPlans: SawPlan[];
  /** Estimated lineal feet of edge banding, case parts apart from doors and drawer fronts (cut slab fronts only). */
  bandLf: { case: number; front: number };
  summary: { nParts: number; nFronts: number; nDrawers: number; sheets: number };
}

const cabRef = (idx: number, q: number) => (q > 1 ? `${idx} (${q})` : `${idx}`);

export function buildJob(cabs: CabInput[], rawDefaults?: RawDefaults | null, mode: DimFormat = 'fraction', jobMaterials?: JobMaterials | null, catalog: CabCatalog = BUILTIN_CATALOG, fronts?: JobFronts | null, shopMaterials?: Material[] | null): JobResult {
  const f = makeFmt(mode);
  const d = resolveDefaults(rawDefaults, jobMaterials, fronts, shopMaterials);
  const built = cabs.map((c, i) => buildCabinet(c, d, i + 1, f, catalog));
  const byMat: Record<string, { name: string; rows: Record<string, Omit<MaterialRow, 'size' | 'grainTxt' | 'cabsTxt'>>; rips: Record<number, number>; band: number }> = {};
  const key = (p: Part) => `${p.desc}|${p.w}|${p.l}|${p.grain}`;
  const bandIn = { case: 0, front: 0 };
  for (const cb of built) {
    if (cb.bad) continue;
    for (const p of [...cb.parts, ...cb.fronts]) {
      if (!p.cut) continue;
      bandIn[cb.parts.includes(p) ? 'case' : 'front'] += p.qty * cb.qty * p.band;
      const m = byMat[p.mat] || (byMat[p.mat] = { name: p.mat, rows: {}, rips: {}, band: 0 });
      const k = key(p), q = p.qty * cb.qty;
      const r = m.rows[k] || (m.rows[k] = { desc: p.desc, w: p.w, l: p.l, grain: p.grain, qty: 0, cabs: [] });
      r.qty += q; r.cabs.push(cabRef(cb.idx, q));
      m.rips[p.w] = (m.rips[p.w] || 0) + (q * (p.l + d.kerf)) / 12;
      m.band += q * p.band;
    }
  }
  const order = [d.backMat, d.caseMat, d.frontMat];
  const materials: MaterialGroup[] = Object.values(byMat).sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)).map(m => ({
    name: m.name,
    rows: Object.values(m.rows).sort((a, b) => b.w - a.w || b.l - a.l).map(r => ({
      ...r, size: `${f(r.w)} x ${f(r.l)}`, grainTxt: r.grain === 'Vertical' ? 'Vertical (along L)' : 'Horizontal (along W)', cabsTxt: r.cabs.join(', '),
    })),
    rips: Object.entries(m.rips).sort((a, b) => +b[0] - +a[0]).map(([w, lf]) => `${f(+w)}": ${lf.toFixed(1)} lf`).join('   '),
    bandLf: m.band / 12,
  }));
  const doorRows: Record<string, Omit<DoorRow, 'size' | 'cabsTxt'>> = {};
  const drawerRows: Record<string, DrawerBox & { cabs: string[] }> = {};
  for (const cb of built) {
    if (cb.bad) continue;
    for (const fr of cb.fronts) {
      const type = fr.desc.includes('Door') ? 'DR' : fr.desc.includes('False') ? 'FF' : 'DF';
      const k = `${type}|${fr.w}|${fr.l}`;
      const r = doorRows[k] || (doorRows[k] = { w: fr.w, l: fr.l, type, grain: fr.grain, cut: fr.cut, qty: 0, cabs: [] });
      const q = fr.qty * cb.qty; r.qty += q; r.cabs.push(cabRef(cb.idx, q));
    }
    for (const dr of cb.drawers) {
      const k = `${dr.kind}|${dr.w}|${dr.dp}|${dr.h}`;
      const r = drawerRows[k] || (drawerRows[k] = { ...dr, qty: 0, cabs: [] });
      const q = dr.qty * cb.qty; r.qty += q; r.cabs.push(cabRef(cb.idx, q));
    }
  }
  const doors = Object.values(doorRows).sort((a, b) => b.l - a.l).map(r => ({ ...r, size: `${f(r.w)} x ${f(r.l)}`, cabsTxt: r.cabs.join(', ') }));
  const drawers = Object.values(drawerRows).sort((a, b) => a.kind.localeCompare(b.kind) || b.h - a.h)
    .map(r => ({ ...r, wTxt: f(r.w), dTxt: f(r.dp), hTxt: f(r.h), cabsTxt: r.cabs.join(', ') }));
  const hw: Record<string, HardwareItem> = {};
  for (const cb of built) {
    if (cb.bad) continue;
    for (const h of cb.hardware) { const k = `${h.item}|${h.spec}`; hw[k] = hw[k] || { ...h, qty: 0 }; hw[k].qty += h.qty * cb.qty; }
  }
  const hardware = Object.values(hw);
  const sawPlans = materials.map(m => sawPlan(m, built, d, f));
  const nFronts = doors.reduce((s, r) => s + r.qty, 0), nDrawers = drawers.reduce((s, r) => s + r.qty, 0);
  const nParts = materials.reduce((s, m) => s + m.rows.reduce((t, r) => t + r.qty, 0), 0);
  return { d, cabs: built, materials, doors, drawers, hardware, sawPlans, bandLf: { case: bandIn.case / 12, front: bandIn.front / 12 }, summary: { nParts, nFronts, nDrawers, sheets: sawPlans.reduce((s, n) => s + n.sheets.length, 0) } };
}

// Panel saw optimizer (two-stage guillotine). Each sheet is trimmed on one long and one short
// edge, ripped into full-length strips along the grain, then each strip is crosscut into parts.
// Parts are never rotated. A part narrower than its strip gets one extra rip down to width.
// Each material is planned on its own stock sheet size.
function sawPlan(m: MaterialGroup, built: BuiltCabinet[], d: Resolved, f: Fmt): SawPlan {
  type Item = { id: number; name: string; along: number; across: number; grain: Grain; cab: number };
  const items: Item[] = [];
  let n = 0;
  for (const cb of built) {
    if (cb.bad) continue;
    for (let q = 0; q < cb.qty; q++) for (const p of [...cb.parts, ...cb.fronts]) {
      if (p.mat !== m.name || !p.cut) continue;
      for (let i = 0; i < p.qty; i++) {
        const along = p.grain === 'Vertical' ? p.l : p.w, across = p.grain === 'Vertical' ? p.w : p.l;
        items.push({ id: ++n, name: p.desc, along, across, grain: p.grain, cab: cb.idx });
      }
    }
  }
  const sheet = d.sheets[m.name] ?? { L: d.sheetL, W: d.sheetW };
  const L = sheet.L, W = sheet.W, k = d.kerf, t = Math.max(0, d.edgeTrim);
  const UL = L - t, UW = W - t, eps = 1e-6;
  const oversize = items.filter(it => it.along > UL + eps || it.across > UW + eps);
  const fits = items.filter(it => !oversize.includes(it));

  // Stage 2 first: fill strips. Widest parts first; same-width strip if one has room, otherwise
  // the leftover length of the narrowest wider strip, otherwise a new strip at this part's width.
  type Strip = { w: number; len: number; parts: Item[] };
  const strips: Strip[] = [];
  const room = (s: Strip, it: Item) => s.len + (s.parts.length ? k : 0) + it.along <= UL + eps;
  fits.sort((a, b) => b.across - a.across || b.along - a.along);
  for (const it of fits) {
    const exact = strips.find(s => Math.abs(s.w - it.across) < eps && room(s, it));
    const wider = exact ? undefined : strips.filter(s => s.w > it.across + eps && room(s, it)).sort((a, b) => a.w - b.w || b.len - a.len)[0];
    const s = exact ?? wider ?? (strips[strips.push({ w: it.across, len: 0, parts: [] }) - 1]);
    s.len += (s.parts.length ? k : 0) + it.along;
    s.parts.push(it);
  }

  // Stage 1: rip strips out of sheets, widest first, first sheet with room across its width.
  type Sheet = { used: number; strips: Strip[] };
  const sheets: Sheet[] = [];
  for (const s of [...strips].sort((a, b) => b.w - a.w || b.len - a.len)) {
    const sh = sheets.find(x => x.used + (x.strips.length ? k : 0) + s.w <= UW + eps) ?? (sheets[sheets.push({ used: 0, strips: [] }) - 1]);
    sh.used += (sh.strips.length ? k : 0) + s.w;
    sh.strips.push(s);
  }

  const total = sheets.length;
  return {
    name: m.name, L, W, trim: t, oversize,
    sheets: sheets.map((sh, i) => {
      const cuts: SawCut[] = [], parts: SawPart[] = [], stripBoxes: { y: number; w: number }[] = [];
      const cut = (kind: SawCut['kind'], x1: number, y1: number, x2: number, y2: number, text: string) =>
        cuts.push({ n: cuts.length + 1, kind, x1, y1, x2, y2, text });
      if (t > 0) {
        cut('trim', 0, t, L, t, `Trim ${f(t)}" off the long edge`);
        cut('trim', t, t, t, W, `Trim ${f(t)}" off the short edge`);
      }
      // Rips: one per strip, except where the strip ends at the sheet edge.
      let y = t;
      sh.strips.forEach((s, si) => {
        stripBoxes.push({ y, w: s.w });
        if (y + s.w < W - k) cut('rip', t, y + s.w, L, y + s.w, `Rip strip ${si + 1} at ${f(s.w)}"`);
        y += s.w + k;
      });
      // Crosscuts strip by strip, plus a rip down to width for any narrower part.
      sh.strips.forEach((s, si) => {
        const sy = stripBoxes[si].y;
        let x = t;
        for (const it of s.parts) {
          const recut = it.across < s.w - eps;
          if (x + it.along < L - k) cut('cross', x + it.along, sy, x + it.along, sy + s.w, `Strip ${si + 1}: crosscut ${f(it.along)}" → #${it.id} ${it.name}`);
          if (recut) cut('recut', x, sy + it.across, x + it.along, sy + it.across, `Rip #${it.id} down to ${f(it.across)}"`);
          parts.push({
            id: it.id, name: it.name, along: it.along, across: it.across, grain: it.grain, cab: it.cab,
            alongTxt: f(it.along), acrossTxt: f(it.across), label: `#${it.id} ${it.name}`, sub: `${f(it.along)} x ${f(it.across)} cab ${it.cab}`,
            x, y: sy, tx: x + it.along / 2, ty: sy + it.across / 2, arrow: it.grain === 'Vertical' ? '→' : '↕', recut,
          });
          x += it.along + k;
        }
      });
      const area = parts.reduce((a, p) => a + p.along * p.across, 0);
      return {
        title: `${m.name} — Sheet ${i + 1} of ${total} (${f(W)} x ${f(L)})`,
        yieldTxt: `Yield ${((100 * area) / (L * W)).toFixed(1)}%`,
        parts, cuts, strips: stripBoxes,
      };
    }),
  };
}

export interface ElevShape {
  x: number; y: number; w: number; h: number; label: string; tag: string; secTag: string;
  tx: number; ty: number; kind: Kind; sec: number; hinge: Hinge | '';
}

// Face pieces for elevations. Coordinates in inches from box top-left.
export function elevShapes(cb: BuiltCabinet, f: Fmt = n => fmt(n)): ElevShape[] {
  if (cb.bad) return [];
  const shapes: ElevShape[] = [];
  for (const s of cb.sections) s.pieces.forEach((p, j) => {
    const hinge: Hinge | '' = s.kind !== 'door' ? '' : s.n === 1 ? s.hinge : j < s.n / 2 ? 'L' : 'R';
    shapes.push({
      x: p.x, y: s.y, w: p.w, h: s.h, label: f(s.h), tag: `${cb.idx}${s.tag}${s.n > 1 ? j + 1 : ''}`, secTag: `${s.tag}${s.n > 1 ? j + 1 : ''}`,
      tx: p.x + p.w / 2, ty: s.y + s.h / 2, kind: s.kind, sec: s.i, hinge,
    });
  });
  return shapes;
}
