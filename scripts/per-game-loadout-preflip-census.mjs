// scripts/per-game-loadout-preflip-census.mjs
//
// The armory flip (founder ruling FL6, Nov 7, 2026) — THE LEAGUE LOCKS THE FLIP SWITCHES ON. With
// PER_GAME_LOADOUT_ENABLED on, a player's League loadout is locked while they have a ranked group in `forming`,
// `drafting`, `awaiting_open` or `battle` (FD-3; src/constants/perGameLoadout.js leagueLockOf). A group stuck in a past
// week would lock its players for good, with a stale date (the A2 review's A2R-4). This census counts those locks
// before the flip merges.
//
// WHAT IT READS. One query: `tournamentGroups where status in LEAGUE_LOCK_STATUSES`, field-masked to what the lock
// reads. Each group is judged by the lock's own rule, leagueLockOf([group]) — so a training pod (`isTraining === true`,
// selectMyGroup's check) never counts, exactly as it never locks. For each locking group: its status, the week it is
// for (battleAnchorEtDateOf's answer, with the field it came from), its player count (groupMembers, CPU seats apart),
// and the lock end leagueLockOf gives. A group whose lock end has passed, or that has none, is STALE. Players are
// counted once each: a player's lock is leagueLockOf over all their locking groups (the group selectMyGroup picks),
// and the player is stale when that lock is.
//
// READ-ONLY BY CONSTRUCTION. runCensus receives a RESTRICTED READER (one field-masked query, nothing else), never the
// database handle: the handle exists only inside main(), which wraps it. per-game-loadout-preflip-census.test.js pins
// the static imports, pins that no write member is called anywhere in this file, and runs the reader against a double
// that records every call.
//
// WHERE THE ANSWER GOES. Counts only on stdout. The JSON report (per group: id, status, week, its field, players, lock
// end, stale) lands OUTSIDE version control: the default name is in .gitignore, as mastery-preflip-census.js's is. It
// carries no player ids. The build report and the PR carry counts only.
//
// CREDENTIALS — env only, loaded LAZILY inside main(): scripts/loadLocalEnv.js (.env.local → process.env) and
// api/_utils/firebaseAdmin.js, as census-activation-evidence.mjs does.
//
// USAGE (repo root):
//   node scripts/per-game-loadout-preflip-census.mjs [--json <path>]

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEAGUE_LOCK_STATUSES, battleAnchorEtDateOf, leagueLockOf } from '../src/constants/perGameLoadout.js';
import { CPU_USER_ID_PREFIX, TOURNAMENT_GROUPS_COLLECTION } from '../src/constants/leagueTournament.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The JSON report's default name, at the repo root and in .gitignore. */
export const DEFAULT_JSON_NAME = 'per-game-loadout-preflip-census-report.json';

/** The census's own read limit; a full read is reported as truncated. */
export const CENSUS_LIMIT = 10_000;

/** What the lock reads of a group (leagueLockOf → selectMyGroup and leagueWeekEndMsOf), and nothing else. */
export const GROUP_FIELDS = Object.freeze([
  'status', 'isTraining', 'updatedAt', 'groupMembers', 'isLiveDraft', 'createdAt', 'scheduledDraftAt',
  'startAnchor.anchorEtDate', 'dailyScores.day1.recordedDate', 'battleStartWeek.anchorEtDate',
]);

const ET_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The field battleAnchorEtDateOf took the week from, in its own order (src/constants/perGameLoadout.js): a stamped
 * date first, else the instant it derives the week from. The test holds the two in agreement on every fixture.
 */
export function weekFieldOf(group) {
  if (ET_DATE_RE.test(group?.startAnchor?.anchorEtDate ?? '')) return 'startAnchor.anchorEtDate';
  if (ET_DATE_RE.test(group?.dailyScores?.day1?.recordedDate ?? '')) return 'dailyScores.day1.recordedDate';
  if (ET_DATE_RE.test(group?.battleStartWeek?.anchorEtDate ?? '')) return 'battleStartWeek.anchorEtDate';
  if (group?.isLiveDraft === true && group?.scheduledDraftAt != null) return 'scheduledDraftAt';
  return group?.createdAt != null ? 'createdAt' : null;
}

/**
 * The reader runCensus is handed: ONE field-masked query, frozen. Nothing in it writes, and the database handle never
 * leaves this function.
 */
