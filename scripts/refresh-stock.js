#!/usr/bin/env node
// scripts/refresh-stock.js
// Earnings refresh pipeline — gathers fresh data from Sonar + EODHD,
// compares against existing knowledge package, generates delta report.
//
// Usage:
//   node --env-file=.env.local scripts/refresh-stock.js NVDA
//   node --env-file=.env.local scripts/refresh-stock.js AVGO --quarter "Q1 FY26"
//   node --env-file=.env.local scripts/refresh-stock.js SNOW --dry-run

import fs from 'fs/promises';
import path from 'path';
import { querySonar } from '../api/helpers/sonar.js';
import {
  STOCK_META,
  findKnowledgePackage,
  parseKnowledgePackage,
  extractDataTable,
  formatEodhdToTable,
  diffMetrics,
  flagNarrativeChanges,
  generateRefreshReport,
} from './refresh-helpers.js';

// =============================================================================
// CLI argument parsing
// =============================================================================

const args = process.argv.slice(2);
const ticker = args[0]?.toUpperCase();
const dryRun = args.includes('--dry-run');
const quarterIdx = args.indexOf('--quarter');
const quarterOverride = quarterIdx !== -1 ? args[quarterIdx + 1] : null;

if (!ticker) {
  console.error('Usage: node --env-file=.env.local scripts/refresh-stock.js <TICKER> [--quarter "Q4 FY26"] [--dry-run]');
  process.exit(1);
}

const meta = STOCK_META[ticker];
if (!meta) {
  console.error(`Unknown ticker: ${ticker}. Available: ${Object.keys(STOCK_META).join(', ')}`);
  process.exit(1);
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`  ${ticker} — ${meta.name} Earnings Refresh`);
console.log(`  ${dryRun ? '🔍 DRY RUN MODE' : '🚀 LIVE MODE'}`);
console.log(`${'═'.repeat(60)}\n`);

// =============================================================================
// Step 1: Load existing knowledge package
// =============================================================================

console.log('Step 1: Loading existing knowledge package...');

const existingContent = findKnowledgePackage(ticker);
if (!existingContent) {
  console.error(`\n❌ Knowledge package not found for ${ticker}`);
  console.error(`   Checked: STOCK_DATA["${ticker}"] in src/data/stockIntelligenceData.js`);
  process.exit(1);
}

const existing = parseKnowledgePackage(existingContent);
const oldTable = extractDataTable(existingContent);

console.log(`  ✓ Package loaded (${existingContent.length.toLocaleString()} chars)`);
console.log(`  ✓ Current coverage: ${existing.dataThroughQuarter || 'Unknown'}`);
console.log(`  ✓ Last updated: ${existing.lastUpdated || 'Unknown'}`);
if (oldTable) {
  console.log(`  ✓ Data table: ${oldTable.rows.length} metrics × ${oldTable.headers.length - 1} quarters`);
} else {
  console.log(`  ⚠ No data table found in existing package`);
}

// =============================================================================
// Dry run — show plan and exit
// =============================================================================

if (dryRun) {
  console.log('\n--- DRY RUN: Actions that would be taken ---\n');

  console.log('Step 2: Sonar Pro Call A — Earnings Results');
  console.log(`  Model: sonar-pro`);
  console.log(`  System: Financial analyst extracting earnings data for ${ticker} (${meta.name})`);
  console.log(`  Max tokens: 3000, Temperature: 0.2, Recency: month`);
  console.log(`  Requires: PERPLEXITY_API_KEY (${process.env.PERPLEXITY_API_KEY ? 'set' : 'NOT SET'})\n`);

  console.log('Step 2: Sonar Pro Call B — Narrative Intelligence');
  console.log(`  Model: sonar-pro`);
  console.log(`  System: Financial analyst capturing qualitative intelligence for ${ticker}`);
  console.log(`  Max tokens: 2000, Temperature: 0.3, Recency: month\n`);

  console.log('Step 3: EODHD Fundamentals');
  console.log(`  URL: https://eodhd.com/api/fundamentals/${ticker}.US?api_token=***&fmt=json`);
  console.log(`  Requires: EODHD_API_KEY (${process.env.EODHD_API_KEY ? 'set' : 'NOT SET'})\n`);

  console.log('Step 4: Delta detection');
  console.log(`  Compare old Section 9 table vs new EODHD data`);
  console.log(`  Compare old management signals vs new Sonar narrative\n`);

  console.log('Step 5: Generate report');
  const dateStr = new Date().toISOString().split('T')[0];
  console.log(`  Output: scripts/output/${ticker}_refresh_report_${dateStr}.md\n`);

  console.log('--- DRY RUN COMPLETE (no API calls made) ---');
  process.exit(0);
}

