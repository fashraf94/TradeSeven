// test/rules/huddleApply.rules.mjs
//
// Huddle S1 — THE APPLY MODULE AGAINST THE REAL FIRESTORE EMULATOR (spec V1.1 §9
// offline concurrency tests; Amendment A §A11; Amendment B §B5; Amendment C V1.2 §C15).
// Not a security-rules test: the B1 transaction (the battle's slot and the huddle
// record's receipt in one commit) run through the Admin SDK as in production, so it
// rides the emulator runner, `npm run test:rules`, outside the default suite (the
// setupEvidenceStore.rules.mjs precedent). Each row works under its own uid and battle.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL, unmocked import of the module
// is the runtime guard for its import graph here too. Never mock it.

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { applyPlanToBattle, applyConfirmedPlan, reconcileHuddle, statusOfBattles } from '../../api/_utils/huddle/applyPlan.js';
import { DISPOSITIONS, GAME_PLAN_SOURCE } from '../../api/_utils/huddle/applyRules.js';
import { planThreadIdOf } from '../../api/_utils/huddle/planTemplates.js';
import { getSessionForDate } from '../../api/_utils/marketSchedule.js';
import { COCKPIT_ALLOWLIST_ENV } from '../../api/_utils/callRecords/allowlist.js';

const RUN = Date.now().toString(36);
const ET = '2026-11-09';
const SESSION = getSessionForDate(ET);
const EARLY = '2026-11-27';
const EARLY_SESSION = getSessionForDate(EARLY);
const MIN = 60_000;

let app;
let db;
let n = 0;

beforeAll(() => {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '';
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) throw new Error(`huddleApply needs the local Firestore emulator (FIRESTORE_EMULATOR_HOST=${host || 'unset'}) — run npm run test:rules`);
  app = initializeApp({ projectId: 'demo-tradeseven-rules' }, `huddle-apply-${RUN}`);
  db = getFirestore(app);
});
afterAll(async () => { if (app) await deleteApp(app); });

/** A fresh owner and battle ids, so each row owns its documents. */
function fresh() {
  n += 1;
  return { uid: `hu${RUN}${n}`, b1: `hb${RUN}${n}a`, b2: `hb${RUN}${n}b` };
}
const conf = (archetype, revision, confirmedAtMs, text) => ({
  current: { stances: [], lines: [] }, revision, archetype, renderedText: text, renderedTextHash: `hash-${revision}`, confirmedAt: new Date(confirmedAtMs).toISOString(),
});
async function seedRecord(uid, etDate, session, confirmations) {
  await db.doc(`huddles/${uid}/days/${etDate}`).set({
    uid, etDate, status: 'ready',
    session: { etDate, isTradingDay: true, isEarlyClose: session.isEarlyClose, openMs: session.openMs, closeMs: session.closeMs },
    plan: { status: 'confirmed', confirmations, confirmed: confirmations[confirmations.length - 1], applications: [] },
  });
}
async function seedBattle(id, uid, etDate, over = {}) {
  await db.doc(`agentBattles/${id}`).set({
    ownerId: uid, agentId: `agent-${id}`, status: 'active', gameMode: 'baggerbomb_agent',
    agentContext: { archetype: 'analyst' }, timing: { tradingDays: [etDate] }, directive: null, chatExchanges: [], ...over,
  });
}
const record = async (uid, etDate = ET) => (await db.doc(`huddles/${uid}/days/${etDate}`).get()).data();
const battleDoc = async (id) => (await db.doc(`agentBattles/${id}`).get()).data();
const planRows = (b) => (b.chatExchanges || []).filter((e) => e.source === GAME_PLAN_SOURCE);

