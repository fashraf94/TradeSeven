// src/smoke/SharedResearchSmokeScreen.jsx — SMOKE ONLY, NEVER MERGE.
//
// Shared Research B2 (build prompt "The smoke branch"): the sheet as the hub
// amendment will mount it — HubOverlayProvider → HubSheet → the body, the stack
// handed in — with no hub door yet (SQ-2). EVERY request the sheet makes is
// answered HERE from the committed fixtures (src/components/SharedResearch/
// __fixtures__/answers.json — the server's own compositions over B1's fixture
// records and the one recorded step): no production read, no write, no model or
// provider call. The SignalDrop parse is answered by a canned result marked
// SMOKE ONLY. Every other /api/ request answers 404.
//
//   ?srFixture=<scenario>   (index: the list)   &name=<agent name>   &delay=<ms per answer, default 900>
//
// The hub's props are smoke values: five stories, the agent "Atlas", agentId
// 'agent-smoke-1', the equipped list "Momentum Basket".

import React, { useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '../contexts/ThemeContext';
import HubSheet from '../components/CommandCenter/HubSheet';
import { HubOverlayProvider, useHubOverlays } from '../components/CommandCenter/hub/HubOverlays';
import SharedResearchSheetBody from '../components/SharedResearch/SharedResearchSheetBody';
import { SR_COPY } from '../components/SharedResearch/sharedResearchCopy';
import A from '../components/SharedResearch/__fixtures__/answers.json';

const QP = new URLSearchParams(window.location.search);
const DELAY = Number.isFinite(Number(QP.get('delay'))) && QP.get('delay') !== null ? Number(QP.get('delay')) : 900;
const NETWORK = 'network';
const HOLD = 'hold';
const IDS = A.ids;
const HOUR = 3600 * 1000;

const storyAt = (i, at) => ({
  itemRef: { recordKind: 'fantasyTimesStories', recordId: i === 0 ? IDS.story.id : `${IDS.story.id}-${i}` },
  headline: [IDS.story.headline, 'Utilities line up gas turbines for new data centers', 'Cooling suppliers name a year-long wait', 'Transformer makers add shifts as orders pile up', 'Chip demand cools while power gear stays tight'][i],
  reporterName: ['Doug', 'Kim', 'Vera', 'Alex', 'Kai'][i], beat: ['Earnings Analyst', 'Sector Strategist', 'Thematic & Industry Research', 'Stock Spotlight', 'Market Pulse'][i],
  publishedAt: at(i), context: 'SMOKE ONLY fixture story: builders say switchgear lead times now set the pace.',
  question: ["What changed in this company's business, and does it reach its suppliers, customers or competitors?", 'Which companies earn from the development this story describes, and how directly?', 'What changed here, who does it reach, and which company earns from it?', 'What business development, if any, is behind this move, and who else does it touch?', 'What changed in the market this story describes, and which businesses does it reach?'][i],
  reason: i === 0 ? null : 'Chosen because you want to explore power equipment',
});
const freshStories = () => [0, 1, 2, 3, 4].map((i) => storyAt(i, (k) => new Date(Date.now() - (k + 1) * 2 * HOUR).toISOString()));
const staleStories = () => [0, 1, 2, 3, 4].map((i) => storyAt(i, (k) => new Date(Date.now() - (k + 3) * 24 * HOUR).toISOString()));
const PARSE = (dropId) => ({ ...A.parseDrop, dropId, parse: { ...A.parseDrop.parse, extractedText: 'SMOKE ONLY — a canned parse; no model was called.' } });
const stepSame = (get) => ({ status: 200, body: { ...get.body, changed: { summary: false, findings: 0, summaryWithheld: false } } });
const OK = { status: 200, body: { ok: true } };

/** Each scenario: the body's props, and the route answers (a list = one per call, the last repeating). */
const SCENARIOS = {
  start: { title: 'Start · open work and five stories', props: { mode: 'start', stories: freshStories() }, routes: { list: A.list, frame: A.framed, open: A.openFramed, get: A.getShopPay } },
  'start-empty': { title: 'Start · nothing open, no stories', props: { mode: 'start', stories: [] }, routes: { list: A.listEmpty, frame: A.framed, open: A.openFramed } },
  'start-stale': { title: 'Start · stories older than 48 h', props: { mode: 'start', stories: staleStories() }, routes: { list: A.listEmpty } },
  'start-gated': { title: 'Start · gated', props: { mode: 'start', stories: freshStories(), gated: true }, routes: { list: A.disabled } },
  'start-daily-limit': { title: 'Start · daily limit reached', props: { mode: 'start', stories: freshStories() }, routes: { list: A.listDailyLimit } },
  'start-framing-limit': { title: 'Start · framing limit reached', props: { mode: 'start', stories: freshStories() }, routes: { list: A.listFramingLimit } },
  story: { title: 'A story · preview → opening', props: { mode: 'item', item: freshStories()[0], stories: freshStories() }, routes: { list: A.listEmpty, open: A.openStory } },
  'story-previous': { title: 'A story investigated before · the earlier one', props: { mode: 'item', item: freshStories()[0], stories: freshStories() }, routes: { list: A.listEmpty, open: A.openStoryPrevious, get: ({ url }) => (url.includes(IDS.previousSid) ? A.getConcluded : A.getStory) } },
  'story-existing': { title: 'A story already open · Continue', props: { mode: 'item', item: freshStories()[0], stories: freshStories() }, routes: { list: A.listEmpty, open: A.openDropExisting } },
  drop: { title: 'A SignalDrop · paste → Investigate this', props: { mode: 'start', stories: freshStories() }, routes: { list: A.listEmpty, parse: 'parse', open: A.openDrop } },
  'drop-now': { title: 'A SignalDrop · the modal at once', props: { mode: 'signaldrop', stories: freshStories() }, routes: { list: A.listEmpty, parse: 'parse', open: A.openDrop } },
  'own-words': { title: 'Your own words · framing → opening', props: { mode: 'start', stories: freshStories() }, routes: { list: A.listEmpty, frame: A.framed, open: A.openFramed } },
  'own-words-failed': { title: 'Your own words · framing failed, then Try again', props: { mode: 'start', stories: freshStories() }, routes: { list: A.listEmpty, frame: [A.frameFailed, A.framed], open: A.openFramed } },
  work: { title: 'Work · an answer, a supported company and a lead', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getStepped, step: stepSame(A.getStepped), close: A.closeConcluded } },
  'work-running': { title: 'Work · a step that takes 20 s (running only while it runs)', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getStepped, step: stepSame(A.getStepped) }, delay: { step: 20000 } },
  'was-running': { title: 'Work · reopened while a step was in progress', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getWasRunning, step: A.stepRefreshSame } },
  stale: { title: 'Work · the answer relies on a corrected fact', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getStale, step: stepSame(A.getStale) } },
  withheld: { title: 'Work · next step: the answer withheld', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getStepped, step: A.stepWithheld } },
  replaced: { title: 'Work · next step: the replaced reply', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getStepped, step: A.stepReplaced } },
  'step-failed': { title: 'Work · the last step failed · Try again', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getStepFailed, step: A.stepNext } },
  'rate-limited': { title: 'Work · next step: too many requests (wait 5 s)', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getStepped, step: [{ ...A.rateLimited, headers: { 'Retry-After': '5' } }, stepSame(A.getStepped)] } },
  spent: { title: 'Work · the step budget used', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getSpent } },
  'no-next': { title: 'Work · no next step proposed', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getNoNext } },
  aged: { title: 'Work · an answer four days old · Refresh', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getAged, step: A.stepRefreshSame } },
  concluded: { title: 'Work · concluded', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getConcluded } },
  companies: { title: 'Companies · two supported', props: { mode: 'session', sessionId: IDS.spSid }, routes: { get: A.getShopPay, step: stepSame(A.getShopPay) } },
  adopt: { title: 'Adopt · preview → Save → equip', props: { mode: 'session', sessionId: IDS.spSid }, routes: { get: [A.getShopPay, A.getShopPay, A.getShopPaySaved], adopt: A.adoptSaved, transition: OK, equip: OK } },
  'adopt-stale': { title: 'Adopt · the investigation moved: preview_stale', props: { mode: 'session', sessionId: IDS.spSid }, routes: { get: A.getShopPay, adopt: [A.adoptStale, A.adoptSaved], transition: OK, equip: OK } },
  'adopt-uncertain': { title: 'Adopt · interrupted save → Check the record → found', props: { mode: 'session', sessionId: IDS.spSid }, routes: { get: [A.getShopPay, A.getShopPay, A.getShopPaySaved], adopt: [NETWORK, A.adoptSaved], transition: OK, equip: OK } },
  'adopt-notsaved': { title: 'Adopt · interrupted save → Check → nothing created', props: { mode: 'session', sessionId: IDS.spSid }, routes: { get: [A.getShopPay, A.getShopPay, A.getShopPay, A.getShopPaySaved], adopt: [NETWORK, A.adoptSaved], transition: OK, equip: OK } },
  'equip-failed': { title: 'Adopt · saved, the equip fails', props: { mode: 'session', sessionId: IDS.spSid }, routes: { get: [A.getShopPay, A.getShopPay, A.getShopPaySaved], adopt: A.adoptSaved, transition: OK, equip: { status: 409, body: { error: 'league_locked', message: 'SMOKE ONLY — the League week holds this loadout.' } } } },
};

