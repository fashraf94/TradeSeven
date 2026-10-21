// src/screens/battleView/useCockpit2bAnswer.js
//
// Cockpit Build 2b, flag on — THE ANSWER FLOW around the answer hook (spec
// docs/COCKPIT_BUILD2B_SPEC_V1_0.md §6, D-2, V5-6). One place, shared by the
// three surfaces an answer can come from: the V5 card (or an expanded chip),
// 2a's details sheet, and the bench sheet.
//
//   CONFIRM FIRST  an override (or a pick) while a live call-family command
//                  stands on ANOTHER call shows the replace confirmation on the
//                  surface it came from, before anything is sent (§6.3)
//   FROM A 409     `replace_unconfirmed` (a chat directive, or a slot this
//                  client had not seen) opens the same prompt from the body's
//                  `currentText`; a command whose call is loaded names its symbol
//   REPLACE        resends the same answer with `confirmReplace: true`
//   HELD           a `go` on an exit whose step is on the card (no counterpart)
//                  keeps that card as the Now card with its step (V5-6) until a
//                  pick, Done, or the call resolves; any filed name ends it
//
// Client state only, never persisted. The answer hook keeps the in-flight
// guard, the outcomes and the belief; this adds nothing to the request but the
// 2b keys the hook already carries.

import { useCallback, useState } from 'react';
import { needsReplaceConfirm } from './cockpit2bModel';

const nonEmpty = (v) => typeof v === 'string' && v.length > 0;

/**
 * @param {object} p
 * @param {(callId, answer, opts) => Promise<{status, body}|null>} p.submit  useCockpitAnswer().submit
 * @param {object|null} p.live     liveCommandOf(...) — the live call-family command, or null
 * @param {object[]} p.calls       the loaded call records (a 409's command names its symbol from them)
 */
export function useCockpit2bAnswer({ submit, live = null, calls = [] }) {
  const [confirm, setConfirm] = useState(null);
  const [heldKey, setHeldKey] = useState(null);

  const send = useCallback(async (target, callId, answer, { pickSymbol = null, confirmReplace = false } = {}) => {
    const result = await submit?.(callId, answer, { pickSymbol, confirmReplace });
    if (!result) return null;
    if (result.status === 409 && result.body?.reason === 'replace_unconfirmed') {
      const current = result.body;
      const currentCall = nonEmpty(current.currentCallId) ? (Array.isArray(calls) ? calls : []).find((c) => c?.callId === current.currentCallId) ?? null : null;
      setConfirm({
        ...target,
        callId,
        answer,
        pickSymbol,
        kind: nonEmpty(current.currentCallId) ? 'cockpit' : 'chat',
        symbol: currentCall ? (currentCall.kind === 'pick' ? currentCall.swapOut ?? null : currentCall.symbol ?? null) : null,
        text: current.currentText ?? null,
      });
      return result;
    }
    if (result.status !== 200) return result;
    setConfirm(null);
    if (answer === 'go' && target?.step === 'on_card' && nonEmpty(target?.key)) setHeldKey(target.key);
    if (nonEmpty(pickSymbol) || answer === 'go_now' || answer === 'replace') setHeldKey(null);
    return result;
  }, [submit, calls]);

  /** An answer from a surface: `override` answers (a directive, or a pick) confirm first when a command is live elsewhere. */
  const request = useCallback((target, callId, answer, { pickSymbol = null, override = false } = {}) => {
    if (override && needsReplaceConfirm(live, callId)) {
      setConfirm({ ...target, callId, answer, pickSymbol, kind: 'cockpit', symbol: live.symbol, text: live.text });
      return Promise.resolve(null);
    }
    return send(target, callId, answer, { pickSymbol });
  }, [live, send]);

  const replace = useCallback(() => {
    if (!confirm) return Promise.resolve(null);
    const { callId, answer, pickSymbol, kind: _k, symbol: _s, text: _t, ...target } = confirm;
    return send(target, callId, answer, { pickSymbol, confirmReplace: true });
  }, [confirm, send]);

  const keep = useCallback(() => setConfirm(null), []);
  const release = useCallback(() => setHeldKey(null), []);

  return { confirm, heldKey, request, replace, keep, release };
}

export default useCockpit2bAnswer;
