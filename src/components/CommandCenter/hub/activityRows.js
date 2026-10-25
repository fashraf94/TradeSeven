// src/components/CommandCenter/hub/activityRows.js
//
// Command Center hub, slice S4 (ruling R-S4-1; spec V1.2 §8.2, review IR-11) —
// Recent activity: a bounded PROJECTION of records the hub already holds, never
// an event log. Pure: it reads only its arguments.
//
//   sources   the owned live documents (the poll's, S3), the ten-game window's
//             completed documents (S3), and the current loadout: the owner's
//             agent document (S5's owner-masked read) for the recorded equip
//             times, and the Loadout card's own resolution of the equipped
//             list. Nothing is read for it.
//   kinds     completed:{battleId}   at `completedAt`, with the §7 outcome words
//                                     (Games' own row text, so the two agree)
//             deployed:{battleId}    at the server `activatedAt`, else `createdAt`;
//                                     an optimistic entry (`localOrigin: true`) is
//                                     left out until the server document replaces it
//             loadout:watchlist:{id} at the agent document's recorded `equippedAt`,
//                                     named as the Loadout card names the list, and
//                                     only while the card has found that list among
//                                     the committed ones (a list since deleted or
//                                     taken back to draft is not equipped to any game)
//             loadout:adjustment:{id} at that standing lean's recorded `equippedAt`,
//                                     for the leans a game would carry
//             (idea rows are S6's: the idea reader is its)
//   times     one normalizer (hubDate.js hubMs), shown as absolute ET, with the year
//             when it is not this year's. A record with no readable time yields NO
//             row, and a loadout row exists only where an equip time is recorded:
//             nothing is invented.
//   order     newest first, then the kind order completed, deployed, loadout,
//             idea, then id; kind-specific ids, each once.
//   cutoff    nothing older than the oldest completed record of the window (so a
//             list never reaches past what its heading says). With no completed
//             record at all the current-state rows stay, with their "since"
//             wording, and no exhaustive history is claimed.
//   dedupe    a game the window holds completed while the poll's list still holds
//             it live is listed once, live, as Games lists it: no completed row.
//   nothing   an empty list is "Nothing recorded yet" only when nothing is unknown:
//             while the loadout is still loading (or failed) the list may be
//             missing its loadout rows, so it is loading (or failed), not empty.
//
// The adjustment rows ask the shared kernel which leans a game would carry
// (api/_utils/leanRevalidation.js revalidateStandingLeans at its default cap — the
// call the battle snapshot and the Forge's Character tab make) rather than list
// every stored pin: a lean the current archetype no longer carries is not an
// equipped adjustment (BUILD_RULES §9).

import { revalidateStandingLeans } from '../../../../api/_utils/leanRevalidation.js';
import { HUB_COPY as COPY } from './hubCopy';
import { formatHubDayTime, formatHubDayYear } from './activityDates';
import { hubMs } from './hubDate';
import { LOADOUT_STATUS, WATCHLIST_STATE } from './selectors/loadout';

export const ACTIVITY_KINDS = Object.freeze({ COMPLETED: 'completed', DEPLOYED: 'deployed', LOADOUT: 'loadout', IDEA: 'idea' });
const KIND_ORDER = Object.freeze([ACTIVITY_KINDS.COMPLETED, ACTIVITY_KINDS.DEPLOYED, ACTIVITY_KINDS.LOADOUT, ACTIVITY_KINDS.IDEA]);

const nonEmpty = (value) => (typeof value === 'string' && value.trim() !== '' ? value : null);

/**
 * The oldest completed record's time, below which nothing is listed. No record: no cutoff. Records and none of them
 * readable: the oldest is unknown, so nothing older than "unknown" can be shown — everything is cut.
 */
function cutoffOf(windowDocs) {
  if (windowDocs.length === 0) return -Infinity;
  const times = windowDocs.map((doc) => hubMs(doc?.completedAt)).filter((ms) => ms !== null);
  return times.length ? Math.min(...times) : Infinity;
}

