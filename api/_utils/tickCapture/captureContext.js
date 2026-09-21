// api/_utils/tickCapture/captureContext.js
//
// Tick capture — the REQUEST-LOCAL capture context (spec V1.3 §3, C-9).
//
// One object per admitted tick, created immediately after the admission
// transaction returns its committed `tickSeq`, filled at each stage the tick
// actually passes through, and finalized exactly once at the boundary C-9
// defines. It holds NO Firestore handle and is NEVER attached to the cached
// Anthropic client (Phase 0 Q1's explicit warning: "avoid a shared mutable
// 'latest request' on the cached client").
//
// NOTHING HERE THROWS. Every mutator is wrapped: a capture bug must cost the
// tick a RECORD, never a decision or a write. The one thing a mutator can do
// is set `ctx.faulted`, which the finalizer reports as a counted gap.
//
// FLAG OFF the factory returns the frozen NOOP below: same shape, every method
// inert, nothing registered, nothing allocated per tick. Call sites are
// therefore branch-free and the flag-off path allocates and writes nothing.
//
// THE REGISTRY exists for exactly one case (C-9): on an error exit the inner
// catch marks the context `tick_error` and the `finally` SKIPS capture, so the
// context must survive the throw for the OUTER handler to finalize after it
// writes its fault receipt. The context is therefore registered by battle id at
// creation and claimed — once — by whoever finalizes it. Battles are processed
// serially inside one invocation, so at most one context is live at a time;
// re-creating a context for the same battle drops any stale predecessor, so the
// map cannot grow.

import { AsyncLocalStorage } from 'node:async_hooks';
import { STAGES } from './captureConfig.js';

/**
 * THE TICK SCOPE (Astra round 1, F3). Capture state is bound to the TICK'S OWN
 * ASYNC CHAIN, never to a battle id and never to a module global.
 *
 * The previous design keyed a Map by battle id, so a second tick admitting the
 * same battle replaced the first's registration and either cleanup could then
 * remove or finalize the other's context. Two overlapping invocations in one
 * warm process were not isolated. An `AsyncLocalStorage` scope cannot have that
 * failure mode: a scope is reachable only from the async chain that created it,
 * so a tick can physically only see its own.
 *
 * A scope holds BOTH the capture context and the Stage B body holder, so the
 * fetch observer is scoped by exactly the same mechanism.
 */
const scopeStore = new AsyncLocalStorage();
let scopeSeq = 0;

const newScope = () => ({ id: ++scopeSeq, ctx: null, holder: null, claimed: false });

/** Run `fn` inside a fresh tick scope. The handler wraps each battle in one. */
export function runWithTickCaptureScope(fn) {
  return scopeStore.run(newScope(), fn);
}

/** Run `fn` inside a scope the caller already made (or plainly, when null). */
export function runInTickCaptureScope(scope, fn) {
  return scope ? scopeStore.run(scope, fn) : fn();
}

/** A scope the caller can hold a reference to — the handler's error path does. */
export function newTickCaptureScope() {
  return newScope();
}

/** The scope of the calling async chain, or null. */
export function currentCaptureScope() {
  return scopeStore.getStore() ?? null;
}

/**
 * The calling chain's scope, creating one if there is none. `enterWith` binds
 * it to THIS chain only, so a direct `processAgentBattle` call (the test path,
 * and any future caller that is not the handler) is still isolated from every
 * other chain in the process.
 */
export function ensureCaptureScope() {
  return scopeStore.getStore() ?? (() => { const fresh = newScope(); scopeStore.enterWith(fresh); return fresh; })();
}

/** The live context of the CALLING TICK, or the inert NOOP. */
export function currentTickCapture() {
  return scopeStore.getStore()?.ctx ?? NOOP_TICK_CAPTURE;
}

const STAGE_INDEX = new Map(STAGES.map((s, i) => [s, i]));

