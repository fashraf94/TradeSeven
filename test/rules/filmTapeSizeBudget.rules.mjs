// test/rules/filmTapeSizeBudget.rules.mjs
//
// Film Room B1 (Astra F3, exit criterion 4) — THE TAPE WRITE AGAINST THE REAL
// FIRESTORE EMULATOR'S DOCUMENT LIMIT (1 MiB). Not a security-rules test: a
// writer regression that needs a real Firestore, so it rides the emulator
// runner — `npm run test:rules` (firebase emulators:exec sets
// FIRESTORE_EMULATOR_HOST), outside the default suite (no `.test.` in the
// name). The real writeTapeDay writes through the Admin SDK, as in production;
// only the writer flag is mocked on (spreading the real module).
//
// Astra's repro: an accepted source battle, an accepted core tape and a day of
// meetings each within the builder's limits (__fixtures__/sizeFixtures.js).
//   · A near-limit core (one 970,000-character rationale — Astra's size):
//     the source battle with its meetings and the core tape (written whole,
//     tags and all) are each accepted; WITHOUT the budget the refresh is
//     rejected and the whole write fails (the seam); WITH it the day writes,
//     meetings unavailable (document_size_budget) — and since this core is over
//     the budget even without them, the tag items and exits go too (step 2) —
//     every other section as the core write left it.
//   · A core within the budget (880,000): meetings unavailable, tags and every
//     other section intact; the same day with no budget is accepted too (the
//     budget is a margin under the limit, not the limit).
//   · The same two cores on a FRESH write, the meetings there from the start:
//     the fresh path is budgeted too (and without it, rejected).
//   · A core over the limit by itself (three ticks' risk reasons; every source
//     document small): rejected, as before B1 — no tape stored.

import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));

import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeTapeDay } from '../../api/_utils/filmTape/writeTapeDay.js';
import { contentOf, stableStringify } from '../../api/_utils/filmTape/tapeMerge.js';
import { tapeDocumentBytes, TAPE_SIZE_BUDGET_BYTES, FIRESTORE_MAX_DOCUMENT_BYTES, MEETINGS_OVER_BUDGET_NOTE, TAGS_OVER_BUDGET_NOTE } from '../../api/_utils/filmTape/tapeSize.js';
import { seedDay } from '../../api/_utils/filmTape/__fixtures__/tapeFixtures.js';
import { sizedDay, boundedMeetings } from '../../api/_utils/filmTape/__fixtures__/sizeFixtures.js';

const D = '2026-09-24';
const NIGHT = Date.parse('2026-09-25T02:15:30.000Z');
const LATER = NIGHT + 60_000;
const TOO_BIG = /INVALID_ARGUMENT: maximum entity size is 1048576 bytes/;   // the emulator's words (Astra's F3 repro)
const json = (v) => JSON.parse(JSON.stringify(v));
const utf8 = (s) => Buffer.byteLength(s, 'utf8');
/** The write's rejection, said for the record (the emulator's own words). */
async function rejection(p, label) {
  const err = await p.then(() => null, (e) => e);
  console.log(`[filmTapeSizeBudget] ${label}: ${err ? String(err.message).slice(0, 200) : 'not rejected'}`);
  return err;
}

let app;
let db;
beforeAll(() => {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '';
  // only ever the local emulator
  if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) throw new Error(`filmTapeSizeBudget needs the local Firestore emulator (FIRESTORE_EMULATOR_HOST=${host || 'unset'}) — run npm run test:rules`);
  app = initializeApp({ projectId: 'demo-tradeseven-rules' }, `film-tape-size-${Date.now()}`);
  db = getFirestore(app);
});
afterAll(async () => { if (app) await deleteApp(app); });

const tapePath = (fx) => `agentBattles/${fx.battleId}/tape/${D}`;
const readTape = async (fx) => { const s = await db.doc(tapePath(fx)).get(); return s.exists ? s.data() : null; };
async function seed(fx) {
  for (const [p, data] of Object.entries(seedDay({}, fx))) await db.doc(p).set(json(data));
}
/** Everything but B1's optional sections and the write's bookkeeping. */
const core = (doc) => {
  const c = structuredClone(contentOf(doc));
  delete c.meetings; delete c.tags;
  if (c.coverage) { delete c.coverage.meetings; delete c.coverage.tags; }
  return stableStringify(c);
};

