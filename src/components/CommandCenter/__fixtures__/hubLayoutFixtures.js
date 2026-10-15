// src/components/CommandCenter/__fixtures__/hubLayoutFixtures.js
//
// Command Center hub, slice S1 — LAYOUT FIXTURES (founder ruling R-S1-4). The
// design's seven scenarios (ff-fixtures.jsx ffScenario: returning, long,
// first, active, review, blocked, checking) rewritten as the hub's own
// section props (hub/hubModel.js), so the four compositions can be checked
// with real row counts — plus spec §10's named critical case the design does
// not carry, rankedLive (a live game with deploy still ready).
//
// ILLUSTRATIVE DATA. On the build branch only tests import this module; the
// hub never does, and no URL, storage or environment switch reaches it. (The
// never-merge smoke branch may wire it to `?hubFixtures=<scenario>` for the
// preview, the Cockpit Build 2a precedent.)
//
// Translated, not copied, where the spec replaced the prototype's content:
//   - no Partnership preferences or preference events (deferred, spec §8.3);
//     activity rows use §8.2's kinds — completed, deployed, loadout, idea;
//   - Research stays loading in every scenario (its §8.1 content is S6's);
//   - outcomes use §7's words (Won / Lost / Draw / No result), each number
//     beside its word, from one stored pair;
//   - the brief carries its own date caption and no sources count (§8.3);
//   - the next action is §8.2's order (live game → ready review → first
//     deployment), with no preference candidate.

const LOADOUT = Object.freeze({
  status: 'ready',
  archetype: { name: 'Speculator', approach: 'Concentrates in the names with the largest expected swings, sizes up when a move confirms, and wears the risk that comes with it.' },
  watchlist: { name: 'High-Beta Ten', symbols: ['SLB', 'TSLA', 'NVDA', 'AVGO', 'MSFT', 'CRM', 'CF', 'HOOD', 'PLTR', 'NOW'] },
});

const loadout = (summary) => ({ ...LOADOUT, summary });

const GAMES = Object.freeze({
  active: { id: 'game_1007', mode: 'BaggerBomb', opponent: 'CPU — Capital Preserver', live: true, clock: '2h 41m left', detail: 'Score −12.4 · 3 trades · session ends 4:00 PM ET' },
  ranked: { id: 'game_r1007', mode: 'Ranked', opponent: 'Player — Northwind', live: true, clock: '1h 05m left', detail: 'Score +4.2 · 2 trades · session ends 4:00 PM ET' },
  g1003: { id: 'game_1003', mode: 'BaggerBomb', opponent: 'CPU — Contrarian', live: false, detail: 'Oct 3', outcome: { text: 'Lost −101', tone: 'neg' }, review: true },
  g0930: { id: 'game_0930', mode: 'BaggerBomb', opponent: 'CPU — Diversifier', live: false, detail: 'Sep 30 · no score was recorded', outcome: { text: 'No result', tone: 'neutral' }, review: true },
  g0926: { id: 'game_0926', mode: 'BaggerBomb', opponent: 'CPU — Trend Follower', live: false, detail: 'Sep 26', outcome: { text: 'Draw −8', tone: 'neutral' } },
  g0919: { id: 'game_0919', mode: 'BaggerBomb', opponent: 'CPU — Fundamental Investor', live: false, detail: 'Sep 19', outcome: { text: 'Won +304', tone: 'pos' } },
});

const DONE = [GAMES.g1003, GAMES.g0930, GAMES.g0926];

const BRIEF = Object.freeze({
  status: 'ready',
  caption: 'Brief for Tue Oct 7 · Generated 5:30 AM ET',
  body: 'Heavy macro week, front-loaded into Thursday and Friday. Friday’s September jobs print is the Fed-sensitive number before the October meeting; Thursday’s ISM Services and claims set the tone into it. Volatility is compressed into back-to-back catalysts.',
});

