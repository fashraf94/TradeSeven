// src/utils/filmRoomSubject.test.js
//
// Film Room C2 — the shared subject module (Build C spec §5, §6; Amendment C CC-2, CC-7): the sector is the symbol
// directory's own one word, never guessed; a quoted text is carried whole within its bound or not at all.

import { describe, it, expect } from 'vitest';
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): filmRoomSubject.js imports api/_utils/rankingConfig.js; the excerpt
// (api/) imports this module — this import is the runtime guard that it stays Node-clean, never mocked.
import {
  sectorOf, boundedText, codePointsOf, IDEA_STATEMENT_MAX, carriedIdeaRefOf, ideaFrom, ideaVersionPathOf, subjectLineOf, subjectOfExcerpt, subjectOfDay, subjectOfDayRead,
  firstCodePoints, SUBJECT_STATEMENT_CODE_POINTS, SUBJECT_WORDS, instantMs, instantText,
} from './filmRoomSubject.js';
import { TICKER_TO_SECTOR, STOCK_UNIVERSE } from '../../api/_utils/rankingConfig.js';
import { TAPE_NUMBER_CLASSES } from '../constants/filmTape.js';

describe('sectorOf — the directory\'s one word for a symbol, or none', () => {
  it('a mapped symbol: the directory\'s own value, its sector id (one word)', () => {
    expect(sectorOf('ETN')).toBe(TICKER_TO_SECTOR.ETN);
    expect(sectorOf('ETN')).toBe('XLI');
    expect(sectorOf('NVDA')).toBe('XLK');
    for (const [sym, id] of Object.entries(TICKER_TO_SECTOR)) expect(sectorOf(sym), sym).toBe(id);
  });
  it('every sector id is one word, where some sector NAMES are two (why the word is the id)', () => {
    for (const id of new Set(Object.values(TICKER_TO_SECTOR))) expect(/^\S+$/.test(id), id).toBe(true);
    expect(Object.values(STOCK_UNIVERSE).some((s) => /\s/.test(s.name))).toBe(true);
  });
  it('a symbol the directory lacks, or no symbol: none — never guessed (the mutant: a sector for an unmapped symbol)', () => {
    for (const sym of ['ZZQX', 'BTC', '', null, undefined, 7, 'toString', 'constructor', '__proto__']) expect(sectorOf(sym), String(sym)).toBeNull();
  });
});

describe('boundedText — whole within its bound, or not carried; code points, astral counted once', () => {
  const ASTRAL = '\u{1F600}';
  it('at the bound: the text exactly; one over: null (never cut)', () => {
    const at = `${'a'.repeat(IDEA_STATEMENT_MAX - 1)}${ASTRAL}`;
    expect(codePointsOf(at)).toBe(IDEA_STATEMENT_MAX);
    expect(at.length).toBe(IDEA_STATEMENT_MAX + 1);
    expect(boundedText(at, IDEA_STATEMENT_MAX)).toBe(at);
    expect(boundedText(`${at}b`, IDEA_STATEMENT_MAX)).toBeNull();
    expect(IDEA_STATEMENT_MAX).toBe(280);
  });
  it('no text: null', () => {
    for (const v of ['', null, undefined, 3, {}, ['a']]) expect(boundedText(v, 10), JSON.stringify(v)).toBeNull();
  });
});

// ── C2 item 5 — the idea's one reading, and the subject line (CC-7) ─────────

const OWNER = 'owner-s';
const REF = { watchlistId: 'wl-s', hypothesisVersion: 4, equippedConfigHash: 'h' };
const tapeWith = (calls, numberClasses = TAPE_NUMBER_CLASSES) => ({ ownerId: OWNER, numberClasses, calls });
const call = (ref = REF) => ({ callId: `c-${Math.random()}`, hypothesisRef: ref });
const version = (over = {}) => ({ version: 4, watchlistId: 'wl-s', userId: OWNER, createdAt: '2026-09-20T15:00:00.000Z', statement: 'Chips lead while the market drifts.', ...over });

