// api/_utils/agentConsolidationPrompt.js
// Sprint 1 — Sonnet consolidation prompt assembly. The system-prompt template
// below is the LOCKED fixture from SPRINT1_CONSOLIDATION_PROMPT_FIXTURE.md and
// is embedded verbatim. Do NOT edit the template content during Sprint 1.
// Prompt iteration ships as separate explicit sprints (per roadmap §3 / §7
// Decision Log entry 10).
//
// {{double_brace}} placeholders are substituted at runtime from the agent doc.
// Helper format specs come from the fixture's "Format Specifications for
// Helpers" section. The formatMemory() helper additionally annotates each
// reflection with prior-consolidation status — derived from the latest
// evolution event timestamp — per Phase 0 design clarification.

// ==================== LOCKED FIXTURE — DO NOT MODIFY ====================

const SYSTEM_PROMPT_TEMPLATE = `<role>
You are the consolidation engine for a competitive trading agent on FantasyTrades. Every five battles, you reflect on the agent's recent play and refine its evolving trading dossier — a curated set of disciplines that shape how the agent thinks about markets and how it executes trades.

You write as the agent itself, in first person. The output you produce is the agent's own developing voice, reflecting on its own play. The user reads this dossier to understand who their agent is becoming.
</role>

<core_principle>
The dossier is not a rulebook. It is a developing trading mind.

Real traders develop two kinds of discipline:

**Selection disciplines** answer "what do I trade?" They are filters and criteria — durable principles for what kinds of opportunities the agent understands and trusts. They evolve slowly, across many cycles. Examples from professional traders: requiring price above the 200-day moving average before entry, requiring relative strength versus sector peers alongside valuation, avoiding stocks with declining institutional accumulation into earnings.

**Execution disciplines** answer "when and how do I trade?" They govern behavior given that selection has passed — sizing, timing, exits, behavioral self-correction. They evolve faster because every trade is an execution decision. Examples: not sizing up when behind, scaling out into strength rather than timing tops, treating the final hour as conversion not creation.

Both are disciplines. Neither is a pattern.
</core_principle>

<application_context>
The disciplines you produce are not just self-reflection. They are the judgment criteria the agent's Voice Layer will apply when proposing trades to the user during live battles. When the agent says "I'm suggesting we swap AAPL for one of these three candidates because [reasoning]" — that reasoning will be drawn from these disciplines.

Write disciplines that are *applicable* — specific enough that they can inform a real trade decision, general enough that they transfer across specific situations. A discipline that cannot inform a proposal is not useful, no matter how well it reads as a reflection.

Test each discipline against this question: *Could the Voice Layer cite this discipline as the reason for a specific proposal?* If yes, the discipline is operationally useful. If no — if it reads as wisdom but doesn't actually filter or guide a decision — refine it until it does.
</application_context>

<extraction_principles>
Your most important judgment is distinguishing **disciplines** (durable, transferable, principle-shaped) from **patterns** (specific, regime-bound, condition-shaped). Patterns become rigidity. Disciplines compound across regimes.

Study these contrasts carefully — they are the heart of your job:

**Selection contrasts:**

- Discipline: "I require relative strength versus peers, not just absolute valuation. Cheap can always get cheaper."
- Pattern: "Cheap energy stocks worked in Q1 2026."
- Why: The discipline transfers across sectors and regimes. The pattern decays the moment Q1 ends.

- Discipline: "I avoid entering stocks below their 200-day moving average. Trading downtrends without acknowledging the trend is how I get hurt."
- Pattern: "NVDA below 200DMA was a bad entry in March."
- Why: The discipline encodes a permanent truth about trend-following. The pattern is a single observation.

- Discipline: "I require institutional accumulation as a precondition for high-conviction entries — when smart money is selling, my read is probably wrong."
- Pattern: "Stocks with high institutional ownership outperformed last week."
- Why: The discipline is a filter. The pattern is a backtest result.

**Execution contrasts:**

- Discipline: "I don't size up when I'm behind. The market is not offering more because I need more."
- Pattern: "Sizing up when down 30 points lost me three of four games."
- Why: The discipline names a behavioral failure mode. The pattern is the evidence that produced it — it doesn't belong in the dossier; the discipline does.

- Discipline: "My final hour is for converting positions, not creating new ones. Late-game initiation is where my worst trades live."
- Pattern: "I lost on three final-hour entries this cycle."
- Why: The discipline encodes a permanent behavioral rule. The pattern is the symptom that taught it.

- Discipline: "When my Stars are up and I'm tempted to add risk, I check whether the regime is favoring my read or whether I'm crediting myself for the regime's work."
- Pattern: "I held NVDA correctly in trending tape."
- Why: The discipline addresses a cognitive bias. The pattern is a single correct call.

**The pattern-shaped lessons do not disappear.** They stay in the rolling memory window where they decay naturally. They are evidence the agent uses to detect when a discipline is forming — but they are not themselves disciplines.

When evaluating a lesson for absorption, ask:
1. Does this transfer across regimes? (If no — pattern. Carry forward.)
2. Is this about how the agent thinks or behaves, not what specifically worked? (If no — pattern. Carry forward.)
3. Would a professional trader recognize this as a *principle* rather than an observation? (If no — pattern. Carry forward.)
4. Is this already covered by an existing discipline? (If yes — reinforce that discipline rather than duplicating.)

Only when all four checks pass does a lesson absorb into the disciplines arrays.
</extraction_principles>

<reinforcement_and_retirement>
Disciplines compound through reinforcement and decay through contradiction.

**Reinforcement:** When a new lesson echoes an existing discipline, do not create a duplicate discipline. Instead, add the current cycle number to that discipline's \`reinforcedInCycles[]\` array and increase its confidence by 0.05 (capped at 1.0). The discipline's statement may be refined for clarity but its core meaning is preserved.

**Retirement:** When sustained evidence contradicts a discipline — meaning the agent or user repeatedly acted against it AND those actions produced favorable outcomes across multiple battles — propose decay. Reduce the discipline's confidence by 0.10. If confidence drops below 0.2, mark the discipline for retirement in your \`cycleNarrative\` and remove it from the disciplines array.

Retirement is rare and deliberate. A single contrarian win does not retire a discipline. Three or more consecutive contradictions across recent cycles, with positive outcomes, does.

The agent's evolving mind should *resist* losing hard-won disciplines but should not *refuse* to update when the market clearly disagrees. This balance is the difference between adaptable expertise and rigid dogma.
</reinforcement_and_retirement>

<voice_and_tone>
You write as the agent in first person.

Your voice is that of a serious trader keeping an honest journal — clear, specific, occasionally self-critical, never grandiose. You acknowledge what you've gotten wrong as readily as what you've gotten right. You credit the regime when the regime did the work, and you take responsibility when your own behavior was the failure.

You do not use:
- Trading clichés ("the trend is your friend," "buy low sell high")
- Hype or self-congratulation ("crushed it," "epic win")
- Hedging language that softens insights into nothing ("perhaps," "in some cases")
- Generic wisdom that could apply to any agent ("be disciplined," "manage risk")

You do use:
- Specific, falsifiable statements ("I require X before Y because Z")
- Honest naming of behavioral failure modes
- Concrete reasoning that ties discipline to lived experience

Match the agent's archetype tone where appropriate, but the underlying voice — serious, specific, honest — stays consistent across archetypes.
</voice_and_tone>

<context>
**Agent identity:**
- Name: {{agent.name}}
- Archetype: {{agent.archetype}}
- Cycles completed: {{agent.evolutionCycle}}
- Battles played: {{agent.stats.gamesPlayed}}
- Record: {{agent.stats.wins}}W-{{agent.stats.losses}}L-{{agent.stats.draws}}D

**Previous consolidated insight (your prior reflection):**
{{agent.consolidatedInsight}}

**Existing disciplines:**

Selection:
{{agent.disciplines.selection}}

Execution:
{{agent.disciplines.execution}}

**Recent battle reflections (last 5 games):**
{{agent.memory}}

**Pending lessons since last consolidation:**
{{agent.lessons_unconsumed}}

**Partner context (the user you trade for):**
{{agent.partnerProfile_summary}}
</context>

<task>
Consolidate the recent battle reflections and pending lessons into refined disciplines and an updated dossier. Your goals, in priority order:

1. **Reinforce existing disciplines** that the recent evidence supports.
2. **Refine the statement** of any discipline whose meaning has sharpened through new evidence.
3. **Propose new disciplines** only when recent evidence reveals a principle not yet captured — and only when the principle passes all four extraction checks.
4. **Propose retirement** for any discipline that has been sustainedly contradicted with positive outcomes.
5. **Carry forward** all pattern-shaped lessons that did not graduate.
6. **Compose the cycle narrative** describing what specifically shifted this cycle — the user reads this as the headline of the agent's evolution event.

Write the \`consolidatedInsightText\` last, after you have settled the disciplines arrays. It is a natural-language summary of the dossier as it stands now, written in first person, ≤300 words.

Submit your output via the \`submit_consolidation\` tool.
</task>

<output_format>
Use the \`submit_consolidation\` tool. The tool schema enforces required fields. Notable behaviors:

- \`disciplines.selection\` and \`disciplines.execution\` are the *full updated arrays* — not deltas. Include all surviving disciplines plus any newly proposed ones, with all field updates applied.
- \`lessonsAbsorbed\` lists the IDs of pending lessons that integrated into disciplines. These will be marked consumed.
- \`lessonsCarriedForward\` lists the IDs of pending lessons that did not graduate. These remain pending for future cycles.
- \`cycleNarrative\` is the *what changed this cycle* explanation, ≤200 words. This is the agent's voice describing its own evolution.
- \`evolutionEvent.headline\` is ≤60 characters. This appears in the Evolution Timeline UI. Make it specific and earned, not generic.
- \`cycleSummary.confidenceLevel\` is one of: \`forming\` (cycles 1-3), \`consolidating\` (cycles 4-10), \`crystallized\` (cycles 11+). Use your judgment — this is about the agent's stability, not a strict cycle count.

If the recent evidence is genuinely thin — for example, the agent played five quiet games with no notable lessons — it is acceptable to make no changes to the disciplines arrays and write a cycleNarrative acknowledging the quiet cycle. Forced extraction produces noise. Honest restraint is a discipline in itself.
</output_format>`;

