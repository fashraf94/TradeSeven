#!/usr/bin/env node
// scripts/experiments/trader-game-replay/partE-gate.mjs
//
// Part E — a narrower trigger gate (founder request of 16 Nov 2026, with the Part D approval).
// No model call; offline and deterministic over the local export, reusing Part B's check
// analysis (partB-schedule.mjs → analyzeBattle).
//
//   1. For each of the 15 executed model swaps, the triggers stored at that check.
//   2. Model calls per battle-day and model swaps missed if `nr7_contraction` and
//      `bench_outperformance` could no longer open the gate on their own: a check whose
//      stored triggers are only those two no longer calls the model; any other trigger still
//      does (a check with no stored trigger list keeps today's outcome).
//   3. The same rule combined with Part B's 30-minute schedule at X = 0.5: at a scheduled check
//      the narrower gate decides; at a skipped check an event still calls the model.
//
// "Model calls" are checks that dispatched the trading brain, failed calls included (as in Part B).
//
// USAGE: node scripts/experiments/trader-game-replay/partE-gate.mjs --in <export dir>

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { analyzeBattle } from './partB-schedule.mjs';
import { parseArgs, bundles, writeResult, etOf, mdTable, tally } from './replayLib.mjs';

export const WEAK = new Set(['nr7_contraction', 'bench_outperformance']);

/** Would the narrower gate still open at a check the model ran today? */
export function narrowGateOpens(triggers) {
  const set = new Set(triggers || []);
  if (!set.size) return true;
  return [...set].some((t) => !WEAK.has(t));
}

export const NEWS_WINDOW_MS = 120 * 60 * 1000; // fetchRecentNews' window (agentTriggerGate.js)

/**
 * The narrower gate + the 30-minute schedule, one battle's checks in order, carrying forward what a dropped
 * call would leave behind (review E1):
 *   forced_open — the gate forces a call while the battle has no evaluation (agentTriggerGate.js:46–49), so it
 *                 carries until the simulated battle has made a call (exact);
 *   news        — a story is marked seen only after a call resolves (agent-evaluate.js ~2916), so a story that
 *                 woke a dropped call can wake a later check while it is inside the 120-minute window, counted
 *                 here from the dropped check (an upper bound: the story's age then is not stored).
 * Scheduled checks: the narrower gate decides on today's triggers plus anything carried. Skipped checks: an
 * event at X = 0.5 calls the model. Returns the checks that call the model.
 */
export function simulateCombined(checks, { carryForced = true, carryNews = true } = {}) {
  let calls = 0;
  let newsSince = null;
  const called = [];
  for (const c of checks) {
    if (!c.eligible) continue;
    const today = new Set(c.eval?.triggers || []);
    const carried = new Set();
    if (carryForced && calls === 0) carried.add('forced_open');
    if (carryNews && newsSince !== null && Date.parse(c.at) - newsSince <= NEWS_WINDOW_MS) carried.add('news_catalyst');
    const opens = c.scheduled
      ? (c.modelRan ? narrowGateOpens([...today, ...carried]) : carried.size > 0)
      : c.caught?.[0.5] === true;
    if (opens) { calls++; called.push(c); newsSince = null; } else if (c.modelRan && today.has('news_catalyst') && newsSince === null) newsSince = Date.parse(c.at);
  }
  return called;
}

