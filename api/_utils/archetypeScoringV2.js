// api/_utils/archetypeScoringV2.js
//
// Archetype Rank Interface V2 — the V2 scoring pipeline (spec §3 / §4 / §5,
// docs/specs/ARCHETYPE_RANK_INTERFACE_V2_BUILD_SPEC_V1_3.md):
//
//     filter (deterministic, pre-model)  →  score (weighted axes)
//       →  bounded sector interleave (Diversifier)  →  game-mode blend (P-7)
//
// FENCE STATUS (P-2, BUILD_RULES §1): NON-FENCED during the dark build. The
// §1-fenced engine (archetypeScoring.js) carries the founder-sanctioned
// three-line entry — one import, one `opts = {}` parameter, one dispatch line
// — and nothing else. The flag read lives HERE, never in the fenced file. At
// flip this module joins the §1 fence list: it is the scoring engine from that
// moment.
//
// DARK BY DESIGN: ARCHETYPE_VECTORS_V2_ENABLED ships false. maybeCompute…()
// returns null while it is off, so the fenced engine is byte-identical to V1
// (flag-off byte-identity is snapshot-tested in archetypeScoring.v2dispatch.test.js).
//
// IMPORTS: nothing from the fenced files or tables. The archetype key list is
// the weights table's own key set (ARCHETYPE_KEYS_V2); archetypeScoringV2.test.js
// pins it equal to the registry's source list (archetypeRegistry.listArchetypeIds()
// returns VALID_ARCHETYPES verbatim, archetypeRegistry.js:88-90). The registry
// module itself pulls node:fs and cannot be imported from this client-reachable
// graph (useTrainingDraft.js → archetypeScoring.js → here), so the pin lives in
// the test, not in a runtime import.
//
// FLAG READ (V-15 + the COMMAND_CENTER_SYNC_ENABLED hazard note): read at CALL
// time through a namespace import, inside try/catch, and only `=== true` counts.
// 15+ suites vi.mock featureFlags.js with a bare factory; on those mocks a
// missing export is undefined (or a throwing proxy) — either way V1 runs.
//
// CONTRACT (§4): opts.gameMode is REQUIRED — one of GAME_MODES_V2 — and an
// unknown mode or archetype THROWS (P-5, P-14; fail closed, never a silent
// analyst fallback). Every caller's throw path is loud (V-5 census). Return
// objects carry `archetypeScore` (the mode-blended final — what every caller
// sorts and the fenced ARCH column renders) and `archetypeBaseScore` (P-7).
//
// EVENTS (§3.3(a), §3.4): `axes_fallback_computed`, `insufficient_axis_coverage`,
// `diversifier_interleave_gap_blocked` go to opts.onEvent when supplied (the
// producer collects them into the observation snapshot), else console.warn.

import * as featureFlags from '../../src/config/featureFlags.js';
import {
  deriveAxes,
  computeUniverseMedianReturn1W,
  countAxisNulls,
  round1,
  isFiniteNumber,
  clamp100,
} from './axisDerivation.js';

// ---------- flag ----------

export function isArchetypeVectorsV2Enabled() {
  try {
    return featureFlags.ARCHETYPE_VECTORS_V2_ENABLED === true;
  } catch {
    return false;
  }
}

// ---------- errors ----------

export class ArchetypeScoringV2Error extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'ArchetypeScoringV2Error';
    this.code = code;
  }
}

// ---------- §4 game modes (P-5: no 'mandate' — it has no caller; unknown throws) ----------

export const GAME_MODES_V2 = Object.freeze(['baggerBomb', 'standard', 'tournament', 'training', 'scouting']);

