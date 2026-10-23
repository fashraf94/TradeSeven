// src/components/CommandCenter/hub/activityRows.test.js
//
// Command Center hub, slice S4 (ruling R-S4-1; spec V1.2 §8.2, §11.3 "Activity/Later") — Recent activity as a bounded
// projection of records: its kinds and ids, its ordering, its cutoff at the oldest completed record, the optimistic entry kept
// out until the server document replaces it, and loadout rows that exist only where an equip time is recorded.
//
// The rows are built from the same records the Games rows are (hub/gamesDisplay.js), so a verdict is said once.

import { describe, expect, it } from 'vitest';
import { getCanonicalTextVersion } from '../../../data/archetypeAdjustments';
import { ACTIVITY_KINDS, activitySectionOf, deriveActivity } from './activityRows';
import { completedGameRows, liveGameRows } from './gamesDisplay';
import { HUB_COPY as COPY } from './hubCopy';
import { formatHubDay, formatHubDayTime } from './hubDate';

const UID = 'uid-A';
const NOW = Date.UTC(2026, 9, 23, 15, 0);
const MARKET = { state: 'OPEN', isOpen: true };
const at = (ms) => COPY.time.et(formatHubDayTime(ms));
const iso = (ms) => new Date(ms).toISOString();

const T = {
  d1Done: Date.UTC(2026, 9, 22, 20, 0),
  d2Done: Date.UTC(2026, 9, 21, 20, 0),
  d3Done: Date.UTC(2026, 9, 20, 20, 0),
};
const done = (n, over = {}) => {
  const completed = [T.d1Done, T.d2Done, T.d3Done][n - 1];
  return {
    id: `done_${n}`, ownerId: UID, agentId: `casual-agent-${UID}`, status: 'completed',
    activatedAt: iso(completed - 6 * 3600 * 1000),
    completedAt: iso(completed),
    scoreState: { currentScore: 10 + n, opponentScore: 5, lastScoredAt: iso(completed - 120000) },
    statusFeed: [{ action: 'battle_complete' }],
    ...over,
  };
};
const liveDoc = (id, over = {}) => ({
  id, ownerId: UID, agentId: `casual-agent-${UID}`, status: 'active', activatedAt: iso(NOW - 2 * 3600 * 1000), createdAt: iso(NOW - 2 * 3600 * 1000),
  expiresAt: iso(NOW + 3 * 3600 * 1000), scoreState: { currentScore: 1, tradeCount: 0, evaluationCount: 1 }, ...over,
});

const rowsFor = (battles, live = []) => new Map(
  [...liveGameRows(live, { nowMs: NOW, marketState: MARKET }), ...completedGameRows(battles)].map((row) => [row.id, row]),
);
const run = (over = {}) => {
  const battles = over.battles ?? [done(1), done(2), done(3)];
  const live = over.live ?? [];
  return deriveActivity({ battles, live, rowsById: rowsFor(battles, live), agent: null, ...over });
};
const ids = (activity) => activity.rows.map((row) => row.id);

const VERSION = getCanonicalTextVersion('degen', 'SP-01');
const agentOf = (over = {}) => ({
  id: 'agent-a', archetype: 'degen', equippedWatchlistId: 'wl_hb', equippedWatchlistName: 'High-Beta Ten', equippedAt: iso(Date.UTC(2026, 9, 21, 22, 5)),
  standingLeans: [], ...over,
});

