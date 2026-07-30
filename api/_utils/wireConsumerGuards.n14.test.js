// api/_utils/wireConsumerGuards.n14.test.js
// Phase 2 N1.4 — the fail-closed guard AT THE CONSUMERS (Spec V1.5 R4-M2,
// V1.3 STOP-3 resolution). Matrix rows:
//   P2-29 — continuity fails closed BEFORE its flip: an unknown non-legacy
//           version never reaches a generation prompt; legacy renders.
//           Widened to the chain candidates and the index rebuild (the
//           other two existing consumers; the newsLine lands with N1).
//   P2-5  — unknown schemaVersion → skipped + LOGGED (the consumer half).
//
// A6 faults (exercised by experiment during the build; each row cites its
// own): remove the classify/continue from the consumer under test → that
// row's poisoned digest reaches the block / the poisoned storyId reaches
// the index / the chain inherits the poisoned root → red.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFirestoreFake } from './__fixtures__/wireFirestoreFake.js';
import { buildContinuityContext } from './wireContinuity.js';
import { rebuildIndexes, runWireTransactionFromEnvelope } from './wireWriteThrough.js';
import { classifyWireEntry, WIRE_ENTRY_STATES } from './wireEntryGuard.js';
import { WIRE_SCHEMA_VERSION, WIRE_DIGEST_RENDERER_VERSION } from './wireContracts.js';

const MARKET_DATE = '2026-07-24';
const PRIOR_DATE = '2026-07-23';
const NOW = new Date('2026-07-24T18:00:00Z');

// ── Entry fixtures (persisted day-doc shape) ───────────────────────────────
const entryBase = (storyId, reporter = 'doug') => ({
  storyId, reporter, headline: 'HEADLINE ' + storyId,
  publishedAt: '2026-07-23T20:00:00Z', validatorVersion: '1.6.0', quarantined: false,
});

const stampedEntry = (storyId, { reporter = 'doug', ticker = 'NVDA', digest, factsOver = {} } = {}) => ({
  ...entryBase(storyId, reporter),
  generationConfig: { generationVersion: 7, continuityEnabled: false },
  agentFacts: {
    eventType: 'earnings_recap', tickers: ticker ? [ticker] : [],
    primaryTicker: ticker ?? null,
    digest: digest ?? `STAMPED DIGEST ${storyId}.`,
    schemaVersion: WIRE_SCHEMA_VERSION, digestRendererVersion: WIRE_DIGEST_RENDERER_VERSION,
    validatorVersion: '1.6.0', chainId: storyId,
    ...factsOver,
  },
});

const legacyEntry = (storyId, { reporter = 'doug', ticker = 'NVDA', digest } = {}) => ({
  ...entryBase(storyId, reporter),
  agentFacts: {
    eventType: 'earnings_recap', tickers: ticker ? [ticker] : [],
    primaryTicker: ticker ?? null,
    digest: digest ?? `LEGACY DIGEST ${storyId}.`, chainId: storyId,
  },
});

const unknownVersionEntry = (storyId, over = {}) =>
  stampedEntry(storyId, { ...over, factsOver: { schemaVersion: 'wire-9.9', ...(over.factsOver || {}) } });

const partialStampEntry = (storyId, over = {}) =>
  stampedEntry(storyId, { ...over, factsOver: { schemaVersion: undefined, ...(over.factsOver || {}) } });

// ── console.warn spy (the "skipped + logged" half of N1.4) ────────────────
let warnSpy;
const guardWarns = () =>
  warnSpy.mock.calls.map((c) => c[0]).filter((m) => typeof m === 'string' && m.includes('N1.4 guard'));

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

