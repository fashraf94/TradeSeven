// scripts/backing-smoke.js
//
// Backing activation — THE FOUNDER SMOKE, driven locally (spec V1.3 §11 gate 4
// as amended by Amendment A §A7; the runbook: docs/BACKING_SMOKE_RUNBOOK.md).
// Five subcommands, every one of them refusing to touch anything but an
// `isDev` pod this script made:
//
//   seed     create an isDev lobby pod stamped for the UPCOMING battle week
//            (D-SEEDWEEK — the week the pool will belong to, not the
//            formation week), two synthetic human seats + two CPU seats,
//            materialize its pool (`dev-{groupId}`), and place two synthetic
//            backers' stakes THROUGH THE REAL STAKE PRIMITIVE (placeStake) —
//            so the founder's own stake, on the preview, makes three backers
//            on two teams.
//   advance  with the founder's stake in: close the pool at a simulated
//            instant, bank a synthetic five-day week into the dev group so one
//            team wins, move it to `complete`, and settle through the real
//            settlement primitive (settlePool). Prints the winner and every
//            payout.
//   refund   the alternate ending: close, void the dev group, run the real
//            refund primitive (refundPool). Prints every refund.
//   status   read-only: the pod, the pool, the stakes, the wallets and their
//            ledgers (Σ entries = the cached balances).
//   cleanup  delete every document a run created, from the manifest this
//            script writes — refusing the whole run on any target outside the
//            dev namespace (backingSmokeLib.js devTargetVerdict).
//
// `--dry-run` on every writing command: reads, prints the plan, writes nothing.
// The manifest: scripts/output/backing-smoke-manifest.json (gitignored).
//
// WHAT A RUN WRITES, exactly, and where each lives:
//   tournamentGroups/{smk_…}                 the pod — isDev, smoke-marked
//   backingPools/dev-smk_…  (+ private/totals)   the pool, in the dev namespace
//   backingStakes/stk_…     (+ private/meta)     the stakes — ids are content hashes,
//                                                the collection is shared, the
//                                                stake's `groupId` is this pod's
//   backingWallets/dev-{uid} (+ entries/*)       every backer's DEV wallet
//   backingEvents/stake_confirmed:dev:…, dev:bev_…   the smoke's telemetry, dev-marked
// NEVER: eligibility/* (the founder's attestation is his real consent record,
// written by the attest door on the preview and left alone), users/*, agents/*,
// agentBattles/*, tournamentRanks/*, anything the orchestrator reads.
//
// Needs the same creds as the serverless functions — FIREBASE_PROJECT_ID /
// FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY — from .env.local in the repo
// root (scripts/loadLocalEnv.js documents the format). From the repo root:
//   node scripts/backing-smoke.js seed
//   node scripts/backing-smoke.js advance [--winner=<odUserId>]
//   node scripts/backing-smoke.js refund
//   node scripts/backing-smoke.js status [--founder=<uid>]
//   node scripts/backing-smoke.js cleanup [--pod=<groupId>]
// Every command takes --pod=<groupId> (default: the latest run) and --dry-run.

// MUST be imported before firebaseAdmin.js — loads .env.local as a side effect.
import { requireFirebaseCreds, PROJECT_ROOT } from './loadLocalEnv.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getFirebaseAdmin } from '../api/_utils/firebaseAdmin.js';
import { fetchRankedUserPool } from '../api/_utils/tournamentGroupService.js';
import { poolEligible } from '../api/_utils/backingWeek.js';
import {
  BACKING_POOLS_COLLECTION,
  BACKING_STAKES_COLLECTION,
  POOL_STATUS,
  VOID_REASONS,
  closePool,
  materializePool,
  poolIdFor,
  poolRefFor,
  poolTotalsRefFor,
  readGroup,
} from '../api/_utils/backingPools.js';
import { BACKING_WALLETS_COLLECTION, BACKING_WALLET_ENTRIES_SUBCOLLECTION, walletIdFor } from '../api/_utils/backingWallet.js';
import { SETTLEMENT_SOURCE, refundPool, settlePool, winningSet } from '../api/_utils/backingSettlement.js';
import { STAKE_META_DOC, STAKE_PRIVATE_SUBCOLLECTION, placeStake } from '../api/_utils/backingStake.js';
import { hashFingerprint } from '../api/_utils/backingFingerprint.js';
import { BACKING_EVENTS_COLLECTION } from '../api/_utils/backingEvents.js';
import { TOURNAMENT_GROUPS_COLLECTION, GROUP_STATUS, isWeekBanked } from '../src/constants/leagueTournament.js';
import {
  MANIFEST_RELATIVE,
  SMOKE_STAKES,
  SMOKE_TOOL,
  addRun,
  buildSmokeGroup,
  buildSyntheticWeek,
  devTargetVerdict,
  emptyManifest,
  latestRun,
  ledgerInvariant,
  parseArgs,
  removeRun,
  runStamp,
  smokeEligibilityFor,
  smokeIds,
  syntheticToken,
  upcomingBattleWeek,
} from './backingSmokeLib.js';

