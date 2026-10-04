// src/screens/battleView/BoardCockpit.jsx
//
// THE PHONE'S BOARD · COCKPIT — Cockpit Build 2a (spec
// docs/COCKPIT_BUILD2A_SPEC_V1_0.md §6; rulings R2A-3, R2A-4). Two pieces,
// rendered ONLY when the battle is cockpit-on; with it off the phone layout is
// the shipped one and nothing here mounts.
//
//   CockpitSwitch      a segmented control with a sliding thumb (Framer
//                      `layoutId`, the existing `smooth` token; `instant` under
//                      reduced motion — no new motion token). "Board" and
//                      "Cockpit · {n}" (n = tiles in Needs you, none at 0).
//                      role="tablist", roving tabindex, arrows / Home / End —
//                      the CharacterPane SegmentedControl contract.
//   BoardCockpitTrack  two full-width screens on ONE horizontal track with
//                      native scroll-snap (`scrollSnapType: 'x mandatory'`, the
//                      ArchetypePicker precedent). Board is the default.
//                      A tap on the switch scrolls the track (`smooth`, or
//                      `auto` under reduced motion; the FIRST position is set
//                      without animation, so a remount never glides). A swipe
//                      moves the switch only when the track SETTLES — on
//                      `scrollend`, or after a short idle where the browser has
//                      none — never at the halfway point while the finger is
//                      still down, and a settled swipe is never answered with a
//                      programmatic scroll: the selection always names the
//                      screen that is showing (review L5-2). Each screen
//                      scrolls on its own; the cockpit screen's scroller is
//                      locked declaratively while the sheet is open.
//
// HAZARD 48: every label sizes an inner <span>.

import React from 'react';
import { motion } from 'framer-motion';
import { cssVar } from '../../theme/cssTokens';
import { motionToken } from '../../theme/motion';
import { BATTLE_VIEW_COPY as COPY } from './battleViewCopy';

export const PHONE_SCREEN = Object.freeze({ BOARD: 'board', COCKPIT: 'cockpit' });
export const PHONE_SCREENS = Object.freeze([PHONE_SCREEN.BOARD, PHONE_SCREEN.COCKPIT]);
/** The idle after the last scroll event that counts as "settled" where `scrollend` is missing. */
export const TRACK_SETTLE_IDLE_MS = 120;

const tabId = (screen) => `board-cockpit-tab-${screen}`;
const panelId = (screen) => `board-cockpit-panel-${screen}`;

/**
 * @param {object} props
 * @param {'board'|'cockpit'} props.screen
 * @param {(screen: string) => void} props.onSelect
 * @param {number} props.needsYou   tiles in Needs you, after folding
 */