describe('the idea — one reading of the carried ref and its version (ideaFrom)', () => {
  it('the day\'s one distinct ref, the index of its first call; none, or two distinct, is null (never a guess)', () => {
    expect(carriedIdeaRefOf(tapeWith([{ callId: 'x', hypothesisRef: null }, call(), call()]))).toEqual({ watchlistId: 'wl-s', hypothesisVersion: 4, i: 1 });
    expect(carriedIdeaRefOf(tapeWith([]))).toBeNull();
    expect(carriedIdeaRefOf(tapeWith([call(), call({ watchlistId: 'wl-s', hypothesisVersion: 5 })]))).toBeNull();
    expect(carriedIdeaRefOf(tapeWith([call({ watchlistId: 'wl-s', hypothesisVersion: 0 })]))).toBeNull();
    expect(carriedIdeaRefOf(null)).toBeNull();
    expect(ideaVersionPathOf({ i: 2 })).toEqual(['calls', 2, 'hypothesisRef', 'hypothesisVersion']);
  });
  it('the owner\'s version: the version with the tape\'s own class, the statement and its time', () => {
    expect(ideaFrom(tapeWith([call()]), version(), OWNER)).toEqual({ ref: { watchlistId: 'wl-s', hypothesisVersion: 4, i: 0 }, version: { value: 4, class: 'recorded' }, statement: 'Chips lead while the market drifts.', statementAt: '2026-09-20T15:00:00.000Z' });
  });
  it('unread or missing: the idea without its statement; over its bound: the same', () => {
    expect(ideaFrom(tapeWith([call()]), null, OWNER)).toMatchObject({ version: { value: 4, class: 'recorded' }, statement: null, statementAt: null });
    expect(ideaFrom(tapeWith([call()]), version({ statement: 'x'.repeat(IDEA_STATEMENT_MAX + 1) }), OWNER).statement).toBeNull();
  });
  it('another owner\'s, or another list\'s or version\'s document: no idea at all', () => {
    for (const doc of [version({ userId: 'someone-else' }), version({ watchlistId: 'wl-other' }), version({ version: 3 })]) expect(ideaFrom(tapeWith([call()]), doc, OWNER), JSON.stringify(doc)).toBeNull();
  });
  it('a tape that declares no class for the version\'s number: the idea without its version', () => {
    expect(ideaFrom(tapeWith([call()], {}), version(), OWNER).version).toBeNull();
  });
});

