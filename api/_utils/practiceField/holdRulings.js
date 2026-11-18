// api/_utils/practiceField/holdRulings.js
//
// Practice Field T1a-2b-3 — THE FOUNDER'S RESOLUTION OF A HOLD THE DATA WILL NEVER CLEAR (Amendment F-5; T1a-2a Q-U,
// C-6). The founder action `resolve_hold` (founderControls.js) names the EXACT record it covers and a ruling; it writes
// the ruling on the idea (`founderRulings`), in its own transaction, and nothing else. The idea book's NEXT OBSERVED
// CLOSE applies it, once, before anything else of that close (applyFounderRulings), and retires the record:
//
//   suspicion     (a gap-screen record `suspected_split_SYM_<suspectedOn>`)
//     price_move  the move was real. The record is retired (its history names the ruling); everything it held is
//                 released, to be paid ONCE on the current count; and the holding's reference mark becomes the last price
//                 observed while the record stood (`lastSeen` — a quote a stored close snapshot carried; its provenance
//                 travels with it). So the ruling covers EXACTLY the recorded move: the screen at this close and after
//                 compares against that price — a later split-shaped gap, an identical one included, is a new record
//                 (closes Z1); a listed split applied after the ruling adjusts that reference and re-suspects nothing
//                 (Y4); a later move is judged against it, so a later 2-for-1 is explained by its own row (N3).
//     split       a split of the founder's ratio — which must match the recorded move's shape — applied ONCE at that
//                 close on every ledger that holds the name and in the book's mirror, dated the session the move was
//                 first seen, with a founder receipt; it explains (and retires) the record in the ordinary way.
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
  cloneLedger, markProvenance, MARK_PROVENANCE_SOURCE, suspicionIdOf, ratioMatchesMove, CONFLICTING_ACTION, POSSIBLE_REDATE, actionIdOf as deriveActionId,
} from './ledger.js';
import { coverageGapIdOf } from './dailyCoverage.js';

export const HOLD_KINDS = Object.freeze(['suspicion', 'conflict', 'coverage_gap']);
const DECISIONS = Object.freeze({ suspicion: ['price_move', 'split'], conflict: ['payload', 'none'], coverage_gap: ['no_action', 'row'] });
const LEDGERS = ['ledger', 'comparisonLedger', 'spyLedger'];
const upper = (s) => String(s || '').trim().toUpperCase();
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const settledIdsOf = (ledger) => new Set([...(ledger?.appliedActionIds || []), ...(ledger?.declinedActionIds || [])]);
const pendingRulings = (idea) => (idea?.founderRulings || []).filter((r) => r && r.appliedOn == null);

/** The payload a conflict ruling may choose: one the record holds (a conflict's rows; a possible re-date's own row). */
const payloadOf = (row) => ({ ratio: row?.ratio ?? null, amount: row?.amount ?? null });
const samePayload = (a, b) => (a?.ratio ?? null) === (b?.ratio ?? null) && (a?.amount ?? null) === (b?.amount ?? null);

