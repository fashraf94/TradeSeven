// api/_utils/mandateEscape.test.js
// Spec 1 §5.4 — the escape-hatch transaction: void the old book with a
// NON-SCORING summary, create a fresh replacement at STARTING_CAPITAL, set the
// once-ever flag + active pointer in the SAME transaction (F6), cancel (never
// refuse) an open batch (D-3/I1), and hold up under the once-ever guard, the
// window rule, idempotent replay, and two-writer contention.

import { describe, it, expect } from 'vitest';
import { escapeMandate } from './mandateEscape.js';
import { makeMandateFakeDb } from './__testsupport__/mandateFakeFirestore.js';
import { buildNewMandateDoc, buildDailyRow, deriveManagerAgentId } from './mandateSchema.js';

const CAPITAL = 10_000_000;
const NOW = new Date('2026-06-10T15:00:00Z'); // day 9 of the 14-day window

function seed(over = {}) {
  const old = buildNewMandateDoc({
    mandateId: 'old1', userId: 'u1', archetype: 'analyst',
    managerAgentId: deriveManagerAgentId('u1', 'analyst'), vintageRef: 'archetypeVintages/analyst_OLD',
    cadenceTier: 'slow', createdAt: new Date('2026-06-01T13:00:00Z'), quarterStartAt: new Date('2026-06-01T13:00:00Z'),
    nextRolloverAt: new Date('2026-09-01T20:00:00Z'), escapeHatchEligibleUntil: new Date('2026-06-15T13:00:00Z'),
  });
  return {
    'userMeta/u1': { activeMandateId: 'old1', mandateEscapeHatchUsed: false, ...(over.meta || {}) },
    'mandates/old1': { ...old, revision: 3, portfolio: { ...old.portfolio, cash: 400000, totalValue: 9800000, positions: { NVDA: { shares: 30000, costBasisTotal: 9400000, avgCost: 313.33, lastMark: 313, sector: 'Technology', openedAt: '2026-06-02' } } }, ...(over.book || {}) },
    'mandates/old1/dailyRows/2026-06-02': buildDailyRow({ date: '2026-06-02', quarterIndex: 1, totalValue: CAPITAL, partial: true, regime: 'risk_on', agencyState: 'full' }),
    'mandates/old1/dailyRows/2026-06-08': buildDailyRow({ date: '2026-06-08', quarterIndex: 1, totalValue: 9800000, dayReturnPct: -0.02, regime: 'risk_off', agencyState: 'full' }),
  };
}

describe('escapeMandate — the void + replacement (FR-3)', () => {
  it('closes+voids the old book, writes a NON-SCORING summary, and creates a fresh replacement — all in one txn', async () => {
    const db = makeMandateFakeDb(seed());
    const r = await escapeMandate(db, { userId: 'u1', archetype: 'contrarian', now: NOW, requestKey: 'req1' });
    expect(r.ok).toBe(true);
    expect(r.oldMandateId).toBe('old1');
    const newId = r.newMandateId;

    // Old book: closed + voided.
    const old = db._get('mandates/old1');
    expect(old.status).toBe('closed');
    expect(old.voided).toBe(true);
    expect(old.escapeCohort).toBe(true);
    expect(old.escapeReplacedBy).toBe(newId);
    expect(old.revision).toBe(4);
    // Terminal summary: derived from rows, scoring:false (the void excludes it).
    const summary = db._get('mandates/old1/quarterSummaries/1');
    expect(summary.scoring).toBe(false);
    expect(summary.openingValue).toBe(CAPITAL);
    expect(summary.closingValue).toBe(9800000);

    // Replacement: fresh capital, new archetype/vintage/manager, quarterIndex 1,
    // NO escape window, cohort-flagged + linked.
    const nb = db._get(`mandates/${newId}`);
    expect(nb.status).toBe('active');
    expect(nb.voided).toBe(false);
    expect(nb.archetype).toBe('contrarian');
    expect(nb.managerAgentId).toBe(deriveManagerAgentId('u1', 'contrarian'));
    expect(nb.cadenceTier).toBe('standard'); // contrarian → standard
    expect(nb.portfolio.cash).toBe(CAPITAL);
    expect(nb.portfolio.totalValue).toBe(CAPITAL);
    expect(nb.quarterIndex).toBe(1);
    expect(nb.escapeHatchEligibleUntil).toBeNull(); // once ever
    expect(nb.escapeCohort).toBe(true);
    expect(nb.escapeReplacementOf).toBe('old1');
    expect(nb.vintageRef).toMatch(/^archetypeVintages\/contrarian_/);

    // userMeta: once-ever flag + active pointer flipped in the SAME txn (F6).
    const meta = db._get('userMeta/u1');
    expect(meta.mandateEscapeHatchUsed).toBe(true);
    expect(meta.activeMandateId).toBe(newId);
    expect(meta.escapeReplacedMandateId).toBe('old1');
  });

  it('the same replacement archetype resumes the SAME manager (FR-7)', async () => {
    const db = makeMandateFakeDb(seed());
    const r = await escapeMandate(db, { userId: 'u1', archetype: 'analyst', now: NOW });
    expect(db._get(`mandates/${r.newMandateId}`).managerAgentId).toBe(deriveManagerAgentId('u1', 'analyst'));
  });
});

