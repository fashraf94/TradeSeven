// scripts/backingSmokeLib.js
//
// Backing activation — THE PURE HALF of scripts/backing-smoke.js (spec V1.3
// §11 gate 4 as amended by Amendment A §A7: the founder smoke), split out so
// every decision the script makes about WHAT to write and WHAT it may delete
// is unit-tested (scripts/backingSmokeLib.test.js) without credentials:
//
//   · the ids a run mints, none of them inside the `dev-` id space that
//     `poolIdFor` / `walletIdFor` refuse (the group and the synthetic users
//     are `smk_…`; the POOL and the WALLETS the primitives derive are `dev-…`);
//   · the seed's group document — a real lobby pod through the tournament's
//     own factory (createTournamentGroupDoc), stamped for the UPCOMING battle
//     week (D-SEEDWEEK: the week the pool will belong to, never the formation
//     week), marked `isDev` and carrying the smoke marker;
//   · the synthetic five-day week `advance` banks — five entries in the
//     banking writer's own shape, every human seat with a NON-ZERO agent half
//     (D-ae: an all-zero agent layer holds settlement), one named winner;
//   · the eligibility checker the synthetic backers stake through — the two
//     account facts a synthetic user cannot hold are asserted by the seeder
//     that made it; the two POD facts run through the real seat derivation;
//   · the ledger invariants `status` prints (Σ entries = cached balances);
//   · the cleanup VERDICT — the one function that says whether a path is the
//     dev namespace's and this run's; anything else is refused, never deleted;
//   · the manifest and the command line.
//
// Imports api/_utils modules the way the precheck script does: Node-clean,
// no Firestore handle here — every function is pure over plain objects.

import { createTournamentGroupDoc, computeComposite, cpuUserId, isCpuUserId } from '../src/constants/leagueTournament.js';
import { deriveBaseLayerWeek, deriveBattleStartWeek } from '../api/_utils/liveDraftFormation.js';
import { SMOKE_POD_TOOL, poolIdFor, seatedIdsFor } from '../api/_utils/backingPools.js';
import { ANONYMOUS_SIGN_IN_PROVIDER, BACKING_INELIGIBLE, checkBackingEligibility, signInProviderOf } from '../api/_utils/backingEligibility.js';
import { ENTRY_TYPES } from '../api/_utils/backingWallet.js';

/** Every id this script mints starts here — and never with `dev-`. */
export const SMOKE_PREFIX = 'smk_';
/** The marker every pod the seeder creates carries (`smoke.tool`) — the SAME constant the smoke pod list admits on (backingPools.js smokeListablePod); the cleanup verdict demands it. */
export const SMOKE_TOOL = SMOKE_POD_TOOL;
/** The two synthetic human seats' names — the pod's own `seatNames`, so the labels resolve without a users/ document. */
export const SMOKE_SEAT_NAMES = Object.freeze(['Smoke Rival A', 'Smoke Rival B']);
/** Two CPU seats, numbered far above any lobby's reservation. */
export const SMOKE_CPU_NS = Object.freeze([98, 99]);
/** The synthetic backers' stakes: two backers, two teams, so the founder's own stake makes three backers on two teams. */
export const SMOKE_STAKES = Object.freeze([
  { backer: 0, seat: 0, amount: 200 },
  { backer: 1, seat: 1, amount: 150 },
]);
/** A fallback user pool when the ranked universe is unreadable — the pod never drafts; the names are decoration. */
export const FALLBACK_USER_POOL = Object.freeze([
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'JPM', 'V',
  'UNH', 'XOM', 'LLY', 'COST', 'HD', 'PG', 'MA', 'ABBV', 'KO', 'NFLX',
]);
/** The minimum names the group factory's consumers expect (buildBoardCommit's floor). */
export const USER_POOL_FLOOR = 15;

/** The default manifest path, under the gitignored scripts/output/. */
export const MANIFEST_RELATIVE = 'scripts/output/backing-smoke-manifest.json';

// ==================== IDS ====================

