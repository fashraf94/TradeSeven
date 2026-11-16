#!/usr/bin/env node
// scripts/experiments/trader-game-replay/partD-models.mjs
//
// Part D — the model comparison (ruling BB-24; founder approval "PART D APPROVED, $5",
// 16 Nov 2026). Resends stored trading-brain requests from the local export. Nothing is
// written anywhere but `<export dir>/partD/`; no Firestore call, no product handler.
//
// STEPS (run in order; each saves its output and refuses to repeat a paid step):
//   plan     offline  — the sample, the three arms' requests, every byte that differs from the
//                       stored request, and a worst-case cost estimate (refuses over $5)
//   live     network  — ten live calls per arm, one at a time, for latency (Messages API)
//   submit   network  — one Message Batch with every arm's requests
//   collect  network  — the batch's status; when ended, its results
//   analyze  offline  — validity, agreement, tokens, cost, latency, actual spend (deterministic)
//
// ARMS: (a) Haiku 4.5 again, on 50 rows (the noise floor) — the stored request, unchanged;
// (b) Haiku 5.5 at its default effort, all 150; (c) Haiku 5.5 at low effort, all 150.
// Haiku 5.5 changes, and only these: `model`; `temperature` removed (a non-default value
// returns a 400 on Haiku 5.5); arm (c) adds `output_config: { effort: 'low' }`.
//
// VALIDITY uses the production validator, validateTradeToolResult
// (api/_utils/agentEvalToolResultValidation.js, schema-driven), plus: a tool_use block named
// `submit_trade_decision` exists and the response did not stop at max_tokens.
//
// SECRETS: CLAUDE_API_KEY (the variable the production brain reads) comes from --env / the
// environment and is never printed or written.
//
// USAGE: node scripts/experiments/trader-game-replay/partD-models.mjs <step> --in <export dir> [--env <.env.local>]

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { validateTradeToolResult } from '../../../api/_utils/agentEvalToolResultValidation.js';
import { parseEnvFile } from '../../calibration/export-agent-battles.js';
import { bundles, round2, sum, median, mean, mdTable, pct } from './replayLib.mjs';

export const CAP_USD = 5;
const HAIKU_55 = 'claude-haiku-5-5';
const TOOL = 'submit_trade_decision';
// Per million tokens (pricing.md, read 16 Nov 2026); the Batches API is 50% of these.
export const PRICE = { 'claude-haiku-4-5-20251001': { in: 1.0, out: 5.0 }, [HAIKU_55]: { in: 0.10, out: 0.50 } };
const BATCH_FACTOR = 0.5;
const HASH = (s) => createHash('sha256').update(s).digest('hex');

export function armParams(arm, stored) {
  if (arm === 'a') return stored;
  const out = {};
  for (const [k, v] of Object.entries(stored)) {
    if (k === 'temperature') continue;
    out[k] = k === 'model' ? HAIKU_55 : v;
  }
  if (arm === 'c') out.output_config = { effort: 'low' };
  return out;
}

/** Every top-level key whose serialized bytes differ between the stored request and an arm's. */
export function byteDiff(stored, params) {
  const keys = [...new Set([...Object.keys(stored), ...Object.keys(params)])];
  return keys.filter((k) => JSON.stringify(stored[k]) !== JSON.stringify(params[k])).map((k) => ({
    key: k, before: k in stored ? JSON.stringify(stored[k]) : '(absent)', after: k in params ? JSON.stringify(params[k]) : '(removed)',
  }));
}

const toolOf = (content) => (content || []).find((b) => b.type === 'tool_use' && b.name === TOOL) || null;

