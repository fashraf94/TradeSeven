// src/components/CommandCenter/hub/gamesDisplay.test.js
//
// Command Center hub, slice S3 (rulings R-S3-7, R-S3-8) — the Games rows from
// the readers' records: the live rows in the gate's order with the gate's
// labels, pre-open games, the outcome words and colours from one stored pair
// (no apparent draw at a close margin), the shown scores of v2 Ruling 16, and
// each completed row's review line.

import { describe, expect, it } from 'vitest';
import { HUB_COPY as COPY } from './hubCopy';
import {
  completedGameRows, formatScores, hasFinalEvidence, liveGameRows, outcomeDisplay, outcomeInputOf, reviewLineOf,
} from './gamesDisplay';
import { OUTCOME_KINDS as K } from './selectors/gameOutcome';
import { REVIEW_STATES } from './reviewScheduler';
import { STOCK_RESULT_UNAVAILABLE } from '../../../utils/stockThresholdModel';

const NOW = Date.UTC(2026, 9, 22, 15, 0);
const OPEN = { state: 'OPEN', isOpen: true };
const CLOSED = { state: 'CLOSED_AFTERHOURS', isOpen: false };
const MINUS = '−';

describe('formatScores — the shown numbers never contradict the verdict', () => {
  it('one decimal by default, signed, the house minus', () => {
    expect(formatScores(12.5, -3.25)).toEqual(['+12.5', `${MINUS}3.3`]);
    expect(formatScores(0, 0)).toEqual(['0.0', '0.0']);
  });

  it('a close margin gets the decimals it needs: no apparent draw', () => {
    expect(formatScores(10.04, 10.03)).toEqual(['+10.04', '+10.03']);
    expect(formatScores(-0.11, -0.14)).toEqual([`${MINUS}0.11`, `${MINUS}0.14`]);
  });

  it('a non-zero score never shows as zero', () => {
    expect(formatScores(0.04)).toEqual(['+0.04']);
    expect(formatScores(-0.001)).toEqual([`${MINUS}0.001`]);
  });

  it('a score a reader may not show is a dash, never 0', () => {
    expect(formatScores(null, 4)).toEqual([COPY.games.scoreUnavailable, '+4.0']);
    expect(formatScores(undefined)).toEqual(['—']);
  });
});

describe('outcomeDisplay — word, number and colour from one stored pair (BUILD_RULES §9)', () => {
  it.each([
    [{ kind: K.WON, mine: 304, theirs: 120.5 }, 'Won +304.0', 'pos', '+304.0 vs +120.5'],
    [{ kind: K.LOST, mine: 40.1, theirs: 52 }, 'Lost +40.1', 'neg', '+40.1 vs +52.0'],
    [{ kind: K.WON, mine: -3.5, theirs: -12 }, `Won ${MINUS}3.5`, 'pos', `${MINUS}3.5 vs ${MINUS}12.0`],
    [{ kind: K.DRAW, mine: -8, theirs: -8 }, `Draw ${MINUS}8.0`, 'draw', `${MINUS}8.0 vs ${MINUS}8.0`],
    [{ kind: K.WON, mine: 10.04, theirs: 10.03 }, 'Won +10.04', 'pos', '+10.04 vs +10.03'],
    [{ kind: K.BANKED, mine: 7.5, theirs: null }, 'Day banked · no W/L', 'neutral', '+7.5'],
    [{ kind: K.ENDED, mine: 3.1, theirs: -2 }, 'Ended', 'neutral', `no final result recorded · last recorded +3.1 vs ${MINUS}2.0`],
    [{ kind: K.NO_SCORE, mine: null, theirs: null }, 'No result', 'neutral', 'no score was recorded'],
    [{ kind: K.NO_RESULT, mine: null, theirs: null }, 'No result', 'neutral', ''],
  ])('%j → %s', (result, text, tone, detail) => {
    expect(outcomeDisplay(result)).toEqual({ tag: { text, tone }, detail });
  });
});

