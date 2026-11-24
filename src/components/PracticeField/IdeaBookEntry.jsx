// src/components/PracticeField/IdeaBookEntry.jsx
//
// Practice Field build B3 — THE COMMAND CENTER ENTRY CARD, and the page it opens (design of record
// docs/design/practice-field/IDEA_BOOK_ROUND_2.html, its EntryCard2; B3 §4). The hub imports this module ONCE and renders
// it at ONE site (src/components/CommandCenter/sections/ActivitySection.jsx), behind the literal re-exported below, so
// with the switch off the ternary folds away and the hub is its old self: no request, no card, no layout change.
//
// THE CARD appears only when the screen switch is on AND the endpoint returns a book: both desks' marks, the book's
// value and today's change in dollars and percent (or "Paused", or the day it opens). A tap opens the page.
// THE PAGE is a layer over the whole app (a portal on <body>): the app behind it is made inert while it is open, Escape
// or Back closes it, and focus returns to the card. It reads on open (the card and the page share one read,
// useIdeaBook.js) and again when the window regains focus.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PRACTICE_FIELD_SCREEN_ENABLED } from '../../config/practiceFieldScreenFlags';
import useIdeaBook from './useIdeaBook';
import IdeaBookScreen from './IdeaBookScreen';
import { IB, HAIR, mono, signColor, RESET, IB_CSS } from './ideaBookStyle';
import { Eyebrow, Icon, DeskMark } from './IdeaBookParts';
import { entryTodayOf, entryHeadlineOf } from './ideaBookCopy';

/** The switch, for the hub's one ternary (a literal Rollup folds through this re-export): the hub's ONE import takes both. */
// eslint-disable-next-line react-refresh/only-export-components
export { PRACTICE_FIELD_SCREEN_ENABLED as IDEA_BOOK_SCREEN_ON };

export function IdeaBookCard({ view, onOpen, buttonRef = null }) {
  const today = entryTodayOf(view.line);
  const headline = entryHeadlineOf(view.line);
  return (
    <button
      ref={buttonRef} type="button" className="ib-tap" onClick={onOpen} data-ib="entry-card"
      aria-label={`Idea book, ${headline}${today ? `, ${today.text}` : ''}. Open`}
      style={{ ...RESET, display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 72, padding: '12px 10px 12px 12px', borderRadius: 16, background: IB.surface, border: HAIR }}
    >
      <span style={{ display: 'flex', gap: 4 }}><DeskMark desk="shadow" size={36} /><DeskMark desk="archetype" size={36} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <Eyebrow>Idea book</Eyebrow>
        {view.line.waiting
          ? <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: IB.ink2, letterSpacing: '-0.01em', marginTop: 4 }}>{headline}</span>
          : <span style={{ display: 'block', ...mono(18, IB.ink, 700), letterSpacing: '-0.02em', marginTop: 4 }}>{headline}</span>}
        {today ? <span style={{ display: 'block', ...(view.line.waiting ? { fontSize: 11.5, color: IB.ink3, lineHeight: 1.35 } : mono(11.5, signColor(today.dir), 600)), marginTop: 2 }}>{today.text}</span> : null}
      </span>
      <span style={{ color: IB.ink3 }}><Icon name="chevR" size={15} /></span>
    </button>
  );
}

/** The page as a layer over the app: the app inert behind it, Escape and Back close it. */
function IdeaBookLayer({ read, onClose }) {
  useEffect(() => {
    const root = typeof document !== 'undefined' ? document.getElementById('root') : null;
    const wasInert = root ? root.hasAttribute('inert') : true;
    if (root && !wasInert) root.setAttribute('inert', '');
    return () => { if (root && !wasInert) root.removeAttribute('inert'); };
  }, []);
  const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
  return createPortal(
    // tabIndex -1: a click on plain text keeps focus inside the layer, so Escape still reaches it (review C2).
    <div role="dialog" aria-modal="true" aria-label="Idea book" tabIndex={-1} onKeyDown={onKeyDown} data-ib="layer" style={{ position: 'fixed', inset: 0, zIndex: 1100, overflowY: 'auto', overscrollBehavior: 'contain', outline: 'none', background: IB.bg }}>
      <IdeaBookScreen read={read} onClose={onClose} />
    </div>,
    document.body,
  );
}

/** What can take focus in the hub beside the card (the next control a keyboard user would reach). */
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus after the page closes with no card to return to (review B3-A09: the gate closed while the page was open): the first
 * control of the hub's block that held the card — the Recent activity section beside it — else nothing keeps focus.
 */
function focusBesideCard(host) {
  const target = host && host.isConnected ? host.querySelector(FOCUSABLE) : null;
  if (target) target.focus();
  else if (typeof document !== 'undefined' && document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
}

/** The hub's one render site. Reads only while the switch is on. */
export default function IdeaBookEntry() {
  const { read, refresh } = useIdeaBook({ enabled: PRACTICE_FIELD_SCREEN_ENABLED });
  const [open, setOpen] = useState(false);
  const cardRef = useRef(null);
  // The hub's block the card sits in, remembered at open: where focus goes if the card is gone when the page closes.
  const hostRef = useRef(null);
  const onOpen = useCallback(() => {
    hostRef.current = cardRef.current?.closest('[data-ib="entry"]')?.parentElement ?? null;
    setOpen(true);
    refresh();
  }, [refresh]);
  const onClose = useCallback(() => { setOpen(false); }, []);
  // Review B3-A09: a refresh that answers 404 while the page is open (the mode, the switch or its gate now says "not for
  // you") closes the page: the layer unmounts, which lifts `inert` from the app, and focus goes beside the card. So does an
  // answer of no book (it closed — its wind-down completed — or its claim went stale: the refuter's R4): the card is gone too.
  const gone = read.status === 'off' || (read.status === 'ready' && !read.book);
  useEffect(() => { if (open && gone) setOpen(false); }, [open, gone]);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) {
      if (cardRef.current) cardRef.current.focus();
      else focusBesideCard(hostRef.current);
    }
    wasOpen.current = open;
  }, [open]);
  const view = read.status === 'ready' ? read.book : null;
  if (!PRACTICE_FIELD_SCREEN_ENABLED) return null;
  return (
    <>
      {view ? (
        <div data-ib="entry">
          <style>{IB_CSS}</style>
          <IdeaBookCard view={view} onOpen={onOpen} buttonRef={cardRef} />
        </div>
      ) : null}
      {open ? <IdeaBookLayer read={read} onClose={onClose} /> : null}
    </>
  );
}
