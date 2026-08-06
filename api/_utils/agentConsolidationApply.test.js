// api/_utils/agentConsolidationApply.test.js
// Sprint 1 Phase 1: validator + applyConsolidation unit tests.
//
// Sonnet driver (consolidateAgentEvolution) is not exercised here — it is
// covered by the Phase 4 end-to-end verification once the prompt fixture lands.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin/firestore BEFORE importing the module under test.
vi.mock('firebase-admin/firestore', () => {
  const arrayUnion = vi.fn((value) => ({ __op: 'arrayUnion', value }));
  return {
    FieldValue: { arrayUnion },
    Timestamp: {
      now: () => ({
        toMillis: () => 1_700_000_000_000, // fixed millis for deterministic ISO
        seconds: 1_700_000_000,
        nanoseconds: 0,
      }),
    },
  };
});

const { validateConsolidationOutput, applyConsolidation, applyConsolidationTx } = await import('./agentConsolidationApply.js');
const { FieldValue } = await import('firebase-admin/firestore');

// ==================== FIXTURES ====================

function makeDiscipline(overrides = {}) {
  return {
    id: 'disc_test_1',
    statement: 'I do not enter momentum positions in the final 30 minutes of a trading day.',
    formedInCycle: 1,
    reinforcedInCycles: [],
    confidence: 0.5,
    source: 'consolidation',
    category: 'execution',
    ...overrides,
  };
}

function makeAgent(overrides = {}) {
  return {
    id: 'agent_test',
    evolutionCycle: 0,
    lessons: [
      { id: 'lesson_1', text: 'Late-day momentum trades have low edge.', consumed: false, consumedInConsolidation: null },
      { id: 'lesson_2', text: 'Volatility expansion needs confirmation.', consumed: false, consumedInConsolidation: null },
      { id: 'lesson_old', text: 'Pre-existing absorbed lesson.', consumed: true, consumedInConsolidation: '2025-01-01T00:00:00.000Z' },
    ],
    memory: [
      { result: 'win', score: 12, lesson: 'r1', date: '2026-04-30T00:00:00.000Z' },
    ],
    ...overrides,
  };
}

function makeValidOutput(overrides = {}) {
  return {
    disciplines: {
      selection: [],
      execution: [makeDiscipline()],
    },
    consolidatedInsightText: 'Five games in, my edge is clearest in the morning trend regimes; afternoons are noise for me.',
    cycleNarrative: 'I learned to stop fighting late-day chop.',
    evolutionEvent: {
      headline: 'Cycle 1 — late-day discipline forms',
      narrative: 'Five reflections converge on the same theme: late-day chop is unprofitable for my style.',
    },
    lessonsAbsorbed: ['lesson_1'],
    lessonsCarriedForward: ['lesson_2'],
    cycleSummary: {
      cyclesCompleted: 1,
      keyShift: 'Defined a clear no-trade window',
      confidenceLevel: 'forming',
    },
    ...overrides,
  };
}

// ==================== validateConsolidationOutput ====================

