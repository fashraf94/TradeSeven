// scripts/mastery-preflip-census.js
//
// Archetype Mastery — the ENFORCEMENT-flip pre-flight census (end-of-branch
// ruling B4: the C6 Forge "floor audit" of the §7 flip order, EXTENDED to
// leans/dials/stats). READ-ONLY: .get() + report only, zero writes. The
// MASTERY_ENFORCEMENT_ENABLED flip ceremony (api/_utils/masteryConfig.js —
// FLIP PROTOCOL) is BLOCKED on this census passing founder review:
//
//   1. run this census → JSON report enumerating every stored pin/dial/stat
//      exceeding the owner's CURRENT profile-derived baseline entitlement,
//      plus every Forge bundle above the effective (lazy-legacy-floor) band;
//   2. the founder reviews the report and writes the approved-decisions file
//      (the entry keys to normalize — see mastery-preflip-normalize.js);
//   3. mastery-preflip-normalize.js zeroes what never passed a gate;
//   4. only then may the ENFORCEMENT constant flip.
//
// Entitlement source: the SAME kernels the live gates use (leanRevalidation,
// masteryEnforcement, agentProgression) — the census and the enforcement
// surfaces cannot disagree. Entry keys are deterministic
// (`${kind}:${docPath}[:${qualifier}]`) so re-runs converge and the approved
// file survives a re-census.
//
// stats cross-check ground truth: stats.gamesPlayed is compared against the
// agent's completed NON-TOURNAMENT agentBattles count — the exact
// resolveCompletionDisposition predicate (tournament completions never
// increment career stats), so tournament battles can neither mask a forged
// claim nor be minted into a correction. Known slack, documented: the two
// fenced decide.js expiry-completions historically completed battles
// WITHOUT incrementing stats, so verified may exceed the honest claim —
// only claimed > verified is flagged (never the reverse), and the
// normalized value is an upper bound of server-written games.
//
// USAGE (from project root):
//   node scripts/mastery-preflip-census.js            # census + JSON report
//   node scripts/mastery-preflip-census.js --out <p>  # report path
//
// The report lands OUTSIDE version control (.gitignore'd default name) —
// it carries per-user entitlement data and must never be committed.
//
// ENV: FIREBASE_ADMIN_CREDENTIALS in .env.local (a JSON service account) —
// the archetype-bornwith-census.js / rule-compat-cleanup.js convention.

import process from 'node:process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { revalidateStandingLeans, STANDING_LEANS_CAP, LEAN_INVALIDATION_REASONS } from '../api/_utils/leanRevalidation.js';
import {
  archetypeLevelFromProfile,
  leanCapForLevel,
  revalidateTempoDial,
  effectiveForgeLimits,
} from '../api/_utils/masteryEnforcement.js';
import { MASTERY_PROFILES_COLLECTION } from '../api/_utils/masteryConfig.js';
import { ARCHETYPE_KEYS } from '../src/data/archetypeAdjustments.js';
import { getAgentLevel, FORGE_LIMITS } from '../src/constants/agentProgression.js';
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

/**
 * The per-archetype lean overage plan, straight from the kernel run at the
 * ENTITLEMENT cap: `valid` is the kept set, and the OVER_CAP-invalidated
 * ids are the trim plan — in the kernel's own deterministic loser order
 * (later equippedAt loses), never an array-order slice, and complete even
 * past the structural max. Conflict/menu/version omissions are
 * adjudication, not entitlement — they are never trimmed.
 */
function leanOveragePlan(pins, archetype, cap) {
  const { valid, invalidated } = revalidateStandingLeans({
    standingLeans: pins,
    archetypeCodeId: archetype,
    leanCap: cap,
  });
  const truncated = invalidated.some((r) => typeof r.truncatedCount === 'number');
  const trimIds = invalidated
    .filter((r) => r.reason === LEAN_INVALIDATION_REASONS.OVER_CAP)
    .map((r) => r.adjustmentId);
  return { keptIds: valid.map((l) => l.adjustmentId), trimIds, truncated };
}

