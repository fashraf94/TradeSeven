// api/_utils/voiceLayerGrounding.test.js
//
// Voice-layer grounding — the grounded prompt's own pieces, behaviourally
// (spec §10): YOUR RECORD through the pane's motive translator — the agent's
// bytes verbatim, an engine sentence's provenance code never raw; the
// rationale rule printed; the
// hypothesis present / omitted / deduped through the §3.2a normalizer (the
// known bold-vs-field pair); the outage lines for a failed tick (hazard 25);
// the author of every quoted rationale (D-72); the directive line present /
// absent; the fundamentals line, null-honest, with its vintage; the history
// window — marker included, legacy excluded, tags present, the chat turn's
// code default; the plan at deploy behind the pane's gates.
//
// Dependency-surface guard (BUILD_RULES §4): this file's REAL import of the
// module is the runtime guard that its api→src imports (deskCopy.js,
// decisionRecord.js, agentGameModes.js) stay Node-clean. Never mock it.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  GROUNDING_VERSION,
  RECORD_WINDOW,
  HISTORY_WINDOW,
  normalizeForDuplicate,
  rationaleCarriesHypothesis,
  recordStateLabel,
  renderRecordEntry,
  renderCurrentDirective,
  buildYourRecordBlock,
  RECORD_HEADING,
  RECORD_EMPTY_LINE,
  RATIONALE_RULE,
  HYPOTHESIS_LABEL,
  CURRENT_DIRECTIVE_HEADING,
  NO_DIRECTIVE_LINE,
  buildFundamentalsLine,
  vintageDate,
  historyMessageType,
  selectHistoryWindow,
  buildGroundedConversationHistory,
  buildEarlierMessagesBlock,
  EARLIER_MESSAGES_HEADING,
  buildPlanAtDeployBlock,
  GROUNDING_VOCABULARY_GUARD,
  findGuardedVocabulary,
  GROUNDED_OUTPUT_FORMAT,
  normalizeSuggestedActions,
  displayHypothesis,
  GROUNDED_DISCOVERY_EXAMPLE,
  GROUNDED_REFINEMENT_EXAMPLE,
  GROUNDED_MASTERY_EXAMPLE,
} from './voiceLayerGrounding.js';
import {
  MOTIVE_AGENT,
  MOTIVE_SYSTEM,
  NO_DECISION_OUTAGE,
  NO_DECISION_INCOMPLETE,
  DOWNGRADED_LABEL,
  FAILED_LABEL,
  WOKEN_BY_TYPE,
  HELD_LABEL,
  GUARDRAIL_FORCED_FAILED_LABEL,
  GROUNDING_VERSION as SHARED_GROUNDING_VERSION,
  DIRECTIVE_FILED_MESSAGE_TYPE,
  renderMotive,
} from '../../src/data/decisionRecord.js';
import { FROZEN_NOW, EVALUATIONS, CHAT_EXCHANGES, makeBattle, makeTournamentBattle } from './__fixtures__/voiceGroundingFixtures.js';

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(FROZEN_NOW)); });
afterAll(() => { vi.useRealTimers(); });

const byId = (id) => EVALUATIONS.find((e) => e.evalId === id);

