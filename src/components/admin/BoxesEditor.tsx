'use client';
import { useMemo, useRef, useState } from 'react';
import {
  AUTO_QTY_PARTS, AUTO_SIZED, BAND_EDGES, BUILD_STYLES, DEFAULT_PANEL, DIM_TOKENS, MAT_SLOTS, PANEL_BANDS, QTY_RE, SINK_SKIRT, STANDARD_PARTS,
  addCasePart, buildCabinet, caseDims, defaultCaseParts, evalDim, facesFromSections, fmt, newFace, parseDim, resolveDefaults, resolveFaces, typesIn,
  type BandEdge, type CabCatalog, type CabCategory, type CabType, type CasePart, type FaceSpec, type Grain, type MatSlot, type PanelSpec, type Resolved, type SectionInput,
} from '@/lib/engine';
import { presetKey, type ShopConfig } from '@/lib/shop';
import { FaceEditor } from '../Configurator';
import { Elevation, TypeThumb, sampleCabinet } from '../Elevation';
import type { Update } from './AdminApp';

const pill = 'rounded-full border border-rule bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink disabled:opacity-40 disabled:hover:border-rule';
const iconBtn = 'h-7 w-7 rounded-md border-none bg-transparent text-sm text-muted hover:bg-line-2 hover:text-ink disabled:opacity-30';
const lab = 'flex flex-col gap-1 text-[11px] font-bold tracking-[0.14em] text-muted uppercase';
const inp = 'field px-2.5 py-2 text-[14px] tracking-normal text-ink normal-case';

function Card({ title, sub, right, children }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-3.5 px-[18px] py-4 sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <div className="text-base font-bold">{title}</div>
        {sub && <div className="text-[13px] text-muted">{sub}</div>}
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
    </div>
  );
}

const newCode = (base: string, taken: string[]) => {
  let code = base;
  for (let n = 2; taken.includes(code); n++) code = `${base}${n}`;
  return code;
};

/**
 * A box's standard faces in the same configurator window a job uses. The faces are edited as a layout
 * (heights as text) on a 30"-wide preview of the box and written back as face specs; a typed height
 * that equals a rule is saved as that rule, and "auto" shelves stay auto.
 */
function BoxFaces({ type, d, catalog, onFaces }: { type: CabType; d: Resolved; catalog: CabCatalog; onFaces: (faces: FaceSpec[]) => void }) {
  const H = parseDim(type.h);
  const toLayout = (faces: FaceSpec[]): SectionInput[] => resolveFaces(faces, d, H).map(s => ({ ...s, h: typeof s.h === 'number' ? fmt(s.h) : s.h }));
  const [layout, setLayout] = useState(() => toLayout(type.faces));
  const [selSec, setSelSec] = useState(0);
  // Re-derive the layout when the faces change from elsewhere (restore defaults), not from our own writes.
  const pushed = useRef(type.faces);
  if (type.faces !== pushed.current) { pushed.current = type.faces; setLayout(toLayout(type.faces)); }
  const built = buildCabinet({ id: 0, type: type.code, w: '30', h: type.h, d: type.d, toe: type.toe, qty: '1', layout }, d, 0, undefined, catalog);
  const change = (next: SectionInput[]) => {
    setLayout(next);
    const faces = facesFromSections(next, d, { prev: type.faces, H });
    pushed.current = faces;
    onFaces(faces);
  };
  if (built.bad) return <div className="rounded-lg bg-canvas px-4 py-10 text-center text-[15px] text-muted">Give the box a height and depth to see the drawing.</div>;
  return (
    <FaceEditor built={built} layout={layout} d={d} f={fmt} selSec={selSec} onSelectSec={setSelSec} onLayout={change}
      toolbar={<span>Preview 30&quot; wide · a height equal to a rule follows that rule</span>} />
  );
}

/** Parts a finished interior cuts from the front material. */
const INTERIOR = new Set<string>(['leftEnd', 'rightEnd', 'deck', 'top', 'fixedShelf', 'adjShelf', 'partition']);
const STANDARD = new Set<string>(STANDARD_PARTS);

/**
 * A box's case parts, one row each: on/off, name, count, width, length, grain, material slot and banding. Sizes are
 * checked against the preview cabinet's dimensions; a size that can't be read is flagged and the part is not made.
 */
