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
//   evidence   — per held position, the numbers the decider's own prompt
//                RENDERED for it (D-111): { px, chg, atrX, vwapDev, bbPct, nr7,
//                regime, risk }. Code-composed from the tick's objects; `risk`
//                carries `reason` only when non-HOLD. Bench evidence, story
//                ids and the fundamentals fields are cut by ruling; `risk`,
//                `atrX`, `vwapDev` are never cut (the three the cache cannot
//                reproduce). The ruled `rsPct` is NOT stamped (review A-2): the
//                prompt renders `rsPercentile` for BENCH names only
//                (buildBenchTechnicalBlock); a held name's technical read
//                reaches the decider as the `regime` word, which IS stamped.
//                Every render labels it "what the decider saw at the {slot}
//                check" — distinct from the narrator's CURRENT CONTEXT (a
//                different vintage by declaration).
//   vintages   — ONE block per entry (never per field): `quote` / `vwap` are
//                fetched this tick ('tick' — true by construction); the three
//                doc-borne sources carry INSTANTS or DATES, never a cadence
//                word the stamp cannot support — `techAt` (the newest held
//                stockTechnicalScores `updatedAt`; those docs are rewritten
//                hourly during RTH, so 'daily' would be false — review A-3),
//                `fundAsOf` (the fundamentals vintage as a UTC date, the
//                FUNDAMENTALS block's own header rule) and `rankingsAt` (the
//                stockRankings doc's computedAt).
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
// the prompt rendered, BY THE RENDERER'S OWN PRIMITIVE — `Number(v.toFixed(2))`
// for px / chg / atrX / vwapDev, the same `toFixed(2)` the CSV and the momentum
// snapshot print (BUILD_RULES §9: the stamp IS the rendered number, never a
// parallel rounding — `Math.round(v*100)/100` disagrees with `toFixed(2)` on
// ~0.4 % of inputs, review A-5 / C-2).
//
// Two honesty notes for readers of the `risk` field (review A-7 / A-8): for a
// LOCK the prompt renders the verdict's `detail` sentence while the stamp keeps
// the `reason` CODE (`threshold_proximity`) — the same verdict, the compact
// form; and on an all-HOLD tick the prompt renders no RISK STATUS block at all
// (it prints only when some position is non-HOLD), so `{ action: 'HOLD' }` is
// the engine's verdict the decider saw by the block's ABSENCE, not by a line.
// And `suppressed: 'malformed'` is reachable from the cron only through a
// type-corrupt directive (a non-string truthy `text`): the shared
// `isDirectiveActive` pre-gate strips an id-less or text-less directive before
// the resolver sees it, so that case arrives as NO directive and the key is
// simply absent (review A-10).
//
// The flag (TICK_STAMPS_ENABLED) is read at the ONE splice in
// api/cron/agent-evaluate.js, at call time; this module never reads a flag.
// The `promptBuilt` gate lives HERE so it is unit-testable: the cron sets it
// only after the three prompt parts have been built and immediately before the
// transport call (review A-4 / B-1 — `haikuAttempted` alone is set BEFORE the
// build, so a builder throw would have stamped a prompt that never existed). A
// budget_skipped tick never builds the prompt; a builder throw never finishes
// it; on both nothing was heard and nothing was seen — every stamp is absent
// (spec §1.2 for Heard; carried to the evidence because its label is "what the
// decider saw"). A timed-out or truncated tick DID build and send the prompt —
// the stamps are true there with no decision.

export const TICK_STAMP_KEYS = Object.freeze(['heard', 'evidence', 'vintages', 'candidates']);

export const EVIDENCE_FIELDS = Object.freeze([
  'px', 'chg', 'atrX', 'vwapDev', 'bbPct', 'nr7', 'regime', 'risk',
]);

export const VINTAGE_FIELDS = Object.freeze(['quote', 'vwap', 'techAt', 'fundAsOf', 'rankingsAt']);

export const CANDIDATE_FIELDS = Object.freeze([
  'symbol', 'direction', 'signalSummary', 'threshold', 'signalSource',
]);

/** The three `suppressed` values a directive can carry (controlPromptRenderer.js reasons for target 'directive'). */
export const HEARD_SUPPRESSED_REASONS = Object.freeze(['malformed', 'mode_not_enforce', 'epoch_killed']);

