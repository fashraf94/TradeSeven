#!/usr/bin/env node
// scripts/experiments/trader-game-replay/partB-schedule.mjs
//
// Part B — the 30-minute schedule (ruling BB-23). Offline and deterministic: reads only
// the local export. Battles with `ticks` rows (one row per check, from 22 Sep 2026).
//
// THE SLOT RULE. A check's slot is its capture time floored to the 15-minute cron grid
// (rows land seconds to minutes after the cron fires). A check is SCHEDULED when its slot
// is an even number of 15-minute steps after the battle's first check's slot: the battle's
// first check, then every 30 minutes. Every other check is SKIPPED. Eastern time comes from
// Intl with an explicit zone (replayLib.etOf); nothing reads the host clock.
//
// ELIGIBLE checks are the ones that can reach the model today: a check that ended on the
// gameplan-meeting path or on degraded quotes never calls the trading brain, on any schedule.
//
// EVENT CHECKS. A skipped eligible check still calls the model if, since the last scheduled
// check (window: after that check's capture, up to this one's):
//   fill     — a sale committed in the window, or by the code's own exits at this check
//              (the model's own swap at this check is the action, not its trigger)
//   move X   — a held stock moved |Δprice| / price ≥ X volatility units since the last
//              scheduled check (unit: baseATR for legacy, the receipt's scoringPct for measured;
//              prices: the film tape's price at each check). Crypto has no tape: not measured.
//   level    — the gate's own stored `threshold_proximity` trigger at this check (agentTriggerGate.js:
//              within 0.2 units of an unearned bonus or an uncrossed penalty)
//   command  — a cockpit command (calls[].playerResponse.filedAt) or a chat message or filed
//              directive (chatExchanges[].timestamp with a user message or messageType directive_filed)
//
// DELAY COST of a model swap at a skipped check that no event catches: the same swap at the next
// scheduled check (or no swap, if none is left). Both legs are scored with the REAL scorer
// (calculateAssetScoreServer, api/_utils/agentScoring.js — fenced, CALLED only) from tape prices
// at each check: the outgoing position to its exit, the incoming one from its fill to its own
// exit (a later sale, else the last check). Touch records are rebuilt from the same check prices.
//
// USAGE: node scripts/experiments/trader-game-replay/partB-schedule.mjs --in <export dir>

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { calculateAssetScoreServer } from '../../../api/_utils/agentScoring.js';
import { stockModelRoute, isStock } from '../../../src/utils/stockThresholdModel.js';
import { parseArgs, bundles, writeResult, etOf, round2, sum, median, mean, tally, mdTable, pct } from './replayLib.mjs';

export const XS = [0.25, 0.5, 0.75];
const NO_MODEL_EXITS = new Set(['gameplan_created', 'gameplan_pending', 'degraded_quotes']);

const slotIndex = (iso) => { const e = etOf(iso); return e ? Date.parse(`${e.date}T00:00:00Z`) / 900_000 + Math.floor(e.minutes / 15) : null; };

/** Mark each check scheduled/skipped and eligible; link each skipped check to its last scheduled one. */
export function scheduleChecks(ticks) {
  const sorted = [...ticks].sort((a, b) => a.tickSeq - b.tickSeq);
  const first = slotIndex(sorted[0]?.capturedAt);
  let lastScheduled = null;
  return sorted.map((t) => {
    const k = slotIndex(t.capturedAt) - first;
    // Eligible = the check reached the trigger gate (or the model). The unavailable-reward-frame exit also
    // records `no_trigger`, but at stage `gameplan_handled`, before the gate (review B2).
    const reachedGate = t.model?.dispatched === true || t.stageReached === 'trigger_evaluated';
    const row = { tick: t, seq: t.tickSeq, at: t.capturedAt, scheduled: k % 2 === 0, eligible: !NO_MODEL_EXITS.has(t.exitReason) && reachedGate, modelRan: t.model?.dispatched === true, prev: lastScheduled };
    if (row.scheduled) lastScheduled = row;
    return row;
  });
}

