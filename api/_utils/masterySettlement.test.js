// api/_utils/masterySettlement.test.js
// Archetype Mastery P1 — settlement-protocol acceptance (Spec V2 §3/§5, §12;
// V2.1 memo of record). The §12 battery:
//   • ORDER-INDEPENDENCE property: permute settlement order AND evaluation
//     (slot-stamp) order ⇒ identical profiles, awards, and slot stamps.
//   • WRITE-ONCE guards under deterministic concurrent interleavings
//     (mock txn conflict + retry — the stolen-eval-lock overlap, S11.10).
//   • Stamp-as-authority: a pre-existing stamp beats recomputation.
//   • Fail-closed: quarantine / flag_disabled / daily_ceiling receipts;
//     CPU seats and unstamped (fence-path analog) completions are
//     structurally outside (V2.1 STOP-A.2).
//   • Repair sweep: stamps-only, converts a stamp→award crash into bounded
//     delay with an end state identical to the direct path.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): this test's import of
// masterySettlement.js IS the runtime guard for its src/constants imports —
// it explodes in the Node test env if a browser dep ever enters that graph.
// Never mock this import.

import { describe, it, expect } from 'vitest';
import {
  isMasterySubject,
  maybeBuildEligibilityStampFields,
  classifyModeKind,
  sameDayCohort,
  computePlacementInputs,
  stampMasterySlotFirstTick,
  runAwardTransaction,
  runRepairSweep,
} from './masterySettlement.js';
import { deriveFlagView } from './masteryConfig.js';
import { makeMockDb } from './__fixtures__/masteryMockDb.js';

const T_NOW = '2026-07-21T00:30:00.000Z';
const FLAG_ON = deriveFlagView({ entries: [{ state: 'enabled', at: '2026-07-19T00:00:00.000Z' }] }, true);
const FLAG_ROLLED_BACK = deriveFlagView(
  { entries: [{ state: 'enabled', at: '2026-07-19T00:00:00.000Z' }, { state: 'disabled', at: '2026-07-20T00:00:00.000Z' }] },
  false
);

const battle = (id, over = {}) => ({
  ownerId: 'u1',
  agentId: 'a1',
  status: 'active',
  gameMode: 'baggerbomb_agent',
  createdAt: '2026-07-20T13:00:00.000Z',
  expiresAt: '2026-07-20T20:00:00.000Z', // the ADV-2 membership-freeze boundary
  timing: { tradingDays: ['2026-07-20'] },
  scoreState: { currentScore: 0, opponentScore: 0 },
  agentContext: { archetype: 'degen' },
  ...over,
});

/**
 * The two settlement halves the cron performs, driven directly so this suite
 * stays a unit surface (the full completeBattle integration — payload
 * byte-identity, stats, vision, GC repair — lives in
 * api/cron/agent-evaluate.masteryCompletion.test.js).
 * §5.1: one transaction commits status:'completed' + the eligibility stamp —
 * the gate + fields come from the SAME maybeBuildEligibilityStampFields the
 * production completeBattle consumes, so this mimic can never certify a gate
 * the production writer no longer has. §5.2: the award transaction (which by
 * design takes no flag view — eligibility rides the persisted stamp).
 */
