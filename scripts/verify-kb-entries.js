#!/usr/bin/env node
// scripts/verify-kb-entries.js
// Reads Academy KB JSON files and verifies historicalExample claims against EODHD data.
//
// Usage:
//   node --env-file=.env.local scripts/verify-kb-entries.js --dir ./kb-v2 --api-url http://localhost:3000
//   node --env-file=.env.local scripts/verify-kb-entries.js --dir ./kb-v2 --api-url https://fantasytrades.io
//
// KB JSON expected shape:
//   {
//     "id": "short-squeeze",
//     "title": "Short Squeeze",
//     "historicalExamples": [
//       {
//         "title": "The Reddit Revolution — GameStop",
//         "ticker": "GME",
//         "startDate": "2021-01-04",
//         "endDate": "2021-02-05",
//         "claims": {
//           "peakPrice": 483,
//           "startPrice": 17.25,
//           "percentChange": 2700
//         },
//         "narrative": "...",
//         "priceData": []
//       }
//     ]
//   }

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    dir: null,
    apiUrl: 'http://localhost:3000',
    secret: process.env.CRON_SECRET || process.env.ADMIN_SECRET || '',
    tolerance: 5,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dir':
        parsed.dir = args[++i];
        break;
      case '--api-url':
        parsed.apiUrl = args[++i];
        break;
      case '--secret':
        parsed.secret = args[++i];
        break;
      case '--tolerance':
        parsed.tolerance = parseFloat(args[++i]);
        break;
      case '--verbose':
        parsed.verbose = true;
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  if (!parsed.dir) {
    console.error('Usage: node scripts/verify-kb-entries.js --dir <path> [--api-url <url>] [--secret <token>] [--tolerance <pct>] [--verbose]');
    process.exit(1);
  }

  if (!parsed.secret) {
    console.error('Warning: No auth secret provided. Set CRON_SECRET env var or use --secret <token>.');
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Natural language date parsing fallback
// ---------------------------------------------------------------------------

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function parseFuzzyDate(text) {
  if (!text || typeof text !== 'string') return null;

  // Try "Month YYYY" or "Month DD, YYYY"
  const match = text.match(/(\w+)\s+(\d{1,2},?\s+)?(\d{4})/i);
  if (!match) return null;

  const monthName = match[1].toLowerCase();
  const month = MONTHS[monthName];
  if (month === undefined) return null;

  const year = parseInt(match[3], 10);
  const day = match[2] ? parseInt(match[2], 10) : 1;

  const date = new Date(year, month, day);
  return date.toISOString().split('T')[0];
}

function inferDateRange(example) {
  // Prefer explicit dates
  if (example.startDate && example.endDate) {
    return { startDate: example.startDate, endDate: example.endDate };
  }

  // Try period string: "January 2021 to March 2021"
  if (example.period || example.dateRange) {
    const period = example.period || example.dateRange;
    const parts = period.split(/\s+to\s+/i);
    if (parts.length === 2) {
      const start = parseFuzzyDate(parts[0]);
      const end = parseFuzzyDate(parts[1]);
      if (start && end) return { startDate: start, endDate: end };
    }
  }

  // Try single date with buffer
  if (example.date) {
    const parsed = parseFuzzyDate(example.date);
    if (parsed) {
      const d = new Date(parsed);
      const start = new Date(d);
      start.setDate(start.getDate() - 7);
      const end = new Date(d);
      end.setDate(end.getDate() + 14);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// API caller
// ---------------------------------------------------------------------------

async function pullChartData(apiUrl, secret, ticker, startDate, endDate, exchange) {
  const url = `${apiUrl}/api/academy/pull-chart-data`;
  const body = { ticker, startDate, endDate };
  if (exchange) body.exchange = exchange;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`API returned ${response.status}: ${text}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Claim verification
// ---------------------------------------------------------------------------

function verifyClaims(claims, summary, priceData, tolerance) {
  const results = [];
  if (!claims || !summary) return results;

  const checks = [
    { key: 'startPrice', actual: summary.startPrice, label: 'Start price' },
    { key: 'endPrice', actual: summary.endPrice, label: 'End price' },
    { key: 'peakPrice', actual: summary.highOfRange, label: 'Peak/high price' },
    { key: 'highOfRange', actual: summary.highOfRange, label: 'High of range' },
    { key: 'lowOfRange', actual: summary.lowOfRange, label: 'Low of range' },
    { key: 'maxVolume', actual: summary.maxSingleDayVolume, label: 'Max single-day volume' },
  ];

  for (const { key, actual, label } of checks) {
    if (claims[key] == null) continue;
    const claimed = claims[key];
    const diff = Math.abs(actual - claimed);
    const pctDiff = claimed !== 0 ? (diff / Math.abs(claimed)) * 100 : diff > 0 ? 100 : 0;
    const pass = pctDiff <= tolerance;

    results.push({
      label,
      claimed,
      actual,
      pctDiff: pctDiff.toFixed(2),
      pass,
    });
  }

  // percentChange check (special handling: compare percentage points)
  if (claims.percentChange != null) {
    const actualPct = parseFloat(summary.percentChange);
    const claimedPct = claims.percentChange;
    const diff = Math.abs(actualPct - claimedPct);
    const pass = diff <= tolerance;

    results.push({
      label: 'Percent change',
      claimed: `${claimedPct}%`,
      actual: summary.percentChange,
      pctDiff: `${diff.toFixed(2)}pp`,
      pass,
    });
  }

  // Check specific date prices
  if (claims.priceOnDate && priceData) {
    for (const { date, field, value, label: claimLabel } of claims.priceOnDate) {
      const dayData = priceData.find(d => d.date === date);
      if (!dayData) {
        results.push({ label: claimLabel || `${field} on ${date}`, claimed: value, actual: 'N/A (no data)', pctDiff: 'N/A', pass: false });
        continue;
      }
      const actual = dayData[field] || dayData.close;
      const diff = Math.abs(actual - value);
      const pctDiff = value !== 0 ? (diff / Math.abs(value)) * 100 : 0;
      results.push({
        label: claimLabel || `${field} on ${date}`,
        claimed: value,
        actual,
        pctDiff: pctDiff.toFixed(2),
        pass: pctDiff <= tolerance,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  const dirPath = resolve(opts.dir);

  // Read all JSON files
  let files;
  try {
    const entries = await readdir(dirPath);
    files = entries.filter(f => f.endsWith('.json')).sort();
  } catch (err) {
    console.error(`Cannot read directory: ${dirPath}`);
    console.error(err.message);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log(`No JSON files found in ${dirPath}`);
    process.exit(0);
  }

  console.log(`\n=== KB VERIFICATION REPORT ===`);
  console.log(`Directory: ${dirPath}`);
  console.log(`Files found: ${files.length}`);
  console.log(`API: ${opts.apiUrl}`);
  console.log(`Tolerance: ${opts.tolerance}%\n`);

  let totalExamples = 0;
  let totalPass = 0;
  let totalMismatch = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const mismatches = [];

  for (const file of files) {
    const filePath = join(dirPath, file);
    let entry;
    try {
      const content = await readFile(filePath, 'utf-8');
      entry = JSON.parse(content);
    } catch (err) {
      console.error(`  ⚠ Failed to parse ${file}: ${err.message}`);
      totalErrors++;
      continue;
    }

    const examples = entry.historicalExamples || [];
    if (examples.length === 0) continue;

    console.log(`--- ${entry.id || file} ---`);

    for (const example of examples) {
      totalExamples++;
      const title = example.title || example.ticker || 'Untitled';

      if (!example.ticker) {
        console.log(`  ⚠ "${title}" — no ticker, skipping`);
        totalSkipped++;
        continue;
      }

      const dateRange = inferDateRange(example);
      if (!dateRange) {
        console.log(`  ⚠ "${title}" (${example.ticker}) — cannot determine date range, skipping`);
        totalSkipped++;
        continue;
      }

      try {
        const result = await pullChartData(
          opts.apiUrl, opts.secret,
          example.ticker, dateRange.startDate, dateRange.endDate,
          example.exchange
        );

        if (!result.priceData || result.priceData.length === 0) {
          console.log(`  ⚠ "${title}" (${example.ticker}) — no price data returned for ${dateRange.startDate} to ${dateRange.endDate}`);
          totalSkipped++;
          continue;
        }

        // Verify claims
        const claims = example.claims || {};
        const checks = verifyClaims(claims, result.summary, result.priceData, opts.tolerance);

        if (checks.length === 0) {
          console.log(`  ℹ "${title}" (${example.ticker}) — ${result.totalDays} days fetched, no claims to verify`);
          totalSkipped++;
          continue;
        }

        const allPass = checks.every(c => c.pass);
        if (allPass) {
          totalPass++;
          console.log(`  ✅ "${title}" (${example.ticker}) — all ${checks.length} claims verified`);
        } else {
          totalMismatch++;
          console.log(`  ❌ "${title}" (${example.ticker}) — MISMATCHES found`);
          mismatches.push({ file, entry: entry.id, title, ticker: example.ticker, checks });
        }

        if (opts.verbose || !allPass) {
          for (const c of checks) {
            const icon = c.pass ? '✅' : '❌';
            console.log(`     ${icon} ${c.label}: claimed ${c.claimed}, actual ${c.actual} (${c.pctDiff}${typeof c.pctDiff === 'string' && c.pctDiff.includes('pp') ? '' : '%'} diff)`);
          }
        }

      } catch (err) {
        console.log(`  ❌ "${title}" (${example.ticker}) — API error: ${err.message}`);
        totalErrors++;
      }
    }
  }

  // Summary
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total examples: ${totalExamples}`);
  console.log(`  ✅ Verified:   ${totalPass}`);
  console.log(`  ❌ Mismatches: ${totalMismatch}`);
  console.log(`  ⚠  Skipped:   ${totalSkipped}`);
  console.log(`  💥 Errors:     ${totalErrors}`);

  if (mismatches.length > 0) {
    console.log(`\n=== MISMATCH DETAILS ===`);
    for (const m of mismatches) {
      console.log(`\n[${m.entry || m.file}] ${m.title} (${m.ticker}):`);
      for (const c of m.checks) {
        const icon = c.pass ? '✅' : '❌';
        console.log(`  ${icon} ${c.label}: claimed ${c.claimed}, actual ${c.actual} (${c.pctDiff}${typeof c.pctDiff === 'string' && c.pctDiff.includes('pp') ? '' : '%'} diff)`);
      }
    }
  }

  // Exit code: 1 if any mismatches
  process.exit(totalMismatch > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
