// scripts/reset-failure-built-insight.mjs
//
// Package P-RESET (founder ruling of 14 Oct 2026) — the one-off reset of the
// agents' failure-built "wisdom" paragraphs. `consolidatedInsight` was built
// from windows of failed reflections, and the trading brain, the draft prompt
// and the chat voice all read it; the changed-moments score found no effect
// either way (docs/audits/20261014_EXPERIMENT_CHANGED_MOMENTS_SCORE.md).
// Rulings: R1 reset at a week boundary; R2 lessons and history stay; R3 the
// dossier the same rewrite wrote (`disciplines`) goes with the paragraph.
// Build report and the founder's weekend run:
// docs/audits/20261030_BUILD_INSIGHT_RESET.md.
//
// THE SELECTION RULE, pre-declared. An agent is in the set when
// `consolidatedInsight` is a non-empty string and either
//   (a) it is exactly the two-character string "" (a serialised empty string), or
//   (b) it matches both /reflection/i and /fail/i (the discovery's criterion).
// An agent with a non-empty paragraph matching neither is listed and never
// touched.
//
// THE FOUR SUBCOMMANDS (repo root of the primary checkout, where .env.local lives):
//   census                                                 read-only; counts only
//   plan                                                   read-only; writes plan.local.json
//   apply --plan <file> --plan-sha256 <hex> --go [--allow-weekday]   WRITES
//   restore --backup <file> --go                           WRITES
//
// `apply` works from the plan as a contract. The SHA-256 `plan` prints is passed
// back by hand, so the reference sits outside the file it vouches for. Before
// any write, apply refuses on: a plan hash mismatch; a weekday in
// America/New_York without --allow-weekday; a live battle (or a deploy inside
// its two-minute window) on an agent in the plan, its ranked parent or a clone
// of it. Then it writes backup.local.json, reads it back, and writes each agent
// in its own compare-and-set transaction. Re-running apply on a reset agent is a
// no-op. Restore has no battle or weekend guard, on purpose: it is the emergency
// undo, and a live battle reads only its frozen copy.
//
// THE WRITE, per agent, and nothing else:
//   consolidatedInsight: ''                   the creation-time value
//   disciplines: field removed                the creation-time value is ABSENT
//   pendingConsolidation: false
//   consolidatedInsightResetAt: <run stamp>   one value for the whole run
//   consolidatedInsightResetReason: 'failure_built'
//
// PRIVACY: nothing printed carries an id or an agent's words, errors included
// (a Firestore message names document paths, so only the error's class prints).
// Files named *.local.* hold ids and text, and are written only under
// %USERPROFILE%/growth-replay-runs/insight-reset-<time>/, never in the tree.
// Credentials (scripts/loadLocalEnv.js + getFirebaseAdmin()) load only inside
// main(); importing the module touches nothing.
//
// The growth replay's §7 write-call grep finds the writes of resetOneAgent and
// restoreOneAgent and nothing else. scripts/reset-failure-built-insight.test.js
// pins the exact lines, so census and plan are read-only by construction.

import process from 'node:process';
import { hash } from 'node:crypto';
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { FieldValue } from 'firebase-admin/firestore';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const RUNS_ROOT = path.join(os.homedir(), 'growth-replay-runs');
export const RESET_REASON = 'failure_built';
const PLAN_SCHEMA = 'insight-reset-plan-v1';
const BACKUP_SCHEMA = 'insight-reset-backup-v1';
const AGENT_ID = /^[^/]+$/; // one document directly under agents, whatever the id's alphabet
const SHA256_HEX = /^[0-9a-f]{64}$/;
// api/agent/decide.js: a deployingAt younger than this is a deploy in progress;
// an older one is a stale lock that the next deploy walks through. The same
// request then clears deployingAt, stamps lastDeployedAt and only later commits
// the battle, from an agent it read at its start, so a lastDeployedAt younger
// than this can be a battle about to freeze the old paragraph.
const DEPLOY_WINDOW_MS = 120_000;

