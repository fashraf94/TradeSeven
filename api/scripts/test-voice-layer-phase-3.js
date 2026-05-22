#!/usr/bin/env node
// api/scripts/test-voice-layer-phase-3.js
//
// Read-only behavioral test harness for Phase 3 of the Voice Layer Rework
// (anticipation messages — Gemma's coach-dominant pre-action chat output
// when Haiku populates anticipationCandidates on its structured eval
// output).
//
// Confirms:
//   A1 — Recent battles that contain anticipation entries in chatExchanges
//        have those entries cleanly linked back to a Haiku evaluation
//        via anticipationContext.evaluationId. SKIP if no anticipation
//        entries are present in the sampled window (e.g., pre-deploy, or
//        Haiku has been judiciously quiet).
//   A2 — anticipation entries have userMessage === null,
//        messageType === 'anticipation', anticipationSource === 'haiku',
//        a non-empty agentResponse, and a populated anticipationContext
//        with symbol + direction + threshold fields.
//   A3 — chatBudgetUsed === 0 || null on battles whose chat contains
//        only proactive entries (no user_initiated turns) AND at least
//        one anticipation. This confirms anticipation does NOT consume
//        the user's 10-turn chat budget.
//   A4 — NO statusFeed entry with action: 'anticipation' exists on any
//        sampled battle. This confirms the "no command dot for
//        anticipation" decision (§2 Decision 6 / §4.6).
//   A5 — buildAnticipationPrompt is exported from voiceLayerPrompt.js.
//   A6 — ANTICIPATION_OUTPUT_FORMAT and ANTICIPATION_INSTRUCTIONS
//        constants exist in voiceLayerPrompt.js.
//   A7 — generateAnticipation is exported from voiceLayerAnticipation.js.
//   A8 — RENDER_CONFIG in AgentChat.jsx includes an anticipation entry.
//   A9 — TRADE_DECISION_TOOL in agentEvalToolSchema.js declares the
//        optional anticipationCandidates array field.
//
// All Firestore queries are READ-ONLY.
//
// Usage:
//   node --env-file=.env.local api/scripts/test-voice-layer-phase-3.js
//
// Requires env:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//
// Exit code: 0 if no tests failed (passes + skips), 1 if any test failed.
//
// See FANTASYTRADES_VOICE_LAYER_PHASE_3_SPEC.

import { readFileSync } from 'node:fs';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';

const results = []; // { name, status: 'PASS' | 'FAIL' | 'SKIP' }

function record(name, status) {
  results.push({ name, status });
}

function header(title) {
  console.log(title);
}

// Phase 3 anticipation is the rarest proactive surface (state-transition
// gated, default-quiet). Sample a wider window than Phase 1 to give
// post-deploy runs a chance to find entries.
let _recentBattlesCache = null;
async function getRecentBattles(db) {
  if (_recentBattlesCache !== null) return _recentBattlesCache;
  const snap = await db
    .collection('agentBattles')
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();
  const out = [];
  snap.forEach((doc) => {
    out.push({ id: doc.id, data: doc.data() });
  });
  _recentBattlesCache = out;
  return out;
}

function getAnticipationsFor(battleData) {
  const exchanges = Array.isArray(battleData.chatExchanges) ? battleData.chatExchanges : [];
  return exchanges.filter((ex) => ex && ex.messageType === 'anticipation');
}

function getEvaluations(battleData) {
  return Array.isArray(battleData.evaluations) ? battleData.evaluations : [];
}

