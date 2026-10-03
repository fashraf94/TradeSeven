// src/screens/battleView/shadowCpuQuoteIntegrity.js
//
// SHADOW VS CPU — QUOTE INTEGRITY: the PURE GATE.
//
// Contract: SHADOW_CPU_PLACEHOLDER_PRICE_SPEC_V1_6.md (founder-authorized dark
// build); build record docs/audits/20261002_SHADOW_CPU_QUOTE_INTEGRITY_BUILD_REVIEW.md.
// Read only by AgentBattleScreen, and only while isShadowCpuQuoteIntegrityOn()
// is true for an admitted battle. Nothing here holds state, fetches, or scores:
// the canonical scorer stays in the screen (calculateAssetScoreV3, unchanged),
// and this module decides only what may be SHOWN from the evidence it is given.
//
// What lives here, and the contract section each piece answers:
//   · quote provenance → current / previousClose qualification     §4.1–§4.2
//   · the screen-local market-time rule (Option 1)                  §4.3
//   · admission, lookup-evidence and terminal-state resolution      §3.1, C-2, B-4, B-5, C-4
//   · the identified battle context and position lineage            §3.2, A-5, V-8
//   · stored-pair qualification and the ONE selected comparison     §5.1–§5.3, C-1, B-1, B-2, B-3+, P8, P9
//   · held/non-held research resolution and session-dated extremes  §7.2
//
// Copy: every new player-visible string is here (the screen, the headers and
// the row render these values; nothing re-words them), so a label and the
// number it describes come from one place (BUILD_RULES §9).

import { TIERED_GAME_MODE } from '../../constants/agentGameModes';
import { standingFromDuel } from '../../components/AgentPresence/presenceBinding';
import { formatScoreDisplay } from '../../components/shared/AnimatedScore';
import { computeTugOfWarWidth } from './computeTugOfWarWidth';
import { BATTLE_VIEW_COPY } from './battleViewCopy';

// ─── Copy ─────────────────────────────────────────────────────────────────────

export const QUOTE_INTEGRITY_COPY = Object.freeze({
  noActiveBattle: 'No active battle',
  battleUnavailable: 'Battle unavailable',
  quoteUnavailable: 'Quote unavailable',
  priceDetailsUnavailable: 'Quote unavailable — price details unavailable',
  comparisonUnavailable: 'Comparison unavailable',
  finalComparisonUnavailable: 'Final comparison unavailable',
  liveBrowserEstimate: 'Live browser estimate',
  browserQuotesIncomplete: 'browser quotes incomplete',
  browserEstimateUnavailable: 'browser estimate unavailable',
  lastScored: (when, note) => `Last scored ${when} · ${note}`,
  finalScored: (when) => `Final · scored ${when}`,
  lastQuote: (price, when) => `Last quote ${price} · as of ${when}`,
  entry: (price) => `Entry ${price}`,
  tied: 'Tied',
  youLeadBy: (margin) => `You lead by ${margin}`,
  cpuLeadsBy: (margin) => `CPU leads by ${margin}`,
  lessThanHundredth: 'less than 0.01',
  dismiss: 'Dismiss',
});

// ─── Small, strict number and time predicates (no coercion) ─────────────────

/** A real, finite, strictly positive JS number — never a numeric string. */
export const isFinitePositive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });
const ET_STAMP = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

/** The actual date, time and zone of an instant, as the player reads it. */
export function formatInstant(ms) {
  return ET_STAMP.format(new Date(ms));
}

/**
 * V-11 session date of an instant: the ET calendar date for stocks, the UTC
 * calendar date for crypto (as the server baseline qualifies it).
 */
export function sessionDateOf(ms, { crypto = false } = {}) {
  const d = new Date(ms);
  return crypto ? d.toISOString().slice(0, 10) : ET_DATE.format(d);
}

// ─── §4.1 Value-specific provenance ─────────────────────────────────────────

const PRICE_ORIGINS = new Set(['provider-close', 'provider-previous-close', 'missing', 'configured-fallback']);
const PREVIOUS_CLOSE_ORIGINS = new Set(['provider-previous-close', 'missing', 'configured-fallback']);

/**
 * The origin of each value in a quote record, as GATED interpretation reads
 * it. Missing, unsupported or malformed provenance is `unknown` for the
 * affected value; absence of `isFallback` is never upgraded into positive
 * provenance; contradictory claims cannot establish genuine evidence.
 */
