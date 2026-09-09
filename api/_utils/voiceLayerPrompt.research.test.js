// api/_utils/voiceLayerPrompt.research.test.js
//
// Phase C §1 / §5 — THE ASSEMBLED PROMPT.
//
// The unit tests prove the two blocks are built correctly; this proves they are
// SPLICED correctly — that the card actually lands in PLATFORM RESEARCH and not
// in EARLIER MESSAGES in the bytes the model would receive, and that with the
// flag dark neither block is in the prompt at all.
//
// The flag is doubled per row; everything else in featureFlags is the real
// module (a bare-factory mock omitting a name THROWS on access under vitest).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ showIt: false }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get SHOW_IT_ENABLED() { return state.showIt; },
}));

// Dependency-surface guard (BUILD_RULES §4). Never mock it.
const { buildVoiceLayerPrompt } = await import('./voiceLayerPrompt.js');
const { EARLIER_MESSAGES_HEADING, PLATFORM_RESEARCH_HEADING, buildGroundedConversationHistory } = await import('./voiceLayerGrounding.js');

const CARD = {
  symbol: 'MPC',
  eyebrow: 'Research',
  platformDataLabel: 'Platform data · not what the check saw',
  technicals: { facts: ['RSI 62.4 · neutral'], label: 'Technicals · last quote 10:00 AM · daily indicators as of Sep 8' },
  fundamentals: { facts: ['P/E 14.2 · sector median 19.6'], label: 'Fundamentals · as of Sep 5' },
  standing: { place: 'bench', line: 'On the bench', facts: [] },
};

const AGENT = { id: 'agent-1', name: 'Vega', archetype: 'diversifier' };
const build = (chatExchanges, opts = {}) => buildVoiceLayerPrompt({
  agent: AGENT,
  battle: {
    id: 'battle-1',
    agentId: 'agent-1',
    status: 'active',
    portfolio: { star: [{ symbol: 'NVDA' }], core: [], support: [], bench: { stocks: [{ symbol: 'MPC' }] } },
    chatExchanges,
    evaluations: [],
  },
  elicitationTarget: { dimension: 'risk', instruction: 'Find out how they size risk.' },
  conversationHistory: [],
  marketSnapshot: null,
  grounded: true,
  ...opts,
});

// Adversarial, for the reason given in voiceLayerGrounding.platformResearch.test.js:
// a card the history window would otherwise ADMIT, so the byte-identity and
// acceptance rows below fail if the exclusion is removed.
const research = {
  messageType: 'research',
  symbol: 'MPC',
  card: CARD,
  userMessage: 'Show it · MPC',
  agentResponse: 'MPC trades at 14.2 times earnings.',
  groundingVersion: 1,
  timestamp: '2026-09-09T14:00:00.000Z',
};
const proactive = { messageType: 'anticipation', agentResponse: 'At the 11:15 check my trading process flagged NOW.', groundingVersion: 1, timestamp: '2026-09-09T15:15:00.000Z' };

beforeEach(() => { state.showIt = false; });

describe('flag DARK — the grounded prompt is untouched', () => {
  it('carries neither the research chip block nor the platform-research block', () => {
    const dark = build([research, proactive]);
    expect(dark).not.toContain(PLATFORM_RESEARCH_HEADING);
    expect(dark).not.toContain('"kind": "research"');
    expect(dark).not.toContain('THE RESEARCH RULE');
  });

  it('is BYTE-IDENTICAL to the same prompt with no research exchange at all', () => {
    // The card is in the doc and changes nothing: the history window excludes
    // it unconditionally, and the block is flag-gated.
    expect(build([research, proactive])).toBe(build([proactive]));
  });
});

describe('flag ON — the card lands in PLATFORM RESEARCH, and only there', () => {
  beforeEach(() => { state.showIt = true; });

  it('the block is in the prompt, with the card’s symbol, dates and label', () => {
    const prompt = build([research, proactive]);
    expect(prompt).toContain(PLATFORM_RESEARCH_HEADING);
    expect(prompt).toContain('Technicals · last quote 10:00 AM · daily indicators as of Sep 8');
    expect(prompt).toContain('Fundamentals · as of Sep 5');
    expect(prompt).toContain('Platform data · not what the check saw');
    expect(prompt).toContain('THE RESEARCH RULE');
  });

  it('EARLIER MESSAGES is present for the proactive line and holds NOTHING of the card', () => {
    const prompt = build([research, proactive]);
    const earlierAt = prompt.indexOf(EARLIER_MESSAGES_HEADING);
    expect(earlierAt).toBeGreaterThan(-1);
    const earlierBlock = prompt.slice(earlierAt);
    expect(earlierBlock).toContain('my trading process flagged NOW');
    expect(earlierBlock).not.toMatch(/P\/E|RSI 62\.4|Platform data/);
  });

  it('the two blocks are separate, and the platform block comes first', () => {
    const prompt = build([research, proactive]);
    expect(prompt.indexOf(PLATFORM_RESEARCH_HEADING)).toBeLessThan(prompt.indexOf(EARLIER_MESSAGES_HEADING));
  });

  it('offers the third chip kind in battle mode, and not in review', () => {
    expect(build([research])).toContain('"kind": "research"');
    expect(build([research], { mode: 'review' })).not.toContain('"kind": "research"');
  });

  it('a battle with no card gets no block and no rule', () => {
    const prompt = build([proactive]);
    expect(prompt).not.toContain(PLATFORM_RESEARCH_HEADING);
    expect(prompt).not.toContain('THE RESEARCH RULE');
  });
});

describe('THE THREE ACCEPTANCE PROMPTS, end to end (Sol C-1)', () => {
  beforeEach(() => { state.showIt = true; });

  it.each([
    'what did you see?',
    'does your evidence support this?',
    'what do you think about those numbers?',
  ])('%s — the card reaches the model ONLY as platform data', (question) => {
    const typed = { messageType: 'user_initiated', userMessage: question, agentResponse: 'ok', groundingVersion: 1 };
    const prompt = build([research, typed]);

    // Present, typed, and explicitly denied both wrong readings.
    expect(prompt).toContain(PLATFORM_RESEARCH_HEADING);
    expect(prompt).toContain('NOT your earlier words');
    expect(prompt).toContain('NOT what the trading process saw at any check');
    expect(prompt).toContain('NOT evidence for any decision');
    expect(prompt).toContain('never say you saw it, looked it up, ran it, or that it was your evidence');

    // The card's numbers appear EXACTLY ONCE in the whole prompt — inside the
    // block. A second occurrence would mean a second channel carried it.
    expect(prompt.split('P/E 14.2 · sector median 19.6')).toHaveLength(2);
    expect(prompt.split('RSI 62.4 · neutral')).toHaveLength(2);

    // THE SECOND CHANNEL (review F-4): the model receives a MESSAGES ARRAY as
    // well as this prompt, and a card admitted to `pairs` would ride that
    // instead — invisibly to any assertion on the prompt string alone. This is
    // the assertion that fails if the exclusion is removed.
    const history = buildGroundedConversationHistory([research, typed]);
    expect(JSON.stringify(history)).not.toMatch(/Show it · MPC|14\.2 times earnings/);
    expect(history.some((m) => m.role === 'user' && m.content === question)).toBe(true);
    expect(history).toHaveLength(2);            // the typed pair only
  });
});
