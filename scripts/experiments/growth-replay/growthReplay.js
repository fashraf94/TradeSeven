#!/usr/bin/env node
// scripts/experiments/growth-replay/growthReplay.js
//
// Growth Replay — does what an agent has learned change the calls it makes?
//
// An OFFLINE experiment. It replays Trading Brain requests that production
// already dispatched (the tick capture: agentBattles/{id}/ticks + tickBodies),
// many times, straight to the Anthropic API:
//   arm 1  the verbatim request, the production model, repeated (noise floor);
//   arm 2  the same request with the agent's LEARNED section emptied (strip),
//          replaced by another agent's (swap), or with the player's EQUIPPED
//          sections emptied (loadout);
//   arm 3  the verbatim request on other Claude models (ladder).
// It measures whether decisions CHANGE, never whether they improve.
//
// READ-ONLY AGAINST PRODUCTION BY CONSTRUCTION.
//   - Firestore: the Admin SDK is used for .get(), .select(), getAll() only.
//     There is no write call of any kind in this file.
//   - No product module is imported (nothing that initializes Firebase or reads
//     feature flags). The few production facts this needs — section headers,
//     the decision tool's validation rule — are re-derived here and cited to
//     their source lines in the report.
//   - Model calls go from this script to api.anthropic.com with plain fetch,
//     never through a product handler, so no capture record, cron state or
//     battle document is ever written.
//   - The API key is read from the environment / .env.local and sent only as
//     the x-api-key header. It is never printed or written.
//
// Everything this writes lands in %USERPROFILE%/growth-replay-runs/<runId>/,
// outside the repo: request bodies and responses carry player text.
//
// USAGE (repo root, Windows PowerShell or any shell), in order:
//   node scripts/experiments/growth-replay/growthReplay.js plan
//   node scripts/experiments/growth-replay/growthReplay.js pilot
//   node scripts/experiments/growth-replay/growthReplay.js submit --go
//   node scripts/experiments/growth-replay/growthReplay.js status [--wait]
//   node scripts/experiments/growth-replay/growthReplay.js collect
//   node scripts/experiments/growth-replay/growthReplay.js analyze
//   node scripts/experiments/growth-replay/growthReplay.js selftest
// Every command but `plan` and `selftest` acts on the newest run; pass
// --run <runId> to pick another.

import { hash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..', '..', '..');

// ---------------------------------------------------------------- frozen constants

export const SEED = 20261008;
const TARGET_N = 300;
const MIN_N = 60;            // gate: fewer eligible ticks than this → STOP
const N_FLOOR = 120;         // the budget cut may not take N below this
const BATTLE_CAP_SHARE = 0.15;
const CAPTURE_FLOOR_ISO = '2026-09-01T00:00:00.000Z'; // capture shipped 2026-09-21; every battle alive after this is walked
const PERMUTATIONS = 2000;
const SPLIT_HALF_DRAWS = 200;
const PILOT_BILLABLE_MAX = 10;
const PILOT_ATTEMPT_MAX = 16; // validation rejections (HTTP 400) are unbilled; listed separately
const BATCH_MAX_REQUESTS = 10_000;
const BATCH_MAX_BYTES = 100 * 1024 * 1024;
// Each create uploads at most this much: a smaller upload is less likely to time out
// on a home connection after the server has already created the batch (an orphan).
const BATCH_TARGET_BYTES = 40 * 1024 * 1024;
const POLL_EVERY_MS = 5 * 60 * 1000;
const POLL_FOR_MS = 2 * 60 * 60 * 1000;
const ANTHROPIC = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01'; // the SDK's default header; production sends no other (agent-evaluate.js:228-232)

// Caps, enforced at submit time.
export const CAPS = Object.freeze({ plannedUsd: 150, worstUsd: 185, deadlineIso: '2026-10-10T23:00:00.000Z' });

// USD per million tokens, platform.claude.com/docs/en/about-claude/pricing (read 2026-10-08).
// Haiku 5.5 rows are the "prompts up to 100,000 tokens" card; every replayed prompt is far below it (asserted).
export const PRICES = Object.freeze({
  'claude-haiku-4-5': { label: 'Claude Haiku 4.5', batchIn: 0.50, batchOut: 2.50, stdIn: 1.00, stdOut: 5.00 },
  'claude-haiku-5-5': { label: 'Claude Haiku 5.5', batchIn: 0.05, batchOut: 0.25, stdIn: 0.10, stdOut: 0.50 },
  'claude-sonnet-5-5': { label: 'Claude Sonnet 5.5', batchIn: 1.00, batchOut: 5.00, stdIn: 2.00, stdOut: 10.00 },
  'claude-opus-5-5': { label: 'Claude Opus 5.5', batchIn: 2.00, batchOut: 10.00, stdIn: 4.00, stdOut: 20.00 },
});
/** The ladder targets, by display name; ids are resolved from GET /v1/models. */
const LADDER_TARGETS = [
  { display: 'Claude Haiku 5.5', priceKey: 'claude-haiku-5-5' },
  { display: 'Claude Sonnet 5.5', priceKey: 'claude-sonnet-5-5' },
  { display: 'Claude Opus 5.5', priceKey: 'claude-opus-5-5' },
];
const SAMPLING_PARAMS = ['temperature', 'top_p', 'top_k'];
const BATCH_REJECTED_FIELDS = ['stream', 'speed'];

// The production request literal (api/cron/agent-evaluate.js:2876-2893).
const PROD_TOOL_NAME = 'submit_trade_decision';
const EXPECTED_KEYS = ['model', 'max_tokens', 'temperature', 'system', 'messages', 'tools', 'tool_choice'];

// Section anchors in the prompt the assembler renders (agentEvalPromptAssembly.js,
// controlPromptRenderer.js — cited with line numbers in the report). Parts are
// joined with a blank line in both blocks (agentEvalPromptAssembly.js:838, :1285).
const SEP = '\n\n';
export const WISDOM_HEADER = 'YOUR STRATEGIC WISDOM (learned over multiple consolidation cycles):\n';
export const FRESH_LINE = 'You are a fresh agent with no battle history yet. Trade carefully and observe.';
export const RULES_HEADER = 'YOUR FORGE RULES:\n';
export const LEANS_HEADER = 'STANDING LEANS (user-equipped persistent adjustments):\n';
export const LEANS_TAIL = "Apply these as standing leans within your archetype's core identity — they tune your execution at the margin and never override your archetype's rules, platform safety limits, or an active directive.";

/** Headers counted across the corpus for the section map cross-check (presence counts only). */
const CENSUS_HEADERS = {
  system: ['━━━ ARCHETYPE IDENTITY ━━━', '━━━ SCORING RULES ━━━', '━━━ DECISION FRAMEWORK ━━━', '━━━ FORGE RULES ━━━', '━━━ SURVIVAL MODE ━━━', '━━━ INNER MONOLOGUE FORMAT ━━━'],
  identity: ['ABOUT YOU:\n', 'YOUR STRATEGIC BRIEF (from when you built this portfolio):\n', 'YOUR INITIAL PORTFOLIO RATIONALE:\n', WISDOM_HEADER, FRESH_LINE, RULES_HEADER, 'C_INST: INSTITUTIONAL DATA LAG'],
  live: ['━━━ LIVE BATTLE STATE ━━━', '## Vision State', 'REGIME CONTEXT:\n', 'STRATEGY PRESET: ', 'ACTIVE POSITIONS:\n', 'BENCH (available for swap):', 'BENCH: Empty', 'BENCH TECHNICAL CONTEXT:', 'FUNDAMENTALS (held + bench', 'CLOSED TRADES THIS BATTLE:', 'TRIGGER (why you were woken up):', 'INTRADAY MOMENTUM SNAPSHOT:', 'RISK STATUS:\n', 'ACTIVE DIRECTIVE (from your Coach):', LEANS_HEADER, '=== INSTITUTIONAL INTELLIGENCE (13F Filings) ===', 'FANTASYTIMES INTELLIGENCE (recent stories from your newsroom):', 'FANTASYTIMES BREAKING NEWS:', 'YOUR LAST 3 DECISIONS:'],
};

// ---------------------------------------------------------------- small pure helpers

// One-shot crypto.hash (Node ≥ 20.12): the same SHA-256 digest as the streaming createHash form.
export const sha256Utf8 = (s) => hash('sha256', Buffer.from(s, 'utf8'), 'hex');
const sha256Bytes = (b) => hash('sha256', b, 'hex');
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const round = (x, d = 4) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(d)));
const inc = (o, k, by = 1) => { o[k] = (o[k] || 0) + by; return o; };
const sortedKeys = (o) => Object.keys(o).sort();

export function countOf(hay, needle) {
  if (typeof hay !== 'string' || !needle) return 0;
  let n = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) n += 1;
  return n;
}

export function toMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

/** mulberry32 — the seedable PRNG of the Jev and declarations experiments. */
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

export function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function groupBy(list, keyFn) {
  const out = {};
  for (const x of list) { const k = keyFn(x); (out[k] || (out[k] = [])).push(x); }
  return out;
}

// ---------------------------------------------------------------- env + credentials

export function parseEnvText(text) {
  const env = {};
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

/** The primary checkout of an app-made worktree (<root>/.claude/worktrees/<name>), or null. */
export function primaryCheckoutRoot(projectRoot) {
  const parts = path.resolve(projectRoot).split(path.sep);
  const i = parts.lastIndexOf('worktrees');
  if (i >= 1 && parts[i - 1] === '.claude') return parts.slice(0, i - 1).join(path.sep) || path.sep;
  return null;
}

/** Lookup order: the real environment, then this tree's .env.local, then the primary checkout's. Nothing is copied. */
function loadEnv() {
  const files = [path.join(PROJECT_ROOT, '.env.local')];
  const primary = primaryCheckoutRoot(PROJECT_ROOT);
  if (primary) files.push(path.join(primary, '.env.local'));
  const merged = {};
  const used = [];
  for (const f of files) {
    if (!existsSync(f)) continue;
    used.push(f);
    for (const [k, v] of Object.entries(parseEnvText(readFileSync(f, 'utf8')))) if (merged[k] === undefined) merged[k] = v;
  }
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && v !== '') merged[k] = v;
  return { env: merged, used };
}

function stop(message, code = 2) {
  console.error(`\nSTOP: ${message}`);
  process.exit(code);
}

/** The variable the production brain call site reads (api/cron/agent-evaluate.js:229). */
function anthropicKey(env) {
  const key = env.CLAUDE_API_KEY;
  if (typeof key !== 'string' || !key.startsWith('sk-ant-')) stop('CLAUDE_API_KEY is not set (checked the environment, this tree\'s .env.local, then the primary checkout\'s .env.local).');
  return key;
}

async function openFirestore(env) {
  let sa = null;
  if (env.FIREBASE_ADMIN_CREDENTIALS) {
    sa = JSON.parse(env.FIREBASE_ADMIN_CREDENTIALS);
  } else if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    sa = { project_id: env.FIREBASE_PROJECT_ID, client_email: env.FIREBASE_CLIENT_EMAIL, private_key: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') };
  } else {
    stop('FIREBASE_ADMIN_CREDENTIALS is not set (checked the environment, this tree\'s .env.local, then the primary checkout\'s .env.local).');
  }
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = initializeApp({ credential: cert(sa) }, 'growth-replay');
  console.log(`[growth-replay] Firestore project_id: ${sa.project_id}`);
  return { db: getFirestore(app), projectId: sa.project_id };
}