const { command, flags, unknown } = parseArgs(process.argv.slice(2));

function usage(code = 2) {
  console.error('');
  console.error('Usage: node scripts/backing-smoke.js <seed|advance|refund|status|cleanup> [--pod=<groupId>] [--winner=<odUserId>] [--founder=<uid>] [--dry-run] [--json]');
  console.error('The runbook: docs/BACKING_SMOKE_RUNBOOK.md');
  console.error('');
  process.exit(code);
}
if (command === null) usage();
if (unknown.length > 0) { console.error(`Unknown argument(s): ${unknown.join(' ')}`); usage(); }

// Fail with a one-line instruction rather than firebase-admin's opaque stack.
requireFirebaseCreds();

// ==================== OUTPUT ====================

const say = (...lines) => { for (const l of lines) console.log(l); };
const rule = () => say('────────────────────────────────────────────────────────────');
function stop(code, ...lines) {
  say('');
  for (const l of lines) console.error(l);
  say('');
  process.exit(code);
}
const DRY = flags.dryRun ? '[DRY RUN — nothing written] ' : '';

// ==================== THE MANIFEST ====================

const MANIFEST_PATH = path.join(PROJECT_ROOT, MANIFEST_RELATIVE);
function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return emptyManifest();
  try {
    const parsed = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    return parsed && Array.isArray(parsed.runs) ? parsed : emptyManifest();
  } catch (err) {
    stop(4, `The manifest at ${MANIFEST_PATH} is unreadable (${err.message}). Move it aside and try again.`);
    return emptyManifest();
  }
}
function writeManifest(manifest) {
  mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}
/** The run this command works on: --pod, else the latest seeded. */
function pickRun(manifest) {
  const run = flags.pod ? manifest.runs.find((r) => r.groupId === flags.pod) ?? null : latestRun(manifest);
  if (!run) {
    stop(3,
      flags.pod ? `No run for pod ${flags.pod} in the manifest (${MANIFEST_PATH}).` : `No smoke pod in the manifest (${MANIFEST_PATH}).`,
      'Run `node scripts/backing-smoke.js seed` first.');
  }
  return run;
}

// ==================== THE DEV GUARD ====================

/** Every command refuses unless the target pod is isDev AND this script's. */
async function requireSmokePod(db, run) {
  const group = await readGroup(db, run.groupId);
  if (group == null) stop(3, `Pod ${run.groupId} no longer exists. If you already ran cleanup, seed again.`);
  if (group.isDev !== true) stop(3, `REFUSED: pod ${run.groupId} is not an isDev pod. This script never touches a production pod.`);
  if (group.smoke?.tool !== SMOKE_TOOL) stop(3, `REFUSED: pod ${run.groupId} was not made by this script (no smoke marker).`);
  if (poolIdFor(group) !== run.poolId) stop(3, `REFUSED: pod ${run.groupId} routes to pool ${poolIdFor(group)}, not the manifest's ${run.poolId}.`);
  return group;
}

const stakeFingerprint = () => ({
  ipHash: hashFingerprint('backing-smoke:seeder', { salted: false }),
  uaHash: hashFingerprint(SMOKE_TOOL, { salted: false }),
});

