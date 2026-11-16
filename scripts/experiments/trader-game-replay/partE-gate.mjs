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
  const combined = checks.filter((c) => (c.scheduled ? c.modelRan && narrowGateOpens(c.eval?.triggers) : c.eligible && c.caught?.[0.5]));
  const missedCombined = swaps.filter((c) => !(c.scheduled ? narrowGateOpens(c.eval?.triggers) : c.caught?.[0.5]));
  const schedOnly = checks.filter((c) => (c.scheduled ? c.modelRan : c.eligible && c.caught?.[0.5]));
  const missedSched = swaps.filter((c) => !(c.scheduled || c.caught?.[0.5]));
  const rows = [
    { k: 'Today', calls: today.length, missed: 0 },
    { k: 'Narrower gate, every 15 minutes', calls: narrow.length, missed: missedNarrow.length },
    { k: '30-minute schedule, X = 0.5 (Part B, reading i)', calls: schedOnly.length, missed: missedSched.length },
    { k: 'Narrower gate + 30-minute schedule, X = 0.5', calls: combined.length, missed: missedCombined.length },
  ];
  console.log('\n### Model calls per battle-day and model swaps missed\n');
  console.log(mdTable(rows, [['Gate', (r) => r.k], ['Model calls', (r) => r.calls], ['Per battle-day', (r) => r.calls / days], ['Executed model swaps missed (of 15)', (r) => r.missed]]));
  console.log(`\nToday's model calls whose only triggers are nr7/bench: ${today.length - narrow.length} (${JSON.stringify(tally(today.filter((c) => !narrowGateOpens(c.eval?.triggers)), (c) => triggersOf(c).join('+')))}).`);
  const blocked = today.filter((c) => !narrowGateOpens(c.eval?.triggers) && c.tick.decision?.original === 'SWAP');
  console.log(`Of those, the model proposed a swap at ${blocked.length} (the code blocked ${blocked.filter((c) => c.tick.decision?.final !== 'SWAP').length} of them).`);
  writeResult(flags.in, 'partE.json', { rows, swaps: swaps.map((c) => ({ label: c.label, seq: c.seq, triggers: triggersOf(c), scheduled: c.scheduled, caught: c.caught || null })) });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
