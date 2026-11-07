// scripts/census-activation-evidence.mjs
//
// ID-1 Build 2 — THE ACTIVATION-EVIDENCE CENSUS (build prompt V3 §6; contract
// docs/design/20261104_ID1_ACTIVATION_EVIDENCE_SHAPE_NOTE_V1_7.md §8). What the
// observer wrote, and what it could not, for the allowlisted owners, over a
// window of trading sessions. Run after the first full session, then after a week.
//
// READ-ONLY BY CONSTRUCTION. runCensus receives a RESTRICTED READER (get,
// getAll and queries only), never the database handle: the handle exists only
// inside main(), which wraps it. Every read is field-masked except the pointer
// query, which reads whole pointers so the integrity section can check their
// exact field set. The static imports are the observer's pure modules, the
// store's pure key and session modules and a constants module;
// census-activation-evidence.test.js pins them, pins every member call in this
// file to a reviewed list, and pins that the resolver, the writer, the state,
// the tenant and getOrAcquireSnapshot are never imported. Attribution counts come
// from the written pointers' attributionStatus; the resolver is never called.
//
// AGGREGATES ONLY, ON EVERY CHANNEL. Markdown, JSON, stdout, stderr and error
// messages carry counts and distributions only: no owner, agent, battle,
// activation, position, tick or snapshot id, no symbol, no document path. An
// error prints its class and its code. Every bucket label read from a stored
// document is printed only when it is on its list in constants.js, anything else
// as `other` (review-fix prompt, review 5). The test seeds sentinel ids, and
// sentinel strings in every stored label, through every channel, a forced read
// error included, and asserts none appears.
//
// A FAILED READ IS NEVER EVIDENCE OF ABSENCE (review-fix prompt, review 3). A
// failed read of a final or a claim puts an outstanding key under `read_failed`,
// first in the precedence; `never attempted` needs both reads to have succeeded.
// A battle whose pointer read failed has unknown coverage: its activations are
// counted as unknown, never as unwritten, outstanding or abandoned, and are left
// out of both sides of the headline.
//
// POINTER INTEGRITY (review-fix prompt §2). Coverage alone cannot show a late or
// wrong pointer, so the census also checks the cohort's written pointers, counts
// only: identity (recomputed from the retained rows with the pure modules),
// evidence (against the snapshot each names), shape, and timeliness.
//
// THE WINDOW AND THE COHORT. --session <YYYY-MM-DD> is the window's last session
// (default: the last completed one); --sessions <n> counts trading sessions back
// by the calendar (default 1; 5 for the week). The cohort is the allowlisted
// owners' battles whose LAST trading day falls in the window. A battle still
// active is counted once, as in flight, and in no other measure.
//
// CREDENTIALS — env only, loaded LAZILY inside main(): scripts/loadLocalEnv.js
// (.env.local → process.env), api/_utils/firebaseAdmin.js, and the cockpit
// allowlist (api/_utils/callRecords/allowlist.js). The founder runs it; a build
// session never runs it against production.
//
// USAGE (repo root):
//   node scripts/census-activation-evidence.mjs [--session YYYY-MM-DD] [--sessions n] [--out report.md] [--json data.json]

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scopeOf } from '../api/_utils/activationEvidence/scope.js';
import { discoverActivations, activationKeyOf, currentRuleSet } from '../api/_utils/activationEvidence/discover.js';
import { expiresAtMsOf, isBeyondHorizon, isTerminal, lastTradingDayOf, sessionCloseMsOf } from '../api/_utils/activationEvidence/schedule.js';
import { joinTick, tickWindowsOf } from '../api/_utils/activationEvidence/tick.js';
import { instantMsOf, isoOf } from '../api/_utils/activationEvidence/lifetimes.js';
import {
  ACTIVATED_AT_SOURCES, ACTIVATING_TICK_SOURCES, ACTIVATIONS_SUBCOLLECTION, ATTRIBUTION_STATUSES, BARS_CLASSES, BATTLE_FIELDS, CANDIDATE_LOOKBACK_DAYS,
  DAY_MS, MAX_TICK_DOCS_PER_BATTLE, MISSING_DETAILS, POINTER_FIELD_SET, POINTER_KINDS, POINTER_SCHEMA_VERSION, STORE_LEASE_MS, TICK_FIELDS,
} from '../api/_utils/activationEvidence/constants.js';
import { lastCompletedSessionAt } from '../api/_utils/setupEvidence/sessionAt.js';
import { snapshotIdOf } from '../api/_utils/setupEvidence/key.js';
import { isCasualCloneId } from '../src/constants/leagueTournament.js';

/** The census's own page limit per owner (a full page is counted as truncated). */
export const CENSUS_PAGE = 1_000;
/** The pointer query reads whole documents (the integrity section checks the exact field set): the reader's one unmasked read. */
const WHOLE_DOCUMENT = null;
const SNAPSHOT_FIELDS = Object.freeze(['capturedAt', 'sourceMeta.fetchedAt', 'evidenceClass.bars', 'writer.commit']);
/** What the evidence check reads of the snapshot a pointer names. */
const EVIDENCE_FIELDS = Object.freeze(['schemaVersion', 'key', 'entry', 'capturedAt']);
const CLAIM_FIELDS = Object.freeze(['lease.claimedAt', 'observation.observedAt', 'attempts', 'lastAttemptAt']);
const FALLBACK_ID_RE = /^(star|core|support):\d+:\d{4}-\d{2}-\d{2}T/;
const SESSION_RE = /^\d{4}-\d{2}-\d{2}$/;

