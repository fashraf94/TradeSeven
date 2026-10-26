// src/components/CommandCenter/hub/researchView.js
//
// Command Center hub, slice S6 (rulings R-S6-3 … R-S6-7; spec V1.2 §8.1, §8.2; design note points 3 and 5) — what the
// idea reader's answer means for the screen. Pure: it reads only its arguments, so a row can drive every case without a
// mock. The reader itself is hub/useHubResearch.js; this module owns the read's vocabulary, the Research panel's section,
// the admission the Loadout's labels need, "Deploying with", the honest line's choice and the Activity descriptor.
//
// ONE record, several readers of it: the panel, the Deploy card, the watchlist card's label and Activity all derive from
// the same held answer (BUILD_RULES §9), so none of them can disagree with another about what the player's idea is.
//
// "Current idea" is the PARENT POINTER (`currentVersion`), never the greatest version the hub guesses (spec §8.1). Only
// "Deploying with" looks at the newest version, because that is the one the deploy's carriage rule picks
// (api/_utils/hypothesisRecords/carriage.js): the server decides what a battle carries, and this module does not guess
// beyond that rule's common case.

import { extractTickerSymbols } from '../../../../api/_utils/watchlistEquip.js';
import { CARRIABLE_STATUSES, dueDeployPending } from '../../../constants/hypothesisRecords';
import { HORIZON_LABELS, STATUS_LABELS, formatIdeaDate, lifecycleLineFor, researchLinesOf, windowTextOf } from '../../Forge/Watchlist/ideaCopy';
import { HUB_COPY as COPY } from './hubCopy';
import { hubMs } from './hubDate';
import { IDEA_ACCESS, LOADOUT_STATUS, WATCHLIST_STATE } from './selectors/loadout';

/** The reader's states (hub/useHubResearch.js). `idle`: nothing to read — signed out, or no list equipped. */
export const RESEARCH_READ = Object.freeze({
  GATE_OFF: 'gate_off',
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  DISABLED: 'disabled',
  ERROR: 'error',
});

/** The Research section's states (spec §8.1's table, one each). */
export const RESEARCH_STATE = Object.freeze({
  GATE_OFF: 'gate_off',
  DISABLED: 'disabled',
  LOADING: 'loading',
  NO_LIST: 'no_list',
  NO_IDEA: 'no_idea',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
  READY: 'ready',
});

/**
 * Which of the four honest lines a list gets (rulings R-S6-6 and Q-S6-1; hub/hubCopy.js research.honest). `THESIS_CUT` is the
 * fourth: the list's thesis is longer than the part of it the prompt carries.
 */
export const HONEST_LINE = Object.freeze({ THESIS_IS_IDEA: 'thesis_is_idea', THESIS_SAVED: 'thesis_saved', THESIS_CUT: 'thesis_cut', NO_THESIS: 'no_thesis' });

const REVIEW_DUE = 'review_due';
const ACTIVATED = 'activated';

/**
 * How much of the list's thesis the agent's prompt carries: api/_utils/agentPromptAssembly.js sanitizeRuleText keeps its first 200
 * characters and collapses whitespace (a source tripwire in researchView.test.js reads the line). An idea longer than that is read
 * only in part, so the honest line cannot say the agent "reads the idea" as the thesis.
 */
export const PROMPT_THESIS_CAP = 200;

/**
 * The most versions the list route returns (api/_utils/hypothesisRecords/store.js LIST_LIMIT). A response that reaches it may
 * have left older versions out, so "no deployed version is review due" cannot be shown from it.
 */
export const VERSION_PAGE_MAX = 100;

const nonEmpty = (value) => (typeof value === 'string' && value.trim() !== '' ? value : null);

/**
 * Whether the server admits this player to idea records, as far as the hub knows (rulings R-S6-4, Q-S6-4 and Q-S6-8: admission
 * belongs to the ACCOUNT, not to the list on screen):
 *   - the client gate off, or the typed `disabled` answer → not admitted;
 *   - a successful answer for this owner and list (status `ready`, with its data) → admitted. A refresh in flight does not unsay
 *     it: the status stays `ready` while it is read again (`refreshing`);
 *   - otherwise the reader's `lastAnswer` — the last settled answer for this uid + authEpoch, kept in module memory across a list
 *     change, a hub remount and a failed refresh (hub/useHubResearch.js) — decides: a success → admitted, a typed `disabled` →
 *     not admitted;
 *   - with nothing remembered — loading or an error with no earlier answer, nothing to read, no reader at all — unknown. The
 *     label then goes neutral, which claims nothing.
 * This module and hub/selectors/loadout.js are the only places that produce `admitted` (hubCopy.guard.test.js).
 */
