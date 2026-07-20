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
  buildEligibilityStampFields,
  classifyModeKind,
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
  timing: { tradingDays: ['2026-07-20'] },
  scoreState: { currentScore: 0, opponentScore: 0 },
  agentContext: { archetype: 'degen' },
  ...over,
});

/**
 * The two settlement halves the cron performs, driven directly so this suite
 * stays a unit surface (the full completeBattle integration — payload
 * byte-identity, stats, vision — lives in
 * api/cron/agent-evaluate.masteryCompletion.test.js).
 * §5.1: one transaction commits status:'completed' + the eligibility stamp,
 * guarded on the still-active state. §5.2: the award transaction.
 */
async function settle(db, battleId, { flagView = FLAG_ON, nowIso = T_NOW, award = true, groupCache } = {}) {
  const ref = db.collection('agentBattles').doc(battleId);
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return;
    const fresh = snap.data();
    if (fresh.status !== 'active') return;
    const payload = { status: 'completed', completedAt: nowIso };
    if (flagView.everEnabled && fresh.isCpu !== true && fresh.masteryEligibility === undefined) {
      Object.assign(payload, buildEligibilityStampFields(flagView, nowIso));
    }
    t.update(ref, payload);
  });
  if (award) {
    return runAwardTransaction(db, battleId, { flagView, nowIso, groupCache: groupCache ?? new Map() });
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
      gameMode: 'baggerbomb_tournament',
      groupId: 'g-train',
      scoreState: { currentScore: 60 },
    }),
    'agentBattles/tr-cpu': battle('tr-cpu', {
      ownerId: 'cpu-owner', agentId: 'cpu-a', isCpu: true,
      createdAt: '2026-07-21T01:00:30.000Z',
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

const SETTLE_IDS = ['b1', 'b2', 'b3', 'b4', 'g1', 'tr1', 'tb-u2', 'tb-u3'];

/** Full end-state snapshot the property compares. */
function snapshotMastery(db) {
  const out = { profiles: {}, awards: {}, slots: {} };
  for (const uid of ['u1', 'u2', 'u3']) out.profiles[uid] = db.__dump(`masteryProfiles/${uid}`);
  for (const id of [...SETTLE_IDS, 'tb-cpu', 'tr-cpu']) {
    const doc = db.__dump(`agentBattles/${id}`);
    out.awards[id] = doc?.masteryAward;
    out.slots[id] = doc?.masterySlot;
  }
  return out;
}

async function runScenario({ stampOrder = [], settleOrder = SETTLE_IDS }) {
  const db = makeMockDb(buildFixture());
  // "evaluation order": first-tick slot stamps for a subset, in the given order
  for (const id of stampOrder) {
    const doc = { id, ...db.__dump(`agentBattles/${id}`) };
    await stampMasterySlotFirstTick(db, doc, { nowIso: T_NOW });
  }
  for (const id of settleOrder) await settle(db, id);
  return snapshotMastery(db);
}

describe('§12 ORDER-INDEPENDENCE property — permute settlement AND evaluation order ⇒ identical totals', () => {
  it('holds across settlement permutations × stamp-subset permutations', async () => {
    const baseline = await runScenario({ stampOrder: [], settleOrder: SETTLE_IDS });

    const scenarios = [
      { stampOrder: [], settleOrder: [...SETTLE_IDS].reverse() },
      { stampOrder: [], settleOrder: ['tr1', 'tb-u3', 'b4', 'b1', 'g1', 'tb-u2', 'b3', 'b2'] },
      // every battle first-tick-stamped, natural then reversed stamp order
      { stampOrder: SETTLE_IDS, settleOrder: SETTLE_IDS },
      { stampOrder: [...SETTLE_IDS].reverse(), settleOrder: [...SETTLE_IDS].reverse() },
      // half stamped (ticks reached some battles), settlement interleaved
      { stampOrder: ['b2', 'tr1', 'tb-u2'], settleOrder: ['tb-u2', 'b1', 'tr1', 'b3', 'tb-u3', 'b2', 'g1', 'b4'] },
    ];
    for (const s of scenarios) {
      expect(await runScenario(s)).toEqual(baseline);
    }
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
    db.__beforeCommit = () => runAwardTransaction(db, 'b1', { flagView: FLAG_ON, nowIso: T_NOW });
    const outcome = await runAwardTransaction(db, 'b1', { flagView: FLAG_ON, nowIso: T_NOW });
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
    const outcome = await runAwardTransaction(db, 'fx', { flagView: FLAG_ON, nowIso: T_NOW });
    expect(outcome.outcome).toBe('unstamped');
    const sweep = await runRepairSweep(db, { flagView: FLAG_ON, nowIso: T_NOW });
    expect(sweep.attempted).toBe(0);
    expect(db.__dump('agentBattles/fx').masteryAward).toBeUndefined();
  });
});

describe('repair sweep (§5.3) — stamps-only, bounded delay never loss', () => {
  it('a crash between stamp and award is repaired to an end state IDENTICAL to the direct path', async () => {
    const direct = await runScenario({});
    // Crash path: stamp+complete everything, never award, then sweep.
    const db = makeMockDb(buildFixture());
    for (const id of SETTLE_IDS) await settle(db, id, { award: false });
    const first = await runRepairSweep(db, { flagView: FLAG_ON, nowIso: T_NOW, limit: 25 });
    expect(first.attempted).toBe(SETTLE_IDS.length);
    expect(first.awarded + first.receipts).toBe(SETTLE_IDS.length);
    expect(snapshotMastery(db)).toEqual(direct);
    // Second sweep: nothing pending — inert.
    const second = await runRepairSweep(db, { flagView: FLAG_ON, nowIso: T_NOW, limit: 25 });
    expect(second.attempted).toBe(0);
  });

  it('pre-epoch-1 the sweep does not even query', async () => {
    const db = makeMockDb(buildFixture());
    const res = await runRepairSweep(db, { flagView: deriveFlagView(null, false), nowIso: T_NOW });
    expect(res).toEqual({ attempted: 0, awarded: 0, receipts: 0, errors: 0 });
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

  it('computePlacementInputs: tournament counts humans strictly below; non-finite sibling blocks the field win', () => {
    const me = battle('me', { gameMode: 'baggerbomb_tournament', groupId: 'g', scoreState: { currentScore: 50 } });
    const sibs = [
      { id: 'h1', isCpu: undefined, scoreState: { currentScore: 30 } },
      { id: 'h2', scoreState: { currentScore: 50 } },  // tie — not outplaced
      { id: 'c1', isCpu: true, scoreState: { currentScore: 10 } }, // CPU below — not a human
    ];
    expect(computePlacementInputs({ battle: me, siblings: sibs })).toEqual({ humansOutplaced: 1, wonAgainstField: false });
    const sibsBroken = [{ id: 'h1', scoreState: { currentScore: NaN } }];
    expect(computePlacementInputs({ battle: me, siblings: sibsBroken }).wonAgainstField).toBe(false);
  });

  it('lazy settlement slot: an unstamped battle gets its masterySlot written in the award transaction', async () => {
    const db = makeMockDb(buildFixture());
    await settle(db, 'b4'); // no first tick ran
    const doc = db.__dump('agentBattles/b4');
    expect(doc.masterySlot).toEqual({ date: '2026-07-20', rank: 4, rateBand: 0.5, assignedAt: T_NOW });
  });
});
