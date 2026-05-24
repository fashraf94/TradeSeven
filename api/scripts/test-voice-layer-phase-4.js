#!/usr/bin/env node
// api/scripts/test-voice-layer-phase-4.js
//
// Read-only behavioral test harness for Phase 4 of the Voice Layer Rework
// (Film Room — the post-battle review surface that mounts the existing
// review-mode chat infrastructure on a dedicated screen).
//
// Confirms:
//   F1  — FilmRoomScreen.jsx exists and exports default.
//   F2  — DayPicker.jsx hides itself when tradingDays.length <= 1
//         (single-day battle convention).
//   F3  — dayOf helper exists, maps to a 1-based trading-day index from a
//         YYYY-MM-DD ET tradingDays array, and returns null for
//         missing/out-of-range timestamps. Plus filterTradesByDay obeys
//         swapDay with a dayOf-based fallback for trades missing swapDay.
//   F4  — computeDayScore.js exports computeDayScore (badge points from
//         scoreState.dailyScores + summed lockedPoints from trades).
//   F5  — AutoDebriefHero.jsx selects chatExchanges by
//         messageType === 'auto_debrief' (or isAutoDebrief fallback).
//   F6  — buildVoiceLayerPrompt's review-mode branch still exists in
//         api/_utils/voiceLayerPrompt.js (pre-existing infrastructure
//         the screen relies on).
//   F7  — FilmRoomChat.jsx references reviewBudgetUsed and posts an
//         explicit mode:'review' field to /api/agent/chat.
//   F8  — Entry points exist: FilmRoomBanner mounted on
//         AgentBattleScreen, and a Review button + onOpenFilmRoom
//         callback on BattleHistoryScreen.
//   F9  — FilmRoomScreen imports and mounts both TermResearchModal
//         and AssetResearchModal (the ticker/term click destinations).
//   F10 — api/agent/chat.js accepts an explicit `mode` parameter, only
//         honors 'review' as an override (defensive validation), and
//         the battle-not-active block is mode-aware (review mode is
//         valid on completed battles).
//
// All checks are static (file reads + small inline shape evaluations).
// No Firestore, no network, no env vars required.
//
// Usage:
//   node api/scripts/test-voice-layer-phase-4.js
//
// Exit code: 0 if no tests failed (passes + skips), 1 if any test failed.

import { readFileSync } from 'node:fs';

const results = [];

function record(name, status) {
  results.push({ name, status });
}

function header(title) {
  console.log(title);
}

function readSource(relPath) {
  return readFileSync(new URL(relPath, import.meta.url), 'utf8');
}

