// src/utils/filmRoomSubject.js
//
// Film Room C2 (Build C spec §5, §6; Amendment C CC-2, CC-7) — WHAT THE EXCERPT AND THE SCREEN SAY OF A MOMENT'S
// SUBJECT, from ONE pure module both import, so the agent's excerpt and the player's receipt never say different
// things (BUILD_RULES §9):
//   the SECTOR    the symbol directory's NAME for a symbol's sector (Amendment D CD-3: `STOCK_UNIVERSE[id].name` for the
//                 id `TICKER_TO_SECTOR` gives, api/_utils/rankingConfig.js — the directory candleInputs.js reads, and
//                 screen code already imports): e.g. "Industrials", never the fund code `XLI`. A symbol the directory
//                 lacks, or a code with no name, has no sector — none is guessed.
//   a QUOTED TEXT bounded in code points (astral characters counted once): a text over its bound is not carried at all
//                 — never cut, never rewritten — as the tape's writer leaves a meeting's diagnosis over its bound uncopied.
//                 The idea's statement is bounded at IDEA_STATEMENT_MAX here, so the excerpt and the screen hold the same
//                 statement or none.
//
//   the IDEA      the idea the BATTLE carried (Amendment D CD-8): its frozen carriage's list, version and content
//                 hash, the version number `recorded` (CE-5), and the version document's statement — kept only when
//                 the document is the owner's and agrees with the carriage (another owner's, or a contradicting one:
//                 no idea at all; unread or missing: the idea without its statement). The day's calls are not read.
//                 ideaFrom is the ONE reading of it: the excerpt (server) and the screen (client) hand it the battle
//                 and the version document each read, and build from what it answers.
//   the SUBJECT LINE (CC-7)  "{SYM} · {sector} · under your idea '{statement, first 60 code points}' v{n}", each part
//                 only where it is held — with no carried idea the line ends after the sector. subjectLineOf is the
//                 one projection; subjectOfExcerpt reads it off an excerpt, the screen off the same inputs.
//
// Node-clean (BUILD_RULES §4): api/_utils/filmRoom/momentExcerpt.js imports it; its own test's import is the
// dependency-surface guard.

import { TICKER_TO_SECTOR, STOCK_UNIVERSE } from '../../api/_utils/rankingConfig.js';
import { classOfNumber } from '../constants/filmTape.js';
// Film Room C2 fix round (Amendment E, CE-1): the one prompt-bound text policy, shared with the excerpt
import { holdsIdentifier, tickerOk } from './promptBoundText.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v ? v : null);

/** CC-2: the idea's statement, at most 280 code points. */
export const IDEA_STATEMENT_MAX = 280;

/** A text's length in code points — an astral character counts once. */
export const codePointsOf = (s) => [...String(s)].length;

/**
 * THE ONE STRICT INSTANT PARSER (Build C Amendment E, CE-3): an instant as the records write one — a full ISO 8601
 * date-time with its offset or `Z` (`2026-09-23T17:45:20.000Z`, `2026-09-23T13:45:20-04:00`), on a REAL calendar date
 * and a REAL clock time — as epoch milliseconds, or null. Refused: a date alone, a time with no zone, anything looser
 * (`9/23/2026 13:30 …`, a string holding words or an id — §2 review L1-1), and every impossible value Date.parse would
 * quietly normalise (30 February, 31 April, 24:00, minute 60, second 60, an offset past 23:59 — Astra's C2-F3). Every
 * instant the excerpt carries or compares, and every tie-break by time, goes through it; nothing is inferred from a
 * time it refuses.
 */
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-](\d{2}):(\d{2}))$/;
const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const DAYS_IN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function instantMs(v) {
  if (typeof v !== 'string') return null;
  const m = ISO_INSTANT.exec(v);
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4], m[5]].map(Number);
  const s = m[6] === undefined ? 0 : Number(m[6]);
  if (mo < 1 || mo > 12 || d < 1 || d > (mo === 2 && leap(y) ? 29 : DAYS_IN[mo - 1])) return null;
  if (h > 23 || mi > 59 || s > 59) return null;
  if (m[7] !== undefined && (Number(m[7]) > 23 || Number(m[8]) > 59)) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}
