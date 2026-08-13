// api/_utils/mandateCorporateActions.js
//
// Spec 1 — Mandate Substrate — CORPORATE ACTIONS (§4.3, FR-4, P3). PURE: parse,
// classify, apply — NO fetch and NO Firestore here. The upstream splits/
// dividends fetch lives in the snapshot SLOW LAYER (mandateUniverseSnapshot.js,
// the §3.0 sole-fetch module); the close pass does the writing.
//
// V1 scope (FR-4): splits, cash dividends, stock distributions, ticker changes,
// delistings (forced close at last good mark); mergers are delist-with-cash.
// Splits/dividends arrive from the EODHD feed via the slow layer. Ticker
// changes and delistings have NO feed in the account (Q5) — the APPLIER
// supports them (founder-inserted action docs / a future feed), and the
// missed-marks alert (§6.4) surfaces stuck symbols; this reading is flagged in
// the P3 PR.
//
// Application timing: actions are applied IN THE CLOSE PASS BEFORE MARKING
// (§4.3), idempotent per {mandateId, actionId} via a create-if-absent log doc
// at mandates/{id}/corporateActions/{actionId}. Intra-session, a held symbol
// whose market price has already adjusted but whose position has not is
// protected by the GAP DETECTOR below (frozen mark; exits fillable at
// last-good per the ratified C-21 path).
//
// THE GAP DETECTOR (I7) — discrimination, not suspicion:
//   overnight gap beyond MANDATE_CA_GAP_THRESHOLD on a held symbol
//     → cross-check the CA feed FIRST: a feed action that EXPLAINS the gap
//       (split price-ratio or ex-dividend drop within tolerance) → pending_ca
//       (apply normally at close; frozen mark meanwhile)
//     → no explaining feed entry but the gap is RATIO-SHAPED (≈÷2..÷10 or
//       ×2..×10, the split signature) → suspected_ca carry-over (frozen mark;
//       exits remain fillable at last-good)
//     → news-shaped gaps PASS THROUGH — earnings gaps are not anomalies.
//   The MANDATE is never frozen by this mechanism — symbol-level only — and
//   founder-manual-clear is never the response to routine volatility. An
//   unrecognized action type quarantines the SYMBOL (frozen mark + alert),
//   never a silent mismark.

import {
  MANDATE_CA_GAP_THRESHOLD,
  MANDATE_CA_RATIO_TOLERANCE,
  MANDATE_CA_RATIO_MAX_N,
} from './mandateConfig.js';
import { CORPORATE_ACTION_TYPES } from './mandateSchema.js';
import { roundUsd, roundShares } from './mandateRounding.js';

const norm = (s) => String(s || '').trim().toUpperCase();

// ── Identity ─────────────────────────────────────────────────────────────────

/**
 * Deterministic actionId (§4.3 idempotency key; the mandateId scope comes from
 * the subcollection path). One action per {type, ticker, effectiveDate}.
 */
export function deriveActionId(action) {
  return `${action.type}_${norm(action.ticker)}_${action.effectiveDate}`;
}

// ── Feed parsing (EODHD splits / dividends payloads → normalized actions) ────

/**
 * EODHD /api/splits/{sym} rows: [{ date:'YYYY-MM-DD', split:'N/M' }] — N new
 * shares per M old. Malformed rows are skipped LOUDLY (returned in `rejects`),
 * never silently coerced (§4.3: no silent mismarking).
 *
 * @returns {{ actions: Array<object>, rejects: Array<object> }}
 */
