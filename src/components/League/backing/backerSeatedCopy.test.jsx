// src/components/League/backing/backerSeatedCopy.test.jsx
//
// Backing safety fix 1, item B — THE NEW VOID REASON IN PLAIN WORDS (Amendment
// D R4). The close voids a stake whose backer took a seat in the pod
// (`voidReason: 'backer_seated'`, api/_utils/backingPools.js) and refunds it to
// the record. Wherever a stake's void reaches the client — the results card's
// stake rows (both layouts, one helper) and Your Backing's week card — it reads
// "Refunded — you took a seat in this pod." instead of a bare "void". Every
// other void reason reads as before.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('../../../hooks/useSpectatedTournamentBattles', () => ({ default: () => ({ battles: {}, loading: false, error: null }) }));

const { default: BackingResultsCard, BackingResultsCardDesk, stakeOutcomeWords } = await import('./BackingResultsCard');
const { weekCardModel } = await import('./YourBacking');
const { RESULTS, WEEK } = await import('./backingCopy');
const { VOID_REASONS } = await import('../../../../api/_utils/backingPools.js');

const SEATED = 'Refunded — you took a seat in this pod.';

describe('backer_seated — the stake says why it was refunded', () => {
  it('the copy is keyed by the server\'s own void reason', () => {
    expect(VOID_REASONS.BACKER_SEATED).toBe('backer_seated');
    expect(RESULTS.stakeVoid[VOID_REASONS.BACKER_SEATED]).toBe(SEATED);
  });

  it('the results card\'s stake row reads the sentence; any other void reads "void" as before', () => {
    expect(stakeOutcomeWords({ status: 'voided', voidReason: 'backer_seated' })).toBe(SEATED);
    for (const voidReason of ['seat_left', 'insufficient', 'group_deleted', null, undefined]) {
      expect(stakeOutcomeWords({ status: 'voided', voidReason })).toBe(RESULTS.voided);
    }
  });

  it('Your Backing\'s week card reads it beside the team\'s amount', () => {
    const base = { groupId: 'g1', pool: { status: 'closed' }, group: null, labelsById: {}, battles: {}, groupAnswered: false };
    const seated = weekCardModel({ ...base, stakes: [{ teamOdUserId: 'od-a', amount: 50, status: 'voided', voidReason: 'backer_seated' }] });
    expect(seated.stakeStatus('od-a')).toBe(SEATED);
    const left = weekCardModel({ ...base, stakes: [{ teamOdUserId: 'od-a', amount: 50, status: 'voided', voidReason: 'seat_left' }] });
    expect(left.stakeStatus('od-a')).toBe(WEEK.stakeStatus.voided);
  });
});

describe('HON-3 (the review): a stake voided inside a pool that was NOT says where its points went', () => {
  const pod = (stakeOver = {}) => ({
    groupId: 'g1', outcome: 'settled', status: 'resolved', potTotal: 300, uniqueBackers: 3, winners: ['od-b'], winnerLabels: [{ label: 'Kestrel' }],
    teams: [], myNet: 0,
    myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: 'Shadow', amount: 50, status: 'voided', voidReason: 'backer_seated', ...stakeOver }],
  });
  for (const [layout, Card] of [['mobile', BackingResultsCard], ['desktop', BackingResultsCardDesk]]) {
    it(`the results card (${layout}): the backer_seated sentence AND the refund-to-record line`, () => {
      const html = renderToString(<Card pod={pod()} />);
      expect(html).toContain(SEATED);
      expect(html).toContain('data-backing="results-stake-refund-note"');
      expect(html).toContain(RESULTS.toRecord);
    });
    it(`the results card (${layout}): no refund line when no stake of the viewer's was voided`, () => {
      const html = renderToString(<Card pod={pod({ status: 'lost', voidReason: undefined })} />);
      expect(html).not.toContain('data-backing="results-stake-refund-note"');
    });
  }
  it('Your Backing: a voided stake carries the refund line on the week card', () => {
    const base = { groupId: 'g1', pool: { status: 'resolved' }, group: null, labelsById: {}, battles: {}, groupAnswered: false };
    expect(weekCardModel({ ...base, stakes: [{ teamOdUserId: 'od-a', amount: 50, status: 'voided', voidReason: 'backer_seated' }] }).voidOutcome).toBe(true);
    expect(weekCardModel({ ...base, stakes: [{ teamOdUserId: 'od-a', amount: 50, status: 'lost' }] }).voidOutcome).toBe(false);
  });
});
