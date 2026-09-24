// api/_utils/callRecords/candidate.test.js
//
// Cockpit Build 0 — the mint candidate (spec V1.3 §3.6; §3.12 row 12
// "provenance/evidence"): built once, frozen, canonical; evidence and
// provenance exactly as the contract's §4 literals.

import { describe, it, expect } from 'vitest';
import {
  buildMintCandidate, resolveProvenance, mintEvidence, canonicalCall, canonicalRecord, stableStringify, callIdOf,
  MUTABLE_CALL_FIELDS, PROVENANCE_REASONS,
} from './candidate.js';
import { DECLARATION_CAPS, jsonBytes } from './validate.js';
import { buildResolvedAgentManifest } from '../resolvedAgentManifest.js';
import { FROZEN_NOW, makeTickBattle, makeDeclarations, makeObservation } from '../__fixtures__/tickStampsHarness.js';

const UNIVERSE = ['NVDA', 'TSLA', 'MSFT', 'AMZN', 'KO', 'PG', 'BTC', 'AMD', 'JPM'];
const MINT = Date.parse(FROZEN_NOW) + 20_000;
const base = (over = {}) => ({
  battleId: 'battle-tick-1', evalId: 'eval_001', evalSeq: 1, mintedAtMs: MINT, raw: makeDeclarations(),
  universe: UNIVERSE, observation: makeObservation(), promptBuiltAt: FROZEN_NOW, tickId: 'battle-tick-1:1', battle: makeTickBattle(),
  ...over,
});

describe('ids, ordinals, kinds', () => {
  it('callId = `${battleId}:${evalId}:call:${n}`, n zero-based in ordinal order', () => {
    const c = buildMintCandidate(base());
    expect(c.calls.map((x) => x.callId)).toEqual(['battle-tick-1:eval_001:call:0', 'battle-tick-1:eval_001:call:1']);
    expect(callIdOf('b', 'eval_9', 3)).toBe('b:eval_9:call:3');
    expect(c.calls.map((x) => x.kind)).toEqual(['called_shot', 'confirmation']);
  });

  it('every call carries the committed identity and the ONE mint instant', () => {
    const c = buildMintCandidate(base());
    for (const call of c.calls) {
      expect(call).toMatchObject({ battleId: 'battle-tick-1', evalId: 'eval_001', evalSeq: 1, mintedAt: MINT, stateChangedAt: MINT, stateSource: 'mint' });
    }
    expect(c.record).toMatchObject({ battleId: 'battle-tick-1', evalId: 'eval_001', evalSeq: 1, mintedAt: MINT });
  });

  it('a pick carries slot / swapOut / options and no symbol, condition or default; its horizon is next_check', () => {
    const c = buildMintCandidate(base({ raw: { fork: { slot: 'support', swapOut: 'KO', options: [{ symbol: 'AMD', why: 'a' }, { symbol: 'JPM', why: 'b' }], said: 'AMD or JPM?' } } }));
    expect(c.calls).toHaveLength(1);
    const pick = c.calls[0];
    expect(pick).toMatchObject({ kind: 'pick', slot: 'support', swapOut: 'KO', symbol: null, direction: null, counterpart: null, condition: null, defaultAction: null, state: 'open' });
    expect(pick.options).toEqual([{ symbol: 'AMD', why: 'a' }, { symbol: 'JPM', why: 'b' }]);
    expect(pick.horizon).toEqual({ phrase: 'next_check', expiresAt: Date.parse('2026-09-09T15:15:00.000Z'), basis: 'next_check' });
  });

  it('the wire fields: playerResponse / directiveThreadId / outcome / refused start null; the call wire is not widened', () => {
    const [call] = buildMintCandidate(base()).calls;
    expect(Object.keys(call)).toEqual([
      'callId', 'kind', 'battleId', 'evalId', 'evalSeq', 'mintedAt', 'symbol', 'direction', 'slot', 'counterpart', 'condition',
      'horizon', 'defaultAction', 'said', 'evidence', 'hypothesisRef', 'origin', 'state', 'stateChangedAt', 'stateSource',
      'playerResponse', 'directiveThreadId', 'outcome', 'refused',
    ]);
    expect(call.playerResponse).toBeNull();
    expect(call.outcome).toBeNull();
    expect(call.refused).toBeNull();
    expect(call.directiveThreadId).toBeNull();
  });
});

