'use client';
import { DEFAULT_FIELDS, DEFAULT_TEXT, DEFAULTS, type DefaultKey, type Fmt, type RawDefaults } from '@/lib/engine';
import type { JobInfo } from '@/lib/job';

const jobLabel = 'flex flex-col gap-1 text-[11px] font-bold tracking-[0.14em] uppercase text-muted';
const jobInput = 'field text-[15px] tracking-normal normal-case text-ink px-2.5 py-2';

interface Props {
  job: JobInfo;
  defaults: RawDefaults;
  showDefaults: boolean;
  f: Fmt;
  onJob: (k: keyof JobInfo, v: string) => void;
  onDefault: (k: DefaultKey, v: string) => void;
  onToggleDefaults: () => void;
  onResetDefaults: () => void;
}

export function JobHeader({ job, defaults, showDefaults, f, onJob, onDefault, onToggleDefaults, onResetDefaults }: Props) {
  const jobField = (k: keyof JobInfo, label: string, bold = false) => (
    <label className={jobLabel}>
      {label}
      <input value={job[k]} onChange={e => onJob(k, e.target.value)} className={`${jobInput} ${bold ? 'font-semibold' : ''}`} />
    </label>
  );
  return (
    <div className="card flex flex-col gap-3.5 px-[18px] py-4">
      <div className="grid gap-x-3.5 gap-y-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        {jobField('name', 'Job', true)}
        {jobField('client', 'Client')}
        {jobField('catalog', 'Catalog')}
        {jobField('drawn', 'Drawn by')}
      </div>
      <div className="flex flex-col gap-2.5 border-t border-line-2 pt-3.5">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <div className="eyebrow">Construction &amp; materials</div>
          <div className="text-xs text-muted">Applies to every cabinet in this job</div>
        </div>
        <div className="grid gap-x-3.5 gap-y-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
          {DEFAULT_TEXT.map(([k, label]) => (
            <label key={k} className="flex flex-col gap-[3px] text-xs text-muted">
              {label}
              <input value={defaults[k] ?? String(DEFAULTS[k])} onChange={e => onDefault(k, e.target.value)} className="field px-2 py-1.5 text-[13px] text-ink" />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onToggleDefaults} className="border-none bg-transparent p-0 text-[13px] font-bold text-link hover:underline">
            {showDefaults ? 'Hide construction rules' : 'Show construction rules (reveals, gaps, deducts)'}
          </button>
          <button onClick={onResetDefaults} className="ml-auto border-none bg-transparent p-0 text-[13px] font-semibold text-muted hover:text-ink hover:underline">
            Reset to shop standard
          </button>
        </div>
        {showDefaults && (
          <div className="grid gap-x-3.5 gap-y-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
            {DEFAULT_FIELDS.map(([k, label]) => (
              <label key={k} className="flex items-center justify-between gap-2 text-[13px] text-ink-2">
                {label}
                <input value={defaults[k] ?? f(DEFAULTS[k] as number)} onChange={e => onDefault(k, e.target.value)} className="field w-16 px-2 py-1.5 text-center text-[13px]" />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
