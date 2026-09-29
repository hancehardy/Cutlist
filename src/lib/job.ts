import type { CabInput, DimFormat, Kind, RawDefaults, SectionInput } from './engine';
import { TYPES } from './engine';
import { DEFAULT_PRESET, PRESETS } from './presets';

export interface JobInfo { name: string; client: string; catalog: string; drawn: string }

/** Everything that makes up a saved job. Stored as JSON in SQLite and in exported files. */
export interface JobDoc {
  version: 1;
  job: JobInfo;
  defaults: RawDefaults;
  cabs: CabInput[];
  dimFormat: DimFormat;
  /** Construction preset key (see presets.ts); `defaults` holds its values plus any edits. */
  method: string;
  /** False until the setup page's "Continue to items" is pressed; new jobs open on setup. */
  setupDone: boolean;
}

export interface JobSummary { id: string; name: string; client: string; updatedAt: string }

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
    method: DEFAULT_PRESET,
    setupDone: true,
  };
}

export function emptyJob(): JobDoc {
  return { version: 1, job: { name: '', client: '', catalog: '', drawn: '' }, defaults: {}, cabs: [], dimFormat: 'fraction', method: DEFAULT_PRESET, setupDone: false };
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

/** Validate untrusted JSON (imported file or request body) into a JobDoc. Throws on unusable input. */
export function normalizeJobDoc(raw: unknown): JobDoc {
  if (!raw || typeof raw !== 'object') throw new Error('Job file is not a JSON object.');
  const r = raw as Record<string, unknown>;
  const j = (r.job && typeof r.job === 'object' ? r.job : {}) as Record<string, unknown>;
  if (!Array.isArray(r.cabs)) throw new Error('Job file has no cabinet list.');
  const defaults: RawDefaults = {};
  if (r.defaults && typeof r.defaults === 'object') {
    for (const [k, v] of Object.entries(r.defaults as Record<string, unknown>)) {
      if (typeof v === 'string' || typeof v === 'number') (defaults as Record<string, string>)[k] = String(v);
    }
  }
  const cabs: CabInput[] = r.cabs.map((c: unknown, i: number) => {
    const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    const layout = Array.isArray(o.layout) ? o.layout.map(normSection).filter((s): s is SectionInput => !!s) : null;
    return {
      id: Number(o.id) || i + 1,
      type: typeof o.type === 'string' && TYPES[o.type] ? o.type : 'B',
      w: str(o.w), h: str(o.h), d: str(o.d), toe: str(o.toe, '0'), qty: str(o.qty, '1'),
      layout: layout && layout.length ? layout : null,
    };
  });
  // Ids must be unique for row keys and selection.
  const seen = new Set<number>();
  let next = Math.max(0, ...cabs.map(c => c.id)) + 1;
  for (const c of cabs) { if (seen.has(c.id)) c.id = next++; seen.add(c.id); }
  return {
    version: 1,
    job: { name: str(j.name, 'Untitled job'), client: str(j.client), catalog: str(j.catalog), drawn: str(j.drawn) },
    defaults,
    cabs,
    dimFormat: r.dimFormat === 'decimal' ? 'decimal' : 'fraction',
    method: PRESETS.some(p => p.key === r.method) ? (r.method as string) : DEFAULT_PRESET,
    // Jobs saved before setup existed have no flag: treat them as set up.
    setupDone: r.setupDone !== false,
  };
}