async function settle(db, battleId, { flagView = FLAG_ON, nowIso = T_NOW, award = true, groupCache } = {}) {
  const ref = db.collection('agentBattles').doc(battleId);
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return;
    const fresh = snap.data();
    if (fresh.status !== 'active') return;
    const payload = {
      status: 'completed',
      completedAt: nowIso,
      ...maybeBuildEligibilityStampFields(fresh, flagView, nowIso),
    };
    t.update(ref, payload);
  });
  if (award) {
    return runAwardTransaction(db, battleId, { nowIso, groupCache: groupCache ?? new Map() });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Fixture: two users' ranked battles, a league group, a training pod — all
// created before any settlement (creation data is what slots derive from).
// u1/degen has FIVE battles on NY day 2026-07-20 (ranks 1-4 ranked + a
// training battle late-evening EDT that is rank 5 → half band).
// ─────────────────────────────────────────────────────────────────────────
function buildFixture() {
  return {
    // u1 ranked (tiered vs CPU) — NY Jul 20
    'agentBattles/b1': battle('b1', { createdAt: '2026-07-20T13:00:00.000Z', scoreState: { currentScore: 40, opponentScore: 30 } }),
    'agentBattles/b2': battle('b2', { createdAt: '2026-07-20T14:00:00.000Z', scoreState: { currentScore: -10, opponentScore: 5 } }),
    'agentBattles/b3': battle('b3', { createdAt: '2026-07-20T14:30:00.000Z', scoreState: { currentScore: 0, opponentScore: 0 } }),
    'agentBattles/b4': battle('b4', { createdAt: '2026-07-20T15:00:00.000Z', scoreState: { currentScore: 80, opponentScore: 100 } }),
    // u1 guardian — separate archetype stream, same day (rank 1 in ITS stream)
    'agentBattles/g1': battle('g1', { createdAt: '2026-07-20T15:30:00.000Z', scoreState: { currentScore: 22.2, opponentScore: 22.2 }, agentContext: { archetype: 'guardian' } }),
    // u1 degen TRAINING battle, 21:00 EDT Jul 20 (= 01:00Z Jul 21) — SAME NY
    // day, rank 5 → half band; training pod → 0.6 mode mult.
    'agentBattles/tr1': battle('tr1', {
      createdAt: '2026-07-21T01:00:00.000Z',
      expiresAt: '2026-07-21T02:00:00.000Z', // late-evening battle closes after its own creation
      gameMode: 'baggerbomb_tournament',
      groupId: 'g-train',
      scoreState: { currentScore: 60 },
    }),
    'agentBattles/tr-cpu': battle('tr-cpu', {
      ownerId: 'cpu-owner', agentId: 'cpu-a', isCpu: true,
      createdAt: '2026-07-21T01:00:30.000Z',
      expiresAt: '2026-07-21T02:00:00.000Z',
      gameMode: 'baggerbomb_tournament', groupId: 'g-train',
      scoreState: { currentScore: 20 },
    }),
    // League group: u2 vs u3 vs a CPU seat that tops the field
    'agentBattles/tb-u2': battle('tb-u2', {
      ownerId: 'u2', agentId: 'a2', createdAt: '2026-07-20T13:30:00.000Z',
      gameMode: 'baggerbomb_tournament', groupId: 'g-league',
      scoreState: { currentScore: 50 },
    }),
    'agentBattles/tb-u3': battle('tb-u3', {
      ownerId: 'u3', agentId: 'a3', createdAt: '2026-07-20T13:31:00.000Z',
      gameMode: 'baggerbomb_tournament', groupId: 'g-league',
      scoreState: { currentScore: 30 }, agentContext: { archetype: 'guardian' },
    }),
    'agentBattles/tb-cpu': battle('tb-cpu', {
      ownerId: 'cpu-owner', agentId: 'cpu-b', isCpu: true,
      createdAt: '2026-07-20T13:32:00.000Z',
      gameMode: 'baggerbomb_tournament', groupId: 'g-league',
      scoreState: { currentScore: 70 },
    }),
    'tournamentGroups/g-train': { isTraining: true, status: 'battle' },
    'tournamentGroups/g-league': { status: 'battle' },
  };
}

// Mastery subjects (stampable) vs the full settle set: CPU seats complete
// too (the cron completes every expired battle) — they just never stamp —
// and the B4 cohort-terminality gate WAITS on them, so scenarios must
// settle them for tournament awards to resolve.
const SUBJECT_IDS = ['b1', 'b2', 'b3', 'b4', 'g1', 'tr1', 'tb-u2', 'tb-u3'];
const ALL_IDS = [...SUBJECT_IDS, 'tb-cpu', 'tr-cpu'];

/** Full end-state snapshot the property compares. */
function snapshotMastery(db) {
  const out = { profiles: {}, awards: {}, slots: {} };
  for (const uid of ['u1', 'u2', 'u3']) out.profiles[uid] = db.__dump(`masteryProfiles/${uid}`);
  for (const id of ALL_IDS) {
    const doc = db.__dump(`agentBattles/${id}`);
    out.awards[id] = doc?.masteryAward;
    out.slots[id] = doc?.masterySlot;
  }
  return out;
}

async function runScenario({ stampOrder = [], settleOrder = ALL_IDS }) {
  const db = makeMockDb(buildFixture());
  // "evaluation order": first-tick slot stamps for a subset, in the given order
  for (const id of stampOrder) {
    const doc = { id, ...db.__dump(`agentBattles/${id}`) };
    await stampMasterySlotFirstTick(db, doc, { nowIso: T_NOW });
  }
  for (const id of settleOrder) await settle(db, id);
  // Drain: tournament awards deferred by the B4 cohort-terminality gate
  // (cohort_pending while any same-day sibling was still live) resolve via
  // the repair sweep once the whole cohort is terminal — the production
  // convergence path, on the existing cadence.
  await runRepairSweep(db, { nowIso: T_NOW, limit: 50 });
  return snapshotMastery(db);
}

describe('§12 ORDER-INDEPENDENCE property — permute settlement AND evaluation order ⇒ identical totals', () => {
  it('holds across settlement permutations × stamp-subset permutations', async () => {
    const baseline = await runScenario({ stampOrder: [], settleOrder: ALL_IDS });

    const scenarios = [
      { stampOrder: [], settleOrder: [...ALL_IDS].reverse() },
      { stampOrder: [], settleOrder: ['tb-cpu', 'tr1', 'tb-u3', 'b4', 'b1', 'g1', 'tr-cpu', 'tb-u2', 'b3', 'b2'] },
      // every SUBJECT first-tick-stamped, natural then reversed stamp order
      { stampOrder: SUBJECT_IDS, settleOrder: ALL_IDS },
      { stampOrder: [...SUBJECT_IDS].reverse(), settleOrder: [...ALL_IDS].reverse() },
      // half stamped (ticks reached some battles), settlement interleaved
      { stampOrder: ['b2', 'tr1', 'tb-u2'], settleOrder: ['tb-u2', 'b1', 'tr-cpu', 'tr1', 'b3', 'tb-u3', 'b2', 'g1', 'tb-cpu', 'b4'] },
    ];
    for (const s of scenarios) {
      expect(await runScenario(s)).toEqual(baseline);
    }
  });

  it('B4 mixed-close deferral: an award against a live same-day sibling waits as cohort_pending, then resolves identically', async () => {
    const db = makeMockDb(buildFixture());
    // tb-u2 settles while tb-u3 and the CPU seat are still live (the
    // crypto-extended-close shape): placement inputs are not immutable yet.
    const first = await settle(db, 'tb-u2');
    expect(first.outcome).toBe('cohort_pending');
    const mid = db.__dump('agentBattles/tb-u2');
    expect(mid.masteryAward).toBeUndefined();
    expect(mid.masteryAwardPending).toBe(true); // marker deliberately kept
    // Cohort turns terminal; the sweep resolves the deferred award.
    await settle(db, 'tb-u3');
    await settle(db, 'tb-cpu');
    await runRepairSweep(db, { nowIso: T_NOW, limit: 50 });
    const award = db.__dump('agentBattles/tb-u2').masteryAward;
    expect(award.xpFinal).toBe(80); // identical to the all-terminal-first order
    expect(db.__dump('agentBattles/tb-u2').masteryAwardPending).toBeUndefined();
  });

  it('baseline awards are the hand-computed formulaVersion-1 values', async () => {
    const s = await runScenario({});
    // u1/degen ranks by creation: b1#1 b2#2 b3#3 b4#4 tr1#5 (late-EDT same NY day)
    expect(s.slots.b4.rank).toBe(4);
    expect(s.slots.tr1.rank).toBe(5);
    expect(s.slots.tr1.date).toBe('2026-07-20');
    // b1: 25 + 20(perf) + 8(cpu win) = 53 × 1.0 × 1.0
    expect(s.awards.b1.xpFinal).toBe(53);
    // b2: floor-at-0 perf, loss → 25
    expect(s.awards.b2.xpFinal).toBe(25);
    // b3: draw (tie pays nothing) → 25
    expect(s.awards.b3.xpFinal).toBe(25);
    // b4: 25 + 40 = 65, rank 4 → ×0.5 → 32.5 → 33
    expect(s.awards.b4.xpFinal).toBe(33);
    // g1 (guardian stream rank 1): draw, perf round(11.1)=11 → 36
    expect(s.awards.g1.xpFinal).toBe(36);
    // tr1: training — 25 + 30 + 8(won field: 60 > 20 CPU) = 63 × 0.6 × 0.5 = 18.9 → 19
    expect(s.awards.tr1.xpFinal).toBe(19);
    expect(s.awards.tr1.multipliers).toEqual({ mode: 0.6, rateBand: 0.5 });
    // tb-u2 (league): 25 + 25 + 30(outplaced u3; CPU top blocks field win) = 80
    expect(s.awards['tb-u2'].xpFinal).toBe(80);
    // tb-u3: 25 + 15 + 0 = 40
    expect(s.awards['tb-u3'].xpFinal).toBe(40);
    // profiles
    expect(s.profiles.u1.archetypes.degen.xp).toBe(53 + 25 + 25 + 33 + 19);
    expect(s.profiles.u1.archetypes.degen.battlesCounted).toBe(5);
    expect(s.profiles.u1.archetypes.guardian.xp).toBe(36);
    expect(s.profiles.u2.archetypes.degen.xp).toBe(80);
    expect(s.profiles.u3.archetypes.guardian.xp).toBe(40);
    // CPU seats: structurally outside — no stamp, no award, no slot
    expect(s.awards['tb-cpu']).toBeUndefined();
    expect(s.slots['tb-cpu']).toBeUndefined();
  });
});

describe('write-once guards under deterministic interleavings (S11.10 stolen-lock overlap)', () => {
  it('award transaction: the losing racer retries, sees the winner, and no-ops (profile counted ONCE)', async () => {
    const db = makeMockDb(buildFixture());
    await settle(db, 'b1', { award: false }); // stamped, pending, unawarded
    db.__beforeCommit = () => runAwardTransaction(db, 'b1', { nowIso: T_NOW });
    const outcome = await runAwardTransaction(db, 'b1', { nowIso: T_NOW });
    expect(outcome.outcome).toBe('already_awarded');
    expect(db.__dump('masteryProfiles/u1').archetypes.degen.xp).toBe(53);
    expect(db.__dump('masteryProfiles/u1').archetypes.degen.battlesCounted).toBe(1);
    expect(db.__dump('agentBattles/b1').masteryAwardPending).toBeUndefined();
  });

  it('completion stamp: the losing racer never re-stamps (active-state guard) — stampedAt is the winner’s', async () => {
    const db = makeMockDb(buildFixture());
    const T_FIRST = '2026-07-21T00:10:00.000Z';
    db.__beforeCommit = () => settle(db, 'b1', { nowIso: T_FIRST, award: false });
    await settle(db, 'b1', { nowIso: T_NOW, award: false });
    const doc = db.__dump('agentBattles/b1');
    expect(doc.masteryEligibility.stampedAt).toBe(T_FIRST);
    expect(doc.completedAt).toBe(T_FIRST);
  });

  it('slot stamp: first committer wins; AUTHORITY INVERSION — the surviving stamp beats recomputation at award time', async () => {
    const db = makeMockDb(buildFixture());
    // A competing worker (different cohort view) stamps rank 6 first.
    db.__beforeCommit = async () => {
      await db.collection('agentBattles').doc('b1').update({
        masterySlot: { date: '2026-07-20', rank: 6, rateBand: 0.5, assignedAt: '2026-07-21T00:05:00.000Z' },
      });
    };
    const res = await stampMasterySlotFirstTick(db, { id: 'b1', ...db.__dump('agentBattles/b1') }, { nowIso: T_NOW });
    expect(res.stamped).toBe(false); // we lost
    expect(db.__dump('agentBattles/b1').masterySlot.rank).toBe(6);
    // Award honors the stamp (rank 6 → half band), NOT the recomputed rank 1.
    const outcome = await settle(db, 'b1');
    expect(outcome.outcome).toBe('awarded');
    const award = db.__dump('agentBattles/b1').masteryAward;
    expect(award.multipliers.rateBand).toBe(0.5);
    expect(award.xpFinal).toBe(Math.round(53 * 0.5)); // 26.5 → 27
  });
});

describe('fail-closed receipts + structural outsiders', () => {
  it('alien archetype → quarantined zero receipt + server-only ledger entry; profile untouched', async () => {
    const db = makeMockDb({
      'agentBattles/qx': battle('qx', { agentContext: { archetype: 'unknown' } }),
    });
    const outcome = await settle(db, 'qx');
    expect(outcome.outcome).toBe('quarantined');
    const doc = db.__dump('agentBattles/qx');
    expect(doc.masteryAward.xpFinal).toBe(0);
    expect(doc.masteryAward.reasonCode).toBe('quarantined');
    expect(doc.masteryAwardPending).toBeUndefined();
    expect(db.__dump('masteryProfiles/u1')).toBeUndefined();
    const ledger = db.__paths('masteryQuarantine/');
    expect(ledger.length).toBe(1);
    expect(db.__dump(ledger[0]).diagnostic).toMatch(/^alien_archetype:/);
  });

  it('tournament battle with an unresolvable group doc → quarantined (mode never defaults)', async () => {
    const db = makeMockDb({
      'agentBattles/qg': battle('qg', { gameMode: 'baggerbomb_tournament', groupId: 'missing-group', scoreState: { currentScore: 10 } }),
    });
    const outcome = await settle(db, 'qg');
    expect(outcome.outcome).toBe('quarantined');
    expect(db.__dump('agentBattles/qg').masteryAward.reasonCode).toBe('quarantined');
  });

  it('rolled-back writer (0·1·0 posture): stamp lands INELIGIBLE → flag_disabled zero receipt, profile untouched', async () => {
    const db = makeMockDb(buildFixture());
    const outcome = await settle(db, 'b1', { flagView: FLAG_ROLLED_BACK });
    expect(outcome.outcome).toBe('zero_receipt');
    const doc = db.__dump('agentBattles/b1');
    expect(doc.masteryEligibility.eligible).toBe(false);
    expect(doc.masteryAward.reasonCode).toBe('flag_disabled');
    expect(doc.masteryAward.xpFinal).toBe(0);
    expect(doc.masteryAwardPending).toBeUndefined();
    expect(db.__dump('masteryProfiles/u1')).toBeUndefined();
  });

  it('rank 7+ → real award, xpFinal 0, reasonCode daily_ceiling; battlesCounted still increments', async () => {
    const docs = {};
    for (let i = 1; i <= 7; i++) {
      docs[`agentBattles/c${i}`] = battle(`c${i}`, {
        ownerId: 'u5',
        createdAt: `2026-07-20T1${i}:00:00.000Z`,
        scoreState: { currentScore: 20, opponentScore: 0 },
      });
    }
    const db = makeMockDb(docs);
    for (let i = 1; i <= 7; i++) await settle(db, `c${i}`);
    const seventh = db.__dump('agentBattles/c7').masteryAward;
    expect(seventh.xpFinal).toBe(0);
    expect(seventh.reasonCode).toBe('daily_ceiling');
    expect(seventh.multipliers.rateBand).toBe(0);
    const prof = db.__dump('masteryProfiles/u5').archetypes.degen;
    expect(prof.battlesCounted).toBe(7);
    // ranks 1-3 full (43 each: 25+10+8), 4-6 half (round(21.5)=22 each... wait 43×0.5=21.5→22)
    expect(prof.xp).toBe(43 * 3 + 22 * 3);
  });

  it('CPU seat: never stamped, never awarded, no receipt (structurally outside mastery)', async () => {
    const db = makeMockDb(buildFixture());
    await settle(db, 'tb-cpu');
    const doc = db.__dump('agentBattles/tb-cpu');
    expect(doc.status).toBe('completed');
    expect(doc.masteryEligibility).toBeUndefined();
    expect(doc.masteryAward).toBeUndefined();
  });

  it('unstamped completed battle (fence-path expiry analog, V2.1 STOP-A.2): award refuses and the sweep never touches it', async () => {
    const db = makeMockDb({
      'agentBattles/fx': battle('fx', { status: 'completed', completedAt: T_NOW, completionReason: 'expired' }),
    });
    const outcome = await runAwardTransaction(db, 'fx', { nowIso: T_NOW });
    expect(outcome.outcome).toBe('unstamped');
    const sweep = await runRepairSweep(db, { nowIso: T_NOW });
    expect(sweep.attempted).toBe(0);
    expect(db.__dump('agentBattles/fx').masteryAward).toBeUndefined();
  });

  it('PENDING-POISON hardening: a pending-marked doc in a defensive state resolves to a quarantined receipt — the sweep can never be starved by immortal tenants', async () => {
    // Invariant-breach doc: pending marker set but NO stamp (e.g. a rogue
    // backfill write). Without hardening this would be re-fetched by every
    // sweep run forever, occupying one of its 25 slots.
    const db = makeMockDb({
      'agentBattles/poison': battle('poison', {
        status: 'completed',
        completedAt: T_NOW,
        masteryAwardPending: true, // marker without stamp — the anomaly
      }),
    });
    const sweep = await runRepairSweep(db, { nowIso: T_NOW });
    expect(sweep.attempted).toBe(1);
    expect(sweep.receipts).toBe(1);
    const doc = db.__dump('agentBattles/poison');
    expect(doc.masteryAward.reasonCode).toBe('quarantined');
    expect(doc.masteryAwardPending).toBeUndefined();
    const ledger = db.__paths('masteryQuarantine/');
    expect(ledger.length).toBe(1);
    expect(db.__dump(ledger[0]).diagnostic).toBe('pending_state_anomaly:unstamped');
    // Second sweep: fully drained.
    const second = await runRepairSweep(db, { nowIso: T_NOW });
    expect(second.attempted).toBe(0);
  });

  it('B5: a missing/corrupt score quarantines — never masquerades as zero', async () => {
    const db = makeMockDb({
      'agentBattles/noscore': battle('noscore', { scoreState: {} }), // currentScore absent
    });
    const outcome = await settle(db, 'noscore');
    expect(outcome.outcome).toBe('quarantined');
    const doc = db.__dump('agentBattles/noscore');
    expect(doc.masteryAward.xpFinal).toBe(0);
    expect(doc.masteryAward.reasonCode).toBe('quarantined');
    expect(doc.masteryAward.components.participation).toBe(0); // no PARTICIPATION smuggled through
    const ledger = db.__paths('masteryQuarantine/');
    expect(db.__dump(ledger[0]).diagnostic).toMatch(/^non_finite_score:/);
  });

  it('unusable creation data: a write-once SENTINEL slot stamp ends per-tick retries and quarantines at award', async () => {
    const db = makeMockDb({
      'agentBattles/badc': battle('badc', { createdAt: 'not-a-date' }),
    });
    const first = await stampMasterySlotFirstTick(db, { id: 'badc', ...db.__dump('agentBattles/badc') }, { nowIso: T_NOW });
    expect(first.stamped).toBe(true);
    expect(first.stamp).toEqual({ date: null, rank: null, rateBand: null, assignedAt: T_NOW });
    // Next tick: stamp exists — no re-derivation, no query, no log spam.
    const second = await stampMasterySlotFirstTick(db, { id: 'badc', ...db.__dump('agentBattles/badc') }, { nowIso: T_NOW });
    expect(second.stamped).toBe(false);
    expect(second.stamp).toEqual(first.stamp);
    // Award: the sentinel's null rateBand fails validation → quarantined.
    const outcome = await settle(db, 'badc');
    expect(outcome.outcome).toBe('quarantined');
    expect(db.__dump('agentBattles/badc').masteryAward.reasonCode).toBe('quarantined');
  });
});

describe('repair sweep (§5.3) — stamps-only, registry-free, cursor-paged, bounded delay never loss', () => {
  it('a crash between stamp and award is repaired to an end state IDENTICAL to the direct path', async () => {
    const direct = await runScenario({});
    // Crash path: stamp+complete everything, never award, then sweep.
    const db = makeMockDb(buildFixture());
    for (const id of ALL_IDS) await settle(db, id, { award: false });
    const first = await runRepairSweep(db, { nowIso: T_NOW, limit: 25 });
    expect(first.attempted).toBe(SUBJECT_IDS.length); // CPU seats never stamp → never pending
    expect(first.awarded + first.receipts).toBe(SUBJECT_IDS.length);
    expect(snapshotMastery(db)).toEqual(direct);
    // Second sweep: nothing pending — inert.
    const second = await runRepairSweep(db, { nowIso: T_NOW, limit: 25 });
    expect(second.attempted).toBe(0);
  });

  it('M8: the sweep needs NO registry — pre-epoch-1 the empty pending query is its own epoch proof (and no registry read happens)', async () => {
    const db = makeMockDb(buildFixture());
    db.__resetReads();
    const res = await runRepairSweep(db, { nowIso: T_NOW });
    expect(res).toEqual({ attempted: 0, awarded: 0, receipts: 0, deferred: 0, errors: 0 });
    const reads = db.__readCounts();
    expect(reads['masteryConfig/epochRegistry']).toBeUndefined();
    // Steady empty state writes nothing (no cursor doc materialized).
    expect(db.__dump('masteryConfig/sweepCursor')).toBeUndefined();
  });

  it('M7: stable __name__ cursor pages the pending set so no doc monopolizes the window', async () => {
    const docs = {};
    for (let i = 0; i < 30; i++) {
      const id = `sw${String(i).padStart(2, '0')}`;
      docs[`agentBattles/${id}`] = battle(id, {
        ownerId: 'u7',
        createdAt: `2026-07-20T13:${String(10 + i).padStart(2, '0')}:00.000Z`,
        status: 'completed',
        completedAt: T_NOW,
        scoreState: { currentScore: 5, opponentScore: 0 },
        masteryEligibility: { eligible: true, epochId: 1, stampedAt: T_NOW },
        masteryAwardPending: true,
      });
    }
    const db = makeMockDb(docs);
    const first = await runRepairSweep(db, { nowIso: T_NOW, limit: 25 });
    expect(first.attempted).toBe(25);
    expect(db.__dump('masteryConfig/sweepCursor').lastDocId).toBe('sw24'); // full page → cursor advanced
    const second = await runRepairSweep(db, { nowIso: T_NOW, limit: 25 });
    expect(second.attempted).toBe(5); // resumes AFTER the cursor
    expect(db.__dump('masteryConfig/sweepCursor').lastDocId).toBeNull(); // short page → reset for wrap-around
    const third = await runRepairSweep(db, { nowIso: T_NOW, limit: 25 });
    expect(third.attempted).toBe(0); // all resolved
  });
});

describe('unit surfaces', () => {
  it('classifyModeKind: ranked / league / training / fail-closed null', () => {
    expect(classifyModeKind({ gameMode: 'baggerbomb_agent', group: null })).toBe('ranked');
    expect(classifyModeKind({ gameMode: 'baggerbomb_tournament', group: {} })).toBe('league');
    expect(classifyModeKind({ gameMode: 'baggerbomb_tournament', group: { isTraining: true } })).toBe('training');
    expect(classifyModeKind({ gameMode: 'baggerbomb_tournament', group: null })).toBeNull();
    expect(classifyModeKind({ gameMode: 'something_else', group: null })).toBeNull();
    expect(classifyModeKind({ gameMode: undefined, group: null })).toBeNull();
  });

  it('computePlacementInputs: tiered win/loss/tie against the embedded CPU', () => {
    const tiered = (mine, opp) => computePlacementInputs({ battle: battle('x', { scoreState: { currentScore: mine, opponentScore: opp } }) });
    expect(tiered(40, 30)).toEqual({ humansOutplaced: 0, wonAgainstField: true });
    expect(tiered(30, 40).wonAgainstField).toBe(false);
    expect(tiered(40, 40).wonAgainstField).toBe(false); // strict — ties pay nothing
  });

  it('computePlacementInputs: tournament counts SAME-DAY humans strictly below; non-finite sibling blocks the field win', () => {
    const DAY = { tradingDays: ['2026-07-20'] };
    const BORN = '2026-07-20T13:30:00.000Z'; // before me.expiresAt — in the cohort
    const me = battle('me', { gameMode: 'baggerbomb_tournament', groupId: 'g', scoreState: { currentScore: 50 }, timing: DAY });
    const sibs = [
      { id: 'h1', ownerId: 'u9', isCpu: undefined, createdAt: BORN, timing: DAY, scoreState: { currentScore: 30 } },
      { id: 'h2', ownerId: 'u8', createdAt: BORN, timing: DAY, scoreState: { currentScore: 50 } },  // tie — not outplaced
      { id: 'c1', ownerId: 'cpu-owner', isCpu: true, createdAt: BORN, timing: DAY, scoreState: { currentScore: 10 } }, // CPU below — not a human
    ];
    expect(computePlacementInputs({ battle: me, siblings: sibs })).toEqual({ humansOutplaced: 1, wonAgainstField: false });
    const sibsBroken = [{ id: 'h1', ownerId: 'u9', createdAt: BORN, timing: DAY, scoreState: { currentScore: NaN } }];
    expect(computePlacementInputs({ battle: me, siblings: sibsBroken }).wonAgainstField).toBe(false);
  });

  it('ADV-2 membership freeze: a same-day sibling born AFTER my close never joins my cohort — deterministically, whatever the settlement timing', () => {
    const DAY = { tradingDays: ['2026-07-20'] };
    const me = battle('me', { gameMode: 'baggerbomb_tournament', groupId: 'g', scoreState: { currentScore: 10 }, timing: DAY });
    // Late deploy retry: created 16:40 ET (20:40Z), after my 20:00Z close.
    const late = { id: 'late', ownerId: 'u9', createdAt: '2026-07-20T20:40:00.000Z', timing: DAY, status: 'active', scoreState: { currentScore: 99 } };
    // Not in MY cohort: no placement effect AND the terminality gate never waits on it.
    expect(sameDayCohort(me, [late])).toEqual([]);
    expect(computePlacementInputs({ battle: me, siblings: [late] })).toEqual({ humansOutplaced: 0, wonAgainstField: false });
    // Asymmetric and honest: MY battle (born 13:00Z, before the late battle's
    // close) IS in the late battle's cohort — it competed against my frozen score.
    const lateAsBattle = battle('late', {
      ownerId: 'u9', gameMode: 'baggerbomb_tournament', groupId: 'g',
      createdAt: '2026-07-20T20:40:00.000Z', expiresAt: '2026-07-21T00:00:00.000Z',
      scoreState: { currentScore: 99 }, timing: DAY,
    });
    const meAsSibling = { id: 'me', ownerId: 'u1', createdAt: '2026-07-20T13:00:00.000Z', timing: DAY, status: 'completed', scoreState: { currentScore: 10 } };
    expect(sameDayCohort(lateAsBattle, [meAsSibling])).toHaveLength(1);
    expect(computePlacementInputs({ battle: lateAsBattle, siblings: [meAsSibling] })).toEqual({ humansOutplaced: 1, wonAgainstField: true });
  });

  it('computePlacementInputs: DAY-SCOPING — groups keep one groupId across daily redeploys, so prior-day battles (including your OWN) are never opponents', () => {
    // /code-review high, angle-A finding: without day-scoping a training-pod
    // user "outplaces" their own day-1 battle and placement over-pays.
    const me = battle('me-d2', {
      gameMode: 'baggerbomb_tournament', groupId: 'g',
      scoreState: { currentScore: 10 },
      timing: { tradingDays: ['2026-07-21'] }, // day 2
      expiresAt: '2026-07-21T20:00:00.000Z', // day-2 close (membership-freeze boundary)
    });
    const sibs = [
      // my OWN day-1 battle — same owner, lower score: NOT an opponent
      { id: 'me-d1', ownerId: 'u1', createdAt: '2026-07-20T13:00:00.000Z', timing: { tradingDays: ['2026-07-20'] }, scoreState: { currentScore: 5 } },
      // another human's day-1 battle: wrong day — excluded entirely
      { id: 'h-d1', ownerId: 'u9', createdAt: '2026-07-20T13:00:00.000Z', timing: { tradingDays: ['2026-07-20'] }, scoreState: { currentScore: 1 } },
      // day-2 CPU seat below me — the only same-day opponent
      { id: 'c-d2', ownerId: 'cpu-owner', isCpu: true, createdAt: '2026-07-21T13:00:00.000Z', timing: { tradingDays: ['2026-07-21'] }, scoreState: { currentScore: 3 } },
    ];
    // 0 humans outplaced (own battle excluded by owner, h-d1 by day);
    // strict first among the DAY-2 field → CPU_PLACEMENT path.
    expect(computePlacementInputs({ battle: me, siblings: sibs })).toEqual({ humansOutplaced: 0, wonAgainstField: true });
    // Same-owner same-day exclusion is belt-and-braces: a same-day own doc
    // still never counts as a human outplaced.
    const ownSameDay = [{ id: 'me-dup', ownerId: 'u1', timing: { tradingDays: ['2026-07-21'] }, scoreState: { currentScore: 4 } }];
    expect(computePlacementInputs({ battle: me, siblings: ownSameDay }).humansOutplaced).toBe(0);
    // A battle with NO day key concedes placement entirely (empty cohort).
    const noDay = battle('noday', { gameMode: 'baggerbomb_tournament', groupId: 'g', scoreState: { currentScore: 99 }, timing: {} });
    expect(computePlacementInputs({ battle: noDay, siblings: sibs })).toEqual({ humansOutplaced: 0, wonAgainstField: false });
  });

  it('isMasterySubject: the one structurally-outside predicate', () => {
    expect(isMasterySubject(battle('x'))).toBe(true);
    expect(isMasterySubject(battle('x', { isCpu: true }))).toBe(false);
    expect(isMasterySubject(undefined)).toBe(true); // absent doc ≠ CPU; downstream guards handle absence
  });

  it('lazy settlement slot: an unstamped battle gets its masterySlot written in the award transaction', async () => {
    const db = makeMockDb(buildFixture());
    await settle(db, 'b4'); // no first tick ran
    const doc = db.__dump('agentBattles/b4');
    expect(doc.masterySlot).toEqual({ date: '2026-07-20', rank: 4, rateBand: 0.5, assignedAt: T_NOW });
  });
});
