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

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from './loadLocalEnv.js';
import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';
import { EVAL_MODEL_ID, EVAL_MAX_OUTPUT_TOKENS } from '../api/_utils/agentEvalTransport.js';
import { validateTradeToolResult } from '../api/_utils/agentEvalToolResultValidation.js';
import { captureDeclarations } from '../api/_utils/callRecords/validate.js';
import { bindHorizon, battleExpiryMs } from '../api/_utils/callRecords/horizon.js';
import { selectBattleUniverse } from '../src/data/battleUniverse.js';
import { ARMS, ARM_LABELS, armTool, assertDescriptionOnlyDiff } from './declarationsWordingArms.mjs';

// ---------------------------------------------------------------- constants

export const SEED = 20261001;
const DAY_FIRST = '2026-09-21';
const DAY_LAST = '2026-10-01';
const TARGET_CHECKS = 80;
const PER_BATTLE_MAX = 8;
const REPS = 2;
const CONCURRENCY = 4;
const COST_CEILING_USD = 25;
const OUTPUT_ALLOWANCE_TOKENS = 1500;
// Haiku 4.5 list prices, $ per million tokens (claude-api skill, cached 2026-09-25).
const PRICE_IN = 1.0;
const PRICE_OUT = 5.0;
const BOOTSTRAP_RESAMPLES = 10_000;
/** The production request literal (api/cron/agent-evaluate.js:2767-2782). */
const PROD_TEMPERATURE = 0.4;
const PROD_TOOL_CHOICE = { type: 'tool', name: 'submit_trade_decision' };
const EXPECTED_KEYS = ['model', 'max_tokens', 'temperature', 'system', 'messages', 'tools', 'tool_choice'];

