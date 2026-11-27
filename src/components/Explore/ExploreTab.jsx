// src/components/Explore/ExploreTab.jsx
//
// Explore Build 1 — THE EXPLORE TAB (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §3; build prompt K-8,
// K-9, K-10, K-14). SearchDiscover loads it lazily as the content of the Explore tab and hands it the page's reads
// (ExploreRuntime's snapshot). It holds what is on screen: the front page or one story, the chosen question and its
// edits per story, and the open sheet.
//
//   - The four ways into the sheet (ExploreSheetHost): Work this idea, Continue research (always mode 'session' with
//     the read's open.sessionId — never a new open, K-9), View it, and search's own-words row. The page stays mounted
//     behind the sheet; closing it runs the read once more (quiet) so the card, the panel and the cost line show what
//     happened; focus goes back to the opener without scrolling.
//
// Explore Build 2 (spec docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md §4.5, §5.1, §7; build prompt K-4,
// K-8, K-16):
//   - THE HISTORY. The tab keeps where the player has been: the front page, then each story opened, each with its
//     scroll position, its open branches and the control that was tapped to leave it. A card, the hero, a tile, a
//     Latest row, a search row, a door, "Where next" and the way up push onto it; back pops it and restores the scroll,
//     the open branches and the focus (B-11). Opening a story starts at its top with focus on its title; a link to an
//     overview at a connection opens it at that branch, open. Nothing is scrolled on focus. The page's `inStory`
//     report covers both kinds of story.
//   - LINKED STORIES BY ID. Only when the stories read was not complete: a door's target or a deep story's parent that
//     is not at hand is read by id (the stories source's readStory) when the story page that needs it opens, at most
//     LINKED_READS_MAX for one story page, each id once for the tab's life. A missing, refused or wrong-kind story is
//     absent. No listener, no polling.
//   - THE SHEET is handed the read's agent (id, name, the equipped list's name; null when the read names none), as
//     the read named it when the sheet opened, and Work this idea hands the chosen question's id on the item.

import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EXPLORE_COPY } from './exploreCopy';
import { BOTTOM_NAV_PX, EXPLORE_CSS, S } from './exploreStyle';
import { LINKED_READS_MAX, agentFor, linkedIdsOf, questionIdFor, sheetItemOf, storiesByIdOf } from './exploreView';
import { LinkBtn, StatusLine, useMatches } from './exploreParts';
import { ExploreSourcesContext } from './exploreSources';
import ExploreHome from './ExploreHome';
import ExploreStory from './ExploreStory';
import ExploreSheetHost from './ExploreSheetHost';
import { JUMP_ROW_PX } from './ExploreJumpRow';

const PHONE_SHEET = '(max-width: 699px)';
const HOME = Object.freeze({ kind: 'home' });
const COPY = EXPLORE_COPY.story;
const EMPTY = Object.freeze([]);

const focusQuietly = (el) => { if (el && el.isConnected && typeof el.focus === 'function') el.focus({ preventScroll: true }); };
/** The element under `root` whose `data-<attr>` is `value` (no selector built from story text). */
const byData = (root, attr, value) => (root && value ? [...root.querySelectorAll(`[data-${attr}]`)].find((el) => el.getAttribute(`data-${attr}`) === value) ?? null : null);
const storyScreen = () => document.querySelector('[data-explore-screen="story"]');