/** The instant's own text when it is a strict instant (instantMs), else null — what a quotation's `at` carries. */
export const instantText = (v) => (instantMs(v) === null ? null : v);

/** `v` when it is a non-empty string of at most `max` code points; null otherwise (over the bound: not carried, never cut). */
export function boundedText(v, max) {
  return typeof v === 'string' && v.length > 0 && codePointsOf(v) <= max ? v : null;
}

/**
 * CE-1 — A QUOTATION'S WORDS, as the excerpt and the screen both carry them: within the bound (boundedText) and holding
 * no identifier — no id in `knownIds`, no shape the platform mints (promptBoundText.js) — whole, or not carried at all.
 * Never redacted, never cut (BC-1): a text that holds an id is left out entirely.
 */
export function promptQuoteText(v, max, knownIds = []) {
  const text = boundedText(v, max);
  return text !== null && !holdsIdentifier(text, knownIds) ? text : null;
}

/**
 * CE-1 — THE IDS A SUBJECT KNOWS, one rule for both sides (the excerpt's quotations, the screen's statement): the owner,
 * the battle, the battle's own agent (a clone's battle: the clone), the attribution agent (its parent); and for a card
 * the entry, the agent it is filed under, its op id, its nomination's book, id and idea, and the ids of the idea it
 * became, its result and its Forge offer (CX1-7); and the idea's own list when
 * the caller holds it (ideaFrom adds it for the statement either way). Strings only.
 */
export function subjectKnownIds({ ownerId = null, battleId = null, battleAgentId = null, attributionAgentId = null, watchlistId = null, card = null } = {}) {
  const c = isObj(card) ? card : null;
  return [ownerId, battleId, battleAgentId, attributionAgentId, watchlistId, ...(c ? [
    c.entryId, c.agentId, c.opId, c.nomination?.bookId, c.nomination?.nominationId, c.nomination?.ideaId,
    // the fix round's review, CX1-7: the idea the card became, its result and its Forge offer (cardStore.js's fields)
    c.idea?.bookId, c.idea?.ideaId, c.result?.ideaId, c.result?.resultRef, c.offer?.ideaId, c.offer?.offerId,
  ] : [])]
    .filter((v) => typeof v === 'string' && v.length > 0);
}

const own = (o, k) => isObj(o) && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
/**
 * Amendment D CD-3 — the sector is NAMED, not coded: the directory's name for `symbol`'s sector (`STOCK_UNIVERSE[id].name`,
 * e.g. "Industrials", "Consumer Discretionary"), never its fund code (`XLI` reads like another symbol beside the stock).
 * A symbol the directory lacks, or a code with no name, has no sector — none is guessed. The second argument is the
 * symbol directory (api/_utils/rankingConfig.js): `tickers` and `universe`, handed in only by a test.
 */
export function sectorOf(symbol, { tickers = TICKER_TO_SECTOR, universe = STOCK_UNIVERSE } = {}) {
  if (typeof symbol !== 'string' || !symbol || !own(tickers, symbol)) return null;
  const id = tickers[symbol];
  const name = own(universe, id) && isObj(universe[id]) ? universe[id].name : null;
  return typeof name === 'string' && name.trim() ? name : null;
}

/** A list id the carriage may name: the forge-id class, never a reserved `__id__` (a path segment both sides read by — §2 review L3-8). */
const LIST_ID = /^[A-Za-z0-9_-]{1,200}$/;
const listIdOk = (v) => typeof v === 'string' && LIST_ID.test(v) && !/^__.*__$/.test(v);

/**
 * CD-8 — WHERE THE IDEA IS: the battle's own frozen carriage, `agentContext.equippedHypothesis`, which the server wrote
 * at deploy (agentBattleService.js createAgentBattle, from the version the deploy resolved — never on a tournament
 * battle) and no client may write. Only its identity is read: the list, the version number and the content hash; never
 * its frozen statement (the statement is the version document's, read and checked below). The day's calls are not read.
 */