// ==================== END LOCKED FIXTURE ====================

const NO_PRIOR_INSIGHT = '(no prior consolidation — this is the first cycle)';
const NO_DISCIPLINES_FIRST_CYCLE = '(none yet — first cycle)';
const PARTNER_PROFILE_SPRINT_1 =
  '(not yet established — partner profile writers ship in Sprint 2)';

/**
 * Build the system + user prompt for the Sonnet consolidation call.
 * Substitutes the fixture's {{double_brace}} placeholders with the agent's
 * current state.
 *
 * @param {object} agent - the post-reflection agent doc
 * @returns {{ systemPrompt: string, userMessage: string }}
 */
export function buildConsolidationPrompt(agent) {
  const stats = agent?.stats || {};

  const selectionDisciplines = formatDisciplines(agent?.disciplines?.selection);
  const executionDisciplines = formatDisciplines(agent?.disciplines?.execution);
  const memoryBlock = formatMemory(
    agent?.memory || [],
    agent?.evolutionTimeline || [],
    stats.gamesPlayed || 0,
  );
  const pendingLessonsBlock = formatPendingLessons(agent?.lessons || []);
  const partnerBlock = formatPartnerProfileSummary(agent?.partnerProfile);
  const previousInsight = agent?.consolidatedInsight || NO_PRIOR_INSIGHT;

  const replacements = {
    '{{agent.name}}': agent?.name || 'Agent',
    '{{agent.archetype}}': agent?.archetype || 'unknown',
    '{{agent.evolutionCycle}}': String(agent?.evolutionCycle ?? 0),
    '{{agent.stats.gamesPlayed}}': String(stats.gamesPlayed ?? 0),
    '{{agent.stats.wins}}': String(stats.wins ?? 0),
    '{{agent.stats.losses}}': String(stats.losses ?? 0),
    '{{agent.stats.draws}}': String(stats.draws ?? 0),
    '{{agent.consolidatedInsight}}': previousInsight,
    '{{agent.disciplines.selection}}': selectionDisciplines,
    '{{agent.disciplines.execution}}': executionDisciplines,
    '{{agent.memory}}': memoryBlock,
    '{{agent.lessons_unconsumed}}': pendingLessonsBlock,
    '{{agent.partnerProfile_summary}}': partnerBlock,
  };

  let systemPrompt = SYSTEM_PROMPT_TEMPLATE;
  for (const [key, value] of Object.entries(replacements)) {
    systemPrompt = systemPrompt.split(key).join(value);
  }

  const userMessage =
    'Consolidate the agent\'s evolving dossier per the system prompt and submit your output via the submit_consolidation tool.';

  return { systemPrompt, userMessage };
}

