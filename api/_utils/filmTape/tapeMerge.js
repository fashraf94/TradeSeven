// api/_utils/filmTape/tapeMerge.js
//
// Film Room tape — THE MERGE-MONOTONE WRITE (spec BA-19). PURE.
//
// "Idempotence is 'same inputs, same document'; monotonicity is 'more inputs,
// never fewer facts.'" A later run reads the stored tape first and never loses
// a fact an earlier run saved:
//
//   · ROWS are unioned by a stable key. A stored row the new read lacks (its
//     source evicted — evaluations[] past 150, trades[] past 50) is KEPT.
//   · COLUMN GROUPS inside a row are carried as a unit: when the new read no
//     longer has a group's source (an entry's evidence, a trade join) and the
//     stored row does, the stored group is kept whole — never a mixed pair.
//   · Each section's coverage is the better of stored and new, and a section
//     that kept anything from the stored copy is marked `preservedFrom`.
//   · The candle pass's fields (actions[].replay, plans[].price,
//     passes.candles, coverage.replay, coverage.series) are NEVER taken from
//     the new read: they are copied from the stored document, so a close-pass
//     re-run cannot erase them. When the action or plan set grew, the candle
//     pass is re-queued: `passes.candles.status: 'pending'`,
//     `reason: 'sources_changed'`.
//   · Nothing changed → no write at all, so the stored bytes stand.

import { COVERAGE_RANK, CANDLE_COVERAGE_SECTIONS } from '../../../src/constants/filmTape.js';
import { orderChecks, afterOf } from './tapeAssemble.js';
import { toMs, etDayBounds } from './tapeTime.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const present = (v) => v !== null && v !== undefined;

/** Keys that change on every write and are not content. */
const BOOKKEEPING = Object.freeze(['writtenAt', 'firstWrittenAt', 'runCount']);

/** A deterministic JSON form (sorted keys) for content comparison. */
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isObj(value)) {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

/** The document without its bookkeeping, for "did anything change". */
export function contentOf(doc) {
  if (!isObj(doc)) return doc;
  const out = { ...doc };
  for (const k of BOOKKEEPING) delete out[k];
  if (isObj(out.passes?.close)) out.passes = { ...out.passes, close: { ...out.passes.close, writtenAt: null } };
  return out;
}

export const sameContent = (a, b) => stableStringify(contentOf(a)) === stableStringify(contentOf(b));

/**
 * Firestore rejects `undefined` (no ignoreUndefinedProperties on the admin
 * instance, api/_utils/firebaseAdmin.js) and a non-finite number is not a fact.
 */
export function sanitizeForFirestore(value) {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : sanitizeForFirestore(v)));
  if (isObj(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[k] = sanitizeForFirestore(v);
    }
    return out;
  }
  return value;
}

// ── per-section row rules ──────────────────────────────────────────────────

/** How many legs of a row's replayInputs have every input (0–2). */
export const inputLegs = (row) => (isObj(row?.replayInputs) ? (row.replayInputs.ghost ? 1 : 0) + (row.replayInputs.bought ? 1 : 0) : 0);

/**
 * Column groups carried as a unit. A group is carried from the stored row when
 * the new row RANKS BELOW it. By default the rank is the ANCHOR's (the first
 * column's) presence: carried when the new anchor is empty (null / false) and
 * the stored one is not. A group may name its own rank — `replayInputs` by
 * how many legs have every input (review L1-F6 / L2-F3: `{ghost: null, bought:
 * null}` is an object, yet it holds nothing), `heard` by earliness (review
 * L1-F7: a later stamp never replaces an earlier one).
 */
