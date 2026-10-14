#!/usr/bin/env node
// scripts/experiments/cryptoSlotProbeV2.mjs
//
// Crypto Slot v2 — probe v2, the acceptance check before the flag flips (Fable
// build prompt §7 + ruling R-f, 14 Oct 2026; build report
// docs/audits/20261014_BUILD_CRYPTO_SLOT_CHECK_LINE.md §7).
//
// Takes the 144 tiered Trading Brain requests stored by the archetype-ablation
// run and, into each, splices what production renders with the flag on:
// paragraph v2 into the system prompt, and the CRYPTO SLOT THIS CHECK line
// (plus the RISK STATUS annotation where it applies) into the live context —
// every splice from api/_utils/evalCryptoSlotBlock.js's own helpers, which its
// test suite locks to the fenced assembler's flag-on output. Each request's
// verdict is RECONSTRUCTED from the request alone (report §1 Q-d): the
// production hurdle function (clearsHurdleFloor) on the rendered numbers, at
// all three tempos, with ±0.005 rounding slack; anything that does not decide
// the same way at every corner is INDETERMINATE, excluded and counted.
//
// TWO ARMS, one Message Batch:
//   main — the determinate requests, as production would render them.
//   S    — COUNTERFACTUAL (ruling R-f, labelled as such everywhere): the 26
//          previously refused requests (all hold BTC) with the bench crypto's
//          Daily% cell set to the smallest value on the table's 2-decimal grid
//          that clears the margin at the archetype's multiplier at all three
//          tempos, plus 0.50 points; the "can swap" line; no annotation.
//
// OFFLINE AND READ-ONLY BY CONSTRUCTION — the cryptoSlotProbe.mjs (v1)
// discipline: the run folder is read, never written; replies go to
// %USERPROFILE%/ft-experiment-exhibits/crypto-slot-probe-v2/ (outside the
// repo — they carry player text); model calls are plain fetch to
// api.anthropic.com Message Batches; no Firestore, no product handler.
// CLAUDE_API_KEY from the environment, then .env.local — never printed.
//
// USAGE (repo root):
//   node scripts/experiments/cryptoSlotProbeV2.mjs selftest           # synthetic checks, no files, no network
//   node scripts/experiments/cryptoSlotProbeV2.mjs plan               # reconstruct + splice + verify + estimate (no spend)
//   node scripts/experiments/cryptoSlotProbeV2.mjs submit --go        # one Message Batch, cap-checked in code
//   node scripts/experiments/cryptoSlotProbeV2.mjs status [--wait]
//   node scripts/experiments/cryptoSlotProbeV2.mjs collect            # save results, then delete the batch on Anthropic's side
//   node scripts/experiments/cryptoSlotProbeV2.mjs judge              # the counts and both arms' bars

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, createWriteStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

import { PRICES, sha256Utf8, parseEnvText, primaryCheckoutRoot, redactSecrets, isSpendLimitError } from './growth-replay/growthReplay.js';
import { normSymbol, pairKind, judgeInput, toolInputOf, shortPositionMatches, anyShortToken, otherNarrativeText, verifySplice, CAPS } from './cryptoSlotProbe.mjs';
import {
  spliceCryptoSlotBlock, renderCryptoSlotBlockForced, spliceCryptoSlotLiveContext, renderCryptoSlotCheckLineForced,
  CRYPTO_SLOT_LINE_LEAD, CRYPTO_SLOT_ANNOTATION,
} from '../../api/_utils/evalCryptoSlotBlock.js';
import { clearsHurdleFloor } from '../../api/_utils/agentRiskManager.js';
import { getArchetypeConfig, resolveHftConfig } from '../../api/_utils/agentArchetypeConfig.js';
import { clampHftConfig } from '../../api/_utils/tempoDialClamp.js';
import { VALID_TEMPO_VALUES } from '../../api/_utils/tempoDialBands.js';
import { VALID_CRYPTO_SYMBOLS } from '../../api/_utils/agentCryptoAssets.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..', '..');

// ---------------------------------------------------------------- frozen constants

const SOURCE_DIR = path.join(os.homedir(), 'ft-experiment-exhibits', 'archetype-ablation-run');
const RUN_DIR = path.join(os.homedir(), 'ft-experiment-exhibits', 'crypto-slot-probe-v2');
const SOURCES_SHA256 = '6fb95a74bcbdd8ae59580b48ec8896722938d07ddc1be4a58c1b463202144437';
/** The bars (build prompt §7.4 + ruling R-f), applied as written. */
export const BARS = Object.freeze({
  main: { cryptoToStockMax: 2, cryptoToStockRefusedMax: 0, cryptoToCryptoOnCannotMax: 2 },
  s: { cryptoToStockMax: 1 },
});
/** The Phase 0 / Q-d counts the plan must reproduce before anything is sent. */
export const EXPECTED = Object.freeze({ tiered: 144, refused: 26, indeterminate: 16 });
const TIERED_MARK = 'BaggerBomb game';
const PAIR_CAUSE = 'pair_validation:asset_class_mix';
const EXPECTED_KEYS = ['model', 'max_tokens', 'temperature', 'system', 'messages', 'tools', 'tool_choice'];
const GAME_MODE = 'baggerbomb_agent';
const S_PLUS = 0.5;

const ANTHROPIC = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
const POLL_EVERY_MS = 60 * 1000;
const POLL_FOR_MS = 2 * 60 * 60 * 1000;

const CRYPTO = new Set(VALID_CRYPTO_SYMBOLS);
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

// ---------------------------------------------------------------- reading a stored live context (pure)

/** The rows of a CSV block that starts with `head` (to the first blank line). */
function csvBlock(live, head) {
  const at = live.indexOf(head);
  if (at === -1) return null;
  const end = live.indexOf('\n\n', at);
  const lines = live.slice(at, end === -1 ? undefined : end).split('\n');
  return { header: lines[1].split(','), rows: lines.slice(2).map((l) => l.split(',')) };
}

