// src/constants/deriveWeekLine.test.js
//
// Backing Beta PR 4 — the derived line (design brief rev2 §2, rev3 §2). The
// rows the build prompt names, one each: a full week; a week with zero moves;
// a week missing sector data (lean omitted, nothing else changed); a CPU team;
// no completed week; and the MUTATION row — a lean invented when sector data
// is absent must red a row, which is what the `sectors: null` / partial-cover
// rows below do (BUILD_RULES §2: a row that cannot fail under the defect it
// names is not a guard).
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the real import below is the
// runtime guard for the api/ → src/ import the team-card projection makes.
// Never mock this module.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveWeekLine, WEEK_LINE_SEPARATOR } from './deriveWeekLine.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// A veteran's recorded week: three drafted, one swapped out, three agent
// swaps, sector data for both held names.
const FULL = Object.freeze({
  drafted: ['NVDA', 'VST', 'COIN'],
  heldAtClose: ['NVDA', 'VST', 'XLE'],
  userSwaps: 1,
  agentSwaps: 3,
  sectors: { NVDA: 'technology', VST: 'technology', XLE: 'energy' },
});

describe('deriveWeekLine — the module contract', () => {
  it('has zero imports (Node-clean by construction — BUILD_RULES §4)', () => {
    const src = readFileSync(path.join(HERE, 'deriveWeekLine.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toMatch(/\brequire\s*\(/);
  });

  it('joins clauses with the design\'s middle dot', () => {
    expect(WEEK_LINE_SEPARATOR).toBe(' · ');
  });
});

describe('deriveWeekLine — the rows the build names', () => {
  it('a full week: held · moves · lean, from the recorded facts alone', () => {
    expect(deriveWeekLine(FULL)).toBe('Held 2 of 3 all week · 4 moves · leaned technology');
  });

  it('a week with zero moves reads "no moves"', () => {
    expect(deriveWeekLine({ ...FULL, userSwaps: 0, agentSwaps: 0 })).toBe('Held 2 of 3 all week · no moves · leaned technology');
  });

  it('exactly one swap reads "1 move", never "1 moves"', () => {
    expect(deriveWeekLine({ ...FULL, userSwaps: 1, agentSwaps: 0 })).toBe('Held 2 of 3 all week · 1 move · leaned technology');
  });

  it('a week MISSING sector data omits the lean and changes nothing else', () => {
    const withoutLean = deriveWeekLine({ ...FULL, sectors: null });
    expect(withoutLean).toBe('Held 2 of 3 all week · 4 moves');
    // Nothing else moved: the full line is exactly this line plus the lean clause.
    expect(deriveWeekLine(FULL)).toBe(`${withoutLean}${WEEK_LINE_SEPARATOR}leaned technology`);
  });

  it('MUTATION ROW — a lean is never invented when sector data is absent or partial', () => {
    // No sector map at all.
    expect(deriveWeekLine({ ...FULL, sectors: undefined })).not.toContain('leaned');
    expect(deriveWeekLine({ ...FULL, sectors: {} })).not.toContain('leaned');
    // ONE held name uncovered → the clause is omitted entirely, not inferred
    // from the covered name. An implementation that defaulted the gap (to
    // 'unknown', to the majority, to anything) reds this row.
    expect(deriveWeekLine({ ...FULL, sectors: { NVDA: 'technology' } })).toBe('Held 2 of 3 all week · 4 moves');
    // Sector data for names that were NOT held does not rescue the clause.
    expect(deriveWeekLine({ ...FULL, sectors: { COIN: 'financial', XLE: 'energy' } })).toBe('Held 2 of 3 all week · 4 moves');
  });

  it('a tie between sectors is not a lean', () => {
    expect(deriveWeekLine({ ...FULL, sectors: { NVDA: 'technology', VST: 'energy' } })).toBe('Held 2 of 3 all week · 4 moves');
  });

  it('a CPU team has no derived line — the card shows the CPU state (spec §5)', () => {
    expect(deriveWeekLine({ ...FULL, isCpu: true })).toBeNull();
  });

  it('no completed week → null (the card shows FIRST WEEK · no tape yet)', () => {
    expect(deriveWeekLine(null)).toBeNull();
    expect(deriveWeekLine(undefined)).toBeNull();
    expect(deriveWeekLine({})).toBeNull();
  });
});

describe('deriveWeekLine — every clause is omitted when its source is absent', () => {
  it('no draft record → no held clause (and no lean, which needs the held set)', () => {
    expect(deriveWeekLine({ ...FULL, drafted: null })).toBe('4 moves');
    expect(deriveWeekLine({ ...FULL, drafted: undefined })).toBe('4 moves');
  });

  it('no roster at close → no held clause', () => {
    expect(deriveWeekLine({ ...FULL, heldAtClose: null })).toBe('4 moves');
  });

  it('one layer\'s swap count missing → no moves clause (both layers or nothing)', () => {
    expect(deriveWeekLine({ ...FULL, agentSwaps: null })).toBe('Held 2 of 3 all week · leaned technology');
    expect(deriveWeekLine({ ...FULL, userSwaps: undefined })).toBe('Held 2 of 3 all week · leaned technology');
  });

  it('a non-integer or negative count is not a count', () => {
    expect(deriveWeekLine({ ...FULL, agentSwaps: 1.5 })).toBe('Held 2 of 3 all week · leaned technology');
    expect(deriveWeekLine({ ...FULL, agentSwaps: -1 })).toBe('Held 2 of 3 all week · leaned technology');
  });

  it('nothing held all week → no lean, but the held clause still states the fact', () => {
    expect(deriveWeekLine({ ...FULL, heldAtClose: ['XLE', 'GLD', 'TLT'] })).toBe('Held 0 of 3 all week · 4 moves');
  });

  it('a sector key\'s underscores read as words; nothing else is rewritten', () => {
    expect(deriveWeekLine({
      drafted: ['HD', 'LOW'], heldAtClose: ['HD', 'LOW'], userSwaps: 0, agentSwaps: 0,
      sectors: { HD: 'consumer_cyclical', LOW: 'consumer_cyclical' },
    })).toBe('Held 2 of 2 all week · no moves · leaned consumer cyclical');
  });

  it('no recorded fact at all → null, never an empty string', () => {
    expect(deriveWeekLine({ drafted: null, heldAtClose: null, userSwaps: null, agentSwaps: null, sectors: null })).toBeNull();
  });
});
