// research/level-study/05-confirm-and-label.js
//
// LevelStory Session 6 — the CONFIRM-AND-LABEL runner (parent §7 hourly classes, §3 timestamps,
// §9 dual-origin outcome grid). Reads the event sets (data/events), the raw-5m cache (via the same
// re-normalization 03/04 use), and the level registry, then for every TOUCH event computes:
//   - the hourly confirmation class + its P/C/W inputs + the hourly RVOL overlay,
//   - confirmationAt / entryAt / overnightEntry,
//   - the outcome grid from BOTH origins (touchAt and entryAt) + the bridge columns,
// and writes data/labels/{symbol}.json (gitignored). It then populates
// `peer_confirmations_same_session_before_touch` across each sector (a peer counts only if its own
// confirmationAt precedes this event's touchAt — the S5 stub, resolved now that confirmationAt
// exists). Finally it prints DISTRIBUTIONS and DATA-QUALITY only (S6 §8): hourly-class shares, the
// A4 null rate, the fractionElapsedAtEntry distribution per class, the overnightEntry rate, and the
// ambiguity rate per target/stop pair (>10% on a primary pair ⇒ RESOLUTION_LIMITED).
//
//   npm run label                  # frozen universe
//   node 05-confirm-and-label.js AAPL   # explicit list
//
// ⛔ THE FREEZE. Computing outcomes on the real event set is the irreversible act that locks the
// pre-registration (P1–P6, the amendments, the floors). That is a DELIBERATE FOUNDER ACT, taken
// after reviewing this labeler — never triggered inside a build session. This script does no
// aggregation and renders no P-verdict (that is Session 7): it reports distributions and data
// quality only.
//
// This runner does NOT aggregate outcomes against the pre-registered questions (S6 §8 / §9). Zero
// product imports; artifacts are gitignored.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from './config.js';
import { loadFiveMinByDate } from './03-detect-events.js';
import { labelEvent, peerConfirmationsSameSessionBeforeTouch } from './lib/labels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const EVENTS_DIR = path.join(HERE, 'data', 'events');
const LABELS_DIR = path.join(HERE, 'data', 'labels');
const UNIVERSE_PATH = path.join(REPO_ROOT, CONFIG.universe.universeFilePath);
const HOLDOUT = CONFIG.range.holdoutStart;
const AMBIG_ESCALATE_PCT = CONFIG.outcomes.ambiguity.escalationPctThreshold; // 10

// ── Loaders (tolerant read; a missing input surfaces as a stated skip, never a fabricated label) ──

