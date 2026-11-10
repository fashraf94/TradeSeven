// scripts/census-setup-menu-labels.mjs
//
// Measured Trend Evidence Slice 2 — THE SETUP-LABEL CENSUS (spec V2 §5.5, §3.1; the kickoff's
// Correction D). What the cohort's tick records say about the candidate menu's setup labels, over a
// window, with every denominator kept apart. Run by the founder after activation; a build session
// never runs it against production.
//
// READ-ONLY BY CONSTRUCTION. runCensus receives a RESTRICTED READER (reads only), never the database
// handle: the handle exists only inside main(), which wraps it. Tick records are read through the
// export's read path (scripts/export-tick-capture.js: the battle cohort by lifetime, each battle's
// FULL `ticks` subcollection and its persisted counter, coverage by captureCoverage.js), so a skipped,
// failed or timed-out capture is counted by the export's own rules — a `timed_out` capture is
// UNKNOWN until its document is found, never "no record" by assumption. The state document is read
// with one plain get. The static imports are pure modules; census-setup-menu-labels.test.js pins them
// and pins that the store, the tenant and the state writer are never imported.
//
// THE MEANINGS (Correction D), printed with every figure:
//   · Model-visible = the tick's `model.dispatched` is true AND the candidate was in the bench at the
//     freeze (`inBenchAtFreeze`). Bench membership alone is not dispatch; attempted-but-undispatched
//     ticks and dispatched transport failures are separate rows, from the record's own model fields.
//   · The acquisition population is the persisted hot bench (`source: hotbench`, not crypto, not a
//     refused key form): that is what the tenant requests. Catalyst additions are a distinct cohort,
//     never counted as acquisition or provider failure. Model exposure and acquisition eligibility
//     are reported apart.
//   · `capturedBeforeFreeze` compares the PROVIDER capture time with the freeze. It is never reported
//     as availability at the decision: whether the snapshot was in the database then is unknown.
//   · Slice 2's history fields count RESERVATIONS and recorded OUTCOMES — never provider requests,
//     never failures. Unreadable state, no entry, and an entry at zero are three different rows.
//     Reason-level figures come only from the typed `lastReason` the state stores.
//   · Joins are scoped to one tick record (one battle, one tick id; never an evalId across battles).
//     An action that executed a pending proposal is `proposal_tick_unevaluated` (its proposing tick
//     would need the battle's trades, which this census does not read), never `same_tick`. The class is
//     INFERRED, not recorded: the capture stamps a proposal's execution like a model swap (source haiku), so a
//     model-sourced swap that is not this tick's own decision is counted here (review SM1-5).
//   · No filtering, trading-performance or behavioural claim follows from any figure here; the M1/M2
//     limits stand (the recorded replay is below the 20-joined-moment floor).
//
// THREE POPULATIONS, never one (correction round D2), each labelled in the report and in the JSON `meta`:
//   · "Tick-label aggregates selected by --from/--to" — the tick records of the selected battles whose
//     `capturedAt` falls in the requested range (every record when no range is given).
//   · "Lifetime tick coverage for the selected battles" — the export's coverage over EVERY minted tick of
//     each selected battle, its whole life, NOT limited to the range.
//   · "Current global retained acquisition state" — setupMenuLabelState/main as read once, when the census
//     runs: every owner, every battle, the sessions the tenant still retains. Not limited to the selected
//     battles or the range, and later than any tick it is printed beside.
//   RUN-LEVEL STALENESS: a tick's labels and Slice 2 history fields are as of its run memo (reads.js): one
//   state read per cron invocation, and one read per snapshot shared by every later tick of it (`readsShared`).
//   A shared value can be up to the invocation's length older than the tick that records it — an `absent`
//   may since have been written. The census reads nothing new to correct it; it reports the shared counts.
//
// THE STATE IS VALIDATED EXACTLY AS THE PRODUCTION READER VALIDATES IT (correction round F3), with the same
// pure functions (setupMenuLabels/stateShape.js; never the state writer): an unsupported document or a failed
// read is `unreadable` and an absent one `absent` — every figure null (unknown), never a measured zero. A
// readable document with malformed entries is `partial`: the malformed entries are counted apart and never
// aggregated (no coerced `n`, no outcome), and the figures are labelled "partial valid-entry subtotals".
//
// AGGREGATES ONLY, ON EVERY CHANNEL: counts and distributions; no owner, battle, tick or snapshot id,
// no symbol. Every label read from a document is printed only when it is on its closed list, else as
// `other`.
//
// USAGE (repo root; the founder, after activation):
//   node scripts/census-setup-menu-labels.mjs --from YYYY-MM-DD --to YYYY-MM-DD [--out report.md] [--json data.json]

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeCoverage } from '../api/_utils/tickCapture/captureCoverage.js';
import { TICKS_SUBCOLLECTION, TICK_BODIES_SUBCOLLECTION } from '../api/_utils/tickCapture/captureConfig.js';
import { battleCohortForRange, buildBattleInput, inWindow, rangeBounds } from './export-tick-capture.js';
import { scopeOf } from '../api/_utils/activationEvidence/scope.js';
import {
  SETUP_LABEL_STATUSES, SETUP_MENU_BLOCK_STATUSES, SETUP_S2_OUTCOMES, STATE_COLLECTION, STATE_DOC, STATE_REASONS,
} from '../api/_utils/setupMenuLabels/constants.js';
import { stateDocReadable, stateEntryIds, stateEntryWellFormed } from '../api/_utils/setupMenuLabels/stateShape.js';

