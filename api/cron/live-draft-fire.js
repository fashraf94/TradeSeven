// api/cron/live-draft-fire.js
//
// League — Competitive Live Draft: the DEDICATED slot-fire cron (S2 ruling —
// a standalone `*/10 * * * *` entry, NOT an orchestrator-schedule expansion, so
// it covers the weekend/evening slots the orchestrator window can't). Every pass:
//   1. FIRE — find FORMING slot groups whose scheduledDraftAt has arrived and
//      open the interactive draft (CPU-fill + init → DRAFTING).
//   2. DRIVE — for DRAFTING slot groups, autopick every OVERDUE turn to
//      completion (the S3 completion guarantee: an abandoned draft finishes in
//      ONE pass; on completion the pod lands AWAITING_OPEN / BATTLE per its
//      battleStartWeek anchor, and the existing Monday-open flip takes it to
//      BATTLE).
//
// Each group is an ISOLATED subtask (own try/catch) — one pod's failure never
// blocks the rest of the pass (the canonical-open-sweep-on-agent-evaluate
// pattern). Cron auth = the house vercel-cron / CRON_SECRET pattern.
//
// FLAG GATE: flag-off this cron is a strict no-op — it never queries or writes a
// group, so the schedule entry is inert (byte-identical). Crons do not run on
// Vercel preview; production verification is the guard-logic unit tests +
// observation of the first production runs (BUILD_RULES §6).

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { LEAGUE_LIVE_DRAFT } from '../../src/config/featureFlags.js';
import {
  findDueSlotGroups,
  findDraftingSlotGroups,
  fireCompetitiveSlotDraft,
  driveSlotDraftAutopick,
} from '../_utils/liveDraftLifecycle.js';

export const config = { maxDuration: 60 };

const LOG_PREFIX = '[LiveDraftFire]';

export default async function handler(req, res) {
  // Cron auth — house pattern (agent-evaluate.js).
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Built dark: with the flag off this cron touches nothing (byte-identical).
  if (!LEAGUE_LIVE_DRAFT) {
    return res.status(200).json({ ok: true, skipped: 'flag_off' });
  }

  const now = new Date();
  const summary = { checkedForming: 0, fired: 0, fireErrors: 0, checkedDrafting: 0, autopicked: 0, completed: 0, driveErrors: 0 };

  try {
    const db = getFirebaseAdmin();

    // 1. FIRE due FORMING slot groups — isolated per group.
    const due = await findDueSlotGroups(db, now);
    summary.checkedForming = due.length;
    for (const g of due) {
      try {
        const r = await fireCompetitiveSlotDraft(db, g.id, { now });
        if (r.fired) summary.fired++;
      } catch (err) {
        summary.fireErrors++;
        console.error(`${LOG_PREFIX} fire ${g.id} FAILED (isolated):`, err?.message);
      }
    }

    // 2. DRIVE DRAFTING slot groups — autopick overdue turns to completion.
    const drafting = await findDraftingSlotGroups(db);
    summary.checkedDrafting = drafting.length;
    for (const g of drafting) {
      try {
        const r = await driveSlotDraftAutopick(db, g.id, { now });
        summary.autopicked += r.autopicked || 0;
        if (r.complete) summary.completed++;
      } catch (err) {
        summary.driveErrors++;
        console.error(`${LOG_PREFIX} drive ${g.id} FAILED (isolated):`, err?.message);
      }
    }

    return res.status(200).json({ ok: true, timestamp: now.toISOString(), ...summary });
  } catch (err) {
    console.error(`${LOG_PREFIX} fatal:`, err);
    return res.status(500).json({ ok: false, error: err?.message, ...summary });
  }
}
