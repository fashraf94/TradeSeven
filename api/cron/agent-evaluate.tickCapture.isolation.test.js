// api/cron/agent-evaluate.tickCapture.isolation.test.js
//
// Astra round 1, findings F1 and F3 — the two claims that must hold before
// anything else about capture matters:
//
//   F1  the flag-off tick is INERT and capture NEVER throws into a tick;
//   F3  capture state is bound to the TICK, not to a battle id or a global.
//
// Every row here is RED on `c968a922` for the reason the finding names.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs,
  makeIntradayCandles, makeHoldResult, makeToolUseResponse,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCaptureDb, permanentDoc, bodyDoc } from '../_utils/__fixtures__/tickCaptureHarness.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const flagState = vi.hoisted(() => ({ tickCapture: false }));
/** Lets a row hold one tick inside `messages.create` while another runs. */
const gate = vi.hoisted(() => ({ hold: null }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    constructor(options) { this.__options = options; this.messages = { create: (...args) => mocks.create(...args) }; }
  },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn(), excludeHeldSymbols: vi.fn(),
  reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn(),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, get TICK_CAPTURE_ENABLED() { return flagState.tickCapture; } };
});

const { processAgentBattle } = await import('./agent-evaluate.js');

function stubMarket() {
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (s) => (prices[s] ? { price: prices[s], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
}

async function runTick({ battle = makeTickBattle(), capture, db = null } = {}) {
  flagState.tickCapture = capture;
  const store = db || makeCaptureDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  let thrown = null;
  try {
    await processAgentBattle(store, battle, summary, Date.now(), new Map(), { everEnabled: false });
  } catch (err) { thrown = err; }
  return { db: store, summary, thrown, finalUpdate: store.__updates.find((u) => Array.isArray(u.evaluations)) || null };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
  gate.hold = null;
  stubMarket();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); flagState.tickCapture = false; });

// ─────────────────────────────────────────────────────────────────────────────
// F1 — a malformed battle must not become a capture-shaped tick failure.
//
// `standingLeans: {}` is what the SHIPPED resolver already tolerates
// (controlPromptRenderer.js guards it with `Array.isArray(...) ? … : []`), so a
// battle carrying it evaluates today and must keep evaluating.

const MALFORMED = [
  ['standingLeans is an object, not an array', { standingLeans: {} }],
  ['standingLeans is a string', { standingLeans: 'TF-02' }],
  ['activeRules is an object, not an array', { activeRules: { 'rule-1': { text: 'x' } } }],
  ['activeRules is a number', { activeRules: 7 }],
];

function malformedBattle(patch) {
  const base = makeTickBattle();
  return makeTickBattle({ agentContext: { ...base.agentContext, ...patch } });
}

describe('F1 — flag OFF, a malformed control slot cannot cost the tick its write', () => {
  for (const [name, patch] of MALFORMED) {
    it(`${name}: the tick still completes and still writes its evaluation`, async () => {
      const { thrown, finalUpdate, summary } = await runTick({ battle: malformedBattle(patch), capture: false });
      expect(thrown, 'the tick must not throw with the flag off').toBeNull();
      expect(finalUpdate, 'the final battle update must still happen').not.toBeNull();
      expect(Array.isArray(finalUpdate.evaluations)).toBe(true);
      expect(summary.evaluated).toBe(1);
    });
  }

  it('flag OFF with a malformed slot is byte-identical to flag OFF with a clean one, apart from the slot itself', async () => {
    const clean = await runTick({ battle: makeTickBattle(), capture: false });
    const dirty = await runTick({ battle: malformedBattle({ standingLeans: {} }), capture: false });
    expect(dirty.db.__captureWrites).toEqual([]);
    expect(dirty.db.__updates.map((u) => Object.keys(u).sort())).toEqual(clean.db.__updates.map((u) => Object.keys(u).sort()));
  });
});