const bump = (obj, key, n = 1) => { obj[key] = (obj[key] || 0) + n; };
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** A stored value as a bucket label: on its list, else `other`; absent is `none`. A stored string is never echoed. */
export const labelOf = (value, allowed) => (value === undefined || value === null ? 'none' : allowed.includes(value) ? value : 'other');
/** An error as a class and a code, never its message (a message can carry an id). */
export const errorClassOf = (err) => {
  const name = /^[A-Z][A-Za-z]{0,30}$/.test(String(err?.name)) ? err.name : 'Error';
  // A code is a gRPC number or a lowercase status name; anything else (a code can be set to anything) is 'other'.
  const raw = err?.code === undefined || err?.code === null ? 'none' : String(err.code);
  const code = /^(\d{1,3}|[a-z][a-z-]{0,29}|none)$/.test(raw) ? raw : 'other';
  return `${name}:${code}`;
};
/** A distribution of numbers: n, min, median, max (rounded), never the values themselves. */
export function dist(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return { n: 0, min: null, p50: null, max: null };
  const r = (x) => Math.round(x * 10) / 10;
  return { n: v.length, min: r(v[0]), p50: r(v[Math.floor((v.length - 1) / 2)]), max: r(v[v.length - 1]) };
}
/** Deep equality of Firestore data: plain values, arrays, maps and Timestamps (by instant). */
export function sameData(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return Number.isNaN(a) && Number.isNaN(b);
  if (typeof a.toMillis === 'function' || typeof b.toMillis === 'function') return typeof a.toMillis === 'function' && typeof b.toMillis === 'function' && a.toMillis() === b.toMillis();
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => Object.hasOwn(b, k) && sameData(a[k], b[k]));
}
const sameRuleSet = (a, b) => isPlainObject(a) && isPlainObject(b) && Object.keys(a).length === 3 && Object.keys(b).length === 3
  && a.setupVersion === b.setupVersion && a.thresholdsHash === b.thresholdsHash && a.semanticsId === b.semanticsId;
/** The snapshot id a pointer's own fields name (its asOf, symbol and rule set), or null when they cannot form one. */
function keyIdOf(p) {
  try { return snapshotIdOf({ session: p.asOf, symbol: p.symbol, ruleSet: p.ruleSet }); } catch { return null; }
}
/** The anchor a pointer must carry for a snapshot entry (contract §4: its own swing low when it is a price). */
function anchorOf(entry) {
  const v = entry?.factsUsed?.swingLow?.value;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? { value: v, provenance: 'own_entry' } : { value: null, provenance: 'absent' };
}
const firstTradingDayOf = (battle) => {
  const days = battle?.timing?.tradingDays;
  return Array.isArray(days) && typeof days[0] === 'string' ? days[0] : null;
};

/** The window's sessions, newest last: `n` trading sessions ending at `lastSession`, by the calendar. */
export function windowSessionsOf(lastSession, n) {
  if (typeof lastSession !== 'string' || !SESSION_RE.test(lastSession)) throw new TypeError('census: --session must be YYYY-MM-DD');
  const close = sessionCloseMsOf(lastSession);
  if (close === null) throw new TypeError('census: --session must be a maintained trading session');
  const out = [lastSession];
  while (out.length < n) {
    const prev = lastCompletedSessionAt(sessionCloseMsOf(out[0]) - 1);
    if (!prev.ok) throw new TypeError('census: the window leaves the maintained calendar');
    out.unshift(prev.session);
  }
  return out;
}

/** Arguments; a malformed value fails loudly, never silently widens the read. */
export function parseArgs(argv) {
  const a = { session: null, sessions: 1, outPath: null, jsonPath: null };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split('=');
    const value = () => (inline !== undefined ? inline : argv[++i]);
    if (flag === '--session') { a.session = value(); if (!SESSION_RE.test(a.session || '')) throw new TypeError('census: --session must be YYYY-MM-DD'); }
    else if (flag === '--sessions') { a.sessions = Number(value()); if (!Number.isInteger(a.sessions) || a.sessions < 1 || a.sessions > 60) throw new TypeError('census: --sessions must be an integer from 1 to 60'); }
    else if (flag === '--out') a.outPath = value();
    else if (flag === '--json') a.jsonPath = value();
    else throw new TypeError('census: unknown argument');
  }
  return a;
}

/**
 * THE RESTRICTED READER: the only Firestore surface runCensus ever sees. Reads only. Every get and getAll is
 * field-masked (an empty mask is existence only); a query is field-masked (an empty mask is ids only) unless
 * its `fields` is null, which the census passes for the pointer query alone.
 */
export function restrictedReader(db) {
  const snapOf = (s) => ({ exists: s.exists, data: s.exists ? s.data() : null });
  return Object.freeze({
    get: async (path, fields) => snapOf((await db.getAll(db.doc(path), { fieldMask: [...fields] }))[0]),
    getAll: async (paths, fields) => (paths.length ? (await db.getAll(...paths.map((p) => db.doc(p)), { fieldMask: [...fields] })).map(snapOf) : []),
    query: async ({ collection, where = [], orderBy = null, limit, fields }) => {
      let q = db.collection(collection);
      for (const [f, op, v] of where) q = q.where(f, op, v);
      if (orderBy) q = q.orderBy(orderBy[0], orderBy[1]);
      q = q.limit(limit);
      if (fields !== null) q = q.select(...fields);
      return (await q.get()).docs.map((d) => ({ id: d.id, data: d.data() }));
    },
  });
}

function emptyIntegrity() {
  return {
    pointers: 0,
    mismatches: 0, // field mismatches: one wrong pointer can count under several fields
    pointersWithMismatch: 0,
    identity: { checked: 0, notCheckable: 0, byField: {} },
    evidence: { checked: 0, readFailed: 0, byField: {} },
    nullPointers: { checked: 0, snapshotNowExists: 0, readFailed: 0, unkeyable: 0 },
    shape: { byField: {} },
    timeliness: { withEvidenceMinutesAfterActivation: dist([]), nullMinutesAfterCutoff: dist([]), nullBeforeCutoff: 0, nullNoCutoff: 0, unreadableInstants: 0 },
  };
}