export const CARRIAGE_PATH = Object.freeze(['agentContext', 'equippedHypothesis']);
/** The carried version number's path on the battle document — the provenance both the excerpt and the screen bind to. */
export const IDEA_VERSION_PATH = Object.freeze([...CARRIAGE_PATH, 'hypothesisVersion']);
/**
 * CE-5 — the carried version number's TRUTHFUL provenance: `recorded`, the battle document's own value as the server
 * wrote it at deploy (the battle holds no number declaration of its own; this is that one number's, and no call path is
 * invented for it).
 */
export const CARRIAGE_NUMBER_CLASSES = Object.freeze({ 'agentContext.equippedHypothesis.hypothesisVersion': 'recorded' });

/**
 * The battle's carried idea — `{ watchlistId, hypothesisVersion, contentHash }` from its frozen carriage — or null: a
 * battle with no carriage (a tournament battle never has one), or one whose list id, version or hash is malformed.
 */
export function carriedIdeaOf(battle) {
  const ctx = isObj(battle) && isObj(battle.agentContext) ? battle.agentContext : null;
  const c = ctx && isObj(ctx.equippedHypothesis) ? ctx.equippedHypothesis : null;
  if (!c || !listIdOk(c.watchlistId) || !Number.isInteger(c.hypothesisVersion) || c.hypothesisVersion < 1 || typeof c.contentHash !== 'string' || !c.contentHash) return null;
  return { watchlistId: c.watchlistId, hypothesisVersion: c.hypothesisVersion, contentHash: c.contentHash };
}

/**
 * THE IDEA, the one reading of it (spec §6; CC-7; Amendment D CD-8 with Amendment E CE-5): from the battle's frozen
 * carriage and the version document as read (`doc`: the document, or null when it is missing or could not be read), for
 * `ownerId`:
 *   no carriage → null;
 *   a document that is another owner's, or CONTRADICTS the carriage — another list, another version number, another
 *   content hash → null: no idea at all (the carriage is server-written, so a mismatch is corruption, and nothing is said);
 *   a document missing or unread → the idea without its statement;
 *   otherwise `{ ref, version, statement, statementAt }`: `version` the carried number, `recorded` (CE-5: the battle's
 *   own value, CARRIAGE_NUMBER_CLASSES), `statement` the document's statement within IDEA_STATEMENT_MAX and holding no
 *   identifier — CE-1: none of `knownIds`, nor the owner's, nor the idea's own list, nor any id shape (promptQuoteText)
 *   — `statementAt` the document's `createdAt`.
 */
export function ideaFrom(battle, doc, ownerId, knownIds = []) {
  const ref = carriedIdeaOf(battle);
  if (!ref) return null;
  if (isObj(doc) && (doc.userId !== ownerId || doc.watchlistId !== ref.watchlistId || doc.version !== ref.hypothesisVersion || doc.contentHash !== ref.contentHash)) return null;
  const cls = classOfNumber(CARRIAGE_NUMBER_CLASSES, IDEA_VERSION_PATH);
  const statement = isObj(doc) ? promptQuoteText(doc.statement, IDEA_STATEMENT_MAX, [...knownIds, ownerId, ref.watchlistId]) : null;
  const at = isObj(doc) ? instantText(doc.createdAt) : null;
  return { ref, version: cls ? { value: ref.hypothesisVersion, class: cls } : null, statement, statementAt: statement ? at : null };
}

/** CC-7: the statement's cut on the subject line, in code points. */
export const SUBJECT_STATEMENT_CODE_POINTS = 60;
/** The first `n` code points of `text` (an astral character is never split). */
export const firstCodePoints = (text, n) => [...String(text)].slice(0, n).join('');
/** The subject line's own words — the screen's voice where the screen shows it (its copy inventory sweeps them). */
export const SUBJECT_WORDS = Object.freeze({ separator: ' · ', underIdea: 'under your idea' });

