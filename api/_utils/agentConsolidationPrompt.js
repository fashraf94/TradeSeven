// api/_utils/agentConsolidationPrompt.js
// Prompt assembly for the Sonnet consolidation call.
//
// Sprint 1 Phase 1 status: helpers below are production-ready. The system prompt
// and user message body are intentionally STUB placeholders pending delivery of
// SPRINT1_CONSOLIDATION_PROMPT_FIXTURE.md. Phase 2 wiring is gated on the real
// prompt landing — do NOT call this module from reflect.js with the stub in place.

/**
 * Build the system + user prompt for the Sonnet consolidation call.
 * @param {object} agent - the post-reflection agent doc (already includes the
 *   memory entry from the just-completed game).
 * @returns {{ systemPrompt: string, userMessage: string }}
 */
export function buildConsolidationPrompt(agent) {
  const evolutionCycle = Number(agent?.evolutionCycle || 0);
  const newCycle = evolutionCycle + 1;
  const archetype = agent?.archetype || 'unknown';
  const agentName = agent?.name || 'Agent';

  const memoryBlock = formatMemory(agent?.memory || [], agent?.evolutionTimeline || []);
  const pendingLessonsBlock = formatPendingLessons(agent?.lessons || []);
  const disciplinesBlock = formatDisciplines(agent?.disciplines || { selection: [], execution: [] });
  const partnerBlock = formatPartnerProfileSummary(agent?.partnerProfile);
  const previousInsight = agent?.consolidatedInsight
    ? `PREVIOUS CONSOLIDATED INSIGHT (cycle ${evolutionCycle}):\n${agent.consolidatedInsight}`
    : 'PREVIOUS CONSOLIDATED INSIGHT: (none — this is your first consolidation)';

  // STUB system prompt — replace with SPRINT1_CONSOLIDATION_PROMPT_FIXTURE.md content.
  const systemPrompt = `[STUB — awaiting SPRINT1_CONSOLIDATION_PROMPT_FIXTURE.md]
You are the consolidation writer for a trading agent. Use the submit_consolidation tool.
Disciplines must be discipline-shaped (specific behavioral rules), not pattern-shaped.
Reinforce existing disciplines by echoing their id and appending the new cycle to reinforcedInCycles.
Carry lessons forward when they have not yet earned discipline status.`;

  const userMessage = [
    `AGENT IDENTITY:\nName: ${agentName}\nArchetype: ${archetype}\nCycle being closed: ${newCycle}`,
    '',
    previousInsight,
    '',
    disciplinesBlock,
    '',
    memoryBlock,
    '',
    pendingLessonsBlock,
    '',
    partnerBlock,
    '',
    `Submit your consolidation via the submit_consolidation tool. The new evolutionCycle value is ${newCycle}.`,
  ].join('\n');

  return { systemPrompt, userMessage };
}

/**
 * Render the rolling memory window for the prompt, annotating each entry with
 * whether it was already seen in a prior consolidation cycle. Annotation is
 * derived by comparing entry.date against the timestamp of the most recent
 * evolution event.
 */
export function formatMemory(memory, evolutionTimeline) {
  if (!Array.isArray(memory) || memory.length === 0) {
    return 'RECENT REFLECTIONS:\n  (none)';
  }

  const lastEvolutionTs = getLastEvolutionTimestampMs(evolutionTimeline);

  const lines = memory.map((entry, i) => {
    const date = entry?.date || entry?.createdAt || null;
    const annotation = annotateMemoryEntry(date, lastEvolutionTs);
    const result = entry?.result ? `${entry.result.toUpperCase()}` : 'reflection';
    const score = entry?.score != null ? ` ${entry.score >= 0 ? '+' : ''}${entry.score}` : '';
    const lesson = entry?.lesson || entry?.reflection || entry?.text || '';
    const adjustment = entry?.adjustment ? ` | adjustment: ${entry.adjustment}` : '';
    return `  ${i + 1}. [${result}${score}] ${annotation} ${lesson}${adjustment}`;
  });

  return `RECENT REFLECTIONS (rolling 5-game window):\n${lines.join('\n')}`;
}

