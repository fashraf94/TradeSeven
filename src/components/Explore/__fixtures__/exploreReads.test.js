// src/components/Explore/__fixtures__/exploreReads.test.js
//
// THE RESEARCH READ'S FIXTURES, made by the SERVER (Explore Build 1, build prompt K-16: "no hand-typed read
// answer"). Every `{ quota, items }` in exploreReads.json is composed here by B6a's own pure shaping —
// api/_utils/sharedResearch/explore.js (livePerStoryOf, lastPerStoryOf, exploreItemsOf) and session.js
// (openSessionOf, quotaViewOf, playerDayOf) — over sessions and records built the way the route leaves them (the
// B6a route test's `plant`). So the page's rows and the fixture preview render exactly the shapes the merged
// server answers with, and a server change that moves a shape reds this row.
//
// Regenerate (after a deliberate server change):
//   GENERATE_EXPLORE_FIXTURES=1 npx vitest run src/components/Explore/__fixtures__/exploreReads.test.js

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { livePerStoryOf, lastPerStoryOf, exploreItemsOf } from '../../../../api/_utils/sharedResearch/explore.js';
import { openSessionOf, quotaViewOf, playerDayOf } from '../../../../api/_utils/sharedResearch/session.js';
import { emptyCard } from '../../../../api/_utils/sharedResearch/thesis.js';
import { buildRecord, buildFinding, findingAppendPatch, FINDING_ID_PREFIX, researchWorkIdFor, manualFunnel, emptyTelemetry } from '../../../../api/_utils/researchRecords/model.js';
import { SAMPLE_AI, SAMPLE_TAP, SAMPLE_UTILITIES } from './stories';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, 'exploreReads.json');
const UID = 'u-explore-1';
const ET_DAY = '2026-11-21';
/** The sheet's own story-open session (SharedResearch __fixtures__ thesisAnswers.json storyOpen): the smoke walk's. */
export const WALK_SESSION_ID = '7d7d7d7d-0000-4000-8000-000000000001';

