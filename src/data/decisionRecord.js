// src/data/decisionRecord.js
//
// THE PERSISTED DECISION RECORD'S SHARED VOCABULARY — one source for the
// client (the Battle View: battleViewCopy.js, selectWhyState.js,
// selectDeployPlan.js; and the League Tournament pane: Flat6BattleView.jsx)
// and the server (the grounded narrator prompt,
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
// formatter itself stays in deskCopy.js), D-80 ruling 1 (a motive as it is
// rendered) and D-99 (the hypothesis field, with its §3.2a duplicate rule) —
// and the honesty rules in
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

/**
 * The FIFTH state (D-70) — a guardrail-FORCED exit whose execution threw.
 * Its gate is three persisted conjuncts, stricter than the fourth state's
 * string prefix, and the two overlap: such an entry carries the
 * SWAP_FAILED_PREFIX as well, and under the fourth state's words would credit
 * the agent with an argument the cron overwrote. `reinforced_haiku` (the agent
 * argued, a guardrail agreed) fails the third conjunct and keeps the fourth
 * state, which is correct: those ARE the agent's words. Shared by the pane
 * (selectWhyState.js re-exports these under their shipped names) and the
 * narrator's YOUR RECORD, so one check cannot get two sentences (BUILD_RULES
 * §9; review R-01).
 */
export const GUARDRAIL_SOURCE_PREFIX = 'guardrail_';
export const GUARDRAIL_FORCED_EXIT = 'forced_exit';
export const GUARDRAIL_FORCED_FAILED_LABEL = 'A guardrail called for a swap · it did not go through';

/**
 * The persisted three-conjunct gate for the fifth state: `downgraded`
 * (checked by the caller) ∧ a `guardrail_` sourceNote ∧ a `forced_exit`
 * override. Returns the override — the pair lives on it, because the entry's
 * own `symbolOut` / `symbolIn` are null on a downgraded HOLD — or null.
 */
export function guardrailForcedExit(evaluation) {
  const note = evaluation?.guardrailSourceNote;
  if (typeof note !== 'string' || !note.startsWith(GUARDRAIL_SOURCE_PREFIX)) return null;
  const overrides = evaluation?.guardrailOverrides;
  if (!Array.isArray(overrides)) return null;
  return overrides.find((o) => o && o.action === GUARDRAIL_FORCED_EXIT) || null;
}

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

const cleanText = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

// ── A motive as it is RENDERED (D-80, ruling 1) ─────────────────────────────
// The words the three ruled guardrail types are called by. C1 says render the
// engine's motive verbatim; hazard 29 / D-64 say a machinery-provenance code
// never reaches a reader. The ruling separates them: the guardrail TYPE is a
// fact a reader can read, so it is translated into the words that guardrail is
// called by, and the sentence keeps its shape — everything after the colon is
// untouched. Any OTHER token — `guardrail_max_sector_weight`, the cron's own
// `hard` fallback, anything added later — loses the parenthetical entirely,
// because a code with no ruled words is not a fact anyone can read.
//
// The three words are NOT invented here: they are the founder's existing
// taxonomy in src/components/League/battleArena/leagueSwapLedger.js:63-69,
// where the same three `exitReason` stamps already render for the League swap
// ledger. A source tripwire in TapeCards.render.test.jsx keeps the two tables
// in step; battleViewCopy.js re-exposes this table under its shipped name
// (`BATTLE_VIEW_COPY.guardrailTypeWords`), so the pane's consumers are
// unchanged.
export const GUARDRAIL_TYPE_WORDS = Object.freeze({
  guardrail_stopLoss: 'stop-loss',
  guardrail_trailingStop: 'trailing stop',
  guardrail_profitTarget: 'profit target',
});

/**
 * The cron's provenance parenthetical, at the head of a forced exit's
 * rationale: `Guardrail override (guardrail_stopLoss): …`
 * (agent-evaluate.js:2124, composing agentGuardrails.js's own
 * `guardrail_${forcedType}` sourceNote).
 *
 * ANCHORED to the `Guardrail override` prefix, deliberately, rather than
 * matching any bracketed token anywhere in an engine sentence: that one
 * composition site is the only place a code is spliced into prose, and a
 * looser rule would eat the numbers the guardrail module's own statusMessage
 * carries — `… breached on GILD (-9.24%).` — or the `(R11)` the suppression
 * pass writes. The token shape is identifier-only for the same reason.
 */
