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
//     Each close-pass section stores `dependsOn`, the identity of the ids it
//     depends on; a read that hit a LIMIT while those changed cannot vouch
//     for the new ones, so the limit becomes the caveat
//     `unresolved_dependency` until a read observes them (BA-26 amended).
//   · The candle pass's fields (actions[].replay, plans[].price,
//     passes.candles, coverage.replay, coverage.series) are NEVER taken from
//     the new read: they are copied from the stored document, so a close-pass
//     re-run cannot erase them. When the candle pass's inputs changed — the
//     action or plan set grew (`sources_changed`), or anything else in its
//     input fingerprint moved (`inputs_changed`, BA-25: a recovered check, an
//     evidence stamp, a replay input) — it is re-queued inside its window
//     (`pending`, attempts 0); outside it a `written` pass is `expired` with
//     reason `inputs_changed_outside_window` (BA-25 amended — never
//     `partial`, which promises a retry the window forbids); a TERMINAL pass
//     (`expired`, `exhausted`) keeps its status (BA-32). Every way,
//     `changedInputs` names what changed, and the output built before the
//     change stays, labelled, until replaced.
//   · A replay built by an earlier REPLAY LOGIC (BA-38: its builtFrom names
//     the version) is not an input change: inside the window a written,
//     partial or failed pass is re-queued with reason `replay_logic_updated`
//     and the next candle run rebuilds it; outside the window the pass keeps
//     its status. Either way, until it is rebuilt the replay itself says so
//     (`note`: REPLAY_VERSION_NOTE).
//   · Nothing changed → no write at all, so the stored bytes stand.

import { createHash } from 'node:crypto';
import { COVERAGE_RANK, CANDLE_COVERAGE_SECTIONS, REPLAY_VERSION_NOTE } from '../../../src/constants/filmTape.js';
import { orderChecks, afterOf, subsequentTradesInSlot } from './tapeAssemble.js';
import { candleInputFingerprint, changedInputParts, replayLogicVersionOf, REPLAY_LOGIC_VERSION } from './candleInputs.js';
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

/** A ranked unit: the new unit unless the stored one ranks above it (or the new read has none). */
function mergeUnit(storedUnit, newUnit, rank) {
  if (!present(newUnit)) return present(storedUnit) ? storedUnit : null;
  if (!present(storedUnit)) return newUnit;
  return rank(newUnit) >= rank(storedUnit) ? newUnit : storedUnit;
}

const RESULT_RANK = { not_completed: 0, derived: 1, stored: 2 };
/** BA-27 — a battle's lifecycle only moves forward: completed is terminal. */
const LIFECYCLE_RANK = Object.freeze({ active: 1, completed: 2 });
export const lifecycleRank = (status) => LIFECYCLE_RANK[status] ?? 0;
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

// ── BA-26 amended: what each close-pass section depends on ──────────────────

/** The close-pass sections, which the merge merges (the candle sections are the candle pass's, BA-31). */
export const CLOSE_COVERAGE_SECTIONS = Object.freeze(['checks', 'actions', 'directives', 'plans', 'calls', 'rationale', 'evidence']);
const keysOf = (list) => (Array.isArray(list) ? list : []).map((r) => r?.key).filter((k) => typeof k === 'string').sort();
const evalIdsOf = (doc) => [...new Set((Array.isArray(doc?.checks) ? doc.checks : []).map((c) => c?.evalId).filter((v) => typeof v === 'string'))].sort();

/**
 * The ids a section's coverage depends on, from the document itself: its check
 * rows, the evaluations they name (a check's entry is where its plans,
 * rationale, evidence, heard stamps and declaration phase are read — so an
 * eval id stands for its declaration expectation, which the tape does not
 * store), and its action, directive, plan, call and rationale keys.
 */
function dependencyIds(section, doc) {
  switch (section) {
    case 'checks': return { checks: keysOf(doc?.checks) };
    case 'actions': return { actions: keysOf(doc?.actions) };
    case 'directives': return { directives: keysOf(doc?.directives), evals: evalIdsOf(doc) };
    case 'plans': return { evals: evalIdsOf(doc), plans: keysOf(doc?.plans) };
    case 'rationale': return { evals: evalIdsOf(doc), rationale: keysOf(doc?.rationale) };
    case 'evidence': return { evals: evalIdsOf(doc) };
    case 'calls': return { evals: evalIdsOf(doc), calls: keysOf(doc?.calls) };
    default: return null;
  }
}

