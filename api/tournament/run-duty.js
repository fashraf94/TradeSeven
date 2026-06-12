// api/tournament/run-duty.js
//
// P3b — POST /api/tournament/run-duty. Manual trigger for one orchestrator
// duty (admin/cron secret) — the PREVIEW/smoke path on the bank-daily-scores
// precedent: crons do not run on Vercel preview, so the founder drives the
// dispatcher from the dev surface's duty buttons and reads the duty summary
// off the response. Production ticks ride api/cron/tournament-orchestrator.
//
// Time controls (the P1b idiom — admin-gated by construction):
// - `simulatedNow` (ISO instant): the injected clock — run "Monday morning"
//   on a Thursday. Simulated runs read and write duty markers in the
//   'sim:' namespace, keyed by the SIMULATED ET date: a re-click shows the
//   idempotent already-complete no-op exactly like a production re-tick,
//   while a smoke run on a future date can NEVER pre-satisfy the real cron
//   when that date arrives.
// - `duty`: force a specific duty regardless of the simulated clock
//   ('monday_pipeline' | 'weekday_fanout' | 'friday_advancement'), or omit
//   to exercise the real dispatcher routing.

import Anthropic from '@anthropic-ai/sdk';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { requireAdminSecret } from '../_utils/adminSecretAuth.js';
import { parseSimulatedNow } from '../_utils/tournamentTime.js';
import { runOrchestratorTick, DUTY } from '../_utils/tournamentOrchestrator.js';

export const config = { maxDuration: 300 };

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, maxRetries: 2 });
  }
  return anthropicClient;
}

const FORCEABLE_DUTIES = new Set([DUTY.MONDAY_PIPELINE, DUTY.WEEKDAY_FANOUT, DUTY.FRIDAY_ADVANCEMENT]);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!requireAdminSecret(req, res)) return;

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const { duty = null, simulatedNow = null } = body;

  if (duty != null && !FORCEABLE_DUTIES.has(duty)) {
    return res.status(400).json({ error: 'invalid_duty', message: `duty must be one of: ${[...FORCEABLE_DUTIES].join(', ')}` });
  }
  const parsed = parseSimulatedNow(simulatedNow);
  if (parsed.error) {
    return res.status(400).json({ error: 'invalid_simulated_now', message: parsed.error });
  }

  try {
    const db = getFirebaseAdmin();
    const result = await runOrchestratorTick(db, {
      now: parsed.now,
      anthropic: getAnthropicClient(),
      forceDuty: duty,
      simulated: simulatedNow != null,
    });
    console.log(`[Tournament] run-duty: ${result.duty} @ ${result.etDate} ${result.etTime} →`, JSON.stringify(result.status ?? result.complete ?? 'ran'));
    return res.status(200).json(result);
  } catch (err) {
    console.error('[Tournament] run-duty error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Could not run the duty.' });
  }
}
