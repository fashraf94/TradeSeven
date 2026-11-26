// api/_utils/explore/storyWriter.js
//
// Explore publish step — THE WRITER (build prompt K-1, K-9, K-11). The one module that writes stories, with the Admin
// SDK handed in by the founder's command (scripts/explore-publish.mjs never writes itself). It writes ONE collection,
// `exploreStories` (the page's own name for it, exploreView.js EXPLORE_RECORD_KIND), and nothing else.
//
// WHAT IS WRITTEN. The record as the check left it (the author's fields, with every value this step owns removed)
// plus this run's match results (matchStory.js), and three fields of the step's own:
//   status       'draft' or 'published' — the command's, never the file's
//   publishedAt  set by the server's clock at a story's FIRST publish and kept on every later write; null on a story
//                never published
//   revisedAt    set by the server's clock on each later publish; absent until then
//
// THE VERSION RULE (K-11), over a story that is published — or has been, and was unpublished since (it carries a
// `publishedAt`): a write needs a higher `version`; the same version with the same content is a no-op that says so;
// the same version with different content is refused ("raise the version"); a lower version is refused. "Content" is
// the author's content: the record without the step's own fields and without any match result (storyRecord.js
// contentHashOf). A draft never published may be written over freely. A draft is never written over a published
// story (unpublish it, or publish a higher version).
//
// ONE TRANSACTION. Stories written together (an overview and its deep story) are read again and planned again inside
// one transaction, and written in its one commit, or not at all: one refusal writes nothing.

import { EXPLORE_RECORD_KIND } from '../../../src/components/Explore/exploreView.js';
import { contentHashOf } from './storyRecord.js';

/** The one collection this step writes. */
export const COLLECTION = EXPLORE_RECORD_KIND;
export const ACTIONS = Object.freeze({ CREATE: 'create', REPLACE: 'replace', UNPUBLISH: 'unpublish', NOOP: 'noop', REFUSED: 'refused' });

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const dataOf = (snap) => (snap && snap.exists ? snap.data() : null);
const refOf = (db, id) => db.collection(COLLECTION).doc(id);
/** Has this stored story ever been published? */
const wasPublished = (doc) => doc.status === 'published' || (doc.publishedAt !== null && doc.publishedAt !== undefined);

/**
 * The version rule for a draft written over a story that was published (pure): a lower version, or the same version
 * with other content, is refused; null when the write may go ahead (a higher version, or the same content).
 */
function versionRefusalOf(record, stored) {
  const v = record.version;
  const sv = stored.version;
  if (!Number.isSafeInteger(v) || !Number.isSafeInteger(sv)) return 'the version rule needs whole-number versions on both sides';
  if (v < sv) return `it was published at version ${sv}; a new one is higher, not ${v}`;
  if (v === sv && contentHashOf(stored) !== contentHashOf(record)) return `version ${v} was published with other content: raise the version`;
  return null;
}

/** The stored documents of these ids, as a Map id → data (a missing one is absent). Reads only. */
export async function readStories(db, ids) {
  const out = new Map();
  for (const id of [...new Set(ids)]) {
    const data = dataOf(await refOf(db, id).get());
    if (isPlain(data)) out.set(id, data);
  }
  return out;
}

