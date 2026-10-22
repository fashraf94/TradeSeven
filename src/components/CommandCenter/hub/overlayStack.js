// src/components/CommandCenter/hub/overlayStack.js
//
// Command Center hub, slice S5 — the ONE hub-level overlay stack (ruling
// R-S5-6; the S1 report's "shared modal stack", review L3-12). This file is the
// stack itself, plain DOM and no React; hub/HubOverlays.jsx gives it to React.
//
// Every overlay the hub opens registers here: its own sheets (HubSheet) and the
// legacy sheets it mounts (the agent record, the archetype picker, the
// watchlist sheet, the traits sheet). While ANY is open:
//   - the background is inert — App's root with the strip and BottomNav, and
//     every overlay beneath the top one;
//   - `modalOpen` is true, the input S2b's deploy selector takes ("no control
//     may start while a sheet is open", spec §10);
// and when an overlay closes, in ANY order:
//   - the background stays inert until the LAST one has closed (L3-12: S1's
//     inertSiblings snapshotted <body> per sheet, so two sheets closing out of
//     order un-inerted #root while the second was still open);
//   - focus goes back to that overlay's opener, or, if it was closed out of
//     order, is handed on to the one above it and returned when that closes.
//
// The engine is `inertSiblings`, now reference-counted: each call holds every
// body child it marks, and an element comes out of inert only when the LAST
// holder releases it. Its single-caller behaviour is S1's, exactly (an element
// already inert for another reason is left alone, and only what a call marked
// is restored), so the primitive's own rows pass unchanged.
//
// The legacy sheets are shipped and unchanged: they render in a portal on
// <body> and manage neither inertness nor focus. The hub registers them from
// its own open state, in the click handler that opens them — BEFORE they mount,
// so the sheet's own portal is not among the children that get marked.

const holds = new WeakMap();

/**
 * Mark every child of <body> except `keep` inert and return the undo (idempotent).
 * An element already inert for a reason of its own is left alone; one an earlier
 * call is holding gains a hold and stays inert until the last holder lets go.
 */
export function inertSiblings(keep) {
  const held = [];
  for (const el of Array.from(document.body.children)) {
    if (el === keep) continue;
    const count = holds.get(el) || 0;
    if (count === 0 && el.hasAttribute('inert')) continue;
    holds.set(el, count + 1);
    if (count === 0) el.setAttribute('inert', '');
    held.push(el);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const el of held) {
      const left = (holds.get(el) || 1) - 1;
      if (left > 0) { holds.set(el, left); continue; }
      holds.delete(el);
      el.removeAttribute('inert');
    }
  };
}

const canFocus = (el) => Boolean(el) && typeof el.focus === 'function' && el.isConnected && !el.disabled && !el.closest('[inert]');

function tryFocus(el) {
  if (!canFocus(el)) return false;
  el.focus();
  return document.activeElement === el;
}

/**
 * A stack of overlays, bottom to top. `onChange(open)` fires when the stack
 * becomes non-empty and when it empties again.
 */
export function createOverlayStack({ onChange = null } = {}) {
  const entries = [];
  // Openers of overlays closed while another sat above them: tried, newest
  // first, after the one above has closed.
  let stranded = [];

  return {
    get modalOpen() { return entries.length > 0; },
    get depth() { return entries.length; },

    /**
     * @param {string} id           unique per overlay; opening an id already open does nothing
     * @param {Element|null} opener the control to give focus back to
     * @param {Element|null} keep   an element that must stay interactive (the overlay's own root, when it already exists)
     */
    open(id, { opener = null, keep = null } = {}) {
      if (entries.some((entry) => entry.id === id)) return;
      entries.push({ id, opener, undo: inertSiblings(keep) });
      if (entries.length === 1 && onChange) onChange(true);
    },

    /**
     * @param {string} id
     * @param {Element|null} fallback where focus lands if no opener can take it and nothing is left open
     * @param {boolean} focus         false to release without moving focus (an unmount)
     */
    close(id, { fallback = null, focus = true } = {}) {
      const at = entries.findIndex((entry) => entry.id === id);
      if (at < 0) return;
      const wasTop = at === entries.length - 1;
      const [entry] = entries.splice(at, 1);
      entry.undo();
      if (focus) {
        if (!wasTop) {
          stranded.push(entry.opener);
        } else {
          const targets = [entry.opener, ...stranded.reverse()];
          stranded = [];
          const landed = targets.some(tryFocus);
          if (!landed && entries.length === 0 && fallback && fallback.isConnected) fallback.focus();
        }
      }
      if (entries.length === 0) {
        stranded = [];
        if (onChange) onChange(false);
      }
    },

    /** Free everything without touching focus: the hub is going away (the Forge opened, a site switch, a sign-out). */
    releaseAll() {
      const open = entries.splice(0);
      stranded = [];
      for (const entry of open.reverse()) entry.undo();
    },
  };
}
