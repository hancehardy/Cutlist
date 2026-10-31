'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RULE_FIELDS, buildJob, makeFmt, parseDim, typeFor, typesIn, type CabInput, type CabType, type DefaultKey, type SectionInput } from '@/lib/engine';
import { type JobDoc, type JobInfo } from '@/lib/job';
import type { ShopConfig } from '@/lib/shop';
import { CabinetList } from './CabinetList';
import { Configurator } from './Configurator';
import { JobSetup } from './JobSetup';
import { JobSummaryCard } from './JobSummaryCard';
import { presetFor } from '@/lib/presets';
import { JobsMenu } from './JobsMenu';
import { useAutosave } from './useAutosave';
import { UserMenu, type Me } from './auth/UserMenu';
import { PrintMenu } from './PrintMenu';
import { AssemblySheets, CutListReport, DoorListReport, DrawerListReport, HardwareReport, OptimizeSheets, SheetSummaryReport, type ReportCtx } from './Reports';

type Tab = 'config' | 'cut' | 'doors' | 'drawers' | 'assembly' | 'optimize' | 'sheets' | 'hardware';
const TABS: [Tab, string][] = [['config', 'Configure'], ['cut', 'Cut list'], ['doors', 'Doors'], ['drawers', 'Drawers'], ['assembly', 'Assembly'], ['optimize', 'Optimize'], ['sheets', 'Sheets'], ['hardware', 'Hardware']];
/** Shop-floor reports only an admin sees. */
const ADMIN_ONLY = new Set<Tab>(['cut', 'optimize']);

interface Props { jobId: string; initialDoc: JobDoc; initialShop: ShopConfig; user: Me }

