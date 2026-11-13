// src/components/SharedResearch/__fixtures__/srKit.js
//
// Shared Research B2 — the jsdom rows' kit. A FAKE ROUTE that answers from
// answers.json (the server's own compositions, srAnswers.test.js) and records
// every request the sheet sends, so a row can check the exact body; and a mount
// helper. No network: the rows mock fetchWithAuth with `server.fetch`.
// Imports nothing from src/components/CommandCenter/ (the hub's mount guard reads
// every non-test file outside the hub); the rows that need a real HubSheet import
// it themselves — test files may (K-2).

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import answers from './answers.json';
import { ThemeProvider } from '../../../contexts/ThemeContext';

export const A = answers;
export const IDS = answers.ids;

/** A Response-like object for fetchWithAuth's mock. */
export function responseOf({ status = 200, body = null, headers = null } = {}) {
  return {
    ok: status >= 200 && status < 300, status,
    headers: { get: (name) => (headers && Object.hasOwn(headers, name) ? headers[name] : null) },
    json: async () => (body === null ? Promise.reject(new Error('no body')) : JSON.parse(JSON.stringify(body))),
  };
}

/** A promise you settle by hand — a request held in flight. */
export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

export const NETWORK = Symbol('network');

/**
 * The fake route. `routes` maps a key to an answer, a list of answers (one per call, the last repeating), a
 * function (body, call) → answer, NETWORK (the fetch rejects) or a deferred's promise:
 *   list            GET ?list=open
 *   get             GET ?sessionId=…
 *   frame | open | step | close | adopt    POST actions
 *   parse           POST /api/forge/parse-signal
 */
export function fakeServer(routes = {}) {
  const calls = [];
  const count = {};
  const answerFor = async (key, body) => {
    const route = routes[key];
    const n = (count[key] = (count[key] ?? 0) + 1);
    let a = Array.isArray(route) ? route[Math.min(n, route.length) - 1] : route;
    if (typeof a === 'function') a = await a(body, n);
    if (a && typeof a.then === 'function') a = await a;
    if (a === NETWORK) throw new TypeError('Failed to fetch');
    if (!a) throw new Error(`srKit: no route for ${key}`);
    return responseOf(a);
  };
  const fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    let key;
    if (url.startsWith('/api/forge/parse-signal')) key = 'parse';
    else if (url.startsWith('/api/forge/shared-research')) key = init.method === 'GET' ? (url.includes('list=open') ? 'list' : 'get') : body?.action;
    else key = url;
    calls.push({ key, url, method: init.method, body, raw: init.body ?? null });
    return answerFor(key, body);
  };
  return {
    fetch, calls,
    sent: (key) => calls.filter((c) => c.key === key),
    set: (key, value) => { routes[key] = value; count[key] = 0; },
  };
}

/** Mount with react-dom/client inside act() (the house pattern), under the app's ThemeProvider. */
export function mount(element) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(React.createElement(ThemeProvider, null, element)); });
  return {
    host,
    rerender(next) { act(() => { root.render(React.createElement(ThemeProvider, null, next)); }); },
    unmount() { act(() => { root.unmount(); }); host.remove(); },
  };
}

/** Let the promises settle (the fake route's, the hook's). */
export async function flush(times = 8) {
  await act(async () => { for (let i = 0; i < times; i++) await Promise.resolve(); });
}

export function click(el) {
  if (!el) throw new Error('srKit.click: no element');
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
}
export function typeInto(el, value) {
  if (!el) throw new Error('srKit.typeInto: no element');
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
export function press(el, key) {
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });
}
/** The first element in `scope` matching the selector, else null. */
export const $ = (sel, scope = document) => scope.querySelector(sel);
export const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
/** A button whose text is exactly `text`. */
export const buttonNamed = (text, scope = document) => $$('button', scope).find((b) => b.textContent.trim() === text) ?? null;
/** The whole text of the sheet's body. */
export const textOf = (scope = document) => $('[data-shared-research-body]', scope)?.textContent ?? '';

/** A story card as the hub passes it (spec §7.1 `stories[]`), from the fixture story. */
export function storyOf(over = {}) {
  const s = IDS.story;
  return {
    itemRef: { recordKind: 'fantasyTimesStories', recordId: s.id }, headline: s.headline, reporterName: s.reporterName, beat: s.reporterBeat,
    publishedAt: s.publishedAt, context: 'Builders say switchgear lead times now set the pace.', question: "What changed in this company's business, and does it reach its suppliers, customers or competitors?",
    reason: null, ...over,
  };
}
