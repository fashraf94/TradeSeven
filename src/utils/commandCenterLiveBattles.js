// src/utils/commandCenterLiveBattles.js
//
// L-A follow-up (B) — the Command Center live-battle eligibility filter. The
// active-battle poll (App.jsx) reads agentBattles by owner+status only, so a
// battle whose GROUP was VOIDED still reads as live on the "04 · Manage" card —
// the same propagation gap the L-A void exists to close (the arena already treats
// a voided group as terminal via deriveArenaState → 'complete'). This is the
// READ-TIME group-status exclusion: the void lives ONLY on the group doc
// (voidGroup never writes the battle doc — the createAgentBattle shape is fenced),
// so the poll looks the group up and drops the battle here.
//
// Pure + node-clean (deriveArenaTerminalKind imports only GROUP_STATUS). The
// voided decision reuses that ONE tested predicate — no component/util hand-rolls
// `group.status === VOIDED` — so the card and the arena can never disagree on what
// "voided" means.

import { deriveArenaTerminalKind } from '../components/League/battleArena/arenaStateMap';

/**
 * Drop the owner's active agentBattles whose GROUP is VOIDED. EXPIRY-INDEPENDENT:
 * a voided group's battle is excluded even mid-day with a future `expiresAt` (the
 * operator scenario — void a group mid-session and its card must not keep counting
 * down as live). A battle with no `groupId` (a casual vs-CPU deploy — it can never
 * be voided) is kept, and a battle whose group could not be resolved is kept
 * (fail-open: a transient group-read miss must not blank a genuinely live battle,
 * matching the poll's retain-last-known-good posture). Pure.
 *
 * @param {Array<{groupId?: string}>} battles - already owner+status('active') scoped,
 *   training clones already dropped by the caller.
 * @param {Record<string, {status?: string}>} groupsById - resolved group docs keyed by id.
 * @returns {Array} the battles eligible for the live card.
 */
export function excludeVoidedGroupBattles(battles, groupsById = {}) {
  return (battles || []).filter((b) => {
    if (!b?.groupId) return true; // casual vs-CPU: no group, cannot be voided
    const group = groupsById[b.groupId];
    if (!group) return true;      // unresolved group → fail-open (never blank a live battle)
    return deriveArenaTerminalKind(group) !== 'voided';
  });
}

// ── Phase 1.5 · Command Center multi-battle ─────────────────────────────────
//
// Battle-TYPE classification for the live-battle card layer. The discriminator is
// `Boolean(b.groupId)` — founder-ruled over gameMode and the agentId prefix because
// it is the only signal that is BOTH flag-agnostic AND correct for the optimistic
// post-deploy entry:
//   - RANKED (League / tournament) battles carry a groupId. The fenced
//     createAgentBattle joint-stamp writes gameMode+groupId together for tournament
//     modes only (api/_utils/agentBattleService.js), so groupId ⇔ ranked.
//   - CASUAL / BaggerBomb battles never carry a groupId.
//   - gameMode is NULLABLE at the card: the optimistic post-deploy settle entry
//     (App.jsx, DEPLOY_SKY_COUPLING) hard-codes gameMode:null, groupId:null for up
//     to one poll interval, so a gameMode-keyed classifier would misread it.
//   - the `casual-agent-` agentId prefix only exists flag-ON (a flag-off casual
//     deploy runs on the real agent id), so isCasualCloneId is confirm-only.
// Training battles never reach the card (dropped upstream by the training-agent-
// prefix in the poll), so the card only ever classifies ranked vs BaggerBomb.

export const BATTLE_TYPE_RANKED = 'ranked';
export const BATTLE_TYPE_BAGGERBOMB = 'baggerbomb';

/** The live-battle card's type, from the flag-agnostic groupId-presence signal. */
export function classifyBattleType(battle) {
  return battle && battle.groupId ? BATTLE_TYPE_RANKED : BATTLE_TYPE_BAGGERBOMB;
}

/** Human label for a live-battle card (acceptance #4: each card labeled by type). */
export function battleTypeLabel(battle) {
  return classifyBattleType(battle) === BATTLE_TYPE_RANKED ? 'Ranked' : 'BaggerBomb';
}

/**
 * True when the owner has a live BaggerBomb (casual) battle. This is the per-type
 * gate for the Command Center Deploy CTA, which always starts a BaggerBomb: flag-ON
 * a second BaggerBomb is blocked while a live one runs, but a live RANKED battle does
 * NOT block (it runs concurrently under a separate clone id). Flag-OFF the CTA uses
 * the legacy any-live-battle gate instead (no clone exists, so a second deploy would
 * collide on the real agent) — see the dashboards' `deployBlockedByLive`.
 */
export function hasLiveBaggerBomb(battles) {
  return Boolean(findLiveBaggerBomb(battles));
}

