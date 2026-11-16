// src/utils/filmRoomSubject.test.js
//
// Film Room C2 — the shared subject module (Build C spec §5, §6; Amendment C CC-2, CC-7): the sector is the symbol
// directory's own one word, never guessed; a quoted text is carried whole within its bound or not at all.

import { describe, it, expect } from 'vitest';
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): filmRoomSubject.js imports api/_utils/rankingConfig.js; the excerpt
// (api/) imports this module — this import is the runtime guard that it stays Node-clean, never mocked.
import { sectorOf, boundedText, codePointsOf, IDEA_STATEMENT_MAX } from './filmRoomSubject.js';
import { TICKER_TO_SECTOR, STOCK_UNIVERSE } from '../../api/_utils/rankingConfig.js';

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