/** READ-ONLY reader: every method reads. There is deliberately no write method. */
function makeReader(db) {
  return {
    async battleIndex() {
      const snap = await db.collection('agentBattles')
        .select('status', 'expiresAt', 'gameMode', 'agentContext.archetype', 'agentContext.consolidatedInsight', 'agentContext.activeRules', 'agentContext.standingLeans')
        .get();
      return snap.docs.map((d) => ({ battleId: d.id, ...d.data() }));
    },
    async ticks(battleId) {
      const snap = await db.collection('agentBattles').doc(battleId).collection('ticks').get();
      return snap.docs.map((d) => ({ tickId: d.id, ...d.data() }));
    },
    async bodies(battleId, tickIds) {
      const out = {};
      for (let i = 0; i < tickIds.length; i += 25) {
        const refs = tickIds.slice(i, i + 25).map((t) => db.collection('agentBattles').doc(battleId).collection('tickBodies').doc(t));
        const snaps = await db.getAll(...refs);
        snaps.forEach((s, j) => { out[tickIds[i + j]] = s.exists ? s.data() : null; });
      }
      return out;
    },
  };
}

// ---------------------------------------------------------------- the request: shape, sections, edits

/** Locate the LEARNED and EQUIPPED spans of the identity block (messages[0]). */
export function parseIdentity(content) {
  if (typeof content !== 'string') return { status: 'unparseable', why: 'not_a_string' };
  const nW = countOf(content, SEP + WISDOM_HEADER);
  const nF = countOf(content, SEP + FRESH_LINE);
  const nR = countOf(content, SEP + RULES_HEADER);
  if (nR > 1) return { status: 'ambiguous', why: `rules_header_x${nR}` };
  const rulesAt = nR === 1 ? content.indexOf(SEP + RULES_HEADER) : -1;
  // The rules part is always the LAST part (agentEvalPromptAssembly.js:835-838):
  // its empty rendering removes it together with its separator.
  const rules = rulesAt >= 0 ? { start: rulesAt, end: content.length } : null;
  const learnedEnd = rulesAt >= 0 ? rulesAt : content.length;
  if (nW === 1 && nF === 0) {
    const start = content.indexOf(SEP + WISDOM_HEADER) + SEP.length;
    if (start > learnedEnd) return { status: 'ambiguous', why: 'wisdom_after_rules' };
    return { status: 'learned', learned: { start, end: learnedEnd }, rules };
  }
  if (nF === 1 && nW === 0) {
    const start = content.indexOf(SEP + FRESH_LINE) + SEP.length;
    if (start + FRESH_LINE.length !== learnedEnd) return { status: 'ambiguous', why: 'fresh_line_not_a_whole_part' };
    return { status: 'fresh', learned: null, freshAt: start, rules };
  }
  return { status: 'ambiguous', why: `wisdom_x${nW}_fresh_x${nF}` };
}

/** Locate the standing-leans block of the live context (messages[2]). */
export function findLeans(content) {
  if (typeof content !== 'string') return { status: 'unparseable' };
  const n = countOf(content, SEP + LEANS_HEADER);
  if (n === 0) return countOf(content, LEANS_HEADER) ? { status: 'ambiguous', why: 'header_without_separator' } : { status: 'absent' };
  if (n > 1) return { status: 'ambiguous', why: `header_x${n}` };
  const start = content.indexOf(SEP + LEANS_HEADER);
  const tailAt = content.indexOf(LEANS_TAIL, start);
  if (tailAt < 0) return { status: 'ambiguous', why: 'tail_missing' };
  const end = tailAt + LEANS_TAIL.length;
  const lines = content.slice(start + SEP.length + LEANS_HEADER.length, tailAt).split('\n');
  const last = lines.pop();
  if (last !== '' || !lines.length || !lines.every((l) => l.startsWith('- "') && l.endsWith('"'))) return { status: 'ambiguous', why: 'lean_lines' };
  if (end !== content.length && !content.startsWith(SEP, end)) return { status: 'ambiguous', why: 'not_a_whole_part' };
  return { status: 'present', span: { start, end }, count: lines.length };
}

/** Shape facts of one recorded request. */
export function analyzeRequest(req) {
  const problems = [];
  const keys = Object.keys(req || {});
  if (JSON.stringify(keys) !== JSON.stringify(EXPECTED_KEYS)) problems.push(`keys=${keys.join(',')}`);
  const msgs = Array.isArray(req?.messages) ? req.messages : [];
  if (msgs.length !== 3 || msgs[0]?.role !== 'user' || msgs[1]?.role !== 'assistant' || msgs[2]?.role !== 'user') problems.push('messages_shape');
  if (!msgs.every((m) => typeof m?.content === 'string')) problems.push('message_content_not_string');
  if (typeof req?.system !== 'string') problems.push('system_not_string');
  if (!Array.isArray(req?.tools) || req.tools.length !== 1 || req.tools[0]?.name !== PROD_TOOL_NAME) problems.push('tools');
  if (req?.tool_choice?.type !== 'tool' || req?.tool_choice?.name !== PROD_TOOL_NAME) problems.push('tool_choice');
  const text = JSON.stringify(req ?? null);
  return {
    problems,
    model: req?.model ?? null,
    maxTokens: req?.max_tokens ?? null,
    temperature: req?.temperature ?? null,
    hasCacheControl: text.includes('"cache_control"'),
    hasBatchRejected: BATCH_REJECTED_FIELDS.filter((f) => req && Object.hasOwn(req, f)),
    identity: parseIdentity(msgs[0]?.content),
    leans: findLeans(msgs[2]?.content),
  };
}

/** The LEARNED part (header included) of a parsed identity, or null. */
export function learnedPartText(req, identity = parseIdentity(req?.messages?.[0]?.content)) {
  if (identity.status !== 'learned') return null;
  return req.messages[0].content.slice(identity.learned.start, identity.learned.end);
}

const cloneRequest = (req) => JSON.parse(JSON.stringify(req));

/**
 * Apply one variant's edit. Only the targeted spans move; every other byte of
 * the request is identical (asserted by assertOnlySpansMoved). Returns the new
 * request and the characters removed/added.
 */
export function applyVariant(req, variant, { donorPart = null } = {}) {
  const out = cloneRequest(req);
  const identityText = req.messages[0].content;
  const liveText = req.messages[2].content;
  const identity = parseIdentity(identityText);
  if (variant === 'strip' || variant === 'swap') {
    if (identity.status !== 'learned') throw new Error(`${variant}: identity is ${identity.status}`);
    const { start, end } = identity.learned;
    const replacement = variant === 'strip' ? FRESH_LINE : donorPart;
    if (variant === 'swap' && (typeof replacement !== 'string' || !replacement.startsWith(WISDOM_HEADER))) throw new Error('swap: donor part missing or malformed');
    out.messages[0].content = identityText.slice(0, start) + replacement + identityText.slice(end);
    return { request: out, removed: end - start, added: replacement.length };
  }
  if (variant === 'loadout') {
    let removed = 0;
    if (identity.rules) {
      out.messages[0].content = identityText.slice(0, identity.rules.start);
      removed += identity.rules.end - identity.rules.start;
    }
    const leans = findLeans(liveText);
    if (leans.status === 'present') {
      out.messages[2].content = liveText.slice(0, leans.span.start) + liveText.slice(leans.span.end);
      removed += leans.span.end - leans.span.start;
    }
    if (!removed) throw new Error('loadout: nothing equipped to remove');
    return { request: out, removed, added: 0 };
  }
  throw new Error(`unknown variant ${variant}`);
}

/** Everything outside messages[0].content and messages[2].content must be byte-identical. */
export function assertOnlySpansMoved(before, after) {
  const strip = (r) => JSON.stringify({ ...r, messages: r.messages.map((m, i) => (i === 0 || i === 2 ? { ...m, content: null } : m)) });
  if (strip(before) !== strip(after)) throw new Error('an edit moved bytes outside the targeted message contents');
}

/** The ladder request: only `model` changes, plus the fields the pilot proved a model rejects. */
export function ladderRequest(req, modelId, dropParams = []) {
  const out = {};
  for (const [k, v] of Object.entries(req)) {
    if (dropParams.includes(k) || BATCH_REJECTED_FIELDS.includes(k)) continue;
    out[k] = k === 'model' ? modelId : v;
  }
  return out;
}

/** Batch-safe params: the Batch API rejects stream/speed (none are expected; any present are removed and listed). */
export function batchParams(req) {
  const out = {};
  for (const [k, v] of Object.entries(req)) if (!BATCH_REJECTED_FIELDS.includes(k)) out[k] = v;
  return out;
}

// ---------------------------------------------------------------- the decision key (G5)

/**
 * Schema validation of a submit_trade_decision input, against the request's
 * OWN tool schema — the same checks, in the same order, as production's
 * validateTradeToolResult (api/_utils/agentEvalToolResultValidation.js):
 * required → type/enum/range per declared property → the SWAP ticker pair.
 */
export function validateToolInput(input, schema) {
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(input)) return { valid: false, field: 'input' };
  for (const name of schema?.required || []) if (input[name] === undefined || input[name] === null) return { valid: false, field: name };
  const typeOk = (value, declared) => (Array.isArray(declared) ? declared : [declared]).some((t) => {
    switch (t) {
      case 'null': return value === null;
      case 'array': return Array.isArray(value);
      case 'object': return isObj(value);
      case 'string': return typeof value === 'string';
      case 'integer':
      case 'number': return typeof value === 'number' && Number.isFinite(value);
      case 'boolean': return typeof value === 'boolean';
      default: return true;
    }
  });
  for (const [name, spec] of Object.entries(schema?.properties || {})) {
    const value = input[name];
    if (value === undefined || value === null) continue;
    if (!typeOk(value, spec.type)) return { valid: false, field: name };
    if (Array.isArray(spec.enum) && !spec.enum.includes(value)) return { valid: false, field: name };
    if (typeof value === 'number') {
      if (typeof spec.minimum === 'number' && value < spec.minimum) return { valid: false, field: name };
      if (typeof spec.maximum === 'number' && value > spec.maximum) return { valid: false, field: name };
    }
  }
  if (input.decision === 'SWAP') {
    for (const name of ['symbolOut', 'symbolIn']) if (typeof input[name] !== 'string' || input[name].trim() === '') return { valid: false, field: name };
  }
  return { valid: true, field: null };
}

export const MALFORMED = 'malformed';
const sym = (s) => String(s).trim().toUpperCase();

/** coarse = HOLD | SWAP | malformed; fine = HOLD | SWAP:OUT>IN | malformed. */
/**
 * Production validates the reply against the declarations-OFF tool
 * (agentEvalToolResultValidation.js INPUT_SCHEMA = TRADE_DECISION_TOOL.input_schema;
 * agentEvalToolSchema.js:504 builds it with declarations: false), so a bad
 * `declarations` value never fails a production decision. The key of record
 * mirrors that: the request's own schema minus `declarations` (for every
 * sampled request this equals production's validation schema — checked and
 * reported). `strict: true` keeps `declarations` (the stricter sensitivity key).
 */
export function validationSchema(schema, { strict = false } = {}) {
  if (strict || !schema?.properties || !Object.hasOwn(schema.properties, 'declarations')) return schema;
  return { ...schema, properties: Object.fromEntries(Object.entries(schema.properties).filter(([k]) => k !== 'declarations')) };
}

export function decisionKey(message, schema, { strict = false } = {}) {
  const block = Array.isArray(message?.content) ? message.content.find((b) => b?.type === 'tool_use' && b?.name === PROD_TOOL_NAME) : null;
  if (!block) return { coarse: MALFORMED, fine: MALFORMED, why: 'no_tool_use' };
  const v = validateToolInput(block.input, validationSchema(schema, { strict }));
  if (!v.valid) return { coarse: MALFORMED, fine: MALFORMED, why: `invalid:${v.field}` };
  const d = block.input.decision;
  return { coarse: d, fine: d === 'SWAP' ? `SWAP:${sym(block.input.symbolOut)}>${sym(block.input.symbolIn)}` : d, why: null };
}

