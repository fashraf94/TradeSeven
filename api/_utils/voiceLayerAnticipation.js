// api/_utils/voiceLayerAnticipation.js
//
// Phase 3 Voice Layer Rework — Anticipation.
//
// Generates Gemma's coach-dominant pre-action message after Haiku's
// structured output includes one or more entries in
// anticipationCandidates. Each candidate produces ONE message. Wraps
// everything in a single try/catch so the cron is NEVER blocked by a
// Voice Layer failure — a failed anticipation leaves no chat message
// (acceptable degradation), and the trading decision is unaffected.
// Logs every failure step for post-deploy diagnostics.
//
// One call site today (api/cron/agent-evaluate.js), dispatched from the
// finally block of processAgentBattle after the trade-narration batch
// has been awaited.
//
// Distinguished from trade narration:
//   - Anticipation is PRE-action (watching). Trade narration is POST-action (reporting).
//   - Anticipation writes ONLY to chatExchanges. Trade narration writes to chatExchanges + statusFeed.
//   - Anticipation does NOT fire the command dot (no statusFeed entry).
//   - Anticipation does NOT consume chatBudgetUsed (agent-initiated message).
//
// See FANTASYTRADES_VOICE_LAYER_PHASE_3_SPEC.

import { FieldValue } from 'firebase-admin/firestore';
import { callGemmaVoiceWithRetry, parseVoiceLayerResponse } from './gemmaClient.js';
import { logAnticipation } from './shadowLogger.js';
import {
  buildAnticipationPrompt,
  getAgentPhase,
} from './voiceLayerPrompt.js';
import { TERM_TOKENS } from './termUniverse.js';
// Voice-layer grounding §5 — under 'on' for the battle's owner the note is
// composed by CODE from the decider's candidate: the event (symbol,
// direction, slot) and, lint permitting, the recorded signal. No model call.
import { getVoiceGroundingMode } from '../../src/config/featureFlags.js';
import { formatEtDate } from './tournamentTime.js';
import { etSlotTime } from '../../src/components/Dashboard/desk/deskCopy.js';
import {
  GROUNDING_VERSION,
  composeAnticipationNote,
  anticipationDedupeKey,
  passesReplyLint,
} from './voiceLayerGrounding.js';

// Failure modes (each logged but never thrown):
//   - read_context: fresh battle / agent / market / DRB / cache fetch failed,
//                   OR anticipationCandidate was missing at call time
//   - prompt_build: buildAnticipationPrompt threw
//   - gemma_call: callGemmaVoiceWithRetry returned success=false (transient
//                 retried once internally; this is the post-retry verdict)
//   - parse: parseVoiceLayerResponse returned parseError
//   - empty_response: parsed.response missing/non-string
//   - firestore_write: battleRef.update() failed
/**
 * Whether the doc already carries a note for this (symbol, direction) on this
 * ET day (hazard 27) — the per-candidate pass, keyed with formatEtDate, never
 * a UTC slice. Exported for its own rows.
 */
export function anticipationAlreadyNoted(chatExchanges, { symbol, direction, etDay }) {
  if (!Array.isArray(chatExchanges)) return false;
  const key = anticipationDedupeKey(symbol, direction, etDay);
  return chatExchanges.some((ex) => {
    if (!ex || ex.messageType !== 'anticipation' || !ex.anticipationContext) return false;
    const ts = ex.timestamp?.toDate?.() ?? (ex.timestamp ? new Date(ex.timestamp) : null);
    if (!ts || Number.isNaN(ts.getTime())) return false;
    return anticipationDedupeKey(ex.anticipationContext.symbol, ex.anticipationContext.direction ?? null, formatEtDate(ts)) === key;
  });
}

