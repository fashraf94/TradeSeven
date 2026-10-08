// api/cron/agent-evaluate.meetingCopy.test.js
//
// Integrity follow-up 2 (8 Oct 2026), Part A — the server's own copy of each
// gameplan meeting it creates (founder decision Q1: M1 plus the deadline).
// Report: docs/audits/20261008_BUILD_INTEGRITY_FOLLOWUP_2.md.
//
// THE ATTACKER (unchanged): a signed-in player who writes any field
// firestore.rules lets them write on their own battle — the whole
// `gameplanMeeting` map included — at any moment between ticks.
//
// THE ROWS (acceptance 1):
//   - the copy is written in the same update as the meeting, from server values;
//   - planted, extra and duplicate legs are held and recorded; so is every leg
//     of a meeting with a forged id or no copy at all (a meeting created before
//     this deploy included);
//   - P6's belief is the copy's, never the meeting leg's;
//   - the model waits only until the copy's deadline — a planted far deadline,
//     or a meeting the copy does not name, makes nothing wait;
//   - the integrity build's +497 eviction probe (its §5) now fails.
// The byte-identity of a server-created meeting the player approves is pinned
// against the base tree by agent-evaluate.meetingCopy.baseline.test.js.
//
// THE EXECUTOR IS REAL (wrapped, never replaced).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FROZEN_NOW, makeTickBattle, makePriceTable, makeRankingsDoc, makeTechDocs, makeIntradayCandles,
  makeHoldResult, makeToolUseResponse, deepClone, serverMeetingOverrides, FIXTURE_MEETING_ID,
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
const { HELD_LEG_RECORD_MAX, LEG_NOT_PROPOSED, serverMeetingCopy, legRationaleSource } = await import('../_utils/meetingCopy.js');

async function runTick(battle, prices = makePriceTable()) {
  mocks.getStockAnalysisData.mockImplementation(async (symbol) => (prices[symbol] ? { price: prices[symbol], daily: [] } : {}));
  mocks.fetchIntradayBatch.mockImplementation(async () => ({ NVDA: makeIntradayCandles() }));
  mocks.create.mockImplementation(async () => makeToolUseResponse(makeHoldResult()));
  const db = makeCallsDb({ battle, rankingsDoc: makeRankingsDoc(), techDocs: makeTechDocs() });
  const summary = { evaluated: 0, held: 0, triggered: 0, skipped: 0, swapped: 0 };
  await processAgentBattle(db, battle, summary, Date.now(), new Map(), { everEnabled: false });
  const feedUpdate = [...db.__updates].reverse().find((u) => Array.isArray(u.statusFeed)) || null;
  return { db, summary, stored: db.__store.battle, feed: feedUpdate?.statusFeed || [], modelCalls: mocks.create.mock.calls.length };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(FROZEN_NOW));
  mocks.getStockAnalysisData.mockReset();
  mocks.fetchIntradayBatch.mockReset();
  mocks.create.mockReset();
  flags.swapIdentity = 'off';
  exec.calls = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const MODES = ['off', 'shadow', 'enforce'];
const LATER = '2026-09-09T20:00:00.000Z';
/** A server meeting proposing KO → AMD (KO a creation-time position). */
const KO_AMD = Object.freeze({ symbolOut: 'KO', symbolIn: 'AMD', rationale: 'KO lagging' });
const approvedMeeting = (legs, extra = {}) => ({ status: 'approved', diagnosis: 'drag', expiresAt: LATER, suggestedSwaps: legs, ...extra });
/** The battle: the meeting as the player left it, the copy as the server stored it. */
const withCopy = (meeting, copyLegs = [{ symbolOut: 'KO', symbolIn: 'AMD', swappedInAt: null }], over = {}) =>
  makeTickBattle({ ...serverMeetingOverrides(meeting, { legs: copyLegs }), ...over });
const meetingRow = (stored) => stored.gameplanMeetingHistory.at(-1);
const gameplanBeats = (feed) => feed.filter((e) => e.source === 'gameplan_meeting');

