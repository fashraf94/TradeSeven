// api/_utils/tickStamps.js
//
// Phase B — the tick stamps (spec: docs/design/PHASE_B_TICK_STAMPS_SPEC_V1.md
// §1.1–1.4; discovery: docs/audits/20260908_PHASE_B_TICK_STAMPS_PHASE0_DISCOVERY.md;
// ledger D-110 → D-113). PURE, ZERO IMPORTS, Node-clean.
//
// Every decided check leaves three more facts on its own evaluation entry,
// composed by the cron AFTER the decision from objects the tick already holds
// — never a recomputation, never the model, never a doc re-read (discovery
// hazards 1, 3, 6). None changes a decision; the fenced decider reads a fixed
// whitelist of the entry (formatRecentEvals) and is inert to these keys.
//
//   heard      — { directiveThreadId, suppressed } derived from the cron's OWN
//                resolveControls call on the IN-MEMORY battle object (D-110).
//                The one claim it supports: this thread was in the decider's
//                prompt at this check. Never that it acted on it. `suppressed`
//                names a directive that existed but the assembler withheld
//                ('malformed' | 'mode_not_enforce' | 'epoch_killed') — those
//                ticks are NOT Heard and a client must not say so. Absent when
//                no directive was active. NEVER from the model's echo
//                (`ignoredDirectiveIds` / `directiveThreadId` on the entry are
//                self-report — the basis of Acted, never of Heard).
//   evidence   — per held position, the nine numbers the decider's own prompt
//                showed for it (D-111): { px, chg, atrX, vwapDev, bbPct, nr7,
//                rsPct, regime, risk }. Code-composed from the tick's objects;
//                `risk` carries `reason` only when non-HOLD. Bench evidence,
//                story ids and the fundamentals fields are cut by ruling;
//                `risk`, `atrX`, `vwapDev` are never cut (the three the cache
//                cannot reproduce). Every render labels it "what the decider
//                saw at the {slot} check" — distinct from the narrator's
//                CURRENT CONTEXT (a different vintage by declaration).
//   vintages   — ONE block per entry (never per field): the cadence words for
//                the quote / VWAP / technical sources plus two DATES — the
//                fundamentals vintage as a UTC date (`fundAsOf`, never a
//                cadence word) and the rankings doc's computedAt (`rankingsAt`).
//   candidates — the decider's own anticipation output (D-112): the four
//                required tool fields plus the optional `signalSource` tag;
//                `rationale` cut. Persisted here, rendered ONLY through the
//                D-103 composer (voiceLayerAnticipation.js) — `threshold` is
//                never rendered in the narrator's voice.
//
// Null honesty (C-20): an absent metric is `null`, never 0 or a default; an
// optional key is OMITTED, never `undefined` — Firestore rejects `undefined`
// (ignoreUndefinedProperties is unset), so one stray `undefined` in a stamp
// would fail the cron's ENTIRE finalUpdate. Numbers are stored at the precision
// the prompt rendered (two decimals for px / chg / atrX / vwapDev — BUILD_RULES
// §9: the stamp IS the rendered number, never a parallel source).
//
// The flag (TICK_STAMPS_ENABLED) is read at the ONE splice in
// api/cron/agent-evaluate.js, at call time; this module never reads a flag.
// The `haikuAttempted` gate lives HERE so it is unit-testable: a budget_skipped
// tick writes an entry without ever building the prompt (agent-evaluate.js
// skips the Haiku call before buildLiveContextBlock), so nothing was heard and
// nothing was seen — every stamp is absent on that entry (spec §1.2 for Heard;
// carried to the evidence because its label is "what the decider saw").

export const TICK_STAMP_KEYS = Object.freeze(['heard', 'evidence', 'vintages', 'candidates']);

export const EVIDENCE_FIELDS = Object.freeze([
  'px', 'chg', 'atrX', 'vwapDev', 'bbPct', 'nr7', 'rsPct', 'regime', 'risk',
]);

export const VINTAGE_FIELDS = Object.freeze(['quote', 'vwap', 'tech', 'fundAsOf', 'rankingsAt']);

export const CANDIDATE_FIELDS = Object.freeze([
  'symbol', 'direction', 'signalSummary', 'threshold', 'signalSource',
]);

/** The three `suppressed` values a directive can carry (controlPromptRenderer.js reasons for target 'directive'). */
export const HEARD_SUPPRESSED_REASONS = Object.freeze(['malformed', 'mode_not_enforce', 'epoch_killed']);

const round2 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strOrNull = (v) => (typeof v === 'string' && v ? v : null);

/** Epoch ms from a number, a Firestore Timestamp-like ({ toMillis }) or a Date; else null. */
function toMs(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v && typeof v.toMillis === 'function') return toMs(v.toMillis());
  if (v instanceof Date) return toMs(v.getTime());
  return null;
}

