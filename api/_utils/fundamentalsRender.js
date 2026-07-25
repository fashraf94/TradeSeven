// api/_utils/fundamentalsRender.js
//
// Fundamental Wire — Commit 2 rendering (founder rulings D3/D4, Jul 25 2026).
//
// NON-FENCED pure module, dark behind FUNDAMENTAL_MIRROR_ENABLED — the DR-13
// split (evalIdentityBlocks.js precedent): ALL flag reading and rendering live
// here so each fenced assembler carries only an import plus call sites. While
// dark, every export returns ''/null and both assembled prompts stay
// byte-identical to the P4 battery snapshots.
//
// Data source: the per-stock `fundamentals` sub-object mirrored onto
// indexIntelligence/stockRankings entries by compute-index-intelligence.js
// (buildFundamentalsMirror — the write-side owner of rounding and of the D2
// beatRate suppression; nothing here re-derives or re-rounds a stored metric,
// BUILD_RULES §9 single-source).
//
// NULL HONESTY (C-20): an absent metric renders ABSENT — the draft CSV uses
// the established '-' null token, the eval block omits the fragment. No
// `?? 50`, no `|| 0`, no fabricated defaults, ever.
//
// The flags import is api → src Node-clean (BUILD_RULES §4); the co-located
// real-flag test's import of this module is the dependency-surface guard.

import { FUNDAMENTAL_MIRROR_ENABLED } from '../../src/config/featureFlags.js';
import { flattenBenchServer } from './agentScoring.js';

// ==================== DRAFT/BOARD CSV (D4: hard cap 3 columns) ====================
//
// Derived single-number forms that carry their comparison basis (founder D4):
//   PE_VS_SECT  trailingPE ÷ its sector median (<1 = cheaper than sector) —
//               serves fund-value-pe's default "vs sector median" predicate in
//               one number. Ratio of the two STORED (already-rounded) doc
//               values, 2dp.
//   REVG_PCT    revenueGrowthPct as stored (already ×100-normalized, 1dp) —
//               serves fund-revenue-growth's "{pct}%" threshold.
//   MCAP_CLS    marketCapClass initial (L/M/S per the rule's >$10B / $2–10B /
//               <$2B buckets) — serves fund-market-cap's class preference.
// The remaining un-hidden rules (fund-bank-pb, f-07, f-12) are served on the
// eval surface, where swap decisions cite rules and tokens are ~6× cheaper
// per exposure (Phase 0 §5.4-5.5).

export const DRAFT_FUNDAMENTALS_COLUMNS = Object.freeze(['PE_VS_SECT', 'REVG_PCT', 'MCAP_CLS']);

const MCAP_INITIAL = Object.freeze({ large: 'L', mid: 'M', small: 'S' });

/**
 * Pipe-prefixed header suffix for the market CSV header row and the two
 * STOCK UNIVERSE section labels. '' while dark.
 */
export function draftFundamentalsHeaderSuffix() {
  if (!FUNDAMENTAL_MIRROR_ENABLED) return '';
  return `|${DRAFT_FUNDAMENTALS_COLUMNS.join('|')}`;
}

/**
 * Slash-prefixed name-list suffix for the two prose sentences that enumerate
 * the '-' column vocabulary (agentPromptAssembly.js "show no FUND/TECH/…"
 * lines). '' while dark. Same source as the header suffix by construction —
 * the five label sites cannot drift (BUILD_RULES §9).
 */
export function draftFundamentalsNamesSuffix() {
  if (!FUNDAMENTAL_MIRROR_ENABLED) return '';
  return `/${DRAFT_FUNDAMENTALS_COLUMNS.join('/')}`;
}

/**
 * Pipe-prefixed row cells for one stockRankings entry. '' while dark; with
 * the flag on, a missing metric renders the established '-' null token —
 * never a neutral default.
 */
export function renderDraftFundamentalsCells(stock) {
  if (!FUNDAMENTAL_MIRROR_ENABLED) return '';
  const f = stock?.fundamentals || null;

  let peVsSect = '-';
  const pe = f?.trailingPE;
  if (pe?.value != null && pe?.sectorMedian != null && pe.sectorMedian > 0) {
    peVsSect = (pe.value / pe.sectorMedian).toFixed(2);
  }

  const revg = f?.revenueGrowthPct != null ? f.revenueGrowthPct.toFixed(1) : '-';
  const mcap = f?.marketCapClass != null ? (MCAP_INITIAL[f.marketCapClass] ?? '-') : '-';

  return `|${peVsSect}|${revg}|${mcap}`;
}

// ==================== EVAL LIVE-CONTEXT BLOCK (D4: scenario B) ====================

const signed = (n) => `${n >= 0 ? '+' : ''}${n}`;
const msToUtcMmDd = (ms) => new Date(ms).toISOString().slice(5, 10);

/**
 * One symbol's fundamentals fragment list (KEY=value, renderBenchRSLine
 * discipline: `!= null` gate per metric, no placeholders, no defaults).
 */
