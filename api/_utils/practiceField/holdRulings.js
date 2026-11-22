// api/_utils/practiceField/holdRulings.js
//
// Practice Field T1a-2b-3 — THE FOUNDER'S RESOLUTION OF A HOLD THE DATA WILL NEVER CLEAR (Amendment F-5; T1a-2a Q-U,
// C-6). The founder action `resolve_hold` (founderControls.js) names the EXACT record it covers and a ruling; it writes
// the ruling on the idea (`founderRulings`), in its own transaction, and nothing else. The idea book's NEXT OBSERVED
// CLOSE applies it, once, before anything else of that close (applyFounderRulings), and retires the record:
//
//   suspicion     (a gap-screen record `suspected_split_SYM_<suspectedOn>`)
//     price_move  the move was real. The record is retired (its history names the ruling); everything it held is
//                 released, to be paid ONCE on the current count. The ruling covers EXACTLY the recorded move: the move
//                 from the price seen at the record's session to the last price seen while it stood is judged by the
//                 screen (ledger.js priceMoveReference) — a split-shaped one is a NEW record (a second halving while it
//                 stood, review B1; a recovery it hid, Z1) — and the gap screen's reference becomes the last price seen
//                 (or, with a new record, the ruled session's), kept beside the mark as `screenReference`: the mark and
//                 its provenance are not touched (review D1). A later split-shaped gap, an identical one included, is a
//                 new record (Z1); a split dated after the reference divides it and re-suspects nothing (Y4, B3); a later
//                 move is judged against it (N3).
//     split       a split of the founder's ratio — which must match the move the record still stands for (its recorded
//                 move less what rows applied since inside its gap account for: review D5; none left is refused) —
//                 dated the session the move was first seen, with a founder receipt, under its own id (the record's
//                 split id, or `founder_…` when the feed already settled that one: review D6). At the next close it is
//                 applied ONCE on each ledger whose record still stands, after this close's rows in date order — a row
//                 that explains the record first leaves it moot (review B2), and a ledger without the record never
//                 takes it (B5) — and it explains (and retires) the record in the ordinary way. A ruling applied
//                 nowhere is closed as moot, with an alert, and the founder may rule again.
//   conflict      (an unsettled `conflicting_action` receipt, or a `possible_redate` one — F-7)
//     payload     one recorded payload: applied once, in date, phase and id order, replacing whatever rows of that id the
//                 feed lists — also when the feed has dropped the conflict (C-6);
//     none        the id is declined on every ledger that records it (`founder_ruled_none`).
//   coverage_gap  (an open `ca_coverage_gap_SYM_<since>`, F-1)
//     no_action   there was no action in the gap's dates: the doubt clears — the symbol's data counts as covered through
//                 the gap's last session, so this close's own data covers it from there;
//     row         one recorded backfill row (`practiceFieldCaBackfill/{SYM}`) is applied once, and the doubt clears. An id
//                 the backfill lists with two payloads needs the founder's `payload`, and only its row is taken (C-2). A
//                 failed backfill's rows may be taken under the same rule; a row it could not read is one more payload of
//                 its id (Q-18). A `ratio` beside a coverage-gap ruling is refused (400; closeout refuter RX-1).
//
// A ruling that cannot be applied at that close — its action held behind another doubt — stays pending and is applied
// at the first close that can (`appliedOn` names it). Every ruling records who, when, the request key and the record.
//
// Pure. The store's reads and writes are founderControls.js's and close.js's.

import {
  cloneLedger, suspicionIdOf, ratioMatchesMove, residualMoveOf, priceMoveReference, CONFLICTING_ACTION, POSSIBLE_REDATE, actionIdOf as deriveActionId,
  recordedPayloadsOf, openRulingRevisions, REVISED_AFTER_RULING,
} from './ledger.js';
import { coverageGapIdOf, closedDoubtIdOf, CA_CLOSED_DOUBT, successfulBackfill } from './dailyCoverage.js';
import { roundShares } from '../mandateRounding.js';
import { ADJUSTMENT_KIND, correctShareBasisOn, postedAdjustments, pairingCandidatesOf } from './adjustments.js';

const SHARE_BASIS = new Set(['split', 'reverse_split', 'stock_distribution']);

// (T1a-2b-4 fix round, L-1: `late_adjustment` — the founder approves or declines ONE late proposal of an open idea.)
export const HOLD_KINDS = Object.freeze(['suspicion', 'conflict', 'coverage_gap', 'late_adjustment']);
const DECISIONS = Object.freeze({ suspicion: ['price_move', 'split'], conflict: ['payload', 'none'], coverage_gap: ['no_action', 'row'], late_adjustment: ['approve', 'decline'] });
/** L-2: why an approval is refused (409), by the blocker it meets. */
export const LATE_REFUSAL = Object.freeze({
  id_unresolved: 'late_id_unresolved', pairs_with: 'late_pairs_with_candidate', share_basis_unresolved: 'late_share_basis_unresolved', date_uncovered: 'late_date_uncovered',
});
const LEDGERS = ['ledger', 'comparisonLedger', 'spyLedger'];
const upper = (s) => String(s || '').trim().toUpperCase();
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const settledIdsOf = (ledger) => new Set([...(ledger?.appliedActionIds || []), ...(ledger?.declinedActionIds || [])]);
const pendingRulings = (idea) => (idea?.founderRulings || []).filter((r) => r && r.appliedOn == null);

/**
 * The payload a conflict ruling may choose: one the record holds (a conflict's rows; a possible re-date's rows). Every
 * economic field a row can carry — a delisting's cash per share and a ticker change's target too (AR2-A-4: compared on
 * ratio and amount only, every delisting and rename payload read {null, null}, any choice matched the first row, and the
 * ruling then applied a cashless delisting, or nothing, and locked its record).
 */
const payloadOf = (row) => ({
  ratio: row?.ratio ?? null, amount: row?.amount ?? null,
  ...(row?.cashPerShare != null ? { cashPerShare: row.cashPerShare } : {}),
  ...(row?.renamedTo != null ? { renamedTo: upper(row.renamedTo) } : {}),
});
const samePayload = (a, b) => (a?.ratio ?? null) === (b?.ratio ?? null) && (a?.amount ?? null) === (b?.amount ?? null)
  && (a?.cashPerShare ?? null) === (b?.cashPerShare ?? null) && (a?.renamedTo != null ? upper(a.renamedTo) : null) === (b?.renamedTo != null ? upper(b.renamedTo) : null);
/**
 * T1a-2b-4 closeout (the founder's C-2, 21 Nov 2026; Astra T2E-R03): THE ONE ROW a `coverage_gap` / `row` ruling takes.
 * `candidates` are the stored refetch's rows of the requested id within the record's dates. An id names a type, a ticker
 * and a date — never a payload — so a refetch can hold two rows of one id with different payloads (a 5/4 and a 2/1 split),
 * and the first one listed used to win, whatever the founder named. Now, compared as a conflict ruling compares them
 * (payloadOf, samePayload):
 *   - a payload the founder names takes ONLY a row carrying exactly it — none does: 422 (even when the row is unique);
 *   - with none named, the id must carry ONE distinct payload — two or more: 422, while the doubt stands.
 * Q-18 (the founder, 21 Nov 2026; refuter RX-3): the same one rule wherever a row ruling is taken. A row of the id the
 * refetch SAW BUT COULD NOT READ (`report`, the stored refetch's parse report: unreadableRowsOf) is one more payload the
 * id carries — one no request can name — so with it the founder must name the readable payload taken.
 * @returns {{ row: object } | { error: string, status: number }}
 */
