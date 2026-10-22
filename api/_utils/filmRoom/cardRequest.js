// api/_utils/filmRoom/cardRequest.js
//
// Film Room B2 item 5 — THE REQUEST BOUNDARY of POST /api/film-room/card
// (Build B spec §4; Amendment G RG-8): the body parsed into a typed request,
// and the checks a card must pass before the store sees it —
//   the NOTE: the player's words, verbatim; at most S10 characters (code
//   points) after trimming; a control character is REFUSED, never stripped;
//   the QUESTION: on the menu (src/data/situationQuestions.js) for the
//   moment's situation and version;
//   the MOMENT: one the moments helper derives from the tape day's stored
//   tags.items — the same helper the screen lists with
//   (src/utils/filmRoomMoments.js), matched exactly (sameMoment), so a card
//   can never point at a moment the tagger did not find.
// Pure: no Firestore here. Every refusal is a typed error the route answers
// 400 (an input) or 409 (a fact of the record) with its code — and no other
// owner's data.

import { isValidForgeId, FORGE_ID_REGEX, FORGE_ID_MAX_LEN } from '../idValidation.js';
import { SITUATION_QUESTIONS } from '../../../src/data/situationQuestions.js';
import { CARD_SLOTS } from '../../../src/data/cardSlots.js';
import { momentsOf, sameMoment } from '../../../src/utils/filmRoomMoments.js';
import { isEtDate } from '../../../src/utils/tapeSchedule.js';
import { CARD_ROUTES } from './cardStore.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;

/** A typed input failure: the route answers 400 `{ error: code, message }`. */
export class CardInputError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
    this.cardInput = true;
  }
}
const bad = (code, message) => new CardInputError(code, message);

/** S10 — the note's length, in code points, after trimming. */
export const NOTE_MAX_CHARS = CARD_SLOTS.S10.noteMaxChars;
/**
 * Any control character — Unicode category Cc: C0 (U+0000–U+001F, a newline included), DEL and C1 (U+0080–U+009F)
 * — anywhere in the trimmed note is refused, never stripped (review L1-5 / L2-5: C1 passed the first cut).
 */
export const CONTROL_CHAR = /\p{Cc}/u;
/** Firestore reserves document ids of the form `__…__`; they pass the forge-id class, so they are refused here (review L2-6). */
const RESERVED_ID = /^__.*__$/;

/** The number of characters a note holds as S10 counts them: code points, after trimming. */
export const noteLength = (note) => [...String(note ?? '').trim()].length;

/**
 * The note as it will be stored: trimmed, non-empty, at most S10 code points,
 * free of control characters. Anything else is refused with its reason.
 */
export function normalizeNote(raw) {
  if (typeof raw !== 'string') throw bad('note_required', 'note must be a string.');
  const note = raw.trim();
  if (!note) throw bad('note_empty', 'note must hold some words.');
  if (CONTROL_CHAR.test(note)) throw bad('note_control_char', 'note holds a control character; it is refused, not stripped.');
  if ([...note].length > NOTE_MAX_CHARS) throw bad('note_too_long', `note must be at most ${NOTE_MAX_CHARS} characters after trimming.`);
  return note;
}

/** A caller-supplied op id (a client UUID): the forge-id character class, and never a reserved `__…__` id (it becomes the entry's id). */
export function requireOpId(raw) {
  if (!isValidForgeId(raw) || RESERVED_ID.test(raw)) throw bad('invalid_op_id', `opId must match ${FORGE_ID_REGEX}, be ≤${FORGE_ID_MAX_LEN} chars and not be a reserved __id__.`);
  return raw;
}

const requireId = (raw, code, name) => {
  if (!isValidForgeId(raw) || RESERVED_ID.test(raw)) throw bad(code, `${name} must match ${FORGE_ID_REGEX}, be ≤${FORGE_ID_MAX_LEN} chars and not be a reserved __id__.`);
  return raw;
};
const seqOrNull = (v, name) => {
  if (v === null || v === undefined) return null;
  if (!Number.isInteger(v) || v < 0) throw bad('invalid_moment', `${name} must be a non-negative integer or null.`);
  return v;
};