function fundamentalsParts(f) {
  const parts = [];
  if (f.trailingPE?.value != null) {
    const med = f.trailingPE.sectorMedian != null ? ` (sect med ${f.trailingPE.sectorMedian})` : '';
    parts.push(`PE=${f.trailingPE.value}${med}`);
  }
  if (f.priceBookMRQ != null) parts.push(`P/B=${f.priceBookMRQ}`);
  if (f.revenueGrowthPct != null) parts.push(`rev growth=${signed(f.revenueGrowthPct)}%`);
  if (f.marketCapClass != null) parts.push(`mcap=${f.marketCapClass}`);
  if (f.earningsRevisions30d != null) parts.push(`EPS rev 30d=${signed(f.earningsRevisions30d)}%`);
  // beatRate reaches the doc ONLY when computed from real history (D2
  // suppression at the mirror) — rendering is presence-gated like the rest.
  if (f.beatRate != null) parts.push(`beat rate=${f.beatRate}%`);
  if (f.surpriseMagPercentile != null) parts.push(`surprise pctl=${f.surpriseMagPercentile}`);
  return parts;
}

function symbolHeader(symbol, ranking) {
  // Sector + sub-industry from the SAME doc entry the metrics come from —
  // the industry name is the r-07 substrate (held + candidates).
  const paren = [ranking?.sectorName, ranking?.industryName].filter(Boolean).join(' / ');
  return paren ? `${symbol} (${paren})` : symbol;
}

/**
 * The FUNDAMENTALS live-context block: held positions + bench candidates,
 * one line per symbol, honest staleness basis note, per-entry vintage
 * markers off the mirrored peerRankings computedAt (Phase 0 STOP-2 —
 * per-ticker drop-outs and dead producer runs leave silently stale docs, so
 * entries older than the block's newest vintage are marked).
 *
 * Returns null while dark, or when nothing would render — callers push
 * conditionally, so the live context stays byte-identical in both cases.
 *
 * @param {Array} assetScores   flattened held-position scores ({symbol})
 * @param {Object} bench        battle.portfolio.bench (flattenBenchServer shape)
 * @param {Object} rankingsMap  symbol → stockRankings entry (full universe)
 */
export function buildFundamentalsBlock(assetScores, bench, rankingsMap) {
  if (!FUNDAMENTAL_MIRROR_ENABLED) return null;
  const map = rankingsMap || {};

  const heldSymbols = [];
  const seen = new Set();
  for (const score of Array.isArray(assetScores) ? assetScores : []) {
    const sym = score?.symbol;
    if (sym && !seen.has(sym)) { seen.add(sym); heldSymbols.push(sym); }
  }
  const benchSymbols = [];
  for (const asset of flattenBenchServer(bench) || []) {
    if (!asset?.symbol || asset.isCrypto || seen.has(asset.symbol)) continue;
    seen.add(asset.symbol);
    benchSymbols.push(asset.symbol);
  }

  // First pass — collect renderable entries + the newest vintage.
  let maxMs = null;
  const collect = (symbols) => symbols.map((sym) => {
    const ranking = map[sym];
    if (!ranking) return null; // nothing known — no line, never a placeholder row
    const f = ranking.fundamentals || null;
    if (f?.computedAt != null && (maxMs == null || f.computedAt > maxMs)) maxMs = f.computedAt;
    return { sym, ranking, f };
  }).filter(Boolean);

  const held = collect(heldSymbols);
  const benchEntries = collect(benchSymbols);
  if (held.length === 0 && benchEntries.length === 0) return null;

  const maxDay = maxMs != null ? msToUtcMmDd(maxMs) : null;
  const renderLine = ({ sym, ranking, f }) => {
    const header = symbolHeader(sym, ranking);
    const parts = f ? fundamentalsParts(f) : [];
    if (parts.length === 0) return `${header}: no fundamentals reported`;
    // Vintage marker only when this entry is OLDER than the block's newest
    // day — the mixed-vintage case the provenance field exists to expose.
    if (f.computedAt != null && maxDay != null) {
      const day = msToUtcMmDd(f.computedAt);
      if (day !== maxDay) parts.push(`as of ${day}`);
    }
    return `${header}: ${parts.join(' | ')}`;
  };

  const lines = ['FUNDAMENTALS (held + bench; a missing metric is NOT REPORTED — never zero):'];
  // F3 (PR-A review, founder-ruled): each vintage claim below matches its
  // metric's actual computation — growth is single-latest-quarter; beat rate
  // AND the surprise percentile are multi-quarter aggregates (4–12 quarters;
  // both suppress below 4 per D2/F1); EPS revisions are the trailing 30 days;
  // P/E, P/B and the market-cap class all move with price.
  lines.push(
    'Basis: revenue growth is from the most recent reported quarter; beat rate and',
    'the surprise percentile aggregate 4-12 quarters of filings; EPS revisions',
    'cover the last 30 days; valuation ratios and market-cap class move with price',
    `(book value = most recent quarterly filing).${maxDay ? ` Fundamentals data as of ${maxDay} (UTC); older entries are marked.` : ''}`,
  );
  if (held.length > 0) {
    lines.push('', 'HELD:');
    for (const entry of held) lines.push(renderLine(entry));
  }
  if (benchEntries.length > 0) {
    lines.push('', 'BENCH:');
    for (const entry of benchEntries) lines.push(renderLine(entry));
  }
  return lines.join('\n');
}
