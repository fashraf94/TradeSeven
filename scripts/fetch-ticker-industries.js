#!/usr/bin/env node
/**
 * scripts/fetch-ticker-industries.js
 *
 * Sprint 6 Phase 4.6 — one-shot EODHD fetcher for the GICS Industry
 * classification of every stock in STOCK_UNIVERSE (239 tickers).
 *
 * Output is a `STOCK_INDUSTRIES` object literal printed to stdout. Flash
 * copy-pastes the block into api/_utils/rankingConfig.js after spot-check.
 *
 * SCOPE:
 *   - Fetches stocks only (239 from STOCK_UNIVERSE).
 *   - Sector ETFs (11) and industry ETFs (28) are NOT fetched here.
 *     Sector ETFs get explicit null in rankingConfig.js's build loop;
 *     industry ETFs are populated from the curated INDUSTRY_ETF_THEMES
 *     constant (see Phase 4.6 audit lock).
 *
 * USAGE:
 *   node scripts/fetch-ticker-industries.js              # full mode (all 239)
 *   node scripts/fetch-ticker-industries.js --dry-run    # first 10 only
 *
 *   # If .env.local is present at project root, env is loaded automatically.
 *   # Alternative invocations:
 *   #   node --env-file=.env.local scripts/fetch-ticker-industries.js
 *   #   EODHD_API_KEY=xxx node scripts/fetch-ticker-industries.js
 *
 * REQUIRED ENV:
 *   EODHD_API_KEY — sourced from .env.local if present, else process.env
 *
 * RE-RUN POLICY:
 *   - Re-run when STOCK_UNIVERSE is expanded with new stocks. Diff the
 *     generated STOCK_INDUSTRIES output against the current rankingConfig.js
 *     inline data; commit the merged result.
 *   - Periodic dry-runs recommended quarterly to detect EODHD classification
 *     drift (e.g., GICS reclassifications). If dry-run output diff is
 *     non-empty, run full mode and commit.
 *
 * EXPECTED RUNTIME:
 *   ~60-90 seconds for 239 stocks (BATCH_SIZE=10, DELAY_MS=250).
 *   Cost: ~239 EODHD credits per full run (filter on General section only).
 *
 * EXIT CODES:
 *   0 — success (STOCK_INDUSTRIES literal printed to stdout)
 *   1 — validation failure (>10% null industries, env missing, etc.)
 *   2 — invalid CLI flags
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  STOCK_UNIVERSE,
  ALL_TICKERS,
  TICKER_TO_SECTOR,
} from '../api/_utils/rankingConfig.js';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

const API_BASE = 'https://eodhd.com/api';
const BATCH_SIZE = 10;
const DELAY_MS = 250;
const DRY_RUN_LIMIT = 10;
const MAX_NULL_RATE = 0.10;

// Phase 4.6 OQ-5: filter to the whole General section. An earlier
// attempt used a multi-subfield filter
// ('General::Type,General::Industry,General::GicIndustry,...') but EODHD
// does not honor comma-separated subfields within a section — diagnostic
// against AAPL confirmed: no filter returns Industry + GicIndustry
// populated; multi-subfield filter returns both absent. Whole-section
// payload is small (no Financials/Earnings/SharesStats), so bandwidth
// cost is negligible and the EODHD credit cost is unchanged.
//
// Do NOT modify the codebase-wide EODHD_FUNDAMENTALS_FILTER in
// api/_utils/rankingConfig.js (consumed by compute-rankings cron) — the
// shared filter's General::Name subselector is acceptable there because
// it only needs the company name.
const SCRIPT_FUNDAMENTALS_FILTER = 'General';

// EODHD GicSector / Sector strings → our 11-sector ID space.
// Source for our IDs: rankingConfig.js STOCK_UNIVERSE keys.
// Two name variants: GICS official (used in GicSector) and Yahoo-style
// (used in plain Sector). Both populated for cross-check resilience.
const GICS_SECTOR_TO_OUR_ID = {
  'Information Technology': 'XLK',
  'Health Care': 'XLV',
  'Financials': 'XLF',
  'Energy': 'XLE',
  'Consumer Discretionary': 'XLY',
  'Consumer Staples': 'XLP',
  'Industrials': 'XLI',
  'Materials': 'XLB',
  'Utilities': 'XLU',
  'Real Estate': 'XLRE',
  'Communication Services': 'XLC',
  // Yahoo-style names (plain Sector field). 'Communication Services' is
  // identical between styles and intentionally not duplicated here.
  'Technology': 'XLK',
  'Healthcare': 'XLV',
  'Financial Services': 'XLF',
  'Consumer Cyclical': 'XLY',
  'Consumer Defensive': 'XLP',
  'Basic Materials': 'XLB',
};

// ---------------------------------------------------------------------
// Env + flags
// ---------------------------------------------------------------------

// Mirrors scripts/seed-discover-themes.js:58-78
function parseEnvFile(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseCliFlags(argv) {
  const flags = { dryRun: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') {
      flags.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/fetch-ticker-industries.js [--dry-run]');
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${arg}`);
      process.exit(2);
    }
  }
  return flags;
}

function die(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------
// EODHD fetch — mirrors api/cron/compute-rankings.js:109-168
// ---------------------------------------------------------------------

async function fetchSingleFundamental(ticker, apiKey) {
  const eohdTicker = ticker.replace(/\./g, '-');
  const url = `${API_BASE}/fundamentals/${eohdTicker}.US?api_token=${apiKey}&fmt=json&filter=${SCRIPT_FUNDAMENTALS_FILTER}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchAllFundamentals(tickers, apiKey) {
  const results = {};
  const failures = [];
  let success = 0;

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);
    const promises = batch.map(ticker =>
      fetchSingleFundamental(ticker, apiKey).catch(err => {
        failures.push({ ticker, error: err.message });
        return null;
      })
    );

    const batchResults = await Promise.all(promises);
    batch.forEach((ticker, idx) => {
      if (batchResults[idx]) {
        results[ticker] = batchResults[idx];
        success++;
      }
    });

    if (i + BATCH_SIZE < tickers.length) {
      await sleep(DELAY_MS);
    }

    const done = Math.min(i + BATCH_SIZE, tickers.length);
    if (done % 50 < BATCH_SIZE || done === tickers.length) {
      console.error(`[fetch] ${done}/${tickers.length} done (${success} ok, ${failures.length} failed)`);
    }
  }

  return { results, failures, success };
}

// ---------------------------------------------------------------------
// Industry extraction
// ---------------------------------------------------------------------

function extractIndustry(payload) {
  const general = payload?.General || {};
  // Prefer GicIndustry per OQ-1; fall back to plain Industry if GicIndustry
  // missing. Validation step downstream still fails on null/empty.
  return general.GicIndustry || general.Industry || null;
}

function extractSectorString(payload) {
  const general = payload?.General || {};
  return general.GicSector || general.Sector || null;
}

function extractType(payload) {
  const general = payload?.General || {};
  return general.Type || null;
}

// ---------------------------------------------------------------------
// Output formatting — STOCK_INDUSTRIES literal
// ---------------------------------------------------------------------

function formatStockIndustriesLiteral(industries, isDryRun) {
  const lines = [];
  if (isDryRun) {
    lines.push('// =============================================================');
    lines.push(`// DRY-RUN OUTPUT — ${DRY_RUN_LIMIT} of ${ALL_TICKERS.length} tickers fetched`);
    lines.push('// Do NOT commit this output. Re-run without --dry-run for full data.');
    lines.push('// =============================================================');
  }
  lines.push('export const STOCK_INDUSTRIES = {');

  for (const [sectorId, sectorDef] of Object.entries(STOCK_UNIVERSE)) {
    const tickersInSector = sectorDef.stocks
      .filter(t => t in industries)
      .sort();
    if (tickersInSector.length === 0) continue;

    lines.push(`  // ${sectorId} — ${sectorDef.name}`);
    for (const ticker of tickersInSector) {
      const industry = industries[ticker];
      const valueStr = industry === null
        ? 'null'
        : `'${String(industry).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
      lines.push(`  ${JSON.stringify(ticker)}: ${valueStr},`);
    }
    lines.push('');
  }

  lines.push('};');
  return lines.join('\n');
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main() {
  const flags = parseCliFlags(process.argv);

  // Env: prefer .env.local, fall back to process.env (for --env-file or
  // inline EODHD_API_KEY=xxx invocations).
  const fileEnv = parseEnvFile(path.join(PROJECT_ROOT, '.env.local'));
  const apiKey = fileEnv.EODHD_API_KEY || process.env.EODHD_API_KEY;
  if (!apiKey) {
    die('EODHD_API_KEY missing from .env.local AND process.env');
  }

  const tickers = flags.dryRun ? ALL_TICKERS.slice(0, DRY_RUN_LIMIT) : ALL_TICKERS;
  console.error(`[fetch] mode=${flags.dryRun ? 'DRY-RUN' : 'FULL'}, tickers=${tickers.length}/${ALL_TICKERS.length}, batch=${BATCH_SIZE}, delay=${DELAY_MS}ms`);

  const startTime = Date.now();
  const { results, failures, success } = await fetchAllFundamentals(tickers, apiKey);
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(`[fetch] complete in ${elapsedSec}s — ${success} ok, ${failures.length} failed`);

  // Build industries map + cross-checks
  const industries = {};
  const nullExtractions = [];
  const emptyExtractions = [];
  const sectorMismatches = [];
  const unexpectedTypes = [];

  for (const ticker of tickers) {
    const payload = results[ticker];
    if (!payload) {
      industries[ticker] = null;
      continue; // already counted in failures
    }

    const industry = extractIndustry(payload);
    if (industry === null || industry === undefined) {
      industries[ticker] = null;
      nullExtractions.push(ticker);
    } else if (typeof industry === 'string' && industry.trim() === '') {
      industries[ticker] = null;
      emptyExtractions.push(ticker);
    } else {
      industries[ticker] = String(industry).trim();
    }

    // Sector cross-check
    const eodhdSector = extractSectorString(payload);
    const expectedSectorId = TICKER_TO_SECTOR[ticker];
    const mappedSectorId = eodhdSector ? GICS_SECTOR_TO_OUR_ID[eodhdSector] : null;
    if (eodhdSector && mappedSectorId && mappedSectorId !== expectedSectorId) {
      sectorMismatches.push({ ticker, eodhdSector, expected: expectedSectorId, mapped: mappedSectorId });
    }

    // Type sanity check (expect "Common Stock" or similar)
    const eodhdType = extractType(payload);
    if (eodhdType && eodhdType !== 'Common Stock') {
      unexpectedTypes.push({ ticker, type: eodhdType });
    }
  }

  // Summary
  const totalNull = failures.length + nullExtractions.length + emptyExtractions.length;
  const nullRate = totalNull / tickers.length;

  console.error('');
  console.error('=== Validation Report ===');
  console.error(`Total fetched:           ${tickers.length}`);
  console.error(`Successful (string):     ${tickers.length - totalNull}`);
  console.error(`Per-ticker fetch fails:  ${failures.length}`);
  console.error(`Null GicIndustry:        ${nullExtractions.length}`);
  console.error(`Empty-string industry:   ${emptyExtractions.length}`);
  console.error(`Sector mismatches:       ${sectorMismatches.length} (logged, non-fatal)`);
  console.error(`Unexpected Type values:  ${unexpectedTypes.length} (logged, non-fatal)`);
  console.error(`Null rate:               ${(nullRate * 100).toFixed(1)}% (threshold: ${(MAX_NULL_RATE * 100).toFixed(0)}%)`);

  if (failures.length > 0) {
    console.error('');
    console.error('Per-ticker fetch failures:');
    for (const f of failures.slice(0, 30)) {
      console.error(`  ${f.ticker}: ${f.error}`);
    }
    if (failures.length > 30) {
      console.error(`  ... and ${failures.length - 30} more`);
    }
  }

  if (sectorMismatches.length > 0) {
    console.error('');
    console.error('Sector mismatches (non-fatal):');
    for (const m of sectorMismatches.slice(0, 30)) {
      console.error(`  [gicSector-mismatch] ${m.ticker}: EODHD="${m.eodhdSector}" (mapped=${m.mapped}), expected=${m.expected}`);
    }
    if (sectorMismatches.length > 30) {
      console.error(`  ... and ${sectorMismatches.length - 30} more`);
    }
  }

  if (unexpectedTypes.length > 0) {
    console.error('');
    console.error('Unexpected General.Type values:');
    for (const t of unexpectedTypes.slice(0, 30)) {
      console.error(`  ${t.ticker}: "${t.type}"`);
    }
  }

  const nonFailureNulls = [...nullExtractions, ...emptyExtractions];
  if (nonFailureNulls.length > 0) {
    console.error('');
    console.error('Tickers with null/empty industry (excludes fetch failures):');
    for (const t of nonFailureNulls.slice(0, 30)) {
      console.error(`  ${t}`);
    }
  }

  // Hard fail if too many nulls — D-A-3 lock
  if (nullRate > MAX_NULL_RATE) {
    die(`Null rate ${(nullRate * 100).toFixed(1)}% exceeds threshold ${(MAX_NULL_RATE * 100).toFixed(0)}%. Aborting.`);
  }

  // Print the literal to stdout (separate stream from logs above)
  console.error('');
  console.error('=== STOCK_INDUSTRIES literal (stdout) ===');
  console.log(formatStockIndustriesLiteral(industries, flags.dryRun));
}

main().catch(err => {
  console.error(`FATAL: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