/** Everything the reconstruction reads off one stored live context. */
export function readLiveContext(live) {
  const pos = csvBlock(live, 'ACTIVE POSITIONS:\n');
  const bench = csvBlock(live, 'BENCH (available for swap):\n');
  if (!pos || !bench) return { error: 'no ACTIVE POSITIONS or BENCH table' };
  const iSym = pos.header.indexOf('Symbol');
  const iAtr = pos.header.indexOf('ATR%');
  const held = pos.rows.filter((r) => CRYPTO.has(r[iSym]));
  const benchC = bench.rows.filter((r) => CRYPTO.has(r[0]));
  if (held.length !== 1 || benchC.length !== 1) return { error: `held crypto ${held.length}, bench crypto ${benchC.length}` };
  const riskAt = live.indexOf('\n\nRISK STATUS:\n');
  const riskLines = riskAt === -1 ? [] : live.slice(riskAt + 2, live.indexOf('\n\n', riskAt + 2) === -1 ? undefined : live.indexOf('\n\n', riskAt + 2)).split('\n').slice(1);
  const heldSym = held[0][iSym];
  const heldRisk = riskLines.find((l) => l.startsWith(`${heldSym}: `))?.slice(heldSym.length + 2) ?? 'HOLD';
  const macro = /BTC: ([+-]?\d+\.\d{2})%/.exec((live.match(/MACRO BENCHMARKS TODAY:\n[^\n]*/) || [''])[0]);
  const day = /^Day (\d+) of /m.exec(live);
  const closed = csvBlock(live, 'CLOSED TRADES THIS BATTLE:\n');
  const todayTrades = closed && day ? closed.rows.filter((r) => r[2] === `Day${day[1]}`).length : 0;
  return {
    held: heldSym,
    heldAtr: Number.parseFloat(held[0][iAtr]),
    heldDaily: heldSym === 'BTC' && macro ? Number.parseFloat(macro[1]) : null,
    heldRisk,
    bench: benchC[0][0],
    benchCell: benchC[0][3],
    benchStatus: benchC[0][5],
    todayTrades,
  };
}

// ---------------------------------------------------------------- the reconstruction (pure)

/** The archetype's hftConfig at each tempo — resolved and clamped as the cron does (agent-evaluate.js). */
export function tempoConfigs(archetype) {
  const base = getArchetypeConfig(archetype);
  const hftConfig = resolveHftConfig(base, GAME_MODE);
  return VALID_TEMPO_VALUES.map((desiredTempo) => ({ tempo: desiredTempo, archetypeConfig: { ...base, hftConfig: clampHftConfig({ hftConfig, desiredTempo, dialEnabled: true }).hftConfig } }));
}

const pctOf = (cell) => Number.parseFloat(String(cell).replace('%', ''));

/**
 * The production hurdle at one tempo over the whole rounding box of two
 * 2-decimal cells: 'clears' / 'not_up' / 'margin' when every corner agrees,
 * else 'indeterminate'.
 */
export function hurdleOverBox(cfg, held, heldDaily, bench, benchDaily, atr) {
  const outcomes = new Set();
  for (const db of [-0.005, 0.005]) {
    for (const dh of [-0.005, 0.005]) {
      const r = clearsHurdleFloor({
        active: { symbol: held, dailyPct: (heldDaily + dh) / 100 },
        benchCandidate: { symbol: bench, dailyPct: (benchDaily + db) / 100 },
        reason: 'haiku_decision',
        archetypeConfig: cfg,
        userATR: atr,
      });
      outcomes.add(r.clears ? 'clears' : r.blockReason === 'bench_not_positive' ? 'not_up' : 'margin');
    }
  }
  return outcomes.size === 1 ? [...outcomes][0] : 'indeterminate';
}

/**
 * The verdict a stored request's own numbers give, in the gates' order (ruling
 * R-b): LOCK → cooldown → not up → margin → swap cap. Determinate only when
 * the first failing check (or "can") is the same at every tempo and every
 * rounding corner. The not-up step never needs the held crypto's daily move;
 * the margin does (BTC's is on the macro line; ETH's / SOL's are not).
 */
export function reconstructVerdict(live, archetype) {
  const r = readLiveContext(live);
  if (r.error) return { status: 'indeterminate', why: r.error };
  const v = (canSwap, reason) => ({ status: 'determinate', verdict: { held: r.held, bench: r.bench, canSwap, reason, benchDailyPct: pctOf(r.benchCell) }, read: r });
  if (r.heldRisk.startsWith('LOCKED')) return v(false, 'lock');
  if (r.benchStatus !== 'available') return r.benchStatus.startsWith('locked until') ? v(false, 'cooldown') : { status: 'indeterminate', why: `bench status ${r.benchStatus}`, read: r };
  const benchDaily = pctOf(r.benchCell);
  // Not up: "-0.00%" is below zero (formatPct prints + for ≥ 0); "+0.00%" may be 0 or a hair above.
  if (r.benchCell === '+0.00%') return { status: 'indeterminate', why: 'bench daily +0.00%', read: r };
  if (benchDaily <= 0 || r.benchCell.startsWith('-')) return v(false, 'not_up');
  if (r.heldDaily === null) return { status: 'indeterminate', why: `held ${r.held}: its daily move is not in the request`, read: r };
  if (!Number.isFinite(r.heldAtr) || !Number.isFinite(benchDaily) || !Number.isFinite(r.heldDaily)) return { status: 'indeterminate', why: 'a number in the request does not parse', read: r };
  const configs = tempoConfigs(archetype);
  const hurdle = new Set(configs.map(({ archetypeConfig }) => hurdleOverBox(archetypeConfig, r.held, r.heldDaily, r.bench, benchDaily, r.heldAtr)));
  if (hurdle.size !== 1 || hurdle.has('indeterminate')) return { status: 'indeterminate', why: `margin differs across tempos or rounding (${[...hurdle].join('/')})`, read: r };
  if (hurdle.has('margin')) return v(false, 'margin');
  // The cap: today's closed trades bound the window count from above (every archetype's window — 60 or 120 minutes — lies inside one trading day; an earlier day's trade is overnight-old).
  const minCap = Math.min(...configs.map(({ archetypeConfig }) => archetypeConfig.hftConfig.swapWindow.capPerWindow));
  if (r.todayTrades >= minCap) return { status: 'indeterminate', why: `today's trades ${r.todayTrades} ≥ the smallest cap ${minCap}`, read: r };
  return v(true, null);
}

/** The table's 2-decimal formatter (agentEvalPromptAssembly.js formatPct) for a value already on the grid. */
const gridCell = (cents) => `${cents >= 0 ? '+' : '-'}${(Math.abs(cents) / 100).toFixed(2)}`;

/**
 * Arm S's bench Daily% (ruling R-f): the smallest value on the 2-decimal grid
 * that clears the production hurdle at all three tempos (from the held daily
 * as rendered, every rounding corner), plus 0.50 points. Returns cents.
 */
export function armSCents(archetype, heldDaily, held, bench, atr) {
  const configs = tempoConfigs(archetype);
  for (let cents = 1; cents <= 100000; cents += 1) {
    if (configs.every(({ archetypeConfig }) => hurdleOverBox(archetypeConfig, held, heldDaily, bench, cents / 100, atr) === 'clears')) {
      return cents + Math.round(S_PLUS * 100);
    }
  }
  return null;
}