// ── P2-29: continuity fails closed before its flip ────────────────────────
describe('P2-29 — buildContinuityContext', () => {
  let db;
  beforeEach(async () => {
    db = createFirestoreFake();
    await db.collection('fantasyTimesWire').doc(PRIOR_DATE).set({
      date: PRIOR_DATE,
      entries: [
        legacyEntry('L1', { digest: 'LEGACY RENDERS.' }),
        stampedEntry('S1', { digest: 'STAMPED RENDERS.' }),
        unknownVersionEntry('U1', { digest: 'POISON UNKNOWN VERSION.' }),
        partialStampEntry('M1', { digest: 'POISON PARTIAL STAMP.' }),
      ],
    });
  });

  it('legacy + stamped render; unknown-version and malformed digests NEVER reach the prompt block', async () => {
    const block = await buildContinuityContext(db, { reporter: 'doug', marketDate: MARKET_DATE });
    expect(block).toContain('LEGACY RENDERS.');
    expect(block).toContain('STAMPED RENDERS.');
    expect(block).not.toContain('POISON UNKNOWN VERSION.');
    expect(block).not.toContain('POISON PARTIAL STAMP.');
  });

  it('P2-5: each skip is logged with storyId, state, and reason', async () => {
    await buildContinuityContext(db, { reporter: 'doug', marketDate: MARKET_DATE });
    const warns = guardWarns();
    expect(warns).toHaveLength(2);
    expect(warns.find((w) => w.includes('U1'))).toMatch(/version_skip.*unrecognized_schema_version:wire-9\.9/);
    expect(warns.find((w) => w.includes('M1'))).toMatch(/malformed.*partial_epoch_stamp/);
    expect(warns.every((w) => w.includes('[WireContinuity]'))).toBe(true);
  });

  it('a day of ONLY non-renderable entries → null block (fail closed, not fail open)', async () => {
    await db.collection('fantasyTimesWire').doc(PRIOR_DATE).set({
      date: PRIOR_DATE,
      entries: [unknownVersionEntry('U2'), partialStampEntry('M2')],
    });
    expect(await buildContinuityContext(db, { reporter: 'doug', marketDate: MARKET_DATE })).toBeNull();
  });
});

// ── P2-29 widened: chain candidates ───────────────────────────────────────
describe('P2-29 — resolveChainId candidates pass the guard (transaction level)', () => {
  const envelope = (storyId, { marketDate = MARKET_DATE } = {}) => ({
    storyId, seam: 'doug_earnings_recap', reporter: 'doug',
    idempotencyKey: `doug_earnings_recap:NVDA:${marketDate}:${storyId}`,
    payloadHash: `hash-${storyId}`, marketDate, outcome: 'passed',
    modelAgentFacts: {
      eventType: 'earnings_recap', tickers: ['NVDA'], direction: 'up',
      magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' },
    },
    validatorResult: {
      outcome: 'passed', codes: [], reasons: [], offUniverseTickers: [],
      preStripTickerCount: 1, quarantined: false, validatorVersion: '1.6.0',
    },
    primaryTicker: 'NVDA', serverSubjectRef: null, headline: 'H',
    publishedAt: NOW, createdAt: NOW,
    schemaVersion: WIRE_SCHEMA_VERSION,
    generationConfig: { generationVersion: 7, continuityEnabled: false },
  });

  let db;
  beforeEach(() => {
    db = createFirestoreFake();
  });

  const seedPrior = (entries) =>
    db.collection('fantasyTimesWire').doc(PRIOR_DATE).set({ date: PRIOR_DATE, entries });

  const committedEntry = async () => {
    const tx = await runWireTransactionFromEnvelope(db, envelope('new-story'), { now: NOW });
    expect(tx.status).toBe('committed');
    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    return day.entries.find((e) => e.storyId === 'new-story');
  };

  it('an unknown-version prior entry cannot anchor a chain → the new entry SELF-ROOTS', async () => {
    await seedPrior([unknownVersionEntry('poison', { factsOver: { chainId: 'poisoned-root' } })]);
    const entry = await committedEntry();
    expect(entry.agentFacts.chainId).toBe('new-story'); // self-root, not 'poisoned-root'
    expect(guardWarns().some((w) => w.includes('[WireChains]') && w.includes('poison'))).toBe(true);
  });

  it('control: a STAMPED prior entry chains normally', async () => {
    await seedPrior([stampedEntry('good', { factsOver: { chainId: 'good-root' } })]);
    const entry = await committedEntry();
    expect(entry.agentFacts.chainId).toBe('good-root');
  });

  it('control: a LEGACY prior entry chains too (Amendment J — renderable class)', async () => {
    await seedPrior([legacyEntry('old', { factsOver: undefined })]);
    const entry = await committedEntry();
    expect(entry.agentFacts.chainId).toBe('old'); // legacy fixture's chainId = its storyId
  });

  it('the entry the transaction itself persists classifies STAMPED (writer↔registry bind)', async () => {
    const entry = await committedEntry();
    expect(classifyWireEntry(entry).state).toBe(WIRE_ENTRY_STATES.STAMPED);
  });
});