export function restrictedReader(db) {
  return Object.freeze({
    query: async ({ collection, where, limit, fields }) => {
      let q = db.collection(collection);
      for (const [field, op, value] of where) q = q.where(field, op, value);
      q = q.limit(limit).select(...fields);
      return (await q.get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    },
  });
}

const isCpuSeat = (uid) => typeof uid === 'string' && uid.startsWith(CPU_USER_ID_PREFIX);
const staleOf = (endsAtMs, nowMs) => (endsAtMs === null ? 'no_lock_end' : endsAtMs <= nowMs ? 'lock_end_passed' : null);

/**
 * The census. `reader` is a restrictedReader (or a test double with the same one method); `nowMs` is the instant the
 * locks are judged at. Returns the whole answer; censusMain decides what each channel carries.
 */
export async function runCensus(reader, { nowMs }) {
  const docs = await reader.query({
    collection: TOURNAMENT_GROUPS_COLLECTION,
    where: [['status', 'in', [...LEAGUE_LOCK_STATUSES]]],
    limit: CENSUS_LIMIT,
    fields: GROUP_FIELDS,
  });
  const groups = [];
  let trainingExcluded = 0;
  const byPlayer = new Map();
  for (const doc of docs) {
    const lock = leagueLockOf([doc]);
    if (!lock.locked) { trainingExcluded += 1; continue; } // selectMyGroup's check: a training pod never locks
    const members = Array.isArray(doc.groupMembers) ? doc.groupMembers.filter((m) => typeof m === 'string' && m) : [];
    const players = [...new Set(members.filter((m) => !isCpuSeat(m)))];
    const stale = staleOf(lock.endsAtMs, nowMs);
    groups.push({
      groupId: doc.id,
      status: doc.status,
      weekOf: battleAnchorEtDateOf(doc),
      weekField: weekFieldOf(doc),
      players: players.length,
      cpuSeats: members.length - members.filter((m) => !isCpuSeat(m)).length,
      lockEndsAt: lock.endsAtMs === null ? null : new Date(lock.endsAtMs).toISOString(),
      stale: stale !== null,
      staleReason: stale,
    });
    for (const uid of players) {
      if (!byPlayer.has(uid)) byPlayer.set(uid, []);
      byPlayer.get(uid).push(doc);
    }
  }
  let stalePlayers = 0;
  let playersInTwoOrMore = 0;
  for (const own of byPlayer.values()) {
    if (own.length > 1) playersInTwoOrMore += 1;
    if (staleOf(leagueLockOf(own).endsAtMs, nowMs) !== null) stalePlayers += 1;
  }
  const byStatus = Object.fromEntries(LEAGUE_LOCK_STATUSES.map((s) => [s, groups.filter((g) => g.status === s).length]));
  const staleByStatus = Object.fromEntries(LEAGUE_LOCK_STATUSES.map((s) => [s, groups.filter((g) => g.status === s && g.stale).length]));
  return {
    nowIso: new Date(nowMs).toISOString(),
    query: { collection: TOURNAMENT_GROUPS_COLLECTION, statuses: [...LEAGUE_LOCK_STATUSES], limit: CENSUS_LIMIT },
    truncated: docs.length >= CENSUS_LIMIT,
    totals: {
      groupsRead: docs.length,
      trainingExcluded,
      groupsLocking: groups.length,
      playersLocked: byPlayer.size,
      playersInTwoOrMoreGroups: playersInTwoOrMore,
      staleGroups: groups.filter((g) => g.stale).length,
      staleGroupsNoLockEnd: groups.filter((g) => g.staleReason === 'no_lock_end').length,
      stalePlayers,
    },
    byStatus,
    staleByStatus,
    groups: groups.sort((a, b) => String(a.lockEndsAt ?? '').localeCompare(String(b.lockEndsAt ?? '')) || a.groupId.localeCompare(b.groupId)),
  };
}

/** The counts, as stdout carries them: no group id, no player id. */
export function renderCounts(R) {
  const t = R.totals;
  return [
    `League locks at the flip (judged at ${R.nowIso})${R.truncated ? ' — TRUNCATED at the read limit' : ''}`,
    `  ranked groups locking: ${t.groupsLocking} (read ${t.groupsRead}; training pods excluded ${t.trainingExcluded})`,
    `    by status: ${Object.entries(R.byStatus).map(([s, n]) => `${s} ${n}`).join(', ')}`,
    `  players locked: ${t.playersLocked} (in two or more locking groups: ${t.playersInTwoOrMoreGroups})`,
    `  stale groups: ${t.staleGroups} (no lock end: ${t.staleGroupsNoLockEnd}); by status: ${Object.entries(R.staleByStatus).map(([s, n]) => `${s} ${n}`).join(', ')}`,
    `  stale players: ${t.stalePlayers}`,
  ].join('\n');
}

export function parseArgs(argv) {
  const a = { jsonPath: path.join(PROJECT_ROOT, DEFAULT_JSON_NAME) };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') a.jsonPath = argv[++i];
    else if (argv[i].startsWith('--json=')) a.jsonPath = argv[i].slice('--json='.length);
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return a;
}

/** Every output channel goes through here: the JSON file and stdout. */
export async function censusMain({ argv, reader, writeFile = writeFileSync, log = console.log, nowMs = Date.now() }) {
  const args = parseArgs(argv);
  const R = await runCensus(reader, { nowMs });
  writeFile(args.jsonPath, `${JSON.stringify(R, null, 2)}\n`);
  log(renderCounts(R));
  log(`  report: ${path.basename(args.jsonPath)} (outside version control)`);
  return R;
}

export async function main(argv = process.argv.slice(2)) {
  await import('./loadLocalEnv.js');
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  return censusMain({ argv, reader: restrictedReader(getFirebaseAdmin()) });
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) main().catch((err) => { console.error(`census failed: ${err?.code ?? err?.name ?? 'error'}`); process.exit(1); });
