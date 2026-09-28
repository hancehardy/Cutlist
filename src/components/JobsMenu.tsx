'use client';
import { useEffect, useRef, useState } from 'react';
import type { DimFormat } from '@/lib/engine';
import type { JobDoc, JobSummary } from '@/lib/job';
import type { SaveState } from './CutlistApp';

interface Props {
  jobId: string;
  doc: JobDoc;
  initialJobs: JobSummary[];
  saveState: SaveState;
  onOpen: (id: string) => void;
  onFormat: (f: DimFormat) => void;
}

const SAVE_TXT: Record<SaveState, [string, string]> = {
  saved: ['Saved', 'text-muted'],
  saving: ['Saving…', 'text-muted'],
  error: ['Not saved — retrying on next edit', 'text-danger'],
};
const action = 'rounded-full border border-rule bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink';

const slug = (s: string) => s.trim().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'job';

export function JobsMenu({ jobId, doc, initialJobs, saveState, onOpen, onFormat }: Props) {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState(initialJobs);
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/jobs').then(r => r.json()).then(setJobs).catch(() => {});
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const create = async (body: object) => {
    setError('');
    const res = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Could not create job.'); return; }
    setOpen(false);
    onOpen(data.id);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug(doc.job.name)}.cutlist.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = e.target.files?.[0];
    e.target.value = '';
    if (!fl) return;
    try { await create({ doc: JSON.parse(await fl.text()) }); }
    catch { setError(`${fl.name} is not a valid job file.`); }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${doc.job.name}"? This can't be undone. Export it first if you want a copy.`)) return;
    await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
    setOpen(false);
    window.location.href = '/';
  };

  const [saveTxt, saveCls] = SAVE_TXT[saveState];
  return (
    <div ref={box} className="relative flex items-center gap-2.5">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-[13px] font-bold text-ink hover:border-ink ${open ? 'border-accent' : 'border-rule'}`}>
        Jobs <span className="text-[10px] text-muted">▾</span>
      </button>
      <div className={`text-xs ${saveCls}`} aria-live="polite">{saveTxt}</div>
      {open && (
        <div className="card absolute top-full left-0 z-20 mt-2 flex w-[340px] max-w-[calc(100vw-40px)] flex-col gap-3 p-3.5 shadow-[0_1px_2px_rgba(11,11,12,0.08),0_8px_24px_rgba(11,11,12,0.12)]">
          <div className="eyebrow">Jobs</div>
          <div className="-mx-1 flex max-h-[260px] flex-col overflow-y-auto">
            {jobs.map(j => (
              <button key={j.id} onClick={() => { setOpen(false); if (j.id !== jobId) onOpen(j.id); }}
                className={`flex items-baseline gap-2 rounded-md border-none px-2 py-1.5 text-left hover:bg-canvas ${j.id === jobId ? 'bg-sel' : 'bg-transparent'}`}>
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{j.name || 'Untitled job'}</span>
                <span className="flex-none text-[11px] text-muted">{j.client}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => create({})} className={action}>New job</button>
            <button onClick={() => create({ sample: true })} className={action}>New from sample</button>
            <button onClick={() => file.current?.click()} className={action}>Import .json</button>
            <button onClick={exportJson} className={action}>Export .json</button>
          </div>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={importJson} />
          {error && <div className="rounded-lg bg-err-bg px-3 py-2 text-xs text-err">{error}</div>}
          <div className="flex items-center gap-2 border-t border-line-2 pt-3 text-xs text-muted">
            Dimensions
            <div className="flex overflow-hidden rounded-lg border border-rule">
              {(['fraction', 'decimal'] as DimFormat[]).map(m => (
                <button key={m} onClick={() => onFormat(m)} className={`border-none px-[9px] py-1 text-xs font-bold ${doc.dimFormat === m ? 'bg-ink text-white' : 'bg-white text-ink-3'}`}>
                  {m === 'fraction' ? '14 7/8' : '14.875'}
                </button>
              ))}
            </div>
            <button onClick={remove} className="ml-auto border-none bg-transparent p-0 text-xs font-semibold text-muted hover:text-danger hover:underline">Delete job</button>
          </div>
        </div>
      )}
    </div>
  );
}