/** The ids of the agent's standing leans the kernel accepts, each with the version it accepted. Never throws. */
function acceptedLeans(agent) {
  try {
    const { valid } = revalidateStandingLeans({ standingLeans: agent.standingLeans, archetypeCodeId: agent.archetype });
    return new Map(valid.map((lean) => [lean.adjustmentId, lean.version]));
  } catch {
    return new Map();
  }
}

/** The loadout's recorded equips: the equipped watchlist the card resolved, and the accepted standing leans. */
function loadoutEvents(agent, { archetypeName, characterTab, watchlist, nowMs }) {
  const events = [];
  const watchlistId = nonEmpty(agent.equippedWatchlistId);
  const watchlistMs = hubMs(agent.equippedAt);
  const card = watchlist && typeof watchlist === 'object' ? watchlist : null;
  if (watchlistId && card && card.id === watchlistId && watchlistMs !== null) {
    events.push({
      ms: watchlistMs,
      kind: ACTIVITY_KINDS.LOADOUT,
      id: `loadout:watchlist:${watchlistId}`,
      text: COPY.activity.watchlistEquipped(formatHubDayYear(watchlistMs, nowMs)),
      sub: nonEmpty(card.name) || COPY.loadout.watchlistFallback,
    });
  }
  // The Forge's Character tab is where standing leans exist for a player; without it they are not a surface.
  if (characterTab === true && Array.isArray(agent.standingLeans)) {
    const accepted = acceptedLeans(agent);
    const seen = new Set();
    for (const lean of agent.standingLeans) {
      const id = lean?.adjustmentId;
      if (typeof id !== 'string' || seen.has(id) || accepted.get(id) !== lean.version) continue;
      // The kernel keeps the FIRST pin of an id: a later copy never stands in for it, readable time or not.
      seen.add(id);
      const ms = hubMs(lean.equippedAt);
      if (ms === null) continue;
      events.push({
        ms,
        kind: ACTIVITY_KINDS.LOADOUT,
        id: `loadout:adjustment:${id}`,
        text: COPY.activity.adjustmentEquipped(formatHubDayYear(ms, nowMs)),
        sub: nonEmpty(archetypeName) || '',
      });
    }
  }
  return events;
}

/**
 * @param {object}   p
 * @param {object[]} p.battles        the window's completed documents (a ready read)
 * @param {object[]} p.live           the owner's live documents (ownedLiveList)
 * @param {Map}      p.rowsById       Games' display rows by id (completed rows carry `outcome`, every row `mode`, `opponent`)
 * @param {object|null} p.agent       the owner-masked agent document, once read
 * @param {{ id: string, name: (string|null) }|null} [p.watchlist]  the Loadout card's equipped list, once the card has found it
 *                                    among the committed lists (state `ready`); anything else leaves no watchlist row
 * @param {string|null} [p.archetypeName]
 * @param {boolean}  [p.characterTab] RELEASE3_CHARACTER_TAB_ENABLED
 * @param {number}   [p.nowMs]        the clock, for the year of a time from another year
 * @returns {{ status: 'ready', rows: object[] }}
 */