/** Volatility unit per symbol: measured receipts' scoringPct, else the battle's threshold or slot baseATR. */
function unitsOf(battle) {
  const units = {};
  const measured = stockModelRoute(battle).status === 'corrected';
  const slots = ['star', 'core', 'support'].flatMap((t) => [...(battle.portfolio?.[t] || []), ...(battle.opponent?.portfolio?.[t] || [])]).filter(Boolean);
  for (const a of slots) units[a.symbol] ??= a.baseATR;
  for (const t of battle.trades || []) units[t.symbolOut] ??= t.outgoingReceipt?.scoringPct;
  for (const [s, v] of Object.entries(battle.scoring?.thresholds || {})) if (!measured || units[s] == null) units[s] = v?.threshold ?? units[s];
  if (measured) {
    for (const a of slots) if (a.stockThresholdReceipt) units[a.symbol] = a.stockThresholdReceipt.scoringPct;
    for (const t of battle.trades || []) {
      if (t.outgoingReceipt) units[t.outgoingReceipt.symbol] = t.outgoingReceipt.scoringPct;
      if (t.incomingReceipt) units[t.incomingReceipt.symbol] = t.incomingReceipt.scoringPct;
    }
  }
  return units;
}

/** Price of `symbol` at a check: the tape's price at that tickSeq, else the last 10-minute bar closed by then. */
function pricer(tape) {
  const series = new Map();
  for (const d of tape) for (const s of d.series || []) series.set(s.symbol, s);
  return (symbol, seq, at) => {
    const s = series.get(symbol);
    if (!s) return null;
    const c = (s.atChecks || []).find((x) => x.tickSeq === seq);
    if (c?.price > 0) return c.price;
    const bar = (s.bars || []).filter((b) => Date.parse(b.t) + 600_000 <= Date.parse(at)).at(-1);
    return bar?.c > 0 ? bar.c : null;
  };
}

/** Score one position from entry to exit over the check prices between, with the real scorer. */
function scoreSpan({ symbol, tier, unit, prices }) {
  // The entry and the exit must be priced; a check with no tape price in between only drops out of the touch record.
  const [entry, ...rest] = prices;
  if (!(entry > 0) || !rest.length || !(rest.at(-1) > 0)) return null;
  const m = rest.filter((p) => p > 0).map((p) => ((p - entry) / entry) * 100 / unit);
  const change = ((rest.at(-1) - entry) / entry) * 100;
  return calculateAssetScoreServer({ symbol, baseATR: unit, tier }, change, { maxMultiplier: Math.max(0, ...m), minMultiplier: Math.min(0, ...m) }, {}, change).totalPoints;
}

function commandTimes(bundle) {
  const out = [];
  for (const c of bundle.calls || []) if (c.playerResponse?.filedAt) out.push(c.playerResponse.filedAt);
  for (const x of bundle.battle.chatExchanges || []) if (typeof x.timestamp === 'string' && ((typeof x.userMessage === 'string' && x.userMessage.trim()) || x.messageType === 'directive_filed')) out.push(x.timestamp);
  return out;
}

