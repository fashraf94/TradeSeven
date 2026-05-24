#!/usr/bin/env node
// api/scripts/test-voice-layer-phase-2-5.js
//
// Read-only behavioral test harness for Phase 2.5 of the Voice Layer Rework
// (clickable financial-term modals in chat, plus prompt-side awareness so
// Gemma's vocabulary biases toward terms with backing modals).
//
// Confirms:
//   TM1 — AgentChat.jsx renders ticker and term highlights with distinct
//         accent colors (#5EEAD4 teal for tickers, #f59e0b amber for terms).
//   TM2 — TermResearchModal.jsx exists and exports a default function.
//   TM3 — SUPPORTED_TERMS reference block appears in both buildFirstMessagePrompt
//         and buildTradeNarrationPrompt function bodies. (Source slice — not a
//         runtime call, so the assertion is static text presence.)
//   TM4 — api/_utils/termUniverse.js exports TERM_TOKENS as a string array
//         of length 10-20, with every entry matching /^[A-Z]{2,5}$/.
//   TM5 — src/data/termUniverse.js carries full definition content for each
//         term: displayName, category, and four definition keys (whatItIs,
//         whyItMatters, howTradersUse, example).
//   TM6 — Frontend and backend TERM_UNIVERSE key sets are identical
//         (drift check) AND no term token collides with ALL_TICKERS
//         (so the chat highlighter's ticker→term branch order is unambiguous).
//
// All checks are static (file reads). No Firestore, no network, no env vars
// required. Safe to run anytime.
//
// Usage:
//   node api/scripts/test-voice-layer-phase-2-5.js
//
// Exit code: 0 if no tests failed (passes + skips), 1 if any test failed.
//
// See FANTASYTRADES_VOICE_LAYER_PHASE_2_5_SPEC.

import { readFileSync } from 'node:fs';
import { ALL_TICKERS } from '../_utils/rankingConfig.js';

const results = []; // { name, status: 'PASS' | 'FAIL' | 'SKIP' }

function record(name, status) {
  results.push({ name, status });
}

function header(title) {
  console.log(title);
}

function readSource(relPath) {
  return readFileSync(new URL(relPath, import.meta.url), 'utf8');
}

// Regex used to extract token keys from both termUniverse files. Both files
// keep their token keys on dedicated lines (`  VWAP: ...,` backend and
// `  VWAP: {` frontend), and the LINTED-BY comment at the top of each file
// flags the line format as load-bearing for this test.
const TOKEN_KEY_REGEX = /^\s*([A-Z]{2,5})\s*:/gm;

function extractTokenKeys(src) {
  const out = [];
  for (const m of src.matchAll(TOKEN_KEY_REGEX)) {
    out.push(m[1]);
  }
  return out.sort();
}

