// test/rules/huddleEvidence.rules.mjs
//
// Huddle S1 — THE SHARED EVIDENCE RECORD'S CLAIMS AGAINST THE REAL FIRESTORE EMULATOR
// (Amendment C V1.2 §C1; Amendment A §A2 / §A11 "a stale cache claimant publishing after
// its successor (nothing written)"; Amendment B §B4 finalizer ownership). Admin SDK; the
// emulator runner (`npm run test:rules`). Each row works under its own symbol.

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { claimGroups, finalizeGroup, ensureSymbolEvidence, readSymbolEvidence, EVIDENCE_LEASE_MS } from '../../api/_utils/evidence/symbolDayEvidence.js';

const RUN = Date.now().toString(36).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'Q';
const ET = '2026-11-09';
let app;
let db;
let n = 0;
const T0 = Date.parse('2026-11-09T12:30:00Z');

beforeAll(() => {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '';
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) throw new Error('huddleEvidence needs the local Firestore emulator');
  app = initializeApp({ projectId: 'demo-tradeseven-rules' }, `huddle-evidence-${Date.now()}`);
  db = getFirestore(app);
});
afterAll(async () => { if (app) await deleteApp(app); });

const freshSymbol = () => { n += 1; return `${RUN}${String.fromCharCode(65 + (n % 26))}${String.fromCharCode(65 + ((n * 7) % 26))}`.slice(0, 5); };

describe('symbolDayEvidence — generation-owned claims (B §B4)', () => {
  it('a stale claimant publishing after its successor writes nothing; the successor\'s result stands', async () => {
    const symbol = freshSymbol();
    const a = await claimGroups(db, { etDate: ET, symbol, owner: 'job-a', groups: ['price'], nowMs: T0 });
    expect(a.claimed).toEqual({ price: 1 });
    // A's lease lapses; B reclaims and finalizes
    const later = T0 + EVIDENCE_LEASE_MS + 1;
    const b = await claimGroups(db, { etDate: ET, symbol, owner: 'job-b', groups: ['price'], nowMs: later });
    expect(b.claimed).toEqual({ price: 2 });
    expect((await finalizeGroup(db, { etDate: ET, symbol, owner: 'job-b', group: 'price', generation: 2, fields: { price: { lastClose: 50, lastCloseAsOf: '2026-11-06' } }, nowMs: later + 1 })).outcome).toBe('written');
    // A finally answers
    expect((await finalizeGroup(db, { etDate: ET, symbol, owner: 'job-a', group: 'price', generation: 1, fields: { price: { lastClose: 1, lastCloseAsOf: '2026-11-06' } }, nowMs: later + 2 })).outcome).toBe('stale_generation');
    const rec = await readSymbolEvidence(db, { etDate: ET, symbol });
    expect(rec.price).toEqual({ lastClose: 50, lastCloseAsOf: '2026-11-06' });
    expect(rec.claims.price).toMatchObject({ claimGeneration: 3, state: 'ready', owner: 'job-b' });
  });

  it('a claimant whose lease expired cannot finalize even before a successor claims', async () => {
    const symbol = freshSymbol();
    await claimGroups(db, { etDate: ET, symbol, owner: 'job-a', groups: ['news'], nowMs: T0 });
    expect((await finalizeGroup(db, { etDate: ET, symbol, owner: 'job-a', group: 'news', generation: 1, fields: { news: [] }, nowMs: T0 + EVIDENCE_LEASE_MS + 5 })).outcome).toBe('stale_generation');
    expect((await readSymbolEvidence(db, { etDate: ET, symbol })).news).toBeNull();
  });

  it('a group another job holds is busy; a done group is never refetched; reserved groups read as null', async () => {
    const symbol = freshSymbol();
    const fetched = [];
    const fetchGroup = async (g) => { fetched.push(g); return g === 'price' ? { fields: { price: { lastClose: 10, lastCloseAsOf: '2026-11-06' } }, state: 'ready' } : { fields: { news: [], sources: { eodhd: 'ok', newsfilter: 'skipped', fantasytimes: 'ok' } }, state: 'ready' }; };
    const one = await ensureSymbolEvidence(db, { etDate: ET, symbol, owner: 'job-1', fetchGroup, nowMs: () => T0 });
    expect(fetched.sort()).toEqual(['news', 'price']);
    expect(one.record).toMatchObject({ symbol, etDate: ET, price: { lastClose: 10 }, news: [], release: null, earnings: null });
    const two = await ensureSymbolEvidence(db, { etDate: ET, symbol, owner: 'job-2', fetchGroup, nowMs: () => T0 + 1000 });
    expect(fetched).toHaveLength(2);
    expect(two.skipped).toEqual([]);
    // a held claim: job-3 sees it busy, waits, and notes it skipped
    const held = freshSymbol();
    await claimGroups(db, { etDate: ET, symbol: held, owner: 'job-x', groups: ['news'], nowMs: T0 });
    const waited = await ensureSymbolEvidence(db, { etDate: ET, symbol: held, owner: 'job-3', fetchGroup, nowMs: () => T0 + 10, waitMs: 20, pollMs: 10, sleep: async () => {} });
    expect(waited.skipped).toEqual(['news']);
  });
});