export function readQuoteOrigins(record) {
  if (!record || typeof record !== 'object') return { price: 'unproven', previousClose: 'unproven' };
  const qo = record.quoteOrigin;
  let price = 'unproven';
  let previousClose = 'unproven';
  if (qo && typeof qo === 'object' && !Array.isArray(qo) && qo.version === 1) {
    if (PRICE_ORIGINS.has(qo.price)) price = qo.price;
    if (PREVIOUS_CLOSE_ORIGINS.has(qo.previousClose)) previousClose = qo.previousClose;
  }
  // A record the client marked as a configured fallback is never genuine,
  // whatever its origin claims: a contradiction makes the claim unknown.
  if (record.isFallback === true) {
    if (price !== 'configured-fallback' && price !== 'missing') price = 'unproven';
    if (previousClose === 'provider-previous-close') previousClose = 'unproven';
  }
  // R-3: a WebSocket write overrides any inherited REST price origin — the
  // current is then of unknown origin. Its previousClose keeps only its OWN
  // metadata (the bridge spreads the REST record, then sets price and source).
  if (record.source === 'websocket') price = 'unproven';
  return { price, previousClose };
}

/**
 * The market time attached to a record's current value (A-7, V-9). The stock
 * provider sends Unix seconds; crypto is normalized the same way explicitly
 * (its units are unverified, V-11) — never guessed by magnitude. A time later
 * than the browser clock fails AS A TIME only.
 */
export function readMarketTime(record, nowMs) {
  const ts = record?.timestamp;
  if (ts === undefined || ts === null) return { ms: null, reason: 'absent' };
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return { ms: null, reason: 'invalid' };
  const ms = ts * 1000;
  if (!Number.isFinite(ms) || Number.isNaN(new Date(ms).getTime())) return { ms: null, reason: 'invalid' };
  if (ms > nowMs) return { ms: null, reason: 'future' };
  return { ms, reason: null };
}

/**
 * §4.1–§4.2: one record → its current and previousClose evidence.
 *   current.qualified only for a `provider-close` origin AND a finite positive
 *   number; the reason distinguishes missing, invalid number, unknown origin,
 *   previous-close substitution and configured fallback.
 *   previousClose is qualified independently (a genuine close stays eligible
 *   even when the current was substituted from it and rejected).
 *   extremes (high/low/open) come only from a record whose current qualified,
 *   finite positive values only, never fetched or substituted.
 */
export function interpretQuote(record, { nowMs }) {
  if (!record || typeof record !== 'object') {
    return {
      current: { qualified: false, reason: 'missing', price: null, marketTimeMs: null, timeReason: null },
      previousClose: { genuine: false, reason: 'missing', value: null },
      extremes: null,
    };
  }
  const origins = readQuoteOrigins(record);
  let reason;
  switch (origins.price) {
    case 'provider-close': reason = isFinitePositive(record.price) ? 'qualified' : 'invalid-number'; break;
    case 'provider-previous-close': reason = 'previous-close-substitution'; break;
    case 'missing': reason = 'missing'; break;
    case 'configured-fallback': reason = 'configured-fallback'; break;
    default: reason = 'unproven-origin';
  }
  const qualified = reason === 'qualified';
  const time = qualified ? readMarketTime(record, nowMs) : { ms: null, reason: null };
  const current = {
    qualified,
    reason,
    price: qualified ? record.price : null,
    marketTimeMs: time.ms,
    timeReason: time.reason,
  };

  let pcReason;
  switch (origins.previousClose) {
    case 'provider-previous-close': pcReason = isFinitePositive(record.previousClose) ? 'genuine' : 'invalid-number'; break;
    case 'missing': pcReason = 'missing'; break;
    case 'configured-fallback': pcReason = 'configured-fallback'; break;
    default: pcReason = 'unproven-origin';
  }
  const previousClose = {
    genuine: pcReason === 'genuine',
    reason: pcReason,
    value: pcReason === 'genuine' ? record.previousClose : null,
  };

  let extremes = null;
  if (qualified) {
    extremes = {};
    if (isFinitePositive(record.high)) extremes.high = record.high;
    if (isFinitePositive(record.low)) extremes.low = record.low;
    if (isFinitePositive(record.open)) extremes.open = record.open;
  }
  return { current, previousClose, extremes };
}

// ─── §4.3 Option 1: the screen-local market-time rule ────────────────────────

/** A position with no evidence yet. */
export const EMPTY_POSITION_QUOTE = Object.freeze({
  accepted: null,
  status: 'unavailable',
  reason: 'missing',
  genuineClose: null,
});

/**
 * Apply one interpreted arrival (a response or an ordinary cache hit) to one
 * position's retained evidence. Context and lineage are checked by the caller
 * first (rule 1). Rules 2–5:
 *   · a qualified current that is STRICTLY older than the accepted one — both
 *     with valid attached market times — is rejected whole: the accepted tuple,
 *     its status and its previousClose state are kept (a stale observation is
 *     not promoted back);
 *   · otherwise the latest qualified arrival is adopted with its OWN time (or
 *     none) — equal, absent or unattached times give no strict-older proof;
 *   · an unqualified current makes the position unavailable (stale when a
 *     genuine observation was accepted before), and is not subject to the
 *     older-time rule: its independently genuine previousClose may be
 *     imported regardless of its market time (A-8);
 *   · previousClose is processed independently: a genuine one replaces the
 *     retained close; anything else keeps an earlier GENUINE close only.
 */
