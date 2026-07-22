// scripts/mastery-preflip-normalize.js
//
// Archetype Mastery — the founder-gated normalization half of the
// ENFORCEMENT flip ceremony (end-of-branch ruling B4): zeroes what never
// passed a gate, and ONLY what the founder explicitly approved from the
// census report. Sequence (see mastery-preflip-census.js header +
// api/_utils/masteryConfig.js FLIP PROTOCOL):
//
//   census → founder review → THIS SCRIPT → the ENFORCEMENT constant flip.
//
// INPUTS:
//   --census <path>    the mastery-preflip-census-report.json to execute
//   --approved <path>  founder-curated JSON: an array of entry KEYS from the
//                      census report (e.g. ["dial_aggressive:agents/a1", ...])
//                      Only listed entries are touched, and only entries the
//                      census itself proposed for normalization: an approved
//                      key whose census disposition is 'review'
//                      (gate-passing dials, truncated lean plans,
//                      forge_overage) is REFUSED loudly — review means
//                      founder judgment, never a blind script write.
//   --apply            actually write. DEFAULT IS DRY-RUN (prints the plan).
//
// ACTIONS (kind → the ONE proposedAction this script will execute):
//   dial_aggressive → 'dial_reset':     dials.tempo = 'standard'
//                     (rides txUpdateAgentSettings: settingsRev discipline)
//   lean_overage    → 'lean_trim':      standingLeans minus the census trim
//                     plan (kernel loser order; other-archetype pins
//                     preserved per ruling M5) — also via txUpdateAgentSettings
//   stats_games     → 'stats_set_games': stats.gamesPlayed = normalizedValue
//                     (the verified stats-counted battle count; plain update
//                     — stats are not a customization surface)
//
// SAFETY (governing principle, hardening rulings B1/B2: census proposes,
// LIVE STATE DISPOSES): every write happens in a transaction that
// RE-DERIVES its inputs from live state through the same kernels the
// census used, at write time — the dial branch re-reads the live profile
// and re-runs the gate; the lean branch re-reads the live profile (cap)
// AND re-runs the trim kernel; the stats branch re-counts the verified
// battles (completed, non-tournament, current-ownerId-bound) and writes
// the LIVE value. Any drift (pin set changed, dial reset already, user
// leveled past the gate or into a wider cap, overstatement no longer
// proven) is SKIPPED loudly and the census must be re-run. Doc paths are
// pinned to the agents collection. Nothing here touches bundle rule
// content (forge_overage remediation is the reforge trim path + the
// equip-time gate, by design).

import process from 'node:process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { txUpdateAgentSettings } from '../api/_utils/agentSettingsTx.js';
import { revalidateStandingLeans, LEAN_INVALIDATION_REASONS } from '../api/_utils/leanRevalidation.js';
import { archetypeLevelFromProfile, leanCapForLevel, revalidateTempoDial } from '../api/_utils/masteryEnforcement.js';
import { MASTERY_PROFILES_COLLECTION } from '../api/_utils/masteryConfig.js';
import { TOURNAMENT_GAME_MODE } from '../src/constants/leagueTournament.js';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');

const ACTION_BY_KIND = Object.freeze({
  dial_aggressive: 'dial_reset',
  lean_overage: 'lean_trim',
  stats_games: 'stats_set_games',
});
const AGENT_DOC_PATH = /^agents\/[A-Za-z0-9_-]+$/;

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

class DriftError extends Error {}

function describeAction(entry) {
  if (entry.kind === 'dial_aggressive') return "dials.tempo → 'standard'";
  if (entry.kind === 'lean_overage') return `remove pins [${(entry.trimIds || []).join(', ')}] (${entry.archetype} overage)`;
  if (entry.kind === 'stats_games') return `stats.gamesPlayed ${JSON.stringify(entry.claimedGamesPlayed)} → live-verified count (census estimate ${entry.normalizedValue})`;
  return '(unsupported)';
}

const sortedEq = (a, b) => {
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
};

