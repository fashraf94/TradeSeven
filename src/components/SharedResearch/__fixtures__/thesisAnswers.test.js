// src/components/SharedResearch/__fixtures__/thesisAnswers.test.js
//
// THE THESIS BUILDER'S CLIENT FIXTURES, made by the SERVER (B4 build prompt, Tests:
// "Fixtures made by the server"). Every builder answer in thesisAnswers.json is
// composed here by B3's own pure functions — openingCardOf, validateBuildTurn,
// applyProposals, cardOpOf, thesisViewOf, cardContextOf, offeredGoalsOf,
// turnShapeOf — and B1's (sessionViewOf, projectionOf, companiesOf, exchangeOf,
// openingFindingsOf, copyFor), in the order the route runs them
// (api/forge/shared-research.js handleOpen, handleBuildStep, handleCard,
// handleAdoptThesis, handleGet). No thesis object is typed by hand: a server change
// that moves a shape reds this row.
//
// The model turns are the recorded probes (test/fixtures/sharedResearch/build.*.recorded.json)
// where one fits the card, and AUTHORED outputs (below, each passed through
// validateBuildTurn, which must answer ok) where none does: the walk's names step,
// the group, the incomplete why and the dead end. Authored texts are fixture text,
// not market facts.
//
// Regenerate (after a deliberate server change): GENERATE_SR_THESIS_FIXTURES=1 npx vitest run src/components/SharedResearch/__fixtures__/thesisAnswers.test.js

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFinding, findingAppendPatch, closePatch, manualFunnel } from '../../../../api/_utils/researchRecords/model.js';
import { exchangeOf, openSessionOf, sessionViewOf, quotaViewOf, latestLinesOf, playerDayOf } from '../../../../api/_utils/sharedResearch/session.js';
import { companiesOf, projectionOf } from '../../../../api/_utils/sharedResearch/companies.js';
import { openingFindingsOf, namesInScopeOf } from '../../../../api/_utils/sharedResearch/opening.js';
import { copyFor } from '../../../../api/_utils/sharedResearch/copy.js';
import { BASELINE } from '../../../../api/_utils/sharedResearch/method.js';
import {
  openingCardOf, builderQuestionOf, cardContextOf, offeredGoalsOf, blockedNow, applyProposals, cardOpOf, thesisViewOf,
} from '../../../../api/_utils/sharedResearch/thesis.js';
import { validateBuildTurn, turnShapeOf, builderFallbackReplyOf } from '../../../../api/_utils/sharedResearch/thesisSchema.js';
import { baseRecord } from '../../../../api/_utils/sharedResearch/__fixtures__/records.js';
import { frontPartOf, valueChoicesOf, textChoiceOf, horizonLabelOf, joinNames } from '../thesisView.js';
import { walkRouteOf } from './walkRoute.js';
import { builderProbes, b5Probes, PROBE_B_READ_AT } from '../../../../api/_utils/sharedResearch/__fixtures__/probeBuilder.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'thesisAnswers.json');
const WALK_OUT = resolve(HERE, 'thesisWalk.json');
const RECORDED = (key) => JSON.parse(readFileSync(resolve(HERE, `../../../../test/fixtures/sharedResearch/build.${key}.recorded.json`), 'utf8')).output;
const PROBES = builderProbes();
const probeOf = (key) => PROBES.find((p) => p.key === key);
/** §B13 T-7: the walk's map is the B5 recorded map_segments answer, made on the T-1 card (a real theme suggestion). */
const B5_MAP = b5Probes()[0];
const WALK_MAP = () => RECORDED('b5.map_segments');

const UID = 'u-sr-1';
const ATTRIBUTION = { agentId: 'agent-fixture-1', archetypeCodeId: 'diversifier', baggerbombArchetypeCodeId: 'diversifier', identityVersion: 2, at: '2026-11-10T14:00:00.000Z' };
const QUOTA = (over = {}) => quotaViewOf({ ...playerDayOf(null, '2026-11-17'), investigationsOpened: 1, stepCalls: 1, ...over });
const NAMES = Object.freeze({ NVDA: 'NVIDIA Corporation', AMD: 'Advanced Micro Devices, Inc.', AVGO: 'Broadcom Inc.' });
const refusal = (status, code, extra = {}) => ({ status, body: { error: code, message: copyFor(code), ...extra } });

// ── a tiny, faithful replay of the route's builder writes ─────────────────────────

