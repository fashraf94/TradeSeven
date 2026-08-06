// api/_utils/identityMigrationFeed.js
//
// Composition PR 2 — the identityMigration activity-feed projection (M12 +
// R5-M2; test A44). Entries are built at --apply time IN THE CANDIDATE
// NAMESPACE (they ride compositionCandidateState/{id}.feedEntries — design
// note §2) and publish through the activation epoch: no user sees "adjusted to
// fit your archetype" before the adjustment is authoritative, and a rollback
// leaves them inactive. The entry shape mirrors the battle-doc statusFeed
// entries the AgentActivityFeed already renders (arrayUnion writers, e.g.
// voiceLayerTradeNarration.js:232) so post-activation publishing is a plain
// append, no renderer change.
//
// COPY NOTE: the sentences below are PRODUCT COPY (not governed registry
// content — the governed layer is the cells' advisory text). Flagged for
// founder copy review in the PR 2 handback.

import { COMPOSITION_MIGRATION_FEED_ENABLED } from './compositionConfig.js';

const ACTION_COPY = {
  clamp: ({ ruleId, param }) => `Adjusted ${ruleId} — ${param} moved to the nearest setting your archetype offers.`,
  floor: ({ ruleId, param }) => `Adjusted ${ruleId} — ${param} raised to your archetype's floor.`,
  replace: ({ ruleId, param }) => `Adjusted ${ruleId} — ${param} switched to a setting your archetype offers.`,
  unequip: ({ ruleId }) => (ruleId
    ? `Unequipped ${ruleId} — off-identity for your archetype under the new compatibility ruling.`
    : 'Unequipped a bundle — it carried a rule that is off-identity for your archetype under the new compatibility ruling.'),
};

/**
 * Build candidate-namespaced feed entries from overlay entries. One entry per
 * user-meaningful mutation (param adjustments + unequips); agent-doc
 * equippedBundleIds echoes are folded into their bundle's unequip entry.
 */
export function buildIdentityMigrationFeedEntries(overlayEntries, { nowIso, migrationRunId }) {
  const out = [];
  for (const e of overlayEntries) {
    if (e.host === 'agentDoc') continue; // the equippedBundleIds echo of a bundle unequip
    const param = e.field.includes('paramValues.') ? e.field.split('paramValues.').pop() : null;
    const build = ACTION_COPY[e.action];
    if (!build) continue;
    out.push({
      type: 'identity_migration',
      at: nowIso,
      copy: build({ ruleId: e.ruleId, param }),
      meta: {
        action: e.action, ruleId: e.ruleId ?? null, param,
        docPath: e.docPath, entryKey: e.entryKey, migrationRunId,
      },
    });
  }
  return out;
}

/**
 * THE publication gate (A44): entries become user-visible ONLY when (a) the
 * feed flag is on AND (b) the activation record names this candidate state as
 * the live epoch. Pre-activation, on rollback, or under a different epoch:
 * []. Admin surfaces may render runDoc.feedEntries directly — marked
 * candidate/unapplied — without this gate.
 */
export function projectIdentityMigrationFeed({
  runDoc,               // compositionCandidateState/{id} data
  activationRecord = null, // { activeIdentityVersion, candidateStateId, ... } | null
  enabled = COMPOSITION_MIGRATION_FEED_ENABLED,
} = {}) {
  if (!enabled) return [];
  if (!runDoc || !Array.isArray(runDoc.feedEntries)) return [];
  if (!activationRecord || activationRecord.candidateStateId !== runDoc.candidateStateId) return [];
  return runDoc.feedEntries;
}