/** The answered checks: the stored request and the model's own stored tool call. */
function population(dir) {
  const rows = [];
  for (const b of bundles(dir)) {
    const bodies = new Map(b.tickBodies.map((t) => [t.tickSeq, t]));
    for (const t of b.ticks.filter((x) => x.model?.outcome === 'ok')) {
      const body = bodies.get(t.tickSeq);
      let req = null, res = null;
      try { req = JSON.parse(body.request.body); res = JSON.parse(body.response.body); } catch { continue; }
      const tool = toolOf(res.content);
      if (!tool) continue;
      const id = `${b.label.replace('battle-', 'b')}-s${String(t.tickSeq).padStart(2, '0')}`;
      rows.push({ id, archetype: b.row.archetype, storedFinal: t.decision?.final ?? null, roundTrip: JSON.stringify(req) === body.request.body, req, storedUsage: res.usage, stored: { decision: tool.input.decision, symbolOut: tool.input.symbolOut ?? null, symbolIn: tool.input.symbolIn ?? null, conviction: tool.input.conviction ?? null, rationale: tool.input.rationale ?? null } });
    }
  }
  return rows.sort((x, y) => HASH(x.id).localeCompare(HASH(y.id)));
}

/** Rows of one stored decision, round-robin across archetypes, each archetype in hash order. */
function spread(rows, n) {
  const by = new Map();
  for (const r of rows) { if (!by.has(r.archetype)) by.set(r.archetype, []); by.get(r.archetype).push(r); }
  const archs = [...by.keys()].sort();
  const out = [];
  for (let i = 0; out.length < n && archs.some((a) => by.get(a).length); i++) { const q = by.get(archs[i % archs.length]); if (q.length) out.push(q.shift()); }
  return out;
}

/** 150 rows, the model's own stored decision split as evenly as the data allows (every stored SWAP, the
 *  rest HOLD), each spread across archetypes. Arm (a): the first 25 of each, in that spread order. */
export function sample(rows) {
  const swaps = spread(rows.filter((r) => r.stored.decision !== 'HOLD'), 75);
  const holds = spread(rows.filter((r) => r.stored.decision === 'HOLD'), 150 - swaps.length);
  const all = [...swaps, ...holds];
  const armA = new Set([...swaps.slice(0, 25), ...holds.slice(0, 50 - Math.min(25, swaps.length))].map((r) => r.id));
  const live = all.filter((r) => armA.has(r.id)).sort((x, y) => HASH(x.id).localeCompare(HASH(y.id))).slice(0, 10).map((r) => r.id);
  return { rows: all, armA, live };
}

const costOf = (model, inTok, outTok, factor = 1) => ((inTok * PRICE[model].in + outTok * PRICE[model].out) / 1e6) * factor;

function requests(plan) {
  const out = [];
  for (const r of plan.rows) for (const arm of ['a', 'b', 'c']) if (arm !== 'a' || plan.armA.includes(r.id)) out.push({ arm, id: r.id, params: armParams(arm, r.req) });
  return out;
}

function doPlan(dir, outDir) {
  const { rows, armA, live } = sample(population(dir));
  const plan = { rows, armA: [...armA], live };
  const reqs = requests(plan);
  // Worst case: every response runs to max_tokens; Haiku 5.5 input at 1.3x the stored count.
  const worst = (r, factor) => { const row = rows.find((x) => x.id === r.id); const scale = r.params.model === HAIKU_55 ? 1.3 : 1; return costOf(r.params.model, row.storedUsage.input_tokens * scale, r.params.max_tokens, factor); };
  const liveReqs = reqs.filter((r) => live.includes(r.id));
  plan.estimate = { batchWorst: sum(reqs.map((r) => worst(r, BATCH_FACTOR))), liveWorst: sum(liveReqs.map((r) => worst(r, 1))) };
  plan.estimate.totalWorst = plan.estimate.batchWorst + plan.estimate.liveWorst;
  const diffs = {};
  for (const r of reqs) { const d = JSON.stringify(byteDiff(rows.find((x) => x.id === r.id).req, r.params)); diffs[`${r.arm}|${d}`] = (diffs[`${r.arm}|${d}`] || 0) + 1; }
  plan.diffs = diffs;
  writeFileSync(path.join(outDir, 'plan.json'), JSON.stringify(plan));
  const tallyBy = (f) => rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] || 0) + 1), m), {});
  console.log(`sample: ${rows.length} rows ${JSON.stringify(tallyBy((r) => r.stored.decision))}; by archetype ${JSON.stringify(tallyBy((r) => r.archetype))}; arm (a) ${armA.size} rows; live rows ${live.length}`);
  console.log(`stored request bytes re-serialize identically: ${rows.filter((r) => r.roundTrip).length} of ${rows.length}`);
  console.log('byte differences from the stored request, per arm (count of requests):');
  for (const [k, n] of Object.entries(diffs)) console.log(`  ${n} × arm ${k}`);
  console.log(`worst-case cost (every reply at max_tokens): batch $${plan.estimate.batchWorst.toFixed(3)} + live $${plan.estimate.liveWorst.toFixed(3)} = $${plan.estimate.totalWorst.toFixed(3)} (cap $${CAP_USD})`);
  if (plan.estimate.totalWorst > CAP_USD) throw new Error('estimate over the cap — nothing will be sent');
}

