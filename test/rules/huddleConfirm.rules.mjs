// test/rules/huddleConfirm.rules.mjs
//
// Huddle S1 — CONFIRM, SKIP AND PLAYBACK ISSUANCE AGAINST THE REAL FIRESTORE EMULATOR
// (spec V1.1 §6 as replaced by Amendment A §A1; §9 "confirm with a stale baseRevision
// (409)"; A §A11 "confirm returning 422 on a transformed replacement"; Amendment C V1.2
// §C15's reconfirm rows; the playback token's rotation). Admin SDK, as in production;
// the emulator runner (`npm run test:rules`). Each row works under its own uid.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL, unmocked imports are the guard.

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { confirmPlan, skipPlan } from '../../api/_utils/huddle/confirmPlan.js';
import { applyConfirmedPlan } from '../../api/_utils/huddle/applyPlan.js';
import { buildPlanAtGeneration } from '../../api/_utils/huddle/planRecord.js';
import { buildSessionEvents } from '../../api/_utils/huddle/events.js';
import { issuePlaybackToken, resolvePlaybackToken, tokenHashOf } from '../../api/_utils/huddle/playback.js';
import { getSessionForDate } from '../../api/_utils/marketSchedule.js';

const RUN = Date.now().toString(36);
const ET = '2026-11-09';
const SESSION = getSessionForDate(ET);
const MIN = 60_000;
const BEFORE_OPEN = SESSION.openMs - 60 * MIN;

let app;
let db;
let n = 0;

beforeAll(() => {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '';
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) throw new Error(`huddleConfirm needs the local Firestore emulator (FIRESTORE_EMULATOR_HOST=${host || 'unset'})`);
  app = initializeApp({ projectId: 'demo-tradeseven-rules' }, `huddle-confirm-${RUN}`);
  db = getFirestore(app);
});
afterAll(async () => { if (app) await deleteApp(app); });

const EVENTS = buildSessionEvents({ etDate: ET, macroEvents: [{ date: ET, time: '10:00 AM ET', category: 'ISM Manufacturing', impact: 'high', event: 'ISM' }], earnings: [] });
const PROPOSAL = {
  stances: [{ kind: 'FADE', ticker: 'AAA', level: 48 }, { kind: 'HOLD', ticker: 'BBB' }, { kind: 'WATCH', ticker: 'CCC' }],
  lines: [{ kind: 'NO_ADDS_BEFORE', eventId: `macro:ism_manufacturing:${ET}:1000` }, { kind: 'CUT_IF_BELOW', ticker: 'BBB', level: 42 }],
};

async function seed({ archetype = 'analyst', proposal = PROPOSAL } = {}) {
  n += 1;
  const uid = `cu${RUN}${n}`;
  const { plan } = buildPlanAtGeneration({ proposal, universe: ['AAA', 'BBB', 'CCC'], closes: new Map([['AAA', 50], ['BBB', 44], ['CCC', 100]]), events: EVENTS, archetype });
  await db.doc(`huddles/${uid}/days/${ET}`).set({
    uid, etDate: ET, status: 'ready', session: { etDate: ET, isTradingDay: true, isEarlyClose: false, openMs: SESSION.openMs, closeMs: SESSION.closeMs },
    plan, measurement: { editCount: 0 }, audio: { gcsPath: `huddle/${uid}/${ET}/1/audio.mp3`, durationMs: 60_000 },
  });
  await db.doc(`agents/ranked-${uid}`).set({ ownerId: uid, archetype });
  await db.doc(`agents/casual-agent-${uid}`).set({ ownerId: uid, archetype: 'degen', isCasualClone: true });
  return { uid, plan };
}
const read = async (uid) => (await db.doc(`huddles/${uid}/days/${ET}`).get()).data();