// One entry per mode (§4). Only BaggerBomb blends the caller-owned game-mode
// term (R9); every other mode's final score IS the base score.
export const GAME_MODE_BLEND_V2 = Object.freeze({
  baggerBomb: Object.freeze({ archetypeBaseScore: 0.80, baggerBombFit: 0.20 }),
  standard: Object.freeze({ archetypeBaseScore: 1.00, baggerBombFit: 0 }),
  tournament: Object.freeze({ archetypeBaseScore: 1.00, baggerBombFit: 0 }),
  training: Object.freeze({ archetypeBaseScore: 1.00, baggerBombFit: 0 }),
  scouting: Object.freeze({ archetypeBaseScore: 1.00, baggerBombFit: 0 }),
});

// §3.4 per-caller pinned minimums (V-7 / R-13), resolved by mode when a caller
// does not pass opts.minCandidates. Callers whose pinned minimum differs from
// the mode default pass it explicitly (the agent-draft catalog: 36; the client
// overlay: 5). 'standard' (the producer) mirrors the §6 flip gate (≥ 35 per
// archetype per snapshot) so the coverage event in a snapshot IS the gate check.
export const GAME_MODE_MIN_CANDIDATES_V2 = Object.freeze({
  baggerBomb: 35,
  standard: 35,
  tournament: 15,
  training: 1,
  scouting: 10,
});

// ---------- §3.2 weights (starting values, config; tuned during observation) ----------
// Non-negative, each vector sums to 1.00 (test 7). Only positive weights are
// listed: an axis absent here carries no weight and never excludes (R10 applies
// to weighted axes only). P-6: Trend Follower `quality` and Speculator
// `dislocation` are zero so neither excludes a name for lacking a fundamentals
// doc or 200 bars.
export const ARCHETYPE_WEIGHTS_V2 = Object.freeze({
  momentum_chaser: Object.freeze({ strength: 0.40, persistence: 0.45, volatility: 0.15 }),
  contrarian: Object.freeze({ quality: 0.40, persistence: 0.15, dislocation: 0.45 }),
  degen: Object.freeze({ strength: 0.20, persistence: 0.20, volatility: 0.60 }),
  analyst: Object.freeze({ quality: 0.50, strength: 0.30, persistence: 0.20 }),
  diversifier: Object.freeze({ quality: 0.30, strength: 0.30, persistence: 0.30, volatility: 0.10 }),
  guardian: Object.freeze({ quality: 0.45, strength: 0.05, persistence: 0.15, calm: 0.35 }),
});

/** The six archetype code-ids the V2 tables cover — pinned equal to the registry's list in the test. */
export const ARCHETYPE_KEYS_V2 = Object.freeze(Object.keys(ARCHETYPE_WEIGHTS_V2));

// ---------- §3.1 filters (deterministic, pre-model; signed percent — P-1) ----------
// `axis` rows read the derived axes; `field` rows read the raw persisted gate
// field. `min`/`max` are inclusive. `minFn: 'weekFloor'` resolves to
// min(0, universe_median_return1W) (P-13). null on any filtered value fails.
export const ARCHETYPE_FILTERS_V2 = Object.freeze({
  momentum_chaser: Object.freeze([]),
  contrarian: Object.freeze([
    Object.freeze({ axis: 'quality', min: 35 }),                // business not broken (sector-relative)
    Object.freeze({ field: 'return1M', min: -25 }),             // price not collapsed (signed %; config)
    Object.freeze({ field: 'return1W', minFn: 'weekFloor' }),   // weekFloor = min(0, universe_median_return1W)
  ]),
  degen: Object.freeze([]),
  analyst: Object.freeze([Object.freeze({ axis: 'quality', min: 40 })]),
  diversifier: Object.freeze([]),
  guardian: Object.freeze([
    Object.freeze({ axis: 'quality', min: 45 }),
    Object.freeze({ axis: 'volatility', max: 75 }),
  ]),
});

// ---------- §3.3(a) bounded sector interleave (Diversifier only) ----------
export const ARCHETYPE_INTERLEAVE_V2 = Object.freeze({
  diversifier: Object.freeze({ targetDistinctSectorsTop10: 5, maxPerSectorTop10: 2, maxInterleaveScoreGap: 10 }),
});
export const INTERLEAVE_TOP_N = 10;