function emptyResult(window, nowMs) {
  return {
    window: { firstSession: window[0], lastSession: window[window.length - 1], sessions: window.length },
    at: new Date(nowMs).toISOString(),
    cohort: { battles: 0, inFlight: 0, candidatesRead: 0, candidatesTruncated: 0, readFailed: 0 },
    battles: { inCohort: 0, excluded: {}, gapBattles: 0, finalizationUndetermined: 0, malformed: 0 },
    pointers: { total: 0, byKindRoute: {}, withEvidence: 0, null: 0, nullByDetail: {}, attribution: {}, activatingTick: {}, activatedAtSource: {}, writtenBeyondRetainedHistory: 0, writtenNowUnresolved: 0 },
    activations: {
      discoverable: 0, lowerBound: false, written: 0, writtenWithEvidence: 0, resolvable: 0, unresolved: {}, cryptoSkipped: 0, abandoned: {}, outstanding: 0, gapStartsWritten: 0, unreconstructableAtMost: 0, tickJoin: {},
      coverageUnknown: { battles: 0, activations: 0, gapStarts: 0 },
    },
    headline: { pointersWithEvidence: 0, discoverableResolvable: 0, coverageUnknown: 0, rate: null },
    outstandingKeys: { keys: 0, noKeyCalendarMissing: 0, readFailed: 0, finalExists: 0, liveLease: 0, observationAwaiting: { n: 0, ageMinutes: dist([]) }, attemptsNoObservation: { n: 0, attempts: dist([]), lastAttemptAgeMinutes: dist([]) }, neverAttempted: 0 },
    newestSessionCutoff: { finals: { n: 0, readFailed: 0, minutesAfterClose: dist([]), barsClass: {} }, outstanding: { n: 0, readFailed: 0, attempts: dist([]), lastAttemptAfterCloseMinutes: dist([]) } },
    writerCommit: { seen: false, value: null },
    integrity: emptyIntegrity(),
    errors: {},
  };
}

/**
 * @param {ReturnType<typeof restrictedReader>} reader
 * @param {{ owners: string[], session?: string|null, sessions?: number, nowMs?: number }} opts
 */