/** A run stamp: the ET-free UTC date plus six random characters. */
export function runStamp(now = new Date(), random = Math.random) {
  const d = new Date(now);
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let tail = '';
  for (let i = 0; i < 6; i += 1) tail += alphabet[Math.floor(random() * alphabet.length) % alphabet.length];
  return `${ymd}_${tail}`;
}

/** Every id one run mints. None starts with `dev-`; the pool and wallets the primitives derive do. */
export function smokeIds(stamp) {
  if (typeof stamp !== 'string' || !/^[a-z0-9_]+$/i.test(stamp)) throw new Error('smokeIds: a run stamp is required');
  return {
    stamp,
    groupId: `${SMOKE_PREFIX}${stamp}`,
    poolId: `dev-${SMOKE_PREFIX}${stamp}`,
    seatUids: [`${SMOKE_PREFIX}seat_a_${stamp}`, `${SMOKE_PREFIX}seat_b_${stamp}`],
    backerUids: [`${SMOKE_PREFIX}backer_1_${stamp}`, `${SMOKE_PREFIX}backer_2_${stamp}`],
    cpuIds: SMOKE_CPU_NS.map((n) => cpuUserId(n)),
  };
}

// ==================== THE SEED ====================

/** The UPCOMING battle week for a pod formed at `nowIso` — the week its pool belongs to (D-SEEDWEEK). */
export function upcomingBattleWeek(nowIso) {
  const battleStartWeek = deriveBattleStartWeek(nowIso);
  return { battleMondayEtDate: battleStartWeek.mondayEtDate, baseLayerWeek: deriveBaseLayerWeek(battleStartWeek) };
}

/**
 * The seed's group document: a real lobby pod through the tournament's own
 * factory — two synthetic humans and two CPU seats, `forming`, stamped for
 * the UPCOMING battle week — plus `isDev`, the seat names, and the marker.
 */
export function buildSmokeGroup({ ids, nowIso, userPool, founderUid = null }) {
  const pool = Array.isArray(userPool) && userPool.length >= USER_POOL_FLOOR ? userPool : [...FALLBACK_USER_POOL];
  const { baseLayerWeek } = upcomingBattleWeek(nowIso);
  const doc = createTournamentGroupDoc({
    players: [
      { odUserId: ids.seatUids[0], picks: [] },
      { odUserId: ids.seatUids[1], picks: [] },
      ...ids.cpuIds.map((odUserId) => ({ odUserId, picks: [], isCpu: true })),
    ],
    userPool: pool,
    roundNumber: 1,
    baseLayerWeek,
    status: 'forming',
    now: nowIso,
  });
  return {
    ...doc,
    isDev: true,
    seatNames: { [ids.seatUids[0]]: SMOKE_SEAT_NAMES[0], [ids.seatUids[1]]: SMOKE_SEAT_NAMES[1] },
    // The marker carries what `cleanup` needs to rebuild the run from the
    // LIVE document when the local manifest is gone (another machine, a
    // fresh clone — SCRIPT-07): its backers, and the founder when named.
    smoke: {
      tool: SMOKE_TOOL,
      stamp: ids.stamp,
      createdAt: nowIso,
      backerUids: [...ids.backerUids],
      ...(typeof founderUid === 'string' && founderUid.length > 0 ? { founderUid } : {}),
    },
  };
}

/**
 * A run rebuilt from a LIVE pod document (`cleanup --pod=<id>` on a machine
 * without the manifest): only for a pod that is `isDev`, carries this
 * script's marker, and routes to the `dev-` pool the marker's run would —
 * anything else is `null`, never a guess. Marked `recovered` so `status`
 * and `cleanup` say where the run came from.
 */
