#!/usr/bin/env node
// scripts/experiments/archetypeAblationReplay.mjs
//
// Archetype Input Ablation + Gate Intervention Census (Fable, 13 Oct 2026).
//
// An OFFLINE experiment over the tick capture (agentBattles/{id}/ticks and
// tickBodies, live since 21 Sep 2026). Two questions:
//   Q1 (Part A, model calls) — which prompt inputs move the Trading Brain's
//      decision when removed, and does swapping the archetype charter move it?
//   Q2 (Part B, no model calls) — how often do the deterministic layers change
//      what the model proposed, per archetype, and by which typed cause?
// It measures whether decisions CHANGE, never whether they are good.
//
// READ-ONLY AGAINST PRODUCTION BY CONSTRUCTION.
//   - Firestore: the Admin SDK is used for collection()/doc()/select()/get()/
//     getAll() only. There is no write call of any kind in this file.
//   - Model calls go from this script to api.anthropic.com with plain fetch
//     (Message Batches), never through a product handler, so no capture
//     record, battle document or cron state is written.
//   - One product module is imported: api/_utils/evalIdentityBlocks.js, the
//     frozen archetype charter constants (it imports only the zero-import
//     src/config/featureFlags.js). It initializes nothing and writes nothing;
//     the charter swap needs the Fundamental Investor render, which no
//     captured record carries.
//   - Pure helpers are reused from the growth replay
//     (scripts/experiments/growth-replay/growthReplay.js); importing it runs
//     nothing.
//   - Secrets: CLAUDE_API_KEY and FIREBASE_ADMIN_CREDENTIALS are read from the
//     environment, then this tree's .env.local, then the primary checkout's.
//     Nothing is printed, copied or written.
//
// Everything this writes lands OUTSIDE the repo, in
// %USERPROFILE%/ft-experiment-exhibits/ — request bodies, replies and the
// founder-read sample carry player text.
//
// USAGE (repo root), in the prompt's order:
//   node scripts/experiments/archetypeAblationReplay.mjs census        # Step 0, Step 1, Part B (no spend)
//   node scripts/experiments/archetypeAblationReplay.mjs plan          # Part A arm requests, edit verification, cost estimate (no spend)
//   node scripts/experiments/archetypeAblationReplay.mjs submit --go   # Message Batches, cap-checked in code
//   node scripts/experiments/archetypeAblationReplay.mjs status [--wait]
//   node scripts/experiments/archetypeAblationReplay.mjs collect
//   node scripts/experiments/archetypeAblationReplay.mjs analyze
//   node scripts/experiments/archetypeAblationReplay.mjs selftest      # synthetic checks of the edits and the flip rules

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync, createWriteStream, unlinkSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

import {
  PRICES, WISDOM_HEADER, FRESH_LINE, sha256Utf8, countOf, toMs, rng, shuffle,
  parseEnvText, primaryCheckoutRoot, redactSecrets, parseIdentity, findLeans,
  validateToolInput, validationSchema, isSpendLimitError,
} from './growth-replay/growthReplay.js';
import { EVAL_IDENTITY_BLOCKS, EVAL_IDENTITY_SUBORDINATION_CLAUSE, EVAL_IDENTITY_YIELD_CLAUSE } from '../../api/_utils/evalIdentityBlocks.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(HERE, '..', '..');

// ---------------------------------------------------------------- frozen constants

export const SEED = 20261013;
const CAPTURE_FLOOR_ISO = '2026-09-15T00:00:00.000Z'; // capture shipped 2026-09-21; every battle alive after this is walked
const SAMPLE_PER_ARCHETYPE = 60;
const SAMPLE_MIN = 20;
const MAX_PER_BATTLE = 6;
const RECENT_TRADING_DAYS = 15;

/** §1 budget, enforced at plan and at submit. Raised only by Flash's reply. */
export const CAPS = Object.freeze({ calls: 4000, usd: 25 });

/** §7 frozen bars (percentage points). Applied as written; never moved here. */
export const BARS = Object.freeze({ B0_noisy: 30, B1_loadBearing: 10, B2_charter: 15, B3_constraint: 15, B4_restrictive: 20 });

const ANTHROPIC = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
const BATCH_MAX_REQUESTS = 10_000;
const BATCH_MAX_BYTES = 100_000_000;
const BATCH_TARGET_BYTES = 40 * 1024 * 1024;
const POLL_EVERY_MS = 3 * 60 * 1000;
const POLL_FOR_MS = 2 * 60 * 60 * 1000;
const PROD_TOOL_NAME = 'submit_trade_decision';
const EXPECTED_KEYS = ['model', 'max_tokens', 'temperature', 'system', 'messages', 'tools', 'tool_choice'];

/** Display names (the six constitutions; evalIdentityBlocks.js:84-91). */
export const ARCHETYPES = Object.freeze({
  momentum_chaser: 'Trend Follower',
  contrarian: 'Contrarian',
  degen: 'Speculator',
  guardian: 'Capital Preserver',
  diversifier: 'Diversifier',
  analyst: 'Fundamental Investor',
});
/** A6 pairs (prompt §5). */
export const CHARTER_PAIRS = Object.freeze({
  momentum_chaser: 'contrarian', contrarian: 'momentum_chaser',
  degen: 'guardian', guardian: 'degen',
  diversifier: 'analyst', analyst: 'diversifier',
});

