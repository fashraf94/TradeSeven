import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { buildVoiceLayerPrompt } from '../_utils/voiceLayerPrompt.js';
import { callGemmaVoice, parseVoiceLayerResponse } from '../_utils/gemmaClient.js';
import { FieldValue } from 'firebase-admin/firestore';
import { logConversation } from '../_utils/shadowLogger.js';
import { getMarketState } from '../_utils/marketSchedule.js';
import { randomUUID } from 'node:crypto';
import { TOURNAMENT_GAME_MODE, TOURNAMENT_GROUPS_COLLECTION } from '../../src/constants/leagueTournament.js';
// Archetype Integrity — Phase E1 (the deterministic gate). Flag-gated; OFF/review
// run the literal legacy normalizeDirective path → byte-identical.
import { gateDirective, renderDirectiveStatus } from '../_utils/directiveGate.js';
import { getEffectiveArchetype } from '../_utils/directiveIdentity.js';
import { ARCHETYPE_INTEGRITY_MODE } from '../../src/config/featureFlags.js';
// Archetype Integrity — Phase E2 (capabilities manifest → USER LEVERS hand-off).
// Flag-gated, battle-only; the manifest is built only when the feature is ON.
import { buildCapabilitiesManifest } from '../_utils/agentCapabilitiesManifest.js';
import { getTournamentClaimWindow, formatEtDate } from '../_utils/tournamentTime.js';

export const config = { maxDuration: 30 };

// ==================== ELICITATION TARGET ====================

const ELICITATION_INSTRUCTIONS = {
  risk_appetite: "Create an opening for the user to reveal their comfort with risk. Present options that range from safe to aggressive.",
  concentration_tolerance: "Present a concentrated vs diversified choice. The user's preference reveals their position-sizing philosophy.",
  sector_convictions: "Mention 2-3 different sectors in your options. Note which sector the user gravitates toward or avoids.",
  loss_reaction: "Reference a position that's losing. The user's response reveals whether they cut or hold.",
  win_reaction: "Reference a position that's winning. The user's response reveals whether they take profit or let it ride.",
  tier_philosophy: "Frame a decision around tier placement. Which tier the user prioritizes reveals their scoring strategy.",
  momentum_vs_value: "Present a momentum play alongside a value/contrarian play. The user's choice reveals their market philosophy.",
  news_sensitivity: "Reference a news catalyst. Whether the user engages or dismisses it reveals their news sensitivity.",
  time_of_day_preference: "Include a time element in your options (e.g., 'act now at open' vs 'wait for confirmation'). Reveals urgency preference.",
  macro_awareness: "Mention a macro factor (regime, yields, breadth). Whether the user engages or ignores reveals their macro awareness.",
  communication_frequency: "Note whether the user seems to want more or less detail in your updates.",
  autonomy_preference: "Present a decision the agent could make independently. Whether the user engages or defers reveals autonomy preference.",
  feedback_style: "Pay attention to HOW the user responds — do they explain their reasoning or just give a direction?",
  competitive_focus: "Reference the score differential. Whether the user focuses on the opponent or their own portfolio reveals competitive focus.",
  learning_orientation: "Include a brief educational note. Whether the user engages with it reveals learning orientation.",
};

const DIMENSIONS = [
  'risk_appetite', 'concentration_tolerance', 'sector_convictions',
  'loss_reaction', 'win_reaction', 'tier_philosophy', 'momentum_vs_value',
  'news_sensitivity', 'time_of_day_preference', 'macro_awareness',
  'communication_frequency', 'autonomy_preference', 'feedback_style',
  'competitive_focus', 'learning_orientation',
];

function selectElicitationTarget(partnerProfile, recentTargets = []) {
  const candidates = DIMENSIONS
    .filter(d => !recentTargets.includes(d))
    .map(d => ({
      dimension: d,
      confidence: partnerProfile?.[d]?.confidence ?? 0,
    }))
    .sort((a, b) => a.confidence - b.confidence);

  const target = candidates[0] || { dimension: DIMENSIONS[0] };

  return {
    dimension: target.dimension,
    instruction: ELICITATION_INSTRUCTIONS[target.dimension],
  };
}

// ==================== RESPONSE SANITIZERS ====================

const ELICITATION_DIMENSIONS = /(?:risk_appetite|concentration_tolerance|sector_convictions?|loss_reaction|win_reaction|tier_philosophy|momentum_vs_value|news_sensitivity|time_of_day_preference|macro_awareness|communication_frequency|autonomy_preference|feedback_style|competitive_focus|learning_orientation)/gi;

