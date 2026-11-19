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
//     row         one recorded backfill row (`practiceFieldCaBackfill/{SYM}`) is applied once, and the doubt clears.
//
// A ruling that cannot be applied at that close — its action held behind another doubt — stays pending and is applied
// at the first close that can (`appliedOn` names it). Every ruling records who, when, the request key and the record.
//
// Pure. The store's reads and writes are founderControls.js's and close.js's.

import {
  cloneLedger, suspicionIdOf, ratioMatchesMove, residualMoveOf, priceMoveReference, CONFLICTING_ACTION, POSSIBLE_REDATE, actionIdOf as deriveActionId,
  recordedPayloadsOf, openRulingRevisions, REVISED_AFTER_RULING,
} from './ledger.js';
import { coverageGapIdOf } from './dailyCoverage.js';
import { roundShares } from '../mandateRounding.js';

export const HOLD_KINDS = Object.freeze(['suspicion', 'conflict', 'coverage_gap']);
const DECISIONS = Object.freeze({ suspicion: ['price_move', 'split'], conflict: ['payload', 'none'], coverage_gap: ['no_action', 'row'] });
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
 * THE FOUNDER ACTION'S CHECK (Amendment F-5): does `recordId` name an open record of this idea of this `kind`, and is
 * `decision` a ruling it can take? Pure.
 * @returns {{ ruling: object } | { error: string, status: number }}
 */
export function planHoldRuling(idea, { kind, recordId, decision, ratio, payload, actionId }, { uid, requestKey, nowIso, backfill = null }) {
  if (!HOLD_KINDS.includes(kind)) return { error: 'kind_invalid', status: 400 };
  if (typeof recordId !== 'string' || recordId.length === 0 || recordId.length > 200) return { error: 'record_id_invalid', status: 400 };
  if (!(DECISIONS[kind] || []).includes(decision)) return { error: 'decision_invalid', status: 400 };
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
        for (const f of fields) {
          const ruled = ruledOutcomeOn(idea[f], recordId);
          const same = decision === 'none' ? ruled === 'none' : (ruled !== null && ruled !== 'none' && isPlain(payload) && samePayload(ruled, payload));
          if (!same) return { error: 'ruling_needs_adjustment', status: 422 };
        }
        const [, x] = revised[0];
        return {
          ruling: {
            ...base, symbol: upper(x.ticker), type: x.type, effectiveDate: x.effectiveDate, recordReason: REVISED_AFTER_RULING, ledgers: fields, confirms: true,
            ...(decision === 'payload' ? { payload: payloadOf(payload) } : {}),
          },
        };
      }
      const ever = LEDGERS.some((f) => (idea?.[f]?.corporateActionReceipts || []).some((r) => r?.actionId === recordId && (r.reason === CONFLICTING_ACTION || r.reason === POSSIBLE_REDATE || r.reason === REVISED_AFTER_RULING)));
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

  // coverage_gap
  const gaps = idea?.caCoverageGaps || {};
  const sym = Object.keys(gaps).find((k) => coverageGapIdOf(k, gaps[k]?.since) === recordId);
  if (!sym) return { error: 'record_not_found', status: 404 };
  const gap = gaps[sym];
  let row = null;
  if (decision === 'row') {
    if (typeof actionId !== 'string') return { error: 'action_id_invalid', status: 400 };
    // One RECORDED backfill row of the symbol, dated inside the gap.
    const rows = Array.isArray(backfill?.actions) && upper(backfill?.symbol) === sym ? backfill.actions : [];
    const a = rows.find((x) => isPlain(x) && upper(x.ticker) === sym && deriveActionId(x) === actionId && typeof x.effectiveDate === 'string' && x.effectiveDate > gap.since
      && (typeof gap.lastSession !== 'string' || x.effectiveDate <= gap.lastSession));
    if (!a) return { error: 'row_not_recorded', status: 422 };
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
  };
  if (pending.length === 0) return out;
  const next = { ...idea };
  for (const f of LEDGERS) if (next[f]) next[f] = cloneLedger(next[f]);
  const appliedNow = new Set();
  const receiptOf = (r) => ({ requestKey: r.requestKey, kind: r.kind, recordId: r.recordId, decision: r.decision, by: r.by, at: r.at, ...(Array.isArray(r.seen) ? { seen: r.seen } : {}) });
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
