// api/scripts/voice-grounding-harness.test.js
//
// The paired harness's PURE half (spec §9 gate 1). Everything the report says
// about a pair is computed here; the network is exercised only through an
// injected `call`, so no row in this file reaches OpenRouter.
//
// Dependency-surface guard (BUILD_RULES §4): this file's import of the module
// under test is the runtime guard that the harness's imports stay Node-clean —
// it pulls the SHIPPED lint (voiceLayerGrounding.js), the SHIPPED per-call
// budget (chat.js) and the SHIPPED prompt builder into a Node process. Never
// mock it.

import { describe, it, expect, vi } from 'vitest';
import { REPLY_LINT_RE } from '../_utils/voiceLayerGrounding.js';
import { MOTIVE_AGENT, MOTIVE_SYSTEM } from '../../src/data/decisionRecord.js';
import { GEMMA_TIMEOUT_MS, TURN_DEADLINE_MS } from '../agent/chat.js';
import { resolveVoiceGroundingMode } from '../../src/config/featureFlags.js';
import {
  DEFAULT_PAIRS,
  HOSTILE_RATIONALE,
  HOSTILE_USER_MESSAGE,
  REQUIRED_REPLY_KEYS,
  ECHO_SHINGLE,
  persistedReplySide,
  replyLintHits,
  extractRecordRationales,
  extractForwardClauses,
  normalizeForEcho,
  shingles,
  rationaleForwardEchoes,
  schemaAdherence,
  replyText,
  isPairRecord,
  selectPairs,
  pairFromRecord,
  hostileEvaluations,
  buildHostilePair,
  scoreSide,
  summarizeSide,
  renderReport,
  replay,
  runPairs,
  parseHarnessArgs,
  defaultOutPath,
} from './voice-grounding-harness.js';

const NOW = new Date('2026-09-08T15:47:00.000Z');

// ==================== the reply lint, as a measurement ====================

describe('voice-grounding-harness — replyLintHits', () => {
  it('counts every hit, where the shipped predicate only answers yes/no', () => {
    const text = "I'm rotating out of CF and watching AVGO; I'll rotate again if breadth widens.";
    const hits = replyLintHits(text);
    expect(hits).toEqual(["I'm rotating", 'watching', "I'll rotate"]);
    // The shipped RE is the source: a boolean where the harness needs a count.
    expect(REPLY_LINT_RE.test(text)).toBe(true);
  });

  it('is empty on a clean reply and on a non-string', () => {
    expect(replyLintHits('At the 12:45 check the process held the book.')).toEqual([]);
    expect(replyLintHits('')).toEqual([]);
    expect(replyLintHits(null)).toEqual([]);
  });

  it('does not carry lastIndex between calls (a fresh pattern per call)', () => {
    const text = 'watching';
    expect(replyLintHits(text)).toHaveLength(1);
    expect(replyLintHits(text)).toHaveLength(1);
  });

  it('is CASE-INSENSITIVE — a reply that opens a sentence with the phrase still counts', () => {
    // Every other fixture happens to match the pattern's own casing, so
    // dropping the `i` flag left 60/60 green while a reply beginning
    // "Watching AVGO…" silently stopped counting.
    expect(replyLintHits('Watching AVGO into the close.')).toEqual(['Watching']);
    expect(replyLintHits("I'M ROTATING out of CF.")).toEqual(["I'M ROTATING"]);
    expect(replyLintHits('KEEP AN EYE on the bench.')).toEqual(['KEEP AN EYE']);
  });
});

// ==================== the rationale, out of the prompt ====================

describe('voice-grounding-harness — extractRecordRationales', () => {
  const PROMPT = [
    'YOUR RECORD (the last 3 checks, newest first — history, not a plan)',
    '[12:45 PM check] Held · woken by a bench name outrunning the book',
    `  Rationale — ${MOTIVE_AGENT}: CF is pressing its Level 2 line. I'll rotate when breadth widens.`,
    '[12:30 PM check] Swapped GILD → MOS (Core)',
    `  Rationale — ${MOTIVE_SYSTEM}: Guardrail override (guardrail_stopLoss): stop breached on GILD.`,
    'CURRENT DIRECTIVE: none filed.',
  ].join('\n');

  it('reads both author labels, in prompt order', () => {
    expect(extractRecordRationales(PROMPT)).toEqual([
      "CF is pressing its Level 2 line. I'll rotate when breadth widens.",
      'Guardrail override (guardrail_stopLoss): stop breached on GILD.',
    ]);
  });

  it('ignores lines that are not the record renderer\'s rationale line', () => {
    expect(extractRecordRationales('Rationale: not the rendered shape')).toEqual([]);
    expect(extractRecordRationales(`Rationale — ${MOTIVE_AGENT}: no leading indent`)).toEqual([]);
    expect(extractRecordRationales('')).toEqual([]);
    expect(extractRecordRationales(null)).toEqual([]);
  });

  it('finds the rationale in a prompt the production builder actually assembled', () => {
    const pair = buildHostilePair();
    expect(extractRecordRationales(pair.new.systemPrompt)).toContain(HOSTILE_RATIONALE);
  });
});

// ==================== the forward-language scorer ====================

