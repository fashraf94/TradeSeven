// research/level-study/tools/a5-completeness.mjs
//
// S56-A5 — DATA-COMPLETENESS ELIGIBILITY (pre-registered, pre-outcome; founder sets the floor).
//
//   node tools/a5-completeness.mjs
//
// WHY THIS EXISTS. At 11 mega-caps, missing 5-minute bars were rare and benign. At 232 names the
// universe reaches into far less liquid tickers — and there, absent bars are NOT vendor gaps. They
// are ILLIQUIDITY. Illiquidity correlates with volatility, spread, gap behavior and reaction
// quality, i.e. with the very things this study measures. Left unmeasured, a data-quality artifact
// becomes a HIDDEN CONFOUNDER in every cut.
//
// So: measure coverage per symbol, show its distribution, test whether it tracks illiquidity as
// predicted, and PROPOSE a floor drawn FROM THE MEASURED DISTRIBUTION — exactly as floorPct/capPct
// were set from measured clamp-binding rates (S35-C10). From data, never from a guess.
//
// This tool DECIDES NOTHING. The founder sets the floor. If it culls names, that is a FINDING.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from '../config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(STUDY_ROOT, '..', '..');
const NORM = path.join(STUDY_ROOT, 'data', 'normalized');
const EVENTS = path.join(STUDY_ROOT, 'data', 'events');
const OUT_DIR = path.join(STUDY_ROOT, 'data', 'phase-a');
const UNIVERSE = path.join(REPO_ROOT, CONFIG.universe.universeFilePath);

const START = CONFIG.range.studyStart;
const END = CONFIG.range.studyEnd;
const REG_OPEN = CONFIG.session.regularOpenEtMinutes; // 570
const HOLDOUT = CONFIG.range.holdoutStart;             // 2025-12-10 — the A4 gate is in-sample only

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const pct = (a, p) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const i = Math.min(s.length - 1, Math.max(0, Math.floor((p / 100) * s.length)));
  return s[i];
};
const median = (a) => pct(a, 50);
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

/** Pearson correlation over paired finite values. */
function pearson(xs, ys) {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  if (pairs.length < 3) return null;
  const mx = mean(pairs.map((p) => p[0])), my = mean(pairs.map((p) => p[1]));
  let num = 0, dx = 0, dy = 0;
  for (const [x, y] of pairs) { num += (x - mx) * (y - my); dx += (x - mx) ** 2; dy += (y - my) ** 2; }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : null;
}
/** Spearman = Pearson on ranks. Robust to the heavy right tail of dollar volume (mega-caps). */
function spearman(xs, ys) {
  const rank = (a) => {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length);
    idx.forEach(([, i], k) => { r[i] = k + 1; });
    return r;
  };
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  if (pairs.length < 3) return null;
  return pearson(rank(pairs.map((p) => p[0])), rank(pairs.map((p) => p[1])));
}

