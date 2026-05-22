// api/_utils/voiceLayerTradeNarration.js
//
// Phase 2 Voice Layer Rework — Trade Narration.
//
// Generates Gemma's coach-dominant narration after every executed swap and
// writes it to the battle's chatExchanges + statusFeed. Wraps everything
// in a single try/catch so the cron is NEVER blocked by Voice Layer
// failure — a failed narration leaves the swap visible to the user with
// no chat message (acceptable degradation per spec §4.6). Logs every
// failure step for post-deploy diagnostics.
//
// Two call sites today (api/cron/agent-evaluate.js):
//   - Risk-triggered swap loop (~lines 621-685)
//   - Haiku autopilot swap branch (~lines 980-1027)
//
// Provenance is computed from closedTrade.evaluationId (via
// detectTradeProvenance) and drives the prompt's framing. A third call
// site will appear when co-pilot/manual modes return post-launch.
//
// See FANTASYTRADES_VOICE_LAYER_PHASE_2_SPEC.

import { FieldValue } from 'firebase-admin/firestore';
import { callGemmaVoiceWithRetry, parseVoiceLayerResponse } from './gemmaClient.js';
import { logTradeNarration } from './shadowLogger.js';
import {
  buildTradeNarrationPrompt,
  detectTradeProvenance,
  getAgentPhase,
} from './voiceLayerPrompt.js';