describe('B §B5 / V1.1 §9 — one filing and one receipt under contention', () => {
  it('two concurrent appliers on one (battle, revision): exactly one written receipt and one filing', async () => {
    const { uid, b1 } = fresh();
    await seedRecord(uid, ET, SESSION, [conf('analyst', 'r1', SESSION.openMs - 60 * MIN, 'GAME PLAN one')]);
    await seedBattle(b1, uid, ET);
    const nowMs = SESSION.openMs + 5 * MIN;
    const results = await Promise.all([
      applyPlanToBattle(db, { uid, etDate: ET, battleId: b1, writtenBy: 'confirm', nowMs }),
      applyPlanToBattle(db, { uid, etDate: ET, battleId: b1, writtenBy: 'sweep', nowMs }),
      applyPlanToBattle(db, { uid, etDate: ET, battleId: b1, writtenBy: 'reconcile', nowMs }),
    ]);
    expect(results.filter((r) => r.outcome === 'written')).toHaveLength(1);
    expect(results.filter((r) => r.outcome === 'already_written')).toHaveLength(2);
    const rec = await record(uid);
    expect(rec.plan.applications.filter((r) => r.disposition === DISPOSITIONS.WRITTEN)).toHaveLength(1);
    const b = await battleDoc(b1);
    expect(planRows(b)).toHaveLength(1);
    expect(b.directive).toMatchObject({ text: 'GAME PLAN one', directiveThreadId: planThreadIdOf({ uid, etDate: ET, revision: 'r1' }), textVersion: 'plan.v1', expiry: 'end_of_battle' });
  });

  it('an unknown outcome is repaired by the receipt: the next caller finds it and files nothing (A §A11, B §B1)', async () => {
    const { uid, b1 } = fresh();
    await seedRecord(uid, ET, SESSION, [conf('analyst', 'r1', SESSION.openMs - 60 * MIN, 'GAME PLAN two')]);
    await seedBattle(b1, uid, ET);
    // the first commit lands, but its caller never learns it (a sweep past its deadline):
    // the result is discarded, only the commit's effect remains
    await applyPlanToBattle(db, { uid, etDate: ET, battleId: b1, writtenBy: 'sweep', nowMs: SESSION.openMs + MIN }).then(() => undefined, () => undefined);
    const again = await applyPlanToBattle(db, { uid, etDate: ET, battleId: b1, writtenBy: 'sweep', nowMs: SESSION.openMs + 16 * MIN });
    expect(again.outcome).toBe('already_written');
    const tally = await reconcileHuddle(db, { uid, etDate: ET, nowMs: SESSION.openMs + 17 * MIN });
    expect(tally.applied).toBe(0);
    expect(planRows(await battleDoc(b1))).toHaveLength(1);
    expect((await record(uid)).plan.applications).toHaveLength(1);
  });

  it('apply commits, a cockpit command replaces the slot and is later cleared: a later sweep does NOT re-file', async () => {
    const { uid, b1 } = fresh();
    await seedRecord(uid, ET, SESSION, [conf('analyst', 'r1', SESSION.openMs - 60 * MIN, 'GAME PLAN three')]);
    await seedBattle(b1, uid, ET);
    expect((await applyPlanToBattle(db, { uid, etDate: ET, battleId: b1, writtenBy: 'confirm', nowMs: SESSION.openMs + MIN })).outcome).toBe('written');
    await db.doc(`agentBattles/${b1}`).update({ directive: { text: 'cmd', directiveThreadId: 't-call', family: 'call', expiresAtMs: SESSION.openMs + 20 * MIN, createdAt: new Date(SESSION.openMs + 2 * MIN).toISOString(), callId: 'c1' } });
    await db.doc(`agentBattles/${b1}`).update({ directive: null });
    const later = await applyPlanToBattle(db, { uid, etDate: ET, battleId: b1, writtenBy: 'sweep', nowMs: SESSION.openMs + 30 * MIN });
    expect(later.outcome).toBe('already_written');
    const b = await battleDoc(b1);
    expect(b.directive).toBeNull();
    expect(planRows(b)).toHaveLength(1);
    // ...and the status reads "no longer current", with no "since" (the slot is empty)
    await reconcileHuddle(db, { uid, etDate: ET, nowMs: SESSION.openMs + 31 * MIN });
    const [status] = statusOfBattles((await record(uid)).plan);
    expect(status).toMatchObject({ disposition: 'written', replacedSince: null });
    expect(status.replacedAt).toBeTruthy();
  });

  it('an expired cockpit command followed by re-application: retry_live_call, then written', async () => {
    const { uid, b1 } = fresh();
    const before = process.env[COCKPIT_ALLOWLIST_ENV];
    process.env[COCKPIT_ALLOWLIST_ENV] = uid;
    try {
      await seedRecord(uid, ET, SESSION, [conf('analyst', 'r1', SESSION.openMs - 60 * MIN, 'GAME PLAN four')]);
      await seedBattle(b1, uid, ET, { directive: { text: 'cmd', directiveThreadId: 't-call', family: 'call', expiresAtMs: SESSION.openMs + 10 * MIN, createdAt: new Date(SESSION.openMs - 120 * MIN).toISOString(), callId: 'c1' } });
      const first = await applyPlanToBattle(db, { uid, etDate: ET, battleId: b1, writtenBy: 'sweep', nowMs: SESSION.openMs + 5 * MIN });
      expect(first.disposition).toBe(DISPOSITIONS.RETRY_LIVE_CALL);
      const second = await applyPlanToBattle(db, { uid, etDate: ET, battleId: b1, writtenBy: 'sweep', nowMs: SESSION.openMs + 20 * MIN });
      expect(second.outcome).toBe('written');
      const rec = await record(uid);
      expect(rec.plan.applications).toHaveLength(1);
      expect(rec.plan.applications[0].disposition).toBe('written');
    } finally {
      if (before === undefined) delete process.env[COCKPIT_ALLOWLIST_ENV]; else process.env[COCKPIT_ALLOWLIST_ENV] = before;
    }
  });
});