const SECTION_RULES = Object.freeze({
  checks: {
    groups: [['evidence', 'evidenceAt'], ['tickMs']],
    candle: [],
    order: (rows) => orderChecks(rows),
  },
  actions: {
    groups: [
      { cols: ['replayInputs', 'replayMissing', 'replayReason'], rank: inputLegs },
      ['tradeMatched', 'tier', 'slotIndex', 'exitPrice', 'lockedGainPct'],
      ['receiptMatched', 'inBasis', 'holdingMs', 'holdingBasis'],
      ['actionId', 'tickSeq', 'committed', 'rowSource'],
      // recorded scalars whose source may be evicted (the trade) or unreadable
      // (the receipt) on a later run (review L1-F8b)
      ['entryPrice'],
      ['lockedPoints'],
    ],
    candle: ['replay'],
    order: (rows) => [...rows].sort((a, b) => ((toMs(a.at) ?? 0) - (toMs(b.at) ?? 0)) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
  },
  directives: {
    groups: [{ cols: ['heard'], rank: (row) => (isObj(row?.heard) && toMs(row.heard.at) !== null ? -toMs(row.heard.at) : -Infinity) }],
    candle: [],
    order: (rows) => [...rows].sort((a, b) => ((toMs(a.filedAt) ?? 0) - (toMs(b.filedAt) ?? 0)) || (a.key < b.key ? -1 : 1)),
  },
  plans: {
    groups: [['tickSeq']],
    candle: ['price'],
    order: (rows) => [...rows].sort((a, b) => ((toMs(a.at) ?? 0) - (toMs(b.at) ?? 0)) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
  },
  calls: {
    groups: [],
    candle: [],
    // A copy whose typed fields are unchanged keeps its copiedAt / write mode:
    // copiedAt is when THIS observed state was first copied (BA-16).
    sameObservation: (a, b) => stableStringify({ ...a, copiedAt: null, tapeWriteMode: null }) === stableStringify({ ...b, copiedAt: null, tapeWriteMode: null }),
    order: (rows) => [...rows].sort((a, b) => ((a.mintedAt ?? 0) - (b.mintedAt ?? 0)) || (a.key < b.key ? -1 : 1)),
  },
  rationale: {
    groups: [['tickSeq']],
    candle: [],
    order: (rows) => [...rows].sort((a, b) => ((toMs(a.at) ?? 0) - (toMs(b.at) ?? 0)) || (a.key < b.key ? -1 : 1)),
  },
});

const anchorEmpty = (v) => v === null || v === undefined || v === false;
const groupOf = (g) => (Array.isArray(g) ? { cols: g, rank: (row) => (anchorEmpty(row?.[g[0]]) ? 0 : 1) } : g);

/**
 * Union two row lists by key. Returns the merged rows and what was carried
 * from the stored copy: `rows` (a stored row the new read lacks) and the
 * column groups (by anchor name).
 */
export function mergeRows(section, storedRows, newRows) {
  const rule = SECTION_RULES[section];
  const stored = new Map((Array.isArray(storedRows) ? storedRows : []).filter((r) => isObj(r) && r.key).map((r) => [r.key, r]));
  const carried = { rows: 0, groups: {} };
  const out = [];
  for (const n of Array.isArray(newRows) ? newRows : []) {
    const s = stored.get(n.key);
    if (!s) {
      const fresh = { ...n };
      for (const c of rule.candle) fresh[c] = null;
      out.push(fresh);
      continue;
    }
    stored.delete(n.key);
    if (rule.sameObservation && rule.sameObservation(s, n)) { out.push(s); continue; }
    // A tick record is permanent: nothing weaker (a gap, an entry) replaces it.
    if (s.rowSource === 'tick' && n.rowSource !== 'tick' && section === 'checks') { out.push(s); carried.rows += 1; continue; }
    const m = { ...n };
    for (const g of rule.groups.map(groupOf)) {
      if (g.rank(n) < g.rank(s)) {
        for (const col of g.cols) m[col] = s[col];
        carried.groups[g.cols[0]] = (carried.groups[g.cols[0]] || 0) + 1;
      }
    }
    for (const c of rule.candle) m[c] = present(s[c]) ? s[c] : null;
    out.push(m);
  }
  const leftovers = [...stored.values()];
  let rows = [...out, ...leftovers];
  if (section === 'checks') {
    // A check known earlier only by its entry, now matched to its tick record,
    // is one check: the tick row supersedes the entry row.
    const tickEvalIds = new Set(rows.filter((r) => Number.isInteger(r.tickSeq) && r.evalId).map((r) => r.evalId));
    rows = rows.filter((r) => !(r.rowSource === 'entry' && r.evalId && tickEvalIds.has(r.evalId)));
  }
  // Only a stored row that SURVIVES is preserved — a superseded entry row is
  // not (review L1-F10: counting it set preservedFrom with nothing kept).
  const kept = new Set(rows);
  carried.rows += leftovers.filter((r) => kept.has(r)).length;
  return { rows: rule.order(rows), carried };
}

const carriedAny = (c) => c.rows > 0 || Object.keys(c.groups).length > 0;

/** A value-and-basis unit: the new unit unless it lost a value the stored one has. */
function mergeUnit(storedUnit, newUnit, { rank = null } = {}) {
  if (!present(newUnit)) return present(storedUnit) ? storedUnit : null;
  if (!present(storedUnit)) return newUnit;
  if (rank) return (rank(newUnit) >= rank(storedUnit)) ? newUnit : storedUnit;
  if (isObj(newUnit) && 'value' in newUnit && newUnit.value === null && isObj(storedUnit) && present(storedUnit.value)) return storedUnit;
  return newUnit;
}

const RESULT_RANK = { not_completed: 0, derived: 1, stored: 2 };
const round2 = (v) => Math.round(v * 100) / 100;

/**
 * The day change against the merged last check. A new read whose reference is
 * unavailable (the prior tape unreadable this time) keeps the stored
 * reference and recomputes against it — never a silent drop to "unavailable",
 * never a stale value beside a newer last check.
 */
function mergeDayChange(sScore, aScore, lastCheck) {
  const aDc = aScore.dayChange;
  const sDc = sScore.dayChange;
  const hasRef = (dc) => isObj(dc) && typeof dc.reference === 'number' && Number.isFinite(dc.reference) && dc.basis && dc.basis !== 'unavailable';
  const pick = hasRef(aDc) ? aDc : (hasRef(sDc) ? sDc : (aDc ?? sDc ?? null));
  if (!hasRef(pick) || !isObj(lastCheck) || typeof lastCheck.total !== 'number') return pick;
  return { ...pick, value: round2(lastCheck.total - pick.reference) };
}
const VIEWS_RANK = { unknown: 0, absent: 1, present: 2 };

function mergeCoverage(section, storedDoc, newCov, carried) {
  const storedCov = storedDoc?.coverage?.[section];
  const storedAt = storedCov?.preservedFrom ?? storedDoc?.writtenAt ?? null;
  if (!isObj(storedCov)) return newCov;
  const sRank = COVERAGE_RANK[storedCov.status] ?? 0;
  const nRank = COVERAGE_RANK[newCov?.status] ?? 0;
  const base = sRank > nRank ? { ...storedCov } : { ...newCov };
  const spans = [storedCov.span, newCov?.span].filter(isObj);
  base.span = spans.length
    ? { from: spans.map((s) => s.from).filter(Boolean).sort()[0] ?? null, to: spans.map((s) => s.to).filter(Boolean).sort().pop() ?? null }
    : null;
  base.sources = [...new Set([...(storedCov.sources || []), ...(newCov?.sources || [])])];
  base.preservedFrom = (sRank > nRank || carried) ? storedAt : null;
  return base;
}

function keySet(rows) { return new Set((Array.isArray(rows) ? rows : []).map((r) => r?.key).filter(Boolean)); }

/**
 * Merge the assembled document into the stored one.
 *
 * @param {object|null} stored     the tape as read inside the write transaction
 * @param {object} assembled       tapeAssemble.js output for this run
 * @param {{ nowIso: string, withinWindow: boolean }} ctx
 * @returns {{ doc: object, changed: boolean, carried: object }}
 */
export function mergeTape(stored, assembled, { nowIso, withinWindow }) {
  const isSkipped = assembled?.passes?.close?.status === 'skipped_mode';
  if (!isObj(stored) || !isObj(stored.passes?.close)) {
    const doc = { ...assembled, writtenAt: nowIso, firstWrittenAt: nowIso, runCount: 1 };
    doc.passes = { ...doc.passes, close: { ...doc.passes.close, writtenAt: nowIso } };
    return { doc: sanitizeForFirestore(doc), changed: true, carried: {} };
  }
  if (isSkipped) {
    const doc = { ...assembled, firstWrittenAt: stored.firstWrittenAt ?? nowIso, runCount: stored.runCount ?? 1, writtenAt: stored.writtenAt ?? nowIso };
    doc.passes = { ...doc.passes, close: { ...doc.passes.close, writtenAt: stored.passes?.close?.writtenAt ?? nowIso } };
    return finish(stored, doc, nowIso, {});
  }

  const carried = {};
  const merged = { ...assembled };
  for (const section of ['checks', 'actions', 'directives', 'plans', 'calls', 'rationale']) {
    const { rows, carried: c } = mergeRows(section, stored[section], assembled[section]);
    merged[section] = rows;
    carried[section] = c;
  }

  // Object sections: value units are never swapped for an emptier read.
  const sScore = isObj(stored.score) ? stored.score : {};
  const aScore = isObj(assembled.score) ? assembled.score : {};
  // The day's LAST admitted check keeps the later instant, the FIRST the
  // earlier — a read that lost rows never moves either (review L1-F8a).
  const lastCheck = mergeUnit(sScore.lastCheck, aScore.lastCheck, { rank: (u) => toMs(u?.at) ?? -Infinity });
  const firstCheck = mergeUnit(sScore.firstCheck, aScore.firstCheck, { rank: (u) => -(toMs(u?.at) ?? Infinity) });
  merged.score = { lastCheck, firstCheck, dayChange: mergeDayChange(sScore, aScore, lastCheck) };
  if (carried.checks.rows > 0 || carried.actions.rows > 0) {
    // Rows the new read lacked were kept: recount what followed each filing
    // from the MERGED rows, so a directive's aftermath never shrinks (L1-F8a).
    const dayEnd = etDayBounds(assembled.etDate).endMs;
    const committedAt = merged.directives.filter((d) => d.cardState === 'committed').map((d) => toMs(d.filedAt)).filter((v) => v !== null).sort((a, b) => a - b);
    merged.directives = merged.directives.map((d) => {
      const next = committedAt.find((t) => t > (toMs(d.filedAt) ?? Infinity));
      return { ...d, after: afterOf({ filedAt: d.filedAt, endMs: Math.min(dayEnd, next ?? Infinity), checkRows: merged.checks, actionRows: merged.actions }) };
    });
  }
  const sBattle = isObj(stored.battle) ? stored.battle : {};
  merged.battle = {
    status: assembled.battle?.status ?? sBattle.status ?? null,
    completedAt: assembled.battle?.completedAt ?? sBattle.completedAt ?? null,
    final: mergeUnit(sBattle.final, assembled.battle?.final),
    result: mergeUnit(sBattle.result, assembled.battle?.result, { rank: (u) => RESULT_RANK[u?.basis] ?? 0 }),
  };
  merged.comparables = {
    market: assembled.comparables?.market ?? stored.comparables?.market ?? [],
    sectors: { ...(stored.comparables?.sectors || {}), ...(assembled.comparables?.sectors || {}) },
  };
  const sViews = stored.diagnostics?.intradayViews ?? 'unknown';
  const nViews = assembled.diagnostics?.intradayViews ?? 'unknown';
  merged.diagnostics = { intradayViews: (VIEWS_RANK[nViews] ?? 0) >= (VIEWS_RANK[sViews] ?? 0) ? nViews : sViews };

  // passes.close, recomputed from the MERGED rows.
  const tickRows = merged.checks.filter((r) => r.rowSource === 'tick');
  const seqs = tickRows.map((r) => r.tickSeq).filter(Number.isInteger).sort((a, b) => a - b);
  // A missing tick record is a gap whether it has its own `no_record` row or
  // is stood for by its surviving entry (tapeAssemble.js absorbedGap).
  const gaps = [...new Set([
    ...merged.checks.filter((r) => r.state === 'no_record' && Number.isInteger(r.tickSeq)).map((r) => r.tickSeq),
    ...(assembled.passes.close.gaps || []),
  ])].filter((g) => !seqs.includes(g)).sort((a, b) => a - b);
  const unattributed = (assembled.passes.close.unattributedGaps || []).filter((s) => !seqs.includes(s));
  const entryOnly = merged.checks.some((r) => r.rowSource === 'entry');
  merged.passes = {
    close: {
      ...assembled.passes.close,
      capture: seqs.length === 0 ? 'absent' : (gaps.length || unattributed.length || entryOnly ? 'partial' : 'present'),
      tickSeqRange: seqs.length ? [seqs[0], seqs[seqs.length - 1]] : null,
      gaps,
      unattributedGaps: unattributed,
      deferralsTruncated: Boolean(assembled.passes.close.deferralsTruncated || stored.passes.close.deferralsTruncated),
      lastError: null,
    },
    candles: mergeCandles(stored, assembled, merged, { withinWindow }),
  };

  // Coverage: close sections merged; candle sections stored-only.
  merged.coverage = {};
  const carriedFor = {
    checks: carried.checks.rows > 0 || carried.checks.groups.tickMs > 0,
    evidence: Boolean(carried.checks?.groups?.evidence),
    actions: carriedAny(carried.actions),
    directives: carriedAny(carried.directives),
    plans: carriedAny(carried.plans),
    calls: carriedAny(carried.calls),
    rationale: carriedAny(carried.rationale),
  };
  for (const section of Object.keys(carriedFor)) {
    merged.coverage[section] = mergeCoverage(section, stored, assembled.coverage?.[section], carriedFor[section]);
  }
  for (const section of CANDLE_COVERAGE_SECTIONS) {
    let cov = isObj(stored.coverage?.[section]) && stored.passes?.candles?.reason !== 'close_pass_failed'
      ? stored.coverage[section]
      : assembled.coverage?.[section];
    if (merged.passes.candles?.reason === OUTSIDE_WINDOW_REASON && isObj(cov) && !(cov.note || '').includes(OUTSIDE_WINDOW_NOTE)) {
      cov = { ...cov, status: cov.status === 'complete' ? 'partial' : cov.status, note: [cov.note, OUTSIDE_WINDOW_NOTE].filter(Boolean).join('; ') };
    }
    merged.coverage[section] = cov;
  }

  merged.writtenAt = stored.writtenAt;
  merged.firstWrittenAt = stored.firstWrittenAt ?? stored.writtenAt ?? nowIso;
  merged.runCount = stored.runCount ?? 1;
  merged.passes.close.writtenAt = stored.passes?.close?.writtenAt ?? nowIso;
  return finish(stored, merged, nowIso, carried);
}

function mergeCandles(stored, assembled, merged, { withinWindow }) {
  const sc = stored.passes?.candles;
  if (!isObj(sc) || sc.reason === 'close_pass_failed') return assembled.passes.candles;
  const oldActions = keySet(stored.actions);
  const oldPlans = keySet(stored.plans);
  const grew = [...keySet(merged.actions)].some((k) => !oldActions.has(k)) || [...keySet(merged.plans)].some((k) => !oldPlans.has(k));
  // Inputs that became complete on this read are a changed source too: the
  // replay built from the poorer inputs must be rebuilt (review L2-F3b).
  const storedByKey = new Map((Array.isArray(stored.actions) ? stored.actions : []).filter(isObj).map((a) => [a.key, a]));
  const improved = (merged.actions || []).some((a) => { const was = storedByKey.get(a.key); return was && inputLegs(a) > inputLegs(was); });
  if ((grew || improved) && ['written', 'partial', 'failed'].includes(sc.status)) {
    if (withinWindow) return { ...sc, status: 'pending', reason: 'sources_changed', attempts: 0 };
    // Outside the window no candle pass comes back for it: the tape says so
    // rather than keep a `written` it no longer is (review L2-F5).
    return { ...sc, status: 'partial', reason: OUTSIDE_WINDOW_REASON };
  }
  return sc;
}

const OUTSIDE_WINDOW_REASON = 'sources_changed_outside_window';
const OUTSIDE_WINDOW_NOTE = 'actions or plans recorded after the candle pass, outside its retry window — not replayed or priced';

function finish(stored, doc, nowIso, carried) {
  const clean = sanitizeForFirestore(doc);
  if (sameContent(stored, clean)) return { doc: stored, changed: false, carried };
  clean.writtenAt = nowIso;
  clean.runCount = (stored.runCount ?? 1) + 1;
  clean.firstWrittenAt = stored.firstWrittenAt ?? stored.writtenAt ?? nowIso;
  if (isObj(clean.passes?.close)) clean.passes.close.writtenAt = nowIso;
  return { doc: clean, changed: true, carried };
}