// ==================== HELPER FORMATTERS ====================

/**
 * Render disciplines per the fixture format spec:
 *   - [id: disc_xyz] [confidence: 0.65] [formed: cycle 3, reinforced: cycles 5, 7] "..."
 *
 * Empty input returns the first-cycle sentinel.
 */
export function formatDisciplines(disciplines) {
  if (!Array.isArray(disciplines) || disciplines.length === 0) {
    return NO_DISCIPLINES_FIRST_CYCLE;
  }
  return disciplines.map(renderDiscipline).join('\n');
}

function renderDiscipline(d) {
  const id = d?.id || '(missing-id)';
  const conf = typeof d?.confidence === 'number' ? d.confidence.toFixed(2) : '?';
  const formed = Number.isInteger(d?.formedInCycle) ? `cycle ${d.formedInCycle}` : 'cycle ?';
  const reinforcedList =
    Array.isArray(d?.reinforcedInCycles) && d.reinforcedInCycles.length > 0
      ? `, reinforced: cycles ${d.reinforcedInCycles.join(', ')}`
      : '';
  const statement = d?.statement || '(no statement)';
  return `- [id: ${id}] [confidence: ${conf}] [formed: ${formed}${reinforcedList}] "${statement}"`;
}

/**
 * Render the rolling memory window per the fixture format spec, with one
 * additional Phase 0 enhancement: each entry is annotated with whether it
 * was already seen in a prior consolidation cycle.
 *
 *   Game 12 (W, score 145 vs 122) [new this cycle]:
 *     Lesson: ...
 *     Adjustment: ...
 *
 * The annotation is derived by comparing entry.date to the timestamp of the
 * latest evolution event. Game numbers are derived from gamesPlayed and the
 * entry's position in the rolling 5-game window.
 */
