import type { CabInput, DimFormat, FrontStyle, JobFronts, JobMaterials, Kind, Material, RawDefaults, SectionInput } from './engine';
import { BOX_FIELD, DEFAULTS, HARDWARE_FIELDS, fmt } from './engine';
import { PRESETS } from './presets';
import { BUILTIN_DOOR_STYLES, BUILTIN_DRAWER_FRONT_STYLES, type ShopConfig, defaultJobMaterials, defaultShopConfig, materialByName, normMaterial, normStyle, styleByName } from './shop';

export interface JobInfo { name: string; client: string; catalog: string; drawn: string }

/** Everything that makes up a saved job. Stored as JSON in SQLite and in exported files. */
export interface JobDoc {
  version: 1;
  job: JobInfo;
  /** Construction rule overrides and hardware picks. Saw settings come from the shop at build time. */
  defaults: RawDefaults;
  cabs: CabInput[];
  dimFormat: DimFormat;
  /** Construction method key (see presets.ts); `defaults` holds its rule values plus any edits. */
  method: string;
  /** Copies of the materials picked for the case, back and fronts, so the file stands on its own. */
  materials: JobMaterials;
  /** Copies of the door and drawer front styles; the drawer box type is `defaults.drawerStyle`. */
  fronts: JobFronts;
  /** False until the setup page's "Continue to items" is pressed; new jobs open on setup. */
  setupDone: boolean;
}

/** A row of the job list. `owner` is the username, null for jobs saved before accounts existed. */
export interface JobSummary {
  id: string; name: string; client: string; catalog: string; cabs: number;
  ownerId: string | null; owner: string | null; createdAt: string; updatedAt: string;
}

const MELAMINE_34: Material = { name: '3/4 2s Melamine', thk: '3/4', w: '49', l: '97' };
const MELAMINE_14: Material = { name: '1/4 1s Melamine', thk: '1/4', w: '49', l: '97' };

export function sampleJob(): JobDoc {
  return {
    version: 1,
    job: { name: '3DB15 Sample', client: 'LV Home Service', catalog: 'Optima', drawn: 'JG' },
    defaults: {},
    cabs: [
      { id: 1, type: '3DB', w: '15', h: '30', d: '21', toe: '0', qty: '1', layout: null },
      { id: 2, type: 'V', w: '30', h: '30', d: '21', toe: '0', qty: '1', layout: null },
      { id: 3, type: 'W', w: '30', h: '30', d: '12', toe: '0', qty: '1', layout: null },
    ],
    dimFormat: 'fraction',
    method: PRESETS[0].key,
    materials: { case: { ...MELAMINE_34 }, back: { ...MELAMINE_14 }, front: { ...MELAMINE_34 } },
    fronts: { door: { name: 'Slab (Melamine)', slab: true, grain: 'Vertical' }, drawer: { name: 'Slab (Melamine)', slab: true, grain: 'Vertical' } },
    setupDone: true,
  };
}

/** A blank job on the shop's default method, materials and first hardware choices. */
export function emptyJob(shop: ShopConfig = defaultShopConfig()): JobDoc {
  const preset = shop.presets[0] ?? PRESETS[0];
  const defaults: RawDefaults = { ...preset.values };
  for (const [k] of [...HARDWARE_FIELDS, BOX_FIELD]) { const first = shop.options[k]?.[0]; if (first) defaults[k] = first; }
  return {
    version: 1, job: { name: '', client: '', catalog: '', drawn: '' }, defaults, cabs: [], dimFormat: 'fraction',
    method: preset.key, materials: defaultJobMaterials(shop.materials),
    fronts: { door: { ...(shop.doorStyles[0] ?? BUILTIN_DOOR_STYLES[0]) }, drawer: { ...(shop.drawerFrontStyles[0] ?? BUILTIN_DRAWER_FRONT_STYLES[0]) } },
    setupDone: false,
  };
}

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback);
const KINDS: Kind[] = ['drawer', 'door', 'false', 'open'];

function normSection(s: unknown): SectionInput | null {
  if (!s || typeof s !== 'object') return null;
  const o = s as Record<string, unknown>;
  const kind = KINDS.includes(o.kind as Kind) ? (o.kind as Kind) : null;
  if (!kind) return null;
  return {
    kind,
    h: typeof o.h === 'number' ? o.h : str(o.h),
    split: Number(o.split) || 0,
    shelves: Number(o.shelves) || 0,
    rollouts: Number(o.rollouts) || 0,
    hinge: o.hinge === 'R' ? 'R' : 'L',
  };
}

/** Rule keys that used to live in a job's defaults and now come from its materials or the shop's saw settings. */
const MOVED_KEYS = ['caseMat', 'backMat', 'frontMat', 'caseThk', 'backThk', 'sheetL', 'sheetW', 'kerf', 'edgeTrim', 'doorStyle'] as const;

