// scripts/mastery-backfill.js
//
// Archetype Mastery P4 — the §9 backfill (⚑D3, ratified at lock): PURE
// OFFLINE REPLAY of every pre-cutover completed battle through the SAME
// kernels the live writer runs (masterySlot / masterySettlement pure fns /
// masteryFormula), then guarded writes. Race-free cutover contract:
//   (1) the XP flip ceremony wrote masteryConfig/backfillPending, appended
//       epoch 1, and flipped MASTERY_XP_ENABLED — the live writer owns
//       completedAt > cutoverT from that moment;
//   (2) THIS script owns completedAt ≤ cutoverT only (cutoverT = the
//       registry's first 'enabled' entry);
//   (3) the repair sweep reconciles the seam; (4) surface stays dark.
//
// Execution (spec §9): reconstruct historical slots deterministically
// (identical to live derivation; an existing masterySlot stamp stays
// authoritative), compute awards + levelBefore/After INSIDE the isolated
// replay (completedAt-then-battleId accrual order), stamp per-battle
// receipts (create-only, `backfilled: true`), then ONE aggregate merge per
// user×archetype stream — transactional, guarded on its own
// backfillApplied[backfillId][archetypeId] marker: crash-retry inert,
// streams independent. Fail-closed validation lands zero receipts +
// quarantine-ledger entries (deterministic ids — create-only idempotent).
//
// DRY-RUN IS MANDATORY (default): full replay + report, ZERO writes. The
// founder reviews the award distribution AND quarantine counts, then runs
// --live. After --live + verification, DELETE masteryConfig/backfillPending
// manually (the §9 seam marker — live receipts stamp levelProvisional
// while it exists) — that deletion is the ceremony's closing step, never
// this script's.
//
// USAGE:
//   node scripts/mastery-backfill.js                    # DRY-RUN + report
//   node scripts/mastery-backfill.js --live             # guarded writes
//   node scripts/mastery-backfill.js --out <p> --backfill-id <id>
//
// The report (per-user award data) is .gitignore'd — never committed.

import process from 'node:process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import {
  deriveSlotDate, compareCreationKey, rateBandForRank, buildSlotStamp,
} from '../api/_utils/masterySlot.js';
import {
  isMasterySubject, classifyModeKind, sameDayCohort, computePlacementInputs,
} from '../api/_utils/masterySettlement.js';
import {
  validateFormulaInputs, computeXp, buildAwardDoc, buildZeroReceipt, REASON_CODES, levelForXp,
} from '../api/_utils/masteryFormula.js';
import {
  MASTERY_CONFIG_COLLECTION, MASTERY_EPOCH_REGISTRY_DOC,
  MASTERY_PROFILES_COLLECTION, MASTERY_QUARANTINE_COLLECTION, deriveFlagView,
} from '../api/_utils/masteryConfig.js';
import { TOURNAMENT_GAME_MODE } from '../src/constants/leagueTournament.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');

function die(msg) { console.error(`\nFATAL: ${msg}`); process.exit(1); }

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function initAdmin() {
  if (getApps().length) return getFirestore();
  const env = { ...parseEnvFile(path.join(PROJECT_ROOT, '.env.local')), ...process.env };
  const raw = env.FIREBASE_ADMIN_CREDENTIALS;
  if (!raw) die('FIREBASE_ADMIN_CREDENTIALS not found in .env.local or the environment');
  let serviceAccount;
  try { serviceAccount = JSON.parse(raw); } catch (err) { die(`FIREBASE_ADMIN_CREDENTIALS is not valid JSON: ${err.message}`); }
  initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
}

