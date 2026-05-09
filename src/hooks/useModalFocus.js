// src/hooks/useModalFocus.js
//
// Sprint 6 Phase 3.6 Session 2 (Finding 9): focus management for modal
// dialogs. Pairs with role="dialog" + aria-modal="true" on the modal
// container.
//
// Behaviors:
//   - On modal open: capture document.activeElement so it can be restored
//     on close; auto-focus the autoFocusRef target if provided.
//   - On modal close: restore focus to the element that had it before
//     opening (defensive: try/catch + DOM-presence check).
//   - While modal open: trap Tab / Shift+Tab within containerRef so
//     keyboard focus can't escape into background content.
//
// Background-content aria-hidden is intentionally NOT applied here. Modal
// containers already have aria-modal="true" which is the modern WAI-ARIA
// signal of modality and is what current screen readers respect; combining
// it with aria-hidden on background can confuse some AT (per WAI-ARIA
// Authoring Practices). For our DOM (modals are children of #root rather
// than portaled to body), aria-modal is the correct contract.
//
// Usage:
//   useModalFocus({
//     isOpen,                  // boolean — toggles the hook on/off
//     autoFocusRef,            // ref to the element that should receive
//                              //   focus on open (e.g., a textarea)
//     containerRef,            // ref to the dialog element for the
//                              //   focus-trap boundary
//   });

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
}

export function useModalFocus({ isOpen, autoFocusRef, containerRef }) {
  const previouslyFocusedRef = useRef(null);

  // Capture activeElement on open + autoFocus the target. requestAnimationFrame
  // gives the modal one paint cycle to mount + settle before grabbing focus —
  // matches the entry animation start so the focus shift doesn't fight the
  // mount.
  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocusedRef.current = document.activeElement;

    const raf = requestAnimationFrame(() => {
      const target = autoFocusRef && autoFocusRef.current;
      if (target && typeof target.focus === 'function') {
        try {
          target.focus();
        } catch {
          // Best-effort — element may not be focusable for unrelated reasons.
        }
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      // Restore on close. Defensive: element may have been removed from
      // the DOM, may not be focusable anymore, etc.
      const el = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (
        el &&
        typeof el.focus === 'function' &&
        document.body.contains(el)
      ) {
        try {
          el.focus();
        } catch {
          // Best-effort.
        }
      }
    };
  }, [isOpen, autoFocusRef]);

  // Focus trap — Tab / Shift+Tab wrap to first/last focusable within
  // containerRef. Mounted only while open.
  useEffect(() => {
    if (!isOpen) return undefined;
    const container = containerRef && containerRef.current;
    if (!container) return undefined;

    function onKeyDown(e) {
      if (e.key !== 'Tab') return;
      const focusable = getFocusableElements(container);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab from first (or anywhere outside the trap) → last
        if (
          document.activeElement === first ||
          !container.contains(document.activeElement)
        ) {
          e.preventDefault();
          try {
            last.focus();
          } catch {
            // Best-effort.
          }
        }
      } else {
        // Tab from last → first
        if (document.activeElement === last) {
          e.preventDefault();
          try {
            first.focus();
          } catch {
            // Best-effort.
          }
        }
      }
    }

    container.addEventListener('keydown', onKeyDown);
    return () => container.removeEventListener('keydown', onKeyDown);
  }, [isOpen, containerRef]);
}

export default useModalFocus;
