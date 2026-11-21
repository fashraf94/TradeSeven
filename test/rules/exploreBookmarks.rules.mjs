// test/rules/exploreBookmarks.rules.mjs
//
// Explore Build 1 (spec docs/specs/20261121_EXPLORE_BUILD_1_SPEC_V1_1.md §5.2; build prompt K-11) — Firestore
// security-rules acceptance for the two new blocks:
//
//   users/{uid}/exploreBookmarks/{storyId}   the player's bookmarks, exactly { storyId, storyVersion, title, savedAt }:
//     the owner reads and deletes; a create or update carries exactly those four keys, storyId equal to the document
//     id, a whole-number version, a bounded title and a timestamp. No one else reads or writes.
//   exploreStories/{storyId}                 signed-in reads; no client write (the content pipeline writes with the
//     Admin SDK; the Work an idea route reads with its own credentials).
//
// THE CLAIMS:
//   · the owner creates, updates, reads, lists and deletes their bookmark (positive controls — a misloaded or
//     over-broad ruleset cannot pass by failing everything);
//   · another player, a privileged-claims context and an unauthenticated client can do none of it;
//   · each missing key, each extra key, a mismatched id, a version that is not a whole number ≥ 0, a blank or long
//     title, and a savedAt that is not a timestamp are each refused;
//   · any signed-in player reads the stories; an unauthenticated client cannot; no one writes one;
//   · the rules text carries exactly these two blocks.
//
// Not part of the default vitest run (no `.test.` in the filename). Run: npm run test:rules

import { createHash } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';
import { RULES_TEXT, ruleBlocks } from './callRecordsRulesSuite.mjs';

const RULES_SHA256 = createHash('sha256').update(RULES_TEXT).digest('hex');
const OWNER_UID = 'ex-owner-1';
const OTHER_UID = 'ex-intruder-2';
const PRIVILEGED_UID = 'ex-admin-3';
const PRIVILEGED_CLAIMS = { admin: true, role: 'service' };
const STORY_ID = 'ai-buildout-1';
const BOOKMARK = `users/${OWNER_UID}/exploreBookmarks/${STORY_ID}`;
const SEEDED = `users/${OWNER_UID}/exploreBookmarks/seeded-1`;
const STORY = `exploreStories/${STORY_ID}`;

/** A bookmark as the client writes it (src/components/Explore/exploreSources.js bookmarkDocOf). */
const bookmark = (over = {}) => ({ storyId: STORY_ID, storyVersion: 2, title: 'AI growth reaches beyond the chips', savedAt: serverTimestamp(), ...over });

let testEnv;
const seed = (path, data) => testEnv.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), path), data); });
const asOwner = () => testEnv.authenticatedContext(OWNER_UID).firestore();
const asOther = () => testEnv.authenticatedContext(OTHER_UID).firestore();
const asPrivileged = () => testEnv.authenticatedContext(PRIVILEGED_UID, PRIVILEGED_CLAIMS).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const NOT_THE_OWNER = [
  ['another player', asOther],
  ['a privileged-claims context', asPrivileged],
  ['an unauthenticated client', asAnon],
];

beforeAll(async () => {
  console.log(`[exploreBookmarks] rules text sha256: ${RULES_SHA256}`);
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [emuHost, emuPort] = host.split(':');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-tradeseven-rules',
    firestore: { rules: RULES_TEXT, host: emuHost, port: Number(emuPort) },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(SEEDED, { storyId: 'seeded-1', storyVersion: 1, title: 'Seeded', savedAt: Timestamp.fromDate(new Date('2026-11-20T10:00:00.000Z')) });
  await seed(STORY, { status: 'published', title: 'AI growth reaches beyond the chips', version: 2, publishedAt: Timestamp.fromDate(new Date('2026-11-20T14:00:00.000Z')) });
  await seed('exploreStories/draft-1', { status: 'draft', title: 'A draft', version: 0, publishedAt: Timestamp.fromDate(new Date('2026-11-19T14:00:00.000Z')) });
});

describe('the owner (positive controls)', () => {
  it('creates, updates, reads, lists newest first and deletes their bookmark', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), BOOKMARK), bookmark()));
    await assertSucceeds(setDoc(doc(asOwner(), BOOKMARK), bookmark({ storyVersion: 3, title: 'A new title' })));
    await assertSucceeds(updateDoc(doc(asOwner(), BOOKMARK), { storyVersion: 4, savedAt: serverTimestamp() }));
    const got = await assertSucceeds(getDoc(doc(asOwner(), BOOKMARK)));
    expect(got.data()).toMatchObject({ storyId: STORY_ID, storyVersion: 4 });
    const listed = await assertSucceeds(getDocs(query(collection(asOwner(), 'users', OWNER_UID, 'exploreBookmarks'), orderBy('savedAt', 'desc'), limit(50))));
    expect(listed.docs.map((d) => d.id)).toEqual([STORY_ID, 'seeded-1']);
    await assertSucceeds(deleteDoc(doc(asOwner(), BOOKMARK)));
  });
  it('a version of 0 and a title of 200 characters are allowed', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), BOOKMARK), bookmark({ storyVersion: 0, title: 'x'.repeat(200) })));
  });
  it('a title of 200 characters that are not ASCII is allowed: size() counts characters, as the client cuts (review D-7)', async () => {
    await assertSucceeds(setDoc(doc(asOwner(), BOOKMARK), bookmark({ title: '’—'.repeat(100) })));
    await assertFails(setDoc(doc(asOwner(), BOOKMARK), bookmark({ title: '’'.repeat(201) })));
  });
});

