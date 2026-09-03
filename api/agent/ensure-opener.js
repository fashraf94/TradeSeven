// api/agent/ensure-opener.js
//
// POST /api/agent/ensure-opener — lazy fallback for the Voice Layer opener.
//
// The deploy-time opener (generateFirstMessageOnDeploy in the FENCED
// api/agent/decide.js) is best-effort: it runs synchronously inside the deploy
// invocation under a ~15s Gemma abort and is silently dropped when Gemma is slow.
// This NON-FENCED endpoint backfills a missing opener with a patient budget and a
// deterministic floor, so a fresh-deploy chat is never silent — WITHOUT editing
// the fenced deploy path (it only CALLS the shared non-fenced builders).
//
// Flag-gated (OPENER_LAZY_FALLBACK_ENABLED, default false → 200 no-op).
//
// Decision tree (after auth + ownership, active battle):
//   - a first_message already exists       → { status:'already_present' }  (no write)
//   - chat has content but no opener        → { status:'no_action_needed' } (late open — deliberate skip)
//   - empty chat (early open)               → generate: patient Gemma (+1 deadline-bounded retry),
//                                             else deterministic template floor, committed via a
//                                             race-safe transaction (re-read + conditional append).
//
// Signal Capture Rider (BUILD_RULES §5): the opener write is an AWAITED in-request
// transaction whose error propagates — never fire-and-forget.

import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { applySecurityMiddleware } from '../_utils/security.js';
import { requireAuth } from '../_utils/authMiddleware.js';
import { FieldValue } from 'firebase-admin/firestore';
import { buildFirstMessagePrompt, getAgentPhase } from '../_utils/voiceLayerPrompt.js';
import { TERM_TOKENS } from '../_utils/termUniverse.js';
import { callGemmaVoice, parseVoiceLayerResponse } from '../_utils/gemmaClient.js';
import { buildTemplateOpener } from '../_utils/openerTemplateFloor.js';
import { OPENER_LAZY_FALLBACK_ENABLED } from '../../src/config/featureFlags.js';

// Patient Gemma call ⇒ a longer function budget than a plain write endpoint.
// 60s matches decide.js and voice-layer-cache.js.
export const config = { maxDuration: 60 };

// Kickoff sentinel for Gemma only — never persisted (mirrors decide.js:1272).
const FIRST_MESSAGE_KICKOFF = '__FIRST_MESSAGE__';
// Per-attempt Gemma abort — well beyond the fenced deploy path's 15s (the abort
// that loses the latency race). The whole turn is bounded by an ABSOLUTE deadline
// measured from handler entry (not from the Gemma phase) with headroom reserved
// for the transaction commit, so cold start + auth + reads + build + up to two
// attempts + commit stay under maxDuration:60 (the directiveGate.js:105-116
// deadline pattern).
const ATTEMPT_ABORT_MS = 40_000;
const HARD_DEADLINE_MS = 52_000; // wall-clock ceiling from handler entry (~8s margin under 60)
const COMMIT_RESERVE_MS = 6_000; // reserve after Gemma for the tx commit + response
const MIN_ATTEMPT_MS = 8_000;    // skip an attempt (→ floor) if less than this remains

function hasOpener(chatExchanges) {
  return Array.isArray(chatExchanges)
    && chatExchanges.some((ex) => ex && ex.messageType === 'first_message');
}

// One patient Gemma attempt → { agentResponse, scratchpad } or null on
// abort/transport/parse/empty. Never throws.
async function attemptGemmaOpener({ systemPrompt, abortMs }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), abortMs);
  try {
    const raw = await callGemmaVoice({
      systemPrompt,
      conversationHistory: [],
      userMessage: FIRST_MESSAGE_KICKOFF,
      signal: controller.signal,
    });
    const parsed = parseVoiceLayerResponse(raw);
    if (parsed?.parseError === true) return null;
    const msg = parsed?.response;
    if (!msg || typeof msg !== 'string') return null;
    const scratchpad = parsed._scratchpad
      ? String(parsed._scratchpad).slice(0, 2000).trim() || null
      : null;
    return { agentResponse: msg, scratchpad };
  } catch (err) {
    // Abort (slow Gemma) is the common case; a hard config error (401/403 rotated
    // key) is the one worth surfacing — log both so a transport/key outage is
    // visible in observability rather than silently flooring every opener.
    console.warn('[ensure-opener] gemma attempt failed:', err?.name === 'AbortError' ? 'timeout' : (err?.message || err));
    return null; // caller decides retry vs floor
  } finally {
    clearTimeout(timeoutId);
  }
}