async function client(flags) {
  const env = flags.env ? parseEnvFile(flags.env) : {};
  const apiKey = env.CLAUDE_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error('CLAUDE_API_KEY not found (value not printed)');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic({ apiKey, maxRetries: 0 });
}

const loadPlan = (outDir) => { const p = JSON.parse(readFileSync(path.join(outDir, 'plan.json'), 'utf8')); if (p.estimate.totalWorst > CAP_USD) throw new Error('plan over the cap'); return p; };
const errText = (e) => `${e?.constructor?.name || 'Error'} ${e?.status ?? ''} ${String(e?.message || '').slice(0, 300)}`;

async function doLive(flags, outDir) {
  const file = path.join(outDir, 'live.jsonl');
  if (existsSync(file)) throw new Error('live.jsonl exists — the live calls already ran');
  const plan = loadPlan(outDir);
  const api = await client(flags);
  for (const r of requests(plan).filter((x) => plan.live.includes(x.id))) {
    const t0 = performance.now();
    try {
      const res = await api.messages.create(r.params);
      appendFileSync(file, `${JSON.stringify({ arm: r.arm, id: r.id, latencyMs: Math.round(performance.now() - t0), response: { model: res.model, stop_reason: res.stop_reason, content: res.content, usage: res.usage } })}\n`);
      process.stdout.write(`${r.arm}:${r.id} ${Math.round(performance.now() - t0)} ms ${res.stop_reason}\n`);
    } catch (e) {
      appendFileSync(file, `${JSON.stringify({ arm: r.arm, id: r.id, error: errText(e) })}\n`);
      throw new Error(`live call failed (${r.arm}:${r.id}): ${errText(e)} — stopping`);
    }
  }
}

async function doSubmit(flags, outDir) {
  const file = path.join(outDir, 'batch.json');
  if (existsSync(file)) throw new Error('batch.json exists — the batch was already submitted');
  const plan = loadPlan(outDir);
  const api = await client(flags);
  const batch = await api.messages.batches.create({ requests: requests(plan).map((r) => ({ custom_id: `${r.arm}-${r.id}`, params: r.params })) });
  writeFileSync(file, JSON.stringify({ id: batch.id, created_at: batch.created_at, requests: batch.request_counts }));
  console.log(`batch created: ${batch.processing_status}; requests ${JSON.stringify(batch.request_counts)}`);
}

async function doCollect(flags, outDir) {
  const { id } = JSON.parse(readFileSync(path.join(outDir, 'batch.json'), 'utf8'));
  const api = await client(flags);
  const b = await api.messages.batches.retrieve(id);
  console.log(`batch ${b.processing_status}; ${JSON.stringify(b.request_counts)}`);
  if (b.processing_status !== 'ended') return;
  const file = path.join(outDir, 'batch-results.jsonl');
  writeFileSync(file, '');
  for await (const row of await api.messages.batches.results(id)) appendFileSync(file, `${JSON.stringify(row)}\n`);
  console.log('results saved');
}

function judge(response) {
  if (!response) return { valid: false, why: 'no response' };
  const tool = toolOf(response.content);
  if (!tool) return { valid: false, why: 'no tool call' };
  if (response.stop_reason === 'max_tokens') return { valid: false, why: 'stopped at max_tokens', tool };
  const v = validateTradeToolResult(tool.input);
  return v.valid ? { valid: true, tool } : { valid: false, why: `validator: ${v.invalidField}`, tool };
}