describe('validity against the MODEL-RESULT observation — born invalidated, reason on the record', () => {
  it('a symbol absent from the observation mints invalidated (no_observation); an observed plausible one mints open', () => {
    const c = buildMintCandidate(base({ observation: makeObservation({ omit: ['AMD'] }) }));
    expect(c.calls.map((x) => [x.symbol, x.state])).toEqual([['AMD', 'invalidated'], ['TSLA', 'open']]);
    expect(c.record.minted).toEqual([
      { callId: 'battle-tick-1:eval_001:call:0', n: 0, kind: 'called_shot', state: 'invalidated', reason: 'no_observation' },
      { callId: 'battle-tick-1:eval_001:call:1', n: 1, kind: 'confirmation', state: 'open', reason: null },
    ]);
    expect(c.newOpen.map((x) => x.symbol)).toEqual(['TSLA']);
  });

  it('non-finite and implausible levels mint invalidated with their reasons', () => {
    const raw = makeDeclarations();
    raw.calledShots[0].condition.level = Infinity;
    raw.calledShots[1].condition.level = 100; // TSLA px 244.9 → 59% away
    const c = buildMintCandidate(base({ raw }));
    expect(c.record.minted.map((m) => m.reason)).toEqual(['level_non_finite', 'level_implausible']);
    expect(c.newOpen).toEqual([]);
  });
});

describe('the horizon is re-judged against the REAL mint instant', () => {
  it('an explicit expiry crossed between prompt build and mint is removed at mint, and ordinals are assigned after it', () => {
    const raw = makeDeclarations();
    raw.calledShots.unshift({ ...raw.calledShots[0], symbol: 'NVDA', horizonPhrase: 'explicit', expiresAtMs: MINT - 1 });
    const c = buildMintCandidate(base({ raw }));
    expect(c.removed).toEqual([{ source: 'calledShots', index: 0, reason: 'explicit_invalid' }]);
    expect(c.calls.map((x) => [x.callId.split(':').pop(), x.symbol])).toEqual([['0', 'AMD'], ['1', 'TSLA']]);
    expect(c.record.removed).toEqual(c.removed);
  });

  it('resolved horizons carry { phrase, expiresAt, basis } in epoch ms', () => {
    const c = buildMintCandidate(base());
    expect(c.calls[0].horizon).toEqual({ phrase: 'this_session', expiresAt: Date.parse('2026-09-09T20:00:00.000Z'), basis: 'this_session' });
    expect(c.calls[1].horizon).toEqual({ phrase: 'next_check', expiresAt: Date.parse('2026-09-09T15:15:00.000Z'), basis: 'next_check' });
  });

  it('nothing surviving → no record (nothing to write)', () => {
    const c = buildMintCandidate(base({ raw: { calledShots: [{ symbol: 'AMD' }] } }));
    expect(c.record).toBeNull();
    expect(c.calls).toEqual([]);
    expect(c.removed).toEqual([{ source: 'calledShots', index: 0, reason: 'malformed' }]);
  });
});

describe('§3.12 row 12 — evidence', () => {
  it('capture ON: { tickId, availability: unresolved, priceAsOf: promptBuiltAt (ISO) }', () => {
    expect(buildMintCandidate(base()).calls[0].evidence).toEqual({ tickId: 'battle-tick-1:1', availability: 'unresolved', priceAsOf: FROZEN_NOW });
  });
  it('capture OFF: { tickId: null, availability: off, priceAsOf }', () => {
    expect(buildMintCandidate(base({ tickId: null })).calls[0].evidence).toEqual({ tickId: null, availability: 'off', priceAsOf: FROZEN_NOW });
  });
  it('a missing promptBuiltAt → priceAsOf null — never the current time', () => {
    expect(mintEvidence({ tickId: null, promptBuiltAt: null })).toEqual({ tickId: null, availability: 'off', priceAsOf: null });
    expect(mintEvidence({ tickId: 'b:1', promptBuiltAt: undefined })).toEqual({ tickId: 'b:1', availability: 'unresolved', priceAsOf: null });
  });
});