describe('§3.2a — the duplicate normalizer (detection only)', () => {
  it('an underscore INSIDE an identifier is not emphasis: the wrapper is anchored at word boundaries (review R-14)', () => {
    expect(normalizeForDuplicate('threshold_proximity on NOW_and_TSLA')).toBe('threshold_proximity on NOW_and_TSLA');
    expect(normalizeForDuplicate('a _real_ emphasis')).toBe('a real emphasis');
    expect(rationaleCarriesHypothesis('a_b c CF_x will break out', 'CF_x will break out')).toBe(true);
  });

  it('strips emphasis wrappers, collapses whitespace, trims, and drops one leading Hypothesis:', () => {
    expect(normalizeForDuplicate('**Hypothesis:   CF will   break out.**')).toBe('CF will break out.');
    expect(normalizeForDuplicate('Hypothesis: CF will break out.')).toBe('CF will break out.');
    expect(normalizeForDuplicate('_hypothesis:_ *CF* will break out.')).toBe('CF will break out.');
    expect(normalizeForDuplicate('  Hypothesis: Hypothesis: twice  ')).toBe('Hypothesis: twice');
    expect(normalizeForDuplicate(null)).toBe('');
  });

  it('THE KNOWN PAIR — field `Hypothesis: CF will break out…` vs inline `**Hypothesis: CF will break out…**` → duplicate', () => {
    const e = byId('eval_005');
    expect(e.rationale).toContain('**Hypothesis: CF will break out');
    expect(e.hypothesis.startsWith('Hypothesis: CF will break out')).toBe(true);
    expect(rationaleCarriesHypothesis(e.rationale, e.hypothesis)).toBe(true);
  });

  it('a hypothesis the rationale does not carry is not a duplicate', () => {
    const e = byId('eval_004');
    expect(rationaleCarriesHypothesis(e.rationale, e.hypothesis)).toBe(false);
    expect(rationaleCarriesHypothesis(e.rationale, '')).toBe(false);
    expect(rationaleCarriesHypothesis(null, e.hypothesis)).toBe(false);
  });

  it('whitespace-only differences are duplicates (the M2 finding the normalizer answers)', () => {
    expect(rationaleCarriesHypothesis('Held.  **Hypothesis:  X   holds.**', 'Hypothesis: X holds.')).toBe(true);
  });
});

