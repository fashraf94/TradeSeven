// src/hooks/useCockpitBench.js
//
// Cockpit Build 2b — THE BENCH READ for the bench sheet (spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md §4 "Bench rows", §5.7; the endpoint is
// api/agent/cockpit-bench.js, S-10). ONE fetch when the sheet opens — scoped
// to a call (`callId`) or browsing — and a fresh one on every reopen. No
// listener, no polling, no write.
//
//   loading   from the open until the answer arrives
//   ready     a 200 body { asOf, out, rows }, kept as read
//   error     anything else — no user, a refusal, a network failure, a
//             malformed body, no answer within COCKPIT_BENCH_TIMEOUT_MS; the
//             sheet says so and invents no row
//
// An answer that arrives after the sheet closed, or for an earlier opening, is
// dropped. Firebase auth: the static getAuth import the screen already makes
// (useCockpitStatus.js — a lazy import of the auth package costs the main
// chunk 69 KB).

import { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';

/** The route the server answers on. */
export const COCKPIT_BENCH_PATH = '/api/agent/cockpit-bench';
/** The sheet never waits on a hung request. */
export const COCKPIT_BENCH_TIMEOUT_MS = 8_000;

const IDLE = Object.freeze({ status: 'idle', data: null });

/** Ask once. Resolves to `{ status: 'ready', data }` or `{ status: 'error', data: null }`. Never throws. */
export async function requestCockpitBench({ battleId, callId = null }) {
  const abort = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = abort ? setTimeout(() => abort.abort(), COCKPIT_BENCH_TIMEOUT_MS) : null;
  try {
    const user = getAuth().currentUser;
    if (!user) return { status: 'error', data: null };
    const idToken = await user.getIdToken();
    const query = `battleId=${encodeURIComponent(battleId)}${callId ? `&callId=${encodeURIComponent(callId)}` : ''}`;
    const res = await fetch(`${COCKPIT_BENCH_PATH}?${query}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
      ...(abort ? { signal: abort.signal } : {}),
    });
    if (!res.ok) return { status: 'error', data: null };
    const body = await res.json().catch(() => null);
    if (!body || !Array.isArray(body.rows)) return { status: 'error', data: null };
    return { status: 'ready', data: body };
  } catch {
    return { status: 'error', data: null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * @param {object} p
 * @param {string|null} p.battleId
 * @param {string|null} p.callId    the scoped call, or null to browse
 * @param {boolean} p.open          the sheet is open — each false → true is a fresh read
 * @param {Function} [p.request]    injectable for tests; defaults to requestCockpitBench
 * @returns {{ status: 'idle'|'loading'|'ready'|'error', data: object|null }}
 */
export function useCockpitBench({ battleId, callId = null, open, request = requestCockpitBench }) {
  const [state, setState] = useState(IDLE);
  useEffect(() => {
    // Closed: back to idle — the same object, so a screen that never opens the sheet never re-renders for it.
    if (!open || !battleId) { setState(IDLE); return undefined; }
    let live = true;
    setState({ status: 'loading', data: null });
    Promise.resolve(request({ battleId, callId })).then((r) => {
      if (live) setState(r && r.status === 'ready' ? { status: 'ready', data: r.data } : { status: 'error', data: null });
    }, () => { if (live) setState({ status: 'error', data: null }); });
    return () => { live = false; };
  }, [open, battleId, callId, request]);
  return state;
}

export default useCockpitBench;
