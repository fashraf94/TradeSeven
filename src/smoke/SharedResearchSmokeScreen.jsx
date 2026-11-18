// src/smoke/SharedResearchSmokeScreen.jsx — SMOKE ONLY, NEVER MERGE.
//
// Shared Research B4 (build prompt "The smoke branch"; B2's loader, extended): the
// sheet as the hub mounts it — HubOverlayProvider → HubSheet → the body, the stack
// handed in. EVERY request the sheet makes is answered HERE from the committed
// fixtures — src/components/SharedResearch/__fixtures__/answers.json (B2: ledger
// investigations) and thesisAnswers.json (B4: the thesis builder), each the
// server's own compositions — so there is no production read, no write, and no
// model or provider call. The SignalDrop parse is a canned result marked SMOKE
// ONLY. Every other /api/ request answers 404.
//
//   ?srFixture=<scenario>   (index: the list)   &name=<agent name>   &delay=<ms per answer, default 900>
//
// THE BUILDER MODE reads 'on' for the builder scenarios ONLY, through the smoke
// commit's own reader change (builderMode.js reads window.__srSmokeBuilderOn, set
// here); the flag file's literal stays 'off', and the app beside this page reads
// 'off' as on the PR head.
//
// ?srFixture=walk plays the founder's walk from __fixtures__/thesisWalk.json (the phone
// round, P-8), loaded only for the walk: at each point the taps a person will try are
// answered — the agent's pick and any one to three names; each wrong-if option and the
// sample own words; each time frame — every answer the server's own composition, every
// path ending saved. Any other tap answers a line naming the taps this point answers.
//
// `phone` follows the window's width on every resize (P-1), as the hub's would.

