// api/forge/shared-research.js
//
// Shared Research "Work an idea" — THE ROUTE (spec of record
// docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md §6, §15). One
// file: GET reads (`?sessionId=` one investigation; `?list=open` the open ones;
// `?list=explore` Explore's read, B6a X-1),
// POST actions `frame | open | step | close | adopt`. DARK: with
// SHARED_RESEARCH_MODE 'off' every request answers 404 disabled before auth and
// before any read (api/_utils/sharedResearch/gate.js).
//
// What a client can never supply (spec STOP list, contract §5): an origin, an
// evidence ref, a finding, a summary, a kept-findings list, a symbol key, the
// list marker or an `attribution` block. None of those names is read from a
// request body here; every one is derived on the server.
//
// One retrieval and one model turn per step at most (R5); the turn is validated
// (stepSchema.js) and persisted in one transaction (store.js recordStep). Every
// model call is shadow-logged with its usage, attempts and cost, awaited the
// api/agent/chat.js way (BUILD_RULES §5).
//
// THE METHOD (KB-1, Amendment A §A4): an investigation selects its method once
// (method.js selectMethod: `frame` for own words, `open` for a story or a
// drop), with the gate's verified uid — never a body field. Every model turn
// (the frame and each step) re-checks the session's stamp (effectiveMethodFor)
// before its prompt is built, runs on the method that answers, and records it
// on its partner exchange; the shadow log carries it on every call record.
//
// THE UNIVERSE (research universe Build 3b): a new investigation is stamped at open with the list it works on
// (sessionUniverse.js universeStampFor: the research list for a player the switch admits, else no stamp). Every
// helper that takes a universe is handed the SESSION's (universeOf), names are read through the session's name
// source (researchRows.js namesFor), and a research session's answers carry its stored rows with a research
// company's numbers. A session with no stamp is a game-list session: every answer, prompt and write as before.

import { randomUUID } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { logConversation } from '../_utils/shadowLogger.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { buildFinding, FINDING_ID_PREFIX, FINDINGS_MAX, isHostId, isUuid, currentFindingsOf, normalizeQuestion } from '../_utils/researchRecords/model.js';
import { recordTurnOutcome } from '../_utils/researchRecords/store.js';
import { ENTRY_ITEM_RECORD_KINDS, STEP_INTENTS, CLOSE_REASONS } from '../../src/constants/sharedResearch.js';
import { STORY_RECORD_KINDS, EXPLORE_RECORD_KIND } from '../../src/constants/sharedResearch.js';
import { BUILD_INTENT, BUILD_GOALS, THESIS_PARTS, PICK_PARTS, CARD_OPS } from '../../src/constants/sharedResearch.js';
import { gateSharedResearchRoute, sendSharedResearchError } from '../_utils/sharedResearch/gate.js';
import { sharedResearchBuilderMode } from '../_utils/sharedResearch/gate.js';
import {
  shapeOf, openingCardOf, builderQuestionOf, cardContextOf, thesisViewOf, isGoalOffered, offeredGoalsOf, applyProposals, blockedNow,
} from '../_utils/sharedResearch/thesis.js';
import {
  buildSchemaOf, schemaKeyOf, turnShapeOf, validateBuildTurn, buildCandidateNamesOf, builderFallbackReplyOf,
} from '../_utils/sharedResearch/thesisSchema.js';
import {
  refuse, cleanPlayerText, exchangeOf, sessionViewOf, quotaViewOf, latestLinesOf, OBSERVATION_MAX, DIRECTION_MAX,
  methodChangeOf, retainedRetrievalOf,
} from '../_utils/sharedResearch/session.js';
import {
  readRankedAgent, partnerNameOf, beginFraming, recordFrame, noteFrameFailure, readOwnedSession, readInvestigation,
  readStory, readDrop, readStoredFacts, readRankingRows, openFromItem, openFromFraming, beginStep, recordStep,
  failStep, closeInvestigation, normalizeAdoption, adoptIdea, readQuota, listOpen, readPrevious, AGENTS_COLLECTION, SHARED_RESEARCH_ADAPTER,
  openOwnWords, applyCard, adoptThesis,
} from '../_utils/sharedResearch/store.js';
import { readExploreStory, readExploreInvestigations, readExploreAgent, readEquippedList } from '../_utils/sharedResearch/store.js';
import { namesInScopeOf, openingFindingsOf, dropTextOf, dropTopicOf, storedRowsOf } from '../_utils/sharedResearch/opening.js';
import { companiesOf, projectionOf, resolveSymbol, splitRole, answerStaleOf, nameAsTickerOf } from '../_utils/sharedResearch/companies.js';
import { universeOf, universeStampFor, isResearchSession } from '../_utils/sharedResearch/sessionUniverse.js';
import { namesFor, researchRowsFor } from '../_utils/sharedResearch/researchRows.js';
import { adoptPreviewOf, isPreviewRev } from '../_utils/sharedResearch/adoptPreview.js';
import { buildFrameSystemPrompt, renderFrameUser, buildStepSystemPrompt, renderStepUser, targetBlockOf } from '../_utils/sharedResearch/stepPrompt.js';
import { buildBuildSystemPrompt, renderBuildUser } from '../_utils/sharedResearch/stepPrompt.js';
import { STEP_SCHEMA, FRAME_SCHEMA, validateFrame, validateStepTurn } from '../_utils/sharedResearch/stepSchema.js';
import { fitPrompt } from '../_utils/sharedResearch/promptBudget.js';
import { runTurn } from '../_utils/sharedResearch/modelTurn.js';
import { retrieve, queryOf } from '../_utils/sharedResearch/retrieval.js';
import { BASELINE, selectMethod, effectiveMethodFor, citedSourceOf, methodRefOf } from '../_utils/sharedResearch/method.js';

export const config = { maxDuration: 30 };

/** B6c Q-4: a session its save closed — `completed`, carrying its adoption's list (written with the record's `saved_to_list`). */
const isSavedSession = (session) => session?.status === 'completed' && typeof session.adoption?.watchlistId === 'string' && session.adoption.watchlistId.length > 0;

/** Timing inside the 30 s function (routine 10, §6.4): persistence starts by 28 s; the model waits at most 25 s, 16 s after a retrieval. */
export const DEADLINE_MS = 28_000;
export const MODEL_MS = 25_000;
export const MODEL_AFTER_RETRIEVAL_MS = 16_000;
/** The shadow log's in-request settle cap where the runtime has no keep-alive (api/agent/chat.js SHADOW_LOG_CAP_MS). */
export const SHADOW_LOG_CAP_MS = 2_000;
/** …clamped to this absolute point from the request's start (chat.js SHADOW_SETTLE_DEADLINE_MS; review C3). */
export const SETTLE_DEADLINE_MS = 29_000;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const newFindingId = () => `${FINDING_ID_PREFIX}${randomUUID()}`;

// ── the shadow log (spec §6.9; BUILD_RULES §5 — awaited, never fire-and-forget) ──

const VERCEL_REQUEST_CONTEXT = Symbol.for('@vercel/request-context');
const hasRuntimeWaitUntil = () => typeof globalThis[VERCEL_REQUEST_CONTEXT]?.get?.()?.waitUntil === 'function';
/** Start one log write: the runtime keeps it alive (null), or the caller settles the returned promise before answering. */
export function captureLog(record) {
  const write = Promise.resolve().then(() => logConversation(record)).then((persisted) => {
    if (persisted !== true) console.warn('[shared-research] shadow record NOT persisted — session:', record?.sessionId ?? null);
    return persisted === true;
  }).catch((err) => {
    console.warn('[shared-research] shadow record threw — session:', record?.sessionId ?? null, err?.message || err);
    return false;
  });
  try {
    if (hasRuntimeWaitUntil()) { waitUntil(write); return null; }
  } catch (err) {
    console.warn('[shared-research] waitUntil unusable — settling in-request:', err?.message || err);
  }
  return write;
}
/** Settle a capture the runtime did not take, under the cap and never past `deadlineAt` (after the answer is composed). */
async function settle(pending, deadlineAt = null) {
  if (!pending) return;
  const wait = Math.max(0, Math.min(SHADOW_LOG_CAP_MS, deadlineAt === null ? SHADOW_LOG_CAP_MS : deadlineAt - Date.now()));
  let timer = null;
  await Promise.race([pending, new Promise((r) => { timer = setTimeout(r, wait); })]);
  if (timer) clearTimeout(timer);
}
/**
 * The shadow record for one model call (§6.9's fields, inside the record logConversation already takes). `method`:
 * the turn's effective method (KB-1) — its id, version, hash and source, on every record, failures included.
 */
