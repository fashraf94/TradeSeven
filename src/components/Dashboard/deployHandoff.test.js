// src/components/Dashboard/deployHandoff.test.js
//
// Command Center repair R1 (ruling R-R1-5) — App's handoff, the pure half:
// the real id or nothing, the owner check, and the optimistic entry with its
// owner and local-origin marker.

import { describe, it, expect } from 'vitest';
import {
  handoffBattleId, isHandoffOwnerCurrent, buildOptimisticBattleEntry, appendOptimisticBattle,
} from './deployHandoff';

describe('handoffBattleId: the real server id, or null — never a fabricated one', () => {
  it('a real id passes through', () => {
    expect(handoffBattleId({ agentBattleId: 'battle-new' })).toBe('battle-new');
  });
  it.each([
    ['null', { agentBattleId: null }],
    ['missing', {}],
    ['empty', { agentBattleId: '' }],
    ['padded', { agentBattleId: ' battle-new ' }],
    ['a number', { agentBattleId: 42 }],
    ['no meta at all', undefined],
  ])('%s → null', (_label, meta) => {
    expect(handoffBattleId(meta)).toBeNull();
  });
});

describe('isHandoffOwnerCurrent: the captured owner is still the signed-in one', () => {
  it('the same uid → true', () => { expect(isHandoffOwnerCurrent('uid-A', 'uid-A')).toBe(true); });
  it.each([
    ['another account', 'uid-A', 'uid-B'],
    ['signed out', 'uid-A', null],
    ['no captured owner', null, 'uid-A'],
    ['an empty captured owner', '', ''],
    ['nobody on either side', null, null],
    ['an undefined captured owner', undefined, undefined],
  ])('%s → false', (_label, captured, current) => {
    expect(isHandoffOwnerCurrent(captured, current)).toBe(false);
  });
});

describe('buildOptimisticBattleEntry: the settle\'s entry, with its owner and its origin', () => {
  const ARGS = {
    agentBattleId: 'battle-new', ownerUid: 'uid-A', agentId: 'casual-agent-uid-A',
    expiresAt: '2026-10-16T20:00:00.000Z', nowIso: '2026-10-16T14:00:00.000Z',
    portfolio: { star: [{ symbol: 'AAA' }], core: [], support: [] },
    bench: { stocks: [{ symbol: 'BBB' }] },
    startingPrices: { AAA: 10, BBB: 20 },
    opponentPortfolio: { star: [{ symbol: 'CCC' }] },
    opponentBench: { stocks: [] },
  };

  it('carries every field the real document does, plus ownerId and localOrigin', () => {
    expect(buildOptimisticBattleEntry(ARGS)).toEqual({
      id: 'battle-new',
      agentId: 'casual-agent-uid-A',
      ownerId: 'uid-A',
      localOrigin: true,
      status: 'active',
      expiresAt: '2026-10-16T20:00:00.000Z',
      activatedAt: '2026-10-16T14:00:00.000Z',
      createdAt: '2026-10-16T14:00:00.000Z',
      portfolio: {
        star: [{ symbol: 'AAA' }], core: [], support: [],
        bench: { stocks: [{ symbol: 'BBB' }] },
        startingPrices: { AAA: 10, BBB: 20 },
      },
      opponent: { portfolio: { star: [{ symbol: 'CCC' }] }, bench: { stocks: [] } },
      gameMode: null,
      groupId: null,
    });
  });

  it('with no opponent, no expiry and no portfolio it still reads as a live casual battle', () => {
    const e = buildOptimisticBattleEntry({ ...ARGS, opponentPortfolio: null, expiresAt: undefined, portfolio: null, bench: undefined });
    expect(e.opponent).toBeNull();
    expect(e.expiresAt).toBeNull();
    expect(e.portfolio).toEqual({ bench: null, startingPrices: { AAA: 10, BBB: 20 } });
    expect(e.status).toBe('active');
    expect(e.groupId).toBeNull();
  });
});

describe('appendOptimisticBattle: once per id', () => {
  it('appends to the list', () => {
    expect(appendOptimisticBattle([{ id: 'other' }], { id: 'battle-new' })).toEqual([{ id: 'other' }, { id: 'battle-new' }]);
  });
  it('a repeated id leaves the list exactly as it was', () => {
    const prev = [{ id: 'battle-new' }];
    expect(appendOptimisticBattle(prev, { id: 'battle-new', again: true })).toBe(prev);
  });
  it('a missing list starts a new one', () => {
    expect(appendOptimisticBattle(null, { id: 'battle-new' })).toEqual([{ id: 'battle-new' }]);
  });
});