function main() {
  const flags = parseArgs(process.argv);
  const battles = [...bundles(flags.in)].filter((b) => b.ticks.length).map((b) => ({ label: b.label, archetype: b.row.archetype, ...analyzeBattle(b) }));
  const days = battles.length;
  const checks = battles.flatMap((b) => b.checks.map((c) => ({ ...c, label: b.label, archetype: b.archetype })));
  const triggersOf = (c) => [...new Set(c.eval?.triggers || [])].sort();
  const swaps = checks.filter((c) => c.modelSwap);

  console.log(`## Part E — ${days} battle-days; ${checks.filter((c) => c.modelRan).length} model calls; ${swaps.length} executed model swaps\n`);
  console.log('### The triggers at each executed model swap\n');
  console.log(mdTable(swaps, [['Battle', (c) => c.label], ['Archetype', (c) => c.archetype], ['ET', (c) => { const e = etOf(c.at); return `${e.date} ${String(Math.floor(e.minutes / 60)).padStart(2, '0')}:${String(e.minutes % 60).padStart(2, '0')}`; }], ['Triggers', (c) => triggersOf(c).join(', ')], ['Only nr7/bench?', (c) => (narrowGateOpens(c.eval?.triggers) ? 'no' : 'yes')], ['Scheduled?', (c) => (c.scheduled ? 'kept' : 'skipped')], ['Event at X=0.5', (c) => (c.scheduled ? '—' : c.caught?.[0.5] ? 'yes' : 'no')]]));

  const today = checks.filter((c) => c.modelRan);
  const narrow = today.filter((c) => narrowGateOpens(c.eval?.triggers));
  const missedNarrow = swaps.filter((c) => !narrowGateOpens(c.eval?.triggers));
  const schedOnly = checks.filter((c) => (c.scheduled ? c.modelRan : c.eligible && c.caught?.[0.5]));
  const missedSched = swaps.filter((c) => !(c.scheduled || c.caught?.[0.5]));
  const sim = (opts) => {
    const called = new Set(battles.flatMap((b) => simulateCombined(b.checks, opts).map((c) => `${b.label}#${c.seq}`)));
    return { calls: called.size, missed: swaps.filter((c) => !called.has(`${c.label}#${c.seq}`)).length };
  };
  const rows = [
    { k: 'Today', calls: today.length, missed: 0 },
    { k: 'Narrower gate, every 15 minutes', calls: narrow.length, missed: missedNarrow.length },
    { k: '30-minute schedule, X = 0.5 (Part B, reading i)', calls: schedOnly.length, missed: missedSched.length },
    { k: 'Narrower gate + schedule, no carry-forward', ...sim({ carryForced: false, carryNews: false }) },
    { k: 'Narrower gate + schedule, forced_open carried (exact)', ...sim({ carryForced: true, carryNews: false }) },
    { k: 'Narrower gate + schedule, forced_open and news carried (news: upper bound)', ...sim({ carryForced: true, carryNews: true }) },
  ];
  console.log('\n### Model calls per battle-day and model swaps missed\n');
  console.log(mdTable(rows, [['Gate', (r) => r.k], ['Model calls', (r) => r.calls], ['Per battle-day', (r) => r.calls / days], ['Executed model swaps missed (of 15)', (r) => r.missed]]));
  console.log(`\nToday's model calls whose only triggers are nr7/bench: ${today.length - narrow.length} (${JSON.stringify(tally(today.filter((c) => !narrowGateOpens(c.eval?.triggers)), (c) => triggersOf(c).join('+')))}).`);
  // Answered calls only (review E2): a failed call's stored original decision is not a proposal the model completed.
  const weakOnly = today.filter((c) => !narrowGateOpens(c.eval?.triggers));
  const proposed = weakOnly.filter((c) => c.tick.model?.outcome === 'ok' && c.tick.decision?.original === 'SWAP');
  console.log(`Of those, ${weakOnly.filter((c) => c.tick.model?.outcome === 'ok').length} were answered; the model proposed a swap at ${proposed.length} (the code blocked ${proposed.filter((c) => c.tick.decision?.final !== 'SWAP').length}); ${weakOnly.filter((c) => c.tick.model?.outcome !== 'ok').length} calls failed.`);
  writeResult(flags.in, 'partE.json', { rows, swaps: swaps.map((c) => ({ label: c.label, seq: c.seq, triggers: triggersOf(c), scheduled: c.scheduled, caught: c.caught || null })) });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
