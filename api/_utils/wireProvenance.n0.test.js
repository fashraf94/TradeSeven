// api/_utils/wireProvenance.n0.test.js
// Phase 2 N0 — envelope-borne provenance (F-B1 + companion ruling, R4-B1,
// R4-M3/M4). Matrix rows P2-22, P2-25, P2-30, P2-31, P2-32 (transaction
// half), P2-44.
//
// A6: each row's fault is the re-derivation or omission it guards against.
// The load-bearing premise (R4-M4, cited): provenance is STORED at batch
// time and NEVER re-derived at replay — every assertion below reads the
// entry the shared transaction produced from a stored envelope, not from
// runtime state.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFirestoreFake } from './__fixtures__/wireFirestoreFake.js';

const flagState = { metricsEnabled: false, writesEnabled: true, continuityEnabled: false };
vi.mock('./wireFlags.js', () => ({
  getWireFlags: () => ({ ...flagState }),
}));

const {
  publishStoryWithWire,
  runWireTransactionFromEnvelope,
} = await import('./wireWriteThrough.js');
const { runWireReplaySweep } = await import('./wireReplaySweep.js');
const { WIRE_SCHEMA_VERSION, WIRE_DIGEST_RENDERER_VERSION, WIRE_GENERATION_VERSION } = await import('./wireContracts.js');

const MARKET_DATE = '2026-07-24';
const NOW = new Date('2026-07-24T18:00:00Z');

const baseStoryDoc = () => ({
  reporter: 'doug', type: 'earnings_recap', headline: 'NVDA crushes it',
  body: 'body text', tickers: ['NVDA'], primaryTicker: 'NVDA',
  sentiment: 'bullish', recommended_action: 'EARNINGSGAME',
  publishedAt: NOW, status: 'published',
});

const goodFacts = () => ({
  eventType: 'earnings_recap', tickers: ['NVDA'], direction: 'up',
  magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' },
});

const TUPLE = Object.freeze({ generationVersion: 4, continuityEnabled: false });

const publish = (db, overrides = {}) =>
  publishStoryWithWire(db, {
    storyDoc: baseStoryDoc(), rawAgentFacts: goodFacts(), stopReason: 'tool_use',
    reporter: 'doug', seam: 'doug_earnings_recap', primaryTicker: 'NVDA',
    triggerRef: 'NVDA:2026-07-24', marketDate: MARKET_DATE, now: NOW,
    generationConfig: TUPLE,
    ...overrides,
  });

let db;
beforeEach(() => {
  db = createFirestoreFake();
  flagState.writesEnabled = true;
});

const dayEntries = () => db._dump()[`fantasyTimesWire/${MARKET_DATE}`]?.entries ?? [];

describe('P2-25: entries carry generationConfig; envelope carries the stamp + schemaVersion', () => {
  it('inline publish → entry.generationConfig is the caller tuple, byte-equal', async () => {
    await publish(db);
    const [entry] = dayEntries();
    expect(entry.generationConfig).toEqual({ generationVersion: 4, continuityEnabled: false });
    // The render-execution clock (R4-B1) is stamped where the digest rendered.
    expect(entry.agentFacts.digestRendererVersion).toBe(WIRE_DIGEST_RENDERER_VERSION);
    expect(entry.agentFacts.schemaVersion).toBe(WIRE_SCHEMA_VERSION);
  });

  it('the envelope persists schemaVersion + generationConfig before the transaction (deferred)', async () => {
    const { storyRef } = await publish(db, { deferTransaction: true });
    const env = db._dump()[`fantasyTimesWireEnvelopes/${storyRef.id}`];
    expect(env.generationConfig).toEqual(TUPLE);
    expect(env.schemaVersion).toBe(WIRE_SCHEMA_VERSION);
  });
});

