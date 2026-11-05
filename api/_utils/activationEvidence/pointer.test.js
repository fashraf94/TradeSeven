// api/_utils/activationEvidence/pointer.test.js
//
// ID-1 Build 2 — the pointer record against contract §4 and §4.5, on a snapshot
// the store's own acquisition produced (__fixtures__/activationSnapshots.js).

import { describe, it, expect } from 'vitest';
import { buildPointer, snapshotServes, deepFrozenCopy } from './pointer.js';
import { discoverActivations } from './discover.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';
import { correctedBattle, correctedSwap, legacyBattle } from './__fixtures__/activationBattles.js';
import { snapshotFor } from './__fixtures__/activationSnapshots.js';

const RS = describeRuleSet();
const SWAP_AT = '2026-11-05T15:02:11.412Z';
const SESSION = '2026-11-04';
const OBSERVED = '2026-11-05T15:17:04.010Z';
const TICK = { tickSeq: 12, evalId: 'eval_012', evaluationId: 'eval_012', source: 'tick_action' };
const RESOLVED = { attributionAgentId: 'agent-2', attributionStatus: 'resolved' };

function correctedSwapIn() {
  const b = correctedBattle({ agentContext: { ...correctedBattle().agentContext,
    equippedWatchlist: { watchlistId: 'wl-1', name: 'Ideas', tickers: ['brk-b', 'NVDA'], snapshotAt: '2026-11-05T14:30:02.118Z' },
    equippedHypothesis: { watchlistId: 'wl-1', hypothesisVersion: 3, contentHash: 'hash-3', statement: 'the idea' } } });
  correctedSwap(b, { tier: 'core', slot: 1, symbolIn: 'BRK-B', at: SWAP_AT, positionId: 'pos_7Hq2LmN4', evaluationId: 'eval_012' });
  const a = discoverActivations(b).activations.find((x) => x.kind === 'swap_in');
  return { b, a: { ...a, activatingTick: TICK } };
}