describe('§3.2 — one check, rendered', () => {
  it('a HOLD: the slot (D-83), the state, why it was woken (D-81), the rationale BYTES with the author named', () => {
    const lines = renderRecordEntry(byId('eval_005'));
    expect(lines[0]).toBe(`[11:30 AM check] · Held · ${WOKEN_BY_TYPE.threshold_proximity}`);
    // Verbatim means bytes: the markers are still there.
    expect(lines[1]).toBe(`  Rationale — ${MOTIVE_AGENT}: ${byId('eval_005').rationale}`);
    expect(lines[1]).toContain('**Hypothesis: CF will break out');
    // …and the field is NOT rendered a second time (the known pair).
    expect(lines).toHaveLength(2);
    expect(lines.join('\n')).not.toContain(HYPOTHESIS_LABEL);
  });

  it('a SWAP with a distinct hypothesis: the pair and the tier, the rationale, and the field on its own labelled line', () => {
    const lines = renderRecordEntry(byId('eval_004'));
    expect(lines[0]).toBe(`[11:15 AM check] · Swapped · KO → AVGO (Support) · ${WOKEN_BY_TYPE.bench_outperformance}`);
    expect(lines[1]).toBe(`  Rationale — ${MOTIVE_AGENT}: ${byId('eval_004').rationale}`);
    // The field's own leading `Hypothesis:` is dropped for display — the label
    // already says it (review R-12); the bytes after it are verbatim.
    expect(byId('eval_004').hypothesis.startsWith('Hypothesis: ')).toBe(true);
    expect(lines[2]).toBe(`  ${HYPOTHESIS_LABEL}: AVGO closes above its 20-day within two sessions and holds the support slot.`);
    expect(displayHypothesis('**Bold** claim')).toBe('**Bold** claim');
    // Never voiced as the narrator's forecast: the label names the check and the grading.
    expect(HYPOTHESIS_LABEL).toBe('Hypothesis recorded at this check (graded after the battle)');
  });

  it('a guardrail-forced swap that EXECUTED: the words are quoted, and the author is the system (D-72)', () => {
    const lines = renderRecordEntry(byId('eval_003'));
    expect(lines[0]).toBe(`[11:00 AM check] · Swapped · GILD → MOS (Core) · ${WOKEN_BY_TYPE.price_drop}`);
    // The engine's sentence, through the pane's translator (D-80): the
    // machinery-provenance code becomes the words the guardrail is called by,
    // and everything after the colon is the engine's own bytes.
    expect(lines[1]).toBe(`  Rationale — ${MOTIVE_SYSTEM}: ${renderMotive(byId('eval_003').rationale)}`);
    expect(lines[1]).toContain('Guardrail override (stop-loss): stop-loss at 8% breached on GILD (-9.24%). Forcing exit → MOS.');
    // The cron's own `Hypothesis: deterministic guardrail enforcement — …` is
    // the system's sentence, not a forecast the check made: withheld exactly
    // where the rationale is engine-authored (review R-12).
    expect(byId('eval_003').hypothesis).toMatch(/^Hypothesis: deterministic guardrail enforcement/);
    expect(lines).toHaveLength(2);
  });

  it('THE CODE NEVER REACHES THE PROMPT (D-80, hazard 29): a `guardrail_stopLoss` rationale renders translated, everywhere the block is built', () => {
    // The fixture IS the cron's shape (agent-evaluate.js:2121 composing
    // agentGuardrails.js's `guardrail_${forcedType}` sourceNote), so this row
    // fails the moment the record renders the stored bytes again.
    const raw = byId('eval_003').rationale;
    expect(raw).toContain('guardrail_stopLoss');
    const entry = renderRecordEntry(byId('eval_003')).join('\n');
    expect(entry).not.toContain('guardrail_stopLoss');
    expect(entry).not.toContain('guardrail_');
    const block = buildYourRecordBlock({ evaluations: EVALUATIONS, directive: null });
    expect(block).not.toContain('guardrail_');
    // An UNRULED token loses the parenthetical entirely rather than printing a
    // code with no ruled words — the cron's own `hard` fallback included.
    const unruled = renderRecordEntry({
      timestamp: byId('eval_003').timestamp, decision: 'HOLD',
      rationale: 'Guardrail override (guardrail_max_sector_weight): sector cap breached. Forcing exit → MOS.',
    }).join('\n');
    expect(unruled).toContain('Guardrail override: sector cap breached. Forcing exit → MOS.');
    expect(unruled).not.toContain('guardrail_max_sector_weight');
    const hard = renderRecordEntry({
      timestamp: byId('eval_003').timestamp, decision: 'HOLD',
      rationale: 'Guardrail override (hard): hard threshold breach.',
    }).join('\n');
    expect(hard).toContain('Guardrail override: hard threshold breach.');
    expect(hard).not.toContain('(hard)');
  });

  it('VERBATIM IS AN AGENT-AUTHORED PROPERTY (C1): the model\'s own bytes pass through untouched, brackets included', () => {
    // The translator's anchor is `ENGINE_MOTIVE_PREFIXES[0]`, so a model
    // sentence keeps every bracket it typed — including one that LOOKS like a
    // code — and the risk loop's own sentence keeps its bytes too.
    const agent = renderRecordEntry({
      timestamp: byId('eval_003').timestamp, decision: 'HOLD',
      rationale: 'GILD (stopLoss territory, by my read) has stalled at the 200-day.',
    });
    expect(agent[1]).toBe(`  Rationale — ${MOTIVE_AGENT}: GILD (stopLoss territory, by my read) has stalled at the 200-day.`);
    const risk = renderRecordEntry({
      timestamp: byId('eval_003').timestamp, decision: 'HOLD',
      rationale: 'Risk manager: exposure trimmed to the sector cap (-9.24%).',
    });
    expect(risk[1]).toBe(`  Rationale — ${MOTIVE_SYSTEM}: Risk manager: exposure trimmed to the sector cap (-9.24%).`);
    // …and the record's own fixture bytes, markers included, still ride.
    expect(renderRecordEntry(byId('eval_005'))[1]).toContain('**Hypothesis: CF will break out');
  });

  it('the FIFTH state (D-70): a guardrail-forced exit whose execution THREW gets the pane\'s sentence, never the agent\'s (review R-01)', () => {
    // The cron's shape (agent-evaluate.js): the forced exit materialized into the
    // result, `downgraded` + the thrown-swap prefix from executeSwapServer, and
    // the guardrail's own provenance on the entry.
    const forcedThrew = {
      ...byId('eval_003'), decision: 'HOLD', downgraded: true, symbolOut: null, symbolIn: null,
      validationErrors: ['Swap execution failed: executeSwapServer timed out'],
      guardrailSourceNote: 'guardrail_stopLoss',
      guardrailOverrides: [{ action: 'forced_exit', symbol: 'GILD', replacementSymbol: 'MOS' }],
    };
    expect(recordStateLabel(forcedThrew)).toBe(GUARDRAIL_FORCED_FAILED_LABEL);
    expect(renderRecordEntry(forcedThrew)[0]).toBe(`[11:00 AM check] · ${GUARDRAIL_FORCED_FAILED_LABEL} · ${WOKEN_BY_TYPE.price_drop}`);
    // `reinforced_haiku` — the agent argued, a guardrail agreed, the execution
    // threw: no forced_exit override, so those ARE the agent's words (the fourth state).
    const reinforced = { ...forcedThrew, guardrailSourceNote: 'guardrail_reinforced_haiku', guardrailOverrides: [{ action: 'reinforced_haiku' }] };
    expect(recordStateLabel(reinforced)).toBe(FAILED_LABEL);
    // A forced exit that EXECUTED is not downgraded: the ordinary swap sentence, the system as author.
    expect(recordStateLabel(byId('eval_003'))).toBe('Swapped · GILD → MOS (Core)');
  });

  it('a PROPOSAL held the position at the check — `Held`, never a swap (review R-11)', () => {
    expect(recordStateLabel({ ...byId('eval_004'), decision: 'PROPOSAL' })).toBe(HELD_LABEL);
  });

  it('a timed-out tick renders the D-65 absence line and NEVER the cron placeholder as the agent\'s words (hazard 25)', () => {
    const lines = renderRecordEntry(byId('eval_002'));
    expect(lines).toEqual([`[10:45 AM check] · ${NO_DECISION_OUTAGE} · ${WOKEN_BY_TYPE.threshold_proximity}`]);
    expect(lines.join('\n')).not.toContain('Haiku call failed');
  });

  it('a budget-skipped tick renders the D-69 class-neutral line, without the placeholder', () => {
    const lines = renderRecordEntry(byId('eval_001'));
    expect(lines).toEqual([`[10:30 AM check] · ${NO_DECISION_INCOMPLETE} · ${WOKEN_BY_TYPE.forced_open}`]);
    expect(lines.join('\n')).not.toContain('cron budget');
  });

  it('a downgraded entry is labelled by the pane\'s rule: held by a guardrail, or did not go through (D-66)', () => {
    expect(recordStateLabel({ decision: 'HOLD', downgraded: true, validationErrors: ['Guardrail blocked swap'] })).toBe(DOWNGRADED_LABEL);
    expect(recordStateLabel({ decision: 'HOLD', downgraded: true, validationErrors: ['Swap execution failed: boom'] })).toBe(FAILED_LABEL);
    expect(recordStateLabel({ decision: 'SWAP', symbolOut: 'A', symbolIn: 'B', tier: 'star' })).toBe('Swapped · A → B (Star)');
    expect(recordStateLabel({ decision: 'SWAP', symbolOut: 'A', symbolIn: 'B' })).toBe('Swapped · A → B');
    expect(recordStateLabel({ decision: 'HOLD' })).toBe('Held');
  });

  it('an unknown trigger type renders no Woken-by clause, and a missing timestamp a bare check', () => {
    const lines = renderRecordEntry({ decision: 'HOLD', triggers: ['mystery'], rationale: 'Held.' });
    expect(lines[0]).toBe('[check] · Held');
  });
});