describe('THE SUBJECT LINE — one projection (CC-7), each part only where held', () => {
  const STATEMENT = 'Industrials and chips lead while the wider market drifts; rotate out of names that stop moving.';
  it('every part: "{SYM} · {sector} · under your idea \'{first 60 code points}\' v{n}"', () => {
    const line = subjectLineOf({ symbol: 'ETN', sector: 'XLI', idea: { statement: STATEMENT, version: 3 } });
    expect(line.text).toBe(`ETN · XLI · under your idea '${[...STATEMENT].slice(0, 60).join('')}' v3`);
    expect(line).toMatchObject({ symbol: 'ETN', sector: 'XLI', idea: { statement: [...STATEMENT].slice(0, 60).join(''), version: 3 } });
    expect(SUBJECT_WORDS).toEqual({ separator: ' · ', underIdea: 'under your idea' });
  });
  it('each part absent in turn: no sector; no carried idea (the line ends after the sector); the idea without its statement; without its version; no symbol, no line', () => {
    expect(subjectLineOf({ symbol: 'ZZQX', sector: null, idea: { statement: 'Hold.', version: 2 } }).text).toBe("ZZQX · under your idea 'Hold.' v2");
    expect(subjectLineOf({ symbol: 'ETN', sector: 'XLI', idea: null }).text).toBe('ETN · XLI');
    expect(subjectLineOf({ symbol: 'ETN', sector: 'XLI' }).text).toBe('ETN · XLI');
    expect(subjectLineOf({ symbol: 'ETN', sector: 'XLI', idea: { statement: null, version: 2 } }).text).toBe('ETN · XLI · under your idea v2');
    expect(subjectLineOf({ symbol: 'ETN', sector: 'XLI', idea: { statement: 'Hold.', version: null } }).text).toBe("ETN · XLI · under your idea 'Hold.'");
    expect(subjectLineOf({ symbol: 'ETN', sector: null, idea: null }).text).toBe('ETN');
    for (const symbol of [null, undefined, '', 7]) expect(subjectLineOf({ symbol, sector: 'XLI' }), String(symbol)).toBeNull();
  });
  it('THE 60-CODE-POINT CUT: 60 kept whole, the 61st gone; an astral character counts once and is never split', () => {
    expect(SUBJECT_STATEMENT_CODE_POINTS).toBe(60);
    const ASTRAL = '\u{1F600}';
    const sixty = `${'a'.repeat(59)}${ASTRAL}`;
    expect(subjectLineOf({ symbol: 'A', idea: { statement: sixty, version: 1 } }).idea.statement).toBe(sixty);
    expect(subjectLineOf({ symbol: 'A', idea: { statement: `${sixty}b`, version: 1 } }).idea.statement).toBe(sixty);
    expect(subjectLineOf({ symbol: 'A', idea: { statement: `${'a'.repeat(60)}${ASTRAL}`, version: 1 } }).idea.statement).toBe('a'.repeat(60));
    expect(firstCodePoints(`${ASTRAL}${ASTRAL}`, 1)).toBe(ASTRAL);
    expect(codePointsOf(subjectLineOf({ symbol: 'A', idea: { statement: 'x'.repeat(200), version: 1 } }).idea.statement)).toBe(60);
  });
  it('the screen\'s side (subjectOfDay) and the excerpt\'s side (subjectOfExcerpt) say the same line from the same facts; the sector from the directory alone (the mutant: a sector guessed)', () => {
    const tape = tapeWith([call()]);
    const day = subjectOfDay(tape, 'ETN', version(), OWNER);
    const excerpt = { symbol: { value: 'ETN', class: 'recorded' }, sector: { value: 'XLI', class: 'recorded' }, idea: { label: 'i1', version: { value: 4, class: 'recorded' }, statement: { text: 'Chips lead while the market drifts.', by: 'player', at: null, class: 'quoted' } } };
    expect(day.line).toEqual(subjectOfExcerpt(excerpt));
    expect(subjectOfDay(tape, 'ZZQX', version(), OWNER).line.sector).toBeNull();
    expect(subjectOfDay(tapeWith([]), 'ETN', null, OWNER).line.text).toBe('ETN · XLI');
    expect(subjectOfDay(tape, 'ETN', version({ userId: 'someone-else' }), OWNER).line.text).toBe('ETN · XLI');
    expect(subjectOfExcerpt({ symbol: { value: 'ETN' } }).text).toBe('ETN');
    expect(subjectOfExcerpt(null)).toBeNull();
  });
});

describe('the §2 review\'s lens 3 — the read\'s states, the ref\'s id class, no dangling fragment', () => {
  it('a ref naming a list id outside the forge-id class, or a reserved `__id__`, carries no idea on either side (L3-8)', () => {
    for (const watchlistId of ['a/b', '__x__', '', 'x'.repeat(201)]) expect(carriedIdeaRefOf(tapeWith([call({ watchlistId, hypothesisVersion: 4 })])), watchlistId).toBeNull();
  });
  it('an idea holding neither its statement nor its version says nothing — no dangling "under your idea" (L3-10)', () => {
    expect(subjectLineOf({ symbol: 'ETN', sector: 'XLI', idea: { statement: null, version: null } })).toEqual({ symbol: 'ETN', sector: 'XLI', idea: null, text: 'ETN · XLI' });
    expect(subjectOfExcerpt({ symbol: { value: 'ETN' }, sector: { value: 'XLI' }, idea: { label: 'i1' } }).text).toBe('ETN · XLI');
  });
  it('the screen\'s read states (L3-2, L3-8): loading and error say no line while the day carries an idea; denied says no idea; missing and idle the idea without its statement; ready the document', () => {
    const tape = tapeWith([call()]);
    expect(subjectOfDayRead(tape, 'ETN', { status: 'loading', doc: null }, OWNER)).toBeNull();
    expect(subjectOfDayRead(tape, 'ETN', { status: 'error', doc: null }, OWNER)).toBeNull();
    expect(subjectOfDayRead(tape, 'ETN', { status: 'denied', doc: null }, OWNER).line.text).toBe('ETN · XLI');
    expect(subjectOfDayRead(tape, 'ETN', { status: 'missing', doc: null }, OWNER).line.text).toBe('ETN · XLI · under your idea v4');
    expect(subjectOfDayRead(tape, 'ETN', { status: 'idle', doc: null }, OWNER).line.text).toBe('ETN · XLI · under your idea v4');
    expect(subjectOfDayRead(tape, 'ETN', { status: 'ready', doc: version() }, OWNER).line.text).toBe("ETN · XLI · under your idea 'Chips lead while the market drifts.' v4");
    // a day that carries no idea has a line whatever the read's state
    expect(subjectOfDayRead(tapeWith([]), 'ETN', { status: 'loading', doc: null }, OWNER).line.text).toBe('ETN · XLI');
  });
});