/** Replace exactly the bench crypto's Daily% cell; null unless exactly one row changes. */
export function setBenchDaily(live, bench, cell) {
  const head = 'BENCH (available for swap):\nSymbol,Sector,$Current,Daily%,ATR%,Status\n';
  const at = live.indexOf(head);
  if (at === -1 || live.indexOf(head, at + 1) !== -1) return null;
  const start = at + head.length;
  const endRel = live.indexOf('\n\n', start);
  const end = endRel === -1 ? live.length : endRel;
  const rows = live.slice(start, end).split('\n');
  const hits = rows.map((r, i) => [r.split(','), i]).filter(([c]) => c[0] === bench);
  if (hits.length !== 1) return null;
  const [cells, i] = hits[0];
  cells[3] = `${cell}%`;
  rows[i] = cells.join(',');
  return `${live.slice(0, start)}${rows.join('\n')}${live.slice(end)}`;
}

/** "Verify by marker and diff": the edited context is the original plus exactly the line (and the annotation where it applies). */
export function verifyLiveSplice(original, edited, line, annotated) {
  if (typeof edited !== 'string' || edited.split(CRYPTO_SLOT_LINE_LEAD).length !== 2 || !edited.includes(line)) return false;
  let back = edited.replace(`${line}\n\n`, '');
  if (back === edited) back = edited.replace(`\n\n${line}`, '');
  if (annotated) {
    if (back.split(CRYPTO_SLOT_ANNOTATION).length !== 2) return false;
    back = back.replace(CRYPTO_SLOT_ANNOTATION, '');
  } else if (back.includes(CRYPTO_SLOT_ANNOTATION)) return false;
  return back === original;
}

/** The only differences between two contexts are in exactly one line, at exactly one CSV cell. */
export function diffIsOneCell(a, b) {
  const la = a.split('\n'); const lb = b.split('\n');
  if (la.length !== lb.length) return false;
  const changed = la.map((l, i) => [l, lb[i]]).filter(([x, y]) => x !== y);
  if (changed.length !== 1) return false;
  const ca = changed[0][0].split(','); const cb = changed[0][1].split(',');
  return ca.length === cb.length && ca.filter((c, i) => c !== cb[i]).length === 1;
}

// ---------------------------------------------------------------- judging (pure)

function emptyCounts() {
  return { n: 0, HOLD: 0, SWAP: 0, malformed: 0, notReturned: 0, crypto_to_stock: 0, crypto_to_crypto: 0, stock_to_crypto: 0, stock_to_stock: 0, malformedCarriedCryptoToStock: 0, malformedCarriedCryptoToCrypto: 0, citesLine: 0, citesSwapOut: 0, shortPosition: 0 };
}
/** Does a reply's narrative cite the line? Its own words: "CRYPTO SLOT", or "cannot swap" / "can swap". */
export const citesLine = (text) => typeof text === 'string' && /CRYPTO SLOT|\bcan(?:not|'t)? swap\b/i.test(text);
export const citesSwapOut = (text) => typeof text === 'string' && /SWAP_OUT/.test(text);

function tally(c, j, text) {
  c.n += 1;
  if (j.kind === 'notReturned') { c.notReturned += 1; return; }
  c[j.kind] += 1;
  if (j.kind === 'SWAP') c[j.pair] += 1;
  if (j.kind === 'malformed' && j.carriedPair === 'crypto_to_stock') c.malformedCarriedCryptoToStock += 1;
  if (j.kind === 'malformed' && j.carriedPair === 'crypto_to_crypto') c.malformedCarriedCryptoToCrypto += 1;
  if (citesLine(text)) c.citesLine += 1;
  if (citesSwapOut(text)) c.citesSwapOut += 1;
  if (shortPositionMatches(text).length) c.shortPosition += 1;
}

/** Both arms' bars. A crypto → stock or crypto → crypto proposal counts whether the reply was valid or malformed. */
export function applyBars(main, s, { expectedRefused = EXPECTED.refused, expectedS = EXPECTED.refused } = {}) {
  const c2s = main.all.crypto_to_stock + main.all.malformedCarriedCryptoToStock;
  const c2sRef = main.refused.crypto_to_stock + main.refused.malformedCarriedCryptoToStock;
  const c2cCannot = main.cannot.crypto_to_crypto + main.cannot.malformedCarriedCryptoToCrypto;
  const metMain = c2s <= BARS.main.cryptoToStockMax && c2sRef <= BARS.main.cryptoToStockRefusedMax && c2cCannot <= BARS.main.cryptoToCryptoOnCannotMax;
  const completeMain = main.all.notReturned === 0 && main.refused.n === expectedRefused;
  const sC2s = s.all.crypto_to_stock + s.all.malformedCarriedCryptoToStock;
  const metS = sC2s <= BARS.s.cryptoToStockMax;
  const completeS = s.all.notReturned === 0 && s.all.n === expectedS;
  return {
    main: { cryptoToStockAll: c2s, cryptoToStockRefused: c2sRef, cryptoToCryptoOnCannot: c2cCannot, outcome: !metMain ? 'FAILED' : completeMain ? 'PASSED' : 'INCOMPLETE',
      rule: `crypto → stock ≤ ${BARS.main.cryptoToStockMax} of ${main.all.n}, ≤ ${BARS.main.cryptoToStockRefusedMax} of the ${expectedRefused} refused; crypto → crypto ≤ ${BARS.main.cryptoToCryptoOnCannotMax} where the line says "cannot"; every request answered` },
    s: { cryptoToStock: sC2s, outcome: !metS ? 'FAILED' : completeS ? 'PASSED' : 'INCOMPLETE', rule: `COUNTERFACTUAL arm S: crypto → stock ≤ ${BARS.s.cryptoToStockMax} of ${expectedS}; every request answered` },
  };
}

/** Judge a run: `rowsById` maps custom_id → the batch result row. */
export function judgeRun(tasks, rowsById, opts = {}) {
  const main = { all: emptyCounts(), refused: emptyCounts(), cannot: emptyCounts(), other: emptyCounts() };
  const s = { all: emptyCounts() };
  const captured = { all: emptyCounts(), refused: emptyCounts() };
  const byArchetype = {};
  const failing = [];
  const usage = { main: { inTok: 0, outTok: 0, deltas: [] }, s: { inTok: 0, outTok: 0, deltas: [] } };
  for (const t of tasks) {
    const row = rowsById.get(t.customId);
    const msg = row?.result?.type === 'succeeded' ? row.result.message : null;
    const input = msg ? toolInputOf(msg) : null;
    const j = !msg ? { kind: 'notReturned' } : judgeInput(input);
    const text = input ? [input.rationale, otherNarrativeText(input)].filter((x) => typeof x === 'string').join('\n') : '';
    const u = usage[t.arm];
    if (msg) {
      u.inTok += msg.usage?.input_tokens ?? 0;
      u.outTok += msg.usage?.output_tokens ?? 0;
      if (Number.isFinite(msg.usage?.input_tokens) && Number.isFinite(t.inputTokens)) u.deltas.push(msg.usage.input_tokens - t.inputTokens);
    }
    if (t.arm === 'main') {
      tally(main.all, j, text);
      if (t.refused) tally(main.refused, j, text); else tally(main.other, j, text);
      if (!t.verdict.canSwap) tally(main.cannot, j, text);
      const capJ = capturedJudgement(t);
      tally(captured.all, capJ, ''); if (t.refused) tally(captured.refused, capJ, '');
      const a = byArchetype[t.archetype] || (byArchetype[t.archetype] = emptyCounts());
      tally(a, j, text);
      const pair = j.kind === 'SWAP' ? j.pair : j.kind === 'malformed' ? j.carriedPair : null;
      if (pair === 'crypto_to_stock' || pair === 'crypto_to_crypto') failing.push({ i: t.i, refused: t.refused, pair, reason: t.verdict.reason, citesLine: citesLine(text), citesSwapOut: citesSwapOut(text), heldRiskSwapOut: /^SWAP_OUT/.test(t.heldRisk || '') });
    } else {
      tally(s.all, j, text);
    }
  }
  const stats = (d) => { const x = [...d].sort((p, q) => p - q); return x.length ? { median: x[Math.floor(x.length / 2)], min: x[0], max: x.at(-1) } : null; };
  const price = tasks.length ? PRICES[priceKeyOf(tasks[0].model)] : null;
  const cost = (u) => (price ? (u.inTok * price.batchIn + u.outTok * price.batchOut) / 1e6 : 0);
  return {
    n: { main: tasks.filter((t) => t.arm === 'main').length, s: tasks.filter((t) => t.arm === 's').length },
    main, s, captured, byArchetype, failing,
    usage: {
      main: { inputTokens: usage.main.inTok, outputTokens: usage.main.outTok, costUsd: cost(usage.main), addedTokens: stats(usage.main.deltas) },
      s: { inputTokens: usage.s.inTok, outputTokens: usage.s.outTok, costUsd: cost(usage.s), addedTokens: stats(usage.s.deltas) },
      totalCostUsd: cost(usage.main) + cost(usage.s),
    },
    bars: applyBars(main, s, opts),
  };
}

function capturedJudgement(t) {
  if (t.captured?.valid === false || String(t.gateCause ?? '').startsWith('model_failed')) return { kind: 'malformed', carriedPair: null };
  if (t.captured?.action === 'SWAP') return { kind: 'SWAP', pair: pairKind(t.captured.out, t.captured.in) };
  if (t.captured?.action === 'HOLD') return { kind: 'HOLD' };
  return { kind: 'malformed', carriedPair: null };
}

const priceKeyOf = (modelId) => {
  const m = /^claude-(haiku|sonnet|opus)-(\d+)-(\d+)/.exec(String(modelId));
  return m ? `claude-${m[1]}-${m[2]}-${m[3]}` : null;
};

/** Planned and worst-case USD at batch prices; added text at chars/3 (deliberately high). */
export function estimate(tasks) {
  let planned = 0; let worst = 0;
  for (const t of tasks) {
    const price = PRICES[priceKeyOf(t.model)];
    if (!price) throw new Error(`no price for ${t.model}`);
    const inTok = t.inputTokens + Math.ceil(t.addedChars / 3);
    planned += (inTok * price.batchIn + t.outputTokens * price.batchOut) / 1e6;
    worst += (inTok * price.batchIn + t.maxTokens * price.batchOut) / 1e6;
  }
  return { calls: tasks.length, plannedUsd: planned, worstUsd: worst };
}
export const withinCaps = (est) => est.calls <= CAPS.calls && est.worstUsd <= CAPS.usd;

// ---------------------------------------------------------------- env + API (the v1 plumbing)

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
  if (!existsSync(file) || !existsSync(path.join(SOURCE_DIR, 'records.json'))) stop(`the run folder ${SOURCE_DIR} is absent — the probe is skipped and the PR stays draft.`, 4);
  const raw = readFileSync(file, 'utf8');
  const sha = sha256Utf8(raw);
  if (sha !== SOURCES_SHA256) stop(`sources.jsonl SHA-256 is ${sha}, not the Phase 0's ${SOURCES_SHA256}`);
  return { sources: raw.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)), records: readJson(path.join(SOURCE_DIR, 'records.json')), sha };
}

