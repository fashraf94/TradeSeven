// src/components/CommandCenter/hub/researchDoorView.test.js
//
// Command Center core spec V1.2, Amendment E V1.1 §1, §3.1, §3.2 — the research door's pure view: which owned agentBattles id
// the admission hook hands the verdict (the owned live list first, then the completed window, nothing read to find one), the
// door's three states and its "Research in progress" line (with and without telemetry.lastTurnAt, "finding" for one), the
// session id Continue opens, and the sheet's equippedListLabel as the Loadout card shows the list.

import { describe, expect, it } from 'vitest';
import { HUB_COPY as COPY } from './hubCopy';
import { formatHubDayTime } from './activityDates';
import { bookViewOf } from './perGameLoadoutModel';
import { LOADOUT_STATUS, WATCHLIST_STATE } from './selectors/loadout';
import {
  RESEARCH_DOOR_STATUS, admissionBattleIdOf, equippedBookLabelOf, equippedWatchlistLabelOf, researchDoorOf, researchRecordsOf, sessionIdOf,
} from './researchDoorView';

const AUTH = Object.freeze({ signedIn: true, uid: 'uid-A', authEpoch: 2 });
const NOW = Date.UTC(2026, 10, 14, 15, 0);
const iso = (ms) => new Date(ms).toISOString();

const owned = (id, over = {}) => ({ id, ownerId: 'uid-A', status: 'active', ...over });
const completed = (rows, over = {}) => ({ status: 'ready', rows, ownerUid: 'uid-A', ownerEpoch: 2, ...over });

describe('admissionBattleIdOf — an owned agentBattles id the hub already holds', () => {
  it('the owned live list first', () => {
    expect(admissionBattleIdOf({ live: [owned('ab_live')], completed: completed([owned('ab_done', { status: 'completed' })]), auth: AUTH })).toBe('ab_live');
  });

  it('then the completed window, while it is this owner\'s and epoch\'s', () => {
    expect(admissionBattleIdOf({ live: [], completed: completed([owned('ab_done', { status: 'completed' })]), auth: AUTH })).toBe('ab_done');
  });

  it('a window of another owner or another epoch is not used', () => {
    expect(admissionBattleIdOf({ live: [], completed: completed([owned('ab_done')], { ownerUid: 'uid-B' }), auth: AUTH })).toBeNull();
    expect(admissionBattleIdOf({ live: [], completed: completed([owned('ab_done')], { ownerEpoch: 1 }), auth: AUTH })).toBeNull();
  });

  it('a battle another owner holds is never handed over (the route would refuse it 403)', () => {
    expect(admissionBattleIdOf({ live: [owned('ab_x', { ownerId: 'uid-B' })], completed: completed([owned('ab_y', { ownerId: 'uid-B' })]), auth: AUTH })).toBeNull();
  });

  it('no battle at all, no window yet, or no signed-in player: null (and so no request)', () => {
    expect(admissionBattleIdOf({ live: [], completed: completed([]), auth: AUTH })).toBeNull();
    expect(admissionBattleIdOf({ live: [], completed: null, auth: AUTH })).toBeNull();
    expect(admissionBattleIdOf({ live: [owned('ab_live')], completed: null, auth: null })).toBeNull();
    expect(admissionBattleIdOf({ live: [owned('ab_live')], completed: null, auth: { signedIn: false } })).toBeNull();
  });

  it('a row without a usable id is skipped', () => {
    expect(admissionBattleIdOf({ live: [owned(''), owned(null), owned('ab_2')], completed: null, auth: AUTH })).toBe('ab_2');
  });
});

const record = (sessionId, over = {}) => ({
  id: `sr_${sessionId}`, origin: 'shared_research', state: 'open', host: { collection: 'sharedResearchSessions', id: sessionId },
  createdAt: iso(NOW - 3600000), findings: [{ findingId: 'f1' }, { findingId: 'f2' }, { findingId: 'f3' }], telemetry: { lastTurnAt: null }, ...over,
});
const ready = (records) => ({ key: 'uid-A:2', status: 'ready', records, error: null });