describe('§3.12 row 12 — provenance (the complete origin rule)', () => {
  const HASH = 'a'.repeat(64);
  const withCtx = (equippedWatchlist, equippedConfigHash) => makeTickBattle({
    agentContext: { ...makeTickBattle().agentContext, ...(equippedWatchlist === undefined ? {} : { equippedWatchlist }) },
    ...(equippedConfigHash === undefined ? {} : { resolvedAgentManifest: { equippedConfigHash } }),
  });
  const snap = { watchlistId: 'wl-1', name: 'AI infra', tickers: ['NVDA', 'AMD'], snapshotAt: '2026-09-09T13:30:00.000Z' };

  it('LEGACY: a frozen watchlist + a config hash, no version → { watchlistId, equippedConfigHash }, equipped', () => {
    expect(resolveProvenance(withCtx(snap, HASH))).toEqual({ hypothesisRef: { watchlistId: 'wl-1', equippedConfigHash: HASH }, origin: 'equipped' });
  });
  it('VERSIONED (synthetic — HEAD never writes a version): { watchlistId, hypothesisVersion }, equipped', () => {
    expect(resolveProvenance(withCtx({ ...snap, hypothesisVersion: 3 }, HASH))).toEqual({ hypothesisRef: { watchlistId: 'wl-1', hypothesisVersion: 3 }, origin: 'equipped' });
  });
  it('UNRESOLVED only for a PRESENT but unusable snapshot: a corrupt snapshot; a corrupt version; a watchlist without a hash (ruling A-1)', () => {
    expect(resolveProvenance(withCtx({ name: 'no id', tickers: [] }, HASH))).toEqual({ hypothesisRef: null, origin: 'provenance_unresolved', provenanceReason: 'snapshot_corrupt' });
    expect(resolveProvenance(withCtx('wl-1', HASH)).provenanceReason).toBe('snapshot_corrupt');
    expect(resolveProvenance(withCtx({ ...snap, tickers: 'NVDA' }, HASH)).provenanceReason).toBe('snapshot_corrupt');
    expect(resolveProvenance(withCtx({ ...snap, hypothesisVersion: 'v2' }, HASH)).provenanceReason).toBe('snapshot_corrupt');
    expect(resolveProvenance(withCtx(snap, undefined))).toEqual({ hypothesisRef: null, origin: 'provenance_unresolved', provenanceReason: 'config_hash_missing' });
    // The reason vocabulary names present-but-unusable snapshots only.
    expect(PROVENANCE_REASONS).toEqual(['snapshot_corrupt', 'config_hash_missing']);
  });
  it('NO watchlist snapshot (absent or null) → agent_initiative, hypothesisRef null — with or without a config hash (ruling A-1)', () => {
    for (const [watchlist, hash] of [[undefined, undefined], [null, undefined], [undefined, HASH], [null, HASH]]) {
      const res = resolveProvenance(withCtx(watchlist, hash));
      expect(res).toEqual({ hypothesisRef: null, origin: 'agent_initiative' });
      expect(res).not.toHaveProperty('provenanceReason');
    }
  });
  // FOUNDER RULING A-1 (2026-09-24; review A-1): with MANIFEST_WRITE_ENABLED
  // every battle is created with a manifest whose equippedConfigHash exists
  // even when NO watchlist is equipped (the hash covers `equippedWatchlist:
  // null`). A hash alone is therefore no provenance: a battle without a frozen
  // watchlist mints agent_initiative. Pinned against the REAL manifest builder
  // and the shape createAgentBattle writes (`agentContext.equippedWatchlist: null`).
  it('A REAL battle manifest without a watchlist → agent_initiative, hypothesisRef null — the hash is ignored (ruling A-1)', () => {
    const agentData = { id: 'agent-1', name: 'Agent', archetype: 'momentum', activeRules: [], equippedBundleIds: [], config: { risk: 50 } };
    const manifest = buildResolvedAgentManifest({ agentData, equippedWatchlist: null, gameMode: 'clash', now: FROZEN_NOW });
    expect(manifest.frozenLayers.equippedWatchlist).toBeNull();
    expect(manifest.equippedConfigHash).toMatch(/^[0-9a-f]{64}$/);
    const battle = makeTickBattle({ agentContext: { ...makeTickBattle().agentContext, equippedWatchlist: null }, resolvedAgentManifest: manifest });
    expect(resolveProvenance(battle)).toEqual({ hypothesisRef: null, origin: 'agent_initiative' });
    // …and the minted call carries it, with no provenanceReason key.
    const [call] = buildMintCandidate(base({ battle })).calls;
    expect(call).toMatchObject({ hypothesisRef: null, origin: 'agent_initiative' });
    expect(call).not.toHaveProperty('provenanceReason');
  });
  it('a frozen watchlist never becomes initiative because its version is absent; the call carries the rule\'s output', () => {
    const c = buildMintCandidate(base({ battle: withCtx(snap, HASH) }));
    expect(c.calls[0]).toMatchObject({ hypothesisRef: { watchlistId: 'wl-1', equippedConfigHash: HASH }, origin: 'equipped' });
    expect(c.calls[0]).not.toHaveProperty('provenanceReason');
    const u = buildMintCandidate(base({ battle: withCtx({ ...snap, tickers: 'NVDA' }, HASH) }));
    expect(u.calls[0]).toMatchObject({ hypothesisRef: null, origin: 'provenance_unresolved', provenanceReason: 'snapshot_corrupt' });
  });
});