async function readStakes(db, groupId) {
  const snap = await db.collection(BACKING_STAKES_COLLECTION).where('groupId', '==', groupId).get();
  const out = [];
  snap.forEach((doc) => out.push({ id: doc.id, ...doc.data() }));
  return out.sort((a, b) => String(a.placedAt).localeCompare(String(b.placedAt)));
}

async function readWalletWithEntries(db, uid) {
  const ref = db.collection(BACKING_WALLETS_COLLECTION).doc(walletIdFor(uid, { dev: true }));
  const [snap, entriesSnap] = await Promise.all([ref.get(), ref.collection(BACKING_WALLET_ENTRIES_SUBCOLLECTION).get()]);
  const entries = [];
  entriesSnap.forEach((d) => entries.push({ id: d.id, ...d.data() }));
  return { id: ref.id, wallet: snap.exists ? snap.data() : null, entries: entries.sort((a, b) => String(a.at).localeCompare(String(b.at))) };
}

const bp = (n) => `${Number.isFinite(n) ? n : 0} BP`;
const nameOf = (group, id) => group?.seatNames?.[id] ?? (String(id).startsWith('cpu-') ? `CPU ${String(id).slice(4)}` : id);

// ==================== SEED ====================

async function seed(db) {
  const now = new Date();
  const nowIso = now.toISOString();
  const ids = smokeIds(runStamp(now));
  const { battleMondayEtDate, baseLayerWeek } = upcomingBattleWeek(nowIso);

  let userPool = [];
  try { userPool = await fetchRankedUserPool(db); } catch (err) { say(`(the ranked universe is unreadable — ${err.message}; using the fallback list)`); }
  const groupDoc = buildSmokeGroup({ ids, nowIso, userPool });
  const group = { id: ids.groupId, ...groupDoc };

  // THE WINDOW MUST BE OPEN AND LONG ENOUGH — the same rule the production
  // path applies, run BEFORE anything is written, so a Sunday seed refuses
  // instead of leaving a pod with no pool.
  const eligibility = poolEligible({ ...group, isDev: false }, now);
  if (!eligibility.eligible) {
    stop(3,
      `REFUSED (nothing written): a pod formed now would get no pool — ${eligibility.reason}.`,
      eligibility.reason === 'window_too_short'
        ? 'The backing window closes Sunday 11:59 PM ET and a pool needs at least 24 hours. Run this on a Monday (after 9:30 AM ET) through Saturday.'
        : 'See the reason above; the runbook (docs/BACKING_SMOKE_RUNBOOK.md) lists what each one means.');
  }
  if (new Date(eligibility.opensAt).getTime() > now.getTime()) {
    stop(3, `REFUSED (nothing written): the backing week for ${battleMondayEtDate} opens at ${eligibility.opensAt}; run this after that instant.`);
  }

  rule();
  say(`${DRY}SEED — a dev pod for the battle week of Monday ${battleMondayEtDate} (label ${baseLayerWeek})`);
  rule();
  say(`Pod:      tournamentGroups/${ids.groupId}   (isDev, forming, lobby)`);
  say(`Pool:     backingPools/${ids.poolId}   closes ${eligibility.closesAt} (${eligibility.closeReason})`);
  say(`Seats:    ${nameOf(group, ids.seatUids[0])} (${ids.seatUids[0]}), ${nameOf(group, ids.seatUids[1])} (${ids.seatUids[1]}), ${ids.cpuIds.join(', ')}`);
  say(`Backers:  ${ids.backerUids[0]} → ${bp(SMOKE_STAKES[0].amount)} on ${nameOf(group, ids.seatUids[SMOKE_STAKES[0].seat])}; ${ids.backerUids[1]} → ${bp(SMOKE_STAKES[1].amount)} on ${nameOf(group, ids.seatUids[SMOKE_STAKES[1].seat])}`);
  say(`Wallets:  backingWallets/dev-${ids.backerUids[0]}, backingWallets/dev-${ids.backerUids[1]}  (yours: backingWallets/dev-<your uid>, once you back a team)`);
  if (flags.dryRun) { say(''); say('Dry run: nothing was written. Run without --dry-run to seed.'); return; }

  // 1. The pod — recorded in the manifest FIRST, so a failure below still cleans up.
  await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(ids.groupId).set(groupDoc);
  const run = {
    groupId: ids.groupId, poolId: ids.poolId, stamp: ids.stamp, createdAt: nowIso,
    battleMondayEtDate, baseLayerWeek, seatUids: ids.seatUids, cpuIds: ids.cpuIds, backerUids: ids.backerUids,
    uids: [...ids.backerUids], stakes: [],
  };
  writeManifest(addRun(readManifest(), run));
  say(''); say(`✓ pod written and recorded in ${MANIFEST_PATH}`);

  // 2. The pool — the real lazy open, dev opt-in.
  const materialized = await materializePool(db, group, now, { allowDev: true });
  if (!materialized.pool) stop(5, `The pool could not be opened (${materialized.reason}). Run \`cleanup\` and seed again.`);
  say(`✓ pool ${materialized.created ? 'opened' : 'already open'} at backingPools/${ids.poolId}`);

  // 3. The synthetic backers — through the real stake primitive, never raw writes.
  const checkEligibility = smokeEligibilityFor(ids.backerUids);
  for (const plan of SMOKE_STAKES) {
    const uid = ids.backerUids[plan.backer];
    const teamOdUserId = ids.seatUids[plan.seat];
    const out = await placeStake(db, {
      uid, decodedToken: syntheticToken(uid), groupId: ids.groupId, teamOdUserId, amount: plan.amount,
      requestId: `smoke-${ids.stamp}-${plan.backer + 1}`, fingerprint: stakeFingerprint(), now,
      smoke: true, allowDev: true, checkEligibility,
    });
    if (out.refusal) stop(5, `The synthetic stake by ${uid} was refused: ${out.refusal.error}. Run \`cleanup\` and seed again.`);
    run.stakes.push({ stakeId: out.stakeId, uid, teamOdUserId, amount: plan.amount });
    say(`✓ ${uid} backed ${nameOf(group, teamOdUserId)} with ${bp(plan.amount)} (stake ${out.stakeId}, wallet backingWallets/dev-${uid})`);
  }
  writeManifest(addRun(readManifest(), run));

  rule();
  say('NEXT — on the preview, signed in as the allowlisted account:');
  say('  1. Open the League tab. The strip should read "Backing open · 1 pod".');
  say(`  2. Open it. The one pod listed is this one (${nameOf(group, ids.seatUids[0])}, ${nameOf(group, ids.seatUids[1])}, two CPUs).`);
  say('  3. Attest (18+ and the beta terms), back a team (any seat), then back the same team again to top up.');
  say('  4. The pod row should show the SEALED lockup and the three chairs with "Threshold met" once you are in.');
  say('  5. Then: node scripts/backing-smoke.js advance   (or: refund)');
  rule();
}

