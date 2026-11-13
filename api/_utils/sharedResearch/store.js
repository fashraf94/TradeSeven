// api/_utils/sharedResearch/store.js
//
// Shared Research — THE WRITES AND READS (spec §5, §6.3, §6.6, §6.12, §15 S-4).
// Every write is ONE Firestore transaction with every read before every write;
// ids (sessions, exchanges, findings, the list) are minted BEFORE the
// transaction, so a retried transaction sends the same objects. The record is
// written only through the research model's pure patches (findingAppendPatch,
// summaryRevisionPatch, turnPatch, closePatch) applied to the record the
// transaction read — never a field set by hand.
//
//   beginFraming / recordFrame / noteFrameFailure   the `frame` action
//   openInvestigation          `open` (item, drop, or a framed observation)
//   beginStep / recordStep / failStep               the `step` action
//   closeInvestigation         `close`
//   adoptIdea                  `adopt`: shared mechanics + one origin adapter
//   readInvestigation, listOpen, readQuota, and the stored-fact reads
//
// The quota: `sharedResearchQuota/{uid}` (the player's day) and
// `sharedResearchQuota/_global` (the app's day), both reset when the ET date
// changes (spec §5.3, §6.12). A player's investigation counts at `open`, a
// framing when its model call is made, a step when its turn is persisted (D-1).

import {
  RESEARCH_WORK_COLLECTION, researchWorkIdFor, buildRecord, findingAppendPatch, summaryRevisionPatch, turnPatch,
  closePatch, manualFunnel, emptyTelemetry, isOwnedRecord, TERMINAL_REASONS, FINDINGS_MAX,
} from '../researchRecords/model.js';
import { researchWorkRefOf, TURN_OUTCOME_DEADLINE_MS } from '../researchRecords/store.js';
import {
  WATCHLISTS_COLLECTION, VERSIONS_SUBCOLLECTION, versionDocId, normalizeStatement, normalizeConditions, HORIZON_ENUMS,
  SHARED_RESEARCH_LIST_MARKER, buildSharedResearchVersion,
} from '../hypothesisRecords/model.js';
import { capTickersArray, splitRetiredTickers } from '../watchlistValidation.js';
import { ARCHETYPE_IDENTITY_VERSION } from '../archetypeVersionConstants.js';
import { baggerbombLoadoutOf } from '../../../src/constants/perGameLoadout.js';
import {
  PER_DAY, FRAMINGS_PER_DAY, GLOBAL_STEPS_PER_DAY_DEFAULT, GLOBAL_FRAMINGS_PER_DAY_DEFAULT, ADOPTABLE_HORIZONS,
  STEP_CALLS_PER_DAY, GLOBAL_STEP_CALLS_FACTOR,
} from '../../../src/constants/sharedResearch.js';
import {
  SESSIONS_COLLECTION, QUOTA_COLLECTION, GLOBAL_QUOTA_ID, etDateOf, framingSessionOf, openSessionOf, isOwnedSession,
  stepAdmissionOf, playerDayOf, globalDayOf, itemKeyOf, refuse, latestLinesOf, isFramingInFlight,
  liveSessionOf, previousSessionOf, previousViewOf,
} from './session.js';
import { previewRevOf, sameRev, carriedFor, adoptPreviewOf, assertAssertionsSupported, AssertionError } from './adoptPreview.js';
import { CLAIMS_READ_LIMIT } from './opening.js';

export const AGENTS_COLLECTION = 'agents';
/** The environment variable that overrides the app's daily step ceiling — read at call time (spec §6.12 control 4). */
export const GLOBAL_STEPS_ENV = 'SHARED_RESEARCH_GLOBAL_STEPS_PER_DAY';
/** Open investigations read for "Continue": the newest this many records, then at most LIST_OPEN_MAX shown (routine 6). */
export const LIST_OPEN_READ = 50;
export const LIST_OPEN_MAX = 3;

export const sessionRefOf = (db, sessionId) => db.collection(SESSIONS_COLLECTION).doc(sessionId);
export const quotaRefOf = (db, id) => db.collection(QUOTA_COLLECTION).doc(id);
const dataOf = (snap) => (snap?.exists ? snap.data() : null);

/** The app's daily step ceiling, NOW: the environment's whole number (0 pauses steps), else the default. Never cached. */
export function globalStepCeiling() {
  try {
    const raw = typeof process !== 'undefined' ? process.env?.[GLOBAL_STEPS_ENV] : undefined;
    const n = typeof raw === 'string' && /^\s*\d+\s*$/.test(raw) ? Number(raw) : NaN;
    return Number.isSafeInteger(n) && n >= 0 ? n : GLOBAL_STEPS_PER_DAY_DEFAULT;
  } catch {
    return GLOBAL_STEPS_PER_DAY_DEFAULT;
  }
}
export const globalFramingCeiling = () => GLOBAL_FRAMINGS_PER_DAY_DEFAULT;

/** An ISO instant from a Firestore Timestamp, a Date or a string; null when it is not one. */
export function isoOf(v) {
  try {
    const d = typeof v?.toDate === 'function' ? v.toDate() : v instanceof Date ? v : typeof v === 'string' ? new Date(v) : null;
    return d && Number.isFinite(d.getTime()) ? d.toISOString() : null;
  } catch {
    return null;
  }
}

