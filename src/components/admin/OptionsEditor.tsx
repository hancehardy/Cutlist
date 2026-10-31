'use client';
import { useState } from 'react';
import { SAW_FIELDS, parseDim, type DefaultKey } from '@/lib/engine';
import { OPTION_KEYS, optionLabel, type ShopConfig } from '@/lib/shop';
import type { Update } from './AdminApp';
import { MaterialsTable } from './MaterialsTable';

const iconBtn = 'h-7 w-7 flex-none rounded-md border-none bg-transparent text-sm text-muted hover:bg-line-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted';

/** One hardware field's dropdown choices: rename in place, reorder, remove, add. */
function OptionCard({ k, cfg, update }: { k: DefaultKey; cfg: ShopConfig; update: Update }) {
  const list = cfg.options[k] ?? [];
  const [draft, setDraft] = useState('');
  const [dup, setDup] = useState(false);

  const setList = (next: string[]) => update(c => ({ ...c, options: { ...c.options, [k]: next } }));
  const rename = (i: number, v: string) => { const next = [...list]; next[i] = v; setList(next); };
  const commit = (i: number) => {
    const v = list[i].trim();
    if (!v || list.some((o, j) => j !== i && o === v)) { setList(list.filter((_, j) => j !== i)); return; }
    if (v !== list[i]) rename(i, v);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  };
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    if (list.includes(v)) { setDup(true); return; }
    setList([...list, v]); setDraft(''); setDup(false);
  };

  return (
    <div className="card flex flex-col gap-2 px-[18px] py-4">
      <div className="flex items-baseline gap-2">
        <div className="text-sm font-bold">{optionLabel(k)}</div>
        <div className="ml-auto text-[11px] text-muted">{list.length ? `${list.length} choice${list.length === 1 ? '' : 's'}` : 'Free text'}</div>
      </div>
      {list.length === 0 && <div className="text-xs text-muted">No choices yet: job setup shows a plain text box for this field.</div>}
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {list.map((v, i) => (
          <li key={i} className="flex items-center gap-1">
            <input value={v} onChange={e => rename(i, e.target.value)} onBlur={() => commit(i)} aria-label={`${optionLabel(k)} choice ${i + 1}`}
              className="field min-w-0 flex-1 px-2 py-1.5 text-[13px] text-ink" />
            <button onClick={() => move(i, -1)} disabled={i === 0} className={iconBtn} aria-label="Move up">↑</button>
            <button onClick={() => move(i, 1)} disabled={i === list.length - 1} className={iconBtn} aria-label="Move down">↓</button>
            <button onClick={() => setList(list.filter((_, j) => j !== i))} className={`${iconBtn} hover:text-danger`} aria-label={`Remove ${v}`}>×</button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex items-center gap-1.5">
        <input value={draft} onChange={e => { setDraft(e.target.value); setDup(false); }} placeholder={`Add ${optionLabel(k).toLowerCase()}…`}
          className={`field min-w-0 flex-1 px-2 py-1.5 text-[13px] text-ink ${dup ? 'field-bad' : ''}`} />
        <button type="submit" disabled={!draft.trim()}
          className="rounded-full border border-rule bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink disabled:opacity-40 disabled:hover:border-rule">Add</button>
      </form>
      {dup && <div className="text-xs text-danger">Already in the list.</div>}
    </div>
  );
}

/** Panel saw settings shared by every job. */
function SawCard({ cfg, update }: { cfg: ShopConfig; update: Update }) {
  const bad = (v: string) => { const n = parseDim(v); return isNaN(n) || n < 0; };
  return (
    <div className="card flex flex-col gap-2 px-[18px] py-4">
      <div className="flex items-baseline gap-2">
        <div className="text-sm font-bold">Panel saw</div>
        <div className="text-[11px] text-muted">Inches · applies to every job's cutting plan</div>
      </div>
      <div className="grid gap-x-3.5 gap-y-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
        {SAW_FIELDS.map(([k, label]) => (
          <label key={k} className="flex items-center justify-between gap-2 text-[13px] text-ink-2">
            {label}
            <input value={cfg.saw[k as 'kerf' | 'edgeTrim']} onChange={e => update(c => ({ ...c, saw: { ...c.saw, [k]: e.target.value } }))} aria-label={label}
              className={`field w-[76px] px-1.5 py-1.5 text-center text-[13px] ${bad(cfg.saw[k as 'kerf' | 'edgeTrim']) ? 'field-bad' : ''}`} />
          </label>
        ))}
      </div>
    </div>
  );
}

/** The Materials & hardware tab: the materials table, the hardware dropdown lists and the saw settings. */
export function OptionsEditor({ cfg, update }: { cfg: ShopConfig; update: Update }) {
  return (
    <div className="flex flex-col gap-3">
      <MaterialsTable cfg={cfg} update={update} />
      <div className="mt-2 text-[13px] text-muted">
        Hardware choices offered under Hardware on job setup. A new job starts with the first choice; anything not listed can still be typed with Other…
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
        {OPTION_KEYS.map(k => <OptionCard key={k} k={k} cfg={cfg} update={update} />)}
      </div>
      <SawCard cfg={cfg} update={update} />
    </div>
  );
}