export function runFromLiveGroup(groupId, group) {
  if (typeof groupId !== 'string' || !groupId.startsWith(SMOKE_PREFIX)) return null;
  if (group?.isDev !== true || group?.smoke?.tool !== SMOKE_TOOL) return null;
  let poolId = null;
  try { poolId = poolIdFor({ ...group, id: groupId }); } catch { return null; }
  if (poolId !== `dev-${groupId}`) return null;
  const players = Array.isArray(group.players) ? group.players : [];
  const backerUids = Array.isArray(group.smoke.backerUids) ? group.smoke.backerUids.filter((u) => typeof u === 'string') : [];
  return {
    groupId,
    poolId,
    stamp: typeof group.smoke.stamp === 'string' ? group.smoke.stamp : groupId.slice(SMOKE_PREFIX.length),
    createdAt: typeof group.smoke.createdAt === 'string' ? group.smoke.createdAt : group.createdAt ?? null,
    battleMondayEtDate: null,
    baseLayerWeek: typeof group.baseLayerWeek === 'string' ? group.baseLayerWeek : null,
    seatUids: players.filter((pl) => pl?.isCpu !== true && !isCpuUserId(pl?.odUserId)).map((pl) => pl.odUserId),
    cpuIds: players.filter((pl) => pl?.isCpu === true || isCpuUserId(pl?.odUserId)).map((pl) => pl.odUserId),
    backerUids,
    founderUid: typeof group.smoke.founderUid === 'string' ? group.smoke.founderUid : null,
    uids: [...backerUids],
    stakes: [],
    recovered: true,
  };
}

/**
 * The shape every run this script acts on must have — a manifest entry a
 * hand edit (or a stale manifest from another build) could have bent: the
 * pod id starts with the smoke prefix, the pool is that pod's `dev-` pool,
 * the backers are a list. `devTargetVerdict` refuses everything for a run
 * outside this shape, so no target is ever judged against a run that could
 * name a production pod (DEV-3, the activation review record).
 */
export function validSmokeRun(run) {
  return Boolean(run)
    && typeof run.groupId === 'string' && run.groupId.startsWith(SMOKE_PREFIX)
    && typeof run.poolId === 'string' && run.poolId === `dev-${run.groupId}`
    && Array.isArray(run.backerUids) && run.backerUids.every((u) => typeof u === 'string' && u.length > 0);
}

/** The synthetic backers' decoded-token stand-in: a named, non-anonymous provider. */
export function syntheticToken(uid) {
  return { uid, firebase: { sign_in_provider: 'backing-smoke' } };
}

/**
 * The eligibility checker the SYNTHETIC backers stake through (placeStake's
 * `checkEligibility`). For a uid the seeder made — and only for one — the two
 * account facts a synthetic user cannot hold (a consent record, a completed
 * battle) are asserted by the seeder; an anonymous provider is still refused,
 * and the two POD facts — own-pod and seat-present — run through the real
 * `seatedIdsFor`. Any other uid goes to the real checker unchanged.
 */
export function smokeEligibilityFor(syntheticUids) {
  const synthetic = new Set(syntheticUids);
  return async function checkSmokeEligibility(db, args = {}) {
    const { uid, decodedToken, group, teamOdUserId } = args;
    if (!synthetic.has(uid)) return checkBackingEligibility(db, args);
    if (signInProviderOf(decodedToken) === ANONYMOUS_SIGN_IN_PROVIDER) {
      return { allowed: false, reason: BACKING_INELIGIBLE.ACCOUNT_REQUIRED };
    }
    const seated = seatedIdsFor(group);
    if (seated.has(uid)) return { allowed: false, reason: BACKING_INELIGIBLE.OWN_POD };
    if (!seated.has(teamOdUserId)) return { allowed: false, reason: BACKING_INELIGIBLE.SEAT_NOT_PRESENT };
    return { allowed: true, reason: null };
  };
}

// ==================== THE SYNTHETIC WEEK ====================