/**
 * The core write (no meetings yet), then the battle's meetings filed — the source battle as the refresh reads it.
 * `coreBudget: Infinity` writes the core tape whole, tags included, as Astra's accepted core tape was (review LB-3).
 */
async function coreThenMeetings(battleId, opts, { coreBudget } = {}) {
  const fx = await sizedDay({ battleId, ...opts });
  await seed(fx);
  const first = await writeTapeDay(fx.battleId, D, { db, now: NIGHT, sizeBudget: coreBudget });
  const coreTape = await readTape(fx);
  fx.battle.gameplanMeetingHistory = boundedMeetings(D);
  await db.doc(`agentBattles/${fx.battleId}`).set(json(fx.battle));      // rejected here would fail the row: the source battle must be accepted
  return { fx, first, coreTape };
}

describe('Astra F3 — a near-limit core (Astra\'s 970,000-character rationale) and 26 bounded meetings, on the emulator', () => {
  it('the seam, WITHOUT the budget: the source battle and the core tape are accepted, the refresh with the meetings is rejected — the whole write fails, the stored tape stays as it was', async () => {
    const { fx, first, coreTape } = await coreThenMeetings('b-f3-astra-seam', { rationaleChars: 970_000 }, { coreBudget: Infinity });
    expect(first.status).toBe('written');
    expect(coreTape.passes.close.status).toBe('written');
    expect(coreTape.tags.items.length).toBeGreaterThan(0);                                // the accepted core tape carries its tags
    expect(utf8(JSON.stringify(fx.battle))).toBeGreaterThan(1_040_000);                  // the source battle, accepted above
    expect(String((await rejection(writeTapeDay(fx.battleId, D, { db, now: LATER, sizeBudget: Infinity }), 'no budget, near-limit core + meetings'))?.message)).toMatch(TOO_BIG);
    const after = await readTape(fx);
    expect(after.runCount).toBe(coreTape.runCount);
    expect(after.meetings).toEqual([]);
  });

  it('WITH the budget: the day writes — meetings unavailable (document_size_budget); still over the budget without them, the tag items and exits go too; every other section as the core write left it', async () => {
    const { fx, coreTape } = await coreThenMeetings('b-f3-astra', { rationaleChars: 970_000 }, { coreBudget: Infinity });
    expect(coreTape.tags.items.length).toBeGreaterThan(0);                                // the accepted core tape carries its tags…
    expect(coreTape.tags.exits.length).toBeGreaterThan(0);
    const r = await writeTapeDay(fx.battleId, D, { db, now: LATER });
    expect(r.status).toBe('written');
    const tape = await readTape(fx);
    expect(tape.meetings).toEqual([]);
    expect(tape.coverage.meetings).toMatchObject({ status: 'unavailable', note: MEETINGS_OVER_BUDGET_NOTE });
    expect(tape.tags).toEqual({ ...coreTape.tags, items: null, exits: null });
    expect(tape.coverage.tags).toMatchObject({ status: 'unavailable', note: TAGS_OVER_BUDGET_NOTE });
    expect(core(tape)).toBe(core(coreTape));
    expect(tapeDocumentBytes(tape)).toBeGreaterThan(TAPE_SIZE_BUDGET_BYTES);              // the core alone: written as before B1
    expect(tapeDocumentBytes(tape)).toBeLessThan(FIRESTORE_MAX_DOCUMENT_BYTES);
  });
});

