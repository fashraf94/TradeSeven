// api/_utils/filmRoom/cardStore.perGame.test.js
//
// Build A2 — Phase 0's R4, the plays ledger's predicate with PER_GAME_LOADOUT_ENABLED mocked ON (cardStore.test.js
// runs the same store flag off, unchanged). The ledger lives under the ranked record (the attribution agent), which
// holds both loadouts, so:
//   - an entry is ACTIVE when its archetype is either loadout's (BaggerBomb's slot or League's ranked field), and
//     shelved otherwise — in the read, the cap and the retire;
//   - a create is refused only when the tape day's archetype differs from that battle's own (it never should); a day
//     taped in an archetype no loadout wears now files, shelved, and comes back when a loadout wears it again.
// The predicate only: the Film Room arc owns the rest of the store.

import { describe, expect, it, vi } from 'vitest';
import { makeTapeDb } from '../filmTape/__fixtures__/tapeFirestore.js';
import { createCard, readCards, retireCard } from './cardStore.js';

vi.mock('../../../src/config/perGameLoadoutFlags.js', () => ({ PER_GAME_LOADOUT_ENABLED: true }));

const UID = 'owner-1';
const AGENT = 'agent-1';
const NOW = '2026-11-06T21:00:00.000Z';
// League (the ranked field) wears the Contrarian; BaggerBomb's slot the Trend Follower.
const RANKED = { ownerId: UID, name: 'Aurora', archetype: 'contrarian', loadouts: { baggerbomb: { archetype: 'momentum_chaser', book: { ref: null, name: null, pin: null } } } };
const payload = (archetypeCodeId, over = {}) => ({
  archetypeCodeId, situationId: 'stalled', situationVersion: 2,
  battleId: 'b-1', etDate: '2026-11-05', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5,
  questionId: 'stalled.want', questionVersion: 1, note: 'Let it go sooner.', route: 'watch', ...over,
});
const fresh = (agent = RANKED) => makeTapeDb({ [`agents/${AGENT}`]: agent });
const code = async (p) => { try { await p; return null; } catch (e) { return e.cardRoute ? { status: e.status, code: e.code, extra: e.extra } : { thrown: String(e) }; } };
const create = (t, opId, archetype, battleArchetype = archetype) => createCard(t.db, { uid: UID, agentId: AGENT, opId, payload: payload(archetype), nowIso: NOW, battleArchetype });

describe('R4: active when either loadout wears the archetype, shelved otherwise', () => {
  it('a BaggerBomb card (the slot\'s archetype) and a League card are both active; a third archetype\'s is shelved', async () => {
    const t = fresh();
    await create(t, 'op_bb', 'momentum_chaser');
    await create(t, 'op_lg', 'contrarian');
    await create(t, 'op_other', 'degen');
    const read = await readCards(t.db, { uid: UID, agentId: AGENT });
    const shelved = Object.fromEntries(read.cards.map((c) => [c.entryId, c.shelved]));
    expect(shelved).toEqual({ op_bb: false, op_lg: false, op_other: true });
    expect(read.open).toBe(2);
    expect(read.archetypeCodeId).toBe('contrarian'); // the ranked field, as the read has always returned
  });

  it('with the slot absent BaggerBomb wears the default, so one archetype is active, as before A2', async () => {
    const t = fresh({ ownerId: UID, name: 'Aurora', archetype: 'contrarian' });
    await create(t, 'op_lg', 'contrarian');
    await create(t, 'op_tf', 'momentum_chaser');
    const read = await readCards(t.db, { uid: UID, agentId: AGENT });
    expect(read.cards.find((c) => c.entryId === 'op_tf').shelved).toBe(true);
    expect(read.open).toBe(1);
  });

  it('a BaggerBomb card can be retired while League wears another archetype (flag off it would read shelved)', async () => {
    const t = fresh();
    const { card } = await create(t, 'op_bb', 'momentum_chaser');
    const r = await retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'op_bb', opId: 'op_r', expectedVersion: card.version, nowIso: NOW });
    expect(r.card.stage).toBe('retired');
  });

  it('a card whose archetype neither loadout wears is shelved: it cannot be retired', async () => {
    const t = fresh();
    const { card } = await create(t, 'op_other', 'degen');
    expect(await code(retireCard(t.db, { uid: UID, agentId: AGENT, entryId: 'op_other', opId: 'op_r', expectedVersion: card.version, nowIso: NOW })))
      .toMatchObject({ status: 409, code: 'shelved' });
  });
});

describe('R4: a create is refused only when the tape day\'s archetype is not the battle\'s own', () => {
  it('the day and the battle agree → filed, whatever the loadouts wear now (here shelved at birth, back when a loadout wears it)', async () => {
    const t = fresh();
    const r = await create(t, 'op_1', 'degen', 'degen');
    expect(r.idempotent).toBe(false);
    expect(r.open).toBe(0);
  });

  it('the day and the battle disagree → 409 archetype_changed, nothing filed', async () => {
    const t = fresh();
    expect(await code(create(t, 'op_1', 'contrarian', 'degen'))).toMatchObject({ status: 409, code: 'archetype_changed', extra: { archetypeCodeId: 'contrarian', current: 'degen' } });
    expect(await code(create(t, 'op_2', 'contrarian', null))).toMatchObject({ status: 409, code: 'archetype_changed' });
  });
});