describe('voice-grounding-harness — extractForwardClauses', () => {
  it('keeps only the forward-bearing sentences of the hostile rationale', () => {
    const clauses = extractForwardClauses(HOSTILE_RATIONALE);
    expect(clauses).toHaveLength(3);
    expect(clauses[0]).toContain("I'll rotate the support slot");
    expect(clauses[1]).toContain('then I would swap it into Core');
    expect(clauses[2]).toMatch(/^Hypothesis:/);
    // The completed-decision sentence — the ONE the narrator may quote — is not a clause.
    expect(clauses.join(' ')).not.toContain('nothing on the bench outranks what I hold');
  });

  it('finds nothing in a purely historical rationale', () => {
    expect(extractForwardClauses('Held the book: CF led its sector and the bench did not outrank it.')).toEqual([]);
  });

  it('catches every marker in the set, not only the three the hostile fixture uses', () => {
    // Deleting five of the markers left 60/60 green: only `Hypothesis:`,
    // "I'll" and "if … then" were ever exercised. One row per form.
    const forward = [
      'Hypothesis: CF breaks out before the close',
      "I'll rotate the support slot",
      "I'd swap AVGO into Core",
      'I will rotate the support slot',
      'I would swap AVGO into Core',
      'We will rotate the support slot',
      'If AVGO clears its 20-day then I act',
      'If AVGO clears its 20-day, the slot changes',
      'I expect AVGO to lead into the close',
      'The plan is to rotate the support slot',
      'I plan to rotate the support slot',
      'I intend to rotate the support slot',
      'I am going to rotate the support slot',
      'The book would swap AVGO for NOW',
      'The next check will reprice the book',
    ];
    for (const sentence of forward) {
      expect(extractForwardClauses(`${sentence}.`), sentence).toEqual([sentence]);
    }
  });

  it('does NOT fire on the plain words "ill" and "id" — a false positive is worse than a miss', () => {
    // The apostrophe used to be optional, so `\bi(?:\'|’)?ll\b` matched "ill".
    // A false positive inflates the clause set the OLD control column is scored
    // against too, and tells the founder a historical sentence is a promise.
    expect(extractForwardClauses('The exit was ill-timed and the book bled into the close.')).toEqual([]);
    expect(extractForwardClauses('Trade id 4471 was reconciled against the ledger.')).toEqual([]);
    expect(extractForwardClauses('The fill was ill served by the spread.')).toEqual([]);
  });

  it('strips the clause\'s terminator, so a short clause can match mid-sentence', () => {
    // normalizeForEcho keeps `.` (so $145.50 survives), which glued the full
    // stop to the clause's last word: an exact match then required the reply to
    // END its sentence at the same word, and for a clause of <= 5 words the
    // shingle fallback IS the exact check. "I'll rotate." scored ZERO against
    // a reply that repeated it verbatim and kept going.
    expect(extractForwardClauses("I'll rotate.")).toEqual(["I'll rotate"]);
    expect(rationaleForwardEchoes(["I'll rotate."], "I'll rotate the support slot as soon as breadth widens.").hitCount).toBe(1);
    expect(rationaleForwardEchoes(['I will swap AVGO.'], 'The note says I will swap AVGO into Core at the next check.').hitCount).toBe(1);
  });

  it('reads a MULTI-LINE rationale whole — the record renders the stored bytes verbatim', () => {
    const prompt = [
      'YOUR RECORD',
      `  Rationale — ${MOTIVE_AGENT}: Held the book into the close.`,
      "I'll rotate the support slot the moment breadth widens.",
      '',
      'CURRENT DIRECTIVE: none filed.',
    ].join('\n');
    const [rationale] = extractRecordRationales(prompt);
    expect(rationale).toContain('Held the book into the close.');
    expect(rationale).toContain("I'll rotate the support slot");
    expect(rationaleForwardEchoes([rationale], "I'll rotate the support slot the moment breadth widens.").hitCount).toBe(1);
  });

  it('is empty for a non-string or blank rationale', () => {
    expect(extractForwardClauses(null)).toEqual([]);
    expect(extractForwardClauses('   ')).toEqual([]);
  });
});

describe('voice-grounding-harness — normalizeForEcho / shingles', () => {
  it('strips emphasis, case, and punctuation but keeps the words and the figures', () => {
    expect(normalizeForEcho('**Hypothesis:** CF clears $145, then I’d rotate!'))
      .toBe("hypothesis  cf clears $145 then i'd rotate".replace(/\s+/g, ' '));
  });

  it('is empty for a non-string', () => {
    expect(normalizeForEcho(undefined)).toBe('');
  });

  it('strips the emphasis WRAPPER, not just its characters — adjacent emphasis joins', () => {
    // Deleting the emphasis pass left 60/60 green because the punctuation
    // flattener turns `**X**` into ` X ` anyway when it stands alone. It
    // diverges when the emphasis is glued to its neighbours, which is exactly
    // how the stored rationale writes it.
    expect(normalizeForEcho('the **bold**text case')).toBe('the boldtext case');
    expect(normalizeForEcho('rotate **into**Core now')).toBe('rotate intocore now');
    // Standing alone the flattener would mask the missing strip (`**X**` → ` X `),
    // which is why the two rows above are glued.
    expect(normalizeForEcho('rotate **into Core** now')).toBe('rotate into core now');
  });

  it('shingles a normalized string into n-word runs', () => {
    expect(shingles('a b c d', 2)).toEqual(['a b', 'b c', 'c d']);
    expect(shingles('a b', 5)).toEqual(['a b']);   // shorter than n → the whole string
    expect(shingles('', 3)).toEqual([]);
  });
});

describe('voice-grounding-harness — rationaleForwardEchoes (the scored dimension)', () => {
  it('scores an exact repetition of the rationale\'s action conditional', () => {
    const reply = 'If AVGO clears its 20-day on the next test then I would swap it into Core.';
    const { hits, hitCount, clauses } = rationaleForwardEchoes([HOSTILE_RATIONALE], reply);
    expect(clauses).toHaveLength(3);
    expect(hitCount).toBe(1);
    expect(hits[0].kind).toBe('exact');
  });

  it('scores a near-repetition through the 5-word shingle', () => {
    const reply = 'The note says I would swap it into Core when that happens, which I am not promising.';
    const { hits, hitCount } = rationaleForwardEchoes([HOSTILE_RATIONALE], reply);
    expect(hitCount).toBe(1);
    expect(hits[0].kind).toBe('shingle');
    expect(hits[0].evidence).toBe('i would swap it into'); // the first 5-word run the reply shares
  });

  it('scores ZERO on the compliant answer — the historical fact, no forward clause', () => {
    const reply = 'I do not know what the next check will decide. At the 12:45 check the process held the book because CF was still leading its sector.';
    expect(rationaleForwardEchoes([HOSTILE_RATIONALE], reply).hitCount).toBe(0);
  });

  it('is emphasis- and case-blind, so a bolded hypothesis is still caught', () => {
    const reply = '**HYPOTHESIS: CF breaks out above its 2x ATR line before the close and banks the bonus tier.**';
    expect(rationaleForwardEchoes([HOSTILE_RATIONALE], reply).hitCount).toBe(1);
  });

  it('reports the clauses even when the reply repeats none of them', () => {
    const { clauses, hits } = rationaleForwardEchoes([HOSTILE_RATIONALE], 'Nothing to add.');
    expect(clauses).toHaveLength(3);
    expect(hits).toEqual([]);
  });

  it('takes a bare string, an array, and tolerates junk entries', () => {
    expect(rationaleForwardEchoes(HOSTILE_RATIONALE, "I'll rotate the support slot the moment breadth widens.").hitCount).toBe(1);
    expect(rationaleForwardEchoes([null, undefined, ''], 'anything').clauses).toEqual([]);
  });

  it('de-duplicates a clause carried by two record entries', () => {
    const { clauses } = rationaleForwardEchoes([HOSTILE_RATIONALE, HOSTILE_RATIONALE], '');
    expect(clauses).toHaveLength(3);
  });
});

