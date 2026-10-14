// api/_utils/evalCryptoSlotBlock.test.js
//
// Crypto Slot paragraph (Fable build prompt, 14 Oct 2026; build report
// docs/audits/20261014_BUILD_CRYPTO_SLOT_PROMPT.md §4). The contract of the
// YOUR CRYPTO SLOT block and of its one fenced splice:
//
//   FLAG OFF — the render is '' and every eval system prompt (six archetypes ×
//     the tiered mode, the undefined and unknown modes, and flat6) is
//     byte-identical to the pre-change render captured from the clean tree
//     (__fixtures__/cryptoSlotPromptGoldens.json — never regenerated).
//   FLAG ON — the block appears exactly once in the tiered prompt, exactly
//     between the last SCORING RULES line and ━━━ DECISION FRAMEWORK ━━━, for
//     every archetype and for an undefined or unknown game mode; the flat6
//     prompt carries no crypto at either flag state; the identity placement,
//     the Ask 2 absolutes, the seven-qualifier count and the "Do NOT sell"
//     ban all still hold; the probe's splice helper reproduces the flag-on
//     build byte for byte.
//
// Both flags are walked through vi.mock getters (importOriginal spread — the
// safe pattern), so nothing here moves when CRYPTO_SLOT_PROMPT_ENABLED or
// EQUIPPED_RULE_PRECEDENCE_ENABLED flips. The two other flags the system
// prompt reads, EVAL_IDENTITY_BLOCK_ENABLED and PROFIT_TARGET_EXECUTOR_ENABLED,
// are pinned to their values at capture (true, true — the fixture's
// capturedAt), so the never-regenerated capture stays the text of record if
// either is ever walked back. The crypto list is mocked through a getter too
// (transparent unless a row sets it), which is what proves the symbols are
// read from agentCryptoAssets.js rather than typed.
//
// NOTE (BUILD_RULES §4 dependency-surface guard): this file's UNMOCKED imports
// of evalCryptoSlotBlock.js and the fenced assembler are the runtime guard for
// their api → src imports. Never mock them.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { flagState, assetState } = vi.hoisted(() => ({
  flagState: { crypto: false, precedence: false },
  assetState: { list: null },
}));
vi.mock('../../src/config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get CRYPTO_SLOT_PROMPT_ENABLED() { return flagState.crypto; },
  get EQUIPPED_RULE_PRECEDENCE_ENABLED() { return flagState.precedence; },
  get EVAL_IDENTITY_BLOCK_ENABLED() { return true; },
  get PROFIT_TARGET_EXECUTOR_ENABLED() { return true; },
}));
vi.mock('./agentCryptoAssets.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    get CRYPTO_ASSETS() { return assetState.list ?? actual.CRYPTO_ASSETS; },
    get VALID_CRYPTO_SYMBOLS() { return assetState.list ? assetState.list.map((a) => a.symbol) : actual.VALID_CRYPTO_SYMBOLS; },
  };
});
vi.mock('./firebaseAdmin.js', () => ({ getFirebaseAdmin: () => ({}) }));