async function main() {
  const censusPath = argValue('--census');
  const approvedPath = argValue('--approved');
  const apply = process.argv.includes('--apply');
  if (!censusPath || !existsSync(censusPath)) die('--census <path> is required (run mastery-preflip-census.js first)');
  if (!approvedPath || !existsSync(approvedPath)) die('--approved <path> is required (the founder-curated key list)');

  const census = JSON.parse(readFileSync(censusPath, 'utf8'));
  const approved = JSON.parse(readFileSync(approvedPath, 'utf8'));
  if (!Array.isArray(approved) || approved.some((k) => typeof k !== 'string')) {
    die('--approved must be a JSON array of census entry keys');
  }
  const entryByKey = new Map((census.entries || []).map((e) => [e.key, e]));
  const missing = approved.filter((k) => !entryByKey.has(k));
  if (missing.length) die(`approved keys not in the census report (stale approval? re-run census): ${missing.join(', ')}`);

  const plan = approved.map((k) => entryByKey.get(k));
  // Only census-PROPOSED normalizations are executable: kind must have an
  // action AND the entry's own disposition must be that action ('review'
  // entries — gate-passing dials, truncated trim plans, forge overages —
  // are founder-judgment items this script must never write for).
  const refused = plan.filter((e) => e.proposedAction !== ACTION_BY_KIND[e.kind]);
  if (refused.length) {
    die(`approved entries this script will not execute (disposition is not a normalization): ${refused.map((e) => `${e.key} [${e.proposedAction ?? 'no-action'}]`).join(', ')}`);
  }
  const badPath = plan.filter((e) => !AGENT_DOC_PATH.test(e.docPath || ''));
  if (badPath.length) {
    die(`entries with non-agent doc paths (census tampering?): ${badPath.map((e) => e.key).join(', ')}`);
  }

  console.log(`\n=== Mastery pre-flip normalization (${apply ? 'APPLY' : 'DRY-RUN'}) ===`);
  console.log(`census: ${censusPath} (generated ${census.generatedAt})`);
  console.log(`approved entries: ${plan.length}\n`);

  const db = apply ? initAdmin() : null;
  const results = { applied: 0, skippedDrift: 0, dryRun: 0, errors: 0 };

  for (const entry of plan) {
    const label = `${entry.kind} @ ${entry.docPath}`;
    if (!apply) {
      console.log(`[dry-run] ${label} → ${describeAction(entry)}`);
      results.dryRun++;
      continue;
    }
    try {
      await db.runTransaction(async (tx) => {
        const ref = db.doc(entry.docPath);
        const profileRef = entry.ownerId
          ? db.collection(MASTERY_PROFILES_COLLECTION).doc(entry.ownerId)
          : null;
        const snap = await tx.get(ref);
        if (!snap.exists) throw new DriftError('doc no longer exists');
        const a = snap.data();
        const nowIso = new Date().toISOString();

        if (entry.kind === 'dial_aggressive') {
          if (a.dials?.tempo !== 'aggressive') throw new DriftError(`tempo is now '${a.dials?.tempo}'`);
          // Re-derive the verdict from LIVE profile state through the
          // shared Q7 rule — a user who cleared the gate since the census
          // must not be reset.
          const profileSnap = profileRef ? await tx.get(profileRef) : null;
          const level = archetypeLevelFromProfile(profileSnap?.exists ? profileSnap.data() : null, a.archetype);
          if (!revalidateTempoDial({ tempo: 'aggressive', level }).invalidated) {
            throw new DriftError(`gate now passes (level ${level}) — no longer ungated`);
          }
          txUpdateAgentSettings(tx, ref, { 'dials.tempo': 'standard', updatedAt: nowIso });
        } else if (entry.kind === 'lean_overage') {
          const pins = Array.isArray(a.standingLeans) ? a.standingLeans : [];
          // B2 (census proposes, live state disposes): the LIVE profile
          // decides the cap — parity with the dial branch. A user who
          // leveled since the census gets the wider cap, not the stale plan.
          const profileSnap = profileRef ? await tx.get(profileRef) : null;
          const liveLevel = archetypeLevelFromProfile(profileSnap?.exists ? profileSnap.data() : null, entry.archetype);
          const liveCap = leanCapForLevel(liveLevel);
          if (liveCap !== entry.cap) {
            throw new DriftError(`live cap ${liveCap} (level ${liveLevel}) differs from the approved plan's cap ${entry.cap}`);
          }
          // Re-derive the trim plan from LIVE pins at the LIVE cap — the
          // approved plan executes only when it still matches exactly (same
          // kernel losers). A set that changed since the census (unequips,
          // refreshes, new pins) or lost its overage drifts → re-census.
          const { invalidated } = revalidateStandingLeans({
            standingLeans: pins,
            archetypeCodeId: entry.archetype,
            leanCap: liveCap,
          });
          const liveTrim = invalidated
            .filter((r) => r.reason === LEAN_INVALIDATION_REASONS.OVER_CAP)
            .map((r) => r.adjustmentId);
          if (liveTrim.length === 0) throw new DriftError('no live overage remains');
          if (!sortedEq(liveTrim, entry.trimIds || [])) {
            throw new DriftError(`live trim plan [${liveTrim.join(', ')}] no longer matches the approved plan`);
          }
          const trim = new Set(entry.trimIds || []);
          txUpdateAgentSettings(tx, ref, {
            standingLeans: pins.filter((l) => !trim.has(l?.adjustmentId)),
            updatedAt: nowIso,
          });
        } else if (entry.kind === 'stats_games') {
          const claimed = a.stats?.gamesPlayed;
          if (claimed !== entry.claimedGamesPlayed) throw new DriftError(`gamesPlayed is now ${JSON.stringify(claimed)}`);
          // B1 (census proposes, live state disposes): re-derive the
          // verified count IMMEDIATELY before the write — same predicate as
          // the census (completed, non-tournament, bound to the doc's
          // CURRENT ownerId) — and abort unless the overstatement is still
          // proven against live state. The write is the live-derived value,
          // never the census snapshot.
          const battlesSnap = await tx.get(
            db.collection('agentBattles')
              .where('agentId', '==', ref.id)
              .select('status', 'gameMode', 'ownerId'),
          );
          let verifiedLive = 0;
          for (const bDoc of battlesSnap.docs) {
            const b = bDoc.data();
            if (b.status === 'completed' && b.gameMode !== TOURNAMENT_GAME_MODE && b.ownerId === a.ownerId) {
              verifiedLive += 1;
            }
          }
          const claimedClean = Number.isInteger(claimed) && claimed >= 0;
          const overstated = (claimed !== undefined && claimed !== null && !claimedClean)
            || (claimedClean && claimed > verifiedLive);
          if (!overstated) {
            throw new DriftError(`overstatement no longer proven live (claimed ${JSON.stringify(claimed)}, live-verified ${verifiedLive})`);
          }
          tx.update(ref, { 'stats.gamesPlayed': verifiedLive, updatedAt: nowIso });
        }
      });
      console.log(`[applied] ${label} → ${describeAction(entry)}`);
      results.applied++;
    } catch (err) {
      if (err instanceof DriftError) {
        console.error(`[SKIPPED — drifted since census] ${label}: ${err.message} (re-run the census)`);
        results.skippedDrift++;
      } else {
        console.error(`[ERROR] ${label}: ${err?.message || err}`);
        results.errors++;
      }
    }
  }

  console.log(`\napplied=${results.applied} dryRun=${results.dryRun} skippedDrift=${results.skippedDrift} errors=${results.errors}`);
  if (apply && (results.skippedDrift > 0 || results.errors > 0)) {
    console.log('Non-clean run: re-run the census and re-review before flipping ENFORCEMENT.');
    process.exitCode = 1;
  } else if (apply) {
    console.log('Clean. Re-run the census to produce the passing (empty-of-approved-kinds) report the flip ceremony requires.');
  }
}

main().catch((err) => die(err && err.stack ? err.stack : String(err)));