// ==================== ADVANCE ====================

async function advance(db) {
  const run = pickRun(readManifest());
  const group = await requireSmokePod(db, run);
  const now = new Date();
  const nowIso = now.toISOString();
  const poolSnap = await poolRefFor(db, group).get();
  if (!poolSnap.exists) stop(3, `Pod ${run.groupId} has no pool at backingPools/${run.poolId}. Seed again.`);
  const pool = poolSnap.data();
  const totalsSnap = await poolTotalsRefFor(db, group).get();
  const totals = totalsSnap.exists ? totalsSnap.data() : { uniqueBackers: 0, teamsBacked: 0, potTotal: 0 };
  const winner = flags.winner ?? run.seatUids[0];
  if (!group.groupMembers?.includes(winner)) stop(3, `--winner=${winner} is not a seat in this pod (${group.groupMembers?.join(', ')}).`);

  rule();
  say(`${DRY}ADVANCE — pod ${run.groupId}, pool backingPools/${run.poolId} (${pool.status})`);
  rule();
  say(`Book now: ${totals.uniqueBackers ?? 0} backers, ${totals.teamsBacked ?? 0} teams, pot ${bp(totals.potTotal)}`);
  if (pool.status === POOL_STATUS.OPEN && ((totals.uniqueBackers ?? 0) < 3 || (totals.teamsBacked ?? 0) < 2)) {
    stop(3,
      `The pool is not valid yet (${totals.uniqueBackers ?? 0} of 3 backers, ${totals.teamsBacked ?? 0} of 2 teams): your own stake is missing.`,
      'Back a team on the preview first, then run advance again. (Closing now would void every stake as insufficient.)');
  }
  const dailyScores = buildSyntheticWeek({ group, battleMondayEtDate: pool.battleMondayEtDate, winnerOdUserId: winner, recordedAtIso: nowIso });
  say(`Plan:     close the pool now; bank days 1–5 (${dailyScores.day1.recordedDate} → ${dailyScores.day5.recordedDate}); winner ${nameOf(group, winner)} (${winner}); complete; settle.`);
  if (flags.dryRun) { say(''); say('Dry run: nothing was written.'); return; }

  // 1. Close — the real close transaction, at a simulated instant.
  if (pool.status === POOL_STATUS.OPEN) {
    const closed = await closePool(db, group, now);
    if (!closed.closed) stop(5, `The pool did not close (${closed.reason}).`);
    say(`✓ pool closed: ${closed.status} (${closed.voided} voided)`);
    if (closed.status !== POOL_STATUS.CLOSED) stop(5, `The pool closed ${closed.status}, so there is nothing to settle. Run \`cleanup\`, seed again, and back a team before advancing.`);
  } else {
    say(`· pool already ${pool.status}`);
  }

  // 2. Bank the synthetic week and complete the pod — a direct write on the
  //    isDev group (the orchestrator ignores dev pods; nothing else reads it).
  await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(run.groupId).set({
    dailyScores,
    status: GROUP_STATUS.COMPLETE,
    completedAt: nowIso,
    updatedAt: nowIso,
    smoke: { ...group.smoke, advancedAt: nowIso, winner },
  }, { merge: true });
  const banked = await readGroup(db, run.groupId);
  if (!isWeekBanked(banked) || banked.status !== GROUP_STATUS.COMPLETE) stop(5, 'The synthetic week did not bank as expected.');
  const { winners } = winningSet(banked);
  say(`✓ week banked (day 5 of 5), pod complete — the composite names ${winners.map((w) => nameOf(group, w)).join(' + ')}`);

  // 3. Settle — the one primitive every host calls.
  const result = await settlePool(db, run.groupId, { now, source: SETTLEMENT_SOURCE.ADMIN_SIM, actor: SMOKE_TOOL });
  if (!result.settled) {
    stop(5, `Settlement did not pay: ${result.reason}${result.holdReason ? ` (${result.holdReason})` : ''}.`,
      result.holdReason ? 'The pool is HELD (resolving). Run `cleanup`, then seed again.' : '');
  }
  say(`✓ settled: winners ${result.winners.map((w) => nameOf(group, w)).join(' + ')}, pot ${bp(result.pool.potTotal)}, winning stakes ${bp(result.winningStakes)}, pays ${result.paysX}×, burned ${bp(result.burned)}`);

  rule();
  say('PAYOUTS (every stake):');
  const stakes = await readStakes(db, run.groupId);
  for (const s of stakes) {
    say(`  ${s.userId.padEnd(34)} ${nameOf(group, s.teamOdUserId).padEnd(16)} staked ${bp(s.amount).padEnd(8)} → ${s.status.toUpperCase()}${s.status === 'won' ? ` +${bp(s.payout)}` : ''}`);
  }
  say('');
  say('WALLETS (dev namespace):');
  for (const uid of [...new Set(stakes.map((s) => s.userId))]) {
    const { id, wallet, entries } = await readWalletWithEntries(db, uid);
    const inv = ledgerInvariant(wallet, entries);
    say(`  ${id}: careerNet ${bp(wallet?.careerNet)}, ${entries.length} entries — ledger ${inv.ok ? 'OK' : 'MISMATCH'}`);
  }
  rule();
  say('NEXT — on the preview: open Backing → the results (the strip reads "Last week\'s result"), and Your Backing; the Spectate final state of the pod carries the results card.');
  say('Then: node scripts/backing-smoke.js cleanup   (and seed again for the refund walk)');
  rule();
}