describe('CE-3 — the one strict instant parser: a full ISO 8601 date-time with its zone, on a real calendar and a real clock', () => {
  it('refuses a date alone, a time with no zone, a loose string, and every impossible value Date.parse would normalise (C2-F3)', () => {
    const refused = [
      '2026-09-23',                          // a date only
      '2026-09-23T19:00:00',                 // a time with no zone
      '2026-02-30T15:00:00Z',                // 30 February
      '2026-04-31T15:00:00Z',                // 31 April
      '2026-02-29T15:00:00Z',                // 29 February, not a leap year
      '1900-02-29T15:00:00Z',                // a century that is not a leap year
      '2026-13-01T15:00:00Z', '2026-00-10T15:00:00Z', '2026-09-00T15:00:00Z',
      '2026-09-23T24:00:00Z',                // 24:00
      '2026-09-23T19:60:00Z', '2026-09-23T19:00:60Z',
      '2026-09-23T19:00:00+24:00', '2026-09-23T19:00:00+05:60',
      '9/23/2026 19:00 (Ab3dEf7hIj9kLm1nOp5q)',
      '2026-09-23T19:00:00.000Z (id)', ' 2026-09-23T19:00:00Z', 1758654000000, null, undefined, {},
    ];
    for (const v of refused) {
      expect(instantMs(v), String(v)).toBeNull();
      expect(instantText(v), String(v)).toBeNull();
    }
    // what Date.parse alone would have read — the inference CE-3 refuses
    expect(Number.isFinite(Date.parse('2026-02-30T15:00:00Z'))).toBe(true);
    expect(Number.isFinite(Date.parse('2026-09-23'))).toBe(true);
  });
  it('accepts a valid `Z`, a valid offset (the same instant), fractional seconds, minutes only, and a real leap day', () => {
    expect(instantMs('2026-09-23T19:00:00Z')).toBe(Date.UTC(2026, 8, 23, 19, 0, 0));
    expect(instantMs('2026-09-23T19:00:00.000Z')).toBe(Date.UTC(2026, 8, 23, 19, 0, 0));
    expect(instantMs('2026-09-23T15:00:00-04:00')).toBe(Date.UTC(2026, 8, 23, 19, 0, 0));
    expect(instantMs('2026-09-24T00:30:00+05:30')).toBe(Date.UTC(2026, 8, 23, 19, 0, 0));
    expect(instantMs('2026-09-23T19:00Z')).toBe(Date.UTC(2026, 8, 23, 19, 0, 0));
    expect(instantMs('2028-02-29T12:00:00Z')).toBe(Date.UTC(2028, 1, 29, 12));
    expect(instantMs('2000-02-29T12:00:00Z')).toBe(Date.UTC(2000, 1, 29, 12));
    expect(instantMs('2026-09-23T23:59:59.999Z')).toBe(Date.UTC(2026, 8, 23, 23, 59, 59, 999));
    expect(instantText('2026-09-23T15:00:00-04:00')).toBe('2026-09-23T15:00:00-04:00');
  });
});
