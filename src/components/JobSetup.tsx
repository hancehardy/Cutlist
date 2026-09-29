'use client';
import { useState } from 'react';
import { DEFAULT_FIELDS, DEFAULT_TEXT, DEFAULTS, type DefaultKey, type Fmt, type RawDefaults } from '@/lib/engine';
import type { JobInfo } from '@/lib/job';
import { OPTIONS, PRESETS, isCustomized, presetFor } from '@/lib/presets';

const jobLabel = 'flex flex-col gap-1 text-[11px] font-bold tracking-[0.14em] uppercase text-muted';
const jobInput = 'field text-[15px] tracking-normal normal-case text-ink px-2.5 py-2';
const OTHER = '__other__';

interface Props {
  job: JobInfo;
  method: string;
  defaults: RawDefaults;
  f: Fmt;
  onJob: (k: keyof JobInfo, v: string) => void;
  onDefault: (k: DefaultKey, v: string) => void;
  /** Replace materials and rules with a preset's values. */
  onPreset: (key: string) => void;
  onContinue: () => void;
  /** Job has been set up before (reached via Edit setup). */
  existing: boolean;
}

function Section({ step, title, sub, children }: { step: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-3.5 px-[18px] py-4 sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <div className="flex h-6 w-6 flex-none items-center justify-center self-center rounded-md bg-ink text-xs font-extrabold text-white">{step}</div>
        <div className="text-base font-bold">{title}</div>
        {sub && <div className="text-[13px] text-muted">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

/** Dropdown of common choices; "Other…" reveals a text box. Values outside the list open as Other. */
function ChoiceField({ label, value, options, onChange }: { label: string; value: string; options?: string[]; onChange: (v: string) => void }) {
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

export function JobSetup({ job, method, defaults, f, onJob, onDefault, onPreset, onContinue, existing }: Props) {
  const [showRules, setShowRules] = useState(false);
  const [tried, setTried] = useState(false);
  // Bumped when a preset is applied so the dropdowns re-read their values.
  const [applied, setApplied] = useState(0);
  const custom = isCustomized(method, defaults);
  const nameMissing = !job.name.trim();
  const val = (k: DefaultKey) => defaults[k] ?? String(DEFAULTS[k]);

  const apply = (key: string) => { onPreset(key); setApplied(n => n + 1); };
  const pickPreset = (key: string) => {
    if (key === method) return;
    if (custom && !window.confirm(`Switch to ${presetFor(key).label}? Your changes to materials and rules will be replaced.`)) return;
    apply(key);
  };
  const resetPreset = () => {
    if (window.confirm(`Reset materials and rules to ${presetFor(method).label}?`)) apply(method);
  };
  const jobField = (k: keyof JobInfo, label: string, bold = false) => (
    <label className={jobLabel}>
      {label}
      <input value={job[k]} onChange={e => onJob(k, e.target.value)} autoFocus={k === 'name' && nameMissing}
        className={`${jobInput} ${bold ? 'font-semibold' : ''} ${k === 'name' && tried && nameMissing ? 'field-bad' : ''}`} />
    </label>
  );

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="eyebrow">{existing ? 'Edit job setup' : 'New job · step 1 of 2'}</div>
        <div className="text-2xl font-extrabold tracking-[-0.01em]">Job setup</div>
        <div className="text-sm text-ink-3">
          {existing ? 'Changes apply to every cabinet in this job and update the reports.' : 'Set the job up once. Construction and materials apply to every cabinet you enter next.'}
        </div>
      </div>

      <Section step={1} title="Job">
        <div className="grid gap-x-3.5 gap-y-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
          {jobField('name', 'Job', true)}
          {jobField('client', 'Client')}
          {jobField('catalog', 'Catalog')}
          {jobField('drawn', 'Drawn by')}
        </div>
        {tried && nameMissing && <div className="text-xs text-danger">Give the job a name to continue.</div>}
      </Section>

      <Section step={2} title="Construction method" sub="Frameless, full-overlay fronts">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }} role="radiogroup" aria-label="Construction method">
          {PRESETS.map(p => {
            const sel = p.key === method;
            return (
              <button key={p.key} role="radio" aria-checked={sel} onClick={() => pickPreset(p.key)}
                className={`flex flex-col gap-1 rounded-lg px-3 py-2.5 text-left text-ink hover:border-ink ${sel ? 'border-2 border-accent bg-sel' : 'border border-line bg-white'}`}>
                <div className="text-[13px] font-bold">{p.label}</div>
                <div className="text-xs leading-[1.35] text-muted">{p.blurb}</div>
                {sel && custom && <div className="mt-0.5 self-start rounded-full bg-white px-1.5 py-px text-[10px] font-bold tracking-[0.08em] text-link uppercase">Customized</div>}
              </button>
            );
          })}
        </div>
      </Section>

      <Section step={3} title="Materials & hardware" sub="Pick from the list or choose Other… to type your own">
        <div className="grid gap-x-3.5 gap-y-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
          {DEFAULT_TEXT.map(([k, label]) => (
            <ChoiceField key={`${k}-${applied}`} label={label} value={val(k)} options={OPTIONS[k]} onChange={v => onDefault(k, v)} />
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-line-2 pt-3">
          <button onClick={() => setShowRules(v => !v)} className="border-none bg-transparent p-0 text-[13px] font-bold text-link hover:underline">
            {showRules ? 'Hide construction rules' : 'Show construction rules (reveals, gaps, deducts)'}
          </button>
          <button onClick={resetPreset} disabled={!custom}
            className="ml-auto border-none bg-transparent p-0 text-[13px] font-semibold text-muted enabled:hover:text-ink enabled:hover:underline disabled:opacity-40">
            Reset to {presetFor(method).label}
          </button>
        </div>
        {showRules && (
          <div className="grid gap-x-3.5 gap-y-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
            {DEFAULT_FIELDS.map(([k, label]) => (
              <label key={k} className="flex items-center justify-between gap-2 text-[13px] text-ink-2">
                {label}
                <input value={defaults[k] ?? f(DEFAULTS[k] as number)} onChange={e => onDefault(k, e.target.value)} className="field w-[76px] px-1.5 py-1.5 text-center text-[13px]" />
              </label>
            ))}
          </div>
        )}
      </Section>

      <div className="flex items-center justify-end gap-3 pb-6">
        {!existing && <div className="text-xs text-muted">You can come back with Edit setup at any time.</div>}
        <button onClick={() => { setTried(true); if (!nameMissing) onContinue(); }}
          className="rounded-full border-none bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-dk">
          {existing ? 'Back to items →' : 'Continue to items →'}
        </button>
      </div>
    </div>
  );
}