let n = 0;
const uuid = (prefix) => `${prefix}-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const mint = () => uuid('0e0e0e0e');
const at = (minute) => `2026-11-17T14:${String(minute).padStart(2, '0')}:00.000Z`;
const append = (record, findings, nowIso) => findings.reduce((r, f) => ({ ...r, ...findingAppendPatch(r, f, { nowIso }) }), record);
const built = (raws, nowIso) => raws.map((raw) => buildFinding(raw, { findingId: `f_${uuid('0f0f0f0f')}`, nowIso }));

/** One investigation as the server holds it: the session document, its record, the company names it reads. */
function investigation({ sessionId, entry, exchanges, findings, question, nowIso, card }) {
  const session = {
    ...openSessionOf({ sessionId, userId: UID, requestId: `req-${sessionId.slice(0, 8)}`, entry: { ...entry, question }, exchanges, attribution: ATTRIBUTION, researchWorkId: `sr_${sessionId}`, nowIso }),
    shape: 'builder', thesis: card,
  };
  const record = append(baseRecord({ question, sessionId, uid: UID, createdAt: nowIso }), findings, nowIso);
  return { session, record };
}

/** The `thesis` the answers carry (shared-research.js thesisFor). */
const thesisOf = ({ session, record }) => thesisViewOf(session.thesis, cardContextOf({ record, supported: companiesOf(record, { names: NAMES }).supported, session }));
/** An open answer (openAnswer). */
const openAnswerOf = (inv, { quota = QUOTA() } = {}) => ({
  session: sessionViewOf(inv.session), record: projectionOf(inv.record, { lines: latestLinesOf(inv.session), nowIso: inv.session.updatedAt }),
  companies: companiesOf(inv.record, { names: NAMES }), thesis: thesisOf(inv), opening: { storedRows: [] }, quota, previous: null,
});
/** A GET ?sessionId= answer on a builder (handleGet's builder branch). */
const getAnswerOf = (inv, { quota = QUOTA() } = {}) => ({
  session: sessionViewOf(inv.session), record: projectionOf(inv.record, { lines: latestLinesOf(inv.session), nowIso: inv.session.updatedAt }),
  companies: companiesOf(inv.record, { names: NAMES }), thesis: thesisOf(inv), storedRows: [], previous: null, quota,
});

/**
 * One builder step, as handleBuildStep runs it: the goal must be on offer (offeredGoalsOf), the turn is asked in
 * turnShapeOf's shape, validateBuildTurn must answer ok, the findings land, then applyProposals on the card read
 * against the record after them (cardCtxIn: support needs no names), `stepsUsed + 1`, lastStep completed.
 */
function step(inv, { goal, part = null, direction = null, output, items, nowIso, stepId = uuid('5e5e5e5e') }) {
  const card = inv.session.thesis;
  const ctx = cardContextOf({ record: inv.record, supported: companiesOf(inv.record).supported, session: inv.session });
  const offered = offeredGoalsOf(card, ctx);
  if (!offered.some((g) => g.goal === goal && (g.part ?? null) === part)) throw new Error(`fixture: ${goal}/${part} is not on offer: ${JSON.stringify(offered)}`);
  const shape = turnShapeOf({ goal, part }, offered, { deadEnd: blockedNow(card, ctx) });
  let k = 0;
  const partnerExchangeId = mint();
  const checked = validateBuildTurn(output, {
    record: inv.record, items, readAt: PROBE_B_READ_AT, partnerExchangeId, partnerAt: nowIso, nowIso,
    mintFindingId: () => `f_${uuid(`0a0a0a${String(++k).padStart(2, '0')}`)}`, names: NAMES, partnerName: 'Atlas', method: BASELINE,
    card, goal, part, shape,
  });
  if (!checked.ok) throw new Error(`fixture: the ${goal} turn does not validate: ${JSON.stringify(checked)}`);
  const record = append(inv.record, checked.findings, nowIso);
  const dirEx = direction ? [exchangeOf({ who: 'player', kind: 'direction', text: direction, at: nowIso, stepId, intent: 'build' }, { mintId: mint })] : [];
  const partner = exchangeOf({
    who: 'partner', kind: 'step', text: checked.reply || builderFallbackReplyOf(checked.findings.length, { cardChanged: checked.cardChanged }),
    at: nowIso, stepId, intent: 'build', goal, part,
  }, { mintId: () => partnerExchangeId });
  const session = {
    ...inv.session,
    exchanges: [...inv.session.exchanges, ...dirEx, partner],
    stepsUsed: inv.session.stepsUsed + 1,
    lastStep: { stepId, intent: 'build', status: 'completed', startedAt: nowIso, endedAt: nowIso, error: null, query: 'q', summaryWithheld: false },
    updatedAt: nowIso,
    thesis: applyProposals(card, checked.proposals, cardContextOf({ record, supported: companiesOf(record).supported, session: null })),
  };
  const next = { session, record };
  const companies = companiesOf(record, { names: NAMES });
  return {
    inv: next, stepId, notes: checked.notes,
    answer: {
      status: 200,
      body: {
        session: sessionViewOf(session), record: projectionOf(record, { lines: latestLinesOf(session), nowIso }), companies,
        thesis: thesisOf(next), changed: { findings: checked.findings.length, card: checked.cardChanged }, quota: QUOTA(),
      },
    },
  };
}

/** One free tap, as handleCard / applyCard run it: cardOpOf on the card, rev + 1, one `card` exchange (R-21). */
function tap(inv, { op, part, value, nowIso, opId = uuid('0c0c0c0c') }) {
  const ctx = cardContextOf({ record: inv.record, supported: companiesOf(inv.record, { names: NAMES }).supported, session: inv.session });
  const out = cardOpOf(inv.session.thesis, { opId, op, part, value }, ctx);
  if (!out.ok || !out.applied) throw new Error(`fixture: ${op} ${part} ${JSON.stringify(value)} refused: ${JSON.stringify(out)}`);
  const exchange = exchangeOf({ who: 'player', kind: 'card', text: out.label, at: nowIso, card: { op, part } }, { mintId: mint });
  const session = { ...inv.session, thesis: out.card, exchanges: [...inv.session.exchanges, exchange], updatedAt: nowIso };
  const next = { session, record: inv.record };
  return { inv: next, opId, answer: { status: 200, body: { session: sessionViewOf(session), thesis: thesisOf(next), applied: true } } };
}

/** The save, as adoptThesis + commitAdoption leave it: the list id, the record closed saved_to_list, the session completed. */
function save(inv, { nowIso, watchlistId = 'wl-thesis-1' }) {
  const thesis = thesisOf(inv);
  if (!thesis.ready || thesis.saveIssue) throw new Error('fixture: the card is not ready to save');
  const names = inv.session.thesis.names.value.map((s) => NAMES[s]).join(', ');
  const confirm = exchangeOf({ who: 'player', kind: 'confirm', text: `Saved as an idea: ${names}`, at: nowIso }, { mintId: mint });
  const record = { ...inv.record, ...closePatch(inv.record, { state: 'completed', terminalReason: 'saved_to_list', atIso: nowIso, funnel: manualFunnel(), subject: { watchlistId, hypothesisVersion: 1 } }) };
  const session = { ...inv.session, status: 'completed', adoption: { watchlistId, version: 1, at: nowIso }, exchanges: [...inv.session.exchanges, confirm], updatedAt: nowIso };
  const next = { session, record };
  return { inv: next, answer: { status: 200, body: { watchlistId, version: 1, researchWorkId: record.researchWorkId, idempotent: false, thesis: thesisOf(next) } } };
}

/** A failed step (handleBuildStep's `failed`): lastStep failed, nothing landed, the card as it was. */
function failedStep(inv, { reason, nowIso, stepId = uuid('5e5e5e5e') }) {
  const session = { ...inv.session, lastStep: { stepId, intent: 'build', status: 'failed', startedAt: nowIso, endedAt: nowIso, error: reason }, updatedAt: nowIso };
  const next = { session, record: inv.record };
  return { inv: next, stepId, answer: { status: 200, body: { error: 'step_failed', reason, session: sessionViewOf(session), thesis: thesisOf(next), quota: QUOTA({ stepCalls: 2 }) } } };
}

// ── authored model outputs (each passes validateBuildTurn) ────────────────────────

const retrievalFinding = (tempId, kind, fact, symbolCandidate, companyName, index, day) => ({
  tempId, kind, fact, symbolCandidate, companyName, support: { kind: 'retrieval', index, from: [], reason: null }, at: day, supersedes: null,
});
const item = (index, url, host, publishedDate, title, highlights) => ({ index, url, host, publishedDate, title, highlights });

/** The walk's names step: the recorded find_names items, plus one private packaging supplier (a lead). */
const NAMES_ITEMS = [
  ...probeOf('find_names').items,
  item(3, 'https://industry.example.org/ai-packaging', 'industry.example.org', '2026-11-05T00:00:00.000Z', 'Who packages AI chips', [
    'Orrin Compute, a privately held company, packages accelerator chips for several chip designers.',
  ]),
];
const FIND_NAMES_WALK = {
  reply: 'Three listed companies have a sourced connection to accelerator chips: Nvidia, AMD and Broadcom. A packaging supplier came up too, but it is privately held, so it stays a lead. Each connection rests on one source, and none says how much of the company\'s revenue it is.',
  findings: [
    retrievalFinding('t1', 'relationship', 'Nvidia designs the accelerator chips that most AI data centers buy.', 'NVDA', 'Nvidia', 0, '2026-11-09'),
    retrievalFinding('t2', 'relationship', 'AMD said cloud companies ordered its accelerator chips for new AI data centers.', 'AMD', 'AMD', 1, '2026-11-08'),
    retrievalFinding('t3', 'relationship', 'Broadcom designs custom AI chips for some of the largest cloud companies.', 'AVGO', 'Broadcom', 2, '2026-11-06'),
    retrievalFinding('t4', 'relationship', 'Orrin Compute packages accelerator chips for several chip designers.', null, 'Orrin Compute', 3, '2026-11-05'),
  ],
  companies: [
    { companyName: 'Nvidia', symbolCandidate: 'NVDA', role: 'Product owner', relationshipRef: 't1' },
    { companyName: 'AMD', symbolCandidate: 'AMD', role: 'Product owner', relationshipRef: 't2' },
    { companyName: 'Broadcom', symbolCandidate: 'AVGO', role: 'Supplier', relationshipRef: 't3' },
    { companyName: 'Orrin Compute', symbolCandidate: '', role: 'Supplier', relationshipRef: 't4' },
  ],
  pick: { value: 'NVDA, AMD', reason: 'Both are sourced as makers of the accelerator chips themselves; Broadcom\'s are custom chips.' },
};

/** The dead end: a names step on the power segment that finds no listed company. */
const POWER_ITEMS = probeOf('direction').items;
const FIND_NAMES_DEAD_END = {
  reply: 'No listed company has a sourced connection to data-center power yet. The one source names operators and the equipment they wait for, not who makes or sells it. The research stays on your record either way.',
  findings: [
    retrievalFinding('t1', 'coverage', 'Operators said cooling and power equipment now set how fast they can add AI capacity.', null, null, 0, '2026-11-03'),
  ],
  companies: [],
  pick: { value: '', reason: '' },
};

/** The why for a group of three: one sourced reason per name, a point against, the options and a time frame. */
const WHY_ITEMS = probeOf('build_why').items;
const groupWhy = (rel) => ({
  reply: 'Each of the three has a sourced connection to selling AI chips to the large cloud companies. The point against is the same for all of them: those buyers also design their own chips.',
  findings: [
    retrievalFinding('t1', 'coverage', 'Several of the largest cloud companies design their own AI chips and use them alongside the accelerators they buy.', null, null, 1, '2026-11-07'),
    retrievalFinding('t2', 'coverage', 'The largest cloud companies said they plan to keep raising AI data-center spending next year.', null, null, 2, '2026-11-10'),
  ],
  why: {
    shared: 'each sells AI chips to the same cloud data-center buyers',
    reasons: [
      { companyName: 'NVIDIA Corporation', symbolCandidate: 'NVDA', text: 'It designs the accelerator chips most AI data centers buy.', refs: [rel.NVDA] },
      { companyName: 'Advanced Micro Devices, Inc.', symbolCandidate: 'AMD', text: 'Cloud companies ordered its accelerator chips for new AI data centers.', refs: [rel.AMD] },
      { companyName: 'Broadcom Inc.', symbolCandidate: 'AVGO', text: 'It designs custom AI chips for some of the largest cloud companies.', refs: [rel.AVGO] },
    ],
    against: { text: 'The same few cloud buyers design their own AI chips, which could limit what all three sell them.', refs: ['t1'] },
  },
  wrongIfOptions: [
    { text: 'the largest cloud companies cut or pause their AI data-center spending plans', refs: ['t2'] },
    { text: 'the big cloud companies move most of their AI work onto chips they design themselves', refs: ['t1'] },
  ],
  timeFramePick: { horizon: 'positional', reason: 'The why rests on next year\'s spending plans, which play out over a few months.' },
  pick: { value: '', reason: '' },
});
/** The why for two names where only one has a sourced reason (SQ-3: the proposal is stored incomplete). */
const incompleteWhy = (rel) => ({
  reply: 'Nvidia has a sourced reason on the record; AMD has a connection but no reason yet that a source backs.',
  findings: [
    retrievalFinding('t1', 'coverage', 'Several of the largest cloud companies design their own AI chips and use them alongside the accelerators they buy.', null, null, 1, '2026-11-07'),
  ],
  why: {
    shared: 'both sell accelerator chips to the cloud companies building AI data centers',
    reasons: [{ companyName: 'NVIDIA Corporation', symbolCandidate: 'NVDA', text: 'It designs the accelerator chips most AI data centers buy.', refs: [rel.NVDA] }],
    against: { text: 'The largest buyers design their own AI chips too.', refs: ['t1'] },
  },
  wrongIfOptions: [],
  timeFramePick: null,
  pick: { value: '', reason: '' },
});

// ── the scenarios ─────────────────────────────────────────────────────────────

let STASH = null; // build()'s investigations the walk tree continues from (never serialised)
/** The player's own theme in the walk (§B13 T-6 "write your own"): one sample phrase, as the wrong-if has one. */
const SAMPLE_THEME = 'AI chips and data centers';

function build() {
  n = 0;
  const A = {};
  const OBS = 'I want to play AI';

  // ── THE WALK: own words → map → segment → names → one stock → why → confirm → wrong if → time frame → save ──
  const walkSid = '7a7a7a7a-0000-4000-8000-000000000001';
  const t0 = at(0);
  const player = exchangeOf({ who: 'player', kind: 'observation', text: OBS, at: t0 }, { mintId: mint });
  const question = builderQuestionOf(OBS);
  let inv = investigation({
    sessionId: walkSid, question, nowIso: t0, exchanges: [player], card: openingCardOf({ entryKind: 'observation', observation: OBS }),
    entry: { kind: 'observation', itemRef: null, direction: null, observation: OBS, topic: null, names: [] },
    findings: built(openingFindingsOf({ entryKind: 'observation', playerExchange: player, frame: null, names: [], stored: {}, nowIso: t0 }).filter((f) => f.kind !== 'next_action'), t0),
  });
  A.walkOpen = { status: 200, body: openAnswerOf(inv) };
  A.walkGetOpen = { status: 200, body: getAnswerOf(inv) };

  const map = step(inv, { goal: 'map_segments', output: WALK_MAP(), items: B5_MAP.items, nowIso: at(1) });
  inv = map.inv;
  A.walkMap = map.answer;
  A.walkGetMap = { status: 200, body: getAnswerOf(inv) };
  const afterMap = inv;
  // §B13 T-1 / T-6: the map's theme suggestion, confirmed (free) or replaced by the player's own phrase (free). The
  // linear walk below goes on without either — the theme gates nothing (T-2); the walk TREE has both branches.
  const themeConfirmed = tap(afterMap, { op: 'confirm', part: 'theme', nowIso: at(2) });
  A.walkThemeConfirm = themeConfirmed.answer;
  A.walkGetThemeConfirm = { status: 200, body: getAnswerOf(themeConfirmed.inv) };
  const themeOwn = tap(afterMap, { op: 'set', part: 'theme', value: { text: SAMPLE_THEME }, nowIso: at(2) });
  A.walkThemeOwn = themeOwn.answer;
  A.walkGetThemeOwn = { status: 200, body: getAnswerOf(themeOwn.inv) };

  const seg = tap(inv, { op: 'confirm', part: 'segment', nowIso: at(2) });
  inv = seg.inv;
  A.walkSegment = seg.answer;
  A.walkGetSegment = { status: 200, body: getAnswerOf(inv) };
  const afterSegment = inv;

  const names = step(inv, { goal: 'find_names', output: FIND_NAMES_WALK, items: NAMES_ITEMS, nowIso: at(3) });
  inv = names.inv;
  A.walkNames = names.answer;
  A.walkGetNames = { status: 200, body: getAnswerOf(inv) };
  const afterNames = inv;

  const one = tap(inv, { op: 'set', part: 'names', value: ['NVDA'], nowIso: at(4) });
  inv = one.inv;
  A.walkOneStock = one.answer;
  A.walkGetOneStock = { status: 200, body: getAnswerOf(inv) };
  const afterOneStock = inv;

  const why = step(inv, { goal: 'build_why', output: RECORDED('build_why'), items: WHY_ITEMS, nowIso: at(5) });
  inv = why.inv;
  A.walkWhy = why.answer;
  A.walkGetWhy = { status: 200, body: getAnswerOf(inv) };
  const afterWhyStep = inv;

  const confirmWhy = tap(inv, { op: 'confirm', part: 'why', nowIso: at(6) });
  inv = confirmWhy.inv;
  A.walkConfirmWhy = confirmWhy.answer;
  A.walkGetConfirmWhy = { status: 200, body: getAnswerOf(inv) };
  const afterWhy = inv;

  const wrong = tap(inv, { op: 'confirm', part: 'wrongIf', nowIso: at(7) });
  inv = wrong.inv;
  A.walkWrongIf = wrong.answer;
  A.walkGetWrongIf = { status: 200, body: getAnswerOf(inv) };
  const afterWrongIf = inv;

  const time = tap(inv, { op: 'confirm', part: 'timeFrame', nowIso: at(8) });
  inv = time.inv;
  A.walkTimeFrame = time.answer;
  A.walkGetReady = { status: 200, body: getAnswerOf(inv) };
  const ready = inv;

  const saved = save(inv, { nowIso: at(9) });
  A.walkSaved = saved.answer;
  A.walkGetSaved = { status: 200, body: getAnswerOf(saved.inv) };
  A.walkIds = {
    sessionId: walkSid, mapStepId: map.stepId, segmentOpId: seg.opId, namesStepId: names.stepId, oneStockOpId: one.opId,
    whyStepId: why.stepId, confirmWhyOpId: confirmWhy.opId, wrongIfOpId: wrong.opId, timeFrameOpId: time.opId,
  };

  // ── around the walk ─────────────────────────────────────────────────────────
  // a direction step at the start (the composer's 1-step mode), asked as the next research goal on offer
  const dirStart = step(investigation({
    sessionId: walkSid, question, nowIso: t0, exchanges: [player], card: openingCardOf({ entryKind: 'observation', observation: OBS }),
    entry: { kind: 'observation', itemRef: null, direction: null, observation: OBS, topic: null, names: [] },
    findings: built(openingFindingsOf({ entryKind: 'observation', playerExchange: player, frame: null, names: [], stored: {}, nowIso: t0 }).filter((f) => f.kind !== 'next_action'), t0),
  }), { goal: 'direction', direction: 'start with the chips', output: WALK_MAP(), items: B5_MAP.items, nowIso: at(1) });
  A.walkDirection = dirStart.answer;
  A.getAfterNamesAgain = { status: 200, body: getAnswerOf(afterNames) };

  // a failed step (T10b): the names step did not complete; the card as it was
  const failed = failedStep(afterSegment, { reason: 'invalid_unsupported_number', nowIso: at(3) });
  A.stepFailed = failed.answer;
  A.getStepFailed = { status: 200, body: getAnswerOf(failed.inv) };
  A.failedIds = { stepId: failed.stepId };

  // a stale card (409 card_stale): the player saw the card before the why landed; the server answers the fresh one
  A.cardStale = refusal(409, 'card_stale', { thesis: thesisOf(afterWhyStep) });
  A.stepInFlight = refusal(409, 'step_in_flight');
  A.invalidCard = refusal(400, 'invalid_card', { reason: 'suggestion_stale' });
  A.notReady = refusal(409, 'not_ready', { blockers: thesisOf(afterWhy).blockers });
  A.adoptUnsupported = refusal(400, 'unsupported_assertion', { detail: '30' });
  A.adoptStale = refusal(409, 'card_stale', { thesis: thesisOf(ready) });
  A.invalidEntry = refusal(400, 'invalid_entry');
  A.serverError = refusal(500, 'server_error');
  A.rateLimited = { ...refusal(429, 'rate_limited'), headers: { 'Retry-After': '2' } };

  // out of steps (T10a): the why confirmed, every research step used
  A.getOutOfSteps = { status: 200, body: getAnswerOf({ ...afterWhy, session: { ...afterWhy.session, stepsUsed: afterWhy.session.stepBudget } }) };
  // a price line on the ready card (K-13: optional · add your own)
  const priced = tap(ready, { op: 'set', part: 'wrongIf', value: { priceLines: [{ symbol: 'NVDA', level: 120 }] }, nowIso: at(9) });
  A.walkPriceLine = priced.answer;

  // the player's own wrong-if names a company the card does not hold: Save would be refused (saveIssue)
  const ownWords = tap(afterWhy, { op: 'set', part: 'wrongIf', value: { text: 'AMD wins the big cloud accelerator orders instead' }, nowIso: at(7) });
  A.walkOwnWrongIf = ownWords.answer;
  const issueReady = tap(ownWords.inv, { op: 'confirm', part: 'timeFrame', nowIso: at(8) });
  A.getSaveIssue = { status: 200, body: getAnswerOf(issueReady.inv) };

  // a stale segment: a correction supersedes the finding the segment rests on (the ready card is no longer ready)
  const segFinding = ready.session.thesis.segment.findingIds[0];
  const target = ready.record.findings.find((f) => f.findingId === segFinding);
  const corrected = append(ready.record, built([{
    kind: target.kind, symbol: target.symbol, fact: `Correction: ${target.fact}`, source: { recordKind: 'exchange', recordId: mint(), label: 'Not yet checked' },
    at: at(10), asOf: null, status: 'unavailable', statusReason: 'single_source', supersedes: target.findingId,
  }], at(10)), at(10));
  A.getStaleSegment = { status: 200, body: getAnswerOf({ ...ready, record: corrected }) };

  // a correction supersedes the finding a reason rests on (review 4A-4): a set why goes stale; a waiting proposal's
  // name loses its sourced reason (`incomplete`)
  const supersede = (inv, findingId, minute) => {
    const f = inv.record.findings.find((x) => x.findingId === findingId);
    return append(inv.record, built([{
      kind: f.kind, symbol: f.symbol, fact: `Correction: ${f.fact}`, source: { recordKind: 'exchange', recordId: mint(), label: 'Not yet checked' },
      at: at(minute), asOf: null, status: 'unavailable', statusReason: 'single_source', supersedes: f.findingId,
    }], at(minute)), at(minute));
  };
  const staleWhyInv = { ...ready, record: supersede(ready, ready.session.thesis.why.reasons[0].findingIds[0], 11) };
  A.getStaleWhy = { status: 200, body: getAnswerOf(staleWhyInv) };
  const proposalRef = afterWhyStep.session.thesis.why.proposal.reasons[0].findingIds[0];
  A.getProposalCorrected = { status: 200, body: getAnswerOf({ ...afterWhyStep, record: supersede(afterWhyStep, proposalRef, 11) }) };

  // the dead end (T9): the power segment, and a names step that finds no listed company
  const power = tap(afterMap, { op: 'set', part: 'segment', value: 'Power and grid', nowIso: at(2) }); // the B5 map's power segment (§B13 T-7)
  const dead = step(power.inv, { goal: 'find_names', output: FIND_NAMES_DEAD_END, items: POWER_ITEMS, nowIso: at(3) });
  A.deadEnd = dead.answer;
  A.getDeadEnd = { status: 200, body: getAnswerOf(dead.inv) };
  A.closeDeadEnd = (() => {
    const record = { ...dead.inv.record, ...closePatch(dead.inv.record, { state: 'completed', terminalReason: 'concluded', atIso: at(4), funnel: manualFunnel() }) };
    const session = { ...dead.inv.session, status: 'completed', exchanges: [...dead.inv.session.exchanges, exchangeOf({ who: 'player', kind: 'close', text: 'This answered my question.', at: at(4) }, { mintId: mint })], updatedAt: at(4) };
    return { status: 200, body: { session: sessionViewOf(session), record: projectionOf(record, { lines: latestLinesOf(session), nowIso: at(4) }), thesis: thesisOf({ session, record }) } };
  })();
  A.tryAnotherSegment = tap(dead.inv, { op: 'clear', part: 'segment', nowIso: at(4) }).answer;

  // the group (T5G): three names, one sourced reason each, the shared reason in the sentence
  const rel = Object.fromEntries(['NVDA', 'AMD', 'AVGO'].map((s) => [s, afterNames.record.findings.find((f) => f.kind === 'relationship' && f.symbol === s).findingId]));
  const three = tap(afterNames, { op: 'set', part: 'names', value: ['NVDA', 'AMD', 'AVGO'], nowIso: at(4) });
  const groupStep = step(three.inv, { goal: 'build_why', output: groupWhy(rel), items: WHY_ITEMS, nowIso: at(5) });
  A.groupWhy = groupStep.answer;
  A.getGroupWhy = { status: 200, body: getAnswerOf(groupStep.inv) };
  let group = tap(groupStep.inv, { op: 'confirm', part: 'why', nowIso: at(6) }).inv;
  group = tap(group, { op: 'set', part: 'wrongIf', value: { option: 0 }, nowIso: at(7) }).inv;
  group = tap(group, { op: 'confirm', part: 'timeFrame', nowIso: at(8) }).inv;
  A.getGroupReady = { status: 200, body: getAnswerOf(group) };


  // an incomplete why (SQ-3): two names, a sourced reason for one; the drop choice
  const two = tap(afterNames, { op: 'confirm', part: 'names', nowIso: at(4) });
  const inc = step(two.inv, { goal: 'build_why', output: incompleteWhy(rel), items: WHY_ITEMS, nowIso: at(5) });
  A.incompleteWhy = inc.answer;
  A.getIncompleteWhy = { status: 200, body: getAnswerOf(inc.inv) };
  A.dropUnsourced = tap(inc.inv, { op: 'set', part: 'names', value: ['NVDA'], nowIso: at(6) }).answer;

  // the names step's pick confirmed (the agent's pick on the names, K-10b)
  A.walkConfirmNames = two.answer;

  // the asked pick (T2b; DR-2): the recorded `pick` probe, its reasons labelled by the server (source / reasoning)
  const pp = probeOf('pick');
  const pickSid = '7b7b7b7b-0000-4000-8000-000000000001';
  const pickInv = investigation({
    sessionId: pickSid, question: pp.record.question, nowIso: at(0), exchanges: [exchangeOf({ who: 'player', kind: 'observation', text: OBS, at: at(0) }, { mintId: mint })],
    card: pp.card, entry: { kind: 'observation', itemRef: null, direction: null, observation: OBS, topic: null, names: [] }, findings: pp.record.findings,
  });
  const asked = step({ ...pickInv, session: { ...pickInv.session, stepsUsed: 1 } }, { goal: 'pick', part: 'segment', output: RECORDED('pick'), items: [], nowIso: at(2) });
  A.pickAsked = asked.answer;
  A.getPickAsked = { status: 200, body: getAnswerOf(asked.inv) };

  // the revised why (§B12 W-13): every part set, then Keep researching on the why
  const sp = probeOf('strengthen:why');
  const revSid = '7c7c7c7c-0000-4000-8000-000000000001';
  const revInv = investigation({
    sessionId: revSid, question: sp.record.question, nowIso: at(0), exchanges: [exchangeOf({ who: 'player', kind: 'observation', text: OBS, at: at(0) }, { mintId: mint })],
    card: sp.card, entry: { kind: 'observation', itemRef: null, direction: null, observation: OBS, topic: null, names: [] }, findings: sp.record.findings,
  });
  const revised = step({ ...revInv, session: { ...revInv.session, stepsUsed: 4 } }, { goal: 'strengthen', part: 'why', output: RECORDED('strengthen.why'), items: sp.items, nowIso: at(10) });
  A.revisedWhy = revised.answer;
  A.getRevisedWhy = { status: 200, body: getAnswerOf(revised.inv) };
  A.useRevisedWhy = tap(revised.inv, { op: 'confirm', part: 'why', nowIso: at(11) }).answer;

  // a story start (T8a / T8b): the card opens empty; the first choice checks the story against its source
  const vp = probeOf('verify_source');
  const storySid = '7d7d7d7d-0000-4000-8000-000000000001';
  const STORY = { id: 'ft-story-ai-capex-1', headline: 'Cloud companies keep raising AI data-center spending', reporterName: 'Kim', reporterBeat: 'Sector Strategist', publishedAt: '2026-11-15T13:00:00.000Z', primaryTicker: null, tickers: [] };
  const storyNames = namesInScopeOf({ entryKind: 'item', story: STORY });
  const storyQ = 'Which companies earn from the development this story describes, and how directly?';
  const storyInv = investigation({
    sessionId: storySid, question: storyQ, nowIso: at(0), exchanges: [], card: openingCardOf({ entryKind: 'item' }),
    entry: { kind: 'item', itemRef: { recordKind: 'fantasyTimesStories', recordId: STORY.id }, direction: null, observation: null, topic: null, names: storyNames },
    findings: built(openingFindingsOf({ entryKind: 'item', story: STORY, names: storyNames, stored: {}, nowIso: at(0) }).filter((f) => f.kind !== 'next_action'), at(0)),
  });
  A.storyOpen = { status: 200, body: openAnswerOf(storyInv) };
  A.getStoryOpen = { status: 200, body: getAnswerOf(storyInv) };
  const verified = step(storyInv, { goal: 'verify_source', output: RECORDED('verify_source'), items: vp.items, nowIso: at(1) });
  A.storyVerified = verified.answer;
  A.getStoryVerified = { status: 200, body: getAnswerOf(verified.inv) };
  A.storyConfirmTheme = tap(verified.inv, { op: 'confirm', part: 'theme', nowIso: at(2) }).answer;
  A.storyIds = { sessionId: storySid, story: STORY };

  // lists
  A.listEmpty = { status: 200, body: { open: [], quota: QUOTA({ investigationsOpened: 0, stepCalls: 0 }) } };
  A.listDailyLimit = { status: 200, body: { open: [], quota: QUOTA({ investigationsOpened: 3 }) } };
  A.listFramingLimit = { status: 200, body: { open: [], quota: QUOTA({ investigationsOpened: 0, framingsRun: 10 }) } };

  A.ids = { walk: A.walkIds, failed: A.failedIds, story: A.storyIds, observation: OBS, pickSid, revSid };
  delete A.walkIds;
  delete A.failedIds;
  delete A.storyIds;
  // for the rows: the card the walk's states were composed from, by name (the server's view of each)
  A.cards = {
    open: thesisOf(investigation({
      sessionId: walkSid, question, nowIso: t0, exchanges: [player], card: openingCardOf({ entryKind: 'observation', observation: OBS }),
      entry: { kind: 'observation', itemRef: null, direction: null, observation: OBS, topic: null, names: [] }, findings: [],
    })),
    afterMap: thesisOf(afterMap), afterSegment: thesisOf(afterSegment), afterNames: thesisOf(afterNames), afterOneStock: thesisOf(afterOneStock),
    afterWhyStep: thesisOf(afterWhyStep), afterWhy: thesisOf(afterWhy), afterWrongIf: thesisOf(afterWrongIf), ready: thesisOf(ready),
  };
  // more carried findings than the idea builder takes (saveIssue too_many_evidence_refs; thesis.js saveIssueOf, RA-7):
  // thirty Source-backed notes on Nvidia land on the record (appended as the record holds findings — the corrections'
  // precedent above: a step adds at most STEP_FINDINGS_MAX), the why is asked as a build_why step that cites them all and
  // passes validateBuildTurn, then the walk's own taps make the card ready
  const LETTERS = Array.from({ length: 30 }, (_, i) => `${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`);
  const notes = built(LETTERS.map((l) => ({
    kind: 'coverage', symbol: 'NVDA', fact: `An analyst note (${l}) says the large cloud buyers keep ordering Nvidia accelerators for new AI data centers.`,
    source: { recordKind: 'retrieval', recordId: `https://research.example.org/nvidia-note-${l}`, label: `research.example.org · Nvidia note ${l}`, url: `https://research.example.org/nvidia-note-${l}` },
    at: at(5), asOf: '2026-11-08T00:00:00.000Z', status: 'verified', statusReason: null, supersedes: null,
  })), at(5));
  const crowded = { ...afterOneStock, record: append(afterOneStock.record, notes, at(5)) };
  const manyWhy = step(crowded, {
    goal: 'build_why', items: WHY_ITEMS, nowIso: at(6),
    output: {
      reply: 'Many notes on the record say the same thing: the large cloud buyers keep ordering Nvidia accelerators.',
      findings: [],
      why: {
        shared: 'the large cloud buyers keep ordering Nvidia accelerators for new AI data centers',
        reasons: [{ companyName: 'NVIDIA Corporation', symbolCandidate: 'NVDA', text: 'Note after note says the large cloud buyers keep ordering its accelerators.', refs: [rel.NVDA, ...notes.map((f) => f.findingId)] }],
      },
      wrongIfOptions: [],
      timeFramePick: null,
      pick: { value: '', reason: '' },
    },
  });
  let many = tap(manyWhy.inv, { op: 'confirm', part: 'why', nowIso: at(7) }).inv;
  many = tap(many, { op: 'set', part: 'wrongIf', value: { text: 'the large cloud buyers stop ordering Nvidia accelerators' }, nowIso: at(8) }).inv;
  many = tap(many, { op: 'set', part: 'timeFrame', value: 'positional', nowIso: at(9) }).inv;
  A.getTooManyRefs = { status: 200, body: getAnswerOf(many) };
  STASH = { afterMap, afterNames, walkGetMap: A.walkGetMap };

  // ── the refuters' second round: each sequence as a server would answer it ──
  // not_ready on the ready card the screen holds: a correction made its why stale with no card op (the rev unchanged)
  A.notReadyStaleWhy = refusal(409, 'not_ready', { blockers: thesisOf(staleWhyInv).blockers });
  A.clearStaleWhy = tap(staleWhyInv, { op: 'clear', part: 'why', nowIso: at(12) }).answer;
  // card_stale on Save: a price line set elsewhere moved the card on; the GET of that card; then the card moves again
  A.adoptStalePriced = refusal(409, 'card_stale', { thesis: thesisOf(priced.inv) });
  A.getPriced = { status: 200, body: getAnswerOf(priced.inv) };
  A.walkPriceLineAgain = tap(priced.inv, { op: 'set', part: 'wrongIf', value: { priceLines: [{ symbol: 'NVDA', level: 110 }] }, nowIso: at(12) }).answer;
  // a lost tap that landed (swing): the next tap (positional) is refused with the card swing made; the time frame is
  // changed (cleared), then swing is tapped again — a new tap the server must apply
  const swung = tap(afterSegment, { op: 'set', part: 'timeFrame', value: 'swing', nowIso: at(12) });
  A.timeFrameLanded = refusal(409, 'card_stale', { thesis: thesisOf(swung.inv) });
  const unswung = tap(swung.inv, { op: 'clear', part: 'timeFrame', nowIso: at(13) });
  A.clearTimeFrameAgain = unswung.answer;
  A.swingAgain = tap(unswung.inv, { op: 'set', part: 'timeFrame', value: 'swing', nowIso: at(14) }).answer;
  // the composer leaves and returns (the refuter, phone round): out of steps, so no direction; the wrong-if set brings the
  // time frame (no text box) to the front; changing the wrong-if brings its text box back
  const outOfSteps = { ...afterWhy, session: { ...afterWhy.session, stepsUsed: afterWhy.session.stepBudget } };
  const oosSet = tap(outOfSteps, { op: 'set', part: 'wrongIf', value: { option: 0 }, nowIso: at(14) });
  A.oosWrongIfSet = oosSet.answer;
  A.oosWrongIfCleared = tap(oosSet.inv, { op: 'clear', part: 'wrongIf', nowIso: at(15) }).answer;
  // a later free tap after a step landed unheard (its read may fail; the next card answer reads again)
  A.oneStockTimeFrame = tap(afterOneStock, { op: 'set', part: 'timeFrame', value: 'swing', nowIso: at(12) }).answer;
  // the screen holds the segment; find_names landed but its answer was lost; the player sets swing (the answer shows the
  // step), then changes it (the next card answer); the GET after that change
  const namesSwing = tap(afterNames, { op: 'set', part: 'timeFrame', value: 'swing', nowIso: at(12) });
  A.namesTimeFrame = namesSwing.answer;
  const namesUnswung = tap(namesSwing.inv, { op: 'clear', part: 'timeFrame', nowIso: at(13) });
  A.namesTimeFrameCleared = namesUnswung.answer;
  A.getNamesTimeFrameCleared = { status: 200, body: getAnswerOf(namesUnswung.inv) };

  // §B13 T-2: the sentence in each of its shapes — the walk's ready card (no theme, a segment) with the theme confirmed,
  // and a walk on a SKIPPED segment, with and without the theme — so the screen's runs are pinned for every shape
  const readyThemed = tap(ready, { op: 'confirm', part: 'theme', nowIso: at(12) });
  A.getReadyThemed = { status: 200, body: getAnswerOf(readyThemed.inv) };
  // §B14 Q-4: the ready view's theme block — its confirm, and the player's own phrase — as the card route answers them
  A.readyThemeConfirm = readyThemed.answer;
  A.readyThemeOwn = tap(ready, { op: 'set', part: 'theme', value: { text: SAMPLE_THEME }, nowIso: at(12) }).answer;
  let sk = tap(afterMap, { op: 'set', part: 'segment', value: 'skip', nowIso: at(12) }).inv;
  sk = step(sk, { goal: 'find_names', output: FIND_NAMES_WALK, items: NAMES_ITEMS, nowIso: at(13) }).inv;
  sk = tap(sk, { op: 'set', part: 'names', value: ['NVDA'], nowIso: at(14) }).inv;
  sk = step(sk, { goal: 'build_why', output: RECORDED('build_why'), items: WHY_ITEMS, nowIso: at(15) }).inv;
  sk = tap(sk, { op: 'confirm', part: 'why', nowIso: at(16) }).inv;
  sk = tap(sk, { op: 'set', part: 'wrongIf', value: { text: SAMPLE_WRONG_IF }, nowIso: at(17) }).inv;
  sk = tap(sk, { op: 'set', part: 'timeFrame', value: 'longterm', nowIso: at(18) }).inv;
  A.getReadySkipped = { status: 200, body: getAnswerOf(sk) };
  A.getReadyThemedSkipped = { status: 200, body: getAnswerOf(tap(sk, { op: 'set', part: 'theme', value: { text: SAMPLE_THEME }, nowIso: at(19) }).inv) };

  // §B13 T-5: "You pick, and tell me why" on the time frame after the why step suggested one — the asked pick lands and
  // the older suggestion goes; the confirm carries the pick
  const tfPicked = step(afterWrongIf, {
    goal: 'pick', part: 'timeFrame', items: [], nowIso: at(12),
    output: {
      reply: 'I would take the longer frame. The spending plans the why rests on run past next year.',
      pick: { value: 'longterm', reason: 'The spending plans the why rests on run past next year.', reasons: [{ text: 'The spending plans run past next year.', refs: [] }, { text: 'The point against takes time to show up.', refs: [] }] },
    },
  });
  A.getTimeFramePicked = { status: 200, body: getAnswerOf(tfPicked.inv) };
  // §B14 Q-1 (b): a later step with no time-frame answer (Keep researching on the why) replaces the pick; the pick's value
  // survives as the suggestion, and its confirm now reads "{agent} suggested"
  const later = step(tfPicked.inv, { goal: 'strengthen', part: 'why', items: WHY_ITEMS, nowIso: at(13), output: { reply: 'Nothing new changes the why.', findings: [], why: null } });
  A.getTimeFrameAfterPick = { status: 200, body: getAnswerOf(later.inv) };
  return A;
}

