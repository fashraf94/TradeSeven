// api/_utils/agentEvalPromptAssembly.ask1.test.js
// Exit-Behavior Rebalance Tier 2, Ask 1 — the prompt made honest.
//
// Two contracts, one flag (PROFIT_TARGET_EXECUTOR_ENABLED — the same flag as
// Ask 3's executor, F11/R10):
//
//   FLAG OFF (merge state): every touched builder is BYTE-IDENTICAL to the
//   pre-Ask-1 output — proven against goldens captured from the untouched
//   code at branch base 7c70ae6b (ask1PromptGoldens.json), on the shared
//   fixture module both sides read (ask1PromptFixtures.js).
//
//   FLAG ON: the prohibition and the P&L-protection framing are gone; the
//   four-layer precedence renders (ONE wording at both of its surfaces); the
//   pricing doctrine replaces prohibition; the bust-override machinery
//   (ignoredDirectiveIds) survives untouched in both states.
//
// RED-FIRST: the flag-on suite was written before the rewrite and watched
// fail against the untouched prose. Flag walked via the live-getter mock
// (importOriginal spread — the safe pattern; the assembly reads the flag at
// CALL TIME, never module scope: the Ask 3 compileBuild lesson).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { flagState } = vi.hoisted(() => ({ flagState: { profitTarget: false } }));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get PROFIT_TARGET_EXECUTOR_ENABLED() { return flagState.profitTarget; },
}));

import {
  buildEvalSystemPrompt,
  buildAgentIdentityBlock,
  buildPortfolioCSV,
} from './agentEvalPromptAssembly.js';
// NOTE (BUILD_RULES §4 dependency-surface guard): this UNMOCKED import of the
// fenced assembly — which now imports src/constants/baggerBombScoring.js —
// is the runtime guard: it explodes in the Node test env if a browser dep
// ever enters that graph. Never mock it.
import {
  SYSTEM_PROMPT_ARGS, PRICES, makeBattle, makeAssetScores, RANKINGS_MAP,
  TIERED_GAME_MODE, FLAT6_GAME_MODE,
} from './__fixtures__/ask1PromptFixtures.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDENS = JSON.parse(readFileSync(join(HERE, '__fixtures__/ask1PromptGoldens.json'), 'utf8'));
const { agentName, archetype, archetypeKey } = SYSTEM_PROMPT_ARGS;

afterEach(() => { flagState.profitTarget = false; });

const PROHIBITION = 'Do NOT sell a winner just to "bank" positive points';
const PNL_FRAMING = 'Your primary directive is P&L protection.';
const OLD_PRECEDENCE = 'Constraints always override strategy preferences.';
const MACHINERY = 'MUST set ignoredDirectiveIds';

function allSurfaces() {
  return {
    tiered: buildEvalSystemPrompt(agentName, archetype, TIERED_GAME_MODE, archetypeKey),
    flat6: buildEvalSystemPrompt(agentName, archetype, FLAT6_GAME_MODE, archetypeKey),
    identity: buildAgentIdentityBlock(makeBattle(FLAT6_GAME_MODE)),
  };
}

// ==================== FLAG OFF — the dark contract ====================

describe('Ask 1 — FLAG OFF: byte-identical to the pre-Ask-1 prompt (goldens @ 7c70ae6b)', () => {
  it('both system-prompt variants are byte-identical', () => {
    expect(buildEvalSystemPrompt(agentName, archetype, TIERED_GAME_MODE, archetypeKey)).toBe(GOLDENS.systemTiered);
    expect(buildEvalSystemPrompt(agentName, archetype, FLAT6_GAME_MODE, archetypeKey)).toBe(GOLDENS.systemFlat6);
  });

  it('the identity block (forge-rules trailer site) is byte-identical', () => {
    expect(buildAgentIdentityBlock(makeBattle(FLAT6_GAME_MODE))).toBe(GOLDENS.identityBlock);
  });

  it('the position CSV is byte-identical in both modes', () => {
    expect(buildPortfolioCSV(makeAssetScores(), PRICES, makeBattle(TIERED_GAME_MODE))).toBe(GOLDENS.portfolioCsvTiered);
    expect(buildPortfolioCSV(makeAssetScores(), PRICES, makeBattle(FLAT6_GAME_MODE))).toBe(GOLDENS.portfolioCsvFlat6);
  });
});

// ==================== FLAG ON — the honest prompt ====================