// Every field the reset changes, so every field the backup holds.
const BACKED_UP_FIELDS = Object.freeze([
  'consolidatedInsight', 'disciplines', 'pendingConsolidation',
  'consolidatedInsightResetAt', 'consolidatedInsightResetReason',
]);
const RESTORED_FIELDS = Object.freeze(['consolidatedInsight', 'disciplines', 'pendingConsolidation']);
const FLEET_FIELDS = Object.freeze([
  ...BACKED_UP_FIELDS,
  'isTrainingClone', 'isCasualClone', 'rankedAgentId', 'activeBattleId',
  'deployingAt', 'lastDeployedAt', 'stats.gamesPlayed',
]);

/** A refusal is the script's own sentence: it never carries an id or agent text. */
export class Refusal extends Error {}

const sha256 = (data) => hash('sha256', data);
const say = (line) => console.log(line);
const isClone = (a) => a.isTrainingClone === true || a.isCasualClone === true;
const parentIdOf = (a) => (typeof a.rankedAgentId === 'string' && a.rankedAgentId ? a.rankedAgentId : null);

/** The pre-declared rule. Returns 'a', 'b', or null for an agent outside the set. */
export function selectionRule(paragraph) {
  if (typeof paragraph !== 'string' || paragraph === '') return null;
  if (paragraph === '""') return 'a';
  return /reflection/i.test(paragraph) && /fail/i.test(paragraph) ? 'b' : null;
}

export function isWeekendInNewYork(date) {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(date);
  return day === 'Sat' || day === 'Sun';
}

export function isAlreadyReset(a) {
  return a.consolidatedInsight === ''
    && typeof a.consolidatedInsightResetAt === 'string'
    && a.consolidatedInsightResetReason === RESET_REASON;
}

function withinDeployWindow(stamp, nowMs) {
  const at = Date.parse(stamp);
  return Number.isFinite(at) && nowMs - at < DEPLOY_WINDOW_MS;
}

const docHoldsBattle = (a, nowMs) => Boolean(a.activeBattleId)
  || withinDeployWindow(a.deployingAt, nowMs)
  || withinDeployWindow(a.lastDeployedAt, nowMs);

function backedUpFieldsOf(a) {
  const fields = {};
  for (const f of BACKED_UP_FIELDS) if (a[f] !== undefined) fields[f] = a[f];
  return fields;
}

/**
 * Why agents may not be written now: a live battle, or a deploy about to make
 * one, on the agent, its ranked parent, or a clone of it. Counts per relation;
 * `blocked` counts each agent once. Pure.
 */
export function countBattleHolds(ids, fleet, activeIds, nowMs) {
  const byId = new Map(fleet.map((a) => [a.id, a]));
  const live = (id) => activeIds.has(id) || (byId.has(id) && docHoldsBattle(byId.get(id), nowMs));
  const holds = { own: 0, parent: 0, clone: 0, blocked: 0 };
  for (const id of ids) {
    const agent = byId.get(id);
    if (!agent) continue;
    const parentId = parentIdOf(agent);
    const own = live(id);
    const parent = parentId !== null && live(parentId);
    const clone = fleet.some((a) => parentIdOf(a) === id && live(a.id));
    if (own) holds.own += 1;
    if (parent) holds.parent += 1;
    if (clone) holds.clone += 1;
    if (own || parent || clone) holds.blocked += 1;
  }
  return holds;
}

// ---- Reads ---------------------------------------------------------------