describe('the kinds, their ids and their words (R-S4-1)', () => {
  it('a completed game: completed:{id} at completedAt, "Game completed", the opponent and the §7 outcome words Games uses', () => {
    const activity = run({ battles: [done(1)] });
    const row = activity.rows.find((r) => r.id === 'completed:done_1');
    expect(row).toMatchObject({ kind: ACTIVITY_KINDS.COMPLETED, text: COPY.activity.completed, at: at(T.d1Done), ms: T.d1Done, battleId: 'done_1' });
    const games = rowsFor([done(1)]).get('done_1');
    expect(row.sub).toBe(COPY.activity.completedSub(games.opponent, games.outcome.text));
    expect(row.sub).toMatch(/^vs CPU · Won \+11\.0$/);
  });

  // The oldest completed record is the cutoff (spec §8.2), so a game's own deploy row shows only when an OLDER game completed before it: done_3 is that game here.
  it('a deployed game: deployed:{id} at the server activatedAt', () => {
    const activity = run({ battles: [done(1), done(3)] });
    const row = activity.rows.find((r) => r.id === 'deployed:done_1');
    expect(row).toMatchObject({ kind: ACTIVITY_KINDS.DEPLOYED, text: COPY.activity.deployed, battleId: 'done_1', ms: T.d1Done - 6 * 3600 * 1000 });
    expect(row.sub).toBe(COPY.activity.deployedSub('BaggerBomb', 'CPU'));
  });

  it('a deployed game with no activatedAt falls back to createdAt, and one with neither has no row', () => {
    const noActivation = { ...done(1), activatedAt: undefined, createdAt: iso(T.d1Done - 7 * 3600 * 1000) };
    expect(run({ battles: [noActivation, done(3)] }).rows.find((r) => r.id === 'deployed:done_1').ms).toBe(T.d1Done - 7 * 3600 * 1000);
    const neither = { ...done(1), activatedAt: undefined, createdAt: undefined };
    expect(ids(run({ battles: [neither, done(3)] }))).not.toContain('deployed:done_1');
    expect(ids(run({ battles: [neither, done(3)] }))).toContain('completed:done_1');
  });

  it('an unreadable activatedAt falls through to createdAt, never to a made-up time', () => {
    const odd = { ...done(1), activatedAt: 'not a time', createdAt: iso(T.d1Done - 7 * 3600 * 1000) };
    expect(run({ battles: [odd, done(3)] }).rows.find((r) => r.id === 'deployed:done_1').ms).toBe(T.d1Done - 7 * 3600 * 1000);
  });

  it('a live game: a deployed row only (it has not completed), with the poll\'s own document', () => {
    const live = liveDoc('bb_live');
    const activity = run({ live: [live] });
    expect(ids(activity)).toContain('deployed:bb_live');
    expect(ids(activity)).not.toContain('completed:bb_live');
  });

  it('every id is kind-specific and appears once', () => {
    const activity = run({ agent: agentOf() });
    expect(new Set(ids(activity)).size).toBe(activity.rows.length);
    expect(ids(activity).every((id) => /^(completed|deployed|loadout):/.test(id))).toBe(true);
  });

  it('a record handed in twice is one row of each kind (spec §8.2: dedupe by the kind-specific id)', () => {
    const activity = run({ battles: [done(1), done(1), done(3)], agent: agentOf() });
    expect(ids(activity).filter((id) => id === 'completed:done_1')).toHaveLength(1);
    expect(ids(activity).filter((id) => id === 'deployed:done_1')).toHaveLength(1);
    expect(new Set(ids(activity)).size).toBe(ids(activity).length);
  });

  it('a time that cannot be read yields no row: a completed record with no completedAt is not listed', () => {
    const broken = { ...done(2), completedAt: 'soon', activatedAt: undefined };
    const activity = run({ battles: [done(1), broken] });
    expect(ids(activity)).not.toContain('completed:done_2');
  });

  it('a Firestore Timestamp, an ISO time, a Date and a number all read through the one normalizer', () => {
    const stamp = { seconds: Math.floor(T.d1Done / 1000), nanoseconds: 0 };
    const forms = [stamp, iso(T.d1Done), new Date(T.d1Done), T.d1Done];
    for (const completedAt of forms) {
      const row = run({ battles: [done(1, { completedAt })] }).rows.find((r) => r.id === 'completed:done_1');
      expect(row?.ms, JSON.stringify(completedAt)).toBe(T.d1Done);
    }
  });

  it('the idea kind is not built: no idea row until the idea reader exists (S6)', () => {
    expect(run({ agent: agentOf() }).rows.some((row) => row.kind === ACTIVITY_KINDS.IDEA)).toBe(false);
  });
});