export function analyzeBattle(bundle) {
  const { battle } = bundle;
  const checks = scheduleChecks(bundle.ticks);
  const evals = new Map((battle.evaluations || []).map((e) => [e.evalId, e]));
  const units = unitsOf(battle);
  const priceAt = pricer(bundle.tape);
  const commands = commandTimes(bundle);
  const bySeq = new Map(checks.map((c) => [c.seq, c]));
  const held = (c) => Object.keys(c.tick.risk?.verdicts || {}).filter((s) => isStock({ symbol: s }));

  for (const c of checks) {
    c.eval = c.modelRan ? evals.get(c.tick.evalId) || null : null;
    c.modelSwap = (c.tick.actions || []).find((a) => a.source === 'haiku' && a.committed) || null;
    if (c.scheduled || !c.eligible) continue;
    const p = c.prev;
    const inWindow = (iso) => !!iso && (!p || iso > p.at) && iso <= c.at;
    const between = checks.filter((x) => p && x.seq > p.seq && x.seq < c.seq);
    const fill = between.some((x) => (x.tick.actions || []).some((a) => a.committed)) || (c.tick.actions || []).some((a) => a.committed && a.source !== 'haiku' && a.source !== 'guardrail');
    const level = (c.eval?.triggers || []).includes('threshold_proximity');
    const command = commands.some(inWindow);
    const moves = {};
    let measuredMoves = 0;
    for (const X of XS) moves[X] = false;
    if (p) for (const s of held(c).filter((x) => held(p).includes(x))) {
      const a = priceAt(s, p.seq, p.at), b = priceAt(s, c.seq, c.at), u = units[s];
      if (!(a > 0 && b > 0 && u > 0)) continue;
      measuredMoves++;
      const units_ = Math.abs(b - a) / a * 100 / u;
      for (const X of XS) if (units_ >= X) moves[X] = true;
    }
    c.events = { fill, level, command, moves, measuredMoves };
    c.caught = Object.fromEntries(XS.map((X) => [X, fill || level || command || moves[X]]));
  }

  // ---- delay cost of each model swap at a skipped check, under two price conventions (review B1):
  //   lag 0 — a fill at a check is the tape's price at that check's own minute;
  //   lag 1 — a fill at a check is the tape's price at the PREVIOUS check, which is what the stored fills match
  //           (the battle's quote is about 16 minutes old; see fillMatch below).
  const trades = battle.trades || [];
  const lastCheck = checks.at(-1);
  const idx = new Map(checks.map((c, i) => [c.seq, i]));
  const px = (sym, seq, lag) => { const k = checks[idx.get(seq) - lag]; return k ? priceAt(sym, k.seq, k.at) : null; };
  const checkOf = (iso) => checks.find((x) => x.at >= iso) || null; // the check whose tick executed a trade
  const actions = checks.filter((c) => !c.scheduled && c.modelSwap).map((c) => {
    const a = c.modelSwap;
    const trade = trades.find((t) => t.symbolOut === a.symbolOut && t.symbolIn === a.symbolIn && Math.abs(Date.parse(t.swappedOutAt) - Date.parse(c.at)) < 900_000);
    const tier = trade?.tier || a.tier || 'support';
    const next = checks.find((x) => x.seq > c.seq && x.scheduled) || null;
    const outEntrySeq = (() => { const t = [...trades].reverse().find((x) => x.symbolIn === a.symbolOut && x.swappedOutAt < c.at); return t ? checkOf(t.swappedOutAt)?.seq ?? checks[0].seq : checks[0].seq; })();
    const inExit = trades.find((t) => t.symbolOut === a.symbolIn && t.swappedOutAt > c.at);
    const inExitSeq = inExit ? checkOf(inExit.swappedOutAt)?.seq ?? lastCheck.seq : lastCheck.seq;
    const legs = (lag) => {
      const span = (sym, fromSeq, toSeq) => checks.filter((x) => x.seq >= fromSeq && x.seq <= toSeq).map((x) => px(sym, x.seq, lag));
      const withEntry = (prices) => (trade?.entryPrice > 0 ? [trade.entryPrice, ...prices.slice(1)] : prices);
      const out = (to) => scoreSpan({ symbol: a.symbolOut, tier, unit: units[a.symbolOut], prices: withEntry(span(a.symbolOut, outEntrySeq, to)) });
      const inn = (from) => scoreSpan({ symbol: a.symbolIn, tier, unit: units[a.symbolIn], prices: span(a.symbolIn, from, inExitSeq) });
      const orig = [out(c.seq), inn(c.seq)];
      const delayed = next && next.seq <= inExitSeq ? [out(next.seq), inn(next.seq)] : [out(inExitSeq), 0];
      const ok = [...orig, ...delayed].every(Number.isFinite);
      return { orig, delayed, cost: ok ? sum(delayed) - sum(orig) : null };
    };
    const l0 = legs(0), l1 = legs(1);
    return { seq: c.seq, at: c.at, et: etOf(c.at), tier, caught: c.caught, events: c.events, nextAfterMin: next ? Math.round((Date.parse(next.at) - Date.parse(c.at)) / 60000) : null, heldToEnd: !inExit, cost: l0.cost, orig: l0.orig, delayed: l0.delayed, costLagged: l1.cost, origLagged: l1.orig, delayedLagged: l1.delayed, storedLocked: trade?.lockedPoints ?? null, archetype: battle.agentContext?.archetype, route: stockModelRoute(battle).status, priced: Number.isFinite(l0.cost) && Number.isFinite(l1.cost) };
  });
  // Which convention do the stored fills follow? Each sale's exit price, and each incoming fill where stored,
  // against the tape at the executing check and at the check before it.
  const fillMatch = [];
  for (const t of trades) {
    const c = checkOf(t.swappedOutAt);
    if (!c || !idx.has(c.seq)) continue;
    const later = trades.find((x) => x.symbolOut === t.symbolIn && x.swappedOutAt > t.swappedOutAt);
    const inFill = t.incomingReceipt?.fill ?? later?.entryPrice ?? null;
    for (const [sym, p] of [[t.symbolOut, t.exitPrice], [t.symbolIn, inFill]]) {
      const now = px(sym, c.seq, 0), before = px(sym, c.seq, 1);
      if (p > 0 && now > 0 && before > 0) fillMatch.push({ now: Math.abs(p - now) / p, before: Math.abs(p - before) / p });
    }
  }
  // Off the half-hour grid: the first check's 15-minute slot is a :15 or :45 slot (the capture minute itself lands late).
  return { checks, actions, fillMatch, outOfGridStart: Math.floor(etOf(checks[0].at).minutes / 15) % 2 !== 0 };
}

