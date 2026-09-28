'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TYPES, buildJob, configsFor, makeFmt, type CabInput, type DefaultKey, type SectionInput } from '@/lib/engine';
import { type JobDoc, type JobInfo, type JobSummary } from '@/lib/job';
import { CabinetList } from './CabinetList';
import { Configurator } from './Configurator';
import { JobHeader } from './JobHeader';
import { JobsMenu } from './JobsMenu';
import { AssemblySheets, CutListReport, DoorListReport, DrawerListReport, HardwareReport, InstallSheet, NestSheets, type ReportCtx } from './Reports';

type Tab = 'config' | 'cut' | 'doors' | 'drawers' | 'assembly' | 'nest' | 'install' | 'hardware';
const TABS: [Tab, string][] = [['config', 'Configure'], ['cut', 'Cut list'], ['doors', 'Doors'], ['drawers', 'Drawers'], ['assembly', 'Assembly'], ['nest', 'Nest'], ['install', 'Install'], ['hardware', 'Hardware']];
export type SaveState = 'saved' | 'saving' | 'error';

interface Props { jobId: string; initialDoc: JobDoc; initialJobs: JobSummary[] }

/** Debounced autosave to SQLite. Saves are chained so they land in order. */
function useAutosave(jobId: string, doc: JobDoc) {
  const [state, setState] = useState<SaveState>('saved');
  const pending = useRef<JobDoc | null>(null);
  const chain = useRef(Promise.resolve());
  const first = useRef(true);

  const flush = useCallback(() => {
    chain.current = chain.current.then(async () => {
      const d = pending.current;
      if (!d) return;
      pending.current = null;
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
        if (!res.ok) throw new Error(String(res.status));
        setState(pending.current ? 'saving' : 'saved');
      } catch {
        pending.current = pending.current ?? d;
        setState('error');
      }
    });
    return chain.current;
  }, [jobId]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    pending.current = doc;
    setState('saving');
    const t = setTimeout(flush, 600);
    return () => clearTimeout(t);
  }, [doc, flush]);

  // Don't lose the last keystrokes when the tab closes.
  useEffect(() => {
    const onHide = () => {
      if (!pending.current) return;
      fetch(`/api/jobs/${jobId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending.current), keepalive: true });
      pending.current = null;
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [jobId]);

  return { state, flush };
}

export function CutlistApp({ jobId, initialDoc, initialJobs }: Props) {
  const router = useRouter();
  const [doc, setDoc] = useState(initialDoc);
  const [tab, setTab] = useState<Tab>('config');
  const [selId, setSelId] = useState<number | null>(initialDoc.cabs[0]?.id ?? null);
  const [selSec, setSelSec] = useState(0);
  const [pickId, setPickId] = useState<number | null>(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [today, setToday] = useState('');
  const save = useAutosave(jobId, doc);

  // Date is locale/timezone dependent, so render it on the client only.
  useEffect(() => setToday(new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })), []);
  useEffect(() => {
    const after = () => setPrinting(false);
    window.addEventListener('afterprint', after);
    return () => window.removeEventListener('afterprint', after);
  }, []);

  const f = useMemo(() => makeFmt(doc.dimFormat), [doc.dimFormat]);
  const result = useMemo(() => buildJob(doc.cabs, doc.defaults, doc.dimFormat), [doc.cabs, doc.defaults, doc.dimFormat]);
  const { cabs, job } = doc;

  const setCabs = (fn: (c: CabInput[]) => CabInput[]) => setDoc(s => ({ ...s, cabs: fn(s.cabs) }));
  const upd = (id: number, patch: Partial<CabInput>) => setCabs(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c)));
  const setType = (id: number, type: string) => { const t = TYPES[type]; upd(id, { type, h: f(t.h), d: f(t.d), toe: f(t.toe), layout: null }); };
  const select = (id: number, sec = 0) => { setSelId(id); setSelSec(sec); };
  const selCabId = (cabs.find(c => c.id === selId) || cabs[0])?.id;

  const openJob = async (id: string) => { await save.flush(); router.push(`/?job=${id}`); };

  const headerTxt = `Created for ${job.client} | ${job.name} | ${job.catalog} · ${today}`;
  const ctx: ReportCtx = { r: result, f, job, today, headerTxt, footerTxt: `Shop packet for mill — not a Cabinet Vision file. Confirm banding. ${job.name}` };
  const show = (t: Tab) => (t === 'config' ? !printing && tab === 'config' : printing || tab === t);
  const s = result.summary;

  return (
    <div data-shell="1" className="box-border flex min-h-screen flex-wrap items-start gap-5 p-5">
      {/* ============ INPUT PANEL ============ */}
      <div data-print-hide="1" className="flex max-w-[640px] min-w-0 flex-[1_1_600px] flex-col gap-4">
        <div className="flex items-center gap-3">
          <img src="/assets/logo-mark.png" alt="" className="h-[34px] w-[34px] object-contain" />
          <div className="text-[22px] font-extrabold tracking-[-0.01em]">Cutlist</div>
          <JobsMenu jobId={jobId} doc={doc} initialJobs={initialJobs} saveState={save.state} onOpen={openJob}
            onFormat={dimFormat => setDoc(d => ({ ...d, dimFormat }))} />
          <div className="ml-auto text-xs tracking-[0.04em] text-muted">{today}</div>
        </div>

        <JobHeader job={job} defaults={doc.defaults} showDefaults={showDefaults} f={f}
          onJob={(k: keyof JobInfo, v) => setDoc(d => ({ ...d, job: { ...d.job, [k]: v } }))}
          onDefault={(k: DefaultKey, v) => setDoc(d => ({ ...d, defaults: { ...d.defaults, [k]: v } }))}
          onToggleDefaults={() => setShowDefaults(v => !v)}
          onResetDefaults={() => setDoc(d => ({ ...d, defaults: {} }))} />

        <CabinetList cabs={cabs} built={result.cabs} f={f} selId={selCabId} pickId={pickId}
          onUpdate={upd}
          onTogglePick={id => setPickId(p => (p === id ? null : id))}
          onCategory={(id, cat) => { setType(id, configsFor(cat)[0].key); setPickId(id); }}
          onPick={(id, type) => { setType(id, type); setPickId(null); select(id); setTab('config'); }}
          onConfigure={id => { select(id); setTab('config'); }}
          onRemove={id => setCabs(cs => cs.filter(x => x.id !== id))}
          onAdd={() => {
            const t = TYPES.B, id = Math.max(0, ...cabs.map(c => c.id)) + 1;
            setCabs(cs => [...cs, { id, type: 'B', w: '30', h: f(t.h), d: f(t.d), toe: f(t.toe), qty: '1', layout: null }]);
            select(id); setTab('config');
          }} />
      </div>

      {/* ============ REPORTS ============ */}
      <div data-reports="1" className="flex min-w-0 flex-[2_1_520px] flex-col gap-3.5">
        <div data-print-hide="1" className="flex flex-wrap items-center gap-1">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`border-0 border-b-2 bg-transparent px-3 py-2 text-sm font-bold hover:text-ink ${tab === k ? 'border-accent text-ink' : 'border-transparent text-muted'}`}>
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3">
            <div className="text-[13px] text-muted">{s.nParts} parts · {s.nFronts} fronts · {s.nDrawers} drawers · {s.sheets} sheets</div>
            <button onClick={() => { setPrinting(true); setTimeout(() => window.print(), 150); }}
              className="rounded-full border-none bg-accent px-4 py-[9px] text-sm font-bold text-white hover:bg-accent-dk">Print packet</button>
          </div>
        </div>

        {show('config') && (
          <Configurator cabs={cabs} built={result.cabs} d={result.d} f={f} selId={selCabId ?? null} selSec={selSec}
            onSelect={select} onSelectSec={setSelSec}
            onLayout={(id, layout: SectionInput[] | null) => upd(id, { layout })} />
        )}
        {show('cut') && <CutListReport {...ctx} />}
        {show('doors') && <DoorListReport {...ctx} />}
        {show('drawers') && <DrawerListReport {...ctx} />}
        {show('assembly') && <AssemblySheets {...ctx} />}
        {show('nest') && <NestSheets {...ctx} />}
        {show('install') && <InstallSheet {...ctx} />}
        {show('hardware') && <HardwareReport {...ctx} />}
      </div>
    </div>
  );
}