/**
 * Render unconsumed lessons. Sonnet must echo back the IDs in lessonsAbsorbed
 * or lessonsCarriedForward, so id is the most important field here.
 */
export function formatPendingLessons(lessons) {
  if (!Array.isArray(lessons) || lessons.length === 0) {
    return 'UNCONSUMED LESSONS:\n  (none)';
  }
  const pending = lessons.filter(l => l && l.consumed !== true);
  if (pending.length === 0) {
    return 'UNCONSUMED LESSONS:\n  (none — all prior lessons absorbed)';
  }
  const lines = pending.map(l => {
    const source = l.source ? ` [${l.source}]` : '';
    const ticker = l.sourceTrade ? ` (${l.sourceTrade})` : '';
    return `  - id=${l.id}${source}${ticker}: ${l.text}`;
  });
  return `UNCONSUMED LESSONS (echo IDs in lessonsAbsorbed or lessonsCarriedForward):\n${lines.join('\n')}`;
}

/**
 * Render existing disciplines. Sonnet must echo back the id verbatim if it
 * reinforces an existing discipline.
 */
export function formatDisciplines(disciplines) {
  const selection = Array.isArray(disciplines?.selection) ? disciplines.selection : [];
  const execution = Array.isArray(disciplines?.execution) ? disciplines.execution : [];

  if (selection.length === 0 && execution.length === 0) {
    return 'EXISTING DISCIPLINES:\n  (none — this is your first consolidation, all disciplines will be newly formed)';
  }

  const renderOne = d =>
    `    - id=${d.id} | conf=${(d.confidence ?? 0).toFixed(2)} | formed=cycle ${d.formedInCycle}` +
    (Array.isArray(d.reinforcedInCycles) && d.reinforcedInCycles.length > 0
      ? ` | reinforced=[${d.reinforcedInCycles.join(',')}]`
      : '') +
    `\n      "${d.statement}"`;

  const lines = [
    'EXISTING DISCIPLINES (echo id verbatim to reinforce, omit to retire):',
    '  selection:',
    selection.length === 0 ? '    (none)' : selection.map(renderOne).join('\n'),
    '  execution:',
    execution.length === 0 ? '    (none)' : execution.map(renderOne).join('\n'),
  ];
  return lines.join('\n');
}

/**
 * Sprint 1 always returns the not-yet-established sentinel. Sprint 2 will
 * introduce the partner profile writer.
 */
export function formatPartnerProfileSummary(partnerProfile) {
  if (!partnerProfile || typeof partnerProfile !== 'object') {
    return 'PARTNER PROFILE:\n  (not yet established)';
  }
  const keys = Object.keys(partnerProfile);
  if (keys.length === 0) {
    return 'PARTNER PROFILE:\n  (not yet established)';
  }
  const lines = keys.slice(0, 10).map(k => `  - ${k}: ${stringifyPartnerValue(partnerProfile[k])}`);
  return `PARTNER PROFILE:\n${lines.join('\n')}`;
}

// ==================== INTERNAL HELPERS ====================

function getLastEvolutionTimestampMs(evolutionTimeline) {
  if (!Array.isArray(evolutionTimeline) || evolutionTimeline.length === 0) return null;
  let latest = 0;
  for (const event of evolutionTimeline) {
    const ts = toMillis(event?.timestamp);
    if (ts != null && ts > latest) latest = ts;
  }
  return latest > 0 ? latest : null;
}

function annotateMemoryEntry(dateValue, lastEvolutionTs) {
  if (lastEvolutionTs == null) return '(new this cycle)';
  const ts = toMillis(dateValue);
  if (ts == null) return '(unknown timing)';
  return ts > lastEvolutionTs ? '(new this cycle)' : '(seen in prior consolidation)';
}

function toMillis(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      try {
        return value.toMillis();
      } catch {
        return null;
      }
    }
    if (typeof value._seconds === 'number') return value._seconds * 1000;
    if (typeof value.seconds === 'number') return value.seconds * 1000;
  }
  return null;
}

function stringifyPartnerValue(v) {
  if (v == null) return 'null';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v).slice(0, 120);
  } catch {
    return '[unserializable]';
  }
}
