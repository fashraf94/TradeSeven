// src/screens/battleView/useCharacterPane.js
//
// THE PANE'S MACHINE — Phase A3 (A3.2, D-91 / D-93).
//
// TWO STATES, NOT THREE DETENTS (brief §1). `useChatSheet` gave both shells one
// three-detent ladder because the conversation lived in a drawer and a strip;
// the pane is a place, and a place is either open or it is not. What replaces
// the third detent is a SECTION — Chat, Bench or Tape — which is what the pane
// is showing, not how far it is pulled.
//
// THE FIVE TRANSITIONS (the seed's own list):
//
//   closed          openPane('chat')   → open on Chat
//   open on Chat    setSection('bench')→ open on Bench
//   open            close()            → closed, and the section is REMEMBERED
//   closed          openPane()         → open on the remembered section
//   any             disabled           → closed, section reset
//
// "Expand restores the last section" is why `sectionRef` outlives `open`: a
// player who was reading Bench, collapsed the pane to see the board, and
// expanded it again is put back where they were. Opening THROUGH A DOOR is the
// exception — `In the chat · n` and `Read the full check` name their section,
// and a named section always wins over the remembered one.
//
// WHAT LIVES HERE AND WHAT DOES NOT. This hook owns state and the ONE global
// side effect that belongs to the state rather than to any node: the mobile
// body-scroll lock, whose shape is lifted from the Game Tape's own
// (AgentBattleScreen, review L2-F10) — capture the previous value, restore it
// on close AND on unmount, never assume it was ''. Focus lives in the COMPONENT
// (CharacterPane.jsx), as it does for the sheet: it needs the DOM nodes, and
// the return-focus target is recorded here only as a ref the component reads.
//
// HOOKS STAY UNCONDITIONAL (hazard 44). The screen calls this on every render
// and passes `enabled`; it is never skipped behind a flag test.
//
// COCKPIT BUILD 2a (spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md §5): the sections
// are COMPUTED from shell × cockpit-on (`paneSectionsFor`, the SearchDiscover
// / BackingDesk precedent) — desktop with the cockpit on shows
// Cockpit · Chat · Bench · Tape, everything else the shipped Chat · Bench ·
// Tape. The list's DEFAULT shows until the player (or a door) names a section;
// a remembered section that is no longer in the list is REPAIRED to the list's
// first entry (the BackingScreen repair), so a section with no panel never
// shows. With the shipped list and the Chat default this hook behaves exactly
// as it did: the off path is the same machine.

import { useCallback, useEffect, useRef, useState } from 'react';

/** The pane's sections. COCKPIT exists only on the desktop list while the battle is cockpit-on. */
export const PANE_SECTION = Object.freeze({
  CHAT: 'chat',
  BENCH: 'bench',
  TAPE: 'tape',
  COCKPIT: 'cockpit',
});

/** The shipped list, in the order the segmented control shows it — the off path. */
export const PANE_SECTIONS = Object.freeze([
  PANE_SECTION.CHAT,
  PANE_SECTION.BENCH,
  PANE_SECTION.TAPE,
]);

/** The desktop list while the battle is cockpit-on (spec §5): Cockpit first. */
export const COCKPIT_PANE_SECTIONS = Object.freeze([
  PANE_SECTION.COCKPIT,
  PANE_SECTION.CHAT,
  PANE_SECTION.BENCH,
  PANE_SECTION.TAPE,
]);

/**
 * The pane's sections for a shell. The phone keeps Chat · Bench · Tape behind
 * the mark whatever the cockpit says (its cockpit is a main screen, §6).
 */
export function paneSectionsFor({ isDesktop = false, cockpitOn = false } = {}) {
  return isDesktop && cockpitOn ? COCKPIT_PANE_SECTIONS : PANE_SECTIONS;
}

/** Is this a section of the given list? An unknown one is never rendered. */
export function isPaneSection(value, sections = PANE_SECTIONS) {
  return sections.includes(value);
}

/**
 * The section that SHOWS: the remembered one while it is in the list; else,
 * when one was remembered, the list's first entry (the repair); else the
 * list's default. Pure — the hook and its tests share it.
 */
export function effectiveSection(chosen, sections = PANE_SECTIONS, defaultSection = PANE_SECTION.CHAT) {
  if (chosen !== null && sections.includes(chosen)) return chosen;
  if (chosen !== null) return sections[0];
  return sections.includes(defaultSection) ? defaultSection : sections[0];
}

