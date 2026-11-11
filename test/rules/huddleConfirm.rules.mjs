// test/rules/huddleConfirm.rules.mjs
//
// Huddle S1 — CONFIRM, SKIP AND PLAYBACK ISSUANCE AGAINST THE REAL FIRESTORE EMULATOR
// (spec V1.1 §6 as replaced by Amendment A §A1; §9 "confirm with a stale baseRevision
// (409)"; A §A11 "confirm returning 422 on a transformed replacement"; Amendment C V1.2
// Amendment E §E1's rows — one confirm per archetype in play, the founder's Nov 9 case from a read-only fixture —
// which replace C15's reconfirm rows; the playback token's rotation). Admin SDK, as in production;
// the emulator runner (`npm run test:rules`). Each row works under its own uid.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL, unmocked imports are the guard.

import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { confirmPlan, skipPlan, reconfirmStateOf } from '../../api/_utils/huddle/confirmPlan.js';
import { DISPOSITIONS } from '../../api/_utils/huddle/applyRules.js';
import { FOUNDER_UID, NOV9, NOV9_SESSION, NOV9_PROPOSAL, NOV9_CONTEXT, NOV9_AGENTS, NOV9_GAME, NOV9_GAME_ID } from './__fixtures__/huddleFounderNov9.js';
import { applyConfirmedPlan } from '../../api/_utils/huddle/applyPlan.js';
import { buildPlanAtGeneration } from '../../api/_utils/huddle/planRecord.js';
import { buildSessionEvents } from '../../api/_utils/huddle/events.js';
import { issuePlaybackToken, resolvePlaybackToken, tokenHashOf } from '../../api/_utils/huddle/playback.js';
import { getSessionForDate } from '../../api/_utils/marketSchedule.js';
import { sessionWindowOf } from '../../api/_utils/huddle/records.js';
import { revisionOf, renderPlan, renderedTextHashOf } from '../../api/_utils/huddle/planTemplates.js';

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

// Amendment E §E2: a NO_ADDS_BEFORE event must fall inside the session's window (the 10:00 AM ET print does)
const EVENTS = buildSessionEvents({ etDate: ET, window: sessionWindowOf(SESSION), macroEvents: [{ date: ET, time: '10:00 AM ET', category: 'ISM Manufacturing', impact: 'high', event: 'ISM' }], earnings: [] });
const PROPOSAL = {
  stances: [{ kind: 'FADE', ticker: 'AAA', level: 48 }, { kind: 'HOLD', ticker: 'BBB' }, { kind: 'WATCH', ticker: 'CCC' }],
  lines: [{ kind: 'NO_ADDS_BEFORE', eventId: `macro:ism_manufacturing:${ET}:1000` }, { kind: 'CUT_IF_BELOW', ticker: 'BBB', level: 42 }],
};