const RAW_DIR = path.join(PROJECT_ROOT, 'experiments', 'declarations-wording', 'raw');
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
  const desc = assertDescriptionOnlyDiff();
  const anthropic = client();
  // One request per arm: the LARGEST recorded request, so the estimate is conservative.
  const largest = s.sample.reduce((a, c) => (JSON.stringify(c.request).length > JSON.stringify(a.request).length ? c : a));
  const perArm = {};
  let total = 0;
  const callsPerArm = s.sample.length * REPS;
  for (const arm of ARMS) {
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
  assertDescriptionOnlyDiff();
  const s = readJson(SAMPLE_PATH);
  mkdirSync(CALLS_DIR, { recursive: true });
  const anthropic = client();
  const tasks = [];
  for (const check of s.sample) for (const arm of ARMS) for (let rep = 1; rep <= REPS; rep += 1) {
    if (!existsSync(callPath(arm, rep, check))) tasks.push({ arm, rep, check });
  }
  console.log(`tasks to run: ${tasks.length} (of ${s.sample.length * ARMS.length * REPS})`);
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
export function saidInconsistent(row) {
  if (typeof row?.said !== 'string') return false;
  return row.horizonPhrase === 'next_check' ? SAID_NC_ADDS.test(row.said) : SAID_OTHER_ADDS.test(row.said);
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

function analyze() {
  const s = readJson(SAMPLE_PATH);
  const est = existsSync(ESTIMATE_PATH) ? readJson(ESTIMATE_PATH) : null;
  const recs = new Map();
  for (const f of readdirSync(CALLS_DIR)) { const r = readJson(path.join(CALLS_DIR, f)); recs.set(`${r.arm}|${r.rep}|${r.battleId}|${r.evalId}`, r); }
  const get = (arm, rep, c) => recs.get(`${arm}|${rep}|${c.battleId}|${c.evalId}`) ?? null;
  // Paired analysis uses only checks with every one of the 8 calls present.
  const complete = s.sample.filter((c) => ARMS.every((a) => [1, 2].every((rep) => get(a, rep, c))));
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
  const aMean = (c) => (ancOf(get('A', 1, c)?.toolUseInput) + ancOf(get('A', 2, c)?.toolUseInput)) / 2;
  for (const arm of ARMS) {
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
      ci95: arm === 'A' ? null : bootstrapRelative(diffs, base, SEED + arm.charCodeAt(0)),
    };
    // 2–4. declarations
    let declaring = 0; const declaringChecks = new Set(); const kindMix = {}; const horizonMix = {}; const shotHorizonMix = {};
    const removals = {}; const callsPerDeclaring = []; let shots = 0; let inconsistent = 0; const flagged = []; const examples = [];
    for (const { c, rep, r } of callsC) {
      const v = validate(c, r.toolUseInput);
      for (const rm of v.validation.removed) inc(removals, `${rm.source}:${rm.reason}`);
      if (v.phase !== 'expected') continue;
      declaring += 1; declaringChecks.add(`${c.battleId}|${c.evalId}`);
      const val = v.validation.validated;
      callsPerDeclaring.push(v.validation.calls.length);
      for (const call of v.validation.calls) {
        inc(kindMix, call.kind);
        const h = call.source === 'fork' ? 'next_check' : call.row.horizonPhrase;
        inc(horizonMix, h);
        if (call.source === 'calledShots') {
          inc(shotHorizonMix, h); shots += 1;
          if (saidInconsistent(call.row)) { inconsistent += 1; flagged.push({ check: `${c.battleId}:${c.evalId}`, rep, symbol: call.row.symbol, horizonPhrase: call.row.horizonPhrase, said: call.row.said }); }
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
    const invalid = callsAll.filter((x) => x.r.toolUseInput && !validateTradeToolResult(x.r.toolUseInput).valid).length;
    const outs = callsAll.map((x) => x.r.usage?.output_tokens);
    const ins = callsAll.map((x) => x.r.usage?.input_tokens);
    // examples: seeded pick of five
    const er = rng(SEED + 7 + arm.charCodeAt(0));
    const ex = shuffle(examples, er).slice(0, 5);
    const fr = rng(SEED + 11 + arm.charCodeAt(0));
    perArm[arm] = {
      label: ARM_LABELS[arm], calls: nCalls, callsReturned: callsAll.length,
      anticipation,
      declarationRate: nCalls ? declaring / nCalls : null, declaringCalls: declaring,
      declaringCheckShare: complete.length ? declaringChecks.size / complete.length : null,
      callsPerDeclaringCall: mean(callsPerDeclaring),
      kindMix, horizonMix, shotHorizonMix, removals,
      longHorizonShare: totalCalls ? longHorizon / totalCalls : null, totalCalls,
      shotLongHorizonShare: shots ? ((shotHorizonMix.this_session || 0) + (shotHorizonMix.this_battle || 0)) / shots : null,
      said: { shots, inconsistent, rate: shots ? inconsistent / shots : null, sample: shuffle(flagged, fr).slice(0, 10) },
      decisionAgreementWithA: agreeD ? agreeN / agreeD : null,
      health: {
        maxTokensRate: callsAll.length ? maxTok / callsAll.length : null, maxTokens: maxTok,
        invalidToolResultRate: callsAll.length ? invalid / callsAll.length : null, invalid,
        noToolUseRate: callsAll.length ? noTool / callsAll.length : null, noToolUse: noTool,
        outputP50: pct(outs, 50), outputP95: pct(outs, 95), inputMean: mean(ins.filter(Number.isFinite)),
      },
      size: { toolChars: JSON.stringify(armTool(arm)).length, countTokensLargest: est?.perArm?.[arm]?.inputTokens ?? null },
      examples: ex,
    };
  }

  // Noise floors (A rep 1 vs A rep 2)
  const a1 = complete.map((c) => ancOf(get('A', 1, c).toolUseInput));
  const a2 = complete.map((c) => ancOf(get('A', 2, c).toolUseInput));
  const noiseDiffs = complete.map((_, i) => a2[i] - a1[i]);
  const noise = {
    anticipationRelative: mean(a1) > 0 ? mean(noiseDiffs) / mean(a1) : null,
    anticipationCi95: bootstrapRelative(noiseDiffs, a1, SEED + 99),
    decisionAgreementA1A2: complete.length ? complete.filter((c) => agree(decisionOf(get('A', 1, c).toolUseInput), decisionOf(get('A', 2, c).toolUseInput))).length / complete.length : null,
  };

  // §5 pass table (frozen bars)
  const A = perArm.A;
  const pass = {};
  for (const arm of ['B', 'C', 'D']) {
    const x = perArm[arm];
    const bars = {
      anticipation: x.anticipation.pairedRelative >= -0.10 && x.anticipation.ci95.lo >= -0.20,
      declarationRate: x.declarationRate >= 0.15,
      horizon: x.longHorizonShare != null && x.longHorizonShare >= 0.5,
      said: x.said.rate != null && x.said.rate <= 0.10,
      decisionAgreement: x.decisionAgreementWithA >= noise.decisionAgreementA1A2 - 0.05,
      health: x.health.maxTokensRate <= 0.02 && x.health.invalidToolResultRate <= A.health.invalidToolResultRate + 0.01,
    };
    pass[arm] = { bars, overall: Object.values(bars).every(Boolean) };
  }

  const out = {
    analyzedAt: new Date().toISOString(), checksSampled: s.sample.length, checksComplete: complete.length,
    callsReturned: recs.size, failureAttempts: failuresRaw.length,
    failuresByStatus: failuresRaw.reduce((o, f) => inc(o, String(f.status ?? f.name)), {}),
    spend: { inputTokens: inTok, outputTokens: outTok, cacheWrite: cacheW, cacheRead: cacheR, usd: spentUsd },
    noise, perArm, pass,
  };
  writeFileSync(RESULTS_PATH, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ ...out, perArm: Object.fromEntries(Object.entries(perArm).map(([k, v]) => [k, { ...v, examples: `${v.examples.length} examples`, said: { ...v.said, sample: `${v.said.sample.length} lines` } }])) }, null, 1));
  writeFileSync(RESULTS_MD_PATH, renderMarkdown(out));
}

// ---------------------------------------------------------------- report fragment

const P = (x, d = 1) => (x == null ? 'n/a' : `${(x * 100).toFixed(d)}%`);
const N = (x, d = 2) => (x == null ? 'n/a' : Number(x).toFixed(d));
const mix = (o) => (Object.keys(o).length ? Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') : '—');

function renderMarkdown(o) {
  const L = [];
  const p = (s = '') => L.push(s);
  const arms = ARMS.map((a) => [a, o.perArm[a]]);
  p('### Measures by arm');
  p();
  p('| Measure | A: off | B: shadow (current) | C: shadow, revised | D: on (draft) |');
  p('|---|---|---|---|---|');
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
  p('| Bar | B | C | D |');
  p('|---|---|---|---|');
  const bars = [['anticipation', 'Anticipation: paired diff ≥ −10% and CI low ≥ −20%'], ['declarationRate', 'Declaration rate ≥ 15%'], ['horizon', '≥ 50% of calls this_session / this_battle'], ['said', '`said` inconsistency ≤ 10%'], ['decisionAgreement', 'Decision agreement ≥ A1-vs-A2 − 5 pts'], ['health', '`max_tokens` ≤ 2% and invalid ≤ A + 1 pt']];
  for (const [k, label] of bars) p(`| ${label} | ${['B', 'C', 'D'].map((a) => (o.pass[a].bars[k] ? 'PASS' : 'FAIL')).join(' | ')} |`);
  p(`| **Overall** | ${['B', 'C', 'D'].map((a) => (o.pass[a].overall ? '**PASS**' : '**FAIL**')).join(' | ')} |`);
  p();
  p('### Flagged `said` lines (up to 10 per arm, agent text only)');
  for (const [a, x] of arms) {
    p();
    p(`**Arm ${a}** (${x.said.inconsistent} flagged of ${x.said.shots})`);
    if (!x.said.sample.length) p('- none');
    for (const f of x.said.sample) p(`- \`${f.symbol}\` · \`${f.horizonPhrase}\`: "${f.said}"`);
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

// ---------------------------------------------------------------- main

const cmd = process.argv[2];
const COMMANDS = { select, estimate, run, analyze };
if (!COMMANDS[cmd]) {
  console.error(`usage: node scripts/declarations-wording-experiment.mjs <${Object.keys(COMMANDS).join('|')}>`);
  process.exitCode = 1;
} else {
  await COMMANDS[cmd]();
}
