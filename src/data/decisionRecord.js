// src/data/decisionRecord.js
//
// THE PERSISTED DECISION RECORD'S SHARED VOCABULARY — one source for the
// client (the Battle View: battleViewCopy.js, selectWhyState.js,
// selectDeployPlan.js) and the server (the grounded narrator prompt,
// api/_utils/voiceLayerGrounding.js).
//
// WHY IT LIVES HERE (voice-grounding hazard 26, the Sep 7 rulings §3). The
// narrator's YOUR RECORD block renders the same check the Battle View renders
// — its slot, why the decider was woken, whether a decision was recorded,
// whose words the rationale is, the plan at deploy — and copying those strings
// into api/ is the drift class BUILD_RULES §4 forbids: two sentences for one
// fact eventually disagree. battleViewCopy.js cannot be imported from api/ as
// it stands: its relative imports carry no extension, and the Vercel Node
// runtime resolves ESM strictly (`import('./src/screens/battleView/
// battleViewCopy.js')` under plain Node fails with ERR_MODULE_NOT_FOUND on
// `../../components/Dashboard/desk/deskCopy` — the guard row in
// decisionRecord.test.js keeps that finding honest). So the strings and rules
// the server needs moved HERE, and the client modules import them back and
// re-export them under their shipped names, so nothing that consumed them
// changed.
//
// ZERO IMPORTS on purpose (the promptHonestyRegistry precedent): this module
// must load under plain Node and must never join a mocked graph.
//
// The rules the strings encode are the Battle View's — D-65 / D-69 (the
// absence lines), D-72 (whose words), D-76 (the plan at deploy is history),
// D-81 (why the decider was woken), D-83 (a check is named by its slot; the
// formatter itself stays in deskCopy.js) — and the honesty rules in
// deskCopy.js: scoreboard language, no agent verbs between checks, a proven
// state or nothing, the agent's own words only. deskHonesty.test.js scans
// this file like every other Battle View source.

// ── Why the decider was woken (D-81) ────────────────────────────────────────
// `evaluation.triggers` persists the TYPES only (agent-evaluate.js
// `triggers.map(t => t.type)`); the detail string is not persisted, so the
// copy names the type and nothing more. A trigger wakes the decider — it is
// not a rule the agent acts on, and this line never becomes an "alert level".
// All nine persisted types are ruled; an UNKNOWN type renders NOTHING — never
// a raw type string. The gate is the only writer, and a tenth type added there
// arrives here unruled and silent until it has its own sentence.
export const WOKEN_BY_TYPE = Object.freeze({
  price_drop: 'Woken by a price drop',
  forced_open: 'Woken by the first check of the battle',
  forced_close: 'Woken by the final hour',
  threshold_proximity: 'Woken by a piece near a scoring tier',
  bench_outperformance: 'Woken by a bench name outrunning the book',
  vwap_deviation: 'Woken by a move away from the day\'s average price',
  bandwidth_squeeze: 'Woken by a volatility squeeze',
  nr7_contraction: 'Woken by a narrow-range day',
  news_catalyst: 'Woken by a news story on a piece',
});

/** The first ruled sentence among a tick's trigger types, or null. */
export function wokenBy(triggers) {
  if (!Array.isArray(triggers)) return null;
  for (const type of triggers) {
    const line = WOKEN_BY_TYPE[type];
    if (line) return line;
  }
  return null;
}

// ── The decision states a check can be in ───────────────────────────────────
// The absence state is a real state, not a failure (honesty rule 7): the tick
// ran and recorded no evaluation entry.
export const NO_DECISION = 'No decision recorded at this check';
// The more specific absence (D-65): the entry carries `haikuError` with
// `failureClass: 'timeout'` — the model call timed out and the tick defaulted
// to HOLD with the system's placeholder words. Every other outage class takes
// the class-neutral line below (D-69): "did not complete" is true of every
// class including the timeout; the timeout keeps the more specific line.
export const NO_DECISION_OUTAGE = 'No decision recorded at this check · the evaluation timed out';
export const NO_DECISION_INCOMPLETE = 'No decision recorded at this check · the evaluation did not complete';