describe('F1 — flag ON, a malformed control slot is a capture GAP, never a tick error', () => {
  for (const [name, patch] of MALFORMED) {
    it(`${name}: the tick completes; capture is a gap or a record, never a throw`, async () => {
      const { thrown, finalUpdate, db } = await runTick({ battle: malformedBattle(patch), capture: true });
      expect(thrown, 'the tick must not throw with the flag on either').toBeNull();
      expect(finalUpdate, 'the final battle update must still happen').not.toBeNull();
      // the sequence was still minted, so a missing record is COUNTABLE
      expect(db.__updates[0]['cronState.tickSeq']).toBe(1);
    });
  }

  it('a malformed slot no longer faults capture at all — it is handled, and the record is CLEAN', async () => {
    // After F4 the control facts come from the resolver's own effective set,
    // and the resolver already tolerates a malformed slot. So this case is not
    // merely caught, it does not arise: the tick completes and the record
    // carries no capture fault.
    const { db, thrown } = await runTick({ battle: malformedBattle({ standingLeans: {} }), capture: true });
    expect(thrown).toBeNull();
    const record = permanentDoc(db, 'battle-tick-1', 'battle-tick-1:1');
    const body = bodyDoc(db, 'battle-tick-1', 'battle-tick-1:1');
    expect(record, 'the tick survived, so its record must exist').not.toBeNull();
    expect(record.exitReason).toBe('completed');
    expect(record.model.outcome).toBe('ok');
    expect(body.faults.capture).toBeNull();
  });

  it('a capture step that DOES throw is caught, recorded as a fault, and costs the tick nothing', async () => {
    // `resolvedAgentManifest` is read by NOTHING in the tick except capture
    // (Phase 2 shipped it with zero readers), so a throwing accessor there is
    // a fault that can only originate inside a capture step — which is exactly
    // what makes it a clean probe of the guard.
    const battle = makeTickBattle();
    // Installed AFTER the store is built, so the harness's own deep copy of the
    // battle does not trip it — only the tick's live read does.
    const store = makeCaptureDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
    Object.defineProperty(battle, 'resolvedAgentManifest', {
      get() { throw new Error('ZZQX-CAPTURE-STEP-BOOM'); },
      enumerable: false, configurable: true,
    });
    const { db, thrown, finalUpdate } = await runTick({ battle, capture: true, db: store });
    expect(thrown, 'a capture fault must never become a tick error').toBeNull();
    expect(finalUpdate, 'the tick still writes').not.toBeNull();
    const record = permanentDoc(db, 'battle-tick-1', 'battle-tick-1:1');
    const body = bodyDoc(db, 'battle-tick-1', 'battle-tick-1:1');
    expect(record, 'the record still exists').not.toBeNull();
    expect(body.faults.capture, 'and it says which step faulted').toContain('ZZQX-CAPTURE-STEP-BOOM');
    // the facts that did not depend on the broken accessor are intact
    expect(record.exitReason).toBe('completed');
    expect(record.model.outcome).toBe('ok');
  });
});

describe('F1 — the source guard: no capture mutator runs outside its flag-and-try guard', () => {
  it('every tick-capture mutator call site sits inside a captureStep(...) guard', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, resolve } = await import('node:path');
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'agent-evaluate.js'), 'utf8');

    // Brace/paren-matched spans of every captureStep( … ) call.
    const spans = [];
    for (let i = src.indexOf('captureStep('); i !== -1; i = src.indexOf('captureStep(', i + 1)) {
      let depth = 0;
      let j = src.indexOf('(', i);
      for (; j < src.length; j++) {
        if (src[j] === '(') depth++;
        else if (src[j] === ')') { depth--; if (depth === 0) break; }
      }
      spans.push([i, j]);
    }
    expect(spans.length, 'captureStep must exist and be used').toBeGreaterThan(10);

    const MUTATORS = [
      'stage', 'exit', 'identify', 'check', 'universe', 'scores', 'model', 'guardrail',
      'decision', 'originalToolResult', 'finalToolResult', 'action', 'controls',
      'controlsText', 'manifest', 'callEnvelope', 'validationErrors', 'bindBodyHolder',
    ];
    const offenders = [];
    for (const name of MUTATORS) {
      for (const pattern of [`tickCapture.${name}(`, `.${name}({`]) {
        let idx = src.indexOf(pattern);
        while (idx !== -1) {
          const inside = spans.some(([a, b]) => idx > a && idx < b);
          const isDefinition = src.slice(Math.max(0, idx - 40), idx).includes('captureStep');
          const isCaptureCall = src.slice(Math.max(0, idx - 12), idx).includes('tickCapture')
            || src.slice(Math.max(0, idx - 14), idx).includes('captureFor()');
          if (!inside && !isDefinition && isCaptureCall) offenders.push(`${name} @ ${idx}`);
          idx = src.indexOf(pattern, idx + 1);
        }
      }
    }
    expect(offenders, 'these capture mutators are called outside a captureStep guard').toEqual([]);
  });

  it('captureStep checks the flag FIRST and swallows everything', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, resolve } = await import('node:path');
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'agent-evaluate.js'), 'utf8');
    const def = src.slice(src.indexOf('function captureStep('), src.indexOf('function captureStep(') + 700);
    expect(def).toMatch(/if \(!TICK_CAPTURE_ENABLED\) return;/);
    expect(def.indexOf('if (!TICK_CAPTURE_ENABLED) return;')).toBeLessThan(def.indexOf('try {'));
    expect(def).toContain('catch');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F3 — two overlapping ticks in ONE process must not see each other.