/** The decision the tick originally received, from the permanent record's enums. */
export function originalKey(perm) {
  const d = perm?.decision?.original;
  if (d === 'SWAP' && perm.decision.originalSymbolOut && perm.decision.originalSymbolIn) {
    return { coarse: 'SWAP', fine: `SWAP:${sym(perm.decision.originalSymbolOut)}>${sym(perm.decision.originalSymbolIn)}` };
  }
  if (d === 'HOLD') return { coarse: 'HOLD', fine: 'HOLD' };
  return { coarse: d ?? null, fine: null };
}

// ---------------------------------------------------------------- statistics

export function counts(keys) { const c = {}; for (const k of keys) inc(c, k); return c; }

/** Most frequent key; ties broken by the lexically smallest key (applied identically everywhere). */
export function modal(c) {
  let best = null; let bestN = -1;
  for (const k of sortedKeys(c)) if (c[k] > bestN) { best = k; bestN = c[k]; }
  return best;
}

/** Total variation distance between two empirical distributions. */
export function tvDistance(a, b) {
  const na = Object.values(a).reduce((s, x) => s + x, 0);
  const nb = Object.values(b).reduce((s, x) => s + x, 0);
  if (!na || !nb) return null;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let s = 0;
  for (const k of keys) s += Math.abs((a[k] || 0) / na - (b[k] || 0) / nb);
  return s / 2;
}

/**
 * Arm 2 test. ticks: [{ base: [keys], variant: [keys] }]. T = mean TV distance;
 * the null permutes condition labels WITHIN each tick (group sizes kept).
 */
export function permutationTest(ticks, { permutations = PERMUTATIONS, seed = SEED } = {}) {
  const usable = ticks.filter((t) => t.base.length && t.variant.length);
  if (!usable.length) return null;
  const obsTv = usable.map((t) => tvDistance(counts(t.base), counts(t.variant)));
  const obsFlip = usable.map((t) => (modal(counts(t.base)) !== modal(counts(t.variant)) ? 1 : 0));
  const T = mean(obsTv);
  const flip = mean(obsFlip);
  const rand = rng(seed);
  const nullT = [];
  const nullFlip = [];
  for (let p = 0; p < permutations; p += 1) {
    let sT = 0; let sF = 0;
    for (const t of usable) {
      const pool = shuffle([...t.base, ...t.variant], rand);
      const a = counts(pool.slice(0, t.base.length));
      const b = counts(pool.slice(t.base.length));
      sT += tvDistance(a, b);
      sF += modal(a) !== modal(b) ? 1 : 0;
    }
    nullT.push(sT / usable.length);
    nullFlip.push(sF / usable.length);
  }
  const sorted = [...nullT].sort((x, y) => x - y);
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)];
  const exceed = nullT.filter((x) => x >= T - 1e-12).length;
  const nullFlipMean = mean(nullFlip);
  return {
    ticks: usable.length,
    T, nullMean: mean(nullT), nullP95: p95, p: (exceed + 1) / (permutations + 1),
    flipRate: flip, nullFlipRate: nullFlipMean, excessFlip: flip - nullFlipMean,
    perTickTv: obsTv,
  };
}

/** The frozen arm-2 labels. */
export function arm2Label(res) {
  if (!res) return 'not measured';
  if (res.p >= 0.05) return 'no measurable effect';
  return res.excessFlip < 0.05 ? 'measurable but small' : 'moves decisions';
}

/** The frozen arm-1 labels. */
export function arm1Label(meanAgreement) {
  if (meanAgreement == null) return 'not measured';
  if (meanAgreement >= 0.90) return 'steady';
  if (meanAgreement >= 0.75) return 'wobbly';
  return 'noisy';
}

/** Split-half modal agreement: two random halves of a tick's repeats agree on the modal decision. */
export function splitHalfAgreement(keyLists, { draws = SPLIT_HALF_DRAWS, seed = SEED } = {}) {
  const rand = rng(seed + 7);
  const per = [];
  for (const keys of keyLists) {
    if (keys.length < 2) continue;
    const half = Math.floor(keys.length / 2);
    let agree = 0;
    for (let d = 0; d < draws; d += 1) {
      const s = shuffle(keys, rand);
      if (modal(counts(s.slice(0, half))) === modal(counts(s.slice(half, 2 * half)))) agree += 1;
    }
    per.push(agree / draws);
  }
  return mean(per);
}

// ---------------------------------------------------------------- sampling (seeded, round-robin, capped)

/**
 * eligible: [{ k, battleId, cls: 'action'|'hold', ... }] (any order; sorted here).
 * Largest N ≤ target such that no battle exceeds floor(15% × N), balanced toward
 * 50/50 action/hold where supply allows. The cap lifts only as far as needed to reach 60.
 */
export function drawSample(eligible, { target = TARGET_N, seed = SEED } = {}) {
  const sorted = [...eligible].sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  const rand = rng(seed);
  const battles = shuffle([...new Set(sorted.map((e) => e.battleId))].sort(), rand);
  const pools = {};
  for (const b of battles) {
    pools[b] = {
      action: shuffle(sorted.filter((e) => e.battleId === b && e.cls === 'action'), rand),
      hold: shuffle(sorted.filter((e) => e.battleId === b && e.cls === 'hold'), rand),
    };
  }
  const attempt = (n, cap) => {
    const taken = {}; const ptr = {}; const picks = [];
    const pick = (cls, quota) => {
      let got = 0; let progressed = true;
      while (got < quota && progressed) {
        progressed = false;
        for (const b of battles) {
          if (got >= quota) break;
          const i = ptr[`${b}|${cls}`] || 0;
          if ((taken[b] || 0) >= cap || i >= pools[b][cls].length) continue;
          picks.push({ ...pools[b][cls][i], order: picks.length });
          ptr[`${b}|${cls}`] = i + 1; taken[b] = (taken[b] || 0) + 1; got += 1; progressed = true;
        }
      }
      return got;
    };
    const a = pick('action', Math.floor(n / 2));
    const h = pick('hold', n - a);
    if (a + h < n) pick('action', n - a - h); // holds ran short: top up with actions
    return picks.length === n ? picks : null;
  };
  const maxN = Math.min(target, sorted.length);
  for (let n = maxN; n >= Math.min(MIN_N, maxN); n -= 1) {
    const picks = attempt(n, Math.max(1, Math.floor(BATTLE_CAP_SHARE * n)));
    if (picks) return { picks, n, cap: Math.max(1, Math.floor(BATTLE_CAP_SHARE * n)), capLifted: false };
  }
  const n = Math.min(MIN_N, sorted.length);
  for (let cap = Math.floor(BATTLE_CAP_SHARE * n) + 1; cap <= n; cap += 1) {
    const picks = attempt(n, cap);
    if (picks) return { picks, n, cap, capLifted: true };
  }
  return { picks: [], n: 0, cap: 0, capLifted: false };
}

/** Proportional reduction to n ticks: keep the action/hold split, take each class in pick order. */
export function reduceSample(picks, n) {
  if (n >= picks.length) return picks;
  const act = picks.filter((p) => p.cls === 'action');
  const hold = picks.filter((p) => p.cls === 'hold');
  const nA = Math.round((act.length * n) / picks.length);
  return [...act.slice(0, nA), ...hold.slice(0, n - nA)].sort((a, b) => a.order - b.order);
}

/** Seeded donor per arm-2 tick: a DIFFERENT agent whose learned text differs; same archetype preferred. */
export function assignDonors(targets, pool, { seed = SEED } = {}) {
  const rand = rng(seed + 1);
  const byAgent = groupBy(pool, (p) => p.agentId);
  const out = {};
  for (const t of [...targets].sort((a, b) => (a.k < b.k ? -1 : 1))) {
    const agents = sortedKeys(byAgent).filter((a) => a !== t.agentId && byAgent[a].some((p) => p.learnedHash !== t.learnedHash));
    const same = agents.filter((a) => byAgent[a][0].archetype === t.archetype);
    const choices = same.length ? same : agents;
    if (!choices.length) { out[t.k] = null; continue; }
    const agent = choices[Math.floor(rand() * choices.length)];
    const ticks = byAgent[agent].filter((p) => p.learnedHash !== t.learnedHash).sort((a, b) => (a.k < b.k ? -1 : 1));
    const d = ticks[Math.floor(rand() * ticks.length)];
    out[t.k] = { k: d.k, agentId: d.agentId, archetype: d.archetype, learnedHash: d.learnedHash, pairing: same.length ? 'donor_same_archetype' : 'donor_other_archetype' };
  }
  return out;
}

// ---------------------------------------------------------------- the run plan and its budget

/** Build the task list. models: [{ key, modelId, priceKey, isProd, dropParams, repeats }]. */
export function buildTasks({ sample, arm2, variants, repeats, ladder }) {
  const tasks = [];
  for (const t of sample) for (let r = 1; r <= repeats.base; r += 1) tasks.push({ k: t.k, arm: 'base', variant: 'verbatim', model: 'prod', rep: r });
  for (const v of variants) {
    for (const t of arm2) {
      if (v === 'swap' && !t.donor) continue;
      if (v === 'loadout' && !t.hasEquipped) continue;
      for (let r = 1; r <= repeats.memory; r += 1) tasks.push({ k: t.k, arm: 'memory', variant: v, model: 'prod', rep: r });
    }
  }
  for (const m of ladder) for (const t of sample) for (let r = 1; r <= m.repeats; r += 1) tasks.push({ k: t.k, arm: 'ladder', variant: 'verbatim', model: m.key, rep: r });
  return tasks;
}

/**
 * Planned and worst-case USD for a task list. est[modelKey] = { input, output, maxTokens, cacheMultiplier }.
 * Worst case: same input, output at max_tokens.
 */
export function costOf(tasks, est, priceOf) {
  let planned = 0; let worst = 0;
  const byArm = {};
  for (const t of tasks) {
    const e = est[t.model]; const p = priceOf(t.model);
    const inUsd = (e.input * e.cacheMultiplier * p.batchIn) / 1e6;
    const pl = inUsd + (e.output * p.batchOut) / 1e6;
    const wc = inUsd + (e.maxTokens * p.batchOut) / 1e6;
    planned += pl; worst += wc;
    const key = t.arm === 'ladder' ? `ladder:${t.model}` : t.arm === 'memory' ? `memory:${t.variant}` : 'base';
    const row = byArm[key] || (byArm[key] = { requests: 0, planned: 0, worst: 0 });
    row.requests += 1; row.planned += pl; row.worst += wc;
  }
  return { planned, worst, byArm };
}

/**
 * The cut order of the prompt (§6): drop loadout; Opus repeats → 3; N down
 * proportionally to 120; drop Opus. Stops as soon as both caps hold.
 */
export function fitToCaps(build, { caps = CAPS } = {}) {
  const fits = (c) => c.planned <= caps.plannedUsd && c.worst <= caps.worstUsd;
  const cfg = { n: build.fullN, loadout: true, opusRepeats: null, opus: true };
  const cuts = [];
  let r = build.evaluate(cfg);
  if (fits(r.cost)) return { cfg, cuts, ...r };
  cfg.loadout = false; cuts.push('dropped the loadout variant');
  r = build.evaluate(cfg);
  if (fits(r.cost)) return { cfg, cuts, ...r };
  if (build.hasOpus) {
    cfg.opusRepeats = 3; cuts.push('Opus repeats reduced to 3');
    r = build.evaluate(cfg);
    if (fits(r.cost)) return { cfg, cuts, ...r };
  }
  for (let n = cfg.n - 1; n >= Math.min(N_FLOOR, cfg.n); n -= 1) {
    cfg.n = n;
    r = build.evaluate(cfg);
    if (fits(r.cost)) { cuts.push(`N reduced to ${n}`); return { cfg, cuts, ...r }; }
  }
  if (cfg.n < build.fullN) cuts.push(`N reduced to ${cfg.n}`);
  if (build.hasOpus) {
    cfg.opus = false; cuts.push('dropped Opus');
    r = build.evaluate(cfg);
    if (fits(r.cost)) return { cfg, cuts, ...r };
  }
  return { cfg, cuts, ...r, over: true };
}