// The grounded write (spec §5). Reads nothing beyond the battle the caller
// already fetched; writes ONE exchange or nothing. Throws only on the
// Firestore write, which the caller's catch logs like every other step.
async function composeGroundedAnticipation({ battleRef, battle, battleId, agentId, anticipationCandidate, evalId }) {
  const now = new Date();
  const symbol = anticipationCandidate.symbol;
  const direction = anticipationCandidate.direction || null;
  const etDay = formatEtDate(now);

  if (anticipationAlreadyNoted(battle.chatExchanges, { symbol, direction, etDay })) {
    logAnticipation({
      agentId: agentId || null,
      battleId,
      anticipationSource: 'haiku',
      composed: 'code',
      success: false,
      errorStep: 'grounding_dedupe',
      errorReason: `already_noted_${etDay}`,
      candidate: { symbol, direction, signalSummary: anticipationCandidate.signalSummary || null, threshold: anticipationCandidate.threshold || null },
      evalId: evalId || null,
    }).catch(() => {});
    return;
  }

  // The check's slot (D-83), from the evaluation entry this candidate rode in
  // on; the dispatch instant's slot when the entry is not on the doc yet.
  const evaluation = Array.isArray(battle.evaluations) && evalId
    ? battle.evaluations.find((e) => e && e.evalId === evalId) || null
    : null;
  const slot = etSlotTime(evaluation?.timestamp ?? now.toISOString());
  const signalSummary = typeof anticipationCandidate.signalSummary === 'string' ? anticipationCandidate.signalSummary : null;
  const agentMessage = composeAnticipationNote({ symbol, direction, slot, signalSummary });

  const exchange = {
    userMessage: null,
    agentResponse: agentMessage,
    scratchpad: null,
    hasDirective: false,
    directive: null,
    suggestedActions: null,
    elicitationTarget: 'anticipation',
    timestamp: now.toISOString(),
    mode: 'battle',
    messageType: 'anticipation',
    anticipationSource: 'haiku',
    // §3.4 (M3): the top-level marker every grounded exchange carries.
    groundingVersion: GROUNDING_VERSION,
    // §5: provenance only — no `threshold`, no `signalSummary` (the clause is
    // in the text, lint permitting); the slot the pane's eyebrows can name.
    anticipationContext: {
      symbol,
      direction,
      evaluationId: evalId || null,
      slot,
    },
  };

  await battleRef.update({ chatExchanges: FieldValue.arrayUnion(exchange) });

  logAnticipation({
    agentId: agentId || null,
    battleId,
    archetype: battle.agentContext?.archetype || null,
    executionMode: battle.executionMode || 'autopilot',
    anticipationSource: 'haiku',
    composed: 'code',
    systemPrompt: null,
    rawResponse: null,
    parsed: { response: agentMessage, scratchpad: null },
    exchange,
    candidate: {
      symbol,
      direction,
      signalSummary: anticipationCandidate.signalSummary || null,
      threshold: anticipationCandidate.threshold || null,
      signalSource: anticipationCandidate.signalSource || null,
    },
    signalClauseDropped: Boolean(signalSummary && signalSummary.trim() && !passesReplyLint(signalSummary)),
    evalId: evalId || null,
    success: true,
  }).catch(() => {});
}

