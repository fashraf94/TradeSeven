// src/utils/commandCenterLiveBattles.test.js
//
// Behavioral guard for the Command Center voided-group exclusion (L-A follow-up B).
// The poll itself is inline in the un-mountable App.jsx (see App.agentBattlesPoll.
// test.js for why that layer is source-guarded); this pins the actual exclusion
// DECISION — pure and directly testable — including the operator scenario that
// fails today: a group voided MID-DAY, whose battle still has a future expiresAt.

import { describe, it, expect } from 'vitest';
import {
  excludeVoidedGroupBattles,
  classifyBattleType,
  battleTypeLabel,
  hasLiveBaggerBomb,
  sortLiveBattles,
  deriveDeployGate,
  DEPLOY_BLOCK_REASON,
  BATTLE_TYPE_RANKED,
  BATTLE_TYPE_BAGGERBOMB,
} from './commandCenterLiveBattles';
import { GROUP_STATUS } from '../constants/leagueTournament';

describe('excludeVoidedGroupBattles — Command Center voided-group exclusion (L-A follow-up B)', () => {
  // The case that actually fails today: a group voided mid-session, so its battle
  // still carries a FUTURE expiresAt and would otherwise count down as "2h Xm left".
  const midDayLiveBattle = {
    id: 'b1', groupId: 'g-voided', agentId: 'agent-real',
    expiresAt: '2999-01-01T20:00:00.000Z', scoreState: { currentScore: -33, tradeCount: 2 },
  };

  it('excludes a VOIDED group\'s battle EVEN with a future expiresAt (the mid-day operator case)', () => {
    const groupsById = { 'g-voided': { id: 'g-voided', status: GROUP_STATUS.VOIDED } };
    expect(excludeVoidedGroupBattles([midDayLiveBattle], groupsById)).toEqual([]);
  });

  it('keeps the SAME battle when its group is still live (exclusion is by GROUP STATUS, not expiry)', () => {
    const groupsById = { 'g-voided': { id: 'g-voided', status: GROUP_STATUS.BATTLE } };
    expect(excludeVoidedGroupBattles([midDayLiveBattle], groupsById).map((b) => b.id)).toEqual(['b1']);
  });

  it('keeps a casual vs-CPU battle (no groupId — a casual deploy can never be voided)', () => {
    const casual = { id: 'c1', agentId: 'agent-real', expiresAt: '2999-01-01T20:00:00.000Z' }; // no groupId
    expect(excludeVoidedGroupBattles([casual], {}).map((b) => b.id)).toEqual(['c1']);
  });

  it('fails OPEN when the group cannot be resolved (a transient read miss never blanks a live battle)', () => {
    // groupId present but absent from groupsById (the group read failed this tick) → keep.
    expect(excludeVoidedGroupBattles([midDayLiveBattle], {}).map((b) => b.id)).toEqual(['b1']);
  });

  it('excludes only the voided one from a mixed set (voided tourney out; live tourney + casual stay)', () => {
    const liveTourney = { id: 'b2', groupId: 'g-live', agentId: 'a2' };
    const casual = { id: 'c1', agentId: 'a3' };
    const groupsById = {
      'g-voided': { status: GROUP_STATUS.VOIDED },
      'g-live': { status: GROUP_STATUS.BATTLE },
    };
    expect(
      excludeVoidedGroupBattles([midDayLiveBattle, liveTourney, casual], groupsById).map((b) => b.id),
    ).toEqual(['b2', 'c1']);
  });

  it('treats COMPLETE/EXPIRED groups as NOT voided ("final", not "voided" — their battle docs settle out of the active poll upstream)', () => {
    const groupsById = { 'g-voided': { status: GROUP_STATUS.COMPLETE } };
    expect(excludeVoidedGroupBattles([midDayLiveBattle], groupsById).map((b) => b.id)).toEqual(['b1']);
  });

  it('is null / empty / undefined safe', () => {
    expect(excludeVoidedGroupBattles(null)).toEqual([]);
    expect(excludeVoidedGroupBattles([], {})).toEqual([]);
    expect(excludeVoidedGroupBattles(undefined, undefined)).toEqual([]);
  });
});

// ── Phase 1.5 · Command Center multi-battle ─────────────────────────────────

