'use client';
import { useEffect, useRef, useState } from 'react';
import { SaveIndicator, type SaveState } from './useAutosave';

interface Props {
  saveState: SaveState;
  /** Start a blank job and open it. */
  onNew: () => void;
  /** Go to the job history page. */
  onJobs: () => void;
}

/** The Jobs button: a two-item menu, New job or Job history. */
export function JobsMenu({ saveState, onNew, onJobs }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const item = 'flex w-full items-center gap-2 rounded-md border-none bg-transparent px-2.5 py-2 text-left text-[13px] font-bold text-ink hover:bg-canvas';
  return (
    <div ref={box} className="relative flex items-center gap-2.5">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu"
        className={`flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-[13px] font-bold text-ink hover:border-ink ${open ? 'border-accent' : 'border-rule'}`}>
        Jobs <span className="text-[10px] text-muted">▾</span>
      </button>
      <SaveIndicator state={saveState} />
      {open && (
        <div role="menu" aria-label="Jobs" className="card absolute top-full left-0 z-20 mt-2 flex w-[200px] flex-col gap-0.5 p-1.5 shadow-[0_1px_2px_rgba(11,11,12,0.08),0_8px_24px_rgba(11,11,12,0.12)]">
          <button role="menuitem" onClick={() => { setOpen(false); onNew(); }} className={item}>New job</button>
          <button role="menuitem" onClick={() => { setOpen(false); onJobs(); }} className={item}>Job history</button>
        </div>
      )}
    </div>
  );
}
