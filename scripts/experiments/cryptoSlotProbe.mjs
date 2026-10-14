#!/usr/bin/env node
// scripts/experiments/cryptoSlotProbe.mjs
//
// Crypto Slot paragraph — the replay probe (Fable build prompt, 14 Oct 2026,
// §6; build report docs/audits/20261014_BUILD_CRYPTO_SLOT_PROMPT.md §6).
//
// The acceptance check for the YOUR CRYPTO SLOT block before its flag flips:
// take the 144 tiered (BaggerBomb agent game) Trading Brain requests stored by
// the archetype-ablation run, splice the block into each stored system prompt
// exactly where production renders it with the flag on, resend each once as
// one Message Batch with the stored model / temperature / tools, and count
// what the model proposes for the crypto slot.
//
// OFFLINE AND READ-ONLY BY CONSTRUCTION.
//   - No Firestore, no product handler: the source is the local run folder.
//     Model calls go from this script to api.anthropic.com with plain fetch
//     (Message Batches), so no capture record, battle document or cron state
//     is written.
//   - Three pure product modules are imported; nothing they import touches
//     Firebase or the network:
//       api/_utils/evalCryptoSlotBlock.js — the block and its splice helper
//         (the helper is locked to the flag-on production build by
//         evalCryptoSlotBlock.test.js; the flag itself stays false — the
//         probe uses the flag-blind render, the flag is forced on here only);
//       api/_utils/agentEvalToolResultValidation.js — production's own
//         validateTradeToolResult, so a reply is malformed exactly when
//         production would fail it closed to HOLD;
//       api/_utils/agentCryptoAssets.js — the crypto symbol list.
//   - Secrets: CLAUDE_API_KEY from the environment, then this tree's
//     .env.local, then the primary checkout's. Never printed or written.
//
// Everything this writes lands OUTSIDE the repo, in
// %USERPROFILE%/ft-experiment-exhibits/crypto-slot-probe/ — request bodies,
// replies and rationale samples carry player text. The source run folder is
// read, never written.
//
// USAGE (repo root):
//   node scripts/experiments/cryptoSlotProbe.mjs selftest      # synthetic checks, no files, no network
//   node scripts/experiments/cryptoSlotProbe.mjs plan          # splice + verify + estimate (no spend)
//   node scripts/experiments/cryptoSlotProbe.mjs submit --go   # one Message Batch, cap-checked in code
//   node scripts/experiments/cryptoSlotProbe.mjs status [--wait]
//   node scripts/experiments/cryptoSlotProbe.mjs collect       # save results, then delete the batch on Anthropic's side
//   node scripts/experiments/cryptoSlotProbe.mjs judge         # the counts (prompt §6.4) and the bar

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

import { PRICES, sha256Utf8, parseEnvText, primaryCheckoutRoot, redactSecrets, isSpendLimitError } from './growth-replay/growthReplay.js';
import { spliceCryptoSlotBlock, renderCryptoSlotBlockForced, CRYPTO_SLOT_BANNER } from '../../api/_utils/evalCryptoSlotBlock.js';
import { validateTradeToolResult } from '../../api/_utils/agentEvalToolResultValidation.js';
import { VALID_CRYPTO_SYMBOLS } from '../../api/_utils/agentCryptoAssets.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..', '..');

// ---------------------------------------------------------------- frozen constants

const SOURCE_DIR = path.join(os.homedir(), 'ft-experiment-exhibits', 'archetype-ablation-run');
const RUN_DIR = path.join(os.homedir(), 'ft-experiment-exhibits', 'crypto-slot-probe');
/** The Phase 0 appendix's source (docs/audits/20261014_PHASE0_CRYPTO_SLOT.md). */
const SOURCES_SHA256 = '6fb95a74bcbdd8ae59580b48ec8896722938d07ddc1be4a58c1b463202144437';
/** Prompt §6: cap $5 / 300 calls, enforced at plan and at submit. */
export const CAPS = Object.freeze({ calls: 300, usd: 5 });
/** Prompt §6.4 bar, applied as written. */
export const BAR = Object.freeze({ cryptoToStockMax: 2, cryptoToStockRefusedMax: 0 });
/** The Phase 0 counts the plan must reproduce before anything is sent. */
const EXPECTED = Object.freeze({ tiered: 144, refused: 26 });
const TIERED_MARK = 'BaggerBomb game';
const PAIR_CAUSE = 'pair_validation:asset_class_mix';
const EXPECTED_KEYS = ['model', 'max_tokens', 'temperature', 'system', 'messages', 'tools', 'tool_choice'];

