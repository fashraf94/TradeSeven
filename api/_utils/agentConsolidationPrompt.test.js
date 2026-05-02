// api/_utils/agentConsolidationPrompt.test.js
// Sprint 1 — locks helper format specs against the fixture
// (SPRINT1_CONSOLIDATION_PROMPT_FIXTURE.md).

import { describe, it, expect } from 'vitest';
import {
  buildConsolidationPrompt,
  formatDisciplines,
  formatMemory,
  formatPendingLessons,
  formatPartnerProfileSummary,
} from './agentConsolidationPrompt.js';

// ==================== formatDisciplines ====================

describe('formatDisciplines', () => {
  it('returns the first-cycle sentinel for empty input', () => {
    expect(formatDisciplines([])).toBe('(none yet — first cycle)');
    expect(formatDisciplines(undefined)).toBe('(none yet — first cycle)');
  });

  it('renders disciplines per fixture format', () => {
    const out = formatDisciplines([
      {
        id: 'disc_xyz',
        confidence: 0.65,
        formedInCycle: 3,
        reinforcedInCycles: [5, 7],
        statement: 'I require relative strength versus peers, not just absolute valuation.',
      },
    ]);
    expect(out).toBe(
      '- [id: disc_xyz] [confidence: 0.65] [formed: cycle 3, reinforced: cycles 5, 7] "I require relative strength versus peers, not just absolute valuation."',
    );
  });

  it('omits the reinforced clause when reinforcedInCycles is empty', () => {
    const out = formatDisciplines([
      {
        id: 'disc_a',
        confidence: 0.5,
        formedInCycle: 1,
        reinforcedInCycles: [],
        statement: 'Test.',
      },
    ]);
    expect(out).toBe('- [id: disc_a] [confidence: 0.50] [formed: cycle 1] "Test."');
  });
});

// ==================== formatMemory ====================

describe('formatMemory', () => {
  it('returns sentinel for empty memory', () => {
    expect(formatMemory([], [], 0)).toBe('(none — agent has not yet logged battle reflections)');
  });

  it('renders entries per fixture format with derived game number', () => {
    const memory = [
      { result: 'win', score: 145, opponentScore: 122, lesson: 'L1', adjustment: 'A1', date: '2026-04-30T00:00:00.000Z' },
    ];
    const out = formatMemory(memory, [], 12);
    // Agent at gamesPlayed=12, with 1 entry in window → game 12.
    expect(out.startsWith('Game 12 (W, score 145 vs 122)')).toBe(true);
    expect(out).toContain('Lesson: L1');
    expect(out).toContain('Adjustment: A1');
  });

  it('annotates entries newer than the latest evolution event as new this cycle', () => {
    const memory = [
      { result: 'loss', score: 80, opponentScore: 100, lesson: 'L', adjustment: 'A', date: '2026-04-30T00:00:00.000Z' },
    ];
    const evolutionTimeline = [
      { timestamp: { toMillis: () => Date.parse('2026-04-25T00:00:00.000Z') } },
    ];
    const out = formatMemory(memory, evolutionTimeline, 5);
    expect(out).toContain('[new this cycle]');
  });

  it('annotates entries older than the latest evolution event as seen in prior consolidation', () => {
    const memory = [
      { result: 'win', score: 50, opponentScore: 30, lesson: 'L', adjustment: 'A', date: '2026-04-20T00:00:00.000Z' },
    ];
    const evolutionTimeline = [
      { timestamp: { toMillis: () => Date.parse('2026-04-25T00:00:00.000Z') } },
    ];
    const out = formatMemory(memory, evolutionTimeline, 5);
    expect(out).toContain('[seen in prior consolidation]');
  });
});

// ==================== formatPendingLessons ====================