const uuid = (n) => `5e5e5e5e-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (minute) => new Date(Date.parse('2026-11-21T15:00:00.000Z') + minute * 60_000).toISOString();
const quota = (opened) => quotaViewOf({ ...playerDayOf(null, ET_DAY), investigationsOpened: opened });

/**
 * One session and its research record as the route leaves them (api/forge/shared-research.b6a.route.test.js `plant`):
 * the record's first finding is the story's coverage, citing `exploreStories`; a completed one carries its end.
 */
function plant({ n, sessionId = uuid(n), story, question, status = 'open', createdAt, updatedAt = createdAt, adoption = null, builder = true, thesis = null, stepsUsed = 0, extraFindings = 0 }) {
  const session = {
    ...openSessionOf({
      sessionId, userId: UID, requestId: `req-${n}`, attribution: { agentId: 'agent-1' },
      researchWorkId: researchWorkIdFor({ collection: 'sharedResearchSessions', id: sessionId }), nowIso: createdAt,
      entry: { kind: 'item', itemRef: { recordKind: 'exploreStories', recordId: story.id }, names: [], itemVersion: story.version }, exchanges: [],
    }),
    status, updatedAt, adoption, stepsUsed,
    ...(builder ? { shape: 'builder', thesis: thesis ?? emptyCard() } : {}),
  };
  const minted = buildRecord({
    researchWorkId: session.researchWorkId, userId: UID, origin: 'shared_research', host: { collection: 'sharedResearchSessions', id: sessionId }, createdAt,
    question, funnel: manualFunnel(), budget: null, telemetry: emptyTelemetry(),
  });
  let record = minted;
  const findings = [{
    kind: 'coverage', symbol: null, fact: story.title, source: { recordKind: 'exploreStories', recordId: story.id, label: `FantasyTimes · ${story.reporter.name} · ${story.reporter.beat}` },
    at: createdAt, asOf: null, status: 'unverified', statusReason: 'reporter_content',
  }, ...Array.from({ length: extraFindings }, (_, i) => ({
    kind: 'inference', symbol: null, fact: `A reasoned line ${i + 1}.`, source: { recordKind: 'exchange', recordId: uuid(700 + n), label: 'Inferred in this step' }, at: createdAt, asOf: null, status: 'unverified', statusReason: 'inference',
  }))];
  findings.forEach((raw, i) => {
    const f = buildFinding(raw, { findingId: `${FINDING_ID_PREFIX}${uuid(900 + n * 10 + i)}`, nowIso: createdAt });
    record = { ...record, ...findingAppendPatch(record, f, { nowIso: createdAt }) };
  });
  return { session, record };
}

/** The read's answer for a set of planted investigations, as store.js readExploreInvestigations shapes it. */
function readOf(planted, opened) {
  const sessions = planted.map((p) => p.session);
  const live = livePerStoryOf(sessions);
  const last = lastPerStoryOf(sessions);
  const records = new Map([...live.values()].map((s) => [s.sessionId, planted.find((p) => p.session.sessionId === s.sessionId).record]));
  return { quota: quota(opened), items: exploreItemsOf({ live, last, records }) };
}

const Q_AI = SAMPLE_AI.questions[0].text;
const Q_UTIL = SAMPLE_UTILITIES.questions[0].text;
const ONE_PART_SET = { ...emptyCard(), timeFrame: { state: 'set', by: 'player_chose', value: 'positional', suggestion: null } };
const SAVED = (n) => ({ watchlistId: `wl-${n}`, versionId: `v-${n}`, at: at(40 + n) });

export function composeReads() {
  return {
    none: readOf([], 0),
    // the AI story in progress: a builder, one part set, two steps used, three findings
    progress: readOf([plant({ n: 1, story: SAMPLE_AI, question: Q_AI, createdAt: at(1), updatedAt: at(9), thesis: ONE_PART_SET, stepsUsed: 2, extraFindings: 2 })], 1),
    // the same, as a ledger investigation: no card, so no count
    ledger: readOf([plant({ n: 2, story: SAMPLE_AI, question: Q_AI, createdAt: at(1), builder: false })], 1),
    // a saved thesis on the AI story
    saved: readOf([plant({ n: 3, story: SAMPLE_AI, question: Q_AI, status: 'completed', createdAt: at(1), updatedAt: at(30), adoption: SAVED(3) })], 1),
    // a concluded investigation on the AI story
    concluded: readOf([plant({ n: 4, story: SAMPLE_AI, question: Q_AI, status: 'completed', createdAt: at(1), updatedAt: at(25) })], 1),
    // the AI story: an earlier one concluded, a second one open (the open one decides the state)
    both: readOf([
      plant({ n: 5, story: SAMPLE_AI, question: Q_AI, status: 'completed', createdAt: at(1), updatedAt: at(5) }),
      plant({ n: 6, story: SAMPLE_AI, question: SAMPLE_AI.questions[1].text, createdAt: at(10), thesis: ONE_PART_SET, stepsUsed: 1 }),
    ], 2),
    // the day's limit: three opened today, the utilities story open
    limit: readOf([plant({ n: 7, story: SAMPLE_UTILITIES, question: Q_UTIL, createdAt: at(1) })], 3),
    // an open investigation whose story is no longer published (not among the stories read)
    gone: readOf([plant({ n: 8, story: { ...SAMPLE_TAP, id: 'sample-unpublished-1', title: 'A story taken down' }, question: 'Who keeps the fee?', createdAt: at(1) })], 1),
    // the smoke walk, after Work this idea: the sheet's own story-open session, opened just now
    walkAfterOpen: readOf([plant({ n: 9, sessionId: WALK_SESSION_ID, story: SAMPLE_AI, question: Q_AI, createdAt: at(2) })], 1),
  };
}

describe('exploreReads.json — composed by the server (K-16)', () => {
  it('matches the server\'s own shaping of its planted investigations', () => {
    const composed = JSON.parse(JSON.stringify(composeReads()));
    if (process.env.GENERATE_EXPLORE_FIXTURES === '1') writeFileSync(OUT, `${JSON.stringify(composed, null, 2)}\n`);
    expect(JSON.parse(readFileSync(OUT, 'utf8'))).toEqual(composed);
  });
  it('holds the states the page draws: open with a count, open without one (a ledger), saved, concluded, both, the limit', () => {
    const r = composeReads();
    expect(r.none).toEqual({ quota: expect.objectContaining({ investigationsToday: 0, perDay: 3 }), items: [] });
    expect(r.progress.items[0].open).toMatchObject({ filled: 1, parts: 6, stepsLeft: 8, findingsCount: 3, question: Q_AI });
    expect(r.ledger.items[0].open.filled).toBeNull();
    expect(r.saved.items[0]).toMatchObject({ open: null, last: { ended: 'saved', at: at(43) } });
    expect(r.concluded.items[0]).toMatchObject({ open: null, last: { ended: 'concluded', at: at(25) } });
    expect(r.both.items[0].open).not.toBeNull();
    expect(r.both.items[0].last).toMatchObject({ ended: 'concluded' });
    expect(r.limit.quota).toMatchObject({ investigationsToday: 3, perDay: 3 });
    expect(r.walkAfterOpen.items[0].open.sessionId).toBe(WALK_SESSION_ID);
  });
});