// ─────────────────────────────────────────────────────────────────────────────
describe('the copy is written with the meeting — one update, server values only', () => {
  const armed = () => {
    const b = makeTickBattle();
    delete b.cronState.lastGameplanDate; // the fixture pre-suppresses the detector
    return b;
  };

  for (const mode of ['off', 'shadow']) {
    it(`${mode}: the update that writes \`gameplanMeeting\` also writes \`cronState.gameplanMeeting\` = { meetingId, createdAt, expiresAt, legs }`, async () => {
      flags.swapIdentity = mode;
      const { db } = await runTick(armed());
      const creations = db.__updates.filter((u) => u.gameplanMeeting);
      expect(creations).toHaveLength(1);
      const [u] = creations;
      const meeting = u.gameplanMeeting;
      expect(meeting.suggestedSwaps.length).toBeGreaterThan(0);
      expect(u['cronState.gameplanMeeting']).toEqual({
        meetingId: meeting.id, createdAt: meeting.createdAt, expiresAt: meeting.expiresAt,
        // The meeting's own legs as the server built them: P6 stamps the entry instant only at
        // mode ≠ off (the fixture's positions are creation-time: null) — review K2-2. Enforce
        // readiness (founder Q4): each leg's rationale too, the server's own sentence.
        legs: meeting.suggestedSwaps.map((l) => (mode === 'off'
          ? { symbolOut: l.symbolOut, symbolIn: l.symbolIn, rationale: l.rationale }
          : { symbolOut: l.symbolOut, symbolIn: l.symbolIn, rationale: l.rationale, swappedInAt: null })),
      });
      // No player value can be in it: every leg string is a ticker the server proposed, and
      // the rationale is the detector's own sentence.
      expect(Object.keys(u['cronState.gameplanMeeting'].legs[0])).toEqual(mode === 'off' ? ['symbolOut', 'symbolIn', 'rationale'] : ['symbolOut', 'symbolIn', 'rationale', 'swappedInAt']);
      expect(u['cronState.gameplanMeeting'].legs).toEqual(meeting.suggestedSwaps.map((l) => (Object.hasOwn(l, 'swappedInAt') ? { symbolOut: l.symbolOut, symbolIn: l.symbolIn, rationale: l.rationale, swappedInAt: l.swappedInAt } : { symbolOut: l.symbolOut, symbolIn: l.symbolIn, rationale: l.rationale })));
      for (const leg of u['cronState.gameplanMeeting'].legs) expect(leg.rationale).toMatch(/ has tech score /);
    });
  }

  it('the next check, unchanged by the player, waits for that meeting (the copy names it)', async () => {
    const first = await runTick(armed());
    mocks.create.mockReset();
    const second = await runTick(deepClone(first.stored));
    expect(second.modelCalls).toBe(0);
    expect(second.stored.gameplanMeeting).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('which legs run — only the copy\'s, each at most once; every other leg is held and recorded', () => {
  for (const mode of MODES) {
    it(`${mode}: a server-created meeting the player approves runs its stored leg (the trade, the beat, a plain history row)`, async () => {
      flags.swapIdentity = mode;
      const battle = withCopy(approvedMeeting([{ ...KO_AMD }]));
      const meeting = deepClone(battle.gameplanMeeting);
      const { stored, feed } = await runTick(battle);
      expect(exec.calls).toHaveLength(1);
      expect(stored.trades.map((t) => [t.symbolOut, t.symbolIn])).toEqual([['KO', 'AMD']]);
      expect(gameplanBeats(feed).map((b) => b.message)).toEqual(['Gameplan approved: KO → AMD']);
      expect(meetingRow(stored)).toEqual(meeting); // no held legs, no markers
      expect(stored.gameplanMeeting).toBeNull();
      expect(stored.cronState.gameplanMeeting).toBeNull(); // the copy is cleared with the meeting
    });

    it(`${mode}: a PLANTED leg (not in the copy) is held — never traded, no beat — and recorded \`leg_not_proposed\``, async () => {
      flags.swapIdentity = mode;
      const { stored, feed } = await runTick(withCopy(approvedMeeting([{ symbolOut: 'TSLA', symbolIn: 'JPM', rationale: 'planted' }])));
      expect(exec.calls).toEqual([]);
      expect(stored.trades).toEqual([]);
      expect(gameplanBeats(feed)).toEqual([]);
      expect(meetingRow(stored)).toMatchObject({ heldLegs: [{ symbolOut: 'TSLA', symbolIn: 'JPM', reason: LEG_NOT_PROPOSED }], heldLegCount: 1 });
      expect(meetingRow(stored)).not.toHaveProperty('legRefusals');
    });

    it(`${mode}: EXTRA legs beside the stored one — the stored leg runs, the extras are held`, async () => {
      flags.swapIdentity = mode;
      const { stored } = await runTick(withCopy(approvedMeeting([
        { symbolOut: 'TSLA', symbolIn: 'JPM', rationale: 'extra 1' }, { ...KO_AMD }, { symbolOut: 'PG', symbolIn: 'JPM', rationale: 'extra 2' },
      ])));
      expect(exec.calls).toHaveLength(1);
      expect(stored.trades.map((t) => [t.symbolOut, t.symbolIn])).toEqual([['KO', 'AMD']]);
      expect(meetingRow(stored).heldLegs.map((l) => `${l.symbolOut}>${l.symbolIn}`)).toEqual(['TSLA>JPM', 'PG>JPM']);
      expect(meetingRow(stored).heldLegCount).toBe(2);
    });

    it(`${mode}: a DUPLICATE of the stored leg runs once; the duplicate is held`, async () => {
      flags.swapIdentity = mode;
      const { stored } = await runTick(withCopy(approvedMeeting([{ ...KO_AMD }, { ...KO_AMD }, { ...KO_AMD }])));
      expect(exec.calls).toHaveLength(1);
      expect(stored.trades).toHaveLength(1);
      expect(meetingRow(stored)).toMatchObject({ heldLegCount: 2, heldLegs: [{ symbolOut: 'KO', symbolIn: 'AMD', reason: LEG_NOT_PROPOSED }, { symbolOut: 'KO', symbolIn: 'AMD', reason: LEG_NOT_PROPOSED }] });
    });

    it(`${mode}: a FORGED meeting id holds every leg — even the stored pair`, async () => {
      flags.swapIdentity = mode;
      const battle = withCopy(approvedMeeting([{ ...KO_AMD }]));
      battle.gameplanMeeting.id = 'gpm_forged';
      const { stored } = await runTick(battle);
      expect(exec.calls).toEqual([]);
      expect(stored.trades).toEqual([]);
      expect(meetingRow(stored)).toMatchObject({ heldLegCount: 1, heldLegs: [{ symbolOut: 'KO', symbolIn: 'AMD', reason: LEG_NOT_PROPOSED }] });
      expect(stored.cronState.gameplanMeeting).toBeNull();
    });

    it(`${mode}: a meeting with NO copy (planted, or created before this deploy) holds every leg`, async () => {
      flags.swapIdentity = mode;
      const battle = makeTickBattle({ gameplanMeeting: { id: 'gpm_old', ...approvedMeeting([{ ...KO_AMD }]) } });
      const { stored, db } = await runTick(battle);
      expect(exec.calls).toEqual([]);
      expect(stored.trades).toEqual([]);
      expect(meetingRow(stored)).toMatchObject({ heldLegCount: 1 });
      // No copy was stored, so none is cleared: the resolution write is the one it always was, plus the held legs.
      const resolution = db.__updates.find((u) => Object.hasOwn(u, 'gameplanMeetingHistory'));
      expect(Object.keys(resolution)).toEqual(['gameplanMeeting', 'gameplanMeetingHistory']);
    });
  }

  it('legs that are not objects contribute nothing (no throw); the object legs are planned as usual', async () => {
    const { stored } = await runTick(withCopy(approvedMeeting([null, 7, 'KO', ['KO', 'AMD'], { ...KO_AMD }])));
    expect(stored.trades.map((t) => [t.symbolOut, t.symbolIn])).toEqual([['KO', 'AMD']]);
    expect(meetingRow(stored)).not.toHaveProperty('heldLegs');
  });

  it(`a 5,000-leg plant: nothing trades, ${HELD_LEG_RECORD_MAX} held legs are recorded with the total, and the row stays small`, async () => {
    const legs = Array.from({ length: 5000 }, (_, i) => ({ symbolOut: i % 2 ? 'AMD' : 'KO', symbolIn: i % 2 ? 'KO' : 'AMD', rationale: 'churn' }));
    const battle = withCopy(approvedMeeting(legs), [{ symbolOut: 'TSLA', symbolIn: 'JPM', swappedInAt: null }]);
    const { stored } = await runTick(battle);
    expect(exec.calls).toEqual([]);
    const row = meetingRow(stored);
    expect(row.heldLegs).toHaveLength(HELD_LEG_RECORD_MAX);
    expect(row.heldLegCount).toBe(5000);
    // The record the server ADDS is bounded (the meeting's own legs were already in the document).
    expect(JSON.stringify(row.heldLegs).length).toBeLessThan(2000);
  });

  it('the copy is cleared with the meeting: re-planting the same approved meeting afterwards runs nothing', async () => {
    const first = await runTick(withCopy(approvedMeeting([{ ...KO_AMD }])));
    expect(first.stored.trades).toHaveLength(1);
    exec.calls = [];
    // The player writes the same meeting back (same id, approved) — the bench has KO now, AMD is held.
    const replay = deepClone(first.stored);
    replay.gameplanMeeting = { id: FIXTURE_MEETING_ID, ...approvedMeeting([{ symbolOut: 'AMD', symbolIn: 'KO', rationale: 'back' }]) };
    const second = await runTick(replay);
    expect(exec.calls).toEqual([]);
    expect(second.stored.trades).toHaveLength(1);
    expect(meetingRow(second.stored)).toMatchObject({ heldLegCount: 1 });
  });

  it('a REJECTED meeting files as before and clears the copy; nothing trades', async () => {
    const { stored, feed } = await runTick(withCopy({ ...approvedMeeting([{ ...KO_AMD }]), status: 'rejected' }));
    expect(exec.calls).toEqual([]);
    expect(meetingRow(stored).status).toBe('rejected');
    expect(gameplanBeats(feed).map((b) => b.message)).toEqual(['Gameplan rejected by Coach. Holding current positions.']);
    expect(stored.cronState.gameplanMeeting).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P6\'s belief is the copy\'s — never the player-writable meeting leg\'s', () => {
  const KO_NOW = '2026-09-09T14:40:00.000Z';
  const KO_THEN = '2026-09-09T13:45:00.000Z';
  const returnedKo = (meetingInstant, copyInstant) => {
    const b = withCopy(approvedMeeting([{ ...KO_AMD, swappedInAt: meetingInstant }]), [{ symbolOut: 'KO', symbolIn: 'AMD', swappedInAt: copyInstant }]);
    b.portfolio.support[0] = { ...b.portfolio.support[0], swapPrice: 62.2, swappedInAt: KO_NOW };
    return b;
  };

  it('shadow: the copy says KO_THEN, the player rewrote the leg to KO_NOW — the verification compares the COPY\'s instant (mismatch)', async () => {
    flags.swapIdentity = 'shadow';
    const { stored } = await runTick(returnedKo(KO_NOW, KO_THEN));
    expect(exec.calls[0][7]).toEqual({ identityMode: 'shadow', expectedOut: { symbol: 'KO', swappedInAt: KO_THEN } });
    expect(stored.trades[0].verification).toMatchObject({ verdict: 'mismatch', basis: 'symbol_and_entry', expected: { symbol: 'KO', swappedInAt: KO_THEN } });
  });

  it('enforce: the same — the stale position is refused on the copy\'s belief, whatever the leg claims', async () => {
    flags.swapIdentity = 'enforce';
    const { stored } = await runTick(returnedKo(KO_NOW, KO_THEN));
    expect(stored.trades).toEqual([]);
    expect(meetingRow(stored).legRefusals[0]).toMatchObject({ reason: 'outgoing_identity_mismatch', verification: { expected: { symbol: 'KO', swappedInAt: KO_THEN } } });
  });

  it('enforce: and the reverse — the copy names the live position, the player\'s stale instant on the leg changes nothing (it trades)', async () => {
    flags.swapIdentity = 'enforce';
    const { stored } = await runTick(returnedKo(KO_THEN, KO_NOW));
    expect(stored.trades.map((t) => t.symbolIn)).toEqual(['AMD']);
    expect(stored.trades[0].verification).toMatchObject({ verdict: 'match', expected: { symbol: 'KO', swappedInAt: KO_NOW } });
  });

  it('a leg the copy stored WITHOUT an instant is checked by symbol only (the creation picture could not place it)', async () => {
    flags.swapIdentity = 'shadow';
    const { stored } = await runTick(withCopy(approvedMeeting([{ ...KO_AMD, swappedInAt: KO_THEN }]), [{ symbolOut: 'KO', symbolIn: 'AMD' }]));
    expect(stored.trades[0].verification).toMatchObject({ basis: 'symbol_only', verdict: 'match' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the deadline — the model waits only for a meeting the copy names, and only until the COPY\'s expiresAt', () => {
  const pending = (meetingExpiresAt, copyExpiresAt) => {
    const b = makeTickBattle(serverMeetingOverrides({ status: 'pending', diagnosis: 'drag', expiresAt: meetingExpiresAt, suggestedSwaps: [] }));
    b.cronState.gameplanMeeting.expiresAt = copyExpiresAt;
    return b;
  };

  it('before the copy\'s deadline: the model waits (no model call), the meeting stays pending', async () => {
    const { modelCalls, stored } = await runTick(pending(LATER, LATER));
    expect(modelCalls).toBe(0);
    expect(stored.gameplanMeeting.status).toBe('pending');
  });

  it('a planted FAR deadline on the meeting does not extend the wait: past the copy\'s deadline it expires, and the model runs', async () => {
    const { modelCalls, stored, feed } = await runTick(pending('2099-01-01T00:00:00.000Z', '2026-09-09T14:00:00.000Z'));
    expect(modelCalls).toBe(1);
    expect(stored.gameplanMeeting).toBeNull();
    expect(meetingRow(stored).status).toBe('expired');
    expect(stored.cronState.gameplanMeeting).toBeNull();
    expect(gameplanBeats(feed).map((b) => b.message)).toEqual(['Gameplan meeting expired. Continuing with current strategy.']);
  });

  it('a planted EARLY deadline does not cut the wait short either: the copy\'s deadline governs', async () => {
    const { modelCalls, stored } = await runTick(pending('2026-09-09T10:00:00.000Z', LATER));
    expect(modelCalls).toBe(0);
    expect(stored.gameplanMeeting.status).toBe('pending');
  });

  it('an unreadable copy deadline waits for nothing', async () => {
    const { modelCalls, stored } = await runTick(pending(LATER, 'not a date'));
    expect(modelCalls).toBe(1);
    expect(meetingRow(stored).status).toBe('expired');
  });

  for (const [label, battle] of [
    ['a pending meeting with NO copy (planted, or from before this deploy)', () => makeTickBattle({ gameplanMeeting: { id: 'gpm_x', status: 'pending', diagnosis: 'drag', expiresAt: '2099-01-01T00:00:00.000Z', suggestedSwaps: [{ ...KO_AMD }] } })],
    ['a pending meeting whose id the copy does not name', () => { const b = pending('2099-01-01T00:00:00.000Z', LATER); b.gameplanMeeting.id = 'gpm_forged'; return b; }],
    ['a pending meeting whose deadline cannot be read and that has no copy (the integrity build\'s I1-8 mute)', () => makeTickBattle({ gameplanMeeting: { status: 'pending', diagnosis: 'drag', expiresAt: { not: 'a date' } } })],
  ]) {
    it(`${label}: never makes the model wait, never trades, and is left as it is`, async () => {
      const b = battle();
      const meeting = deepClone(b.gameplanMeeting);
      const { modelCalls, stored } = await runTick(b);
      expect(modelCalls).toBe(1);
      expect(exec.calls).toEqual([]);
      expect(stored.gameplanMeeting).toEqual(meeting);
    });
  }

  it('a pending meeting with no copy whose OWN deadline has passed expires as before (a meeting from before this deploy clears on time)', async () => {
    const { modelCalls, stored } = await runTick(makeTickBattle({ gameplanMeeting: { id: 'gpm_old', status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T14:00:00.000Z', suggestedSwaps: [] } }));
    expect(modelCalls).toBe(1);
    expect(meetingRow(stored)).toMatchObject({ id: 'gpm_old', status: 'expired', resolvedBy: 'system' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the integrity build\'s +497 eviction probe (its §5, reviewers I1 / IV1) now fails', () => {
  /** 50 banked trades at −10 points each: the 50-row `trades[]` is full. */
  const fullBook = (over = {}) => makeTickBattle({
    trades: Array.from({ length: 50 }, (_, i) => ({
      symbolOut: 'OLD', symbolIn: 'OLD2', name: 'Old', tier: 'support', slotIndex: 1, entryPrice: 10, exitPrice: 9, lockedPoints: -10,
      lockedGainPct: -10, swappedOutAt: `2026-09-0${1 + (i % 8)}T15:00:00.000Z`, swapDay: 1, isCrypto: false, direction: null, id: `trade_${i}`,
    })),
    scoreState: { ...makeTickBattle().scoreState, tradeCount: 50, bankedScore: -500 },
    ...over,
  });
  /** 50 round-trip legs KO ↔ AMD, each worth ≈ 0 points. */
  const churn = () => Array.from({ length: 50 }, (_, i) => (i % 2 === 0 ? { symbolOut: 'KO', symbolIn: 'AMD', rationale: 'r' } : { symbolOut: 'AMD', symbolIn: 'KO', rationale: 'r' }));

  it('a planted approved meeting of 50 round-trip legs: nothing trades, and the next check still banks −500', async () => {
    const first = await runTick(fullBook({ gameplanMeeting: { id: 'gpm_planted', ...approvedMeeting(churn()) } }));
    expect(exec.calls).toEqual([]);
    expect(first.stored.trades.every((t) => t.lockedPoints === -10)).toBe(true);
    const second = await runTick(deepClone(first.stored));
    expect(second.stored.scoreState.bankedScore).toBe(-500);
  });

  it('the same 50 legs written into a REAL meeting (its copy holds one leg): only that leg runs — one row, never 50', async () => {
    const battle = fullBook(serverMeetingOverrides(approvedMeeting(churn()), { legs: [{ symbolOut: 'KO', symbolIn: 'AMD', swappedInAt: null }] }));
    const first = await runTick(battle);
    expect(exec.calls).toHaveLength(1);
    expect(first.stored.trades.filter((t) => t.lockedPoints === -10)).toHaveLength(49); // one old row out, not fifty
    expect(meetingRow(first.stored).heldLegCount).toBe(49);
    const second = await runTick(deepClone(first.stored));
    expect(second.stored.scoreState.bankedScore).toBeLessThan(-480);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Review K1-1 / K3-1 / K2-3: the copy lives exactly as long as its meeting sits
// in the battle. A player who deletes, replaces or renames the meeting retires
// the copy at the next check — the server's legs can then never be brought back
// at a time the player picks.
describe('the copy is retired once its meeting is gone (review K1-1 / K3-1)', () => {
  const LATE = '2026-09-11T15:00:00.000Z';
  const created = () => withCopy({ status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T16:00:00.000Z', suggestedSwaps: [{ ...KO_AMD }] });

  for (const [label, edit] of [
    ['deleted (null)', (b) => { b.gameplanMeeting = null; }],
    ['deleted (the key removed)', (b) => { delete b.gameplanMeeting; }],
    ['replaced by a non-object', (b) => { b.gameplanMeeting = 'x'; }],
    ['renamed, with a far deadline of its own', (b) => { b.gameplanMeeting = { ...b.gameplanMeeting, id: 'gpm_renamed', expiresAt: '2099-01-01T00:00:00.000Z' }; }],
  ]) {
    it(`${label}: the next check retires the copy (one write), and the meeting written back approved later runs nothing`, async () => {
      const battle = created();
      edit(battle);
      const first = await runTick(battle);
      expect(first.stored.cronState.gameplanMeeting).toBeNull();
      expect(first.db.__updates.filter((u) => Object.hasOwn(u, 'cronState.gameplanMeeting'))).toEqual([{ 'cronState.gameplanMeeting': null }]);
      expect(first.modelCalls).toBe(1);
      // Two days later the player writes the server's meeting back, approved.
      vi.setSystemTime(new Date(LATE));
      const replay = deepClone(first.stored);
      replay.gameplanMeeting = { id: FIXTURE_MEETING_ID, ...approvedMeeting([{ ...KO_AMD }]) };
      exec.calls = [];
      const second = await runTick(replay);
      expect(exec.calls).toEqual([]);
      expect(second.stored.trades).toEqual([]);
      expect(meetingRow(second.stored)).toMatchObject({ heldLegCount: 1 });
    });
  }

  it('a server meeting left in place keeps its copy (no extra write) while it waits', async () => {
    const battle = withCopy({ status: 'pending', diagnosis: 'drag', expiresAt: LATER, suggestedSwaps: [{ ...KO_AMD }] });
    const { db, stored } = await runTick(battle);
    expect(db.__updates.some((u) => Object.hasOwn(u, 'cronState.gameplanMeeting'))).toBe(false);
    expect(stored.cronState.gameplanMeeting.meetingId).toBe(FIXTURE_MEETING_ID);
  });
});

// Review K1-3: a meeting the server never created is filed without a feed beat.
describe('a meeting the copy does not name writes no feed beat (review K1-3)', () => {
  for (const [label, meeting] of [
    ['rejected', { id: 'gpm_planted', status: 'rejected', diagnosis: 'drag', expiresAt: LATER, suggestedSwaps: [] }],
    ['pending past its own deadline', { id: 'gpm_planted', status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T14:00:00.000Z', suggestedSwaps: [] }],
  ]) {
    it(`${label}: filed into the history, no beat — re-planting it every check adds none`, async () => {
      let battle = makeTickBattle({ gameplanMeeting: deepClone(meeting) });
      for (let i = 0; i < 3; i++) {
        const { stored, feed } = await runTick(battle);
        expect(gameplanBeats(feed)).toEqual([]);
        expect(stored.gameplanMeeting).toBeNull();
        battle = { ...deepClone(stored), gameplanMeeting: deepClone(meeting) };
      }
    });
  }

  it('the server\'s own rejected and expired meetings keep their beats', async () => {
    const rejected = await runTick(withCopy({ ...approvedMeeting([{ ...KO_AMD }]), status: 'rejected' }));
    expect(gameplanBeats(rejected.feed).map((b) => b.message)).toEqual(['Gameplan rejected by Coach. Holding current positions.']);
    const expired = await runTick(withCopy({ status: 'pending', diagnosis: 'drag', expiresAt: '2026-09-09T14:00:00.000Z', suggestedSwaps: [] }));
    expect(gameplanBeats(expired.feed).map((b) => b.message)).toEqual(['Gameplan meeting expired. Continuing with current strategy.']);
  });
});

// Review K2-2: the copy stores a leg's entry instant exactly when P6 stamped one
// on the leg (mode ≠ off), so a meeting created at off is checked by symbol only
// after a flip — as it was before this build.
describe('a meeting created at off and approved after a flip is checked as before (review K2-2)', () => {
  it('created at off → approved at enforce: the copy holds no instant, the belief is symbol-only, the returned stock trades as at the base', async () => {
    const armed = makeTickBattle();
    delete armed.cronState.lastGameplanDate;
    flags.swapIdentity = 'off';
    const created = await runTick(armed);
    const copy = created.stored.cronState.gameplanMeeting;
    expect(copy.legs.every((l) => !Object.hasOwn(l, 'swappedInAt'))).toBe(true);
    flags.swapIdentity = 'enforce';
    const approvedBattle = deepClone(created.stored);
    approvedBattle.gameplanMeeting = { ...approvedBattle.gameplanMeeting, status: 'approved' };
    exec.calls = [];
    const approved = await runTick(approvedBattle);
    expect(exec.calls.length).toBeGreaterThan(0);
    for (const call of exec.calls) expect(call[7].expectedOut).not.toHaveProperty('swappedInAt');
  });
});

// Review KV3 (on KV1's proposal for K1-1): the copy bounds WHICH legs run, never
// WHEN. The detector's deadline is 16:00 server-local (UTC) = noon ET in summer,
// so a meeting filed in the afternoon is born past its deadline: the next check
// expires it unless the player approved first — and that approval runs, today
// and here. So does one approved after the day's last check and reached the next
// morning. A deadline on approvals would hold both (report §3, founder question).
describe('no deadline on approval — a server meeting approved past its expiresAt runs, as today (review KV3)', () => {
  const DEADLINE = '2026-09-09T16:00:00.000Z';

  it('born past its deadline (filed 18:00Z) and approved before the next check — or reached the next morning: the stored leg runs', async () => {
    for (const iso of ['2026-09-09T16:15:00.000Z', '2026-09-09T18:15:00.000Z', '2026-09-10T13:45:00.000Z']) {
      exec.calls = [];
      vi.setSystemTime(new Date(iso));
      const { stored } = await runTick(withCopy(approvedMeeting([{ ...KO_AMD }], { createdAt: '2026-09-09T18:00:00.000Z', expiresAt: DEADLINE })));
      expect(exec.calls, iso).toHaveLength(1);
      expect(stored.trades.map((t) => t.symbolIn), iso).toEqual(['AMD']);
      expect(meetingRow(stored), iso).not.toHaveProperty('heldLegs');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integrity follow-up 2, review K5 (the mutation lens): rows that kill mutants
// the rows above let survive (report §12.3; the M5-n ids are its mutant table).
describe('K5 — the PAIR must match, not either half (M5-8 / M5-9)', () => {
  for (const mode of MODES) {
    it(`${mode}: a leg sharing only its incoming, or only its outgoing, stock with the stored leg is held — never run as the stored leg`, async () => {
      flags.swapIdentity = mode;
      for (const planted of [{ symbolOut: 'PG', symbolIn: 'AMD', rationale: 'same incoming' }, { symbolOut: 'KO', symbolIn: 'JPM', rationale: 'same outgoing' }]) {
        exec.calls = [];
        const { stored } = await runTick(withCopy(approvedMeeting([planted])));
        expect(exec.calls, planted.rationale).toEqual([]);
        expect(stored.trades, planted.rationale).toEqual([]);
        expect(meetingRow(stored), planted.rationale).toMatchObject({ heldLegCount: 1, heldLegs: [{ symbolOut: planted.symbolOut, symbolIn: planted.symbolIn, reason: LEG_NOT_PROPOSED }] });
      }
    });
  }
});

describe('K5 — a suggestedSwaps that is not a list holds no legs (M5-152)', () => {
  it('an array-LIKE map (`{ length, 0: leg }`) naming the stored pair runs nothing — the reader accepts only a real list', async () => {
    const { stored } = await runTick(withCopy(approvedMeeting({ length: 1, 0: { ...KO_AMD } })));
    expect(exec.calls).toEqual([]);
    expect(stored.trades).toEqual([]);
  });
});

describe('K5 — meetingCopy.js pins each layer of the match on its own (nit: M5-5 / M5-10 / M5-12 / M5-15)', () => {
  it('a copy that does not name the meeting plans nothing and waits for nothing, even when handed in directly; malformed shapes never match or throw', async () => {
    const { planApprovedLegs, meetingWaitUntilMs, meetingMatchesCopy } = await import('../_utils/meetingCopy.js');
    const copy = { meetingId: 'gpm_1', expiresAt: '2099-01-01T00:00:00.000Z', legs: [null, { symbolOut: 'KO', symbolIn: 'AMD' }] };
    const forged = { id: 'gpm_2', suggestedSwaps: [{ symbolOut: 'KO', symbolIn: 'AMD' }] };
    const legs = [{ index: 0, leg: forged.suggestedSwaps[0] }];
    expect(planApprovedLegs(forged, legs, copy)).toEqual([{ index: 0, leg: forged.suggestedSwaps[0], run: null }]);
    expect(meetingWaitUntilMs(forged, copy)).toBeNull();
    const real = { ...forged, id: 'gpm_1' };
    expect(planApprovedLegs(real, legs, copy)).toEqual([{ index: 0, leg: forged.suggestedSwaps[0], run: copy.legs[1] }]);
    expect(meetingWaitUntilMs(real, copy)).toBe(Date.parse('2099-01-01T00:00:00.000Z'));
    expect(meetingMatchesCopy(Object.assign([], { id: 'gpm_1' }), copy)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enforce readiness (founder Q4 — review K1-2 of follow-up 2): a matched leg's
// trade row carries the COPY's rationale. Acceptance 3. The byte-identical half
// for an unedited server meeting is in agent-evaluate.meetingCopy.baseline.test.js.
describe('enforce readiness — the matched leg’s rationale is the server’s copy', () => {
  const SERVER_WORDS = 'KO down 1.2%, AMD (Technology) has tech score 80.';
  const PLANTED = 'PLANTED — the player rewrote this leg’s reasoning. '.repeat(40); // > 1000 chars
  const copyLeg = (over = {}) => ({ symbolOut: 'KO', symbolIn: 'AMD', rationale: SERVER_WORDS, swappedInAt: null, ...over });
  const tradeOf = (stored) => stored.trades.find((t) => t.symbolIn === 'AMD') ?? null;

  for (const mode of MODES) {
    it(`${mode}: a planted rationale on the meeting never reaches the row — the copy's own words do`, async () => {
      flags.swapIdentity = mode;
      const { stored } = await runTick(withCopy(approvedMeeting([{ ...KO_AMD, rationale: PLANTED }]), [copyLeg()]));
      const row = tradeOf(stored);
      expect(row, 'the leg traded').not.toBeNull();
      expect(row.rationale).toBe(SERVER_WORDS);
      expect(JSON.stringify(stored.trades)).not.toContain('PLANTED');
      // The executor was handed the copy's words, not the meeting's.
      expect(JSON.stringify(exec.calls)).not.toContain('PLANTED');
    });
  }

  it('a non-string planted rationale (an object, a number) changes nothing either', async () => {
    for (const planted of [{ lockedPoints: 9999 }, 9999, ['x']]) {
      exec.calls = [];
      const { stored } = await runTick(withCopy(approvedMeeting([{ ...KO_AMD, rationale: planted }]), [copyLeg()]));
      expect(tradeOf(stored).rationale, JSON.stringify(planted)).toBe(SERVER_WORDS);
    }
  });

  it('a copy that stored no words for the leg (`rationale: null`) gives the row none — the meeting’s are never used for it', async () => {
    const { stored } = await runTick(withCopy(approvedMeeting([{ ...KO_AMD, rationale: PLANTED }]), [copyLeg({ rationale: null })]));
    expect(tradeOf(stored).rationale).toBeNull();
  });

  it('a copy stored BEFORE this build (no `rationale` key) keeps today’s behaviour: the meeting’s rationale, capped at 1000', async () => {
    const legacy = { symbolOut: 'KO', symbolIn: 'AMD', swappedInAt: null };
    const { stored } = await runTick(withCopy(approvedMeeting([{ ...KO_AMD, rationale: PLANTED }]), [legacy]));
    expect(tradeOf(stored).rationale).toBe(PLANTED.slice(0, 1000));
    const unedited = await runTick(withCopy(approvedMeeting([{ ...KO_AMD, rationale: SERVER_WORDS }]), [legacy]));
    expect(tradeOf(unedited.stored).rationale).toBe(SERVER_WORDS);
  });

  it('an unedited server meeting with a new copy writes the same row as with a pre-build copy (the stored words ARE the meeting’s)', async () => {
    const meeting = () => approvedMeeting([{ ...KO_AMD, rationale: SERVER_WORDS }]);
    const withWords = await runTick(withCopy(meeting(), [copyLeg()]));
    const rowNew = JSON.stringify(withWords.stored.trades);
    exec.calls = [];
    const legacy = await runTick(withCopy(meeting(), [{ symbolOut: 'KO', symbolIn: 'AMD', swappedInAt: null }]));
    expect(rowNew).toBe(JSON.stringify(legacy.stored.trades));
  });

  it('the pure helpers: the copy stores each leg’s rationale capped; a matched leg reads the copy’s when it has the key', () => {
    const copy = serverMeetingCopy({ id: 'gpm_1', createdAt: 'c', expiresAt: 'e', suggestedSwaps: [
      { symbolOut: 'KO', symbolIn: 'AMD', rationale: 'w'.repeat(1500) },
      { symbolOut: 'PG', symbolIn: 'NVDA', rationale: { not: 'text' }, swappedInAt: null },
    ] });
    expect(copy.legs).toEqual([
      { symbolOut: 'KO', symbolIn: 'AMD', rationale: 'w'.repeat(1000) },
      { symbolOut: 'PG', symbolIn: 'NVDA', rationale: null, swappedInAt: null },
    ]);
    expect(Object.keys(copy.legs[1])).toEqual(['symbolOut', 'symbolIn', 'rationale', 'swappedInAt']);
    expect(legRationaleSource({ rationale: 'server' }, { rationale: 'meeting' })).toBe('server');
    expect(legRationaleSource({ rationale: null }, { rationale: 'meeting' })).toBeNull();
    expect(legRationaleSource({ symbolOut: 'KO' }, { rationale: 'meeting' })).toBe('meeting');
    expect(legRationaleSource({ symbolOut: 'KO' }, null)).toBeUndefined();
  });
});
