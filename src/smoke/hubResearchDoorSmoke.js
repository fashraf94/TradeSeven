// src/smoke/hubResearchDoorSmoke.js — SMOKE ONLY, NEVER MERGE.
//
// The hub research door's smoke (Command Center Amendment E V1.1 Part 2; the build prompt's "smoke branch"). The preview
// shares the production database, so nothing here reads or writes a real record of Shared Research:
//   - the client's mode is forced 'on' (hub/hubFlags.js sharedResearchMode() on this branch only); the SERVER's
//     SHARED_RESEARCH_MODE stays 'off', so any request that leaked past the answers below would get 404 `disabled`;
//   - the research reader answers SMOKE_RESEARCH_RECORDS (src/services/sharedResearchRecords.js on this branch);
//   - every Shared Research route request is answered here from the body's committed fixtures
//     (src/components/SharedResearch/__fixtures__/answers.json, the server's own compositions);
//   - the SignalDrop parse is answered by a canned result only while the research sheet is open (Discover stays real);
//   - the idea's ready transition and equip are answered here only when they name the fixture list (wl-fixture-1), so the
//     founder's real agent is never equipped with it.
// The stories reader is real (fetchFeed, read-only). Times are relative to the page's load so Activity's cutoff (the oldest
// of the last ten games) keeps the rows, and the hub's line agrees with the sheet's Continue row.

import A from '../components/SharedResearch/__fixtures__/answers.json';

const QP = new URLSearchParams(window.location.search);
const DELAY = Number.isFinite(Number(QP.get('delay'))) && QP.get('delay') !== null ? Number(QP.get('delay')) : 600;
const HOUR = 3600 * 1000;
const NOW = Date.now();
const IDS = A.ids;
const FIXTURE_LIST = 'wl-fixture-1';
const SHEET_LABEL = 'Shared Research · work an idea';

export const SMOKE_TIMES = Object.freeze({
  openCreated: new Date(NOW - 3 * HOUR).toISOString(),
  openLastTurn: new Date(NOW - 1 * HOUR).toISOString(),
  concludedCreated: new Date(NOW - 7 * HOUR).toISOString(),
  concludedEnded: new Date(NOW - 5 * HOUR).toISOString(),
});

const findings = (n) => Array.from({ length: n }, (_, i) => ({ findingId: `f_smoke_${i}` }));

/** The research reader's answer on the smoke: one open investigation and one concluded, as researchWork records. */
export const SMOKE_RESEARCH_RECORDS = Object.freeze([
  {
    id: `sr_${IDS.dcSid}`, origin: 'shared_research', state: 'open', host: { collection: 'sharedResearchSessions', id: IDS.dcSid },
    question: A.list.body.open[0].question, createdAt: SMOKE_TIMES.openCreated, endedAt: null, terminalReason: null,
    telemetry: { lastTurnAt: SMOKE_TIMES.openLastTurn }, findings: findings(A.list.body.open[0].findingsCount),
  },
  {
    id: `sr_${IDS.previousSid}`, origin: 'shared_research', state: 'completed', host: { collection: 'sharedResearchSessions', id: IDS.previousSid },
    question: A.getConcluded.body.record.question, createdAt: SMOKE_TIMES.concludedCreated, endedAt: SMOKE_TIMES.concludedEnded, terminalReason: 'concluded',
    telemetry: { lastTurnAt: SMOKE_TIMES.concludedEnded }, findings: findings(A.getConcluded.body.record.findings.length),
  },
]);

