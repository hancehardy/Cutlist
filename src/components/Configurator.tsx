'use client';
import {
  TYPES, categoryLabel, defaultLayout, elevShapes, newSection, parseDim,
  type BuiltCabinet, type CabInput, type Fmt, type Hinge, type Kind, type Resolved, type SectionInput,
} from '@/lib/engine';

const KINDS: [Kind, string][] = [['drawer', 'Drawer'], ['door', 'Door'], ['false', 'False'], ['open', 'Open']];
const pillBtn = 'rounded-full border border-rule bg-white px-3 py-[7px] text-[13px] font-bold text-ink hover:border-ink';
const navBtn = 'rounded-lg border border-rule bg-white px-3.5 py-2 text-[13px] font-bold text-ink hover:border-ink';
const iconBtn = 'h-7 w-7 rounded-md border-none bg-transparent text-sm text-muted hover:bg-line-2 hover:text-ink';

interface Props {
  cabs: CabInput[];
  built: BuiltCabinet[];
  d: Resolved;
  f: Fmt;
  selId: number | null;
  selSec: number;
  onSelect: (id: number, sec: number) => void;
  onSelectSec: (sec: number) => void;
  onLayout: (id: number, layout: SectionInput[] | null) => void;
}

function Segmented<T extends string>({ opts, value, onChange }: { opts: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-rule">
      {opts.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className={`border-none px-[9px] py-1.5 text-xs font-bold ${k === value ? 'bg-ink text-white' : 'bg-white text-ink-3'}`}>{label}</button>
      ))}
    </div>
  );
}

function Stepper({ label, value, onDec, onInc }: { label: string; value: number; onDec: () => void; onInc: () => void }) {
  const b = 'h-7 w-7 rounded-lg border-none bg-transparent text-[15px] text-ink hover:bg-line-2';
  return (
    <div className="flex items-center gap-1.5">
      {label}
      <div className="flex items-center rounded-lg border border-line bg-white">
        <button onClick={onDec} className={b} aria-label={`Fewer ${label.toLowerCase()}`}>−</button>
        <div className="min-w-[18px] text-center text-[13px] font-extrabold text-ink">{value}</div>
        <button onClick={onInc} className={b} aria-label={`More ${label.toLowerCase()}`}>+</button>
      </div>
    </div>
  );
}