// Exact shape of the deploy-time first_message exchange (decide.js:1313-1324).
function buildExchange({ agentResponse, scratchpad = null }) {
  return {
    userMessage: null,
    agentResponse,
    scratchpad,
    hasDirective: false,
    directive: null,
    suggestedActions: null,
    elicitationTarget: 'first_message',
    timestamp: new Date().toISOString(),
    mode: 'battle',
    messageType: 'first_message',
  };
}

// Matches decide.js:1326-1331 (drives the command-dot via statusFeed growth).
function buildStatusEntry() {
  return {
    action: 'first_message',
    source: 'voice_layer',
    message: 'Agent opened the conversation.',
    timestamp: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  // Absolute wall-clock anchor for the Gemma budget — measured from the earliest
  // point in the handler so auth + reads + build all count against the deadline.
  const handlerStart = Date.now();
  if (applySecurityMiddleware(req, res, { rateLimit: { limit: 5, windowMs: 60000 } })) {
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Flag OFF → hard no-op (byte-identical to today; the client also won't call).
  if (OPENER_LAZY_FALLBACK_ENABLED !== true) {
    return res.status(200).json({ status: 'disabled' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  // agentId is intentionally NOT read from the body — the agent is resolved
  // authoritatively from the battle doc below, so a caller cannot fold an
  // arbitrary agent into their opener.
  const { battleId } = req.body || {};
  if (!battleId) {
    return res.status(400).json({ error: 'battleId is required' });
  }

  const db = getFirebaseAdmin();

  try {
    const battleRef = db.collection('agentBattles').doc(battleId);
    const battleSnap = await battleRef.get();
    if (!battleSnap.exists) {
      return res.status(404).json({ error: 'Battle not found' });
    }
    const battle = battleSnap.data();

    // Ownership — verified uid from the Firebase token, not a client header.
    if (battle.ownerId !== user.uid) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    // Only backfill live battles.
    if (battle.status !== 'active') {
      return res.status(200).json({ status: 'not_active' });
    }

    const exchanges = Array.isArray(battle.chatExchanges) ? battle.chatExchanges : [];

    // (1) opener already present → nothing to do.
    if (hasOpener(exchanges)) {
      return res.status(200).json({ status: 'already_present' });
    }
    // (2) chat has other content but no opener (late open) → deliberate skip.
    if (exchanges.length > 0) {
      return res.status(200).json({ status: 'no_action_needed' });
    }

    // (3) Empty chat (early open) → generate. Resolve the agent doc AUTHORITATIVELY
    //     from the battle's own top-level agentId (agentBattleService.js:105) — never
    //     a client-supplied id.
    if (!battle.agentId) {
      return res.status(422).json({ error: 'battle has no agentId' });
    }
    const agentSnap = await db.collection('agents').doc(battle.agentId).get();
    if (!agentSnap.exists) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const agentData = { id: agentSnap.id, ...agentSnap.data() };

    // Context fetch — mirror decide.js:1215-1244 (anchorContext + marketSnapshot;
    // both degrade to null on cold data, which buildFirstMessagePrompt tolerates).
    let anchorContext = null;
    let marketSnapshot = null;
    try {
      const today = new Date().toISOString().split('T')[0];
      const [marketCtxDoc, drbDoc, cacheDoc] = await Promise.all([
        db.collection('indexIntelligence').doc('marketContext').get(),
        db.collection('indexIntelligence').doc('dailyRegimeBrief').get(),
        db.collection('voiceLayerCache').doc(battleId).get(),
      ]);
      if (marketCtxDoc.exists) {
        const ctx = marketCtxDoc.data();
        // Guard `regime` (the fenced deploy path does not) so a marketContext doc
        // missing the field degrades to null instead of leaking "Regime: undefined"
        // into the prompt and suppressing buildFirstMessagePrompt's clean fallback.
        const regimeLine = ctx.regime
          ? `Regime: ${ctx.regime}. ${ctx.regimeDetail || ''}`.trim()
          : null;
        const drb = drbDoc.exists ? drbDoc.data() : null;
        const briefLine = drb && drb.forDate === today && typeof drb.dailyBrief === 'string'
          ? drb.dailyBrief
          : null;
        anchorContext = [regimeLine, briefLine].filter(Boolean).join(' ') || null;
      }
      if (cacheDoc.exists) marketSnapshot = cacheDoc.data();
    } catch (err) {
      console.warn('[ensure-opener] context fetch failed (degrading to null):', err?.message);
    }

    // Build the SAME prompt the deploy path builds — identical phase source
    // (getAgentPhase(agentData.stats.gamesPlayed), decide.js:1255) → no maturity
    // drift. buildFirstMessagePrompt is non-fenced and defensive.
    let systemPrompt = null;
    try {
      systemPrompt = buildFirstMessagePrompt({
        agent: agentData,
        battle,
        anchorContext,
        marketSnapshot,
        currentPhase: getAgentPhase(agentData?.stats?.gamesPlayed || 0),
        supportedTerms: TERM_TOKENS,
        executionMode: battle.executionMode || 'autopilot',
      });
    } catch (err) {
      // Should not happen (defensive builder), but never let it sink the opener —
      // fall straight to the deterministic floor.
      console.warn('[ensure-opener] prompt build failed, using template floor:', err?.message);
      systemPrompt = null;
    }

    // Patient Gemma bounded by the ABSOLUTE deadline (handlerStart + HARD_DEADLINE_MS)
    // minus a commit reserve, so a slow attempt can never push the commit past
    // maxDuration. A second attempt only runs when the first failed FAST and budget
    // remains (a slow first attempt → floor). NB: not callGemmaVoiceWithRetry —
    // this handler owns its own attempt loop against the absolute deadline, and
    // a second, unbudgeted retry inside the client would break that accounting.
    // (The original reason given here — that the helper "does not retry the
    // invalid-JSON-200 abort" — no longer holds: as of the Sep 3 2026 timeout
    // fix that failure is classified as an abort, and correctly not retried.)
    const attemptBudgetMs = () => Math.min(
      ATTEMPT_ABORT_MS,
      (handlerStart + HARD_DEADLINE_MS) - Date.now() - COMMIT_RESERVE_MS,
    );
    let generated = null;
    if (systemPrompt) {
      for (let attempt = 0; attempt < 2 && !generated; attempt++) {
        const abortMs = attemptBudgetMs();
        if (abortMs < MIN_ATTEMPT_MS) break; // not enough budget left → template floor
        generated = await attemptGemmaOpener({ systemPrompt, abortMs });
      }
    }

    let floored = false;
    let exchange;
    if (generated) {
      exchange = buildExchange({ agentResponse: generated.agentResponse, scratchpad: generated.scratchpad });
    } else {
      floored = true;
      exchange = buildExchange({ agentResponse: buildTemplateOpener({ agent: agentData, battle }) });
    }
    const statusEntry = buildStatusEntry();

    // Commit inside a transaction (R1): the expensive work is done; re-read the
    // battle in the tx and append ONLY if no opener slipped in and the chat is
    // still empty. battleRef is in the read-set → auto-retry on any concurrent
    // write, so two tabs / a fire-vs-backfill race can never double-append.
    // (canonicalOpen.js:112-139 re-read/conditional-write pattern.)
    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(battleRef);
      if (!snap.exists) return 'battle_gone';        // battle deleted during the Gemma window → no write (avoids a 500)
      const ex = Array.isArray(snap.data()?.chatExchanges) ? snap.data().chatExchanges : [];
      if (hasOpener(ex)) return 'already_present';   // another writer won the race
      if (ex.length > 0) return 'no_action_needed';  // content arrived during generation → skip
      tx.update(battleRef, {
        chatExchanges: FieldValue.arrayUnion(exchange),
        statusFeed: FieldValue.arrayUnion(statusEntry),
      });
      return floored ? 'floored' : 'generated';
    });

    return res.status(200).json({ status: outcome });
  } catch (error) {
    console.error('[ensure-opener] error:', error?.message || error);
    return res.status(500).json({ error: 'Failed to ensure opener' });
  }
}
