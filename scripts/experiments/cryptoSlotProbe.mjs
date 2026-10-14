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
//       api/_utils/agentCryptoAssets.js — the crypto list.
//   - Secrets: CLAUDE_API_KEY from the environment, then this tree's
//     .env.local, then the primary checkout's. Never printed or written.
//
// Everything this writes lands OUTSIDE the repo, in
// %USERPROFILE%/ft-experiment-exhibits/crypto-slot-probe/ — request bodies,
// replies and rationale samples carry player text. The source run folder is
// read, never written.
//
// USAGE (repo root):
//   node scripts/experiments/cryptoSlotProbe.mjs selftest            # synthetic checks, no files, no network
//   node scripts/experiments/cryptoSlotProbe.mjs plan                # splice + verify + estimate (no spend)
//   node scripts/experiments/cryptoSlotProbe.mjs submit --go         # one Message Batch, cap-checked in code
//   node scripts/experiments/cryptoSlotProbe.mjs status [--wait]
//   node scripts/experiments/cryptoSlotProbe.mjs collect             # save results, then delete the batch on Anthropic's side
//   node scripts/experiments/cryptoSlotProbe.mjs judge               # the counts (prompt §6.4) and the bar
//   node scripts/experiments/cryptoSlotProbe.mjs submit --retry --go # once: re-send only the requests with no result

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
import { CRYPTO_ASSETS, VALID_CRYPTO_SYMBOLS } from '../../api/_utils/agentCryptoAssets.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..', '..');

// ---------------------------------------------------------------- frozen constants

const SOURCE_DIR = path.join(os.homedir(), 'ft-experiment-exhibits', 'archetype-ablation-run');
const RUN_DIR = path.join(os.homedir(), 'ft-experiment-exhibits', 'crypto-slot-probe');
/** The Phase 0 appendix's source (docs/audits/20261014_PHASE0_CRYPTO_SLOT.md). */
const SOURCES_SHA256 = '6fb95a74bcbdd8ae59580b48ec8896722938d07ddc1be4a58c1b463202144437';
/** Prompt §6: cap $5 / 300 calls, enforced at plan and at every submit (cumulative). */
export const CAPS = Object.freeze({ calls: 300, usd: 5 });
/** Prompt §6.4 bar, applied as written. */
export const BAR = Object.freeze({ cryptoToStockMax: 2, cryptoToStockRefusedMax: 0 });
/** The Phase 0 counts the plan must reproduce before anything is sent. */
export const EXPECTED = Object.freeze({ tiered: 144, refused: 26 });
const TIERED_MARK = 'BaggerBomb game';
const PAIR_CAUSE = 'pair_validation:asset_class_mix';
const EXPECTED_KEYS = ['model', 'max_tokens', 'temperature', 'system', 'messages', 'tools', 'tool_choice'];

const ANTHROPIC = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
const POLL_EVERY_MS = 60 * 1000;
const POLL_FOR_MS = 2 * 60 * 60 * 1000;

const CRYPTO = new Set(VALID_CRYPTO_SYMBOLS);
const CRYPTO_BY_NAME = new Map(CRYPTO_ASSETS.map((a) => [String(a.name).toUpperCase(), a.symbol]));
const sym = (s) => (typeof s === 'string' && s.trim() ? s.trim().toUpperCase() : null);
const customId = (i) => `cs_${String(i).padStart(3, '0')}`;
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

/**
 * A ticker as production's crypto routing reads it: case and spaces ignored,
 * a leading '$' and a '-USD' / '.CC' suffix stripped (marketDataCache.js
 * routes crypto as '<SYM>-USD.CC'), and a crypto's display name mapped to its
 * symbol ('Bitcoin' → 'BTC').
 */
export function normSymbol(s) {
  const raw = sym(s);
  if (!raw) return null;
  if (CRYPTO_BY_NAME.has(raw)) return CRYPTO_BY_NAME.get(raw);
  const m = /^\$?([A-Z0-9.]+?)(?:-USD)?(?:\.CC)?$/.exec(raw);
  return m ? m[1] : raw;
}

/** A proposal's asset-class pair, read by (normalised) symbol — the Phase 0 method. */
export function pairKind(out, inn) {
  const o = CRYPTO.has(normSymbol(out)) ? 'crypto' : 'stock';
  const i = CRYPTO.has(normSymbol(inn)) ? 'crypto' : 'stock';
  return `${o}_to_${i}`;
}