const ANTHROPIC = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
const POLL_EVERY_MS = 60 * 1000;
const POLL_FOR_MS = 2 * 60 * 60 * 1000;

const CRYPTO = new Set(VALID_CRYPTO_SYMBOLS);
const inc = (o, k, by = 1) => { o[k] = (o[k] || 0) + by; return o; };
const sym = (s) => (typeof s === 'string' && s.trim() ? s.trim().toUpperCase() : null);
const P = (f) => path.join(RUN_DIR, f);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
function writeJsonAtomic(p, value) {
  writeFileSync(`${p}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(`${p}.tmp`, p);
}

function stop(message, code = 2) {
  console.error(`\nSTOP: ${redactSecrets(message)}`);
  process.exit(code);
}

// ---------------------------------------------------------------- pure helpers (selftest-covered)

/** A proposal's asset-class pair, read by symbol (the Phase 0 method). */
export function pairKind(out, inn) {
  const o = CRYPTO.has(sym(out)) ? 'crypto' : 'stock';
  const i = CRYPTO.has(sym(inn)) ? 'crypto' : 'stock';
  return `${o}_to_${i}`;
}

/** A stored or replayed decision → { kind: 'malformed'|'HOLD'|'SWAP', pair } via production's validator. */
export function judgeInput(input) {
  const v = validateTradeToolResult(input);
  if (!v.valid) return { kind: 'malformed', why: v.invalidField };
  if (input.decision === 'HOLD') return { kind: 'HOLD' };
  return { kind: 'SWAP', out: sym(input.symbolOut), in: sym(input.symbolIn), pair: pairKind(input.symbolOut, input.symbolIn) };
}

/** The reply message → its submit_trade_decision input, or null. */
export function toolInputOf(message) {
  const block = Array.isArray(message?.content) ? message.content.find((b) => b?.type === 'tool_use') : null;
  return block ? block.input : null;
}

// "short" in a position sense: every \bshort\w*\b token, minus the brevity /
// horizon / idiom senses. A heuristic, stated as one in the report.
const SHORT_TOKEN = /\bshort(?:s|ing|ed)?\b/gi;
const NOT_POSITION_AFTER = /^[\s-]*(term|lived|window|time|period|sentence|run|horizon|of|squeeze|dated|interval|stint|while|span|burst|pause|list|circuit|hand|duration|session|hours?|days?|weeks?|notice|leash|fuse|memory|answer|summary)\b/i;
const NOT_POSITION_BEFORE = /\b(in|fall|falls|falling|fell|cut|came|come|comes|too|very|so|a\s+very|relatively|fairly|quite|pretty)\s+$/i;
export function shortPositionMatches(text) {
  const out = [];
  if (typeof text !== 'string') return out;
  for (const m of text.matchAll(SHORT_TOKEN)) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 24);
    const before = text.slice(Math.max(0, m.index - 16), m.index);
    if (NOT_POSITION_AFTER.test(after) || NOT_POSITION_BEFORE.test(before)) continue;
    out.push({ index: m.index, token: m[0] });
  }
  return out;
}
export const anyShortToken = (text) => typeof text === 'string' && /\bshort(?:s|ing|ed)?\b/i.test(text);

/** The incoming bench name's Daily% in the request's own BENCH table (null when absent). */
export function benchDailyPct(liveText, symbol) {
  if (typeof liveText !== 'string' || !symbol) return null;
  const head = 'BENCH (available for swap):\nSymbol,Sector,$Current,Daily%,ATR%,Status\n';
  const at = liveText.indexOf(head);
  if (at === -1) return null;
  const rows = liveText.slice(at + head.length).split('\n\n')[0].split('\n');
  const row = rows.find((r) => sym(r.split(',')[0]) === symbol);
  if (!row) return null;
  const v = Number.parseFloat(String(row.split(',')[3]).replace('%', ''));
  return Number.isFinite(v) ? v : null;
}

const priceKeyOf = (modelId) => {
  const m = /^claude-(haiku|sonnet|opus)-(\d+)-(\d+)/.exec(String(modelId));
  return m ? `claude-${m[1]}-${m[2]}-${m[3]}` : null;
};

/** Planned and worst-case USD at batch prices. Input = the recorded input tokens + the block (chars/3, rounded up — deliberately high). */
export function estimate(tasks, blockChars) {
  const blockTok = Math.ceil(blockChars / 3);
  let planned = 0; let worst = 0;
  for (const t of tasks) {
    const price = PRICES[priceKeyOf(t.model)];
    if (!price) throw new Error(`no price for ${t.model}`);
    const inTok = t.inputTokens + blockTok;
    planned += (inTok * price.batchIn + t.outputTokens * price.batchOut) / 1e6;
    worst += (inTok * price.batchIn + t.maxTokens * price.batchOut) / 1e6;
  }
  return { calls: tasks.length, blockTokEstimate: blockTok, plannedUsd: planned, worstUsd: worst };
}
export const withinCaps = (est) => est.calls <= CAPS.calls && est.worstUsd <= CAPS.usd;

// ---------------------------------------------------------------- env + API

function loadEnv() {
  const files = [path.join(PROJECT_ROOT, '.env.local')];
  const primary = primaryCheckoutRoot(PROJECT_ROOT);
  if (primary) files.push(path.join(primary, '.env.local'));
  const merged = {};
  for (const f of files) {
    if (!existsSync(f)) continue;
    for (const [k, v] of Object.entries(parseEnvText(readFileSync(f, 'utf8')))) if (merged[k] === undefined) merged[k] = v;
  }
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && v !== '') merged[k] = v;
  return merged;
}

/** The variable the production brain call site reads (api/cron/agent-evaluate.js). */
function anthropicKey() {
  const key = loadEnv().CLAUDE_API_KEY;
  if (typeof key !== 'string' || !/^sk-ant-[A-Za-z0-9_-]+$/.test(key)) stop('CLAUDE_API_KEY is not set or malformed (value not printed).');
  return key;
}

function anthropicUrl(urlPath) {
  const url = new URL(urlPath, ANTHROPIC);
  if (url.origin !== ANTHROPIC) stop(`refusing to send the API key to ${url.origin}`);
  return url.href;
}

async function api(apiKey, method, urlPath, body) {
  let res;
  try {
    res = await fetch(anthropicUrl(urlPath), { method, redirect: 'error', headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  } catch (err) {
    throw new Error(`network error on ${method} ${urlPath.split('?')[0]}: ${redactSecrets(err?.cause?.code || err?.name || 'unknown')}`);
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  if (isSpendLimitError(res.status, json, text)) stop(`the API reported a spend limit (HTTP ${res.status}). Nothing further was sent.`, 3);
  return { status: res.status, json, text };
}

function headSha() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim(); } catch { return null; }
}
const scriptSha = () => sha256Utf8(readFileSync(fileURLToPath(import.meta.url), 'utf8'));
function stamp(manifest, cmd) {
  (manifest.commandLog || (manifest.commandLog = [])).push({ cmd, at: new Date().toISOString(), headSha: headSha(), scriptSha256: scriptSha() });
}

// ---------------------------------------------------------------- plan

function loadSource() {
  const file = path.join(SOURCE_DIR, 'sources.jsonl');
  if (!existsSync(file) || !existsSync(path.join(SOURCE_DIR, 'records.json'))) stop(`the run folder ${SOURCE_DIR} or its sources.jsonl / records.json is absent — the probe is skipped (report §6) and the PR stays draft.`, 4);
  const raw = readFileSync(file);
  const sha = sha256Utf8(raw.toString('utf8'));
  if (sha !== SOURCES_SHA256) stop(`sources.jsonl SHA-256 is ${sha}, not the Phase 0's ${SOURCES_SHA256}`);
  const sources = raw.toString('utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  const records = readJson(path.join(SOURCE_DIR, 'records.json'));
  return { sources, records, sha };
}

function plan() {
  if (existsSync(P('manifest.json')) && (readJson(P('manifest.json')).batches || []).length) stop(`${RUN_DIR} already has a batch — move it aside to plan a new run.`);
  const { sources, records, sha } = loadSource();
  const byK = new Map(records.map((r) => [r.k, r]));
  const block = renderCryptoSlotBlockForced();
  const tasks = [];
  const excluded = [];
  const lines = [];
  for (const s of sources) {
    if (typeof s.request !== 'string') continue;
    const req = JSON.parse(s.request);
    if (typeof req.system !== 'string' || !req.system.includes(TIERED_MARK)) continue;
    const keys = Object.keys(req);
    if (keys.join(',') !== EXPECTED_KEYS.join(',')) { excluded.push({ k: s.k, why: `request keys ${keys.join(',')}` }); continue; }
    const edited = spliceCryptoSlotBlock(req.system);
    if (edited === null) { excluded.push({ k: s.k, why: 'anchor not found exactly once' }); continue; }
    // Verify by marker: exactly the block was added, once, at the anchor; nothing else moved.
    if (edited.length !== req.system.length + block.length
      || edited.split(CRYPTO_SLOT_BANNER).length !== 2
      || edited.replace(block, '') !== req.system) { excluded.push({ k: s.k, why: 'splice verification failed' }); continue; }
    const rec = byK.get(s.k);
    if (!rec) { excluded.push({ k: s.k, why: 'no records.json row' }); continue; }
    const i = tasks.length;
    const params = { ...req, system: edited };
    tasks.push({
      i,
      k: s.k,
      archetype: rec.archetype,
      refused: rec.gate?.cause === PAIR_CAUSE,
      captured: rec.origTuple ?? null,
      gateCause: rec.gate?.cause ?? null,
      model: req.model,
      temperature: req.temperature,
      maxTokens: req.max_tokens,
      inputTokens: Number.isFinite(rec.envelope?.inputTokens) ? rec.envelope.inputTokens : Math.ceil(s.request.length / 3),
      outputTokens: Number.isFinite(rec.envelope?.outputTokens) ? rec.envelope.outputTokens : req.max_tokens,
      systemSha256Before: sha256Utf8(req.system),
      systemSha256After: sha256Utf8(edited),
    });
    lines.push(JSON.stringify({ custom_id: `cs_${String(i).padStart(3, '0')}`, params }));
  }
  const tiered = tasks.length + excluded.length;
  const refused = tasks.filter((t) => t.refused).length;
  console.log(`[probe] sources.jsonl SHA-256 ${sha} (matches the Phase 0)`);
  console.log(`[probe] tiered stored requests: ${tiered} (expected ${EXPECTED.tiered}); spliced and verified: ${tasks.length}; excluded: ${excluded.length}`);
  console.log(`[probe] of which refused for ${PAIR_CAUSE}: ${refused} (expected ${EXPECTED.refused})`);
  if (tiered !== EXPECTED.tiered) stop(`found ${tiered} tiered requests, not ${EXPECTED.tiered}`);
  const refusedAll = records.filter((r) => r.gate?.cause === PAIR_CAUSE).length;
  if (refusedAll !== EXPECTED.refused) stop(`records.json has ${refusedAll} ${PAIR_CAUSE} rows, not ${EXPECTED.refused}`);
  const models = [...new Set(tasks.map((t) => `${t.model} @ temperature ${t.temperature}`))];
  console.log(`[probe] stored model/temperature (read, not chosen): ${models.join('; ')}; max_tokens ${[...new Set(tasks.map((t) => t.maxTokens))].join('/')}`);
  const est = estimate(tasks, block.length);
  console.log(`[probe] block: ${block.length} chars (~${est.blockTokEstimate} tokens at chars/3)`);
  console.log(`[probe] ESTIMATE: ${est.calls} calls, planned $${est.plannedUsd.toFixed(2)}, worst case (every reply at max_tokens) $${est.worstUsd.toFixed(2)} — cap ${CAPS.calls} calls / $${CAPS.usd}`);
  if (!withinCaps(est)) stop('the estimate is over the cap; nothing was written or sent.', 5);
  mkdirSync(RUN_DIR, { recursive: true });
  writeFileSync(P('requests.jsonl'), `${lines.join('\n')}\n`);
  const manifest = existsSync(P('manifest.json')) ? readJson(P('manifest.json')) : {};
  stamp(manifest, 'plan');
  manifest.plan = {
    at: new Date().toISOString(),
    sourcesSha256: sha,
    blockSha256: sha256Utf8(block),
    blockChars: block.length,
    requestsSha256: sha256Utf8(readFileSync(P('requests.jsonl'), 'utf8')),
    tasks,
    excluded,
    estimate: est,
  };
  writeJsonAtomic(P('manifest.json'), manifest);
  console.log(`[probe] plan written to ${RUN_DIR} (requests.jsonl, manifest.json). Next: submit --go`);
}

// ---------------------------------------------------------------- submit / status / collect

async function submit(flags) {
  const manifest = existsSync(P('manifest.json')) ? readJson(P('manifest.json')) : null;
  if (!manifest?.plan) stop('no plan — run plan first.');
  if ((manifest.batches || []).length || manifest.pendingCreate) stop('a batch was already created (or a create was interrupted) — check status, or reconcile manifest.json by hand. Nothing was sent.');
  const body = readFileSync(P('requests.jsonl'), 'utf8');
  if (sha256Utf8(body) !== manifest.plan.requestsSha256) stop('requests.jsonl no longer matches the plan — re-run plan.');
  const lines = body.split('\n').filter((l) => l.trim());
  if (lines.length !== manifest.plan.tasks.length) stop('requests.jsonl line count does not match the plan.');
  for (const [i, l] of lines.entries()) {
    const sys = JSON.parse(l).params.system;
    if (sha256Utf8(sys) !== manifest.plan.tasks[i].systemSha256After) stop(`request ${i} system prompt does not match the plan.`);
  }
  const est = manifest.plan.estimate;
  console.log(`[probe] ESTIMATE: ${est.calls} calls, planned $${est.plannedUsd.toFixed(2)}, worst $${est.worstUsd.toFixed(2)} — cap ${CAPS.calls} / $${CAPS.usd}`);
  if (!withinCaps(est)) stop('over the cap; nothing was sent.', 5);
  if (!flags.go) { console.log('[probe] dry run — re-run with --go to create the batch.'); return; }
  const apiKey = anthropicKey();
  stamp(manifest, 'submit');
  manifest.pendingCreate = { at: new Date().toISOString(), count: lines.length };
  writeJsonAtomic(P('manifest.json'), manifest);
  const r = await api(apiKey, 'POST', '/v1/messages/batches', `{"requests":[${lines.join(',')}]}`);
  if (r.status !== 200 || typeof r.json?.id !== 'string') stop(`batch create returned HTTP ${r.status}: ${String(r.json?.error?.message ?? '').slice(0, 300)} (pendingCreate kept; check the Console before retrying)`);
  manifest.batches = [{ batchId: r.json.id, createdAt: new Date().toISOString(), count: lines.length }];
  delete manifest.pendingCreate;
  writeJsonAtomic(P('manifest.json'), manifest);
  console.log(`[probe] created ${r.json.id} (${lines.length} requests). Next: status --wait, then collect`);
}

async function status(flags) {
  const manifest = readJson(P('manifest.json'));
  const b = (manifest.batches || [])[0];
  if (!b) stop('no batch recorded.');
  const apiKey = anthropicKey();
  const t0 = Date.now();
  for (;;) {
    const r = await api(apiKey, 'GET', `/v1/messages/batches/${b.batchId}`);
    const st = r.json?.processing_status ?? `HTTP ${r.status}`;
    console.log(`[probe] ${b.batchId}: ${st} ${JSON.stringify(r.json?.request_counts ?? {})}`);
    if (!flags.wait || st === 'ended' || Date.now() - t0 > POLL_FOR_MS) return;
    await new Promise((res) => setTimeout(res, POLL_EVERY_MS));
  }
}

async function collect() {
  const manifest = readJson(P('manifest.json'));
  const b = (manifest.batches || [])[0];
  if (!b) stop('no batch recorded.');
  const apiKey = anthropicKey();
  stamp(manifest, 'collect');
  if (!b.resultsSaved) {
    const r = await api(apiKey, 'GET', `/v1/messages/batches/${b.batchId}`);
    if (r.json?.processing_status !== 'ended') { console.log(`[probe] ${b.batchId} is ${r.json?.processing_status ?? `HTTP ${r.status}`} — not collected yet`); return; }
    const file = P('results.jsonl');
    const res = await fetch(anthropicUrl(r.json.results_url), { redirect: 'error', headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION } });
    if (!res.ok) stop(`results download returned HTTP ${res.status} (the batch is kept)`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(`${file}.tmp`));
    renameSync(`${file}.tmp`, file);
    const rows = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    const own = new Set(manifest.plan.tasks.map((t) => `cs_${String(t.i).padStart(3, '0')}`));
    if (rows.length !== b.count || rows.some((row) => !own.has(row.custom_id))) stop(`${rows.length} result lines for ${b.count} requests, or a foreign custom_id — kept the batch; reconcile by hand`);
    b.resultsSaved = true;
    writeJsonAtomic(P('manifest.json'), manifest);
    console.log(`[probe] ${rows.length} results saved to ${file}`);
  }
  if (!b.deleted) {
    const del = await api(apiKey, 'DELETE', `/v1/messages/batches/${b.batchId}`);
    b.deleted = del.status === 200;
    writeJsonAtomic(P('manifest.json'), manifest);
    console.log(`[probe] ${b.batchId}: deleted on Anthropic's side: ${b.deleted}`);
  }
}

// ---------------------------------------------------------------- judge

function emptyCounts() {
  return { n: 0, HOLD: 0, SWAP: 0, malformed: 0, notReturned: 0, crypto_to_stock: 0, crypto_to_crypto: 0, stock_to_crypto: 0, stock_to_stock: 0 };
}
function tally(c, j) {
  c.n += 1;
  if (j.kind === 'notReturned') { c.notReturned += 1; return; }
  c[j.kind] += 1;
  if (j.kind === 'SWAP') c[j.pair] += 1;
}

function judge() {
  const manifest = readJson(P('manifest.json'));
  if (!existsSync(P('results.jsonl'))) stop('no results.jsonl — run collect first.');
  const tasks = manifest.plan.tasks;
  const requests = readFileSync(P('requests.jsonl'), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  const byId = new Map(readFileSync(P('results.jsonl'), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).map((r) => [r.custom_id, r]));
  const replay = { all: emptyCounts(), refused: emptyCounts() };
  const captured = { all: emptyCounts(), refused: emptyCounts() };
  const byArchetype = {};
  const cryptoSwaps = [];
  const shortRows = [];
  let anyShort = 0;
  let inTok = 0; let outTok = 0; const blockDeltas = [];
  for (const t of tasks) {
    const id = `cs_${String(t.i).padStart(3, '0')}`;
    const row = byId.get(id);
    const msg = row?.result?.type === 'succeeded' ? row.result.message : null;
    const input = msg ? toolInputOf(msg) : null;
    const j = !msg ? { kind: 'notReturned', type: row?.result?.type ?? 'missing' } : judgeInput(input);
    const cap = t.captured?.valid === false || t.gateCause?.startsWith('model_failed')
      ? { kind: 'malformed' }
      : t.captured?.action === 'SWAP'
        ? { kind: 'SWAP', out: t.captured.out, in: t.captured.in, pair: pairKind(t.captured.out, t.captured.in) }
        : t.captured?.action === 'HOLD' ? { kind: 'HOLD' } : { kind: 'malformed' };
    tally(replay.all, j); tally(captured.all, cap);
    if (t.refused) { tally(replay.refused, j); tally(captured.refused, cap); }
    const a = byArchetype[t.archetype] || (byArchetype[t.archetype] = { replay: emptyCounts(), captured: emptyCounts() });
    tally(a.replay, j); tally(a.captured, cap);
    if (j.kind === 'SWAP' && j.pair !== 'stock_to_stock') {
      cryptoSwaps.push({ i: t.i, refused: t.refused, pair: j.pair, out: j.out, in: j.in, incomingBenchDailyPct: benchDailyPct(requests[t.i].params.messages?.[2]?.content, j.in) });
    }
    if (msg) {
      inTok += msg.usage?.input_tokens ?? 0;
      outTok += msg.usage?.output_tokens ?? 0;
      if (Number.isFinite(msg.usage?.input_tokens) && Number.isFinite(t.inputTokens)) blockDeltas.push(msg.usage.input_tokens - t.inputTokens);
      const rationale = input?.rationale;
      if (anyShortToken(rationale)) anyShort += 1;
      const hits = shortPositionMatches(rationale);
      if (hits.length) shortRows.push({ i: t.i, archetype: t.archetype, first80: String(rationale).slice(0, 80), around: String(rationale).slice(Math.max(0, hits[0].index - 40), hits[0].index + 40) });
    }
  }
  const price = PRICES[priceKeyOf(tasks[0].model)];
  const costUsd = (inTok * price.batchIn + outTok * price.batchOut) / 1e6;
  blockDeltas.sort((x, y) => x - y);
  const median = blockDeltas.length ? blockDeltas[Math.floor(blockDeltas.length / 2)] : null;
  const bar = {
    cryptoToStockAll: replay.all.crypto_to_stock,
    cryptoToStockRefused: replay.refused.crypto_to_stock,
    passed: replay.all.crypto_to_stock <= BAR.cryptoToStockMax && replay.refused.crypto_to_stock <= BAR.cryptoToStockRefusedMax,
    rule: `crypto → stock ≤ ${BAR.cryptoToStockMax} of ${tasks.length} and ${BAR.cryptoToStockRefusedMax} of the ${replay.refused.n} refused`,
  };
  const out = {
    at: new Date().toISOString(),
    headSha: headSha(),
    n: tasks.length,
    excluded: manifest.plan.excluded.length,
    replay,
    captured,
    byArchetype,
    cryptoSwaps,
    short: { rationalesWithAnyShortToken: anyShort, rationalesWithPositionShort: shortRows.length },
    usage: { inputTokens: inTok, outputTokens: outTok, costUsd, measuredBlockTokensMedian: median, measuredBlockTokensRange: blockDeltas.length ? [blockDeltas[0], blockDeltas.at(-1)] : null },
    bar,
  };
  writeJsonAtomic(P('judge.json'), out);
  writeJsonAtomic(P('short-samples.json'), shortRows.slice(0, 3));
  console.log(JSON.stringify({ ...out, byArchetype: undefined }, null, 2));
  console.log(`[probe] BAR (${bar.rule}): ${bar.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`[probe] judge.json and short-samples.json (player text — local only) written to ${RUN_DIR}`);
}

// ---------------------------------------------------------------- selftest

export function runSelftest() {
  const fails = [];
  const check = (cond, label) => { if (!cond) fails.push(label); };
  check(pairKind('BTC', 'AFRM') === 'crypto_to_stock', 'pair crypto→stock');
  check(pairKind('btc', 'eth') === 'crypto_to_crypto', 'pair crypto→crypto (case)');
  check(pairKind('NVDA', 'SOL') === 'stock_to_crypto', 'pair stock→crypto');
  check(pairKind('NVDA', 'AMD') === 'stock_to_stock', 'pair stock→stock');
  const swap = { decision: 'SWAP', rationale: 'r', conviction: 80, hypothesis: 'h', symbolOut: 'BTC', symbolIn: 'ETH' };
  const j = judgeInput({ ...swap });
  check(j.kind === 'SWAP' || j.kind === 'malformed', 'judge returns a kind');
  check(judgeInput(null).kind === 'malformed', 'judge: null input is malformed');
  check(judgeInput({ decision: 'SWAP' }).kind === 'malformed', 'judge: missing required fields is malformed');
  check(toolInputOf({ content: [{ type: 'text', text: 'x' }, { type: 'tool_use', input: { a: 1 } }] })?.a === 1, 'tool input found');
  check(toolInputOf({ content: [{ type: 'text', text: 'x' }] }) === null, 'no tool_use → null');
  for (const t of ["I'd go short BTC here", 'shorting ETH would fit', 'flip it to a short position', 'I would short this rally']) check(shortPositionMatches(t).length === 1, `short position: ${t}`);
  for (const t of ['a short-term bounce', 'in short, hold', 'it falls short of the bar', 'one short window left', 'a short squeeze risk', 'short term momentum', 'a very short session']) check(shortPositionMatches(t).length === 0, `short not position: ${t}`);
  check(anyShortToken('a short-term bounce') && !anyShortToken('shortlist'), 'any-short token');
  const live = 'x\n\nBENCH (available for swap):\nSymbol,Sector,$Current,Daily%,ATR%,Status\nAMD,Tech,$1,+1.20%,3.1%,available\nETH,Crypto,$2,-0.40%,5.0%,available\n\nNEXT';
  check(benchDailyPct(live, 'ETH') === -0.4 && benchDailyPct(live, 'AMD') === 1.2 && benchDailyPct(live, 'SOL') === null, 'bench daily %');
  const block = renderCryptoSlotBlockForced();
  const sys = 'Tier multipliers: Star = 2.0x, Core = 1.5x, Support = 1.0x\nWhen you swap out an asset, its current points are LOCKED permanently. The incoming asset starts scoring fresh from its price at swap time.\n\n━━━ DECISION FRAMEWORK ━━━\n\nrest';
  const ed = spliceCryptoSlotBlock(sys);
  check(ed !== null && ed.length === sys.length + block.length && ed.replace(block, '') === sys && ed.split(CRYPTO_SLOT_BANNER).length === 2, 'splice adds exactly the block');
  check(spliceCryptoSlotBlock(sys.replace('Tier multipliers', 'NO tier multipliers')) === null, 'splice refuses a non-tiered prompt');
  const est = estimate([{ model: 'claude-haiku-4-5-20251001', inputTokens: 15000, outputTokens: 1200, maxTokens: 2048 }], 900);
  check(est.calls === 1 && est.worstUsd > est.plannedUsd && withinCaps(est), 'estimate within caps');
  check(!withinCaps({ calls: 301, worstUsd: 1 }) && !withinCaps({ calls: 10, worstUsd: 5.01 }), 'caps refuse over');
  for (const f of fails) console.error(`SELFTEST FAIL: ${f}`);
  console.log(`[probe] selftest: ${fails.length ? `${fails.length} FAILED` : 'all passed'}`);
  return fails.length === 0;
}

// ---------------------------------------------------------------- main

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = { go: rest.includes('--go'), wait: rest.includes('--wait') };
  if (cmd === 'selftest') process.exit(runSelftest() ? 0 : 1);
  else if (cmd === 'plan') plan();
  else if (cmd === 'submit') await submit(flags);
  else if (cmd === 'status') await status(flags);
  else if (cmd === 'collect') await collect();
  else if (cmd === 'judge') judge();
  else stop('usage: cryptoSlotProbe.mjs selftest | plan | submit [--go] | status [--wait] | collect | judge');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => { console.error(redactSecrets(err?.stack || String(err))); process.exit(1); });
}