/** BA-26 amended — a section's `dependsOn`: the hash of the ids it depends on (a string; no number class). */
export const sectionDependsOn = (section, doc) => createHash('sha256').update(JSON.stringify(dependencyIds(section, doc))).digest('hex').slice(0, 16);

/** The caveat a limit becomes when it met changed dependencies, naming its source (tapeAssemble.js LIMIT_SOURCES). */
export const UNRESOLVED_DEPENDENCY = 'unresolved_dependency';
const unresolved = (source) => `${UNRESOLVED_DEPENDENCY}: ${source} on a read after this section's dependencies changed`;
/** The same caveat for a read limited by its age: it was assembled before some of the section's dependencies existed (review R2-1). */
const UNOBSERVED = `${UNRESOLVED_DEPENDENCY}: a read assembled before this section's dependencies changed`;

/**
 * One section's coverage across two runs (BA-19, BA-26 amended). Facts keep
 * their earlier rank: when the new read is poorer because a source was
 * evicted or unreadable (a LIMIT of that read), the stored coverage stands,
 * marked preservedFrom — but only while the section's dependencies are the
 * ones that coverage was saved for (`dependsOn`). A limit met while they
 * changed cannot vouch for the new ones: it becomes the caveat
 * `unresolved_dependency`, naming its source, held until a read OBSERVES them:
 * a read with no limit whose own dependencies (`observed`) are all the
 * section's merged ones. A read that did not observe them all — one assembled
 * before some existed: the battle as a pass selected it, a transaction retried
 * against a newer tape — is limited too, by its age (review R2-1): it never
 * lifts the stored coverage, never clears the caveat, and when the
 * dependencies changed it adds one. Every other CAVEAT — a fact about the day's record that
 * either run learned (a truncated deferral list, a gap, an unknown check) —
 * always lowers it: caveats are unioned and never dropped, the note carries
 * every one, and the status is at most `partial` while any stands. So the
 * status is the lower of what the later run can vouch for and what the
 * earlier run recorded. `unknownChecks` keeps the larger count.
 */
function mergeCoverage(section, storedDoc, newCov, carried, { limits = [], dependsOn = null, observed = dependsOn } = {}) {
  const storedCov = storedDoc?.coverage?.[section];
  const storedAt = storedCov?.preservedFrom ?? storedDoc?.writtenAt ?? null;
  if (!isObj(storedCov)) return isObj(newCov) ? { ...newCov, dependsOn } : newCov;
  const unobserved = observed !== dependsOn;
  const sRank = COVERAGE_RANK[storedCov.status] ?? 0;
  const nRank = COVERAGE_RANK[newCov?.status] ?? 0;
  const keepStored = sRank > nRank || unobserved;
  const base = keepStored ? { ...storedCov } : { ...newCov };
  const spans = [storedCov.span, newCov?.span].filter(isObj);
  base.span = spans.length
    ? { from: spans.map((s) => s.from).filter(Boolean).sort()[0] ?? null, to: spans.map((s) => s.to).filter(Boolean).sort().pop() ?? null }
    : null;
  base.sources = [...new Set([...(storedCov.sources || []), ...(newCov?.sources || [])])];
  base.preservedFrom = (keepStored || carried) ? storedAt : null;
  if (Array.isArray(storedCov.caveats) || Array.isArray(newCov?.caveats)) {
    let caveats = [...new Set([...(storedCov.caveats || []), ...(newCov?.caveats || [])])];
    let resolved = [];
    if (!limits.length && !unobserved) {
      // A read with no limit that saw every dependency the section now has: they are observed.
      resolved = caveats.filter((c) => c.startsWith(`${UNRESOLVED_DEPENDENCY}:`));
      caveats = caveats.filter((c) => !resolved.includes(c));
    } else if (storedCov.dependsOn !== dependsOn) {
      caveats = [...new Set([...caveats, ...limits.map(unresolved), ...(unobserved ? [UNOBSERVED] : [])])];
    }
    const note = (typeof base.note === 'string' ? base.note : '').split('; ').filter((part) => part && !resolved.includes(part)).join('; ');
    base.caveats = caveats;
    base.note = [note, ...caveats.filter((c) => !note.includes(c))].filter(Boolean).join('; ') || null;
    if (caveats.length && base.status === 'complete') base.status = 'partial';
  }
  base.dependsOn = dependsOn;
  if (Number.isInteger(storedCov.unknownChecks) || Number.isInteger(newCov?.unknownChecks)) {
    base.unknownChecks = Math.max(Number.isInteger(storedCov.unknownChecks) ? storedCov.unknownChecks : 0, Number.isInteger(newCov?.unknownChecks) ? newCov.unknownChecks : 0);
  }
  return base;
}