// ── the ranked agent (§15 S-4) ───────────────────────────────────────────────

/**
 * The owner's RANKED agent among their agent documents — resolveRankedAgent's
 * rule (api/_utils/trainingClone.js), restated here so the route does not load
 * the clone provisioner's graph: the first agent that is neither a training nor
 * a casual clone. A parity test pins the two equal. Never a clone.
 */
export function rankedAgentOfDocs(docs) {
  const doc = (Array.isArray(docs) ? docs : []).find((d) => d.data().isTrainingClone !== true && d.data().isCasualClone !== true);
  return doc ? { id: doc.id, ...doc.data() } : null;
}
const agentsQueryOf = (db, uid) => db.collection(AGENTS_COLLECTION).where('ownerId', '==', uid);

/** The ranked agent read outside a transaction (the frame's partner name). */
export async function readRankedAgent(db, uid) {
  return rankedAgentOfDocs((await agentsQueryOf(db, uid).get()).docs);
}

/** The partner's given name, from the agent document (null → the prompt's fallback). */
export const partnerNameOf = (agent) => (typeof agent?.name === 'string' && agent.name.trim() ? agent.name.trim().slice(0, 40) : null);

/** The provenance stamp (spec §5.5): recorded from the ranked agent document, never inferred, never the client's. */
export function attributionOf(agent, nowIso) {
  let bb = null;
  try { bb = baggerbombLoadoutOf(agent)?.archetype ?? null; } catch { bb = null; }
  return {
    agentId: agent.id,
    archetypeCodeId: typeof agent.archetype === 'string' && agent.archetype ? agent.archetype : null,
    baggerbombArchetypeCodeId: typeof bb === 'string' && bb ? bb : null,
    identityVersion: ARCHETYPE_IDENTITY_VERSION,
    at: nowIso,
  };
}

// ── reads ─────────────────────────────────────────────────────────────────────

/** The caller's own session, or session_not_found (a missing and a foreign one answer alike). */
export async function readOwnedSession(db, { uid, sessionId }) {
  const s = dataOf(await sessionRefOf(db, sessionId).get());
  if (!isOwnedSession(s, uid)) throw refuse(404, 'session_not_found');
  return s;
}

/** The session and its record (null while framing). */
export async function readInvestigation(db, { uid, sessionId }) {
  const session = await readOwnedSession(db, { uid, sessionId });
  if (!session.researchWorkId) return { session, record: null };
  const record = dataOf(await researchWorkRefOf(db, session.researchWorkId).get());
  return { session, record: isOwnedRecord(record, uid) ? record : null };
}

/** The player's day as the answers show it. */
export async function readQuota(db, { uid, nowIso }) {
  return playerDayOf(dataOf(await quotaRefOf(db, uid).get()), etDateOf(nowIso));
}

/** "Continue your research" (spec §6.3 GET ?list=open; routine 6): the deployed (userId, createdAt desc) index, filtered in memory. */
export async function listOpen(db, { uid }) {
  const snap = await db.collection(RESEARCH_WORK_COLLECTION).where('userId', '==', uid).orderBy('createdAt', 'desc').limit(LIST_OPEN_READ).get();
  const records = snap.docs.map((d) => d.data()).filter((r) => isOwnedRecord(r, uid) && r.origin === 'shared_research' && r.state === 'open' && r.host?.collection === SESSIONS_COLLECTION);
  const rows = [];
  for (const r of records) {
    const s = dataOf(await sessionRefOf(db, r.host.id).get());
    if (!isOwnedSession(s, uid) || s.status !== 'open') continue;
    rows.push({ at: s.updatedAt, row: { sessionId: s.sessionId, question: r.question ?? null, state: r.state, lastTurnAt: r.telemetry?.lastTurnAt ?? null, findingsCount: Array.isArray(r.findings) ? r.findings.length : 0 } });
  }
  rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return rows.slice(0, LIST_OPEN_MAX).map((x) => x.row);
}

/** A FantasyTimes story as `open` reads it, or null (missing, or a deep dive — spec §6.3). */
export async function readStory(db, storyId) {
  const s = dataOf(await db.collection('fantasyTimesStories').doc(storyId).get());
  if (!s || s.type === 'deepdive' || typeof s.headline !== 'string' || !s.headline.trim()) return null;
  return {
    id: storyId, headline: s.headline, reporterName: s.reporterName ?? null, reporterBeat: s.reporterBeat ?? null,
    publishedAt: isoOf(s.publishedAt), primaryTicker: s.primaryTicker ?? null, tickers: Array.isArray(s.tickers) ? s.tickers : [],
  };
}

/** The caller's OWN drop, or null — another owner's drop is not found (spec §6.3). */
export async function readDrop(db, { uid, dropId }) {
  const d = dataOf(await db.collection('users').doc(uid).collection('signalDrops').doc(dropId).get());
  if (!d || (d.userId !== undefined && d.userId !== uid)) return null;
  return { ...d, droppedAt: isoOf(d.droppedAt) };
}

