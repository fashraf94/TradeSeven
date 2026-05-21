#!/usr/bin/env node
// api/scripts/test-voice-layer-phase-1.js
//
// Read-only behavioral test harness for Phase 1 of the Voice Layer Rework
// (mode-aware routing + first-message-on-deploy).
//
// Confirms:
//   V1 — Newly created battles have a chatExchanges entry with
//        messageType === 'first_message'.
//   V2 — That first-message entry has userMessage === null and a
//        non-empty agentResponse.
//   V3 — chatBudgetUsed === 0 on those battles (first message did NOT
//        increment the user's 10-turn budget).
//   V4 — Those battles have a statusFeed entry with action: 'first_message'.
//   V5 — buildVoiceLayerPrompt's signature includes the executionMode parameter.
//   V6 — buildFirstMessagePrompt is exported from voiceLayerPrompt.js.
//
// All Firestore queries are READ-ONLY.
//
// Usage:
//   node --env-file=.env.local api/scripts/test-voice-layer-phase-1.js
//
// Requires env:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//
// Exit code: 0 if no tests failed (passes + skips), 1 if any test failed.
//
// See FANTASYTRADES_VOICE_LAYER_PHASE_1_SPEC.

import { readFileSync } from 'node:fs';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';

const results = []; // { name, status: 'PASS' | 'FAIL' | 'SKIP' }

function record(name, status) {
  results.push({ name, status });
}

function header(title) {
  console.log(title);
}

// ── Shared: fetch the 5 most-recently-created battles ──────────────────────
// V1-V4 all need this set. Cached per-run.
let _recentBattlesCache = null;
async function getRecentBattles(db) {
  if (_recentBattlesCache !== null) return _recentBattlesCache;
  const snap = await db
    .collection('agentBattles')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
  const out = [];
  snap.forEach((doc) => {
    out.push({ id: doc.id, data: doc.data() });
  });
  _recentBattlesCache = out;
  return out;
}

async function testV1(db) {
  const NAME = 'TEST V1: Recently created battles have a first_message exchange';
  header(NAME);
  try {
    const battles = await getRecentBattles(db);

    if (battles.length === 0) {
      console.log('  No battles found in the collection.');
      console.log('RESULT: SKIP (no battles to evaluate)');
      record(NAME, 'SKIP');
      return;
    }

    let allHaveFirstMessage = true;
    battles.forEach(({ id, data }) => {
      const exchanges = Array.isArray(data.chatExchanges) ? data.chatExchanges : [];
      const firstMessage = exchanges.find((ex) => ex && ex.messageType === 'first_message');
      const created = data.createdAt || '(unknown)';
      const marker = firstMessage ? 'OK' : 'MISSING';
      if (!firstMessage) allHaveFirstMessage = false;
      console.log(`  Battle ${id} (created ${created}): first_message [${marker}]`);
    });

    console.log('  Note: this test is only meaningful AFTER the Phase 1 PR has');
    console.log('  merged and at least one new battle has been deployed. Pre-deploy,');
    console.log('  the five most-recent battles will be missing first_message entries.');

    const status = allHaveFirstMessage ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status}`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (query error — see message above)');
    record(NAME, 'FAIL');
  }
}

async function testV2(db) {
  const NAME = 'TEST V2: first_message entries have userMessage:null + non-empty agentResponse';
  header(NAME);
  try {
    const battles = await getRecentBattles(db);

    if (battles.length === 0) {
      console.log('  No battles found.');
      console.log('RESULT: SKIP (no battles to evaluate)');
      record(NAME, 'SKIP');
      return;
    }

    let evaluated = 0;
    let offenders = 0;
    battles.forEach(({ id, data }) => {
      const exchanges = Array.isArray(data.chatExchanges) ? data.chatExchanges : [];
      const fm = exchanges.find((ex) => ex && ex.messageType === 'first_message');
      if (!fm) return;
      evaluated += 1;
      const userOk = fm.userMessage === null;
      const respOk = typeof fm.agentResponse === 'string' && fm.agentResponse.trim().length > 0;
      const userMarker = userOk ? 'OK' : `BAD(${JSON.stringify(fm.userMessage)})`;
      const respMarker = respOk ? `OK(${fm.agentResponse.length} chars)` : 'EMPTY';
      if (!userOk || !respOk) offenders += 1;
      console.log(`  Battle ${id}: userMessage=${userMarker}, agentResponse=${respMarker}`);
    });

    if (evaluated === 0) {
      console.log('  No first_message entries found across the 5 most-recent battles.');
      console.log('RESULT: SKIP (no first_message entries to evaluate — see V1)');
      record(NAME, 'SKIP');
      return;
    }

    const status = offenders === 0 ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status} (evaluated ${evaluated}, offenders ${offenders})`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (query error — see message above)');
    record(NAME, 'FAIL');
  }
}

