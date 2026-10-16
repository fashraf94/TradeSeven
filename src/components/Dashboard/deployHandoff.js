// src/components/Dashboard/deployHandoff.js
//
// Command Center repair R1 (ruling R-R1-5; spec V1.2 §3, §5.1, §5.3) — the pure
// half of App's deploy handoff (App.jsx handleCreateAgentTrainingBattle), lifted
// out so it is tested directly instead of through source pins:
//
//   - handoffBattleId: the real server id the handoff may use, or null. With
//     null the handoff builds nothing, appends nothing, stashes nothing,
//     navigates nowhere — it never fabricates an `agent_${Date.now()}` id.
//   - isHandoffOwnerCurrent: the identity the deploy was captured for is still
//     the signed-in one. Checked before the optimistic append, the fresh-price
//     overwrite, the stash and the navigation; when it fails, all four are
//     skipped.
//   - buildOptimisticBattleEntry / appendOptimisticBattle: the post-deploy
//     settle's entry (Delight Layer Task 4, ruling R-T4-S1), now carrying its
//     owner (`ownerId`, so the poll's owner filter keeps it) and an explicit
//     local-origin marker (`localOrigin: true`, so the hub's Activity can leave
//     it out until the server document replaces it).
//
// Pure: no React, no Firebase, no clock. Every value arrives as an argument.

/** A real server id: a nonempty string with no surrounding space. Anything else is no id. */
export function handoffBattleId(agentMeta) {
  const id = agentMeta?.agentBattleId;
  return typeof id === 'string' && id.length > 0 && id.trim() === id ? id : null;
}

/** The captured owner is a real uid and is still the signed-in one. */
export function isHandoffOwnerCurrent(capturedUid, currentUid) {
  return typeof capturedUid === 'string' && capturedUid.length > 0 && capturedUid === currentUid;
}

/**
 * The optimistic `activeAgentBattles` entry for a battle the server just created.
 *
 * Shape is the adapter's contract (warpBattleAdapter.toLiveGame): `status` must
 * be 'active' to count as live, and expiresAt/activatedAt give the endgame
 * clock. It carries the same fields the real agentBattles doc does, because
 * ManageStation hands this very object to handleOpenAgentBattle, which hydrates
 * the Battle View from portfolio / opponent / gameMode / groupId.
 *
 * `groupId: null` is load-bearing: a Command-Center deploy is always a casual
 * BaggerBomb battle, never voidable, which is why this entry may bypass the
 * poll's voided-group exclusion (App.jsx, the (B) note at the settle).
 */
export function buildOptimisticBattleEntry({
  agentBattleId, ownerUid, agentId, expiresAt, nowIso, portfolio, bench, startingPrices, opponentPortfolio, opponentBench,
}) {
  return {
    id: agentBattleId,
    agentId,
    ownerId: ownerUid,
    localOrigin: true,
    status: 'active',
    expiresAt: expiresAt || null,
    activatedAt: nowIso,
    createdAt: nowIso,
    portfolio: {
      ...(portfolio || {}),
      bench: bench || null,
      startingPrices,
    },
    opponent: opponentPortfolio ? { portfolio: opponentPortfolio, bench: opponentBench } : null,
    gameMode: null,
    groupId: null,
  };
}

/**
 * Appends the entry unless a battle with its id is already listed (a repeat
 * inside one poll window must not count twice). The next successful poll
 * replaces the whole array, so the entry self-heals with no bookkeeping.
 */
export function appendOptimisticBattle(prev, entry) {
  const existing = Array.isArray(prev) ? prev : [];
  if (existing.some((b) => b?.id === entry.id)) return existing;
  return [...existing, entry];
}