// ── THE WALK AS A TREE (the phone round, P-8): the taps a person will try at each point ──────────────────────────
// The smoke page's ?srFixture=walk answers from this tree: at the names point the agent's pick and any one to three of
// NVDA, AMD and AVGO; at the wrong-if point each option drawn and the player's own words (one sample text, which names
// no company); at the time-frame point each of the three. Each tap's answer is composed here, as every answer above,
// and every leaf is SAVED (save() throws unless the card is ready with no saveIssue). What each point answers is what
// the screen draws there: the client's own valueChoicesOf / textChoiceOf over the server's card.
const SAMPLE_WRONG_IF = 'the large cloud buyers stop raising their AI data-center spending';
const SHORT = Object.freeze({ NVDA: 'Nvidia', AMD: 'AMD', AVGO: 'Broadcom' });
const REASON = Object.freeze({
  NVDA: 'It designs the accelerator chips most AI data centers buy.',
  AMD: 'Cloud companies ordered its accelerator chips for new AI data centers.',
  AVGO: 'It designs custom AI chips for some of the largest cloud companies.',
});
const SHARED_ONE = Object.freeze({
  NVDA: 'Nvidia designs the accelerator chips most AI data centers buy',
  AMD: 'AMD sells accelerator chips to the cloud companies building AI data centers',
  AVGO: 'Broadcom designs custom AI chips for some of the largest cloud companies',
});
/** The why for a chosen set of names (authored; validateBuildTurn must pass it): one sourced reason per name. */
const whyFor = (names, rel) => {
  const one = names.length === 1;
  const all = names.length === 2 ? 'both' : 'all three';
  const g = groupWhy(rel);
  return {
    reply: one
      ? `${SHORT[names[0]]} has a sourced connection to the AI chips data centers buy. The point against: the largest cloud buyers also design their own chips.`
      : `${names.length === 2 ? 'Both have' : 'Each of the three has'} a sourced connection to the AI chips data centers buy. The point against is the same for ${all}: the largest cloud buyers also design their own chips.`,
    findings: g.findings,
    why: {
      shared: one ? SHARED_ONE[names[0]] : g.why.shared,
      reasons: names.map((s) => ({ companyName: NAMES[s], symbolCandidate: s, text: REASON[s], refs: [rel[s]] })),
      against: { text: one ? 'The largest cloud buyers design their own AI chips too, which could limit what it sells them.' : `The same few cloud buyers design their own AI chips, which could limit what ${all} sell them.`, refs: ['t1'] },
    },
    wrongIfOptions: g.wrongIfOptions,
    timeFramePick: g.timeFramePick,
    pick: { value: '', reason: '' },
  };
};
const subsetsOf = (xs) => Array.from({ length: (1 << xs.length) - 1 }, (_, m) => xs.filter((_, i) => ((m + 1) >> i) & 1));
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
/** A card request as the client sends it for a choice (value only when there is one). */
const cardMatch = (c, value = c.value) => ({ action: 'card', op: c.op, part: c.part, ...(value !== undefined && value !== null ? { value } : {}) });

