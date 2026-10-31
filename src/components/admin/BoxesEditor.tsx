'use client';
import { useMemo, useState } from 'react';
import {
  BUILD_STYLES, FACE_H_RULES, fmt, newFace, parseDim, resolveDefaults, typesIn,
  type CabCategory, type CabType, type FaceSpec, type Hinge, type Kind,
} from '@/lib/engine';
import { presetKey, type ShopConfig } from '@/lib/shop';
import { Elevation, TypeThumb, sampleCabinet } from '../Elevation';
import { Segmented, Stepper } from '../fields';
import type { Update } from './AdminApp';

const KINDS: [Kind, string][] = [['drawer', 'Drawer'], ['door', 'Door'], ['false', 'False'], ['open', 'Open']];
const LETTERS = 'ABCDEFGHIJKLMNOP';
const pill = 'rounded-full border border-rule bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink disabled:opacity-40 disabled:hover:border-rule';
const iconBtn = 'h-7 w-7 rounded-md border-none bg-transparent text-sm text-muted hover:bg-line-2 hover:text-ink disabled:opacity-30';
const lab = 'flex flex-col gap-1 text-[11px] font-bold tracking-[0.14em] text-muted uppercase';
const inp = 'field px-2.5 py-2 text-[14px] tracking-normal text-ink normal-case';
const FIXED = '__fixed__';

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
  const sample = type ? sampleCabinet(type, d, cfg.catalog) : null;

  const setCatalog = (fn: (k: ShopConfig['catalog']) => ShopConfig['catalog']) => update(c => ({ ...c, catalog: fn(c.catalog) }));
  const patchCat = (fn: (c: CabCategory) => CabCategory) => setCatalog(k => ({ ...k, categories: k.categories.map(c => (c.key === cat.key ? fn(c) : c)) }));
  const patchType = (fn: (t: CabType) => CabType) => {
    const code = type?.code;
    if (code) setCatalog(k => ({ ...k, types: k.types.map(t => (t.code === code ? fn(t) : t)) }));
  };
  const patchFace = (i: number, fn: (f: FaceSpec) => FaceSpec) => patchType(t => ({ ...t, faces: t.faces.map((f, j) => (j === i ? fn(f) : f)) }));
  const setFaces = (fn: (faces: FaceSpec[]) => FaceSpec[]) => patchType(t => ({ ...t, faces: fn(t.faces.map(f => ({ ...f }))) }));

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
  const hMode = (f: FaceSpec) => (f.h === '' ? '' : FACE_H_RULES.some(([k]) => k === f.h) ? f.h : FIXED);

  if (!cat) return <div className="text-sm text-muted">No categories yet. Restore the built-in defaults below.</div>;
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
          <label className={lab}>Height
            <input value={type.h} onChange={e => patchType(t => ({ ...t, h: e.target.value }))} onBlur={dimBlur('h')} className={`${inp} text-center`} aria-label="Default height" />
          </label>
          <label className={lab}>Depth
            <input value={type.d} onChange={e => patchType(t => ({ ...t, d: e.target.value }))} onBlur={dimBlur('d')} className={`${inp} text-center`} aria-label="Default depth" />
          </label>
          <label className={lab}>Toe
            <input value={type.toe} onChange={e => patchType(t => ({ ...t, toe: e.target.value }))} onBlur={dimBlur('toe')} className={`${inp} text-center`} aria-label="Default toe" />
          </label>
          <label className={`${lab} col-span-2`}>Picker image
            <select value={type.img} onChange={e => patchType(t => ({ ...t, img: e.target.value }))} className={inp}>
              <option value="">Drawn from the faces</option>
              {type.img && !skuImages.includes(type.img) && <option value={type.img}>{type.img}</option>}
              {skuImages.map(src => <option key={src} value={src}>{src.replace(/^.*\//, '')}</option>)}
            </select>
          </label>
        </div>
        {codeErr && <div className="text-xs text-danger">{codeErr}</div>}
        <div className="text-xs text-muted">Renaming a code does not update cabinets already saved with the old code; they keep it and show a warning.</div>
      </Card>

      <Card title="Standard faces" sub="Top to bottom · what a new cabinet of this box starts with">
        <div className="grid items-start gap-6" style={{ gridTemplateColumns: 'minmax(200px,1fr) minmax(300px,2fr)' }}>
          <div className="flex flex-col gap-2">
            {sample && <Elevation cab={sample} className="block max-h-[320px] w-full" title={`Preview of ${type.code}`} />}
            <div className="text-xs text-muted">Preview at 30&quot; wide, {type.h}&quot; high with the {cfg.presets[0]?.label ?? 'default'} rules.</div>
            {sample?.warn && <div className="rounded-lg bg-err-bg px-3 py-2 text-xs text-err">{sample.warn}</div>}
          </div>
          <div className="flex flex-col gap-2.5">
            {type.faces.map((fc, i) => {
              const sec = sample?.sections[i];
              const store = fc.kind === 'door' || fc.kind === 'open';
              const mode = hMode(fc);
              return (
                <div key={i} className="flex flex-col gap-2 rounded-lg border border-line bg-white px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-md bg-ink text-xs font-extrabold text-white">{LETTERS[i] ?? i + 1}</div>
                    <Segmented opts={KINDS} value={fc.kind} onChange={k => patchFace(i, f => {
                      const keep = k === 'door' || k === 'open';
                      return { ...f, kind: k, split: k === 'door' ? 0 : 1, shelves: keep ? f.shelves : 0, rollouts: keep ? f.rollouts : 0 };
                    })} />
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      H
                      <select value={mode} aria-label={`Face ${LETTERS[i]} height`} className="field px-1.5 py-1.5 text-[12px] text-ink"
                        onChange={e => { const v = e.target.value; patchFace(i, f => ({ ...f, h: v === FIXED ? fmt(sec?.h || 6) : v })); }}>
                        <option value="">Auto (shares the rest)</option>
                        {FACE_H_RULES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        <option value={FIXED}>Fixed…</option>
                      </select>
                      {mode === FIXED && (
                        <input value={fc.h} aria-label={`Face ${LETTERS[i]} fixed height`} onChange={e => patchFace(i, f => ({ ...f, h: e.target.value }))}
                          onBlur={() => patchFace(i, f => { const n = parseDim(f.h); return { ...f, h: isNaN(n) || n <= 0 ? '' : fmt(n) }; })}
                          className="field w-[72px] px-2 py-1.5 text-center text-[12px] text-ink" />
                      )}
                    </label>
                    <div className="ml-auto flex gap-0.5">
                      <button className={iconBtn} disabled={i === 0} aria-label="Move up" onClick={() => setFaces(L => { [L[i - 1], L[i]] = [L[i], L[i - 1]]; return L; })}>↑</button>
                      <button className={iconBtn} disabled={i === type.faces.length - 1} aria-label="Move down" onClick={() => setFaces(L => { [L[i + 1], L[i]] = [L[i], L[i + 1]]; return L; })}>↓</button>
                      <button className={`${iconBtn} text-[17px] text-faint hover:text-danger`} disabled={type.faces.length < 2} aria-label="Remove face" onClick={() => setFaces(L => L.filter((_, j) => j !== i))}>×</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-3">
                    {fc.kind === 'door' && (
                      <Stepper label="Doors" value={fc.split || 'Auto'} onDec={() => patchFace(i, f => ({ ...f, split: Math.max(0, f.split - 1) }))} onInc={() => patchFace(i, f => ({ ...f, split: Math.min(4, f.split + 1) }))} />
                    )}
                    {fc.kind === 'drawer' && (
                      <Stepper label="Drawers across" value={fc.split} onDec={() => patchFace(i, f => ({ ...f, split: Math.max(1, f.split - 1) }))} onInc={() => patchFace(i, f => ({ ...f, split: Math.min(4, f.split + 1) }))} />
                    )}
                    {store && (
                      <>
                        <label className="flex items-center gap-1.5">
                          Shelves
                          <select value={fc.shelves === 'auto' ? 'auto' : String(fc.shelves)} aria-label={`Face ${LETTERS[i]} shelves`} className="field px-1.5 py-1 text-[12px] text-ink"
                            onChange={e => { const v = e.target.value; patchFace(i, f => ({ ...f, shelves: v === 'auto' ? 'auto' : +v })); }}>
                            <option value="auto">Auto (1 under 30&quot;, 2 from 30&quot;)</option>
                            {Array.from({ length: 9 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </label>
                        <Stepper label="Roll-outs" value={fc.rollouts} onDec={() => patchFace(i, f => ({ ...f, rollouts: Math.max(0, f.rollouts - 1) }))} onInc={() => patchFace(i, f => ({ ...f, rollouts: Math.min(5, f.rollouts + 1) }))} />
                      </>
                    )}
                    {fc.kind === 'door' && fc.split <= 1 && (
                      <div className="flex items-center gap-1.5">
                        Hinge
                        <Segmented<Hinge> opts={[['L', 'Left'], ['R', 'Right']]} value={fc.hinge} onChange={hg => patchFace(i, f => ({ ...f, hinge: hg }))} />
                      </div>
                    )}
                    {sec && <div className="ml-auto font-bold text-ink tabular-nums">{sec.kind === 'open' ? `Opening ${fmt(sec.h)} high` : `${sec.n > 1 ? sec.n + ' × ' : ''}${fmt(sec.pw)} x ${fmt(sec.h)}`}</div>}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-bold text-muted">Add at the bottom</div>
              <button onClick={() => setFaces(L => [...L, newFace('drawer', 'smallFront')])} className={pill}>+ Drawer</button>
              <button onClick={() => setFaces(L => [...L, newFace('door')])} className={pill}>+ Door</button>
              <button onClick={() => setFaces(L => [...L, newFace('false', 'smallFront')])} className={pill}>+ False front</button>
              <button onClick={() => setFaces(L => [...L, newFace('open')])} className={pill}>+ Open</button>
            </div>
          </div>
        </div>
      </Card>
      </>)}
    </div>
  );
}