// ---------------------------------------------------------------- Anthropic HTTP (plain fetch)

export function isSpendLimitError(status, json, text = '') {
  const msg = String(json?.error?.message ?? '');
  if (status === 429 && /enforced_spend_limit_reached/.test(`${text} ${json?.error?.type ?? ''}`)) return true;
  if (status === 400 && msg.startsWith('You have reached your specified API usage limits')) return true;
  return false;
}

async function api(apiKey, method, urlPath, body) {
  const res = await fetch(urlPath.startsWith('http') ? urlPath : `${ANTHROPIC}${urlPath}`, {
    method,
    headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  if (isSpendLimitError(res.status, json, text)) stop(`the API reported a spend limit (HTTP ${res.status}): ${String(json?.error?.message ?? '').slice(0, 200)}. Nothing further was sent.`, 3);
  return { status: res.status, json, text, requestId: res.headers.get('request-id') };
}

async function listModels(apiKey) {
  const out = [];
  let after = null;
  for (let page = 0; page < 20; page += 1) {
    const r = await api(apiKey, 'GET', `/v1/models?limit=1000${after ? `&after_id=${encodeURIComponent(after)}` : ''}`);
    if (r.status !== 200) stop(`GET /v1/models returned HTTP ${r.status}`);
    out.push(...(r.json?.data || []).map((m) => ({ id: m.id, display: m.display_name })));
    if (!r.json?.has_more) break;
    after = r.json.last_id;
  }
  return out;
}

// ---------------------------------------------------------------- run folder

const RUNS_ROOT = path.join(os.homedir(), 'growth-replay-runs');
const runDir = (runId) => path.join(RUNS_ROOT, runId);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
function writeJsonAtomic(p, value) {
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 1));
  renameSync(tmp, p);
}
function resolveRun(flags) {
  const id = flags.run || (existsSync(path.join(RUNS_ROOT, 'latest.txt')) ? readFileSync(path.join(RUNS_ROOT, 'latest.txt'), 'utf8').trim() : null);
  if (!id || !existsSync(runDir(id))) stop('no run folder found — run `plan` first, or pass --run <runId>.');
  return { runId: id, dir: runDir(id), manifestPath: path.join(runDir(id), 'manifest.json') };
}
function loadSources(dir) {
  const out = {};
  for (const line of readFileSync(path.join(dir, 'source-requests.jsonl'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    out[row.k] = row;
  }
  return out;
}
function headSha() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim(); } catch { return null; }
}

// ---------------------------------------------------------------- plan (gate + corpus + sample; no spend)

async function plan() {
  const { env, used } = loadEnv();
  console.log(`[growth-replay] env files read (names only): ${used.length ? used.map((f) => path.basename(path.dirname(f)) + '/' + path.basename(f)).join(', ') : 'none'}`);
  anthropicKey(env); // the STOP rule fires before any read if the key is missing
  const { db, projectId } = await openFirestore(env);
  const reader = makeReader(db);
  const floorMs = Date.parse(CAPTURE_FLOOR_ISO);

  const battles = (await reader.battleIndex()).filter((b) => {
    const e = toMs(b.expiresAt);
    return b.status === 'active' || e == null || e >= floorMs;
  });
  console.log(`[growth-replay] battles alive on/after ${CAPTURE_FLOOR_ISO.slice(0, 10)}: ${battles.length}`);

  const g2 = { allTicks: 0, dispatched: 0, outcomeOk: 0, battlesWithTicks: 0, excluded: {}, failureClasses: {}, responseShaMismatch: 0, reserializationMismatch: 0 };
  const shape = { problems: {}, models: {}, maxTokens: {}, temperature: {}, cacheControl: 0, batchRejected: 0, identity: {}, identityWhy: {}, leans: {}, leansWhy: {}, headers: {} };
  const crossCheck = { learnedVsBattleInsight: {}, rulesVsBattleRules: {}, leansVsBattleLeans: {} };
  const eligible = [];
  const learnedTexts = {}; // hash → LEARNED part text (run folder only)

  for (const [bi, b] of battles.entries()) {
    const ticks = await reader.ticks(b.battleId);
    if (!ticks.length) continue;
    g2.battlesWithTicks += 1;
    g2.allTicks += ticks.length;
    const cand = [];
    for (const t of ticks) {
      if (t.model?.dispatched !== true) continue;
      g2.dispatched += 1;
      if (t.model?.outcome !== 'ok') { inc(g2.excluded, 'model_outcome_not_ok'); inc(g2.failureClasses, String(t.model?.failureClass ?? t.model?.outcome)); continue; }
      g2.outcomeOk += 1;
      if (t.body?.status !== 'written' || t.body?.incomplete) { inc(g2.excluded, `body_${t.body?.status ?? 'none'}${t.body?.incomplete ? `_${t.body.incomplete}` : ''}`); continue; }
      cand.push(t);
    }
    const bodies = await reader.bodies(b.battleId, cand.map((t) => t.tickId));
    for (const t of cand) {
      const body = bodies[t.tickId];
      if (!body) { inc(g2.excluded, 'body_document_missing'); continue; }
      if (body.bodyIncomplete || body.request?.truncated) { inc(g2.excluded, 'body_incomplete'); continue; }
      const reqText = body.request?.body;
      if (typeof reqText !== 'string') { inc(g2.excluded, 'request_body_absent'); continue; }
      if (sha256Utf8(reqText) !== t.body.requestSha256 || Buffer.byteLength(reqText, 'utf8') !== t.body.requestBytes) { inc(g2.excluded, 'request_sha256_mismatch'); continue; }
      let req;
      try { req = JSON.parse(reqText); } catch { inc(g2.excluded, 'request_not_json'); continue; }
      if (typeof body.response?.body === 'string' && t.body.responseSha256 && sha256Bytes(Buffer.from(body.response.body, 'utf8')) !== t.body.responseSha256) g2.responseShaMismatch += 1;
      if (JSON.stringify(req) !== reqText) g2.reserializationMismatch += 1;

      const a = analyzeRequest(req);
      for (const p of a.problems) inc(shape.problems, p);
      inc(shape.models, String(a.model)); inc(shape.maxTokens, String(a.maxTokens)); inc(shape.temperature, String(a.temperature));
      if (a.hasCacheControl) shape.cacheControl += 1;
      if (a.hasBatchRejected.length) shape.batchRejected += 1;
      inc(shape.identity, a.identity.status); if (a.identity.why) inc(shape.identityWhy, a.identity.why);
      inc(shape.leans, a.leans.status); if (a.leans.why) inc(shape.leansWhy, a.leans.why);
      for (const [where, list] of Object.entries(CENSUS_HEADERS)) {
        const text = where === 'system' ? req.system : where === 'identity' ? req.messages?.[0]?.content : req.messages?.[2]?.content;
        for (const h of list) if (typeof text === 'string' && text.includes(h)) inc(shape.headers, `${where}|${h.trim()}`);
      }
      const battleHasInsight = Boolean(b.agentContext?.consolidatedInsight);
      inc(crossCheck.learnedVsBattleInsight, `${a.identity.status}|battleInsight=${battleHasInsight}`);
      inc(crossCheck.rulesVsBattleRules, `rendered=${Boolean(a.identity.rules)}|battleRules=${(b.agentContext?.activeRules || []).length > 0}`);
      inc(crossCheck.leansVsBattleLeans, `${a.leans.status}|battleLeans=${(b.agentContext?.standingLeans || []).length > 0}`);

      if (a.problems.length || a.identity.status === 'ambiguous' || a.identity.status === 'unparseable' || a.leans.status === 'ambiguous') { inc(g2.excluded, 'request_shape_or_sections_unparsed'); continue; }
      const orig = originalKey(t);
      if (orig.fine == null) { inc(g2.excluded, 'original_decision_unreadable'); continue; }
      const part = learnedPartText(req, a.identity);
      const learnedHash = part ? sha256Utf8(part) : null;
      if (part) learnedTexts[learnedHash] = part;
      eligible.push({
        k: `${b.battleId}__${t.tickId}`, battleId: b.battleId, tickId: t.tickId, tickSeq: t.tickSeq ?? null, agentId: t.agentId ?? null,
        archetype: b.agentContext?.archetype ?? 'unknown', gameMode: b.gameMode ?? null,
        day: typeof t.capturedAt === 'string' ? t.capturedAt.slice(0, 10) : null,
        cls: orig.coarse === 'SWAP' ? 'action' : 'hold', original: orig,
        learned: a.identity.status, learnedHash, learnedChars: part ? part.length : 0,
        hasRules: Boolean(a.identity.rules), hasLeans: a.leans.status === 'present',
        capturedInputTokens: t.callEnvelope?.inputTokens ?? null, capturedOutputTokens: t.callEnvelope?.outputTokens ?? null,
        model: a.model, maxTokens: a.maxTokens,
      });
    }
    if ((bi + 1) % 20 === 0) console.log(`[growth-replay] walked ${bi + 1}/${battles.length} battles; eligible so far ${eligible.length}`);
  }

  const eligibleCount = eligible.length;
  const tally = (list, key) => list.reduce((o, e) => inc(o, typeof key === 'function' ? key(e) : e[key]), {});
  const corpus = {
    eligible: eligibleCount,
    byArchetype: tally(eligible, 'archetype'), byBattle: tally(eligible, 'battleId'), byDay: tally(eligible, 'day'), byClass: tally(eligible, 'cls'),
    byLearned: tally(eligible, 'learned'), distinctAgents: new Set(eligible.map((e) => e.agentId)).size,
    distinctLearnedTexts: Object.keys(learnedTexts).length,
    agentsWithLearned: new Set(eligible.filter((e) => e.learned === 'learned').map((e) => e.agentId)).size,
  };

  const runId = `gr-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`;
  const dir = runDir(runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(RUNS_ROOT, 'latest.txt'), runId);

  const manifest = {
    runId, createdAt: new Date().toISOString(), headSha: headSha(), seed: SEED, projectId,
    captureFloor: CAPTURE_FLOOR_ISO, battlesWalked: battles.length,
    gate: { g2, shape, crossCheck, corpus },
  };

  const gateFail = [];
  const prodModels = Object.keys(shape.models);
  if (eligibleCount < MIN_N) gateFail.push(`only ${eligibleCount} eligible ticks (< ${MIN_N})`);
  if (shape.batchRejected) console.log(`[growth-replay] note: ${shape.batchRejected} request(s) carry stream/speed — removed before batching`);
  if (gateFail.length) {
    manifest.gate.outcome = { stop: true, reasons: gateFail };
    writeJsonAtomic(path.join(dir, 'manifest.json'), manifest);
    console.log(JSON.stringify(manifest.gate, null, 1));
    stop(`gate: ${gateFail.join('; ')}. Nothing was spent. Manifest: ${dir}`);
  }

  // ---- the sample ----
  const drawn = drawSample(eligible, { target: TARGET_N, seed: SEED });
  const sample = drawn.picks;
  const arm2Targets = sample.filter((s) => s.learned === 'learned');
  const donorPool = eligible.filter((e) => e.learned === 'learned' && e.agentId);
  const donors = assignDonors(arm2Targets, donorPool, { seed: SEED });

  // ---- pass 2: re-read the sampled bodies, re-verify, and keep them in the run folder ----
  const byBattle = groupBy(sample, (s) => s.battleId);
  const lines = [];
  for (const [battleId, list] of Object.entries(byBattle)) {
    const bodies = await reader.bodies(battleId, list.map((s) => s.tickId));
    const perm = Object.fromEntries((await reader.ticks(battleId)).map((t) => [t.tickId, t]));
    for (const s of list) {
      const reqText = bodies[s.tickId]?.request?.body;
      if (typeof reqText !== 'string' || sha256Utf8(reqText) !== perm[s.tickId]?.body?.requestSha256) stop(`sampled tick ${s.k} failed re-verification`);
      lines.push(JSON.stringify({ k: s.k, requestSha256: perm[s.tickId].body.requestSha256, request: JSON.parse(reqText) }));
    }
  }
  writeFileSync(path.join(dir, 'source-requests.jsonl'), `${lines.join('\n')}\n`);
  const neededDonorTexts = {};
  for (const d of Object.values(donors)) if (d) neededDonorTexts[d.learnedHash] = learnedTexts[d.learnedHash];
  writeFileSync(path.join(dir, 'donor-learned-texts.json'), JSON.stringify(neededDonorTexts));

  manifest.sample = {
    n: drawn.n, cap: drawn.cap, capLifted: drawn.capLifted,
    naturalActionShare: corpus.byClass.action ? corpus.byClass.action / eligibleCount : 0,
    ticks: sample.map((s) => ({
      k: s.k, battleId: s.battleId, tickId: s.tickId, agentId: s.agentId, archetype: s.archetype, day: s.day,
      cls: s.cls, order: s.order, original: s.original, learned: s.learned, learnedHash: s.learnedHash, learnedChars: s.learnedChars,
      hasRules: s.hasRules, hasLeans: s.hasLeans, hasEquipped: s.hasRules || s.hasLeans,
      capturedInputTokens: s.capturedInputTokens, capturedOutputTokens: s.capturedOutputTokens, maxTokens: s.maxTokens, model: s.model,
      donor: donors[s.k] ?? null,
    })),
  };
  manifest.gate.outcome = { stop: false, prodModels };
  writeJsonAtomic(path.join(dir, 'manifest.json'), manifest);

  const smp = manifest.sample.ticks;
  console.log(JSON.stringify({
    runId, dir, headSha: manifest.headSha,
    g2, corpus: { ...corpus, byBattle: `${Object.keys(corpus.byBattle).length} battles` },
    shape: { ...shape, headers: undefined }, headers: shape.headers, crossCheck,
    sample: {
      n: drawn.n, cap: drawn.cap, capLifted: drawn.capLifted,
      byClass: tally(smp, 'cls'), byArchetype: tally(smp, 'archetype'), byLearned: tally(smp, 'learned'),
      maxPerBattle: Math.max(...Object.values(tally(smp, 'battleId'))), battles: Object.keys(tally(smp, 'battleId')).length,
      arm2: arm2Targets.length, withDonor: Object.values(donors).filter(Boolean).length,
      donorPairing: tally(Object.values(donors).filter(Boolean), 'pairing'),
      arm2WithEquipped: arm2Targets.filter((s) => s.hasRules || s.hasLeans).length,
    },
  }, null, 1));
}

