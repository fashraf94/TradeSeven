// src/smoke/ExploreSmokeScreen.jsx — SMOKE ONLY, NEVER MERGE.
//
// Explore Build 1 (build prompt "The smoke branch"): the REAL Search page with Explore on, as the app mounts it (the
// sidebar beside it on a wide screen, the bottom nav under it on a phone), on committed fixtures only:
//   - the stories and the bookmarks: the three labelled sample stories (src/components/Explore/__fixtures__/stories.js)
//     handed in through ExploreSourcesContext; bookmarks are kept in memory for the page's life;
//   - the research read (GET /api/forge/shared-research?list=explore): the scene's answer from exploreReads.json,
//     every one composed by the server's own shaping;
//   - the Work an idea sheet: the REAL body (loaded through Explore's own door), every request it makes answered from
//     the sheet's own committed fixtures (SharedResearch/__fixtures__/thesisAnswers.json: its story-open answers).
// Nothing on this page reaches the research server, and no model or provider is called (the SignalDrop parse and any
// tap outside the walk answer a SMOKE line). Other /api/ requests (the old tabs' own market reads) go to the network
// as they would in the app.
//
// THE SWITCH reads 'on' on this page ONLY, through the smoke commit's own reader change (exploreFlags.js reads
// window.__exploreSmokeOn, set here); the flag file's literal stays 'off', and the PR head has no such read.
//
// THE WALK (?exploreFixture=walk) — two smoke-only substitutions, said plainly: the sheet's committed story-open
// answers were composed for a FantasyTimes story with its beat question, so this page puts the story and the question
// the page actually SENT in their place (the answer's session item and record question), and puts the same question
// into the read's open investigation after the close. Every other field is the fixture's, untouched. The read after
// the close follows the walk: opened → walkAfterOpen, a step → walkAfterStep, a part set → walkAfterPart.
//
//   ?exploreFixture=<scene>   (index: the list)   &delay=<ms per answer, default 400>

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ThemeProvider } from '../contexts/ThemeContext';
import SearchDiscover from '../components/Search/SearchDiscover';
import BottomNav from '../components/Navigation/BottomNav';
import DesktopSidebar from '../components/Navigation/DesktopSidebar';
import { ExploreSourcesContext } from '../components/Explore/exploreSources';
import { SAMPLE_STORIES } from '../components/Explore/__fixtures__/stories';
import READS from '../components/Explore/__fixtures__/exploreReads.json';
import TA from '../components/SharedResearch/__fixtures__/thesisAnswers.json';

const QP = new URLSearchParams(window.location.search);
const DELAY = Number.isFinite(Number(QP.get('delay'))) && QP.get('delay') !== null ? Number(QP.get('delay')) : 400;
const USER = Object.freeze({ uid: 'smoke-explore-1', username: 'Smoke', wins: 0, losses: 0 });
const AI_ID = 'sample-ai-buildout';
const GATED = { status: 404, body: { error: 'disabled' } };
const FAILED = { status: 503, body: { error: 'unavailable', message: 'SMOKE ONLY — the read failed on purpose.' } };
const SMOKE_LINE = (what) => ({ status: 400, body: { error: 'smoke_not_in_walk', message: `SMOKE ONLY — ${what}` } });

/** The scenes: the read's answer, the stories, the bookmarks, and the story opened on arrival. */
const SCENES = {
  home: { title: 'Home · three sample stories, nothing in progress', read: READS.none },
  'home-progress': { title: 'Home · the AI-buildout story in progress', read: READS.progress },
  'home-finished': { title: 'Home · a thesis saved on the AI-buildout story', read: READS.saved, bookmarks: ['sample-tap-to-pay'] },
  story: { title: 'Story · the AI-buildout story, nothing started', read: READS.none, open: AI_ID },
  'story-progress': { title: 'Story · in progress (Continue research)', read: READS.progress, open: AI_ID },
  'story-finished': { title: 'Story · a thesis saved (View it), and a new one may start', read: READS.saved, open: AI_ID },
  gated: { title: 'No access · reading and saving only', read: GATED, open: AI_ID },
  limit: { title: "The day's limit · three used", read: READS.limit, open: AI_ID },
  'read-failed': { title: "The research read failed · Couldn't check your research", read: FAILED, open: AI_ID },
  empty: { title: 'No stories to explore yet', read: READS.none, stories: [] },
  walk: { title: 'THE WALK · read → choose → edit → Work this idea → the real sheet → close → Continue research', walk: true },
};