describe('researchDoorOf — the door\'s three states (amendment §3.1)', () => {
  it('loading (idle or loading): no line, and the door shows', () => {
    for (const read of [{ status: 'idle', records: null }, { status: 'loading', records: null }, null]) {
      expect(researchDoorOf({ read, nowMs: NOW })).toEqual({ status: RESEARCH_DOOR_STATUS.LOADING, progress: null });
    }
  });

  it('error: the error state, no line', () => {
    expect(researchDoorOf({ read: { status: 'error', records: null }, nowMs: NOW })).toEqual({ status: RESEARCH_DOOR_STATUS.ERROR, progress: null });
  });

  it('ready, nothing open: no line — never "no research" (the read is bounded)', () => {
    const door = researchDoorOf({ read: ready([record('s1', { state: 'completed' }), record('s2', { state: 'abandoned' })]), nowMs: NOW });
    expect(door).toEqual({ status: RESEARCH_DOOR_STATUS.READY, progress: null });
    expect(researchDoorOf({ read: ready([]), nowMs: NOW }).progress).toBeNull();
  });

  it('the newest open investigation (the query answers newest first): its session id, its count, and its last update in the hub\'s ET format', () => {
    const last = NOW - 25 * 60000;
    const door = researchDoorOf({ read: ready([record('s_new', { state: 'completed' }), record('s_open', { telemetry: { lastTurnAt: iso(last) } }), record('s_old')]), nowMs: NOW });
    expect(door.status).toBe(RESEARCH_DOOR_STATUS.READY);
    expect(door.progress.sessionId).toBe('s_open');
    expect(door.progress.findings).toBe(3);
    expect(door.progress.line).toBe(COPY.research.door.inProgress(COPY.time.et(formatHubDayTime(last, NOW)), 3));
    expect(door.progress.line).toBe('Research in progress · last update Nov 14, 9:35 AM ET · 3 findings');
  });

  it('opened, not yet stepped (no lastTurnAt): the count alone', () => {
    const door = researchDoorOf({ read: ready([record('s1')]), nowMs: NOW });
    expect(door.progress.line).toBe('Research in progress · 3 findings');
  });

  it('"finding" for one; no findings array reads 0', () => {
    expect(researchDoorOf({ read: ready([record('s1', { findings: [{}] })]), nowMs: NOW }).progress.line).toBe('Research in progress · 1 finding');
    expect(researchDoorOf({ read: ready([record('s1', { findings: undefined })]), nowMs: NOW }).progress.line).toBe('Research in progress · 0 findings');
  });

  it('an open record with no session id is skipped (Continue needs one)', () => {
    const door = researchDoorOf({ read: ready([record('x', { host: null }), record('s2')]), nowMs: NOW });
    expect(door.progress.sessionId).toBe('s2');
  });

  it('a kept answer through a failed refresh (ready, stale) still shows its line', () => {
    expect(researchDoorOf({ read: { ...ready([record('s1')]), stale: true }, nowMs: NOW }).progress.sessionId).toBe('s1');
  });
});

describe('sessionIdOf and researchRecordsOf', () => {
  it('the session id is host.id', () => {
    expect(sessionIdOf(record('s9'))).toBe('s9');
    expect(sessionIdOf({ host: { id: '' } })).toBeNull();
    expect(sessionIdOf(null)).toBeNull();
  });
  it('records only from a ready read', () => {
    expect(researchRecordsOf(ready([record('s1')]))).toHaveLength(1);
    expect(researchRecordsOf({ status: 'loading', records: null })).toBeNull();
    expect(researchRecordsOf({ status: 'error', records: null })).toBeNull();
  });
});

describe('equippedListLabel — the list as the Loadout card shows it', () => {
  it('per-game loadouts: the BaggerBomb card\'s book name, from the card model itself', () => {
    const book = bookViewOf({ ref: { watchlistId: 'wl-1' } }, [{ watchlistId: 'wl-1', name: 'Grid builders', tickers: [] }]);
    expect(equippedBookLabelOf({ baggerbomb: { book } })).toBe('Grid builders');
  });
  it('...the card\'s fallback name when the list has none, and null with no book or no cards', () => {
    const unnamed = bookViewOf({ ref: { watchlistId: 'wl-1' } }, [{ watchlistId: 'wl-1', name: '', tickers: [] }]);
    expect(equippedBookLabelOf({ baggerbomb: { book: unnamed } })).toBe(COPY.loadout.watchlistFallback);
    expect(equippedBookLabelOf({ baggerbomb: { book: bookViewOf(null, []) } })).toBeNull();
    expect(equippedBookLabelOf(null)).toBeNull();
  });
  it('per-game loadouts off: the equipped watchlist the card resolved, else null', () => {
    const loadout = { status: LOADOUT_STATUS.READY, watchlist: { state: WATCHLIST_STATE.READY, id: 'wl-1', name: 'Tech Leaders' } };
    expect(equippedWatchlistLabelOf(loadout)).toBe('Tech Leaders');
    expect(equippedWatchlistLabelOf({ ...loadout, watchlist: { ...loadout.watchlist, name: '' } })).toBe(COPY.loadout.watchlistFallback);
    expect(equippedWatchlistLabelOf({ ...loadout, watchlist: { state: WATCHLIST_STATE.LOADING } })).toBeNull();
    expect(equippedWatchlistLabelOf({ status: LOADOUT_STATUS.LOADING })).toBeNull();
  });
});