export function parseSplitsPayload(symbol, rows) {
  const actions = [];
  const rejects = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = typeof row?.date === 'string' ? row.date.slice(0, 10) : null;
    const m = typeof row?.split === 'string' ? row.split.match(/^([\d.]+)\s*\/\s*([\d.]+)$/) : null;
    const num = m ? Number(m[1]) : NaN;
    const den = m ? Number(m[2]) : NaN;
    if (!date || !Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) {
      rejects.push({ symbol: norm(symbol), row, reason: 'malformed_split' });
      continue;
    }
    const ratio = num / den; // shares multiplier
    if (ratio === 1) continue; // 1:1 is a no-op row
    actions.push({
      type: ratio > 1 ? 'split' : 'reverse_split',
      ticker: norm(symbol),
      effectiveDate: date,
      ratio,
      source: 'eodhd_splits',
    });
  }
  return { actions, rejects };
}

/**
 * EODHD /api/div/{sym} rows: [{ date (ex-date), value, unadjustedValue, ... }].
 * Cash credited per share is the UNADJUSTED amount when present (the adjusted
 * `value` is restated by later splits); ex-date is the effective date.
 */
export function parseDividendsPayload(symbol, rows) {
  const actions = [];
  const rejects = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = typeof row?.date === 'string' ? row.date.slice(0, 10) : null;
    const amount = Number(row?.unadjustedValue ?? row?.value);
    if (!date || !Number.isFinite(amount) || amount <= 0) {
      rejects.push({ symbol: norm(symbol), row, reason: 'malformed_dividend' });
      continue;
    }
    actions.push({
      type: 'cash_dividend',
      ticker: norm(symbol),
      effectiveDate: date,
      amount,
      source: 'eodhd_dividends',
    });
  }
  return { actions, rejects };
}

// ── Pending selection ────────────────────────────────────────────────────────

/**
 * The actions applicable to THIS book at the close of `onOrBefore`: held
 * ticker, effective on or before the session date, recognized type, not yet
 * applied (appliedIds). Unrecognized types are returned separately — the
 * caller quarantines the symbol rather than silently mismarking (§4.3).
 *
 * @param {object} positions          book positions map
 * @param {object} actionsBySymbol    { SYM: [normalized actions] } (daily layer)
 * @param {{ onOrBefore:string, appliedIds?:Set<string> }} opts
 * @returns {{ pending: Array<object>, unrecognized: Array<object> }}
 */
// ENTITLEMENT (§4.3, spec+money review P3 — both found the same HIGH defect):
// splits, reverse splits, distributions, and cash dividends adjust/credit only
// holdings that existed ACROSS the effective date — the market price already
// reflects the action for anyone buying on or after it. Crediting a post-ex-
// date buyer fabricates income (D-15) and corrupting a post-split buyer's
// share count self-inflicts a suspected-CA freeze. `ticker_change` and
// `delisting` are identity/termination events on the INSTRUMENT: they apply
// to any current holder regardless of acquisition date.
const DATE_ENTITLEMENT_TYPES = new Set(['split', 'reverse_split', 'cash_dividend', 'stock_distribution']);

export function pendingActionsFor(positions, actionsBySymbol, { onOrBefore, appliedIds = new Set() } = {}) {
  const pending = [];
  const unrecognized = [];
  const notEntitled = [];
  const noEntitlementData = [];
  for (const [rawTicker, pos] of Object.entries(positions || {})) {
    const sym = norm(rawTicker);
    for (const action of actionsBySymbol?.[sym] || []) {
      if (!action?.effectiveDate || action.effectiveDate > onOrBefore) continue;
      const id = deriveActionId(action);
      if (appliedIds.has(id)) continue;
      if (!CORPORATE_ACTION_TYPES.includes(action.type)) {
        unrecognized.push({ ...action, actionId: id });
        continue;
      }
      if (DATE_ENTITLEMENT_TYPES.has(action.type)) {
        const openedAt = typeof pos?.openedAt === 'string' ? pos.openedAt : null;
        if (openedAt == null) {
          // No acquisition evidence → NEVER fabricate (D-15). Skipping a real
          // split degrades to the DESIGNED backstop: the stale-basis position
          // trips the gap detector's suspected-CA freeze — visible, alerting,
          // exits fillable at last-good — instead of silent phantom money.
          noEntitlementData.push({ ...action, actionId: id });
          continue;
        }
        if (!(openedAt < action.effectiveDate)) {
          // Strict inequality: a buy ON the ex/effective date fills at the
          // already-adjusted price and earns nothing (US ex-date convention).
          notEntitled.push({ ...action, actionId: id });
          continue;
        }
      }
      pending.push({ ...action, actionId: id });
    }
  }
  // Deterministic order: by date then id, so multi-action days replay identically.
  pending.sort((a, b) => (a.effectiveDate + a.actionId).localeCompare(b.effectiveDate + b.actionId));
  return { pending, unrecognized, notEntitled, noEntitlementData };
}

