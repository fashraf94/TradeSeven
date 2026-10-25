// src/components/CommandCenter/hub/useHubResearch.js
//
// Command Center hub, slice S6 (ruling R-S6-2; spec V1.2 §8.1) — the Research reader: the equipped list's idea, through the
// existing list reader `listHypothesisVersions(watchlistId)` (GET /api/forge/watchlists/{id}/hypothesis-versions). One
// default list request per trigger is the accepted existing-record path (§8.1); the hub passes no limit and invokes no writer.
//
//   useHubResearch({ auth, listId, gateOn }) → {
//     key, listId,   the captured uid + authEpoch + equipped list id, or null when there is nothing to read
//     status,        RESEARCH_READ: gate_off | idle | loading | ready | disabled | error
//     data,          the answer HELD for this key (it survives a failed refresh), or null
//     asOf,          when that answer was read (ms), for the "as of" note of a kept answer
//     refreshing,    a request is in flight over a held answer
//     retryNotBefore a Retry pressed inside the 30 s wait: when it opens (ms), else null
//     invalidate(),  a confirmed return (the watchlist sheet closed): read once more, even when the id is unchanged
//     retry(),       an explicit Retry, at most one per 30 s per key
//   }
//
// Reads happen on mount with a known list, on a list change, on `invalidate()`, and on an explicit Retry. There is no timer
// and no read per tab switch. The hub unmounts while the Forge shows, so a return from the Forge is a mount, which reads
// once (the sheet's return is the `invalidate()` the runtime calls beside its lists refresh).
//
// One request is in flight per key. A trigger that arrives during it marks it dirty, and ONE fresh read follows when it
// settles — however many triggers came. A request made for another key (an owner, epoch or list change) supersedes it: its
// answer is ignored, and nothing of the former key is ever shown (the view is the held state only while its key is the
// current one — judged in render, before any effect runs). The 30 s wait is enforced at the press, not by a timer.
//
// `gateOn` false (the client gate for idea records) reads nothing at all.

import { useCallback, useEffect, useRef, useState } from 'react';
import { listHypothesisVersions } from '../../../services/hypothesisVersionService';
import { RESEARCH_READ } from './researchView';

/** Spec §8.1: "Manual cooldown 30 seconds per key". */
export const RETRY_COOLDOWN_MS = 30_000;

const EMPTY = Object.freeze({ key: null, status: RESEARCH_READ.LOADING, data: null, asOf: null, refreshing: false, retryNotBefore: null });

/** The answer as the hub keeps it, or null when the response is not the list's own whole answer (then it is an error). */
function dataOf(body, listId) {
  if (!body || typeof body !== 'object' || body.watchlistId !== listId) return null;
  const { currentVersion, versions } = body;
  if (!Number.isInteger(currentVersion) || currentVersion < 0 || !Array.isArray(versions)) return null;
  return Object.freeze({
    currentVersion,
    // How many documents came back, before any is set aside: a page at the route's limit may be a cut one.
    versionCount: versions.length,
    versions: Object.freeze(versions.filter((v) => v && typeof v === 'object' && Number.isInteger(v.version) && v.version > 0)),
    research: Array.isArray(body.research) ? body.research : [],
    deployedLists: body.deployedLists && typeof body.deployedLists === 'object' ? body.deployedLists : {},
  });
}

/** A request that failed: the held answer of this key stays (with its age); a key with none is an error. */
const failedAt = (held, key) => (held.key === key ? { ...held, status: RESEARCH_READ.ERROR, refreshing: false } : { ...EMPTY, key, status: RESEARCH_READ.ERROR });