function keySet(rows) { return new Set((Array.isArray(rows) ? rows : []).map((r) => r?.key).filter(Boolean)); }

/** Two completion blocks that tell the same completion: status, instant, final score and result value. */
const sameCompletion = (a, b) => stableStringify([a?.status ?? null, a?.completedAt ?? null, a?.final ?? null, a?.result?.value ?? null])
  === stableStringify([b?.status ?? null, b?.completedAt ?? null, b?.final ?? null, b?.result?.value ?? null]);

/**
 * BA-27 (amended) — which document's completion block the tape keeps. The
 * battle block is an ordered lifecycle and moves as ONE unit with
 * battleStatusAtWrite — never field by field. The later lifecycle state wins.
 * On a tie, a block re-read from the battle document inside the write
 * transaction (`canonicalBattle`) is authoritative: it replaces a stored block
 * it contradicts, and one it agrees with stands only while it records a richer
 * result basis (a stored `result` field the battle document has since lost).
 * On a tie with no canonical re-read, the stored block stands: a stale
 * assembly never replaces a completion the tape recorded.
 */
function battleWinner(stored, assembled, canonicalBattle) {
  if (!isObj(stored.battle)) return 'assembled';
  const sStage = lifecycleRank(stored.battle.status);
  const aStage = lifecycleRank(assembled.battle?.status);
  if (sStage !== aStage) return sStage > aStage ? 'stored' : 'assembled';
  if (!canonicalBattle) return 'stored';
  const richer = (RESULT_RANK[stored.battle.result?.basis] ?? 0) > (RESULT_RANK[assembled.battle?.result?.basis] ?? 0);
  return sameCompletion(stored.battle, assembled.battle) && richer ? 'stored' : 'assembled';
}

/**
 * Merge the assembled document into the stored one.
 *
 * @param {object|null} stored     the tape as read inside the write transaction
 * @param {object} assembled       tapeAssemble.js output for this run
 * @param {{ nowIso: string, withinWindow: boolean, canonicalBattle?: boolean }} ctx
 *   `canonicalBattle`: the assembled battle block was re-read from the battle
 *   document inside the write transaction (writeTapeDay.js, BA-27 amended)
 * @returns {{ doc: object, changed: boolean, carried: object }}
 */