// ==================== schema adherence ====================

describe('voice-grounding-harness — schemaAdherence', () => {
  it('accepts the shape the output format demands', () => {
    expect(schemaAdherence({ _scratchpad: 'read', response: 'hi', hasDirective: false })).toEqual({ valid: true, reason: null, missing: [] });
  });

  it('requires _scratchpad — both formats say it MUST come first', () => {
    expect(schemaAdherence({ response: 'hi', hasDirective: false }))
      .toMatchObject({ valid: false, reason: 'missing_keys', missing: ['_scratchpad'] });
  });

  it('a reply that CLAIMS a directive and ships none is invalid', () => {
    expect(schemaAdherence({ _scratchpad: 'r', response: 'Filed it.', hasDirective: true, directive: null }))
      .toMatchObject({ valid: false, reason: 'hasDirective_without_directive' });
    expect(schemaAdherence({ _scratchpad: 'r', response: 'Filed it.', hasDirective: true, directive: { text: 'x', expiry: 'end_of_battle' } }).valid).toBe(true);
  });

  it('each directive reason is TRUE of the case it names — production files a string', () => {
    // chat.js's normalizeDirective ACCEPTS a bare string and files it, so
    // calling that "hasDirective_without_directive" was a lie about what
    // happened: it is a format deviation, not a false receipt.
    expect(schemaAdherence({ _scratchpad: 'r', response: 'Filed it.', hasDirective: true, directive: 'Lean toward semis with confirmed volume.' }))
      .toMatchObject({ valid: false, reason: 'directive_not_an_object' });
    // An object with no text IS a false receipt — normalizeDirective returns null.
    expect(schemaAdherence({ _scratchpad: 'r', response: 'Filed it.', hasDirective: true, directive: { expiry: 'end_of_battle' } }))
      .toMatchObject({ valid: false, reason: 'directive_without_text' });
    expect(schemaAdherence({ _scratchpad: 'r', response: 'Filed it.', hasDirective: true, directive: '   ' }))
      .toMatchObject({ valid: false, reason: 'hasDirective_without_directive' });
  });

  it('on the GROUNDED side a legacy string chip is a regression, not a tolerated shape', () => {
    const legacy = { _scratchpad: 'r', response: 'Two options.', hasDirective: false, suggestedActions: ['Widen the spread', 'Stay concentrated'] };
    // §6.2 replaced string chips with `{kind, id|text}`. The old prompt still
    // asks for strings, so the old side must accept what the new side rejects.
    expect(schemaAdherence(legacy, { grounded: false }).valid).toBe(true);
    expect(schemaAdherence(legacy, { grounded: true }))
      .toMatchObject({ valid: false, reason: 'suggestedActions_legacy_string_chip' });
  });

  it('a grounded directive chip must name an id; an ask chip must carry text', () => {
    const g = { grounded: true };
    expect(schemaAdherence({ _scratchpad: 'r', response: 'x', hasDirective: false, suggestedActions: [{ kind: 'directive' }] }, g))
      .toMatchObject({ valid: false, reason: 'directive_chip_without_id' });
    expect(schemaAdherence({ _scratchpad: 'r', response: 'x', hasDirective: false, suggestedActions: [{ kind: 'ask', text: '  ' }] }, g))
      .toMatchObject({ valid: false, reason: 'ask_chip_without_text' });
    expect(schemaAdherence({ _scratchpad: 'r', response: 'x', hasDirective: false, suggestedActions: [{ kind: 'nope' }] }, g))
      .toMatchObject({ valid: false, reason: 'suggestedActions_unknown_kind' });
    expect(schemaAdherence({ _scratchpad: 'r', response: 'x', hasDirective: false, suggestedActions: 'chips' }, g))
      .toMatchObject({ valid: false, reason: 'suggestedActions_not_array' });
    // The shapes the grounded format DOES want.
    expect(schemaAdherence({ _scratchpad: 'r', response: 'x', hasDirective: false, suggestedActions: [{ kind: 'directive', id: 'DV-02' }, { kind: 'ask', text: 'Why?' }] }, g).valid).toBe(true);
    expect(schemaAdherence({ _scratchpad: 'r', response: 'x', hasDirective: false, suggestedActions: null }, g).valid).toBe(true);
  });

  it('names a tier-4 parse failure with the parser\'s own reason', () => {
    expect(schemaAdherence({ parseError: true, errorReason: 'plaintext_passthrough' }))
      .toMatchObject({ valid: false, reason: 'parse_plaintext_passthrough' });
  });

  it('names the missing keys, the empty response, and the wrong type', () => {
    expect(schemaAdherence({ _scratchpad: 'r', response: 'hi' })).toMatchObject({ valid: false, reason: 'missing_keys', missing: ['hasDirective'] });
    expect(schemaAdherence({ _scratchpad: 'r', response: '   ', hasDirective: false })).toMatchObject({ valid: false, reason: 'empty_response' });
    expect(schemaAdherence({ _scratchpad: 'r', response: 'hi', hasDirective: 'yes' })).toMatchObject({ valid: false, reason: 'hasDirective_not_boolean' });
    expect(schemaAdherence(null)).toMatchObject({ valid: false, reason: 'not_an_object', missing: [...REQUIRED_REPLY_KEYS] });
  });

  it('replyText returns the user-visible half, or an empty string', () => {
    expect(replyText({ response: 'hello' })).toBe('hello');
    expect(replyText({ parseError: true })).toBe('');
    expect(replyText(null)).toBe('');
  });
});

// ==================== selection ====================

const shadowRecord = (over = {}) => ({
  _loggedAt: '2026-09-08T15:00:00.000Z',
  voiceGroundingMode: 'shadow',
  userMessage: 'whats the read',
  agentMessage: 'The book held.',
  systemPromptOld: 'OLD PROMPT',
  systemPromptNew: 'NEW PROMPT',
  conversationHistoryOld: [{ role: 'user', content: 'earlier' }],
  conversationHistoryNew: [{ role: 'user', content: 'earlier' }],
  ...over,
});

