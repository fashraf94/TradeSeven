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
/**
 * `failOn`: the 1-based read numbers that throw (1 = the clone read, 2 = the parent read); `fail` throws on every read.
 * A failed read throws a coded error (gRPC UNAVAILABLE), or a plain Error with no code when `plain` is set.
 */
function dbOf(agents, { fail = false, failOn = [], plain = false } = {}) {
  const reads = [];
  return {
    reads,
    collection: (name) => ({ doc: (id) => ({ get: async () => {
      reads.push(`${name}/${id}`);
      if (fail || failOn.includes(reads.length)) throw plain ? new TypeError('no code') : Object.assign(new Error('unavailable'), { code: 14 });
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
  it('a null database (unreachable from the tenant, which always has one) leaves the clone\'s own id, unresolved, as before; the contract\'s verdicts are the five below', async () => {
    const spy = quiet();
    expect(await attributionOf(null, { agentId: CLONE })).toEqual({ attributionAgentId: CLONE, attributionStatus: 'unresolved', deferred: false });
    spy.mockRestore();
  });
  it.each([
    ['the clone agent missing', dbOf({})],
    ['the parent id missing', dbOf({ [CLONE]: { ownerId: 'owner-1' } })],
    ['the parent id empty', dbOf({ [CLONE]: { ownerId: 'owner-1', rankedAgentId: '' } })],
    ['the parent missing', dbOf({ [CLONE]: { ownerId: 'owner-1', rankedAgentId: 'agent-9' } })],
    ['an owner mismatch', dbOf({ [CLONE]: { ownerId: 'owner-1', rankedAgentId: 'agent-9' }, 'agent-9': { ownerId: 'owner-2' } })],
    ['a self-reference', dbOf({ [CLONE]: { ownerId: 'owner-1', rankedAgentId: CLONE } })],
  ])('unresolved (a verdict): %s — the clone\'s own id, never a guessed parent', async (_l, db) => {
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
    expect(r).toEqual({ attributionAgentId: null, attributionStatus: null, deferred: true, reason: 'prep_cut' });
    expect(db.reads).toEqual([`agents/${CLONE}`]); // the parent read never started
    expect(seen).toEqual(['read']);
    spy.mockRestore();
  });
  describe('V1.8 (ruling Q3): a read that FAILS is not a verdict — the battle is deferred, never unresolved', () => {
    const DEFERRED = { attributionAgentId: null, attributionStatus: null, deferred: true, reason: 'attribution_read_error' };
    const agents = { [CLONE]: { ownerId: 'owner-1', rankedAgentId: 'agent-1' }, 'agent-1': { ownerId: 'owner-1' } };
    it('the clone read throws → deferred (attribution_read_error); the parent is never read', async () => {
      const spy = quiet();
      const db = dbOf(agents, { failOn: [1] });
      expect(await attributionOf(db, { agentId: CLONE })).toEqual(DEFERRED);
      expect(db.reads).toEqual([`agents/${CLONE}`]);
      spy.mockRestore();
    });
    it('the parent read throws → deferred (attribution_read_error)', async () => {
      const spy = quiet();
      const db = dbOf(agents, { failOn: [2] });
      expect(await attributionOf(db, { agentId: CLONE })).toEqual(DEFERRED);
      expect(db.reads).toEqual([`agents/${CLONE}`, 'agents/agent-1']);
      spy.mockRestore();
    });
    it('any error counts, coded or not: a database read throwing a plain TypeError (no code) → deferred, on either read (review)', async () => {
      const spy = quiet();
      for (const failOn of [[1], [2]]) expect(await attributionOf(dbOf(agents, { failOn, plain: true }), { agentId: CLONE })).toEqual(DEFERRED);
      spy.mockRestore();
    });
    it('every read failing → deferred; the same agents healthy → resolved to the parent', async () => {
      const spy = quiet();
      expect(await attributionOf(dbOf(agents, { fail: true }), { agentId: CLONE })).toEqual(DEFERRED);
      expect(await attributionOf(dbOf(agents), { agentId: CLONE })).toEqual({ attributionAgentId: 'agent-1', attributionStatus: 'resolved', deferred: false });
      spy.mockRestore();
    });
    it('a throw from the read seam counts as a failed read; a budget refusal is prep_cut, never attribution_read_error', async () => {
      const spy = quiet();
      expect(await attributionOf(dbOf(agents), { agentId: CLONE }, { beforeRead: async () => { throw new Error('seam'); } })).toEqual(DEFERRED);
      expect(await attributionOf(dbOf(agents), { agentId: CLONE }, { mayRead: () => false }))
        .toEqual({ attributionAgentId: null, attributionStatus: null, deferred: true, reason: 'prep_cut' });
      spy.mockRestore();
    });
    it('a ranked battle needs no read, so a failing database cannot defer it', async () => {
      const db = dbOf({}, { fail: true });
      expect(await attributionOf(db, { agentId: 'agent-1' })).toEqual({ attributionAgentId: 'agent-1', attributionStatus: 'resolved', deferred: false });
      expect(db.reads).toEqual([]);
    });
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