function rowOfNamedPayload(candidates, payload, report = null) {
  if (candidates.length === 0) return { error: 'row_not_recorded', status: 422 };
  if (payload !== null && payload !== undefined) {
    if (!isPlain(payload)) return { error: 'payload_invalid', status: 400 };
    const named = candidates.find((x) => samePayload(payloadOf(x), payloadOf(payload)));
    return named ? { row: named } : { error: 'payload_not_recorded', status: 422 };
  }
  const distinct = [];
  for (const x of candidates) if (!distinct.some((p) => samePayload(p, payloadOf(x)))) distinct.push(payloadOf(x));
  const unread = unreadableRowsOf(report, candidates[0]);
  return distinct.length + unread === 1 ? { row: candidates[0] } : { error: 'row_payload_ambiguous', status: 422 };
}

/**
 * Q-18: how many rows of `action`'s id the refetch's parse report shows it could not read — a rejected row of the id's
 * leg dated its date, or undated (it could be any date); a leg whose envelope was not a list counts once (its rows are
 * unknown). A report that is missing knows of none. Pure.
 */
function unreadableRowsOf(report, action) {
  const leg = action?.type === 'cash_dividend' ? 'dividends' : (action?.type === 'split' || action?.type === 'reverse_split') ? 'splits' : null;
  if (!leg || !isPlain(report)) return 0;
  const dated = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d);
  const rejected = (Array.isArray(report.rejects) ? report.rejects : [])
    .filter((r) => r?.leg === leg && (!dated(r?.row?.date) || r.row.date.slice(0, 10) === action.effectiveDate)).length;
  return rejected + (report.legs?.[leg]?.envelope === 'not_a_list' ? 1 : 0);
}
/** The economic fields of a chosen payload, as an action carries them. */
const payloadFields = (p) => ({
  ...(p?.ratio != null ? { ratio: p.ratio } : {}), ...(p?.amount != null ? { amount: p.amount } : {}),
  ...(p?.cashPerShare != null ? { cashPerShare: p.cashPerShare } : {}), ...(p?.renamedTo != null ? { renamedTo: p.renamedTo } : {}),
});
/** Is `actionId` ambiguous on any ledger of the idea (an open conflict or possible re-date record; rev 1, S-2)? */
const ambiguousOnIdea = (idea, actionId) => openActionRecords(idea, actionId).length > 0;

/**
 * Astra T2D-10: CAN A RATIO BE APPLIED on these ledgers' holdings of `sym`? A ratio the applier would round a holding to
 * nothing on (or one it refuses) is a choice the close could never apply: it is refused up front (`ruling_unrepresentable`)
 * instead of being recorded, where it would lock its record for good. (The close still closes, with its reason, a ruling
 * whose holding has changed by then — markRulingsApplied.)
 */
function unrepresentableOn(idea, fields, sym, ratio) {
  if (ratio == null) return false;
  const r = Number(ratio);
  if (!(Number.isFinite(r) && r > 0)) return true;
  return fields.some((f) => {
    const h = idea?.[f]?.holdings?.[sym];
    return h != null && !(roundShares((Number(h.shares) || 0) * r) > 0);
  });
}

/**
 * The ledgers of an idea whose OPEN conflict or possible re-date record is `recordId`: [field, receipt]. Amendment F
 * rev 1: a conflict on an action the holding was not entitled to is ambiguous like any other — only a ruling settles it
 * (a `payload` ruling on it is then declined as not entitled by the applier; `none` declines it).
 */
function openActionRecords(idea, recordId) {
  const out = [];
  for (const f of LEDGERS) {
    const l = idea?.[f];
    if (!l) continue;
    const settled = settledIdsOf(l);
    for (const r of l.corporateActionReceipts || []) {
      if (r?.actionId !== recordId || (r.reason !== CONFLICTING_ACTION && r.reason !== POSSIBLE_REDATE)) continue;
      if (!settled.has(recordId)) out.push([f, r]);
    }
  }
  return out;
}

/**
 * A-5 (the founder's ruling, 21 Nov 2026; Astra T2E-C05): the ledgers of an idea whose holding carries a REFUSED SHARE-BASIS
 * RECORD of `recordId` — a split, reverse split or stock distribution the applier cannot apply (it would round the holding to
 * nothing, a ratio it refuses, no entitlement data): `heldActions` with `refused`, never replayed (ledger.js). It holds the
 * holding's count, and so its sale, for good: before this ruling nothing could answer it (404). [field, record].
 */
function refusedActionRecords(idea, recordId) {
  const out = [];
  for (const f of LEDGERS) {
    const l = idea?.[f];
    if (!l || settledIdsOf(l).has(recordId)) continue;
    for (const [sym, h] of Object.entries(l.holdings || {})) {
      for (const r of h?.heldActions || []) if (r?.actionId === recordId && typeof r.refused === 'string' && SHARE_BASIS.has(r.type)) out.push([f, { ...r, symbol: upper(sym) }]);
    }
  }
  return out;
}

/**
 * Amendment F rev 1, S-2: WHAT A RULING SETTLED on a ledger for `recordId` — `'none'` (declined by the founder), or the
 * payload it applied (or chose and the applier declined as not entitled) — or null when no conflict ruling settled it.
 */
function ruledOutcomeOn(ledger, recordId) {
  for (const r of ledger?.corporateActionReceipts || []) {
    if (r?.actionId !== recordId || !r.founderRuling) continue;
    if (r.reason === 'founder_ruled_none') return 'none';
    if (r.applied === true || r.reason === 'not_entitled') return payloadOf(r);
  }
  return null;
}

/**
 * T1a-2b-4 (T2D-05): THE OUTCOME IN FORCE for a settled id on a ledger — the founder's (ruledOutcomeOn), else the payload
 * the FEED settled it with (an applied receipt, or a late entitlement); a founder's later CORRECTION of it (a posted
 * ruled_correction adjustment) is the outcome then. Null when nothing settled it there.
 */
function settledOutcomeOn(ledger, recordId) {
  let outcome = ruledOutcomeOn(ledger, recordId);
  if (outcome === null) {
    // (A HISTORY-ONLY receipt too — review AR4-A-3 / AR4-C-6: on a holding since closed, the history-only split IS what the
    // feed settled the id with; skipped, no outcome was in force and every answer to its revision was refused.)
    const r = (ledger?.corporateActionReceipts || []).find((x) => x?.actionId === recordId && x.applied === true);
    if (r) outcome = payloadOf(r);
    else {
      const a = postedAdjustments(ledger).find((x) => x.actionId === recordId && x.kind === ADJUSTMENT_KIND.LATE_ENTITLEMENT);
      if (a) outcome = payloadOf({ amount: a.amountPerShare });
    }
  }
  if (outcome === null || outcome === 'none') return outcome;
  const corrections = postedAdjustments(ledger).filter((x) => x.actionId === recordId && x.kind === ADJUSTMENT_KIND.RULED_CORRECTION && x.payload);
  return corrections.length > 0 ? payloadOf(corrections[corrections.length - 1].payload) : outcome;
}

/** T1a-2b-4: was `recordId` settled on the ledger WITH its payload — an applied receipt (history-only included) or a late
 *  entitlement — as opposed to declined (not entitled, or `none`)? Pure. */
function movedOn(ledger, recordId) {
  if ((ledger?.corporateActionReceipts || []).some((x) => x?.actionId === recordId && x.applied === true)) return true;
  return postedAdjustments(ledger).some((x) => x.actionId === recordId && x.kind === ADJUSTMENT_KIND.LATE_ENTITLEMENT);
}