describe('voice-grounding-harness — selection', () => {
  it('a record is a pair only when it carries BOTH prompts and a user turn', () => {
    expect(isPairRecord(shadowRecord())).toBe(true);
    expect(isPairRecord(shadowRecord({ systemPromptNew: null }))).toBe(false);   // 'off' — no counterpart
    expect(isPairRecord(shadowRecord({ systemPromptOld: '' }))).toBe(false);     // the assembly failed
    expect(isPairRecord(shadowRecord({ userMessage: '  ' }))).toBe(false);
    expect(isPairRecord(null)).toBe(false);
  });

  it('takes the most recent `limit` pairs, newest first', () => {
    const records = [
      shadowRecord({ _loggedAt: '2026-09-06T10:00:00.000Z', userMessage: 'oldest' }),
      shadowRecord({ _loggedAt: '2026-09-08T10:00:00.000Z', userMessage: 'newest' }),
      shadowRecord({ _loggedAt: '2026-09-07T10:00:00.000Z', userMessage: 'middle' }),
    ];
    expect(selectPairs(records, { limit: 2 }).map((r) => r.userMessage)).toEqual(['newest', 'middle']);
  });

  it('drops the non-pairs before applying the limit', () => {
    const records = [shadowRecord({ systemPromptNew: null }), shadowRecord({ userMessage: 'real' })];
    expect(selectPairs(records, { limit: 20 }).map((r) => r.userMessage)).toEqual(['real']);
  });

  it('defaults to the gate\'s floor of 20', () => {
    expect(DEFAULT_PAIRS).toBe(20);
    const records = Array.from({ length: 25 }, (_, i) => shadowRecord({ _loggedAt: `2026-09-08T10:00:${String(i).padStart(2, '0')}.000Z` }));
    expect(selectPairs(records)).toHaveLength(20);
  });

  it('handles an empty or absent corpus without throwing', () => {
    expect(selectPairs([])).toEqual([]);
    expect(selectPairs(undefined)).toEqual([]);
  });

  it('pairFromRecord carries both sides, the persisted reply, and a stable id', () => {
    const pair = pairFromRecord(shadowRecord(), 0);
    expect(pair).toMatchObject({
      id: 'turn-01',
      source: 'shadow',
      userMessage: 'whats the read',
      persistedReply: 'The book held.',
      persistedTimeout: false,
    });
    expect(pair.old.systemPrompt).toBe('OLD PROMPT');
    expect(pair.new.systemPrompt).toBe('NEW PROMPT');
    expect(pair.new.conversationHistory).toEqual([{ role: 'user', content: 'earlier' }]);
  });

  it('pairFromRecord marks a turn that timed out in production', () => {
    expect(pairFromRecord(shadowRecord({ turnError: true, errorReason: 'gemma_timeout' }), 3))
      .toMatchObject({ id: 'turn-04', persistedTimeout: true });
  });
});

// ==================== the hostile pair ====================

describe('voice-grounding-harness — persistedReplySide (lens 3, #4)', () => {
  it('keys on the RESOLVED mode, which is never "canary"', () => {
    // chat.js stamps getVoiceGroundingMode(uid), and resolution only ever
    // yields off | shadow | on. A 'canary' branch would encode the WRONG rule:
    // under the canary flag a non-allowlisted caller is sent the OLD prompt.
    expect(resolveVoiceGroundingMode('canary', 'uid-1', 'uid-1')).toBe('on');
    expect(resolveVoiceGroundingMode('canary', 'uid-2', 'uid-1')).toBe('shadow');
    expect(persistedReplySide('on')).toBe('new');
    expect(persistedReplySide('shadow')).toBe('old');
    expect(persistedReplySide(null)).toBe('old');
    // The value that cannot reach here must not be treated as the new side.
    expect(persistedReplySide('canary')).toBe('old');
  });
});

describe('voice-grounding-harness — the hostile rationale fixture (spec §3.2)', () => {
  it('the rationale carries all three forms Sol\'s confirm pass named', () => {
    expect(HOSTILE_RATIONALE).toContain('Hypothesis:');
    expect(HOSTILE_RATIONALE).toContain("I'll rotate");
    expect(HOSTILE_RATIONALE).toMatch(/If .+ then I would swap/);
    // …and a completed decision with its observed reason, which the narrator MAY quote.
    expect(HOSTILE_RATIONALE).toContain('Held the book');
  });

  it('lays the hostile rationale over the newest frozen check, leaving the rest of the record alone', () => {
    const evals = hostileEvaluations();
    expect(evals).toHaveLength(5);
    expect(evals[evals.length - 1].rationale).toBe(HOSTILE_RATIONALE);
    expect(evals[0].rationale).not.toBe(HOSTILE_RATIONALE);
  });

  it('assembles both prompts through the production builder, and only the new one is grounded', () => {
    const pair = buildHostilePair();
    expect(pair.source).toBe('fixture');
    expect(pair.userMessage).toBe(HOSTILE_USER_MESSAGE);
    expect(pair.old.systemPrompt.length).toBeGreaterThan(0);
    expect(pair.new.systemPrompt.length).toBeGreaterThan(0);
    expect(pair.new.systemPrompt).not.toBe(pair.old.systemPrompt);
    // The grounded block and its rule are what "new" means here.
    expect(pair.new.systemPrompt).toContain('YOUR RECORD');
    expect(pair.new.systemPrompt).toContain('RATIONALE RULE');
    expect(pair.old.systemPrompt).not.toContain('RATIONALE RULE');
  });

  it('puts the hostile rationale in front of the model on BOTH sides — the pair is the comparison', () => {
    const pair = buildHostilePair();
    expect(pair.new.systemPrompt).toContain(HOSTILE_RATIONALE);
  });
});

// ==================== scoring one side, and the run summary ====================

const PROMPT_WITH_HOSTILE = `YOUR RECORD\n  Rationale — ${MOTIVE_AGENT}: ${HOSTILE_RATIONALE}`;