// ---------------------------------------------------------------- pilot (synchronous, ≤10 billable calls)

function seededPick(list, rand) { return list[Math.floor(rand() * list.length)]; }

async function pilot(flags) {
  const { dir, manifestPath } = resolveRun(flags);
  const manifest = readJson(manifestPath);
  if (manifest.pilot && !flags.force) stop('this run already has a pilot record (pass --force to redo it, which spends again).');
  const { env } = loadEnv();
  const apiKey = anthropicKey(env);
  const sources = loadSources(dir);
  const ticks = manifest.sample.ticks;

  // Production model (G1): every sampled request carries the same one.
  const prodIds = [...new Set(ticks.map((t) => t.model))];
  if (prodIds.length !== 1) stop(`sampled requests carry ${prodIds.length} models: ${prodIds.join(', ')}`);
  const prodId = prodIds[0];

  const models = await listModels(apiKey);
  const ladder = [];
  const skipped = [];
  for (const target of LADDER_TARGETS) {
    const hit = models.find((m) => m.display === target.display);
    if (!hit) { skipped.push({ target: target.display, reason: 'not listed by GET /v1/models' }); continue; }
    if (hit.id === prodId || prodId.startsWith(`${hit.id}-`)) { skipped.push({ target: target.display, reason: 'is the production model' }); continue; }
    ladder.push({ key: target.priceKey, display: target.display, modelId: hit.id, priceKey: target.priceKey, dropParams: [], rejected: null });
  }

  const rand = rng(SEED + 3);
  const arm2 = ticks.filter((t) => t.learned === 'learned' && t.donor);
  const withEquip = arm2.filter((t) => t.hasEquipped);
  const memTick = withEquip.length ? seededPick(withEquip, rand) : arm2.length ? seededPick(arm2, rand) : null;
  const prodTicks = shuffle(ticks, rand).slice(0, 3);
  const donorTexts = readJson(path.join(dir, 'donor-learned-texts.json'));

  const calls = [];
  let billable = 0; let attempts = 0;
  const send = async (label, model, req, meta) => {
    if (billable >= PILOT_BILLABLE_MAX || attempts >= PILOT_ATTEMPT_MAX) return { skipped: 'pilot cap' };
    attempts += 1;
    const t0 = Date.now();
    const r = await api(apiKey, 'POST', '/v1/messages', req);
    const row = { label, model, status: r.status, ms: Date.now() - t0, requestId: r.requestId, ...meta };
    if (r.status === 200) {
      billable += 1;
      const schema = req.tools?.[0]?.input_schema;
      row.usage = r.json.usage; row.stopReason = r.json.stop_reason; row.returnedModel = r.json.model;
      row.key = decisionKey(r.json, schema);
      row.contentTypes = (r.json.content || []).map((c) => c.type);
    } else {
      row.errorType = r.json?.error?.type ?? null;
      row.errorMessage = String(r.json?.error?.message ?? '').slice(0, 300);
    }
    calls.push(row);
    writeFileSync(path.join(dir, 'pilot-responses.jsonl'), `${JSON.stringify({ ...row, response: r.json })}\n`, { flag: 'a' });
    return row;
  };

  for (const t of prodTicks) await send(`prod:${t.k}`, 'prod', batchParams(sources[t.k].request), { k: t.k, arm: 'base' });

  const ladderTick = prodTicks[0];
  for (const m of ladder) {
    for (let tries = 0; tries < 4; tries += 1) {
      const req = ladderRequest(sources[ladderTick.k].request, m.modelId, m.dropParams);
      const row = await send(`ladder:${m.key}`, m.key, req, { k: ladderTick.k, arm: 'ladder', dropParams: [...m.dropParams] });
      if (row.skipped || row.status === 200) break;
      if (row.status !== 400) { m.rejected = `HTTP ${row.status}: ${row.errorMessage}`; break; }
      const param = SAMPLING_PARAMS.find((p) => !m.dropParams.includes(p) && Object.hasOwn(req, p) && row.errorMessage.includes(p));
      if (param) { m.dropParams.push(param); continue; }
      m.rejected = row.errorMessage; // a non-sampling field: not ours to change → SKIPPED
      break;
    }
  }

  const edits = {};
  if (memTick) {
    const src = sources[memTick.k].request;
    for (const v of ['strip', 'swap', 'loadout']) {
      if (v === 'loadout' && !memTick.hasEquipped) { edits[v] = { skipped: 'pilot tick has nothing equipped' }; continue; }
      const { request, removed, added } = applyVariant(src, v, { donorPart: v === 'swap' ? donorTexts[memTick.donor.learnedHash] : null });
      assertOnlySpansMoved(src, request);
      edits[v] = { removed, added };
      await send(`memory:${v}`, 'prod', batchParams(request), { k: memTick.k, arm: 'memory', variant: v });
    }
  }

  // Per-model token measures from the pilot.
  const perModel = {};
  for (const c of calls.filter((x) => x.status === 200)) {
    const row = perModel[c.model] || (perModel[c.model] = { n: 0, input: [], output: [], cacheWrite: 0, cacheRead: 0 });
    row.n += 1; row.input.push(c.usage.input_tokens); row.output.push(c.usage.output_tokens);
    row.cacheWrite += c.usage.cache_creation_input_tokens || 0; row.cacheRead += c.usage.cache_read_input_tokens || 0;
  }
  const summary = Object.fromEntries(Object.entries(perModel).map(([k, v]) => [k, { n: v.n, meanInput: mean(v.input), meanOutput: mean(v.output), cacheWriteTokens: v.cacheWrite, cacheReadTokens: v.cacheRead }]));
  const pilotSpendUsd = calls.filter((c) => c.status === 200).reduce((s, c) => {
    const p = c.model === 'prod' ? PRICES[priceKeyOf(prodId)] : PRICES[c.model];
    return s + (c.usage.input_tokens * p.stdIn + c.usage.output_tokens * p.stdOut) / 1e6;
  }, 0);
  for (const m of ladder) if (m.rejected) skipped.push({ target: m.display, reason: `rejected the request in the pilot: ${m.rejected}` });

  manifest.pilot = {
    at: new Date().toISOString(), prodId, prodPriceKey: priceKeyOf(prodId), modelsListed: models.length,
    ladder: ladder.map((m) => ({ ...m })), skipped, billable, attempts, calls,
    perModel: summary, edits, memTick: memTick?.k ?? null, pilotSpendUsd,
  };
  writeJsonAtomic(manifestPath, manifest);
  const runPlan = computeRunPlan(manifest);
  manifest.runPlan = runPlan;
  writeJsonAtomic(manifestPath, manifest);
  console.log(JSON.stringify({ pilot: { ...manifest.pilot, calls: calls.map((c) => ({ label: c.label, status: c.status, key: c.key?.fine ?? null, why: c.key?.why ?? null, usage: c.usage ?? null, stopReason: c.stopReason ?? null, contentTypes: c.contentTypes ?? null, error: c.errorMessage ?? null, dropParams: c.dropParams ?? null })) }, runPlan: summarizePlan(runPlan) }, null, 1));
}

/** claude-haiku-4-5-20251001 → claude-haiku-4-5 (the price table key). */
export function priceKeyOf(modelId) {
  const k = Object.keys(PRICES).find((p) => modelId === p || modelId.startsWith(`${p}-`));
  if (!k) stop(`no batch price recorded for ${modelId}`);
  return k;
}