function buildWalk() {
  const A = build();
  const { afterMap, walkGetMap } = STASH;
  const nodes = {};
  let k = 0;
  const node = (accepts, extra = {}) => { const id = `w${k++}`; nodes[id] = { accepts, ...extra }; return id; };
  const front = (inv, part) => { if (frontPartOf(thesisOf(inv)) !== part) throw new Error(`walk: ${part} is not in front: ${frontPartOf(thesisOf(inv))}`); };
  let leaves = 0;

  const readyNode = (inv) => {
    const saved = save(inv, { nowIso: at(30) });
    leaves += 1;
    const end = node([], { get: { status: 200, body: getAnswerOf(saved.inv) } });
    return node([{ match: { action: 'adopt' }, say: 'Save thesis', answer: saved.answer, next: end }]);
  };
  const timeNode = (inv) => {
    front(inv, 'timeFrame');
    const t = thesisOf(inv);
    return node(valueChoicesOf(t, 'timeFrame').map((c) => {
      const r = tap(inv, { op: c.op, part: 'timeFrame', value: c.value, nowIso: at(29) });
      return { match: cardMatch(c), say: horizonLabelOf(c.value), answer: r.answer, next: readyNode(r.inv) };
    }));
  };
  const wrongIfNode = (inv) => {
    front(inv, 'wrongIf');
    const t = thesisOf(inv);
    const accepts = valueChoicesOf(t, 'wrongIf').map((c) => {
      const r = tap(inv, { op: c.op, part: 'wrongIf', value: c.value, nowIso: at(28) });
      const text = c.op === 'confirm' ? c.value : t.parts.wrongIf.options[c.value.option].text;
      return { match: cardMatch(c), say: `“${text}”`, answer: r.answer, next: timeNode(r.inv) };
    });
    const typed = textChoiceOf(t, 'wrongIf');
    if (!typed) throw new Error('walk: no own words on the wrong-if');
    const r = tap(inv, { op: typed.op, part: 'wrongIf', value: { text: SAMPLE_WRONG_IF }, nowIso: at(28) });
    accepts.push({ match: cardMatch(typed, { text: { $text: SAMPLE_WRONG_IF } }), say: `your own words, typed as: “${SAMPLE_WRONG_IF}”`, answer: r.answer, next: timeNode(r.inv) });
    return node(accepts);
  };
  const whyNode = (inv, output) => {
    const stepped = step(inv, { goal: 'build_why', output, items: WHY_ITEMS, nowIso: at(25) });
    const confirmed = tap(stepped.inv, { op: 'confirm', part: 'why', nowIso: at(26) });
    const confirmNode = node([{ match: { action: 'card', op: 'confirm', part: 'why' }, say: 'Confirm these reasons', answer: confirmed.answer, next: wrongIfNode(confirmed.inv) }]);
    return node([{ match: { action: 'step', goal: 'build_why' }, say: 'Find the reasons', answer: stepped.answer, next: confirmNode }]);
  };

  // the names point: the agent's pick (a confirm), and every other one to three of the options (a set)
  const namesNodeOf = (afterNames) => {
    const rel = Object.fromEntries(['NVDA', 'AMD', 'AVGO'].map((sym) => [sym, afterNames.record.findings.find((x) => x.kind === 'relationship' && x.symbol === sym).findingId]));
    const t3 = thesisOf(afterNames);
    const setNames = t3.choices.free.find((c) => c.op === 'set' && c.part === 'names');
    const pick = t3.choices.free.find((c) => c.op === 'confirm' && c.part === 'names');
    const picked = tap(afterNames, { op: 'confirm', part: 'names', value: pick.value, nowIso: at(24) });
    const namesAccepts = [{ match: cardMatch(pick), say: `your agent's pick (${joinNames(pick.value)})`, answer: picked.answer, next: whyNode(picked.inv, whyFor(pick.value, rel)) }];
    for (const sub of subsetsOf(setNames.options)) {
      if (sameSet(sub, pick.value)) continue; // ticking exactly the pick sends the pick's confirm (P-4)
      const r = tap(afterNames, { op: 'set', part: 'names', value: sub, nowIso: at(24) });
      const recorded = sub.length === 1 && sub[0] === 'NVDA'; // the founder's walk keeps its recorded why
      namesAccepts.push({ match: { action: 'card', op: 'set', part: 'names', value: sub }, say: `Build it on ${joinNames(sub)}`, answer: r.answer, next: whyNode(r.inv, recorded ? RECORDED('build_why') : whyFor(sub, rel)) });
    }
    return node(namesAccepts);
  };
  /** From a set segment: the names step (find_names, the theme set or only suggested — T-2), then the names point on. */
  const findNodeOf = (afterSegment) => {
    front(afterSegment, 'names');
    const found = step(afterSegment, { goal: 'find_names', output: FIND_NAMES_WALK, items: NAMES_ITEMS, nowIso: at(23) });
    return node([{ match: { action: 'step', goal: 'find_names' }, say: 'Find the listed companies', answer: found.answer, next: namesNodeOf(found.inv) }]);
  };
  /** The segment point (T-6: in front once the map lands, the theme suggested or set): the agent's pick, confirmed. */
  const segPick = walkGetMap.body.thesis.choices.free.find((c) => c.op === 'confirm' && c.part === 'segment');
  const segNodeOf = (inv) => {
    front(inv, 'segment');
    const seg = tap(inv, { op: 'confirm', part: 'segment', value: segPick.value, nowIso: at(22) });
    return { match: cardMatch(segPick), say: `your agent's pick (${segPick.value})`, answer: seg.answer, next: findNodeOf(seg.inv) };
  };
  // §B13 T-6: after the map, the theme's line (its suggestion confirmed, or the player's own phrase — one sample) sits
  // above the segment choices; the segment may also be picked first, the theme left suggested (T-2: it gates nothing)
  const tm = thesisOf(afterMap);
  const themeConfirm = tm.choices.free.find((c) => c.op === 'confirm' && c.part === 'theme');
  const themeText = tm.choices.free.find((c) => c.part === 'theme' && c.input === 'text');
  if (!themeConfirm || !themeText) throw new Error('walk: the map left no theme choices');
  const themed = tap(afterMap, { op: 'confirm', part: 'theme', value: themeConfirm.value, nowIso: at(21) });
  const own = tap(afterMap, { op: 'set', part: 'theme', value: { text: SAMPLE_THEME }, nowIso: at(21) });
  const themePoint = node([
    { match: cardMatch(themeConfirm), say: `“${themeConfirm.value}” as the theme`, answer: themed.answer, next: node([segNodeOf(themed.inv)]) },
    { match: cardMatch(themeText, { text: { $text: SAMPLE_THEME } }), say: `your own theme, typed as: “${SAMPLE_THEME}”`, answer: own.answer, next: node([segNodeOf(own.inv)]) },
    segNodeOf(afterMap),
  ]);
  const mapNode = node([{ match: { action: 'step', goal: 'map_segments' }, say: 'Map the segments', answer: A.walkMap, next: themePoint }]);
  const start = node([{ match: { action: 'open', entry: { kind: 'observation', observation: { $text: 'I want to play AI' } } }, say: '“I want to play AI”, then Start my thesis', answer: A.walkOpen, next: mapNode }]);
  return { start, sample: SAMPLE_WRONG_IF, sampleTheme: SAMPLE_THEME, leaves, nodes };
}

