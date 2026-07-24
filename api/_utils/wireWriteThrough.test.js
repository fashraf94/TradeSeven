// api/_utils/wireWriteThrough.test.js
// FantasyTimes Wire — write choreography acceptance (Spec V1.5 §9):
// uniform envelopes (F2-1), error-channel hygiene (F2-3), inline receipt
// no-op (F2-10), private extraction, per-outcome artifacts, index rebuild,
// chain serialization (B6) / stability / gap-rooting / family isolation,
// and flag-off passthrough.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFirestoreFake } from './__fixtures__/wireFirestoreFake.js';

// Mutable flag state — wireFlags is mocked so each test picks its mode.
const flagState = { metricsEnabled: false, writesEnabled: true, continuityEnabled: false };
vi.mock('./wireFlags.js', () => ({
  getWireFlags: () => ({ ...flagState }),
}));

const {
  publishStoryWithWire,
  runWireTransactionFromEnvelope,
} = await import('./wireWriteThrough.js');
const { WIRE_OUTCOMES } = await import('./wireContracts.js');

const MARKET_DATE = '2026-07-24';
const NOW = new Date('2026-07-24T18:00:00Z');

const baseStoryDoc = () => ({
  reporter: 'doug',
  type: 'earnings_recap',
  headline: 'NVDA crushes it',
  body: 'body text',
  tickers: ['NVDA'],
  primaryTicker: 'NVDA',
  sentiment: 'bullish',
  recommended_action: 'EARNINGSGAME',
  publishedAt: NOW,
  status: 'published',
});

const goodFacts = () => ({
  eventType: 'earnings_recap',
  tickers: ['NVDA'],
  direction: 'up',
  magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' },
  keyLevel: { price: 148.5, type: 'prior_high' },
  figures: [{ value: 5.2, unit: 'pct', basis: 'gap_vs_prior_close' }],
  qualifiers: ['guidance_raised'],
});

const publish = (db, overrides = {}) =>
  publishStoryWithWire(db, {
    storyDoc: baseStoryDoc(),
    rawAgentFacts: goodFacts(),
    stopReason: 'tool_use',
    reporter: 'doug',
    seam: 'doug_earnings_recap',
    primaryTicker: 'NVDA',
    triggerRef: 'NVDA:2026-07-24',
    marketDate: MARKET_DATE,
    now: NOW,
    ...overrides,
  });

let db;
beforeEach(() => {
  db = createFirestoreFake();
  flagState.metricsEnabled = false;
  flagState.writesEnabled = true;
  flagState.continuityEnabled = false;
});

describe('flags off — byte-identical persistence behavior', () => {
  it('plain .add of the storyDoc; no wire fields, no envelope, no wire doc', async () => {
    flagState.writesEnabled = false;
    const { storyRef, wire } = await publish(db);
    expect(wire).toBeNull();
    const stored = (await storyRef.get()).data();
    expect(stored).toEqual(JSON.parse(JSON.stringify(baseStoryDoc())));
    expect(stored.wirePending).toBeUndefined();
    expect(stored.wireValidation).toBeUndefined();
    const dump = db._dump();
    expect(Object.keys(dump).some((k) => k.startsWith('fantasyTimesWireEnvelopes/'))).toBe(false);
    expect(Object.keys(dump).some((k) => k.startsWith('fantasyTimesWire/'))).toBe(false);
  });
});