/** Token estimates, repeats and caps → the run plan. */
function computeRunPlan(manifest) {
  const { pilot: pl, sample } = manifest;
  const ticks = sample.ticks;
  const prodEst = pl.perModel.prod;
  if (!prodEst) stop('the pilot produced no successful production-model call');
  const captured = ticks.filter((t) => Number.isFinite(t.capturedInputTokens));
  const capIn = mean(captured.map((t) => t.capturedInputTokens));
  const capOut = mean(captured.map((t) => t.capturedOutputTokens).filter(Number.isFinite));
  const maxTokens = Math.max(...ticks.map((t) => t.maxTokens));
  const cacheMultiplier = manifest.gate.shape.cacheControl > 0 ? 1.25 : 1;
  // Planned uses the pilot's tokens; the conservative figure uses the larger of the pilot's and the captured mean.
  const prodPilotIn = pl.calls.find((c) => c.model === 'prod' && c.status === 200 && c.k === pl.calls.find((x) => x.arm === 'ladder')?.k)?.usage?.input_tokens ?? prodEst.meanInput;
  const est = { pilot: {}, conservative: {} };
  est.pilot.prod = { input: prodEst.meanInput, output: prodEst.meanOutput, maxTokens, cacheMultiplier };
  est.conservative.prod = { input: Math.max(prodEst.meanInput, capIn ?? 0), output: Math.max(prodEst.meanOutput, capOut ?? 0), maxTokens, cacheMultiplier };
  const ladder = pl.ladder.filter((m) => !m.rejected && pl.perModel[m.key]);
  for (const m of ladder) {
    const ratio = pl.perModel[m.key].meanInput / prodPilotIn; // the same tick on both models: the tokenizer ratio
    const e = { input: prodEst.meanInput * ratio, output: pl.perModel[m.key].meanOutput, maxTokens, cacheMultiplier };
    est.pilot[m.key] = e;
    est.conservative[m.key] = { ...e, input: est.conservative.prod.input * ratio };
    if (est.conservative[m.key].input > 100_000) stop(`${m.display} prompts exceed the 100K-token price card`);
  }
  const priceOf = (key) => PRICES[key === 'prod' ? pl.prodPriceKey : key];
  const fullN = ticks.length;
  const repeats = fullN >= 150 ? { base: 10, memory: 10, ladder: 5 } : { base: 20, memory: 20, ladder: 10 };
  const hasOpus = ladder.some((m) => m.key === 'claude-opus-5-5');
  const picks = ticks.map((t) => ({ ...t }));
  const evaluate = (cfg) => {
    const s = reduceSample(picks, cfg.n);
    const arm2 = s.filter((t) => t.learned === 'learned');
    const variants = ['strip', 'swap', ...(cfg.loadout ? ['loadout'] : [])];
    const lad = ladder.filter((m) => cfg.opus || m.key !== 'claude-opus-5-5')
      .map((m) => ({ key: m.key, repeats: m.key === 'claude-opus-5-5' && cfg.opusRepeats ? cfg.opusRepeats : repeats.ladder }));
    const tasks = buildTasks({ sample: s, arm2, variants, repeats, ladder: lad });
    const a = costOf(tasks, est.pilot, priceOf);
    const b = costOf(tasks, est.conservative, priceOf);
    // Caps bind on the larger (more conservative) of the two estimates.
    const cost = { planned: Math.max(a.planned, b.planned), worst: Math.max(a.worst, b.worst) };
    return { tasks, cost, pilotCost: a, conservativeCost: b, sampleKeys: s.map((t) => t.k), variants, ladder: lad };
  };
  const fit = fitToCaps({ fullN, hasOpus, evaluate });
  return {
    repeats, est, capturedMeans: { input: capIn, output: capOut }, maxTokens, cacheMultiplier,
    cfg: fit.cfg, cuts: fit.cuts, over: Boolean(fit.over), cost: fit.cost,
    pilotCost: { planned: fit.pilotCost.planned, worst: fit.pilotCost.worst, byArm: fit.pilotCost.byArm },
    conservativeCost: { planned: fit.conservativeCost.planned, worst: fit.conservativeCost.worst, byArm: fit.conservativeCost.byArm },
    sampleKeys: fit.sampleKeys, variants: fit.variants, ladder: fit.ladder,
    tasks: fit.tasks.map((t) => [t.k, t.arm, t.variant, t.model, t.rep]),
    ladderIds: Object.fromEntries(pl.ladder.map((m) => [m.key, { modelId: m.modelId, dropParams: m.dropParams, rejected: m.rejected }])),
    prodId: pl.prodId,
  };
}

function summarizePlan(rp) {
  return {
    cfg: rp.cfg, cuts: rp.cuts, over: rp.over, repeats: rp.repeats,
    requests: rp.tasks.length,
    capUsd: rp.cost, pilotEstimate: { planned: round(rp.pilotCost.planned, 2), worst: round(rp.pilotCost.worst, 2) },
    conservativeEstimate: { planned: round(rp.conservativeCost.planned, 2), worst: round(rp.conservativeCost.worst, 2) },
    byArm: Object.fromEntries(Object.entries(rp.conservativeCost.byArm).map(([k, v]) => [k, { requests: v.requests, planned: round(v.planned, 2), worst: round(v.worst, 2) }])),
    est: rp.est, capturedMeans: rp.capturedMeans,
  };
}

// ---------------------------------------------------------------- submit

function requestFor(task, sources, manifest, donorTexts) {
  const [k, arm, variant, model] = task;
  const src = sources[k].request;
  if (arm === 'base') return batchParams(src);
  if (arm === 'memory') {
    const t = manifest.sample.ticks.find((x) => x.k === k);
    const { request } = applyVariant(src, variant, { donorPart: variant === 'swap' ? donorTexts[t.donor.learnedHash] : null });
    assertOnlySpansMoved(src, request);
    return batchParams(request);
  }
  const lad = manifest.runPlan.ladderIds[model];
  return ladderRequest(src, lad.modelId, lad.dropParams);
}

async function submit(flags) {
  if (!flags.go) stop('submit needs --go (the founder\'s checkpoint answer).');
  const { dir, manifestPath } = resolveRun(flags);
  const manifest = readJson(manifestPath);
  const rp = manifest.runPlan;
  if (!rp) stop('no run plan — run `pilot` first.');
  if (rp.over) stop('the plan is over a cap after every cut.');
  if (rp.cost.planned > CAPS.plannedUsd || rp.cost.worst > CAPS.worstUsd) stop(`plan over cap: planned $${rp.cost.planned.toFixed(2)}, worst $${rp.cost.worst.toFixed(2)}`);
  const { env } = loadEnv();
  const apiKey = anthropicKey(env);
  const sources = loadSources(dir);
  const donorTexts = readJson(path.join(dir, 'donor-learned-texts.json'));
  manifest.batches = manifest.batches || [];
  const done = new Set(manifest.batches.flatMap((b) => b.taskIdx));

  // Unique request bodies (repeats are identical requests) — written once for the record.
  const uniq = {};
  const reqDir = path.join(dir, 'requests');
  mkdirSync(reqDir, { recursive: true });
  const uniqueLines = [];
  const lines = [];
  rp.tasks.forEach((task, i) => {
    if (done.has(i)) return;
    const [k, arm, variant, model] = task;
    const uk = `${k}|${arm}|${variant}|${model}`;
    if (!uniq[uk]) {
      uniq[uk] = requestFor(task, sources, manifest, donorTexts);
      uniqueLines.push(JSON.stringify({ uk, params: uniq[uk] }));
    }
    lines.push({ i, json: JSON.stringify({ custom_id: `gr_${String(i).padStart(6, '0')}`, params: uniq[uk] }) });
  });
  if (uniqueLines.length) writeFileSync(path.join(reqDir, `unique-requests-${Date.now()}.jsonl`), `${uniqueLines.join('\n')}\n`);

  // Chunk: ≤10,000 requests and ≤100 MB per batch (uploads kept to ~40 MB).
  const chunks = [];
  let cur = []; let bytes = 0;
  for (const l of lines) {
    const b = Buffer.byteLength(l.json, 'utf8') + 1;
    if (cur.length && (cur.length >= BATCH_MAX_REQUESTS || bytes + b > Math.min(BATCH_TARGET_BYTES, BATCH_MAX_BYTES - 1024))) { chunks.push(cur); cur = []; bytes = 0; }
    cur.push(l); bytes += b;
  }
  if (cur.length) chunks.push(cur);
  console.log(`[growth-replay] ${lines.length} request(s) to submit in ${chunks.length} batch(es)`);

  for (const chunk of chunks) {
    if (Date.now() > Date.parse(CAPS.deadlineIso)) stop(`the batch deadline ${CAPS.deadlineIso} has passed; ${manifest.batches.length} batch(es) were created.`);
    const body = `{"requests":[${chunk.map((l) => l.json).join(',')}]}`;
    const r = await api(apiKey, 'POST', '/v1/messages/batches', body);
    if (r.status !== 200) stop(`batch create returned HTTP ${r.status}: ${String(r.json?.error?.message ?? '').slice(0, 300)}`);
    manifest.batches.push({ batchId: r.json.id, createdAt: new Date().toISOString(), count: chunk.length, bytes: Buffer.byteLength(body, 'utf8'), taskIdx: chunk.map((l) => l.i), status: r.json.processing_status, kind: 'main' });
    writeJsonAtomic(manifestPath, manifest); // written after EVERY create: no batch is ever orphaned
    console.log(`[growth-replay] created ${r.json.id} (${chunk.length} requests)`);
  }
}

// ---------------------------------------------------------------- status

async function status(flags) {
  const { manifestPath } = resolveRun(flags);
  const { env } = loadEnv();
  const apiKey = anthropicKey(env);
  const started = Date.now();
  for (;;) {
    const manifest = readJson(manifestPath);
    const rows = [];
    for (const b of manifest.batches || []) {
      if (b.deleted) { rows.push({ batchId: b.batchId, status: 'deleted (results on disk)' }); continue; }
      const r = await api(apiKey, 'GET', `/v1/messages/batches/${b.batchId}`);
      b.status = r.json?.processing_status ?? `HTTP ${r.status}`;
      b.requestCounts = r.json?.request_counts ?? null;
      b.resultsUrl = r.json?.results_url ?? null;
      rows.push({ batchId: b.batchId, status: b.status, counts: b.requestCounts });
    }
    writeJsonAtomic(manifestPath, manifest);
    console.log(`[growth-replay] ${new Date().toISOString()} ${JSON.stringify(rows)}`);
    const allEnded = rows.every((r) => r.status === 'ended' || String(r.status).startsWith('deleted'));
    if (!flags.wait || allEnded) { if (flags.wait) console.log(allEnded ? 'ALL ENDED' : ''); return; }
    if (Date.now() - started >= POLL_FOR_MS) { console.log('NOT FINISHED after 2 hours. Come back to this session later and type: collect the growth replay.'); return; }
    await new Promise((res) => setTimeout(res, POLL_EVERY_MS));
  }
}

// ---------------------------------------------------------------- collect

const RETRYABLE_ERRORS = new Set(['api_error', 'overloaded_error', 'timeout_error']);