function modelCallRecord({ uid, session, stepId = null, intent, turn, retrieval = null, outcome, failureReason = null, notes = [], method = BASELINE, goal = null, part = null, schema = null }) {
  return {
    userId: uid, agentId: session?.attribution?.agentId ?? null, battleId: null, archetype: null,
    gameMode: 'shared_research', sessionId: session?.sessionId ?? null, researchWorkId: session?.researchWorkId ?? null,
    stepId, intent, model: turn?.model ?? null, attempts: turn?.attempts ?? 0, usage: turn?.usage ?? null,
    tokenUsage: turn?.usage ?? null, costUsd: turn?.costUsd ?? null, elapsedMs: turn?.elapsedMs ?? null,
    retrieval: retrieval ?? { calls: 0, costDollars: 0, elapsedMs: 0 },
    methodId: method.id, methodVersion: method.version, methodSha256: method.sha256, methodSource: method.source === 'kb' ? 'kb' : 'baseline',
    outcome, failureReason,
    validationNotes: Array.isArray(notes) ? notes.slice(0, 40) : [], // e.g. a withheld summary (spec §16 FQ-5; §11.4 measures)
    ...(goal ? { goal, part, ...(schema ? { schema } : {}) } : {}), // a thesis builder step's goal and the schema it was asked in (Amendment B §B6 measures; refuter SPL-5); never on a ledger record
  };
}

// ── shared answer parts ──────────────────────────────────────────────────────

/**
 * The symbols a model answer resolves (candidates, and company names written as tickers) — their names are read for the
 * identity check. Build 3b: in the session's universe; on a research session a name is read as a ticker only in
 * capitals, and a name the lookup finds counts too, so its company name is read before the validator runs.
 */
function candidateSymbolsOf(output, universe) {
  const pairs = [
    ...(Array.isArray(output?.findings) ? output.findings : []).map((f) => [f?.symbolCandidate, f?.companyName]),
    ...(Array.isArray(output?.companies) ? output.companies : []).map((c) => [c?.symbolCandidate, c?.companyName]),
  ];
  const byName = (n) => (typeof universe.lookupName === 'function' && typeof n === 'string' ? universe.lookupName(n) : null);
  return [...new Set(pairs.flatMap(([c, n]) => [resolveSymbol(c, universe), nameAsTickerOf(n, universe), byName(n)]).filter(Boolean))];
}

/** The names a record's companies need: the symbols of its current relationship and product findings. */
const companySymbolsOf = (record) => [...new Set(currentFindingsOf(record).filter((f) => (f.kind === 'relationship' || f.kind === 'product') && f.symbol).map((f) => f.symbol))];
async function companiesFor(db, record, session) {
  if (!record) return { supported: [], leads: [] };
  return companiesOf(record, { universe: universeOf(session), names: await namesFor(db, companySymbolsOf(record), session) });
}
/**
 * The stored rows. A game-list session: the names in scope, as PR A reads them (unchanged). A research session (Build 3b
 * section 6): the names in scope and the idea's supported companies, a research company's numbers fetched (`fetch`) or
 * read as kept (`fetch` null) — researchRows.js.
 */
async function storedRowsFor(db, session, { record = null, companies = null, fetch = null } = {}) {
  if (isResearchSession(session)) {
    const names = companies ? Object.fromEntries(companies.supported.map((c) => [c.symbol, c.name])) : {};
    return researchRowsFor(db, { session, record, companies, names, fetch });
  }
  const names = Array.isArray(session?.entry?.names) ? session.entry.names : [];
  return names.length ? storedRowsOf(names, await readRankingRows(db, names)) : [];
}
/** Build 3b section 6: a step starts a research fetch only this long after it began, and aborts it before the deadline. */
export const RESEARCH_FETCH_START_BY_MS = 18_000;
export const RESEARCH_FETCH_ABORT_AT_MS = 26_000;
/**
 * What a research row's fetch is handed: the EODHD key read now, the network, the clock. In a step (`t0` given) no fetch
 * starts past RESEARCH_FETCH_START_BY_MS, and one under way is aborted at RESEARCH_FETCH_ABORT_AT_MS, so the answer
 * still leaves inside the function's time (an aborted request is stored as Build 2's network_error: no call again today).
 */
function researchFetchOf(t0 = null) {
  const apiKey = typeof process !== 'undefined' ? process.env?.EODHD_API_KEY : undefined;
  if (t0 === null) return { apiKey, fetchImpl: (url, opts) => globalThis.fetch(url, opts), now: () => new Date(), deadlineAt: null };
  const abortAt = t0 + RESEARCH_FETCH_ABORT_AT_MS;
  return {
    apiKey, now: () => new Date(), deadlineAt: t0 + RESEARCH_FETCH_START_BY_MS,
    fetchImpl: (url, opts) => globalThis.fetch(url, { ...opts, signal: AbortSignal.timeout(Math.max(1, abortAt - Date.now())) }),
  };
}
/** A research session's step answer carries its stored rows (the client's builder shows them); a game-list session's carries none, as before. */
const researchRowsPart = async (db, session, record, companies, t0) => (isResearchSession(session)
  ? { storedRows: await storedRowsFor(db, session, { record, companies, fetch: researchFetchOf(t0) }) }
  : {});
const answer = async (res, status, body, pending = null, deadlineAt = null) => {
  await settle(pending, deadlineAt);
  return res.status(status).json(body);
};

// ── GET ───────────────────────────────────────────────────────────────────────

async function handleGet(req, res, { db, uid }) {
  const nowIso = new Date().toISOString();
  const day = await readQuota(db, { uid, nowIso });
  if (req.query?.list === 'open') return res.status(200).json({ open: await listOpen(db, { uid }), quota: quotaViewOf(day) });
  // B6a X-1: Explore's one read — the day's quota and, per Explore story investigated, its open and last-ended
  // investigation (api/_utils/sharedResearch/explore.js). No write. B6c X-9: and the player's agent (null when none;
  // nothing refused for it), read in parallel. A failing agents query fails the read, as any of its reads would (H-6).
  if (req.query?.list === 'explore') {
    const [items, agent] = await Promise.all([readExploreInvestigations(db, { uid }), readExploreAgent(db, { uid })]);
    return res.status(200).json({ quota: quotaViewOf(day), items, agent });
  }
  const sessionId = req.query?.sessionId;
  if (!isHostId(sessionId)) throw refuse(400, 'invalid_request');
  const { session, record } = await readInvestigation(db, { uid, sessionId });
  const lines = latestLinesOf(session);
  const companies = await companiesFor(db, record, session);
  if (shapeOf(session) === 'builder') {
    // Amendment B §B4.4: the card and its choices; no adoptPreview — the card is the preview.
    return res.status(200).json({
      session: sessionViewOf(session),
      record: projectionOf(record, { lines, nowIso }),
      companies,
      thesis: thesisFor(session, record, companies),
      storedRows: await storedRowsFor(db, session, { record, companies, fetch: researchFetchOf() }),
      previous: await readPrevious(db, { uid, session }),
      quota: quotaViewOf(day),
      // B6c, the founder's Q-4: on a SAVED thesis only, the list "Use it in my next game" would replace — or the saved
      // list itself, when it is already equipped — so the saved screen says which (store.js equippedListOf, with Q-3).
      // One agents query, read for this case only; every other answer is unchanged.
      ...(isSavedSession(session) ? { equippedList: await readEquippedList(db, { uid }) } : {}),
    });
  }
  return res.status(200).json({
    session: sessionViewOf(session),
    record: projectionOf(record, { lines, nowIso }),
    companies,
    adoptPreview: record ? adoptPreviewOf(record, { companies, lines }) : null,
    storedRows: await storedRowsFor(db, session, { record, companies, fetch: researchFetchOf() }),
    previous: await readPrevious(db, { uid, session }), // spec §16 FQ-1: "Open the earlier one"
    quota: quotaViewOf(day),
  });
}

