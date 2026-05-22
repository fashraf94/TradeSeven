#!/usr/bin/env node
// api/scripts/sample-voice-layer-terms.js
//
// Re-runnable discovery utility for Phase 2.5 of the Voice Layer Rework.
//
// Pulls shadow-logged Voice Layer outputs from the `fantasytrades` GCS bucket
// (streams: shadow/first_message/ and shadow/trade_narration/), extracts
// single-token uppercase candidates [A-Z]{2,5} from each response, removes
// known tickers and common-word exclusions, and frequency-ranks the remainder.
//
// Output is the list of financial-term candidates Gemma is actually using in
// production. The Phase 2.5 starter TERM_UNIVERSE is locked against this
// ranking. The script is kept infrastructure — future term-universe expansions
// re-run it to refresh the candidate list against the latest production data.
//
// Usage:
//   node --env-file=.env.local api/scripts/sample-voice-layer-terms.js [days]
//
//   days — optional, defaults to 14 — how many days back to sample (inclusive
//          of today; uses UTC date keys to match shadowLogger.js).
//
// Requires env:
//   GCS_CREDENTIALS (JSON-stringified service account, same as shadowLogger.js)
//
// Exit code: 0 always (advisory, never fails CI).

import { Storage } from '@google-cloud/storage';
import { ALL_TICKERS } from '../_utils/rankingConfig.js';

const BUCKET_NAME = 'fantasytrades';
const PROJECT_ID = 'macro-nuance-474602-f5';
const STREAMS = ['first_message', 'trade_narration'];

// Mirror of EXCLUDED_WORDS from src/components/Agent/AgentChat.jsx. Kept inline
// to avoid a cross-tree import (src/ → api/ would break Vercel functions).
// If AgentChat.jsx is updated, refresh this list.
const EXCLUDED_WORDS = new Set([
  'I', 'A', 'AM', 'PM', 'AT', 'IN', 'ON', 'OR', 'IF', 'IT', 'IS', 'TO',
  'THE', 'AND', 'BUT', 'FOR', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS',
  'ONE', 'OUR', 'OUT', 'ARE', 'HAS', 'HIS', 'HOW', 'ITS', 'LET', 'MAY',
  'NEW', 'NOW', 'OLD', 'SEE', 'WAY', 'WHO', 'DID', 'GET', 'HIM', 'GOT',
  'SAY', 'SHE', 'TOO', 'USE', 'ATR', 'ETF', 'CEO', 'IPO',
  'HOLD', 'SWAP', 'STAR', 'CORE', 'WITH', 'THAT', 'THIS', 'FROM',
  'HAVE', 'BEEN', 'WILL', 'YOUR', 'WHAT', 'WHEN', 'MAKE', 'LIKE',
  'JUST', 'OVER', 'SUCH', 'TAKE', 'THAN', 'THEM', 'VERY', 'SOME',
  'INTO', 'MOST', 'ALSO', 'DONE', 'WANT', 'GOES', 'MUCH',
]);

function getBucket() {
  const creds = process.env.GCS_CREDENTIALS;
  if (!creds) {
    console.error('[sample-voice-layer-terms] GCS_CREDENTIALS not set — cannot sample shadow logs');
    process.exit(0);
  }
  const storage = new Storage({
    projectId: PROJECT_ID,
    credentials: JSON.parse(creds),
  });
  return storage.bucket(BUCKET_NAME);
}

function dateKeyForOffset(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function listStreamFiles(bucket, stream, dateKey) {
  const [files] = await bucket.getFiles({ prefix: `shadow/${stream}/${dateKey}/` });
  return files;
}

async function downloadJsonl(file) {
  const [buf] = await file.download();
  return buf.toString('utf8').split('\n').filter(Boolean).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

// Pull the user-visible response text out of a shadow record. The exact field
// depends on which stage logged it: success records have `parsed.response`;
// raw records have `rawResponse` (JSON-stringified Gemma output) or a plain
// `agentResponse`. Try each in order.
function extractResponseText(record) {
  if (record?.parsed?.response && typeof record.parsed.response === 'string') {
    return record.parsed.response;
  }
  if (record?.agentResponse && typeof record.agentResponse === 'string') {
    return record.agentResponse;
  }
  if (record?.rawResponse && typeof record.rawResponse === 'string') {
    // Raw is usually JSON-stringified; try to parse and pull `.response`.
    try {
      const parsed = JSON.parse(record.rawResponse);
      if (parsed?.response && typeof parsed.response === 'string') {
        return parsed.response;
      }
    } catch {
      // Not JSON — return as-is so the regex still gets a chance.
      return record.rawResponse;
    }
  }
  return null;
}

function extractTokens(text) {
  if (!text) return [];
  const matches = text.match(/\b[A-Z]{2,5}\b/g);
  return matches || [];
}

const TICKER_SET = new Set(ALL_TICKERS);

function categorize(token) {
  if (TICKER_SET.has(token)) return 'ticker';
  if (EXCLUDED_WORDS.has(token)) return 'excluded';
  return 'candidate';
}

async function main() {
  const days = Number(process.argv[2]) || 14;
  console.log(`\n[sample-voice-layer-terms] Sampling ${days} days of shadow logs from gs://${BUCKET_NAME}/shadow/{first_message,trade_narration}/\n`);

  const bucket = getBucket();
  const candidateCounts = new Map(); // token → count
  const tickerCounts = new Map();
  let recordsProcessed = 0;
  let filesProcessed = 0;

  for (let i = 0; i < days; i++) {
    const dateKey = dateKeyForOffset(i);
    for (const stream of STREAMS) {
      let files;
      try {
        files = await listStreamFiles(bucket, stream, dateKey);
      } catch (err) {
        console.error(`[sample] list ${stream}/${dateKey} failed: ${err.message}`);
        continue;
      }
      for (const file of files) {
        filesProcessed++;
        let records;
        try {
          records = await downloadJsonl(file);
        } catch (err) {
          console.error(`[sample] download ${file.name} failed: ${err.message}`);
          continue;
        }
        for (const rec of records) {
          recordsProcessed++;
          const text = extractResponseText(rec);
          for (const token of extractTokens(text)) {
            const kind = categorize(token);
            if (kind === 'ticker') {
              tickerCounts.set(token, (tickerCounts.get(token) || 0) + 1);
            } else if (kind === 'candidate') {
              candidateCounts.set(token, (candidateCounts.get(token) || 0) + 1);
            }
          }
        }
      }
    }
  }

  console.log(`Processed ${filesProcessed} files / ${recordsProcessed} records.\n`);

  const sortedCandidates = [...candidateCounts.entries()].sort((a, b) => b[1] - a[1]);
  const sortedTickers = [...tickerCounts.entries()].sort((a, b) => b[1] - a[1]);

  console.log('=== TERM CANDIDATES (uppercase tokens, not tickers, not excluded) ===');
  if (sortedCandidates.length === 0) {
    console.log('(none — either no responses sampled, or all tokens are tickers/excluded)');
  } else {
    for (const [token, count] of sortedCandidates) {
      console.log(`  ${String(count).padStart(4)}  ${token}`);
    }
  }

  console.log('\n=== TOP 20 TICKERS (sanity check — these are filtered out of candidates) ===');
  for (const [token, count] of sortedTickers.slice(0, 20)) {
    console.log(`  ${String(count).padStart(4)}  ${token}`);
  }

  console.log('\n[sample-voice-layer-terms] done. Use the candidate list above to lock the Phase 2.5 starter TERM_UNIVERSE.\n');
}

main().catch((err) => {
  console.error('[sample-voice-layer-terms] fatal:', err);
  process.exit(0);
});
