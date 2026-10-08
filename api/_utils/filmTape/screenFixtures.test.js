// api/_utils/filmTape/screenFixtures.test.js
//
// Film Room A2 — THE SCREEN'S FIXTURES ARE THE PASSES' OUTPUT. The screen
// suites (src/screens/filmRoomV2/*.jsdom.test.jsx) run in jsdom and load the
// tape and series documents as JSON; this suite rebuilds both fixture days
// through the REAL close and candle passes (writeTapeDay, runCandlePass) and
// requires the committed JSON to equal what they write — so a screen row can
// never pass against a hand-made tape the product could not produce, and an
// A1 change that moves a fixture fails here until it is regenerated.
//
// Regenerate (only when the passes' output is meant to change):
//   FILM_ROOM_SCREEN_FIXTURES_WRITE=1 npx vitest run api/_utils/filmTape/screenFixtures.test.js
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL passes. Never mock them;
// only the writer flag is mocked on (spreading the real module).

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
}));

import { buildScreenFixtures } from './__fixtures__/screenFixtures.js';
import { numbersWithClasses, formatNumberPath } from '../../../src/constants/filmTape.js';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../../src/screens/filmRoomV2/__fixtures__');
const FILES = {
  'sep23.tape.json': (f) => f.sep23.tape,
  'sep23.series.json': (f) => f.sep23.series,
  'empty.tape.json': (f) => f.empty.tape,
  'empty.series.json': (f) => f.empty.series,
};

let built;
beforeAll(async () => {
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  built = await buildScreenFixtures();
  errSpy.mockRestore();
  if (process.env.FILM_ROOM_SCREEN_FIXTURES_WRITE === '1') {
    mkdirSync(OUT, { recursive: true });
    for (const [name, pick] of Object.entries(FILES)) writeFileSync(path.join(OUT, name), `${JSON.stringify(pick(built), null, 2)}\n`);
  }
});

describe('the Sep-23-shaped day, as the passes write it', () => {
  it('three swaps — two platform-rule exits, one the agent\'s — each replayed with the sale split', () => {
    const { tape } = built.sep23;
    expect(tape.actions).toHaveLength(3);
    expect(tape.actions.map((a) => a.mechanism)).toEqual(['archetype_rotation', 'agent_decision', 'archetype_rotation']);
    for (const a of tape.actions) {
      expect(a.replay, a.key).toBeTruthy();
      expect(a.replay.reconciliation.soldAtSale.recordedPx, a.key).toBe(a.exitPrice);
      expect(typeof a.replay.reconciliation.soldAtSale.rebuiltPx).toBe('number');
      expect(typeof a.replay.gapPoints).toBe('number');
    }
  });

  it('a swap whose fill and sale differ in sign (the sold name\'s bar above its recorded exit, the bought name\'s below its fill)', () => {
    const signs = built.sep23.tape.actions.map((a) => [Math.sign(a.replay.reconciliation.soldAtSale.pxDelta), Math.sign(a.replay.reconciliation.boughtAtSale.pxDelta)]);
    expect(signs.some(([s, b]) => s * b < 0)).toBe(true);
  });

  it('a partial checks section, model-failure checks held by default, plans, rationale, directives in all three states, diagnostics present, a recorded win', () => {
    const { tape } = built.sep23;
    expect(tape.coverage.checks.status).toBe('partial');
    expect(tape.checks).toHaveLength(23);
    expect(tape.checks.filter((c) => c.decision?.holdKind === 'default_failure').length).toBe(2);
    expect(tape.plans.length).toBeGreaterThan(4);
    expect(tape.plans.every((p) => p.price && p.price.atPlan)).toBe(true);
    expect(tape.rationale.length).toBe(10);
    expect(tape.coverage.rationale.note).toMatch(/2 entr\(y\/ies\) carried platform-written text/);
    expect(tape.directives.map((d) => d.cardState)).toEqual(['committed', 'no_change', 'not_filed']);
    expect(tape.directives[0].heard).toBeTruthy();
    expect(tape.diagnostics.intradayViews).toBe('present');
    expect(tape.battle.result).toEqual({ value: 'win', basis: 'derived' });
    expect(tape.battle.completionMessage.text).toBe('Battle complete. Agent: -47.0 pts vs CPU: -93.0 pts. Result: Win.');
    expect(tape.checks.filter((c) => c.evidence).length).toBeGreaterThan(5);
    expect(tape.passes.candles.status).toBe('written');
  });

  it('every numeric leaf of the tape and of every series document has exactly one declared class', () => {
    const bad = numbersWithClasses(built.sep23.tape, built.sep23.tape.numberClasses).filter((n) => !n.cls).map((n) => formatNumberPath(n.path));
    expect(bad).toEqual([]);
    for (const s of built.sep23.series) expect(numbersWithClasses(s, s.numberClasses).filter((n) => !n.cls).map((n) => formatNumberPath(n.path))).toEqual([]);
    expect(built.sep23.series.map((s) => s.symbol)).toEqual(expect.arrayContaining(['SPY', 'RSP', 'MSFT', 'CRWD', 'DE', 'PLTR', 'ETN', 'PANW', 'XLK', 'XLI']));
  });
});

describe('the empty day, as the passes write it', () => {
  it('no checks; the result unavailable with the missing score named; the platform\'s "Result: Draw." beside it', () => {
    const { tape } = built.empty;
    expect(tape.checks).toEqual([]);
    expect(tape.score.lastCheck).toBeNull();
    expect(tape.battle.result).toEqual({ value: null, basis: 'unavailable', note: 'opponent score never recorded' });
    expect(tape.battle.completionMessage.text).toBe('Result: Draw.');
    expect(tape.passes.close.capture).toBe('absent');
  });
});

describe('the committed JSON is exactly the passes\' output (no hand-made tape)', () => {
  it.each(Object.keys(FILES))('%s', (name) => {
    const committed = JSON.parse(readFileSync(path.join(OUT, name), 'utf8'));
    expect(committed).toEqual(JSON.parse(JSON.stringify(FILES[name](built))));
  });
});