const bump = (obj, key, n = 1) => { obj[key] = (obj[key] || 0) + n; };
const onList = (value, list) => (typeof value === 'string' && list.includes(value) ? value : 'other');
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Join classes (spec V2 §5.5, kept). */
export const JOIN_CLASSES = Object.freeze(['same_tick', 'proposal_tick_unevaluated', 'ambiguous', 'missing']);

/** The three populations (D2): label, scope, and the top-level keys of the census that belong to each. */
export const CENSUS_POPULATIONS = Object.freeze({
  tickLabels: Object.freeze({
    label: 'Tick-label aggregates selected by --from/--to',
    scope: 'the permanent tick records of the selected battles whose capturedAt falls in the requested range (every record when no range is given)',
    keys: Object.freeze(['ticks', 'tickClass', 'candidates', 'cohorts', 'absent', 'providerCapture', 'joins']),
  }),
  coverage: Object.freeze({
    label: 'Lifetime tick coverage for the selected battles',
    scope: 'every minted tick of each selected battle over its whole life (the export\'s coverage rules), NOT limited to the requested range',
    keys: Object.freeze(['coverage']),
  }),
  state: Object.freeze({
    label: 'Current global retained acquisition state',
    scope: 'setupMenuLabelState/main as read once when the census runs: every owner and battle, the sessions the tenant still retains; NOT limited to the selected battles or the requested range',
    keys: Object.freeze(['state']),
  }),
});

/** The run memo's staleness (reads.js, compose.js THE TIMES), printed with the tick-label figures. */
export const RUN_MEMO_NOTE = 'A tick\'s labels and Slice 2 history are as of its cron invocation\'s run memo: one state read per invocation, and one snapshot read shared by every later tick of it (readsShared). A shared value can be up to the invocation\'s length older than the tick recording it (an absent may since have been written); the census reads nothing new to correct it.';

/** State statuses (F3). `partial` = a readable document with malformed entries, which are never aggregated. */
export const STATE_CENSUS_STATUSES = Object.freeze(['read', 'partial', 'absent', 'unreadable', 'not_read']);
const COMPLETE_TOTALS = 'complete';
const PARTIAL_TOTALS = 'partial valid-entry subtotals';

/**
 * The state's figures, validated exactly as the production reader validates them (stateShape.js). Pure.
 * @param {object|null} raw the stored document as read (null: no document)
 * @param {'read'|'absent'|'read_failed'|'not_read'} readStatus how the one read went ('unreadable' is read as 'read_failed')
 */