async function readFleet(db) {
  const snap = await db.collection('agents').select(...FLEET_FIELDS).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function readActiveBattleAgentIds(db) {
  const snap = await db.collection('agentBattles').where('status', '==', 'active').select('agentId').get();
  return new Set(snap.docs.map((d) => d.data().agentId));
}

// ---- census --------------------------------------------------------------

/** The census from fleet rows and the ids with an active battle. Counts only. Pure. */
export function computeCensus(fleet, activeIds, nowMs) {
  const byId = new Map(fleet.map((a) => [a.id, a]));
  const inSet = fleet.filter((a) => selectionRule(a.consolidatedInsight) !== null);
  const holders = fleet.filter((a) => typeof a.consolidatedInsight === 'string' && a.consolidatedInsight !== '');
  const out = {
    agents: fleet.length,
    holders: holders.length,
    inSet: inSet.length,
    byRule: { a: 0, b: 0 },
    outsideSet: holders.length - inSet.length,
    nonStringParagraph: fleet.filter((a) => a.consolidatedInsight != null && typeof a.consolidatedInsight !== 'string').length,
    alreadyReset: fleet.filter(isAlreadyReset).length,
    // A rewrite already running when the reset landed writes with no compare, so
    // a stamp over a paragraph is an agent to look at, not a reset that held.
    stampOverParagraph: holders.filter((a) => typeof a.consolidatedInsightResetAt === 'string').length,
    clones: 0,
    nonClones: 0,
    pendingConsolidation: 0,
    holdingDisciplines: 0,
    activeBattle: 0,
    battleHolds: countBattleHolds(inSet.map((a) => a.id), fleet, activeIds, nowMs),
    gamesPlayed: {},
    cloneParents: { inSet: 0, empty: 0, outsideSet: 0, missing: 0, noParentId: 0, sameParagraph: 0 },
  };
  for (const a of inSet) {
    out.byRule[selectionRule(a.consolidatedInsight)] += 1;
    if (isClone(a)) out.clones += 1; else out.nonClones += 1;
    if (a.pendingConsolidation === true) out.pendingConsolidation += 1;
    if (a.disciplines !== undefined) out.holdingDisciplines += 1;
    if (activeIds.has(a.id) || a.activeBattleId) out.activeBattle += 1;
    const games = Number.isInteger(a.stats?.gamesPlayed) ? String(a.stats.gamesPlayed) : 'unknown';
    out.gamesPlayed[games] = (out.gamesPlayed[games] || 0) + 1;
    if (!isClone(a)) continue;
    const parentId = parentIdOf(a);
    const parent = parentId === null ? null : byId.get(parentId);
    if (parentId === null) out.cloneParents.noParentId += 1;
    else if (!parent) out.cloneParents.missing += 1;
    else if (selectionRule(parent.consolidatedInsight) !== null) out.cloneParents.inSet += 1;
    else if (typeof parent.consolidatedInsight === 'string' && parent.consolidatedInsight !== '') out.cloneParents.outsideSet += 1;
    else out.cloneParents.empty += 1;
    if (parent && parent.consolidatedInsight === a.consolidatedInsight) out.cloneParents.sameParagraph += 1;
  }
  return out;
}

/** Plain text, counts only. */
export function renderCensus(c, { readAt }) {
  const games = Object.keys(c.gamesPlayed).sort((x, y) => Number(x) - Number(y));
  const p = c.cloneParents;
  const h = c.battleHolds;
  return [
    `Failure-built paragraphs: census, read ${readAt}`,
    '',
    `Agents: ${c.agents}   holding a paragraph: ${c.holders}   a paragraph that is not a string: ${c.nonStringParagraph}   already reset: ${c.alreadyReset}`,
    `In the set: ${c.inSet}   by (a): ${c.byRule.a}   by (b): ${c.byRule.b}   outside the set: ${c.outsideSet}`,
    `Reset, then given a paragraph again: ${c.stampOverParagraph}`,
    '',
    'Of the set:',
    `  clones: ${c.clones}   non-clones: ${c.nonClones}`,
    `  pendingConsolidation true: ${c.pendingConsolidation}   holding disciplines: ${c.holdingDisciplines}`,
    `  with an active battle: ${c.activeBattle}`,
    `  apply would refuse for: ${h.blocked} (own ${h.own}, ranked parent ${h.parent}, clone ${h.clone})`,
    '  gamesPlayed:',
    ...(games.length === 0 ? ['    (none)'] : games.map((g) => `    ${g}: ${c.gamesPlayed[g]}`)),
    '',
    'What the ranked parent of each clone in the set holds:',
    `  a paragraph in the set: ${p.inSet}   an empty paragraph: ${p.empty}   a paragraph outside the set: ${p.outsideSet}   parent missing: ${p.missing}   no parent id: ${p.noParentId}`,
    `  the same paragraph as the clone: ${p.sameParagraph}`,
  ].join('\n');
}

export async function runCensus({ db, now = new Date(), log = say }) {
  const fleet = await readFleet(db);
  const activeIds = await readActiveBattleAgentIds(db);
  const census = computeCensus(fleet, activeIds, now.getTime());
  log(renderCensus(census, { readAt: now.toISOString() }));
  return census;
}

// ---- Run files -----------------------------------------------------------

function newRunDir(runsRoot, now) {
  const dir = path.join(path.resolve(runsRoot), `insight-reset-${now.toISOString().replace(/[-:.]/g, '')}`);
  const rel = path.relative(PROJECT_ROOT, dir);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new Refusal('the run folder resolves inside the repo tree, and .local. files never go there');
  }
  mkdirSync(path.dirname(dir), { recursive: true });
  mkdirSync(dir); // exclusive: a run never shares a folder, so no backup is ever overwritten
  return dir;
}