describe('the walk as a tree (the phone round, P-8): every tap a person will try is answered, every leaf saved', () => {
  it('thesisWalk.json equals what the server\'s functions compose today', () => {
    const fresh = JSON.parse(JSON.stringify(buildWalk()));
    if (process.env.GENERATE_SR_THESIS_FIXTURES === '1') writeFileSync(WALK_OUT, `${JSON.stringify(fresh)}\n`);
    expect(JSON.parse(readFileSync(WALK_OUT, 'utf8'))).toEqual(fresh);
  });
  it('the names point answers the pick and every one to three of the options; every path ends saved', () => {
    const W = buildWalk();
    const walkFrom = (id, depth = 0) => {
      const nd = W.nodes[id];
      if (nd.accepts.length === 0) { expect(nd.get.body.session.adoption).toBeTruthy(); return 1; }
      return nd.accepts.reduce((sum, a) => sum + walkFrom(a.next, depth + 1), 0);
    };
    expect(walkFrom(W.start)).toBe(W.leaves);
    const names = Object.values(W.nodes).find((nd) => nd.accepts.some((a) => a.match.part === 'names'));
    expect(names.accepts.map((a) => (a.match.op === 'confirm' ? 'pick' : a.match.value.join('+')))).toEqual(['pick', 'NVDA', 'AMD', 'AVGO', 'NVDA+AVGO', 'AMD+AVGO', 'NVDA+AMD+AVGO']);
    // §B13 T-6 (moved from 7): the theme point after the map has three ways on — the suggestion confirmed, the player's
    // own phrase, or the segment first — and each carries the whole walk after it
    const themePoint = Object.values(W.nodes).find((nd) => nd.accepts.some((a) => a.match.part === 'theme'));
    expect(themePoint.accepts.map((a) => `${a.match.op}:${a.match.part}`)).toEqual(['confirm:theme', 'set:theme', 'confirm:segment']);
    expect(themePoint.accepts[0].answer.body.thesis.parts.theme).toMatchObject({ state: 'set', by: 'partner_suggested_confirmed' });
    expect(themePoint.accepts[1].answer.body.thesis.parts.theme).toMatchObject({ state: 'set', value: W.sampleTheme, by: 'player_wrote' });
    expect(themePoint.accepts[2].answer.body.thesis.parts.theme.state).toBe('suggested');
    const wrongIfPoints = Object.values(W.nodes).filter((nd) => nd.accepts.some((a) => a.match.part === 'wrongIf'));
    expect(wrongIfPoints).toHaveLength(21);
    for (const nd of wrongIfPoints) expect(nd.accepts.at(-1).match.value).toEqual({ text: { $text: SAMPLE_WRONG_IF } });
    const timePoints = Object.values(W.nodes).filter((nd) => nd.accepts.some((a) => a.match.part === 'timeFrame'));
    expect(timePoints.length).toBeGreaterThan(7);
    for (const nd of timePoints) expect(nd.accepts.map((a) => a.say).sort()).toEqual(['swing', 'positional', 'longterm'].map(horizonLabelOf).sort());
  });
});