// Failure modes (each logged but never thrown):
//   - read_context: fresh battle / agent / market / DRB / cache fetch failed,
//                   OR closedTrade was missing at call time
//   - prompt_build: buildTradeNarrationPrompt threw
//   - gemma_call: callGemmaVoiceWithRetry returned success=false (transient
//                 retried once internally; this is the post-retry verdict)
//   - parse: parseVoiceLayerResponse returned parseError
//   - empty_response: parsed.response missing/non-string
//   - firestore_write: battleRef.update() failed
export async function generateTradeNarration({
  db,
  battleId,
  agentId,
  closedTrade,
  evalId, // eslint-disable-line no-unused-vars -- captured in shadow log for cross-reference; not required by the prompt
}) {
  let errorStep = null;
  let errorReason = null;
  let systemPrompt = null;
  let rawResponse = null;
  let parsed = null;
  let provenance = null;

  try {
    if (!closedTrade || typeof closedTrade !== 'object') {
      errorStep = 'read_context';
      errorReason = 'closedTrade_missing';
      throw new Error('generateTradeNarration called without a closedTrade');
    }

    const battleRef = db.collection('agentBattles').doc(battleId);

    // Parallel fetch — fresh battle (post-swap state), agent doc (for
    // partnerProfile/convictions/phase), market context, DRB, voice-layer
    // cache. By trade-narration time the cache cron has been running for
    // at least a few ticks, so marketSnapshot is usually populated.
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
        throw new Error(`Battle ${battleId} not found at narration time`);
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

    // Compute provenance from the closedTrade itself. autopilot or
    // risk_triggered today; co-pilot/manual values become relevant when
    // authority modes return post-launch.
    provenance = detectTradeProvenance(closedTrade, battle.proposalHistory || []);
    const rationale = typeof closedTrade.rationale === 'string'
      ? closedTrade.rationale
      : null;

    // Build the trade-narration system prompt.
    try {
      systemPrompt = buildTradeNarrationPrompt({
        agent: agentData,
        battle,
        anchorContext,
        marketSnapshot,
        currentPhase: getAgentPhase(agentData?.stats?.gamesPlayed || 0),
        swap: closedTrade,
        rationale,
        provenance,
        directive: battle.directive || null,
        executionMode: battle.executionMode || 'autopilot',
      });
    } catch (err) {
      errorStep = 'prompt_build';
      errorReason = err.message;
      throw err;
    }

    // Call Gemma via the retry helper. Transient 429/5xx are retried once
    // internally; we cap total wall time at 10s (vs Phase 1's 15s) to
    // keep multi-narration ticks inside the cron's 60s maxDuration when
    // the finally-block dispatch runs Promise.allSettled. The retry
    // helper never throws — it returns { success, content } or
    // { success: false, error }.
    // '__TRADE_NARRATION__' is a kickoff sentinel for Gemma only — it is
    // never persisted to Firestore.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    let gemmaResult;
    try {
      gemmaResult = await callGemmaVoiceWithRetry({
        systemPrompt,
        conversationHistory: [],
        userMessage: '__TRADE_NARRATION__',
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

    // Build the typed exchange + statusFeed entry per spec §4.4 / §4.5.
    // tradeContext links the narration back to the specific swap for the
    // Phase 4 (Film Room) debrief view.
    const exchange = {
      userMessage: null,
      agentResponse: agentMessage,
      scratchpad: cleanScratchpad,
      hasDirective: false,
      directive: null,
      suggestedActions: null,
      elicitationTarget: 'trade_narration',
      timestamp: new Date().toISOString(),
      mode: 'battle',
      messageType: 'trade_narration',
      tradeContext: {
        symbolOut: closedTrade.symbolOut || null,
        symbolIn: closedTrade.symbolIn || null,
        tier: closedTrade.tier || null,
        swapTimestamp: closedTrade.swappedOutAt || null,
        evaluationId: closedTrade.evaluationId || null,
        provenance,
      },
    };

    const statusEntry = {
      action: 'trade_narration',
      source: 'voice_layer',
      message: 'Agent explained the latest trade.',
      timestamp: new Date().toISOString(),
      tradeContext: {
        symbolOut: closedTrade.symbolOut || null,
        symbolIn: closedTrade.symbolIn || null,
      },
    };

    // Single Firestore update — both writes land together so the
    // command-dot (driven by statusFeed.length growth) fires when the
    // chat content arrives. Does NOT touch chatBudgetUsed —
    // agent-initiated messages do not consume the user's 10-turn budget.
    try {
      await battleRef.update({
        chatExchanges: FieldValue.arrayUnion(exchange),
        statusFeed: FieldValue.arrayUnion(statusEntry),
      });
    } catch (err) {
      errorStep = 'firestore_write';
      errorReason = err.message;
      throw err;
    }

    // Shadow log — success path.
    logTradeNarration({
      agentId: agentData?.id || agentId || null,
      battleId,
      archetype: agentData?.archetype || null,
      phase: getAgentPhase(agentData?.stats?.gamesPlayed || 0),
      executionMode: battle.executionMode || 'autopilot',
      provenance,
      systemPrompt,
      rawResponse,
      parsed: {
        response: agentMessage,
        scratchpad: cleanScratchpad,
      },
      exchange,
      swap: {
        symbolOut: closedTrade.symbolOut,
        symbolIn: closedTrade.symbolIn,
        tier: closedTrade.tier,
        evaluationId: closedTrade.evaluationId,
        lockedPoints: closedTrade.lockedPoints,
        swappedOutAt: closedTrade.swappedOutAt,
      },
      rationale,
      hadMarketSnapshot: !!marketSnapshot,
      hadAnchorContext: !!anchorContext,
      hadAgentData: !!agentData,
      success: true,
    }).catch(() => {});
  } catch (err) {
    console.error(
      `[VoiceLayer:trade_narration] Failed at step=${errorStep || 'unknown'} battleId=${battleId}:`,
      err.message,
    );
    logTradeNarration({
      agentId: agentId || null,
      battleId,
      provenance,
      success: false,
      errorStep: errorStep || 'unknown',
      errorReason: errorReason || err.message,
      systemPrompt: systemPrompt ? String(systemPrompt).slice(0, 4000) : null,
      rawResponse: rawResponse ? String(rawResponse).slice(0, 2000) : null,
      swap: closedTrade ? {
        symbolOut: closedTrade.symbolOut,
        symbolIn: closedTrade.symbolIn,
        tier: closedTrade.tier,
        evaluationId: closedTrade.evaluationId,
      } : null,
    }).catch(() => {});
    // Intentionally swallowed — the cron must not be blocked by a Voice
    // Layer failure. The swap already committed; the user sees the trade
    // in their portfolio with no chat message.
  }
}
