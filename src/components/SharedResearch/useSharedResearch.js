// src/components/SharedResearch/useSharedResearch.js
//
// Shared Research — THE SHEET'S STATE AND ACTIONS (spec §7.1, §7.3; B2 build
// prompt K-5, K-6, K-8). Over src/services/sharedResearchService.js; the server's
// answers are the only source of what an investigation holds.
//
// HONESTY RULES this hook keeps (each pinned by a row):
//   - ONE request in flight at a time: a second action while one is pending is
//     dropped, so a double tap never sends two steps, two opens or two saves.
//     (The Continue list loads beside it and never blocks an action.)
//   - "running" is `pending` — a request this hook has sent and not yet heard
//     back from. A session's stored `lastStep.status: 'running'` is never shown as
//     running: a reopened sheet says "A step was in progress · Try again" (K-8).
//   - A retry re-sends the SAME id (stepId, requestId): the server answers a
//     completed step as a replay and an open as the session it made, so a retry
//     never doubles anything.
//   - Save has an UNCERTAIN state: no answer (network or the client timeout) or a
//     5xx. Then only "Check the record" (GET ?sessionId=) is offered: saved_to_list
//     → recovered; still open → nothing was created, Save may run again. adopt()
//     itself refuses to send while the save is uncertain (K-8: never a retry before
//     the check).
//   - A refusal shows the server's `message` (K-5); an answer without one (a failed
//     step or frame) shows the server's line held in SR_COPY.server (ruling P-5).
//   - A 429 shows its line and holds every action until Retry-After has passed.
//   - 404 disabled → gated, whatever the hub passed (K-3).

import { useCallback, useEffect, useRef, useState } from 'react';
import * as service from '../../services/sharedResearchService';
import { SR_COPY } from './sharedResearchCopy';

/** The words for an answer that is not a success: the server's message, else its line for the code, else ours. */
export function failureOf(answer) {
  if (!answer || answer.network) return { code: 'network', message: SR_COPY.network };
  const body = answer.body ?? {};
  if (body.error === 'step_failed') {
    return { code: 'step_failed', reason: body.reason ?? null, message: body.reason === 'findings_full' ? SR_COPY.server.findings_full : SR_COPY.server.step_failed };
  }
  if (body.error === 'frame_failed') return { code: 'frame_failed', reason: body.reason ?? null, message: SR_COPY.server.frame_failed };
  if (typeof body.message === 'string' && body.message) return { code: typeof body.error === 'string' ? body.error : 'refused', message: body.message };
  return { code: 'network', message: SR_COPY.network };
}

const investigationOf = (body, prior) => ({
  session: body.session ?? prior?.session ?? null,
  record: body.record !== undefined ? body.record : prior?.record ?? null,
  companies: body.companies ?? prior?.companies ?? { supported: [], leads: [] },
  // Only a GET carries the preview; any other answer leaves it out of date, so it is dropped until the next read.
  adoptPreview: body.adoptPreview !== undefined ? body.adoptPreview : null,
  storedRows: body.storedRows ?? body.opening?.storedRows ?? prior?.storedRows ?? [],
  previous: body.previous !== undefined ? body.previous : prior?.previous ?? null,
});

