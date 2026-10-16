// src/services/agentDeploy.js
//
// Shared agent-deploy sequence — every Command Dashboard deploy CTA (mobile
// and desktop; originally also the retired Agent Hub) calls an IDENTICAL path:
//   POST /api/agent/decide  →  onCreateAgentBattle(portfolio, bench, meta)
// where onCreateAgentBattle is App.jsx's handleCreateAgentTrainingBattle, which
// builds the in-memory battle and routes to the Battle View.
//
// This does NOT modify decide.js or createAgentBattle — it only calls them.
// UI state (a `deploying` flag) stays with each caller.
//
// Command Center repair R1 (spec V1.2 §5.1–§5.3, corrections C2 and C3): every
// result carries a typed `outcome` from src/constants/deployOutcomes.js beside
// its unchanged legacy fields (`success`, `status`, `httpStatus`, `postIssued`,
// `error`, `details`, `errorPhase`, `battleId`):
//   created         — a 200 with a real new battle id, handed off; success:true
//   existing_battle — a 200 with battleCreated:false and a real existingBattleId;
//                     no handoff, nothing stashed, nothing navigated (IR-01)
//   refused         — the two no-POST preflights (postIssued:false) and every
//                     JSON 4xx or 503 the server sent (postIssued:true)
//   uncertain       — the POST may have committed: a network failure, a non-JSON
//                     body, any other JSON 5xx, a 200 naming no battle
//   handoff_failed  — a real creation whose App handoff threw; carries battleId
//   orphaned        — the signed-in account changed during the deploy
// The callback is called only for `created`, and always with a real id.

import { getIdToken } from '../firebase/authService';
import { CASUAL_CLONE_CONCURRENCY_ENABLED } from '../config/featureFlags';
// Record-only deploy instrumentation (console; no writes, nothing gates on it).
// Every export is throw-proof, so these calls cannot affect the deploy contract.
import * as ceremonyTiming from '../components/Dashboard/deployCeremony/ceremonyTiming';
// Pilot P1b — the deploy refusal's typed code (founder ruling B2).
import { DEPLOY_REFUSAL_CODE } from '../constants/hypothesisRecords';
import { DEPLOY_OUTCOMES } from '../constants/deployOutcomes';
import { stockAdmissionRetryAt, STOCK_PUBLICATION_DELAY_MINUTES } from '../utils/stockAdmissionWindow';
import { signedInUid } from './deployIdentity';

// BaggerBomb stock thresholds v2 (Rulings 2 and 6): only an allowlisted pilot
// creation can be refused this way. The server's 503 carries `reason`; the
// ceremony shows `details`, so the reason becomes one short player line.
export const STOCK_ADMISSION_ERROR = 'Stock admission unavailable';
// The late start and the evening window (P2) name the retry time, derived
// from the same rule as the server refusal (src/utils/stockAdmissionWindow.js).
// The 503 carries only the reason, so the time comes from this browser's clock
// when the refusal arrives (blockers review BK2-6).
const RETRY_TIME_REASONS = new Set(['late_start_cutoff', 'evening_window']);
const etClock = ms => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(ms).replace(/\s/g, ' ');
const STOCK_ADMISSION_LINES = {
  publication_window_not_open: `Measured battles reopen ${STOCK_PUBLICATION_DELAY_MINUTES} minutes after the market close. Try again shortly.`,
  prior_corrected_battle_requires_settlement: 'Your previous measured battle is still settling. Try again after it completes.',
};
export function stockAdmissionLine(data, now = new Date()) {
  if (data?.error !== STOCK_ADMISSION_ERROR) return null;
  const retryAt = RETRY_TIME_REASONS.has(data.reason) ? stockAdmissionRetryAt(now.toISOString()) : null;
  if (retryAt !== null) return `Measured battles can't start this late in the day. Try again after ${etClock(retryAt)} ET.`;
  return STOCK_ADMISSION_LINES[data.reason] ?? 'Measured scoring could not start this battle just now. Try again in a minute.';
}

// R1 (ruling R-R1-3) — the two 429s decide.js sends itself, keyed by their exact
// words: the 120 s deploy lock and the per-agent 2-minute cooldown. Any other
// 429 (the shared rate limiter in front of the handler sends one) is refused
// with no reason; the limiter's own wait, in seconds, rides along as
// `retryAfter` (founder ruling Q3, below).
const REFUSAL_REASONS_429 = Object.freeze({
  'Deploy already in progress': 'in_progress',
  'Please wait 2 minutes between deploys': 'cooldown',
});