import {
  CRYPTO_SLOT_BANNER,
  CRYPTO_SLOT_SPLICE_ANCHOR,
  cryptoSymbolList,
  renderCryptoSlotParagraph,
  renderCryptoSlotBlock,
  renderCryptoSlotBlockForced,
  spliceCryptoSlotBlock,
} from './evalCryptoSlotBlock.js';
import { buildEvalSystemPrompt } from './agentEvalPromptAssembly.js';
import { renderEvalIdentityBlock } from './evalIdentityBlocks.js';
import { VALID_CRYPTO_SYMBOLS } from './agentCryptoAssets.js';
import { TIERED_GAME_MODE, FLAT6_GAME_MODE } from '../../src/constants/agentGameModes.js';
import { FORBIDDEN_SIGNALS, REQUIRED_SIGNALS, PROMPT_CONTRIBUTING_MODULES } from './__fixtures__/promptHonestyRegistry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDENS = JSON.parse(readFileSync(join(HERE, '__fixtures__/cryptoSlotPromptGoldens.json'), 'utf8'));
const KEYS = ['momentum_chaser', 'contrarian', 'diversifier', 'degen', 'analyst', 'guardian'];
// Every mode that resolves to the tiered template: explicit, omitted (the
// default parameter), and unknown (resolveModeConfig's fallback —
// p4Equivalence.battery.test.js's tiered/unknown invariant).
const TIERED_MODES = [['explicit', TIERED_GAME_MODE], ['undefined', undefined], ['unknown', 'something_else']];
// The cron's display transform (agent-evaluate.js) — the golden's convention.
const displayLabel = (key) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const tiered = (key, mode = TIERED_GAME_MODE) => buildEvalSystemPrompt('TestAgent', displayLabel(key), mode, key);
const flat6 = (key) => buildEvalSystemPrompt('TestAgent', displayLabel(key), FLAT6_GAME_MODE, key);

const BEFORE = 'starts scoring fresh from its price at swap time.\n';
const AFTER = '\n━━━ DECISION FRAMEWORK ━━━';

// The paragraph text of record (Fable, 14 Oct 2026 — build prompt §3), with
// {SYMBOLS} rendered. Typed here on purpose: this is the wording lock.
const PARAGRAPH_OF_RECORD = [
  'Your portfolio holds six stocks and one crypto. The crypto sits in your third Support slot. The crypto names in this game are BTC, ETH, SOL, XRP, DOGE, ADA and BNB — go by the symbol, since the Sector column can read Unknown after a swap.',
  '- Crypto swaps only for crypto, and a stock swaps only for a stock. The platform refuses any swap that pairs a crypto with a stock, and that check ends as a HOLD.',
  '- So your crypto slot has two moves: hold it, or swap it for the one crypto on your bench. The usual swap checks apply to that swap too: cooldown, conviction, and the hurdle floor (the incoming crypto must be up on the day and clear the one you hold by a margin).',
  '- The SECTOR AWARENESS guidance applies to your stock slots only.',
  '- Every position you hold, crypto included, is long. You cannot open or flip a short.',
].join('\n');

// The platform floors Ask 2 ruled ABSOLUTE (agentEvalPromptAssembly.ask2.test.js
// ABSOLUTES). Copied verbatim; the sync row below fails if that list's text
// changes and this copy does not.
const ASK2_ABSOLUTES = [
  '- LOCKED positions CANNOT be swapped out. Only hard stops override locks.',
  `━━━ ANTI-THRASH RULES (MANDATORY) ━━━

- COOLDOWN: You CANNOT swap in a stock that is marked "locked until [time]"
  in the BENCH table. It is OFF LIMITS regardless of how attractive it looks.
- ONE SWAP MAXIMUM per evaluation. Never suggest multiple swaps.
- NO ROUND-TRIPS: If you swapped A→B recently, do not swap B→A just
  because A recovered. Trust your original thesis or wait for the
  cooldown to expire.`,
  `- distressed: High volatility + downtrend. STRICT EXCLUSION. Do NOT buy distressed
  stocks. If held, evaluate for swap-out immediately.`,
  'You have explicit permission to OVERRIDE user directives if live data shows a position has breached -1.0x ATR (Bust) or is accelerating toward it with no sign of reversal. If you override a directive, you MUST set ignoredDirectiveIds',
  `8. CONVICTION THRESHOLD: If your conviction for a SWAP is below 70%, you
   MUST output decision "HOLD". Use your rationale to explain why you were
   tempted but lacked the conviction to pull the trigger. Marginal edges
   are not worth the cost of resetting a scoring baseline.`,
  `6. THRESHOLD PROXIMITY:
   - If an active stock is within 0.2x ATR of a bonus (+15/+30/+50), HOLD.
     Let it earn the bonus.
   - If an active stock is within 0.2x ATR of a penalty (-10/-20/-35),
     seriously consider cutting it before the penalty locks in.`,
  '- defensive: Capital preservation. Swaps are defensive only (cut losers). Do not chase.',
  '- CONSTRAINTS (C1, C2, ...) are HARD rules — you must obey them unless Survival Mode activates.',
  'RSI-14 > 80 and turns down',
];
const QUALIFIER = /absent an equipped user rule/gi;

