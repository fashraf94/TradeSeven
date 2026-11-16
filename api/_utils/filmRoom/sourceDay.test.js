// api/_utils/filmRoom/sourceDay.test.js
//
// Film Room C2 item 1 — THE DAY CHECK, one implementation (Build C Amendment C CC-4; C1 fix round F1): the judgments a
// card's source day must pass — the owner, the coverage, the EXACT moment, the archetype, and against what was filed
// the archetype and the situation version — each with its verdict; the one read through a reader; and the static rows
// that the card route keeps no copy of any judgment (it maps the shared verdicts to its own refusals). The moment
// excerpt's half of "one implementation" is pinned in momentExcerpt.test.js.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): sourceDay.js imports src/utils/filmRoomMoments.js; this import is the runtime
// guard that it stays Node-clean — never mocked.
import { judgeDay, judgeFiledDay, readDayWith, momentOfDay, DAY_REFUSAL_STATUS } from './sourceDay.js';
import { momentOfDay as momentOfDayFromRequest } from './cardRequest.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const UID = 'owner-sd';
const T0 = Date.parse('2026-09-24T13:30:20.000Z');
const atOf = (seq) => new Date(T0 + (seq - 1) * 15 * 60_000).toISOString();
const item = (symbol, seq, extra = {}) => ({ situationId: 'stalled', version: 2, symbol, tickSeq: seq, at: atOf(seq), count: 3, effectiveTicksThreshold: 5, ...extra });
const tapeOf = (over = {}) => ({
  ownerId: UID,
  coverage: { tags: { status: 'complete' } },
  tags: { inputs: { archetypeCodeId: 'momentum_chaser' }, items: [item('ACN', 4), item('ACN', 5), item('MSFT', 8)] },
  ...over,
});
const ACN = { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5 };
const FILED = { moment: ACN, archetypeCodeId: 'momentum_chaser', situationVersion: 2 };

describe('judgeDay — the day\'s own judgment, in order', () => {
  it('a day that holds the moment passes, with the moment, its situation version and the archetype', () => {
    expect(judgeDay(tapeOf(), UID, ACN)).toEqual({
      ok: true,
      moment: { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5, from: atOf(4), to: atOf(5), checks: 2 },
      situationVersion: 2,
      archetypeCodeId: 'momentum_chaser',
    });
  });
  it('no tape, or another owner\'s: tape_not_found — first, whatever else the day holds', () => {
    expect(judgeDay(null, UID, ACN)).toEqual({ ok: false, code: 'tape_not_found' });
    expect(judgeDay(tapeOf({ ownerId: 'someone-else' }), UID, ACN)).toEqual({ ok: false, code: 'tape_not_found' });
    expect(judgeDay(tapeOf({ ownerId: 'someone-else', tags: null }), UID, ACN)).toEqual({ ok: false, code: 'tape_not_found' });
  });
  it('situations unavailable, or no stored items: tags_unavailable (RH-6 — an unavailable day offers no moment, even with items)', () => {
    expect(judgeDay(tapeOf({ coverage: { tags: { status: 'unavailable' } } }), UID, ACN)).toEqual({ ok: false, code: 'tags_unavailable' });
    expect(judgeDay(tapeOf({ tags: { inputs: { archetypeCodeId: 'momentum_chaser' }, items: null } }), UID, ACN)).toEqual({ ok: false, code: 'tags_unavailable' });
    expect(judgeDay(tapeOf({ tags: undefined }), UID, ACN)).toEqual({ ok: false, code: 'tags_unavailable' });
  });
  it('THE EXACT MOMENT: a sub-range, a superset, the day, another symbol or situation, no tickSeqs → moment_not_found (the mutant: the exact-moment test skipped)', () => {
    for (const wanted of [
      { ...ACN, fromTickSeq: 4, toTickSeq: 4 },
      { ...ACN, fromTickSeq: 5, toTickSeq: 5 },
      { ...ACN, fromTickSeq: 3, toTickSeq: 5 },
      { ...ACN, fromTickSeq: 4, toTickSeq: 6 },
      { ...ACN, fromTickSeq: 1, toTickSeq: 26 },
      { ...ACN, symbol: 'NVDA' },
      { ...ACN, situationId: 'down' },
      { ...ACN, fromTickSeq: null, toTickSeq: null },
    ]) expect(judgeDay(tapeOf(), UID, wanted), JSON.stringify(wanted)).toEqual({ ok: false, code: 'moment_not_found' });
  });
  it('no archetype recorded: archetype_unknown — after the moment', () => {
    expect(judgeDay(tapeOf({ tags: { inputs: {}, items: [item('ACN', 4), item('ACN', 5)] } }), UID, ACN)).toEqual({ ok: false, code: 'archetype_unknown' });
    expect(judgeDay(tapeOf({ tags: { inputs: { archetypeCodeId: '' }, items: [item('ACN', 4), item('ACN', 5)] } }), UID, ACN)).toEqual({ ok: false, code: 'archetype_unknown' });
    expect(judgeDay(tapeOf({ tags: { inputs: {}, items: [item('ACN', 4)] } }), UID, ACN)).toEqual({ ok: false, code: 'moment_not_found' });
  });
});