describe('built ONCE, frozen, canonical', () => {
  it('the candidate is deep-frozen — nothing can mutate it between retries', () => {
    const c = buildMintCandidate(base());
    expect(Object.isFrozen(c)).toBe(true);
    expect(Object.isFrozen(c.record)).toBe(true);
    expect(Object.isFrozen(c.calls[0])).toBe(true);
    expect(Object.isFrozen(c.calls[0].horizon)).toBe(true);
  });

  it('the canonical form is stable-key JSON of the IMMUTABLE fields — state, response, outcome, refused and availability excluded', () => {
    const [call] = buildMintCandidate(base()).calls;
    const mutated = {
      ...call, state: 'hit', stateChangedAt: 1, stateSource: 'check', playerResponse: { answer: 'go' }, outcome: { receiptRef: 'x' },
      refused: { at: 1 }, evidence: { ...call.evidence, availability: 'complete' },
    };
    expect(canonicalCall(mutated)).toBe(canonicalCall(call));
    // …and any immutable field moves it.
    expect(canonicalCall({ ...call, said: `${call.said}!` })).not.toBe(canonicalCall(call));
    expect(canonicalCall({ ...call, horizon: { ...call.horizon, expiresAt: 1 } })).not.toBe(canonicalCall(call));
    expect(MUTABLE_CALL_FIELDS).toEqual(['state', 'stateChangedAt', 'stateSource', 'playerResponse', 'outcome', 'refused']);
  });

  it('stable-key: key order never changes the form; a document read back (key order lost, non-finite → null) compares equal', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
    const raw = makeDeclarations();
    raw.calledShots[0].condition.level = Infinity;
    const c = buildMintCandidate(base({ raw }));
    const readBack = JSON.parse(JSON.stringify(c.calls[0]));
    expect(canonicalCall(readBack)).toBe(c.canonical.calls[c.calls[0].callId]);
    expect(canonicalRecord(JSON.parse(JSON.stringify(c.record)))).toBe(c.canonical.record);
  });

  it('the same inputs give the same candidate, byte for byte (a retry compares against an identical form)', () => {
    expect(JSON.stringify(buildMintCandidate(base()))).toBe(JSON.stringify(buildMintCandidate(base())));
  });

  it('the declarations record is the typed block as declared, its removals, and what it minted', () => {
    const c = buildMintCandidate(base({ raw: { ...makeDeclarations(), playerAsk: { question: 'Hold AMD?', options: ['yes', 'no'] } } }));
    expect(Object.keys(c.record)).toEqual(['battleId', 'evalId', 'evalSeq', 'mintedAt', 'calledShots', 'watching', 'playerAsk', 'fork', 'removed', 'minted']);
    expect(c.record.calledShots).toEqual(makeDeclarations().calledShots);
    expect(c.record.watching).toEqual(['JPM']);
    expect(c.record.playerAsk).toEqual({ question: 'Hold AMD?', options: ['yes', 'no'] });
    expect(c.publicationBytes).toBeGreaterThan(0);
    expect(c.publicationBytes).toBeLessThan(64 * 1024);
  });

  // The STORED record is bounded whatever the block (review E-2): the tool
  // schema caps nothing, so a degenerate block of malformed rows must neither
  // grow the record past 16 KB nor push a valid row out on bookkeeping bytes.
  const junkRows = (n) => Array.from({ length: n }, () => ({}));
  const [validShot, validExit] = makeDeclarations().calledShots;
  for (const [label, raw, kept] of [
    ['1 valid shot + 300 empty rows', { calledShots: [validShot, ...junkRows(300)] }, 1],
    ['1 valid shot + 1,200 empty rows', { calledShots: [validShot, ...junkRows(1_200)] }, 1],
    ['2 valid shots + watching [NVDA, 0 × 1,250]', { calledShots: [validShot, validExit], watching: ['NVDA', ...Array(1_250).fill(0)] }, 2],
  ]) {
    it(`${label}: the stored record stays ≤ 16 KB, every valid call is kept, every removal is accounted for`, () => {
      const c = buildMintCandidate(base({ raw }));
      expect(c.calls).toHaveLength(kept);
      expect(c.removed.every((r) => r.reason === 'malformed')).toBe(true);
      expect(jsonBytes(c.record)).toBeLessThanOrEqual(DECLARATION_CAPS.declarationsDocBytes);
      expect(c.publicationBytes).toBeLessThanOrEqual(DECLARATION_CAPS.publicationBytes);
      // The first 16 removals are listed one by one; the rest are counted per (source, reason).
      expect(c.record.removed).toEqual(c.removed.slice(0, DECLARATION_CAPS.removedListed));
      const counted = c.record.removedOverflow.reduce((sum, o) => sum + o.count, 0);
      expect(c.record.removed.length + counted).toBe(c.removed.length);
      if (raw.watching) expect(c.record.watching).toEqual(['NVDA']);
    });
  }

  it('a block just under 16 KB by itself: the removals and identity push the RECORD over, so the crossing row is removed oversize (review A-4)', () => {
    const wide = Array.from({ length: 6 }, (_, i) => String.fromCharCode(65 + i).repeat(2_600));
    const raw = { calledShots: [validShot, ...junkRows(60)], watching: wide };
    expect(jsonBytes({ calledShots: [validShot], watching: wide, playerAsk: null, fork: null })).toBeLessThan(DECLARATION_CAPS.declarationsDocBytes);
    const c = buildMintCandidate(base({ raw }));
    expect(jsonBytes(c.record)).toBeLessThanOrEqual(DECLARATION_CAPS.declarationsDocBytes);
    expect(c.removed.filter((r) => r.reason === 'oversize').map((r) => r.source)).toEqual(['watching']);
    expect(c.calls).toHaveLength(1);
  });

  it('a block that fits with its removal list but not with its identity and minted list: the crossing row is removed oversize (the allowance counts)', () => {
    const wideOf = (len) => Array.from({ length: 6 }, (_, i) => String.fromCharCode(65 + i).repeat(len));
    const blockBytes = (len) => jsonBytes({ calledShots: [validShot], watching: wideOf(len), playerAsk: null, fork: null, removed: [] });
    let len = 2_600;
    while (blockBytes(len + 1) <= DECLARATION_CAPS.declarationsDocBytes - 20) len += 1;
    const c = buildMintCandidate(base({ raw: { calledShots: [validShot], watching: wideOf(len) } }));
    expect(jsonBytes(c.record)).toBeLessThanOrEqual(DECLARATION_CAPS.declarationsDocBytes);
    expect(c.removed).toEqual([{ source: 'watching', index: 5, reason: 'oversize' }]);
    expect(c.calls).toHaveLength(1);
  });

  it('a declarations-only block (watching / playerAsk) is a record with no calls', () => {
    const c = buildMintCandidate(base({ raw: { watching: ['AMD'] } }));
    expect(c.record.watching).toEqual(['AMD']);
    expect(c.calls).toEqual([]);
    expect(c.newOpen).toEqual([]);
  });
});
