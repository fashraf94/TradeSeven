// api/_utils/agentBattleBinding.js
//
// THE AGENT-BELONGS-TO-THIS-BATTLE CHECK — one predicate, one error code, one
// meaning, for every route that takes an `agentId` in its body beside a
// `battleId`.
//
// `POST /api/agent/file-directive` carried this check from the start (its
// header calls it "a check the chat route never made"); `chat.js` and
// `ensure-opener.js` did not. Ownership alone is not the same guarantee: a
// caller who owns TWO battles could name battle A and agent B, and every route
// that then reads `agents/{body.agentId}` would answer for an agent that is not
// the one this battle is bound to. The battle doc's top-level `agentId` is set
// once at creation (`createAgentBattle`, agentBattleService.js:105) and is
// never rewritten, so it is the authority on which agent a battle belongs to.
//
// This module is the SHARED helper rather than a third copy of the same
// comparison (BUILD_RULES §4 — the local-copy pattern is a documented bug
// class; BUILD_RULES §9 — one decision, one source). Zero imports, so it can
// never drag a dependency into a route's graph.
//
// WHAT THIS FILE OWNS is only "does this id name this battle's agent". Whether
// an id is REQUIRED is the route's own stance and stays at the call site — and
// all three routes now take the same stance:
//   - chat.js and file-directive.js 400 on a missing `agentId`, so the check is
//     unconditional there;
//   - ensure-opener.js resolves the agent from the battle doc, so a missing id
//     costs it nothing to answer — but both of its shipped callers send one
//     (AgentChat.jsx, mounted by the Battle View controller column and by the
//     arena's Command Center tab), so its check is unconditional too and an
//     ABSENT id is refused as a mismatch rather than waved through.

/** The error code every route returns on a mismatch (`file-directive.js` shipped it first). */
export const AGENT_BATTLE_MISMATCH = 'agent_battle_mismatch';

/**
 * True when `agentId` names the agent this battle is bound to.
 *
 * A non-string or empty id is never a match: an id that cannot be a Firestore
 * document id cannot be this battle's agent, and answering `true` for
 * `undefined === undefined` would turn a battle doc with no `agentId` into a
 * route that accepts any caller who also sends none.
 *
 * @param {object|undefined} battle  the agent battle doc
 * @param {unknown} agentId          the id the caller named
 * @returns {boolean}
 */
export function agentBelongsToBattle(battle, agentId) {
  return typeof agentId === 'string'
    && agentId.length > 0
    && battle?.agentId === agentId;
}

export default agentBelongsToBattle;