describe('the walk\'s route (P-8): the founder\'s paths, as the client sends them, end saved; any other tap is named', () => {
  const W = buildWalk();
  const SID = '7a7a7a7a-0000-4000-8000-000000000001';
  /** Drive the route as the client would: each body built from the last answer's card, as the screen draws it. */
  const drive = (picks) => {
    const route = walkRouteOf(W);
    let thesis = null;
    const send = (key, body) => {
      const a = route({ key, body: key === 'get' ? null : { action: key, ...body } });
      if (a.status !== 200) throw new Error(`not answered: ${key} ${JSON.stringify(body)} → ${a.body.message}`);
      if (a.body.thesis) thesis = a.body.thesis;
      return a;
    };
    const card = (c, value = c.value) => send('card', { sessionId: SID, opId: 'x', rev: thesis.rev, op: c.op, part: c.part, ...(value !== undefined && value !== null ? { value } : {}) });
    send('open', { entry: { kind: 'observation', observation: 'I want to play AI' }, requestId: 'r' });
    send('step', { sessionId: SID, stepId: 's1', intent: 'build', goal: 'map_segments' });
    // §B13 T-6: the theme's line, as the client sends it — the suggestion's confirm, or the theme's own text box
    if (picks.theme === 'confirm') card(thesis.choices.free.find((c) => c.op === 'confirm' && c.part === 'theme'));
    if (picks.theme === 'own') card(textChoiceOf(thesis, 'theme'), { text: picks.themeText });
    card(valueChoicesOf(thesis, 'segment').find((c) => c.op === 'confirm'));
    send('step', { sessionId: SID, stepId: 's2', intent: 'build', goal: 'find_names' });
    if (picks.names === 'pick') card(thesis.choices.free.find((c) => c.op === 'confirm' && c.part === 'names'));
    else card(thesis.choices.free.find((c) => c.op === 'set' && c.part === 'names'), picks.names);
    send('step', { sessionId: SID, stepId: 's3', intent: 'build', goal: 'build_why' });
    card(thesis.choices.free.find((c) => c.op === 'confirm' && c.part === 'why'));
    if (picks.wrongIf === 'typed') card(textChoiceOf(thesis, 'wrongIf'), { text: picks.typed });
    else card(valueChoicesOf(thesis, 'wrongIf')[picks.wrongIf]);
    card(valueChoicesOf(thesis, 'timeFrame').find((c) => c.value === picks.timeFrame));
    send('adopt', { sessionId: SID, rev: thesis.rev });
    return send('get', null).body;
  };
  it.each([
    ['the founder\'s path: AMD and AVGO, the first wrong-if, Longterm', { names: ['AMD', 'AVGO'], wrongIf: 0, timeFrame: 'longterm' }, ['AMD', 'AVGO']],
    ['the agent\'s pick, the second wrong-if, Swing', { names: 'pick', wrongIf: 1, timeFrame: 'swing' }, ['NVDA', 'AMD']],
    ['NVDA alone, a typed wrong-if (loosely typed), Positional', { names: ['NVDA'], wrongIf: 'typed', typed: '  The large cloud buyers STOP raising their AI data-center spending ', timeFrame: 'positional' }, ['NVDA']],
    // §B13 T-6 / the B5 checklist: the theme confirmed, or typed, before the segment
    ['the B5 checklist: the theme confirmed, NVDA alone, the first wrong-if, Positional', { theme: 'confirm', names: ['NVDA'], wrongIf: 0, timeFrame: 'positional' }, ['NVDA']],
    ['the theme typed (loosely), the agent\'s pick, the first wrong-if, Swing', { theme: 'own', themeText: ' ai chips and DATA centers ', names: 'pick', wrongIf: 0, timeFrame: 'swing' }, ['NVDA', 'AMD']],
  ])('%s', (_label, picks, names) => {
    const saved = drive(picks);
    expect(saved.session.adoption).toBeTruthy();
    expect(saved.thesis.parts.names.value).toEqual(names);
    expect(saved.thesis.parts.timeFrame.value).toBe(picks.timeFrame);
    const theme = saved.thesis.parts.theme;
    if (picks.theme) expect(theme.state).toBe('set');
    else expect(theme.state).toBe('suggested'); // the segment first: the theme left suggested, never set by a step (T-2)
  });
  it('the B5 checklist\'s sentence opens with the confirmed theme; with the theme left suggested it opens at the names', () => {
    const suggestion = RECORDED('b5.map_segments').themeSuggestion;
    const themed = drive({ theme: 'confirm', names: ['NVDA'], wrongIf: 0, timeFrame: 'positional' });
    expect(themed.thesis.sentence.startsWith(`My theme is ${suggestion}, through Accelerator chips, built on NVDA, because `)).toBe(true);
    expect(themed.thesis.parts.wrongIf.by).not.toBe('player_wrote'); // an option: the ready screen tags it "in words" (T-8)
    const plain = drive({ names: ['NVDA'], wrongIf: 0, timeFrame: 'positional' });
    expect(plain.thesis.sentence.startsWith('Built on NVDA, through Accelerator chips, because ')).toBe(true);
  });
  it('a tap the walk does not cover answers a line naming the taps it does — at the names point, NVDA and AMD by set (the client sends the pick\'s confirm)', () => {
    const route = walkRouteOf(W);
    route({ key: 'open', body: { action: 'open', entry: { kind: 'observation', observation: 'I want to play AI' } } });
    route({ key: 'step', body: { action: 'step', goal: 'map_segments' } });
    route({ key: 'card', body: { action: 'card', op: 'confirm', part: 'segment', value: 'Accelerator chips' } });
    route({ key: 'step', body: { action: 'step', goal: 'find_names' } });
    const a = route({ key: 'card', body: { action: 'card', op: 'set', part: 'names', value: ['NVDA', 'AMD'] } });
    expect(a.status).toBe(400);
    expect(a.body.message).toContain("your agent's pick (NVDA and AMD)");
    expect(a.body.message).toContain('Build it on AMD and AVGO');
    // and the walk did not move: the pick is still answered
    expect(route({ key: 'card', body: { action: 'card', op: 'confirm', part: 'names', value: ['NVDA', 'AMD'] } }).status).toBe(200);
  });
  it('own words other than the sample answer a line naming the sample, verbatim', () => {
    const route = walkRouteOf(W);
    const at = (body) => route({ key: body.action, body });
    at({ action: 'open', entry: { kind: 'observation', observation: 'I want to play AI' } });
    at({ action: 'step', goal: 'map_segments' });
    at({ action: 'card', op: 'confirm', part: 'segment', value: 'Accelerator chips' });
    at({ action: 'step', goal: 'find_names' });
    at({ action: 'card', op: 'set', part: 'names', value: ['AMD'] });
    at({ action: 'step', goal: 'build_why' });
    at({ action: 'card', op: 'confirm', part: 'why' });
    const a = at({ action: 'card', op: 'set', part: 'wrongIf', value: { text: 'AMD loses the big orders' } });
    expect(a.status).toBe(400);
    expect(a.body.message).toContain(`“${SAMPLE_WRONG_IF}”`);
  });
});

