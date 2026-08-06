// src/utils/commandCenterLiveBattles.test.js
//
// Behavioral guard for the Command Center voided-group exclusion (L-A follow-up B).
// The poll itself is inline in the un-mountable App.jsx (see App.agentBattlesPoll.
// test.js for why that layer is source-guarded); this pins the actual exclusion
// DECISION — pure and directly testable — including the operator scenario that
// fails today: a group voided MID-DAY, whose battle still has a future expiresAt.

import { describe, it, expect } from 'vitest';
import { excludeVoidedGroupBattles } from './commandCenterLiveBattles';
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
