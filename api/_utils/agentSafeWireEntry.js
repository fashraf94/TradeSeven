// api/_utils/agentSafeWireEntry.js
// FantasyTimes Wire — the AgentSafeWireEntry boundary (Phase 2 Spec V1.2
// N1.1, F-M6/F-M7; V1.5 R4-M2 guard applied at projection).
//
// THE STRUCTURAL P7 BOUNDARY. This module is the ONLY permitted importer of
// the raw Wire reader (wireReader.js) — enforced by the N1.1 import-graph
// dependency test (agentSafeWireEntry.boundary.test.js). Consumers
// (voice-layer-cache's packer, voiceLayerPrompt, Phase 3's prompt
// assemblies) see AgentSafeWireEntry DTOs and nothing else: no `headline`,
// no reporter prose, no `sentiment`, no `recommended_action`, no raw story
// fields. `storyId` is retained for LOGGING ONLY — it is a foreign key to a
// public doc carrying headline/sentiment, and the same dependency test
// statically forbids the join (story-collection reads in the consumer set).
//
// DTO construction is an EXPLICIT FIELD COPY (F-M7) — never
// spread-then-delete. A new field on the persisted entry stays invisible
// here until someone adds it to the copy below, on purpose, in review.
//
// N1.4 (fourth consumer): every entry passes the R4-M2 guard BEFORE
// projection — version_skip/malformed entries never become DTOs, logged via
// the shared warn shape.

import { fetchWireDays, resolveSymbolEntries } from './wireReader.js';
import { classifyWireEntry, isRenderableState, warnSkippedWireEntry } from './wireEntryGuard.js';

/**
 * Project one persisted Wire entry to the agent-safe DTO — the eleven
 * spec-named fields (V1.2 N1.1), explicitly copied.
 *
 * @param {object} entry — a persisted, guard-passing day-doc entry
 * @returns {object} AgentSafeWireEntry
 */
export function toAgentSafeWireEntry(entry) {
  const facts = entry.agentFacts || {};
  return {
    storyId: entry.storyId ?? null,          // logging only (N1.1)
    publishedAt: entry.publishedAt ?? null,
    digest: facts.digest ?? null,
    eventType: facts.eventType ?? null,
    primaryTicker: facts.primaryTicker ?? null,
    direction: facts.direction ?? null,
    magnitude: facts.magnitude ?? null,
    keyLevel: facts.keyLevel ?? null,
    figures: facts.figures ?? null,
    qualifiers: facts.qualifiers ?? null,
    subjectRef: facts.subjectRef ?? null,
  };
}

/**
 * Fetch Wire day docs for the newsLine window — the thin I/O pass-through
 * that keeps consumers off wireReader. One call per cache tick (N1.2's
 * fetch budget); missing days are absent, never errors.
 */
export function fetchAgentSafeWireDays(db, marketDates) {
  return fetchWireDays(db, marketDates);
}

/**
 * Resolve one symbol's agent-safe entries from already-fetched day docs.
 * Pure. Applies the N1.4 guard (the newsLine is the fourth consumer), then
 * projects survivors to DTOs.
 *
 * @param {Map<string, object>} days — from fetchAgentSafeWireDays
 * @param {string[]} marketDates — dates in the order to scan
 * @param {string} symbol — validated in-universe ticker (uppercased)
 * @returns {Array<{ marketDate: string, dto: object }>}
 */
export function resolveAgentSafeEntries(days, marketDates, symbol) {
  const out = [];
  for (const { marketDate, entry } of resolveSymbolEntries(days, marketDates, symbol)) {
    const cls = classifyWireEntry(entry);
    if (!isRenderableState(cls.state)) {
      warnSkippedWireEntry('WireNewsLine', entry, cls);
      continue;
    }
    out.push({ marketDate, dto: toAgentSafeWireEntry(entry) });
  }
  return out;
}