// =============================================================================
// Step 2: Sonar Pro calls
// =============================================================================

let sonarEarnings = null;
let sonarNarrative = null;

// Call A — Earnings Results
console.log('\nStep 2a: Fetching earnings results from Sonar Pro...');

const earningsSystemPrompt = `You are a financial analyst extracting earnings data from the most recent quarterly report for ${ticker} (${meta.name}). Return structured JSON.

Respond ONLY with valid JSON, no markdown fences, no preamble.

Schema:
{
  "quarter": "Q4 FY26",
  "endDate": "January 25, 2026",
  "revenue": { "total": 65000, "unit": "million", "yoyGrowth": "73%", "qoqGrowth": "14%" },
  "grossMargin": { "gaap": "74.5%", "nonGaap": "75.0%" },
  "operatingMargin": { "gaap": "62%", "nonGaap": "65%" },
  "netIncome": { "amount": 22000, "unit": "million" },
  "eps": { "gaap": 0.89, "nonGaap": 0.92 },
  "segments": [
    { "name": "Data Center", "revenue": 56000, "unit": "million", "growth": "73% YoY" }
  ],
  "geographic": [
    { "region": "United States", "revenue": 45000, "unit": "million", "pctOfTotal": "69%" }
  ],
  "cashFlow": { "operating": 25000, "capex": 1800, "free": 23200 },
  "rdSpend": { "amount": 5200, "unit": "million" },
  "oneTimeItems": ["description of any charges or unusual items"],
  "guidance": {
    "nextQuarterRevenue": "68000 million ± 2%",
    "nextQuarterMargin": "75.5% ± 0.5%",
    "other": "any other forward guidance"
  }
}

Include specific numbers for everything. If a data point is not available, use null.`;

const earningsUserPrompt = `What were the key financial results from ${ticker}'s most recent quarterly earnings report? I need: total revenue (dollar amount and YoY/QoQ growth), gross margin (GAAP and non-GAAP), operating margin, net income, EPS, segment revenue breakdown (each segment with dollar amount and growth), geographic revenue breakdown, operating cash flow, CapEx, free cash flow, R&D spending, and any notable one-time items or charges. Also include management's forward guidance for next quarter (revenue, margin, any specific guidance). Include specific numbers for everything.`;

try {
  const { text, citations } = await querySonar(earningsSystemPrompt, earningsUserPrompt, {
    model: 'sonar-pro',
    maxTokens: 3000,
    temperature: 0.2,
    searchRecencyFilter: 'month',
  });

  try {
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    sonarEarnings = JSON.parse(jsonStr);
    sonarEarnings.citations = citations || [];
    console.log(`  ✓ Earnings data parsed: ${sonarEarnings.quarter || 'quarter unknown'}`);
    if (sonarEarnings.revenue?.total) {
      console.log(`  ✓ Revenue: $${sonarEarnings.revenue.total.toLocaleString()}M (${sonarEarnings.revenue.yoyGrowth || '?'} YoY)`);
    }
  } catch {
    console.warn(`  ⚠ JSON parse failed for earnings data. Raw response (first 200 chars):`);
    console.warn(`    ${text.slice(0, 200)}`);
  }
} catch (err) {
  console.warn(`  ⚠ Sonar earnings call failed: ${err.message}`);
  console.warn(`    Continuing without earnings data...`);
}

// Call B — Narrative Intelligence
console.log('\nStep 2b: Fetching narrative intelligence from Sonar Pro...');

const narrativeSystemPrompt = `You are a financial analyst capturing qualitative intelligence from ${ticker} (${meta.name})'s most recent earnings call and SEC filings. Provide detailed narrative analysis, including direct management quotes where possible.`;

const narrativeUserPrompt = `From ${ticker}'s most recent earnings report and call:
1) What were the 3-5 most significant management commentary points? Include direct quotes where possible.
2) Were there any strategic pivots, new products, or business model changes announced?
3) What competitive dynamics shifted?
4) Any changes to the geographic or customer concentration story?
5) What are analysts most focused on heading into next quarter?`;