async function collect(flags) {
  const { dir, manifestPath } = resolveRun(flags);
  const manifest = readJson(manifestPath);
  const { env } = loadEnv();
  const apiKey = anthropicKey(env);
  const resDir = path.join(dir, 'results');
  mkdirSync(resDir, { recursive: true });
  const outcomes = manifest.outcomes || {};

  for (const b of manifest.batches || []) {
    if (b.resultsSaved) continue;
    const r = await api(apiKey, 'GET', `/v1/messages/batches/${b.batchId}`);
    if (r.json?.processing_status !== 'ended') { console.log(`[growth-replay] ${b.batchId} is ${r.json?.processing_status} — not collected yet`); continue; }
    const file = path.join(resDir, `${b.batchId}.jsonl`);
    const res = await fetch(r.json.results_url, { headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION } });
    if (!res.ok) stop(`results download for ${b.batchId} returned HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(`${file}.tmp`));
    renameSync(`${file}.tmp`, file);
    const resultLines = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
    if (resultLines.length !== b.count) stop(`${b.batchId}: ${resultLines.length} result lines for ${b.count} requests — kept the batch, not deleted`);
    for (const line of resultLines) {
      const row = JSON.parse(line);
      const i = Number(row.custom_id.slice(3));
      const type = row.result?.type;
      const errType = row.result?.error?.error?.type ?? row.result?.error?.type ?? null;
      const errMsg = String(row.result?.error?.error?.message ?? row.result?.error?.message ?? '');
      if (type === 'errored' && (/enforced_spend_limit_reached/.test(line) || errMsg.startsWith('You have reached your specified API usage limits'))) {
        writeJsonAtomic(manifestPath, { ...manifest, outcomes });
        stop('a result reports the API spend limit. Nothing further was submitted.', 3);
      }
      const prev = outcomes[i];
      if (prev?.type === 'succeeded') continue;
      outcomes[i] = { type, batchId: b.batchId, errType };
    }
    b.resultsSaved = true; b.resultLines = resultLines.length;
    writeJsonAtomic(manifestPath, { ...manifest, outcomes });
    const del = await api(apiKey, 'DELETE', `/v1/messages/batches/${b.batchId}`);
    b.deleted = del.status === 200;
    b.deleteStatus = del.status;
    writeJsonAtomic(manifestPath, { ...manifest, outcomes });
    console.log(`[growth-replay] ${b.batchId}: ${resultLines.length} results saved; deleted on Anthropic's side: ${b.deleted}`);
  }
  manifest.outcomes = outcomes;
  writeJsonAtomic(manifestPath, manifest);

  // One retry of server-errored requests, in a follow-up batch (caps + deadline still apply).
  const allSaved = (manifest.batches || []).every((b) => b.resultsSaved);
  const retryable = Object.entries(outcomes).filter(([, o]) => o.type === 'errored' && RETRYABLE_ERRORS.has(o.errType)).map(([i]) => Number(i));
  const already = new Set((manifest.batches || []).filter((b) => b.kind === 'retry').flatMap((b) => b.taskIdx));
  const toRetry = retryable.filter((i) => !already.has(i));
  if (allSaved && toRetry.length && !flags.noRetry) {
    if (Date.now() > Date.parse(CAPS.deadlineIso)) { console.log(`[growth-replay] ${toRetry.length} server-errored request(s) NOT retried: past the batch deadline`); return; }
    const sources = loadSources(dir);
    const donorTexts = readJson(path.join(dir, 'donor-learned-texts.json'));
    const reqs = toRetry.map((i) => JSON.stringify({ custom_id: `gr_${String(i).padStart(6, '0')}`, params: requestFor(manifest.runPlan.tasks[i], sources, manifest, donorTexts) }));
    const body = `{"requests":[${reqs.join(',')}]}`;
    if (Buffer.byteLength(body, 'utf8') > BATCH_MAX_BYTES || reqs.length > BATCH_MAX_REQUESTS) stop('the retry batch exceeds the per-batch limits');
    const r = await api(apiKey, 'POST', '/v1/messages/batches', body);
    if (r.status !== 200) stop(`retry batch create returned HTTP ${r.status}`);
    manifest.batches.push({ batchId: r.json.id, createdAt: new Date().toISOString(), count: reqs.length, bytes: Buffer.byteLength(body, 'utf8'), taskIdx: toRetry, status: r.json.processing_status, kind: 'retry' });
    writeJsonAtomic(manifestPath, manifest);
    console.log(`[growth-replay] retry batch ${r.json.id} created for ${reqs.length} server-errored request(s); run status --wait, then collect again`);
  } else {
    const summary = {};
    for (const o of Object.values(outcomes)) inc(summary, `${o.type}${o.errType ? `:${o.errType}` : ''}`);
    console.log(`[growth-replay] outcomes: ${JSON.stringify(summary)}; all batches saved: ${allSaved}`);
  }
}

// ---------------------------------------------------------------- analyze

function loadResults(dir) {
  const out = {}; // task index → { message | null }
  const resDir = path.join(dir, 'results');
  if (!existsSync(resDir)) return out;
  for (const f of readdirSync(resDir).filter((x) => x.endsWith('.jsonl'))) {
    for (const line of readFileSync(path.join(resDir, f), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      const i = Number(row.custom_id.slice(3));
      if (row.result?.type === 'succeeded') out[i] = { message: row.result.message };
      else if (!out[i]) out[i] = { message: null, type: row.result?.type, errType: row.result?.error?.error?.type ?? null };
    }
  }
  return out;
}

async function analyze(flags) {
  const st = runSelftest();
  if (!st.pass) stop(`selftest failed — not analyzing: ${JSON.stringify(st)}`);
  const { dir, manifestPath } = resolveRun(flags);
  const manifest = readJson(manifestPath);
  const rp = manifest.runPlan;
  const sources = loadSources(dir);
  const results = loadResults(dir);
  const tickMeta = Object.fromEntries(manifest.sample.ticks.map((t) => [t.k, t]));
  const schemaOf = (k) => sources[k].request.tools[0].input_schema;

  // keys[k][condition] = [{coarse, fine}] under the key of record (production's
  // validator semantics); keysStrict under the stricter request-schema key.
  const keys = {};
  const keysStrict = {};
  const usage = {};
  const requested = {}; const got = {};
  rp.tasks.forEach((task, i) => {
    const [k, arm, variant, model] = task;
    const cond = arm === 'ladder' ? `ladder:${model}` : arm === 'memory' ? `memory:${variant}` : 'base';
    inc(requested, cond);
    const r = results[i];
    if (!r?.message) return;
    inc(got, cond);
    ((keys[k] || (keys[k] = {}))[cond] || (keys[k][cond] = [])).push(decisionKey(r.message, schemaOf(k)));
    ((keysStrict[k] || (keysStrict[k] = {}))[cond] || (keysStrict[k][cond] = [])).push(decisionKey(r.message, schemaOf(k), { strict: true }));
    const u = usage[cond] || (usage[cond] = { input: [], output: [], model: arm === 'ladder' ? model : 'prod', stopReasons: {}, thinkingTokens: 0, cacheTokens: 0 });
    u.input.push(r.message.usage?.input_tokens ?? 0); u.output.push(r.message.usage?.output_tokens ?? 0);
    inc(u.stopReasons, String(r.message.stop_reason));
    u.thinkingTokens += r.message.usage?.output_tokens_details?.thinking_tokens ?? 0;
    u.cacheTokens += (r.message.usage?.cache_creation_input_tokens ?? 0) + (r.message.usage?.cache_read_input_tokens ?? 0);
  });
  const responseDiagnostics = Object.fromEntries(Object.entries(usage).map(([c, u]) => [c, { stopReasons: u.stopReasons, thinkingTokens: u.thinkingTokens, cacheTokens: u.cacheTokens }]));
  const completeness = Object.fromEntries(Object.keys(requested).map((c) => {
    const missing = 1 - (got[c] || 0) / requested[c];
    return [c, { requested: requested[c], returned: got[c] || 0, missingShare: missing, status: missing > 0.05 ? 'INCOMPLETE' : 'complete' }];
  }));

  const sampleKeys = rp.sampleKeys;
  const computeArms = (keys) => {
    // ---- Arm 1 ----
    const arm1Rows = [];
    for (const k of sampleKeys) {
      const list = keys[k]?.base || [];
      if (!list.length) continue;
      const fine = list.map((x) => x.fine); const coarse = list.map((x) => x.coarse);
      const cf = counts(fine); const cc = counts(coarse);
      const m = modal(cf); const mc = modal(cc);
      const t = tickMeta[k];
      arm1Rows.push({
        k, cls: t.cls, archetype: t.archetype, n: list.length,
        modalFine: m, shareFine: cf[m] / list.length, distinctFine: Object.keys(cf).length,
        modalCoarse: mc, shareCoarse: cc[mc] / list.length, distinctCoarse: Object.keys(cc).length,
        matchFine: fine.filter((x) => x === t.original.fine).length / list.length,
        matchCoarse: coarse.filter((x) => x === t.original.coarse).length / list.length,
        modalMatchFine: m === t.original.fine ? 1 : 0, modalMatchCoarse: mc === t.original.coarse ? 1 : 0,
        malformed: fine.filter((x) => x === MALFORMED).length / list.length,
        fineList: fine, coarseList: coarse,
      });
    }
    const arm1Summary = (rows) => ({
      ticks: rows.length,
      meanAgreementFine: mean(rows.map((r) => r.shareFine)), meanAgreementCoarse: mean(rows.map((r) => r.shareCoarse)),
      unanimousFine: mean(rows.map((r) => (r.distinctFine === 1 ? 1 : 0))), unanimousCoarse: mean(rows.map((r) => (r.distinctCoarse === 1 ? 1 : 0))),
      twoPlusFine: mean(rows.map((r) => (r.distinctFine >= 2 ? 1 : 0))), twoPlusCoarse: mean(rows.map((r) => (r.distinctCoarse >= 2 ? 1 : 0))),
      matchOriginalFine: mean(rows.map((r) => r.matchFine)), matchOriginalCoarse: mean(rows.map((r) => r.matchCoarse)),
      modalMatchOriginalFine: mean(rows.map((r) => r.modalMatchFine)), modalMatchOriginalCoarse: mean(rows.map((r) => r.modalMatchCoarse)),
      splitHalfFine: splitHalfAgreement(rows.map((r) => r.fineList)), splitHalfCoarse: splitHalfAgreement(rows.map((r) => r.coarseList)),
      malformedRate: mean(rows.map((r) => r.malformed)),
      actionRate: mean(rows.map((r) => r.coarseList.filter((x) => x === 'SWAP').length / r.n)),
    });
    const arm1 = {
      all: arm1Summary(arm1Rows),
      originalAction: arm1Summary(arm1Rows.filter((r) => r.cls === 'action')),
      originalHold: arm1Summary(arm1Rows.filter((r) => r.cls === 'hold')),
    };
    arm1.label = arm1Label(arm1.all.meanAgreementFine);

    // ---- Arm 2 ----
    const arm2 = {};
    const perTickMove = {};
    for (const v of rp.variants) {
      const cond = `memory:${v}`;
      const rows = [];
      for (const k of sampleKeys) {
        const base = keys[k]?.base; const vv = keys[k]?.[cond];
        if (!base?.length || !vv?.length) continue;
        rows.push({ k, base: base.map((x) => x.fine), variant: vv.map((x) => x.fine), pairing: tickMeta[k].donor?.pairing ?? null, archetype: tickMeta[k].archetype });
      }
      const res = permutationTest(rows, { seed: SEED + 11 });
      if (res) {
        res.label = arm2Label(res);
        rows.forEach((r, i) => { (perTickMove[r.k] || (perTickMove[r.k] = {}))[v] = res.perTickTv[i]; });
        delete res.perTickTv;
        res.coarse = (() => { const c = permutationTest(rows.map((r) => ({ base: r.base.map(toCoarse), variant: r.variant.map(toCoarse) })), { seed: SEED + 12 }); if (c) { c.label = arm2Label(c); delete c.perTickTv; } return c; })();
        // Descriptive: which way the calls moved, and the same test per archetype.
        const share = (lists, pred) => mean(lists.map((l) => l.filter(pred).length / l.length));
        res.actionRateBase = share(rows.map((r) => r.base), (x) => x.startsWith('SWAP'));
        res.actionRateVariant = share(rows.map((r) => r.variant), (x) => x.startsWith('SWAP'));
        res.malformedBase = share(rows.map((r) => r.base), (x) => x === MALFORMED);
        res.malformedVariant = share(rows.map((r) => r.variant), (x) => x === MALFORMED);
        res.byArchetype = {};
        for (const [arch, list] of Object.entries(groupBy(rows, (r) => r.archetype))) {
          const sub = permutationTest(list, { seed: SEED + 14 });
          if (sub) { sub.label = arm2Label(sub); delete sub.perTickTv; }
          res.byArchetype[arch] = sub;
        }
        if (v === 'swap') {
          for (const pairing of ['donor_same_archetype', 'donor_other_archetype']) {
            const sub = permutationTest(rows.filter((r) => r.pairing === pairing), { seed: SEED + 13 });
            if (sub) { sub.label = arm2Label(sub); delete sub.perTickTv; }
            res[pairing] = sub;
          }
        }
      }
      arm2[v] = res;
    }

    // ---- Arm 3 ----
    const arm3 = {};
    const prodModal = Object.fromEntries(arm1Rows.map((r) => [r.k, { fine: r.modalFine, coarse: r.modalCoarse }]));
    for (const m of rp.ladder) {
      const cond = `ladder:${m.key}`;
      const rows = [];
      for (const k of sampleKeys) {
        const list = keys[k]?.[cond];
        if (!list?.length || !prodModal[k]) continue;
        const cf = counts(list.map((x) => x.fine)); const cc = counts(list.map((x) => x.coarse));
        rows.push({ agreeFine: modal(cf) === prodModal[k].fine ? 1 : 0, agreeCoarse: modal(cc) === prodModal[k].coarse ? 1 : 0, self: cf[modal(cf)] / list.length, action: list.filter((x) => x.coarse === 'SWAP').length / list.length, malformed: list.filter((x) => x.fine === MALFORMED).length / list.length });
      }
      const u = usage[cond];
      const p = PRICES[m.key];
      const mi = u ? mean(u.input) : null; const mo = u ? mean(u.output) : null;
      arm3[m.key] = {
        model: rp.ladderIds[m.key].modelId, ticks: rows.length,
        modalAgreementWithProdFine: mean(rows.map((r) => r.agreeFine)), modalAgreementWithProdCoarse: mean(rows.map((r) => r.agreeCoarse)),
        selfAgreement: mean(rows.map((r) => r.self)), actionRate: mean(rows.map((r) => r.action)), malformedRate: mean(rows.map((r) => r.malformed)),
        meanInputTokens: mi, meanOutputTokens: mo,
        costPerDecisionStdUsd: mi == null ? null : (mi * p.stdIn + mo * p.stdOut) / 1e6,
        fieldsChanged: ['model', ...rp.ladderIds[m.key].dropParams.map((x) => `removed ${x}`)],
      };
    }
    const prodU = usage.base;
    const prodP = PRICES[manifest.pilot.prodPriceKey];
    arm3.production = {
      model: rp.prodId, selfAgreement: arm1.all.meanAgreementFine, actionRate: arm1.all.actionRate, malformedRate: arm1.all.malformedRate,
      meanInputTokens: prodU ? mean(prodU.input) : null, meanOutputTokens: prodU ? mean(prodU.output) : null,
      costPerDecisionStdUsd: prodU ? (mean(prodU.input) * prodP.stdIn + mean(prodU.output) * prodP.stdOut) / 1e6 : null,
    };
    return { arm1Rows, arm1Summary, arm1, arm2, perTickMove, arm3 };
  };
  const { arm1Rows, arm1Summary, arm1, arm2, perTickMove, arm3 } = computeArms(keys);
  const strictView = computeArms(keysStrict);
  const sensitivityStrictDeclarations = {
    note: 'the same arms with `declarations` also validated (the request\'s own schema) — stricter than production',
    arm1: { meanAgreementFine: strictView.arm1.all.meanAgreementFine, malformedRate: strictView.arm1.all.malformedRate, label: strictView.arm1.label },
    arm2: Object.fromEntries(Object.entries(strictView.arm2).map(([v, r]) => [v, r && { T: r.T, nullMean: r.nullMean, p: r.p, excessFlip: r.excessFlip, label: r.label }])),
    arm3: Object.fromEntries(Object.entries(strictView.arm3).map(([m, r]) => [m, { modalAgreementWithProdFine: r.modalAgreementWithProdFine ?? null, selfAgreement: r.selfAgreement, malformedRate: r.malformedRate }])),
  };

  // ---- Spend from usage (batch prices) ----
  const spend = { byCondition: {}, totalUsd: 0 };
  for (const [cond, u] of Object.entries(usage)) {
    const p = PRICES[u.model === 'prod' ? manifest.pilot.prodPriceKey : u.model];
    const usd = (u.input.reduce((s, x) => s + x, 0) * p.batchIn + u.output.reduce((s, x) => s + x, 0) * p.batchOut) / 1e6;
    spend.byCondition[cond] = round(usd, 4); spend.totalUsd += usd;
  }
  spend.pilotUsd = manifest.pilot.pilotSpendUsd;
  spend.grandTotalUsd = spend.totalUsd + spend.pilotUsd;

  // ---- edit sizes (chars removed / added per edited request) ----
  const donorTexts = readJson(path.join(dir, 'donor-learned-texts.json'));
  const editSizes = {};
  for (const v of rp.variants) {
    const rows = [];
    for (const k of sampleKeys) {
      const t = tickMeta[k];
      if (t.learned !== 'learned' || (v === 'swap' && !t.donor) || (v === 'loadout' && !t.hasEquipped)) continue;
      const { removed, added } = applyVariant(sources[k].request, v, { donorPart: v === 'swap' ? donorTexts[t.donor.learnedHash] : null });
      rows.push({ removed, added });
    }
    editSizes[v] = { requests: rows.length, meanRemoved: mean(rows.map((r) => r.removed)), meanAdded: mean(rows.map((r) => r.added)), maxRemoved: Math.max(0, ...rows.map((r) => r.removed)), maxAdded: Math.max(0, ...rows.map((r) => r.added)) };
  }

  const analysis = { runId: manifest.runId, at: new Date().toISOString(), selftest: st, completeness, responseDiagnostics, arm1, arm2, arm3, sensitivityStrictDeclarations, spend, editSizes, arm1ByArchetype: byArchetypeArm1(arm1Rows, arm1Summary) };
  writeJsonAtomic(path.join(dir, 'analysis.json'), analysis);
  writeExhibits(dir, manifest, sources, donorTexts, keys, perTickMove);
  console.log(JSON.stringify({ ...analysis, arm1ByArchetype: undefined }, null, 1));
}

const toCoarse = (fine) => (fine === MALFORMED ? MALFORMED : fine.startsWith('SWAP') ? 'SWAP' : fine);

function byArchetypeArm1(rows, summarize) {
  const g = groupBy(rows, (r) => r.archetype);
  return Object.fromEntries(Object.entries(g).map(([a, list]) => [a, { ticks: list.length, meanAgreementFine: summarize(list).meanAgreementFine }]));
}

/** The local-only exhibits file: contains player text; never committed. */
function writeExhibits(dir, manifest, sources, donorTexts, keys, perTickMove) {
  const dist = (list) => (list?.length ? Object.entries(counts(list.map((x) => x.fine))).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}×${n}`).join(', ') : '—');
  const top = Object.entries(perTickMove).filter(([, v]) => v.strip != null).sort((a, b) => b[1].strip - a[1].strip).slice(0, 10);
  const out = ['# Growth Replay — exhibits (LOCAL ONLY: contains player text; never commit)', '', `Run ${manifest.runId}.`, ''];
  out.push('## The 10 ticks where removing what the agent learned moved the decision most', '');
  for (const [i, [k, mv]] of top.entries()) {
    const t = manifest.sample.ticks.find((x) => x.k === k);
    const req = sources[k].request;
    out.push(`### ${i + 1}. ${t.archetype} — originally ${t.original.fine} — strip distance ${mv.strip.toFixed(2)}`, '');
    out.push(`- battle/tick: \`${k}\``, `- baseline: ${dist(keys[k]?.base)}`, `- strip: ${dist(keys[k]?.['memory:strip'])}`, `- swap (${t.donor?.pairing ?? 'no donor'}): ${dist(keys[k]?.['memory:swap'])}`, '');
    out.push('What the agent had learned (the LEARNED section as sent):', '', '```text', learnedPartText(req) ?? '(none)', '```', '');
  }
  out.push('## Before and after: three edited requests, checked by eye', '');
  const ticks = manifest.sample.ticks.filter((t) => t.learned === 'learned' && t.donor);
  const showcase = [['strip', ticks[0]], ['swap', ticks[1] || ticks[0]], ['loadout', ticks.find((t) => t.hasEquipped)]];
  for (const [v, t] of showcase) {
    if (!t) { out.push(`### ${v}: no eligible tick`, ''); continue; }
    const src = sources[t.k].request;
    const { request, removed, added } = applyVariant(src, v, { donorPart: v === 'swap' ? donorTexts[t.donor.learnedHash] : null });
    out.push(`### ${v} — \`${t.k}\` (${removed} chars removed, ${added} added)`, '');
    out.push('Identity block BEFORE:', '', '```text', src.messages[0].content, '```', '', 'Identity block AFTER:', '', '```text', request.messages[0].content, '```', '');
    if (v === 'loadout' && t.hasLeans) {
      const leans = findLeans(src.messages[2].content);
      out.push('Standing-leans block removed from the live context:', '', '```text', src.messages[2].content.slice(leans.span.start, leans.span.end), '```', '');
    }
  }
  writeFileSync(path.join(dir, 'GROWTH_REPLAY_EXHIBITS.local.md'), out.join('\n'));
}

