// src/hooks/useHuddleToday.js
//
// Huddle S1 — THE READER OF TODAY'S HUDDLE RECORD (Amendment C V1.2 §C7, §C8; Command
// Center spec V1.2 Amendment D §D4). One reader, keyed by the owner's uid and auth epoch,
// living in the hub chunk (the hub's ConnectedHub calls it once; the mount guard's
// permitted map and NAMED list pin it), with a SINGLE service import.
//
// NO POLL and no read per tab switch. It reads (the status route, which reconciles on
// read) on these triggers only:
//   - mount, and a change of owner or auth epoch;
//   - `refresh()` — the sheet's open, and the hub's Retry;
//   - after confirm or skip;
//   - the page becoming visible again (`visibilitychange`), the one listener, removed on
//     unmount (registered in commandCenterHub.activity.guard.test.js).
// With `enabled` false (DRB_HUDDLE_ENABLED off) it reads nothing, registers nothing and
// stays `idle`. A read that fails keeps the last good answer, said "as of" its time — except
// a 404, the server's answer for a player outside the Huddle's cohort (Amendment E §E7): that
// is a settled `outside` answer, and the hub then shows exactly its flag-off self.

import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmHuddlePlan, fetchHuddleToday, skipHuddlePlan } from '../services/huddleService';

const IDLE = Object.freeze({ key: null, status: 'idle', huddle: null, asOf: null, error: null, refreshing: false });

/**
 * @param {{ auth: { uid?: string, authEpoch?: number, signedIn?: boolean } | null, enabled: boolean }} p
 * @returns {{ read: object, refresh: () => void, confirm: (args) => Promise<object>, skip: () => Promise<object> }}
 */
export default function useHuddleToday({ auth, enabled }) {
  const uid = enabled && auth?.signedIn === true && typeof auth.uid === 'string' ? auth.uid : null;
  const key = uid ? `${uid}:${auth.authEpoch ?? ''}` : null;
  const [read, setRead] = useState(IDLE);
  const keyRef = useRef(key);
  keyRef.current = key;
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    if (!key) return;
    const seq = ++seqRef.current;
    setRead((prev) => (prev.key === key ? { ...prev, refreshing: true } : { ...IDLE, key, status: 'loading' }));
    try {
      const body = await fetchHuddleToday();
      if (keyRef.current !== key || seq !== seqRef.current) return;
      setRead({ key, status: 'ready', huddle: body.huddle ?? null, asOf: body.asOf ?? new Date().toISOString(), error: null, refreshing: false });
    } catch (err) {
      if (keyRef.current !== key || seq !== seqRef.current) return;
      // E7: the status route's 404 is the cohort's (or the flag's) refusal — an answer, never an error to retry or keep
      if (err?.status === 404) { setRead({ ...IDLE, key, status: 'outside' }); return; }
      setRead((prev) => (prev.key === key && prev.status === 'ready'
        ? { ...prev, refreshing: false, error: err?.message || 'read_failed', stale: true }
        : { ...IDLE, key, status: 'error', error: err?.message || 'read_failed' }));
    }
  }, [key]);

  // Mount, owner or epoch change; and the page becoming visible again. Nothing else: no timer, no poll.
  useEffect(() => {
    if (!key) { setRead(IDLE); return undefined; }
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [key, load]);

  const etDate = read.huddle?.etDate ?? null;
  const confirm = useCallback(async ({ baseRevision, replacement, acknowledged = null }) => {
    if (!key || !etDate) return { ok: false, status: 0, body: { error: 'no_record' } };
    const r = await confirmHuddlePlan({ etDate, baseRevision, replacement, acknowledged });
    await load();
    return r;
  }, [key, etDate, load]);
  const skip = useCallback(async () => {
    if (!key || !etDate) return { ok: false, status: 0, body: { error: 'no_record' } };
    const r = await skipHuddlePlan({ etDate });
    await load();
    return r;
  }, [key, etDate, load]);

  return { read: read.key === key ? read : IDLE, refresh: load, confirm, skip };
}