/**
 * The Heard stamp from a resolveControls() resolution.
 *
 * The resolution is exact about the directive it was handed: a null directive
 * leaves neither an effective directive nor a 'directive' descriptor; a
 * directive that was handed in is EITHER effective OR carried by exactly one
 * descriptor with its reason. So:
 *   effective              → { directiveThreadId, suppressed: null }   (Heard)
 *   descriptor 'directive' → { directiveThreadId: id, suppressed: reason } (NOT Heard)
 *   neither                → null — no directive was active; the key is absent.
 *
 * @param {{directive?: {effective: Object|null}, suppressionDescriptors?: Array}} controlResolution
 * @returns {{directiveThreadId: string, suppressed: null|string}|null}
 */
export function deriveHeardStamp(controlResolution) {
  const effective = controlResolution?.directive?.effective;
  if (effective && typeof effective.directiveThreadId === 'string' && effective.directiveThreadId) {
    return { directiveThreadId: effective.directiveThreadId, suppressed: null };
  }
  const descriptors = Array.isArray(controlResolution?.suppressionDescriptors)
    ? controlResolution.suppressionDescriptors
    : [];
  const withheld = descriptors.find((d) => d && d.target === 'directive');
  if (!withheld) return null;
  return {
    directiveThreadId: strOrNull(withheld.id) ?? 'unknown',
    suppressed: strOrNull(withheld.reason) ?? 'malformed',
  };
}

/**
 * `risk` for one position from the risk manager's per-symbol verdict:
 * `{ action }` on HOLD; `{ action, reason }` otherwise (reason falls back to
 * the verdict's `detail` only when it carries no `reason`, so a LOCK / action
 * verdict is never stamped bare). null when the position had no verdict.
 */
function composeRisk(verdict) {
  const action = strOrNull(verdict?.action);
  if (!action) return null;
  if (action === 'HOLD') return { action };
  return { action, reason: strOrNull(verdict.reason) ?? strOrNull(verdict.detail) };
}

/**
 * The evidence stamp: one nine-field record per HELD position, keyed by symbol,
 * iterated from `assetScores` — the very rows the decider's ACTIVE POSITIONS
 * CSV rendered (buildPortfolioCSV maps assetScores), so the stamped set is the
 * rendered set by construction: no bench name can enter.
 *
 * Sources (all objects in processAgentBattle scope at the entry):
 *   px      prices[sym].current            (the CSV's $Current, 2dp)
 *   chg     prices[sym].changePercent      (the quote's session change % — the
 *                                           risk manager's dailyPct input; the
 *                                           bench CSV's Daily% column; 2dp)
 *   atrX    assetScores[i].multiplier      (the CSV's ATR Mult, 2dp — the
 *                                           decider's own proximity number)
 *   vwapDev momentumData.vwap[sym].vwapDeviation   (INTRADAY MOMENTUM, 2dp)
 *   bbPct   momentumData.rankings[sym].bBandwidthPercentile
 *   nr7     momentumData.rankings[sym].nr7Flag (boolean; null when no ranking row)
 *   rsPct   momentumData.techScoresMap[sym].factors.rsPercentile
 *   regime  stockRegimes[sym]              (the per-stock regime line)
 *   risk    riskStatus[sym]                (RISK STATUS — action, + reason when non-HOLD)
 *
 * @returns {Object<string, {px, chg, atrX, vwapDev, bbPct, nr7, rsPct, regime, risk}>}
 */
export function composeEvidenceStamp({ assetScores, prices, momentumData, stockRegimes, riskStatus }) {
  const evidence = {};
  for (const score of Array.isArray(assetScores) ? assetScores : []) {
    const sym = score?.symbol;
    if (typeof sym !== 'string' || !sym || evidence[sym]) continue;
    const quote = prices?.[sym] || null;
    const vwapInfo = momentumData?.vwap?.[sym] || null;
    const rankInfo = momentumData?.rankings?.[sym] || null;
    const tech = momentumData?.techScoresMap?.[sym] || null;
    evidence[sym] = {
      px: round2(quote?.current),
      chg: round2(quote?.changePercent),
      atrX: round2(score.multiplier),
      vwapDev: round2(vwapInfo?.vwapDeviation),
      bbPct: numOrNull(rankInfo?.bBandwidthPercentile),
      nr7: rankInfo ? rankInfo.nr7Flag === true : null,
      rsPct: numOrNull(tech?.factors?.rsPercentile),
      regime: strOrNull(stockRegimes?.[sym]),
      risk: composeRisk(riskStatus?.[sym]),
    };
  }
  return evidence;
}

