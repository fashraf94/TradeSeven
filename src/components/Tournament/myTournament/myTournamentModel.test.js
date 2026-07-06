import { describe, it, expect } from 'vitest';
import { deriveMyTournamentState, rankInPod, seatPips } from './myTournamentModel';
import { GROUP_STATUS } from '../../../constants/leagueTournament';

describe('deriveMyTournamentState', () => {
  it('no group (lobby-only or nothing) → awaiting', () => {
    expect(deriveMyTournamentState({ group: null, battle: null })).toBe('awaiting');
    expect(deriveMyTournamentState({})).toBe('awaiting');
  });

  it('FORMING group → awaiting', () => {
    expect(deriveMyTournamentState({ group: { status: GROUP_STATUS.FORMING }, battle: null })).toBe('awaiting');
  });

  it('BATTLE without a battle doc → drafting (single-shot resolution beat)', () => {
    expect(deriveMyTournamentState({ group: { status: GROUP_STATUS.BATTLE }, battle: null })).toBe('drafting');
  });

  it('BATTLE with a battle doc → bracket', () => {
    expect(deriveMyTournamentState({ group: { status: GROUP_STATUS.BATTLE }, battle: { id: 'b1' } })).toBe('bracket');
  });
});

describe('rankInPod', () => {
  const group = {
    groupMembers: ['you', 'riv', 'cpu1', 'cpu2'],
    dailyScores: {
      day1: {
        closeScores: {
          you: { compositePoints: 4.3 },
          riv: { compositePoints: 6.1 },
          cpu1: { compositePoints: -0.8 },
          cpu2: { compositePoints: 1.0 },
        },
      },
    },
  };

  it('ranks by composite desc, 1-based', () => {
    // riv(6.1) > you(4.3) > cpu2(1.0) > cpu1(-0.8)
    expect(rankInPod(group, 'riv')).toBe(1);
    expect(rankInPod(group, 'you')).toBe(2);
    expect(rankInPod(group, 'cpu2')).toBe(3);
    expect(rankInPod(group, 'cpu1')).toBe(4);
  });

  it('null when uid not in the pod / no group', () => {
    expect(rankInPod(group, 'ghost')).toBeNull();
    expect(rankInPod(null, 'you')).toBeNull();
  });
});

describe('seatPips', () => {
  it('formed group: split players by isCpu, open = 0', () => {
    const group = {
      players: [
        { odUserId: 'you' }, { odUserId: 'riv' },
        { odUserId: 'c1', isCpu: true }, { odUserId: 'c2', isCpu: true },
      ],
    };
    expect(seatPips({ group })).toEqual({ human: 2, cpu: 2, open: 0, total: 4 });
  });

  it('pre-formation lobby: members are humans, the rest open', () => {
    expect(seatPips({ lobby: { members: [{ odUserId: 'you' }, { odUserId: 'riv' }] } }))
      .toEqual({ human: 2, cpu: 0, open: 2, total: 4 });
  });

  it('nothing → all open', () => {
    expect(seatPips({})).toEqual({ human: 0, cpu: 0, open: 4, total: 4 });
  });
});