// ── frame (spec §6.3) ─────────────────────────────────────────────────────────

async function handleFrame(body, res, { db, uid }) {
  const t0 = Date.now();
  const settleBy = t0 + SETTLE_DEADLINE_MS;
  const observation = cleanPlayerText(body.observation, OBSERVATION_MAX);
  if (!observation) throw refuse(400, 'invalid_observation');
  if (!isValidForgeId(body.requestId)) throw refuse(400, 'invalid_request');
  const agent = await readRankedAgent(db, uid);
  if (!agent) throw refuse(503, 'attribution_unavailable');
  const nowIso = new Date().toISOString();
  const playerExchange = exchangeOf({ who: 'player', kind: 'observation', text: observation, at: nowIso });
  // The method, selected once for this investigation (own words: the KB consumer's, for the gate's uid). A retried
  // requestId finds its session, which keeps the stamp it was created with: this selection is then not written.
  const selected = selectMethod({ entryKind: 'observation', uid, nowIso });
  const begun = await beginFraming(db, { uid, requestId: body.requestId, observation, playerExchange, sessionId: randomUUID(), nowIso, method: selected.stamp });
  const { session } = begun;
  const quota = quotaViewOf(begun.day);
  if (!begun.run) {
    return res.status(200).json({ sessionId: session.sessionId, status: session.status, frame: sessionViewOf(session).frame, quota });
  }
  // The framing is a turn too: it runs on the method the SESSION's stamp answers for now — never on the selection
  // above when the session already held a stamp (a baseline stamp is never upgraded).
  const { method } = effectiveMethodFor({ stamp: session.method, uid });
  const budgetMs = Math.min(MODEL_MS, DEADLINE_MS - (Date.now() - t0)); // the frame's model inside the same deadline (review C3)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, budgetMs));
  let turn;
  try {
    turn = await runTurn({
      kind: 'frame', system: buildFrameSystemPrompt({ partnerName: partnerNameOf(agent), method }),
      user: renderFrameUser({ observation: session.entry?.observation ?? observation, universe: universeOf(session) }), schema: FRAME_SCHEMA,
      signal: controller.signal, deadlineAt: Date.now() + budgetMs,
    });
  } finally {
    clearTimeout(timer);
  }
  // a framing runs before open, so on the game list (the universe is stamped at open: Build 3b)
  const checked = turn.ok ? validateFrame(turn.output, { partnerName: partnerNameOf(agent), universe: universeOf(session) }) : null;
  const doneIso = new Date().toISOString();
  if (!turn.ok || !checked.ok) {
    const reason = turn.ok ? `invalid_${checked.rule}` : turn.reason;
    await noteFrameFailure(db, { uid, sessionId: session.sessionId, reason, nowIso: doneIso });
    const pending = captureLog(modelCallRecord({ uid, session, intent: 'frame', turn, outcome: 'failure', failureReason: reason, method }));
    return answer(res, turn.reason === 'aborted' ? 504 : 200, { sessionId: session.sessionId, status: 'framing', error: 'frame_failed', reason, quota }, pending, settleBy);
  }
  const partnerExchange = exchangeOf({ who: 'partner', kind: 'frame', text: checked.frame.question, at: doneIso, method: methodRefOf(method) });
  let stored;
  try {
    stored = await recordFrame(db, { uid, sessionId: session.sessionId, frame: checked.frame, partnerExchange, attempts: turn.attempts, nowIso: doneIso });
  } catch (err) {
    // The call was paid: its record is written even when the frame's write is not (review C4).
    await settle(captureLog(modelCallRecord({ uid, session, intent: 'frame', turn, outcome: 'failure', failureReason: 'persist_failed', method })), settleBy);
    throw err;
  }
  const pending = captureLog(modelCallRecord({ uid, session, intent: 'frame', turn, outcome: 'completion', method }));
  return answer(res, 200, { sessionId: stored.sessionId, status: stored.status, frame: sessionViewOf(stored).frame, quota }, pending, settleBy);
}

// ── open (spec §4.2, §6.3) ───────────────────────────────────────────────────

const built = (raws, nowIso) => raws.map((raw) => buildFinding(raw, { findingId: newFindingId(), nowIso }));

function questionOf(raw) {
  const q = cleanPlayerText(raw, OBSERVATION_MAX);
  if (!q) throw refuse(400, 'invalid_question');
  return normalizeQuestion(q);
}
function directionOf(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const d = cleanPlayerText(raw, DIRECTION_MAX);
  if (!d) throw refuse(400, 'invalid_direction');
  return d;
}

async function openAnswer(res, db, uid, opened, nowIso) {
  const lines = latestLinesOf(opened.session);
  const companies = await companiesFor(db, opened.record, opened.session);
  return res.status(200).json({
    session: sessionViewOf(opened.session),
    record: projectionOf(opened.record, { lines, nowIso }),
    companies,
    ...(shapeOf(opened.session) === 'builder' ? { thesis: thesisFor(opened.session, opened.record, companies) } : {}),
    opening: { storedRows: await storedRowsFor(db, opened.session, { record: opened.record, companies, fetch: researchFetchOf() }) },
    quota: quotaViewOf(opened.day),
    ...(opened.existing ? { existing: true } : {}),
    previous: opened.previous ?? null, // spec §16 FQ-1: the newest ended investigation of this item, or null
  });
}