function testTM1() {
  const NAME = 'TEST TM1: Chat highlighter uses distinct accents for tickers and terms';
  header(NAME);
  try {
    // Phase 4: renderMessageWithEntities + accents + TERM_TOKENS_SET were extracted from
    // AgentChat.jsx to src/utils/renderMessageWithEntities.jsx for reuse by FilmRoomChat.
    // The source of truth is now the util; AgentChat is a consumer via import.
    const utilSrc = readSource('../../src/utils/renderMessageWithEntities.jsx');
    const consumerSrc = readSource('../../src/components/Agent/AgentChat.jsx');

    const hasTickerAccent = utilSrc.includes('#5EEAD4');
    const hasTermAccent = utilSrc.includes('#f59e0b');
    const hasTermImport = /TERM_TOKENS_SET/.test(utilSrc);
    const consumerImports = /renderMessageWithEntities/.test(consumerSrc);

    console.log(`  ticker accent (#5EEAD4) in util:    ${hasTickerAccent}`);
    console.log(`  term accent   (#f59e0b) in util:    ${hasTermAccent}`);
    console.log(`  util imports TERM_TOKENS_SET:       ${hasTermImport}`);
    console.log(`  AgentChat imports the util:         ${consumerImports}`);

    const ok = hasTickerAccent && hasTermAccent && hasTermImport && consumerImports;
    console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`);
    record(NAME, ok ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

function testTM2() {
  const NAME = 'TEST TM2: TermResearchModal exists and exports default';
  header(NAME);
  try {
    const src = readSource('../../src/components/shared/TermResearchModal.jsx');
    const ok = /export default function TermResearchModal/.test(src);
    console.log(`  exports default function TermResearchModal: ${ok}`);
    console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`);
    record(NAME, ok ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

function testTM3() {
  const NAME = 'TEST TM3: SUPPORTED_TERMS block appears in both prompt builders';
  header(NAME);
  try {
    const src = readSource('../_utils/voiceLayerPrompt.js');

    // Slice the source into the two prompt builder bodies and look for the
    // block builder call inside each. The builder name is the load-bearing
    // signal — `buildSupportedTermsBlock(supportedTerms)` must appear in
    // each function body.
    function sliceBetween(haystack, startMarker, endMarker) {
      const start = haystack.indexOf(startMarker);
      if (start === -1) return '';
      const remainder = haystack.slice(start);
      const end = remainder.indexOf(endMarker);
      if (end === -1) return remainder;
      return remainder.slice(0, end);
    }

    const firstMsgBody = sliceBetween(
      src,
      'export function buildFirstMessagePrompt',
      '\n}\n',
    );
    const tradeBody = sliceBetween(
      src,
      'export function buildTradeNarrationPrompt',
      '\n}\n',
    );

    const inFirstMsg = /buildSupportedTermsBlock\s*\(\s*supportedTerms\s*\)/.test(firstMsgBody);
    const inTrade    = /buildSupportedTermsBlock\s*\(\s*supportedTerms\s*\)/.test(tradeBody);

    console.log(`  buildFirstMessagePrompt invokes buildSupportedTermsBlock: ${inFirstMsg}`);
    console.log(`  buildTradeNarrationPrompt invokes buildSupportedTermsBlock: ${inTrade}`);

    const ok = inFirstMsg && inTrade;
    console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`);
    record(NAME, ok ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

async function testTM4() {
  const NAME = 'TEST TM4: api/_utils/termUniverse.js exports TERM_TOKENS as a valid token array';
  header(NAME);
  try {
    const mod = await import('../_utils/termUniverse.js');
    const tokens = mod.TERM_TOKENS;

    const isArray = Array.isArray(tokens);
    const okLength = isArray && tokens.length >= 10 && tokens.length <= 20;
    const allStrings = isArray && tokens.every((t) => typeof t === 'string');
    const allMatchPattern = isArray && tokens.every((t) => /^[A-Z]{2,5}$/.test(t));

    console.log(`  TERM_TOKENS is array: ${isArray}`);
    console.log(`  length in [10,20] (got ${isArray ? tokens.length : 'n/a'}): ${okLength}`);
    console.log(`  all strings: ${allStrings}`);
    console.log(`  all match /^[A-Z]{2,5}$/: ${allMatchPattern}`);

    const ok = isArray && okLength && allStrings && allMatchPattern;
    console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`);
    record(NAME, ok ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

function testTM5() {
  const NAME = 'TEST TM5: src/data/termUniverse.js carries full content per term';
  header(NAME);
  try {
    const src = readSource('../../src/data/termUniverse.js');
    const tokens = extractTokenKeys(src);

    const requiredKeys = ['displayName', 'category', 'whatItIs', 'whyItMatters', 'howTradersUse', 'example'];
    const missing = [];

    for (const token of tokens) {
      // Find the entry block for this token (from its declaration to the
      // next closing brace at the same indent). Pure text scan — simple and
      // robust enough for the on-disk shape we control.
      const entryStart = src.indexOf(`  ${token}:`);
      if (entryStart === -1) continue;
      // Take a generous slice to scan for the four-section payload.
      const entrySlice = src.slice(entryStart, entryStart + 4000);
      for (const key of requiredKeys) {
        if (!entrySlice.includes(`${key}:`)) {
          missing.push(`${token}.${key}`);
        }
      }
    }

    console.log(`  tokens scanned: ${tokens.length}`);
    if (missing.length > 0) {
      console.log(`  MISSING: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` (+${missing.length - 10} more)` : ''}`);
    }

    const ok = tokens.length >= 10 && missing.length === 0;
    console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`);
    record(NAME, ok ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

function testTM6() {
  const NAME = 'TEST TM6: Frontend/backend TERM_UNIVERSE sync + ticker collision check';
  header(NAME);
  try {
    const backendSrc  = readSource('../_utils/termUniverse.js');
    const frontendSrc = readSource('../../src/data/termUniverse.js');

    const backendKeys  = extractTokenKeys(backendSrc);
    const frontendKeys = extractTokenKeys(frontendSrc);

    const onlyInBackend  = backendKeys.filter((k) => !frontendKeys.includes(k));
    const onlyInFrontend = frontendKeys.filter((k) => !backendKeys.includes(k));
    const synced = onlyInBackend.length === 0 && onlyInFrontend.length === 0;

    console.log(`  backend tokens  (${backendKeys.length}): ${backendKeys.join(', ')}`);
    console.log(`  frontend tokens (${frontendKeys.length}): ${frontendKeys.join(', ')}`);
    if (!synced) {
      if (onlyInBackend.length > 0)  console.log(`  ONLY IN BACKEND:  ${onlyInBackend.join(', ')}`);
      if (onlyInFrontend.length > 0) console.log(`  ONLY IN FRONTEND: ${onlyInFrontend.join(', ')}`);
    }

    const tickerSet = new Set(ALL_TICKERS);
    const collisions = backendKeys.filter((k) => tickerSet.has(k));
    if (collisions.length > 0) {
      console.log(`  TICKER COLLISIONS: ${collisions.join(', ')}`);
    } else {
      console.log(`  ticker collisions with ALL_TICKERS: none`);
    }

    const ok = synced && collisions.length === 0;
    console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`);
    record(NAME, ok ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

async function main() {
  const HR = '='.repeat(72);
  console.log(HR);
  console.log('Phase 2.5 Voice Layer Rework — Behavioral Test Harness');
  console.log('Read-only static checks against the working tree. Safe to run anytime.');
  console.log(HR);
  console.log();

  testTM1();         console.log();
  testTM2();         console.log();
  testTM3();         console.log();
  await testTM4();   console.log();
  testTM5();         console.log();
  testTM6();         console.log();

  const passed  = results.filter((r) => r.status === 'PASS').length;
  const failed  = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const total   = results.length;

  console.log(HR);
  console.log(`OVERALL: ${passed}/${total} tests passed  (failed: ${failed}, skipped: ${skipped})`);
  console.log(HR);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