describe('Ask 1 — FLAG ON: prohibition gone, precedence present (red-first)', () => {
  it('the archetype-invariant prohibition is ABSENT from both variants', () => {
    flagState.profitTarget = true;
    const s = allSurfaces();
    expect(s.tiered).not.toContain(PROHIBITION);
    expect(s.flat6).not.toContain(PROHIBITION);
  });

  it('the P&L-protection framing is ABSENT; the bust-override machinery SURVIVES verbatim', () => {
    flagState.profitTarget = true;
    const s = allSurfaces();
    for (const text of [s.tiered, s.flat6]) {
      expect(text).not.toContain(PNL_FRAMING);
      expect(text).toContain(MACHINERY);
      expect(text).toContain('-1.0x ATR (Bust)');
    }
  });

  it('the old precedence sentence is ABSENT from all three sites (two system prompts + the forge-rules trailer)', () => {
    flagState.profitTarget = true;
    const s = allSurfaces();
    expect(s.tiered).not.toContain(OLD_PRECEDENCE);
    expect(s.flat6).not.toContain(OLD_PRECEDENCE);
    expect(s.identity).not.toContain(OLD_PRECEDENCE);
  });

  it('the four-layer precedence renders at BOTH surfaces with ONE wording (§9 — no drifting second copy)', () => {
    flagState.profitTarget = true;
    const s = allSurfaces();
    const extract = (text) => {
      const m = text.match(/DECISION PRECEDENCE \(highest to lowest\):[\s\S]*?4\. Framework defaults[^\n]*/);
      return m ? m[0] : null;
    };
    const fromTiered = extract(s.tiered);
    const fromFlat6 = extract(s.flat6);
    const fromIdentity = extract(s.identity);
    expect(fromTiered).toBeTruthy();
    expect(fromFlat6).toBeTruthy();
    expect(fromIdentity).toBeTruthy();
    expect(fromFlat6).toBe(fromTiered);
    expect(fromIdentity).toBe(fromTiered);
    // The inversion, stated plainly (Rulings V1 endorsed constraint).
    expect(fromTiered).toContain("soft preferences outrank framework defaults and your archetype stance");
    // Layer 3 modulates HOW, never WHETHER.
    expect(fromTiered).toMatch(/HOW[\s\S]*never WHETHER/);
  });

  it('the pricing doctrine replaces prohibition — an exit needs a reason, restraint lives in physics', () => {
    flagState.profitTarget = true;
    const s = allSurfaces();
    for (const text of [s.tiered, s.flat6]) {
      expect(text).toContain('An exit needs a reason');
      expect(text).toContain('not merely a green number');
      // The deletion is not a loosening: the prose names the physics.
      expect(text).toMatch(/hurdle floor|swap-window|cooldown/);
    }
  });

  it('no blanket prohibition anywhere: no "Do NOT sell" phrasing survives in either variant', () => {
    flagState.profitTarget = true;
    const s = allSurfaces();
    expect(s.tiered).not.toMatch(/Do NOT sell/);
    expect(s.flat6).not.toMatch(/Do NOT sell/);
  });
});

// ==================== PHASE B — data-adds, SX-04 render, promise source ====================

describe('Ask 1 Phase B — FLAG ON: the position line prices the exit (data-adds #1 + #3)', () => {
  const csvOn = () => {
    flagState.profitTarget = true;
    return buildPortfolioCSV(makeAssetScores(), PRICES, makeBattle(FLAT6_GAME_MODE), RANKINGS_MAP);
  };

  it('the header gains exactly the three data-add columns; flag-off header is golden-pinned unchanged', () => {
    const lines = csvOn().split('\n');
    expect(lines[0]).toBe('Symbol,Sector,Entry,$Entry,$Current,Gain%,ATR Mult,Badges,ATR%,LockNow(base/badges),NextBonus,Levels');
  });

  it('§9 cross-surface: LockNow decomposition equals the fenced scorer output that the ledger locks (same values, not a re-derivation)', () => {
    const lines = csvOn().split('\n');
    // The ledger's lockedPoints at execution = scoreResult.totalPoints
    // (agentSwapExecution); the fixture scores come from the same scorer call.
    for (const score of makeAssetScores()) {
      const row = lines.find(l => l.startsWith(`${score.symbol},`));
      const s = (n) => `${n >= 0 ? '+' : ''}${n}`;
      expect(row).toContain(`,${s(score.totalPoints)}(${s(score.basePoints)}/${s(score.bonusPoints)}),`);
      expect(score.totalPoints).toBe(score.basePoints + score.bonusPoints);
    }
  });

  it('Δ-to-next-bonus is present on EVERY held line, computed fresh from the next UNCROSSED level (never the banded red-zone helpers)', () => {
    const lines = csvOn().split('\n');
    // NVDA: effective max 1.62 → next uncrossed 2.0; (2.0 − 1.50) × 3.0 = +1.5%.
    expect(lines.find(l => l.startsWith('NVDA,'))).toContain(',+1.5%,');
    // MSFT: max 0.3 → next 1.0; (1.0 − (−0.75)) × 2.0 = +3.5%.
    expect(lines.find(l => l.startsWith('MSFT,'))).toContain(',+3.5%,');
  });

  it('Levels renders where the read exists and "-" where it does not (R12 honest-null)', () => {
    const lines = csvOn().split('\n');
    // 3.35.toFixed(1) → "3.4" (float ≈ 3.3500000000000001; toFixed convention).
    expect(lines.find(l => l.startsWith('NVDA,'))).toMatch(/,S101\.20\(-3\.2%\)\/R108\.00\(\+3\.4%\)$/);
    expect(lines.find(l => l.startsWith('MSFT,'))).toMatch(/,-$/);
  });

  it('flag OFF: the four-arg call still renders the golden bytes (the new param is inert dark)', () => {
    expect(buildPortfolioCSV(makeAssetScores(), PRICES, makeBattle(FLAT6_GAME_MODE), RANKINGS_MAP)).toBe(GOLDENS.portfolioCsvFlat6);
  });
});

