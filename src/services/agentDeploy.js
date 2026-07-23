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

export async function deployAgent(agentId, onCreateAgentBattle) {
  if (!agentId) return { success: false, error: 'no-agent' };

  // P4 contract #3: the deploy endpoint now authenticates client callers
  // (Firebase ID token + ownership). Same pattern as fetchWithAuth.
  const token = await getIdToken();
  if (!token) {
    console.error('[Deploy] No auth token — sign in required to deploy');
    return { success: false, error: 'auth-required' };
  }

  // Step 1: generate the portfolio via the AI decision endpoint.
  const response = await fetch('/api/agent/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ agentId }),
  });
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
        error: `deploy_http_${status}`,
        details: snippet || response.statusText || `Request failed (${status})`,
      };
    }
    // [Deploy Ceremony §10] Forward `details`/`errorPhase` (previously dropped)
    // plus the HTTP status so the ceremony error surface can show something useful.
    console.error('[Deploy] Failed:', status, data.error, data.details || '');
    return { success: false, status, error: data.error, details: data.details, errorPhase: data.errorPhase };
  }

  // Step 2: hand off to the app's battle-creation callback (it navigates).
  console.log('[Deploy] Agent battle created:', data.agentBattleId || '(existing)');
  if (onCreateAgentBattle) {
    await onCreateAgentBattle(
      data.portfolio,
      data.bench,
      {
        agentId,
        agentBattleId: data.agentBattleId || null,
        innerMonologue: data.innerMonologue || null,
        strategyBrief: data.strategyBrief || null,
        expiresAt: data.expiresAt || null,
        opponent: data.opponent || null,
        opponentBench: data.opponentBench || null,
      }
    );
  }

  return { success: true, agentBattleId: data.agentBattleId || null };
}
