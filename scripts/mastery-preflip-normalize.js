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
//                      Only listed entries are touched. 'review'-only kinds
//                      (forge_overage) are never applied by this script.
//   --apply            actually write. DEFAULT IS DRY-RUN (prints the plan).
//
// ACTIONS (by census entry kind):
//   dial_aggressive → dials.tempo = 'standard'  (rides txUpdateAgentSettings:
//                     settingsRev discipline like any dial write)
//   lean_overage    → standingLeans minus the entry's trimIds (kernel-order
//                     overage beyond the cap; other-archetype pins preserved
//                     per ruling M5) — also via txUpdateAgentSettings
//   stats_games     → stats.gamesPlayed = entry.normalizedValue (the
//                     verified completed-battle count; plain update — stats
//                     are not a customization surface, no settingsRev)
//
// SAFETY: every write happens in a transaction that re-reads the doc and
// re-verifies the census entry's pre-state still holds; a drifted doc is
// SKIPPED loudly (re-run the census). Nothing here touches bundle rule
// content (forge_overage remediation is the reforge trim path + the
// equip-time gate, by design).

import process from 'node:process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { txUpdateAgentSettings } from '../api/_utils/agentSettingsTx.js';

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
  const unsupported = plan.filter((e) => !['dial_aggressive', 'lean_overage', 'stats_games'].includes(e.kind));
  if (unsupported.length) {
    die(`approved entries with non-normalizable kinds (forge_overage is reforge-path-only): ${unsupported.map((e) => e.key).join(', ')}`);
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
        const snap = await tx.get(ref);
        if (!snap.exists) throw new DriftError('doc no longer exists');
        const a = snap.data();
        const nowIso = new Date().toISOString();

        if (entry.kind === 'dial_aggressive') {
          if (a.dials?.tempo !== 'aggressive') throw new DriftError(`tempo is now '${a.dials?.tempo}'`);
          txUpdateAgentSettings(tx, ref, { 'dials.tempo': 'standard', updatedAt: nowIso });
        } else if (entry.kind === 'lean_overage') {
          const pins = Array.isArray(a.standingLeans) ? a.standingLeans : [];
          const trim = new Set(entry.trimIds || []);
          const kept = pins.filter((l) => !trim.has(l?.adjustmentId));
          if (kept.length === pins.length) throw new DriftError('trim ids no longer present');
          txUpdateAgentSettings(tx, ref, { standingLeans: kept, updatedAt: nowIso });
        } else if (entry.kind === 'stats_games') {
          const claimed = a.stats?.gamesPlayed;
          if (claimed !== entry.claimedGamesPlayed) throw new DriftError(`gamesPlayed is now ${claimed}`);
          tx.update(ref, { 'stats.gamesPlayed': entry.normalizedValue, updatedAt: nowIso });
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

class DriftError extends Error {}

function describeAction(entry) {
  if (entry.kind === 'dial_aggressive') return "dials.tempo → 'standard'";
  if (entry.kind === 'lean_overage') return `remove pins [${(entry.trimIds || []).join(', ')}] (${entry.archetype} overage)`;
  if (entry.kind === 'stats_games') return `stats.gamesPlayed ${entry.claimedGamesPlayed} → ${entry.normalizedValue}`;
  return '(unsupported)';
}

main().catch((err) => die(err && err.stack ? err.stack : String(err)));