describe('classifyBattleType — groupId-presence discriminator (founder-ruled)', () => {
  it('a groupId ⇒ RANKED (League / tournament joint-stamp)', () => {
    expect(classifyBattleType({ id: 'r1', groupId: 'g1', gameMode: 'baggerbomb_tournament' })).toBe(BATTLE_TYPE_RANKED);
  });
  it('no groupId ⇒ BaggerBomb (casual)', () => {
    expect(classifyBattleType({ id: 'b1', gameMode: 'baggerbomb_agent' })).toBe(BATTLE_TYPE_BAGGERBOMB);
    expect(classifyBattleType({ id: 'b2', groupId: '' })).toBe(BATTLE_TYPE_BAGGERBOMB);
  });
  it('the optimistic post-deploy entry (gameMode:null, groupId:null) classifies as BaggerBomb — the reason groupId beats gameMode', () => {
    expect(classifyBattleType({ id: 'opt', gameMode: null, groupId: null })).toBe(BATTLE_TYPE_BAGGERBOMB);
  });
  it('is null-safe', () => {
    expect(classifyBattleType(null)).toBe(BATTLE_TYPE_BAGGERBOMB);
    expect(classifyBattleType(undefined)).toBe(BATTLE_TYPE_BAGGERBOMB);
  });
});

describe('battleTypeLabel — each card labeled by type (acceptance #4)', () => {
  it('ranked → "Ranked", casual → "BaggerBomb"', () => {
    expect(battleTypeLabel({ groupId: 'g1' })).toBe('Ranked');
    expect(battleTypeLabel({})).toBe('BaggerBomb');
  });
});

describe('hasLiveBaggerBomb — the per-type Deploy-CTA gate (acceptance #1, #2)', () => {
  const ranked = { id: 'r1', groupId: 'g1', status: 'active' };
  const bagger = { id: 'b1', status: 'active' }; // no groupId

  it('a live RANKED battle is NOT a live BaggerBomb → casual deploy stays ENABLED (acceptance #1)', () => {
    expect(hasLiveBaggerBomb([ranked])).toBe(false);
  });
  it('a live BaggerBomb blocks a second BaggerBomb deploy (acceptance #2)', () => {
    expect(hasLiveBaggerBomb([bagger])).toBe(true);
    expect(hasLiveBaggerBomb([ranked, bagger])).toBe(true); // ranked + baggerbomb concurrently
  });
  it('empty / null safe (no live battle → not blocked)', () => {
    expect(hasLiveBaggerBomb([])).toBe(false);
    expect(hasLiveBaggerBomb(null)).toBe(false);
    expect(hasLiveBaggerBomb(undefined)).toBe(false);
  });
  it('ignores a non-active casual battle (a stale COMPLETED deploy must not latch the CTA blocked)', () => {
    expect(hasLiveBaggerBomb([{ id: 'b1', status: 'completed' }])).toBe(false);
    expect(hasLiveBaggerBomb([{ id: 'b1' }])).toBe(false); // no status → not counted as live
  });

  // The full flag-gated CTA decision as the dashboards compute it:
  //   deployBlockedByLive = concurrencyOn ? hasLiveBaggerBomb(live) : (live.length > 0)
  const gate = (live, concurrencyOn) => (concurrencyOn ? hasLiveBaggerBomb(live) : live.length > 0);
  it('TRUTH TABLE — ranked live: casual deploy ENABLED flag-on, BLOCKED flag-off', () => {
    expect(gate([ranked], true)).toBe(false);  // flag-on: enabled
    expect(gate([ranked], false)).toBe(true);  // flag-off: global block (byte-identical)
  });
  it('TRUTH TABLE — BaggerBomb live: a second BaggerBomb BLOCKED under both flags', () => {
    expect(gate([bagger], true)).toBe(true);
    expect(gate([bagger], false)).toBe(true);
  });
  it('TRUTH TABLE — nothing live: deploy ENABLED under both flags', () => {
    expect(gate([], true)).toBe(false);
    expect(gate([], false)).toBe(false);
  });
});