export function adoptQuote(prev, interp) {
  const base = prev || EMPTY_POSITION_QUOTE;
  const { current, previousClose, extremes } = interp;
  if (current.qualified) {
    const acceptedMs = base.accepted?.marketTimeMs ?? null;
    if (base.accepted && current.marketTimeMs != null && acceptedMs != null && current.marketTimeMs < acceptedMs) {
      return base;
    }
    return {
      accepted: { price: current.price, marketTimeMs: current.marketTimeMs, extremes: extremes || {} },
      status: 'usable',
      reason: 'qualified',
      genuineClose: previousClose.genuine ? previousClose.value : base.genuineClose,
    };
  }
  return {
    accepted: base.accepted,
    status: base.accepted ? 'stale' : 'unavailable',
    reason: current.reason,
    genuineClose: previousClose.genuine ? previousClose.value : base.genuineClose,
  };
}

/**
 * The dated "Last quote $X · as of …" label for a STALE position: only with a
 * genuine accepted observation that carries its own valid market time. Without
 * one, the honest text is "Quote unavailable".
 */
export function lastQuoteLabel(state) {
  if (!state || state.status !== 'stale' || !state.accepted || state.accepted.marketTimeMs == null) return null;
  return QUOTE_INTEGRITY_COPY.lastQuote(BATTLE_VIEW_COPY.price(state.accepted.price), formatInstant(state.accepted.marketTimeMs));
}

/**
 * §7.2 item 4: the accepted REST observation's high/low/open, usable as
 * TODAY'S extremes only when its attached market time is in today's session
 * (stock ET date, crypto UTC date). Old, absent or invalid-time extremes are
 * omitted without invalidating a genuine current.
 */
export function sessionExtremes(state, { nowMs, crypto = false }) {
  const acc = state?.accepted;
  if (!acc || acc.marketTimeMs == null) return null;
  const today = sessionDateOf(nowMs, { crypto });
  if (sessionDateOf(acc.marketTimeMs, { crypto }) !== today) return null;
  const out = { sessionDate: today };
  const ex = acc.extremes || {};
  if (isFinitePositive(ex.high)) out.high = ex.high;
  if (isFinitePositive(ex.low)) out.low = ex.low;
  // Client crypto normalization carries no open (V-11): crypto never has one.
  if (!crypto && isFinitePositive(ex.open)) out.open = ex.open;
  return out;
}

// ─── §3.1 Admission, lookup evidence and terminal states ────────────────────

/**
 * The four admission conditions, all from the matching snapshot. An empty
 * string, any other value or a malformed group stamp is EXCLUDED, never
 * coerced to absent; a missing or unknown gameMode is an intentional exclusion.
 */
export function classifyAdmission({ snapshotId, data }, requestedId) {
  if (!data || typeof data !== 'object') return { admitted: false, reason: 'no-data' };
  if (snapshotId !== requestedId) return { admitted: false, reason: 'identity' };
  if (data.gameMode !== TIERED_GAME_MODE) return { admitted: false, reason: 'mode' };
  if (!data.opponent || typeof data.opponent !== 'object' || data.opponent.odUserId !== 'cpu') {
    return { admitted: false, reason: 'opponent' };
  }
  if (!(data.groupId === undefined || data.groupId === null)) return { admitted: false, reason: 'group' };
  return { admitted: true, reason: null };
}

/**
 * The ID this screen must subscribe to while the gate is on: the direct ID, or
 * the CURRENT lookup generation's success — never the hook's retained legacy
 * ID, which survives agent changes and errors (C-2).
 */
export function gatedRequestedId({ directId, lookup }) {
  if (directId) return directId;
  if (lookup && typeof lookup === 'object' && lookup.status === 'success' && lookup.battleId) return lookup.battleId;
  return null;
}

/**
 * The screen's resolution state (R-5 table + C-2/C-4 gated screen rules):
 *   'legacy'      flag off — the exact shipped path;
 *   'pending'     the current lookup or the requested document has not settled;
 *   'no-battle'   a SERVER-CONFIRMED empty lookup (or nothing to resolve);
 *   'unavailable' a lookup error (incl. no-auth, unconfirmed-empty), a current
 *                 subscription error, or a document that does not exist;
 *   'excluded'    a matching record that fails admission → legacy behaviour;
 *   'admitted'    the gated path.
 * Lookup states come first (query path only; the direct-ID path ignores
 * `lookup` entirely). [A-4] once a requested ID was classified excluded, its
 * later subscription errors — and, on the query path, a lookup error while the
 * screen keeps the legacy-retained ID — stay legacy until the requested ID
 * changes. `excludedFor` must name the CURRENT requested ID or be null.
 */