function writeDurable(file, body) {
  const fd = openSync(file, 'wx');
  try {
    writeFileSync(fd, body);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

// ---- plan ----------------------------------------------------------------

export async function runPlan({ db, now = new Date(), runsRoot = RUNS_ROOT, log = say }) {
  const fleet = await readFleet(db);
  const inSet = fleet.filter((a) => selectionRule(a.consolidatedInsight) !== null);
  const outside = fleet.filter((a) => typeof a.consolidatedInsight === 'string' && a.consolidatedInsight !== '' && selectionRule(a.consolidatedInsight) === null);
  const plan = {
    schema: PLAN_SCHEMA,
    createdAt: now.toISOString(),
    entries: inSet.map((a) => ({
      id: a.id,
      isClone: isClone(a),
      insightSha256: sha256(a.consolidatedInsight),
      disciplines: a.disciplines ?? null,
      pendingConsolidation: a.pendingConsolidation ?? null,
    })),
    outsideSet: outside.map((a) => ({ id: a.id, isClone: isClone(a), insightSha256: sha256(a.consolidatedInsight) })),
  };
  const body = JSON.stringify(plan, null, 2);
  const planPath = path.join(newRunDir(runsRoot, now), 'plan.local.json');
  writeDurable(planPath, body);
  const planSha256 = sha256(readFileSync(planPath));
  const clones = plan.entries.filter((e) => e.isClone).length;
  log([
    `Plan written: ${planPath}`,
    `In the set: ${plan.entries.length} (clones ${clones}, non-clones ${plan.entries.length - clones})   outside the set, never touched: ${plan.outsideSet.length}`,
    `Plan SHA-256: ${planSha256}`,
  ].join('\n'));
  return { planPath, planSha256, entries: plan.entries.length, outsideSet: plan.outsideSet.length };
}

function readVerifiedPlan(planPath, planSha256) {
  if (typeof planSha256 !== 'string' || !SHA256_HEX.test(planSha256)) throw new Refusal('--plan-sha256 must be the 64-character hash that plan printed');
  let raw;
  try {
    raw = readFileSync(planPath);
  } catch {
    throw new Refusal('the plan file cannot be read');
  }
  if (sha256(raw) !== planSha256) throw new Refusal('the plan file does not match --plan-sha256: it changed after plan printed that hash');
  const plan = JSON.parse(raw.toString('utf8'));
  const entries = plan?.schema === PLAN_SCHEMA && Array.isArray(plan.entries) ? plan.entries : null;
  if (!entries || entries.length === 0) throw new Refusal('the plan file holds no agents to reset');
  const wellFormed = entries.every((e) => typeof e?.id === 'string' && AGENT_ID.test(e.id) && SHA256_HEX.test(e.insightSha256 ?? ''));
  if (!wellFormed || new Set(entries.map((e) => e.id)).size !== entries.length) throw new Refusal('the plan file has a malformed or repeated entry');
  return plan;
}

// ---- apply ---------------------------------------------------------------

// The reset of one agent. The transaction re-reads the agent and returns its
// outcome; the caller counts it, because a contended transaction runs again.
async function resetOneAgent(db, entry, captured, runStamp, nowMs) {
  const ref = db.collection('agents').doc(entry.id);
  const activeBattles = db.collection('agentBattles')
    .where('agentId', '==', entry.id)
    .where('status', '==', 'active')
    .select('status');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'changed';
    const live = snap.data();
    // This run's own stamp: the commit landed and its acknowledgement was lost,
    // so the transaction ran again. A run stamp belongs to one run alone.
    if (live.consolidatedInsightResetAt === runStamp) return 'written';
    if (isAlreadyReset(live)) return 'noop';
    // Compare-and-set: the paragraph is the plan's, it is still in the set, and
    // every field is what the backup holds, so what restore writes back is what
    // was really here.
    if (typeof live.consolidatedInsight !== 'string' || sha256(live.consolidatedInsight) !== entry.insightSha256) return 'changed';
    if (selectionRule(live.consolidatedInsight) === null) return 'changed';
    if (!isDeepStrictEqual(backedUpFieldsOf(live), captured)) return 'changed';
    // A battle that started after the guard froze the old paragraph: stay out of it.
    if (docHoldsBattle(live, nowMs)) return 'battle';
    if (!(await tx.get(activeBattles)).empty) return 'battle';
    tx.update(ref, {
      consolidatedInsight: '',
      disciplines: FieldValue.delete(),
      pendingConsolidation: false,
      consolidatedInsightResetAt: runStamp,
      consolidatedInsightResetReason: RESET_REASON,
    });
    return 'written';
  });
}

