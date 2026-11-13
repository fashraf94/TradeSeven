// api/forge/shared-research.js
//
// Shared Research "Work an idea" — THE ROUTE (spec of record
// docs/specs/20261109_SHARED_RESEARCH_B1_B2_BUILD_SPEC_V1_2.md §6, §15). One
// file: GET reads (`?sessionId=` one investigation; `?list=open` the open ones),
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

import { randomUUID } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { getFirebaseAdmin } from '../_utils/firebaseAdmin.js';
import { logConversation } from '../_utils/shadowLogger.js';
import { isValidForgeId } from '../_utils/idValidation.js';
import { buildFinding, FINDING_ID_PREFIX, FINDINGS_MAX, isHostId, isUuid, currentFindingsOf, normalizeQuestion } from '../_utils/researchRecords/model.js';
import { recordTurnOutcome } from '../_utils/researchRecords/store.js';
import { ENTRY_ITEM_RECORD_KINDS, STEP_INTENTS, CLOSE_REASONS } from '../../src/constants/sharedResearch.js';
import { gateSharedResearchRoute, sendSharedResearchError } from '../_utils/sharedResearch/gate.js';
import {
  refuse, cleanPlayerText, exchangeOf, sessionViewOf, quotaViewOf, latestLinesOf, OBSERVATION_MAX, DIRECTION_MAX,
} from '../_utils/sharedResearch/session.js';
import {
  readRankedAgent, partnerNameOf, beginFraming, recordFrame, noteFrameFailure, readOwnedSession, readInvestigation,
  readStory, readDrop, readStoredFacts, readRankingRows, readNames, openFromItem, openFromFraming, beginStep, recordStep,
  failStep, closeInvestigation, normalizeAdoption, adoptIdea, readQuota, listOpen, readPrevious, AGENTS_COLLECTION, SHARED_RESEARCH_ADAPTER,
} from '../_utils/sharedResearch/store.js';
import { namesInScopeOf, openingFindingsOf, dropTextOf, storedRowsOf } from '../_utils/sharedResearch/opening.js';
import { companiesOf, projectionOf, resolveSymbol, splitRole } from '../_utils/sharedResearch/companies.js';
import { adoptPreviewOf, isPreviewRev } from '../_utils/sharedResearch/adoptPreview.js';
import { buildFrameSystemPrompt, renderFrameUser, buildStepSystemPrompt, renderStepUser, targetBlockOf } from '../_utils/sharedResearch/stepPrompt.js';
import { STEP_SCHEMA, FRAME_SCHEMA, validateFrame, validateStepTurn } from '../_utils/sharedResearch/stepSchema.js';
import { fitPrompt } from '../_utils/sharedResearch/promptBudget.js';
import { runTurn } from '../_utils/sharedResearch/modelTurn.js';
import { retrieve, queryOf } from '../_utils/sharedResearch/retrieval.js';
import { METHOD } from '../_utils/sharedResearch/method.js';

export const config = { maxDuration: 30 };

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
/** The shadow record for one model call (§6.9's fields, inside the record logConversation already takes). */
function modelCallRecord({ uid, session, stepId = null, intent, turn, retrieval = null, outcome, failureReason = null, notes = [] }) {
  return {
    userId: uid, agentId: session?.attribution?.agentId ?? null, battleId: null, archetype: null,
    gameMode: 'shared_research', sessionId: session?.sessionId ?? null, researchWorkId: session?.researchWorkId ?? null,
    stepId, intent, model: turn?.model ?? null, attempts: turn?.attempts ?? 0, usage: turn?.usage ?? null,
    tokenUsage: turn?.usage ?? null, costUsd: turn?.costUsd ?? null, elapsedMs: turn?.elapsedMs ?? null,
    retrieval: retrieval ?? { calls: 0, costDollars: 0, elapsedMs: 0 },
    methodId: METHOD.id, methodVersion: METHOD.version, outcome, failureReason,
    validationNotes: Array.isArray(notes) ? notes.slice(0, 40) : [], // e.g. a withheld summary (spec §16 FQ-5; §11.4 measures)
  };
}

// ── shared answer parts ──────────────────────────────────────────────────────

