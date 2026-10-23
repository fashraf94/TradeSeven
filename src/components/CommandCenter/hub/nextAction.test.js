// src/components/CommandCenter/hub/nextAction.test.js
//
// Command Center hub, slice S4 (rulings R-S4-2, R-S4-3; spec V1.2 §8.2) — the next action's priority rules and Later's
// "the next one within the same rule" semantics, on the pure derivation. The component and the storage are pinned in
// CommandCenterHub.s4.jsdom.test.jsx and useHubLater.jsdom.test.jsx.

import { describe, expect, it } from 'vitest';
import { completedGameRows, liveGameRows } from './gamesDisplay';
import { HUB_COPY as COPY } from './hubCopy';
import { formatHubDay } from './hubDate';
import { FIRST_DEPLOYMENT_KEY, NEXT_ACTION_KINDS, deriveNextAction, laterKeyOf } from './nextAction';

const UID = 'uid-A';
const NOW = Date.UTC(2026, 9, 23, 15, 0);
const iso = (ms) => new Date(ms).toISOString();
const READY = Object.freeze({ ready: true, target: 'filmRoom', availability: 'ready' });
const PENDING = Object.freeze({ ready: false, target: 'filmRoom', availability: 'pending' });

const done = (n, over = {}) => ({
  id: `done_${n}`, ownerId: UID, agentId: `casual-agent-${UID}`, status: 'completed',
  completedAt: iso(Date.UTC(2026, 9, 22 - n, 20, 0)),
  scoreState: { currentScore: 10 + n, opponentScore: 5, lastScoredAt: iso(Date.UTC(2026, 9, 22 - n, 19, 58)) },
  statusFeed: [{ action: 'battle_complete' }],
  ...over,
});
const live = (id, over = {}) => ({
  id, ownerId: UID, agentId: `casual-agent-${UID}`, status: 'active', activatedAt: iso(NOW - 2 * 3600 * 1000),
  expiresAt: iso(NOW + 3 * 3600 * 1000), scoreState: { currentScore: 1, tradeCount: 0, evaluationCount: 1 }, ...over,
});

/** The inputs a hub holds for these records: Games' own rows, with each completed game's review as given. */
function inputs({ battles = [], liveDocs = [], reviews = {}, marketState = { state: 'OPEN', isOpen: true }, firstDeployment = false, dismissed = new Set() } = {}) {
  const liveRows = liveGameRows(liveDocs, { nowMs: NOW, marketState });
  const liveIds = new Set(liveRows.map((r) => r.id));
  const completed = completedGameRows(battles.filter((b) => !liveIds.has(b.id)), reviews);
  return { liveRows, battles, rowsById: new Map([...liveRows, ...completed].map((r) => [r.id, r])), firstDeployment, dismissed };
}
const readyFor = (...docs) => Object.fromEntries(docs.map((d) => [d.id, { state: 'ready', result: READY, nextAt: null }]));
const pick = (over) => deriveNextAction(inputs(over)).candidate;

