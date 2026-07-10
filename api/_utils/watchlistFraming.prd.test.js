// api/_utils/watchlistFraming.prd.test.js
//
// Release 2 PR-d (WS3, HELD) — presence + framing tests for the canonical
// watchlist text (spec §5.1, founder ruling D4: ONE constant, strategy-side
// only, no copy anywhere implies refusal).
//
// BUILD_RULES §4 dependency-surface guard: real imports of the fenced
// strategy assembly (called, never edited beyond the authorized PR-d swap),
// the boards module, and the shared renderer — never mock any of them here.

import { describe, it, expect, vi } from 'vitest';

vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

const { WATCHLIST_FRAMING_TEXT } = await import('./controlPromptRenderer.js');
const { buildStrategyUserPrompt, buildPortfolioSystemPrompt } = await import('./agentPromptAssembly.js');
const { buildBoardUserPrompt } = await import('./tournamentAgentBoards.js');
const { buildLiveContextBlock } = await import('./agentEvalPromptAssembly.js');
const { buildEvalWith, makeEvalBattle } = await import('./__fixtures__/controlsPromptFixtures.js');

// The §5.1 golden — HAND-SPECIFIED from the spec text, never derived from the
// module under test (the renderer-golden convention).
const SPEC_5_1_GOLDEN =
  'USER WATCHLIST. Give these names priority attention, but do not infer a trade requirement. '
  + 'Evaluate them under the same archetype criteria and guardrails as every other candidate. '
  + 'When a watched name ranks poorly or lacks sufficient data, state this in your reasoning. '
  + 'The watchlist changes attention, not eligibility or deterministic controls.';

const WATCHLIST = { name: 'My list', thesis: 'AI keeps running', tickers: ['NVDA', 'AMD'] };

// The retired eligibility-nudge phrases — none may survive anywhere.
const RETIRED_NUDGES = [
  'Include every user-equipped ticker',
  'Give them fair consideration; do not exclude',
  'rank a watchlist ticker high only where it is genuinely competitive',
  'user-prioritized opportunities, not mandates',
  'absence from the table is not a negative signal',
];
// "No copy anywhere implies refusal" (spec §5.1 acceptance).
const REFUSAL_SHAPES = ['refuse', 'must not trade', 'are not allowed to', 'forbidden to buy'];

describe('PR-d — the canonical constant', () => {
  it('is the §5.1 text BYTE-EXACT (adopted verbatim)', () => {
    expect(WATCHLIST_FRAMING_TEXT).toBe(SPEC_5_1_GOLDEN);
  });
});

describe('PR-d — presence at all three strategy-side sites, exactly once each', () => {
  const count = (haystack, needle) => haystack.split(needle).length - 1;

  it('buildStrategyUserPrompt: the canonical text renders exactly once; the nudges are gone', () => {
    const out = buildStrategyUserPrompt({ name: 'Atlas', archetype: 'guardian', activeRules: [] }, WATCHLIST);
    expect(count(out, WATCHLIST_FRAMING_TEXT)).toBe(1);
    expect(out).toContain('USER-EQUIPPED WATCHLIST'); // structural header retained
    expect(out).toContain('NVDA, AMD');
    for (const nudge of RETIRED_NUDGES) expect(out).not.toContain(nudge);
  });

  it('buildPortfolioSystemPrompt: the canonical text renders exactly once; the factual "-"-scores note survives', () => {
    const out = buildPortfolioSystemPrompt('brief', 'csv', 'BTC', '', { tickers: ['NVDA'] });
    expect(count(out, WATCHLIST_FRAMING_TEXT)).toBe(1);
    expect(out).toContain('expected, not a data error'); // data note, not framing
    for (const nudge of RETIRED_NUDGES) expect(out).not.toContain(nudge);
  });

  it('buildBoardUserPrompt (tournamentAgentBoards): the canonical text renders exactly once', () => {
    const out = buildBoardUserPrompt(
      { name: 'Atlas', archetype: 'guardian' },
      { userPicks: [], equippedWatchlist: WATCHLIST },
    );
    expect(count(out, WATCHLIST_FRAMING_TEXT)).toBe(1);
    for (const nudge of RETIRED_NUDGES) expect(out).not.toContain(nudge);
  });

  it('no watchlist → no framing text at any site (the block stays conditional)', () => {
    expect(buildStrategyUserPrompt({ name: 'A', archetype: 'guardian', activeRules: [] }, null)).not.toContain('USER WATCHLIST');
    expect(buildPortfolioSystemPrompt('b', 'c', 'BTC', '', null)).not.toContain('USER WATCHLIST');
    expect(buildBoardUserPrompt({ name: 'A', archetype: 'guardian' }, { userPicks: [] })).not.toContain('USER WATCHLIST');
  });
});

describe('PR-d — D4 boundaries', () => {
  it('NO eval-side block: the eval assembly never carries the framing (deferred with the refusal engine)', async () => {
    const out = await buildEvalWith(buildLiveContextBlock)(makeEvalBattle());
    expect(out).not.toContain('USER WATCHLIST');
    expect(out).not.toContain(WATCHLIST_FRAMING_TEXT);
  });

  it('no copy anywhere implies refusal', () => {
    const strategyOut = buildStrategyUserPrompt({ name: 'A', archetype: 'guardian', activeRules: [] }, WATCHLIST);
    const boardOut = buildBoardUserPrompt({ name: 'A', archetype: 'guardian' }, { userPicks: [], equippedWatchlist: WATCHLIST });
    for (const shape of REFUSAL_SHAPES) {
      expect(WATCHLIST_FRAMING_TEXT.toLowerCase()).not.toContain(shape);
      expect(strategyOut.toLowerCase()).not.toContain(shape);
      expect(boardOut.toLowerCase()).not.toContain(shape);
    }
  });
});