describe('the order (spec §8.2)', () => {
  it('newest first', () => {
    const activity = run({ battles: [done(3), done(1), done(2)] });
    const ms = activity.rows.map((row) => row.ms);
    expect(ms).toEqual([...ms].sort((a, b) => b - a));
  });

  it('equal times: the kind order completed, deployed, loadout; then id', () => {
    const t = Date.UTC(2026, 9, 22, 20, 0);
    const a = done(1, { id: 'g_a', completedAt: iso(t), activatedAt: iso(t) });
    const b = done(2, { id: 'g_b', completedAt: iso(t), activatedAt: iso(t) });
    const agent = agentOf({ equippedAt: iso(t) });
    // The oldest completed record is at t, so nothing before t is cut and the ties are the whole list.
    expect(ids(run({ battles: [b, a], agent }))).toEqual([
      'completed:g_a', 'completed:g_b', 'deployed:g_a', 'deployed:g_b', 'loadout:watchlist:wl_hb',
    ]);
  });

  it('the same records in any arrival order give the same list', () => {
    const first = ids(run({ battles: [done(1), done(2), done(3)], agent: agentOf() }));
    const second = ids(run({ battles: [done(3), done(2), done(1)], agent: agentOf() }));
    expect(second).toEqual(first);
  });
});

describe('the cutoff: nothing older than the oldest completed record of the window (spec §8.2)', () => {
  it('a loadout row older than the oldest completed record is cut; one at or after it stays', () => {
    const older = agentOf({ equippedAt: iso(T.d3Done - 1) });
    expect(ids(run({ agent: older }))).not.toContain('loadout:watchlist:wl_hb');
    const equal = agentOf({ equippedAt: iso(T.d3Done) });
    expect(ids(run({ agent: equal }))).toContain('loadout:watchlist:wl_hb');
    const newer = agentOf({ equippedAt: iso(T.d3Done + 1) });
    expect(ids(run({ agent: newer }))).toContain('loadout:watchlist:wl_hb');
  });

  it('a game\'s own deployed row is cut when it falls before the oldest completion, the oldest game\'s included', () => {
    const activity = run();
    // done_3 completed at the cutoff; it was deployed six hours before, which is older.
    expect(ids(activity)).toContain('completed:done_3');
    expect(ids(activity)).not.toContain('deployed:done_3');
    // done_2 was deployed after done_3 completed: it stays.
    expect(ids(activity)).toContain('deployed:done_2');
  });

  it('the oldest record is the oldest READABLE completedAt; with records and none readable, nothing is listed', () => {
    const odd = [done(1, { completedAt: 'x' }), done(2, { completedAt: 'y' })];
    expect(run({ battles: odd, agent: agentOf() }).rows).toEqual([]);
  });

  it('with no completed record at all the current-state rows stay, with their "since" wording, and no history is claimed', () => {
    const activity = run({ battles: [], live: [liveDoc('bb_live')], agent: agentOf({ equippedAt: iso(Date.UTC(2020, 0, 5, 15, 0)) }) });
    expect(ids(activity)).toEqual(['deployed:bb_live', 'loadout:watchlist:wl_hb']);
    expect(activity.rows[1].text).toBe(COPY.activity.watchlistEquipped(formatHubDay(Date.UTC(2020, 0, 5, 15, 0))));
  });
});

describe('a game still live in the poll while the window holds it completed is listed once, live (Games\' own rule)', () => {
  it('no completed row for it; its deployed row stays', () => {
    const stillLive = liveDoc('done_1');
    const activity = run({ battles: [done(1), done(2)], live: [stillLive] });
    expect(ids(activity)).not.toContain('completed:done_1');
    expect(ids(activity)).toContain('completed:done_2');
    expect(ids(activity)).toContain('deployed:done_1');
  });
});

