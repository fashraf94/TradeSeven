// scripts/census-activation-evidence.mjs
//
// ID-1 Build 2 — THE ACTIVATION-EVIDENCE CENSUS (build prompt V3 §6; contract
// docs/design/20261104_ID1_ACTIVATION_EVIDENCE_SHAPE_NOTE_V1_7.md §8). What the
// observer wrote, and what it could not, for the allowlisted owners, over a
// window of trading sessions. Run after the first full session, then after a week.
//
// READ-ONLY BY CONSTRUCTION. runCensus receives a RESTRICTED READER (get,
// getAll and field-masked queries only), never the database handle: the handle
// exists only inside main(), which wraps it. The static imports are the
// observer's pure modules and the store's pure key and session modules;
// census-activation-evidence.test.js pins them, pins every member call in this
// file to a reviewed list, and pins that the resolver, the writer, the state,
// the tenant and getOrAcquireSnapshot are never imported. Attribution counts come
// from the written pointers' attributionStatus; the resolver is never called.
//
// AGGREGATES ONLY, ON EVERY CHANNEL. Markdown, JSON, stdout, stderr and error
// messages carry counts and distributions only: no owner, agent, battle,
// activation, position, tick or snapshot id, no symbol, no document path. An
// error prints its class and its code. The test seeds sentinel ids through every
// channel, a forced read error included, and asserts none appears.
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
import { isBeyondHorizon, isTerminal, lastTradingDayOf, sessionCloseMsOf } from '../api/_utils/activationEvidence/schedule.js';
import { joinTick, tickWindowsOf } from '../api/_utils/activationEvidence/tick.js';
import { instantMsOf } from '../api/_utils/activationEvidence/lifetimes.js';
import {
  ACTIVATIONS_SUBCOLLECTION, BATTLE_FIELDS, CANDIDATE_LOOKBACK_DAYS, DAY_MS, MAX_TICK_DOCS_PER_BATTLE, STORE_LEASE_MS, TICK_FIELDS,
} from '../api/_utils/activationEvidence/constants.js';
import { lastCompletedSessionAt } from '../api/_utils/setupEvidence/sessionAt.js';
import { snapshotIdOf } from '../api/_utils/setupEvidence/key.js';

/** The census's own page limit per owner (a full page is counted as truncated). */
export const CENSUS_PAGE = 1_000;
const POINTER_FIELDS = Object.freeze(['activationId', 'kind', 'tier', 'slot', 'snapshotRef', 'missing.detail', 'attributionStatus', 'activatingTick.source', 'activatedAtSource']);
const SNAPSHOT_FIELDS = Object.freeze(['capturedAt', 'sourceMeta.fetchedAt', 'evidenceClass.bars', 'writer.commit']);
const CLAIM_FIELDS = Object.freeze(['lease.claimedAt', 'observation.observedAt', 'attempts', 'lastAttemptAt']);
const FALLBACK_ID_RE = /^(star|core|support):\d+:\d{4}-\d{2}-\d{2}T/;
const SESSION_RE = /^\d{4}-\d{2}-\d{2}$/;

const bump = (obj, key, n = 1) => { obj[key] = (obj[key] || 0) + n; };
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
 * THE RESTRICTED READER: the only Firestore surface runCensus ever sees. Reads only,
 * and every query is field-masked (an empty mask is ids only).
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
      q = q.limit(limit).select(...fields);
      return (await q.get()).docs.map((d) => ({ id: d.id, data: d.data() }));
    },
  });
}

function emptyResult(window, nowMs) {
  return {
    window: { firstSession: window[0], lastSession: window[window.length - 1], sessions: window.length },
    at: new Date(nowMs).toISOString(),
    cohort: { battles: 0, inFlight: 0, candidatesRead: 0, candidatesTruncated: 0 },
    battles: { inCohort: 0, excluded: {}, gapBattles: 0, finalizationUndetermined: 0 },
    pointers: { total: 0, byKindRoute: {}, withEvidence: 0, null: 0, nullByDetail: {}, attribution: {}, activatingTick: {}, activatedAtSource: {}, writtenBeyondRetainedHistory: 0 },
    activations: { discoverable: 0, lowerBound: false, written: 0, writtenWithEvidence: 0, resolvable: 0, unresolved: {}, cryptoSkipped: 0, abandoned: {}, outstanding: 0, gapStartsWritten: 0, unreconstructableAtMost: 0, tickJoin: {} },
    headline: { pointersWithEvidence: 0, discoverableResolvable: 0, rate: null },
    outstandingKeys: { keys: 0, noKeyCalendarMissing: 0, finalExists: 0, liveLease: 0, observationAwaiting: { n: 0, ageMinutes: dist([]) }, attemptsNoObservation: { n: 0, attempts: dist([]), lastAttemptAgeMinutes: dist([]) }, neverAttempted: 0 },
    newestSessionCutoff: { finals: { n: 0, minutesAfterClose: dist([]), barsClass: {} }, outstanding: { n: 0, attempts: dist([]), lastAttemptAfterCloseMinutes: dist([]) } },
    writerCommit: { seen: false, value: null },
    errors: {},
  };
}