describe('uniform envelopes (F2-1) — every outcome writes one', () => {
  const CASES = [
    ['passed', goodFacts(), 'tool_use', WIRE_OUTCOMES.PASSED],
    ['salvaged', { ...goodFacts(), keyLevel: { price: 'x', type: 'prior_high' } }, 'tool_use', WIRE_OUTCOMES.SALVAGED],
    ['quarantined', { ...goodFacts(), tickers: ['ZZZOFF'] }, 'tool_use', WIRE_OUTCOMES.QUARANTINED],
    ['rejected', { ...goodFacts(), tradeBias: 'long' }, 'tool_use', WIRE_OUTCOMES.REJECTED],
    ['truncated', goodFacts(), 'max_tokens', WIRE_OUTCOMES.TRUNCATED],
  ];

  for (const [label, facts, stopReason, expectedOutcome] of CASES) {
    it(`${label}: envelope written with outcome, then cleaned up on success`, async () => {
      // Fresh db per case; defer the transaction so the envelope survives for inspection.
      const local = createFirestoreFake();
      const { storyRef, wire } = await publishStoryWithWire(local, {
        storyDoc: baseStoryDoc(),
        rawAgentFacts: facts,
        stopReason,
        reporter: 'doug',
        seam: 'doug_earnings_recap',
        primaryTicker: 'NVDA',
        triggerRef: `case:${label}`,
        marketDate: MARKET_DATE,
        now: NOW,
        deferTransaction: true,
      });
      expect(wire.outcome).toBe(expectedOutcome);
      const env = (await local.collection('fantasyTimesWireEnvelopes').doc(storyRef.id).get());
      expect(env.exists).toBe(true);
      expect(env.data().outcome).toBe(expectedOutcome);
      expect(env.data().payloadHash).toMatch(/^[0-9a-f]{64}$/);
      expect((await storyRef.get()).data().wirePending).toBe(true);
    });
  }

  it('inline success path cleans up: wirePending false, envelope deleted, receipt present', async () => {
    const { storyRef, wire } = await publish(db);
    expect(wire.txStatus).toBe('committed');
    const story = (await storyRef.get()).data();
    expect(story.wirePending).toBe(false);
    expect(story.wireConflict).toBeUndefined();
    expect((await db.collection('fantasyTimesWireEnvelopes').doc(storyRef.id).get()).exists).toBe(false);
    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.validationStats.attempted).toBe(1);
    expect(day.validationStats.passed).toBe(1);
    expect(Object.keys(day.receipts)).toHaveLength(1);
    expect(day.entries).toHaveLength(1);
  });
});

describe('public story doc hygiene (F2-3 + private extraction)', () => {
  it('wireValidation carries class codes ONLY; poisoned model strings never reach the story doc', async () => {
    const POISON_KEY = 'buy_NVDA_immediately_directive';
    const POISON_VALUE = 'ALL-IN ON NVDA CALLS';
    const facts = { ...goodFacts(), [POISON_KEY]: POISON_VALUE };
    const { storyRef, wire } = await publish(db, { rawAgentFacts: facts, triggerRef: 'poison' });
    expect(wire.outcome).toBe(WIRE_OUTCOMES.REJECTED);

    const storyJson = JSON.stringify((await storyRef.get()).data());
    expect(storyJson).not.toContain(POISON_KEY);
    expect(storyJson).not.toContain(POISON_VALUE);
    // class codes only — every element matches the CODE grammar
    const validation = (await storyRef.get()).data().wireValidation;
    expect(validation.outcome).toBe(WIRE_OUTCOMES.REJECTED);
    for (const code of validation.codes) {
      expect(code).toMatch(/^(R\d|SALVAGE|F\d)[A-Z0-9_]*$/);
    }
    expect(storyJson).not.toContain('reasons');
  });

  it('agentFacts never appears on the story doc at any depth (all outcomes)', async () => {
    const { storyRef } = await publish(db, { triggerRef: 'private-extraction' });
    const storyJson = JSON.stringify((await storyRef.get()).data());
    expect(storyJson).not.toContain('agentFacts');
    expect(storyJson).not.toContain('eps_vs_consensus');
  });
});

