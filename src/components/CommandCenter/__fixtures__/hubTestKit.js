// src/components/CommandCenter/__fixtures__/hubTestKit.js
//
// Command Center hub, slice S1 — the hub tests' kit, for TESTS ONLY: a jsdom
// stand-in for layout, the token fixture, and a small mount / query set (the
// repo has no testing-library; the house pattern is react-dom/client + act).
//
// jsdom computes no layout, so the hub's ResizeObservers would read zero
// everywhere. This installs a ResizeObserver that tests can fire, and box
// sizes for the elements the hub measures:
//   [data-hub="shell"]     the hub root   → hubWidth
//   [data-ft-bottom-nav]   App's nav      → navHeight
//   [data-hub-strip]       the strip      → stripHeight
// Every other element keeps jsdom's own (zero) box. It proves the arithmetic
// the code is given, not real geometry; the headless-browser measurements in
// the S1 build report do that.

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const box = (width, height) => ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON() { return this; } });

export function installFakeLayout(initial = {}) {
  const state = { hubWidth: 1280, navHeight: 64, stripHeight: 66, ...initial };
  const observers = new Set();
  const originalRO = globalThis.ResizeObserver;
  const originalRect = Element.prototype.getBoundingClientRect;

  class FakeResizeObserver {
    constructor(callback) { this.callback = callback; this.targets = new Set(); this.options = new Map(); observers.add(this); }
    observe(target, options) { this.targets.add(target); this.options.set(target, options); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); observers.delete(this); }
  }

  globalThis.ResizeObserver = FakeResizeObserver;
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.matches?.('[data-hub="shell"]')) return box(state.hubWidth, 900);
    if (this.matches?.('[data-ft-bottom-nav]')) return box(state.hubWidth, state.navHeight);
    if (this.matches?.('[data-hub-strip]')) return box(state.hubWidth, state.stripHeight);
    return originalRect.call(this);
  };

  return {
    state,
    observers,
    /** Change the boxes and fire every live observer, as a resize would (inside act, so React commits). */
    resize(next) {
      Object.assign(state, next);
      act(() => {
        for (const o of [...observers]) o.callback([...o.targets].map((target) => ({ target })), o);
      });
    },
    restore() {
      globalThis.ResizeObserver = originalRO;
      Element.prototype.getBoundingClientRect = originalRect;
      observers.clear();
    },
  };
}

/** Inject src/theme/tokens.css so readToken() resolves (the cssTokens.test.js fixture: read, not imported). */
export function injectTokens() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(path.resolve(here, '..', '..', '..', 'theme', 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const style = document.createElement('style');
  style.setAttribute('data-test-tokens', '');
  style.textContent = css;
  document.head.appendChild(style);
  return () => style.remove();
}

/** A stand-in for App's BottomNav: the attribute the hub finds it by. */
export function mountFakeBottomNav() {
  const nav = document.createElement('nav');
  nav.setAttribute('data-ft-bottom-nav', '');
  document.body.appendChild(nav);
  return () => nav.remove();
}

/** Mount an element with react-dom/client inside act() (the house pattern; the repo has no testing-library). */
export function mount(element) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(element); });
  return {
    host,
    rerender(next) { act(() => { root.render(next); }); },
    unmount() { act(() => { root.unmount(); }); host.remove(); },
  };
}

/** The innermost element under `scope` whose whole text is `text`. */
export function byText(scope, text) {
  const all = [...scope.querySelectorAll('*')].filter((el) => el.textContent === text);
  return all.find((el) => ![...el.children].some((child) => child.textContent === text)) || null;
}

/** Elements with a role whose accessible name (aria-label, else text) matches. */
export function byRole(scope, role, name) {
  const matches = [...scope.querySelectorAll(`[role="${role}"]`), ...(role === 'button' ? scope.querySelectorAll('button') : [])];
  const unique = [...new Set(matches)];
  const nameOf = (el) => el.getAttribute('aria-label') ?? el.textContent;
  return unique.filter((el) => (name == null ? true : name instanceof RegExp ? name.test(nameOf(el)) : nameOf(el) === name));
}

/** Dispatch a keydown the way React listens for it. */
export function press(el, key, init = {}) {
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })); });
}

export function click(el) {
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
}