async function testA1(db) {
  const NAME = 'TEST A1: anticipation entries link cleanly to a Haiku evaluation';
  header(NAME);
  try {
    const battles = await getRecentBattles(db);
    if (battles.length === 0) {
      console.log('  No battles found.');
      console.log('RESULT: SKIP (no battles to evaluate)');
      record(NAME, 'SKIP');
      return;
    }

    let totalAnticipations = 0;
    let unlinked = 0;

    battles.forEach(({ id, data }) => {
      const anticipations = getAnticipationsFor(data);
      if (anticipations.length === 0) return;

      const evaluations = getEvaluations(data);
      // Pre-deploy, evaluations may not carry an evalId field; the
      // anticipationContext.evaluationId we wrote is the cron's
      // `eval_NNN` identifier. We treat the cross-reference as best-effort:
      // a missing evalId on the cron side does NOT fail the test (different
      // schema vintages). What we DO require: each anticipation entry
      // states a non-null evaluationId in its context, even if we can't
      // re-find it in the evaluations array.
      anticipations.forEach((a, i) => {
        totalAnticipations += 1;
        const ctx = a.anticipationContext || {};
        const hasEvalId = typeof ctx.evaluationId === 'string' && ctx.evaluationId.length > 0;
        if (!hasEvalId) {
          unlinked += 1;
          console.log(
            `  Battle ${id} anticipation[${i}] (${ctx.symbol || '?'}): MISSING anticipationContext.evaluationId`,
          );
        } else {
          // Best-effort match — log whether we can re-find the eval.
          const evalIds = evaluations.map((e) => e?.id || e?.evalId).filter(Boolean);
          const linkable = evalIds.includes(ctx.evaluationId) ? 'linked' : 'orphan(ok)';
          console.log(
            `  Battle ${id} anticipation[${i}] (${ctx.symbol || '?'}) evalId=${ctx.evaluationId} [${linkable}]`,
          );
        }
      });
    });

    if (totalAnticipations === 0) {
      console.log('  No anticipation entries found across sampled battles.');
      console.log('RESULT: SKIP (pre-deploy or Haiku has not flagged anticipation candidates yet)');
      record(NAME, 'SKIP');
      return;
    }

    const status = unlinked === 0 ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status} (anticipations ${totalAnticipations}, unlinked ${unlinked})`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (query error — see message above)');
    record(NAME, 'FAIL');
  }
}

async function testA2(db) {
  const NAME = 'TEST A2: anticipation entries are well-formed';
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
      const anticipations = getAnticipationsFor(data);
      if (anticipations.length === 0) return;
      anticipations.forEach((a, i) => {
        evaluated += 1;
        const userOk = a.userMessage === null;
        const typeOk = a.messageType === 'anticipation';
        const sourceOk = a.anticipationSource === 'haiku';
        const respOk = typeof a.agentResponse === 'string' && a.agentResponse.trim().length > 0;
        const ctx = a.anticipationContext || {};
        const ctxOk =
          typeof ctx.symbol === 'string' &&
          ctx.symbol.length > 0 &&
          (ctx.direction === 'potential_entry' || ctx.direction === 'potential_exit' || ctx.direction === null) &&
          (typeof ctx.threshold === 'string' || ctx.threshold === null);
        const allOk = userOk && typeOk && sourceOk && respOk && ctxOk;
        if (!allOk) offenders += 1;
        const marker = allOk
          ? 'OK'
          : `BAD(user=${userOk}, type=${typeOk}, source=${sourceOk}, resp=${respOk}, ctx=${ctxOk})`;
        console.log(`  Battle ${id} anticipation[${i}] (${ctx.symbol || '?'} ${ctx.direction || '?'}): ${marker}`);
      });
    });

    if (evaluated === 0) {
      console.log('  No anticipation entries found across sampled battles.');
      console.log('RESULT: SKIP (no anticipations to evaluate — see A1)');
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

async function testA3(db) {
  const NAME = 'TEST A3: chatBudgetUsed unchanged after proactive anticipation';
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
      const hasAnticipation = exchanges.some((ex) => ex && ex.messageType === 'anticipation');
      if (!hasAnticipation) return;

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
      console.log('  No isolatable anticipation-only battles found.');
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

async function testA4(db) {
  const NAME = "TEST A4: NO statusFeed entry with action: 'anticipation' (command-dot non-fire)";
  header(NAME);
  try {
    const battles = await getRecentBattles(db);
    if (battles.length === 0) {
      console.log('  No battles found.');
      console.log('RESULT: SKIP');
      record(NAME, 'SKIP');
      return;
    }

    let battlesChecked = 0;
    let offenders = 0;

    battles.forEach(({ id, data }) => {
      battlesChecked += 1;
      const feed = Array.isArray(data.statusFeed) ? data.statusFeed : [];
      const anticipationFeedEntries = feed.filter((s) => s && s.action === 'anticipation');
      if (anticipationFeedEntries.length > 0) {
        offenders += 1;
        console.log(
          `  Battle ${id}: FAIL — found ${anticipationFeedEntries.length} statusFeed entry/entries with action='anticipation' (would fire command dot)`,
        );
      } else {
        // Suppress per-battle OK noise unless we found at least one
        // anticipation in chatExchanges, which makes the absence in
        // statusFeed a meaningful confirmation.
        const anticipations = getAnticipationsFor(data);
        if (anticipations.length > 0) {
          console.log(
            `  Battle ${id}: OK (${anticipations.length} anticipation chat entries, 0 statusFeed entries — command dot suppressed as intended)`,
          );
        }
      }
    });

    if (battlesChecked === 0) {
      console.log('  No battles checked.');
      console.log('RESULT: SKIP');
      record(NAME, 'SKIP');
      return;
    }

    const status = offenders === 0 ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status} (battles checked ${battlesChecked}, offenders ${offenders})`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (query error — see message above)');
    record(NAME, 'FAIL');
  }
}