afterEach(() => {
  flagState.crypto = false;
  flagState.precedence = false;
  assetState.list = null;
});

// ==================== the module ====================

describe('the render module', () => {
  it('flag off → renderCryptoSlotBlock() is the empty string', () => {
    flagState.crypto = false;
    expect(renderCryptoSlotBlock()).toBe('');
  });

  it('flag on → banner, one blank line, the paragraph, framed by single newlines', () => {
    flagState.crypto = true;
    expect(renderCryptoSlotBlock()).toBe(`\n━━━ YOUR CRYPTO SLOT ━━━\n\n${PARAGRAPH_OF_RECORD}\n`);
    expect(CRYPTO_SLOT_BANNER).toBe('━━━ YOUR CRYPTO SLOT ━━━');
  });

  it('reads the flag at CALL time — the same import renders both states in one test', () => {
    flagState.crypto = false;
    expect(renderCryptoSlotBlock()).toBe('');
    flagState.crypto = true;
    expect(renderCryptoSlotBlock()).toBe(renderCryptoSlotBlockForced());
    flagState.crypto = false;
    expect(renderCryptoSlotBlock()).toBe('');
  });

  it('the forced render ignores the flag (offline probe only)', () => {
    flagState.crypto = false;
    expect(renderCryptoSlotBlockForced()).toBe(`\n${CRYPTO_SLOT_BANNER}\n\n${renderCryptoSlotParagraph()}\n`);
  });

  it('the paragraph is the text of record, word for word', () => {
    expect(renderCryptoSlotParagraph()).toBe(PARAGRAPH_OF_RECORD);
  });

  it('the symbol list equals VALID_CRYPTO_SYMBOLS joined "A, B, … and Z"', () => {
    const joined = `${VALID_CRYPTO_SYMBOLS.slice(0, -1).join(', ')} and ${VALID_CRYPTO_SYMBOLS.at(-1)}`;
    expect(cryptoSymbolList()).toBe(joined);
    expect(cryptoSymbolList()).toBe('BTC, ETH, SOL, XRP, DOGE, ADA and BNB');
    expect(renderCryptoSlotParagraph()).toContain(`The crypto names in this game are ${joined} — go by the symbol`);
  });

  it('the symbols are READ from agentCryptoAssets.js, never typed — the render follows the list', () => {
    assetState.list = [
      { symbol: 'AAA', isCrypto: true }, { symbol: 'BBB', isCrypto: true }, { symbol: 'CCC', isCrypto: true },
    ];
    expect(cryptoSymbolList()).toBe('AAA, BBB and CCC');
    expect(renderCryptoSlotParagraph()).toContain('The crypto names in this game are AAA, BBB and CCC — go by the symbol');
    expect(renderCryptoSlotParagraph()).not.toMatch(/\bBTC\b|\bBNB\b/);
  });

  it('wording constraints: no "Do NOT sell", no forbidden signal, no Ask 2 qualifier — in the render and the module source', () => {
    const source = readFileSync(join(HERE, 'evalCryptoSlotBlock.js'), 'utf8');
    for (const text of [renderCryptoSlotBlockForced(), source]) {
      expect(text).not.toMatch(/Do NOT sell/);
      expect(text).not.toMatch(QUALIFIER);
      for (const [label, re] of FORBIDDEN_SIGNALS) expect(re.test(text), label).toBe(false);
    }
  });

  it('is registered in PROMPT_CONTRIBUTING_MODULES (BUILD_RULES §1 flag-split prose rule)', () => {
    expect(PROMPT_CONTRIBUTING_MODULES).toContain('evalCryptoSlotBlock.js');
  });
});

