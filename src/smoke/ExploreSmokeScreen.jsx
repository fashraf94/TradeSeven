// src/smoke/ExploreSmokeScreen.jsx — SMOKE ONLY, NEVER MERGE.
//
// Explore Build 2 (build prompt "The smoke branch"): the REAL Search page with Explore on, as the app mounts it (the
// sidebar beside it on a wide screen, the bottom nav under it on a phone), on committed fixtures only:
//   - the stories and the bookmarks: the content chat's two pilot records as published (src/components/Explore/
//     __fixtures__/pilot/, word for word) and the three labelled sample stories, handed in through
//     ExploreSourcesContext; bookmarks are kept in memory for the page's life;
//   - the research read (GET /api/forge/shared-research?list=explore): the scene's answer from exploreReads.json,
//     every one composed by the server's own shaping (its `agent` included);
//   - the Work an idea sheet: the REAL body (loaded through Explore's own door), every request it makes answered from
//     the sheet's own committed fixtures (SharedResearch/__fixtures__/thesisAnswers.json: its story-open answers).
// Nothing on this page reaches the research server, and no model or provider is called. Other /api/ requests (the old
// tabs' own market reads, the stock research page's data) go to the network as they would in the app.
//
// THE SWITCHES read 'on' on this page ONLY, through the smoke commit's own reader changes (exploreFlags.js reads
// window.__exploreSmokeOn for EXPLORE_MODE and, in the compare-on scene only, window.__exploreSmokeCompare for the
// compare switch); the flag file's literals never change, and the PR head has no such read.
//
// THE WALK (?exploreFixture=walk): the front page → the AI buildout overview → the Electric utilities branch → its
// door to the Dominion story → a question → Work this idea into the real sheet → close → Continue research → back to
// the overview at the branch left. Two smoke-only substitutions, said plainly: the sheet's committed story-open answers
// were composed for a FantasyTimes story with its beat question, so this page puts the story and the question the page
// actually SENT in their place, and the same question into the read's open investigation after the close. The read
// after the close follows the walk: opened → walkDeepAfterOpen, a step → walkDeepAfterStep, a part → walkDeepAfterPart.
//
//   ?exploreFixture=<scene>   (index: the list)   &delay=<ms per answer, default 400>   &stay=home (do not open the scene's story)

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ThemeProvider } from '../contexts/ThemeContext';
import SearchDiscover from '../components/Search/SearchDiscover';
import BottomNav from '../components/Navigation/BottomNav';
import DesktopSidebar from '../components/Navigation/DesktopSidebar';
import { ExploreSourcesContext } from '../components/Explore/exploreSources';
import { KIT_STORIES, OLD_SHAPE_STORY, PILOT_DEEP, PILOT_OVERVIEW, SAMPLE_STORIES } from '../components/Explore/__fixtures__/stories';
import READS from '../components/Explore/__fixtures__/exploreReads.json';
import TA from '../components/SharedResearch/__fixtures__/thesisAnswers.json';

const QP = new URLSearchParams(window.location.search);
const DELAY = Number.isFinite(Number(QP.get('delay'))) && QP.get('delay') !== null ? Number(QP.get('delay')) : 400;
const USER = Object.freeze({ uid: 'smoke-explore-2', username: 'Smoke', wins: 0, losses: 0 });
const OV = PILOT_OVERVIEW.id;
const DEEP = PILOT_DEEP.id;
const GATED = { status: 404, body: { error: 'disabled' } };
const FAILED = { status: 503, body: { error: 'unavailable', message: 'SMOKE ONLY — the read failed on purpose.' } };
const SMOKE_LINE = (what) => ({ status: 400, body: { error: 'smoke_not_in_walk', message: `SMOKE ONLY — ${what}` } });
const [S_AI, S_TAP, S_UTIL] = SAMPLE_STORIES;