/** Front styles for a job saved before they existed: its old door style name, looked up in the shop's lists. */
function migrateFronts(defaults: RawDefaults, shop: ShopConfig): JobFronts {
  const name = defaults.doorStyle || DEFAULTS.doorStyle;
  const guess: FrontStyle = { name, slab: /slab/i.test(name), grain: 'Vertical' };
  return { door: { ...(styleByName(shop.doorStyles, name) ?? guess) }, drawer: { ...(styleByName(shop.drawerFrontStyles, name) ?? guess) } };
}

/** Materials for a job saved before they existed: names, thicknesses and sheet size from its old rules. */
function migrateMaterials(defaults: RawDefaults, shop: ShopConfig): JobMaterials {
  const one = (name: string, thk: string | undefined): Material => {
    const known = materialByName(shop.materials, name);
    return {
      name,
      thk: thk || known?.thk || fmt(DEFAULTS.caseThk),
      w: defaults.sheetW ?? known?.w ?? fmt(DEFAULTS.sheetW),
      l: defaults.sheetL ?? known?.l ?? fmt(DEFAULTS.sheetL),
    };
  };
  const caseName = defaults.caseMat || DEFAULTS.caseMat, backName = defaults.backMat || DEFAULTS.backMat, frontName = defaults.frontMat || DEFAULTS.frontMat;
  return {
    case: one(caseName, defaults.caseThk),
    back: { ...one(backName, defaults.backThk), thk: defaults.backThk || materialByName(shop.materials, backName)?.thk || fmt(DEFAULTS.backThk) },
    front: one(frontName, defaults.caseThk),
  };
}

/**
 * Validate untrusted JSON (imported file or request body) into a JobDoc. Throws on unusable input.
 * `shop` supplies the construction methods (an unknown method falls back to the first one) and the
 * materials table used to migrate jobs saved before materials were part of the job.
 */
export function normalizeJobDoc(raw: unknown, shop: ShopConfig = defaultShopConfig()): JobDoc {
  if (!raw || typeof raw !== 'object') throw new Error('Job file is not a JSON object.');
  const r = raw as Record<string, unknown>;
  const j = (r.job && typeof r.job === 'object' ? r.job : {}) as Record<string, unknown>;
  if (!Array.isArray(r.cabs)) throw new Error('Job file has no cabinet list.');
  const defaults: RawDefaults = {};
  if (r.defaults && typeof r.defaults === 'object') {
    for (const [k, v] of Object.entries(r.defaults as Record<string, unknown>)) {
      // Rules the app no longer has (such as the old wall top height) are dropped.
      if (!(k in DEFAULTS)) continue;
      if (typeof v === 'string' || typeof v === 'number') (defaults as Record<string, string>)[k] = String(v);
    }
  }
  // Materials: the job's own copies, or built from the old material/thickness/sheet rules.
  let materials: JobMaterials | null = null;
  if (r.materials && typeof r.materials === 'object') {
    const m = r.materials as Record<string, unknown>;
    const c = normMaterial(m.case), b = normMaterial(m.back), f = normMaterial(m.front);
    if (c && b && f) materials = { case: c, back: b, front: f };
  }
  if (!materials) materials = migrateMaterials(defaults, shop);
  let fronts: JobFronts | null = null;
  if (r.fronts && typeof r.fronts === 'object') {
    const o = r.fronts as Record<string, unknown>;
    const door = normStyle(o.door), drawer = normStyle(o.drawer);
    if (door && drawer) fronts = { door, drawer };
  }
  if (!fronts) fronts = migrateFronts(defaults, shop);
  for (const k of MOVED_KEYS) delete defaults[k];

  const cabs: CabInput[] = r.cabs.map((c: unknown, i: number) => {
    const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    const layout = Array.isArray(o.layout) ? o.layout.map(normSection).filter((s): s is SectionInput => !!s) : null;
    return {
      id: Number(o.id) || i + 1,
      // Codes are kept as saved: a box that was removed from the shop's catalog still shows its code and warns when built.
      type: str(o.type).trim() || shop.catalog.types[0]?.code || 'B',
      w: str(o.w), h: str(o.h), d: str(o.d), toe: str(o.toe, '0'), qty: str(o.qty, '1'),
      layout: layout && layout.length ? layout : null,
    };
  });
  // Ids must be unique for row keys and selection.
  const seen = new Set<number>();
  let next = Math.max(0, ...cabs.map(c => c.id)) + 1;
  for (const c of cabs) { if (seen.has(c.id)) c.id = next++; seen.add(c.id); }
  const presets = shop.presets;
  return {
    version: 1,
    job: { name: str(j.name, 'Untitled job'), client: str(j.client), catalog: str(j.catalog), drawn: str(j.drawn) },
    defaults,
    cabs,
    dimFormat: r.dimFormat === 'decimal' ? 'decimal' : 'fraction',
    method: presets.some(p => p.key === r.method) ? (r.method as string) : (presets[0]?.key ?? PRESETS[0].key),
    materials,
    fronts,
    // Jobs saved before setup existed have no flag: treat them as set up.
    setupDone: r.setupDone !== false,
  };
}