// ==================== FLAG OFF — byte-identical ====================

describe('FLAG OFF — every eval system prompt is byte-identical to the pre-change capture', () => {
  it.each(KEYS)('%s: tiered (explicit, undefined and unknown mode) === the captured tiered prompt', (key) => {
    flagState.crypto = false;
    for (const [, mode] of TIERED_MODES) expect(tiered(key, mode)).toBe(GOLDENS.systemTiered[key]);
  });

  it.each(KEYS)('%s: flat6 === the captured flat6 prompt', (key) => {
    flagState.crypto = false;
    expect(flat6(key)).toBe(GOLDENS.systemFlat6[key]);
  });

  it('the capture is the crypto-free text of record (no block, no "crypto" in either variant)', () => {
    for (const key of KEYS) {
      expect(GOLDENS.systemTiered[key]).not.toMatch(/crypto/i);
      expect(GOLDENS.systemFlat6[key]).not.toMatch(/crypto/i);
      expect(GOLDENS.systemTiered[key].split(CRYPTO_SLOT_SPLICE_ANCHOR)).toHaveLength(2);
    }
  });
});

// ==================== FLAG ON — placement ====================

describe('FLAG ON — the block sits once, between SCORING RULES and DECISION FRAMEWORK', () => {
  it.each(KEYS)('%s: tiered (explicit, undefined and unknown mode) === the capture with the block spliced in at the blank line', (key) => {
    flagState.crypto = true;
    const block = renderCryptoSlotBlockForced();
    const expected = GOLDENS.systemTiered[key].replace(`${BEFORE}${AFTER}`, `${BEFORE}${block}${AFTER}`);
    expect(expected).not.toBe(GOLDENS.systemTiered[key]);
    for (const [, mode] of TIERED_MODES) {
      const out = tiered(key, mode);
      expect(out).toBe(expected);
      expect(out.split(CRYPTO_SLOT_BANNER)).toHaveLength(2);
      const at = out.indexOf(CRYPTO_SLOT_BANNER);
      expect(out.indexOf('━━━ SCORING RULES ━━━')).toBeLessThan(at);
      expect(at).toBeLessThan(out.indexOf('━━━ DECISION FRAMEWORK ━━━'));
      expect(out).toContain(`swap time.\n\n${CRYPTO_SLOT_BANNER}\n\n${PARAGRAPH_OF_RECORD}\n\n━━━ DECISION FRAMEWORK ━━━`);
    }
  });

  it.each(KEYS)('%s: the probe splice of the flag-off prompt === the flag-on build, whatever the flag (spliceCryptoSlotBlock is locked to production)', (key) => {
    flagState.crypto = true;
    const flagOnBuild = tiered(key);
    for (const state of [true, false]) {
      flagState.crypto = state;
      expect(spliceCryptoSlotBlock(GOLDENS.systemTiered[key])).toBe(flagOnBuild);
    }
  });

  it('the probe splice refuses what it cannot place: flat6, an already-spliced prompt, a missing or doubled anchor', () => {
    flagState.crypto = true;
    const tierLine = 'Tier multipliers: Star = 2.0x, Core = 1.5x, Support = 1.0x\n';
    // flat6 shares the anchor lines; the tiered scoring line is what refuses it.
    for (const key of KEYS) {
      expect(GOLDENS.systemFlat6[key].split(CRYPTO_SLOT_SPLICE_ANCHOR)).toHaveLength(2);
      expect(spliceCryptoSlotBlock(GOLDENS.systemFlat6[key])).toBeNull();
    }
    expect(spliceCryptoSlotBlock(tiered('analyst'))).toBeNull();
    // A prompt that still has the anchor but already carries the banner elsewhere.
    expect(spliceCryptoSlotBlock(`${tierLine}${CRYPTO_SLOT_BANNER}\n${CRYPTO_SLOT_SPLICE_ANCHOR}`)).toBeNull();
    expect(spliceCryptoSlotBlock(`${tierLine}no anchor here`)).toBeNull();
    expect(spliceCryptoSlotBlock(`${tierLine}${CRYPTO_SLOT_SPLICE_ANCHOR}${CRYPTO_SLOT_SPLICE_ANCHOR}`)).toBeNull();
    expect(spliceCryptoSlotBlock(`${tierLine}${CRYPTO_SLOT_SPLICE_ANCHOR}`)).not.toBeNull();
    expect(spliceCryptoSlotBlock(undefined)).toBeNull();
  });
});

