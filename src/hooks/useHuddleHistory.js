// src/hooks/useHuddleHistory.js
//
// Huddle S1 — THE READER OF THE PLAN HISTORY for the Partnership panel and Recent activity
// (Amendment C V1.2 §C7, §C8; Command Center spec V1.2 Amendment D §D4, §D5, §D7). One
// reader, keyed by the owner's uid and auth epoch, in the hub chunk, with a SINGLE service
// import. It reads ONCE per owner and epoch (its mount) and again only on `refresh()` (the
// panel's Retry, a confirm or skip) — never per tab switch, never on a timer, no listener.
// With `enabled` false it reads nothing and stays `idle`. A failed refresh keeps the last
// good list, said "as of" its time.

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHuddleHistory } from '../services/huddleService';

const IDLE = Object.freeze({ key: null, status: 'idle', plans: null, asOf: null, error: null });

export default function useHuddleHistory({ auth, enabled }) {
  const uid = enabled && auth?.signedIn === true && typeof auth.uid === 'string' ? auth.uid : null;
  const key = uid ? `${uid}:${auth.authEpoch ?? ''}` : null;
  const [read, setRead] = useState(IDLE);
  const keyRef = useRef(key);
  keyRef.current = key;

  const load = useCallback(async () => {
    if (!key) return;
    setRead((prev) => (prev.key === key ? prev : { ...IDLE, key, status: 'loading' }));
    try {
      const plans = await fetchHuddleHistory({ uid: key.slice(0, key.lastIndexOf(':')) });
      if (keyRef.current !== key) return;
      setRead({ key, status: 'ready', plans, asOf: new Date().toISOString(), error: null });
    } catch (err) {
      if (keyRef.current !== key) return;
      setRead((prev) => (prev.key === key && prev.status === 'ready'
        ? { ...prev, error: err?.message || 'read_failed', stale: true }
        : { ...IDLE, key, status: 'error', error: err?.message || 'read_failed' }));
    }
  }, [key]);

  // Once per owner and epoch.
  useEffect(() => {
    if (!key) { setRead(IDLE); return; }
    load();
  }, [key, load]);

  return { read: read.key === key ? read : IDLE, refresh: load };
}
