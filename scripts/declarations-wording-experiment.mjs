// scripts/declarations-wording-experiment.mjs
//
// Declarations wording experiment — paired offline replay.
//
// Replays RECORDED evaluator requests (agentBattles/{id}/tickBodies/{tickId}
// `request.body`, the exact JSON string the SDK dispatched) with ONLY the
// `tools` array swapped between four arms (scripts/declarationsWordingArms.mjs).
// `system`, `messages`, model, temperature, max_tokens and tool_choice are the
// recorded request's own bytes, verified against production constants.
//
// READ-ONLY AGAINST PRODUCTION BY CONSTRUCTION. Firestore Admin SDK calls here
// are `.get()`, `.select()` and `getAll()` only — no set/update/delete/create/
// runTransaction/batch/bulkWriter. No flag is read from or written to anything.
// Model calls go to the Anthropic API with the key in .env.local
// (CLAUDE_API_KEY, loaded by scripts/loadLocalEnv.js); the key is never printed.
//
// Everything written lands in experiments/declarations-wording/raw/, which is
// git-ignored: request bodies and responses can carry player text.
//
// USAGE (repo root), in order:
//   node scripts/declarations-wording-experiment.mjs select     # gate + sample (no model call)
//   node scripts/declarations-wording-experiment.mjs estimate   # countTokens + cost guard ($25)
//   node scripts/declarations-wording-experiment.mjs run        # 8 calls per check, concurrency ≤ 4, resumable
//   node scripts/declarations-wording-experiment.mjs analyze    # §4 measures + §5 pass table
//
// Round 2 (arms A/D/D2, every recoverable check, $35 ceiling, raw/round2/):
// append --round=2 to each command, e.g. `... select --round=2`. Round 3: see ROUND 3 below.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from './loadLocalEnv.js';
import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';
import { EVAL_MODEL_ID, EVAL_MAX_OUTPUT_TOKENS } from '../api/_utils/agentEvalTransport.js';
import { validateTradeToolResult } from '../api/_utils/agentEvalToolResultValidation.js';
import { captureDeclarations } from '../api/_utils/callRecords/validate.js';
import { bindHorizon, battleExpiryMs } from '../api/_utils/callRecords/horizon.js';
import { selectBattleUniverse } from '../src/data/battleUniverse.js';
import { ARMS, ARMS_ROUND2, ARMS_ROUND3_REUSED, ARMS_ROUND3_NEW, ARMS_ROUND3_S2, ARM_LABELS, armTool, assertDescriptionOnlyDiff, assertRound3Arms } from './declarationsWordingArms.mjs';

// ---------------------------------------------------------------- constants

// Round 1 (default) reproduces the merged experiment. `--round=2` (round 2
// brief): every recoverable check, no stratification cap, arms A/D/D2, a $35
// ceiling, the round-2 `said` rule and bars, and its own raw folder.
const ROUND = Number((process.argv.find((a) => a.startsWith('--round=')) || '--round=1').slice('--round='.length));
if (![1, 2, 3].includes(ROUND)) throw new Error(`unknown --round=${ROUND}`);
const R2 = ROUND === 2;
const RUN_ARMS = R2 ? ARMS_ROUND2 : ARMS;
const CANDIDATE_ARMS = RUN_ARMS.filter((a) => a !== 'A');
const DESC_ARMS = CANDIDATE_ARMS.filter((a) => a !== 'B');

export const SEED = 20261001;
const DAY_FIRST = '2026-09-21';
const DAY_LAST = '2026-10-01';
const TARGET_CHECKS = ROUND >= 2 ? Infinity : 80;
const PER_BATTLE_MAX = ROUND >= 2 ? Infinity : 8;
const REPS = 2;
const CONCURRENCY = 4;
const COST_CEILING_USD = ROUND === 3 ? 20 : R2 ? 35 : 25;
const OUTPUT_ALLOWANCE_TOKENS = 1500;
// Haiku 4.5 list prices, $ per million tokens (claude-api skill, cached 2026-09-25).
const PRICE_IN = 1.0;
const PRICE_OUT = 5.0;
const BOOTSTRAP_RESAMPLES = 10_000;
/** The production request literal (api/cron/agent-evaluate.js:2767-2782). */
const PROD_TEMPERATURE = 0.4;
const PROD_TOOL_CHOICE = { type: 'tool', name: 'submit_trade_decision' };
const EXPECTED_KEYS = ['model', 'max_tokens', 'temperature', 'system', 'messages', 'tools', 'tool_choice'];

const RAW_ROOT = path.join(PROJECT_ROOT, 'experiments', 'declarations-wording', 'raw');
const RAW_DIR = ROUND === 1 ? RAW_ROOT : path.join(RAW_ROOT, `round${ROUND}`);
const CALLS_DIR = path.join(RAW_DIR, 'calls');
const SAMPLE_PATH = path.join(RAW_DIR, 'sample.json');
const ESTIMATE_PATH = path.join(RAW_DIR, 'estimate.json');
const FAILURES_PATH = path.join(RAW_DIR, 'failures.jsonl');
const RESULTS_PATH = path.join(RAW_DIR, 'results.json');
const RESULTS_MD_PATH = path.join(RAW_DIR, 'results.md');

// ---------------------------------------------------------------- helpers

const etFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const etDay = (ms) => etFmt.format(new Date(ms));
export function toMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}
const sha256Utf8 = (s) => createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');

/** mulberry32 — a small, seedable PRNG. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded Fisher–Yates; returns a new array. */
export function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function pct(values, p) {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return null;
  return xs[Math.min(xs.length - 1, Math.max(0, Math.ceil((p / 100) * xs.length) - 1))];
}
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const inc = (o, k, by = 1) => { o[k] = (o[k] || 0) + by; return o; };
const checkKey = (c) => `${c.battleId}__${c.evalId}`.replace(/[^A-Za-z0-9_.-]/g, '_');
const callPath = (arm, rep, c) => path.join(CALLS_DIR, `${arm}_${rep}_${checkKey(c)}.json`);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/**
 * The replay request: the recorded body, key order preserved, `tools` swapped.
 * `max_tokens` is ALWAYS the production ceiling (brief §0 step 5): checks
 * recorded before bdf277a7 (2026-09-25) carry the old 2,048, and every other
 * recorded parameter is verified equal to production by the select gate.
 */
export function replayRequest(stored, arm) {
  const out = {};
  for (const [k, v] of Object.entries(stored)) {
    if (k === 'tools') out[k] = [armTool(arm)];
    else if (k === 'max_tokens') out[k] = EVAL_MAX_OUTPUT_TOKENS;
    else out[k] = v;
  }
  return out;
}

/** The stored request's mode, from its own tool: declarations present ⇒ shadow. */
const windowOfTools = (tools) => (tools?.[0]?.input_schema?.properties?.declarations ? 'shadow' : 'baseline');

// ---------------------------------------------------------------- select

async function select() {
  mkdirSync(RAW_DIR, { recursive: true });
  const db = getFirebaseAdmin();
  const lo = Date.parse(`${DAY_FIRST}T00:00:00Z`);
  const index = await db.collection('agentBattles').select('status', 'expiresAt').get();
  const ids = index.docs.filter((d) => {
    const x = d.data(); const e = toMs(x.expiresAt);
    return x.status === 'active' || e == null || e >= lo;
  }).map((d) => d.id);

  const gate = { recordedMaxTokens: {}, modelOkInWindow: 0, noTick: 0, bodyNotWritten: {}, requestAbsent: 0, requestTruncated: 0, shaMismatch: 0, paramMismatch: [], recoverable: 0 };
  const excludedBattles = [];
  const storedToolDrift = { baseline: { equalsHeadA: 0, other: 0 }, shadow: { equalsHeadB: 0, other: 0 } };
  const eligible = [];
  const battlesMeta = {};

  for (const id of ids) {
    const battle = (await db.collection('agentBattles').doc(id).get()).data();
    const evs = (battle.evaluations || []).filter((e) => {
      const ms = toMs(e?.timestamp); if (ms == null) return false;
      const d = etDay(ms); return d >= DAY_FIRST && d <= DAY_LAST;
    });
    const ok = evs.filter((e) => Number.isFinite(e.callMs) && !e.haikuError);
    if (!ok.length) continue;
    gate.modelOkInWindow += ok.length;
    const archetype = battle.agentContext?.archetype ?? null;
    battlesMeta[id] = {
      archetype, gameMode: battle.gameMode ?? null,
      universe: selectBattleUniverse(battle), battleExpiresAtMs: battleExpiryMs(battle),
    };

    const ticks = await db.collection('agentBattles').doc(id).collection('ticks').select('evalId', 'body', 'callEnvelope').get();
    const tickByEval = new Map(ticks.docs.map((t) => [t.data().evalId, { tickId: t.id, ...t.data() }]));
    const want = ok.map((e) => ({ e, t: tickByEval.get(e.evalId) })).filter((x) => {
      if (!x.t) { gate.noTick += 1; return false; }
      if (x.t.body?.status !== 'written') { inc(gate.bodyNotWritten, String(x.t.body?.status)); return false; }
      return true;
    });
    if (!want.length) { excludedBattles.push({ battleId: id, archetype, modelOk: ok.length, reason: 'no tick capture for any model-ok check' }); continue; }
    const bodySnaps = await db.getAll(...want.map((x) => db.collection('agentBattles').doc(id).collection('tickBodies').doc(x.t.tickId)));
    want.forEach(({ e, t }, i) => {
      const snap = bodySnaps[i];
      const body = snap.exists ? snap.data() : null;
      const reqText = body?.request?.body;
      if (typeof reqText !== 'string') { gate.requestAbsent += 1; return; }
      if (body.request.truncated) { gate.requestTruncated += 1; return; }
      if (sha256Utf8(reqText) !== t.body.requestSha256 || Buffer.byteLength(reqText, 'utf8') !== t.body.requestBytes) { gate.shaMismatch += 1; return; }
      const req = JSON.parse(reqText);
      const problems = [];
      if (JSON.stringify(Object.keys(req)) !== JSON.stringify(EXPECTED_KEYS)) problems.push(`keys=${Object.keys(req).join(',')}`);
      if (req.model !== EVAL_MODEL_ID) problems.push(`model=${req.model}`);
      // The ceiling was 2,048 before bdf277a7 (2026-09-25); the replay sets production's value, so a
      // recorded 2,048 is tallied, not rejected. Any OTHER value is a mismatch.
      if (req.max_tokens !== EVAL_MAX_OUTPUT_TOKENS && req.max_tokens !== 2048) problems.push(`max_tokens=${req.max_tokens}`);
      if (req.temperature !== PROD_TEMPERATURE) problems.push(`temperature=${req.temperature}`);
      if (JSON.stringify(req.tool_choice) !== JSON.stringify(PROD_TOOL_CHOICE)) problems.push('tool_choice');
      if (!Array.isArray(req.tools) || req.tools.length !== 1) problems.push('tools.length');
      if (problems.length) { gate.paramMismatch.push({ battleId: id, evalId: e.evalId, problems }); return; }
      gate.recoverable += 1;
      inc(gate.recordedMaxTokens, String(req.max_tokens));
      const window = windowOfTools(req.tools);
      const storedTool = JSON.stringify(req.tools[0]);
      if (window === 'baseline') inc(storedToolDrift.baseline, storedTool === JSON.stringify(armTool('A')) ? 'equalsHeadA' : 'other');
      else inc(storedToolDrift.shadow, storedTool === JSON.stringify(armTool('B')) ? 'equalsHeadB' : 'other');
      const ms = toMs(e.timestamp);
      const promptBuiltAtMs = toMs(e.promptBuiltAt) ?? toMs(t.callEnvelope?.promptBuiltAt) ?? ms;
      eligible.push({
        battleId: id, evalId: e.evalId, tickId: t.tickId, archetype, ms, day: etDay(ms), window,
        promptBuiltAtMs, mintedAtMs: promptBuiltAtMs + e.callMs, requestSha256: t.body.requestSha256, recordedMaxTokens: req.max_tokens,
        original: { decision: e.decision ?? null, anticipationCandidates: Array.isArray(e.anticipationCandidates) ? e.anticipationCandidates.length : null },
        request: req,
      });
    });
  }

  // ---- stratified, seeded sample (§1) ----------------------------------
  const rand = rng(SEED);
  const byBattle = new Map();
  for (const c of eligible) (byBattle.get(c.battleId) || byBattle.set(c.battleId, []).get(c.battleId)).push(c);
  const battleIds = [...byBattle.keys()].sort();
  const quota = {};
  const isMC = (bid) => battlesMeta[bid].archetype === 'momentum_chaser';
  for (const bid of battleIds) if (!isMC(bid)) quota[bid] = Math.min(PER_BATTLE_MAX, byBattle.get(bid).length);
  let remaining = TARGET_CHECKS - Object.values(quota).reduce((s, x) => s + x, 0);
  const mcIds = battleIds.filter(isMC);
  for (const bid of mcIds) quota[bid] = 0;
  // Round-robin in a seeded order until the target or every cap is reached.
  const order = shuffle(mcIds, rand);
  let progressed = true;
  while (remaining > 0 && progressed) {
    progressed = false;
    for (const bid of order) {
      if (remaining <= 0) break;
      if (quota[bid] < Math.min(PER_BATTLE_MAX, byBattle.get(bid).length)) { quota[bid] += 1; remaining -= 1; progressed = true; }
    }
  }
  const sample = [];
  for (const bid of battleIds) {
    const list = byBattle.get(bid).sort((a, b) => a.ms - b.ms);
    const k = quota[bid];
    // Spread across the battle's day: k equal bins in time order, one seeded pick per bin.
    for (let i = 0; i < k; i += 1) {
      const lo2 = Math.floor((i * list.length) / k);
      const hi2 = Math.floor(((i + 1) * list.length) / k);
      sample.push(list[lo2 + Math.floor(rand() * (hi2 - lo2))]);
    }
  }

  const out = {
    seed: SEED, createdAt: new Date().toISOString(), window: [DAY_FIRST, DAY_LAST],
    gate, storedToolDrift, excludedBattles, battlesMeta,
    eligibleByBattle: Object.fromEntries(battleIds.map((b) => [b, byBattle.get(b).length])),
    quota, sample,
  };
  writeFileSync(SAMPLE_PATH, JSON.stringify(out, null, 1));
  const tally = (key) => sample.reduce((o, c) => inc(o, c[key]), {});
  console.log(JSON.stringify({ gate, storedToolDrift, excludedBattles, quota, n: sample.length, byArchetype: tally('archetype'), byWindow: tally('window'), byDay: tally('day') }, null, 1));
}

