#!/usr/bin/env node
// api/scripts/test-voice-layer-phase-2.js
//
// Read-only behavioral test harness for Phase 2 of the Voice Layer Rework
// (trade narration after every executed swap — both Haiku autopilot and
// risk-triggered branches in api/cron/agent-evaluate.js).
//
// Confirms:
//   T1 — Recent battles with executed trades have a matching
//        trade_narration entry in chatExchanges (linked via tradeContext.evaluationId).
//   T2 — trade_narration entries have userMessage === null,
//        messageType === 'trade_narration', a non-empty agentResponse,
//        and a populated tradeContext.
//   T3 — chatBudgetUsed === 0 || null on battles whose chat contains only
//        proactive entries (no user_initiated turns).
//   T4 — Each trade_narration entry has a matching statusFeed entry with
//        action: 'trade_narration'.
//   T5 — When both Haiku-decided and risk-triggered swaps exist in the
//        sample, both produce narrations and tradeContext.provenance
//        correctly distinguishes them. SKIP if only one category is present.
//   T6 — buildTradeNarrationPrompt is exported from voiceLayerPrompt.js.
//   T7 — TRADE_NARRATION_OUTPUT_FORMAT and TRADE_NARRATION_INSTRUCTIONS
//        constants exist in voiceLayerPrompt.js.
//   T8 — generateTradeNarration is exported from voiceLayerTradeNarration.js.
//   T9 — RENDER_CONFIG in AgentChat.jsx includes a trade_narration entry.
//   T10 — isDirectiveActiveOnDay (Fix #4) returns the expected verdict
//         across the full expiry-semantics matrix (end_of_battle,
//         permanent, 3_games active/expired, defensive fallbacks).
//
// All Firestore queries are READ-ONLY.
//
// Usage:
//   node --env-file=.env.local api/scripts/test-voice-layer-phase-2.js
//
// Requires env:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//
// Exit code: 0 if no tests failed (passes + skips), 1 if any test failed.
//
// See FANTASYTRADES_VOICE_LAYER_PHASE_2_SPEC.

import { readFileSync } from 'node:fs';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { isDirectiveActiveOnDay } from '../_utils/directiveUtils.js';

const results = []; // { name, status: 'PASS' | 'FAIL' | 'SKIP' }

function record(name, status) {
  results.push({ name, status });
}

function header(title) {
  console.log(title);
}

// ── Shared: fetch a wider set of recent battles (Phase 2 needs battles ────
// with executed trades, which may not be in the most-recent 5).
let _recentBattlesCache = null;
async function getRecentBattles(db) {
  if (_recentBattlesCache !== null) return _recentBattlesCache;
  const snap = await db
    .collection('agentBattles')
    .orderBy('createdAt', 'desc')
    .limit(15)
    .get();
  const out = [];
  snap.forEach((doc) => {
    out.push({ id: doc.id, data: doc.data() });
  });
  _recentBattlesCache = out;
  return out;
}

function getNarrationsFor(battleData) {
  const exchanges = Array.isArray(battleData.chatExchanges) ? battleData.chatExchanges : [];
  return exchanges.filter((ex) => ex && ex.messageType === 'trade_narration');
}

function getTrades(battleData) {
  return Array.isArray(battleData.trades) ? battleData.trades : [];
}

async function testT1(db) {
  const NAME = 'TEST T1: Battles with executed trades have matching trade_narration entries';
  header(NAME);
  try {
    const battles = await getRecentBattles(db);
    if (battles.length === 0) {
      console.log('  No battles found.');
      console.log('RESULT: SKIP (no battles to evaluate)');
      record(NAME, 'SKIP');
      return;
    }

    let battlesWithTrades = 0;
    let battlesWithMatchedNarrations = 0;
    let unmatchedTrades = 0;

    battles.forEach(({ id, data }) => {
      const trades = getTrades(data);
      if (trades.length === 0) return;
      battlesWithTrades += 1;

      const narrations = getNarrationsFor(data);
      const narrationEvalIds = new Set(
        narrations
          .map((n) => n.tradeContext?.evaluationId)
          .filter(Boolean),
      );

      const tradesWithoutNarration = trades.filter(
        (t) => t.evaluationId && !narrationEvalIds.has(t.evaluationId),
      );
      if (tradesWithoutNarration.length === 0 && narrations.length >= trades.length) {
        battlesWithMatchedNarrations += 1;
      } else {
        unmatchedTrades += tradesWithoutNarration.length;
      }
      console.log(
        `  Battle ${id}: ${trades.length} trade(s), ${narrations.length} narration(s), ` +
        `unmatched ${tradesWithoutNarration.length}`,
      );
    });

    if (battlesWithTrades === 0) {
      console.log('  No battles with executed trades found in the sampled window.');
      console.log('RESULT: SKIP (no executed trades to evaluate)');
      record(NAME, 'SKIP');
      return;
    }

    console.log('  Note: this test is only meaningful AFTER the Phase 2 PR has');
    console.log('  merged and at least one cron tick has executed a swap on a');
    console.log('  battle from the sampled window. Pre-deploy: no narrations exist.');

    const status = unmatchedTrades === 0 && battlesWithMatchedNarrations === battlesWithTrades
      ? 'PASS'
      : 'FAIL';
    console.log(
      `RESULT: ${status} (battles with trades: ${battlesWithTrades}, ` +
      `fully narrated: ${battlesWithMatchedNarrations}, unmatched trades: ${unmatchedTrades})`,
    );
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (query error — see message above)');
    record(NAME, 'FAIL');
  }
}

