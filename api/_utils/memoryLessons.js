// api/_utils/memoryLessons.js
//
// Reflection outage fix, part 2 (package P-OUT-2, founder rulings O5 and O9,
// 14 Oct 2026). ONE definition of what an agent.memory[] entry holds, shared by
// the consolidation filter and floor (api/_utils/agentConsolidationPrompt.js,
// agentConsolidationApply.js, api/agent/reflect.js) and the record-sheet
// timeline (src/utils/evolutionTimeline.js), so the wisdom rewrite and the
// screen can never disagree about which rows are lessons (BUILD_RULES §9).
//
// Pure and import-free: the client bundle imports it too.
//
// Three kinds of entry live in the rolling five-game window:
//   • a REAL lesson — written by a successful reflection;
//   • a LEGACY failure entry — before P-OUT-1 a failed reflection was saved
//     with the literal LEGACY_REFLECTION_FAILURE_LESSON as its lesson; old
//     entries still hold it, no new entry can;
//   • a NO-LESSON MARKER (O9) — written when a battle finishes without a
//     lesson, so the game keeps an honest row: the usual game fields, an empty
//     lesson and noLesson: true.

export const LEGACY_REFLECTION_FAILURE_LESSON = 'Reflection generation failed.';

// O5: a consolidation runs only when the window holds at least this many real
// lessons. Below it nothing is written and the agent keeps its paragraph.
export const MIN_REAL_LESSONS_FOR_CONSOLIDATION = 3;

/** A no-lesson marker (O9). */
export function isNoLessonMarker(entry) {
  return entry?.noLesson === true;
}

/**
 * A real lesson (O5): a non-blank lesson that is not the legacy failure
 * literal and not a no-lesson marker. The literal is matched exactly, as the
 * timeline matches it, so the filter and the screen agree row for row.
 */
export function isRealLesson(entry) {
  if (!entry || typeof entry !== 'object' || isNoLessonMarker(entry)) return false;
  const { lesson } = entry;
  return typeof lesson === 'string' && lesson.trim() !== '' && lesson !== LEGACY_REFLECTION_FAILURE_LESSON;
}

/** How many real lessons a memory window holds. */
export function countRealLessons(memory) {
  return Array.isArray(memory) ? memory.filter(isRealLesson).length : 0;
}
