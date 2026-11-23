// src/components/Explore/ExploreTab.jsx
//
// Explore Build 1 — THE EXPLORE TAB (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §3; build prompt K-8,
// K-9, K-10, K-14). SearchDiscover loads it lazily as the content of the Explore tab and hands it the page's reads
// (ExploreRuntime's snapshot) — this file reads nothing itself. It holds what is on screen: home or one story, the
// chosen question and its edits per story, and the open sheet.
//
//   - Opening a story moves focus to its title and starts at the top; ← Explore returns home at the scroll position
//     the player left, focus back on what opened the story.
//   - The four ways into the sheet (ExploreSheetHost): Work this idea, Continue research (always mode 'session' with
//     the read's open.sessionId — never a new open, K-9), View it, and search's own-words row. The page stays mounted
//     behind the sheet; closing it runs the read once more (quiet) so the card, the panel and the cost line show what
//     happened; focus goes back to the opener without scrolling.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EXPLORE_COPY } from './exploreCopy';
import { EXPLORE_CSS, S } from './exploreStyle';
import { questionIdFor, sheetItemOf } from './exploreView';
import { LinkBtn, StatusLine } from './exploreParts';
import ExploreHome from './ExploreHome';
import ExploreStory from './ExploreStory';
import ExploreSheetHost from './ExploreSheetHost';

const PHONE_SHEET = '(max-width: 699px)';

function useMatches(query) {
  const read = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return matches;
}

const focusQuietly = (el) => { if (el && el.isConnected && typeof el.focus === 'function') el.focus({ preventScroll: true }); };

export default function ExploreTab({ explore = null, onOpenResearch, stocksData = [], isMobile = false, sidebarCollapsed = false, onInStory, SheetHost = ExploreSheetHost }) {
  const [view, setView] = useState({ kind: 'home' });
  const [choices, setChoices] = useState({});
  const [sheet, setSheet] = useState(null);
  const homeScroll = useRef(0);
  const storyOpener = useRef(null);
  const titleRef = useRef(null);
  const introRef = useRef(null);
  const openings = useRef(0);
  const afterView = useRef(null);
  const afterClose = useRef(null); // { research } as it stood at the close, until the read's answer replaces it
  const phoneSheet = useMatches(PHONE_SHEET);
  const viewRef = useRef(view);
  viewRef.current = view;

  // F-1 (founder, Nov 22): inside a story the page does not draw its tab row. The page is told through `onInStory`:
  // true only while this tab shows a story that exists (the stories loaded, the story among them). Opening a story
  // and ← Explore tell it in the same handler as the view change, so the row leaves and returns in the SAME commit as
  // the view, before the scroll and the focus below run; the effect covers the rest (the story disappearing, the
  // snapshot going away); and this tab reports false when it unmounts.
  const storyShown = view.kind === 'story' && explore?.stories?.status === 'ready' && explore.stories.list.some((s) => s.id === view.storyId);
  useLayoutEffect(() => { onInStory?.(storyShown); }, [storyShown, onInStory]);
  useLayoutEffect(() => () => { onInStory?.(false); }, [onInStory]);

  // After a view change: the scroll and the focus the change asked for (never a scroll on focus).
  useLayoutEffect(() => {
    const next = afterView.current;
    if (!next) return;
    afterView.current = null;
    window.scrollTo(0, next.scrollTo);
    focusQuietly(next.focus === 'title' ? titleRef.current : (storyOpener.current?.isConnected ? storyOpener.current : introRef.current));
  }, [view]);

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

  const { stories, bookmarks } = explore;
  const list = stories.status === 'ready' ? stories.list : [];

  const openStory = (storyId, questionId, event) => {
    const story = list.find((s) => s.id === storyId);
    if (!story) return;
    homeScroll.current = window.scrollY;
    storyOpener.current = event?.currentTarget ?? null;
    setChoices((c) => {
      const prev = c[storyId] ?? { selectedId: null, edits: {} };
      return { ...c, [storyId]: { ...prev, selectedId: questionIdFor(story, questionId ?? prev.selectedId) } };
    });
    afterView.current = { scrollTo: 0, focus: 'title' };
    setView({ kind: 'story', storyId });
    onInStory?.(true);
  };
  const back = () => {
    afterView.current = { scrollTo: homeScroll.current, focus: 'opener' };
    setView({ kind: 'home' });
    onInStory?.(false);
  };

  const openSheet = (entry, event) => {
    openings.current += 1;
    setSheet({ entry: { id: `opening-${openings.current}`, ...entry }, opener: event?.currentTarget ?? document.activeElement ?? null });
  };
  const onWork = (event, story, text) => openSheet({ way: 'work', item: sheetItemOf(story, text) }, event);
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

  const story = view.kind === 'story' ? list.find((s) => s.id === view.storyId) ?? null : null;
  let screen = null;
  if (view.kind === 'story' && story) {
    screen = (
      <ExploreStory
        key={story.id}
        story={story}
        research={explore.research}
        bookmarks={bookmarks}
        choice={choices[story.id] ?? { selectedId: questionIdFor(story), edits: {} }}
        onChoice={(next) => setChoices((c) => ({ ...c, [story.id]: next }))}
        onBack={back}
        onWork={onWork}
        onContinue={onContinue}
        onViewIt={onViewIt}
        titleRef={titleRef}
        navBelow={isMobile}
        sheetOpen={sheet !== null}
        barLeft={isMobile ? 0 : sidebarCollapsed ? 64 : 220}
      />
    );
  } else if (view.kind === 'story') {
    screen = (
      <div style={S.section} data-explore-screen="gone">
        <div><LinkBtn onClick={back} data-explore-back="">{EXPLORE_COPY.story.back}</LinkBtn></div>
        <p role="status" style={S.meta}>{EXPLORE_COPY.story.unavailable}</p>
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
          stocksData={stocksData}
          onOpenStory={openStory}
          onContinue={onContinue}
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
          phone={phoneSheet}
          onClose={closeSheet}
          opener={sheet.opener}
          fallbackFocus={() => (viewRef.current.kind === 'story' ? titleRef.current : introRef.current)}
        />
      )}
    </div>
  );
}