function writeBackup(dir, plan, fleet, runStamp, planSha256) {
  const byId = new Map(fleet.map((a) => [a.id, a]));
  const backup = {
    schema: BACKUP_SCHEMA,
    runStamp,
    planSha256,
    agents: plan.entries.map(({ id }) => (byId.has(id)
      ? { id, exists: true, fields: backedUpFieldsOf(byId.get(id)) }
      : { id, exists: false, fields: {} })),
  };
  const body = JSON.stringify(backup, null, 2);
  const backupPath = path.join(dir, 'backup.local.json');
  writeDurable(backupPath, body);
  const onDisk = readFileSync(backupPath);
  const backupSha256 = sha256(onDisk);
  if (backupSha256 !== sha256(body)) throw new Refusal('the backup read back differently from what was written: nothing was changed');
  return { backupPath, backupSha256, agents: JSON.parse(onDisk.toString('utf8')).agents };
}

const errorClass = (err) => {
  const name = typeof err?.name === 'string' && /^[A-Za-z]{1,40}$/.test(err.name) ? err.name : 'Error';
  const code = Number.isInteger(err?.code) || (typeof err?.code === 'string' && /^[a-z_-]{1,40}$/i.test(err.code)) ? err.code : null;
  return code === null ? name : `${name} ${code}`;
};

