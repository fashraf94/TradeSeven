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
// stats cross-check: stats.gamesPlayed is compared against the agent's
// actual completed agentBattles count (the server-side writer's ground
// truth) — a claimed count ABOVE the verified count never passed a gate
// (the pre-hardening client write hole; closed by the agents allowlist).
//
// USAGE (from project root):
//   node scripts/mastery-preflip-census.js            # census + JSON report
//   node scripts/mastery-preflip-census.js --out <p>  # report path
//
// ENV: FIREBASE_ADMIN_CREDENTIALS in .env.local (a JSON service account) —
// the archetype-bornwith-census.js / rule-compat-cleanup.js convention.

import process from 'node:process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { revalidateStandingLeans, STANDING_LEANS_CAP, MASTERY_LEAN_CAP_MAX } from '../api/_utils/leanRevalidation.js';
import {
  archetypeLevelFromProfile,
  leanCapForLevel,
  dialAggressiveAllowed,
  effectiveForgeLimits,
} from '../api/_utils/masteryEnforcement.js';
import { MASTERY_PROFILES_COLLECTION } from '../api/_utils/masteryConfig.js';
import { ARCHETYPE_KEYS } from '../src/data/archetypeAdjustments.js';
import { getAgentLevel, FORGE_LIMITS } from '../src/constants/agentProgression.js';

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