// The renderer's own primitive (`toFixed(2)`), never `Math.round(v*100)/100`;
// `|| 0` folds a negative zero (`(-0.001).toFixed(2)` → "-0.00") to 0.
const round2 = (v) => (typeof v === 'number' && Number.isFinite(v) ? (Number(v.toFixed(2)) || 0) : null);
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
 * The evidence stamp: one eight-field record per HELD position, keyed by
 * symbol, iterated from `assetScores` — the very rows the decider's ACTIVE
 * POSITIONS CSV rendered (buildPortfolioCSV maps assetScores), so the stamped
 * set is the rendered set by construction: no bench name can enter.
 *
 * Sources — each the value a RENDERED line carried for the held name (all
 * objects in processAgentBattle scope at the entry):
 *   px      prices[sym].current            (the CSV's $Current, toFixed(2))
 *   chg     assetScores[i].priceChange     (the CSV's Gain% — the position's
 *                                           change from ENTRY, formatPct 2dp;
 *                                           NOT the quote's session change,
 *                                           which the prompt renders for bench
 *                                           names only — review A-1 / C-3)
 *   atrX    assetScores[i].multiplier      (the CSV's ATR Mult, toFixed(2) —
 *                                           the decider's own proximity number)
 *   vwapDev momentumData.vwap[sym].vwapDeviation   (INTRADAY MOMENTUM, toFixed(2))
 *   bbPct   momentumData.rankings[sym].bBandwidthPercentile  (INTRADAY MOMENTUM)
 *   nr7     momentumData.rankings[sym].nr7Flag (INTRADAY MOMENTUM's "NR7: YES";
 *                                           boolean; null when no ranking row)
 *   regime  stockRegimes[sym]              (the STOCK REGIMES line)
 *   risk    riskStatus[sym]                (RISK STATUS — action, + reason when non-HOLD)
 *
 * @returns {Object<string, {px, chg, atrX, vwapDev, bbPct, nr7, regime, risk}>}
 */
export function composeEvidenceStamp({ assetScores, prices, momentumData, stockRegimes, riskStatus }) {
  const evidence = {};
  for (const score of Array.isArray(assetScores) ? assetScores : []) {
    const sym = score?.symbol;
    if (typeof sym !== 'string' || !sym || evidence[sym]) continue;
    const quote = prices?.[sym] || null;
    const vwapInfo = momentumData?.vwap?.[sym] || null;
    const rankInfo = momentumData?.rankings?.[sym] || null;
    evidence[sym] = {
      px: round2(quote?.current),
      chg: round2(score.priceChange),
      atrX: round2(score.multiplier),
      vwapDev: round2(vwapInfo?.vwapDeviation),
      bbPct: numOrNull(rankInfo?.bBandwidthPercentile),
      nr7: rankInfo ? rankInfo.nr7Flag === true : null,
      regime: strOrNull(stockRegimes?.[sym]),
      risk: composeRisk(riskStatus?.[sym]),
    };
  }
  return evidence;
}

/** The newest epoch-ms among `values` (each through toMs); null when none. */
function newestMs(values) {
  let out = null;
  for (const v of values) {
    const ms = toMs(v);
    if (ms != null && (out == null || ms > out)) out = ms;
  }
  return out;
}

/**
 * The vintages block — ONE per entry. Two cadence words that are true by
 * construction (the quote and the VWAP are fetched and computed this tick) and
 * three doc-borne vintages as INSTANTS or DATES:
 *   techAt      the NEWEST `updatedAt` across the held book's stockTechnicalScores
 *               docs (the source of `regime`), as an ISO instant. Those docs are
 *               rewritten hourly during RTH by compute-index-intelligence
 *               (?mode=intraday), so no cadence word fits — review A-3.
 *   fundAsOf    the NEWEST fundamentals `computedAt` across the HELD BOOK PLUS
 *               THE NON-CRYPTO BENCH, as a UTC calendar date (YYYY-MM-DD) —
 *               EXACTLY the decider's FUNDAMENTALS block's header rule
 *               (buildFundamentalsBlock collects held + bench, one newest day,
 *               "Fundamentals data as of {day}"; review A-6), so the stamp
 *               equals the rendered header date by construction (§9). A date,
 *               never a cadence word. null when nothing carries one.
 *   rankingsAt  the stockRankings doc's computedAt as an ISO instant (the
 *               intraday-recomputed source behind bbPct / nr7). null when the
 *               doc carried none.
 *
 * @param {Object} p
 * @param {string[]} p.heldSymbols          the stamped (rendered) held symbols
 * @param {Array<{symbol: string, isCrypto?: boolean}>} [p.benchAssets]
 *   flattenBenchServer(battle.portfolio.bench) at the stamp site — the same
 *   bench the FUNDAMENTALS block flattened
 * @param {Object} [p.rankingsMap]          symbol → stockRankings entry
 * @param {Object} [p.techScoresMap]        symbol → stockTechnicalScores doc
 * @param {number|{toMillis: Function}|null} [p.rankingsComputedAtMs]
 */
export function composeVintages({ heldSymbols, benchAssets, rankingsMap, techScoresMap, rankingsComputedAtMs }) {
  const held = Array.isArray(heldSymbols) ? heldSymbols.filter((s) => typeof s === 'string' && s) : [];
  // The FUNDAMENTALS block's own symbol set: every held name, then each bench
  // asset that has a symbol, is not crypto and was not already seen.
  const fundSymbols = [...held];
  const seen = new Set(held);
  for (const asset of Array.isArray(benchAssets) ? benchAssets : []) {
    if (!asset?.symbol || asset.isCrypto || seen.has(asset.symbol)) continue;
    seen.add(asset.symbol);
    fundSymbols.push(asset.symbol);
  }
  const techMs = newestMs(held.map((sym) => techScoresMap?.[sym]?.updatedAt));
  const fundMs = newestMs(fundSymbols.map((sym) => rankingsMap?.[sym]?.fundamentals?.computedAt));
  const rankMs = toMs(rankingsComputedAtMs);
  return {
    quote: 'tick',
    vwap: 'tick',
    techAt: techMs == null ? null : new Date(techMs).toISOString(),
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
 * Gate: `promptBuilt === true` — the cron sets it only after the prompt's three
 * parts were built, immediately before the transport call. A timed-out or
 * truncated tick built and sent the prompt, so Heard and the evidence are true
 * there with no decision; a budget_skipped tick never built it and a builder
 * throw never finished it, so every key is absent ({}).
 *
 * @param {Object} p
 * @param {boolean} p.promptBuilt              agent-evaluate.js's own flag for this tick
 * @param {Object} p.controlResolution         the cron's resolveControls() result (same
 *                                             argument list as the fenced assembler, on the
 *                                             in-memory battle)
 * @param {Array}  [p.anticipationCandidates]  haikuResult.anticipationCandidates
 * @param {Array}  p.assetScores               fenced scorer output for the held book
 * @param {Object} p.prices                    the tick's quote table
 * @param {Object} p.momentumData              { vwap, rankings, rankingsMap, techScoresMap, … }
 * @param {Object} p.stockRegimes              per-symbol regime words
 * @param {Object} p.riskStatus                per-symbol risk verdicts
 * @param {Array}  [p.benchAssets]             flattenBenchServer(battle.portfolio.bench) — the
 *                                             FUNDAMENTALS block's bench set (for fundAsOf)
 * @param {number|null} [p.rankingsComputedAtMs] the stockRankings doc's computedAt (ms)
 */
export function composeTickStamps({
  promptBuilt,
  controlResolution,
  anticipationCandidates,
  assetScores,
  prices,
  momentumData,
  stockRegimes,
  riskStatus,
  benchAssets = [],
  rankingsComputedAtMs = null,
}) {
  if (promptBuilt !== true) return {};
  const stamps = {};
  const heard = deriveHeardStamp(controlResolution);
  if (heard) stamps.heard = heard;
  stamps.evidence = composeEvidenceStamp({ assetScores, prices, momentumData, stockRegimes, riskStatus });
  stamps.vintages = composeVintages({
    heldSymbols: Object.keys(stamps.evidence),
    benchAssets,
    rankingsMap: momentumData?.rankingsMap,
    techScoresMap: momentumData?.techScoresMap,
    rankingsComputedAtMs,
  });
  const candidates = composeCandidatesStamp(anticipationCandidates);
  if (candidates) stamps.candidates = candidates;
  return stamps;
}