/** The ledgers of an idea whose OPEN conflict or possible re-date record is `recordId`: [field, receipt]. */
function openActionRecords(idea, recordId) {
  const out = [];
  for (const f of LEDGERS) {
    const l = idea?.[f];
    if (!l) continue;
    const settled = settledIdsOf(l);
    for (const r of l.corporateActionReceipts || []) {
      if (r?.actionId !== recordId || (r.reason !== CONFLICTING_ACTION && r.reason !== POSSIBLE_REDATE)) continue;
      if (r.reason === CONFLICTING_ACTION && r.entitled === false) continue;
      if (!settled.has(recordId)) out.push([f, r]);
    }
  }
  return out;
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
    if (decision === 'split') {
      // The founder's ratio is the share multiplier (2 for a 2-for-1); it must be the split the recorded move shows.
      if (!(typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0 && ratio !== 1)) return { error: 'ratio_invalid', status: 400 };
      if (!open.every((o) => ratioMatchesMove(ratio, o.s.ratio))) return { error: 'ruling_does_not_match_record', status: 422 };
    }
    return { ruling: { ...base, symbol: sym, ...(decision === 'split' ? { ratio } : {}), covers: { suspectedOn: s.suspectedOn, since: s.since ?? null, ratio: s.ratio, frozenMark: s.frozenMark } } };
  }

  if (kind === 'conflict') {
    const open = openActionRecords(idea, recordId);
    if (open.length === 0) {
      const ever = LEDGERS.some((f) => (idea?.[f]?.corporateActionReceipts || []).some((r) => r?.actionId === recordId && (r.reason === CONFLICTING_ACTION || r.reason === POSSIBLE_REDATE)));
      return ever ? { error: 'record_already_resolved', status: 409 } : { error: 'record_not_found', status: 404 };
    }
    const [, r] = open[0];
    const recorded = r.reason === CONFLICTING_ACTION ? (r.rows || []).map(payloadOf) : [payloadOf(r)];
    let chosen = null;
    if (decision === 'payload') {
      if (!isPlain(payload)) return { error: 'payload_invalid', status: 400 };
      chosen = recorded.find((p) => samePayload(p, payload)) ?? null;
      if (chosen === null) return { error: 'payload_not_recorded', status: 422 };
    }
    return {
      ruling: {
        ...base, symbol: upper(r.ticker), type: r.type, effectiveDate: r.effectiveDate, recordReason: r.reason,
        ...(chosen ? { payload: chosen } : {}),
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
    const a = rows.find((x) => isPlain(x) && upper(x.ticker) === sym && deriveActionId(x) === actionId && typeof x.effectiveDate === 'string' && x.effectiveDate > gap.since);
    if (!a) return { error: 'row_not_recorded', status: 422 };
    row = { type: a.type, ticker: sym, effectiveDate: a.effectiveDate, ...(a.ratio != null ? { ratio: a.ratio } : {}), ...(a.amount != null ? { amount: a.amount } : {}), source: a.source ?? null };
  }
  return { ruling: { ...base, symbol: sym, coversThrough: gap.lastSession, covers: { since: gap.since, lastSession: gap.lastSession }, ...(row ? { row } : {}) } };
}

/**
 * APPLY THE PENDING RULINGS of an idea at an OBSERVED close of `date` (see the header). Pure. Returns the idea with
 * what the rulings change before the close's actions — retired suspicions, reference marks, declines — and what the
 * close must add: action rows by symbol (each with its `founderRuling`), their ids (`ruledIds`: not re-date-screened),
 * coverage overrides, and the reference marks the book's positions take.
 */
export function applyFounderRulings(idea, { date }) {
  const pending = pendingRulings(idea);
  const out = { idea, extraActions: {}, ruledIds: new Set(), replacedIds: new Set(), coveredThroughOverrides: new Map(), referenceMarks: new Map(), applied: [], alerts: [] };
  if (pending.length === 0) return out;
  const next = { ...idea };
  for (const f of LEDGERS) if (next[f]) next[f] = cloneLedger(next[f]);
  const appliedNow = new Set();
  const receiptOf = (r) => ({ requestKey: r.requestKey, kind: r.kind, recordId: r.recordId, decision: r.decision, by: r.by, at: r.at });
  const addAction = (sym, action, r) => {
    const a = { ...action, ticker: sym, source: 'founder_ruling', founderRuling: receiptOf(r) };
    (out.extraActions[sym] = out.extraActions[sym] || []).push(a);
    out.ruledIds.add(deriveActionId(a));
  };

  for (const r of pending) {
    if (r.kind === 'suspicion') {
      let found = false;
      for (const f of LEDGERS) {
        const l = next[f];
        const h = l?.holdings?.[r.symbol];
        if (!isPlain(h?.basisSuspicion) || suspicionIdOf(r.symbol, h.basisSuspicion) !== r.recordId) continue;
        found = true;
        if (r.decision === 'split') continue; // the split explains and retires it, in the close's own order
        // price_move: retired, naming the ruling; the reference becomes the last price observed while it stood.
        const s = h.basisSuspicion;
        const { basisSuspicion: _retired, ...rest } = h;
        const retired = { ...s, id: r.recordId, closedOn: date, resolvedBy: r.by, resolvedAt: r.at, ruling: receiptOf(r) };
        const seen = s.lastSeen && Number(s.lastSeen.price) > 0 ? s.lastSeen : null;
        const reference = seen ? {
          lastMark: Number(seen.price),
          lastMarkAsOf: seen.vendorTimeIso ?? rest.lastMarkAsOf ?? null,
          lastMarkSource: 'snapshot',
          lastMarkProvenance: markProvenance({ source: MARK_PROVENANCE_SOURCE.CLOSE, symbol: r.symbol, session: seen.session, snapshotKey: seen.snapshotKey, quality: seen.quality, vendorTimeIso: seen.vendorTimeIso }),
        } : {};
        l.holdings[r.symbol] = { ...rest, ...reference, basisSuspicionHistory: [...(rest.basisSuspicionHistory || []), retired] };
        if (f === 'ledger' && seen) out.referenceMarks.set(r.symbol, reference);
      }
      if (r.decision === 'split' && found) {
        const ratio = Number(r.ratio);
        addAction(r.symbol, { type: ratio > 1 ? 'split' : 'reverse_split', ratio, effectiveDate: r.covers.suspectedOn }, r);
        continue; // applied when the split is (close.js marks it)
      }
      appliedNow.add(r.requestKey);
      if (!found) out.alerts.push(`PRACTICE_FIELD_HOLD_RULING_MOOT ${idea.ideaId} ${r.recordId} — the record was already gone when the ruling (${r.requestKey}) came to be applied; nothing to do`);
      continue;
    }

    if (r.kind === 'conflict') {
      const open = openActionRecords(next, r.recordId);
      if (open.length === 0) { appliedNow.add(r.requestKey); continue; }
      if (r.decision === 'none') {
        for (const [f, rec] of open) {
          const l = next[f];
          l.declinedActionIds.push(r.recordId);
          l.corporateActionReceipts.push({ actionId: r.recordId, type: rec.type, ticker: rec.ticker, effectiveDate: rec.effectiveDate, applied: false, reason: 'founder_ruled_none', founderRuling: receiptOf(r), seenOn: date });
        }
        out.replacedIds.add(r.recordId);
        appliedNow.add(r.requestKey);
        continue;
      }
      out.replacedIds.add(r.recordId);
      addAction(r.symbol, { type: r.type, effectiveDate: r.effectiveDate, ...(r.payload?.ratio != null ? { ratio: r.payload.ratio } : {}), ...(r.payload?.amount != null ? { amount: r.payload.amount } : {}) }, r);
      continue; // applied when the action is (close.js marks it)
    }

    // coverage_gap
    out.coveredThroughOverrides.set(r.symbol, r.coversThrough);
    if (r.row) addAction(r.symbol, { type: r.row.type, effectiveDate: r.row.effectiveDate, ...(r.row.ratio != null ? { ratio: r.row.ratio } : {}), ...(r.row.amount != null ? { amount: r.row.amount } : {}) }, r);
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
 * pending. Pure.
 */
export function markRulingsApplied(idea, { date }) {
  const rulings = idea?.founderRulings || [];
  if (!rulings.some((r) => r && r.appliedOn == null)) return idea;
  const marked = rulings.map((r) => {
    if (!r || r.appliedOn != null) return r;
    let id = null;
    if (r.kind === 'suspicion' && r.decision === 'split') id = deriveActionId({ type: Number(r.ratio) > 1 ? 'split' : 'reverse_split', ticker: r.symbol, effectiveDate: r.covers.suspectedOn });
    else if (r.kind === 'conflict' && r.decision === 'payload') id = r.recordId;
    if (id === null) return r;
    const holders = LEDGERS.map((f) => idea[f]).filter((l) => l && Object.hasOwn(l.holdings || {}, r.symbol));
    const settledEverywhere = holders.every((l) => settledIdsOf(l).has(id));
    return settledEverywhere ? { ...r, appliedOn: date } : r;
  });
  return { ...idea, founderRulings: marked };
}
