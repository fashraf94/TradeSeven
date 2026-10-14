// api/_utils/memoryLessons.test.js
//
// Reflection outage fix, part 2 (P-OUT-2, founder rulings O5 and O9) — the ONE
// definition of a real lesson and of the no-lesson marker, shared by the
// consolidation filter and floor and by the record-sheet timeline. Importing
// this pure module here (and from src/utils/evolutionTimeline.js) is its
// BUILD_RULES §4 dependency-surface guard: it must stay import-free.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  LEGACY_REFLECTION_FAILURE_LESSON, MIN_REAL_LESSONS_FOR_CONSOLIDATION,
  isNoLessonMarker, isRealLesson, countRealLessons,
} from './memoryLessons.js';

const real = (lesson = 'Trim winners into strength.') => ({ gameId: 'g', result: 'win', score: 1, lesson, adjustment: 'a' });
const marker = () => ({ gameId: 'g', gameMode: 'baggerbomb', result: 'loss', score: -1, opponentScore: 0, lesson: '', noLesson: true, date: '2026-10-14T00:00:00.000Z' });

describe('the definitions (O5, O9)', () => {
  it('the legacy literal is exactly the old fallback line; the floor is 3', () => {
    expect(LEGACY_REFLECTION_FAILURE_LESSON).toBe('Reflection generation failed.');
    expect(MIN_REAL_LESSONS_FOR_CONSOLIDATION).toBe(3);
  });

  it('a real lesson is a non-blank lesson that is neither the legacy literal nor a marker', () => {
    expect(isRealLesson(real())).toBe(true);
    expect(isRealLesson(real('My entry failed because I chased the gap.'))).toBe(true); // mentions failure: still real
    expect(isRealLesson(real(LEGACY_REFLECTION_FAILURE_LESSON))).toBe(false);
    expect(isRealLesson(real(''))).toBe(false);
    expect(isRealLesson(real('   '))).toBe(false);
    expect(isRealLesson({ gameId: 'g', result: 'win' })).toBe(false);          // no lesson at all
    expect(isRealLesson({ ...real(), lesson: 42 })).toBe(false);               // not a string
    expect(isRealLesson(marker())).toBe(false);
    expect(isRealLesson({ ...real(), noLesson: true })).toBe(false);           // a marker even with text
    for (const bad of [null, undefined, 'lesson', 7]) expect(isRealLesson(bad)).toBe(false);
  });

  it('the legacy literal is matched exactly, as the timeline matches it', () => {
    expect(isRealLesson(real(`${LEGACY_REFLECTION_FAILURE_LESSON} `))).toBe(true);
  });

  it('a marker is exactly noLesson === true', () => {
    expect(isNoLessonMarker(marker())).toBe(true);
    expect(isNoLessonMarker({ ...marker(), noLesson: 'true' })).toBe(false);
    expect(isNoLessonMarker(real())).toBe(false);
    expect(isNoLessonMarker(null)).toBe(false);
  });

  it('countRealLessons counts only real lessons', () => {
    expect(countRealLessons([real(), real(LEGACY_REFLECTION_FAILURE_LESSON), marker(), real('b'), real('')])).toBe(2);
    expect(countRealLessons([])).toBe(0);
    expect(countRealLessons(undefined)).toBe(0);
  });

  it('stays import-free (the client bundle imports it)', () => {
    const src = readFileSync(new URL('./memoryLessons.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/^\s*import\s/m);
  });
});