function CasePartsTable({ parts, dims, onChange }: { parts: CasePart[]; dims: Record<string, number> | null; onChange: (parts: CasePart[]) => void }) {
  const cell = 'field min-w-0 px-2 py-1.5 text-[13px] text-ink disabled:bg-canvas disabled:text-muted';
  const sizeBad = (p: CasePart, k: 'w' | 'l') => (p[k].trim() === 'auto' ? !AUTO_SIZED[p.key]?.[k] : !!dims && isNaN(evalDim(p[k], dims)));
  const set = (i: number, patch: Partial<CasePart>) => onChange(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= parts.length) return;
    const next = [...parts]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  const qtyBlur = (i: number, p: CasePart) => () => { if (!QTY_RE.test(p.qty.trim())) set(i, { qty: AUTO_QTY_PARTS.includes(p.key as never) ? 'auto' : '1' }); };
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[760px] items-center gap-x-1.5 gap-y-1" style={{ gridTemplateColumns: '22px minmax(120px,1.5fr) 62px minmax(96px,1fr) minmax(96px,1fr) 88px 86px 118px 50px 24px' }}>
        {['', 'Part', 'Qty', 'Width', 'Length', 'Grain', 'Material', 'Banding', '', ''].map((h, i) => <div key={i} className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">{h}</div>)}
        {parts.map((p, i) => {
          const auto = AUTO_SIZED[p.key] ?? {}, std = STANDARD.has(p.key), dim = p.on ? '' : 'opacity-50';
          return (
            <div key={p.key} className="contents">
              <input type="checkbox" checked={p.on} onChange={e => set(i, { on: e.target.checked })} className="h-4 w-4 accent-accent" aria-label={`Make ${p.name}`} />
              <input value={p.name} onChange={e => set(i, { name: e.target.value })} className={`${cell} ${dim} ${p.name.trim() ? '' : 'field-bad'}`} aria-label={`Part ${i + 1} name`} />
              <input value={p.qty} disabled={!!auto.qty} list="qty-options" onChange={e => set(i, { qty: e.target.value })} onBlur={qtyBlur(i, p)}
                className={`${cell} ${dim} text-center ${QTY_RE.test(p.qty.trim()) ? '' : 'field-bad'}`} aria-label={`${p.name} quantity`} title={auto.qty ? 'One per split drawer section' : ''} />
              <input value={p.w} disabled={!!auto.w} list="dim-tokens" onChange={e => set(i, { w: e.target.value })} className={`${cell} ${dim} ${sizeBad(p, 'w') ? 'field-bad' : ''}`} aria-label={`${p.name} width`} />
              <input value={p.l} disabled={!!auto.l} list="dim-tokens" onChange={e => set(i, { l: e.target.value })} className={`${cell} ${dim} ${sizeBad(p, 'l') ? 'field-bad' : ''}`} aria-label={`${p.name} length`}
                title={auto.l ? 'Sized by the engine' : ''} />
              <select value={p.grain} onChange={e => set(i, { grain: e.target.value as Grain })} className={`${cell} ${dim}`} aria-label={`${p.name} grain`}><option value="Vertical">Vertical</option><option value="Horizontal">Horizontal</option></select>
              <select value={p.mat} onChange={e => set(i, { mat: e.target.value as MatSlot })} className={`${cell} ${dim}`} aria-label={`${p.name} material`}>{MAT_SLOTS.map(([k, l]) => <option key={k} value={k}>{l.replace(' material', '')}</option>)}</select>
              <select value={p.band} onChange={e => set(i, { band: e.target.value as BandEdge })} className={`${cell} ${dim}`} aria-label={`${p.name} banding`}>{BAND_EDGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <div className="flex">
                <button onClick={() => move(i, -1)} disabled={i === 0} className={iconBtn} aria-label={`Move ${p.name} up`}>↑</button>
                <button onClick={() => move(i, 1)} disabled={i === parts.length - 1} className={iconBtn} aria-label={`Move ${p.name} down`}>↓</button>
              </div>
              {std ? <span /> : <button onClick={() => onChange(parts.filter((_, j) => j !== i))} className={`${iconBtn} hover:text-danger`} aria-label={`Remove ${p.name}`}>×</button>}
            </div>
          );
        })}
      </div>
      <datalist id="dim-tokens">{DIM_TOKENS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</datalist>
      <datalist id="qty-options">{['auto', 'auto+1', 'auto+2', '1', '2', '3', '4'].map(q => <option key={q} value={q} />)}</datalist>
    </div>
  );
}

/** The Cabinet boxes tab: categories, the box types in each, and a selected box's size, image and standard faces. */
export function BoxesEditor({ cfg, update, skuImages }: { cfg: ShopConfig; update: Update; skuImages: string[] }) {
  const { categories, types } = cfg.catalog;
  const [selCat, setSelCat] = useState(categories[0]?.key ?? '');
  const cat = categories.find(c => c.key === selCat) ?? categories[0];
  const inCat = typesIn(cfg.catalog, cat?.key);
  const [selCode, setSelCode] = useState(inCat[0]?.code ?? '');
  const type = inCat.find(t => t.code === selCode) ?? inCat[0];
  const [codeDraft, setCodeDraft] = useState<string | null>(null);
  const [codeErr, setCodeErr] = useState('');
  // Preview with the default method's rules.
  const d = useMemo(() => resolveDefaults(cfg.presets[0]?.values), [cfg.presets]);

  const setCatalog = (fn: (k: ShopConfig['catalog']) => ShopConfig['catalog']) => update(c => ({ ...c, catalog: fn(c.catalog) }));
  const patchCat = (fn: (c: CabCategory) => CabCategory) => setCatalog(k => ({ ...k, categories: k.categories.map(c => (c.key === cat.key ? fn(c) : c)) }));
  const patchType = (fn: (t: CabType) => CabType) => {
    const code = type?.code;
    if (code) setCatalog(k => ({ ...k, types: k.types.map(t => (t.code === code ? fn(t) : t)) }));
  };

  const pickCat = (key: string) => { setSelCat(key); setSelCode(typesIn(cfg.catalog, key)[0]?.code ?? ''); setCodeDraft(null); };
  const addCategory = () => {
    const key = presetKey('new-category', categories.map(c => c.key));
    setCatalog(k => ({ ...k, categories: [...k.categories, { key, label: 'New category', style: 'base' }] }));
    pickCat(key);
  };
  const removeCategory = () => {
    if (categories.length < 2 || inCat.length) return;
    if (!window.confirm(`Delete the ${cat.label} category?`)) return;
    const next = categories.filter(c => c.key !== cat.key);
    setCatalog(k => ({ ...k, categories: next })); pickCat(next[0].key);
  };
  const addType = (from?: CabType) => {
    const code = newCode(from ? from.code : 'NEW', types.map(t => t.code));
    const t: CabType = from
      ? { ...from, code, label: `${from.label} copy`, faces: from.faces.map(f => ({ ...f })) }
      : cat.style === 'panel'
        ? { code, cat: cat.key, label: 'New panel', img: '', h: '34 1/2', d: '0', toe: '0', faces: [], w: '3', panel: { ...DEFAULT_PANEL } }
        : { code, cat: cat.key, label: 'New box', img: '', h: cat.style === 'wall' ? '30' : cat.style === 'tall' ? '84' : '34 1/2', d: cat.style === 'wall' ? '12' : '24', toe: cat.style === 'wall' ? '0' : '4 1/2', faces: [newFace('door')] };
    setCatalog(k => ({ ...k, types: [...k.types, t] })); setSelCode(code); setCodeDraft(null);
  };
  const removeType = () => {
    if (!type || types.length < 2) return;
    if (!window.confirm(`Delete box ${type.code} (${type.label})? Cabinets already using it keep the code and show a warning.`)) return;
    const i = inCat.indexOf(type), rest = inCat.filter(t => t !== type);
    setCatalog(k => ({ ...k, types: k.types.filter(t => t.code !== type.code) }));
    setSelCode(rest[Math.min(i, rest.length - 1)]?.code ?? '');
  };
  const commitCode = () => {
    if (!type || codeDraft == null) return;
    const code = codeDraft.trim().toUpperCase();
    if (!code) { setCodeErr('A box needs a code.'); return; }
    if (code !== type.code && types.some(t => t.code === code)) { setCodeErr(`${code} is already used.`); return; }
    setCodeErr(''); setCodeDraft(null);
    if (code !== type.code) { patchType(t => ({ ...t, code })); setSelCode(code); }
  };
  const dimBlur = (k: 'h' | 'd' | 'toe') => () => patchType(t => {
    const n = parseDim(t[k]);
    return { ...t, [k]: isNaN(n) || n < 0 || (k !== 'toe' && n === 0) ? (k === 'toe' ? '0' : k === 'h' ? '30' : '24') : fmt(n) };
  });

  if (!cat) return <div className="text-sm text-muted">No categories yet. Restore the built-in defaults below.</div>;
  const isPanel = cat.style === 'panel';
  // The box's case parts: its own list once edited, else what the category style builds.
  const parts: CasePart[] = type?.case?.parts ?? (type && !isPanel ? defaultCaseParts(cat.style) : []);
  const setParts = (list: CasePart[]) => patchType(t => ({ ...t, case: { parts: list } }));
  const resetParts = () => patchType(t => { const rest = { ...t }; delete rest.case; return rest; });
  // What the case comes out as at the preview size, so the admin sees each part and anything that could not be sized.
  const preview = type && !isPanel ? sampleCabinet(type, d, cfg.catalog) : null;
  const previewDims = preview && !preview.bad ? caseDims(preview, d) : null;
  const matName = (m: MatSlot) => (m === 'back' ? d.backMat : m === 'front' ? d.frontMat : m === 'toe' ? d.toeMat : d.caseMat);
  const panelSpec: PanelSpec = type?.panel ?? DEFAULT_PANEL;
  const setPanel = (patch: Partial<PanelSpec>) => patchType(t => ({ ...t, panel: { ...(t.panel ?? DEFAULT_PANEL), ...patch } }));
  const tile = (on: boolean) => `flex flex-col gap-1 rounded-lg px-3 py-2.5 text-left text-ink hover:border-ink ${on ? 'border-2 border-accent bg-sel' : 'border border-line bg-white'}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[13px] text-muted">
        The cabinet types offered on the job's cabinet list, by category. A box has a code, a default size and a standard set of faces; a job can still change any of it per cabinet.
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Categories">
        {categories.map(c => (
          <button key={c.key} role="tab" aria-selected={c.key === cat.key} onClick={() => pickCat(c.key)}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-bold ${c.key === cat.key ? 'border-ink bg-ink text-white' : 'border-rule bg-white text-ink hover:border-ink'}`}>
            {c.label} <span className={`text-[11px] font-semibold ${c.key === cat.key ? 'text-white/70' : 'text-muted'}`}>{typesIn(cfg.catalog, c.key).length}</span>
          </button>
        ))}
        <button onClick={addCategory} className="rounded-full border border-dashed border-rule bg-transparent px-3 py-1.5 text-[13px] font-bold text-muted hover:border-ink hover:text-ink">+ Category</button>
      </div>

      <Card title="Category" right={<button onClick={removeCategory} disabled={categories.length < 2 || inCat.length > 0} title={inCat.length ? 'Move or delete its boxes first' : ''} className={`${pill} hover:text-danger`}>Delete category</button>}>
        <div className="grid gap-x-3.5 gap-y-2.5" style={{ gridTemplateColumns: 'minmax(160px,1fr) minmax(260px,2fr)' }}>
          <label className={lab}>Name
            <input value={cat.label} onChange={e => patchCat(c => ({ ...c, label: e.target.value }))} onBlur={() => { if (!cat.label.trim()) patchCat(c => ({ ...c, label: 'Category' })); }} className={`${inp} font-semibold`} />
          </label>
          <label className={lab}>Case construction
            <select value={cat.style} onChange={e => patchCat(c => ({ ...c, style: e.target.value as CabCategory['style'] }))} className={inp}>
              {BUILD_STYLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </div>
      </Card>

      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(132px,1fr))' }} role="radiogroup" aria-label={`${cat.label} boxes`}>
        {inCat.map(t => (
          <button key={t.code} role="radio" aria-checked={t.code === type?.code} onClick={() => { setSelCode(t.code); setCodeDraft(null); setCodeErr(''); }} className={`${tile(t.code === type?.code)} items-center`}>
            <TypeThumb type={t} d={d} catalog={cfg.catalog} className="block h-[72px] w-full object-contain" />
            <div className="text-center text-xs leading-[1.25] font-bold text-pretty">{t.label}</div>
            <div className="text-[11px] font-semibold text-muted">{t.code}</div>
          </button>
        ))}
        <button onClick={() => addType()} className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-rule bg-transparent text-[13px] font-bold text-muted hover:border-ink hover:text-ink">+ New box</button>
      </div>
      {!type && <div className="text-[13px] text-muted">No boxes in {cat.label} yet. Add one, or move a box here from its Category field.</div>}

      {type && (<>
      <Card title="Box" sub="Jobs refer to a box by its code" right={
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => addType(type)} className={pill}>Duplicate</button>
          <button onClick={removeType} disabled={types.length < 2} className={`${pill} hover:text-danger`}>Delete</button>
        </div>
      }>
        <div className="grid gap-x-3.5 gap-y-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))' }}>
          <label className={lab}>Code
            <input value={codeDraft ?? type.code} onChange={e => { setCodeDraft(e.target.value); setCodeErr(''); }} onBlur={commitCode} onKeyDown={e => { if (e.key === 'Enter') commitCode(); }}
              className={`${inp} font-semibold ${codeErr ? 'field-bad' : ''}`} aria-label="Box code" />
          </label>
          <label className={`${lab} col-span-2`}>Name
            <input value={type.label} onChange={e => patchType(t => ({ ...t, label: e.target.value }))} className={inp} aria-label="Box name" />
          </label>
          <label className={lab}>Category
            <select value={type.cat} onChange={e => { const c = e.target.value; patchType(t => ({ ...t, cat: c })); setSelCat(c); }} className={inp}>
              {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          <label className={lab}>{isPanel ? 'Width' : 'Width (optional)'}
            <input value={type.w ?? ''} placeholder={isPanel ? '' : 'keep the row width'} onChange={e => patchType(t => ({ ...t, w: e.target.value }))}
              onBlur={() => patchType(t => { const n = parseDim(t.w ?? ''); const next = { ...t }; if (isNaN(n) || n <= 0) { if (isPanel) next.w = '3'; else delete next.w; } else next.w = fmt(n); return next; })}
              className={`${inp} text-center`} aria-label="Default width" />
          </label>
          <label className={lab}>Height
            <input value={type.h} onChange={e => patchType(t => ({ ...t, h: e.target.value }))} onBlur={dimBlur('h')} className={`${inp} text-center`} aria-label="Default height" />
          </label>
          {!isPanel && (
            <label className={lab}>Depth
              <input value={type.d} onChange={e => patchType(t => ({ ...t, d: e.target.value }))} onBlur={dimBlur('d')} className={`${inp} text-center`} aria-label="Default depth" />
            </label>
          )}
          {!isPanel && (
            <label className={lab}>Toe
              <input value={type.toe} onChange={e => patchType(t => ({ ...t, toe: e.target.value }))} onBlur={dimBlur('toe')} className={`${inp} text-center`} aria-label="Default toe" />
            </label>
          )}
          <label className={`${lab} col-span-2`}>Picker image
            <select value={type.img} onChange={e => patchType(t => ({ ...t, img: e.target.value }))} className={inp}>
              <option value="">{isPanel ? 'Drawn as a panel' : 'Drawn from the faces'}</option>
              {type.img && !skuImages.includes(type.img) && <option value={type.img}>{type.img}</option>}
              {skuImages.map(src => <option key={src} value={src}>{src.replace(/^.*\//, '')}</option>)}
            </select>
          </label>
        </div>
        {codeErr && <div className="text-xs text-danger">{codeErr}</div>}
        <div className="text-xs text-muted">Renaming a code does not update cabinets already saved with the old code; they keep it and show a warning.</div>
      </Card>

      {isPanel ? (
        <Card title="Panel" sub="An accessory is one cut panel: no case, faces or hardware. Width and height are entered per row.">
          <div className="grid items-start gap-6" style={{ gridTemplateColumns: 'minmax(160px,1fr) minmax(260px,2fr)' }}>
            <Elevation cab={sampleCabinet(type, d, cfg.catalog)} className="block max-h-[240px] w-full" title={`Preview of ${type.code}`} />
            <div className="grid gap-x-3.5 gap-y-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
              <label className={lab}>Cut from
                <select value={panelSpec.mat} onChange={e => setPanel({ mat: e.target.value as PanelSpec['mat'] })} className={inp} aria-label="Panel material">
                  {MAT_SLOTS.map(([k, l]) => <option key={k} value={k}>{l.replace(' material', '')} material of the job</option>)}
                </select>
              </label>
              <label className={lab}>Grain
                <select value={panelSpec.grain} onChange={e => setPanel({ grain: e.target.value as Grain })} className={inp} aria-label="Panel grain">
                  <option value="Vertical">Vertical (along height)</option>
                  <option value="Horizontal">Horizontal (along width)</option>
                </select>
              </label>
              <label className={lab}>Edge banding
                <select value={panelSpec.band} onChange={e => setPanel({ band: e.target.value as PanelSpec['band'] })} className={inp} aria-label="Panel edge banding">
                  {PANEL_BANDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <div className="col-span-full text-xs text-muted">Fillers and end panels usually band the exposed long edge; toe kick skins run horizontal with no banding.</div>
            </div>
          </div>
        </Card>
      ) : (
        <>
        <Card title="Case parts" sub="Every part of this box's case: switch parts off, resize them, change their material or add your own"
          right={<button onClick={resetParts} disabled={!type.case} className={pill} title={type.case ? '' : 'Already the category default'}>Reset to category default</button>}>
          <CasePartsTable parts={parts} dims={previewDims} onChange={setParts} />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setParts(addCasePart(parts, SINK_SKIRT))} className={pill}>+ Sink skirt</button>
            <button onClick={() => setParts(addCasePart(parts, { key: 'rail', name: 'Rail', on: true, qty: '1', w: 'stretcherW', l: 'inW', grain: 'Vertical', mat: 'case', band: 'none' }))} className={pill}>+ Rail</button>
            <button onClick={() => setParts(addCasePart(parts, { key: 'divider', name: 'Divider', on: true, qty: '1', w: 'inD', l: 'boxH', grain: 'Vertical', mat: 'case', band: 'l' }))} className={pill}>+ Divider</button>
            <button onClick={() => setParts(addCasePart(parts, { key: 'part', name: 'Part', on: true, qty: '1', w: '4', l: 'inW', grain: 'Vertical', mat: 'case', band: 'none' }))} className={pill}>+ Other part</button>
            <span className="mx-1 h-5 border-l border-line-2" />
            <button onClick={() => setParts(parts.map(p => (INTERIOR.has(p.key) ? { ...p, mat: 'front' } : p)))} className={pill} title="Cut the ends, deck, top, shelves and partitions from the job's front material">Finished interior</button>
          </div>
          {preview && !preview.bad && (
            <div className="flex flex-col gap-1 rounded-lg bg-canvas px-3 py-2 text-xs text-ink-3">
              <div>
                <span className="font-bold text-ink">Case at {fmt(preview.W)}&quot; wide:</span>{' '}
                {preview.parts.length ? preview.parts.map(p => `${p.qty} × ${p.desc} ${fmt(p.w)} x ${fmt(p.l)}${p.mat === d.caseMat ? '' : ` (${p.mat})`}`).join(' · ') : 'no parts'}
              </div>
              {preview.skipped.map(m => <div key={m} className="text-danger">Not made · {m}</div>)}
            </div>
          )}
          <details className="text-xs text-muted">
            <summary className="cursor-pointer font-bold text-ink-3">Sizes: named dimensions and arithmetic</summary>
            <div className="mt-1.5 grid gap-x-4 gap-y-0.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
              {DIM_TOKENS.filter(([k]) => !/^face[B-P]$/.test(k)).map(([k, l]) => <div key={k}><code className="text-ink">{k}</code> {k === 'faceA' ? 'Height of face A (faceB, faceC… likewise)' : l}</div>)}
            </div>
            <div className="mt-1.5">Add or subtract with spaces around the sign: <code className="text-ink">faceA + 3/4</code>, <code className="text-ink">inW - 1/2</code>. Fractions as typed: 3/4, 1-1/2, 1 1/2. Quantity: a number, <code className="text-ink">auto</code> (what the layout needs) or <code className="text-ink">auto+1</code>.</div>
          </details>
        </Card>
        <Card title="Standard faces" sub="What a new cabinet of this box starts with · the same window as a job's Configure tab">
          <BoxFaces key={type.code} type={type} d={d} catalog={cfg.catalog} onFaces={faces => patchType(t => ({ ...t, faces }))} />
        </Card>
        </>
      )}
      </>)}
    </div>
  );
}
