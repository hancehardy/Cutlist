'use client';
import { useState } from 'react';
import { BAND_THKS, parseDim, type BandThk, type Banding, type FrontStyle, type Grain, type Material } from '@/lib/engine';
import { materialLabel, sameMaterial, sameStyle } from '@/lib/shop';

const OTHER = '__other__';

/** An edge banding product: its name as typed and flat or 1 mm. */
export function BandingField({ label, value, onChange }: { label: string; value: Banding; onChange: (b: Banding) => void }) {
  return (
    <div className="flex flex-col gap-[3px] text-xs text-muted">
      <label className="flex flex-col gap-[3px]">
        {label}
        <input value={value.name} placeholder="e.g. White PVC, Maple veneer" onChange={e => onChange({ ...value, name: e.target.value })} aria-label={label}
          className="field px-2 py-1.5 text-[13px] text-ink" />
      </label>
      <label className="flex items-center gap-2 text-[11px]">
        Thickness
        <select value={value.thk} onChange={e => onChange({ ...value, thk: e.target.value as BandThk })} aria-label={`${label} thickness`} className="field min-w-0 flex-1 px-1.5 py-1 text-[13px] text-ink">
          {BAND_THKS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
    </div>
  );
}

/** Dropdown of common choices; "Other…" reveals a text box. Values outside the list open as Other. */
export function ChoiceField({ label, value, options, onChange }: { label: string; value: string; options?: string[]; onChange: (v: string) => void }) {
  const listed = !!options?.includes(value);
  const [other, setOther] = useState(!listed);
  if (!options) {
    return (
      <label className="flex flex-col gap-[3px] text-xs text-muted">
        {label}
        <input value={value} onChange={e => onChange(e.target.value)} className="field px-2 py-1.5 text-[13px] text-ink" />
      </label>
    );
  }
  const showOther = other || !listed;
  return (
    <label className="flex flex-col gap-[3px] text-xs text-muted">
      {label}
      <select value={showOther ? OTHER : value} className="field px-1.5 py-1.5 text-[13px] text-ink"
        onChange={e => { if (e.target.value === OTHER) { setOther(true); } else { setOther(false); onChange(e.target.value); } }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
        <option value={OTHER}>Other…</option>
      </select>
      {showOther && (
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={`Type ${label.toLowerCase()}`} autoFocus={other && listed}
          className="field mt-1 px-2 py-1.5 text-[13px] text-ink" aria-label={`${label} (other)`} />
      )}
    </label>
  );
}

/** Pick a material from the shop list, or choose Other… to type a name with its own thickness and sheet size. */
export function MaterialField({ label, value, materials, onChange }: { label: string; value: Material; materials: Material[]; onChange: (m: Material) => void }) {
  const listed = materials.some(m => sameMaterial(m, value));
  const [other, setOther] = useState(!listed);
  const showOther = other || !listed;
  const bad = (v: string) => { const n = parseDim(v); return isNaN(n) || n <= 0; };
  const dimInput = (k: 'thk' | 'w' | 'l', lab: string) => (
    <label className="flex flex-col gap-[3px] text-[11px] text-muted">
      {lab}
      <input value={value[k]} onChange={e => onChange({ ...value, [k]: e.target.value })} aria-label={`${label} ${lab.toLowerCase()}`}
        className={`field min-w-0 px-2 py-1.5 text-center text-[13px] text-ink ${bad(value[k]) ? 'field-bad' : ''}`} />
    </label>
  );
  return (
    <div className="flex flex-col gap-[3px] text-xs text-muted">
      <label className="flex flex-col gap-[3px]">
        {label}
        <select value={showOther ? OTHER : value.name} className="field px-1.5 py-1.5 text-[13px] text-ink"
          onChange={e => {
            if (e.target.value === OTHER) { setOther(true); return; }
            const m = materials.find(x => x.name === e.target.value);
            if (m) { setOther(false); onChange({ ...m }); }
          }}>
          {materials.map(m => <option key={m.name} value={m.name}>{materialLabel(m)}</option>)}
          <option value={OTHER}>Other…</option>
        </select>
      </label>
      {showOther && (
        <div className="mt-1 grid gap-1.5" style={{ gridTemplateColumns: 'minmax(0,2.2fr) repeat(3,minmax(0,1fr))' }}>
          <label className="flex flex-col gap-[3px] text-[11px] text-muted">
            Name
            <input value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} placeholder="Material" autoFocus={other && listed}
              aria-label={`${label} (other)`} className={`field min-w-0 px-2 py-1.5 text-[13px] text-ink ${value.name.trim() ? '' : 'field-bad'}`} />
          </label>
          {dimInput('thk', 'Thick')}
          {dimInput('w', 'Width')}
          {dimInput('l', 'Length')}
        </div>
      )}
    </div>
  );
}

export function Segmented<T extends string>({ opts, value, onChange }: { opts: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-rule">
      {opts.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className={`border-none px-[9px] py-1.5 text-xs font-bold ${k === value ? 'bg-ink text-white' : 'bg-white text-ink-3'}`}>{label}</button>
      ))}
    </div>
  );
}