describe('formatPendingLessons', () => {
  it('returns sentinel for empty input', () => {
    expect(formatPendingLessons([])).toBe('(none — no pending lessons since last consolidation)');
  });

  it('returns "all absorbed" sentinel when every lesson is consumed', () => {
    const lessons = [{ id: 'l_1', consumed: true, text: 'x' }];
    expect(formatPendingLessons(lessons)).toBe('(none — all prior lessons already absorbed or graduated)');
  });

  it('renders unconsumed lessons per fixture format with id visible', () => {
    const lessons = [
      {
        id: 'less_abc123',
        text: 'Final-hour AMD entry hurt me; it was momentum chasing not setup recognition',
        source: 'review_debrief',
        sourceGameId: 'battle_99887766aa',
        consumed: false,
      },
    ];
    const out = formatPendingLessons(lessons);
    expect(out).toContain('[id: less_abc123]');
    expect(out).toContain('[from: review_debrief, game battle_9');
    expect(out).toContain('"Final-hour AMD entry hurt me; it was momentum chasing not setup recognition"');
  });

  it('filters out consumed lessons', () => {
    const lessons = [
      { id: 'l1', text: 'a', consumed: true, source: 's' },
      { id: 'l2', text: 'b', consumed: false, source: 's' },
    ];
    const out = formatPendingLessons(lessons);
    expect(out).not.toContain('[id: l1]');
    expect(out).toContain('[id: l2]');
  });
});

// ==================== formatPartnerProfileSummary ====================

describe('formatPartnerProfileSummary', () => {
  it('always returns the Sprint 1 sentinel string regardless of input', () => {
    const expected = '(not yet established — partner profile writers ship in Sprint 2)';
    expect(formatPartnerProfileSummary(null)).toBe(expected);
    expect(formatPartnerProfileSummary(undefined)).toBe(expected);
    expect(formatPartnerProfileSummary({ riskAppetite: 'high' })).toBe(expected);
    expect(formatPartnerProfileSummary({})).toBe(expected);
  });
});

// ==================== buildConsolidationPrompt ====================

describe('buildConsolidationPrompt', () => {
  function makeAgent(overrides = {}) {
    return {
      id: 'agent_x',
      name: 'TestAgent',
      archetype: 'momentum_chaser',
      evolutionCycle: 0,
      stats: { gamesPlayed: 5, wins: 3, losses: 2, draws: 0 },
      consolidatedInsight: '',
      disciplines: { selection: [], execution: [] },
      memory: [],
      lessons: [],
      evolutionTimeline: [],
      partnerProfile: null,
      ...overrides,
    };
  }

  it('substitutes all fixture placeholders into the system prompt', () => {
    const { systemPrompt } = buildConsolidationPrompt(makeAgent());
    // No raw {{...}} markers should remain.
    expect(systemPrompt).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('substitutes agent identity values into the system prompt', () => {
    const { systemPrompt } = buildConsolidationPrompt(makeAgent());
    expect(systemPrompt).toContain('Name: TestAgent');
    expect(systemPrompt).toContain('Archetype: momentum_chaser');
    expect(systemPrompt).toContain('Cycles completed: 0');
    expect(systemPrompt).toContain('Battles played: 5');
    expect(systemPrompt).toContain('Record: 3W-2L-0D');
  });

  it('uses the no-prior-insight sentinel for first cycle', () => {
    const { systemPrompt } = buildConsolidationPrompt(makeAgent({ consolidatedInsight: '' }));
    expect(systemPrompt).toContain('(no prior consolidation — this is the first cycle)');
  });

  it('emits a non-empty user message that references the tool', () => {
    const { userMessage } = buildConsolidationPrompt(makeAgent());
    expect(userMessage).toContain('submit_consolidation');
  });

  it('includes the Sprint 1 partner-profile sentinel verbatim', () => {
    const { systemPrompt } = buildConsolidationPrompt(
      makeAgent({ partnerProfile: { riskAppetite: 'high' } }),
    );
    expect(systemPrompt).toContain('(not yet established — partner profile writers ship in Sprint 2)');
  });
});