/**
 * @param {ReturnType<typeof restrictedReader>} reader
 * @param {{ owners: string[], session?: string|null, sessions?: number, nowMs?: number }} opts
 */
export async function runCensus(reader, { owners, session = null, sessions = 1, nowMs = Date.now() } = {}) {
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

  // The cohort: owner-scoped, ids only, then a field-masked read; last trading day in the window.
  const since = new Date(Date.parse(`${window[0]}T00:00:00Z`) - CANDIDATE_LOOKBACK_DAYS * DAY_MS).toISOString();
  const ids = [];
  for (const ownerId of owners) {
    try {
      const page = await reader.query({ collection: 'agentBattles', where: [['ownerId', '==', ownerId], ['createdAt', '>=', since]], orderBy: ['createdAt', 'desc'], limit: CENSUS_PAGE, fields: [] });
      if (page.length >= CENSUS_PAGE) R.cohort.candidatesTruncated += 1;
      for (const d of page) ids.push(d.id);
    } catch (err) { fail(err); }
  }
  R.cohort.candidatesRead = ids.length;
  let battles = [];
  try {
    const snaps = await reader.getAll(ids.map((id) => `agentBattles/${id}`), BATTLE_FIELDS);
    const read = snaps.map((s, i) => ({ id: ids[i], battle: s.data })).filter((b) => b.battle && owners.includes(b.battle.ownerId));
    // No readable last trading day: no cutoff, never a null pointer — and never in a cohort, so counted over the candidates.
    R.battles.finalizationUndetermined = read.filter((b) => lastTradingDayOf(b.battle) === null).length;
    battles = read.filter((b) => inWindow.has(lastTradingDayOf(b.battle)));
  } catch (err) { fail(err); }
  R.cohort.battles = battles.length;

  for (const { id, battle } of battles) {
    if (!isTerminal(battle)) { R.cohort.inFlight += 1; continue; } // in flight: counted once, in no other measure
    R.battles.inCohort += 1;
    const scope = scopeOf(battle);
    if (!scope.inScope) { bump(R.battles.excluded, scope.excludedBy); continue; }
    const d = discoverActivations(battle);
    if (d.gap) { R.battles.gapBattles += 1; R.activations.lowerBound = true; }

    // 1. The persisted pointers, independently of reconstruction.
    let pointers = [];
    try { pointers = (await reader.query({ collection: `agentBattles/${id}/${ACTIVATIONS_SUBCOLLECTION}`, limit: 500, fields: POINTER_FIELDS })).map((p) => ({ ...p.data, id: p.id })); } catch (err) { fail(err); }
    const discoverable = new Set(d.activations.map((a) => a.activationId));
    const written = new Map(pointers.map((p) => [p.id, p]));
    for (const p of pointers) {
      R.pointers.total += 1;
      bump(R.pointers.byKindRoute, `${p.kind === 'swap_in' ? 'swap_in' : 'creation'}/${FALLBACK_ID_RE.test(p.id) ? 'legacy' : 'corrected'}`);
      if (typeof p.snapshotRef === 'string') { R.pointers.withEvidence += 1; pointerRefs.push(p.snapshotRef); }
      else { R.pointers.null += 1; bump(R.pointers.nullByDetail, typeof p.missing?.detail === 'string' ? p.missing.detail.slice(0, 40) : 'none'); }
      bump(R.pointers.attribution, p.attributionStatus === 'unresolved' ? 'unresolved' : 'resolved');
      bump(R.pointers.activatedAtSource, typeof p.activatedAtSource === 'string' ? p.activatedAtSource : 'none');
      if (p.kind === 'swap_in') bump(R.pointers.activatingTick, p.activatingTick?.source === 'tick_action' ? 'tick_action' : 'unavailable');
      if (!discoverable.has(p.id)) R.pointers.writtenBeyondRetainedHistory += 1; // legitimate: its source rows are gone
    }

    // 3. The discoverable activations.
    R.activations.discoverable += d.activations.length;
    R.activations.cryptoSkipped += d.cryptoSkipped;
    for (const u of d.unresolved) {
      const startWritten = u.reason === 'gap' && pointers.some((p) => p.kind === 'creation' && p.tier === u.tier && p.slot === u.slot);
      if (startWritten) R.activations.gapStartsWritten += 1;
      else bump(R.activations.unresolved, u.reason);
    }
    if (d.gap) {
      const evicted = Math.max(0, (battle.scoreState?.tradeCount ?? 0) - (Array.isArray(battle.trades) ? battle.trades.length : 0));
      const writtenBeyond = pointers.filter((p) => p.kind === 'swap_in' && !discoverable.has(p.id)).length;
      R.activations.unreconstructableAtMost += Math.max(0, evicted - writtenBeyond); // reported apart, never as abandoned
    }
    const beyond = isBeyondHorizon(d.schedule, nowMs);
    const swapIns = [];
    for (const a of d.activations) {
      const key = activationKeyOf(a, ruleSet);
      if (!key.ok && key.reason === 'symbol_form') { bump(R.activations.unresolved, 'symbol_form'); continue; }
      R.activations.resolvable += 1;
      const p = written.get(a.activationId);
      if (p) {
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
        if (!p && outstanding.has(key.snapshotId)) outstanding.get(key.snapshotId).closeMs = closeMs;
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
        bump(R.activations.tickJoin, j.outcome === 'defer' ? j.reason : j.ambiguous ? 'ambiguous' : j.outcome);
      }
    }
  }
  R.headline = { pointersWithEvidence: R.activations.writtenWithEvidence, discoverableResolvable: R.activations.resolvable, rate: R.activations.resolvable ? Math.round((R.activations.writtenWithEvidence / R.activations.resolvable) * 1000) / 1000 : null };

  // 4. Outstanding keys, joined to the store, each in exactly one category by precedence.
  const keyIds = [...outstanding.keys()];
  R.outstandingKeys.keys = keyIds.length;
  let finals = [];
  let claims = [];
  try {
    finals = await reader.getAll(keyIds.map((k) => `setupEvidence/${k}`), SNAPSHOT_FIELDS);
    claims = await reader.getAll(keyIds.map((k) => `setupEvidenceClaims/${k}`), CLAIM_FIELDS);
  } catch (err) { fail(err); }
  const outstandingAfterClose = { attempts: [], lastAttemptAfterClose: [] };
  keyIds.forEach((k, i) => {
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
    } else R.outstandingKeys.neverAttempted += 1;
    const closeMs = outstanding.get(k).closeMs;
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
      bump(R.newestSessionCutoff.finals.barsClass, typeof s.data?.evidenceClass?.bars === 'string' ? s.data.evidenceClass.bars : 'none');
    });
    R.newestSessionCutoff.finals.minutesAfterClose = dist(minutes);
  } catch (err) { fail(err); }
  R.newestSessionCutoff.outstanding = { n: outstandingAfterClose.attempts.length, attempts: dist(outstandingAfterClose.attempts), lastAttemptAfterCloseMinutes: dist(outstandingAfterClose.lastAttemptAfterClose) };

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
  return R;
}