export async function runCensus(reader, { owners: listed, session = null, sessions = 1, nowMs = Date.now() } = {}) {
  const owners = [...new Set(listed)]; // an owner listed twice is one owner (review PFB-8): never two copies of each battle
  const last = session ?? (() => { const s = lastCompletedSessionAt(nowMs); if (!s.ok) throw new TypeError('census: the calendar cannot name the last session'); return s.session; })();
  const window = windowSessionsOf(last, sessions);
  const inWindow = new Set(window);
  const R = emptyResult(window, nowMs);
  const ruleSet = currentRuleSet();
  const fail = (err) => bump(R.errors, errorClassOf(err));
  const afterClose = []; // { snapshotId, closeMs }
  const outstanding = new Map(); // snapshotId → { afterClose: closeMs|null }
  const knownFinals = []; // snapshot ids seen to exist, for the writer.commit read (never printed)
  const pointerRefs = [];
  const audited = []; // { battle, d, pointers }: the battles whose pointers were read, for the integrity section
  const storedFields = new WeakMap(); // pointer → the field names its document holds (before the reader's `id` is added)

  // The cohort: owner-scoped, ids only, then a field-masked read; last trading day in the window.
  const since = new Date(Date.parse(`${window[0]}T00:00:00Z`) - CANDIDATE_LOOKBACK_DAYS * DAY_MS).toISOString();
  const ids = [];
  for (const ownerId of owners) {
    try {
      const page = await reader.query({ collection: 'agentBattles', where: [['ownerId', '==', ownerId], ['createdAt', '>=', since]], orderBy: ['createdAt', 'desc'], limit: CENSUS_PAGE, fields: [] });
      if (page.length >= CENSUS_PAGE) R.cohort.candidatesTruncated += 1;
      for (const d of page) ids.push(d.id);
    } catch (err) { fail(err); R.cohort.readFailed += 1; }
  }
  R.cohort.candidatesRead = ids.length;
  let battles = [];
  try {
    const snaps = await reader.getAll(ids.map((id) => `agentBattles/${id}`), BATTLE_FIELDS);
    const owned = snaps.map((s, i) => ({ id: ids[i], battle: s.data })).filter((b) => b.battle && owners.includes(b.battle.ownerId));
    // A battle with no agent id is no record the observer would write (tenant.js skips it): counted, never measured.
    const read = owned.filter((b) => typeof b.battle.agentId === 'string' && b.battle.agentId.length > 0);
    R.battles.malformed = owned.length - read.length;
    // No readable last trading day: no cutoff, never a null pointer — and never in a cohort, so counted over the candidates.
    R.battles.finalizationUndetermined = read.filter((b) => scopeOf(b.battle).inScope && lastTradingDayOf(b.battle) === null).length; // in scope only, as the observer counts (review L4-3)
    battles = read.filter((b) => inWindow.has(lastTradingDayOf(b.battle)));
  } catch (err) { fail(err); R.cohort.readFailed += 1; }
  R.cohort.battles = battles.length;

  for (const { id, battle } of battles) {
    // In flight: not terminal and not yet expired — counted once, in no other measure. An expired battle awaiting its
    // 02:00 UTC settlement has ended for the observer, so it is measured (review L2-5).
    const expiresAtMs = expiresAtMsOf(battle);
    if (!isTerminal(battle) && (expiresAtMs === null || nowMs < expiresAtMs)) { R.cohort.inFlight += 1; continue; }
    R.battles.inCohort += 1;
    const scope = scopeOf(battle);
    if (!scope.inScope) { bump(R.battles.excluded, scope.excludedBy); continue; }
    const d = discoverActivations(battle);
    if (d.gap) { R.battles.gapBattles += 1; R.activations.lowerBound = true; }

    // 1. The persisted pointers, independently of reconstruction (whole documents: the integrity section reads them).
    let pointers = [];
    let pointersRead = true;
    try {
      const rows = await reader.query({ collection: `agentBattles/${id}/${ACTIVATIONS_SUBCOLLECTION}`, limit: 500, fields: WHOLE_DOCUMENT });
      pointers = rows.map((r) => { const p = { ...r.data, id: r.id }; storedFields.set(p, Object.keys(r.data || {})); return p; });
    } catch (err) { fail(err); pointersRead = false; }
    // A failed pointer read is no evidence that nothing was written: this battle's coverage is unknown (review 3).
    if (pointersRead) audited.push({ id, battle, d, pointers }); else R.activations.coverageUnknown.battles += 1;
    const discoverable = new Set(d.activations.map((a) => a.activationId));
    const written = new Map(pointers.map((p) => [p.id, p]));
    for (const p of pointers) {
      R.pointers.total += 1;
      bump(R.pointers.byKindRoute, `${labelOf(p.kind, POINTER_KINDS)}/${FALLBACK_ID_RE.test(p.id) ? 'legacy' : 'corrected'}`);
      if (typeof p.snapshotRef === 'string') { R.pointers.withEvidence += 1; pointerRefs.push(p.snapshotRef); }
      else { R.pointers.null += 1; bump(R.pointers.nullByDetail, labelOf(p.missing?.detail, MISSING_DETAILS)); }
      bump(R.pointers.attribution, labelOf(p.attributionStatus, ATTRIBUTION_STATUSES));
      bump(R.pointers.activatedAtSource, labelOf(p.activatedAtSource, ACTIVATED_AT_SOURCES));
      if (p.kind === 'swap_in') bump(R.pointers.activatingTick, labelOf(p.activatingTick?.source, ACTIVATING_TICK_SOURCES));
      // Not discoverable now: under a gap, its source rows are gone (legitimate); without one, its slot no longer resolves (review L1-3).
      if (!discoverable.has(p.id)) { if (d.gap) R.pointers.writtenBeyondRetainedHistory += 1; else R.pointers.writtenNowUnresolved += 1; }
    }

    // 3. The discoverable activations.
    R.activations.discoverable += d.activations.length;
    R.activations.cryptoSkipped += d.cryptoSkipped;
    for (const u of d.unresolved) {
      if (u.reason === 'gap' && !pointersRead) { R.activations.coverageUnknown.gapStarts += 1; continue; } // written or not: unknown
      const startWritten = u.reason === 'gap' && pointers.some((p) => p.kind === 'creation' && p.tier === u.tier && p.slot === u.slot);
      if (startWritten) R.activations.gapStartsWritten += 1;
      else bump(R.activations.unresolved, u.reason);
    }
    if (d.gap) {
      const evicted = Math.max(0, (battle.scoreState?.tradeCount ?? 0) - (Array.isArray(battle.trades) ? battle.trades.length : 0));
      const writtenBeyond = pointers.filter((p) => p.kind === 'swap_in' && !discoverable.has(p.id)).length;
      R.activations.unreconstructableAtMost += Math.max(0, evicted - writtenBeyond); // reported apart, never as abandoned; still an upper bound with no pointers read
    }
    const beyond = isBeyondHorizon(d.schedule, nowMs);
    const swapIns = [];
    for (const a of d.activations) {
      const key = activationKeyOf(a, ruleSet);
      if (!key.ok && key.reason === 'symbol_form') { bump(R.activations.unresolved, 'symbol_form'); continue; }
      R.activations.resolvable += 1;
      const p = written.get(a.activationId);
      if (!pointersRead) R.activations.coverageUnknown.activations += 1; // never unwritten, outstanding or abandoned
      else if (p) {
        R.activations.written += 1;
        if (typeof p.snapshotRef === 'string') R.activations.writtenWithEvidence += 1;
      } else if (beyond) bump(R.activations.abandoned, key.ok ? 'unwritten' : key.reason);
      else {
        R.activations.outstanding += 1;
        if (!key.ok) R.outstandingKeys.noKeyCalendarMissing += 1;
        else if (!outstanding.has(key.snapshotId)) outstanding.set(key.snapshotId, { closeMs: null });
      }
      if (key.ok && key.relation === 'after_close' && inWindow.has(key.session)) {
        const closeMs = sessionCloseMsOf(key.session);
        afterClose.push({ snapshotId: key.snapshotId, closeMs });
        if (pointersRead && !p && outstanding.has(key.snapshotId)) outstanding.get(key.snapshotId).closeMs = closeMs;
      }
      if (a.kind === 'swap_in') swapIns.push({ a, written: Boolean(p) });
    }
    // The tick join, re-run on the same bounded read the observer makes.
    if (swapIns.length) {
      const ticks = [];
      let complete = true;
      let remaining = MAX_TICK_DOCS_PER_BATTLE;
      for (const w of tickWindowsOf(swapIns.map((s) => s.a))) {
        try {
          const page = await reader.query({ collection: `agentBattles/${id}/ticks`, where: [['capturedAt', '>=', w.startIso], ['capturedAt', '<=', w.endIso]], orderBy: ['capturedAt', 'asc'], limit: remaining, fields: TICK_FIELDS });
          for (const t of page) ticks.push(t.data);
          if (page.length >= remaining) complete = false;
          remaining -= page.length;
        } catch (err) { fail(err); complete = false; }
      }
      for (const { a } of swapIns) {
        const j = joinTick(a, { complete, ticks }, { nowMs, finalizing: true });
        bump(R.activations.tickJoin, j.outcome === 'defer' ? j.reason : j.ambiguous ? 'ambiguous' : j.malformed ? 'malformed' : j.outcome);
      }
    }
  }
  const known = R.activations.resolvable - R.activations.coverageUnknown.activations;
  R.headline = {
    pointersWithEvidence: R.activations.writtenWithEvidence, discoverableResolvable: known, coverageUnknown: R.activations.coverageUnknown.activations,
    rate: known ? Math.round((R.activations.writtenWithEvidence / known) * 1000) / 1000 : null,
  };

  // 4. Outstanding keys, joined to the store, each in exactly one category by precedence. A read that failed is
  // first (review 3): it is never evidence of absence, so it can never make a key "never attempted".
  const keyIds = [...outstanding.keys()];
  R.outstandingKeys.keys = keyIds.length;
  let finals = null;
  let claims = null;
  try { finals = await reader.getAll(keyIds.map((k) => `setupEvidence/${k}`), SNAPSHOT_FIELDS); } catch (err) { fail(err); }
  try { claims = await reader.getAll(keyIds.map((k) => `setupEvidenceClaims/${k}`), CLAIM_FIELDS); } catch (err) { fail(err); }
  const outstandingAfterClose = { attempts: [], lastAttemptAfterClose: [], readFailed: 0 };
  keyIds.forEach((k, i) => {
    const closeMs = outstanding.get(k).closeMs;
    if (finals === null || claims === null) {
      R.outstandingKeys.readFailed += 1;
      if (closeMs !== null) outstandingAfterClose.readFailed += 1;
      return;
    }
    const f = finals[i];
    const c = claims[i]?.data;
    const claimedMs = instantMsOf(c?.lease?.claimedAt);
    const observedMs = instantMsOf(c?.observation?.observedAt);
    const lastMs = instantMsOf(c?.lastAttemptAt);
    if (f?.exists) { R.outstandingKeys.finalExists += 1; knownFinals.push(k); }
    else if (claimedMs !== null && Math.abs(nowMs - claimedMs) < STORE_LEASE_MS) R.outstandingKeys.liveLease += 1;
    else if (observedMs !== null) { R.outstandingKeys.observationAwaiting.n += 1; R.outstandingKeys.observationAwaiting.ages = [...(R.outstandingKeys.observationAwaiting.ages || []), (nowMs - observedMs) / 60_000]; }
    else if (Number.isInteger(c?.attempts) && c.attempts > 0) {
      const o = R.outstandingKeys.attemptsNoObservation;
      o.n += 1; (o.raw ||= []).push(c.attempts); (o.ages ||= []).push(lastMs === null ? null : (nowMs - lastMs) / 60_000);
    } else R.outstandingKeys.neverAttempted += 1; // both reads succeeded and show no attempt
    if (closeMs !== null && !f?.exists) {
      outstandingAfterClose.attempts.push(Number.isInteger(c?.attempts) ? c.attempts : 0);
      if (lastMs !== null) outstandingAfterClose.lastAttemptAfterClose.push((lastMs - closeMs) / 60_000);
    }
  });
  const oa = R.outstandingKeys.observationAwaiting; oa.ageMinutes = dist(oa.ages || []); delete oa.ages;
  const an = R.outstandingKeys.attemptsNoObservation; an.attempts = dist(an.raw || []); an.lastAttemptAgeMinutes = dist(an.ages || []); delete an.raw; delete an.ages;

  // 5. The newest-session cutoff: finals serving after-close activations of the window's sessions.
  const ac = [...new Map(afterClose.map((x) => [x.snapshotId, x])).values()];
  try {
    const snaps = await reader.getAll(ac.map((x) => `setupEvidence/${x.snapshotId}`), SNAPSHOT_FIELDS);
    const minutes = [];
    snaps.forEach((s, i) => {
      if (!s.exists) return;
      knownFinals.push(ac[i].snapshotId);
      R.newestSessionCutoff.finals.n += 1;
      const fetched = instantMsOf(s.data?.sourceMeta?.fetchedAt);
      if (fetched !== null && ac[i].closeMs !== null) minutes.push((fetched - ac[i].closeMs) / 60_000);
      bump(R.newestSessionCutoff.finals.barsClass, labelOf(s.data?.evidenceClass?.bars, BARS_CLASSES));
    });
    R.newestSessionCutoff.finals.minutesAfterClose = dist(minutes);
  } catch (err) { fail(err); R.newestSessionCutoff.finals.readFailed = ac.length; }
  R.newestSessionCutoff.outstanding = { n: outstandingAfterClose.attempts.length, readFailed: outstandingAfterClose.readFailed, attempts: dist(outstandingAfterClose.attempts), lastAttemptAfterCloseMinutes: dist(outstandingAfterClose.lastAttemptAfterClose) };

  // 6. One written snapshot's writer.commit (a build SHA, or null where Vercel exposes none).
  // A snapshot seen to exist first, then the written pointers' snapshotRef; at most three reads.
  for (const id of [...new Set([...knownFinals, ...pointerRefs])].slice(0, 3)) {
    try {
      const s = await reader.get(`setupEvidence/${id}`, SNAPSHOT_FIELDS);
      if (!s.exists) continue;
      const c = s.data?.writer?.commit;
      R.writerCommit = { seen: true, value: typeof c === 'string' && /^[0-9a-f]{7,40}$/i.test(c) ? c : null };
      break;
    } catch (err) { fail(err); }
  }

  // 7. Pointer integrity.
  R.integrity = await integrityOf(reader, audited, { fail, storedFields });
  return R;
}

