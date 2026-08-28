// src/screens/leagueParticipantFraming.test.js
//
// Ranked participant framing — pure logic, the sibling of
// leagueTrainingBattleFraming.test.js. The load-bearing row here is the
// FLAG-OFF EQUIVALENCE block: this module replaced a hand-rolled
// `isForming ? … : …` binary that was inlined across four JSX sites, so the
// suite re-implements that binary and asserts agreement status-by-status. If the
// module ever drifts from it with preOpen false, the dark-merge guarantee breaks
// and this reds.

import { describe, it, expect } from 'vitest';
import { participantStatusFraming } from './leagueParticipantFraming';
import { GROUP_STATUS } from '../constants/leagueTournament';

const FORMING_COPY = 'Group forming — commit your draft board before Monday\'s draft.';
const LIVE_COPY = 'Battle week — your group drafted Monday.';

// The binary this module replaced, verbatim (LeagueParticipantView.jsx:321-324,
// :330, :338, :340, :346 before the change).
const legacy = (status) => ({
  tone: status === GROUP_STATUS.FORMING ? 'pending' : 'live',
  sub: status === GROUP_STATUS.FORMING ? FORMING_COPY : LIVE_COPY,
  showBattleBody: status !== GROUP_STATUS.FORMING,
});

const ALL_STATUSES = [
  GROUP_STATUS.FORMING, GROUP_STATUS.DRAFTING, GROUP_STATUS.AWAITING_OPEN,
  GROUP_STATUS.BATTLE, GROUP_STATUS.COMPLETE, GROUP_STATUS.EXPIRED, undefined,
];

describe('participantStatusFraming — phases', () => {
  it('FORMING keeps its own copy and hides the battle body', () => {
    const f = participantStatusFraming(GROUP_STATUS.FORMING);
    expect(f).toMatchObject({ phase: 'forming', tone: 'pending', sub: FORMING_COPY, showBattleBody: false });
  });

  it('BATTLE after the bell reads as the live battle week', () => {
    const f = participantStatusFraming(GROUP_STATUS.BATTLE);
    expect(f).toMatchObject({ phase: 'live', tone: 'live', sub: LIVE_COPY, showBattleBody: true });
  });

  it('BATTLE before the bell reads as awaiting, not "Battle week"', () => {
    // The Mon 08:45 slot pod at 08:50: status BATTLE, market shut. Before this
    // change the ranked drafter was told the battle had begun 40 min early.
    const f = participantStatusFraming(GROUP_STATUS.BATTLE, { preOpen: true });
    expect(f.phase).toBe('awaiting');
    expect(f.tone).toBe('pending');
    expect(f.sub).toMatch(/next market open/i);
    expect(f.sub).not.toBe(LIVE_COPY);
    expect(f.showBattleBody).toBe(false);
  });

  it('FORMING wins over preOpen (forming is never a pre-open battle day)', () => {
    expect(participantStatusFraming(GROUP_STATUS.FORMING, { preOpen: true }).sub).toBe(FORMING_COPY);
  });
});

describe('participantStatusFraming — FLAG-OFF EQUIVALENCE (the dark-merge guarantee)', () => {
  it.each(ALL_STATUSES.map((s) => [String(s), s]))(
    'status %s with preOpen false is byte-identical to the retired binary',
    (_label, status) => {
      const f = participantStatusFraming(status, { preOpen: false });
      expect({ tone: f.tone, sub: f.sub, showBattleBody: f.showBattleBody }).toEqual(legacy(status));
    },
  );

  it('the omitted-option call is identical to the explicit preOpen:false call', () => {
    for (const s of ALL_STATUSES) {
      expect(participantStatusFraming(s)).toEqual(participantStatusFraming(s, { preOpen: false }));
    }
  });

  it('AWAITING_OPEN keeps showing the battle body off-flag, exactly as !isForming did', () => {
    // Guards the subtle trap: collapsing AWAITING_OPEN into the awaiting phase
    // would have hidden a body the old binary showed — a flag-off behaviour change.
    expect(participantStatusFraming(GROUP_STATUS.AWAITING_OPEN).showBattleBody).toBe(true);
  });
});

describe('participantStatusFraming — anti-vacuous (BUILD_RULES §2)', () => {
  it('preOpen is what changes the answer for a BATTLE pod', () => {
    const off = participantStatusFraming(GROUP_STATUS.BATTLE, { preOpen: false });
    const on = participantStatusFraming(GROUP_STATUS.BATTLE, { preOpen: true });
    expect(off.sub).not.toBe(on.sub);
    expect(off.showBattleBody).not.toBe(on.showBattleBody);
    expect(off.tone).not.toBe(on.tone);
  });

  it('the legacy re-implementation is not trivially equal to the module', () => {
    // If `legacy` accidentally mirrored the module including preOpen, the
    // equivalence block above would be vacuous. It must DISAGREE when preOpen is on.
    const f = participantStatusFraming(GROUP_STATUS.BATTLE, { preOpen: true });
    expect({ tone: f.tone, sub: f.sub, showBattleBody: f.showBattleBody })
      .not.toEqual(legacy(GROUP_STATUS.BATTLE));
  });
});
