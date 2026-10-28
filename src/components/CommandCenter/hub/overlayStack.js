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
//     If nothing it is owed can take it, focus lands in the overlay still open
//     (one registered with `keep`), else on the fallback the caller names.
//
// The engine is `inertSiblings`, now reference-counted: each call holds every
// element it marks, and an element comes out of inert only when the LAST holder
// releases it. Its single-caller behaviour is S1's, exactly (an element already
// inert for another reason is left alone, and only what a call marked is
// restored), so the primitive's own rows pass unchanged.
//
// TWO WAYS TO REGISTER, by what the caller can name:
//   keep    the overlay's own root, when it exists at registration (HubSheet,
//           which registers in an effect after its portal is in <body>). Every
//           other child of <body> goes inert, lower overlays included.
//   within  an element of the hub, when the overlay's DOM is not the caller's
//           to name (the shipped sheets portal straight into <body> from
//           components S5 does not change). Only the APP ROOT that element sits
//           in goes inert — plus the roots of any lower overlay registered with
//           `keep`. Never "every body child": a shipped sheet that has just been
//           closed keeps its DOM in <body> while it animates out, and re-opened
//           inside that window it re-uses that very node, so marking "every body
//           child" at registration would mark the sheet that is about to open and
//           leave the page with nothing interactive. A lower overlay registered
//           with `within` has no root this stack can name, so a `within` overlay
//           opened over another `within` overlay leaves the lower one unmarked.
// Registering an overlay whose DOM already exists WITHOUT `keep` or `within`
// marks that overlay itself inert: say which one you are. An overlay registered
// with NEITHER has no root this stack can name, so when the overlay above it
// closes onto an opener that cannot take focus, there is nowhere inside it to
// send focus and it stays where it is. `useHubOverlays()` outside a
// <HubOverlayProvider> returns a private stack of its own (hub/HubOverlays.jsx):
// anything the hub's `modalOpen` must count renders inside the provider.

const holds = new WeakMap();

/**
 * Mark inert and return the undo (idempotent). By default every child of <body>
 * except `keep`; with `only`, exactly those elements. An element already inert
 * for a reason of its own is left alone; one an earlier call is holding gains a
 * hold and stays inert until the last holder lets go.
 */
export function inertSiblings(keep, only = null) {
  const held = [];
  const candidates = Array.isArray(only) ? only.filter(Boolean) : Array.from(document.body.children);
  for (const el of candidates) {
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

/** The app root an element sits in: its ancestor that is a direct child of <body>, or null (a detached element has none). */
export function appRootOf(element) {
  return element ? element.closest('body > *') : null;
}

const canFocus = (el) => Boolean(el) && typeof el.focus === 'function' && el.isConnected && !el.disabled && !el.closest('[inert]');

/** Focus an element that can take it (connected, enabled, not inert); true when it did. The deploy provider's overlays use it too. */
export function tryFocus(el) {
  if (!canFocus(el)) return false;
  el.focus();
  return document.activeElement === el;
}

/**
 * The opener a sheet's close could not give focus back to because the page was inert under the deploy provider's own
 * overlay — a Scouting Board deploy that answers "created" closes the board while the ceremony is up. The provider hands
 * it back when its overlay closes (founder ruling Q-S8F-1). One at a time, taken once.
 */
let owedFocus = null;

/** The opener a close still owes focus to, or null; taking it clears it. */
export function takeOwedFocus() {
  const owed = owedFocus;
  owedFocus = null;
  return owed;
}

/** Where focus can go inside an overlay that is still open: its dialog, else its root. */
function homeOf(entry) {
  const root = entry?.keep;
  if (!root || !root.isConnected) return null;
  return root.querySelector('[role="dialog"]') || root;
}

/**
 * A stack of overlays, bottom to top. `onChange(open)` fires when the stack
 * becomes non-empty and when it empties again (by closing or by `releaseAll`).
 */
export function createOverlayStack({ onChange = null } = {}) {
  const entries = [];
  // Openers of overlays closed while another sat above them, oldest first: tried,
  // newest first, once the overlays above them have closed, and kept until they
  // are used or the stack empties.
  let stranded = [];

  return {
    get modalOpen() { return entries.length > 0; },
    get depth() { return entries.length; },

    /**
     * @param {string} id           unique per overlay; opening an id already open does nothing
     * @param {Element|null} opener the control to give focus back to
     * @param {Element|null} keep   an element that must stay interactive (the overlay's own root, when it already exists)
     * @param {Element|null} within an element of the hub: mark only the app root it sits in, not every child of <body>
     */
    open(id, { opener = null, keep = null, within = null } = {}) {
      if (entries.some((entry) => entry.id === id)) return;
      const root = within ? appRootOf(within) : null;
      const only = root ? [root, ...entries.map((entry) => entry.keep)] : null;
      entries.push({ id, opener, keep, undo: inertSiblings(keep, only) });
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
          // Its own opener first, then the openers of overlays closed out of order beneath it, newest first.
          const targets = [entry.opener, ...[...stranded].reverse()];
          const landedAt = targets.findIndex(tryFocus);
          // A stranded opener that took focus is spent, and so are the newer ones that could not; older ones stay owed.
          if (landedAt > 0) stranded = stranded.slice(0, stranded.length - landedAt);
          if (landedAt < 0) {
            const below = entries[entries.length - 1];
            const landed = below ? tryFocus(homeOf(below)) : tryFocus(fallback);
            // Nothing could take it because the page is inert under another overlay: the opener is owed (Q-S8F-1).
            if (!landed && !below && entry.opener?.isConnected && entry.opener.closest('[inert]')) owedFocus = entry.opener;
          }
        }
      }
      if (entries.length === 0) {
        stranded = [];
        if (onChange) onChange(false);
      }
    },

    /** Free everything without touching focus: the hub is going away (the Forge opened, a site flip, a sign-out). */
    releaseAll() {
      const open = entries.splice(0);
      stranded = [];
      for (const entry of open.reverse()) entry.undo();
      if (open.length > 0 && onChange) onChange(false);
    },
  };
}
