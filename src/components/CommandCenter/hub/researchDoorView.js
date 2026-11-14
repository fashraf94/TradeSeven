// src/components/CommandCenter/hub/researchDoorView.js
//
// Command Center core spec V1.2, Amendment E V1.1 §1, §3.1, §3.2 — the research door's pure view. Everything here is a
// projection of what the hub already holds; nothing reads, waits or listens.
//
//   admissionBattleIdOf   the agentBattles id the admission hook hands the cockpit-status verdict at 'allowlist': the owned
//                         live list first (selectors/readerInputs.js ownedLiveList: App's agentBattles poll, owner-filtered,
//                         training clones dropped), then the completed window (hub/useHubCompletedBattles.js, an agentBattles
//                         query by ownerId), and only while that window is this owner's and epoch's. Nothing is read to find one.
//   researchDoorOf        the Research panel's door block from the research reader's answer: loading (no line, the door
//                         shows), error (the line and Retry, the door stays) or ready, with the newest open investigation's
//                         line and its session id for Continue — or no line. Finding nothing open is never "no research":
//                         the read is bounded (src/services/sharedResearchRecords.js).
//   researchRecordsOf     the records Activity's research rows are built from, once the reader holds them.
//   equippedBookLabelOf   the sheet's equippedListLabel with per-game loadouts on: the BaggerBomb book's name exactly as the
//                         Loadout card shows it (hub/perGameLoadoutModel.js bookViewOf), or null without a book.
//   equippedWatchlistLabelOf  the same with per-game loadouts off: the equipped watchlist's name as the watchlist card has
//                         resolved it, or null.

import { formatHubDayTime } from './activityDates';
import { HUB_COPY as COPY } from './hubCopy';
import { hubMs } from './hubDate';
import { LOADOUT_STATUS, WATCHLIST_STATE } from './selectors/loadout';

/** The door's three states (amendment §3.1). */
export const RESEARCH_DOOR_STATUS = Object.freeze({ LOADING: 'loading', READY: 'ready', ERROR: 'error' });

const nonEmpty = (value) => (typeof value === 'string' && value.trim() !== '' ? value : null);
const idOf = (battle) => (battle && typeof battle === 'object' ? nonEmpty(battle.id) : null);

/**
 * @param {object}   p
 * @param {object[]} p.live       the readers' owned live list (useHubReaders' `liveBattles`)
 * @param {object|null} p.completed  the readers' completed input (selectors/readerInputs.js completedInputOf)
 * @param {object|null} p.auth    the readers' auth input
 * @returns {string|null}
 */
export function admissionBattleIdOf({ live, completed, auth }) {
  if (!auth || auth.signedIn !== true || typeof auth.uid !== 'string') return null;
  for (const battle of Array.isArray(live) ? live : []) {
    if (battle?.ownerId === auth.uid && idOf(battle)) return idOf(battle);
  }
  if (!completed || completed.ownerUid !== auth.uid || completed.ownerEpoch !== auth.authEpoch) return null;
  for (const battle of Array.isArray(completed.rows) ? completed.rows : []) {
    if (battle?.ownerId === auth.uid && idOf(battle)) return idOf(battle);
  }
  return null;
}

/** A Shared Research record's investigation id: its host session's id (the record is minted with host { sharedResearchSessions, sessionId }). */
export function sessionIdOf(record) {
  return record && typeof record === 'object' && record.host && typeof record.host === 'object' ? nonEmpty(record.host.id) : null;
}

/** The records the reader holds for this owner (its answer, kept through a failed refresh), else null. */
export function researchRecordsOf(read) {
  return read && read.status === 'ready' && Array.isArray(read.records) ? read.records : null;
}

/**
 * @param {object} p
 * @param {object} p.read   the research reader's `read` ({ status, records })
 * @param {number} p.nowMs  the clock, for the year of a last update from another year
 * @returns {{ status: string, progress: ({ sessionId: string, findings: number, line: string })|null }}
 */
export function researchDoorOf({ read, nowMs }) {
  const records = researchRecordsOf(read);
  if (!records) {
    const status = read?.status === 'error' ? RESEARCH_DOOR_STATUS.ERROR : RESEARCH_DOOR_STATUS.LOADING;
    return Object.freeze({ status, progress: null });
  }
  // The query answers newest first: the first open record is the newest open investigation.
  const open = records.find((record) => record?.state === 'open' && sessionIdOf(record));
  if (!open) return Object.freeze({ status: RESEARCH_DOOR_STATUS.READY, progress: null });
  const findings = Array.isArray(open.findings) ? open.findings.length : 0;
  const lastMs = hubMs(open.telemetry?.lastTurnAt);
  const time = lastMs === null ? '' : formatHubDayTime(lastMs, nowMs);
  const line = time ? COPY.research.door.inProgress(COPY.time.et(time), findings) : COPY.research.door.inProgressCount(findings);
  return Object.freeze({ status: RESEARCH_DOOR_STATUS.READY, progress: Object.freeze({ sessionId: sessionIdOf(open), findings, line }) });
}

/** Per-game loadouts on: the BaggerBomb card's book name (hub/perGameLoadoutContext.js cardsOf), or null with no book. */
export function equippedBookLabelOf(cards) {
  const book = cards?.baggerbomb?.book;
  return book && nonEmpty(book.id) ? nonEmpty(book.name) : null;
}

/** Per-game loadouts off: the equipped watchlist's name as the card resolved it, or null until the card has found it. */
export function equippedWatchlistLabelOf(loadout) {
  if (loadout?.status !== LOADOUT_STATUS.READY || loadout.watchlist?.state !== WATCHLIST_STATE.READY) return null;
  return nonEmpty(loadout.watchlist.name) || COPY.loadout.watchlistFallback;
}
