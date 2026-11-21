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

export default function ExploreTab({ explore = null, onOpenResearch, stocksData = [], isMobile = false, sidebarCollapsed = false, SheetHost = ExploreSheetHost }) {
  const [view, setView] = useState({ kind: 'home' });
  const [choices, setChoices] = useState({});
  const [sheet, setSheet] = useState(null);
  const homeScroll = useRef(0);
  const storyOpener = useRef(null);
  const titleRef = useRef(null);
  const introRef = useRef(null);
  const openings = useRef(0);
  const afterView = useRef(null);
  const afterClose = useRef(false);
  const phoneSheet = useMatches(PHONE_SHEET);
  const viewRef = useRef(view);
  viewRef.current = view;

  // After a view change: the scroll and the focus the change asked for (never a scroll on focus).
  useLayoutEffect(() => {
    const next = afterView.current;
    if (!next) return;
    afterView.current = null;
    window.scrollTo(0, next.scrollTo);
    focusQuietly(next.focus === 'title' ? titleRef.current : (storyOpener.current?.isConnected ? storyOpener.current : introRef.current));
  }, [view]);

  // A control that held focus and left with the read after a close (a finished investigation's Continue row):
  // focus goes to the screen's own anchor, never to <body>.
  const research = explore?.research ?? null;
  useEffect(() => {
    if (!afterClose.current || sheet) return;
    afterClose.current = false;
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
  };
  const back = () => {
    afterView.current = { scrollTo: homeScroll.current, focus: 'opener' };
    setView({ kind: 'home' });
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
    afterClose.current = true;
    setSheet(null);
    explore.research.reread();
  };

  const story = view.kind === 'story' ? list.find((s) => s.id === view.storyId) ?? null : null;
  let screen;
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
  } else {
    screen = (
      <ExploreHome
        explore={explore}
        stocksData={stocksData}
        onOpenStory={openStory}
        onContinue={onContinue}
        onOpenCompany={onOpenResearch}
        onOwnWords={onOwnWords}
        introRef={introRef}
      />
    );
  }

  return (
    <div className="ftx-root" data-explore-tab="">
      <style>{EXPLORE_CSS}</style>
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
