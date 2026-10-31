import { elevShapes, type Fmt, type JobResult, type Kind, type SawCut } from '@/lib/engine';
import type { JobInfo } from '@/lib/job';

export interface ReportCtx { r: JobResult; f: Fmt; job: JobInfo; today: string; headerTxt: string; footerTxt: string }

const faceFill = (k: Kind) => (k === 'drawer' ? 'var(--color-drawer)' : k === 'false' ? 'var(--color-line-2)' : k === 'open' ? 'none' : '#fff');

function Card({ title, sub, children }: { title: React.ReactNode; sub: React.ReactNode; children: React.ReactNode }) {
  return (
    <div data-report="1" className="card px-6 py-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="text-xl font-extrabold">{title}</div>
        <div className="text-xs text-muted">{sub}</div>
      </div>
      {children}
    </div>
  );
}
const Footer = ({ children }: { children: React.ReactNode }) => <div className="mt-3.5 text-[11px] text-faint">{children}</div>;

/** A report table: header labels, then one `cells` array per row. */
function Table({ cols, heads, rows, small, className = 'mt-3' }: {
  cols: string; heads: string[]; rows: { key: string | number; cells: { v: React.ReactNode; c?: string }[] }[]; small?: boolean; className?: string;
}) {
  return (
    <div className={`grid text-[13px] ${small ? 'gap-x-2.5 gap-y-0.5' : 'gap-x-2.5 gap-y-1'} ${className}`} style={{ gridTemplateColumns: cols }}>
      {heads.map((h, i) => <div key={i} className={`th ${small ? 'th-sm' : ''}`}>{h}</div>)}
      {rows.map(row => row.cells.map((cell, i) => <div key={`${row.key}-${i}`} className={`td ${small ? 'td-sm' : ''} ${cell.c ?? ''}`}>{cell.v}</div>))}
    </div>
  );
}

export function CutListReport({ r, headerTxt, footerTxt }: ReportCtx) {
  return (
    <>
      {r.materials.map(m => (
        <Card key={m.name} title="Panel Stock Cut List" sub={headerTxt}>
          <div className="mt-3.5 text-base font-bold text-link">{m.name}</div>
          <div className="mt-0.5 text-xs text-muted">Grain called on every part. Vertical = along Length. Kerf {r.d.kerf}&quot;. Band blank — mill to confirm L/R/T/B.</div>
          <Table cols="44px minmax(120px,2fr) minmax(110px,1.4fr) minmax(90px,1.2fr) minmax(80px,1fr)"
            heads={['Qty', 'Description', 'Width x Length', 'Grain', 'Cabinet (Qty)']}
            rows={m.rows.map((row, i) => ({ key: i, cells: [
              { v: row.qty, c: 'font-bold' }, { v: row.desc }, { v: row.size, c: 'font-semibold tabular-nums' },
              { v: row.grainTxt, c: 'text-ink-3' }, { v: row.cabsTxt, c: 'text-ink-3' },
            ] }))} />
          <div className="mt-3 text-xs text-ink-3"><strong>Rip totals</strong> (linear ft of each width): {m.rips}</div>
          <Footer>{footerTxt}</Footer>
        </Card>
      ))}
      {r.materials.length === 0 && <Card title="Panel Stock Cut List" sub={headerTxt}><div className="mt-3 text-sm text-muted">No sized cabinets yet.</div></Card>}
    </>
  );
}

export function DoorListReport({ r, f, headerTxt, footerTxt }: ReportCtx) {
  return (
    <Card title="Door List" sub={headerTxt}>
      <div className="mt-2 text-[13px] text-ink-3">{r.d.doorStyle} · Outside edge: none · Panel: slab · Grain: vertical (along height)</div>
      <Table cols="44px minmax(120px,1.6fr) minmax(90px,1fr) minmax(90px,1fr) minmax(80px,1fr)"
        heads={['Qty', 'Width x Height', 'Type', 'Grain', 'Cab (Qty)']}
        rows={r.doors.map((row, i) => ({ key: i, cells: [
          { v: row.qty, c: 'font-bold' }, { v: row.size, c: 'font-semibold tabular-nums' }, { v: row.type },
          { v: 'Vertical (along L)', c: 'text-ink-3' }, { v: row.cabsTxt, c: 'text-ink-3' },
        ] }))} />
      <div className="mt-2.5 text-xs text-muted">DF = drawer front · DR = door · FF = false front. Front width = cabinet width − {f(2 * r.d.sideReveal)}.</div>
      <Footer>{footerTxt}</Footer>
    </Card>
  );
}

