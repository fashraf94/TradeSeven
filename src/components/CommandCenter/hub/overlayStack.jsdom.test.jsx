// @vitest-environment jsdom
//
// Command Center hub, slice S5 — the hub-level overlay stack (ruling R-S5-6;
// S1 review L3-12). Plain DOM first (hub/overlayStack.js), then React's side
// (hub/HubOverlays.jsx). Elements stand in for App's root, the strip, a toast
// portal and the overlays; the rows prove the marks and the focus, which jsdom
// does compute.

import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { HubOverlayProvider, useHubModalOpen, useHubOverlays } from './HubOverlays';
import { createOverlayStack, inertSiblings } from './overlayStack';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let created = [];
function el(tag = 'div', { id, parent = document.body, inert = false } = {}) {
  const node = document.createElement(tag);
  if (id) node.id = id;
  if (inert) node.setAttribute('inert', '');
  parent.appendChild(node);
  created.push(node);
  return node;
}
const button = (parent, label = 'b') => {
  const b = el('button', { parent });
  b.textContent = label;
  return b;
};
const isInert = (node) => node.hasAttribute('inert');

let appRoot;
beforeEach(() => {
  created = [];
  appRoot = el('div', { id: 'root' });
});
afterEach(() => {
  for (const node of created) node.remove();
  created = [];
  document.body.innerHTML = '';
});

describe('inertSiblings — reference-counted (the primitive S1 wrote, now safe to nest)', () => {
  it('one caller: marks every body child but `keep`, and restores exactly what it marked', () => {
    const keep = el();
    const other = el();
    const already = el('div', { inert: true });
    const undo = inertSiblings(keep);
    expect([appRoot, other, already].map(isInert)).toEqual([true, true, true]);
    expect(isInert(keep)).toBe(false);
    undo();
    expect([appRoot, other].map(isInert)).toEqual([false, false]);
    // inert for a reason of its own before, so inert after
    expect(isInert(already)).toBe(true);
  });

  it('two callers: the first to let go does not un-inert what the second still holds (L3-12)', () => {
    const undoA = inertSiblings(null);
    const overlayA = el();
    const undoB = inertSiblings(overlayA);
    expect(isInert(appRoot)).toBe(true);
    expect(isInert(overlayA)).toBe(false);
    undoA();
    expect(isInert(appRoot)).toBe(true);
    undoB();
    expect(isInert(appRoot)).toBe(false);
  });

  it('the undo is idempotent: a second call neither throws nor drops another caller\'s hold', () => {
    const undoA = inertSiblings(null);
    const undoB = inertSiblings(null);
    undoA();
    undoA();
    expect(isInert(appRoot)).toBe(true);
    undoB();
    expect(isInert(appRoot)).toBe(false);
  });

  it('an element another caller marked is held again, not skipped as "already inert" (the S1 snapshot bug)', () => {
    const undoA = inertSiblings(null);
    const undoB = inertSiblings(null);
    undoB();
    expect(isInert(appRoot)).toBe(true);
    undoA();
    expect(isInert(appRoot)).toBe(false);
  });
});