export const ARMS = Object.freeze(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A6n']);
/** Secondary lines: measured and tabulated, never given a bar outcome. */
export const SECONDARY_ARMS = Object.freeze(['A6n']);
export const ARM_LABELS = Object.freeze({
  A0: 'resend unchanged (noise floor)',
  A1: 'stories removed',
  A2: 'bench technicals removed',
  A3: 'soft preferences removed',
  A4: 'learned text removed',
  A5: 'voice / market context removed',
  A6: 'charter swapped',
  A6n: 'charter + both archetype-name mentions swapped (secondary, no bar)',
  A7: 'hard-constraint text removed',
});

// Section markers, from the fenced assembler (read only) — cited in the report.
const SEP = '\n\n';
const RULES_HEADER = 'YOUR FORGE RULES:\n';
const C_HEADER = '== CONSTRAINTS (must obey) ==\n';
const S_HEADER = '== STRATEGY PREFERENCES (should follow) ==\n';
const NEWS_INTEL_HEADER = 'FANTASYTIMES INTELLIGENCE (recent stories from your newsroom):';
const NEWS_INTEL_TAIL = 'A strategy preference (S-rule) can be amplified or dampened by story context.';
const NEWS_BARE_HEADER = 'FANTASYTIMES BREAKING NEWS:';
const LAST3_HEADER = 'YOUR LAST 3 DECISIONS:\n';
const BENCH_TECH_HEADER = 'BENCH TECHNICAL CONTEXT:';
const IDENTITY_BANNER = '━━━ ARCHETYPE IDENTITY ━━━\n\n';
/** The live-context parts that can follow the bench technical block, in assembly order. */
const AFTER_BENCH_TECH = [
  'FUNDAMENTALS (held + bench', 'CLOSED TRADES THIS BATTLE:', 'TRIGGER (why you were woken up):',
  'INTRADAY MOMENTUM SNAPSHOT:', 'RISK STATUS:\n', 'ACTIVE DIRECTIVE (from your Coach):',
  'STANDING LEANS (user-equipped persistent adjustments):', '=== INSTITUTIONAL INTELLIGENCE (13F Filings) ===',
  NEWS_INTEL_HEADER, NEWS_BARE_HEADER, 'YOUR LAST 3 DECISIONS:',
];

/** Presence census over every eligible request (section map cross-check, A4/A5 applicability). */
const CENSUS_MARKERS = {
  system: ['━━━ ARCHETYPE IDENTITY ━━━', '━━━ SCORING RULES ━━━', '━━━ DECISION FRAMEWORK ━━━', '━━━ FORGE RULES ━━━', '━━━ ANTI-THRASH RULES (MANDATORY) ━━━', '━━━ SURVIVAL MODE ━━━', '━━━ INNER MONOLOGUE FORMAT ━━━', 'DECISION PRECEDENCE (highest to lowest):'],
  identity: ['ABOUT YOU:\n', 'YOUR STRATEGIC BRIEF (from when you built this portfolio):\n', 'YOUR INITIAL PORTFOLIO RATIONALE:\n', WISDOM_HEADER, FRESH_LINE, RULES_HEADER, C_HEADER, S_HEADER, 'C_INST: INSTITUTIONAL DATA LAG'],
  live: ['━━━ LIVE BATTLE STATE ━━━', 'MACRO BENCHMARKS TODAY:', '## Vision State', 'REGIME CONTEXT:\n', 'STRATEGY PRESET: ', 'ACTIVE POSITIONS:\n', 'BENCH (available for swap):', 'BENCH: Empty', BENCH_TECH_HEADER, 'FUNDAMENTALS (held + bench', 'CLOSED TRADES THIS BATTLE:', 'TRIGGER (why you were woken up):', 'INTRADAY MOMENTUM SNAPSHOT:', 'RISK STATUS:\n', 'ACTIVE DIRECTIVE (from your Coach):', 'STANDING LEANS (user-equipped persistent adjustments):', '=== INSTITUTIONAL INTELLIGENCE (13F Filings) ===', NEWS_INTEL_HEADER, NEWS_BARE_HEADER, 'YOUR LAST 3 DECISIONS:'],
  // A4/A5 reach probes: the voice layer's market context and the learned-text forms other than the wisdom paragraph.
  probes: ['Daily Regime Brief', 'MARKET CONTEXT', 'LESSON', 'Lesson', 'DOSSIER', 'Dossier', 'memory', 'RSI=', 'MACD', 'RVOL='],
};

// ---------------------------------------------------------------- small helpers

const round = (x, d = 1) => (x == null || !Number.isFinite(x) ? null : Number(x.toFixed(d)));
const pct = (num, den) => (den ? (100 * num) / den : null);
const inc = (o, k, by = 1) => { o[k] = (o[k] || 0) + by; return o; };
const sym = (s) => (typeof s === 'string' && s.trim() ? s.trim().toUpperCase() : null);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function groupBy(list, keyFn) {
  const out = {};
  for (const x of list) { const k = keyFn(x); (out[k] || (out[k] = [])).push(x); }
  return out;
}

/** The ET calendar date (YYYY-MM-DD) of an instant. */
export function etDate(ms) {
  if (!Number.isFinite(ms)) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ---------------------------------------------------------------- env + credentials

function loadEnv() {
  const files = [path.join(PROJECT_ROOT, '.env.local')];
  const primary = primaryCheckoutRoot(PROJECT_ROOT);
  if (primary) files.push(path.join(primary, '.env.local'));
  const merged = {};
  const rank = {};
  files.forEach((f, i) => {
    if (!existsSync(f)) return;
    for (const [k, v] of Object.entries(parseEnvText(readFileSync(f, 'utf8')))) if (merged[k] === undefined) { merged[k] = v; rank[k] = i + 1; }
  });
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && v !== '') { merged[k] = v; rank[k] = 0; }
  return { env: merged, rank };
}

let heldLock = null;
function stop(message, code = 2) {
  console.error(`\nSTOP: ${redactSecrets(message)}`);
  releaseLock();
  process.exit(code);
}

const KEY_FORMAT = /^sk-ant-[A-Za-z0-9_-]+$/;
/** The variable the production brain call site reads (api/cron/agent-evaluate.js:229). */
function anthropicKey(env) {
  const key = env.CLAUDE_API_KEY;
  if (typeof key !== 'string' || !key.startsWith('sk-ant-')) stop('CLAUDE_API_KEY is not set (checked the environment, this tree\'s .env.local, then the primary checkout\'s .env.local).');
  if (!KEY_FORMAT.test(key)) stop('CLAUDE_API_KEY is malformed (value not printed).');
  return key;
}

function serviceAccount(env, rank = {}) {
  const hasJson = Boolean(env.FIREBASE_ADMIN_CREDENTIALS);
  const hasSplit = Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
  const splitRank = Math.max(rank.FIREBASE_PROJECT_ID ?? 9, rank.FIREBASE_CLIENT_EMAIL ?? 9, rank.FIREBASE_PRIVATE_KEY ?? 9);
  const useJson = hasJson && (!hasSplit || (rank.FIREBASE_ADMIN_CREDENTIALS ?? 9) <= splitRank);
  if (useJson) {
    let sa = null;
    try { sa = JSON.parse(env.FIREBASE_ADMIN_CREDENTIALS); } catch { sa = null; }
    if (!isObj(sa) || typeof sa.private_key !== 'string' || typeof sa.project_id !== 'string') stop('FIREBASE_ADMIN_CREDENTIALS is not a service-account JSON object (value not printed).');
    return sa;
  }
  if (hasSplit) return { project_id: env.FIREBASE_PROJECT_ID, client_email: env.FIREBASE_CLIENT_EMAIL, private_key: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') };
  return stop('FIREBASE_ADMIN_CREDENTIALS is not set (checked the environment, this tree\'s .env.local, then the primary checkout\'s .env.local).');
}

/** firebase-admin resolved from this tree, else from the primary checkout (an app worktree has no node_modules). */
function requireFromProject(spec) {
  const roots = [PROJECT_ROOT, primaryCheckoutRoot(PROJECT_ROOT)].filter(Boolean);
  for (const root of roots) {
    try { return createRequire(path.join(root, 'package.json'))(spec); } catch { /* next root */ }
  }
  return stop(`cannot resolve ${spec} from ${roots.join(' or ')} — run npm install in the checkout.`);
}

function openFirestore(env, rank) {
  const sa = serviceAccount(env, rank);
  const { initializeApp, cert } = requireFromProject('firebase-admin/app');
  const { getFirestore } = requireFromProject('firebase-admin/firestore');
  let credential;
  try { credential = cert(sa); } catch { stop('the Firebase service account was rejected by firebase-admin (value not printed).'); }
  const app = initializeApp({ credential }, 'archetype-ablation');
  console.log(`[ablation] Firestore project_id: ${sa.project_id}`);
  return getFirestore(app);
}

/** READ-ONLY reader: every method reads. There is deliberately no write method. */
function makeReader(db) {
  return {
    async battleIndex() {
      const snap = await db.collection('agentBattles')
        .select('status', 'expiresAt', 'createdAt', 'gameMode', 'isCpu', 'ownerId', 'agentId', 'agentContext.archetype', 'cronState.tickSeq')
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
    async chatExchanges(battleId) {
      const snap = await db.collection('agentBattles').doc(battleId).get();
      const x = snap.exists ? snap.get('chatExchanges') : null;
      return Array.isArray(x) ? x : [];
    },
  };
}

// ---------------------------------------------------------------- the decision tuple

/**
 * The decision of one reply: the FIRST tool_use block (agent-evaluate.js:2944),
 * validated like production (agentEvalToolResultValidation.js) against the
 * request's own schema minus `declarations` — the growth replay's key of record.
 */
export function replyTuple(message, schema) {
  const block = Array.isArray(message?.content) ? message.content.find((b) => b?.type === 'tool_use') : null;
  if (!block) return { valid: false, action: 'malformed', why: 'no_tool_use' };
  const v = validateToolInput(block.input, validationSchema(schema));
  if (!v.valid) return { valid: false, action: 'malformed', why: `invalid:${v.field}` };
  const d = block.input.decision;
  return {
    valid: true,
    action: d,
    out: d === 'SWAP' ? sym(block.input.symbolOut) : null,
    in: d === 'SWAP' ? sym(block.input.symbolIn) : null,
    swapType: d === 'SWAP' ? (block.input.swap_type ?? null) : null,
    conviction: Number.isFinite(block.input.conviction) ? block.input.conviction : null,
  };
}

/** The captured decision: the permanent record's ORIGINAL enums + the body's original swap_type. */
export function capturedTuple(perm, body) {
  const d = perm?.decision?.original ?? null;
  if (d !== 'SWAP' && d !== 'HOLD') return null;
  return {
    valid: true,
    action: d,
    out: d === 'SWAP' ? sym(perm.decision.originalSymbolOut) : null,
    in: d === 'SWAP' ? sym(perm.decision.originalSymbolIn) : null,
    swapType: d === 'SWAP' ? (body?.originalToolResult?.swap_type ?? null) : null,
  };
}

/**
 * Prompt §5: action flip = the action differs (a malformed reply is an action
 * flip — production would fail it closed to HOLD — and is also counted on its
 * own); symbol flip = same action, different incoming or outgoing symbol;
 * reason-only = same action and symbols, different swap_type (secondary line,
 * never folded into "any flip").
 */
export function compareTuples(orig, reply) {
  const actionFlip = !reply.valid || reply.action !== orig.action;
  const symbolFlip = !actionFlip && orig.action === 'SWAP' && (reply.out !== orig.out || reply.in !== orig.in);
  const reasonOnly = !actionFlip && !symbolFlip && orig.action === 'SWAP' && (reply.swapType ?? null) !== (orig.swapType ?? null);
  return { actionFlip, symbolFlip, anyFlip: actionFlip || symbolFlip, reasonOnly, malformed: !reply.valid };
}

// ---------------------------------------------------------------- section location and the arm edits

/** One whole part of a '\n\n'-joined block: [start, end) INCLUDING the separator that joins it. */
function uniqueIndex(hay, needle) {
  const n = countOf(hay, needle);
  return n === 1 ? hay.indexOf(needle) : (n === 0 ? -1 : -2);
}

/** A rules chunk (C or S) inside the FORGE RULES part of messages[0] (agentEvalPromptAssembly.js:803-835). */
export function findRulesChunk(identityText, header, linePrefix) {
  const identity = parseIdentity(identityText);
  if (!identity.rules) return { status: 'absent' };
  const bodyAt = identity.rules.start + SEP.length + RULES_HEADER.length;
  if (!identityText.startsWith(RULES_HEADER, identity.rules.start + SEP.length)) return { status: 'ambiguous', why: 'rules_header' };
  let at = -1;
  if (identityText.startsWith(header, bodyAt)) at = bodyAt;
  else {
    const i = uniqueIndex(identityText.slice(bodyAt), SEP + header);
    if (i === -2) return { status: 'ambiguous', why: 'header_twice' };
    if (i >= 0) at = bodyAt + i + SEP.length;
  }
  if (at < 0) return { status: 'absent' };
  const end = identityText.indexOf(SEP, at);
  if (end < 0) return { status: 'ambiguous', why: 'no_trailer' };
  const lines = identityText.slice(at + header.length, end).split('\n');
  if (!lines.length || !lines.every((l) => linePrefix.test(l))) return { status: 'ambiguous', why: 'rule_lines' };
  // First chunk: drop it with the separator AFTER it; later chunk: with the one BEFORE it.
  const span = at === bodyAt ? { start: at, end: end + SEP.length } : { start: at - SEP.length, end };
  return { status: 'present', span, count: lines.length };
}

/** The FantasyTimes block of messages[2] (agentEvalPromptAssembly.js:1258-1276; agentNewsContext.js:207-302). */
export function findNews(liveText) {
  const iIntel = uniqueIndex(liveText, SEP + NEWS_INTEL_HEADER);
  const iBare = uniqueIndex(liveText, SEP + NEWS_BARE_HEADER);
  if (iIntel === -2 || iBare === -2 || (iIntel >= 0 && iBare >= 0)) return { status: 'ambiguous', why: 'news_headers' };
  if (iIntel < 0 && iBare < 0) return { status: 'absent' };
  const kind = iIntel >= 0 ? 'intelligence' : 'bare';
  const start = iIntel >= 0 ? iIntel : iBare;
  const nextAt = liveText.indexOf(SEP + LAST3_HEADER, start + SEP.length);
  const end = nextAt >= 0 ? nextAt : liveText.length;
  const block = liveText.slice(start + SEP.length, end);
  if (kind === 'intelligence' && !block.endsWith(NEWS_INTEL_TAIL)) return { status: 'ambiguous', why: 'intel_tail' };
  if (kind === 'bare' && !block.slice(NEWS_BARE_HEADER.length + 1).split('\n').every((l) => l.startsWith('- ['))) return { status: 'ambiguous', why: 'bare_lines' };
  return { status: 'present', kind, span: { start, end }, block };
}

/** The bench technical block of messages[2] (agentEvalPromptAssembly.js:1171-1177, :1535-1586). */
export function findBenchTech(liveText) {
  const start = uniqueIndex(liveText, SEP + BENCH_TECH_HEADER + SEP);
  if (start === -2) return { status: 'ambiguous', why: 'header_twice' };
  if (start < 0) return { status: 'absent' };
  let end = liveText.length;
  for (const h of AFTER_BENCH_TECH) {
    const i = liveText.indexOf(SEP + h, start + SEP.length);
    if (i >= 0 && i < end) end = i;
  }
  const blocks = liveText.slice(start + SEP.length + BENCH_TECH_HEADER.length + SEP.length, end).split(SEP);
  const ok = blocks.length > 0 && blocks.every((b) => {
    const [head, ...rest] = b.split('\n');
    return /^\S+ \(.*\):$/.test(head) && rest.length > 0 && rest.every((l) => l.startsWith('  '));
  });
  if (!ok) return { status: 'ambiguous', why: 'bench_blocks' };
  return { status: 'present', span: { start, end }, symbols: blocks.length };
}

/** The archetype charter render inside the system prompt (evalIdentityBlocks.js:196-199). */
export function findCharter(systemText, archetypeKey) {
  const own = EVAL_IDENTITY_BLOCKS[archetypeKey]?.render;
  if (!own) return { status: 'absent', why: 'no_constant_for_key' };
  const b = uniqueIndex(systemText, IDENTITY_BANNER);
  if (b === -2) return { status: 'ambiguous', why: 'banner_twice' };
  if (b < 0) return { status: 'absent', why: 'no_identity_block' };
  const start = b + IDENTITY_BANNER.length;
  if (!systemText.startsWith(own + SEP, start)) return { status: 'ambiguous', why: 'render_mismatch' };
  const end = start + own.length;
  const rest = systemText.slice(end + SEP.length);
  const clause = rest.startsWith(EVAL_IDENTITY_SUBORDINATION_CLAUSE + '\n') ? 'subordination' : rest.startsWith(EVAL_IDENTITY_YIELD_CLAUSE + '\n') ? 'yield' : null;
  if (!clause) return { status: 'ambiguous', why: 'clause_mismatch' };
  return { status: 'present', span: { start, end }, clause };
}

/** The display-cased archetype label the assembler prints (agentEvalPromptAssembly.js:751; agent-evaluate.js:2691). */
export const displayArchetype = (key) => (key || 'unknown').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** The two plain-name mentions of the archetype: the system preamble (:345 / :550) and ABOUT YOU (:754). */
export function findArchetypeNames(req, archetypeKey) {
  const name = displayArchetype(archetypeKey);
  const pre = 'Your archetype is ';
  const p = uniqueIndex(req.system, `${pre}${name}. You are mid-battle`);
  const a = uniqueIndex(req.messages[0].content, `\nArchetype: ${name}\n`);
  if (p < 0 || a < 0) return { status: p === -2 || a === -2 ? 'ambiguous' : 'absent' };
  return {
    status: 'present',
    preamble: { start: p + pre.length, end: p + pre.length + name.length },
    about: { start: a + '\nArchetype: '.length, end: a + '\nArchetype: '.length + name.length },
  };
}

/** Every arm's location facts for one request (a missing section ⇒ the arm is not applicable to this record). */
export function locateArms(req, archetypeKey) {
  const sys = req.system;
  const idt = req.messages[0].content;
  const live = req.messages[2].content;
  const identity = parseIdentity(idt);
  const cChunk = findRulesChunk(idt, C_HEADER, /^C\d+\. /);
  const sChunk = findRulesChunk(idt, S_HEADER, /^S\d+\. /);
  const leans = findLeans(live);
  const news = findNews(live);
  const bench = findBenchTech(live);
  const charter = findCharter(sys, archetypeKey);
  const names = findArchetypeNames(req, archetypeKey);
  return { identity, cChunk, sChunk, leans, news, bench, charter, names };
}

const cloneRequest = (req) => JSON.parse(JSON.stringify(req));
const fieldText = (r, field) => (field === 'system' ? r.system : r.messages[field === 'm0' ? 0 : 2].content);

/** Apply a field's edits right-to-left, refusing overlaps. */
function applyEdits(text, edits) {
  const sorted = [...edits].sort((x, y) => y.span.start - x.span.start);
  let out = text;
  let floor = Infinity;
  for (const e of sorted) {
    if (e.span.end > floor || e.span.start > e.span.end) throw new Error('overlapping or inverted edit spans');
    out = out.slice(0, e.span.start) + e.text + out.slice(e.span.end);
    floor = e.span.start;
  }
  return out;
}

/**
 * Apply one arm. Returns { request, edits: [{field, span, text, removed, added}] }
 * or { na: reason }. Only the targeted spans move (verified by verifyEdit).
 */
export function applyArm(req, arm, archetypeKey, loc = locateArms(req, archetypeKey)) {
  const out = cloneRequest(req);
  const edits = [];
  const edit = (field, span, text = '') => edits.push({ field, span, text, removed: span.end - span.start, added: text.length });
  const finish = (extra = {}) => {
    for (const field of ['system', 'm0', 'm2']) {
      const own = edits.filter((e) => e.field === field);
      if (!own.length) continue;
      const after = applyEdits(fieldText(req, field), own);
      if (field === 'system') out.system = after; else out.messages[field === 'm0' ? 0 : 2].content = after;
    }
    return { request: out, edits, ...extra };
  };
  const na = (prefix, x) => ({ na: `${prefix}_${x.status}${x.why ? `:${x.why}` : ''}` });
  switch (arm) {
    case 'A0':
      return finish();
    case 'A1':
      if (loc.news.status !== 'present') return na('news', loc.news);
      edit('m2', loc.news.span);
      return finish({ kind: loc.news.kind });
    case 'A2':
      if (loc.bench.status !== 'present') return na('bench_tech', loc.bench);
      edit('m2', loc.bench.span);
      return finish();
    case 'A3': {
      const s = loc.sChunk.status === 'present';
      const l = loc.leans.status === 'present';
      if (loc.sChunk.status === 'ambiguous' || loc.leans.status === 'ambiguous') return { na: 'soft_ambiguous' };
      if (!s && !l) return { na: 'soft_absent' };
      if (s) edit('m0', loc.sChunk.span);
      if (l) edit('m2', loc.leans.span);
      return finish({ parts: { sRules: s ? loc.sChunk.count : 0, leans: l ? loc.leans.count : 0 } });
    }
    case 'A4':
      if (loc.identity.status !== 'learned') return { na: `learned_${loc.identity.status}` };
      edit('m0', loc.identity.learned, FRESH_LINE);
      return finish();
    case 'A5':
      return { na: 'not_applicable_at_head' };
    case 'A6':
    case 'A6n': {
      const partner = CHARTER_PAIRS[archetypeKey];
      if (!partner) return { na: 'no_pair' };
      if (loc.charter.status !== 'present') return na('charter', loc.charter);
      edit('system', loc.charter.span, EVAL_IDENTITY_BLOCKS[partner].render);
      if (arm === 'A6n') {
        // Secondary line (not a bar outcome): the charter AND the two plain-name mentions.
        if (loc.names.status !== 'present') return na('names', loc.names);
        edit('system', loc.names.preamble, displayArchetype(partner));
        edit('m0', loc.names.about, displayArchetype(partner));
      }
      return finish({ partner });
    }
    case 'A7':
      if (loc.cChunk.status !== 'present') return na('constraints', loc.cChunk);
      edit('m0', loc.cChunk.span);
      return finish();
    default:
      throw new Error(`unknown arm ${arm}`);
  }
}

/**
 * The edited request differs from the original ONLY inside the targeted spans:
 * every non-content field is byte-identical, an untargeted content is
 * unchanged, and a targeted content equals the original with exactly its
 * declared spans replaced (non-overlapping, right to left) — so every byte
 * outside the spans is the original's. (A common-prefix/suffix diff cannot be
 * used: when a removed part begins like the part after it, the two alignments
 * overlap and a correct removal reads as out of span.)
 */
export function verifyEdit(before, after, edits) {
  const strip = (r) => JSON.stringify({ ...r, system: null, messages: r.messages.map((m, i) => (i === 0 || i === 2 ? { ...m, content: null } : m)) });
  if (strip(before) !== strip(after)) throw new Error('an edit moved bytes outside the three prompt contents');
  for (const field of ['system', 'm0', 'm2']) {
    const a = fieldText(before, field);
    const b = fieldText(after, field);
    const own = edits.filter((x) => x.field === field);
    if (!own.length) { if (a !== b) throw new Error(`${field} changed but no edit targets it`); continue; }
    if (a === b) throw new Error(`${field}: an edit that changes nothing`);
    for (const e of own) {
      if (!(e.span.start >= 0 && e.span.end <= a.length) || e.removed !== e.span.end - e.span.start || e.added !== e.text.length) throw new Error(`${field}: malformed edit record`);
    }
    if (applyEdits(a, own) !== b) throw new Error(`${field}: changed outside its targeted spans`);
  }
  return true;
}

// ---------------------------------------------------------------- run folder

const EXHIBITS_ROOT = path.join(os.homedir(), 'ft-experiment-exhibits');
const RUN_DIR = path.join(EXHIBITS_ROOT, 'archetype-ablation-run');
const EXHIBITS_FILE = path.join(EXHIBITS_ROOT, '20261013_archetype_ablation_exhibits.md');
const P = (f) => path.join(RUN_DIR, f);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
function writeJsonAtomic(p, value) {
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 1));
  renameSync(tmp, p);
}
function acquireLock(cmd) {
  const p = P('run.lock');
  try {
    writeFileSync(p, JSON.stringify({ cmd, pid: process.pid, at: new Date().toISOString() }), { flag: 'wx' });
  } catch (err) {
    if (err?.code === 'EEXIST') stop(`another command holds ${p}. If none is running, remove that file and retry.`);
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
function headSha() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim(); } catch { return null; }
}
function scriptSha() { return sha256Utf8(readFileSync(fileURLToPath(import.meta.url), 'utf8')); }
function stamp(manifest, cmd) {
  (manifest.commandLog || (manifest.commandLog = [])).push({ cmd, at: new Date().toISOString(), headSha: headSha(), scriptSha256: scriptSha() });
}
function loadJsonl(file) {
  const out = [];
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split('\n')) if (line.trim()) out.push(JSON.parse(line));
  return out;
}