/** The smoke's fake route: window.fetch answers every request the sheet makes. */
function installRoutes(scenario) {
  const routes = scenario.routes ?? {};
  const count = {};
  const realFetch = window.fetch.bind(window);
  const reply = (a, extraHeaders = {}) => new Response(JSON.stringify(a.body), { status: a.status, headers: { 'Content-Type': 'application/json', ...(a.headers ?? {}), ...extraHeaders } });
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.includes('/api/')) return realFetch(input, init);
    const body = init.body ? JSON.parse(init.body) : null;
    let key = null;
    if (url.includes('/api/forge/parse-signal')) key = 'parse';
    else if (url.includes('/api/forge/shared-research')) key = (init.method ?? 'GET') === 'GET' ? (url.includes('list=open') ? 'list' : 'get') : body?.action;
    else if (url.includes('/hypothesis-transition')) key = 'transition';
    else if (url.includes('/api/agent/equip-watchlist')) key = 'equip';
    const route = key ? routes[key] : undefined;
    const n = (count[key] = (count[key] ?? 0) + 1);
    let a = Array.isArray(route) ? route[Math.min(n, route.length) - 1] : route;
    if (typeof a === 'function') a = a({ url, body, n });
    if (a === 'parse') a = { status: 200, body: PARSE(body?.dropId) };
    await new Promise((r) => setTimeout(r, scenario.delay?.[key] ?? DELAY));
    if (a === NETWORK) throw new TypeError('SMOKE ONLY — the connection was dropped on purpose');
    if (a === HOLD) return new Promise(() => {});
    if (!a) return reply({ status: 404, body: { error: 'not_found', message: 'SMOKE ONLY — this route is not answered here.' } });
    return reply(a);
  };
}