export function CockpitSwitch({ screen, onSelect, needsYou = 0, reducedMotion = false }) {
  const onKeyDown = (e) => {
    const i = PHONE_SCREENS.indexOf(screen);
    if (i < 0) return;
    let next = null;
    if (e.key === 'ArrowRight') next = PHONE_SCREENS[(i + 1) % PHONE_SCREENS.length];
    else if (e.key === 'ArrowLeft') next = PHONE_SCREENS[(i - 1 + PHONE_SCREENS.length) % PHONE_SCREENS.length];
    else if (e.key === 'Home') next = PHONE_SCREENS[0];
    else if (e.key === 'End') next = PHONE_SCREENS[PHONE_SCREENS.length - 1];
    if (next === null) return;
    e.preventDefault();
    onSelect(next);
    // Roving focus follows the selection (the tablist pattern).
    if (typeof document !== 'undefined') document.getElementById(tabId(next))?.focus?.();
  };
  const label = (s) => (s === PHONE_SCREEN.BOARD ? COPY.cockpitSwitchBoard : COPY.cockpitSwitchCockpit(needsYou));
  return (
    <div
      role="tablist"
      aria-label={COPY.cockpitSwitchName}
      data-board-cockpit-switch="1"
      onKeyDown={onKeyDown}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: `repeat(${PHONE_SCREENS.length}, minmax(0, 1fr))`,
        padding: 3,
        borderRadius: 11,
        background: `rgba(var(--ft-shadow-rgb), 0.35)`,
        border: `1px solid rgba(var(--ft-scrim-rgb), 0.08)`,
      }}
    >
      {PHONE_SCREENS.map((s) => {
        const selected = s === screen;
        return (
          <button
            key={s}
            type="button"
            role="tab"
            id={tabId(s)}
            aria-selected={selected ? 'true' : 'false'}
            aria-controls={panelId(s)}
            tabIndex={selected ? 0 : -1}
            data-board-cockpit-tab={s}
            onClick={() => onSelect(s)}
            style={{
              position: 'relative',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              minHeight: 36,
              padding: '0 12px',
              color: selected ? cssVar('text-primary') : cssVar('text-secondary'),
            }}
          >
            {selected ? (
              <motion.span
                layoutId="board-cockpit-thumb"
                aria-hidden="true"
                data-board-cockpit-thumb="1"
                transition={motionToken('smooth', { reducedMotion })}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 8,
                  background: `rgba(var(--ft-teal-rgb), 0.14)`,
                  boxShadow: `inset 0 0 0 1px rgba(var(--ft-teal-rgb), 0.35)`,
                }}
              />
            ) : null}
            <span style={{ position: 'relative', fontSize: 12.5, fontWeight: selected ? 700 : 500, lineHeight: 1.2 }}>{label(s)}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The two-screen track. `screen` is the selected screen; `onScreen` is told
 * when a SWIPE settles on the other one. A change of `screen` from outside
 * (the switch) scrolls the track.
 *
 * @param {boolean} [props.lockCockpit]  the cockpit screen's scroller holds still (the sheet is open)
 */
export function BoardCockpitTrack({ screen, onScreen, reducedMotion = false, board, cockpit, cockpitScrollRef = null, lockCockpit = false }) {
  const trackRef = React.useRef(null);
  const index = Math.max(0, PHONE_SCREENS.indexOf(screen));
  const screenRef = React.useRef(screen);
  screenRef.current = screen;
  const onScreenRef = React.useRef(onScreen);
  onScreenRef.current = onScreen;
  const fromSwipe = React.useRef(false);
  const positioned = React.useRef(false);
  const idle = React.useRef(null);

  // The SWITCH moved the selection: scroll the track there. A selection the
  // track itself reported (a settled swipe) is already on screen. The first
  // position is set without animation.
  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    if (fromSwipe.current) { fromSwipe.current = false; positioned.current = true; return; }
    const left = index * el.clientWidth;
    const first = !positioned.current;
    positioned.current = true;
    if (Math.abs(el.scrollLeft - left) < 2) return;
    const behavior = first || reducedMotion ? 'auto' : 'smooth';
    if (typeof el.scrollTo === 'function') el.scrollTo({ left, behavior });
    else el.scrollLeft = left;
  }, [index, reducedMotion]);

  // SETTLED: the screen the track rests on becomes the selection.
  const settle = React.useCallback(() => {
    if (idle.current) { clearTimeout(idle.current); idle.current = null; }
    const el = trackRef.current;
    if (!el || el.clientWidth <= 0) return;
    const nearest = PHONE_SCREENS[Math.min(PHONE_SCREENS.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth)))];
    if (nearest && nearest !== screenRef.current) {
      fromSwipe.current = true;
      onScreenRef.current?.(nearest);
    }
  }, []);

  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    el.addEventListener('scrollend', settle);
    return () => {
      el.removeEventListener('scrollend', settle);
      if (idle.current) { clearTimeout(idle.current); idle.current = null; }
    };
  }, [settle]);

  const onScroll = () => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(settle, TRACK_SETTLE_IDLE_MS);
  };

  const panel = (s, content, { ref = null, locked = false } = {}) => (
    <div
      key={s}
      ref={ref}
      role="tabpanel"
      id={panelId(s)}
      aria-labelledby={tabId(s)}
      data-board-cockpit-panel={s}
      // The off-screen half stays MOUNTED (the board's state and the feed's
      // scroll survive a swipe) but is inert: out of the tab order and the
      // accessibility tree while it is not the selection.
      inert={s !== screen}
      aria-hidden={s !== screen ? 'true' : undefined}
      style={{ flex: '0 0 100%', minWidth: 0, minHeight: 0, overflowY: locked ? 'hidden' : 'auto', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
    >
      {content}
    </div>
  );

  return (
    <div
      ref={trackRef}
      data-board-cockpit-track="1"
      data-board-cockpit-screen={screen}
      onScroll={onScroll}
      style={{
        flex: '1 1 0%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'row',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollSnapType: 'x mandatory',
        overscrollBehaviorX: 'contain',
        scrollbarWidth: 'none',
      }}
    >
      {panel(PHONE_SCREEN.BOARD, board)}
      {panel(PHONE_SCREEN.COCKPIT, cockpit, { ref: cockpitScrollRef, locked: lockCockpit })}
    </div>
  );
}