async function handleOpen(body, res, { db, uid }) {
  const nowIso = new Date().toISOString();
  // An observation entry: the framed session, opened with the player's confirmed question.
  if (body.entry === undefined && body.sessionId !== undefined) {
    if (!isHostId(body.sessionId)) throw refuse(400, 'invalid_request');
    const question = questionOf(body.question);
    const direction = directionOf(body.direction);
    const session = await readOwnedSession(db, { uid, sessionId: body.sessionId });
    const player = (session.exchanges ?? []).find((e) => e.who === 'player' && e.kind === 'observation');
    if (session.status === 'framing' && !player) throw refuse(409, 'session_not_open');
    // No new selection: the session keeps its stamp. The opening's next action is written from the frame, so it cites
    // the method the frame exchange ran on.
    const frameExchange = (session.exchanges ?? []).find((e) => e.who === 'partner' && e.kind === 'frame');
    // Build 3b: the universe is read once, here at open, and stamped on the session (a retry keeps the first stamp)
    const stamp = universeStampFor(uid);
    const findings = session.status === 'framing'
      ? built(openingFindingsOf({
        entryKind: 'observation', playerExchange: player, frame: session.frame, names: [], stored: {}, nowIso,
        sourceRef: citedSourceOf({ ran: frameExchange?.method ?? null, stamp: session.method, uid }), universe: universeOf({ universe: stamp }),
      }), nowIso)
      : [];
    const opened = await openFromFraming(db, { uid, sessionId: body.sessionId, question, direction, findings, nowIso, universe: stamp });
    return openAnswer(res, db, uid, opened, nowIso);
  }
  // Amendment B §B4.1 (DR-6): own words open at once as a thesis builder — only while the builder mode is on. With
  // it off this entry kind is refused below exactly as before (invalid_entry).
  if (isPlainObject(body.entry) && body.entry.kind === 'observation' && sharedResearchBuilderMode() === 'on') return openBuilderOwnWords(body, res, { db, uid }, nowIso);
  // An item or a drop entry: the session is created here, with its record.
  const entry = body.entry;
  if (!isPlainObject(entry) || !['item', 'signaldrop'].includes(entry.kind) || !isPlainObject(entry.itemRef)) throw refuse(400, 'invalid_entry');
  const { recordKind, recordId } = entry.itemRef;
  if (!ENTRY_ITEM_RECORD_KINDS.includes(recordKind)) throw refuse(400, 'item_kind_unsupported');
  // An `item` names a story — a FantasyTimes story, or an Explore story (B6a X-2); a `signaldrop` names a drop. Any entry
  // but an item naming an Explore story answers as it did before the kind existed (review A-3).
  if (recordKind === EXPLORE_RECORD_KIND && entry.kind !== 'item') throw refuse(400, 'item_kind_unsupported');
  if ((entry.kind === 'item') !== STORY_RECORD_KINDS.includes(recordKind) || !isValidForgeId(recordId)) throw refuse(400, 'invalid_entry');
  if (!isValidForgeId(body.requestId)) throw refuse(400, 'invalid_request');
  const question = questionOf(entry.question);
  const direction = directionOf(entry.direction);
  // An Explore story is read for its title, reporter, published time, tickers and version only (readExploreStory);
  // everything after this read is today's story path.
  const readItem = recordKind === EXPLORE_RECORD_KIND ? readExploreStory : readStory;
  const story = entry.kind === 'item' ? await readItem(db, recordId) : null;
  const drop = entry.kind === 'signaldrop' ? await readDrop(db, { uid, dropId: recordId }) : null;
  if (!story && !drop) throw refuse(404, 'item_not_found');
  // Build 3b: the universe, read once here at open and stamped on the new session; every helper below is handed it
  const stamp = universeStampFor(uid);
  const universe = universeOf({ universe: stamp });
  const names = namesInScopeOf({ entryKind: entry.kind, story, drop, universe });
  const stored = await readStoredFacts(db, names);
  const dropExchange = drop ? exchangeOf({ who: 'player', kind: 'observation', text: dropTextOf(drop), at: nowIso }) : null;
  // A drop's parsed claims run through the forbidden patterns, the partner's own name as a subject included (spec §16 FQ-6).
  const partnerName = drop ? partnerNameOf(await readRankedAgent(db, uid)) : null;
  // The method, selected once: a story or a drop is on the baseline by rule (R-KB-1).
  const selected = selectMethod({ entryKind: entry.kind, uid, nowIso });
  // Amendment B §B2: the builder mode, read once, stamps a NEW session; its opening has no next action (routine 4).
  const builderOn = sharedResearchBuilderMode() === 'on';
  const opening = openingFindingsOf({
    entryKind: entry.kind, story, drop, playerExchange: dropExchange, names, stored, nowIso, partnerName, sourceRef: selected.method.sourceRef, universe,
  });
  const findings = built(builderOn ? opening.filter((f) => f.kind !== 'next_action') : opening, nowIso);
  const opened = await openFromItem(db, {
    uid, requestId: body.requestId, sessionId: randomUUID(),
    entry: {
      kind: entry.kind, itemRef: { recordKind, recordId }, question, direction, observation: null,
      topic: drop ? dropTopicOf(drop, { partnerName, universe }) : null, // never a stray ticker or a forbidden pattern (refuter SH-11)
      names,
      // B6a X-2: the Explore story's version, stamped on the session (session.js openSessionOf); a FantasyTimes story has none
      ...(story && Number.isSafeInteger(story.version) ? { itemVersion: story.version } : {}),
    },
    exchanges: dropExchange ? [dropExchange] : [],
    findings, nowIso, method: selected.stamp,
    builder: builderOn ? { thesis: openingCardOf({ entryKind: entry.kind }) } : null,
    universe: stamp,
  });
  return openAnswer(res, db, uid, opened, nowIso);
}

// ── step (spec §4.3, §6.3, §6.4) ─────────────────────────────────────────────

/** Correction B: an examine target names THIS record's supported relationship and, optionally, that symbol's open question. */
function targetOf(raw, record, universe) {
  if (!isPlainObject(raw)) throw refuse(400, 'invalid_target');
  const symbol = resolveSymbol(raw.symbol, universe);
  const current = new Map(currentFindingsOf(record).map((f) => [f.findingId, f]));
  const rel = current.get(raw.relationshipFindingId);
  if (!symbol || !rel || rel.kind !== 'relationship' || rel.status !== 'verified' || rel.symbol !== symbol) throw refuse(400, 'invalid_target');
  let open = null;
  if (raw.openFindingId !== undefined && raw.openFindingId !== null) {
    open = current.get(raw.openFindingId);
    if (!open || open.status !== 'unavailable' || open.symbol !== symbol) throw refuse(400, 'invalid_target');
  }
  return { symbol, relationshipFindingId: rel.findingId, openFindingId: open ? open.findingId : null, relationshipFact: splitRole(rel.fact).rest, openFact: open ? splitRole(open.fact).rest : null };
}