describe('P2-22: replay stamp fidelity — the sweep replays the STORED tuple, never runtime state', () => {
  it('kill after batch → "bump" → sweep → replayed entry carries the OLD version', async () => {
    // Generation happened under an OLD epoch (version 3); the envelope
    // stores it. If the transaction re-derived from the runtime constant,
    // the entry would wear WIRE_GENERATION_VERSION instead — so the guard
    // tracks the LIVE constant, not a hardcoded number (review finding:
    // a hardcoded `.not.toBe(4)` went dead when the constant bumped past 4).
    const oldTuple = { generationVersion: 3, continuityEnabled: true };
    expect(oldTuple.generationVersion).not.toBe(WIRE_GENERATION_VERSION); // fixture must differ from live
    await publish(db, { deferTransaction: true, generationConfig: oldTuple });

    const summary = await runWireReplaySweep(db, { now: new Date(NOW.getTime() + 60_000) });
    expect(summary.replayed).toBe(1);
    const [entry] = dayEntries();
    expect(entry.generationConfig).toEqual(oldTuple);
    expect(entry.generationConfig.generationVersion).not.toBe(WIRE_GENERATION_VERSION);
  });
});

describe('P2-31: schemaVersion is envelope-borne, consistent with validatorVersion', () => {
  it('a foreign-schema envelope replays into an entry stamped with the ENVELOPE value', async () => {
    const { storyRef } = await publish(db, { deferTransaction: true });
    const envPath = `fantasyTimesWireEnvelopes/${storyRef.id}`;
    const env = db._dump()[envPath];
    // Simulate the straddle: the envelope was written under wire-1.5 code.
    await db.collection('fantasyTimesWireEnvelopes').doc(storyRef.id)
      .set({ ...env, schemaVersion: 'wire-1.5' });

    await runWireReplaySweep(db, { now: new Date(NOW.getTime() + 60_000) });
    const [entry] = dayEntries();
    expect(entry.agentFacts.schemaVersion).toBe('wire-1.5'); // NOT the code constant
    expect(entry.agentFacts.validatorVersion).toBe(env.validatorResult.validatorVersion);
  });
});

describe('P2-30: legacy sentinel — pre-N0 envelopes replay cleanly, never destroyed', () => {
  it('an envelope with NO generationConfig and NO schemaVersion → entry with explicit null + current-constant fallback', async () => {
    const { storyRef } = await publish(db, { deferTransaction: true, generationConfig: null });
    const envPath = `fantasyTimesWireEnvelopes/${storyRef.id}`;
    const env = db._dump()[envPath];
    // Strip to the exact pre-N0 shape (fields absent, not null).
    const legacy = { ...env };
    delete legacy.generationConfig;
    delete legacy.schemaVersion;
    await db.collection('fantasyTimesWireEnvelopes').doc(storyRef.id).set(legacy);

    const summary = await runWireReplaySweep(db, { now: new Date(NOW.getTime() + 60_000) });
    expect(summary.replayed).toBe(1);
    expect(summary.exhausted).toBe(0); // never replay_exhausted with facts deleted
    const [entry] = dayEntries();
    expect(entry.generationConfig).toBeNull();            // legacy, explicit
    expect(entry.agentFacts.schemaVersion).toBe(WIRE_SCHEMA_VERSION); // Amendment J fallback
    const story = (await storyRef.get()).data();
    expect(story.wirePending).toBe(false);
    expect(story.wireConflict).toBeUndefined();
  });
});

describe('P2-32 (transaction half): submit-time tuple + render-time renderer version separate cleanly', () => {
  it('mid-batch renderer-deploy shape: entry carries SUBMIT generationConfig and CURRENT digestRendererVersion', async () => {
    // The batch was submitted under an older generation epoch; the digest
    // renders NOW, at poll/replay. R4-B1: the two clocks must not mix.
    const submitTuple = { generationVersion: 2, continuityEnabled: false };
    await publish(db, {
      deferTransaction: true,
      generationConfig: submitTuple,
      generationSchemaVersion: 'wire-1.5',
      seam: 'doug_earnings_preview',
      triggerRef: 'NVDA:preview',
    });
    await runWireReplaySweep(db, { now: new Date(NOW.getTime() + 60_000) });
    const [entry] = dayEntries();
    expect(entry.generationConfig).toEqual(submitTuple);              // submit clock
    expect(entry.agentFacts.schemaVersion).toBe('wire-1.5');          // submit clock
    expect(entry.agentFacts.digestRendererVersion).toBe(WIRE_DIGEST_RENDERER_VERSION); // render clock
  });
});

