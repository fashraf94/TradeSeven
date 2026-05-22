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

// Failure modes (each logged but never thrown):
//   - read_context: fresh battle / agent / market / DRB / cache fetch failed,
//                   OR anticipationCandidate was missing at call time
//   - prompt_build: buildAnticipationPrompt threw
//   - gemma_call: callGemmaVoiceWithRetry returned success=false (transient
//                 retried once internally; this is the post-retry verdict)
//   - parse: parseVoiceLayerResponse returned parseError
//   - empty_response: parsed.response missing/non-string
//   - firestore_write: battleRef.update() failed
export async function generateAnticipation({
  db,
  battleId,
  agentId,
  anticipationCandidate,
  evalId,
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