function doAnalyze(outDir) {
  const plan = loadPlan(outDir);
  const rowsById = new Map(plan.rows.map((r) => [r.id, r]));
  const lines = (f) => (existsSync(path.join(outDir, f)) ? readFileSync(path.join(outDir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const batch = lines('batch-results.jsonl').map((x) => ({ arm: x.custom_id.slice(0, 1), id: x.custom_id.slice(2), type: x.result.type, response: x.result.message || null, batch: true }));
  const live = lines('live.jsonl').map((x) => ({ arm: x.arm, id: x.id, type: x.error ? 'errored' : 'succeeded', response: x.response || null, latencyMs: x.latencyMs, batch: false }));
  const results = [...batch, ...live].map((x) => ({ ...x, row: rowsById.get(x.id), j: judge(x.response) }));
  const usageCost = (x, list) => { const u = x.response?.usage; return u ? costOf(x.response.model === HAIKU_55 || x.arm !== 'a' ? HAIKU_55 : 'claude-haiku-4-5-20251001', u.input_tokens, u.output_tokens, !list && x.batch ? BATCH_FACTOR : 1) : 0; };
  const spend = sum(results.map((x) => usageCost(x, false)));
  console.log(`## Part D — ${batch.length} batch results, ${live.length} live calls; actual spend from returned usage: $${spend.toFixed(4)} (cap $${CAP_USD})\n`);
  console.log('Result types:', JSON.stringify(results.reduce((m, x) => ((m[`${x.arm}:${x.batch ? 'batch' : 'live'}:${x.type}`] = (m[`${x.arm}:${x.batch ? 'batch' : 'live'}:${x.type}`] || 0) + 1), m), {})));
  const agree = (x) => x.j.valid && x.j.tool.input.decision === x.row.stored.decision;
  const symAgree = (x) => agree(x) && x.row.stored.decision === 'SWAP' && x.j.tool.input.symbolOut === x.row.stored.symbolOut && x.j.tool.input.symbolIn === x.row.stored.symbolIn;
  const think = (x) => x.response?.usage?.output_tokens_details?.thinking_tokens ?? 0;
  const summarize = (label, xs) => {
    const swaps = xs.filter((x) => x.row.stored.decision === 'SWAP');
    const holds = xs.filter((x) => x.row.stored.decision === 'HOLD');
    return {
      label, n: xs.length, valid: pct(xs.filter((x) => x.j.valid).length, xs.length),
      agree: pct(xs.filter(agree).length, xs.length), agreeHold: pct(holds.filter(agree).length, holds.length), agreeSwap: pct(swaps.filter(agree).length, swaps.length), symbols: pct(swaps.filter(symAgree).length, swaps.length),
      out: median(xs.map((x) => x.response?.usage?.output_tokens)), think: mean(xs.map(think)), inTok: median(xs.map((x) => x.response?.usage?.input_tokens)),
      batchCost: mean(xs.map((x) => usageCost(x, false))), listCost: mean(xs.map((x) => usageCost(x, true))),
    };
  };
  const B = results.filter((x) => x.batch && x.type === 'succeeded');
  const in50 = (x) => plan.armA.includes(x.id);
  const rows = [summarize('(a) Haiku 4.5 again, 50', B.filter((x) => x.arm === 'a')), summarize('(b) Haiku 5.5 default effort, 150', B.filter((x) => x.arm === 'b')), summarize('(b) on the same 50', B.filter((x) => x.arm === 'b' && in50(x))), summarize('(c) Haiku 5.5 low effort, 150', B.filter((x) => x.arm === 'c')), summarize('(c) on the same 50', B.filter((x) => x.arm === 'c' && in50(x)))];
  console.log('\n' + mdTable(rows, [['Arm', (r) => r.label], ['Valid tool calls', (r) => r.valid], ['Agree hold/swap', (r) => r.agree], ['…on stored holds', (r) => r.agreeHold], ['…on stored swaps', (r) => r.agreeSwap], ['Same symbols (stored swaps)', (r) => r.symbols], ['Median input tok', (r) => r.inTok], ['Median output tok', (r) => r.out], ['Mean thinking tok', (r) => r.think], ['$ per call, batch', (r) => r.batchCost.toFixed(5)], ['$ per call, list', (r) => r.listCost.toFixed(5)]]));
  // Descriptive only: the stored swaps split by what the code did with them (executed, or blocked by its own checks).
  const split = ['a', 'b', 'c'].map((arm) => { const s = B.filter((x) => x.arm === arm && x.row.stored.decision === 'SWAP'); const ex = s.filter((x) => x.row.storedFinal === 'SWAP'); const bl = s.filter((x) => x.row.storedFinal !== 'SWAP'); return { arm, ex: pct(ex.filter(agree).length, ex.length), bl: pct(bl.filter(agree).length, bl.length) }; });
  console.log('\nAgreement on stored swaps, by what the code did with them:\n');
  console.log(mdTable(split, [['Arm', (r) => r.arm], ['Swap again, where the code executed the stored swap', (r) => r.ex], ['Swap again, where the code blocked it', (r) => r.bl]]));
  console.log('\nInvalid reasons:', JSON.stringify(B.filter((x) => !x.j.valid).reduce((m, x) => ((m[`${x.arm}: ${x.j.why}`] = (m[`${x.arm}: ${x.j.why}`] || 0) + 1), m), {})));
  console.log('\nDecisions by arm (stored → returned):', JSON.stringify(B.reduce((m, x) => { const k = `${x.arm}: ${x.row.stored.decision}→${x.j.tool?.input?.decision ?? 'invalid'}`; m[k] = (m[k] || 0) + 1; return m; }, {})));
  const L = results.filter((x) => !x.batch && x.type === 'succeeded');
  console.log('\nLatency, live calls (ms):\n');
  console.log(mdTable(['a', 'b', 'c'].map((arm) => { const ms = L.filter((x) => x.arm === arm).map((x) => x.latencyMs); return { arm, n: ms.length, median: median(ms), min: Math.min(...ms), max: Math.max(...ms) }; }), [['Arm', (r) => r.arm], ['Calls', (r) => r.n], ['Median', (r) => r.median], ['Min', (r) => r.min], ['Max', (r) => r.max]]));
  const dis = B.filter((x) => x.arm === 'b' && x.j.valid && (x.j.tool.input.decision !== x.row.stored.decision || (x.row.stored.decision === 'SWAP' && !symAgree(x)))).sort((p, q) => HASH(p.id).localeCompare(HASH(q.id))).slice(0, 5);
  console.log('\nFive disagreements, Haiku 5.5 (b) vs the stored decision:\n');
  for (const x of dis) {
    const s = x.row.stored, t = x.j.tool.input;
    const line = (d) => `${d.decision}${d.decision === 'SWAP' ? ` ${d.symbolOut}→${d.symbolIn}` : ''} (conviction ${d.conviction}): "${String(d.rationale || '').replace(/\s+/g, ' ').slice(0, 220)}"`;
    console.log(`- ${x.row.archetype}. Stored: ${line(s)}\n  Haiku 5.5: ${line(t)}`);
  }
}

async function main() {
  const step = process.argv[2];
  const flags = { in: null, env: null };
  for (let i = 3; i < process.argv.length; i++) { const k = process.argv[i].replace(/^--/, ''); if (!(k in flags)) throw new Error(`Unknown flag ${process.argv[i]}`); flags[k] = process.argv[++i]; }
  if (!flags.in) throw new Error('--in <export dir> is required');
  const outDir = path.join(flags.in, 'partD');
  mkdirSync(outDir, { recursive: true });
  if (step === 'plan') return doPlan(flags.in, outDir);
  if (step === 'live') return doLive(flags, outDir);
  if (step === 'submit') return doSubmit(flags, outDir);
  if (step === 'collect') return doCollect(flags, outDir);
  if (step === 'analyze') return doAnalyze(outDir);
  throw new Error('step must be plan | live | submit | collect | analyze');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(`FATAL: ${String(e?.message || e).slice(0, 400)}`); process.exit(1); });
}
