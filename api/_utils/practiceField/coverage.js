// api/_utils/practiceField/coverage.js
//
// Practice Field T1a-1 — RESERVED DATA COVERAGE (shared contract V2 §12; Astra V6 C6-09; build prompt §5;
// acceptance case B-COVER). One server-only document, `practiceFieldCoverage/current`, is the single capacity
// authority for every symbol an idea book needs a price for: an idea's names before they fill (`pending`) and
// after (`held`), its comparison's symbols (`comparison`) and SPY (`benchmark`).
//
//   { version, symbols: { SYM: { roles: [...], refs: ['{bookId}/{ideaId}', ...], byRef: { ref: [roles] } } }, updatedAt }
//
// `roles` and `refs` are the union over `byRef`, which keeps each idea's own roles so a release or a fill moves
// only that idea's part: SPY is every idea's benchmark, and it stays reserved until its LAST idea lets go.
//
// The document is read and written INSIDE the admission, entry and release transactions, so two admissions racing
// for the last room have one winner. The cron reads it when it builds the shared snapshot and passes its symbols
// with the held tickers, which the builder never drops.
//
// THE BUDGET. Admission refuses `coverage_unavailable` unless the reserved symbols, the new idea's symbols AND the
// engine's default candidate universe together fit MANDATE_UNIVERSE_MAX_SYMBOLS. The default universe is counted
// whether or not a quarterly book is active today (the worst case), so a quarterly book created later can never
// push the shared build past its cap, and held or pending coverage is never the part that gives way.
//
// Pure, apart from the two collection literals named for the protected-store scan.

import { CANDIDATE_UNIVERSE } from '../mandateCandidateUniverse.js';
import { MANDATE_UNIVERSE_MAX_SYMBOLS } from '../mandateConfig.js';
import { PRACTICE_FIELD_BENCHMARK_SYMBOL } from '../../../src/data/practiceFieldFunds.js';
import { COVERAGE_ROLE } from './constants.js';

const ROLE_ORDER = [COVERAGE_ROLE.PENDING, COVERAGE_ROLE.HELD, COVERAGE_ROLE.COMPARISON, COVERAGE_ROLE.BENCHMARK];
const orderRoles = (set) => ROLE_ORDER.filter((r) => set.has(r));

/** The coverage document reference. */
export function coverageRefOf(db) {
  return db.collection('practiceFieldCoverage').doc('current');
}

/** The reference string of one idea. */
export function coverageRef(bookId, ideaId) {
  return `${bookId}/${ideaId}`;
}

/** An absent document reads as empty. */
export function coverageOf(data) {
  return { version: Number.isInteger(data?.version) ? data.version : 0, symbols: data?.symbols || {}, updatedAt: data?.updatedAt ?? null };
}

/** Every reserved symbol, sorted. */
export function coverageSymbols(data) {
  return Object.keys(coverageOf(data).symbols).sort();
}

/**
 * The symbols an idea needs and the role each plays, from its frozen contract.
 * `filled: false` — the names are `pending`; `filled: true` — they are `held`.
 *
 * @returns {Object<string, string[]>} symbol → roles, in ROLE_ORDER
 */
export function ideaCoveragePlan(contract, { filled }) {
  const plan = new Map();
  const add = (sym, role) => { if (!plan.has(sym)) plan.set(sym, new Set()); plan.get(sym).add(role); };
  for (const name of contract.names) add(name, filled ? COVERAGE_ROLE.HELD : COVERAGE_ROLE.PENDING);
  for (const sym of contract.comparison.symbols) add(sym, COVERAGE_ROLE.COMPARISON);
  add(PRACTICE_FIELD_BENCHMARK_SYMBOL, COVERAGE_ROLE.BENCHMARK);
  return Object.fromEntries([...plan.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([sym, roles]) => [sym, orderRoles(roles)]));
}

/**
 * The symbols a FILLED idea needs a price for, read from what its three ledgers hold NOW rather than from its frozen
 * contract (T1a-2a; Amendment E11): after a ticker change the contract still names the old symbol, and the idea
 * needs the new one. Its own holdings are `held`; its comparison's are `comparison`; its SPY line's is `benchmark`.
 *
 * @returns {Object<string, string[]>} symbol → roles, in ROLE_ORDER
 */
export function ideaCoveragePlanFromLedgers(idea) {
  const plan = new Map();
  const add = (sym, role) => { if (!plan.has(sym)) plan.set(sym, new Set()); plan.get(sym).add(role); };
  for (const sym of Object.keys(idea?.ledger?.holdings || {})) add(sym, COVERAGE_ROLE.HELD);
  for (const sym of Object.keys(idea?.comparisonLedger?.holdings || {})) add(sym, COVERAGE_ROLE.COMPARISON);
  for (const sym of Object.keys(idea?.spyLedger?.holdings || {})) add(sym, COVERAGE_ROLE.BENCHMARK);
  return Object.fromEntries([...plan.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([sym, roles]) => [sym, orderRoles(roles)]));
}

function rebuildSymbol(byRef) {
  const refs = Object.keys(byRef).sort();
  if (refs.length === 0) return null;
  const roles = new Set();
  for (const r of refs) for (const role of byRef[r]) roles.add(role);
  return { roles: orderRoles(roles), refs, byRef: Object.fromEntries(refs.map((r) => [r, [...byRef[r]]])) };
}

/** The document with `ref` removed from every symbol; a symbol with no idea left is dropped. */
export function coverageWithoutRef(data, ref, nowIso) {
  const cur = coverageOf(data);
  const symbols = {};
  for (const [sym, entry] of Object.entries(cur.symbols)) {
    const byRef = { ...(entry.byRef || {}) };
    delete byRef[ref];
    const rebuilt = rebuildSymbol(byRef);
    if (rebuilt) symbols[sym] = rebuilt;
  }
  return { version: cur.version + 1, symbols, updatedAt: nowIso };
}

/** The document with `ref`'s reservation REPLACED by `plan` (symbol → roles). */
export function coverageWithRef(data, ref, plan, nowIso) {
  const base = coverageWithoutRef(data, ref, nowIso);
  const symbols = { ...base.symbols };
  for (const [sym, roles] of Object.entries(plan)) {
    const byRef = { ...(symbols[sym]?.byRef || {}), [ref]: [...roles] };
    symbols[sym] = rebuildSymbol(byRef);
  }
  const sorted = Object.fromEntries(Object.keys(symbols).sort().map((s) => [s, symbols[s]]));
  return { version: base.version, symbols: sorted, updatedAt: nowIso };
}

/**
 * Would reserving `plan` keep the shared build inside its cap? Counts the reserved symbols, the plan's and the
 * default candidate universe together (see THE BUDGET above).
 *
 * @returns {{ fits: boolean, needed: number, cap: number }}
 */
export function coverageFits(data, plan, { cap = MANDATE_UNIVERSE_MAX_SYMBOLS, candidateUniverse = CANDIDATE_UNIVERSE } = {}) {
  const union = new Set(candidateUniverse);
  for (const sym of Object.keys(coverageOf(data).symbols)) union.add(sym);
  for (const sym of Object.keys(plan)) union.add(sym);
  return { fits: union.size <= cap, needed: union.size, cap };
}