describe('sortLiveBattles — deterministic order for the two-card set (acceptance #4)', () => {
  const ranked = { id: 'r1', groupId: 'g1', activatedAt: '2026-08-07T12:00:00.000Z' };
  const bagger = { id: 'b1', activatedAt: '2026-08-07T14:00:00.000Z' }; // newer, but casual

  it('ranked first even when the BaggerBomb is more recent', () => {
    expect(sortLiveBattles([bagger, ranked]).map((b) => b.id)).toEqual(['r1', 'b1']);
    expect(sortLiveBattles([ranked, bagger]).map((b) => b.id)).toEqual(['r1', 'b1']);
  });
  it('within a type, most-recently-activated first, then id (total order — never Firestore arrival order)', () => {
    const older = { id: 'b-older', activatedAt: '2026-08-01T00:00:00.000Z' };
    const newer = { id: 'b-newer', activatedAt: '2026-08-05T00:00:00.000Z' };
    expect(sortLiveBattles([older, newer]).map((b) => b.id)).toEqual(['b-newer', 'b-older']);
    // identical timestamps → stable id tiebreak
    const t = '2026-08-05T00:00:00.000Z';
    expect(sortLiveBattles([{ id: 'z', activatedAt: t }, { id: 'a', activatedAt: t }]).map((b) => b.id)).toEqual(['a', 'z']);
  });
  it('does not mutate its input and is null-safe', () => {
    const input = [bagger, ranked];
    const out = sortLiveBattles(input);
    expect(input.map((b) => b.id)).toEqual(['b1', 'r1']); // input order untouched
    expect(out).not.toBe(input);
    expect(sortLiveBattles(null)).toEqual([]);
    expect(sortLiveBattles(undefined)).toEqual([]);
  });
  it('honors the comparator contract: entries equal on every key return 0 (a well-defined comparator, not a>b && b>a)', () => {
    // Contract hygiene, independent of whether equal-key entries actually occur: a
    // comparator that returns nonzero for equal elements is ill-defined and yields
    // engine-dependent order. Two entries identical on type+timestamp+id must sort to 0.
    const same = { id: 'x', activatedAt: '2026-08-05T00:00:00.000Z' };
    const dup = { id: 'x', activatedAt: '2026-08-05T00:00:00.000Z' };
    expect(() => sortLiveBattles([same, dup, same])).not.toThrow();
    expect(sortLiveBattles([same, dup]).map((b) => b.id)).toEqual(['x', 'x']);
  });
});

describe('deriveDeployGate — the ONE shared gate both shells consume', () => {
  const ranked = { id: 'r1', groupId: 'g1', status: 'active', activatedAt: '2026-08-07T12:00:00.000Z' };
  const bagger = { id: 'b1', status: 'active', activatedAt: '2026-08-07T14:00:00.000Z' };
  const agentInBattle = { activeBattleId: 'r1' };
  const agentIdle = { activeBattleId: null };

  it('flag-OFF: every value reduces to the legacy isLive gate (byte-identical)', () => {
    const g = deriveDeployGate({ liveBattles: [ranked], agent: agentInBattle, concurrencyEnabled: false });
    expect(g.deployBlockedByLive).toBe(true);   // any live battle blocks
    expect(g.deployBlockReason).toBe(null);      // no reason surfaced flag-off
    expect(g.equipLocked).toBe(true);            // isLive, not activeBattleId
    expect(g.orderedLiveBattles).toEqual([ranked]); // unsorted passthrough
  });
  it('flag-ON, ranked live only: deploy ENABLED, equip UNLOCKED unless the REAL agent is battling', () => {
    const g = deriveDeployGate({ liveBattles: [ranked], agent: agentInBattle, concurrencyEnabled: true });
    expect(g.deployBlockedByLive).toBe(false);   // a live ranked battle does not block a BaggerBomb
    expect(g.deployBlockReason).toBe(null);
    expect(g.equipLocked).toBe(true);            // real agent IS in the ranked battle
  });
  it('flag-ON, casual live only: deploy BLOCKED with reason, but equip UNLOCKED (clone battle ≠ real-agent lock)', () => {
    const g = deriveDeployGate({ liveBattles: [bagger], agent: agentIdle, concurrencyEnabled: true });
    expect(g.deployBlockedByLive).toBe(true);
    expect(g.deployBlockReason).toBe(DEPLOY_BLOCK_REASON);
    expect(g.equipLocked).toBe(false);           // real agent NOT battling → loadout editable
  });
  it('flag-ON: orderedLiveBattles is deterministically sorted (ranked first)', () => {
    const g = deriveDeployGate({ liveBattles: [bagger, ranked], agent: agentInBattle, concurrencyEnabled: true });
    expect(g.orderedLiveBattles.map((b) => b.id)).toEqual(['r1', 'b1']);
  });
  it('nothing live: deploy enabled, equip unlocked under both flags', () => {
    for (const flag of [true, false]) {
      const g = deriveDeployGate({ liveBattles: [], agent: agentIdle, concurrencyEnabled: flag });
      expect(g.deployBlockedByLive).toBe(false);
      expect(g.equipLocked).toBe(false);
      expect(g.deployBlockReason).toBe(null);
    }
  });
});