async function handleStep(body, res, { db, uid }) {
  if (body.intent === BUILD_INTENT) return handleBuildStep(body, res, { db, uid }); // Amendment B §B4.2
  const t0 = Date.now();
  const settleBy = t0 + SETTLE_DEADLINE_MS;
  if (!isHostId(body.sessionId) || !isUuid(body.stepId) || !STEP_INTENTS.includes(body.intent)) throw refuse(400, 'invalid_request');
  const { sessionId, stepId, intent } = body;
  const direction = intent === 'direction' ? cleanPlayerText(body.direction, DIRECTION_MAX) : null;
  if (intent === 'direction' && !direction) throw refuse(400, 'invalid_direction');
  if (intent === 'examine' && !isPlainObject(body.target)) throw refuse(400, 'invalid_target');
  const nowIso = new Date(t0).toISOString();
  const directionExchange = direction ? exchangeOf({ who: 'player', kind: 'direction', text: direction, at: nowIso, stepId }) : null;
  const begun = await beginStep(db, {
    uid, sessionId, stepId, intent, directionExchange, nowIso, nowMs: t0,
    // a thesis builder session takes only the builder's intent (Amendment B §B2) — refused first, before a replay too
    shape: 'ledger',
  });
  const day = await readQuota(db, { uid, nowIso });
  if (begun.replay) {
    const lines = latestLinesOf(begun.session);
    return res.status(200).json({
      session: sessionViewOf(begun.session), record: projectionOf(begun.record, { lines, nowIso }),
      companies: await companiesFor(db, begun.record, begun.session), quota: quotaViewOf(day), replay: true,
      // the replayed step's own outcome: was its answer withheld (spec §16 FQ-5 — refuter SI-4)
      changed: { summary: false, findings: 0, summaryWithheld: begun.session.lastStep?.stepId === stepId && begun.session.lastStep?.summaryWithheld === true },
    });
  }
  const { session, record } = begun;
  const universe = universeOf(session); // Build 3b: the session's, stamped at open
  // The method this turn runs on (KB-1): the session's stamp, re-checked for the gate's uid; a refusal runs it on the
  // baseline. Resolved once, here, so every record of this step — failures included — names it.
  const effective = effectiveMethodFor({ stamp: session.method, uid });
  const { method } = effective;
  const failed = async (status, reason, { turn = null, retrievalTally = null, cancellation = false, refundCall = false } = {}) => {
    const atIso = new Date().toISOString();
    await failStep(db, { uid, sessionId, stepId, reason, nowIso: atIso, refundCall });
    if (turn) {
      await recordTurnOutcome(db, { researchWorkId: session.researchWorkId, uid, kind: cancellation ? 'cancellation' : 'failure', elapsedMs: turn.elapsedMs, usage: turn.usage, atIso, label: 'shared-research' });
    }
    // Logged whenever money was spent: a model call, or a search (review C1).
    const pending = turn || retrievalTally?.calls ? captureLog(modelCallRecord({ uid, session, stepId, intent, turn, retrieval: retrievalTally, outcome: cancellation ? 'cancellation' : 'failure', failureReason: reason, method })) : null;
    const after = await readOwnedSession(db, { uid, sessionId }).catch(() => session);
    return answer(res, status, { error: 'step_failed', reason, session: sessionViewOf(after), quota: quotaViewOf(day) }, pending, settleBy);
  };

  let target = null;
  try {
    if (intent === 'examine') target = targetOf(body.target, record, universe);
  } catch (err) {
    await failStep(db, { uid, sessionId, stepId, reason: 'invalid_target', nowIso, refundCall: true }); // no call was made (refuter SI-2)
    throw err;
  }

  // Retrieval (≤ 1): its focus by intent; a refresh whose search text equals the last completed step's runs without one.
  const current = currentFindingsOf(record);
  const nextAction = current.filter((f) => f.kind === 'next_action').at(-1) ?? null;
  const focus = intent === 'next' && nextAction ? nextAction.fact.split(' — ')[0]
    : intent === 'examine' ? `${target.symbol} ${target.relationshipFact}${target.openFact ? ` ${target.openFact}` : ''}`
      : null;
  const symbols = intent === 'examine' ? [target.symbol] : (session.entry?.names ?? []);
  const query = queryOf({ question: record.question, focus, direction, symbols });
  const prior = begun.prior;
  const skipRetrieval = intent === 'refresh' && prior?.status === 'completed' && prior.query === query;
  const r = skipRetrieval ? null : await retrieve({ question: record.question, focus, direction, symbols });
  const retrievalTally = { calls: r ? 1 : 0, costDollars: r && !r.error ? (r.costDollars ?? 0) : 0, elapsedMs: r?.elapsedMs ?? 0 };
  // A publishedDate later than the read is no date (spec §16 FQ-2): the prompt never shows it as the item's date either.
  const readMs = r && !r.error ? Date.parse(r.readAt) : NaN;
  const items = r && !r.error ? r.items.map((it) => (it.publishedDate && Date.parse(it.publishedDate) > readMs ? { ...it, publishedDate: null } : it)) : [];
  const retrievalState = !r ? 'none' : r.error ? 'failed' : 'items';

  // The prompt, sized before any call (§6.12 control 2).
  const agentSnap = session.attribution?.agentId ? await db.collection(AGENTS_COLLECTION).doc(session.attribution.agentId).get() : null;
  const partnerName = partnerNameOf(agentSnap?.exists ? agentSnap.data() : null);
  const system = buildStepSystemPrompt({ partnerName, method, universe });
  // One place is kept back for the validator's own "No next step proposed." marker (refuter SI-5).
  const room = Math.max(0, FINDINGS_MAX - (Array.isArray(record.findings) ? record.findings.length : 0) - 1);
  const protectedIds = new Set([...(record.summary?.basedOn ?? []), ...(target ? [target.relationshipFindingId, target.openFindingId].filter(Boolean) : [])]);
  const stepsLeft = Math.max(0, (session.stepBudget ?? 0) - (session.stepsUsed ?? 0) - 1);
  const fit = fitPrompt({
    system, findings: current, items, protectedIds,
    render: (parts) => renderStepUser({
      question: record.question, entryKind: session.entry?.kind, intent, direction,
      nextAction: nextAction?.fact ?? null, target: target ? targetBlockOf({ ...target, question: record.question, universe }) : null,
      summary: record.summary ?? null, stepsLeft, findings: parts.findings, items: parts.items, retrieval: retrievalState,
      firstStep: (session.stepsUsed ?? 0) === 0, room,
      answerStale: answerStaleOf(record), // spec §17 FQ-11: the prompt asks for a revision
      universe,
    }),
  });
  if (!fit.ok) {
    await failStep(db, { uid, sessionId, stepId, reason: 'prompt_too_large', nowIso: new Date().toISOString(), refundCall: true });
    if (retrievalTally.calls) await settle(captureLog(modelCallRecord({ uid, session, stepId, intent, turn: null, retrieval: retrievalTally, outcome: 'failure', failureReason: 'prompt_too_large', method })), settleBy);
    throw refuse(400, 'prompt_too_large'); // the typed refusal (spec §6.3); no model call was made
  }

  // One model turn.
  const elapsed = Date.now() - t0;
  const budgetMs = Math.min(r ? MODEL_AFTER_RETRIEVAL_MS : MODEL_MS, DEADLINE_MS - elapsed);
  if (budgetMs <= 0) return failed(504, 'deadline', { retrievalTally, refundCall: true }); // no model call was made
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  let turn;
  try {
    turn = await runTurn({ kind: 'step', system, user: fit.user, schema: STEP_SCHEMA, signal: controller.signal, deadlineAt: Date.now() + budgetMs });
  } finally {
    clearTimeout(timer);
  }
  if (!turn.ok) return failed(turn.reason === 'aborted' ? 504 : 200, turn.reason, { turn, retrievalTally });
  if (Date.now() - t0 > DEADLINE_MS) return failed(504, 'deadline', { turn, retrievalTally });

  // Validate (one turn: a failed validation is never re-asked).
  // The names of every company the answer resolves a symbol for: the validator checks the named company IS that
  // symbol's (review B1).
  const names = await namesFor(db, candidateSymbolsOf(turn.output, universe), session);
  const persistIso = new Date().toISOString();
  const partnerExchangeId = randomUUID();
  const checked = validateStepTurn(turn.output, {
    record, items: fit.items, readAt: r && !r.error ? r.readAt : null, partnerExchangeId, partnerAt: persistIso, nowIso: persistIso,
    mintFindingId: newFindingId, names, partnerName, method, universe,
  });
  if (!checked.ok) return failed(200, `invalid_${checked.rule}`, { turn, retrievalTally });
  const partnerExchange = exchangeOf({
    who: 'partner', kind: 'step', text: checked.reply || (checked.findings.length ? 'This step added findings to the record.' : 'This step found nothing new.'), at: persistIso, stepId, intent,
    target: target ? { symbol: target.symbol, relationshipFindingId: target.relationshipFindingId, openFindingId: target.openFindingId } : null,
    lines: checked.lines,
    // KB-1 (Amendment A §A4.3, §A4.4): the method this turn ran on; the change from the previous partner turn's, when
    // there is one; the findings it appended, in order; and — when it retrieved — every item it was shown, as shown.
    method: methodRefOf(method),
    methodChange: methodChangeOf(session.exchanges, method, effective.refusal),
    findingIds: checked.findings.map((f) => f.findingId),
    retrieval: r && !r.error ? retainedRetrievalOf({ readAt: r.readAt, items: fit.items, findings: checked.findings }) : null,
  }, { mintId: () => partnerExchangeId });

  let saved;
  try {
    saved = await recordStep(db, {
      uid, sessionId, stepId, findings: checked.findings, summary: checked.summary, expectedRev: (record.summaryRevisions ?? []).length,
      turn: { elapsedMs: turn.elapsedMs, usage: turn.usage }, partnerExchange, retrieval: retrievalTally, query, nowIso: persistIso,
      summaryWithheld: checked.notes.some((n) => n.startsWith('summary_withheld:')),
    });
  } catch (err) {
    const code = err?.code ?? 'persist_failed';
    const cancellation = code === 'summary_conflict' || err?.extra?.cancellation === true;
    if (cancellation || err?.researchRecord) return failed(409, code, { turn, retrievalTally, cancellation });
    return failed(500, 'persist_failed', { turn, retrievalTally });
  }
  const pending = captureLog(modelCallRecord({ uid, session, stepId, intent, turn, retrieval: retrievalTally, outcome: 'completion', notes: checked.notes, method }));
  const lines = latestLinesOf(saved.session);
  let companies;
  let rows;
  try {
    companies = await companiesFor(db, saved.record, saved.session);
    rows = await researchRowsPart(db, saved.session, saved.record, companies, t0);
  } catch (err) {
    await settle(pending, settleBy); // the completed call's record is never left unsettled (review C4)
    throw err;
  }
  return answer(res, 200, {
    session: sessionViewOf(saved.session),
    record: projectionOf(saved.record, { lines, nowIso: persistIso }),
    companies,
    ...rows,
    changed: {
      summary: Boolean(checked.summary), findings: checked.findings.length,
      // spec §16 FQ-5: the step wrote an answer that stated a number no Source-backed finding holds — the answer kept its last revision
      summaryWithheld: saved.session.lastStep?.summaryWithheld === true,
    },
    quota: quotaViewOf(day),
  }, pending, settleBy);
}