/** The symbols a model answer resolves (candidates, and company names written as tickers) — their names are read for the identity check. */
function candidateSymbolsOf(output) {
  const raw = [
    ...(Array.isArray(output?.findings) ? output.findings : []).flatMap((f) => [f?.symbolCandidate, f?.companyName]),
    ...(Array.isArray(output?.companies) ? output.companies : []).flatMap((c) => [c?.symbolCandidate, c?.companyName]),
  ];
  return [...new Set(raw.map((s) => resolveSymbol(s)).filter(Boolean))];
}

/** The names a record's companies need: the symbols of its current relationship and product findings. */
const companySymbolsOf = (record) => [...new Set(currentFindingsOf(record).filter((f) => (f.kind === 'relationship' || f.kind === 'product') && f.symbol).map((f) => f.symbol))];
async function companiesFor(db, record) {
  if (!record) return { supported: [], leads: [] };
  return companiesOf(record, { names: await readNames(db, companySymbolsOf(record)) });
}
async function storedRowsFor(db, session) {
  const names = Array.isArray(session?.entry?.names) ? session.entry.names : [];
  return names.length ? storedRowsOf(names, await readRankingRows(db, names)) : [];
}
const answer = async (res, status, body, pending = null, deadlineAt = null) => {
  await settle(pending, deadlineAt);
  return res.status(status).json(body);
};

// ── GET ───────────────────────────────────────────────────────────────────────

