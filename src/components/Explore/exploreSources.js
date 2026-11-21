// src/components/Explore/exploreSources.js
//
// Explore Build 1 — THE STORIES SOURCE AND THE BOOKMARKS SOURCE (spec
// docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §5.1–§5.3; build prompt K-6, K-11).
// Firestore, client SDK, no listener:
//   stories    `exploreStories` where status == 'published', newest publishedAt first, at most
//              STORIES_READ — one getDocs per page mount (and one per tap of Try again). The
//              composite index (status ASC, publishedAt DESC) is in firestore.indexes.json. Each
//              document goes through storyOf (exploreView.js): a dropped record is never drawn.
//   bookmarks  users/{uid}/exploreBookmarks/{storyId}, exactly { storyId, storyVersion, title,
//              savedAt } — one read per page mount, one write per toggle. The rules block
//              (firestore.rules) admits the owner only, with exactly those four keys.
//
// The sources reach the page through ExploreSourcesContext, whose default is the Firestore pair
// below; the jsdom rows and the smoke page hand in fixture sources. The research read is NOT
// here: it is useExploreResearch.js's alone (K-3).

import { createContext } from 'react';
import { collection, deleteDoc, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { BOOKMARKS_MAX, BOOKMARK_TITLE_MAX, EXPLORE_RECORD_KIND, STORIES_READ, isoOf, storyOf } from './exploreView';

/** The bookmarks subcollection under users/{uid}. */
export const BOOKMARKS_COLLECTION = 'exploreBookmarks';

/** The published stories, newest first, as the reader's views (a record storyOf drops is left out). */
export async function readStories() {
  const snap = await getDocs(query(collection(db, EXPLORE_RECORD_KIND), where('status', '==', 'published'), orderBy('publishedAt', 'desc'), limit(STORIES_READ)));
  return snap.docs.map((d) => storyOf(d.id, d.data())).filter(Boolean);
}

/** A stored bookmark as the page reads it, or null. */
export function bookmarkOf(id, data) {
  if (!data || typeof data !== 'object' || typeof data.storyId !== 'string' || data.storyId !== id) return null;
  return {
    storyId: data.storyId,
    storyVersion: Number.isSafeInteger(data.storyVersion) ? data.storyVersion : null,
    title: typeof data.title === 'string' ? data.title : '',
    savedAt: isoOf(data.savedAt),
  };
}

/** The player's bookmarks, newest saved first, at most BOOKMARKS_MAX. */
export async function readBookmarks(uid) {
  const snap = await getDocs(query(collection(db, 'users', uid, BOOKMARKS_COLLECTION), orderBy('savedAt', 'desc'), limit(BOOKMARKS_MAX)));
  return snap.docs.map((d) => bookmarkOf(d.id, d.data())).filter(Boolean);
}

/** The document a bookmark writes: exactly the four keys the rules admit. */
export const bookmarkDocOf = (story) => ({
  storyId: story.id,
  storyVersion: story.version,
  title: story.title.slice(0, BOOKMARK_TITLE_MAX),
  savedAt: serverTimestamp(),
});

/** Saves a story for later. Resolves the bookmark as the page now holds it. */
export async function saveBookmark(uid, story) {
  await setDoc(doc(db, 'users', uid, BOOKMARKS_COLLECTION, story.id), bookmarkDocOf(story));
  return { storyId: story.id, storyVersion: story.version, title: story.title.slice(0, BOOKMARK_TITLE_MAX), savedAt: new Date().toISOString() };
}

/** Removes a bookmark by story id. */
export async function removeBookmark(uid, storyId) {
  await deleteDoc(doc(db, 'users', uid, BOOKMARKS_COLLECTION, storyId));
}

export const FIRESTORE_SOURCES = Object.freeze({ readStories, readBookmarks, saveBookmark, removeBookmark });

/** The sources the page reads through. Default: Firestore. */
export const ExploreSourcesContext = /* @__PURE__ */ createContext(FIRESTORE_SOURCES);
