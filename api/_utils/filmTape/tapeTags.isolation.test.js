// api/_utils/filmTape/tapeTags.isolation.test.js
//
// Film Room B1 exit criterion 4 — a tagger failure never stops, delays or
// corrupts the rest of the tape write. The risk manager's counter is made to
// throw (a spread of the real module, one export wrapped); the close pass must
// still write the day, every other section byte-identical to the same day
// written with the tagger working, and `tags` unavailable with the error class.
//
// The dependency-surface guard for tapeTags.js is tapeTags.test.js, which
// mocks nothing it imports; this file mocks the risk manager on purpose.

import { describe, it, expect, vi } from 'vitest';

const knobs = vi.hoisted(() => ({ throwIt: false }));
vi.mock('../../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
  CALL_RECORDS_MODE: 'shadow',
}));
vi.mock('../agentRiskManager.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    updateStagnationCounter: (...args) => {
      if (knobs.throwIt) throw new TypeError('counter exploded');
      return real.updateStagnationCounter(...args);
    },
  };
});

vi.mock('../archetypeRegistry.js', async (importOriginal) => {
  const real = await importOriginal();
  // one made-up id whose definition lacks a threshold (review C-4); every real id resolves as it does in production
  return {
    ...real,
    getArchetypeDefinition: (id, o) => (id === 'half_built'
      ? { physics: { hftConfig: { forcedRotation: { enabled: true, pctThreshold: 0.001, ticksThreshold: null, winnerThreshold: 0, maxTickAgeMinutes: 20 } } } }
      : real.getArchetypeDefinition(id, o)),
  };
});

import { writeTapeDay } from './writeTapeDay.js';
import { tagTapeDay } from './tapeTags.js';
import { makeTapeDb } from './__fixtures__/tapeFirestore.js';
import { seedDay } from './__fixtures__/tapeFixtures.js';
import { stalledDay } from './__fixtures__/tagFixtures.js';
import { contentOf, stableStringify } from './tapeMerge.js';

const NOW = Date.parse('2026-09-25T02:15:30.000Z');
const path = (fx) => `agentBattles/${fx.battleId}/tape/${fx.etDate}`;
const withoutTags = (doc) => {
  const c = structuredClone(contentOf(doc));
  delete c.tags;
  delete c.coverage.tags;
  return stableStringify(c);
};

async function write(throwIt) {
  knobs.throwIt = throwIt;
  try {
    const fx = await stalledDay();
    const t = makeTapeDb(seedDay({}, fx));
    const r = await writeTapeDay(fx.battleId, fx.etDate, { db: t.db, now: NOW });
    return { r, tape: t.store.get(path(fx)), t, fx };
  } finally {
    knobs.throwIt = false;
  }
}

describe('a tagger throw never escapes the tape write', () => {
  it('the day is written; tags unavailable with the error class; the exits still listed; every other byte as with the tagger working', async () => {
    const good = await write(false);
    const bad = await write(true);
    expect(bad.r.status).toBe('written');
    expect(bad.tape.coverage.tags.status).toBe('unavailable');
    expect(bad.tape.coverage.tags.note).toBe('stalled unavailable: the tagger failed (TypeError)');
    expect(bad.tape.tags.items).toBeNull();
    expect(bad.tape.tags.inputs).toBeNull();
    expect(bad.tape.tags.exits).toEqual([{ symbol: 'ACN', tickSeq: 6, at: bad.fx.swapAt, precededByTag: null }]);
    expect(good.tape.tags.items.length).toBeGreaterThan(0);
    expect(withoutTags(bad.tape)).toBe(withoutTags(good.tape));
  });

  it('a later run with the tagger working replaces the unavailable section (the next refresh repairs it)', async () => {
    const bad = await write(true);
    const r = await writeTapeDay(bad.fx.battleId, bad.fx.etDate, { db: bad.t.db, now: NOW + 60_000 });
    expect(r.status).toBe('written');
    const tape = bad.t.store.get(path(bad.fx));
    expect(String(tape.coverage.tags.note)).not.toMatch(/tagger failed/);
    expect(tape.tags.inputs).not.toBeNull();
    expect(tape.tags.items.map((i) => i.tickSeq)).toEqual([4, 5]);
  });
});

describe('a definition missing a threshold (review C-4)', () => {
  it('reads unavailable, naming the missing threshold — never complete with no tags', () => {
    const r = tagTapeDay({ battle: { agentContext: { archetype: 'half_built' } }, doc: { checks: [], actions: [], coverage: { checks: { status: 'complete' }, evidence: { status: 'complete' } } } });
    expect(r.tags.items).toBeNull();
    expect(r.coverage).toMatchObject({ status: 'unavailable', note: "stalled unavailable: the archetype's forced-rotation thresholds are incomplete (ticksThreshold)" });
  });
});
