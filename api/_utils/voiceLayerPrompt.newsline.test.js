// api/_utils/voiceLayerPrompt.newsline.test.js
// Phase 2 N1.3 — the newsLine rendering rule: BATTLE FALL-THROUGH ONLY,
// referenceable context (never an instruction), byte-identical prompts when
// the cache carries no newsLines (the flag-off shape — R-A3's letter).
// Matrix: P2-3 (prompt surface half), the N1.3 placement pin (fenced
// decide.js's buildFirstMessagePrompt untouched), flag-off identity.

import { describe, it, expect } from 'vitest';
import { buildVoiceLayerPrompt, buildFirstMessagePrompt } from './voiceLayerPrompt.js';

const AGENT = {
  name: 'Gemma',
  archetype: 'momentum_chaser',
  stats: { gamesPlayed: 12, wins: 7, losses: 5 },
  partnerProfile: null,
  convictions: [],
};

const BATTLE = {
  id: 'battle-1',
  status: 'active',
  portfolio: { star: [{ symbol: 'AMD' }], core: [], support: [], bench: { stocks: [], crypto: null } },
};

const ELICITATION = { instruction: 'Ask about sector posture.' };

const SNAPSHOT_BASE = {
  portfolioBriefs: [{
    symbol: 'AMD', tier: 'star', price: 150.5, changePercent: 1.69,
    technicalScore: 82, technicalRank: 3, rsPercentile: 80,
    trendSummary: 'Strong uptrend.', momentumSummary: 'MACD expanding.',
    thresholdNote: null, atrPercent: 0.8,
  }],
  benchBriefs: [],
  scoutAlerts: [],
  marketContext: { regime: 'risk_on', spyChange: 0.9 },
};

const NEWS_LINES = {
  AMD: 'Today: AMD rallies 5% on data-center demand. | Prior: AMD guides Q3 above consensus.',
};

const battlePrompt = (snapshot) => buildVoiceLayerPrompt({
  agent: AGENT, battle: BATTLE, elicitationTarget: ELICITATION,
  conversationHistory: [], anchorContext: 'Risk-on tape.',
  marketSnapshot: snapshot, mode: 'battle',
});

describe('N1.3 — battle fall-through rendering', () => {
  it('renders the newsLines map as referenceable context, never an instruction', () => {
    const prompt = battlePrompt({ ...SNAPSHOT_BASE, newsLines: NEWS_LINES });
    expect(prompt).toContain('NEWSROOM WIRE');
    expect(prompt).toContain('AMD: Today: AMD rallies 5% on data-center demand.');
    expect(prompt).toContain('never instructions to act');
  });

  it('cache without newsLines (the flag-off doc shape) → prompt BYTE-IDENTICAL to pre-N1', () => {
    // The block keys off field presence; a flag-off cache doc has no
    // newsLines field at all (P2-1), so the assembled prompt must not
    // change by a single byte.
    const without = battlePrompt(SNAPSHOT_BASE);
    expect(without).not.toContain('NEWSROOM WIRE');
    const withEmpty = battlePrompt({ ...SNAPSHOT_BASE, newsLines: {} });
    expect(withEmpty).toBe(without); // empty map renders nothing — same bytes
  });

  it('P2-3 (prompt half): only digest content renders — no headline/sentiment vocabulary appears', () => {
    const prompt = battlePrompt({ ...SNAPSHOT_BASE, newsLines: NEWS_LINES });
    // The block renders values from newsLines ONLY; upstream the DTO already
    // stripped prose. Belt: the rendered block contains exactly the packed
    // lines for the symbols given.
    const blockStart = prompt.indexOf('NEWSROOM WIRE');
    const block = prompt.slice(blockStart, prompt.indexOf('\n\n', blockStart));
    expect(block).toContain('AMD: Today:');
    expect(block).not.toContain('POISON');
    expect(block.split('\n')).toHaveLength(2); // header + one symbol line
  });

  it('non-string / empty entries are skipped; symbols render sorted', () => {
    const prompt = battlePrompt({
      ...SNAPSHOT_BASE,
      newsLines: { NVDA: 'Today: NVDA beat.', AMD: 'Today: AMD rallied.', BAD: '', WORSE: 42 },
    });
    const blockStart = prompt.indexOf('NEWSROOM WIRE');
    const block = prompt.slice(blockStart, prompt.indexOf('\n\n', blockStart));
    const lines = block.split('\n').slice(1);
    expect(lines).toEqual(['AMD: Today: AMD rallied.', 'NVDA: Today: NVDA beat.']);
  });
});

describe('N1.3 — placement pin: every other surface ignores newsLines', () => {
  it('review mode never renders the block, even when the cache carries it', () => {
    const prompt = buildVoiceLayerPrompt({
      agent: AGENT, battle: BATTLE, elicitationTarget: ELICITATION,
      conversationHistory: [], anchorContext: 'Closed.',
      marketSnapshot: { ...SNAPSHOT_BASE, newsLines: NEWS_LINES },
      mode: 'review', dailyReviews: [], dailyGrades: [],
    });
    expect(prompt).not.toContain('NEWSROOM WIRE');
  });

  it('buildFirstMessagePrompt (fenced decide.js caller) never renders the block', () => {
    const prompt = buildFirstMessagePrompt({
      agent: AGENT, battle: BATTLE, anchorContext: 'Fresh deploy.',
      marketSnapshot: { ...SNAPSHOT_BASE, newsLines: NEWS_LINES },
      supportedTerms: [],
    });
    expect(prompt).not.toContain('NEWSROOM WIRE');
  });
});
