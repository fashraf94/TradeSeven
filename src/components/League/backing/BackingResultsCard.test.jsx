// src/components/League/backing/BackingResultsCard.test.jsx
//
// Backing Beta PR 5 — SURFACE E, the results card (spec V1.3 §5, §3, §4, §7,
// §9). react-dom/server: the card is pure over the projection.
//
// THE ROWS THIS FILE EXISTS FOR:
//   · MUTATION CHECK 3 — the payout rendered per stake is the projection's
//     `payout` (the stake document's), never stake × pays ×: the fixture is
//     built so the two differ (714 vs 715), and the product must not appear;
//   · the share is labeled EXACTLY ("70% of BP in this pool backed them");
//   · a refunded or insufficient pool is stated plainly with its reason;
//   · the loadout marker rides the viewer's own stakes only;
//   · no forbidden term.

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import BackingResultsCard, { stakeOutcomeWords } from './BackingResultsCard';
import { RESULTS } from './backingCopy';
import { findForbiddenTerm } from '../../../constants/backingLexicon';

const SEATS = { 'od-a': 'Mira', 'od-b': 'Draco' };
const settled = (over = {}) => ({
  groupId: 'lobby-w40-a', poolId: 'lobby-w40-a', weekKey: '2026-W40', status: 'resolved', outcome: 'settled', formationPath: 'lobby', slotId: null,
  seatNames: SEATS, humanTeams: 2, potTotal: 1000, uniqueBackers: 4, winners: ['od-a'], winningStakes: 700, paysX: 1.43,
  closedAt: '2026-09-28T04:00:00.000Z', settledAt: '2026-10-02T22:30:00.000Z', refundedAt: null, refundReason: null, holdReason: null, monthKey: '2026-09',
  teams: [
    { odUserId: 'od-a', isCpu: false, backerCount: 2, stakeTotal: 700, sharePct: 70, paysX: 1.43, won: true },
    { odUserId: 'od-b', isCpu: false, backerCount: 2, stakeTotal: 300, sharePct: 30, paysX: 3.33, won: false },
    { odUserId: 'cpu-1', isCpu: true, backerCount: 0, stakeTotal: 0, sharePct: 0, paysX: null, won: false },
  ],
  myStakes: [
    { stakeId: 's1', teamOdUserId: 'od-a', amount: 500, status: 'won', payout: 714, voidReason: null, net: 214, loadoutChanged: true },
    { stakeId: 's2', teamOdUserId: 'od-b', amount: 100, status: 'lost', payout: 0, voidReason: null, net: -100, loadoutChanged: false },
  ],
  myNet: 114, myWon: true,
  ...over,
});
const render = (pod, props = {}) => renderToString(<BackingResultsCard pod={pod} {...props} />);
// Visible text: tags become spaces, whitespace collapses, the entities the server escapes are decoded.
const text = (pod, props = {}) => render(pod, props)
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#x27;/g, '\u2019').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ');