// ── P2-29 widened: index rebuild ───────────────────────────────────────────
describe('P2-29 — rebuildIndexes serves only guard-passing entries', () => {
  it('pure call: stamped + legacy indexed; version-skip + malformed excluded from BOTH indexes', () => {
    const entries = [
      stampedEntry('sNVDA', { ticker: 'NVDA' }),
      legacyEntry('sAMD', { ticker: 'AMD' }),
      unknownVersionEntry('sTSLA', { ticker: 'TSLA', factsOver: { macroEligible: true } }),
      partialStampEntry('sMSFT', { ticker: 'MSFT' }),
      stampedEntry('sMacro', { ticker: null, factsOver: { eventType: 'index_move', macroEligible: true } }),
    ];
    const { bySymbol, macroEntries } = rebuildIndexes(entries);
    expect(Object.keys(bySymbol).sort()).toEqual(['AMD', 'NVDA']);
    expect(bySymbol.NVDA).toEqual(['sNVDA']);
    expect(macroEntries).toEqual(['sMacro']); // the version-skipped macro entry is NOT served
    const warns = guardWarns();
    expect(warns.some((w) => w.includes('[WireIndexes]') && w.includes('sTSLA'))).toBe(true);
    expect(warns.some((w) => w.includes('[WireIndexes]') && w.includes('sMSFT'))).toBe(true);
  });

  it('entries[] is a serving filter, never a destroyer: a poisoned pre-seeded index is CLEANSED by the next transaction while the entry survives in entries[]', async () => {
    const db = createFirestoreFake();
    const poison = unknownVersionEntry('poison-idx', { ticker: 'NVDA' });
    await db.collection('fantasyTimesWire').doc(MARKET_DATE).set({
      date: MARKET_DATE,
      entries: [poison],
      bySymbol: { NVDA: ['poison-idx'] }, // old-code index still serving it
      macroEntries: [],
      receipts: {},
      validationStats: null,
      updatedAt: null,
    });

    const tx = await runWireTransactionFromEnvelope(db, {
      storyId: 'clean-story', seam: 'doug_earnings_recap', reporter: 'doug',
      idempotencyKey: `doug_earnings_recap:NVDA:${MARKET_DATE}:clean`,
      payloadHash: 'hash-clean', marketDate: MARKET_DATE, outcome: 'passed',
      modelAgentFacts: {
        eventType: 'earnings_recap', tickers: ['NVDA'], direction: 'up',
        magnitude: { value: 8.2, unit: 'pct', basis: 'eps_vs_consensus' },
      },
      validatorResult: {
        outcome: 'passed', codes: [], reasons: [], offUniverseTickers: [],
        preStripTickerCount: 1, quarantined: false, validatorVersion: '1.6.0',
      },
      primaryTicker: 'NVDA', serverSubjectRef: null, headline: 'H',
      publishedAt: NOW, createdAt: NOW,
      schemaVersion: WIRE_SCHEMA_VERSION,
      generationConfig: { generationVersion: 7, continuityEnabled: false },
    }, { now: NOW });
    expect(tx.status).toBe('committed');

    const day = (await db.collection('fantasyTimesWire').doc(MARKET_DATE).get()).data();
    expect(day.bySymbol.NVDA).toEqual(['clean-story']);          // poison no longer served
    expect(day.entries.map((e) => e.storyId)).toContain('poison-idx'); // …but never destroyed (M9)
  });
});