describe('the optimistic entry is kept out until the server document replaces it (spec §3)', () => {
  const optimistic = liveDoc('bb_new', { localOrigin: true, activatedAt: iso(NOW - 1000), createdAt: iso(NOW - 1000) });

  it('an entry marked localOrigin has no deployed row', () => {
    const activity = run({ live: [optimistic] });
    expect(ids(activity)).not.toContain('deployed:bb_new');
  });

  it('the same id as a server document (no marker) has one, at the server time', () => {
    const server = liveDoc('bb_new', { activatedAt: iso(NOW - 5 * 60 * 1000) });
    const activity = run({ live: [server] });
    const row = activity.rows.find((r) => r.id === 'deployed:bb_new');
    expect(row).toMatchObject({ ms: NOW - 5 * 60 * 1000, battleId: 'bb_new' });
  });

  it('the marker decides, not the time: an optimistic entry carrying a plausible server-looking time is still kept out', () => {
    const lookalike = liveDoc('bb_new', { localOrigin: true, activatedAt: { seconds: Math.floor(NOW / 1000) - 60, nanoseconds: 0 } });
    expect(ids(run({ live: [lookalike] }))).not.toContain('deployed:bb_new');
  });

  it('while the poll still holds the optimistic entry, a server document for it in the window is the deployed row', () => {
    const server = done(1, { id: 'bb_new' });
    const activity = run({ battles: [server, done(3)], live: [optimistic] });
    expect(ids(activity)).not.toContain('completed:bb_new');
    expect(ids(activity)).toContain('deployed:bb_new');
    expect(activity.rows.find((r) => r.id === 'deployed:bb_new').ms).toBe(Date.parse(server.activatedAt));
  });
});

describe('loadout rows exist only where an equip time is recorded (R-S4-1)', () => {
  it('the equipped watchlist: loadout:watchlist:{id} at the agent document\'s equippedAt, named by the list', () => {
    const activity = run({ agent: agentOf() });
    const row = activity.rows.find((r) => r.id === 'loadout:watchlist:wl_hb');
    expect(row).toMatchObject({ kind: ACTIVITY_KINDS.LOADOUT, text: COPY.activity.watchlistEquipped(formatHubDay(Date.parse(agentOf().equippedAt))), sub: 'High-Beta Ten' });
    expect(row.battleId).toBeUndefined();
  });

  it('a re-equip replaces the row: one row per list, at the latest time; another list is another id and the former is gone', () => {
    const first = run({ agent: agentOf({ equippedAt: iso(Date.UTC(2026, 9, 21, 22, 5)) }) }).rows.filter((r) => r.kind === 'loadout');
    const again = run({ agent: agentOf({ equippedAt: iso(Date.UTC(2026, 9, 22, 22, 5)) }) }).rows.filter((r) => r.kind === 'loadout');
    expect(first).toHaveLength(1);
    expect(again).toHaveLength(1);
    expect(again[0].id).toBe(first[0].id);
    expect(again[0].ms).toBeGreaterThan(first[0].ms);
    const other = run({ agent: agentOf({ equippedWatchlistId: 'wl_other', equippedWatchlistName: 'Other', equippedAt: iso(Date.UTC(2026, 9, 22, 23, 0)) }) });
    expect(ids(other)).toContain('loadout:watchlist:wl_other');
    expect(ids(other)).not.toContain('loadout:watchlist:wl_hb');
  });

  it.each([
    ['no equip time recorded', { equippedAt: null }],
    ['an equip time that cannot be read', { equippedAt: 'whenever' }],
    ['no watchlist equipped (a time left behind by an unequip is not a row)', { equippedWatchlistId: null }],
    ['an empty watchlist id', { equippedWatchlistId: '  ' }],
  ])('%s: no watchlist row, and none invented', (_, over) => {
    expect(ids(run({ agent: agentOf(over) })).some((id) => id.startsWith('loadout:'))).toBe(false);
    // ...also with no completed record at all, where no cutoff stands in the way and the current-state rows are all there is.
    expect(ids(run({ battles: [], agent: agentOf(over) }))).toEqual([]);
  });

  it('a list with no recorded name still has its row, named plainly', () => {
    const row = run({ agent: agentOf({ equippedWatchlistName: '' }) }).rows.find((r) => r.id === 'loadout:watchlist:wl_hb');
    expect(row.sub).toBe(COPY.loadout.watchlistFallback);
  });

  it('with no agent read yet there are no loadout rows (the games\' rows stand)', () => {
    const activity = run({ agent: null });
    expect(activity.rows.length).toBeGreaterThan(0);
    expect(activity.rows.some((r) => r.kind === 'loadout')).toBe(false);
  });
});