const ACTIVITY = [
  { id: 'completed:game_1003', kind: 'completed', at: 'Oct 3, 4:00 PM', text: 'Game completed', sub: 'vs CPU — Contrarian · Lost −101' },
  { id: 'idea.state:hb10:v2:ready', kind: 'idea', at: 'Oct 2, 9:40 PM', text: 'Idea status recorded', sub: 'High-Beta Ten · ready' },
  { id: 'completed:game_0930', kind: 'completed', at: 'Sep 30, 4:00 PM', text: 'Game completed', sub: 'vs CPU — Diversifier · No result' },
  { id: 'loadout:watchlist:hb10', kind: 'loadout', at: 'Sep 29, 8:05 PM', text: 'Watchlist equipped · since Sep 29', sub: 'High-Beta Ten' },
  { id: 'completed:game_0926', kind: 'completed', at: 'Sep 26, 4:00 PM', text: 'Game completed', sub: 'vs CPU — Trend Follower · Draw −8' },
  { id: 'idea.created:hb10:v1', kind: 'idea', at: 'Sep 25, 9:12 PM', text: 'Idea saved', sub: 'High-Beta Ten · version 1' },
];

// The long scenario's ten rows, newest first (spec §8.2: descending time, then kind order).
const LONG_ACTIVITY = [
  ...ACTIVITY.slice(0, 5),
  { id: 'deployed:game_0926', kind: 'deployed', at: 'Sep 26, 9:05 AM', text: 'Deployed', sub: 'BaggerBomb vs CPU — Trend Follower' },
  ACTIVITY[5],
  { id: 'completed:game_0919', kind: 'completed', at: 'Sep 19, 4:00 PM', text: 'Game completed', sub: 'vs CPU — Fundamental Investor · Won +304' },
  { id: 'deployed:game_0919', kind: 'deployed', at: 'Sep 19, 9:12 AM', text: 'Deployed', sub: 'BaggerBomb vs CPU — Fundamental Investor' },
  { id: 'loadout:adjustment:sp01', kind: 'loadout', at: 'Sep 18, 7:30 PM', text: 'Adjustment equipped · since Sep 18', sub: 'Speculator · SP-01' },
];

const CAREER = Object.freeze({ status: 'ready', record: '12W–8L' });

const games = (rows) => ({ status: 'ready', rows });
const activity = (rows) => ({ status: 'ready', rows });
const none = { status: 'ready', candidate: null };

const reviewCandidate = {
  status: 'ready',
  candidate: { key: 'review', title: 'Review your Oct 3 game in the Film Room', why: 'vs CPU — Contrarian · Lost −101 · review available.', cta: 'Open Film Room' },
};
const liveCandidate = {
  status: 'ready',
  candidate: { key: 'openGame', title: 'Open your live game', why: 'BaggerBomb vs CPU — Capital Preserver · 2h 41m left in today’s session.', detail: 'Score −12.4 · 3 trades · session ends 4:00 PM ET', cta: 'Open game' },
};
const rankedCandidate = {
  status: 'ready',
  candidate: { key: 'openGame', title: 'Open your live game', why: 'Ranked vs Player — Northwind · 1h 05m left in today’s session.', detail: 'Score +4.2 · 2 trades · session ends 4:00 PM ET', cta: 'Open game' },
};
const firstCandidate = {
  status: 'ready',
  candidate: { key: 'deploy', title: 'Play your first BaggerBomb game against a CPU', why: 'Shadow deploys with the Speculator loadout.', cta: 'Deploy' },
};

const scenario = (label, notes, sections) => Object.freeze({ label, notes, sections: Object.freeze({ research: { status: 'loading' }, ...sections }) });