async function seed({ archetype = 'analyst', proposal = PROPOSAL } = {}) {
  n += 1;
  const uid = `cu${RUN}${n}`;
  const { plan } = buildPlanAtGeneration({ proposal, universe: ['AAA', 'BBB', 'CCC'], closes: new Map([['AAA', 50], ['BBB', 44], ['CCC', 100]]), events: EVENTS, archetype, window: sessionWindowOf(SESSION) });
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

// Amendment E §E1 (replacing C15's confirm and reconfirm; superseding R-18): ONE confirm covers every archetype in play —
// the equipped one and every in-play game's frozen one — appending one confirmation each, in one transaction.
async function seedGame(id, uid, archetype, over = {}) {
  await db.doc(`agentBattles/${id}`).set({
    ownerId: uid, agentId: `agent-${id}`, status: 'active', gameMode: 'baggerbomb_agent',
    agentContext: { archetype }, timing: { tradingDays: [ET] }, directive: null, chatExchanges: [], ...over,
  });
}
const slotOf = async (id) => (await db.doc(`agentBattles/${id}`).get()).data().directive;

describe('E1 — one confirm per archetype in play', () => {
  it("the founder's Nov 9 case (read-only fixture): equipped Contrarian, live game Diversifier — ONE confirm files into the game", async () => {
    const uid = `fnd${RUN}`;
    const { plan } = buildPlanAtGeneration({
      proposal: NOV9_PROPOSAL, universe: NOV9_CONTEXT.universe, closes: new Map(Object.entries(NOV9_CONTEXT.closes)),
      events: { eligible: new Map(NOV9_CONTEXT.eligibleEvents.map((e) => [e.eventId, e])), untimedIds: new Set() }, archetype: 'contrarian',
    });
    const swap = (o) => JSON.parse(JSON.stringify(o).split(FOUNDER_UID).join(uid));
    await db.doc(`huddles/${uid}/days/${NOV9}`).set({ uid, etDate: NOV9, status: 'ready', session: NOV9_SESSION, plan, measurement: { editCount: 0 } });
    for (const a of NOV9_AGENTS) { const { id, ...doc } = swap(a); await db.doc(`agents/${id}-${RUN}`).set(doc); }
    const gameId = `${NOV9_GAME_ID}-${RUN}`;
    const { id: _ignored, ...game } = swap(NOV9_GAME);
    await db.doc(`agentBattles/${gameId}`).set({ ...game, directive: null, chatExchanges: [] });

    const nowMs = NOV9_SESSION.openMs + 4 * 60 * MIN; // 1:30 PM ET, the smoke's afternoon
    const out = await confirmPlan(db, { uid, etDate: NOV9, baseRevision: plan.revision, replacement: plan.current, nowMs });
    expect(out).toMatchObject({ kind: 'confirmed', body: { archetypes: ['contrarian', 'diversifier'], reconfirm: false } });
    const rec = (await db.doc(`huddles/${uid}/days/${NOV9}`).get()).data();
    expect(rec.plan.confirmations.map((c) => c.archetype)).toEqual(['contrarian', 'diversifier']);
    expect(rec.plan.confirmed.archetype).toBe('contrarian');
    await applyConfirmedPlan(db, { uid, etDate: NOV9, writtenBy: 'confirm', nowMs: nowMs + 1000 });
    const after = (await db.doc(`huddles/${uid}/days/${NOV9}`).get()).data();
    expect(after.plan.applications.map((r) => [r.battleId, r.disposition, r.archetype])).toEqual([[gameId, DISPOSITIONS.WRITTEN, 'diversifier']]);
    expect((await db.doc(`agentBattles/${gameId}`).get()).data().directive.text).toContain('Stances: HOLD CCI; WATCH RKLB.');
    // nothing missing now: the door stays shut, and a repeat is the confirmed state unchanged
    expect(await reconfirmStateOf(db, { uid, record: after, nowMs: nowMs + 2000 })).toEqual({ inPlay: ['contrarian', 'diversifier'], missing: [] });
  });

  it('two live games under A and B each receive only their own confirmation, from one confirm', async () => {
    const { uid, plan } = await seed({ archetype: 'analyst' });
    await seedGame(`ga${uid}`, uid, 'analyst');
    await seedGame(`gt${uid}`, uid, 'momentum_chaser');
    // the Trend Follower's row turns FADE AAA into WATCH AAA: a preview naming that archetype only
    const preview = await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: plan.current, nowMs: BEFORE_OPEN });
    expect(preview).toMatchObject({ kind: 'refused', status: 422, code: 'validation_changed' });
    const acknowledged = Object.fromEntries(preview.body.previews.map((p) => [p.archetype, p.revision]));
    const ok = await confirmPlan(db, { uid, etDate: ET, baseRevision: preview.body.revision, replacement: preview.body.current, acknowledged, nowMs: BEFORE_OPEN + MIN });
    expect(ok).toMatchObject({ kind: 'confirmed', body: { archetypes: ['analyst', 'momentum_chaser'] } });
    await applyConfirmedPlan(db, { uid, etDate: ET, writtenBy: 'confirm', nowMs: SESSION.openMs + MIN });
    expect((await slotOf(`ga${uid}`)).text).toContain('FADE AAA above 48.00');
    const t = (await slotOf(`gt${uid}`)).text;
    expect(t).toContain('WATCH AAA');
    expect(t).not.toContain('FADE');
  });

  it("a dissent change under one archetype only is a 422 naming THAT archetype — its name, its games, its changed items; nothing is confirmed until it is acknowledged", async () => {
    const { uid, plan } = await seed({ archetype: 'analyst' });
    await seedGame(`gt${uid}`, uid, 'momentum_chaser');
    const out = await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: plan.current, nowMs: BEFORE_OPEN });
    expect(out).toMatchObject({ status: 422, code: 'validation_changed', body: { drops: [], transforms: [] } });
    expect(out.body.previews).toEqual([{
      archetype: 'momentum_chaser', archetypeName: 'Trend Follower', games: 1, revision: expect.any(String),
      // review HD-11: the archetype's own plan and its rendered text, as it would file
      current: expect.objectContaining({ stances: [expect.objectContaining({ kind: 'WATCH', ticker: 'AAA' }), expect.objectContaining({ kind: 'HOLD', ticker: 'BBB' }), expect.objectContaining({ kind: 'WATCH', ticker: 'CCC' })] }),
      renderedText: expect.stringMatching(/Stances: WATCH AAA[^;]*; HOLD BBB; WATCH CCC\./),
      changes: [{ index: 0, kind: 'stance', from: 'FADE', to: 'WATCH', ticker: 'AAA', reason: expect.stringMatching(/trend follower/i) }],
    }]);
    expect((await read(uid)).plan.status).toBe('proposed');
    // a stale or missing acknowledgement never commits: the fresh preview again
    const stale = await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: plan.current, acknowledged: { momentum_chaser: 'not-the-revision' }, nowMs: BEFORE_OPEN + MIN });
    expect(stale).toMatchObject({ status: 422, code: 'validation_changed' });
    expect((await read(uid)).plan.status).toBe('proposed');
    // acknowledged at exactly its revision: one confirm, both confirmations
    const ok = await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: plan.current, acknowledged: { momentum_chaser: out.body.previews[0].revision }, nowMs: BEFORE_OPEN + 2 * MIN });
    expect(ok.kind).toBe('confirmed');
    const rec = await read(uid);
    expect(rec.plan.confirmations.map((c) => [c.archetype, c.current.stances[0].kind])).toEqual([['analyst', 'FADE'], ['momentum_chaser', 'WATCH']]);
    expect(rec.plan.current.stances[0].kind).toBe('FADE'); // the player's plan; the Trend Follower's version is its confirmation's
  });

  it('a game deployed AFTER confirming, under a new archetype, reads stale_approach with the door; a reconfirm files it — the missing archetype only', async () => {
    const { uid, plan } = await seed({ archetype: 'analyst', proposal: { stances: [{ kind: 'HOLD', ticker: 'BBB' }], lines: [] } });
    await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: plan.current, nowMs: BEFORE_OPEN });
    await seedGame(`gc${uid}`, uid, 'contrarian');
    await applyConfirmedPlan(db, { uid, etDate: ET, writtenBy: 'sweep', nowMs: SESSION.openMs + MIN });
    let rec = await read(uid);
    expect(rec.plan.applications.map((r) => r.disposition)).toEqual([DISPOSITIONS.STALE_APPROACH]);
    expect(await reconfirmStateOf(db, { uid, record: rec, nowMs: SESSION.openMs + MIN })).toEqual({ inPlay: ['analyst', 'contrarian'], missing: ['contrarian'] });
    // an edit cannot ride on a reconfirm: 409, nothing written
    const edited = await confirmPlan(db, { uid, etDate: ET, baseRevision: rec.plan.revision, replacement: { stances: [], lines: [] }, nowMs: SESSION.openMs + 2 * MIN });
    expect(edited).toMatchObject({ status: 409, code: 'revision_mismatch' });
    const re = await confirmPlan(db, { uid, etDate: ET, baseRevision: rec.plan.revision, replacement: rec.plan.current, nowMs: SESSION.openMs + 3 * MIN });
    expect(re).toMatchObject({ kind: 'confirmed', body: { archetypes: ['contrarian'], reconfirm: true } });
    await applyConfirmedPlan(db, { uid, etDate: ET, writtenBy: 'confirm', nowMs: SESSION.openMs + 4 * MIN });
    rec = await read(uid);
    expect(rec.plan.confirmations.map((c) => c.archetype)).toEqual(['analyst', 'contrarian']);
    // review HD-8: the equipped archetype's confirmation stays the plan's confirmed one — its time unchanged
    expect(rec.plan.confirmed).toMatchObject({ archetype: 'analyst', confirmedAt: new Date(BEFORE_OPEN).toISOString() });
    expect((await slotOf(`gc${uid}`)).text).toContain('HOLD BBB');
    expect(rec.plan.applications.find((r) => r.battleId === `gc${uid}` && r.disposition === DISPOSITIONS.WRITTEN)).toBeTruthy();
  });

  it('a plan confirmed on S1 code with a line E2 now refuses (an after-close earnings print): no door, since a reconfirm would be refused (review HD-12)', async () => {
    n += 1;
    const uid = `cu${RUN}${n}`;
    const eventId = `earn:RKLB:${ET}:amc`;
    const current = { stances: [{ kind: 'HOLD', ticker: 'BBB', origin: { kind: 'huddle', recordKind: null, recordId: null } }], lines: [{ kind: 'NO_ADDS_BEFORE', eventId, origin: { kind: 'huddle', recordKind: null, recordId: null } }] };
    const revision = revisionOf(current);
    const renderedText = renderPlan(current, { etDate: ET, eventLabels: new Map([[eventId, "RKLB's report after the close"]]) });
    const confirmation = { current, revision, archetype: 'analyst', renderedText, renderedTextHash: renderedTextHashOf(renderedText), confirmedAt: new Date(BEFORE_OPEN).toISOString() };
    // the S1 record shape: the context has no window, no outside-session ids, no report tickers
    await db.doc(`huddles/${uid}/days/${ET}`).set({
      uid, etDate: ET, status: 'ready', session: { etDate: ET, isTradingDay: true, isEarlyClose: false, openMs: SESSION.openMs, closeMs: SESSION.closeMs }, measurement: { editCount: 0 },
      plan: { templateVersion: 'plan.v1', status: 'confirmed', proposed: current, current, revision, editCount: 0, dissent: [], archetypeAtGeneration: 'analyst', archetypeSupported: true,
        context: { universe: ['BBB', 'RKLB'], closes: { BBB: 44 }, eligibleEvents: [{ eventId, label: "RKLB's report after the close", source: 'earnings', etDate: ET }], untimedEventIds: [] },
        confirmations: [confirmation], confirmed: confirmation, applications: [] },
    });
    await db.doc(`agents/ranked-${uid}`).set({ ownerId: uid, archetype: 'analyst' });
    await seedGame(`gs${uid}`, uid, 'contrarian');
    const rec = await read(uid);
    const press = await confirmPlan(db, { uid, etDate: ET, baseRevision: rec.plan.revision, replacement: rec.plan.current, nowMs: SESSION.openMs + MIN });
    expect(press).toMatchObject({ status: 409, code: 'revision_mismatch' }); // what a press would get
    expect(await reconfirmStateOf(db, { uid, record: rec, nowMs: SESSION.openMs + MIN })).toEqual({ inPlay: ['analyst', 'contrarian'], missing: [] });
  });

  it('a reconfirm with nothing missing is idempotent, and the door stays shut', async () => {
    const { uid, plan } = await seed({ archetype: 'analyst' });
    await seedGame(`ga${uid}`, uid, 'analyst');
    await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: plan.current, nowMs: BEFORE_OPEN });
    const rec = await read(uid);
    const again = await confirmPlan(db, { uid, etDate: ET, baseRevision: rec.plan.revision, replacement: rec.plan.current, nowMs: BEFORE_OPEN + MIN });
    expect(again).toMatchObject({ kind: 'already_confirmed', body: { archetypes: ['analyst'] } });
    expect((await read(uid)).plan.confirmations).toHaveLength(1);
    expect(await reconfirmStateOf(db, { uid, record: rec, nowMs: BEFORE_OPEN + MIN })).toEqual({ inPlay: ['analyst'], missing: [] });
  });

  it('an archetype switch with no game under the new one: the equipped archetype is in play, so the door opens and the reconfirm files it', async () => {
    const { uid, plan } = await seed({ archetype: 'analyst' });
    await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: plan.current, nowMs: BEFORE_OPEN });
    await db.doc(`agents/ranked-${uid}`).update({ archetype: 'momentum_chaser' });
    let rec = await read(uid);
    expect((await reconfirmStateOf(db, { uid, record: rec, nowMs: BEFORE_OPEN + MIN })).missing).toEqual(['momentum_chaser']);
    const preview = await confirmPlan(db, { uid, etDate: ET, baseRevision: rec.plan.revision, replacement: rec.plan.current, nowMs: BEFORE_OPEN + MIN });
    expect(preview).toMatchObject({ status: 422, body: { previews: [expect.objectContaining({ archetype: 'momentum_chaser', games: 0 })] } });
    expect((await read(uid)).plan.status).toBe('confirmed'); // a reconfirm preview writes nothing
    const ok = await confirmPlan(db, { uid, etDate: ET, baseRevision: rec.plan.revision, replacement: rec.plan.current, acknowledged: { momentum_chaser: preview.body.previews[0].revision }, nowMs: BEFORE_OPEN + 2 * MIN });
    expect(ok).toMatchObject({ kind: 'confirmed', body: { archetypes: ['momentum_chaser'], reconfirm: true } });
    rec = await read(uid);
    expect(rec.plan.confirmations.map((c) => c.archetype)).toEqual(['analyst', 'momentum_chaser']);
    expect(rec.plan.confirmed.archetype).toBe('momentum_chaser');
  });

  it('a game of another session, a CPU seat, or an archetype with no dissent row is NOT in play; the unsupported game keeps archetype_unsupported', async () => {
    const { uid, plan } = await seed({ archetype: 'analyst' });
    await seedGame(`go${uid}`, uid, 'contrarian', { timing: { tradingDays: ['2026-11-06'] } });
    await seedGame(`gp${uid}`, uid, 'degen', { isCpu: true });
    await seedGame(`gu${uid}`, uid, 'no_such_archetype');
    const out = await confirmPlan(db, { uid, etDate: ET, baseRevision: plan.revision, replacement: plan.current, nowMs: BEFORE_OPEN });
    expect(out).toMatchObject({ kind: 'confirmed', body: { archetypes: ['analyst'] } });
    await applyConfirmedPlan(db, { uid, etDate: ET, writtenBy: 'confirm', nowMs: SESSION.openMs + MIN });
    const rec = await read(uid);
    expect(rec.plan.applications.find((r) => r.battleId === `gu${uid}`).disposition).toBe(DISPOSITIONS.ARCHETYPE_UNSUPPORTED);
    expect(await reconfirmStateOf(db, { uid, record: rec, nowMs: SESSION.openMs + MIN })).toEqual({ inPlay: ['analyst'], missing: [] });
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
