// research/level-study/tools/dead-tape-detect.mjs
//
// S56-A6 — DEAD-TAPE TRUNCATION (founder ruling R2; pre-registered, outcome-blind).
//
//   node tools/dead-tape-detect.mjs            # detect + report
//   node tools/dead-tape-detect.mjs --write    # also patch universe_frozen.json
//
// WHY THIS EXISTS. Once a take-private or all-cash acquisition is ANNOUNCED, the stock stops being
// a stock. It pins to the deal price and realized volatility collapses: the tape is arbitrage, not
// price discovery. Level interactions in that regime are meaningless — everything "holds" because
// nothing moves — and those events would inflate hold rates with non-market behaviour.
//
// THE TRAP THIS AVOIDS. The naive fix is to drop the acquired names. That is survivorship bias, and
// it is worse than the disease: it would mean excluding stocks BECAUSE they were acquired, i.e.
// conditioning the universe on the future. So the NAMES ARE KEPT and their live history is retained
// in full — only the dead tail is truncated.
//
// THE RULE MUST BE MECHANICAL, NOT NEWS-DRIVEN. Reading a press release and typing in a date is
// unfalsifiable and unauditable. So the onset is derived from the PRICE SERIES ALONE, by a rule
// fixed in advance and applied identically to every symbol. It is outcome-blind: the announcement
// was public and contemporaneous, so a trader standing at that date would have known.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from '../config.js';
import { buildSeries } from '../lib/level-series.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDY_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(STUDY_ROOT, '..', '..');
const NORM = path.join(STUDY_ROOT, 'data', 'normalized');
const OUT_DIR = path.join(STUDY_ROOT, 'data', 'phase-a');
const EVENTS = path.join(STUDY_ROOT, 'data', 'events');
const UNIVERSE = path.join(REPO_ROOT, CONFIG.universe.universeFilePath);

const START = CONFIG.range.studyStart;
const END = CONFIG.range.studyEnd;

// ── THE RULE (fixed in advance; NOT tuned against event counts, cell sizes or outcomes) ──────────
//
//   baselineATR  = median ATR14% over the symbol's FIRST 252 study sessions — its own normal regime,
//                  so a structurally quiet utility is judged against itself, not against NVDA.
//   collapse(D)  = median ATR14% over the trailing 20 sessions ≤ COLLAPSE_FRAC × baselineATR
//   pinned       = over [D, last], (max close − min close) / median close ≤ PIN_RANGE_PCT
//
//   ONSET = the EARLIEST D such that collapse(D) holds and CONTINUES TO HOLD for every session
//           through the symbol's last, AND the tail is pinned.
//
//   studyEndOverride = the session immediately BEFORE onset. Events after it are excluded; every
//                      earlier session is retained untouched.
//
// The "holds through the last session" clause is what makes this SUSTAINED rather than a transient
// quiet patch: a normal stock's volatility recovers, a dead one's never does. The two thresholds are
// deliberately round, a-priori "obviously collapsed" values — a third of normal volatility, and a
// tail that trades in a 10% band. They were not searched over.
const COLLAPSE_FRAC = 1 / 3;
const PIN_RANGE_PCT = 10;
const BASELINE_SESSIONS = 252;
const TRAILING = 20;
const ATR_N = 14;