async function testV3(db) {
  const NAME = 'TEST V3: chatBudgetUsed unchanged after first_message';
  header(NAME);
  try {
    const battles = await getRecentBattles(db);

    if (battles.length === 0) {
      console.log('  No battles found.');
      console.log('RESULT: SKIP (no battles to evaluate)');
      record(NAME, 'SKIP');
      return;
    }

    // A battle that has ONLY a first_message (no user-initiated exchanges yet)
    // must have chatBudgetUsed === 0. If a battle has user-initiated exchanges
    // too, we skip it because we can't isolate the first message's contribution.
    let evaluated = 0;
    let offenders = 0;
    battles.forEach(({ id, data }) => {
      const exchanges = Array.isArray(data.chatExchanges) ? data.chatExchanges : [];
      const hasFirstMessage = exchanges.some((ex) => ex && ex.messageType === 'first_message');
      if (!hasFirstMessage) return;
      const hasUserInitiated = exchanges.some((ex) => {
        if (!ex) return false;
        const type = ex.messageType || (ex.isAutoDebrief ? 'auto_debrief' : 'user_initiated');
        return type === 'user_initiated' && ex.userMessage != null && ex.userMessage !== '__REVIEW_START__';
      });
      if (hasUserInitiated) {
        console.log(`  Battle ${id}: SKIP (has user-initiated exchanges — budget mixed)`);
        return;
      }
      evaluated += 1;
      const budget = data.chatBudgetUsed;
      const ok = budget === 0 || budget == null;
      if (!ok) offenders += 1;
      console.log(`  Battle ${id}: chatBudgetUsed=${budget} [${ok ? 'OK' : 'FAIL'}]`);
    });

    if (evaluated === 0) {
      console.log('  No isolatable first_message battles found.');
      console.log('RESULT: SKIP');
      record(NAME, 'SKIP');
      return;
    }

    const status = offenders === 0 ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status} (evaluated ${evaluated}, offenders ${offenders})`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (query error — see message above)');
    record(NAME, 'FAIL');
  }
}

async function testV4(db) {
  const NAME = "TEST V4: statusFeed entry with action: 'first_message'";
  header(NAME);
  try {
    const battles = await getRecentBattles(db);

    if (battles.length === 0) {
      console.log('  No battles found.');
      console.log('RESULT: SKIP (no battles to evaluate)');
      record(NAME, 'SKIP');
      return;
    }

    let evaluated = 0;
    let offenders = 0;
    battles.forEach(({ id, data }) => {
      const exchanges = Array.isArray(data.chatExchanges) ? data.chatExchanges : [];
      const hasFirstMessage = exchanges.some((ex) => ex && ex.messageType === 'first_message');
      if (!hasFirstMessage) return;
      evaluated += 1;
      const feed = Array.isArray(data.statusFeed) ? data.statusFeed : [];
      const found = feed.some((s) => s && s.action === 'first_message');
      if (!found) offenders += 1;
      console.log(`  Battle ${id}: statusFeed action='first_message' [${found ? 'OK' : 'MISSING'}]`);
    });

    if (evaluated === 0) {
      console.log('  No first_message entries found across the 5 most-recent battles.');
      console.log('RESULT: SKIP (no first_message entries to evaluate — see V1)');
      record(NAME, 'SKIP');
      return;
    }

    const status = offenders === 0 ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status} (evaluated ${evaluated}, offenders ${offenders})`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (query error — see message above)');
    record(NAME, 'FAIL');
  }
}

function testV5() {
  const NAME = 'TEST V5: buildVoiceLayerPrompt signature includes executionMode';
  header(NAME);
  try {
    const src = readFileSync(new URL('../_utils/voiceLayerPrompt.js', import.meta.url), 'utf8');

    // Find the export function buildVoiceLayerPrompt({...}) opening parenthesis
    // and confirm `executionMode` appears in the destructure.
    const fnIdx = src.indexOf('export function buildVoiceLayerPrompt(');
    if (fnIdx === -1) {
      console.log('  Could not find buildVoiceLayerPrompt declaration.');
      console.log('RESULT: FAIL (function not found)');
      record(NAME, 'FAIL');
      return;
    }
    // Scan forward until we hit a `}) {` closing the destructure, then check
    // that `executionMode` appears in between.
    const destructureEnd = src.indexOf('}) {', fnIdx);
    if (destructureEnd === -1) {
      console.log('  Could not find end of destructure pattern.');
      console.log('RESULT: FAIL (destructure pattern not found)');
      record(NAME, 'FAIL');
      return;
    }
    const destructure = src.slice(fnIdx, destructureEnd);
    const hasExecutionMode = /\bexecutionMode\b/.test(destructure);
    console.log(`  Searched destructure span: ${destructure.length} chars`);
    console.log(`  executionMode present: ${hasExecutionMode}`);
    const status = hasExecutionMode ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status}`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (could not read file)');
    record(NAME, 'FAIL');
  }
}

function testV6() {
  const NAME = 'TEST V6: buildFirstMessagePrompt is exported';
  header(NAME);
  try {
    const src = readFileSync(new URL('../_utils/voiceLayerPrompt.js', import.meta.url), 'utf8');
    const m = src.match(/export\s+function\s+buildFirstMessagePrompt\s*\(/);
    const hasExport = !!m;
    console.log(`  Match: ${hasExport ? m[0] : '(none)'}`);
    const status = hasExport ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status}`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (could not read file)');
    record(NAME, 'FAIL');
  }
}

async function main() {
  const HR = '='.repeat(72);
  console.log(HR);
  console.log('Phase 1 Voice Layer Rework — Behavioral Test Harness');
  console.log('Read-only against Firestore + local files. Safe to run anytime.');
  console.log(HR);
  console.log();

  const db = getFirebaseAdmin();

  await testV1(db); console.log();
  await testV2(db); console.log();
  await testV3(db); console.log();
  await testV4(db); console.log();
  testV5();         console.log();
  testV6();         console.log();

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const total = results.length;

  console.log(HR);
  console.log(`OVERALL: ${passed}/${total} tests passed  (failed: ${failed}, skipped: ${skipped})`);
  console.log(HR);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