export function resolveGate({ integrityOn, directId, lookup, envelope, requestedId, excludedFor = null }) {
  if (!integrityOn) return { mode: 'legacy', reason: 'flag-off', error: null };
  if (!directId) {
    if (!lookup || typeof lookup !== 'object') return { mode: 'pending', reason: 'lookup-missing', error: null };
    switch (lookup.status) {
      case 'success':
        if (!lookup.battleId) return { mode: 'unavailable', reason: 'lookup-incomplete', error: null };
        break;
      case 'empty':
        return { mode: 'no-battle', reason: 'lookup-empty', error: null };
      case 'idle':
        return { mode: 'no-battle', reason: 'nothing-to-resolve', error: null };
      case 'error':
        // [A-4] an EXCLUDED battle's lookup error follows legacy: the screen
        // keeps the legacy-retained ID and its document subscription, so the
        // envelope decides (still excluded → legacy).
        if (excludedFor !== null && excludedFor === requestedId) break;
        return { mode: 'unavailable', reason: 'lookup-error', error: lookup.error ?? null };
      default:
        return { mode: 'pending', reason: 'lookup-pending', error: null };
    }
  }
  if (!requestedId) return { mode: 'no-battle', reason: 'nothing-to-resolve', error: null };
  if (!envelope || typeof envelope !== 'object' || envelope.requestedId !== requestedId) {
    return { mode: 'pending', reason: 'snapshot-pending', error: null };
  }
  switch (envelope.status) {
    case 'ready': {
      const admission = classifyAdmission(envelope, requestedId);
      return admission.admitted
        ? { mode: 'admitted', reason: null, error: null }
        : { mode: 'excluded', reason: admission.reason, error: null };
    }
    case 'missing':
      return excludedFor === requestedId
        ? { mode: 'excluded', reason: 'excluded-then-missing', error: null }
        : { mode: 'unavailable', reason: 'document-missing', error: null };
    case 'error':
      return excludedFor === requestedId
        ? { mode: 'excluded', reason: 'excluded-then-error', error: envelope.error ?? null }
        : { mode: 'unavailable', reason: 'subscription-error', error: envelope.error ?? null };
    default:
      return { mode: 'pending', reason: 'snapshot-pending', error: null };
  }
}

// ─── §3.2 The identified context and position lineage ───────────────────────

const TIER_KEYS = ['star', 'core', 'support'];

/**
 * A position symbol is a string or absent. Anything else — an object (whose
 * `toString` the data itself can shadow, so using it as a key or as text
 * throws), an array, a number, a boolean — is MALFORMED (R1).
 */
const isMalformedSymbol = (symbol) => symbol !== undefined && symbol !== null && typeof symbol !== 'string';

/** A structurally valid portfolio: an object, tier arrays where present, at
 *  least one position, every position cash or a named symbol, and no position
 *  with a malformed symbol — cash included (writers stamp cash 'CASH'). */
function portfolioValid(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  let positions = 0;
  for (const tier of TIER_KEYS) {
    const list = p[tier];
    if (list === undefined || list === null) continue;
    if (!Array.isArray(list)) return false;
    for (const a of list) {
      if (a === null || a === undefined) continue;
      if (typeof a !== 'object') return false;
      if (isMalformedSymbol(a.symbol)) return false;
      if (a.isCash !== true && !(typeof a.symbol === 'string' && a.symbol.length > 0)) return false;
      positions += 1;
    }
  }
  return positions > 0;
}

/**
 * R1: the snapshot as every gated consumer reads it. A position whose symbol
 * is malformed is copied WITHOUT its `symbol`, before the lineage, the rows,
 * the turn line's adapter, the chat roster or any panel can turn it into a key
 * or text. Only the array tiers of the two portfolios hold positions; the rest
 * of the snapshot is untouched, and a well-formed one comes back as the SAME
 * object.
 */