describe('no one else', () => {
  for (const [who, ctx] of NOT_THE_OWNER) {
    it(`${who} cannot read, list, write or delete the owner's bookmarks`, async () => {
      await assertFails(getDoc(doc(ctx(), SEEDED)));
      await assertFails(getDocs(collection(ctx(), 'users', OWNER_UID, 'exploreBookmarks')));
      await assertFails(setDoc(doc(ctx(), BOOKMARK), bookmark()));
      await assertFails(updateDoc(doc(ctx(), SEEDED), { storyVersion: 9 }));
      await assertFails(deleteDoc(doc(ctx(), SEEDED)));
    });
  }
  it('the owner cannot write into another player\'s bookmarks', async () => {
    await assertFails(setDoc(doc(asOwner(), `users/${OTHER_UID}/exploreBookmarks/${STORY_ID}`), bookmark()));
  });
});

describe('the four keys, and only them (K-11)', () => {
  const missing = ['storyId', 'storyVersion', 'title', 'savedAt'];
  it.each(missing)('refused: no %s', async (key) => {
    const data = bookmark();
    delete data[key];
    await assertFails(setDoc(doc(asOwner(), BOOKMARK), data));
  });
  it.each([['a fifth key', { note: 'x' }], ['a question', { question: 'Which?' }], ['an owner field', { userId: OWNER_UID }]])('refused: %s', async (_n, extra) => {
    await assertFails(setDoc(doc(asOwner(), BOOKMARK), { ...bookmark(), ...extra }));
  });
  it('refused: a fifth key added by update', async () => {
    await assertFails(updateDoc(doc(asOwner(), SEEDED), { note: 'x' }));
  });
  it.each([
    ['a storyId that is not the document id', { storyId: 'another-story' }],
    ['a version that is not a whole number', { storyVersion: 1.5 }],
    ['a negative version', { storyVersion: -1 }],
    ['a version as text', { storyVersion: '2' }],
    ['a blank title', { title: '' }],
    ['a title of 201 characters', { title: 'x'.repeat(201) }],
    ['a title that is not text', { title: 7 }],
    ['a savedAt that is not a timestamp', { savedAt: '2026-11-21T10:00:00.000Z' }],
  ])('refused: %s', async (_n, over) => {
    await assertFails(setDoc(doc(asOwner(), BOOKMARK), bookmark(over)));
  });
  it('refused: a document id outside the route\'s story id rule', async () => {
    await assertFails(setDoc(doc(asOwner(), `users/${OWNER_UID}/exploreBookmarks/bad.id`), bookmark({ storyId: 'bad.id' })));
  });
});

describe('the stories: signed-in reads, no client writes', () => {
  it('a signed-in player reads one and runs the page\'s query (published, newest first, 12)', async () => {
    await assertSucceeds(getDoc(doc(asOther(), STORY)));
    const got = await assertSucceeds(getDocs(query(collection(asOwner(), 'exploreStories'), where('status', '==', 'published'), orderBy('publishedAt', 'desc'), limit(12))));
    expect(got.docs.map((d) => d.id)).toEqual([STORY_ID]);
  });
  it('an unauthenticated client cannot read them', async () => {
    await assertFails(getDoc(doc(asAnon(), STORY)));
    await assertFails(getDocs(collection(asAnon(), 'exploreStories')));
  });
  for (const [who, ctx] of [['the owner', asOwner], ['a privileged-claims context', asPrivileged], ['an unauthenticated client', asAnon]]) {
    it(`${who} cannot create, update or delete a story`, async () => {
      await assertFails(setDoc(doc(ctx(), 'exploreStories/new-1'), { status: 'published', title: 'x', version: 0 }));
      await assertFails(updateDoc(doc(ctx(), STORY), { title: 'changed' }));
      await assertFails(deleteDoc(doc(ctx(), STORY)));
    });
  }
});

describe('the posture is written down', () => {
  it('ONE bookmarks block and ONE stories block, as built', () => {
    expect(ruleBlocks(RULES_TEXT, /\/users\/\{userId\}\/exploreBookmarks\/\{storyId\}/)).toEqual([[
      'allow read, delete: if request.auth != null && request.auth.uid == userId;',
      'allow create, update: if request.auth != null',
      '&& request.auth.uid == userId',
      "&& storyId.matches('^[A-Za-z0-9_-]{1,200}$')",
      "&& request.resource.data.keys().hasOnly(['storyId', 'storyVersion', 'title', 'savedAt'])",
      "&& request.resource.data.keys().hasAll(['storyId', 'storyVersion', 'title', 'savedAt'])",
      '&& request.resource.data.storyId == storyId',
      '&& request.resource.data.storyVersion is int',
      '&& request.resource.data.storyVersion >= 0',
      '&& request.resource.data.title is string',
      '&& request.resource.data.title.size() > 0',
      '&& request.resource.data.title.size() <= 200',
      '&& request.resource.data.savedAt is timestamp;',
    ]]);
    expect(ruleBlocks(RULES_TEXT, /\/exploreStories\/\{storyId\}/)).toEqual([[
      'allow read: if request.auth != null;',
      'allow create, update, delete: if false;',
    ]]);
  });
});