async function testT2(db) {
  const NAME = 'TEST T2: trade_narration entries are well-formed';
  header(NAME);
  try {
    const battles = await getRecentBattles(db);
    if (battles.length === 0) {
      console.log('  No battles found.');
      console.log('RESULT: SKIP');
      record(NAME, 'SKIP');
      return;
    }

    let evaluated = 0;
    let offenders = 0;

    battles.forEach(({ id, data }) => {
      const narrations = getNarrationsFor(data);
      if (narrations.length === 0) return;
      narrations.forEach((n, i) => {
        evaluated += 1;
        const userOk = n.userMessage === null;
        const typeOk = n.messageType === 'trade_narration';
        const respOk = typeof n.agentResponse === 'string' && n.agentResponse.trim().length > 0;
        const ctx = n.tradeContext || {};
        const ctxOk =
          typeof ctx.symbolOut === 'string' &&
          typeof ctx.symbolIn === 'string' &&
          typeof ctx.tier === 'string' &&
          typeof ctx.evaluationId === 'string' &&
          (ctx.provenance === 'autopilot' || ctx.provenance === 'risk_triggered' ||
            ctx.provenance === 'approved' || ctx.provenance === 'auto_executed_proposal' ||
            ctx.provenance === 'unknown');
        const allOk = userOk && typeOk && respOk && ctxOk;
        if (!allOk) offenders += 1;
        const marker = allOk
          ? 'OK'
          : `BAD(user=${userOk}, type=${typeOk}, resp=${respOk}, ctx=${ctxOk})`;
        console.log(`  Battle ${id} narration[${i}] (${ctx.symbolOut || '?'}→${ctx.symbolIn || '?'}): ${marker}`);
      });
    });

    if (evaluated === 0) {
      console.log('  No trade_narration entries found across sampled battles.');
      console.log('RESULT: SKIP (no narrations to evaluate — see T1)');
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

async function testT3(db) {
  const NAME = 'TEST T3: chatBudgetUsed unchanged after proactive trade_narration';
  header(NAME);
  try {
    const battles = await getRecentBattles(db);
    if (battles.length === 0) {
      console.log('  No battles found.');
      console.log('RESULT: SKIP');
      record(NAME, 'SKIP');
      return;
    }

    let evaluated = 0;
    let offenders = 0;

    battles.forEach(({ id, data }) => {
      const exchanges = Array.isArray(data.chatExchanges) ? data.chatExchanges : [];
      const hasNarration = exchanges.some((ex) => ex && ex.messageType === 'trade_narration');
      if (!hasNarration) return;

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
      console.log('  No isolatable trade_narration battles found.');
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

async function testT4(db) {
  const NAME = "TEST T4: statusFeed entry with action: 'trade_narration' for each narration";
  header(NAME);
  try {
    const battles = await getRecentBattles(db);
    if (battles.length === 0) {
      console.log('  No battles found.');
      console.log('RESULT: SKIP');
      record(NAME, 'SKIP');
      return;
    }

    let evaluated = 0;
    let offenders = 0;

    battles.forEach(({ id, data }) => {
      const narrations = getNarrationsFor(data);
      if (narrations.length === 0) return;
      const feed = Array.isArray(data.statusFeed) ? data.statusFeed : [];
      const narrationFeedEntries = feed.filter((s) => s && s.action === 'trade_narration');
      evaluated += 1;
      const ok = narrationFeedEntries.length >= narrations.length;
      if (!ok) offenders += 1;
      console.log(
        `  Battle ${id}: narrations=${narrations.length}, ` +
        `statusFeed.trade_narration=${narrationFeedEntries.length} [${ok ? 'OK' : 'MISSING'}]`,
      );
    });

    if (evaluated === 0) {
      console.log('  No narrations found across sampled battles.');
      console.log('RESULT: SKIP (no narrations to evaluate — see T1)');
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

async function testT5(db) {
  const NAME = 'TEST T5: provenance correctly distinguishes Haiku vs risk-triggered swaps';
  header(NAME);
  try {
    const battles = await getRecentBattles(db);
    if (battles.length === 0) {
      console.log('  No battles found.');
      console.log('RESULT: SKIP');
      record(NAME, 'SKIP');
      return;
    }

    let haikuNarrations = 0;
    let riskNarrations = 0;
    let misclassified = 0;

    battles.forEach(({ id, data }) => {
      const narrations = getNarrationsFor(data);
      const trades = getTrades(data);
      narrations.forEach((n) => {
        const ctx = n.tradeContext || {};
        const evalId = ctx.evaluationId || '';
        const provenance = ctx.provenance || '';
        const matchingTrade = trades.find((t) => t.evaluationId === evalId);
        // Authoritative discriminator: trade.evaluationId.startsWith('risk_')
        // implies provenance should be 'risk_triggered'.
        const isRiskFromEvalId = matchingTrade && typeof matchingTrade.evaluationId === 'string'
          && matchingTrade.evaluationId.startsWith('risk_');
        if (isRiskFromEvalId) {
          riskNarrations += 1;
          if (provenance !== 'risk_triggered') {
            misclassified += 1;
            console.log(
              `  Battle ${id}: risk trade ${evalId} narrated with provenance="${provenance}" (expected risk_triggered)`,
            );
          }
        } else if (matchingTrade) {
          haikuNarrations += 1;
          if (provenance !== 'autopilot' && provenance !== 'approved' && provenance !== 'auto_executed_proposal') {
            misclassified += 1;
            console.log(
              `  Battle ${id}: non-risk trade ${evalId} narrated with provenance="${provenance}" (expected autopilot/approved/auto_executed_proposal)`,
            );
          }
        }
      });
    });

    console.log(`  Haiku-derived narrations: ${haikuNarrations}`);
    console.log(`  Risk-triggered narrations: ${riskNarrations}`);

    if (haikuNarrations === 0 || riskNarrations === 0) {
      console.log('  Need at least one narration of each provenance type in the sampled window.');
      console.log('RESULT: SKIP (insufficient mixed-provenance sample)');
      record(NAME, 'SKIP');
      return;
    }

    const status = misclassified === 0 ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status} (misclassified ${misclassified})`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (query error — see message above)');
    record(NAME, 'FAIL');
  }
}

function testT6() {
  const NAME = 'TEST T6: buildTradeNarrationPrompt is exported';
  header(NAME);
  try {
    const src = readFileSync(new URL('../_utils/voiceLayerPrompt.js', import.meta.url), 'utf8');
    const m = src.match(/export\s+function\s+buildTradeNarrationPrompt\s*\(/);
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

function testT7() {
  const NAME = 'TEST T7: TRADE_NARRATION_OUTPUT_FORMAT and _INSTRUCTIONS constants exist';
  header(NAME);
  try {
    const src = readFileSync(new URL('../_utils/voiceLayerPrompt.js', import.meta.url), 'utf8');
    const hasFormat = /\bTRADE_NARRATION_OUTPUT_FORMAT\b/.test(src);
    const hasInstructions = /\bTRADE_NARRATION_INSTRUCTIONS\b/.test(src);
    console.log(`  TRADE_NARRATION_OUTPUT_FORMAT present: ${hasFormat}`);
    console.log(`  TRADE_NARRATION_INSTRUCTIONS present: ${hasInstructions}`);
    const status = hasFormat && hasInstructions ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status}`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (could not read file)');
    record(NAME, 'FAIL');
  }
}

function testT8() {
  const NAME = 'TEST T8: generateTradeNarration is exported from voiceLayerTradeNarration.js';
  header(NAME);
  try {
    const src = readFileSync(
      new URL('../_utils/voiceLayerTradeNarration.js', import.meta.url),
      'utf8',
    );
    const m = src.match(/export\s+async\s+function\s+generateTradeNarration\s*\(/);
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

function testT9() {
  const NAME = "TEST T9: RENDER_CONFIG includes trade_narration entry";
  header(NAME);
  try {
    const src = readFileSync(
      new URL('../../src/components/Agent/AgentChat.jsx', import.meta.url),
      'utf8',
    );
    const m = src.match(/trade_narration\s*:\s*\{[^}]*\}/);
    const hasEntry = !!m;
    console.log(`  Match: ${hasEntry ? m[0] : '(none)'}`);
    const status = hasEntry ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status}`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (could not read file)');
    record(NAME, 'FAIL');
  }
}

// T10 — Pure unit-style tests for the directive expiry helper (Fix #4).
// No Firestore, no clock dependency — uses the isDirectiveActiveOnDay
// pure function with explicit currentDay values.
function testT10() {
  const NAME = 'TEST T10: isDirectiveActiveOnDay handles all expiry semantics';
  header(NAME);
  try {
    // A representative tradingDays array. 5-day battle Mon-Fri.
    const tradingDays = ['2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22'];

    const baseDirective = {
      text: 'rotate to high-beta semis',
      directiveThreadId: 'dir_abc',
      createdAt: '2026-05-18T16:30:00Z', // day 1 (Mon at 4:30 PM ET-ish)
    };

    const cases = [
      // Always-active expiry values
      { label: 'end_of_battle active',
        directive: { ...baseDirective, expiry: 'end_of_battle' }, currentDay: 5, expected: true },
      { label: 'permanent active',
        directive: { ...baseDirective, expiry: 'permanent' }, currentDay: 5, expected: true },
      { label: 'expiry missing defaults to end_of_battle',
        directive: { text: baseDirective.text, directiveThreadId: 'dir_x', createdAt: '2026-05-18T12:00:00Z' },
        currentDay: 5, expected: true },

      // 3_games — the load-bearing case
      { label: '3_games same day (elapsed=0)',
        directive: { ...baseDirective, expiry: '3_games' }, currentDay: 1, expected: true },
      { label: '3_games next day (elapsed=1)',
        directive: { ...baseDirective, expiry: '3_games' }, currentDay: 2, expected: true },
      { label: '3_games last active day (elapsed=2)',
        directive: { ...baseDirective, expiry: '3_games' }, currentDay: 3, expected: true },
      { label: '3_games first expired day (elapsed=3)',
        directive: { ...baseDirective, expiry: '3_games' }, currentDay: 4, expected: false },
      { label: '3_games well-expired (elapsed=4)',
        directive: { ...baseDirective, expiry: '3_games' }, currentDay: 5, expected: false },

      // Defensive fallbacks
      { label: 'malformed: directive null',
        directive: null, currentDay: 1, expected: false },
      { label: 'malformed: directive not object',
        directive: 'not-an-object', currentDay: 1, expected: false },
      { label: 'malformed: missing text',
        directive: { directiveThreadId: 'dir_x', expiry: 'end_of_battle' }, currentDay: 1, expected: false },
      { label: 'malformed: missing directiveThreadId',
        directive: { text: 'foo', expiry: 'end_of_battle' }, currentDay: 1, expected: false },
      { label: 'defensive: 3_games missing createdAt → active',
        directive: { text: 'foo', directiveThreadId: 'dir_x', expiry: '3_games' }, currentDay: 5, expected: true },
      { label: 'defensive: 3_games createdAt outside tradingDays → active',
        directive: { ...baseDirective, expiry: '3_games', createdAt: '2026-05-17T12:00:00Z' },
        currentDay: 5, expected: true },
      { label: 'defensive: unknown expiry value → active',
        directive: { ...baseDirective, expiry: 'forever_and_ever' }, currentDay: 5, expected: true },
    ];

    let offenders = 0;
    cases.forEach((c) => {
      const got = isDirectiveActiveOnDay(c.directive, tradingDays, c.currentDay);
      const ok = got === c.expected;
      if (!ok) offenders += 1;
      console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${c.label}: got=${got} expected=${c.expected}`);
    });

    const status = offenders === 0 ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status} (${cases.length - offenders}/${cases.length} cases passed)`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (helper threw)');
    record(NAME, 'FAIL');
  }
}

async function main() {
  const HR = '='.repeat(72);
  console.log(HR);
  console.log('Phase 2 Voice Layer Rework — Behavioral Test Harness');
  console.log('Read-only against Firestore + local files. Safe to run anytime.');
  console.log(HR);
  console.log();

  const db = getFirebaseAdmin();

  await testT1(db); console.log();
  await testT2(db); console.log();
  await testT3(db); console.log();
  await testT4(db); console.log();
  await testT5(db); console.log();
  testT6();         console.log();
  testT7();         console.log();
  testT8();         console.log();
  testT9();         console.log();
  testT10();        console.log();

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