/**
 * The pane.
 *
 * @param {boolean} enabled            the pane flag, resolved by the caller
 * @param {object}  [options]
 * @param {boolean} [options.lockScroll]  lock the body while open — the mobile
 *   shell, where the pane covers the board. False on desktop, where the pane is
 *   a column beside a board that must keep scrolling.
 * @param {boolean} [options.openByDefault]  this shell OPENS with the pane
 *   showing, until the player says otherwise. True on desktop (the brief's
 *   resting working state), false on the phone.
 * @param {string[]} [options.sections]  the computed list (paneSectionsFor);
 *   the shipped list by default
 * @param {string} [options.defaultSection]  what shows until a section is
 *   named — Cockpit on the desktop while cockpit-on, else Chat
 * @returns {{
 *   open: boolean, section: string,
 *   openPane: (section?: string|null, invoker?: any) => void,
 *   setSection: (section: string) => void,
 *   close: () => void,
 *   returnFocusRef: {current: any},
 * }}
 */
export function useCharacterPane(enabled, { lockScroll = false, openByDefault = false, sections = PANE_SECTIONS, defaultSection = PANE_SECTION.CHAT } = {}) {
  const [open, setOpen] = useState(Boolean(openByDefault));
  // The REMEMBERED section: null until the player or a door names one — until
  // then the list's default shows (Build 2a: Cockpit, while cockpit-on).
  const [section, setSectionState] = useState(null);
  const returnFocusRef = useRef(null);
  // Whether the PLAYER has ever moved the pane. `useChatSheet`'s own
  // `touchedRef`, for the same reason (review L2-F6): a shell's untouched
  // OPENING default is not a choice, so a session that started on a phone and
  // was widened should arrive on the desktop's default rather than on a board
  // with no pane and no sign that one exists.
  const touchedRef = useRef(false);

  const openPane = useCallback((next = null, invoker = null) => {
    touchedRef.current = true;
    setOpen((wasOpen) => {
      // The return-focus target is recorded on the CLOSED → OPEN edge only, so
      // a door pressed while the pane is already open does not overwrite the
      // control that first opened it (the sheet's own rule).
      if (!wasOpen) returnFocusRef.current = invoker;
      return true;
    });
    // A NAMED SECTION WINS over the remembered one. Passing nothing is the
    // "expand" case and restores what was last shown.
    if (isPaneSection(next, sections)) setSectionState(next);
  }, [sections]);

  const setSection = useCallback((next) => {
    if (!isPaneSection(next, sections)) return;
    touchedRef.current = true;
    setSectionState(next);
  }, [sections]);

  const close = useCallback(() => {
    touchedRef.current = true;
    // The section is deliberately NOT reset: collapsing is not leaving.
    setOpen(false);
  }, []);

  // A shell the player has not spoken to OPENS at its own default when that
  // default is open — the desktop, where the brief's resting working state is
  // the pane open on Chat (§5 deliverable 1) and the A2 column it replaces
  // opened at HALF. Asymmetric on purpose, exactly as the sheet's is: nothing
  // untouched is pushed OPEN on the way to a phone, where the pane covers the
  // board. Once the player has moved it, the state is theirs in both
  // directions.
  useEffect(() => {
    if (touchedRef.current || !openByDefault) return;
    setOpen(true);
  }, [openByDefault]);

  // Disabled, the pane is closed and forgets where it was. Same shape as the
  // sheet's reset, and the reason the flag can be read at render scope without
  // anything stale surviving a flip.
  useEffect(() => {
    if (enabled) return;
    setOpen(false);
    setSectionState(null);
    touchedRef.current = false;
  }, [enabled]);

  // THE BODY SCROLL LOCK (mobile only). The page beneath must not scroll under
  // a pane that covers it — the Game Tape's precedent, including the part that
  // matters: capture the PREVIOUS value and restore that, rather than clearing
  // to '', so two overlapping locks cannot leave the document unscrollable.
  const shouldLock = Boolean(enabled && open && lockScroll);
  useEffect(() => {
    if (!shouldLock) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [shouldLock]);

  return {
    open: Boolean(enabled && open),
    section: enabled ? effectiveSection(section, sections, defaultSection) : PANE_SECTION.CHAT,
    openPane,
    setSection,
    close,
    returnFocusRef,
  };
}

export default useCharacterPane;
