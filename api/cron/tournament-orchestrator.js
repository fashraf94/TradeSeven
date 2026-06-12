// api/cron/tournament-orchestrator.js
//
// P3b — the tournament orchestrator's cron handler (Spec §1.3, one cron
// slot; founder Ruling A). Transport only: cron auth per the house pattern,
// the Anthropic client singleton (the decide.js pattern — Monday board
// production needs it), and one runOrchestratorTick on the real clock. All
// routing, duties, idempotency, and budget logic live in
// api/_utils/tournamentOrchestrator.js.
//
// Schedule (vercel.json): */10 11,12,13,14,21,22,23 * * 1-5 — both DST arms
// of the ET morning + Friday-evening windows; the ET-aware dispatcher routes
// each tick (or quiet-skips it). Crons do not run on Vercel preview — the
// founder smoke path is POST /api/tournament/run-duty; production
// verification is unit tests on the guard logic + observation of the first
// production runs (BUILD_RULES §6).
//
// Live-at-merge inertness: with zero tournament groups every duty no-ops
// with a single quiet log line and zero writes (test-locked in the
// orchestrator module's battery).

import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { runOrchestratorTick } from '../_utils/tournamentOrchestrator.js';

// Ruled: the duty budget defers remainder at ~270s of this 300s ceiling.
export const config = { maxDuration: 300 };

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 2 });
  }
  return anthropicClient;
}

export default async function handler(req, res) {
  // Cron auth — house pattern (agent-evaluate.js:100-102).
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authHeader = req.headers.authorization;
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = getFirebaseAdmin();
    const result = await runOrchestratorTick(db, {
      now: new Date(),
      anthropic: getAnthropicClient(),
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[Orchestrator] tick FAILED:', err);
    return res.status(500).json({ error: 'server_error', message: 'Orchestrator tick failed.' });
  }
}