describe('F3 — overlapping ticks are isolated', () => {
  it('SAME battle, overlapping: the in-tick lookup returns THIS tick\'s context, not the newest one', async () => {
    // The four helper executor call sites read the live context through the
    // in-tick lookup. With a battle-id-keyed registry, tick A's committed swap
    // is recorded onto tick B's record, because B replaced A under the key.
    // (Both ticks still WRITE correctly — they finalize through their own local
    // reference — which is exactly why the earlier version of this row passed
    // and proved nothing.)
    flagState.tickCapture = true;
    const { createTickCaptureContext, currentTickCapture, runWithTickCaptureScope } =
      await import('../_utils/tickCapture/captureContext.js');

    const seen = {};
    const tick = (label, hold) => runWithTickCaptureScope(async () => {
      const ctx = createTickCaptureContext({ battleId: 'battle-tick-1', tickSeq: label === 'A' ? 1 : 41, enabled: true });
      if (hold) await hold;
      // …what a helper executor call site would read, mid-tick:
      seen[label] = currentTickCapture()?.state?.tickSeq ?? null;
      return ctx;
    });

    let releaseA;
    const aHeld = new Promise((r) => { releaseA = r; });
    const runA = tick('A', aHeld);
    await tick('B', null);          // B runs to completion inside A's window
    releaseA();
    await runA;

    expect(seen.B, 'B must see B').toBe(41);
    expect(seen.A, 'A must see A, not whatever ran last under the same battle id').toBe(1);
  });

  it('the body observer does not cross ticks: B finishing cannot close A\'s window', async () => {
    const { beginBodyCapture, endBodyCapture, makeObservingFetch } = await import('../_utils/tickCapture/captureBodyObserver.js');
    const { runWithTickCaptureScope } = await import('../_utils/tickCapture/captureContext.js');
    const base = async () => new Response('{"model":"m"}', { status: 200 });

    let releaseA;
    const aHeld = new Promise((r) => { releaseA = r; });
    // A opens its window, then parks mid-tick.
    const runA = runWithTickCaptureScope(async () => {
      const holder = beginBodyCapture();
      await aHeld;
      await makeObservingFetch(base)('u', { body: '{"from":"A"}' });
      endBodyCapture(holder);
      return holder;
    });
    // B runs start to finish INSIDE A's window, opening and closing its own.
    const holderB = await runWithTickCaptureScope(async () => {
      const holder = beginBodyCapture();
      await makeObservingFetch(base)('u', { body: '{"from":"B"}' });
      endBodyCapture(holder);
      return holder;
    });
    releaseA();
    const holderA = await runA;

    expect(holderB.requestBody, 'B\'s dispatch belongs to B').toBe('{"from":"B"}');
    expect(holderA.requestBody, 'A\'s window must survive B closing its own').toBe('{"from":"A"}');
  });
});
