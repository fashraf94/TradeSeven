// api/agent/decide.carriageOffGolden.test.js
//
// Pilot P1b — THE DEPLOY OFF GOLDEN (acceptance row 1). With the record
// slice's gate OFF for the deploying owner, a deploy — BOTH branches — is
// byte-identical to `main`: the response, the prompt bytes (every model
// request: system, messages, tools, model, temperature), the voice-model
// opener's prompt, the shadow-log arguments, every store read, query and
// write — each kind in its own order AND one sequence across the kinds (a
// transaction's writes as committed), so the creation transaction's reads and
// writes too — the transaction attempt count, and the final documents — the
// battle (its agentContext, the manifest and its equippedConfigHash) and the
// agent document. And no hypothesis record is read or written: zero version
// reads. The comparison is of the SERIALIZED capture (JSON text), so key order
// counts as well as values (P1b review L1-2).
//
// The gate is off in TWO ways, each of which must reproduce the fixture:
//   · flag_off_allowlisted    HYPOTHESIS_RECORDS_ENABLED false, the owner ON
//                             the cockpit allowlist;
//   · flag_on_not_allowlisted the flag true, the owner OFF the allowlist.
// And the battle-creation path runs BOTH ways (P1b review L1-1):
//   · fence lit  — COMPOSITION_EPOCH_FENCE_ENABLED true (HEAD's value): the
//                  battle is created inside commitBattleDocWithPin's
//                  transaction (fixture key `scenarios`);
//   · fence dark — the flag false: the same plain `add` the pre-fence world
//                  made (fixture key `scenariosFenceDark`).
// Limits, stated: with the clock frozen every timestamp is the same instant,
// so swapping one timestamp source for another is invisible here; un-awaited
// work is captured after ten macrotask turns and a 25 ms wait.
//
// THE FIXTURE (api/_utils/__fixtures__/deployCarriageOffGolden.json) IS
// CAPTURED FROM `main`'S OWN CODE: this same file (every line but the SHA pin
// below) run with GENERATE_DEPLOY_CARRIAGE_OFF_GOLDEN=1 in an LF checkout of
// origin/main @ 4b28cd84 — a private Linux clone, detached, before any P1b
// source existed (the harness api/_utils/__fixtures__/deployHarness.js copied
// beside it: it imports no product code). Its SHA-256 over LF bytes is pinned
// below. Regenerate it ONLY from such a tree, never to make this suite green
// after a change, then move the pin in the same commit. The generating run
// fails on purpose after writing, and refuses CI. (The Pilot P6 precedent:
// api/_utils/agentSwapExecution.offGolden.test.js.)
//
// Everything real except the edges: decide.js, createAgentBattle, the manifest
// and its hash, the projection splice and the creation path (both fence
// states), the prompt assemblers, the first-message prompt builder. Doubles:
// the model SDK, the voice model, pricing, auth, the shadow logger, the store
// (callsFirestore + auto-ids + the sequenced log).
//
// Dependency-surface guard (BUILD_RULES §4): decide.js, the battle writer and
// the prompt modules are imported for real here — never mock them away, or
// the golden passes vacuously.

process.env.TZ = 'UTC';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const state = vi.hoisted(() => ({ db: null, anthropic: null, gemmaCalls: [], shadow: { decisions: [], firstMessages: [] }, flag: false, fence: true }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicDouble {
    constructor() { this.messages = { create: (args) => state.anthropic.create(args) }; }
  },
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => state.db }));
vi.mock('../_utils/security.js', async (importOriginal) => ({ ...(await importOriginal()), applySecurityMiddleware: () => false }));
vi.mock('../_utils/authMiddleware.js', async (importOriginal) => ({ ...(await importOriginal()), requireAuth: async () => ({ uid: 'p1b-owner-1' }) }));
vi.mock('../_utils/marketDataCache.js', async (importOriginal) => {
  const { priceAnswer } = await import('../_utils/__fixtures__/deployHarness.js');
  return { ...(await importOriginal()), getStockAnalysisData: (symbol) => priceAnswer(symbol) };
});
vi.mock('../_utils/shadowLogger.js', () => ({
  logDecision: async (args) => { state.shadow.decisions.push(JSON.parse(JSON.stringify(args))); },
  logFirstMessage: async (args) => { state.shadow.firstMessages.push(JSON.parse(JSON.stringify(args))); },
}));
vi.mock('../_utils/gemmaClient.js', () => ({
  callGemmaVoice: async ({ systemPrompt, conversationHistory, userMessage }) => {
    state.gemmaCalls.push({ systemPrompt, conversationHistory, userMessage });
    return '{"response":"Opening line."}';
  },
  parseVoiceLayerResponse: () => ({ response: 'Opening line.', _scratchpad: null }),
}));
vi.mock('firebase-admin/firestore', async () => {
  const { FieldValueDouble } = await import('../_utils/__fixtures__/callsFirestore.js');
  return { FieldValue: FieldValueDouble };
});
// The record slice's flag, walked by the suite (the gate's two off states).
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get HYPOTHESIS_RECORDS_ENABLED() { return state.flag; } };
});
// The composition fence, walked by the suite (the creation path lit and dark).
vi.mock('../_utils/compositionConfig.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, get COMPOSITION_EPOCH_FENCE_ENABLED() { return state.fence; } };
});

