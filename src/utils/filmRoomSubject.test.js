// src/utils/filmRoomSubject.test.js
//
// Film Room C2 — the shared subject module (Build C spec §5, §6; Amendment C CC-2, CC-7): the sector is the symbol
// directory's NAME for it (Amendment D CD-3), never guessed; a quoted text is carried whole within its bound or not at all.

import { describe, it, expect } from 'vitest';
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): filmRoomSubject.js imports api/_utils/rankingConfig.js; the excerpt
// (api/) imports this module — this import is the runtime guard that it stays Node-clean, never mocked.
import {
  sectorOf, boundedText, codePointsOf, IDEA_STATEMENT_MAX, carriedIdeaOf, ideaFrom, IDEA_VERSION_PATH, CARRIAGE_NUMBER_CLASSES, subjectLineOf, subjectOfExcerpt, subjectOfDay, subjectOfDayRead,
  firstCodePoints, SUBJECT_STATEMENT_CODE_POINTS, SUBJECT_WORDS, instantMs, instantText,
} from './filmRoomSubject.js';
import { TICKER_TO_SECTOR, STOCK_UNIVERSE } from '../../api/_utils/rankingConfig.js';

describe('sectorOf — CD-3: the directory\'s NAME for a symbol\'s sector, or none', () => {
  it('a mapped symbol: the directory\'s name for its sector — "Industrials", never the fund code XLI (the mutant: the fund code back)', () => {
    expect(TICKER_TO_SECTOR.ETN).toBe('XLI');
    expect(sectorOf('ETN')).toBe('Industrials');
    expect(sectorOf('NVDA')).toBe('Technology');
    for (const [sym, id] of Object.entries(TICKER_TO_SECTOR)) expect(sectorOf(sym), sym).toBe(STOCK_UNIVERSE[id].name);
  });
  it('a sector name of two words is carried whole — no one-word filter (AMZN: "Consumer Discretionary", META: "Communication Services")', () => {
    expect(sectorOf('AMZN')).toBe('Consumer Discretionary');
    expect(sectorOf('META')).toBe('Communication Services');
    expect(Object.values(STOCK_UNIVERSE).some((x) => /\s/.test(x.name))).toBe(true);
  });
  it('a symbol the directory lacks, or no symbol: none — never guessed (the mutant: a sector for an unmapped symbol)', () => {
    for (const sym of ['ZZQX', 'BTC', '', null, undefined, 7, 'toString', 'constructor', '__proto__']) expect(sectorOf(sym), String(sym)).toBeNull();
  });
  it('a code the universe has no name for, or a blank or non-string name: none — the code is never shown in its place', () => {
    const tickers = { AAA: 'XZZ', BBB: 'XLB', CCC: 'XLC', DDD: '__proto__' };
    const universe = { XLB: { name: '' }, XLC: { name: 7 } };
    for (const sym of ['AAA', 'BBB', 'CCC', 'DDD']) expect(sectorOf(sym, { tickers, universe }), sym).toBeNull();
    expect(sectorOf('AAA', { tickers, universe: { XZZ: { name: 'Widgets and Gears' } } })).toBe('Widgets and Gears');
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

// ── C2 item 5 — the idea's one reading, and the subject line (CC-7); CD-8 — the idea the battle carried ─────────

const OWNER = 'owner-s';
const HASH = 'h'.repeat(64);
/** A battle carrying an idea — its frozen carriage as the deploy writes it (Amendment D CD-8). */
const battleWith = (carriage = { watchlistId: 'wl-s', hypothesisVersion: 4, contentHash: HASH, statement: 'FROZEN-STATEMENT-NEVER-READ' }) => ({ ownerId: OWNER, agentContext: { archetype: 'momentum_chaser', ...(carriage ? { equippedHypothesis: carriage } : {}) } });
const version = (over = {}) => ({ version: 4, watchlistId: 'wl-s', userId: OWNER, contentHash: HASH, createdAt: '2026-09-20T15:00:00.000Z', statement: 'Chips lead while the market drifts.', ...over });

describe('the idea — the battle\'s frozen carriage and its version (carriedIdeaOf, ideaFrom; CD-8, CE-5)', () => {
  it('the carriage\'s identity — list, version, hash — and nothing else; no carriage, or a malformed one, is null (never a guess)', () => {
    expect(carriedIdeaOf(battleWith())).toEqual({ watchlistId: 'wl-s', hypothesisVersion: 4, contentHash: HASH });
    expect(carriedIdeaOf(battleWith(null))).toBeNull();
    for (const bad of [{ watchlistId: 'wl-s', hypothesisVersion: 0, contentHash: HASH }, { watchlistId: 'wl-s', hypothesisVersion: 4 }, { watchlistId: 'wl-s', hypothesisVersion: 4, contentHash: '' }, { watchlistId: 'wl-s', hypothesisVersion: '4', contentHash: HASH }, 'x', null]) {
      expect(carriedIdeaOf({ agentContext: { equippedHypothesis: bad } }), JSON.stringify(bad)).toBeNull();
    }
    expect(carriedIdeaOf(null)).toBeNull();
    expect(carriedIdeaOf({})).toBeNull();
    expect(IDEA_VERSION_PATH).toEqual(['agentContext', 'equippedHypothesis', 'hypothesisVersion']);
  });
  it('THE DAY\'S CALLS ARE NOT READ: a battle with no carriage has no idea whatever its tape\'s calls name (the mutant: the idea read from calls[] again)', () => {
    const tapeOnly = { ownerId: OWNER, calls: [{ callId: 'c', hypothesisRef: { watchlistId: 'wl-s', hypothesisVersion: 4 } }] };
    expect(ideaFrom(tapeOnly, version(), OWNER)).toBeNull();
    expect(ideaFrom(battleWith(null), version(), OWNER)).toBeNull();
  });
  it('the owner\'s version agreeing with the carriage: the version RECORDED (CE-5 — the battle\'s own value), the statement and its time; the frozen statement never', () => {
    expect(ideaFrom(battleWith(), version(), OWNER)).toEqual({ ref: { watchlistId: 'wl-s', hypothesisVersion: 4, contentHash: HASH }, version: { value: 4, class: 'recorded' }, statement: 'Chips lead while the market drifts.', statementAt: '2026-09-20T15:00:00.000Z' });
    expect(CARRIAGE_NUMBER_CLASSES).toEqual({ 'agentContext.equippedHypothesis.hypothesisVersion': 'recorded' });
  });
  it('MISSING OR UNREAD: the idea without its statement — never the frozen statement in its place; over its bound: the same', () => {
    expect(ideaFrom(battleWith(), null, OWNER)).toEqual({ ref: { watchlistId: 'wl-s', hypothesisVersion: 4, contentHash: HASH }, version: { value: 4, class: 'recorded' }, statement: null, statementAt: null });
    expect(ideaFrom(battleWith(), version({ statement: 'x'.repeat(IDEA_STATEMENT_MAX + 1) }), OWNER).statement).toBeNull();
  });
  it('ANOTHER OWNER\'S, OR ONE THAT CONTRADICTS THE CARRIAGE — another list, version number or content hash: no idea at all (CE-5\'s CD-8 correction; the mutant: a hash mismatch carrying the idea)', () => {
    for (const doc of [version({ userId: 'someone-else' }), version({ watchlistId: 'wl-other' }), version({ version: 3 }), version({ contentHash: 'g'.repeat(64) }), version({ contentHash: undefined })]) {
      expect(ideaFrom(battleWith(), doc, OWNER), JSON.stringify(doc)).toBeNull();
    }
  });
});

describe('THE SUBJECT LINE — one projection (CC-7), each part only where held', () => {
  const STATEMENT = 'Industrials and chips lead while the wider market drifts; rotate out of names that stop moving.';
  it('every part: "{SYM} · {sector} · under your idea \'{first 60 code points}\' v{n}"', () => {
    const line = subjectLineOf({ symbol: 'ETN', sector: 'Industrials', idea: { statement: STATEMENT, version: 3 } });
    expect(line.text).toBe(`ETN · Industrials · under your idea '${[...STATEMENT].slice(0, 60).join('')}' v3`);
    expect(line).toMatchObject({ symbol: 'ETN', sector: 'Industrials', idea: { statement: [...STATEMENT].slice(0, 60).join(''), version: 3 } });
    expect(SUBJECT_WORDS).toEqual({ separator: ' · ', underIdea: 'under your idea' });
  });
  it('each part absent in turn: no sector; no carried idea (the line ends after the sector); the idea without its statement; without its version; no symbol, no line', () => {
    expect(subjectLineOf({ symbol: 'ZZQX', sector: null, idea: { statement: 'Hold.', version: 2 } }).text).toBe("ZZQX · under your idea 'Hold.' v2");
    expect(subjectLineOf({ symbol: 'ETN', sector: 'Industrials', idea: null }).text).toBe('ETN · Industrials');
    expect(subjectLineOf({ symbol: 'ETN', sector: 'Industrials' }).text).toBe('ETN · Industrials');
    expect(subjectLineOf({ symbol: 'ETN', sector: 'Industrials', idea: { statement: null, version: 2 } }).text).toBe('ETN · Industrials · under your idea v2');
    expect(subjectLineOf({ symbol: 'ETN', sector: 'Industrials', idea: { statement: 'Hold.', version: null } }).text).toBe("ETN · Industrials · under your idea 'Hold.'");
    expect(subjectLineOf({ symbol: 'ETN', sector: null, idea: null }).text).toBe('ETN');
    for (const symbol of [null, undefined, '', 7, 'Ab3dEf7hIj9kLm1nOp5q']) expect(subjectLineOf({ symbol, sector: 'Industrials' }), String(symbol)).toBeNull();
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
    const day = subjectOfDay(battleWith(), 'ETN', version(), OWNER);
    const excerpt = { symbol: { value: 'ETN', class: 'recorded' }, sector: { value: 'Industrials', class: 'recorded' }, idea: { label: 'i1', version: { value: 4, class: 'recorded' }, statement: { text: 'Chips lead while the market drifts.', by: 'player', at: null, class: 'quoted' } } };
    expect(day.line).toEqual(subjectOfExcerpt(excerpt));
    expect(subjectOfDay(battleWith(), 'ZZQX', version(), OWNER).line.sector).toBeNull();
    expect(subjectOfDay(battleWith(null), 'ETN', null, OWNER).line.text).toBe('ETN · Industrials');
    expect(subjectOfDay(battleWith(), 'ETN', version({ userId: 'someone-else' }), OWNER).line.text).toBe('ETN · Industrials');
    expect(subjectOfExcerpt({ symbol: { value: 'ETN' } }).text).toBe('ETN');
    expect(subjectOfExcerpt(null)).toBeNull();
  });
});

describe('the §2 review\'s lens 3 — the read\'s states, the carriage\'s id class, no dangling fragment', () => {
  it('a carriage naming a list id outside the forge-id class, or a reserved `__id__`, carries no idea on either side (L3-8)', () => {
    for (const watchlistId of ['a/b', '__x__', '', 'x'.repeat(201)]) expect(carriedIdeaOf(battleWith({ watchlistId, hypothesisVersion: 4, contentHash: HASH })), watchlistId).toBeNull();
  });
  it('an idea holding neither its statement nor its version says nothing — no dangling "under your idea" (L3-10)', () => {
    expect(subjectLineOf({ symbol: 'ETN', sector: 'Industrials', idea: { statement: null, version: null } })).toEqual({ symbol: 'ETN', sector: 'Industrials', idea: null, text: 'ETN · Industrials' });
    expect(subjectOfExcerpt({ symbol: { value: 'ETN' }, sector: { value: 'Industrials' }, idea: { label: 'i1' } }).text).toBe('ETN · Industrials');
  });
  it('the screen\'s read states (L3-2, L3-8; CE-5\'s CD-10 correction): loading and error say no line while the battle carries an idea; DENIED shows the line without the idea; missing and idle the idea without its statement; ready the document', () => {
    const b = battleWith();
    expect(subjectOfDayRead(b, 'ETN', { status: 'loading', doc: null }, OWNER)).toBeNull();
    expect(subjectOfDayRead(b, 'ETN', { status: 'error', doc: null }, OWNER)).toBeNull();
    expect(subjectOfDayRead(b, 'ETN', { status: 'denied', doc: null }, OWNER).line.text).toBe('ETN · Industrials');
    expect(subjectOfDayRead(b, 'ETN', { status: 'missing', doc: null }, OWNER).line.text).toBe('ETN · Industrials · under your idea v4');
    expect(subjectOfDayRead(b, 'ETN', { status: 'idle', doc: null }, OWNER).line.text).toBe('ETN · Industrials · under your idea v4');
    expect(subjectOfDayRead(b, 'ETN', { status: 'ready', doc: version() }, OWNER).line.text).toBe("ETN · Industrials · under your idea 'Chips lead while the market drifts.' v4");
    expect(subjectOfDayRead(b, 'ETN', { status: 'ready', doc: version({ contentHash: 'g'.repeat(64) }) }, OWNER).line.text).toBe('ETN · Industrials');
    // a battle that carries no idea has a line whatever the read's state
    expect(subjectOfDayRead(battleWith(null), 'ETN', { status: 'loading', doc: null }, OWNER).line.text).toBe('ETN · Industrials');
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