describe('a core within the budget (an 880,000-character rationale) and the same meetings, on the emulator', () => {
  it('meetings unavailable (document_size_budget); tags and every other section exactly as the core write', async () => {
    const { fx, coreTape } = await coreThenMeetings('b-f3-within', { rationaleChars: 880_000 });
    expect(coreTape.tags.items.length).toBeGreaterThan(0);
    const r = await writeTapeDay(fx.battleId, D, { db, now: LATER });
    expect(r.status).toBe('written');
    const tape = await readTape(fx);
    expect(tape.meetings).toEqual([]);
    expect(tape.coverage.meetings).toMatchObject({ status: 'unavailable', note: MEETINGS_OVER_BUDGET_NOTE });
    expect(tape.tags).toEqual(coreTape.tags);
    expect(tape.coverage.tags).toEqual(coreTape.coverage.tags);
    expect(core(tape)).toBe(core(coreTape));
    // a second run reads unchanged: the budget is applied before "did anything change"
    expect((await writeTapeDay(fx.battleId, D, { db, now: LATER + 60_000 })).status).toBe('unchanged');
  });

  it('the control: the same day with no budget is accepted by the emulator, meetings and all — the budget is a margin under the limit', async () => {
    const { fx } = await coreThenMeetings('b-f3-within-control', { rationaleChars: 880_000 });
    expect((await writeTapeDay(fx.battleId, D, { db, now: LATER, sizeBudget: Infinity })).status).toBe('written');
    expect((await readTape(fx)).meetings).toHaveLength(26);
  });
});

describe('a FRESH write (no stored tape), on the emulator — the fresh path is budgeted too (review LB-2)', () => {
  it('Astra\'s near-limit core with the meetings from the start: without the budget the fresh write is rejected; with it the day writes, meetings unavailable, the tag items and exits gone', async () => {
    const seam = await sizedDay({ battleId: 'b-f3-fresh-seam', rationaleChars: 970_000, meetings: boundedMeetings(D) });
    await seed(seam);                                                                     // the source battle, meetings and all, accepted
    expect(String((await rejection(writeTapeDay(seam.battleId, D, { db, now: NIGHT, sizeBudget: Infinity }), 'no budget, fresh write'))?.message)).toMatch(TOO_BIG);
    expect(await readTape(seam)).toBeNull();
    const fx = await sizedDay({ battleId: 'b-f3-fresh', rationaleChars: 970_000, meetings: boundedMeetings(D) });
    await seed(fx);
    expect((await writeTapeDay(fx.battleId, D, { db, now: NIGHT })).status).toBe('written');
    const tape = await readTape(fx);
    expect(tape.meetings).toEqual([]);
    expect(tape.coverage.meetings).toMatchObject({ status: 'unavailable', note: MEETINGS_OVER_BUDGET_NOTE });
    expect(tape.tags.items).toBeNull();
    expect(tape.tags.exits).toBeNull();
    expect(tape.coverage.tags).toMatchObject({ status: 'unavailable', note: TAGS_OVER_BUDGET_NOTE });
    expect(tape.rationale[0].rationale).toHaveLength(970_000);                            // the core is whole
  });

  it('a core within the budget with the meetings from the start: meetings unavailable, the tags intact', async () => {
    const fx = await sizedDay({ battleId: 'b-f3-fresh-within', rationaleChars: 880_000, meetings: boundedMeetings(D) });
    await seed(fx);
    expect((await writeTapeDay(fx.battleId, D, { db, now: NIGHT })).status).toBe('written');
    const tape = await readTape(fx);
    expect(tape.meetings).toEqual([]);
    expect(tape.coverage.meetings).toMatchObject({ status: 'unavailable', note: MEETINGS_OVER_BUDGET_NOTE });
    expect(tape.tags.items.length).toBeGreaterThan(0);
  });
});

describe('a core over Firestore\'s limit by itself, on the emulator', () => {
  it('every source document is accepted; the write is rejected, as before B1 — no tape is stored', async () => {
    const fx = await sizedDay({ battleId: 'b-f3-core-over', riskTicks: 3, riskReason: 130_000, meetings: boundedMeetings(D) });
    await seed(fx);
    expect(String((await rejection(writeTapeDay(fx.battleId, D, { db, now: NIGHT }), 'core over the limit'))?.message)).toMatch(TOO_BIG);
    expect(await readTape(fx)).toBeNull();
  });
});
