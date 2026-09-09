// api/_utils/voiceLayerGrounding.platformResearch.test.js
//
// Phase C §5 / V1.1 ruling 1 (D-121) — THE PROVENANCE BOUNDARY. Sol C-1's
// BLOCKER: a persisted card must not re-enter the prompt as the character's own
// earlier words, and a prose rule cannot repair a history role.
//
// The three parts of the ruling, each asserted structurally:
//   1. no grounding marker on the exchange (asserted where it is written —
//      api/agent/research.test.js);
//   2. one entrance: the typed PLATFORM RESEARCH block;
//   3. the exclusion is structural, so a refactor cannot re-admit the card by
//      dropping a marker.
//
// The THREE ACCEPTANCE PROMPTS from Sol's test are fixtures at the bottom: after
// a research card, "what did you see?", "does your evidence support this?" and
// "what do you think about those numbers?" must never reach a model that has
// been told the card was the decider's check or the narrator's own evidence.
//
// This file's import of the module under test is the BUILD_RULES §4
// dependency-surface guard. Never mock it.

import { describe, it, expect } from 'vitest';
import {
  selectHistoryWindow,
  buildEarlierMessagesBlock,
  buildGroundedConversationHistory,
  buildPlatformResearchBlock,
  PLATFORM_RESEARCH_HEADING,
  PLATFORM_RESEARCH_RULE,
  passesResearchReplyLint,
  RESEARCH_LINT_WITHHELD_LINE,
  GROUNDING_VERSION,
} from './voiceLayerGrounding.js';

const CARD = {
  symbol: 'MPC',
  eyebrow: 'Research',
  platformDataLabel: 'Platform data · not what the check saw',
  technicals: { facts: ['RSI 62.4 · neutral', 'ATR 2.14% · normal'], label: 'Technicals · last quote 10:00 AM · daily indicators as of Sep 8' },
  fundamentals: { facts: ['P/E 14.2 · sector median 19.6'], label: 'Fundamentals · as of Sep 5' },
  standing: { place: 'bench', line: 'On the bench', facts: [] },
};
// THE FIXTURE IS ADVERSARIAL ON PURPOSE (review F-4). The route writes a card
// with no `userMessage`, an empty `agentResponse` and no marker — which
// `selectHistoryWindow` would drop INCIDENTALLY, on the empty-text and
// missing-marker branches, whether or not the D-121 exclusion existed. Every row
// below would then have passed with the exclusion deleted, which is exactly the
// "a row that cannot fail is not a guard" trap. So the fixture carries all three
// properties that WOULD admit it: a user half, narrator words and the marker.
// Only `messageType` keeps it out, which is the claim under test.
//
// The route's actual shape is asserted where it is written (research.test.js).
const RESEARCH_EXCHANGE = {
  messageType: 'research',
  symbol: 'MPC',
  card: CARD,
  userMessage: 'Show it · MPC',
  agentResponse: 'MPC trades at 14.2 times earnings against a sector median of 19.6.',
  groundingVersion: 1,
  timestamp: '2026-09-09T14:00:00.000Z',
};
const TYPED = { messageType: 'user_initiated', userMessage: 'what did you see?', agentResponse: 'The record shows the 11:15 check held.', groundingVersion: GROUNDING_VERSION };
const PROACTIVE = { messageType: 'anticipation', agentResponse: 'At the 11:15 check my trading process flagged NOW.', groundingVersion: GROUNDING_VERSION, timestamp: '2026-09-09T15:15:00.000Z' };