/**
 * POINTER INTEGRITY over the written pointers of the battles whose pointer read succeeded (review-fix prompt §2).
 * Counts only. A snapshot read that fails is counted as such, never as a mismatch or an absence.
 */
async function integrityOf(reader, audited, { fail, storedFields }) {
  const I = emptyIntegrity();
  const flagged = []; // the pointer being checked, once per mismatch (deduplicated at the end)
  let current = null; // the pointer being checked
  const mismatch = (section, field) => { bump(section.byField, field); I.mismatches += 1; flagged.push(current); };
  const evidenceChecks = []; // { p, ref }
  const nullChecks = []; // { p, keyId }
  const evidenceMinutes = [];
  const nullMinutes = [];
  for (const { id: battleId, battle, d, pointers } of audited) {
    const byId = new Map(d.activations.map((a) => [a.activationId, a]));
    for (const p of pointers) {
      I.pointers += 1;
      current = p;
      // SHAPE.
      const fields = storedFields.get(p) || [];
      if (fields.length !== POINTER_FIELD_SET.length || !POINTER_FIELD_SET.every((f) => fields.includes(f))) mismatch(I.shape, 'fieldSet');
      if (p.schemaVersion !== POINTER_SCHEMA_VERSION) mismatch(I.shape, 'schemaVersion');
      if (Object.hasOwn(p, 'activatingTick') && p.activatingTick !== null && !(isPlainObject(p.activatingTick) && p.activatingTick.evaluationId === null)) mismatch(I.shape, 'activatingTick.evaluationId');
      const hasEntry = isPlainObject(p.entry);
      if (hasEntry ? p.missing !== null : !(p.entry === null && isPlainObject(p.missing))) mismatch(I.shape, 'missingExactlyWhenNoEntry');
      if (hasEntry ? typeof p.snapshotRef !== 'string' : p.snapshotRef !== null) mismatch(I.shape, 'snapshotRef');
      // The attribution rules (contract §4: `unresolved` EXACTLY when a casual clone's resolution left the clone's own id).
      if (!ATTRIBUTION_STATUSES.includes(p.attributionStatus)) mismatch(I.shape, 'attribution.status');
      if (p.attributionStatus === 'unresolved') {
        if (!isCasualCloneId(p.battleAgentId)) mismatch(I.shape, 'attribution.unresolvedNotCasualClone');
        if (p.attributionAgentId !== p.battleAgentId) mismatch(I.shape, 'attribution.unresolvedAgentNotBattleAgent');
      }
      if (p.attributionStatus === 'resolved') {
        if (isCasualCloneId(p.battleAgentId) && p.attributionAgentId === p.battleAgentId) mismatch(I.shape, 'attribution.resolvedOnCloneOwnId');
        if (!isCasualCloneId(p.battleAgentId) && p.attributionAgentId !== p.battleAgentId) mismatch(I.shape, 'attribution.rankedOnOtherAgent');
      }
      if (p.stream?.attributionAgentId !== p.attributionAgentId) mismatch(I.shape, 'stream.attributionAgentId');

      // IDENTITY. From the battle document (fields fixed at creation), always; from the retained rows, where they still
      // hold the pointer's lifetime (its id is discoverable now).
      const fromBattle = [
        ['battleId', p.battleId, battleId], ['battleAgentId', p.battleAgentId, battle.agentId ?? null], ['archetype', p.archetype, battle.agentContext?.archetype ?? null],
        ['stream.clone', p.stream?.clone, isCasualCloneId(battle.agentId) ? 'casual' : 'ranked'], ['stream.gameMode', p.stream?.gameMode, battle.gameMode ?? null],
      ];
      for (const [field, stored, value] of fromBattle) if (stored !== value) mismatch(I.identity, field);
      const a = byId.get(p.id);
      if (!a) I.identity.notCheckable += 1;
      else {
        I.identity.checked += 1;
        const at = lastCompletedSessionAt(a.activatedAtMs);
        const want = {
          activationId: a.activationId, kind: a.kind, symbol: a.symbol, tier: a.tier, slot: a.slot, activatedAt: a.activatedAt,
          asOf: at.ok ? at.session : null, firstTradingDay: firstTradingDayOf(battle),
        };
        for (const [field, value] of Object.entries(want)) if (p[field] !== value) mismatch(I.identity, field);
        // activatedAtSource depends on the slot's state for one row of contract §4.1 (review PFB-1): a corrected starting
        // position's pointer written while it was held says `position_swappedInAt`, and once it is sold the same lifetime
        // (the same id and instant) reads `outgoing_receipt`. Either is correct after the sale; only the first while held.
        const sourceOk = p.activatedAtSource === a.activatedAtSource
          || (a.kind === 'creation' && a.activatedAtSource === 'outgoing_receipt' && p.activatedAtSource === 'position_swappedInAt');
        if (!sourceOk) mismatch(I.identity, 'activatedAtSource');
      }

      // EVIDENCE (read below, in one batch) and TIMELINESS.
      const observedMs = instantMsOf(p.observedAt);
      if (hasEntry) {
        if (typeof p.snapshotRef === 'string') evidenceChecks.push({ p, ref: p.snapshotRef });
        const activatedMs = instantMsOf(p.activatedAt);
        if (observedMs === null || activatedMs === null) I.timeliness.unreadableInstants += 1;
        else evidenceMinutes.push((observedMs - activatedMs) / 60_000);
      } else if (p.entry === null) {
        const keyId = keyIdOf(p);
        if (keyId === null) I.nullPointers.unkeyable += 1;
        else nullChecks.push({ p, keyId });
        const cutoffMs = d.schedule.cutoffAtMs;
        if (cutoffMs === null) I.timeliness.nullNoCutoff += 1;
        else if (observedMs === null) I.timeliness.unreadableInstants += 1;
        else { nullMinutes.push((observedMs - cutoffMs) / 60_000); if (observedMs < cutoffMs) I.timeliness.nullBeforeCutoff += 1; }
      }
    }
  }
  I.timeliness.withEvidenceMinutesAfterActivation = dist(evidenceMinutes);
  I.timeliness.nullMinutesAfterCutoff = dist(nullMinutes);

  // The snapshots the pointers with evidence name.
  const refs = [...new Set(evidenceChecks.map((x) => x.ref))];
  let snaps = null;
  try { snaps = new Map((await reader.getAll(refs.map((r) => `setupEvidence/${r}`), EVIDENCE_FIELDS)).map((s, i) => [refs[i], s])); } catch (err) { fail(err); }
  for (const { p, ref } of evidenceChecks) {
    current = p;
    if (snaps === null) { I.evidence.readFailed += 1; continue; }
    I.evidence.checked += 1;
    const s = snaps.get(ref);
    if (!s?.exists) { mismatch(I.evidence, 'snapshotAbsent'); continue; }
    const snap = s.data || {};
    if (snap.key?.session !== p.asOf || snap.key?.symbol !== p.symbol || keyIdOf(p) !== ref) mismatch(I.evidence, 'key');
    if (!sameRuleSet(snap.key?.ruleSet, p.ruleSet)) mismatch(I.evidence, 'ruleSet');
    if (!sameData(p.entry, snap.entry)) mismatch(I.evidence, 'entry');
    if (!sameData(p.anchorSwingLow, anchorOf(snap.entry))) mismatch(I.evidence, 'anchorSwingLow');
    const capturedMs = instantMsOf(snap.capturedAt);
    const activatedMs = instantMsOf(p.activatedAt);
    const timing = capturedMs === null || activatedMs === null
      ? { snapshotCapturedAt: null, predatesActivation: null }
      : { snapshotCapturedAt: isoOf(capturedMs), predatesActivation: capturedMs < activatedMs };
    if (!sameData(p.evidenceTiming, timing)) mismatch(I.evidence, 'evidenceTiming');
  }

  // Null pointers whose snapshot exists now (allowed by the contract: a later final leaves a null pointer as it is).
  const nullIds = [...new Set(nullChecks.map((x) => x.keyId))];
  let nullSnaps = null;
  try { nullSnaps = new Map((await reader.getAll(nullIds.map((k) => `setupEvidence/${k}`), [])).map((s, i) => [nullIds[i], s])); } catch (err) { fail(err); }
  for (const { keyId } of nullChecks) {
    if (nullSnaps === null) { I.nullPointers.readFailed += 1; continue; }
    I.nullPointers.checked += 1;
    if (nullSnaps.get(keyId)?.exists) I.nullPointers.snapshotNowExists += 1;
  }
  I.pointersWithMismatch = new Set(flagged).size;
  return I;
}

