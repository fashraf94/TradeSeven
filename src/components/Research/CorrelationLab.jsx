/**
 * CorrelationLab — Correlation Intelligence V0 research surface (Build Spec
 * V1.2 Phase 3). Flag-gated (CORRELATION_LAB_ENABLED), reachable only via
 * ?correlationDev=1; POSTs to /api/research/correlation via fetchWithAuth.
 *
 * V0 utility surface: HOLO token stack, minimal motion, no glow choreography.
 * Presentation-honesty rules (pinned):
 *   • headline beta = beta.latest from the rolling series, always captioned
 *     with betaInterpretation (mixed-unit betas like TNX never render bare);
 *   • lead-lag renders ONLY as a verdict sentence — users never see raw lag signs;
 *   • the base-rate panel is episode-first, tiered by independentCount per
 *     horizon (<3 dots only · 3–4 median + raw tally, no % · 5–7 +hit% with n
 *     adjacent · ≥8 +dispersion); n leads every sentence, anchored to
 *     firstEligibleInflectionDate (never the raw lookback start); copy is
 *     past-tense and sample-bounded; SDS is never presented as significance;
 *   • null beta windows GAP the chart line (never zero); low-r stretches are
 *     de-emphasized, not dropped;
 *   • suppressed sections render their reason verbatim — never an empty panel
 *     dressed as clean history.
 *
 * The dual-series SVG chart is a local clone of SeasonPerformanceChart.jsx's
 * mechanics (fixed [−1,1] domain for correlations) — the Season component is
 * untouched.
 *
 * V2 Build 2 — multi-driver scan: SCAN ALL runs the group against EVERY
 * registry driver (POST /api/research/correlation-scan) and renders a ranked
 * table that REPLACES the single-driver results while displayed; every row
 * deep-dives into the single-driver analysis. Scans and single runs share the
 * runSeq stale-race guard: a late scan can never overwrite a newer single run,
 * and vice versa. Scan honesty copy is pinned (Change 2; Build 2.1 truthful
 * rewrite): the 20-observation caveat caption, "worth investigating, not a
 * discovery", established (both windows) vs emerging (20d-only) tiers,
 * identity rows annotated "group member", weak rows greyed as "weak/none",
 * unavailable drivers listed — never silently omitted.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { ChartSkeleton } from './ResearchSkeletons';
import { buildVerdictSentence, breakStatePhrase, conditionalVerdict } from './correlationVerdict';

// Client-side mirror of the driver registry LABELS only (the api registry is
// server code — do not import it into the bundle; units/interpretations come
// back in the response, so the server stays the source of truth). Rendered as
// <optgroup> sections in this pinned order. The final Custom section is UI-only
// (pair mode): its 'CUSTOM' key reveals a ticker input and the endpoint builds
// a synthetic driver from whatever ticker the user enters.
const DRIVER_GROUPS = [
  {
    label: 'Macro',
    options: [
      { key: 'BRENT', label: 'Brent Crude (BNO proxy)' },
      { key: 'WTI', label: 'WTI Crude (USO proxy)' },
      { key: 'GOLD', label: 'Gold (GLD proxy)' },
      { key: 'VIX', label: 'VIX' },
      { key: 'TNX', label: '10Y Yield' },
      { key: 'DXY', label: 'US Dollar (UUP proxy)' },
      { key: 'SPX', label: 'S&P 500 (SPY)' },
    ],
  },
  {
    label: 'Sectors',
    options: [
      { key: 'XLE', label: 'Energy sector (XLE)' },
      { key: 'XLF', label: 'Financials (XLF)' },
      { key: 'XLK', label: 'Technology (XLK)' },
      { key: 'XLV', label: 'Healthcare (XLV)' },
      { key: 'XLI', label: 'Industrials (XLI)' },
      { key: 'XLY', label: 'Consumer Disc. (XLY)' },
      { key: 'XLP', label: 'Consumer Staples (XLP)' },
      { key: 'XLU', label: 'Utilities (XLU)' },
      { key: 'XLB', label: 'Materials (XLB)' },
    ],
  },
  {
    label: 'Style factors',
    options: [
      { key: 'MTUM', label: 'Momentum factor (MTUM)' },
      { key: 'VLUE', label: 'Value factor (VLUE)' },
      { key: 'QUAL', label: 'Quality factor (QUAL)' },
      { key: 'USMV', label: 'Low-volatility factor (USMV)' },
    ],
  },
  {
    label: 'Risk & rates',
    options: [
      { key: 'HYG', label: 'High-yield credit (HYG)' },
      { key: 'TLT', label: 'Long-duration Treasuries (TLT)' },
      { key: 'IWM', label: 'Small caps (IWM)' },
      { key: 'RSP', label: 'Equal-weight S&P (RSP)' },
    ],
  },
  {
    label: 'Digital',
    options: [{ key: 'BTC', label: 'Bitcoin (BTC)' }],
  },
  {
    label: 'Custom',
    options: [{ key: 'CUSTOM', label: 'Custom ticker…' }],
  },
];

// Flat key→label lookup for driver-label derivation. CUSTOM is intentionally
// excluded — its label is the user's raw ticker, resolved at render time.
const DRIVER_LABELS = Object.fromEntries(
  DRIVER_GROUPS.flatMap((g) => g.options.map((o) => [o.key, o.label]))
);

const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,9}$/; // mirrors the endpoint's pinned regex

// Single source for the endpoint's coded 422 failures (state.error carries
// "<status>:<code>"). Message = matched entry; the raw-code detail line shows
// only for codes NOT in this map — one list, no drift between the two.
const ERROR_COPY = {
  driver_unavailable: (driverLabel) => `Couldn't fetch ${driverLabel} data right now.`,
  group_unavailable: () => 'None of those tickers returned data — check the symbols.',
  no_overlapping_history: () => "Couldn't get enough overlapping history for that pair.",
  // Pair-mode 400s surfaced as clean copy (the server owns the self-correlation
  // guard so the smoke path exercises the real 400, not a client pre-block).
  custom_symbol_in_group: () => 'That ticker is already in your group — pick a different driver.',
  invalid_custom_symbol: () => 'Enter a valid ticker for the custom driver.',
};
const MONO = "'SF Mono', 'Monaco', 'Consolas', monospace";
const GOLD = '#F0C75E'; // SeasonPerformanceChart line colors
const GRAY = '#8B949E';
const AMBER = '#f59e0b';
const GREEN = '#34D399';
const RED = '#EF4444';
const LOW_R_THRESHOLD = 0.3;

// Change D — always-visible muted caption lines under each headline stat (no
// hover-only tooltips; they die on mobile). Reuses the in-file :558 idiom.
const CAPTIONS = {
  correlation: 'How often they move in the same direction. 1 = always, 0 = unrelated, −1 = opposite.',
  beta: 'How big the move is when they move together.',
  leadLag: 'Whether one tends to move first at daily resolution.',
  regimeBreaks: 'Dates when the recent relationship stopped matching the longer pattern.',
  tension: 'How stretched the recent link is versus its own history — not a prediction.',
  // Build 3 — the state-at-break column (the V1.1 caption idiom).
  stateAtBreak: "The group's own technical state when the break fired.",
  // Build 4 — the conditional card's truncation guard (pinned copy): each side
  // is a subset, subsetting lowers both readings mechanically, so the ONLY
  // honest comparison is side vs side — never side vs the headline.
  conditional:
    'Each side is measured on a subset of days, which naturally lowers both readings — compare the two sides to each other, not to the headline link above.',
};

// Change E — three example chips matching the Discover "TRY ONE" idiom.
const EXAMPLE_CHIPS = [
  { label: 'Oil stocks vs Brent', group: 'XOM, CVX, COP', driver: 'BRENT' },
  { label: 'Banks vs 10Y yield', group: 'KBE', driver: 'TNX' },
  { label: 'Tech vs fear (VIX)', group: 'QQQ', driver: 'VIX' },
];

// ── formatting (math layer returns decimal fractions; multiply by 100 ONCE here) ──
const fmtCorr = (v) => (v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2));
const fmtPct = (v, dp = 1) => (v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(dp) + '%');
const fmtBeta = (v) => (v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2));

/**
 * resolveResultLabels — the driver label/unit strings for EVERY result surface,
 * sourced from the PAYLOAD, never the live <select>. Flipping the driver
 * dropdown after a run must not relabel a result that belongs to the old
 * driver: results bind to what was actually computed. Pure over `data`.
 *   • driverLabel: meta.driverLabel (server, carried since Build 1) → local key
 *     lookup by meta.driver → em-dash. The live select is NEVER a source, and a
 *     missing-everything payload renders '—', never a live default.
 *   • driverUnit: the base-rate forward-return unit. TNX forward returns are
 *     percent-of-level, so its diff-mode 'yield points' unit must not ride along
 *     (that unit belongs to beta/inflections, not this number).
 * (The query bar keeps reflecting live input — it is input, not result.)
 */
export function resolveResultLabels(data) {
  const meta = data?.meta ?? {};
  const driverLabel = meta.driverLabel ?? DRIVER_LABELS[meta.driver] ?? '—';
  const driverUnit = meta.driver === 'TNX' ? '% change in yield level' : meta.driverUnit;
  return { driverLabel, driverUnit };
}