const clone = (x) => JSON.parse(JSON.stringify(x));
/** SMOKE substitution: the sheet's story answer, naming the story and the question this page sent. */
function asSent(answer, sent) {
  const a = clone(answer);
  if (a.body?.session?.entry) a.body.session.entry = { ...a.body.session.entry, itemRef: sent.itemRef };
  if (a.body?.record && sent.question) a.body.record.question = sent.question;
  return a;
}

/** The fake route: window.fetch answers the research route; everything else under /api/ goes to the network. */
function installRoutes(scene) {
  const realFetch = window.fetch.bind(window);
  const walk = { stage: 'none', sent: null };
  const reply = (a) => new Response(JSON.stringify(a.body), { status: a.status, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.includes('/api/forge/shared-research') && !url.includes('/api/forge/parse-signal')) return realFetch(input, init);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    await new Promise((r) => { setTimeout(r, DELAY); });
    if (url.includes('/api/forge/parse-signal')) return reply(SMOKE_LINE('the SignalDrop parse is not answered on this page.'));
    if (method === 'GET' && url.includes('list=explore')) {
      if (!scene.walk) return reply(scene.read.status ? scene.read : { status: 200, body: scene.read });
      const read = { none: READS.none, opened: READS.walkAfterOpen, stepped: READS.walkAfterStep, part: READS.walkAfterPart }[walk.stage];
      const out = clone(read);
      if (out.items[0]?.open && walk.sent) out.items[0].open.question = walk.sent.question;
      return reply({ status: 200, body: out });
    }
    if (method === 'GET' && url.includes('list=open')) return reply(TA.listEmpty);
    if (!scene.walk) return reply(SMOKE_LINE('the sheet is played in ?exploreFixture=walk.'));
    if (method === 'GET') {
      if (!walk.sent) return reply(SMOKE_LINE('start with Work this idea.'));
      return reply(asSent({ none: TA.getStoryOpen, opened: TA.getStoryOpen, stepped: TA.getStoryVerified, part: TA.getStoryVerified }[walk.stage], walk.sent));
    }
    if (body?.action === 'open' && body.entry?.kind === 'item' && body.entry.itemRef?.recordKind === 'exploreStories') {
      walk.sent = { itemRef: body.entry.itemRef, question: body.entry.question };
      if (walk.stage === 'none') walk.stage = 'opened';
      return reply(asSent(TA.storyOpen, walk.sent));
    }
    if (body?.action === 'step' && walk.sent) { walk.stage = 'stepped'; return reply(asSent(TA.storyVerified, walk.sent)); }
    if (body?.action === 'card' && walk.sent) { walk.stage = 'part'; return reply(asSent(TA.storyConfirmTheme, walk.sent)); }
    return reply(SMOKE_LINE('that tap is not in this walk: check the story against its source, then confirm the theme.'));
  };
}