export default function useSharedResearch({ gated: gatedProp = false } = {}) {
  const [serverGated, setServerGated] = useState(false);
  const [list, setList] = useState({ status: 'idle', open: [] });
  const [quota, setQuota] = useState(null);
  const [inv, setInv] = useState(null);
  const [pending, setPending] = useState(null);
  const [failure, setFailure] = useState(null);
  const [retryAt, setRetryAt] = useState(null);
  const [frameState, setFrameState] = useState(null);
  const [existing, setExisting] = useState(false);
  const [stepOutcome, setStepOutcome] = useState(null);
  const [save, setSave] = useState({ status: 'idle' });
  const [equip, setEquip] = useState({ status: 'none' });
  // Bumped each time a DIFFERENT investigation is put on screen (an open, or a read of a session): the body's cue to show it.
  const [epoch, setEpoch] = useState(0);

  const pendingRef = useRef(null);
  const retryAtRef = useRef(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const live = useRef(true);
  const timerRef = useRef(null);
  const openIdRef = useRef(null); // the requestId of the open being attempted (re-sent on a retry)
  const targetsRef = useRef(new Map()); // stepId → the examine target sent with it (a Try again re-sends it)
  useEffect(() => () => { live.current = false; if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const gated = gatedProp || serverGated;
  const waiting = retryAt !== null;

  const absorb = useCallback((answer) => {
    if (!live.current) return;
    if (answer.gated) setServerGated(true);
    if (answer.body?.quota) setQuota(answer.body.quota);
    if (answer.status === 429 && answer.retryAfterS) {
      const until = Date.now() + answer.retryAfterS * 1000;
      retryAtRef.current = until;
      setRetryAt(until);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        retryAtRef.current = null;
        if (live.current) setRetryAt(null);
      }, answer.retryAfterS * 1000);
    }
  }, []);

  /** Send one request, unless one is already in flight or a 429's wait is running. */
  const run = useCallback(async (descriptor, send) => {
    if (pendingRef.current) return null;
    if (retryAtRef.current !== null && Date.now() < retryAtRef.current) return null;
    pendingRef.current = descriptor;
    setPending(descriptor);
    setFailure(null);
    let answer;
    try {
      answer = await send();
    } finally {
      pendingRef.current = null;
      if (live.current) setPending(null);
    }
    absorb(answer);
    return live.current ? answer : null;
  }, [absorb]);

  // ── reads ─────────────────────────────────────────────────────────────────────

  const loadList = useCallback(async () => {
    setList((l) => ({ ...l, status: 'loading' }));
    const answer = await service.listOpenInvestigations();
    absorb(answer);
    if (!live.current) return;
    if (answer.ok) setList({ status: 'ready', open: Array.isArray(answer.body?.open) ? answer.body.open : [] });
    else setList({ status: answer.gated ? 'ready' : 'failed', open: [] });
  }, [absorb]);

  const loadSession = useCallback(async (sessionId) => {
    const answer = await run({ kind: 'read', sessionId }, () => service.readInvestigation(sessionId));
    if (!answer) return null;
    if (answer.ok) {
      setInv(investigationOf(answer.body, null));
      setExisting(false);
      setStepOutcome(null);
      setSave({ status: 'idle' });
      setEquip({ status: 'none' });
      setEpoch((n) => n + 1);
    } else setFailure({ ...failureOf(answer), action: 'read', sessionId });
    return answer;
  }, [run]);

  // ── framing (spec §4.1 own words) ─────────────────────────────────────────────

  const frame = useCallback(async (observation, { requestId } = {}) => {
    const id = requestId ?? service.newRequestId();
    setFrameState({ requestId: id, observation, status: 'running', sessionId: null, frame: null });
    const answer = await run({ kind: 'frame' }, () => service.frameQuestion({ observation, requestId: id }));
    if (!answer) return null;
    const body = answer.body ?? {};
    if (answer.ok && body.frame) {
      setFrameState({ requestId: id, observation, status: 'framed', sessionId: body.sessionId, frame: body.frame });
    } else if (answer.ok && body.error !== 'frame_failed' && body.sessionId && !body.frame) {
      // A repeated request whose first framing is still running: nothing to show yet; Try again asks once more.
      setFrameState({ requestId: id, observation, status: 'failed', sessionId: body.sessionId, frame: null });
      setFailure({ ...failureOf({ body: { error: 'frame_failed' } }), action: 'frame' });
    } else if (body.error === 'frame_failed' || answer.network) {
      setFrameState({ requestId: id, observation, status: 'failed', sessionId: body.sessionId ?? null, frame: null });
      setFailure({ ...failureOf(answer), action: 'frame' });
    } else {
      // A refusal (a ceiling, a pause, the words): back to the box with the words kept.
      setFrameState(null);
      setFailure({ ...failureOf(answer), action: 'frame' });
    }
    return answer;
  }, [run]);

  const retryFrame = useCallback(() => (frameState ? frame(frameState.observation, { requestId: frameState.requestId }) : null), [frame, frameState]);

  /** "Edit my words": the framed session is closed (host only; nothing was opened) and the words go back to the box. */
  const editWords = useCallback(async () => {
    const words = frameState?.observation ?? '';
    const sessionId = frameState?.sessionId ?? null;
    setFrameState(null);
    setFailure(null);
    if (sessionId) await run({ kind: 'close', sessionId }, () => service.closeInvestigation({ sessionId, reason: 'abandoned' }));
    return words;
  }, [frameState, run]);

  // ── open (spec §4.1, §4.2) ───────────────────────────────────────────────────

  const settleOpen = useCallback((answer) => {
    if (!answer) return null;
    if (answer.ok && answer.body?.session) {
      openIdRef.current = null;
      setInv(investigationOf(answer.body, null));
      setExisting(answer.body.existing === true);
      setStepOutcome(null);
      setFrameState(null);
      setSave({ status: 'idle' });
      setEquip({ status: 'none' });
      setEpoch((n) => n + 1);
    } else {
      setFailure({ ...failureOf(answer), action: 'open', ...(answer.network ? { message: SR_COPY.networkOpen } : {}) });
    }
    return answer;
  }, []);

  /** A new preview starts a new request id; a retry of the same preview re-sends it. */
  const beginPreview = useCallback(() => { openIdRef.current = null; setFailure(null); setExisting(false); }, []);
  const requestIdForOpen = () => {
    if (!openIdRef.current) openIdRef.current = service.newRequestId();
    return openIdRef.current;
  };

  const openItem = useCallback(async ({ itemRef, question, direction }) => {
    const requestId = requestIdForOpen();
    const entry = { kind: 'item', itemRef: { recordKind: itemRef.recordKind, recordId: itemRef.recordId }, question, ...(direction ? { direction } : {}) };
    return settleOpen(await run({ kind: 'open' }, () => service.openInvestigation({ entry, requestId })));
  }, [run, settleOpen]);

  const openDrop = useCallback(async ({ dropId, question, direction }) => {
    const requestId = requestIdForOpen();
    const entry = { kind: 'signaldrop', itemRef: { recordKind: 'signalDrops', recordId: dropId }, question, ...(direction ? { direction } : {}) };
    return settleOpen(await run({ kind: 'open' }, () => service.openInvestigation({ entry, requestId })));
  }, [run, settleOpen]);

  const openFramed = useCallback(async ({ sessionId, question, direction }) => settleOpen(await run(
    { kind: 'open', sessionId },
    () => service.openInvestigation({ sessionId, question, ...(direction ? { direction } : {}) }),
  )), [run, settleOpen]);

  /** "Continue" on an `existing` answer: the investigation is already loaded. */
  const acceptExisting = useCallback(() => setExisting(false), []);

  // ── steps (spec §4.3) ────────────────────────────────────────────────────────

  const step = useCallback(async ({ intent, direction = null, target = null, stepId = null, label = null }) => {
    const sessionId = inv?.session?.sessionId;
    if (!sessionId) return null;
    const id = stepId ?? service.newRequestId();
    const sendTarget = target ?? targetsRef.current.get(id) ?? null;
    if (intent === 'examine' && sendTarget) targetsRef.current.set(id, sendTarget);
    const body = { sessionId, stepId: id, intent, ...(direction ? { direction } : {}), ...(intent === 'examine' && sendTarget ? { target: sendTarget } : {}) };
    const attempt = { stepId: id, intent, direction, target: sendTarget, label };
    const answer = await run({ kind: 'step', sessionId, stepId: id, intent, label }, () => service.takeStep(body));
    if (!answer) return null;
    const b = answer.body ?? {};
    if (answer.ok && b.session && !b.error) {
      setInv((prior) => investigationOf(b, prior));
      setStepOutcome({ stepId: id, summaryWithheld: b.changed?.summaryWithheld === true });
    } else {
      if (b.session) setInv((prior) => ({ ...prior, session: b.session }));
      setFailure({ ...failureOf(answer), action: 'step', attempt });
    }
    return answer;
  }, [inv, run]);

  /** Can this attempt be tried again with the same id? (an examine needs its target, which only this page life holds) */
  const canRetry = useCallback((attempt) => Boolean(attempt?.stepId) && (attempt.intent !== 'examine' || Boolean(attempt.target ?? targetsRef.current.get(attempt.stepId))), []);

  // ── endings (spec §4.5) ─────────────────────────────────────────────────────

  const close = useCallback(async (reason) => {
    const sessionId = inv?.session?.sessionId;
    if (!sessionId) return null;
    const answer = await run({ kind: 'close', sessionId, reason }, () => service.closeInvestigation({ sessionId, reason }));
    if (!answer) return null;
    if (answer.ok && answer.body?.session) setInv((prior) => investigationOf(answer.body, prior));
    else setFailure({ ...failureOf(answer), action: 'close', reason });
    return answer;
  }, [inv, run]);

  // ── adoption (spec §4.6; K-7, K-8) ───────────────────────────────────────────

  const resetSave = useCallback(() => setSave({ status: 'idle' }), []);

  const adopt = useCallback(async (input) => {
    const sessionId = inv?.session?.sessionId;
    const previewRev = inv?.adoptPreview?.previewRev;
    if (!sessionId || typeof previewRev !== 'string') return null;
    if (saveRef.current.status === 'uncertain' || saveRef.current.status === 'checking') return null; // check first (K-8)
    const body = {
      sessionId, statement: input.statement, horizonEnum: input.horizonEnum, symbols: input.symbols,
      activation: input.activation, invalidation: input.invalidation,
      previewRev, // echoed exactly as the server sent it (spec §16 FQ-7)
    };
    setSave({ status: 'saving', input });
    const answer = await run({ kind: 'adopt', sessionId }, () => service.adoptIdea(body));
    if (!answer) { setSave({ status: 'idle' }); return null; }
    const b = answer.body ?? {};
    if (answer.ok && typeof b.watchlistId === 'string') {
      setSave({ status: 'saved', input, outcome: { watchlistId: b.watchlistId, idempotent: b.idempotent === true } });
      const fresh = await service.readInvestigation(sessionId);
      if (live.current && fresh.ok) setInv(investigationOf(fresh.body, null));
      return answer;
    }
    if (answer.network || answer.status >= 500) {
      setSave({ status: 'uncertain', input });
      return answer;
    }
    if (b.error === 'preview_stale') {
      if (b.adoptPreview) setInv((prior) => ({ ...prior, adoptPreview: b.adoptPreview }));
      else {
        const fresh = await service.readInvestigation(sessionId);
        if (live.current && fresh.ok) setInv(investigationOf(fresh.body, null));
      }
      setSave({ status: 'stale', input, message: b.message ?? SR_COPY.previewChanged });
      return answer;
    }
    setSave({ status: 'failed', input, message: failureOf(answer).message, code: b.error ?? null });
    return answer;
  }, [inv, run]);

  /** "Check the record" (K-8): the one read that decides an uncertain save. Never a POST. */
  const checkSave = useCallback(async () => {
    const sessionId = inv?.session?.sessionId;
    if (!sessionId) return null;
    const input = saveRef.current.input;
    setSave({ status: 'checking', input });
    const answer = await run({ kind: 'check', sessionId }, () => service.readInvestigation(sessionId));
    if (!answer) { setSave({ status: 'uncertain', input }); return null; }
    if (!answer.ok) { setSave({ status: 'uncertain', input, checkFailed: true }); return answer; }
    const b = answer.body;
    setInv(investigationOf(b, null));
    if (b.record?.terminalReason === 'saved_to_list') {
      setSave({ status: 'recovered', input, outcome: { watchlistId: b.session?.adoption?.watchlistId ?? null, idempotent: true } });
    } else if (b.record?.state === 'open') {
      setSave({ status: 'notsaved', input });
    } else {
      // Closed some other way (concluded or discarded elsewhere): nothing was saved, and Save cannot run again.
      setSave({ status: 'closed', input, message: SR_COPY.closedElsewhere });
    }
    return answer;
  }, [inv, run]);

  // ── equip (K-9) ─────────────────────────────────────────────────────────────

  const declineEquip = useCallback(() => setEquip({ status: 'declined' }), []);
  const equipNow = useCallback(async ({ agentId, watchlistId }) => {
    if (!agentId || !watchlistId || pendingRef.current) return null;
    pendingRef.current = { kind: 'equip' };
    setPending(pendingRef.current);
    setEquip({ status: 'running' });
    let out;
    try {
      out = await service.equipIdea({ agentId, watchlistId });
    } finally {
      pendingRef.current = null;
      if (live.current) setPending(null);
    }
    if (!live.current) return null;
    setEquip(out.ok ? { status: 'done' } : { status: 'failed' });
    return out;
  }, []);

  const clearFailure = useCallback(() => setFailure(null), []);

  return {
    gated, list, quota, inv, pending, failure, waiting, frameState, existing, stepOutcome, save, equip, epoch,
    running: pending?.kind === 'step' && pending.sessionId === inv?.session?.sessionId,
    loadList, loadSession, frame, retryFrame, editWords, beginPreview, openItem, openDrop, openFramed, acceptExisting,
    step, canRetry, close, adopt, checkSave, resetSave, equipNow, declineEquip, clearFailure,
  };
}
