// api/_utils/filmRoom/sourceDay.js
//
// Film Room C2 item 1 — THE DAY CHECK, ONE implementation (Build C spec Amendment C CC-4; C1 fix round F1; Amendment I
// RI-3): what a card's source day must hold, judged the same way wherever it is judged —
//   the card route's create, on its own read and again inside its transaction (api/film-room/card.js sourceOfDay,
//   verifySourceIn);
//   the card route's nominate, inside its transaction (verifyEntrySourceIn);
//   the moment excerpt (momentExcerpt.js), on its own read, for a moment and for a card.
// The judgments, in order: the tape is the caller's; its situations are not unavailable and it stores items (B2.1 B3,
// Amendment H RH-6 — an unavailable day offers no moment); the moment is EXACTLY one the moments helper derives from
// those stored items (src/utils/filmRoomMoments.js, the screen's own helper); the day records its archetype. Against
// what was filed (a card's stored archetype and situation version), the day's archetype and the moment's situation
// version must still be those.
//
// PURE but for readDayWith, which reads the one tape document through whatever reader it is handed (a transaction, or
// the plain document get) and writes nothing. Every judgment answers a verdict, never a throw: the route maps a refusal
// to its own typed error and words (card.js), and the excerpt answers null (CC-5). Nothing here imports the ledger, so
// the excerpt can import it (the one-door census; momentExcerpt's write gate).

import { momentsOf, sameMoment } from '../../../src/utils/filmRoomMoments.js';
import { tapeRef } from '../filmTape/tapeSources.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The moment `wanted` among the day's moments, as the moments helper derives
 * them from the tape's STORED tags.items — matched exactly — with the
 * situation version the stored items were tagged under. Null when the day
 * holds no such moment (a sub-range, a superset, another symbol or situation,
 * a day with no items). (Moved here from cardRequest.js, which re-exports it.)
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

/** The status each refusal of the day check answers on the card route (the route's own words go with it). */
export const DAY_REFUSAL_STATUS = Object.freeze({
  tape_not_found: 404,
  tags_unavailable: 409,
  moment_not_found: 409,
  archetype_unknown: 409,
  archetype_changed: 409,
  source_changed: 409,
});

/**
 * The day's own judgment: the tape is `uid`'s; its situations are available and stored; `moment` is exactly one of its
 * moments; it records its archetype.
 *
 * @returns {{ ok: true, moment: object, situationVersion: number|null, archetypeCodeId: string } | { ok: false, code: string }}
 */
export function judgeDay(tape, uid, moment) {
  if (!tape || tape.ownerId !== uid) return { ok: false, code: 'tape_not_found' };
  if (tape.coverage?.tags?.status === 'unavailable' || !Array.isArray(tape.tags?.items)) return { ok: false, code: 'tags_unavailable' };
  const found = momentOfDay(tape, moment);
  if (!found) return { ok: false, code: 'moment_not_found' };
  const archetypeCodeId = typeof tape.tags?.inputs?.archetypeCodeId === 'string' && tape.tags.inputs.archetypeCodeId ? tape.tags.inputs.archetypeCodeId : null;
  if (!archetypeCodeId) return { ok: false, code: 'archetype_unknown' };
  return { ok: true, moment: found.moment, situationVersion: found.situationVersion, archetypeCodeId };
}

/**
 * THE DAY CHECK against what was filed (CC-4; F1; RI-3): judgeDay, then the day's archetype must be the filed one
 * (`archetype_changed`, naming the day's) and the moment's situation version the filed one (`source_changed`).
 *
 * @param {{ moment: object, archetypeCodeId: string|null, situationVersion: number|null }} filed
 * @returns {{ ok: true, moment: object, situationVersion: number|null, archetypeCodeId: string } | { ok: false, code: string, extra?: object }}
 */
export function judgeFiledDay(tape, uid, { moment, archetypeCodeId, situationVersion }) {
  const day = judgeDay(tape, uid, moment);
  if (!day.ok) return day;
  if (day.archetypeCodeId !== archetypeCodeId) return { ok: false, code: 'archetype_changed', extra: { archetypeCodeId: day.archetypeCodeId } };
  if (day.situationVersion !== situationVersion) return { ok: false, code: 'source_changed' };
  return day;
}

/**
 * The tape day `agentBattles/{battleId}/tape/{etDate}`, read ONCE through `reader` — a transaction (`tx.get`) or the
 * plain document get (`{ get: (ref) => ref.get() }`). Null when it does not exist; a failed read throws as it came, for
 * the caller to answer.
 */
export async function readDayWith(reader, db, battleId, etDate) {
  const snap = await reader.get(tapeRef(db, battleId, etDate));
  return snap && snap.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null;
}