/** The route: one of the three, as sent. */
export function requireRoute(raw) {
  if (!CARD_ROUTES.includes(raw)) throw bad('invalid_route', `route must be one of ${CARD_ROUTES.join(', ')}.`);
  return raw;
}

/**
 * A create request, typed: `{ opId, battleId, etDate, agentId, moment, questionId, questionVersion, note, route }`.
 * `questionVersion` is optional; when sent it must be the menu's.
 */
export function parseCreateBody(body) {
  const b = isObj(body) ? body : {};
  const opId = requireOpId(b.opId);
  const battleId = requireId(b.battleId, 'invalid_battle_id', 'battleId');
  const agentId = requireId(b.agentId, 'invalid_agent_id', 'agentId');
  if (!isEtDate(b.etDate)) throw bad('invalid_et_date', 'etDate must be a YYYY-MM-DD date.');
  const m = isObj(b.moment) ? b.moment : null;
  if (!m || typeof m.situationId !== 'string' || !m.situationId || typeof m.symbol !== 'string' || !m.symbol) throw bad('invalid_moment', 'moment must name a situationId and a symbol.');
  const moment = { situationId: m.situationId, symbol: m.symbol, fromTickSeq: seqOrNull(m.fromTickSeq, 'moment.fromTickSeq'), toTickSeq: seqOrNull(m.toTickSeq, 'moment.toTickSeq') };
  if (typeof b.questionId !== 'string' || !b.questionId) throw bad('invalid_question', 'questionId must be a menu id.');
  let questionVersion = null;
  if (has(b, 'questionVersion')) {
    if (!Number.isInteger(b.questionVersion) || b.questionVersion < 1) throw bad('invalid_question', 'questionVersion must be a positive integer.');
    questionVersion = b.questionVersion;
  }
  const note = normalizeNote(b.note);
  const route = requireRoute(b.route);
  return { opId, battleId, etDate: b.etDate, agentId, moment, questionId: b.questionId, questionVersion, note, route };
}

/** A retire request, typed: `{ opId, agentId, entryId, expectedVersion }`. */
export function parseRetireBody(body) {
  const b = isObj(body) ? body : {};
  const opId = requireOpId(b.opId);
  const agentId = requireId(b.agentId, 'invalid_agent_id', 'agentId');
  const entryId = requireId(b.entryId, 'invalid_entry_id', 'entryId');
  if (!Number.isInteger(b.expectedVersion) || b.expectedVersion < 1) throw bad('invalid_expected_version', 'expectedVersion must be a positive integer.');
  return { opId, agentId, entryId, expectedVersion: b.expectedVersion };
}

/**
 * The menu entry for a question of `situationId` — null when the id is not on
 * the menu for that situation, or when a sent `questionVersion` is not the
 * menu's current version for it.
 */
export function questionFor(situationId, questionId, questionVersion = null) {
  const q = SITUATION_QUESTIONS.find((x) => x.id === questionId && x.situationId === situationId) ?? null;
  if (!q) return null;
  if (questionVersion !== null && questionVersion !== q.version) return null;
  return q;
}

/**
 * The moment `wanted` among the day's moments, as the moments helper derives
 * them from the tape's STORED tags.items — matched exactly — with the
 * situation version the stored items were tagged under. Null when the day
 * holds no such moment (a sub-range, a superset, another symbol or situation,
 * a day with no items).
 *
 * @returns {{ moment: object, situationVersion: number|null }|null}
 */
export function momentOfDay(tape, wanted) {
  const items = Array.isArray(tape?.tags?.items) ? tape.tags.items : null;
  if (!items) return null;
  const moment = momentsOf(items).find((m) => sameMoment(m, wanted)) ?? null;
  if (!moment) return null;
  const first = items.find((i) => isObj(i) && i.situationId === moment.situationId && i.symbol === moment.symbol && (moment.fromTickSeq === null ? true : i.tickSeq === moment.fromTickSeq));
  const situationVersion = Number.isInteger(first?.version) ? first.version : null;
  return { moment, situationVersion };
}