export function CutlistApp({ jobId, initialDoc, initialShop, user }: Props) {
  const router = useRouter();
  const [doc, setDoc] = useState(initialDoc);
  // The shop config as loaded, plus any boxes saved from this job's configurator.
  const [shop, setShop] = useState(initialShop);
  const [tab, setTab] = useState<Tab>('config');
  const [selId, setSelId] = useState<number | null>(initialDoc.cabs[0]?.id ?? null);
  const [selSec, setSelSec] = useState(0);
  const [pickId, setPickId] = useState<number | null>(null);
  // New jobs start on the setup page; saved jobs go straight to item entry.
  const [view, setView] = useState<'setup' | 'items'>(initialDoc.setupDone ? 'items' : 'setup');
  const [printing, setPrinting] = useState(false);
  // Which reports the current print run includes.
  const [printSel, setPrintSel] = useState<Tab[]>([]);
  const tabs = useMemo(() => TABS.filter(([k]) => user.role === 'admin' || !ADMIN_ONLY.has(k)), [user.role]);
  const reports = useMemo(() => tabs.filter(([k]) => k !== 'config'), [tabs]);
  const [today, setToday] = useState('');
  const save = useAutosave(`/api/jobs/${jobId}`, doc);

  // Date is locale/timezone dependent, so render it on the client only.
  useEffect(() => setToday(new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })), []);
  useEffect(() => {
    const after = () => setPrinting(false);
    window.addEventListener('afterprint', after);
    return () => window.removeEventListener('afterprint', after);
  }, []);

  const f = useMemo(() => makeFmt(doc.dimFormat), [doc.dimFormat]);
  // Saw settings are shop-wide and live, so they overlay the job's rules at build time.
  const result = useMemo(
    () => buildJob(doc.cabs, { ...doc.defaults, kerf: shop.saw.kerf, edgeTrim: shop.saw.edgeTrim }, doc.dimFormat, doc.materials, shop.catalog, doc.fronts),
    [doc.cabs, doc.defaults, doc.dimFormat, doc.materials, doc.fronts, shop.saw, shop.catalog],
  );
  const { cabs, job } = doc;

  // Put the construction rules on a method's values; materials and hardware are untouched.
  const withRules = (d: JobDoc, key: string): JobDoc => {
    const next = { ...d.defaults }, p = presetFor(key, shop.presets).values;
    for (const [k] of RULE_FIELDS) { if (p[k] !== undefined) next[k] = p[k]; else delete next[k]; }
    return { ...d, method: key, defaults: next };
  };

  const setCabs = (fn: (c: CabInput[]) => CabInput[]) => setDoc(s => ({ ...s, cabs: fn(s.cabs) }));
  const upd = (id: number, patch: Partial<CabInput>) => setCabs(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c)));
  const setType = (id: number, type: string) => {
    const t = typeFor(shop.catalog, type);
    if (t) upd(id, { type, h: f(parseDim(t.h)), d: f(parseDim(t.d)), toe: f(parseDim(t.toe)), layout: null, ...(t.w ? { w: f(parseDim(t.w)) } : {}) });
  };
  const select = (id: number, sec = 0) => { setSelId(id); setSelSec(sec); };
  const selCabId = (cabs.find(c => c.id === selId) || cabs[0])?.id;

  const openJob = async (id: string) => { await save.flush(); router.push(`/?job=${id}`); };
  const goJobs = async () => { await save.flush(); router.push('/jobs'); };
  const newJob = async () => {
    const res = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) openJob(data.id);
  };
  const exportJson = () => {
    const slug = doc.job.name.trim().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'job';
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}.cutlist.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /** Save a cabinet's faces as a box in the shop catalog; optionally switch the cabinet onto it. Returns an error message or null. */
  const saveBox = async (cabId: number, type: CabType, useIt: boolean): Promise<string | null> => {
    const res = await fetch('/api/shop/types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(type) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || 'Could not save the box.';
    const saved: CabType = data.type;
    setShop(s => ({ ...s, catalog: { ...s.catalog, types: [...s.catalog.types, saved] } }));
    if (useIt) upd(cabId, { type: saved.code, layout: null });
    return null;
  };

  const headerTxt = `Created for ${job.client} | ${job.name} | ${job.catalog} · ${today}`;
  const ctx: ReportCtx = { r: result, f, job, today, headerTxt, footerTxt: `Shop packet for mill — not a Cabinet Vision file. Confirm banding. ${job.name}` };
  const show = (t: Tab) => (t === 'config' ? !printing && tab === 'config' : printing ? printSel.includes(t) : tab === t);
  const print = (keys: Tab[]) => { setPrintSel(keys); setPrinting(true); setTimeout(() => window.print(), 150); };
  const s = result.summary;

  const topBar = (
    <div className="flex items-center gap-3">
      <img src="/assets/logo-mark.png" alt="" className="h-[34px] w-[34px] object-contain" />
      <div className="text-[22px] font-extrabold tracking-[-0.01em]">Cutlist</div>
      <JobsMenu saveState={save.state} onNew={newJob} onJobs={goJobs} />
      <UserMenu user={user} />
      <div className="text-xs tracking-[0.04em] text-muted">{today}</div>
    </div>
  );

  if (view === 'setup') {
    return (
      <div className="box-border flex min-h-screen flex-col gap-5 p-5">
        <div className="mx-auto w-full max-w-[880px]">{topBar}</div>
        <JobSetup existing={doc.setupDone} job={job} method={doc.method} defaults={doc.defaults} materials={doc.materials} fronts={doc.fronts} f={f}
          dimFormat={doc.dimFormat} onFormat={dimFormat => setDoc(d => ({ ...d, dimFormat }))} onExport={exportJson}
          presets={shop.presets} shopMaterials={shop.materials} doorStyles={shop.doorStyles} drawerFrontStyles={shop.drawerFrontStyles} options={shop.options}
          onJob={(k: keyof JobInfo, v) => setDoc(d => ({ ...d, job: { ...d.job, [k]: v } }))}
          onDefault={(k: DefaultKey, v) => setDoc(d => ({ ...d, defaults: { ...d.defaults, [k]: v } }))}
          onMaterial={(slot, m) => setDoc(d => ({ ...d, materials: { ...d.materials, [slot]: m } }))}
          onFront={(slot, s) => setDoc(d => ({ ...d, fronts: { ...d.fronts, [slot]: s } }))}
          onPreset={key => setDoc(d => withRules(d, key))}
          onResetRules={() => setDoc(d => withRules(d, d.method))}
          onContinue={() => { setDoc(d => (d.setupDone ? d : { ...d, setupDone: true })); setView('items'); window.scrollTo(0, 0); }} />
      </div>
    );
  }

  return (
    <div data-shell="1" className="box-border flex min-h-screen flex-wrap items-start gap-5 p-5">
      {/* ============ INPUT PANEL ============ */}
      <div data-print-hide="1" className="flex max-w-[640px] min-w-0 flex-[1_1_600px] flex-col gap-4">
        {topBar}

        <JobSummaryCard job={job} method={doc.method} defaults={doc.defaults} presets={shop.presets} d={result.d} onEdit={() => { setView('setup'); window.scrollTo(0, 0); }} />

        <CabinetList cabs={cabs} built={result.cabs} catalog={shop.catalog} d={result.d} f={f} selId={selCabId} pickId={pickId}
          onUpdate={upd}
          onTogglePick={id => setPickId(p => (p === id ? null : id))}
          onCategory={(id, cat) => { const first = typesIn(shop.catalog, cat)[0]; if (first) setType(id, first.code); setPickId(id); }}
          onPick={(id, type) => { setType(id, type); setPickId(null); select(id); setTab('config'); }}
          onConfigure={id => { select(id); setTab('config'); }}
          onDuplicate={id => {
            const nextId = Math.max(0, ...cabs.map(c => c.id)) + 1;
            setCabs(cs => {
              const i = cs.findIndex(c => c.id === id);
              if (i < 0) return cs;
              const src = cs[i];
              const copy: CabInput = { ...src, id: nextId, layout: src.layout ? src.layout.map(s => ({ ...s })) : null };
              return [...cs.slice(0, i + 1), copy, ...cs.slice(i + 1)];
            });
            select(nextId);
          }}
          onRemove={id => setCabs(cs => cs.filter(x => x.id !== id))}
          onAdd={() => {
            const t = shop.catalog.types[0], id = Math.max(0, ...cabs.map(c => c.id)) + 1;
            if (!t) return;
            setCabs(cs => [...cs, { id, type: t.code, w: '30', h: f(parseDim(t.h)), d: f(parseDim(t.d)), toe: f(parseDim(t.toe)), qty: '1', layout: null }]);
            select(id); setTab('config');
          }} />
      </div>

      {/* ============ REPORTS ============ */}
      <div data-reports="1" className="flex min-w-0 flex-[2_1_520px] flex-col gap-3.5">
        <div data-print-hide="1" className="flex flex-wrap items-center gap-1">
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`border-0 border-b-2 bg-transparent px-3 py-2 text-sm font-bold hover:text-ink ${tab === k ? 'border-accent text-ink' : 'border-transparent text-muted'}`}>
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <div className="text-[13px] text-muted">{s.nParts} parts · {s.nFronts} fronts · {s.nDrawers} drawers · {s.sheets} sheets</div>
            <PrintMenu reports={reports} current={tab !== 'config' ? tab : null} onPrint={print} />
          </div>
        </div>

        {show('config') && (
          <Configurator cabs={cabs} built={result.cabs} catalog={shop.catalog} d={result.d} f={f} selId={selCabId ?? null} selSec={selSec}
            onSelect={select} onSelectSec={setSelSec}
            onLayout={(id, layout: SectionInput[] | null) => upd(id, { layout })} onSaveBox={saveBox} />
        )}
        {show('cut') && <CutListReport {...ctx} />}
        {show('doors') && <DoorListReport {...ctx} />}
        {show('drawers') && <DrawerListReport {...ctx} />}
        {show('assembly') && <AssemblySheets {...ctx} />}
        {show('optimize') && <OptimizeSheets {...ctx} />}
        {show('sheets') && <SheetSummaryReport {...ctx} />}
        {show('hardware') && <HardwareReport {...ctx} />}
      </div>
    </div>
  );
}
