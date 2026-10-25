// src/components/CommandCenter/hub/activityRows.idea.test.js
//
// Command Center hub, slice S6 (ruling R-S6-7; spec V1.2 §8.2) — Recent activity's idea rows, for the CURRENT idea only:
// idea.created:{list}:v{n} at its recorded createdAt ("Idea saved") and idea.state:{list}:v{n}:{status} at its stateChangedAt
// (the recorded status). A revision never counts as a new idea; the same cutoff applies; and "Nothing recorded yet" waits for the
// idea reader. The S4 rows stay in activityRows.test.js.

import { describe, expect, it } from 'vitest';
import { ACTIVITY_KINDS, LOADOUT_KNOWLEDGE, activitySectionOf, deriveActivity, ideaKnowledgeOf, loadoutKnowledgeOf } from './activityRows';
import { completedGameRows } from './gamesDisplay';
import { HUB_COPY as COPY } from './hubCopy';
import { formatHubDayTime } from './activityDates';
import { RESEARCH_READ, RESEARCH_STATE, ideaActivityOf } from './researchView';
import { LOADOUT_STATUS, WATCHLIST_STATE } from './selectors/loadout';

const UID = 'uid-A';
const NOW = Date.UTC(2026, 9, 25, 15, 0);
const iso = (ms) => new Date(ms).toISOString();
const at = (ms) => COPY.time.et(formatHubDayTime(ms, NOW));

const T = {
  oldestDone: Date.UTC(2026, 9, 20, 20, 0),
  created: Date.UTC(2026, 9, 22, 14, 0),
  stateChanged: Date.UTC(2026, 9, 23, 16, 30),
  beforeCutoff: Date.UTC(2026, 9, 10, 14, 0),
};
const done = (n, ms = T.oldestDone) => ({
  id: `done_${n}`, ownerId: UID, agentId: `casual-agent-${UID}`, status: 'completed', completedAt: iso(ms),
  scoreState: { currentScore: 10 + n, opponentScore: 5, lastScoredAt: iso(ms - 120000) }, statusFeed: [{ action: 'battle_complete' }],
});

const IDEA = Object.freeze({
  listId: 'wl_hb', listName: 'High-Beta Ten', version: 2, status: 'ready', statusLabel: 'Ready', createdAt: iso(T.created), stateChangedAt: iso(T.stateChanged),
});
const run = (over = {}) => {
  const battles = over.battles ?? [done(1)];
  return deriveActivity({ battles, live: [], rowsById: new Map(completedGameRows(battles).map((r) => [r.id, r])), agent: null, nowMs: NOW, idea: IDEA, ...over });
};
const ideaRows = (activity) => activity.rows.filter((row) => row.kind === ACTIVITY_KINDS.IDEA);

describe('the current idea\'s two events', () => {
  it('idea.created:{list}:v{n} at createdAt reads "Idea saved"; idea.state:{list}:v{n}:{status} at stateChangedAt reads the recorded status', () => {
    const rows = ideaRows(run());
    expect(rows.map((r) => r.id).sort()).toEqual(['idea.created:wl_hb:v2', 'idea.state:wl_hb:v2:ready']);
    const created = rows.find((r) => r.id === 'idea.created:wl_hb:v2');
    const state = rows.find((r) => r.id === 'idea.state:wl_hb:v2:ready');
    expect(created).toMatchObject({ kind: ACTIVITY_KINDS.IDEA, text: 'Idea saved', sub: 'High-Beta Ten', ms: T.created, at: at(T.created) });
    expect(state).toMatchObject({ kind: ACTIVITY_KINDS.IDEA, text: 'Idea · Ready', sub: 'High-Beta Ten', ms: T.stateChanged, at: at(T.stateChanged) });
    expect(COPY.activity.ideaSaved).toBe('Idea saved');
    expect(COPY.activity.ideaState('Review due')).toBe('Idea · Review due');
  });

  it('a state row names the status it recorded: another status is another id, and the word comes from the record', () => {
    const rows = ideaRows(run({ idea: { ...IDEA, status: 'review_due', statusLabel: 'Review due' } }));
    expect(rows.map((r) => r.id)).toContain('idea.state:wl_hb:v2:review_due');
    expect(rows.find((r) => r.id.startsWith('idea.state')).text).toBe('Idea · Review due');
  });

  it('a revision is never a new idea: the NEXT version is another pair of ids for the same list, and only the current version has rows', () => {
    const v3 = { ...IDEA, version: 3, status: 'draft', statusLabel: 'Draft' };
    const ids = (idea) => ideaRows(run({ idea })).map((r) => r.id).sort();
    expect(ids(IDEA)).toEqual(['idea.created:wl_hb:v2', 'idea.state:wl_hb:v2:ready']);
    expect(ids(v3)).toEqual(['idea.created:wl_hb:v3', 'idea.state:wl_hb:v3:draft']);
    // ...and one descriptor means one pair, however many versions the list holds: never rows for versions 1 and 2 beside 3.
    expect(ideaRows(run({ idea: v3 }))).toHaveLength(2);
  });

  it('there is no idea row without a descriptor (the S4 test that none exists until the reader does still holds)', () => {
    for (const idea of [null, undefined, {}, 'idea', 7]) expect(ideaRows(run({ idea })), String(idea)).toEqual([]);
  });

  it('nothing is invented: an unreadable time yields no row; a status with no word yields no state row; a bad version or list yields none', () => {
    expect(ideaRows(run({ idea: { ...IDEA, createdAt: 'whenever' } })).map((r) => r.id)).toEqual(['idea.state:wl_hb:v2:ready']);
    expect(ideaRows(run({ idea: { ...IDEA, stateChangedAt: null } })).map((r) => r.id)).toEqual(['idea.created:wl_hb:v2']);
    expect(ideaRows(run({ idea: { ...IDEA, statusLabel: null } })).map((r) => r.id)).toEqual(['idea.created:wl_hb:v2']);
    expect(ideaRows(run({ idea: { ...IDEA, status: '' } })).map((r) => r.id)).toEqual(['idea.created:wl_hb:v2']);
    for (const bad of [{ version: 0 }, { version: 1.5 }, { version: '2' }, { listId: '' }, { listId: null }]) {
      expect(ideaRows(run({ idea: { ...IDEA, ...bad } })), JSON.stringify(bad)).toEqual([]);
    }
  });

  it('a list without a name is named as the card names it', () => {
    expect(ideaRows(run({ idea: { ...IDEA, listName: null } }))[0].sub).toBe(COPY.loadout.watchlistFallback);
  });
});

