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

export type Category = 'base' | 'wall' | 'tall' | 'vanity';
export const CATEGORIES: [Category, string][] = [['base', 'Base'], ['wall', 'Wall'], ['tall', 'Tall'], ['vanity', 'Vanity']];

export interface CabType { cat: Category; img: string; label: string; h: number; d: number; toe: number }
export const TYPES: Record<string, CabType> = {
  'B':    { cat: 'base', img: '/assets/sku/base-1td.png', label: '1 drawer, doors', h: 34.5, d: 24, toe: 4.5 },
  'BD':   { cat: 'base', img: '/assets/sku/base-fh.png', label: 'Full-height doors', h: 34.5, d: 24, toe: 4.5 },
  '2DB':  { cat: 'base', img: '/assets/sku/base-2d.png', label: '2 drawer', h: 34.5, d: 24, toe: 4.5 },
  '3DB':  { cat: 'base', img: '/assets/sku/base-3d.png', label: '3 drawer', h: 34.5, d: 24, toe: 4.5 },
  '4DB':  { cat: 'base', img: '/assets/sku/base-4d.png', label: '4 drawer', h: 34.5, d: 24, toe: 4.5 },
  'SB':   { cat: 'base', img: '/assets/sku/base-sink.png', label: 'Sink base', h: 34.5, d: 24, toe: 4.5 },
  'W':    { cat: 'wall', img: '/assets/sku/wall-std.png', label: 'Doors', h: 30, d: 12, toe: 0 },
  'WO':   { cat: 'wall', img: '/assets/sku/wall-open.png', label: 'Open shelf', h: 30, d: 12, toe: 0 },
  'T':    { cat: 'tall', img: '/assets/sku/tall-std.png', label: 'Pantry, upper + lower doors', h: 84, d: 24, toe: 4.5 },
  'TD':   { cat: 'tall', img: '/assets/sku/tall-po.png', label: 'Pantry, full-height doors', h: 84, d: 24, toe: 4.5 },
  'V':    { cat: 'vanity', img: '/assets/sku/van-fh.png', label: 'Doors', h: 30, d: 21, toe: 0 },
  'VSB':  { cat: 'vanity', img: '/assets/sku/van-sink.png', label: 'Sink, false front + doors', h: 30, d: 21, toe: 0 },
  'V3DB': { cat: 'vanity', img: '/assets/sku/van-3d.png', label: '3 drawer', h: 30, d: 21, toe: 0 },
};
export const categoryLabel = (cat: Category | undefined) => CATEGORIES.find(x => x[0] === cat)?.[1] ?? '';
export const configsFor = (cat: Category | undefined) =>
  Object.entries(TYPES).filter(([, t]) => t.cat === cat).map(([key, t]) => ({ key, ...t }));

export const DEFAULTS = {
  caseThk: 0.75, backThk: 0.25, stretcherW: 4, toeRecess: 3,
  frontGap: 0.125, sideReveal: 0.0625, topReveal: 0.0625, bottomReveal: 0.125,
  smallFront: 6.1875, boxDeduct: 1.9375, smallBoxH: 4, bigBoxH: 8, xlBoxH: 10,
  rolloutH: 3.5, rolloutSpacer: 1,
  glideSeries: '563H', glideLens: '9, 12, 15, 18, 21', glideDeduct: 3,
  kerf: 0.187, sheetL: 97, sheetW: 49,
  caseMat: '3/4 2s Melamine', backMat: '1/4 1s Melamine', frontMat: '3/4 2s Melamine',
  doorSplit: 24, tallLowerDoor: 30, wallTop: 96, pull: '4in C-Pull', hinge: 'Blum 110° Clip-top', shelfSetback: 1, shelfClear: 0.0625,
  drawerStyle: '5 Piece Drawer', doorStyle: 'Slab (Melamine)',
};
type DefaultsShape = typeof DEFAULTS;
export type DefaultKey = keyof DefaultsShape;
export type RawDefaults = Partial<Record<DefaultKey, string>>;