import React, { useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '../contexts/ThemeContext';
import HubSheet from '../components/CommandCenter/HubSheet';
import { HubOverlayProvider, useHubOverlays } from '../components/CommandCenter/hub/HubOverlays';
import SharedResearchSheetBody from '../components/SharedResearch/SharedResearchSheetBody';
import { SR_COPY } from '../components/SharedResearch/sharedResearchCopy';
import A from '../components/SharedResearch/__fixtures__/answers.json';
import TA from '../components/SharedResearch/__fixtures__/thesisAnswers.json';
import { notInWalk, walkRouteOf } from '../components/SharedResearch/__fixtures__/walkRoute';

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

// ── the thesis builder (B4) ─────────────────────────────────────────────────────
const AI_STORY = TA.ids.story.story;
const aiStory = () => ({
  itemRef: { recordKind: 'fantasyTimesStories', recordId: AI_STORY.id }, headline: AI_STORY.headline, reporterName: AI_STORY.reporterName, beat: AI_STORY.reporterBeat,
  publishedAt: new Date(Date.now() - 3 * HOUR).toISOString(), context: 'SMOKE ONLY fixture story: cloud companies raise AI data-center budgets again.',
  question: 'Which companies earn from the development this story describes, and how directly?', reason: null,
});
const NOT_IN_WALK = notInWalk(['the next tap in the checklist']);

const builder = (title, get, routes = {}, extra = {}) => ({ title, builder: true, props: { mode: 'session', sessionId: get.body.session.sessionId }, routes: { get, ...routes }, ...extra });

/** Each scenario: the body's props, and the route answers (a list = one per call, the last repeating). */
const SCENARIOS = {
  walk: {
    title: 'THE WALK · "I want to play AI" → a saved thesis (type the words, then follow the checklist)', builder: true, walk: true,
    props: { mode: 'start', stories: [] },
    routes: { list: TA.listEmpty, close: NOT_IN_WALK, transition: OK, equip: OK },
  },
  'builder-map': builder('Builder · the segment map with the agent\'s pick (T2)', TA.walkGetMap, { card: TA.walkSegment, step: [TA.pickAsked] }),
  'builder-names': builder('Builder · the names to tick, a lead (T3)', TA.walkGetNames, { card: [TA.walkOneStock] }),
  'builder-why': builder('Builder · the why proposal, Confirm these reasons', TA.walkGetWhy, { card: TA.walkConfirmWhy }),
  'builder-midway': builder('Builder · mid-way, 4 of 6: the wrong-if (T4); tap a part (T4T)', TA.walkGetConfirmWhy, { card: TA.walkWrongIf, step: TA.walkDirection }),
  'builder-ready': builder('Builder · ready, one stock (T5)', TA.walkGetReady, { adopt: TA.walkSaved, card: TA.walkPriceLine, get: [TA.walkGetReady, TA.walkGetSaved] }),
  'builder-group': builder('Builder · ready, the group of three (T5G)', TA.getGroupReady),
  'builder-save-issue': builder('Builder · ready, but Save would be refused (saveIssue)', TA.getSaveIssue),
  'builder-saved': builder('Builder · saved, today (T6a)', TA.walkGetSaved, { transition: OK, equip: OK }),
  'builder-uncertain': builder('Builder · an interrupted save → Check the record → found', TA.walkGetReady, { adopt: NETWORK, get: [TA.walkGetReady, TA.walkGetSaved], transition: OK, equip: OK }),
  'builder-waiting': builder('Builder · a step that takes 20 s (T7)', TA.walkGetSegment, { step: TA.walkNames }, { delay: { step: 20000 } }),
  'builder-step-failed': builder('Builder · a failed step, Try again (T10b)', TA.walkGetSegment, { step: [TA.stepFailed, TA.walkNames] }),
  'builder-dead-end': builder('Builder · a dead end (T9)', TA.getDeadEnd, { close: TA.closeDeadEnd, card: TA.tryAnotherSegment }),
  'builder-out-of-steps': builder('Builder · out of steps (T10a)', TA.getOutOfSteps, { close: TA.closeDeadEnd }),
  'builder-stale-card': builder('Builder · a stale card: tap a time frame (409 card_stale)', TA.walkGetOneStock, { card: TA.cardStale }),
  'builder-stale-part': builder('Builder · a part out of date (the segment)', TA.getStaleSegment),
  'builder-pick-asked': builder('Builder · You pick, and tell me why: the reasons (T2b)', TA.getPickAsked),
  'builder-incomplete-why': builder('Builder · a why with an unsourced name, the drop', TA.getIncompleteWhy, { card: TA.dropUnsourced }),
  'builder-revised-why': builder('Builder · a revised why waiting beside the set one', TA.getRevisedWhy, { card: TA.useRevisedWhy }),
  'builder-story': {
    title: 'Builder · a story start → check it against its source (T8a, T8b)', builder: true,
    props: { mode: 'item', item: aiStory(), stories: [aiStory()] },
    routes: { list: TA.listEmpty, open: TA.storyOpen, step: TA.storyVerified, card: TA.storyConfirmTheme },
  },
  // ── B2's ledger scenarios, as B2 shipped them: an old investigation looks exactly as it does today ──
  start: { title: 'Ledger · Start · open work and five stories', props: { mode: 'start', stories: freshStories() }, routes: { list: A.list, frame: A.framed, open: A.openFramed, get: A.getShopPay } },
  'start-empty': { title: 'Ledger · Start · nothing open, no stories', props: { mode: 'start', stories: [] }, routes: { list: A.listEmpty, frame: A.framed, open: A.openFramed } },
  'start-stale': { title: 'Ledger · Start · stories older than 48 h', props: { mode: 'start', stories: staleStories() }, routes: { list: A.listEmpty } },
  'start-gated': { title: 'Ledger · Start · gated', props: { mode: 'start', stories: freshStories(), gated: true }, routes: { list: A.disabled } },
  'start-daily-limit': { title: 'Ledger · Start · daily limit reached', props: { mode: 'start', stories: freshStories() }, routes: { list: A.listDailyLimit } },
  'start-framing-limit': { title: 'Ledger · Start · framing limit reached', props: { mode: 'start', stories: freshStories() }, routes: { list: A.listFramingLimit } },
  story: { title: 'Ledger · A story · preview → opening', props: { mode: 'item', item: freshStories()[0], stories: freshStories() }, routes: { list: A.listEmpty, open: A.openStory } },
  'story-previous': { title: 'Ledger · A story investigated before · the earlier one', props: { mode: 'item', item: freshStories()[0], stories: freshStories() }, routes: { list: A.listEmpty, open: A.openStoryPrevious, get: ({ url }) => (url.includes(IDS.previousSid) ? A.getConcluded : A.getStory) } },
  'story-existing': { title: 'Ledger · A story already open · Continue', props: { mode: 'item', item: freshStories()[0], stories: freshStories() }, routes: { list: A.listEmpty, open: A.openDropExisting } },
  drop: { title: 'Ledger · A SignalDrop · paste → Investigate this', props: { mode: 'start', stories: freshStories() }, routes: { list: A.listEmpty, parse: 'parse', open: A.openDrop } },
  'drop-now': { title: 'Ledger · A SignalDrop · the modal at once', props: { mode: 'signaldrop', stories: freshStories() }, routes: { list: A.listEmpty, parse: 'parse', open: A.openDrop } },
  'own-words': { title: 'Ledger · Your own words · framing → opening', props: { mode: 'start', stories: freshStories() }, routes: { list: A.listEmpty, frame: A.framed, open: A.openFramed } },
  'own-words-failed': { title: 'Ledger · Your own words · framing failed, then Try again', props: { mode: 'start', stories: freshStories() }, routes: { list: A.listEmpty, frame: [A.frameFailed, A.framed], open: A.openFramed } },
  work: { title: 'Ledger · Work · an answer, a supported company and a lead', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getStepped, step: stepSame(A.getStepped), close: A.closeConcluded } },
  'work-running': { title: 'Ledger · Work · a step that takes 20 s (running only while it runs)', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getStepped, step: stepSame(A.getStepped) }, delay: { step: 20000 } },
  'was-running': { title: 'Ledger · Work · reopened while a step was in progress', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getWasRunning, step: A.stepRefreshSame } },
  stale: { title: 'Ledger · Work · the answer relies on a corrected fact', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getStale, step: stepSame(A.getStale) } },
  withheld: { title: 'Ledger · Work · next step: the answer withheld', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getStepped, step: A.stepWithheld } },
  replaced: { title: 'Ledger · Work · next step: the replaced reply', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getStepped, step: A.stepReplaced } },
  'step-failed': { title: 'Ledger · Work · the last step failed · Try again', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getStepFailed, step: A.stepNext } },
  'rate-limited': { title: 'Ledger · Work · next step: too many requests (wait 5 s)', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getStepped, step: [{ ...A.rateLimited, headers: { 'Retry-After': '5' } }, stepSame(A.getStepped)] } },
  spent: { title: 'Ledger · Work · the step budget used', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getSpent } },
  'no-next': { title: 'Ledger · Work · no next step proposed', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getNoNext } },
  aged: { title: 'Ledger · Work · an answer four days old · Refresh', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getAged, step: A.stepRefreshSame } },
  concluded: { title: 'Ledger · Work · concluded', props: { mode: 'session', sessionId: IDS.dcSid }, routes: { get: A.getConcluded } },
  companies: { title: 'Ledger · Companies · two supported', props: { mode: 'session', sessionId: IDS.spSid }, routes: { get: A.getShopPay, step: stepSame(A.getShopPay) } },
  adopt: { title: 'Ledger · Adopt · preview → Save → equip', props: { mode: 'session', sessionId: IDS.spSid }, routes: { get: [A.getShopPay, A.getShopPay, A.getShopPaySaved], adopt: A.adoptSaved, transition: OK, equip: OK } },
  'adopt-stale': { title: 'Ledger · Adopt · the investigation moved: preview_stale', props: { mode: 'session', sessionId: IDS.spSid }, routes: { get: A.getShopPay, adopt: [A.adoptStale, A.adoptSaved], transition: OK, equip: OK } },
  'adopt-uncertain': { title: 'Ledger · Adopt · interrupted save → Check the record → found', props: { mode: 'session', sessionId: IDS.spSid }, routes: { get: [A.getShopPay, A.getShopPay, A.getShopPaySaved], adopt: [NETWORK, A.adoptSaved], transition: OK, equip: OK } },
  'adopt-notsaved': { title: 'Ledger · Adopt · interrupted save → Check → nothing created', props: { mode: 'session', sessionId: IDS.spSid }, routes: { get: [A.getShopPay, A.getShopPay, A.getShopPay, A.getShopPaySaved], adopt: [NETWORK, A.adoptSaved], transition: OK, equip: OK } },
  'equip-failed': { title: 'Ledger · Adopt · saved, the equip fails', props: { mode: 'session', sessionId: IDS.spSid }, routes: { get: [A.getShopPay, A.getShopPay, A.getShopPaySaved], adopt: A.adoptSaved, transition: OK, equip: { status: 409, body: { error: 'league_locked', message: 'SMOKE ONLY — the League week holds this loadout.' } } } },
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
    if (typeof a === 'function') a = a({ url, body, n, key });
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
  // SMOKE ONLY: the page's `phone` follows the window's width on every resize (P-1)
  const [phone, setPhone] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setPhone(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
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
      <p style={{ margin: '0 0 12px', fontWeight: 700 }}>SMOKE ONLY · Shared Research B4 · fixtures answer every request; nothing is read or written</p>
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
  const [ready, setReady] = useState(!scenario?.walk);
  // SMOKE ONLY: the builder mode reads 'on' for this page's builder scenarios (builderMode.js on the smoke branch).
  window.__srSmokeBuilderOn = scenario?.builder === true;
  useMemo(() => { if (scenario && !scenario.walk) installRoutes(scenario); }, [scenario]);
  // the walk's tree loads only for the walk (it is large); its route answers open, step, card, adopt and get
  useEffect(() => {
    if (!scenario?.walk) return;
    import('../components/SharedResearch/__fixtures__/thesisWalk.json').then((m) => {
      const route = walkRouteOf(m.default ?? m);
      installRoutes({ ...scenario, routes: { ...scenario.routes, open: route, step: route, card: route, adopt: route, get: route } });
      setReady(true);
    });
  }, [scenario]);
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
      {!open || !scenario ? <Index current={scenario ? fixture : null} /> : !ready ? <p style={{ padding: 16, color: '#e8e8ef', background: '#0d1117', minHeight: '100vh', margin: 0 }}>SMOKE ONLY · loading the walk…</p> : (
        <HubOverlayProvider>
          <div style={{ minHeight: '100vh', background: '#0d1117' }} />
          <Sheet scenario={scenario} onClose={() => setOpen(false)} />
        </HubOverlayProvider>
      )}
    </ThemeProvider>
  );
}
