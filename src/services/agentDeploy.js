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

import { getIdToken } from '../firebase/authService';
import { CASUAL_CLONE_CONCURRENCY_ENABLED } from '../config/featureFlags';
// Record-only deploy instrumentation (console; no writes, nothing gates on it).
// Every export is throw-proof, so these calls cannot affect the deploy contract.
import * as ceremonyTiming from '../components/Dashboard/deployCeremony/ceremonyTiming';

export async function deployAgent(agentId, onCreateAgentBattle, onDeployTargetResolved) {
  if (!agentId) return { success: false, postIssued: false, error: 'no-agent' };

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
    console.error('[Deploy] No auth token — sign in required to deploy');
    return { success: false, postIssued: false, error: 'auth-required' };
  }

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
        setDeployTarget(cloneData.cloneId);
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
    return {
      success: false, postIssued: true, httpStatus: null,
      error: 'deploy_network', details: err?.message || 'Network request failed',
    };
  }
  // Marked at response arrival rather than after the body read, so this measures
  // the server round trip and not the client's parse.
  ceremonyTiming.markPostResolved(response.status);
  // Guard the body parse: /api/agent/decide can return a NON-JSON error page — a
  // 500 HTML page, a module-link crash (ERR_MODULE_NOT_FOUND), a gateway timeout.
  // Calling response.json() on that throws a SyntaxError that masks the real HTTP
  // status. Read the body once as text, parse defensively, and surface the status.
  const raw = await response.text().catch(() => '');
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
    console.error('[Deploy] Failed:', status, data.error, data.details || '');
    return {
      success: false, status, postIssued: true, httpStatus: status,
      error: data.error, details: data.details, errorPhase: data.errorPhase,
    };
  }

  // Step 2: hand off to the app's battle-creation callback (it navigates).
  console.log('[Deploy] Agent battle created:', data.agentBattleId || '(existing)');
  if (onCreateAgentBattle) {
    try {
      await onCreateAgentBattle(
        data.portfolio,
        data.bench,
        {
          // The deployed agent's id (the casual clone when the feature is on) — kept
          // consistent with the created battle's agentId. Flag off: === agentId.
          agentId: deployAgentId,
          agentBattleId: data.agentBattleId || null,
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
      // its own must NEVER buy a reveal: `decide.js:748-758` (the "agent already has
      // an active battle" branch) also returns 200 + `success: true`, carrying
      // `existingBattleId` and NO `agentBattleId` — a battle this deploy did not
      // create. So the id is the gate, not the status: absent here, this resolves as
      // an ordinary unknown and the ceremony says "lost contact".
      console.error('[Deploy] Battle created but the client handoff threw:', err?.message || err);
      return {
        success: false,
        status: response.status,
        postIssued: true,
        httpStatus: response.status,
        battleId: data.agentBattleId || null,
        error: 'deploy_handoff',
        details: err?.message || 'The battle was created but could not be opened.',
      };
    }
  }

  return { success: true, agentBattleId: data.agentBattleId || null };
}
