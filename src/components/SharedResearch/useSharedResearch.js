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
//
// THE THESIS BUILDER (B4 build prompt K-3, K-12, K-15, K-16) adds four actions,
// each through the same single `run` — a free tap included, never batched or
// queued (W-7: free taps share the 10-a-minute limit):
//   - openOwnWords: own words opened at once as a builder (DR-6), its requestId
//     kept for a retry of the same words;
//   - buildStep: `{ intent: 'build', goal, part?, direction? }`; Try again re-sends
//     the same stepId, goal and part;
//   - cardOp: one entry of `thesis.choices.free`, sent with the `rev` the player
//     saw; a 409 card_stale puts the fresh card on screen and is NEVER re-sent;
//   - adoptThesis: `{ sessionId, rev, statement? }`, with the uncertain save above.
// A retried tap after a lost answer (no answer, or a 5xx) re-sends the same opId
// or stepId with the same body. Every builder answer's `thesis` replaces the one
// held; a ledger answer has none, so a ledger investigation holds `thesis: null`.

import { useCallback, useEffect, useRef, useState } from 'react';
import * as service from '../../services/sharedResearchService';
import { SR_COPY } from './sharedResearchCopy';

/** The words for an answer that is not a success: the server's message, else its line for the code, else ours. */
export function failureOf(answer) {
  if (!answer || answer.network) return { code: 'network', message: SR_COPY.network };
  // 404 disabled carries no message: the gate is off for this player — the gated line, never "did not complete" (P-5).
  if (answer.gated) return { code: 'disabled', message: `${SR_COPY.gated}. ${SR_COPY.gatedSub}` };
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
  // the thesis builder's card (B4): every builder answer carries it; a ledger answer never does
  thesis: body.thesis !== undefined ? body.thesis : prior?.thesis ?? null,
  // B6c Q-4: only a GET on a saved thesis carries the list equip would replace; the key stays absent otherwise, so the
  // saved screen falls back to its equippedListLabel prop (screens/ThesisSaved.jsx)
  ...(body.equippedList !== undefined ? { equippedList: body.equippedList } : {}),
});

