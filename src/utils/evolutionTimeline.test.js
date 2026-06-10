// src/utils/evolutionTimeline.test.js
//
// Unit tests for the pure evolution-timeline assembly helper. Plain vitest, no
// rendering — matches the convention in traitSlotSummary.test.js.

import { describe, it, expect } from 'vitest';
import { buildEvolutionTimeline, formatRelativeDate } from './evolutionTimeline.js';

describe('buildEvolutionTimeline', () => {
  it('returns [] for a null agent', () => {
    expect(buildEvolutionTimeline(null)).toEqual([]);
  });

  it('emits a creation entry from createdAt', () => {
    const events = buildEvolutionTimeline({ createdAt: '2026-01-10T12:00:00Z', archetype: 'momentum' });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'creation', title: 'Agent created' });
    expect(events[0].date.toISOString()).toBe('2026-01-10T12:00:00.000Z');
  });

  it('prefers real consolidation events and synthesizes legacy cycles', () => {
    const events = buildEvolutionTimeline({
      createdAt: '2026-01-01T00:00:00Z',
      evolutionCycle: 2,
      consolidatedInsight: 'Lean into momentum.',
      evolutionTimeline: [
        { type: 'consolidation', cycle: 2, id: 'evo_2', headline: 'Sharper entries', narrative: 'A story.', timestamp: '2026-02-01T00:00:00Z', metadata: { keyShift: 'entries' } },
      ],
    });
    const cycles = events.filter((e) => e.type === 'evolution');
    expect(cycles).toHaveLength(2);
    const real = cycles.find((e) => e.eventId === 'evo_2');
    expect(real).toMatchObject({ isConsolidation: true, title: 'Sharper entries', subtitle: 'entries', narrative: 'A story.' });
    const legacy = cycles.find((e) => e.eventId === 'evo_cycle_1_legacy');
    expect(legacy).toMatchObject({ isConsolidation: false, title: 'Evolution cycle 1 complete' });
  });

  it('emits lesson, scored-game, and strategy-deploy entries', () => {
    const events = buildEvolutionTimeline({
      lessons: [{ text: 'Cut losers faster.', createdAt: '2026-03-01T00:00:00Z' }],
      memory: [
        { gameMode: 'baggerbomb', result: 'win', score: 156, lesson: 'Diversify.', date: '2026-03-02T00:00:00Z' },
        { gameMode: 'baggerbomb', result: 'loss', date: '2026-03-03T00:00:00Z' }, // no score → no score tail
        { reflection: 'no result — skipped' },
      ],
      deployedStrategy: { experimentName: 'Earnings Drift', deployedAt: '2026-03-04T00:00:00Z' },
    });
    expect(events.map((e) => e.type)).toEqual(['deploy', 'game', 'game', 'lesson']);
    expect(events.find((e) => e.type === 'lesson')).toMatchObject({ title: 'Lesson Learned', subtitle: 'Cut losers faster.' });
    expect(events.find((e) => e.title.includes('Win'))).toMatchObject({ title: 'baggerbomb — Win +156' });
    expect(events.find((e) => e.title.includes('Loss'))).toMatchObject({ title: 'baggerbomb — Loss' });
    expect(events.find((e) => e.type === 'deploy')).toMatchObject({ subtitle: '"Earnings Drift" deployed from Forge' });
  });

  it('sorts newest first across event types', () => {
    const events = buildEvolutionTimeline({
      createdAt: '2026-01-01T00:00:00Z',
      lessons: [{ text: 'L', createdAt: '2026-03-01T00:00:00Z' }],
      memory: [{ gameMode: 'baggerbomb', result: 'win', score: 1, date: '2026-02-01T00:00:00Z' }],
    });
    expect(events.map((e) => e.type)).toEqual(['lesson', 'game', 'creation']);
  });

  it('parses Firestore-style {_seconds} dates', () => {
    const events = buildEvolutionTimeline({ createdAt: { _seconds: 1767052800 } }); // 2025-12-30T00:00:00Z
    expect(events[0].date.toISOString()).toBe('2025-12-30T00:00:00.000Z');
  });
});

describe('formatRelativeDate', () => {
  it('renders Today / Yesterday / Nd ago bands', () => {
    const now = new Date();
    expect(formatRelativeDate(now)).toBe('Today');
    expect(formatRelativeDate(new Date(now - 86400000))).toBe('Yesterday');
    expect(formatRelativeDate(new Date(now - 3 * 86400000))).toBe('3d ago');
  });

  it('falls back to a short date beyond a week and "" for invalid input', () => {
    expect(formatRelativeDate(new Date('2020-03-15T12:00:00Z'))).toMatch(/Mar 1[45]/);
    expect(formatRelativeDate(null)).toBe('');
    expect(formatRelativeDate(new Date('nope'))).toBe('');
  });
});
