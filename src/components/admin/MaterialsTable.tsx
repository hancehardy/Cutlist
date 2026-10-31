'use client';
import { useEffect, useState } from 'react';
import { parseDim, type Material } from '@/lib/engine';
import type { ShopConfig } from '@/lib/shop';
import type { Update } from './AdminApp';

const iconBtn = 'h-7 w-7 flex-none rounded-md border-none bg-transparent text-sm text-muted hover:bg-line-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted';
const cell = 'field min-w-0 px-2 py-1.5 text-[13px] text-ink';
const COLS = 'minmax(160px,2.4fr) repeat(3,minmax(64px,1fr)) 92px';
const BLANK: Material = { name: '', thk: '3/4', w: '49', l: '97' };

const badDim = (v: string) => { const n = parseDim(v); return isNaN(n) || n <= 0; };
const badName = (rows: Material[], i: number) => {
  const name = rows[i].name.trim();
  return !name || rows.some((m, j) => j !== i && m.name.trim() === name);
};
const valid = (rows: Material[], i: number) => !badName(rows, i) && !badDim(rows[i].thk) && !badDim(rows[i].w) && !badDim(rows[i].l);

/** The shop's sheet goods: name, thickness and stock sheet size. Rows are edited in place and written to the shop when valid. */
export function MaterialsTable({ cfg, update }: { cfg: ShopConfig; update: Update }) {
  // Typing happens in local rows; a row reaches the shop (and autosave) only once it is valid, so a half-typed
  // name or dimension is never dropped by the server.
  const [rows, setRows] = useState(cfg.materials);
  useEffect(() => setRows(cfg.materials), [cfg.materials]);
  const [draft, setDraft] = useState<Material>(BLANK);
  const [tried, setTried] = useState(false);

  const setList = (next: Material[]) => update(c => ({ ...c, materials: next }));
  const edit = (i: number, k: keyof Material, v: string) => setRows(rs => rs.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  const commit = (i: number) => {
    if (!valid(rows, i)) return;
    const row = { name: rows[i].name.trim(), thk: rows[i].thk.trim(), w: rows[i].w.trim(), l: rows[i].l.trim() };
    const cur = cfg.materials[i];
    if (cur && cur.name === row.name && cur.thk === row.thk && cur.w === row.w && cur.l === row.l) return;
    setList(cfg.materials.map((m, j) => (j === i ? row : m)));
  };
  const remove = (i: number) => {
    if (!window.confirm(`Remove "${cfg.materials[i].name}" from the list? Jobs already using it keep their copy.`)) return;
    setList(cfg.materials.filter((_, j) => j !== i));
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cfg.materials.length) return;
    const next = [...cfg.materials]; [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  };
  const all = [...rows, draft];
  const draftOk = valid(all, all.length - 1);
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!draftOk) return;
    setList([...cfg.materials, { name: draft.name.trim(), thk: draft.thk.trim(), w: draft.w.trim(), l: draft.l.trim() }]);
    setDraft(BLANK); setTried(false);
  };

  const head = (t: string) => <div className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">{t}</div>;
  return (
    <div className="card flex flex-col gap-2 px-[18px] py-4">
      <div className="flex items-baseline gap-2">
        <div className="text-sm font-bold">Materials</div>
        <div className="text-[13px] text-muted">Inches · thickness sets the case and back rules, sheet size drives the saw plan</div>
        <div className="ml-auto text-[11px] text-muted">{cfg.materials.length} material{cfg.materials.length === 1 ? '' : 's'}</div>
      </div>
      <div className="grid items-center gap-x-2 gap-y-1 overflow-x-auto" style={{ gridTemplateColumns: COLS }}>
        {head('Name')}{head('Thickness')}{head('Sheet width')}{head('Sheet length')}<div />
        {rows.map((m, i) => (
          <div key={i} className="contents">
            <input value={m.name} onChange={e => edit(i, 'name', e.target.value)} onBlur={() => commit(i)} aria-label={`Material ${i + 1} name`}
              className={`${cell} ${badName(rows, i) ? 'field-bad' : ''}`} />
            {(['thk', 'w', 'l'] as const).map(k => (
              <input key={k} value={m[k]} onChange={e => edit(i, k, e.target.value)} onBlur={() => commit(i)} aria-label={`Material ${i + 1} ${k === 'thk' ? 'thickness' : k === 'w' ? 'width' : 'length'}`}
                className={`${cell} text-center ${badDim(m[k]) ? 'field-bad' : ''}`} />
            ))}
            <div className="flex items-center">
              <button onClick={() => move(i, -1)} disabled={i === 0} className={iconBtn} aria-label="Move up">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className={iconBtn} aria-label="Move down">↓</button>
              <button onClick={() => remove(i)} className={`${iconBtn} hover:text-danger`} aria-label={`Remove ${m.name}`}>×</button>
            </div>
          </div>
        ))}
      </div>
      {rows.some((_, i) => !valid(rows, i)) && <div className="text-xs text-danger">Every material needs a unique name and positive dimensions; rows in red are not saved until fixed.</div>}
      <form onSubmit={add} className="grid items-center gap-x-2 border-t border-line-2 pt-2" style={{ gridTemplateColumns: COLS }}>
        <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Add a material…" aria-label="New material name"
          className={`${cell} ${tried && badName(all, all.length - 1) ? 'field-bad' : ''}`} />
        {(['thk', 'w', 'l'] as const).map(k => (
          <input key={k} value={draft[k]} onChange={e => setDraft({ ...draft, [k]: e.target.value })} aria-label={`New material ${k === 'thk' ? 'thickness' : k === 'w' ? 'width' : 'length'}`}
            className={`${cell} text-center ${tried && badDim(draft[k]) ? 'field-bad' : ''}`} />
        ))}
        <button type="submit" disabled={!draft.name.trim()}
          className="rounded-full border border-rule bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink disabled:opacity-40 disabled:hover:border-rule">Add</button>
      </form>
      {tried && !draftOk && draft.name.trim() && <div className="text-xs text-danger">{badName(all, all.length - 1) ? 'A material with that name is already listed.' : 'Dimensions must be positive numbers, like 3/4 or 0.71.'}</div>}
    </div>
  );
}