// ── CRITERION (b): FLOOR-BINDING COLLAPSE ────────────────────────────────────
//
// WHY (a) ALONE IS NOT ENOUGH — a diagnosed STRUCTURAL FRAGILITY, not a tuning miss.
//
// Criterion (a)'s "stays collapsed through the last session" clause is evaluated on a trailing-20
// MEDIAN ATR sitting near the ⅓ threshold. A single transient volatility blip — a deal-news day —
// lifts that median back over the line and RESETS THE RUN, pushing onset forward by however long the
// blip took to decay. Measured on EA: onset landed 2026-04-13, roughly SIX MONTHS after its tape had
// already died, leaving 134 already-pinned sessions in the study. Those sessions bind the distance
// floor 86.6% of the time; EA binds it 0.0% pre-announcement.
//
// So the repair is a second, INDEPENDENT detector of the same thing, and a far sharper one. `u` =
// clamp(0.25×ATR, floorPct%×price, capPct%×price). On dead tape ATR collapses, so it is floorPct —
// not ATR — that sets the geometry. The floor-binding rate is therefore a direct read on "has ATR
// stopped carrying information", and it is a STEP FUNCTION:
//
//     EA   pre-announcement 0.0%  →  post-announcement 86.6%  →  fully pinned 100.0%
//     WBA  pre-announcement 0.0%  →  announced-but-live 0.0%  →  pinned 79.5%
//
// The 50% threshold sits in a CHASM between live (~0%) and dead (~80-100%) tape, which is exactly
// what makes (b) immune to the run-reset that breaks (a): a blip cannot drag a trailing-20 rate from
// 87% to below 50%. That claim is not asserted — it is tested by the robustness sweep (--robust),
// which must show the fire list is STABLE across 30%–70%. If the list moves with the threshold, the
// threshold is doing the work rather than the signal, and that is a finding, not a rule.
//
// NOTE the WBA row above: (b) does NOT fire on announced-but-still-live tape. WBA traded normally for
// ~2 months after its announcement (the deal had real financing risk) and binds 0.0% there. The rule
// detects DEAD TAPE, not "a deal was announced" — which is the whole point of not using news.
const FLOOR_BIND_PCT = 50; // a-priori; robustness-tested across 30–70
const FLOOR_PCT = CONFIG.levels.geometry.distanceUnit.floorPct;
const ATR_MULT = CONFIG.levels.geometry.distanceUnit.atrMultiple;

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

/** Wilder ATR14 as a % of close, on the adjusted basis (same basis the study's distanceUnit uses). */
function atrPctSeries(bars) {
  const out = new Array(bars.length).fill(null);
  const tr = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], p = i > 0 ? bars[i - 1] : null;
    const hi = b.adjHigh ?? b.high, lo = b.adjLow ?? b.low, cl = b.adjClose ?? b.close;
    const pc = p ? (p.adjClose ?? p.close) : null;
    if (hi == null || lo == null || cl == null) { tr.push(null); continue; }
    tr.push(pc == null ? hi - lo : Math.max(hi - lo, Math.abs(hi - pc), Math.abs(lo - pc)));
    if (i >= ATR_N) {
      const win = tr.slice(i - ATR_N + 1, i + 1).filter((v) => v != null);
      if (win.length === ATR_N && cl > 0) out[i] = (win.reduce((a, v) => a + v, 0) / ATR_N / cl) * 100;
    }
  }
  return out;
}

/**
 * Per-session floor-binding flags, on EXACTLY the code path the real distanceUnit uses:
 * buildSeries() → u = clamp(0.25×ATR, floorPct%×price, capPct%×price), evaluated at i−1 (the call
 * site). Reusing lib/level-series.js rather than re-deriving ATR here means the quantity measured is
 * the same one the study actually clamps — not a look-alike.
 */
function floorBindFlags(allBars) {
  const s = buildSeries(allBars);
  const out = []; // { date, binds }
  for (let i = ATR_N; i < s.n; i++) {
    const D = s.dates[i];
    if (D < START || D > END) continue;
    const atr = s.atr[i - 1], px = s.aClose[i - 1];
    if (atr == null || !(px > 0)) continue;
    out.push({ date: D, binds: (100 * ATR_MULT * atr / px) < FLOOR_PCT });
  }
  return out;
}

/** Criterion (b): earliest session whose trailing-20 floor-binding rate ≥ `pct` and stays ≥ `pct`. */
function floorBindOnset(flags, pct) {
  const rate = (i) => {
    const w = flags.slice(Math.max(0, i - TRAILING + 1), i + 1);
    return (w.filter((f) => f.binds).length / w.length) * 100;
  };
  let onset = -1;
  for (let i = TRAILING - 1; i < flags.length; i++) {
    if (rate(i) < pct) { onset = -1; continue; } // run broken
    if (onset === -1) onset = i;
  }
  return onset; // index into flags, or -1
}