/** The absence line for an outage entry, by its persisted failure class. */
export function noDecisionLine(haikuError) {
  return haikuError?.failureClass === 'timeout' ? NO_DECISION_OUTAGE : NO_DECISION_INCOMPLETE;
}

export const HELD_LABEL = 'Held';
export const swappedLabel = (symbolOut, symbolIn) => `Swapped · ${symbolOut ?? '—'} → ${symbolIn ?? '—'}`;
// Downgraded FIRST (hazard 2): a swap the model argued for that a guardrail
// held still carries a swap rationale.
export const DOWNGRADED_LABEL = 'Argued for a swap · held by a guardrail';
// The FOURTH state (D-66): `downgraded === true` is also stamped when
// executeSwapServer threw — no guardrail held anything; the swap the agent
// argued for simply did not go through.
export const FAILED_LABEL = 'Argued for a swap · it did not go through';

/**
 * The prefix agent-evaluate.js writes into `validationErrors[0]` when the
 * swap's execution THREW (`Swap execution failed: …`). Pinned against the cron
 * by a source tripwire in selectWhyState.test.js.
 */
export const SWAP_FAILED_PREFIX = 'Swap execution failed';

/** D-66: a downgraded entry whose first validation error is the thrown-swap prefix. */
export function swapDidNotGoThrough(evaluation) {
  const first = Array.isArray(evaluation?.validationErrors) ? evaluation.validationErrors[0] : null;
  return typeof first === 'string' && first.startsWith(SWAP_FAILED_PREFIX);
}

/** A tier key as the word a player reads on the tier header. */
export function tierLabel(tier) {
  if (tier === 'star') return 'Star';
  if (tier === 'core') return 'Core';
  if (tier === 'support') return 'Support';
  return null;
}

// ── Whose words the motive is (D-72 ruling 5) ───────────────────────────────
// The engine writes the rationale on the risk loop, the guardrail path and the
// R11 pass; only the model's own swap carries the agent's argument. An
// unlabelled system sentence under the agent's name is the C1 failure this
// pair exists to prevent.
export const MOTIVE_AGENT = 'The agent\'s own words';
export const MOTIVE_SYSTEM = 'The system\'s reason';

/**
 * THE ONE MOTIVE-AUTHOR RULE (D-72 ruling 5, BUILD_RULES §9).
 *
 * Whether a rationale was written by the ENGINE rather than the model. Three
 * shapes, all of them the cron's or the guardrail module's own sentence:
 *
 *   `Guardrail override (…): …`  agent-evaluate.js OVERWRITES haikuResult's
 *                                rationale when a guardrail forces the pair.
 *   `Guardrail override: …`      agentGuardrails.js's own statusMessage, which
 *                                the R11 suppression pass persists verbatim.
 *   `Risk manager: …`            the risk loop's trade rationale.
 *   `Deterministic guardrail …`  R11's fallback when statusMessage is null.
 *
 * THE TEXT IS THE DISCRIMINATOR, NOT THE TRADE'S `source` (A2 review L1-F3 /
 * L1-F4). `source` records who chose the EXIT, which is a different question
 * from who wrote the SENTENCE, and it is wrong in both directions: a
 * guardrail-forced swap that EXECUTES leaves `downgraded` false, so surfaces
 * with no `source` at all rendered the cron's sentence as the agent's words;
 * on the `reinforced_haiku` path the guardrail agrees with a swap the model
 * argued for and leaves its rationale untouched, but the cron still stamps
 * `source: 'guardrail'`. One rule, one text, consumed by the panel, the check
 * card, the trade card and the narrator's record alike.
 *
 * The prefixes are pinned against their writers by source tripwires in
 * selectWhyState.test.js and buildTape.test.js: a reworded server string reds
 * a row rather than silently re-attributing a sentence.
 */
