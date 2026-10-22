// src/utils/filmRoomMoments.test.js
//
// Film Room B2 item 3 — the moments helper (spec §2 "the list"; contract §4;
// Amendment G RG-6): pure, zero-import, shared by the server and the screen.
// Consecutive tagged checks of one symbol form one moment; longest first, ties
// earliest first; nothing but the stored items is read, and no price, score or
// result ever comes out.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { momentsOf, sameMoment, momentAnchor, MOMENT_KEYS } from './filmRoomMoments.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SOURCE = readFileSync(path.join(HERE, 'filmRoomMoments.js'), 'utf8');

function plainNodeLoad(rel) {
  const url = new URL(`file:///${path.join(REPO, rel).replace(/\\/g, '/')}`).href;
  const script = `import(${JSON.stringify(url)}).then(() => console.log('LOADED')).catch((e) => console.log(e.code || 'FAILED'))`;
  return execFileSync(globalThis.process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', cwd: REPO }).trim();
}

const T0 = Date.parse('2026-09-24T13:30:20.000Z');
const atOf = (seq) => new Date(T0 + (seq - 1) * 15 * 60_000).toISOString();
/** A stored tag item, as tapeTags.js writes it (plus whatever extra keys a row plants). */
const item = (symbol, seq, extra = {}) => ({ situationId: 'stalled', version: 2, symbol, tickSeq: seq, at: atOf(seq), count: 3, effectiveTicksThreshold: 5, ...extra });
const brief = (m) => [m.symbol, m.fromTickSeq, m.toTickSeq, m.checks];

describe('the module — zero-import, Node-clean', () => {
  it('declares no imports and loads under plain Node', () => {
    expect(SOURCE).not.toMatch(/^\s*import\s/m);
    expect(SOURCE).not.toMatch(/\brequire\s*\(/);
    expect(plainNodeLoad('src/utils/filmRoomMoments.js')).toBe('LOADED');
  });
});

describe('momentsOf — consecutive tagged checks of one symbol form one moment', () => {
  it('a run of tickSeqs 3, 4, 5 is one moment: from the first check to the last, three checks', () => {
    expect(momentsOf([item('ACN', 3), item('ACN', 4), item('ACN', 5)])).toEqual([
      { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 3, toTickSeq: 5, from: atOf(3), to: atOf(5), checks: 3 },
    ]);
  });
  it('a break in the tickSeqs (a check between them that is not tagged) ends the moment: 3, 4 | 6', () => {
    expect(momentsOf([item('ACN', 3), item('ACN', 4), item('ACN', 6)]).map(brief)).toEqual([['ACN', 3, 4, 2], ['ACN', 6, 6, 1]]);
  });
  it('symbols never share a moment, however the items interleave; the stored order does not matter', () => {
    const items = [item('MSFT', 4), item('ACN', 5), item('ACN', 3), item('MSFT', 3), item('ACN', 4)];
    expect(momentsOf(items).map(brief)).toEqual([['ACN', 3, 5, 3], ['MSFT', 3, 4, 2]]);
  });
  it('an item with no tickSeq is a moment of its own (it can be next to nothing), ordered by its instant', () => {
    const noSeq = { ...item('ACN', 7), tickSeq: null };
    expect(momentsOf([item('ACN', 6), noSeq, item('ACN', 8)]).map(brief)).toEqual([['ACN', 6, 6, 1], ['ACN', null, null, 1], ['ACN', 8, 8, 1]]);
  });
  it('ORDER — longest first; ties go to the earlier moment (RG-6, ruling 15); a two-way tie at the same instant by symbol', () => {
    const items = [item('NVDA', 10), item('NVDA', 11), item('ACN', 2), item('ACN', 3), item('ACN', 4), item('MSFT', 10), item('MSFT', 11), item('ACN', 9)];
    expect(momentsOf(items).map(brief)).toEqual([['ACN', 2, 4, 3], ['MSFT', 10, 11, 2], ['NVDA', 10, 11, 2], ['ACN', 9, 9, 1]]);
  });
  it('the stored tag is a fact, never a verdict: situations are kept apart, and a row from another situation never joins stalled', () => {
    const other = { ...item('ACN', 4), situationId: 'down' };
    expect(momentsOf([item('ACN', 3), other, item('ACN', 5)]).map((m) => [m.situationId, ...brief(m)])).toEqual([['stalled', 'ACN', 3, 3, 1], ['down', 'ACN', 4, 4, 1], ['stalled', 'ACN', 5, 5, 1]]);   // a three-way tie: earliest first
  });
  it('nothing, malformed rows and non-arrays give an empty list — never a throw', () => {
    expect(momentsOf([])).toEqual([]);
    expect(momentsOf(null)).toEqual([]);
    expect(momentsOf([null, 7, { symbol: 'ACN' }, { situationId: 'stalled' }, 'x'])).toEqual([]);
  });
});

describe('RG-6 — a moment shows no price, score, result or later fact', () => {
  it('returns exactly MOMENT_KEYS, even when the stored items carry a count, a threshold, or planted price / score / result fields', () => {
    const planted = [item('ACN', 3, { px: 300, price: 300, score: 12, result: 'loss', outcome: 'bad', later: true }), item('ACN', 4, { px: 300.1 })];
    const [m] = momentsOf(planted);
    expect(Object.keys(m)).toEqual([...MOMENT_KEYS]);
    expect(MOMENT_KEYS).toEqual(['situationId', 'symbol', 'fromTickSeq', 'toTickSeq', 'from', 'to', 'checks']);
    for (const k of ['px', 'price', 'score', 'result', 'outcome', 'later', 'count', 'effectiveTicksThreshold', 'version']) expect(k in m, k).toBe(false);
  });
  it('the module source names no price, score or result field of the items, and reads no other input', () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');   // the code, its comments stripped
    expect(code).not.toMatch(/\b(px|price|score|scores|result|outcome|lockedPoints|replay)\b/);
    // the one parameter is the items; nothing else is read (no checks, no actions, no series)
    expect(SOURCE).toMatch(/export function momentsOf\(items\)/);
  });
  it('reads nothing but the items: a frozen input is never written to, and the same items give the same moments every time', () => {
    const items = Object.freeze([Object.freeze(item('ACN', 3)), Object.freeze(item('ACN', 4))]);
    const a = momentsOf(items);
    const b = momentsOf(items);
    expect(a).toEqual(b);
    expect(a[0]).not.toBe(b[0]);
  });
});

describe('sameMoment and momentAnchor', () => {
  it('sameMoment: the same situation, symbol and from–to exactly; a sub-range, a superset or another symbol is not the same moment', () => {
    const m = momentsOf([item('ACN', 3), item('ACN', 4), item('ACN', 5)])[0];
    expect(sameMoment(m, { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 3, toTickSeq: 5 })).toBe(true);
    expect(sameMoment(m, { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 3, toTickSeq: 4 })).toBe(false);
    expect(sameMoment(m, { situationId: 'stalled', symbol: 'ACN', fromTickSeq: 2, toTickSeq: 5 })).toBe(false);
    expect(sameMoment(m, { situationId: 'stalled', symbol: 'MSFT', fromTickSeq: 3, toTickSeq: 5 })).toBe(false);
    expect(sameMoment(m, { situationId: 'down', symbol: 'ACN', fromTickSeq: 3, toTickSeq: 5 })).toBe(false);
    expect(sameMoment(m, null)).toBe(false);
    expect(sameMoment(m, { situationId: 'stalled', symbol: 'ACN', fromTickSeq: '3', toTickSeq: 5 })).toBe(false);
  });
  it('momentAnchor names the symbol and the from–to', () => {
    expect(momentAnchor({ symbol: 'ACN', fromTickSeq: 3, toTickSeq: 5 })).toBe('moment-ACN-3-5');
    expect(momentAnchor({ symbol: 'ACN', fromTickSeq: null, toTickSeq: null })).toBe('moment-ACN-x-x');
  });
});

describe('over a day the real tagger wrote (the items as stored)', () => {
  // The REAL writer over the B1 acceptance day (tagFixtures.js): ACN stalled at checks 4 and 5 on the recorded basis.
  vi.setConfig({ testTimeout: 30_000 });
  it('the acceptance day: ACN at checks 4 and 5 is one moment of two checks', async () => {
    vi.doMock('../config/featureFlags.js', async (importOriginal) => ({ ...(await importOriginal()), get FILM_TAPE_WRITE_ENABLED() { return true; } }));
    const { writeTapeDay } = await import('../../api/_utils/filmTape/writeTapeDay.js');
    const { makeTapeDb } = await import('../../api/_utils/filmTape/__fixtures__/tapeFirestore.js');
    const { seedDay } = await import('../../api/_utils/filmTape/__fixtures__/tapeFixtures.js');
    const { stalledDay } = await import('../../api/_utils/filmTape/__fixtures__/tagFixtures.js');
    const fx = await stalledDay({ battleId: 'b-moments', noTriggerSeqs: [3, 4], meetingSeqs: [5], exitSeq: 6, recordStagnation: true });
    const t = makeTapeDb(seedDay({}, fx));
    await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: Date.parse('2026-09-25T02:15:30.000Z') });
    const tape = t.store.get(`agentBattles/${fx.battleId}/tape/${fx.etDate}`);
    expect(tape.tags.items.map((i) => [i.symbol, i.tickSeq])).toEqual([['ACN', 4], ['ACN', 5]]);
    const moments = momentsOf(tape.tags.items);
    expect(moments).toEqual([{ situationId: 'stalled', symbol: 'ACN', fromTickSeq: 4, toTickSeq: 5, from: tape.tags.items[0].at, to: tape.tags.items[1].at, checks: 2 }]);
    vi.doUnmock('../config/featureFlags.js');
  });
});
