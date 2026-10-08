import '../_utils/__fixtures__/pinTimezoneUtc.js';
// api/cron/agent-evaluate.meetingCopy.baseline.test.js
//
// Integrity follow-up 2 (8 Oct 2026), Part A — acceptance 1, first clause: "a
// server-created meeting that a player approves runs byte-identical to today".
// Report: docs/audits/20261008_BUILD_INTEGRITY_FOLLOWUP_2.md.
//
// THE FIXTURE (api/_utils/__fixtures__/meetingCopyBaseline.json) IS CAPTURED
// FROM THE BASE TREE — an LF `git archive` of c1822e39 (origin/main, PR #942),
// whose cron knows nothing of the copy — by running THIS FILE there with
// GENERATE_MEETING_BASELINE=1. Every scenario hands the base cron and this
// build's cron the same battle (the meeting AND the copy a server-created
// meeting carries since this build — the base cron ignores the copy). The
// base cron's every battle write, executor argument, prompt and summary is the
// fixture; this build's must equal it byte for byte once the intended changes
// are lifted — the `cronState.gameplanMeeting` key (the copy written with a new
// meeting, cleared with a resolved one) and Part D's marker on a leg whose
// executor call threw with no trade (see lift(); review K2-5). Each lifted value
// is pinned by its own row. Its SHA-256 is pinned below.
//
// SELF-CONTAINED on purpose: it imports only fixtures that exist at the base
// (no follow-up-2 helper), so the same bytes run on both trees.
//
// The executor is real (wrapped, never replaced).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeToolUseResponse, deepClone,
} from '../_utils/__fixtures__/tickStampsHarness.js';
import { makeCallsDb } from '../_utils/__fixtures__/callRecordsStore.js';