describe('P2-44: provenance-divergent replay → superseded path, stored tuple byte-equal, counted once', () => {
  it('same idempotencyKey, envelope 1 fully settled, envelope 2 divergent tuple + SAME facts → superseded; straggler is a no-op', async () => {
    // Pin 1: same idempotencyKey — same seam/triggerRef/marketDate.
    // Envelope 1 settles fully (inline: entry + receipt + cleanup).
    await publish(db, { generationConfig: { generationVersion: 3, continuityEnabled: false } });
    const settled = dayEntries();
    expect(settled).toHaveLength(1);
    const storedTuple = JSON.stringify(settled[0].generationConfig);

    // Envelope 2: DIFFERENT storyId, SAME facts (deliberately — the
    // discriminating input distinguishing storyId-identity from any
    // hash-shortcut), DIFFERENT provenance tuple (deploy-spanning retry).
    const { storyRef: second } = await publish(db, {
      deferTransaction: true,
      generationConfig: { generationVersion: 4, continuityEnabled: true },
    });

    const sweep1 = await runWireReplaySweep(db, { now: new Date(NOW.getTime() + 60_000) });
    expect(sweep1.superseded).toBe(1);

    // No entry written, no overwrite: stored provenance BYTE-EQUAL to
    // envelope 1's tuple (not merely "unchanged").
    const after = dayEntries();
    expect(after).toHaveLength(1);
    expect(JSON.stringify(after[0].generationConfig)).toBe(storedTuple);
    expect(after[0].generationConfig.generationVersion).toBe(3);

    // Counted once, and the straggler run is a no-op: restore a stale
    // envelope copy (simulating the envelope-delete failure) and re-sweep —
    // supersededAttempts membership makes it firstAppend:false.
    const day = db._dump()[`fantasyTimesWire/${MARKET_DATE}`];
    expect(day.validationStats.superseded).toBe(1);
    const receipt = day.receipts['doug_earnings_recap:NVDA:2026-07-24:2026-07-24'];
    expect(receipt.supersededAttempts).toEqual([second.id]);

    const staleEnv = {
      ...db._dump()[`fantasyTimesWireEnvelopes/${second.id}`] ?? {},
    };
    // Envelope was deleted by finalizeWireSuperseded; rebuild the straggler
    // via the shared transaction directly with the same envelope content.
    const tx = await runWireTransactionFromEnvelope(db, {
      storyId: second.id,
      seam: 'doug_earnings_recap',
      reporter: 'doug',
      idempotencyKey: 'doug_earnings_recap:NVDA:2026-07-24:2026-07-24',
      payloadHash: 'irrelevant-after-D9',
      marketDate: MARKET_DATE,
      outcome: 'passed',
      modelAgentFacts: goodFacts(),
      validatorResult: { outcome: 'passed', codes: [], reasons: [], offUniverseTickers: [], preStripTickerCount: 1, quarantined: false, validatorVersion: '1.6.0' },
      primaryTicker: 'NVDA',
      serverSubjectRef: null,
      headline: 'NVDA crushes it',
      publishedAt: NOW,
      createdAt: NOW,
      schemaVersion: WIRE_SCHEMA_VERSION,
      generationConfig: { generationVersion: 4, continuityEnabled: true },
    }, { now: new Date(NOW.getTime() + 120_000) });
    expect(tx.status).toBe('superseded');
    expect(tx.firstAppend).toBe(false); // membership no-op
    expect(db._dump()[`fantasyTimesWire/${MARKET_DATE}`].validationStats.superseded).toBe(1); // count stays 1
    void staleEnv;
  });
});