// ---------- §3.5 narration (DARK: ships to the prompt path in the flip PR) ----------
// Every factual claim is true of the post-filter list and references only
// CSV-visible columns (test 14). NOT consumed by any prompt path in Job 1 —
// the fenced assemblers still render ARCHETYPE_CONSTRAINTS (v1); the flip PR
// swaps them and registers this module in PROMPT_CONTRIBUTING_MODULES (F-C).
export const ARCHETYPE_CONSTRAINTS_V2 = Object.freeze({
  momentum_chaser:
    'ARCH ranks names by momentum persistence and chart strength. Prefer names near the top. Use the SECTOR column to notice where strength is clustering and lean into it.',
  contrarian:
    'ARCH ranks beaten-down names that clear a sector-relative quality floor, are not in a collapse (names down more than 25% on the month are excluded), and either did not fall over the past week or — in a broad down week — fell less than the median name. Do not chase high TECH scores. Prefer names near the top.',
  degen:
    'ARCH ranks names using realized volatility, persistence, and chart strength. Prefer high ATR_PCT. Fundamentals are not part of this rank.',
  analyst:
    'Every name on this list already clears your quality floor (FUND ≥ 40). ARCH ranks quality first, chart setup second. Prefer FUND above 70 and a TECH score that says the setup is working now.',
  diversifier:
    'This list is ordered for breadth near the top: the best name from each of several sectors comes first. Your shortlist must span at least 5 sectors, no sector more than twice.',
  guardian:
    'Every name on this list clears your sector-relative quality floor and your volatility cap (ATR_PCT ≤ 0.75). ARCH ranks quality and calm. Prefer names near the top. Prefer not to hold all three stocks in one sector unless the alternatives are clearly less safe.',
});

// ---------- internals ----------

function makeEmitter(opts, archetype, gameMode) {
  const onEvent = typeof opts?.onEvent === 'function' ? opts.onEvent : null;
  return (type, payload) => {
    const event = { type, archetype, gameMode, ...payload };
    if (onEvent) onEvent(event);
    else console.warn(`[archetypeScoringV2] ${type}`, JSON.stringify(event));
  };
}

const hasPersistedAxes = (s) => s != null && typeof s === 'object' && s.axes != null && typeof s.axes === 'object';

/**
 * Persisted axes, or the P-8 fallback: if ANY stock lacks `axes` — with
 * opts.universeSize and a shorter input → throw axes_subset_unavailable
 * (cross-sectional axes cannot be derived on a subset); otherwise derive over
 * the FULL input via the same deriveAxes and log. Never mixes persisted and
 * derived axes.
 */
function resolveAxes(input, opts, emit) {
  if (input.length === 0) return { axesList: [], derived: false };
  if (input.every(hasPersistedAxes)) return { axesList: input.map((s) => s.axes), derived: false };
  const universeSize = isFiniteNumber(opts.universeSize) ? opts.universeSize : null;
  if (universeSize != null && input.length < universeSize) {
    throw new ArchetypeScoringV2Error(
      'axes_subset_unavailable',
      `${input.length} of ${universeSize} universe names supplied without persisted axes`,
    );
  }
  const axesList = deriveAxes(input);
  emit('axes_fallback_computed', { count: input.length, universeSize });
  return { axesList, derived: true };
}

/**
 * The P-13 week floor: min(0, universe_median_return1W). The doc-level median
 * is supplied by the caller (opts.universeMedianReturn1W — null when the doc
 * carries no return data ⇒ the absolute ≥ 0 gate). When it is NOT supplied the
 * input must be the full universe (a known subset throws, as for axes) and the
 * median is computed over it — identical to the doc value by construction.
 */