/** Structured-clone-ish deep copy of plain data; anything exotic passes through. */
export function copyPlain(value, depth = 0) {
  if (depth > 12) return null;
  if (Array.isArray(value)) return value.map((v) => copyPlain(v, depth + 1));
  if (value !== null && typeof value === 'object') {
    if (value.constructor !== Object && value.constructor !== undefined) return null;
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = copyPlain(v, depth + 1);
    return out;
  }
  if (typeof value === 'function' || typeof value === 'symbol') return null;
  return value;
}

const NOOP_METHODS = [
  'stage', 'exit', 'identify', 'check', 'universe', 'scores', 'model', 'guardrail', 'decision',
  'originalToolResult', 'finalToolResult', 'action', 'controls', 'controlsText',
  'manifest', 'callEnvelope', 'validationErrors', 'fault', 'bindBodyHolder',
  'controlSourceText', 'risk',
];

/** The inert context. Flag off, every call site runs against this. */
export const NOOP_TICK_CAPTURE = Object.freeze(
  NOOP_METHODS.reduce((o, name) => { o[name] = () => {}; return o; }, { enabled: false })
);

/**
 * @param {object} args
 * @param {string} args.battleId
 * @param {number} args.tickSeq   the COMMITTED sequence from the admission transaction
 * @returns a live context, or NOOP_TICK_CAPTURE when `enabled` is false
 */
