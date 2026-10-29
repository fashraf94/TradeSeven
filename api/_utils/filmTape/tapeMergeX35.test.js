// api/_utils/filmTape/tapeMergeX35.test.js
//
// Film Room B2.1 rulings — Build B Amendment K RK-9 (X3-5, the B2.1 report §6): THE STORED ATTRIBUTION STANDS. A seq
// lost at a day's end is the day's own gap on the first write (made before the next session began); a later re-write,
// once the next session's first tick exists, can no longer tell the seq's day and reads it UNATTRIBUTED. The merge keeps
// the stored `no_record` row, so before this fix the day listed the seq both ways — in `passes.close.gaps` and
// `unattributedGaps`, and in `coverage.checks` as the day's gap and as "adjacent to this day". The merge now filters
// the unattributed seqs against the merged gaps and rewrites (or drops) the unattributed caveat for any seq the tape's
// own stored rows attribute to the day — the one exception to "caveats are unioned and never dropped". Every other
// caveat stays merge-monotone. Merge-only (tapeMerge.js), no assembly change; the real writer over the in-memory store,
// the multi-day fixture.

import { describe, it, expect, vi } from 'vitest';

const flags = vi.hoisted(() => ({ writer: true }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({ ...(await importOriginal()), get FILM_TAPE_WRITE_ENABLED() { return flags.writer; } }));

const { writeTapeDay } = await import('./writeTapeDay.js');
const { makeTapeDb } = await import('./__fixtures__/tapeFirestore.js');
const { seedDay, multiDay } = await import('./__fixtures__/tapeFixtures.js');
const { NOTES } = await import('./tapeNotes.js');

vi.setConfig({ testTimeout: 60_000 });

const D1 = '2026-09-21';
const NIGHT1 = Date.parse('2026-09-22T02:15:30.000Z');
const NIGHT2 = Date.parse('2026-09-23T02:15:30.000Z');
const NIGHT3 = Date.parse('2026-09-24T02:15:30.000Z');
const OWN_40 = NOTES.gapsAttributed(1, '40');
const ADJ_40 = NOTES.gapsUnattributed(1, '40');
const seqOf = (evalId) => Number(evalId.split(':e')[1]);

/**
 * The multi-day battle with day 1's last tick (seq 40) lost. `firstAfterNext`: day 1 is first written only after day 2's
 * ticks exist (so no stored row ever claims 40).
 */
async function setup({ firstAfterNext = false } = {}) {
  const fx = await multiDay({ full: true });
  const store = {};
  const upTo = firstAfterNext ? 80 : 40;
  seedDay(store, {
    ...fx,
    ticks: fx.ticks.filter((t) => t.tickSeq !== 40 && t.tickSeq <= upTo),
    battle: { ...fx.battle, evaluations: fx.battle.evaluations.filter((e) => seqOf(e.evalId) <= upTo), cronState: { tickSeq: upTo } },
  });
  const t = makeTapeDb(store);
  const key = `agentBattles/${fx.battleId}/tape/${D1}`;
  /** Day 2 happens: its ticks arrive and the battle moves on. */
  const nextSession = () => {
    for (const tk of fx.ticks.filter((x) => x.tickSeq >= 41 && x.tickSeq <= 80)) t.store.set(`agentBattles/${fx.battleId}/ticks/${tk.tickId}`, tk);
    const b = t.store.get(`agentBattles/${fx.battleId}`);
    t.store.set(`agentBattles/${fx.battleId}`, { ...b, cronState: { tickSeq: 80 }, evaluations: fx.battle.evaluations.filter((e) => seqOf(e.evalId) <= 80) });
  };
  const write = (now) => writeTapeDay(fx.battleId, D1, { db: t.db, now });
  return { t, key, nextSession, write, tape: () => t.store.get(key) };
}
const noteParts = (cov) => (cov.note || '').split('; ');
const noRecordSeqs = (tape) => tape.checks.filter((r) => r.state === 'no_record').map((r) => r.tickSeq);

describe('RK-9 — X3-5: a stored row\'s attribution stands against a later read that cannot tell the seq\'s day', () => {
  it('the report §6 repro: the first write lists 40 as the day\'s gap; after day 2\'s ticks arrive, a re-write lists it ONCE — the day\'s gap — in passes.close and in coverage.checks (the mutant: the stored gap listed as unattributed)', async () => {
    const s = await setup();
    expect((await s.write(NIGHT1)).status).toBe('written');
    const first = s.tape();
    expect(first.passes.close.gaps).toEqual([40]);
    expect(first.passes.close.unattributedGaps).toEqual([]);
    expect(noRecordSeqs(first)).toEqual([40]);
    expect(first.coverage.checks.caveats).toContain(OWN_40);
    s.nextSession();
    await s.write(NIGHT2);
    const second = s.tape();
    expect(second.passes.close.gaps).toEqual([40]);
    expect(second.passes.close.unattributedGaps).toEqual([]);
    expect(noRecordSeqs(second)).toEqual([40]);
    expect(second.coverage.checks.caveats).toContain(OWN_40);
    expect(second.coverage.checks.caveats).not.toContain(ADJ_40);
    expect(second.coverage.checks.note).not.toMatch(/adjacent to this day/);
    expect(noteParts(second.coverage.checks).filter((p) => p.includes('tickSeq 40'))).toEqual([OWN_40]);
    // everything else the second read learned is as the merge always keeps it: the section stays partial while its caveats stand
    expect(second.coverage.checks.status).toBe('partial');
  });

  it('a third re-write changes nothing: the day is unchanged, byte for byte', async () => {
    const s = await setup();
    await s.write(NIGHT1);
    s.nextSession();
    await s.write(NIGHT2);
    const second = structuredClone(s.tape());
    expect((await s.write(NIGHT3)).status).toBe('unchanged');
    expect(s.tape()).toEqual(second);
  });

  it('an unattributed seq no stored row claims stays unattributed, with its caveat, through every re-write', async () => {
    const s = await setup({ firstAfterNext: true });
    await s.write(NIGHT2);
    const first = s.tape();
    expect(first.passes.close.unattributedGaps).toEqual([40]);
    expect(first.passes.close.gaps).toEqual([]);
    expect(first.coverage.checks.caveats).toContain(ADJ_40);
    await s.write(NIGHT3);
    const again = s.tape();
    expect(again.passes.close.unattributedGaps).toEqual([40]);
    expect(again.coverage.checks.caveats).toContain(ADJ_40);
    expect(noteParts(again.coverage.checks)).toContain(ADJ_40);
  });

  it('a caveat about anything else survives every merge: another seq\'s unattributed caveat, and an unrelated one, both stored, both kept (the mutant: the merge dropping a caveat no stored row disproves)', async () => {
    const s = await setup();
    await s.write(NIGHT1);
    const other = NOTES.gapsUnattributed(1, '77');
    const unrelated = 'a run record\'s deferred list was truncated — deferrals past its first 200 ids are not listed (deferralsTruncated)';
    const stored = s.tape();
    const cov = stored.coverage.checks;
    s.t.store.set(s.key, { ...stored, coverage: { ...stored.coverage, checks: { ...cov, caveats: [...cov.caveats, other, unrelated], note: [cov.note, other, unrelated].filter(Boolean).join('; ') } } });
    s.nextSession();
    await s.write(NIGHT2);
    const after = s.tape().coverage.checks;
    for (const c of [other, unrelated, OWN_40]) {
      expect(after.caveats).toContain(c);
      expect(noteParts(after)).toContain(c);
    }
    expect(after.caveats).not.toContain(ADJ_40);
  });

  it('a caveat naming a stored gap among others is rewritten to name only the rest', async () => {
    const s = await setup();
    await s.write(NIGHT1);
    const both = NOTES.gapsUnattributed(2, '40, 77');
    const stored = s.tape();
    const cov = stored.coverage.checks;
    s.t.store.set(s.key, { ...stored, coverage: { ...stored.coverage, checks: { ...cov, caveats: [...cov.caveats, both], note: [cov.note, both].filter(Boolean).join('; ') } } });
    s.nextSession();
    await s.write(NIGHT2);
    const after = s.tape().coverage.checks;
    const rest = NOTES.gapsUnattributed(1, '77');
    expect(after.caveats).toContain(rest);
    expect(after.caveats).not.toContain(both);
    expect(after.caveats).not.toContain(ADJ_40);
    expect(noteParts(after)).toContain(rest);
    expect(after.note).not.toContain('40, 77');
  });

  it('a tape stored with the double listing (written before this fix) is cleaned by the next re-merge — what refresh=1 runs (runBackfill → writeTapeDay): written once, unchanged after', async () => {
    const s = await setup();
    await s.write(NIGHT1);
    s.nextSession();
    await s.write(NIGHT2);
    const clean = structuredClone(s.tape());
    // the shape the pre-fix merge stored: 40 in both lists and both caveats
    const cov = clean.coverage.checks;
    s.t.store.set(s.key, { ...clean, passes: { ...clean.passes, close: { ...clean.passes.close, unattributedGaps: [40] } }, coverage: { ...clean.coverage, checks: { ...cov, caveats: [...cov.caveats, ADJ_40], note: [cov.note, ADJ_40].filter(Boolean).join('; ') } } });
    expect((await s.write(NIGHT3)).status).toBe('written');
    const cleaned = s.tape();
    expect(cleaned.passes.close.unattributedGaps).toEqual([]);
    expect(cleaned.coverage.checks.caveats).not.toContain(ADJ_40);
    expect(cleaned.coverage.checks.note).not.toMatch(/adjacent to this day/);
    expect(cleaned.coverage.checks.caveats).toEqual(clean.coverage.checks.caveats);
    expect((await s.write(NIGHT3 + 86_400_000)).status).toBe('unchanged');
  });
});

/** Plant `extra` caveats into the stored checks section (its caveats and its note), as an earlier merge would have left them. */
function plant(s, extra) {
  const stored = s.tape();
  const cov = stored.coverage.checks;
  s.t.store.set(s.key, { ...stored, coverage: { ...stored.coverage, checks: { ...cov, caveats: [...cov.caveats, ...extra], note: [cov.note, ...extra].filter(Boolean).join('; ') } } });
}
const occurrences = (text, part) => text.split(part).length - 1;

describe('RK-9 — the §2 review\'s rows (KR3-1 … KR3-3): only the rewritten caveat moves; every other part of the note stays whole', () => {
  it('review KR3-1 — two entry-only caveats whose text holds "; " (different counts, the same tail) both stay whole in the note through the rewrite (the mutant: every note part deduplicated)', async () => {
    const s = await setup();
    await s.write(NIGHT1);
    const four = NOTES.entryOnly(4);
    const two = NOTES.entryOnly(2);
    expect(four).toContain('; ');
    plant(s, [four, two]);
    s.nextSession();
    await s.write(NIGHT2);
    const after = s.tape().coverage.checks;
    expect(after.caveats).not.toContain(ADJ_40);   // the rewrite ran
    for (const c of after.caveats) expect(after.note, c).toContain(c);
    expect(after.note).toContain(four);
    expect(after.note).toContain(two);
    expect((await s.write(NIGHT3)).status).toBe('unchanged');
  });

  it('review KR3-2 — a rewrite that equals a caveat already kept is kept once, in the caveats and in the note (the mutant: the rewrites not deduplicated)', async () => {
    const s = await setup();
    await s.write(NIGHT1);
    const rest = NOTES.gapsUnattributed(1, '77');
    plant(s, [rest, NOTES.gapsUnattributed(2, '40, 77')]);
    s.nextSession();
    await s.write(NIGHT2);
    const after = s.tape().coverage.checks;
    expect(after.caveats.filter((c) => c === rest)).toHaveLength(1);
    expect(occurrences(after.note, rest)).toBe(1);
    expect(after.note).not.toContain('40, 77');
  });

  /** The refuter's natural shapes (review KRV3-1): a multi-day world whose `lost` ticks never arrive, unless read `late`. */
  async function world(lost, battleId) {
    const fx = await multiDay({ battleId, full: true });
    const seeded = {};
    seedDay(seeded, { ...fx, ticks: [] });
    const t = makeTapeDb(seeded);
    const upto = (n, { late = [] } = {}) => {
      for (const tk of fx.ticks) if ((tk.tickSeq <= n && !lost.includes(tk.tickSeq)) || late.includes(tk.tickSeq)) t.store.set(`agentBattles/${battleId}/ticks/${tk.tickId}`, tk);
      t.store.set(`agentBattles/${battleId}`, { ...fx.battle, cronState: { tickSeq: n }, evaluations: fx.all.filter((e) => seqOf(e.evalId) <= n) });
    };
    const write = async (D, now) => (await writeTapeDay(battleId, D, { db: t.db, now })).status;
    const cov = (D) => t.store.get(`agentBattles/${battleId}/tape/${D}`).coverage.checks;
    return { upto, write, cov };
  }

  it('review KR3-1, the natural shape — day 1 loses 5, 6, 39 and 40; tick 6 is read late with day 2: two plural entry-only counts meet in the union while RK-9 rewrites, and the note still carries every caveat whole; the next write is unchanged', async () => {
    const w = await world([5, 6, 39, 40], 'b-kr31');
    w.upto(40);
    await w.write(D1, NIGHT1);
    w.upto(80, { late: [6] });
    await w.write(D1, NIGHT2);
    const c = w.cov(D1);
    expect(c.caveats.filter((x) => !c.note.includes(x))).toEqual([]);
    expect(await w.write(D1, NIGHT2 + 3_600_000)).toBe('unchanged');
  });

  it('review KR3-2, the natural shape — day 2 loses 41 (leading) and 80 (trailing): the read\'s caveat rewritten into one the tape already holds is kept once, in the caveats and the note, and the next write is unchanged', async () => {
    const D2 = '2026-09-22';
    const w = await world([41, 80], 'b-kr32');
    w.upto(40);
    await w.write(D1, NIGHT1);
    w.upto(80);
    await w.write(D2, NIGHT2);
    w.upto(120);
    await w.write(D2, NIGHT3);
    const c = w.cov(D2);
    expect(c.caveats.length).toBe(new Set(c.caveats).size);
    const parts = c.note.split('; ');
    expect(parts.length).toBe(new Set(parts).size);
    expect(await w.write(D2, NIGHT3 + 3_600_000)).toBe('unchanged');
  });

  it('review KR3-3 — a stored unattributed caveat naming a seq the day RECORDS (its tick row) is rewritten too: the caveat and passes.close.unattributedGaps judge by one set (the mutant: the caveat judged by the gaps alone)', async () => {
    const s = await setup();
    await s.write(NIGHT1);
    expect(s.tape().checks.some((r) => r.tickSeq === 39 && r.state !== 'no_record')).toBe(true);
    plant(s, [NOTES.gapsUnattributed(2, '39, 77')]);
    s.nextSession();
    await s.write(NIGHT2);
    const after = s.tape();
    expect(after.coverage.checks.caveats).toContain(NOTES.gapsUnattributed(1, '77'));
    expect(after.coverage.checks.note).not.toContain('39, 77');
    expect(after.passes.close.unattributedGaps).toEqual([]);
  });
});