describe('the record\'s projection', () => {
  it('final evidence is the presence of a battle_complete entry — and nothing else is read from the feed', () => {
    expect(hasFinalEvidence({ statusFeed: [{ action: 'hold' }, { action: 'battle_complete' }] })).toBe(true);
    expect(hasFinalEvidence({ statusFeed: [{ action: 'hold', message: 'battle_complete' }, null] })).toBe(false);
    expect(hasFinalEvidence({ statusFeed: 'battle_complete' })).toBe(false);
    expect(hasFinalEvidence({})).toBe(false);
  });

  it('a measured-model completion whose result is unavailable projects as such, its scores as the reader may show them', () => {
    const input = outcomeInputOf({ status: 'completed', completionContext: STOCK_RESULT_UNAVAILABLE, scoreState: { currentScore: 5, opponentScore: 1 } });
    expect(input.resultUnavailable).toBe(true);
    expect(outcomeInputOf({ status: 'completed', scoreState: { currentScore: 5 } }).scoreState).toEqual({ currentScore: 5 });
  });
});

describe('liveGameRows — the gate\'s own documents, the gate\'s order and labels', () => {
  const ranked = { id: 'rk_1', ownerId: 'u', agentId: 'agent-a', groupId: 'g1', status: 'active', activatedAt: '2026-10-22T13:31:00Z', expiresAt: '2026-10-22T20:00:00Z', scoreState: { currentScore: 4.2, tradeCount: 2, evaluationCount: 9 } };
  const bagger = { id: 'bb_1', ownerId: 'u', agentId: 'casual-agent-u', status: 'active', activatedAt: '2026-10-22T13:30:00Z', expiresAt: '2026-10-22T17:41:00Z', scoreState: { currentScore: -12.4, tradeCount: 1, lastScoredAt: '2026-10-22T14:58:00Z' } };

  it('ranked first, then BaggerBomb (sortLiveBattles), each labelled by classifyBattleType', () => {
    const rows = liveGameRows([bagger, ranked], { nowMs: NOW, marketState: OPEN });
    expect(rows.map((r) => [r.id, r.mode, r.kind, r.opponent])).toEqual([
      ['rk_1', 'Ranked', 'ranked', COPY.games.opponentGroup],
      ['bb_1', 'BaggerBomb', 'baggerbomb', COPY.games.opponentCpu],
    ]);
  });

  it('the clock is the time left; the line its score, trades and end, in ET', () => {
    const [row] = liveGameRows([bagger], { nowMs: NOW, marketState: OPEN });
    expect(row).toMatchObject({ live: true, preOpen: false, clock: '2h 41m left' });
    expect(row.detail).toBe(`Score ${MINUS}12.4 · 1 trade · ends 1:41 PM ET`);
  });

  it('a game that has not opened yet says it is deployed and waiting for the open', () => {
    const fresh = { ...bagger, scoreState: { currentScore: 0, tradeCount: 0, evaluationCount: 0, lastScoredAt: null } };
    const [row] = liveGameRows([fresh], { nowMs: NOW, marketState: CLOSED });
    expect(row).toMatchObject({ preOpen: true, clock: COPY.games.waitingForOpen });
    expect(COPY.strip.deployed(row.clock)).toBe('Deployed · waiting for the open');
    // The market open, or a game already evaluated: not pre-open.
    expect(liveGameRows([fresh], { nowMs: NOW, marketState: OPEN })[0].preOpen).toBe(false);
    expect(liveGameRows([bagger], { nowMs: NOW, marketState: CLOSED })[0].preOpen).toBe(false);
  });

  it('a past end reads ending; no list is no rows', () => {
    expect(liveGameRows([{ ...bagger, expiresAt: '2026-10-22T14:00:00Z' }], { nowMs: NOW, marketState: OPEN })[0].clock).toBe(COPY.games.ending);
    expect(liveGameRows(null, { nowMs: NOW, marketState: OPEN })).toEqual([]);
  });
});