export function DrawerListReport({ r, f, headerTxt, footerTxt }: ReportCtx) {
  return (
    <Card title="Drawer List" sub={headerTxt}>
      <div className="mt-2 text-base font-bold text-link">{r.d.drawerStyle}</div>
      <Table cols="44px minmax(70px,1fr) repeat(3,minmax(70px,1fr)) minmax(80px,1fr)"
        heads={['Type', 'Qty', 'Width', 'Depth', 'Height', 'Cabinet (Qty)']}
        rows={r.drawers.map((row, i) => ({ key: i, cells: [
          { v: row.kind }, { v: row.qty, c: 'font-bold' }, { v: row.wTxt, c: 'font-semibold' }, { v: row.dTxt, c: 'font-semibold' },
          { v: row.hTxt, c: 'font-semibold' }, { v: row.cabsTxt, c: 'text-ink-3' },
        ] }))} />
      <div className="mt-2.5 text-xs text-muted">Box width = cabinet width − {f(r.d.boxDeduct)}. Depth = longest {r.d.glideSeries} glide that fits cabinet depth − {f(r.d.glideDeduct)}.</div>
      <Footer>{footerTxt}</Footer>
    </Card>
  );
}

export function AssemblySheets({ r, f, job, today }: ReportCtx) {
  const partCols = '40px 70px 70px minmax(120px,1.5fr) minmax(70px,0.8fr) minmax(100px,1fr)';
  const partHeads = ['Qty', 'W', 'L', 'Description', 'Grain', 'Material'];
  return (
    <>
      {r.cabs.filter(c => !c.bad).map(c => {
        const pad = Math.max(c.W, c.boxH) * 0.14, fs = Math.max(c.W, c.boxH) / 22, dimX = -pad * 0.5;
        const sizeTxt = `${f(c.W)} x ${f(c.H)} x ${f(c.D)}`;
        const partRows = (ps: typeof c.parts) => ps.map((p, i) => ({ key: i, cells: [
          { v: p.qty, c: 'font-bold' }, { v: f(p.w) }, { v: f(p.l) }, { v: p.desc }, { v: p.grain, c: 'text-ink-3' }, { v: p.mat, c: 'text-ink-3' },
        ] }));
        return (
          <Card key={c.idx} title={`Assembly #${c.idx} — ${c.label}`} sub={`${job.name} · ${today}`}>
            <div className="mt-3.5 grid items-start gap-5" style={{ gridTemplateColumns: 'minmax(160px,220px) minmax(200px,1fr)' }}>
              <svg viewBox={`${-pad} ${-pad * 0.4} ${c.W + 2 * pad} ${c.boxH + pad * 1.6}`} className="block max-h-[300px] w-full">
                <rect x={0} y={0} width={c.W} height={c.boxH} fill="#fff" stroke="var(--color-ink)" strokeWidth={0.25} />
                {elevShapes(c, f).map(s => (
                  <g key={s.tag}>
                    <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={faceFill(s.kind)} stroke="var(--color-ink)" strokeWidth={0.18} />
                    <text x={s.tx} y={s.ty} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight={700} fill="var(--color-ink)">{`${s.tag}  ${s.label}`}</text>
                  </g>
                ))}
                <text x={c.W / 2} y={c.boxH + pad * 0.7} textAnchor="middle" fontSize={fs} fill="var(--color-muted)">{`${f(c.W)}"`}</text>
                <text x={dimX} y={c.boxH / 2} textAnchor="middle" fontSize={fs} fill="var(--color-muted)" transform={`rotate(-90 ${dimX} ${c.boxH / 2})`}>{`${f(c.boxH)}" box`}</text>
              </svg>
              <div className="grid gap-x-4 text-[13px] leading-[1.7] text-ink-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
                <div><span className="text-muted">Code</span> <strong>{c.code}</strong></div>
                <div><span className="text-muted">Size</span> <strong>{sizeTxt}</strong></div>
                <div><span className="text-muted">Catalog</span> {job.catalog}</div>
                <div><span className="text-muted">Qty</span> {c.qty}</div>
                <div><span className="text-muted">Toe height</span> {f(c.toe)}</div>
                <div><span className="text-muted">Toe recess</span> {f(r.d.toeRecess)}</div>
                <div><span className="text-muted">Back / Ends</span> Unfinished</div>
                <div><span className="text-muted">Scribe / Stile</span> 0</div>
                <div className="col-span-full text-muted">{c.toe > 0 ? 'Toe is a separate assembly — box height excludes toe.' : 'No toe kick — floor-set box.'}</div>
              </div>
            </div>
            <div className="mt-4 text-[13px] font-bold text-link">Drawer Fronts / Doors</div>
            <Table small className="mt-1.5" cols={partCols} heads={partHeads} rows={partRows(c.fronts)} />
            <div className="mt-4 text-[13px] font-bold text-link">Panel Stock</div>
            <Table small className="mt-1.5" cols={partCols} heads={partHeads} rows={partRows(c.parts)} />
            <div className="mt-4 text-[13px] font-bold text-link">Hardware</div>
            <Table small className="mt-1.5" cols="40px minmax(120px,1fr) minmax(140px,1.4fr)" heads={['Qty', 'Item', 'Spec']}
              rows={c.hardware.map((h, i) => ({ key: i, cells: [{ v: h.qty, c: 'font-bold' }, { v: h.item }, { v: h.spec, c: 'text-ink-3' }] }))} />
            <Footer>Assembly #{c.idx} · {c.code} · {sizeTxt} · {job.name}</Footer>
          </Card>
        );
      })}
    </>
  );
}