async function main() {
  const outArgIdx = process.argv.indexOf('--out');
  const outPath = outArgIdx > -1 ? process.argv[outArgIdx + 1]
    : path.join(PROJECT_ROOT, 'mastery-preflip-census-report.json');

  const db = initAdmin();

  // ── One read per collection (READ-ONLY throughout). Battles are
  // pre-filtered server-side to completed docs; the tournament exclusion
  // (the resolveCompletionDisposition stats predicate) runs in memory. ──
  const [agentsSnap, profilesSnap, battlesSnap] = await Promise.all([
    db.collection('agents').get(),
    db.collection(MASTERY_PROFILES_COLLECTION).get(),
    db.collection('agentBattles').where('status', '==', 'completed').select('agentId', 'gameMode').get(),
  ]);

  const profileByUser = new Map();
  for (const doc of profilesSnap.docs) profileByUser.set(doc.id, doc.data());

  // Verified games: completed, stats-counted (non-tournament) battles per
  // agentId — the server stats writer's exact increment predicate.
  const completedByAgent = new Map();
  for (const doc of battlesSnap.docs) {
    const b = doc.data();
    if (b.gameMode === TOURNAMENT_GAME_MODE) continue; // never increments stats
    if (typeof b.agentId === 'string') {
      completedByAgent.set(b.agentId, (completedByAgent.get(b.agentId) || 0) + 1);
    }
  }

  const entries = [];
  const stats = {
    agentsScanned: 0,
    bundlesSeen: 0,
    bundlesEvaluated: 0,
    bundlesArchivedSkipped: 0,
    bundlesOrphaned: 0,
    leanOverage: 0,
    dialAggressiveTotal: 0,
    dialAggressiveUngated: 0,
    statsFindings: 0,
    forgeBundleOverage: 0,
  };

  // Per-agent meta for the bundle loop: O(1) lookup + a tier derived from
  // TRUSTWORTHY games (a malformed claimed value falls back to the verified
  // count, so a forged string can't mint a legacy band that hides overage).
  const agentMeta = new Map();

  for (const doc of agentsSnap.docs) {
    const a = doc.data();
    stats.agentsScanned++;
    const agentPath = doc.ref.path;
    const profile = profileByUser.get(a.ownerId) || null;
    const pins = Array.isArray(a.standingLeans) ? a.standingLeans : [];

    const claimed = a.stats?.gamesPlayed;
    const claimedDefined = claimed !== undefined && claimed !== null;
    const claimedClean = Number.isInteger(claimed) && claimed >= 0;
    const verified = completedByAgent.get(doc.id) || 0;
    const gamesForTier = claimedClean ? claimed : verified;
    agentMeta.set(doc.id, {
      ownerId: a.ownerId ?? null,
      profile,
      legacyLimits: FORGE_LIMITS[getAgentLevel(gamesForTier)],
    });

    // ── Leans: per-archetype kernel plan at the profile-derived cap
    // (missing profile ⇒ level 1 ⇒ baseline 2). Every possible cap is ≥
    // baseline, and overage requires more pins than the cap, so sets at or
    // under the baseline can never produce a finding — skip them. ──
    if (pins.length > STANDING_LEANS_CAP) {
      for (const archetype of ARCHETYPE_KEYS) {
        const level = archetypeLevelFromProfile(profile, archetype);
        const cap = leanCapForLevel(level);
        const { keptIds, trimIds, truncated } = leanOveragePlan(pins, archetype, cap);
        if (trimIds.length > 0 || truncated) {
          stats.leanOverage++;
          entries.push({
            key: `lean_overage:${agentPath}:${archetype}`,
            kind: 'lean_overage',
            docPath: agentPath,
            ownerId: a.ownerId ?? null,
            archetype,
            level,
            cap,
            keptIds,
            trimIds,
            totalPins: pins.length,
            truncated,
            // A truncated invalidation record means the trim plan may be
            // incomplete (garbage-flooded set) — founder review + manual
            // remediation, never a blind script trim.
            proposedAction: truncated ? 'review' : 'lean_trim',
          });
        }
      }
    }

    // ── Dial: every stored 'aggressive' is enumerated (the would-be
    // grandfather population), judged through the SAME shared rule the
    // switch rider and the §8 clamp pass use (ruling Q7). ──
    if (a.dials?.tempo === 'aggressive') {
      stats.dialAggressiveTotal++;
      const level = archetypeLevelFromProfile(profile, a.archetype);
      const { invalidated } = revalidateTempoDial({ tempo: 'aggressive', level });
      if (invalidated) stats.dialAggressiveUngated++;
      entries.push({
        key: `dial_aggressive:${agentPath}`,
        kind: 'dial_aggressive',
        docPath: agentPath,
        ownerId: a.ownerId ?? null,
        archetype: a.archetype ?? null,
        level,
        passesGate: !invalidated,
        proposedAction: invalidated ? 'dial_reset' : 'review',
      });
    }

    // ── Stats: claimed gamesPlayed vs the verified stats-counted battle
    // count. Flagged when the claim exceeds the verified upper bound OR is
    // malformed (non-integer / negative / non-number — the pre-hardening
    // client hole; a malformed value ALSO coerces inside getAgentLevel at
    // the live Forge gate, so it must never be laundered to 0 here). ──
    if ((claimedDefined && !claimedClean) || (claimedClean && claimed > verified)) {
      stats.statsFindings++;
      entries.push({
        key: `stats_games:${agentPath}`,
        kind: 'stats_games',
        docPath: agentPath,
        ownerId: a.ownerId ?? null,
        claimedGamesPlayed: claimed ?? null,
        claimedMalformed: claimedDefined && !claimedClean,
        verifiedCompletedBattles: verified,
        claimedTier: getAgentLevel(claimedClean ? claimed : 0),
        verifiedTier: getAgentLevel(verified),
        normalizedValue: verified,
        proposedAction: 'stats_set_games',
      });
    }
  }

  // ── Forge: every non-archived bundle above the owner's EFFECTIVE band
  // (lazy legacy floor: max(mastery band, legacy tier band)) — the original
  // C6 scope. Report-only: remediation is the reforge trim path + the
  // equip-time gate, never a script mutation of rule content. ──
  const bundlesSnap = await db.collectionGroup('bundles').get();
  for (const doc of bundlesSnap.docs) {
    stats.bundlesSeen++;
    const agentRef = doc.ref.parent.parent;
    const underAgents = agentRef && agentRef.parent && agentRef.parent.id === 'agents';
    const meta = underAgents ? agentMeta.get(agentRef.id) : undefined;
    if (!meta) {
      // A bundles doc outside agents/, or under an agent doc that no longer
      // exists (or was created after the agents read): the census cannot
      // attribute it — surface it loudly, never a silent gap.
      stats.bundlesOrphaned++;
      console.error(`[census] ORPHANED bundle (no owning agent doc): ${doc.ref.path}`);
      continue;
    }
    const b = doc.data();
    if (b.status === 'archived') {
      stats.bundlesArchivedSkipped++;
      continue;
    }
    stats.bundlesEvaluated++;
    const limits = effectiveForgeLimits({ legacyLimits: meta.legacyLimits, profileData: meta.profile });
    const ruleCount = Array.isArray(b.ruleSnapshots) ? b.ruleSnapshots.length : 0;
    if (ruleCount > limits.maxRulesPerBundle) {
      stats.forgeBundleOverage++;
      entries.push({
        key: `forge_overage:${doc.ref.path}`,
        kind: 'forge_overage',
        docPath: doc.ref.path,
        ownerId: meta.ownerId,
        status: b.status ?? null,
        ruleCount,
        effectiveMaxRulesPerBundle: limits.maxRulesPerBundle,
        proposedAction: 'review', // trim via reforge; the equip gate holds
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseline: { STANDING_LEANS_CAP, dialGateLevel: 2 },
    stats,
    entries,
  };
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('\n=== Mastery ENFORCEMENT pre-flip census (READ-ONLY) ===');
  console.log(`agents scanned            : ${stats.agentsScanned}`);
  console.log(`bundles seen/evaluated    : ${stats.bundlesSeen}/${stats.bundlesEvaluated} (archived ${stats.bundlesArchivedSkipped}, ORPHANED ${stats.bundlesOrphaned})`);
  console.log(`lean overage entries      : ${stats.leanOverage}`);
  console.log(`aggressive dials (total)  : ${stats.dialAggressiveTotal}`);
  console.log(`  of which below the gate : ${stats.dialAggressiveUngated}`);
  console.log(`stats findings            : ${stats.statsFindings}`);
  console.log(`forge bundle overages     : ${stats.forgeBundleOverage}`);
  console.log(`report written to         : ${outPath}`);
  console.log('\nNext (flip ceremony, B4): founder reviews the report, writes the');
  console.log('approved-keys file, runs mastery-preflip-normalize.js. The');
  console.log('ENFORCEMENT flip is BLOCKED until this census passes review.\n');
}

main().catch((err) => die(err && err.stack ? err.stack : String(err)));