// ── Application (pure) ───────────────────────────────────────────────────────

/**
 * Apply ONE action to a {positions, cash} book state. Returns the next state +
 * the application receipt. §4.3 semantics:
 *   split/reverse: shares × ratio, costBasisTotal UNCHANGED (avgCost derives);
 *     the carried lastMark divides by the ratio so the position's carry-over
 *     value is conserved (a price is a per-share quantity — it adjusts).
 *   cash_dividend: cash += shares × amount, recorded as INCOME (not trading P&L).
 *   stock_distribution: shares up by ratio, basis unchanged (same as split).
 *   ticker_change: the position key migrates; history keeps the old symbol via
 *     the log doc's renamedTo pointer (the caller writes it).
 *   delisting: forced close at the LAST GOOD mark → proceeds to cash; the
 *     caller writes the verb:'CORPORATE_CLOSE' decision and drops the symbol
 *     from the carry-over build set.
 *
 * @returns {{ ok:true, positions, cash, incomeUsd:number, forcedClose:object|null, note:string }
 *          | { ok:false, reason:string }}
 */
export function applyCorporateAction({ positions, cash }, action) {
  const sym = norm(action?.ticker);
  const pos = positions?.[sym];
  if (!pos) return { ok: false, reason: 'not_held' };
  const next = { ...positions };
  const shares = Number(pos.shares) || 0;

  switch (action.type) {
    case 'split':
    case 'reverse_split':
    case 'stock_distribution': {
      const ratio = Number(action.ratio);
      if (!Number.isFinite(ratio) || ratio <= 0) return { ok: false, reason: 'bad_ratio' };
      const newShares = roundShares(shares * ratio);
      const lastMark = Number(pos.lastMark);
      next[sym] = {
        ...pos,
        shares: newShares,
        // costBasisTotal UNCHANGED (§4.3); avgCost derives from it.
        avgCost: newShares > 0 ? (Number(pos.costBasisTotal) || 0) / newShares : null,
        lastMark: Number.isFinite(lastMark) ? lastMark / ratio : pos.lastMark,
      };
      return {
        ok: true, positions: next, cash, incomeUsd: 0, forcedClose: null,
        note: `${action.type} ×${ratio}: shares ${shares}→${newShares}, basis unchanged`,
      };
    }
    case 'cash_dividend': {
      const amount = Number(action.amount);
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'bad_amount' };
      const income = roundUsd(shares * amount);
      return {
        ok: true, positions: next, cash: roundUsd((Number(cash) || 0) + income), incomeUsd: income,
        forcedClose: null, note: `cash_dividend $${amount}/sh × ${shares} sh = $${income} (income, not trading P&L)`,
      };
    }
    case 'ticker_change': {
      const to = norm(action.renamedTo);
      if (!to) return { ok: false, reason: 'no_renamed_to' };
      if (next[to]) return { ok: false, reason: 'rename_target_held' }; // never silently merge two positions
      next[to] = { ...pos };
      delete next[sym];
      return {
        ok: true, positions: next, cash, incomeUsd: 0, forcedClose: null,
        note: `ticker_change ${sym}→${to} (history keeps ${sym} via renamedTo)`,
      };
    }
    case 'delisting': {
      // Forced close at the LAST GOOD mark (never a fabricated fresh one) —
      // UNLESS the action carries an explicit cashPerShare: a cash merger's
      // consideration is a fact of the deal, not a market mark, and a
      // suspected-CA pin freezes lastMark at the PRE-announcement price for
      // the whole arb window (C-21 review P3 finding 5: force-closing a 2.00×
      // deal at the frozen mark permanently realizes half the consideration).
      // Founder-inserted delistings for cash deals should set cashPerShare;
      // absent, the spec-letter last-good behavior holds unchanged.
      const dealPrice = Number(action.cashPerShare);
      const mark = dealPrice > 0
        ? dealPrice
        : (Number(pos.lastMark) > 0
          ? Number(pos.lastMark)
          : (shares > 0 ? (Number(pos.costBasisTotal) || 0) / shares : 0));
      if (!(mark > 0)) return { ok: false, reason: 'no_last_good_mark' };
      const proceeds = roundUsd(shares * mark);
      const deltaBasis = Number(pos.costBasisTotal) || 0; // full exit
      delete next[sym];
      return {
        ok: true, positions: next, cash: roundUsd((Number(cash) || 0) + proceeds), incomeUsd: 0,
        forcedClose: { ticker: sym, shares, mark, proceeds, realizedPnl: roundUsd(proceeds - deltaBasis) },
        note: dealPrice > 0
          ? `delisting: forced close ${shares} sh @ cashPerShare $${mark} → $${proceeds}`
          : `delisting: forced close ${shares} sh @ last-good $${mark} → $${proceeds}`,
      };
    }
    default:
      return { ok: false, reason: 'unrecognized_type' };
  }
}