const GUARDRAIL_CODE_PARENTHETICAL = /^(\s*Guardrail override)\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*\)/;

/**
 * The cron's composed prefix wrapping a body that already opens with the same
 * words (review RB-F2). Anchored, and it requires the SECOND `Guardrail
 * override` to start the body — so it only ever removes a duplicate, never a
 * sentence the guardrail wrote about something else.
 */
const GUARDRAIL_DOUBLED_PREFIX = /^(\s*Guardrail override\s*(?:\([^)]*\))?\s*:\s*)(Guardrail override\s*:)/;

/**
 * A motive as it is RENDERED (D-80, ruling 1) — the one renderer the Battle
 * View, the League Tournament pane and the narrator SHARE, so the trade card,
 * the check card, `This piece today`, the book panel, the League pane's `The
 * agent's read` and the grounded prompt's YOUR RECORD block and its RECENT
 * TRADES lines cannot show one sentence two ways (BUILD_RULES §9). It lives
 * here, beside the motive-author rule, for the reason that rule does
 * (voice-grounding hazard 26): the server renders the same check the pane
 * renders and cannot import the pane's modules.
 *
 * The enumeration above is the whole list, and it is now closed: the League
 * Tournament pane (src/components/Tournament/Flat6BattleView.jsx) rendered
 * `evaluations[].rationale` and `.hypothesis` as STORED BYTES on all five of
 * its mount paths until this renderer took them — a League owner read the
 * cron's `guardrail_stopLoss` code and its doubled `Guardrail override:`
 * prefix off the screen. No exception replaces it: a surface that shows a
 * persisted motive shows it through this function.
 *
 * The model's own words pass through untouched (C1) — VERBATIM IS AN
 * AGENT-AUTHORED PROPERTY: only an ENGINE-authored sentence is rewritten, and
 * its provenance parenthetical becomes the guardrail's plain words, or is
 * dropped when the token has none. Everything after the colon is the engine's
 * sentence, verbatim.
 *
 * ONLY AN ENGINE MOTIVE IS REWRITTEN, and that is true BY CONSTRUCTION rather
 * than by a second conjunct: the pattern's anchor, `Guardrail override`, IS
 * `ENGINE_MOTIVE_PREFIXES[0]`, so any text the pattern can match is already
 * engine-authored under the rule above. An `isEngineAuthoredMotive` gate in
 * front of it could never fire — a conjunct that cannot fail is not a guard,
 * and this module does not ship one. `selectWhyState.test.js` pins the two
 * strings together so a rename of the prefix reds rather than silently
 * unhooking the translation.
 *
 * @param {string|null} text  the persisted rationale
 */
export function renderMotive(text) {
  const cleaned = cleanText(text);
  if (cleaned == null) return null;
  // THE CRON'S PREFIX IS REDUNDANT WHENEVER THE GUARDRAIL WROTE THE BODY
  // (review RB-F2). agent-evaluate.js:2124 composes
  // `Guardrail override (${sourceNote}): ${overrideNote}` — and on a forced
  // exit `overrideNote` IS agentGuardrails.js's own statusMessage, which
  // already begins `Guardrail override: ` and already carries the guardrail's
  // name in plain words (`stop-loss at 8%`, `trailing stop at 8% from peak`,
  // `profit target at 8%`, agentGuardrails.js:530-537). Translating the token
  // in place therefore produced a stutter on 100% of forced exits —
  // `Guardrail override (stop-loss): Guardrail override: stop-loss at 8%
  // breached on GILD …` — and D-84's first-sentence collapse then spent the
  // card on the preamble and hid `Forcing exit → MOS.` behind `Read more`.
  //
  // So when the body restates the prefix, the cron's wrapper goes and the
  // guardrail's own sentence stands alone. Still verbatim engine text, still
  // no code on the screen, and it is what ruling 1's `…` was eliding.
  const deduped = cleaned.replace(GUARDRAIL_DOUBLED_PREFIX, '$2');
  return deduped.replace(GUARDRAIL_CODE_PARENTHETICAL, (match, prefix, token) => {
    const words = GUARDRAIL_TYPE_WORDS[token];
    return words ? `${prefix} (${words})` : prefix;
  });
}

