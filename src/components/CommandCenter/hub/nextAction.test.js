// src/components/CommandCenter/hub/nextAction.test.js
//
// Command Center hub, slice S4 (rulings R-S4-2, R-S4-3; spec V1.2 §8.2) — the next action's priority rules and Later's
// "the next one within the same rule" semantics, on the pure derivation. The component and the storage are pinned in
// CommandCenterHub.s4.jsdom.test.jsx and useHubLater.jsdom.test.jsx.

import { describe, expect, it } from 'vitest';
import { completedGameRows, liveGameRows } from './gamesDisplay';
import { HUB_COPY as COPY } from './hubCopy';
import { formatHubDay } from './hubDate';
import { FIRST_DEPLOYMENT_KEY, NEXT_ACTION_KINDS, deriveNextAction, firstDeploymentOffer, laterKeyOf } from './nextAction';
import { firstDeploymentCandidate } from './selectors/deployState';
import { COOLDOWN, HOLD, BATTLES, agentReady, attemptFor, base, completedReady } from '../__fixtures__/deployStateFixtures';

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
    // Either arrival order: a comparator is called both ways round, and each branch of it must put the unreadable one last.
    for (const battles of [[odd, fine], [fine, odd]]) expect(pick({ battles, reviews: readyFor(odd, fine) }).id).toBe('done_2');
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

  it('2 · and not even from a display row that says its tape is ready: the game is live, so it is no review candidate whatever the rows hold', () => {
    const battles = [done(1)];
    const base = inputs({ battles, liveDocs: [live('done_1')], reviews: readyFor(...battles) });
    // A row set that (wrongly) still carries the completed row of the live game.
    const withBoth = new Map([...base.rowsById, ...completedGameRows(battles, readyFor(...battles)).map((row) => [row.id, row])]);
    expect(withBoth.get('done_1').review).toBe(true);
    const c = deriveNextAction({ ...base, rowsById: withBoth, dismissed: new Set(['openGame:done_1']) }).candidate;
    expect(c).toBeNull();
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

describe('the live poll must have answered before a later rule is offered (N-2)', () => {
  it('a ready review waits while whether a game is live is unknown — no card that would swap for a live game\'s the moment the poll answers', () => {
    const battles = [done(1)];
    const args = inputs({ battles, reviews: readyFor(...battles), firstDeployment: true });
    expect(deriveNextAction({ ...args, liveResolved: false })).toEqual({ status: 'loading', candidate: null });
    expect(deriveNextAction({ ...args, liveResolved: true }).candidate).toMatchObject({ key: 'review' });
    // Left out, the poll is taken as answered (the frames, which have no poll).
    expect(deriveNextAction(args).candidate).toMatchObject({ key: 'review' });
  });

  it('the first deployment waits too; a live game, which needs no wait, does not', () => {
    expect(deriveNextAction({ ...inputs({ firstDeployment: true }), liveResolved: false }).candidate).toBeNull();
    expect(deriveNextAction({ ...inputs({ liveDocs: [live('bb_live')], firstDeployment: true }), liveResolved: false }).candidate).toMatchObject({ key: 'openGame' });
  });
});

describe('the first-deployment offer holds its card under the owner\'s own hold (N-1: keep panels mounted while charging)', () => {
  const first = (over = {}) => base({ agent: agentReady({ agent: { id: 'agent-a', stats: { gamesPlayed: 0 } } }), completed: completedReady([]), ...over });

  it('the selector alone says no once the hold is claimed — the reason for setting the hold aside', () => {
    expect(firstDeploymentCandidate(first())).toBe(true);
    expect(firstDeploymentCandidate(first({ hold: HOLD }))).toBe(false);
  });

  it.each(['charging', 'locked'])('the offer stands while this owner\'s hold is %s: the card being pressed does not leave', (phase) => {
    expect(firstDeploymentOffer(first())).toBe(true);
    expect(firstDeploymentOffer(first({ hold: { ...HOLD, phase } }))).toBe(true);
  });

  it('every OTHER block still takes it away: an attempt under way, a cooldown, a live game, a read never made or a non-empty one, an agent that has played', () => {
    expect(firstDeploymentOffer(first({ attempt: attemptFor('submitting') }))).toBe(false);
    expect(firstDeploymentOffer(first({ cooldown: COOLDOWN }))).toBe(false);
    expect(firstDeploymentOffer(first({ poll: { ...first().poll, liveBattles: [BATTLES.baggerbomb] } }))).toBe(false);
    // R-S6-1 (Q-S4-13) restated this pin: a failed read with NO window ever held is still no offer — the input's empty rows
    // read the same for it as for a kept empty window, which is why the reader says whether it holds one.
    expect(firstDeploymentOffer(first({ completed: completedReady([], { status: 'error' }) }))).toBe(false);
    expect(firstDeploymentOffer(first({ completed: completedReady([], { status: 'error' }) }), { windowHeld: false })).toBe(false);
    expect(firstDeploymentOffer(first({ completed: completedReady([{ id: 'done_1' }]) }))).toBe(false);
    expect(firstDeploymentOffer(base({ agent: agentReady({ agent: { id: 'agent-a', stats: { gamesPlayed: 3 } } }), completed: completedReady([]) }))).toBe(false);
  });

  it('it does not change what it is given', () => {
    const given = first({ hold: HOLD, modalOpen: true });
    firstDeploymentOffer(given);
    expect(given.hold).toBe(HOLD);
    expect(given.modalOpen).toBe(true);
  });
});

describe('R-S6-1 · Q-S4-12: a hub sheet that opens does not withdraw the first-deployment card', () => {
  const first = (over = {}) => base({ agent: agentReady({ agent: { id: 'agent-a', stats: { gamesPlayed: 0 } } }), completed: completedReady([]), ...over });

  it('the offer stands with a sheet open — the pin that said a modal takes it away is restated', () => {
    expect(firstDeploymentOffer(first())).toBe(true);
    expect(firstDeploymentOffer(first({ modalOpen: true }))).toBe(true);
    // The selector alone still says no: the card's own hold stays disabled through it (the deploy state keeps modalOpen).
    expect(firstDeploymentCandidate(first({ modalOpen: true }))).toBe(false);
  });

  it('every other block still holds under an open sheet: an attempt, a cooldown, a live game', () => {
    expect(firstDeploymentOffer(first({ modalOpen: true, attempt: attemptFor('submitting') }))).toBe(false);
    expect(firstDeploymentOffer(first({ modalOpen: true, cooldown: COOLDOWN }))).toBe(false);
    expect(firstDeploymentOffer(first({ modalOpen: true, poll: { ...first().poll, liveBattles: [BATTLES.baggerbomb] } }))).toBe(false);
  });
});

describe('R-S6-1 · Q-S4-13: a failed refresh that kept an empty window does not withdraw the offer', () => {
  const first = (over = {}) => base({ agent: agentReady({ agent: { id: 'agent-a', stats: { gamesPlayed: 0 } } }), completed: completedReady([]), ...over });
  const held = { windowHeld: true };
  const failed = (over = {}) => first({ completed: completedReady([], { status: 'error', ...over }) });

  it('a kept, still-empty window of the same owner keeps the offer through a failed refresh', () => {
    expect(firstDeploymentOffer(failed(), held)).toBe(true);
    // ...with the owner's hold charging, which is the case the ruling is for.
    expect(firstDeploymentOffer(failed({}), held)).toBe(true);
    expect(firstDeploymentOffer(first({ hold: HOLD, completed: completedReady([], { status: 'error' }) }), held)).toBe(true);
  });

  it('a window never read (no window held) is not an empty one: no offer', () => {
    expect(firstDeploymentOffer(failed(), { windowHeld: false })).toBe(false);
    expect(firstDeploymentOffer(failed())).toBe(false);
  });

  it('a non-empty window withdraws it, failed or not', () => {
    expect(firstDeploymentOffer(first({ completed: completedReady([{ id: 'done_1' }], { status: 'error' }) }), held)).toBe(false);
    expect(firstDeploymentOffer(first({ completed: completedReady([{ id: 'done_1' }]) }), held)).toBe(false);
  });

  it('an owner or epoch change withdraws it: the held window belongs to the former owner', () => {
    expect(firstDeploymentOffer(failed({ ownerUid: 'uid-B' }), held)).toBe(false);
    expect(firstDeploymentOffer(failed({ ownerEpoch: 99 }), held)).toBe(false);
    expect(firstDeploymentOffer(failed({ ownerUid: null, ownerEpoch: null }), held)).toBe(false);
  });

  it('a read still loading, or one that never settled, is not a kept window', () => {
    expect(firstDeploymentOffer(first({ completed: completedReady([], { status: 'loading' }) }), held)).toBe(false);
  });

  it('every other block holds: an attempt, a cooldown, a live game, an agent that has played', () => {
    expect(firstDeploymentOffer(failed({}), held)).toBe(true);
    expect(firstDeploymentOffer({ ...failed(), attempt: attemptFor('submitting') }, held)).toBe(false);
    expect(firstDeploymentOffer({ ...failed(), cooldown: COOLDOWN }, held)).toBe(false);
    expect(firstDeploymentOffer({ ...failed(), poll: { ...first().poll, liveBattles: [BATTLES.baggerbomb] } }, held)).toBe(false);
    expect(firstDeploymentOffer({ ...failed(), agent: agentReady({ agent: { id: 'agent-a', stats: { gamesPlayed: 3 } } }) }, held)).toBe(false);
  });

  it('it does not change what it is given', () => {
    const given = failed();
    firstDeploymentOffer(given, held);
    expect(given.completed.status).toBe('error');
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

// The S8 review's S8-3 (ruling R-S8F-8; spec §3): after a failed poll the live game is the retained list's, so the card
// says when that was true — the Games rows' own words, from the Deploy card's freshness.
describe('the live candidate after a failed poll carries the retained list\'s age (S8-3)', () => {
  const asOf = NOW - 90 * 60000;
  const at = (ms) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(ms));

  it('stale: its detail says "As of {time} ET · couldn\'t refresh" ahead of the row\'s own line', () => {
    const c = deriveNextAction({ ...inputs({ liveDocs: [live('bb_live')] }), liveFreshness: { stale: true, asOf } }).candidate;
    expect(c.key).toBe(NEXT_ACTION_KINDS.OPEN_GAME);
    expect(c.detail).toBe(COPY.games.detail(COPY.games.staleAsOf(COPY.time.et(at(asOf))), inputs({ liveDocs: [live('bb_live')] }).liveRows[0].detail));
    expect(c.detail.startsWith(`As of ${at(asOf)} ET · couldn’t refresh · Score`)).toBe(true);
  });

  it('stale with no time on record: "Couldn\'t refresh", never a made-up time', () => {
    const c = deriveNextAction({ ...inputs({ liveDocs: [live('bb_live')] }), liveFreshness: { stale: true, asOf: null } }).candidate;
    expect(c.detail.startsWith('Couldn’t refresh · Score')).toBe(true);
  });

  it('fresh, refreshing or not handed: the row\'s own line, unchanged', () => {
    const own = inputs({ liveDocs: [live('bb_live')] }).liveRows[0].detail;
    for (const liveFreshness of [{ stale: false, asOf }, { stale: false, asOf, refreshing: true }, null, undefined]) {
      expect(deriveNextAction({ ...inputs({ liveDocs: [live('bb_live')] }), liveFreshness }).candidate.detail).toBe(own);
    }
  });

  it('a review or the first deployment is not a live game: no age on them', () => {
    const battles = [done(1)];
    const c = deriveNextAction({ ...inputs({ battles, reviews: readyFor(...battles) }), liveFreshness: { stale: true, asOf } }).candidate;
    expect(c.key).toBe(NEXT_ACTION_KINDS.REVIEW);
    expect(c.detail).toBeUndefined();
  });
});

// The S8 review's S8-4 and K-9 (ruling R-S8F-9): the review card's day carries its year when it is from another year.
describe("the review title's day (S8-4)", () => {
  it('a game from another year: "Review your Dec 3, 2025 game in the Film Room"; this year\'s, the day alone', () => {
    const old = done(1, { id: 'old', completedAt: '2025-12-03T21:05:00.000Z' });
    const c = deriveNextAction({ ...inputs({ battles: [old], reviews: readyFor(old) }), nowMs: NOW }).candidate;
    expect(c.title).toBe(COPY.nextAction.reviewTitle('Dec 3, 2025'));
    const recent = done(1);
    const d = deriveNextAction({ ...inputs({ battles: [recent], reviews: readyFor(recent) }), nowMs: NOW }).candidate;
    expect(d.title).toBe(COPY.nextAction.reviewTitle(formatHubDay(Date.parse(recent.completedAt))));
    expect(d.title).not.toMatch(/2026/);
  });
});