export function researchAccessOf(read) {
  if (!read || typeof read !== 'object') return IDEA_ACCESS.UNKNOWN;
  if (read.status === RESEARCH_READ.GATE_OFF || read.status === RESEARCH_READ.DISABLED) return IDEA_ACCESS.NOT_ADMITTED;
  if (read.status === RESEARCH_READ.READY && read.data) return IDEA_ACCESS.ADMITTED;
  if (read.lastAnswer === RESEARCH_READ.READY) return IDEA_ACCESS.ADMITTED;
  return read.lastAnswer === RESEARCH_READ.DISABLED ? IDEA_ACCESS.NOT_ADMITTED : IDEA_ACCESS.UNKNOWN;
}

/** The version document the parent pointer names, or null. Never another version in its place. */
export function pointerVersionOf(data) {
  if (!data || !Number.isInteger(data.currentVersion) || data.currentVersion < 1) return null;
  return (Array.isArray(data.versions) ? data.versions : []).find((v) => v?.version === data.currentVersion) ?? null;
}

/**
 * The pointer the watchlist card's label wears (BUILD_RULES §9): the reader's own `currentVersion` for the list it answered —
 * null when it says there is no idea — once it holds one. undefined when it holds nothing (then the list document's pointer stands).
 */
export function ideaPointerOf(read) {
  if (!read || !read.data || !read.listId || !Number.isInteger(read.data.currentVersion)) return undefined;
  return { listId: read.listId, version: read.data.currentVersion > 0 ? read.data.currentVersion : null };
}

/** The greatest version number the response holds — the one the deploy's carriage rule looks at first. */
function newestVersionOf(data) {
  let newest = null;
  for (const v of Array.isArray(data?.versions) ? data.versions : []) {
    if (v && Number.isInteger(v.version) && (newest === null || v.version > newest.version)) newest = v;
  }
  return newest;
}

/**
 * Which honest line this list gets (ruling R-S6-6), chosen by what the code shows reaches the agent. At every deploy
 * api/agent/decide.js reads the LIVE list document and puts its `thesis` into the prompt (decide.js:430-437 →
 * agentPromptAssembly.js:136-150); no idea-version writer touches that field. So:
 *   - no thesis on the list (blank, absent or not text) → the agent reads no idea at all;
 *   - a thesis longer than the part of it the prompt carries (more than PROMPT_THESIS_CAP characters, with something other than
 *     blanks after the cut — Q-S6-1) → the agent reads only the start of the thesis saved on the list, whatever the idea says;
 *   - a thesis that fits and IS the idea's current statement (whitespace collapsed) → the agent reads the idea as the list's thesis;
 *   - any other thesis that fits — a different text — → the agent reads the thesis saved on the list, not the idea's later versions.
 * `statement` is the current idea's recorded statement. The sanitizer's own phrase rewrites (api/_utils/agentPromptAssembly.js
 * sanitizeRuleText) are an accepted limit: they are not modelled here (Q-S6-5).
 */
export function honestLineKindOf({ thesis, statement }) {
  const saved = nonEmpty(thesis);
  if (saved === null) return HONEST_LINE.NO_THESIS;
  if (saved.slice(PROMPT_THESIS_CAP).trim() !== '') return HONEST_LINE.THESIS_CUT;
  const collapse = (text) => text.replace(/\s+/g, ' ').trim();
  return collapse(saved) === collapse(String(statement ?? '')) ? HONEST_LINE.THESIS_IS_IDEA : HONEST_LINE.THESIS_SAVED;
}

/**
 * How many of the list's names the DEPLOY keeps: the server's own filter (api/_utils/watchlistEquip.js extractTickerSymbols — trimmed,
 * upper-cased, symbol-shaped, once each). The Loadout card's count (symbolsOf) is the shells' and may be higher; this is what decides
 * whether the agent is handed the list at all (agentPromptAssembly.js emits nothing when none survives).
 */
function deployKeptNames(listDoc) {
  return listDoc && typeof listDoc === 'object' ? extractTickerSymbols(listDoc.tickers).length : 0;
}

/**
 * The honest line is said only about a list the agent can deploy with: the Loadout card has found it among the committed
 * lists (an uncommitted or deleted list is dropped at deploy — api/_utils/watchlistEquip.js resolveEquippedWatchlist) and the deploy
 * keeps at least one of its names (the prompt carries nothing for a list none of whose names survive the server's filter). That is
 * also the only time the hub holds the list document whose thesis decides the wording.
 */
