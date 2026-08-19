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
import {
  SYSTEM_PROMPT_ARGS, PRICES, makeBattle, makeAssetScores,
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
