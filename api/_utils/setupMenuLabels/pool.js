// api/_utils/setupMenuLabels/pool.js
//
// Slice 2 — THE FREEZE, PURE (spec V2 §4.1–§4.2, amended by Corrections C and D.2). At the tick's
// existing universe capture the candidate menu is settled; this module turns that instant's sets into
// the block's candidate list. No I/O, no clock, no flag, no store import: every input is the caller's.
//
// THE SETS ARE LITERAL (Correction D.2). P, the candidate pool, is the list the universe capture
// records: the hot-bench names, then the hot-bench asset map's keys (`[...hotBenchSymbols,
// ...Object.keys(hotBenchAssetMap)]`, which overlaps itself). M is the bench at the freeze, the very
// object the prompt is later built from (`flattenBenchServer(battle.portfolio.bench)`), and H is what
// the tick holds at the freeze. Membership is computed from those sets directly, so a hot-bench name
// already in the original bench is in both P and M although it never enters the asset map. Being in
// M at the freeze (`inBenchAtFreeze`) is NOT dispatch: a model-visible denominator needs the record's
// `model.dispatched` too.
//
// DEDUPLICATION is deterministic and lives inside the block only: the first occurrence of each
// symbol in P's order, so a hot-bench name is never re-tagged `catalyst`. The real lists, their order
// and the bench are never touched.
//
// THE CAP COMES FIRST (Correction C): candidates beyond SETUP_MENU_MAX_CANDIDATES are omitted here,
// counted, and never read. A name the record's own symbol syntax cannot carry is counted as
// unrecordable and never read.

import { scopeOf } from '../activationEvidence/scope.js';
import { SETUP_MENU_MAX_CANDIDATES, SETUP_MENU_SELECTORS } from './constants.js';

/** The record's symbol syntax (captureSerializer.js SYMBOL_RE, restated; pinned equal in pool.test.js). */
export const RECORD_SYMBOL_RE = /^[A-Z0-9][A-Z0-9.-]{0,11}$/;

const asStringList = (v) => (Array.isArray(v) ? v : []);

/**
 * Is this tick's battle observed? The flag and allowlist are the caller's (gate.js); this is the
 * battle half: `scopeOf` (D-4, reused) and not a tournament battle.
 */
export function poolScopeAdmits(battle, { isTournament }) {
  if (isTournament === true) return false;
  try {
    return scopeOf(battle ?? {}).inScope === true;
  } catch {
    return false;
  }
}

/**
 * The candidate list of the block, from the frozen sets. Pure.
 *
 * @param {object} p
 * @param {unknown[]} p.hotBenchSymbols the tick's hot-bench list at the freeze
 * @param {unknown[]} p.assetMapKeys Object.keys(hotBenchAssetMap) at the freeze
 * @param {unknown[]} p.benchAtFreeze the bench's symbols at the freeze (M)
 * @param {unknown[]} p.heldAtFreeze the held symbols at the freeze (H)
 * @param {(symbol: string) => ('excluded'|'symbol_form'|null)} p.classify crypto and key-form, decided without I/O
 * @returns {{ candidates: object[], presentedCount: number, uniqueCount: number, omittedCount: number, unrecordableCount: number }}
 */
export function candidatesOf({ hotBenchSymbols, assetMapKeys, benchAtFreeze, heldAtFreeze, classify, maxCandidates = SETUP_MENU_MAX_CANDIDATES }) {
  const hot = asStringList(hotBenchSymbols);
  const keys = asStringList(assetMapKeys);
  const bench = new Set(asStringList(benchAtFreeze).filter((s) => typeof s === 'string'));
  const held = new Set(asStringList(heldAtFreeze).filter((s) => typeof s === 'string'));
  const presentedCount = hot.length + keys.length;

  const seen = new Set();
  const unique = [];
  let unrecordableCount = 0;
  const take = (symbol) => {
    if (typeof symbol !== 'string' || symbol.length === 0 || seen.has(symbol)) return;
    seen.add(symbol);
    if (!RECORD_SYMBOL_RE.test(symbol)) { unrecordableCount += 1; return; }
    unique.push({ symbol });
  };
  for (const s of hot) take(s);
  for (const s of keys) take(s);

  const hotSet = new Set(hot.filter((s) => typeof s === 'string'));
  const kept = unique.slice(0, Math.max(0, maxCandidates));
  const candidates = kept.map(({ symbol }) => {
    const pre = typeof classify === 'function' ? classify(symbol) : null;
    return {
      symbol,
      // A name on the hot-bench list is `hotbench` (the population the tenant requests); every other
      // asset-map key is a catalyst addition (agent-evaluate.js: the asset map's other keys are hot-bench names).
      source: hotSet.has(symbol) ? 'hotbench' : 'catalyst',
      inBenchAtFreeze: bench.has(symbol),
      heldAtFreeze: held.has(symbol),
      status: pre === 'excluded' || pre === 'symbol_form' ? pre : 'read_unsettled',
    };
  });
  return {
    candidates,
    presentedCount,
    uniqueCount: unique.length + unrecordableCount,
    omittedCount: Math.max(0, unique.length - kept.length),
    unrecordableCount,
  };
}

/** The tick's selector as recorded: an unknown value is null, never guessed. */
export function selectorOf(value) {
  return SETUP_MENU_SELECTORS.includes(value) ? value : null;
}