/** A ruling's receipt, as the actions and adjustments it supplies carry it (`founderRuling`, an adjustment's `ruling`). */
export const rulingReceiptOf = (r) => ({ requestKey: r.requestKey, kind: r.kind, recordId: r.recordId, decision: r.decision, by: r.by, at: r.at, ...(Array.isArray(r.seen) ? { seen: r.seen } : {}), ...(r.corrects === true ? { corrects: true, payload: r.payload, from: r.from ?? null } : {}) });

// (T1a-2b-4 fix round, L-8: pendingAmountCorrections and markCorrectionsApplied are gone — a resulted idea posts nothing;
// a correction a doubt left pending at its last close is named on it, `lateDataUnsettled`, and alerted.)

/**
 * T1a-2b-4 fix round (L-2): WHY THE FOUNDER'S APPROVAL OF PROPOSAL `p` ON LEDGER `f` IS REFUSED NOW, or null — from the idea
 * as stored, and the blockers the proposal's last close named:
 *   late_id_unresolved           the id has an open conflict, re-date or revision on the ledger, or a row of it waits;
 *   late_pairs_with_candidate    another candidate of the symbol pairs with it under the re-date rule: recorded as a
 *                                possible re-date of it, or any open candidate of its type and payload within the window
 *                                (pairingCandidatesOf — fix-round refuter R-1, R-3);
 *   late_share_basis_unresolved  a share-basis id of the symbol dated within the holding is unresolved on any ledger
 *                                (an open ambiguity, a held action, an open suspicion, a waiting row);
 *   late_date_uncovered          a date in the holding interval is uncovered (a coverage gap of the symbol, or a closed
 *                                holding's rejected row — T2E-08).
 * A debit larger than the cash is not a refusal: approved, it posts once the cash is there. Pure.
 */
export function lateApprovalRefusal(idea, f, p) {
  const l = idea?.[f];
  const sym = upper(p?.ticker);
  const id = p?.actionId;
  const settled = settledIdsOf(l);
  const openOn = (ledger, r) => ((r.reason === CONFLICTING_ACTION || r.reason === POSSIBLE_REDATE) && !settledIdsOf(ledger).has(r.actionId)) || (r.reason === REVISED_AFTER_RULING && r.closedBy == null);
  const receipts = l?.corporateActionReceipts || [];
  const stored = (prefix) => (p?.blockers || []).some((b) => String(b).startsWith(`${prefix}:`));
  if (stored('id_unresolved') || receipts.some((r) => r?.actionId === id && openOn(l, r)) || (l?.closedHeldRows || []).some((r) => r.actionId === id)) return LATE_REFUSAL.id_unresolved;
  // (Fix-round refuter R-1, R-3: any open candidate of the symbol's type and payload within the window — adjustments.js.)
  if (stored('pairs_with') || receipts.some((r) => r?.reason === POSSIBLE_REDATE && r.redateOf === id && !settled.has(r.actionId)) || pairingCandidatesOf(l, p).length > 0) return LATE_REFUSAL.pairs_with;
  // (The holding's interval: bought after the entry session, and — sold — through the sale.)
  const sale = (l?.saleReceipts || []).filter((r) => upper(r?.symbol) === sym && typeof r.sessionDate === 'string').map((r) => r.sessionDate).sort().at(-1) ?? null;
  const end = Object.hasOwn(l?.holdings || {}, sym) ? null : sale;
  const within = (d) => typeof d !== 'string' || end === null || d <= end;
  const shareUnresolved = LEDGERS.some((g) => {
    const x = idea?.[g];
    if (!x) return false;
    if ((x.corporateActionReceipts || []).some((r) => SHARE_BASIS.has(r?.type) && upper(r.ticker) === sym && within(r.effectiveDate) && openOn(x, r))) return true;
    // (An open share-basis re-date whose other id is dated within the holding, wherever the moved row is dated — adjustments.js.)
    const partnerDate = (r) => (x.corporateActionReceipts || []).find((y) => y?.actionId === r.redateOf)?.effectiveDate;
    if ((x.corporateActionReceipts || []).some((r) => r?.reason === POSSIBLE_REDATE && SHARE_BASIS.has(r.type) && upper(r.ticker) === sym && openOn(x, r) && typeof partnerDate(r) === 'string' && within(partnerDate(r)))) return true;
    const h = x.holdings?.[sym];
    if (h && (h.basisSuspicion || (h.heldActions || []).some((r) => SHARE_BASIS.has(r.type)))) return true;
    return (x.closedHeldRows || []).some((r) => SHARE_BASIS.has(r.type) && upper(r.ticker) === sym && within(r.effectiveDate));
  });
  if (stored('share_basis_unresolved') || shareUnresolved) return LATE_REFUSAL.share_basis_unresolved;
  if (stored('date_uncovered') || idea?.caCoverageGaps?.[sym] || (l?.closedCoverageDoubts?.[sym]?.dates || []).length > 0) return LATE_REFUSAL.date_uncovered;
  return null;
}

/**
 * THE FOUNDER ACTION'S CHECK (Amendment F-5): does `recordId` name an open record of this idea of this `kind`, and is
 * `decision` a ruling it can take? Pure.
 * @returns {{ ruling: object } | { error: string, status: number }}
 */