/** The stored facts the opening writes for the names in scope: the estimates cache and each name's newest claims. */
export async function readStoredFacts(db, names) {
  if (!names.length) return { estimates: null, claims: {} };
  const est = dataOf(await db.collection('estimatesCache').doc('latest').get());
  const claims = {};
  for (const symbol of names) {
    // The existing (ticker ASC, sourceDate DESC) index — getClaimsForTicker's primary query; no new index.
    const snap = await db.collection('ingestedClaims').where('ticker', '==', symbol).orderBy('sourceDate', 'desc').limit(CLAIMS_READ_LIMIT).get();
    const docs = snap.docs.map((x) => x.data());
    claims[symbol] = { count: docs.length, newest: typeof docs[0]?.sourceDate === 'string' ? docs[0].sourceDate : null };
  }
  return { estimates: est ? { computedAt: isoOf(est.computedAt), stocks: est.stocks ?? {} } : null, claims };
}

/** peerRankings and stockRankings rows by symbol (the opening's unwritten projection, and the company names). */
export async function readRankingRows(db, symbols) {
  const peers = {};
  const rankings = {};
  const rows = await Promise.all(symbols.map((s) => Promise.all([db.collection('peerRankings').doc(s).get(), db.collection('stockRankings').doc(s).get()])));
  symbols.forEach((symbol, i) => {
    const pd = dataOf(rows[i][0]);
    const rd = dataOf(rows[i][1]);
    if (pd) peers[symbol] = { name: typeof pd.name === 'string' ? pd.name : null, sector: pd.sector ?? null, metrics: pd.metrics ?? null, updatedAt: isoOf(pd.updatedAt ?? pd.computedAt) };
    if (rd) rankings[symbol] = { compositeScore: rd.compositeScore ?? null, percentile: rd.percentile ?? null, tier: rd.tier ?? null, updatedAt: isoOf(rd.updatedAt ?? rd.computedAt) };
  });
  return { peers, rankings };
}

/** Company names for symbols: `peerRankings/{symbol}.name` (spec F13); a symbol with no row keeps its symbol. */
export async function readNames(db, symbols) {
  const names = {};
  const snaps = await Promise.all(symbols.map((s) => db.collection('peerRankings').doc(s).get()));
  symbols.forEach((s, i) => {
    const d = dataOf(snaps[i]);
    if (typeof d?.name === 'string' && d.name.trim()) names[s] = d.name.trim();
  });
  return names;
}

// ── frame ────────────────────────────────────────────────────────────────────

/** The session a forge request id made, read in the transaction (a retry finds it). */
async function byRequestIn(tx, db, uid, requestId) {
  const snap = await tx.get(db.collection(SESSIONS_COLLECTION).where('userId', '==', uid).where('requestId', '==', requestId).limit(1));
  return snap.docs.length ? snap.docs[0].data() : null;
}

/**
 * Start (or re-run) a framing (spec §6.3 frame). A repeated requestId on a
 * framed session returns it with no second call; so does one whose call is
 * still in flight (review A2: no frame, no failure, started within 35 s); on
 * one whose framing failed (or went stale) it re-runs. The framing counts —
 * the player's day and the app's — here, when the model call is about to be
 * made (D-1 e).
 * @returns {Promise<{ session: object, run: boolean, day: object }>}
 */
export async function beginFraming(db, { uid, requestId, observation, playerExchange, sessionId, nowIso }) {
  const etDate = etDateOf(nowIso);
  return db.runTransaction(async (tx) => {
    const prior = await byRequestIn(tx, db, uid, requestId);
    const quotaSnap = await tx.get(quotaRefOf(db, uid));
    const globalSnap = await tx.get(quotaRefOf(db, GLOBAL_QUOTA_ID));
    const day = playerDayOf(dataOf(quotaSnap), etDate);
    if (prior && (prior.status !== 'framing' || prior.frame || isFramingInFlight(prior, Date.parse(nowIso)))) return { session: prior, run: false, day };
    if (day.framingsRun >= FRAMINGS_PER_DAY) throw refuse(429, 'framing_limit');
    const g = globalDayOf(dataOf(globalSnap), etDate);
    if (g.framings >= globalFramingCeiling()) throw refuse(503, 'budget_paused');
    const session = prior ? { ...prior, lastError: null, framingStartedAt: nowIso, updatedAt: nowIso } : framingSessionOf({ sessionId, userId: uid, requestId, observation, playerExchange, nowIso });
    if (prior) tx.update(sessionRefOf(db, session.sessionId), { lastError: null, framingStartedAt: nowIso, updatedAt: nowIso });
    else tx.set(sessionRefOf(db, session.sessionId), session);
    const after = { ...day, framingsRun: day.framingsRun + 1 };
    tx.set(quotaRefOf(db, uid), { ...after, updatedAt: nowIso });
    tx.set(quotaRefOf(db, GLOBAL_QUOTA_ID), { ...g, framings: g.framings + 1, updatedAt: nowIso });
    return { session, run: true, day: after };
  });
}

/** Write a framing's answer: the partner exchange and `frame` (only onto a framing session not yet framed). */
export async function recordFrame(db, { uid, sessionId, frame, partnerExchange, attempts, nowIso }) {
  const ref = sessionRefOf(db, sessionId);
  return db.runTransaction(async (tx) => {
    const s = dataOf(await tx.get(ref));
    if (!isOwnedSession(s, uid)) throw refuse(404, 'session_not_found');
    if (s.status !== 'framing' || s.frame) return s;
    const patch = {
      frame: { ...frame, at: nowIso, attempts }, lastError: null,
      exchanges: [...(s.exchanges ?? []), partnerExchange], updatedAt: nowIso,
    };
    tx.update(ref, patch);
    return { ...s, ...patch };
  });
}