// ── close (spec §4.5) ────────────────────────────────────────────────────────

async function handleClose(body, res, { db, uid }) {
  if (!isHostId(body.sessionId) || !CLOSE_REASONS.includes(body.reason)) throw refuse(400, 'invalid_request');
  const nowIso = new Date().toISOString();
  const closeExchange = exchangeOf({ who: 'player', kind: 'close', text: body.reason === 'concluded' ? 'This answered my question.' : 'Closed without an idea.', at: nowIso });
  const out = await closeInvestigation(db, { uid, sessionId: body.sessionId, reason: body.reason, closeExchange, nowIso });
  const view = { session: sessionViewOf(out.session), record: projectionOf(out.record, { lines: latestLinesOf(out.session), nowIso }) };
  if (shapeOf(out.session) !== 'builder') return res.status(200).json(view);
  return res.status(200).json({ ...view, thesis: thesisFor(out.session, out.record, await companiesFor(db, out.record, out.session)) }); // §B4.4
}

// ── adopt (spec §4.6, §6.6) ──────────────────────────────────────────────────

async function handleAdopt(body, res, { db, uid }) {
  if (!isHostId(body.sessionId)) throw refuse(400, 'invalid_request');
  // Amendment B §B4.5: a builder save sends `{ sessionId, rev, statement? }` (the ledger's sends a previewRev).
  if (body.previewRev === undefined && Number.isSafeInteger(body.rev)) return handleAdoptThesis(body, res, { db, uid });
  const rev = body.previewRev; // the preview's opaque token, echoed (spec §16 FQ-7)
  if (!isPreviewRev(rev)) throw refuse(400, 'invalid_request');
  const input = normalizeAdoption({
    statement: body.statement, horizonEnum: body.horizonEnum, symbols: body.symbols, activation: body.activation ?? [], invalidation: body.invalidation ?? [],
  });
  const nowIso = new Date().toISOString();
  // Company names for the record as it stands; a record that moves after this read fails the preview check.
  const { session, record } = await readInvestigation(db, { uid, sessionId: body.sessionId });
  const names = record ? await namesFor(db, companySymbolsOf(record), session) : {};
  const universe = universeOf(session);
  const out = await adoptIdea(db, {
    uid, sessionId: body.sessionId, input, previewRev: rev,
    companiesFor: (rec) => companiesOf(rec, { names, universe }), adapter: SHARED_RESEARCH_ADAPTER, mintId: randomUUID, exchangeOf, nowIso,
  });
  return res.status(200).json(out);
}

// ── the thesis builder (Amendment B §B4; B3) ─────────────────────────────────
//
// Every builder branch keys on the SESSION's shape, never on the flag (K-2); the
// flag is read once, at `open`, to stamp a new session. A builder session takes
// only `step` with the `build` intent, `card`, `adopt` with `{ rev, statement? }`,
// `close` and the read; the other shape's intents and actions answer 400
// invalid_intent. Every builder answer carries `thesis` (§B4.4).

/** The card as the answers carry it, for a builder session; null for a ledger. */
function thesisFor(session, record, companies) {
  if (shapeOf(session) !== 'builder' || !session.thesis) return null;
  return thesisViewOf(session.thesis, cardContextOf({ record, supported: companies?.supported ?? [], session }));
}
/** The card's context inside a transaction, from the record alone (support needs no company names); in the session's universe. */
const cardCtxIn = (session, record, universe) => cardContextOf({ record, supported: companiesOf(record, { universe }).supported, session });

/** Own words, opened at once as a thesis builder (§B4.1, DR-6): no framing turn, no framing count. */
async function openBuilderOwnWords(body, res, { db, uid }, nowIso) {
  const observation = cleanPlayerText(body.entry.observation, OBSERVATION_MAX);
  if (!observation) throw refuse(400, 'invalid_observation');
  if (!isValidForgeId(body.requestId)) throw refuse(400, 'invalid_request');
  const question = normalizeQuestion(builderQuestionOf(observation));
  const playerExchange = exchangeOf({ who: 'player', kind: 'observation', text: observation, at: nowIso });
  // The method, selected here for own words (Amendment A's selectMethod, as `frame` does for a ledger).
  const selected = selectMethod({ entryKind: 'observation', uid, nowIso });
  // Build 3b: the universe, read once here at open and stamped on the new session
  const stamp = universeStampFor(uid);
  // The opening as today, without its next action: a builder step writes none (routine choice 4).
  const findings = built(openingFindingsOf({
    entryKind: 'observation', playerExchange, frame: null, names: [], stored: {}, nowIso, sourceRef: selected.method.sourceRef,
    universe: universeOf({ universe: stamp }),
  }).filter((f) => f.kind !== 'next_action'), nowIso);
  const opened = await openOwnWords(db, {
    uid, requestId: body.requestId, sessionId: randomUUID(),
    entry: { kind: 'observation', itemRef: null, question, direction: null, observation, topic: null, names: [] },
    exchanges: [playerExchange], findings, nowIso, method: selected.stamp,
    thesis: openingCardOf({ entryKind: 'observation', observation }),
    universe: stamp,
  });
  return openAnswer(res, db, uid, opened, nowIso);
}

/** The search text a builder step's retrieval runs on, by goal (routine: the card's own words, the names in play). */
function buildFocusOf({ goal, part, card, record }) {
  const opening = currentFindingsOf(record).find((f) => f.kind === 'coverage' || f.kind === 'observation');
  // §B13 T-1: own words no longer become the theme, so until one is suggested or set the search names the player's own
  // words — the record's observation finding (a SignalDrop's opening is one too). For own words of 80 characters or
  // fewer that is the text the first map searched on before T-1; longer words searched on the record's question then.
  const theme = card.theme.value ?? card.theme.suggestion ?? (opening?.kind === 'observation' ? opening.fact : null);
  const seg = card.segment.state === 'set' && !card.segment.skipped ? card.segment.value : null;
  const names = card.names.state === 'set' ? card.names.value.join(' ') : '';
  // §B13 T-2: find_names and build_why can now run with neither a segment nor a theme (a story whose check left no
  // suggestion, the segment skipped): no subject means no focus, so the search falls back to the record's question
  const subject = seg ?? theme ?? null;
  switch (goal) {
    case 'verify_source': return opening ? `primary source of: ${opening.fact}` : null;
    case 'map_segments': return theme ? `${theme}: the parts of this market and the listed companies in each` : null;
    case 'find_names': return subject ? `listed companies that earn from ${subject}` : null;
    case 'build_why': return subject ? `${names} revenue exposure to ${subject}`.trim() : (names ? `${names} revenue exposure` : null);
    case 'strengthen': {
      const v = part === 'names' ? names : part === 'why' ? `${names} ${card.why.shared ?? ''}` : part === 'wrongIf' ? `${names} ${card.wrongIf.text ?? ''}` : (card[part]?.value ?? '');
      return `${String(v).trim()} ${theme ?? ''}`.trim() || null;
    }
    default: return null;
  }
}

