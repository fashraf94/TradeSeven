// api/_utils/legacyDirectiveSanitize.js
//
// Archetype-Integrity / "Third Path" — Phase G, the legacy directives[] read-side
// sanitize. The deterministic gate (E1) makes battle.directive core-safe, but an
// OLDER, write-dead `agent.directives[]` array is still READ into two cognition
// prompts: api/agent/debate.js (reads agent.directives) and
// api/cron/agent-batch-review.js (reads battle.agentContext.directives). A stale
// against-archetype string left in that array — historical data from before the
// writer was removed — could leak into agent reasoning through that side-door.
//
// The gate closes the front door (battle.directive); this closes the side door.
// READ-SIDE ONLY: nothing here writes the array; it stays write-dead. When the
// feature is ON (observe OR enforce — safe in both, since neutralizing a stale,
// write-dead read drops no live signal), both reads contribute nothing. Flag-OFF
// is byte-identical: the original render logic runs verbatim.

import { ARCHETYPE_INTEGRITY_MODE } from '../../src/config/featureFlags.js';

// The same empty-state sentinel both legacy prompts already used.
export const NO_LEGACY_DIRECTIVES = 'No active directives';

/**
 * Render a legacy directives array into prompt lines, or neutralize it when
 * archetype integrity is on. `formatLine(d, i)` builds one line (each call site
 * keeps its own numbering/bullet format). Returns NO_LEGACY_DIRECTIVES for an
 * empty/absent array OR whenever the flag is non-off (the side-door is closed).
 *
 * Flag-OFF reproduces the original `arr?.length ? arr.map(fmt).join('\n') :
 * sentinel` behavior verbatim — including the pre-existing object render — so OFF
 * is byte-identical.
 *
 * @param {Array}    directives - the legacy directives array (or undefined).
 * @param {Function} formatLine - (directive, index) => string.
 * @returns {string} the rendered block, or the empty-state sentinel.
 */
export function renderLegacyDirectives(directives, formatLine) {
  if (ARCHETYPE_INTEGRITY_MODE !== 'off') return NO_LEGACY_DIRECTIVES; // side-door closed
  return Array.isArray(directives) && directives.length > 0
    ? directives.map(formatLine).join('\n')
    : NO_LEGACY_DIRECTIVES;
}

export default renderLegacyDirectives;