const liveOf = (req) => (typeof req.messages?.[2]?.content === 'string' ? req.messages[2].content : null);

function plan() {
  if (existsSync(P('manifest.json')) && (readJson(P('manifest.json')).batches || []).length) stop(`${RUN_DIR} already has a batch — use a new run folder.`);
  const { sources, records, sha } = loadSource();
  const byK = new Map(records.map((r) => [r.k, r]));
  const block = renderCryptoSlotBlockForced();
  const tasks = [];
  const lines = [];
  const indeterminate = [];
  const excluded = [];
  let tiered = 0;
  let refusedSeen = 0;
  const reasonCounts = {};
  for (const s of sources) {
    if (typeof s.request !== 'string') continue;
    const req = JSON.parse(s.request);
    if (typeof req.system !== 'string' || !req.system.includes(TIERED_MARK)) continue;
    tiered += 1;
    const rec = byK.get(s.k);
    const refused = rec?.gate?.cause === PAIR_CAUSE;
    if (refused) refusedSeen += 1;
    if (!rec) { excluded.push({ k: s.k, refused, why: 'no records.json row' }); continue; }
    if (Object.keys(req).join(',') !== EXPECTED_KEYS.join(',')) { excluded.push({ k: s.k, refused, why: 'request keys' }); continue; }
    const live = liveOf(req);
    const system = spliceCryptoSlotBlock(req.system);
    if (live === null || system === null || !verifySplice(req.system, system, block)) { excluded.push({ k: s.k, refused, why: 'system splice' }); continue; }
    const rv = reconstructVerdict(live, rec.archetype);
    const base = { k: s.k, archetype: rec.archetype, refused, captured: rec.origTuple ?? null, gateCause: rec.gate?.cause ?? null, model: req.model, temperature: req.temperature, maxTokens: req.max_tokens,
      inputTokens: Number.isFinite(rec.envelope?.inputTokens) ? rec.envelope.inputTokens : Math.ceil(s.request.length / 3),
      outputTokens: Number.isFinite(rec.envelope?.outputTokens) ? rec.envelope.outputTokens : req.max_tokens };
    if (rv.status !== 'determinate') { indeterminate.push({ k: s.k, refused, archetype: rec.archetype, why: rv.why }); continue; }
    // ---- main arm: the line (and the annotation) as production renders them
    const fmt = () => rv.read.benchCell.replace(/%$/, '');
    const line = renderCryptoSlotCheckLineForced(rv.verdict, fmt);
    const editedLive = spliceCryptoSlotLiveContext(live, rv.verdict, fmt);
    const annotated = !rv.verdict.canSwap && /^SWAP_OUT \(/.test(rv.read.heldRisk);
    if (!verifyLiveSplice(live, editedLive, line, annotated)) { excluded.push({ k: s.k, refused, why: 'live splice verification' }); continue; }
    reasonCounts[rv.verdict.canSwap ? 'can' : rv.verdict.reason] = (reasonCounts[rv.verdict.canSwap ? 'can' : rv.verdict.reason] || 0) + 1;
    const mainTask = { ...base, arm: 'main', i: tasks.length, customId: `m_${String(tasks.length).padStart(3, '0')}`, verdict: rv.verdict, heldRisk: rv.read.heldRisk, annotated, addedChars: system.length - req.system.length + editedLive.length - live.length };
    tasks.push(mainTask);
    lines.push(JSON.stringify({ custom_id: mainTask.customId, params: { ...req, system, messages: [req.messages[0], req.messages[1], { ...req.messages[2], content: editedLive }] } }));
  }
  // ---- arm S: COUNTERFACTUAL — the 26 refused, made "can swap"
  const sTasks = [];
  for (const t of tasks.filter((x) => x.arm === 'main' && x.refused)) {
    const src = sources.find((x) => x.k === t.k);
    const req = JSON.parse(src.request);
    const live = liveOf(req);
    const r = readLiveContext(live);
    const ok = r.held === 'BTC' && r.heldDaily !== null && !r.heldRisk.startsWith('LOCKED') && r.benchStatus === 'available';
    const minCap = Math.min(...tempoConfigs(t.archetype).map(({ archetypeConfig }) => archetypeConfig.hftConfig.swapWindow.capPerWindow));
    if (!ok || r.todayTrades >= minCap) { excluded.push({ k: t.k, refused: true, arm: 's', why: 'not reconstructible as "can" (lock / cooldown / cap / held daily)' }); continue; }
    const cents = armSCents(t.archetype, r.heldDaily, r.held, r.bench, r.heldAtr);
    const cell = gridCell(cents);
    const editedTable = setBenchDaily(live, r.bench, cell);
    const verdict = { held: r.held, bench: r.bench, canSwap: true, reason: null, benchDailyPct: cents / 100 };
    // Double-check the counterfactual with the reconstruction itself: the edited table must read "can".
    const check = reconstructVerdict(editedTable, t.archetype);
    if (!editedTable || !diffIsOneCell(live, editedTable) || check.status !== 'determinate' || !check.verdict.canSwap) { excluded.push({ k: t.k, refused: true, arm: 's', why: 'counterfactual edit not verified' }); continue; }
    const fmt = () => cell;
    const line = renderCryptoSlotCheckLineForced(verdict, fmt);
    const editedLive = spliceCryptoSlotLiveContext(editedTable, verdict, fmt);
    if (!verifyLiveSplice(editedTable, editedLive, line, false)) { excluded.push({ k: t.k, refused: true, arm: 's', why: 'live splice verification' }); continue; }
    const system = spliceCryptoSlotBlock(req.system);
    const sTask = { ...t, arm: 's', i: tasks.length + sTasks.length, customId: `s_${String(sTasks.length).padStart(3, '0')}`, verdict, counterfactual: { originalCell: r.benchCell, editedCell: `${cell}%`, heldDaily: r.heldDaily, atr: r.heldAtr }, annotated: false, addedChars: system.length - req.system.length + editedLive.length - live.length };
    sTasks.push(sTask);
    lines.push(JSON.stringify({ custom_id: sTask.customId, params: { ...req, system, messages: [req.messages[0], req.messages[1], { ...req.messages[2], content: editedLive }] } }));
  }
  const all = [...tasks, ...sTasks];
  const mainRefused = tasks.filter((t) => t.refused).length;
  console.log(`[probe-v2] sources.jsonl SHA-256 ${sha} (matches the Phase 0)`);
  console.log(`[probe-v2] tiered: ${tiered} (expected ${EXPECTED.tiered}); refused: ${refusedSeen} (expected ${EXPECTED.refused})`);
  console.log(`[probe-v2] main arm: ${tasks.length} determinate, spliced and verified; indeterminate (excluded and counted): ${indeterminate.length}; excluded otherwise: ${excluded.filter((e) => e.arm !== 's').length}`);
  console.log(`[probe-v2] main arm verdicts: ${JSON.stringify(reasonCounts)}; annotated: ${tasks.filter((t) => t.annotated).length}`);
  console.log(`[probe-v2] arm S (COUNTERFACTUAL): ${sTasks.length} of the ${mainRefused} refused`);
  if (tiered !== EXPECTED.tiered || refusedSeen !== EXPECTED.refused) stop('the source does not reproduce the Phase 0 counts; nothing was written.');
  if (indeterminate.some((x) => x.refused)) stop(`${indeterminate.filter((x) => x.refused).length} previously refused request(s) are indeterminate — STOP before any spend (build prompt §7.1).`);
  if (mainRefused !== EXPECTED.refused || sTasks.length !== EXPECTED.refused) stop(`the refused subset is not complete in both arms (main ${mainRefused}, S ${sTasks.length}); nothing was written.`);
  if (indeterminate.length !== EXPECTED.indeterminate) stop(`${indeterminate.length} indeterminate, not the ${EXPECTED.indeterminate} report §1 Q-d counted — the reconstruction moved; nothing was written.`);
  const models = [...new Set(all.map((t) => `${t.model} @ temperature ${t.temperature}`))];
  console.log(`[probe-v2] stored model/temperature (read, not chosen): ${models.join('; ')}`);
  const est = estimate(all);
  console.log(`[probe-v2] ESTIMATE: ${est.calls} calls, planned $${est.plannedUsd.toFixed(2)}, worst case $${est.worstUsd.toFixed(2)} — cap ${CAPS.calls} calls / $${CAPS.usd}`);
  if (!withinCaps(est)) stop('the estimate is over the cap; nothing was written or sent.', 5);
  mkdirSync(RUN_DIR, { recursive: true });
  writeFileSync(P('requests.jsonl'), `${lines.join('\n')}\n`);
  const manifest = existsSync(P('manifest.json')) ? readJson(P('manifest.json')) : {};
  stamp(manifest, 'plan');
  manifest.plan = { at: new Date().toISOString(), sourcesSha256: sha, blockSha256: sha256Utf8(block), requestsSha256: sha256Utf8(readFileSync(P('requests.jsonl'), 'utf8')), tasks: all, indeterminate, excluded, estimate: est, reasonCounts };
  writeJsonAtomic(P('manifest.json'), manifest);
  console.log(`[probe-v2] plan written to ${RUN_DIR}. Next: submit --go`);
}

// ---------------------------------------------------------------- submit / status / collect / judge

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
  if (manifest.pendingCreate) stop('a create was interrupted — reconcile manifest.json by hand. Nothing was sent.');
  if ((manifest.batches || []).length) stop('a batch was already created. Nothing was sent.');
  const body = readFileSync(P('requests.jsonl'), 'utf8');
  if (sha256Utf8(body) !== manifest.plan.requestsSha256) stop('requests.jsonl no longer matches the plan — re-run plan.');
  const all = body.split('\n').filter((l) => l.trim());
  if (all.length !== manifest.plan.tasks.length) stop('requests.jsonl line count does not match the plan.');
  const est = estimate(manifest.plan.tasks);
  console.log(`[probe-v2] ${est.calls} calls, planned $${est.plannedUsd.toFixed(2)}, worst $${est.worstUsd.toFixed(2)} — cap ${CAPS.calls} / $${CAPS.usd}`);
  if (!withinCaps(est)) stop('over the cap; nothing was sent.', 5);
  if (!flags.go) { console.log('[probe-v2] dry run — re-run with --go to create the batch.'); return; }
  const apiKey = anthropicKey();
  stamp(manifest, 'submit');
  manifest.pendingCreate = { at: new Date().toISOString(), count: all.length };
  writeJsonAtomic(P('manifest.json'), manifest);
  const r = await api(apiKey, 'POST', '/v1/messages/batches', `{"requests":[${all.join(',')}]}`);
  if (r.status !== 200 || typeof r.json?.id !== 'string') stop(`batch create returned HTTP ${r.status}: ${String(r.json?.error?.message ?? '').slice(0, 300)} (pendingCreate kept)`);
  manifest.batches = [{ batchId: r.json.id, createdAt: new Date().toISOString(), count: all.length, ids: manifest.plan.tasks.map((t) => t.customId), worstUsd: est.worstUsd }];
  delete manifest.pendingCreate;
  writeJsonAtomic(P('manifest.json'), manifest);
  console.log(`[probe-v2] created ${r.json.id} (${all.length} requests). Next: status --wait, then collect`);
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
    console.log(`[probe-v2] ${b.batchId}: ${st} ${JSON.stringify(r.json?.request_counts ?? {})}`);
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
      if (r.json?.processing_status !== 'ended') { console.log(`[probe-v2] ${b.batchId} is ${r.json?.processing_status ?? `HTTP ${r.status}`} — not collected yet`); continue; }
      const file = P(`results-${n}.jsonl`);
      const res = await fetch(anthropicUrl(r.json.results_url), { redirect: 'error', headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION } });
      if (!res.ok) stop(`results download returned HTTP ${res.status} (the batch is kept)`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(`${file}.tmp`));
      renameSync(`${file}.tmp`, file);
      const rows = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
      const own = new Set(b.ids);
      if (rows.length !== b.count || rows.some((row) => !own.has(row.custom_id))) stop(`${rows.length} result lines for ${b.count} requests, or a foreign custom_id — kept the batch`);
      const types = {};
      for (const row of rows) types[row.result?.type] = (types[row.result?.type] || 0) + 1;
      b.resultsSaved = true;
      b.resultTypes = types;
      writeJsonAtomic(P('manifest.json'), manifest);
      console.log(`[probe-v2] ${b.batchId}: ${rows.length} results saved ${JSON.stringify(types)}`);
    }
    if (b.resultsSaved && !b.deleted) {
      const del = await api(apiKey, 'DELETE', `/v1/messages/batches/${b.batchId}`);
      b.deleted = del.status === 200;
      writeJsonAtomic(P('manifest.json'), manifest);
      console.log(`[probe-v2] ${b.batchId}: deleted on Anthropic's side: ${b.deleted}`);
    }
  }
}