function sanitizeScratchpad(raw) {
  if (!raw) return null;
  return raw
    .replace(/Server target[\s:]+(?:was\s+)?[\w_]+/gi, '')
    .replace(/target was [\w_]+/gi, '')
    .replace(/Elicitation target[:\s]?[^.]+\./gi, '')
    .replace(/Target this turn[:\s]?[^.]+\./gi, '')
    .replace(ELICITATION_DIMENSIONS, '[internal]')
    .replace(/\s{2,}/g, ' ')
    .trim() || null;
}

function normalizeDirective(parsed) {
  if (parsed.directive && typeof parsed.directive === 'object' && parsed.directive.text) {
    return { text: parsed.directive.text, expiry: parsed.directive.expiry || 'end_of_battle' };
  }
  if (parsed.directive && typeof parsed.directive === 'string') {
    return { text: parsed.directive, expiry: 'end_of_battle' };
  }
  return null;
}

// ==================== MODE DETECTION ====================

// States from getMarketState(): OPEN, PRE_MARKET, CLOSED_AFTERHOURS,
// CLOSED_WEEKEND, CLOSED_HOLIDAY. Review mode is valid only when the market
// is unambiguously closed for new trading (not pre-market).
const CLOSED_STATES = new Set(['CLOSED_AFTERHOURS', 'CLOSED_WEEKEND', 'CLOSED_HOLIDAY']);

function isReviewForToday(review) {
  if (!review || typeof review !== 'object') return false;

  // Prefer an explicit trading-day string if the cron writes one.
  const dateField = review.tradingDay || review.date;
  if (dateField && typeof dateField === 'string') {
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    return dateField === todayET;
  }

  // Fall back to createdAt recency (within last 20h — covers overnight review runs).
  const raw = review.createdAt;
  let ts = null;
  if (typeof raw === 'string') ts = new Date(raw).getTime();
  else if (raw && typeof raw.toMillis === 'function') ts = raw.toMillis();
  else if (raw && typeof raw.seconds === 'number') ts = raw.seconds * 1000;
  if (ts == null || Number.isNaN(ts)) return false;

  return (Date.now() - ts) < 20 * 60 * 60 * 1000;
}

function detectMode(battle) {
  const marketState = getMarketState();
  const isMarketClosed = CLOSED_STATES.has(marketState.state);
  if (!isMarketClosed) return 'battle';

  const reviews = Array.isArray(battle?.dailyReviews) ? battle.dailyReviews : [];
  const latestReview = reviews.length > 0 ? reviews[reviews.length - 1] : null;
  return isReviewForToday(latestReview) ? 'review' : 'battle';
}

const MODE_BUDGET = {
  battle: { field: 'chatBudgetUsed', limit: 10 },
  review: { field: 'reviewBudgetUsed', limit: 5 },
};

// ==================== HANDLER ====================