describe('§3.2 — the block', () => {
  it('renders the last RECORD_WINDOW checks newest first, the rule, and the directive', () => {
    const block = buildYourRecordBlock({ evaluations: [...EVALUATIONS], directive: makeBattle().directive });
    expect(RECORD_WINDOW).toBe(3);
    expect(block.startsWith(RECORD_HEADING)).toBe(true);
    const i5 = block.indexOf('[11:30 AM check]');
    const i4 = block.indexOf('[11:15 AM check]');
    const i3 = block.indexOf('[11:00 AM check]');
    expect(i5).toBeGreaterThan(0);
    expect(i4).toBeGreaterThan(i5);
    expect(i3).toBeGreaterThan(i4);
    // The two oldest entries are outside the window.
    expect(block).not.toContain('[10:45 AM check]');
    expect(block).not.toContain('[10:30 AM check]');
    expect(block).toContain(RATIONALE_RULE);
    expect(block).toContain(CURRENT_DIRECTIVE_HEADING);
    expect(block).toContain('"Require stronger confirmation before entering" — filed 11:20 AM');
  });

  it('the rule is the spec\'s M1 sentence, verbatim', () => {
    expect(RATIONALE_RULE).toContain('Rationale is historical decider text. It may contain forward-looking language produced by the decision prompt.');
    expect(RATIONALE_RULE).toContain('Never repeat a hypothesis, future action, action condition, intended trade, or plan from inside rationale.');
  });

  it('an empty record is a truthful state, and no directive is a stated absence', () => {
    const block = buildYourRecordBlock({ evaluations: [], directive: null });
    expect(block).toContain(RECORD_EMPTY_LINE);
    expect(block).toContain(NO_DIRECTIVE_LINE);
    expect(buildYourRecordBlock({ evaluations: undefined, directive: undefined })).toContain(RECORD_EMPTY_LINE);
  });

  it('the directive line renders the RESOLVED directive it is handed and never invents one', () => {
    expect(renderCurrentDirective(null)).toBe(NO_DIRECTIVE_LINE);
    expect(renderCurrentDirective({ text: '' })).toBe(NO_DIRECTIVE_LINE);
    expect(renderCurrentDirective({ text: 'Widen the spread (target more sectors)' })).toBe(`${CURRENT_DIRECTIVE_HEADING}\n  "Widen the spread (target more sectors)"`);
  });

  it('every rationale it quotes names its author (hazard 25)', () => {
    const block = buildYourRecordBlock({ evaluations: [...EVALUATIONS], directive: null });
    const quoted = block.split('\n').filter((l) => l.trimStart().startsWith('Rationale — '));
    expect(quoted.length).toBe(3);
    for (const l of quoted) expect(l).toMatch(new RegExp(`Rationale — (${MOTIVE_AGENT}|${MOTIVE_SYSTEM}): `));
  });
});