function Sheet({ scenario, onClose }) {
  const stack = useHubOverlays();
  const phone = typeof window !== 'undefined' && window.innerWidth < 768;
  return (
    <HubSheet title={SR_COPY.title} eyebrow={SR_COPY.eyebrow} label={SR_COPY.label} phone={phone} width={720} onClose={onClose} reducedMotion={window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true}>
      <SharedResearchSheetBody
        stories={freshStories()} agentName={QP.get('name') ?? 'Atlas'} agentId="agent-smoke-1" equippedListLabel="Momentum Basket" phone={phone}
        {...scenario.props} onClose={onClose} overlayStack={stack}
      />
    </HubSheet>
  );
}

function Index({ current }) {
  return (
    <div style={{ padding: 16, fontFamily: 'Inter, system-ui, sans-serif', color: '#e8e8ef', background: '#0d1117', minHeight: '100vh', boxSizing: 'border-box' }}>
      <p style={{ margin: '0 0 12px', fontWeight: 700 }}>SMOKE ONLY · Shared Research B2 · fixtures answer every request; nothing is read or written</p>
      {current && <p style={{ margin: '0 0 12px' }}>Closed: {SCENARIOS[current]?.title}. <a href={window.location.href} style={{ color: '#5eead4' }}>Open it again</a></p>}
      <ul style={{ margin: 0, padding: '0 0 0 18px', lineHeight: 1.9 }}>
        {Object.entries(SCENARIOS).map(([k, s]) => <li key={k}><a href={`?srFixture=${k}`} style={{ color: '#5eead4' }}>{k}</a> — {s.title}</li>)}
      </ul>
    </div>
  );
}

export default function SharedResearchSmokeScreen({ fixture }) {
  const scenario = SCENARIOS[fixture] ?? null;
  const [open, setOpen] = useState(Boolean(scenario));
  useMemo(() => { if (scenario) installRoutes(scenario); }, [scenario]);
  useEffect(() => {
    // The smoke's own mark: a label above everything that takes no input.
    const mark = document.createElement('div');
    mark.textContent = `SMOKE ONLY · fixtures · ${fixture}`;
    Object.assign(mark.style, { position: 'fixed', left: '8px', bottom: '6px', zIndex: '1003', pointerEvents: 'none', font: '600 11px system-ui, sans-serif', color: '#f0c75e', background: 'rgba(13,17,23,0.85)', padding: '2px 6px', borderRadius: '6px' });
    document.body.appendChild(mark);
    return () => mark.remove();
  }, [fixture]);
  return (
    <ThemeProvider>
      {!open || !scenario ? <Index current={scenario ? fixture : null} /> : (
        <HubOverlayProvider>
          <div style={{ minHeight: '100vh', background: '#0d1117' }} />
          <Sheet scenario={scenario} onClose={() => setOpen(false)} />
        </HubOverlayProvider>
      )}
    </ThemeProvider>
  );
}
