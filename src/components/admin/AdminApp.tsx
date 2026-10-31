'use client';
import { useState } from 'react';
import Link from 'next/link';
import { defaultShopConfig, type ShopConfig } from '@/lib/shop';
import { SaveIndicator, useAutosave } from '../useAutosave';
import { MethodsEditor } from './MethodsEditor';
import { OptionsEditor } from './OptionsEditor';
import { BoxesEditor } from './BoxesEditor';
import { UsersEditor } from './UsersEditor';
import { UserMenu } from '../auth/UserMenu';
import type { User } from '@/lib/db';

type Tab = 'materials' | 'methods' | 'boxes' | 'users';
const TABS: [Tab, string][] = [['materials', 'Materials & hardware'], ['methods', 'Construction methods'], ['boxes', 'Cabinet boxes'], ['users', 'Users']];

export type Update = (fn: (c: ShopConfig) => ShopConfig) => void;

/** Admin page: shop-wide choices and construction methods, autosaved to /api/shop. */
export function AdminApp({ initial, skuImages, users, me }: { initial: ShopConfig; skuImages: string[]; users: User[]; me: { id: string; username: string; role: 'admin' | 'user' } }) {
  const [cfg, setCfg] = useState(initial);
  const [tab, setTab] = useState<Tab>('materials');
  const save = useAutosave('/api/shop', cfg);
  const update: Update = fn => setCfg(fn);

  const restore = () => {
    if (!window.confirm('Restore the built-in materials, choices, saw settings, method and cabinet boxes? Everything on this page is replaced. Jobs keep their own materials and rules; the saw settings apply to all of them.')) return;
    setCfg(defaultShopConfig());
  };

  return (
    <div className="box-border flex min-h-screen flex-col gap-5 p-5">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4">
        <div className="flex items-center gap-3">
          <img src="/assets/logo-mark.png" alt="" className="h-[34px] w-[34px] object-contain" />
          <div className="text-[22px] font-extrabold tracking-[-0.01em]">Cutlist</div>
          <div className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-extrabold tracking-[0.12em] text-white uppercase">Admin</div>
          <SaveIndicator state={save.state} />
          <UserMenu user={me} admin />
          <Link href="/" className="text-[13px] font-bold">← Back to jobs</Link>
        </div>

        <div className="flex flex-col gap-1">
          <div className="eyebrow">Shop settings</div>
          <div className="text-2xl font-extrabold tracking-[-0.01em]">Materials, methods and cabinet boxes</div>
          <div className="text-sm text-ink-3">
            What the job setup page offers. Materials, hardware and methods are copied into a job when it is set up; the panel saw settings apply to every job right away.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-line" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`-mb-px border-0 border-b-2 bg-transparent px-3 py-2 text-sm font-bold hover:text-ink ${tab === k ? 'border-accent text-ink' : 'border-transparent text-muted'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'materials' && <OptionsEditor cfg={cfg} update={update} />}
        {tab === 'methods' && <MethodsEditor cfg={cfg} update={update} />}
        {tab === 'boxes' && <BoxesEditor cfg={cfg} update={update} skuImages={skuImages} />}
        {tab === 'users' && <UsersEditor initial={users} me={me} />}

        <div className="flex items-center gap-3 border-t border-line-2 pt-4 pb-6 text-xs text-muted">
          <div>Choices and methods are shared by everyone using this database.</div>
          <button onClick={restore} className="ml-auto border-none bg-transparent p-0 text-xs font-semibold text-muted hover:text-danger hover:underline">
            Restore built-in defaults
          </button>
        </div>
      </div>
    </div>
  );
}