function resolveWeekFloor(input, opts, emit) {
  const supplied = opts.universeMedianReturn1W;
  if (supplied !== undefined) {
    // Supplied by the caller from the doc: a finite value is the median; null (or
    // anything non-finite — the same reading the doc parsers apply) is "no return
    // data" ⇒ the absolute ≥ 0 gate.
    return isFiniteNumber(supplied) ? Math.min(0, supplied) : 0;
  }
  const universeSize = isFiniteNumber(opts.universeSize) ? opts.universeSize : null;
  if (universeSize != null && input.length < universeSize) {
    throw new ArchetypeScoringV2Error(
      'axes_subset_unavailable',
      'universe_median_return1W not supplied for a subset — the week floor is never computed on a subset',
    );
  }
  const median = computeUniverseMedianReturn1W(input);
  emit('week_floor_computed', { median, count: input.length, universeSize });
  return median == null ? 0 : Math.min(0, median);
}

const filterLabel = (f) => (f.axis
  ? `${f.axis}${f.min != null ? `>=${f.min}` : ''}${f.max != null ? `<=${f.max}` : ''}`
  : `${f.field}>=${f.minFn === 'weekFloor' ? 'weekFloor' : f.min}`);

/** The first failing filter row, or null when every row passes (null fails — R10). */
function failingFilter(stock, axes, filters, weekFloor) {
  for (const f of filters) {
    if (f.axis) {
      const v = axes[f.axis];
      if (!isFiniteNumber(v)) return f;
      if (f.min != null && v < f.min) return f;
      if (f.max != null && v > f.max) return f;
    } else if (f.field) {
      const v = stock?.[f.field];
      if (!isFiniteNumber(v)) return f;
      const min = f.minFn === 'weekFloor' ? weekFloor : f.min;
      if (min != null && v < min) return f;
      if (f.max != null && v > f.max) return f;
    }
  }
  return null;
}

/**
 * Global order: archetypeScore desc, then — for the Diversifier only (§3.3(a)
 * step 4) — quality desc (null last), then symbol asc. Every other archetype
 * breaks a tie by symbol alone: a Speculator or Trend Follower never ranks by
 * FUND at a tie (§3.5 "Fundamentals are not part of this rank", P-6).
 */
