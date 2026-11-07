// api/_utils/activationEvidence/attribution.ownerCheck.test.js
//
// ID-1 review fixes (contract V1.9 §2; review PFB-4) — THE OBSERVER'S OWN OWNER
// CHECK, with the resolver as the only guard removed. Today's resolver
// (casualClone.js resolveAttributionAgentId) already refuses a parent whose
// ownerId differs from the clone's, so through it the check's parent clause is
// unreachable (attribution.test.js runs the real resolver). Here the resolver is
// replaced by one that reads both documents through the handle, exactly as the
// real one does, and then returns the parent the clone names WHATEVER the owner
// ids say: every refusal below is the observer's own. casualClone.js itself is
// unchanged.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../casualClone.js', () => ({
  resolveAttributionAgentId: async (db, battle) => {
    const clone = await db.collection('agents').doc(battle.agentId).get();
    const parentId = clone.exists ? clone.data().rankedAgentId : null;
    if (typeof parentId !== 'string' || !parentId) return battle.agentId;
    await db.collection('agents').doc(parentId).get();
    return parentId;
  },
}));
const { attributionOf } = await import('./attribution.js');

const CLONE = 'casual-agent-owner-1';
function dbOf(agents) {
  return { collection: () => ({ doc: (id) => ({ get: async () => ({ exists: agents[id] !== undefined, data: () => structuredClone(agents[id]) }) }) }) };
}
const UNRESOLVED = { attributionAgentId: CLONE, attributionStatus: 'unresolved', deferred: false };

describe('the owner check is the observer\'s own: a resolver that would accept any parent is still refused', () => {
  it.each([
    ['the parent owned by someone else (the clone and the battle agree)', 'owner-1', { ownerId: 'owner-1', rankedAgentId: 'agent-1' }, { ownerId: 'owner-2' }],
    ['the parent without ownerId', 'owner-1', { ownerId: 'owner-1', rankedAgentId: 'agent-1' }, {}],
    ['the parent missing', 'owner-1', { ownerId: 'owner-1', rankedAgentId: 'agent-1' }, undefined],
    ['all three with an empty ownerId', '', { ownerId: '', rankedAgentId: 'agent-1' }, { ownerId: '' }],
    ['the clone owned by someone other than the battle\'s owner', 'owner-1', { ownerId: 'owner-2', rankedAgentId: 'agent-1' }, { ownerId: 'owner-2' }],
  ])('%s → unresolved', async (_l, battleOwner, clone, parent) => {
    const agents = { [CLONE]: clone, ...(parent === undefined ? {} : { 'agent-1': parent }) };
    expect(await attributionOf(dbOf(agents), { agentId: CLONE, ownerId: battleOwner })).toEqual(UNRESOLVED);
  });
  it('battle, clone and parent naming one owner → resolved to the parent', async () => {
    const agents = { [CLONE]: { ownerId: 'owner-1', rankedAgentId: 'agent-1' }, 'agent-1': { ownerId: 'owner-1' } };
    expect(await attributionOf(dbOf(agents), { agentId: CLONE, ownerId: 'owner-1' })).toEqual({ attributionAgentId: 'agent-1', attributionStatus: 'resolved', deferred: false });
  });
});