function testF1() {
  const NAME = 'TEST F1: FilmRoomScreen.jsx exists and exports default';
  header(NAME);
  try {
    const src = readSource('../../src/screens/FilmRoomScreen.jsx');
    const ok = /export default function FilmRoomScreen/.test(src);
    console.log(`  exports default function FilmRoomScreen: ${ok}`);
    console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`);
    record(NAME, ok ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

function testF2() {
  const NAME = 'TEST F2: DayPicker hides when tradingDays.length <= 1';
  header(NAME);
  try {
    const src = readSource('../../src/components/FilmRoom/DayPicker.jsx');
    // Defensive: a return statement that fires when length is 1 (or less).
    const hasGuard = /tradingDays\.length\s*<=?\s*1[^.]*return\s+null/s.test(src);
    console.log(`  early-return on single-day battle: ${hasGuard}`);
    console.log(`RESULT: ${hasGuard ? 'PASS' : 'FAIL'}`);
    record(NAME, hasGuard ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

async function testF3() {
  const NAME = 'TEST F3: dayOf + filterTradesByDay work as documented';
  header(NAME);
  try {
    const dayOfMod = await import('../../src/utils/dayOfTimestamp.js');
    const scoreMod = await import('../../src/utils/computeDayScore.js');
    const { dayOf } = dayOfMod;
    const { filterTradesByDay } = scoreMod;

    const battle = {
      timing: { tradingDays: ['2026-05-22', '2026-05-23', '2026-05-24'] },
      trades: [
        { swapDay: 1, lockedPoints: 4 },
        { swapDay: 2, lockedPoints: -1 },
        // No swapDay — should fall through to dayOf(swappedOutAt).
        { swappedOutAt: '2026-05-24T19:30:00Z', lockedPoints: 3 },
      ],
    };

    const day1 = dayOf('2026-05-22T16:00:00Z', battle);
    const day3 = dayOf('2026-05-24T19:30:00Z', battle);
    const outOfRange = dayOf('2026-06-01T15:00:00Z', battle);
    const nullInput = dayOf(null, battle);
    const filterDay1 = filterTradesByDay(battle.trades, 1, battle).length;
    const filterDay3 = filterTradesByDay(battle.trades, 3, battle).length;

    console.log(`  dayOf(2026-05-22): expected 1 got ${day1}`);
    console.log(`  dayOf(2026-05-24): expected 3 got ${day3}`);
    console.log(`  dayOf(2026-06-01): expected null got ${outOfRange}`);
    console.log(`  dayOf(null): expected null got ${nullInput}`);
    console.log(`  filterTradesByDay(1): expected 1 got ${filterDay1}`);
    console.log(`  filterTradesByDay(3) [fallback]: expected 1 got ${filterDay3}`);

    const ok =
      day1 === 1 &&
      day3 === 3 &&
      outOfRange === null &&
      nullInput === null &&
      filterDay1 === 1 &&
      filterDay3 === 1;
    console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`);
    record(NAME, ok ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

async function testF4() {
  const NAME = 'TEST F4: computeDayScore combines trade lockedPoints with badge points';
  header(NAME);
  try {
    const mod = await import('../../src/utils/computeDayScore.js');
    const { computeDayScore } = mod;

    const battle = {
      timing: { tradingDays: ['2026-05-22'] },
      scoreState: { dailyScores: { day1: { badgePoints: 12 } } },
      trades: [
        { swapDay: 1, lockedPoints: 4 },
        { swapDay: 1, lockedPoints: -1 },
      ],
    };
    const score = computeDayScore(battle, 1);
    console.log(`  result: ${JSON.stringify(score)}`);
    const ok = score.tradePoints === 3 && score.badgePoints === 12 && score.total === 15;
    console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`);
    record(NAME, ok ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

function testF5() {
  const NAME = 'TEST F5: AutoDebriefHero filters by messageType === auto_debrief';
  header(NAME);
  try {
    const src = readSource('../../src/components/FilmRoom/AutoDebriefHero.jsx');
    const hasFilter =
      /messageType\s*===\s*['"]auto_debrief['"]/.test(src) || /isAutoDebrief/.test(src);
    const usesDayOf = /dayOf\s*\(/.test(src);
    console.log(`  filters by messageType/isAutoDebrief: ${hasFilter}`);
    console.log(`  filters by trading day via dayOf:    ${usesDayOf}`);
    const ok = hasFilter && usesDayOf;
    console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`);
    record(NAME, ok ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

function testF6() {
  const NAME = 'TEST F6: buildVoiceLayerPrompt has a review-mode branch';
  header(NAME);
  try {
    const src = readSource('../../api/_utils/voiceLayerPrompt.js');
    const hasReviewMode = /mode\s*===\s*['"]review['"]/.test(src);
    const hasReviewBuilder = /buildReviewContext|REVIEW_PHASE_RULES|REVIEW_FEW_SHOT/.test(src);
    console.log(`  references mode === 'review':            ${hasReviewMode}`);
    console.log(`  uses buildReviewContext / REVIEW rules:  ${hasReviewBuilder}`);
    const ok = hasReviewMode && hasReviewBuilder;
    console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`);
    record(NAME, ok ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

function testF7() {
  const NAME = 'TEST F7: FilmRoomChat tracks reviewBudgetUsed + sends mode:review';
  header(NAME);
  try {
    const src = readSource('../../src/components/FilmRoom/FilmRoomChat.jsx');
    const tracksBudget = /reviewBudgetUsed/.test(src);
    const sendsMode = /mode:\s*['"]review['"]/.test(src);
    const postsToAgentChat = /\/api\/agent\/chat/.test(src);
    console.log(`  references reviewBudgetUsed:        ${tracksBudget}`);
    console.log(`  sends mode:'review' in request body: ${sendsMode}`);
    console.log(`  POSTs to /api/agent/chat:            ${postsToAgentChat}`);
    const ok = tracksBudget && sendsMode && postsToAgentChat;
    console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`);
    record(NAME, ok ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

function testF8() {
  const NAME = 'TEST F8: Entry points wired on AgentBattleScreen + BattleHistoryScreen';
  header(NAME);
  try {
    const aSrc = readSource('../../src/screens/AgentBattleScreen.jsx');
    const bSrc = readSource('../../src/screens/BattleHistoryScreen.jsx');
    const aImports = /import\s+FilmRoomBanner/.test(aSrc);
    const aMounts = /<FilmRoomBanner\b/.test(aSrc);
    const aWires = /onOpenFilmRoom/.test(aSrc);
    const bRenders = /Review\s*→/.test(bSrc);
    const bWires = /onOpenFilmRoom/.test(bSrc);

    console.log(`  AgentBattleScreen imports FilmRoomBanner: ${aImports}`);
    console.log(`  AgentBattleScreen mounts FilmRoomBanner:  ${aMounts}`);
    console.log(`  AgentBattleScreen consumes callback:      ${aWires}`);
    console.log(`  BattleHistoryScreen renders Review →:     ${bRenders}`);
    console.log(`  BattleHistoryScreen consumes callback:    ${bWires}`);

    const ok = aImports && aMounts && aWires && bRenders && bWires;
    console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`);
    record(NAME, ok ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

function testF9() {
  const NAME = 'TEST F9: FilmRoomScreen imports + mounts TermResearchModal and AssetResearchModal';
  header(NAME);
  try {
    const src = readSource('../../src/screens/FilmRoomScreen.jsx');
    const importsTerm = /import\s+TermResearchModal/.test(src);
    const importsAsset = /import\s+AssetResearchModal/.test(src);
    const mountsTerm = /<TermResearchModal\b/.test(src);
    const mountsAsset = /<AssetResearchModal\b/.test(src);

    console.log(`  imports TermResearchModal:  ${importsTerm}`);
    console.log(`  imports AssetResearchModal: ${importsAsset}`);
    console.log(`  mounts TermResearchModal:   ${mountsTerm}`);
    console.log(`  mounts AssetResearchModal:  ${mountsAsset}`);

    const ok = importsTerm && importsAsset && mountsTerm && mountsAsset;
    console.log(`RESULT: ${ok ? 'PASS' : 'FAIL'}`);
    record(NAME, ok ? 'PASS' : 'FAIL');
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    console.log('RESULT: FAIL');
    record(NAME, 'FAIL');
  }
}

function testF10() {
  const NAME = 'TEST F10: chat.js accepts mode override + relaxes battle-status block for review';
  header(NAME);
  try {
    const src = readSource('../../api/agent/chat.js');
    // Defensive override: only the literal 'review' override is honored.
    const reviewOverride = /requestedMode\s*===\s*['"]review['"]/.test(src);
    // Status block is mode-aware: blocks only when status !== 'active' AND mode !== 'review'.
    const modeAwareBlock =
      /battle\.status\s*!==\s*['"]active['"][\s\S]{0,80}mode\s*!==\s*['"]review['"]/.test(src);
    // Auto-detection still authoritative for non-review case.
    const stillCallsDetectMode = /detectMode\s*\(battle\)/.test(src);

    console.log(`  accepts explicit mode='review' override: ${reviewOverride}`);
    console.log(`  status check is mode-aware:               ${modeAwareBlock}`);
    console.log(`  falls back to detectMode(battle):         ${stillCallsDetectMode}`);

    const ok = reviewOverride && modeAwareBlock && stillCallsDetectMode;
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
  console.log('Phase 4 Voice Layer Rework — Film Room Behavioral Test Harness');
  console.log('Read-only static checks + small inline helper smoke tests.');
  console.log('Safe to run anytime; no Firestore or env vars required.');
  console.log(HR);
  console.log();

  testF1();         console.log();
  testF2();         console.log();
  await testF3();   console.log();
  await testF4();   console.log();
  testF5();         console.log();
  testF6();         console.log();
  testF7();         console.log();
  testF8();         console.log();
  testF9();         console.log();
  testF10();        console.log();

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