// ── The gap detector (I7) ────────────────────────────────────────────────────

/** Is `ratio` (fresh/last) within relative tolerance of a split signature n or 1/n, n=2..maxN? */
export function isRatioShaped(ratio, {
  tol = MANDATE_CA_RATIO_TOLERANCE,
  maxN = MANDATE_CA_RATIO_MAX_N,
} = {}) {
  if (!Number.isFinite(ratio) || ratio <= 0) return false;
  for (let n = 2; n <= maxN; n++) {
    if (Math.abs(ratio - n) / n <= tol) return true;         // reverse split: price ×n
    if (Math.abs(ratio - 1 / n) / (1 / n) <= tol) return true; // forward split: price ÷n
  }
  return false;
}

/** Does a feed action EXPLAIN a price ratio (split ratio or ex-dividend drop) within tolerance? */
function feedExplainsGap(ratio, actions, tol, lastMark) {
  for (const a of actions || []) {
    if ((a.type === 'split' || a.type === 'reverse_split' || a.type === 'stock_distribution') && Number(a.ratio) > 0) {
      const expected = 1 / Number(a.ratio); // shares ×r ⇒ price ×(1/r)
      if (Math.abs(ratio - expected) / expected <= tol * 2) return a; // slightly looser: drift on top of the split
    }
    if (a.type === 'cash_dividend' && Number(a.amount) > 0 && Number(lastMark) > 0) {
      const expected = 1 - Number(a.amount) / Number(lastMark); // ex-date drop
      if (expected > 0 && Math.abs(ratio - expected) / expected <= tol * 2) return a;
    }
  }
  return null;
}

/**
 * Classify overnight gaps on HELD symbols at one tick (I7). Ephemeral by
 * design — no sticky freeze state: a symbol whose price normalizes (or whose
 * CA is applied at close) simply stops classifying. Symbols with no prior
 * lastMark or no fresh mark never classify here (freshness handles them).
 *
 * @param {object} positions        book positions (with lastMark = prior close)
 * @param {object} snapshot         the tick snapshot (§3.0)
 * @param {object} actionsBySymbol  { SYM: [normalized feed actions] } for the window
 * @returns {{ frozen:Set<string>, pendingCA:Map<string,object>, suspectedCA:Map<string,object>, passed:string[] }}
 */
