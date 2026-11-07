// test/rules/researchRecordExtension.rules.mjs
//
// The Research Record Extension (7 Nov 2026; contract
// docs/design/20261107_RESEARCH_RECORD_EXTENSION_V1.md) — THE EXTENSION'S
// WRITES AGAINST THE REAL FIRESTORE EMULATOR. Not a security-rules test: the
// store's transactions run through the Admin SDK as in production, so it rides
// the emulator runner, `npm run test:rules` (firebase emulators:exec sets
// FIRESTORE_EMULATOR_HOST), outside the default suite (no `.test.` in the
// name) — the setupEvidenceStore.rules.mjs precedent.
//
//   · two concurrent finding appends both land within the cap; at 99 one lands
//     and the other is refused findings_full; five at once all land, ids distinct
//   · two concurrent summary revisions produce rev n+1 and n+2 — or, when both
//     say which revision they saw, one typed summary_conflict — never a lost one
//   · an exchange re-sent by a retried write is stored once (arrayUnion of the
//     same object); two turns' exchanges with equal text and time both land
//     (their ids differ)
//   · the query the new index serves (userId ==, symbolKeys array-contains,
//     createdAt desc) answers the caller's records about one symbol, newest first
//
// Each row works on its own record ids; afterAll deletes what it wrote.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL, unmocked import of the
// store is the runtime guard for its import graph here too. Never mock it.

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { appendFinding, reviseSummary } from '../../api/_utils/researchRecords/store.js';
import {
  buildRecord, buildFinding, findingAppendPatch, manualFunnel, emptyTelemetry, HOST_COLLECTIONS, FINDINGS_MAX,
} from '../../api/_utils/researchRecords/model.js';

const RUN = Date.now().toString(36);
const UID = `rre-owner-${RUN}`;
const EARLIER = '2026-11-07T14:00:00.000Z';
const NOW = '2026-11-07T15:00:00.000Z';

let app;
let db;
const written = [];
let row = 0;

beforeAll(() => {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '';
  // only ever the local emulator
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) throw new Error(`researchRecordExtension needs the local Firestore emulator (FIRESTORE_EMULATOR_HOST=${host || 'unset'}) — run npm run test:rules`);
  app = initializeApp({ projectId: 'demo-tradeseven-rules' }, `research-record-extension-${RUN}`);
  db = getFirestore(app);
});
afterAll(async () => {
  if (db) for (const path of written) await db.doc(path).delete();
  if (app) await deleteApp(app);
});