describe('B §B3 / §B5 — retirement at the close, early close included', () => {
  it('early close (1:00 PM ET): the first reconcile after 1:00 PM retires the plan; a newer chat directive is untouched', async () => {
    const { uid, b1, b2 } = fresh();
    await seedRecord(uid, EARLY, EARLY_SESSION, [conf('analyst', 'r1', EARLY_SESSION.openMs - 60 * MIN, 'GAME PLAN five')]);
    await seedBattle(b1, uid, EARLY);
    await seedBattle(b2, uid, EARLY);
    await applyConfirmedPlan(db, { uid, etDate: EARLY, writtenBy: 'confirm', nowMs: EARLY_SESSION.openMs + MIN });
    const chat = { text: 'hold everything', directiveThreadId: 't-chat-newer', createdAt: new Date(EARLY_SESSION.openMs + 30 * MIN).toISOString(), expiry: 'end_of_battle' };
    await db.doc(`agentBattles/${b2}`).update({ directive: chat });
    // before the close nothing is retired
    let tally = await reconcileHuddle(db, { uid, etDate: EARLY, nowMs: EARLY_SESSION.closeMs - MIN });
    expect(tally.retired).toBe(0);
    expect((await battleDoc(b1)).directive?.directiveThreadId).toBe(planThreadIdOf({ uid, etDate: EARLY, revision: 'r1' }));
    tally = await reconcileHuddle(db, { uid, etDate: EARLY, nowMs: EARLY_SESSION.closeMs + MIN });
    expect(tally.retired).toBe(2);
    expect((await battleDoc(b1)).directive).toBeNull();
    expect((await battleDoc(b2)).directive).toEqual(chat);
    const apps = (await record(uid, EARLY)).plan.applications;
    expect(apps.find((r) => r.battleId === b1)).toMatchObject({ retiredSlot: true });
    expect(apps.find((r) => r.battleId === b2)).toMatchObject({ retiredSlot: false });
    expect(EARLY_SESSION.isEarlyClose).toBe(true);
  });
});