describe('2 + 3. the card never enters the history window (Sol C-1)', () => {
  it('is in NEITHER half — not a pair, not an agent line', () => {
    const { pairs, agentLines } = selectHistoryWindow([RESEARCH_EXCHANGE, TYPED, PROACTIVE]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].userMessage).toBe('what did you see?');
    expect(agentLines).toHaveLength(1);
    expect(agentLines[0].type).toBe('anticipation');
  });

  it('the exclusion is STRUCTURAL, not a consequence of the missing marker', () => {
    // Both of these WOULD be admitted on their other properties: the first has
    // a userMessage (the `pairs` branch never consults groundingVersion), the
    // second carries the marker. Only the messageType keeps them out — which is
    // exactly the refactor-proofing the ruling asks for.
    const withUser = { ...RESEARCH_EXCHANGE, userMessage: 'Show it · MPC' };
    const withMarker = { ...RESEARCH_EXCHANGE, groundingVersion: GROUNDING_VERSION };
    expect(selectHistoryWindow([withUser]).pairs).toEqual([]);
    expect(selectHistoryWindow([withMarker]).agentLines).toEqual([]);
    expect(selectHistoryWindow([withUser, withMarker]).pairs).toEqual([]);
  });

  it('EARLIER MESSAGES never mentions the card, its symbol or its numbers', () => {
    // The adversarial variant for THIS block: no user half, so without the
    // exclusion it would land in `agentLines` on the strength of its marker.
    const narrated = { ...RESEARCH_EXCHANGE, userMessage: undefined };
    const block = buildEarlierMessagesBlock([narrated, PROACTIVE]);
    expect(block).not.toMatch(/MPC|Research|P\/E|14\.2|Platform data/);
    expect(buildEarlierMessagesBlock([narrated])).toBeNull();
    expect(selectHistoryWindow([narrated]).agentLines).toEqual([]);
  });

  it('the model’s conversation history never carries it either', () => {
    const history = buildGroundedConversationHistory([RESEARCH_EXCHANGE, TYPED]);
    expect(history).toHaveLength(2);              // the typed pair only
    expect(JSON.stringify(history)).not.toMatch(/MPC|Platform data|P\/E/);
  });
});

describe('2. the one entrance — the typed block', () => {
  const block = buildPlatformResearchBlock([TYPED, RESEARCH_EXCHANGE, PROACTIVE]);

  it('names the card as the PLATFORM’s, and says what it is not', () => {
    expect(block.startsWith(PLATFORM_RESEARCH_HEADING)).toBe(true);
    expect(block).toContain('NOT your earlier words');
    expect(block).toContain('NOT what the trading process saw at any check');
    expect(block).toContain('NOT evidence for any decision');
  });

  it('preserves the symbol, both section labels with their dates, and the standing', () => {
    expect(block).toContain('MPC');
    expect(block).toContain('Technicals · last quote 10:00 AM · daily indicators as of Sep 8');
    expect(block).toContain('Fundamentals · as of Sep 5');
    expect(block).toContain('RSI 62.4 · neutral');
    expect(block).toContain('P/E 14.2 · sector median 19.6');
    expect(block).toContain('Standing: On the bench');
    expect(block).toContain('Platform data · not what the check saw');
  });

  it('carries the research rule, with the one number carve-out (hazard 5)', () => {
    expect(block).toContain(PLATFORM_RESEARCH_RULE);
    expect(block).toContain('the one exception to never quoting raw data numbers');
    expect(block).toContain('You do not recommend, forecast, or state what the trading process will do with it');
    expect(block).toMatch(/never say you saw it, looked it up, ran it, or that it was your evidence/);
  });

  it('is NULL — heading, cards and rule all absent — when the battle holds no card', () => {
    expect(buildPlatformResearchBlock([TYPED, PROACTIVE])).toBeNull();
    expect(buildPlatformResearchBlock([])).toBeNull();
    expect(buildPlatformResearchBlock(null)).toBeNull();
  });

  it('renders every card in the window, in write order', () => {
    const second = { ...RESEARCH_EXCHANGE, symbol: 'NVDA', card: { ...CARD, symbol: 'NVDA' } };
    const both = buildPlatformResearchBlock([RESEARCH_EXCHANGE, TYPED, second]);
    expect(both.indexOf('MPC')).toBeLessThan(both.indexOf('NVDA'));
  });

  it('drops a card that carries no composed object rather than printing an empty one', () => {
    expect(buildPlatformResearchBlock([{ messageType: 'research', symbol: 'MPC', card: null }])).toBeNull();
  });
});