export default async function handler(req, res) {
  // Turn deadline anchor (Phase E1). Stamped at invocation so the gate's repair
  // budget is measured against true elapsed time vs maxDuration:30 — 24s leaves
  // ~6s headroom for the awaited Firestore writes after the gate returns.
  const turnStartMs = Date.now();

  // 1. Security middleware
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 10, windowMs: 60000 } })) {
    return;
  }

  // 2. Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 3. Auth
  const user = await requireAuth(req, res);
  if (!user) return;

  // 4. Validate body
  const { agentId, battleId, message } = req.body;
  const requestedMode = req.body.mode;

  if (!agentId || !battleId || !message) {
    return res.status(400).json({ error: 'agentId, battleId, and message are required' });
  }

  // 5. Sanitize message
  const sanitizedMessage = String(message).slice(0, 2000).replace(/[\n\r\t]/g, ' ').replace(/[<>{}]/g, '').trim();

  if (!sanitizedMessage) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  const db = getFirebaseAdmin();

  try {
    // 6. Read battle doc
    const battleRef = db.collection('agentBattles').doc(battleId);
    const battleDoc = await battleRef.get();
    if (!battleDoc.exists) {
      return res.status(404).json({ error: 'Battle not found' });
    }
    const battle = battleDoc.data();

    // 7. Verify ownership
    if (battle.ownerId !== user.uid) {
      return res.status(403).json({ error: 'Not authorized to chat in this battle' });
    }

    // 8. Mode detection (with bounded client override)
    //     The client may force review mode (Film Room) on a completed battle
    //     during market hours, where auto-detection would return 'battle'.
    //     Only the 'review' override is honored — any other value (undefined,
    //     null, 'battle', invalid) falls through to auto-detection so battle
    //     mode remains authoritative for live play.
    let mode;
    if (requestedMode === 'review') {
      mode = 'review';
    } else {
      mode = detectMode(battle);
    }

    // 9. Battle status check (mode-aware: review mode is valid on completed battles)
    if (battle.status !== 'active' && mode !== 'review') {
      return res.status(400).json({
        error: 'battle_not_active',
        message: 'This battle has ended. Start a new battle to chat with your agent.',
      });
    }

    // 10. Read agent doc
    const agentDoc = await db.collection('agents').doc(agentId).get();
    if (!agentDoc.exists) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const agent = agentDoc.data();

    // 11. Budget check for selected mode
    const { field: budgetField, limit: budgetLimit } = MODE_BUDGET[mode];
    const currentBudget = battle[budgetField] || 0;

    if (currentBudget >= budgetLimit) {
      if (mode === 'review') {
        // New error shape for new mode — frontend (Phase 6) will consume this.
        return res.status(429).json({
          error: 'budget_exceeded',
          mode,
          message: "We've been through the tape thoroughly. Let's pick it back up tomorrow.",
        });
      }
      // Preserve existing battle-mode error shape for frontend backward compat.
      return res.status(403).json({
        error: 'chat_budget_exceeded',
        message: "We've had a solid session. Let's let things play out and regroup later.",
      });
    }

    // 11. Fetch market context for anchor + voiceLayerCache in parallel
    let anchorContext = null;
    let marketSnapshot = null;
    // Phase E2 — the user-capabilities manifest (consumed only by the flag-gated,
    // battle-only USER LEVERS block). Built ONLY when the feature is ON and not in
    // review, so flag-OFF is a true no-op — no manifest, and no extra reads. The two
    // tournament reads fold into the Promise.all below and each .catch → null, so a
    // group/claims read failure degrades to an all-false manifest and NEVER blocks
    // the turn or the market-context reads beside it.
    let capabilitiesManifest = null;
    const wantManifest = ARCHETYPE_INTEGRITY_MODE !== 'off' && mode !== 'review';
    const fetchGroup = wantManifest && battle.gameMode === TOURNAMENT_GAME_MODE && !!battle.groupId;
    const groupRef = fetchGroup
      ? db.collection(TOURNAMENT_GROUPS_COLLECTION).doc(battle.groupId)
      : null;
    try {
      const today = new Date().toISOString().split('T')[0];
      const [marketCtxDoc, drbDoc, cacheDoc, groupDoc, claimsAgg] = await Promise.all([
        db.collection('indexIntelligence').doc('marketContext').get(),
        db.collection('indexIntelligence').doc('dailyRegimeBrief').get(),
        db.collection('voiceLayerCache').doc(battleId).get(),
        fetchGroup ? groupRef.get().catch(() => null) : Promise.resolve(null),
        fetchGroup
          ? groupRef.collection('claims')
              .where('odUserId', '==', user.uid)
              .where('status', '==', 'pending')
              .count().get().catch(() => null)
          : Promise.resolve(null),
      ]);
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
      // Phase E2 — assemble the non-fenced group context for the manifest.
      // CONSERVATIVE degrade: build `group` only when BOTH tournament reads
      // succeeded (groupDoc exists AND the claims aggregate resolved). A standard
      // battle (fetchGroup false) or ANY failed/empty read leaves group null →
      // buildCapabilitiesManifest returns the all-false base ("no trade lever"
      // hand-off). Defaulting a failed claims read to 0 would wrongly imply claims
      // are available, so a failure nulls the whole group instead. Turn still 200.
      if (wantManifest) {
        let group = null;
        if (groupDoc && groupDoc.exists && claimsAgg) {
          const gdata = groupDoc.data();
          const me = (gdata.players || []).find(p => p.odUserId === user.uid);
          const now = new Date();
          group = {
            status: gdata.status,
            userPicks: me?.picks ?? [],
            pendingClaimCount: claimsAgg.data().count || 0,
            claimWindowOpen: getTournamentClaimWindow(now).isOpen,
            etDate: formatEtDate(now),
          };
        }
        capabilitiesManifest = buildCapabilitiesManifest({ battle, group });
      }
    } catch (err) {
      console.error('[VoiceLayer] Failed to fetch market context:', err.message);
    }

    // 12. Compute elicitation target
    const elicitationTarget = selectElicitationTarget(
      agent.partnerProfile,
      battle.recentElicitationTargets || [],
    );

    // 13. Build conversation history — last 10 exchanges as messages.
    // Agent-initiated exchanges (first_message, auto_debrief,
    // trade_narration) persist with userMessage:null because no user
    // turn triggered them. Drop the ENTIRE exchange (both user-role
    // and assistant-role halves) when userMessage is null/empty —
    // Gemma's chat template requires strictly alternating user/
    // assistant roles and rejects consecutive same-role messages with
    // a 400 ("Conversation roles must alternate"). Keeping just the
    // assistant half would produce assistant→assistant sequences that
    // crash the chat call. __REVIEW_START__ (Phase 1 auto-debrief
    // sentinel) is a non-empty string so it survives the filter.
    const previousExchanges = (battle.chatExchanges || [])
      .slice(-10)
      .filter(ex => typeof ex?.userMessage === 'string' && ex.userMessage.length > 0);
    const conversationHistory = previousExchanges.flatMap(ex => [
      { role: 'user', content: ex.userMessage },
      { role: 'assistant', content: ex.agentResponse || ex.agentMessage || '' },
    ]);

    // 14. Build system prompt
    const systemPrompt = buildVoiceLayerPrompt({
      agent,
      battle,
      elicitationTarget,
      conversationHistory,
      anchorContext,
      marketSnapshot,
      mode,
      dailyReviews: battle.dailyReviews || [],
      dailyGrades: battle.dailyGrades || [],
      capabilitiesManifest,
    });

    // 15. Call OpenRouter (Gemma 4) — with 15s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let rawResponse;
    try {
      rawResponse = await callGemmaVoice({
        systemPrompt,
        conversationHistory,
        userMessage: sanitizedMessage,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // 16. Parse response
    const parsed = parseVoiceLayerResponse(rawResponse);

    // 16b. Structured parse failure (tier-4). Gemma returned plaintext or
    //      empty content instead of JSON — never echo rawText back to the
    //      user (it's typically natural-language failure speech like
    //      "I have hit a snag…"). Shadow log the raw text so production
    //      diagnostics catch the failure mode, and surface a banner via
    //      the same 502 path the catch block uses for other Gemma misfires.
    if (parsed?.parseError === true) {
      console.error(
        '[VoiceLayer] parseVoiceLayerResponse failed:',
        parsed.errorReason,
        '| raw:',
        String(parsed.rawText || '').slice(0, 300),
      );
      logConversation({
        userId: user.uid,
        agentId,
        battleId,
        archetype: agent.archetype || null,
        gameMode: battle.gameMode || null,
        exchangeNumber: currentBudget + 1,
        userMessage: sanitizedMessage,
        agentMessage: null,
        scratchpad: null,
        directive: null,
        suggestedActions: null,
        elicitationTarget: elicitationTarget.dimension,
        anchorContext: anchorContext || null,
        hasDirective: false,
        tokenUsage: null,
        mode,
        turnError: true,
        errorReason: `parse_${parsed.errorReason}`,
        rawGemmaContent: String(parsed.rawText || '').slice(0, 2000),
      }).catch(() => {});
      return res.status(502).json({
        error: 'gemma_invalid_shape',
        errorReason: `parse_${parsed.errorReason}`,
        message: 'Agent returned an unexpected response. Try again.',
      });
    }

    // 17. Normalize and sanitize parsed fields
    const cleanScratchpad = sanitizeScratchpad(parsed._scratchpad);
    //     Directives are a live-play concept only. In review mode, the
    //     phase rules forbid hasDirective=true; we defensively strip any
    //     directive the model produces so nothing leaks into agent.directives[].
    // Phase E1 — the deterministic gate. OFF and review mode run the literal
    // legacy lines (byte-identical). Only observe/enforce in BATTLE mode call the
    // gate; OBSERVE forces null/false so the directive write, the threadId mint,
    // and the UI badge stay dark by construction — it only logs the outcome on the
    // exchange. ENFORCE lets a valid directive through the unchanged machinery.
    let normalizedDirective;
    let effectiveHasDirective;
    let gateOutcome = null;
    let gateFallbackLine = null;
    if (ARCHETYPE_INTEGRITY_MODE === 'off' || mode === 'review') {
      normalizedDirective = mode === 'review' ? null : normalizeDirective(parsed);
      effectiveHasDirective = mode === 'review' ? false : (parsed.hasDirective || false);
    } else {
      const gate = await gateDirective({
        parsed,
        effectiveArchetype: getEffectiveArchetype(battle, agent),
        mode,
        callGemmaVoice,
        systemPrompt,
        conversationHistory,
        userMessage: sanitizedMessage,
        signal: controller.signal,
        deadlineMs: turnStartMs + 24000,
      });
      gateOutcome = gate.outcome;
      gateFallbackLine = gate.fallbackLine;
      const enforcing = ARCHETYPE_INTEGRITY_MODE === 'enforce';
      normalizedDirective = enforcing ? gate.directive : null;
      effectiveHasDirective = enforcing ? gate.hasDirective : false;
    }

    // 17b. Lesson + Forge suggestion (review mode only)
    const lessonProposal = parsed._lesson;
    const lesson = (mode === 'review' && lessonProposal && typeof lessonProposal === 'object' && lessonProposal.text)
      ? {
          id: randomUUID(),
          text: String(lessonProposal.text).slice(0, 500),
          source: 'review_debrief',
          sourceGameId: battleId,
          sourceTrade: lessonProposal.sourceTrade || null,
          createdAt: new Date().toISOString(),
          consumed: false,
          consumedInConsolidation: null,
        }
      : null;

    const forgeProposal = parsed._forgeSuggestion;
    const forgeSuggestion = (mode === 'review' && forgeProposal && typeof forgeProposal === 'object' && forgeProposal.text)
      ? {
          id: randomUUID(),
          text: String(forgeProposal.text).slice(0, 500),
          sourceGameId: battleId,
          sourceTrade: forgeProposal.sourceTrade || null,
          createdAt: new Date().toISOString(),
          status: 'pending',
        }
      : null;

    // 18. Map to client contract
    const clientResponse = {
      agentMessage: parsed.response,
      extractedRule: normalizedDirective
        ? { text: normalizedDirective.text, targetType: 'general', targetValue: null, rationale: normalizedDirective.text }
        : null,
      suggestedActions: parsed.suggestedActions || null,
      exchangeNumber: currentBudget + 1,
      budgetTotal: budgetLimit,
      scratchpad: cleanScratchpad,
      hasDirective: effectiveHasDirective,
      directive: normalizedDirective,
      lesson: lesson ? { id: lesson.id, text: lesson.text } : null,
      forgeSuggestion: forgeSuggestion ? { id: forgeSuggestion.id, text: forgeSuggestion.text } : null,
      mode,
      // Phase E1/H — code-owned, AUTHORITATIVE status (never model-written), added
      // ONLY when the gate ran so the flag-OFF clientResponse stays byte-identical.
      // renderDirectiveStatus derives the truth-of-record from hasDirective alone:
      // a null-write turn ALWAYS reports directiveStatus 'no_change' + the no-change
      // status line, regardless of what the prose said (the Phase-H backstop that
      // makes prose-honesty structural). directiveFallback is the E1 conversational
      // no-change line on a failed-repair turn (null otherwise). Frontend deferred.
      ...(gateOutcome
        ? { ...renderDirectiveStatus(effectiveHasDirective), directiveFallback: gateFallbackLine }
        : {}),
    };

    // Shadow log (fire-and-forget)
    logConversation({
      userId: user.uid,
      agentId,
      battleId,
      archetype: agent.archetype || null,
      gameMode: battle.gameMode || null,
      exchangeNumber: currentBudget + 1,
      userMessage: sanitizedMessage,
      agentMessage: parsed.response,
      scratchpad: cleanScratchpad,
      directive: normalizedDirective,
      suggestedActions: parsed.suggestedActions || null,
      elicitationTarget: elicitationTarget.dimension,
      anchorContext: anchorContext || null,
      hasDirective: effectiveHasDirective,
      lesson: lesson ? { id: lesson.id, text: lesson.text } : null,
      forgeSuggestion: forgeSuggestion ? { id: forgeSuggestion.id, text: forgeSuggestion.text } : null,
      tokenUsage: null,
      mode,
    }).catch(() => {});

    // 19. Write exchange to battle doc
    //     When a directive is locked in, generate a threadId (UUID) that links
    //     this directive to any trades Haiku later executes under it. The
    //     threadId is stamped on the chat exchange, on the battle's single
    //     active-directive slot, and eventually flows through Haiku's eval
    //     tool output → statusFeed entries → the frontend trade card indicator.
    const directiveThreadId = (effectiveHasDirective && normalizedDirective) ? randomUUID() : null;

    const exchange = {
      userMessage: sanitizedMessage,
      agentResponse: parsed.response,
      scratchpad: cleanScratchpad,
      hasDirective: effectiveHasDirective,
      directive: directiveThreadId
        ? { text: normalizedDirective.text, expiry: normalizedDirective.expiry || 'end_of_battle', directiveThreadId }
        : null,
      directiveThreadId,
      suggestedActions: parsed.suggestedActions || null,
      elicitationTarget: elicitationTarget.dimension,
      timestamp: new Date().toISOString(),
      mode,
      // Catalog #9 (Signal Capture Rider) — round-boundary Film Room tagging.
      // Stamp the group onto each tournament review exchange so round-boundary
      // analysis can recover bracketGameId/roundNumber downstream by joining
      // groupId → the group doc. Those two are deliberately NOT stamped on the
      // battle doc: that is createAgentBattle doc-shape = fence contact = STOP
      // (founder ruling, P8 — tag-only with groupId). This rides the awaited
      // durable chatExchanges write below, never the fire-and-forget shadow
      // log. Pattern-A field-spread; tiered battles carry no groupId, so it is
      // omitted for them (the joint-stamp contract pairs gameMode + groupId).
      ...(battle.gameMode === TOURNAMENT_GAME_MODE && battle.groupId
        ? { groupId: battle.groupId }
        : {}),
      // Phase E1 — OBSERVE/ENFORCE durable gate record (CF-3: rides this awaited
      // chatExchanges write, NOT a fire-and-forget log). Stamped on the EXCHANGE,
      // never as a new battle-doc key (no createAgentBattle doc-shape contact).
      ...(gateOutcome ? { archetypeGate: gateOutcome } : {}),
    };

    const recentTargets = [...(battle.recentElicitationTargets || []), elicitationTarget.dimension].slice(-3);

    await battleRef.update({
      chatExchanges: FieldValue.arrayUnion(exchange),
      [budgetField]: FieldValue.increment(1),
      recentElicitationTargets: recentTargets,
      ...(directiveThreadId ? {
        directive: {
          text: normalizedDirective.text,
          expiry: normalizedDirective.expiry || 'end_of_battle',
          directiveThreadId,
          createdAt: new Date().toISOString(),
        },
      } : {}),
    });

    // 20. (removed) Directives are now battle-scoped only. Previously we
    //     also appended to `agents/{agentId}.directives[]`, but Phase 4
    //     deprecated reading that field and Phase 7 stops writing to it —
    //     directives live and die with the battle via `agentBattle.directive`.

    // 20b. Write lesson and/or forgeSuggestion to agent doc (review mode only).
    //      Both go to agents/{agentId}, not the battle doc — they are
    //      agent-level knowledge, not per-battle state.
    if (lesson || forgeSuggestion) {
      const agentUpdate = {};
      if (lesson) agentUpdate.lessons = FieldValue.arrayUnion(lesson);
      if (forgeSuggestion) agentUpdate.forgeSuggestions = FieldValue.arrayUnion(forgeSuggestion);
      await db.collection('agents').doc(agentId).update(agentUpdate);
    }

    // 21. Return response
    return res.status(200).json(clientResponse);
  } catch (error) {
    const isAbort = error?.name === 'AbortError';
    if (isAbort) {
      console.error('[VoiceLayer] Request timed out');
    } else {
      console.error('[VoiceLayer] Error:', error);
    }

    // Shadow log the failure (closes the diagnostic gap identified in the
    // snag-bug investigation). Best-effort — never blocks the response.
    // Captures the user message, error reason, abort flag, and a truncated
    // error message so production can correlate first-message failure
    // patterns to specific Gemma / OpenRouter / Firestore failures.
    logConversation({
      userId: user.uid,
      agentId,
      battleId,
      archetype: null,
      gameMode: null,
      exchangeNumber: null,
      userMessage: sanitizedMessage,
      agentMessage: null,
      scratchpad: null,
      directive: null,
      suggestedActions: null,
      elicitationTarget: null,
      anchorContext: null,
      hasDirective: false,
      tokenUsage: null,
      mode: null,
      turnError: true,
      errorReason: isAbort ? 'gemma_timeout' : 'handler_exception',
      errorMessage: String(error?.message || error || '').slice(0, 500),
    }).catch(() => {});

    if (isAbort) {
      return res.status(504).json({ error: 'Agent response timed out. Try again.' });
    }
    return res.status(500).json({ error: 'Agent unavailable. Try again in a moment.' });
  }
}