/** The report. Every number beside its denominator; no id, no symbol. */
export function renderMarkdown(R) {
  const j = (o) => JSON.stringify(o);
  const I = R.integrity;
  const cu = R.activations.coverageUnknown;
  return [
    '# Activation-evidence census',
    '',
    `Window: ${R.window.sessions} trading session(s), ${R.window.firstSession} to ${R.window.lastSession}. Read at ${R.at}. Aggregates only.`,
    '',
    '## Cohort',
    `- Battles whose last trading day is in the window: ${R.cohort.battles} (of ${R.cohort.candidatesRead} candidates read; ${R.cohort.candidatesTruncated} candidate page(s) truncated).`,
    `- In flight (not terminal and not yet expired; counted here and in no other measure): ${R.cohort.inFlight}.`,
    `- Cohort reads that failed (the cohort is incomplete when this is above 0): ${R.cohort.readFailed}.`,
    '',
    '## 1. Pointers (persisted pointers of the cohort\'s ended battles, independent of reconstruction)',
    `- Total: ${R.pointers.total}. With evidence: ${R.pointers.withEvidence}. Null: ${R.pointers.null}, by missing.detail ${j(R.pointers.nullByDetail)}.`,
    `- By kind and route (corrected = a position id, legacy = a fallback id): ${j(R.pointers.byKindRoute)}.`,
    `- attributionStatus: ${j(R.pointers.attribution)}. activatedAtSource: ${j(R.pointers.activatedAtSource)}. Swap-in activatingTick.source: ${j(R.pointers.activatingTick)}.`,
    `- Written beyond retained history (a gap battle; source rows evicted; legitimate): ${R.pointers.writtenBeyondRetainedHistory} of ${R.pointers.total}. Written, but the slot no longer resolves (no gap): ${R.pointers.writtenNowUnresolved}.`,
    '- A label read from a pointer or a snapshot is shown only when it is on its list; anything else is `other`, an absent one `none`.',
    '',
    '## 2. Battles (ended cohort battles)',
    `- Read: ${R.battles.inCohort}. Excluded, by the first reason in the order game mode, CPU, training clone, archetype: ${j(R.battles.excluded)}.`,
    `- Gap battles (older rows evicted): ${R.battles.gapBattles}. finalization_undetermined (no readable last trading day; counted over the ${R.cohort.candidatesRead} candidates read, since no cohort can hold them): ${R.battles.finalizationUndetermined}.`,
    '',
    `## 3. Activations (discoverable from retained history${R.activations.lowerBound ? '; a LOWER BOUND, because a gap battle is in the cohort' : ''})`,
    `- Discoverable: ${R.activations.discoverable}; resolvable: ${R.activations.resolvable}. Written: ${R.activations.written} of ${R.activations.resolvable - cu.activations} resolvable with known coverage (with evidence ${R.activations.writtenWithEvidence}).`,
    `- Coverage unknown (the battle's pointer read failed; never counted as unwritten, outstanding or abandoned): ${cu.activations} resolvable activation(s) and ${cu.gapStarts} gap starting lifetime(s), in ${cu.battles} battle(s).`,
    `- Unresolved, by reason: ${j(R.activations.unresolved)}. Crypto lifetimes skipped: ${R.activations.cryptoSkipped}. Gap starting lifetimes already written: ${R.activations.gapStartsWritten}.`,
    `- Abandoned (resolvable, unwritten, past the horizon), by reason: ${j(R.activations.abandoned)}. Still outstanding: ${R.activations.outstanding}.`,
    `- Unreconstructable (evicted, unwritten; reported apart, never abandoned): at most ${R.activations.unreconstructableAtMost}.`,
    `- The tick join on the observer's bounded read, over discoverable swap-ins: ${j(R.activations.tickJoin)}.`,
    `- **Headline: pointers with evidence ÷ discoverable resolvable activations with known coverage = ${R.headline.pointersWithEvidence} ÷ ${R.headline.discoverableResolvable} = ${R.headline.rate ?? 'n/a'}** (${R.headline.coverageUnknown} with unknown coverage left out of both sides).`,
    '',
    '## 4. Outstanding keys (discoverable, unwritten, resolvable; current rule set; each in exactly one category)',
    `- Keys: ${R.outstandingKeys.keys} (plus ${R.outstandingKeys.noKeyCalendarMissing} activation(s) the calendar cannot key).`,
    `- read_failed (a final or claim read failed; never evidence of absence): ${R.outstandingKeys.readFailed} › final exists, pointer not yet written: ${R.outstandingKeys.finalExists} › live lease: ${R.outstandingKeys.liveLease} › observation awaiting confirmation: ${R.outstandingKeys.observationAwaiting.n}, age minutes ${j(R.outstandingKeys.observationAwaiting.ageMinutes)} › attempts with no observation: ${R.outstandingKeys.attemptsNoObservation.n}, attempts ${j(R.outstandingKeys.attemptsNoObservation.attempts)}, last attempt age minutes ${j(R.outstandingKeys.attemptsNoObservation.lastAttemptAgeMinutes)} › never attempted (both reads succeeded): ${R.outstandingKeys.neverAttempted}.`,
    '',
    '## 5. The newest-session cutoff (snapshots serving after-close activations of the window\'s sessions)',
    `- Finals: ${R.newestSessionCutoff.finals.n} (read failed for ${R.newestSessionCutoff.finals.readFailed} key(s)); minutes from the session close to sourceMeta.fetchedAt ${j(R.newestSessionCutoff.finals.minutesAfterClose)}; bars class ${j(R.newestSessionCutoff.finals.barsClass)}.`,
    `- Outstanding keys of that kind: ${R.newestSessionCutoff.outstanding.n} (plus ${R.newestSessionCutoff.outstanding.readFailed} whose reads failed); attempts ${j(R.newestSessionCutoff.outstanding.attempts)}; lastAttemptAt minus the close, minutes ${j(R.newestSessionCutoff.outstanding.lastAttemptAfterCloseMinutes)}.`,
    '- The fetch-failure log lines are read in Vercel (see the build report\'s log plan).',
    '',
    '## 6. writer.commit of one written snapshot',
    `- ${R.writerCommit.seen ? (R.writerCommit.value ?? 'null (Vercel exposed no commit)') : 'no snapshot read'}.`,
    '',
    '## 7. Pointer integrity (the cohort\'s written pointers whose battle\'s pointer read succeeded; counts only)',
    `- **Mismatches: ${I.mismatches}** field mismatch(es), in ${I.pointersWithMismatch} of ${I.pointers} pointer(s).`,
    `- Identity, recomputed from the battle document (every pointer) and from the retained rows: ${I.identity.checked} checked against their rows (${I.identity.notCheckable} not checkable there: source rows no longer retained, or the slot no longer resolves); mismatches by field ${j(I.identity.byField)}. A corrected starting position written while held and sold since may say position_swappedInAt (contract §4.1).`,
    `- Evidence, against the snapshot each pointer names: ${I.evidence.checked} checked (${I.evidence.readFailed} whose snapshot read failed); mismatches by field ${j(I.evidence.byField)}.`,
    `- Null pointers whose snapshot exists now (allowed by the contract; shown so it is seen): ${I.nullPointers.snapshotNowExists} of ${I.nullPointers.checked} checked (${I.nullPointers.readFailed} whose read failed; ${I.nullPointers.unkeyable} whose fields name no key).`,
    `- Shape (exact field set, schemaVersion 1, activatingTick.evaluationId null, missing null exactly when entry is not, snapshotRef, the attribution rules both ways): mismatches by field ${j(I.shape.byField)}.`,
    `- Timeliness: observedAt minus activatedAt, minutes, pointers with evidence ${j(I.timeliness.withEvidenceMinutesAfterActivation)}; observedAt minus the battle's cutoff, minutes, null pointers ${j(I.timeliness.nullMinutesAfterCutoff)}; null pointers observed before the cutoff ${I.timeliness.nullBeforeCutoff}, with no cutoff ${I.timeliness.nullNoCutoff}; unreadable instants ${I.timeliness.unreadableInstants}.`,
    '',
    `Read errors, by class and code: ${j(R.errors)}.`,
    '',
  ].join('\n');
}

/** The one line a failed run prints: a class and a code, never a message. */
export const fatalLine = (err) => `census failed: ${errorClassOf(err)}`;

/** Every output channel goes through here: the report file, the JSON file and stdout. */
export async function censusMain({ argv, reader, owners, writeFile = writeFileSync, log = console.log, nowMs }) {
  const args = parseArgs(argv);
  const R = await runCensus(reader, { owners, session: args.session, sessions: args.sessions, ...(nowMs === undefined ? {} : { nowMs }) });
  const md = renderMarkdown(R);
  if (args.outPath) writeFile(args.outPath, md);
  if (args.jsonPath) writeFile(args.jsonPath, `${JSON.stringify(R, null, 2)}\n`);
  log(md);
  return R;
}

async function main() {
  await import('./loadLocalEnv.js');
  const { getFirebaseAdmin } = await import('../api/_utils/firebaseAdmin.js');
  const { readCockpitAllowlist } = await import('../api/_utils/callRecords/allowlist.js');
  await censusMain({ argv: process.argv.slice(2), reader: restrictedReader(getFirebaseAdmin()), owners: readCockpitAllowlist() });
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) main().catch((err) => { console.error(fatalLine(err)); process.exit(1); });
