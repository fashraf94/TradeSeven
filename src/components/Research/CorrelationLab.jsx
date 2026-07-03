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
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import { HOLO_COLORS } from '../../constants/holoTheme';
import { ChartSkeleton } from './ResearchSkeletons';

// Client-side mirror of the driver registry LABELS only (the api registry is
// server code — do not import it into the bundle; units/interpretations come
// back in the response, so the server stays the source of truth).
const DRIVER_OPTIONS = [
  { key: 'BRENT', label: 'Brent Crude (BNO proxy)' },
  { key: 'WTI', label: 'WTI Crude (USO proxy)' },
  { key: 'GOLD', label: 'Gold (GLD proxy)' },
  { key: 'VIX', label: 'VIX' },
  { key: 'TNX', label: '10Y Yield' },
  { key: 'DXY', label: 'US Dollar (UUP proxy)' },
  { key: 'SPX', label: 'S&P 500 (SPY)' },
];

const SYMBOL_RE = /^[A-Z][A-Z0-9.-]{0,9}$/; // mirrors the endpoint's pinned regex

// Single source for the endpoint's coded 422 failures (state.error carries
// "<status>:<code>"). Message = matched entry; the raw-code detail line shows
// only for codes NOT in this map — one list, no drift between the two.
const ERROR_COPY = {
  driver_unavailable: (driverLabel) => `Couldn't fetch ${driverLabel} data right now.`,
  group_unavailable: () => 'None of those tickers returned data — check the symbols.',
  no_overlapping_history: () => "Couldn't get enough overlapping history for that pair.",
};
const MONO = "'SF Mono', 'Monaco', 'Consolas', monospace";
const GOLD = '#F0C75E'; // SeasonPerformanceChart line colors
const GRAY = '#8B949E';
const AMBER = '#f59e0b';
const LOW_R_THRESHOLD = 0.3;

// ── formatting (math layer returns decimal fractions; multiply by 100 ONCE here) ──
const fmtCorr = (v) => (v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2));
const fmtPct = (v, dp = 1) => (v == null ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(dp) + '%');
const fmtBeta = (v) => (v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2));

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

const directionLabel = (d) => (d === 'weakening' ? 'correlation breakdown' : 'correlation strengthening');

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

