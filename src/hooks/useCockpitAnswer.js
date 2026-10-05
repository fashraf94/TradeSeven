// src/hooks/useCockpitAnswer.js
//
// Cockpit Build 2a — ANSWERING A CALL from a tile (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md §7.3, §8.3). POST /api/agent/call-response
// with { battleId, callId, answer, expectedDirectiveThreadId }.
//
//   NO OPTIMISTIC STATE. A tap disables both buttons and marks the pressed one
//   as sending until the response arrives; the tile itself changes only when
//   the listener delivers the record the server wrote.
//   THE BODY IS READ on every failure (never the chip's status-only mapper):
//   the outcome { status, body } is kept per call, and the screen renders one
//   plain line for it (battleViewCopy.js cockpitRefusalLine) — until the
//   screen drops it, once no tile shows the line (dropOutcomes).
//   THE BELIEF is the subscribed battle.directive.directiveThreadId — except
//   after a 409 belief_mismatch, when the server's currentDirectiveThreadId is
//   adopted until the subscription moves past the value it corrected; the
//   adoption is then DROPPED (and it never crosses battles), so a slot that
//   later returns to the corrected value is read fresh (review L3-3).
//   A 404 cockpit_unavailable asks the screen to re-run the status check.
//
// Firebase auth: the static getAuth import the screen already makes (see
// useCockpitStatus.js — a lazy import of the auth package costs the main
// chunk 69 KB).

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuth } from 'firebase/auth';

export const CALL_RESPONSE_PATH = '/api/agent/call-response';

/**
 * Send one answer. Resolves to `{ status, body }` — `status: null` when no
 * response arrived at all. Never throws.
 */
export async function postCallAnswer({ battleId, callId, answer, expectedDirectiveThreadId }) {
  try {
    const user = getAuth().currentUser;
    if (!user) return { status: 401, body: null };
    const idToken = await user.getIdToken();
    const res = await fetch(CALL_RESPONSE_PATH, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ battleId, callId, answer, expectedDirectiveThreadId }),
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch {
    return { status: null, body: null };
  }
}

/**
 * @param {object} p
 * @param {string|null} p.battleId
 * @param {string|null} p.subscribedThreadId  battle.directive?.directiveThreadId ?? null, from the listener
 * @param {() => void} [p.onUnavailable]       the status re-check (404 cockpit_unavailable)
 * @param {Function} [p.post]                  injectable for tests; defaults to postCallAnswer
 */
export function useCockpitAnswer({ battleId, subscribedThreadId = null, onUnavailable = null, post = postCallAnswer }) {
  const [pending, setPending] = useState(null);       // { callId, answer } | null
  const [outcomes, setOutcomes] = useState({});       // callId → { status, body, at, callId }
  const [override, setOverride] = useState(null);     // { value, basis, battleId } | null
  const inFlight = useRef(false);

  // The adopted belief holds only while the subscription still shows the value
  // it corrected, on the battle it was adopted on.
  const holds = Boolean(override) && override.basis === subscribedThreadId && override.battleId === battleId;
  const belief = holds ? override.value : subscribedThreadId;
  useEffect(() => {
    if (override && !holds) setOverride(null);
  }, [override, holds]);

  const submit = useCallback(async (callId, answer) => {
    if (inFlight.current || !battleId || !callId || !answer) return;
    inFlight.current = true;
    setPending({ callId, answer });
    setOutcomes((prev) => { if (!(callId in prev)) return prev; const next = { ...prev }; delete next[callId]; return next; });
    const { status, body } = await post({ battleId, callId, answer, expectedDirectiveThreadId: belief ?? null });
    inFlight.current = false;
    setPending(null);
    if (status === 200) return;
    setOutcomes((prev) => ({ ...prev, [callId]: { status, body, at: Date.now(), callId } }));
    if (status === 409 && body?.reason === 'belief_mismatch' && Object.prototype.hasOwnProperty.call(body, 'currentDirectiveThreadId')) {
      setOverride({ value: body.currentDirectiveThreadId ?? null, basis: subscribedThreadId, battleId });
    }
    if (status === 404 && body?.error === 'cockpit_unavailable' && typeof onUnavailable === 'function') onUnavailable();
  }, [battleId, belief, post, subscribedThreadId, onUnavailable]);

  // A refusal line clears for good once the record behind its tile changes or
  // the call leaves the feed: the screen names the outcomes no tile shows any
  // more (cockpitModel staleRefusalIds) and they are dropped here, so none
  // comes back on a tile that resurfaces (founder ruling Oct 5).
  const dropOutcomes = useCallback((callIds) => {
    if (!Array.isArray(callIds) || callIds.length === 0) return;
    setOutcomes((prev) => {
      if (!callIds.some((id) => Object.prototype.hasOwnProperty.call(prev, id))) return prev;
      const next = { ...prev };
      for (const id of callIds) delete next[id];
      return next;
    });
  }, []);

  return { pending, outcomes, submit, belief, dropOutcomes };
}

export default useCockpitAnswer;
