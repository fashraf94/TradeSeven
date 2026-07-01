// api/_utils/directiveIdentity.js
//
// Archetype-Integrity / "Third Path" — Phase C (V2 plan). The SINGLE effective-
// archetype resolver that the gated voice injection (D), the directive gate (E),
// and the Diversifier cap (F) all read, so voice and mechanics never disagree
// about which archetype is in force.
//
// Inert in Phase C — nobody imports it yet (D/E/F wire it). No live behavior.
//
// CF-1 INVARIANT (the safety the lean ADOPT #2 rests on — verified this session):
//   During a battle, `battle.agentContext.archetype === agent.archetype` is
//   guaranteed, because an agent's archetype cannot change mid-battle:
//     • api/agent/change-archetype.js:77 is battle-locked (throws 'battle_active'
//       when agent.activeBattleId is set) and writes ONLY agents/{id}.archetype.
//     • api/_utils/agentBattleService.js:150-152 sets battle.agentContext.archetype
//       ONCE at creation (agentData.archetype || 'unknown') and it is NEVER
//       rewritten mid-battle (no battleRef.update payload touches agentContext).
//   Because that guarantee holds, the integrity gate does NOT clear/revalidate a
//   live directive on archetype change (there is no mid-battle change to react to).
//   A tripwire at change-archetype.js:77 fires the alarm if the lock is ever lifted.
//
// WHY PREFER THE BATTLE SNAPSHOT: it is the field PROVABLY immutable mid-battle.
// An adversarial sweep this session found two edge paths that can touch
// `agent.archetype` (a latent endpoint-only-lock gap via the generic
// src/services/agentService.js updateAgent + permissive firestore.rules, and the
// known decide.js lock-window race documented in
// docs/audits/2026-06-12_P3_STAGE0_DISCOVERY_REPORT.md:38) — but NEITHER can alter
// the frozen agentContext.archetype. Preferring the snapshot makes mechanics
// follow the battle's frozen identity deterministically, robust to those edges.
//
// NO 'analyst' FALLBACK HERE (ADOPT #4): this is the directive-WRITE identity. A
// missing archetype returns null; the gate treats null as "no directive." The
// 'analyst' display fallback lives only in src/data/archetypeAdjustments.js
// (getArchetypeZones), never on the directive path. (A stored 'unknown' snapshot
// passes through verbatim and is caught downstream by the gate's #4 handling —
// getAllowlist('unknown') → [] → no directive.)
//
// See docs/audits/20260625_ARCHETYPE_INTEGRITY_BUILD_PLAN_V2.md (CF-1).

/**
 * Resolve the archetype in force for directive decisions.
 *
 * @param {Object} [battle] - the agent battle doc (carries the frozen
 *                            agentContext.archetype snapshot).
 * @param {Object} [agent]  - the agent doc (live archetype; used only when there
 *                            is no battle snapshot).
 * @returns {string|null} the effective archetype code-id, or null if neither
 *                        source has one (gate → no directive).
 */
export function getEffectiveArchetype(battle, agent) {
  return battle?.agentContext?.archetype || agent?.archetype || null;
}

export default getEffectiveArchetype;
