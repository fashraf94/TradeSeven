// api/film-room/card.js
//
// Film Room B2 item 5 — POST /api/film-room/card (Build B spec §4; Amendment G
// RG-8, RG-10): the ONE door into the plays ledger. Two operations:
//
//   { op: 'create', opId, battleId, etDate, agentId,
//     moment: { situationId, symbol, fromTickSeq, toTickSeq },
//     questionId, questionVersion?, note, route }
//     → 200 { idempotent, card, open, cap }
//   { op: 'retire', opId, agentId, entryId, expectedVersion }
//     → 200 { idempotent, card }
//
// Gated (api/_utils/filmRoom/cardsGate.js): the mode off, or the owner not
// admitted → 404 { error: 'disabled' } before any read. Then, for a create,
// in this order, each a named refusal:
//   the body (api/_utils/filmRoom/cardRequest.js), before any read: ids in
//   the forge-id class and never a reserved `__id__`; the note longer than
//   S10 code points after trimming, empty, or holding a control character →
//   400, refused, never stripped; an unknown route → 400;
//   the battle: missing → 404 not_found; not the caller's → 403 forbidden;
//   the agent not the battle's → 403 forbidden; a mode the tape does not
//   cover (a tournament battle, RB-5) → 409 untaped;
//   the attribution agent (Amendment K RK-1): the agent the card is filed
//   under is the battle's attribution agent, by the platform's resolver — a
//   casual clone's parent, the battle's own agent otherwise; the request
//   still names the battle's own agent, checked above. A clone battle the
//   resolver cannot resolve → 503 attribution_unavailable, nothing written;
//   the tape day: unreadable → 503 tape_unreadable; missing, or not the
//   caller's → 404 tape_not_found; its situations unavailable (B2.1 B3,
//   Amendment H RH-6) or no stored tags → 409 tags_unavailable;
//   the moment: not one the moments helper derives from the day's STORED
//   tags.items → 409 moment_not_found; no archetype in the day's inputs → 409
//   archetype_unknown — the day's checks (sourceOfDay) run AGAIN inside the
//   create transaction on its own re-read of the tape (Amendment I RI-3);
//   the question: not on the menu for that situation and version → 400
//   question_not_on_menu;
//   the store (cardStore.js): the agent not the caller's → 403; the same op id
//   under a different request, or on an entry whose own owner is not the
//   caller (Amendment I RI-1) → 409 op_conflict; the day taped under another
//   archetype than the agent's current one → 409 archetype_changed (a card
//   would be shelved at birth); the open-card cap (S9) → 409 cap_reached,
//   naming the cap; a retire whose version does not match → 409
//   version_conflict; a shelved card → 409 shelved.
// A retire names the agent the screen knows; it is keyed on that agent's
// attribution agent the same way (RK-1), so a casual clone's card is retired
// under its parent, and an unresolvable clone → 503 attribution_unavailable.
// A rate limit rides the shared security middleware (applyRateLimit). Error
// bodies carry the code, its sentence and the caller's own ids — never
// another owner's data.
//
// RE-5: nothing here reads a meeting row; no stage rests on one.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { gateFilmRoomCardsRoute, sendCardError } from '../_utils/filmRoom/cardsGate.js';
import { parseCreateBody, parseRetireBody, questionFor, momentOfDay } from '../_utils/filmRoom/cardRequest.js';
import { createCard, replayCreate, retireCard, attributionAgentOf, CardRouteError, CARD_ROUTE_COPY } from '../_utils/filmRoom/cardStore.js';
import { readBattle, tapeRef } from '../_utils/filmTape/tapeSources.js';
import { isTieredBattle } from '../_utils/filmTape/writeTapeDay.js';

export const config = { maxDuration: 10 };

/** The per-IP window the shared middleware's limiter applies (applyRateLimit). */
export const CARD_RATE_LIMIT = Object.freeze({ limit: 10, windowMs: 60_000 });