describe('completedGameRows and reviewLineOf', () => {
  const done = (id, over = {}) => ({
    id, ownerId: 'u', agentId: 'casual-agent-u', status: 'completed', completedAt: '2026-10-20T20:05:00.000Z',
    scoreState: { currentScore: 12.5, opponentScore: 3.25, lastScoredAt: '2026-10-20T19:58:00.000Z' },
    statusFeed: [{ action: 'battle_complete' }],
    ...over,
  });

  it('each row: its outcome tag, its day and pair, its review line; ready and openable only for the Film Room target', () => {
    const reviews = {
      a: { state: REVIEW_STATES.READY, result: { ready: true, target: 'filmRoom', availability: 'ready' }, nextAt: null },
      b: { state: REVIEW_STATES.PENDING, result: { ready: false, target: 'filmRoom', availability: 'pending' }, nextAt: null },
    };
    const [a, b] = completedGameRows([done('a'), done('b', { scoreState: { currentScore: 1, opponentScore: 2, evaluationCount: 3 } })], reviews);
    expect(a).toMatchObject({ live: false, mode: 'BaggerBomb', outcome: { text: 'Won +12.5', tone: 'pos' }, detail: 'Oct 20 · +12.5 vs +3.3', review: true });
    expect(a.reviewLine).toEqual({ state: 'ready', text: COPY.games.review.openTape, openable: true });
    expect(b).toMatchObject({ outcome: { text: 'Lost +1.0', tone: 'neg' }, review: false });
    expect(b.reviewLine).toEqual({ state: 'pending', text: COPY.games.review.pending, openable: false });
  });

  it('a ready answer with another target opens nothing', () => {
    expect(reviewLineOf({ state: 'ready', result: { ready: true, target: 'elsewhere', availability: 'ready' } }).openable).toBe(false);
  });

  it('the spec\'s words for queued and timed-out rows, with the next permitted time in ET', () => {
    const at = Date.UTC(2026, 9, 22, 15, 2, 0);
    expect(reviewLineOf({ state: 'queued', result: null, nextAt: at }).text).toBe('Review check queued · next attempt at 11:02 AM ET');
    expect(reviewLineOf({ state: 'timedOut', result: null, nextAt: at }).text).toBe('Review refresh timed out · Retry queued · next attempt at 11:02 AM ET');
    expect(reviewLineOf({ state: 'unavailable', result: null }).text).toBe(COPY.games.review.unavailable);
    expect(reviewLineOf({ state: 'checking', result: null }).text).toBe(COPY.games.review.checking);
    expect(reviewLineOf(undefined)).toEqual({ state: 'checking', text: COPY.games.review.checking, openable: false });
  });

  it('a row with no review state yet is checking — never ready', () => {
    const [row] = completedGameRows([done('c')], {});
    expect(row.review).toBe(false);
    expect(row.reviewLine.state).toBe('checking');
  });
});

describe('formatScores at the top of its six decimals, and beyond them (review T4-4, T4-5)', () => {
  it('four, five and six decimals when that is what separates or shows the numbers', () => {
    expect(formatScores(0.0001)).toEqual(['+0.0001']);
    expect(formatScores(-0.00001)).toEqual([`${MINUS}0.00001`]);
    expect(formatScores(0.000001)).toEqual(['+0.000001']);
    expect(formatScores(1.000049, 1.000044)).toEqual(['+1.00005', '+1.00004']);
    expect(formatScores(1.0000049, 1.0000041)).toEqual(['+1.000005', '+1.000004']);
  });

  it('a margin of float noise: each number by its own digits, signed, to one common length — never equal', () => {
    expect(formatScores(0.1 + 0.2, 0.3)).toEqual(['+0.30000000000000004', '+0.30000000000000000']);
    expect(formatScores(1.00000002, 1.00000001)).toEqual(['+1.00000002', '+1.00000001']);
    expect(formatScores(-1.00000001, -1.00000002)).toEqual([`${MINUS}1.00000001`, `${MINUS}1.00000002`]);
  });

  it('a score a millionth from zero is not zero, keeps the house sign and is written without an exponent', () => {
    expect(formatScores(0.0000005)).toEqual(['+0.0000005']);
    expect(formatScores(-1e-12)).toEqual([`${MINUS}0.000000000001`]);
    expect(formatScores(1e-12, 0)).toEqual(['+0.000000000001', '0.000000000000']);
    expect(formatScores(-1e-12, -0)).toEqual([`${MINUS}0.000000000001`, '0.000000000000']);
    expect(formatScores(1e21)).toEqual(['+1000000000000000000000']);
    expect(formatScores(1e22, 2e22)).toEqual(['+10000000000000000000000', '+20000000000000000000000']);
  });

  it('the verdict row at the float-noise margin: the tag and the pair carry the same digits', () => {
    expect(outcomeDisplay({ kind: K.WON, mine: 0.1 + 0.2, theirs: 0.3 })).toEqual({
      tag: { text: 'Won +0.30000000000000004', tone: 'pos' },
      detail: '+0.30000000000000004 vs +0.30000000000000000',
    });
  });
});