function main() {
  const flags = parseArgs(process.argv);
  const battles = [...bundles(flags.in)].filter((b) => b.ticks.length).map((b) => ({ label: b.label, archetype: b.row.archetype, route: b.row.route, ...analyzeBattle(b) }));
  const all = battles.flatMap((b) => b.checks);
  const calls = all.filter((c) => c.modelRan);
  // A failed call (timeout, invalid tool result) falls back to HOLD (holdKind 'default_failure'): it is not a hold the model returned.
  const answered = calls.filter((c) => c.tick.model?.outcome === 'ok');
  // What the model returned (tick decision.original) vs what the check did after the code's own checks (final).
  const holds = answered.filter((c) => c.tick.decision?.original === 'HOLD');
  const finalHolds = answered.filter((c) => c.tick.decision?.final === 'HOLD');
  const blocked = answered.filter((c) => c.tick.decision?.original === 'SWAP' && c.tick.decision?.final !== 'SWAP');
  const why = (c) => { const v = String(c.eval?.validationErrors?.[0] || ''); return /crypto/i.test(v) ? 'stock-for-crypto' : /hurdle floor/.test(v) ? 'hurdle floor' : /cooldown/.test(v) ? 'cooldown' : /LOCKED/.test(v) ? 'locked' : 'other'; };
  console.log(`## Part B — ${battles.length} battle-days with check rows; ${all.length} checks; ${calls.length} model calls (${answered.length} answered); the model returned a hold on ${pct(holds.length, answered.length)}; final hold after the code's checks ${pct(finalHolds.length, answered.length)}\n`);
  console.log(`Model swaps the code blocked: ${blocked.length} — ${JSON.stringify(tally(blocked, why))}`);
  console.log('Failed calls (fallback HOLD):', JSON.stringify(tally(calls.filter((c) => c.tick.model?.outcome !== 'ok'), (c) => `${c.tick.model?.failureClass}${c.tick.model?.timeoutKind ? `/${c.tick.model.timeoutKind}` : ''}`)), '\n');
  console.log('### Today, per battle-day\n');
  const perDay = (f) => median(battles.map((b) => f(b)));
  console.log(mdTable([
    ['Checks run', (b) => b.checks.length], ['Eligible (can reach the model)', (b) => b.checks.filter((c) => c.eligible).length], ['Model calls', (b) => b.checks.filter((c) => c.modelRan).length],
  ].map(([k, f]) => ({ k, total: sum(battles.map(f)), median: perDay(f), mean: mean(battles.map(f)) })), [['', (r) => r.k], ['Total', (r) => r.total], ['Median per battle-day', (r) => r.median], ['Mean per battle-day', (r) => r.mean]]));
  console.log('\nWhy checks did not call the model:', JSON.stringify(tally(all.filter((c) => !c.modelRan), (c) => (c.tick.exitReason === 'no_trigger' && !c.eligible ? 'no_trigger before the gate (reward frame unavailable)' : c.tick.exitReason))));
  const trig = {};
  for (const c of calls) for (const t of new Set(c.eval?.triggers || [])) trig[t] = (trig[t] || 0) + 1;
  const only = tally(calls, (c) => [...new Set(c.eval?.triggers || [])].sort().join('+'));
  console.log('\n### Triggers on the model calls (a call can carry several)\n');
  console.log(mdTable(Object.entries(trig).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n })), [['Trigger', (r) => r.k], ['Calls carrying it', (r) => pct(r.n, calls.length)]]));
  console.log('\nTrigger sets, most common:', Object.entries(only).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k}: ${n}`).join('; '));

  const sched = all.filter((c) => c.scheduled);
  const skippedEligible = all.filter((c) => !c.scheduled && c.eligible);
  console.log(`\n### The schedule\n\nScheduled checks: ${sched.length} (eligible ${sched.filter((c) => c.eligible).length}); skipped: ${all.length - sched.length} (eligible ${skippedEligible.length}). Battles whose first check is off the half-hour: ${battles.filter((b) => b.outOfGridStart).length} of ${battles.length}.`);
  console.log(`Today, model calls at checks the schedule keeps: ${calls.filter((c) => c.scheduled).length}; at checks it skips: ${calls.filter((c) => !c.scheduled).length}.`);
  const rows = XS.map((X) => {
    const ev = skippedEligible.filter((c) => c.caught[X]).length;
    const gateKept = sched.filter((c) => c.modelRan).length;
    const always = sched.filter((c) => c.eligible).length;
    return { X, ev, gate: (gateKept + ev) / battles.length, always: (always + ev) / battles.length, missed: battles.flatMap((b) => b.actions).filter((a) => !a.caught[X]).length };
  });
  console.log('\n### Model calls per battle-day\n');
  console.log(mdTable([{ X: 'today', gate: calls.length / battles.length, always: null, ev: null, missed: 0 }, ...rows], [['X', (r) => r.X], ['Event checks (all battles)', (r) => r.ev], ['Calls/day — gate still decides at scheduled checks', (r) => r.gate], ['Calls/day — model always runs at scheduled checks', (r) => r.always], ['Model swaps missed', (r) => r.missed]]));
  console.log('\nEvent reasons at skipped eligible checks:', JSON.stringify({ fill: skippedEligible.filter((c) => c.events.fill).length, level: skippedEligible.filter((c) => c.events.level).length, command: skippedEligible.filter((c) => c.events.command).length, ...Object.fromEntries(XS.map((X) => [`move ${X}`, skippedEligible.filter((c) => c.events.moves[X]).length])) }), `| skipped eligible checks with no held stock priced at both ends: ${skippedEligible.filter((c) => c.events.measuredMoves === 0).length}`);

  const acts = battles.flatMap((b) => b.actions.map((a) => ({ ...a, label: b.label })));
  const modelSwaps = battles.flatMap((b) => b.checks.filter((c) => c.modelSwap)).length;
  console.log(`\n### Model swaps\n\nAll model swaps: ${modelSwaps}; at skipped checks: ${acts.length}.\n`);
  const fm = battles.flatMap((b) => b.fillMatch);
  console.log(`\nWhich price the stored fills match: ${pct(fm.filter((f) => f.before < f.now).length, fm.length)} of stored fill prices sit closer to the tape at the check BEFORE the executing check than at the executing check (median gap ${round2(100 * median(fm.map((f) => f.before)))}% vs ${round2(100 * median(fm.map((f) => f.now)))}%).`);
  console.log('Delay cost = delayed − done, in points: + means waiting would have gained points. Lag 1 prices each fill at the previous check (as the stored fills do); lag 0 at the check itself.\n');
  const costRow = (X, key) => { const miss = acts.filter((a) => !a.caught[X] && a.priced); return { X, miss: acts.filter((a) => !a.caught[X]).length, priced: miss.length, total: sum(miss.map((a) => a[key])), median: median(miss.map((a) => a[key])), gains: miss.filter((a) => a[key] > 0).length, losses: miss.filter((a) => a[key] < 0).length }; };
  console.log(mdTable(XS.flatMap((X) => [{ conv: 'lag 1 (matches stored fills)', ...costRow(X, 'costLagged') }, { conv: 'lag 0 (check minute)', ...costRow(X, 'cost') }]), [['X', (r) => r.X], ['Convention', (r) => r.conv], ['Missed', (r) => r.miss], ['Priced', (r) => r.priced], ['Total (+ = delay gains)', (r) => r.total], ['Median', (r) => r.median], ['Gains / losses', (r) => `${r.gains} / ${r.losses}`]]));
  console.log('\nEach model swap at a skipped check:\n');
  console.log(mdTable(acts, [['Battle', (a) => a.label], ['Archetype', (a) => a.archetype], ['ET', (a) => `${a.et.date} ${String(Math.floor(a.et.minutes / 60)).padStart(2, '0')}:${String(a.et.minutes % 60).padStart(2, '0')}`], ['Tier', (a) => a.tier], ['Caught at 0.25 / 0.5 / 0.75', (a) => XS.map((X) => (a.caught[X] ? 'yes' : 'no')).join(' / ')], ['Events', (a) => ['fill', 'level', 'command'].filter((k) => a.events[k]).join('+') || '—'], ['Next scheduled (min)', (a) => a.nextAfterMin], ['Delay, lag 1 (pts)', (a) => a.costLagged], ['Delay, lag 0 (pts)', (a) => a.cost]]));
  for (const [k, o] of [['lag 1', 'origLagged'], ['lag 0', 'orig']]) {
    const gaps = acts.filter((a) => Number.isFinite(a.storedLocked) && Number.isFinite(a[o][0])).map((a) => Math.abs(a[o][0] - a.storedLocked));
    console.log(`Price-source check, ${k}: the outgoing leg scored from tape prices vs the stored locked points of the same sale — median gap ${median(gaps)} pts, largest ${Math.max(...gaps)} (${gaps.length} sales).`);
  }
  console.log('\nLegs of each priced case (outgoing, incoming), as done → delayed, lag 1:', acts.map((a) => `${a.label} ${a.archetype} ${a.tier}: ${JSON.stringify(a.origLagged)} → ${JSON.stringify(a.delayedLagged)} = ${a.costLagged}`).join(' | '));
  writeResult(flags.in, 'partB.json', { battles: battles.map((b) => ({ label: b.label, checks: b.checks.map((c) => ({ seq: c.seq, at: c.at, scheduled: c.scheduled, eligible: c.eligible, modelRan: c.modelRan, events: c.events || null, caught: c.caught || null })), actions: b.actions })), rows });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