/** Where a cut's number badge sits: near the start of the cut line. */
function badgeAt(c: SawCut): [number, number] {
  if (c.kind === 'trim') return c.y1 === c.y2 ? [3, c.y1] : [c.x1, 3];
  if (c.kind === 'cross') return [c.x1, c.y1 + 1.5];
  return [c.x1 + 1.6, c.y1];
}

export function OptimizeSheets({ r, f, headerTxt, footerTxt }: ReportCtx) {
  const over = r.sawPlans.flatMap(n => n.oversize.map(o => `${o.name} (${f(o.along)} x ${f(o.across)})`));
  return (
    <>
      {r.sawPlans.flatMap(n => n.sheets.map(s => (
        <Card key={s.title} title={s.title} sub={headerTxt}>
          <svg viewBox={`-0.5 -0.5 ${n.L + 1} ${n.W + 1}`} className="mt-3.5 block w-full border border-line bg-canvas" role="img" aria-label={`Cutting diagram, ${s.title}`}>
            {n.trim > 0 && (
              <>
                <rect x={0} y={0} width={n.L} height={n.trim} fill="var(--color-line)" />
                <rect x={0} y={0} width={n.trim} height={n.W} fill="var(--color-line)" />
              </>
            )}
            {s.parts.map(p => {
              const fs = Math.min(2.2, p.across / 3.2, p.along / (p.label.length * 0.62));
              const ty = p.ty - (p.across > 4 ? fs * 0.55 : 0);
              return (
                <g key={p.id}>
                  <rect x={p.x} y={p.y} width={p.along} height={p.across} fill="var(--color-drawer)" stroke="var(--color-ink)" strokeWidth={0.12} />
                  <text x={p.tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight={700} fill="var(--color-ink)">{p.label}</text>
                  <text x={p.tx} y={p.ty + fs * 0.6} textAnchor="middle" dominantBaseline="middle" fontSize={fs * 0.75} fill="var(--color-ink-3)">{`${p.sub} ${p.arrow}`}</text>
                </g>
              );
            })}
            {s.cuts.map(c => (
              <line key={c.n} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="var(--color-link)" strokeWidth={c.kind === 'rip' || c.kind === 'trim' ? 0.3 : 0.2}
                strokeDasharray={c.kind === 'recut' ? '1 0.6' : undefined} />
            ))}
            {s.cuts.map(c => {
              const [bx, by] = badgeAt(c);
              return (
                <g key={c.n}>
                  <circle cx={bx} cy={by} r={1.15} fill="var(--color-link)" />
                  <text x={bx} y={by} textAnchor="middle" dominantBaseline="central" fontSize={1.25} fontWeight={800} fill="#fff">{c.n}</text>
                </g>
              );
            })}
          </svg>
          <div className="mt-2 text-xs text-muted">
            Panel saw: rip full-length strips along the {f(n.L)}&quot; grain, then crosscut each strip. Sheet {f(n.L)} x {f(n.W)}, kerf {r.d.kerf}&quot;
            {n.trim > 0 ? `, ${f(n.trim)}" trimmed off one long and one short edge (grey)` : ''}. Parts are never rotated: → = grain runs with the sheet, ↕ = across. {s.yieldTxt}. Unshaded = offcut.
          </div>
          <div className="mt-4 text-[13px] font-bold text-link">Cut sequence</div>
          <ol className="mt-1.5 grid gap-x-6 gap-y-0.5 text-[13px] text-ink-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
            {s.cuts.map(c => (
              <li key={c.n} className="flex gap-2 border-b border-line-2 py-1">
                <span className="w-6 flex-none text-right font-extrabold text-link tabular-nums">{c.n}</span>
                <span className={c.kind === 'rip' || c.kind === 'trim' ? 'font-semibold' : ''}>{c.text}</span>
              </li>
            ))}
          </ol>
          <Table small cols="36px minmax(140px,2fr) minmax(80px,1fr) minmax(80px,1fr) minmax(70px,0.8fr) 50px"
            className="mt-4" heads={['#', 'Name', 'Along grain', 'Across grain', 'Grain', 'Cab#']}
            rows={s.parts.map(p => ({ key: p.id, cells: [
              { v: p.id, c: 'font-bold' }, { v: p.name }, { v: p.alongTxt, c: 'font-semibold' }, { v: p.acrossTxt, c: 'font-semibold' },
              { v: p.grain, c: 'text-ink-3' }, { v: p.cab, c: 'text-ink-3' },
            ] }))} />
          <Footer>{footerTxt}</Footer>
        </Card>
      )))}
      {over.length > 0 && <div className="px-1 text-[13px] text-danger">Does not fit sheet: {over.join(', ')}</div>}
    </>
  );
}

export function HardwareReport({ r, headerTxt, footerTxt }: ReportCtx) {
  return (
    <Card title="Hardware List" sub={headerTxt}>
      <Table cols="44px minmax(140px,1fr) minmax(160px,1.4fr)" heads={['Qty', 'Item', 'Spec']}
        rows={r.hardware.map((h, i) => ({ key: i, cells: [{ v: h.qty, c: 'font-bold' }, { v: h.item }, { v: h.spec, c: 'text-ink-3' }] }))} />
      <Footer>{footerTxt}</Footer>
    </Card>
  );
}