describe('the same cutoff, order and dedupe as every other kind', () => {
  it('nothing older than the oldest completed record of the window: an idea saved before it has no row, one saved after it does', () => {
    const before = ideaRows(run({ idea: { ...IDEA, createdAt: iso(T.beforeCutoff), stateChangedAt: iso(T.stateChanged) } }));
    expect(before.map((r) => r.id)).toEqual(['idea.state:wl_hb:v2:ready']);
    expect(ideaRows(run()).map((r) => r.id).sort()).toEqual(['idea.created:wl_hb:v2', 'idea.state:wl_hb:v2:ready']);
  });

  it('with no completed record at all the current-state rows stay (no cutoff, no exhaustive history claimed)', () => {
    expect(ideaRows(run({ battles: [], idea: { ...IDEA, createdAt: iso(T.beforeCutoff) } })).map((r) => r.id)).toContain('idea.created:wl_hb:v2');
  });

  it('newest first, then the kind order completed, deployed, loadout, idea, then id: at one instant the idea follows the game and the equip', () => {
    const at1 = Date.UTC(2026, 9, 23, 16, 0);
    const battles = [done(1, at1), done(2)];
    const agent = { id: 'agent-a', archetype: 'degen', equippedWatchlistId: 'wl_hb', equippedAt: iso(at1) };
    const activity = run({
      battles, agent, watchlist: { id: 'wl_hb', name: 'High-Beta Ten' }, idea: { ...IDEA, createdAt: iso(at1), stateChangedAt: iso(at1) },
    });
    expect(activity.rows.filter((r) => r.ms === at1).map((r) => r.id)).toEqual([
      'completed:done_1', 'loadout:watchlist:wl_hb', 'idea.created:wl_hb:v2', 'idea.state:wl_hb:v2:ready',
    ]);
  });

  it('every id once: the same descriptor twice adds nothing', () => {
    const activity = run();
    expect(new Set(activity.rows.map((r) => r.id)).size).toBe(activity.rows.length);
  });

  it('it stays a projection: the rows are frozen and the descriptor is not changed', () => {
    const given = { ...IDEA };
    const activity = run({ idea: given });
    expect(Object.isFrozen(activity.rows)).toBe(true);
    expect(ideaRows(activity).every((r) => Object.isFrozen(r))).toBe(true);
    expect(given).toEqual(IDEA);
  });
});

