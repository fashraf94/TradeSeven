// api/_utils/activationEvidence/lifetimes.js
//
// ID-1 Build 2 — EACH OWNER SLOT'S LIFETIMES, IN ORDER (contract §4.1).
//
// The frozen creation roster (agentContext.initialPortfolio) is copied BEFORE the
// corrected route stamps positionId and swappedInAt on live positions, so it
// carries no position ids, and a join on (tier, slot, symbol) cannot tell a
// starting stock from the same stock returning later (A → B → A). So each owner
// slot's history is rebuilt in order before any activation is named:
//   1. lifetime 0 is the roster's symbol at (tier, slot);
//   2. each trades[] row in that slot, in swappedOutAt order, closes the current
//      lifetime (its symbolOut must be the current symbol) and opens the next
//      (symbolIn);
//   3. the last lifetime must be the live position (same symbol; on the
//      corrected route the same position id).
//
// IDENTITY (the contract's table). A lifetime is on the corrected route exactly
// when its OWN position-id field is present (no committed per-lifetime route
// field exists; the battle-level stamp is scoring.stockThresholdModel):
//   legacy starting position     fallback id   battle.activatedAt          battle_activatedAt
//   corrected, still held         live positionId   live swappedInAt          position_swappedInAt
//   corrected, already sold       closing row's outgoingPositionId   its outgoingReceipt.enteredAt   outgoing_receipt
//   legacy swap-in                fallback id   the row's swappedOutAt      trade_row
//   corrected swap-in             the row's incomingPositionId   the row's swappedOutAt, corroborated by incomingReceipt   trade_row
// The fallback id is `${tier}:${slot}:${new Date(ms).toISOString()}`.
//
// CONSISTENCY. Where two sources name the same thing they must agree; any
// disagreement makes the SLOT unresolved (`inconsistent`), counted, with no
// pointer for its lifetimes. Rows are ordered by their swappedOutAt instant: a
// row whose instant cannot be read leaves the order unknown (`instant_malformed`
// for the slot), and two rows of one slot at the same instant leave it ambiguous
// (`inconsistent`).
//
// CLASS. A row's `isCrypto` describes its OUTGOING asset. A lifetime's class is
// its own evidence: the live position when it is the current lifetime, else the
// row that closed it. A boolean `isCrypto` is the only evidence read; anything
// else, or a `.CC` symbol recorded as a stock, is `class_unknown`.
//
// THE GAP. Both routes keep the newest 50 rows and count every trade, so
// scoreState.tradeCount > trades.length means older rows were evicted, from any
// slot. With a gap the gap rule OVERRIDES the root check: each slot's checks
// start at its earliest retained row, no check against the roster is made, the
// lifetime that row closes is not named (it may be the starting position or a
// swap-in whose row is gone), each slot's starting lifetime is `gap`, and every
// retained swap-in is still identified.
//
// Never guesses an id. Pure: no clock, no I/O.

import { OWNER_TIERS } from './constants.js';

/** A position id as the corrected route mints it (randomUUID): usable as a document id. */
const POSITION_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const RETAINED_ROWS = 50;

/**
 * An instant (an ISO-8601 string with a zone, or a Firestore Timestamp) → epoch ms, else null.
 * The calendar date of a 'Z' string must round-trip, so 2026-02-30 is not silently March.
 */
export function instantMsOf(value) {
  if (value && typeof value === 'object' && typeof value.toMillis === 'function') {
    const ms = value.toMillis();
    return Number.isFinite(ms) && ms >= 0 ? ms : null;
  }
  if (typeof value !== 'string' || !ISO_RE.test(value)) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return ms;
}

/** The contract's normalised representation, `new Date(ms).toISOString()`. */
export const isoOf = (ms) => new Date(ms).toISOString();

/** The fallback activation id (contract §4): `${tier}:${slot}:${entryInstantIso}`. */
export const fallbackIdOf = (tier, slot, ms) => `${tier}:${slot}:${isoOf(ms)}`;