// R1 (ruling R-R1-3) — which JSON failures are typed DEFINITIVE. Every 4xx the
// endpoint sends is a refusal before anything was created. Every 503 it sends
// is typed refused: the pricing gate and the missing rankings answer before any
// battle write, and so does the stock-admission refusal — except one reason.
// `reason: 'corrected_creation_failed'` can follow a battle commit whose
// acknowledgement was lost (review L4-1, proven on the real Firestore SDK), so
// by founder ruling Q1 it is uncertain, its player line still in `details`
// (mayFollowCommit, below). Every other
// 5xx stays uncertain: the single catch's 500 can follow the battle commit, and
// decide.js sends no 502/504 itself — those are gateway or timeout statuses,
// which can arrive after a commit too (review L4-5: the ceremony's attribution
// gate, unchanged by R1, admits only 500, so this typing is more conservative
// than the ceremony's). A non-JSON body proves nothing about who answered and
// is uncertain whatever its status.
const isDefinitiveRefusal = (status) => (status >= 400 && status < 500) || status === 503;
// Founder ruling Q1 (R1 amendment): the one 503 reason that can follow a commit.
const mayFollowCommit = (status, data) => status === 503 && data?.reason === 'corrected_creation_failed';

// A real server id: a nonempty string with no surrounding space — the same rule
// the hub's translator applies (attemptVocabulary.js realId).
const realId = (id) => (typeof id === 'string' && id.length > 0 && id.trim() === id ? id : null);

/**
 * @param {string} agentId the ranked agent the deploy is for
 * @param {Function|null} onCreateAgentBattle App's handoff, called only for a real creation
 * @param {Function} [onDeployTargetResolved] reported the deploy target as soon as it is known
 * @param {{ isCurrent?: () => boolean }} [options] `isCurrent` lets a caller add its own
 *   staleness check (S2b's attempt epoch). It is checked BESIDE the signed-in uid, never
 *   instead of it, and only a literal `true` keeps the deploy current. Passed but not a
 *   function (a precomputed boolean, an object) it keeps nothing current.
 */