/** The finding ids the card rests on: never trimmed out of the prompt. */
const cardFindingIdsOf = (card) => [
  ...card.segment.findingIds, ...card.why.reasons.flatMap((r) => r.findingIds), ...(card.why.against?.findingIds ?? []), ...card.wrongIf.findingIds,
  ...(card.why.proposal?.reasons ?? []).flatMap((r) => r.findingIds),
];

async function handleBuildStep(body, res, { db, uid }) {
  const t0 = Date.now();
  const settleBy = t0 + SETTLE_DEADLINE_MS;
  if (!isHostId(body.sessionId) || !isUuid(body.stepId) || !BUILD_GOALS.includes(body.goal)) throw refuse(400, 'invalid_request');
  const { sessionId, stepId, goal } = body;
  const part = goal === 'strengthen' || goal === 'pick' ? body.part : null;
  if ((goal === 'strengthen' && !THESIS_PARTS.includes(part)) || (goal === 'pick' && !PICK_PARTS.includes(part))) throw refuse(400, 'invalid_request');
  const direction = goal === 'direction' ? cleanPlayerText(body.direction, DIRECTION_MAX) : null;
  if (goal === 'direction' && !direction) throw refuse(400, 'invalid_direction');
  const intent = BUILD_INTENT;
  const nowIso = new Date(t0).toISOString();
  const directionExchange = direction ? exchangeOf({ who: 'player', kind: 'direction', text: direction, at: nowIso, stepId, intent }) : null;
  // The server decides what is on offer (§B4.2): a goal the card does not offer — or a ledger session — is refused
  // inside the admission transaction, before the step's call is counted. The turn's shape — the schema it is asked in
  // (S-1; `direction` takes the next research goal on offer) — is read there too, from the same card and the same offer.
  let turnShape = turnShapeOf({ goal, part });
  const begun = await beginStep(db, {
    uid, sessionId, stepId, intent, directionExchange, nowIso, nowMs: t0,
    shape: 'builder', // a ledger session is refused first, before a replay too (review RA-2/RD-1)
    admit: (s, rec) => {
      if (!s.thesis) throw refuse(400, 'invalid_intent', { reason: 'shape' });
      const ctx = cardCtxIn(s, rec, universeOf(s));
      if (!isGoalOffered(s.thesis, ctx, { goal, part })) throw refuse(400, 'invalid_intent', { reason: 'goal_not_offered' });
      turnShape = turnShapeOf({ goal, part }, offeredGoalsOf(s.thesis, ctx), { deadEnd: blockedNow(s.thesis, ctx) }); // §B12 Q-2 (b)
    },
  });
  const day = await readQuota(db, { uid, nowIso });
  if (begun.replay) {
    const companies = await companiesFor(db, begun.record, begun.session);
    return res.status(200).json({
      session: sessionViewOf(begun.session), record: projectionOf(begun.record, { lines: latestLinesOf(begun.session), nowIso }),
      companies, thesis: thesisFor(begun.session, begun.record, companies), quota: quotaViewOf(day), replay: true,
      changed: { findings: 0, card: false },
    });
  }
  const { session, record } = begun;
  const universe = universeOf(session); // Build 3b: the session's, stamped at open
  const card = session.thesis;
  const effective = effectiveMethodFor({ stamp: session.method, uid });
  const { method } = effective;
  const failed = async (status, reason, { turn = null, retrievalTally = null, cancellation = false, refundCall = false } = {}) => {
    const atIso = new Date().toISOString();
    await failStep(db, { uid, sessionId, stepId, reason, nowIso: atIso, refundCall });
    if (turn) {
      await recordTurnOutcome(db, { researchWorkId: session.researchWorkId, uid, kind: cancellation ? 'cancellation' : 'failure', elapsedMs: turn.elapsedMs, usage: turn.usage, atIso, label: 'shared-research' });
    }
    const pending = turn || retrievalTally?.calls ? captureLog(modelCallRecord({ uid, session, stepId, intent, turn, retrieval: retrievalTally, outcome: cancellation ? 'cancellation' : 'failure', failureReason: reason, method, goal, part, schema: schemaKeyOf(turnShape) })) : null;
    const after = await readInvestigation(db, { uid, sessionId }).catch(() => ({ session, record }));
    const companies = await companiesFor(db, after.record, after.session).catch(() => ({ supported: [], leads: [] }));
    return answer(res, status, { error: 'step_failed', reason, session: sessionViewOf(after.session), thesis: thesisFor(after.session, after.record, companies), quota: quotaViewOf(day) }, pending, settleBy);
  };

  // Retrieval (≤ 1): none for a pick (DR-2: one model turn on what the record already holds).
  const symbols = card.names.state === 'set' ? card.names.value : (session.entry?.names ?? []);
  const focus = buildFocusOf({ goal, part, card, record });
  const r = goal === 'pick' ? null : await retrieve({ question: record.question, focus, direction, symbols });
  const query = r ? queryOf({ question: record.question, focus, direction, symbols }) : null;
  const retrievalTally = { calls: r ? 1 : 0, costDollars: r && !r.error ? (r.costDollars ?? 0) : 0, elapsedMs: r?.elapsedMs ?? 0 };
  const readMs = r && !r.error ? Date.parse(r.readAt) : NaN;
  const items = r && !r.error ? r.items.map((it) => (it.publishedDate && Date.parse(it.publishedDate) > readMs ? { ...it, publishedDate: null } : it)) : [];
  const retrievalState = !r ? 'none' : r.error ? 'failed' : 'items';

  // The prompt, sized before any call (§6.12 control 2).
  const agentSnap = session.attribution?.agentId ? await db.collection(AGENTS_COLLECTION).doc(session.attribution.agentId).get() : null;
  const partnerName = partnerNameOf(agentSnap?.exists ? agentSnap.data() : null);
  const system = buildBuildSystemPrompt({ partnerName, method, universe });
  const current = currentFindingsOf(record);
  const companiesBefore = await companiesFor(db, record, session);
  const room = Math.max(0, FINDINGS_MAX - (Array.isArray(record.findings) ? record.findings.length : 0) - 1);
  const stepsLeft = Math.max(0, (session.stepBudget ?? 0) - (session.stepsUsed ?? 0) - 1);
  const fit = fitPrompt({
    system, findings: current, items, protectedIds: new Set(cardFindingIdsOf(card)),
    render: (parts) => renderBuildUser({
      question: record.question, entryKind: session.entry?.kind, goal, part, shape: turnShape, direction, card, supported: companiesBefore.supported,
      stepsLeft, findings: parts.findings, items: parts.items, retrieval: retrievalState, room, universe,
    }),
  });
  if (!fit.ok) {
    await failStep(db, { uid, sessionId, stepId, reason: 'prompt_too_large', nowIso: new Date().toISOString(), refundCall: true });
    if (retrievalTally.calls) await settle(captureLog(modelCallRecord({ uid, session, stepId, intent, turn: null, retrieval: retrievalTally, outcome: 'failure', failureReason: 'prompt_too_large', method, goal, part, schema: schemaKeyOf(turnShape) })), settleBy);
    throw refuse(400, 'prompt_too_large');
  }

  // One model turn.
  const elapsed = Date.now() - t0;
  const budgetMs = Math.min(r ? MODEL_AFTER_RETRIEVAL_MS : MODEL_MS, DEADLINE_MS - elapsed);
  if (budgetMs <= 0) return failed(504, 'deadline', { retrievalTally, refundCall: true });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  let turn;
  try {
    turn = await runTurn({ kind: 'step', system, user: fit.user, schema: buildSchemaOf(turnShape), signal: controller.signal, deadlineAt: Date.now() + budgetMs });
  } finally {
    clearTimeout(timer);
  }
  if (!turn.ok) return failed(turn.reason === 'aborted' ? 504 : 200, turn.reason, { turn, retrievalTally });
  if (Date.now() - t0 > DEADLINE_MS) return failed(504, 'deadline', { turn, retrievalTally });

  // Validate (one turn: a failed validation is never re-asked). B1's rules alone fail the step; a proposal that
  // breaks a builder rule is dropped (K-4).
  const nameSymbols = [...new Set([
    ...candidateSymbolsOf(turn.output, universe), ...buildCandidateNamesOf(turn.output).map((s) => nameAsTickerOf(s, universe)).filter(Boolean),
    ...(typeof universe.lookupName === 'function' ? buildCandidateNamesOf(turn.output).map((s) => (typeof s === 'string' ? universe.lookupName(s) : null)).filter(Boolean) : []),
    ...card.names.value,
  ])];
  const names = await namesFor(db, nameSymbols, session);
  const persistIso = new Date().toISOString();
  const partnerExchangeId = randomUUID();
  let checked;
  try {
    checked = validateBuildTurn(turn.output, {
      record, items: fit.items, readAt: r && !r.error ? r.readAt : null, partnerExchangeId, partnerAt: persistIso, nowIso: persistIso,
      mintFindingId: newFindingId, names, partnerName, method, card, goal, part, shape: turnShape, universe,
    });
  } catch (err) {
    // a paid call is never left unrecorded (review RC-1): the step fails, logged, its call counted, the session released
    console.error('[shared-research] build validation threw:', err?.message || err);
    return failed(200, 'invalid_unparseable', { turn, retrievalTally });
  }
  if (!checked.ok) return failed(200, `invalid_${checked.rule}`, { turn, retrievalTally });
  const partnerExchange = exchangeOf({
    who: 'partner', kind: 'step', text: checked.reply || builderFallbackReplyOf(checked.findings.length, { cardChanged: checked.cardChanged }), at: persistIso, stepId, intent, goal, part,
    method: methodRefOf(method),
    methodChange: methodChangeOf(session.exchanges, method, effective.refusal),
    findingIds: checked.findings.map((f) => f.findingId),
    retrieval: r && !r.error ? retainedRetrievalOf({ readAt: r.readAt, items: fit.items, findings: checked.findings }) : null,
  }, { mintId: () => partnerExchangeId });

  let saved;
  try {
    saved = await recordStep(db, {
      uid, sessionId, stepId, findings: checked.findings, summary: null, expectedRev: (record.summaryRevisions ?? []).length,
      turn: { elapsedMs: turn.elapsedMs, usage: turn.usage }, partnerExchange, retrieval: retrievalTally, query, nowIso: persistIso,
      // The proposals land on the card read in recordStep's own transaction (NO step sets a part — V2-4).
      cardUpdate: (fresh, recordAfter) => applyProposals(fresh, checked.proposals, cardCtxIn(null, recordAfter, universe)),
    });
  } catch (err) {
    const code = err?.code ?? 'persist_failed';
    const cancellation = code === 'summary_conflict' || err?.extra?.cancellation === true;
    if (cancellation || err?.researchRecord) return failed(409, code, { turn, retrievalTally, cancellation });
    return failed(500, 'persist_failed', { turn, retrievalTally });
  }
  const pending = captureLog(modelCallRecord({ uid, session, stepId, intent, turn, retrieval: retrievalTally, outcome: 'completion', notes: checked.notes, method, goal, part, schema: schemaKeyOf(turnShape) }));
  let companies;
  let rows;
  try {
    companies = await companiesFor(db, saved.record, saved.session);
    rows = await researchRowsPart(db, saved.session, saved.record, companies, t0);
  } catch (err) {
    await settle(pending, settleBy); // the completed call's record is never left unsettled (review C4)
    throw err;
  }
  return answer(res, 200, {
    session: sessionViewOf(saved.session),
    record: projectionOf(saved.record, { lines: latestLinesOf(saved.session), nowIso: persistIso }),
    companies,
    thesis: thesisFor(saved.session, saved.record, companies),
    ...rows,
    changed: { findings: checked.findings.length, card: checked.cardChanged }, // what landed, not what was proposed (RA-5)
    quota: quotaViewOf(day),
  }, pending, settleBy);
}