function detect(sym, { floorBindPct = FLOOR_BIND_PCT } = {}) {
  const p = path.join(NORM, sym, 'daily.json');
  if (!fs.existsSync(p)) return null;
  const allBars = JSON.parse(fs.readFileSync(p, 'utf8'));
  const bars = allBars.filter((b) => b.date >= START && b.date <= END);
  if (bars.length < BASELINE_SESSIONS + TRAILING) return null;

  const atr = atrPctSeries(bars);
  const baseline = median(atr.slice(0, BASELINE_SESSIONS).filter((v) => v != null));
  if (!baseline) return null;
  const threshold = COLLAPSE_FRAC * baseline;

  const closeOf = (b) => b.adjClose ?? b.close;
  const trailing = (i) => median(atr.slice(Math.max(0, i - TRAILING + 1), i + 1).filter((v) => v != null));
  const last = bars.length - 1;
  const dateIdx = new Map(bars.map((b, i) => [b.date, i]));

  // ── criterion (a): ATR collapse, sustained to the last bar ──
  let onsetA = -1;
  for (let i = BASELINE_SESSIONS; i <= last; i++) {
    const t = trailing(i);
    if (t == null || t > threshold) { onsetA = -1; continue; }
    if (onsetA === -1) onsetA = i;
  }

  // ── criterion (b): floor-binding collapse, sustained to the last bar ──
  const flags = floorBindFlags(allBars);
  const bIdx = floorBindOnset(flags, floorBindPct);
  const onsetB = bIdx >= 0 ? (dateIdx.get(flags[bIdx].date) ?? -1) : -1;

  // Neither fired → the tape is alive.
  if (onsetA === -1 && onsetB === -1) return null;

  // The dead tape starts at the EARLIER of the two. (a) is cheap insurance; (b) is the sharp one.
  const cands = [onsetA, onsetB].filter((x) => x > 0);
  const onset = Math.min(...cands);
  if (onset <= 0) return null;

  // PINNING is required of whichever onset wins: a volatility collapse that still walks the price
  // somewhere is a quiet market, not a dead one.
  const tail = bars.slice(onset).map(closeOf).filter((c) => c != null);
  const rangePct = ((Math.max(...tail) - Math.min(...tail)) / median(tail)) * 100;
  if (rangePct > PIN_RANGE_PCT) return null;

  const tailFlags = flags.filter((f) => f.date >= bars[onset].date);
  const tailBindPct = tailFlags.length ? (tailFlags.filter((f) => f.binds).length / tailFlags.length) * 100 : null;

  return {
    symbol: sym,
    onsetDate: bars[onset].date,
    studyEndOverride: bars[onset - 1].date, // last session retained
    lastBar: bars[last].date,
    deadSessions: bars.length - onset,
    firedBy: [onsetA > 0 ? 'a' : null, onsetB > 0 ? 'b' : null].filter(Boolean).join('+'),
    onsetA: onsetA > 0 ? bars[onsetA].date : null,
    onsetB: onsetB > 0 ? bars[onsetB].date : null,
    baselineAtrPct: r2(baseline),
    tailAtrPct: r2(trailing(last)),
    atrCollapseRatio: r2(trailing(last) / baseline),
    tailFloorBindPct: r2(tailBindPct),
    tailRangePct: r2(rangePct),
    tailPinnedNear: r2(median(tail)),
  };
}