/** How a scene opens its story: `{ open: id, via: 'hero' | 'card' | 'latest' | 'tile' }`, then optionally jumps. */
const SCENES = {
  home: { title: 'Front page · first visit (the pilot overview is the hero; an empty shelf)', read: READS.fresh },
  'home-returning': { title: 'Front page · a returning player: one in progress, one thesis saved with its sentence', read: READS.returning },
  'home-empty-rows': { title: 'Front page · no product-led overview and no deep story: both rows are gone', read: READS.fresh, stories: [PILOT_OVERVIEW, S_AI, S_UTIL] },
  overview: { title: 'Overview · the AI buildout (one list of connections; the Electric utilities branch has a door)', read: READS.fresh, open: OV, via: 'hero' },
  'overview-no-door': { title: 'Overview · its deep story is not published: no door anywhere', read: READS.fresh, stories: [PILOT_OVERVIEW, S_AI, S_TAP, S_UTIL], open: OV, via: 'hero' },
  deep: { title: 'Deep story · Dominion (the way up, About, Where next)', read: READS.fresh, open: DEEP, via: 'latest' },
  'deep-no-parent': { title: 'Deep story · its overview cannot be read: no way up, no Where next', read: READS.fresh, stories: [PILOT_DEEP, S_AI, S_TAP, S_UTIL], open: DEEP, via: 'latest' },
  'broad-question': { title: 'Overview · the broad question and its group in the panel (compare switch off)', read: READS.fresh, open: OV, via: 'hero', jump: 'questions' },
  gated: { title: 'No access · reading and saving only', read: GATED, open: OV, via: 'hero' },
  limit: { title: "The day's limit · three used", read: READS.limit, open: OV, via: 'hero' },
  'read-failed': { title: "The research read failed · Couldn't check your research", read: FAILED, open: OV, via: 'hero' },
  'old-shape': { title: 'A story in the old shape (leads as text, no gap): it still reads', read: READS.fresh, stories: [PILOT_OVERVIEW, S_AI, OLD_SHAPE_STORY, S_UTIL], open: OLD_SHAPE_STORY.id, via: 'card' },
  'compare-on': { title: 'Overview · the broad question with the compare switch read as ON (this page only)', read: READS.fresh, open: OV, via: 'hero', jump: 'questions', compare: true },
  walk: { title: 'THE WALK · front page → overview → Electric utilities → its door → Dominion → Work this idea → the real sheet → close → Continue → back', walk: true },
  // more states for the renders (the Tests list's every state); the scenes above are the build prompt's list
  'home-saved-question': { title: 'Front page · a saved thesis with no sentence: its question shows instead', read: READS.saved },
  'home-saved-unreadable': { title: 'Front page · a saved thesis whose record cannot be read: neither sentence nor question', read: READS.savedBare },
  'home-concluded': { title: 'Front page · a concluded investigation', read: READS.concluded },
  'home-gated': { title: 'Front page · no access: the shelf says so; reading and saving stay open', read: GATED },
  'home-limit': { title: "Front page · the day's limit, one in progress", read: READS.limit },
  'home-failed': { title: "Front page · the research read failed: the shelf's Try again", read: FAILED },
  'specific-question': { title: 'Overview · a specific question (two companies: no group heading)', read: READS.fresh, open: S_UTIL.id, via: 'card', jump: 'questions' },
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
      const read = { none: READS.fresh, opened: READS.walkDeepAfterOpen, stepped: READS.walkDeepAfterStep, part: READS.walkDeepAfterPart }[walk.stage];
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

/** In-memory fixture sources: the scene's stories (all of them read: complete), and bookmarks kept for the page's life. */
function smokeSources(scene) {
  const stories = Array.isArray(scene.stories) ? scene.stories : KIT_STORIES;
  let bookmarks = [];
  const later = (v) => new Promise((r) => { setTimeout(() => r(v), DELAY); });
  return {
    readStories: () => later({ list: stories, complete: true }),
    readStory: (id) => later(stories.find((s) => s.id === id) ?? null),
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
      <p style={{ margin: '0 0 12px', fontWeight: 700 }}>SMOKE ONLY · Explore Build 2 · the pilot stories and labelled samples; every research read answered from fixtures</p>
      <ul style={{ margin: 0, padding: '0 0 0 18px', lineHeight: 2 }}>
        {Object.entries(SCENES).map(([k, s]) => <li key={k}><a href={`?exploreFixture=${k}`} style={{ color: 'var(--ft-teal)' }}>{k}</a> — {s.title}</li>)}
      </ul>
    </div>
  );
}

const OPENERS = {
  hero: (id) => `[data-explore-hero="${id}"] [data-explore-hero-read]`,
  card: (id) => `[data-explore-card="${id}"] [data-explore-card-primary]`,
  latest: (id) => `[data-explore-latest="${id}"]`,
  tile: (id) => `[data-explore-tile="${id}"]`,
};

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
  // SMOKE ONLY: a scene that starts on a story taps its opener once it is drawn (and then, if asked, a jump link)
  const opened = useRef(false);
  useEffect(() => {
    if (!scene.open || QP.get('stay') === 'home') return undefined;
    const t = setInterval(() => {
      const b = document.querySelector(OPENERS[scene.via](scene.open));
      if (b && !opened.current) {
        opened.current = true;
        b.click();
        clearInterval(t);
        if (scene.jump) {
          const j = setInterval(() => {
            const heading = scene.jump === 'questions' ? document.querySelector('[data-explore-questions] h3') : null;
            if (heading) { clearInterval(j); window.scrollTo(0, Math.max(0, heading.getBoundingClientRect().top + window.scrollY - 60)); }
          }, 50);
        }
      }
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
  // SMOKE ONLY: the switches read on for this page (exploreFlags.js on the smoke branch), before anything renders.
  window.__exploreSmokeOn = Boolean(scene);
  window.__exploreSmokeCompare = Boolean(scene?.compare);
  useMemo(() => { if (scene) installRoutes(scene); }, [scene]);
  useEffect(() => {
    const mark = document.createElement('div');
    mark.textContent = `SMOKE ONLY · Explore Build 2 · ${fixture}`;
    Object.assign(mark.style, { position: 'fixed', left: '50%', transform: 'translateX(-50%)', top: '2px', zIndex: '1003', pointerEvents: 'none', font: '600 11px system-ui, sans-serif', color: 'var(--ft-gold)', background: 'rgba(13,17,23,0.85)', padding: '2px 6px', borderRadius: '6px' });
    document.body.appendChild(mark);
    return () => mark.remove();
  }, [fixture]);
  return <ThemeProvider>{scene ? <Page scene={scene} /> : <Index />}</ThemeProvider>;
}