// ---------------------------------------------------------------- Part B: the gate census over one tick

const GATE_ORDER = ['lock', 'distressedVeto', 'proposedPairValidation', 'hurdle', 'swapCap', 'reservation', 'execution'];

/** The fenced validator's own error strings (agentSwapExecution.js validateTradeDecision) → a typed sub-cause. */
export function pairValidationCause(errors) {
  const kinds = [];
  for (const e of Array.isArray(errors) ? errors : []) {
    const t = String(e);
    if (/below 70 threshold/.test(t)) kinds.push('conviction_below_70');
    else if (/on 24h cooldown/.test(t)) kinds.push('cooldown');
    else if (/not found in active portfolio/.test(t)) kinds.push('symbolOut_not_held');
    else if (/not found in bench or watchlist/.test(t)) kinds.push('symbolIn_not_on_bench');
    else if (/already occupies an active portfolio slot/.test(t)) kinds.push('symbolIn_already_held');
    else if (/cannot replace itself/.test(t)) kinds.push('self_swap');
    else if (/crypto or vice versa/.test(t)) kinds.push('asset_class_mix');
    else if (/Hypothesis is missing/.test(t)) kinds.push('hypothesis_missing');
  }
  return kinds.length ? [...new Set(kinds)].sort().join('+') : 'unreadable';
}

/**
 * Classify one WOKEN tick (model.dispatched). Returns the Part B row:
 * proposal / final tuples and, when they differ, the typed cause read off the
 * record (never re-derived).
 */
export function classifyGate(perm, body) {
  const m = perm.model || {};
  if (m.outcome !== 'ok') {
    return { kind: 'model_failed', cause: `model_failed:${m.failureClass ?? 'unknown'}`, final: perm.decision?.final ?? null, holdKind: perm.decision?.holdKind ?? null };
  }
  const d = perm.decision || {};
  const orig = { action: d.original ?? null, out: sym(d.originalSymbolOut), in: sym(d.originalSymbolIn) };
  const fin = { action: d.final ?? null, out: sym(d.finalSymbolOut), in: sym(d.finalSymbolIn) };
  const same = orig.action === fin.action && (orig.action !== 'SWAP' || (orig.out === fin.out && orig.in === fin.in));
  if (same) return { kind: 'as_proposed', cause: null, orig, fin };
  const c = perm.checks || {};
  const g = perm.guardrail || {};
  let cause = 'unclassified';
  if (g.faultClass === 'guardrail_error') cause = 'guardrail_fault';
  else if (d.replacedByDeterministic === true) cause = 'guardrail_forced_swap';
  else {
    const blocked = GATE_ORDER.find((name) => c[name]?.result === 'blocked');
    if (blocked === 'proposedPairValidation') cause = `pair_validation:${pairValidationCause(body?.validationErrors)}`;
    else if (blocked === 'hurdle') cause = `hurdle:${c.hurdle.reason ?? 'unknown'}`;
    else if (blocked === 'reservation') cause = `reservation:${c.reservation.reason ?? 'unknown'}`;
    else if (blocked === 'execution') cause = `execution_refusal:${c.execution.reason ?? 'unknown'}`;
    else if (blocked) cause = blocked;
    else if (c.execution?.status === 'failed') cause = 'execution_failed';
    else if (c.execution?.status === 'bypassed' && c.execution?.reason === 'reservation_denied') cause = 'reservation:denied';
    else if (orig.action === 'SWAP' && fin.action === 'HOLD' && d.downgraded === true && g.evaluated === true && (c.lock?.status ?? 'not_evaluated') === 'not_evaluated') cause = 'guardrail_block';
  }
  return { kind: 'intervened', cause, orig, fin };
}

// ---------------------------------------------------------------- census (Step 0, Step 1, Part B)

/** NYSE full-day closures, 2026 (none falls inside the capture window; listed so the walk-back is exact). */
const NYSE_HOLIDAYS_2026 = new Set(['2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25']);