export async function runApply({
  db, planPath, planSha256, go, allowWeekday = false, assertEpochOpen,
  now = new Date(), runsRoot = RUNS_ROOT, log = say,
}) {
  if (go !== true) throw new Refusal('apply writes to production: pass --go');
  const plan = readVerifiedPlan(planPath, planSha256);
  if (!allowWeekday && !isWeekendInNewYork(now)) {
    throw new Refusal('today is a weekday in America/New_York: run this on a Saturday or Sunday, or pass --allow-weekday');
  }
  const nowMs = now.getTime();
  const fleet = await readFleet(db);
  const activeIds = await readActiveBattleAgentIds(db);
  const holds = countBattleHolds(plan.entries.map((e) => e.id), fleet, activeIds, nowMs);
  if (holds.blocked > 0) {
    throw new Refusal(`a battle is live on ${holds.blocked} agent(s) in the plan or their family (own ${holds.own}, ranked parent ${holds.parent}, clone ${holds.clone}): nothing was changed`);
  }
  await assertEpochOpen(db);

  const runStamp = now.toISOString();
  const { backupPath, backupSha256, agents } = writeBackup(newRunDir(runsRoot, now), plan, fleet, runStamp, planSha256);
  const capturedById = new Map(agents.map((row) => [row.id, row]));
  log([`Run stamp: ${runStamp}`, `Backup: ${backupPath}`, `Backup SHA-256: ${backupSha256}`].join('\n'));

  const counts = { written: 0, changed: 0, battle: 0, noop: 0, errors: 0, notAttempted: 0 };
  const errorClasses = {};
  for (const [i, entry] of plan.entries.entries()) {
    try {
      await assertEpochOpen(db); // per-agent boundary: a loop straddling a close stops here
    } catch {
      counts.notAttempted = plan.entries.length - i;
      break;
    }
    try {
      counts[await resetOneAgent(db, entry, capturedById.get(entry.id).fields, runStamp, nowMs)] += 1;
    } catch (err) {
      counts.errors += 1;
      const cls = errorClass(err);
      errorClasses[cls] = (errorClasses[cls] || 0) + 1;
    }
  }
  const skipped = counts.changed + counts.battle;
  const clean = skipped === 0 && counts.errors === 0 && counts.notAttempted === 0;
  log([
    `written=${counts.written} skipped=${skipped} (changed since plan ${counts.changed}, battle started ${counts.battle}) no-op=${counts.noop} errors=${counts.errors} not attempted=${counts.notAttempted}`,
    ...Object.keys(errorClasses).sort().map((cls) => `  error class ${cls}: ${errorClasses[cls]}`),
    clean ? 'Clean run. Run census again to confirm the set is empty.' : 'Not a clean run. Bring these counts back before doing anything else.',
  ].join('\n'));
  return { ...counts, skipped, clean, runStamp, backupPath, backupSha256 };
}

// ---- restore -------------------------------------------------------------

async function restoreOneAgent(db, row, runStamp) {
  const ref = db.collection('agents').doc(row.id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 'skipped';
    const live = snap.data();
    if (live.consolidatedInsight !== '' || live.consolidatedInsightResetAt !== runStamp) return 'skipped';
    // A rewrite can return an empty paragraph with a new dossier and an advanced
    // cycle: the reset's stamp would survive it, and the old dossier must not.
    if (live.disciplines !== undefined) return 'skipped';
    const patch = {
      consolidatedInsightResetAt: FieldValue.delete(),
      consolidatedInsightResetReason: FieldValue.delete(),
    };
    for (const f of RESTORED_FIELDS) patch[f] = Object.hasOwn(row.fields, f) ? row.fields[f] : FieldValue.delete();
    tx.update(ref, patch);
    return 'restored';
  });
}

function readBackup(backupPath) {
  let backup;
  try {
    backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  } catch {
    throw new Refusal('the backup file cannot be read');
  }
  const wellFormed = backup?.schema === BACKUP_SCHEMA
    && typeof backup.runStamp === 'string' && Number.isFinite(Date.parse(backup.runStamp))
    && Array.isArray(backup.agents)
    && backup.agents.every((r) => typeof r?.id === 'string' && AGENT_ID.test(r.id) && r.fields && typeof r.fields === 'object');
  if (!wellFormed) throw new Refusal('the backup file is not a backup this script wrote');
  return backup;
}

