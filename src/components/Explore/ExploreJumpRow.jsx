// src/components/Explore/ExploreJumpRow.jsx
//
// Explore Build 2 — THE JUMP ROW, below 1000 px (spec docs/specs/20261125_EXPLORE_BUILD_2_SPEC_AMENDMENT_B.md §4.3,
// B-12, B-14; build prompt K-10). Under the byline, in the flow: a back arrow, then the story's sections with their
// counts — Story · Connections · Questions · Sources on an overview, Story · Questions · Connections · Sources on a deep
// story. They are jump links, not tabs: the story stays one page.
//   - PINNED once scrolled past. `position: sticky` cannot pin here (src/index.css makes #root an overflow box that
//     never scrolls), so — the pinned bar's pattern — a fixed copy is portalled into <body> while the in-flow row is
//     above the screen. The in-flow row keeps the Tab stops; the copy's buttons take none (focusing the in-flow row
//     scrolls it back, which unpins). While pinned, the page keeps the top band clear for focus (scroll-padding-top).
//   - ONE IntersectionObserver marks the section in view (`aria-current="location"`): the first of the story's
//     section blocks, in reading order, that shows below the row. A tap marks its section at once and keeps it while
//     the page stays where the jump put it (the last section may never reach the top of a short page).
//   - A tap scrolls to the section (instantly) and moves focus to its heading, never scrolling on focus.
// Nothing here reads or writes anything but the page's own scroll and focus.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EXPLORE_COPY } from './exploreCopy';
import { EXPLORE_LAYERS, T, wash } from './exploreStyle';
import { Icon } from './exploreParts';

const COPY = EXPLORE_COPY.story;
const RESET = { appearance: 'none', font: 'inherit', background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' };
/** The row's height: 44 px targets and a 1 px rule. */
export const JUMP_ROW_PX = 45;

/** The section the reader is in: the first section block (in reading order) that shows below the row. */
export function sectionInViewOf(blocks) {
  const first = blocks.find((b) => b.showing);
  return first ? first.section : null;
}

function Row({ sections, current, onJump, backLabel, onBack, copy }) {
  const stop = copy ? -1 : undefined;
  return (
    <>
      <button type="button" className="ftx-btn" tabIndex={stop} aria-label={COPY.backLabel(backLabel)} data-explore-jump-back="" onClick={onBack} style={{ ...RESET, width: 40, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.ink }}>
        <Icon name="back" size={18} />
      </button>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        {sections.map((s) => {
          const on = s.id === current;
          return (
            <button
              key={s.id}
              type="button"
              className="ftx-btn"
              tabIndex={stop}
              aria-current={on ? 'location' : undefined}
              data-explore-jump-to={s.id}
              onClick={() => onJump(s.id)}
              style={{ ...RESET, minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: on ? T.ink : T.ink2, whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0 }}
            >
              {on ? <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: T.teal, flexShrink: 0 }} /> : null}
              <span style={{ fontSize: 13, lineHeight: 1.3 }}>{s.label}</span>
              {s.count !== null ? <span style={{ fontSize: 13, lineHeight: 1.3, color: T.ink3, fontWeight: 500 }}>{s.count}</span> : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

/**
 * @param {object}   p
 * @param {{ id, label, count|null }[]} p.sections   in B-14's order
 * @param {{ current: HTMLElement|null }} p.rootRef   the story screen; its `[data-explore-section]` blocks are watched
 * @param {(id) => void} p.onJump    scrolls to the section and focuses its heading (the story's own)
 * @param {string}   p.backLabel     where the back arrow goes ("Explore", or the story that linked here)
 * @param {() => void} p.onBack
 */
export default function ExploreJumpRow({ sections, rootRef, onJump, backLabel, onBack, left = 0, inertNow = false }) {
  const navRef = useRef(null);
  const [pinned, setPinned] = useState(false);
  const [current, setCurrent] = useState(sections[0]?.id ?? null);
  const jumped = useRef(null); // { id, y }: the section a tap marked, kept while the page stays where the jump put it

  // Pinned while the in-flow row is above the top of the screen (not drawn from 1000 px: never pinned there).
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof IntersectionObserver !== 'function') return undefined;
    const observer = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      setPinned(e.boundingClientRect.height > 0 && e.boundingClientRect.top < 0);
    }, { threshold: [0, 1] });
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  // The one observer that marks the section in view.
  const sectionKey = sections.map((s) => s.id).join('|');
  useEffect(() => {
    const root = rootRef?.current ?? null;
    if (!root || typeof IntersectionObserver !== 'function') return undefined;
    const blocks = [...root.querySelectorAll('[data-explore-section]')].map((el) => ({ el, section: el.dataset.exploreSection, showing: false }));
    if (!blocks.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const b = blocks.find((x) => x.el === e.target);
        if (b) b.showing = e.isIntersecting;
      }
      const tap = jumped.current;
      if (tap && Math.abs(window.scrollY - tap.y) < 2) { setCurrent(tap.id); return; }
      jumped.current = null;
      const inView = sectionInViewOf(blocks);
      if (inView) setCurrent(inView);
    }, { rootMargin: `-${JUMP_ROW_PX}px 0px 0px 0px`, threshold: 0 });
    for (const b of blocks) observer.observe(b.el);
    return () => observer.disconnect();
  }, [rootRef, sectionKey]);

  // While pinned, a control reached by Tab is scrolled below the row, never under it; put back exactly as it was.
  useLayoutEffect(() => {
    if (!pinned) return undefined;
    const root = document.documentElement;
    const before = root.style.scrollPaddingTop;
    root.style.scrollPaddingTop = `${JUMP_ROW_PX + 8}px`;
    return () => { root.style.scrollPaddingTop = before; };
  }, [pinned]);

  const jump = (id) => {
    onJump(id);
    jumped.current = { id, y: window.scrollY };
    setCurrent(id);
  };
  const props = { sections, current, onJump: jump, backLabel, onBack };
  const bar = { display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px 0 2px', background: T.bg, borderBottom: `1px solid ${T.hair}`, minWidth: 0 };

  return (
    <div className="ftx-phone-only" data-explore-jump-holder="">
      <nav ref={navRef} aria-label={COPY.jumpLabel} data-explore-jump="flow" style={{ ...bar, borderTop: `1px solid ${T.hair}` }}>
        <Row {...props} copy={false} />
      </nav>
      {pinned ? createPortal(
        <nav
          className="ftx-portal ftx-phone-only"
          aria-label={COPY.jumpLabel}
          data-explore-jump="pinned"
          inert={inertNow ? true : undefined}
          style={{ ...bar, position: 'fixed', top: 0, left, right: 0, zIndex: EXPLORE_LAYERS.bar, paddingTop: 'env(safe-area-inset-top, 0px)', boxShadow: `0 10px 24px ${wash('shadow', 0.4)}` }}
        >
          <Row {...props} copy />
        </nav>,
        document.body,
      ) : null}
    </div>
  );
}