/**
 * The owner's live BaggerBomb (casual) battle, or null.
 *
 * The Command Center Sync Desk describes THIS battle and no other: framework
 * §3.1 scopes the Dashboard to BaggerBomb, and a ranked battle never drives the
 * Desk in Pass 1. Selecting by index could not honour that — sortLiveBattles
 * puts ranked FIRST (BATTLE_TYPE_ORDER below), so `orderedLiveBattles[0]` picks
 * the ranked battle precisely when both are live.
 *
 * Deliberately built on the SAME classifyBattleType the Manage card labels from
 * (ManageStation.jsx). A second discriminator — `gameMode`, say — would let the
 * Desk's eyebrow and the card beneath it disagree about which game is on
 * screen, which is the display-agreement failure BUILD_RULES §9 exists to
 * prevent.
 *
 * Requires active status defensively, for the same reason hasLiveBaggerBomb
 * always has: a stale COMPLETED casual battle must never latch a surface on.
 * Deterministic across a set: takes the first in sortLiveBattles order, so two
 * casual battles (not reachable today — decide.js caps one active battle per
 * agentId — but cheap to be right about) resolve stably.
 */
export function findLiveBaggerBomb(battles) {
  const live = (battles || []).filter(
    (b) => b && b.status === 'active' && classifyBattleType(b) === BATTLE_TYPE_BAGGERBOMB,
  );
  return live.length > 1 ? sortLiveBattles(live)[0] : (live[0] || null);
}

/**
 * Deterministic order for the live-battle card set (acceptance #4: no unsorted index
 * access). Ranked first (higher-stakes, competitive), then most-recently-activated,
 * then id — a total order so the render never depends on Firestore's arrival order.
 * The set is ≤2 by game mechanics (≤1 ranked + ≤1 casual clone; training filtered
 * upstream; decide.js caps one active battle per agentId). Pure; does not mutate.
 */
const BATTLE_TYPE_ORDER = { [BATTLE_TYPE_RANKED]: 0, [BATTLE_TYPE_BAGGERBOMB]: 1 };
export function sortLiveBattles(battles) {
  return [...(battles || [])].sort((a, b) => {
    const byType = BATTLE_TYPE_ORDER[classifyBattleType(a)] - BATTLE_TYPE_ORDER[classifyBattleType(b)];
    if (byType !== 0) return byType;
    const ta = a?.activatedAt || a?.createdAt || '';
    const tb = b?.activatedAt || b?.createdAt || '';
    if (ta !== tb) return ta < tb ? 1 : -1; // most-recently-activated first
    const ia = String(a?.id ?? '');
    const ib = String(b?.id ?? '');
    if (ia === ib) return 0;              // comparator contract: equal → 0
    return ia < ib ? -1 : 1;             // stable id tiebreak
  });
}

/** Single-sourced copy for the disabled-CTA reason (acceptance #2). */
export const DEPLOY_BLOCK_REASON = 'A BaggerBomb battle is already running — one at a time.';

/**
 * Derive the Command Center deploy-gate values from a shell's live-battle set — the ONE
 * source of truth shared by the mobile and desktop shells (which otherwise duplicate this
 * verbatim, risking silent divergence). Pure; flag-off every value reduces to the legacy
 * `isLive`-gated behavior, byte-identical.
 *
 * @param {Object} p
 * @param {Array} p.liveBattles - the owner's active battles (training-clone- and
 *   voided-group-excluded upstream by the poll).
 * @param {{activeBattleId?: string}|null} p.agent - the REAL agent doc, for the equip lock.
 * @param {boolean} p.concurrencyEnabled - CASUAL_CLONE_CONCURRENCY_ENABLED.
 * @returns {{orderedLiveBattles: Array, deployBlockedByLive: boolean,
 *   deployBlockReason: (string|null), equipLocked: boolean}}
 */
export function deriveDeployGate({ liveBattles, agent, concurrencyEnabled }) {
  // Legacy any-live gate, derived HERE from the same liveBattles the gate reasons over —
  // never taken as a separate param that could drift from it. Matches the shells' isLive.
  const isLive = Boolean((liveBattles || [])[0]);
  const orderedLiveBattles = concurrencyEnabled ? sortLiveBattles(liveBattles) : liveBattles;
  // The Deploy CTA starts a BaggerBomb: flag-on it is blocked only by a live BaggerBomb (a
  // live ranked battle runs concurrently under a separate clone id); flag-off keep the
  // legacy any-live-battle block (no clone exists, a second deploy collides on the real
  // agent and decide.js blocks it), byte-identical.
  const deployBlockedByLive = concurrencyEnabled ? hasLiveBaggerBomb(liveBattles) : isLive;
  const deployBlockReason = (concurrencyEnabled && deployBlockedByLive) ? DEPLOY_BLOCK_REASON : null;
  // Equip lock label bound to the same agent.activeBattleId source as the actual lock
  // (§9): flag-on a casual battle runs on the clone and must NOT read as a locked ranked
  // loadout. Flag-off keep isLive, byte-identical.
  const equipLocked = concurrencyEnabled ? Boolean(agent?.activeBattleId) : isLive;
  return { orderedLiveBattles, deployBlockedByLive, deployBlockReason, equipLocked };
}