// ── card (§B4.3): the free action — no model call, no step, idempotent on opId ──

async function handleCard(body, res, { db, uid }) {
  if (!isHostId(body.sessionId) || !isUuid(body.opId) || !Number.isSafeInteger(body.rev) || !CARD_OPS.includes(body.op) || !THESIS_PARTS.includes(body.part)) {
    throw refuse(400, 'invalid_request');
  }
  const nowIso = new Date().toISOString();
  // the record's company names, read first: a confirm checks the shared reason against the deselected companies by name
  const { session: beforeSession, record: before } = await readInvestigation(db, { uid, sessionId: body.sessionId });
  const names = before ? await namesFor(db, companySymbolsOf(before), beforeSession) : {};
  const out = await applyCard(db, {
    uid, sessionId: body.sessionId, opId: body.opId, rev: body.rev, op: body.op, part: body.part, value: body.value,
    exchangeId: randomUUID(), exchangeOf, nowIso, names,
  });
  const companies = await companiesFor(db, out.record, out.session);
  const thesis = thesisFor(out.session, out.record, companies);
  if (out.stale) throw refuse(409, 'card_stale', { thesis });
  return res.status(200).json({ session: sessionViewOf(out.session), thesis, applied: out.applied });
}

// ── adopt, the builder's (§B4.5) ─────────────────────────────────────────────

async function handleAdoptThesis(body, res, { db, uid }) {
  const statement = body.statement === undefined || body.statement === null ? null : body.statement;
  if (statement !== null && typeof statement !== 'string') throw refuse(400, 'invalid_request');
  const nowIso = new Date().toISOString();
  const { session, record } = await readInvestigation(db, { uid, sessionId: body.sessionId });
  const names = record ? await namesFor(db, companySymbolsOf(record), session) : {};
  const universe = universeOf(session);
  const companiesForRecord = (rec) => companiesOf(rec, { names, universe });
  const viewNow = async () => {
    const after = await readInvestigation(db, { uid, sessionId: body.sessionId });
    return thesisFor(after.session, after.record, after.record ? companiesForRecord(after.record) : null);
  };
  let out;
  try {
    out = await adoptThesis(db, {
      uid, sessionId: body.sessionId, rev: body.rev, statement, companiesFor: companiesForRecord, adapter: SHARED_RESEARCH_ADAPTER,
      mintId: randomUUID, exchangeOf, nowIso,
    });
  } catch (err) {
    if (err?.sharedResearch && err.code === 'card_stale') throw refuse(409, 'card_stale', { thesis: await viewNow() });
    throw err;
  }
  return res.status(200).json({ ...out, thesis: await viewNow() });
}

// ── the handler ───────────────────────────────────────────────────────────────

const ACTIONS = { frame: handleFrame, open: handleOpen, step: handleStep, close: handleClose, adopt: handleAdopt, card: handleCard };

export default async function handler(req, res) {
  const gated = await gateSharedResearchRoute(req, res, { methods: ['GET', 'POST'] });
  if (!gated) return undefined;
  const ctx = { db: getFirebaseAdmin(), uid: gated.user.uid };
  const action = req.method === 'GET' ? 'read' : req.body?.action;
  try {
    if (req.method === 'GET') return await handleGet(req, res, ctx);
    const body = isPlainObject(req.body) ? req.body : {};
    const run = Object.hasOwn(ACTIONS, body.action) ? ACTIONS[body.action] : null;
    if (!run) throw refuse(400, 'invalid_request');
    return await run(body, res, ctx);
  } catch (err) {
    return sendSharedResearchError(res, err, typeof action === 'string' ? action : 'request');
  }
}