describe('judgeFiledDay — THE DAY CHECK against what was filed (CC-4: coverage, the exact moment, the situation version, the archetype)', () => {
  it('the filed day unchanged passes', () => {
    expect(judgeFiledDay(tapeOf(), UID, FILED).ok).toBe(true);
  });
  it('the day re-taped under another archetype: archetype_changed, naming the day\'s', () => {
    expect(judgeFiledDay(tapeOf(), UID, { ...FILED, archetypeCodeId: 'trend_follower' })).toEqual({ ok: false, code: 'archetype_changed', extra: { archetypeCodeId: 'momentum_chaser' } });
  });
  it('the moment re-tagged under another situation version: source_changed', () => {
    expect(judgeFiledDay(tapeOf(), UID, { ...FILED, situationVersion: 1 })).toEqual({ ok: false, code: 'source_changed' });
    const v3 = tapeOf({ tags: { inputs: { archetypeCodeId: 'momentum_chaser' }, items: [item('ACN', 4, { version: 3 }), item('ACN', 5, { version: 3 })] } });
    expect(judgeFiledDay(v3, UID, FILED)).toEqual({ ok: false, code: 'source_changed' });
  });
  it('both changed — another archetype AND another situation version: archetype_changed, naming the day\'s, as the route ordered them (§2 review L2-6)', () => {
    const both = tapeOf({ tags: { inputs: { archetypeCodeId: 'trend_follower' }, items: [item('ACN', 4, { version: 3 }), item('ACN', 5, { version: 3 })] } });
    expect(judgeFiledDay(both, UID, FILED)).toEqual({ ok: false, code: 'archetype_changed', extra: { archetypeCodeId: 'trend_follower' } });
  });
  it('the day\'s own refusals come first, as the route ordered them', () => {
    expect(judgeFiledDay(tapeOf({ ownerId: 'x' }), UID, { ...FILED, archetypeCodeId: 'other' })).toEqual({ ok: false, code: 'tape_not_found' });
    expect(judgeFiledDay(tapeOf(), UID, { ...FILED, moment: { ...ACN, toTickSeq: 4 }, situationVersion: 1 })).toEqual({ ok: false, code: 'moment_not_found' });
  });
  it('every refusal has the status the route answers', () => {
    expect(DAY_REFUSAL_STATUS).toEqual({ tape_not_found: 404, tags_unavailable: 409, moment_not_found: 409, archetype_unknown: 409, archetype_changed: 409, source_changed: 409 });
  });
});

describe('readDayWith — the one tape read, through whatever reader it is handed', () => {
  const dbOf = (data) => {
    const asked = [];
    const db = { collection: (c) => ({ doc: (d) => ({ collection: (c2) => ({ doc: (d2) => ({ path: `${c}/${d}/${c2}/${d2}` }) }) }) }) };
    const reader = { get: async (ref) => { asked.push(ref.path); return data === undefined ? { exists: false } : { exists: true, data: () => data }; } };
    return { db, reader, asked };
  };
  it('reads agentBattles/{battleId}/tape/{etDate} once, and answers the document or null', async () => {
    const one = dbOf({ ownerId: UID });
    expect(await readDayWith(one.reader, one.db, 'b-1', '2026-09-24')).toEqual({ ownerId: UID });
    expect(one.asked).toEqual(['agentBattles/b-1/tape/2026-09-24']);
    const none = dbOf(undefined);
    expect(await readDayWith(none.reader, none.db, 'b-1', '2026-09-24')).toBeNull();
  });
  it('a failed read throws as it came, for the caller to answer', async () => {
    const err = Object.assign(new Error('boom'), { code: 10 });
    await expect(readDayWith({ get: async () => { throw err; } }, dbOf({}).db, 'b', 'd')).rejects.toBe(err);
  });
});

describe('ONE implementation — the card route keeps no copy of the judgments', () => {
  const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const route = strip(readFileSync(path.join(REPO, 'api/film-room/card.js'), 'utf8'));
  it('card.js imports the shared judgments and the shared read from sourceDay.js', () => {
    expect(route).toMatch(/import\s*\{[^}]*\bjudgeDay\b[^}]*\bjudgeFiledDay\b[^}]*\breadDayWith\b[^}]*\}\s*from\s*'\.\.\/_utils\/filmRoom\/sourceDay\.js'/);
  });
  it('card.js judges no coverage, moment, archetype or version itself (each judgment lives in sourceDay.js alone)', () => {
    for (const own of [/coverage\?\.tags\?\.status/, /momentOfDay\s*\(/, /momentsOf\s*\(/, /sameMoment\s*\(/, /tags\?\.inputs\?\.archetypeCodeId/, /\.archetypeCodeId\s*!==/, /\.situationVersion\s*!==/]) {
      expect(own.test(route), String(own)).toBe(false);
    }
  });
  it('cardRequest.js re-exports the moved momentOfDay — the same function, not a copy', () => {
    expect(momentOfDayFromRequest).toBe(momentOfDay);
  });
});