describe('the thesis builder\'s client fixtures are the server\'s answers (B4 Tests)', () => {
  it('thesisAnswers.json equals what B3\'s own functions compose today', () => {
    const fresh = JSON.parse(JSON.stringify(build()));
    if (process.env.GENERATE_SR_THESIS_FIXTURES === '1') writeFileSync(OUT, `${JSON.stringify(fresh, null, 2)}\n`);
    expect(JSON.parse(readFileSync(OUT, 'utf8'))).toEqual(fresh);
  });

  it('the walk holds what the rows rely on, state by state', () => {
    const A = build();
    const t = (k) => A[k].body.thesis;
    expect(A.walkOpen.body.session.shape).toBe('builder');
    // §B13 T-1 (moved from filled 1 and the theme set to the player's words): the open leaves the theme unset
    expect(t('walkOpen').filled).toBe(0);
    expect(t('walkOpen').parts.theme).toMatchObject({ state: 'unset', value: null, by: null, suggestion: null });
    expect(A.walkOpen.body.session.exchanges).toEqual([expect.objectContaining({ who: 'player', kind: 'observation', text: 'I want to play AI' })]);
    expect(t('walkOpen').choices.research.map((g) => g.goal)).toContain('map_segments');
    expect(t('walkMap').parts.segment.map).toHaveLength(4);
    expect(t('walkMap').pick).toMatchObject({ part: 'segment', value: 'Accelerator chips', asked: false, basis: 'reasoning' });
    // §B13 T-1/T-7: the recorded B5 map suggests a theme; confirming it or writing one's own is free
    expect(t('walkMap').parts.theme).toMatchObject({ state: 'suggested', value: null, suggestion: RECORDED('b5.map_segments').themeSuggestion });
    expect(t('walkThemeConfirm').parts.theme).toMatchObject({ state: 'set', value: RECORDED('b5.map_segments').themeSuggestion, by: 'partner_suggested_confirmed' });
    expect(t('walkThemeOwn').parts.theme).toMatchObject({ state: 'set', value: SAMPLE_THEME, by: 'player_wrote' });
    expect(A.walkThemeConfirm.body.session.stepsUsed).toBe(A.walkMap.body.session.stepsUsed);
    expect(t('walkTimeFrame').sentence).toMatch(/^Built on NVDA, through Accelerator chips, because /); // the linear walk leaves the theme suggested (T-2)
    expect(t('walkSegment').parts.segment).toMatchObject({ state: 'set', value: 'Accelerator chips', by: 'partner_suggested_confirmed' });
    expect(A.walkNames.body.companies.supported.map((c) => c.symbol)).toEqual(['NVDA', 'AMD', 'AVGO']);
    expect(A.walkNames.body.companies.leads.map((l) => l.name)).toContain('Orrin Compute');
    expect(t('walkNames').choices.free.find((c) => c.op === 'set' && c.part === 'names')).toMatchObject({ options: ['NVDA', 'AMD', 'AVGO'], min: 1, max: 4 });
    expect(t('walkNames').pick).toMatchObject({ part: 'names', value: ['NVDA', 'AMD'], asked: false });
    expect(t('walkOneStock').parts.names).toMatchObject({ state: 'set', value: ['NVDA'], by: 'player_chose' });
    expect(t('walkWhy').parts.why.state).toBe('suggested');
    expect(t('walkWhy').parts.why.proposal.incomplete).toEqual([]);
    expect(t('walkWhy').parts.timeFrame.state).toBe('suggested');
    expect(t('walkWhy').choices.free).toContainEqual({ op: 'confirm', part: 'why' });
    expect(t('walkConfirmWhy').parts.why).toMatchObject({ state: 'set', by: 'partner_suggested_confirmed' });
    expect(t('walkWrongIf').parts.wrongIf.state).toBe('set');
    expect(t('walkTimeFrame')).toMatchObject({ ready: true, filled: 5, saveIssue: null }); // §B13 T-1 (moved from 6): the theme is left suggested
    expect(typeof t('walkTimeFrame').sentence).toBe('string');
    expect(A.walkSaved.body).toMatchObject({ watchlistId: 'wl-thesis-1', version: 1, idempotent: false });
    expect(A.walkGetSaved.body.session.adoption.at).toBe('2026-11-17T14:09:00.000Z');
    // the exchanges: no player line for a research tap; the partner's carries its goal; a card tap leaves a `card` line (R-21)
    const exs = A.walkGetReady.body.session.exchanges;
    expect(exs.map((e) => `${e.who}:${e.kind}${e.goal ? `:${e.goal}` : ''}${e.card ? `:${e.card.op}:${e.card.part}` : ''}`)).toEqual([
      'player:observation', 'partner:step:map_segments', 'player:card:confirm:segment', 'partner:step:find_names', 'player:card:set:names',
      'partner:step:build_why', 'player:card:confirm:why', 'player:card:confirm:wrongIf', 'player:card:confirm:timeFrame',
    ]);
  });

  it('every other state holds what its rows rely on', () => {
    const A = build();
    const t = (k) => A[k].body.thesis;
    expect(A.stepFailed.body).toMatchObject({ error: 'step_failed', reason: 'invalid_unsupported_number' });
    expect(A.cardStale.body.thesis.rev).toBeGreaterThan(A.cards.afterOneStock.rev);
    expect(A.getOutOfSteps.body.thesis.choices.research).toEqual([]);
    expect(t('getOutOfSteps').choices.free.some((c) => c.part === 'wrongIf')).toBe(true);
    expect(t('walkPriceLine').parts.wrongIf.priceLines).toEqual([{ symbol: 'NVDA', level: 120 }]);
    expect(t('getSaveIssue')).toMatchObject({ ready: true, saveIssue: { code: 'names_not_supported', detail: { deselected: 'AMD' } } });
    expect(t('getTooManyRefs')).toMatchObject({ ready: true, saveIssue: { code: 'too_many_evidence_refs' } });
    expect(t('getTooManyRefs').saveIssue.detail).toBeGreaterThan(28);
    // the second round's sequences hold the revs their rows rely on (revs only grow; not_ready keeps the rev)
    expect(t('getStaleWhy')).toMatchObject({ rev: t('walkGetReady').rev, ready: false });
    expect(A.notReadyStaleWhy.body.blockers).toEqual([{ part: 'why', state: 'stale' }]);
    expect(t('clearStaleWhy').rev).toBe(t('getStaleWhy').rev + 1);
    expect(A.adoptStalePriced.body.thesis).toMatchObject({ rev: t('walkGetReady').rev + 1, ready: true });
    expect(t('walkPriceLineAgain')).toMatchObject({ rev: t('walkGetReady').rev + 2, ready: true });
    expect(A.timeFrameLanded.body.thesis.rev).toBe(t('walkGetSegment').rev + 1);
    expect(A.timeFrameLanded.body.thesis.parts.timeFrame).toMatchObject({ state: 'set', value: 'swing' });
    expect(t('clearTimeFrameAgain').rev).toBe(t('walkGetSegment').rev + 2);
    expect(t('swingAgain').parts.timeFrame).toMatchObject({ state: 'set', value: 'swing' });
    expect(t('oneStockTimeFrame').rev).toBe(t('walkOneStock').rev + 1);
    expect(A.namesTimeFrame.body.session.stepsUsed).toBe(A.walkGetSegment.body.session.stepsUsed + 1);
    expect(t('getNamesTimeFrameCleared').rev).toBe(t('namesTimeFrameCleared').rev);
    expect(t('getStaleSegment').parts.segment.state).toBe('stale');
    expect(t('getStaleSegment').ready).toBe(false);
    expect(t('getStaleSegment').blockers[0]).toEqual({ part: 'segment', state: 'stale' });
    expect(t('getStaleWhy').parts.why.state).toBe('stale');
    expect(t('getProposalCorrected').parts.why.proposal.incomplete).toEqual(['NVDA']);
    expect(t('getDeadEnd').parts.names.blocked).toBe('no_listed_company');
    expect(t('getDeadEnd').choices.free).toContainEqual({ op: 'clear', part: 'segment', clears: ['names', 'why'] });
    expect(t('getDeadEnd').choices.research.map((g) => g.goal)).not.toContain('find_names');
    expect(t('getGroupReady')).toMatchObject({ ready: true, filled: 5 }); // §B13 T-1 (moved from 6): the theme is left suggested
    expect(t('getGroupReady').parts.names.value).toEqual(['NVDA', 'AMD', 'AVGO']);
    expect(t('getGroupReady').parts.why.reasons.map((r) => r.symbol)).toEqual(['NVDA', 'AMD', 'AVGO']);
    expect(t('getIncompleteWhy').parts.why.proposal.incomplete).toEqual(['AMD']);
    expect(t('getIncompleteWhy').choices.free).toContainEqual({ op: 'set', part: 'names', value: ['NVDA'], reason: 'drop_unsourced', clears: [] });
    expect(t('pickAsked').pick).toMatchObject({ part: 'segment', asked: true });
    expect(t('pickAsked').pick.reasons.map((r) => r.basis)).toEqual(['source', 'reasoning', 'source']);
    expect(t('pickAsked').parts.segment.state).toBe('suggested');
    expect(t('revisedWhy').choices.free).toContainEqual({ op: 'confirm', part: 'why', revised: true });
    expect(t('revisedWhy').parts.why.state).toBe('set');
    expect(t('storyOpen').filled).toBe(0);
    expect(t('storyOpen').choices.research).toEqual([{ goal: 'verify_source' }, { goal: 'direction' }]);
    expect(t('storyVerified').parts.theme).toMatchObject({ state: 'suggested', suggestion: 'Cloud AI data-center spending' });
    expect(A.walkDirection.body.session.exchanges.map((e) => e.kind)).toEqual(['observation', 'direction', 'step']);
    // §B13 T-2: the sentence's four shapes, each ready
    const suggestion = RECORDED('b5.map_segments').themeSuggestion;
    expect(t('walkTimeFrame').sentence).toMatch(/^Built on NVDA, through Accelerator chips, because /);
    expect(t('getReadyThemed').sentence.startsWith(`My theme is ${suggestion}, through Accelerator chips, built on NVDA, because `)).toBe(true);
    expect(t('getReadySkipped').sentence).toMatch(/^Built on NVDA, because /);
    expect(t('getReadyThemedSkipped').sentence.startsWith(`My theme is ${SAMPLE_THEME}, built on NVDA, because `)).toBe(true);
    for (const k of ['walkTimeFrame', 'getReadyThemed', 'getReadySkipped', 'getReadyThemedSkipped']) expect(t(k), k).toMatchObject({ ready: true, saveIssue: null });
    expect(t('getReadySkipped').parts.wrongIf.by).toBe('player_wrote');
    // §B13 T-5: the asked time-frame pick replaced the why step's suggestion; the confirm carries the pick
    expect(t('walkWrongIf').parts.timeFrame.suggestion).toMatchObject({ value: 'positional' });
    // §B14 Q-1 (moved from suggestion: null): the asked pick lands as the suggestion too, and survives the next step
    expect(t('getTimeFramePicked').parts.timeFrame).toMatchObject({ state: 'suggested', suggestion: { value: 'longterm' } });
    expect(t('getTimeFrameAfterPick').pick).toBeNull();
    expect(t('getTimeFrameAfterPick').parts.timeFrame).toMatchObject({ state: 'suggested', suggestion: { value: 'longterm' } });
    expect(t('getTimeFrameAfterPick').choices.free).toContainEqual({ op: 'confirm', part: 'timeFrame', value: 'longterm' });
    expect(t('getTimeFramePicked').pick).toMatchObject({ part: 'timeFrame', value: 'longterm', asked: true });
    expect(t('getTimeFramePicked').choices.free).toContainEqual({ op: 'confirm', part: 'timeFrame', value: 'longterm' });
  });
});
