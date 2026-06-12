// src/utils/boardPrefillCore.js
//
// P5 — the ONE pure core for user draft-board prefill assembly (Spec §3
// default, founder-confirmed June 11, 2026: equipped-watchlist names in their
// stored order, then scout-alert symbols not already present, intersected
// with the group's draftable pool, sliced to board depth). Both derivations
// route through this module so they can never fork:
//   - client: src/services/tournamentGroupService.js assembleBoardPrefill
//     (browser-SDK reads) seeding BoardEditor
//   - server: api/_utils/tournamentBoardAutoCommit.js deriveServerBoardPrefill
//     (Admin-SDK reads — the P5 deadline auto-commit's prefill twin)
// The ∩ userPool step lives HERE: before P5 it lived only in the BoardEditor
// consumer (BoardEditor.jsx seeding effect), which a naive server twin of the
// service function alone would have forked.
//
// ZERO-IMPORT MODULE, BY RULE (the leagueTournament.js precedent): client and
// api/ both read it, so its transitive import surface must stay Node-clean.
// Depth values are caller-supplied (TOURNAMENT_TUNING stays the one home).

/**
 * Trim/uppercase/dedupe symbol strings, dropping empties and non-strings.
 * Lifted verbatim from the P1a client prefill (tournamentGroupService.js),
 * now the shared cleaning step for both derivations.
 */
export function cleanSymbols(values) {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const symbol = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(symbol);
  }
  return out;
}

/**
 * The prefill suggestion: equipped names first (stored order), then scout
 * alerts not already present, intersected with the draftable pool, sliced to
 * depthMax. `userPool: null` skips the intersection (no caller does this
 * today — both derivations pass the group pool — but the semantics are
 * explicit rather than an accidental empty-pool wipe).
 */
export function composeBoardPrefill({ equippedSymbols = [], scoutAlertSymbols = [], userPool = null, depthMax = null } = {}) {
  const pool = userPool == null ? null : new Set(cleanSymbols(userPool));
  const merged = cleanSymbols([...equippedSymbols, ...scoutAlertSymbols])
    .filter(symbol => pool == null || pool.has(symbol));
  return Number.isInteger(depthMax) ? merged.slice(0, depthMax) : merged;
}

/**
 * The no-watchlist floor (P5 ratified proposal B, generalized to ANY short
 * prefill): pad a board up to depthMin from the ranked candidate list
 * (archetype ranking) intersected with the pool, then from the ranked pool
 * itself (the pool is stored in ranked order — resolve-user-draft.js; the
 * buildCpuUserBoard ranked-slice precedent). Never duplicates, never exceeds
 * depthMin, never mutates inputs. `floored` reports whether padding happened
 * — the caller's loud-log and feed-entry signal.
 */
export function padBoardToFloor({ board = [], rankedCandidates = [], rankedPool = [], depthMin = 0 } = {}) {
  const out = [...board];
  const seen = new Set(out);
  const pool = new Set(cleanSymbols(rankedPool));
  for (const source of [rankedCandidates, rankedPool]) {
    for (const raw of source) {
      if (out.length >= depthMin) break;
      const symbol = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
      if (!symbol || seen.has(symbol) || !pool.has(symbol)) continue;
      seen.add(symbol);
      out.push(symbol);
    }
    if (out.length >= depthMin) break;
  }
  return { board: out, floored: out.length > board.length };
}