export function mergeTape(stored, assembledIn, { nowIso, withinWindow, canonicalBattle = false }) {
  // The read's limits (BA-26 amended) steer the coverage merge; they are never stored.
  const { readLimits = {}, ...assembled } = isObj(assembledIn) ? assembledIn : {};
  const isSkipped = assembled?.passes?.close?.status === 'skipped_mode';
  if (!isObj(stored) || !isObj(stored.passes?.close)) {
    const doc = { ...assembled, writtenAt: nowIso, firstWrittenAt: nowIso, runCount: 1 };
    doc.passes = { ...doc.passes, close: { ...doc.passes.close, writtenAt: nowIso } };
    if (isObj(doc.coverage)) {
      doc.coverage = { ...doc.coverage };
      for (const section of CLOSE_COVERAGE_SECTIONS) {
        if (isObj(doc.coverage[section])) doc.coverage[section] = { ...doc.coverage[section], dependsOn: sectionDependsOn(section, doc) };
      }
    }
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
  // Each swap's later-trades count, recounted from the MERGED action rows, as
  // `after` is below (BA-30): a read that lost a trade — evicted from trades[]
  // before a refresh re-read the day — keeps the tier and slot the tape
  // recorded, so the count, and the candle input identity built from it
  // (BA-31), do not move (review R2-2).
  // BA-38: a replay an earlier replay logic built says so until it is rebuilt.
  merged.actions = merged.actions.map((row, _, rows) => ({ ...row, subsequentTradesInSlot: subsequentTradesInSlot(row, rows), replay: versionNoted(row.replay) }));

  // Object sections: value units are never swapped for an emptier read.
  const sScore = isObj(stored.score) ? stored.score : {};
  const aScore = isObj(assembled.score) ? assembled.score : {};
  // The day's LAST admitted check keeps the later instant, the FIRST the
  // earlier — a read that lost rows never moves either (review L1-F8a).
  const lastCheck = mergeUnit(sScore.lastCheck, aScore.lastCheck, (u) => toMs(u?.at) ?? -Infinity);
  const firstCheck = mergeUnit(sScore.firstCheck, aScore.firstCheck, (u) => -(toMs(u?.at) ?? Infinity));
  merged.score = { lastCheck, firstCheck, dayChange: mergeDayChange(sScore, aScore, lastCheck) };
  // What followed each filing, recounted on every merge from the MERGED check
  // and action rows, each directive's aftermath ending at the next committed
  // filing among ALL merged directives — a preserved one included (BA-30,
  // review R08) — so it neither shrinks when rows are kept (L1-F8a) nor runs
  // on past a filing the new read no longer sees.
  const dayEnd = etDayBounds(assembled.etDate).endMs;
  const committedAt = merged.directives.filter((d) => d.cardState === 'committed').map((d) => toMs(d.filedAt)).filter((v) => v !== null).sort((a, b) => a - b);
  merged.directives = merged.directives.map((d) => {
    const next = committedAt.find((t) => t > (toMs(d.filedAt) ?? Infinity));
    return { ...d, after: afterOf({ filedAt: d.filedAt, endMs: Math.min(dayEnd, next ?? Infinity), checkRows: merged.checks, actionRows: merged.actions }) };
  });
  // BA-27 (amended): the battle block is an ordered lifecycle, and it moves as
  // ONE unit — status, completedAt, final, result and battleStatusAtWrite. A
  // stale assembly (an overlapping close or backfill run that read the battle
  // earlier) can add facts to the rest of the tape but never move the block
  // backward, and never rewind a recorded completion (battleWinner).
  const winner = battleWinner(stored, assembled, canonicalBattle) === 'stored' ? stored : assembled;
  const block = isObj(winner.battle) ? winner.battle : {};
  merged.battle = { status: block.status ?? null, completedAt: block.completedAt ?? null, final: block.final ?? null, result: block.result ?? null };
  merged.battleStatusAtWrite = winner.battleStatusAtWrite ?? block.status ?? null;
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
    merged.coverage[section] = mergeCoverage(section, stored, assembled.coverage?.[section], carriedFor[section], {
      limits: Array.isArray(readLimits[section]) ? readLimits[section] : [],
      dependsOn: sectionDependsOn(section, merged),
      observed: sectionDependsOn(section, assembled),
    });
  }
  for (const section of CANDLE_COVERAGE_SECTIONS) {
    let cov = isObj(stored.coverage?.[section]) && stored.passes?.candles?.reason !== 'close_pass_failed'
      ? stored.coverage[section]
      : assembled.coverage?.[section];
    const changed = merged.passes.candles?.changedInputs;
    if (Array.isArray(changed) && changed.length && isObj(cov) && cov.status !== 'unavailable') cov = builtBefore(cov, changed, withinWindow, merged.passes.candles?.status);
    merged.coverage[section] = cov;
  }

  merged.writtenAt = stored.writtenAt;
  merged.firstWrittenAt = stored.firstWrittenAt ?? stored.writtenAt ?? nowIso;
  merged.runCount = stored.runCount ?? 1;
  merged.passes.close.writtenAt = stored.passes?.close?.writtenAt ?? nowIso;
  return finish(stored, merged, nowIso, carried);
}

/** BA-38 — was this replay built by an earlier replay logic than the one that builds replays now? */
const builtByEarlierLogic = (replay) => isObj(replay) && replayLogicVersionOf(replay.builtFrom) < REPLAY_LOGIC_VERSION;

/** BA-38 — a replay an earlier replay logic built, with the note that says so (replacing, never stacking). */
function versionNoted(replay) {
  if (!builtByEarlierLogic(replay) || replay.note === REPLAY_VERSION_NOTE) return replay ?? null;
  return { ...replay, note: REPLAY_VERSION_NOTE };
}