// ---------------------------------------------------------------- selftest

/** Synthetic arm-2 data: pure noise must read "no measurable effect"; a planted 30% shift must read "moves decisions". */
export function runSelftest() {
  const rand = rng(SEED ^ 0x51f7e57);
  const KEYS = ['HOLD', 'SWAP:AAA>BBB', 'SWAP:CCC>DDD', MALFORMED];
  const draw = (w) => { const u = rand() * w.reduce((s, x) => s + x, 0); let acc = 0; for (let i = 0; i < w.length; i += 1) { acc += w[i]; if (u < acc) return KEYS[i]; } return KEYS[KEYS.length - 1]; };
  const makeDataset = (plantShare) => {
    const ticks = [];
    for (let i = 0; i < 150; i += 1) {
      const w = [3 + 6 * rand(), rand(), rand() * 0.6, rand() * 0.1]; // HOLD-dominant, like the brain
      const planted = rand() < plantShare;
      const shifted = [0.2, 0.1, 3, 0.05]; // a planted tick moves to a different decision
      ticks.push({ base: Array.from({ length: 10 }, () => draw(w)), variant: Array.from({ length: 10 }, () => draw(planted ? shifted : w)) });
    }
    return ticks;
  };
  const noise = permutationTest(makeDataset(0), { seed: SEED + 21 });
  const planted = permutationTest(makeDataset(0.3), { seed: SEED + 22 });
  // Calibration: how often pure noise crosses p < 0.05 over 20 fresh datasets (expected ≈ 5%).
  let falsePositives = 0;
  for (let i = 0; i < 20; i += 1) if (permutationTest(makeDataset(0), { seed: SEED + 100 + i, permutations: 500 }).p < 0.05) falsePositives += 1;
  const res = {
    noise: { T: round(noise.T), nullMean: round(noise.nullMean), nullP95: round(noise.nullP95), p: round(noise.p), excessFlip: round(noise.excessFlip), label: arm2Label(noise) },
    planted: { T: round(planted.T), nullMean: round(planted.nullMean), nullP95: round(planted.nullP95), p: round(planted.p), excessFlip: round(planted.excessFlip), label: arm2Label(planted) },
    noiseFalsePositivesOf20: falsePositives,
    arm1Labels: { '0.95': arm1Label(0.95), '0.80': arm1Label(0.80), '0.50': arm1Label(0.50) },
  };
  res.pass = res.noise.label === 'no measurable effect' && res.planted.label === 'moves decisions'
    && res.arm1Labels['0.95'] === 'steady' && res.arm1Labels['0.80'] === 'wobbly' && res.arm1Labels['0.50'] === 'noisy';
  return res;
}

// ---------------------------------------------------------------- CLI

export function parseArgs(argv) {
  const flags = { cmd: argv[2] || 'help', run: null, go: false, wait: false, force: false, noRetry: false };
  for (let i = 3; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--run') flags.run = argv[++i];
    else if (a === '--go') flags.go = true;
    else if (a === '--wait') flags.wait = true;
    else if (a === '--force') flags.force = true;
    else if (a === '--no-retry') flags.noRetry = true;
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv);
  switch (flags.cmd) {
    case 'plan': return plan();
    case 'pilot': return pilot(flags);
    case 'submit': return submit(flags);
    case 'status': return status(flags);
    case 'collect': return collect(flags);
    case 'analyze': return analyze(flags);
    case 'selftest': {
      const r = runSelftest();
      console.log(JSON.stringify(r, null, 1));
      if (!r.pass) process.exitCode = 1;
      return undefined;
    }
    default:
      console.log('growthReplay — subcommands: plan | pilot | submit --go | status [--wait] | collect | analyze | selftest  (options: --run <runId>)');
      return undefined;
  }
}

// CLI entrypoint only — importing this module runs nothing.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => { console.error(err?.stack || String(err)); process.exit(1); });
}
