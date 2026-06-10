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

export async function deployAgent(agentId, onCreateAgentBattle) {
  if (!agentId) return { success: false, error: 'no-agent' };

  // Step 1: generate the portfolio via the AI decision endpoint.
  const response = await fetch('/api/agent/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId }),
  });
  const data = await response.json();

  if (!data.success) {
    console.error('[Deploy] Failed:', data.error);
    return { success: false, error: data.error };
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
