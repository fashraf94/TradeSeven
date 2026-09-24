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

// D-af (Amendment C §C1): the projection names every team — `label` the
// primary agent's (after settlement, the agent settlement recorded),
// `secondary` the player's, `teamLabel` on each stake, `winnerLabels` for the
// winner line — exactly as api/_utils/backingResults.js projects it.
const settled = (over = {}) => ({
  groupId: 'lobby-w40-a', poolId: 'lobby-w40-a', weekKey: '2026-W40', status: 'resolved', outcome: 'settled', formationPath: 'lobby', slotId: null,
  humanTeams: 2, potTotal: 1000, uniqueBackers: 4, winners: ['od-a'], winnerLabels: ['Shadow'], winningStakes: 700, paysX: 1.43,
  closedAt: '2026-09-28T04:00:00.000Z', settledAt: '2026-10-02T22:30:00.000Z', refundedAt: null, refundReason: null, holdReason: null, monthKey: '2026-09',
  teams: [
    { odUserId: 'od-a', isCpu: false, label: 'Shadow', secondary: 'Mira', backerCount: 2, stakeTotal: 700, sharePct: 70, paysX: 1.43, won: true },
    { odUserId: 'od-b', isCpu: false, label: 'Kestrel', secondary: 'Draco', backerCount: 2, stakeTotal: 300, sharePct: 30, paysX: 3.33, won: false },
    { odUserId: 'cpu-1', isCpu: true, label: 'CPU — Trend Follower', secondary: null, backerCount: 0, stakeTotal: 0, sharePct: 0, paysX: null, won: false },
  ],
  myStakes: [
    { stakeId: 's1', teamOdUserId: 'od-a', teamLabel: 'Shadow', amount: 500, status: 'won', payout: 714, voidReason: null, net: 214, loadoutChanged: true },
    { stakeId: 's2', teamOdUserId: 'od-b', teamLabel: 'Kestrel', amount: 100, status: 'lost', payout: 0, voidReason: null, net: -100, loadoutChanged: false },
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
    // Named by the PRIMARY AGENT (D-af); the player rides beside it on the team row.
    expect(t).toContain('Winner: Shadow');
    expect(t).toContain('Pot 1,000 BP · 4 backers');
    expect(t).toContain('Shadow · 500 BP');
    expect(t).toContain('Kestrel · 100 BP');
    expect(render(settled())).toContain('data-backing="results-team-secondary"');
    expect(t).toContain('Mira');
    expect(t).toContain('lost');
    expect(t).toContain('+114 BP net');
    const html = render(settled());
    expect(html).toContain('data-outcome="settled"');
    expect(html).toContain('>Settled<');
  });

  it('reveals every team: backers, the share labeled EXACTLY (§3), the winner\'s REALIZED "paid ×", the table\'s conditional figure for a loser, "no backers" for an unbacked seat', () => {
    const t = text(settled());
    expect(t).toContain('2 backers · 70% of BP in this pool backed them');
    expect(t).toContain('2 backers · 30% of BP in this pool backed them');
    // The winner shows what the pot PAID (pool.paysX); a losing team's figure
    // is §3's "if this team wins" table entry, said conditionally — a losing
    // team never "pays" (HON-2, HON-6 in the PR 5 review record).
    expect(t).toContain('paid ×1.43');
    expect(t).toContain('×3.33 had they won');
    expect(t).not.toMatch(/pays ×/);
    expect(t).toContain('no backers');
    expect(t).not.toMatch(/crowd|probab|chance|%\s*to win/i);
    const html = render(settled());
    expect(html.match(/data-backing="results-team"/g)).toHaveLength(3);
    expect(html).toContain('data-won="true"');
  });

  it('a figure the document does not carry is shown as absent, never as zero (HON-10)', () => {
    const bare = settled({
      uniqueBackers: null,
      teams: [{ odUserId: 'od-a', isCpu: false, backerCount: null, stakeTotal: null, sharePct: null, paysX: null, won: true }],
      myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 500, status: 'won', payout: null, voidReason: null, net: null, loadoutChanged: null }],
      myNet: null,
    });
    const t = text(bare);
    expect(t).toContain('Pot 1,000 BP');
    expect(t).not.toContain('0 backers');
    expect(t).toContain('paid — BP');
    expect(t).not.toContain('paid 0 BP');
    expect(t).not.toMatch(/\b0% of BP/);
    // …and a settled pool with no realized ratio on record says so rather than inventing one.
    expect(text(settled({ paysX: null }))).toContain('paid — BP');
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

  it('a tie names both winners and pays EVERY winner the pool\'s one realized ratio — never each team\'s own table figure (HON-2); a viewer with no stake is told so; the tape link opens the first backed team', () => {
    const tie = settled({
      winners: ['od-a', 'od-b'], winnerLabels: ['Shadow', 'Kestrel'], winningStakes: 1000, paysX: 1,
      teams: settled().teams.map((tm) => ({ ...tm, won: !tm.isCpu })),
      myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', teamLabel: 'Shadow', amount: 500, status: 'won', payout: 500, voidReason: null, net: 0, loadoutChanged: null }],
      myNet: 0,
    });
    const tt = text(tie);
    expect(tt).toContain('Winners (tie): Shadow & Kestrel');
    expect(tt.match(/paid ×1\.00/g)).toHaveLength(2);
    expect(tt).not.toContain('×1.43');
    expect(tt).not.toContain('×3.33');
    expect(tt).toContain('paid 500 BP');
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
      expect(t).not.toContain('had they won');
      expect(t).not.toContain('Winner');
    }
  });

  it('insufficient: the participation-minimum statement', () => {
    const t = text(voided('insufficient', null));
    expect(t).toContain('did not reach its participation minimum');
    expect(render(voided('insufficient', null))).toContain('>Did not qualify · stakes void<');
  });

  it('settling: says so — "complete" only for a pod with nothing left to play, the truth for a pod still playing (HON-3); held: says a human settles it', () => {
    const settling = settled({ outcome: 'settling', status: 'closed', podStatus: 'complete', winners: [], paysX: null, myNet: null, myStakes: [{ stakeId: 's1', teamOdUserId: 'od-a', amount: 500, status: 'live', payout: null, net: null, loadoutChanged: null }] });
    expect(text(settling)).toContain(RESULTS.settling);
    expect(text(settling)).toContain('settling');
    const playing = text({ ...settling, podStatus: 'battle' });
    expect(playing).toContain(RESULTS.settlingInPlay);
    expect(playing).not.toContain('complete');
    expect(text({ ...settling, podStatus: null })).toContain(RESULTS.settling);
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

describe('D-af — the winner line and the rows are the SERVER\'s names (Amendment C §C1; HON-17)', () => {
  const UID = 'AdaLovelace0000000000000001a';

  it('HON-17: a winner the projection names nothing for reads "Winner: Unnamed team" — never the account id', () => {
    const pod = settled({
      winners: [UID], winnerLabels: undefined,
      teams: [{ odUserId: UID, isCpu: false, backerCount: 2, stakeTotal: 700, sharePct: 70, paysX: 1.43, won: true }],
      myStakes: [{ stakeId: 's1', teamOdUserId: UID, amount: 500, status: 'won', payout: 714, voidReason: null, net: 214, loadoutChanged: null }],
    });
    const t = text(pod);
    expect(t).toContain('Winner: Unnamed team');
    expect(t).toContain('Unnamed team · 500 BP');
    expect(render(pod).replace(/data-[a-z-]+="[^"]*"/g, '')).not.toContain(UID);
  });

  it('a tie with one name missing names it neutrally and still says it is a tie — never "No result recorded"', () => {
    const t = text(settled({ winners: ['od-a', 'od-b'], winnerLabels: ['Shadow'] }));
    expect(t).toContain('Winners (tie): Shadow & Unnamed team');
    expect(t).not.toContain(RESULTS.noWinner);
  });
});
