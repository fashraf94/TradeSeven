// src/services/dueIdeaCheck.js
//
// Pilot P1c — founder ruling E1 (16 Oct 2026; pilot spec Amendment E): the
// deploy station's question BEFORE any deploy call — is the agent's equipped
// idea due for review with nothing ready to ride? A due idea never blocks a
// deploy; the player is told before (the screen this answer opens,
// DueIdeaInterstitial.jsx) and after (the ceremony's success screen, from the
// deploy response's `hypothesisNotice`).
//
// The answer is read from the list's server-written versions through the
// Forge's own GET (api/forge/watchlists/[id]/hypothesis-versions.js) and the
// one shared predicate (src/constants/hypothesisRecords.js dueDeployPending —
// the deploy resolver's rule; BUILD_RULES §9). The title is table C V1.2's
// line under founder ruling B3's [SYM]/[LIST] rule, from the GET's frozen
// `deployedLists` — never the live list.
//
// GATED: HYPOTHESIS_RECORDS_ENABLED false → no request at all. Otherwise the
// server's gate decides (an owner off the allowlist gets 404 disabled), and
// ANY failure answers "nothing due" so the deploy runs exactly as before — the
// server stays the authority, and its success response still says when the
// battle carried nothing.

import { isHypothesisRecordsOn } from '../config/featureFlags';
import { dueDeployPending } from '../constants/hypothesisRecords';
import { listHypothesisVersions } from './hypothesisVersionService';
import { dueDeployTitleFor } from '../components/Forge/Watchlist/ideaCopy';

/**
 * The due idea of one list, read now. Throws what the GET throws.
 *
 * @returns {Promise<null | { watchlistId: string, version: number, currentVersion: number, title: string|null }>}
 */
export async function readDueIdea(watchlistId) {
  const data = await listHypothesisVersions(watchlistId);
  const due = dueDeployPending(data?.versions);
  if (!due) return null;
  const frozen = data?.deployedLists?.[due.version] ?? null;
  return {
    watchlistId,
    version: due.version,
    currentVersion: Number.isInteger(data?.currentVersion) ? data.currentVersion : 0,
    title: dueDeployTitleFor(due, frozen),
  };
}

/**
 * The check a deploy runs first: the agent's equipped list's due idea, or
 * null. Never throws; never asks when the flag is off or nothing is equipped.
 *
 * @param {{ equippedWatchlistId?: string|null }|null} agent  the ranked agent (a casual clone inherits its equip)
 */
export async function checkDueIdea(agent) {
  if (!isHypothesisRecordsOn()) return null;
  const watchlistId = agent?.equippedWatchlistId;
  if (typeof watchlistId !== 'string' || watchlistId.length === 0) return null;
  try {
    return await readDueIdea(watchlistId);
  } catch (err) {
    console.warn('[Deploy] The idea check could not be read; deploying as before:', err?.code || err?.message || err);
    return null;
  }
}