describe('§3.5 — the fundamentals line', () => {
  it('renders the spec\'s example shape, dated by the vintage, in the spec\'s order', () => {
    const line = buildFundamentalsLine({ trailingPE: { value: 18, sectorMedian: 22 }, revenueGrowthPct: 12, earningsRevisions30d: 47.2, computedAt: Date.parse('2026-09-05T10:00:00Z') });
    expect(line).toBe('Fundamentals (as of Sep 5): EPS revisions +47.2% · revenue growth +12% · P/E 18 vs sector 22');
  });

  it('is null-honest: a missing metric is omitted; no metric → no line; no vintage → no date', () => {
    expect(buildFundamentalsLine({ trailingPE: { value: 11.4 }, beatRate: 75, computedAt: 1756425600000 })).toBe('Fundamentals (as of Aug 28): P/E 11.4 · beat rate 75%');
    expect(buildFundamentalsLine({ computedAt: 1756425600000 })).toBeNull();
    expect(buildFundamentalsLine({ marketCapClass: 'large' })).toBe('Fundamentals: market cap large');
    expect(buildFundamentalsLine(null)).toBeNull();
    expect(buildFundamentalsLine(undefined)).toBeNull();
    expect(buildFundamentalsLine('nope')).toBeNull();
  });

  it('a negative revision keeps its sign and the vintage reads in ET', () => {
    expect(buildFundamentalsLine({ earningsRevisions30d: -3.5, computedAt: Date.parse('2026-09-06T02:30:00Z') })).toBe('Fundamentals (as of Sep 5): EPS revisions -3.5%');
    expect(vintageDate('not a date')).toBeNull();
    expect(vintageDate(null)).toBeNull();
  });
});