export function deriveActivity({ battles, live, rowsById, agent = null, watchlist = null, archetypeName = null, characterTab = false, nowMs }) {
  const windowDocs = (Array.isArray(battles) ? battles : []).filter((doc) => doc && typeof doc.id === 'string');
  const liveDocs = (Array.isArray(live) ? live : []).filter((doc) => doc && typeof doc.id === 'string');
  const liveIds = new Set(liveDocs.map((doc) => doc.id));
  const cutoff = cutoffOf(windowDocs);
  const rows = rowsById instanceof Map ? rowsById : new Map();
  const events = [];

  for (const doc of windowDocs) {
    // Listed once, live (Games' own rule): the record is completed, but the poll has not dropped it yet.
    if (liveIds.has(doc.id)) continue;
    const ms = hubMs(doc.completedAt);
    if (ms === null) continue;
    const row = rows.get(doc.id);
    events.push({
      ms,
      kind: ACTIVITY_KINDS.COMPLETED,
      id: `completed:${doc.id}`,
      battleId: doc.id,
      text: COPY.activity.completed,
      sub: row ? COPY.activity.completedSub(row.opponent, row.outcome?.text || '') : '',
    });
  }

  // One server document per game: the window's, replaced by the poll's own once the poll holds it (the optimistic
  // entry, which has no server time, never stands in).
  const deployable = new Map(windowDocs.map((doc) => [doc.id, doc]));
  for (const doc of liveDocs) if (doc.localOrigin !== true) deployable.set(doc.id, doc);
  for (const doc of deployable.values()) {
    const ms = hubMs(doc.activatedAt) ?? hubMs(doc.createdAt);
    if (ms === null) continue;
    const row = rows.get(doc.id);
    events.push({
      ms,
      kind: ACTIVITY_KINDS.DEPLOYED,
      id: `deployed:${doc.id}`,
      battleId: doc.id,
      text: COPY.activity.deployed,
      sub: row ? COPY.activity.deployedSub(row.mode, row.opponent) : '',
    });
  }

  if (agent && typeof agent === 'object') events.push(...loadoutEvents(agent, { archetypeName, characterTab, watchlist, nowMs }));

  const ordered = events
    .filter((event) => event.ms >= cutoff)
    .sort((a, b) => (b.ms - a.ms)
      || (KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
      || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const seen = new Set();
  const list = [];
  for (const event of ordered) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    list.push(Object.freeze({
      id: event.id,
      kind: event.kind,
      text: event.text,
      sub: event.sub,
      at: COPY.time.et(formatHubDayTime(event.ms, nowMs)),
      ms: event.ms,
      ...(event.battleId ? { battleId: event.battleId } : {}),
    }));
  }
  return Object.freeze({ status: 'ready', rows: Object.freeze(list) });
}

/** What the loadout side of the list is: still unknown (loading), failed, or settled — present or genuinely absent. */
export const LOADOUT_KNOWLEDGE = Object.freeze({ PENDING: 'pending', FAILED: 'failed', SETTLED: 'settled' });

/** The Loadout section's status and its watchlist card's state, as how much of the loadout is known. */
export function loadoutKnowledgeOf(loadout) {
  if (!loadout) return LOADOUT_KNOWLEDGE.SETTLED;
  if (loadout.status === LOADOUT_STATUS.LOADING) return LOADOUT_KNOWLEDGE.PENDING;
  if (loadout.status === LOADOUT_STATUS.ERROR) return LOADOUT_KNOWLEDGE.FAILED;
  const state = loadout.watchlist?.state;
  if (state === WATCHLIST_STATE.LOADING) return LOADOUT_KNOWLEDGE.PENDING;
  if (state === WATCHLIST_STATE.ERROR) return LOADOUT_KNOWLEDGE.FAILED;
  return LOADOUT_KNOWLEDGE.SETTLED;
}

/**
 * The Activity section (hub/hubModel.js `activity`): loading until the window's first read, `error` when that read
 * failed and nothing is retained (the window is the list's cutoff: without it no list is true), else the projection.
 * An EMPTY projection is "nothing recorded" only when the loadout is settled: while it is unknown the list is loading
 * (or failed), never empty. `windowAge` carries the age of the documents the list stands on (`asOf`, `stale`, `carried`),
 * so a list built from a kept or a failed-to-refresh window says so as Games does.
 */
export function activitySectionOf({
  battles, failed = false, live, rowsById, agent, watchlist, archetypeName, characterTab, nowMs, knowledge = LOADOUT_KNOWLEDGE.SETTLED, windowAge = null,
}) {
  if (battles === null || battles === undefined) {
    return Object.freeze({ status: failed ? 'error' : 'loading', rows: Object.freeze([]) });
  }
  const section = deriveActivity({ battles, live, rowsById, agent, watchlist, archetypeName, characterTab, nowMs });
  if (section.rows.length === 0 && knowledge !== LOADOUT_KNOWLEDGE.SETTLED) {
    return Object.freeze({ status: knowledge === LOADOUT_KNOWLEDGE.FAILED ? 'error' : 'loading', rows: section.rows });
  }
  const age = windowAge && (windowAge.stale === true || windowAge.carried === true)
    ? { asOf: windowAge.asOf ?? null, stale: windowAge.stale === true, carried: windowAge.carried === true }
    : null;
  return age ? Object.freeze({ ...section, ...age }) : section;
}