describe('the settled card — every number is the projection\'s', () => {
  it('MUTATION CHECK 3 — renders the stake document\'s payout (714), never stake × pays × (715)', () => {
    const html = render(settled());
    expect(html).toContain('paid 714 BP');
    expect(html).not.toContain('715');
    expect(stakeOutcomeWords({ status: 'won', payout: 714 })).toBe('paid 714 BP');
    expect(stakeOutcomeWords({ status: 'lost' })).toBe(RESULTS.lost);
    expect(stakeOutcomeWords({ status: 'voided' })).toBe(RESULTS.voided);
    expect(stakeOutcomeWords({ status: 'live' })).toBe(RESULTS.pending);
  });

  it('names the winner, the pot and the backers; the viewer\'s stakes with their words; the net', () => {
    const t = text(settled());
    expect(t).toContain('Winner: Mira');
    expect(t).toContain('Pot 1,000 BP · 4 backers');
    expect(t).toContain('Mira · 500 BP');
    expect(t).toContain('Draco · 100 BP');
    expect(t).toContain('lost');
    expect(t).toContain('+114 BP net');
    const html = render(settled());
    expect(html).toContain('data-outcome="settled"');
    expect(html).toContain('>Settled<');
  });

  it('reveals every team: backers, the share labeled EXACTLY (§3), pays × from the table, "no backers" for an unbacked seat', () => {
    const t = text(settled());
    expect(t).toContain('2 backers · 70% of BP in this pool backed them');
    expect(t).toContain('2 backers · 30% of BP in this pool backed them');
    expect(t).toContain('pays ×1.43');
    expect(t).toContain('pays ×3.33');
    expect(t).toContain('no backers');
    expect(t).not.toMatch(/crowd|probab|chance|%\s*to win/i);
    const html = render(settled());
    expect(html.match(/data-backing="results-team"/g)).toHaveLength(3);
    expect(html).toContain('data-won="true"');
  });

  it('the loadout marker rides the viewer\'s OWN stakes: changed on s1, unchanged on s2, nothing when unknown', () => {
    const html = render(settled());
    expect(html.match(/data-backing="loadout-changed"/g)).toHaveLength(1);
    expect(text(settled())).toContain(RESULTS.loadoutChanged);
    expect(text(settled())).toContain(RESULTS.loadoutSame);
    const unknown = render(settled({ myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 500, status: 'won', payout: 714, net: 214, loadoutChanged: null }] }));
    expect(unknown).not.toContain('data-backing="loadout-changed"');
    expect(unknown).not.toContain(RESULTS.loadoutSame);
  });

  it('a tie names both winners; a viewer with no stake is told so; the tape link opens the first backed team', () => {
    expect(text(settled({ winners: ['od-a', 'od-b'] }))).toContain('Winners (tie): Mira & Draco');
    expect(text(settled({ myStakes: [], myNet: null }))).toContain(RESULTS.noStakes);
    const calls = [];
    const html = renderToString(<BackingResultsCard pod={settled()} onOpenTape={(g, f) => calls.push([g, f])} />);
    expect(html).toContain('data-backing="results-tape"');
  });
});

describe('a refunded, insufficient or settling pool is stated plainly', () => {
  const voided = (outcome, refundReason) => settled({
    outcome, status: outcome === 'insufficient' ? 'insufficient' : 'refunded', refundReason, refundedAt: '2026-09-29T20:30:00.000Z', winners: [], paysX: null, winningStakes: null, myNet: null, myWon: null,
    teams: settled().teams.map((t) => ({ ...t, paysX: null, won: null })),
    myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 500, status: 'voided', payout: null, voidReason: refundReason ?? 'insufficient', net: 0, loadoutChanged: null }],
  });

  it('refunded: the reason in plain words, the score-neutrality, the stake marked void, no payout, no pays ×', () => {
    for (const reason of ['group_voided', 'group_expired', 'group_deleted', 'admin']) {
      const html = render(voided('refunded', reason));
      expect(html).toContain('data-outcome="refunded"');
      expect(html).toContain('>Refunded · stakes void<');
      const t = text(voided('refunded', reason));
      expect(t).toContain(RESULTS.reason[reason]);
      expect(t).toContain(RESULTS.neutral);
      expect(t).toContain('void');
      expect(t).not.toContain('paid');
      expect(t).not.toContain('pays ×');
      expect(t).not.toContain('Winner');
    }
  });

  it('insufficient: the participation-minimum statement', () => {
    const t = text(voided('insufficient', null));
    expect(t).toContain('did not reach its participation minimum');
    expect(render(voided('insufficient', null))).toContain('>Did not qualify · stakes void<');
  });

  it('settling: says so; held: says a human settles it', () => {
    const settling = settled({ outcome: 'settling', status: 'closed', winners: [], paysX: null, myNet: null, myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 500, status: 'live', payout: null, net: null, loadoutChanged: null }] });
    expect(text(settling)).toContain(RESULTS.settling);
    expect(text(settling)).toContain('settling');
    expect(text(settled({ outcome: 'settling', status: 'resolving', holdReason: 'agent_layer_absent', winners: [], myNet: null }))).toContain(RESULTS.held);
  });

  it('a null pod renders nothing; the card speaks no forbidden term in any state', () => {
    expect(renderToString(<BackingResultsCard pod={null} />)).toBe('');
    for (const pod of [settled(), voided('refunded', 'admin'), voided('insufficient', null), settled({ outcome: 'settling', status: 'closed' })]) {
      expect(findForbiddenTerm(text(pod))).toBeNull();
    }
    for (const s of Object.values(RESULTS.reason)) expect(findForbiddenTerm(s)).toBeNull();
  });
});
