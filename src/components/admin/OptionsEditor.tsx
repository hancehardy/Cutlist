'use client';
import { useEffect, useState } from 'react';
import { BOX_FIELD, SAW_FIELDS, parseDim, type DefaultKey, type FrontStyle, type Grain } from '@/lib/engine';
import { HARDWARE_OPTION_KEYS, optionLabel, type ShopConfig } from '@/lib/shop';
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

const badStyleName = (rows: FrontStyle[], i: number) => { const n = rows[i].name.trim(); return !n || rows.some((r, j) => j !== i && r.name.trim() === n); };

/** Door or drawer front styles: name, whether a slab is cut in the shop, and (for drawer fronts) grain. Rows reach the shop once valid. */
function StylesTable({ title, sub, styles, grain, onChange }: { title: string; sub: string; styles: FrontStyle[]; grain?: boolean; onChange: (styles: FrontStyle[]) => void }) {
  const [rows, setRows] = useState(styles);
  useEffect(() => setRows(styles), [styles]);
  const [draft, setDraft] = useState<FrontStyle>({ name: '', slab: true, grain: 'Vertical' });
  const [dup, setDup] = useState(false);
  const cols = grain ? 'minmax(160px,2fr) 110px 110px 92px' : 'minmax(160px,2fr) 110px 92px';
  const commit = (i: number) => {
    if (badStyleName(rows, i)) return;
    const row = { ...rows[i], name: rows[i].name.trim() };
    const cur = styles[i];
    if (cur && cur.name === row.name && cur.slab === row.slab && cur.grain === row.grain) return;
    onChange(styles.map((s, j) => (j === i ? row : s)));
  };
  const set = (i: number, patch: Partial<FrontStyle>, now = false) => {
    const next = rows.map((s, j) => (j === i ? { ...s, ...patch } : s));
    setRows(next);
    if (now && !badStyleName(next, i)) onChange(next.map(s => ({ ...s, name: s.name.trim() })));
  };
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= styles.length) return; const next = [...styles]; [next[i], next[j]] = [next[j], next[i]]; onChange(next); };
  const remove = (i: number) => { if (styles.length > 1 || window.confirm('Remove the last style? Job setup will then need a typed-in style.')) onChange(styles.filter((_, j) => j !== i)); };
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    if (styles.some(s => s.name === name)) { setDup(true); return; }
    onChange([...styles, { ...draft, name }]); setDraft({ name: '', slab: true, grain: 'Vertical' }); setDup(false);
  };
  const head = (t: string) => <div className="text-[11px] font-bold tracking-[0.1em] text-muted uppercase">{t}</div>;
  const grainSel = (v: Grain, onV: (g: Grain) => void, label: string) => (
    <select value={v} onChange={e => onV(e.target.value as Grain)} className="field px-1.5 py-1.5 text-[12px] text-ink" aria-label={label}>
      <option value="Vertical">Vertical</option>
      <option value="Horizontal">Horizontal</option>
    </select>
  );
  return (
    <div className="card flex flex-col gap-2 px-[18px] py-4">
      <div className="flex items-baseline gap-2">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-[11px] text-muted">{sub}</div>
        <div className="ml-auto text-[11px] text-muted">{styles.length} style{styles.length === 1 ? '' : 's'}</div>
      </div>
      <div className="grid items-center gap-x-2 gap-y-1" style={{ gridTemplateColumns: cols }}>
        {head('Name')}{head('Cut in shop')}{grain && head('Grain')}<div />
        {rows.map((s, i) => (
          <div key={i} className="contents">
            <input value={s.name} onChange={e => set(i, { name: e.target.value })} onBlur={() => commit(i)} aria-label={`${title} ${i + 1} name`}
              className={`field min-w-0 px-2 py-1.5 text-[13px] text-ink ${badStyleName(rows, i) ? 'field-bad' : ''}`} />
            <label className="flex items-center gap-1.5 text-[12px] text-ink-2"><input type="checkbox" checked={s.slab} onChange={e => set(i, { slab: e.target.checked }, true)} /> Slab</label>
            {grain && grainSel(s.grain, g => set(i, { grain: g }, true), `${title} ${i + 1} grain`)}
            <div className="flex items-center">
              <button onClick={() => move(i, -1)} disabled={i === 0} className={iconBtn} aria-label="Move up">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === styles.length - 1} className={iconBtn} aria-label="Move down">↓</button>
              <button onClick={() => remove(i)} className={`${iconBtn} hover:text-danger`} aria-label={`Remove ${s.name}`}>×</button>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={add} className="grid items-center gap-x-2 border-t border-line-2 pt-2" style={{ gridTemplateColumns: cols }}>
        <input value={draft.name} onChange={e => { setDraft({ ...draft, name: e.target.value }); setDup(false); }} placeholder={`Add ${title.toLowerCase().replace(/s$/, '')}…`} aria-label={`New ${title.toLowerCase()} name`}
          className={`field min-w-0 px-2 py-1.5 text-[13px] text-ink ${dup ? 'field-bad' : ''}`} />
        <label className="flex items-center gap-1.5 text-[12px] text-ink-2"><input type="checkbox" checked={draft.slab} onChange={e => setDraft({ ...draft, slab: e.target.checked })} /> Slab</label>
        {grain && grainSel(draft.grain, g => setDraft({ ...draft, grain: g }), `New ${title.toLowerCase()} grain`)}
        <button type="submit" disabled={!draft.name.trim()} className="rounded-full border border-rule bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink disabled:opacity-40 disabled:hover:border-rule">Add</button>
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
        Fronts offered under Fronts on job setup. Slab styles are cut and optimized in the shop; any other style is ordered and only listed on the door list. Drawer front styles also set the grain direction.
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
        <StylesTable title="Door front styles" sub="Doors run vertical grain" styles={cfg.doorStyles} onChange={doorStyles => update(c => ({ ...c, doorStyles }))} />
        <StylesTable title="Drawer front styles" sub="Also used for false fronts" styles={cfg.drawerFrontStyles} grain onChange={drawerFrontStyles => update(c => ({ ...c, drawerFrontStyles }))} />
        <OptionCard k={BOX_FIELD[0]} cfg={cfg} update={update} />
      </div>
      <div className="mt-2 text-[13px] text-muted">
        Hardware choices offered under Hardware on job setup. A new job starts with the first choice; anything not listed can still be typed with Other…
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
        {HARDWARE_OPTION_KEYS.map(k => <OptionCard key={k} k={k} cfg={cfg} update={update} />)}
      </div>
      <SawCard cfg={cfg} update={update} />
    </div>
  );
}
