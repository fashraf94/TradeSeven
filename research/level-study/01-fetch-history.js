// research/level-study/01-fetch-history.js
//
// LevelStory Session 2 fetch/normalize orchestrator. First BUILD script.
//
//   node 01-fetch-history.js                 # fetch the frozen 14-symbol probe
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
import { normalizeDaily, normalizeFiveMin, crossGrainCheck, adjustmentCheck } from './lib/normalize.js';
import { depthEligibilitySweep } from './lib/depth-eligibility.js';
import { addDays, isoBefore } from './lib/session-time.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const DATA_DIR = path.join(HERE, 'data');
const NORM_DIR = path.join(DATA_DIR, 'normalized');

const PROBE = [...CONFIG.universe.probe.equities, ...CONFIG.universe.probe.context];
const EQUITIES = new Set(CONFIG.universe.probe.equities);

function tsStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function writeJson(p, obj) {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, JSON.stringify(obj));
}

async function main() {
  const symbols = process.argv.slice(2).filter(Boolean);
  const list = symbols.length ? symbols : PROBE;
  const client = createClient();
  const startedAt = new Date().toISOString();

  console.log(`LevelStory S2 fetch — ${list.length} symbol(s): ${list.join(', ')}`);
  console.log(`daily ${CONFIG.fetch.dailyFetchStart}→${CONFIG.range.studyEnd} | 5m ${CONFIG.fetch.intradayFetchStart}→${CONFIG.fetch.intradayFetchEnd}\n`);

  // ── January/EST DST proof fixture (AAPL 5m, Jan 2026) ──────────────────────
  const janFixture = path.join(REPO_ROOT, 'fixtures', 'sample-5m', 'AAPL_5m_2026-01.json');
  console.log('DST fixture: AAPL 5m Jan 2026 (EST) →', path.relative(REPO_ROOT, janFixture));
  await client.fetchIntradayToFixture('AAPL', '2026-01-01', '2026-02-01', janFixture);

  const perSymbol = {};
  const symbolDaily = []; // for depth sweep

  for (const sym of list) {
    process.stdout.write(`\n[${sym}] daily… `);
    const rawDaily = await client.fetchDaily(sym, CONFIG.fetch.dailyFetchStart, CONFIG.range.studyEnd);
    const { bars: dailyBars, byDate } = normalizeDaily(rawDaily);
    symbolDaily.push({ symbol: sym, dailyBars });
    await writeJson(path.join(NORM_DIR, sym, 'daily.json'), dailyBars);

    process.stdout.write(`5m (chunked)… `);
    const raw5m = await client.fetchIntradayRange(
      sym, CONFIG.fetch.intradayFetchStart, addDays(CONFIG.fetch.intradayFetchEnd, 1), CONFIG.fetch.intradayMaxSpanDays,
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
  }

  // ── Earnings (bulk; probe equities) ────────────────────────────────────────
  const eqs = list.filter((s) => EQUITIES.has(s));
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

main().catch((e) => { console.error('\nFATAL:', e.message); process.exit(1); });
