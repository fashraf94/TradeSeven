// src/components/Research/Sheet/ranksLabel.js
//
// The two-view shell — R-32, the Ranks tab's one-line label (spec
// docs/specs/RESEARCH_MODAL_SHELL_SPEC_V1.md SB-7): the group the shown rank is
// within, which rank, and the day of the reading — *Utilities · technical rank
// · Wed Nov 11*, never *All stocks* when the rank is within a sector.
//
// BUILD_RULES §9: the label describes the badge CompeteTab shows selected, from
// the very fields that badge prints — never a parallel source:
//   fundamental  `#{data.compositeRank} of {data.totalPeers}` — the peer group
//                `data.sectorName`, read at `data.computedAt` (peer-rankings).
//   technical    `#{sectorTechnicalRank || techData.technicalRank}` — within the
//                sector (`currentStockRanking.sectorName`, the stockRankings
//                doc's `computedAt`) when the sector rank is there; else the
//                universe rank, so *All stocks*, read at the technical score
//                doc's own time (`updatedAt`, else `computedAt`).
// The day is the reading's ET day; no reading time → no day (never "today").
// PURE and Node-clean.

import { SHELL_COPY } from './sheetCopy.js';

/** A reading's instant in ms: epoch ms, an ISO string, a Firestore Timestamp ({ toMillis } or { seconds }). */
export function readingMs(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v === 'string' && v) { const ms = Date.parse(v); return Number.isFinite(ms) ? ms : null; }
  if (v && typeof v === 'object') {
    if (typeof v.toMillis === 'function') { try { const ms = v.toMillis(); return Number.isFinite(ms) ? ms : null; } catch { return null; } }
    if (typeof v.seconds === 'number' && Number.isFinite(v.seconds)) return v.seconds * 1000 + (Number.isFinite(v.nanoseconds) ? Math.floor(v.nanoseconds / 1e6) : 0);
    if (typeof v._seconds === 'number' && Number.isFinite(v._seconds)) return v._seconds * 1000;
  }
  return null;
}

/** "Wed Nov 11" — the ET day of an instant. */
export function etDayLabel(ms) {
  if (!Number.isFinite(ms)) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }).formatToParts(new Date(ms));
  const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('weekday')} ${get('month')} ${get('day')}`;
}

const named = (s) => (typeof s === 'string' && s.trim() ? s.trim() : null);

/**
 * @param {object} p
 * @param {object|null} p.data                 the peer-rankings payload CompeteTab shows
 * @param {object|null} p.rankingsData         the stockRankings doc CompeteTab reads
 * @param {object|null} p.currentStockRanking  this symbol's row in it
 * @param {object|null} p.techData             the technical score doc (useTechnicalScore)
 * @param {'fundamental'|'technical'} p.selectedView  the badge CompeteTab shows selected
 * @returns {string|null}
 */
export function ranksLabelOf({ data, rankingsData, currentStockRanking, techData, selectedView }) {
  if (!data || typeof data !== 'object') return null;
  if (selectedView === 'technical') {
    const sectorRank = currentStockRanking?.sectorTechnicalRank;
    if (sectorRank) {
      const group = named(currentStockRanking?.sectorName) ?? named(data.sectorName);
      if (!group) return null;
      return SHELL_COPY.ranksLabel(group, SHELL_COPY.ranksTechnical, etDayLabel(readingMs(rankingsData?.computedAt)));
    }
    if (techData && techData.technicalRank != null) {
      return SHELL_COPY.ranksLabel(SHELL_COPY.ranksAllStocks, SHELL_COPY.ranksTechnical, etDayLabel(readingMs(techData.updatedAt ?? techData.computedAt)));
    }
    return null;
  }
  const group = named(data.sectorName);
  if (!group) return null;
  return SHELL_COPY.ranksLabel(group, SHELL_COPY.ranksFundamental, etDayLabel(readingMs(data.computedAt)));
}
