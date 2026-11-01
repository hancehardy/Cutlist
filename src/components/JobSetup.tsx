'use client';
import { useState } from 'react';
import { BOX_FIELD, DEFAULTS, HARDWARE_FIELDS, MAT_SLOTS, RULE_GROUPS, type Banding, type DefaultKey, type DimFormat, type Fmt, type FrontStyle, type JobBanding, type JobFronts, type JobMaterials, type MatSlot, type Material, type RawDefaults } from '@/lib/engine';
import type { JobInfo } from '@/lib/job';
import { isCustomized, presetFor, type Preset } from '@/lib/presets';
import { optionsFor, type ShopOptions } from '@/lib/shop';
import { BandingField, ChoiceField, MaterialField, StyleField } from './fields';

const jobLabel = 'flex flex-col gap-1 text-[11px] font-bold tracking-[0.14em] uppercase text-muted';
const jobInput = 'field text-[15px] tracking-normal normal-case text-ink px-2.5 py-2';

interface Props {
  job: JobInfo;
  method: string;
  defaults: RawDefaults;
  materials: JobMaterials;
  banding: JobBanding;
  fronts: JobFronts;
  f: Fmt;
  dimFormat: DimFormat;
  onFormat: (f: DimFormat) => void;
  /** Download this job as a .cutlist.json file. */
  onExport: () => void;
  /** The shop's construction methods, materials table and hardware choices, from the Admin page. */
  presets: Preset[];
  shopMaterials: Material[];
  doorStyles: FrontStyle[];
  drawerFrontStyles: FrontStyle[];
  options: ShopOptions;
  onJob: (k: keyof JobInfo, v: string) => void;
  onDefault: (k: DefaultKey, v: string) => void;
  onMaterial: (slot: MatSlot, m: Material) => void;
  onBanding: (slot: keyof JobBanding, b: Banding) => void;
  onFront: (slot: keyof JobFronts, s: FrontStyle) => void;
  /** Switch method: replaces the construction rules, leaving materials and hardware alone. */
  onPreset: (key: string) => void;
  /** Put the construction rules back to the method's values. */
  onResetRules: () => void;
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

export function JobSetup({ job, method, defaults, materials, banding, fronts, f, dimFormat, onFormat, onExport, presets, shopMaterials, doorStyles, drawerFrontStyles, options, onJob, onDefault, onMaterial, onBanding, onFront, onPreset, onResetRules, onContinue, existing }: Props) {
  const [tried, setTried] = useState(false);
  const custom = isCustomized(method, defaults, presets);
  const nameMissing = !job.name.trim();
  const val = (k: DefaultKey) => defaults[k] ?? String(DEFAULTS[k]);
  const label = presetFor(method, presets).label;

  const pickPreset = (key: string) => {
    if (key === method) return;
    if (custom && !window.confirm(`Switch to ${presetFor(key, presets).label}? Your changes to the construction rules will be replaced.`)) return;
    onPreset(key);
  };
  const resetRules = () => {
    if (!window.confirm(`Reset the construction rules to ${label}? Materials and hardware are not changed.`)) return;
    onResetRules();
  };
  const jobField = (k: keyof JobInfo, lab: string, bold = false) => (
    <label className={jobLabel}>
      {lab}
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
          {existing ? 'Changes apply to every cabinet in this job and update the reports.' : 'Set the job up once. Construction, materials and hardware apply to every cabinet you enter next.'}
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
        <div className="flex flex-wrap items-center gap-3 border-t border-line-2 pt-3 text-xs text-muted">
          Dimensions
          <div className="flex overflow-hidden rounded-lg border border-rule">
            {(['fraction', 'decimal'] as DimFormat[]).map(m => (
              <button key={m} onClick={() => onFormat(m)} className={`border-none px-[9px] py-1 text-xs font-bold ${dimFormat === m ? 'bg-ink text-white' : 'bg-white text-ink-3'}`}>
                {m === 'fraction' ? '14 7/8' : '14.875'}
              </button>
            ))}
          </div>
          <button onClick={onExport} className="ml-auto border-none bg-transparent p-0 text-xs font-semibold text-link hover:underline">Export this job as .json</button>
        </div>
      </Section>

      <Section step={2} title="Construction method" sub="Reveals, gaps and deducts · thickness comes from the materials below">
        <div className="text-xs font-semibold text-muted">Start from a method</div>
        <div className="-mt-2 grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }} role="radiogroup" aria-label="Construction method">
          {presets.map(p => {
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
        <div className="flex items-center gap-3 border-t border-line-2 pt-3">
          <div className="text-xs font-semibold text-muted">Construction rules (inches)</div>
          <button onClick={resetRules} disabled={!custom}
            className="ml-auto border-none bg-transparent p-0 text-[13px] font-semibold text-muted enabled:hover:text-ink enabled:hover:underline disabled:opacity-40">
            Reset rules to {label}
          </button>
        </div>
        {RULE_GROUPS.map(g => (
          <div key={g.label} className="flex flex-col gap-2 rounded-lg bg-canvas px-3.5 py-3">
            <div className="eyebrow text-[10px]">{g.label}</div>
            <div className="grid gap-x-5 gap-y-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
              {g.fields.map(([k, lab]) => (
                <label key={k} className="flex items-center justify-between gap-2 text-[13px] text-ink-2">
                  {lab}
                  <input value={defaults[k] ?? f(DEFAULTS[k] as number)} onChange={e => onDefault(k, e.target.value)} className="field w-[76px] bg-white px-1.5 py-1.5 text-center text-[13px]" />
                </label>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section step={3} title="Materials" sub="Thickness and sheet size come with each material. Choose Other… to type your own.">
        <div className="grid gap-x-3.5 gap-y-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
          {MAT_SLOTS.map(([slot, lab]) => (
            <MaterialField key={slot} label={lab} value={materials[slot]} materials={shopMaterials} onChange={m => onMaterial(slot, m)} />
          ))}
        </div>
        <div className="text-[11px] text-muted">A job has one case finish and one front finish. Cabinets that need a different finish go on a separate job.</div>
        <div className="mt-1 grid gap-x-3.5 gap-y-2.5 border-t border-line-2 pt-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
          <BandingField label="Case edge banding" value={banding.case} onChange={b => onBanding('case', b)} />
          <BandingField label="Front edge banding" value={banding.front} onChange={b => onBanding('front', b)} />
          <div className="col-span-full text-[11px] text-muted">Lineal feet are estimated separately for case parts and for doors and drawer fronts on the Sheets report.</div>
        </div>
      </Section>

      <Section step={4} title="Fronts" sub="Slab styles are cut and optimized here; any other style is only listed on the door list">
        <div className="grid gap-x-3.5 gap-y-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
          <StyleField label="Door front style" value={fronts.door} styles={doorStyles} onChange={s => onFront('door', s)} />
          <StyleField label="Drawer front style" value={fronts.drawer} styles={drawerFrontStyles} grain onChange={s => onFront('drawer', s)} />
          <ChoiceField label={BOX_FIELD[1]} value={val(BOX_FIELD[0])} options={optionsFor(options, BOX_FIELD[0])} onChange={v => onDefault(BOX_FIELD[0], v)} />
        </div>
      </Section>

      <Section step={5} title="Hardware" sub="Pick from the list or choose Other… to type your own">
        <div className="grid gap-x-3.5 gap-y-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
          {HARDWARE_FIELDS.map(([k, lab]) => (
            <ChoiceField key={k} label={lab} value={val(k)} options={optionsFor(options, k)} onChange={v => onDefault(k, v)} />
          ))}
        </div>
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
