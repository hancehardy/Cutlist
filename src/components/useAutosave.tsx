'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState = 'saved' | 'saving' | 'error';

export const SAVE_TXT: Record<SaveState, [string, string]> = {
  saved: ['Saved', 'text-muted'],
  saving: ['Saving…', 'text-muted'],
  error: ['Not saved — retrying on next edit', 'text-danger'],
};

/** Debounced autosave: PUTs `doc` as JSON to `url`. Saves are chained so they land in order. */
export function useAutosave(url: string, doc: unknown) {
  const [state, setState] = useState<SaveState>('saved');
  const pending = useRef<unknown>(null);
  const chain = useRef(Promise.resolve());
  // The document as first rendered: nothing to save until it changes (also keeps dev strict mode's
  // double effect run from saving on mount).
  const initial = useRef(doc);

  const flush = useCallback(() => {
    chain.current = chain.current.then(async () => {
      const d = pending.current;
      if (!d) return;
      pending.current = null;
      try {
        const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
        if (!res.ok) throw new Error(String(res.status));
        setState(pending.current ? 'saving' : 'saved');
      } catch {
        pending.current = pending.current ?? d;
        setState('error');
      }
    });
    return chain.current;
  }, [url]);

  useEffect(() => {
    if (doc === initial.current) return;
    pending.current = doc;
    setState('saving');
    const t = setTimeout(flush, 600);
    return () => clearTimeout(t);
  }, [doc, flush]);

  // Don't lose the last keystrokes when the tab closes.
  useEffect(() => {
    const onHide = () => {
      if (!pending.current) return;
      fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending.current), keepalive: true });
      pending.current = null;
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [url]);

  return { state, flush };
}

export function SaveIndicator({ state }: { state: SaveState }) {
  const [txt, cls] = SAVE_TXT[state];
  return <div className={`text-xs ${cls}`} aria-live="polite">{txt}</div>;
}