/**
 * The vintages block — ONE per entry. Cadence words for the three per-tick /
 * daily sources; DATES for the two doc-borne vintages:
 *   fundAsOf    the NEWEST fundamentals `computedAt` across the held book, as a
 *               UTC calendar date (YYYY-MM-DD) — the same "as of" rule the
 *               decider's FUNDAMENTALS block applies to its own vintage line.
 *               A date, never a cadence word: the mirror's refresh cadence is
 *               the producer's business, and a word would be a claim the stamp
 *               cannot support. null when no held symbol carries one.
 *   rankingsAt  the stockRankings doc's computedAt as an ISO instant (the
 *               intraday-recomputed source behind bbPct / nr7). null when the
 *               doc carried none.
 *
 * @param {{heldSymbols: string[], rankingsMap?: Object, rankingsComputedAtMs?: number|null}} p
 */
export function composeVintages({ heldSymbols, rankingsMap, rankingsComputedAtMs }) {
  let fundMs = null;
  for (const sym of Array.isArray(heldSymbols) ? heldSymbols : []) {
    const ms = toMs(rankingsMap?.[sym]?.fundamentals?.computedAt);
    if (ms != null && (fundMs == null || ms > fundMs)) fundMs = ms;
  }
  const rankMs = toMs(rankingsComputedAtMs);
  return {
    quote: 'tick',
    vwap: 'tick',
    tech: 'daily',
    fundAsOf: fundMs == null ? null : new Date(fundMs).toISOString().slice(0, 10),
    rankingsAt: rankMs == null ? null : new Date(rankMs).toISOString(),
  };
}

/**
 * The candidates stamp from the model's raw `anticipationCandidates` tool
 * items, admitted by the SAME rule the cron's dispatch queue applies (an object
 * with a truthy `symbol`): the four required fields plus the optional
 * `signalSource` tag (present only when the model sent a non-empty string);
 * `rationale` cut. null when nothing qualifies — the caller omits the key.
 *
 * @param {Array|undefined} anticipationCandidates
 * @returns {Array<{symbol: string, direction: string|null, signalSummary: string|null, threshold: string|null, signalSource?: string}>|null}
 */
export function composeCandidatesStamp(anticipationCandidates) {
  if (!Array.isArray(anticipationCandidates)) return null;
  const out = [];
  for (const c of anticipationCandidates) {
    if (!c || typeof c !== 'object' || !c.symbol) continue;
    const item = {
      symbol: String(c.symbol),
      direction: strOrNull(c.direction),
      signalSummary: strOrNull(c.signalSummary),
      threshold: strOrNull(c.threshold),
    };
    if (typeof c.signalSource === 'string' && c.signalSource) item.signalSource = c.signalSource;
    out.push(item);
  }
  return out.length > 0 ? out : null;
}

/**
 * The three stamps for one entry, as the object the cron spreads onto the
 * composed `evaluation` (keys only — never a top-level battle key).
 *
 * Gate: `haikuAttempted === true` — the prompt was built and sent (a timed-out
 * or truncated tick still rendered it, so Heard and the evidence are true
 * there with no decision); a budget_skipped tick never built it, so every key
 * is absent ({}).
 *
 * @param {Object} p
 * @param {boolean} p.haikuAttempted           agent-evaluate.js's own flag for this tick
 * @param {Object} p.controlResolution         the cron's resolveControls() result (same
 *                                             argument list as the fenced assembler, on the
 *                                             in-memory battle)
 * @param {Array}  [p.anticipationCandidates]  haikuResult.anticipationCandidates
 * @param {Array}  p.assetScores               fenced scorer output for the held book
 * @param {Object} p.prices                    the tick's quote table
 * @param {Object} p.momentumData              { vwap, rankings, rankingsMap, techScoresMap, … }
 * @param {Object} p.stockRegimes              per-symbol regime words
 * @param {Object} p.riskStatus                per-symbol risk verdicts
 * @param {number|null} [p.rankingsComputedAtMs] the stockRankings doc's computedAt (ms)
 */
export function composeTickStamps({
  haikuAttempted,
  controlResolution,
  anticipationCandidates,
  assetScores,
  prices,
  momentumData,
  stockRegimes,
  riskStatus,
  rankingsComputedAtMs = null,
}) {
  if (haikuAttempted !== true) return {};
  const stamps = {};
  const heard = deriveHeardStamp(controlResolution);
  if (heard) stamps.heard = heard;
  stamps.evidence = composeEvidenceStamp({ assetScores, prices, momentumData, stockRegimes, riskStatus });
  stamps.vintages = composeVintages({
    heldSymbols: Object.keys(stamps.evidence),
    rankingsMap: momentumData?.rankingsMap,
    rankingsComputedAtMs,
  });
  const candidates = composeCandidatesStamp(anticipationCandidates);
  if (candidates) stamps.candidates = candidates;
  return stamps;
}