export function stateCensusOf(raw, readStatus) {
  const unknown = { entries: null, validEntries: null, malformedEntries: null, totals: null, reservations: null, lastOutcome: null, lastReason: null };
  if (readStatus === 'not_read') return { status: 'not_read', cause: null, ...unknown };
  if (readStatus === 'read_failed' || readStatus === 'unreadable') return { status: 'unreadable', cause: 'read_failed', ...unknown };
  if (readStatus === 'absent' || raw === null || raw === undefined) return { status: 'absent', cause: null, ...unknown };
  if (!stateDocReadable(raw)) return { status: 'unreadable', cause: 'unsupported_document', ...unknown };
  const reasons = {};
  const outcomes = {};
  let entries = 0;
  let validEntries = 0;
  let reservations = 0;
  for (const id of stateEntryIds(raw.attempts)) {
    entries += 1;
    const e = raw.attempts[id];
    if (!stateEntryWellFormed(e)) continue; // malformed: counted apart, never aggregated — no coerced n, no outcome
    validEntries += 1;
    reservations += e.n; // a well-formed entry's n is an integer >= 0
    if (e.lastReason !== null && e.lastReason !== undefined) bump(reasons, onList(e.lastReason, STATE_REASONS));
    bump(outcomes, e.lastOutcome === null || e.lastOutcome === undefined ? 'none_recorded' : onList(e.lastOutcome, SETUP_S2_OUTCOMES));
  }
  const malformedEntries = entries - validEntries;
  return {
    status: malformedEntries > 0 ? 'partial' : 'read',
    cause: null,
    entries, validEntries, malformedEntries,
    totals: malformedEntries > 0 ? PARTIAL_TOTALS : COMPLETE_TOTALS,
    reservations, lastOutcome: outcomes, lastReason: reasons,
  };
}

function emptyAggregate() {
  return {
    ticks: { records: 0, withBlock: 0, blockStatus: {}, exitReason: {}, readsIssued: 0, readsShared: 0 },
    tickClass: { modelDispatched: 0, attemptedNotDispatched: 0, dispatchedFailed: 0, notAttempted: 0 },
    candidates: { total: 0, status: {}, omitted: 0, truncated: 0, unrecordable: 0 },
    cohorts: {
      modelVisible: { total: 0, status: {} },
      benchAtFreezeNotDispatched: { total: 0, status: {} },
      acquisitionPopulation: { total: 0, status: {} },
      catalyst: { total: 0, status: {} },
      heldAtFreeze: { total: 0, status: {} },
    },
    absent: { bySource: {}, slice2History: { stateUnread: 0, noEntry: 0, entryZeroReservations: 0, entryWithReservations: 0, exhausted: 0 }, lastOutcome: {} },
    providerCapture: { beforeFreeze: 0, notBeforeFreeze: 0, unknown: 0 },
    joins: { pick: {}, actions: {} },
  };
}