const COPY = Object.freeze({
  not_found: 'Battle not found.',
  forbidden: 'Not authorized for this battle.',
  untaped: 'This battle mode is not taped, so it has no moments to take home.',
  tape_not_found: 'No tape for this day.',
  tape_unreadable: 'The tape for this day could not be read. Try again.',
  tags_unavailable: 'This day offers no moment: its situations were not tagged, or could not be read.',
  moment_not_found: 'That moment is not one of this day\'s stored moments.',
  // B2.1 review SPR-C-2: the day was re-tagged under another situation version between the route's read and the commit
  source_changed: 'This day\'s tape changed while the card was being filed. Nothing was filed; try again.',
  archetype_unknown: 'This day records no archetype, so no card can be filed from it.',
  question_not_on_menu: 'That question is not on the menu for this situation.',
  invalid_op: 'op must be create or retire.',
});
const refuse = (status, code, extra = {}) => new CardRouteError(status, code, COPY[code] ?? CARD_ROUTE_COPY[code] ?? code, extra);
export { sendCardError };

/** The client's request as the create fingerprint hashes it (review L1-4): what was sent, never what the server resolved. */
const requestOf = (req) => ({ battleId: req.battleId, etDate: req.etDate, agentId: req.agentId, moment: req.moment, questionId: req.questionId, questionVersion: req.questionVersion, note: req.note, route: req.route });

/**
 * The source day's checks, in order — the ONE rule the route applies to its own read and the create transaction to
 * its re-read (Amendment I RI-3): the tape is the caller's; its situations are not unavailable and it stores items
 * (B2.1 B3, Amendment H RH-6: an unavailable day offers no moment — 409 tags_unavailable); the moment is EXACTLY one
 * the moments helper derives from its stored items (409 moment_not_found); the day records its archetype (409
 * archetype_unknown). Returns the moment, its situation version and the archetype.
 */
export function sourceOfDay(tape, uid, moment) {
  if (!tape || tape.ownerId !== uid) throw refuse(404, 'tape_not_found');
  if (tape.coverage?.tags?.status === 'unavailable' || !Array.isArray(tape.tags?.items)) throw refuse(409, 'tags_unavailable');
  const found = momentOfDay(tape, moment);
  if (!found) throw refuse(409, 'moment_not_found');
  const archetypeCodeId = typeof tape.tags?.inputs?.archetypeCodeId === 'string' && tape.tags.inputs.archetypeCodeId ? tape.tags.inputs.archetypeCodeId : null;
  if (!archetypeCodeId) throw refuse(409, 'archetype_unknown');
  return { moment: found.moment, situationVersion: found.situationVersion, archetypeCodeId };
}

/** gRPC ABORTED: a transaction's contention, which the Admin SDK retries. */
const GRPC_ABORTED = 10;

/**
 * RI-3 (Astra B3) — the source moment checked again INSIDE the create transaction: the tape day re-read through the
 * transaction and held to sourceOfDay once more, and to what the route resolved (its moment, situation version and
 * archetype), so a re-write between the route's read and the commit can never file a card for a moment, a coverage or
 * a version the tape no longer holds. A tape the transaction cannot read refuses as the route's own read would —
 * except a contention abort (gRPC ABORTED), rethrown as it came so the SDK retries the transaction, as it retries every
 * other read here (review SPR-RC-1). The moment itself is pinned by sourceOfDay's exact match; what can still move
 * under it is answered by what moved (review SPR-C-2): the day's archetype → 409 archetype_changed, the store's own
 * refusal for a day taped under another archetype than the agent's; its situation version → 409 source_changed.
 */
export function verifySourceIn(db, uid, req, payload) {
  return async (tx) => {
    let tape;
    try {
      const snap = await tx.get(tapeRef(db, req.battleId, req.etDate));
      tape = snap && snap.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null;
    } catch (err) {
      if (err?.cardRoute || err?.code === GRPC_ABORTED) throw err;
      console.error('[film-room/card] tape re-read failed:', err?.message ?? err);
      throw refuse(503, 'tape_unreadable');
    }
    const again = sourceOfDay(tape, uid, req.moment);
    if (again.archetypeCodeId !== payload.archetypeCodeId) throw refuse(409, 'archetype_changed', { archetypeCodeId: again.archetypeCodeId });
    if (again.situationVersion !== payload.situationVersion) throw refuse(409, 'source_changed');
  };
}

/** The route's refusals that judge the SOURCE day — a replay of a card already filed under the op id answers instead. */
const SOURCE_REFUSALS = new Set(['tape_not_found', 'tags_unavailable', 'moment_not_found', 'archetype_unknown', 'question_not_on_menu']);

/**
 * The create operation's battle checks, in the documented order, then the battle's attribution agent (Amendment K
 * RK-1): the agent the card is filed under, resolved from the battle by the platform's resolver — never the agent the
 * client names, which must still be the battle's own. Resolved before any tape read, so a refusal of the source day
 * can still be answered by a replay under that agent (review SPR-C-3).
 */