describe('the research follow-up’s reply lint (item 13 — a build item, not a reuse)', () => {
  it('passes a reply that describes the card at its dates', () => {
    for (const reply of [
      'The card puts MPC at a P/E of 14.2 against a sector median of 19.6, as of Sep 5.',
      'Its RSI was 62.4 at the last quote — neutral territory on that reading.',
      'That is what the platform holds on MPC; the record says nothing about it.',
    ]) {
      expect(passesResearchReplyLint(reply)).toBe(true);
    }
  });

  it('fails a verdict, a forecast, or a claim about what the process will do', () => {
    for (const reply of [
      'Cheap against the sector — I would buy it here.',
      'Worth buying at that multiple.',
      "I'll rotate into it at the next check.",
      "I'm watching MPC now.",
      'Time to buy.',
      'Should I put it in the book? Yes.',
      'I will file that as a directive and the process will act on it.',
    ]) {
      expect(passesResearchReplyLint(reply), reply).toBe(false);
    }
  });

  it('the withheld line is TRUE on any turn it can fire on (review B-3)', () => {
    // It fires on any grounded turn while a card is in the window, not only on a
    // turn about the card — so it must not assert that the answer was about the
    // card. It says what happened and what will be stuck to instead.
    expect(RESEARCH_LINT_WITHHELD_LINE).toMatch(/wasn't sent/);
    expect(RESEARCH_LINT_WITHHELD_LINE).not.toMatch(/the card above/i);
    expect(RESEARCH_LINT_WITHHELD_LINE).toMatch(/record and the platform's own dated data/);
    // And it must not itself trip the lint that produced it.
    expect(passesResearchReplyLint(RESEARCH_LINT_WITHHELD_LINE)).toBe(true);
  });

  it('the three FAMILIES are each covered, and innocent narration passes (review B-2 / B-3)', () => {
    // A lint that misses the breaches it names is decoration; one that withholds
    // honest sentences teaches the reader the line is noise.
    const breaches = [
      "That's a buy at these levels.",                       // verdict
      'Worth buying at that multiple.',
      'Should I put it in the book? Yes.',
      'The process will trim it at the next check.',          // forecast
      "It'll get rotated out if it keeps fading.",
      'Expect a bounce off the 50-day.',
      'If it breaks the 20-day I am cutting it.',
      'I looked it up and the P/E came back at 14.2.',        // attribution
      'I ran the numbers on MPC and that is what my check saw.',
      'Those numbers were my evidence for holding it.',
    ];
    const innocent = [
      "I'll walk you through the card: the technicals are dated Sep 8 and the fundamentals Sep 5.",
      'Should I show you the fundamentals section as well?',
      "I'll keep the read tight: the record shows the 11:15 check held the book.",
      'The 11:15 check held the book; nothing was recorded about MPC.',
      'What would you like me to file?',
    ];
    for (const t of breaches) expect(passesResearchReplyLint(t), `missed: ${t}`).toBe(false);
    for (const t of innocent) expect(passesResearchReplyLint(t), `false positive: ${t}`).toBe(true);
  });
});

describe('THE THREE ACCEPTANCE PROMPTS (Sol C-1’s test, as fixtures)', () => {
  // "after a research card, prompts such as 'what did you see?', 'does your
  //  evidence support this?' and 'what do you think about those numbers?' must
  //  never produce a claim that the research data was part of the decider's
  //  check or the narrator's prior evidence."
  //
  // What a test CAN assert is the prompt boundary, which is where the ruling
  // put the fix: for each prompt, the card reaches the model ONLY inside the
  // typed block, the block denies both readings in as many words, and nothing
  // in the conversational history the model receives carries the card at all.
  const PROMPTS = [
    'what did you see?',
    'does your evidence support this?',
    'what do you think about those numbers?',
  ];

  it.each(PROMPTS)('%s — the card is in PLATFORM RESEARCH and in nothing else', (prompt) => {
    const exchanges = [RESEARCH_EXCHANGE, { ...TYPED, userMessage: prompt }];

    const block = buildPlatformResearchBlock(exchanges);
    expect(block).toContain('MPC');
    expect(block).toContain('NOT your earlier words');
    expect(block).toContain('NOT what the trading process saw at any check');

    // The two channels that would give it the wrong role carry nothing of it.
    expect(buildEarlierMessagesBlock(exchanges) ?? '').not.toMatch(/MPC|P\/E|RSI/);
    const history = buildGroundedConversationHistory(exchanges);
    expect(JSON.stringify(history)).not.toMatch(/P\/E|RSI|Platform data/);
    // The player's own question is still in the history — the turn is answerable.
    expect(history.some((m) => m.role === 'user' && m.content === prompt)).toBe(true);
  });

  it.each(PROMPTS)('%s — the rule denies both readings the prompt could invite', (prompt) => {
    // The lint catches the VERDICT family; the provenance claims ("I saw it",
    // "my evidence", "I ran those numbers") are denied by the rule that travels
    // with the block, which is where a prompt-level claim has to be denied.
    // Asserted against the block the prompt's own turn would carry.
    const block = buildPlatformResearchBlock([RESEARCH_EXCHANGE, { ...TYPED, userMessage: prompt }]);
    expect(block).toContain('never say you saw it, looked it up, ran it, or that it was your evidence');
    expect(block).toContain('never say it explains or caused any decision on the record');
    expect(block).toContain('It is not yours and it is not the check');
  });
});
