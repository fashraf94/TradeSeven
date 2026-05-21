// api/_utils/shadowLogger.js
// Fire-and-forget shadow logging to Google Cloud Storage.
// Writes structured JSONL records for AI training data capture.
// NEVER throws. NEVER blocks. All errors are swallowed after console.error.

import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = 'fantasytrades';

let bucketInstance = null;

function getGCSBucket() {
  if (bucketInstance) return bucketInstance;

  const creds = process.env.GCS_CREDENTIALS;
  if (!creds) {
    console.warn('[ShadowLogger] GCS_CREDENTIALS not set — shadow logging disabled');
    return null;
  }

  try {
    const storage = new Storage({
      projectId: 'macro-nuance-474602-f5',
      credentials: JSON.parse(creds),
    });
    bucketInstance = storage.bucket(BUCKET_NAME);
    return bucketInstance;
  } catch (err) {
    console.error('[ShadowLogger] Init failed:', err.message);
    return null;
  }
}

async function appendToStream(stream, record) {
  const bucket = getGCSBucket();
  if (!bucket) return;

  try {
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const eventId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const filePath = `shadow/${stream}/${dateKey}/${eventId}.jsonl`;

    const line = JSON.stringify({
      ...record,
      _stream: stream,
      _loggedAt: now.toISOString(),
    }) + '\n';

    await bucket.file(filePath).save(line, {
      contentType: 'application/x-ndjson',
      resumable: false,
    });
  } catch (err) {
    console.error(`[ShadowLogger] ${stream} write failed:`, err.message);
  }
}

export const logConversation      = (r) => appendToStream('conversations', r);
export const logDecision          = (r) => appendToStream('decisions', r);
export const logReflection        = (r) => appendToStream('reflections', r);
export const logEvaluation        = (r) => appendToStream('evaluations', r);
export const logCompilation       = (r) => appendToStream('compilations', r);
export const logPartnerSignal     = (r) => appendToStream('partner_signals', r);

// Phase 6 — Shadow Logger Extension (training data pipeline)
// Fed by create-entry.js, season-daily-evaluate.js, generate-debrief.js,
// pit-stop-reply.js, and log-lockin.js. All callers must use
// `.catch(() => {})` to enforce the fire-and-forget contract.
export const logStrategyConfig    = (r) => appendToStream('strategy_configs', r);
export const logPipelineDecision  = (r) => appendToStream('pipeline_decisions', r);
export const logReviewInteraction = (r) => appendToStream('review_interactions', r);
export const logDailyRegimeBrief  = (r) => appendToStream('daily_regime_brief', r);

// Spec A Phase 2a — Vision object events.
// See SPEC_A_VISION_REFERENCE_V1.md §2.5 (transitions) and §2.8 (constraints).
// Emission sites: completeBattle (Phase 2a, retirement); Gemma authoring,
// confirmation flows, Risk Manager constraint injection (Phase 2b).
//
// Vision transition event payload:
// {
//   battleId: string,
//   visionSnapshot: Vision,            // Full post-transition Vision object
//   transition: {
//     fromState: LifecycleState | null,  // null for initial creation
//     toState: LifecycleState,
//     actor: TransitionActor,
//     cause: TransitionCause,
//     timestamp: Timestamp
//   },
//   triggerContext: object | null,     // Trigger-gate context if applicable (Phase 2b for Gemma)
//   userInput: string | null,          // User utterance if user-caused (Phase 2b)
// }
//
// Vision constraint change event payload:
// {
//   battleId: string,
//   visionState: LifecycleState,       // Current state at time of change
//   change: {
//     operation: 'add' | 'remove' | 'modify',
//     constraintId: string,
//     constraintType: ConstraintType,
//     actor: 'gemma' | 'risk_manager' | 'forge',
//     cause: string,
//     timestamp: Timestamp
//   },
//   constraintSnapshot: Constraint,
// }
export const logVisionTransition       = (r) => appendToStream('vision_transitions', r);
export const logVisionConstraintChange = (r) => appendToStream('vision_constraint_changes', r);
export const logSignalDrops            = (r) => appendToStream('signal_drops', r);

// Sprint 1 — Consolidation writer events. Emitted from agentConsolidationApply.js
// for both success and failure (failure records include reason + errors/output
// for replay). Caller must use `.catch(() => {})` to enforce fire-and-forget.
export const logConsolidation          = (r) => appendToStream('agent_consolidation', r);

// Phase 1 Voice Layer Rework — First-Message-on-Deploy events. Emitted from
// api/agent/decide.js after createAgentBattle returns. Records both success
// (prompt + Gemma response + parsed exchange) and failure (errorStep +
// errorReason) so post-deploy diagnostics can replay the path. Caller must
// use `.catch(() => {})` to preserve the fire-and-forget contract.
export const logFirstMessage           = (r) => appendToStream('first_message', r);