function leadLagSentence(leadLag, driverLabel) {
  if (!leadLag) return 'Not enough data for a lead-lag read.';
  const r = leadLag.corrAtBestLag == null ? '' : ` (r = ${leadLag.corrAtBestLag.toFixed(2)})`;
  if (leadLag.verdict === 'none') return 'No meaningful lead-lag relationship in this window.';
  if (leadLag.verdict === 'coincident') return `Moves were coincident — no lead either way${r}.`;
  const days = Math.abs(leadLag.bestLag);
  const dayWord = days === 1 ? 'day' : 'days';
  if (leadLag.verdict === 'driver_leads') return `${driverLabel} led this group by ${days} ${dayWord}${r}.`;
  return `This group led ${driverLabel} by ${days} ${dayWord}${r}.`;
}

/**
 * H7 — the evidence line under a FLAT lead-lag verdict. On a real pair the card's
 * sentence is identical every time because daily-resolution leads among liquid
 * assets are genuinely rare (correct, but it reads inert). When the verdict is
 * `coincident` or `none`, surface the strongest lagged reading from the ALREADY-
 * SHIPPED `leadLag.table` so the "no lead" verdict shows its evidence: the
 * largest-|corr| NON-ZERO-lag row against same-day (lag 0). Render-only — the
 * directional `driver_leads` / `group_leads` paths keep their sentence and get
 * no extra line. Returns null when there is nothing honest to add (no table,
 * null lag0, or no usable nonzero-lag row).
 */
export function leadLagEvidenceLine(leadLag) {
  if (!leadLag) return null;
  if (leadLag.verdict !== 'coincident' && leadLag.verdict !== 'none') return null;
  const table = Array.isArray(leadLag.table) ? leadLag.table : null;
  if (!table) return null;
  const lag0 = leadLag.lag0Corr;
  if (lag0 == null || !Number.isFinite(lag0)) return null;
  // Largest-|corr| nonzero-lag row; ties break to the nearer lag. Null / non-finite
  // corr rows and the lag-0 row are skipped.
  let best = null;
  for (const row of table) {
    if (!row || row.lag === 0 || row.corr == null || !Number.isFinite(row.corr)) continue;
    const better =
      best == null ||
      Math.abs(row.corr) > Math.abs(best.corr) ||
      (Math.abs(row.corr) === Math.abs(best.corr) && Math.abs(row.lag) < Math.abs(best.lag));
    if (better) best = row;
  }
  if (!best) return null;
  const signed = `${best.lag > 0 ? '+' : ''}${best.lag}d`;
  return `Strongest lagged reading: ${signed} at r = ${best.corr.toFixed(2)} — not meaningfully different from same-day (${lag0.toFixed(2)} r).`;
}

const directionLabel = (d) => (d === 'weakening' ? 'correlation breakdown' : 'correlation strengthening');

// Change F / Build 3.1 — plain-language state for the Divergence Watch gauge.
// The state is SERVER-authoritative: correlation.js stamps divergence.latest
// .state via the shared tensionStateFrom helper (the SAME five states the scan
// chips use), so the gauge and the chips can't drift and the gauge can no
// longer claim a break the flag logic refuses — a high score whose raw gap is
// still small reads 'stretched' (amber), not "in break territory" (red). The
// number stays secondary; "significance" is never used.
//
// H6 — the two ATTENTION states carry a plain-MECHANICS explainer describing
// what the tool does at this state (never a market prediction; banned words:
// predicts / expect / will likely). Single source, right beside the state
// words — the `note` the gauge caption already renders. calm / elevated are
// unchanged (no note → the default Divergence Watch caption).
const TENSION_WORD = {
  calm: { word: 'calm', color: HOLO_COLORS.textSecondary },
  elevated: { word: 'elevated', color: AMBER },
  stretched: {
    word: 'stretched',
    color: AMBER,
    note: 'Unusual versus its own history — but the gap is still small. Not a break. The relationship is under strain. From here it either settles back to normal, or — if the gap keeps widening past the break threshold — becomes a regime break like the ones listed below.',
  },
  break: {
    word: 'in break territory',
    color: RED,
    note: 'The gap is both unusual and large — this is the condition that logs a regime break in the table below.',
  },
};
const NOT_SCOREABLE = { word: 'not scoreable yet', color: HOLO_COLORS.textMuted };

export function divergenceState(latest) {
  if (!latest) return NOT_SCOREABLE;
  let state = latest.state;
  if (state === undefined) {
    // Legacy fallback for pre-3.1 cached payloads (no `state` field yet):
    // score-only boundaries — never 'stretched', which needs the server's
    // |d|-floor read. The short cache TTL refreshes the field in within a
    // trading day, so this branch is transient by construction.
    const s = latest.score;
    state =
      s == null || !Number.isFinite(s) ? null
      : Math.abs(s) < 1 ? 'calm'
      : Math.abs(s) < 2 ? 'elevated'
      : 'break';
  }
  return TENSION_WORD[state] ?? NOT_SCOREABLE;
}

// Change G — one-word driver tag from the signs of the two into-break returns
// at a WEAKENING break. Strengthening rows (and rows missing either value) omit.
function driverTag(ep) {
  if (ep.direction !== 'weakening') return null;
  const g = ep.groupInto5d;
  const dr = ep.driverInto5d;
  if (g == null || dr == null) return null;
  if (g >= 0 && dr < 0) return 'group held up';
  if (g < 0 && dr >= 0) return 'driver held up';
  if (g < 0 && dr < 0) return 'joint selloff';
  return 'both rising'; // g >= 0 && dr >= 0
}

// Build 3.1 (Change B) — the "State at break" cell now leads with trend words
// (uptrend/downtrend · running hot/washed out) and demotes the technical detail
// (above 50DMA · RSI 73) to a muted second line. The mapping is the exported
// pure breakStatePhrase in correlationVerdict.js (presentation-honesty surface,
// unit-tested there); a null stamp still renders a single "—".

const pctColor = (v) => (v == null ? HOLO_COLORS.textMuted : v > 0 ? GREEN : v < 0 ? RED : HOLO_COLORS.textSecondary);