/**
 * One reply's tool input → { kind: 'malformed'|'HOLD'|'SWAP', pair } via
 * production's validator. A malformed reply that still names a SWAP pair
 * keeps it as `carriedPair`, so a crypto → stock proposal cannot hide behind
 * a missing field (it counts against the bar).
 */
export function judgeInput(input) {
  const v = validateTradeToolResult(input);
  if (!v.valid) {
    const carriedPair = input?.decision === 'SWAP' && sym(input?.symbolOut) && sym(input?.symbolIn)
      ? pairKind(input.symbolOut, input.symbolIn) : null;
    return { kind: 'malformed', why: v.invalidField, carriedPair };
  }
  if (input.decision === 'HOLD') return { kind: 'HOLD' };
  return { kind: 'SWAP', out: normSymbol(input.symbolOut), in: normSymbol(input.symbolIn), pair: pairKind(input.symbolOut, input.symbolIn) };
}

/** The reply message → its FIRST submit_trade_decision input (as agent-evaluate.js reads it), or null. */
export function toolInputOf(message) {
  const block = Array.isArray(message?.content) ? message.content.find((b) => b?.type === 'tool_use') : null;
  return block ? block.input : null;
}

// "short" as a POSITION (the agent's own long/short side): inclusion patterns,
// so the brevity / horizon senses ("a short window", "short-term", "short
// periods") and other traders' shorts ("short interest", "short squeeze",
// "short sellers", "short-covering") never match. A heuristic, stated as one
// in the report; every match is saved locally for audit.
const TICKERS = [...VALID_CRYPTO_SYMBOLS].join('|');
const SHORT_POSITION_PATTERNS = [
  /\b(?:go|goes|going|went|gone|get|gets|getting|got|stay|staying|turn|turning|switch|switching|flip|flips|flipping|flipped|open|opening|take|taking|net)\s+(?:(?:it|this|that|them|the\s+\w+)\s+)?(?:(?:to|into)\s+)?(?:a\s+)?short\b(?![\s–-]*(?:term|lived|window|time|period|run|squeeze|interest|seller|covering|horizon|while|pause|break|breather|look|dip|pullback|consolidation|rest|hold))/gi,
  /\bshort(?:ing|ed)\b(?![\s–-]*(?:circuit|squeeze))/gi,
  /\bshort\s+(?:it|this|that|them|these|those|the\s+(?:stock|name|coin|crypto|token|asset|position|rally|bounce|move|pop|spike|pump))\b/gi,
  new RegExp(`\\bshort\\s+\\$?(?:${TICKERS})\\b`, 'gi'),
  /\bshort\s+(?:position|positions|side|exposure|trade|trades|bet|bias)\b/gi,
  /\b(?:long\s*(?:or|\/|and)\s*short|short\s*(?:or|\/)\s*long)\b(?![\s–-]*(?:term|lived))/gi,
  /\b(?:cannot|can't|can\s+not|unable\s+to|not\s+allowed\s+to|no\s+way\s+to)\s+(?:go\s+|open\s+(?:a\s+)?)?short\b/gi,
];
export function shortPositionMatches(text) {
  if (typeof text !== 'string') return [];
  const hits = new Map();
  for (const re of SHORT_POSITION_PATTERNS) {
    for (const m of text.matchAll(re)) if (!hits.has(m.index)) hits.set(m.index, m[0]);
  }
  return [...hits.entries()].sort((a, b) => a[0] - b[0]).map(([index, token]) => ({ index, token }));
}
export const anyShortToken = (text) => typeof text === 'string' && /\bshort(?:s|ing|ed)?\b/i.test(text);

/** The player-visible free-text fields of a reply besides the rationale (status feed, thesis, anticipation, hypothesis). */
export function otherNarrativeText(input) {
  if (!input || typeof input !== 'object') return '';
  const parts = [input.hypothesis, input.status_feed_update, input.trade_reasoning?.thesis];
  for (const c of Array.isArray(input.anticipationCandidates) ? input.anticipationCandidates : []) parts.push(c?.signalSummary, c?.threshold, c?.rationale);
  return parts.filter((x) => typeof x === 'string').join('\n');
}

/** The incoming bench name's Daily% in the request's own BENCH table (null when absent). */
export function benchDailyPct(liveText, symbol) {
  if (typeof liveText !== 'string' || !symbol) return null;
  const head = 'BENCH (available for swap):\nSymbol,Sector,$Current,Daily%,ATR%,Status\n';
  const at = liveText.indexOf(head);
  if (at === -1) return null;
  const rows = liveText.slice(at + head.length).split('\n\n')[0].split('\n');
  const row = rows.find((r) => normSymbol(r.split(',')[0]) === normSymbol(symbol));
  if (!row) return null;
  const v = Number.parseFloat(String(row.split(',')[3]).replace('%', ''));
  return Number.isFinite(v) ? v : null;
}

/** "Verify by marker": exactly the block was added, once, between the two marker lines; nothing else moved. */
export function verifySplice(original, edited, block) {
  return typeof edited === 'string'
    && edited.length === original.length + block.length
    && edited.split(CRYPTO_SLOT_BANNER).length === 2
    && edited.split(`swap time.\n${block}\n━━━ DECISION FRAMEWORK ━━━`).length === 2
    && edited.replace(block, '') === original;
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

// ---------------------------------------------------------------- the judge (pure; selftest-covered)

function emptyCounts() {
  return { n: 0, HOLD: 0, SWAP: 0, malformed: 0, notReturned: 0, crypto_to_stock: 0, crypto_to_crypto: 0, stock_to_crypto: 0, stock_to_stock: 0, malformedCarriedCryptoToStock: 0 };
}
function tally(c, j) {
  c.n += 1;
  if (j.kind === 'notReturned') { c.notReturned += 1; return; }
  c[j.kind] += 1;
  if (j.kind === 'SWAP') c[j.pair] += 1;
  if (j.kind === 'malformed' && j.carriedPair === 'crypto_to_stock') c.malformedCarriedCryptoToStock += 1;
}

/**
 * The bar (prompt §6.4) over the replay counts. A crypto → stock proposal
 * counts whether the reply was valid or malformed. FAILED as soon as the
 * proposals already over the bar; otherwise INCOMPLETE unless every request
 * came back and the refused subset is the full 26.
 */
export function applyBar(replay, expectedRefused = EXPECTED.refused) {
  const all = replay.all.crypto_to_stock + replay.all.malformedCarriedCryptoToStock;
  const refused = replay.refused.crypto_to_stock + replay.refused.malformedCarriedCryptoToStock;
  const met = all <= BAR.cryptoToStockMax && refused <= BAR.cryptoToStockRefusedMax;
  const complete = replay.all.notReturned === 0 && replay.refused.n === expectedRefused;
  return {
    cryptoToStockAll: all,
    cryptoToStockRefused: refused,
    notReturned: replay.all.notReturned,
    refusedN: replay.refused.n,
    outcome: !met ? 'FAILED' : complete ? 'PASSED' : 'INCOMPLETE',
    rule: `crypto → stock (valid or malformed) ≤ ${BAR.cryptoToStockMax} of ${replay.all.n} and ≤ ${BAR.cryptoToStockRefusedMax} of the ${expectedRefused} refused, with every request answered`,
  };
}

/** A captured (stored) decision, read off the records.json origTuple. */
function capturedJudgement(t) {
  if (t.captured?.valid === false || String(t.gateCause ?? '').startsWith('model_failed')) return { kind: 'malformed', carriedPair: null };
  if (t.captured?.action === 'SWAP') return { kind: 'SWAP', out: t.captured.out, in: t.captured.in, pair: pairKind(t.captured.out, t.captured.in) };
  if (t.captured?.action === 'HOLD') return { kind: 'HOLD' };
  return { kind: 'malformed', carriedPair: null };
}

/**
 * Judge a run. `rowsById` maps custom_id → the batch result row (the best one
 * across batches); `liveById` maps custom_id → the request's live-context text.
 */
export function judgeRun(tasks, rowsById, liveById, { expectedRefused = EXPECTED.refused } = {}) {
  const replay = { all: emptyCounts(), refused: emptyCounts() };
  const captured = { all: emptyCounts(), refused: emptyCounts() };
  const byArchetype = {};
  const cryptoSwaps = [];
  const shortRows = [];
  const short = { rationaleAnyToken: 0, rationalePosition: 0, rationalePositionRefused: 0, otherFieldsPosition: 0 };
  let inTok = 0; let outTok = 0; const blockDeltas = [];
  for (const t of tasks) {
    const id = customId(t.i);
    const row = rowsById.get(id);
    const msg = row?.result?.type === 'succeeded' ? row.result.message : null;
    const input = msg ? toolInputOf(msg) : null;
    const j = !msg ? { kind: 'notReturned', type: row?.result?.type ?? 'missing' } : judgeInput(input);
    const cap = capturedJudgement(t);
    tally(replay.all, j); tally(captured.all, cap);
    if (t.refused) { tally(replay.refused, j); tally(captured.refused, cap); }
    const a = byArchetype[t.archetype] || (byArchetype[t.archetype] = { replay: emptyCounts(), captured: emptyCounts() });
    tally(a.replay, j); tally(a.captured, cap);
    const pair = j.kind === 'SWAP' ? j.pair : j.kind === 'malformed' ? j.carriedPair : null;
    if (pair && pair !== 'stock_to_stock') {
      cryptoSwaps.push({ i: t.i, refused: t.refused, valid: j.kind === 'SWAP', pair, out: j.out ?? normSymbol(input?.symbolOut), in: j.in ?? normSymbol(input?.symbolIn), incomingBenchDailyPct: benchDailyPct(liveById.get(id), j.in ?? input?.symbolIn) });
    }
    if (msg) {
      inTok += msg.usage?.input_tokens ?? 0;
      outTok += msg.usage?.output_tokens ?? 0;
      if (Number.isFinite(msg.usage?.input_tokens) && Number.isFinite(t.inputTokens)) blockDeltas.push(msg.usage.input_tokens - t.inputTokens);
      const rationale = input?.rationale;
      if (anyShortToken(rationale)) short.rationaleAnyToken += 1;
      const hits = shortPositionMatches(rationale);
      if (hits.length) {
        short.rationalePosition += 1;
        if (t.refused) short.rationalePositionRefused += 1;
        shortRows.push({ i: t.i, archetype: t.archetype, refused: t.refused, first80: String(rationale).slice(0, 80), windows: hits.map((h) => String(rationale).slice(Math.max(0, h.index - 40), h.index + 40)) });
      }
      if (shortPositionMatches(otherNarrativeText(input)).length) short.otherFieldsPosition += 1;
    }
  }
  const cryptoToCrypto = cryptoSwaps.filter((s) => s.pair === 'crypto_to_crypto');
  blockDeltas.sort((x, y) => x - y);
  const price = tasks.length ? PRICES[priceKeyOf(tasks[0].model)] : null;
  return {
    n: tasks.length,
    replay,
    captured,
    byArchetype,
    cryptoSwaps,
    cryptoToCryptoIncomingNotUp: cryptoToCrypto.filter((s) => s.incomingBenchDailyPct !== null && s.incomingBenchDailyPct <= 0).length,
    cryptoToCryptoIncomingUnknown: cryptoToCrypto.filter((s) => s.incomingBenchDailyPct === null).length,
    short,
    shortRows,
    usage: {
      inputTokens: inTok,
      outputTokens: outTok,
      costUsd: price ? (inTok * price.batchIn + outTok * price.batchOut) / 1e6 : 0,
      measuredBlockTokensMedian: blockDeltas.length ? blockDeltas[Math.floor(blockDeltas.length / 2)] : null,
      measuredBlockTokensRange: blockDeltas.length ? [blockDeltas[0], blockDeltas.at(-1)] : null,
    },
    bar: applyBar(replay, expectedRefused),
  };
}

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
    const rec = byK.get(s.k);
    const refused = rec?.gate?.cause === PAIR_CAUSE;
    const keys = Object.keys(req);
    if (keys.join(',') !== EXPECTED_KEYS.join(',')) { excluded.push({ k: s.k, refused, why: `request keys ${keys.join(',')}` }); continue; }
    const edited = spliceCryptoSlotBlock(req.system);
    if (edited === null) { excluded.push({ k: s.k, refused, why: 'anchor not found exactly once' }); continue; }
    if (!verifySplice(req.system, edited, block)) { excluded.push({ k: s.k, refused, why: 'splice verification failed' }); continue; }
    if (!rec) { excluded.push({ k: s.k, refused, why: 'no records.json row' }); continue; }
    const i = tasks.length;
    tasks.push({
      i,
      k: s.k,
      archetype: rec.archetype,
      refused,
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
    lines.push(JSON.stringify({ custom_id: customId(i), params: { ...req, system: edited } }));
  }
  const tiered = tasks.length + excluded.length;
  const refusedPlanned = tasks.filter((t) => t.refused).length;
  console.log(`[probe] sources.jsonl SHA-256 ${sha} (matches the Phase 0)`);
  console.log(`[probe] tiered stored requests: ${tiered} (expected ${EXPECTED.tiered}); spliced and verified: ${tasks.length}; excluded: ${excluded.length}`);
  console.log(`[probe] refused for ${PAIR_CAUSE} and planned: ${refusedPlanned} (expected ${EXPECTED.refused})`);
  if (tiered !== EXPECTED.tiered) stop(`found ${tiered} tiered requests, not ${EXPECTED.tiered}`);
  const refusedAll = records.filter((r) => r.gate?.cause === PAIR_CAUSE).length;
  if (refusedAll !== EXPECTED.refused) stop(`records.json has ${refusedAll} ${PAIR_CAUSE} rows, not ${EXPECTED.refused}`);
  // The bar is "0 of the 26": every refused request must be sent, and an empty plan is never a plan.
  if (refusedPlanned !== EXPECTED.refused) stop(`${EXPECTED.refused - refusedPlanned} refused request(s) were excluded — the bar cannot be read over the 26; nothing was written.`);
  if (!tasks.length) stop('every request was excluded; nothing was written.');
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

function loadResultRows(manifest) {
  const best = new Map();
  for (const [n, b] of (manifest.batches || []).entries()) {
    if (!b.resultsSaved) continue;
    for (const line of readFileSync(P(`results-${n}.jsonl`), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      if (!best.has(row.custom_id) || row.result?.type === 'succeeded') best.set(row.custom_id, row);
    }
  }
  return best;
}

async function submit(flags) {
  const manifest = existsSync(P('manifest.json')) ? readJson(P('manifest.json')) : null;
  if (!manifest?.plan) stop('no plan — run plan first.');
  if (manifest.pendingCreate) stop('a create was interrupted — check the Console and reconcile manifest.json by hand. Nothing was sent.');
  const body = readFileSync(P('requests.jsonl'), 'utf8');
  if (sha256Utf8(body) !== manifest.plan.requestsSha256) stop('requests.jsonl no longer matches the plan — re-run plan.');
  const all = body.split('\n').filter((l) => l.trim());
  if (all.length !== manifest.plan.tasks.length) stop('requests.jsonl line count does not match the plan.');
  for (const [i, l] of all.entries()) {
    if (sha256Utf8(JSON.parse(l).params.system) !== manifest.plan.tasks[i].systemSha256After) stop(`request ${i} system prompt does not match the plan.`);
  }
  const batches = manifest.batches || [];
  let idx;
  let kind;
  if (flags.retry) {
    // Once, and only the requests that came back with no result.
    if (batches.length !== 1 || !batches[0].resultsSaved) stop('a retry needs exactly one collected batch.');
    const got = loadResultRows(manifest);
    idx = manifest.plan.tasks.map((t) => t.i).filter((i) => got.get(customId(i))?.result?.type !== 'succeeded');
    if (!idx.length) { console.log('[probe] every request has a result — nothing to retry.'); return; }
    kind = 'retry';
  } else {
    if (batches.length) stop('a batch was already created — check status, or use --retry for requests with no result. Nothing was sent.');
    idx = manifest.plan.tasks.map((t) => t.i);
    kind = 'main';
  }
  const tasks = idx.map((i) => manifest.plan.tasks[i]);
  const est = estimate(tasks, manifest.plan.blockChars);
  const sentBefore = batches.reduce((n, b) => n + b.count, 0);
  const worstBefore = batches.reduce((s, b) => s + (b.worstUsd ?? 0), 0);
  const cumulative = { calls: sentBefore + est.calls, worstUsd: worstBefore + est.worstUsd };
  console.log(`[probe] ${kind}: ${est.calls} calls, planned $${est.plannedUsd.toFixed(2)}, worst $${est.worstUsd.toFixed(2)}; cumulative ${cumulative.calls} calls / worst $${cumulative.worstUsd.toFixed(2)} — cap ${CAPS.calls} / $${CAPS.usd}`);
  if (!withinCaps(cumulative)) stop('over the cap; nothing was sent.', 5);
  if (!flags.go) { console.log('[probe] dry run — re-run with --go to create the batch.'); return; }
  const apiKey = anthropicKey();
  stamp(manifest, `submit:${kind}`);
  manifest.pendingCreate = { at: new Date().toISOString(), count: idx.length, kind };
  writeJsonAtomic(P('manifest.json'), manifest);
  const r = await api(apiKey, 'POST', '/v1/messages/batches', `{"requests":[${idx.map((i) => all[i]).join(',')}]}`);
  if (r.status !== 200 || typeof r.json?.id !== 'string') stop(`batch create returned HTTP ${r.status}: ${String(r.json?.error?.message ?? '').slice(0, 300)} (pendingCreate kept; check the Console before retrying)`);
  manifest.batches = [...batches, { batchId: r.json.id, createdAt: new Date().toISOString(), count: idx.length, kind, ids: idx.map(customId), worstUsd: est.worstUsd }];
  delete manifest.pendingCreate;
  writeJsonAtomic(P('manifest.json'), manifest);
  console.log(`[probe] created ${r.json.id} (${kind}, ${idx.length} requests). Next: status --wait, then collect`);
}

async function status(flags) {
  const manifest = readJson(P('manifest.json'));
  const b = (manifest.batches || []).at(-1);
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
  if (!(manifest.batches || []).length) stop('no batch recorded.');
  const apiKey = anthropicKey();
  stamp(manifest, 'collect');
  for (const [n, b] of manifest.batches.entries()) {
    if (!b.resultsSaved) {
      const r = await api(apiKey, 'GET', `/v1/messages/batches/${b.batchId}`);
      if (r.json?.processing_status !== 'ended') { console.log(`[probe] ${b.batchId} is ${r.json?.processing_status ?? `HTTP ${r.status}`} — not collected yet`); continue; }
      const file = P(`results-${n}.jsonl`);
      const res = await fetch(anthropicUrl(r.json.results_url), { redirect: 'error', headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION } });
      if (!res.ok) stop(`results download returned HTTP ${res.status} (the batch is kept)`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(`${file}.tmp`));
      renameSync(`${file}.tmp`, file);
      const rows = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
      const own = new Set(b.ids);
      if (rows.length !== b.count || rows.some((row) => !own.has(row.custom_id))) stop(`${rows.length} result lines for ${b.count} requests, or a foreign custom_id — kept the batch; reconcile by hand`);
      const types = {};
      for (const row of rows) types[row.result?.type] = (types[row.result?.type] || 0) + 1;
      b.resultsSaved = true;
      b.resultTypes = types;
      writeJsonAtomic(P('manifest.json'), manifest);
      console.log(`[probe] ${b.batchId}: ${rows.length} results saved to ${file} ${JSON.stringify(types)}`);
    }
    if (b.resultsSaved && !b.deleted) {
      const del = await api(apiKey, 'DELETE', `/v1/messages/batches/${b.batchId}`);
      b.deleted = del.status === 200;
      writeJsonAtomic(P('manifest.json'), manifest);
      console.log(`[probe] ${b.batchId}: deleted on Anthropic's side: ${b.deleted}`);
    }
  }
}

function judge() {
  const manifest = readJson(P('manifest.json'));
  if (!(manifest.batches || []).some((b) => b.resultsSaved)) stop('no collected results — run collect first.');
  const tasks = manifest.plan.tasks;
  const liveById = new Map(readFileSync(P('requests.jsonl'), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).map((r) => [r.custom_id, r.params.messages?.[2]?.content]));
  const out = { at: new Date().toISOString(), headSha: headSha(), excluded: manifest.plan.excluded.length, ...judgeRun(tasks, loadResultRows(manifest), liveById) };
  const { shortRows, ...summary } = out;
  writeJsonAtomic(P('judge.json'), summary);
  // Player text — local exhibits only: the first 80 characters of up to three
  // (prompt §6.4), and every matched window for audit.
  writeJsonAtomic(P('short-samples.json'), { firstThree: shortRows.slice(0, 3).map((r) => ({ i: r.i, archetype: r.archetype, first80: r.first80 })), all: shortRows });
  console.log(JSON.stringify({ ...summary, byArchetype: undefined }, null, 2));
  console.log(`[probe] BAR (${out.bar.rule}): ${out.bar.outcome}`);
  console.log(`[probe] judge.json and short-samples.json (player text — local only) written to ${RUN_DIR}`);
}

// ---------------------------------------------------------------- selftest

export function runSelftest() {
  const fails = [];
  const check = (cond, label) => { if (!cond) fails.push(label); };
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Symbols and pairs.
  for (const [s, want] of [['BTC', 'BTC'], [' btc ', 'BTC'], ['$ETH', 'ETH'], ['BTC-USD.CC', 'BTC'], ['ETH.CC', 'ETH'], ['Bitcoin', 'BTC'], ['BRK.B', 'BRK.B'], ['AFRM', 'AFRM']]) check(normSymbol(s) === want, `normSymbol(${s})`);
  check(pairKind('BTC', 'AFRM') === 'crypto_to_stock', 'pair crypto→stock');
  check(pairKind('btc', 'eth') === 'crypto_to_crypto', 'pair crypto→crypto (case)');
  check(pairKind('BTC-USD.CC', 'AMD') === 'crypto_to_stock', 'pair crypto→stock (routed form)');
  check(pairKind('NVDA', 'SOL') === 'stock_to_crypto', 'pair stock→crypto');
  check(pairKind('NVDA', 'AMD') === 'stock_to_stock', 'pair stock→stock');
  // The judge on schema-valid inputs (every required field present).
  const base = { rationale: 'r', conviction: 80, hypothesis: 'h', riskAssessment: 'low' };
  check(eq(judgeInput({ ...base, decision: 'SWAP', symbolOut: 'BTC', symbolIn: 'AFRM' }), { kind: 'SWAP', out: 'BTC', in: 'AFRM', pair: 'crypto_to_stock' }), 'judge: valid SWAP crypto→stock');
  check(eq(judgeInput({ ...base, decision: 'SWAP', symbolOut: 'btc', symbolIn: ' eth ' }), { kind: 'SWAP', out: 'BTC', in: 'ETH', pair: 'crypto_to_crypto' }), 'judge: valid SWAP crypto→crypto');
  check(eq(judgeInput({ ...base, decision: 'HOLD' }), { kind: 'HOLD' }), 'judge: valid HOLD');
  const mal = judgeInput({ rationale: 'r', conviction: 80, hypothesis: 'h', decision: 'SWAP', symbolOut: 'BTC', symbolIn: 'AFRM' });
  check(mal.kind === 'malformed' && mal.why === 'riskAssessment' && mal.carriedPair === 'crypto_to_stock', 'judge: malformed keeps its carried pair');
  check(judgeInput(null).kind === 'malformed' && judgeInput(null).carriedPair === null, 'judge: null input is malformed, nothing carried');
  check(toolInputOf({ content: [{ type: 'text', text: 'x' }, { type: 'tool_use', input: { a: 1 } }, { type: 'tool_use', input: { a: 2 } }] })?.a === 1, 'the FIRST tool_use block is read');
  check(toolInputOf({ content: [{ type: 'text', text: 'x' }] }) === null, 'no tool_use → null');
  // The judge over a synthetic run, and the bar.
  const T = (i, refused, extra = {}) => ({ i, k: `k${i}`, archetype: 'momentum_chaser', refused, captured: { valid: true, action: 'SWAP', out: 'BTC', in: 'AFRM' }, gateCause: refused ? PAIR_CAUSE : null, model: 'claude-haiku-4-5-20251001', inputTokens: 1000, ...extra });
  const ok = (input, tokens = 1100) => ({ result: { type: 'succeeded', message: { content: [{ type: 'tool_use', input }], usage: { input_tokens: tokens, output_tokens: 50 } } } });
  const hold = { ...base, decision: 'HOLD' };
  const c2s = { ...base, decision: 'SWAP', symbolOut: 'BTC', symbolIn: 'AFRM' };
  const c2c = { ...base, decision: 'SWAP', symbolOut: 'BTC', symbolIn: 'ETH' };
  const tasks = [T(0, true), T(1, true), T(2, false), T(3, false)];
  const rows = (arr) => new Map(arr.map((r, i) => [customId(i), r]).filter(([, r]) => r));
  const live = new Map([[customId(3), 'BENCH (available for swap):\nSymbol,Sector,$Current,Daily%,ATR%,Status\nETH,Crypto,$2,-0.40%,5.0%,available\n\nX']]);
  const run = (arr) => judgeRun(tasks, rows(arr), live, { expectedRefused: 2 });
  const pass = run([ok(hold), ok(c2c), ok(c2s), ok(c2c)]);
  check(pass.bar.outcome === 'PASSED' && pass.replay.all.crypto_to_stock === 1 && pass.replay.all.crypto_to_crypto === 2 && pass.replay.refused.crypto_to_crypto === 1, 'judgeRun: one non-refused crypto→stock passes');
  check(pass.captured.all.crypto_to_stock === 4 && pass.captured.refused.n === 2, 'judgeRun: captured counts');
  check(pass.cryptoToCryptoIncomingNotUp === 1 && pass.cryptoToCryptoIncomingUnknown === 1, 'judgeRun: crypto→crypto with the incoming crypto down on the day');
  check(pass.usage.measuredBlockTokensMedian === 100, 'judgeRun: measured block tokens');
  check(run([ok(c2s), ok(hold), ok(hold), ok(hold)]).bar.outcome === 'FAILED', 'bar: a refused crypto→stock fails');
  check(run([ok(hold), ok(hold), ok(c2s), ok(c2s)]).bar.outcome === 'PASSED', 'bar: two non-refused crypto→stock still pass');
  check(run([ok(hold), ok(hold), ok(c2s), ok(c2s)]).bar.cryptoToStockAll === 2, 'bar: counts two');
  const three = judgeRun([...tasks, T(4, false)], rows([ok(hold), ok(hold), ok(c2s), ok(c2s), ok(c2s)]), live, { expectedRefused: 2 });
  check(three.bar.outcome === 'FAILED', 'bar: three crypto→stock fail');
  check(run([ok({ ...c2s, riskAssessment: undefined }), ok(hold), ok(hold), ok(hold)]).bar.outcome === 'FAILED', 'bar: a malformed refused crypto→stock fails');
  check(run([null, ok(hold), ok(hold), ok(hold)]).bar.outcome === 'INCOMPLETE', 'bar: a missing reply is INCOMPLETE');
  check(run([{ result: { type: 'errored' } }, ok(hold), ok(hold), ok(hold)]).bar.outcome === 'INCOMPLETE', 'bar: an errored reply is INCOMPLETE');
  check(judgeRun(tasks, rows([ok(hold), ok(hold), ok(hold), ok(hold)]), live, { expectedRefused: 3 }).bar.outcome === 'INCOMPLETE', 'bar: a refused subset short of the expected count is INCOMPLETE');
  // "short" as a position.
  for (const t of ["I'd go short BTC here", 'shorting ETH would fit', 'flip it to a short position', 'I would short this rally', 'a very short position', 'I cannot short the crypto', 'long or short, the edge is gone', 'short SOL into strength']) check(shortPositionMatches(t).length >= 1, `short position: ${t}`);
  for (const t of ['a short-term bounce', 'in short, hold', 'it falls short of the bar', 'one short window left', 'a short squeeze risk', 'short squeezes are common', 'short term momentum', 'a very short session', 'over short periods', 'short bursts of volume', 'short timeframes', 'short–term', 'short- to medium-term', 'short and medium term', 'short interest is high', 'short-covering rally', 'short sellers piled in', 'the lookback is short', 'short on catalysts', 'a short consolidation', 'a short pullback', 'a short distance from the bonus', 'shortlist', 'the window may be short', 'take a short pause here', 'net-net, the setup is fine', 'trend (short/intermediate/long) is up', 'short=down/intermediate=down', 'it closed $7.82 short.', 'time is running short', 'a short battle']) check(shortPositionMatches(t).length === 0, `short not position: ${t}`);
  check(anyShortToken('a short-term bounce') && !anyShortToken('shortlist'), 'any-short token');
  check(otherNarrativeText({ status_feed_update: 'going short', anticipationCandidates: [{ threshold: 't' }] }).includes('going short'), 'other narrative fields');
  // Bench daily %.
  const benchLive = 'x\n\nBENCH (available for swap):\nSymbol,Sector,$Current,Daily%,ATR%,Status\nAMD,Tech,$1,+1.20%,3.1%,available\nETH,Crypto,$2,-0.40%,5.0%,available\n\nNEXT';
  check(benchDailyPct(benchLive, 'ETH') === -0.4 && benchDailyPct(benchLive, 'AMD') === 1.2 && benchDailyPct(benchLive, 'SOL') === null, 'bench daily %');
  // The splice and its verification.
  const block = renderCryptoSlotBlockForced();
  const sys = 'Tier multipliers: Star = 2.0x, Core = 1.5x, Support = 1.0x\nWhen you swap out an asset, its current points are LOCKED permanently. The incoming asset starts scoring fresh from its price at swap time.\n\n━━━ DECISION FRAMEWORK ━━━\n\nrest';
  const ed = spliceCryptoSlotBlock(sys);
  check(verifySplice(sys, ed, block), 'splice adds exactly the block');
  check(!verifySplice(sys, ed.replace('rest', 'resT'), block), 'verification rejects any other change');
  check(!verifySplice(sys, `${ed}${block}`, block), 'verification rejects a doubled block');
  check(!verifySplice(sys, `${sys}${block}`, block), 'verification rejects the block at the wrong place');
  check(spliceCryptoSlotBlock(sys.replace('Tier multipliers', 'NO tier multipliers')) === null, 'splice refuses a non-tiered prompt');
  // Estimate and caps.
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
  const flags = { go: rest.includes('--go'), wait: rest.includes('--wait'), retry: rest.includes('--retry') };
  if (cmd === 'selftest') process.exit(runSelftest() ? 0 : 1);
  else if (cmd === 'plan') plan();
  else if (cmd === 'submit') await submit(flags);
  else if (cmd === 'status') await status(flags);
  else if (cmd === 'collect') await collect();
  else if (cmd === 'judge') judge();
  else stop('usage: cryptoSlotProbe.mjs selftest | plan | submit [--retry] [--go] | status [--wait] | collect | judge');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => { console.error(redactSecrets(err?.stack || String(err))); process.exit(1); });
}