/** One tick record's contribution. Pure. */
function addRecord(agg, rec) {
  agg.ticks.records += 1;
  const block = rec?.setupMenu;
  if (!isObj(block)) return;
  agg.ticks.withBlock += 1;
  bump(agg.ticks.blockStatus, onList(block.blockStatus, SETUP_MENU_BLOCK_STATUSES));
  bump(agg.ticks.exitReason, typeof rec.exitReason === 'string' && /^[a-z_]{1,30}$/.test(rec.exitReason) ? rec.exitReason : 'other');
  const model = isObj(rec.model) ? rec.model : {};
  const dispatched = model.dispatched === true;
  if (dispatched) { agg.tickClass.modelDispatched += 1; if (model.outcome === 'failed') agg.tickClass.dispatchedFailed += 1; }
  else if (model.attempted === true) agg.tickClass.attemptedNotDispatched += 1;
  else agg.tickClass.notAttempted += 1;
  agg.candidates.omitted += Number.isFinite(block.omittedCount) ? block.omittedCount : 0;
  agg.candidates.truncated += Number.isFinite(block.truncatedCount) ? block.truncatedCount : 0;
  agg.candidates.unrecordable += Number.isFinite(block.unrecordableCount) ? block.unrecordableCount : 0;
  agg.ticks.readsIssued += Number.isInteger(block.readsIssued) && block.readsIssued >= 0 ? block.readsIssued : 0;
  agg.ticks.readsShared += Number.isInteger(block.readsShared) && block.readsShared >= 0 ? block.readsShared : 0;

  const candidates = Array.isArray(block.candidates) ? block.candidates.filter(isObj) : [];
  const bySymbol = new Map(candidates.map((c) => [c.symbol, c]));
  for (const c of candidates) {
    const status = onList(c.status, SETUP_LABEL_STATUSES);
    agg.candidates.total += 1;
    bump(agg.candidates.status, status);
    const into = (cohort) => { agg.cohorts[cohort].total += 1; bump(agg.cohorts[cohort].status, status); };
    if (dispatched && c.inBenchAtFreeze === true) into('modelVisible');
    if (!dispatched && c.inBenchAtFreeze === true) into('benchAtFreezeNotDispatched');
    if (c.source === 'hotbench' && status !== 'excluded' && status !== 'symbol_form') into('acquisitionPopulation');
    if (c.source === 'catalyst') into('catalyst');
    if (c.heldAtFreeze === true) into('heldAtFreeze');
    if (status === 'absent') {
      bump(agg.absent.bySource, c.source === 'catalyst' ? 'catalyst' : 'hotbench');
      const h = agg.absent.slice2History;
      if (c.s2Entry === null || c.s2Entry === undefined) h.stateUnread += 1;
      else if (c.s2Entry === false) h.noEntry += 1;
      else if (c.s2Reservations === 0) h.entryZeroReservations += 1;
      else h.entryWithReservations += 1;
      if (c.s2Exhausted === true) h.exhausted += 1;
      if (c.s2Entry === true) bump(agg.absent.lastOutcome, c.s2LastOutcome === null || c.s2LastOutcome === undefined ? 'none_recorded' : onList(c.s2LastOutcome, SETUP_S2_OUTCOMES));
    }
    if (status === 'labelled' || status === 'refused') {
      if (c.capturedBeforeFreeze === true) agg.providerCapture.beforeFreeze += 1;
      else if (c.capturedBeforeFreeze === false) agg.providerCapture.notBeforeFreeze += 1;
      else agg.providerCapture.unknown += 1;
    }
  }

  // JOINS — inside this one record only (one battle, one tick).
  const decision = isObj(rec.decision) ? rec.decision : {};
  const pick = decision.originalSymbolIn ?? null;
  if (typeof pick === 'string') {
    const c = bySymbol.get(pick);
    bump(agg.joins.pick, c ? `same_tick:${onList(c.status, SETUP_LABEL_STATUSES)}` : 'ambiguous');
  }
  const own = new Set([decision.originalSymbolIn, decision.finalSymbolIn].filter((s) => typeof s === 'string'));
  for (const a of Array.isArray(rec.actions) ? rec.actions.filter(isObj) : []) {
    if (a.committed !== true || typeof a.symbolIn !== 'string') continue;
    const source = typeof a.source === 'string' && /^[a-z_]{1,30}$/.test(a.source) ? a.source : 'other';
    // A model-sourced swap that is not this tick's own decision executed an earlier tick's proposal (it ran before the freeze).
    if (source === 'haiku' && !own.has(a.symbolIn)) { bump(agg.joins.actions, 'proposal_tick_unevaluated'); continue; }
    const c = bySymbol.get(a.symbolIn);
    bump(agg.joins.actions, c ? `same_tick:${source}:${onList(c.status, SETUP_LABEL_STATUSES)}` : 'ambiguous');
  }
}

/**
 * The export's coverage TOTALS only (review SMV1-N1): its per-battle `rows` carry battle ids and missing
 * sequences, which no channel of this census may print. Every other key is a count or a ratio. Pure.
 */
export function coverageTotalsOf(coverage) {
  if (!isObj(coverage)) return null;
  const out = {};
  for (const [k, v] of Object.entries(coverage)) if (k !== 'rows' && (typeof v === 'number' || typeof v === 'boolean' || v === null)) out[k] = v;
  return out;
}

/** A requested range bound, printed only when it is a plain date (never free text). */
const dateOrNull = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/**
 * The census over records already read. Pure.
 * @param {object[]} records permanent tick records (each one battle's tick), already selected by the range
 * @param {{ coverage?: object, state?: object|null, stateStatus?: 'read'|'absent'|'read_failed'|'not_read', range?: { from?: string|null, to?: string|null } }} [extra]
 *   `stateStatus` says how the one state read went: 'read' (a document came back; it is validated here), 'absent',
 *   'read_failed' (the read threw), 'not_read'.
 */
export function aggregateSetupMenu(records, { coverage = null, state = null, stateStatus = 'not_read', range = {} } = {}) {
  const agg = emptyAggregate();
  for (const rec of records) addRecord(agg, rec);
  const requested = { from: dateOrNull(range?.from), to: dateOrNull(range?.to) };
  return {
    meta: {
      range: requested,
      populations: CENSUS_POPULATIONS,
      runMemo: RUN_MEMO_NOTE,
    },
    ...agg,
    coverage: coverageTotalsOf(coverage),
    state: stateCensusOf(state, ['read', 'absent', 'read_failed', 'unreadable', 'not_read'].includes(stateStatus) ? stateStatus : 'not_read'),
  };
}