export default function ExploreTab({ explore = null, onOpenResearch, stocksData = [], isMobile = false, sidebarCollapsed = false, onInStory, SheetHost = ExploreSheetHost }) {
  const sources = useContext(ExploreSourcesContext);
  const [stack, setStack] = useState([HOME]);
  const [choices, setChoices] = useState({});
  const [sheet, setSheet] = useState(null);
  const [linked, setLinked] = useState(() => new Map()); // story id → its view, or null (absent): read by id
  const homeScroll = useRef(0);
  const homeOpener = useRef(null);
  const titleRef = useRef(null);
  const introRef = useRef(null);
  const openings = useRef(0);
  const afterView = useRef(null);
  const afterClose = useRef(null); // { research } as it stood at the close, until the read's answer replaces it
  const asked = useRef(new Set()); // ids read by id (out or settled): each once for the tab's life
  const readsFor = useRef(new Map()); // story id → the by-id reads made for its page
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const phoneSheet = useMatches(PHONE_SHEET);
  const view = stack[stack.length - 1];
  const viewRef = useRef(view);
  viewRef.current = view;
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const storiesReady = explore?.stories?.status === 'ready';
  const list = storiesReady ? explore.stories.list : EMPTY;
  const byId = useMemo(() => storiesByIdOf(list, linked), [list, linked]);
  const story = view.kind === 'story' ? byId.get(view.storyId) ?? null : null;

  // F-1 (founder, Nov 22) and B-12: inside a story the page draws neither its heading nor its tab row. The page is told
  // through `onInStory`: true only while this tab shows a story that exists. Opening a story and back tell it in the
  // same handler as the view change, so the row leaves and returns in the SAME commit as the view, before the scroll
  // and the focus below run; the effect covers the rest (the story disappearing, the snapshot going away); and this
  // tab reports false when it unmounts.
  const storyShown = view.kind === 'story' && storiesReady && Boolean(story);
  useLayoutEffect(() => { onInStory?.(storyShown); }, [storyShown, onInStory]);

  // On a phone the app's bottom nav covers the screen's last 65 px: while Explore shows, a control reached by Tab is
  // scrolled above it, not left under it (review P-2). The pinned bar reserves more while it shows, and gives this back.
  useLayoutEffect(() => {
    if (!isMobile) return undefined;
    const root = document.documentElement;
    const before = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = `${BOTTOM_NAV_PX + 8}px`;
    return () => { root.style.scrollPaddingBottom = before; };
  }, [isMobile]);
  useLayoutEffect(() => () => { onInStory?.(false); }, [onInStory]);

  // After a view change: the scroll and the focus the change asked for (never a scroll on focus).
  useLayoutEffect(() => {
    const next = afterView.current;
    if (!next) return;
    afterView.current = null;
    if (next.kind === 'home') {
      window.scrollTo(0, homeScroll.current);
      focusQuietly(homeOpener.current?.isConnected ? homeOpener.current : introRef.current);
      return;
    }
    if (next.kind === 'restore') {
      window.scrollTo(0, next.scrollY);
      focusQuietly(byData(storyScreen(), 'explore-focus', next.focusKey) ?? titleRef.current);
      return;
    }
    if (next.kind === 'branch') {
      const branch = byData(storyScreen(), 'explore-branch', next.branch);
      if (branch) {
        const row = document.querySelector('[data-explore-jump="flow"]');
        const clear = (row && row.offsetHeight > 0 ? JUMP_ROW_PX : 0) + 8;
        window.scrollTo(0, Math.max(0, Math.round(branch.getBoundingClientRect().top + window.scrollY - clear)));
        focusQuietly(branch.querySelector('[data-explore-branch-toggle]') ?? titleRef.current);
        return;
      }
    }
    window.scrollTo(0, 0);
    focusQuietly(titleRef.current);
  }, [stack]);

  // K-4: the stories a story page needs and the stories read lacks — only when that read was not complete.
  const complete = explore?.stories?.complete === true;
  useEffect(() => {
    if (!story || !storiesReady || complete || typeof sources?.readStory !== 'function') return;
    const made = readsFor.current.get(story.id) ?? 0;
    const ids = linkedIdsOf(story, byId, asked.current).slice(0, Math.max(0, LINKED_READS_MAX - made));
    if (!ids.length) return;
    readsFor.current.set(story.id, made + ids.length);
    for (const id of ids) {
      asked.current.add(id);
      Promise.resolve().then(() => sources.readStory(id)).then((v) => v, () => null).then((v) => {
        if (!live.current) return;
        setLinked((m) => new Map(m).set(id, v && v.id === id ? v : null));
      });
    }
  }, [story, byId, storiesReady, complete, sources]);

  // After a close, the read's answer can change what sits ABOVE the opener (form A becomes the shorter form B): the
  // opener is kept where it was on screen, in every browser alike (Safari has no scroll anchoring; .ftx-root turns
  // Chromium's off so the two never add up). The page's scroll is untouched by the close itself, and a scroll the
  // player makes while the read is out moves the baseline with it, so it is never undone (review B-2).
  const research = explore?.research ?? null;
  const keepOnScreen = useRef(null);
  /** The read's answer to the quiet read sent at the close has landed (not the close's own render, not `refreshing`). */
  const answeredSince = (captured) => Boolean(captured) && !sheet && Boolean(research) && research.refreshing !== true && research !== captured.research;
  useEffect(() => {
    const onScroll = () => {
      const keep = keepOnScreen.current;
      if (keep?.el?.isConnected) keep.top = keep.el.getBoundingClientRect().top;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useLayoutEffect(() => {
    const keep = keepOnScreen.current;
    if (!answeredSince(keep)) return;
    keepOnScreen.current = null;
    if (!keep.el?.isConnected) return;
    const delta = keep.el.getBoundingClientRect().top - keep.top;
    if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
  }, [research, sheet]);

  // A control that held focus and left with the read's answer after a close (a finished investigation's Continue row;
  // form A's button when the read fails): focus goes to the screen's own anchor, never to <body> (review B-1).
  useEffect(() => {
    if (!answeredSince(afterClose.current)) return;
    afterClose.current = null;
    if (document.activeElement === document.body || !document.activeElement) {
      focusQuietly(viewRef.current.kind === 'story' ? titleRef.current : introRef.current);
    }
  }, [research, sheet]);

  if (!explore) {
    return (
      <div className="ftx-root" data-explore-tab="">
        <style>{EXPLORE_CSS}</style>
        <StatusLine>{EXPLORE_COPY.home.loading}</StatusLine>
      </div>
    );
  }

  const { bookmarks } = explore;

  /**
   * Opens a story on top of the history (K-8): the screen left keeps its scroll and the control tapped; the story opens
   * at its top, or — a link to an overview at a connection — at that branch, open.
   */
  const openStory = (storyId, questionId, event, { branch = null } = {}) => {
    const target = byId.get(storyId);
    if (!target) return;
    const opener = event?.currentTarget ?? null;
    const s = stackRef.current;
    const top = s[s.length - 1];
    let left = top;
    if (top.kind === 'home') {
      homeScroll.current = window.scrollY;
      homeOpener.current = opener;
    } else {
      left = { ...top, scrollY: window.scrollY, focusKey: opener?.getAttribute?.('data-explore-focus') ?? null };
    }
    setChoices((c) => {
      const prev = c[storyId] ?? { selectedId: null, edits: {} };
      return { ...c, [storyId]: { ...prev, selectedId: questionIdFor(target, questionId ?? prev.selectedId) } };
    });
    const opened = target.connections.some((c) => c.ref === branch) ? branch : null;
    afterView.current = opened ? { kind: 'branch', branch: opened } : { kind: 'top' };
    setStack([...s.slice(0, -1), left, { kind: 'story', storyId, open: opened ? [opened] : [] }]);
    onInStory?.(true);
  };
  /** Back (B-11): to the screen the player came from, at the scroll, the open branches and the focus they left. */
  const back = () => {
    const s = stackRef.current;
    if (s.length < 2) return;
    const prev = s[s.length - 2];
    afterView.current = prev.kind === 'home' ? { kind: 'home' } : { kind: 'restore', scrollY: prev.scrollY ?? 0, focusKey: prev.focusKey ?? null };
    setStack(s.slice(0, -1));
    onInStory?.(prev.kind === 'story' && byId.has(prev.storyId));
  };
  const toggleBranch = (ref) => {
    setStack((s) => {
      const top = s[s.length - 1];
      if (top.kind !== 'story') return s;
      const open = top.open.includes(ref) ? top.open.filter((r) => r !== ref) : [...top.open, ref];
      return [...s.slice(0, -1), { ...top, open }];
    });
  };
  /** Where back goes, in words: "Explore", or the story that linked here (its subject, else its title). */
  const prev = stack.length > 1 ? stack[stack.length - 2] : null;
  const prevStory = prev?.kind === 'story' ? byId.get(prev.storyId) ?? null : null;
  const backLabel = prevStory ? prevStory.subject ?? prevStory.title : COPY.explore;

  const openSheet = (entry, event) => {
    openings.current += 1;
    // the agent as the read names it at the opening: a later re-read that fails never takes it from an open sheet (review N-2)
    setSheet({ entry: { id: `opening-${openings.current}`, ...entry }, opener: event?.currentTarget ?? document.activeElement ?? null, agent: agentFor(explore.research) });
  };
  const onWork = (event, s, text, questionId) => openSheet({ way: 'work', item: sheetItemOf(s, text, questionId) }, event);
  const onContinue = (event, sessionId) => openSheet({ way: 'continue', sessionId }, event);
  const onViewIt = (event, sessionId) => openSheet({ way: 'view', sessionId }, event);
  const onOwnWords = (event, text) => openSheet({ way: 'words', words: text }, event);
  const closeSheet = () => {
    afterClose.current = { research: explore.research };
    const el = sheet?.opener ?? null;
    keepOnScreen.current = el?.isConnected ? { el, top: el.getBoundingClientRect().top, research: explore.research } : null;
    setSheet(null);
    explore.research.reread();
  };

  let screen = null;
  if (view.kind === 'story' && story) {
    screen = (
      <ExploreStory
        key={story.id}
        story={story}
        byId={byId}
        research={explore.research}
        bookmarks={bookmarks}
        choice={choices[story.id] ?? { selectedId: questionIdFor(story), edits: {} }}
        onChoice={(next) => setChoices((c) => ({ ...c, [story.id]: next }))}
        backLabel={backLabel}
        onBack={back}
        onWork={onWork}
        onContinue={onContinue}
        onViewIt={onViewIt}
        onOpenStory={openStory}
        onOpenCompany={onOpenResearch}
        open={new Set(view.open)}
        onToggleBranch={toggleBranch}
        titleRef={titleRef}
        navBelow={isMobile}
        sheetOpen={sheet !== null}
        barLeft={isMobile ? 0 : sidebarCollapsed ? 64 : 220}
      />
    );
  } else if (view.kind === 'story') {
    screen = (
      <div style={S.section} data-explore-screen="gone">
        <div><LinkBtn onClick={back} data-explore-back="">{COPY.backTo(backLabel)}</LinkBtn></div>
        <p role="status" style={S.meta}>{COPY.unavailable}</p>
      </div>
    );
  }

  // Home stays mounted (hidden) under a story: back returns to the same search, topic and cards, and focus to the
  // very control that opened the story.
  return (
    <div className="ftx-root" data-explore-tab="">
      <style>{EXPLORE_CSS}</style>
      <div hidden={view.kind !== 'home'} data-explore-home-holder="">
        <ExploreHome
          explore={explore}
          byId={byId}
          stocksData={stocksData}
          onOpenStory={openStory}
          onContinue={onContinue}
          onViewIt={onViewIt}
          onOpenCompany={onOpenResearch}
          onOwnWords={onOwnWords}
          introRef={introRef}
        />
      </div>
      {screen}
      {sheet && (
        <SheetHost
          key={sheet.entry.id}
          entry={sheet.entry}
          gated={explore.research.status === 'gated'}
          agent={sheet.agent}
          phone={phoneSheet}
          onClose={closeSheet}
          opener={sheet.opener}
          fallbackFocus={() => (viewRef.current.kind === 'story' ? titleRef.current : introRef.current)}
        />
      )}
    </div>
  );
}