export async function resolveCreateBattle(db, uid, req) {
  const battle = await readBattle(db, req.battleId);
  if (!battle) throw refuse(404, 'not_found');
  if (battle.ownerId !== uid) throw refuse(403, 'forbidden');
  if (battle.agentId !== req.agentId) throw refuse(403, 'forbidden');
  if (!isTieredBattle(battle)) throw refuse(409, 'untaped');
  return { battle, attributionAgentId: await attributionAgentOf(db, battle.agentId) };
}

/**
 * The create operation's source checks, in the documented order — the tape day, the moment, the question. Returns
 * the store's payload, or throws a typed refusal.
 */
export async function resolveCreateSource(db, uid, req) {
  // read directly, not through readTape (which reads a failed read as no tape — review L1-9): a tape the read could
  // not reach is 503 tape_unreadable, never "no tape for this day"
  let tape;
  try {
    const snap = await tapeRef(db, req.battleId, req.etDate).get();
    tape = snap && snap.exists ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null;
  } catch (err) {
    // the failure leaves a server trace (review R1-1): the typed 503 is not the 500 branch, which alone logs
    console.error('[film-room/card] tape read failed:', err?.message ?? err);
    throw refuse(503, 'tape_unreadable');
  }
  const found = sourceOfDay(tape, uid, req.moment);
  const { archetypeCodeId } = found;
  const question = questionFor(found.moment.situationId, req.questionId, req.questionVersion);
  if (!question) throw refuse(400, 'question_not_on_menu', { situationId: found.moment.situationId });
  return {
    archetypeCodeId,
    situationId: found.moment.situationId,
    situationVersion: found.situationVersion,
    battleId: req.battleId, etDate: req.etDate,
    symbol: found.moment.symbol, fromTickSeq: found.moment.fromTickSeq, toTickSeq: found.moment.toTickSeq,
    questionId: question.id, questionVersion: question.version,
    note: req.note, route: req.route,
  };
}

export default async function handler(req, res) {
  const gate = await gateFilmRoomCardsRoute(req, res, { methods: ['POST'], rateLimit: CARD_RATE_LIMIT });
  if (!gate) return;
  const { user } = gate;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const db = getFirebaseAdmin();
  const nowIso = new Date().toISOString();

  if (body.op === 'create') {
    try {
      const parsed = parseCreateBody(body);
      // RK-1: the card is filed, and replayed, under the battle's attribution agent — never the casual clone
      const { attributionAgentId } = await resolveCreateBattle(db, user.uid, parsed);
      let payload;
      try {
        payload = await resolveCreateSource(db, user.uid, parsed);
      } catch (err) {
        // B2.1 review SPR-C-3: a lost answer re-tapped (review L4-9) after the day changed — the source checks judge a
        // NEW card; a card already filed under this op id for this request is replayed, as createCard would
        if (!(err instanceof CardRouteError) || !SOURCE_REFUSALS.has(err.code)) throw err;
        const replay = await replayCreate(db, { uid: user.uid, agentId: attributionAgentId, opId: parsed.opId, request: requestOf(parsed) });
        if (!replay) throw err;
        return res.status(200).json({ idempotent: replay.idempotent, card: replay.card, open: replay.open, cap: replay.cap });
      }
      const out = await createCard(db, { uid: user.uid, agentId: attributionAgentId, opId: parsed.opId, payload, nowIso, request: requestOf(parsed), verifySource: verifySourceIn(db, user.uid, parsed, payload) });
      return res.status(200).json({ idempotent: out.idempotent, card: out.card, open: out.open, cap: out.cap });
    } catch (err) {
      return sendCardError(res, err, 'create');
    }
  }
  if (body.op === 'retire') {
    try {
      const parsed = parseRetireBody(body);
      // RK-1: retired under the named agent's attribution agent, where the card was filed
      const agentId = await attributionAgentOf(db, parsed.agentId);
      const out = await retireCard(db, { uid: user.uid, agentId, entryId: parsed.entryId, opId: parsed.opId, expectedVersion: parsed.expectedVersion, nowIso });
      return res.status(200).json({ idempotent: out.idempotent, card: out.card });
    } catch (err) {
      return sendCardError(res, err, 'retire');
    }
  }
  return res.status(400).json({ error: 'invalid_op', message: COPY.invalid_op });
}