describe('V1.1 §6.4 — heard from the battle\'s own tick capture', () => {
  it('a rendered, unsuppressed tick with the plan\'s thread and text hash stamps heardAt; a suppressed one does not', async () => {
    const { uid, b1 } = fresh();
    await seedRecord(uid, ET, SESSION, [conf('analyst', 'r1', SESSION.openMs - 60 * MIN, 'GAME PLAN six')]);
    await seedBattle(b1, uid, ET);
    await applyPlanToBattle(db, { uid, etDate: ET, battleId: b1, writtenBy: 'confirm', nowMs: SESSION.openMs + MIN });
    const thread = planThreadIdOf({ uid, etDate: ET, revision: 'r1' });
    const at = (m) => new Date(SESSION.openMs + m * MIN).toISOString();
    await db.doc(`agentBattles/${b1}/ticks/${b1}:1`).set({ capturedAt: at(15), controls: { rendered: 'resolved', directiveThreadId: thread, directiveTextHash: 'hash-r1', directiveSuppressed: 'mode_not_enforce' } });
    await db.doc(`agentBattles/${b1}/ticks/${b1}:2`).set({ capturedAt: at(30), controls: { rendered: 'resolved', directiveThreadId: thread, directiveTextHash: 'hash-r1', directiveSuppressed: null } });
    const tally = await reconcileHuddle(db, { uid, etDate: ET, nowMs: SESSION.openMs + 31 * MIN });
    expect(tally.heard).toBe(1);
    const [status] = statusOfBattles((await record(uid)).plan);
    expect(status.heardAt).toBe(at(30));
  });
});

describe('C §C15 — a plan never reaches a battle running another archetype', () => {
  it('confirm under A, a battle under B is stale_approach; reconfirm under B writes B there; the A battle keeps its A receipt', async () => {
    const { uid, b1, b2 } = fresh();
    await seedRecord(uid, ET, SESSION, [conf('analyst', 'r1', SESSION.openMs - 60 * MIN, 'GAME PLAN A')]);
    await seedBattle(b1, uid, ET, { agentContext: { archetype: 'analyst' } });
    await seedBattle(b2, uid, ET, { agentContext: { archetype: 'contrarian' } });
    await applyConfirmedPlan(db, { uid, etDate: ET, writtenBy: 'confirm', nowMs: SESSION.openMs + MIN });
    let rec = await record(uid);
    expect(rec.plan.applications.find((r) => r.battleId === b2).disposition).toBe(DISPOSITIONS.STALE_APPROACH);
    expect((await battleDoc(b2)).directive).toBeNull();
    // the reconfirm appends a confirmation under contrarian
    await db.doc(`huddles/${uid}/days/${ET}`).update({
      'plan.confirmations': [...rec.plan.confirmations, conf('contrarian', 'r2', SESSION.openMs + 2 * MIN, 'GAME PLAN B')],
    });
    await applyConfirmedPlan(db, { uid, etDate: ET, writtenBy: 'sweep', nowMs: SESSION.openMs + 3 * MIN });
    rec = await record(uid);
    expect((await battleDoc(b2)).directive.text).toBe('GAME PLAN B');
    expect((await battleDoc(b1)).directive.text).toBe('GAME PLAN A');
    expect(rec.plan.applications.filter((r) => r.battleId === b1).map((r) => [r.revision, r.disposition])).toEqual([['r1', 'written']]);
    expect(rec.plan.applications.find((r) => r.battleId === b2 && r.revision === 'r2').disposition).toBe('written');
    // each battle holds only its own archetype's text
    expect(planRows(await battleDoc(b1)).map((e) => e.directive.text)).toEqual(['GAME PLAN A']);
    expect(planRows(await battleDoc(b2)).map((e) => e.directive.text)).toEqual(['GAME PLAN B']);
  });
});