export const ENGINE_MOTIVE_PREFIXES = Object.freeze([
  'Guardrail override',
  'Risk manager:',
  'Deterministic guardrail enforcement',
]);

/**
 * The two `trades[].source` values under which the TEXT is the only reliable
 * answer, so the prefixes above decide alone: `haiku` (the model wrote it —
 * unless the cron overwrote it on a forced exit, which the prefixes catch)
 * and `guardrail` (ambiguous by construction). Every OTHER source composes its
 * own sentence and is engine-authored whatever the text looks like; listing
 * the two exceptions keeps the default safe — under-crediting the agent is
 * the smaller error under C1.
 */
export const TEXT_DECIDES_SOURCES = Object.freeze(['haiku', 'guardrail']);

/**
 * @param {string|null} text    the rationale
 * @param {string|null} [source] `trades[].source` where the caller has one.
 *   ABSENT on an `evaluations[]` entry — the record carries no provenance
 *   field at all, so there the text is the only signal and is used alone.
 */
export function isEngineAuthoredMotive(text, source = null) {
  if (typeof text === 'string') {
    const trimmed = text.trimStart();
    if (ENGINE_MOTIVE_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) return true;
  }
  if (source == null) return false;
  return !TEXT_DECIDES_SOURCES.includes(source);
}

/** The author label for a quoted rationale (the record carries no source). */
export function motiveAuthorLabel(text, source = null) {
  return isEngineAuthoredMotive(text, source) ? MOTIVE_SYSTEM : MOTIVE_AGENT;
}

// ── The plan at deploy (D-76) — the C1 gates ────────────────────────────────
// Three SYSTEM strings share the deploy plan's keys, and rendering any of them
// under the agent's name would put words in its mouth that no model wrote:
//   (a) the prescribed tournament deploy (`strategyBrief: 'Prescribed
//       tournament deployment'`) — detected by `gameMode`, a battle-level
//       fact, not a string match;
//   (b) the algorithmic FALLBACK portfolio, whose `innerMonologue.strategy`
//       begins `Algorithmic selection …` — no field distinguishes it, so the
//       strategy string IS the gate (brittle by nature; a source tripwire in
//       selectDeployPlan.test.js reds if decide.js rewords it);
//   (a2) the STRATEGY call's own fallback brief (`Automated selection based on
//       …`) — the brief alone is suppressed; the tier rationales on that deploy
//       are genuinely the model's.
export const FALLBACK_STRATEGY_PREFIX = 'Algorithmic selection';
export const FALLBACK_BRIEF_PREFIX = 'Automated selection based on';

const cleanText = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * Gates (a) and (b): true when the WHOLE plan is a system artefact and must
 * not render anywhere.
 * @param {object|null} battle
 * @param {string} tournamentGameMode  the League tournament `gameMode` literal
 *   (passed in, so this module stays zero-import)
 */
export function deployPlanSuppressed(battle, tournamentGameMode) {
  const context = battle?.agentContext;
  if (!context || typeof context !== 'object') return true;
  if (battle?.gameMode === tournamentGameMode) return true;
  const monologue = context.innerMonologue && typeof context.innerMonologue === 'object'
    ? context.innerMonologue
    : {};
  const strategy = cleanText(monologue.strategy);
  return Boolean(strategy && strategy.startsWith(FALLBACK_STRATEGY_PREFIX));
}

/** Gate (a2): the brief, or null when it is the strategy call's fallback (or absent). */
export function deployBriefText(agentContext) {
  const rawBrief = cleanText(agentContext?.strategyBrief);
  return rawBrief && rawBrief.startsWith(FALLBACK_BRIEF_PREFIX) ? null : rawBrief;
}

/** The plan-at-deploy label: every label carries the deploy date (D-76), or nothing. */
export const planAtDeployLabel = (etDateText) => (etDateText ? `The plan at deploy · ${etDateText}` : null);