// ==================== flat6 — no crypto, either state ====================

describe('flat6 carries no crypto at either flag state (the negative Phase 0 Q7 found missing)', () => {
  it.each([false, true])('CRYPTO_SLOT_PROMPT_ENABLED=%s: no "crypto" in any flat6 prompt, byte-identical to the capture', (on) => {
    flagState.crypto = on;
    for (const key of KEYS) {
      const out = flat6(key);
      expect(out).not.toMatch(/crypto/i);
      expect(out).not.toContain(CRYPTO_SLOT_BANNER);
      expect(out).toBe(GOLDENS.systemFlat6[key]);
    }
  });
});

// ==================== FLAG ON — the neighbours still hold ====================

describe('FLAG ON — identity placement, the Ask 2 floors, the qualifier count and the Ask 1 ban still hold', () => {
  it.each(KEYS)('%s: the identity block still sits between the preamble and SCORING RULES, before the crypto block', (key) => {
    flagState.crypto = true;
    const out = tiered(key);
    const identity = renderEvalIdentityBlock(key);
    expect(identity).not.toBe('');
    expect(out).toContain(`maximize your score.\n${identity}\n━━━ SCORING RULES ━━━`);
    expect(out.indexOf('━━━ ARCHETYPE IDENTITY ━━━')).toBeLessThan(out.indexOf(CRYPTO_SLOT_BANNER));
  });

  it.each([false, true])('the Ask 2 absolutes are byte-identical in both variants (EQUIPPED_RULE_PRECEDENCE_ENABLED=%s)', (precedence) => {
    flagState.crypto = true;
    flagState.precedence = precedence;
    for (const key of KEYS) {
      for (const text of [tiered(key), flat6(key)]) {
        for (const verbatim of ASK2_ABSOLUTES) expect(text).toContain(verbatim);
      }
    }
  });

  it('the copied absolutes still match the Ask 2 suite\'s list (sync row)', () => {
    const ask2Source = readFileSync(join(HERE, 'agentEvalPromptAssembly.ask2.test.js'), 'utf8').replace(/\r\n/g, '\n');
    for (const verbatim of ASK2_ABSOLUTES) expect(ask2Source).toContain(verbatim);
  });

  it('exactly seven qualifiers per system prompt with both flags on — the block adds none', () => {
    flagState.crypto = true;
    flagState.precedence = true;
    for (const key of KEYS) {
      for (const text of [tiered(key), flat6(key)]) expect(text.match(QUALIFIER)?.length ?? 0).toBe(7);
    }
  });

  it('no "Do NOT sell" in either variant', () => {
    flagState.crypto = true;
    for (const key of KEYS) {
      expect(tiered(key)).not.toMatch(/Do NOT sell/);
      expect(flat6(key)).not.toMatch(/Do NOT sell/);
    }
  });

  it('C-20 honesty holds flag-on: no forbidden signal named, every required signal still cited', () => {
    flagState.crypto = true;
    for (const key of KEYS) {
      const text = tiered(key);
      for (const [label, re] of FORBIDDEN_SIGNALS) expect(re.test(text), `${label} in ${key}`).toBe(false);
      for (const [label, re] of REQUIRED_SIGNALS) expect(re.test(text), `${label} lost from ${key}`).toBe(true);
    }
  });
});
