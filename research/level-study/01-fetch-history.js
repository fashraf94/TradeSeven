// research/level-study/01-fetch-history.js
//
// LevelStory Session 2 fetch/normalize orchestrator. First BUILD script.
//
//   node 01-fetch-history.js                 # fetch the frozen universe (11 equities + context; SPHB/SPLV daily-only, F4)
//   node 01-fetch-history.js AAPL NVDA       # fetch an explicit symbol list
//
// Fetches (all disk-cached; never refetched):
//   - daily EOD from 2018-01-01 (warmup + study window, one whole call/symbol)
//   - 5-min for the study window (2023-07-10 → 2026-07-10), chunked ≤ 600 cal days
//   - the January/EST DST proof fixture (AAPL 5m Jan 2026) → fixtures/sample-5m/
//   - earnings (bulk) for the probe equities (A6 endpoint; no earnings features built here)
//
// Normalizes each symbol (auction tag A2, split factors A1, warmup A6, 9:30 hourly §4.4)
// and writes daily.json + sessions.json under data/normalized/{symbol}/ (gitignored).
// Raw 5m is fully cached under data/raw/; per-bar normalized 5m is reproducible on demand
// from that cache via lib/normalize.js and is intentionally not re-materialized here.
//
// Writes a per-run manifest to data/ and prints a summary (warmup start, DST regimes,
// cross-grain sample, depth sweep). Zero product imports.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import CONFIG from './config.js';
import { createClient } from './lib/eodhd-client.js';
import { normalizeDaily, normalizeFiveMin, crossGrainCheck, adjustmentCheck, fiveMinWarmupStart } from './lib/normalize.js';
import { depthEligibilitySweep } from './lib/depth-eligibility.js';
import { addDays, isoBefore } from './lib/session-time.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const DATA_DIR = path.join(HERE, 'data');
const NORM_DIR = path.join(DATA_DIR, 'normalized');

const UNIVERSE_PATH = path.join(REPO_ROOT, CONFIG.universe.universeFilePath); // single source of truth (config key)
const DAILY_ONLY = new Set(CONFIG.universe.dailyGrainOnly); // S3-R4 (F4): SPHB/SPLV — 5m never fetched or referenced

// S4 §0b (F4 fetcher-scope): default scope is the FROZEN universe (study equities + context
// symbols from universe_frozen.json), NOT the stale S2 14-symbol probe. PLTR/BE are included;
// SPHB/SPLV are fetched daily-grain only (their 5m is skipped below). An explicit CLI list overrides.
function resolveScope(cli) {
  if (cli.length) return { list: cli, equities: new Set(cli.filter((s) => !DAILY_ONLY.has(s))), universeVersion: null };
  if (fs.existsSync(UNIVERSE_PATH)) {
    const uni = JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8'));
    const equities = uni.symbols.map((s) => s.symbol); // 11 study subjects (incl. PLTR, BE)
    const ctx = uni.contextSymbols || {};
    const context = [...(ctx.market || []), ...(ctx.sectorETFs || []), ...(ctx.appetite || [])];
    return { list: [...equities, ...context], equities: new Set(equities), universeVersion: uni.universeVersion };
  }
  // Degraded-checkout fallback (the frozen file is committed, so practically unreachable).
  return { list: [...CONFIG.universe.probe.equities, ...CONFIG.universe.probe.context], equities: new Set(CONFIG.universe.probe.equities), universeVersion: null };
}

function tsStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function writeJson(p, obj) {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify(obj));
}