export default function useHubResearch({ auth, listId, gateOn }) {
  const uid = auth && auth.signedIn === true && typeof auth.uid === 'string' && auth.uid !== '' ? auth.uid : null;
  const id = typeof listId === 'string' && listId !== '' ? listId : null;
  const key = gateOn === true && uid && id ? `${uid}:${auth.authEpoch}:${id}` : null;

  const [state, setState] = useState(EMPTY);
  // The request in flight: its key, a sequence number (the newest request is the only one that may publish), and whether a
  // trigger came in during it.
  const flight = useRef({ key: null, seq: 0, inflight: false, dirty: false });
  const mounted = useRef(true);
  const waits = useRef(new Map());
  const current = useRef({ key, id });

  useEffect(() => { current.current = { key, id }; }, [key, id]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // `asTrigger`: a return or a Retry, which marks an in-flight request of the same key dirty. The key's own first read
  // (mount, list change) does not: it is the request itself, so a repeat of it (React's double effect) reads once.
  const start = useCallback((forKey, forId, asTrigger) => {
    const f = flight.current;
    if (f.key === forKey && f.inflight) {
      if (asTrigger) f.dirty = true;
      return;
    }
    f.key = forKey;
    f.inflight = true;
    f.dirty = false;
    f.seq += 1;
    const mine = f.seq;
    setState((held) => (held.key === forKey
      ? { ...held, refreshing: held.data !== null, status: held.data ? held.status : RESEARCH_READ.LOADING }
      : { ...EMPTY, key: forKey }));

    const followUp = () => {
      if (!flight.current.dirty) return;
      flight.current.dirty = false;
      start(forKey, forId, false);
    };
    listHypothesisVersions(forId).then(
      (body) => {
        if (!mounted.current || flight.current.seq !== mine) return;
        flight.current.inflight = false;
        const data = dataOf(body, forId);
        if (data) setState({ key: forKey, status: RESEARCH_READ.READY, data, asOf: Date.now(), refreshing: false, retryNotBefore: null });
        else setState((held) => failedAt(held, forKey));
        followUp();
      },
      (error) => {
        if (!mounted.current || flight.current.seq !== mine) return;
        flight.current.inflight = false;
        // The typed answer for an account the server does not admit: not an error, and not an empty list.
        if (error && error.code === 'disabled') {
          flight.current.dirty = false;
          setState({ ...EMPTY, key: forKey, status: RESEARCH_READ.DISABLED });
          return;
        }
        console.error('[CommandCenterHub] research read failed:', error);
        setState((held) => failedAt(held, forKey));
        followUp();
      },
    );
  }, []);

  useEffect(() => {
    if (!key) {
      // Nothing to ask about (the account, the list or the gate went): a request still out belongs to no one now and its answer
      // is ignored, and what was held is cleared, so a list found again is read afresh and shows nothing of the one before.
      flight.current = { key: null, seq: flight.current.seq + 1, inflight: false, dirty: false };
      setState(EMPTY);
      return;
    }
    start(key, id, false);
  }, [key, id, start]);

  const invalidate = useCallback(() => {
    const { key: k, id: i } = current.current;
    if (k) start(k, i, true);
  }, [start]);

  const retry = useCallback(() => {
    const { key: k, id: i } = current.current;
    if (!k) return;
    const now = Date.now();
    const last = waits.current.get(k);
    if (last !== undefined && now - last < RETRY_COOLDOWN_MS) {
      setState((held) => (held.key === k ? { ...held, retryNotBefore: last + RETRY_COOLDOWN_MS } : held));
      return;
    }
    waits.current.set(k, now);
    start(k, i, true);
  }, [start]);

  // Another key's answer never shows: it reads as nothing held, in the very render that brings the new key.
  const view = state.key === key ? state : null;
  let status = RESEARCH_READ.LOADING;
  if (gateOn !== true) status = RESEARCH_READ.GATE_OFF;
  else if (!key) status = RESEARCH_READ.IDLE;
  else if (view) status = view.status;
  return {
    key,
    listId: key ? id : null,
    status,
    data: view?.data ?? null,
    asOf: view?.asOf ?? null,
    refreshing: view?.refreshing === true,
    retryNotBefore: view?.retryNotBefore ?? null,
    invalidate,
    retry,
  };
}