describe('per-outcome transaction artifacts', () => {
  it('REJECT: receipt + stats only — no entry', async () => {
    await publish(db, { rawAgentFacts: { ...goodFacts(), tradeBias: 'x' }, triggerRef: 'rej' });
    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.entries).toHaveLength(0);
    expect(day.validationStats.rejected).toBe(1);
    expect(day.receipts['doug_earnings_recap:rej:2026-07-24'].outcome).toBe('rejected');
    // full reasons live server-side on the receipt (bounded)
    expect(day.receipts['doug_earnings_recap:rej:2026-07-24'].reasons.length).toBeGreaterThan(0);
  });

  it('QUARANTINE: flagged entry excluded from BOTH indexes', async () => {
    await publish(db, { rawAgentFacts: { ...goodFacts(), tickers: ['ZZZOFF'] }, primaryTicker: 'ZZZOFF', triggerRef: 'q' });
    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.entries).toHaveLength(1);
    expect(day.entries[0].quarantined).toBe(true);
    expect(day.bySymbol).toEqual({});
    expect(day.macroEntries).toEqual([]);
    expect(day.validationStats.quarantined).toBe(1);
  });

  it('PASS: entry with digest + chainId + indexes; macro eligibility for econ_print', async () => {
    const { storyRef } = await publish(db, { triggerRef: 'pass1' });
    await publishStoryWithWire(db, {
      storyDoc: { ...baseStoryDoc(), reporter: 'neta', type: 'econ_recap', primaryTicker: null },
      rawAgentFacts: {
        eventType: 'econ_print', tickers: [], direction: 'up',
        magnitude: { value: 0.2, unit: 'pp', basis: 'print_vs_expected' },
      },
      stopReason: 'tool_use',
      reporter: 'neta',
      seam: 'neta_econ_recap',
      primaryTicker: null,
      triggerRef: 'cpi',
      marketDate: MARKET_DATE,
      now: NOW,
    });
    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.entries).toHaveLength(2);
    const [earnings, econ] = day.entries;
    expect(earnings.agentFacts.digest).toBe(
      'NVDA earnings: EPS +8.2% vs consensus; guidance raised; gap +5.2% vs prior close; above prior high 148.50.'
    );
    expect(earnings.agentFacts.chainId).toBe(storyRef.id); // self-rooted
    expect(day.bySymbol.NVDA).toEqual([storyRef.id]);
    expect(econ.agentFacts.macroEligible).toBe(true);
    expect(day.macroEntries).toEqual([econ.storyId]);
  });
});

describe('inline receipt no-op (F2-10) + stats non-reincrement (B5)', () => {
  it('a DST double-fire arriving INLINE with the same key+payload no-ops', async () => {
    const first = await publish(db, { triggerRef: 'dupfire' });
    expect(first.wire.txStatus).toBe('committed');
    const before = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();

    const second = await publish(db, { triggerRef: 'dupfire' });
    expect(second.wire.txStatus).toBe('receipt_hit');
    const after = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(after.entries).toHaveLength(1);
    expect(after.validationStats).toEqual(before.validationStats); // no re-increment
    // the second story is cleaned up as success (receipt hit IS success)
    expect((await second.storyRef.get()).data().wirePending).toBe(false);
  });

  it('same key with a DIFFERENT payload is STILL an inline no-op — a changed payload on retry is a no-op, not a repair (B5)', async () => {
    await publish(db, { triggerRef: 'changedpayload' });
    const facts = goodFacts();
    facts.magnitude.value = 9.9;
    const second = await publish(db, { rawAgentFacts: facts, triggerRef: 'changedpayload' });
    expect(second.wire.txStatus).toBe('receipt_hit'); // first receipt wins
    const story = (await second.storyRef.get()).data();
    expect(story.wireConflict).toBeUndefined(); // the inline path never marks conflicts
    expect(story.wirePending).toBe(false);
    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.validationStats.idempotencyConflicts).toBe(0); // conflicts are sweep-side (§4.7)
    expect(day.entries).toHaveLength(1);
    // the day doc still records the FIRST payload's receipt untouched
    const receipt = day.receipts['doug_earnings_recap:changedpayload:2026-07-24'];
    expect(receipt.storyId).not.toBe(second.storyRef.id);
  });
});

