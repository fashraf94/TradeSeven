// api/_utils/setupRead/projection.js
//
// The chart's evidence — THE PROJECTION (spec docs/specs/CHART_EVIDENCE_SPEC_V1.md RR-5,
// RR-6). One stored setup record → what may leave the server, as COPIED fields through
// an explicit list (src/components/Research/Sheet/setupReadContract.js). Nothing is
// derived or re-computed: every value is the record's own, a scalar kept as it is, an
// array or object rebuilt key by key from the list. Never leaves: the writer's commit and
// host, anything from the claims, the stored bars, the adapter's evidence block, the
// refusal's detail, sourceMeta, and any field this list does not name.
//
// THE ANSWER is the record's own `status`: 'ok' → `measured` (whatever the verdict,
// unknown included — the evaluator measured it and says what was missing), 'refused' →
// `refused` (the evidence could not be used: a split inside the window, a short or
// gapped history). A record this module does not recognise — another schema version, a
// key that is not the one asked for, an unknown status — throws: it is never read as
// absent and never projected in part.
//
// Pure: no I/O, no clock. It names no collection; the route reads the record.

import {
  SETUP_READ_FACTS, SETUP_READ_PATTERNS,
} from '../../../src/components/Research/Sheet/setupReadContract.js';

/** The one record schema this projection knows (setupEvidence/acquire.js SNAPSHOT_SCHEMA_VERSION; pinned). */
export const RECORD_SCHEMA_VERSION = 1;
const ANSWER_OF_STATUS = Object.freeze({ ok: 'measured', refused: 'refused' });

/** A stored record the projection cannot read. */
export class SetupRecordUnreadable extends Error {
  constructor(why) {
    super(`setup record unreadable: ${why}`);
    this.name = 'SetupRecordUnreadable';
    this.why = why;
  }
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** A JSON scalar as stored (a finite number, a string, a boolean, null); anything else reads null. */
const scalar = (v) => (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) ? v : null);
/** A check side: a scalar, or an array of scalars (the chained regime checks), copied. */
const side = (v) => (Array.isArray(v) ? v.map(scalar) : scalar(v));
const strings = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string') : []);
const dated = (v) => ({ value: scalar(isObject(v) ? v.value : null), date: scalar(isObject(v) ? v.date : null) });

/** The answer a stored record gives (RR-5). Throws on a status this module does not know. */
export function answerOf(record) {
  const answer = isObject(record) ? ANSWER_OF_STATUS[record.status] : undefined;
  if (!answer) throw new SetupRecordUnreadable('status');
  return answer;
}

/**
 * The projection of one stored record (RR-6), for the session and symbol it was read under.
 * @param {object} record the stored document
 * @param {{ session: string, symbol: string, behind: boolean }} at
 */
export function projectSetupRecord(record, { session, symbol, behind }) {
  if (!isObject(record) || record.schemaVersion !== RECORD_SCHEMA_VERSION) throw new SetupRecordUnreadable('schema');
  if (!isObject(record.key) || record.key.session !== session || record.key.symbol !== symbol) throw new SetupRecordUnreadable('key');
  answerOf(record);
  const entry = record.entry;
  if (!isObject(entry) || !Array.isArray(entry.checks)) throw new SetupRecordUnreadable('entry');
  const ruleSet = isObject(record.key.ruleSet) ? record.key.ruleSet : {};
  const evidence = isObject(entry.evidence) ? entry.evidence : {};
  const factsUsed = isObject(entry.factsUsed) ? entry.factsUsed : {};
  const patterns = isObject(entry.patterns) ? entry.patterns : {};
  return {
    session: record.key.session,
    asOf: scalar(entry.asOf),
    capturedAt: scalar(record.capturedAt),
    behind: behind === true,
    ruleSet: { setupVersion: scalar(ruleSet.setupVersion), thresholdsHash: scalar(ruleSet.thresholdsHash), semanticsId: scalar(ruleSet.semanticsId) },
    basis: scalar(entry.basis),
    verdict: scalar(entry.verdict),
    reason: scalar(entry.reason ?? null),
    pattern: scalar(entry.pattern ?? null),
    regime: scalar(entry.regime ?? null),
    patternsSatisfied: strings(entry.patternsSatisfied),
    patterns: Object.fromEntries(SETUP_READ_PATTERNS.map((name) => [name, scalar(patterns[name] ?? null)])),
    checks: entry.checks.map((c) => ({
      id: scalar(isObject(c) ? c.id : null),
      lhs: side(isObject(c) ? c.lhs : null),
      op: scalar(isObject(c) ? c.op : null),
      rhs: side(isObject(c) ? c.rhs : null),
      result: scalar(isObject(c) ? c.result : null),
    })),
    facts: Object.fromEntries(SETUP_READ_FACTS.map((name) => [name, scalar(isObject(factsUsed[name]) ? factsUsed[name].value : null)])),
    missing: strings(entry.missing),
    swingHigh: dated(evidence.swingHigh),
    swingLow: dated(evidence.swingLow),
    pullbackLows: Array.isArray(evidence.pullbackLows)
      ? evidence.pullbackLows.map((p) => ({ date: scalar(isObject(p) ? p.date : null), low: scalar(isObject(p) ? p.low : null) }))
      : [],
    adjustmentMetadata: scalar(isObject(evidence.adjustment) ? evidence.adjustment.metadata : null),
  };
}