function honestKindFor({ watchlist, listDoc, statement }) {
  if (!watchlist || watchlist.state !== WATCHLIST_STATE.READY || !(watchlist.count >= 1) || !listDoc || typeof listDoc !== 'object') return null;
  if (deployKeptNames(listDoc) < 1) return null;
  return honestLineKindOf({ thesis: listDoc.thesis, statement });
}

function ideaOf(version, data, listId, listName, honest) {
  const statusLabel = STATUS_LABELS[version.status] ?? null;
  const frozen = data.deployedLists && typeof data.deployedLists === 'object' ? data.deployedLists[version.version] ?? null : null;
  const savedOn = formatIdeaDate(version.createdAt);
  const since = formatIdeaDate(version.stateChangedAt);
  return Object.freeze({
    version: version.version,
    status: version.status,
    statusLabel,
    statement: typeof version.statement === 'string' ? version.statement : '',
    timeFrame: windowTextOf(version.horizonEnum) ?? HORIZON_LABELS[version.horizonEnum] ?? null,
    savedOn: savedOn ? COPY.research.savedOn(savedOn) : null,
    statusSince: since ? COPY.research.statusSince(since) : null,
    // A due idea says so in the Forge's own (blessed) words, with the frozen list it rode in; nothing is offered to act on it.
    reviewDue: version.status === REVIEW_DUE ? lifecycleLineFor(version, frozen) : null,
    research: Object.freeze(researchLinesOf(data.research, { watchlistId: listId })),
    count: COPY.research.oneIdea(listName),
    honest,
  });
}

/**
 * The Research section (spec §8.1's table).
 *
 * @param {object}      p
 * @param {object|null} p.read      the reader's answer (hub/useHubResearch.js), or null when there is no reader
 * @param {object|null} p.loadout   the Loadout section (hub/selectors/loadout.js deriveLoadout): the agent's state and the
 *                                  equipped list as the card resolved it
 * @param {object|null} p.listDoc   the equipped list's document among the committed lists, once found (its `thesis`)
 * @returns {object} { status: RESEARCH_STATE, listName, idea?, stale?, asOf?, retryNotBefore?, summary }
 */
export function deriveResearch({ read, loadout, listDoc = null }) {
  const section = (status, extra = {}) => Object.freeze({ status, ...extra });
  if (!read || read.status === RESEARCH_READ.GATE_OFF) return section(RESEARCH_STATE.GATE_OFF, { summary: COPY.research.summary.gateOff });
  if (read.status === RESEARCH_READ.DISABLED) return section(RESEARCH_STATE.DISABLED, { summary: COPY.research.summary.disabled });

  // The agent decides which list there is to ask about: nothing old-owner or old-list ever shows while it is unknown.
  const loadoutStatus = loadout?.status;
  if (!loadout || loadoutStatus === LOADOUT_STATUS.LOADING) return section(RESEARCH_STATE.LOADING, {});
  if (loadoutStatus === LOADOUT_STATUS.ERROR) return section(RESEARCH_STATE.ERROR, { summary: COPY.research.summary.error });
  const watchlist = loadoutStatus === LOADOUT_STATUS.READY ? loadout.watchlist : null;
  if (!watchlist || watchlist.state === WATCHLIST_STATE.NONE || !read.listId) return section(RESEARCH_STATE.NO_LIST, { summary: COPY.research.summary.noList });
  // The reader asks about the agent's equipped list and the card resolves that same id; an answer for another list is never shown.
  if (watchlist.id !== read.listId) return section(RESEARCH_STATE.LOADING, {});

  const listName = nonEmpty(watchlist.name) ?? COPY.research.thisList;
  const held = read.data;
  if (!held) {
    if (read.status === RESEARCH_READ.ERROR) {
      // An equipped list the committed lists do not hold (deleted, or taken back to draft) has no idea record the route will give:
      // it answers not_found, and a Retry could never succeed. That is an absence of a usable list, not a failed read.
      if (watchlist.state === WATCHLIST_STATE.UNAVAILABLE) return section(RESEARCH_STATE.NO_LIST, { summary: COPY.research.summary.noList });
      return section(RESEARCH_STATE.ERROR, { listName, summary: COPY.research.summary.error, retryNotBefore: read.retryNotBefore ?? null });
    }
    return section(RESEARCH_STATE.LOADING, { listName });
  }
  if (held.currentVersion === 0) return section(RESEARCH_STATE.NO_IDEA, { listName, summary: COPY.research.summary.noIdea, ...staleOf(read) });
  const version = pointerVersionOf(held);
  // Its Retry is drawn whether or not the answer is stale, so a press refused inside the wait is said here too.
  if (!version) return section(RESEARCH_STATE.UNAVAILABLE, { listName, summary: COPY.research.summary.pointerUnavailable, retryNotBefore: read.retryNotBefore ?? null, ...staleOf(read) });
  const honest = honestKindFor({ watchlist, listDoc, statement: version.statement });
  const idea = ideaOf(version, held, read.listId, listName, honest);
  return section(RESEARCH_STATE.READY, { listName, idea, summary: idea.statusLabel ?? COPY.research.summary.pointerUnavailable, ...staleOf(read) });
}