describe('formatScores at the edges of its range (S3 review T5-14)', () => {
  it('a very large score with a fraction in its mantissa is written out in full: 1.5e22 is 15 and twenty-one zeros', () => {
    expect(formatScores(1.5e22, -2.25e22)).toEqual(['+15000000000000000000000', `${MINUS}22500000000000000000000`]);
  });

  it('a pair that still collides at six decimals shows its own digits, not a seventh rounded decimal', () => {
    expect(formatScores(1.00000049, 1.00000041)).toEqual(['+1.00000049', '+1.00000041']);
  });

  it('a score that is not a finite number is a dash — it never reaches the digits of a neighbour', () => {
    expect(formatScores(NaN, 1)).toEqual([COPY.games.scoreUnavailable, '+1.0']);
    expect(formatScores(Infinity)).toEqual([COPY.games.scoreUnavailable]);
    expect(formatScores(-Infinity, 2.5)).toEqual([COPY.games.scoreUnavailable, '+2.5']);
  });
});

describe('a live row\'s clock and trades (S3 review T5-14)', () => {
  const live = (over = {}) => ({ id: 'bb', ownerId: 'u', agentId: 'casual-agent-u', status: 'active', activatedAt: '2026-10-22T13:30:00Z', scoreState: { currentScore: 1, evaluationCount: 2 }, ...over });
  const clockOf = (expiresAt, nowMs = NOW) => liveGameRows([live({ expiresAt })], { nowMs, marketState: OPEN })[0].clock;
  const detailOf = (over) => liveGameRows([live({ expiresAt: NOW + 3600000, ...over })], { nowMs: NOW, marketState: OPEN })[0].detail;

  it('the time left rounds to the nearest minute, a half minute up', () => {
    expect(clockOf(NOW + 25 * 60000 + 29000)).toBe('25m left');
    expect(clockOf(NOW + 25 * 60000 + 30000)).toBe('26m left');
    expect(clockOf(NOW + 25 * 60000 + 31000)).toBe('26m left');
    expect(clockOf(NOW + 31000)).toBe('1m left');
  });

  it('a game that ends within the minute, or has ended, reads ending', () => {
    expect(clockOf(NOW + 29000)).toBe(COPY.games.ending);
    expect(clockOf(NOW)).toBe(COPY.games.ending);
    expect(clockOf(NOW - 1000)).toBe(COPY.games.ending);
  });

  it('hours and minutes are written as such: 1h 5m, 1h 0m, 59m', () => {
    expect(clockOf(NOW + 65 * 60000)).toBe('1h 5m left');
    expect(clockOf(NOW + 60 * 60000)).toBe('1h 0m left');
    expect(clockOf(NOW + 59 * 60000)).toBe('59m left');
  });

  it('no end, or no usable clock, is no clock text', () => {
    expect(clockOf(null)).toBe('');
    expect(clockOf(undefined)).toBe('');
    expect(clockOf(NOW + 60000, NaN)).toBe('');
  });

  it('the trades are the recorded count; else the trades listed; else none', () => {
    expect(detailOf({ scoreState: { currentScore: 1, tradeCount: 3 } })).toContain('· 3 trades ·');
    expect(detailOf({ scoreState: { currentScore: 1, tradeCount: 1 } })).toContain('· 1 trade ·');
    expect(detailOf({ scoreState: { currentScore: 1 }, trades: [{}, {}] })).toContain('· 2 trades ·');
    expect(detailOf({ scoreState: { currentScore: 1 } })).toContain('· 0 trades ·');
  });
});