const idOf = (v) => (typeof v === 'string' && v.length > 0 ? v : null);
const samePositionId = (a, b) => (idOf(a) ?? null) === (idOf(b) ?? null);

/** The battle's route stamp (stockThresholdModel.js stockModelRoute's first test): corrected when scoring.stockThresholdModel is present. */
export const isCorrectedBattle = (battle) => Object.hasOwn(battle?.scoring || {}, 'stockThresholdModel');

/** Did older rows leave the record? Without a readable count, a full array is assumed to have evicted. */
export function hasGap(battle) {
  const rows = Array.isArray(battle?.trades) ? battle.trades : [];
  const count = battle?.scoreState?.tradeCount;
  return Number.isInteger(count) ? count > rows.length : rows.length >= RETAINED_ROWS;
}

/** The class a lifetime's own evidence records: 'stock' | 'crypto' | null (`class_unknown`). */
function classOf(evidence, symbol) {
  const c = evidence?.isCrypto;
  if (typeof c !== 'boolean') return null;
  if (c === false && /\.CC$/i.test(symbol || '')) return null;
  return c ? 'crypto' : 'stock';
}

/** The fields of an opening row that discovery and the pointer read, copied (never the row itself). */
function rowRefOf(row) {
  return {
    swappedOutAt: row.swappedOutAt ?? null,
    symbolOut: row.symbolOut ?? null,
    symbolIn: row.symbolIn ?? null,
    evaluationId: typeof row.evaluationId === 'string' ? row.evaluationId : null,
    verificationId: idOf(row.verification?.verificationId),
    incomingPositionId: idOf(row.incomingPositionId),
  };
}

const unresolved = (base, reason) => ({ ...base, status: 'unresolved', reason });

/**
 * The identity and instant of one stock lifetime, by the table above.
 * @returns {{ route, activationId, activatedAtMs, activatedAt, activatedAtSource } | { reason: 'instant_malformed' }}
 */
function identityOf(battle, lt, isCurrent, live) {
  if (lt.kind === 'creation') {
    const pid = isCurrent ? idOf(live?.positionId) : idOf(lt.closingRow?.outgoingPositionId);
    if (pid) {
      const raw = isCurrent ? live.swappedInAt : lt.closingRow?.outgoingReceipt?.enteredAt;
      const ms = instantMsOf(raw);
      if (ms === null) return { reason: 'instant_malformed' };
      return { route: 'corrected', activationId: pid, activatedAtMs: ms, activatedAt: isoOf(ms), activatedAtSource: isCurrent ? 'position_swappedInAt' : 'outgoing_receipt' };
    }
    const ms = instantMsOf(battle.activatedAt);
    if (ms === null) return { reason: 'instant_malformed' };
    return { route: 'legacy', activationId: fallbackIdOf(lt.tier, lt.slot, ms), activatedAtMs: ms, activatedAt: isoOf(ms), activatedAtSource: 'battle_activatedAt' };
  }
  const row = lt.openingRow;
  const ms = instantMsOf(row.swappedOutAt);
  if (ms === null) return { reason: 'instant_malformed' };
  const pid = idOf(row.incomingPositionId);
  return pid
    ? { route: 'corrected', activationId: pid, activatedAtMs: ms, activatedAt: isoOf(ms), activatedAtSource: 'trade_row' }
    : { route: 'legacy', activationId: fallbackIdOf(lt.tier, lt.slot, ms), activatedAtMs: ms, activatedAt: isoOf(ms), activatedAtSource: 'trade_row' };
}

/**
 * One owner slot. Returns its lifetime records, or the reason the whole slot is unresolved.
 * @returns {{ lifetimes: object[], slotReason: null | 'inconsistent' | 'instant_malformed', gapStart: boolean }}
 */