// Shared group parsing/validation for both run kinds (one rule, no drift).
// Module-scope on purpose: pure over its argument, so it can never go stale
// inside the run/runScan useCallback closures.
function parseGroup(source) {
  const group = [...new Set(source.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (group.length < 1 || group.length > 10) {
    return { error: 'Enter 1–10 ticker symbols (comma-separated). A single ETF proxy works too.' };
  }
  const bad = group.filter((s) => !SYMBOL_RE.test(s));
  if (bad.length) return { error: `Not a valid ticker: ${bad.join(', ')}` };
  return { group };
}

// ── V2 Build 2 — multi-driver scan helpers ──────────────────────────────────

// Tension chip colors keyed by the server's tensionState — the same five states
// the Divergence Watch gauge renders (both via the shared tensionStateFrom
// helper server-side), so a chip and the deep dive can't disagree. The gauge
// spells 'break' as "in break territory"; the compact chip says "break".
// 'stretched' (Build 3.1) is amber like 'elevated' — a high score whose raw gap
// is still below the flag floor: unusual, but not a break.
const TENSION_CHIP = {
  calm: { word: 'calm', color: HOLO_COLORS.textSecondary },
  elevated: { word: 'elevated', color: AMBER },
  stretched: { word: 'stretched', color: AMBER },
  break: { word: 'break', color: RED },
};

/**
 * Deterministic scan summary sentence from the endpoint's `summary` input
 * object — past/present DESCRIPTIVE only; "discovered", "predicts", and
 * "signal found" are banned from scan copy (pinned honesty rule).
 */
function scanSummarySentence(summary) {
  if (!summary) return null;
  const dir = summary.direction === 'negative' ? 'inverse' : 'positive';
  const change = summary.change
    ? `, and ${summary.change === 'tightened' ? 'tightening' : 'weakening'} this month`
    : '';
  return `Tracking most tightly: ${summary.label} — ${summary.band} ${dir} link${change}.`;
}

/**
 * Ranked scan table (Build 2.1 tiers): established rows normal (gold),
 * emerging rows amber with an "emerging" tag (20d-only evidence), weak rows
 * greyed with "weak/none" (or "no data" when nothing was computable),
 * identity rows annotated "group member", unavailable (dropped) drivers at
 * the bottom in muted text. Mobile (≤390px) compacts to rank / label /
 * corr20 / tension — the rest lives in the deep dive. Every computed row
 * deep-dives on click or Enter/Space (the desktop-only last column is the
 * visible affordance; the whole row is the target).
 */
export function ScanResults({ scan, isDesktop, onDeepDive, onRefresh }) {
  const summaryText = scanSummarySentence(scan.summary);
  const cellPad = { padding: '7px 8px' };
  const catChip = {
    marginLeft: 6,
    padding: '1px 6px',
    borderRadius: 8,
    border: `1px solid ${HOLO_COLORS.borderSubtle}`,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: HOLO_COLORS.textMuted,
    whiteSpace: 'nowrap',
  };
  return (
    <>
      {/* Header + the honesty captions (Change 2; Build 2.1 truthful rewrite —
          the caption states what a 20-observation statistic can and cannot
          support, and what "established" requires) */}
      <div style={card}>
        <div style={captionStyle}>Multi-driver scan — ranked by current 20d strength</div>
        <div style={{ fontSize: 13, color: HOLO_COLORS.textPrimary, marginTop: 6, lineHeight: 1.5 }}>
          What this group is tracking most tightly right now — worth investigating, not a discovery.
        </div>
        <div style={subCaptionStyle}>
          A 20d reading is only 20 sessions of evidence — chance alone pushes it past |0.20| for
          roughly two drivers in five, so it is never treated as established by itself. Established
          rows clear |0.20| on both the 20d and 60d windows; emerging rows clear only the 20d — a
          lead to watch, not a relationship. Sub-floor rows render greyed. A broad-market link on
          top (SPY or a sector twin) is normal for most groups.
        </div>
      </div>

      {/* Summary sentence, the pinned no-signal copy, or the all-unavailable case */}
      {summaryText ? (
        <div style={{ ...card, borderColor: `${GOLD}44` }}>
          <div style={{ fontSize: 15, color: HOLO_COLORS.textPrimary, lineHeight: 1.55 }}>{summaryText}</div>
        </div>
      ) : scan.rows.length === 0 ? (
        <div style={{ ...card, borderColor: `${AMBER}55` }}>
          <div style={{ fontSize: 13, color: HOLO_COLORS.textSecondary }}>
            None of the drivers could be fetched just now — nothing was computed. Re-run to retry.
          </div>
        </div>
      ) : !scan.rows.some((r) => r.corr20 != null) ? (
        // Honesty guard: the noise-floor sentence claims a MEASUREMENT was
        // made — when every row is null-stat (nothing computable), say that.
        <div style={{ ...card, borderColor: `${AMBER}55` }}>
          <div style={{ fontSize: 13, color: HOLO_COLORS.textSecondary }}>
            Couldn't compute correlations for this group — not enough overlapping history to measure anything.
          </div>
        </div>
      ) : scan.rows.some((r) => r.tier === 'emerging' || (r.tier === 'established' && r.identity)) ? (
        // Summary is null yet something clears the floor: only group members
        // (identity rows) or 20d-only leads — say exactly that.
        <div style={card}>
          <div style={{ fontSize: 13, color: HOLO_COLORS.textSecondary }}>
            Nothing established right now — anything clearing |0.20| below is a group member or a
            20-day-only lead.
          </div>
        </div>
      ) : (
        <div style={card}>
          <div style={{ fontSize: 13, color: HOLO_COLORS.textSecondary }}>
            Nothing above the noise floor right now — no driver clears |0.20|.
          </div>
        </div>
      )}

      {/* Ranked table */}
      {scan.rows.length > 0 || scan.droppedDrivers.length > 0 ? (
        <div style={card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: HOLO_COLORS.textMuted, textAlign: 'left' }}>
                  <th style={{ ...cellPad, fontWeight: 600 }}>#</th>
                  <th style={{ ...cellPad, fontWeight: 600 }}>Driver</th>
                  <th style={{ ...cellPad, fontWeight: 600 }}>20d</th>
                  {isDesktop ? <th style={{ ...cellPad, fontWeight: 600 }}>60d</th> : null}
                  <th style={{ ...cellPad, fontWeight: 600 }}>Tension</th>
                  {isDesktop ? <th style={{ ...cellPad, fontWeight: 600 }}>Deep dive</th> : null}
                </tr>
              </thead>
              <tbody>
                {scan.rows.map((row, i) => {
                  const weak = row.tier === 'weak';
                  const emerging = row.tier === 'emerging';
                  const tension = row.tensionState ? TENSION_CHIP[row.tensionState] : null;
                  return (
                    <tr
                      key={row.driver}
                      onClick={() => onDeepDive(row)}
                      // Keyboard path: on mobile the row IS the only deep-dive
                      // affordance, so it must be focusable and Enter/Space
                      // activatable, not click-only.
                      tabIndex={0}
                      role="button"
                      aria-label={`Deep dive: ${row.label}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onDeepDive(row);
                        }
                      }}
                      title={`Deep dive: ${row.label}`}
                      style={{
                        borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
                        cursor: 'pointer',
                        opacity: weak ? 0.55 : 1,
                      }}
                    >
                      <td style={{ ...cellPad, fontFamily: MONO, color: HOLO_COLORS.textMuted }}>{i + 1}</td>
                      <td style={cellPad}>
                        <span style={{ color: HOLO_COLORS.textPrimary }}>{row.label}</span>
                        <span style={catChip}>{row.category}</span>
                        {row.identity ? (
                          // Decision #2: truthful but vacuous — this driver IS
                          // one of the scanned members; annotated, never hidden.
                          <span style={{ ...catChip, color: AMBER, borderColor: `${AMBER}55` }}>group member</span>
                        ) : null}
                        {emerging ? (
                          <span style={{ marginLeft: 6, fontSize: 10, color: AMBER }}>emerging</span>
                        ) : null}
                        {weak ? (
                          // "weak/none" is a MEASURED verdict — a null corr20
                          // means nothing was computable, which is different
                          // honesty (presentation-honesty, code-review fix).
                          <span style={{ marginLeft: 6, fontSize: 10, color: HOLO_COLORS.textMuted }}>
                            {row.corr20 == null ? 'no data' : 'weak/none'}
                          </span>
                        ) : null}
                      </td>
                      <td style={{ ...cellPad, fontFamily: MONO, fontWeight: 700, color: weak ? HOLO_COLORS.textMuted : emerging ? AMBER : GOLD }}>
                        {fmtCorr(row.corr20)}
                      </td>
                      {isDesktop ? (
                        <td style={{ ...cellPad, fontFamily: MONO, color: GRAY }}>{fmtCorr(row.corr60)}</td>
                      ) : null}
                      <td style={cellPad}>
                        {tension ? (
                          <span style={{ color: tension.color, fontSize: 11, fontWeight: 600 }}>{tension.word}</span>
                        ) : (
                          <span style={{ color: HOLO_COLORS.textMuted }}>—</span>
                        )}
                      </td>
                      {isDesktop ? (
                        <td style={{ ...cellPad, color: GOLD, fontSize: 11, whiteSpace: 'nowrap' }}>Deep dive →</td>
                      ) : null}
                    </tr>
                  );
                })}
                {scan.droppedDrivers.map((dd) => (
                  <tr key={dd.driver} style={{ borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`, opacity: 0.45 }}>
                    <td style={{ ...cellPad, fontFamily: MONO, color: HOLO_COLORS.textMuted }}>—</td>
                    <td style={{ ...cellPad, color: HOLO_COLORS.textSecondary }}>{dd.label}</td>
                    <td style={{ ...cellPad, color: HOLO_COLORS.textMuted, fontStyle: 'italic' }} colSpan={isDesktop ? 4 : 2}>
                      unavailable
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {scan.droppedDrivers.length > 0 ? (
            <div style={{ ...subCaptionStyle, color: AMBER }}>
              Some drivers were unavailable, so this scan was <strong>not cached</strong> — re-run to retry them.
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Freshness footer (the V0 idiom) */}
      <div style={{ fontSize: 11, color: HOLO_COLORS.textMuted, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span>
          as of {scan.meta.computedAt}
          {scan.meta.cached ? ' · cached' : ''}
        </span>
        {scan.meta.cached ? (
          <button
            onClick={onRefresh}
            style={{ background: 'transparent', border: 'none', color: HOLO_COLORS.textSecondary, fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
          >
            refresh
          </button>
        ) : null}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Local SVG chart (SeasonPerformanceChart mechanics; fixed domain for corr)
// ─────────────────────────────────────────────────────────────────────────────
const VIEW_W = 600;
const VIEW_H = 200;
const PAD = { top: 14, right: 14, bottom: 30, left: 42 };
const CHART_W = VIEW_W - PAD.left - PAD.right;
const CHART_H = VIEW_H - PAD.top - PAD.bottom;

/** Split a series of {value} points into contiguous non-null segments — null
 *  entries GAP the line (pinned: never zeroed, x-positions preserved). */
function segmentsOf(points, getValue) {
  const segs = [];
  let cur = null;
  points.forEach((p, i) => {
    const v = getValue(p);
    if (v == null || !Number.isFinite(v)) {
      if (cur) segs.push(cur);
      cur = null;
    } else {
      if (!cur) cur = [];
      cur.push({ i, v, p });
    }
  });
  if (cur) segs.push(cur);
  return segs;
}

function linePath(seg, xScale, yScale) {
  return seg
    .map((pt, k) => `${k === 0 ? 'M' : 'L'}${xScale(pt.i).toFixed(1)},${yScale(pt.v).toFixed(1)}`)
    .join(' ');
}

function DualSeriesChart({ title, seriesA, seriesB, labelA, labelB, domain, episodeDates, dates, format }) {
  const n = dates.length;
  if (!n) return null;
  const xScale = (i) => PAD.left + (n <= 1 ? CHART_W / 2 : (i / (n - 1)) * CHART_W);
  const [lo, hi] = domain;
  const yScale = (v) => PAD.top + (1 - (v - lo) / (hi - lo)) * CHART_H;
  const gridValues = [hi, 0, lo].filter((v, idx, arr) => arr.indexOf(v) === idx && v >= lo && v <= hi);
  const tickIdx = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i2, a) => a.indexOf(v) === i2);
  const segsA = segmentsOf(seriesA, (p) => p.v);
  const segsB = seriesB ? segmentsOf(seriesB, (p) => p.v) : [];
  const dateToIndex = new Map(dates.map((d, i) => [d, i])); // plain (no hook — this sits after an early return)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: HOLO_COLORS.textPrimary }}>
          {title}
        </span>
        <span style={{ display: 'flex', gap: 12, fontSize: 10, color: HOLO_COLORS.textMuted }}>
          <span><span style={{ color: GOLD }}>—</span> {labelA}</span>
          {labelB ? <span><span style={{ color: GRAY }}>┄</span> {labelB}</span> : null}
          {episodeDates?.length ? <span><span style={{ color: AMBER }}>▲</span> break</span> : null}
        </span>
      </div>
      <svg width="100%" height={200} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" role="img" aria-label={title}>
        {gridValues.map((v) => (
          <g key={`grid-${v}`}>
            <line
              x1={PAD.left} x2={VIEW_W - PAD.right} y1={yScale(v)} y2={yScale(v)}
              stroke={v === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)'}
              strokeDasharray={v === 0 ? '4 4' : undefined}
            />
            <text x={PAD.left - 6} y={yScale(v) + 3} textAnchor="end" fontSize="10" fill={HOLO_COLORS.textMuted} fontFamily="system-ui, -apple-system, sans-serif">
              {format(v)}
            </text>
          </g>
        ))}
        {segsB.map((seg, k) => (
          <path key={`b-${k}`} d={linePath(seg, xScale, yScale)} fill="none" stroke={GRAY} strokeWidth="1.5" strokeDasharray="4 4"
            opacity={seg.lowR ? 0.35 : 1} />
        ))}
        {segsA.map((seg, k) => (
          <path key={`a-${k}`} d={linePath(seg, xScale, yScale)} fill="none" stroke={GOLD} strokeWidth="2"
            opacity={seg.lowR ? 0.35 : 1} />
        ))}
        {(episodeDates ?? []).map((d) => {
          const i = dateToIndex.get(d);
          if (i === undefined) return null;
          const x = xScale(i);
          const yBase = VIEW_H - PAD.bottom;
          return <path key={`ep-${d}`} d={`M${x - 4},${yBase + 8} L${x + 4},${yBase + 8} L${x},${yBase + 1} Z`} fill={AMBER} />;
        })}
        {tickIdx.map((i) => (
          <text key={`t-${i}`} x={xScale(i)} y={VIEW_H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            fontSize="10" fill={HOLO_COLORS.textMuted} fontFamily="system-ui, -apple-system, sans-serif">
            {dates[i]}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Beta chart variant: auto domain, low-|r| stretches de-emphasized (opacity),
 *  null betas gap the line. Reuses the dual-series renderer's mechanics by
 *  pre-splitting segments on both nullness and the low-r boundary. */
function BetaChart({ beta40, dates }) {
  const values = beta40.map((e) => e.beta).filter((v) => v != null && Number.isFinite(v));
  if (!values.length) {
    return <div style={{ fontSize: 12, color: HOLO_COLORS.textMuted, padding: '24px 0' }}>No beta windows with a usable driver variance in this range.</div>;
  }
  let lo = Math.min(0, ...values);
  let hi = Math.max(0, ...values);
  const span = Math.max(hi - lo, 0.5);
  lo -= span * 0.1;
  hi += span * 0.1;

  // Split into segments that are contiguous, non-null, AND homogeneous in
  // low-r-ness so each path can carry its own opacity.
  const segs = [];
  let cur = null;
  beta40.forEach((e, i) => {
    const usable = e.beta != null && Number.isFinite(e.beta);
    const lowR = usable && (e.r == null || Math.abs(e.r) < LOW_R_THRESHOLD);
    if (!usable) {
      if (cur) segs.push(cur);
      cur = null;
      return;
    }
    if (!cur || cur.lowR !== lowR) {
      if (cur) {
        segs.push(cur);
        const bridge = [cur[cur.length - 1], null];
        cur = [bridge[0]];
        cur.lowR = lowR; // bridge point keeps the line visually continuous
      } else {
        cur = [];
        cur.lowR = lowR;
      }
    }
    cur.push({ i, v: e.beta });
  });
  if (cur) segs.push(cur);

  const n = dates.length;
  const xScale = (i) => PAD.left + (n <= 1 ? CHART_W / 2 : (i / (n - 1)) * CHART_W);
  const yScale = (v) => PAD.top + (1 - (v - lo) / (hi - lo)) * CHART_H;
  const tickIdx = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i2, a) => a.indexOf(v) === i2);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: HOLO_COLORS.textPrimary }}>
          Rolling beta (40d)
        </span>
        <span style={{ fontSize: 10, color: HOLO_COLORS.textMuted }}>faded = low r (weak fit) · gaps = quiet driver</span>
      </div>
      <svg width="100%" height={200} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" role="img" aria-label="Rolling 40-day beta">
        <line x1={PAD.left} x2={VIEW_W - PAD.right} y1={yScale(0)} y2={yScale(0)} stroke="rgba(255,255,255,0.18)" strokeDasharray="4 4" />
        <text x={PAD.left - 6} y={yScale(0) + 3} textAnchor="end" fontSize="10" fill={HOLO_COLORS.textMuted} fontFamily="system-ui, -apple-system, sans-serif">0</text>
        {[hi, lo].map((v) => (
          <text key={`b-${v}`} x={PAD.left - 6} y={yScale(v) + 3} textAnchor="end" fontSize="10" fill={HOLO_COLORS.textMuted} fontFamily="system-ui, -apple-system, sans-serif">
            {v.toFixed(2)}
          </text>
        ))}
        {segs.map((seg, k) => (
          <path key={k} d={linePath(seg, xScale, yScale)} fill="none" stroke={GOLD} strokeWidth="2" opacity={seg.lowR ? 0.35 : 1} />
        ))}
        {tickIdx.map((i) => (
          <text key={`t-${i}`} x={xScale(i)} y={VIEW_H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            fontSize="10" fill={HOLO_COLORS.textMuted} fontFamily="system-ui, -apple-system, sans-serif">
            {dates[i]}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Mandatory pure-SVG dot plot: one dot per ELIGIBLE episode's forward return;
 *  filled = independent (aggregated), hollow = clustered; median marked only
 *  once the tier allows a median (n ≥ 3). */
function DotStrip({ details, median, showMedian }) {
  const vals = details.map((r) => r.fwdReturn);
  if (!vals.length) return null;
  let lo = Math.min(0, ...vals);
  let hi = Math.max(0, ...vals);
  const span = Math.max(hi - lo, 0.01);
  lo -= span * 0.15;
  hi += span * 0.15;
  const W = 600;
  const H = 34;
  const x = (v) => 8 + ((v - lo) / (hi - lo)) * (W - 16);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Episode forward returns">
      <line x1={8} x2={W - 8} y1={H / 2} y2={H / 2} stroke="rgba(255,255,255,0.12)" />
      <line x1={x(0)} x2={x(0)} y1={6} y2={H - 6} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
      {showMedian && median != null ? (
        <line x1={x(median)} x2={x(median)} y1={4} y2={H - 4} stroke={GOLD} strokeWidth="2" />
      ) : null}
      {details.map((r, k) => (
        <circle
          key={k}
          cx={x(r.fwdReturn)}
          cy={H / 2}
          r={5}
          fill={r.independent ? (r.fwdReturn > 0 ? HOLO_COLORS.greenMuted ?? '#10b981' : '#EF4444') : 'transparent'}
          stroke={r.independent ? 'none' : HOLO_COLORS.textSecondary}
          strokeWidth={r.independent ? 0 : 1.5}
        >
          <title>{`${r.startDate} → ${r.exitDate}: ${fmtPct(r.fwdReturn)}${r.independent ? '' : ' (clustered)'}`}</title>
        </circle>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Base-rate panel — episode-first, tiered strictly by independentCount (pinned)
// ─────────────────────────────────────────────────────────────────────────────
function HorizonBaseRate({ h, group, driver, sinceDate, driverLabel, driverUnit }) {
  if (!group) return null;
  const n = group.independentCount;
  const tally = group.hitRate == null ? null : Math.round(group.hitRate * n);
  const since = sinceDate ?? 'the start of the eligible window';
  const breaks = n === 1 ? 'break' : 'breaks';
  const driverBit = driver && driver.median != null
    ? ` ${driverLabel} moved ${fmtPct(driver.median)} (median, ${driverUnit}) over the same windows.`
    : '';

  let sentence;
  if (group.eligibleCount === 0) {
    return (
      <div style={{ fontSize: 12, color: HOLO_COLORS.textMuted }}>
        +{h}d — no episode had {h} trading days of history left before the window's end.
      </div>
    );
  } else if (n < 3) {
    sentence = `Only ${n} independent ${breaks} since ${since} — not enough to summarize; showing the individual episodes.`;
  } else if (n <= 4) {
    sentence = `Based on only ${n} independent ${breaks} since ${since}, the ${h}-day group return was ${fmtPct(group.median)} at the median — ${tally} of ${n} positive. Directional only — wide uncertainty.${driverBit}`;
  } else if (n <= 7) {
    sentence = `Based on ${n} independent ${breaks} since ${since}, the ${h}-day group return was ${fmtPct(group.median)} at the median, positive ${Math.round(group.hitRate * 100)}% of the time (n = ${n}). Small sample.${driverBit}`;
  } else {
    const vals = group.details.filter((r) => r.independent).map((r) => r.fwdReturn);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    sentence = `Based on ${n} independent ${breaks} since ${since}, the ${h}-day group return was ${fmtPct(group.median)} at the median (range ${fmtPct(min)} to ${fmtPct(max)}), positive ${Math.round(group.hitRate * 100)}% of the time (n = ${n}).${driverBit}`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: HOLO_COLORS.textPrimary }}>+{h}d</span>
        <span style={{ fontSize: 12, color: HOLO_COLORS.textSecondary, lineHeight: 1.5 }}>{sentence}</span>
      </div>
      <DotStrip details={group.details} median={group.median} showMedian={n >= 3} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Build 3 — conditioned base rates beneath the unconditioned tiers, humanized in
// Build 3.1. Per-side lines render ONLY when a 50DMA partition reaches ≥ 3
// independent breaks at that horizon (the server nulls the stats below that, so
// a sub-3 partition CANNOT render a median even by accident) — raw tally at 3–4
// independent, percentage only at ≥ 5, past-tense and sample-bounded.
//
// Change B: each side is grouped under a trend-word header. Change C — three
// branches so a trending tape doesn't just restate the unconditioned aggregate:
//   • ONE-SIDED (every break on one 50DMA side) → a single no-contrast sentence
//     (no numbers repeated) — the common trending-tape case.
//   • both sides have breaks AND at least one cleared 3 independent → per-side
//     grouped lines.
//   • both sides have breaks but neither cleared 3 independent → the existing
//     "not enough on either side" copy.
// byCondition absent (pre-Build-3 cached payload) → nothing renders.
// ─────────────────────────────────────────────────────────────────────────────
const CONDITION_SIDES = [
  { key: 'above50DMA', side: 'above', header: 'Breaks that fired in an uptrend (above the 50DMA)' },
  { key: 'below50DMA', side: 'below', header: 'Breaks that fired in a downtrend (below the 50DMA)' },
];

export function ConditionedBaseRates({ byCondition, inflections }) {
  if (!byCondition) return null;

  // Break counts per 50DMA side from the episode stamps (a null stamp joins
  // neither side — the SAME partition rule the engine used). Drives the
  // no-contrast collapse: when every break sits on one side the per-side lines
  // would just restate the unconditioned aggregate above.
  const eps = Array.isArray(inflections) ? inflections : [];
  const aboveN = eps.filter((ep) => ep?.contextAtFlag?.vs50DMA === 'above').length;
  const belowN = eps.filter((ep) => ep?.contextAtFlag?.vs50DMA === 'below').length;
  const oneSided = (aboveN > 0 && belowN === 0) || (belowN > 0 && aboveN === 0);

  // Per-side detail lines, tier-gated by the server (median != null ⇒ ≥ 3
  // independent). One guard — no client copy of the threshold to drift.
  const sideGroups = CONDITION_SIDES.map((side) => {
    const lines = [];
    for (const h of [5, 10, 20]) {
      const b = byCondition[side.key]?.[h];
      if (!b || b.median == null) continue;
      const n = b.independentCount;
      const outcomeBit =
        n >= 5
          ? `positive ${Math.round(b.hitRate * 100)}% of the time (n = ${n})`
          : `${Math.round(b.hitRate * n)} of ${n} positive`;
      lines.push(
        <div key={`${side.key}-${h}`} style={{ fontSize: 12, color: HOLO_COLORS.textSecondary, lineHeight: 1.5 }}>
          +{h}d (n={n}): median {fmtPct(b.median)} — {outcomeBit}.
        </div>
      );
    }
    return { side, lines };
  });
  const hasLines = sideGroups.some((g) => g.lines.length);

  let body;
  if (oneSided) {
    const n = aboveN || belowN;
    const trend = aboveN ? 'an uptrend' : 'a downtrend';
    // "All 1 break" reads wrong; the lone-break case gets its own lead.
    const lead = n === 1 ? 'The only break fired' : `All ${n} breaks fired`;
    body = (
      <div style={{ fontSize: 12, color: HOLO_COLORS.textSecondary, lineHeight: 1.5 }}>
        {lead} in {trend} — no contrast to show until breaks occur on both sides.
      </div>
    );
  } else if (hasLines) {
    body = sideGroups
      .filter((g) => g.lines.length)
      .map((g) => (
        <div key={g.side.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: HOLO_COLORS.textPrimary }}>{g.side.header}</div>
          {g.lines}
        </div>
      ));
  } else {
    body = (
      <div style={{ fontSize: 12, color: HOLO_COLORS.textMuted }}>
        Not enough breaks on either side of the 50DMA to summarize separately (fewer than 3
        independent per side).
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`, paddingTop: 10 }}>
      <div style={captionStyle}>By the group's 50DMA state at the flag</div>
      {body}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// V2 Build 4 — WHEN DOES THE LINK HOLD? Conditional correlation, three
// same-day splits of the joined sample (driver direction, vol regime, group
// trend), each read side vs side ONLY. The card caption is the truncation
// guard (CAPTIONS.conditional) and the layout keeps the side numbers inside
// this card, never beside the headline strip.
// ─────────────────────────────────────────────────────────────────────────────

// Row config: response block key, plain-words row name, and a FALLBACK side
// pair. The authoritative side keys arrive in each block's `sides` array (the
// server owns the side vocabulary — review fix: a client mirror of the keys
// fails confidently-wrong on a server-side rename); the pair here covers only
// blocks without one. Side LABELS come from the server block too (the
// registry is the label home — TNX reads "days the 10Y yield rose/fell").
const CONDITIONAL_ROWS = [
  { key: 'driverDirection', name: 'Driver direction', sides: ['up', 'down'] },
  { key: 'volRegime', name: 'Volatility regime', sides: ['high', 'calm'] },
  { key: 'trendState', name: 'Group trend', sides: ['up', 'down'] },
];

// The verdict-chip mapping (pinned copy) lives in correlationVerdict.js with
// the other pure presentation-honesty helpers — conditionalVerdict, imported
// above and unit-tested beside buildVerdictSentence/breakStatePhrase.

const CONDITIONAL_CHIP_COLOR = {
  tighter: GOLD,
  flipped: GOLD, // a real regime-dependent finding, like 'tighter' — accent, not caution
  nodiff: HOLO_COLORS.textSecondary,
  insufficient: HOLO_COLORS.textMuted,
  unmeasurable: HOLO_COLORS.textMuted,
};

export function ConditionalCard({ conditional, isDesktop }) {
  // Pre-Build-4 cached payloads lack the block entirely — render nothing
  // (the absence-tolerance rule; daily cache expiry refreshes it).
  if (!conditional) return null;
  const minObs = conditional.minObs ?? 60;
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={captionStyle}>When does the link hold?</div>
        <div style={subCaptionStyle}>{CAPTIONS.conditional}</div>
      </div>
      {CONDITIONAL_ROWS.map(({ key, name, sides }) => {
        const block = conditional[key];
        if (!block) return null;
        // Server-sent side keys win; the config pair is the fallback.
        const sideKeys =
          Array.isArray(block.sides) && block.sides.length === 2 ? block.sides : sides;
        const verdict = conditionalVerdict(block, sideKeys, minObs);
        const sideCell = (s) => (
          <div key={s} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: HOLO_COLORS.textMuted }}>{block.labels?.[s] ?? s}</span>
            <span style={{ fontFamily: MONO, fontSize: 13, color: block[s] ? HOLO_COLORS.textPrimary : HOLO_COLORS.textMuted }}>
              {/* A null side prints its real day count; a MISSING count prints a
                  bare dash — an n=0 must never be fabricated (null-never-zero). */}
              {block[s]
                ? `r = ${fmtCorr(block[s].corr)} (n=${block[s].n})`
                : block.counts?.[s] != null
                  ? `— (n=${block.counts[s]})`
                  : '—'}
            </span>
          </div>
        );
        return (
          <div
            key={key}
            style={{
              borderTop: `1px solid ${HOLO_COLORS.borderSubtle}`,
              paddingTop: 10,
              display: isDesktop ? 'grid' : 'flex',
              ...(isDesktop
                ? { gridTemplateColumns: '130px 1fr 1fr minmax(140px, auto)', gap: 12, alignItems: 'center' }
                : { flexDirection: 'column', gap: 6 }), // ≤390px: the three rows stack
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: HOLO_COLORS.textPrimary }}>{name}</div>
            {sideKeys.map(sideCell)}
            {verdict ? (
              <span
                style={{
                  justifySelf: isDesktop ? 'end' : undefined,
                  alignSelf: isDesktop ? 'center' : 'flex-start',
                  padding: '3px 10px',
                  borderRadius: 10,
                  border: `1px solid ${CONDITIONAL_CHIP_COLOR[verdict.kind]}55`,
                  color: CONDITIONAL_CHIP_COLOR[verdict.kind],
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                {verdict.text}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const card = {
  background: HOLO_COLORS.bgCard,
  border: `1px solid ${HOLO_COLORS.borderSubtle}`,
  borderRadius: 12,
  padding: '16px 18px',
};

const captionStyle = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: HOLO_COLORS.textMuted,
};

// The sentence-case muted caption idiom (the :558 betaInterpretation form) —
// the reuse target for Change D stat captions.
const subCaptionStyle = { fontSize: 11, color: HOLO_COLORS.textMuted, marginTop: 6 };

// Change E — example chip (fill-and-run), HOLO-styled to match the Lab's accent.
const chipStyle = {
  padding: '7px 14px',
  borderRadius: 20,
  border: `1px solid ${GOLD}55`,
  background: `${GOLD}14`,
  color: GOLD,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export default function CorrelationLab({ isDesktop, embedded = false }) {
  const [groupInput, setGroupInput] = useState('XOM, CVX, COP');
  const [driverKey, setDriverKey] = useState('BRENT');
  const [customSymbol, setCustomSymbol] = useState('');
  const [inputError, setInputError] = useState(null);
  // state.kind: 'single' | 'scan' — which surface the loading/ready/error
  // state belongs to. The scan table REPLACES the single-driver results while
  // a scan is displayed; the last-shown result of the other kind is dropped.
  const [state, setState] = useState({ status: 'idle', data: null, error: null, kind: 'single' });
  const [chartTab, setChartTab] = useState('corr');
  // Stale-response guard (the ScoutingBoardSheet cancellation idiom, sequence
  // form): overlapping runs resolve in arbitrary order, and without this a
  // slow response for an OLD query would overwrite a newer result on screen.
  // SHARED by single runs and scans (pinned): a late scan must not overwrite
  // a newer single run, and vice versa.
  const runSeq = useRef(0);

  const isCustom = driverKey === 'CUSTOM';
  // CUSTOM's label is the raw ticker (matches the server's synthetic label /
  // betaInterpretation); registry drivers use the mirrored label.
  const customTicker = customSymbol.trim().toUpperCase().replace(/\.US$/, '');
  // LIVE (input-state) label — reflects the current select. Used ONLY by
  // input-adjacent copy: the error notice, whose failed run has no payload to
  // bind to. Result surfaces derive their label from the payload via
  // resolveResultLabels(data) — flipping the select after a run must never
  // relabel results that belong to the driver actually computed.
  const driverLabel = isCustom
    ? customTicker || 'custom ticker'
    : DRIVER_LABELS[driverKey] ?? driverKey;

  const run = useCallback(
    (forceRefresh = false, override) => {
      // Chips fill the inputs AND run immediately; setState is async, so the
      // chip's values arrive via `override` rather than the (stale) closure.
      const groupSource = override?.groupInput ?? groupInput;
      const driverSource = override?.driverKey ?? driverKey;
      const customSource = override?.customSymbol ?? customSymbol;
      const parsed = parseGroup(groupSource);
      if (parsed.error) {
        setInputError(parsed.error);
        return;
      }
      const { group } = parsed;
      // Pair mode: validate the custom ticker with the SAME regex the endpoint
      // uses before sending. (Self-correlation is left to the server 400 so the
      // real guard is what users hit.)
      let customPayload = null;
      if (driverSource === 'CUSTOM') {
        const custom = customSource.trim().toUpperCase().replace(/\.US$/, '');
        if (!SYMBOL_RE.test(custom)) {
          setInputError('Enter a valid custom ticker (e.g. AAPL, BRK.B).');
          return;
        }
        customPayload = custom;
      }
      setInputError(null);
      const seq = ++runSeq.current;
      setState({ status: 'loading', data: null, error: null, kind: 'single' });
      fetchWithAuth('/api/research/correlation', {
        method: 'POST',
        body: JSON.stringify({
          group,
          driver: driverSource,
          ...(customPayload ? { customSymbol: customPayload } : {}),
          ...(forceRefresh ? { forceRefresh: true } : {}),
        }),
      })
        .then(async (r) => {
          if (!r.ok) {
            let detail = null;
            try { detail = await r.json(); } catch { /* opaque error body */ }
            throw new Error(detail?.error ? `${r.status}:${detail.error}` : `corr_${r.status}`);
          }
          return r.json();
        })
        .then((data) => {
          if (seq !== runSeq.current) return; // a newer run superseded this one
          setState({ status: 'ready', data, error: null, kind: 'single' });
        })
        .catch((e) => {
          if (seq !== runSeq.current) return;
          setState({ status: 'error', data: null, error: e.message, kind: 'single' });
        });
    },
    [groupInput, driverKey, customSymbol]
  );

  // V2 Build 2 — SCAN ALL: the group against every registry driver. Shares
  // the group input + validation with single runs; the driver select (and any
  // custom ticker) is ignored — scans are registry-only, CUSTOM never scans.
  // `groupOverride` (canonical string[], e.g. scan.meta.group) pins a refresh
  // to the DISPLAYED scan's group even if the input box was edited since —
  // it fills the input too (the chip idiom), so box and table agree.
  const runScan = useCallback(
    (forceRefresh = false, groupOverride = null) => {
      const source = groupOverride ? groupOverride.join(', ') : groupInput;
      if (groupOverride) setGroupInput(source);
      const parsed = parseGroup(source);
      if (parsed.error) {
        setInputError(parsed.error);
        return;
      }
      setInputError(null);
      const seq = ++runSeq.current; // shared counter — see the runSeq note above
      setState({ status: 'loading', data: null, error: null, kind: 'scan' });
      fetchWithAuth('/api/research/correlation-scan', {
        method: 'POST',
        body: JSON.stringify({
          group: parsed.group,
          ...(forceRefresh ? { forceRefresh: true } : {}),
        }),
      })
        .then(async (r) => {
          if (!r.ok) {
            let detail = null;
            try { detail = await r.json(); } catch { /* opaque error body */ }
            throw new Error(detail?.error ? `${r.status}:${detail.error}` : `scan_${r.status}`);
          }
          return r.json();
        })
        .then((data) => {
          if (seq !== runSeq.current) return; // a newer run superseded this one
          setState({ status: 'ready', data, error: null, kind: 'scan' });
        })
        .catch((e) => {
          if (seq !== runSeq.current) return;
          setState({ status: 'error', data: null, error: e.message, kind: 'scan' });
        });
    },
    [groupInput]
  );

  // Deep dive from a scan row: select that driver and run the single-driver
  // analysis (the scan is the breadth surface; this is the depth surface).
  // `group` arrives as an ARGUMENT from the render-scoped scan payload
  // (scan.meta.group) — the depth surface must analyze the group the clicked
  // row describes, not whatever the input box says now; passing it (rather
  // than reading `scan` here) also avoids a stale capture, since this
  // callback memoizes on [run] alone. The input box is filled to match (the
  // chip idiom), so the round-tripped canonical group re-parses identically.
  const deepDive = useCallback(
    (row, group) => {
      const groupInputValue = group.join(', ');
      setGroupInput(groupInputValue);
      setDriverKey(row.driver);
      run(false, { groupInput: groupInputValue, driverKey: row.driver });
    },
    [run]
  );

  // Payload split by kind: `data` keeps its V0 meaning (the single-driver
  // payload) so everything below this line is untouched; `scan` is the
  // scan payload. Exactly one is non-null once ready.
  const data = state.kind === 'single' ? state.data : null;
  const scan = state.kind === 'scan' ? state.data : null;
  const activeMeta = (data ?? scan)?.meta ?? null;
  // X-axis derives from corr20 — the LONGER series (its windows start 40
  // sessions earlier). corr60 maps onto it by eventDate; dates before corr60's
  // first window resolve to null and segmentsOf gaps that line, so a short
  // joined history (21–60 closes) still draws the valid 20d series instead of
  // hiding it. corr60's eventDates are a subset of corr20's (same joinedDates).
  const corrDates = useMemo(() => (data ? data.series.corr20.map((e) => e.eventDate) : []), [data]);
  const corr20Pts = useMemo(() => (data ? data.series.corr20.map((e) => ({ v: e.value })) : []), [data]);
  const corr60OnCorr20 = useMemo(() => {
    if (!data) return [];
    const byDate = new Map(data.series.corr60.map((e) => [e.eventDate, e.value]));
    return corrDates.map((d) => ({ v: byDate.get(d) ?? null }));
  }, [data, corrDates]);
  const betaDates = useMemo(() => (data ? data.series.beta40.map((e) => e.eventDate) : []), [data]);
  const episodeDates = useMemo(() => (data?.inflections ?? []).map((ep) => ep.startDate), [data]);

  // Per-horizon detail lookup for the inflection table (independence is
  // per-horizon: an episode can be independent at +5d and clustered at +20d).
  const detailByHorizon = useMemo(() => {
    const out = {};
    for (const h of [5, 10, 20]) {
      out[h] = {
        group: new Map((data?.baseRates?.group?.[h]?.details ?? []).map((r) => [r.startCloseIndex, r])),
        driver: new Map((data?.baseRates?.driver?.[h]?.details ?? []).map((r) => [r.startCloseIndex, r])),
      };
    }
    return out;
  }, [data]);

  const lowFit = data?.beta?.latest?.r != null && Math.abs(data.beta.latest.r) < LOW_R_THRESHOLD;

  // Every result surface below reads its driver label/unit from the PAYLOAD via
  // this (never the live select). Non-null only in the single-driver ready
  // state — every consumer sits inside the `data`-guarded result block.
  const resultLabels = data ? resolveResultLabels(data) : null;

  return (
    <div style={{
      // Embedded (Discover tab): the parent panel owns width/margins/scroll
      // runway — drop the page-level container so only the internal stack shows.
      ...(embedded ? {} : { maxWidth: 960, margin: '0 auto', padding: isDesktop ? '24px 24px 96px' : '16px 12px 96px' }),
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {!embedded ? (
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', color: HOLO_COLORS.textPrimary, margin: 0 }}>
            Correlation Lab
          </h1>
          <div style={{ fontSize: 12, color: HOLO_COLORS.textMuted, marginTop: 4 }}>
            Rolling return correlation, beta, lead-lag, and regime breaks — a group of stocks (or one ETF proxy) against a macro driver.
          </div>
        </div>
      ) : null}

      {/* 1 — Query bar */}
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <label style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={captionStyle}>Group (1–10 tickers, or one ETF proxy)</span>
          <input
            value={groupInput}
            onChange={(e) => setGroupInput(e.target.value)}
            // Loading gate matches the disabled buttons — Enter mid-scan must
            // not discard an in-flight ~27-fetch scan whose quota is spent.
            onKeyDown={(e) => { if (e.key === 'Enter' && state.status !== 'loading') run(); }}
            placeholder="XOM, CVX, COP"
            style={{
              background: HOLO_COLORS.bgElevated, border: `1px solid ${HOLO_COLORS.borderSubtle}`, borderRadius: 8,
              padding: '9px 12px', color: HOLO_COLORS.textPrimary, fontSize: 13, fontFamily: MONO, outline: 'none',
            }}
          />
        </label>
        <label style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={captionStyle}>Driver</span>
          <select
            value={driverKey}
            onChange={(e) => setDriverKey(e.target.value)}
            style={{
              background: HOLO_COLORS.bgElevated, border: `1px solid ${HOLO_COLORS.borderSubtle}`, borderRadius: 8,
              padding: '9px 10px', color: HOLO_COLORS.textPrimary, fontSize: 13,
            }}
          >
            {DRIVER_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {isCustom ? (
          <label style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={captionStyle}>Custom ticker</span>
            <input
              value={customSymbol}
              onChange={(e) => setCustomSymbol(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && state.status !== 'loading') run(); }}
              placeholder="AAPL"
              aria-label="Custom driver ticker"
              style={{
                width: 110,
                background: HOLO_COLORS.bgElevated, border: `1px solid ${HOLO_COLORS.borderSubtle}`, borderRadius: 8,
                padding: '9px 12px', color: HOLO_COLORS.textPrimary, fontSize: 13, fontFamily: MONO, outline: 'none',
              }}
            />
          </label>
        ) : null}
        <button
          onClick={() => run()}
          disabled={state.status === 'loading'}
          style={{
            padding: '10px 22px', borderRadius: 8, cursor: state.status === 'loading' ? 'default' : 'pointer',
            background: HOLO_COLORS.bgElevated, color: HOLO_COLORS.textPrimary, fontSize: 13, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '1px', border: `1px solid ${HOLO_COLORS.borderSubtle}`,
            opacity: state.status === 'loading' ? 0.6 : 1,
          }}
        >
          {state.status === 'loading' && state.kind === 'single' ? 'Running…' : 'Run'}
        </button>
        {/* V2 Build 2 — secondary action: every registry driver, ranked.
            Group + lookback inputs shared; the driver select is ignored. */}
        <button
          onClick={() => runScan()}
          disabled={state.status === 'loading'}
          style={{
            padding: '10px 16px', borderRadius: 8, cursor: state.status === 'loading' ? 'default' : 'pointer',
            background: 'transparent', color: HOLO_COLORS.textSecondary, fontSize: 13, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '1px', border: `1px solid ${HOLO_COLORS.borderSubtle}`,
            opacity: state.status === 'loading' ? 0.6 : 1,
          }}
        >
          {state.status === 'loading' && state.kind === 'scan' ? 'Scanning…' : 'Scan all'}
        </button>
        {inputError ? <div style={{ flexBasis: '100%', fontSize: 12, color: '#EF4444' }}>{inputError}</div> : null}
        {activeMeta?.droppedSymbols?.length ? (
          <div style={{ flexBasis: '100%', fontSize: 12, color: AMBER }}>
            Could not fetch: {activeMeta.droppedSymbols.join(', ')}
          </div>
        ) : null}
        {activeMeta?.partial ? (
          <div style={{
            flexBasis: '100%', fontSize: 12, color: AMBER, border: `1px solid ${AMBER}55`,
            background: `${AMBER}14`, borderRadius: 8, padding: '8px 10px',
          }}>
            Partial result — computed without the symbols above and <strong>not cached</strong>.
          </div>
        ) : null}
      </div>

      {state.status === 'idle' ? (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, color: HOLO_COLORS.textMuted }}>
            Pick a group and a driver, then Run. Nothing loads until you ask.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={captionStyle}>Try one</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {EXAMPLE_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => {
                    setGroupInput(chip.group);
                    setDriverKey(chip.driver);
                    run(false, { groupInput: chip.group, driverKey: chip.driver });
                  }}
                  style={chipStyle}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {state.status === 'loading' ? (
        <div style={card}><ChartSkeleton height={240} /></div>
      ) : null}

      {state.status === 'error'
        ? (() => {
            const knownCode = Object.keys(ERROR_COPY).find((code) => String(state.error).includes(code));
            return (
              <div style={{ ...card, borderColor: '#EF444455' }}>
                <div style={{ fontSize: 13, color: HOLO_COLORS.textPrimary, marginBottom: 8 }}>
                  {knownCode ? ERROR_COPY[knownCode](driverLabel) : "Couldn't run that query just now."}
                </div>
                {!knownCode ? (
                  <div style={{ fontSize: 10, color: HOLO_COLORS.textMuted, marginBottom: 8, fontFamily: MONO }}>
                    {String(state.error)}
                  </div>
                ) : null}
                <button onClick={() => (state.kind === 'scan' ? runScan() : run())} style={{ background: 'transparent', border: `1px solid ${HOLO_COLORS.borderSubtle}`, borderRadius: 8, color: HOLO_COLORS.textSecondary, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                  Try again
                </button>
              </div>
            );
          })()
        : null}

      {/* V2 Build 2 — scan results replace the single-driver results while displayed.
          Deep dive and refresh are bound to the DISPLAYED scan's group
          (scan.meta.group), captured render-fresh by these inline closures —
          never to the live input text, which may have been edited since. */}
      {state.status === 'ready' && scan ? (
        <ScanResults
          scan={scan}
          isDesktop={isDesktop}
          onDeepDive={(row) => deepDive(row, scan.meta.group)}
          onRefresh={() => runScan(true, scan.meta.group)}
        />
      ) : null}

      {state.status === 'ready' && data ? (
        <>
          {/* C — plain-language verdict sentence (deterministic; assembled from the payload) */}
          {(() => {
            const verdict = buildVerdictSentence(data, resultLabels.driverLabel);
            return verdict ? (
              <div style={{ ...card, borderColor: `${GOLD}44` }}>
                <div style={{ fontSize: 15, color: HOLO_COLORS.textPrimary, lineHeight: 1.55 }}>{verdict}</div>
              </div>
            ) : null;
          })()}

          {/* 2 — Headline strip */}
          <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(auto-fit, minmax(200px, 1fr))' : '1fr', gap: 12 }}>
            <div style={card}>
              <div style={captionStyle}>Link — 1-month / 3-month</div>
              <div style={{ display: 'flex', gap: 18, marginTop: 8, alignItems: 'baseline' }}>
                <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: GOLD }}>{fmtCorr(data.byWindow.corr20.value)}</span>
                <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: GRAY }}>{fmtCorr(data.byWindow.corr60.value)}</span>
              </div>
              <div style={{ fontSize: 11, color: HOLO_COLORS.textMuted, marginTop: 6 }}>
                (20d / 60d rolling correlation of daily returns) vs {resultLabels.driverLabel}, {data.meta.joinedCloses} joined sessions
              </div>
              <div style={subCaptionStyle}>{CAPTIONS.correlation}</div>
            </div>
            <div style={card}>
              <div style={captionStyle}>Move size — when they move together</div>
              {data.beta.latest ? (
                <>
                  <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'baseline' }}>
                    <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: HOLO_COLORS.textPrimary, opacity: lowFit ? 0.55 : 1 }}>
                      {fmtBeta(data.beta.latest.beta)}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: HOLO_COLORS.textMuted }}>
                      r = {data.beta.latest.r == null ? '—' : data.beta.latest.r.toFixed(2)}{lowFit ? ' · weak fit' : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: HOLO_COLORS.textMuted, marginTop: 6 }}>{data.beta.interpretation} (rolling 40d)</div>
                  <div style={subCaptionStyle}>{CAPTIONS.beta}</div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: HOLO_COLORS.textMuted, marginTop: 8 }}>
                  No usable beta window (quiet driver or not enough history).
                </div>
              )}
            </div>
            <div style={card}>
              <div style={captionStyle}>Lead-lag</div>
              <div style={{ fontSize: 14, color: HOLO_COLORS.textPrimary, marginTop: 8, lineHeight: 1.5 }}>
                {leadLagSentence(data.leadLag, resultLabels.driverLabel)}
              </div>
              {(() => {
                // H7 — on a flat verdict, show the strongest lagged reading so the
                // (correctly) inert "no lead" copy carries its evidence.
                const evidence = leadLagEvidenceLine(data.leadLag);
                return evidence ? (
                  <div style={{ fontSize: 12, color: HOLO_COLORS.textMuted, marginTop: 6, lineHeight: 1.5 }}>
                    {evidence}
                  </div>
                ) : null;
              })()}
              <div style={subCaptionStyle}>{CAPTIONS.leadLag}</div>
            </div>
            {/* F — divergence tension gauge */}
            <div style={card}>
              <div style={captionStyle}>Divergence watch</div>
              {(() => {
                const div = data.divergence?.latest ?? null;
                if (!div) {
                  return <div style={{ fontSize: 12, color: HOLO_COLORS.textMuted, marginTop: 8 }}>Not enough history yet.</div>;
                }
                const st = divergenceState(div);
                return (
                  <>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: st.color }}>{st.word}</span>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: HOLO_COLORS.textMuted }}>
                        d {fmtCorr(div.d)}{div.score != null ? ` · SDS ${fmtCorr(div.score)}` : ''}
                      </span>
                    </div>
                    {/* The two attention states ('stretched', 'break') carry their
                        own honest caption — the state note (Build 3.1 + H6); calm /
                        elevated keep the unchanged Divergence Watch caption. */}
                    <div style={subCaptionStyle}>{st.note ?? CAPTIONS.tension}</div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* 3 — Rolling chart */}
          <div style={card}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { id: 'corr', label: 'Correlation 20d vs 60d' },
                { id: 'beta', label: 'Beta 40d' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setChartTab(tab.id)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                    border: `1px solid ${chartTab === tab.id ? GOLD : HOLO_COLORS.borderSubtle}`,
                    background: chartTab === tab.id ? `${GOLD}1a` : 'transparent',
                    color: chartTab === tab.id ? GOLD : HOLO_COLORS.textSecondary,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {chartTab === 'corr' ? (
              corrDates.length ? (
                <DualSeriesChart
                  title={`Group vs ${resultLabels.driverLabel} — how tightly they've moved together`}
                  seriesA={corr20Pts}
                  seriesB={corr60OnCorr20}
                  labelA="1-mo link"
                  labelB="3-mo link"
                  domain={[-1, 1]}
                  episodeDates={episodeDates}
                  dates={corrDates}
                  format={(v) => v.toFixed(v === 0 ? 0 : 2)}
                />
              ) : (
                <div style={{ fontSize: 12, color: HOLO_COLORS.textMuted, padding: '24px 0' }}>
                  Not enough joined history for a 20-day rolling window.
                </div>
              )
            ) : (
              <BetaChart beta40={data.series.beta40} dates={betaDates} />
            )}
          </div>

          {/* V2 Build 4 — conditional correlation between the chart and the
              regime-breaks table. ConditionalCard null-guards the field, so a
              pre-Build-4 cached payload renders the rest of the page untouched. */}
          <ConditionalCard conditional={data.conditional} isDesktop={isDesktop} />

          {/* 4/5 — Inflections + base rates, or their honest absences */}
          {data.suppressed?.inflections ? (
            <div style={{ ...card, borderColor: `${AMBER}55` }}>
              <div style={captionStyle}>Regime breaks — suppressed</div>
              <div style={{ fontSize: 12, color: HOLO_COLORS.textSecondary, marginTop: 6 }}>
                {data.suppressed.inflections}
              </div>
            </div>
          ) : data.inflections && data.inflections.length === 0 ? (
            <div style={card}>
              <div style={captionStyle}>Regime breaks</div>
              <div style={{ fontSize: 12, color: HOLO_COLORS.textSecondary, marginTop: 6 }}>
                No correlation-regime breaks detected in the eligible window
                {data.meta.firstEligibleInflectionDate ? ` (since ${data.meta.firstEligibleInflectionDate})` : ''}.
              </div>
            </div>
          ) : data.inflections ? (
            <>
              <div style={card}>
                <div style={{ ...captionStyle, marginBottom: 6 }}>
                  Regime breaks — {data.inflections.length} episode{data.inflections.length === 1 ? '' : 's'} since {data.meta.firstEligibleInflectionDate}
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> · ● independent · ○ clustered (counted once in the aggregate)</span>
                </div>
                <div style={{ ...subCaptionStyle, marginTop: 0, marginBottom: 10 }}>
                  {CAPTIONS.regimeBreaks} State at break: {CAPTIONS.stateAtBreak}
                  {data.meta.driver === 'TNX' ? ' Driver into-break values are % change in the yield level.' : ''}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: HOLO_COLORS.textMuted, textAlign: 'left' }}>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>Date</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>Type</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>20d / 60d at flag</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>State at break</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>Group 5d into break</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>Driver 5d into break</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>Group +5d</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>+10d</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>+20d</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>{resultLabels.driverLabel} +10d</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.inflections.map((ep) => {
                        const cell = (h, side) => {
                          const row = detailByHorizon[h][side].get(ep.startCloseIndex);
                          if (!row) return <span style={{ color: HOLO_COLORS.textMuted }}>—</span>;
                          return (
                            <span style={{ fontFamily: MONO, color: pctColor(row.fwdReturn) }}>
                              {row.independent ? '●' : '○'} {fmtPct(row.fwdReturn)}
                            </span>
                          );
                        };
                        const tag = driverTag(ep);
                        const phrase = breakStatePhrase(ep.contextAtFlag);
                        return (
                          <tr key={ep.startCloseIndex} style={{ borderTop: `1px solid ${HOLO_COLORS.borderSubtle}` }}>
                            <td style={{ padding: '6px 8px', fontFamily: MONO, color: HOLO_COLORS.textPrimary }}>{ep.startDate}</td>
                            <td style={{ padding: '6px 8px', color: ep.direction === 'weakening' ? AMBER : HOLO_COLORS.textSecondary }}>
                              {directionLabel(ep.direction)}
                              {tag ? <div style={{ fontSize: 10, color: HOLO_COLORS.textMuted, marginTop: 2 }}>{tag}</div> : null}
                            </td>
                            <td style={{ padding: '6px 8px', fontFamily: MONO, color: HOLO_COLORS.textSecondary }}>
                              {fmtCorr(ep.corr20AtFlag)} / {fmtCorr(ep.corr60AtFlag)}
                            </td>
                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                              {phrase ? (
                                <>
                                  {phrase.primary ? (
                                    <div style={{ color: HOLO_COLORS.textSecondary }}>{phrase.primary}</div>
                                  ) : null}
                                  {phrase.secondary ? (
                                    <div style={{ fontSize: 10, color: HOLO_COLORS.textMuted }}>{phrase.secondary}</div>
                                  ) : null}
                                </>
                              ) : (
                                <span style={{ color: HOLO_COLORS.textMuted }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '6px 8px', fontFamily: MONO, color: pctColor(ep.groupInto5d) }}>{fmtPct(ep.groupInto5d)}</td>
                            <td style={{ padding: '6px 8px', fontFamily: MONO, color: pctColor(ep.driverInto5d) }}>{fmtPct(ep.driverInto5d)}</td>
                            <td style={{ padding: '6px 8px' }}>{cell(5, 'group')}</td>
                            <td style={{ padding: '6px 8px' }}>{cell(10, 'group')}</td>
                            <td style={{ padding: '6px 8px' }}>{cell(20, 'group')}</td>
                            <td style={{ padding: '6px 8px' }}>{cell(10, 'driver')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {data.baseRates?.group ? (
                <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={captionStyle}>What happened after past breaks (this sample only)</div>
                  {[5, 10, 20].map((h) => (
                    <HorizonBaseRate
                      key={h}
                      h={h}
                      group={data.baseRates.group[h]}
                      driver={data.baseRates.driver?.[h]}
                      sinceDate={data.meta.firstEligibleInflectionDate}
                      driverLabel={resultLabels.driverLabel}
                      // driverUnit: the base-rate forward-return unit, payload-bound
                      // via resolveResultLabels (TNX forward returns are percent-of-
                      // level, so its diff-mode 'yield points' unit is dropped here —
                      // that belongs to the diff returns, beta/inflections, not this).
                      driverUnit={resultLabels.driverUnit}
                    />
                  ))}
                  <ConditionedBaseRates byCondition={data.baseRates.byCondition} inflections={data.inflections} />
                  <div style={{ fontSize: 10, color: HOLO_COLORS.textMuted }}>
                    Past episodes in this window only — not statistical significance, not a prediction.
                    {data.meta.driver === 'TNX' ? ' TNX forward numbers are % change in the yield level.' : ''}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {/* 6 — freshness footer */}
          <div style={{ fontSize: 11, color: HOLO_COLORS.textMuted, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span>
              as of {data.meta.computedAt}
              {data.meta.cached ? ' · cached' : ''}
            </span>
            {data.meta.cached ? (
              <button
                onClick={() => run(true)}
                style={{ background: 'transparent', border: 'none', color: HOLO_COLORS.textSecondary, fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                refresh
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