/** A request that may have reached the server without its answer reaching us: none came, or a 5xx. */
const lostAnswer = (answer) => Boolean(answer) && (answer.network === true || answer.status >= 500);

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
  // sessionId → the input of a save whose outcome is not known (K-8): it stays until "Check the record" answers, through
  // any navigation, so no Save can be sent for that investigation before the check.
  const uncertainRef = useRef(new Map());
  // The thesis builder (B4): each tap whose answer was lost, keyed by what it was (session, op or goal, part, value) —
  // its exact body, so tapping the same choice again re-sends the same opId or stepId (K-15). One entry per tap: another
  // request's answer never drops it (review 4B-1). And the own-words open being attempted: its words and its requestId,
  // apart from the previews' (review 4B-6).
  const lostRef = useRef(new Map());
  // investigations whose findings on screen are known stale (a step landed unheard) until a read answers (refuter 2)
  const unreadRef = useRef(new Set());
  const ownWordsRef = useRef(null);
  useEffect(() => {
    live.current = true; // StrictMode replays effects in development: the replay must not leave the sheet deaf (review b8)
    return () => { live.current = false; if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

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
      // A save still unconfirmed for THIS investigation stays unconfirmed: only the check decides it (K-8; review b1).
      const unsure = uncertainRef.current.get(sessionId);
      setSave(unsure ? { status: 'uncertain', input: unsure, sessionId } : { status: 'idle' });
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
      // A repeated request whose first framing is still running: not a failure (review a12); Try again asks once more.
      setFrameState({ requestId: id, observation, status: 'failed', sessionId: body.sessionId, frame: null });
      setFailure({ code: 'frame_pending', message: SR_COPY.framingStill, action: 'frame' });
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

  /** Back to idle — unless this investigation's save is still unconfirmed, which only the check may clear (K-8). */
  const resetSave = useCallback(() => {
    const sessionId = inv?.session?.sessionId;
    const unsure = sessionId ? uncertainRef.current.get(sessionId) : undefined;
    setSave(unsure ? { status: 'uncertain', input: unsure, sessionId } : { status: 'idle' });
  }, [inv]);

  /** A read outside `run` (after a save, after a stale preview): absorbed like any answer, and put on screen. */
  const reread = useCallback(async (sessionId) => {
    const fresh = await service.readInvestigation(sessionId);
    absorb(fresh);
    if (live.current && fresh.ok) setInv(investigationOf(fresh.body, null));
    return fresh;
  }, [absorb]);

  const adopt = useCallback(async (input) => {
    const sessionId = inv?.session?.sessionId;
    const previewRev = inv?.adoptPreview?.previewRev;
    if (!sessionId || typeof previewRev !== 'string') return null;
    // Check first (K-8): never a Save for an investigation whose last save is unconfirmed, whatever the screen shows.
    if (uncertainRef.current.has(sessionId) || saveRef.current.status === 'uncertain' || saveRef.current.status === 'checking') return null;
    const body = {
      sessionId, statement: input.statement, horizonEnum: input.horizonEnum, symbols: input.symbols,
      activation: input.activation, invalidation: input.invalidation,
      previewRev, // echoed exactly as the server sent it (spec §16 FQ-7)
    };
    setSave({ status: 'saving', input, sessionId });
    const answer = await run({ kind: 'adopt', sessionId }, () => service.adoptIdea(body));
    if (!answer) { setSave({ status: 'idle' }); return null; }
    const b = answer.body ?? {};
    if (answer.ok && typeof b.watchlistId === 'string') {
      setSave({ status: 'saved', input, sessionId, outcome: { watchlistId: b.watchlistId, idempotent: b.idempotent === true } });
      await reread(sessionId);
      return answer;
    }
    if (answer.network || answer.status >= 500) {
      uncertainRef.current.set(sessionId, input);
      setSave({ status: 'uncertain', input, sessionId });
      return answer;
    }
    if (b.error === 'preview_stale') {
      // The new preview's carried ids name findings the held record may not have: read the record with it (review a4/b2).
      const fresh = await reread(sessionId);
      if (!fresh.ok && b.adoptPreview) setInv((prior) => ({ ...prior, adoptPreview: b.adoptPreview }));
      setSave({ status: 'stale', input, sessionId, message: b.message ?? SR_COPY.previewChanged });
      return answer;
    }
    setSave({ status: 'failed', input, sessionId, message: failureOf(answer).message, code: b.error ?? null });
    return answer;
  }, [inv, run, reread]);

  /** "Check the record" (K-8): the one read that decides an uncertain save. Never a POST. */
  const checkSave = useCallback(async () => {
    const sessionId = inv?.session?.sessionId;
    if (!sessionId) return null;
    const before = saveRef.current;
    const input = uncertainRef.current.get(sessionId) ?? before.input;
    setSave({ status: 'checking', input, sessionId });
    const answer = await run({ kind: 'check', sessionId }, () => service.readInvestigation(sessionId));
    if (!answer) { setSave(before); return null; } // not sent (a 429's wait): nothing changed
    if (!answer.ok) {
      // No answer: "Couldn't reach the record"; a refusal (a 429) says why in the server's words (review a10).
      setSave({ status: 'uncertain', input, sessionId, checkFailed: true, message: answer.network ? null : failureOf(answer).message });
      return answer;
    }
    const b = answer.body;
    setInv(investigationOf(b, null));
    uncertainRef.current.delete(sessionId);
    if (b.record?.terminalReason === 'saved_to_list') {
      setSave({ status: 'recovered', input, sessionId, outcome: { watchlistId: b.session?.adoption?.watchlistId ?? null, idempotent: true } });
    } else if (b.record?.state === 'open') {
      setSave({ status: 'notsaved', input, sessionId });
    } else {
      // Closed some other way (concluded or discarded elsewhere): nothing was saved, and Save cannot run again.
      setSave({ status: 'closed', input, sessionId, message: SR_COPY.closedElsewhere });
    }
    return answer;
  }, [inv, run]);

  // ── the thesis builder (B4; Amendment B §B4) ─────────────────────────────────

  /**
   * A read through `run` (the refuter's R4): one request at a time, so no tap goes out while it is in flight and no
   * older answer can land over a newer card. What the server holds now is put on screen; a read that fails says so
   * (the work view draws a `read` failure; refuter 2).
   */
  const readInRun = useCallback(async (sessionId) => {
    const answer = await run({ kind: 'read', sessionId }, () => service.readInvestigation(sessionId));
    if (!answer || !live.current) return answer;
    if (answer.ok) setInv(investigationOf(answer.body, null));
    else setFailure({ ...failureOf(answer), action: 'read', sessionId });
    return answer;
  }, [run]);

  /**
   * Own words, opened at once as a thesis builder (DR-6; K-3): `{ entry: { kind: 'observation', observation }, requestId }`.
   * The same words tried again re-send the same requestId (the server answers the session it made); new words, a new one.
   * The answer is returned as received: a 400 invalid_entry (the mode rolled back, W-4) is the caller's to fall back on.
   */
  const openOwnWords = useCallback(async (observation) => {
    const held = ownWordsRef.current;
    const requestId = held && held.words === observation ? held.id : service.newRequestId();
    ownWordsRef.current = { words: observation, id: requestId };
    const answer = settleOpen(await run({ kind: 'open' }, () => service.openInvestigation({ entry: { kind: 'observation', observation }, requestId })));
    if (answer?.ok && answer.body?.session) ownWordsRef.current = null; // opened: the next start is a new investigation
    return answer;
  }, [run, settleOpen]);

  /**
   * One research step (§B4.2): `{ sessionId, stepId, intent: 'build', goal, part?, direction? }` — a goal the server
   * offered in `thesis.choices.research`, sent as offered. Try again passes the failed attempt's `stepId`; tapping the
   * same choice after a lost answer re-sends the same one (K-15).
   */
  const buildStep = useCallback(async ({ goal, part = null, direction = null, stepId = null }) => {
    const sessionId = inv?.session?.sessionId;
    if (!sessionId) return null;
    const key = JSON.stringify(['step', sessionId, goal, part, direction]);
    const lost = lostRef.current.get(key);
    // a lost step that has since landed on screen (its partner exchange is held) is done: a new tap is a new step
    const landed = Boolean(lost) && (inv?.session?.exchanges ?? []).some((e) => e?.who === 'partner' && e.stepId === lost.id);
    const id = stepId ?? (lost && !landed ? lost.id : service.newRequestId());
    const body = { sessionId, stepId: id, intent: 'build', goal, ...(part ? { part } : {}), ...(direction ? { direction } : {}) };
    const attempt = { builder: true, stepId: id, goal, part, direction };
    const answer = await run({ kind: 'step', sessionId, stepId: id, intent: 'build', goal, part }, () => service.takeStep(body));
    if (!answer) return null;
    const b = answer.body ?? {};
    if (answer.ok && b.session && !b.error) {
      lostRef.current.delete(key);
      setInv((prior) => investigationOf(b, prior));
      setStepOutcome({ stepId: id, summaryWithheld: false, cardChanged: b.changed?.card === true });
    } else {
      // a failed step answers the card as it stands (nothing landed); a refusal carries none
      if (b.session) setInv((prior) => ({ ...prior, session: b.session, ...(b.thesis !== undefined ? { thesis: b.thesis } : {}) }));
      // a lost answer, or 409 step_in_flight (this step may still be the one running), keeps the id for the same tap
      // (review 4B-2: B2 offers Try again on step_in_flight with the same stepId)
      if (lostAnswer(answer) || b.error === 'step_in_flight') lostRef.current.set(key, { id });
      else lostRef.current.delete(key);
      setFailure({ ...failureOf(answer), action: 'step', attempt });
    }
    return answer;
  }, [inv, run]);

  /**
   * One free tap (§B4.3): one entry of `thesis.choices.free`, sent back as offered — `{ op, part, value? }` — with the
   * card's `rev` the player saw and a fresh opId; `value` is the player's own input where the choice asks for one (the
   * ticked names, their words, the kept reasons, the price lines). A 409 card_stale draws the fresh card from the
   * answer with the server's line and sends nothing more (K-15). After a lost answer, the same tap re-sends the very
   * same body (opId and rev) only while the card on screen is still at that rev (the refuters' R1): the server checks an
   * applied opId first, then the rev, and revs only grow — so once the screen shows a later card, the lost tap has
   * either landed (its effect is on screen) or can never land, and the tap is a new one: a fresh opId, the rev now.
   */
  const cardOp = useCallback(async (choice, input) => {
    const sessionId = inv?.session?.sessionId;
    const rev = inv?.thesis?.rev;
    if (!sessionId || !choice || !Number.isSafeInteger(rev)) return null;
    const value = input !== undefined ? input : choice.value;
    const key = JSON.stringify(['card', sessionId, choice.op, choice.part, value ?? null]);
    const lost = lostRef.current.get(key);
    const body = lost && lost.body.rev === rev ? lost.body : {
      sessionId, opId: service.newRequestId(), rev, op: choice.op, part: choice.part, ...(value !== undefined && value !== null ? { value } : {}),
    };
    const answer = await run({ kind: 'card', sessionId, op: choice.op, part: choice.part }, () => service.applyCardOp(body));
    if (!answer) return null;
    const b = answer.body ?? {};
    if (answer.ok && b.thesis) {
      lostRef.current.delete(key);
      const held = inv?.session ?? null;
      setInv((prior) => ({ ...prior, session: b.session ?? prior?.session ?? null, thesis: b.thesis }));
      setStepOutcome(null);
      // A card answer carries no record (§4.3). When it shows a step landed that this page never heard back from (a lost
      // step answer), the findings on screen are stale: read the investigation again, through `run` (review 4B-7; R4).
      // A read that fails keeps the investigation marked, so the next card answer reads again (refuter 2).
      const now = b.session ?? null;
      const landedUnheard = Boolean(now && held && (now.stepsUsed !== held.stepsUsed || now.lastStep?.stepId !== held.lastStep?.stepId));
      if (landedUnheard || unreadRef.current.has(sessionId)) {
        unreadRef.current.add(sessionId);
        const fresh = await readInRun(sessionId);
        if (fresh?.ok) unreadRef.current.delete(sessionId);
      }
    } else if (b.error === 'card_stale' && b.thesis) {
      lostRef.current.delete(key);
      setInv((prior) => ({ ...prior, thesis: b.thesis }));
      setFailure({ ...failureOf(answer), action: 'card', stale: true });
    } else {
      if (lostAnswer(answer)) lostRef.current.set(key, { body });
      else lostRef.current.delete(key);
      setFailure({ ...failureOf(answer), action: 'card', attempt: { choice, input } });
    }
    return answer;
  }, [inv, run, readInRun]);

  /**
   * Save thesis (§B4.5): `{ sessionId, rev, statement? }` — the `rev` the player saw; `statement` only when the player
   * edited the sentence. The save's honest states are the ledger's (K-12): saving · saved · failed (the server's line;
   * `not_ready` with its blockers) · stale (the fresh card) · UNCERTAIN — then only "Check the record" (checkSave).
   */
  const adoptThesis = useCallback(async ({ statement = null } = {}) => {
    const sessionId = inv?.session?.sessionId;
    const rev = inv?.thesis?.rev;
    if (!sessionId || !Number.isSafeInteger(rev)) return null;
    if (uncertainRef.current.has(sessionId) || saveRef.current.status === 'uncertain' || saveRef.current.status === 'checking') return null;
    const input = { statement, rev };
    const body = { sessionId, rev, ...(typeof statement === 'string' ? { statement } : {}) };
    setSave({ status: 'saving', input, sessionId });
    const answer = await run({ kind: 'adopt', sessionId }, () => service.adoptIdea(body));
    if (!answer) { setSave({ status: 'idle' }); return null; }
    const b = answer.body ?? {};
    if (answer.ok && typeof b.watchlistId === 'string') {
      setSave({ status: 'saved', input, sessionId, outcome: { watchlistId: b.watchlistId, idempotent: b.idempotent === true } });
      if (b.thesis) setInv((prior) => ({ ...prior, thesis: b.thesis }));
      await readInRun(sessionId); // through `run`: nothing else (equip) goes out while it is in flight (refuter 2)
      return answer;
    }
    if (lostAnswer(answer)) {
      uncertainRef.current.set(sessionId, input);
      setSave({ status: 'uncertain', input, sessionId });
      return answer;
    }
    // A refusal speaks of one card: `atRev` is the rev the server judged, and the screen shows the refusal only while
    // that card is the one on screen (the refuter's R3) — a later change of the card retires it.
    if (b.error === 'card_stale' && b.thesis) {
      setInv((prior) => ({ ...prior, thesis: b.thesis }));
      setSave({ status: 'stale', input, sessionId, message: failureOf(answer).message, atRev: b.thesis.rev });
      return answer;
    }
    setSave({ status: 'failed', input, sessionId, message: failureOf(answer).message, code: b.error ?? null, blockers: Array.isArray(b.blockers) ? b.blockers : null, atRev: rev });
    // not_ready carries no card: read it (through `run`), so the card on screen is the one the server judged (review
    // 4B-3) — the server checks the rev before readiness, so that read holds the same rev. A read that finds a later
    // card (another writer) leaves the refusal unshown: the server never judged that card (refuter 2).
    if (b.error === 'not_ready') await readInRun(sessionId);
    return answer;
  }, [inv, run, readInRun]);

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
    // Build 3b (RU-18): the equip route's research_only_list refusal keeps its code, so the screen says why; every other
    // failure is answered as before
    setEquip(out.ok ? { status: 'done' } : out.error?.code === 'research_only_list' ? { status: 'failed', code: 'research_only_list' } : { status: 'failed' });
    return out;
  }, []);

  const clearFailure = useCallback(() => setFailure(null), []);

  return {
    gated, list, quota, inv, pending, failure, waiting, frameState, existing, stepOutcome, save, equip, epoch,
    running: pending?.kind === 'step' && pending.sessionId === inv?.session?.sessionId,
    loadList, loadSession, frame, retryFrame, editWords, beginPreview, openItem, openDrop, openFramed, acceptExisting,
    step, canRetry, close, adopt, checkSave, resetSave, equipNow, declineEquip, clearFailure,
    openOwnWords, buildStep, cardOp, adoptThesis,
  };
}
