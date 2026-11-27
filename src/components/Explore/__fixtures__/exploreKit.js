// src/components/Explore/__fixtures__/exploreKit.js — fixture support (Explore Build 1).
//
// The jsdom rows' kit, in the sheet kit's pattern: the research read's answers in the SERVICE's own result shape
// ({ ok, status, body, retryAfterS, gated, network }) over exploreReads.json (composed by the server, K-16), fixture
// stories and bookmarks sources that record every call, and mount / input helpers. No network. It imports nothing
// from the sheet's directory or the research service (the sheet's boundary test walks this file).

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import reads from './exploreReads.json';
import { KIT_STORIES, SAMPLE_STORIES } from './stories';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { ExploreSourcesContext } from '../exploreSources';

export const READS = reads;
export { KIT_STORIES, SAMPLE_STORIES };

/** A research read that answered: the service's shape around a composed body. */
export const answerOf = (body) => ({ ok: true, status: 200, body: JSON.parse(JSON.stringify(body)), retryAfterS: null, gated: false, network: false });
/** The read refused: the gate is off for this player (404 disabled). */
export const GATED = Object.freeze({ ok: false, status: 404, body: { error: 'disabled' }, retryAfterS: null, gated: true, network: false });
/** Signed out, over the limit, no answer: each is a failed read (N-9). */
export const UNAUTHORIZED = Object.freeze({ ok: false, status: 401, body: { error: 'unauthorized' }, retryAfterS: null, gated: false, network: false });
export const LIMITED = Object.freeze({ ok: false, status: 429, body: { error: 'rate_limited' }, retryAfterS: 20, gated: false, network: false });
export const NO_ANSWER = Object.freeze({ ok: false, status: 0, body: null, retryAfterS: null, gated: false, network: true });

/** A promise you settle by hand — a read held in flight. */
export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/**
 * Fixture sources for ExploreSourcesContext. `stories` (a list, a function, or 'fail'), `bookmarks` (the stored list),
 * `failWrites` (a Set of 'save' | 'remove'). Every call is recorded in `calls`. Build 2: the default stories are the
 * pilot pair and the three samples (KIT_STORIES); `byId` answers a story read by id (id → a view, 'fail', or a promise;
 * anything else, or nothing, is null: absent).
 */
export function fixtureSources({ stories = KIT_STORIES, complete = true, bookmarks = [], failWrites = new Set(), failBookmarks = false, holdBookmarks = null, byId = {} } = {}) {
  const calls = [];
  const held = { bookmarks: bookmarks.map((b) => ({ ...b })) };
  return {
    calls,
    held,
    /** As the Firestore source answers: the stories, and whether the read holds every published one. */
    readStories: async () => {
      calls.push({ kind: 'readStories' });
      if (stories === 'fail') throw new Error('stories failed');
      const list = await (typeof stories === 'function' ? stories() : stories);
      return { list, complete };
    },
    readStory: async (id) => {
      calls.push({ kind: 'readStory', id });
      const v = await byId[id];
      if (v === 'fail') throw new Error('story refused');
      return v && typeof v === 'object' ? v : null;
    },
    readBookmarks: async (uid) => {
      calls.push({ kind: 'readBookmarks', uid });
      if (holdBookmarks) await holdBookmarks;
      if (failBookmarks) throw new Error('bookmarks failed');
      return held.bookmarks.map((b) => ({ ...b }));
    },
    saveBookmark: async (uid, story) => {
      calls.push({ kind: 'saveBookmark', uid, storyId: story.id });
      if (failWrites.has('save')) throw new Error('save failed');
      const b = { storyId: story.id, storyVersion: story.version, title: story.title, savedAt: '2026-11-21T16:00:00.000Z' };
      held.bookmarks = [b, ...held.bookmarks.filter((x) => x.storyId !== story.id)];
      return b;
    },
    removeBookmark: async (uid, storyId) => {
      calls.push({ kind: 'removeBookmark', uid, storyId });
      if (failWrites.has('remove')) throw new Error('remove failed');
      held.bookmarks = held.bookmarks.filter((x) => x.storyId !== storyId);
    },
  };
}

/** A bookmark as the source holds it. */
export const bookmarkOf = (story, savedAt = '2026-11-21T12:00:00.000Z') => ({ storyId: story.id, storyVersion: story.version, title: story.title, savedAt });

/** Mount with react-dom/client inside act() (the house pattern), under the app's ThemeProvider and the given sources. */
export function mount(element, { sources = null } = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const wrap = (el) => React.createElement(ThemeProvider, null, sources ? React.createElement(ExploreSourcesContext.Provider, { value: sources }, el) : el);
  act(() => { root.render(wrap(element)); });
  return {
    host,
    rerender(next) { act(() => { root.render(wrap(next)); }); },
    unmount() { act(() => { root.unmount(); }); host.remove(); },
  };
}

/** Let the promises settle. */
export async function flush(times = 10) {
  await act(async () => { for (let i = 0; i < times; i++) await Promise.resolve(); });
}

/**
 * Wait, in real time, until `check()` is truthy (a lazy module to load, a tab's exit animation to finish), at most
 * `ms` (well under the row timeout). Returns the check's value; throws with `what` when it never comes.
 */
export async function until(check, what = 'the condition', ms = 2500) {
  const end = Date.now() + ms;
  for (;;) {
    const v = check();
    if (v) return v;
    if (Date.now() > end) throw new Error(`exploreKit.until: ${what} did not happen within ${ms} ms`);
    await act(async () => { await new Promise((r) => { setTimeout(r, 15); }); });
  }
}

export function click(el) {
  if (!el) throw new Error('exploreKit.click: no element');
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
}
export function typeInto(el, value) {
  if (!el) throw new Error('exploreKit.typeInto: no element');
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
export function press(el, key, init = {}) {
  if (!el) throw new Error('exploreKit.press: no element');
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })); });
}
export const $ = (sel, scope = document) => scope.querySelector(sel);
export const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
/** A button whose text is exactly `text`. */
export const buttonNamed = (text, scope = document) => $$('button', scope).find((b) => b.textContent.trim() === text) ?? null;