describe('validateConsolidationOutput', () => {
  it('accepts a well-formed output', () => {
    const r = validateConsolidationOutput(makeValidOutput(), makeAgent());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('rejects null/non-object output', () => {
    expect(validateConsolidationOutput(null, makeAgent()).valid).toBe(false);
    expect(validateConsolidationOutput('hello', makeAgent()).valid).toBe(false);
  });

  it('flags missing top-level keys', () => {
    const r = validateConsolidationOutput({}, makeAgent());
    expect(r.valid).toBe(false);
    expect(r.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing required key: disciplines'),
        expect.stringContaining('missing required key: cycleSummary'),
      ]),
    );
  });

  it('flags discipline with wrong category placement', () => {
    const out = makeValidOutput();
    out.disciplines.selection = [makeDiscipline({ category: 'execution' })];
    const r = validateConsolidationOutput(out, makeAgent());
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('selection[0].category'))).toBe(true);
  });

  it('flags discipline with confidence outside [0, 1]', () => {
    const out = makeValidOutput();
    out.disciplines.execution = [makeDiscipline({ confidence: 1.5 })];
    const r = validateConsolidationOutput(out, makeAgent());
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('confidence must be a number in [0, 1]'))).toBe(true);
  });

  it('flags discipline with wrong source', () => {
    const out = makeValidOutput();
    out.disciplines.execution = [makeDiscipline({ source: 'debate' })];
    const r = validateConsolidationOutput(out, makeAgent());
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('source must be "consolidation"'))).toBe(true);
  });

  it('flags consolidatedInsightText that exceeds the hard word limit', () => {
    const longText = Array(401).fill('word').join(' ');
    const r = validateConsolidationOutput(makeValidOutput({ consolidatedInsightText: longText }), makeAgent());
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('consolidatedInsightText exceeds hard limit'))).toBe(true);
  });

  it('accepts consolidatedInsightText at the hard limit', () => {
    const text = Array(400).fill('word').join(' ');
    const r = validateConsolidationOutput(makeValidOutput({ consolidatedInsightText: text }), makeAgent());
    expect(r.valid).toBe(true);
  });

  it('flags evolutionEvent.headline that exceeds 80 chars', () => {
    const out = makeValidOutput();
    out.evolutionEvent.headline = 'x'.repeat(81);
    const r = validateConsolidationOutput(out, makeAgent());
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('evolutionEvent.headline exceeds hard limit'))).toBe(true);
  });

  it('flags lessonsAbsorbed referencing unknown lesson id', () => {
    const out = makeValidOutput({ lessonsAbsorbed: ['lesson_999'], lessonsCarriedForward: [] });
    const r = validateConsolidationOutput(out, makeAgent());
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('unknown lesson id: lesson_999'))).toBe(true);
  });

  it('flags lessonsAbsorbed referencing an already-consumed lesson', () => {
    const out = makeValidOutput({ lessonsAbsorbed: ['lesson_old'], lessonsCarriedForward: [] });
    const r = validateConsolidationOutput(out, makeAgent());
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('already-consumed lesson id: lesson_old'))).toBe(true);
  });

  it('flags invalid confidenceLevel enum', () => {
    const out = makeValidOutput();
    out.cycleSummary.confidenceLevel = 'mythical';
    const r = validateConsolidationOutput(out, makeAgent());
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('confidenceLevel must be one of'))).toBe(true);
  });
});

// ==================== applyConsolidation ====================

describe('applyConsolidation', () => {
  let updateMock;
  let agentRef;

  beforeEach(() => {
    updateMock = vi.fn().mockResolvedValue();
    agentRef = { update: updateMock };
    FieldValue.arrayUnion.mockClear();
  });

  it('performs a single atomic update with all expected fields', async () => {
    const agent = makeAgent();
    const out = makeValidOutput();

    const { newCycle, evolutionEvent } = await applyConsolidation(agentRef, agent, out);

    expect(updateMock).toHaveBeenCalledTimes(1);
    const update = updateMock.mock.calls[0][0];

    expect(update.disciplines).toBe(out.disciplines);
    expect(update.consolidatedInsight).toBe(out.consolidatedInsightText);
    expect(update.evolutionCycle).toBe(1);
    expect(update.pendingConsolidation).toBe(false);
    expect(FieldValue.arrayUnion).toHaveBeenCalledWith(evolutionEvent);
    expect(update.evolutionTimeline).toEqual({ __op: 'arrayUnion', value: evolutionEvent });

    expect(newCycle).toBe(1);
    expect(evolutionEvent.id).toMatch(/^evo_/);
    expect(evolutionEvent.cycle).toBe(1);
    expect(evolutionEvent.metadata.lessonsAbsorbedCount).toBe(1);
    expect(evolutionEvent.metadata.lessonsCarriedForwardCount).toBe(1);
    expect(evolutionEvent.metadata.disciplinesCount).toEqual({ selection: 0, execution: 1 });
  });

  it('marks absorbed lessons as consumed with the new ISO timestamp', async () => {
    const agent = makeAgent();
    const out = makeValidOutput();
    await applyConsolidation(agentRef, agent, out);

    const update = updateMock.mock.calls[0][0];
    const updatedLessons = update.lessons;

    const lesson1 = updatedLessons.find(l => l.id === 'lesson_1');
    expect(lesson1.consumed).toBe(true);
    expect(lesson1.consumedInConsolidation).toBe(new Date(1_700_000_000_000).toISOString());

    const lesson2 = updatedLessons.find(l => l.id === 'lesson_2');
    expect(lesson2.consumed).toBe(false);
    expect(lesson2.consumedInConsolidation).toBeNull();

    // Pre-existing consumed lesson untouched.
    const lessonOld = updatedLessons.find(l => l.id === 'lesson_old');
    expect(lessonOld.consumed).toBe(true);
    expect(lessonOld.consumedInConsolidation).toBe('2025-01-01T00:00:00.000Z');
  });

  it('does NOT touch agent.memory (funnel principle)', async () => {
    const agent = makeAgent();
    const out = makeValidOutput();
    await applyConsolidation(agentRef, agent, out);

    const update = updateMock.mock.calls[0][0];
    expect('memory' in update).toBe(false);
  });

  it('increments evolutionCycle from existing value', async () => {
    const agent = makeAgent({ evolutionCycle: 4 });
    const { newCycle } = await applyConsolidation(agentRef, agent, makeValidOutput());
    expect(newCycle).toBe(5);
    expect(updateMock.mock.calls[0][0].evolutionCycle).toBe(5);
  });

  it('handles agent with no lessons array gracefully', async () => {
    const agent = { id: 'a', evolutionCycle: 0 };
    const out = makeValidOutput({ lessonsAbsorbed: [], lessonsCarriedForward: [] });
    await applyConsolidation(agentRef, agent, out);
    expect(updateMock.mock.calls[0][0].lessons).toEqual([]);
  });
});

