'use client';
import { useEffect, useRef, useState } from 'react';

const action = 'rounded-full border border-rule bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink disabled:opacity-40 disabled:hover:border-rule';

/**
 * The Print button: print the report on screen, a checked set of reports, or the whole packet.
 * `reports` are the ones this user may see; the selection is remembered while the page is open.
 */
export function PrintMenu<K extends string>({ reports, current, onPrint }: { reports: [K, string][]; current: K | null; onPrint: (keys: K[]) => void }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<K[]>(() => reports.map(([k]) => k));
  const box = useRef<HTMLDivElement>(null);
  const label = (k: K) => reports.find(([x]) => x === k)?.[1] ?? k;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const go = (keys: K[]) => { setOpen(false); onPrint(keys); };
  const toggle = (k: K) => setSel(s => (s.includes(k) ? s.filter(x => x !== k) : reports.map(([x]) => x).filter(x => x === k || s.includes(x))));
  const chosen = reports.filter(([k]) => sel.includes(k));

  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="dialog"
        className="rounded-full border-none bg-accent px-4 py-[9px] text-sm font-bold text-white hover:bg-accent-dk">Print ▾</button>
      {open && (
        <div role="dialog" aria-label="Print reports" className="card absolute top-full right-0 z-20 mt-2 flex w-[300px] max-w-[calc(100vw-40px)] flex-col gap-3 p-3.5 shadow-[0_1px_2px_rgba(11,11,12,0.08),0_8px_24px_rgba(11,11,12,0.12)]">
          {current && (
            <button onClick={() => go([current])} className="rounded-lg border border-line bg-canvas px-3 py-2 text-left text-[13px] font-bold text-ink hover:border-ink">
              Print {label(current)} <span className="font-normal text-muted">· the report on screen</span>
            </button>
          )}
          <div className="flex items-baseline gap-2">
            <div className="eyebrow">Choose reports</div>
            <button onClick={() => setSel(reports.map(([k]) => k))} className="ml-auto border-none bg-transparent p-0 text-xs font-semibold text-link hover:underline">All</button>
            <button onClick={() => setSel([])} className="border-none bg-transparent p-0 text-xs font-semibold text-link hover:underline">None</button>
          </div>
          <div className="flex flex-col gap-1">
            {reports.map(([k, name]) => (
              <label key={k} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-ink hover:bg-canvas">
                <input type="checkbox" checked={sel.includes(k)} onChange={() => toggle(k)} /> {name}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-line-2 pt-3">
            <button onClick={() => go(chosen.map(([k]) => k))} disabled={!chosen.length}
              className="rounded-full border-none bg-accent px-4 py-[7px] text-[13px] font-bold text-white hover:bg-accent-dk disabled:opacity-50">
              Print selected ({chosen.length})
            </button>
            <button onClick={() => go(reports.map(([k]) => k))} className={action}>Whole packet</button>
          </div>
          <div className="text-[11px] text-muted">Each report prints on its own page.</div>
        </div>
      )}
    </div>
  );
}
