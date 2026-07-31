// api/_utils/wireContinuity.js
// FantasyTimes Wire — continuity prompt block (Spec V1.5 §4.6, M3, P7).
//
// The block a reporter sees about their own recent coverage is built from
// DETERMINISTIC DIGESTS + EVENT TYPES + DATES ONLY. No headlines, no human
// prose — headlines are excluded from EVERY upstream generation context
// (P7 extended per M3; §9 asserts no headline substring reaches a prompt).
//
// Gated by CONTINUITY_MEMORY_ENABLED (which requires WIRE_WRITES_ENABLED —
// wireFlags enforces the dependency). Callers append the returned string to
// the system prompt; null appends nothing, keeping flag-off prompts
// byte-identical.

import { WIRE_COLLECTION } from './wireContracts.js';
import { wireLookbackDates } from './wireCalendar.js';
import { classifyWireEntry, isRenderableState, warnSkippedWireEntry } from './wireEntryGuard.js';

const MAX_CONTINUITY_LINES = 8;

/**
 * Build the reporter's continuity block from the lookback window
 * (5 completed sessions strictly prior + today).
 *
 * @param {object} db
 * @param {object} o
 * @param {string} o.reporter
 * @param {string} o.marketDate — deriveMarketDate output for this generation
 * @returns {Promise<string|null>} block text, or null when nothing to show
 */
export async function buildContinuityContext(db, { reporter, marketDate }) {
  let dates;
  try {
    dates = wireLookbackDates(marketDate);
  } catch (err) {
    // Walker horizon guard or bad anchor — degrade to no block, log once.
    console.warn('[WireContinuity] lookback unavailable:', err?.message || err);
    return null;
  }

  const snaps = await Promise.all(
    dates.map((d) => db.collection(WIRE_COLLECTION).doc(d).get())
  );

  const lines = [];
  for (let i = 0; i < snaps.length; i++) {
    const snap = snaps[i];
    if (!snap.exists) continue;
    for (const entry of snap.data().entries || []) {
      if (entry.reporter !== reporter) continue;
      if (entry.quarantined) continue;
      // N1.4 fail-closed version guard (P2-29), landed BEFORE the continuity
      // flip: only LEGACY (pre-stamp, Amendment J) and STAMPED (recognized
      // version, complete set) entries may reach a generation prompt.
      // Unknown or malformed versions are skipped + logged, never rendered
      // on trust.
      const cls = classifyWireEntry(entry);
      if (!isRenderableState(cls.state)) {
        warnSkippedWireEntry('WireContinuity', entry, cls);
        continue;
      }
      const facts = entry.agentFacts;
      if (!facts || !facts.digest) continue;
      // Digest + eventType + date ONLY — never entry.headline (M3/P7).
      lines.push(`- ${dates[i]} [${facts.eventType}] ${facts.digest}`);
    }
  }
  if (lines.length === 0) return null;

  const recent = lines.slice(-MAX_CONTINUITY_LINES);
  return [
    '',
    'YOUR RECENT COVERAGE (typed wire digests — dates + facts only):',
    ...recent,
    'If today\'s event continues one of these stories, write it as a follow-up: reference the development and what changed, don\'t re-introduce the story from scratch.',
  ].join('\n');
}
