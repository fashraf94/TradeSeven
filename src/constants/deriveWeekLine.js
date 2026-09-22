// src/constants/deriveWeekLine.js
//
// Backing Beta PR 4 — THE DERIVED LINE (design brief rev2 §2, rev3 §2; spec
// V1.3 §5 Team Card, §9 honesty). One short line on the team card, built ONLY
// from a completed week's RECORDED data: how many of the human's three drafted
// picks they held all week, how many swaps both layers made, and — only when
// the repo's own sector data covers every held name — what they leaned toward.
//
// ZERO-IMPORT MODULE, BY RULE (the backing.js / eligibility.js precedent). The
// team-card projection (api/tournament/team-card.js) computes this line
// server-side under the revised June 2026 import rule (BUILD_RULES §4), so its
// transitive import surface must stay Node-clean; zero imports makes that
// structural. The co-located test's real import of this module is the
// dependency-surface guard and locks the zero-import property — never mock it.
//
// THE RULE THAT GOVERNS EVERY CLAUSE: a clause is OMITTED when its source is
// absent — never guessed, defaulted or filled. The design's mock matched exact
// phrasings in fake data ("Held all week" strings, a hand-written `lean`
// field); real data has none of that, so this function reads FACTS the writers
// actually record and says nothing where they recorded nothing. In particular
// the lean clause renders only when the repo's sector map (the caller passes
// the lookup result, this module never imports one) covers EVERY held name;
// a single uncovered name omits the clause entirely rather than inferring from
// the rest. A first-week team, and a CPU seat, get `null` — the card then
// shows its own first-week / CPU state (spec §5), not an empty line.
//
// VOCABULARY: `Held n of m all week`, `no moves` / `1 move` / `n moves`,
// `leaned <sector>`, joined with ` · `. Guarded by the backing copy guard
// (backingCopy.guard.test.js) like every other user-facing backing string.

/** The clause separator — the design's middle dot, one source. */
export const WEEK_LINE_SEPARATOR = ' · ';

/**
 * @typedef {Object} CompletedWeekFacts
 * @property {boolean} [isCpu]            a CPU seat shows no history (spec §5)
 * @property {string[]|null} [drafted]     the human's drafted picks (streams/userDraft)
 * @property {string[]|null} [heldAtClose] the symbols on the roster at completion
 * @property {number|null} [userSwaps]     approved claims that week (user layer)
 * @property {number|null} [agentSwaps]    trades[] across the agent's battles (agent layer)
 * @property {Object<string,string>|null} [sectors] sector per symbol, from the
 *   repo's own data — ABSENT KEYS MEAN NO DATA, and the lean clause is omitted
 *   unless every held name is covered.
 */

function isSymbolList(value) {
  return Array.isArray(value) && value.every((s) => typeof s === 'string' && s.length > 0);
}

function isCount(value) {
  return Number.isInteger(value) && value >= 0;
}

/** The drafted names still on the roster at close — the "held" set, one definition. */
function heldNames(facts) {
  if (!isSymbolList(facts.drafted) || !isSymbolList(facts.heldAtClose)) return null;
  const atClose = new Set(facts.heldAtClose);
  return facts.drafted.filter((s) => atClose.has(s));
}

/**
 * The strict plurality sector across `names`, or null when any name lacks
 * sector data or two sectors tie. Sector keys are the data's own words; an
 * underscore-joined key reads as words on the card (`consumer_cyclical` →
 * `consumer cyclical`), nothing else is rewritten.
 */
function dominantSector(names, sectors) {
  if (!names || names.length === 0) return null;
  if (!sectors || typeof sectors !== 'object') return null;
  const counts = new Map();
  for (const name of names) {
    const sector = sectors[name];
    if (typeof sector !== 'string' || sector.length === 0) return null; // one gap → no clause
    counts.set(sector, (counts.get(sector) ?? 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  let tied = false;
  for (const [sector, count] of counts) {
    if (count > bestCount) { best = sector; bestCount = count; tied = false; }
    else if (count === bestCount) tied = true;
  }
  if (best === null || tied) return null;
  return best.replace(/_/g, ' ');
}

/**
 * The derived line for a completed week, or `null` when there is nothing
 * honest to say (no completed week, a CPU seat, or no recorded fact at all).
 *
 * @param {CompletedWeekFacts|null|undefined} completedWeek
 * @returns {string|null}
 */
export function deriveWeekLine(completedWeek) {
  if (completedWeek == null || typeof completedWeek !== 'object') return null;
  if (completedWeek.isCpu === true) return null;

  const clauses = [];

  // HELD — from the draft record and the roster at close, both required.
  const held = heldNames(completedWeek);
  if (held !== null && completedWeek.drafted.length > 0) {
    clauses.push(`Held ${held.length} of ${completedWeek.drafted.length} all week`);
  }

  // MOVES — swaps across BOTH layers, so both counts are required.
  if (isCount(completedWeek.userSwaps) && isCount(completedWeek.agentSwaps)) {
    const total = completedWeek.userSwaps + completedWeek.agentSwaps;
    clauses.push(total === 0 ? 'no moves' : total === 1 ? '1 move' : `${total} moves`);
  }

  // LEAN — only with sector data for every held name; omitted otherwise.
  const lean = dominantSector(held, completedWeek.sectors);
  if (lean !== null) clauses.push(`leaned ${lean}`);

  return clauses.length === 0 ? null : clauses.join(WEEK_LINE_SEPARATOR);
}