describe('"Nothing recorded yet" waits for the idea reader (H-4, joined to the loadout\'s knowledge)', () => {
  const loadout = (watchlistState = WATCHLIST_STATE.READY) => ({ status: LOADOUT_STATUS.READY, watchlist: { state: watchlistState } });

  it('the idea reader\'s state is how much of the idea is known: loading is pending, an error with nothing is failed, every settled answer is settled', () => {
    expect(ideaKnowledgeOf({ status: RESEARCH_STATE.LOADING })).toBe(LOADOUT_KNOWLEDGE.PENDING);
    expect(ideaKnowledgeOf({ status: RESEARCH_STATE.ERROR })).toBe(LOADOUT_KNOWLEDGE.FAILED);
    for (const status of [RESEARCH_STATE.GATE_OFF, RESEARCH_STATE.DISABLED, RESEARCH_STATE.NO_LIST, RESEARCH_STATE.NO_IDEA, RESEARCH_STATE.UNAVAILABLE, RESEARCH_STATE.READY]) {
      expect(ideaKnowledgeOf({ status }), status).toBe(LOADOUT_KNOWLEDGE.SETTLED);
    }
    expect(ideaKnowledgeOf(null)).toBe(LOADOUT_KNOWLEDGE.SETTLED);
    // The words are the section's own.
    expect([RESEARCH_STATE.LOADING, RESEARCH_STATE.ERROR]).toEqual(['loading', 'error']);
  });

  it('the join: the loadout\'s own pending or failed wins; a settled loadout takes the idea\'s; neither given is settled as before', () => {
    expect(loadoutKnowledgeOf(loadout())).toBe(LOADOUT_KNOWLEDGE.SETTLED);
    expect(loadoutKnowledgeOf(loadout(), LOADOUT_KNOWLEDGE.PENDING)).toBe(LOADOUT_KNOWLEDGE.PENDING);
    expect(loadoutKnowledgeOf(loadout(), LOADOUT_KNOWLEDGE.FAILED)).toBe(LOADOUT_KNOWLEDGE.FAILED);
    expect(loadoutKnowledgeOf(loadout(WATCHLIST_STATE.LOADING), LOADOUT_KNOWLEDGE.FAILED)).toBe(LOADOUT_KNOWLEDGE.PENDING);
    expect(loadoutKnowledgeOf({ status: LOADOUT_STATUS.ERROR }, LOADOUT_KNOWLEDGE.PENDING)).toBe(LOADOUT_KNOWLEDGE.FAILED);
    expect(loadoutKnowledgeOf(null, LOADOUT_KNOWLEDGE.PENDING)).toBe(LOADOUT_KNOWLEDGE.PENDING);
    expect(loadoutKnowledgeOf(null)).toBe(LOADOUT_KNOWLEDGE.SETTLED);
  });

  it('an empty list is loading (or failed), never "nothing recorded", while the idea is unknown — and empty once it is known', () => {
    // A window with no game and no loadout row: the one case where the list can be empty.
    const section = (knowledge) => activitySectionOf({
      battles: [], live: [], rowsById: new Map(), agent: null, watchlist: null, nowMs: NOW, idea: null, knowledge,
    });
    expect(section(loadoutKnowledgeOf(loadout(), ideaKnowledgeOf({ status: RESEARCH_STATE.LOADING }))).status).toBe('loading');
    expect(section(loadoutKnowledgeOf(loadout(), ideaKnowledgeOf({ status: RESEARCH_STATE.ERROR }))).status).toBe('error');
    expect(section(loadoutKnowledgeOf(loadout(), ideaKnowledgeOf({ status: RESEARCH_STATE.NO_IDEA }))).status).toBe('ready');
    expect(section(loadoutKnowledgeOf(loadout(), ideaKnowledgeOf({ status: RESEARCH_STATE.NO_IDEA }))).rows).toEqual([]);
  });

  it('a list with rows is a list: an idea still unknown does not hide what is known', () => {
    const rows = activitySectionOf({
      battles: [done(1)], live: [], rowsById: new Map(completedGameRows([done(1)]).map((r) => [r.id, r])), agent: null, nowMs: NOW, idea: null,
      knowledge: loadoutKnowledgeOf(loadout(), LOADOUT_KNOWLEDGE.PENDING),
    });
    expect(rows.status).toBe('ready');
    expect(rows.rows.length).toBeGreaterThan(0);
  });

  it('activitySectionOf carries the idea through to its rows', () => {
    const section = activitySectionOf({
      battles: [done(1)], live: [], rowsById: new Map(completedGameRows([done(1)]).map((r) => [r.id, r])), agent: null, nowMs: NOW, idea: IDEA,
    });
    expect(section.rows.filter((r) => r.kind === ACTIVITY_KINDS.IDEA)).toHaveLength(2);
  });
});

describe('from the reader\'s answer to the rows (ideaActivityOf → deriveActivity)', () => {
  const read = (over = {}) => ({
    status: RESEARCH_READ.READY, listId: 'wl_hb', asOf: 1,
    data: {
      currentVersion: 4, versionCount: 4,
      versions: [1, 2, 3, 4].map((n) => ({ version: n, status: n === 4 ? 'ready' : 'retired', createdAt: iso(T.created + n * 3600_000), stateChangedAt: iso(T.created + n * 3600_000) })),
      research: [], deployedLists: {},
    },
    ...over,
  });
  const card = { id: 'wl_hb', name: 'High-Beta Ten', state: WATCHLIST_STATE.READY };

  it('four versions of one idea list ONE idea\'s two events', () => {
    const idea = ideaActivityOf({ read: read(), watchlist: card });
    expect(idea.version).toBe(4);
    expect(ideaRows(run({ idea })).map((r) => r.id).sort()).toEqual(['idea.created:wl_hb:v4', 'idea.state:wl_hb:v4:ready']);
  });

  it('a pointer on version 2 lists version 2, though 4 exists', () => {
    const r = read();
    r.data = { ...r.data, currentVersion: 2 };
    expect(ideaRows(run({ idea: ideaActivityOf({ read: r, watchlist: card }) })).map((x) => x.id).sort()).toEqual(['idea.created:wl_hb:v2', 'idea.state:wl_hb:v2:retired']);
  });
});
