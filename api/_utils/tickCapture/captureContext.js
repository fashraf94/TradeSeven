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

import { STAGES } from './captureConfig.js';

/** battleId → live context awaiting finalization. */
const REGISTRY = new Map();

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
    manifest: guard((facts = {}) => { Object.assign(state.manifestFacts, facts); }),
    callEnvelope: guard((facts = {}) => { Object.assign(state.envelope, facts); }),
    validationErrors: guard((errors) => {
      if (Array.isArray(errors)) state.validationErrorTexts = errors.map((e) => String(e)).slice(0, 50);
    }),
    fault: guard((message) => { state.faulted = String(message).slice(0, 200); }),

    /** Stage B binds the request-local HTTP body holder here. */
    bindBodyHolder: guard((holder) => { state.bodyHolder = holder; }),
  };

  REGISTRY.set(battleId, ctx);
  return ctx;
}

/** Take the live context for a battle, removing it from the registry. */
export function claimTickCaptureContext(battleId) {
  const ctx = REGISTRY.get(battleId) || null;
  if (ctx) REGISTRY.delete(battleId);
  return ctx;
}

/**
 * Read the live context for a battle WITHOUT removing it. This is how the four
 * executor call sites that live inside helpers record their committed action
 * without a new parameter on four signatures — and without a seventh executor
 * caller. Read-only: only a finalizer claims.
 */
export function peekTickCaptureContext(battleId) {
  return REGISTRY.get(battleId) || null;
}

/** Drop a context without finalizing (the flag-off and test paths). */
export function releaseTickCaptureContext(battleId) {
  REGISTRY.delete(battleId);
}

/** Test-only visibility into the registry size — never read by product code. */
export function registrySizeForTests() {
  return REGISTRY.size;
}