/** The report. Every number beside its denominator; no id, no symbol. */
export function renderMarkdown(R) {
  const j = (o) => JSON.stringify(o);
  return [
    '# Activation-evidence census',
    '',
    `Window: ${R.window.sessions} trading session(s), ${R.window.firstSession} to ${R.window.lastSession}. Read at ${R.at}. Aggregates only.`,
    '',
    '## Cohort',
    `- Battles whose last trading day is in the window: ${R.cohort.battles} (of ${R.cohort.candidatesRead} candidates read; ${R.cohort.candidatesTruncated} candidate page(s) truncated).`,
    `- In flight (still active; counted here and in no other measure): ${R.cohort.inFlight}.`,
    '',
    '## 1. Pointers (persisted pointers of the cohort\'s ended battles, independent of reconstruction)',
    `- Total: ${R.pointers.total}. With evidence: ${R.pointers.withEvidence}. Null: ${R.pointers.null}, by missing.detail ${j(R.pointers.nullByDetail)}.`,
    `- By kind and route (corrected = a position id, legacy = a fallback id): ${j(R.pointers.byKindRoute)}.`,
    `- attributionStatus: ${j(R.pointers.attribution)}. activatedAtSource: ${j(R.pointers.activatedAtSource)}. Swap-in activatingTick.source: ${j(R.pointers.activatingTick)}.`,
    `- Written beyond retained history (source rows evicted; legitimate): ${R.pointers.writtenBeyondRetainedHistory} of ${R.pointers.total}.`,
    '',
    '## 2. Battles (ended cohort battles)',
    `- Read: ${R.battles.inCohort}. Excluded, by the first reason in the order game mode, CPU, training clone, archetype: ${j(R.battles.excluded)}.`,
    `- Gap battles (older rows evicted): ${R.battles.gapBattles}. finalization_undetermined (no readable last trading day; counted over the ${R.cohort.candidatesRead} candidates read, since no cohort can hold them): ${R.battles.finalizationUndetermined}.`,
    '',
    `## 3. Activations (discoverable from retained history${R.activations.lowerBound ? '; a LOWER BOUND, because a gap battle is in the cohort' : ''})`,
    `- Discoverable: ${R.activations.discoverable}; resolvable: ${R.activations.resolvable}. Written: ${R.activations.written} of ${R.activations.resolvable} resolvable (with evidence ${R.activations.writtenWithEvidence}).`,
    `- Unresolved, by reason: ${j(R.activations.unresolved)}. Crypto lifetimes skipped: ${R.activations.cryptoSkipped}. Gap starting lifetimes already written: ${R.activations.gapStartsWritten}.`,
    `- Abandoned (resolvable, unwritten, past the horizon), by reason: ${j(R.activations.abandoned)}. Still outstanding: ${R.activations.outstanding}.`,
    `- Unreconstructable (evicted, unwritten; reported apart, never abandoned): at most ${R.activations.unreconstructableAtMost}.`,
    `- The tick join on the observer's bounded read, over discoverable swap-ins: ${j(R.activations.tickJoin)}.`,
    `- **Headline: pointers with evidence ÷ discoverable resolvable activations = ${R.headline.pointersWithEvidence} ÷ ${R.headline.discoverableResolvable} = ${R.headline.rate ?? 'n/a'}.**`,
    '',
    '## 4. Outstanding keys (discoverable, unwritten, resolvable; current rule set; each in exactly one category)',
    `- Keys: ${R.outstandingKeys.keys} (plus ${R.outstandingKeys.noKeyCalendarMissing} activation(s) the calendar cannot key).`,
    `- Final exists, pointer not yet written: ${R.outstandingKeys.finalExists} › live lease: ${R.outstandingKeys.liveLease} › observation awaiting confirmation: ${R.outstandingKeys.observationAwaiting.n}, age minutes ${j(R.outstandingKeys.observationAwaiting.ageMinutes)} › attempts with no observation: ${R.outstandingKeys.attemptsNoObservation.n}, attempts ${j(R.outstandingKeys.attemptsNoObservation.attempts)}, last attempt age minutes ${j(R.outstandingKeys.attemptsNoObservation.lastAttemptAgeMinutes)} › never attempted: ${R.outstandingKeys.neverAttempted}.`,
    '',
    '## 5. The newest-session cutoff (snapshots serving after-close activations of the window\'s sessions)',
    `- Finals: ${R.newestSessionCutoff.finals.n}; minutes from the session close to sourceMeta.fetchedAt ${j(R.newestSessionCutoff.finals.minutesAfterClose)}; bars class ${j(R.newestSessionCutoff.finals.barsClass)}.`,
    `- Outstanding keys of that kind: ${R.newestSessionCutoff.outstanding.n}; attempts ${j(R.newestSessionCutoff.outstanding.attempts)}; lastAttemptAt minus the close, minutes ${j(R.newestSessionCutoff.outstanding.lastAttemptAfterCloseMinutes)}.`,
    '- The fetch-failure log lines are read in Vercel (see the build report\'s log plan).',
    '',
    '## 6. writer.commit of one written snapshot',
    `- ${R.writerCommit.seen ? (R.writerCommit.value ?? 'null (Vercel exposed no commit)') : 'no snapshot read'}.`,
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
