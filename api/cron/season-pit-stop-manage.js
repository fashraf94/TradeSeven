// api/cron/season-pit-stop-manage.js
//
// Pit Stop Management Cron (Phase B-9b)
//
// ⚠ NOT SCHEDULED — THIS HANDLER DOES NOT RUN (as of Jul 25, 2026).
// The two "Cron schedule:" lines below are HISTORICAL. Both entries were
// removed from vercel.json on Jun 4, 2026 by commit d80aee25 ("Forge redesign
// Phase 1"), which deleted all three season crons (count 40 → 37). Season mode
// is scrapped permanently per founder ruling C-19; this handler is RETAINED
// UN-SCHEDULED rather than deleted. Nothing else invokes it. See
// season-daily-evaluate.js's header for the full record and the cron-budget
// arithmetic on any future restoration.
//
// Manages the weekly pit-stop lifecycle for active season entries via
// ?action= query-param routing:
//
//   ?action=open   — Saturday morning: create pitStop docs, open the
//                    client-write gate (isPitStopOpen = true) for each
//                    active entry. Runs 7:30–8:30 AM ET.
//                    Cron schedule (HISTORICAL, removed Jun 4 2026):
//                    "0 13,14 * * 6" (UTC, DST dual-hour)
//
//   ?action=lockin — Sunday night: re-validate every client-submitted
//                    change against the canonical rule schema, apply
//                    validated changes to entry.algorithm.rules, copy
//                    the validated shortlist into seasonState, and close
//                    the gate. Runs 9:30–10:30 PM ET.
//                    Cron schedule (HISTORICAL, removed Jun 4 2026):
//                    "0 3,4 * * 1" (Monday UTC = Sunday
//                    night ET, DST dual-hour)
//
// The rule schema registry is built once at module load from the
// canonical FORGE_RULE_TEMPLATES in src/data/forgeKnowledgeBase.js —
// cross-boundary imports from api/ → src/ are an established pattern
// (see api/cron/snake-draft-daily-scores.js, api/_utils/supplyChainLookup.js,
// and 9 other files).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import {
  validatePitStopChanges,
  validateShortlist,
  buildRuleSchemaRegistry,
} from '../_utils/seasonValidation.js';
import {
  SEASON_CONFIG,
  SEASON_STATUS,
  ENTRY_STATUS,
  PIT_STOP_STATUS,
} from '../_utils/seasonConfig.js';
import { FORGE_RULE_TEMPLATES } from '../../src/data/forgeKnowledgeBase.js';

// Built once per cold start — pure transform, no I/O, cached for the
// lifetime of the serverless instance.
const RULE_SCHEMA_REGISTRY = buildRuleSchemaRegistry(FORGE_RULE_TEMPLATES);

function getEtMinutes(now) {
  const etHour = parseInt(
    now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }),
    10
  );
  const etMinute = parseInt(
    now.toLocaleString('en-US', { timeZone: 'America/New_York', minute: 'numeric' }),
    10
  );
  return etHour * 60 + etMinute;
}

