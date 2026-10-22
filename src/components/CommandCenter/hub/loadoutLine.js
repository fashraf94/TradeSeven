// src/components/CommandCenter/hub/loadoutLine.js
//
// Command Center hub — the one-line loadout the strip, the Deploy card and the
// area summaries share ("Trend Follower · Tech Leaders"). Slice S1 wrote it for
// a loadout with both names; slice S5 (ruling R-S5-1) gives it the states a live
// loadout has, so a line is never "Checking your loadout" for a settled answer:
//   - no agent: the spec §3 words, "Create your agent first";
//   - no list equipped: the archetype and "No watchlist";
//   - a list that cannot be resolved: its stored name, marked unavailable;
//   - lists still loading: the stored name when the agent document has one.
// The S1 frame's fixtures (a ready loadout with both names and no `state`) keep
// the line they always had.

import { HUB_COPY as COPY } from './hubCopy';
import { LOADOUT_STATUS, WATCHLIST_STATE } from './selectors/loadout';

export function loadoutLineOf(loadout) {
  if (loadout?.status === LOADOUT_STATUS.NONE) return COPY.loadout.noAgent;
  const archetype = loadout?.status === LOADOUT_STATUS.READY ? loadout.archetype?.name : null;
  const list = loadout?.watchlist;
  if (!archetype || !list) return COPY.loadout.lineLoading;
  if (list.state === WATCHLIST_STATE.NONE) return COPY.loadout.lineNoWatchlist(archetype);
  // An unnamed list still loading has no line yet; once settled it is named by the shells' own fallback.
  const name = list.name || (list.state === WATCHLIST_STATE.LOADING ? null : COPY.loadout.watchlistFallback);
  if (!name) return COPY.loadout.lineLoading;
  return COPY.loadout.line(archetype, list.state === WATCHLIST_STATE.UNAVAILABLE ? COPY.loadout.unavailable(name) : name);
}