async function handleGet(req, res, { db, uid }) {
  const nowIso = new Date().toISOString();
  const day = await readQuota(db, { uid, nowIso });
  if (req.query?.list === 'open') return res.status(200).json({ open: await listOpen(db, { uid }), quota: quotaViewOf(day) });
  const sessionId = req.query?.sessionId;
  if (!isHostId(sessionId)) throw refuse(400, 'invalid_request');
  const { session, record } = await readInvestigation(db, { uid, sessionId });
  const lines = latestLinesOf(session);
  const companies = await companiesFor(db, record);
  return res.status(200).json({
    session: sessionViewOf(session),
    record: projectionOf(record, { lines, nowIso }),
    companies,
    adoptPreview: record ? adoptPreviewOf(record, { companies, lines }) : null,
    storedRows: await storedRowsFor(db, session),
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
  const begun = await beginFraming(db, { uid, requestId: body.requestId, observation, playerExchange, sessionId: randomUUID(), nowIso });
  const { session } = begun;
  const quota = quotaViewOf(begun.day);
  if (!begun.run) {
    return res.status(200).json({ sessionId: session.sessionId, status: session.status, frame: sessionViewOf(session).frame, quota });
  }
  const budgetMs = Math.min(MODEL_MS, DEADLINE_MS - (Date.now() - t0)); // the frame's model inside the same deadline (review C3)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, budgetMs));
  let turn;
  try {
    turn = await runTurn({
      kind: 'frame', system: buildFrameSystemPrompt({ partnerName: partnerNameOf(agent) }),
      user: renderFrameUser({ observation: session.entry?.observation ?? observation }), schema: FRAME_SCHEMA,
      signal: controller.signal, deadlineAt: Date.now() + budgetMs,
    });
  } finally {
    clearTimeout(timer);
  }
  const checked = turn.ok ? validateFrame(turn.output, { partnerName: partnerNameOf(agent) }) : null;
  const doneIso = new Date().toISOString();
  if (!turn.ok || !checked.ok) {
    const reason = turn.ok ? `invalid_${checked.rule}` : turn.reason;
    await noteFrameFailure(db, { uid, sessionId: session.sessionId, reason, nowIso: doneIso });
    const pending = captureLog(modelCallRecord({ uid, session, intent: 'frame', turn, outcome: 'failure', failureReason: reason }));
    return answer(res, turn.reason === 'aborted' ? 504 : 200, { sessionId: session.sessionId, status: 'framing', error: 'frame_failed', reason, quota }, pending, settleBy);
  }
  const partnerExchange = exchangeOf({ who: 'partner', kind: 'frame', text: checked.frame.question, at: doneIso });
  let stored;
  try {
    stored = await recordFrame(db, { uid, sessionId: session.sessionId, frame: checked.frame, partnerExchange, attempts: turn.attempts, nowIso: doneIso });
  } catch (err) {
    // The call was paid: its record is written even when the frame's write is not (review C4).
    await settle(captureLog(modelCallRecord({ uid, session, intent: 'frame', turn, outcome: 'failure', failureReason: 'persist_failed' })), settleBy);
    throw err;
  }
  const pending = captureLog(modelCallRecord({ uid, session, intent: 'frame', turn, outcome: 'completion' }));
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
  return res.status(200).json({
    session: sessionViewOf(opened.session),
    record: projectionOf(opened.record, { lines, nowIso }),
    companies: await companiesFor(db, opened.record),
    opening: { storedRows: await storedRowsFor(db, opened.session) },
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
    const findings = session.status === 'framing'
      ? built(openingFindingsOf({ entryKind: 'observation', playerExchange: player, frame: session.frame, names: [], stored: {}, nowIso }), nowIso)
      : [];
    const opened = await openFromFraming(db, { uid, sessionId: body.sessionId, question, direction, findings, nowIso });
    return openAnswer(res, db, uid, opened, nowIso);
  }
  // An item or a drop entry: the session is created here, with its record.
  const entry = body.entry;
  if (!isPlainObject(entry) || !['item', 'signaldrop'].includes(entry.kind) || !isPlainObject(entry.itemRef)) throw refuse(400, 'invalid_entry');
  const { recordKind, recordId } = entry.itemRef;
  if (!ENTRY_ITEM_RECORD_KINDS.includes(recordKind)) throw refuse(400, 'item_kind_unsupported');
  if ((entry.kind === 'item') !== (recordKind === 'fantasyTimesStories') || !isValidForgeId(recordId)) throw refuse(400, 'invalid_entry');
  if (!isValidForgeId(body.requestId)) throw refuse(400, 'invalid_request');
  const question = questionOf(entry.question);
  const direction = directionOf(entry.direction);
  const story = entry.kind === 'item' ? await readStory(db, recordId) : null;
  const drop = entry.kind === 'signaldrop' ? await readDrop(db, { uid, dropId: recordId }) : null;
  if (!story && !drop) throw refuse(404, 'item_not_found');
  const names = namesInScopeOf({ entryKind: entry.kind, story, drop });
  const stored = await readStoredFacts(db, names);
  const dropExchange = drop ? exchangeOf({ who: 'player', kind: 'observation', text: dropTextOf(drop), at: nowIso }) : null;
  // A drop's parsed claims run through the forbidden patterns, the partner's own name as a subject included (spec §16 FQ-6).
  const partnerName = drop ? partnerNameOf(await readRankedAgent(db, uid)) : null;
  const findings = built(openingFindingsOf({ entryKind: entry.kind, story, drop, playerExchange: dropExchange, names, stored, nowIso, partnerName }), nowIso);
  const opened = await openFromItem(db, {
    uid, requestId: body.requestId, sessionId: randomUUID(),
    entry: {
      kind: entry.kind, itemRef: { recordKind, recordId }, question, direction, observation: null,
      topic: drop && typeof drop.parse?.topic === 'string' && drop.parse.topic.trim() ? drop.parse.topic.trim().slice(0, 120) : null,
      names,
    },
    exchanges: dropExchange ? [dropExchange] : [],
    findings, nowIso,
  });
  return openAnswer(res, db, uid, opened, nowIso);
}

// ── step (spec §4.3, §6.3, §6.4) ─────────────────────────────────────────────

/** Correction B: an examine target names THIS record's supported relationship and, optionally, that symbol's open question. */
function targetOf(raw, record) {
  if (!isPlainObject(raw)) throw refuse(400, 'invalid_target');
  const symbol = resolveSymbol(raw.symbol);
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
  const t0 = Date.now();
  const settleBy = t0 + SETTLE_DEADLINE_MS;
  if (!isHostId(body.sessionId) || !isUuid(body.stepId) || !STEP_INTENTS.includes(body.intent)) throw refuse(400, 'invalid_request');
  const { sessionId, stepId, intent } = body;
  const direction = intent === 'direction' ? cleanPlayerText(body.direction, DIRECTION_MAX) : null;
  if (intent === 'direction' && !direction) throw refuse(400, 'invalid_direction');
  if (intent === 'examine' && !isPlainObject(body.target)) throw refuse(400, 'invalid_target');
  const nowIso = new Date(t0).toISOString();
  const directionExchange = direction ? exchangeOf({ who: 'player', kind: 'direction', text: direction, at: nowIso, stepId }) : null;
  const begun = await beginStep(db, { uid, sessionId, stepId, intent, directionExchange, nowIso, nowMs: t0 });
  const day = await readQuota(db, { uid, nowIso });
  if (begun.replay) {
    const lines = latestLinesOf(begun.session);
    return res.status(200).json({
      session: sessionViewOf(begun.session), record: projectionOf(begun.record, { lines, nowIso }),
      companies: await companiesFor(db, begun.record), changed: { summary: false, findings: 0 }, quota: quotaViewOf(day), replay: true,
    });
  }
  const { session, record } = begun;
  const failed = async (status, reason, { turn = null, retrievalTally = null, cancellation = false } = {}) => {
    const atIso = new Date().toISOString();
    await failStep(db, { uid, sessionId, stepId, reason, nowIso: atIso });
    if (turn) {
      await recordTurnOutcome(db, { researchWorkId: session.researchWorkId, uid, kind: cancellation ? 'cancellation' : 'failure', elapsedMs: turn.elapsedMs, usage: turn.usage, atIso, label: 'shared-research' });
    }
    // Logged whenever money was spent: a model call, or a search (review C1).
    const pending = turn || retrievalTally?.calls ? captureLog(modelCallRecord({ uid, session, stepId, intent, turn, retrieval: retrievalTally, outcome: cancellation ? 'cancellation' : 'failure', failureReason: reason })) : null;
    const after = await readOwnedSession(db, { uid, sessionId }).catch(() => session);
    return answer(res, status, { error: 'step_failed', reason, session: sessionViewOf(after), quota: quotaViewOf(day) }, pending, settleBy);
  };

  let target = null;
  try {
    if (intent === 'examine') target = targetOf(body.target, record);
  } catch (err) {
    await failStep(db, { uid, sessionId, stepId, reason: 'invalid_target', nowIso });
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
  const items = r && !r.error ? r.items : [];
  const retrievalState = !r ? 'none' : r.error ? 'failed' : 'items';

  // The prompt, sized before any call (§6.12 control 2).
  const agentSnap = session.attribution?.agentId ? await db.collection(AGENTS_COLLECTION).doc(session.attribution.agentId).get() : null;
  const partnerName = partnerNameOf(agentSnap?.exists ? agentSnap.data() : null);
  const system = buildStepSystemPrompt({ partnerName });
  const room = Math.max(0, FINDINGS_MAX - (Array.isArray(record.findings) ? record.findings.length : 0));
  const protectedIds = new Set([...(record.summary?.basedOn ?? []), ...(target ? [target.relationshipFindingId, target.openFindingId].filter(Boolean) : [])]);
  const stepsLeft = Math.max(0, (session.stepBudget ?? 0) - (session.stepsUsed ?? 0) - 1);
  const fit = fitPrompt({
    system, findings: current, items, protectedIds,
    render: (parts) => renderStepUser({
      question: record.question, entryKind: session.entry?.kind, intent, direction,
      nextAction: nextAction?.fact ?? null, target: target ? targetBlockOf({ ...target, question: record.question }) : null,
      summary: record.summary ?? null, stepsLeft, findings: parts.findings, items: parts.items, retrieval: retrievalState,
      firstStep: (session.stepsUsed ?? 0) === 0, room,
    }),
  });
  if (!fit.ok) {
    await failStep(db, { uid, sessionId, stepId, reason: 'prompt_too_large', nowIso: new Date().toISOString() });
    if (retrievalTally.calls) await settle(captureLog(modelCallRecord({ uid, session, stepId, intent, turn: null, retrieval: retrievalTally, outcome: 'failure', failureReason: 'prompt_too_large' })), settleBy);
    throw refuse(400, 'prompt_too_large'); // the typed refusal (spec §6.3); no model call was made
  }

  // One model turn.
  const elapsed = Date.now() - t0;
  const budgetMs = Math.min(r ? MODEL_AFTER_RETRIEVAL_MS : MODEL_MS, DEADLINE_MS - elapsed);
  if (budgetMs <= 0) return failed(504, 'deadline', { retrievalTally });
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
  const names = await readNames(db, candidateSymbolsOf(turn.output));
  const persistIso = new Date().toISOString();
  const partnerExchangeId = randomUUID();
  const checked = validateStepTurn(turn.output, {
    record, items: fit.items, readAt: r && !r.error ? r.readAt : null, partnerExchangeId, partnerAt: persistIso, nowIso: persistIso,
    mintFindingId: newFindingId, names, partnerName,
  });
  if (!checked.ok) return failed(200, `invalid_${checked.rule}`, { turn, retrievalTally });
  const partnerExchange = exchangeOf({
    who: 'partner', kind: 'step', text: checked.reply || (checked.findings.length ? 'This step added findings to the record.' : 'This step found nothing new.'), at: persistIso, stepId, intent,
    target: target ? { symbol: target.symbol, relationshipFindingId: target.relationshipFindingId, openFindingId: target.openFindingId } : null,
    lines: checked.lines,
  }, { mintId: () => partnerExchangeId });

  let saved;
  try {
    saved = await recordStep(db, {
      uid, sessionId, stepId, findings: checked.findings, summary: checked.summary, expectedRev: (record.summaryRevisions ?? []).length,
      turn: { elapsedMs: turn.elapsedMs, usage: turn.usage }, partnerExchange, retrieval: retrievalTally, query, nowIso: persistIso,
    });
  } catch (err) {
    const code = err?.code ?? 'persist_failed';
    const cancellation = code === 'summary_conflict' || err?.extra?.cancellation === true;
    if (cancellation || err?.researchRecord) return failed(409, code, { turn, retrievalTally, cancellation });
    return failed(500, 'persist_failed', { turn, retrievalTally });
  }
  const pending = captureLog(modelCallRecord({ uid, session, stepId, intent, turn, retrieval: retrievalTally, outcome: 'completion', notes: checked.notes }));
  const lines = latestLinesOf(saved.session);
  let companies;
  try {
    companies = await companiesFor(db, saved.record);
  } catch (err) {
    await settle(pending, settleBy); // the completed call's record is never left unsettled (review C4)
    throw err;
  }
  return answer(res, 200, {
    session: sessionViewOf(saved.session),
    record: projectionOf(saved.record, { lines, nowIso: persistIso }),
    companies,
    changed: {
      summary: Boolean(checked.summary), findings: checked.findings.length,
      // spec §16 FQ-5: the step wrote an answer that stated a number no Source-backed finding holds — the answer kept its last revision
      summaryWithheld: checked.notes.some((n) => n.startsWith('summary_withheld:')),
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
  return res.status(200).json({ session: sessionViewOf(out.session), record: projectionOf(out.record, { lines: latestLinesOf(out.session), nowIso }) });
}

// ── adopt (spec §4.6, §6.6) ──────────────────────────────────────────────────

async function handleAdopt(body, res, { db, uid }) {
  if (!isHostId(body.sessionId)) throw refuse(400, 'invalid_request');
  const rev = body.previewRev; // the preview's opaque token, echoed (spec §16 FQ-7)
  if (!isPreviewRev(rev)) throw refuse(400, 'invalid_request');
  const input = normalizeAdoption({
    statement: body.statement, horizonEnum: body.horizonEnum, symbols: body.symbols, activation: body.activation ?? [], invalidation: body.invalidation ?? [],
  });
  const nowIso = new Date().toISOString();
  // Company names for the record as it stands; a record that moves after this read fails the preview check.
  const { record } = await readInvestigation(db, { uid, sessionId: body.sessionId });
  const names = record ? await readNames(db, companySymbolsOf(record)) : {};
  const out = await adoptIdea(db, {
    uid, sessionId: body.sessionId, input, previewRev: rev,
    companiesFor: (rec) => companiesOf(rec, { names }), adapter: SHARED_RESEARCH_ADAPTER, mintId: randomUUID, exchangeOf, nowIso,
  });
  return res.status(200).json(out);
}

// ── the handler ───────────────────────────────────────────────────────────────

const ACTIONS = { frame: handleFrame, open: handleOpen, step: handleStep, close: handleClose, adopt: handleAdopt };

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
