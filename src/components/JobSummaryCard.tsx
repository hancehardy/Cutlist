'use client';
import type { RawDefaults, Resolved } from '@/lib/engine';
import type { JobInfo } from '@/lib/job';
import { isCustomized, presetFor } from '@/lib/presets';

interface Props { job: JobInfo; method: string; defaults: RawDefaults; d: Resolved; onEdit: () => void }

/** Compact job + construction card at the top of the item entry page. */
export function JobSummaryCard({ job, method, defaults, d, onEdit }: Props) {
  const meta = [job.client, job.catalog, job.drawn && `Drawn by ${job.drawn}`].filter(Boolean).join(' · ');
  const custom = isCustomized(method, defaults);
  return (
    <div className="card flex flex-col gap-2 px-[18px] py-3.5">
      <div className="flex items-baseline gap-2.5">
        <div className="min-w-0 truncate text-base font-bold">{job.name || 'Untitled job'}</div>
        {meta && <div className="min-w-0 truncate text-[13px] text-muted">{meta}</div>}
        <button onClick={onEdit} className="ml-auto flex-none border-none bg-transparent p-0 text-[13px] font-bold text-link hover:underline">Edit setup</button>
      </div>
      <div className="flex flex-col gap-0.5 text-xs leading-[1.5] text-ink-3">
        <div>
          <span className="eyebrow mr-2 text-[10px]">{presetFor(method).label}{custom ? ' · customized' : ''}</span>
        </div>
        <div>Case {d.caseMat} · Back {d.backMat} · Fronts {d.frontMat} · {d.doorStyle}</div>
        <div>{d.drawerStyle} · {d.glideSeries} glides · {d.pull} · {d.hinge}</div>
      </div>
    </div>
  );
}