export default async function handler(req, res) {
  // ─── CRON_SECRET guard ───────────────────────────────────────
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ─── Route by ?action= ───────────────────────────────────────
  const action = req.query?.action;
  if (action !== 'open' && action !== 'lockin') {
    return res.status(400).json({
      error: 'Missing or invalid action param. Use ?action=open or ?action=lockin',
    });
  }

  try {
    const db = getFirebaseAdmin();
    if (action === 'open') {
      return await handleOpen(db, res);
    }
    return await handleLockIn(db, res);
  } catch (error) {
    console.error(`[SEASON] Pit stop ${action} failed:`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════
// MODE: open — Saturday 7:30-8:30 AM ET
// ═══════════════════════════════════════════════════════════════

async function handleOpen(db, res) {
  const now = new Date();
  const etTime = getEtMinutes(now);
  if (etTime < 7 * 60 + 30 || etTime > 8 * 60 + 30) {
    return res.status(200).json({ skipped: true, reason: 'Outside pit stop open window' });
  }

  const seasonsSnap = await db
    .collection('seasons')
    .where('status', '==', SEASON_STATUS.ACTIVE)
    .get();

  if (seasonsSnap.empty) {
    return res.status(200).json({ skipped: true, reason: 'No active seasons' });
  }

  let totalOpened = 0;
  const summaries = [];

  for (const seasonDoc of seasonsSnap.docs) {
    try {
      const season = seasonDoc.data();
      const currentWeek = season.currentWeek || 0;
      const totalWeeks = season.weeks?.length || SEASON_CONFIG.TOTAL_WEEKS;
      const isSolo = season.mode === 'solo';

      // Tournaments: no pit stop at or beyond the final week — there's no
      // subsequent week to apply changes to, and the end-of-tournament
      // debrief path is a future-sprint concern.
      // Solo (Phase 3 spec §8, option f): fire a pit stop in the final
      // week as well — it doubles as the end-of-session debrief surface.
      const pastFinalWeek = isSolo
        ? currentWeek > totalWeeks
        : currentWeek >= totalWeeks;
      if (pastFinalWeek) {
        summaries.push({ seasonId: seasonDoc.id, skipped: true, reason: 'final week' });
        continue;
      }

      // Load active entries for this season
      const entriesSnap = await db
        .collection('seasonEntries')
        .where('seasonId', '==', seasonDoc.id)
        .where('status', '==', ENTRY_STATUS.ACTIVE)
        .get();

      let seasonOpened = 0;

      for (const entryDoc of entriesSnap.docs) {
        try {
          const entry = entryDoc.data();

          // Idempotency: skip if pitStop already exists for this week
          const pitStopRef = entryDoc.ref.collection('pitStops').doc(String(currentWeek));
          const existingPitStop = await pitStopRef.get();
          if (existingPitStop.exists) continue;

          // Snapshot current algorithm rules for version history
          const algorithmSnapshot = {
            version: entry.algorithm?.version || 1,
            rules: entry.algorithm?.rules || [],
            ruleCount: entry.algorithm?.ruleCount || 0,
            snapshotAt: new Date().toISOString(),
          };

          // Create the pit stop doc with the open schema
          await pitStopRef.set({
            week: currentWeek,
            seasonId: seasonDoc.id,
            status: PIT_STOP_STATUS.OPEN,
            debrief: null, // lazily generated when user opens UI
            algorithmSnapshot,
            changes: [],
            changeCount: 0,
            shortlist: [],
            shortlistRationale: {},
            pendingUserMessage: null,
            conversation: [],
            conversationCount: 0,
            lockedInAt: null,
            lockedInBy: null,
            validatedChanges: [],
            rejectedChanges: [],
            validationResult: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Open the client-write gate
          await entryDoc.ref.update({
            isPitStopOpen: true,
            updatedAt: new Date().toISOString(),
          });

          seasonOpened++;
          totalOpened++;
        } catch (err) {
          console.error(
            `[SEASON] Pit stop open failed for entry ${entryDoc.id}:`,
            err.message
          );
        }
      }

      summaries.push({
        seasonId: seasonDoc.id,
        week: currentWeek,
        opened: seasonOpened,
      });
    } catch (err) {
      console.error(`[SEASON] Pit stop open failed for season ${seasonDoc.id}:`, err);
      summaries.push({ seasonId: seasonDoc.id, error: err.message });
    }
  }

  return res.status(200).json({
    success: true,
    pitStopsOpened: totalOpened,
    seasons: summaries,
  });
}

// ═══════════════════════════════════════════════════════════════
// MODE: lockin — Sunday 9:30-10:30 PM ET
// ═══════════════════════════════════════════════════════════════

async function handleLockIn(db, res) {
  const now = new Date();
  const etTime = getEtMinutes(now);
  if (etTime < 21 * 60 + 30 || etTime > 22 * 60 + 30) {
    return res.status(200).json({ skipped: true, reason: 'Outside pit stop lock-in window' });
  }

  const seasonsSnap = await db
    .collection('seasons')
    .where('status', '==', SEASON_STATUS.ACTIVE)
    .get();

  if (seasonsSnap.empty) {
    return res.status(200).json({ skipped: true, reason: 'No active seasons' });
  }

  let totalLocked = 0;
  const errors = [];
  const summaries = [];

  for (const seasonDoc of seasonsSnap.docs) {
    try {
      const season = seasonDoc.data();
      const currentWeek = season.currentWeek || 0;

      const entriesSnap = await db
        .collection('seasonEntries')
        .where('seasonId', '==', seasonDoc.id)
        .where('status', '==', ENTRY_STATUS.ACTIVE)
        .get();

      let seasonLocked = 0;

      for (const entryDoc of entriesSnap.docs) {
        try {
          const entry = entryDoc.data();

          // Read pit stop doc for this week
          const pitStopRef = entryDoc.ref.collection('pitStops').doc(String(currentWeek));
          const pitStopSnap = await pitStopRef.get();
          if (!pitStopSnap.exists) continue;

          const pitStop = pitStopSnap.data();

          // Skip if already locked (idempotency)
          if (pitStop.status !== PIT_STOP_STATUS.OPEN) continue;

          // Determine lock-in type
          const userInteracted =
            (pitStop.changes?.length > 0) ||
            (pitStop.shortlist?.length > 0) ||
            ((pitStop.conversationCount || 0) > 0);
          const lockedInBy = userInteracted ? 'user' : 'auto';

          // ── Validate Changes ──
          const currentRules = entry.algorithm?.rules || [];
          const changeValidation = validatePitStopChanges(
            pitStop.changes || [],
            currentRules,
            RULE_SCHEMA_REGISTRY
          );

          // ── Validate Shortlist ──
          const shortlistValidation = validateShortlist(
            pitStop.shortlist || [],
            season.universe || [],
            entry.portfolio || {}
          );

          // ── Apply validated changes atomically ──
          await db.runTransaction(async (txn) => {
            const freshEntry = await txn.get(entryDoc.ref);
            const freshData = freshEntry.data();
            const freshRules = [...(freshData.algorithm?.rules || [])];

            // Apply each validated change to a copy of current rules
            for (const change of changeValidation.validated) {
              const ruleIdx = freshRules.findIndex(r => r.ruleId === change.ruleId);
              if (ruleIdx === -1) continue;
              freshRules[ruleIdx] = {
                ...freshRules[ruleIdx],
                params: {
                  ...freshRules[ruleIdx].params,
                  [change.field]: change.newValue,
                },
              };
            }

            const changesApplied = changeValidation.validated.length > 0;
            const newVersion =
              (freshData.algorithm?.version || 1) + (changesApplied ? 1 : 0);

            // Build the single merged entry update — combines algorithm
            // changes, shortlist, and gate-close into one txn.update.
            const entryUpdate = {
              'algorithm.rules': freshRules,
              'algorithm.version': newVersion,
              'algorithm.lastModified': new Date().toISOString(),
              isPitStopOpen: false,
              updatedAt: new Date().toISOString(),
            };

            if (shortlistValidation.validated.length > 0) {
              entryUpdate['seasonState.userShortlist'] = shortlistValidation.validated;
              entryUpdate['seasonState.shortlistWeek'] = currentWeek + 1;
            }

            txn.update(entryDoc.ref, entryUpdate);

            // Compute the high-level validation result
            const validationResult =
              changeValidation.rejected.length === 0
                ? 'all_accepted'
                : changeValidation.validated.length === 0
                  ? 'all_rejected'
                  : 'partial';

            // Update the pit stop doc with final state
            txn.update(pitStopRef, {
              status: PIT_STOP_STATUS.COMPLETED,
              validatedChanges: changeValidation.validated,
              rejectedChanges: changeValidation.rejected,
              validationResult,
              lockedInAt: new Date().toISOString(),
              lockedInBy,
              updatedAt: new Date().toISOString(),
            });
          });

          seasonLocked++;
          totalLocked++;
        } catch (err) {
          console.error(`[SEASON] Lock-in failed for entry ${entryDoc.id}:`, err.message);
          errors.push({ entryId: entryDoc.id, error: err.message?.slice(0, 300) });

          // Best-effort: close the gate even on error so the client can't
          // keep writing to a stuck pit stop.
          try {
            await entryDoc.ref.update({
              isPitStopOpen: false,
              updatedAt: new Date().toISOString(),
            });
          } catch (_) {
            /* swallow */
          }
        }
      }

      summaries.push({
        seasonId: seasonDoc.id,
        week: currentWeek,
        locked: seasonLocked,
      });
    } catch (err) {
      console.error(`[SEASON] Pit stop lock-in failed for season ${seasonDoc.id}:`, err);
      summaries.push({ seasonId: seasonDoc.id, error: err.message });
    }
  }

  return res.status(200).json({
    success: true,
    pitStopsLocked: totalLocked,
    errorCount: errors.length,
    errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    seasons: summaries,
  });
}
