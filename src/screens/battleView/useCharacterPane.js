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

import { useCallback, useEffect, useRef, useState } from 'react';

/** The pane's sections, in the order the segmented control shows them. */
export const PANE_SECTION = Object.freeze({
  CHAT: 'chat',
  BENCH: 'bench',
  TAPE: 'tape',
});

export const PANE_SECTIONS = Object.freeze([
  PANE_SECTION.CHAT,
  PANE_SECTION.BENCH,
  PANE_SECTION.TAPE,
]);

/** Is this a section this phase knows? An unknown one is never rendered. */
export function isPaneSection(value) {
  return PANE_SECTIONS.includes(value);
}

/**
 * The pane.
 *
 * @param {boolean} enabled            the pane flag, resolved by the caller
 * @param {object}  [options]
 * @param {boolean} [options.lockScroll]  lock the body while open — the mobile
 *   shell, where the pane covers the board. False on desktop, where the pane is
 *   a column beside a board that must keep scrolling.
 * @returns {{
 *   open: boolean, section: string,
 *   openPane: (section?: string|null, invoker?: any) => void,
 *   setSection: (section: string) => void,
 *   close: () => void,
 *   returnFocusRef: {current: any},
 * }}
 */
export function useCharacterPane(enabled, { lockScroll = false } = {}) {
  const [open, setOpen] = useState(false);
  const [section, setSectionState] = useState(PANE_SECTION.CHAT);
  const returnFocusRef = useRef(null);

  const openPane = useCallback((next = null, invoker = null) => {
    setOpen((wasOpen) => {
      // The return-focus target is recorded on the CLOSED → OPEN edge only, so
      // a door pressed while the pane is already open does not overwrite the
      // control that first opened it (the sheet's own rule).
      if (!wasOpen) returnFocusRef.current = invoker;
      return true;
    });
    // A NAMED SECTION WINS over the remembered one. Passing nothing is the
    // "expand" case and restores what was last shown.
    if (isPaneSection(next)) setSectionState(next);
  }, []);

  const setSection = useCallback((next) => {
    if (!isPaneSection(next)) return;
    setSectionState(next);
  }, []);

  const close = useCallback(() => {
    // The section is deliberately NOT reset: collapsing is not leaving.
    setOpen(false);
  }, []);

  // Disabled, the pane is closed and forgets where it was. Same shape as the
  // sheet's reset, and the reason the flag can be read at render scope without
  // anything stale surviving a flip.
  useEffect(() => {
    if (enabled) return;
    setOpen(false);
    setSectionState(PANE_SECTION.CHAT);
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
    section: enabled ? section : PANE_SECTION.CHAT,
    openPane,
    setSection,
    close,
    returnFocusRef,
  };
}

export default useCharacterPane;