function containSymbols(data) {
  const containPortfolio = (p) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return p;
    let out = p;
    for (const tier of TIER_KEYS) {
      const list = p[tier];
      if (!Array.isArray(list) || !list.some((a) => a && typeof a === 'object' && isMalformedSymbol(a.symbol))) continue;
      if (out === p) out = { ...p };
      out[tier] = list.map((a) => {
        if (!a || typeof a !== 'object' || !isMalformedSymbol(a.symbol)) return a;
        const position = { ...a };
        delete position.symbol;
        return position;
      });
    }
    return out;
  };
  if (!data || typeof data !== 'object') return data;
  const portfolio = containPortfolio(data.portfolio);
  const opponent = data.opponent && typeof data.opponent === 'object' ? data.opponent : null;
  const opponentPortfolio = opponent ? containPortfolio(opponent.portfolio) : undefined;
  if (portfolio === data.portfolio && (!opponent || opponentPortfolio === opponent.portfolio)) return data;
  const out = { ...data };
  if (portfolio !== data.portfolio) out.portfolio = portfolio;
  if (opponent && opponentPortfolio !== opponent.portfolio) out.opponent = { ...opponent, portfolio: opponentPortfolio };
  return out;
}

/**
 * One position's lineage: side, tier/slot, symbol and the recorded entry and
 * swap identity. A same-symbol re-entry at an identical price still differs
 * (swappedInAt), and the nightly rewrite (swapPrice and swappedInDay removed,
 * swappedInAt kept) changes it too — a NEW position generation (A-5/V-8).
 * Only a string symbol is ever used as a key (R1).
 */
export function positionLineageKey(asset, { side, tier, slot, startingPrices }) {
  const sym = typeof asset?.symbol === 'string' ? asset.symbol : null;
  return JSON.stringify([
    side, tier, slot, sym, asset?.isCash === true,
    asset?.price ?? null, asset?.swapPrice ?? null, asset?.swappedInAt ?? null, asset?.swappedInDay ?? null,
    sym ? (startingPrices?.[sym] ?? null) : null, asset?.direction ?? null,
  ]);
}

/**
 * The immutable screen context built from ONE matching snapshot's data: both
 * portfolios, recorded starting prices, thresholds/history, activation, trades,
 * stored scores, and the positions with their lineage. No opening-prop source.
 *
 * R1: everything here is read from `data` — the snapshot with its malformed
 * symbols contained — and the screen hands that same object to every gated
 * consumer. Structural validity is judged on the snapshot AS RECEIVED,
 * so a side with a malformed symbol stays invalid: the comparison incomplete,
 * never an all-cash success, never legacy.
 *
 * R2: with `received` (advanceReceived's evidence for this subscription), each
 * position's lineage also carries its slot's revision and the context the
 * battle-wide epoch, so a discontinuity the subscription received reaches
 * reconcileLineage even when React rendered it as one update.
 */
export function buildBattleContext(data, { battleId, received = null }) {
  const contained = containSymbols(data);
  const playerPortfolio = contained?.portfolio;
  const cpuPortfolio = contained?.opponent?.portfolio;
  const startingPrices = (playerPortfolio && typeof playerPortfolio === 'object' && playerPortfolio.startingPrices
    && typeof playerPortfolio.startingPrices === 'object') ? playerPortfolio.startingPrices : {};
  const positions = [];
  const collect = (side, p) => {
    if (!p || typeof p !== 'object') return;
    for (const tier of TIER_KEYS) {
      const list = Array.isArray(p[tier]) ? p[tier] : [];
      list.forEach((asset, slot) => {
        if (!asset || typeof asset !== 'object') return;
        const posKey = `${side}:${tier}:${slot}`;
        const lineageKey = positionLineageKey(asset, { side, tier, slot, startingPrices });
        positions.push({
          posKey,
          side,
          tier,
          slot,
          asset,
          symbol: typeof asset.symbol === 'string' ? asset.symbol : null,
          isCash: asset.isCash === true,
          lineageKey: received ? `${lineageKey}#${received.revisions[posKey] ?? 0}` : lineageKey,
        });
      });
    }
  };
  collect('player', playerPortfolio);
  collect('cpu', cpuPortfolio);
  const held = positions.filter((p) => !p.isCash && p.symbol);
  return {
    battleId,
    data: contained,
    playerPortfolio,
    cpuPortfolio,
    portfoliosValid: portfolioValid(data?.portfolio) && portfolioValid(data?.opponent?.portfolio),
    startingPrices,
    thresholds: data?.scoring?.thresholds && typeof data.scoring.thresholds === 'object' ? data.scoring.thresholds : {},
    positions,
    held,
    requiredSymbols: [...new Set(held.map((p) => p.symbol))],
    tradeCount: data?.scoreState?.tradeCount ?? null,
    tradesLength: Array.isArray(data?.trades) ? data.trades.length : 0,
    epoch: received ? received.epoch : 0,
  };
}