/** `YYYY-MM-DD` plus n days, on the calendar alone (no clock, no zone). */
export function addDays(ymd, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new Error(`addDays: not a date: ${ymd}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Five banked days for the group, in the banking writer's shape
 * (tournamentBanking.js `dayEntry`): `closeScores` per member with
 * `totalPoints`, `agentPoints`, `compositePoints` (the composite of record,
 * `computeComposite`), `recordedDate` Monday..Friday of the battle week.
 * Every HUMAN seat banks a non-zero agent half (D-ae), the named winner the
 * strictly highest composite — on BOTH layers, whether it is a human or a
 * CPU seat (`--winner=cpu-98` names the CPU; SCRIPT-03) — and everyone else
 * distinct values below it — no ties, so the winning set is exactly the
 * winner.
 */
export function buildSyntheticWeek({ group, battleMondayEtDate, winnerOdUserId, recordedAtIso }) {
  const members = Array.isArray(group?.groupMembers) ? group.groupMembers : [];
  if (!members.includes(winnerOdUserId)) throw new Error(`buildSyntheticWeek: ${winnerOdUserId} is not a member of the pod`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(battleMondayEtDate ?? '')) throw new Error('buildSyntheticWeek: a battleMondayEtDate is required');
  const cpuFlagged = new Set((Array.isArray(group?.players) ? group.players : []).filter((p) => p?.isCpu === true).map((p) => p.odUserId));
  const others = members.filter((id) => id !== winnerOdUserId);
  const dailyScores = {};
  for (let day = 1; day <= 5; day += 1) {
    const closeScores = {};
    // Cumulative standings that grow by the day; the winner's lead is
    // strict from day one and widens.
    members.forEach((id) => {
      const human = !cpuFlagged.has(id) && !isCpuUserId(id);
      const rank = id === winnerOdUserId ? 0 : others.indexOf(id) + 1;
      const totalPoints = round2((3.0 - rank * 0.7) * day);
      // A HUMAN agent half is never zero (D-ae); a CPU's may be small but is
      // non-zero too, so the week reads as played on both layers. The named
      // winner takes the top agent half whatever its kind, so a CPU winner
      // is the composite's winner too.
      const agentPoints = round2((rank === 0 ? 5.0 : human ? 4.0 : 1.5) * day - rank * 0.4 * day);
      closeScores[id] = {
        totalPoints,
        agentPoints,
        compositePoints: round2(computeComposite(agentPoints, totalPoints)),
      };
    });
    dailyScores[`day${day}`] = {
      closeScores,
      recordedAt: recordedAtIso,
      recordedBy: SMOKE_TOOL,
      recordedDate: addDays(battleMondayEtDate, day - 1),
    };
  }
  return dailyScores;
}

// ==================== THE LEDGER INVARIANTS ====================

const ALLOWANCE_TYPES = new Set([ENTRY_TYPES.ALLOWANCE, ENTRY_TYPES.STAKE, ENTRY_TYPES.EXPIRY]);
const CAREER_TYPES = new Set([ENTRY_TYPES.STAKE, ENTRY_TYPES.PAYOUT, ENTRY_TYPES.REFUND]);
const SEASON_TYPES = new Set([ENTRY_TYPES.PAYOUT, ENTRY_TYPES.REFUND, ENTRY_TYPES.LOSS]);

/**
 * Σ entries = the cached balances (spec §6 ledger-first), as `status` prints:
 *   allowanceRemaining = Σ allowance + stake + expiry deltas;
 *   careerNet          = Σ stake + payout + refund deltas;
 *   seasons[m].net     = Σ payout + refund + loss deltas with that monthKey.
 */
export function ledgerInvariant(wallet, entries) {
  const list = Array.isArray(entries) ? entries : [];
  const sum = (pick) => list.reduce((acc, e) => acc + (pick(e) && Number.isFinite(e?.delta) ? e.delta : 0), 0);
  const allowance = sum((e) => ALLOWANCE_TYPES.has(e?.type));
  const career = sum((e) => CAREER_TYPES.has(e?.type));
  const seasons = {};
  for (const e of list) {
    if (!SEASON_TYPES.has(e?.type) || typeof e?.monthKey !== 'string') continue;
    seasons[e.monthKey] = (seasons[e.monthKey] ?? 0) + (Number.isFinite(e.delta) ? e.delta : 0);
  }
  const cachedAllowance = Number.isFinite(wallet?.allowanceRemaining) ? wallet.allowanceRemaining : 0;
  const cachedCareer = Number.isFinite(wallet?.careerNet) ? wallet.careerNet : 0;
  const cachedSeasons = wallet?.seasons && typeof wallet.seasons === 'object' ? wallet.seasons : {};
  const seasonKeys = [...new Set([...Object.keys(seasons), ...Object.keys(cachedSeasons)])].sort();
  const seasonRows = seasonKeys.map((m) => ({ monthKey: m, cached: Number.isFinite(cachedSeasons[m]?.net) ? cachedSeasons[m].net : 0, summed: seasons[m] ?? 0 }));
  return {
    entries: list.length,
    allowance: { cached: cachedAllowance, summed: allowance, ok: cachedAllowance === allowance },
    career: { cached: cachedCareer, summed: career, ok: cachedCareer === career },
    seasons: seasonRows.map((r) => ({ ...r, ok: r.cached === r.summed })),
    ok: cachedAllowance === allowance && cachedCareer === career && seasonRows.every((r) => r.cached === r.summed),
  };
}

// ==================== THE CLEANUP VERDICT ====================

/**
 * May `cleanup` delete the document at `path`? ONE function, per collection,
 * and the answer is `{ ok: true }` or `{ ok: false, reason }` — the script
 * refuses the whole run on the first `false` and deletes nothing.
 *
 *   backingPools/<id>[/private/<d>]      the id is this run's `dev-` pool id
 *   backingWallets/<id>[/entries/<e>]    the id starts with `dev-`
 *   backingStakes/<id>[/private/meta]    the (parent) document's groupId is this run's pod AND its poolId this run's dev pool
 *   backingEvents/<id>                   a dev-marked event of one of this run's users
 *   tournamentGroups/<id>[/<sub>/<d>]    this run's pod, `isDev: true`, carrying the smoke marker
 *   anything else                        refused
 *
 * @param {string} path
 * @param {Object|null} doc the document's data (for a subcollection doc, its PARENT's data where the rule needs it)
 * @param {{groupId: string, poolId: string, uids: string[]}} run
 */
export function devTargetVerdict(path, doc, run) {
  const parts = typeof path === 'string' ? path.split('/') : [];
  const [col, id, sub, subId] = parts;
  const no = (reason) => ({ ok: false, reason: `${path}: ${reason}` });
  // The RUN first: a run outside the smoke shape names nothing this script
  // may delete — not even a `dev-` wallet (DEV-3).
  if (!validSmokeRun(run)) return no('the run is not a smoke run (pod id, pool id or backers out of shape)');
  if (!col || !id || parts.length % 2 !== 0 || parts.length > 4) return no('not a document path');
  switch (col) {
    case 'backingPools':
      if (!id.startsWith('dev-')) return no('a pool outside the dev namespace');
      if (id !== run.poolId) return no("not this run's pool");
      if (sub !== undefined && sub !== 'private') return no('an unexpected subcollection');
      return { ok: true };
    case 'backingWallets':
      if (!id.startsWith('dev-')) return no('a wallet outside the dev namespace');
      if (sub !== undefined && sub !== 'entries') return no('an unexpected subcollection');
      return { ok: true };
    case 'backingStakes':
      if (doc?.groupId !== run.groupId) return no("a stake that does not name this run's pod");
      // …and its POOL — the `dev-` pool every smoke stake is written with
      // (`poolId`, backingStake.js): a stake on a production pool under the
      // same pod id is never this run's (DEV-3).
      if (doc?.poolId !== run.poolId) return no("a stake that does not name this run's dev pool");
      if (sub !== undefined && (sub !== 'private' || subId !== 'meta')) return no('an unexpected subcollection');
      return { ok: true };
    case 'backingEvents': {
      if (sub !== undefined) return no('an unexpected subcollection');
      const marked = doc?.isDev === true || doc?.props?.isDev === true || id.startsWith('dev:') || id.startsWith('stake_confirmed:dev:');
      if (!marked) return no('an event without the dev marker');
      if (!Array.isArray(run?.uids) || !run.uids.includes(doc?.userId)) return no("an event of a user outside this run");
      return { ok: true };
    }
    case 'tournamentGroups':
      if (id !== run.groupId) return no("not this run's pod");
      if (doc?.isDev !== true) return no('a pod that is not isDev');
      if (doc?.smoke?.tool !== SMOKE_TOOL) return no('a pod without the smoke marker');
      return { ok: true };
    default:
      return no('a collection this script never touches');
  }
}

// ==================== THE READ-ONLY HANDLE ====================

const MUTATORS = new Set([
  'set', 'update', 'delete', 'create', 'add', 'commit',
  'batch', 'bulkWriter', 'runTransaction', 'recursiveDelete', 'withConverter',
]);
// Getters that hand back a live, unwrapped SDK object from which `.set()` is
// reachable again (`ref.parent.doc(x).set()`, `ref.firestore…`, a wrapped
// ref's `.ref`) — blocked on ACCESS, as scripts/n1-stranded-precheck.js does.
const ESCAPES = new Set(['parent', 'firestore', 'ref']);

/**
 * Wrap a Firestore handle so any write path THROWS instead of writing — the
 * precheck's guarantee (scripts/n1-stranded-precheck.js `readOnly`), reused
 * for `status` and for every `--dry-run`: "writes nothing" then rests on a
 * throw, not on discipline (DEV-6 / SCRIPT-10, the activation review record).
 * Every mutator name and every escape-hatch getter throws on the handle and
 * on every ref/query/collection chained from it; a Promise result (a
 * snapshot, `listCollections()`) passes through unwrapped — inert data whose
 * own `.ref` this script only ever reads `.path`/`.id` from.
 */
export function readOnlyHandle(target, path = 'db') {
  return new Proxy(target, {
    get(t, prop) {
      if (typeof prop === 'string' && MUTATORS.has(prop)) {
        throw new Error(`READ-ONLY VIOLATION: ${path}.${prop}() — backing-smoke status / --dry-run must never write.`);
      }
      if (typeof prop === 'string' && ESCAPES.has(prop)) {
        throw new Error(`READ-ONLY VIOLATION: ${path}.${prop} is a write-capable escape hatch — backing-smoke status / --dry-run must never reach it.`);
      }
      // No receiver: Firestore classes use private fields, and forwarding the
      // proxy as `this` to a getter would throw.
      const value = Reflect.get(t, prop);
      if (typeof value !== 'function') return value;
      return (...args) => {
        const result = value.apply(t, args);
        const chainable = result && typeof result === 'object' && typeof result.then !== 'function';
        return chainable ? readOnlyHandle(result, `${path}.${prop}`) : result;
      };
    },
  });
}

// ==================== THE MANIFEST ====================

export function emptyManifest() {
  return { version: 1, tool: SMOKE_TOOL, runs: [] };
}

export function addRun(manifest, run) {
  const base = manifest && Array.isArray(manifest.runs) ? manifest : emptyManifest();
  return { ...base, runs: [...base.runs.filter((r) => r.groupId !== run.groupId), run] };
}

export function removeRun(manifest, groupId) {
  const base = manifest && Array.isArray(manifest.runs) ? manifest : emptyManifest();
  return { ...base, runs: base.runs.filter((r) => r.groupId !== groupId) };
}

export function latestRun(manifest) {
  const runs = manifest && Array.isArray(manifest.runs) ? manifest.runs : [];
  return runs.length > 0 ? runs[runs.length - 1] : null;
}

// ==================== THE COMMAND LINE ====================

export const COMMANDS = Object.freeze(['seed', 'advance', 'refund', 'status', 'cleanup']);

/**
 * `node scripts/backing-smoke.js <command> [--pod=<groupId>] [--winner=<odUserId>] [--founder=<uid>] [--dry-run] [--json]`
 * `--pod` names an existing run, so `seed` (which mints one) refuses it as
 * unknown rather than silently ignoring it (SCRIPT-12).
 */
export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = { dryRun: false, json: false, pod: null, winner: null, founder: null };
  const unknown = [];
  for (const a of rest) {
    if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--json') flags.json = true;
    else if (a.startsWith('--pod=') && command !== 'seed') flags.pod = a.slice('--pod='.length).trim() || null;
    else if (a.startsWith('--winner=')) flags.winner = a.slice('--winner='.length).trim() || null;
    else if (a.startsWith('--founder=')) flags.founder = a.slice('--founder='.length).trim() || null;
    else unknown.push(a);
  }
  return { command: COMMANDS.includes(command) ? command : null, flags, unknown };
}
