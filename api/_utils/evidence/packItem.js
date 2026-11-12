// api/_utils/evidence/packItem.js
//
// Huddle S1 — THE GATHERED-EVIDENCE PACK ITEM (Amendment C V1.2 §C10), in the shape
// Shared Research, the stock research modal and the Film Room already agreed:
//   { id, kind, fact, source: { recordKind, recordId, label }, at, asOf|null,
//     status: 'verified'|'unverified'|'unavailable', reason|null }
// `id` is deterministic: the first 12 hex characters of a SHA-256 of
// `kind|recordKind|recordId|at`. Script sentences, `names[]` and cards point at these ids
// (A §A7); cards render their source lines from them. No `pin` in S1.
//
// Status rules (C10): a close from the morning record is `verified` with its asOf; a
// headline is stored as an ATTRIBUTION ("{source} reported: {title}") and is `verified` as
// that attribution only; a source that errored or was skipped is a `source_status` item,
// `unavailable`, with its reason. Nothing `unverified` is spoken without the word.
//
// Amendment E §E3: a source the job SKIPPED makes no item at all (only one it tried and could not reach is a
// `source_status` item, "Couldn't reach {source} this morning."); a headline names its publication, never its host
// (publicationNames.js); and C10's kinds gain `tape` (R-25): one item per index from the morning's market context,
// `verified` with its `asOf`, carrying its figures `{ symbol, close, changePct, asOf }` so a tape sentence's index
// figures cite an item (checking that a spoken figure matches its item is S2's).

import { createHash } from 'node:crypto';
import { publicationNameOf } from './publicationNames.js';

export const PACK_KINDS = Object.freeze(['close', 'headline', 'event', 'holding', 'agent_pick', 'opener', 'prior_plan', 'source_status', 'tape']);
export const PACK_STATUS = Object.freeze(['verified', 'unverified', 'unavailable']);

export const packItemIdOf = ({ kind, recordKind, recordId, at }) => createHash('sha256')
  .update(`${kind}|${recordKind ?? ''}|${recordId ?? ''}|${at ?? ''}`, 'utf8').digest('hex').slice(0, 12);

/** Build one pack item; throws on a kind or status outside the agreed vocabulary (a programming error). */
export function packItem({ kind, fact, recordKind = null, recordId = null, label, at, asOf = null, status = 'verified', reason = null }) {
  if (!PACK_KINDS.includes(kind)) throw new Error(`pack item: unknown kind ${kind}`);
  if (!PACK_STATUS.includes(status)) throw new Error(`pack item: unknown status ${status}`);
  if (typeof fact !== 'string' || !fact) throw new Error('pack item: a fact is required');
  return {
    id: packItemIdOf({ kind, recordKind, recordId, at }),
    kind,
    fact,
    source: { recordKind, recordId, label: label ?? null },
    at: at ?? null,
    asOf,
    status,
    reason,
  };
}

/** A headline as an attribution, never a fact (C10), by the publication's name (E3 e). */
export function headlineItem(news) {
  const name = publicationNameOf(news.source) ?? news.source;
  return packItem({
    kind: 'headline',
    fact: `${name} reported: ${news.title}`,
    recordKind: 'symbolDayEvidence.news',
    recordId: news.newsId,
    label: news.sourceKind === 'fantasytimes_story' ? 'FantasyTimes' : `${name} via EODHD`,
    at: news.publishedAt,
    asOf: news.publishedAt,
    status: 'verified',
    reason: null,
  });
}

/**
 * E3 g (R-25): one index's tape item — its prior close and day's change from the morning market context, said with its
 * date — carrying the figures `{ symbol, close, changePct, asOf }`. `asOfSaid` is the date as Shadow says it.
 */
export function tapeItem({ symbol, close, changePct, asOf, asOfSaid }) {
  const dir = changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'flat';
  const pct = Math.abs(changePct).toFixed(2);
  const item = packItem({
    kind: 'tape',
    fact: `${symbol} closed at ${close.toFixed(2)} on ${asOfSaid}, ${dir === 'flat' ? 'flat on the day' : `${dir} ${pct} percent`}.`,
    recordKind: 'marketContext',
    recordId: symbol,
    label: 'market context',
    at: asOf,
    asOf,
  });
  return { ...item, figures: { symbol, close, changePct, asOf } };
}