describe('adjustment rows: the standing leans a game would carry, at their recorded equip time (R-S4-1; BUILD_RULES §9)', () => {
  const lean = (adjustmentId, over = {}) => ({ adjustmentId, version: getCanonicalTextVersion('degen', adjustmentId), equippedAt: iso(Date.UTC(2026, 9, 21, 23, 30)), ...over });
  const withLeans = (standingLeans, over = {}) => run({ agent: agentOf({ standingLeans }), archetypeName: 'Speculator', characterTab: true, ...over });
  const adjustmentRows = (activity) => activity.rows.filter((r) => r.id.startsWith('loadout:adjustment:'));

  it('an accepted lean: loadout:adjustment:{id} at its equippedAt, "Adjustment equipped · since {date}", the archetype named', () => {
    const rows = adjustmentRows(withLeans([lean('SP-01')]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'loadout:adjustment:SP-01', kind: 'loadout', sub: 'Speculator',
      text: COPY.activity.adjustmentEquipped(formatHubDay(Date.UTC(2026, 9, 21, 23, 30))),
    });
    // The id is a key, not a label: it is shown nowhere.
    expect(`${rows[0].text}${rows[0].sub}`).not.toMatch(/SP-01/);
  });

  it('a re-equip (the entry replaced in place at a later time) is still one row, at the later time', () => {
    const later = iso(Date.UTC(2026, 9, 22, 9, 0));
    const rows = adjustmentRows(withLeans([lean('SP-01', { equippedAt: later })]));
    expect(rows).toHaveLength(1);
    expect(rows[0].ms).toBe(Date.parse(later));
  });

  it('a lean the current archetype does not carry, a stale version and a malformed pin are not equipped adjustments', () => {
    const rows = adjustmentRows(withLeans([lean('CP-01'), lean('SP-02', { version: 99 }), { adjustmentId: 'SP-03' }, null, 'SP-04', lean('SP-06')]));
    expect(rows.map((r) => r.id)).toEqual(['loadout:adjustment:SP-06']);
  });

  it('the kernel\'s own choice among two opposed leans stands: the later-equipped one is the one a game omits', () => {
    // SP-04 (concentrate) and SP-05 (spread) share a conflict group; the earlier equip wins.
    const rows = adjustmentRows(withLeans([
      lean('SP-05', { equippedAt: iso(Date.UTC(2026, 9, 22, 12, 0)) }),
      lean('SP-04', { equippedAt: iso(Date.UTC(2026, 9, 21, 12, 0)) }),
    ]));
    expect(rows.map((r) => r.id)).toEqual(['loadout:adjustment:SP-04']);
  });

  it('a pin stored twice is one adjustment: the entry the kernel accepted (here the second, the first being a stale version) gives the time', () => {
    const rows = adjustmentRows(withLeans([
      lean('SP-01', { version: 99, equippedAt: iso(Date.UTC(2026, 9, 20, 22, 0)) }),
      lean('SP-01', { equippedAt: iso(Date.UTC(2026, 9, 22, 8, 0)) }),
    ]));
    expect(rows).toHaveLength(1);
    expect(rows[0].ms).toBe(Date.UTC(2026, 9, 22, 8, 0));
  });

  it('a pin stored twice at the same version is the kernel\'s FIRST one (the second is its duplicate): the first entry\'s time, not the newer', () => {
    const rows = adjustmentRows(withLeans([
      lean('SP-01', { equippedAt: iso(Date.UTC(2026, 9, 21, 8, 0)) }),
      lean('SP-01', { equippedAt: iso(Date.UTC(2026, 9, 22, 8, 0)) }),
    ]));
    expect(rows).toHaveLength(1);
    expect(rows[0].ms).toBe(Date.UTC(2026, 9, 21, 8, 0));
  });

  it('an accepted lean with no readable equip time has no row', () => {
    expect(adjustmentRows(withLeans([lean('SP-01', { equippedAt: undefined }), lean('SP-02', { equippedAt: 'x' })]))).toEqual([]);
    expect(adjustmentRows(withLeans([lean('SP-01', { equippedAt: undefined }), lean('SP-02', { equippedAt: 'x' })], { battles: [] }))).toEqual([]);
  });

  it('without the Forge\'s Character tab (RELEASE3_CHARACTER_TAB_ENABLED) leans are not a surface: no adjustment row', () => {
    expect(adjustmentRows(withLeans([lean('SP-01')], { characterTab: false }))).toEqual([]);
    expect(adjustmentRows(withLeans([lean('SP-01')], { characterTab: undefined }))).toEqual([]);
  });

  it('no archetype name known: the row still stands, with no second line', () => {
    const rows = adjustmentRows(withLeans([lean('SP-01')], { archetypeName: null }));
    expect(rows[0].sub).toBe('');
  });

  it('standingLeans that is not a list, or an agent with no archetype, never throws and lists nothing', () => {
    for (const agent of [agentOf({ standingLeans: 'SP-01' }), agentOf({ standingLeans: null }), agentOf({ archetype: undefined, standingLeans: [lean('SP-01')] })]) {
      expect(adjustmentRows(run({ agent, characterTab: true }))).toEqual([]);
    }
  });
});