const fid = (n) => `f_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const input = (over = {}) => ({
  kind: 'observation', fact: 'Volume ran 2x its 20-day mean into the close.',
  source: { recordKind: 'symbolDayEvidence', recordId: '2026-11-06_NVDA', label: 'NVDA, 6 Nov' },
  at: '2026-11-06T20:59:00.000Z', asOf: null, status: 'unverified', statusReason: 'single_source', ...over,
});

/** A fresh Shared Research record (with n findings already on it), stored; its id. */
async function seedRecord(n = 0, over = {}) {
  row += 1;
  const id = `sr_rre-${RUN}-${row}`;
  let record = buildRecord({
    researchWorkId: id, userId: UID, origin: 'shared_research', host: { collection: HOST_COLLECTIONS.shared_research, id: `rre-${RUN}-${row}` },
    createdAt: over.createdAt || EARLIER, watchlistId: 'wl-rre', hypothesisVersion: 1, question: 'Does the volume hold?',
    funnel: manualFunnel(), telemetry: emptyTelemetry(),
  });
  for (let i = 1; i <= n; i++) record = { ...record, ...findingAppendPatch(record, buildFinding(input(), { findingId: fid(i), nowIso: NOW }), { nowIso: NOW }) };
  await db.doc(`researchWork/${id}`).set({ ...record, ...(over.extra || {}) });
  written.push(`researchWork/${id}`);
  return id;
}
const read = async (id) => (await db.doc(`researchWork/${id}`).get()).data();
const settled = (ps) => Promise.allSettled(ps);

describe('findings — concurrent appends', () => {
  it('two concurrent appends both land within the cap, each with its own id', async () => {
    const id = await seedRecord(0);
    const [a, b] = await Promise.all([
      appendFinding(db, { researchWorkId: id, uid: UID, finding: input({ fact: 'first' }), nowIso: NOW }),
      appendFinding(db, { researchWorkId: id, uid: UID, finding: input({ fact: 'second' }), nowIso: NOW }),
    ]);
    const rec = await read(id);
    expect(rec.findings).toHaveLength(2);
    expect(rec.findings.map((f) => f.fact).sort()).toEqual(['first', 'second']);
    expect(new Set(rec.findings.map((f) => f.findingId))).toEqual(new Set([a.finding.findingId, b.finding.findingId]));
    expect(rec.symbolKeys).toEqual(['NVDA']);
  });
  it('two concurrent appends at 98 both land: exactly the cap', async () => {
    const id = await seedRecord(98);
    await Promise.all([1, 2].map((k) => appendFinding(db, { researchWorkId: id, uid: UID, finding: input({ fact: `late ${k}` }), nowIso: NOW })));
    expect((await read(id)).findings).toHaveLength(FINDINGS_MAX);
  });
  it('at 99, of two concurrent appends one lands and the other is refused findings_full — never 101', async () => {
    const id = await seedRecord(99);
    const out = await settled([1, 2].map((k) => appendFinding(db, { researchWorkId: id, uid: UID, finding: input({ fact: `race ${k}` }), nowIso: NOW })));
    expect(out.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(out.filter((o) => o.status === 'rejected').map((o) => o.reason.code)).toEqual(['findings_full']);
    expect((await read(id)).findings).toHaveLength(FINDINGS_MAX);
  });
  it('five at once all land, ids distinct, every earlier finding untouched', async () => {
    const id = await seedRecord(3);
    const before = (await read(id)).findings;
    await Promise.all(Array.from({ length: 5 }, (_, k) => appendFinding(db, { researchWorkId: id, uid: UID, finding: input({ fact: `burst ${k}` }), nowIso: NOW })));
    const rec = await read(id);
    expect(rec.findings).toHaveLength(8);
    expect(rec.findings.slice(0, 3)).toEqual(before);
    expect(new Set(rec.findings.map((f) => f.findingId)).size).toBe(8);
  });
});

describe('summary — concurrent revisions', () => {
  it('two concurrent revisions produce rev n+1 and n+2 — never a lost revision', async () => {
    const id = await seedRecord(1);
    await reviseSummary(db, { researchWorkId: id, uid: UID, text: 'rev one', basedOn: [fid(1)], nowIso: NOW });
    const out = await settled(['A', 'B'].map((t) => reviseSummary(db, { researchWorkId: id, uid: UID, text: `concurrent ${t}`, nowIso: NOW })));
    expect(out.every((o) => o.status === 'fulfilled')).toBe(true);
    expect(out.map((o) => o.value.summary.rev).sort()).toEqual([2, 3]);
    const rec = await read(id);
    expect(rec.summaryRevisions.map((s) => s.rev)).toEqual([1, 2, 3]);
    expect(rec.summaryRevisions.map((s) => s.text).slice(1).sort()).toEqual(['concurrent A', 'concurrent B']);
    expect(rec.summary).toEqual(rec.summaryRevisions[2]);
  });
  it('when both say they saw rev 1, exactly one lands and the other is a typed summary_conflict', async () => {
    const id = await seedRecord(1);
    await reviseSummary(db, { researchWorkId: id, uid: UID, text: 'rev one', nowIso: NOW });
    const out = await settled(['A', 'B'].map((t) => reviseSummary(db, { researchWorkId: id, uid: UID, text: `saw one ${t}`, expectedRev: 1, nowIso: NOW })));
    expect(out.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(out.filter((o) => o.status === 'rejected').map((o) => o.reason.code)).toEqual(['summary_conflict']);
    const rec = await read(id);
    expect(rec.summaryRevisions.map((s) => s.rev)).toEqual([1, 2]);
    expect(rec.summary).toEqual(rec.summaryRevisions[1]);
  });
});

describe('exchange ids on real Firestore', () => {
  it('a re-sent exchange (the same object, a retried write) is stored once; two exchanges alike but for their ids both land', async () => {
    row += 1;
    const path = `researchSessions/rre-${RUN}-${row}`;
    written.push(path);
    const legacy = { userMessage: 'hi', message: 'hello', appliedSpec: null, matchCount: null, timestamp: EARLIER };
    await db.doc(path).set({ userId: UID, exchanges: [legacy] });
    const ex = { userMessage: 'again', message: 'same', appliedSpec: null, matchCount: null, timestamp: NOW, exchangeId: '6f1c2b0e-8a7d-4c3b-9e21-0a5d4f3e2b1c' };
    await db.doc(path).update({ exchanges: FieldValue.arrayUnion(ex) });
    await db.doc(path).update({ exchanges: FieldValue.arrayUnion(ex) });
    const twin = { ...ex, exchangeId: '0e9d8c7b-6a5f-4e3d-8c2b-1a0f9e8d7c6b' };
    await db.doc(path).update({ exchanges: FieldValue.arrayUnion(twin) });
    const stored = (await db.doc(path).get()).data().exchanges;
    expect(stored).toEqual([legacy, ex, twin]);
  });
});

describe('the query the new index serves', () => {
  it('userId ==, symbolKeys array-contains, createdAt desc: the caller\'s records about one symbol, newest first', async () => {
    const older = await seedRecord(1, { createdAt: '2026-11-05T14:00:00.000Z' });
    const newer = await seedRecord(1, { createdAt: '2026-11-06T14:00:00.000Z' });
    const other = await seedRecord(0); // no findings → symbolKeys []
    const snap = await db.collection('researchWork').where('userId', '==', UID).where('symbolKeys', 'array-contains', 'NVDA').orderBy('createdAt', 'desc').get();
    const ids = snap.docs.map((d) => d.id);
    expect(ids.indexOf(newer)).toBeLessThan(ids.indexOf(older));
    expect(ids).toContain(older);
    expect(ids).not.toContain(other);
  });
});