describe('§3.4 — the history window', () => {
  const grounded = (ex) => ({ ...ex, groundingVersion: GROUNDING_VERSION });

  it('the chat turn\'s messageType is the code default `user_initiated`; the legacy flag maps to auto_debrief (ruling 23)', () => {
    expect(historyMessageType({ userMessage: 'hi' })).toBe('user_initiated');
    expect(historyMessageType({ isAutoDebrief: true })).toBe('auto_debrief');
    expect(historyMessageType({ messageType: 'anticipation' })).toBe('anticipation');
  });

  it('includes a grounded agent-initiated exchange, excludes a legacy one, keeps every user pair', () => {
    const exchanges = [
      CHAT_EXCHANGES[0],                 // legacy opener — excluded
      CHAT_EXCHANGES[1],                 // user pair
      grounded(CHAT_EXCHANGES[2]),       // grounded anticipation — included
      CHAT_EXCHANGES[3],                 // user pair (directive)
    ];
    const { pairs, agentLines } = selectHistoryWindow(exchanges);
    expect(pairs.map((p) => p.userMessage)).toEqual(['How are we looking?', 'Tighten up — stronger confirmation before you add anything.']);
    expect(agentLines).toHaveLength(1);
    expect(agentLines[0].type).toBe('anticipation');
  });

  it('the conversation array alternates and tags every assistant line by messageType', () => {
    const history = buildGroundedConversationHistory([CHAT_EXCHANGES[1], grounded(CHAT_EXCHANGES[2]), CHAT_EXCHANGES[3]]);
    expect(history.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(history[1].content).toBe('[user_initiated] CF is carrying the book; KO is the drag.');
    expect(history[3].content.startsWith('[user_initiated] ')).toBe(true);
    // The agent-initiated line never enters the array (Gemma rejects consecutive same-role messages).
    expect(history.some((m) => m.content.includes('Eyeing AVGO'))).toBe(false);
  });

  it('the earlier-messages block carries the grounded agent lines with their tag and ET time, newest last', () => {
    const block = buildEarlierMessagesBlock([
      grounded(CHAT_EXCHANGES[0]),
      CHAT_EXCHANGES[1],
      grounded(CHAT_EXCHANGES[2]),
    ]);
    expect(block.startsWith(EARLIER_MESSAGES_HEADING)).toBe(true);
    const lines = block.split('\n').slice(1);
    expect(lines[0]).toBe("[first_message · 9:31 AM] Agent's live. I'm leaning into semis today — CF and AVGO specifically.");
    expect(lines[1]).toBe('[anticipation · 10:16 AM] Eyeing AVGO on the bench. If it holds the 20-day I would rotate it into Core.');
  });

  it('a chip filing never enters the block — the USER tapped it, so it is not one the narrator started; the CURRENT DIRECTIVE line carries what it filed (review R-13)', () => {
    const filed = {
      userMessage: null, agentResponse: '', hasDirective: true, messageType: DIRECTIVE_FILED_MESSAGE_TYPE, source: 'chip',
      directive: { text: 'Widen the spread (target more sectors)', expiry: 'end_of_battle', directiveThreadId: 't-1', adjustmentId: 'DV-02', canonicalTextVersion: 1 },
      directiveThreadId: 't-1', timestamp: '2026-09-08T15:20:00.000Z', groundingVersion: GROUNDING_VERSION,
    };
    expect(buildEarlierMessagesBlock([filed])).toBeNull();
    expect(selectHistoryWindow([filed]).pairs).toEqual([]);
    // Beside a grounded note, only the note is the narrator's.
    const block = buildEarlierMessagesBlock([grounded(CHAT_EXCHANGES[2]), filed]);
    expect(block.split('\n')).toHaveLength(2);
    expect(block).not.toContain('Widen the spread');
  });

  it('the marker version and the filing type are the SHARED constants (decisionRecord.js), never a second literal', () => {
    expect(GROUNDING_VERSION).toBe(SHARED_GROUNDING_VERSION);
    expect(GROUNDING_VERSION).toBe(1);
    expect(DIRECTIVE_FILED_MESSAGE_TYPE).toBe('directive_filed');
  });

  it('a legacy proactive exchange (no marker) never reaches the block; none → null', () => {
    expect(buildEarlierMessagesBlock([CHAT_EXCHANGES[0], CHAT_EXCHANGES[2]])).toBeNull();
    expect(buildEarlierMessagesBlock([])).toBeNull();
    expect(buildEarlierMessagesBlock(null)).toBeNull();
    // A marker of the wrong version is not the marker.
    expect(buildEarlierMessagesBlock([{ ...CHAT_EXCHANGES[2], groundingVersion: 2 }])).toBeNull();
    expect(buildEarlierMessagesBlock([{ ...CHAT_EXCHANGES[2], groundingVersion: '1' }])).toBeNull();
  });

  it('the window is the last HISTORY_WINDOW exchanges of ANY kind', () => {
    expect(HISTORY_WINDOW).toBe(10);
    const filler = Array.from({ length: 12 }, (_, i) => ({ userMessage: `q${i}`, agentResponse: `a${i}` }));
    const { pairs } = selectHistoryWindow([grounded(CHAT_EXCHANGES[2]), ...filler]);
    expect(pairs).toHaveLength(10);
    expect(pairs[0].userMessage).toBe('q2');
    // The grounded line fell out of the window with the two oldest pairs.
    expect(selectHistoryWindow([grounded(CHAT_EXCHANGES[2]), ...filler]).agentLines).toHaveLength(0);
  });
});

describe('D-76 — the plan at deploy (the opener)', () => {
  it('renders the persisted brief, dated, as history', () => {
    const battle = makeBattle({ createdAt: '2026-09-08T13:31:00.000Z', agentContext: { archetype: 'momentum_chaser', strategyBrief: 'Semis lead; the book rides the leaders.', innerMonologue: { strategy: 'Lean into strength.' } } });
    expect(buildPlanAtDeployBlock(battle)).toBe('THE PLAN AT DEPLOY — The plan at deploy · Sep 8 (the deploy decision\'s own recorded output; history, never current intent):\n"Semis lead; the book rides the leaders."');
  });

  it('is gated off a tournament battle, the algorithmic fallback, the strategy fallback, and an undated doc', () => {
    const ctx = { archetype: 'momentum_chaser', strategyBrief: 'Semis lead.', innerMonologue: { strategy: 'Lean in.' } };
    expect(buildPlanAtDeployBlock(makeTournamentBattle({ createdAt: '2026-09-08T13:31:00.000Z', agentContext: ctx }))).toBeNull();
    expect(buildPlanAtDeployBlock(makeBattle({ createdAt: '2026-09-08T13:31:00.000Z', agentContext: { ...ctx, innerMonologue: { strategy: 'Algorithmic selection based on BaggerBomb fitness scores' } } }))).toBeNull();
    expect(buildPlanAtDeployBlock(makeBattle({ createdAt: '2026-09-08T13:31:00.000Z', agentContext: { ...ctx, strategyBrief: 'Automated selection based on archetype fitness scores.' } }))).toBeNull();
    expect(buildPlanAtDeployBlock(makeBattle({ agentContext: ctx }))).toBeNull();
    expect(buildPlanAtDeployBlock(makeBattle({ createdAt: '2026-09-08T13:31:00.000Z', agentContext: { archetype: 'x' } }))).toBeNull();
  });

  it('prefers activatedAt over createdAt for the date, and accepts a Firestore-style timestamp', () => {
    const ctx = { strategyBrief: 'Semis lead.', innerMonologue: {} };
    expect(buildPlanAtDeployBlock(makeBattle({ activatedAt: '2026-09-09T13:31:00.000Z', createdAt: '2026-09-08T13:31:00.000Z', agentContext: ctx }))).toContain('Sep 9');
    expect(buildPlanAtDeployBlock(makeBattle({ createdAt: { toDate: () => new Date('2026-09-08T13:31:00.000Z') }, agentContext: ctx }))).toContain('Sep 8');
  });
});

describe('the vocabulary guard — 30 sites, each with a real phrase', () => {
  it('lists exactly thirty sites, numbered 1..30, each with at least one phrase and a surface', () => {
    expect(GROUNDING_VOCABULARY_GUARD).toHaveLength(30);
    expect(GROUNDING_VOCABULARY_GUARD.map((e) => e.site)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    for (const e of GROUNDING_VOCABULARY_GUARD) {
      expect(e.phrases.length).toBeGreaterThan(0);
      expect(['battle', 'firstMessage', 'anticipation', 'templateOpener', 'elicitation', 'tradeNarration']).toContain(e.surface);
    }
  });

  it('findGuardedVocabulary reports every hit and nothing on clean text', () => {
    expect(findGuardedVocabulary("Eyeing CRWD on the bench. I'm rotating out.")).toEqual([
      { site: 19, phrase: 'Eyeing CRWD on the bench.' },
      { site: 22, phrase: "I'm rotating out." },
    ]);
    expect(findGuardedVocabulary('The record shows the 11:30 check held.')).toEqual([]);
    expect(findGuardedVocabulary(null)).toEqual([]);
  });
});

// ==================== §6.2 — chips minted by id ====================

describe('§6.2 — the grounded output format and the server\'s rewrite of the chips', () => {
  it('asks for a directive chip BY ID from the menu and a question as the only other kind', () => {
    expect(GROUNDED_OUTPUT_FORMAT).toContain('{ "kind": "directive", "id": "<one id from YOUR MENU>" }');
    expect(GROUNDED_OUTPUT_FORMAT).toContain('{ "kind": "ask", "text": "A question the user can send you next" }');
    expect(GROUNDED_OUTPUT_FORMAT).toContain('its text is the item\'s canonical text, which the system writes, never you');
    expect(GROUNDED_OUTPUT_FORMAT).toContain('If YOUR MENU is not in this prompt, every option is a question.');
    // The shipped rules it must keep (the JSON contract, the no-numbers rule, the commit rule).
    for (const kept of ['_scratchpad MUST come first', 'NEVER quote raw data numbers', 'Never generate suggested actions on a directive-commit response', 'You MUST return valid JSON in every response']) {
      expect(GROUNDED_OUTPUT_FORMAT).toContain(kept);
    }
    expect(findGuardedVocabulary(GROUNDED_OUTPUT_FORMAT)).toEqual([]);
  });

  it('rewrites a directive chip\'s text to the canonical text of the SERVER-DERIVED archetype\'s menu', () => {
    expect(normalizeSuggestedActions([{ kind: 'directive', id: 'TF-02', text: 'the model\'s own words' }], 'momentum_chaser')).toEqual([
      { kind: 'directive', id: 'TF-02', text: 'Require stronger confirmation before entering' },
    ]);
    expect(normalizeSuggestedActions([{ kind: 'directive', id: ' DV-02 ' }], 'diversifier')).toEqual([
      { kind: 'directive', id: 'DV-02', text: 'Widen the spread (target more sectors)' },
    ]);
  });

  it('drops an off-menu id, a duplicate, an unknown kind, an empty text, and a missing archetype — null when nothing survives', () => {
    expect(normalizeSuggestedActions([{ kind: 'directive', id: 'DV-02' }], 'momentum_chaser')).toBeNull();
    expect(normalizeSuggestedActions([{ kind: 'directive', id: 'TF-02' }, { kind: 'directive', id: 'TF-02' }], 'momentum_chaser')).toHaveLength(1);
    expect(normalizeSuggestedActions([{ kind: 'weather', text: 'sunny' }, { kind: 'ask', text: '   ' }, '', null, 42], 'momentum_chaser')).toBeNull();
    expect(normalizeSuggestedActions([{ kind: 'directive', id: 'TF-02' }], null)).toBeNull();
    expect(normalizeSuggestedActions([{ kind: 'directive', id: 'TF-02' }], 'strategist')).toBeNull();
    expect(normalizeSuggestedActions(null, 'momentum_chaser')).toBeNull();
    expect(normalizeSuggestedActions('TF-02', 'momentum_chaser')).toBeNull();
  });

  it('a string is a question (the legacy shape), an ask chip keeps its text trimmed, order is preserved', () => {
    expect(normalizeSuggestedActions(['  Show me the checks ', { kind: 'ask', text: ' Why? ' }, { kind: 'directive', id: 'TF-01' }], 'momentum_chaser')).toEqual([
      { kind: 'ask', text: 'Show me the checks' },
      { kind: 'ask', text: 'Why?' },
      { kind: 'directive', id: 'TF-01', text: 'Prefer fresh breakouts over extended / late-stage entries' },
    ]);
  });
});

describe('§4 — the grounded few-shot examples mint no filing claim (review R-03)', () => {
  const chipsOf = (example) => {
    const json = example.slice(example.lastIndexOf('Agent: {') + 'Agent: '.length);
    return JSON.parse(json).suggestedActions;
  };
  it('every chip in every example is a QUESTION object — never a string, never `File: …`, never a menu id the archetype may not have', () => {
    for (const example of [GROUNDED_REFINEMENT_EXAMPLE, GROUNDED_MASTERY_EXAMPLE]) {
      const chips = chipsOf(example);
      expect(Array.isArray(chips) && chips.length >= 2).toBe(true);
      for (const chip of chips) {
        expect(typeof chip).toBe('object');
        expect(chip.kind).toBe('ask');
        expect(chip.text).not.toMatch(/^Files?:/);
      }
      // Normalized, they stay questions: nothing here can be tapped into a filing.
      expect(normalizeSuggestedActions(chips, 'momentum_chaser').every((c) => c.kind === 'ask')).toBe(true);
    }
    expect(chipsOf(GROUNDED_DISCOVERY_EXAMPLE)).toBeNull();
  });
});
