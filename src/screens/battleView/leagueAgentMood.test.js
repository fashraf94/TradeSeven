// src/screens/battleView/leagueAgentMood.test.js
//
// Agent form build S2 (founder ruling R15) — the League forms' mood, row by row: every precedence pair, opponents on their
// own standing only, and a standing taken from the screen's own order, never from a score. The screen's side (FuseHero's
// deriveCut, ClimbArena's ranking) is leagueAgentForm.sites.jsdom.test.jsx.

import { describe, expect, it } from 'vitest';
import { OUTCOME_KINDS, deriveGameOutcome } from '../../components/CommandCenter/hub/selectors/gameOutcome';
import { TOURNAMENT_GAME_MODE } from '../../constants/leagueTournament';
import { LEAGUE_ADVANCING_SPOTS, deriveLeagueMood, standingMood, standingOf } from './leagueAgentMood';

const NOW = Date.parse('2026-10-30T15:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const IDS = ['a', 'b', 'c', 'd'];
const board = (over = {}) => ({ ranked: IDS, cut: true, shown: true, complete: false, ...over });
const mine = (id, over) => standingOf(board(over), id);
const evaluating = { status: 'active', cronState: { evaluatingAt: ago(30_000) } };
const quiet = { status: 'active', cronState: { evaluatingAt: null } };
// What a League player's battle looks like at the bell: a banked day (agent-evaluate.js resolveCompletionDisposition).
const banked = { status: 'completed', gameMode: TOURNAMENT_GAME_MODE, completionContext: 'tournament_group_scored', statusFeed: [{ action: 'battle_complete' }], scoreState: { currentScore: 40, opponentScore: 1, evaluationCount: 9 } };

describe('the standing the screen shows (R15)', () => {
  it('ranked: first and the advancing spot are confident, out of it and last are worried, with no idle seat', () => {
    expect(IDS.map((id) => standingMood(mine(id)))).toEqual(['confident', 'confident', 'worried', 'worried']);
    expect(LEAGUE_ADVANCING_SPOTS).toBe(2);
  });

  it('training has no cut: first is confident, last worried, the middle idle', () => {
    expect(IDS.map((id) => standingMood(mine(id, { cut: false })))).toEqual(['confident', 'idle', 'idle', 'worried']);
  });

  it('a board that shows no standing is idle: the calm before the bell, a voided game, a level board', () => {
    for (const id of IDS) expect(standingMood(mine(id, { shown: false }))).toBe('idle');
  });

  it('a seat not on the board, an empty board and no board at all are idle', () => {
    expect(standingMood(mine('z'))).toBe('idle');
    expect(standingMood(standingOf(board({ ranked: [] }), 'a'))).toBe('idle');
    expect(standingMood(standingOf(board({ ranked: ['a'] }), 'a'))).toBe('idle');
    expect(standingMood(null)).toBe('idle');
    expect(standingOf(null, 'a')).toBeNull();
    expect(standingOf({}, 'a')).toBeNull();
  });

  it('a two-seat pod has no third place to be out in: first and last', () => {
    expect(['a', 'b'].map((id) => standingMood(standingOf({ ranked: ['a', 'b'], cut: false, shown: true }, id)))).toEqual(['confident', 'worried']);
  });

  it('standingOf is the screen\'s order and nothing else: a score has no way in', () => {
    expect(standingOf(board(), 'c')).toEqual({ rank: 3, seats: 4, cut: true, shown: true, complete: false });
    expect(standingOf({ ...board(), score: 99, scores: { c: 99 } }, 'c').rank).toBe(3);
  });
});

describe('the player\'s form: every precedence pair (R15)', () => {
  const you = (over) => deriveLeagueMood({ you: true, nowMs: NOW, ...over });

  it('celebrating (the group\'s final verdict) beats a live lock', () => {
    expect(you({ standing: mine('a', { complete: true }), battle: evaluating })).toBe('celebrating');
  });

  it('a finished game without that verdict is idle, never the standing and never a live lock', () => {
    expect(you({ standing: mine('c', { complete: true }), battle: evaluating })).toBe('idle');
    expect(you({ standing: mine('d', { complete: true }), battle: quiet })).toBe('idle');
  });

  it('researching beats the standing, on the same clock rule as the battle view', () => {
    expect(you({ standing: mine('a'), battle: evaluating })).toBe('researching');
    expect(you({ standing: mine('d'), battle: evaluating })).toBe('researching');
    expect(you({ standing: mine('d'), battle: evaluating, nowMs: NOW + 120_000 })).toBe('worried');
    expect(you({ standing: mine('d'), battle: evaluating, nowMs: undefined })).toBe('worried');
  });

  it('the standing, then idle', () => {
    expect(you({ standing: mine('a'), battle: quiet })).toBe('confident');
    expect(you({ standing: mine('d'), battle: quiet })).toBe('worried');
    expect(you({ standing: mine('b', { cut: false }), battle: quiet })).toBe('idle');
    expect(you({ standing: mine('a') })).toBe('confident');
    expect(you({})).toBe('idle');
  });

  it('waiting never fires: League has no cockpit, so no open call reaches it', () => {
    expect(you({ standing: mine('a'), battle: { ...quiet, needsYouCount: 3, cockpitFeed: { needsYouCount: 3 } } })).toBe('confident');
  });

  it('a daily battle completing is not the game ending: the standing goes on', () => {
    expect(you({ standing: mine('d'), battle: banked })).toBe('worried');
    expect(you({ standing: mine('a'), battle: banked })).toBe('confident');
  });
});

// R15 sent celebrating to deriveGameOutcome, which answers `banked` for a League record, never `won`: a League result belongs
// to the group. The founder's ruling of Oct 30, 2026 moves it to the group's final verdict, as the screen prints it.
describe('R15\'s letter on a League record', () => {
  const you = (over) => deriveLeagueMood({ you: true, nowMs: NOW, battle: banked, ...over });

  it('the one battle still says banked: a day\'s record is no verdict, and it no longer decides anything', () => {
    expect(deriveGameOutcome({ status: 'completed', gameMode: TOURNAMENT_GAME_MODE, completionContext: 'tournament_group_scored', scoreState: banked.scoreState }).kind).toBe(OUTCOME_KINDS.BANKED);
    expect(you({ standing: mine('a') })).toBe('confident');
  });

  it('ranked: "You advanced" celebrates, first or second; "Run ended" does not', () => {
    expect(IDS.map((id) => you({ standing: mine(id, { complete: true }) }))).toEqual(['celebrating', 'celebrating', 'idle', 'idle']);
  });

  it('training: only the winner celebrates', () => {
    expect(IDS.map((id) => you({ standing: mine(id, { complete: true, cut: false }) }))).toEqual(['celebrating', 'idle', 'idle', 'idle']);
  });

  it('never on an interim day: every place on a board still being played shows the standing', () => {
    expect(IDS.map((id) => you({ standing: mine(id) }))).toEqual(['confident', 'confident', 'worried', 'worried']);
  });

  it('a voided or level finish has no verdict: the screen prints none', () => {
    for (const id of IDS) expect(you({ standing: mine(id, { complete: true, shown: false }) })).toBe('idle');
  });

  it('the rank the screen prints decides it, where the screen hands it down, over the fuse\'s order', () => {
    expect(you({ standing: mine('c', { complete: true }), finalRank: 2 })).toBe('celebrating');
    expect(you({ standing: mine('a', { complete: true }), finalRank: 3 })).toBe('idle');
    expect(you({ standing: mine('a', { complete: true, shown: false }), finalRank: 1 })).toBe('idle');
  });
});

describe('an opponent\'s form: its own standing only (R15)', () => {
  const rival = (over) => deriveLeagueMood({ you: false, nowMs: NOW, ...over });

  it('never reads the player\'s battle: no lock, no win', () => {
    expect(rival({ standing: mine('d'), battle: evaluating })).toBe('worried');
    expect(rival({ standing: mine('a'), battle: evaluating })).toBe('confident');
    expect(rival({ standing: mine('d', { complete: true }), battle: banked, finalRank: 1 })).toBe('worried');
  });

  it('keeps its final standing when the game ends (S1\'s ruling 4), and shows none on a voided board', () => {
    expect(rival({ standing: mine('a', { complete: true }) })).toBe('confident');
    expect(rival({ standing: mine('d', { complete: true }) })).toBe('worried');
    expect(rival({ standing: mine('a', { complete: true, shown: false }) })).toBe('idle');
  });
});