function slotOf({ battle, tier, slot, rows, gap, corrected }) {
  const roster = battle.agentContext?.initialPortfolio?.[tier]?.[slot] ?? null;
  const live = battle.portfolio?.[tier]?.[slot] ?? null;
  const ordered = rows.map((row, i) => ({ row, ms: instantMsOf(row.swappedOutAt), i }));
  if (ordered.some((r) => r.ms === null)) return { lifetimes: [], slotReason: 'instant_malformed' };
  ordered.sort((a, b) => a.ms - b.ms || a.i - b.i);
  for (let k = 1; k < ordered.length; k++) if (ordered[k].ms === ordered[k - 1].ms) return { lifetimes: [], slotReason: 'inconsistent' };
  const sorted = ordered.map((r) => r.row);

  // The chain: under a gap it starts at the earliest retained row's incoming lifetime.
  const lifetimes = [];
  if (!gap) {
    if (!roster && sorted.length === 0 && !live) return { lifetimes: [], slotReason: null }; // no such slot
    lifetimes.push({ kind: 'creation', tier, slot, index: 0, symbol: roster?.symbol ?? null, openingRow: null, closingRow: null });
  }
  for (const row of sorted) {
    if (lifetimes.length) lifetimes[lifetimes.length - 1].closingRow = row;
    // Under a gap the position in the slot's history is unknown, so no index is invented.
    lifetimes.push({ kind: 'swap_in', tier, slot, index: gap ? null : lifetimes.length, symbol: row.symbolIn ?? null, openingRow: row, closingRow: null });
  }
  if (gap && lifetimes.length === 0) return { lifetimes: [], slotReason: null }; // nothing retained: the live position cannot be named

  // Consistency.
  const fail = () => ({ lifetimes: [], slotReason: 'inconsistent' });
  if (!gap) {
    if (typeof lifetimes[0].symbol !== 'string' || !lifetimes[0].symbol) return fail();
    if (sorted.length && sorted[0].symbolOut !== lifetimes[0].symbol) return fail();
  }
  for (let k = 0; k + 1 < sorted.length; k++) {
    if (sorted[k].symbolIn !== sorted[k + 1].symbolOut) return fail();
    if (!samePositionId(sorted[k].incomingPositionId, sorted[k + 1].outgoingPositionId)) return fail();
  }
  const last = lifetimes[lifetimes.length - 1];
  if (!live || typeof live.symbol !== 'string' || live.symbol !== last.symbol) return fail();
  if (last.openingRow) {
    if (!samePositionId(last.openingRow.incomingPositionId, live.positionId)) return fail();
    const liveIn = instantMsOf(live.swappedInAt);
    if (liveIn === null || liveIn !== instantMsOf(last.openingRow.swappedOutAt)) return fail();
  }
  // A corrected stock swap-in's instant is corroborated by its incoming receipt.
  for (const lt of lifetimes) {
    const row = lt.openingRow;
    if (!row || !idOf(row.incomingPositionId)) continue;
    const isCurrent = lt === last;
    if (classOf(isCurrent ? live : lt.closingRow, lt.symbol) !== 'stock') continue;
    const entered = instantMsOf(row.incomingReceipt?.enteredAt);
    if (entered === null || entered !== instantMsOf(row.swappedOutAt)) return fail();
  }
  // The route, two sources naming one thing (review L1-1): the battle's own stamp
  // (scoring.stockThresholdModel, stockThresholdModel.js stockModelRoute) and each
  // lifetime's own position-id field must agree. The corrected route stamps an id on
  // every position and every swap-in, crypto included (stockThresholdAdmission.js:94-96,
  // :241, :271); the legacy route stamps none. So a missing field can never flip a
  // lifetime's id to the fallback between runs, and a present id is a usable document id.
  for (const lt of lifetimes) {
    const own = lt.kind === 'swap_in' ? lt.openingRow.incomingPositionId : (lt === last ? live.positionId : lt.closingRow?.outgoingPositionId);
    const present = own !== undefined && own !== null;
    if (present !== corrected || (present && !POSITION_ID_RE.test(String(own)))) return fail();
  }
  return { lifetimes, slotReason: null, live, last };
}