/** A failed framing: `lastError` on the session, status stays `framing`. Awaited, never throws. */
export async function noteFrameFailure(db, { uid, sessionId, reason, nowIso }) {
  try {
    const ref = sessionRefOf(db, sessionId);
    await db.runTransaction(async (tx) => {
      const s = dataOf(await tx.get(ref));
      // A sibling call may have framed it meanwhile: a good frame is never shadowed by a failure line (review A2).
      if (!isOwnedSession(s, uid) || s.status !== 'framing' || s.frame) return;
      tx.update(ref, { lastError: { code: 'frame_failed', reason, at: nowIso }, updatedAt: nowIso });
    }, { maxAttempts: 1 });
    return true;
  } catch (err) {
    console.error('[shared-research] frame failure not noted:', err?.message || err);
    return false;
  }
}

// ── open ─────────────────────────────────────────────────────────────────────

/** The record a new investigation is minted as: question at mint, no subject, the opening's findings appended in order. */
function mintRecord({ sessionId, uid, question, findings, nowIso }) {
  let record = buildRecord({
    researchWorkId: researchWorkIdFor({ collection: SESSIONS_COLLECTION, id: sessionId }),
    userId: uid, origin: 'shared_research', host: { collection: SESSIONS_COLLECTION, id: sessionId }, createdAt: nowIso,
    question, funnel: manualFunnel(), budget: null, telemetry: emptyTelemetry(),
  });
  for (const f of findings) record = { ...record, ...findingAppendPatch(record, f, { nowIso }) };
  return record;
}

/** The ranked agent read INSIDE the transaction, and its stamp; none → 503 attribution_unavailable, before any write. */
async function attributionIn(tx, db, uid, nowIso) {
  const agent = rankedAgentOfDocs((await tx.get(agentsQueryOf(db, uid))).docs);
  if (!agent || agent.ownerId !== uid) throw refuse(503, 'attribution_unavailable');
  return attributionOf(agent, nowIso);
}

/**
 * Open an investigation from an item or a drop: one transaction — the quota +1,
 * the host created `open` with its attribution, the record minted with the
 * question and the opening's findings. Idempotent on requestId (a retry finds
 * the session it made and writes nothing). Only an OPEN investigation of this
 * owner on this item answers `existing`; once the earlier one has ended
 * (concluded, saved or abandoned) a new one opens (spec §16 FQ-1). Every answer
 * carries `previous` — the newest ended one before the answer's own session,
 * `{ sessionId, endedAt, terminalReason }`, or null — read before any write.
 * @returns {Promise<{ session, record, day, existing: boolean, replay: boolean, previous: object|null }>}
 */
export async function openFromItem(db, { uid, requestId, sessionId, entry, exchanges, findings, nowIso }) {
  const etDate = etDateOf(nowIso);
  const key = itemKeyOf(entry.itemRef);
  return db.runTransaction(async (tx) => {
    const prior = await byRequestIn(tx, db, uid, requestId);
    const sameItem = await tx.get(db.collection(SESSIONS_COLLECTION).where('userId', '==', uid).where('itemKey', '==', key));
    const quotaSnap = await tx.get(quotaRefOf(db, uid));
    const day = playerDayOf(dataOf(quotaSnap), etDate);
    const recordOf = async (s) => (s?.researchWorkId ? dataOf(await tx.get(researchWorkRefOf(db, s.researchWorkId))) : null);
    const sessions = sameItem.docs.map((d) => d.data()).filter((s) => isOwnedSession(s, uid));
    const previousFor = async (current) => {
      const p = previousSessionOf(sessions, current);
      if (!p) return null;
      const r = await recordOf(p);
      return previousViewOf(p, isOwnedRecord(r, uid) ? r : null);
    };
    if (prior && prior.itemKey !== key) throw refuse(400, 'invalid_request'); // a requestId names one request (review A5)
    if (prior) return { session: prior, record: await recordOf(prior), day, existing: false, replay: true, previous: await previousFor(prior) };
    const live = liveSessionOf(sessions);
    if (live) return { session: live, record: await recordOf(live), day, existing: true, replay: false, previous: await previousFor(live) };
    if (day.investigationsOpened >= PER_DAY) throw refuse(429, 'daily_limit');
    const previous = await previousFor({ sessionId, createdAt: nowIso });
    const attribution = await attributionIn(tx, db, uid, nowIso);
    const record = mintRecord({ sessionId, uid, question: entry.question, findings, nowIso });
    const session = openSessionOf({ sessionId, userId: uid, requestId, entry, exchanges, attribution, researchWorkId: record.researchWorkId, nowIso });
    tx.set(sessionRefOf(db, sessionId), session);
    tx.create(researchWorkRefOf(db, record.researchWorkId), record);
    const after = { ...day, investigationsOpened: day.investigationsOpened + 1 };
    tx.set(quotaRefOf(db, uid), { ...after, updatedAt: nowIso });
    return { session, record, day: after, existing: false, replay: false, previous };
  });
}

