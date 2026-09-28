'use client';
import { CATEGORIES, TYPES, categoryLabel, configsFor, parseDim, type BuiltCabinet, type CabInput, type Category, type Fmt } from '@/lib/engine';

const COLS = '28px minmax(84px,0.9fr) minmax(120px,1.5fr) repeat(4,minmax(58px,1fr)) 46px 28px';
const dimInput = 'field min-w-0 px-2 py-2 text-center text-sm tabular-nums';

interface Props {
  cabs: CabInput[];
  built: BuiltCabinet[];
  f: Fmt;
  selId: number | undefined;
  pickId: number | null;
  onUpdate: (id: number, patch: Partial<CabInput>) => void;
  onTogglePick: (id: number) => void;
  /** Category changed: first configuration applied, tile grid opened. */
  onCategory: (id: number, cat: Category) => void;
  onPick: (id: number, type: string) => void;
  onConfigure: (id: number) => void;
  onRemove: (id: number) => void;
  onAdd: () => void;
}

export function CabinetList({ cabs, built, f, selId, pickId, onUpdate, onTogglePick, onCategory, onPick, onConfigure, onRemove, onAdd }: Props) {
  const bad = (v: string) => isNaN(parseDim(v)) || parseDim(v) <= 0;
  const blur = (id: number, k: 'w' | 'h' | 'd' | 'toe') => (e: React.FocusEvent<HTMLInputElement>) => {
    const v = parseDim(e.target.value);
    if (!isNaN(v)) onUpdate(id, { [k]: f(v) });
  };
  return (
    <div className="card flex flex-col gap-3 overflow-x-auto px-[18px] py-4">
      <div className="flex items-baseline gap-2.5">
        <div className="text-base font-bold">Cabinets</div>
        <div className="text-[13px] text-muted">Sizes in inches — type 14 7/8 or 14.875</div>
      </div>
      <div className="grid items-center gap-1.5 px-0.5 text-[11px] font-bold tracking-[0.12em] text-muted uppercase" style={{ gridTemplateColumns: COLS }}>
        <div>#</div><div>Type</div><div>Configuration</div><div>Width</div><div>Height</div><div>Depth</div><div>Toe</div><div>Qty</div><div />
      </div>
      {cabs.length === 0 && <div className="rounded-lg bg-canvas px-4 py-6 text-center text-sm text-muted">No cabinets yet. Add one to start the cut list.</div>}
      {cabs.map((c, i) => {
        const b = built[i];
        const t = TYPES[c.type];
        const picking = pickId === c.id;
        const fronts = b.bad ? '' : ' · ' + b.fronts.map(fr => `${fr.qty > 1 ? fr.qty + '× ' : ''}${fr.desc} ${f(fr.w)} x ${f(fr.l)}`).join(', ');
        return (
          <div key={c.id} className={`-mx-1.5 grid items-center gap-1.5 rounded-lg p-1.5 ${c.id === selId ? 'bg-sel' : 'bg-transparent'}`} style={{ gridTemplateColumns: COLS }}>
            <div className="text-[13px] font-bold text-muted">{i + 1}</div>
            <select value={t?.cat} onChange={e => onCategory(c.id, e.target.value as Category)} className="field min-w-0 px-1.5 py-2 text-sm text-ink" aria-label="Type">
              {CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <button onClick={() => onTogglePick(c.id)} aria-expanded={picking}
              className={`flex h-9 min-w-0 items-center gap-2 rounded-md border bg-white py-0.5 pr-2 pl-[3px] text-left text-ink hover:border-ink ${picking ? 'border-accent' : 'border-line'}`}>
              <img src={t?.img} alt="" className="h-[30px] w-7 flex-none object-contain" />
              <div className="min-w-0 flex-1 truncate text-[13px] leading-[1.15] font-semibold">{t?.label}</div>
              <div className="flex-none text-[10px] text-muted">▾</div>
            </button>
            <input value={c.w} onChange={e => onUpdate(c.id, { w: e.target.value })} onBlur={blur(c.id, 'w')} className={`${dimInput} ${bad(c.w) ? 'field-bad' : ''}`} aria-label="Width" />
            <input value={c.h} onChange={e => onUpdate(c.id, { h: e.target.value })} onBlur={blur(c.id, 'h')} className={`${dimInput} ${bad(c.h) ? 'field-bad' : ''}`} aria-label="Height" />
            <input value={c.d} onChange={e => onUpdate(c.id, { d: e.target.value })} onBlur={blur(c.id, 'd')} className={`${dimInput} ${bad(c.d) ? 'field-bad' : ''}`} aria-label="Depth" />
            <input value={c.toe} onChange={e => onUpdate(c.id, { toe: e.target.value })} onBlur={blur(c.id, 'toe')} className={dimInput} aria-label="Toe" />
            <input value={c.qty} onChange={e => onUpdate(c.id, { qty: e.target.value })} className="field min-w-0 px-1.5 py-2 text-center text-sm" aria-label="Quantity" />
            <button onClick={() => onRemove(c.id)} title="Remove" className="h-8 w-7 rounded-md border-none bg-transparent text-lg text-faint hover:bg-canvas hover:text-danger">×</button>
            {picking && (
              <div className="col-span-full flex flex-col gap-2 rounded-lg border border-line bg-canvas p-2.5">
                <div className="eyebrow">{categoryLabel(t?.cat)} configurations</div>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(108px,1fr))' }}>
                  {configsFor(t?.cat).map(o => {
                    const cur = o.key === c.type;
                    return (
                      <button key={o.key} onClick={() => onPick(c.id, o.key)}
                        className={`flex flex-col items-center gap-1.5 rounded-lg px-2 pt-2.5 pb-2 text-ink hover:border-ink hover:shadow-[0_1px_2px_rgba(11,11,12,0.08),0_4px_12px_rgba(11,11,12,0.06)] ${cur ? 'border-2 border-accent bg-sel' : 'border border-line bg-white'}`}>
                        <img src={o.img} alt="" className="block h-[84px] w-full object-contain" />
                        <div className="text-center text-xs leading-[1.25] font-bold text-pretty">{o.label}</div>
                        <div className="text-[11px] font-semibold text-muted">{o.key}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="-mt-0.5 flex items-start gap-2.5" style={{ gridColumn: '2 / -1' }}>
              <div className="min-w-0 flex-1 text-xs text-pretty text-muted">
                {b.code} — {b.bad ? 'enter width, height and depth' : `${f(b.W)} x ${f(b.H)} x ${f(b.D)}`}{fronts}
              </div>
              <button onClick={() => onConfigure(c.id)} className="flex-none rounded-full border border-rule bg-white px-2.5 py-1 text-xs font-bold text-ink hover:border-ink">Configure</button>
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <button onClick={onAdd} className="rounded-full border border-ink bg-ink px-4 py-[9px] text-sm font-bold text-white hover:bg-ink-2">Add cabinet</button>
      </div>
    </div>
  );
}