/**
 * CC-7 — THE SUBJECT LINE, the one projection: its parts, each only where held, and its text. `idea` is
 * `{ statement, version }` (either may be null) or null for no carried idea; the statement is cut to its first
 * SUBJECT_STATEMENT_CODE_POINTS code points and quoted in single quotes; the version reads `v{n}`. No symbol — or one
 * outside the ticker domain (CE-1, as the excerpt carries none) — no line.
 *
 * @returns {{ symbol: string, sector: string|null, idea: { statement: string|null, version: number|null }|null, text: string }|null}
 */
export function subjectLineOf({ symbol, sector = null, idea = null } = {}) {
  if (!tickerOk(symbol)) return null;
  const sec = str(sector);
  const statement = idea && str(idea.statement) ? firstCodePoints(idea.statement, SUBJECT_STATEMENT_CODE_POINTS) : null;
  const version = idea && Number.isInteger(idea.version) ? idea.version : null;
  // an idea holding neither its statement nor its version says nothing: no dangling "under your idea" (§2 review L3-10)
  const held = Boolean(idea) && (statement !== null || version !== null);
  const ideaText = held ? [SUBJECT_WORDS.underIdea, ...(statement !== null ? [`'${statement}'`] : []), ...(version !== null ? [`v${version}`] : [])].join(' ') : null;
  return {
    symbol,
    sector: sec,
    idea: held ? { statement, version } : null,
    text: [symbol, ...(sec ? [sec] : []), ...(ideaText ? [ideaText] : [])].join(SUBJECT_WORDS.separator),
  };
}

/** The subject line an excerpt says (momentExcerpt.js's fields) — what the receipt must say for the same card. */
export function subjectOfExcerpt(excerpt) {
  const e = isObj(excerpt) ? excerpt : {};
  return subjectLineOf({
    symbol: e.symbol?.value,
    sector: e.sector?.value ?? null,
    idea: isObj(e.idea) ? { statement: e.idea.statement?.text ?? null, version: e.idea.version?.value ?? null } : null,
  });
}

/**
 * The subject line a day says for `symbol`, from the battle's carriage (CD-8) and the version document as read — the
 * screen's side of the same projection. `knownIds`: the ids the screen holds for the excerpt it mirrors (CE-1) — the
 * battle, its agent, the attribution agent, and on a receipt the card's entry, agent, nomination and book.
 */
export function subjectOfDay(battle, symbol, doc, ownerId, knownIds = []) {
  const idea = ideaFrom(battle, doc, ownerId, knownIds);
  const line = subjectLineOf({ symbol, sector: sectorOf(symbol), idea: idea ? { statement: idea.statement, version: idea.version?.value ?? null } : null });
  return line ? { line, idea } : null;
}

/**
 * The screen's subject line from the version READ's state (filmRoomData.js useIdeaVersion), so the receipt never says
 * other than the excerpt does (§2 review L3-2, L3-8):
 *   loading · error   no line yet — saying nothing is not saying something else (the excerpt would quote the statement);
 *   denied            the rules refused the version: the line shows without the idea ("ETN · Industrials") — Amendment
 *                     E's CD-10 correction: CD-10's "no line" covered loading and failure only;
 *   missing · idle    the idea without its statement (the excerpt's answer for a version missing or unread);
 *   ready             the document as read — one that contradicts the carriage gives no idea, as the excerpt's does.
 */
export function subjectOfDayRead(battle, symbol, read, ownerId, knownIds = []) {
  const status = read?.status ?? 'idle';
  if (status === 'loading' || status === 'error') return carriedIdeaOf(battle) ? null : subjectOfDay(battle, symbol, null, ownerId, knownIds);
  if (status === 'denied') {
    const line = subjectLineOf({ symbol, sector: sectorOf(symbol), idea: null });
    return line ? { line, idea: null } : null;
  }
  return subjectOfDay(battle, symbol, status === 'ready' ? read.doc : null, ownerId, knownIds);
}