async function main() {
  const cli = process.argv.slice(2).filter(Boolean);
  const scope = resolveScope(cli);
  const list = scope.list;
  const client = createClient();
  const startedAt = new Date().toISOString();

  console.log(`LevelStory S2 fetch — ${list.length} symbol(s)${scope.universeVersion ? ` (frozen universe v${scope.universeVersion})` : ''}: ${list.join(', ')}`);
  console.log(`daily ${CONFIG.fetch.dailyFetchStart}→${CONFIG.range.studyEnd} | 5m ${CONFIG.fetch.intradayFetchStart}→${CONFIG.fetch.intradayFetchEnd}\n`);

  // ── January/EST DST proof fixture (AAPL 5m, Jan 2026) ──────────────────────
  const janFixture = path.join(REPO_ROOT, 'fixtures', 'sample-5m', 'AAPL_5m_2026-01.json');
  console.log('DST fixture: AAPL 5m Jan 2026 (EST) →', path.relative(REPO_ROOT, janFixture));
  await client.fetchIntradayToFixture('AAPL', '2026-01-01', '2026-02-01', janFixture);

  const perSymbol = {};
  const symbolDaily = []; // for depth sweep
  const failures = [];    // per-symbol hard failures — recorded, not fatal (Review F1)

  for (const sym of list) {
    try {
      process.stdout.write(`\n[${sym}] daily… `);
      const rawDaily = await client.fetchDaily(sym, CONFIG.fetch.dailyFetchStart, CONFIG.range.studyEnd);
      const { bars: dailyBars, byDate } = normalizeDaily(rawDaily);
      symbolDaily.push({ symbol: sym, dailyBars });
      await writeJson(path.join(NORM_DIR, sym, 'daily.json'), dailyBars);

      if (DAILY_ONLY.has(sym)) {
        // S3-R4 (F4): SPHB/SPLV are daily-grain only — no 5m is fetched, no sessions.json is
        // written, and they are excluded from the 5m cross-grain / auction test loops.
        perSymbol[sym] = {
          dailyBars: dailyBars.length,
          preStudySessions: dailyBars.filter((b) => isoBefore(b.date, CONFIG.universe.eligibilityAsOf)).length,
          fiveMinSessions: null, dailyGrainOnly: true,
        };
        process.stdout.write(`daily=${dailyBars.length} (daily-grain only — no 5m per F4)`);
        continue;
      }

      // S5.6 §3: 5m starts `intradayWarmupSessions` (30) TRADING sessions before studyStart, so the
      // 20-session RVOL baseline is already full on study-session-1. The date is derived from THIS
      // symbol's own daily calendar — never a hardcoded date and never a calendar-day guess, because
      // "30 trading sessions" is a market-calendar fact (holidays/half-days make it ~44±2 cal days).
      const fiveStart = fiveMinWarmupStart(dailyBars);
      process.stdout.write(`5m from ${fiveStart} (warmup ${CONFIG.fetch.intradayWarmupSessions}s + study)… `);
      const raw5m = await client.fetchIntradayRange(
        sym, fiveStart, addDays(CONFIG.fetch.intradayFetchEnd, 1), CONFIG.fetch.intradayMaxSpanDays,
      );
      const { sessions } = normalizeFiveMin(raw5m, byDate);
      await writeJson(path.join(NORM_DIR, sym, 'sessions.json'), sessions);

      // per-symbol QA
      const xg = crossGrainCheck(sessions, byDate);
      const xgPass = xg.filter((r) => r.pass).length;
      const auctionSessions = sessions.filter((s) => s.hasAuction).length;
      const multiAuction = sessions.filter((s) => s.auctionBarCount > 1).length;
      const otherBars = sessions.reduce((a, s) => a + s.otherBarCount, 0);
      const regCounts = {};
      for (const s of sessions) regCounts[s.regularBarCount] = (regCounts[s.regularBarCount] || 0) + 1;
      const tzSeen = [...new Set(sessions.map((s) => s.tzAbbrev))].sort();
      const preStudy = dailyBars.filter((b) => isoBefore(b.date, CONFIG.universe.eligibilityAsOf)).length;

      perSymbol[sym] = {
        dailyBars: dailyBars.length, preStudySessions: preStudy,
        fiveMinSessions: sessions.length, auctionSessions, multiAuctionSessions: multiAuction,
        otherBars, regularBarCountDistribution: regCounts, dstRegimesSeen: tzSeen,
        crossGrain: { checked: xg.length, pass: xgPass, worstDiffPct: xg.reduce((m, r) => Math.max(m, r.diffPct), 0) },
      };
      process.stdout.write(`daily=${dailyBars.length} 5mSess=${sessions.length} auction=${auctionSessions} xg=${xgPass}/${xg.length} tz=${tzSeen.join('/')}`);

      if (sym === 'NVDA') {
        const adj = adjustmentCheck(sessions.filter((s) => s.etDate >= '2024-06-05' && s.etDate <= '2024-06-14'), byDate);
        perSymbol[sym].nvdaSplitAdjustment = { checked: adj.length, pass: adj.filter((r) => r.pass).length };
      }
    } catch (e) {
      failures.push({ symbol: sym, error: e.message });
      process.stdout.write(`\n  🔴 [${sym}] FAILED: ${e.message} — skipping, run continues`);
    }
  }

  // ── Earnings (bulk; probe equities) ────────────────────────────────────────
  const eqs = list.filter((s) => scope.equities.has(s));
  let earningsInfo = null;
  if (eqs.length) {
    console.log(`\n\nearnings (bulk): ${eqs.join(',')}`);
    const from = addMonths(CONFIG.range.studyStart, -Math.max(24, CONFIG.range.inSampleMonths));
    const earn = await client.fetchEarnings(eqs, from, CONFIG.range.studyEnd);
    const recs = earn && earn.earnings ? earn.earnings.length : 0;
    earningsInfo = { symbols: eqs, from, to: CONFIG.range.studyEnd, records: recs };
    console.log(`  ${recs} earnings records`);
  }

  // ── Depth-eligibility sweep (R2; test #5 tool) ─────────────────────────────
  const depth = depthEligibilitySweep(symbolDaily);

  // ── Warmup start computation (R1/§A6) ──────────────────────────────────────
  const warmup = computeWarmupStart(symbolDaily);

  // ── Manifest ───────────────────────────────────────────────────────────────
  const manifest = client.getManifest();
  const networkCalls = manifest.filter((m) => !m.fromCache);
  const totalBytes = manifest.reduce((a, m) => a + (m.bytes || 0), 0);
  const manifestDoc = {
    session: 'LevelStory Session 2 — fetch/normalize',
    startedAt, finishedAt: new Date().toISOString(),
    config: { version: CONFIG.version, studyStart: CONFIG.range.studyStart, studyEnd: CONFIG.range.studyEnd, dailyFetchStart: CONFIG.fetch.dailyFetchStart },
    symbols: list,
    warmup, depth, earnings: earningsInfo,
    failures,
    perSymbol,
    calls: { total: manifest.length, network: networkCalls.length, cacheHits: manifest.length - networkCalls.length, totalBytes },
    manifestEntries: manifest,
  };
  const ts = tsStamp();
  const manifestPath = path.join(DATA_DIR, `manifest_${ts}.json`);
  await writeJson(manifestPath, manifestDoc);
  // small metadata → committed under docs/discovery/
  const committedManifest = path.join(REPO_ROOT, 'docs', 'discovery', `SESSION2_FETCH_MANIFEST_${ts}.json`);
  await writeJson(committedManifest, { ...manifestDoc, manifestEntries: manifest.map((m) => ({ ...m, savedTo: typeof m.savedTo === 'string' ? path.relative(REPO_ROOT, path.isAbsolute(m.savedTo) ? m.savedTo : path.join(DATA_DIR, m.savedTo)) : m.savedTo })) });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n\n════════ SUMMARY ════════');
  console.log(`Calls: ${manifest.length} (network ${networkCalls.length}, cache ${manifest.length - networkCalls.length}), ${(totalBytes / 1e6).toFixed(1)} MB`);
  console.log(`Warmup: floor date (550 sessions before ${CONFIG.range.studyStart}) = ${warmup.floorDate}; fetch start ${warmup.fetchStart}; mature-name margin +${warmup.matureMarginSessions} sessions`);
  console.log('\nDepth-eligibility sweep (R2, ≥550 pre-study sessions):');
  for (const r of depth) console.log(`  ${r.verdict === 'PASS' ? '✅' : '🔴'} ${r.symbol.padEnd(5)} ${String(r.preStudySessions).padStart(5)} pre-study  margin ${r.margin >= 0 ? '+' : ''}${r.margin}  (first ${r.firstDailyBar})`);
  if (failures.length) {
    console.log(`\n🔴 ${failures.length} symbol(s) FAILED (recorded, not cached): ${failures.map((f) => f.symbol).join(', ')}`);
    for (const f of failures) console.log(`    ${f.symbol}: ${f.error}`);
  }
  console.log(`\nManifest: ${path.relative(REPO_ROOT, manifestPath)} (committed copy: ${path.relative(REPO_ROOT, committedManifest)})`);
  console.log('Done.');
}

function addMonths(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function computeWarmupStart(symbolDaily) {
  // Use the deepest-history symbol (most pre-study sessions) as the "mature" reference.
  const floor = CONFIG.range.warmupMinSessions; // 550
  let best = null;
  for (const { symbol, dailyBars } of symbolDaily) {
    const pre = dailyBars.map((b) => b.date).filter((d) => isoBefore(d, CONFIG.range.studyStart)).sort();
    if (!best || pre.length > best.pre.length) best = { symbol, pre };
  }
  const pre = best ? best.pre : [];
  const floorDate = pre.length >= floor ? pre[pre.length - floor] : null; // the 550th session before studyStart
  return {
    referenceSymbol: best ? best.symbol : null,
    floorSessions: floor,
    floorDate, // earliest daily fetch start that still yields ≥550 pre-study sessions for the reference name
    fetchStart: CONFIG.fetch.dailyFetchStart,
    matureMarginSessions: pre.length - floor,
  };
}

// Entry-point guard: run the fetch ONLY when this file is the process entry, never on import.
// (Without it, any `import` of this module — a test importing a helper, a tool reusing a function —
// silently kicks off a live network fetch as an import side effect.)
const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1); });