/** Five fixture stories for the `?hubResearchDoor=` page (the real hub reads the real feed). */
export function smokeStories() {
  const s = IDS.story;
  return [0, 1, 2, 3, 4].map((i) => ({
    itemRef: { recordKind: 'fantasyTimesStories', recordId: i === 0 ? s.id : `${s.id}-${i}` },
    headline: [s.headline, 'Utilities line up gas turbines for new data centers', 'Cooling suppliers name a year-long wait', 'Transformer makers add shifts as orders pile up', 'Chip demand cools while power gear stays tight'][i],
    reporterName: ['Doug', 'Kim', 'Vera', 'Alex', 'Kai'][i],
    beat: ['Earnings Analyst', 'Sector Strategist', 'Thematic & Industry Research', 'Stock Spotlight', 'Economics Desk'][i],
    publishedAt: new Date(NOW - (i + 1) * 2 * HOUR).toISOString(),
    context: 'SMOKE ONLY fixture story: builders say switchgear lead times now set the pace.',
    question: ["What changed in this company's business, and does it reach its suppliers, customers or competitors?", 'Which companies earn from the development this story describes, and how directly?', 'What changed here, who does it reach, and which company earns from it?', 'What business development, if any, is behind this move, and who else does it touch?', 'Which businesses does this economic development reach, and through what?'][i],
    reason: null,
  }));
}

// The fixtures' own answers, with the open investigation's times moved to the smoke's (the hub line and the sheet agree).
const withTimes = (answer) => ({ ...answer, body: { ...answer.body, record: answer.body.record ? { ...answer.body.record, lastTurnAt: SMOKE_TIMES.openLastTurn } : answer.body.record } });
const LIST = { ...A.list, body: { ...A.list.body, open: A.list.body.open.map((row) => ({ ...row, lastTurnAt: SMOKE_TIMES.openLastTurn })) } };
const OK = { status: 200, body: { ok: true } };
const PARSE = (dropId) => ({ status: 200, body: { ...A.parseDrop, dropId, parse: { ...A.parseDrop.parse, extractedText: 'SMOKE ONLY — a canned parse; no model was called.' } } });

function answerFor(url, method, body) {
  if (url.includes('/api/forge/shared-research')) {
    if (method === 'GET') {
      if (url.includes('list=open')) return LIST;
      if (url.includes(IDS.previousSid)) return A.getConcluded;
      return withTimes(A.getShopPay);
    }
    switch (body?.action) {
      case 'frame': return A.framed;
      case 'open': return body?.entry?.kind === 'signaldrop' ? A.openDrop : body?.entry?.kind === 'item' ? A.openStory : A.openFramed;
      case 'step': return { status: 200, body: { ...withTimes(A.getShopPay).body, changed: { summary: false, findings: 0, summaryWithheld: false } } };
      case 'close': return A.closeConcluded;
      case 'adopt': return A.adoptSaved;
      default: return { status: 404, body: { error: 'not_found', message: 'SMOKE ONLY — this action is not answered here.' } };
    }
  }
  return null;
}

/** Installs the smoke's answers over window.fetch. Everything it does not name goes to the real network. */
export function installResearchSmokeRoutes() {
  const realFetch = window.fetch.bind(window);
  const reply = (a) => new Response(JSON.stringify(a.body), { status: a.status, headers: { 'Content-Type': 'application/json', ...(a.headers ?? {}) } });
  const sheetOpen = () => Boolean(document.querySelector(`[role="dialog"][aria-label="${SHEET_LABEL}"]`));
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method ?? (typeof input === 'string' ? 'GET' : input.method) ?? 'GET').toUpperCase();
    let body = null;
    try { body = init.body ? JSON.parse(init.body) : null; } catch { body = null; }
    let answer = answerFor(url, method, body);
    if (!answer && url.includes('/api/forge/parse-signal') && sheetOpen()) answer = PARSE(body?.dropId);
    if (!answer && url.includes(`/watchlists/${FIXTURE_LIST}/hypothesis-transition`)) answer = OK;
    if (!answer && url.includes('/api/agent/equip-watchlist') && body?.watchlistId === FIXTURE_LIST) answer = OK;
    if (!answer) return realFetch(input, init);
    await new Promise((r) => setTimeout(r, DELAY));
    return reply(answer);
  };
}