export function planHoldRuling(idea, { kind, recordId, decision, ratio, payload, actionId }, { uid, requestKey, nowIso, backfill = null }) {
  if (!HOLD_KINDS.includes(kind)) return { error: 'kind_invalid', status: 400 };
  if (typeof recordId !== 'string' || recordId.length === 0 || recordId.length > 200) return { error: 'record_id_invalid', status: 400 };
  if (!(DECISIONS[kind] || []).includes(decision)) return { error: 'decision_invalid', status: 400 };
  // Closeout refuter RX-1: a coverage-gap ruling names its row's payload in `payload` only. A `ratio` beside it was read and
  // ignored — the founder named 1.25 and a 2/1 row was taken — so it is refused, not ignored.
  if (kind === 'coverage_gap' && ratio !== null && ratio !== undefined) return { error: 'ratio_not_accepted', status: 400 };
  // A record already ruled on (a ruling pending for it) is resolved.
  if (pendingRulings(idea).some((r) => r.recordId === recordId)) return { error: 'record_already_resolved', status: 409 };
  const base = { requestKey, kind, recordId, decision, by: uid, at: nowIso, appliedOn: null };

  if (kind === 'suspicion') {
    const open = [];
    let retired = false;
    for (const f of LEDGERS) {
      for (const [sym, h] of Object.entries(idea?.[f]?.holdings || {})) {
        if (isPlain(h?.basisSuspicion) && suspicionIdOf(sym, h.basisSuspicion) === recordId) open.push({ f, sym: upper(sym), s: h.basisSuspicion });
        if ((h?.basisSuspicionHistory || []).some((e) => e?.id === recordId)) retired = true;
      }
    }
    if (open.length === 0) return retired ? { error: 'record_already_resolved', status: 409 } : { error: 'record_not_found', status: 404 };
    const { sym, s } = open[0];
    const ledgers = [...new Set(open.map((o) => o.f))];
    let split = null;
    if (decision === 'split') {
      // The founder's ratio is the share multiplier (2 for a 2-for-1); it must be the split of the move the record STILL
      // stands for on every ledger that carries it (review D5): rows applied since inside its gap are already counted.
      if (!(typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0 && ratio !== 1)) return { error: 'ratio_invalid', status: 400 };
      for (const o of open) {
        const residual = residualMoveOf(idea[o.f], o.sym, o.s);
        if (ratioMatchesMove(1, residual)) return { error: 'no_residual_move', status: 422 };
        if (!ratioMatchesMove(ratio, residual)) return { error: 'ruling_does_not_match_record', status: 422 };
      }
      if (unrepresentableOn(idea, ledgers, sym, ratio)) return { error: 'ruling_unrepresentable', status: 422 };
      // Its own id (review D6): the record's split id, unless the feed already settled that id on a ledger carrying it.
      const derived = deriveActionId({ type: ratio > 1 ? 'split' : 'reverse_split', ticker: sym, effectiveDate: s.suspectedOn });
      // Amendment F rev 1, S-2 (AR2-A-1, AR2-C-2): an AMBIGUOUS id is settled only by a `conflict` ruling on its record.
      // A founder split under that id would settle it with a payload its record may never have seen; the founder rules
      // the conflict (or re-date) first.
      if (ambiguousOnIdea(idea, derived)) return { error: 'record_ambiguous_rule_conflict_first', status: 409 };
      split = { ratio, actionId: open.some((o) => settledIdsOf(idea[o.f]).has(derived)) ? `founder_${derived}` : derived };
    }
    return { ruling: { ...base, symbol: sym, ledgers, ...(split ?? {}), covers: { suspectedOn: s.suspectedOn, since: s.since ?? null, ratio: s.ratio, frozenMark: s.frozenMark } } };
  }

  if (kind === 'conflict') {
    const open = openActionRecords(idea, recordId);
    if (open.length === 0) {
      // Rev 1, S-2: A RULED ID REVISED SINCE — the feed listed a payload the ruling did not see. The founder answers it with
      // the ruled outcome again (it closes the record; nothing moves). Any other answer would undo money the ruling moved —
      // an adjustment, which is T1a-2b-4's — and is refused.
      const revised = LEDGERS.flatMap((f) => openRulingRevisions(idea?.[f]).filter((x) => x.actionId === recordId).map((x) => [f, x]));
      if (revised.length > 0) {
        const fields = [...new Set(revised.map(([f]) => f))];
        const [, x] = revised[0];
        // (T1a-2b-4: the outcome in force — the founder's, the feed's, or a correction since — on each ledger.)
        const inForce = fields.map((f) => settledOutcomeOn(idea[f], recordId));
        const keeps = inForce.every((ruled) => (decision === 'none' ? ruled === 'none' : (ruled !== null && ruled !== 'none' && isPlain(payload) && samePayload(ruled, payload))));
        if (keeps) {
          return {
            ruling: {
              ...base, symbol: upper(x.ticker), type: x.type, effectiveDate: x.effectiveDate, recordReason: REVISED_AFTER_RULING, ledgers: fields, confirms: true,
              ...(decision === 'payload' ? { payload: payloadOf(payload) } : {}),
            },
          };
        }
        // T1a-2b-4 (Astra T2D-05): THE CORRECTION. The founder may choose a payload the revision records saw in place of the
        // one in force - a cash dividend's amount or a split's ratio, on an id each named ledger settled WITH a payload.
        // The close applies it as ONE linked adjustment per ledger (adjustments.js): a dividend's difference, or a split's
        // count corrected and every dividend paid since recomputed. `none` after a payload, or a payload after `none`, is
        // not a correction this build makes (FQ-6 stands for those: it would undo or create a settlement, not adjust it).
        if (decision !== 'payload' || !isPlain(payload)) return { error: 'ruling_needs_adjustment', status: 422 };
        if (!(SHARE_BASIS.has(x.type) || x.type === 'cash_dividend')) return { error: 'ruling_needs_adjustment', status: 422 };
        if (inForce.some((o) => o === null || o === 'none')) return { error: 'ruling_needs_adjustment', status: 422 };
        // (Review AR4-C-7: the id must have been SETTLED WITH ITS PAYLOAD on every named ledger — an applied receipt or a
        // late entitlement. One the founder declined as not entitled moved nothing: there is nothing to correct, and a
        // correction accepted there could never post. Refused, as before this build.)
        if (!fields.every((f) => movedOn(idea[f], recordId))) return { error: 'ruling_needs_adjustment', status: 422 };
        const recorded = [...new Map([...inForce, ...revised.flatMap(([, rec]) => (rec.rows || []).map(payloadOf))].map((p) => [JSON.stringify(p), p])).values()];
        const chosen = recorded.find((p) => samePayload(p, payloadOf(payload))) ?? null;
        if (chosen === null) return { error: 'payload_not_recorded', status: 422 };
        if (SHARE_BASIS.has(x.type)) {
          if (!(Number(chosen.ratio) > 0)) return { error: 'payload_invalid', status: 400 };
          if (unrepresentableOn(idea, fields, upper(x.ticker), chosen.ratio / Number(inForce[0].ratio))) return { error: 'ruling_unrepresentable', status: 422 };
        } else if (!(Number(chosen.amount) > 0)) return { error: 'payload_invalid', status: 400 };
        return {
          ruling: {
            ...base, symbol: upper(x.ticker), type: x.type, effectiveDate: x.effectiveDate, recordReason: REVISED_AFTER_RULING, ledgers: fields,
            corrects: true, payload: chosen, from: inForce[0],
            // (FQ-5: the ruling covers exactly what it saw - a payload outside it, later, is a new ambiguity.)
            seen: recorded,
          },
        };
      }
      // A-5 (the founder's ruling, 21 Nov 2026; Astra T2E-C05): A REFUSED SHARE-BASIS RECORD on a ledger of the idea is answered
      // by `none` — declined on every ledger the ruling names that carries it, with the ruling's receipt; its held record then
      // drops, and the line sale it held completes at the next eligible window. `payload` is no answer: the applier refused that
      // very payload. (Replay protection: a pending ruling of the record answers 409 above; once applied, 409 below.)
      const refused = refusedActionRecords(idea, recordId);
      if (refused.length > 0) {
        if (decision !== 'none') return { error: 'refused_record_takes_none', status: 422 };
        const [, rec] = refused[0];
        return {
          ruling: {
            ...base, symbol: rec.symbol, type: rec.type, effectiveDate: rec.effectiveDate, recordReason: 'refused', refused: rec.refused,
            ledgers: [...new Set(refused.map(([f]) => f))], seen: [...new Map(refused.map(([, x]) => payloadOf(x)).map((p) => [JSON.stringify(p), p])).values()],
          },
        };
      }
      const ever = LEDGERS.some((f) => (idea?.[f]?.corporateActionReceipts || []).some((r) => r?.actionId === recordId && (r.reason === CONFLICTING_ACTION || r.reason === POSSIBLE_REDATE || r.reason === REVISED_AFTER_RULING || r.reason === 'founder_ruled_none')));
      return ever ? { error: 'record_already_resolved', status: 409 } : { error: 'record_not_found', status: 404 };
    }
    const [, r] = open[0];
    // Astra T2D-09: the ruling names the ledgers whose record it covers — and only those: at the close it is checked
    // again on each, and its action reaches no other (a ledger that never carried the record keeps its own feed rows).
    const ledgers = [...new Set(open.map(([f]) => f))];
    // Rev 1 (Astra T2D-C01): every payload ANY open record of the id has seen, on every ledger it names.
    const recorded = [...new Map(open.flatMap(([, rec]) => recordedPayloadsOf(rec).map(payloadOf)).map((p) => [JSON.stringify(p), p])).values()];
    let chosen = null;
    if (decision === 'payload') {
      if (!isPlain(payload)) return { error: 'payload_invalid', status: 400 };
      chosen = recorded.find((p) => samePayload(p, payloadOf(payload))) ?? null;
      if (chosen === null) return { error: 'payload_not_recorded', status: 422 };
      if (unrepresentableOn(idea, ledgers, upper(r.ticker), chosen.ratio)) return { error: 'ruling_unrepresentable', status: 422 };
      // (AR2-IR-1: a rename into a ticker a ledger it names already holds can never apply — refused when it is made.)
      if (chosen.renamedTo != null && ledgers.some((f) => Object.hasOwn(idea?.[f]?.holdings || {}, upper(chosen.renamedTo)))) return { error: 'ruling_unrepresentable', status: 422 };
    }
    return {
      ruling: {
        ...base, symbol: upper(r.ticker), type: r.type, effectiveDate: r.effectiveDate, recordReason: r.reason, ledgers,
        ...(chosen ? { payload: chosen } : {}),
        // (Rev 1, S-2; AR2-C-1: what the ruling saw. A payload outside it, listed even before the ruling applies, reopens.)
        seen: recorded,
      },
    };
  }

  if (kind === 'late_adjustment') {
    // T1a-2b-4 fix round (L-1, L-2): ONE PROPOSAL of the idea, by its id. Approved, the next observed close posts its net
    // — owed then, less received then — if nothing refuses it there; declined, it closes and nothing posts. An approval
    // is refused (409) while any of L-2's four stands, re-derived here from the idea as stored (not only from the
    // blockers its last close named).
    let found = null;
    for (const f of LEDGERS) for (const p of idea?.[f]?.lateProposals || []) if (p?.id === recordId) found = { f, p };
    if (!found) return { error: 'record_not_found', status: 404 };
    if (found.p.status !== 'open') return { error: 'record_already_resolved', status: 409 };
    if (decision === 'approve') {
      const refusal = lateApprovalRefusal(idea, found.f, found.p);
      if (refusal) return { error: refusal, status: 409 };
    }
    return {
      ruling: {
        ...base, symbol: upper(found.p.ticker), actionId: found.p.actionId, ledgers: [found.f], proposalKind: found.p.kind,
        netAtRuling: found.p.netUsd, owedAtRuling: found.p.owedUsd, receivedAtRuling: found.p.receivedUsd,
      },
    };
  }

  // coverage_gap
  // A-4 (the founder's ruling, 21 Nov 2026; Astra T2E-C04): A SOLD HOLDING'S COVERAGE DOUBT (close.js `closedCoverageDoubts`:
  // a rejected row dated within the holding the idea sold) clears ONLY by this ruling — no backfill clears it. It covers each
  // date as the doubt shows it when ruled (its last rejection), so a rejection a later close shows again stands again. The
  // clean refetch kept on the doubt is the founder's evidence, and the founder's `row` may take one of its rows:
  //   no_action  the rejected dates hide nothing the holding was owed;
  //   row        one row of the stored clean refetch (`practiceFieldCaBackfill/{SYM}`), dated within the doubt, is what the
  //              rejected row was: it reaches the sold holding's path as the founder's (a split enters the dated count as
  //              history; a dividend is proposed, L-1) — the only way the refetch's rows reach it (R-4's join is gone).
  //              When the id carries more than one payload there, the request must name one (`payload`), and only a row
  //              carrying exactly it is taken (C-2, closeout; rowOfNamedPayload).
  const doubts = idea?.ledger?.closedCoverageDoubts || {};
  const doubtSym = Object.keys(doubts).find((k) => (doubts[k]?.dates || []).length > 0 && closedDoubtIdOf(k, doubts[k].dates[0].date) === recordId);
  if (doubtSym) {
    const d = doubts[doubtSym];
    let row = null;
    if (decision === 'row') {
      if (typeof actionId !== 'string') return { error: 'action_id_invalid', status: 400 };
      // (Closeout refuter RX-2: THE STORED CLEAN REFETCH as the engine counts one — successfulBackfill, its parse report clean
      // too — not merely `failed !== true`: a document with no report, or a dirty one, offers no row.)
      const rows = successfulBackfill(backfill, doubtSym, null)?.actions ?? [];
      const first = d.dates[0].date;
      // (C-2: every row of the id within the doubt, and the one carrying the payload the founder named — rowOfNamedPayload.)
      const taken = rowOfNamedPayload(rows.filter((x) => isPlain(x) && upper(x.ticker) === doubtSym && deriveActionId(x) === actionId && typeof x.effectiveDate === 'string'
        && x.effectiveDate >= first && (typeof d.through !== 'string' || x.effectiveDate <= d.through)), payload, backfill?.parseReport);
      if (taken.error) return taken;
      const a = taken.row;
      if (ambiguousOnIdea(idea, actionId)) return { error: 'row_ambiguous_rule_conflict', status: 409 };
      row = { type: a.type, ticker: doubtSym, effectiveDate: a.effectiveDate, ...(a.ratio != null ? { ratio: a.ratio } : {}), ...(a.amount != null ? { amount: a.amount } : {}), source: a.source ?? null };
    }
    return {
      ruling: {
        ...base, symbol: doubtSym, closedDoubt: true, ledgers: ['ledger'],
        covers: { through: d.through ?? null, dates: (d.dates || []).map((x) => ({ date: x.date, lastSeenOn: x.lastSeenOn ?? x.seenOn ?? null })), ...(d.evidence ? { evidence: d.evidence } : {}) },
        ...(row ? { row } : {}),
      },
    };
  }
  if (recordId.startsWith(`${CA_CLOSED_DOUBT}_`)) {
    return (idea?.founderRulings || []).some((r) => r?.recordId === recordId && r.closedDoubt === true) ? { error: 'record_already_resolved', status: 409 } : { error: 'record_not_found', status: 404 };
  }
  const gaps = idea?.caCoverageGaps || {};
  const sym = Object.keys(gaps).find((k) => coverageGapIdOf(k, gaps[k]?.since) === recordId);
  if (!sym) return { error: 'record_not_found', status: 404 };
  const gap = gaps[sym];
  let row = null;
  if (decision === 'row') {
    if (typeof actionId !== 'string') return { error: 'action_id_invalid', status: 400 };
    // One RECORDED backfill row of the symbol, dated inside the gap — the one carrying the payload the founder named (C-2).
    const rows = Array.isArray(backfill?.actions) && upper(backfill?.symbol) === sym ? backfill.actions : [];
    const taken = rowOfNamedPayload(rows.filter((x) => isPlain(x) && upper(x.ticker) === sym && deriveActionId(x) === actionId && typeof x.effectiveDate === 'string' && x.effectiveDate > gap.since
      && (typeof gap.lastSession !== 'string' || x.effectiveDate <= gap.lastSession)), payload, backfill?.parseReport);
    if (taken.error) return taken;
    const a = taken.row;
    // Rev 1, S-2 (AR2-A-1 1b, 1c; AR2-C-2): a backfill row of an AMBIGUOUS id is not the founder's answer to its record —
    // only a `conflict` ruling on that record is. `no_action` stays open; the record governs its id either way.
    if (ambiguousOnIdea(idea, actionId)) return { error: 'row_ambiguous_rule_conflict', status: 409 };
    if (unrepresentableOn(idea, LEDGERS, sym, a.ratio ?? null)) return { error: 'ruling_unrepresentable', status: 422 };
    row = { type: a.type, ticker: sym, effectiveDate: a.effectiveDate, ...(a.ratio != null ? { ratio: a.ratio } : {}), ...(a.amount != null ? { amount: a.amount } : {}), source: a.source ?? null };
  }
  return { ruling: { ...base, symbol: sym, coversThrough: gap.lastSession, covers: { since: gap.since, lastSession: gap.lastSession }, ...(row ? { row } : {}) } };
}