/**
 * Every owner slot's lifetimes for one battle.
 *
 * @param {object} battle the battle document's data
 * @returns {{ gap: boolean, records: object[] }} one record per lifetime:
 *   `{ status: 'stock', kind, tier, slot, index, symbol, route, activationId, activatedAt, activatedAtMs, activatedAtSource, row }`
 *   `{ status: 'crypto', kind, tier, slot, index, symbol }`
 *   `{ status: 'unresolved', reason, kind, tier, slot, index }`
 */
export function lifetimesOf(battle) {
  const gap = hasGap(battle);
  const corrected = isCorrectedBattle(battle);
  const rows = (Array.isArray(battle?.trades) ? battle.trades : []).filter((r) => r && typeof r === 'object');
  const records = [];
  const placed = new Set();

  for (const tier of OWNER_TIERS) {
    const rosterLen = Array.isArray(battle?.agentContext?.initialPortfolio?.[tier]) ? battle.agentContext.initialPortfolio[tier].length : 0;
    const liveLen = Array.isArray(battle?.portfolio?.[tier]) ? battle.portfolio[tier].length : 0;
    const n = Math.max(rosterLen, liveLen);
    for (let slot = 0; slot < n; slot++) {
      const slotRows = rows.filter((r) => r.tier === tier && r.slotIndex === slot);
      slotRows.forEach((r) => placed.add(r));
      const base = { tier, slot };

      // Under a gap, the slot's starting lifetime cannot be named.
      if (gap) {
        const roster = battle?.agentContext?.initialPortfolio?.[tier]?.[slot] ?? null;
        if (roster?.isCrypto === true) records.push({ ...base, status: 'crypto', kind: 'creation', index: 0, symbol: roster.symbol ?? null });
        else if (roster) records.push(unresolved({ ...base, kind: 'creation', index: 0 }, 'gap'));
      }

      const s = slotOf({ battle, tier, slot, rows: slotRows, gap, corrected });
      if (s.slotReason) {
        // Every lifetime of the slot is unresolved: the starting one (unless the gap already named it) and each row's incoming one.
        if (!gap) records.push(unresolved({ ...base, kind: 'creation', index: 0 }, s.slotReason));
        slotRows.forEach((_, k) => records.push(unresolved({ ...base, kind: 'swap_in', index: gap ? null : k + 1 }, s.slotReason)));
        continue;
      }
      for (const lt of s.lifetimes) {
        const isCurrent = lt === s.last;
        const cls = classOf(isCurrent ? s.live : lt.closingRow, lt.symbol);
        const rb = { ...base, kind: lt.kind, index: lt.index };
        if (cls === null) { records.push(unresolved(rb, 'class_unknown')); continue; }
        if (cls === 'crypto') { records.push({ ...rb, status: 'crypto', symbol: lt.symbol }); continue; }
        const id = identityOf(battle, lt, isCurrent, s.live);
        if (id.reason) { records.push(unresolved(rb, id.reason)); continue; }
        records.push({ ...rb, status: 'stock', symbol: lt.symbol, ...id, row: lt.openingRow ? rowRefOf(lt.openingRow) : null });
      }
    }
  }

  // A row naming no owner slot cannot be placed: its incoming lifetime is unresolved.
  for (const row of rows) {
    if (!placed.has(row)) records.push(unresolved({ tier: typeof row.tier === 'string' ? row.tier : null, slot: Number.isInteger(row.slotIndex) ? row.slotIndex : null, kind: 'swap_in', index: null }, 'inconsistent'));
  }

  // Two lifetimes of one battle never share an id; if they would, neither is named.
  const seen = new Map();
  for (const r of records) if (r.status === 'stock') seen.set(r.activationId, (seen.get(r.activationId) || 0) + 1);
  return {
    gap,
    records: records.map((r) => (r.status === 'stock' && seen.get(r.activationId) > 1
      ? unresolved({ tier: r.tier, slot: r.slot, kind: r.kind, index: r.index }, 'inconsistent')
      : r)),
  };
}