const figure = (v) => (v === null || v === undefined ? 'unknown' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** The state's line, its status first; null figures print as unknown, never as zero. Pure. */
function stateLines(s) {
  if (s.status === 'absent') return ['Status: absent: no state document was found. Every figure is unknown (not zero).'];
  if (s.status === 'unreadable') return [`Status: unreadable (${s.cause === 'read_failed' ? 'the read failed' : 'a document this code does not read'}). Every figure is unknown (not zero).`];
  if (s.status === 'not_read') return ['Status: not read. Every figure is unknown.'];
  const head = s.status === 'partial'
    ? `Status: partial: ${s.malformedEntries} malformed entries counted apart and NOT aggregated; ${s.validEntries} valid of ${s.entries} entries. Figures are ${s.totals}:`
    : `Status: read (${s.totals}): ${s.entries} entries.`;
  return [head, `Reservations counted: ${figure(s.reservations)} · last outcome ${figure(s.lastOutcome)} · typed reason ${figure(s.lastReason)}`];
}

/** The report, aggregates only. Pure. */
export function formatReport(c, { scope = '' } = {}) {
  const pop = c.meta?.populations ?? CENSUS_POPULATIONS;
  const range = c.meta?.range ?? { from: null, to: null };
  const lines = [
    `# Setup-label census${scope ? ` — ${scope}` : ''}`,
    '',
    'Aggregates only. A reservation is not a provider request; capture time is not availability; bench membership is not dispatch.',
    `Requested range: --from ${range.from ?? '(none)'} --to ${range.to ?? '(none)'}. Three populations follow; their figures are not comparable with one another.`,
    '',
    `## 1. ${pop.tickLabels.label}`,
    `Scope: ${pop.tickLabels.scope}.`,
    `Run memo: ${RUN_MEMO_NOTE} Reads issued ${c.ticks.readsIssued} · shared from an earlier tick ${c.ticks.readsShared}.`,
    '',
    `Tick records: ${c.ticks.records} · with a setupMenu block: ${c.ticks.withBlock}`,
    `Block status: ${JSON.stringify(c.ticks.blockStatus)}`,
    `Tick classes: ${JSON.stringify(c.tickClass)}`,
    `Candidates: ${c.candidates.total} · status ${JSON.stringify(c.candidates.status)} · omitted ${c.candidates.omitted} · truncated ${c.candidates.truncated} · unrecordable ${c.candidates.unrecordable}`,
    '',
    '### 1a. Cohorts (each its own denominator)',
    ...Object.entries(c.cohorts).map(([k, v]) => `- ${k}: ${v.total} · ${JSON.stringify(v.status)}`),
    '',
    '### 1b. Absent snapshots',
    `By source: ${JSON.stringify(c.absent.bySource)} (catalyst additions are not acquired by design)`,
    `Slice 2 history on the tick records (reservations and recorded outcomes only): ${JSON.stringify(c.absent.slice2History)}`,
    `Last recorded outcome: ${JSON.stringify(c.absent.lastOutcome)}`,
    '',
    '### 1c. Provider capture and joins',
    `Provider capture before the freeze (NOT availability at the decision): ${JSON.stringify(c.providerCapture)}`,
    `Joins (one record each): pick ${JSON.stringify(c.joins.pick)} · actions ${JSON.stringify(c.joins.actions)} (proposal_tick_unevaluated is INFERRED: a model-sourced swap that is not the tick's own decision)`,
    '',
    `## 2. ${pop.coverage.label}`,
    `Scope: ${pop.coverage.scope}.`,
    c.coverage ? `Coverage (the export's): ${JSON.stringify(c.coverage)}` : 'Coverage: not computed',
    '',
    `## 3. ${pop.state.label}`,
    `Scope: ${pop.state.scope}.`,
    ...stateLines(c.state),
    '',
    'No filtering, trading-performance or behavioural claim follows from these figures (M1/M2 limits).',
  ];
  return lines.join('\n');
}

/**
 * The census through a restricted reader (reads only).
 * @param {{ findBattleIds: Function, readBattle: Function, readTicks: Function, readBodyIds: Function, readState: Function }} reader
 */
/**
 * The requested range, refused unless each given bound is a real YYYY-MM-DD date and from <= to (review SC2-2): a
 * bound that is not a date would otherwise still filter (the export compares strings) while printing as no range.
 * Called before any read. Pure; throws a RangeError (code `invalid_range`) with a usage message.
 * @returns {{ from: string|null, to: string|null }}
 */
export function requestedRangeOf(flags) {
  const out = {};
  for (const key of ['from', 'to']) {
    const v = flags?.[key];
    if (v === null || v === undefined) { out[key] = null; continue; }
    const ok = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00.000Z`).toISOString().slice(0, 10) === v;
    if (!ok) throw Object.assign(new RangeError(`--${key} must be a date YYYY-MM-DD`), { code: 'invalid_range' });
    out[key] = v;
  }
  if (out.from !== null && out.to !== null && out.from > out.to) throw Object.assign(new RangeError('--from must not be after --to'), { code: 'invalid_range' });
  return out;
}

export async function runCensus(reader, flags) {
  const range = requestedRangeOf(flags); // before any read
  flags = { ...flags, from: range.from, to: range.to };
  const bounds = rangeBounds(flags);
  const battleIds = await reader.findBattleIds(bounds);
  const records = [];
  const inputs = [];
  for (const battleId of battleIds) {
    const battle = await reader.readBattle(battleId);
    if (!battle?.inCohort) continue;
    const ticks = await reader.readTicks(battleId);
    const bodyIds = new Set(await reader.readBodyIds(battleId));
    inputs.push(buildBattleInput({ battleId, mintedTickSeq: battle.mintedTickSeq ?? 0, permanentDocs: ticks, bodyIds }));
    for (const t of ticks) if (!(flags.from || flags.to) || inWindow(t?.capturedAt, bounds)) records.push(t);
  }
  let state = null;
  let stateStatus = 'not_read';
  try {
    const s = await reader.readState();
    stateStatus = s === null || s === undefined ? 'absent' : 'read'; // a document came back: validated in stateCensusOf
    state = s ?? null;
  } catch {
    stateStatus = 'read_failed';
  }
  return aggregateSetupMenu(records, { coverage: computeCoverage(inputs), state, stateStatus, range: { from: flags?.from ?? null, to: flags?.to ?? null } });
}

/** The cohort predicate: an allowlisted owner's battle in the slice's own scope — scopeOf, the predicate the freeze and the tenant use (review SM3 aside). Pure. */
export function inCohort(battle, owners) {
  return isObj(battle) && Array.isArray(owners) && owners.includes(battle.ownerId) && scopeOf(battle).inScope === true;
}

async function main() {
  const args = process.argv.slice(2);
  // A flag given without a value reads as '' (refused), never as "no range" (review SC2-2).
  const flag = (name) => { const i = args.indexOf(`--${name}`); return i === -1 ? null : args[i + 1] ?? ''; };
  const flags = requestedRangeOf({ from: flag('from'), to: flag('to') }); // refused before credentials or any read
  const { loadLocalEnv } = await import('./loadLocalEnv.js');
  loadLocalEnv();
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  const { readCockpitAllowlist } = await import('../api/_utils/callRecords/allowlist.js');
  const db = getFirebaseAdmin();
  const owners = readCockpitAllowlist();
  const reader = {
    findBattleIds: (bounds) => battleCohortForRange(db, bounds),
    readBattle: async (id) => {
      const snap = await db.collection('agentBattles').doc(id).get();
      if (!snap.exists) return null;
      const b = snap.data();
      return { inCohort: inCohort(b, owners), mintedTickSeq: b?.cronState?.tickSeq ?? 0 };
    },
    readTicks: async (id) => (await db.collection('agentBattles').doc(id).collection(TICKS_SUBCOLLECTION).get()).docs.map((d) => d.data()),
    readBodyIds: async (id) => (await db.collection('agentBattles').doc(id).collection(TICK_BODIES_SUBCOLLECTION).select().get()).docs.map((d) => d.id),
    readState: async () => { const s = await db.collection(STATE_COLLECTION).doc(STATE_DOC).get(); return s.exists ? s.data() : null; },
  };
  const census = await runCensus(reader, flags);
  const report = formatReport(census, { scope: `${flags.from || 'start'} → ${flags.to || 'end'}` });
  const out = flag('out');
  const json = flag('json');
  if (out) writeFileSync(out, report);
  if (json) writeFileSync(json, JSON.stringify(census, null, 2));
  console.log(report);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    // A refused range prints its own fixed message (no input echoed); any other failure prints its name and code only.
    if (err?.code === 'invalid_range') console.error(`census refused: ${err.message}. Usage: --from YYYY-MM-DD --to YYYY-MM-DD`);
    else console.error(`census failed: ${err?.name ?? 'Error'} ${err?.code ?? ''}`);
    process.exit(1);
  });
}
