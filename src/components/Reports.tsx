import { elevShapes, type Fmt, type JobResult, type Kind } from '@/lib/engine';
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

export function NestSheets({ r, f, headerTxt, footerTxt }: ReportCtx) {
  const over = r.nests.flatMap(n => n.oversize.map(o => `${o.name} (${f(o.along)} x ${f(o.across)})`));
  return (
    <>
      {r.nests.flatMap(n => n.sheets.map(s => (
        <Card key={s.title} title={s.title} sub={headerTxt}>
          <svg viewBox={`-0.5 -0.5 ${n.L + 1} ${n.W + 1}`} className="mt-3.5 block w-full border border-line bg-canvas">
            {s.parts.map(p => {
              const fs = Math.min(2.2, p.sh / 3.2, p.sw / (p.label.length * 0.62));
              const ty = p.ty - (p.sh > 4 ? fs * 0.55 : 0);
              return (
                <g key={p.id}>
                  <rect x={p.sx} y={p.sy} width={p.sw} height={p.sh} fill="var(--color-drawer)" stroke="var(--color-ink)" strokeWidth={0.12} />
                  <text x={p.tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize={fs} fontWeight={700} fill="var(--color-ink)">{p.label}</text>
                  <text x={p.tx} y={p.ty + fs * 0.6} textAnchor="middle" dominantBaseline="middle" fontSize={fs * 0.75} fill="var(--color-ink-3)">{`${p.sub} ${p.arrow}`}</text>
                </g>
              );
            })}
          </svg>
          <div className="mt-2 text-xs text-muted">
            Sheet {n.L} long x {n.W} wide, kerf {r.d.kerf}&quot;, sheet grain along {n.L}&quot; length. → = part grain runs with sheet, ↕ = across. {s.yieldTxt}. Unshaded = offcut.
          </div>
          <Table small cols="36px minmax(140px,2fr) minmax(80px,1fr) minmax(80px,1fr) minmax(70px,0.8fr) 50px"
            heads={['#', 'Name', 'Along grain', 'Across grain', 'Grain', 'Cab#']}
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

export function InstallSheet({ r, f, job, today, footerTxt }: ReportCtx) {
  const inst = r.install, ls = inst.labelSize;
  return (
    <Card title={`Install Sheet — ${job.name}`} sub={`Drawn: ${job.drawn} · ${today}`}>
      <svg viewBox={inst.viewBox} className="mt-4 block w-full">
        <line x1={-2} y1={inst.floorY} x2={inst.totalW + 2} y2={inst.floorY} stroke="var(--color-ink)" strokeWidth={0.4} />
        {inst.items.map((c, k) => {
          const cb = r.cabs.find(x => x.idx === c.idx)!;
          return (
            <g key={k}>
              <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="#fff" stroke="var(--color-ink)" strokeWidth={0.3} />
              {elevShapes(cb, f).map(s => (
                <rect key={s.tag} x={s.x + c.x} y={s.y + c.y} width={s.w} height={s.h} fill={faceFill(s.kind)} stroke="var(--color-ink)" strokeWidth={0.15} />
              ))}
              <rect x={c.x} y={c.y + c.h - c.toe} width={c.w} height={c.toe} fill="var(--color-line)" stroke="var(--color-ink)" strokeWidth={0.15} />
              <text x={c.tx} y={c.y - ls * 1.6} textAnchor="middle" fontSize={ls} fontWeight={800} fill="var(--color-link)">{`#${c.idx} ${c.code}`}</text>
              <text x={c.tx} y={c.y - ls * 0.4} textAnchor="middle" fontSize={ls} fill="var(--color-ink)">{c.wTxt}</text>
            </g>
          );
        })}
        <text x={inst.totalW / 2} y={inst.floorY + ls * 2.6} textAnchor="middle" fontSize={ls} fontWeight={700} fill="var(--color-ink)">{inst.totalTxt}</text>
      </svg>
      <div className="mt-3.5 flex flex-col gap-1.5 text-[13px] leading-[1.6] text-ink-2">
        <div><strong>Construction.</strong> {r.d.caseMat} case &amp; slab fronts. {r.d.backMat} unfinished back. Toe kick is a separate assembly where called.</div>
        <div><strong>Drawers.</strong> {r.d.drawerStyle}, {r.d.glideSeries} glides sized to depth. {r.d.pull}.</div>
        <div><strong>Grain on every part.</strong> Ends, back, stretchers, nailers and fronts = VERTICAL. Decks, tops and shelves = HORIZONTAL. Each front nested as its own part. Kerf {r.d.kerf}&quot;.</div>
        <div className="text-muted">Rectangular nest only. Confirm parts, banding, and nest with mill before cutting.</div>
      </div>
      <Footer>{footerTxt}</Footer>
    </Card>
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