export async function deployAgent(agentId, onCreateAgentBattle, onDeployTargetResolved, options = {}) {
  if (!agentId) return { outcome: DEPLOY_OUTCOMES.REFUSED, success: false, postIssued: false, error: 'no-agent' };

  // R1 (ruling R-R1-4; spec V1.2 §5.3) — the identity this deploy belongs to,
  // captured at entry. After every await, and immediately before the handoff, a
  // changed or absent uid ends the deploy as `orphaned` with no further effect
  // here: no token or clone for another account, no POST, no target report, no
  // handoff. A battle the server may already have created for the captured
  // owner is left exactly as it is. How a caller displays `orphaned` is the
  // caller's: the shells close the ceremony on it, showing the former owner's
  // deploy nothing (founder ruling Q2; review L2-2).
  const capturedUid = signedInUid();
  const isCurrent = options?.isCurrent ?? null;
  const stillOwned = () => {
    if (capturedUid === null || signedInUid() !== capturedUid) return false;
    if (isCurrent === null) return true;
    // A check that cannot be run cannot vouch for the deploy (review L2-3).
    if (typeof isCurrent !== 'function') return false;
    try { return isCurrent() === true; } catch { return false; }
  };
  const orphaned = (postIssued) => {
    // A warning, not an error: nothing failed, the result is only withheld
    // (review L1-1). The first case is also what a test sees when its auth
    // mock has no getCurrentUser.
    console.warn(capturedUid === null
      ? '[Deploy] No signed-in account when the deploy started; nothing further was done.'
      : '[Deploy] The signed-in account changed during the deploy; nothing further was done.', { postIssued });
    return { outcome: DEPLOY_OUTCOMES.ORPHANED, success: false, postIssued };
  };

  // The deploy TARGET id, reported upward the instant it is known so the caller
  // can subscribe to the document this deploy will actually write to. The
  // ceremony reads deployProgress / lastDeployedAt / lastDecision off that doc;
  // on the clone path it is NOT the ranked agent's.
  //
  // Every assignment to deployAgentId goes through setDeployTarget — that is the
  // single point §3 requires, so a future branch cannot resolve a target without
  // reporting it (assignment count === report count, by construction). Do NOT
  // reconstruct the id client-side as `casual-agent-{uid}`: the fallback below
  // deploys the RANKED agent when ensure-casual-clone fails, and a derived id
  // would send the ceremony back to the wrong document in exactly that branch.
  let deployAgentId = null;
  const setDeployTarget = (id) => {
    deployAgentId = id;
    // Measurement A rides the same single point: call #1 is the ranked agent,
    // call #2 the resolved clone, so the clone round trip is observable here
    // without a second seam.
    ceremonyTiming.markDeployTarget(id);
    // A throwing consumer must never take down a deploy — this is telemetry for
    // the ceremony, not part of the deploy contract.
    try { onDeployTargetResolved?.(id); } catch (err) {
      console.warn('[Deploy] target-resolved callback threw:', err?.message || err);
    }
  };
  // Report the ranked agent FIRST: it is the target unless the clone resolves,
  // so the subscription is live for the whole clone round trip and, on the
  // fallback path, is already correct with nothing further to do.
  setDeployTarget(agentId);

  // P4 contract #3: the deploy endpoint now authenticates client callers
  // (Firebase ID token + ownership). Same pattern as fetchWithAuth.
  const token = await getIdToken();
  if (!token) {
    // R1 — a token lost to an account change is that change, not a missing
    // sign-in (review L2-4). Nobody signed in at entry stays auth-required.
    if (capturedUid !== null && !stillOwned()) return orphaned(false);
    console.error('[Deploy] No auth token — sign in required to deploy');
    return { outcome: DEPLOY_OUTCOMES.REFUSED, success: false, postIssued: false, error: 'auth-required' };
  }
  // R1 — after the token. Nobody signed in at entry reads as a missing token
  // above, exactly as before; a token taken across an account change is never
  // used.
  if (!stillOwned()) return orphaned(false);

  // Per-Battle Loadout + Concurrency Phase 1: when enabled, a Command-Center
  // BaggerBomb deploy runs on the caller's PERSISTENT casual clone (its own
  // agentId) so it coexists with a live ranked league game and enforces "one
  // BaggerBomb at a time" via the existing per-agentId lock in decide.js. The
  // clone must be minted SERVER-SIDE (the agents create rule forbids a
  // client-minted loaded clone), so resolve-or-create it via the authed endpoint
  // FIRST, then deploy under its id — still ONE deploy path (this only changes
  // WHICH agentId decide receives). On ANY failure we fall back to the real
  // agentId: the deploy proceeds exactly as today, degraded to the real agent,
  // never blocked. Flag OFF → deployAgentId === agentId (byte-identical).
  if (CASUAL_CLONE_CONCURRENCY_ENABLED) {
    let cloneId = null;
    try {
      // getIdToken sits between setDeployTarget #1 and here, so the raw gap
      // between the two target reports is NOT the clone round trip. Marking the
      // request separates auth time from clone time — the pre-warm decision only
      // gets to claim the latter.
      ceremonyTiming.markCloneRequest();
      const cloneRes = await fetch('/api/agent/ensure-casual-clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const cloneData = await cloneRes.text().then((t) => { try { return JSON.parse(t); } catch { return null; } });
      if (cloneRes.ok && cloneData && typeof cloneData.cloneId === 'string') {
        cloneId = cloneData.cloneId;
      } else {
        // Fallback: the target stays the ranked agent, already reported above.
        // setDeployTarget never fires a second time, so the clone outcome is
        // recorded here as a DISTINCT outcome rather than a missing value.
        ceremonyTiming.markCloneFallback(`http_${cloneRes.status}`);
        console.warn('[Deploy] casual clone ensure did not return a clone — deploying the real agent:', cloneRes.status, cloneData?.error || '');
      }
    } catch (err) {
      // Fallback: the target stays the ranked agent, already reported above.
      ceremonyTiming.markCloneFallback('threw');
      console.warn('[Deploy] casual clone ensure errored — deploying the real agent:', err?.message || err);
    }
    // R1 — after the clone ensure, and before its target is reported or POSTed:
    // an old request never deploys anything once the account has changed.
    if (!stillOwned()) return orphaned(false);
    if (cloneId !== null) setDeployTarget(cloneId);
  }

  // Step 1: generate the portfolio via the AI decision endpoint.
  //
  // From here on the caller must be able to tell WHERE a failure happened, because
  // the Deploy Ceremony's recovered-reveal gate turns on it. `httpStatus` carries
  // what the status proves — and, just as importantly, what it does not; the one
  // statement of that is THE FAILURE MODEL block in `services/agentBattleVerify.js`
  // and it is not restated here. `postIssued` separates a transport failure — where
  // we genuinely do not know — from a client-side bail that never reached the
  // server.
  ceremonyTiming.markPostIssued();
  let response;
  try {
    response = await fetch('/api/agent/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ agentId: deployAgentId }),
    });
  } catch (err) {
    // The request left the client but produced no response. Whether the server
    // saw it is unknowable here, which is itself the answer the ceremony needs.
    console.error('[Deploy] Network failure posting to /api/agent/decide:', err?.message || err);
    // R1 — the POST went out; a former owner's network failure is typed
    // orphaned, not uncertain.
    if (!stillOwned()) return orphaned(true);
    return {
      outcome: DEPLOY_OUTCOMES.UNCERTAIN,
      success: false, postIssued: true, httpStatus: null,
      error: 'deploy_network', details: err?.message || 'Network request failed',
    };
  }
  // Marked at response arrival rather than after the body read, so this measures
  // the server round trip and not the client's parse.
  ceremonyTiming.markPostResolved(response.status);
  // R1 — after the POST.
  if (!stillOwned()) return orphaned(true);
  // Guard the body parse: /api/agent/decide can return a NON-JSON error page — a
  // 500 HTML page, a module-link crash (ERR_MODULE_NOT_FOUND), a gateway timeout.
  // Calling response.json() on that throws a SyntaxError that masks the real HTTP
  // status. Read the body once as text, parse defensively, and surface the status.
  const raw = await response.text().catch(() => '');
  // R1 — after the body read.
  if (!stillOwned()) return orphaned(true);
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = null; }
  }

  if (!response.ok || !data || data.success !== true) {
    const status = response.status;
    if (!data) {
      const snippet = raw.slice(0, 300).trim();
      console.error(`[Deploy] Failed: HTTP ${status} — non-JSON response`, snippet || '(empty body)');
      return {
        outcome: DEPLOY_OUTCOMES.UNCERTAIN,
        success: false,
        status,
        postIssued: true,
        httpStatus: status,
        error: `deploy_http_${status}`,
        details: snippet || response.statusText || `Request failed (${status})`,
      };
    }
    // [Deploy Ceremony §10] Forward `details`/`errorPhase` (previously dropped)
    // plus the HTTP status so the ceremony error surface can show something useful.
    // Pilot P1b: a deploy refused because the equipped idea is due for review
    // carries its words in `message` — table C's due-deploy line, verbatim —
    // and the ceremony shows `details`, so that one refusal forwards its line
    // there. A measured pilot's stock-admission refusal forwards its player
    // line (v2 Ruling 2). Every other failure forwards exactly what it did before.
    const refusalLine = data.error === DEPLOY_REFUSAL_CODE && typeof data.message === 'string' ? data.message
      : stockAdmissionLine(data);
    console.error('[Deploy] Failed:', status, data.error, refusalLine || data.details || '');
    const refused = isDefinitiveRefusal(status) && !mayFollowCommit(status, data);
    const reason = refused && status === 429 ? REFUSAL_REASONS_429[data.error] : undefined;
    return {
      outcome: refused ? DEPLOY_OUTCOMES.REFUSED : DEPLOY_OUTCOMES.UNCERTAIN,
      success: false, status, postIssued: true, httpStatus: status,
      error: data.error, details: refusalLine ?? data.details, errorPhase: data.errorPhase,
      // The P1b refusal's typed code rides beside its line (spec §5.2: Forge action, no auto retry).
      ...(refused && data.error === DEPLOY_REFUSAL_CODE ? { code: DEPLOY_REFUSAL_CODE } : {}),
      ...(reason ? { reason } : {}),
      // Founder ruling Q3 (R1 amendment): the shared rate limiter's 429 body names
      // its wait in seconds (api/_utils/rateLimit.js). Forwarded as given, from the
      // body only, for the hub's cooldown (spec §5.4); nothing reads it today.
      ...(Number.isFinite(data.retryAfter) ? { retryAfter: data.retryAfter } : {}),
    };
  }

  // R1 (ruling R-R1-2) — decide.js answers success:true for TWO different facts,
  // and they are told apart here, BEFORE the handoff. `battleCreated: false`
  // with `existingBattleId` is the "agent already has an active battle" branch:
  // a battle THIS deploy did not create. It calls no create callback, so App
  // stashes nothing, appends nothing, navigates nowhere and fabricates no id;
  // the shells show it as its own terminal and open the owned server document.
  const existingBattleId = data.battleCreated === false ? realId(data.existingBattleId) : null;
  if (existingBattleId !== null) {
    console.log('[Deploy] The agent already has a running battle:', existingBattleId);
    return {
      outcome: DEPLOY_OUTCOMES.EXISTING_BATTLE,
      success: false, existingBattleId, postIssued: true, httpStatus: response.status,
    };
  }
  // The created 200 carries `battleCreated: true` and the new `agentBattleId`. A
  // 200 that names neither a new battle nor an existing one is malformed: the
  // server answered, but this client cannot say what it did, so it is uncertain
  // and nothing is handed off.
  const agentBattleId = data.battleCreated === false ? null : realId(data.agentBattleId);
  if (agentBattleId === null) {
    console.error('[Deploy] Failed: HTTP', response.status, '— success without a battle id');
    return {
      outcome: DEPLOY_OUTCOMES.UNCERTAIN,
      success: false, status: response.status, postIssued: true, httpStatus: response.status,
      // No id to carry: nothing here may pin a reveal (useCeremonyStageMachine's deployBattleId).
      battleId: null,
      error: 'deploy_no_battle_id', details: 'The deploy finished without naming a battle.',
    };
  }

  // Step 2: hand off to the app's battle-creation callback (it navigates).
  console.log('[Deploy] Agent battle created:', agentBattleId);
  if (onCreateAgentBattle) {
    // R1 — immediately before the handoff: no append, stash or navigation for
    // a former owner.
    if (!stillOwned()) return orphaned(true);
    try {
      await onCreateAgentBattle(
        data.portfolio,
        data.bench,
        {
          // The deployed agent's id (the casual clone when the feature is on) — kept
          // consistent with the created battle's agentId. Flag off: === agentId.
          agentId: deployAgentId,
          // Always the real server id: the callback is never reached without one.
          agentBattleId,
          // R1 (ruling R-R1-5): the identity this deploy was captured for. App
          // stamps it on its optimistic entry and checks it again before each
          // of its own effects.
          ownerUid: capturedUid,
          innerMonologue: data.innerMonologue || null,
          strategyBrief: data.strategyBrief || null,
          expiresAt: data.expiresAt || null,
          opponent: data.opponent || null,
          opponentBench: data.opponentBench || null,
        }
      );
    } catch (err) {
      // THE IDENTIFIER MUST SURVIVE THE TRIP. This is the §5 trap one seam later:
      // the server has already 200'd with a real, durable battle id and the
      // callback threw while building the in-memory battle — so the battle exists,
      // we are holding its id, and letting the throw escape would report the whole
      // deploy through the shells' catch as `postIssued: false` ("never reached the
      // server") for a deploy that definitively did.
      //
      // `battleId` is returned rather than merely `httpStatus: 200`, because 200 on
      // its own must NEVER buy a reveal: decide.js's "agent already has an active
      // battle" branch also returns 200 + `success: true`, carrying
      // `existingBattleId` and NO `agentBattleId` — a battle this deploy did not
      // create. That branch is typed `existing_battle` above and never reaches
      // here, so the id carried here is always the battle this deploy created.
      console.error('[Deploy] Battle created but the client handoff threw:', err?.message || err);
      return {
        outcome: DEPLOY_OUTCOMES.HANDOFF_FAILED,
        success: false,
        status: response.status,
        postIssued: true,
        httpStatus: response.status,
        battleId: agentBattleId,
        error: 'deploy_handoff',
        details: err?.message || 'The battle was created but could not be opened.',
      };
    }
  }

  return { outcome: DEPLOY_OUTCOMES.CREATED, success: true, agentBattleId };
}