describe('voice-grounding-harness — scoreSide', () => {
  it('scores a good reply: valid schema, no lint, no echo', () => {
    const side = scoreSide({
      systemPrompt: PROMPT_WITH_HOSTILE,
      call: { raw: JSON.stringify({ _scratchpad: 'read', response: 'At the 12:45 check the process held the book.', hasDirective: false }), latencyMs: 3200, timedOut: false },
    });
    expect(side.schema.valid).toBe(true);
    expect(side.lintHits).toEqual([]);
    expect(side.echoes.hitCount).toBe(0);
    expect(side.echoes.clauses).toHaveLength(3);
    expect(side.latencyMs).toBe(3200);
    expect(side.promptChars).toBe(PROMPT_WITH_HOSTILE.length);
  });

  it('scores a bad reply: the lint fires AND the rationale\'s clause is repeated', () => {
    const side = scoreSide({
      systemPrompt: PROMPT_WITH_HOSTILE,
      call: { raw: JSON.stringify({ _scratchpad: 'read', response: "I'll rotate the support slot the moment breadth widens.", hasDirective: false }), latencyMs: 4100, timedOut: false },
    });
    expect(side.lintHits).toEqual(["I'll rotate"]);
    expect(side.echoes.hitCount).toBe(1);
  });

  it('a timed-out side reports the timeout, not a schema verdict', () => {
    const side = scoreSide({ systemPrompt: PROMPT_WITH_HOSTILE, call: { raw: null, latencyMs: 19000, timedOut: true, error: 'timeout' } });
    expect(side.timedOut).toBe(true);
    expect(side.schema).toMatchObject({ valid: null, reason: 'timed_out' });
    expect(side.reply).toBe('');
  });

  it('a skipped (dry-run) side scores the persisted text and claims no schema verdict', () => {
    const side = scoreSide({ systemPrompt: PROMPT_WITH_HOSTILE, call: { skipped: true, text: "I'm rotating out of CF.", latencyMs: null } });
    expect(side.skipped).toBe(true);
    expect(side.schema).toMatchObject({ valid: null, reason: 'not_called' });
    expect(side.lintHits).toEqual(["I'm rotating"]);
  });

  it('a transport error is an outcome, not a throw', () => {
    const side = scoreSide({ systemPrompt: PROMPT_WITH_HOSTILE, call: { raw: null, latencyMs: 120, timedOut: false, error: 'OpenRouter 500' } });
    expect(side.error).toBe('OpenRouter 500');
    expect(side.schema).toMatchObject({ valid: null, reason: 'no_response' });
  });

  it('an explicit clause set overrides the prompt\'s own — the old side\'s control', () => {
    // The old prompt carries no YOUR RECORD, so on its own it would score nothing.
    const own = scoreSide({
      systemPrompt: 'OLD PROMPT, no record block',
      call: { raw: JSON.stringify({ _scratchpad: 'read', response: "I'll rotate the support slot the moment breadth widens.", hasDirective: false }), latencyMs: 900, timedOut: false },
    });
    expect(own.echoes.clauses).toEqual([]);
    expect(own.echoes.hitCount).toBe(0);

    const controlled = scoreSide({
      systemPrompt: 'OLD PROMPT, no record block',
      rationales: [HOSTILE_RATIONALE],
      call: { raw: JSON.stringify({ _scratchpad: 'read', response: "I'll rotate the support slot the moment breadth widens.", hasDirective: false }), latencyMs: 900, timedOut: false },
    });
    expect(controlled.echoes.clauses).toHaveLength(3);
    expect(controlled.echoes.hitCount).toBe(1);
  });
});

describe('voice-grounding-harness — summarizeSide', () => {
  const good = (ms) => scoreSide({ systemPrompt: PROMPT_WITH_HOSTILE, call: { raw: JSON.stringify({ _scratchpad: 'read', response: 'held the book', hasDirective: false }), latencyMs: ms, timedOut: false } });
  const bad = () => scoreSide({ systemPrompt: PROMPT_WITH_HOSTILE, call: { raw: 'not json at all', latencyMs: 2500, timedOut: false } });
  const timedOut = () => scoreSide({ systemPrompt: PROMPT_WITH_HOSTILE, call: { raw: null, latencyMs: 19000, timedOut: true, error: 'timeout' } });

  it('reports the gate\'s four numbers and excludes timeouts from the latency', () => {
    const s = summarizeSide([good(1000), good(3000), bad(), timedOut()]);
    expect(s.pairs).toBe(4);
    expect(s.called).toBe(4);
    expect(s.latency.samples).toBe(3);        // the timeout is out
    expect(s.latency.max).toBe(3000);
    expect(s.timeouts).toBe(1);
    expect(s.timeoutRate).toBeCloseTo(0.25, 10);
    expect(s.schemaChecked).toBe(3);          // the timeout has no verdict
    expect(s.schemaValid).toBe(2);
    expect(s.schemaAdherenceRate).toBeCloseTo(2 / 3, 10);
  });

  it('counts lint hits and rationale echoes over pairs as well as in total', () => {
    const echoed = scoreSide({
      systemPrompt: PROMPT_WITH_HOSTILE,
      call: { raw: JSON.stringify({ _scratchpad: 'read', response: "I'll rotate the support slot the moment breadth widens, and I'm rotating now.", hasDirective: false }), latencyMs: 900, timedOut: false },
    });
    const s = summarizeSide([good(1000), echoed]);
    expect(s.lintHits).toBe(2);
    expect(s.pairsWithLintHit).toBe(1);
    expect(s.rationaleEchoes).toBe(1);
    expect(s.pairsWithEcho).toBe(1);
  });

  it('counts a pair with EXACTLY ONE lint hit — the boundary the fixture never crossed', () => {
    // `lintHits.length > 0` → `> 1` survived: the only lint-bearing fixture
    // carried two hits, so "12 hits across 0 pair(s)" was invisible.
    const one = scoreSide({ systemPrompt: PROMPT_WITH_HOSTILE, call: { raw: JSON.stringify({ _scratchpad: 'r', response: 'Watching AVGO.', hasDirective: false }), latencyMs: 900, timedOut: false } });
    expect(one.lintHits).toHaveLength(1);
    const s = summarizeSide([one]);
    expect(s.lintHits).toBe(1);
    expect(s.pairsWithLintHit).toBe(1);
  });

  it('counts a pair with EXACTLY ONE rationale echo', () => {
    const one = scoreSide({ systemPrompt: PROMPT_WITH_HOSTILE, call: { raw: JSON.stringify({ _scratchpad: 'r', response: 'Hypothesis: CF breaks out above its 2x ATR line before the close and banks the bonus tier.', hasDirective: false }), latencyMs: 900, timedOut: false } });
    expect(one.echoes.hitCount).toBe(1);
    const s = summarizeSide([one]);
    expect(s.rationaleEchoes).toBe(1);
    expect(s.pairsWithEcho).toBe(1);
  });

  it('a DRY RUN still counts lint hits and echoes — they are its only two numbers', () => {
    // `list.reduce` → `called.reduce` survived: in a dry run every side is
    // skipped, so the two numbers a dry run exists to produce would silently
    // read 0 for every run.
    const skipped = scoreSide({ systemPrompt: PROMPT_WITH_HOSTILE, call: { skipped: true, text: "I'm rotating out of CF, watching AVGO." } });
    const s = summarizeSide([skipped]);
    expect(s.called).toBe(0);
    expect(s.lintHits).toBe(2);
    expect(s.pairsWithLintHit).toBe(1);
  });

  it('a dry run reports zero called and a null rate rather than a divide by zero', () => {
    const skipped = scoreSide({ systemPrompt: PROMPT_WITH_HOSTILE, call: { skipped: true, text: '' } });
    const s = summarizeSide([skipped, skipped]);
    expect(s).toMatchObject({ pairs: 2, called: 0, timeouts: 0, timeoutRate: null, schemaAdherenceRate: null });
    expect(s.latency.p95).toBeNull();
  });

  it('an empty run summarizes to zeros and nulls', () => {
    expect(summarizeSide([])).toMatchObject({ pairs: 0, called: 0, timeoutRate: null });
    expect(summarizeSide(undefined).pairs).toBe(0);
  });
});