/**
 * R2: the discontinuities ONE subscription has received, folded callback by
 * callback. The subscription runs this on EVERY callback, so what React renders
 * as one update — a slot that vanishes and returns holding the same stock, a
 * history truncated in between — still reaches the lineage. Per slot, a
 * revision that advances whenever the slot's lineage differs from the previous
 * callback's (absence included) and never restarts within the subscription;
 * battle-wide, an epoch that advances on reconcileLineage's own whole-battle
 * rules (a truncated trade history, a trade-count move no slot explains), on a
 * missing document or an error (`data` null: the terminal state the screen
 * would have shown, which closes every battle-bound detail, whatever the trade
 * history), and on a snapshot it cannot read. Feed- and chat-only callbacks
 * change neither. Pure. It runs for every flag-on callback, excluded battles
 * included, so it never throws.
 */
export function advanceReceived(prev, data) {
  let context = null;
  try {
    context = buildBattleContext(data, { battleId: null });
  } catch {
    context = null;
  }
  const slots = context ? Object.fromEntries(context.positions.map((p) => [p.posKey, p.lineageKey])) : {};
  const tradeCount = context ? context.tradeCount : null;
  const tradesLength = context ? context.tradesLength : 0;
  if (!prev) return { slots, revisions: {}, epoch: 0, tradeCount, tradesLength };
  let revisions = prev.revisions;
  for (const k of new Set([...Object.keys(prev.slots), ...Object.keys(slots)])) {
    if (prev.slots[k] === slots[k]) continue;
    if (revisions === prev.revisions) revisions = { ...prev.revisions };
    revisions[k] = (revisions[k] ?? 0) + 1;
  }
  const reset = !context || data == null || tradesLength < prev.tradesLength
    || (tradeCount !== prev.tradeCount && revisions === prev.revisions);
  return { slots, revisions, epoch: reset ? prev.epoch + 1 : prev.epoch, tradeCount, tradesLength };
}

/**
 * Advance the battle/position generations from one context to the next.
 * Returns the SAME object when nothing changed (safe for render-time state
 * adjustment). Conservative: a new battle or subscription, a truncated trade
 * history, a trade-count change that no slot's lineage explains, or a received
 * epoch change (R2) invalidates every position; otherwise only the slots whose
 * lineage changed.
 */
export function reconcileLineage(prev, { battleKey, context }) {
  const posEntries = context.positions.map((p) => [p.posKey, p.lineageKey]);
  const epoch = context.epoch ?? 0;
  if (!prev || prev.battleKey !== battleKey || context.tradesLength < prev.tradesLength || epoch !== (prev.epoch ?? 0)) {
    return {
      battleKey,
      battleGeneration: (prev?.battleGeneration ?? 0) + 1,
      epoch,
      tradeCount: context.tradeCount,
      tradesLength: context.tradesLength,
      positions: Object.fromEntries(posEntries.map(([k, l]) => [k, { lineageKey: l, gen: 1 }])),
    };
  }
  let changed = false;
  const positions = {};
  for (const [k, l] of posEntries) {
    const was = prev.positions[k];
    if (was && was.lineageKey === l) positions[k] = was;
    else { positions[k] = { lineageKey: l, gen: (was?.gen ?? 0) + 1 }; changed = true; }
  }
  if (Object.keys(prev.positions).length !== posEntries.length) changed = true;
  const tradeCountMoved = context.tradeCount !== prev.tradeCount;
  if (tradeCountMoved && !changed) {
    // Continuity cannot be established and the affected slots cannot be
    // identified: invalidate all position state.
    return {
      battleKey,
      battleGeneration: prev.battleGeneration + 1,
      epoch,
      tradeCount: context.tradeCount,
      tradesLength: context.tradesLength,
      positions: Object.fromEntries(posEntries.map(([k, l]) => [k, { lineageKey: l, gen: (prev.positions[k]?.gen ?? 0) + 1 }])),
    };
  }
  if (!changed && !tradeCountMoved && context.tradesLength === prev.tradesLength) return prev;
  return { ...prev, tradeCount: context.tradeCount, tradesLength: context.tradesLength, positions };
}

// ─── §5.1 Stored evidence ────────────────────────────────────────────────────

const ISO_FULL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** One position's identity: battle key, battle generation, slot and lineage
 *  generation. Quote evidence and detail selections are keyed by it. */
export function positionToken(lineage, posKey) {
  const p = lineage?.positions?.[posKey];
  return p && lineage.battleKey ? `${lineage.battleKey}#${lineage.battleGeneration}#${posKey}#${p.gen}` : null;
}

/**
 * One poll's answer (or failure) applied to the retained evidence. A position
 * whose identity changed since the request was issued is skipped (§4.3 rule 1:
 * a retired context cannot update a new position); everything else goes
 * through adoptQuote (rules 2–5). The screen's poll effect already drops a
 * retired effect's answers; this check covers an answer that resolves after
 * the commit that changed a position and before that effect's cleanup runs.
 */