// ==================== REFUND ====================

async function refund(db) {
  const run = pickRun(readManifest());
  const group = await requireSmokePod(db, run);
  const now = new Date();
  const nowIso = now.toISOString();
  const poolSnap = await poolRefFor(db, group).get();
  if (!poolSnap.exists) stop(3, `Pod ${run.groupId} has no pool. Seed again.`);
  const pool = poolSnap.data();
  if (group.status === GROUP_STATUS.COMPLETE || pool.status === POOL_STATUS.RESOLVED) {
    stop(3, 'This pod already advanced and settled; a settled pool cannot be refunded. Run `cleanup`, `seed` again, back a team, then `refund`.');
  }
  rule();
  say(`${DRY}REFUND — pod ${run.groupId}, pool backingPools/${run.poolId} (${pool.status})`);
  rule();
  say('Plan:     close the pool now (if open); void the dev pod; refund every live stake through the real refund primitive.');
  if (flags.dryRun) { say(''); say('Dry run: nothing was written.'); return; }

  if (pool.status === POOL_STATUS.OPEN) {
    const closed = await closePool(db, group, now);
    if (!closed.closed) stop(5, `The pool did not close (${closed.reason}).`);
    say(`✓ pool closed: ${closed.status}`);
    if (closed.status !== POOL_STATUS.CLOSED) {
      say(`  (the close itself ${closed.status === POOL_STATUS.INSUFFICIENT ? 'voided every stake as insufficient — that is the below-floor refund path, already done' : 'refunded'}.)`);
      return;
    }
  }
  // An in-week cancellation: the pod goes VOIDED after its pool closed (§7).
  await db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(run.groupId).set({
    status: GROUP_STATUS.VOIDED,
    voidedAt: nowIso,
    voidedReason: 'backing_smoke_refund',
    voidedBy: SMOKE_TOOL,
    updatedAt: nowIso,
    smoke: { ...group.smoke, voidedAt: nowIso },
  }, { merge: true });
  say('✓ pod voided');
  const result = await refundPool(db, run.groupId, { now, source: SETTLEMENT_SOURCE.ADMIN_SIM, reason: VOID_REASONS.GROUP_VOIDED, actor: SMOKE_TOOL, note: 'founder smoke — refund walk' });
  if (!result.refunded) stop(5, `The refund did not run: ${result.reason}${result.holdReason ? ` (${result.holdReason})` : ''}.`);
  say(`✓ refunded: ${result.stakesVoided} stakes voided (${result.refundReason})`);
  rule();
  say('REFUNDS (every stake):');
  const stakes = await readStakes(db, run.groupId);
  for (const s of stakes) say(`  ${s.userId.padEnd(34)} ${nameOf(group, s.teamOdUserId).padEnd(16)} ${bp(s.amount).padEnd(8)} → ${s.status.toUpperCase()} (${s.voidReason})`);
  say('');
  say('WALLETS (dev namespace) — a refunded stake nets to zero:');
  for (const uid of [...new Set(stakes.map((s) => s.userId))]) {
    const { id, wallet, entries } = await readWalletWithEntries(db, uid);
    const inv = ledgerInvariant(wallet, entries);
    say(`  ${id}: careerNet ${bp(wallet?.careerNet)}, ${entries.length} entries — ledger ${inv.ok ? 'OK' : 'MISMATCH'}`);
  }
  rule();
  say('NEXT — on the preview: Your Backing shows the pod as cancelled with the refund. Then: node scripts/backing-smoke.js cleanup');
  rule();
}