async function main() {
  const live = process.argv.includes('--live');
  const backfillId = argValue('--backfill-id') || 'backfill_epoch1';
  const outPath = argValue('--out') || path.join(PROJECT_ROOT, 'mastery-backfill-report.json');
  const db = initAdmin();
  const nowIso = new Date().toISOString();

  // ── cutoverT from the epoch registry (the ceremony must have run) ──
  const regSnap = await db.collection(MASTERY_CONFIG_COLLECTION).doc(MASTERY_EPOCH_REGISTRY_DOC).get();
  const flagView = deriveFlagView(regSnap.exists ? regSnap.data() : null, true);
  if (!flagView.registryWellFormed || !flagView.everEnabled) {
    die('epoch registry absent/malformed or epoch 1 never began — run the XP flip ceremony first (§9 order: flip → backfill).');
  }
  const entries = regSnap.data().entries;
  const cutoverT = entries.find((e) => e.state === 'enabled')?.at;
  if (typeof cutoverT !== 'string' || !cutoverT) die('epoch 1 entry carries no timestamp');
  const epochId = flagView.epochId;

  // ── Full reads: battles + groups (offline replay inputs) ──
  const [battlesSnap, groupsSnap] = await Promise.all([
    db.collection('agentBattles').where('status', '==', 'completed').get(),
    db.collection('tournamentGroups').get(),
  ]);
  const groupById = new Map(groupsSnap.docs.map((d) => [d.id, d.data()]));
  const all = battlesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Scope: completed subjects at/before cutoverT. Already-receipted battles
  // (live writer or a prior backfill run) are skipped — receipts are
  // create-only. Everything else in the historical set still participates
  // in slot/cohort derivation (the universe is creation data, not receipts).
  const scope = all.filter((b) =>
    typeof b.completedAt === 'string' && b.completedAt <= cutoverT
    && isMasterySubject(b) && b.masteryAward === undefined);

  // ── Slot reconstruction: rank within (owner, archetype, NY slotDate) by
  // creation key across ALL battles (identical to live derivation); an
  // existing masterySlot stamp is authoritative for its battle. ──
  const slotKey = (b) => `${b.ownerId}|${b.agentContext?.archetype}|${deriveSlotDate(b.createdAt)}`;
  const byDay = new Map();
  for (const b of all) {
    if (b.isCpu === true || typeof b.ownerId !== 'string') continue;
    const date = deriveSlotDate(b.createdAt);
    if (!date) continue; // unusable creation data — validation quarantines below
    const k = slotKey(b);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(b);
  }
  for (const arr of byDay.values()) arr.sort(compareCreationKey);
  const slotFor = (b) => {
    if (b.masterySlot && typeof b.masterySlot.rank === 'number') return b.masterySlot; // stamp authority
    const date = deriveSlotDate(b.createdAt);
    if (!date) return { date: null, rank: null, rateBand: null }; // sentinel → quarantine
    const rank = byDay.get(slotKey(b)).findIndex((x) => x.id === b.id) + 1;
    return { ...buildSlotStamp({ slotDate: date, rank, assignedAt: nowIso }), rateBand: rateBandForRank(rank) };
  };

  // ── Replay: accrual order completedAt→battleId; awards per stream ──
  scope.sort((a, b2) => (a.completedAt < b2.completedAt ? -1 : a.completedAt > b2.completedAt ? 1 : a.id < b2.id ? -1 : 1));
  const streams = new Map(); // ownerId|archetype → {xp, count, receipts:[], lastAwardAt}
  const quarantine = [];
  const dist = { awarded: 0, zeroReceipts: 0, quarantined: 0, byMode: {}, byArchetype: {}, xpTotal: 0, levelUps: 0 };

  for (const b of scope) {
    const archetype = b.agentContext?.archetype ?? 'unknown';
    const group = b.gameMode === TOURNAMENT_GAME_MODE ? (groupById.get(b.groupId) || null) : null;
    const modeKind = classifyModeKind({ gameMode: b.gameMode, group });
    const slot = slotFor(b);
    const siblings = b.gameMode === TOURNAMENT_GAME_MODE
      ? sameDayCohort(b, all.filter((s) => s.groupId === b.groupId && s.id !== b.id))
      : [];
    // §9: placement only from terminal immutable scores — pre-cutover
    // cohorts are all-terminal by construction (everything ≤ cutoverT is
    // history), so non-terminal siblings cannot occur here.
    const placement = computePlacementInputs({ battle: b, siblings });
    const currentScore = b.scoreState?.currentScore;
    const streamK = `${b.ownerId}|${archetype}`;
    if (!streams.has(streamK)) streams.set(streamK, { xp: 0, count: 0, receipts: [], lastAwardAt: null });
    const stream = streams.get(streamK);
    const levelBefore = levelForXp(stream.xp);

    const invalid = validateFormulaInputs({ modeKind, archetype, currentScore, rateBand: slot.rateBand });
    if (invalid) {
      dist.quarantined += 1;
      quarantine.push({ id: `${backfillId}_${b.id}`, battleId: b.id, diagnostic: invalid });
      stream.receipts.push({
        battleId: b.id,
        receipt: { ...buildZeroReceipt({ archetype, reasonCode: REASON_CODES.QUARANTINED, epochId, settledAt: nowIso, level: levelBefore }), backfilled: true },
        slot,
      });
      continue;
    }
    const xp = computeXp({
      modeKind, currentScore,
      humansOutplaced: placement.humansOutplaced,
      wonAgainstField: placement.wonAgainstField,
      isMultiDay: Array.isArray(b.timing?.tradingDays) && b.timing.tradingDays.length > 1,
      rateBand: slot.rateBand,
    });
    stream.xp += xp.xpFinal;
    stream.count += 1;
    stream.lastAwardAt = b.completedAt;
    const levelAfter = levelForXp(stream.xp);
    if (levelAfter > levelBefore) dist.levelUps += 1;
    const award = buildAwardDoc({
      archetype, components: xp.components, modeMult: xp.modeMult, rateBand: slot.rateBand,
      xpFinal: xp.xpFinal, levelBefore, levelAfter, epochId, settledAt: nowIso,
      ...(slot.rateBand === 0 ? { reasonCode: REASON_CODES.DAILY_CEILING } : { placementInputs: placement.snapshot }),
    });
    stream.receipts.push({ battleId: b.id, receipt: { ...award, backfilled: true }, slot });
    dist.awarded += 1;
    if (xp.xpFinal === 0) dist.zeroReceipts += 1;
    dist.xpTotal += xp.xpFinal;
    dist.byMode[modeKind] = (dist.byMode[modeKind] || 0) + 1;
    dist.byArchetype[archetype] = (dist.byArchetype[archetype] || 0) + 1;
  }

  const report = {
    generatedAt: nowIso, backfillId, cutoverT, epochId, mode: live ? 'LIVE' : 'DRY-RUN',
    scopeSize: scope.length, streams: streams.size, distribution: dist,
    quarantineCount: quarantine.length, quarantine,
    streamSummaries: [...streams.entries()].map(([k, s]) => ({
      stream: k, xp: s.xp, battles: s.count, levelAfter: levelForXp(s.xp),
    })),
  };
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n=== Mastery backfill (${report.mode}) — cutoverT ${cutoverT}, scope ${scope.length}, streams ${streams.size} ===`);
  console.log(`awarded=${dist.awarded} (zero ${dist.zeroReceipts}) quarantined=${dist.quarantined} xpTotal=${dist.xpTotal} levelUps=${dist.levelUps}`);
  console.log(`report → ${outPath}`);
  if (!live) {
    console.log('\nDRY-RUN complete (zero writes). Founder reviews the distribution AND');
    console.log('quarantine counts, then re-runs with --live.\n');
    return;
  }

  // ── LIVE: receipts (create-only per battle), quarantine (create-only,
  // deterministic ids), then ONE guarded aggregate merge per stream. ──
  const results = { receiptsStamped: 0, receiptsSkipped: 0, quarantineWritten: 0, streamsMerged: 0, streamsSkipped: 0, errors: 0 };
  for (const [streamK, stream] of streams) {
    const [ownerId, archetype] = streamK.split('|');
    try {
      for (const r of stream.receipts) {
        await db.runTransaction(async (t) => {
          const ref = db.collection('agentBattles').doc(r.battleId);
          const snap = await t.get(ref);
          if (!snap.exists || snap.data().masteryAward !== undefined) { results.receiptsSkipped += 1; return; }
          t.update(ref, {
            masteryAward: r.receipt,
            ...(snap.data().masterySlot === undefined && r.slot?.rank != null
              ? { masterySlot: { date: r.slot.date, rank: r.slot.rank, rateBand: r.slot.rateBand, assignedAt: nowIso } }
              : {}),
          });
          results.receiptsStamped += 1;
        });
      }
      await db.runTransaction(async (t) => {
        const pRef = db.collection(MASTERY_PROFILES_COLLECTION).doc(ownerId);
        const pSnap = await t.get(pRef);
        const p = pSnap.exists ? pSnap.data() : {};
        if (p.backfillApplied?.[backfillId]?.[archetype]) { results.streamsSkipped += 1; return; }
        const existing = p.archetypes?.[archetype] ?? {};
        const xpAfter = (Number.isFinite(existing.xp) ? existing.xp : 0) + stream.xp;
        t.set(pRef, {
          archetypes: { [archetype]: {
            xp: xpAfter,
            level: levelForXp(xpAfter),
            battlesCounted: (Number.isFinite(existing.battlesCounted) ? existing.battlesCounted : 0) + stream.count,
            lastAwardAt: existing.lastAwardAt && existing.lastAwardAt > stream.lastAwardAt ? existing.lastAwardAt : stream.lastAwardAt,
          } },
          backfillApplied: { [backfillId]: { [archetype]: nowIso } },
          updatedAt: nowIso,
        }, { merge: true });
        results.streamsMerged += 1;
      });
    } catch (err) {
      results.errors += 1;
      console.error(`[backfill] stream ${streamK} failed (retry-safe — markers guard): ${err?.message || err}`);
    }
  }
  for (const q of quarantine) {
    try {
      const qRef = db.collection(MASTERY_QUARANTINE_COLLECTION).doc(q.id);
      await db.runTransaction(async (t) => {
        const snap = await t.get(qRef);
        if (snap.exists) return;
        t.set(qRef, { kind: 'backfill_quarantined', battleId: q.battleId, diagnostic: q.diagnostic, backfillId, at: nowIso });
        results.quarantineWritten += 1;
      });
    } catch (err) { results.errors += 1; console.error(`[backfill] quarantine ${q.id}: ${err?.message || err}`); }
  }
  console.log(`\nLIVE: receipts ${results.receiptsStamped} stamped / ${results.receiptsSkipped} skipped; streams ${results.streamsMerged} merged / ${results.streamsSkipped} already-applied; quarantine ${results.quarantineWritten}; errors ${results.errors}`);
  if (results.errors > 0) { console.log('Errors occurred — re-run --live (guards make retries inert), then verify.'); process.exitCode = 1; }
  else console.log('Done. Verify, then DELETE masteryConfig/backfillPending to close the §9 seam (ceremony closing step).');
}

main().catch((err) => die(err && err.stack ? err.stack : String(err)));