describe('the canonical pointer (contract §4.5): a corrected swap-in with evidence, an idea carried and a matching tick', () => {
  it('every field, in the contract\'s representation', async () => {
    const { b, a } = correctedSwapIn();
    const ev = await snapshotFor({ session: SESSION, symbol: 'BRK-B', fetchedAt: '2026-11-05T15:17:03.221Z' });
    const p = buildPointer({ battle: b, battleId: 'b-1', activation: a, session: SESSION, attribution: RESOLVED, ruleSet: RS, evidence: ev, observedAt: OBSERVED });
    expect(Object.keys(p)).toEqual(['schemaVersion', 'activationId', 'kind', 'battleId', 'symbol', 'tier', 'slot', 'battleAgentId', 'attributionAgentId', 'attributionStatus', 'archetype', 'stream', 'activatedAt', 'activatedAtSource', 'asOf', 'firstTradingDay', 'ruleSet', 'snapshotRef', 'entry', 'missing', 'evidenceTiming', 'anchorSwingLow', 'activatingTick', 'tradeRef', 'hypothesisRef', 'inIdeaUniverse', 'observedAt']);
    expect({ ...p, entry: '<entry>' }).toEqual({
      schemaVersion: 1, activationId: 'pos_7Hq2LmN4', kind: 'swap_in', battleId: 'b-1', symbol: 'BRK-B', tier: 'core', slot: 1,
      battleAgentId: 'agent-2', attributionAgentId: 'agent-2', attributionStatus: 'resolved', archetype: 'momentum_chaser',
      stream: { attributionAgentId: 'agent-2', clone: 'ranked', gameMode: 'baggerbomb_agent' },
      activatedAt: SWAP_AT, activatedAtSource: 'trade_row', asOf: SESSION, firstTradingDay: '2026-11-05',
      ruleSet: { setupVersion: RS.setupVersion, thresholdsHash: RS.thresholdsHash, semanticsId: RS.semanticsId },
      snapshotRef: ev.snapshotId, entry: '<entry>', missing: null,
      evidenceTiming: { snapshotCapturedAt: '2026-11-05T15:17:03.221Z', predatesActivation: false },
      anchorSwingLow: { value: ev.snapshot.entry.factsUsed.swingLow.value, provenance: 'own_entry' },
      activatingTick: TICK,
      tradeRef: { evaluationId: 'eval_012', verificationId: null, incomingPositionId: 'pos_7Hq2LmN4' },
      hypothesisRef: { watchlistId: 'wl-1', hypothesisVersion: 3, contentHash: 'hash-3' }, inIdeaUniverse: true,
      observedAt: OBSERVED,
    });
    expect(p.entry).toEqual(ev.snapshot.entry);
    expect(p.ruleSet).toEqual(ev.snapshot.key.ruleSet);
    expect(typeof p.anchorSwingLow.value).toBe('number');
  });
  it('entry is a DEEP, FROZEN copy: the snapshot changing afterwards changes nothing, and nothing in it can be changed', async () => {
    const { b, a } = correctedSwapIn();
    const ev = await snapshotFor({ session: SESSION, symbol: 'BRK-B', fetchedAt: '2026-11-05T15:17:03.221Z' });
    const p = buildPointer({ battle: b, battleId: 'b-1', activation: a, session: SESSION, attribution: RESOLVED, ruleSet: RS, evidence: ev, observedAt: OBSERVED });
    const before = JSON.stringify(p.entry);
    ev.snapshot.entry.factsUsed.swingLow.value = -1;
    ev.snapshot.entry.checks.push('x');
    expect(JSON.stringify(p.entry)).toBe(before);
    expect(Object.isFrozen(p.entry) && Object.isFrozen(p.entry.factsUsed) && Object.isFrozen(p.entry.factsUsed.swingLow) && Object.isFrozen(p.entry.checks)).toBe(true);
    expect(deepFrozenCopy({ a: [{ b: 1 }] }).a[0]).toSatisfy(Object.isFrozen);
  });
  it('predatesActivation is capturedAt < activatedAt, strictly: before true, after false, EQUAL false', async () => {
    const { b, a } = correctedSwapIn();
    const at = async (fetchedAt) => buildPointer({ battle: b, battleId: 'b', activation: a, session: SESSION, attribution: RESOLVED, ruleSet: RS, evidence: await snapshotFor({ session: SESSION, symbol: 'BRK-B', fetchedAt }), observedAt: OBSERVED }).evidenceTiming.predatesActivation;
    expect(await at('2026-11-05T14:00:00.000Z')).toBe(true);
    expect(await at('2026-11-05T15:30:00.000Z')).toBe(false);
    expect(await at(SWAP_AT)).toBe(false);
  });
  it('an absent anchor: a refused snapshot\'s entry has no swing low → { value: null, provenance: absent }, and the refusal record is the entry', async () => {
    const { b, a } = correctedSwapIn();
    const ev = await snapshotFor({ session: SESSION, symbol: 'BRK-B', fetchedAt: '2026-11-05T15:17:03.221Z', rows: [] });
    expect(ev.snapshot.status).toBe('refused');
    const p = buildPointer({ battle: b, battleId: 'b', activation: a, session: SESSION, attribution: RESOLVED, ruleSet: RS, evidence: ev, observedAt: OBSERVED });
    expect(p.anchorSwingLow).toEqual({ value: null, provenance: 'absent' });
    expect(p.entry.refusal).toEqual(ev.snapshot.entry.refusal);
  });
});