/**
 * APPLY THE PENDING RULINGS of an idea at an OBSERVED close of `date` (see the header). Pure. Returns the idea with
 * what the rulings change before the close's actions — retired suspicions and their screen references, declines — and
 * what the close must add, LEDGER BY LEDGER (Astra T2D-09): action rows by symbol (each with its `founderRuling`;
 * `extraActionsByLedger`), their ids (`ruledIdsByLedger`: not re-date-screened on that ledger), the feed ids they replace
 * there (`replacedIdsByLedger`) — and the coverage overrides, which are the idea's.
 */
export function applyFounderRulings(idea, { date }) {
  const pending = pendingRulings(idea);
  const perLedger = (make) => Object.fromEntries(LEDGERS.map((f) => [f, make()]));
  const out = {
    idea,
    // Astra T2D-09: what a ruling adds or replaces, LEDGER BY LEDGER — the close hands each ledger its own. There is no
    // map for "every ledger": a ruling's action belongs to the ledgers whose record it covers.
    extraActionsByLedger: perLedger(() => ({})), ruledIdsByLedger: perLedger(() => new Set()), replacedIdsByLedger: perLedger(() => new Set()),
    coveredThroughOverrides: new Map(), applied: [], alerts: [],
    // T1a-2b-4 (T2D-05): the founder's corrections of settled ids - a split's, applied here (the close mirrors it on the
    // book and the line), and a dividend's, by ledger, for the close's adjustments.
    shareCorrections: [], amountCorrectionsByLedger: perLedger(() => []),
    // T1a-2b-4 fix round: the founder's decisions on late proposals, by ledger (L-1), and the standing reasons a correction
    // after a sale leaves (L-6).
    lateApprovalsByLedger: perLedger(() => []), standingReasons: [],
    // A-4: the founder's rulings of a sold holding's coverage doubt, by symbol — the only thing that clears it (close.js).
    closedDoubtRulings: new Map(),
  };
  if (pending.length === 0) return out;
  const next = { ...idea };
  for (const f of LEDGERS) if (next[f]) next[f] = cloneLedger(next[f]);
  const appliedNow = new Set();
  const receiptOf = rulingReceiptOf;
  const addAction = (sym, action, r, fields) => {
    const a = { ...action, ticker: sym, source: 'founder_ruling', founderRuling: receiptOf(r) };
    const id = a.actionId ?? deriveActionId(a);
    for (const f of fields) {
      (out.extraActionsByLedger[f][sym] = out.extraActionsByLedger[f][sym] || []).push(a);
      out.ruledIdsByLedger[f].add(id);
    }
  };
  const replace = (id, fields) => {
    for (const f of fields) out.replacedIdsByLedger[f].add(id);
  };
  /** The ledgers a ruling names (`ledgers`, recorded when it was made); a ruling recorded without them names all three. */
  const namedLedgers = (r) => (Array.isArray(r.ledgers) ? LEDGERS.filter((f) => r.ledgers.includes(f)) : LEDGERS);

  for (const r of pending) {
    if (r.kind === 'suspicion') {
      let found = false;
      const standing = [];
      for (const f of namedLedgers(r)) {
        const l = next[f];
        const h = l?.holdings?.[r.symbol];
        if (!isPlain(h?.basisSuspicion) || suspicionIdOf(r.symbol, h.basisSuspicion) !== r.recordId) continue;
        found = true;
        standing.push(f);
        if (r.decision === 'split') continue; // the split explains and retires it, in the close's own order
        // price_move: retired, naming the ruling; the move seen since is judged (priceMoveReference) — a new record if it
        // is split-shaped — and the screen takes its reference.
        const s = h.basisSuspicion;
        const { basisSuspicion: _retired, ...rest } = h;
        const { screenReference, stepRecord } = priceMoveReference(r.symbol, s, { requestKey: r.requestKey });
        const retired = {
          ...s, id: r.recordId, closedOn: date, resolvedBy: r.by, resolvedAt: r.at, ruling: receiptOf(r),
          ...(stepRecord ? { replacedBy: suspicionIdOf(r.symbol, stepRecord) } : {}),
        };
        l.holdings[r.symbol] = {
          ...rest, ...(screenReference ? { screenReference } : {}), ...(stepRecord ? { basisSuspicion: stepRecord } : {}),
          basisSuspicionHistory: [...(rest.basisSuspicionHistory || []), retired],
        };
        if (stepRecord) out.alerts.push(`PRACTICE_FIELD_HOLD_RULING_STEP ${idea.ideaId} ${f} ${r.symbol} ${r.recordId} — the founder's price_move ruling (${r.requestKey}) covers the recorded move only: the price then moved again with a split's shape (×${stepRecord.ratio}, seen ${stepRecord.suspectedOn}) while the record stood — a new record, ${suspicionIdOf(r.symbol, stepRecord)}`);
      }
      if (r.decision === 'split' && found) {
        const ratio = Number(r.ratio);
        const derived = deriveActionId({ type: ratio > 1 ? 'split' : 'reverse_split', ticker: r.symbol, effectiveDate: r.covers.suspectedOn });
        const actionId = typeof r.actionId === 'string' ? r.actionId : derived;
        // Only to the ledgers whose record still stands (T2D-09; review B5): a ledger without it keeps its feed rows.
        addAction(r.symbol, { type: ratio > 1 ? 'split' : 'reverse_split', ratio, effectiveDate: r.covers.suspectedOn, actionId }, r, standing);
        // The feed's rows of the record's split id do not meet the founder's at this close (it stands for them).
        if (actionId === derived) replace(derived, standing);
        continue; // applied when the split is (close.js marks it)
      }
      appliedNow.add(r.requestKey);
      if (!found) out.alerts.push(`PRACTICE_FIELD_HOLD_RULING_MOOT ${idea.ideaId} ${r.recordId} — the record was already gone when the ruling (${r.requestKey}) came to be applied; nothing to do`);
      continue;
    }

    if (r.kind === 'conflict' && r.corrects === true) {
      // T1a-2b-4 (T2D-05): THE FOUNDER'S CORRECTION of a settled id. The revision records it answers are closed (naming the
      // ruling) on the ledgers it names. A split's ratio is corrected here, before this close's actions - the holding's
      // count, cost and carried mark (adjustments.js correctShareBasisOn) - so a dividend held behind the revision replays
      // on the corrected count; the dividends paid since are recomputed by the close (late_basis). A dividend's amount is
      // corrected by the close (one ruled_correction adjustment per ledger): the ruling stays pending until it is posted
      // everywhere (markRulingsApplied), so a doubt at this close defers it, never drops it.
      const named = namedLedgers(r).filter((f) => next[f]);
      // (FQ-5 — review RF6-X1: only a revision whose every payload the ruling SAW is closed by it. A ruling a doubt keeps
      // pending is applied again at each close; a payload the vendor listed since is a new ambiguity, left open for the
      // founder — closed in the ruling's name, the vendor's latest amount was never put to the founder.)
      const sawIt = (x) => (x.rows || []).every((p) => (r.seen || []).some((s) => samePayload(s, payloadOf(p))));
      for (const f of named) {
        const l = next[f];
        l.corporateActionReceipts = l.corporateActionReceipts.map((x) => (x?.reason === REVISED_AFTER_RULING && x.actionId === r.recordId && x.closedBy == null && sawIt(x)
          ? { ...x, closedBy: receiptOf(r), closedOn: date } : x));
      }
      if (SHARE_BASIS.has(r.type)) {
        for (const f of named) {
          const done = postedAdjustments(next[f]).some((a) => a.kind === ADJUSTMENT_KIND.RULED_CORRECTION && a.ruling?.requestKey === r.requestKey);
          if (done) continue;
          const c = correctShareBasisOn(next[f], {
            ideaId: idea.ideaId, ledgerKind: f === 'ledger' ? 'idea' : (f === 'comparisonLedger' ? 'comparison' : 'spy'),
            actionId: r.recordId, ratio: Number(r.payload.ratio), from: r.from, ruling: receiptOf(r), date,
          });
          if (!c) continue;
          // (Review AR4-C-11: a correction of a split the idea SOLD after — its line, set on the uncorrected count, may have
          // triggered that sale. The sale stands (nothing re-trades it); the record says what the corrected count would have
          // sold, and the founder is told: the comparison's count is corrected, the idea's sale is not.)
          const sold = (c.ledger.saleReceipts || []).filter((x) => upper(x.symbol) === c.symbol && typeof x.sessionDate === 'string' && typeof r.effectiveDate === 'string' && x.sessionDate >= r.effectiveDate);
          if (sold.length > 0) {
            c.record.soldBeforeCorrection = sold.map((x) => ({ sessionDate: x.sessionDate, shares: Number(x.shares), sharesIfCorrected: roundShares(Number(x.shares) * c.factor) }));
            // L-6 (Astra T2E-05, Q-5 as ruled): THE SALE STANDS, and from this correction on every row, the endpoint and the
            // result read below full quality, the reason beside the result — derived from this durable record, not an alert.
            out.standingReasons.push({ kind: 'sale_count_differs_from_owed', symbol: c.symbol, actionId: r.recordId, since: date, via: 'correction_after_sale', ruling: r.requestKey, sold: c.record.soldBeforeCorrection });
            out.alerts.push(`PRACTICE_FIELD_CORRECTION_AFTER_SALE ${idea.ideaId} ${c.symbol} ${r.recordId} — the founder's correction (×${c.factor} on the count) changes the count the idea held when it sold ${c.symbol} (${sold.map((x) => `${x.sessionDate}: ${x.shares} shares, ${roundShares(Number(x.shares) * c.factor)} on the corrected count`).join('; ')}); the sale stands and the line that triggered it was set on the uncorrected count — for the founder`);
          }
          next[f] = c.ledger;
          out.shareCorrections.push({ field: f, symbol: c.symbol, actionId: r.recordId, factor: c.factor, sharesBefore: c.sharesBefore, sharesAfter: c.sharesAfter, record: c.record, held: Object.hasOwn(c.ledger.holdings || {}, c.symbol) });
        }
        appliedNow.add(r.requestKey);
      } else {
        for (const f of named) out.amountCorrectionsByLedger[f].push({ actionId: r.recordId, amount: Number(r.payload.amount), from: r.from, ruling: receiptOf(r) });
      }
      continue;
    }
    if (r.kind === 'late_adjustment') {
      // T1a-2b-4 fix round (L-1): the founder's decision on one late proposal, for the close's adjustments on the ledger it
      // names — applied (markRulingsApplied) once the proposal is no longer open.
      for (const f of namedLedgers(r)) out.lateApprovalsByLedger[f].push({ proposalId: r.recordId, decision: r.decision, ruling: receiptOf(r) });
      continue;
    }
    if (r.kind === 'conflict' && r.confirms === true) {
      // Rev 1, S-2: the founder's answer to a ruled id revised since — the ruled outcome again. It closes the open revision
      // records on the ledgers it names; nothing is applied or replaced.
      for (const f of namedLedgers(r)) {
        const l = next[f];
        if (!l) continue;
        l.corporateActionReceipts = l.corporateActionReceipts.map((x) => (x?.reason === REVISED_AFTER_RULING && x.actionId === r.recordId && x.closedBy == null
          ? { ...x, closedBy: receiptOf(r), closedOn: date } : x));
      }
      appliedNow.add(r.requestKey);
      continue;
    }
    if (r.kind === 'conflict' && r.recordReason === 'refused') {
      // A-5 (T2E-C05): `none` on a refused share-basis record — declined, with the ruling's receipt, on each ledger it names
      // that still carries the record; the applier then drops the held record (its id is settled) and the sale it held goes on.
      for (const f of namedLedgers(r)) {
        const l = next[f];
        if (!l || settledIdsOf(l).has(r.recordId)) continue;
        const carries = Object.values(l.holdings || {}).some((h) => (h?.heldActions || []).some((x) => x?.actionId === r.recordId && typeof x.refused === 'string'));
        if (!carries) continue;
        l.declinedActionIds.push(r.recordId);
        l.corporateActionReceipts.push({ actionId: r.recordId, type: r.type, ticker: r.symbol, effectiveDate: r.effectiveDate, applied: false, reason: 'founder_ruled_none', refused: r.refused ?? null, founderRuling: receiptOf(r), seenOn: date });
      }
      replace(r.recordId, namedLedgers(r));
      appliedNow.add(r.requestKey);
      continue;
    }
    if (r.kind === 'conflict') {
      // Astra T2D-09: revalidated on each ledger the ruling names — the record must still be open there — and applied,
      // replaced and completed only there. A ledger that never carried the record keeps its own feed rows of the id.
      const named = namedLedgers(r);
      const open = openActionRecords(next, r.recordId).filter(([f]) => named.includes(f));
      if (open.length === 0) { appliedNow.add(r.requestKey); continue; }
      const openFields = [...new Set(open.map(([f]) => f))];
      if (r.decision === 'none') {
        for (const [f, rec] of open) {
          const l = next[f];
          l.declinedActionIds.push(r.recordId);
          l.corporateActionReceipts.push({ actionId: r.recordId, type: rec.type, ticker: rec.ticker, effectiveDate: rec.effectiveDate, applied: false, reason: 'founder_ruled_none', founderRuling: receiptOf(r), seenOn: date });
        }
        replace(r.recordId, openFields);
        appliedNow.add(r.requestKey);
        continue;
      }
      replace(r.recordId, openFields);
      addAction(r.symbol, { type: r.type, effectiveDate: r.effectiveDate, ...payloadFields(r.payload) }, r, openFields);
      continue; // applied when the action is (close.js marks it)
    }

    // A-4: a sold holding's coverage doubt, cleared at this close by the ruling (close.js withClosedCoverageDoubts).
    if (r.kind === 'coverage_gap' && r.closedDoubt === true) {
      out.closedDoubtRulings.set(r.symbol, r);
      // (`row`: the founder's row reaches the idea's own ledger — the one that sold the stock — as the founder's action.)
      if (r.row) addAction(r.symbol, { type: r.row.type, effectiveDate: r.row.effectiveDate, ...(r.row.ratio != null ? { ratio: r.row.ratio } : {}), ...(r.row.amount != null ? { amount: r.row.amount } : {}) }, r, ['ledger']);
      appliedNow.add(r.requestKey);
      continue;
    }
    // coverage_gap: a fact about the symbol, for every ledger of the idea that holds it.
    out.coveredThroughOverrides.set(r.symbol, r.coversThrough);
    if (r.row) addAction(r.symbol, { type: r.row.type, effectiveDate: r.row.effectiveDate, ...(r.row.ratio != null ? { ratio: r.row.ratio } : {}), ...(r.row.amount != null ? { amount: r.row.amount } : {}) }, r, LEDGERS);
    appliedNow.add(r.requestKey);
  }
  next.founderRulings = (idea.founderRulings || []).map((r) => (appliedNow.has(r.requestKey) && r.appliedOn == null ? { ...r, appliedOn: date } : r));
  out.idea = next;
  out.applied = [...appliedNow];
  return out;
}