/** Every story in the collection, `[{ id, data }]`, by id. Reads only. */
export async function readAllStories(db) {
  const snap = await db.collection(COLLECTION).get();
  return (snap.docs || []).map((d) => ({ id: d.id, data: typeof d.data === 'function' ? d.data() : null }))
    .filter((d) => isPlain(d.data))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The plan for writing one story with `status` over what is stored (pure). `record` carries this run's match results
 * and no step field. `stamp` is the server-clock value written for a new instant. Returns
 * `{ id, action, reason, version, storedVersion, storedStatus, document }`, `document` null unless something is written.
 */
export function planWrite(id, stored, record, { status, stamp }) {
  const base = { id, version: record?.version ?? null, storedVersion: stored?.version ?? null, storedStatus: stored?.status ?? null };
  const refuse = (reason) => ({ ...base, action: ACTIONS.REFUSED, reason, document: null });
  if (status !== 'draft' && status !== 'published') return refuse(`internal: unknown status ${JSON.stringify(status)}`);
  if (!isPlain(record)) return refuse('the record is not one object');
  if (!isPlain(stored)) {
    const document = { ...record, status, publishedAt: status === 'published' ? stamp : null };
    return { ...base, action: ACTIONS.CREATE, reason: status === 'published' ? 'first publish' : 'a new draft', document };
  }
  if (status === 'draft') {
    if (stored.status === 'published') return refuse(`it is published at version ${stored.version}: publish a higher version, or unpublish it first`);
    // A draft over a story that WAS published keeps the version rule too (review A4): otherwise unpublish, draft and
    // publish would put other content under a version a saved thesis already names.
    if (wasPublished(stored)) {
      const refusal = versionRefusalOf(record, stored);
      if (refusal) return refuse(refusal);
    }
    const document = { ...record, status, publishedAt: stored.publishedAt ?? null, ...(stored.revisedAt !== undefined ? { revisedAt: stored.revisedAt } : {}) };
    return { ...base, action: ACTIONS.REPLACE, reason: 'the stored draft is replaced', document };
  }
  // publish over a stored story
  if (!wasPublished(stored)) {
    const document = { ...record, status, publishedAt: stamp };
    return { ...base, action: ACTIONS.REPLACE, reason: 'first publish (the stored draft is replaced)', document };
  }
  const v = record.version;
  const sv = stored.version;
  if (!Number.isSafeInteger(v) || !Number.isSafeInteger(sv)) return refuse('the version rule needs whole-number versions on both sides');
  if (v < sv) return refuse(`the stored version is ${sv}; a new one is higher, not ${v}`);
  if (v === sv) {
    if (contentHashOf(stored) !== contentHashOf(record)) return refuse(`version ${v} is already ${stored.status === 'published' ? 'published' : 'stored, and was published,'} with other content: raise the version`);
    if (stored.status === 'published') return { ...base, action: ACTIONS.NOOP, reason: `already published at version ${v} with this content: nothing is written`, document: null };
  }
  const document = { ...record, status, publishedAt: stored.publishedAt, revisedAt: stamp };
  return { ...base, action: ACTIONS.REPLACE, reason: v === sv ? `published again at version ${v} (it was unpublished)` : `a new version (${sv} → ${v})`, document };
}

/** The plan for unpublishing one story (pure): a published one back to 'draft', everything else kept. */
export function planUnpublish(id, stored) {
  const base = { id, version: stored?.version ?? null, storedVersion: stored?.version ?? null, storedStatus: stored?.status ?? null };
  if (!isPlain(stored)) return { ...base, action: ACTIONS.REFUSED, reason: 'no such story in the collection', document: null };
  if (stored.status !== 'published') return { ...base, action: ACTIONS.NOOP, reason: `it is already ${stored.status ?? 'not published'}: nothing is written`, document: null };
  return { ...base, action: ACTIONS.UNPUBLISH, reason: 'back to draft: players can no longer read it', document: { status: 'draft' } };
}

/** Plan a set against what is stored now (pure): `{ plans, refused }`. */
export function planSet(items, storedById, { status, stamp }) {
  const plans = items.map(({ id, record }) => planWrite(id, storedById.get(id) ?? null, record, { status, stamp }));
  return { plans, refused: plans.some((p) => p.action === ACTIONS.REFUSED) };
}

/**
 * Write a set in ONE transaction (see the header): every story read again and planned again inside it; one refusal
 * and nothing is written. `serverTime()` gives the value for a new instant (the Admin SDK's server timestamp in
 * production). Returns `{ plans, refused, written }`.
 */
export async function commitSet(db, items, { status, serverTime }) {
  return db.runTransaction(async (tx) => {
    const stored = new Map();
    for (const { id } of items) {
      const data = dataOf(await tx.get(refOf(db, id)));
      if (isPlain(data)) stored.set(id, data);
    }
    const { plans, refused } = planSet(items, stored, { status, stamp: serverTime() });
    if (refused) return { plans, refused, written: [] };
    const written = [];
    for (const p of plans) {
      if (p.action === ACTIONS.NOOP) continue;
      tx.set(refOf(db, p.id), p.document);
      written.push(p.id);
    }
    return { plans, refused, written };
  });
}

/** Unpublish stories in one transaction: `{ plans, refused, written }`. A missing story refuses the set. */
export async function commitUnpublish(db, ids) {
  return db.runTransaction(async (tx) => {
    const plans = [];
    for (const id of ids) plans.push(planUnpublish(id, dataOf(await tx.get(refOf(db, id)))));
    const refused = plans.some((p) => p.action === ACTIONS.REFUSED);
    if (refused) return { plans, refused, written: [] };
    const written = [];
    for (const p of plans) {
      if (p.action !== ACTIONS.UNPUBLISH) continue;
      tx.update(refOf(db, p.id), p.document);
      written.push(p.id);
    }
    return { plans, refused, written };
  });
}