// ==================== applyConsolidationTx (Phase 1 casual copy-forward) ====================

describe('applyConsolidationTx (transactional — casual forward)', () => {
  // A db whose transaction exposes a FRESH agent read (which may differ from the
  // driver's earlier pre-read — e.g. a concurrent DRB arrayUnion added a lesson).
  function makeTxDb(freshAgent) {
    const store = { written: null };
    const agentRef = { path: 'agents/parent-1' };
    const db = {
      runTransaction: async (fn) => fn({
        get: async () => ({ exists: true, data: () => freshAgent }),
        update: (_ref, data) => { store.written = data; },
      }),
    };
    return { db, agentRef, store };
  }

  it('re-reads evolutionCycle + lessons FRESH in-tx and preserves a concurrently-added lesson (no clobber)', async () => {
    const fresh = {
      evolutionCycle: 3,
      lessons: [
        { id: 'lesson_1', text: 'absorbed target', consumed: false, consumedInConsolidation: null },
        { id: 'lesson_2', text: 'carried', consumed: false, consumedInConsolidation: null },
        // arrived AFTER the driver's pre-read (a concurrent DRB write to the parent):
        { id: 'lesson_concurrent', text: 'must not be clobbered', consumed: false, consumedInConsolidation: null },
      ],
    };
    const { db, agentRef, store } = makeTxDb(fresh);
    const { newCycle } = await applyConsolidationTx(db, agentRef, makeValidOutput({ lessonsAbsorbed: ['lesson_1'] }));

    expect(newCycle).toBe(4); // 3 + 1, from the FRESH read (not a stale pre-read)
    const byId = Object.fromEntries(store.written.lessons.map((l) => [l.id, l]));
    expect(byId.lesson_1.consumed).toBe(true);              // absorbed → consumed
    expect(byId.lesson_concurrent).toBeTruthy();            // the concurrent lesson SURVIVED
    expect(byId.lesson_concurrent.consumed).toBe(false);    // untouched
    expect(store.written.evolutionCycle).toBe(4);
    expect(store.written.consolidatedInsight).toBe(makeValidOutput().consolidatedInsightText);
    expect(store.written.pendingConsolidation).toBe(false);
    expect(store.written.evolutionTimeline).toEqual(FieldValue.arrayUnion(expect.objectContaining({ type: 'consolidation', cycle: 4 })));
  });

  it('handles an empty/absent agent gracefully (cycle starts at 1, no lessons)', async () => {
    const { db, agentRef, store } = makeTxDb({}); // no evolutionCycle, no lessons
    const { newCycle } = await applyConsolidationTx(db, agentRef, makeValidOutput({ lessonsAbsorbed: [] }));
    expect(newCycle).toBe(1);
    expect(store.written.lessons).toEqual([]);
  });
});
