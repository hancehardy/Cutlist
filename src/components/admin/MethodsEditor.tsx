'use client';
import { useEffect, useRef, useState } from 'react';
import { DEFAULTS, RULE_FIELDS, fmt, parseDim, type DefaultKey, type RawDefaults } from '@/lib/engine';
import type { Preset } from '@/lib/presets';
import type { ShopConfig } from '@/lib/shop';
import type { Update } from './AdminApp';

const pill = 'rounded-full border border-rule bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink disabled:opacity-40 disabled:hover:border-rule';
const newKey = () => `method-${Date.now().toString(36)}`;
const ruleDefault = (k: DefaultKey) => DEFAULTS[k] as number;
/** A rule the method sets to something other than the app default. */
const overrides = (values: RawDefaults, k: DefaultKey) => k in values && parseDim(values[k]) !== ruleDefault(k);

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

export function MethodsEditor({ cfg, update }: { cfg: ShopConfig; update: Update }) {
  const presets = cfg.presets;
  const [selKey, setSelKey] = useState(presets[0]?.key ?? '');
  const sel = presets.find(p => p.key === selKey) ?? presets[0];
  const idx = presets.indexOf(sel);
  const labelRef = useRef<HTMLInputElement>(null);
  const [focusNew, setFocusNew] = useState(false);
  useEffect(() => { if (focusNew) { labelRef.current?.select(); setFocusNew(false); } }, [focusNew, sel.key]);

  const setPresets = (fn: (ps: Preset[]) => Preset[]) => update(c => ({ ...c, presets: fn(c.presets) }));
  const patch = (fn: (p: Preset) => Preset) => setPresets(ps => ps.map(p => (p.key === sel.key ? fn(p) : p)));
  const setValue = (k: DefaultKey, v: string | null) => patch(p => {
    const values = { ...p.values };
    if (v == null) delete values[k]; else values[k] = v;
    return { ...p, values };
  });

  const add = () => {
    const p: Preset = { key: newKey(), label: 'New method', blurb: '', values: {} };
    setPresets(ps => [...ps, p]); setSelKey(p.key); setFocusNew(true);
  };
  const duplicate = () => {
    const p: Preset = { ...sel, key: newKey(), label: `${sel.label} copy`, values: { ...sel.values } };
    setPresets(ps => [...ps.slice(0, idx + 1), p, ...ps.slice(idx + 1)]); setSelKey(p.key); setFocusNew(true);
  };
  const remove = () => {
    if (presets.length < 2) return;
    if (!window.confirm(`Delete "${sel.label}"? Jobs on this method fall back to the default method next time they open.`)) return;
    const next = presets.filter(p => p.key !== sel.key);
    setPresets(() => next); setSelKey(next[Math.min(idx, next.length - 1)].key);
  };
  const makeDefault = () => setPresets(ps => [sel, ...ps.filter(p => p.key !== sel.key)]);

  // Rules: text is kept as typed (so 0.71 stays 0.71, not 11/16); on blur it is dropped when blank,
  // invalid or equal to the app default.
  const commitRule = (k: DefaultKey) => {
    const raw = (sel.values[k] ?? '').trim(), v = parseDim(raw);
    setValue(k, isNaN(v) || v === ruleDefault(k) ? null : raw);
  };
  const rulesCustom = RULE_FIELDS.some(([k]) => overrides(sel.values, k));
  const resetRules = () => {
    if (!window.confirm(`Reset the construction rules of ${sel.label} to the app defaults?`)) return;
    patch(p => { const values = { ...p.values }; for (const [k] of RULE_FIELDS) delete values[k]; return { ...p, values }; });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[13px] text-muted">
        A method is a named set of construction rules: reveals, gaps, deducts and box sizes. Picking one on job setup copies its rules into the job; the first method is the default for new jobs. Materials, hardware and the saw are set separately.
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }} role="radiogroup" aria-label="Construction methods">
        {presets.map((p, i) => {
          const on = p.key === sel.key;
          return (
            <button key={p.key} role="radio" aria-checked={on} onClick={() => setSelKey(p.key)}
              className={`flex flex-col gap-1 rounded-lg px-3 py-2.5 text-left text-ink hover:border-ink ${on ? 'border-2 border-accent bg-sel' : 'border border-line bg-white'}`}>
              <div className="text-[13px] font-bold">{p.label}</div>
              <div className="text-xs leading-[1.35] text-muted">{p.blurb || ' '}</div>
              {i === 0 && <div className="mt-0.5 self-start rounded-full bg-white px-1.5 py-px text-[10px] font-bold tracking-[0.08em] text-link uppercase">Default</div>}
            </button>
          );
        })}
        <button onClick={add} className="flex min-h-[72px] items-center justify-center rounded-lg border border-dashed border-rule bg-transparent text-[13px] font-bold text-muted hover:border-ink hover:text-ink">
          + New method
        </button>
      </div>

      <Card title="Method" right={
        <div className="flex flex-wrap gap-1.5">
          <button onClick={makeDefault} disabled={idx === 0} className={pill}>{idx === 0 ? 'Default for new jobs' : 'Make default'}</button>
          <button onClick={duplicate} className={pill}>Duplicate</button>
          <button onClick={remove} disabled={presets.length < 2} className={`${pill} hover:text-danger`}>Delete</button>
        </div>
      }>
        <div className="grid gap-x-3.5 gap-y-2.5" style={{ gridTemplateColumns: 'minmax(160px,1fr) minmax(220px,2fr)' }}>
          <label className="flex flex-col gap-1 text-[11px] font-bold tracking-[0.14em] text-muted uppercase">
            Name
            <input ref={labelRef} value={sel.label} onChange={e => patch(p => ({ ...p, label: e.target.value }))}
              onBlur={() => { if (!sel.label.trim()) patch(p => ({ ...p, label: 'Untitled method' })); }}
              className="field px-2.5 py-2 text-[15px] font-semibold tracking-normal text-ink normal-case" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold tracking-[0.14em] text-muted uppercase">
            Description
            <input value={sel.blurb} onChange={e => patch(p => ({ ...p, blurb: e.target.value }))} placeholder="One line shown under the name on job setup"
              className="field px-2.5 py-2 text-[15px] tracking-normal text-ink normal-case" />
          </label>
        </div>
      </Card>

      <Card title="Construction rules" sub="Inches · changed rules are highlighted" right={
        <button onClick={resetRules} disabled={!rulesCustom}
          className="border-none bg-transparent p-0 text-[13px] font-semibold text-muted enabled:hover:text-ink enabled:hover:underline disabled:opacity-40">
          Reset rules to app defaults
        </button>
      }>
        <div className="grid gap-x-3.5 gap-y-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
          {RULE_FIELDS.map(([k, label]) => {
            const changed = overrides(sel.values, k);
            return (
              <label key={k} className={`flex items-center justify-between gap-2 text-[13px] ${changed ? 'font-bold text-ink' : 'text-ink-2'}`}>
                {label}
                <input value={sel.values[k] ?? fmt(ruleDefault(k))} onChange={e => setValue(k, e.target.value)} onBlur={() => commitRule(k)}
                  title={`App default ${fmt(ruleDefault(k))}`}
                  className={`field w-[76px] px-1.5 py-1.5 text-center text-[13px] ${changed ? 'border-accent' : ''}`} />
              </label>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