export const HUB_LAYOUT_FIXTURES = Object.freeze({
  returning: scenario('Returning', 'Three completed games, a review ready, deploy ready.', {
    nextAction: reviewCandidate,
    games: games(DONE),
    deploy: { displayState: 'ready', canStart: true },
    loadout: loadout('Speculator · ready to deploy'),
    activity: activity(ACTIVITY),
    brief: BRIEF,
    career: CAREER,
  }),
  long: scenario('Long content', 'The maximum rows: four completed games, ten activity rows, a review ready.', {
    nextAction: reviewCandidate,
    games: games([...DONE, GAMES.g0919]),
    deploy: { displayState: 'ready', canStart: true },
    loadout: loadout('Speculator · ready to deploy'),
    activity: activity(LONG_ACTIVITY),
    brief: BRIEF,
    career: CAREER,
  }),
  first: scenario('First visit', 'No games yet; the first-deployment next action carries the hold.', {
    nextAction: firstCandidate,
    games: games([]),
    deploy: { displayState: 'ready', canStart: true },
    loadout: loadout('Speculator · ready to deploy'),
    activity: activity([]),
    brief: BRIEF,
    career: { status: 'ready', record: '0W–0L' },
  }),
  rankedLive: scenario('Ranked game live', 'The spec §10 critical case: a ranked game is live and deploy stays ready, so the strip offers Open game and the hold together.', {
    nextAction: rankedCandidate,
    games: games([GAMES.ranked, ...DONE]),
    deploy: { displayState: 'ready', canStart: true },
    loadout: loadout('Speculator · ready to deploy'),
    activity: activity(ACTIVITY),
    brief: BRIEF,
    career: CAREER,
  }),
  active: scenario('Active game', 'A live game blocks deploy; the strip offers Open game.', {
    nextAction: liveCandidate,
    games: games([GAMES.active, ...DONE]),
    deploy: { displayState: 'blocked', canStart: false, reason: 'capacity 1 of 1 in use' },
    loadout: loadout('Speculator · locked in game'),
    activity: activity(ACTIVITY),
    brief: BRIEF,
    career: CAREER,
  }),
  review: scenario('Review ready', 'Completed games with reviews ready; deploy ready.', {
    nextAction: reviewCandidate,
    games: games(DONE),
    deploy: { displayState: 'ready', canStart: true },
    loadout: loadout('Speculator · ready to deploy'),
    activity: activity(ACTIVITY),
    brief: BRIEF,
    career: CAREER,
  }),
  blocked: scenario('Deploy unavailable', 'Deploy blocked for the session; no review ready.', {
    nextAction: none,
    games: games([GAMES.g0926, GAMES.g0919]),
    deploy: { displayState: 'blocked', canStart: false, reason: 'session not eligible' },
    loadout: loadout('Speculator · ready to deploy'),
    activity: activity(ACTIVITY.filter((e) => e.kind !== 'completed')),
    brief: BRIEF,
    career: CAREER,
  }),
  checking: scenario('Checking eligibility', 'Games resolved; eligibility still checking.', {
    nextAction: reviewCandidate,
    games: games(DONE),
    deploy: { displayState: 'checking', canStart: false },
    loadout: loadout('Speculator · ready to deploy'),
    activity: activity(ACTIVITY),
    brief: BRIEF,
    career: CAREER,
  }),
});

/** The fixture names, in the design's order. */
export const HUB_LAYOUT_FIXTURE_NAMES = Object.freeze(Object.keys(HUB_LAYOUT_FIXTURES));

/** The four test shells (the design's FF_SHELLS) with the site App would pick at that window width. */
export const HUB_TEST_SHELLS = Object.freeze({
  'Phone S': Object.freeze({ width: 360, height: 640, site: 'mobile' }),
  Phone: Object.freeze({ width: 390, height: 844, site: 'mobile' }),
  Tablet: Object.freeze({ width: 834, height: 1000, site: 'desktop' }),
  Desktop: Object.freeze({ width: 1280, height: 820, site: 'desktop' }),
});

/** App's sidebar widths on the desktop site (App.jsx sidebarOffsetStyle). */
export const SIDEBAR = Object.freeze({ collapsed: 64, expanded: 220 });