const H = await import('../_utils/__fixtures__/deployHarness.js');
const { SCENARIOS } = await import('../_utils/__fixtures__/deployScenarios.js');
const { default: handler } = await import('./decide.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = resolve(HERE, '../_utils/__fixtures__/deployCarriageOffGolden.json');
/** SHA-256 of the fixture's LF bytes, as captured from origin/main @ 4b28cd84. */
const GOLDEN_SHA256 = 'dc03ce3632734b677d62296cdf936dd281cde070116cf2b27f84fa8d19e13bc4';
const ENV = globalThis.process?.env || {};
const GENERATE = ENV.GENERATE_DEPLOY_CARRIAGE_OFF_GOLDEN === '1';
if (GENERATE && ENV.CI) throw new Error('GENERATE_DEPLOY_CARRIAGE_OFF_GOLDEN is a local, deliberate act — never on CI');

const ALLOWLIST_ENV = 'COCKPIT_ALLOWLIST_UIDS';

const MODES = {
  flag_off_allowlisted: { flag: false, allowlist: H.OWNER },
  flag_on_not_allowlisted: { flag: true, allowlist: 'someone-else-1' },
};
/** The creation path's two states → the fixture key each one's captures live under. */
const FENCES = { lit: { fence: true, key: 'scenarios' }, dark: { fence: false, key: 'scenariosFenceDark' } };
const serialized = (v) => JSON.stringify(v, null, 2);

/** Run one scenario under one gate-off mode and one fence state, and return its capture. */
async function runScenario(name, mode, fence = 'lit') {
  state.fence = FENCES[fence].fence;
  const { docs, req } = SCENARIOS[name]();
  // Every scenario starts from the same random stream and the same instant, however it is run.
  Math.random.mockImplementation(H.seededRandom());
  vi.setSystemTime(new Date(H.FROZEN_NOW));
  state.db = H.makeDeployDb(docs);
  state.anthropic = H.makeAnthropicDouble();
  state.gemmaCalls = [];
  state.shadow = { decisions: [], firstMessages: [] };
  state.flag = MODES[mode].flag;
  process.env[ALLOWLIST_ENV] = MODES[mode].allowlist;
  const res = H.makeRes();
  await handler(req, res);
  // The shadow logger and the first message ride un-awaited promise chains; let them land.
  await H.settle();
  return H.captureDeploy({ db: state.db, res, anthropic: state.anthropic, gemmaCalls: state.gemmaCalls, shadow: state.shadow });
}

let savedEnv;
beforeEach(() => {
  savedEnv = { allow: process.env[ALLOWLIST_ENV], cron: process.env.CRON_SECRET };
  process.env.CRON_SECRET = H.CRON_SECRET;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(H.FROZEN_NOW));
  vi.spyOn(Math, 'random').mockImplementation(H.seededRandom());
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  if (savedEnv.allow === undefined) delete process.env[ALLOWLIST_ENV]; else process.env[ALLOWLIST_ENV] = savedEnv.allow;
  if (savedEnv.cron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = savedEnv.cron;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const lf = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

describe('deploy with the record slice OFF — byte-identical to main (P1b acceptance row 1)', () => {
  it('GENERATE (local only) or load the frozen fixture', async () => {
    if (!GENERATE) {
      expect(existsSync(GOLDEN_PATH), 'frozen fixture missing — it is captured once, from main').toBe(true);
      return;
    }
    const sets = {};
    for (const [fence, { key }] of Object.entries(FENCES)) {
      sets[key] = {};
      for (const name of Object.keys(SCENARIOS)) sets[key][name] = await runScenario(name, 'flag_off_allowlisted', fence);
    }
    writeFileSync(GOLDEN_PATH, `${JSON.stringify({
      capturedFrom: 'an LF checkout of origin/main @ 4b28cd84 (a private Linux clone, detached; before any P1b source) running this file with GENERATE_DEPLOY_CARRIAGE_OFF_GOLDEN=1',
      frozenNow: H.FROZEN_NOW,
      ...sets,
    }, null, 2)}\n`);
    throw new Error(`frozen fixture written to ${GOLDEN_PATH} — this generating run fails on purpose; re-run WITHOUT GENERATE_DEPLOY_CARRIAGE_OFF_GOLDEN to verify`);
  }, 120_000);

  const golden = existsSync(GOLDEN_PATH) ? JSON.parse(lf(GOLDEN_PATH)) : null;

  it('the fixture file is exactly the one captured from main (SHA-256 of its LF bytes)', () => {
    expect(createHash('sha256').update(lf(GOLDEN_PATH)).digest('hex')).toBe(GOLDEN_SHA256);
  });

  it('the fixture is not vacuous: every scenario is present; the self-select deploys made both model calls; battles were created inside a transaction; no hypothesis record was touched', () => {
    expect(Object.keys(golden.scenarios).sort()).toEqual(Object.keys(SCENARIOS).sort());
    for (const [name, cap] of Object.entries(golden.scenarios)) {
      expect(cap.response.status, name).toBe(200);
      expect(H.hypothesisAccess(cap), name).toEqual({ reads: [], queries: [], writes: [] });
      if (name.startsWith('self_select')) expect(cap.modelRequests.map((r) => r.tool_choice.name), name).toEqual(['submit_strategy', 'submit_portfolio']);
      if (name === 'self_select_existing_active_battle') {
        expect(cap.response.body.battleCreated, name).toBe(false);
        continue;
      }
      expect(cap.response.body.battleCreated, name).toBe(true);
      const battle = cap.docs[`agentBattles/${cap.response.body.agentBattleId}`];
      expect(battle, name).toBeTruthy();
      expect(Object.keys(battle.agentContext), name).not.toContain('equippedHypothesis');
      expect(typeof battle.resolvedAgentManifest.equippedConfigHash, name).toBe('string');
      expect(cap.store.writes.some((w) => w.op === 'create' && w.path.startsWith('agentBattles/')), name).toBe(true);
    }
    // The equipped list froze into the self-select battle; the tournament battle carries none.
    const ready = golden.scenarios.self_select_ready_over_activated;
    expect(ready.docs[`agentBattles/${ready.response.body.agentBattleId}`].agentContext.equippedWatchlist).toMatchObject({ watchlistId: H.WATCHLIST_ID, tickers: ['NVDA', 'PLTR', 'AMD'] });
    const tour = golden.scenarios.tournament_prescribed_with_ready_idea;
    expect(tour.docs[`agentBattles/${tour.response.body.agentBattleId}`].agentContext.equippedWatchlist).toBeNull();
  });

  it('the fixture covers BOTH creation paths: lit creates the battle inside a transaction that re-reads the activation descriptor; dark makes the plain add with no descriptor read; the sequence log is present', () => {
    expect(Object.keys(golden.scenariosFenceDark).sort()).toEqual(Object.keys(SCENARIOS).sort());
    for (const name of Object.keys(SCENARIOS)) {
      const lit = golden.scenarios[name];
      const dark = golden.scenariosFenceDark[name];
      expect(lit.store.sequence.length, name).toBeGreaterThan(0);
      expect(lit.store.sequence.some((e) => e.read === 'composition/activation'), name).toBe(true);
      expect(dark.store.sequence.some((e) => e.read === 'composition/activation'), name).toBe(false);
      expect(H.hypothesisAccess(dark), name).toEqual({ reads: [], queries: [], writes: [] });
      if (name !== 'self_select_existing_active_battle') {
        expect(dark.store.writes.some((w) => w.op === 'create' && w.path.startsWith('agentBattles/')), name).toBe(true);
      }
    }
  });

  for (const [fence, { key }] of Object.entries(FENCES)) {
    for (const mode of Object.keys(MODES)) {
      for (const name of Object.keys(SCENARIOS)) {
        it(`fence ${fence} · ${mode} · ${name} — reproduces main's capture exactly (serialized)`, async () => {
          const cap = await runScenario(name, mode, fence);
          expect(serialized(cap)).toBe(serialized(golden[key][name]));
        }, 20_000);
      }
    }
  }
});
