// api/_utils/shadowAssemblyCapture.js
//
// Archetype Architecture Phase 2 (P2.6) — shadow assembly + behavior-record
// envelope plumbing. NON-FENCED module riding the agent-evaluate tick; DARK
// behind SHADOW_ASSEMBLY_ENABLED=false (the wiring never calls in here when
// the flag is false — zero reads, zero writes, byte-identical ticks).
//
// Spec DR-10 stage 1 (assembly shadow — structural, NO LLM call):
//   Per battle per tick, build the manifest-derived prompt pair by calling
//   the EXISTING EXPORTED fenced builders (buildEvalSystemPrompt /
//   buildLiveContextBlock — reading/calling fenced exports is permitted,
//   BUILD_RULES §1; zero fenced edits) twice: once with the live
//   agentContext-shaped battle, once with a manifest-overlaid view. Diff,
//   then write the diff DURABLY and AWAITED to
//   agentBattles/{battleId}/shadowDiffs/{tickId} — the P2.0-approved home,
//   on the captureSwapReceipt pattern (create-only, deterministic id, loud
//   failure, never throws into the tick) and NEVER the fire-and-forget
//   shadowLogger (Signal Capture Rider §5).
//
// Payload discipline (founder-ruled at P2.0 approval #4): identical prompts
// → hashes + identical:true (small steady-state doc); divergence → hashes +
// both full texts + line hunks (full evidence).
//
// A-1 envelope: assembled ONCE per battle per tick and stamped on every
// record the tick emits (gate aggregate, terminal-gate record, settlement
// record). CAPTURE REQUIRES THE MANIFEST: the envelope is manifest-anchored
// (manifestId/manifestHash are its identity), so pre-manifest battles are
// skipped entirely — no envelope-less record ever exists (A-1
// no-grandfathering holds by construction).
//
// §6.3 records ride the existing finalUpdate write (the cronErrors "rides
// this finalUpdate — no new write op" precedent), capped with an explicit
// droppedCount — never silent truncation.

import {
  buildEvalSystemPrompt,
  buildAgentIdentityBlock,
  buildLiveContextBlock,
} from './agentEvalPromptAssembly.js';
import {
  ENVELOPE_SCHEMA_VERSION,
  validateBehaviorRecordEnvelope,
} from './archetypeBuildSchemas.js';
import {
  CALIBRATION_BUNDLE_VERSION,
  PROMPT_SPEC_VERSION,
  GUARDRAIL_SET_VERSION,
  GAME_MODE_POLICY_VERSION,
} from './archetypeVersionConstants.js';
import { KNOB_CONFIG_VERSION } from './agentArchetypeConfig.js';
import { EMERGENCY_BYPASS_REASONS, USER_DIRECTIVE_BYPASS_REASONS } from './agentRiskManager.js';
import { TEMPO_DIAL_BANDS } from './tempoDialBands.js';
import { canonicalContentHash } from './canonicalHash.js';

// §6.3 gate vocabulary (review finding): statusFeed.citedRules carries BOTH
// deterministic gate tags (the engine's own reason arrays — census Map 6)
// AND the model's self-reported cited_rules on proposal/swap entries. The
// aggregate must count ONLY deterministic gates, so the tally filters to the
// closed engine vocabulary: the fenced EMERGENCY_BYPASS_REASONS set (by
// reference — single source) + the non-bypass gate tags the eval cron
// writes deterministically.
export const DETERMINISTIC_GATE_TAGS = new Set([
  ...EMERGENCY_BYPASS_REASONS,
  // Ask 3 (R2): the user-directive class is deterministic engine vocabulary
  // too — same by-reference single-source rule as the emergency set, so the
  // profit-target executor's citedRules tag tallies post-flip.
  ...USER_DIRECTIVE_BYPASS_REASONS,
  'stagnation',
  'swap_window_cap',
  'vwap_cascade_guard',
]);

const LOG_PREFIX = '[shadowAssembly]';

// §6.3 record caps on the battle doc (fullday battles see ≤~36 ticks; 64
// bounds pathological lifetimes; drops are counted, never silent).
const GATE_AGGREGATE_CAP = 64;
const TERMINAL_GATE_CAP = 64;

/**
 * A-1: the shared envelope, built once per battle per tick. Returns null
 * when the battle has no manifest (capture requires it — see header).
 */
