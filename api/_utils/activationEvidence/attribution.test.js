// api/_utils/activationEvidence/attribution.test.js
//
// ID-1 Build 2 — attribution (contract §4; §2 the ownership-check exception),
// through the real resolver (casualClone.js resolveAttributionAgentId) over an
// in-memory read-only database.

import { describe, it, expect, vi } from 'vitest';
import { attributionOf } from './attribution.js';
import { buildPointer } from './pointer.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';
import { discoverActivations } from './discover.js';
import { legacyBattle } from './__fixtures__/activationBattles.js';

const CLONE = 'casual-agent-owner-1';
function dbOf(agents, { fail = false } = {}) {
  const reads = [];
  return {
    reads,
    collection: (name) => ({ doc: (id) => ({ get: async () => {
      reads.push(`${name}/${id}`);
      if (fail) throw new Error('unavailable');
      const data = agents[id];
      return { exists: data !== undefined, data: () => structuredClone(data) };
    } }) }),
  };
}
const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('attribution', () => {
  it('a ranked battle is never unresolved, and needs no read', async () => {
    const db = dbOf({});
    expect(await attributionOf(db, { agentId: 'agent-1' })).toEqual({ attributionAgentId: 'agent-1', attributionStatus: 'resolved', deferred: false });
    expect(db.reads).toEqual([]);
    expect(await attributionOf(null, { agentId: 'agent-1' })).toEqual({ attributionAgentId: 'agent-1', attributionStatus: 'resolved', deferred: false });
  });
  it('a casual clone whose parent the same owner holds resolves to the parent', async () => {
    const db = dbOf({ [CLONE]: { ownerId: 'owner-1', rankedAgentId: 'agent-1' }, 'agent-1': { ownerId: 'owner-1' } });
    expect(await attributionOf(db, { agentId: CLONE })).toEqual({ attributionAgentId: 'agent-1', attributionStatus: 'resolved', deferred: false });
  });
  it.each([
    ['a null database', null],
    ['the clone agent missing', dbOf({})],
    ['the parent id missing', dbOf({ [CLONE]: { ownerId: 'owner-1' } })],
    ['the parent id empty', dbOf({ [CLONE]: { ownerId: 'owner-1', rankedAgentId: '' } })],
    ['the parent missing', dbOf({ [CLONE]: { ownerId: 'owner-1', rankedAgentId: 'agent-9' } })],
    ['an owner mismatch', dbOf({ [CLONE]: { ownerId: 'owner-1', rankedAgentId: 'agent-9' }, 'agent-9': { ownerId: 'owner-2' } })],
    ['a read error', dbOf({}, { fail: true })],
    ['a self-reference', dbOf({ [CLONE]: { ownerId: 'owner-1', rankedAgentId: CLONE } })],
  ])('unresolved: %s — the clone\'s own id, never a guessed parent', async (_l, db) => {
    const spy = quiet();
    expect(await attributionOf(db, { agentId: CLONE })).toEqual({ attributionAgentId: CLONE, attributionStatus: 'unresolved', deferred: false });
    spy.mockRestore();
  });
  it('the preparation budget admits each of the resolver\'s two reads: a parent read the budget refuses defers the battle, never unresolved (review V4 on nit-2)', async () => {
    const spy = quiet();
    const db = dbOf({ [CLONE]: { ownerId: 'owner-1', rankedAgentId: 'agent-1' }, 'agent-1': { ownerId: 'owner-1' } });
    let budget = 1;
    const seen = [];
    const r = await attributionOf(db, { agentId: CLONE }, { mayRead: () => budget-- > 0, beforeRead: () => seen.push('read') });
    expect(r).toEqual({ attributionAgentId: null, attributionStatus: null, deferred: true });
    expect(db.reads).toEqual([`agents/${CLONE}`]); // the parent read never started
    expect(seen).toEqual(['read']);
    spy.mockRestore();
  });
  it('an allowlisted owner\'s clone naming ANOTHER owner\'s parent: unresolved, and nothing from the parent reaches the result or the pointer', async () => {
    const spy = quiet();
    const parent = { ownerId: 'owner-2', name: 'SENTINEL_PARENT_NAME', archetype: 'SENTINEL_PARENT_ARCH', rankedAgentId: 'SENTINEL_X' };
    const db = dbOf({ [CLONE]: { ownerId: 'owner-1', rankedAgentId: 'agent-of-owner-2' }, 'agent-of-owner-2': parent });
    const r = await attributionOf(db, { agentId: CLONE });
    expect(r).toEqual({ attributionAgentId: CLONE, attributionStatus: 'unresolved', deferred: false });
    expect(db.reads).toEqual([`agents/${CLONE}`, 'agents/agent-of-owner-2']); // the ownership check read it, and only that
    const b = legacyBattle({ agentId: CLONE });
    const a = discoverActivations(b).activations[0];
    const p = buildPointer({ battle: b, battleId: 'b', activation: a, session: '2026-11-04', attribution: r, ruleSet: describeRuleSet(), evidence: null, missingDetail: 'x', observedAt: '2026-11-05T15:00:00.000Z' });
    const text = JSON.stringify([r, p]);
    for (const s of ['agent-of-owner-2', 'owner-2', 'SENTINEL_PARENT_NAME', 'SENTINEL_PARENT_ARCH', 'SENTINEL_X']) expect(text).not.toContain(s);
    spy.mockRestore();
  });
});