async function main() {
  const outArgIdx = process.argv.indexOf('--out');
  const outPath = outArgIdx > -1 ? process.argv[outArgIdx + 1]
    : path.join(PROJECT_ROOT, 'mastery-preflip-census-report.json');

  const db = initAdmin();

  // ── One read per collection (READ-ONLY throughout) ──
  const [agentsSnap, profilesSnap, battlesSnap] = await Promise.all([
    db.collection('agents').get(),
    db.collection(MASTERY_PROFILES_COLLECTION).get(),
    db.collection('agentBattles').select('agentId', 'status').get(),
  ]);

  const profileByUser = new Map();
  for (const doc of profilesSnap.docs) profileByUser.set(doc.id, doc.data());

  // Verified games: completed agentBattles per agentId (the server writer's
  // ground truth for stats.gamesPlayed).
  const completedByAgent = new Map();
  for (const doc of battlesSnap.docs) {
    const b = doc.data();
    if (b.status === 'completed' && typeof b.agentId === 'string') {
      completedByAgent.set(b.agentId, (completedByAgent.get(b.agentId) || 0) + 1);
    }
  }

  const entries = [];
  const stats = {
    agentsScanned: 0,
    bundlesScanned: 0,
    leanOverage: 0,
    dialAggressiveTotal: 0,
    dialAggressiveUngated: 0,
    statsOverage: 0,
    forgeBundleOverage: 0,
  };

  for (const doc of agentsSnap.docs) {
    const a = doc.data();
    stats.agentsScanned++;
    const agentPath = doc.ref.path;
    const profile = profileByUser.get(a.ownerId) || null;
    const pins = Array.isArray(a.standingLeans) ? a.standingLeans : [];

    // ── Leans: per-archetype kernel-accepted count vs the profile-derived
    // cap (missing profile ⇒ level 1 ⇒ baseline 2). Counting runs at the
    // structural max so entitlement is compared, not pre-clamped away. ──
    if (pins.length > 0) {
      for (const archetype of ARCHETYPE_KEYS) {
        const { valid } = revalidateStandingLeans({
          standingLeans: pins,
          archetypeCodeId: archetype,
          leanCap: MASTERY_LEAN_CAP_MAX,
        });
        const level = archetypeLevelFromProfile(profile, archetype);
        const cap = leanCapForLevel(level);
        if (valid.length > cap) {
          stats.leanOverage++;
          const acceptedIds = valid.map((l) => l.adjustmentId);
          entries.push({
            key: `lean_overage:${agentPath}:${archetype}`,
            kind: 'lean_overage',
            docPath: agentPath,
            ownerId: a.ownerId ?? null,
            archetype,
            level,
            cap,
            acceptedCount: valid.length,
            acceptedIds,
            totalPins: pins.length,
            // The trim plan the normalizer applies if approved: drop the
            // accepted overage BEYOND the cap (kernel order — earlier
            // equippedAt wins), keep every other pin (other-archetype
            // desired state is preserved per ruling M5).
            trimIds: acceptedIds.slice(cap),
            proposedAction: 'lean_trim',
          });
        }
      }
    }

    // ── Dial: every stored 'aggressive' is enumerated (the would-be
    // grandfather population); below L2 for the CURRENT archetype it never
    // passed the §6 gate. ──
    if (a.dials?.tempo === 'aggressive') {
      stats.dialAggressiveTotal++;
      const level = archetypeLevelFromProfile(profile, a.archetype);
      const gated = dialAggressiveAllowed(level);
      if (!gated) stats.dialAggressiveUngated++;
      entries.push({
        key: `dial_aggressive:${agentPath}`,
        kind: 'dial_aggressive',
        docPath: agentPath,
        ownerId: a.ownerId ?? null,
        archetype: a.archetype ?? null,
        level,
        passesGate: gated,
        proposedAction: gated ? 'review' : 'dial_reset',
      });
    }

    // ── Stats: claimed gamesPlayed vs verified completed-battle count.
    // Claimed above verified never passed a gate (the server writer only
    // increments on real completions). ──
    const claimed = a.stats?.gamesPlayed;
    const verified = completedByAgent.get(doc.id) || 0;
    const claimedNum = Number.isFinite(claimed) ? claimed : 0;
    if (claimedNum > verified || claimedNum < 0 || !Number.isInteger(claimedNum)) {
      stats.statsOverage++;
      entries.push({
        key: `stats_games:${agentPath}`,
        kind: 'stats_games',
        docPath: agentPath,
        ownerId: a.ownerId ?? null,
        claimedGamesPlayed: claimed ?? null,
        verifiedCompletedBattles: verified,
        claimedTier: getAgentLevel(claimedNum),
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
    const agentRef = doc.ref.parent.parent;
    if (!agentRef) continue; // not an agents/{id}/bundles doc
    const agentDoc = agentsSnap.docs.find((d) => d.id === agentRef.id);
    if (!agentDoc) continue; // orphaned subtree — report separately if seen
    stats.bundlesScanned++;
    const b = doc.data();
    if (b.status === 'archived') continue;
    const a = agentDoc.data();
    const profile = profileByUser.get(a.ownerId) || null;
    const legacyLimits = FORGE_LIMITS[getAgentLevel(a.stats?.gamesPlayed || 0)];
    const limits = effectiveForgeLimits({ legacyLimits, profileData: profile });
    const ruleCount = Array.isArray(b.ruleSnapshots) ? b.ruleSnapshots.length : 0;
    if (ruleCount > limits.maxRulesPerBundle) {
      stats.forgeBundleOverage++;
      entries.push({
        key: `forge_overage:${doc.ref.path}`,
        kind: 'forge_overage',
        docPath: doc.ref.path,
        ownerId: a.ownerId ?? null,
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
  console.log(`bundles scanned           : ${stats.bundlesScanned}`);
  console.log(`lean overage entries      : ${stats.leanOverage}`);
  console.log(`aggressive dials (total)  : ${stats.dialAggressiveTotal}`);
  console.log(`  of which below the gate : ${stats.dialAggressiveUngated}`);
  console.log(`stats mismatches          : ${stats.statsOverage}`);
  console.log(`forge bundle overages     : ${stats.forgeBundleOverage}`);
  console.log(`report written to         : ${outPath}`);
  console.log('\nNext (flip ceremony, B4): founder reviews the report, writes the');
  console.log('approved-keys file, runs mastery-preflip-normalize.js. The');
  console.log('ENFORCEMENT flip is BLOCKED until this census passes review.\n');
}

main().catch((err) => die(err && err.stack ? err.stack : String(err)));