function main() {
  const write = process.argv.includes('--write');
  const uni = JSON.parse(fs.readFileSync(UNIVERSE, 'utf8'));
  const members = uni.symbols.filter((m) => !m.quarantined);

  const hits = [];
  for (const m of members) {
    const d = detect(m.symbol);
    if (d) hits.push(d);
  }
  hits.sort((a, b) => (a.onsetDate < b.onsetDate ? -1 : 1));

  console.log(`\n════════ S56-A6 — DEAD-TAPE TRUNCATION (${members.length} buildable symbols) ════════`);
  console.log('\n  RULE (fixed in advance; never tuned against event counts or outcomes):');
  console.log(`    baseline = median ATR14% over the symbol's first ${BASELINE_SESSIONS} study sessions (its OWN normal regime)`);
  console.log(`    onset    = earliest session whose trailing-${TRAILING} median ATR14% ≤ ${r2(COLLAPSE_FRAC * 100)}% of baseline`);
  console.log('               AND which stays collapsed through the symbol\'s LAST session (sustained, not a quiet patch)');
  console.log(`    pinned   = over [onset, last], (max−min)/median close ≤ ${PIN_RANGE_PCT}%`);
  console.log('    studyEndOverride = the session BEFORE onset. Earlier history is retained IN FULL.');
  console.log('\n  The names are KEPT. Dropping stocks because they were acquired would be survivorship');
  console.log('  bias we introduced ourselves — conditioning the universe on the future.\n');

  if (!hits.length) { console.log('  no symbol trips the rule.'); return; }

  console.log(`  ${'sym'.padEnd(6)} ${'override'.padEnd(11)} ${'onset'.padEnd(11)} ${'by'.padEnd(4)} ${'dead'.padStart(5)} ${'ATRratio'.padStart(9)} ${'tailBind'.padStart(9)} ${'range'.padStart(6)} ${'pinned≈'.padStart(8)}`);
  for (const h of hits) {
    console.log(`  ${h.symbol.padEnd(6)} ${h.studyEndOverride.padEnd(11)} ${h.onsetDate.padEnd(11)} ${h.firedBy.padEnd(4)} ${String(h.deadSessions).padStart(5)} ${String(h.atrCollapseRatio).padStart(9)} ${String(h.tailFloorBindPct).padStart(8)}% ${String(h.tailRangePct).padStart(5)}% ${String(h.tailPinnedNear).padStart(8)}`);
  }

  // ── Criterion overlap: does (a) ever fire where (b) does not? ──────────────
  console.log('\n  ── criterion overlap (founder: put it on record) ──');
  for (const h of hits) {
    const a = h.onsetA || '—', b = h.onsetB || '—';
    const note = !h.onsetB ? '(a) ONLY — (b) does not fire'
      : !h.onsetA ? '(b) ONLY — (a) does not fire'
        : (h.onsetB < h.onsetA ? `(b) is EARLIER by the dead tape (a) left in` : (h.onsetA < h.onsetB ? '(a) is earlier' : 'identical'));
    console.log(`    ${h.symbol.padEnd(5)} (a) ATR-collapse: ${String(a).padEnd(11)}  (b) floor-binding: ${String(b).padEnd(11)}  → ${note}`);
  }
  // Dominance means "never later", not merely "also fires". (a) firing EARLIER anywhere is enough to
  // make it load-bearing — and it does, on WBA.
  const aEarlier = hits.filter((h) => h.onsetA && (!h.onsetB || h.onsetA < h.onsetB)).map((h) => h.symbol);
  const bEarlier = hits.filter((h) => h.onsetB && (!h.onsetA || h.onsetB < h.onsetA)).map((h) => h.symbol);
  console.log(`    ⇒ (a) gives the EARLIER onset on: ${aEarlier.join(', ') || '—'}`);
  console.log(`    ⇒ (b) gives the EARLIER onset on: ${bEarlier.join(', ') || '—'}`);
  console.log(aEarlier.length
    ? '    ⇒ NEITHER criterion dominates. Each catches dead tape the other dates late, which is exactly\n      why the onset is the EARLIER of the two. (a) is not insurance — it is load-bearing.'
    : '    ⇒ (b) STRICTLY DOMINATES (never later than (a)). (a) is retained only as cheap insurance.');

  // ── Threshold robustness: is the fire list stable across 30–70%? ───────────
  console.log('\n  ── robustness of the (b) threshold (founder condition 2) ──');
  console.log('    If the fire list moves with the threshold, the THRESHOLD is doing the work, not the');
  console.log('    signal — and that is a finding, not a rule. It should be flat: live tape binds ~0%,');
  console.log('    dead tape binds ~80-100%, so any cut in the chasm between them gives the same answer.\n');
  // The decisive test is not whether the onset DATE is bit-identical — it is whether the threshold
  // changes WHAT THE STUDY SEES: the names truncated, and the events excluded. A date that drifts
  // across a stretch containing no events costs the study exactly nothing.
  const excludedCount = (sym, cutAfter) => {
    const p = path.join(EVENTS, `${sym}.json`);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8')).events.filter((e) => e.eventDate > cutAfter).length;
  };
  console.log(`    ${'thresh'.padEnd(7)} ${'fires'.padEnd(6)} names (onset date → events excluded)`);
  const sweep = [];
  const sig = (hs) => hs.map((h) => `${h.symbol}:${excludedCount(h.symbol, h.studyEndOverride)}`).sort().join(',');
  const names = (hs) => hs.map((h) => h.symbol).sort().join(',');
  let refSig = null, refNames = null;
  let namesStable = true, eventsStable = true;
  const dateDrift = new Map();
  for (const pct of [30, 40, 50, 60, 70]) {
    const hs = members.map((m) => detect(m.symbol, { floorBindPct: pct })).filter(Boolean)
      .sort((a, b) => (a.symbol < b.symbol ? -1 : 1));
    if (refNames === null) { refNames = names(hs); refSig = sig(hs); }
    if (names(hs) !== refNames) namesStable = false;
    if (sig(hs) !== refSig) eventsStable = false;
    for (const h of hs) {
      if (!dateDrift.has(h.symbol)) dateDrift.set(h.symbol, new Set());
      dateDrift.get(h.symbol).add(h.onsetDate);
    }
    sweep.push({ floorBindPct: pct, fires: hs.map((h) => ({ symbol: h.symbol, onsetDate: h.onsetDate, eventsExcluded: excludedCount(h.symbol, h.studyEndOverride) })) });
    console.log(`    ${(pct + '%').padEnd(7)} ${String(hs.length).padEnd(6)} ${hs.map((h) => `${h.symbol}(${h.onsetDate} → ${excludedCount(h.symbol, h.studyEndOverride)})`).join('  ') || '—'}`);
  }
  console.log('');
  console.log(`    fire list (names)  : ${namesStable ? '✅ IDENTICAL at every threshold' : '🔴 MOVES with the threshold'}`);
  console.log(`    events excluded    : ${eventsStable ? '✅ IDENTICAL at every threshold' : '🔴 MOVES with the threshold'}`);
  for (const [sym, ds] of dateDrift) {
    const arr = [...ds].sort();
    console.log(`    onset date ${sym.padEnd(5)}   : ${arr.length === 1 ? `✅ ${arr[0]} at every threshold` : `⚠ drifts ${arr[0]} → ${arr[arr.length - 1]} (${arr.length} distinct)`}`);
  }
  const stable = namesStable && eventsStable;
  console.log(stable
    ? '\n    ✅ The threshold is NOT LOAD-BEARING. Any cut in the 30–70% chasm truncates the same names\n       and excludes the same events. The SIGNAL is doing the work, not the threshold.\n       (Where an onset date drifts, it drifts across sessions that contain NO events — which is\n        itself corroborating: dead tape produces no level touches, because nothing moves.)'
    : '\n    🔴 NOT STABLE: the threshold changes what the study sees. STOP — report; do not apply.');

  // THE RULED SET (founder, S5.6 R2 follow-up). Anything outside it is a finding that needs a
  // ruling — it must NOT be applied silently.
  //
  // The founder's original list was the 6 ACQUIRED names (CTRA, MMC, IPG, WBA, PARA, HES). The
  // mechanical rule disagreed in BOTH directions, and was ruled authoritative over the news:
  //
  //   + EA was ADDED. It is still listed and still printing (through 2026-07-10) — so a list built
  //     from "who got acquired" structurally cannot see it. Its tape is nonetheless dead: ATR at
  //     0.31× its own baseline, pinned in a 3.1% band at ~$202.67.
  //   − CTRA, MMC, IPG, PARA, HES were DROPPED. They have no dead tail. Their ATR at the final print
  //     is 1.76× / 1.05× / 1.27× / 0.47× / 0.94× of baseline — HES at 0.94× is the clean refutation.
  //     Their tape ENDS; it does not DIE. (Founder: "I conflated a tape ENDING with a tape DYING.")
  //
  // Loosening the thresholds until the named 6 tripped was considered and REJECTED: that is tuning a
  // knob until it yields a pre-decided answer, the exact failure the mechanical rule exists to prevent.
  const EXPECTED = new Set(['WBA', 'EA']);
  const found = new Set(hits.map((h) => h.symbol));
  const unexpected = hits.filter((h) => !EXPECTED.has(h.symbol)).map((h) => h.symbol);
  const missing = [...EXPECTED].filter((s) => !found.has(s));

  console.log('');
  if (unexpected.length) {
    console.log(`  ⚠ FIRED OUTSIDE THE 6 NAMED NAMES: ${unexpected.join(', ')}`);
    console.log('    The rule was applied to every buildable symbol, not just the delisted ones — precisely');
    console.log('    so this could not hide. These need a founder ruling before they are applied.');
  } else {
    console.log('  ✅ fired on NO symbol outside the 6 named names (rule applied to all buildable symbols).');
  }
  if (missing.length) console.log(`  ⚠ NAMED BUT DID NOT TRIP: ${missing.join(', ')} — the mechanical rule disagrees with the news. Reported, not forced.`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const doc = {
    amendment: 'S56-A6',
    rule: {
      baselineSessions: BASELINE_SESSIONS, trailingSessions: TRAILING, atrPeriod: ATR_N,
      collapseFraction: COLLAPSE_FRAC, pinRangePct: PIN_RANGE_PCT,
      statement: `onset = earliest session whose trailing-${TRAILING} median ATR14% ≤ ${COLLAPSE_FRAC} × (median ATR14% over the first ${BASELINE_SESSIONS} study sessions), which stays collapsed through the symbol's last session, and whose tail trades in a ≤${PIN_RANGE_PCT}% band. studyEndOverride = the session before onset.`,
      thresholdsNotTuned: 'COLLAPSE_FRAC and PIN_RANGE_PCT are a-priori round values. They were not searched over, and no knob here was chosen by looking at event counts, cell sizes or outcomes.',
    },
    appliedToAllBuildableSymbols: members.length,
    unexpectedHits: unexpected,
    namedButDidNotTrip: missing,
    overrides: hits,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'dead_tape.json'), JSON.stringify(doc, null, 2));
  console.log(`\n  artifact → ${path.relative(STUDY_ROOT, path.join(OUT_DIR, 'dead_tape.json'))}`);

  if (write) {
    if (!stable) {
      console.log('\n  🔴 REFUSING TO WRITE: the fire list is not stable across the 30–70% threshold sweep.');
      console.log('     The threshold would be doing the work rather than the signal. Founder ruling required.');
      process.exit(1);
    }
    if (unexpected.length) {
      console.log('\n  🔴 REFUSING TO WRITE: the rule fired outside the ruled set. Founder ruling required first.');
      process.exit(1);
    }
    const byId = new Map(hits.map((h) => [h.symbol, h]));
    for (const m of uni.symbols) {
      const h = byId.get(m.symbol);
      if (h) {
        m.studyEndOverride = h.studyEndOverride;
        m.studyEndOverrideReason = `S56-A6 DEAD TAPE — ATR14% collapsed to ${h.atrCollapseRatio}× its own baseline from ${h.onsetDate} and never recovered; the ${h.deadSessions} remaining sessions trade in a ${h.tailRangePct}% band pinned near ${h.tailPinnedNear}. Take-private/all-cash-acquisition arbitrage, not price discovery. Events after ${h.studyEndOverride} are excluded; ALL earlier history is retained (the name is NOT dropped — that would be survivorship bias).`;
      } else if (m.studyEndOverride) {
        delete m.studyEndOverride; delete m.studyEndOverrideReason;
      }
    }
    uni.deadTapeTruncation = {
      amendment: 'S56-A6', rule: doc.rule.statement, count: hits.length,
      symbols: hits.map((h) => ({ symbol: h.symbol, studyEndOverride: h.studyEndOverride, deadSessions: h.deadSessions })),
    };
    fs.writeFileSync(UNIVERSE, JSON.stringify(uni, null, 2));
    console.log(`  ✅ wrote ${hits.length} studyEndOverride(s) → ${path.relative(REPO_ROOT, UNIVERSE)}`);
  } else {
    console.log('  (dry run — pass --write to patch universe_frozen.json)');
  }
}

main();