describe('escapeMandate — once-ever + window + ownership guards', () => {
  it('a second escape is refused (once ever) — mandateEscapeHatchUsed', async () => {
    const db = makeMandateFakeDb(seed());
    await escapeMandate(db, { userId: 'u1', archetype: 'contrarian', now: NOW, requestKey: 'a' });
    const r2 = await escapeMandate(db, { userId: 'u1', archetype: 'degen', now: NOW, requestKey: 'b' });
    expect(r2).toEqual({ ok: false, code: 'escape_already_used' });
  });

  it('refuses outside the 14-day window (window expired)', async () => {
    const db = makeMandateFakeDb(seed());
    const late = new Date('2026-06-20T15:00:00Z'); // past escapeHatchEligibleUntil (06-15)
    const r = await escapeMandate(db, { userId: 'u1', archetype: 'contrarian', now: late });
    expect(r).toEqual({ ok: false, code: 'escape_window_expired' });
  });

  it('refuses when there is no active book', async () => {
    const db = makeMandateFakeDb({ 'userMeta/u1': { activeMandateId: null, mandateEscapeHatchUsed: false } });
    const r = await escapeMandate(db, { userId: 'u1', archetype: 'contrarian', now: NOW });
    expect(r).toEqual({ ok: false, code: 'no_active_book' });
  });

  it('rejects an unknown archetype', async () => {
    const db = makeMandateFakeDb(seed());
    const r = await escapeMandate(db, { userId: 'u1', archetype: 'nope', now: NOW });
    expect(r).toEqual({ ok: false, code: 'unknown_archetype' });
  });
});

describe('escapeMandate — idempotent replay (§7)', () => {
  it('a retry with the same requestKey returns the replacement, never a second escape', async () => {
    const db = makeMandateFakeDb(seed());
    const r1 = await escapeMandate(db, { userId: 'u1', archetype: 'contrarian', now: NOW, requestKey: 'K' });
    const newId = r1.newMandateId;
    const r2 = await escapeMandate(db, { userId: 'u1', archetype: 'contrarian', now: NOW, requestKey: 'K' });
    expect(r2.idempotentReplay).toBe(true);
    expect(r2.newMandateId).toBe(newId);
    // Only ONE replacement exists; the old book was not re-voided into a third book.
    const mandates = [...db._store.keys()].filter((k) => /^mandates\/[^/]+$/.test(k));
    expect(mandates.length).toBe(2); // old1 + the one replacement
  });
});

describe('escapeMandate — open-batch disposal (D-3/I1: cancel, never refuse)', () => {
  it('cancels an open batch inside the transaction rather than refusing the escape', async () => {
    const db = makeMandateFakeDb(seed({ book: { execState: { openBatchId: 'b1', openBatchSubmittedAt: NOW } } }));
    // Re-seed the book with a full execState (the override above replaced it).
    const withBatch = db._get('mandates/old1');
    db._store.set('mandates/old1', { data: { ...withBatch, execState: { ...buildNewMandateDoc({ mandateId: 'old1', userId: 'u1', archetype: 'analyst', managerAgentId: 'x', vintageRef: 'v' }).execState, openBatchId: 'b1', openBatchSubmittedAt: NOW } }, version: 1 });
    const r = await escapeMandate(db, { userId: 'u1', archetype: 'contrarian', now: NOW });
    expect(r.ok).toBe(true); // NOT refused
    expect(db._get('mandates/old1').execState.openBatchId).toBeNull();
    expect(db._get('mandates/old1/decisions/b1').status).toBe('cancelled');
  });
});

describe('escapeMandate — two-writer contention (F6)', () => {
  it('two concurrent escapes → exactly one replacement, the other refused', async () => {
    const db = makeMandateFakeDb(seed());
    let bWon = null;
    db.setBarrier(async () => {
      bWon = await escapeMandate(db, { userId: 'u1', archetype: 'degen', now: NOW, requestKey: 'B' });
    });
    const aResult = await escapeMandate(db, { userId: 'u1', archetype: 'contrarian', now: NOW, requestKey: 'A' });
    // B committed inside A's window; A's retry re-reads used=true → refused.
    expect(bWon.ok).toBe(true);
    expect(aResult).toEqual({ ok: false, code: 'escape_already_used' });
    // Exactly one replacement (B's).
    const mandates = [...db._store.keys()].filter((k) => /^mandates\/[^/]+$/.test(k));
    expect(mandates.length).toBe(2);
    expect(db._get('userMeta/u1').activeMandateId).toBe(bWon.newMandateId);
  });
});
