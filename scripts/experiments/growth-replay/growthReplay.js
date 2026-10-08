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
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync, createWriteStream, unlinkSync } from 'node:fs';
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
const BATCH_MAX_BYTES = 100_000_000; // the prompt's 100 MB, decimal (review C5)
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

/**
 * Lookup order: the real environment, then this tree's .env.local, then the
 * primary checkout's. Nothing is copied. `rank` records where each key came
 * from (0 = environment, 1.. = file order) so a credential can be chosen as a
 * WHOLE from the highest-priority source (review C11).
 */
function loadEnv() {
  const files = [path.join(PROJECT_ROOT, '.env.local')];
  const primary = primaryCheckoutRoot(PROJECT_ROOT);
  if (primary) files.push(path.join(primary, '.env.local'));
  const merged = {};
  const rank = {};
  const used = [];
  files.forEach((f, i) => {
    if (!existsSync(f)) return;
    used.push(f);
    for (const [k, v] of Object.entries(parseEnvText(readFileSync(f, 'utf8')))) if (merged[k] === undefined) { merged[k] = v; rank[k] = i + 1; }
  });
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && v !== '') { merged[k] = v; rank[k] = 0; }
  return { env: merged, rank, used };
}

/** Error text is printed only after this: an API key or a PEM body never reaches the console (review C4). */
export function redactSecrets(text) {
  return String(text)
    .replace(/sk-ant-[^\s"'`]*/g, 'sk-ant-[REDACTED]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[REDACTED PRIVATE KEY]')
    .replace(/"private_key"\s*:\s*"[^"]*"?/g, '"private_key":"[REDACTED]"');
}

function stop(message, code = 2) {
  console.error(`\nSTOP: ${redactSecrets(message)}`);
  releaseLock();
  process.exit(code);
}

/** The variable the production brain call site reads (api/cron/agent-evaluate.js:229). */
const KEY_FORMAT = /^sk-ant-[A-Za-z0-9_-]+$/;
function anthropicKey(env) {
  const key = env.CLAUDE_API_KEY;
  if (typeof key !== 'string' || !key.startsWith('sk-ant-')) stop('CLAUDE_API_KEY is not set (checked the environment, this tree\'s .env.local, then the primary checkout\'s .env.local).');
  // A key with a stray newline or quote would otherwise reach a fetch Headers error verbatim.
  if (!KEY_FORMAT.test(key)) stop('CLAUDE_API_KEY is malformed (unexpected characters; value not printed).');
  return key;
}

/** The service account, chosen as a whole from the highest-priority source; every failure is a fixed message. */
function serviceAccount(env, rank = {}) {
  const hasJson = Boolean(env.FIREBASE_ADMIN_CREDENTIALS);
  const hasSplit = Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
  const splitRank = Math.max(rank.FIREBASE_PROJECT_ID ?? 9, rank.FIREBASE_CLIENT_EMAIL ?? 9, rank.FIREBASE_PRIVATE_KEY ?? 9);
  const useJson = hasJson && (!hasSplit || (rank.FIREBASE_ADMIN_CREDENTIALS ?? 9) <= splitRank);
  if (useJson) {
    let sa = null;
    try { sa = JSON.parse(env.FIREBASE_ADMIN_CREDENTIALS); } catch { sa = null; }
    if (!sa || typeof sa !== 'object' || Array.isArray(sa) || typeof sa.private_key !== 'string' || typeof sa.project_id !== 'string') {
      stop('FIREBASE_ADMIN_CREDENTIALS is not a service-account JSON object (value not printed).');
    }
    return sa;
  }
  if (hasSplit) return { project_id: env.FIREBASE_PROJECT_ID, client_email: env.FIREBASE_CLIENT_EMAIL, private_key: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') };
  return stop('FIREBASE_ADMIN_CREDENTIALS is not set (checked the environment, this tree\'s .env.local, then the primary checkout\'s .env.local).');
}

async function openFirestore(env, rank) {
  const sa = serviceAccount(env, rank);
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  let credential;
  try { credential = cert(sa); } catch { stop('the Firebase service account was rejected by firebase-admin (value not printed).'); }
  const app = initializeApp({ credential }, 'growth-replay');
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

/**
 * Everything outside the variant's targeted spans must be byte-identical (review A4: the
 * check now reaches INSIDE the two message contents, not just around them). For each
 * edited content, the changed region — between the common prefix and the common suffix
 * of before/after — must lie within the span the variant targets in the BEFORE text;
 * a content the variant does not target must be unchanged.
 */
export function assertOnlySpansMoved(before, after, variant) {
  const strip = (r) => JSON.stringify({ ...r, messages: r.messages.map((m, i) => (i === 0 || i === 2 ? { ...m, content: null } : m)) });
  if (strip(before) !== strip(after)) throw new Error('an edit moved bytes outside the targeted message contents');
  const identity = parseIdentity(before.messages[0].content);
  const leans = findLeans(before.messages[2].content);
  const allowed = {
    0: variant === 'loadout' ? identity.rules : (variant === 'strip' || variant === 'swap') ? identity.learned : null,
    2: variant === 'loadout' && leans.status === 'present' ? leans.span : null,
  };
  for (const i of [0, 2]) {
    const a = before.messages[i].content; const b = after.messages[i].content;
    if (a === b) continue;
    const span = allowed[i];
    if (!span) throw new Error(`${variant}: messages[${i}] changed but the variant targets nothing there`);
    let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p += 1;
    let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s += 1;
    if (p < span.start || a.length - s > span.end) throw new Error(`${variant}: messages[${i}] changed outside its targeted span`);
  }
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
  // The FIRST tool_use block of any name, exactly as production reads it
  // (agent-evaluate.js:2935, review A7); a wrong-named block fails validation there too.
  const block = Array.isArray(message?.content) ? message.content.find((b) => b?.type === 'tool_use') : null;
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

/**
 * Most frequent key; ties broken by the lexically smallest key (applied identically
 * everywhere). `largest: true` is the opposite deterministic rule, used only for the
 * tie-rule sensitivity check (review B9).
 */
export function modal(c, { largest = false } = {}) {
  let best = null; let bestN = -1;
  const order = largest ? sortedKeys(c).reverse() : sortedKeys(c);
  for (const k of order) if (c[k] > bestN) { best = k; bestN = c[k]; }
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
export function permutationTest(ticks, { permutations = PERMUTATIONS, seed = SEED, tieLargest = false } = {}) {
  const usable = ticks.filter((t) => t.base.length && t.variant.length);
  if (!usable.length) return null;
  const md = (c) => modal(c, { largest: tieLargest });
  const obsTv = usable.map((t) => tvDistance(counts(t.base), counts(t.variant)));
  const obsFlip = usable.map((t) => (md(counts(t.base)) !== md(counts(t.variant)) ? 1 : 0));
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
      sF += md(a) !== md(b) ? 1 : 0;
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
    flipRate: flip, flips: obsFlip.reduce((s, x) => s + x, 0), nullFlipRate: nullFlipMean, excessFlip: flip - nullFlipMean,
    perTickTv: obsTv,
  };
}

/**
 * Descriptive noise floor for the modal-flip rate (review B1): the flip rate two
 * groups of the given sizes would show if BOTH were drawn from each tick's own
 * baseline distribution (a parametric bootstrap of 'no effect'). Unlike the
 * permutation null, it does not pool in the variant, so it does not grow with the
 * effect being measured. Reported beside the frozen excess-flip figure; it sets no label.
 */
export function noEffectFlipFloor(baseLists, { nA = 10, nB = 10, draws = 500, seed = SEED } = {}) {
  const rand = rng(seed + 41);
  const per = [];
  for (const keys of baseLists) {
    if (!keys.length) continue;
    let flips = 0;
    for (let d = 0; d < draws; d += 1) {
      const a = []; const b = [];
      for (let i = 0; i < nA; i += 1) a.push(keys[Math.floor(rand() * keys.length)]);
      for (let i = 0; i < nB; i += 1) b.push(keys[Math.floor(rand() * keys.length)]);
      if (modal(counts(a)) !== modal(counts(b))) flips += 1;
    }
    per.push(flips / draws);
  }
  return mean(per);
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
    // Two greedy orders (review B6): actions first (the original), and holds first, which
    // cannot spend a hold-supplying battle's cap on actions. The more balanced wins; a tie
    // keeps actions-first, so a corpus that drew its sample under the original rule redraws it.
    const run = (first) => {
      for (const key of Object.keys(taken)) delete taken[key];
      for (const key of Object.keys(ptr)) delete ptr[key];
      picks.length = 0;
      const second = first === 'action' ? 'hold' : 'action';
      const x = pick(first, first === 'action' ? Math.floor(n / 2) : n - Math.floor(n / 2));
      const y = pick(second, n - x);
      if (x + y < n) pick(first, n - x - y);
      return picks.length === n ? picks.map((p, i) => ({ ...p, order: i })) : null;
    };
    const balance = (ps) => (ps ? Math.abs(ps.filter((p) => p.cls === 'action').length - n / 2) : Infinity);
    const actionFirst = run('action');
    const holdFirst = run('hold');
    if (!actionFirst && !holdFirst) return null;
    return balance(holdFirst) < balance(actionFirst) ? holdFirst : actionFirst;
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

/**
 * Reduction to n ticks for a budget cut: a seeded REDRAW from the sample under the same
 * rules (round-robin, 15%-of-n cap, balance), so the cap holds at the smaller n (review B5).
 */
export function reduceSample(picks, n) {
  if (n >= picks.length) return picks;
  return drawSample(picks, { target: n, seed: SEED + 51 }).picks;
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

/** The key is only ever sent to the Anthropic origin (review C12: results_url is checked too). */
function anthropicUrl(urlPath) {
  const url = new URL(urlPath, ANTHROPIC);
  if (url.origin !== ANTHROPIC) stop(`refusing to send the API key to ${url.origin}`);
  return url.href;
}

async function api(apiKey, method, urlPath, body) {
  let res;
  try {
    res = await fetch(anthropicUrl(urlPath), {
      method,
      headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
  } catch (err) {
    // A fetch-level error can quote header values; a fixed message never can (review C4).
    const e = new Error(`network error on ${method} ${urlPath.split('?')[0]}: ${redactSecrets(err?.cause?.code || err?.name || 'unknown')}`);
    e.transient = true;
    throw e;
  }
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
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 1));
  renameSync(tmp, p);
}

/**
 * One command at a time per run (review C3): every command that writes the
 * manifest takes this lock, created exclusively; `status` never writes it.
 */
let heldLock = null;
function acquireLock(dir, cmd) {
  const p = path.join(dir, 'run.lock');
  try {
    writeFileSync(p, JSON.stringify({ cmd, pid: process.pid, at: new Date().toISOString() }), { flag: 'wx' });
  } catch (err) {
    if (err?.code === 'EEXIST') stop(`another growth-replay command holds ${p} (${readFileSync(p, 'utf8')}). If none is running, remove that file and retry.`);
    throw err;
  }
  heldLock = p;
  process.once('exit', releaseLock);
}
function releaseLock() {
  if (!heldLock) return;
  try { unlinkSync(heldLock); } catch { /* already gone */ }
  heldLock = null;
}

/** Which code ran (review C10): the script's own SHA-256 and HEAD, logged per command. */
function stampCommand(manifest, cmd) {
  (manifest.commandLog || (manifest.commandLog = [])).push({
    cmd, at: new Date().toISOString(), headSha: headSha(),
    scriptSha256: sha256Bytes(readFileSync(fileURLToPath(import.meta.url))),
  });
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
  const { env, rank, used } = loadEnv();
  console.log(`[growth-replay] env files read (names only): ${used.length ? used.map((f) => path.basename(path.dirname(f)) + '/' + path.basename(f)).join(', ') : 'none'}`);
  anthropicKey(env); // the STOP rule fires before any read if the key is missing
  const { db, projectId } = await openFirestore(env, rank);
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
      // Fail closed when a parsed span disagrees with the battle's own snapshot (review A2/A3): a
      // header-shaped string inside free text (an insight, a directive) could otherwise be taken
      // for a real section. Every tick of the 2026-10-08 run agreed (crossCheck in the manifest).
      if (Boolean(a.identity.rules) !== ((b.agentContext?.activeRules || []).length > 0)
        || (a.leans.status === 'present') !== ((b.agentContext?.standingLeans || []).length > 0)
        || (a.identity.status === 'learned') !== Boolean(b.agentContext?.consolidatedInsight)) {
        inc(g2.excluded, 'sections_disagree_with_battle_snapshot'); continue;
      }
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

  const manifest = {
    runId, createdAt: new Date().toISOString(), headSha: headSha(), seed: SEED, projectId,
    captureFloor: CAPTURE_FLOOR_ISO, battlesWalked: battles.length,
    gate: { g2, shape, crossCheck, corpus },
  };
  stampCommand(manifest, 'plan');

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
  // Only a run that passed its gate becomes the default target of later commands (review C12).
  writeFileSync(path.join(RUNS_ROOT, 'latest.txt'), runId);

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
  acquireLock(dir, 'pilot');
  const manifest = readJson(manifestPath);
  // A new pilot replaces the run plan, whose task indices the batches' custom ids point into (review C2).
  if (manifest.batches?.length) stop('this run already has batches — a new pilot would remap their custom ids. Start a new run with `plan`.');
  if (manifest.derivedFrom) stop('a derived batch-check run has no pilot: its request shapes were proven by the original run.');
  if ((manifest.pilot || manifest.pilotInProgress) && !flags.force) stop('this run already has a pilot record (complete or interrupted). Pass --force to run another, which spends again.');
  const priorPilotSpendUsd = (manifest.pilot?.pilotSpendUsdTotal ?? manifest.pilot?.pilotSpendUsd ?? 0) + (manifest.pilotInProgress?.spendUsd ?? 0);
  stampCommand(manifest, 'pilot');
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
  const priceOfCall = (model) => (model === 'prod' ? PRICES[priceKeyOf(prodId)] : PRICES[model]);
  const spendOf = (list) => list.filter((c) => c.status === 200).reduce((s, c) => {
    const p = priceOfCall(c.model);
    return s + (c.usage.input_tokens * p.stdIn + c.usage.output_tokens * p.stdOut) / 1e6;
  }, 0);
  const startedAt = new Date().toISOString();
  const send = async (label, model, req, meta) => {
    if (billable >= PILOT_BILLABLE_MAX || attempts >= PILOT_ATTEMPT_MAX) return { skipped: 'pilot cap' };
    attempts += 1;
    const t0 = Date.now();
    let r;
    try { r = await api(apiKey, 'POST', '/v1/messages', req); } catch (err) { r = { status: 'network', json: { error: { type: 'network', message: err.message } }, requestId: null }; }
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
    // Progress is on disk after EVERY call, so an interrupted pilot can never be re-run blind (review C9).
    manifest.pilotInProgress = { startedAt, billable, attempts, spendUsd: spendOf(calls), calls: calls.map(({ label: l, status: s, model: mo }) => ({ label: l, status: s, model: mo })) };
    writeJsonAtomic(manifestPath, manifest);
    return row;
  };
  const transient = (row) => row.status === 'network' || row.status === 429 || (typeof row.status === 'number' && row.status >= 500);

  for (const t of prodTicks) await send(`prod:${t.k}`, 'prod', batchParams(sources[t.k].request), { k: t.k, arm: 'base' });

  const ladderTick = prodTicks[0];
  for (const m of ladder) {
    let retriedTransient = false;
    for (let tries = 0; tries < 5; tries += 1) {
      const req = ladderRequest(sources[ladderTick.k].request, m.modelId, m.dropParams);
      const row = await send(`ladder:${m.key}`, m.key, req, { k: ladderTick.k, arm: 'ladder', dropParams: [...m.dropParams] });
      if (row.skipped || row.status === 200) break;
      if (transient(row)) {
        // A transient failure says nothing about the request shape: retry once, then call it unavailable, never "rejected".
        if (!retriedTransient) { retriedTransient = true; await new Promise((res) => setTimeout(res, 10_000)); continue; }
        m.unavailable = `HTTP ${row.status}: ${row.errorMessage}`;
        break;
      }
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
      assertOnlySpansMoved(src, request, v);
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
  const pilotSpendUsd = spendOf(calls);
  for (const m of ladder) {
    if (m.rejected) skipped.push({ target: m.display, reason: `rejected the request in the pilot: ${m.rejected}` });
    else if (m.unavailable) skipped.push({ target: m.display, reason: `unavailable during the pilot (transient, retried once): ${m.unavailable}` });
  }

  manifest.pilot = {
    at: new Date().toISOString(), prodId, prodPriceKey: priceKeyOf(prodId), modelsListed: models.length,
    ladder: ladder.map((m) => ({ ...m })), skipped, billable, attempts, calls,
    perModel: summary, edits, memTick: memTick?.k ?? null, pilotSpendUsd,
    // Every pilot this run has paid for, including an interrupted or replaced one (review C2/C9).
    pilotSpendUsdTotal: priorPilotSpendUsd + pilotSpendUsd,
  };
  delete manifest.pilotInProgress;
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
  const ladder = pl.ladder.filter((m) => !m.rejected && !m.unavailable && pl.perModel[m.key]);
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
    assertOnlySpansMoved(src, request, variant);
    return batchParams(request);
  }
  const lad = manifest.runPlan.ladderIds[model];
  return ladderRequest(src, lad.modelId, lad.dropParams);
}

/** Chunk request lines: ≤10,000 requests and ≤ BATCH_TARGET_BYTES per upload (the hard limits are asserted in batchBody). */
function chunkLines(lines) {
  const chunks = [];
  let cur = []; let bytes = 0;
  for (const l of lines) {
    const b = Buffer.byteLength(l.json, 'utf8') + 1;
    if (cur.length && (cur.length >= BATCH_MAX_REQUESTS || bytes + b > BATCH_TARGET_BYTES)) { chunks.push(cur); cur = []; bytes = 0; }
    cur.push(l); bytes += b;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

function batchBody(chunk) {
  const body = `{"requests":[${chunk.map((l) => l.json).join(',')}]}`;
  if (chunk.length > BATCH_MAX_REQUESTS || Buffer.byteLength(body, 'utf8') > BATCH_MAX_BYTES) stop(`a batch body exceeds the per-batch limit (${chunk.length} requests, ${Buffer.byteLength(body, 'utf8')} bytes)`);
  return body;
}

const totalOf = (counts) => Object.values(counts || {}).reduce((s, x) => s + (Number(x) || 0), 0);

/**
 * Review C1 — an interrupted create. The intent (task indices, size, time) is
 * written BEFORE every POST; if a command died between the POST and recording
 * the batch id, this lists recent batches and adopts the one the attempt made.
 * Zero matches means nothing was created and the tasks are simply unsent;
 * more than one means a human must decide.
 */
async function reconcilePending(apiKey, manifest, manifestPath) {
  const p = manifest.pendingCreate;
  if (!p) return;
  const known = new Set((manifest.batches || []).map((b) => b.batchId));
  const r = await api(apiKey, 'GET', '/v1/messages/batches?limit=100');
  if (r.status !== 200) stop(`could not list batches to reconcile an interrupted create (HTTP ${r.status}); nothing was sent`);
  const since = Date.parse(p.at) - 120_000;
  const cands = (r.json?.data || []).filter((b) => !known.has(b.id) && Date.parse(b.created_at) >= since && totalOf(b.request_counts) === p.count);
  if (cands.length > 1) stop(`an interrupted create left ${cands.length} candidate batches (${cands.map((b) => b.id).join(', ')}); reconcile manifest.pendingCreate by hand`);
  manifest.batches = manifest.batches || [];
  if (cands.length === 1) {
    manifest.batches.push({ batchId: cands[0].id, createdAt: cands[0].created_at, count: p.count, bytes: p.bytes, taskIdx: p.taskIdx, status: cands[0].processing_status, kind: p.kind, adoptedAfterInterruptedCreate: true });
    console.log(`[growth-replay] adopted ${cands[0].id}, created by an interrupted ${p.kind} attempt (${p.count} requests)`);
  } else {
    console.log(`[growth-replay] the interrupted ${p.kind} attempt created no batch; its ${p.count} request(s) are unsent`);
  }
  delete manifest.pendingCreate;
  writeJsonAtomic(manifestPath, manifest);
}

/** Create one batch with the intent on disk before the POST and the id on disk right after it. */
async function createRecordedBatch(apiKey, manifest, manifestPath, chunk, kind) {
  if (Date.now() > Date.parse(CAPS.deadlineIso)) stop(`the batch deadline ${CAPS.deadlineIso} has passed; ${(manifest.batches || []).length} batch(es) exist.`);
  const body = batchBody(chunk);
  const bytes = Buffer.byteLength(body, 'utf8');
  manifest.pendingCreate = { kind, at: new Date().toISOString(), count: chunk.length, bytes, bodySha256: sha256Utf8(body), taskIdx: chunk.map((l) => l.i) };
  writeJsonAtomic(manifestPath, manifest);
  const r = await api(apiKey, 'POST', '/v1/messages/batches', body);
  if (r.status !== 200 || typeof r.json?.id !== 'string') stop(`batch create returned HTTP ${r.status}: ${String(r.json?.error?.message ?? '').slice(0, 300)} (the pending record stays; the next submit or collect reconciles it)`);
  manifest.batches = manifest.batches || [];
  manifest.batches.push({ batchId: r.json.id, createdAt: new Date().toISOString(), count: chunk.length, bytes, taskIdx: chunk.map((l) => l.i), status: r.json.processing_status, kind });
  delete manifest.pendingCreate;
  writeJsonAtomic(manifestPath, manifest);
  console.log(`[growth-replay] created ${r.json.id} (${kind}, ${chunk.length} requests)`);
}

/**
 * The spend-time cap check (delta review E1/E2): never looser than the global caps,
 * a derived batch-check run always held to BATCHCHECK_CAPS even if its stored caps are
 * missing, and fail-closed on any non-finite figure or a worst case below the plan
 * (a null max_tokens would price the worst case at zero output).
 */
export function capCheck(cost, pilotUsd = 0, { runCaps = null, derived = false } = {}) {
  const layers = [CAPS, ...(derived ? [BATCHCHECK_CAPS] : []), ...(runCaps ? [runCaps] : [])];
  const caps = { plannedUsd: Math.min(...layers.map((c) => c.plannedUsd)), worstUsd: Math.min(...layers.map((c) => c.worstUsd)) };
  const planned = cost.planned + pilotUsd;
  const worst = cost.worst + pilotUsd;
  const ok = [planned, worst, caps.plannedUsd, caps.worstUsd].every(Number.isFinite)
    && worst >= planned - 1e-9 && planned <= caps.plannedUsd && worst <= caps.worstUsd;
  return { ok, caps, planned, worst };
}

/** Planned and worst-case USD of the stored plan, RE-COMPUTED from its tasks at the current prices (review C2). */
function planCost(manifest) {
  const rp = manifest.runPlan;
  const priceOf = (key) => PRICES[key === 'prod' ? manifest.pilot.prodPriceKey : key];
  const tasks = rp.tasks.map(([k, arm, variant, model, rep]) => ({ k, arm, variant, model, rep }));
  const a = costOf(tasks, rp.est.pilot, priceOf);
  const b = costOf(tasks, rp.est.conservative, priceOf);
  return { planned: Math.max(a.planned, b.planned), worst: Math.max(a.worst, b.worst) };
}

async function submit(flags) {
  if (!flags.go) stop('submit needs --go (the founder\'s checkpoint answer).');
  const { dir, manifestPath } = resolveRun(flags);
  acquireLock(dir, 'submit');
  const manifest = readJson(manifestPath);
  const rp = manifest.runPlan;
  if (!rp) stop('no run plan — run `pilot` first.');
  if (rp.over) stop('the plan is over a cap after every cut.');
  // Every task is submitted at most once (plus one retry of an UNBILLED server error), so the
  // plan's cost bounds cumulative batch spend; the pilot's spend is added on top.
  const cost = planCost(manifest);
  const pilotUsd = manifest.pilot?.pilotSpendUsdTotal ?? manifest.pilot?.pilotSpendUsd ?? 0;
  // A run may carry tighter caps of its own (the batch-effect check: $50 / $68); never looser ones.
  const chk = capCheck(cost, pilotUsd, { runCaps: rp.caps, derived: Boolean(manifest.derivedFrom) });
  if (!chk.ok) stop(`plan over cap or malformed: planned $${chk.planned.toFixed(2)}, worst $${chk.worst.toFixed(2)} (pilot included; caps $${chk.caps.plannedUsd} / $${chk.caps.worstUsd})`);
  stampCommand(manifest, 'submit');
  const { env } = loadEnv();
  const apiKey = anthropicKey(env);
  await reconcilePending(apiKey, manifest, manifestPath);
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

  // Seeded shuffle before chunking (review B8): no condition sits alone in its own batches, so a
  // batch-level difference cannot masquerade as an edit effect. custom_id still maps to the task.
  const chunks = chunkLines(shuffle(lines, rng(SEED + 31)));
  console.log(`[growth-replay] ${lines.length} request(s) to submit in ${chunks.length} batch(es)`);
  for (const chunk of chunks) await createRecordedBatch(apiKey, manifest, manifestPath, chunk, 'main');
}

// ---------------------------------------------------------------- status

/** Read-only: it reports batch states and never writes the manifest (review C3). */
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
      rows.push({ batchId: b.batchId, status: r.json?.processing_status ?? `HTTP ${r.status}`, counts: r.json?.request_counts ?? null });
    }
    if (manifest.pendingCreate) rows.push({ pendingCreate: `${manifest.pendingCreate.kind} at ${manifest.pendingCreate.at} — run submit or collect to reconcile` });
    console.log(`[growth-replay] ${new Date().toISOString()} ${JSON.stringify(rows)}`);
    const allEnded = rows.every((r) => r.status === 'ended' || String(r.status).startsWith('deleted'));
    if (!flags.wait || allEnded) { if (flags.wait) console.log(allEnded ? 'ALL ENDED' : ''); return; }
    if (Date.now() - started >= POLL_FOR_MS) { console.log('NOT FINISHED after 2 hours. Come back to this session later and type: collect the growth replay.'); return; }
    await new Promise((res) => setTimeout(res, POLL_EVERY_MS));
  }
}

// ---------------------------------------------------------------- collect

const RETRYABLE_ERRORS = new Set(['api_error', 'overloaded_error', 'timeout_error']);
const isSpendLimitResult = (line, errMsg) => /enforced_spend_limit_reached/.test(line) || errMsg.startsWith('You have reached your specified API usage limits');

async function collect(flags) {
  const { dir, manifestPath } = resolveRun(flags);
  acquireLock(dir, 'collect');
  const manifest = readJson(manifestPath);
  stampCommand(manifest, 'collect');
  const { env } = loadEnv();
  const apiKey = anthropicKey(env);
  await reconcilePending(apiKey, manifest, manifestPath);
  const resDir = path.join(dir, 'results');
  mkdirSync(resDir, { recursive: true });
  manifest.outcomes = manifest.outcomes || {};
  const outcomes = manifest.outcomes;

  for (const b of manifest.batches || []) {
    if (b.resultsSaved) continue;
    const r = await api(apiKey, 'GET', `/v1/messages/batches/${b.batchId}`);
    if (r.json?.processing_status !== 'ended') { console.log(`[growth-replay] ${b.batchId} is ${r.json?.processing_status ?? `HTTP ${r.status}`} — not collected yet`); continue; }
    const file = path.join(resDir, `${b.batchId}.jsonl`);
    let res;
    try {
      res = await fetch(anthropicUrl(r.json.results_url), { headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION } });
    } catch (err) {
      stop(`results download for ${b.batchId} failed: ${err?.cause?.code || err?.name || 'network error'} (the batch is kept)`);
    }
    if (!res.ok) stop(`results download for ${b.batchId} returned HTTP ${res.status} (the batch is kept)`);
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
      // A spend-limit result blocks NEW spend (no retry batch), never saving or deleting what is already paid for (review C6).
      if (type === 'errored' && isSpendLimitResult(line, errMsg)) manifest.spendLimitHit = { batchId: b.batchId, at: new Date().toISOString() };
      if (outcomes[i]?.type === 'succeeded') continue;
      outcomes[i] = { type, batchId: b.batchId, errType };
    }
    b.resultsSaved = true; b.resultLines = resultLines.length;
    writeJsonAtomic(manifestPath, manifest);
    console.log(`[growth-replay] ${b.batchId}: ${resultLines.length} results saved`);
  }

  // Delete every batch whose results are safely on disk — retried on every collect until it succeeds (review C7).
  for (const b of manifest.batches || []) {
    if (!b.resultsSaved || b.deleted) continue;
    const del = await api(apiKey, 'DELETE', `/v1/messages/batches/${b.batchId}`);
    b.deleted = del.status === 200;
    b.deleteStatus = del.status;
    writeJsonAtomic(manifestPath, manifest);
    console.log(`[growth-replay] ${b.batchId}: deleted on Anthropic's side: ${b.deleted}${b.deleted ? '' : ` (HTTP ${del.status}; the next collect retries)`}`);
  }

  const summary = {};
  for (const o of Object.values(outcomes)) inc(summary, `${o.type}${o.errType ? `:${o.errType}` : ''}`);
  const allSaved = (manifest.batches || []).every((b) => b.resultsSaved);
  console.log(`[growth-replay] outcomes: ${JSON.stringify(summary)}; all batches saved: ${allSaved}`);
  if (manifest.spendLimitHit) stop(`a result reports the API spend limit (batch ${manifest.spendLimitHit.batchId}). Results are saved; no retry batch was created.`, 3);

  // One retry of server-errored requests. Errored requests are not billed and each task is
  // retried at most once, so cumulative spend stays inside the plan the caps were checked on.
  const retryable = Object.entries(outcomes).filter(([, o]) => o.type === 'errored' && RETRYABLE_ERRORS.has(o.errType)).map(([i]) => Number(i));
  const already = new Set((manifest.batches || []).filter((b) => b.kind === 'retry').flatMap((b) => b.taskIdx));
  const toRetry = retryable.filter((i) => !already.has(i));
  if (!allSaved || !toRetry.length || flags.noRetry) return;
  if (Date.now() > Date.parse(CAPS.deadlineIso)) { console.log(`[growth-replay] ${toRetry.length} server-errored request(s) NOT retried: past the batch deadline`); return; }
  if (!toRetry.every((i) => outcomes[i]?.type === 'errored' && Array.isArray(manifest.runPlan.tasks[i]))) stop('retry set is not a subset of errored plan tasks');
  const sources = loadSources(dir);
  const donorTexts = readJson(path.join(dir, 'donor-learned-texts.json'));
  const lines = toRetry.map((i) => ({ i, json: JSON.stringify({ custom_id: `gr_${String(i).padStart(6, '0')}`, params: requestFor(manifest.runPlan.tasks[i], sources, manifest, donorTexts) }) }));
  for (const chunk of chunkLines(lines)) await createRecordedBatch(apiKey, manifest, manifestPath, chunk, 'retry');
  console.log(`[growth-replay] retry batch(es) created for ${toRetry.length} server-errored request(s); run status --wait, then collect again`);
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

/**
 * Every returned decision of a run, keyed by tick and condition:
 * keys[k][cond] = [{coarse, fine}] under the key of record (production's validator
 * semantics); keysStrict under the stricter request-schema key. Also per-condition
 * usage, response diagnostics and completeness (INCOMPLETE above 5% missing).
 */
function buildKeys(dir, manifest, sources = loadSources(dir)) {
  const rp = manifest.runPlan;
  const results = loadResults(dir);
  const schemaOf = (k) => sources[k].request.tools[0].input_schema;
  const keys = {};
  const keysStrict = {};
  const usage = {};
  const requested = {}; const got = {};
  const perTick = {}; // perTick[k][cond] = { requested, got } — completeness over any tick subset
  rp.tasks.forEach((task, i) => {
    const [k, arm, variant, model] = task;
    const cond = arm === 'ladder' ? `ladder:${model}` : arm === 'memory' ? `memory:${variant}` : 'base';
    inc(requested, cond);
    const pt = (perTick[k] || (perTick[k] = {}))[cond] || (perTick[k][cond] = { requested: 0, got: 0 });
    pt.requested += 1;
    const r = results[i];
    if (!r?.message) return;
    inc(got, cond);
    pt.got += 1;
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
    // "More than 5%", with a tolerance so exactly 5% is not flagged by floating error (delta review D5).
    return [c, { requested: requested[c], returned: got[c] || 0, missingShare: missing, status: missing > 0.05 + 1e-9 ? 'INCOMPLETE' : 'complete' }];
  }));
  return { keys, keysStrict, usage, responseDiagnostics, completeness, perTick };
}

async function analyze(flags) {
  const st = runSelftest();
  if (!st.pass) stop(`selftest failed — not analyzing: ${JSON.stringify(st)}`);
  const { dir, manifestPath } = resolveRun(flags);
  const manifest = readJson(manifestPath);
  if (manifest.derivedFrom) stop('this is a derived batch-check run — use batchcheck-analyze (delta review D3).');
  const rp = manifest.runPlan;
  const sources = loadSources(dir);
  const tickMeta = Object.fromEntries(manifest.sample.ticks.map((t) => [t.k, t]));
  const { keys, keysStrict, usage, responseDiagnostics, completeness } = buildKeys(dir, manifest, sources);

  const sampleKeys = rp.sampleKeys;
  // An arm with more than 5% of its requests missing carries INCOMPLETE on its label (review C8/B10).
  const markIncomplete = (conds, label) => (conds.some((c) => completeness[c]?.status === 'INCOMPLETE') ? `INCOMPLETE (${label})` : label);
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
    arm1.label = markIncomplete(['base'], arm1Label(arm1.all.meanAgreementFine));

    // ---- Arm 2 ----
    const arm2 = {};
    const perTickMove = {};
    let floor = null;
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
        res.label = markIncomplete(['base', cond], arm2Label(res));
        // Descriptive context for the frozen excess figure (review B1): the raw flips, and the flip
        // rate expected with NO effect (both groups drawn from each tick's own baseline).
        if (floor == null) floor = noEffectFlipFloor(rows.map((r) => r.base), { nA: rp.repeats.base, nB: rp.repeats.memory });
        res.noEffectFlipFloor = floor;
        res.flipsBeyondNoEffectFloor = res.flipRate - floor;
        // The opposite deterministic tie rule (review B9): the label's sensitivity to tie-breaking.
        const tie = permutationTest(rows, { seed: SEED + 11, tieLargest: true });
        res.tieRuleSensitivity = { excessFlip: tie.excessFlip, flipRate: tie.flipRate, label: arm2Label(tie) };
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
        rows.push({ prodCoarse: prodModal[k].coarse, agreeFine: modal(cf) === prodModal[k].fine ? 1 : 0, agreeCoarse: modal(cc) === prodModal[k].coarse ? 1 : 0, self: cf[modal(cf)] / list.length, action: list.filter((x) => x.coarse === 'SWAP').length / list.length, malformed: list.filter((x) => x.fine === MALFORMED).length / list.length });
      }
      // Agreement split by production's own usual call (review B4): an overall figure is mostly the hold base rate.
      const byProdCall = Object.fromEntries(Object.entries(groupBy(rows, (r) => r.prodCoarse)).map(([c, list]) => [c, { ticks: list.length, agreeFine: mean(list.map((r) => r.agreeFine)), agreeCoarse: mean(list.map((r) => r.agreeCoarse)) }]));
      const u = usage[cond];
      const p = PRICES[m.key];
      const mi = u ? mean(u.input) : null; const mo = u ? mean(u.output) : null;
      arm3[m.key] = {
        model: rp.ladderIds[m.key].modelId, ticks: rows.length, status: completeness[cond]?.status ?? 'missing',
        modalAgreementWithProdFine: mean(rows.map((r) => r.agreeFine)), modalAgreementWithProdCoarse: mean(rows.map((r) => r.agreeCoarse)),
        agreementByProductionCall: byProdCall,
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
  // Carry the batch-check addendum over (delta review D1): re-running analyze never erases it.
  const exFile = path.join(dir, 'GROWTH_REPLAY_EXHIBITS.local.md');
  const kept = existsSync(exFile) ? extractBatchcheckBlock(readFileSync(exFile, 'utf8')) : { ok: true, block: '' };
  if (!kept.ok) stop(`${exFile} has malformed batch-check markers — fix them by hand; nothing was rewritten`);
  writeFileSync(exFile, kept.block ? `${out.join('\n').replace(/\n*$/, '\n\n')}${kept.block}\n` : out.join('\n'));
}

// ---------------------------------------------------------------- batch-effect check (addendum; Fable ruling 2026-10-08)
//
// One new run on the same arm-2 moments: a fresh baseline and a fresh `strip`,
// shuffled together across the same batches (submit's seeded interleave), with
// equal repeats — 10 if the caps allow, never fewer than 5. Three comparisons on
// the frozen bars: fresh baseline vs original baseline (the batch-effect test),
// fresh strip vs fresh baseline (the learning test, batches controlled), and
// fresh strip vs original strip (replication).

export const BATCHCHECK_CAPS = Object.freeze({ plannedUsd: 50, worstUsd: 68 });
const BATCHCHECK_REPEATS = Object.freeze({ max: 10, min: 5 });

/** Equal repeats of a fresh baseline and a fresh strip per tick, as runPlan task tuples. */
export function batchCheckTasks(tickKeys, repeats) {
  const tasks = [];
  for (const k of tickKeys) for (let r = 1; r <= repeats; r += 1) tasks.push([k, 'base', 'verbatim', 'prod', r]);
  for (const k of tickKeys) for (let r = 1; r <= repeats; r += 1) tasks.push([k, 'memory', 'strip', 'prod', r]);
  return tasks;
}

/** The largest equal repeat count in [min, max] whose planned AND worst-case cost fit the caps; null if none does. */
export function fitRepeats(tickKeys, { est, priceOf, caps = BATCHCHECK_CAPS, min = BATCHCHECK_REPEATS.min, max = BATCHCHECK_REPEATS.max }) {
  // Every estimate must be a real number, with a positive max_tokens for the worst case (review E2).
  const sane = (e) => e && [e.input, e.output, e.maxTokens, e.cacheMultiplier].every(Number.isFinite) && e.maxTokens > 0 && e.cacheMultiplier >= 1;
  if (!sane(est?.pilot?.prod) || !sane(est?.conservative?.prod)) return null;
  for (let r = max; r >= min; r -= 1) {
    const tasks = batchCheckTasks(tickKeys, r).map(([k, arm, variant, model, rep]) => ({ k, arm, variant, model, rep }));
    const a = costOf(tasks, est.pilot, priceOf);
    const b = costOf(tasks, est.conservative, priceOf);
    const cost = { planned: Math.max(a.planned, b.planned), worst: Math.max(a.worst, b.worst) };
    if (capCheck(cost, 0, { runCaps: caps }).ok) return { repeats: r, cost };
  }
  return null;
}

/** Derive the batch-check run from an analysed original run (no Firestore read, no spend). */
async function batchcheckPlan(flags) {
  if (!flags.from) stop('batchcheck-plan needs --from <runId> (the original run).');
  if (!/^gr-\d{8}T\d{6}$/.test(flags.from)) stop('--from must name an original run folder (gr-YYYYMMDDTHHMMSS)');
  const odir = runDir(flags.from);
  if (!existsSync(path.join(odir, 'manifest.json'))) stop(`no run folder ${odir}`);
  const om = readJson(path.join(odir, 'manifest.json'));
  if (!om.runPlan || !om.pilot) stop('the original run has no run plan');
  // Only a finished, analysed original (delta review E3/E4): never a derived run, an over-cap
  // plan, or a run with work left to recover, which a moved latest.txt would hide.
  if (om.derivedFrom || om.runPlan.over) stop('the source must be an original, in-cap run');
  if (om.pendingCreate || !(om.batches || []).length || !om.batches.every((b) => b.resultsSaved && b.deleted)) stop('the original run is not finished (uncollected, undeleted or pending batches)');
  if (!existsSync(path.join(odir, 'analysis.json'))) stop('the original run has not been analysed');
  const ticks = om.sample.ticks.filter((t) => om.runPlan.sampleKeys.includes(t.k) && t.learned === 'learned');
  const tickKeys = ticks.map((t) => t.k);
  const priceOf = (key) => PRICES[key === 'prod' ? om.pilot.prodPriceKey : key];
  const est = { pilot: { prod: om.runPlan.est.pilot.prod }, conservative: { prod: om.runPlan.est.conservative.prod } };
  const fit = fitRepeats(tickKeys, { est, priceOf });
  if (!fit) stop(`even ${BATCHCHECK_REPEATS.min} repeats exceed the caps ($${BATCHCHECK_CAPS.plannedUsd} planned / $${BATCHCHECK_CAPS.worstUsd} worst)`);
  const runId = `${flags.from}-batchcheck`;
  const dir = runDir(runId);
  if (existsSync(dir)) stop(`${dir} already exists — this check is planned once`);
  const sources = loadSources(odir);
  if (!tickKeys.every((k) => sources[k])) stop('the original run is missing source requests for its arm-2 ticks');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'source-requests.jsonl'), `${tickKeys.map((k) => JSON.stringify(sources[k])).join('\n')}\n`);
  writeFileSync(path.join(dir, 'donor-learned-texts.json'), '{}');
  const manifest = {
    runId, createdAt: new Date().toISOString(), derivedFrom: flags.from, purpose: 'batch-effect check (Fable ruling, 2026-10-08)',
    seed: SEED, headSha: headSha(),
    gate: { shape: { cacheControl: om.gate.shape.cacheControl } },
    sample: { n: ticks.length, ticks },
    pilot: { prodId: om.pilot.prodId, prodPriceKey: om.pilot.prodPriceKey, pilotSpendUsd: 0, pilotSpendUsdTotal: 0, ladder: [], note: 'no pilot: the request shapes were proven by the original run' },
    runPlan: {
      tasks: batchCheckTasks(tickKeys, fit.repeats), est, repeats: { base: fit.repeats, memory: fit.repeats, ladder: 0 },
      sampleKeys: tickKeys, variants: ['strip'], ladder: [], ladderIds: {}, prodId: om.pilot.prodId,
      over: false, caps: BATCHCHECK_CAPS, cost: fit.cost, cfg: { n: ticks.length },
    },
  };
  stampCommand(manifest, 'batchcheck-plan');
  writeJsonAtomic(path.join(dir, 'manifest.json'), manifest);
  writeFileSync(path.join(RUNS_ROOT, 'latest.txt'), runId);
  console.log(JSON.stringify({ runId, dir, ticks: ticks.length, repeats: fit.repeats, requests: manifest.runPlan.tasks.length, plannedUsd: round(fit.cost.planned, 2), worstUsd: round(fit.cost.worst, 2), caps: BATCHCHECK_CAPS }, null, 1));
}

/** The three comparisons of the ruling, as data (delta review D2: asserted by the selftest). */
export const BATCHCHECK_COMPARISONS = Object.freeze([
  Object.freeze({ name: 'batchEffect', title: 'fresh baseline vs original baseline (the batch-effect test)', base: Object.freeze(['original', 'base']), variant: Object.freeze(['fresh', 'base']), seed: SEED + 61 }),
  Object.freeze({ name: 'learning', title: 'fresh learning-removed vs fresh baseline (the learning test, batches controlled)', base: Object.freeze(['fresh', 'base']), variant: Object.freeze(['fresh', 'memory:strip']), seed: SEED + 64 }),
  Object.freeze({ name: 'replication', title: 'fresh learning-removed vs original learning-removed (replication)', base: Object.freeze(['original', 'memory:strip']), variant: Object.freeze(['fresh', 'memory:strip']), seed: SEED + 67 }),
]);

const BATCHCHECK_START = '<!-- batchcheck:start -->';
const BATCHCHECK_END = '<!-- batchcheck:end -->';

/**
 * Split an exhibits file into the batch-check block and everything else (delta review
 * D1/D7). ok:false when the markers are malformed — the caller then refuses to rewrite
 * the file rather than guess where user text ends.
 */
export function extractBatchcheckBlock(text) {
  const s = String(text ?? '');
  const nS = countOf(s, BATCHCHECK_START); const nE = countOf(s, BATCHCHECK_END);
  if (nS === 0 && nE === 0) return { ok: true, block: '', rest: s };
  const a = s.indexOf(BATCHCHECK_START); const b = s.indexOf(BATCHCHECK_END);
  if (nS !== 1 || nE !== 1 || b < a) return { ok: false, block: '', rest: s };
  const block = s.slice(a, b + BATCHCHECK_END.length);
  const rest = (s.slice(0, a) + s.slice(b + BATCHCHECK_END.length).replace(/^\n+/, '')).replace(/\n+$/, '\n');
  return { ok: true, block, rest };
}

/** The three comparisons, the descriptive context, and the exhibits addendum. */
async function batchcheckAnalyze(flags) {
  const st = runSelftest();
  if (!st.pass) stop(`selftest failed — not analyzing: ${JSON.stringify(st)}`);
  const { dir, manifestPath } = resolveRun(flags);
  const m = readJson(manifestPath);
  if (!m.derivedFrom) stop('this is not a batch-check run (no derivedFrom)');
  // Only a fully collected run is analysed, so a partial pass can never replace a good one (delta review D4).
  if (m.pendingCreate || !(m.batches || []).length || !m.batches.every((b) => b.resultsSaved)) stop('the batch-check run is not fully collected — run status --wait, then collect');
  const odir = runDir(m.derivedFrom);
  const om = readJson(path.join(odir, 'manifest.json'));
  const src = { fresh: buildKeys(dir, m), original: buildKeys(odir, om) };
  const plannedRepeats = { fresh: m.runPlan.repeats, original: om.runPlan.repeats };
  const repeatsOf = (which, cond) => (cond === 'base' ? plannedRepeats[which].base : plannedRepeats[which].memory);
  const tickKeys = m.runPlan.sampleKeys;
  const meta = Object.fromEntries(m.sample.ticks.map((t) => [t.k, t]));
  const share = (lists, pred) => mean(lists.map((l) => l.filter(pred).length / l.length));
  // Completeness over the ticks actually compared (delta review D5), with a tolerance so exactly 5% is not "above 5%".
  const missingOver = (which, cond) => {
    let requested = 0; let got = 0;
    for (const k of tickKeys) { const c = src[which].perTick[k]?.[cond]; requested += c?.requested ?? 0; got += c?.got ?? 0; }
    return requested ? 1 - got / requested : 1;
  };

  const compare = ({ base: [bw, bc], variant: [vw, vc], seed }) => {
    const rows = tickKeys.map((k) => ({
      k, archetype: meta[k].archetype,
      base: (src[bw].keys[k]?.[bc] || []).map((x) => x.fine),
      variant: (src[vw].keys[k]?.[vc] || []).map((x) => x.fine),
    })).filter((r) => r.base.length && r.variant.length);
    const res = permutationTest(rows, { seed });
    if (!res) return null;
    res.missing = { base: missingOver(bw, bc), variant: missingOver(vw, vc) };
    const incomplete = res.missing.base > 0.05 + 1e-9 || res.missing.variant > 0.05 + 1e-9;
    res.label = incomplete ? `INCOMPLETE (${arm2Label(res)})` : arm2Label(res);
    const perTickTv = res.perTickTv;
    delete res.perTickTv;
    const c = permutationTest(rows.map((r) => ({ base: r.base.map(toCoarse), variant: r.variant.map(toCoarse) })), { seed: seed + 1 });
    if (c) { c.label = arm2Label(c); delete c.perTickTv; }
    res.coarse = c;
    // The noise floor at the PLANNED repeats of each side (delta review D6).
    res.repeats = { base: repeatsOf(bw, bc), variant: repeatsOf(vw, vc) };
    res.noEffectFlipFloor = noEffectFlipFloor(rows.map((r) => r.base), { nA: res.repeats.base, nB: res.repeats.variant });
    res.flipsBeyondNoEffectFloor = res.flipRate - res.noEffectFlipFloor;
    const tie = permutationTest(rows, { seed, tieLargest: true });
    res.tieRuleSensitivity = { excessFlip: tie.excessFlip, flipRate: tie.flipRate, label: arm2Label(tie) };
    res.actionRateBase = share(rows.map((r) => r.base), (x) => x.startsWith('SWAP'));
    res.actionRateVariant = share(rows.map((r) => r.variant), (x) => x.startsWith('SWAP'));
    res.malformedBase = share(rows.map((r) => r.base), (x) => x === MALFORMED);
    res.malformedVariant = share(rows.map((r) => r.variant), (x) => x === MALFORMED);
    res.agreementBase = mean(rows.map((r) => { const cc = counts(r.base); return cc[modal(cc)] / r.base.length; }));
    res.agreementVariant = mean(rows.map((r) => { const cc = counts(r.variant); return cc[modal(cc)] / r.variant.length; }));
    res.byArchetype = {};
    for (const [arch, list] of Object.entries(groupBy(rows, (r) => r.archetype))) {
      const sub = permutationTest(list, { seed: seed + 2 });
      if (sub) { sub.label = arm2Label(sub); delete sub.perTickTv; }
      res.byArchetype[arch] = sub;
    }
    res.flipped = rows.map((r, i) => ({ k: r.k, tv: perTickTv[i], from: modal(counts(r.base)), to: modal(counts(r.variant)) })).filter((x) => x.from !== x.to);
    return res;
  };

  const comparisons = {};
  for (const spec of BATCHCHECK_COMPARISONS) {
    const res = compare(spec);
    if (!res) stop(`comparison ${spec.name} could not be measured (no ticks with results on both sides)`);
    comparisons[spec.name] = { title: spec.title, ...res };
  }

  const spend = { byCondition: {}, totalUsd: 0 };
  for (const [cond, u] of Object.entries(src.fresh.usage)) {
    const p = PRICES[m.pilot.prodPriceKey];
    const usd = (u.input.reduce((s, x) => s + x, 0) * p.batchIn + u.output.reduce((s, x) => s + x, 0) * p.batchOut) / 1e6;
    spend.byCondition[cond] = round(usd, 4); spend.totalUsd += usd;
  }
  const batches = m.batches || [];
  const mixedBatches = batches.filter((b) => new Set(b.taskIdx.map((i) => m.runPlan.tasks[i][1])).size === 2).length;

  const out = {
    runId: m.runId, derivedFrom: m.derivedFrom, at: new Date().toISOString(), selftest: { pass: st.pass },
    ticks: tickKeys.length, repeats: m.runPlan.repeats, completeness: src.fresh.completeness, responseDiagnostics: src.fresh.responseDiagnostics,
    batches: { count: batches.length, withBothConditions: mixedBatches },
    comparisons: Object.fromEntries(Object.entries(comparisons).map(([k, v]) => [k, { ...v, flipped: v.flipped.length }])),
    spend,
  };
  appendBatchcheckExhibits(odir, m, src.fresh, src.original, comparisons.learning);
  writeJsonAtomic(path.join(dir, 'addendum.json'), out);
  console.log(JSON.stringify(out, null, 1));
}

/** Append (or replace) the dated section of the LOCAL-ONLY exhibits file: the moments that changed in the fresh learning test. */
function appendBatchcheckExhibits(odir, m, fresh, orig, learning) {
  const file = path.join(odir, 'GROWTH_REPLAY_EXHIBITS.local.md');
  const prior = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const split = extractBatchcheckBlock(prior);
  if (!split.ok) stop(`${file} has malformed batch-check markers — fix them by hand; nothing was rewritten`);
  const sources = loadSources(runDir(m.runId));
  const meta = Object.fromEntries(m.sample.ticks.map((t) => [t.k, t]));
  const dist = (list) => (list?.length ? Object.entries(counts(list.map((x) => x.fine))).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}×${n}`).join(', ') : '—');
  const rows = [...learning.flipped].sort((a, b) => b.tv - a.tv);
  const lines = [BATCHCHECK_START, '', `## Addendum ${m.createdAt.slice(0, 10)} — the moments that changed in the fresh learning test`, '',
    `Run ${m.runId} (derived from ${m.derivedFrom}). Fresh baseline and fresh learning-removed, ${m.runPlan.repeats.base} repeats each, shuffled together across the same batches. ${rows.length} of ${learning.ticks} moments changed their usual call.`, ''];
  for (const [i, r] of rows.entries()) {
    const t = meta[r.k];
    lines.push(`### ${i + 1}. ${t.archetype} — originally ${t.original.fine} — ${r.from} → ${r.to} (distance ${r.tv.toFixed(2)})`, '');
    lines.push(`- battle/tick: \`${r.k}\``,
      `- fresh baseline: ${dist(fresh.keys[r.k]?.base)}`, `- fresh learning-removed: ${dist(fresh.keys[r.k]?.['memory:strip'])}`,
      `- original baseline: ${dist(orig.keys[r.k]?.base)}`, `- original learning-removed: ${dist(orig.keys[r.k]?.['memory:strip'])}`, '');
    lines.push('What the agent had learned (the LEARNED section as sent):', '', '```text', learnedPartText(sources[r.k].request) ?? '(none)', '```', '');
  }
  lines.push(BATCHCHECK_END, '');
  writeFileSync(file, `${split.rest.replace(/\n*$/, '\n\n')}${lines.join('\n')}`);
}

// ---------------------------------------------------------------- selftest

/**
 * The selftest that gates analyze. Synthetic arm-2 data: pure noise must read "no
 * measurable effect", a planted 30% shift "moves decisions", a small consistent shift
 * "measurable but small"; the noise false-positive rate must be calibrated; and every
 * statistic, bar, sampler and budget rule has a known-answer row (review B2).
 */
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
  // A small, consistent shift that changes the mix but rarely the usual call: must read "measurable but small".
  const smallShift = [];
  for (let i = 0; i < 150; i += 1) {
    smallShift.push({ base: Array.from({ length: 10 }, () => draw([9, 1, 0, 0])), variant: Array.from({ length: 10 }, () => draw([7, 3, 0, 0])) });
  }
  const small = permutationTest(smallShift, { seed: SEED + 23 });

  // ---- known answers (review B2: each row names the defect it can catch) ----
  const checks = {};
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  // TV distance: half the L1 distance between the two distributions.
  checks.tvSeparated = tvDistance({ A: 10 }, { B: 10 }) === 1;
  checks.tvIdentical = tvDistance({ A: 5, B: 5 }, { A: 5, B: 5 }) === 0;
  checks.tvPartial = near(tvDistance({ A: 7, B: 3 }, { A: 4, B: 6 }), 0.3, 1e-12);
  checks.tvUnequalSizes = near(tvDistance({ A: 10 }, { A: 2, B: 3 }), 0.6, 1e-12);
  // Modal tie rule: lexically smallest; the opposite rule only on request.
  checks.modalTie = modal({ B: 5, A: 5 }) === 'A' && modal({ B: 5, A: 5 }, { largest: true }) === 'B';
  // The permutation null rests on an unbiased shuffle: all 6 orders of [0,1,2] near 1/6 each (a cyclic-only
  // shuffle never yields the identity).
  const orders = {}; const sr = rng(SEED + 27);
  for (let i = 0; i < 6000; i += 1) inc(orders, shuffle([0, 1, 2], sr).join(''));
  checks.shuffleUniform = Object.keys(orders).length === 6 && Object.values(orders).every((c) => c >= 850 && c <= 1150);
  // One fully separated tick (10×A vs 10×B): the exact within-tick null. a = #A in the first
  // group ~ Hypergeometric(20, 10, 10); null TV = |2a−10|/10; null flip = 1 − P(a = 5).
  const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i += 1) r = (r * (n - k + i)) / i; return r; };
  const pa = (a) => (choose(10, a) * choose(10, 10 - a)) / choose(20, 10);
  let exactNullTv = 0; for (let a = 0; a <= 10; a += 1) exactNullTv += pa(a) * (Math.abs(2 * a - 10) / 10);
  const exactNullFlip = 1 - pa(5);
  const sep = permutationTest([{ base: Array(10).fill('A'), variant: Array(10).fill('B') }], { seed: SEED + 24, permutations: 4000 });
  checks.separatedObserved = sep.T === 1 && sep.flipRate === 1 && sep.p === 1 / 4001;
  checks.separatedNullMean = near(sep.nullMean, exactNullTv, 0.01);
  checks.separatedNullFlip = near(sep.nullFlipRate, exactNullFlip, 0.02) && near(sep.excessFlip, 1 - exactNullFlip, 0.02);
  // Its exact null distribution puts the 95th percentile at TV 0.4 (cumulative 0.34 / 0.82 / 0.97 at 0 / 0.2 / 0.4).
  checks.separatedNullP95 = near(sep.nullP95, 0.4, 1e-9);
  // Unequal group sizes (10 vs 5) must be kept by the permutation: exact null TV for 10×A + 5×B split 10/5.
  let exactUneq = 0;
  for (let a = 5; a <= 10; a += 1) { // a = #A in the size-10 group; the size-5 group holds 10 − a A's
    const p = (choose(10, a) * choose(5, 10 - a)) / choose(15, 10);
    exactUneq += p * tvDistance({ A: a, B: 10 - a }, { A: 10 - a, B: 5 - (10 - a) });
  }
  const uneq = permutationTest([{ base: Array(10).fill('A'), variant: Array(5).fill('B') }], { seed: SEED + 25, permutations: 4000 });
  checks.unequalSizesNull = near(uneq.nullMean, exactUneq, 0.01);
  // Identical ticks with different content: the null must stay WITHIN each tick (exactly 0), and p = 1.
  const ident = permutationTest([{ base: Array(10).fill('A'), variant: Array(10).fill('A') }, { base: Array(10).fill('B'), variant: Array(10).fill('B') }], { seed: SEED + 26, permutations: 200 });
  checks.withinTickNull = ident.T === 0 && ident.nullMean === 0 && ident.nullP95 === 0 && ident.p === 1 && arm2Label(ident) === 'no measurable effect';
  // The frozen bars, at their exact boundaries.
  checks.arm2Bars = arm2Label({ p: 0.05, excessFlip: 0.9 }) === 'no measurable effect'
    && arm2Label({ p: 0.0499, excessFlip: 0.05 }) === 'moves decisions'
    && arm2Label({ p: 0.0499, excessFlip: 0.0499 }) === 'measurable but small';
  checks.arm1Bars = arm1Label(0.90) === 'steady' && arm1Label(0.8999) === 'wobbly' && arm1Label(0.75) === 'wobbly' && arm1Label(0.7499) === 'noisy';
  // Split-half: [A×10] → 1; [A×5, B×5] → 0 exactly; [A×6, B×4] → P(3 A's in a half of 5) = 120/252.
  checks.splitHalf = splitHalfAgreement([Array(10).fill('A')]) === 1
    && splitHalfAgreement([[...Array(5).fill('A'), ...Array(5).fill('B')]]) === 0
    && near(splitHalfAgreement([[...Array(6).fill('A'), ...Array(4).fill('B')]], { draws: 2000 }), 120 / 252, 0.04);
  // Sampling: the 15% cap binds and lifts only to reach 60; balance prefers 50/50 where supply allows.
  const mk = (b, cls, n) => Array.from({ length: n }, (_, i) => ({ k: `${b}__${cls}${String(i).padStart(3, '0')}`, battleId: b, cls }));
  const capped = drawSample([...mk('B1', 'hold', 100), ...['b2', 'b3', 'b4', 'b5', 'b6'].flatMap((b) => mk(b, 'hold', 4))], { target: 100 });
  checks.sampleCapLifts = capped.n === 60 && capped.capLifted === true && capped.picks.filter((p) => p.battleId === 'B1').length === 40;
  const balanced = drawSample([...['A1', 'A2', 'A3', 'A4'].flatMap((b) => mk(b, 'action', 15)), ...['H1', 'H2', 'H3'].flatMap((b) => [...mk(b, 'action', 15), ...mk(b, 'hold', 15)])], { target: 100 });
  const perBattle = (ps) => Math.max(...Object.values(ps.reduce((o, p) => inc(o, p.battleId), {})));
  checks.sampleBalance = balanced.n === 100 && balanced.picks.filter((p) => p.cls === 'hold').length === 45 && perBattle(balanced.picks) <= 15;
  // One battle supplies every action, so the full sample opens with its 45 picks: a prefix cut would keep all 45.
  const lopsided = drawSample([...mk('X', 'action', 60), ...['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9'].flatMap((b) => mk(b, 'hold', 40))], { target: 300 });
  const reduced = reduceSample(lopsided.picks, 120);
  checks.reduceKeepsCap = lopsided.n === 300 && reduced.length === 120 && perBattle(reduced) <= Math.floor(BATTLE_CAP_SHARE * 120);
  // Donors: never the same agent, never the same text; same archetype first.
  const pool = [
    { k: 'p1', agentId: 'x', archetype: 'tf', learnedHash: 'h1' }, { k: 'p2', agentId: 'y', archetype: 'tf', learnedHash: 'h2' },
    { k: 'p3', agentId: 'z', archetype: 'ct', learnedHash: 'h3' }, { k: 'p4', agentId: 'w', archetype: 'tf', learnedHash: 'h1' },
  ];
  const donors = assignDonors([{ k: 't1', agentId: 'x', archetype: 'tf', learnedHash: 'h1' }, { k: 't2', agentId: 'z', archetype: 'ct', learnedHash: 'h3' }], pool);
  // The target agent itself holds a different text (h4): it must still never be its own donor.
  const selfPool = [{ k: 'q1', agentId: 'x', archetype: 'tf', learnedHash: 'h1' }, { k: 'q2', agentId: 'x', archetype: 'tf', learnedHash: 'h4' }, { k: 'q3', agentId: 'z', archetype: 'ct', learnedHash: 'h3' }];
  const selfDonor = assignDonors([{ k: 't3', agentId: 'x', archetype: 'tf', learnedHash: 'h1' }], selfPool);
  checks.donors = donors.t1?.agentId === 'y' && donors.t1?.pairing === 'donor_same_archetype'
    && donors.t2 && donors.t2.agentId !== 'z' && donors.t2.learnedHash !== 'h3' && donors.t2.pairing === 'donor_other_archetype'
    && selfDonor.t3?.agentId === 'z' && selfDonor.t3?.pairing === 'donor_other_archetype';
  // Cost: the worst case prices output at max_tokens.
  const oneTask = costOf([{ k: 'a', arm: 'base', variant: 'verbatim', model: 'm', rep: 1 }], { m: { input: 1000, output: 100, maxTokens: 1000, cacheMultiplier: 1 } }, () => ({ batchIn: 1, batchOut: 1 }));
  checks.costWorst = near(oneTask.planned, 1100 / 1e6, 1e-15) && near(oneTask.worst, 2000 / 1e6, 1e-15);
  // The cut order: loadout first, then Opus repeats, then N, then Opus — stopping as soon as both caps hold.
  const cutCase = (evaluate) => fitToCaps({ fullN: 300, hasOpus: true, evaluate }, { caps: { plannedUsd: 100, worstUsd: 200 } });
  const priced = (cfg) => ({ cost: { planned: (cfg.loadout ? 60 : 40) + (cfg.opus ? (cfg.opusRepeats ? 30 : 50) : 0) + cfg.n / 10, worst: 150 } });
  // The batch-effect check's repeats: the largest equal count in [5, 10] under both caps, else none.
  const flat = { prod: { input: 1000, output: 0, maxTokens: 1, cacheMultiplier: 1 } };
  const tenTicks = Array.from({ length: 10 }, (_, i) => `t${i}`);
  const fitArgs = (planned) => ({ est: { pilot: flat, conservative: flat }, priceOf: () => ({ batchIn: 1, batchOut: 1 }), caps: { plannedUsd: planned, worstUsd: 1 } });
  checks.batchCheckRepeats = batchCheckTasks(tenTicks, 3).length === 60
    && fitRepeats(tenTicks, fitArgs(0.15)).repeats === 7 && fitRepeats(tenTicks, fitArgs(1)).repeats === 10 && fitRepeats(tenTicks, fitArgs(0.05)) === null;
  // Delta review E1: a case where only the WORST cap binds, and one where the conservative estimate is the larger.
  const worstOnly = { prod: { input: 1000, output: 0, maxTokens: 1000, cacheMultiplier: 1 } }; // $0.02 planned / $0.04 worst per repeat
  const unit = () => ({ batchIn: 1, batchOut: 1 });
  checks.batchCheckWorstCap = fitRepeats(tenTicks, { est: { pilot: worstOnly, conservative: worstOnly }, priceOf: unit, caps: { plannedUsd: 1, worstUsd: 0.3 } })?.repeats === 7;
  const lowPilot = { prod: { input: 1000, output: 0, maxTokens: 1, cacheMultiplier: 1 } };
  const highCons = { prod: { input: 2000, output: 0, maxTokens: 1, cacheMultiplier: 1 } };
  checks.batchCheckConservative = fitRepeats(tenTicks, { est: { pilot: lowPilot, conservative: highCons }, priceOf: unit, caps: { plannedUsd: 0.15, worstUsd: 1 } }) === null;
  checks.batchCheckNullMaxTokens = fitRepeats(tenTicks, { est: { pilot: { prod: { ...flat.prod, maxTokens: null } }, conservative: flat }, priceOf: unit, caps: { plannedUsd: 1, worstUsd: 1 } }) === null;
  // The spend-time check: the real r = 10 plan is blocked under {50, 68}; r = 8 passes; malformed figures fail closed.
  checks.capCheck = capCheck({ planned: 57.69, worst: 82.81 }, 0, { runCaps: { plannedUsd: 50, worstUsd: 68 } }).ok === false
    && capCheck({ planned: 46.15, worst: 66.25 }, 0, { runCaps: { plannedUsd: 50, worstUsd: 68 } }).ok === true
    && capCheck({ planned: 57.69, worst: 82.81 }, 0, { derived: true }).ok === false
    && capCheck({ planned: 46.15, worst: 66.25 }, 0, { runCaps: { plannedUsd: 50 } }).ok === false
    && capCheck({ planned: 46.15, worst: 31.84 }, 0, { runCaps: { plannedUsd: 50, worstUsd: 68 } }).ok === false
    && capCheck({ planned: 100, worst: 150 }, 0).ok === true && capCheck({ planned: 100, worst: 150 }, 60).ok === false;
  // The ruling's three comparisons, the batch-check caps, the repeat bounds and the task shape (delta review D2).
  checks.batchCheckSpec = JSON.stringify(BATCHCHECK_COMPARISONS.map((c) => [c.name, c.base, c.variant])) === JSON.stringify([['batchEffect', ['original', 'base'], ['fresh', 'base']], ['learning', ['fresh', 'base'], ['fresh', 'memory:strip']], ['replication', ['original', 'memory:strip'], ['fresh', 'memory:strip']]])
    && BATCHCHECK_CAPS.plannedUsd === 50 && BATCHCHECK_CAPS.worstUsd === 68;
  const shape = batchCheckTasks(['a', 'b'], 3);
  checks.batchCheckShape = shape.length === 12 && ['a', 'b'].every((k) => shape.filter((t) => t[0] === k && t[1] === 'base' && t[2] === 'verbatim' && t[3] === 'prod').length === 3
    && shape.filter((t) => t[0] === k && t[1] === 'memory' && t[2] === 'strip' && t[3] === 'prod').length === 3);
  checks.batchCheckBounds = fitRepeats(tenTicks, fitArgs(0.11))?.repeats === 5 && fitRepeats(tenTicks, fitArgs(0.09)) === null;
  // The exhibits block survives a rewrite, and malformed markers are refused (delta review D1/D7).
  const blk = extractBatchcheckBlock('main\n\n<!-- batchcheck:start -->\nX\n<!-- batchcheck:end -->\n');
  checks.exhibitsBlock = blk.ok && blk.block === '<!-- batchcheck:start -->\nX\n<!-- batchcheck:end -->' && blk.rest === 'main\n'
    && extractBatchcheckBlock('main\n<!-- batchcheck:start -->\nuser text').ok === false
    && extractBatchcheckBlock('plain').ok && extractBatchcheckBlock('plain').block === '';
  checks.cutOrder = cutCase(priced).cuts.join('|') === 'dropped the loadout variant|Opus repeats reduced to 3'
    && cutCase(() => ({ cost: { planned: 10, worst: 10 } })).cuts.length === 0
    && cutCase(() => ({ cost: { planned: 1e9, worst: 1e9 } })).over === true;

  const res = {
    noise: { T: round(noise.T), nullMean: round(noise.nullMean), nullP95: round(noise.nullP95), p: round(noise.p), excessFlip: round(noise.excessFlip), label: arm2Label(noise) },
    planted: { T: round(planted.T), nullMean: round(planted.nullMean), nullP95: round(planted.nullP95), p: round(planted.p), excessFlip: round(planted.excessFlip), label: arm2Label(planted) },
    smallShift: { T: round(small.T), nullMean: round(small.nullMean), p: round(small.p), excessFlip: round(small.excessFlip), label: arm2Label(small) },
    noiseFalsePositivesOf20: falsePositives,
    checks,
  };
  res.pass = res.noise.label === 'no measurable effect' && res.planted.label === 'moves decisions'
    && res.smallShift.label === 'measurable but small'
    && falsePositives <= 3 // Binomial(20, 0.05): P(≥ 4) ≈ 1.6% for a calibrated test
    && Object.values(checks).every(Boolean);
  return res;
}

// ---------------------------------------------------------------- CLI

export function parseArgs(argv) {
  const flags = { cmd: argv[2] || 'help', run: null, from: null, go: false, wait: false, force: false, noRetry: false };
  for (let i = 3; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--run') flags.run = argv[++i];
    else if (a === '--from') flags.from = argv[++i];
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
    case 'batchcheck-plan': return batchcheckPlan(flags);
    case 'batchcheck-analyze': return batchcheckAnalyze(flags);
    case 'selftest': {
      const r = runSelftest();
      console.log(JSON.stringify(r, null, 1));
      if (!r.pass) process.exitCode = 1;
      return undefined;
    }
    default:
      console.log('growthReplay — subcommands: plan | pilot | submit --go | status [--wait] | collect | analyze | selftest | batchcheck-plan --from <runId> | batchcheck-analyze  (options: --run <runId>)');
      return undefined;
  }
}

// CLI entrypoint only — importing this module runs nothing.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => { console.error(redactSecrets(err?.stack || String(err))); releaseLock(); process.exit(1); });
}