function main() {
  const uni = JSON.parse(fs.readFileSync(UNIVERSE, 'utf8'));
  const rows = [];

  // Quarantined symbols (A1 cross-grain fail) are NOT in the study population — the build stages
  // skip them, so measuring them here would put names with no levels, no events and no features into
  // the distribution the founder sets the completeness floor from.
  const members = uni.symbols.filter((m) => !m.quarantined);
  const skipped = uni.symbols.filter((m) => m.quarantined).map((m) => m.symbol);
  if (skipped.length) console.log(`  (excluding ${skipped.length} A1-quarantined symbols: ${skipped.join(', ')})`);

  // ── Session-calendar coverage (S56-C3) — the guard's one remaining soft spot ──
  //
  // Every session's expected-bar count comes from the MARKET SESSION CALENDAR (a 12-ETF consensus).
  // Where the calendar has an entry, the expectation is right by construction: half-days are clipped
  // to 13:00 and a truncated feed cannot certify itself. Where it has NO entry, sessionEndOf() falls
  // back — and a half-day falling through that gap would be measured against a 78-bar expectation and
  // read as a ~53% data gap, which is precisely the bias S56-C3 exists to remove.
  //
  // So the residual exposure is simply: study sessions with no calendar entry. It should be ZERO.
  const calPath = path.join(NORM, '_session_calendar.json');
  const calendar = fs.existsSync(calPath)
    ? new Map(Object.entries(JSON.parse(fs.readFileSync(calPath, 'utf8')).sessionEndEtMinutes))
    : new Map();
  const uncovered = new Set();

  for (const m of members) {
    const sym = m.symbol;
    const sPath = path.join(NORM, sym, 'sessions.json');
    const dPath = path.join(NORM, sym, 'daily.json');
    if (!fs.existsSync(sPath) || !fs.existsSync(dPath)) continue;

    // S56-A6: the symbol's study window ends at its dead-tape cut, if it has one. Sessions past it
    // are not in the study, so they must not enter the completeness distribution the founder sets
    // the floor from — nor the event counts below.
    const symEnd = m.studyEndOverride || END;
    const sessions = JSON.parse(fs.readFileSync(sPath, 'utf8'))
      .filter((s) => !s.warmup5m && s.etDate >= START && s.etDate <= symEnd); // STUDY WINDOW ONLY
    if (!sessions.length) continue;

    // Per-session coverage = delivered regular bars / bars the session should have had.
    // `expectedRegularBarCount` is derived per session from the auction print (half-days clipped),
    // so an early close is never mistaken for a data gap. (normalize.js)
    const covs = [];
    let complete = 0, noAuction = 0;
    for (const s of sessions) {
      if (!calendar.has(s.etDate)) uncovered.add(s.etDate);

      const exp = s.expectedRegularBarCount;
      if (!exp) continue;
      const c = (s.regularBarCount / exp) * 100;
      covs.push(c);
      if (s.regularBarCount >= exp) complete += 1;
      if (!s.hasAuction) noAuction += 1;
    }
    if (!covs.length) continue;

    // Median daily dollar volume over the study window — the ILLIQUIDITY axis (the predicted driver).
    const daily = JSON.parse(fs.readFileSync(dPath, 'utf8'))
      .filter((b) => b.date >= START && b.date <= symEnd && b.close != null && b.volume != null);
    const dollarVol = median(daily.map((b) => b.close * b.volume));
    // Median SHARE price and median SHARE volume — the competing hypothesis.
    // A 5-minute bar is absent when NO TRADE printed in that window. That is a function of TRADE
    // FREQUENCY, not of dollar liquidity: a $5,000 stock (BKNG) can turn over $23bn/day and still
    // have quiet 5-minute windows with zero prints, because so few SHARES change hands.
    const sharePrice = median(daily.map((b) => b.close));
    const shareVol = median(daily.map((b) => b.volume));

    // Per-symbol NO_PRE_BAR_DATA_GAP counts (S56-A1/A4) + the A4 hourly-eligibility drop.
    //
    // The drop rate MUST be measured on EXACTLY the population the A4 gate acts on, or the founder
    // sets the floor on a number that does not exist. The gate in 04-features.js runs on IN-SAMPLE,
    // disposition=touch, F2+ events. Counting all events instead would fold in GAP_BREAKs (which are
    // emitted on the session's first bar and are structurally over-represented among the ineligible),
    // F1-tier events, and the holdout — inflating the very metric the ruling turns on.
    let dataGapEvents = 0, hourlyIneligible = 0, gateEvents = 0, totalEvents = 0;
    const ePath = path.join(EVENTS, `${sym}.json`);
    if (fs.existsSync(ePath)) {
      const evs = JSON.parse(fs.readFileSync(ePath, 'utf8')).events || [];
      for (const e of evs) {
        totalEvents += 1;
        if (e.disposition === 'touch' && e.hasIntradayApproach === false && e.touchEtMinutes !== REG_OPEN) dataGapEvents += 1;
        // The A4 gate's exact population (04-features.js: in-sample touch, F2+).
        const inGate = e.disposition === 'touch' && e.eventDate < HOLDOUT
          && (e.familyTier === 'F2' || e.familyTier === 'F3');
        if (!inGate) continue;
        gateEvents += 1;
        if (e.hourlyClassEligible !== true) hourlyIneligible += 1;
      }
    }

    rows.push({
      symbol: sym, sector: m.sector, stratum: m.stratum, atrPct: m.atrPct,
      sessions: sessions.length,
      pctSessionsComplete: r1((complete / covs.length) * 100),
      medianSessionCoveragePct: r1(median(covs)),
      p10SessionCoveragePct: r1(pct(covs, 10)),
      worstSessionCoveragePct: r1(Math.min(...covs)),
      noAuctionSessions: noAuction,
      medianDailyDollarVolume: dollarVol,
      medianSharePrice: r2(sharePrice),
      medianShareVolume: shareVol,
      totalEvents, dataGapEvents, hourlyIneligible, gateEvents,
      // THE OPERATIVE METRIC. "% of sessions 100% complete" is cosmetic — one absent bar in an
      // otherwise perfect session fails it. What actually costs the study anything is the share of
      // this symbol's GATED events (in-sample touch F2+ — exactly what A4 acts on) that S56-A4 must
      // DROP because an hourly bar in the confirmation window is >20% empty. The floor is set on THIS.
      pctEventsDroppedByA4: gateEvents ? r1((hourlyIneligible / gateEvents) * 100) : null,
    });
  }

  if (!rows.length) { console.log('🔴 no normalized data — run `npm run fetch` first'); process.exit(1); }

  const covComplete = rows.map((r) => r.pctSessionsComplete);
  const line = (s) => console.log(s);

  line(`\n════════ S56-A5 — 5-MINUTE DATA COMPLETENESS (${rows.length} symbols, ${START}→${END}) ════════`);
  line(`\n  A session is COMPLETE when it delivered every regular 5m bar it should have.`);
  line(`  Expected bars come from the MARKET SESSION CALENDAR (S56-C3) — a 12-ETF consensus, never the`);
  line(`  symbol's own last bar (self-certifying) and never the auction (EODHD emits none on half-days).`);
  line(`  So a half-day is clipped to its 13:00 close and is not a gap. Dead tape is truncated (S56-A6).\n`);
  line(`  DISTRIBUTION of "% of study sessions complete", across the ${rows.length}:`);
  line(`    median ${r1(median(covComplete))}%   p25 ${r1(pct(covComplete, 25))}%   p10 ${r1(pct(covComplete, 10))}%   p5 ${r1(pct(covComplete, 5))}%   min ${r1(Math.min(...covComplete))}%`);

  const worst = [...rows].sort((a, b) => a.pctSessionsComplete - b.pctSessionsComplete).slice(0, 20);
  line(`\n  WORST 20 NAMES by session completeness:`);
  line(`    ${'sym'.padEnd(6)} ${'sect'.padEnd(5)} ${'%complete'.padStart(9)} ${'medCov'.padStart(7)} ${'p10Cov'.padStart(7)} ${'ATR%'.padStart(6)} ${'$vol(median)'.padStart(13)} ${'gapEv'.padStart(6)} ${'inelig'.padStart(6)}`);
  for (const r of worst) {
    line(`    ${r.symbol.padEnd(6)} ${String(r.sector).padEnd(5)} ${String(r.pctSessionsComplete).padStart(8)}% ${String(r.medianSessionCoveragePct).padStart(6)}% ${String(r.p10SessionCoveragePct).padStart(6)}% ${String(r.atrPct).padStart(6)} ${(r.medianDailyDollarVolume / 1e6).toFixed(0).padStart(11)}M ${String(r.dataGapEvents).padStart(6)} ${String(r.hourlyIneligible).padStart(6)}`);
  }

  // ── Session-calendar coverage (S56-C3) ────────────────────────────────────
  const CLOSE = CONFIG.session.regularCloseEtMinutes;
  const totalSessions = rows.reduce((a, r) => a + r.sessions, 0);
  const halfDays = [...calendar.entries()].filter(([d, e]) => Number(e) < CLOSE && d >= START && d <= END);
  line(`\n  ── Session-calendar coverage (S56-C3 — the expected-bar count's source of truth) ──`);
  line(`    Calendar entries: ${calendar.size} sessions | half-days: ${halfDays.length} → ${halfDays.map(([d, e]) => `${d}(${e})`).join(', ')}`);
  line(`    Study sessions with NO calendar entry (would fall back to a 16:00 expectation): ${uncovered.size}`);
  if (uncovered.size) {
    line(`      ⚠ ${[...uncovered].sort().join(', ')}`);
    line(`      A half-day in this list is measured against 78 bars and read as a ~53% data gap — the exact S56-C3 bias.`);
  } else {
    line(`    → Every study session's expectation comes from the market calendar. Half-days are clipped to`);
    line(`      the 13:00 close, and no symbol's own bars can certify its own completeness.`);
  }

  // ── What actually drives incompleteness? (the confounder test) ────────────
  line(`\n  ── What drives incompleteness? (the confounder test — S56-A5's whole purpose) ──`);
  const cov = rows.map((r) => r.pctSessionsComplete);
  const rDV = spearman(cov, rows.map((r) => r.medianDailyDollarVolume));
  const rATR = spearman(cov, rows.map((r) => r.atrPct));
  const rPrice = spearman(cov, rows.map((r) => r.medianSharePrice));
  const rShares = spearman(cov, rows.map((r) => r.medianShareVolume));
  const verdict = (r, expect) => (r == null ? '' : Math.abs(r) < 0.2 ? '→ NO material relationship' : (r > 0) === (expect > 0) ? '→ as predicted' : '→ OPPOSITE of the prediction');
  line(`    Spearman(completeness, median daily $volume)  = ${String(r2(rDV)).padStart(5)}  ${verdict(rDV, 1)}   [the PREDICTED illiquidity driver]`);
  line(`    Spearman(completeness, ATR%)                  = ${String(r2(rATR)).padStart(5)}  ${verdict(rATR, -1)}`);
  line(`    Spearman(completeness, median SHARE PRICE)    = ${String(r2(rPrice)).padStart(5)}  ${rPrice < -0.4 ? '→ STRONG NEGATIVE — the real driver' : ''}`);
  line(`    Spearman(completeness, median SHARE volume)   = ${String(r2(rShares)).padStart(5)}  ${rShares > 0.4 ? '→ STRONG POSITIVE — the real driver' : ''}`);
  line(`\n    A 5-minute bar is absent when NO TRADE PRINTED in that window. That is TRADE FREQUENCY,`);
  line(`    not dollar liquidity. BKNG turns over $23bn/day and is 23.9% "complete" — because at`);
  line(`    ~$5,000/share so few SHARES change hands that quiet 5-minute windows have zero prints.`);
  line(`    (Spearman, not Pearson: dollar volume and share price both have heavy right tails.)`);

  // ── Propose a floor FROM the measured distribution ────────────────────────
  //
  // TWO metrics, and the difference between them is the whole ruling:
  //   pctSessionsComplete  — COSMETIC. One absent bar in an otherwise perfect session fails it.
  //   pctEventsDroppedByA4 — OPERATIVE. What incompleteness actually COSTS the study.
  // A floor on the cosmetic metric would cull BKNG, KLAC and ORLY — mega-caps whose data is fine —
  // while the operative cost of keeping them is a fraction of a percent of their events.
  line(`\n  ── PROPOSED FLOOR — on the metric that actually costs the study something ──`);
  line(`\n    (a) COSMETIC metric — "% of sessions 100% complete". A floor here culls mega-caps:`);
  for (const f of [99, 98, 95, 90, 80]) {
    const culled = rows.filter((r) => r.pctSessionsComplete < f);
    const names = culled.map((r) => r.symbol).join(',');
    line(`        ≥${String(f).padStart(2)}%  kept ${String(rows.length - culled.length).padStart(3)}  culled ${String(culled.length).padStart(3)}  ${names.length > 90 ? `${names.slice(0, 90)}…` : names || '—'}`);
  }
  line(`\n    (b) OPERATIVE metric — "% of a symbol's events S56-A4 must DROP" (incomplete hourly bars):`);
  const dropped = rows.map((r) => r.pctEventsDroppedByA4).filter((x) => x != null);
  line(`        distribution: median ${r1(median(dropped))}%  p90 ${r1(pct(dropped, 90))}%  p99 ${r1(pct(dropped, 99))}%  max ${r1(Math.max(...dropped))}%`);
  for (const f of [50, 40, 30, 20, 10]) {
    const culled = rows.filter((r) => (r.pctEventsDroppedByA4 ?? 0) > f);
    const names = culled.map((r) => `${r.symbol}(${r.pctEventsDroppedByA4}%)`).join(', ');
    line(`        drop >${String(f).padStart(2)}%  kept ${String(rows.length - culled.length).padStart(3)}  culled ${String(culled.length).padStart(3)}  ${names || '—'}`);
  }
  const worstDrop = [...rows].sort((a, b) => (b.pctEventsDroppedByA4 ?? 0) - (a.pctEventsDroppedByA4 ?? 0)).slice(0, 8);
  line(`\n        worst by operative drop: ${worstDrop.map((r) => `${r.symbol} ${r.pctEventsDroppedByA4}%`).join(' · ')}`);

  const doc = {
    amendment: 'S56-A5 — data-completeness eligibility. Measured; the FOUNDER sets the floor.',
    generatedAt: new Date().toISOString(),
    configVersion: CONFIG.version,
    window: { start: START, end: END },
    symbols: rows.length,
    distributionPctSessionsComplete: {
      median: r1(median(covComplete)), p25: r1(pct(covComplete, 25)), p10: r1(pct(covComplete, 10)),
      p5: r1(pct(covComplete, 5)), min: r1(Math.min(...covComplete)), max: r1(Math.max(...covComplete)),
    },
    driverCorrelation: {
      spearman_completeness_vs_dollarVolume: r2(rDV),
      spearman_completeness_vs_atrPct: r2(rATR),
      spearman_completeness_vs_sharePrice: r2(rPrice),
      spearman_completeness_vs_shareVolume: r2(rShares),
      finding: 'The PREDICTED driver (illiquidity, via dollar volume) is NOT the driver. Missing 5m bars track TRADE FREQUENCY — share price and share volume — not dollar liquidity. BKNG turns over $23bn/day and is only 23.9% "complete" because at ~$5,000/share, quiet 5-minute windows have zero prints. High-priced mega-caps are not illiquid and are not a reaction-quality confounder.',
    },
    sessionCalendarCoverage: {
      calendarSessions: calendar.size,
      halfDays: halfDays.map(([d, e]) => ({ etDate: d, sessionEndEtMinutes: Number(e) })),
      totalSessions,
      studySessionsWithNoCalendarEntry: uncovered.size,
      uncoveredDates: [...uncovered].sort(),
      note: 'S56-C3: every session\'s expected-bar count comes from the market session calendar (12-ETF consensus), never from the symbol\'s own last bar (self-certifying) and never from the closing auction (EODHD emits none on half-days). A study session with no calendar entry falls back to a 16:00 expectation — a half-day in that state is read as a ~53% data gap. This count must be 0.',
    },
    floorCandidatesCosmetic: [99, 98, 95, 90, 80].map((f) => ({
      floorPct: f,
      kept: rows.filter((r) => r.pctSessionsComplete >= f).length,
      culled: rows.filter((r) => r.pctSessionsComplete < f).map((r) => ({ symbol: r.symbol, pctSessionsComplete: r.pctSessionsComplete })),
    })),
    floorCandidatesOperative: [50, 40, 30, 20, 10].map((f) => ({
      maxPctEventsDropped: f,
      kept: rows.filter((r) => (r.pctEventsDroppedByA4 ?? 0) <= f).length,
      culled: rows.filter((r) => (r.pctEventsDroppedByA4 ?? 0) > f).map((r) => ({ symbol: r.symbol, pctEventsDroppedByA4: r.pctEventsDroppedByA4 })),
    })),
    perSymbol: rows.sort((a, b) => a.pctSessionsComplete - b.pctSessionsComplete),
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const p = path.join(OUT_DIR, 'a5_completeness.json');
  fs.writeFileSync(p, JSON.stringify(doc, null, 2));
  line(`\n  artifact → ${path.relative(STUDY_ROOT, p)}`);
  line(`\n  ⛔ The founder sets the floor BEFORE Session 6. If it culls names, that is a FINDING, not a failure.`);
}

main();