/**
 * After the close applied its actions: a ruling whose ACTION (a founder split, a chosen payload, a backfill row) is now
 * settled on every ledger of the idea that holds its symbol is applied (`appliedOn`); one held behind another doubt stays
 * pending. A founder SPLIT is done on each ledger that carried its record (`ledgers`) once it was applied there, or the
 * record no longer stands there (a row explained it first), or this close found it moot there (`skips`:
 * `<requestKey>@<ledger field>`, applyActions' founderSkips). Done everywhere with no founder receipt, it is closed as
 * MOOT (`outcome`), with an alert: the record, if it still stands, takes a new ruling. Pure.
 * @returns {{ idea: object, alerts: string[] }}
 */
export function markRulingsApplied(idea, { date, skips = new Set(), refusals = new Map() }) {
  const rulings = idea?.founderRulings || [];
  const alerts = [];
  if (!rulings.some((r) => r && r.appliedOn == null)) return { idea, alerts };
  const fieldsOf = (r) => (Array.isArray(r.ledgers) ? LEDGERS.filter((f) => r.ledgers.includes(f)) : LEDGERS);
  const marked = rulings.map((r) => {
    if (!r || r.appliedOn != null) return r;
    // T1a-2b-4 fix round (L-1): a decision on a late proposal is applied once the proposal is no longer open — posted,
    // declined or settled (`outcome`); moot when it is gone.
    if (r.kind === 'late_adjustment') {
      const f = fieldsOf(r)[0];
      const p = (idea[f]?.lateProposals || []).find((x) => x?.id === r.recordId) ?? null;
      if (p && p.status === 'open') return r;
      if (!p) alerts.push(`PRACTICE_FIELD_HOLD_RULING_MOOT ${idea.ideaId} ${r.recordId} — the late proposal the founder's ${r.decision} (${r.requestKey}) named is gone; nothing to do`);
      return { ...r, appliedOn: date, outcome: p ? p.status : 'moot' };
    }
    // T1a-2b-4 (T2D-05): a dividend's correction is applied once its ruled_correction adjustment is posted on every
    // ledger the ruling names (a doubt at a close defers it there).
    if (r.kind === 'conflict' && r.corrects === true) {
      const done = fieldsOf(r).every((f) => !idea[f] || postedAdjustments(idea[f]).some((a) => a.kind === ADJUSTMENT_KIND.RULED_CORRECTION && a.ruling?.requestKey === r.requestKey));
      return done ? { ...r, appliedOn: date, outcome: 'applied' } : r;
    }
    // Astra T2D-10: the applier REFUSED the ruling's action for good on a ledger it names (`refusals`:
    // `<requestKey>@<ledger field>` → reason, applyActions' founderRefusals). The ruling is closed with its reason — not
    // left pending — so its request lock is released: the record it covers is still open and takes another ruling
    // (`none`, or another payload), and the feed's own later row of the id is no longer replaced by it.
    if ((r.kind === 'conflict' && r.decision === 'payload') || (r.kind === 'suspicion' && r.decision === 'split')) {
      const refusedOn = fieldsOf(r).filter((f) => typeof refusals.get(`${r.requestKey}@${f}`) === 'string');
      if (refusedOn.length > 0) {
        const refused = refusals.get(`${r.requestKey}@${refusedOn[0]}`);
        // (A ledger it named may have taken it before another refused it: the alert and the ruling say where — refuter note.)
        const appliedOnLedgers = fieldsOf(r).filter((f) => (idea[f]?.corporateActionReceipts || []).some((x) => x?.applied === true && x.founderRuling?.requestKey === r.requestKey));
        alerts.push(`PRACTICE_FIELD_HOLD_RULING_REFUSED ${idea.ideaId} ${r.recordId} — the founder's ${r.kind} ruling (${r.requestKey}) was refused on ${refusedOn.join(', ')}: ${refused}; ${appliedOnLedgers.length > 0 ? `it was applied on ${appliedOnLedgers.join(', ')}` : 'nothing was changed'}. It is closed, and the record, where it still stands, takes a new ruling`);
        return { ...r, appliedOn: date, outcome: 'refused', refusedBecause: refused, refusedOn, ...(appliedOnLedgers.length > 0 ? { appliedOnLedgers } : {}) };
      }
    }
    if (r.kind === 'suspicion' && r.decision === 'split') {
      const actionId = typeof r.actionId === 'string' ? r.actionId : deriveActionId({ type: Number(r.ratio) > 1 ? 'split' : 'reverse_split', ticker: r.symbol, effectiveDate: r.covers.suspectedOn });
      const states = (Array.isArray(r.ledgers) ? r.ledgers : LEDGERS).map((f) => {
        const l = idea[f];
        if (!l) return 'gone';
        if ((l.corporateActionReceipts || []).some((x) => x?.actionId === actionId && x.applied === true)) return 'applied';
        const s = l.holdings?.[r.symbol]?.basisSuspicion;
        if (!(isPlain(s) && suspicionIdOf(r.symbol, s) === r.recordId)) return 'gone';
        return skips.has(`${r.requestKey}@${f}`) ? 'moot' : 'pending';
      });
      if (states.includes('pending')) return r;
      if (states.includes('applied')) return { ...r, appliedOn: date, outcome: 'applied' };
      alerts.push(`PRACTICE_FIELD_HOLD_RULING_MOOT ${idea.ideaId} ${r.recordId} — the founder's split (${r.requestKey}) was applied on no ledger: ${states.includes('moot') ? 'the record stands for a different move now (rows applied since inside its gap)' : 'a row explained the record first'}; nothing was changed — a record still standing takes a new ruling`);
      return { ...r, appliedOn: date, outcome: 'moot' };
    }
    let id = null;
    if (r.kind === 'conflict' && r.decision === 'payload') id = r.recordId;
    if (id === null) return r;
    // (Completed on the ledgers it names — T2D-09.)
    const holders = fieldsOf(r).map((f) => idea[f]).filter((l) => l && Object.hasOwn(l.holdings || {}, r.symbol));
    const settledOn = fieldsOf(r).filter((f) => settledIdsOf(idea[f]).has(id));
    // (AR2-RF-4: no ledger it names holds the symbol any more — a delisting's cash closed it — and the id is settled
    // nowhere: nothing was applied. Closed MOOT, with an alert; the record, still open, takes `none`.)
    if (holders.length === 0 && settledOn.length === 0) {
      alerts.push(`PRACTICE_FIELD_HOLD_RULING_MOOT ${idea.ideaId} ${r.recordId} — the founder's conflict ruling (${r.requestKey}) was applied on no ledger: no ledger it names holds ${r.symbol} any more; nothing was changed — the record, still open, takes \`none\``);
      return { ...r, appliedOn: date, outcome: 'moot' };
    }
    const settledEverywhere = holders.every((l) => settledIdsOf(l).has(id));
    return settledEverywhere ? { ...r, appliedOn: date } : r;
  });
  return { idea: { ...idea, founderRulings: marked }, alerts };
}