describe('A §A1 — confirm is two-step when validation changes anything', () => {
  it('a stale baseRevision is a 409 with the stored current and revision; nothing is written', async () => {
    const { uid, plan } = await seed();
    const out = await confirmPlan(db, { uid, etDate: ET, baseRevision: 'stale', replacement: plan.current, nowMs: BEFORE_OPEN });
    expect(out).toMatchObject({ kind: 'refused', status: 409, code: 'revision_mismatch', body: { revision: plan.revision, current: plan.current } });
    expect((await read(uid)).plan.status).toBe('proposed');
  });

  it('a replacement that validates unchanged confirms, freezes the confirmation and appends it', async () => {
    const { uid, plan } = await seed();
    const out = await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: plan.current, nowMs: BEFORE_OPEN });
    expect(out.kind).toBe('confirmed');
    const rec = await read(uid);
    expect(rec.plan.status).toBe('confirmed');
    expect(rec.plan.confirmations).toHaveLength(1);
    expect(rec.plan.confirmations[0]).toMatchObject({ revision: plan.revision, archetype: 'analyst' });
    expect(rec.plan.confirmed.renderedText).toContain('Stances: FADE AAA above 48.00; HOLD BBB; WATCH CCC.');
    expect(rec.measurement.confirmedAt).toBe(new Date(BEFORE_OPEN).toISOString());
    // a repeat returns the confirmed state, unchanged (idempotent)
    const again = await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: { stances: [], lines: [] }, nowMs: BEFORE_OPEN + MIN });
    expect(again.kind).toBe('already_confirmed');
    expect((await read(uid)).plan.confirmations).toHaveLength(1);
  });

  it('a transformed replacement is a 422 preview that becomes current; confirming the preview confirms', async () => {
    const { uid, plan } = await seed();
    const edited = { stances: [...plan.current.stances, { kind: 'HOLD', ticker: 'ZZZ' }], lines: [{ ...plan.current.lines[1], level: 42.005 }] };
    const out = await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: edited, nowMs: BEFORE_OPEN });
    expect(out).toMatchObject({ kind: 'refused', status: 422, code: 'validation_changed' });
    expect(out.body.drops.map((d) => d.reason).sort()).toEqual(['level_format', 'ticker_not_in_universe']);
    let rec = await read(uid);
    expect(rec.plan.status).toBe('proposed');
    expect(rec.plan.revision).toBe(out.body.revision);
    expect(rec.plan.current).toEqual(out.body.current);
    expect(rec.plan.editCount).toBe(1);
    const ok = await confirmPlan(db, { uid, etDate: ET, baseRevision: out.body.revision, replacement: out.body.current, nowMs: BEFORE_OPEN + MIN });
    expect(ok.kind).toBe('confirmed');
    rec = await read(uid);
    expect(rec.plan.confirmed.revision).toBe(out.body.revision);
    expect(rec.plan.confirmed.renderedText).not.toContain('Lines:');
  });

  it('after the close: 410, and the proposed plan is marked expired', async () => {
    const { uid, plan } = await seed();
    const out = await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: plan.current, nowMs: SESSION.closeMs });
    expect(out).toMatchObject({ status: 410, code: 'session_closed' });
    expect((await read(uid)).plan.status).toBe('expired');
  });

  it('an empty plan is not confirmed (422 empty_plan); an archetype with no row is 422 archetype_unsupported', async () => {
    const empty = await seed({ proposal: { stances: [], lines: [] } });
    expect(await confirmPlan(db, { uid: empty.uid, etDate: ET, baseRevision: empty.plan.revision, replacement: { stances: [], lines: [] }, nowMs: BEFORE_OPEN })).toMatchObject({ status: 422, code: 'empty_plan' });
    const unknown = await seed({ archetype: 'unknown' });
    expect(await confirmPlan(db, { uid: unknown.uid, etDate: ET, baseRevision: unknown.plan.revision, replacement: unknown.plan.current, nowMs: BEFORE_OPEN })).toMatchObject({ status: 422, code: 'archetype_unsupported' });
    expect((await read(unknown.uid)).plan.status).toBe('proposed');
  });
});