describe('chains (B6/D2)', () => {
  const econEnvelope = (storyId, marketDate, { reporter = 'neta', primaryTicker = null } = {}) => ({
    storyId,
    seam: 'neta_econ_recap',
    reporter,
    storyType: 'econ_recap',
    idempotencyKey: `neta_econ_recap:cpi-${storyId}:${marketDate}`,
    payloadHash: `hash-${storyId}`,
    marketDate,
    outcome: 'passed',
    modelAgentFacts: {
      eventType: 'econ_print', tickers: [], direction: 'up',
      magnitude: { value: 0.2, unit: 'pp', basis: 'print_vs_expected' },
      keyLevel: null, figures: [], qualifiers: [],
    },
    validatorResult: {
      outcome: 'passed', codes: [], reasons: [],
      offUniverseTickers: [], preStripTickerCount: 0, quarantined: false,
      validatorVersion: '1.5.0',
    },
    primaryTicker,
    headline: `h-${storyId}`,
    publishedAt: new Date(`${marketDate}T15:00:00Z`),
    createdAt: new Date(`${marketDate}T15:00:00Z`),
  });

  it('two CONCURRENT same-chain stories serialize to one chain (no dual roots)', async () => {
    const [a, b] = await Promise.all([
      runWireTransactionFromEnvelope(db, econEnvelope('sA', MARKET_DATE), { now: NOW }),
      runWireTransactionFromEnvelope(db, econEnvelope('sB', MARKET_DATE), { now: NOW }),
    ]);
    expect([a.status, b.status]).toEqual(['committed', 'committed']);
    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.entries).toHaveLength(2);
    const chainIds = new Set(day.entries.map((e) => e.agentFacts.chainId));
    expect(chainIds.size).toBe(1); // second inherited the first's root
  });

  it('a 7-session sequence holds ONE stable chainId', async () => {
    // 7 consecutive sessions ending 2026-07-24 (Thu 16, Fri 17, Mon 20…Fri 24)
    const dates = ['2026-07-16', '2026-07-17', '2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24'];
    for (let i = 0; i < dates.length; i++) {
      await runWireTransactionFromEnvelope(db, econEnvelope(`s${i}`, dates[i]), { now: NOW });
    }
    const lastDay = (await db.collection('fantasyTimesWire').doc('2026-07-24').get()).data();
    expect(lastDay.entries[0].agentFacts.chainId).toBe('s0');
  });

  it('a >5-session gap starts a NEW self-rooted chain', async () => {
    await runWireTransactionFromEnvelope(db, econEnvelope('old', '2026-07-14'), { now: NOW });
    // 2026-07-14 is 7 sessions before 2026-07-23 (15,16,17,20,21,22,23) — outside the 5-prior window
    await runWireTransactionFromEnvelope(db, econEnvelope('fresh', '2026-07-23'), { now: NOW });
    const day = (await db.collection('fantasyTimesWire').doc('2026-07-23').get()).data();
    expect(day.entries[0].agentFacts.chainId).toBe('fresh');
  });

  it('cross-FAMILY same-reporter stories do NOT merge', async () => {
    // Kai: index_move (macro family) then technical_break (technical family) on the same day
    const kaiEnv = (storyId, facts, primaryTicker) => ({
      ...econEnvelope(storyId, MARKET_DATE, { reporter: 'kai', primaryTicker }),
      seam: 'kai_pulse',
      idempotencyKey: `kai_pulse:${storyId}:${MARKET_DATE}`,
      modelAgentFacts: facts,
    });
    await runWireTransactionFromEnvelope(db, kaiEnv('k1', {
      eventType: 'index_move', tickers: [], direction: 'down',
      magnitude: { value: -1.1, unit: 'pct', basis: 'index_vs_prior_close' },
      keyLevel: null, figures: [], qualifiers: [],
    }, null), { now: NOW });
    await runWireTransactionFromEnvelope(db, kaiEnv('k2', {
      eventType: 'technical_break', tickers: ['AAPL'], direction: 'up',
      magnitude: { value: 2.0, unit: 'pct', basis: 'price_vs_level' },
      keyLevel: null, figures: [], qualifiers: [],
    }, 'AAPL'), { now: NOW });
    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.entries[0].agentFacts.chainId).toBe('k1');
    expect(day.entries[1].agentFacts.chainId).toBe('k2'); // self-rooted, no merge
  });
});

describe('deferTransaction (poll-batch 10s contract)', () => {
  it('stamps story+envelope+wirePending and does NOT transact', async () => {
    const { storyRef, wire } = await publish(db, { deferTransaction: true, triggerRef: 'deferred' });
    expect(wire.txStatus).toBe('deferred');
    expect((await storyRef.get()).data().wirePending).toBe(true);
    expect((await db.collection('fantasyTimesWireEnvelopes').doc(storyRef.id).get()).exists).toBe(true);
    expect((await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).exists).toBe(false);
  });
});