export default function CorrelationLab({ isDesktop }) {
  const [groupInput, setGroupInput] = useState('XOM, CVX, COP');
  const [driverKey, setDriverKey] = useState('BRENT');
  const [inputError, setInputError] = useState(null);
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const [chartTab, setChartTab] = useState('corr');
  // Stale-response guard (the ScoutingBoardSheet cancellation idiom, sequence
  // form): overlapping runs resolve in arbitrary order, and without this a
  // slow response for an OLD query would overwrite a newer result on screen.
  const runSeq = useRef(0);

  const driverLabel = DRIVER_OPTIONS.find((d) => d.key === driverKey)?.label ?? driverKey;

  const run = useCallback(
    (forceRefresh = false) => {
      const group = [...new Set(groupInput.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];
      if (group.length < 1 || group.length > 10) {
        setInputError('Enter 1–10 ticker symbols (comma-separated). A single ETF proxy works too.');
        return;
      }
      const bad = group.filter((s) => !SYMBOL_RE.test(s));
      if (bad.length) {
        setInputError(`Not a valid ticker: ${bad.join(', ')}`);
        return;
      }
      setInputError(null);
      const seq = ++runSeq.current;
      setState({ status: 'loading', data: null, error: null });
      fetchWithAuth('/api/research/correlation', {
        method: 'POST',
        body: JSON.stringify({ group, driver: driverKey, ...(forceRefresh ? { forceRefresh: true } : {}) }),
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
          setState({ status: 'ready', data, error: null });
        })
        .catch((e) => {
          if (seq !== runSeq.current) return;
          setState({ status: 'error', data: null, error: e.message });
        });
    },
    [groupInput, driverKey]
  );

  const data = state.data;
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

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: isDesktop ? '24px 24px 96px' : '16px 12px 96px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', color: HOLO_COLORS.textPrimary, margin: 0 }}>
          Correlation Lab
        </h1>
        <div style={{ fontSize: 12, color: HOLO_COLORS.textMuted, marginTop: 4 }}>
          Rolling return correlation, beta, lead-lag, and regime breaks — a group of stocks (or one ETF proxy) against a macro driver.
        </div>
      </div>

      {/* 1 — Query bar */}
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <label style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={captionStyle}>Group (1–10 tickers, or one ETF proxy)</span>
          <input
            value={groupInput}
            onChange={(e) => setGroupInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
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
            {DRIVER_OPTIONS.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </label>
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
          {state.status === 'loading' ? 'Running…' : 'Run'}
        </button>
        {inputError ? <div style={{ flexBasis: '100%', fontSize: 12, color: '#EF4444' }}>{inputError}</div> : null}
        {data?.meta?.droppedSymbols?.length ? (
          <div style={{ flexBasis: '100%', fontSize: 12, color: AMBER }}>
            Could not fetch: {data.meta.droppedSymbols.join(', ')}
          </div>
        ) : null}
        {data?.meta?.partial ? (
          <div style={{
            flexBasis: '100%', fontSize: 12, color: AMBER, border: `1px solid ${AMBER}55`,
            background: `${AMBER}14`, borderRadius: 8, padding: '8px 10px',
          }}>
            Partial result — computed without the symbols above and <strong>not cached</strong>.
          </div>
        ) : null}
      </div>

      {state.status === 'idle' ? (
        <div style={{ ...card, fontSize: 12, color: HOLO_COLORS.textMuted }}>
          Pick a group and a driver, then Run. Nothing loads until you ask.
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
                <button onClick={() => run()} style={{ background: 'transparent', border: `1px solid ${HOLO_COLORS.borderSubtle}`, borderRadius: 8, color: HOLO_COLORS.textSecondary, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
                  Try again
                </button>
              </div>
            );
          })()
        : null}

      {state.status === 'ready' && data ? (
        <>
          {/* 2 — Headline strip */}
          <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(3, 1fr)' : '1fr', gap: 12 }}>
            <div style={card}>
              <div style={captionStyle}>Correlation — 20d / 60d</div>
              <div style={{ display: 'flex', gap: 18, marginTop: 8, alignItems: 'baseline' }}>
                <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: GOLD }}>{fmtCorr(data.byWindow.corr20.value)}</span>
                <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: GRAY }}>{fmtCorr(data.byWindow.corr60.value)}</span>
              </div>
              <div style={{ fontSize: 11, color: HOLO_COLORS.textMuted, marginTop: 6 }}>
                daily returns vs {driverLabel}, {data.meta.joinedCloses} joined sessions
              </div>
            </div>
            <div style={card}>
              <div style={captionStyle}>Beta — rolling 40d (latest)</div>
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
                  <div style={{ fontSize: 11, color: HOLO_COLORS.textMuted, marginTop: 6 }}>{data.beta.interpretation}</div>
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
                {leadLagSentence(data.leadLag, driverLabel)}
              </div>
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
                  title={`Group vs ${driverLabel} — rolling correlation`}
                  seriesA={corr20Pts}
                  seriesB={corr60OnCorr20}
                  labelA="20d"
                  labelB="60d"
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
                <div style={{ ...captionStyle, marginBottom: 10 }}>
                  Regime breaks — {data.inflections.length} episode{data.inflections.length === 1 ? '' : 's'} since {data.meta.firstEligibleInflectionDate}
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> · ● independent · ○ clustered (counted once in the aggregate)</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: HOLO_COLORS.textMuted, textAlign: 'left' }}>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>Date</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>Type</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>20d / 60d at flag</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>Group +5d</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>+10d</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>+20d</th>
                        <th style={{ padding: '4px 8px', fontWeight: 600 }}>{driverLabel} +10d</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.inflections.map((ep) => {
                        const cell = (h, side) => {
                          const row = detailByHorizon[h][side].get(ep.startCloseIndex);
                          if (!row) return <span style={{ color: HOLO_COLORS.textMuted }}>—</span>;
                          return (
                            <span style={{ fontFamily: MONO, color: row.fwdReturn > 0 ? '#34D399' : row.fwdReturn < 0 ? '#EF4444' : HOLO_COLORS.textSecondary }}>
                              {row.independent ? '●' : '○'} {fmtPct(row.fwdReturn)}
                            </span>
                          );
                        };
                        return (
                          <tr key={ep.startCloseIndex} style={{ borderTop: `1px solid ${HOLO_COLORS.borderSubtle}` }}>
                            <td style={{ padding: '6px 8px', fontFamily: MONO, color: HOLO_COLORS.textPrimary }}>{ep.startDate}</td>
                            <td style={{ padding: '6px 8px', color: ep.direction === 'weakening' ? AMBER : HOLO_COLORS.textSecondary }}>
                              {directionLabel(ep.direction)}
                            </td>
                            <td style={{ padding: '6px 8px', fontFamily: MONO, color: HOLO_COLORS.textSecondary }}>
                              {fmtCorr(ep.corr20AtFlag)} / {fmtCorr(ep.corr60AtFlag)}
                            </td>
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
                      driverLabel={driverLabel}
                      // Forward returns are ALWAYS percent-of-level (closes[c+h]/closes[c]−1),
                      // so TNX must not carry its diff-mode 'yield points (pp)' unit here —
                      // that label belongs to the diff returns (beta/inflections), not this number.
                      driverUnit={data.meta.driver === 'TNX' ? '% change in yield level' : data.meta.driverUnit}
                    />
                  ))}
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