export function Stepper({ label, value, onDec, onInc }: { label: string; value: number | string; onDec: () => void; onInc: () => void }) {
  const b = 'h-7 w-7 rounded-lg border-none bg-transparent text-[15px] text-ink hover:bg-line-2';
  return (
    <div className="flex items-center gap-1.5">
      {label}
      <div className="flex items-center rounded-lg border border-line bg-white">
        <button onClick={onDec} className={b} aria-label={`Fewer ${label.toLowerCase()}`}>−</button>
        <div className="min-w-[18px] px-1 text-center text-[13px] font-extrabold text-ink">{value}</div>
        <button onClick={onInc} className={b} aria-label={`More ${label.toLowerCase()}`}>+</button>
      </div>
    </div>
  );
}

export const styleLabel = (s: FrontStyle, grain: boolean) =>
  `${s.name} · ${s.slab ? 'slab, cut in shop' : 'ordered'}${grain && s.grain === 'Horizontal' ? ' · horizontal grain' : ''}`;

/** Pick a door or drawer front style from the shop list, or choose Other… to type one with its own cut/ordered flag (and grain for drawer fronts). */
export function StyleField({ label, value, styles, grain, onChange }: { label: string; value: FrontStyle; styles: FrontStyle[]; grain?: boolean; onChange: (s: FrontStyle) => void }) {
  const listed = styles.some(s => sameStyle(s, value, !!grain));
  const [other, setOther] = useState(!listed);
  const showOther = other || !listed;
  return (
    <div className="flex flex-col gap-[3px] text-xs text-muted">
      <label className="flex flex-col gap-[3px]">
        {label}
        <select value={showOther ? OTHER : value.name} className="field px-1.5 py-1.5 text-[13px] text-ink"
          onChange={e => {
            if (e.target.value === OTHER) { setOther(true); return; }
            const s = styles.find(x => x.name === e.target.value);
            if (s) { setOther(false); onChange({ ...s }); }
          }}>
          {styles.map(s => <option key={s.name} value={s.name}>{styleLabel(s, !!grain)}</option>)}
          <option value={OTHER}>Other…</option>
        </select>
      </label>
      {showOther && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <input value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} placeholder="Style name" autoFocus={other && listed}
            aria-label={`${label} (other)`} className={`field min-w-0 flex-1 px-2 py-1.5 text-[13px] text-ink ${value.name.trim() ? '' : 'field-bad'}`} />
          <label className="flex items-center gap-1.5 text-[12px] text-ink-2">
            <input type="checkbox" checked={value.slab} onChange={e => onChange({ ...value, slab: e.target.checked })} /> Slab, cut in shop
          </label>
          {grain && (
            <label className="flex items-center gap-1.5 text-[12px] text-ink-2">
              Grain
              <select value={value.grain} onChange={e => onChange({ ...value, grain: e.target.value as Grain })} className="field px-1.5 py-1 text-[12px] text-ink" aria-label={`${label} grain`}>
                <option value="Vertical">Vertical</option>
                <option value="Horizontal">Horizontal</option>
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