describe('a completed row\'s labels, and what its review line opens (S3 review T5-14)', () => {
  const completed = (over = {}) => ({
    id: 'c', ownerId: 'u', agentId: 'agent-a', status: 'completed', completedAt: '2026-10-20T20:05:00.000Z',
    scoreState: { currentScore: 1, opponentScore: 2, evaluationCount: 3 }, statusFeed: [{ action: 'battle_complete' }], ...over,
  });
  const FILM_ROOM_ANSWER = { ready: true, target: 'filmRoom', availability: 'ready' };

  it('a ranked day is labelled Ranked, of the ranked kind, against its league group; a BaggerBomb game against a CPU', () => {
    const [ranked, bagger] = completedGameRows([completed({ id: 'r', groupId: 'g1' }), completed({ id: 'b', agentId: 'casual-agent-u' })], {});
    expect(ranked).toMatchObject({ mode: 'Ranked', kind: 'ranked', opponent: COPY.games.opponentGroup });
    expect(bagger).toMatchObject({ mode: 'BaggerBomb', kind: 'baggerbomb', opponent: COPY.games.opponentCpu });
  });

  it('the next attempt is rounded UP to the minute, never earlier than the time it names', () => {
    const at = Date.UTC(2026, 9, 22, 15, 2, 20);
    expect(reviewLineOf({ state: REVIEW_STATES.QUEUED, result: null, nextAt: at }).text).toBe('Review check queued · next attempt at 11:03 AM ET');
    expect(reviewLineOf({ state: REVIEW_STATES.TIMED_OUT, result: null, nextAt: at }).text).toBe('Review refresh timed out · Retry queued · next attempt at 11:03 AM ET');
  });

  it('only a ready review whose answer is ready and names the Film Room opens a tape; every other state is words', () => {
    for (const state of [REVIEW_STATES.PENDING, REVIEW_STATES.UNAVAILABLE, REVIEW_STATES.QUEUED, REVIEW_STATES.TIMED_OUT, REVIEW_STATES.CHECKING, 'not-a-state']) {
      expect(reviewLineOf({ state, result: FILM_ROOM_ANSWER, nextAt: null }).openable, state).toBe(false);
    }
    expect(reviewLineOf({ state: REVIEW_STATES.READY, result: null, nextAt: null }).openable).toBe(false);
    expect(reviewLineOf({ state: REVIEW_STATES.READY, result: { ready: false, target: 'filmRoom', availability: 'pending' }, nextAt: null }).openable).toBe(false);
    expect(reviewLineOf({ state: REVIEW_STATES.READY, result: { ready: true, target: 'elsewhere', availability: 'ready' }, nextAt: null }).openable).toBe(false);
    expect(reviewLineOf({ state: REVIEW_STATES.READY, result: FILM_ROOM_ANSWER, nextAt: null }).openable).toBe(true);
  });

  it('a row carries the review flag only when its tape opens: a ready state whose answer names another route has none', () => {
    const reviews = {
      a: { state: REVIEW_STATES.READY, result: { ready: true, target: 'elsewhere', availability: 'ready' }, nextAt: null },
      b: { state: REVIEW_STATES.READY, result: FILM_ROOM_ANSWER, nextAt: null },
    };
    const [a, b] = completedGameRows([completed({ id: 'a' }), completed({ id: 'b' })], reviews);
    expect(a.review).toBe(false);
    expect(b.review).toBe(true);
  });
});