export const DEFAULT_FIELDS: [DefaultKey, string][] = [
  ['caseThk', 'Case thickness'], ['backThk', 'Back thickness'], ['stretcherW', 'Stretcher width'], ['toeRecess', 'Toe recess'],
  ['frontGap', 'Gap between fronts'], ['sideReveal', 'Side reveal (each)'], ['topReveal', 'Top reveal'], ['bottomReveal', 'Bottom reveal'],
  ['smallFront', 'Top drawer front height'], ['boxDeduct', 'Drawer box width deduct'], ['smallBoxH', 'Small box height'], ['bigBoxH', 'Large box height'], ['xlBoxH', 'Extra-large box height'],
  ['rolloutH', 'Roll-out height'], ['rolloutSpacer', 'Roll-out spacer (hinge side)'],
  ['glideDeduct', 'Glide deduct from depth'], ['doorSplit', 'Two doors above width'], ['tallLowerDoor', 'Tall lower door height'], ['wallTop', 'Wall cabinet top height'],
  ['shelfSetback', 'Shelf setback'], ['kerf', 'Kerf'], ['sheetL', 'Sheet length'], ['sheetW', 'Sheet width'],
];
export const DEFAULT_TEXT: [DefaultKey, string][] = [
  ['caseMat', 'Case material'], ['backMat', 'Back material'], ['frontMat', 'Front material'],
  ['glideSeries', 'Glide series'], ['glideLens', 'Glide lengths'], ['pull', 'Pull'], ['hinge', 'Hinge'], ['drawerStyle', 'Drawer style'], ['doorStyle', 'Door style'],
];
const NUM_KEYS = new Set<DefaultKey>(DEFAULT_FIELDS.map(f => f[0]));

export type Resolved = { [K in DefaultKey]: DefaultsShape[K] } & { glideLenList: number[] };

export function resolveDefaults(raw?: RawDefaults | null): Resolved {
  const d = {} as Record<string, unknown>;
  for (const k of Object.keys(DEFAULTS) as DefaultKey[]) {
    const v = raw?.[k] ?? DEFAULTS[k];
    d[k] = NUM_KEYS.has(k) ? (isNaN(parseDim(v)) ? DEFAULTS[k] : parseDim(v)) : v;
  }
  const r = d as Resolved;
  r.glideLenList = String(r.glideLens).split(/[,\s]+/).map(Number).filter(n => n > 0).sort((a, b) => a - b);
  return r;
}

export function cabCode(c: Pick<CabInput, 'type' | 'w'>, f: Fmt = n => fmt(n)) {
  const w = parseDim(c.w);
  return `${c.type}${isNaN(w) ? '' : f(w).replace(' ', '-')}`;
}

export function newSection(kind: Kind, h: string | number = '', o: Partial<SectionInput> = {}): SectionInput {
  return { kind, h, split: kind === 'door' ? 0 : 1, shelves: 0, rollouts: 0, hinge: 'L', ...o };
}

export function defaultLayout(type: string, d: Resolved, H: number): SectionInput[] {
  const S = newSection;
  switch (type) {
    case '3DB': return [S('drawer', d.smallFront), S('drawer'), S('drawer')];
    case '4DB': return [S('drawer', d.smallFront), S('drawer'), S('drawer'), S('drawer')];
    case 'B': return [S('drawer', d.smallFront), S('door', '', { shelves: 1 })];
    case 'BD': return [S('door', '', { shelves: 1 })];
    case '2DB': return [S('drawer'), S('drawer')];
    case 'WO': return [S('open', '', { shelves: H >= 30 ? 2 : 1 })];
    case 'TD': return [S('door', '', { shelves: 4 })];
    case 'VSB': return [S('false', d.smallFront), S('door')];
    case 'V3DB': return [S('drawer', d.smallFront), S('drawer'), S('drawer')];
    case 'SB': return [S('false', d.smallFront), S('door')];
    case 'W': return [S('door', '', { shelves: H >= 30 ? 2 : 1 })];
    case 'T': return [S('door', '', { shelves: 3 }), S('door', d.tallLowerDoor, { shelves: 1 })];
    default: return [S('door')];
  }
}
const LETTERS = 'ABCDEFGHIJKLMNOP';