const SHARE_BASIS_TYPES = new Set(['split', 'reverse_split', 'stock_distribution']);

export function classifyOvernightGaps(positions, snapshot, actionsBySymbol, {
  threshold = MANDATE_CA_GAP_THRESHOLD,
  tol = MANDATE_CA_RATIO_TOLERANCE,
  maxN = MANDATE_CA_RATIO_MAX_N,
  // GAP WINDOW (C-21 review P3 findings 2/4): only actions effective inside
  // the overnight gap — (sinceDate, asOfDate], both ET YYYY-MM-DD — can
  // explain or pre-freeze it. Without the filter, a split applied five days
  // ago (or dated two days AHEAD) "explains" a genuine crash into a silent
  // pending_ca freeze. Callers pass sinceDate = the book's last close date;
  // null bounds are permissive (legacy behavior) on that side only.
  sinceDate = null,
  asOfDate = null,
  // Actions this book has already applied/declined (their idempotency claims
  // exist) — excluded from the pre-threshold freeze so the close pass's
  // apply-then-scan ordering still marks fresh after a same-day application.
  excludeActionIds = null,
} = {}) {
  const frozen = new Set();
  const pendingCA = new Map();
  const suspectedCA = new Map();
  const passed = [];
  const asOf = asOfDate ?? snapshot?.date ?? null;

  for (const [rawTicker, pos] of Object.entries(positions || {})) {
    const sym = norm(rawTicker);
    const entry = snapshot?.symbols?.[sym];
    const fresh = entry?.complete ? Number(entry.price) : null;
    const last = Number(pos?.lastMark);
    if (!(fresh > 0) || !(last > 0)) continue; // nothing to compare — freshness machinery owns this case

    const gapActions = (actionsBySymbol?.[sym] || []).filter((a) => a?.effectiveDate
      && (asOf == null || a.effectiveDate <= asOf)
      && (sinceDate == null || a.effectiveDate > sinceDate)
      && !(excludeActionIds && excludeActionIds.has(deriveActionId(a))));

    const ratio = fresh / last;
    const move = Math.abs(ratio - 1);

    // FEED FIRST, before the threshold (C-21 review P3 finding 2): a feed-known
    // SHARE-BASIS action effective inside the gap means the fresh price and the
    // held share count are on different bases NO MATTER how small the move — a
    // 3:2 split gaps only 33%, under the news threshold, yet a panic exit at
    // the post-split price against unadjusted shares realizes a real loss. The
    // symbol freezes pending application at close (exits fill at last-good,
    // C-21). Sub-threshold cash dividends stay threshold-gated: they shift no
    // share basis and the mark is honest to within the dividend.
    const pendingShareBasis = gapActions.find((a) => SHARE_BASIS_TYPES.has(a.type) && Number(a.ratio) > 0);
    if (pendingShareBasis) {
      frozen.add(sym);
      pendingCA.set(sym, { action: pendingShareBasis, ratio });
      continue;
    }

    if (move < threshold) { passed.push(sym); continue; } // routine volatility — earnings gaps are not anomalies

    const explaining = feedExplainsGap(ratio, gapActions, tol, last);
    if (explaining) {
      // Feed match → the CA applies normally at close; meanwhile the position
      // is NOT yet adjusted, so the fresh mark must not price it this tick.
      frozen.add(sym);
      pendingCA.set(sym, { action: explaining, ratio });
      continue;
    }
    if (isRatioShaped(ratio, { tol, maxN })) {
      // Split signature with no feed entry → suspected-CA carry-over: frozen
      // mark, exits fillable at last-good (C-21), pending resolution.
      frozen.add(sym);
      suspectedCA.set(sym, { ratio });
      continue;
    }
    passed.push(sym); // news-shaped — passes through untouched
  }

  return { frozen, pendingCA, suspectedCA, passed };
}