function mergeCandles(stored, assembled, merged, { withinWindow }) {
  const sc = stored.passes?.candles;
  if (!isObj(sc) || sc.reason === 'close_pass_failed') return assembled.passes.candles;
  const oldActions = keySet(stored.actions);
  const oldPlans = keySet(stored.plans);
  const grewActions = [...keySet(merged.actions)].some((k) => !oldActions.has(k));
  const grewPlans = [...keySet(merged.plans)].some((k) => !oldPlans.has(k));
  // Inputs that became complete on this read are a changed source too: the
  // replay built from the poorer inputs must be rebuilt (review L2-F3b).
  const storedByKey = new Map((Array.isArray(stored.actions) ? stored.actions : []).filter(isObj).map((a) => [a.key, a]));
  const improved = (merged.actions || []).some((a) => { const was = storedByKey.get(a.key); return was && inputLegs(a) > inputLegs(was); });
  // BA-25: anything else the candle output was built from — the checks it
  // sampled, their stages, the evidence it reconciled against, the symbol set.
  const parts = changedInputParts(sc.inputFingerprint, candleInputFingerprint(merged));
  if (grewActions || improved) parts.push('actions');
  if (grewPlans) parts.push('plans');
  const changed = [...new Set(parts)].sort((a, b) => PART_ORDER.indexOf(a) - PART_ORDER.indexOf(b));
  // Nothing was built yet (never processed): nothing to re-queue or label.
  if (!changed.length || (!isObj(sc.inputFingerprint) && !['written', 'partial', 'failed'].includes(sc.status))) {
    // BA-38: a replay an earlier replay logic built is no input change. Inside
    // the window retryable work is re-queued so the next candle run rebuilds
    // it; outside it, or for a terminal pass (BA-32), the status stands — the
    // replay's own note says what it lacks (versionNoted).
    const outdated = (merged.actions || []).some((a) => builtByEarlierLogic(a?.replay));
    if (outdated && withinWindow && ['written', 'partial', 'failed'].includes(sc.status)) return { ...sc, status: 'pending', reason: 'replay_logic_updated', attempts: 0 };
    return sc;
  }
  const reason = grewActions || grewPlans || improved ? 'sources_changed' : 'inputs_changed';
  // Retryable work inside the window is re-queued. A TERMINAL pass never is
  // (BA-32; the BA-25 reading): no candle query selects it again.
  if (withinWindow && ['written', 'partial', 'failed'].includes(sc.status)) return { ...sc, status: 'pending', reason, attempts: 0, changedInputs: changed };
  // Outside the window no candle pass comes back for it (BA-25 amended): a
  // `written` the output no longer is becomes `expired`, reason
  // `inputs_changed_outside_window` — terminal, so no candle query and no
  // sweep ever selects it; never `partial`, which promises a retry the window
  // forbids (review R3-3). Its output stays, labelled as built before the
  // change. Any other pass keeps its status, and the change is recorded.
  if (!withinWindow && sc.status === 'written') return { ...sc, status: 'expired', reason: 'inputs_changed_outside_window', changedInputs: changed };
  return { ...sc, changedInputs: changed };
}

const PART_ORDER = ['checks', 'evidence', 'actions', 'salePrices', 'plans', 'symbols'];
const BUILT_BEFORE = 'built before the candle inputs changed';

/** Whether a candle pass is still to come for this output, in the label's words — never for a terminal pass (BA-32). */
function rebuildOutlook(withinWindow, status) {
  if (status === 'exhausted') return 'its attempts are spent, not rebuilt';
  if (status === 'expired' || !withinWindow) return 'outside its retry window, not rebuilt';
  return 'awaiting the next candle pass';
}

/**
 * BA-25 — label candle output built from inputs that have since changed: at
 * most `partial`, and the note names what changed and whether a candle pass
 * is still to come (never, for a terminal pass — BA-32). Replaces an earlier
 * such label, never stacks it.
 */
function builtBefore(cov, changed, withinWindow, status) {
  const note = typeof cov.note === 'string' ? cov.note : '';
  const at = note.indexOf(BUILT_BEFORE);
  const kept = at === -1 ? note : note.slice(0, at).replace(/;\s*$/, '');
  const label = `${BUILT_BEFORE} (${changed.join(', ')}) — ${rebuildOutlook(withinWindow, status)}`;
  return { ...cov, status: cov.status === 'complete' ? 'partial' : cov.status, note: [kept, label].filter(Boolean).join('; ') };
}

function finish(stored, doc, nowIso, carried) {
  const clean = sanitizeForFirestore(doc);
  if (sameContent(stored, clean)) return { doc: stored, changed: false, carried };
  clean.writtenAt = nowIso;
  clean.runCount = (stored.runCount ?? 1) + 1;
  clean.firstWrittenAt = stored.firstWrittenAt ?? stored.writtenAt ?? nowIso;
  if (isObj(clean.passes?.close)) clean.passes.close.writtenAt = nowIso;
  return { doc: clean, changed: true, carried };
}