export function buildBehaviorRecordEnvelope({ battle, cronStartIso, nowIso, modelId }) {
  const manifest = battle?.resolvedAgentManifest;
  if (!manifest?.manifestId || !manifest?.manifestHash) return null;
  return {
    envelopeSchemaVersion: ENVELOPE_SCHEMA_VERSION,
    manifestId: manifest.manifestId,
    manifestHash: manifest.manifestHash,
    versionsAtLock: manifest.versionStamps ?? {},
    effectiveRuntimeResolution: {
      calibrationBundleVersion: CALIBRATION_BUNDLE_VERSION,
      knobConfigVersion: KNOB_CONFIG_VERSION,
      dialBandVersion: TEMPO_DIAL_BANDS.forKnobConfigVersion,
      modelId: modelId ?? null,
      promptSpecVersion: PROMPT_SPEC_VERSION,
      guardrailSetVersion: GUARDRAIL_SET_VERSION,
      gameModePolicyVersion: GAME_MODE_POLICY_VERSION,
      // Control-epoch telemetry precedent: the commit SHA is already
      // available at the tick; captured null when the platform doesn't
      // inject it (never invented).
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
    tickId: `${cronStartIso}_${battle.id}`,
    evaluatedAt: nowIso,
  };
}

/** Minimal line-hunk diff — enough to localize divergence, not a full LCS. */
export function diffPromptTexts(liveText, shadowText) {
  if (liveText === shadowText) return { identical: true, hunks: [] };
  const liveLines = String(liveText).split('\n');
  const shadowLines = String(shadowText).split('\n');
  const max = Math.max(liveLines.length, shadowLines.length);
  const hunks = [];
  for (let i = 0; i < max && hunks.length < 200; i++) {
    if (liveLines[i] !== shadowLines[i]) {
      hunks.push({ line: i + 1, live: liveLines[i] ?? null, shadow: shadowLines[i] ?? null });
    }
  }
  return { identical: false, hunks };
}

/**
 * The manifest-overlaid battle view: agentContext fields replaced by the
 * manifest's frozen layers + valuesAtLock. Shallow, never mutates the live
 * battle object.
 */
export function manifestDerivedBattleView(battle) {
  const m = battle.resolvedAgentManifest;
  return {
    ...battle,
    agentContext: {
      ...battle.agentContext,
      agentName: m.valuesAtLock?.agentName ?? battle.agentContext?.agentName,
      archetype: m.valuesAtLock?.archetype ?? battle.agentContext?.archetype,
      activeRules: m.frozenLayers?.activeRules ?? [],
      equippedBundleIds: m.frozenLayers?.equippedBundleIds ?? [],
      deployedGuardrails: m.frozenLayers?.deployedGuardrails ?? [],
      equippedWatchlist: m.frozenLayers?.equippedWatchlist ?? null,
      standingLeans: m.frozenLayers?.standingLeans ?? [],
      standingLeansInvalidated: m.frozenLayers?.standingLeansInvalidated ?? [],
      dials: m.frozenLayers?.dials ?? null,
      settingsRev: m.versionStamps?.settingsRevAtLock,
      riskTolerance: m.valuesAtLock?.riskTolerance ?? battle.agentContext?.riskTolerance,
    },
  };
}

/**
 * DR-10 stage 1: assemble both prompt pairs via the exported fenced
 * builders, diff, and return the shadowDiffs doc body. No LLM call.
 */
export async function buildShadowDiffRecord({ battle, envelope, market }) {
  const { prices, macroPrices, assetScores, triggers, news, momentumData, presetConfig } = market;
  const liveView = battle;
  const shadowView = manifestDerivedBattleView(battle);

  // The live Haiku call sends THREE parts (agent-evaluate.js): the system
  // prompt, the IDENTITY block (where FORGE RULES / leans render — the
  // frozen-content section), and the live-context block. All three are
  // assembled per view and diffed.
  // DR-13: each side threads its own RAW archetype code-id as the 4th arg,
  // mirroring the live call (agent-evaluate.js) — once
  // EVAL_IDENTITY_BLOCK_ENABLED lights, captured prompts must carry the
  // identity block exactly as production does, per view.
  const liveSystem = buildEvalSystemPrompt(
    liveView.agentContext?.agentName || 'Agent',
    liveView.agentContext?.archetype || 'unknown',
    battle.gameMode,
    liveView.agentContext?.archetype
  );
  const shadowSystem = buildEvalSystemPrompt(
    shadowView.agentContext.agentName || 'Agent',
    shadowView.agentContext.archetype || 'unknown',
    battle.gameMode,
    shadowView.agentContext.archetype
  );
  const liveIdentity = buildAgentIdentityBlock(liveView);
  const shadowIdentity = buildAgentIdentityBlock(shadowView);
  const liveContext = await buildLiveContextBlock(
    liveView, prices, macroPrices, assetScores, triggers, news,
    liveView.evaluations, momentumData, presetConfig
  );
  const shadowContext = await buildLiveContextBlock(
    shadowView, prices, macroPrices, assetScores, triggers, news,
    liveView.evaluations, momentumData, presetConfig
  );

  const systemDiff = diffPromptTexts(liveSystem, shadowSystem);
  const identityDiff = diffPromptTexts(liveIdentity, shadowIdentity);
  const contextDiff = diffPromptTexts(liveContext, shadowContext);
  const identical = systemDiff.identical && identityDiff.identical && contextDiff.identical;

  // Rendered rule ids per side (review finding): the DR-10 stage-2 citation
  // measure needs to know which rules each prompt variant actually rendered;
  // small and steady-state-safe, so recorded on every diff doc.
  const ruleIdOf = (r) => r?.ruleId ?? r?.id ?? null;
  const renderedRuleIds = {
    live: (liveView.agentContext?.activeRules ?? []).map(ruleIdOf).filter(Boolean),
    shadow: (shadowView.agentContext.activeRules ?? []).map(ruleIdOf).filter(Boolean),
  };

  return {
    envelope,
    identical,
    renderedRuleIds,
    hashes: {
      liveSystem: canonicalContentHash(liveSystem),
      shadowSystem: canonicalContentHash(shadowSystem),
      liveIdentity: canonicalContentHash(liveIdentity),
      shadowIdentity: canonicalContentHash(shadowIdentity),
      liveContext: canonicalContentHash(liveContext),
      shadowContext: canonicalContentHash(shadowContext),
    },
    sizes: {
      liveSystem: liveSystem.length,
      shadowSystem: shadowSystem.length,
      liveIdentity: liveIdentity.length,
      shadowIdentity: shadowIdentity.length,
      liveContext: liveContext.length,
      shadowContext: shadowContext.length,
    },
    // Founder-ruled payload discipline: full texts ONLY on divergence.
    ...(identical ? {} : {
      systemHunks: systemDiff.hunks,
      identityHunks: identityDiff.hunks,
      contextHunks: contextDiff.hunks,
      texts: {
        liveSystem, shadowSystem, liveIdentity, shadowIdentity, liveContext, shadowContext,
      },
    }),
  };
}

/**
 * Awaited, create-only shadow-diff write (captureSwapReceipt pattern:
 * deterministic id, .create() so a duplicate tick is a LOUD refusal never a
 * silent overwrite, failures logged non-silently, never throws into the
 * tick). Returns { written, reason? }.
 */
export async function writeShadowDiff(db, battleId, tickId, record) {
  const ref = db
    .collection('agentBattles')
    .doc(battleId)
    .collection('shadowDiffs')
    .doc(tickId);
  try {
    await ref.create(record);
    return { written: true };
  } catch (err) {
    const alreadyExists = err?.code === 6 || /already[_ ]?exists/i.test(String(err?.message ?? err));
    if (alreadyExists) {
      console.warn(`${LOG_PREFIX} DUPLICATE shadowDiff ${battleId}/${tickId} REFUSED (create-only; corpus protected)`);
      return { written: false, reason: 'duplicate' };
    }
    console.error(`${LOG_PREFIX} shadowDiff write FAILED for ${battleId}/${tickId}: ${err?.message}`);
    return { written: false, reason: 'write_error' };
  }
}

/**
 * §6.3 gate-tag counts derived from THIS tick's own statusFeed entries,
 * filtered to the DETERMINISTIC_GATE_TAGS vocabulary — LLM self-reported
 * citations never count as gate activity (model_self_report is excluded
 * from proof metrics by class, R1 finding 18).
 */
export function countBlockedGates(statusFeedEntries) {
  const counts = {};
  for (const entry of statusFeedEntries ?? []) {
    for (const tag of entry?.citedRules ?? []) {
      if (typeof tag === 'string' && DETERMINISTIC_GATE_TAGS.has(tag)) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
  }
  return counts;
}

/**
 * §6.3 terminal-gate resolution from the tick's in-scope outcome.
 *
 * `post_decision_downgrade` reads the proposed symbols from `haikuResult` — the
 * MODEL's own output — never from `evaluation`. The evaluation record nulls
 * symbolOut/symbolIn whenever the decision is not SWAP/PROPOSAL
 * (agent-evaluate.js:2630, :2634-2635), and a downgrade sets decision='HOLD'
 * BEFORE that record is built, so `evaluation` is null/null on exactly the
 * ticks this gate exists to describe. Reading it there recorded the downgrade
 * and lost the thing being downgraded.
 *
 * The seven downgrade sites (agent-evaluate.js:2129, :2144, :2152, :2163,
 * :2217, :2223, :2465) all leave haikuResult holding the model's proposal —
 * the guardrail path only rewrites it on the forced-SWAP branch (:2116-2124),
 * never on the HOLD branch — so haikuResult is the honest source.
 *
 * `evaluation` stays as a fallback for a caller that has no haikuResult; it
 * contributes nothing in production, where it is always nulled by then.
 */
export function resolveTerminalGate({ decision, haikuFailure, downgraded, evaluation, haikuResult }) {
  if (decision !== 'HOLD') return null; // an action tick has no terminal gate
  if (haikuFailure) {
    return { terminalGate: `transport_${haikuFailure.failureClass}`, reason: haikuFailure.message ?? null };
  }
  if (downgraded) {
    return {
      terminalGate: 'post_decision_downgrade',
      proposedAction: {
        symbolOut: haikuResult?.symbolOut ?? evaluation?.symbolOut ?? null,
        symbolIn: haikuResult?.symbolIn ?? evaluation?.symbolIn ?? null,
      },
      reason: 'proposed swap downgraded to HOLD by a deterministic gate',
    };
  }
  return { terminalGate: 'haiku_hold_decision', reason: 'model chose HOLD' };
}

function cappedAppend(existing, entry, cap) {
  const arr = [...(existing || []), entry];
  const dropped = Math.max(0, arr.length - cap);
  const kept = arr.slice(-cap);
  if (dropped > 0 && kept.length > 0) {
    kept[0] = { ...kept[0], droppedBefore: (kept[0].droppedBefore || 0) + dropped };
  }
  return kept;
}

/**
 * The per-tick capture: called ONCE per battle per tick from the
 * agent-evaluate finalUpdate site when SHADOW_ASSEMBLY_ENABLED. Builds the
 * envelope, writes the shadow diff (awaited), and stamps the §6.3 gate
 * aggregate (+ terminal-gate record on a final non-action) onto the
 * finalUpdate object (rides the existing write — no new write op for the
 * aggregates). NEVER throws into the tick; every failure is loud.
 */
export async function runShadowTickCapture({ db, battle, finalUpdate, tick }) {
  try {
    const envelope = buildBehaviorRecordEnvelope({
      battle,
      cronStartIso: tick.cronStartIso,
      nowIso: tick.nowIso,
      modelId: tick.modelId,
    });
    if (!envelope) {
      console.log(`${LOG_PREFIX} battle ${battle.id} has no manifest — capture skipped (pre-manifest battle)`);
      return { captured: false, reason: 'no_manifest' };
    }
    const envelopeCheck = validateBehaviorRecordEnvelope(envelope);
    if (!envelopeCheck.valid) {
      console.error(`${LOG_PREFIX} envelope invalid for ${battle.id}: ${envelopeCheck.errors.join('; ')} — capture skipped`);
      return { captured: false, reason: 'envelope_invalid' };
    }

    const diffRecord = await buildShadowDiffRecord({ battle, envelope, market: tick.market });
    const diffOutcome = await writeShadowDiff(db, battle.id, envelope.tickId, diffRecord);

    const aggregate = {
      envelope,
      candidatesTested: tick.candidatesTested ?? null,
      blockedCountsByGate: countBlockedGates(tick.statusFeedEntries),
      samplingMeta: 'none',
    };
    finalUpdate.shadowGateAggregates = cappedAppend(battle.shadowGateAggregates, aggregate, GATE_AGGREGATE_CAP);

    const terminal = resolveTerminalGate(tick);
    if (terminal) {
      finalUpdate.shadowTerminalGates = cappedAppend(
        battle.shadowTerminalGates,
        { envelope, ...terminal },
        TERMINAL_GATE_CAP
      );
    }
    return { captured: true, diffWritten: diffOutcome.written, identical: diffRecord.identical };
  } catch (err) {
    console.error(`${LOG_PREFIX} tick capture FAILED for battle ${battle?.id}: ${err?.message}`);
    return { captured: false, reason: 'capture_error' };
  }
}

/**
 * §6.4 settlement record — attempted from completeBattle's POST-COMMIT block
 * (the runAwardTransaction own-transaction precedent), awaited, with the
 * idempotent retry marker. The terminal transaction stamps
 * receiptCoverage:'pending' (flag-gated, manifest battles only); this writer
 * flips it to 'complete' on success and leaves 'pending' on failure — the
 * marker IS the retry signal, and absence-of-record is distinguishable from
 * zero events (§6.4). tickId here is the settlement invocation id
 * (completion instant + battleId — completeBattle has no cron-start in
 * scope; documented deviation, stable per invocation).
 */
export async function writeBattleSettlementRecord(db, { freshBattle, completedAtIso, modelId }) {
  try {
    const envelope = buildBehaviorRecordEnvelope({
      battle: freshBattle,
      cronStartIso: completedAtIso,
      nowIso: completedAtIso,
      modelId: modelId ?? null,
    });
    if (!envelope) return { written: false, reason: 'no_manifest' };

    const exitReasonCounts = {};
    for (const t of freshBattle.trades ?? []) {
      const reason = t?.exitReason || 'unknown';
      exitReasonCounts[reason] = (exitReasonCounts[reason] || 0) + 1;
    }

    const record = {
      envelope,
      battleId: freshBattle.id,
      agentId: freshBattle.agentId ?? null,
      ownerId: freshBattle.ownerId ?? null,
      gameMode: freshBattle.gameMode ?? null,
      completionReason: freshBattle.completionReason ?? null,
      finalScoreState: freshBattle.scoreState ?? null,
      deterministicEventTotals: {
        tradeCount: (freshBattle.trades ?? []).length,
        exitReasonCounts,
        evaluationCount: (freshBattle.evaluations ?? []).length,
        gateAggregateTicks: (freshBattle.shadowGateAggregates ?? []).length,
        terminalGateRecords: (freshBattle.shadowTerminalGates ?? []).length,
      },
      coverageStats: {
        statusFeedEntries: (freshBattle.statusFeed ?? []).length,
        // Mirrors the live cap rule (agent-evaluate.js STATUS_FEED_CAP:
        // agent battles 100, else 50 — review finding: a flat 50 falsely
        // reported truncation for agent battles with 50-99 entries). The
        // assumed cap is recorded so the consumer can audit the claim.
        statusFeedCapAssumed: freshBattle.agentId ? 100 : 50,
        statusFeedCapped:
          (freshBattle.statusFeed ?? []).length >= (freshBattle.agentId ? 100 : 50),
      },
      settledAt: completedAtIso,
      retryMarker: { attempt: 1, lastAttemptAt: completedAtIso },
    };

    const ref = db.collection('battleSettlements').doc(freshBattle.id);
    // create-only: a racer's record survives; ours becomes the loud no-op.
    try {
      await ref.create(record);
    } catch (err) {
      const alreadyExists = err?.code === 6 || /already[_ ]?exists/i.test(String(err?.message ?? err));
      if (!alreadyExists) throw err;
      console.warn(`${LOG_PREFIX} settlement record ${freshBattle.id} already exists (racer won; coverage stamp proceeds)`);
    }
    await db.collection('agentBattles').doc(freshBattle.id).update({ receiptCoverage: 'complete' });
    return { written: true };
  } catch (err) {
    console.error(`${LOG_PREFIX} settlement record FAILED for ${freshBattle?.id} (receiptCoverage stays 'pending' — the retry marker): ${err?.message}`);
    return { written: false, reason: 'write_error' };
  }
}