function compareRanked(a, b, qualityTiebreak) {
  if (b.archetypeScore !== a.archetypeScore) return b.archetypeScore - a.archetypeScore;
  if (qualityTiebreak) {
    const qa = a.axes?.quality;
    const qb = b.axes?.quality;
    const qan = isFiniteNumber(qa);
    const qbn = isFiniteNumber(qb);
    if (qan !== qbn) return qan ? -1 : 1;
    if (qan && qb !== qa) return qb - qa;
  }
  const sa = String(a.symbol ?? '');
  const sb = String(b.symbol ?? '');
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

const sectorOf = (s) => {
  const n = s?.sectorName;
  return typeof n === 'string' && n.length > 0 && n !== 'Unknown' ? n : null;
};

/**
 * §3.3(a) bounded sector interleave over the top INTERLEAVE_TOP_N of a
 * globally-sorted list. Deterministic. Never changes any score — only order.
 *
 * Eligible = unplaced, not skipped, whose sector has not reached maxPerSectorTop10
 * in the top 10; a null / 'Unknown' sector is NEVER eligible for the breadth
 * phase (P-12). Breadth phase: while distinct sectors placed < target — anchor =
 * best eligible; the candidate = the best eligible name from an UNREPRESENTED
 * sector (the highest-scoring among unrepresented sectors' bests, which in
 * global order is simply the first such name). Place it if its score ≥ anchor −
 * gap, else stop and emit diversifier_interleave_gap_blocked. Every eligible
 * name ranked above the placed one was passed over: it is SKIPPED — never
 * reconsidered in the breadth phase (it stays in global order for the fill).
 * Fill phase: remaining top-10 by eligible global order (null-sector names
 * allowed, the per-sector cap still holds). Below rank 10: global order, no cap.
 */
function applyBoundedInterleave(sorted, cfg, emit) {
  const { targetDistinctSectorsTop10: target, maxPerSectorTop10: maxPer, maxInterleaveScoreGap: gap } = cfg;
  const placed = [];
  const placedSet = new Set();
  const skipped = new Set();
  const sectorCount = new Map();
  const count = (sec) => sectorCount.get(sec) || 0;
  const bump = (sec) => { if (sec != null) sectorCount.set(sec, count(sec) + 1); };

  // Breadth phase.
  while (placed.length < INTERLEAVE_TOP_N && sectorCount.size < target) {
    const eligible = sorted.filter((s) => !placedSet.has(s) && !skipped.has(s)
      && sectorOf(s) != null && count(sectorOf(s)) < maxPer);
    const anchor = eligible[0] ?? null;
    const candidate = eligible.find((s) => count(sectorOf(s)) === 0) ?? null;
    // Scores are 1-dp numbers: compare the gap at that resolution so a candidate
    // exactly `gap` below the anchor qualifies (64.4 − 10 is not 54.4 in floats).
    const gapBlocked = anchor != null && candidate != null
      && Math.round((anchor.archetypeScore - candidate.archetypeScore) * 10) > Math.round(gap * 10);
    if (anchor == null || candidate == null || gapBlocked) {
      // "If none qualifies, stop the breadth phase and emit … with counts" —
      // whether the gap blocked the best unrepresented name, no unrepresented
      // sector is left among the eligible names, or nothing eligible remains.
      emit('diversifier_interleave_gap_blocked', {
        reason: gapBlocked ? 'gap' : candidate == null && anchor != null ? 'no_unrepresented_sector' : 'no_eligible',
        placed: placed.length,
        distinctSectors: sectorCount.size,
        targetDistinctSectors: target,
        anchor: anchor?.symbol ?? null,
        anchorScore: anchor?.archetypeScore ?? null,
        bestUnrepresented: candidate?.symbol ?? null,
        bestUnrepresentedScore: candidate?.archetypeScore ?? null,
        maxInterleaveScoreGap: gap,
      });
      break;
    }
    for (const s of eligible) {
      if (s === candidate) break;
      skipped.add(s);
    }
    placed.push(candidate);
    placedSet.add(candidate);
    bump(sectorOf(candidate));
  }

  // Fill phase — the rest of the top 10 by global order under the cap.
  for (const s of sorted) {
    if (placed.length >= INTERLEAVE_TOP_N) break;
    if (placedSet.has(s)) continue;
    const sec = sectorOf(s);
    if (sec != null && count(sec) >= maxPer) continue;
    placed.push(s);
    placedSet.add(s);
    bump(sec);
  }

  // Below rank 10 — global order, no cap.
  const rest = sorted.filter((s) => !placedSet.has(s));
  return placed.concat(rest);
}

// ---------- the pipeline ----------

/**
 * computeArchetypeRankingsV2(stocks, archetype, opts)
 *   opts.gameMode                REQUIRED — one of GAME_MODES_V2 (throws otherwise)
 *   opts.universeSize            the doc's axes_universe_size (subset callers — P-8)
 *   opts.universeMedianReturn1W  the doc's universe_median_return1W (P-13 week floor)
 *   opts.minCandidates           the caller's pinned minimum (§3.4); mode default otherwise
 *   opts.onEvent                 event sink (default: console.warn)
 * Returns a NEW array (input never mutated) of { ...stock, axes, archetypeScore,
 * archetypeBaseScore }, sorted for the caller (interleaved for the Diversifier).
 * Excluded names (any filtered value null / failing, any weighted axis null,
 * a null baggerBombFit under 'baggerBomb') are ABSENT — never averaged (R10).
 */
export function computeArchetypeRankingsV2(stocks, archetype, opts = {}) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const gameMode = options.gameMode;
  if (!GAME_MODES_V2.includes(gameMode)) {
    throw new ArchetypeScoringV2Error(
      'archetype_game_mode_required',
      `opts.gameMode must be one of ${GAME_MODES_V2.join(' | ')} (got ${String(gameMode)})`,
    );
  }
  const weights = typeof archetype === 'string' && ARCHETYPE_KEYS_V2.includes(archetype)
    ? ARCHETYPE_WEIGHTS_V2[archetype]
    : null;
  if (!weights) {
    throw new ArchetypeScoringV2Error('archetype_unknown', String(archetype));
  }
  const input = Array.isArray(stocks) ? stocks : [];
  const emit = makeEmitter(options, archetype, gameMode);
  const filters = ARCHETYPE_FILTERS_V2[archetype] || [];
  const blend = GAME_MODE_BLEND_V2[gameMode];
  const needsBaggerBombFit = blend.baggerBombFit > 0;
  const weightedAxes = Object.entries(weights).filter(([, w]) => w > 0);

  // 1. Axes — persisted or derived over the full input, never mixed.
  const { axesList, derived } = resolveAxes(input, options, emit);
  // 2. The week floor (only the Contrarian reads it; resolved lazily). An empty
  //    input has nothing to gate — it returns [] like every other archetype
  //    (never a subset throw on zero names).
  const weekFloor = input.length > 0 && filters.some((f) => f.minFn === 'weekFloor')
    ? resolveWeekFloor(input, options, emit)
    : null;

  // 3. Filter → 4. score.
  const gateFailCounts = {};
  const nullAxisExclusions = {};
  let baggerBombFitNullExclusions = 0;
  const scored = [];
  input.forEach((stock, i) => {
    const axes = axesList[i];
    const failed = failingFilter(stock, axes, filters, weekFloor);
    if (failed) {
      const label = filterLabel(failed);
      gateFailCounts[label] = (gateFailCounts[label] || 0) + 1;
      return;
    }
    const nullAxis = weightedAxes.find(([axis]) => !isFiniteNumber(axes[axis]));
    if (nullAxis) {
      nullAxisExclusions[nullAxis[0]] = (nullAxisExclusions[nullAxis[0]] || 0) + 1;
      return;
    }
    if (needsBaggerBombFit && !isFiniteNumber(stock?.baggerBombFit)) {
      baggerBombFitNullExclusions += 1;
      return;
    }
    let base = 0;
    for (const [axis, w] of weightedAxes) base += w * axes[axis];
    const archetypeBaseScore = round1(clamp100(base));
    const archetypeScore = needsBaggerBombFit
      ? round1(clamp100(blend.archetypeBaseScore * archetypeBaseScore + blend.baggerBombFit * stock.baggerBombFit))
      : archetypeBaseScore;
    scored.push({ ...stock, axes, archetypeScore, archetypeBaseScore });
  });

  // 5. Order → 6. compose.
  const interleave = ARCHETYPE_INTERLEAVE_V2[archetype];
  scored.sort((a, b) => compareRanked(a, b, Boolean(interleave)));
  const ranked = interleave ? applyBoundedInterleave(scored, interleave, emit) : scored;

  // 7. Coverage (§3.4): shorter than the caller's pinned minimum ⇒ event.
  const minCandidates = isFiniteNumber(options.minCandidates)
    ? options.minCandidates
    : GAME_MODE_MIN_CANDIDATES_V2[gameMode];
  if (ranked.length < minCandidates) {
    emit('insufficient_axis_coverage', {
      minCandidates,
      candidates: ranked.length,
      universe: input.length,
      axisNullCounts: countAxisNulls(axesList),
      gateFailCounts,
      nullAxisExclusions,
      baggerBombFitNullExclusions,
      derivedAxes: derived,
    });
  }
  return ranked;
}

/**
 * The fenced engine's ONE dispatch target (P-2): null while the flag is off
 * (the V1 body runs untouched); the V2 ranking when it is on. The fenced line
 * is `const v2 = maybeComputeArchetypeRankingsV2(stocks, archetype, opts); if (v2) return v2;`
 * — an empty V2 result ([]) is truthy and is returned as-is; only null falls
 * through to V1.
 */
export function maybeComputeArchetypeRankingsV2(stocks, archetype, opts = {}) {
  if (!isArchetypeVectorsV2Enabled()) return null;
  return computeArchetypeRankingsV2(stocks, archetype, opts);
}