function loadEvents(sym) {
  const p = path.join(EVENTS_DIR, `${sym}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')).events : null;
}

/** Ordered sessions for one symbol: ALL 5m sessions (warmup included, for RVOL baselines), ascending. */
function orderedSessionsOf(fiveMinByDate) {
  const sessions = [...fiveMinByDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([etDate, s]) => ({ etDate, regular: s.regular || [], sessionCloseAdj: s.sessionCloseAdj }));
  const dateToIdx = new Map(sessions.map((s, i) => [s.etDate, i]));
  return { sessions, dateToIdx };
}

// ── Distribution helpers (report-only; no verdicts — that is Session 7) ───────

function median(xs) {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
const round2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

/** Percentile of a sorted-agnostic array (linear interpolation). */
function pct(xs, p) {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const idx = (v.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (idx - lo);
}

/** The §8 distribution + data-quality report over the in-sample touch labels. */
export function buildLabelReport(labels) {
  const touch = labels.filter((l) => l.disposition === 'touch');
  const inSample = touch.filter((l) => l.eventDate < HOLDOUT);

  // Hourly-class distribution over ELIGIBLE events (the P1/P2/P5 population); the A4 null rate is the
  // share dropped for incomplete confirmation windows.
  const eligible = inSample.filter((l) => l.hourlyClassEligible === true);
  const ineligible = inSample.length - eligible.length;
  const classDist = {};
  for (const name of [...CONFIG.hourlyClass.evaluationOrder]) classDist[name] = 0;
  for (const l of eligible) if (l.hourly_class) classDist[l.hourly_class] += 1;

  // fractionElapsedAtEntry distribution per hourly class (the first look at anticipate-vs-chase).
  const fracByClass = {};
  for (const name of [...CONFIG.hourlyClass.evaluationOrder]) {
    const xs = eligible.filter((l) => l.hourly_class === name).map((l) => l.fractionElapsedAtEntry).filter((x) => x != null);
    fracByClass[name] = xs.length
      ? { n: xs.length, p25: round2(pct(xs, 0.25)), median: round2(median(xs)), p75: round2(pct(xs, 0.75)) }
      : { n: 0, p25: null, median: null, p75: null };
  }

  // overnightEntry rate.
  const overnight = inSample.filter((l) => l.overnightEntry === true).length;

  // Ambiguity rate per target/stop pair, from the confirmation-time grid (the origin the primary
  // questions use). >AMBIG_ESCALATE_PCT on a pair ⇒ RESOLUTION_LIMITED (parent §9.3).
  const pairRates = {};
  const withGrid = inSample.filter((l) => l.confirmationTime && l.confirmationTime.targetBeforeStop);
  const pairKeys = withGrid.length ? Object.keys(withGrid[0].confirmationTime.targetBeforeStop) : [];
  for (const key of pairKeys) {
    const amb = withGrid.filter((l) => l.confirmationTime.targetBeforeStop[key].ambiguous).length;
    const rate = withGrid.length ? (amb / withGrid.length) * 100 : null;
    pairRates[key] = { ambiguousPct: round1(rate), resolutionLimited: rate != null && rate > AMBIG_ESCALATE_PCT };
  }

  return {
    inSampleTouch: inSample.length,
    hourlyClassEligible: eligible.length,
    hourlyClassNull: ineligible,
    hourlyClassNullPct: inSample.length ? round1((ineligible / inSample.length) * 100) : null,
    classDistribution: classDist,
    fractionElapsedByClass: fracByClass,
    overnightEntryRate: inSample.length ? round1((overnight / inSample.length) * 100) : null,
    ambiguityByPair: pairRates,
  };
}

function printReport(rep) {
  console.log('\n════════ §8 S6 LABEL DISTRIBUTIONS + DATA QUALITY (no aggregation, no verdicts — Session 7) ════════');
  console.log(`in-sample touch labels: ${rep.inSampleTouch} | hourly-class eligible: ${rep.hourlyClassEligible} | null (A4 drops): ${rep.hourlyClassNull} (${rep.hourlyClassNullPct}%)`);
  console.log('hourly-class distribution (of eligible — determines whether P1/P2/P5 cells clear the floor):');
  for (const [k, n] of Object.entries(rep.classDistribution)) {
    const share = rep.hourlyClassEligible ? round1((n / rep.hourlyClassEligible) * 100) : null;
    console.log(`  ${k.padEnd(14)} n=${String(n).padStart(5)}  ${share}%`);
  }
  console.log('fractionElapsedAtEntry per class (anticipate-vs-chase — p25 / median / p75):');
  for (const [k, d] of Object.entries(rep.fractionElapsedByClass)) {
    console.log(`  ${k.padEnd(14)} n=${String(d.n).padStart(5)}  ${d.p25} / ${d.median} / ${d.p75}`);
  }
  console.log(`overnightEntry rate: ${rep.overnightEntryRate}%`);
  console.log('ambiguity rate per target/stop pair (>' + AMBIG_ESCALATE_PCT + '% ⇒ RESOLUTION_LIMITED, parent §9.3):');
  for (const [k, d] of Object.entries(rep.ambiguityByPair)) {
    console.log(`  ${k.padEnd(12)} ${d.ambiguousPct}%${d.resolutionLimited ? '  🔴 RESOLUTION_LIMITED' : ''}`);
  }
}

// ── Writer ────────────────────────────────────────────────────────────────────

async function writeJson(p, obj) {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify(obj));
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2).filter(Boolean);
  let uni = null;
  if (fs.existsSync(UNIVERSE_PATH)) uni = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8'));
  const allMembers = uni ? uni.symbols : CONFIG.universe.probe.equities.map((s) => ({ symbol: s, sector: CONFIG.universe.sectorMap[s], stratum: null }));
  const quarantined = allMembers.filter((m) => m.quarantined).map((m) => m.symbol);
  if (quarantined.length) console.log(`🔴 QUARANTINED (A1 cross-grain fail — excluded): ${quarantined.join(', ')}`);
  const members = allMembers.filter((m) => !m.quarantined);
  const symbols = argv.length ? argv : members.map((m) => m.symbol);
  const sectorOf = new Map(members.filter((m) => m.sector).map((m) => [m.symbol, m.sector]));

  console.log(`LevelStory confirm-and-label v${CONFIG.version} — dual-origin outcomes (touchAt + entryAt), ${CONFIG.hourlyClass.evaluationOrder.length} hourly classes + null`);
  console.log('⛔ Building/labeling only. This runner computes NO aggregation and renders NO P-verdict (Session 7).');

  // ── STALE-ARTIFACT PRECHECK (mirrors 04-features §5) ──
  // labelEvent throws on a pre-S56-A4 event (no hourlyClassEligible). Surfaced up front, ABORT — a
  // stale events artifact means a skipped pipeline stage, and the only correct response is to stop.
  for (const sym of symbols) {
    const evs = loadEvents(sym);
    if (!evs) continue;
    const bad = evs.find((ev) => typeof ev.hourlyClassEligible !== 'boolean' || typeof ev.atrDaily !== 'number');
    if (bad) {
      console.log(`\n🔴 STALE EVENT ARTIFACT — ${sym}: event ${bad.eventId} lacks hourlyClassEligible/atrDaily (predates S56-A4).`);
      console.log('   Re-run the pipeline before labeling:  npm run levels && npm run events');
      console.log('   Aborting so a stale run cannot silently mislabel.');
      process.exit(1);
    }
  }

  const t0 = Date.now();
  const failures = [];
  const bySymbolLabels = new Map(); // symbol -> [labels]
  const allLabels = [];

  for (const sym of symbols) {
    const events = loadEvents(sym);
    if (!events) { failures.push({ symbol: sym, error: 'missing events — run `npm run events`' }); console.log(`🔴 ${sym}: missing events — skipped`); continue; }
    try {
      const t = Date.now();
      const { fiveMinByDate } = loadFiveMinByDate(sym);
      const { sessions, dateToIdx } = orderedSessionsOf(fiveMinByDate);
      const labels = [];
      for (const ev of events) {
        // Only TOUCH events are the analyzable study population (parent §10). GAP_BREAK /
        // RETIRED_MIDEPISODE are carried through with their disposition and no grid.
        if (ev.disposition !== 'touch') {
          labels.push({ eventId: ev.eventId, symbol: sym, sector: sectorOf.get(sym) || ev.sector || null, side: ev.side, eventDate: ev.eventDate, disposition: ev.disposition, confirmationAt: null, touchAt: ev.touchAt, hourly_class: null });
          continue;
        }
        labels.push(labelEvent({ event: { ...ev, sector: sectorOf.get(sym) || ev.sector || null }, orderedSessions: sessions, dateToIdx }));
      }
      bySymbolLabels.set(sym, labels);
      allLabels.push(...labels);
      const nClass = labels.filter((l) => l.hourly_class).length;
      console.log(`✅ ${sym.padEnd(5)} events=${events.length} labeled=${labels.length} classed=${nClass} | ${Date.now() - t}ms`);
    } catch (e) {
      failures.push({ symbol: sym, error: e.message });
      console.log(`🔴 ${sym}: FAILED — ${e.message}`);
    }
  }

  // ── Populate peer_confirmations_same_session_before_touch across each sector (S6 §4) ──
  // A peer counts only if its own confirmationAt < this event's touchAt (a pre_touch fact). Grouped
  // by sector; self excluded. This resolves the S5 stub (features-market.js:156) now that
  // confirmationAt exists.
  const bySector = new Map();
  for (const l of allLabels) {
    if (l.disposition !== 'touch') continue;
    const sec = l.sector || '__none__';
    if (!bySector.has(sec)) bySector.set(sec, []);
    bySector.get(sec).push(l);
  }
  for (const l of allLabels) {
    if (l.disposition !== 'touch') continue;
    const peers = (bySector.get(l.sector || '__none__') || []).filter((p) => p.symbol !== l.symbol);
    l.peer_confirmations_same_session_before_touch = peerConfirmationsSameSessionBeforeTouch(l, peers);
  }

  // ── Write per-symbol label artifacts (gitignored) ──
  for (const [sym, labels] of bySymbolLabels) {
    await writeJson(path.join(LABELS_DIR, `${sym}.json`), { symbol: sym, configVersion: CONFIG.version, labels });
  }

  const report = buildLabelReport(allLabels);
  await writeJson(path.join(LABELS_DIR, '_stats.json'), {
    generatedAt: new Date().toISOString(), configVersion: CONFIG.version,
    totalRuntimeMs: Date.now() - t0, failures,
    totalLabels: allLabels.length, report,
  });

  if (failures.length) console.log(`\n🔴 ${failures.length} symbol(s) FAILED: ${failures.map((f) => f.symbol).join(', ')}`);
  printReport(report);
  console.log(`\nArtifacts: data/labels/{symbol}.json + data/labels/_stats.json (gitignored). ${Date.now() - t0}ms total.`);
  console.log('\n⛔ Outcomes now exist. If this was the real event set, the PRE-REGISTRATION IS FROZEN — stamp the rulings doc (S6 §8).');
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1); });