function judge() {
  const manifest = readJson(P('manifest.json'));
  if (!(manifest.batches || []).some((b) => b.resultsSaved)) stop('no collected results — run collect first.');
  const out = { at: new Date().toISOString(), headSha: headSha(), indeterminate: manifest.plan.indeterminate.length, excluded: manifest.plan.excluded.length, ...judgeRun(manifest.plan.tasks, loadResultRows(manifest)) };
  writeJsonAtomic(P('judge.json'), out);
  console.log(JSON.stringify({ ...out, failing: undefined, byArchetype: undefined }, null, 2));
  console.log(`[probe-v2] MAIN BAR (${out.bars.main.rule}): ${out.bars.main.outcome}`);
  console.log(`[probe-v2] ARM S GUARD BAR (${out.bars.s.rule}): ${out.bars.s.outcome}`);
}

// ---------------------------------------------------------------- selftest

export function runSelftest() {
  const fails = [];
  const check = (cond, label) => { if (!cond) fails.push(label); };
  const live = (o = {}) => [
    '━━━ LIVE BATTLE STATE ━━━\nDay 1 of 1 | 2h remaining | Phase: MID',
    `MACRO BENCHMARKS TODAY:\nSPY (S&P 500): +0.61% | QQQ (Nasdaq): +0.63% | BTC: ${o.btc ?? '-1.41'}%`,
    `ACTIVE POSITIONS:\nTier,Symbol,Sector,Entry,$Entry,$Current,Gain%,ATR Mult,Badges,ATR%\nstar,NVDA,Technology,Day1,$1.00,$1.00,+0.00%,+0.00x,[],3.0%\nsupport,${o.held ?? 'BTC'},Crypto,Day1,$1.00,$1.00,+0.00%,+0.00x,[],5.0%`,
    `BENCH (available for swap):\nSymbol,Sector,$Current,Daily%,ATR%,Status\nAMD,Technology,$1.00,+1.00%,7.0%,available\n${o.bench ?? 'ETH'},Crypto,$2.00,${o.cell ?? '-1.12%'},5.0%,${o.status ?? 'available'}`,
    ...(o.closed ? [`CLOSED TRADES THIS BATTLE:\nSymbol,Tier,Exit Day,Entry→Exit (Now $Ghost),Gain%,Locked Pts\n${o.closed}`] : []),
    'TRIGGER (why you were woken up):\n- price_move: x',
    ...(o.risk ? [`RISK STATUS:\nNVDA: HOLD\n${o.risk}`] : []),
    'YOUR LAST 3 DECISIONS:\n- HOLD',
  ].join('\n\n');
  const rv = (o, arch = 'momentum_chaser') => reconstructVerdict(live(o), arch);
  const reason = (r) => (r.status !== 'determinate' ? `indet:${r.why}` : r.verdict.canSwap ? 'can' : r.verdict.reason);
  // Reconstruction, in the gates' order.
  check(reason(rv({})) === 'not_up', 'not up');
  check(reason(rv({ cell: '-0.00%' })) === 'not_up', '-0.00 is not up');
  check(reason(rv({ cell: '+0.00%' })).startsWith('indet'), '+0.00 is indeterminate');
  check(reason(rv({ risk: 'BTC: LOCKED (x)' })) === 'lock', 'lock first');
  check(reason(rv({ status: 'locked until 2026-10-15T00:00:00Z' })) === 'cooldown', 'cooldown');
  check(reason(rv({ risk: 'BTC: LOCKED (x)', status: 'locked until z' })) === 'lock', 'lock before cooldown');
  // Trend Follower 0.35 (measured: 0.5) × ATR 5 = 2.5 points over BTC at every tempo.
  check(reason(rv({ btc: '+0.50', cell: '+1.50%' })) === 'margin', 'margin (below even the aggressive 0.27 × 5)');
  check(reason(rv({ btc: '+0.50', cell: '+2.00%' })).startsWith('indet'), 'clears aggressive only → indeterminate');
  check(reason(rv({ btc: '+0.50', cell: '+3.02%' })) === 'can', 'can (clears at every tempo and corner)');
  check(reason(rv({ btc: '+0.50', cell: '+2.50%' })).startsWith('indet'), 'between the tempos → indeterminate');
  check(reason(rv({ held: 'ETH', bench: 'BTC', cell: '+3.00%' })).startsWith('indet'), 'held ETH, bench up → indeterminate (no daily move)');
  check(reason(rv({ held: 'ETH', bench: 'BTC', cell: '-3.00%' })) === 'not_up', 'held ETH, bench down → not up, no daily move needed');
  check(reason(rv({ btc: '+0.50', cell: '+3.02%', closed: 'KO,support,Day1,$1→$1,+0.00%,+0.0\nPG,support,Day1,$1→$1,+0.00%,+0.0\nMSFT,core,Day1,$1→$1,+0.00%,+0.0\nAMZN,core,Day1,$1→$1,+0.00%,+0.0' })).startsWith('indet'), 'cap may be reached → indeterminate');
  check(reason(rv({ cell: '-1.00%', closed: 'KO,support,Day1,$1→$1,+0.00%,+0.0\nPG,support,Day1,$1→$1,+0.00%,+0.0\nMSFT,core,Day1,$1→$1,+0.00%,+0.0\nAMZN,core,Day1,$1→$1,+0.00%,+0.0' })) === 'not_up', 'an earlier failing step decides before the cap');
  check(reason(rv({ btc: '+0.50', cell: '+3.02%', closed: 'KO,support,Day0,$1→$1,+0.00%,+0.0\nPG,support,Day0,$1→$1,+0.00%,+0.0\nMSFT,core,Day0,$1→$1,+0.00%,+0.0\nAMZN,core,Day0,$1→$1,+0.00%,+0.0' })) === 'can', 'earlier days\' trades are outside the window');
  // Arm S value: the smallest grid value clearing at every tempo + 0.50.
  const cents = armSCents('momentum_chaser', 0.5, 'BTC', 'ETH', 5);
  check(cents === 301 + 50 || cents === 302 + 50 || cents === 300 + 50, `arm S cents ${cents}`);
  // Arm S is the SMALLEST clearing grid value + exactly 0.50: the value 0.50 below clears at every tempo, one cent less does not.
  const everyTempo = (c) => tempoConfigs('momentum_chaser').every(({ archetypeConfig }) => hurdleOverBox(archetypeConfig, 'BTC', 0.5, 'ETH', c / 100, 5) === 'clears');
  check(everyTempo(cents - 50) && !everyTempo(cents - 51), 'arm S: minimum + 0.50 exactly');
  // The rounding box: both cells carry ±0.005, so a 2.507-point lead over a 2.50 floor (measured tempo) straddles it.
  const measured = tempoConfigs('momentum_chaser').find((t) => t.tempo === 'measured').archetypeConfig;
  check(hurdleOverBox(measured, 'BTC', 0.5, 'ETH', 3.007, 5) === 'indeterminate', 'rounding box: both cells\' slack');
  check(hurdleOverBox(measured, 'BTC', 0.5, 'ETH', 3.02, 5) === 'clears' && hurdleOverBox(measured, 'BTC', 0.5, 'ETH', 2.98, 5) === 'margin' && hurdleOverBox(measured, 'BTC', 0.5, 'ETH', 2.99, 5) === 'indeterminate', 'rounding box: clear of the slack both ways');
  check(reason(reconstructVerdict(live({ btc: '+0.50', cell: '+3.02%' }).replace(',5.0%\n\nBENCH', ',x%\n\nBENCH'), 'momentum_chaser')).startsWith('indet'), 'an unparseable ATR cell is indeterminate, never a verdict');
  check(reason(rv({ btc: '+0.50', cell: `${gridCell(cents)}%` })) === 'can', 'arm S value reads "can"');
  check(gridCell(5) === '+0.05' && gridCell(-5) === '-0.05' && gridCell(0) === '+0.00', 'grid cell format');
  // The edit and its verification.
  const L = live({ risk: 'BTC: SWAP_OUT (stagnation)' });
  const e = setBenchDaily(L, 'ETH', '+3.52');
  check(e !== null && diffIsOneCell(L, e) && e.includes('ETH,Crypto,$2.00,+3.52%,5.0%,available'), 'one-cell edit');
  check(setBenchDaily(L, 'SOL', '+1.00') === null, 'edit refuses a missing row');
  check(!diffIsOneCell(L, e.replace('AMD,Technology', 'AMD,Tech')), 'diff rejects a second change');
  const vNo = { held: 'BTC', bench: 'ETH', canSwap: false, reason: 'not_up', benchDailyPct: -1.12 };
  const fmtNo = () => '-1.12';
  const lineNo = renderCryptoSlotCheckLineForced(vNo, fmtNo);
  const spl = spliceCryptoSlotLiveContext(L, vNo, fmtNo);
  check(verifyLiveSplice(L, spl, lineNo, true), 'live splice verified (annotated)');
  check(spl.includes(`${lineNo}\n\nRISK STATUS:\n`) && spl.includes(`BTC: SWAP_OUT (stagnation)${CRYPTO_SLOT_ANNOTATION}`), 'line before RISK STATUS, annotation on the held crypto');
  check(!verifyLiveSplice(L, spl, lineNo, false), 'verification demands the annotation be accounted for');
  check(!verifyLiveSplice(L, spl.replace(CRYPTO_SLOT_ANNOTATION, ''), lineNo, true), 'verification rejects a missing annotation where one is due');
  check(!verifyLiveSplice(L, spl.replace(CRYPTO_SLOT_ANNOTATION, CRYPTO_SLOT_ANNOTATION + CRYPTO_SLOT_ANNOTATION), lineNo, true), 'verification rejects a doubled annotation');
  check(!verifyLiveSplice(L, spl.replace('NVDA: HOLD', 'NVDA: HOLD!'), lineNo, true), 'verification rejects any other change');
  const L2 = live({});
  const spl2 = spliceCryptoSlotLiveContext(L2, vNo, fmtNo);
  check(verifyLiveSplice(L2, spl2, lineNo, false) && spl2.includes(`- price_move: x\n\n${lineNo}\n\nYOUR LAST 3 DECISIONS`), 'no RISK STATUS: line after TRIGGER');
  // Judging and the bars.
  const base = { rationale: 'r', conviction: 80, hypothesis: 'h', riskAssessment: 'low' };
  const ok = (input, tokens = 1100) => ({ result: { type: 'succeeded', message: { content: [{ type: 'tool_use', input }], usage: { input_tokens: tokens, output_tokens: 50 } } } });
  const T = (i, arm, refused, canSwap = false) => ({ i, arm, refused, customId: `${arm[0]}_${i}`, archetype: 'momentum_chaser', model: 'claude-haiku-4-5-20251001', inputTokens: 1000, verdict: { canSwap, reason: canSwap ? null : 'not_up' }, heldRisk: 'SWAP_OUT (stagnation)', captured: { valid: true, action: 'SWAP', out: 'BTC', in: 'AFRM' } });
  const hold = { ...base, decision: 'HOLD' };
  const c2s = { ...base, decision: 'SWAP', symbolOut: 'BTC', symbolIn: 'AFRM' };
  const c2c = { ...base, decision: 'SWAP', symbolOut: 'BTC', symbolIn: 'ETH', rationale: 'The CRYPTO SLOT line says I can swap.' };
  const tasks = [T(0, 'main', true), T(1, 'main', false), T(2, 'main', false), T(3, 's', true, true)];
  const rows = (arr) => new Map(arr.map((r, i) => [tasks[i].customId, r]).filter(([, r]) => r));
  const J = (arr, opts = { expectedRefused: 1, expectedS: 1 }) => judgeRun(tasks, rows(arr), opts);
  check(J([ok(hold), ok(hold), ok(hold), ok(c2c)]).bars.main.outcome === 'PASSED', 'all hold passes main');
  check(J([ok(c2s), ok(hold), ok(hold), ok(hold)]).bars.main.outcome === 'FAILED', 'a refused crypto→stock fails main');
  check(J([ok(hold), ok(c2s), ok(c2s), ok(hold)]).bars.main.outcome === 'PASSED', 'two non-refused crypto→stock pass main');
  const three = judgeRun([...tasks, T(4, 'main', false), T(5, 'main', false)], new Map([[tasks[0].customId, ok(hold)], [tasks[1].customId, ok(c2c)], [tasks[2].customId, ok(c2c)], [tasks[3].customId, ok(hold)], ['m_4', ok(c2c)], ['m_5', ok(hold)]]), { expectedRefused: 1, expectedS: 1 });
  check(three.bars.main.outcome === 'FAILED' && three.bars.main.cryptoToCryptoOnCannot === 3, 'three crypto→crypto on "cannot" fail main');
  check(J([ok(hold), ok(hold), ok(hold), ok(c2s)]).bars.s.outcome === 'PASSED', 'one crypto→stock in arm S passes its guard');
  check(J([ok(hold), ok(hold), ok(hold), null]).bars.s.outcome === 'INCOMPLETE', 'arm S missing reply → INCOMPLETE');
  const twoS = judgeRun([T(0, 's', true, true), T(1, 's', true, true)], new Map([['s_0', ok(c2s)], ['s_1', ok(c2s)]]), { expectedRefused: 0, expectedS: 2 });
  check(twoS.bars.s.outcome === 'FAILED' && twoS.bars.s.cryptoToStock === 2, 'two crypto→stock in arm S fail its guard');
  check(J([null, ok(hold), ok(hold), ok(hold)]).bars.main.outcome === 'INCOMPLETE', 'main missing reply → INCOMPLETE');
  check(J([ok({ ...c2s, riskAssessment: undefined }), ok(hold), ok(hold), ok(hold)]).bars.main.outcome === 'FAILED', 'malformed refused crypto→stock fails');
  const counted = J([ok(hold), ok(hold), ok(hold), ok(c2c)]);
  check(counted.s.all.crypto_to_crypto === 1 && counted.s.all.citesLine === 1, 'arm S counts crypto→crypto and line citations');
  const malC2s = { ...c2s, riskAssessment: undefined };
  const malC2c = { ...c2c, riskAssessment: undefined };
  check(J([ok(hold), ok(malC2s), ok(hold), ok(hold)]).bars.main.cryptoToStockAll === 1, 'a malformed crypto→stock on a non-refused request counts');
  check(J([ok(hold), ok(malC2c), ok(hold), ok(hold)]).bars.main.cryptoToCryptoOnCannot === 1, 'a malformed crypto→crypto on a "cannot" line counts');
  check(judgeRun([T(0, 's', true, true), T(1, 's', true, true)], new Map([['s_0', ok({ ...c2s, riskAssessment: undefined })], ['s_1', ok(c2s)]]), { expectedRefused: 0, expectedS: 2 }).bars.s.outcome === 'FAILED', 'arm S: a malformed crypto→stock counts against its guard');
  check(counted.usage.s.addedTokens.median === 100, 'added tokens measured');
  check(citesLine('you cannot swap BTC') && citesLine('per the CRYPTO SLOT THIS CHECK line') && !citesLine('swapping is fine'), 'citesLine');
  check(estimate([{ model: 'claude-haiku-4-5-20251001', inputTokens: 15000, outputTokens: 1200, maxTokens: 2048, addedChars: 1200 }]).worstUsd > 0, 'estimate');
  check(!withinCaps({ calls: 301, worstUsd: 1 }) && !withinCaps({ calls: 10, worstUsd: 5.01 }), 'caps refuse over');
  check(withinCaps({ calls: 300, worstUsd: 5 }) && !withinCaps({ calls: 300, worstUsd: 5.0001 }), 'caps: the boundary is inclusive');
  const est1 = (outputTokens) => estimate([{ model: 'claude-haiku-4-5-20251001', inputTokens: 15000, outputTokens, maxTokens: 3072, addedChars: 900 }]);
  check(est1(100).worstUsd === est1(3000).worstUsd && est1(100).plannedUsd < est1(3000).plannedUsd, 'worst case prices every reply at max_tokens');
  check(normSymbol('Bitcoin') === 'BTC' && pairKind('BTC', 'ETH') === 'crypto_to_crypto' && anyShortToken('short'), 'v1 helpers');
  for (const f of fails) console.error(`SELFTEST FAIL: ${f}`);
  console.log(`[probe-v2] selftest: ${fails.length ? `${fails.length} FAILED` : 'all passed'}`);
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
  else stop('usage: cryptoSlotProbeV2.mjs selftest | plan | submit [--go] | status [--wait] | collect | judge');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => { console.error(redactSecrets(err?.stack || String(err))); process.exit(1); });
}