// ---------------------------------------------------------------- client

function client() {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (typeof apiKey !== 'string' || !apiKey.startsWith('sk-ant-')) {
    throw new Error('CLAUDE_API_KEY missing from .env.local or not an sk-ant- key (value not printed)');
  }
  return new Anthropic({ apiKey, maxRetries: 0, timeout: 120_000 });
}

// ---------------------------------------------------------------- estimate

async function estimate() {
  const s = readJson(SAMPLE_PATH);
  const desc = assertDescriptionOnlyDiff(DESC_ARMS);
  const anthropic = client();
  // One request per arm: the LARGEST recorded request, so the estimate is conservative.
  const largest = s.sample.reduce((a, c) => (JSON.stringify(c.request).length > JSON.stringify(a.request).length ? c : a));
  const perArm = {};
  let total = 0;
  const callsPerArm = s.sample.length * REPS;
  for (const arm of RUN_ARMS) {
    const req = replayRequest(largest.request, arm);
    const { input_tokens: inputTokens } = await anthropic.messages.countTokens({
      model: req.model, system: req.system, messages: req.messages, tools: req.tools, tool_choice: req.tool_choice,
    });
    const usd = (callsPerArm * inputTokens * PRICE_IN + callsPerArm * OUTPUT_ALLOWANCE_TOKENS * PRICE_OUT) / 1e6;
    perArm[arm] = { inputTokens, toolChars: JSON.stringify(armTool(arm)).length, calls: callsPerArm, usd };
    total += usd;
  }
  const out = { descriptionOnlyDiff: desc, basis: `${largest.battleId}:${largest.evalId}`, perArm, totalUsd: total, ceilingUsd: COST_CEILING_USD, pass: total <= COST_CEILING_USD };
  writeFileSync(ESTIMATE_PATH, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  if (!out.pass) { console.error(`STOP: estimate $${total.toFixed(2)} exceeds $${COST_CEILING_USD}`); process.exitCode = 2; }
}

// ---------------------------------------------------------------- run

const RETRYABLE = (err) => err instanceof Anthropic.RateLimitError
  || err instanceof Anthropic.InternalServerError
  || err instanceof Anthropic.APIConnectionError
  || (err instanceof Anthropic.APIError && (err.status === 529 || (err.status >= 500 && err.status < 600)));

async function oneCall(anthropic, task, failures) {
  const { arm, rep, check } = task;
  const req = replayRequest(check.request, arm);
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const { data, request_id: requestId } = await anthropic.messages.create(req).withResponse();
      const toolUse = data.content?.find((b) => b.type === 'tool_use') ?? null;
      const rec = {
        requestId, arm, rep, battleId: check.battleId, evalId: check.evalId, tickId: check.tickId,
        toolUseInput: toolUse ? toolUse.input : null, stopReason: data.stop_reason, usage: data.usage, model: data.model,
        attempts: attempt, at: new Date().toISOString(),
      };
      writeFileSync(callPath(arm, rep, check), JSON.stringify(rec));
      return true;
    } catch (err) {
      const row = { arm, rep, battleId: check.battleId, evalId: check.evalId, attempt, status: err?.status ?? null, name: err?.name ?? null, message: String(err?.message || err).slice(0, 300), at: new Date().toISOString() };
      failures.push(row);
      writeFileSync(FAILURES_PATH, `${JSON.stringify(row)}\n`, { flag: 'a' });
      if (!RETRYABLE(err) || attempt === 6) return false;
      const retryAfter = Number(err?.headers?.get?.('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(60_000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  return false;
}

async function run() {
  const est = readJson(ESTIMATE_PATH);
  if (!est.pass) throw new Error(`estimate $${est.totalUsd} exceeds the ceiling — not running`);
  assertDescriptionOnlyDiff(DESC_ARMS);
  const s = readJson(SAMPLE_PATH);
  mkdirSync(CALLS_DIR, { recursive: true });
  const anthropic = client();
  const tasks = [];
  for (const check of s.sample) for (const arm of RUN_ARMS) for (let rep = 1; rep <= REPS; rep += 1) {
    if (!existsSync(callPath(arm, rep, check))) tasks.push({ arm, rep, check });
  }
  console.log(`tasks to run: ${tasks.length} (of ${s.sample.length * RUN_ARMS.length * REPS})`);
  const failures = [];
  let next = 0; let done = 0; let failed = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const task = tasks[next]; next += 1;
      const ok = await oneCall(anthropic, task, failures);
      if (ok) done += 1; else failed += 1;
      if ((done + failed) % 40 === 0) console.log(`progress ${done + failed}/${tasks.length} (failed ${failed})`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(JSON.stringify({ done, failed, failureAttempts: failures.length }));
}

// ---------------------------------------------------------------- analyze

/** The §4.4 lexical rule. */
const SAID_NC_ADDS = /\b(close|closes|closing|holds|holding|through)\b|\bon the day\b|\bend of day\b|\bconfirm/i;
const SAID_OTHER_ADDS = /next check|next eval/i;
function saidInconsistentRound1(row) {
  if (typeof row?.said !== 'string') return false;
  return row.horizonPhrase === 'next_check' ? SAID_NC_ADDS.test(row.said) : SAID_OTHER_ADDS.test(row.said);
}

/**
 * The round-2 rule ("added conditions in said"), as frozen in the brief. Each
 * entry is [label, pattern]; a line is flagged when any applicable pattern
 * matches. Bare thesis language ("would confirm the breakout") matches none.
 */
const SAID_R2_ANY = [
  ['volume', /\bvolume/i],
  ['rvol', /\brvol/i],
  ['candle', /\bcandle/i],
  ['consecutive', /\bconsecutive/i],
  ['if confirmed', /\bif confirmed\b/i],
  ['on confirmation', /\bon confirmation\b/i],
  ['confirmation of', /\bconfirmation of\b/i],
  ['close(s) above/below', /\bcloses? (above|below)\b/i],
  ['holds/holding above/below … for/through', /\bhold(s|ing) (above|below)\b.*\b(for|through)\b/i],
];
const SAID_R2_NEXT_CHECK = [
  ['by/before the close (next_check)', /\b(by|before) the close\b/i],
  ['end of (the) day/session (next_check)', /\bend of (the )?(day|session)\b/i],
  ['on the day (next_check)', /\bon the day\b/i],
];
const SAID_R2_OTHER = [['next check/eval (not next_check)', /next check|next eval/i]];
/** The labels of every round-2 pattern the line trips (empty = not flagged). */
export function saidFlagsRound2(row) {
  if (typeof row?.said !== 'string') return [];
  const rules = [...SAID_R2_ANY, ...(row.horizonPhrase === 'next_check' ? SAID_R2_NEXT_CHECK : SAID_R2_OTHER)];
  return rules.filter(([, re]) => re.test(row.said)).map(([label]) => label);
}
export function saidInconsistent(row, round = ROUND) {
  return round >= 2 ? saidFlagsRound2(row).length > 0 : saidInconsistentRound1(row);
}

/** A per-arm PRNG salt; single-letter arms keep their round-1 value. */
const armSalt = (arm) => [...arm].reduce((sum, ch, i) => sum + ch.charCodeAt(0) * (i ? 1000 : 1), 0);

const logFact = (() => { const t = [0]; return (n) => { for (let i = t.length; i <= n; i += 1) t[i] = t[i - 1] + Math.log(i); return t[n]; }; })();
const logChoose = (n, k) => logFact(n) - logFact(k) - logFact(n - k);
/**
 * One-sided Fisher exact test: P(arm invalid ≥ observed) under the
 * hypergeometric null, for the 2×2 table [arm invalid, arm valid; A invalid, A valid].
 */
export function fisherOneSidedGreater(armBad, armN, refBad, refN) {
  const K = armBad + refBad; const N = armN + refN;
  let p = 0;
  for (let k = armBad; k <= Math.min(K, armN); k += 1) p += Math.exp(logChoose(K, k) + logChoose(N - K, armN - k) - logChoose(N, armN));
  return Math.min(1, p);
}

function bootstrapRelative(diffs, base, seed) {
  const r = rng(seed); const n = diffs.length; const stats = [];
  for (let b = 0; b < BOOTSTRAP_RESAMPLES; b += 1) {
    let sd = 0; let sb = 0;
    for (let i = 0; i < n; i += 1) { const j = Math.floor(r() * n); sd += diffs[j]; sb += base[j]; }
    stats.push(sb > 0 ? sd / sb : 0);
  }
  stats.sort((x, y) => x - y);
  return { lo: stats[Math.floor(0.025 * BOOTSTRAP_RESAMPLES)], hi: stats[Math.floor(0.975 * BOOTSTRAP_RESAMPLES) - 1] };
}

const decisionOf = (input) => (input ? { d: input.decision ?? null, out: input.symbolOut ?? null, in: input.symbolIn ?? null } : { d: null, out: null, in: null });
const agree = (x, y) => x.d === y.d && (x.d !== 'SWAP' || (x.out === y.out && x.in === y.in));
const ancOf = (input) => (Array.isArray(input?.anticipationCandidates) ? input.anticipationCandidates.length : 0);

/**
 * One arm's §4 measures over a replayed sample — round 1's and round 2's analyze, and round 3's.
 * `get(arm, rep, check)` returns a call record or null; `complete` is the paired set (every arm ×
 * rep present); `extended` adds round 2's flag terms, random lines and pacing; `saidRound` picks
 * the `said` rule.
 */
function measureArm(arm, { s, complete, get, validate, est, extended, saidRound }) {
  const aMean = (c) => (ancOf(get('A', 1, c)?.toolUseInput) + ancOf(get('A', 2, c)?.toolUseInput)) / 2;
  const callsAll = s.sample.flatMap((c) => [1, 2].map((rep) => ({ c, rep, r: get(arm, rep, c) }))).filter((x) => x.r);
  const callsC = complete.flatMap((c) => [1, 2].map((rep) => ({ c, rep, r: get(arm, rep, c) })));
  // 1. anticipation
  const armMean = (c) => (ancOf(get(arm, 1, c).toolUseInput) + ancOf(get(arm, 2, c).toolUseInput)) / 2;
  const diffs = complete.map((c) => armMean(c) - aMean(c));
  const base = complete.map(aMean);
  const anticipation = {
    meanPerCall: mean(callsC.map((x) => ancOf(x.r.toolUseInput))),
    pairedMeanDiff: mean(diffs),
    pairedRelative: mean(base) > 0 ? mean(diffs) / mean(base) : null,
    ci95: arm === 'A' ? null : bootstrapRelative(diffs, base, SEED + armSalt(arm)),
  };
  // 2–4. declarations
  let declaring = 0; const declaringChecks = new Set(); const kindMix = {}; const horizonMix = {}; const shotHorizonMix = {};
  const removals = {}; const callsPerDeclaring = []; let shots = 0; let inconsistent = 0; const flagged = []; const examples = [];
  const allShots = []; const flagTerms = {};
  // Pacing: per battle-day and rep, declaring checks and minted calls (every check of the day is in a round-2 sample).
  const pacing = new Map();
  const paceOf = (c) => {
    const k = `${c.battleId}|${c.day}`;
    if (!pacing.has(k)) pacing.set(k, { battleId: c.battleId, day: c.day, archetype: c.archetype, checks: new Set(), declaring: { 1: 0, 2: 0 }, minted: { 1: 0, 2: 0 } });
    return pacing.get(k);
  };
  for (const { c, rep, r } of callsC) {
    const pace = paceOf(c); pace.checks.add(c.evalId);
    const v = validate(c, r.toolUseInput);
    for (const rm of v.validation.removed) inc(removals, `${rm.source}:${rm.reason}`);
    if (v.phase !== 'expected') continue;
    declaring += 1; declaringChecks.add(`${c.battleId}|${c.evalId}`);
    pace.declaring[rep] += 1; pace.minted[rep] += v.validation.calls.length;
    const val = v.validation.validated;
    callsPerDeclaring.push(v.validation.calls.length);
    for (const call of v.validation.calls) {
      inc(kindMix, call.kind);
      const h = call.source === 'fork' ? 'next_check' : call.row.horizonPhrase;
      inc(horizonMix, h);
      if (call.source === 'calledShots') {
        inc(shotHorizonMix, h); shots += 1;
        const terms = extended ? saidFlagsRound2(call.row) : [];
        for (const t of terms) inc(flagTerms, t);
        const line = { check: `${c.battleId}:${c.evalId}`, rep, symbol: call.row.symbol, horizonPhrase: call.row.horizonPhrase, said: call.row.said, flagged: saidInconsistent(call.row, saidRound), terms };
        allShots.push(line);
        if (line.flagged) { inconsistent += 1; flagged.push(line); }
      }
    }
    if (val.watching.length) inc(kindMix, 'watching', val.watching.length);
    if (val.playerAsk) inc(kindMix, 'playerAsk');
    examples.push({ check: `${c.battleId}:${c.evalId}`, rep, archetype: c.archetype, declarations: val });
  }
  const nCalls = callsC.length;
  const totalCalls = Object.values(horizonMix).reduce((x, y) => x + y, 0);
  const longHorizon = (horizonMix.this_session || 0) + (horizonMix.this_battle || 0);
  // 5. decision drift (rep-aligned against A)
  let agreeN = 0; let agreeD = 0;
  for (const c of complete) for (const rep of [1, 2]) {
    agreeD += 1; if (agree(decisionOf(get(arm, rep, c).toolUseInput), decisionOf(get('A', rep, c).toolUseInput))) agreeN += 1;
  }
  // 6. health (every call that returned, complete or not)
  const maxTok = callsAll.filter((x) => x.r.stopReason === 'max_tokens').length;
  const noTool = callsAll.filter((x) => !x.r.toolUseInput).length;
  const invalidRows = callsAll
    .map((x) => ({ x, v: x.r.toolUseInput ? validateTradeToolResult(x.r.toolUseInput) : null }))
    .filter(({ v }) => v && !v.valid);
  const invalid = invalidRows.length;
  const invalidByField = {}; const invalidByReason = {};
  for (const { v } of invalidRows) { inc(invalidByField, v.invalidField); inc(invalidByReason, v.reason); }
  const invalidChecks = new Set(invalidRows.map(({ x }) => `${x.c.battleId}:${x.c.evalId}`)).size;
  const paceRows = [...pacing.values()];
  const pacingByArchetype = {};
  for (const archetype of [...new Set(paceRows.map((p) => p.archetype))].sort()) {
    const rows = paceRows.filter((p) => p.archetype === archetype);
    const perDay = (k) => rows.map((p) => (p[k][1] + p[k][2]) / 2);
    const summary = (xs) => ({ mean: mean(xs), median: pct(xs, 50), min: Math.min(...xs), max: Math.max(...xs) });
    pacingByArchetype[archetype] = {
      battleDays: rows.length, checksPerBattleDay: summary(rows.map((p) => p.checks.size)),
      declaringChecks: summary(perDay('declaring')), mintedCalls: summary(perDay('minted')),
    };
  }
  const outs = callsAll.map((x) => x.r.usage?.output_tokens);
  const ins = callsAll.map((x) => x.r.usage?.input_tokens);
  // examples: seeded pick of five
  const er = rng(SEED + 7 + armSalt(arm));
  const ex = shuffle(examples, er).slice(0, 5);
  const fr = rng(SEED + 11 + armSalt(arm));
  return {
    label: ARM_LABELS[arm], calls: nCalls, callsReturned: callsAll.length,
    anticipation,
    declarationRate: nCalls ? declaring / nCalls : null, declaringCalls: declaring,
    declaringCheckShare: complete.length ? declaringChecks.size / complete.length : null,
    callsPerDeclaringCall: mean(callsPerDeclaring),
    kindMix, horizonMix, shotHorizonMix, removals,
    longHorizonShare: totalCalls ? longHorizon / totalCalls : null, totalCalls,
    shotLongHorizonShare: shots ? ((shotHorizonMix.this_session || 0) + (shotHorizonMix.this_battle || 0)) / shots : null,
    said: {
      shots, inconsistent, rate: shots ? inconsistent / shots : null, sample: shuffle(flagged, fr).slice(0, 10),
      ...(extended ? { flagTerms, random20: shuffle(allShots, rng(SEED + 13 + armSalt(arm))).slice(0, 20) } : {}),
    },
    ...(extended ? { pacingByArchetype, pacingRows: paceRows.map((p) => ({ battleId: p.battleId, day: p.day, archetype: p.archetype, checks: p.checks.size, declaring: p.declaring, minted: p.minted })) } : {}),
    decisionAgreementWithA: agreeD ? agreeN / agreeD : null,
    health: {
      maxTokensRate: callsAll.length ? maxTok / callsAll.length : null, maxTokens: maxTok,
      invalidToolResultRate: callsAll.length ? invalid / callsAll.length : null, invalid,
      invalidByField, invalidByReason, invalidChecks, callsReturned: callsAll.length,
      noToolUseRate: callsAll.length ? noTool / callsAll.length : null, noToolUse: noTool,
      outputP50: pct(outs, 50), outputP95: pct(outs, 95), inputMean: mean(ins.filter(Number.isFinite)),
    },
    size: { toolChars: JSON.stringify(armTool(arm)).length, countTokensLargest: est?.perArm?.[arm]?.inputTokens ?? null },
    examples: ex,
  };
}

/** The noise floors: A rep 1 against A rep 2 over the paired set. */
function noiseFloor(complete, get) {
  const a1 = complete.map((c) => ancOf(get('A', 1, c).toolUseInput));
  const a2 = complete.map((c) => ancOf(get('A', 2, c).toolUseInput));
  const noiseDiffs = complete.map((_, i) => a2[i] - a1[i]);
  return {
    anticipationRelative: mean(a1) > 0 ? mean(noiseDiffs) / mean(a1) : null,
    anticipationCi95: bootstrapRelative(noiseDiffs, a1, SEED + 99),
    decisionAgreementA1A2: complete.length ? complete.filter((c) => agree(decisionOf(get('A', 1, c).toolUseInput), decisionOf(get('A', 2, c).toolUseInput))).length / complete.length : null,
  };
}

function analyze() {
  const s = readJson(SAMPLE_PATH);
  const est = existsSync(ESTIMATE_PATH) ? readJson(ESTIMATE_PATH) : null;
  const recs = new Map();
  for (const f of readdirSync(CALLS_DIR)) { const r = readJson(path.join(CALLS_DIR, f)); recs.set(`${r.arm}|${r.rep}|${r.battleId}|${r.evalId}`, r); }
  const get = (arm, rep, c) => recs.get(`${arm}|${rep}|${c.battleId}|${c.evalId}`) ?? null;
  // Paired analysis uses only checks with every one of the 8 calls present.
  const complete = s.sample.filter((c) => RUN_ARMS.every((a) => [1, 2].every((rep) => get(a, rep, c))));
  const failuresRaw = existsSync(FAILURES_PATH) ? readFileSync(FAILURES_PATH, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];

  // Spend
  let inTok = 0; let outTok = 0; let cacheW = 0; let cacheR = 0;
  for (const r of recs.values()) { inTok += r.usage?.input_tokens || 0; outTok += r.usage?.output_tokens || 0; cacheW += r.usage?.cache_creation_input_tokens || 0; cacheR += r.usage?.cache_read_input_tokens || 0; }
  const spentUsd = (inTok * PRICE_IN + outTok * PRICE_OUT + cacheW * PRICE_IN * 1.25 + cacheR * PRICE_IN * 0.1) / 1e6;

  const meta = s.battlesMeta;
  const validate = (c, input) => captureDeclarations(input?.declarations, {
    universe: meta[c.battleId].universe,
    resolveHorizon: bindHorizon({ promptBuiltAtMs: c.promptBuiltAtMs, mintedAtMs: c.mintedAtMs, battleExpiresAtMs: meta[c.battleId].battleExpiresAtMs }),
  });

  const perArm = {};
  for (const arm of RUN_ARMS) perArm[arm] = measureArm(arm, { s, complete, get, validate, est, extended: R2, saidRound: ROUND });

  // Noise floors (A rep 1 vs A rep 2)
  const noise = noiseFloor(complete, get);

  // §5 pass table (frozen bars)
  const A = perArm.A;
  const pass = {};
  for (const arm of CANDIDATE_ARMS) {
    const x = perArm[arm];
    if (R2) {
      x.health.fisherP = fisherOneSidedGreater(x.health.invalid, x.health.callsReturned, A.health.invalid, A.health.callsReturned);
    }
    const bars = {
      anticipation: x.anticipation.pairedRelative >= -0.10 && x.anticipation.ci95.lo >= -0.20,
      declarationRate: R2 ? x.declarationRate >= 0.15 && x.declarationRate <= 0.40 : x.declarationRate >= 0.15,
      horizon: x.longHorizonShare != null && x.longHorizonShare >= 0.5,
      said: x.said.rate != null && x.said.rate <= 0.10,
      decisionAgreement: x.decisionAgreementWithA >= noise.decisionAgreementA1A2 - 0.05,
      health: R2
        ? x.health.maxTokensRate <= 0.02 && x.health.invalidToolResultRate <= 0.03 && x.health.fisherP >= 0.05
        : x.health.maxTokensRate <= 0.02 && x.health.invalidToolResultRate <= A.health.invalidToolResultRate + 0.01,
    };
    pass[arm] = { bars, overall: Object.values(bars).every(Boolean) };
  }

  // Round 2 only: round 1's own D results beside this round's, and round 1's
  // D called shots re-scored under the round-2 `said` rule (descriptive).
  let round1 = null;
  if (R2 && existsSync(path.join(RAW_ROOT, 'results.json'))) {
    const r1 = readJson(path.join(RAW_ROOT, 'results.json'));
    const s1 = readJson(path.join(RAW_ROOT, 'sample.json'));
    const recs1 = new Map();
    for (const f of readdirSync(path.join(RAW_ROOT, 'calls'))) { const r = readJson(path.join(RAW_ROOT, 'calls', f)); if (r.arm === 'D') recs1.set(`${r.rep}|${r.battleId}|${r.evalId}`, r); }
    let shots1 = 0; let flagged1 = 0;
    for (const c of s1.sample) for (const rep of [1, 2]) {
      const r = recs1.get(`${rep}|${c.battleId}|${c.evalId}`); if (!r) continue;
      const v = captureDeclarations(r.toolUseInput?.declarations, {
        universe: s1.battlesMeta[c.battleId].universe,
        resolveHorizon: bindHorizon({ promptBuiltAtMs: c.promptBuiltAtMs, mintedAtMs: c.mintedAtMs, battleExpiresAtMs: s1.battlesMeta[c.battleId].battleExpiresAtMs }),
      });
      if (v.phase !== 'expected') continue;
      for (const call of v.validation.calls) if (call.source === 'calledShots') { shots1 += 1; if (saidFlagsRound2(call.row).length) flagged1 += 1; }
    }
    round1 = { D: r1.perArm.D, noise: r1.noise, checksComplete: r1.checksComplete, saidRound2RuleOnRound1D: { shots: shots1, flagged: flagged1, rate: shots1 ? flagged1 / shots1 : null } };
  }

  const out = {
    analyzedAt: new Date().toISOString(), checksSampled: s.sample.length, checksComplete: complete.length,
    callsReturned: recs.size, failureAttempts: failuresRaw.length,
    failuresByStatus: failuresRaw.reduce((o, f) => inc(o, String(f.status ?? f.name)), {}),
    spend: { inputTokens: inTok, outputTokens: outTok, cacheWrite: cacheW, cacheRead: cacheR, usd: spentUsd },
    noise, perArm, pass, round: ROUND, round1,
  };
  writeFileSync(RESULTS_PATH, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ ...out, perArm: Object.fromEntries(Object.entries(perArm).map(([k, v]) => [k, { ...v, examples: `${v.examples.length} examples`, pacingRows: undefined, said: { ...v.said, sample: `${v.said.sample.length} lines`, random20: undefined } }])) }, null, 1));
  writeFileSync(RESULTS_MD_PATH, renderMarkdown(out));
}

// ---------------------------------------------------------------- report fragment

const P = (x, d = 1) => (x == null ? 'n/a' : `${(x * 100).toFixed(d)}%`);
const N = (x, d = 2) => (x == null ? 'n/a' : Number(x).toFixed(d));
const mix = (o) => (Object.keys(o).length ? Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') : '—');

function renderMarkdown(o) {
  const L = [];
  const p = (s = '') => L.push(s);
  const arms = RUN_ARMS.map((a) => [a, o.perArm[a]]);
  p('### Measures by arm');
  p();
  p(`| Measure | ${arms.map(([a]) => `${a}: ${ARM_LABELS[a]}`).join(' | ')} |`);
  p(`|---|${arms.map(() => '---').join('|')}|`);
  const row = (label, f) => p(`| ${label} | ${arms.map(([, x]) => f(x)).join(' | ')} |`);
  row('Calls analyzed (complete checks × 2)', (x) => String(x.calls));
  row('Anticipation candidates per call (mean)', (x) => N(x.anticipation.meanPerCall));
  row('Paired difference vs A (relative)', (x) => (x.anticipation.ci95 ? `${P(x.anticipation.pairedRelative)} [${P(x.anticipation.ci95.lo)}, ${P(x.anticipation.ci95.hi)}]` : '—'));
  row('Declaration rate (calls)', (x) => `${P(x.declarationRate)} (${x.declaringCalls})`);
  row('Checks with ≥1 declaring rep', (x) => P(x.declaringCheckShare));
  row('Minted calls per declaring call', (x) => N(x.callsPerDeclaringCall));
  row('Calls on this_session / this_battle', (x) => `${P(x.longHorizonShare)} of ${x.totalCalls}`);
  row('…called shots only', (x) => P(x.shotLongHorizonShare));
  row('`said` inconsistency (called shots)', (x) => `${P(x.said.rate)} (${x.said.inconsistent}/${x.said.shots})`);
  row('Decision agreement with A (rep-aligned)', (x) => P(x.decisionAgreementWithA));
  row('`max_tokens` stop rate', (x) => `${P(x.health.maxTokensRate, 2)} (${x.health.maxTokens})`);
  row('`invalid_tool_result` rate', (x) => `${P(x.health.invalidToolResultRate, 2)} (${x.health.invalid})`);
  if (o.round === 2) row('…one-sided Fisher p vs A', (x) => (x.health.fisherP == null ? '—' : N(x.health.fisherP, 3)));
  row('No `tool_use` block', (x) => String(x.health.noToolUse));
  row('Output tokens p50 / p95', (x) => `${x.health.outputP50} / ${x.health.outputP95}`);
  row('Input tokens (mean, billed)', (x) => N(x.health.inputMean, 0));
  row('Tool size (serialized chars)', (x) => String(x.size.toolChars));
  row('`countTokens` input, largest request', (x) => String(x.size.countTokensLargest));
  p();
  p(`**Noise floor (A rep 1 vs A rep 2):** anticipation ${P(o.noise.anticipationRelative)} [${P(o.noise.anticipationCi95.lo)}, ${P(o.noise.anticipationCi95.hi)}]; decision agreement ${P(o.noise.decisionAgreementA1A2)}.`);
  p();
  p('### Kind mix, horizon mix, validator removals');
  p();
  p('| Arm | Kinds | Horizons (all calls; fork = next_check) | Removed by validator |');
  p('|---|---|---|---|');
  for (const [a, x] of arms) p(`| ${a} | ${mix(x.kindMix)} | ${mix(x.horizonMix)} | ${mix(x.removals)} |`);
  p();
  p('### Pass table (§5, frozen bars)');
  p();
  p(`| Bar | ${CANDIDATE_ARMS.join(' | ')} |`);
  p(`|---|${CANDIDATE_ARMS.map(() => '---').join('|')}|`);
  const R2b = o.round === 2;
  const bars = [
    ['anticipation', 'Anticipation: paired diff ≥ −10% and CI low ≥ −20%'],
    ['declarationRate', R2b ? 'Declaration rate 15%–40% of calls' : 'Declaration rate ≥ 15%'],
    ['horizon', '≥ 50% of calls this_session / this_battle'],
    ['said', R2b ? 'Added conditions in `said` ≤ 10% of called shots' : '`said` inconsistency ≤ 10%'],
    ['decisionAgreement', 'Decision agreement ≥ A1-vs-A2 − 5 pts'],
    ['health', R2b ? '`max_tokens` ≤ 2%, invalid ≤ 3% and Fisher p ≥ 0.05' : '`max_tokens` ≤ 2% and invalid ≤ A + 1 pt'],
  ];
  for (const [k, label] of bars) p(`| ${label} | ${CANDIDATE_ARMS.map((a) => (o.pass[a].bars[k] ? 'PASS' : 'FAIL')).join(' | ')} |`);
  p(`| **Overall** | ${CANDIDATE_ARMS.map((a) => (o.pass[a].overall ? '**PASS**' : '**FAIL**')).join(' | ')} |`);
  if (R2b) {
    p();
    p('### Pacing per battle-day, by archetype (mean of the two reps; mean · median · min–max across battle-days)');
    p();
    p('| Arm | Archetype | Battle-days | Checks per battle-day | Declaring checks per battle-day | Minted calls per battle-day |');
    p('|---|---|---|---|---|---|');
    const sm = (q) => `${N(q.mean, 1)} · ${N(q.median, 1)} · ${N(q.min, 1)}–${N(q.max, 1)}`;
    for (const [a, x] of arms) for (const [arch, q] of Object.entries(x.pacingByArchetype)) p(`| ${a} | ${arch} | ${q.battleDays} | ${sm(q.checksPerBattleDay)} | ${sm(q.declaringChecks)} | ${sm(q.mintedCalls)} |`);
    p();
    p('### Health detail by field (`invalid_tool_result`, first failing field as production records it)');
    p();
    p('| Arm | Invalid / returned | Distinct checks | By field | By reason |');
    p('|---|---|---|---|---|');
    for (const [a, x] of arms) p(`| ${a} | ${x.health.invalid} / ${x.health.callsReturned} | ${x.health.invalidChecks} | ${mix(x.health.invalidByField)} | ${mix(x.health.invalidByReason)} |`);
    p();
    p('### `said` flags by matched term (a line can match more than one)');
    p();
    p('| Arm | Terms |');
    p('|---|---|');
    for (const [a, x] of arms) p(`| ${a} | ${mix(x.said.flagTerms)} |`);
    if (o.round1) {
      const d1 = o.round1.D; const d2 = o.perArm.D;
      p();
      p('### D: round 1 vs round 2');
      p();
      p('| Measure | D, round 1 | D, round 2 |');
      p('|---|---|---|');
      const both = (label, f) => p(`| ${label} | ${f(d1)} | ${f(d2)} |`);
      p(`| Checks (complete) | ${o.round1.checksComplete} | ${o.checksComplete} |`);
      both('Calls analyzed', (x) => String(x.calls));
      both('Anticipation per call (mean)', (x) => N(x.anticipation.meanPerCall));
      both('Paired difference vs A', (x) => `${P(x.anticipation.pairedRelative)} [${P(x.anticipation.ci95.lo)}, ${P(x.anticipation.ci95.hi)}]`);
      both('Declaration rate', (x) => `${P(x.declarationRate)} (${x.declaringCalls})`);
      both('Minted calls per declaring call', (x) => N(x.callsPerDeclaringCall));
      both('this_session / this_battle share', (x) => `${P(x.longHorizonShare)} of ${x.totalCalls}`);
      p(`| \`said\` flagged, round-1 rule | ${P(d1.said.rate)} (${d1.said.inconsistent}/${d1.said.shots}) | not computed |`);
      const r1r2 = o.round1.saidRound2RuleOnRound1D;
      p(`| \`said\` flagged, round-2 rule | ${P(r1r2.rate)} (${r1r2.flagged}/${r1r2.shots}) | ${P(d2.said.rate)} (${d2.said.inconsistent}/${d2.said.shots}) |`);
      both('Decision agreement with A', (x) => P(x.decisionAgreementWithA));
      p(`| A1-vs-A2 agreement (noise floor) | ${P(o.round1.noise.decisionAgreementA1A2)} | ${P(o.noise.decisionAgreementA1A2)} |`);
      both('`max_tokens` stops', (x) => `${P(x.health.maxTokensRate, 2)} (${x.health.maxTokens})`);
      both('`invalid_tool_result`', (x) => `${P(x.health.invalidToolResultRate, 2)} (${x.health.invalid})`);
      both('Output tokens p50 / p95', (x) => `${x.health.outputP50} / ${x.health.outputP95}`);
    }
  }
  p();
  p('### Flagged `said` lines (up to 10 per arm, agent text only)');
  for (const [a, x] of arms) {
    p();
    p(`**Arm ${a}** (${x.said.inconsistent} flagged of ${x.said.shots})`);
    if (!x.said.sample.length) p('- none');
    for (const f of x.said.sample) p(`- \`${f.symbol}\` · \`${f.horizonPhrase}\`: "${f.said}"${f.terms?.length ? ` — *${f.terms.join('; ')}*` : ''}`);
  }
  if (R2b) {
    p();
    p('### 20 randomly sampled `said` lines per arm, flagged or not (seeded, agent text only)');
    for (const [a, x] of arms) {
      p();
      p(`**Arm ${a}** (${x.said.random20.length} of ${x.said.shots})`);
      if (!x.said.random20.length) p('- none');
      x.said.random20.forEach((f, i) => p(`${i + 1}. ${f.flagged ? '**FLAGGED** ' : ''}\`${f.symbol}\` · \`${f.horizonPhrase}\`: "${f.said}"${f.terms.length ? ` — *${f.terms.join('; ')}*` : ''}`));
    }
  }
  p();
  p('### Example `declarations` blocks (five per arm, seeded pick, agent text only)');
  for (const [a, x] of arms) {
    p();
    p(`**Arm ${a}**${x.examples.length ? '' : ': no declaring call'}`);
    x.examples.forEach((e, i) => {
      p();
      p(`${i + 1}. ${e.archetype}, rep ${e.rep}`);
      p('```json');
      p(JSON.stringify(e.declarations, null, 1));
      p('```');
    });
  }
  return `${L.join('\n')}\n`;
}

// ================================================================ ROUND 3
//
// Round 3 brief (2026-10-02). The shipping 1a text (1A) and two variants (1A-C, 1A-CF) replay
// every recoverable check, two reps each; A and D are REUSED from round 2's raw records and never
// re-run. S2 is a labeled departure from byte-identical replay: 40 checks with one canonical
// directive inserted where production renders it. Every new call goes through the Message Batches
// API. USAGE (repo root), in order, each with --round=3:
//   select    round 2's gate, unchanged, into raw/round3/ (Firestore reads only; no model call)
//   s2        the reuse gate + the arm gate, then the S2 checks with their inserted directives
//   estimate  countTokens on the largest request per arm × its calls + 1,500 output tokens per call,
//             at Haiku 4.5 BATCH prices; STOP over $20
//   submit    one batch per sample (main, s2); each id lands in raw/round3/batches.json BEFORE any
//             poll; then collect
//   collect   poll every 60 s until every batch has ended, then write raw/round3/calls/ — resumable
//             by a later session from batches.json alone
//   analyze   the measures, forks, S2 and the frozen bars (bar 10 withdrawn by founder ruling)

const R3_REUSED_DIR = path.join(RAW_ROOT, 'round2');
const S2_PATH = path.join(RAW_DIR, 's2.json');
const BATCHES_PATH = path.join(RAW_DIR, 'batches.json');
const COLLECT_PATH = path.join(RAW_DIR, 'collect.json');
const S2_SIZE = 40;
/** S2's own seed (the founder ruling's date), so S2 never perturbs the main sample's draws. */
const S2_SEED = 20261002;
/** Batches API: every token at 50 % of list — Haiku 4.5 $0.50 / $2.50 per M (claude-api skill; docs batch-processing). */
const BATCH_FACTOR = 0.5;
const POLL_MS = 60_000;
/**
 * The pinned tool serializations (brief §0): 1A is PR #924's 'on' text, D is round 2's D, and A is
 * round 2's A as rebuilt from round 2's own commit (6f45dbc4) in the round-3 session.
 */
const TOOL_SHA256 = Object.freeze({
  A: '91c19f516152aa2b9afa405091fdeaaabaa7459935d599cfe73f855f489b50e5',
  D: '2a90e67b34a8b1fa2f4d1ad38f3e978858e47b395dfb6762a3c554e2126a3ee3',
  '1A': '81499cbcf2655ceba51a5b721d33ff918ce21382a4c3b76d9cc34e6bae1f1806',
  // Pinned once assertRound3Arms() passed (1A-C 13,623 chars; 1A-CF 14,031 chars): what submit may send.
  '1A-C': '7388755a59d31522417f0a7501ec4d7c6601dd1f8138a70da8659c467ee293a6',
  '1A-CF': 'a62b9ff7c33640d5d119270bdc540c0c0e0db7344cf6f8e317dce78359e3ea81',
});
const R2_MAX_TOKENS = 3072;
/** The Batches API's custom_id rule. ':' is not allowed, so the brief's arm:rep:battle:eval[:s2] uses '__'. */
const CUSTOM_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const customId = (arm, rep, c, s2) => `${arm}__${rep}__${c.battleId}__${c.evalId}${s2 ? '__s2' : ''}`;
const r3CallPath = (arm, rep, c, s2) => path.join(CALLS_DIR, `${arm}_${rep}_${checkKey(c)}${s2 ? '_s2' : ''}.json`);
const BENCH_PRESENT = 'BENCH (available for swap):';
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** Round 3's extra modules, loaded only here so rounds 1 and 2 keep their import graph. */
async function r3Modules() {
  const [dir, cpr, du, filing, adj, flags] = await Promise.all([
    import('./declarationsWordingDirective.mjs'),
    import('../api/_utils/controlPromptRenderer.js'),
    import('../api/_utils/directiveUtils.js'),
    import('../api/_utils/directiveFiling.js'),
    import('../src/data/archetypeAdjustments.js'),
    import('../src/config/featureFlags.js'),
  ]);
  return { dir, cpr, du, filing, adj, flags };
}

/** Round 2's A and D records (D2 is not part of round 3), keyed arm|rep|battle|eval. */
function reusedRecords() {
  const recs = new Map();
  for (const f of readdirSync(path.join(R3_REUSED_DIR, 'calls'))) {
    const r = readJson(path.join(R3_REUSED_DIR, 'calls', f));
    if (r.arm === 'A' || r.arm === 'D') recs.set(`${r.arm}|${r.rep}|${r.battleId}|${r.evalId}`, r);
  }
  return recs;
}

/**
 * Brief §0 step 3 — THE REUSE GATE. Throws (STOP) on any mismatch; never re-runs A or D. The
 * recorded requests are round 2's to the byte, so model, temperature and tool_choice are round
 * 2's; max_tokens is production's constant, 3,072 at HEAD and at round 2's commit.
 */
function reuseGate3(s) {
  const fail = (m) => { throw new Error(`STOP — reuse gate: ${m}`); };
  const shaOf = (arm) => sha256Utf8(JSON.stringify(armTool(arm)));
  for (const arm of ['A', 'D', '1A']) if (shaOf(arm) !== TOOL_SHA256[arm]) fail(`arm ${arm} serializes to ${shaOf(arm)}`);
  const r2 = readJson(path.join(R3_REUSED_DIR, 'sample.json'));
  const offTools = r2.sample.filter((c) => c.window === 'baseline').map((c) => JSON.stringify(c.request.tools[0]));
  if (!offTools.length || offTools.some((t) => t !== JSON.stringify(armTool('A')))) fail('arm A at HEAD is not the recorded off tool');
  if (s.sample.length !== r2.sample.length) fail(`${s.sample.length} recoverable checks, round 2 had ${r2.sample.length}`);
  s.sample.forEach((c, i) => {
    const o = r2.sample[i];
    if (c.battleId !== o.battleId || c.evalId !== o.evalId || c.tickId !== o.tickId || c.requestSha256 !== o.requestSha256) fail(`check #${i} is not round 2's`);
    if (JSON.stringify(c.request) !== JSON.stringify(o.request)) fail(`request bytes differ at ${c.battleId}:${c.evalId}`);
  });
  if (EVAL_MAX_OUTPUT_TOKENS !== R2_MAX_TOKENS) fail(`max_tokens ${EVAL_MAX_OUTPUT_TOKENS}`);
  for (const c of s.sample) {
    const q = replayRequest(c.request, '1A');
    if (q.model !== EVAL_MODEL_ID || q.temperature !== PROD_TEMPERATURE || q.max_tokens !== R2_MAX_TOKENS
      || JSON.stringify(q.tool_choice) !== JSON.stringify(PROD_TOOL_CHOICE)) fail(`parameters at ${c.battleId}:${c.evalId}`);
  }
  // Round 2's own gate recorded that ITS arm A equalled the same 43 recorded off tools (review L1-4).
  const drift = r2.storedToolDrift?.baseline;
  if (!drift || drift.equalsHeadA !== offTools.length || drift.other !== 0) fail('round 2 did not record its arm A as the recorded off tool');
  // Every recorded body still hashes to the permanent Firestore record (review L1-7).
  for (const c of s.sample) if (sha256Utf8(JSON.stringify(c.request)) !== c.requestSha256) fail(`request at ${c.battleId}:${c.evalId} no longer hashes to its tick record`);
  const recs = reusedRecords();
  for (const c of s.sample) for (const arm of ARMS_ROUND3_REUSED) for (let rep = 1; rep <= REPS; rep += 1) {
    const r = recs.get(`${arm}|${rep}|${c.battleId}|${c.evalId}`);
    if (!r) fail(`no ${arm} rep ${rep} for ${c.battleId}:${c.evalId}`);
    if (r.model !== EVAL_MODEL_ID || r.tickId !== c.tickId) fail(`${arm} rep ${rep} for ${c.battleId}:${c.evalId} is another model or tick`);
  }
  // Reused A and D are re-validated with these universes and expiries: they must be round 2's (review L1-6).
  const metaEqual = JSON.stringify(s.battlesMeta) === JSON.stringify(r2.battlesMeta);
  if (!metaEqual) fail('battle metadata (archetype, universe, expiry) differs from round 2');
  return {
    toolSha256: { A: shaOf('A'), D: shaOf('D'), '1A': shaOf('1A') }, offToolChecks: offTools.length,
    checks: s.sample.length, reusedRecords: s.sample.length * ARMS_ROUND3_REUSED.length * REPS,
    model: EVAL_MODEL_ID, temperature: PROD_TEMPERATURE, maxTokens: R2_MAX_TOKENS, toolChoice: PROD_TOOL_CHOICE,
    battlesMetaEqualRound2: metaEqual,
  };
}

/** The recorded leans block (its own lines, no separators), or null. */
function leansBlockOf(live, header) {
  const i = live.indexOf(`\n\n${header}`);
  if (i < 0) return null;
  const j = live.indexOf('\n\n', i + 2);
  return live.slice(i + 2, j < 0 ? undefined : j);
}

/**
 * S2 (brief §2, founder ruling 2026-10-02), derived deterministically from the sample: 40
 * recoverable checks with a bench to choose from, spread across battles, every archetype present;
 * per check, a seeded pick among its archetype's sector/style restrictions minus the battle's
 * equipped leans, filed as the chip route files it and rendered by the assembler's own read.
 */
function deriveS2(s, M) {
  const stop = (m) => { throw new Error(`STOP — S2: ${m}`); };
  const rand = rng(S2_SEED);
  const live = (c) => c.request.messages[2].content;
  const eligible = s.sample.filter((c) => typeof live(c) === 'string' && live(c).includes(BENCH_PRESENT) && !live(c).includes(M.dir.DIRECTIVE_HEADER));
  const byBattle = new Map();
  for (const c of eligible) (byBattle.get(c.battleId) || byBattle.set(c.battleId, []).get(c.battleId)).push(c);
  const battleIds = [...byBattle.keys()].sort();
  const order = shuffle(battleIds, rand);
  const quota = Object.fromEntries(battleIds.map((b) => [b, 0]));
  let left = S2_SIZE; let progressed = true;
  while (left > 0 && progressed) {
    progressed = false;
    for (const b of order) if (left > 0 && quota[b] < byBattle.get(b).length) { quota[b] += 1; left -= 1; progressed = true; }
  }
  if (left > 0) stop(`only ${S2_SIZE - left} eligible checks`);
  const picked = [];
  for (const b of battleIds) {
    const list = [...byBattle.get(b)].sort((x, y) => x.ms - y.ms);
    const k = quota[b];
    for (let i = 0; i < k; i += 1) {
      const lo = Math.floor((i * list.length) / k);
      const hi = Math.floor(((i + 1) * list.length) / k);
      picked.push(list[lo + Math.floor(rand() * (hi - lo))]);
    }
  }
  for (const a of new Set(s.sample.map((c) => c.archetype))) if (!picked.some((c) => c.archetype === a)) stop(`archetype ${a} absent`);
  const leansHeader = M.dir.POST_DIRECTIVE_HEADERS[0];
  const modes = { archetypeIntegrityMode: M.flags.ARCHETYPE_INTEGRITY_MODE, standingLeansEnabled: M.flags.STANDING_LEANS_ENABLED };
  const checks = picked.map((c) => {
    const text0 = live(c);
    const leanIds = M.dir.equippedLeanIds(text0, c.archetype);
    const pool = (M.dir.S2_DIRECTIVE_POOL[c.archetype] || []).filter((id) => !leanIds.includes(id));
    if (!pool.length) stop(`no directive left for ${c.battleId}:${c.evalId}`);
    const adjustmentId = pool[Math.floor(rand() * pool.length)];
    const text = M.adj.getCanonicalText(c.archetype, adjustmentId);
    const canonicalTextVersion = M.adj.getCanonicalTextVersion(c.archetype, adjustmentId);
    if (!text || canonicalTextVersion == null) stop(`${adjustmentId} is not on the ${c.archetype} menu`);
    const directiveThreadId = M.dir.seededUuidV4(rand);
    const createdAt = new Date(c.promptBuiltAtMs - 10 * 60_000).toISOString();
    // The chip route's slot (api/agent/file-directive.js:270-278 → directiveFiling.js buildDirectiveSlot).
    const slot = M.filing.buildDirectiveSlot({ text, expiry: 'end_of_battle', adjustmentId, canonicalTextVersion }, directiveThreadId, createdAt);
    // The assembler's read (agentEvalPromptAssembly.js:1229-1242) with this battle's rendered leans. A
    // fresh thread id has no lean override bound to it and no epoch kill, so [] stands for both.
    const standingLeans = leanIds.map((id) => ({ adjustmentId: id, version: M.adj.getCanonicalTextVersion(c.archetype, id), text: M.adj.getCanonicalText(c.archetype, id) }));
    const active = M.du.isDirectiveActive(slot, {});
    const without = M.cpr.renderControlBlocks(M.cpr.resolveControls({ modes, directive: null, standingLeans, leanOverrides: [], controlEpochLog: [] }));
    const withIt = M.cpr.renderControlBlocks(M.cpr.resolveControls({ modes, directive: active ? slot : null, standingLeans, leanOverrides: [], controlEpochLog: [] }));
    const recordedLeans = leansBlockOf(text0, leansHeader);
    if ((without.directiveBlock ?? null) !== null || (without.leansBlock ?? null) !== recordedLeans) stop(`the leans do not re-render as recorded at ${c.battleId}:${c.evalId}`);
    if (!active || !withIt.directiveBlock || withIt.suppressionDescriptors.length) stop(`the directive does not render at ${c.battleId}:${c.evalId}`);
    if ((withIt.leansBlock ?? null) !== recordedLeans) stop(`the directive would change the leans at ${c.battleId}:${c.evalId}`);
    const ins = M.dir.insertDirectiveBlock(text0, withIt.directiveBlock);
    if (ins.text !== `${text0.slice(0, ins.index)}\n\n${withIt.directiveBlock}${text0.slice(ins.index)}`) stop('insertion is not a pure insertion');
    const request = structuredClone(c.request);
    request.messages[2].content = ins.text;
    const blank = (q) => { const x = structuredClone(q); x.messages[2].content = ''; return JSON.stringify(x); };
    if (blank(request) !== blank(c.request)) stop('S2 changed more than the live context');
    return {
      battleId: c.battleId, evalId: c.evalId, tickId: c.tickId, archetype: c.archetype, day: c.day, ms: c.ms, window: c.window,
      promptBuiltAtMs: c.promptBuiltAtMs, mintedAtMs: c.mintedAtMs, requestSha256: c.requestSha256,
      s2RequestSha256: sha256Utf8(JSON.stringify(request)), leanIds, pool,
      directive: { adjustmentId, text, canonicalTextVersion, directiveThreadId, createdAt, slot },
      directiveBlock: withIt.directiveBlock, insertedBefore: ins.before, insertedAt: ins.index, request,
    };
  });
  return { seed: S2_SEED, size: S2_SIZE, eligible: eligible.length, excludedNoBench: s.sample.length - eligible.length, quota, checks };
}

async function selectS2() {
  const M = await r3Modules();
  const s = readJson(SAMPLE_PATH);
  const reuse = reuseGate3(s);
  const armGate = assertRound3Arms();
  const out = { createdAt: new Date().toISOString(), reuseGate: reuse, armGate, ...deriveS2(s, M) };
  writeFileSync(S2_PATH, JSON.stringify(out, null, 1));
  const tally = (f) => out.checks.reduce((o, c) => inc(o, f(c)), {});
  console.log(JSON.stringify({
    reuseGate: reuse, armGate, eligible: out.eligible, excludedNoBench: out.excludedNoBench, n: out.checks.length,
    quota: out.quota, byArchetype: tally((c) => c.archetype), byDirective: tally((c) => c.directive.adjustmentId),
    insertedBefore: tally((c) => c.insertedBefore ?? '(end)'), withLeans: tally((c) => (c.leanIds.length ? c.leanIds.join('+') : 'none')),
  }, null, 1));
}

/** Re-derive S2 from the sample and require it to equal raw/round3/s2.json to the byte. */
function verifyS2(s, s2, M) {
  const again = deriveS2(s, M);
  if (JSON.stringify(again.checks) !== JSON.stringify(s2.checks)) throw new Error('STOP — s2.json no longer derives from the sample');
}

/** Every round-3 call: the main sample × 1A/1A-C/1A-CF × 2 reps, then S2 × 1A-C/1A-CF × 2 reps. */
function r3Plan(s, s2) {
  const plan = [];
  for (const check of s.sample) for (const arm of ARMS_ROUND3_NEW) for (let rep = 1; rep <= REPS; rep += 1) plan.push({ arm, rep, check, s2: false });
  for (const check of s2.checks) for (const arm of ARMS_ROUND3_S2) for (let rep = 1; rep <= REPS; rep += 1) plan.push({ arm, rep, check, s2: true });
  return plan;
}

async function estimate3() {
  const M = await r3Modules();
  const s = readJson(SAMPLE_PATH);
  const s2 = readJson(S2_PATH);
  const reuse = reuseGate3(s);
  const armGate = assertRound3Arms();
  verifyS2(s, s2, M);
  const plan = r3Plan(s, s2);
  const anthropic = client();
  const perArm = {};
  let total = 0;
  for (const arm of ARMS_ROUND3_NEW) {
    const tasks = plan.filter((t) => t.arm === arm);
    // The LARGEST request this arm will send (main or S2), so the estimate is conservative.
    const largest = tasks.reduce((a, t) => (JSON.stringify(replayRequest(t.check.request, arm)).length > JSON.stringify(replayRequest(a.check.request, arm)).length ? t : a));
    const req = replayRequest(largest.check.request, arm);
    const { input_tokens: inputTokens } = await anthropic.messages.countTokens({
      model: req.model, system: req.system, messages: req.messages, tools: req.tools, tool_choice: req.tool_choice,
    });
    const usd = (tasks.length * (inputTokens * PRICE_IN + OUTPUT_ALLOWANCE_TOKENS * PRICE_OUT) * BATCH_FACTOR) / 1e6;
    perArm[arm] = {
      inputTokens, toolChars: JSON.stringify(armTool(arm)).length, basis: `${largest.check.battleId}:${largest.check.evalId}${largest.s2 ? ' (s2)' : ''}`,
      calls: tasks.length, mainCalls: tasks.filter((t) => !t.s2).length, s2Calls: tasks.filter((t) => t.s2).length, usd,
    };
    total += usd;
  }
  const out = {
    reuseGate: reuse, armGate, perArm, totalCalls: plan.length, totalUsd: total, ceilingUsd: COST_CEILING_USD,
    pricing: { inPerM: PRICE_IN * BATCH_FACTOR, outPerM: PRICE_OUT * BATCH_FACTOR, outputAllowance: OUTPUT_ALLOWANCE_TOKENS, batch: true },
    pass: total <= COST_CEILING_USD,
  };
  writeFileSync(ESTIMATE_PATH, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  if (!out.pass) { console.error(`STOP: estimate $${total.toFixed(2)} exceeds $${COST_CEILING_USD}`); process.exitCode = 2; }
}

/**
 * A client for the Batches API with a long upload timeout. Creates use maxRetries 0 (a retried
 * create could duplicate a batch); reads (retrieve, results) are idempotent and may retry.
 */
function batchClient(maxRetries = 0) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (typeof apiKey !== 'string' || !apiKey.startsWith('sk-ant-')) {
    throw new Error('CLAUDE_API_KEY missing from .env.local or not an sk-ant- key (value not printed)');
  }
  return new Anthropic({ apiKey, maxRetries, timeout: 600_000 });
}

/** JSON through a temp file and a rename: a kill mid-write never truncates the only record of a batch id. */
function writeJsonAtomic(p, value) {
  writeFileSync(`${p}.tmp`, JSON.stringify(value, null, 1));
  renameSync(`${p}.tmp`, p);
}

async function submit3() {
  const M = await r3Modules();
  const est = readJson(ESTIMATE_PATH);
  if (!est.pass) throw new Error(`estimate $${est.totalUsd} exceeds the ceiling — not submitting`);
  const prior = existsSync(BATCHES_PATH) ? readJson(BATCHES_PATH) : null;
  // A create that died mid-flight may still have made a batch: never guess — check the Batches list, then clear `pending` by hand.
  if (prior?.pending) throw new Error(`a create for '${prior.pending}' never confirmed — check the Batches list before resubmitting`);
  const s = readJson(SAMPLE_PATH);
  const s2 = readJson(S2_PATH);
  reuseGate3(s);
  assertRound3Arms();
  verifyS2(s, s2, M);
  const plan = r3Plan(s, s2);
  if (plan.length !== est.totalCalls) throw new Error(`plan ${plan.length} ≠ estimate ${est.totalCalls}`);
  const manifest = {};
  const groups = { main: [], s2: [] };
  // Every request, before anything is sent: the arm's pinned tool bytes, production's max_tokens, and
  // otherwise the recorded body (main) or the S2 body — which deriveS2 proved is the recorded body
  // plus the directive block — to the byte.
  const recorded = new Map(s.sample.map((c) => [`${c.battleId}:${c.evalId}`, c.request]));
  const rest = (q) => JSON.stringify(Object.fromEntries(Object.entries(q).filter(([k]) => k !== 'tools' && k !== 'max_tokens')));
  for (const t of plan) {
    const id = customId(t.arm, t.rep, t.check, t.s2);
    if (!CUSTOM_ID.test(id) || manifest[id]) throw new Error(`bad or duplicate custom_id ${id}`);
    const params = replayRequest(t.check.request, t.arm);
    const base = recorded.get(`${t.check.battleId}:${t.check.evalId}`);
    if (params.tools.length !== 1 || sha256Utf8(JSON.stringify(params.tools[0])) !== TOOL_SHA256[t.arm]) throw new Error(`${id}: not the ${t.arm} tool`);
    if (params.max_tokens !== R2_MAX_TOKENS || JSON.stringify(Object.keys(params)) !== JSON.stringify(EXPECTED_KEYS)) throw new Error(`${id}: parameters`);
    if (!t.s2 && (t.check.request !== base || rest(params) !== rest(base))) throw new Error(`${id}: not the recorded body`);
    if (t.s2 && (rest(params) !== rest(t.check.request) || sha256Utf8(JSON.stringify(t.check.request)) !== t.check.s2RequestSha256
      || !params.messages[2].content.includes(t.check.directiveBlock) || base.messages[2].content.includes('ACTIVE DIRECTIVE'))) throw new Error(`${id}: not the S2 body`);
    manifest[id] = { arm: t.arm, rep: t.rep, battleId: t.check.battleId, evalId: t.check.evalId, tickId: t.check.tickId, s2: t.s2, paramsSha256: sha256Utf8(JSON.stringify(params)) };
    groups[t.s2 ? 's2' : 'main'].push({ custom_id: id, params });
  }
  // Checked before --dry-run returns, so a passing dry run also proves the batches on record are this plan's (review L1-8).
  if (prior && JSON.stringify(prior.manifest) !== JSON.stringify(manifest)) throw new Error('batches.json holds another plan — not submitting');
  if (process.argv.includes('--dry-run')) {
    const size = (g) => Buffer.byteLength(JSON.stringify({ requests: g }), 'utf8');
    console.log(JSON.stringify({ dryRun: true, requests: plan.length, priorPlanMatches: prior ? true : null, byArmAndSample: Object.values(manifest).reduce((o, m) => inc(o, `${m.arm}${m.s2 ? ' s2' : ''}`), {}), mb: { main: size(groups.main) / 1e6, s2: size(groups.s2) / 1e6 } }, null, 1));
    return;
  }
  const record = prior ?? { createdAt: new Date().toISOString(), estimateUsd: est.totalUsd, model: EVAL_MODEL_ID, batches: [], manifest };
  const save = () => writeJsonAtomic(BATCHES_PATH, record);
  save();
  const anthropic = batchClient();
  // The small batch first: a failed large upload then leaves a complete, collectable s2 on record.
  for (const label of ['s2', 'main']) {
    if (record.batches.some((b) => b.label === label)) { console.log(`batch ${label} already on record — not resubmitted`); continue; }
    const requests = groups[label];
    const bytes = Buffer.byteLength(JSON.stringify({ requests }), 'utf8');
    console.log(`creating batch ${label}: ${requests.length} requests, ${(bytes / 1e6).toFixed(1)} MB`);
    record.pending = label;
    save();
    const b = await anthropic.messages.batches.create({ requests });
    // On screen first: if the save below fails, the id is still recoverable (review L4-6).
    console.log(`batch ${label}: ${b.id} (${b.processing_status})`);
    record.batches.push({ label, id: b.id, createdAt: b.created_at, requests: requests.length, bytes, status: b.processing_status });
    delete record.pending;
    // The id is on disk BEFORE any poll, so a later session can collect.
    save();
  }
  await collect3();
}

/** A permanent request error (bad id, bad key): polling again cannot help. */
const permanentError = (err) => Number.isInteger(err?.status) && err.status >= 400 && err.status < 500 && ![408, 409, 429].includes(err.status);

async function collect3() {
  const record = readJson(BATCHES_PATH);
  // An unconfirmed create may have made a batch this record does not hold: collecting now would
  // report a partial run as whole (review L4-1).
  if (record.pending) throw new Error(`STOP — a create for '${record.pending}' never confirmed: check the Batches list and record its id before collecting`);
  if (!record.batches?.length) throw new Error('no batch on record — run submit --round=3');
  const reader = batchClient(4);
  for (;;) {
    let ended = 0;
    for (const b of record.batches) {
      try {
        const x = await reader.messages.batches.retrieve(b.id);
        Object.assign(b, { status: x.processing_status, requestCounts: x.request_counts, endedAt: x.ended_at ?? null });
      } catch (err) {
        if (permanentError(err)) throw err;
        console.log(`poll error on ${b.id}: ${err?.status ?? err?.name ?? ''} ${String(err?.message || err).slice(0, 160)}`);
      }
      if (b.status === 'ended') ended += 1;
    }
    writeJsonAtomic(BATCHES_PATH, record);
    console.log(`${new Date().toISOString()} ${record.batches.map((b) => `${b.label} ${b.status} ${JSON.stringify(b.requestCounts ?? {})}`).join(' | ')}`);
    if (ended === record.batches.length) break;
    await sleep(POLL_MS);
  }
  mkdirSync(CALLS_DIR, { recursive: true });
  const byType = {};
  const failures = [];
  const usage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  const seen = new Set();
  let written = 0;
  for (const b of record.batches) {
    // One batch's results, whole or not at all: a dropped stream is retried from the start, and
    // nothing is counted until the batch has been read to its end (writes are idempotent).
    let got = null;
    for (let attempt = 1; got === null; attempt += 1) {
      try {
        const rows = [];
        for await (const res of await reader.messages.batches.results(b.id)) rows.push(res);
        got = rows;
      } catch (err) {
        if (permanentError(err) || attempt >= 3) throw err;
        console.log(`results stream for ${b.id} failed (attempt ${attempt}): ${String(err?.message || err).slice(0, 160)}`);
        await sleep(5_000 * attempt);
      }
    }
    for (const res of got) {
      const m = record.manifest[res.custom_id];
      if (!m) throw new Error(`unknown custom_id ${res.custom_id}`);
      if (seen.has(res.custom_id)) throw new Error(`custom_id ${res.custom_id} returned twice`);
      seen.add(res.custom_id);
      inc(byType, `${b.label}:${res.result.type}`);
      if (res.result.type !== 'succeeded') {
        failures.push({ batch: b.id, label: b.label, customId: res.custom_id, type: res.result.type, error: res.result.error ?? null });
        continue;
      }
      const msg = res.result.message;
      const toolUse = msg.content?.find((x) => x.type === 'tool_use') ?? null;
      writeFileSync(r3CallPath(m.arm, m.rep, m, m.s2), JSON.stringify({
        messageId: msg.id, customId: res.custom_id, batchId: b.id, arm: m.arm, rep: m.rep, battleId: m.battleId, evalId: m.evalId,
        tickId: m.tickId, s2: m.s2, toolUseInput: toolUse ? toolUse.input : null, stopReason: msg.stop_reason, usage: msg.usage,
        model: msg.model, at: new Date().toISOString(),
      }));
      written += 1;
      usage.input += msg.usage?.input_tokens || 0;
      usage.output += msg.usage?.output_tokens || 0;
      usage.cacheWrite += msg.usage?.cache_creation_input_tokens || 0;
      usage.cacheRead += msg.usage?.cache_read_input_tokens || 0;
    }
  }
  // Every request on record came back exactly once (review L1-9 / L4-8).
  const missing = Object.keys(record.manifest).filter((id) => !seen.has(id));
  writeFileSync(FAILURES_PATH, failures.map((f) => JSON.stringify(f)).join('\n') + (failures.length ? '\n' : ''));
  const actualUsd = ((usage.input * PRICE_IN + usage.output * PRICE_OUT + usage.cacheWrite * PRICE_IN * 1.25 + usage.cacheRead * PRICE_IN * 0.1) * BATCH_FACTOR) / 1e6;
  const out = {
    collectedAt: new Date().toISOString(), batches: record.batches.map(({ label, id, requests, status, requestCounts, endedAt }) => ({ label, id, requests, status, requestCounts, endedAt })),
    byType, written, failures: failures.length, missing: missing.length, missingIds: missing.slice(0, 50),
    complete: missing.length === 0, usage, actualUsd, estimateUsd: record.estimateUsd,
  };
  writeFileSync(COLLECT_PATH, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  if (missing.length) console.error(`STOP: ${missing.length} request(s) on record came back with no result — collect.json marks the run incomplete`);
}

const FORK_FIELDS = Object.freeze(['slot', 'swapOut', 'options', 'said']);

/**
 * The fork the model offered, if any (reviews L3-1, L3-3): an object `fork` carrying at least one
 * of slot / swapOut / options / said — in an object block, or in a block the model sent as a JSON
 * string (the calls validator removes such a block whole: offered, never surviving). Any other
 * non-null value (`{}`, `false`, a bare string…) is a placeholder, tallied apart.
 */
function forkOf(input) {
  let d = input?.declarations;
  let stringBlock = false;
  if (typeof d === 'string') {
    stringBlock = true;
    try { d = JSON.parse(d); } catch { return /"fork"\s*:\s*\{/.test(d) ? { fork: {}, stringBlock, unparsable: true } : null; }
  }
  if (!d || typeof d !== 'object' || Array.isArray(d) || d.fork == null) return null;
  const f = d.fork;
  const real = typeof f === 'object' && !Array.isArray(f) && FORK_FIELDS.some((k) => f[k] != null);
  return real ? { fork: f, stringBlock } : { placeholder: f, stringBlock };
}
const optionsOf = (fork) => (Array.isArray(fork?.options)
  ? fork.options.map((o) => (o && typeof o === 'object' ? { symbol: o.symbol ?? null, why: o.why ?? null } : { raw: o }))
  : fork?.options ?? null);

/**
 * Fork measures over a set of calls: offered, surviving, why not, respondsToDirective. A fork
 * survives only as production would carry it to the player: the trade result is valid (production
 * captures declarations on that branch alone — api/cron/agent-evaluate.js:2851-2866) AND the calls
 * validator keeps it.
 */
function forkMeasures(calls, validate, hasDirective) {
  let offered = 0; let surviving = 0; let respondsTrue = 0; let respondsTrueNoDirective = 0; let placeholders = 0; let strayForks = 0;
  const removed = {}; const rows = [];
  for (const { c, rep, r } of calls) {
    // A fork written at the TOP level of the tool input, outside `declarations`: production never
    // reads it, so it is not offered — counted apart so an attempt is never invisible (review VA-1).
    const top = r.toolUseInput?.fork;
    if (top && typeof top === 'object' && !Array.isArray(top) && FORK_FIELDS.some((k) => top[k] != null)) strayForks += 1;
    const got = forkOf(r.toolUseInput);
    if (got === null) continue;
    if (!got.fork) { placeholders += 1; continue; }
    offered += 1;
    const f = got.fork;
    let kept = null; let removal = null;
    if (got.stringBlock) removal = 'block:malformed_block (sent as a string)';
    else if (!validateTradeToolResult(r.toolUseInput).valid) removal = 'trade:invalid_tool_result';
    else {
      const v = validate(c, r.toolUseInput);
      kept = v.validation.validated?.fork ?? null;
      if (!kept) {
        const rm = v.validation.removed.find((x) => x.source === 'fork') ?? v.validation.removed.find((x) => x.source === 'block');
        removal = rm ? `${rm.source}:${rm.reason}` : 'not kept';
      }
    }
    if (kept) surviving += 1; else inc(removed, removal);
    const responds = f.respondsToDirective ?? null;
    if (responds === true) { respondsTrue += 1; if (!hasDirective(c)) respondsTrueNoDirective += 1; }
    rows.push({
      check: `${c.battleId}:${c.evalId}`, archetype: c.archetype, rep, slot: f.slot ?? null, swapOut: f.swapOut ?? null,
      options: optionsOf(f), said: f.said ?? null, respondsToDirective: responds, survived: !!kept, removal,
      decision: r.toolUseInput?.decision ?? null, swap: r.toolUseInput?.decision === 'SWAP' ? `${r.toolUseInput.symbolOut}→${r.toolUseInput.symbolIn}` : null,
    });
  }
  return {
    calls: calls.length, offered, rate: calls.length ? offered / calls.length : null, surviving,
    survivalRate: offered ? surviving / offered : null, removed, placeholders, strayForks, respondsTrue, respondsTrueNoDirective,
    respondsShare: offered ? respondsTrue / offered : null, rows,
  };
}

/**
 * The held and bench symbols a recorded live context shows (its ACTIVE POSITIONS and BENCH CSVs,
 * read by their Symbol column). Production judges fork options against the universe frozen at
 * each check's model seam (callRecords/observe.js:102-104); the replay has only the battle's END
 * state, so a check's universe is that roster plus every name its own prompt showed (review L2-1).
 */
function promptSymbols(live) {
  const out = new Set();
  for (const header of ['ACTIVE POSITIONS:', BENCH_PRESENT]) {
    const i = live.indexOf(`${header}\n`);
    if (i < 0) continue;
    const lines = live.slice(i).split('\n\n')[0].split('\n');
    const col = (lines[1] || '').split(',').indexOf('Symbol');
    if (col < 0) continue;
    for (const line of lines.slice(2)) { const sym = (line.split(',')[col] || '').trim(); if (sym) out.add(sym); }
  }
  return out;
}

/** The pinned bytes of round 2's own results.json — a rerun of `analyze --round=2` rewrites its analyzedAt (review L5-1). */
const R2_RESULTS_SHA256 = '3fb9006a9ba729f1cd8624353eaafde17c524e571a24a33c2271b74e6434c58c';
const EPS = 1e-9;
/** A bar's comparisons: a number that clears the line (ties pass despite binary rounding); no number never does (reviews L1-2, L3-2, L3-5, L4-4). */
const atLeast = (x, line) => typeof x === 'number' && Number.isFinite(x) && x >= line - EPS;
const atMost = (x, line) => typeof x === 'number' && Number.isFinite(x) && x <= line + EPS;

async function analyze3() {
  const M = await r3Modules();
  const s = readJson(SAMPLE_PATH);
  const s2 = readJson(S2_PATH);
  const est3 = existsSync(ESTIMATE_PATH) ? readJson(ESTIMATE_PATH) : null;
  const est2 = readJson(path.join(R3_REUSED_DIR, 'estimate.json'));
  const est = { perArm: { A: est2.perArm.A, D: est2.perArm.D, ...(est3?.perArm ?? {}) } };
  const reused = reusedRecords();
  const main = new Map(); const sub = new Map();
  for (const f of readdirSync(CALLS_DIR)) {
    const r = readJson(path.join(CALLS_DIR, f));
    const into = r.s2 ? sub : main;
    const key = `${r.arm}|${r.rep}|${r.battleId}|${r.evalId}`;
    // A record lives in the file its own fields name, once: a relabelled copy can never mask another (review L6, mutant M19b).
    if (path.basename(r3CallPath(r.arm, r.rep, r, r.s2)) !== f || into.has(key)) throw new Error(`STOP — ${f} does not hold the record its name says, or repeats one`);
    into.set(key, r);
  }

  // Every record is the one the manifest sent, every submitted request is still on disk as sent, and
  // every request has a record or a reported failure (reviews L3-11, L4-2); a partial collection is
  // analyzed only with --allow-partial.
  const record = readJson(BATCHES_PATH);
  const failedIds = new Set((existsSync(FAILURES_PATH) ? readFileSync(FAILURES_PATH, 'utf8').trim().split('\n').filter(Boolean) : []).map((l) => JSON.parse(l).customId));
  const seenIds = new Set();
  for (const r of [...main.values(), ...sub.values()]) {
    const m = record.manifest[r.customId];
    if (!m || m.arm !== r.arm || m.rep !== r.rep || m.battleId !== r.battleId || m.evalId !== r.evalId || m.s2 !== r.s2) throw new Error(`STOP — record ${r.customId} is not what the manifest sent`);
    seenIds.add(r.customId);
  }
  const mainOf = new Map(s.sample.map((c) => [`${c.battleId}:${c.evalId}`, c]));
  const s2Of = new Map(s2.checks.map((c) => [`${c.battleId}:${c.evalId}`, c]));
  for (const [id, m] of Object.entries(record.manifest)) {
    const c = (m.s2 ? s2Of : mainOf).get(`${m.battleId}:${m.evalId}`);
    if (!c || sha256Utf8(JSON.stringify(replayRequest(c.request, m.arm))) !== m.paramsSha256) throw new Error(`STOP — ${id}: the request on disk is not the one submitted`);
  }
  const unaccounted = Object.keys(record.manifest).filter((id) => !seenIds.has(id) && !failedIds.has(id));
  if (unaccounted.length && !process.argv.includes('--allow-partial')) {
    throw new Error(`STOP — ${unaccounted.length} submitted request(s) have no record and no reported failure: rerun collect --round=3, or pass --allow-partial`);
  }

  const ARMS3 = [...ARMS_ROUND3_REUSED, ...ARMS_ROUND3_NEW];
  const get = (arm, rep, c) => (ARMS_ROUND3_REUSED.includes(arm) ? reused : main).get(`${arm}|${rep}|${c.battleId}|${c.evalId}`) ?? null;
  const getS2 = (arm, rep, c) => sub.get(`${arm}|${rep}|${c.battleId}|${c.evalId}`) ?? null;
  const complete = s.sample.filter((c) => ARMS3.every((a) => [1, 2].every((rep) => get(a, rep, c))));
  const meta = s.battlesMeta;
  const validateWith = (universeOf) => (c, input) => captureDeclarations(input?.declarations, {
    universe: universeOf(c),
    resolveHorizon: bindHorizon({ promptBuiltAtMs: c.promptBuiltAtMs, mintedAtMs: c.mintedAtMs, battleExpiresAtMs: meta[c.battleId].battleExpiresAtMs }),
  });
  // Round 3 judges a fork against the check's own universe as best it can be rebuilt (review L2-1);
  // the round-2 reproduction below keeps round 2's end-state universe.
  const validate = validateWith((c) => [...new Set([...meta[c.battleId].universe, ...promptSymbols(c.request.messages[2].content)])]);
  const validateR2 = validateWith((c) => meta[c.battleId].universe);

  // Main sample: round 2's measures, A and D recomputed from their reused records beside the new arms.
  const perArm = {};
  for (const arm of ARMS3) perArm[arm] = measureArm(arm, { s, complete, get, validate, est, extended: true, saidRound: 2 });
  const noise = noiseFloor(complete, get);
  const A = perArm.A;
  for (const arm of ARMS3.filter((a) => a !== 'A')) {
    const x = perArm[arm].health;
    x.fisherP = x.callsReturned && A.health.callsReturned ? fisherOneSidedGreater(x.invalid, x.callsReturned, A.health.invalid, A.health.callsReturned) : null;
  }
  // A fork-only call declares (bar 2) and a pick counts as next_check (bar 3): the called-shots-only
  // view lets a reader separate a fork nudge's effect on those bars (review VB-1). Reported, not gated.
  for (const arm of ARMS3) {
    const callsC = complete.flatMap((c) => [1, 2].map((rep) => ({ c, r: get(arm, rep, c) })));
    const withShot = callsC.filter(({ c, r }) => validate(c, r.toolUseInput).validation.calls.some((x) => x.source === 'calledShots')).length;
    perArm[arm].shotDeclarationRate = callsC.length ? withShot / callsC.length : null;
  }
  const hasDirective = (c) => c.request.messages[2].content.includes(M.dir.DIRECTIVE_HEADER);
  const forks = {};
  for (const arm of ARMS3) forks[arm] = forkMeasures(complete.flatMap((c) => [1, 2].map((rep) => ({ c, rep, r: get(arm, rep, c) }))), validate, hasDirective);
  const checksWithDirective = s.sample.filter(hasDirective).length;

  // S2: the two arms on the same 40 directive-bearing inputs; rates over the checks both arms
  // answered in full, the founder's fork listing over every record that came back (review L3-6).
  const s2complete = s2.checks.filter((c) => ARMS_ROUND3_S2.every((a) => [1, 2].every((rep) => getS2(a, rep, c))));
  const byCheck = new Map(s2.checks.map((c) => [`${c.battleId}:${c.evalId}`, c]));
  const withDirective = (rows) => rows.map((row) => { const c = byCheck.get(row.check); return { ...row, directive: { id: c.directive.adjustmentId, text: c.directive.text } }; });
  const s2arms = {};
  for (const arm of ARMS_ROUND3_S2) {
    const calls = s2complete.flatMap((c) => [1, 2].map((rep) => ({ c, rep, r: getS2(arm, rep, c) })));
    const returnedCalls = s2.checks.flatMap((c) => [1, 2].map((rep) => ({ c, rep, r: getS2(arm, rep, c) }))).filter((x) => x.r);
    const fm = forkMeasures(calls, validate, () => true);
    const inputs = calls.map((x) => x.r.toolUseInput);
    s2arms[arm] = {
      ...fm,
      rows: withDirective(forkMeasures(returnedCalls, validate, () => true).rows),
      declarationRate: calls.length ? calls.filter(({ c, r }) => validate(c, r.toolUseInput).phase === 'expected').length / calls.length : null,
      decisions: inputs.reduce((o, x) => inc(o, x?.decision ?? 'none'), {}),
      threadEchoed: calls.filter(({ c, r }) => r.toolUseInput?.directiveThreadId === c.directive.directiveThreadId).length,
      invalid: inputs.filter((x) => x && !validateTradeToolResult(x).valid).length,
      maxTokens: calls.filter(({ r }) => r.stopReason === 'max_tokens').length,
      returned: returnedCalls.length,
    };
  }
  const exampleRows = shuffle(s2arms['1A-C'].rows, rng(S2_SEED + 7)).slice(0, 5);

  // The frozen bars (brief §5). Bar 6 (`said`) is reported, not gated; bar 10 is withdrawn
  // (founder ruling 2026-10-02, before any S2 data): every S2 1A-CF fork is listed instead.
  const pass = {};
  const floor = noise.decisionAgreementA1A2;
  for (const arm of ARMS_ROUND3_NEW) {
    const x = perArm[arm];
    const bars = {
      anticipation: atLeast(x.anticipation.pairedRelative, -0.10) && atLeast(x.anticipation.ci95?.lo, -0.20),
      declarationRate: atLeast(x.declarationRate, 0.15) && atMost(x.declarationRate, 0.40),
      horizon: atLeast(x.longHorizonShare, 0.5),
      decisionAgreement: typeof floor === 'number' && atLeast(x.decisionAgreementWithA, floor - 0.05),
      health: x.health.callsReturned > 0 && atMost(x.health.maxTokensRate, 0.02) && atMost(x.health.invalidToolResultRate, 0.03) && atLeast(x.health.fisherP, 0.05),
    };
    if (arm === '1A-CF') {
      const cf = s2arms['1A-CF']; const c0 = s2arms['1A-C']; const fm = forks['1A-CF'];
      bars.s2ForkRate = atLeast(cf.rate, 0.25) && typeof c0.rate === 'number' && atLeast(cf.rate - c0.rate, 0.15);
      // 0 main-sample forks: no false attribution can exist — met; 0 forks anywhere: survival is unproven — not met.
      bars.respondsWithoutDirective = fm.offered === 0 ? true : atMost(fm.respondsTrueNoDirective / fm.offered, 0.05);
      const offered = fm.offered + cf.offered;
      bars.forkSurvival = offered > 0 && atLeast((fm.surviving + cf.surviving) / offered, 0.80);
    }
    pass[arm] = { bars, overall: Object.values(bars).every(Boolean), saidReportedNotGated: x.said.rate };
  }
  const cfOffered = forks['1A-CF'].offered + s2arms['1A-CF'].offered;
  const pooledSurvival = { surviving: forks['1A-CF'].surviving + s2arms['1A-CF'].surviving, offered: cfOffered };

  // A and D against round 2's own analysis — on round 2's paired set (every A and D rep present),
  // with round 2's universe, whatever round 3's own paired set is (reviews L1-1, L3-4, L4-3, L5-2);
  // and only against round 2's ORIGINAL results.json (pinned by hash), never a rerun of it (L5-1).
  const r2path = path.join(R3_REUSED_DIR, 'results.json');
  const r2original = sha256Utf8(readFileSync(r2path, 'utf8')) === R2_RESULTS_SHA256;
  const r2res = readJson(r2path);
  const adComplete = s.sample.filter((c) => ARMS_ROUND3_REUSED.every((a) => [1, 2].every((rep) => get(a, rep, c))));
  const r2view = Object.fromEntries(ARMS_ROUND3_REUSED.map((arm) => [arm, measureArm(arm, { s, complete: adComplete, get, validate: validateR2, est, extended: true, saidRound: 2 })]));
  const fingerprint = (x) => JSON.stringify([x.calls, x.callsReturned, x.anticipation, x.declarationRate, x.declaringCalls, x.callsPerDeclaringCall,
    x.kindMix, x.horizonMix, x.removals, x.longHorizonShare, x.said.shots, x.said.inconsistent, x.decisionAgreementWithA,
    x.health.invalid, x.health.maxTokens, x.health.invalidByField, x.pacingByArchetype]);
  const reproduces = {
    againstOriginal: r2original, pairedChecks: adComplete.length,
    A: r2original && fingerprint(r2view.A) === fingerprint(r2res.perArm.A),
    D: r2original && fingerprint(r2view.D) === fingerprint(r2res.perArm.D),
    DFisherP: r2original && fisherOneSidedGreater(r2view.D.health.invalid, r2view.D.health.callsReturned, r2view.A.health.invalid, r2view.A.health.callsReturned) === r2res.perArm.D.health.fisherP,
    noise: r2original && JSON.stringify(noiseFloor(adComplete, get)) === JSON.stringify(r2res.noise),
  };

  let inTok = 0; let outTok = 0; let cacheW = 0; let cacheR = 0;
  for (const r of [...main.values(), ...sub.values()]) { inTok += r.usage?.input_tokens || 0; outTok += r.usage?.output_tokens || 0; cacheW += r.usage?.cache_creation_input_tokens || 0; cacheR += r.usage?.cache_read_input_tokens || 0; }
  const live = (c) => c.request.messages[2].content;
  const out = {
    analyzedAt: new Date().toISOString(), round: 3,
    checksSampled: s.sample.length, checksComplete: complete.length, s2Checks: s2.checks.length, s2Complete: s2complete.length,
    submitted: Object.keys(record.manifest).length, failedReported: failedIds.size, unaccounted: unaccounted.length,
    callsReturned: { main: main.size, s2: sub.size }, collect: existsSync(COLLECT_PATH) ? readJson(COLLECT_PATH) : null,
    s2Population: {
      eligible: s.sample.filter((c) => live(c).includes(BENCH_PRESENT) && !live(c).includes(M.dir.DIRECTIVE_HEADER)).length,
      excludedNoBench: s.sample.filter((c) => !live(c).includes(BENCH_PRESENT)).length,
      excludedHasDirective: s.sample.filter((c) => live(c).includes(M.dir.DIRECTIVE_HEADER)).length,
    },
    spend: { inputTokens: inTok, outputTokens: outTok, cacheWrite: cacheW, cacheRead: cacheR, usd: ((inTok * PRICE_IN + outTok * PRICE_OUT + cacheW * PRICE_IN * 1.25 + cacheR * PRICE_IN * 0.1) * BATCH_FACTOR) / 1e6 },
    noise, perArm, forks, checksWithDirective, s2: { arms: s2arms, examples1AC: exampleRows }, pass, pooledSurvival, reproducesRound2: reproduces,
  };
  writeFileSync(RESULTS_PATH, JSON.stringify(out, null, 1));
  writeFileSync(RESULTS_MD_PATH, renderMarkdown3(out, s2));
  console.log(JSON.stringify({ checksComplete: out.checksComplete, s2Complete: out.s2Complete, callsReturned: out.callsReturned, spend: out.spend, pass, reproduces, forks: Object.fromEntries(Object.entries(forks).map(([k, v]) => [k, { ...v, rows: v.rows.length }])), s2: Object.fromEntries(Object.entries(s2arms).map(([k, v]) => [k, { ...v, rows: v.rows.length }])) }, null, 1));
}

function renderMarkdown3(o, s2) {
  const L = [];
  const p = (x = '') => L.push(x);
  const ARMS3 = ['A', 'D', '1A', '1A-C', '1A-CF'];
  const NEW = ['1A', '1A-C', '1A-CF'];
  const arms = ARMS3.map((a) => [a, o.perArm[a]]);
  // The run itself (brief §3; review L4-9): what was sent, what came back, what it cost.
  p('### The run');
  p();
  p(`- Submitted: ${o.submitted} requests; collect: ${o.collect ? `${mix(o.collect.byType)}${o.collect.complete === false ? ' — INCOMPLETE' : ''}` : 'no collect.json'}; failures reported: ${o.failedReported}; unaccounted: ${o.unaccounted}.`);
  p(`- Records analyzed: main ${o.callsReturned.main}, S2 ${o.callsReturned.s2}; complete checks: main ${o.checksComplete} of ${o.checksSampled}, S2 ${o.s2Complete} of ${o.s2Checks}.`);
  p(`- Spend at batch prices: $${N(o.spend.usd, 2)} (${o.spend.inputTokens} input, ${o.spend.outputTokens} output, ${o.spend.cacheWrite} cache-write, ${o.spend.cacheRead} cache-read tokens).`);
  p(`- S2 population: ${o.s2Population.eligible} eligible of ${o.checksSampled} (${o.s2Population.excludedNoBench} with an empty bench excluded; ${o.s2Population.excludedHasDirective} already carrying a directive).`);
  p();
  p('### Measures by arm (main sample; A and D are round 2\'s records, recomputed)');
  p();
  p(`| Measure | ${arms.map(([a]) => `${a}: ${ARM_LABELS[a]}`).join(' | ')} |`);
  p(`|---|${arms.map(() => '---').join('|')}|`);
  const row = (label, f) => p(`| ${label} | ${arms.map(([a, x]) => f(x, a)).join(' | ')} |`);
  row('Calls analyzed (complete checks × 2)', (x) => String(x.calls));
  row('Anticipation candidates per call (mean)', (x) => N(x.anticipation.meanPerCall));
  row('Paired difference vs A (relative) [95% CI]', (x) => (x.anticipation.ci95 ? `${P(x.anticipation.pairedRelative)} [${P(x.anticipation.ci95.lo)}, ${P(x.anticipation.ci95.hi)}]` : '—'));
  row('Declaration rate (calls)', (x) => `${P(x.declarationRate)} (${x.declaringCalls})`);
  row('…calls with ≥1 called shot (forks and watch-only blocks excluded)', (x) => P(x.shotDeclarationRate));
  row('Checks with ≥1 declaring rep', (x) => P(x.declaringCheckShare));
  row('Minted calls per declaring call', (x) => N(x.callsPerDeclaringCall));
  row('Calls on this_session / this_battle', (x) => `${P(x.longHorizonShare)} of ${x.totalCalls}`);
  row('…called shots only (a pick counts as next_check above)', (x) => P(x.shotLongHorizonShare));
  row('`said` added conditions (round-2 rule)', (x) => `${P(x.said.rate)} (${x.said.inconsistent}/${x.said.shots})`);
  row('Decision agreement with A (rep-aligned)', (x) => P(x.decisionAgreementWithA));
  row('`max_tokens` stop rate', (x) => `${P(x.health.maxTokensRate, 2)} (${x.health.maxTokens})`);
  row('`invalid_tool_result` rate', (x) => `${P(x.health.invalidToolResultRate, 2)} (${x.health.invalid})`);
  row('…one-sided Fisher p vs A', (x) => (x.health.fisherP == null ? '—' : N(x.health.fisherP, 3)));
  row('No `tool_use` block', (x) => String(x.health.noToolUse));
  row('Forks offered / surviving the validator', (x, a) => `${o.forks[a].offered} / ${o.forks[a].surviving}`);
  row('Fork rate (calls)', (x, a) => P(o.forks[a].rate));
  row('Output tokens p50 / p95', (x) => `${x.health.outputP50} / ${x.health.outputP95}`);
  row('Input tokens (mean, billed)', (x) => N(x.health.inputMean, 0));
  row('Tool size (serialized chars)', (x) => String(x.size.toolChars));
  row('`countTokens` input, largest request', (x) => String(x.size.countTokensLargest));
  p();
  p(`**Noise floor (A rep 1 vs A rep 2):** anticipation ${P(o.noise.anticipationRelative)} [${P(o.noise.anticipationCi95.lo)}, ${P(o.noise.anticipationCi95.hi)}]; decision agreement ${P(o.noise.decisionAgreementA1A2)}.`);
  p();
  const rr = o.reproducesRound2;
  p(`**Round 2 reproduced from the reused records** (round 2's paired set, ${rr.pairedChecks} checks${rr.againstOriginal ? '' : '; round 2\'s results.json is NOT its original — no comparison made'}): A ${rr.A ? 'yes' : 'NO'} · D ${rr.D ? 'yes' : 'NO'} · D's Fisher p ${rr.DFisherP ? 'yes' : 'NO'} · noise floor ${rr.noise ? 'yes' : 'NO'}.`);
  if (o.checksComplete !== o.checksSampled) p(`**The table above uses round 3's paired set: ${o.checksComplete} of ${o.checksSampled} checks** (a check counts only with all ten calls).`);
  p();
  p('### Kind mix, horizon mix, validator removals');
  p();
  p('| Arm | Kinds | Horizons (all calls; fork = next_check) | Removed by validator |');
  p('|---|---|---|---|');
  for (const [a, x] of arms) p(`| ${a} | ${mix(x.kindMix)} | ${mix(x.horizonMix)} | ${mix(x.removals)} |`);
  p();
  p('### Pass table (brief §5, frozen bars)');
  p();
  p(`| Bar | ${NEW.join(' | ')} |`);
  p(`|---|${NEW.map(() => '---').join('|')}|`);
  const mark = (v) => (v === undefined ? '—' : v ? 'PASS' : 'FAIL');
  const bars = [
    ['anticipation', '1. Anticipation: paired diff ≥ −10% and CI low ≥ −20%'],
    ['declarationRate', '2. Declaration rate 15%–40% of calls'],
    ['horizon', '3. ≥ 50% of calls this_session / this_battle'],
    ['decisionAgreement', '4. Decision agreement ≥ A1-vs-A2 − 5 pts'],
    ['health', '5. `max_tokens` ≤ 2%, invalid ≤ 3% and Fisher p ≥ 0.05'],
  ];
  for (const [k, label] of bars) p(`| ${label} | ${NEW.map((a) => mark(o.pass[a].bars[k])).join(' | ')} |`);
  p(`| 6. \`said\` added conditions — reported, not gated | ${NEW.map((a) => P(o.perArm[a].said.rate)).join(' | ')} |`);
  p(`| 7. S2 fork rate ≥ 25% and ≥ 1A-C's + 15 pts | — | — | ${mark(o.pass['1A-CF'].bars.s2ForkRate)} |`);
  p(`| 8. respondsToDirective true with no directive ≤ 5% of forks | — | — | ${mark(o.pass['1A-CF'].bars.respondsWithoutDirective)} |`);
  p(`| 9. Forks surviving the validator ≥ 80% (main + S2) | — | — | ${mark(o.pass['1A-CF'].bars.forkSurvival)} (${o.pooledSurvival.surviving}/${o.pooledSurvival.offered}) |`);
  p('| 10. S2 fork options avoid the restriction | — | — | withdrawn (founder ruling) |');
  p(`| **Overall** | ${NEW.map((a) => (o.pass[a].overall ? '**PASS**' : '**FAIL**')).join(' | ')} |`);
  p();
  p('### Forks, main sample');
  p();
  p('| Arm | Calls | Offered | Rate | Surviving | Survival | Removed (reason) | Placeholder values | Stray top-level forks | respondsToDirective true | …on checks with no directive |');
  p('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const a of ARMS3) { const f = o.forks[a]; p(`| ${a} | ${f.calls} | ${f.offered} | ${P(f.rate)} | ${f.surviving} | ${P(f.survivalRate)} | ${mix(f.removed)} | ${f.placeholders} | ${f.strayForks} | ${f.respondsTrue} | ${f.respondsTrueNoDirective} |`); }
  p();
  p(`Recorded checks carrying a directive block: ${o.checksWithDirective} of ${o.checksSampled}.`);
  p();
  p('### S2 (synthetic directive; labeled departure from byte-identical replay)');
  p();
  p('| Arm | Calls | Forks offered | Fork rate | Surviving | respondsToDirective true (share of forks) | Declaration rate | Decisions | directiveThreadId echoed | Invalid / max_tokens |');
  p('|---|---|---|---|---|---|---|---|---|---|');
  for (const a of ['1A-C', '1A-CF']) { const x = o.s2.arms[a]; p(`| ${a} | ${x.calls} | ${x.offered} | ${P(x.rate)} | ${x.surviving} | ${x.respondsTrue} (${P(x.respondsShare)}) | ${P(x.declarationRate)} | ${mix(x.decisions)} | ${x.threadEchoed} | ${x.invalid} / ${x.maxTokens} |`); }
  const forkLine = (r, i) => {
    p(`${i + 1}. \`${r.check}\` (${r.archetype}), rep ${r.rep} — directive **${r.directive.id}** "${r.directive.text}"`);
    p(`   - slot \`${r.slot}\`, swapOut \`${r.swapOut}\`; respondsToDirective: \`${JSON.stringify(r.respondsToDirective)}\`; ${r.survived ? 'survived the validator' : `removed (${r.removal})`}; decision ${r.decision}${r.swap ? ` ${r.swap}` : ''}`);
    for (const opt of Array.isArray(r.options) ? r.options : []) p('raw' in opt ? `   - option (not an object): \`${JSON.stringify(opt.raw)}\`` : `   - option \`${opt.symbol}\`: "${opt.why}"`);
    if (!Array.isArray(r.options)) p(`   - options (malformed): \`${JSON.stringify(r.options)}\``);
    p(`   - said: "${r.said}"`);
  };
  p();
  p(`**Every S2 1A-CF fork** (${o.s2.arms['1A-CF'].rows.length}; agent text only)`);
  p();
  if (!o.s2.arms['1A-CF'].rows.length) p('- none');
  o.s2.arms['1A-CF'].rows.forEach(forkLine);
  p();
  p(`**S2 1A-C forks, five seeded examples** (${o.s2.arms['1A-C'].rows.length} in all)`);
  p();
  if (!o.s2.examples1AC.length) p('- none');
  o.s2.examples1AC.forEach(forkLine);
  p();
  p('### Pacing per battle-day, by archetype (mean of the two reps; mean · median · min–max across battle-days)');
  p();
  p('| Arm | Archetype | Battle-days | Checks per battle-day | Declaring checks per battle-day | Minted calls per battle-day |');
  p('|---|---|---|---|---|---|');
  const sm = (q) => `${N(q.mean, 1)} · ${N(q.median, 1)} · ${N(q.min, 1)}–${N(q.max, 1)}`;
  for (const [a, x] of arms) for (const [arch, q] of Object.entries(x.pacingByArchetype)) p(`| ${a} | ${arch} | ${q.battleDays} | ${sm(q.checksPerBattleDay)} | ${sm(q.declaringChecks)} | ${sm(q.mintedCalls)} |`);
  p();
  p('### Health detail by field (`invalid_tool_result`, first failing field as production records it)');
  p();
  p('| Arm | Invalid / returned | Distinct checks | By field | By reason |');
  p('|---|---|---|---|---|');
  for (const [a, x] of arms) p(`| ${a} | ${x.health.invalid} / ${x.health.callsReturned} | ${x.health.invalidChecks} | ${mix(x.health.invalidByField)} | ${mix(x.health.invalidByReason)} |`);
  p();
  p('### `said` flags by matched term (a line can match more than one)');
  p();
  p('| Arm | Terms |');
  p('|---|---|');
  for (const [a, x] of arms) p(`| ${a} | ${mix(x.said.flagTerms)} |`);
  p();
  p('### Flagged `said` lines (up to 10 per arm, agent text only)');
  for (const [a, x] of arms) {
    p();
    p(`**Arm ${a}** (${x.said.inconsistent} flagged of ${x.said.shots})`);
    if (!x.said.sample.length) p('- none');
    for (const f of x.said.sample) p(`- \`${f.symbol}\` · \`${f.horizonPhrase}\`: "${f.said}"${f.terms?.length ? ` — *${f.terms.join('; ')}*` : ''}`);
  }
  p();
  p('### 20 randomly sampled `said` lines per new arm, flagged or not (seeded, agent text only)');
  for (const [a, x] of arms.filter(([a]) => NEW.includes(a))) {
    p();
    p(`**Arm ${a}** (${x.said.random20.length} of ${x.said.shots})`);
    if (!x.said.random20.length) p('- none');
    x.said.random20.forEach((f, i) => p(`${i + 1}. ${f.flagged ? '**FLAGGED** ' : ''}\`${f.symbol}\` · \`${f.horizonPhrase}\`: "${f.said}"${f.terms.length ? ` — *${f.terms.join('; ')}*` : ''}`));
  }
  p();
  p('### Example `declarations` blocks (five per arm, seeded pick, agent text only)');
  for (const [a, x] of arms.filter(([a]) => NEW.includes(a))) {
    p();
    p(`**Arm ${a}**${x.examples.length ? '' : ': no declaring call'}`);
    x.examples.forEach((e, i) => {
      p();
      p(`${i + 1}. ${e.archetype}, rep ${e.rep}`);
      p('```json');
      p(JSON.stringify(e.declarations, null, 1));
      p('```');
    });
  }
  p();
  p(`### S2 checks and their directives (${s2.checks.length})`);
  p();
  p('| Battle | evalId | Archetype | Directive | Inserted before | Equipped leans |');
  p('|---|---|---|---|---|---|');
  for (const c of s2.checks) p(`| \`${c.battleId.slice(0, 5)}…\` | ${c.evalId} | ${c.archetype} | ${c.directive.adjustmentId} "${c.directive.text}" | ${c.insertedBefore ? `\`${c.insertedBefore}\`` : '(end)'} | ${c.leanIds.join(', ') || '—'} |`);
  return `${L.join('\n')}\n`;
}

// ---------------------------------------------------------------- main

const cmd = process.argv[2];
const COMMANDS = ROUND === 3
  ? { select, s2: selectS2, estimate: estimate3, submit: submit3, collect: collect3, analyze: analyze3 }
  : { select, estimate, run, analyze };
if (!COMMANDS[cmd]) {
  console.error(`usage: node scripts/declarations-wording-experiment.mjs <${Object.keys(COMMANDS).join('|')}>`);
  process.exitCode = 1;
} else {
  await COMMANDS[cmd]();
}