/** The most recent `n` NYSE sessions ending at (and including) the ET date `endDate`. */
export function recentTradingDays(endDate, n = RECENT_TRADING_DAYS) {
  const out = [];
  const d = new Date(`${endDate}T12:00:00Z`);
  while (out.length < n) {
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !NYSE_HOLIDAYS_2026.has(iso)) out.push(iso);
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

/**
 * Step 1 (prompt §4), read as written:
 *   - more than 59 available → up to 60, at most 6 per battle, round-robin over
 *     battles, the most recent 15 trading days first;
 *   - 20–59 available → take all;
 *   - under 20 → take all (reported; that archetype's bars are skipped).
 */
export function drawSample(eligible, recentDates, { target = SAMPLE_PER_ARCHETYPE, perBattle = MAX_PER_BATTLE, seed = SEED } = {}) {
  if (eligible.length < target) return [...eligible].sort((a, b) => a.k.localeCompare(b.k));
  const rand = rng(seed);
  const recent = new Set(recentDates);
  const tiers = [eligible.filter((r) => recent.has(r.etDate)), eligible.filter((r) => !recent.has(r.etDate))];
  const picks = [];
  const taken = {};
  for (const tier of tiers) {
    const byBattle = groupBy(shuffle([...tier].sort((a, b) => a.k.localeCompare(b.k)), rand), (r) => r.battleId);
    const order = shuffle(Object.keys(byBattle).sort(), rand);
    let progress = true;
    while (picks.length < target && progress) {
      progress = false;
      for (const b of order) {
        if (picks.length >= target) break;
        if ((taken[b] || 0) >= perBattle || !byBattle[b].length) continue;
        picks.push(byBattle[b].shift());
        taken[b] = (taken[b] || 0) + 1;
        progress = true;
      }
    }
  }
  return picks;
}

async function census() {
  mkdirSync(RUN_DIR, { recursive: true });
  acquireLock('census');
  const manifest = existsSync(P('manifest.json')) ? readJson(P('manifest.json')) : { createdAt: new Date().toISOString(), seed: SEED };
  stamp(manifest, 'census');
  const { env, rank } = loadEnv();
  const db = openFirestore(env, rank);
  const reader = makeReader(db);

  const floorMs = Date.parse(CAPTURE_FLOOR_ISO);
  const all = await reader.battleIndex();
  const walk = all.filter((b) => {
    const exp = toMs(b.expiresAt); const cre = toMs(b.createdAt);
    return (exp !== null && exp >= floorMs) || (cre !== null && cre >= floorMs) || b.status === 'active' || b.status === 'battle';
  });
  console.log(`[ablation] agentBattles: ${all.length} total, ${walk.length} alive on/after ${CAPTURE_FLOOR_ISO}`);

  const ownerLabel = {};
  const ownerOrder = [];
  const records = [];       // one per tick, permanent facts only
  const sourcesOut = [];    // woken bodies (player text) — local only
  const seqGaps = { battles: 0, minted: 0, documents: 0 };
  let battlesWithTicks = 0;

  const sortedWalk = [...walk].sort((a, b) => (toMs(a.createdAt) ?? 0) - (toMs(b.createdAt) ?? 0) || a.battleId.localeCompare(b.battleId));
  for (const b of sortedWalk) {
    const ticks = await reader.ticks(b.battleId);
    if (!ticks.length) continue;
    battlesWithTicks += 1;
    const minted = Number(b.cronState?.tickSeq) || 0;
    if (minted) { seqGaps.battles += 1; seqGaps.minted += minted; seqGaps.documents += ticks.length; }
    const woken = ticks.filter((t) => t.model?.dispatched === true).map((t) => t.tickId);
    const bodies = woken.length ? await reader.bodies(b.battleId, woken) : {};
    for (const t of ticks.sort((x, y) => (x.tickSeq ?? 0) - (y.tickSeq ?? 0))) {
      const owner = t.ownerId ?? b.ownerId ?? null;
      if (owner && !ownerLabel[owner]) { ownerLabel[owner] = `owner-${String.fromCharCode(65 + ownerOrder.length)}`; ownerOrder.push(owner); }
      const capturedMs = toMs(t.capturedAt);
      const rec = {
        k: `${b.battleId}/${t.tickId}`,
        battleId: b.battleId,
        tickId: t.tickId,
        archetype: b.agentContext?.archetype ?? 'unknown',
        owner: owner ? ownerLabel[owner] : 'none',
        isCpu: b.isCpu === true,
        gameMode: t.gameMode ?? b.gameMode ?? null,
        capturedAt: t.capturedAt ?? null,
        etDate: etDate(capturedMs),
        exitReason: t.exitReason ?? null,
        stageReached: t.stageReached ?? null,
        model: t.model ?? {},
        woken: t.model?.dispatched === true,
        bodyStatus: t.body?.status ?? null,
        bodyIncomplete: t.body?.incomplete ?? null,
        decision: t.decision ?? {},
        checks: t.checks ?? {},
        guardrail: t.guardrail ?? {},
        actions: Array.isArray(t.actions) ? t.actions.map((a) => ({ source: a.source ?? null, exitReason: a.exitReason ?? null, committed: a.committed === true })) : [],
        risk: { forcedExitCount: t.risk?.forcedExitCount ?? null, lockedCount: t.risk?.lockedCount ?? null },
        envelope: { requestedModel: t.callEnvelope?.requestedModel ?? null, temperature: t.callEnvelope?.temperature ?? null, inputTokens: t.callEnvelope?.inputTokens ?? null, outputTokens: t.callEnvelope?.outputTokens ?? null },
        controls: { directiveThreadId: t.controls?.directiveThreadId ? true : false, leanCount: (t.controls?.standingLeanIds || []).length, ruleCount: (t.controls?.activeRuleIds || []).length },
      };
      if (rec.woken) {
        const body = bodies[t.tickId];
        let bodyState = 'complete';
        let req = null; let resp = null;
        if (!body) bodyState = 'missing';
        else if (rec.bodyStatus !== 'written' || rec.bodyIncomplete !== null) bodyState = `incomplete:${rec.bodyStatus}${rec.bodyIncomplete ? `/${rec.bodyIncomplete}` : ''}`;
        else if (typeof body.request?.body !== 'string' || typeof body.response?.body !== 'string') bodyState = 'text_absent';
        else if (sha256Utf8(body.request.body) !== t.body?.requestSha256) bodyState = 'request_sha_mismatch';
        if (bodyState === 'complete') {
          try { req = JSON.parse(body.request.body); } catch { bodyState = 'request_unparseable'; }
          try { resp = JSON.parse(body.response.body); } catch { if (bodyState === 'complete') bodyState = 'response_unparseable'; }
        }
        rec.bodyState = bodyState;
        if (bodyState === 'complete') {
          rec.reserializes = JSON.stringify(req) === body.request.body;
          const keys = Object.keys(req || {});
          rec.shapeOk = JSON.stringify(keys) === JSON.stringify(EXPECTED_KEYS)
            && Array.isArray(req.messages) && req.messages.length === 3
            && req.messages.every((m) => typeof m?.content === 'string')
            && typeof req.system === 'string'
            && req.tools?.length === 1 && req.tools[0]?.name === PROD_TOOL_NAME
            && req.tool_choice?.type === 'tool' && req.tool_choice?.name === PROD_TOOL_NAME;
          rec.reqModel = req.model; rec.reqTemperature = req.temperature; rec.reqMaxTokens = req.max_tokens;
          rec.toolSchemaSha = sha256Utf8(JSON.stringify(req.tools));
          const orig = capturedTuple(t, body);
          const fromResp = replyTuple(resp, req.tools?.[0]?.input_schema);
          rec.origTuple = orig;
          rec.respAgrees = Boolean(orig && fromResp.valid && orig.action === fromResp.action && orig.out === fromResp.out && orig.in === fromResp.in && (orig.swapType ?? null) === (fromResp.swapType ?? null));
          sourcesOut.push({
            k: rec.k,
            request: body.request.body,
            response: body.response.body,
            originalToolResult: body.originalToolResult ?? null,
            finalToolResult: body.finalToolResult ?? null,
            validationErrors: body.validationErrors ?? [],
            controlsAsRendered: body.controlsAsRendered ?? null,
          });
        } else if (body) {
          sourcesOut.push({ k: rec.k, request: null, response: null, originalToolResult: body.originalToolResult ?? null, finalToolResult: body.finalToolResult ?? null, validationErrors: body.validationErrors ?? [] });
        }
        rec.gate = classifyGate(t, body);
      }
      records.push(rec);
    }
  }
  console.log(`[ablation] battles with tick records: ${battlesWithTicks}; tick records: ${records.length}; woken: ${records.filter((r) => r.woken).length}`);

  // Owner classes: CPU from the battle (`isCpu`); everyone else is non-CPU. Nothing on
  // the record says which non-CPU owner is the FT_QA tester, so none is labelled one.
  const ownerClass = {};
  for (const uid of ownerOrder) {
    const label = ownerLabel[uid];
    ownerClass[label] = records.some((r) => r.owner === label && r.isCpu) ? 'cpu' : 'non_cpu';
  }
  for (const r of records) r.ownerClass = r.isCpu ? 'cpu' : (ownerClass[r.owner] ?? 'unknown');

  // Directive gate census (Part B): status per exchange in the capture window, per archetype. Counts only.
  const firstMs = Math.min(...records.map((r) => toMs(r.capturedAt)).filter(Number.isFinite));
  const directive = {};
  const directiveClass = {};
  for (const b of sortedWalk) {
    if (!records.some((r) => r.battleId === b.battleId)) continue;
    const arch = b.agentContext?.archetype ?? 'unknown';
    const exchanges = await reader.chatExchanges(b.battleId);
    for (const x of exchanges) {
      const at = toMs(x?.timestamp);
      if (at !== null && at < firstMs) continue;
      const gate = x?.archetypeGate;
      if (!isObj(gate) && !(typeof x?.directiveThreadId === 'string' && isObj(x?.directive))) continue;
      // No gate record: a directive written by a route that never calls the chat gate
      // (file-directive.js chip filing, call-response.js) — labelled by its own fields.
      const status = isObj(gate) ? String(gate.status ?? 'unknown') : `no_gate:${x.source ?? 'no_source'}/${x.messageType ?? 'no_type'}/${x.mode ?? 'no_mode'}`;
      const filed = status === 'committed' ? (isObj(x.directive) ? 'committed_filed' : 'committed_not_filed') : status;
      inc(directive[arch] || (directive[arch] = {}), filed);
      if (isObj(gate)) inc(directiveClass[arch] || (directiveClass[arch] = {}), String(gate.classification ?? 'none'));
    }
  }

  // ---- Step 0.4 census table
  const table04 = {};
  for (const r of records) {
    const key = `${r.archetype}|${r.ownerClass}|${r.woken ? 'woken' : 'not_woken'}|${r.woken ? (r.bodyState === 'complete' ? 'body_complete' : r.bodyState) : '-'}`;
    inc(table04, key);
  }
  const notWoken = {};
  for (const r of records.filter((x) => !x.woken)) inc(notWoken[r.archetype] || (notWoken[r.archetype] = {}), r.model?.failureClass ? `model:${r.model.failureClass}` : (r.exitReason ?? 'none'));
  const wokenOutcome = {};
  for (const r of records.filter((x) => x.woken)) inc(wokenOutcome[r.archetype] || (wokenOutcome[r.archetype] = {}), r.model?.outcome === 'ok' ? 'ok' : `failed:${r.model?.failureClass ?? 'unknown'}`);
  const bodyStates = {};
  for (const r of records.filter((x) => x.woken)) inc(bodyStates, r.bodyState);

  // ---- eligibility for Part A
  const sources = Object.fromEntries(sourcesOut.filter((s) => s.request).map((s) => [s.k, s]));
  const eligible = [];
  const exclusions = {};
  const markerCounts = { system: {}, identity: {}, live: {}, probes: {} };
  const charterStates = {};
  for (const r of records.filter((x) => x.woken)) {
    const why = r.bodyState !== 'complete' ? `body:${r.bodyState}`
      : r.model?.outcome !== 'ok' ? `model:${r.model?.failureClass ?? 'failed'}`
        : !r.shapeOk ? 'request_shape'
          : !r.origTuple ? 'no_original_decision'
            : !r.respAgrees ? 'response_disagrees_with_record'
              : null;
    if (why) { inc(exclusions, why); continue; }
    const req = JSON.parse(sources[r.k].request);
    for (const m of CENSUS_MARKERS.system) if (req.system.includes(m)) inc(markerCounts.system, m);
    for (const m of CENSUS_MARKERS.identity) if (req.messages[0].content.includes(m)) inc(markerCounts.identity, m);
    for (const m of CENSUS_MARKERS.live) if (req.messages[2].content.includes(m)) inc(markerCounts.live, m);
    const whole = `${req.system}\n${req.messages.map((x) => x.content).join('\n')}`;
    for (const m of CENSUS_MARKERS.probes) if (whole.includes(m)) inc(markerCounts.probes, m);
    const loc = locateArms(req, r.archetype);
    inc(charterStates, `${r.archetype}:${loc.charter.status}${loc.charter.why ? `:${loc.charter.why}` : ''}${loc.charter.clause ? `:${loc.charter.clause}` : ''}`);
    r.applicable = {};
    for (const arm of ARMS) { const a = applyArm(req, arm, r.archetype, loc); r.applicable[arm] = a.na ? `na:${a.na}` : 'yes'; }
    eligible.push(r);
  }

  // ---- 0.6 reproducibility facts (over every eligible body; the 5-record spot check is in the exhibits)
  const repro = {
    eligible: eligible.length,
    reserializesByteIdentical: eligible.filter((r) => r.reserializes).length,
    models: {}, temperatures: {}, maxTokens: {}, toolSchemas: {}, envelopeModelAgrees: 0, envelopeTempAgrees: 0,
  };
  for (const r of eligible) {
    inc(repro.models, r.reqModel); inc(repro.temperatures, String(r.reqTemperature)); inc(repro.maxTokens, String(r.reqMaxTokens)); inc(repro.toolSchemas, r.toolSchemaSha.slice(0, 12));
    if (r.envelope.requestedModel === r.reqModel) repro.envelopeModelAgrees += 1;
    if (r.envelope.temperature === r.reqTemperature) repro.envelopeTempAgrees += 1;
  }

  // ---- STOP check (prompt §3)
  const eligibleBy = groupBy(eligible, (r) => r.archetype);
  const wokenBy = groupBy(records.filter((r) => r.woken), (r) => r.archetype);
  const measurable = Object.keys(ARCHETYPES).filter((a) => (eligibleBy[a]?.length || 0) >= SAMPLE_MIN);
  const gate = {
    completeBodies: eligible.length,
    wokenByArchetype: Object.fromEntries(Object.keys(ARCHETYPES).map((a) => [a, wokenBy[a]?.length || 0])),
    eligibleByArchetype: Object.fromEntries(Object.keys(ARCHETYPES).map((a) => [a, eligibleBy[a]?.length || 0])),
    measurable,
    stop: eligible.length === 0 ? 'no records with a complete body' : (measurable.length === 0 ? 'fewer than 20 woken body-complete records for every archetype' : null),
  };

  // ---- Step 1 sample
  const recentDates = recentTradingDays(etDate(Date.now()));
  const sample = {};
  const sampleFacts = {};
  for (const a of Object.keys(ARCHETYPES)) {
    const pool = eligibleBy[a] || [];
    const picks = pool.length ? drawSample(pool, recentDates, { seed: SEED + a.length }) : [];
    sample[a] = picks.map((r) => r.k);
    sampleFacts[a] = {
      eligible: pool.length,
      eligibleBattles: new Set(pool.map((r) => r.battleId)).size,
      drawn: picks.length,
      drawnBattles: new Set(picks.map((r) => r.battleId)).size,
      inRecentWindow: picks.filter((r) => recentDates.includes(r.etDate)).length,
      byOwnerClass: picks.reduce((o, r) => inc(o, r.ownerClass), {}),
      byOriginalAction: picks.reduce((o, r) => inc(o, r.origTuple.action), {}),
      barsApply: picks.length >= SAMPLE_MIN,
    };
  }

  // ---- Part B over every woken, body-complete record
  const partB = {};
  const partBAllWoken = {};
  const forced = {};
  for (const r of records.filter((x) => x.woken)) {
    const target = r.bodyState === 'complete' ? partB : null;
    for (const bucket of [target, partBAllWoken]) {
      if (!bucket) continue;
      const row = bucket[r.archetype] || (bucket[r.archetype] = { woken: 0, modelOk: 0, asProposed: 0, intervened: 0, modelFailed: 0, causes: {}, failures: {}, proposedSwaps: 0, executedSwaps: 0, proposedHolds: 0, holdsForcedToSwap: 0 });
      row.woken += 1;
      if (r.gate.kind === 'model_failed') { row.modelFailed += 1; inc(row.failures, r.gate.cause); continue; }
      row.modelOk += 1;
      if (r.decision.original === 'SWAP') row.proposedSwaps += 1; else row.proposedHolds += 1;
      if (r.decision.final === 'SWAP') row.executedSwaps += 1;
      if (r.gate.kind === 'as_proposed') row.asProposed += 1;
      else { row.intervened += 1; inc(row.causes, r.gate.cause); if (r.decision.original !== 'SWAP' && r.decision.final === 'SWAP') row.holdsForcedToSwap += 1; }
    }
    if (r.bodyState === 'complete') {
      const f = forced[r.archetype] || (forced[r.archetype] = { ticksWithForcedAction: 0, actions: {} });
      const pre = r.actions.filter((a) => a.source === 'risk_manager' || a.source === 'archetype');
      if (pre.length) f.ticksWithForcedAction += 1;
      for (const a of r.actions) inc(f.actions, `${a.source}:${a.exitReason}`);
    }
  }
  for (const row of Object.values(partB)) {
    row.interventionRatePct = round(pct(row.intervened, row.woken), 1);
    row.interventionRateOfProposalsPct = round(pct(row.intervened, row.modelOk), 1);
    row.swapBlockRatePct = round(pct(Object.entries(row.causes).filter(([k]) => k !== 'guardrail_forced_swap').reduce((s, [, v]) => s + v, 0), row.proposedSwaps), 1);
    row.B4flag = (row.interventionRatePct ?? 0) >= BARS.B4_restrictive;
  }

  const result = {
    at: new Date().toISOString(), head: headSha(), scriptSha256: scriptSha(),
    window: { first: new Date(firstMs).toISOString(), last: records.map((r) => r.capturedAt).filter(Boolean).sort().at(-1) },
    battles: { total: all.length, walked: walk.length, withTicks: battlesWithTicks },
    ticks: records.length, woken: records.filter((r) => r.woken).length,
    seqGaps, owners: Object.fromEntries(Object.entries(ownerClass)), table04, notWoken, wokenOutcome, bodyStates,
    exclusions, markerCounts, charterStates, repro, gate, recentDates, sampleFacts, partB, partBAllWoken, forced, directive, directiveClass,
    applicability: Object.fromEntries(Object.keys(ARCHETYPES).map((a) => [a, Object.fromEntries(ARMS.map((arm) => [arm, (sample[a] || []).map((k) => eligible.find((r) => r.k === k).applicable[arm]).reduce((o, v) => inc(o, v), {})]))])),
  };
  writeJsonAtomic(P('census.json'), result);
  writeJsonAtomic(P('records.json'), records.map(({ k, battleId, tickId, archetype, owner, ownerClass: oc, etDate: d, woken, bodyState, gate: g, origTuple, applicable, envelope, decision }) => ({ k, battleId, tickId, archetype, owner, ownerClass: oc, etDate: d, woken, bodyState, gate: g, origTuple, applicable, envelope, decision })));
  writeFileSync(P('sources.jsonl'), `${sourcesOut.map((s) => JSON.stringify(s)).join('\n')}\n`);
  manifest.sample = sample;
  manifest.recentDates = recentDates;
  manifest.censusAt = result.at;
  writeJsonAtomic(P('manifest.json'), manifest);
  writeExhibits();
  console.log(JSON.stringify({ gate, sampleFacts, partB: Object.fromEntries(Object.entries(partB).map(([a, r]) => [a, { woken: r.woken, intervened: r.intervened, ratePct: r.interventionRatePct, causes: r.causes }])) }, null, 1));
  if (gate.stop) stop(`Step 0 gate: ${gate.stop}. census.json is written.`, 4);
}

// ---------------------------------------------------------------- plan (Part A requests + estimate, no spend)

const priceKeyOf = (modelId) => {
  const m = /^claude-(haiku|sonnet|opus)-(\d+)-(\d+)/.exec(String(modelId));
  return m ? `claude-${m[1]}-${m[2]}-${m[3]}` : null;
};

function buildTasks(manifest, recordsByK, sources) {
  const tasks = [];
  const naCounts = {};
  for (const [arch, keys] of Object.entries(manifest.sample || {})) {
    if (keys.length < SAMPLE_MIN) continue; // under 20: reported, bars skipped, no model spend (prompt §4)
    for (const k of keys) {
      const req = JSON.parse(sources[k].request);
      const loc = locateArms(req, arch);
      for (const arm of ARMS) {
        const a = applyArm(req, arm, arch, loc);
        if (a.na) { inc(naCounts[`${arch}|${arm}`] || (naCounts[`${arch}|${arm}`] = {}), a.na); continue; }
        verifyEdit(req, a.request, a.edits);
        tasks.push({ k, arch, arm, edits: a.edits, chars: { before: req.system.length + req.messages.reduce((s, m) => s + m.content.length, 0), removed: a.edits.reduce((s, e) => s + e.removed, 0), added: a.edits.reduce((s, e) => s + e.added, 0) }, inputTokens: recordsByK[k].envelope.inputTokens, outputTokens: recordsByK[k].envelope.outputTokens, maxTokens: req.max_tokens, model: req.model });
      }
    }
  }
  return { tasks, naCounts };
}

/** Planned (captured input scaled by the edit's character delta + captured output) and worst (output at max_tokens). */
export function estimate(tasks) {
  let planned = 0; let worst = 0; let inTok = 0; let outTok = 0;
  const cells = {};
  for (const t of tasks) {
    const price = PRICES[priceKeyOf(t.model)];
    if (!price) throw new Error(`no price for ${t.model}`);
    const scale = (t.chars.before - t.chars.removed + t.chars.added) / t.chars.before;
    const i = Math.ceil((t.inputTokens ?? 20000) * Math.max(scale, 0));
    const o = t.outputTokens ?? 1500;
    const p = (i * price.batchIn + o * price.batchOut) / 1e6;
    const w = (i * price.batchIn + t.maxTokens * price.batchOut) / 1e6;
    planned += p; worst += w; inTok += i; outTok += o;
    const c = cells[`${t.arch}|${t.arm}`] || (cells[`${t.arch}|${t.arm}`] = { calls: 0, usd: 0 });
    c.calls += 1; c.usd += p;
  }
  return { calls: tasks.length, inTok, outTok, planned, worst, cells };
}

async function plan() {
  if (!existsSync(P('census.json'))) stop('run `census` first.');
  acquireLock('plan');
  const manifest = readJson(P('manifest.json'));
  stamp(manifest, 'plan');
  const records = readJson(P('records.json'));
  const recordsByK = Object.fromEntries(records.map((r) => [r.k, r]));
  const sources = Object.fromEntries(loadJsonl(P('sources.jsonl')).filter((s) => s.request).map((s) => [s.k, s]));
  const { tasks, naCounts } = buildTasks(manifest, recordsByK, sources);
  const est = estimate(tasks);
  manifest.plan = { at: new Date().toISOString(), tasks: tasks.map((t) => [t.k, t.arch, t.arm]), naCounts, estimate: { calls: est.calls, inTok: est.inTok, outTok: est.outTok, plannedUsd: est.planned, worstUsd: est.worst }, cells: est.cells };
  manifest.plan.withinCap = est.calls <= CAPS.calls && est.worst <= CAPS.usd;
  writeJsonAtomic(P('manifest.json'), manifest);
  // Edit verification exhibit: five records per arm (ids, spans, the first and last 80 removed characters).
  const spot = [];
  for (const arm of ARMS) {
    const rows = tasks.filter((t) => t.arm === arm && arm !== 'A0').slice(0, 5);
    for (const t of rows) {
      const req = JSON.parse(sources[t.k].request);
      for (const e of t.edits) {
        const text = e.field === 'system' ? req.system : req.messages[e.field === 'm0' ? 0 : 2].content;
        const removed = text.slice(e.span.start, e.span.end);
        spot.push({ arm, k: t.k, field: e.field, start: e.span.start, end: e.span.end, removedChars: e.removed, addedChars: e.added, head: removed.slice(0, 80), tail: removed.slice(-80) });
      }
    }
  }
  writeJsonAtomic(P('edit-spotcheck.json'), spot);
  writeExhibits();
  console.log(`[ablation] Part A estimate: ${est.calls} calls · input ≈ ${est.inTok.toLocaleString()} tokens · output ≈ ${est.outTok.toLocaleString()} tokens · planned $${est.planned.toFixed(2)} · worst case (every reply at max_tokens) $${est.worst.toFixed(2)} · caps ${CAPS.calls} calls / $${CAPS.usd}`);
  for (const [cell, c] of Object.entries(est.cells).sort()) console.log(`  ${cell.padEnd(22)} ${String(c.calls).padStart(4)} calls  $${c.usd.toFixed(2)}`);
  console.log(`  not applicable (records × arm): ${JSON.stringify(naCounts)}`);
  if (!manifest.plan.withinCap) stop(`the estimate exceeds a cap (${est.calls} calls, worst $${est.worst.toFixed(2)}; caps ${CAPS.calls} / $${CAPS.usd}). Nothing was sent.`, 5);
}

// ---------------------------------------------------------------- Anthropic HTTP (plain fetch, Message Batches)

function anthropicUrl(urlPath) {
  const url = new URL(urlPath, ANTHROPIC);
  if (url.origin !== ANTHROPIC) stop(`refusing to send the API key to ${url.origin}`);
  return url.href;
}
async function api(apiKey, method, urlPath, body) {
  let res;
  try {
    res = await fetch(anthropicUrl(urlPath), { method, headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  } catch (err) {
    throw new Error(`network error on ${method} ${urlPath.split('?')[0]}: ${redactSecrets(err?.cause?.code || err?.name || 'unknown')}`);
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  if (isSpendLimitError(res.status, json, text)) stop(`the API reported a spend limit (HTTP ${res.status}). Nothing further was sent.`, 3);
  return { status: res.status, json, text };
}

function requestFor(task, sources) {
  const [k, arch, arm] = task;
  const req = JSON.parse(sources[k].request);
  const a = applyArm(req, arm, arch);
  if (a.na) throw new Error(`${k} ${arm}: not applicable at submit (${a.na})`);
  verifyEdit(req, a.request, a.edits);
  return a.request; // exactly the captured literal's keys: model, max_tokens, temperature, system, messages, tools, tool_choice
}

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

const totalOf = (counts) => Object.values(counts || {}).reduce((s, x) => s + (Number(x) || 0), 0);

/** An interrupted create: the intent is on disk before every POST; adopt the one batch it made, if any. */
async function reconcilePending(apiKey, manifest) {
  const p = manifest.pendingCreate;
  if (!p) return;
  const known = new Set((manifest.batches || []).map((b) => b.batchId));
  const r = await api(apiKey, 'GET', '/v1/messages/batches?limit=100');
  if (r.status !== 200) stop(`could not list batches to reconcile an interrupted create (HTTP ${r.status}); nothing was sent`);
  const since = Date.parse(p.at) - 120_000;
  const cands = (r.json?.data || []).filter((b) => !known.has(b.id) && Date.parse(b.created_at) >= since && totalOf(b.request_counts) === p.count);
  if (cands.length > 1) stop(`an interrupted create left ${cands.length} candidate batches; reconcile manifest.pendingCreate by hand`);
  manifest.batches = manifest.batches || [];
  if (cands.length === 1) manifest.batches.push({ batchId: cands[0].id, createdAt: cands[0].created_at, count: p.count, taskIdx: p.taskIdx, kind: p.kind, adopted: true });
  delete manifest.pendingCreate;
  writeJsonAtomic(P('manifest.json'), manifest);
}

async function createRecordedBatch(apiKey, manifest, chunk, kind) {
  const body = `{"requests":[${chunk.map((l) => l.json).join(',')}]}`;
  const bytes = Buffer.byteLength(body, 'utf8');
  if (chunk.length > BATCH_MAX_REQUESTS || bytes > BATCH_MAX_BYTES) stop(`a batch body exceeds the per-batch limit (${chunk.length} requests, ${bytes} bytes)`);
  manifest.pendingCreate = { kind, at: new Date().toISOString(), count: chunk.length, bytes, taskIdx: chunk.map((l) => l.i) };
  writeJsonAtomic(P('manifest.json'), manifest);
  const r = await api(apiKey, 'POST', '/v1/messages/batches', body);
  if (r.status !== 200 || typeof r.json?.id !== 'string') stop(`batch create returned HTTP ${r.status}: ${String(r.json?.error?.message ?? '').slice(0, 300)} (the pending record stays; the next submit or collect reconciles it)`);
  manifest.batches = manifest.batches || [];
  manifest.batches.push({ batchId: r.json.id, createdAt: new Date().toISOString(), count: chunk.length, bytes, taskIdx: chunk.map((l) => l.i), kind });
  delete manifest.pendingCreate;
  writeJsonAtomic(P('manifest.json'), manifest);
  console.log(`[ablation] created ${r.json.id} (${kind}, ${chunk.length} requests)`);
}

async function submit(flags) {
  if (!flags.go) stop('submit needs --go.');
  acquireLock('submit');
  const manifest = readJson(P('manifest.json'));
  if (!manifest.plan) stop('no plan — run `plan` first.');
  const e = manifest.plan.estimate;
  if (!(e.calls <= CAPS.calls && e.worstUsd <= CAPS.usd && Number.isFinite(e.plannedUsd))) stop(`plan over a cap (${e.calls} calls, worst $${e.worstUsd}); nothing was sent.`, 5);
  stamp(manifest, 'submit');
  const { env } = loadEnv();
  const apiKey = anthropicKey(env);
  await reconcilePending(apiKey, manifest);
  const sources = Object.fromEntries(loadJsonl(P('sources.jsonl')).filter((s) => s.request).map((s) => [s.k, s]));
  const done = new Set((manifest.batches || []).flatMap((b) => b.taskIdx));
  const lines = [];
  manifest.plan.tasks.forEach((task, i) => {
    if (done.has(i)) return;
    lines.push({ i, json: JSON.stringify({ custom_id: `aa_${String(i).padStart(5, '0')}`, params: requestFor(task, sources) }) });
  });
  // Arms are shuffled together across batches, so no arm sits alone in its own batch.
  const chunks = chunkLines(shuffle(lines, rng(SEED + 31)));
  console.log(`[ablation] ${lines.length} request(s) to submit in ${chunks.length} batch(es)`);
  for (const chunk of chunks) await createRecordedBatch(apiKey, manifest, chunk, 'main');
}

async function status(flags) {
  const { env } = loadEnv();
  const apiKey = anthropicKey(env);
  const started = Date.now();
  for (;;) {
    const manifest = readJson(P('manifest.json'));
    const rows = [];
    for (const b of manifest.batches || []) {
      if (b.deleted) { rows.push({ batchId: b.batchId, status: 'deleted (results on disk)' }); continue; }
      const r = await api(apiKey, 'GET', `/v1/messages/batches/${b.batchId}`);
      rows.push({ batchId: b.batchId, status: r.json?.processing_status ?? `HTTP ${r.status}`, counts: r.json?.request_counts ?? null });
    }
    console.log(`[ablation] ${new Date().toISOString()} ${JSON.stringify(rows)}`);
    const allEnded = rows.every((r) => r.status === 'ended' || String(r.status).startsWith('deleted'));
    if (!flags.wait || allEnded) { if (flags.wait) console.log(allEnded ? 'ALL ENDED' : ''); return; }
    if (Date.now() - started >= POLL_FOR_MS) { console.log('NOT FINISHED after 2 hours.'); return; }
    await new Promise((res) => setTimeout(res, POLL_EVERY_MS));
  }
}

const RETRYABLE_ERRORS = new Set(['api_error', 'overloaded_error', 'timeout_error']);

async function collect(flags) {
  acquireLock('collect');
  const manifest = readJson(P('manifest.json'));
  stamp(manifest, 'collect');
  const { env } = loadEnv();
  const apiKey = anthropicKey(env);
  await reconcilePending(apiKey, manifest);
  const resDir = P('results');
  mkdirSync(resDir, { recursive: true });
  manifest.outcomes = manifest.outcomes || {};
  for (const b of manifest.batches || []) {
    if (b.resultsSaved) continue;
    const r = await api(apiKey, 'GET', `/v1/messages/batches/${b.batchId}`);
    if (r.json?.processing_status !== 'ended') { console.log(`[ablation] ${b.batchId} is ${r.json?.processing_status ?? `HTTP ${r.status}`} — not collected yet`); continue; }
    const file = path.join(resDir, `${b.batchId}.jsonl`);
    const res = await fetch(anthropicUrl(r.json.results_url), { headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION } });
    if (!res.ok) stop(`results download for ${b.batchId} returned HTTP ${res.status} (the batch is kept)`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(`${file}.tmp`));
    renameSync(`${file}.tmp`, file);
    const resultLines = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
    if (resultLines.length !== b.count) stop(`${b.batchId}: ${resultLines.length} result lines for ${b.count} requests — kept the batch`);
    for (const line of resultLines) {
      const row = JSON.parse(line);
      const i = Number(row.custom_id.slice(3));
      if (manifest.outcomes[i]?.type === 'succeeded') continue;
      manifest.outcomes[i] = { type: row.result?.type, batchId: b.batchId, errType: row.result?.error?.error?.type ?? row.result?.error?.type ?? null };
    }
    b.resultsSaved = true;
    writeJsonAtomic(P('manifest.json'), manifest);
    console.log(`[ablation] ${b.batchId}: ${resultLines.length} results saved`);
  }
  for (const b of manifest.batches || []) {
    if (!b.resultsSaved || b.deleted) continue;
    const del = await api(apiKey, 'DELETE', `/v1/messages/batches/${b.batchId}`);
    b.deleted = del.status === 200;
    writeJsonAtomic(P('manifest.json'), manifest);
    console.log(`[ablation] ${b.batchId}: deleted on Anthropic's side: ${b.deleted}`);
  }
  const summary = {};
  for (const o of Object.values(manifest.outcomes)) inc(summary, `${o.type}${o.errType ? `:${o.errType}` : ''}`);
  console.log(`[ablation] outcomes: ${JSON.stringify(summary)}`);
  // One retry of server-errored (unbilled) requests.
  const allSaved = (manifest.batches || []).every((b) => b.resultsSaved);
  const retried = new Set((manifest.batches || []).filter((b) => b.kind === 'retry').flatMap((b) => b.taskIdx));
  const toRetry = Object.entries(manifest.outcomes).filter(([i, o]) => o.type === 'errored' && RETRYABLE_ERRORS.has(o.errType) && !retried.has(Number(i))).map(([i]) => Number(i));
  if (!allSaved || !toRetry.length || flags.noRetry) return;
  const sources = Object.fromEntries(loadJsonl(P('sources.jsonl')).filter((s) => s.request).map((s) => [s.k, s]));
  const lines = toRetry.map((i) => ({ i, json: JSON.stringify({ custom_id: `aa_${String(i).padStart(5, '0')}`, params: requestFor(manifest.plan.tasks[i], sources) }) }));
  for (const chunk of chunkLines(lines)) await createRecordedBatch(apiKey, manifest, chunk, 'retry');
  console.log(`[ablation] retry batch(es) created for ${toRetry.length} server-errored request(s); run status --wait, then collect again`);
}

// ---------------------------------------------------------------- analyze (Part A)

function loadResults() {
  const out = {};
  const resDir = P('results');
  if (!existsSync(resDir)) return out;
  for (const f of readdirSync(resDir).filter((x) => x.endsWith('.jsonl'))) {
    for (const line of readFileSync(path.join(resDir, f), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      const i = Number(row.custom_id.slice(3));
      if (row.result?.type === 'succeeded') out[i] = { message: row.result.message };
      else if (!out[i]) out[i] = { message: null, type: row.result?.type };
    }
  }
  return out;
}

/** One table: per archetype × arm, the flip counts against the captured decision. */
export function tabulate(rows) {
  const t = {};
  for (const r of rows) {
    const c = t[`${r.arch}|${r.arm}`] || (t[`${r.arch}|${r.arm}`] = { n: 0, any: 0, action: 0, symbol: 0, reasonOnly: 0, malformed: 0, origSwaps: 0, replySwaps: 0 });
    c.n += 1;
    if (r.cmp.anyFlip) c.any += 1;
    if (r.cmp.actionFlip) c.action += 1;
    if (r.cmp.symbolFlip) c.symbol += 1;
    if (r.cmp.reasonOnly) c.reasonOnly += 1;
    if (r.cmp.malformed) c.malformed += 1;
    if (r.orig.action === 'SWAP') c.origSwaps += 1;
    if (r.reply.valid && r.reply.action === 'SWAP') c.replySwaps += 1;
  }
  for (const c of Object.values(t)) {
    c.anyPct = round(pct(c.any, c.n)); c.actionPct = round(pct(c.action, c.n)); c.symbolPct = round(pct(c.symbol, c.n));
  }
  return t;
}

/** §7 bars, applied as written. */
export function applyBars(table, archetypes) {
  const out = {};
  for (const a of archetypes) {
    const a0 = table[`${a}|A0`];
    if (!a0) continue;
    const floor = a0.anyPct;
    const row = { A0anyPct: floor, B0: floor > BARS.B0_noisy ? 'noisy' : 'ok', arms: {} };
    for (const arm of ['A1', 'A2', 'A3', 'A4', 'A6', 'A7']) {
      const c = table[`${a}|${arm}`];
      if (!c) { row.arms[arm] = { label: 'not measured' }; continue; }
      const excess = round(c.anyPct - floor);
      const lb = excess >= BARS.B1_loadBearing;
      const label = { excessPts: excess, B1: lb ? 'load-bearing' : 'not load-bearing', noisy: row.B0 === 'noisy' };
      if (arm === 'A6') label.B2 = excess >= BARS.B2_charter ? 'the charter is in the thinking' : 'the charter is not load-bearing at the decision';
      if (arm === 'A7') label.B3 = excess >= BARS.B3_constraint ? 'the constraint text is doing real restriction work' : 'the model stays inside the constraints without being told';
      row.arms[arm] = label;
    }
    out[a] = row;
  }
  return out;
}

async function analyze(flags = {}) {
  const manifest = readJson(P('manifest.json'));
  if (!manifest.plan) stop('no plan.');
  const records = Object.fromEntries(readJson(P('records.json')).map((r) => [r.k, r]));
  const sources = Object.fromEntries(loadJsonl(P('sources.jsonl')).filter((s) => s.request).map((s) => [s.k, s]));
  const results = loadResults();
  const rows = [];
  const missing = {};
  let usageIn = 0; let usageOut = 0;
  manifest.plan.tasks.forEach(([k, arch, arm], i) => {
    const res = results[i];
    if (!res?.message) { inc(missing, `${arch}|${arm}`); return; }
    const schema = JSON.parse(sources[k].request).tools[0].input_schema;
    const reply = replyTuple(res.message, schema);
    const orig = records[k].origTuple;
    usageIn += res.message.usage?.input_tokens || 0;
    usageOut += res.message.usage?.output_tokens || 0;
    rows.push({ i, k, arch, arm, ownerClass: records[k].ownerClass, orig, reply, cmp: compareTuples(orig, reply) });
  });
  const archs = Object.keys(manifest.sample).filter((a) => manifest.sample[a].length >= SAMPLE_MIN);
  const pooled = tabulate(rows);
  // Human-only: every non-CPU owner except the one Flash names as the FT_QA tester
  // (`--ftqa owner-X`); nothing on the record identifies the tester.
  const ftqa = flags.ftqa || null;
  const humanRows = rows.filter((r) => r.ownerClass === 'non_cpu' && records[r.k].owner !== ftqa);
  const humanN = Object.fromEntries(archs.map((a) => [a, new Set(humanRows.filter((r) => r.arch === a).map((r) => r.k)).size]));
  const human = tabulate(humanRows.filter((r) => humanN[r.arch] >= SAMPLE_MIN));
  const price = PRICES[priceKeyOf(manifest.plan.tasks.length ? JSON.parse(sources[manifest.plan.tasks[0][0]].request).model : '')];
  const usd = price ? (usageIn * price.batchIn + usageOut * price.batchOut) / 1e6 : null;
  const analysis = {
    at: new Date().toISOString(), scriptSha256: scriptSha(),
    calls: { planned: manifest.plan.tasks.length, returned: rows.length, missing },
    usage: { inputTokens: usageIn, outputTokens: usageOut, usd },
    ftqaExcluded: ftqa, pooled, human, humanN, bars: applyBars(pooled, archs), barsHuman: applyBars(human, archs.filter((a) => humanN[a] >= SAMPLE_MIN)),
  };
  writeJsonAtomic(P('analysis.json'), analysis);
  writeJsonAtomic(P('partA-rows.json'), rows.map((r) => ({ k: r.k, arch: r.arch, arm: r.arm, ownerClass: r.ownerClass, orig: r.orig, reply: { valid: r.reply.valid, action: r.reply.action, out: r.reply.out ?? null, in: r.reply.in ?? null, swapType: r.reply.swapType ?? null, why: r.reply.why ?? null }, cmp: r.cmp })));
  writeExhibits();
  console.log(JSON.stringify({ calls: analysis.calls, usage: analysis.usage, bars: analysis.bars }, null, 1));
  for (const [cell, c] of Object.entries(pooled).sort()) console.log(`  ${cell.padEnd(22)} n=${String(c.n).padStart(3)} any=${String(c.anyPct).padStart(5)}% action=${String(c.actionPct).padStart(5)}% symbol=${String(c.symbolPct).padStart(5)}% malformed=${c.malformed} reasonOnly=${c.reasonOnly}`);
}

// ---------------------------------------------------------------- exhibits (outside the repo; player text allowed)

function para(s) { return String(s ?? '').replace(/\s+/g, ' ').trim(); }

function founderRead(records, sources) {
  const out = [];
  const byArch = groupBy(records.filter((r) => r.woken && r.bodyState === 'complete' && r.gate?.kind === 'intervened'), (r) => r.archetype);
  for (const [arch, list] of Object.entries(byArch).sort()) {
    const picks = shuffle([...list].sort((a, b) => a.k.localeCompare(b.k)), rng(SEED + 7)).slice(0, 5);
    out.push(`### ${ARCHETYPES[arch] ?? arch} (\`${arch}\`) — ${picks.length} of ${list.length} intervened checks`, '');
    picks.forEach((r, n) => {
      const s = sources[r.k] || {};
      const o = s.originalToolResult || {};
      const want = r.gate.orig.action === 'SWAP' ? `swap ${r.gate.orig.out} out for ${r.gate.orig.in}${o.swap_type ? ` (${o.swap_type})` : ''} at conviction ${o.conviction ?? '?'}` : 'hold';
      const got = r.gate.fin.action === 'SWAP' ? `swap ${r.gate.fin.out} out for ${r.gate.fin.in}` : 'hold';
      out.push(`**${n + 1}. \`${r.k}\`** · ${r.etDate} · ${r.ownerClass}/${r.owner}`, '');
      out.push(`The model wanted to **${want}**. Its reasoning began: “${para(o.rationale).slice(0, 320)}${para(o.rationale).length > 320 ? '…' : ''}”`);
      out.push(`The deterministic layer made it **${got}** instead. Layer and rule: **${r.gate.cause}**.${(s.validationErrors || []).length ? ` The record's own words: ${(s.validationErrors || []).map((e) => `“${para(e)}”`).join('; ')}.` : ''}${r.gate.cause === 'guardrail_forced_swap' && s.finalToolResult?.rationale ? ` The override note: “${para(s.finalToolResult.rationale).slice(0, 200)}”.` : ''}`);
      out.push('', 'Flash: ☐ right call · ☐ wrong call · ☐ can\'t tell', '');
    });
  }
  return out;
}

function writeExhibits() {
  const lines = ['# Archetype Ablation + Gate Census — exhibits (LOCAL ONLY — carries player text; never commit)', '', `Generated ${new Date().toISOString()} by scripts/experiments/archetypeAblationReplay.mjs (sha256 ${scriptSha().slice(0, 16)}…). Run folder: ${RUN_DIR}.`, ''];
  if (existsSync(P('census.json'))) {
    const census = readJson(P('census.json'));
    const manifest = readJson(P('manifest.json'));
    const records = readJson(P('records.json'));
    const sources = Object.fromEntries(loadJsonl(P('sources.jsonl')).map((s) => [s.k, s]));
    lines.push('## 1. Owner labels', '', 'Owners are labelled by first appearance in the walk (battles by creation time). UIDs are not written anywhere.', '');
    for (const [label, cls] of Object.entries(census.owners)) lines.push(`- ${label}: ${cls}`);
    lines.push('', '## 2. Step 1 sample ids', '');
    for (const [arch, keys] of Object.entries(manifest.sample || {})) {
      lines.push(`### ${ARCHETYPES[arch] ?? arch} — ${keys.length}`, '');
      for (const k of keys) { const r = records.find((x) => x.k === k); lines.push(`- \`${k}\` · ${r.etDate} · ${r.ownerClass}/${r.owner} · captured ${r.origTuple.action}${r.origTuple.action === 'SWAP' ? ` ${r.origTuple.out}>${r.origTuple.in} (${r.origTuple.swapType ?? 'no swap_type'})` : ''}`); }
      lines.push('');
    }
    lines.push('## 3. Founder read sample (Part B) — mark each case', '', 'Five intervened checks per archetype (fewer where fewer exist), seeded. “Intervened” = the executed decision differs from the model\'s original proposal (permanent record `decision.original*` vs `decision.final*`).', '');
    lines.push(...founderRead(records, sources));
  }
  if (existsSync(P('edit-spotcheck.json'))) {
    lines.push('## 4. Edit spot check — five records per arm', '', 'Each row: the field edited, the character span, and the first/last 80 characters of what the arm removed (A6: the charter render it replaced). Everything outside the span is byte-identical (verifyEdit, run on every request).', '');
    for (const s of readJson(P('edit-spotcheck.json'))) lines.push(`- **${s.arm}** \`${s.k}\` ${s.field} [${s.start}, ${s.end}) −${s.removedChars} +${s.addedChars} · head “${para(s.head)}” · tail “${para(s.tail)}”`);
    lines.push('');
  }
  if (existsSync(P('partA-rows.json'))) {
    lines.push('## 5. Part A — per-record decision tuples per arm', '', 'Captured tuple → reply tuple. Flags: A = action flip, S = symbol flip, R = reason-only (swap_type) change, M = malformed reply.', '');
    const rows = readJson(P('partA-rows.json'));
    const fmt = (t) => (!t.valid && t.valid !== undefined ? `malformed(${t.why})` : t.action === 'SWAP' ? `SWAP ${t.out}>${t.in} (${t.swapType ?? '-'})` : t.action);
    for (const [k, list] of Object.entries(groupBy(rows, (r) => r.k))) {
      lines.push(`- \`${k}\` (${list[0].arch}) captured ${fmt({ ...list[0].orig, valid: true })}: ${list.sort((a, b) => a.arm.localeCompare(b.arm)).map((r) => `${r.arm} ${fmt(r.reply)}${r.cmp.actionFlip ? ' [A]' : ''}${r.cmp.symbolFlip ? ' [S]' : ''}${r.cmp.reasonOnly ? ' [R]' : ''}${r.cmp.malformed ? ' [M]' : ''}`).join(' · ')}`);
    }
    lines.push('');
  }
  mkdirSync(EXHIBITS_ROOT, { recursive: true });
  writeFileSync(EXHIBITS_FILE, `${lines.join('\n')}\n`);
}

// ---------------------------------------------------------------- selftest (synthetic, no I/O)

export function runSelftest() {
  const checks = [];
  const ok = (name, cond) => checks.push({ name, pass: Boolean(cond) });
  const charter = EVAL_IDENTITY_BLOCKS.momentum_chaser.render;
  const sys = `You are X, a competitive AI trading agent. Your archetype is Momentum chaser. You are mid-battle in a game.\n\n${IDENTITY_BANNER}${charter}\n\n${EVAL_IDENTITY_SUBORDINATION_CLAUSE}\n\n━━━ SCORING RULES ━━━\n\nbody`;
  const m0 = ['ABOUT YOU:\nName: A\nArchetype: Momentum chaser\nRisk Tolerance: 50/100',`${WISDOM_HEADER}learned text`, `${RULES_HEADER}${C_HEADER}C1. Max 20% [Risk]${SEP}${S_HEADER}S1. Prefer leaders [Momentum]${SEP}When making trades:\n- Check ALL constraints.`].join(SEP);
  const m2 = ['━━━ LIVE BATTLE STATE ━━━\nDay 1', 'BENCH (available for swap):\nSymbol,Sector\nAAA,Tech,$1', `${BENCH_TECH_HEADER}${SEP}AAA (Tech):\n  Momentum: RSI=55${SEP}BBB (Energy):\n  Volume: RVOL=1.20`, 'TRIGGER (why you were woken up):\n- x: y', `STANDING LEANS (user-equipped persistent adjustments):\n- "lean one"\nApply these as standing leans within your archetype's core identity — they tune your execution at the margin and never override your archetype's rules, platform safety limits, or an active directive.`, `${NEWS_INTEL_HEADER}${SEP}RECENT STORIES:\n1. x${SEP}Stories INFORM how strongly to follow your Forge rules — they do not override constraints.\nA constraint (C-rule) is never relaxed because of a story. ${NEWS_INTEL_TAIL}`, `${LAST3_HEADER}eval_001: HOLD`].join(SEP);
  const req = { model: 'claude-haiku-4-5-20251001', max_tokens: 3072, temperature: 0.4, system: sys, messages: [{ role: 'user', content: m0 }, { role: 'assistant', content: 'ok' }, { role: 'user', content: m2 }], tools: [{ name: PROD_TOOL_NAME, input_schema: { type: 'object', required: ['decision'], properties: { decision: { type: 'string', enum: ['HOLD', 'SWAP'] }, symbolOut: { type: 'string' }, symbolIn: { type: 'string' }, swap_type: { type: 'string' } } } }], tool_choice: { type: 'tool', name: PROD_TOOL_NAME } };
  const loc = locateArms(req, 'momentum_chaser');
  ok('all sections located', ['cChunk', 'sChunk', 'leans', 'news', 'bench', 'charter'].every((x) => loc[x].status === 'present') && loc.identity.status === 'learned');
  const expectAbsent = { A1: [NEWS_INTEL_HEADER], A2: [BENCH_TECH_HEADER], A3: [S_HEADER, 'STANDING LEANS'], A4: [WISDOM_HEADER], A7: [C_HEADER] };
  for (const arm of ['A1', 'A2', 'A3', 'A4', 'A6', 'A7']) {
    const a = applyArm(req, arm, 'momentum_chaser', loc);
    let verified = false;
    try { verified = verifyEdit(req, a.request, a.edits); } catch { verified = false; }
    ok(`${arm} verifies`, verified);
    const all = `${a.request.system}${a.request.messages.map((m) => m.content).join('')}`;
    for (const h of expectAbsent[arm] || []) ok(`${arm} removed ${h.slice(0, 20)}`, !all.includes(h));
    ok(`${arm} keeps no empty part`, !a.request.messages[0].content.includes('\n\n\n') && !a.request.messages[2].content.includes('\n\n\n'));
  }
  const a1 = applyArm(req, 'A1', 'momentum_chaser', loc);
  ok('A1 joins neighbours with one separator', a1.request.messages[2].content.includes(`platform safety limits, or an active directive.${SEP}${LAST3_HEADER}`));
  const a7 = applyArm(req, 'A7', 'momentum_chaser', loc);
  ok('A7 leaves S-rules first after header', a7.request.messages[0].content.includes(`${RULES_HEADER}${S_HEADER}S1.`));
  const a3 = applyArm(req, 'A3', 'momentum_chaser', loc);
  ok('A3 leaves C-rules then trailer', a3.request.messages[0].content.includes(`C1. Max 20% [Risk]${SEP}When making trades:`));
  const a6 = applyArm(req, 'A6', 'momentum_chaser', loc);
  ok('A6 renders the Contrarian charter', a6.request.system.includes(EVAL_IDENTITY_BLOCKS.contrarian.render) && !a6.request.system.includes(charter));
  const a6n = applyArm(req, 'A6n', 'momentum_chaser', loc);
  let a6nOk = false; try { a6nOk = verifyEdit(req, a6n.request, a6n.edits); } catch { a6nOk = false; }
  ok('A6n verifies (three spans, two fields)', a6nOk && a6n.edits.length === 3);
  ok('A6n renames both mentions', a6n.request.system.includes('Your archetype is Contrarian. You are mid-battle') && a6n.request.messages[0].content.includes('\nArchetype: Contrarian\n') && a6n.request.system.includes(EVAL_IDENTITY_BLOCKS.contrarian.render));
  ok('A0 identical', JSON.stringify(applyArm(req, 'A0', 'momentum_chaser', loc).request) === JSON.stringify(req));
  // A planted edit outside the span must fail verification.
  const bad = JSON.parse(JSON.stringify(a1.request)); bad.messages[0].content += 'x';
  let caught = false; try { verifyEdit(req, bad, a1.edits); } catch { caught = true; }
  ok('verifyEdit catches an out-of-span change', caught);
  // Flip rules.
  const orig = { valid: true, action: 'SWAP', out: 'AAA', in: 'BBB', swapType: 'upgrade' };
  ok('same → no flip', !compareTuples(orig, { ...orig }).anyFlip);
  ok('HOLD → action flip', compareTuples(orig, { valid: true, action: 'HOLD' }).actionFlip);
  ok('other symbol → symbol flip', compareTuples(orig, { ...orig, in: 'CCC' }).symbolFlip && !compareTuples(orig, { ...orig, in: 'CCC' }).actionFlip);
  ok('swap_type only → reason-only, not any', compareTuples(orig, { ...orig, swapType: 'profit_take' }).reasonOnly && !compareTuples(orig, { ...orig, swapType: 'profit_take' }).anyFlip);
  ok('malformed → action flip', compareTuples(orig, { valid: false, action: 'malformed' }).actionFlip);
  // Bars.
  const table = { 'x|A0': { anyPct: 5 }, 'x|A1': { anyPct: 15 }, 'x|A6': { anyPct: 19.9 }, 'x|A7': { anyPct: 20 } };
  const bars = applyBars(table, ['x']);
  ok('B1 at +10 is load-bearing', bars.x.arms.A1.B1 === 'load-bearing');
  ok('B2 below +15 is not', bars.x.arms.A6.B2.startsWith('the charter is not'));
  ok('B3 at +15 is real', bars.x.arms.A7.B3.startsWith('the constraint text is doing'));
  // Sample caps.
  const pool = []; for (let b = 0; b < 4; b += 1) for (let j = 0; j < 20; j += 1) pool.push({ k: `b${b}/t${j}`, battleId: `b${b}`, etDate: j < 10 ? '2026-10-10' : '2026-09-22' });
  const s = drawSample(pool, ['2026-10-10'], { target: 60, perBattle: 6 });
  ok('sample ≤ 6 per battle', Object.values(groupBy(s, (r) => r.battleId)).every((l) => l.length <= 6) && s.length === 24);
  ok('sample prefers recent', s.every((r) => r.etDate === '2026-10-10'));
  ok('20–59 available → take all', drawSample(pool.slice(0, 24), ['2026-10-10']).length === 24);
  const rtd = recentTradingDays('2026-10-13');
  ok('15 NYSE sessions end Oct 13 and start Sep 23', rtd.length === 15 && rtd[0] === '2026-09-23' && rtd[14] === '2026-10-13');
  // Gate classification.
  ok('pair validation sub-cause', pairValidationCause(['Conviction 65 below 70 threshold']) === 'conviction_below_70');
  ok('as proposed', classifyGate({ model: { outcome: 'ok' }, decision: { original: 'HOLD', final: 'HOLD' } }).kind === 'as_proposed');
  ok('lock block', classifyGate({ model: { outcome: 'ok' }, decision: { original: 'SWAP', originalSymbolOut: 'A', originalSymbolIn: 'B', final: 'HOLD' }, checks: { lock: { result: 'blocked' } } }).cause === 'lock');
  return { pass: checks.every((c) => c.pass), failed: checks.filter((c) => !c.pass).map((c) => c.name), count: checks.length };
}

// ---------------------------------------------------------------- CLI

export function parseArgs(argv) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--go') flags.go = true;
    else if (a === '--wait') flags.wait = true;
    else if (a === '--no-retry') flags.noRetry = true;
    else if (a === '--ftqa') { flags.ftqa = argv[i + 1]; i += 1; }
    else pos.push(a);
  }
  return { cmd: pos[0], flags };
}

async function main() {
  const { cmd, flags } = parseArgs(process.argv.slice(2));
  switch (cmd) {
    case 'census': return census();
    case 'plan': return plan();
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
      console.log('archetypeAblationReplay — census | plan | submit --go | status [--wait] | collect | analyze | selftest');
      return undefined;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => { console.error(redactSecrets(err?.stack || String(err))); releaseLock(); process.exit(1); });
}
