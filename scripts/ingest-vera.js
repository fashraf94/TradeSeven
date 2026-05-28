#!/usr/bin/env node
// scripts/ingest-vera.js
// Manual paste pipeline for Vera deepdives.
// Reads a Forge Agent markdown + JSONL extraction, POSTs both to
// /api/fantasytimes/ingest-deepdive, prints the response.
//
// Usage:
//   node --env-file=.env.local scripts/ingest-vera.js \
//     --markdown path/to/deepdive.md \
//     --records path/to/extractions.jsonl \
//     --topic-slug ai-data-center-cooling \
//     --primary-ticker VRT \
//     [--endpoint http://localhost:3000/api/fantasytimes/ingest-deepdive] \
//     [--dry-run]
//
// Required env: VERA_INGEST_SECRET

import fs from 'fs/promises';

// ─────────────────────────────────────────────────────────────────────────────
// CLI argument parsing
// ─────────────────────────────────────────────────────────────────────────────

function getArg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i === -1 || i + 1 >= process.argv.length) return fallback;
  return process.argv[i + 1];
}

const markdownPath = getArg('--markdown');
const recordsPath = getArg('--records');
const topicSlug = getArg('--topic-slug');
const primaryTicker = getArg('--primary-ticker');
const sector = getArg('--sector');
const endpoint = getArg('--endpoint', 'http://localhost:3000/api/fantasytimes/ingest-deepdive');
const dryRun = process.argv.includes('--dry-run');

function usage() {
  console.error(`Usage:
  node --env-file=.env.local scripts/ingest-vera.js \\
    --markdown <path> \\
    --records <path.jsonl> \\
    --topic-slug <slug> \\
    [--primary-ticker <TICKER>] \\
    [--sector <Sector>] \\
    [--endpoint <url>] \\
    [--dry-run]`);
  process.exit(1);
}

if (!markdownPath || !recordsPath || !topicSlug) usage();

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const secret = process.env.VERA_INGEST_SECRET;
  if (!secret && !dryRun) {
    console.error('ERROR: VERA_INGEST_SECRET env var is not set. Use --env-file=.env.local or export it.');
    process.exit(1);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Vera Deepdive Ingest`);
  console.log(`  topicSlug: ${topicSlug}`);
  console.log(`  endpoint:  ${endpoint}`);
  console.log(`  mode:      ${dryRun ? 'DRY RUN (no POST)' : 'LIVE'}`);
  console.log(`${'═'.repeat(60)}\n`);

  // --- Read markdown ---
  let fullMarkdown;
  try {
    fullMarkdown = await fs.readFile(markdownPath, 'utf8');
  } catch (err) {
    console.error(`ERROR reading markdown at ${markdownPath}: ${err.message}`);
    process.exit(1);
  }
  console.log(`Markdown: ${fullMarkdown.length} chars, ${fullMarkdown.split('\n').length} lines`);

  // --- Read JSONL records ---
  let recordsRaw;
  try {
    recordsRaw = await fs.readFile(recordsPath, 'utf8');
  } catch (err) {
    console.error(`ERROR reading records at ${recordsPath}: ${err.message}`);
    process.exit(1);
  }
  const lines = recordsRaw.split('\n').filter((l) => l.trim().length > 0);
  const extractedRecords = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      extractedRecords.push(JSON.parse(lines[i]));
    } catch (err) {
      console.error(`ERROR parsing JSONL line ${i + 1}: ${err.message}`);
      process.exit(1);
    }
  }
  console.log(`Records:  ${extractedRecords.length} parsed`);

  const payload = {
    fullMarkdown,
    extractedRecords,
    topicSlug,
    sourceFile: markdownPath.split('/').pop(),
  };
  if (primaryTicker) payload.primaryTicker = primaryTicker.toUpperCase();
  if (sector) payload.sector = sector;

  if (dryRun) {
    console.log('\nDRY RUN — request payload (truncated body):');
    console.log(JSON.stringify({
      ...payload,
      fullMarkdown: `<${payload.fullMarkdown.length} chars omitted>`,
      extractedRecords: `<${payload.extractedRecords.length} records omitted>`,
    }, null, 2));
    return;
  }

  // --- POST ---
  console.log(`\nPOSTing to ${endpoint} ...`);
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`Network error: ${err.message}`);
    process.exit(1);
  }

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* leave json null */ }

  console.log(`\nResponse: ${res.status} ${res.statusText}`);
  if (json) {
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log(text);
  }

  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