// ==================== STATUS ====================

async function status(db) {
  const run = pickRun(readManifest());
  const group = await readGroup(db, run.groupId);
  rule();
  say(`STATUS — pod ${run.groupId} (seeded ${run.createdAt})`);
  rule();
  if (group == null) { say('The pod no longer exists (cleaned up?).'); return; }
  say(`Pod:      status ${group.status}, isDev ${group.isDev === true}, week ${group.baseLayerWeek}, banked days ${Object.keys(group.dailyScores ?? {}).filter((k) => /^day\d+$/.test(k)).length}`);
  const poolSnap = await poolRefFor(db, group).get();
  if (!poolSnap.exists) { say(`Pool:     none at backingPools/${run.poolId}`); return; }
  const pool = poolSnap.data();
  const totalsSnap = await poolTotalsRefFor(db, group).get();
  const totals = totalsSnap.exists ? totalsSnap.data() : {};
  say(`Pool:     backingPools/${run.poolId} — ${pool.status}; closes ${pool.closesAt}${pool.settledAt ? `; settled ${pool.settledAt} (pays ${pool.paysX}×)` : ''}${pool.refundedAt ? `; refunded ${pool.refundedAt} (${pool.refundReason})` : ''}${pool.holdReason ? `; HELD: ${pool.holdReason}` : ''}`);
  say(`Book:     ${totals.uniqueBackers ?? 0} backers, ${totals.teamsBacked ?? 0} teams, pot ${bp(totals.potTotal)} (sealed; public: backers ${pool.backerProgress?.count ?? '—'} of ${pool.backerProgress?.floor ?? 3}, spread ${pool.teamSpread?.met ? 'met' : 'not met'})`);
  say('');
  say('STAKES:');
  const stakes = await readStakes(db, run.groupId);
  if (stakes.length === 0) say('  none');
  for (const s of stakes) {
    const who = flags.founder && s.userId === flags.founder ? `${s.userId} (you)` : s.userId;
    say(`  ${who.padEnd(40)} ${nameOf(group, s.teamOdUserId).padEnd(16)} ${bp(s.amount).padEnd(8)} ${s.status}${s.payout != null ? ` payout ${bp(s.payout)}` : ''}${s.voidReason ? ` (${s.voidReason})` : ''}  pool ${s.poolId ?? '(none on doc)'}`);
  }
  if (flags.founder && !stakes.some((s) => s.userId === flags.founder)) say(`  (no stake from ${flags.founder} yet — back a team on the preview)`);
  say('');
  say('WALLETS (dev namespace) — Σ entries = the cached balances:');
  const uids = [...new Set([...stakes.map((s) => s.userId), ...run.backerUids, ...(flags.founder ? [flags.founder] : [])])];
  for (const uid of uids) {
    const { id, wallet, entries } = await readWalletWithEntries(db, uid);
    if (!wallet) { say(`  ${id}: no wallet yet`); continue; }
    const inv = ledgerInvariant(wallet, entries);
    say(`  ${id}: week ${wallet.lastAllowanceWeek}, allowance left ${bp(wallet.allowanceRemaining)} (Σ ${bp(inv.allowance.summed)} ${inv.allowance.ok ? '✓' : '✗'}), careerNet ${bp(wallet.careerNet)} (Σ ${bp(inv.career.summed)} ${inv.career.ok ? '✓' : '✗'}), ${entries.length} entries${inv.seasons.map((r) => `, ${r.monthKey} net ${bp(r.cached)} (Σ ${bp(r.summed)} ${r.ok ? '✓' : '✗'})`).join('')}`);
  }
  rule();
}

