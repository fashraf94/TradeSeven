// src/components/League/trainingClimbPreviewGate.js
//
// League Training-tab CLIMB PREVIEW — the show/hide decision, in ONE place so the
// desktop (DeskTrainingPanel) and mobile (TrainingShell) render sites can never
// drift on WHEN (shouldPreviewClimb) or WHETHER (climbPreviewEnabled) the
// real-data climb replaces the re-entry card.
//
// Node-clean for the pure predicate: shouldPreviewClimb imports only the zero-DOM
// GROUP_STATUS enum, so its co-located test's import IS the dependency-surface
// guard. climbPreviewEnabled additionally reads the feature flag + the dev param;
// the param half is window-guarded so it stays false (never throws) under SSR /
// the node test env.

import { GROUP_STATUS } from '../../constants/leagueTournament';
import { LEAGUE_TRAINING_CLIMB_PREVIEW_ENABLED } from '../../config/featureFlags';

/**
 * Is the climb preview enabled at all — the dark flag OR the dev-preview param
 * `?trainingClimbPreview=1` (the `?leagueClimb=1` idiom)? Resolved HERE so both
 * mount sites share one gate (no per-file `flag || param` copy to drift). Reads
 * false with no window (SSR / node test) — the param can't participate there.
 * @returns {boolean}
 */
export function climbPreviewEnabled() {
  if (LEAGUE_TRAINING_CLIMB_PREVIEW_ENABLED) return true;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('trainingClimbPreview') === '1';
}

/**
 * Should the Training tab render the real-data climb preview for this pod?
 * True only when (a) the feature is enabled, (b) the pod is actually in BATTLE (a
 * pre-bell DRAFTING/AWAITING_OPEN pod has no five-day climb yet → keeps its
 * re-entry card; a null pod is the cold-start), and (c) the pod actually has seats
 * to plot (a malformed seatless BATTLE doc falls back to the card, never a hollow
 * climb). Pure.
 * @param {{status?: string, players?: any[]}|null} pod  the active training pod (a tournamentGroups doc), or null
 * @param {boolean} enabled  the resolved gate (climbPreviewEnabled())
 * @returns {boolean}
 */
export function shouldPreviewClimb(pod, enabled) {
  return enabled === true
    && pod?.status === GROUP_STATUS.BATTLE
    && Array.isArray(pod?.players)
    && pod.players.length > 0;
}
