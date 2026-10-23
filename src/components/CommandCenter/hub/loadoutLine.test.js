// src/components/CommandCenter/hub/loadoutLine.test.js
//
// Command Center hub, slice S5 — the one-line loadout the strip, the Deploy
// card and the area summaries share (ruling R-S5-1: a line is never "Checking
// your loadout" for a settled answer). Pure: every case is an argument (lens
// E5, E5-11).

import { describe, expect, it } from 'vitest';
import { HUB_COPY as COPY } from './hubCopy';
import { loadoutLineOf } from './loadoutLine';
import { LOADOUT_STATUS, WATCHLIST_STATE } from './selectors/loadout';

const ARCHETYPE = { name: 'Trend Follower', approach: 'Goes where the momentum is.' };
const ready = (watchlist, archetype = ARCHETYPE) => ({ status: LOADOUT_STATUS.READY, archetype, watchlist });
const list = (state, name) => ({ state, name });

describe('loadoutLineOf — the states a live loadout has', () => {
  it('no agent: the spec §3 words, "Create your agent first"', () => {
    expect(loadoutLineOf({ status: LOADOUT_STATUS.NONE })).toBe(COPY.loadout.noAgent);
    expect(COPY.loadout.noAgent).not.toBe(COPY.loadout.lineLoading);
  });

  it('the agent\'s read failed (the S3 merge, N-S5-6): "Agent unavailable" — neither absence nor a wait', () => {
    expect(loadoutLineOf({ status: LOADOUT_STATUS.ERROR })).toBe(COPY.loadout.agentUnavailable);
    expect(COPY.loadout.agentUnavailable).not.toBe(COPY.loadout.noAgent);
    expect(COPY.loadout.agentUnavailable).not.toBe(COPY.loadout.lineLoading);
  });

  it('nothing resolved yet: the waiting line', () => {
    for (const loadout of [undefined, null, {}, { status: LOADOUT_STATUS.LOADING }]) {
      expect(loadoutLineOf(loadout), JSON.stringify(loadout)).toBe(COPY.loadout.lineLoading);
    }
  });

  it('ready but without an archetype name or a watchlist section: still the waiting line', () => {
    expect(loadoutLineOf(ready(undefined))).toBe(COPY.loadout.lineLoading);
    expect(loadoutLineOf(ready(list(WATCHLIST_STATE.READY, 'Tech Leaders'), { name: '' }))).toBe(COPY.loadout.lineLoading);
    expect(loadoutLineOf(ready(list(WATCHLIST_STATE.READY, 'Tech Leaders'), null))).toBe(COPY.loadout.lineLoading);
  });

  it('no list equipped: the archetype and "No watchlist"', () => {
    expect(loadoutLineOf(ready(list(WATCHLIST_STATE.NONE, null)))).toBe(COPY.loadout.lineNoWatchlist('Trend Follower'));
  });

  it('a resolved list: the archetype and the list\'s name (the S1 frame\'s stateless fixture too)', () => {
    expect(loadoutLineOf(ready(list(WATCHLIST_STATE.READY, 'Tech Leaders')))).toBe('Trend Follower · Tech Leaders');
    expect(loadoutLineOf(ready({ name: 'Tech Leaders' }))).toBe('Trend Follower · Tech Leaders');
  });

  it('lists still loading: the stored name when the agent document has one, the waiting line when it has none', () => {
    expect(loadoutLineOf(ready(list(WATCHLIST_STATE.LOADING, 'Stored Tech')))).toBe(COPY.loadout.line('Trend Follower', 'Stored Tech'));
    expect(loadoutLineOf(ready(list(WATCHLIST_STATE.LOADING, null)))).toBe(COPY.loadout.lineLoading);
  });

  it('a list that cannot be resolved: its stored name, marked unavailable', () => {
    expect(loadoutLineOf(ready(list(WATCHLIST_STATE.UNAVAILABLE, 'Stored Tech')))).toBe(COPY.loadout.line('Trend Follower', COPY.loadout.unavailable('Stored Tech')));
  });

  it('an unnamed list, once settled, is named by the shells\' own fallback — resolved, unavailable or failed alike', () => {
    for (const state of [WATCHLIST_STATE.READY, WATCHLIST_STATE.ERROR]) {
      expect(loadoutLineOf(ready(list(state, null))), state).toBe(COPY.loadout.line('Trend Follower', COPY.loadout.watchlistFallback));
    }
    expect(loadoutLineOf(ready(list(WATCHLIST_STATE.UNAVAILABLE, null)))).toBe(COPY.loadout.line('Trend Follower', COPY.loadout.unavailable(COPY.loadout.watchlistFallback)));
  });
});