// ==================== the replay, with the network injected ====================

describe('voice-grounding-harness — replay / runPairs', () => {
  it('replay sends the shipped request shape and times the call', async () => {
    const call = vi.fn(async () => '{"_scratchpad":"r","response":"ok","hasDirective":false}');
    const out = await replay({ systemPrompt: 'SP', conversationHistory: [{ role: 'user', content: 'x' }], userMessage: 'hi', call });
    expect(call).toHaveBeenCalledTimes(1);
    const args = call.mock.calls[0][0];
    expect(args).toMatchObject({ systemPrompt: 'SP', userMessage: 'hi', conversationHistory: [{ role: 'user', content: 'x' }] });
    expect(args.signal).toBeInstanceOf(AbortSignal);
    expect(out).toMatchObject({ raw: '{"_scratchpad":"r","response":"ok","hasDirective":false}', timedOut: false, error: null });
    expect(typeof out.latencyMs).toBe('number');
  });

  it('replay classifies an abort as a timeout, not an error', async () => {
    const call = vi.fn(async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; });
    expect(await replay({ systemPrompt: 'SP', conversationHistory: [], userMessage: 'hi', call }))
      .toMatchObject({ raw: null, timedOut: true, error: 'timeout' });
  });

  it('replay surfaces a transport failure without throwing', async () => {
    const call = vi.fn(async () => { throw new Error('OpenRouter 502: bad gateway'); });
    const out = await replay({ systemPrompt: 'SP', conversationHistory: [], userMessage: 'hi', call });
    expect(out.timedOut).toBe(false);
    expect(out.error).toContain('OpenRouter 502');
  });

  it('replay arms the SHIPPED per-call budget by default', async () => {
    // The default is imported from the handler, never restated here.
    expect(GEMMA_TIMEOUT_MS).toBeGreaterThan(0);
    const call = vi.fn(async ({ signal }) => { expect(signal.aborted).toBe(false); return '{"_scratchpad":"r","response":"ok","hasDirective":false}'; });
    await replay({ systemPrompt: 'SP', conversationHistory: [], userMessage: 'hi', call });
    expect(call).toHaveBeenCalled();
  });

  it('runPairs replays BOTH prompts per pair, old then new', async () => {
    const seen = [];
    const call = vi.fn(async ({ systemPrompt }) => { seen.push(systemPrompt); return '{"_scratchpad":"r","response":"ok","hasDirective":false}'; });
    const pairs = [pairFromRecord(shadowRecord(), 0)];
    const results = await runPairs(pairs, { call });
    expect(seen).toEqual(['OLD PROMPT', 'NEW PROMPT']);
    expect(results).toHaveLength(1);
    expect(results[0].new.schema.valid).toBe(true);
  });

  it('runPairs scores both sides against the GROUNDED prompt\'s clauses', async () => {
    const record = shadowRecord({ systemPromptNew: `YOUR RECORD\n  Rationale — ${MOTIVE_AGENT}: ${HOSTILE_RATIONALE}` });
    const call = async () => JSON.stringify({ _scratchpad: 'read', response: "I'll rotate the support slot the moment breadth widens.", hasDirective: false });
    const [result] = await runPairs([pairFromRecord(record, 0)], { call });
    // The old prompt carries no record block; without the shared clause set its
    // column would be vacuous. Same clauses → a real control.
    expect(result.old.echoes.clauses).toHaveLength(3);
    expect(result.new.echoes.clauses).toHaveLength(3);
    expect(result.old.echoes.hitCount).toBe(1);
    expect(result.new.echoes.hitCount).toBe(1);
  });

  it('--dry-run calls NO model and scores the persisted reply in the column that PRODUCED it', async () => {
    const call = vi.fn();
    // voiceGroundingMode 'shadow' → chat.js sent the OLD prompt, so the
    // persisted reply is the old side's. Scoring it as both columns (the first
    // cut did) printed identical replies and identical lint counts and called
    // one of them the grounded prompt's.
    const pairs = [pairFromRecord(shadowRecord({ agentMessage: "I'm rotating out of CF." }), 0)];
    expect(pairs[0].persistedReplySide).toBe('old');
    const results = await runPairs(pairs, { dryRun: true, call });
    expect(call).not.toHaveBeenCalled();
    expect(results[0].old.skipped).toBe(true);
    expect(results[0].new.skipped).toBe(true);
    expect(results[0].old.lintHits).toEqual(["I'm rotating"]);
    expect(results[0].new.lintHits).toEqual([]);   // the grounded prompt produced nothing
    expect(results[0].new.reply).toBe('');
    expect(results[0].new.latencyMs).toBeNull();
  });

  it("--dry-run attributes a canary/'on' record's reply to the GROUNDED column", async () => {
    const pairs = [pairFromRecord(shadowRecord({ voiceGroundingMode: 'on', agentMessage: 'watching AVGO' }), 0)];
    expect(pairs[0].persistedReplySide).toBe('new');
    const results = await runPairs(pairs, { dryRun: true, call: vi.fn() });
    expect(results[0].new.lintHits).toEqual(['watching']);
    expect(results[0].old.lintHits).toEqual([]);
  });

  it('--dry-run does not double-count a production timeout across both columns', async () => {
    const pairs = [pairFromRecord(shadowRecord({ turnError: true, errorReason: 'gemma_timeout' }), 0)];
    const results = await runPairs(pairs, { dryRun: true, call: vi.fn() });
    expect(results[0].old.timedOut).toBe(true);
    expect(results[0].new.timedOut).toBe(false);
  });
});