export interface Part { qty: number; desc: string; w: number; l: number; grain: Grain; mat: string }
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
  idx: number; type: string; code: string; label: string; W: number; H: number; D: number; toe: number;
  parts: Part[]; fronts: Part[]; drawers: DrawerBox[]; hardware: HardwareItem[]; sections: Section[];
  warn: string; custom: boolean; bad: boolean; qty: number;
  boxH: number; isWall: boolean; isTall: boolean; autoH: number; avail: number;
}

export function buildCabinet(c: CabInput, d: Resolved, idx: number, f: Fmt = n => fmt(n)): BuiltCabinet {
  const W = parseDim(c.w), H = parseDim(c.h), D = parseDim(c.d);
  const toe = isNaN(parseDim(c.toe)) ? 0 : parseDim(c.toe);
  const t = TYPES[c.type] || TYPES.B;
  const bad = [W, H, D].some(isNaN) || W <= 0 || H <= 0 || D <= 0 || toe >= H;
  const out: BuiltCabinet = {
    idx, type: c.type, code: cabCode(c, f), label: `${f(W)}" ${t.label}`, W, H, D, toe,
    parts: [], fronts: [], drawers: [], hardware: [], sections: [], warn: '', custom: !!c.layout, bad,
    qty: Math.max(1, parseInt(c.qty) || 1), boxH: 0, isWall: false, isTall: false, autoH: 0, avail: 0,
  };
  if (bad) return out;
  const thk = d.caseThk, boxH = H - toe, inW = W - 2 * thk;
  const isWall = t.cat === 'wall', isTall = t.cat === 'tall';
  out.boxH = boxH; out.isWall = isWall; out.isTall = isTall;
  const P = (qty: number, desc: string, w: number, l: number, grain: Grain, mat: string) => out.parts.push({ qty, desc, w, l, grain, mat });
  const F = (qty: number, desc: string, w: number, l: number) => out.fronts.push({ qty, desc, w, l, grain: 'Vertical', mat: d.frontMat });
  const layout = c.layout && c.layout.length ? c.layout : defaultLayout(c.type, d, H);
  // Case
  P(1, 'Unfinished Left End', D, boxH, 'Vertical', d.caseMat);
  P(1, 'Unfinished Right End', D, boxH, 'Vertical', d.caseMat);
  P(1, 'Unfinished Back', W - thk, boxH - thk, 'Vertical', d.backMat);
  P(1, isWall ? 'Bottom' : 'Deck', D, inW, 'Horizontal', d.caseMat);
  if (isWall || isTall) {
    P(1, 'Top', D, inW, 'Horizontal', d.caseMat);
    P(isWall ? 2 : 1, 'Nailer', d.stretcherW, inW, 'Vertical', d.caseMat);
  } else {
    P(1, 'Nailer', d.stretcherW, inW, 'Vertical', d.caseMat);
    P(2, 'Top Stretcher', d.stretcherW, inW, 'Vertical', d.caseMat);
  }
  // Faces
  const gap = d.frontGap, openH = boxH - d.topReveal - d.bottomReveal, frontW = W - 2 * d.sideReveal;
  const hs = layout.map(s => { const v = parseDim(s.h); return isNaN(v) || v <= 0 ? null : v; });
  const fixed = hs.reduce<number>((a, v) => a + (v || 0), 0), nAuto = hs.filter(v => v == null).length;
  const avail = openH - (layout.length - 1) * gap;
  const autoH = nAuto ? (avail - fixed) / nAuto : 0;
  if (nAuto && autoH < 3) out.warn = `Fixed faces leave only ${f(Math.max(0, autoH))}" for each auto section.`;
  if (!nAuto && Math.abs(avail - fixed) > 0.01) out.warn = `Faces total ${f(fixed)}" but the opening is ${f(avail)}". Clear one height to make it auto.`;
  out.autoH = autoH; out.avail = avail;
  const glide = glideLen(D, d);
  const shelfD = D - d.backThk - d.shelfSetback, shelfW = inW - d.shelfClear;
  let y = d.topReveal, spacers = 0, drawerStretch = 0, fixedShelves = 0, shelves = 0, rollouts = 0, drawerPulls = 0, doorPulls = 0, hinges = 0, drawerCount = 0;
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
    if (nm) F(n, `${nm} ${tag}`, pw, h);
    if (s.kind === 'drawer') {
      const openW = (inW - (n - 1) * thk) / n;
      const bh = h < 7 ? d.smallBoxH : h < 10 ? Math.min(6, d.bigBoxH) : h < 13 ? d.bigBoxH : d.xlBoxH;
      out.drawers.push({ qty: n, kind: 'Drawer', w: openW - (d.boxDeduct - 2 * thk), dp: glide, h: bh, sec: tag });
      if (n > 1) P(n - 1, 'Drawer Partition', D - d.backThk, h + gap, 'Vertical', d.caseMat);
      drawerPulls += n; drawerCount += n;
    }
    if (s.kind === 'door') { doorPulls += n; hinges += n * (h > 60 ? 4 : h > 40 ? 3 : 2); }
    if (s.kind === 'door' || s.kind === 'open') {
      shelves += sec.shelves;
      if (sec.rollouts) {
        const nSp = +sec.spacerL + +sec.spacerR;
        out.drawers.push({ qty: sec.rollouts, kind: 'Roll-out', w: inW - nSp * d.rolloutSpacer - (d.boxDeduct - 2 * thk), dp: glide, h: d.rolloutH, sec: tag });
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
  if (drawerStretch) P(drawerStretch, 'Drawer Stretcher', d.stretcherW, inW, 'Vertical', d.caseMat);
  if (fixedShelves) P(fixedShelves, 'Fixed Shelf', D - d.backThk, inW, 'Horizontal', d.caseMat);
  if (shelves) P(shelves, 'Adjustable Shelf', shelfD, shelfW, 'Horizontal', d.caseMat);
  // Hardware
  const spec = `${d.glideSeries}${Math.round(glide * 25.4)}0B ${f(glide)}"`;
  if (drawerPulls) out.hardware.push({ qty: drawerPulls, item: 'Drawer Pull', spec: d.pull });
  if (doorPulls) out.hardware.push({ qty: doorPulls, item: 'Door Pull', spec: d.pull });
  if (drawerCount) out.hardware.push({ qty: drawerCount, item: 'Drawer Guide (pair)', spec });
  if (rollouts) {
    out.hardware.push({ qty: rollouts, item: 'Roll-out Guide (pair)', spec });
    if (spacers) out.hardware.push({ qty: spacers, item: 'Roll-out Spacer', spec: `${f(d.rolloutSpacer)} x 3 x ${f(D - d.backThk - 1)}` });
  }
  if (hinges) out.hardware.push({ qty: hinges, item: 'Hinge', spec: d.hinge });
  if (shelves) out.hardware.push({ qty: shelves * 4, item: 'Shelf Pin', spec: '5mm' });
  return out;
}

function glideLen(D: number, d: Resolved) {
  const max = D - d.glideDeduct;
  const fit = d.glideLenList.filter(l => l <= max);
  return fit.length ? fit[fit.length - 1] : d.glideLenList[0] || max;
}

export interface MaterialRow { desc: string; w: number; l: number; grain: Grain; qty: number; cabs: string[]; size: string; grainTxt: string; cabsTxt: string }
export interface Material { name: string; rows: MaterialRow[]; rips: string }
export interface DoorRow { w: number; l: number; type: 'DR' | 'FF' | 'DF'; qty: number; cabs: string[]; size: string; cabsTxt: string }
export interface DrawerRow extends DrawerBox { cabs: string[]; wTxt: string; dTxt: string; hTxt: string; cabsTxt: string }
export interface NestPart {
  id: number; name: string; along: number; across: number; grain: Grain; cab: number;
  alongTxt: string; acrossTxt: string; label: string; sub: string;
  sx: number; sy: number; sw: number; sh: number; tx: number; ty: number; arrow: string;
}
export interface NestSheet { title: string; yieldTxt: string; parts: NestPart[] }
export interface Nest { name: string; L: number; W: number; oversize: { name: string; along: number; across: number }[]; sheets: NestSheet[] }
export interface InstallItem {
  idx: number; code: string; x: number; y: number; w: number; h: number; toe: number;
  tx: number; ty: number; wTxt: string; wall: boolean; boxH: number; boxTop: number; dTxt: string;
}
export interface Install { items: InstallItem[]; totalW: number; viewBox: string; floorY: number; totalTxt: string; labelSize: number }
export interface JobResult {
  d: Resolved; cabs: BuiltCabinet[]; materials: Material[]; doors: DoorRow[]; drawers: DrawerRow[];
  hardware: HardwareItem[]; nests: Nest[]; install: Install;
  summary: { nParts: number; nFronts: number; nDrawers: number; sheets: number };
}

const cabRef = (idx: number, q: number) => (q > 1 ? `${idx} (${q})` : `${idx}`);

export function buildJob(cabs: CabInput[], rawDefaults?: RawDefaults | null, mode: DimFormat = 'fraction'): JobResult {
  const f = makeFmt(mode);
  const d = resolveDefaults(rawDefaults);
  const built = cabs.map((c, i) => buildCabinet(c, d, i + 1, f));
  const byMat: Record<string, { name: string; rows: Record<string, Omit<MaterialRow, 'size' | 'grainTxt' | 'cabsTxt'>>; rips: Record<number, number> }> = {};
  const key = (p: Part) => `${p.desc}|${p.w}|${p.l}|${p.grain}`;
  for (const cb of built) {
    if (cb.bad) continue;
    for (const p of [...cb.parts, ...cb.fronts]) {
      const m = byMat[p.mat] || (byMat[p.mat] = { name: p.mat, rows: {}, rips: {} });
      const k = key(p), q = p.qty * cb.qty;
      const r = m.rows[k] || (m.rows[k] = { desc: p.desc, w: p.w, l: p.l, grain: p.grain, qty: 0, cabs: [] });
      r.qty += q; r.cabs.push(cabRef(cb.idx, q));
      m.rips[p.w] = (m.rips[p.w] || 0) + (q * (p.l + d.kerf)) / 12;
    }
  }
  const order = [d.backMat, d.caseMat, d.frontMat];
  const materials: Material[] = Object.values(byMat).sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)).map(m => ({
    name: m.name,
    rows: Object.values(m.rows).sort((a, b) => b.w - a.w || b.l - a.l).map(r => ({
      ...r, size: `${f(r.w)} x ${f(r.l)}`, grainTxt: r.grain === 'Vertical' ? 'Vertical (along L)' : 'Horizontal (along W)', cabsTxt: r.cabs.join(', '),
    })),
    rips: Object.entries(m.rips).sort((a, b) => +b[0] - +a[0]).map(([w, lf]) => `${f(+w)}": ${lf.toFixed(1)} lf`).join('   '),
  }));
  const doorRows: Record<string, Omit<DoorRow, 'size' | 'cabsTxt'>> = {};
  const drawerRows: Record<string, DrawerBox & { cabs: string[] }> = {};
  for (const cb of built) {
    if (cb.bad) continue;
    for (const fr of cb.fronts) {
      const type = fr.desc.includes('Door') ? 'DR' : fr.desc.includes('False') ? 'FF' : 'DF';
      const k = `${type}|${fr.w}|${fr.l}`;
      const r = doorRows[k] || (doorRows[k] = { w: fr.w, l: fr.l, type, qty: 0, cabs: [] });
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
  const nests = materials.map(m => nestMaterial(m, built, d, f));
  const install = installLayout(built, d, f);
  const nFronts = doors.reduce((s, r) => s + r.qty, 0), nDrawers = drawers.reduce((s, r) => s + r.qty, 0);
  const nParts = materials.reduce((s, m) => s + m.rows.reduce((t, r) => t + r.qty, 0), 0);
  return { d, cabs: built, materials, doors, drawers, hardware, nests, install, summary: { nParts, nFronts, nDrawers, sheets: nests.reduce((s, n) => s + n.sheets.length, 0) } };
}

// Grain-locked row packer: parts are never rotated.
function nestMaterial(m: Material, built: BuiltCabinet[], d: Resolved, f: Fmt): Nest {
  type Item = { id: number; name: string; along: number; across: number; grain: Grain; cab: number; oversize?: boolean };
  const items: Item[] = [];
  let n = 0;
  for (const cb of built) {
    if (cb.bad) continue;
    for (let q = 0; q < cb.qty; q++) for (const p of [...cb.parts, ...cb.fronts]) {
      if (p.mat !== m.name) continue;
      for (let i = 0; i < p.qty; i++) {
        const along = p.grain === 'Vertical' ? p.l : p.w, across = p.grain === 'Vertical' ? p.w : p.l;
        items.push({ id: ++n, name: p.desc, along, across, grain: p.grain, cab: cb.idx });
      }
    }
  }
  items.sort((a, b) => b.along - a.along || b.across - a.across);
  const L = d.sheetL, Wd = d.sheetW, k = d.kerf;
  type Row = { y: number; h: number; x: number };
  type Sheet = { rows: Row[]; used: number; parts: (Item & { x: number; y: number })[] };
  const sheets: Sheet[] = [];
  for (const it of items) {
    if (it.along > L || it.across > Wd) { it.oversize = true; continue; }
    let placed = false;
    for (const s of sheets) {
      for (const r of s.rows) {
        if (it.along <= r.h && r.x + it.across <= Wd) { s.parts.push({ ...it, x: r.x, y: r.y }); r.x += it.across + k; placed = true; break; }
      }
      if (placed) break;
      if (s.used + it.along <= L) {
        const r = { y: s.used, h: it.along, x: it.across + k };
        s.rows.push(r); s.parts.push({ ...it, x: 0, y: r.y }); s.used += it.along + k; placed = true; break;
      }
    }
    if (!placed) {
      const s: Sheet = { rows: [{ y: 0, h: it.along, x: it.across + k }], used: it.along + k, parts: [{ ...it, x: 0, y: 0 }] };
      sheets.push(s);
    }
  }
  const total = sheets.length;
  return {
    name: m.name, L, W: Wd, oversize: items.filter(i => i.oversize),
    sheets: sheets.map((s, i) => {
      const area = s.parts.reduce((a, p) => a + p.along * p.across, 0);
      return {
        title: `${m.name} — Sheet ${i + 1} of ${total} (${f(Wd)} x ${f(L)})`,
        yieldTxt: `Yield ${((100 * area) / (L * Wd)).toFixed(1)}%`,
        parts: s.parts.map(p => ({
          id: p.id, name: p.name, along: p.along, across: p.across, grain: p.grain, cab: p.cab,
          alongTxt: f(p.along), acrossTxt: f(p.across), label: `#${p.id} ${p.name}`, sub: `${f(p.along)} x ${f(p.across)} cab ${p.cab}`,
          sx: p.y, sy: p.x, sw: p.along, sh: p.across, tx: p.y + p.along / 2, ty: p.x + p.across / 2,
          arrow: p.grain === 'Vertical' ? '→' : '↕',
        })),
      };
    }),
  };
}

function installLayout(built: BuiltCabinet[], d: Resolved, f: Fmt): Install {
  const good = built.filter(c => !c.bad);
  const gap = 1;
  let x = 0;
  const items: InstallItem[] = [];
  // Drawing top sits at the highest cabinet top; floor is below it.
  const top = Math.max(96, d.wallTop, ...good.map(c => c.H));
  for (const c of good) for (let q = 0; q < c.qty; q++) {
    const y = c.isWall ? top - d.wallTop : top - c.H;
    items.push({ idx: c.idx, code: c.code, x, y, w: c.W, h: c.H, toe: c.toe, tx: x + c.W / 2, ty: y + c.H / 2, wTxt: `${f(c.W)}"`, wall: c.isWall, boxH: c.boxH, boxTop: y, dTxt: `Depth ${f(c.D)}"` });
    x += c.W + gap;
  }
  const totalW = Math.max(x - gap, 24);
  const labelSize = Math.max(2.2, totalW / 45), headroom = labelSize * 2.2 + 1;
  return {
    items, totalW, viewBox: `-2 ${-headroom} ${totalW + 4} ${top + headroom + labelSize * 3.5}`, floorY: top,
    totalTxt: `Total ${f(totalW - (items.length - 1) * gap)}"`, labelSize,
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