/** A failed refresh that kept this owner's and list's answer: the data stays, with its age and the wait before a Retry. */
function staleOf(read) {
  return read.status === RESEARCH_READ.ERROR
    ? { stale: true, asOf: read.asOf ?? null, retryNotBefore: read.retryNotBefore ?? null, refreshing: read.refreshing === true }
    : {};
}

/**
 * "Deploying with: {statement} · N names" (ruling R-S6-5; design note point 3), or null — the hub shows a line only for the
 * carriage rule's common case and never guesses beyond it:
 *   - the player is known to be admitted and the answer is current (not a refresh that failed);
 *   - the response is whole (a page at the route's limit may have left a due version out) and the deploy station's own predicate
 *     finds nothing due — `dueDeployPending(data.versions) === null` (src/constants/hypothesisRecords.js; founder ruling Q-S6-2,
 *     which loosened R-S6-5's first reading, "no deployed version is review_due"). That predicate is the carriage rule's
 *     (api/_utils/hypothesisRecords/carriage.js): an older due version does not hide the line once a newer ready or activated
 *     version exists (a reaffirm leaves the old version due for good and makes a fresh ready one), and a due newest-deployed version
 *     with nothing carriable above it does. Pinned against the real resolver in researchView.agreement.test.js;
 *   - its newest version is carriable (`ready` or `activated`) and has a statement. An `activated` version whose recorded review
 *     time has passed is not shown: the deploy judges it due and carries nothing (a battle-end review has no recorded time, and
 *     stays an accepted limit);
 *   - the Loadout card is ready for THIS list with at least one name, and N is that card's own count (symbolsOf), so the
 *     two cards cannot disagree; the deploy also keeps at least one of those names (the server's filter), or it hands the agent
 *     no list at all.
 * The newest version is the one the deploy's carriage picks (not necessarily the pointer's). `nowMs` is the clock.
 */
export function deployingWithOf({ read, watchlist, listDoc = null, nowMs = null }) {
  if (researchAccessOf(read) !== IDEA_ACCESS.ADMITTED || read.status !== RESEARCH_READ.READY) return null;
  const data = read.data;
  if (!Array.isArray(data.versions) || data.versionCount >= VERSION_PAGE_MAX) return null;
  if (!watchlist || watchlist.state !== WATCHLIST_STATE.READY || watchlist.id !== read.listId || !(watchlist.count >= 1)) return null;
  if (dueDeployPending(data.versions) !== null) return null;
  const newest = newestVersionOf(data);
  const statement = nonEmpty(newest?.statement);
  if (!newest || !CARRIABLE_STATUSES.includes(newest.status) || statement === null) return null;
  if (deployKeptNames(listDoc) < 1) return null;
  if (newest.status === ACTIVATED && typeof nowMs === 'number') {
    const dueMs = hubMs(newest.reviewDueAt);
    if (dueMs !== null && dueMs <= nowMs) return null;
  }
  return Object.freeze({ statement, count: watchlist.count, version: newest.version });
}

/**
 * Activity's idea descriptor (spec §8.2): the CURRENT idea only — the pointer's version — with the times the record holds.
 * A revision is a new version of the same idea, so there is exactly one descriptor per list, however many versions it has.
 * null with no current answer (a refresh that failed is not asserted: Activity carries no age note for it), no current idea, or a
 * pointer that matches no version (nothing is invented).
 */
export function ideaActivityOf({ read, watchlist }) {
  if (read?.status !== RESEARCH_READ.READY) return null;
  const data = read?.data;
  const version = pointerVersionOf(data);
  if (!version || !watchlist || watchlist.state !== WATCHLIST_STATE.READY || watchlist.id !== read.listId) return null;
  return Object.freeze({
    listId: read.listId,
    listName: nonEmpty(watchlist.name),
    version: version.version,
    status: version.status,
    statusLabel: STATUS_LABELS[version.status] ?? null,
    createdAt: version.createdAt ?? null,
    stateChangedAt: version.stateChangedAt ?? null,
  });
}