describe('the priority (spec §8.2)', () => {
  it('1 · an owned live game beats a ready review and the first deployment', () => {
    const battles = [done(1)];
    const c = pick({ battles, liveDocs: [live('bb_live')], reviews: readyFor(...battles), firstDeployment: true });
    expect(c).toMatchObject({ key: NEXT_ACTION_KINDS.OPEN_GAME, id: 'bb_live', laterKey: 'openGame:bb_live', cta: COPY.nextAction.openGame, title: COPY.nextAction.liveTitle });
  });

  it('1 · live games are offered in sortLiveBattles order: ranked first, then the most recently activated', () => {
    const ranked = live('rk_live', { groupId: 'g1', agentId: 'agent-a', activatedAt: iso(NOW - 3600 * 1000) });
    const newer = live('bb_new', { activatedAt: iso(NOW - 600 * 1000) });
    const older = live('bb_old', { activatedAt: iso(NOW - 3 * 3600 * 1000) });
    expect(pick({ liveDocs: [older, newer, ranked] }).id).toBe('rk_live');
    expect(pick({ liveDocs: [older, newer] }).id).toBe('bb_new');
  });

  it('1 · a game that has not opened yet says it is deployed and waiting for the open (spec §8.2)', () => {
    const fresh = live('bb_live', { scoreState: { currentScore: 0, tradeCount: 0, evaluationCount: 0, lastScoredAt: null } });
    const c = pick({ liveDocs: [fresh], marketState: { state: 'CLOSED_AFTERHOURS', isOpen: false } });
    expect(c.title).toBe(COPY.nextAction.preOpenTitle);
    expect(c.why).toContain(COPY.games.waitingForOpen);
    expect(c.why).not.toMatch(/left/);
    // ...and an open game does not.
    const open = pick({ liveDocs: [fresh] , marketState: { state: 'OPEN', isOpen: true } });
    expect(open.title).toBe(COPY.nextAction.liveTitle);
  });

  it('2 · the newest game with a ready review, by completedAt then id', () => {
    const battles = [done(3), done(1), done(2)];
    const c = pick({ battles, reviews: readyFor(...battles) });
    expect(c).toMatchObject({ key: NEXT_ACTION_KINDS.REVIEW, id: 'done_1', laterKey: 'review:done_1', cta: COPY.nextAction.openReview });
    expect(c.title).toBe(COPY.nextAction.reviewTitle(formatHubDay(Date.parse(battles[1].completedAt))));
    expect(c.why).toMatch(/^vs CPU · Won \+11\.0 · review available$/);
  });

  it('2 · the same completion time: the id decides, the same way every time', () => {
    const at = iso(Date.UTC(2026, 9, 21, 20, 0));
    const a = done(7, { id: 'g_a', completedAt: at });
    const b = done(8, { id: 'g_b', completedAt: at });
    for (const battles of [[a, b], [b, a]]) expect(pick({ battles, reviews: readyFor(a, b) }).id).toBe('g_a');
  });

  it('2 · a game whose time cannot be read sorts after those whose time can', () => {
    const odd = done(1, { id: 'g_odd', completedAt: 'whenever' });
    const fine = done(2);
    expect(pick({ battles: [odd, fine], reviews: readyFor(odd, fine) }).id).toBe('done_2');
  });

  it('2 · a pending, unavailable, checking, queued or timed-out review is never a candidate', () => {
    const battles = [done(1), done(2), done(3), done(4), done(5)];
    const reviews = {
      done_1: { state: 'pending', result: PENDING, nextAt: null },
      done_2: { state: 'unavailable', result: { ready: false, target: 'filmRoom', availability: 'unavailable' }, nextAt: null },
      done_3: { state: 'checking', result: null, nextAt: null },
      done_4: { state: 'queued', result: null, nextAt: NOW + 60000 },
      done_5: { state: 'timedOut', result: null, nextAt: NOW + 60000 },
    };
    expect(pick({ battles, reviews })).toBeNull();
    // ...and the one ready review among them is the candidate.
    expect(pick({ battles, reviews: { ...reviews, done_4: { state: 'ready', result: READY, nextAt: null } } }).id).toBe('done_4');
  });

  it('2 · only the tape link\'s own test counts: a ready answer whose target is not the Film Room opens nothing and is no candidate', () => {
    const battles = [done(1)];
    const elsewhere = { state: 'ready', result: { ready: true, target: 'somewhereElse', availability: 'ready' }, nextAt: null };
    expect(pick({ battles, reviews: { done_1: elsewhere } })).toBeNull();
  });

  it('2 · a game the poll still holds live is the live candidate, never also a review', () => {
    const battles = [done(1)];
    const c = pick({ battles, liveDocs: [live('done_1')], reviews: readyFor(...battles) });
    expect(c.key).toBe(NEXT_ACTION_KINDS.OPEN_GAME);
    const afterLater = pick({ battles, liveDocs: [live('done_1')], reviews: readyFor(...battles), dismissed: new Set(['openGame:done_1']) });
    expect(afterLater).toBeNull();
  });

  it('3 · the first deployment, only when the selector says so', () => {
    expect(pick({ firstDeployment: true })).toMatchObject({ key: NEXT_ACTION_KINDS.DEPLOY, id: null, laterKey: FIRST_DEPLOYMENT_KEY, title: COPY.nextAction.firstTitle, why: COPY.nextAction.firstWhy });
    expect(pick({ firstDeployment: false })).toBeNull();
    expect(pick({ firstDeployment: undefined })).toBeNull();
    expect(pick({ firstDeployment: 'yes' })).toBeNull();
  });

  it('3 · a live game or a ready review comes first, even for a player with nothing played', () => {
    expect(pick({ liveDocs: [live('bb_live')], firstDeployment: true }).key).toBe('openGame');
    const battles = [done(1)];
    expect(pick({ battles, reviews: readyFor(...battles), firstDeployment: true }).key).toBe('review');
  });

  it('4 · otherwise none: a card that is ready with no candidate', () => {
    expect(deriveNextAction(inputs())).toEqual({ status: 'ready', candidate: null });
  });
});