describe('createOverlayStack — the background and modalOpen', () => {
  it('open marks the background inert and modalOpen true; the last close restores it', () => {
    const changes = [];
    const stack = createOverlayStack({ onChange: (open) => changes.push(open) });
    expect(stack.modalOpen).toBe(false);
    stack.open('a');
    expect(isInert(appRoot)).toBe(true);
    expect(stack.modalOpen).toBe(true);
    stack.close('a', { focus: false });
    expect(isInert(appRoot)).toBe(false);
    expect(stack.modalOpen).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it('onChange fires on the first open and the last close only, not for every overlay between', () => {
    const changes = [];
    const stack = createOverlayStack({ onChange: (open) => changes.push(open) });
    stack.open('a');
    stack.open('b');
    stack.open('c');
    stack.close('b', { focus: false });
    stack.close('a', { focus: false });
    expect(changes).toEqual([true]);
    stack.close('c', { focus: false });
    expect(changes).toEqual([true, false]);
  });

  it('two overlays closed in the order they opened keep #root inert until the LAST closes (L3-12)', () => {
    const stack = createOverlayStack();
    stack.open('a');
    stack.open('b');
    stack.close('a', { focus: false });
    expect(isInert(appRoot)).toBe(true);
    expect(stack.modalOpen).toBe(true);
    stack.close('b', { focus: false });
    expect(isInert(appRoot)).toBe(false);
    expect(stack.modalOpen).toBe(false);
  });

  it('closed in reverse, the lower overlay and the background are both held to the end', () => {
    const stack = createOverlayStack();
    stack.open('a');
    const overlayA = el('div', { id: 'overlay-a' });
    stack.open('b');
    expect(isInert(overlayA)).toBe(true);
    stack.close('b', { focus: false });
    expect(isInert(overlayA)).toBe(false);
    expect(isInert(appRoot)).toBe(true);
    stack.close('a', { focus: false });
    expect(isInert(appRoot)).toBe(false);
  });

  it('only the top overlay is interactive: the one beneath it is inert while it is open', () => {
    const stack = createOverlayStack();
    stack.open('a');
    const overlayA = el('div', { id: 'overlay-a' });
    stack.open('b');
    const overlayB = el('div', { id: 'overlay-b' });
    expect(isInert(overlayA)).toBe(true);
    expect(isInert(overlayB)).toBe(false);
    stack.releaseAll();
  });

  it('a legacy sheet\'s portal, created after the open, is not marked (registered BEFORE it mounts)', () => {
    const stack = createOverlayStack();
    stack.open('legacy:record');
    const portal = el('div', { id: 'legacy-portal' });
    expect(isInert(portal)).toBe(false);
    expect(isInert(appRoot)).toBe(true);
    stack.close('legacy:record', { focus: false });
    expect(isInert(portal)).toBe(false);
  });

  it('opening an id that is already open does nothing; closing one that is not open does nothing', () => {
    const changes = [];
    const stack = createOverlayStack({ onChange: (open) => changes.push(open) });
    stack.open('a');
    stack.open('a');
    expect(stack.depth).toBe(1);
    stack.close('zzz');
    stack.close('a', { focus: false });
    stack.close('a', { focus: false });
    expect(changes).toEqual([true, false]);
    expect(isInert(appRoot)).toBe(false);
  });

  it('an element inert for its own reason stays inert through any number of overlays', () => {
    const own = el('div', { inert: true });
    const stack = createOverlayStack();
    stack.open('a');
    stack.open('b');
    stack.close('a', { focus: false });
    stack.close('b', { focus: false });
    expect(isInert(own)).toBe(true);
    expect(isInert(appRoot)).toBe(false);
  });
});

describe('createOverlayStack — focus returns to each overlay\'s opener', () => {
  it('one overlay: focus goes back to its opener', () => {
    const opener = button(appRoot, 'open');
    opener.focus();
    const stack = createOverlayStack();
    stack.open('a', { opener });
    expect(isInert(appRoot)).toBe(true);
    // A real browser drops focus the moment its container goes inert (jsdom does not), so the row does it:
    // without this the opener would "keep" focus throughout and the return could never fail.
    opener.blur();
    expect(document.activeElement).toBe(document.body);
    stack.close('a');
    expect(document.activeElement).toBe(opener);
  });

  it('nested, closed top-first: each close returns to its own opener', () => {
    const openerA = button(appRoot, 'a');
    const stack = createOverlayStack();
    stack.open('a', { opener: openerA });
    const dialogA = el('div', { id: 'dialog-a' });
    const openerB = button(dialogA, 'b');
    stack.open('b', { opener: openerB });
    stack.close('b');
    expect(document.activeElement).toBe(openerB);
    stack.close('a');
    expect(document.activeElement).toBe(openerA);
  });

  it('closed out of order: the lower one closes without stealing focus, and the upper one hands it on to the lower one\'s opener when its own is gone', () => {
    const openerA = button(appRoot, 'a');
    const stack = createOverlayStack();
    stack.open('a', { opener: openerA });
    const dialogA = el('div', { id: 'dialog-a' });
    const openerB = button(dialogA, 'b');
    stack.open('b', { opener: openerB });
    const focusedInB = button(el('div', { id: 'dialog-b' }), 'x');
    focusedInB.focus();
    stack.close('a');
    // A closed beneath B: nothing moves, the background is still held for B
    expect(document.activeElement).toBe(focusedInB);
    expect(isInert(appRoot)).toBe(true);
    dialogA.remove(); // A's DOM goes with it, taking B's opener with it
    stack.close('b');
    expect(document.activeElement).toBe(openerA);
    expect(isInert(appRoot)).toBe(false);
  });

  it('an opener that cannot take focus (removed, disabled, or inside something inert) yields to the fallback, never <body>', () => {
    const fallback = el('section', { id: 'hub-root' });
    fallback.tabIndex = -1;
    const removed = button(appRoot, 'gone');
    const stack = createOverlayStack();
    stack.open('a', { opener: removed });
    removed.remove();
    stack.close('a', { fallback });
    expect(document.activeElement).toBe(fallback);

    const disabled = button(appRoot, 'disabled');
    stack.open('b', { opener: disabled });
    disabled.disabled = true;
    stack.close('b', { fallback });
    expect(document.activeElement).toBe(fallback);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('an opener inside something inert for its own reason cannot take focus either: the fallback does', () => {
    const fallback = el('section', { id: 'hub-root' });
    fallback.tabIndex = -1;
    const frozen = el('div', { inert: true });
    const trapped = button(frozen, 'trapped');
    const stack = createOverlayStack();
    stack.open('a', { opener: trapped });
    stack.close('a', { fallback });
    expect(document.activeElement).toBe(fallback);
  });

  it('the fallback is for an emptied stack only: with an overlay still open, an unusable opener leaves focus where it is', () => {
    const fallback = el('section', { id: 'hub-root' });
    fallback.tabIndex = -1;
    const stack = createOverlayStack();
    stack.open('a', { opener: button(appRoot, 'a') });
    const dialogA = el('div');
    const inA = button(dialogA, 'in a');
    const gone = button(dialogA, 'b');
    stack.open('b', { opener: gone });
    inA.focus();
    gone.remove();
    stack.close('b', { fallback });
    expect(document.activeElement).not.toBe(fallback);
    stack.releaseAll();
  });

  it('closing with focus:false (an unmount) moves no focus', () => {
    const opener = button(appRoot, 'open');
    const elsewhere = button(el('div'), 'elsewhere');
    const stack = createOverlayStack();
    stack.open('a', { opener });
    elsewhere.focus();
    stack.close('a', { focus: false });
    expect(document.activeElement).toBe(elsewhere);
  });

  it('releaseAll frees every mark at once and moves no focus; a later close of a released id is a no-op', () => {
    const opener = button(appRoot, 'open');
    const elsewhere = button(el('div'), 'elsewhere');
    const stack = createOverlayStack();
    stack.open('a', { opener });
    stack.open('b');
    elsewhere.focus();
    stack.releaseAll();
    expect(isInert(appRoot)).toBe(false);
    expect(stack.depth).toBe(0);
    expect(document.activeElement).toBe(elsewhere);
    stack.close('a');
    expect(document.activeElement).toBe(elsewhere);
  });
});

describe('HubOverlays — React\'s side', () => {
  let host;
  let root;
  let api;

  function Probe() {
    api = { stack: useHubOverlays(), modalOpen: useHubModalOpen() };
    return <span data-probe={String(api.modalOpen)} />;
  }
  const mount = () => {
    host = el('div', { id: 'hub-host' });
    root = createRoot(host);
    act(() => { root.render(<HubOverlayProvider><Probe /></HubOverlayProvider>); });
  };
  afterEach(() => {
    if (root) act(() => { root.unmount(); });
    root = null;
    api = null;
  });

  it('modalOpen follows the stack', () => {
    mount();
    expect(host.querySelector('[data-probe]').getAttribute('data-probe')).toBe('false');
    act(() => { api.stack.open('a'); });
    expect(host.querySelector('[data-probe]').getAttribute('data-probe')).toBe('true');
    act(() => { api.stack.open('b'); });
    act(() => { api.stack.close('a', { focus: false }); });
    expect(host.querySelector('[data-probe]').getAttribute('data-probe')).toBe('true');
    act(() => { api.stack.close('b', { focus: false }); });
    expect(host.querySelector('[data-probe]').getAttribute('data-probe')).toBe('false');
  });

  it('a hub that unmounts with an overlay open (the Forge replaced the dashboard) leaves #root interactive', () => {
    mount();
    act(() => { api.stack.open('legacy:watchlist', { opener: null }); });
    expect(isInert(appRoot)).toBe(true);
    act(() => { root.unmount(); });
    root = null;
    expect(isInert(appRoot)).toBe(false);
  });

  it('outside any provider a sheet still gets a working stack, and modalOpen reads false', () => {
    const lone = el('div');
    const loneRoot = createRoot(lone);
    let seen;
    function Alone() {
      seen = { stack: useHubOverlays(), modalOpen: useHubModalOpen() };
      return null;
    }
    act(() => { loneRoot.render(<Alone />); });
    expect(seen.modalOpen).toBe(false);
    seen.stack.open('x');
    expect(isInert(appRoot)).toBe(true);
    seen.stack.close('x', { focus: false });
    expect(isInert(appRoot)).toBe(false);
    act(() => { loneRoot.unmount(); });
  });
});

describe('the console stays quiet', () => {
  it('opening and closing log nothing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const stack = createOverlayStack();
    stack.open('a');
    stack.close('a');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
