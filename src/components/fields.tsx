'use client';
import { useState } from 'react';
import { parseDim, type Material } from '@/lib/engine';
import { materialLabel, sameMaterial } from '@/lib/shop';

const OTHER = '__other__';

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