try {
  const { text } = await querySonar(narrativeSystemPrompt, narrativeUserPrompt, {
    model: 'sonar-pro',
    maxTokens: 2000,
    temperature: 0.3,
    searchRecencyFilter: 'month',
  });

  sonarNarrative = text;
  console.log(`  ✓ Narrative received (${text.length.toLocaleString()} chars)`);
} catch (err) {
  console.warn(`  ⚠ Sonar narrative call failed: ${err.message}`);
  console.warn(`    Continuing without narrative data...`);
}

// =============================================================================
// Step 3: EODHD Fundamentals
// =============================================================================

console.log('\nStep 3: Fetching EODHD fundamentals...');

let eodhdResult = { table: null, markdown: null };

const EODHD_KEY = process.env.EODHD_API_KEY;
if (!EODHD_KEY) {
  console.warn('  ⚠ EODHD_API_KEY not set — skipping EODHD data');
} else {
  try {
    const url = `https://eodhd.com/api/fundamentals/${ticker}.US?api_token=${EODHD_KEY}&fmt=json`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const fundamentals = await res.json();
    eodhdResult = formatEodhdToTable(fundamentals, ticker);

    if (eodhdResult.table) {
      console.log(`  ✓ EODHD data: ${eodhdResult.table.rows.length} metrics × ${eodhdResult.table.headers.length - 1} quarters`);
    } else {
      console.log(`  ⚠ EODHD returned data but no quarterly financials found`);
    }
  } catch (err) {
    console.warn(`  ⚠ EODHD fetch failed: ${err.message}`);
    console.warn(`    Continuing without EODHD data...`);
  }
}

// =============================================================================
// Step 4: Delta detection
// =============================================================================

console.log('\nStep 4: Running delta detection...');

const deltas = diffMetrics(oldTable, eodhdResult.table);
const narrativeDeltas = flagNarrativeChanges(
  existing.sections.managementSignals || '',
  sonarNarrative || ''
);

const significantCount = deltas.changes.filter(c => c.significant).length;
console.log(`  ✓ Metric changes detected: ${deltas.changes.length} (${significantCount} significant)`);
console.log(`  ✓ New quotes found: ${narrativeDeltas.newQuotes.length}`);
console.log(`  ✓ New numbers in narrative: ${narrativeDeltas.guidanceChanges.length}`);
if (narrativeDeltas.toneShifts.length > 0) {
  console.log(`  ✓ Tone: ${narrativeDeltas.toneShifts[0]}`);
}

// =============================================================================
// Step 5: Generate report
// =============================================================================

console.log('\nStep 5: Generating refresh report...');

const newQuarter = quarterOverride || sonarEarnings?.quarter || 'TBD';

const report = generateRefreshReport(ticker, {
  existingPackage: existing,
  sonarEarnings,
  sonarNarrative,
  eodhdResult,
  deltas,
  narrativeDeltas,
  newQuarter,
});

const dateStr = new Date().toISOString().split('T')[0];
const outputDir = path.resolve(import.meta.dirname, 'output');
await fs.mkdir(outputDir, { recursive: true });

const outputPath = path.join(outputDir, `${ticker}_refresh_report_${dateStr}.md`);
await fs.writeFile(outputPath, report, 'utf-8');

console.log(`  ✓ Report written: ${outputPath}`);
console.log(`  ✓ Report size: ${(report.length / 1024).toFixed(1)} KB`);

// Summary
console.log(`\n${'═'.repeat(60)}`);
console.log(`  ✅ ${ticker} REFRESH COMPLETE`);
console.log(`  Previous coverage: ${existing.dataThroughQuarter || 'Unknown'}`);
console.log(`  New quarter: ${newQuarter}`);
console.log(`  Report: ${outputPath}`);

const warnings = [];
if (!sonarEarnings) warnings.push('Sonar earnings data missing');
if (!sonarNarrative) warnings.push('Sonar narrative missing');
if (!eodhdResult.table) warnings.push('EODHD data missing');

if (warnings.length > 0) {
  console.log(`\n  ⚠ Warnings:`);
  for (const w of warnings) {
    console.log(`    - ${w}`);
  }
}

console.log(`${'═'.repeat(60)}\n`);