export function applyQuoteArrival(prev, positions, interpFor) {
  const lin = prev.lineage;
  if (!lin || !lin.battleKey) return prev;
  let quotes = prev.quotes;
  for (const p of positions) {
    const token = positionToken(lin, p.posKey);
    if (!token || token !== p.token) continue;
    const held = quotes[p.posKey]?.token === token ? quotes[p.posKey].state : EMPTY_POSITION_QUOTE;
    const next = adoptQuote(held, interpFor(p.symbol));
    if (quotes[p.posKey]?.token !== token || next !== held) {
      if (quotes === prev.quotes) quotes = { ...prev.quotes };
      quotes[p.posKey] = { token, state: next };
    }
  }
  return quotes === prev.quotes ? prev : { ...prev, quotes };
}

/**
 * A stored instant: a full ISO date-time with an explicit zone that parses to
 * a finite, positive, non-future instant. Date-only strings, blanks,
 * impossible dates, numbers, Timestamps and malformed values are rejected.
 */
export function parseStoredInstant(value, nowMs) {
  if (typeof value !== 'string') return null;
  const m = ISO_FULL.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, , zone, , zh, zm] = m;
  const year = Number(y); const month = Number(mo); const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return null;
  if (Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) return null;
  if (zone !== 'Z' && (Number(zh) > 23 || Number(zm) > 59)) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || ms <= 0 || ms > nowMs) return null;
  return ms;
}

/** §5.1: a qualified stored pair — both finite (zero and negative included,
 *  no coercion) and a valid lastScoredAt, from the same snapshot. */
export function qualifyStoredPair(scoreState, nowMs) {
  if (!scoreState || typeof scoreState !== 'object') return null;
  const my = scoreState.currentScore;
  const opp = scoreState.opponentScore;
  if (typeof my !== 'number' || !Number.isFinite(my) || typeof opp !== 'number' || !Number.isFinite(opp)) return null;
  const timeMs = parseStoredInstant(scoreState.lastScoredAt, nowMs);
  if (timeMs == null) return null;
  return { pair: [my, opp], timeMs };
}

// ─── §5.2–§5.3 The ONE selected comparison ──────────────────────────────────

/** Three-way lead on the selected values — completion's decision by construction. */
export const leadOf = (my, opp) => (my > opp ? 'player' : my < opp ? 'cpu' : 'tie');

/**
 * B-1 / P9: the gated bar. Both ≥ 0 → today's helper, called UNCHANGED (exact
 * healthy-fixture parity); otherwise the signed standing, clamped 10–90.
 * Opposite signs (or one side exactly 0 and the other negative) pin at 90/10
 * however small the gap (B-2, disclosed).
 */
export function gatedBarWidth(my, opp) {
  if (my >= 0 && opp >= 0) return computeTugOfWarWidth(my, opp);
  return Math.max(10, Math.min(90, 50 + 50 * standingFromDuel(my, opp)));
}

/** Integer units (hundredths for stored kinds, wholes for browser) parsed from
 *  the FORMATTED digits, so a margin agrees with the screen (B-3+). */
function unitsOf(text, fractionDigits) {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) return null;
  const whole = Number(m[2]);
  const frac = fractionDigits ? Number((m[3] || '').padEnd(fractionDigits, '0').slice(0, fractionDigits)) : 0;
  const units = whole * 10 ** (fractionDigits || 0) + frac;
  return m[1] === '-' ? -units : units;
}
function formatUnits(units, fractionDigits) {
  if (!fractionDigits) return String(units);
  const f = 10 ** fractionDigits;
  return `${Math.floor(units / f)}.${String(units % f).padStart(fractionDigits, '0')}`;
}

/**
 * "You lead by 0.20" / "CPU leads by 0.01" / "Tied". The LEAD follows the
 * selected values (stored for stored kinds); the MARGIN is computed from the
 * displayed digits. Equal digits with unequal stored values read "less than
 * 0.01" and never "Tied" (B-3+).
 */
export function comparisonProse(pair, digits, fractionDigits) {
  const lead = leadOf(pair[0], pair[1]);
  if (lead === 'tie') return QUOTE_INTEGRITY_COPY.tied;
  const a = unitsOf(digits[0], fractionDigits);
  const b = unitsOf(digits[1], fractionDigits);
  const margin = a == null || b == null ? 0 : Math.abs(a - b);
  const text = margin === 0 ? QUOTE_INTEGRITY_COPY.lessThanHundredth : formatUnits(margin, fractionDigits);
  return lead === 'player' ? QUOTE_INTEGRITY_COPY.youLeadBy(text) : QUOTE_INTEGRITY_COPY.cpuLeadsBy(text);
}