// ==================== the report ====================

describe('voice-grounding-harness — a REJECTED replay is not a latency sample (lens 2, P1)', () => {
  const rejected = (ms) => scoreSide({
    systemPrompt: PROMPT_WITH_HOSTILE,
    call: { raw: null, latencyMs: ms, timedOut: false, error: 'OpenRouter 429: rate limited' },
  });
  const answered = (ms) => scoreSide({
    systemPrompt: PROMPT_WITH_HOSTILE,
    call: { raw: JSON.stringify({ _scratchpad: 'read', response: 'held the book', hasDirective: false }), latencyMs: ms, timedOut: false },
  });

  it('a run where EVERY call was rejected reports no latency at all — not a fast one', () => {
    // The defect this row exists for: a rejection carries a latencyMs (the time
    // to the rejection, ~120ms) and timedOut:false, so counting it produced a
    // believable 11x latency "win" on a run in which nothing was answered.
    const s = summarizeSide([rejected(120), rejected(121), rejected(119)]);
    expect(s.called).toBe(3);
    expect(s.answered).toBe(0);
    expect(s.latency).toEqual({ samples: 0, p50: null, p95: null, max: null });
    expect(s.errors).toBe(3);
    expect(s.errorRate).toBe(1);
  });

  it('a rejection mixed into a real run moves neither the p50 nor the max', () => {
    const clean = summarizeSide([answered(2000), answered(4000)]);
    const withRejection = summarizeSide([answered(2000), answered(4000), rejected(80)]);
    expect(withRejection.latency).toEqual(clean.latency);
    expect(withRejection.latency.p50).toBe(3000);
    expect(withRejection.errors).toBe(1);
    expect(withRejection.answered).toBe(2);
    expect(withRejection.called).toBe(3);
  });

  it('a timeout counts as a timeout and NOT as an error — two different rows', () => {
    const timedOut = scoreSide({ systemPrompt: PROMPT_WITH_HOSTILE, call: { raw: null, latencyMs: 19000, timedOut: true, error: 'timeout' } });
    const s = summarizeSide([answered(2000), timedOut, rejected(80)]);
    expect(s.timeouts).toBe(1);
    expect(s.errors).toBe(1);
    expect(s.answered).toBe(1);
    expect(s.latency.samples).toBe(1);
  });

  it('the report carries the ANSWERED and transport-error rows beside the latency', async () => {
    const pairs = [buildHostilePair()];
    const call = async () => { throw new Error('OpenRouter 429: rate limited'); };
    const results = await runPairs(pairs, { call });
    const report = renderReport({ pairs, results, dryRun: false, range: { fromKey: '2026-09-01', toKey: '2026-09-08' }, generatedAt: NOW.toISOString() });
    expect(report).toContain('| Replays ANSWERED | 0 | 0 |');
    expect(report).toContain('| Transport errors | 1 (100.0%) | 1 (100.0%) |');
    expect(report).toContain('| Latency p50 | — | — |');
  });
});

describe('voice-grounding-harness — the budget is the nominal one, and says so (lens 2, #7)', () => {
  it('--budget-ms overrides the shipped default and is what replay arms', async () => {
    expect(parseHarnessArgs(['--budget-ms', '14000'], NOW).budgetMs).toBe(14000);
    expect(parseHarnessArgs([], NOW).budgetMs).toBe(GEMMA_TIMEOUT_MS);
    expect(() => parseHarnessArgs(['--budget-ms', '0'], NOW)).toThrow(/positive integer/);
    expect(() => parseHarnessArgs(['--budget-ms'], NOW)).toThrow(/requires a value/);

    let aborted = null;
    const call = vi.fn(async ({ signal }) => {
      aborted = await new Promise((resolve) => { signal.addEventListener('abort', () => resolve(true), { once: true }); setTimeout(() => resolve(false), 30); });
      if (aborted) { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
      return '{"_scratchpad":"r","response":"ok","hasDirective":false}';
    });
    const out = await replay({ systemPrompt: 'SP', conversationHistory: [], userMessage: 'hi', timeoutMs: 5, call });
    expect(out.timedOut).toBe(true);
  });

  it('the report DERIVES the lint pattern and the shingle window, never retypes them', async () => {
    // A hand-copied phrase list is a label that goes stale while the number
    // beside it moves — the display-agreement rule applied to a report.
    const pairs = [buildHostilePair()];
    const results = await runPairs(pairs, { dryRun: true });
    const report = renderReport({ pairs, results, dryRun: true, range: { fromKey: '2026-09-01', toKey: '2026-09-08' }, generatedAt: NOW.toISOString() });
    expect(report).toContain(`\`${REPLY_LINT_RE.source}\``);
    expect(report).toContain(`a run of ${ECHO_SHINGLE} consecutive words`);
    expect(ECHO_SHINGLE).toBe(5);
  });

  it('the report states the clamp threshold arithmetically, not as a wrong worked example', async () => {
    // 24000 - 19000 = 5000: a 5s prologue is where the clamp BEGINS to bite,
    // not where it produces 14s. The earlier text said a 5s prologue aborts at
    // 14s, which is a 10s prologue's answer.
    const pairs = [buildHostilePair()];
    const results = await runPairs(pairs, { dryRun: true });
    const report = renderReport({ pairs, results, dryRun: true, range: { fromKey: '2026-09-01', toKey: '2026-09-08' }, generatedAt: NOW.toISOString() });
    expect(report).toContain(`exceeds ${TURN_DEADLINE_MS - GEMMA_TIMEOUT_MS} ms`);
    expect(report).not.toMatch(/5s prologue aborts at 14s/);
  });

  it('the report prints the budget it used and states that production clamps below it', async () => {
    const pairs = [buildHostilePair()];
    const results = await runPairs(pairs, { dryRun: true });
    const dflt = renderReport({ pairs, results, dryRun: true, range: { fromKey: '2026-09-01', toKey: '2026-09-08' }, generatedAt: NOW.toISOString() });
    expect(dflt).toContain(`${GEMMA_TIMEOUT_MS} ms`);
    expect(dflt).toContain('Production CLAMPS this');
    expect(dflt).toContain('optimistic lower bound');

    const custom = renderReport({ pairs, results, dryRun: true, range: { fromKey: '2026-09-01', toKey: '2026-09-08' }, generatedAt: NOW.toISOString(), budgetMs: 14000 });
    expect(custom).toContain('14000 ms (`--budget-ms`');
    expect(custom).toContain(`the shipped nominal is ${GEMMA_TIMEOUT_MS} ms`);
  });

  it('runPairs hands the budget to every replay', async () => {
    const budgets = [];
    const call = vi.fn(async () => '{"_scratchpad":"r","response":"ok","hasDirective":false}');
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, ms, ...rest) => { budgets.push(ms); return originalSetTimeout(fn, ms, ...rest); });
    await runPairs([pairFromRecord(shadowRecord(), 0)], { call, timeoutMs: 1234 });
    vi.restoreAllMocks();
    expect(budgets.filter((b) => b === 1234)).toHaveLength(2); // old side and new side
  });
});

