import { describe, expect, it } from 'vitest';
// BUILD_RULES §4 dependency-surface guard: real imports, never mocked. This
// loads the scorer, feature flags and game-mode constants in Node.
import { buildArchetypeCandidateMenu } from './archetypeCandidateMenu.js';
import { ARCHETYPE_WEIGHTS, computeArchetypeRankings } from './archetypeScoring.js';
import { makeCandidateUniverse } from './__fixtures__/archetypeCandidateMenu.js';

const archetypes = Object.keys(ARCHETYPE_WEIGHTS);
const rankings = makeCandidateUniverse();
const excludeSymbols = new Set(rankings.slice(0, 9).map(s => s.symbol));
const base = { gameMode: 'baggerbomb_agent', archetype: 'analyst', rankings, excludeSymbols };
const symbols = rows => rows.map(s => s.symbol);

describe('BaggerBomb archetype candidate menu', () => {
  it.each(archetypes)('retains full-universe %s rank through both menus', archetype => {
    const expected = symbols(computeArchetypeRankings(rankings, archetype, { gameMode: 'baggerBomb' }))
      .filter(s => !excludeSymbols.has(s));
    const menu = buildArchetypeCandidateMenu({ ...base, archetype });
    expect(menu).toEqual({ hotBench: expected.slice(0, 15), monitoring: expected.slice(15, 33) });
  });

  it('keeps distinct fundamental and speculative preferences on the regression fixture', () => {
    const fundamental = buildArchetypeCandidateMenu(base);
    const speculative = buildArchetypeCandidateMenu({ ...base, archetype: 'degen' });
    expect(fundamental.hotBench.slice(0, 3)).toEqual(['S072', 'S094', 'S015']);
    expect(speculative.hotBench.slice(0, 3)).toEqual(['S009', 'S047', 'S018']);
    expect(fundamental.hotBench).not.toEqual(speculative.hotBench);
  });

  it('uses sector population before held/bench exclusions', () => {
    const rows = [
      ...Array.from({ length: 9 }, (_, i) => ({ symbol: `HELD${i}`, sectorName: 'A' })),
      { symbol: 'A', sectorName: 'A' }, { symbol: 'B', sectorName: 'B' },
    ];
    const menu = buildArchetypeCandidateMenu({ ...base, rankings: rows, archetype: 'diversifier',
      excludeSymbols: new Set(rows.slice(0, 9).map(s => s.symbol)) });
    // Filtering before ranking would tie A/B and put A first.
    expect(menu.hotBench).toEqual(['B', 'A']);
  });

  it.each(archetypes)('protects equipped names and keeps %s rank under overflow', archetype => {
    const unEquipped = buildArchetypeCandidateMenu({ ...base, archetype });
    const equipped = Array.from({ length: 8 }, (_, i) => `OFF${i}`);
    const menu = buildArchetypeCandidateMenu({ ...base, archetype, equippedTickers: equipped });
    expect(menu.hotBench).toEqual([...unEquipped.hotBench.slice(0, 12), ...equipped]);
    // Displaced ranked names enter monitoring before lower-ranked names.
    expect(menu.monitoring.slice(0, 3)).toEqual(unEquipped.hotBench.slice(12));
  });

  it('deduplicates equipped names, preserves overlaps, and excludes held/bench names', () => {
    const menu = buildArchetypeCandidateMenu({ ...base,
      equippedTickers: ['S072', 'OFF', 'OFF', 'S000', 'S008', '', null] });
    expect(menu.hotBench).toHaveLength(16);
    expect(menu.hotBench).toContain('OFF');
    expect(menu.hotBench.filter(s => s === 'S072')).toHaveLength(1);
    expect([...menu.hotBench, ...menu.monitoring].some(s => excludeSymbols.has(s))).toBe(false);
    expect(menu.monitoring.some(s => menu.hotBench.includes(s))).toBe(false);
  });

  it('keeps all equipped names when they alone exceed the soft cap', () => {
    const equippedTickers = Array.from({ length: 23 }, (_, i) => `OFF${i}`);
    const menu = buildArchetypeCandidateMenu({ ...base, equippedTickers });
    expect(menu.hotBench).toEqual(equippedTickers);
    expect(menu.monitoring).toHaveLength(18);
  });

  it('handles an empty or exhausted universe without inventing candidates', () => {
    expect(buildArchetypeCandidateMenu({ ...base, rankings: [] })).toEqual({ hotBench: [], monitoring: [] });
    expect(buildArchetypeCandidateMenu({ ...base, excludeSymbols: new Set(symbols(rankings)) }))
      .toEqual({ hotBench: [], monitoring: [] });
  });

  it('does not mutate ranking inputs or equipped names', () => {
    const frozen = rankings.map(row => Object.freeze({ ...row }));
    const equippedTickers = Object.freeze(['OFF']);
    expect(() => buildArchetypeCandidateMenu({ ...base, rankings: Object.freeze(frozen), equippedTickers }))
      .not.toThrow();
  });

  it.each(['baggerbomb_tournament', 'league', 'season', 'unknown', ''])('leaves explicit %s mode on the legacy path', gameMode => {
    expect(buildArchetypeCandidateMenu({ ...base, gameMode })).toBeNull();
  });
  it('leaves resolved tournament context on the legacy path even with a tiered mode stamp', () => {
    expect(buildArchetypeCandidateMenu({ ...base, isTournament: true })).toBeNull();
  });
  it.each([undefined, null])('treats absent mode %s as a legacy tiered battle', gameMode => {
    expect(buildArchetypeCandidateMenu({ ...base, gameMode })).toEqual(buildArchetypeCandidateMenu(base));
  });
  it.each([undefined, null, 'unknown', 'toString', 'constructor', {}])('returns a diagnostic and legacy selection for identity %s', archetype => {
    const events = [];
    expect(buildArchetypeCandidateMenu({ ...base, archetype, onEvent: event => events.push(event) })).toBeNull();
    expect(events).toEqual([{ type: 'archetype_candidate_menu_legacy', reason: 'unknown_archetype' }]);
  });
});