/**
 * The GET's `previous` (spec §16 FQ-1): the newest ended investigation of the
 * same owner and item created before this one — never this one — or null (an
 * observation has no item). An equality-only query, sorted in memory: no index.
 */
export async function readPrevious(db, { uid, session }) {
  if (!session?.itemKey) return null;
  const snap = await db.collection(SESSIONS_COLLECTION).where('userId', '==', uid).where('itemKey', '==', session.itemKey).get();
  const p = previousSessionOf(snap.docs.map((d) => d.data()).filter((s) => isOwnedSession(s, uid)), session);
  if (!p) return null;
  const record = p.researchWorkId ? dataOf(await researchWorkRefOf(db, p.researchWorkId).get()) : null;
  return previousViewOf(p, isOwnedRecord(record, uid) ? record : null);
}

/**
 * Open a framed observation: the `framing` session moves to `open` and its
 * record is minted with the player's confirmed question, in one transaction. A
 * retry finds the record and writes nothing (mintWithHost's rule).
 */
export async function openFromFraming(db, { uid, sessionId, question, direction, findings, nowIso }) {
  const etDate = etDateOf(nowIso);
  const ref = sessionRefOf(db, sessionId);
  const rwId = researchWorkIdFor({ collection: SESSIONS_COLLECTION, id: sessionId });
  return db.runTransaction(async (tx) => {
    const s = dataOf(await tx.get(ref));
    if (!isOwnedSession(s, uid)) throw refuse(404, 'session_not_found');
    const existingRecord = dataOf(await tx.get(researchWorkRefOf(db, rwId)));
    const quotaSnap = await tx.get(quotaRefOf(db, uid));
    const day = playerDayOf(dataOf(quotaSnap), etDate);
    if (existingRecord) return { session: s, record: existingRecord, day, existing: false, replay: true };
    if (s.status !== 'framing') throw refuse(409, 'session_not_open');
    if (day.investigationsOpened >= PER_DAY) throw refuse(429, 'daily_limit');
    const attribution = await attributionIn(tx, db, uid, nowIso);
    const record = mintRecord({ sessionId, uid, question, findings, nowIso });
    const patch = { status: 'open', 'entry.direction': direction ?? null, researchWorkId: rwId, attribution, lastError: null, updatedAt: nowIso };
    tx.update(ref, patch);
    tx.create(researchWorkRefOf(db, rwId), record);
    const after = { ...day, investigationsOpened: day.investigationsOpened + 1 };
    tx.set(quotaRefOf(db, uid), { ...after, updatedAt: nowIso });
    return {
      session: { ...s, status: 'open', entry: { ...s.entry, direction: direction ?? null }, researchWorkId: rwId, attribution, lastError: null, updatedAt: nowIso },
      record, day: after, existing: false, replay: false,
    };
  });
}

// ── step ─────────────────────────────────────────────────────────────────────

/**
 * Admit a step and mark it running (spec §6.3 step): owner, open, budget, the
 * app's daily ceiling (503 budget_paused BEFORE any model call), not another
 * step in flight, room on the record (review A1: a full record is refused here,
 * before a paid call that could only fail). The step's model CALL counts here,
 * on the player's day and the app's (review C1/C2): a player makes at most
 * STEP_CALLS_PER_DAY a day (429 step_limit), the app at most
 * GLOBAL_STEP_CALLS_FACTOR × its step ceiling (503 budget_paused) — so failed
 * steps are bounded too; the persisted `steps` count (the spec's letter) is
 * still added by recordStep. A `direction` step appends the player's exchange
 * here, once.
 * @returns {Promise<{ replay: boolean, session, record, prior }>}  prior: the lastStep before this one
 */
export async function beginStep(db, { uid, sessionId, stepId, intent, directionExchange = null, nowIso, nowMs = Date.parse(nowIso) }) {
  const ref = sessionRefOf(db, sessionId);
  const etDate = etDateOf(nowIso);
  return db.runTransaction(async (tx) => {
    const s = dataOf(await tx.get(ref));
    if (!isOwnedSession(s, uid)) throw refuse(404, 'session_not_found');
    const record = s.researchWorkId ? dataOf(await tx.get(researchWorkRefOf(db, s.researchWorkId))) : null;
    const globalSnap = await tx.get(quotaRefOf(db, GLOBAL_QUOTA_ID));
    const quotaSnap = await tx.get(quotaRefOf(db, uid));
    const adm = stepAdmissionOf(s, { stepId, nowMs });
    if (adm.replay) return { replay: true, session: s, record, prior: s.lastStep ?? null };
    if (adm.refuse) throw refuse(409, adm.refuse);
    if (!isOwnedRecord(record, uid) || record.state !== 'open') throw refuse(409, 'session_not_open');
    if ((Array.isArray(record.findings) ? record.findings.length : 0) >= FINDINGS_MAX - 1) throw refuse(409, 'findings_full');
    const g = globalDayOf(dataOf(globalSnap), etDate);
    const ceiling = globalStepCeiling();
    if (g.steps >= ceiling || g.stepCalls >= ceiling * GLOBAL_STEP_CALLS_FACTOR) throw refuse(503, 'budget_paused');
    const day = playerDayOf(dataOf(quotaSnap), etDate);
    if (day.stepCalls >= STEP_CALLS_PER_DAY) throw refuse(429, 'step_limit');
    const exchanges = Array.isArray(s.exchanges) ? s.exchanges : [];
    const already = exchanges.some((e) => e.stepId === stepId && e.kind === 'direction');
    const patch = {
      lastStep: { stepId, intent, status: 'running', startedAt: nowIso, endedAt: null, error: null },
      updatedAt: nowIso,
      ...(directionExchange && !already ? { exchanges: [...exchanges, directionExchange] } : {}),
    };
    tx.set(quotaRefOf(db, uid), { ...day, stepCalls: day.stepCalls + 1, updatedAt: nowIso });
    tx.set(quotaRefOf(db, GLOBAL_QUOTA_ID), { ...g, stepCalls: g.stepCalls + 1, updatedAt: nowIso });
    tx.update(ref, patch);
    return { replay: false, session: { ...s, ...patch }, record, prior: s.lastStep ?? null };
  });
}

