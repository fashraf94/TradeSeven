// src/utils/leagueStarState.js
//
// League Battle View V2 — per-star live "disposition" derivation (Phase 1, pure
// + node-clean). Maps a holding's current scorer reading to one of the locked
// design states: heating · edge · hit · danger · busted · quiet.
//
// SCORING DISCIPLINE (BUILD_RULES §4): no new threshold math. The hit/bust
// boundaries cite THRESHOLD_MULTIPLIERS (1.0 / -1.0) directly, and the
// "approaching a line" edge/danger zones REUSE the canonical detectRedZone
// (baggerBombUtils.js:182-233 — the 75%-of-next-threshold zone-start). If the
// design ever retunes that proximity, it changes in one canonical place.
//
// DIRECTION: the multiplier and badges handed in are ALREADY direction-correct
// — calculateAssetScoreV3 negates for shorts internally (baggerBombUtils.js:
// 538-552). `direction` is carried for presentation only; we do NOT re-negate
// here (that would double-negate shorts — the bug flat6BattleEnrichment.js:84-92
// warns against).

import { detectRedZone } from './baggerBombUtils';
import { THRESHOLD_MULTIPLIERS } from '../constants/baggerBombScoring';

const POSITIVE_BADGES = new Set(['bagger', 'doubleBagger', 'tenBagger']);
const NEGATIVE_BADGES = new Set(['bust', 'crash', 'meltdown']);

/**
 * The star's live disposition. Precedence (first match wins):
 *   1. busted — a bust tier crossed (badge set) OR multiplier ≤ -1.0. Sticky.
 *   2. hit    — a bagger tier crossed (badge set) OR multiplier ≥ 1.0. Sticky:
 *               a star that popped then pulled back to 0.9 still reads `hit`.
 *   3. danger — no badge yet, inside the bust red zone (detectRedZone negative).
 *   4. edge   — no badge yet, inside the bagger red zone (detectRedZone positive).
 *   5. heating— positive drift below the edge zone (0 < multiplier < zone start).
 *   6. quiet  — flat / small negative wobble (the default).
 *
 * Edge case (documented): a star that crossed a bust tier reads `busted` even if
 * it earlier earned a bagger — the down-move is the louder current signal.
 *
 * `prevState` is accepted (and ignored in V1) so the meter can diff it for
 * `justIn` in ONE place; deriveStarState stays a pure function of the CURRENT
 * reading, referentially transparent.
 *
 * @param {{ multiplier?: number, badges?: string[], direction?: string, prevState?: string|null }} args
 * @returns {'hit'|'busted'|'edge'|'danger'|'heating'|'quiet'}
 */
export function deriveStarState({ multiplier = 0, badges = [], direction = 'long', prevState = null } = {}) {
  void direction; // presentation only — multiplier/badges are already direction-correct
  void prevState; // diffed by the caller (justIn), not here
  const mult = Number.isFinite(multiplier) ? multiplier : 0;
  const list = Array.isArray(badges) ? badges : [];

  const hasBust = list.some((b) => NEGATIVE_BADGES.has(b));
  const hasBagger = list.some((b) => POSITIVE_BADGES.has(b));

  if (hasBust || mult <= THRESHOLD_MULTIPLIERS.bust) return 'busted';
  if (hasBagger || mult >= THRESHOLD_MULTIPLIERS.bagger) return 'hit';

  const zone = detectRedZone(mult, list);
  if (zone?.direction === 'negative') return 'danger';
  if (zone?.direction === 'positive') return 'edge';

  if (mult > 0) return 'heating';
  return 'quiet';
}