/** In-memory fixture sources: the scene's stories, and bookmarks kept for the page's life. */
function smokeSources(scene) {
  const stories = scene.stories ?? SAMPLE_STORIES;
  let bookmarks = (scene.bookmarks ?? []).map((id) => {
    const s = SAMPLE_STORIES.find((x) => x.id === id);
    return { storyId: s.id, storyVersion: s.version, title: s.title, savedAt: new Date().toISOString() };
  });
  const later = (v) => new Promise((r) => { setTimeout(() => r(v), DELAY); });
  return {
    readStories: () => later(stories),
    readBookmarks: () => later(bookmarks.map((b) => ({ ...b }))),
    saveBookmark: (_uid, story) => {
      const b = { storyId: story.id, storyVersion: story.version, title: story.title, savedAt: new Date().toISOString() };
      bookmarks = [b, ...bookmarks.filter((x) => x.storyId !== story.id)];
      return later(b);
    },
    removeBookmark: (_uid, storyId) => { bookmarks = bookmarks.filter((x) => x.storyId !== storyId); return later(undefined); },
  };
}

function Index() {
  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', color: 'var(--ft-ink)', background: 'var(--ft-bg-app)', minHeight: '100vh', boxSizing: 'border-box' }}>
      <p style={{ margin: '0 0 12px', fontWeight: 700 }}>SMOKE ONLY · Explore Build 1 · sample stories; every research read answered from fixtures</p>
      <ul style={{ margin: 0, padding: '0 0 0 18px', lineHeight: 2 }}>
        {Object.entries(SCENES).map(([k, s]) => <li key={k}><a href={`?exploreFixture=${k}`} style={{ color: 'var(--ft-teal)' }}>{k}</a> — {s.title}</li>)}
      </ul>
    </div>
  );
}

function Page({ scene }) {
  const sources = useMemo(() => smokeSources(scene), [scene]);
  const [width, setWidth] = useState(() => window.innerWidth);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const on = () => setWidth(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const isMobile = width <= 768;
  // SMOKE ONLY: a scene that starts on a story taps its card once it is drawn
  const opened = useRef(false);
  useEffect(() => {
    if (!scene.open) return undefined;
    const t = setInterval(() => {
      const b = document.querySelector(`[data-explore-card="${scene.open}"] [data-explore-card-read]`) ?? document.querySelector(`[data-explore-card="${scene.open}"] [data-explore-card-primary]`);
      if (b && !opened.current) { opened.current = true; b.click(); clearInterval(t); }
    }, 50);
    return () => clearInterval(t);
  }, [scene]);
  return (
    <ExploreSourcesContext.Provider value={sources}>
      <div style={{ background: 'var(--ft-bg-app)', minHeight: '100vh' }}>
        <div style={{ marginLeft: isMobile ? 0 : (collapsed ? '64px' : '220px') }}>
          <SearchDiscover user={USER} isMobile={isMobile} isDesktop={!isMobile} setScreen={() => {}} stocksData={[]} sidebarCollapsed={collapsed} />
        </div>
        {isMobile
          ? <BottomNav screen="search" setScreen={() => {}} setShowForge={() => {}} showForge={false} />
          : <DesktopSidebar screen="search" setScreen={() => {}} setShowForge={() => {}} showForge={false} user={USER} unreadCount={0} collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} onLogout={() => {}} />}
      </div>
    </ExploreSourcesContext.Provider>
  );
}

export default function ExploreSmokeScreen({ fixture }) {
  const scene = SCENES[fixture] ?? null;
  // SMOKE ONLY: the switch reads 'on' on this page (exploreFlags.js on the smoke branch), before anything renders.
  window.__exploreSmokeOn = Boolean(scene);
  useMemo(() => { if (scene) installRoutes(scene); }, [scene]);
  useEffect(() => {
    const mark = document.createElement('div');
    mark.textContent = `SMOKE ONLY · sample stories · ${fixture}`;
    Object.assign(mark.style, { position: 'fixed', right: '8px', top: '6px', zIndex: '1003', pointerEvents: 'none', font: '600 11px system-ui, sans-serif', color: 'var(--ft-gold)', background: 'rgba(13,17,23,0.85)', padding: '2px 6px', borderRadius: '6px' });
    document.body.appendChild(mark);
    return () => mark.remove();
  }, [fixture]);
  return <ThemeProvider>{scene ? <Page scene={scene} /> : <Index />}</ThemeProvider>;
}