/**
 * Persist a step (spec §6.3): fresh reads, owner, open, the step still ours and
 * running, the budget re-checked; the findings appended in order, the summary
 * revised when the turn changed it (`expectedRev` = the rev the turn saw →
 * `summary_conflict` throws, the caller records a cancellation), the turn
 * folded into the telemetry; the host's partner exchange, `stepsUsed + 1`,
 * `lastStep` completed and the retrieval tally; the app's step count + 1.
 */
export async function recordStep(db, { uid, sessionId, stepId, findings, summary, expectedRev, turn, partnerExchange, retrieval, query = null, nowIso }) {
  const ref = sessionRefOf(db, sessionId);
  const etDate = etDateOf(nowIso);
  return db.runTransaction(async (tx) => {
    const s = dataOf(await tx.get(ref));
    if (!isOwnedSession(s, uid)) throw refuse(404, 'session_not_found');
    const recordRef = researchWorkRefOf(db, s.researchWorkId);
    const stored = dataOf(await tx.get(recordRef));
    const globalSnap = await tx.get(quotaRefOf(db, GLOBAL_QUOTA_ID));
    if (s.status !== 'open' || !isOwnedRecord(stored, uid) || stored.state !== 'open') throw refuse(409, 'session_not_open', { cancellation: true });
    if (s.lastStep?.stepId !== stepId || s.lastStep?.status !== 'running') throw refuse(409, 'step_in_flight', { cancellation: true });
    if ((s.stepsUsed ?? 0) >= (s.stepBudget ?? 0)) throw refuse(409, 'budget_spent', { cancellation: true });
    // The record's write is exactly the union of the model's own patches, applied in order to the record read here.
    let r = stored;
    const recordPatch = {};
    const take = (patch) => { Object.assign(recordPatch, patch); r = { ...r, ...patch }; };
    for (const f of findings) take(findingAppendPatch(r, f, { nowIso }));
    if (summary) take(summaryRevisionPatch(r, { text: summary.text, basedOn: summary.basedOn, expectedRev }, { nowIso }));
    take(turnPatch(r, { kind: 'completion', elapsedMs: turn.elapsedMs, usage: turn.usage, atIso: nowIso }));
    tx.update(recordRef, recordPatch);
    const prior = s.retrieval ?? {};
    const sessionPatch = {
      exchanges: [...(s.exchanges ?? []), partnerExchange],
      stepsUsed: (s.stepsUsed ?? 0) + 1,
      lastStep: { ...s.lastStep, status: 'completed', endedAt: nowIso, error: null, query },
      retrieval: {
        calls: (prior.calls ?? 0) + (retrieval?.calls ?? 0),
        costDollars: Math.round(((prior.costDollars ?? 0) + (retrieval?.costDollars ?? 0)) * 1e6) / 1e6,
        elapsedMs: (prior.elapsedMs ?? 0) + (retrieval?.elapsedMs ?? 0),
      },
      updatedAt: nowIso,
    };
    tx.update(ref, sessionPatch);
    const g = globalDayOf(dataOf(globalSnap), etDate);
    tx.set(quotaRefOf(db, GLOBAL_QUOTA_ID), { ...g, steps: g.steps + 1, updatedAt: nowIso });
    return { session: { ...s, ...sessionPatch }, record: { ...stored, ...recordPatch } };
  });
}

/**
 * A step that ends before persistence: `lastStep: failed` on the host, nothing
 * appended (spec §6.3). Awaited but BOUNDED (review C3: it runs at the tail of a
 * 30 s function): one attempt, at most TURN_OUTCOME_DEADLINE_MS — past it the
 * write is unconfirmed (logged; a running step older than 35 s is treated as
 * failed anyway). Never throws (BUILD_RULES §5).
 */