// ── The hypothesis field (D-99) — the label and the §3.2a duplicate rule ────
// D-99 amends hazard 29's "never render hypothesis": the field DOES render,
// under one rule — only when present, only when the rationale does not already
// carry it, never where the rationale is engine-authored, and never as a
// forecast anyone is making now. The label carries the whole amendment: the
// prediction is HISTORY (`recorded at this check`) and its outcome is not in
// yet (`graded after the battle`).
//
// These four moved here from api/_utils/voiceLayerGrounding.js, which now
// imports them back and re-exports them under their shipped names, so nothing
// that consumed them changed. That is D-99's own instruction — "when [the
// pane's rendering] lands the label moves to src/data/decisionRecord.js" — and
// the reason is this module's reason: the pane and the narrator render the same
// check, and one check cannot get two sentences (BUILD_RULES §9). The pane that
// landed it is the League Tournament pane, not the A3.7 character pane the
// ruling anticipated; the destination is the same either way, and A3.7 finds
// the label already here.

// The `_…_` wrapper is anchored at word boundaries, as Markdown reads it, so an
// underscore INSIDE an identifier (`threshold_proximity`, `NOW_and_TSLA`) is
// never taken for emphasis — otherwise two sides whose underscore pairing
// differed could miss the duplicate and the hypothesis would render twice
// (review R-14).
const EMPHASIS_WRAPPERS = [
  /\*\*([^*]+)\*\*/g,
  /\*([^*]+)\*/g,
  /(?<!\w)_([^_]+)_(?!\w)/g,
];

/**
 * §3.2a — THE DUPLICATE NORMALIZER, FOR DETECTION ONLY. Stored and displayed
 * bytes are never modified: the rationale is quoted verbatim, markers included
 * (§3.2 "verbatim means bytes"); this decides only whether the `hypothesis`
 * FIELD is already inside it, so the record never renders the prediction twice.
 *
 * For each side: strip Markdown emphasis wrappers (`**…**`, `*…*`, `_…_`) →
 * collapse whitespace → trim → remove one leading `Hypothesis:` (any case, with
 * or without the bold) → compare the remainders.
 */
export function normalizeForDuplicate(text) {
  if (typeof text !== 'string') return '';
  let out = text;
  for (const re of EMPHASIS_WRAPPERS) out = out.replace(re, '$1');
  out = out.replace(/\s+/g, ' ').trim();
  out = out.replace(/^hypothesis:\s*/i, '');
  return out;
}

/**
 * True when the rationale already carries the hypothesis under the §3.2a
 * normalizer — as the whole text or as a passage inside it (the known pair:
 * field `Hypothesis: CF will break out…` vs the rationale's trailing
 * `**Hypothesis: CF will break out…**`).
 */
export function rationaleCarriesHypothesis(rationale, hypothesis) {
  const h = normalizeForDuplicate(hypothesis);
  if (!h) return false;
  const r = normalizeForDuplicate(rationale);
  if (!r) return false;
  return r === h || r.includes(h);
}

/** D-99's label. The prediction is history; its grade is not in yet. */
export const HYPOTHESIS_LABEL = 'Hypothesis recorded at this check (graded after the battle)';

/** The hypothesis field as the record shows it: one leading `Hypothesis:` label dropped, bytes otherwise verbatim. */
export function displayHypothesis(hypothesis) {
  return String(hypothesis).replace(/^\s*hypothesis:\s*/i, '');
}

/**
 * THE D-99 GATE, in one place — the hypothesis a check gets to show, or null.
 * Returns the DISPLAY text only; the caller supplies `HYPOTHESIS_LABEL` in its
 * own frame (the prompt indents a line, the pane sets a style), because the
 * frame is the only part the two surfaces do not share.
 *
 * Three conjuncts, each ruled:
 *   · the field is present at all;
 *   · the rationale is not ENGINE-authored — on the guardrail path the cron
 *     writes its own `Hypothesis: deterministic guardrail enforcement — …`
 *     beside its own rationale, and that is the system's sentence, not a
 *     forecast the check made (review R-12);
 *   · the rationale does not already carry it (§3.2a), so the known
 *     bold-vs-field pair renders once, not twice.
 *
 * AUTHORSHIP IS READ FROM THE RAW RATIONALE, never from a rendered one — the
 * same rule renderMotive's callers follow, for the same reason (BUILD_RULES §9).
 *
 * @param {object|null} evaluation  one persisted `evaluations[]` entry
 */
