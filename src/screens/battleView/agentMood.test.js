// src/screens/battleView/agentMood.test.js
//
// Agent form build S1 — deriveAgentMood, row by row on fixtures (founder rulings R8, R9): every precedence pair, the
// opponent's sign flip, the CPU never waiting or researching, a completed battle lost or tied → idle; the evaluation
// lock's age as the server judges it; and the outcome projection held equal to the hub's own.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as outcomes from '../../components/CommandCenter/hub/selectors/gameOutcome';
import { outcomeInputOf as hubOutcomeInputOf } from '../../components/CommandCenter/hub/gamesDisplay';
import { EVALUATION_LOCK_MS, deriveAgentMood, evaluationInFlight, outcomeInputOf } from './agentMood';

const NOW = Date.parse('2026-10-29T15:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const FINAL = [{ action: 'battle_complete' }];
const SCORED = { lastScoredAt: '2026-10-29T14:59:00.000Z', evaluationCount: 12 };

/** A battle with exactly the signals asked for. */
function battle({ status = 'active', evaluating = false, mine = 10, theirs = 5, final = false } = {}) {
  return {
    status,
    gameMode: 'casual',
    statusFeed: final ? FINAL : [],
    cronState: evaluating ? { evaluatingAt: ago(30_000) } : { evaluatingAt: null },
    scoreState: { ...SCORED, currentScore: mine, opponentScore: theirs },
  };
}
const mood = (b, extra = {}) => deriveAgentMood({ battle: b, side: 'player', nowMs: NOW, outcomes, ...extra });
const ahead = { player: 10, opponent: 5 }, behind = { player: 2, opponent: 9 }, level = { player: 4, opponent: 4 };
const waiting = { needsYouCount: 1 };

describe('the player\'s precedence: celebrating > waiting > researching > confident / worried > idle (R8)', () => {
  it('each signal alone gives its own mood', () => {
    expect(mood(battle({ status: 'completed', final: true, mine: 10, theirs: 5 }), { scores: ahead })).toBe('celebrating');
    expect(mood(battle(), { cockpitFeed: waiting, scores: level })).toBe('waiting');
    expect(mood(battle({ evaluating: true }), { scores: level })).toBe('researching');
    expect(mood(battle(), { scores: ahead })).toBe('confident');
    expect(mood(battle(), { scores: behind })).toBe('worried');
    expect(mood(battle(), { scores: level })).toBe('idle');
    expect(mood(battle(), { scores: null })).toBe('idle');
  });

  it('every pair: the higher one wins', () => {
    // celebrating over each lower signal (a completed battle carries none of them live, but the rule must hold anyway)
    const won = battle({ status: 'completed', final: true, mine: 10, theirs: 5, evaluating: true });
    expect(mood(won, { cockpitFeed: waiting, scores: behind })).toBe('celebrating');
    // waiting over researching, and over either standing
    expect(mood(battle({ evaluating: true }), { cockpitFeed: waiting, scores: ahead })).toBe('waiting');
    expect(mood(battle(), { cockpitFeed: waiting, scores: behind })).toBe('waiting');
    // researching over either standing
    expect(mood(battle({ evaluating: true }), { scores: ahead })).toBe('researching');
    expect(mood(battle({ evaluating: true }), { scores: behind })).toBe('researching');
    // a standing over idle (level is idle)
    expect(mood(battle(), { scores: { player: 4.01, opponent: 4 } })).toBe('confident');
  });

  it('a completed battle lost, drawn, or with no result is idle — never the live standing, never celebrating', () => {
    expect(mood(battle({ status: 'completed', final: true, mine: 2, theirs: 9 }), { scores: behind })).toBe('idle');
    expect(mood(battle({ status: 'completed', final: true, mine: 4, theirs: 4 }), { scores: level })).toBe('idle');
    // ended without the final feed entry: the hub's derivation gives "ended", not a win
    expect(mood(battle({ status: 'completed', final: false, mine: 10, theirs: 5 }), { scores: ahead })).toBe('idle');
    // a positive score can lose, a negative one can win: the stored pair decides, as the hub's outcome does
    expect(mood(battle({ status: 'completed', final: true, mine: -1, theirs: -3 }), { scores: { player: -1, opponent: -3 } })).toBe('celebrating');
    // without the derivation handed in, a completed battle cannot claim a win
    expect(mood(battle({ status: 'completed', final: true }), { scores: ahead, outcomes: null })).toBe('idle');
  });

  it('waiting needs an open call that needs the player: a count of zero, a missing feed or a junk count is no call', () => {
    expect(mood(battle(), { cockpitFeed: { needsYouCount: 0 }, scores: level })).toBe('idle');
    expect(mood(battle(), { cockpitFeed: null, scores: level })).toBe('idle');
    expect(mood(battle(), { cockpitFeed: { needsYouCount: '2' }, scores: level })).toBe('idle');
    expect(mood(battle(), { cockpitFeed: { needsYouCount: 3 }, scores: level })).toBe('waiting');
  });
});

describe('researching: an evaluation lock the server would still honour', () => {
  it('set and younger than the lock\'s lifetime is in flight; older is the stale lock a crashed tick leaves', () => {
    const at = (ms) => ({ cronState: { evaluatingAt: ago(ms) } });
    expect(evaluationInFlight(at(0), NOW)).toBe(true);
    expect(evaluationInFlight(at(EVALUATION_LOCK_MS - 1), NOW)).toBe(true);
    expect(evaluationInFlight(at(EVALUATION_LOCK_MS), NOW)).toBe(false);
    expect(evaluationInFlight(at(-30_000), NOW)).toBe(true); // a coarse clock behind the stamp
    expect(evaluationInFlight({ cronState: { evaluatingAt: null } }, NOW)).toBe(false);
    expect(evaluationInFlight({}, NOW)).toBe(false);
    expect(evaluationInFlight({ cronState: { evaluatingAt: 'not a time' } }, NOW)).toBe(false);
    expect(evaluationInFlight({ cronState: { evaluatingAt: { toMillis: () => NOW - 5_000 } } }, NOW)).toBe(true);
    // Build S2 (R21): with no clock there is no age to honour, so a stale stamp never reads as in flight.
    for (const noClock of [undefined, null, NaN, Infinity, 'soon']) {
      expect(evaluationInFlight(at(0), noClock)).toBe(false);
      expect(deriveAgentMood({ battle: { status: 'active', ...at(0) }, side: 'player', nowMs: noClock, outcomes })).toBe('idle');
    }
  });

  it('the lifetime is the server\'s own: a tripwire on agent-evaluate.js EVALUATING_LOCK_TIMEOUT_MS', () => {
    const cron = readFileSync('api/cron/agent-evaluate.js', 'utf8');
    const m = /const EVALUATING_LOCK_TIMEOUT_MS = ([\d_]+);/.exec(cron);
    expect(m, 'the cron no longer declares EVALUATING_LOCK_TIMEOUT_MS as a literal').not.toBeNull();
    expect(Number(m[1].replace(/_/g, ''))).toBe(EVALUATION_LOCK_MS);
  });
});

describe('the CPU opponent (R9): the sign-flipped standing only', () => {
  const cpu = (b, extra = {}) => deriveAgentMood({ battle: b, side: 'opponent', nowMs: NOW, outcomes, ...extra });

  it('flips the player\'s standing: the player ahead is the CPU worried, behind is the CPU confident, level is idle', () => {
    expect(cpu(battle(), { scores: ahead })).toBe('worried');
    expect(cpu(battle(), { scores: behind })).toBe('confident');
    expect(cpu(battle(), { scores: level })).toBe('idle');
    expect(cpu(battle(), { scores: null })).toBe('idle');
  });

  it('is never waiting, researching or celebrating, whatever the battle shows', () => {
    expect(cpu(battle({ evaluating: true }), { cockpitFeed: waiting, scores: level })).toBe('idle');
    expect(cpu(battle({ evaluating: true }), { cockpitFeed: waiting, scores: behind })).toBe('confident');
    expect(cpu(battle({ status: 'completed', final: true, mine: 2, theirs: 9 }), { scores: behind })).toBe('confident');
    expect(cpu(battle({ status: 'completed', final: true, mine: 10, theirs: 5 }), { scores: ahead })).toBe('worried');
  });
});

describe('the outcome projection is the hub\'s own (display agreement, BUILD_RULES §9)', () => {
  it('equals hub/gamesDisplay.js outcomeInputOf on every fixture', () => {
    const fixtures = [
      battle({ status: 'completed', final: true }),
      battle({ status: 'completed', final: false }),
      battle(),
      { status: 'completed', gameMode: 'tournament', completionContext: 'tournament_group_scored', statusFeed: FINAL, scoreState: { ...SCORED, currentScore: 7 } },
      { status: 'completed', completionContext: 'stock_result_unavailable', statusFeed: FINAL, scoreState: SCORED },
      { status: 'completed', statusFeed: [null, { action: 'swap' }, { action: 'battle_complete' }], scoreState: {} },
      { status: 'completed' },
      {},
      null,
    ];
    for (const f of fixtures) expect(outcomeInputOf(f), JSON.stringify(f)).toEqual(hubOutcomeInputOf(f));
  });
});