export async function generateAnticipation({
  db,
  battleId,
  agentId,
  anticipationCandidate,
  evalId,
  // The battle owner's uid, when the caller has it (agent-evaluate.js does):
  // lets the grounding gate answer before the four context reads the model
  // path needs. Absent, the gate answers after the battle read.
  ownerId = null,
}) {
  let errorStep = null;
  let errorReason = null;
  let systemPrompt = null;
  let rawResponse = null;
  let parsed = null;

  try {
    if (
      !anticipationCandidate ||
      typeof anticipationCandidate !== 'object' ||
      !anticipationCandidate.symbol
    ) {
      errorStep = 'read_context';
      errorReason = 'anticipation_candidate_missing_or_invalid';
      throw new Error('generateAnticipation called without a valid anticipationCandidate');
    }

    const battleRef = db.collection('agentBattles').doc(battleId);

    // Voice-layer grounding §5 — decided from the owner when the caller passed
    // it: the grounded note needs the battle doc only (the slot, the dedupe
    // pass), never the agent / market / DRB / cache reads or the model.
    const groundedByOwner = ownerId ? getVoiceGroundingMode(ownerId) === 'on' : null;
    if (groundedByOwner === true) {
      let battleDocSnap;
      try {
        battleDocSnap = await battleRef.get();
      } catch (err) {
        errorStep = 'read_context';
        errorReason = err.message;
        throw err;
      }
      if (!battleDocSnap.exists) {
        errorStep = 'read_context';
        errorReason = 'battle_not_found';
        throw new Error(`Battle ${battleId} not found at anticipation time`);
      }
      const groundedBattle = battleDocSnap.data();
      groundedBattle.id = battleDocSnap.id;
      errorStep = 'firestore_write';
      await composeGroundedAnticipation({ battleRef, battle: groundedBattle, battleId, agentId, anticipationCandidate, evalId });
      return;
    }

    // Parallel fetch — fresh battle, agent doc, market context, DRB,
    // voice-layer cache. Same five sources as trade narration so the
    // anticipation prompt has the same MIDDLE-block content quality.
    let battle, agentData = null, anchorContext = null, marketSnapshot = null;
    try {
      const today = new Date().toISOString().split('T')[0];
      const agentRef = agentId ? db.collection('agents').doc(agentId) : null;
      const [battleDocSnap, agentDocSnap, marketCtxDoc, drbDoc, cacheDoc] = await Promise.all([
        battleRef.get(),
        agentRef ? agentRef.get() : Promise.resolve(null),
        db.collection('indexIntelligence').doc('marketContext').get(),
        db.collection('indexIntelligence').doc('dailyRegimeBrief').get(),
        db.collection('voiceLayerCache').doc(battleId).get(),
      ]);

      if (!battleDocSnap.exists) {
        errorStep = 'read_context';
        errorReason = 'battle_not_found';
        throw new Error(`Battle ${battleId} not found at anticipation time`);
      }
      battle = battleDocSnap.data();
      battle.id = battleDocSnap.id;

      if (agentDocSnap && agentDocSnap.exists) {
        agentData = agentDocSnap.data();
        agentData.id = agentDocSnap.id;
      }

      if (marketCtxDoc.exists) {
        const ctx = marketCtxDoc.data();
        const regimeLine = `Regime: ${ctx.regime}. ${ctx.regimeDetail || ''}`.trim();
        const drb = drbDoc.exists ? drbDoc.data() : null;
        const briefLine = drb && drb.forDate === today && typeof drb.dailyBrief === 'string'
          ? drb.dailyBrief
          : null;
        anchorContext = [regimeLine, briefLine].filter(Boolean).join(' ');
      }

      if (cacheDoc.exists) {
        marketSnapshot = cacheDoc.data();
      }
    } catch (err) {
      if (!errorStep) {
        errorStep = 'read_context';
        errorReason = err.message;
      }
      throw err;
    }

    // Voice-layer grounding §5 — the same gate, answered from the doc when the
    // caller did not pass the owner: still before any model call.
    if (groundedByOwner === null && getVoiceGroundingMode(battle.ownerId) === 'on') {
      errorStep = 'firestore_write';
      await composeGroundedAnticipation({ battleRef, battle, battleId, agentId, anticipationCandidate, evalId });
      return;
    }

    // Build the anticipation system prompt.
    try {
      systemPrompt = buildAnticipationPrompt({
        agent: agentData,
        battle,
        anchorContext,
        marketSnapshot,
        currentPhase: getAgentPhase(agentData?.stats?.gamesPlayed || 0),
        anticipationCandidate,
        directive: battle.directive || null,
        supportedTerms: TERM_TOKENS,
        executionMode: battle.executionMode || 'autopilot',
      });
    } catch (err) {
      errorStep = 'prompt_build';
      errorReason = err.message;
      throw err;
    }

    // Call Gemma via the retry helper. Transient 429/5xx are retried once
    // internally; we cap total wall time at 10s (matching trade narration
    // post-Fix-#10). The dispatch site in agent-evaluate.js gates the
    // anticipation batch behind a cron-budget check that ensures at least
    // 12s of remaining cron budget before invoking, so this 10s timeout
    // fits comfortably inside the cron's 60s maxDuration.
    // '__ANTICIPATION__' is a kickoff sentinel for Gemma only — it is
    // never persisted to Firestore.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    let gemmaResult;
    try {
      gemmaResult = await callGemmaVoiceWithRetry({
        systemPrompt,
        conversationHistory: [],
        userMessage: '__ANTICIPATION__',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!gemmaResult?.success) {
      errorStep = 'gemma_call';
      errorReason = gemmaResult?.aborted ? 'timeout' : (gemmaResult?.error || 'unknown_gemma_failure');
      throw new Error(`Gemma call failed: ${errorReason}`);
    }
    rawResponse = gemmaResult.content;

    // Parse — parseVoiceLayerResponse never throws.
    parsed = parseVoiceLayerResponse(rawResponse);
    if (parsed?.parseError === true) {
      errorStep = 'parse';
      errorReason = `parse_${parsed.errorReason}`;
      throw new Error(`Voice Layer parse failed: ${parsed.errorReason}`);
    }

    const agentMessage = parsed?.response;
    if (!agentMessage || typeof agentMessage !== 'string') {
      errorStep = 'empty_response';
      errorReason = 'missing_or_invalid_response_field';
      throw new Error('Gemma returned empty or non-string response');
    }

    const cleanScratchpad = parsed._scratchpad
      ? String(parsed._scratchpad).slice(0, 2000).trim() || null
      : null;

    // Build the typed exchange per spec §4.5. anticipationSource is
    // reserved for forward-compatibility with the future Universe
    // Screener workstream — Phase 3 always uses 'haiku'.
    // anticipationContext links this message back to the specific
    // candidate for the Phase 4 (Film Room) anticipation→trade pairing
    // surface.
    const exchange = {
      userMessage: null,
      agentResponse: agentMessage,
      scratchpad: cleanScratchpad,
      hasDirective: false,
      directive: null,
      suggestedActions: null,
      elicitationTarget: 'anticipation',
      timestamp: new Date().toISOString(),
      mode: 'battle',
      messageType: 'anticipation',
      anticipationSource: 'haiku',
      anticipationContext: {
        symbol: anticipationCandidate.symbol,
        direction: anticipationCandidate.direction || null,
        threshold: anticipationCandidate.threshold || null,
        evaluationId: evalId || null,
      },
    };

    // Single Firestore update — chatExchanges ONLY. Anticipation
    // intentionally does NOT write to statusFeed (per spec §2 Decision 6
    // / §4.6): the command dot is reserved for trade narrations, where
    // urgency is warranted. Anticipation is the quietest of the three
    // proactive Voice Layer surfaces and earns its place by being
    // judicious. Does NOT touch chatBudgetUsed — agent-initiated
    // messages do not consume the user's 10-turn budget.
    try {
      await battleRef.update({
        chatExchanges: FieldValue.arrayUnion(exchange),
      });
    } catch (err) {
      errorStep = 'firestore_write';
      errorReason = err.message;
      throw err;
    }

    // Shadow log — success path.
    logAnticipation({
      agentId: agentData?.id || agentId || null,
      battleId,
      archetype: agentData?.archetype || null,
      phase: getAgentPhase(agentData?.stats?.gamesPlayed || 0),
      executionMode: battle.executionMode || 'autopilot',
      anticipationSource: 'haiku',
      systemPrompt,
      rawResponse,
      parsed: {
        response: agentMessage,
        scratchpad: cleanScratchpad,
      },
      exchange,
      candidate: {
        symbol: anticipationCandidate.symbol,
        direction: anticipationCandidate.direction || null,
        signalSummary: anticipationCandidate.signalSummary || null,
        threshold: anticipationCandidate.threshold || null,
        signalSource: anticipationCandidate.signalSource || null,
      },
      evalId: evalId || null,
      hadMarketSnapshot: !!marketSnapshot,
      hadAnchorContext: !!anchorContext,
      hadAgentData: !!agentData,
      success: true,
    }).catch(() => {});
  } catch (err) {
    console.error(
      `[VoiceLayer:anticipation] Failed at step=${errorStep || 'unknown'} battleId=${battleId} symbol=${anticipationCandidate?.symbol || 'unknown'}:`,
      err.message,
    );
    logAnticipation({
      agentId: agentId || null,
      battleId,
      anticipationSource: 'haiku',
      success: false,
      errorStep: errorStep || 'unknown',
      errorReason: errorReason || err.message,
      systemPrompt: systemPrompt ? String(systemPrompt).slice(0, 4000) : null,
      rawResponse: rawResponse ? String(rawResponse).slice(0, 2000) : null,
      candidate: anticipationCandidate ? {
        symbol: anticipationCandidate.symbol || null,
        direction: anticipationCandidate.direction || null,
        signalSummary: anticipationCandidate.signalSummary || null,
        threshold: anticipationCandidate.threshold || null,
      } : null,
      evalId: evalId || null,
    }).catch(() => {});
    // Intentionally swallowed — the cron must not be blocked by a Voice
    // Layer failure. The trading decision committed; the user sees no
    // anticipation chat message for this candidate.
  }
}