// ==================== CLEANUP ====================

async function cleanup(db) {
  const manifest = readManifest();
  const runs = flags.pod ? manifest.runs.filter((r) => r.groupId === flags.pod) : manifest.runs;
  if (runs.length === 0) stop(3, flags.pod ? `No run for pod ${flags.pod} in the manifest.` : 'Nothing to clean: the manifest lists no runs.');

  for (const run of runs) {
    rule();
    say(`${DRY}CLEANUP — pod ${run.groupId}`);
    rule();
    const group = await readGroup(db, run.groupId);
    // The targets, each judged by the one verdict BEFORE anything is deleted.
    const targets = []; // { path, ref, doc }
    const refusals = [];
    const consider = (ref, doc) => {
      const verdict = devTargetVerdict(ref.path, doc, run);
      if (!verdict.ok) refusals.push(verdict.reason);
      else targets.push({ path: ref.path, ref });
    };
    // The pod, then anything beneath it (nothing is expected).
    const groupRef = db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(run.groupId);
    if (group != null) {
      for (const sub of await groupRef.listCollections()) {
        const subSnap = await sub.get();
        subSnap.forEach((d) => consider(d.ref, group));
      }
      consider(groupRef, group);
    } else {
      say('· the pod is already gone; sweeping what its run left');
    }
    // The stakes and their sealed meta.
    const stakes = await readStakes(db, run.groupId);
    for (const s of stakes) {
      const ref = db.collection(BACKING_STAKES_COLLECTION).doc(s.id);
      const meta = await ref.collection(STAKE_PRIVATE_SUBCOLLECTION).doc(STAKE_META_DOC).get();
      if (meta.exists) consider(meta.ref, s);
      consider(ref, s);
    }
    // Every backer's DEV wallet and ledger — the founder's too, found by his stake.
    const uids = [...new Set([...run.backerUids, ...stakes.map((s) => s.userId)])];
    for (const uid of uids) {
      const wRef = db.collection(BACKING_WALLETS_COLLECTION).doc(walletIdFor(uid, { dev: true }));
      const wSnap = await wRef.get();
      const entries = await wRef.collection(BACKING_WALLET_ENTRIES_SUBCOLLECTION).get();
      entries.forEach((d) => consider(d.ref, d.data()));
      if (wSnap.exists) consider(wRef, wSnap.data());
    }
    // The pool and its sealed totals.
    const poolRef = db.collection(BACKING_POOLS_COLLECTION).doc(run.poolId);
    const totalsRef = poolRef.collection('private').doc('totals');
    const [poolSnap, totalsSnap] = await Promise.all([poolRef.get(), totalsRef.get()]);
    if (totalsSnap.exists) consider(totalsRef, totalsSnap.data());
    if (poolSnap.exists) consider(poolRef, poolSnap.data());
    // The dev-marked events of this run's users (the founder's clicks included).
    const runWithUids = { ...run, uids };
    for (const uid of uids) {
      const evSnap = await db.collection(BACKING_EVENTS_COLLECTION).where('userId', '==', uid).get();
      evSnap.forEach((d) => {
        const data = d.data();
        const marked = data?.isDev === true || data?.props?.isDev === true || d.id.startsWith('dev:') || d.id.startsWith('stake_confirmed:dev:');
        if (!marked) return; // an unmarked event is not the smoke's — left alone, not refused
        const verdict = devTargetVerdict(d.ref.path, data, runWithUids);
        if (!verdict.ok) refusals.push(verdict.reason); else targets.push({ path: d.ref.path, ref: d.ref });
      });
    }

    if (refusals.length > 0) {
      stop(6, 'REFUSED — nothing deleted. A target is outside the dev namespace or outside this run:', ...refusals.map((r) => `  · ${r}`));
    }
    say(`${targets.length} document(s) to delete:`);
    for (const t of targets) say(`  - ${t.path}`);
    say('  (never: eligibility/* — your attestation is your real consent record and stays)');
    if (flags.dryRun) { say(''); say('Dry run: nothing was deleted.'); continue; }

    for (let i = 0; i < targets.length; i += 400) {
      const batch = db.batch();
      for (const t of targets.slice(i, i + 400)) batch.delete(t.ref);
      await batch.commit();
    }
    writeManifest(removeRun(readManifest(), run.groupId));
    say(`✓ deleted ${targets.length} document(s); run ${run.groupId} removed from the manifest`);
  }
  rule();
}

// ==================== MAIN ====================

const db = getFirebaseAdmin();
const COMMANDS = { seed, advance, refund, status, cleanup };
COMMANDS[command](db).then(() => process.exit(0)).catch((err) => {
  console.error('');
  console.error(`backing-smoke ${command} failed: ${err?.message ?? err}`);
  if (err?.code) console.error(`  code: ${err.code}`);
  console.error('');
  process.exit(1);
});