export function renderHypothesis(evaluation) {
  const hypothesis = evaluation?.hypothesis;
  if (typeof hypothesis !== 'string' || hypothesis.length === 0) return null;
  const rationale = evaluation?.rationale;
  if (isEngineAuthoredMotive(rationale)) return null;
  if (rationaleCarriesHypothesis(rationale, hypothesis)) return null;
  return displayHypothesis(hypothesis);
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

// ── Filing a directive — the strings both surfaces render (voice-layer grounding §6) ──
// The Battle View chat and the League arena both mint directive chips and
// both file through POST /api/agent/file-directive; the words are ONE source
// here so the two surfaces cannot disagree about what a chip does or what
// a filing's outcome was.

/**
 * Stamped top-level on every exchange produced under the voice-layer grounding
 * contract (spec §3.4, M3). ONE home for the version: the server's writers
 * (through voiceLayerGrounding.js) and the client's reader
 * (deriveChatMessages.js) both import it, so neither carries a literal.
 */
export const GROUNDING_VERSION = 1;

/**
 * The persisted `messageType` of a chip filing's audit exchange (spec §6.3,
 * file-directive.js). It carries no narrator words — the ExecutionCard is its
 * whole render — so the chat skips its bubble body and the narrator's history
 * block leaves it out; both key on this one name.
 */
export const DIRECTIVE_FILED_MESSAGE_TYPE = 'directive_filed';

/** A directive chip's label: what it FILES, by mechanism (§6.2). */
export const FILES_CHIP_PREFIX = 'Files: ';
export const filesChip = (text) => (typeof text === 'string' && text ? `${FILES_CHIP_PREFIX}${text}` : null);

/** The D-51 receipt word with its time, or the bare word — `Filed 11:20 AM`. */
export const filedLabel = (timeText) => (timeText ? `Filed ${timeText}` : 'Filed');

// ── Heard (Phase B, D-110) ──────────────────────────────────────────────────
// The receipt's SECOND line, beneath `Filed {time}`, and the one claim the
// tick stamp supports: this thread was in the decider's prompt at that check.
// Never considered, used, noticed, understood, or decided because — the verb
// is not upgraded on any surface, and `deskHonesty.test.js` bans the upgrades.
//
// A check is named by its SLOT (D-83), never the exact minute, so this takes
// already-formatted slot text: the formatter lives in deskCopy.js and this
// module is zero-import on purpose (hazard 26). `filedLabel` takes its time
// the same way, and for the same reason — Filed names an EXCHANGE and keeps
// its minute; Heard names a CHECK and gets the slot.

/** `Heard at the 12:45 check` — the thread was in the decider's prompt there. */
export const heardLabel = (slotText) => (slotText ? `Heard at the ${slotText} check` : null);

/**
 * The negative receipt, SYSTEM-OWNED AND REASONLESS (Sol M-1).
 *
 * A directive existed and the assembler withheld it, so it was not in the
 * prompt. The four resolver reasons — `malformed`, `mode_not_enforce`,
 * `epoch_killed`, `unknown` — never reach a surface: the character never
 * received the withheld directive, so explaining the withholding in its voice
 * would attribute a pre-prompt resolver event to the character. Diagnostics
 * belong in telemetry. No slot either: this is a flat statement of absence,
 * not a stamped fact about a named check.
 */
export const NOT_HEARD_LINE = 'Not heard at this check';

/**
 * The code-owned no-change status (Phase H backstop; directiveGate.js
 * re-exports it): a null-write turn ALWAYS reports no change, whatever the
 * prose said. Rendered by the clients only from the persisted exchange
 * (§6.3: after the write, never from the reply).
 */
export const NO_CHANGE_STATUS_LINE = 'No change made to your strategy this turn.';

// A filing's failure lines say only what the client can be held to (the D-90
// rule): a 404 / 409 / 429 / 422 comes back BEFORE any write (the route's own
// flag is checked before any read; the transaction returns before it updates),
// so those may say nothing was filed; a network failure or a 5xx cannot make
// that claim.
export const FILING_CONFLICT_LINE = 'The current directive changed before this could be filed — nothing was filed.';
export const FILING_BUDGET_LINE = 'No messages left to file with — nothing was filed.';
export const FILING_REJECTED_LINE = 'That option is no longer on the menu — nothing was filed.';
export const FILING_FAILED_LINE = 'The directive could not be filed just now.';

/**
 * The failure line for a filing response's HTTP status.
 *
 * 404 SHARES THE 422 LINE, DELIBERATELY. The route does not exist for a caller
 * the grounding accessor does not resolve to 'on' (file-directive.js check 7),
 * and a chip minted while they DID resolve 'on' outlives that: it is persisted
 * on the exchange, and no client reads the mode, so a canary abort or a
 * walk-back leaves a live-looking chip whose every tap 404s. The catch-all
 * `FILING_FAILED_LINE` says "just now" — it promises a retry that can never
 * work, and on a battle whose chat budget is spent no later exchange arrives to
 * retire the chip. `no longer on the menu — nothing was filed` is true of both
 * causes and is the honest half of what the client can be held to: the option
 * is not available to this caller, and every 404 path here (the flag, a missing
 * battle, a missing agent) returns before any write, so the clause is
 * attestable. A distinct sentence for the two causes is a copy request, not an
 * inline change.
 */
export function filingFailureLine(status) {
  if (status === 409) return FILING_CONFLICT_LINE;
  if (status === 429) return FILING_BUDGET_LINE;
  if (status === 422 || status === 404) return FILING_REJECTED_LINE;
  return FILING_FAILED_LINE;
}

// ── The evidence — "what the check saw" (Phase B, D-111) ────────────────────
//
// THE SECOND VERB, AND ITS EXACT LIMIT. `Saw` = THIS VALUE WAS RENDERED FOR
// THIS HELD NAME IN THE DECIDER'S PROMPT AT THAT CHECK. It is not "the decider
// noticed it", not "weighed it", and above all not "decided because of it":
// the stamps prove VISIBILITY, never CAUSALITY. No surface may say a value
// caused a hold or a swap (Sol's claims audit — "These facts caused the HOLD"
// and "The decider saw X, so it held" both FAIL).
//
// Shared with the narrator's YOUR RECORD block (hazard 26): the pane and the
// prompt render one check's evidence with ONE set of labels, so they cannot
// drift into two vocabularies for one fact.
//
// EIGHT FIELDS MEANS EIGHT (Sol m-1). The shipped set is exactly px, chg,
// atrX, vwapDev, bbPct, nr7, regime, risk. `rsPct` was REMOVED server-side
// because held names never received it in the rendered prompt (it renders for
// bench names only), so there is no ninth slot, no "RS unavailable"
// placeholder and no completeness rule anywhere. Its absence is structural.
// A null metric renders NOTHING — never 0, never a dash, never a placeholder.

/**
 * The four regime words the decider's prompt actually prints
 * (`STOCK REGIMES: NVDA=directional_expansion, …` — the raw token, both in the
 * strategy legend and on the live line). The evidence claim is "this is what
 * the prompt rendered", so the token IS the honest render and translating it
 * to a friendlier word would show something the decider never saw (§9).
 *
 * An unrecognised value renders NOTHING rather than a raw string — the D-81
 * precedent for unruled trigger types, for the same reason: a token this
 * module has no sentence for is not a fact a player can read.
 */
export const REGIME_WORDS = Object.freeze([
  'directional_expansion',
  'directional_contraction',
  'choppy',
  'distressed',
]);

export const regimeWord = (value) => (
  typeof value === 'string' && REGIME_WORDS.includes(value) ? value : null
);

/** `What the 12:45 check saw` — takes formatted slot text (this module is zero-import). */
export const evidenceHeading = (slotText) => (slotText ? `What the ${slotText} check saw` : null);

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** `+2.57` / `-1.20` — the sign is always explicit on a change-like number. */
const signed = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
/** `15th` · `21st` · `12th` — 11/12/13 take `th` whatever their last digit. */
const ordinal = (n) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

/**
 * The eight evidence fields as rendered facts, in a fixed order, NULLS DROPPED.
 *
 * Two carve-outs, both Sol's, and both about not over-claiming:
 *
 *   `chg` IS ALWAYS LABELLED SINCE ENTRY (Sol M-3). The field is the ACTIVE
 *   POSITIONS row's Gain% from ENTRY, not today's move and not the session
 *   change. `Change +2.57%`, `Move +2.57%` and `+2.57% today` all misread it,
 *   and the abbreviated key makes that misreading easy for a future renderer —
 *   so the words "since entry" are part of the label, and §5's copy guard bans
 *   `changed` / `moved` / `today` beside it.
 *
 *   `risk` IS CARVED OUT OF THE BLANKET "SAW" CLAIM (Sol B-1, the BLOCKER).
 *   On an all-HOLD tick the prompt renders NO RISK STATUS block at all — the
 *   block prints only when some position is non-HOLD — so `{ action: 'HOLD' }`
 *   is the engine's verdict conveyed by the block's ABSENCE, not by a line the
 *   decider read. Rendering "Risk HOLD" under a "what the decider saw" heading
 *   would claim a line that was never there, so HOLD IS SILENT HERE. A
 *   non-HOLD action IS supportable and renders. The stored `reason` CODE is
 *   never rendered as seen text either: for a LOCK the prompt carried the
 *   human-readable `detail` sentence while the stamp keeps the compact code,
 *   so "I saw threshold_proximity" is false. The code stays out of this list.
 *
 * @param {Object|null} evidence  one held position's stamp
 * @returns {string[]}            zero or more rendered facts
 */
export function evidenceFactLines(evidence) {
  if (!evidence || typeof evidence !== 'object') return [];
  const out = [];
  const px = num(evidence.px);
  if (px != null) out.push(`Price $${px.toFixed(2)}`);
  const chg = num(evidence.chg);
  if (chg != null) out.push(`Gain since entry ${signed(chg)}%`);
  const atrX = num(evidence.atrX);
  if (atrX != null) out.push(`ATR multiple ${atrX.toFixed(2)}×`);
  const vwapDev = num(evidence.vwapDev);
  if (vwapDev != null) out.push(`VWAP deviation ${signed(vwapDev)}%`);
  const bbPct = num(evidence.bbPct);
  if (bbPct != null) out.push(`Bollinger width ${ordinal(Math.round(bbPct))} %ile`);
  // NR7 is a FLAG: the prompt printed "NR7: YES" or nothing. `false` is not a
  // fact the player needs and `null` is no reading at all — both stay silent.
  if (evidence.nr7 === true) out.push('NR7');
  const regime = regimeWord(evidence.regime);
  if (regime) out.push(`Regime ${regime}`);
  const action = typeof evidence.risk?.action === 'string' ? evidence.risk.action : null;
  if (action && action !== 'HOLD') out.push(`Risk ${action}`);
  return out;
}

/**
 * The provenance line beneath the evidence — PROVENANCE DETAIL, never a
 * freshness promise (Sol M-2).
 *
 * `techAt` is the newest `updatedAt` among the HELD technical documents. It
 * does NOT prove every held symbol's technical context carries that stamp, so
 * "Technical data as of 10:30", "Technicals updated 10:30" and "Data current
 * at 10:30" all overclaim; the honest phrasing names the field for what it is.
 * `fundAsOf` is the FUNDAMENTALS block's own header date across held plus
 * non-crypto bench — not a per-symbol timestamp, and it does not date the
 * eight evidence values. §5's guard bans "technical data as of" outright.
 *
 * `fundAsOf` is a UTC CALENDAR DATE (`YYYY-MM-DD`), so it is formatted in UTC:
 * running it through an ET formatter would render Sep 8 as Sep 7.
 *
 * @param {Object|null} vintages  the entry's one vintages block
 * @param {(iso: string) => string|null} timeText  the caller's instant formatter
 */
export function provenanceLine(vintages, timeText) {
  if (!vintages || typeof vintages !== 'object') return null;
  const parts = [];
  const fundAsOf = typeof vintages.fundAsOf === 'string' ? vintages.fundAsOf : null;
  if (fundAsOf && /^\d{4}-\d{2}-\d{2}$/.test(fundAsOf)) {
    const d = new Date(`${fundAsOf}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      const day = d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
      parts.push(`Fundamentals block as of ${day}`);
    }
  }
  const tech = typeof vintages.techAt === 'string' ? timeText(vintages.techAt) : null;
  if (tech) parts.push(`Latest held technical stamp · ${tech}`);
  const rankings = typeof vintages.rankingsAt === 'string' ? timeText(vintages.rankingsAt) : null;
  if (rankings) parts.push(`Rankings as of ${rankings}`);
  return parts.length ? parts.join(' · ') : null;
}
