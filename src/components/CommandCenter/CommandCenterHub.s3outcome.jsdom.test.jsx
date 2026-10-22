// @vitest-environment jsdom
//
// Command Center hub, slice S3 (ruling R-S3-7; spec V1.2 §11.3 "Outcome C6":
// "positive loss/negative win colors"; review T4-1) — a completed row's verdict
// wears the verdict's colour, read from the rendered element, never the
// number's sign (BUILD_RULES §9): a row that LOST at +40.1 is negative, a row
// that WON at −3.5 positive; a draw, an ended game and no result wear neither.
// GameRow is the one place a verdict gets a colour (Games, History and the
// phone Overview all render it).

import React from 'react';
import { describe, expect, it } from 'vitest';
import { GameRow } from './sections/GamesSection';
import { completedGameRows } from './hub/gamesDisplay';
import { C } from './hub/hubStyle';
import { byText, mount } from './__fixtures__/hubTestKit';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SCORED = '2026-10-20T19:58:00.000Z';
const done = (mine, theirs, over = {}) => ({
  id: 'g', status: 'completed', completedAt: '2026-10-20T20:05:00.000Z', gameMode: 'baggerbomb_agent',
  scoreState: { currentScore: mine, opponentScore: theirs, lastScoredAt: SCORED },
  statusFeed: [{ action: 'battle_complete' }],
  ...over,
});

/** The verdict as rendered: its words and the colour of the element that shows them. */
function verdictShown(battle) {
  const [game] = completedGameRows([battle], {});
  const m = mount(<GameRow game={game} onOpen={() => {}} />);
  try {
    const el = byText(m.host, game.outcome.text);
    return { text: game.outcome.text, color: el ? el.style.color : null };
  } finally {
    m.unmount();
  }
}

describe('the verdict\'s colour is the verdict\'s, not the number\'s sign', () => {
  it.each([
    ['a positive score that lost', done(40.1, 52), /^Lost \+40\.1$/, C.neg],
    ['a negative score that won', done(-3.5, -12), /^Won −3\.5$/, C.pos],
    ['a positive score that won', done(40.1, 12), /^Won \+40\.1$/, C.pos],
    ['a negative score that lost', done(-3.5, 12), /^Lost −3\.5$/, C.neg],
    ['a zero score that won', done(0, -1), /^Won 0\.0$/, C.pos],
    ['a zero score that lost', done(0, 1), /^Lost 0\.0$/, C.neg],
  ])('%s', (_, battle, words, colour) => {
    const shown = verdictShown(battle);
    expect(shown.text).toMatch(words);
    expect(shown.color).toBe(colour);
  });

  it('a draw, an ended game and no result wear no verdict colour', () => {
    const neither = [
      done(7, 7),
      done(7, 3, { statusFeed: [] }),
      done(7, 3, { scoreState: { currentScore: 7, opponentScore: 3, lastScoredAt: null } }),
    ];
    for (const battle of neither) {
      const shown = verdictShown(battle);
      expect(shown.color, shown.text).not.toBe(C.pos);
      expect(shown.color, shown.text).not.toBe(C.neg);
    }
  });
});