function availableComparison(kind, pair, { contextKey, label, scoredAtMs }) {
  const fractionDigits = kind === 'browser' ? undefined : 2;
  const digits = [formatScoreDisplay(pair[0], { fractionDigits }), formatScoreDisplay(pair[1], { fractionDigits })];
  const lead = leadOf(pair[0], pair[1]);
  const prose = comparisonProse(pair, digits, fractionDigits);
  return {
    kind,
    available: true,
    contextKey,
    switchKey: `${kind}|${contextKey}`,
    pair,
    fractionDigits,
    digits,
    lead,
    barWidth: gatedBarWidth(pair[0], pair[1]),
    standing: standingFromDuel(pair[0], pair[1]),
    label,
    prose,
    scoredAtMs: scoredAtMs ?? null,
    accessibleText: `${label}. You ${digits[0]}, CPU ${digits[1]}. ${prose}.`,
  };
}

function unavailableComparison(label, contextKey) {
  return {
    kind: 'unavailable',
    available: false,
    contextKey,
    switchKey: `unavailable|${contextKey}`,
    pair: null,
    fractionDigits: undefined,
    digits: null,
    lead: null,
    barWidth: null,
    standing: null,
    label,
    prose: null,
    scoredAtMs: null,
    accessibleText: label,
  };
}

/**
 * §5.2 selection, once per render:
 *   completed → the qualified stored FINAL, else "Final comparison unavailable";
 *   active + every required current qualified + finite totals → browser now;
 *   active + incomplete (or a non-finite total) → the qualified stored pair
 *     with its actual time, else "Comparison unavailable".
 * Live quotes never select a final; loading alone does not block a complete
 * active quote set; no partial sums, no source mixing, no default 0–0.
 */
export function selectComparison({ status, complete, browserPair, scoreState, contextKey, nowMs }) {
  const stored = qualifyStoredPair(scoreState, nowMs);
  if (status === 'completed') {
    return stored
      ? availableComparison('final', stored.pair, { contextKey, label: QUOTE_INTEGRITY_COPY.finalScored(formatInstant(stored.timeMs)), scoredAtMs: stored.timeMs })
      : unavailableComparison(QUOTE_INTEGRITY_COPY.finalComparisonUnavailable, contextKey);
  }
  const browserFinite = Array.isArray(browserPair) && browserPair.length === 2
    && Number.isFinite(browserPair[0]) && Number.isFinite(browserPair[1]);
  if (complete && browserFinite) {
    return availableComparison('browser', browserPair, { contextKey, label: QUOTE_INTEGRITY_COPY.liveBrowserEstimate });
  }
  if (stored) {
    const note = complete ? QUOTE_INTEGRITY_COPY.browserEstimateUnavailable : QUOTE_INTEGRITY_COPY.browserQuotesIncomplete;
    return availableComparison('last-scored', stored.pair, {
      contextKey,
      label: QUOTE_INTEGRITY_COPY.lastScored(formatInstant(stored.timeMs), note),
      scoredAtMs: stored.timeMs,
    });
  }
  return unavailableComparison(QUOTE_INTEGRITY_COPY.comparisonUnavailable, contextKey);
}

/**
 * The presence face's duel input for a comparison (R-7, V-4): the selected
 * pair, or — unavailable — score keys OMITTED (never null: the binding coerces
 * with Number(), and Number(null) is a finite 0).
 */
export function duelFor(comparison) {
  if (comparison && comparison.available) {
    return { playerScore: comparison.pair[0], opponentScore: comparison.pair[1], statusFeed: null };
  }
  return { statusFeed: null };
}

// ─── §7.2 Held / non-held research resolution ────────────────────────────────

/**
 * Resolve a research click to a held position (§7.2 item 1):
 *   a row supplies its exact position;
 *   a side-tagged message uses that side;
 *   an untagged symbol held on both sides resolves to the player;
 *   a CPU-only symbol resolves to the CPU;
 *   several indistinguishable same-side positions withhold the held view.
 * A symbol held by neither side is 'non-held' (legacy research, D2).
 */
export function resolveResearchTarget(symbol, held, { posKey = null, side = null } = {}) {
  if (posKey) {
    const exact = held.find((p) => p.posKey === posKey);
    if (exact) return { kind: 'held', position: exact };
  }
  const matches = held.filter((p) => p.symbol === symbol);
  if (matches.length === 0) return { kind: 'non-held' };
  const pick = (s) => {
    const same = matches.filter((p) => p.side === s);
    if (same.length === 1) return { kind: 'held', position: same[0] };
    if (same.length > 1) return { kind: 'withheld' };
    return null;
  };
  if (side === 'player' || side === 'cpu') {
    const tagged = pick(side);
    if (tagged) return tagged;
  }
  return pick('player') || pick('cpu') || { kind: 'non-held' };
}