export async function failStep(db, { uid, sessionId, stepId, reason, nowIso, deadlineMs = TURN_OUTCOME_DEADLINE_MS }) {
  let timer = null;
  try {
    const ref = sessionRefOf(db, sessionId);
    const write = db.runTransaction(async (tx) => {
      const s = dataOf(await tx.get(ref));
      if (!isOwnedSession(s, uid) || s.lastStep?.stepId !== stepId || s.lastStep?.status !== 'running') return 'skipped';
      tx.update(ref, { lastStep: { ...s.lastStep, status: 'failed', endedAt: nowIso, error: reason }, updatedAt: nowIso });
      return 'recorded';
    }, { maxAttempts: 1 });
    const out = await Promise.race([write, new Promise((r) => { timer = setTimeout(() => r('unconfirmed'), deadlineMs); })]);
    if (out === 'unconfirmed') {
      write.catch((err) => console.error('[shared-research] late step-failure write failed:', err?.message || err));
      console.error(`[shared-research] step failure unconfirmed after ${deadlineMs} ms`);
    }
    return out !== 'unconfirmed';
  } catch (err) {
    console.error('[shared-research] step failure not noted:', err?.message || err);
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── close ────────────────────────────────────────────────────────────────────

/**
 * Close an investigation (spec §4.5, §6.3 close). `concluded` → the record
 * completed / concluded; `abandoned` → abandoned / user_close; a framing session
 * (no record) closes host-only, abandoned. Idempotent: a closed one answers its state.
 */
export async function closeInvestigation(db, { uid, sessionId, reason, closeExchange, nowIso }) {
  const ref = sessionRefOf(db, sessionId);
  return db.runTransaction(async (tx) => {
    const s = dataOf(await tx.get(ref));
    if (!isOwnedSession(s, uid)) throw refuse(404, 'session_not_found');
    const recordRef = s.researchWorkId ? researchWorkRefOf(db, s.researchWorkId) : null;
    const record = recordRef ? dataOf(await tx.get(recordRef)) : null;
    if (s.status !== 'open' && s.status !== 'framing') return { session: s, record, closed: false };
    if (s.status === 'framing') {
      if (reason !== 'abandoned') throw refuse(409, 'session_not_open');
      const patch = { status: 'abandoned', exchanges: [...(s.exchanges ?? []), closeExchange], updatedAt: nowIso };
      tx.update(ref, patch);
      return { session: { ...s, ...patch }, record: null, closed: true };
    }
    if (!isOwnedRecord(record, uid)) throw refuse(409, 'session_not_open');
    const close = reason === 'concluded'
      ? closePatch(record, { state: 'completed', terminalReason: TERMINAL_REASONS.concluded, atIso: nowIso, funnel: manualFunnel() })
      : closePatch(record, { state: 'abandoned', terminalReason: 'user_close', atIso: nowIso, funnel: manualFunnel() });
    if (!close) return { session: s, record, closed: false };
    tx.update(recordRef, close);
    const patch = { status: reason === 'concluded' ? 'completed' : 'abandoned', exchanges: [...(s.exchanges ?? []), closeExchange], updatedAt: nowIso };
    tx.update(ref, patch);
    return { session: { ...s, ...patch }, record: { ...record, ...close }, closed: true };
  });
}

// ── adopt (spec §6.6) ─────────────────────────────────────────────────────────

/**
 * The adoption's input, normalized BEFORE the builder (contract §10 item 2: the
 * fingerprint covers what was previewed). Throws the builder's own typed codes.
 */
export function normalizeAdoption({ statement, horizonEnum, symbols, activation = [], invalidation = [] }) {
  if (!ADOPTABLE_HORIZONS.includes(horizonEnum) || !HORIZON_ENUMS.includes(horizonEnum)) throw refuse(400, 'invalid_adoption', { reason: 'invalid_horizon' });
  const syms = (Array.isArray(symbols) ? symbols : []).map((s) => (typeof s === 'string' ? s.trim().toUpperCase() : '')).filter(Boolean);
  if (syms.length === 0 || new Set(syms).size !== syms.length) throw refuse(400, 'names_not_supported', { reason: 'no_selection' });
  return {
    statement: normalizeStatement(statement), horizonEnum, symbols: syms,
    activation: normalizeConditions(activation), invalidation: normalizeConditions(invalidation),
  };
}

/**
 * V1's one origin adapter (spec §6.6): the Shared Research list marker, the
 * framework's builder, the carried set as the kept findings, the confirming
 * line. A second origin (the Practice Field's) supplies its own.
 */
export const SHARED_RESEARCH_ADAPTER = Object.freeze({
  origin: 'shared_research',
  listMarker: SHARED_RESEARCH_LIST_MARKER,
  buildVersion: buildSharedResearchVersion,
  evidence: (record, carried) => carried,
  confirmText: (names, horizon) => `Saved as an idea · ${names} · ${horizon}`,
});

/** Is this record already saved as an idea — the retry's answer? */
const savedAs = (record) => (record?.state === 'completed' && record.terminalReason === TERMINAL_REASONS.savedToList && record.watchlistId
  ? { watchlistId: record.watchlistId, version: 1, researchWorkId: record.researchWorkId, idempotent: true }
  : null);

/**
 * Adopt: the SHARED MECHANICS (the pre-allocated committed list with its
 * attribution block, the v1 write, the record closed with its subject, the
 * confirming exchange, the retry-safe idempotency) plus ONE ORIGIN ADAPTER
 * the caller supplies — `{ origin, listMarker, buildVersion, evidence(record,
 * carried) → keptFindingIds, confirmText(names, horizon) }` (spec §6.6, the
 * Practice Field's item 2). A builder refusal is the player's answer (400
 * invalid_adoption), never a skipped record: `safely()` is not used here.
 *
 * @param {object} p
 * @param {object} p.input       the normalized adoption (normalizeAdoption)
 * @param {string} p.previewRev  the preview's opaque token, echoed by the client (spec §16 FQ-7)
 * @param {(record) => object} p.companiesFor   companies for a record (companiesOf with names)
 * @param {object} p.adapter
 * @param {() => string} p.mintId
 */
export async function adoptIdea(db, { uid, sessionId, input, previewRev, companiesFor, adapter, mintId, exchangeOf, nowIso }) {
  // Before the transaction: the fresh record, the preview revision, the assertion check (spec §6.6).
  const { session, record } = await readInvestigation(db, { uid, sessionId });
  const saved = savedAs(record);
  if (saved) return saved;
  if (!record || record.state !== 'open') throw refuse(409, 'session_not_open');
  const lines = latestLinesOf(session);
  const companies = companiesFor(record);
  if (!sameRev(previewRevOf(record, { companies, lines }), previewRev)) throw refuse(409, 'preview_stale', { adoptPreview: adoptPreviewOf(record, { companies, lines }) });
  const supported = companies.supported;
  const selected = input.symbols.map((s) => supported.find((c) => c.symbol === s));
  const missing = input.symbols.find((s, i) => !selected[i]);
  if (missing) throw refuse(400, 'names_not_supported', { notSupported: missing });
  const deselected = supported.filter((c) => !input.symbols.includes(c.symbol));
  const carried = carriedFor(record, { supported, lines, symbols: input.symbols });
  try {
    assertAssertionsSupported(input.statement, { record, carried, selected, deselected });
  } catch (err) {
    if (err instanceof AssertionError) throw refuse(400, err.code, { detail: err.detail });
    throw err;
  }
  const tickers = splitRetiredTickers(capTickersArray(selected.map((c) => ({
    symbol: c.symbol, reasoning: c.relationship, category: 'research', addedBy: 'user', addedAt: nowIso,
  })), nowIso)).kept;
  if (tickers.length === 0) throw refuse(400, 'no_valid_tickers');
  const listRef = db.collection(WATCHLISTS_COLLECTION).doc(); // pre-allocated: a transaction retry reuses it
  const watchlistId = listRef.id;
  const names = selected.map((c) => c.name).join(', ');
  const confirm = exchangeOf({ who: 'player', kind: 'confirm', text: adapter.confirmText(names, input.horizonEnum), at: nowIso }, { mintId });
  const sessionRef = sessionRefOf(db, sessionId);
  const recordRef = researchWorkRefOf(db, record.researchWorkId);

  return db.runTransaction(async (tx) => {
    const fresh = dataOf(await tx.get(recordRef));
    const s = dataOf(await tx.get(sessionRef));
    const listSnap = await tx.get(listRef);
    if (!isOwnedSession(s, uid) || !isOwnedRecord(fresh, uid)) throw refuse(404, 'session_not_found');
    const again = savedAs(fresh);
    if (again) return again; // a retry after the commit: nothing written
    if (fresh.state !== 'open' || s.status !== 'open') throw refuse(409, 'session_not_open');
    if (listSnap.exists) throw refuse(409, 'preview_stale');
    const freshCompanies = companiesFor(fresh);
    const freshLines = latestLinesOf(s);
    if (!sameRev(previewRevOf(fresh, { companies: freshCompanies, lines: freshLines }), previewRev)) {
      throw refuse(409, 'preview_stale', { adoptPreview: adoptPreviewOf(fresh, { companies: freshCompanies, lines: freshLines }) });
    }
    // The kept findings: the server's carried set for the selected names, never the client's.
    const keptFindingIds = adapter.evidence(fresh, carriedFor(fresh, { supported: freshCompanies.supported, lines: freshLines, symbols: input.symbols }));
    const attribution = s.attribution ?? null;
    const listDoc = {
      watchlistId, userId: uid, agentId: null, sourceSessionId: null, sourceDropId: null,
      [adapter.listMarker]: sessionId,
      thesis: '', activationConditions: [], invalidationConditions: [], tickers, name: '', notes: '',
      status: 'committed', createdAt: nowIso, updatedAt: nowIso, committedAt: nowIso,
      researchWorkId: fresh.researchWorkId, currentHypothesisVersion: 1, hypothesisVersionCount: 1,
      attribution,
    };
    const version = adapter.buildVersion({
      list: listDoc, watchlistId, record: fresh, userId: uid, sessionId,
      statement: input.statement, horizonEnum: input.horizonEnum, activation: input.activation, invalidation: input.invalidation,
      keptFindingIds, confirmExchangeId: confirm.exchangeId, nowIso,
      attribution, // the builder ignores it until the framework adds its non-hashed field (spec §5.5, §14)
    });
    const close = closePatch(fresh, {
      state: 'completed', terminalReason: TERMINAL_REASONS.savedToList, atIso: nowIso, funnel: manualFunnel(),
      subject: { watchlistId, hypothesisVersion: 1 },
    });
    tx.set(listRef, listDoc);
    tx.create(listRef.collection(VERSIONS_SUBCOLLECTION).doc(versionDocId(1)), version);
    tx.update(recordRef, close);
    tx.update(sessionRef, {
      status: 'completed', adoption: { watchlistId, version: 1, at: nowIso },
      exchanges: [...(s.exchanges ?? []), confirm], updatedAt: nowIso,
    });
    return { watchlistId, version: 1, researchWorkId: fresh.researchWorkId, idempotent: false };
  });
}