describe('Ask 1 Phase B — the SX-04 render is enforcement-true on day one (Rulings V1)', () => {
  it('flag ON: the equipped target renders as a fact the engine enforces — never negotiable, earlier-in-character permitted', () => {
    flagState.profitTarget = true;
    const identity = buildAgentIdentityBlock(makeBattle(FLAT6_GAME_MODE));
    expect(identity).toContain("the user's target is 15%");
    expect(identity).toContain('The engine enforces it deterministically');
    expect(identity).toContain('You may exit earlier in character');
    expect(identity).toContain('never negotiable');
    expect(identity).not.toContain('Sell any position that gains 15% from entry.');
  });

  it('fail-honest: an SX-04 without a resolvable numeric target keeps its own text (no fabricated X)', () => {
    flagState.profitTarget = true;
    const battle = makeBattle(FLAT6_GAME_MODE);
    battle.agentContext.activeRules = [
      { id: 'sx-04', text: 'Sell winners into strength.', category: 'exit', hardness: 'soft' },
    ];
    const identity = buildAgentIdentityBlock(battle);
    expect(identity).toContain('Sell winners into strength.');
    expect(identity).not.toContain("the user's target is");
  });

  it('flag OFF: the equipped rule renders exactly as today (golden already pins the whole block)', () => {
    const identity = buildAgentIdentityBlock(makeBattle(FLAT6_GAME_MODE));
    expect(identity).toContain('Sell any position that gains 15% from entry.');
  });
});

describe('Ask 1 Phase B — review-hardening pins (STOP-1 findings A7/B3)', () => {
  it('flag ON: the loser-cutting bullet and the forward-EV question SURVIVE the §2 rewrite', () => {
    flagState.profitTarget = true;
    const s = allSurfaces();
    for (const text of [s.tiered, s.flat6]) {
      expect(text).toContain('Do NOT hold a bleeding loser just to avoid locking in a loss.');
      expect(text).toContain('which asset will earn MORE');
    }
  });

  it('flag ON: the survival replacement sentence is pinned positively (fact-of-the-environment framing)', () => {
    flagState.profitTarget = true;
    const s = allSurfaces();
    for (const text of [s.tiered, s.flat6]) {
      expect(text).toContain('Deterministic protection floors are facts of the environment.');
    }
  });

  it('flag ON: profit-taking and momentum rotation are sanctioned in the schema vocabulary (Brief V2 Ask 1, review-A 11c)', () => {
    flagState.profitTarget = true;
    const s = allSurfaces();
    for (const text of [s.tiered, s.flat6]) {
      expect(text).toContain('Profit-taking and momentum rotation are LEGITIMATE motives.');
      expect(text).toContain('swap_type');
    }
  });
});

describe('Ask 1 Phase B — the promise copy is ONE source (§9)', () => {
  it('the shared module carries the physics + the protective-precedence disclosure; the UI row consumes it (no second wording)', async () => {
    const { PROFIT_TARGET_PROMISE_DARK, PROFIT_TARGET_PROMISE_LIVE } = await import('../../src/constants/profitTargetPromise.js');
    expect(PROFIT_TARGET_PROMISE_DARK).toBe('Lock in gains once a position reaches this return.');
    for (const physics of ['next evaluation', '~every 15 min', 'market triggers', 'swapping into', 'locked near a bonus threshold', 'One exit per evaluation', 'Protective actions take precedence']) {
      expect(PROFIT_TARGET_PROMISE_LIVE).toContain(physics);
    }
    const jsx = readFileSync(join(HERE, '../../src/components/Forge/StrategyDimensions.jsx'), 'utf8');
    expect(jsx).toContain('PROFIT_TARGET_EXECUTOR_ENABLED ? PROFIT_TARGET_PROMISE_LIVE : PROFIT_TARGET_PROMISE_DARK');
    // No literal duplication of the physics copy outside the one module.
    expect(jsx).not.toContain('Sells by swapping into');
  });
});

// ==================== BOTH STATES — R5 doctrine ====================

describe('Ask 1 — R5 doctrine holds in prose (both flag states)', () => {
  it('no prompt text references swapMotive', () => {
    for (const on of [false, true]) {
      flagState.profitTarget = on;
      const s = allSurfaces();
      expect(s.tiered).not.toMatch(/swapMotive/);
      expect(s.flat6).not.toMatch(/swapMotive/);
      expect(s.identity).not.toMatch(/swapMotive/);
    }
  });
});
