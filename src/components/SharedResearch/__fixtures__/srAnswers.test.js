// src/components/SharedResearch/__fixtures__/srAnswers.test.js
//
// THE CLIENT FIXTURES, made by the SERVER (B2 build prompt, Tests: "built from
// B1's committed fixtures and test/fixtures/sharedResearch/step.recorded.json").
// Every answer in answers.json is composed here by B1's own pure functions —
// sessionViewOf, projectionOf, companiesOf, adoptPreviewOf, storedRowsOf,
// openingFindingsOf, validateStepTurn, replacedReplyOf, copyFor — over B1's
// fixture records and the one recorded Sonnet step. So the sheet's jsdom rows and
// the smoke route render exactly the shapes the merged server answers with, and
// a server change that moves a shape reds this row.
//
// Regenerate (after a deliberate server change): GENERATE_SR_FIXTURES=1 npx vitest run src/components/SharedResearch/__fixtures__/srAnswers.test.js

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFinding, findingAppendPatch, summaryRevisionPatch, closePatch, manualFunnel } from '../../../../api/_utils/researchRecords/model.js';
import { exchangeOf, openSessionOf, framingSessionOf, sessionViewOf, quotaViewOf, latestLinesOf, previousViewOf, playerDayOf } from '../../../../api/_utils/sharedResearch/session.js';
import { companiesOf, projectionOf } from '../../../../api/_utils/sharedResearch/companies.js';
import { adoptPreviewOf } from '../../../../api/_utils/sharedResearch/adoptPreview.js';
import { openingFindingsOf, storedRowsOf, namesInScopeOf } from '../../../../api/_utils/sharedResearch/opening.js';
import { validateStepTurn, replacedReplyOf, NO_NEXT_STEP_FACT } from '../../../../api/_utils/sharedResearch/stepSchema.js';
import { copyFor } from '../../../../api/_utils/sharedResearch/copy.js';
import { baseRecord, dataCenterRecord, shopPayRecord, SP_LINES, SP_NAMES, fid, T2 } from '../../../../api/_utils/sharedResearch/__fixtures__/records.js';
import { PROBE_ITEMS, PROBE_READ_AT } from '../../../../api/_utils/sharedResearch/__fixtures__/probe.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'answers.json');
const REC = JSON.parse(readFileSync(resolve(HERE, '../../../../test/fixtures/sharedResearch/step.recorded.json'), 'utf8'));

const UID = 'u-sr-1';
const NOW = '2026-11-12T15:00:05.000Z'; // the "now" every answer is composed at
const ATTRIBUTION = { agentId: 'agent-fixture-1', archetypeCodeId: 'diversifier', baggerbombArchetypeCodeId: 'diversifier', identityVersion: 2, at: '2026-11-10T14:00:00.000Z' };
const QUOTA = (over = {}) => quotaViewOf({ ...playerDayOf(null, '2026-11-12'), investigationsOpened: 1, framingsRun: 1, stepCalls: 1, ...over });
const ETN_NAMES = { ETN: 'Eaton Corporation plc' };

