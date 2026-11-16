// src/utils/filmRoomSubject.js
//
// Film Room C2 (Build C spec §5, §6; Amendment C CC-2, CC-7) — WHAT THE EXCERPT AND THE SCREEN SAY OF A MOMENT'S
// SUBJECT, from ONE pure module both import, so the agent's excerpt and the player's receipt never say different
// things (BUILD_RULES §9):
//   the SECTOR    the symbol directory's one word for a symbol (`TICKER_TO_SECTOR`, api/_utils/rankingConfig.js — the
//                 directory candleInputs.js reads, and screen code already imports): the sector's id, e.g. `XLK`.
//                 A symbol the directory lacks has no sector — none is guessed.
//   a QUOTED TEXT bounded in code points (astral characters counted once): a text over its bound is not carried at all
//                 — never cut, never rewritten — as the tape's writer leaves a meeting's diagnosis over its bound uncopied.
//                 The idea's statement is bounded at IDEA_STATEMENT_MAX here, so the excerpt and the screen hold the same
//                 statement or none.
//
//   the IDEA      the day's one carried idea (the distinct `calls[].hypothesisRef` its calls name — two is ambiguous:
//                 none), its version number with the tape's own class for it, and the version document's statement —
//                 kept only when the document is the owner's and the ref's (another owner's: no idea at all; unread or
//                 missing: the idea without its statement). ideaFrom is the ONE reading of it: the excerpt (server)
//                 and the screen (client) hand it the version document each read, and build from what it answers.
//   the SUBJECT LINE (CC-7)  "{SYM} · {sector} · under your idea '{statement, first 60 code points}' v{n}", each part
//                 only where it is held — with no carried idea the line ends after the sector. subjectLineOf is the
//                 one projection; subjectOfExcerpt reads it off an excerpt, the screen off the same inputs.
//
// Node-clean (BUILD_RULES §4): api/_utils/filmRoom/momentExcerpt.js imports it; its own test's import is the
// dependency-surface guard.

import { TICKER_TO_SECTOR } from '../../api/_utils/rankingConfig.js';
import { classOfNumber } from '../constants/filmTape.js';

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

/** The directory's one word for `symbol`'s sector — its sector id — or null when the directory lacks the symbol. */
export function sectorOf(symbol) {
  if (typeof symbol !== 'string' || !symbol || !Object.prototype.hasOwnProperty.call(TICKER_TO_SECTOR, symbol)) return null;
  const id = TICKER_TO_SECTOR[symbol];
  return typeof id === 'string' && /^\S+$/.test(id) ? id : null;
}

/**
 * The day's one carried idea: the distinct `calls[].hypothesisRef` (`watchlistId`, a positive `hypothesisVersion`) the
 * tape's calls name, with the index of the first call naming it (its number's path) — exactly one, or null.
 *
 * @returns {{ watchlistId: string, hypothesisVersion: number, i: number }|null}
 */
/** A list id the ref may name: the forge-id class, never a reserved `__id__` (a path segment both sides read by — §2 review L3-8). */
const LIST_ID = /^[A-Za-z0-9_-]{1,200}$/;
const listIdOk = (v) => typeof v === 'string' && LIST_ID.test(v) && !/^__.*__$/.test(v);

export function carriedIdeaRefOf(tape) {
  const calls = Array.isArray(tape?.calls) ? tape.calls : [];
  const found = [];
  calls.forEach((c, i) => {
    const r = isObj(c) && isObj(c.hypothesisRef) ? c.hypothesisRef : null;
    if (!r || !listIdOk(r.watchlistId) || !Number.isInteger(r.hypothesisVersion) || r.hypothesisVersion < 1) return;
    if (!found.some((f) => f.watchlistId === r.watchlistId && f.hypothesisVersion === r.hypothesisVersion)) found.push({ watchlistId: r.watchlistId, hypothesisVersion: r.hypothesisVersion, i });
  });
  return found.length === 1 ? found[0] : null;
}

/** The path of the carried idea's version number on the tape (`calls[i].hypothesisRef.hypothesisVersion`). */
export const ideaVersionPathOf = (ref) => ['calls', ref.i, 'hypothesisRef', 'hypothesisVersion'];

/**
 * THE IDEA, the one reading of it (spec §6; CC-7): from the tape's carried ref and the version document as read
 * (`doc`: the document, or null when it is missing or could not be read), for `ownerId`:
 *   no carried idea → null;
 *   a document that is not the owner's, or not the ref's list or version → null (no idea at all — never another
 *   owner's words);
 *   otherwise `{ ref, version, statement, statementAt }`: `version` the ref's number with the tape's own class for its
 *   path (`{ value, class }`, null when the tape declares none), `statement` the document's statement within
 *   IDEA_STATEMENT_MAX (null when unread, missing or over the bound), `statementAt` the document's `createdAt`.
 */
export function ideaFrom(tape, doc, ownerId) {
  const ref = carriedIdeaRefOf(tape);
  if (!ref) return null;
  if (isObj(doc) && (doc.userId !== ownerId || doc.watchlistId !== ref.watchlistId || doc.version !== ref.hypothesisVersion)) return null;
  const cls = classOfNumber(tape?.numberClasses, ideaVersionPathOf(ref));
  const statement = isObj(doc) ? boundedText(doc.statement, IDEA_STATEMENT_MAX) : null;
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
 * SUBJECT_STATEMENT_CODE_POINTS code points and quoted in single quotes; the version reads `v{n}`. No symbol: no line.
 *
 * @returns {{ symbol: string, sector: string|null, idea: { statement: string|null, version: number|null }|null, text: string }|null}
 */
export function subjectLineOf({ symbol, sector = null, idea = null } = {}) {
  if (typeof symbol !== 'string' || !symbol) return null;
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

/** The subject line a day says for `symbol`, from the tape and the version document as read — the screen's side of the same projection. */
export function subjectOfDay(tape, symbol, doc, ownerId) {
  const idea = ideaFrom(tape, doc, ownerId);
  const line = subjectLineOf({ symbol, sector: sectorOf(symbol), idea: idea ? { statement: idea.statement, version: idea.version?.value ?? null } : null });
  return line ? { line, idea } : null;
}

/**
 * The screen's subject line from the version READ's state (filmRoomData.js useIdeaVersion), so the receipt never says
 * other than the excerpt does (§2 review L3-2, L3-8):
 *   loading · error   no line yet — saying nothing is not saying something else (the excerpt would quote the statement);
 *   denied            the rules refused the version: not the owner's — no idea, as the excerpt says of another owner's;
 *   missing · idle    the idea without its statement (the excerpt's answer for a version it cannot read);
 *   ready             the document as read.
 */
export function subjectOfDayRead(tape, symbol, read, ownerId) {
  const status = read?.status ?? 'idle';
  if (status === 'loading' || status === 'error') return carriedIdeaRefOf(tape) ? null : subjectOfDay(tape, symbol, null, ownerId);
  if (status === 'denied') {
    const line = subjectLineOf({ symbol, sector: sectorOf(symbol), idea: null });
    return line ? { line, idea: null } : null;
  }
  return subjectOfDay(tape, symbol, status === 'ready' ? read.doc : null, ownerId);
}