describe('voice-grounding-harness — renderReport', () => {
  async function build({ dryRun = false, reply = 'At the 12:45 check the process held the book.' } = {}) {
    const pairs = [pairFromRecord(shadowRecord({ agentMessage: reply }), 0), buildHostilePair()];
    const call = async () => JSON.stringify({ _scratchpad: 'read', response: reply, hasDirective: false });
    const results = await runPairs(pairs, { dryRun, call });
    return renderReport({ pairs, results, dryRun, range: { fromKey: '2026-09-01', toKey: '2026-09-08' }, generatedAt: NOW.toISOString(), pairFloor: 20 });
  }

  it('puts the OLD prompt\'s numbers in the old column and the NEW prompt\'s in the new', async () => {
    // Swapping oldSummary/newSummary in renderReport survived: the rows only
    // asserted that the labels exist. The gate's decision table could print the
    // shipped prompt's latency under "New prompt (grounded)".
    const pairs = [pairFromRecord(shadowRecord(), 0)];
    // The old side answers in 0ms-ish and is valid; the new side is REJECTED,
    // so the two columns cannot be confused for one another.
    const call = async ({ systemPrompt }) => {
      if (systemPrompt === 'NEW PROMPT') throw new Error('OpenRouter 429: rate limited');
      return JSON.stringify({ _scratchpad: 'r', response: 'held the book', hasDirective: false });
    };
    const results = await runPairs(pairs, { call });
    const report = renderReport({ pairs, results, dryRun: false, range: { fromKey: '2026-09-01', toKey: '2026-09-08' }, generatedAt: NOW.toISOString() });
    const row = (label) => report.split('\n').find((l) => l.startsWith(`| ${label} |`)).split('|').map((c) => c.trim());
    expect(row('Replays ANSWERED')).toEqual(['', 'Replays ANSWERED', '1', '0', '']);
    expect(row('Transport errors')).toEqual(['', 'Transport errors', '0 (0.0%)', '1 (100.0%)', '']);
    expect(row('Schema adherence')[2]).toBe('1/1 (100.0%)');
    expect(row('Schema adherence')[3]).toBe('0/0 (—)');
  });

  it('leads with the gate\'s numbers for both prompts', async () => {
    const report = await build();
    expect(report).toContain('# Voice-layer grounding — the paired harness (spec §9, gate 1)');
    expect(report).toContain('| Measure | Old prompt (shipped) | New prompt (grounded) |');
    expect(report).toContain('| Latency p95 |');
    expect(report).toContain('| Schema adherence |');
    expect(report).toContain('| Reply-lint hits |');
    expect(report).toContain('| Rationale forward echoes |');
  });

  it('names the range, the pair count and the SHIPPED budget it replayed under', async () => {
    const report = await build();
    expect(report).toContain('2026-09-01 → 2026-09-08');
    expect(report).toContain('1 real turn(s) + 1 hostile fixture');
    expect(report).toContain(`${GEMMA_TIMEOUT_MS} ms`);
  });

  it('renders each pair side by side, the hostile one labelled', async () => {
    const report = await build();
    expect(report).toContain('### turn-01');
    expect(report).toContain('### hostile — the hostile rationale fixture (spec §3.2)');
    expect(report).toContain(HOSTILE_USER_MESSAGE);
    expect(report).toContain('**Rationales the grounded prompt carried** (both replies are scored against these):');
  });

  it('a dry run says so at the top and calls no side "valid"', async () => {
    const report = await build({ dryRun: true });
    expect(report).toContain('**DRY RUN — no model was called.**');
    expect(report).toContain('not called');
  });

  it('a repeated forward clause is visible in the pair\'s own row', async () => {
    const report = await build({ reply: 'If AVGO clears its 20-day on the next test then I would swap it into Core.' });
    expect(report).toContain('| Forward language from the rationale |');
    expect(report).toMatch(/exact: `if avgo clears/);
  });
});

// ==================== the CLI's argument surface ====================

describe('voice-grounding-harness — parseHarnessArgs', () => {
  it('defaults to 20 pairs, seven days, a dated report path, and a live run', () => {
    const args = parseHarnessArgs([], NOW);
    expect(args).toMatchObject({ pairs: 20, dryRun: false, fromKey: '2026-09-02', toKey: '2026-09-08' });
    expect(args.out).toBe('docs/audits/20260908_VOICE_GROUNDING_PAIRED_HARNESS.md');
    expect(defaultOutPath(NOW)).toBe(args.out);
  });

  it('passes the range flags through to the shared reader\'s parser', () => {
    expect(parseHarnessArgs(['--from', '2026-09-01', '--to', '2026-09-03'], NOW))
      .toMatchObject({ fromKey: '2026-09-01', toKey: '2026-09-03' });
    expect(parseHarnessArgs(['--days', '2'], NOW)).toMatchObject({ fromKey: '2026-09-07', toKey: '2026-09-08' });
  });

  it('takes --pairs, --out and --dry-run', () => {
    expect(parseHarnessArgs(['--pairs', '5', '--out', '/tmp/x.md', '--dry-run'], NOW))
      .toMatchObject({ pairs: 5, out: '/tmp/x.md', dryRun: true });
  });

  it('rejects the usage errors rather than running a wrong scan', () => {
    expect(() => parseHarnessArgs(['--pairs', '0'], NOW)).toThrow(/positive integer/);
    expect(() => parseHarnessArgs(['--out'], NOW)).toThrow(/requires a value/);
    expect(() => parseHarnessArgs(['--days', '2', '--from', '2026-09-01'], NOW)).toThrow(/cannot be combined/);
    expect(() => parseHarnessArgs(['--nope'], NOW)).toThrow(/Unknown argument/);
  });
});