// Deterministic ids: sessions and exchanges are uuids; findings are f_ + uuid.
let n = 0;
const uuid = (prefix) => `${prefix}-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const mint = () => uuid('0e0e0e0e');
const findingId = () => `f_${uuid('0f0f0f0f')}`;
const built = (raws, nowIso) => raws.map((raw) => buildFinding(raw, { findingId: findingId(), nowIso }));
const append = (record, findings, nowIso) => findings.reduce((r, f) => ({ ...r, ...findingAppendPatch(r, f, { nowIso }) }), record);

/** A GET ?sessionId= answer, as handleGet composes it (api/forge/shared-research.js:130). */
function getAnswer({ session, record, names = {}, storedRows = [], previous = null, quota = QUOTA(), nowIso = NOW }) {
  const lines = latestLinesOf(session);
  const companies = record ? companiesOf(record, { names }) : { supported: [], leads: [] };
  return {
    session: sessionViewOf(session), record: projectionOf(record, { lines, nowIso }), companies,
    adoptPreview: record ? adoptPreviewOf(record, { companies, lines }) : null, storedRows, previous, quota,
  };
}
/** An open answer, as openAnswer composes it (:218). */
function openAnswer({ session, record, names = {}, storedRows = [], previous = null, existing = false, quota = QUOTA() }) {
  const lines = latestLinesOf(session);
  return {
    session: sessionViewOf(session), record: projectionOf(record, { lines, nowIso: NOW }), companies: companiesOf(record, { names }),
    opening: { storedRows }, quota, ...(existing ? { existing: true } : {}), previous,
  };
}
/** A step answer, as handleStep composes it (:432). */
function stepAnswer({ session, record, names = {}, findings, summary = true, summaryWithheld = false, quota = QUOTA() }) {
  const lines = latestLinesOf(session);
  return {
    session: sessionViewOf(session), record: projectionOf(record, { lines, nowIso: NOW }), companies: companiesOf(record, { names }),
    changed: { summary, findings, summaryWithheld }, quota,
  };
}
const refusal = (status, code, extra = {}, headers = null) => ({ status, body: { error: code, message: copyFor(code), ...extra }, ...(headers ? { headers } : {}) });

function build() {
  n = 0;
  const A = {};

  // ── a story, opened (spec §4.2) ─────────────────────────────────────────────
  const STORY = {
    id: 'ft-story-eaton-1', headline: 'Power gear, not chips, now paces data-center builds', reporterName: 'Doug', reporterBeat: 'Earnings Analyst',
    publishedAt: '2026-11-11T13:30:00.000Z', primaryTicker: 'ETN', tickers: ['ETN'],
  };
  const storyNames = namesInScopeOf({ entryKind: 'item', story: STORY });
  const STORED = {
    estimates: { computedAt: '2026-11-11T06:00:00.000Z', stocks: { ETN: { forwardEstimates: { currentYear: { growth: 0.081 }, nextYear: { growth: 0.112, numAnalysts: 21 } } } } },
    claims: { ETN: { count: 4, newest: '2026-11-05' } },
  };
  const OPEN_AT = '2026-11-12T14:00:00.000Z';
  const storySid = '1a1a1a1a-0000-4000-8000-000000000001';
  // The route mints the record with the entry's question (shared-research.js:254, :268); openSessionOf keeps none.
  const STORY_Q = 'What changed in this company\'s business, and does it reach its suppliers, customers or competitors?';
  const storySession = openSessionOf({
    sessionId: storySid, userId: UID, requestId: 'req-story-1',
    entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: STORY.id }, question: STORY_Q, direction: null, observation: null, topic: null, names: storyNames },
    exchanges: [], attribution: ATTRIBUTION, researchWorkId: `sr_${storySid}`, nowIso: OPEN_AT,
  });
  const storyRecord = append(baseRecord({ question: STORY_Q, sessionId: storySid, createdAt: OPEN_AT }),
    built(openingFindingsOf({ entryKind: 'item', story: STORY, names: storyNames, stored: STORED, nowIso: OPEN_AT }), OPEN_AT), OPEN_AT);
  const storyRows = storedRowsOf(storyNames, { peers: { ETN: { name: 'Eaton Corporation plc', sector: 'Industrials', updatedAt: '2026-11-11T06:00:00.000Z' } }, rankings: { ETN: { compositeScore: 71, updatedAt: '2026-11-11T06:00:00.000Z' } } });
  A.openStory = { status: 200, body: openAnswer({ session: storySession, record: storyRecord, names: ETN_NAMES, storedRows: storyRows }) };
  const previous = previousViewOf({ sessionId: '1a1a1a1a-0000-4000-8000-000000000009', updatedAt: '2026-11-09T18:00:00.000Z' }, { endedAt: '2026-11-09T18:00:00.000Z', terminalReason: 'concluded' });
  A.openStoryPrevious = { status: 200, body: openAnswer({ session: storySession, record: storyRecord, names: ETN_NAMES, storedRows: storyRows, previous }) };
  A.getStory = { status: 200, body: getAnswer({ session: storySession, record: storyRecord, names: ETN_NAMES, storedRows: storyRows }) };

  // ── own words: framed, then opened ─────────────────────────────────────────
  const obsSid = '2b2b2b2b-0000-4000-8000-000000000001';
  const OBS = 'Security reviews and integration requirements often delay approvals.';
  const obsPlayer = exchangeOf({ who: 'player', kind: 'observation', text: OBS, at: '2026-11-12T14:10:00.000Z' }, { mintId: mint });
  const FRAME = { question: 'Which companies earn when security reviews slow software approvals, and how directly?', check: 'Find a source that names the review and integration work buyers require before approval.', notEstablished: 'That any one company earns more because approvals are slow.' };
  A.framed = { status: 200, body: { sessionId: obsSid, status: 'framing', frame: FRAME, quota: QUOTA({ framingsRun: 2 }) } };
  A.frameFailed = { status: 200, body: { sessionId: obsSid, status: 'framing', error: 'frame_failed', reason: 'invalid_schema', quota: QUOTA({ framingsRun: 2 }) } };
  const obsSession = { ...framingSessionOf({ sessionId: obsSid, userId: UID, requestId: 'req-frame-1', observation: OBS, playerExchange: obsPlayer, nowIso: obsPlayer.at }), status: 'open', researchWorkId: `sr_${obsSid}`, attribution: ATTRIBUTION, frame: { ...FRAME, at: obsPlayer.at, attempts: 1 } };
  const obsRecord = append(baseRecord({ question: FRAME.question, sessionId: obsSid, createdAt: '2026-11-12T14:11:00.000Z' }),
    built(openingFindingsOf({ entryKind: 'observation', playerExchange: obsPlayer, frame: FRAME, names: [], stored: {}, nowIso: '2026-11-12T14:11:00.000Z' }), '2026-11-12T14:11:00.000Z'), '2026-11-12T14:11:00.000Z');
  A.openFramed = { status: 200, body: openAnswer({ session: obsSession, record: obsRecord }) };

  // ── a SignalDrop, opened (spec §4.1–4.2, §15 S-1) ──────────────────────────
  const dropSid = '3c3c3c3c-0000-4000-8000-000000000001';
  const DROP_ID = '3c3c3c3c-dddd-4000-8000-000000000001';
  const DROP = {
    input: { type: 'text', text: 'Utilities say gas turbines for new data centers are sold out into 2028; Eaton and GE Vernova named as suppliers.' },
    parse: { topic: 'Gas turbines for data centers', dataPoints: ['Gas turbines for new data centers are sold out into 2028'] },
    validation: { validated: [{ symbol: 'ETN', sectorId: 'industrials' }] }, droppedAt: '2026-11-12T14:20:00.000Z',
  };
  const dropNames = namesInScopeOf({ entryKind: 'signaldrop', drop: DROP });
  const dropPlayer = exchangeOf({ who: 'player', kind: 'observation', text: DROP.input.text, at: '2026-11-12T14:21:00.000Z' }, { mintId: mint });
  const DROP_Q = 'What is behind Gas turbines for data centers, and which company earns from it?';
  const dropSession = openSessionOf({
    sessionId: dropSid, userId: UID, requestId: 'req-drop-1',
    entry: { kind: 'signaldrop', itemRef: { recordKind: 'signalDrops', recordId: DROP_ID }, question: DROP_Q, direction: null, observation: null, topic: DROP.parse.topic, names: dropNames },
    exchanges: [dropPlayer], attribution: ATTRIBUTION, researchWorkId: `sr_${dropSid}`, nowIso: dropPlayer.at,
  });
  const dropRecord = append(baseRecord({ question: DROP_Q, sessionId: dropSid, createdAt: dropPlayer.at }),
    built(openingFindingsOf({ entryKind: 'signaldrop', drop: DROP, playerExchange: dropPlayer, names: dropNames, stored: STORED, nowIso: dropPlayer.at, partnerName: 'Atlas' }), dropPlayer.at), dropPlayer.at);
  A.openDrop = { status: 200, body: openAnswer({ session: dropSession, record: dropRecord, names: ETN_NAMES, storedRows: storyRows }) };
  A.openDropExisting = { status: 200, body: openAnswer({ session: dropSession, record: dropRecord, names: ETN_NAMES, storedRows: storyRows, existing: true }) };
  A.parseDrop = { dropId: DROP_ID, contentHash: 'h-fixture', parse: { ...DROP.parse, contentType: 'news_article', tickers: ['ETN'], impliedTickers: [], signalDirection: 'bullish', timeHorizon: 'positional', referencedDate: '', confidence: 'medium', extractedText: DROP.input.text }, validation: { ...DROP.validation, unsupported: [] }, shouldBailout: false, shouldHardCheckpoint: false, cached: false };

  // ── the recorded step on the data-center record (spec §4.3; the probe) ──────
  const dcSid = '0b6f3c1e-1d2a-4e5f-8a9b-1c2d3e4f5a6b'; // B1's SESSION_ID: the record's own host
  const dc1 = dataCenterRecord('step1');
  let k = 0;
  const checked = validateStepTurn(REC.output, {
    record: dc1, items: PROBE_ITEMS, readAt: PROBE_READ_AT, partnerExchangeId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
    partnerAt: NOW, nowIso: NOW, mintFindingId: () => `f_50000000-0000-4000-8000-${String(++k).padStart(12, '0')}`, names: ETN_NAMES,
  });
  if (!checked.ok) throw new Error(`the recorded step no longer validates: ${JSON.stringify(checked)}`);
  let dc2 = append(dc1, checked.findings, NOW);
  if (checked.summary) dc2 = { ...dc2, ...summaryRevisionPatch(dc2, { text: checked.summary.text, basedOn: checked.summary.basedOn, expectedRev: 0 }, { nowIso: NOW }) };
  const STEP_ID = '5e5e5e5e-0000-4000-8000-000000000001';
  const partnerOf = (text, extra = {}) => exchangeOf({ who: 'partner', kind: 'step', text, at: NOW, stepId: STEP_ID, intent: 'next', lines: checked.lines, ...extra }, { mintId: () => '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d' });
  const dcBase = openSessionOf({
    sessionId: dcSid, userId: UID, requestId: 'req-dc-1',
    entry: { kind: 'observation', itemRef: null, question: dc1.question, direction: null, observation: 'Data-center builders say power and cooling equipment, not chips, now sets the pace of new capacity.', topic: null, names: [] },
    exchanges: [exchangeOf({ who: 'player', kind: 'observation', text: 'Data-center builders say power and cooling equipment, not chips, now sets the pace of new capacity.', at: '2026-11-10T14:00:00.000Z' }, { mintId: mint })],
    attribution: ATTRIBUTION, researchWorkId: dc1.researchWorkId, nowIso: '2026-11-10T14:00:00.000Z',
  });
  const stepped = (over = {}, reply = checked.reply) => ({
    ...dcBase, stepsUsed: 1, updatedAt: NOW, exchanges: [...dcBase.exchanges, partnerOf(reply)],
    lastStep: { stepId: STEP_ID, intent: 'next', status: 'completed', startedAt: '2026-11-12T14:59:50.000Z', endedAt: NOW, error: null, query: 'q', summaryWithheld: false }, ...over,
  });
  A.stepNext = { status: 200, body: stepAnswer({ session: stepped(), record: dc2, names: ETN_NAMES, findings: checked.findings.length }) };
  A.getStepped = { status: 200, body: getAnswer({ session: stepped(), record: dc2, names: ETN_NAMES }) };
  // refresh with no new relationship: the companies the server answers are the same (Correction A)
  A.stepRefreshSame = { status: 200, body: stepAnswer({ session: stepped({ stepsUsed: 2 }), record: dc2, names: ETN_NAMES, findings: 0, summary: false }) };
  // FQ-5: the step wrote an answer with an unsourced figure — withheld, the answer kept its last revision
  A.stepWithheld = { status: 200, body: stepAnswer({ session: stepped({ lastStep: { ...stepped().lastStep, summaryWithheld: true } }), record: dc2, names: ETN_NAMES, findings: 2, summary: false, summaryWithheld: true }) };
  // FQ-15: the replaced reply, as the partner exchange stores it
  A.stepReplaced = { status: 200, body: stepAnswer({ session: stepped({}, replacedReplyOf(3)), record: dc2, names: ETN_NAMES, findings: 3, summary: false }) };
  // FQ-11: a fact the answer rests on, corrected → answerStale
  const basedOn = dc2.summary?.basedOn ?? [];
  const target = dc2.findings.find((f) => basedOn.includes(f.findingId) && f.status === 'verified');
  const dcStale = append(dc2, built([{ kind: target.kind, symbol: target.symbol, fact: `Correction: ${target.fact.slice(0, 200)}`, source: { recordKind: 'exchange', recordId: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d', label: 'Not yet checked' }, at: NOW, asOf: null, status: 'unavailable', statusReason: 'single_source', supersedes: target.findingId }], NOW), NOW);
  A.getStale = { status: 200, body: getAnswer({ session: stepped(), record: dcStale, names: ETN_NAMES }) };
  // the step budget spent; a failed last step; a step that was running when the sheet closed
  A.getSpent = { status: 200, body: getAnswer({ session: stepped({ stepsUsed: 10 }), record: dc2, names: ETN_NAMES }) };
  A.getStepFailed = { status: 200, body: getAnswer({ session: stepped({ lastStep: { stepId: '5e5e5e5e-0000-4000-8000-000000000002', intent: 'next', status: 'failed', startedAt: NOW, endedAt: NOW, error: 'invalid_unsupported_number' } }), record: dc2, names: ETN_NAMES }) };
  A.getStepFailedExamine = { status: 200, body: getAnswer({ session: stepped({ lastStep: { stepId: '5e5e5e5e-0000-4000-8000-000000000004', intent: 'examine', status: 'failed', startedAt: NOW, endedAt: NOW, error: 'invalid_unsupported_number' } }), record: dc2, names: ETN_NAMES }) };
  A.getWasRunning = { status: 200, body: getAnswer({ session: stepped({ lastStep: { stepId: '5e5e5e5e-0000-4000-8000-000000000003', intent: 'refresh', status: 'running', startedAt: NOW, endedAt: null, error: null } }), record: dc2, names: ETN_NAMES }) };
  // no next step proposed (spec §16 NS-1)
  const nextNow = dc2.findings.filter((f) => f.kind === 'next_action').at(-1);
  const dcNoNext = append(dc2, built([{ kind: 'next_action', symbol: null, fact: NO_NEXT_STEP_FACT, source: { recordKind: 'kb', recordId: 'baseline@v0', label: 'Baseline method v0' }, at: NOW, asOf: null, status: 'unverified', statusReason: 'no_next_step', supersedes: nextNow.findingId }], NOW), NOW);
  A.getNoNext = { status: 200, body: getAnswer({ session: stepped(), record: dcNoNext, names: ETN_NAMES }) };
  // concluded (spec §4.5)
  const dcDone = { ...dc2, ...closePatch(dc2, { state: 'completed', terminalReason: 'concluded', atIso: NOW, funnel: manualFunnel() }) };
  A.closeConcluded = { status: 200, body: { session: sessionViewOf({ ...stepped(), status: 'completed' }), record: projectionOf(dcDone, { lines: checked.lines, nowIso: NOW }) } };
  A.getConcluded = { status: 200, body: getAnswer({ session: { ...stepped(), status: 'completed' }, record: dcDone, names: ETN_NAMES }) };
  // an answer three ET days old (routine 8)
  A.getAged = { status: 200, body: getAnswer({ session: stepped(), record: dc2, names: ETN_NAMES, nowIso: '2026-11-16T15:00:00.000Z' }) };
  // a failed step answer (200), and the findings cap as a failed step's reason
  A.stepFailed = { status: 200, body: { error: 'step_failed', reason: 'invalid_unsupported_number', session: sessionViewOf(stepped({ lastStep: { stepId: 'x', intent: 'next', status: 'failed', startedAt: NOW, endedAt: NOW, error: 'invalid_unsupported_number' } })), quota: QUOTA() } };
  A.stepFindingsFullReason = { status: 409, body: { error: 'step_failed', reason: 'findings_full', session: sessionViewOf(stepped()), quota: QUOTA() } };

  // ── two supported companies; adoption (Correction B and C) ────────────────
  const spSid = '0b6f3c1e-1d2a-4e5f-8a9b-1c2d3e4f5a6b';
  const sp = shopPayRecord();
  const spSession = { ...dcBase, sessionId: spSid, researchWorkId: sp.researchWorkId, stepsUsed: 3, exchanges: [...dcBase.exchanges, exchangeOf({ who: 'partner', kind: 'step', text: 'Shopify owns Shop Pay; Apple Pay competes at the same checkouts.', at: T2, stepId: STEP_ID, intent: 'next', lines: SP_LINES }, { mintId: mint })], lastStep: { stepId: STEP_ID, intent: 'next', status: 'completed', startedAt: T2, endedAt: T2, error: null } };
  A.getShopPay = { status: 200, body: getAnswer({ session: spSession, record: sp, names: SP_NAMES }) };
  A.adoptSaved = { status: 200, body: { watchlistId: 'wl-fixture-1', version: 1, researchWorkId: sp.researchWorkId, idempotent: false } };
  const spMoved = append(sp, built([{ kind: 'earnings_fact', symbol: 'SHOP', fact: 'Shop Pay was used by 200 million buyers in the year.', source: { recordKind: 'retrieval', recordId: 'https://example.com/shop-pay-buyers', label: 'example.com · Shop Pay buyers', url: 'https://example.com/shop-pay-buyers' }, at: '2026-11-01T00:00:00.000Z', asOf: '2026-11-01T00:00:00.000Z', status: 'verified', statusReason: null }], NOW), NOW);
  const movedCompanies = companiesOf(spMoved, { names: SP_NAMES });
  A.adoptStale = { status: 409, body: { error: 'preview_stale', message: copyFor('preview_stale'), adoptPreview: adoptPreviewOf(spMoved, { companies: movedCompanies, lines: latestLinesOf(spSession) }) } };
  A.adoptStaleBare = { status: 409, body: { error: 'preview_stale', message: copyFor('preview_stale') } };
  // the GET after that step: the record the stale preview was computed from (the sheet re-reads it — review a4/b2)
  A.getShopPayMoved = { status: 200, body: getAnswer({ session: spSession, record: spMoved, names: SP_NAMES }) };
  const spSaved = { ...sp, ...closePatch(sp, { state: 'completed', terminalReason: 'saved_to_list', atIso: NOW, funnel: manualFunnel(), subject: { watchlistId: 'wl-fixture-1', hypothesisVersion: 1 } }) };
  A.getShopPaySaved = { status: 200, body: getAnswer({ session: { ...spSession, status: 'completed', adoption: { watchlistId: 'wl-fixture-1', version: 1, at: NOW } }, record: spSaved, names: SP_NAMES }) };
  A.list = { status: 200, body: { open: [{ sessionId: spSid, question: sp.question, state: 'open', lastTurnAt: T2, findingsCount: sp.findings.length }], quota: QUOTA() } };
  A.listEmpty = { status: 200, body: { open: [], quota: QUOTA({ investigationsOpened: 0 }) } };
  A.listDailyLimit = { status: 200, body: { open: [], quota: QUOTA({ investigationsOpened: 3 }) } };
  A.listFramingLimit = { status: 200, body: { open: [], quota: QUOTA({ framingsRun: 10 }) } };
  A.listStepLimit = { status: 200, body: { open: [], quota: QUOTA({ stepCalls: 30 }) } };

  // ── refusals, each with the server's own line (copy.js) ─────────────────────
  A.disabled = { status: 404, body: { error: 'disabled' } };
  A.rateLimited = refusal(429, 'rate_limited', {}, { 'Retry-After': '2' });
  A.ipRateLimited = { status: 429, body: { success: false, error: 'Rate limit exceeded', message: 'Too many requests. Please try again in 2 seconds.', retryAfter: 2 }, headers: { 'Retry-After': '2' } };
  for (const [code, status] of [['daily_limit', 429], ['framing_limit', 429], ['step_limit', 429], ['budget_paused', 503], ['findings_full', 409], ['attribution_unavailable', 503], ['step_in_flight', 409], ['invalid_target', 400], ['names_not_supported', 400], ['session_not_open', 409]]) A[code] = refusal(status, code);
  A.unsupported_assertion = refusal(400, 'unsupported_assertion', { detail: '71' });
  A.server_error = refusal(500, 'server_error');

  // ids the rows name
  A.ids = { stepId: STEP_ID, dcSid, spSid, storySid, obsSid, dropSid, dropId: DROP_ID, previousSid: previous.sessionId, staleFindingId: target.findingId, story: STORY, frame: FRAME, observation: OBS };
  return A;
}

describe('the client fixtures are the server\'s answers (B2 Tests)', () => {
  it('answers.json equals what B1\'s own functions compose today', () => {
    const fresh = JSON.parse(JSON.stringify(build()));
    if (process.env.GENERATE_SR_FIXTURES === '1') writeFileSync(OUT, `${JSON.stringify(fresh, null, 2)}\n`);
    expect(JSON.parse(readFileSync(OUT, 'utf8'))).toEqual(fresh);
  });
  it('the scenarios hold what the rows rely on', () => {
    const A = build();
    expect(A.getStepped.body.companies.supported.map((c) => c.symbol)).toEqual(['ETN']);
    expect(A.getStepped.body.companies.leads.map((l) => l.name)).toContain('Northfield Thermal');
    expect(A.getStepped.body.adoptPreview.previewRev).toMatch(/^pr1\.[0-9a-f]{32}$/);
    expect(A.getStale.body.record.answerStale).toBe(true);
    expect(A.getStepped.body.record.answerStale).toBe(false);
    expect(A.getShopPay.body.companies.supported.map((c) => c.symbol).sort()).toEqual(['AAPL', 'SHOP']);
    expect(A.adoptStale.body.adoptPreview.previewRev).not.toBe(A.getShopPay.body.adoptPreview.previewRev);
    expect(A.getShopPayMoved.body.adoptPreview.previewRev).toBe(A.adoptStale.body.adoptPreview.previewRev);
    expect(A.getShopPaySaved.body.record.terminalReason).toBe('saved_to_list');
    expect(A.getAged.body.record.age).toBeGreaterThan(2);
    expect(A.getStepped.body.record.findings.some((f) => f.source.label.endsWith(' · undated'))).toBe(true);
    expect(A.openDrop.body.record.findings.map((f) => f.statusReason)).toEqual(expect.arrayContaining(['player_drop', 'from_drop']));
    expect(A.openStory.body.record.findings.map((f) => f.statusReason)).toContain('reporter_content');
    // every opened record holds its question, as the route mints it (review lens b's fixture note)
    for (const k of ['openStory', 'openStoryPrevious', 'getStory', 'openDrop', 'openFramed', 'getStepped', 'getShopPay']) expect(typeof A[k].body.record.question, k).toBe('string');
    expect(A.stepReplaced.body.session.exchanges.at(-1).text).toBe('This step added 3 findings. The answer was not updated.');
    expect(fid('p3')).toBe(A.getShopPay.body.record.lines.support);
  });
});
