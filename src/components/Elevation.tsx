'use client';
import { buildCabinet, elevShapes, type BuiltCabinet, type CabCatalog, type CabType, type Resolved } from '@/lib/engine';

/** A box type built at its default size (30" wide) for thumbnails and previews. */
export function sampleCabinet(t: CabType, d: Resolved, catalog: CabCatalog, w: number | string = t.w ?? 30): BuiltCabinet {
  return buildCabinet({ id: 0, type: t.code, w: String(w), h: t.h, d: t.d, toe: t.toe, qty: '1', layout: null }, d, 0, undefined, catalog);
}

/** A simple front elevation: box, toe kick, faces (drawers tinted, open dashed), shelves and door swings. */
export function Elevation({ cab, className, title }: { cab: BuiltCabinet; className?: string; title?: string }) {
  if (cab.bad) return <div className={className} />;
  const W = cab.W, H = cab.H, big = Math.max(W, H), sw = big / 160, dash = `${big / 90} ${big / 140}`;
  const faces = elevShapes(cab);
  const shelves = cab.sections.flatMap(s => (s.kind === 'door' || s.kind === 'open'
    ? Array.from({ length: s.shelves }, (_, k) => s.y + (s.h * (k + 1)) / (s.shelves + 1)) : []));
  const fill = (k: string) => (k === 'drawer' ? 'var(--color-drawer)' : k === 'false' ? 'var(--color-line-2)' : k === 'open' ? 'var(--color-canvas)' : '#fff');
  return (
    <svg viewBox={`${-sw} ${-sw} ${W + 2 * sw} ${H + 2 * sw}`} className={className} role="img" aria-label={title ?? `Front elevation of ${cab.code}`}>
      <rect x={0} y={0} width={W} height={cab.boxH} fill="var(--color-canvas)" stroke="var(--color-ink)" strokeWidth={sw} />
      {cab.toe > 0 && <rect x={0} y={cab.boxH} width={W} height={cab.toe} fill="var(--color-line)" stroke="var(--color-ink)" strokeWidth={sw / 2} />}
      {faces.map(s => (
        <g key={s.tag}>
          <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={fill(s.kind)} stroke="var(--color-ink)" strokeWidth={sw / 2} strokeDasharray={s.kind === 'open' ? dash : undefined} />
          {s.kind === 'door' && (
            <polyline fill="none" stroke="var(--color-faint)" strokeWidth={sw / 2} strokeDasharray={dash}
              points={s.hinge === 'R' ? `${s.x},${s.y} ${s.x + s.w},${s.y + s.h / 2} ${s.x},${s.y + s.h}` : `${s.x + s.w},${s.y} ${s.x},${s.y + s.h / 2} ${s.x + s.w},${s.y + s.h}`} />
          )}
        </g>
      ))}
      {shelves.map((y, k) => <line key={k} x1={cab.D ? 0.75 : 0} y1={y} x2={W - 0.75} y2={y} stroke="var(--color-muted)" strokeWidth={sw / 2} strokeDasharray={dash} />)}
    </svg>
  );
}

/** Picker image for a box type: its SKU image when it has one, otherwise an elevation drawn from its faces. */
export function TypeThumb({ type, d, catalog, className }: { type: CabType | undefined; d: Resolved; catalog: CabCatalog; className?: string }) {
  if (!type) return <div className={className} />;
  if (type.img) return <img src={type.img} alt="" className={className} />;
  return <Elevation cab={sampleCabinet(type, d, catalog)} className={className} title={`${type.code} ${type.label}`} />;
}