describe('Later: the next candidate within the same rule, then the next rule (IR-12)', () => {
  const ranked = live('rk_live', { groupId: 'g1', agentId: 'agent-a' });
  const casual = live('bb_live', { activatedAt: iso(NOW - 600 * 1000) });

  it('with two live games, setting the first aside offers the second', () => {
    const first = pick({ liveDocs: [ranked, casual] });
    expect(first.id).toBe('rk_live');
    const second = pick({ liveDocs: [ranked, casual], dismissed: new Set([first.laterKey]) });
    expect(second).toMatchObject({ key: 'openGame', id: 'bb_live' });
  });

  it('...and only then, when both are set aside, the next rule: a ready review, then the first deployment', () => {
    const battles = [done(1)];
    const both = new Set(['openGame:rk_live', 'openGame:bb_live']);
    expect(pick({ battles, liveDocs: [ranked, casual], reviews: readyFor(...battles), dismissed: both })).toMatchObject({ key: 'review', id: 'done_1' });
    const all = new Set([...both, 'review:done_1']);
    expect(pick({ battles, liveDocs: [ranked, casual], reviews: readyFor(...battles), dismissed: all, firstDeployment: true }).key).toBe('deploy');
    expect(pick({ battles, liveDocs: [ranked, casual], reviews: readyFor(...battles), dismissed: new Set([...all, FIRST_DEPLOYMENT_KEY]), firstDeployment: true })).toBeNull();
  });

  it('with several ready reviews, setting the newest aside offers the next newest', () => {
    const battles = [done(1), done(2), done(3)];
    const reviews = readyFor(...battles);
    expect(pick({ battles, reviews, dismissed: new Set(['review:done_1']) }).id).toBe('done_2');
    expect(pick({ battles, reviews, dismissed: new Set(['review:done_1', 'review:done_2']) }).id).toBe('done_3');
  });

  it('the key is the action and the record: setting aside a game does not set aside its review, nor another game', () => {
    const battles = [done(1)];
    expect(laterKeyOf('openGame', 'x')).toBe('openGame:x');
    expect(laterKeyOf('review', 'x')).toBe('review:x');
    expect(laterKeyOf('deploy', 'x')).toBe('deploy:first');
    expect(laterKeyOf('deploy', null)).toBe(FIRST_DEPLOYMENT_KEY);
    // A review key for the id of a live game does not hide the game.
    expect(pick({ battles, liveDocs: [live('done_1')], dismissed: new Set(['review:done_1']) }).key).toBe('openGame');
    // A game key does not hide a different game's review.
    expect(pick({ battles, reviews: readyFor(...battles), dismissed: new Set(['openGame:done_1']) }).key).toBe('review');
  });

  it('a new game is a new key: setting one aside does not hide the next one deployed', () => {
    const dismissed = new Set(['openGame:bb_live']);
    expect(pick({ liveDocs: [live('bb_next')], dismissed }).id).toBe('bb_next');
  });

  it('a dismissed set that is not a Set (a malformed hand-in) sets nothing aside', () => {
    expect(deriveNextAction({ ...inputs({ liveDocs: [casual] }), dismissed: ['openGame:bb_live'] }).candidate.id).toBe('bb_live');
    expect(deriveNextAction({ ...inputs({ liveDocs: [casual] }), dismissed: undefined }).candidate.id).toBe('bb_live');
  });
});

describe('shape', () => {
  it('a candidate carries what the card draws and nothing it must not: title, why, cta, the Later key; the live game\'s detail line', () => {
    const c = pick({ liveDocs: [live('bb_live')] });
    expect(Object.keys(c).sort()).toEqual(['cta', 'detail', 'id', 'key', 'laterKey', 'title', 'why']);
    expect(c.why).toMatch(/^BaggerBomb vs CPU · /);
    expect(c.detail).toMatch(/^Score /);
    expect(Object.isFrozen(c)).toBe(true);
  });

  it('records without an id, or not objects, are ignored', () => {
    const odd = inputs({ battles: [done(1)], reviews: readyFor(done(1)) });
    expect(deriveNextAction({ ...odd, battles: [null, { completedAt: 'x' }, 'y', ...odd.battles] }).candidate.id).toBe('done_1');
  });
});