describe('C §C15 — reconfirm only when the equipped archetype changed', () => {
  it('a change of archetype reconfirms: the dissent transform is a 422 preview, then a second confirmation is appended under the new archetype', async () => {
    const { uid, plan } = await seed();
    await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: plan.current, nowMs: BEFORE_OPEN });
    await db.doc(`agents/ranked-${uid}`).update({ archetype: 'momentum_chaser' });
    const preview = await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: plan.current, nowMs: BEFORE_OPEN + MIN });
    expect(preview).toMatchObject({ status: 422, code: 'validation_changed' });
    expect(preview.body.dissent).toEqual([expect.objectContaining({ from: 'FADE', to: 'WATCH', archetype: 'momentum_chaser', ticker: 'AAA' })]);
    const ok = await confirmPlan(db, { uid, etDate: ET, baseRevision: preview.body.revision, replacement: preview.body.current, nowMs: BEFORE_OPEN + 2 * MIN });
    expect(ok).toMatchObject({ kind: 'confirmed', body: { reconfirm: true } });
    const rec = await read(uid);
    expect(rec.plan.confirmations.map((c) => c.archetype)).toEqual(['analyst', 'momentum_chaser']);
    expect(rec.plan.confirmed.archetype).toBe('momentum_chaser');
    // with the archetype unchanged since, a repeat is idempotent
    expect((await confirmPlan(db, { uid, etDate: ET, baseRevision: rec.plan.revision, replacement: rec.plan.current, nowMs: BEFORE_OPEN + 3 * MIN })).kind).toBe('already_confirmed');
  });

  it('two live battles under the two archetypes each receive only their own confirmation', async () => {
    const { uid, plan } = await seed();
    await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: plan.current, nowMs: BEFORE_OPEN });
    await db.doc(`agents/ranked-${uid}`).update({ archetype: 'momentum_chaser' });
    const preview = await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: plan.current, nowMs: BEFORE_OPEN + MIN });
    await confirmPlan(db, { uid, etDate: ET, baseRevision: preview.body.revision, replacement: preview.body.current, nowMs: BEFORE_OPEN + 2 * MIN });
    for (const [id, archetype] of [[`ba${uid}`, 'analyst'], [`bt${uid}`, 'momentum_chaser']]) {
      await db.doc(`agentBattles/${id}`).set({ ownerId: uid, agentId: `agent-${id}`, status: 'active', gameMode: 'baggerbomb_agent', agentContext: { archetype }, timing: { tradingDays: [ET] }, directive: null, chatExchanges: [] });
    }
    await applyConfirmedPlan(db, { uid, etDate: ET, writtenBy: 'sweep', nowMs: SESSION.openMs + MIN });
    const a = (await db.doc(`agentBattles/ba${uid}`).get()).data().directive.text;
    const t = (await db.doc(`agentBattles/bt${uid}`).get()).data().directive.text;
    expect(a).toContain('FADE AAA above 48.00');
    expect(t).toContain('WATCH AAA');
    expect(t).not.toContain('FADE');
  });
});

describe('skip', () => {
  it('a proposed plan is skipped once; a confirmed one cannot be', async () => {
    const s = await seed();
    expect((await skipPlan(db, { uid: s.uid, etDate: ET, nowMs: BEFORE_OPEN })).kind).toBe('skipped');
    expect((await skipPlan(db, { uid: s.uid, etDate: ET, nowMs: BEFORE_OPEN })).kind).toBe('already_skipped');
    expect((await read(s.uid)).measurement.skippedAt).toBe(new Date(BEFORE_OPEN).toISOString());
    const c = await seed();
    await confirmPlan(db, { uid: c.uid, etDate: ET, baseRevision: c.plan.revision, replacement: c.plan.current, nowMs: BEFORE_OPEN });
    expect(await skipPlan(db, { uid: c.uid, etDate: ET, nowMs: BEFORE_OPEN })).toMatchObject({ status: 409, code: 'not_proposed' });
  });
});

describe('playback tokens rotate', () => {
  it('a second issuance replaces the first: the old token no longer resolves, the new one does', async () => {
    const { uid } = await seed();
    const first = await issuePlaybackToken(db, { uid, etDate: ET, nowMs: BEFORE_OPEN });
    const second = await issuePlaybackToken(db, { uid, etDate: ET, nowMs: BEFORE_OPEN + MIN });
    expect((await resolvePlaybackToken(db, { token: first.token, nowMs: BEFORE_OPEN + 2 * MIN })).status).toBe(404);
    expect((await resolvePlaybackToken(db, { token: second.token, nowMs: BEFORE_OPEN + 2 * MIN })).kind).toBe('ok');
    const index = (await db.doc(`huddleRuns/${ET}`).get()).data().playback;
    expect(index[tokenHashOf(first.token)]).toBeUndefined();
    expect(index[tokenHashOf(second.token)]).toMatchObject({ uid });
    expect((await read(uid)).playback.tokenHash).toBe(tokenHashOf(second.token));
    expect(JSON.stringify(await read(uid))).not.toContain(second.token);
  });
});
