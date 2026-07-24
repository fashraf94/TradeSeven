// api/_utils/wireChains.js
// FantasyTimes Wire — chain resolution (Spec V1.5 §4.6, D2).
//
// Chain key: (reporter, server-canonical primaryTicker, eventType FAMILY)
// within the 5-completed-sessions-strictly-prior + current window. Pure over
// entry arrays; the CALLER supplies prior-day entries (immutable docs, read
// pre-transaction) and today's entries (reread INSIDE the transaction, so
// two concurrent same-chain stories serialize — B6).
//
// Root generation: no in-window match → chainId = own storyId (self-rooting).
// Match → inherit the MOST RECENT match's chainId (window governs
// continuation, never root).
//
// Documented limitation (F2-8): an entry landing via replay may post-date
// same-day entries that would otherwise have inherited its chain,
// fragmenting that family for that day. Cosmetic, confined to failure days;
// no repair machinery by design.

import { EVENT_CONTRACTS } from './wireContracts.js';

/** Serialize the chain key. Null primaryTicker (macro/econ entries) is a
 *  legitimate key component — one reporter's zero-ticker family chains as a
 *  single continuing story, which is the D2 intent. */
export function chainKeyOf(reporter, primaryTicker, eventType) {
  const family = EVENT_CONTRACTS[eventType]?.family || 'unknown';
  return `${reporter}|${primaryTicker || '-'}|${family}`;
}

/**
 * Resolve the chainId for a candidate entry.
 *
 * @param {object[]} windowEntries — entries from the lookback window docs
 *   (prior sessions first, then today's — order within the array is the
 *   publication order the caller assembled; most-recent match wins).
 * @param {object} candidate — { storyId, reporter, primaryTicker, eventType }
 * @returns {string} chainId
 */
export function resolveChainId(windowEntries, candidate) {
  const key = chainKeyOf(candidate.reporter, candidate.primaryTicker, candidate.eventType);
  for (let i = windowEntries.length - 1; i >= 0; i--) {
    const e = windowEntries[i];
    if (!e || e.quarantined) continue;
    const facts = e.agentFacts;
    if (!facts) continue;
    const entryKey = chainKeyOf(e.reporter, facts.primaryTicker, facts.eventType);
    if (entryKey === key && facts.chainId) return facts.chainId;
  }
  return candidate.storyId;
}