export async function runRestore({ db, backupPath, go, assertEpochOpen, log = say }) {
  if (go !== true) throw new Refusal('restore writes to production: pass --go');
  const backup = readBackup(backupPath);
  await assertEpochOpen(db);

  const counts = { restored: 0, skipped: 0, errors: 0, notAttempted: 0 };
  const errorClasses = {};
  for (const [i, row] of backup.agents.entries()) {
    try {
      await assertEpochOpen(db); // per-agent boundary, as in apply
    } catch {
      counts.notAttempted = backup.agents.length - i;
      break;
    }
    try {
      counts[await restoreOneAgent(db, row, backup.runStamp)] += 1;
    } catch (err) {
      counts.errors += 1;
      const cls = errorClass(err);
      errorClasses[cls] = (errorClasses[cls] || 0) + 1;
    }
  }
  const clean = counts.skipped === 0 && counts.errors === 0 && counts.notAttempted === 0;
  log([
    `Run stamp restored from: ${backup.runStamp}`,
    `restored=${counts.restored} skipped=${counts.skipped} errors=${counts.errors} not attempted=${counts.notAttempted}`,
    ...Object.keys(errorClasses).sort().map((cls) => `  error class ${cls}: ${errorClasses[cls]}`),
  ].join('\n'));
  return { ...counts, clean };
}

// ---- CLI -----------------------------------------------------------------

const USAGE = 'usage: census | plan | apply --plan <file> --plan-sha256 <hex> --go [--allow-weekday] | restore --backup <file> --go';
const FLAGS = {
  census: {},
  plan: {},
  apply: { '--plan': 'value', '--plan-sha256': 'value', '--go': 'switch', '--allow-weekday': 'switch' },
  restore: { '--backup': 'value', '--go': 'switch' },
};

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!Object.hasOwn(FLAGS, command ?? '')) throw new Refusal(USAGE);
  const args = { command, go: false, allowWeekday: false, planPath: null, planSha256: null, backupPath: null };
  const fieldOf = { '--plan': 'planPath', '--plan-sha256': 'planSha256', '--backup': 'backupPath', '--go': 'go', '--allow-weekday': 'allowWeekday' };
  for (let i = 0; i < rest.length; i += 1) {
    const kind = Object.hasOwn(FLAGS[command], rest[i]) ? FLAGS[command][rest[i]] : null;
    if (kind === 'switch') args[fieldOf[rest[i]]] = true;
    else if (kind === 'value' && i + 1 < rest.length && !rest[i + 1].startsWith('--')) args[fieldOf[rest[i]]] = rest[++i];
    else throw new Refusal(USAGE);
  }
  if (command === 'apply' && (!args.planPath || !args.planSha256)) throw new Refusal(USAGE);
  if (command === 'restore' && !args.backupPath) throw new Refusal(USAGE);
  return args;
}

/** What main() prints on failure: its own refusal, or an error's class, never its message. */
export function failureLine(err) {
  return err instanceof Refusal ? `REFUSED: ${err.message}` : `FAILED: ${errorClass(err)}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { requireFirebaseCreds } = await import('./loadLocalEnv.js');
  requireFirebaseCreds(); // an actionable line, names only, instead of FAILED: Error
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  const { assertWriteEpochOpen } = await import('../api/_utils/compositionWriteEpoch.js');
  const db = getFirebaseAdmin();
  const assertEpochOpen = (firestore) => assertWriteEpochOpen(firestore);
  if (args.command === 'census') await runCensus({ db });
  if (args.command === 'plan') await runPlan({ db });
  if (args.command === 'apply') {
    const result = await runApply({ db, ...args, assertEpochOpen });
    if (!result.clean) process.exitCode = 1;
  }
  if (args.command === 'restore') {
    const result = await runRestore({ db, backupPath: args.backupPath, go: args.go, assertEpochOpen });
    if (!result.clean) process.exitCode = 1;
  }
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) main().catch((err) => { console.error(failureLine(err)); process.exit(1); });