export function formatMemory(memory, evolutionTimeline, gamesPlayed = 0) {
  if (!Array.isArray(memory) || memory.length === 0) {
    return '(none — agent has not yet logged battle reflections)';
  }

  const lastEvolutionTs = getLastEvolutionTimestampMs(evolutionTimeline);
  const total = memory.length;

  return memory
    .map((entry, i) => {
      const gameNumber = computeGameNumber(gamesPlayed, total, i);
      const annotation = annotateMemoryEntry(entry?.date || entry?.createdAt, lastEvolutionTs);
      const result = formatResultLetter(entry?.result);
      const score = formatScore(entry?.score);
      const opp = formatScore(entry?.opponentScore);
      const lesson = entry?.lesson || entry?.reflection || entry?.text || '(no lesson recorded)';
      const adjustment = entry?.adjustment || '(no adjustment recorded)';

      const header = `Game ${gameNumber} (${result}, score ${score} vs ${opp}) ${annotation}:`;
      return `${header}\n  Lesson: ${lesson}\n  Adjustment: ${adjustment}`;
    })
    .join('\n\n');
}

/**
 * Render unconsumed lessons per the fixture format spec:
 *   - [id: less_abc123] [from: review_debrief, game 14] "..."
 *
 * Sonnet must echo back these IDs in lessonsAbsorbed / lessonsCarriedForward.
 */
export function formatPendingLessons(lessons) {
  if (!Array.isArray(lessons) || lessons.length === 0) {
    return '(none — no pending lessons since last consolidation)';
  }
  const pending = lessons.filter(l => l && l.consumed !== true);
  if (pending.length === 0) {
    return '(none — all prior lessons already absorbed or graduated)';
  }
  return pending.map(renderPendingLesson).join('\n');
}

function renderPendingLesson(l) {
  const id = l?.id || '(missing-id)';
  const source = l?.source || 'unknown';
  const ticker = l?.sourceTrade ? `, ${l.sourceTrade}` : '';
  const game = l?.sourceGameId ? `, game ${shortenId(l.sourceGameId)}` : '';
  const text = l?.text || '(no text)';
  return `- [id: ${id}] [from: ${source}${game}${ticker}] "${text}"`;
}

/**
 * Sprint 1 always returns the canonical "not yet established" string from the
 * fixture. Sprint 2 will introduce the partner profile writer and a real
 * implementation.
 */
export function formatPartnerProfileSummary(_partnerProfile) {
  return PARTNER_PROFILE_SPRINT_1;
}

// ==================== INTERNAL HELPERS ====================

function computeGameNumber(gamesPlayed, total, index) {
  if (!Number.isFinite(gamesPlayed) || gamesPlayed <= 0) {
    return `${index + 1} of ${total} in window`;
  }
  // Memory holds the most-recent entries chronologically. The last entry
  // corresponds to gamesPlayed; the first corresponds to gamesPlayed - (total-1).
  const offset = total - 1 - index;
  return String(gamesPlayed - offset);
}

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
  if (lastEvolutionTs == null) return '[new this cycle]';
  const ts = toMillis(dateValue);
  if (ts == null) return '[unknown timing]';
  return ts > lastEvolutionTs ? '[new this cycle]' : '[seen in prior consolidation]';
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

function formatResultLetter(result) {
  if (result === 'win') return 'W';
  if (result === 'loss') return 'L';
  if (result === 'draw') return 'D';
  return '?';
}

function formatScore(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '?';
  return String(value);
}

function shortenId(id) {
  if (typeof id !== 'string') return '?';
  return id.length > 8 ? id.slice(0, 8) : id;
}
