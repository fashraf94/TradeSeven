// src/hooks/useCockpitStatus.js
//
// Cockpit Build 2a — IS THIS BATTLE COCKPIT-ON? (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md §4, S-6; ruling R2A-7.)
//
// THE CLIENT NEVER DECIDES (the useBackingLit precedent). It holds no
// allowlist and never recomputes the calls mode from bundled constants: it
// asks GET /api/agent/cockpit-status, which answers for the caller's own
// battle, and renders the answer.
//
//   runs        only while `enabled` — the screen passes isCockpitUiOn() AND
//               an active battle; disabled, nothing is requested at all
//   re-runs     when the battle's status changes, and on `recheck()` (the
//               screen calls it after any 404 cockpit_unavailable)
//   reads off   until `{ on: true }` arrives; every error, non-200 and
//               malformed body reads off — so the layout never changes on
//               a guess
//
// Firebase auth is the static getAuth import AgentBattleScreen.jsx (this
// hook's one consumer) already makes. A lazy import('firebase/auth') here
// defeated tree-shaking of the auth package — measured +69 KB on the main
// chunk for every user, flag on or off — so the precedent is the screen's,
// not useMasteryProfile's lazy firestore pair.

import { useCallback, useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';

/** The route the server answers on. */
export const COCKPIT_STATUS_PATH = '/api/agent/cockpit-status';
/** An answer that has not come in this long reads off — the screen never waits on a hung request. */
export const COCKPIT_STATUS_TIMEOUT_MS = 8_000;

/**
 * Ask the server once. Resolves to `true` only for a 200 `{ on: true }`;
 * anything else — no user, a refusal, a network failure, a malformed body, no
 * answer within COCKPIT_STATUS_TIMEOUT_MS — resolves to `false`. Never throws.
 */
export async function requestCockpitStatus(battleId) {
  const abort = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = abort ? setTimeout(() => abort.abort(), COCKPIT_STATUS_TIMEOUT_MS) : null;
  try {
    const user = getAuth().currentUser;
    if (!user) return false;
    const idToken = await user.getIdToken();
    const res = await fetch(`${COCKPIT_STATUS_PATH}?battleId=${encodeURIComponent(battleId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
      ...(abort ? { signal: abort.signal } : {}),
    });
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    return body?.on === true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * @param {string|null} battleId
 * @param {{ enabled: boolean, battleStatus?: string|null }} options
 * @returns {{ on: boolean, pending: boolean, recheck: () => void }}
 *   `pending`: asked, and no answer for THIS battle yet — the screen holds the
 *   chat's seen-marker meanwhile (the first paint is the off layout)
 */
export function useCockpitStatus(battleId, { enabled = false, battleStatus = null } = {}) {
  const [answer, setAnswer] = useState({ battleId: null, on: false });
  const [nonce, setNonce] = useState(0);
  const wanted = Boolean(enabled && typeof battleId === 'string' && battleId);

  useEffect(() => {
    if (!wanted) {
      // Already idle → the SAME state object, so a disabled hook never adds a
      // render (the flag-off screen renders exactly as many times as before).
      setAnswer((prev) => (prev.battleId === null && prev.on === false ? prev : { battleId: null, on: false }));
      return undefined;
    }
    let cancelled = false;
    requestCockpitStatus(battleId).then((on) => {
      if (!cancelled) setAnswer({ battleId, on });
    });
    return () => { cancelled = true; };
  }, [wanted, battleId, battleStatus, nonce]);

  const recheck = useCallback(() => setNonce((n) => n + 1), []);
  // Only an answer for THIS battle counts, and only while the gate is open.
  return {
    on: wanted && answer.battleId === battleId && answer.on === true,
    pending: wanted && answer.battleId !== battleId,
    recheck,
  };
}

export default useCockpitStatus;