function testA5() {
  const NAME = 'TEST A5: buildAnticipationPrompt is exported from voiceLayerPrompt.js';
  header(NAME);
  try {
    const src = readFileSync(new URL('../_utils/voiceLayerPrompt.js', import.meta.url), 'utf8');
    const m = src.match(/export\s+function\s+buildAnticipationPrompt\s*\(/);
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

function testA6() {
  const NAME = 'TEST A6: ANTICIPATION_OUTPUT_FORMAT and ANTICIPATION_INSTRUCTIONS constants exist';
  header(NAME);
  try {
    const src = readFileSync(new URL('../_utils/voiceLayerPrompt.js', import.meta.url), 'utf8');
    const hasFormat = /\bANTICIPATION_OUTPUT_FORMAT\b/.test(src);
    const hasInstructions = /\bANTICIPATION_INSTRUCTIONS\b/.test(src);
    console.log(`  ANTICIPATION_OUTPUT_FORMAT present: ${hasFormat}`);
    console.log(`  ANTICIPATION_INSTRUCTIONS present: ${hasInstructions}`);
    const status = hasFormat && hasInstructions ? 'PASS' : 'FAIL';
    console.log(`RESULT: ${status}`);
    record(NAME, status);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL (could not read file)');
    record(NAME, 'FAIL');
  }
}

function testA7() {
  const NAME = 'TEST A7: generateAnticipation is exported from voiceLayerAnticipation.js';
  header(NAME);
  try {
    const src = readFileSync(
      new URL('../_utils/voiceLayerAnticipation.js', import.meta.url),
      'utf8',
    );
    const m = src.match(/export\s+async\s+function\s+generateAnticipation\s*\(/);
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

function testA8() {
  const NAME = 'TEST A8: RENDER_CONFIG includes anticipation entry';
  header(NAME);
  try {
    const src = readFileSync(
      new URL('../../src/components/Agent/AgentChat.jsx', import.meta.url),
      'utf8',
    );
    const m = src.match(/anticipation\s*:\s*\{[^}]*\}/);
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

function testA9() {
  const NAME = 'TEST A9: TRADE_DECISION_TOOL declares anticipationCandidates field';
  header(NAME);
  try {
    const src = readFileSync(
      new URL('../_utils/agentEvalToolSchema.js', import.meta.url),
      'utf8',
    );
    // The schema declares the property name and shape. We check for both
    // the property declaration and the required sub-fields list, since
    // an empty stub would pass a name-only grep.
    const hasField = /\banticipationCandidates\s*:\s*\{/.test(src);
    const hasRequiredSubfields = /required:\s*\['symbol',\s*'direction',\s*'signalSummary',\s*'threshold'\]/.test(src);
    console.log(`  anticipationCandidates declaration present: ${hasField}`);
    console.log(`  required sub-fields list present: ${hasRequiredSubfields}`);
    const status = hasField && hasRequiredSubfields ? 'PASS' : 'FAIL';
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
  console.log('Phase 3 Voice Layer Rework — Behavioral Test Harness');
  console.log('Read-only against Firestore + local files. Safe to run anytime.');
  console.log(HR);
  console.log();

  const db = getFirebaseAdmin();

  await testA1(db); console.log();
  await testA2(db); console.log();
  await testA3(db); console.log();
  await testA4(db); console.log();
  testA5();         console.log();
  testA6();         console.log();
  testA7();         console.log();
  testA8();         console.log();
  testA9();         console.log();

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