export function createTickCaptureContext({
  battleId, tickSeq, agentId = null, ownerId = null, gameMode = null,
  enabled = false, startedAtMs = Date.now(),
} = {}) {
  if (!enabled || !battleId || !Number.isFinite(tickSeq)) return NOOP_TICK_CAPTURE;

  const state = {
    enabled: true,
    battleId,
    tickSeq,
    tickId: `${battleId}:${tickSeq}`,
    agentId,
    ownerId,
    gameMode,
    startedAtMs,
    evalId: null,
    day: null,
    battlePhase: null,
    stageReached: 'admitted',
    exitReason: null,
    faulted: null,

    universeSets: { heldSymbols: [], benchSymbols: [], candidateSymbols: [] },
    scoreFields: null,
    modelFacts: { outcome: 'not_attempted', failureClass: null, invalidField: null, timeoutKind: null, attempted: false, dispatched: false },
    modelFaultMessage: null,
    guardrailFacts: { faultClass: null, sourceNote: null, overrideCount: null },
    guardrailFaultMessage: null,
    decisionFacts: {},
    checks: {},
    actions: [],
    controlFacts: {},
    controlTexts: {},
    controlSourceTexts: {},
    riskFacts: {},
    manifestFacts: {},
    envelope: {},
    validationErrorTexts: [],
    originalTool: null,
    finalTool: null,
    bodyHolder: null,
  };

  const guard = (fn) => (...args) => {
    try { fn(...args); } catch (err) {
      if (!state.faulted) state.faulted = String(err?.message || err).slice(0, 200);
    }
  };

  const ctx = {
    get enabled() { return true; },
    state,

    stage: guard((name) => {
      const next = STAGE_INDEX.get(name);
      if (next === undefined) return;
      const cur = STAGE_INDEX.get(state.stageReached) ?? -1;
      if (next > cur) state.stageReached = name;
    }),

    exit: guard((reason) => { state.exitReason = reason; }),

    /** The tick's own identifiers, as the entry composed them. */
    identify: guard(({ evalId = null, day = null, battlePhase = null } = {}) => {
      if (evalId) state.evalId = evalId;
      if (day !== null && day !== undefined) state.day = String(day);
      if (battlePhase) state.battlePhase = battlePhase;
    }),

    /**
     * C-6 — record the outcome of a check the tick ACTUALLY ran. A check never
     * touched keeps its declared default (`not_evaluated`); nothing here calls
     * a validator, a picker or the risk manager to fill a value in.
     */
    check: guard((name, facts = {}) => {
      state.checks[name] = {
        status: facts.status ?? 'unknown',
        result: facts.result ?? null,
        stage: facts.stage ?? null,
        symbolOut: facts.symbolOut ?? null,
        symbolIn: facts.symbolIn ?? null,
        reason: facts.reason ?? null,
      };
    }),

    universe: guard((sets = {}) => {
      for (const key of ['heldSymbols', 'benchSymbols', 'candidateSymbols']) {
        if (Array.isArray(sets[key])) {
          state.universeSets[key] = [...new Set([...state.universeSets[key], ...sets[key].filter((s) => typeof s === 'string' && s)])];
        }
      }
    }),

    scores: guard((fields = {}) => { state.scoreFields = { ...fields }; }),

    model: guard((facts = {}) => {
      const { message, ...rest } = facts;
      Object.assign(state.modelFacts, rest);
      if (typeof message === 'string') state.modelFaultMessage = message;
    }),

    guardrail: guard((facts = {}) => {
      const { message, ...rest } = facts;
      Object.assign(state.guardrailFacts, rest);
      if (typeof message === 'string') state.guardrailFaultMessage = message;
    }),

    decision: guard((facts = {}) => { Object.assign(state.decisionFacts, facts); }),

    /** The model's proposal EXACTLY as returned, copied before any deterministic replacement. */
    originalToolResult: guard((result) => { if (state.originalTool === null) state.originalTool = copyPlain(result); }),

    /** What the tick finally acted on, after the deterministic layer may have replaced it. */
    finalToolResult: guard((result) => { state.finalTool = copyPlain(result); }),

    /**
     * C-10 — one entry per COMMITTED executor result, in execution order,
     * identified INSIDE the record as `${tickId}:${n}`. Collected at the
     * existing call sites; no new executor caller, and the trade entry the
     * executor wrote is not touched.
     */
    action: guard((facts = {}) => {
      const n = state.actions.length + 1;
      state.actions.push({
        actionId: `${state.tickId}:${n}`,
        n,
        kind: facts.kind ?? 'swap',
        source: facts.source ?? null,
        exitReason: facts.exitReason ?? null,
        symbolOut: facts.symbolOut ?? null,
        symbolIn: facts.symbolIn ?? null,
        swappedOutAt: facts.swappedOutAt ?? null,
        lockedPoints: facts.lockedPoints ?? null,
        entryPrice: facts.entryPrice ?? null,
        committed: facts.committed === true,
      });
    }),

    controls: guard((facts = {}) => { Object.assign(state.controlFacts, facts); }),
    controlsText: guard((texts = {}) => { Object.assign(state.controlTexts, copyPlain(texts) || {}); }),
    /** Source text that is NOT the rendered fragment, named so it cannot pose as one (F4). */
    controlSourceText: guard((texts = {}) => { Object.assign(state.controlSourceTexts, copyPlain(texts) || {}); }),
    /** C-7 (F5): the per-symbol risk verdicts and guardrail results the tick computed. */
    risk: guard((facts = {}) => { Object.assign(state.riskFacts, copyPlain(facts) || {}); }),
    manifest: guard((facts = {}) => { Object.assign(state.manifestFacts, facts); }),
    callEnvelope: guard((facts = {}) => { Object.assign(state.envelope, facts); }),
    validationErrors: guard((errors) => {
      if (Array.isArray(errors)) state.validationErrorTexts = errors.map((e) => String(e)).slice(0, 50);
    }),
    fault: guard((message) => { state.faulted = String(message).slice(0, 200); }),

    /** Stage B binds the request-local HTTP body holder here. */
    bindBodyHolder: guard((holder) => { state.bodyHolder = holder; }),
  };

  // Bound to THIS tick's async chain — nothing is keyed by battle id, so no
  // other tick can reach it and no other tick's cleanup can take it.
  ensureCaptureScope().ctx = ctx;
  return ctx;
}

/**
 * Claim a scope's context for finalization. IDENTITY-CHECKED and ONCE-ONLY: a
 * caller can only claim the scope it was handed, and a context already claimed
 * (by the tick's own `finally`) is never handed out again to the handler's
 * error path. Returns null when there is nothing of this scope's own to do.
 */
export function claimTickCaptureContext(scope) {
  if (!scope || scope.claimed || !scope.ctx) return null;
  scope.claimed = true;
  return scope.ctx;
}

/** Mark a scope's context finalized without taking it (the normal exit path). */
export function markTickCaptureClaimed(scope) {
  if (scope) scope.claimed = true;
}