describe('the other cases (contract §4.5)', () => {
  it('a legacy starting position: fallback id, creation, battle_activatedAt, no tick, no tradeRef; legacy gameMode absent → null', () => {
    const b = legacyBattle();
    delete b.gameMode;
    const a = discoverActivations(b).activations.find((x) => x.tier === 'star' && x.slot === 0);
    const p = buildPointer({ battle: b, battleId: 'b', activation: a, session: SESSION, attribution: { attributionAgentId: 'agent-1', attributionStatus: 'resolved' }, ruleSet: RS, evidence: null, missingDetail: 'missing_bar', observedAt: OBSERVED });
    expect(p).toMatchObject({ activationId: 'star:0:2026-11-05T14:30:02.118Z', kind: 'creation', activatedAtSource: 'battle_activatedAt', activatingTick: null, tradeRef: null, stream: { gameMode: null, clone: 'ranked' } });
  });
  it('no final snapshot at finalisation: the null pointer, asOf keeps its session', () => {
    const { b, a } = correctedSwapIn();
    const p = buildPointer({ battle: b, battleId: 'b', activation: a, session: SESSION, attribution: RESOLVED, ruleSet: RS, evidence: null, missingDetail: 'missing_bar', observedAt: OBSERVED });
    expect(p).toMatchObject({
      snapshotRef: null, entry: null, missing: { reason: 'snapshot_unavailable', detail: 'missing_bar' },
      evidenceTiming: { snapshotCapturedAt: null, predatesActivation: null }, anchorSwingLow: { value: null, provenance: 'absent' }, asOf: SESSION,
    });
    expect(p.missing).toEqual({ reason: 'snapshot_unavailable', detail: 'missing_bar' });
  });
  it('no carried idea: both idea fields null, even when equippedWatchlist exists', () => {
    const { b, a } = correctedSwapIn();
    delete b.agentContext.equippedHypothesis;
    const p = buildPointer({ battle: b, battleId: 'b', activation: a, session: SESSION, attribution: RESOLVED, ruleSet: RS, evidence: null, missingDetail: 'missing_bar', observedAt: OBSERVED });
    expect(b.agentContext.equippedWatchlist.tickers.length).toBeGreaterThan(0);
    expect([p.hypothesisRef, p.inIdeaUniverse]).toEqual([null, null]);
  });
  it('the idea universe is the battle\'s FROZEN list: a ticker absent from it reads false whatever the live list says', () => {
    const { b } = correctedSwapIn();
    const nvdaCreation = discoverActivations(b).activations.find((x) => x.symbol === 'MSFT');
    const p = buildPointer({ battle: b, battleId: 'b', activation: nvdaCreation, session: SESSION, attribution: RESOLVED, ruleSet: RS, evidence: null, missingDetail: 'x', observedAt: OBSERVED });
    expect(p.inIdeaUniverse).toBe(false); // MSFT is not in the battle's frozen tickers; the watchlist document is never read
  });
  it('a casual clone whose parent could not be resolved: unresolved, the clone\'s own id in both places, clone casual', () => {
    const { b, a } = correctedSwapIn();
    b.agentId = 'casual-agent-u1';
    const p = buildPointer({ battle: b, battleId: 'b', activation: a, session: SESSION, attribution: { attributionAgentId: 'casual-agent-u1', attributionStatus: 'unresolved' }, ruleSet: RS, evidence: null, missingDetail: 'x', observedAt: OBSERVED });
    expect(p).toMatchObject({ attributionStatus: 'unresolved', attributionAgentId: 'casual-agent-u1', stream: { attributionAgentId: 'casual-agent-u1', clone: 'casual' } });
  });
  it('a tick that could not be joined', () => {
    const { b, a } = correctedSwapIn();
    const p = buildPointer({ battle: b, battleId: 'b', activation: { ...a, activatingTick: { tickSeq: null, evalId: null, evaluationId: null, source: 'unavailable' } }, session: SESSION, attribution: RESOLVED, ruleSet: RS, evidence: null, missingDetail: 'x', observedAt: OBSERVED });
    expect(p.activatingTick).toEqual({ tickSeq: null, evalId: null, evaluationId: null, source: 'unavailable' });
  });
  it('a battle with no tradingDays: firstTradingDay null', () => {
    const { b, a } = correctedSwapIn();
    delete b.timing;
    expect(buildPointer({ battle: b, battleId: 'b', activation: a, session: SESSION, attribution: RESOLVED, ruleSet: RS, evidence: null, missingDetail: 'x', observedAt: OBSERVED }).firstTradingDay).toBe(null);
  });
});

describe('snapshotServes — a final is used only for its own key', () => {
  it('schemaVersion 1 and the exact session, symbol and rule set', async () => {
    const ev = await snapshotFor({ session: SESSION, symbol: 'BRK-B', fetchedAt: '2026-11-05T15:17:03.221Z' });
    const key = { session: SESSION, symbol: 'BRK-B', ruleSet: RS };
    expect(snapshotServes(ev.snapshot, key)).toBe(true);
    expect(snapshotServes({ ...ev.snapshot, schemaVersion: 2 }, key)).toBe(false);
    expect(snapshotServes(ev.snapshot, { ...key, session: '2026-11-03' })).toBe(false);
    expect(snapshotServes(ev.snapshot, { ...key, symbol: 'NVDA' })).toBe(false);
    expect(snapshotServes(ev.snapshot, { ...key, ruleSet: { ...RS, thresholdsHash: '000000000000' } })).toBe(false);
    expect(snapshotServes({ ...ev.snapshot, entry: null }, key)).toBe(false);
    // An entry with no readable capture instant would give evidenceTiming a representation §4 does not have.
    const { capturedAt, ...noCapture } = ev.snapshot;
    expect(typeof capturedAt).toBe('string');
    expect(snapshotServes(noCapture, key)).toBe(false);
    expect(snapshotServes({ ...ev.snapshot, capturedAt: 'yesterday' }, key)).toBe(false);
    expect(snapshotServes(null, key)).toBe(false);
  });
});