const mocks = vi.hoisted(() => ({ getStockAnalysisData: vi.fn(), fetchIntradayBatch: vi.fn(), create: vi.fn() }));
const flags = vi.hoisted(() => ({ swapIdentity: 'off' }));
const exec = vi.hoisted(() => ({ calls: [] }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock { constructor() { this.messages = { create: (...args) => mocks.create(...args) }; } },
}));
vi.mock('../_utils/marketDataCache.js', () => ({
  getStockAnalysisData: mocks.getStockAnalysisData,
  fetchIntradayBatch: mocks.fetchIntradayBatch,
  fetchIntradayCandles: vi.fn(async () => []),
  filterToLatestSession: vi.fn((candles) => ({ candles: candles || [], sessionDate: '2026-09-09' })),
}));
vi.mock('../_utils/agentSwapExecution.js', async (importOriginal) => {
  const real = await importOriginal();
  const runReal = real.executeSwapServer; // aliased: the census reads a literal call as a consumer
  return { ...real, executeSwapServer: async (...args) => { exec.calls.push(deepClone(args.slice(3))); return runReal(...args); } };
});
vi.mock('../_utils/tournamentAgentLedger.js', () => ({
  resolveTournamentContext: vi.fn(async () => null), excludeHeldByOthers: vi.fn((l) => l), excludeHeldSymbols: vi.fn((l) => l),
  reserveSymbol: vi.fn(), confirmSwap: vi.fn(), releaseReservation: vi.fn(),
}));
vi.mock('../_utils/firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));
vi.mock('../_utils/voiceLayerAnticipation.js', async (importOriginal) => ({ ...(await importOriginal()), generateAnticipation: vi.fn(async () => null) }));
vi.mock('../_utils/voiceLayerTradeNarration.js', async (importOriginal) => ({ ...(await importOriginal()), generateTradeNarration: vi.fn(async () => null) }));
vi.mock('../_utils/shadowLogger.js', async (importOriginal) => ({ ...(await importOriginal()), logEvaluation: vi.fn(async () => false), logVisionTransition: vi.fn(async () => false), logAnticipation: vi.fn(async () => false) }));
vi.mock('../_utils/learning/captureReceipt.js', () => ({
  captureSwapReceipt: vi.fn(async () => {}),
  resolveEntrySnapshot: vi.fn(async () => ({ snapshotIn: null, techDocIn: null, entrySnapshotSource: 'unavailable' })),
  classifyEntryAtrSource: vi.fn(() => 'bench_atr'),
  classifyEvidence: vi.fn(() => 'live_agent'),
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get SWAP_IDENTITY_MODE() { return flags.swapIdentity; },
}));

const { processAgentBattle } = await import('./agent-evaluate.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = resolve(HERE, '../_utils/__fixtures__/meetingCopyBaseline.json');
/** SHA-256 of the fixture captured from the base tree (moved only by a recapture from such a tree). */
const GOLDEN_SHA256 = '6c4b17d9cf65907f02e3b7326ba234aafb725bd632fca0973d94615464df3b01';
const ENV = process.env;
const GENERATE = ENV.GENERATE_MEETING_BASELINE === '1';
if (GENERATE && ENV.CI) throw new Error('GENERATE_MEETING_BASELINE is a local, deliberate act — never on CI');

const MEETING_ID = 'gpm_1757430000000';
const KO_THEN = '2026-09-09T13:45:00.000Z';
const KO_NOW = '2026-09-09T14:40:00.000Z';

/**
 * The battle overrides for a meeting the server created: the meeting (P6's leg
 * instants as the server stamped them — the same on the leg and in the copy)
 * and the copy beside it. The base cron reads only the meeting.
 */
function serverMeeting(meeting, base = makeTickBattle()) {
  const stored = { id: MEETING_ID, createdAt: '2026-09-09T14:00:00.000Z', ...meeting };
  const legs = (stored.suggestedSwaps || []).map((leg) => (Object.hasOwn(leg, 'swappedInAt')
    ? { symbolOut: leg.symbolOut, symbolIn: leg.symbolIn, swappedInAt: leg.swappedInAt }
    : { symbolOut: leg.symbolOut, symbolIn: leg.symbolIn }));
  return { gameplanMeeting: stored, cronState: { ...base.cronState, gameplanMeeting: { meetingId: stored.id, createdAt: stored.createdAt, expiresAt: stored.expiresAt, legs } } };
}
const approved = (legs) => ({ status: 'approved', diagnosis: 'drag', opportunity: 'tech', proposedAction: 'rotate_sector', fromSector: 'Consumer Defensive', toSectors: ['Technology'], suggestedSwaps: legs, expiresAt: '2026-09-09T20:00:00.000Z', resolvedAt: '2026-09-09T14:55:00.000Z', resolvedBy: 'owner-uid-1' });
const ONE_LEG = () => [{ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'KO down 1.2%, AMD (Technology) has tech score 80.', swappedInAt: null }];
const TWO_LEGS = () => [
  { symbolOut: 'INTC', symbolIn: 'JPM', rationale: 'INTC lagging', swappedInAt: null }, // INTC has left the book
  { symbolOut: 'KO', symbolIn: 'AMD', rationale: 'KO lagging', swappedInAt: KO_THEN },  // KO left and came back
];
const returnedKo = (b) => { b.portfolio.support[0] = { ...b.portfolio.support[0], swapPrice: 62.2, swappedInAt: KO_NOW }; return b; };

const SCENARIOS = {};
for (const mode of ['off', 'shadow', 'enforce']) {
  SCENARIOS[`approved_one_leg_${mode}`] = { mode, battle: () => makeTickBattle(serverMeeting(approved(ONE_LEG()))) };
  SCENARIOS[`approved_two_legs_${mode}`] = { mode, battle: () => returnedKo(makeTickBattle(serverMeeting(approved(TWO_LEGS())))) };
}
SCENARIOS.pending_wait = { mode: 'off', battle: () => makeTickBattle(serverMeeting({ status: 'pending', diagnosis: 'drag', suggestedSwaps: ONE_LEG(), expiresAt: '2026-09-09T20:00:00.000Z' })) };
SCENARIOS.pending_expired = { mode: 'off', battle: () => makeTickBattle(serverMeeting({ status: 'pending', diagnosis: 'drag', suggestedSwaps: ONE_LEG(), expiresAt: '2026-09-09T14:30:00.000Z' })) };
SCENARIOS.rejected = { mode: 'off', battle: () => makeTickBattle(serverMeeting({ ...approved(ONE_LEG()), status: 'rejected' })) };
for (const mode of ['off', 'shadow']) {
  SCENARIOS[`created_${mode}`] = { mode, battle: () => { const b = makeTickBattle(); delete b.cronState.lastGameplanDate; return b; } };
}

async function runScenario(name) {
  const { mode, battle: make } = SCENARIOS[name];
  flags.swapIdentity = mode;
  exec.calls = [];
  mocks.create.mockClear();
  const prices = makePriceTable();
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
  const battle = make();
  const db = makeCallsDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  let thrown = null;
  try {
    await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  } catch (err) { thrown = String(err?.message || err); }
  return {
    thrown, summary,
    updates: deepClone(db.__updates),
    executor: exec.calls,
    // Each request the model received, as the SHA-256 of its bytes (the fixture stays small; a moved byte still moves the hash).
    prompts: mocks.create.mock.calls.map((call) => createHash('sha256').update(JSON.stringify(call[0])).digest('hex')),
  };
}

/**
 * The intended changes, lifted:
 *   - Part A: `cronState.gameplanMeeting` (the copy written with a new meeting,
 *     cleared with a resolved one);
 *   - Part D: `executionFailed: true` on a leg whose executor call threw and
 *     whose fresh read found no trade, with `refusalReason` when P6 refused it
 *     (here: the leg P6 refused at enforce — P6's own refusal record and table
 *     F line are unchanged).
 */
function lift(snapshot) {
  const lifted = [];
  const failedLegs = [];
  const updates = snapshot.updates.map((u) => {
    let out = u;
    if (Object.hasOwn(out, 'cronState.gameplanMeeting')) {
      lifted.push(out['cronState.gameplanMeeting']);
      const { 'cronState.gameplanMeeting': _copy, ...rest } = out;
      out = rest;
    }
    if (Array.isArray(out.gameplanMeetingHistory)) {
      const history = out.gameplanMeetingHistory.map((row) => (Array.isArray(row?.suggestedSwaps) ? {
        ...row,
        suggestedSwaps: row.suggestedSwaps.map((leg, i) => {
          if (leg?.executionFailed !== true) return leg;
          failedLegs.push({ index: i, symbolOut: leg.symbolOut, symbolIn: leg.symbolIn, ...(Object.hasOwn(leg, 'refusalReason') ? { refusalReason: leg.refusalReason } : {}) });
          const { executionFailed: _failed, refusalReason: _reason, ...rest } = leg;
          return rest;
        }),
      } : row));
      out = { ...out, gameplanMeetingHistory: history };
    }
    return out;
  });
  return { snapshot: { ...snapshot, updates }, lifted, failedLegs };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const serialize = (v) => JSON.stringify(v);

describe('a server-created meeting runs byte-identical to the base tree (acceptance 1)', () => {
  it('GENERATE (local, on the base tree only) or load the frozen fixture', async () => {
    if (!GENERATE) {
      expect(existsSync(GOLDEN_PATH), 'the frozen base fixture is missing').toBe(true);
      return;
    }
    const scenarios = {};
    for (const name of Object.keys(SCENARIOS)) scenarios[name] = await runScenario(name);
    writeFileSync(GOLDEN_PATH, `${JSON.stringify({ capturedFrom: 'c1822e39 (origin/main, PR #942) — git archive, LF', scenarios }, null, 1)}\n`);
    throw new Error(`base fixture written to ${GOLDEN_PATH} — this generating run fails on purpose`);
  });

  const golden = !GENERATE && existsSync(GOLDEN_PATH) ? JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) : null;

  it('the fixture is checked out as LF on every platform (its .gitattributes entry), so the SHA-256 pin holds', () => {
    const attributes = readFileSync(resolve(HERE, '../../.gitattributes'), 'utf8').split(/\r?\n/).map((l) => l.trim());
    expect(attributes).toContain('api/_utils/__fixtures__/meetingCopyBaseline.json text eol=lf');
    expect(readFileSync(GOLDEN_PATH).includes(0x0d)).toBe(false);
  });

  it('the fixture is the one captured from the base tree (SHA-256 pinned), and it is not vacuous', () => {
    expect(createHash('sha256').update(readFileSync(GOLDEN_PATH)).digest('hex')).toBe(GOLDEN_SHA256);
    expect(Object.keys(golden.scenarios).sort()).toEqual(Object.keys(SCENARIOS).sort());
    // The approvals traded at the base; the refusal paths refused; the pending meeting made the model wait.
    expect(golden.scenarios.approved_one_leg_off.executor).toHaveLength(1);
    expect(golden.scenarios.approved_two_legs_enforce.executor).toHaveLength(1);
    expect(golden.scenarios.pending_wait.prompts).toEqual([]);
    expect(golden.scenarios.pending_expired.prompts).toHaveLength(1);
    expect(golden.scenarios.created_off.updates.some((u) => u.gameplanMeeting)).toBe(true);
    // The base cron wrote no copy anywhere.
    expect(serialize(golden.scenarios)).not.toMatch(/cronState\.gameplanMeeting/);
  });

  for (const name of Object.keys(SCENARIOS)) {
    it(`${name}: every battle write, executor argument, prompt (its SHA-256) and the summary equal the base's, once the copy key is lifted`, async () => {
      const live = await runScenario(name);
      const { snapshot } = lift(JSON.parse(serialize(live)));
      const frozen = golden.scenarios[name];
      expect(serialize(snapshot.updates), `${name}: battle writes moved`).toBe(serialize(frozen.updates));
      expect(serialize(snapshot.executor), `${name}: executor arguments moved`).toBe(serialize(frozen.executor));
      expect(serialize(snapshot.prompts), `${name}: prompt bytes moved`).toBe(serialize(frozen.prompts));
      expect(serialize(snapshot.summary)).toBe(serialize(frozen.summary));
      expect(snapshot.thrown).toBe(frozen.thrown);
    });
  }

  it('the lifted key is exactly the copy: written with the new meeting (server values), cleared (null) with each resolved one, absent while one waits', async () => {
    for (const name of Object.keys(SCENARIOS)) {
      const { lifted, failedLegs } = lift(JSON.parse(serialize(await runScenario(name))));
      // Part D's leg marker appears exactly where an executor call threw and nothing landed: the KO leg P6 refused at enforce.
      expect(failedLegs, name).toEqual(name === 'approved_two_legs_enforce' ? [{ index: 1, symbolOut: 'KO', symbolIn: 'AMD', refusalReason: 'outgoing_identity_mismatch' }] : []);
      if (name.startsWith('created_')) {
        expect(lifted, name).toHaveLength(1);
        expect(Object.keys(lifted[0])).toEqual(['meetingId', 'createdAt', 'expiresAt', 'legs']);
      } else if (name === 'pending_wait') {
        expect(lifted, name).toEqual([]);
      } else {
        expect(lifted, name).toEqual([null]);
      }
    }
  });
});