export function Configurator({ cabs, built, d, f, selId, selSec: rawSec, onSelect, onSelectSec, onLayout }: Props) {
  const selIdx = Math.max(0, cabs.findIndex(c => c.id === selId));
  const sc = cabs[selIdx], sb = built[selIdx];

  const header = (eyebrow: string, title: string, sub = '') => (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-xs font-extrabold tracking-[0.18em] text-accent uppercase">{eyebrow}</div>
        <div className="text-2xl font-extrabold tracking-[-0.01em]">{title}</div>
        <div className="text-sm text-ink-3">{sub}</div>
      </div>
      {sc && (
        <div className="ml-auto flex gap-1.5">
          <button onClick={() => go(-1)} className={navBtn}>‹ Prev</button>
          <button onClick={() => go(1)} className={navBtn}>Next ›</button>
        </div>
      )}
    </div>
  );
  const go = (dir: number) => { const j = (selIdx + dir + cabs.length) % cabs.length; onSelect(cabs[j].id, 0); };
  const shell = (children: React.ReactNode) => <div data-print-hide="1" className="card flex flex-col gap-[18px] px-6 py-[22px]">{children}</div>;
  const empty = (txt: string) => <div className="rounded-lg bg-canvas px-4 py-10 text-center text-[15px] text-muted">{txt}</div>;

  if (!sc) return shell(<>{header('Configure', 'No cabinets')}{empty('Add a cabinet to configure it.')}</>);

  const t = TYPES[sc.type];
  if (sb.bad) return shell(<>{header(`Configure · cabinet ${selIdx + 1} of ${cabs.length}`, `#${selIdx + 1} ${sb.code}`, t?.label)}{empty('Enter width, height and depth to see the drawing.')}</>);

  // Editable layout: the saved custom one, or the type's standard layout with heights as text.
  const cur: SectionInput[] = sc.layout || defaultLayout(sc.type, d, parseDim(sc.h)).map(s => ({ ...s, h: typeof s.h === 'number' ? f(s.h) : s.h }));
  const setL = (fn: (L: SectionInput[]) => SectionInput[]) => onLayout(sc.id, fn(cur.map(s => ({ ...s }))));
  const selSec = Math.max(0, Math.min(rawSec || 0, cur.length - 1));
  const at = selSec + 1;
  const add = (kind: Kind, h: string) => { setL(L => { L.splice(at, 0, newSection(kind, h)); return L; }); onSelectSec(at); };

  // Drawing geometry (inches).
  const W = sb.W, H = sb.H, big = Math.max(W, H), fs = big / 30, thk = d.caseThk;
  const sw2 = big / 500, dash = `${big / 90} ${big / 140}`;
  const faces = elevShapes(sb, f).map(s => {
    const sel = s.sec === selSec, { x, y, w, h } = s;
    let swing = '', pull: [number, number, number, number] | null = null;
    if (s.kind === 'door') {
      swing = s.hinge === 'R' ? `${x},${y} ${x + w},${y + h / 2} ${x},${y + h}` : `${x + w},${y} ${x},${y + h / 2} ${x + w},${y + h}`;
      const len = Math.min(4, h * 0.3), px = s.hinge === 'R' ? x + 1.5 : x + w - 1.5;
      const atBottom = sb.isWall || (sb.isTall && s.sec === 0 && sb.sections.length > 1);
      const py = atBottom ? y + h - 1.5 - len : y + 1.5;
      pull = [px, py, px, py + len];
    } else if (s.kind === 'drawer' && h > 3) {
      const len = Math.min(4, w * 0.35), py = y + Math.min(h * 0.25, 2.5);
      pull = [x + w / 2 - len / 2, py, x + w / 2 + len / 2, py];
    }
    const label = `${s.secTag}  ${f(w)} x ${f(h)}`;
    return {
      key: `${s.secTag}-${s.sec}`, x, y, w, h, swing, pull, label, sec: s.sec,
      tx: x + w / 2, ty: y + h / 2 + (s.kind === 'drawer' ? Math.min(h * 0.1, 0.6) : 0),
      tfs: Math.max(0.1, Math.min(fs, h / 2.4, w / (label.length * 0.6))),
      fill: sel ? 'var(--color-drawer)' : s.kind === 'false' ? 'var(--color-line-2)' : s.kind === 'open' ? 'var(--color-canvas)' : '#fff',
      stroke: sel ? 'var(--color-accent)' : 'var(--color-ink)', sw: sel ? big / 180 : big / 400,
      dash: s.kind === 'open' ? `${big / 80} ${big / 120}` : undefined,
    };
  });
  const shelfLines: { y: number }[] = [], rollRects: { x: number; w: number; y: number }[] = [];
  for (const s of sb.sections) {
    if (s.kind !== 'door' && s.kind !== 'open') continue;
    for (let k = 1; k <= s.shelves; k++) shelfLines.push({ y: s.y + (s.h * k) / (s.shelves + 1) });
    const slot = s.h / Math.max(1, s.rollouts);
    const x0 = thk + (s.spacerL ? d.rolloutSpacer : 0), x1 = W - thk - (s.spacerR ? d.rolloutSpacer : 0);
    for (let k = 0; k < s.rollouts; k++) rollRects.push({ x: x0, w: x1 - x0, y: Math.max(s.y, s.y + slot * (k + 1) - d.rolloutH - 0.5) });
  }
  const dims = sb.sections.map((s, i) => ({ y1: s.y, y2: s.y + s.h, ty: s.y + s.h / 2, txt: `${s.tag} ${f(s.h)}`, weight: i === selSec ? 800 : 500, color: i === selSec ? 'var(--color-link)' : 'var(--color-ink-3)' }));
  if (sb.toe > 0) dims.push({ y1: sb.boxH, y2: H, ty: sb.boxH + sb.toe / 2, txt: `Toe ${f(sb.toe)}`, weight: 500, color: 'var(--color-muted)' });
  const dimX = W + fs * 1.2, tickX1 = W + fs * 0.6, tickX2 = W + fs * 1.8, dimTX = W + fs * 2.2, dimFs = fs * 0.9;
  const hDimX = -fs * 1.4, hTextX = hDimX - fs * 0.7;
  const boxes = sb.drawers.map(b => `${b.qty} × ${b.kind.toLowerCase()} ${f(b.w)} x ${f(b.dp)} x ${f(b.h)} (${b.sec})`);

  return shell(
    <>
      {header(`Configure · cabinet ${selIdx + 1} of ${cabs.length}`, `#${selIdx + 1} ${sb.code}`,
        `${categoryLabel(t?.cat)} · ${t?.label} · ${f(sb.W)} W x ${f(sb.H)} H x ${f(sb.D)} D`)}
      <div className="grid items-start gap-7" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        <div className="flex flex-col gap-2.5">
          <svg viewBox={`${-fs * 3.4} ${-fs} ${W + fs * 3.4 + fs * 8} ${H + fs * 4.4}`} className="block max-h-[560px] w-full" role="img" aria-label={`Front elevation of ${sb.code}`}>
            <rect x={0} y={0} width={W} height={sb.boxH} fill="var(--color-canvas)" stroke="var(--color-ink)" strokeWidth={big / 250} />
            <rect x={0} y={sb.boxH} width={W} height={sb.toe} fill="var(--color-line)" stroke="var(--color-ink)" strokeWidth={sw2} />
            {faces.map(fc => (
              <g key={fc.key}>
                <rect x={fc.x} y={fc.y} width={fc.w} height={fc.h} fill={fc.fill} stroke={fc.stroke} strokeWidth={fc.sw} strokeDasharray={fc.dash} onClick={() => onSelectSec(fc.sec)} className="cursor-pointer" />
                {fc.swing && <polyline points={fc.swing} fill="none" stroke="var(--color-faint)" strokeWidth={sw2} strokeDasharray={dash} pointerEvents="none" />}
                {fc.pull && <line x1={fc.pull[0]} y1={fc.pull[1]} x2={fc.pull[2]} y2={fc.pull[3]} stroke="var(--color-ink)" strokeWidth={big / 160} strokeLinecap="round" pointerEvents="none" />}
              </g>
            ))}
            {shelfLines.map((l, k) => <line key={k} x1={thk} y1={l.y} x2={W - thk} y2={l.y} stroke="var(--color-muted)" strokeWidth={sw2} strokeDasharray={dash} pointerEvents="none" />)}
            {rollRects.map((r, k) => (
              <rect key={k} x={r.x} y={r.y} width={r.w} height={d.rolloutH} fill="none" stroke="var(--color-link)" strokeWidth={sw2} strokeDasharray={dash} pointerEvents="none" />
            ))}
            {faces.map(fc => (
              <text key={fc.key} x={fc.tx} y={fc.ty} textAnchor="middle" dominantBaseline="middle" fontSize={fc.tfs} fontWeight={700} fill="var(--color-ink)" pointerEvents="none">{fc.label}</text>
            ))}
            {dims.map((m, k) => (
              <g key={k}>
                <line x1={dimX} y1={m.y1} x2={dimX} y2={m.y2} stroke="var(--color-muted)" strokeWidth={sw2} />
                <line x1={tickX1} y1={m.y1} x2={tickX2} y2={m.y1} stroke="var(--color-muted)" strokeWidth={sw2} />
                <line x1={tickX1} y1={m.y2} x2={tickX2} y2={m.y2} stroke="var(--color-muted)" strokeWidth={sw2} />
                <text x={dimTX} y={m.ty} dominantBaseline="middle" fontSize={dimFs} fontWeight={m.weight} fill={m.color}>{m.txt}</text>
              </g>
            ))}
            <line x1={0} y1={H + fs * 1.2} x2={W} y2={H + fs * 1.2} stroke="var(--color-muted)" strokeWidth={sw2} />
            <text x={W / 2} y={H + fs * 2.6} textAnchor="middle" fontSize={dimFs} fontWeight={700} fill="var(--color-ink)">{`${f(W)}"`}</text>
            <line x1={hDimX} y1={0} x2={hDimX} y2={H} stroke="var(--color-muted)" strokeWidth={sw2} />
            <text x={hTextX} y={H / 2} textAnchor="middle" fontSize={dimFs} fontWeight={700} fill="var(--color-ink)" transform={`rotate(-90 ${hTextX} ${H / 2})`}>{`${f(H)}"`}</text>
          </svg>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
            <div>Click a face to edit it</div>
            <div>Dashed grey = adjustable shelf</div>
            <div className="text-link">Dashed blue = roll-out</div>
            <div>Swing lines point to hinge side</div>
          </div>
          {boxes.length > 0 && <div className="text-[13px] leading-[1.6] text-ink-2"><strong>Boxes</strong> · {boxes.join(' · ')}</div>}
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <div className="text-base font-bold">Faces</div>
            <div className="text-[13px] text-muted">Top to bottom · blank height = auto</div>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted">
              {sc.layout ? 'Custom layout' : 'Standard layout'}
              <button onClick={() => { onLayout(sc.id, null); onSelectSec(0); }} className="border-none bg-transparent p-0 text-xs font-bold text-link hover:underline">Reset</button>
            </div>
          </div>
          {sb.sections.map((s, i) => {
            const sel = i === selSec, store = s.kind === 'door' || s.kind === 'open';
            const step = (k: 'split' | 'shelves' | 'rollouts', dv: number, min: number, max: number) => () =>
              setL(L => { const v = k === 'split' ? s.n : +L[i][k] || 0; L[i] = { ...L[i], [k]: Math.max(min, Math.min(max, v + dv)) }; return L; });
            const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
            return (
              <div key={i} onClick={() => onSelectSec(i)} className={`flex cursor-pointer flex-col gap-2 rounded-lg border px-3 py-2.5 ${sel ? 'border-accent bg-sel' : 'border-line bg-white'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-md bg-ink text-xs font-extrabold text-white">{s.tag}</div>
                  <Segmented opts={KINDS} value={s.kind} onChange={k => setL(L => {
                    const keep = k === 'door' || k === 'open';
                    L[i] = { ...L[i], kind: k, split: k === 'door' ? 0 : 1, shelves: keep ? L[i].shelves : 0, rollouts: keep ? L[i].rollouts : 0 };
                    return L;
                  })} />
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    H
                    <input value={cur[i]?.h ?? ''} placeholder={`auto ${f(s.h)}`}
                      onChange={e => { const v = e.target.value; setL(L => { L[i] = { ...L[i], h: v }; return L; }); }}
                      onBlur={e => { const v = parseDim(e.target.value); setL(L => { L[i] = { ...L[i], h: isNaN(v) || v <= 0 ? '' : f(v) }; return L; }); }}
                      className="field w-[84px] px-2 py-1.5 text-center text-[13px] text-ink" />
                  </label>
                  <div className="ml-auto flex gap-0.5">
                    <button title="Move up" className={iconBtn} onClick={stop(() => { if (i > 0) { setL(L => { [L[i - 1], L[i]] = [L[i], L[i - 1]]; return L; }); onSelectSec(i - 1); } })}>↑</button>
                    <button title="Move down" className={iconBtn} onClick={stop(() => { if (i < cur.length - 1) { setL(L => { [L[i + 1], L[i]] = [L[i], L[i + 1]]; return L; }); onSelectSec(i + 1); } })}>↓</button>
                    <button title="Remove" className={`${iconBtn} text-[17px] text-faint hover:text-danger`} onClick={stop(() => { if (cur.length > 1) { setL(L => { L.splice(i, 1); return L; }); onSelectSec(Math.max(0, i - 1)); } })}>×</button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-3">
                  {(s.kind === 'drawer' || s.kind === 'door') && (
                    <Stepper label={s.kind === 'door' ? 'Doors' : 'Drawers across'} value={s.n} onDec={step('split', -1, 1, 4)} onInc={step('split', 1, 1, 4)} />
                  )}
                  {store && (
                    <>
                      <Stepper label="Shelves" value={s.shelves} onDec={step('shelves', -1, 0, 8)} onInc={step('shelves', 1, 0, 8)} />
                      <Stepper label="Roll-outs" value={s.rollouts} onDec={step('rollouts', -1, 0, 5)} onInc={step('rollouts', 1, 0, 5)} />
                    </>
                  )}
                  {s.kind === 'door' && s.n === 1 && (
                    <div className="flex items-center gap-1.5">
                      Hinge
                      <Segmented<Hinge> opts={[['L', 'Left'], ['R', 'Right']]} value={s.hinge} onChange={hg => setL(L => { L[i] = { ...L[i], hinge: hg }; return L; })} />
                    </div>
                  )}
                  <div className="ml-auto font-bold text-ink tabular-nums">
                    {s.kind === 'open' ? `Opening ${f(s.h)} high` : `${s.n > 1 ? s.n + ' × ' : ''}${f(s.pw)} x ${f(s.h)}`}
                  </div>
                </div>
              </div>
            );
          })}
          {sb.warn && <div className="rounded-lg bg-err-bg px-3 py-2.5 text-[13px] text-err">{sb.warn}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-bold text-muted">Add below {sb.sections[selSec]?.tag || ''}</div>
            <button onClick={() => add('drawer', f(d.smallFront))} className={pillBtn}>+ Drawer</button>
            <button onClick={() => add('door', '')} className={pillBtn}>+ Door</button>
            <button onClick={() => add('false', f(d.smallFront))} className={pillBtn}>+ False front</button>
            <button onClick={() => add('open', '')} className={pillBtn}>+ Open</button>
          </div>
        </div>
      </div>
    </>,
  );
}