describe('purity and shape', () => {
  it('reads only its arguments: the same inputs give equal output, and nothing it was given is changed', () => {
    const battles = [done(1), done(2), done(3)];
    const live = [liveDoc('bb_live')];
    const agent = agentOf({ standingLeans: [{ adjustmentId: 'SP-01', version: VERSION, equippedAt: iso(T.d2Done) }] });
    const snapshot = JSON.stringify({ battles, live, agent });
    const args = { battles, live, rowsById: rowsFor(battles, live), agent, archetypeName: 'Speculator', characterTab: true };
    const a = deriveActivity(args);
    const b = deriveActivity(args);
    expect(a).toEqual(b);
    expect(JSON.stringify({ battles, live, agent })).toBe(snapshot);
  });

  it('every row and the list are frozen; ids are strings; the count is the list\'s own length', () => {
    const activity = run({ agent: agentOf() });
    expect(Object.isFrozen(activity)).toBe(true);
    expect(Object.isFrozen(activity.rows)).toBe(true);
    expect(activity.rows.every((row) => Object.isFrozen(row) && typeof row.id === 'string')).toBe(true);
    expect(activity.status).toBe('ready');
  });

  it('records without an id, or not objects, are ignored', () => {
    // Games' rows are built from the valid records alone (hub/gamesDisplay.js is the readers' to guard); Activity is handed the rest.
    const activity = deriveActivity({ battles: [done(1), null, { completedAt: iso(T.d1Done) }, 'x'], live: [undefined, { status: 'active' }], rowsById: rowsFor([done(1)]), agent: null });
    expect(ids(activity)).toEqual(['completed:done_1']);
  });
});

describe('the section: loading, a failed first read, and the projection (spec §3)', () => {
  const base = { live: [], rowsById: new Map(), agent: null };

  it('the window not yet read: loading with no rows — never an empty list', () => {
    expect(activitySectionOf({ ...base, battles: null })).toEqual({ status: 'loading', rows: [] });
  });

  it('the first read failed and nothing is retained: error with no rows, never "Nothing recorded yet"', () => {
    expect(activitySectionOf({ ...base, battles: null, failed: true })).toEqual({ status: 'error', rows: [] });
  });

  it('a window read: the projection, ready', () => {
    const battles = [done(1)];
    const section = activitySectionOf({ battles, live: [], rowsById: rowsFor(battles), agent: null });
    expect(section.status).toBe('ready');
    expect(section.rows.length).toBeGreaterThan(0);
  });

  it('a window that is read and empty is ready with no rows (the one place "Nothing recorded yet" is true)', () => {
    expect(activitySectionOf({ ...base, battles: [] })).toMatchObject({ status: 'ready', rows: [] });
  });
});
