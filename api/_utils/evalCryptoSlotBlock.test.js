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
// Crypto Slot v2 (build report docs/audits/20261014_BUILD_CRYPTO_SLOT_CHECK_LINE.md
// §5) adds the live-context contract:
//
//   FLAG OFF — every captured live context (__fixtures__/cryptoSlotLiveContextGoldens.json,
//     the step 0.3 pre-change capture — never regenerated) renders byte for
//     byte, even with a verdict on momentumData.
//   FLAG ON — the CRYPTO SLOT THIS CHECK line, Fable's final text (rulings
//     R-a/R-b), sits exactly once in the tiered live context, immediately
//     before RISK STATUS (or in that slot when RISK STATUS does not render);
//     never in flat6; never without a verdict. Its number prints as the BENCH
//     table prints it. The annotation lands only on the held crypto's
//     SWAP_OUT line and only when the verdict is "you cannot swap". The
//     probe's live-context splice reproduces the flag-on build byte for byte.
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

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
  CRYPTO_SLOT_LINE_LEAD,
  CRYPTO_SLOT_ANNOTATION,
  CRYPTO_SLOT_REASONS,
  cryptoSymbolList,
  renderCryptoSlotParagraph,
  renderCryptoSlotBlock,
  renderCryptoSlotBlockForced,
  spliceCryptoSlotBlock,
  isRenderableCryptoSlotVerdict,
  renderCryptoSlotCheckLine,
  renderCryptoSlotCheckLineForced,
  annotateCryptoSlotRiskStatus,
  annotateCryptoSlotRiskStatusForced,
  spliceCryptoSlotLiveContext,
} from './evalCryptoSlotBlock.js';
import { buildEvalSystemPrompt, buildLiveContextBlock } from './agentEvalPromptAssembly.js';
import { CASES, MACRO, PRESET, TRIGGERS, NOW, PRICES, scoresFor, momentumFor } from './__fixtures__/cryptoSlotLiveContextCases.js';
import { renderEvalIdentityBlock } from './evalIdentityBlocks.js';
import { VALID_CRYPTO_SYMBOLS } from './agentCryptoAssets.js';
import { TIERED_GAME_MODE, FLAT6_GAME_MODE } from '../../src/constants/agentGameModes.js';
import { FORBIDDEN_SIGNALS, REQUIRED_SIGNALS, PROMPT_CONTRIBUTING_MODULES } from './__fixtures__/promptHonestyRegistry.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDENS = JSON.parse(readFileSync(join(HERE, '__fixtures__/cryptoSlotPromptGoldens.json'), 'utf8'));
const LIVE_GOLDENS = JSON.parse(readFileSync(join(HERE, '__fixtures__/cryptoSlotLiveContextGoldens.json'), 'utf8'));
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

// The paragraph text of record — v2 (Fable, 14 Oct 2026: the v2 build prompt
// §4, bullet 2 as ruled in R-a), with {SYMBOLS} rendered. Typed here on
// purpose: this is the wording lock.
const PARAGRAPH_OF_RECORD = [
  'Your portfolio holds six stocks and one crypto, in your third Support slot. The crypto names in this game are BTC, ETH, SOL, XRP, DOGE, ADA and BNB — go by the symbol, since the Sector column can read Unknown after a swap.',
  '- A crypto can only be replaced by a crypto, and a stock by a stock. Any swap you propose that pairs a crypto with a stock is refused and ends as a HOLD.',
  '- Your crypto slot can hold, or swap for the one crypto on your bench. Each check tells you which you can do: read the CRYPTO SLOT THIS CHECK line. When it says you cannot swap, hold your crypto — even if RISK STATUS flags it SWAP_OUT. If you want to make a move that check, it has to be in a stock slot.',
  '- The SECTOR AWARENESS guidance and any sector-gap reasoning apply to your stock slots only.',
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

// ==================== v2 — THE PER-CHECK LINE AND THE ANNOTATION ====================

// Fable's final text (rulings R-a / R-b, 14 Oct 2026), typed: the wording lock.
const LINE_CANNOT = (held, reason) => `CRYPTO SLOT THIS CHECK: you cannot swap ${held} this check — ${reason}. Hold it.`;
const LINE_CAN = (held, bench, daily) => `CRYPTO SLOT THIS CHECK: you can swap ${held} for ${bench} (${bench} ${daily}% on the day, clears the hurdle). It needs conviction 70 or higher. Whether to do it is your call.`;
const REASON_TEXT = {
  lock: (v) => `${v.held} is LOCKED`,
  cooldown: (v) => `${v.bench} was swapped out less than 24 hours ago and is on cooldown`,
  not_up: (v, d) => `${v.bench} is ${d}% on the day, and an incoming crypto must be up on the day`,
  margin: (v, d) => `${v.bench} is up ${d}% on the day but does not clear ${v.held} by the hurdle margin`,
  swap_cap: () => 'you have reached the swap limit for this window',
};
const ANNOTATION_OF_RECORD = ' — you cannot swap it this check; hold';
// The BENCH table's Daily% formatter (agentEvalPromptAssembly.js formatPct), as
// the renderer's caller supplies it; the live-context rows below prove the line
// prints the table's own cell.
const tableFormat = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
const V = (over = {}) => ({ held: 'BTC', bench: 'ETH', canSwap: false, reason: 'not_up', benchDailyPct: -1.12, ...over });
const TIERED_BATTLE = { gameMode: TIERED_GAME_MODE };
const FLAT6_BATTLE = { gameMode: FLAT6_GAME_MODE };

describe('v2 — the CRYPTO SLOT THIS CHECK line (Fable\'s final text)', () => {
  it('the five reasons are the gates\' order at HEAD (ruling R-b): LOCK → cooldown → not up → margin → swap cap', () => {
    expect(CRYPTO_SLOT_REASONS).toEqual(['lock', 'cooldown', 'not_up', 'margin', 'swap_cap']);
  });

  it.each([
    ['lock', -1.12, '-1.12'],
    ['cooldown', 2.1, '+2.10'],
    ['not_up', -1.12, '-1.12'],
    ['not_up', -0.004, '-0.00'],
    ['margin', 0.5, '+0.50'],
    ['margin', 0.004, '+0.00'],
    ['swap_cap', 3.3, '+3.30'],
  ])('cannot — %s (bench %s) renders the ruled sentence, word for word', (reason, daily, printed) => {
    const v = V({ reason, benchDailyPct: daily });
    expect(renderCryptoSlotCheckLineForced(v, tableFormat)).toBe(LINE_CANNOT('BTC', REASON_TEXT[reason](v, printed)));
  });

  it('can — renders the ruled sentence, word for word, with the bench crypto\'s daily move as the table prints it', () => {
    expect(renderCryptoSlotCheckLineForced(V({ canSwap: true, reason: null, benchDailyPct: 2.1 }), tableFormat)).toBe(LINE_CAN('BTC', 'ETH', '+2.10'));
    expect(renderCryptoSlotCheckLineForced(V({ held: 'ETH', bench: 'BTC', canSwap: true, reason: null, benchDailyPct: 0.004 }), tableFormat)).toBe(LINE_CAN('ETH', 'BTC', '+0.00'));
  });

  it('the symbols are the verdict\'s, never typed (held ETH / bench SOL)', () => {
    expect(renderCryptoSlotCheckLineForced(V({ held: 'ETH', bench: 'SOL', reason: 'cooldown' }), tableFormat)).toBe(LINE_CANNOT('ETH', 'SOL was swapped out less than 24 hours ago and is on cooldown'));
    expect(renderCryptoSlotCheckLineForced(V({ held: 'ETH', bench: 'SOL', reason: 'lock' }), tableFormat)).toBe(LINE_CANNOT('ETH', 'ETH is LOCKED'));
  });

  it('a verdict it cannot render renders nothing — never a guessed sentence', () => {
    const bad = [
      null, undefined, 'x', {},
      V({ reason: 'distressed' }), V({ reason: null }), V({ canSwap: true, reason: 'lock' }), V({ canSwap: 'yes' }),
      V({ held: '' }), V({ bench: undefined }), V({ benchDailyPct: Number.NaN }), V({ benchDailyPct: '1.2' }),
    ];
    for (const v of bad) {
      expect(isRenderableCryptoSlotVerdict(v)).toBe(false);
      expect(renderCryptoSlotCheckLineForced(v, tableFormat)).toBeNull();
    }
    expect(renderCryptoSlotCheckLineForced(V(), undefined)).toBeNull();
  });

  it('dark: renderCryptoSlotCheckLine is null with the flag off, read at call time; flat6 is refused at either state', () => {
    flagState.crypto = false;
    expect(renderCryptoSlotCheckLine(TIERED_BATTLE, V(), tableFormat)).toBeNull();
    flagState.crypto = true;
    expect(renderCryptoSlotCheckLine(TIERED_BATTLE, V(), tableFormat)).toBe(renderCryptoSlotCheckLineForced(V(), tableFormat));
    expect(renderCryptoSlotCheckLine({}, V(), tableFormat)).toBe(renderCryptoSlotCheckLineForced(V(), tableFormat)); // an omitted mode is tiered
    expect(renderCryptoSlotCheckLine(FLAT6_BATTLE, V(), tableFormat)).toBeNull();
    flagState.crypto = false;
    expect(renderCryptoSlotCheckLine(TIERED_BATTLE, V(), tableFormat)).toBeNull();
  });

  it('L4 honesty: the line speaks of the agent\'s own swap only — never of what the engine will do (ruling R-a)', () => {
    const renders = [
      ...CRYPTO_SLOT_REASONS.map((reason) => renderCryptoSlotCheckLineForced(V({ reason }), tableFormat)),
      renderCryptoSlotCheckLineForced(V({ canSwap: true, reason: null, benchDailyPct: 2 }), tableFormat),
      `x${ANNOTATION_OF_RECORD}`,
      renderCryptoSlotParagraph(),
    ];
    for (const text of renders) {
      expect(text).not.toMatch(/no swap is possible|no legal replacement|swap is (?:possible|allowed)|is allowed/i);
      expect(text).not.toMatch(/Do NOT sell|range position/);
      expect(text).not.toMatch(QUALIFIER);
      for (const [label, re] of FORBIDDEN_SIGNALS) expect(re.test(text), label).toBe(false);
    }
    for (const reason of CRYPTO_SLOT_REASONS) expect(renderCryptoSlotCheckLineForced(V({ reason }), tableFormat)).toMatch(/^CRYPTO SLOT THIS CHECK: you cannot swap BTC this check — .+\. Hold it\.$/);
    expect(CRYPTO_SLOT_LINE_LEAD).toBe('CRYPTO SLOT THIS CHECK: ');
  });
});

describe('v2 — the RISK STATUS annotation', () => {
  const BLOCK = 'RISK STATUS:\nNVDA: HOLD\nJPM: SWAP_OUT (vwap_failure)\nBTC: SWAP_OUT (stagnation)';
  it('the annotation text of record', () => {
    expect(CRYPTO_SLOT_ANNOTATION).toBe(ANNOTATION_OF_RECORD);
  });

  it('lands on the held crypto\'s SWAP_OUT line when the verdict is "cannot" — and nowhere else', () => {
    for (const reason of CRYPTO_SLOT_REASONS) {
      expect(annotateCryptoSlotRiskStatusForced(BLOCK, V({ reason }))).toBe(`RISK STATUS:\nNVDA: HOLD\nJPM: SWAP_OUT (vwap_failure)\nBTC: SWAP_OUT (stagnation)${ANNOTATION_OF_RECORD}`);
    }
    expect(annotateCryptoSlotRiskStatusForced('RISK STATUS:\nBTC: SWAP_OUT (vwap_failure)\nNVDA: HOLD', V())).toBe(`RISK STATUS:\nBTC: SWAP_OUT (vwap_failure)${ANNOTATION_OF_RECORD}\nNVDA: HOLD`);
  });

  it('never when the verdict is "can", never on a stock line, never on LOCKED / EMERGENCY_SWAP / TRAIL_STOP / HOLD', () => {
    expect(annotateCryptoSlotRiskStatusForced(BLOCK, V({ canSwap: true, reason: null }))).toBe(BLOCK);
    expect(annotateCryptoSlotRiskStatusForced(BLOCK, V({ held: 'ETH' }))).toBe(BLOCK); // the held crypto has no SWAP_OUT line; JPM's is a stock's
    for (const line of ['BTC: LOCKED (BTC at +0.85x ATR)', 'BTC: EMERGENCY_SWAP (bust_avoidance)', 'BTC: TRAIL_STOP (stepped_trail)', 'BTC: HOLD']) {
      const block = `RISK STATUS:\nJPM: SWAP_OUT (stagnation)\n${line}`;
      expect(annotateCryptoSlotRiskStatusForced(block, V())).toBe(block);
    }
  });

  it('returns its input unchanged for anything it cannot place with certainty', () => {
    const doubled = 'RISK STATUS:\nBTC: SWAP_OUT (stagnation)\nBTC: SWAP_OUT (vwap_failure)';
    for (const [block, v] of [[null, V()], [undefined, V()], [BLOCK, null], [BLOCK, V({ reason: 'bogus' })], [doubled, V()], ['BTC: SWAP_OUT (stagnation)', V()], ['NOT RISK:\nBTC: SWAP_OUT (stagnation)', V()]]) {
      expect(annotateCryptoSlotRiskStatusForced(block, v)).toBe(block);
    }
  });

  it('dark and flat6: the assembler-facing annotate returns the block unchanged', () => {
    flagState.crypto = false;
    expect(annotateCryptoSlotRiskStatus(TIERED_BATTLE, BLOCK, V())).toBe(BLOCK);
    flagState.crypto = true;
    expect(annotateCryptoSlotRiskStatus(FLAT6_BATTLE, BLOCK, V())).toBe(BLOCK);
    expect(annotateCryptoSlotRiskStatus(TIERED_BATTLE, BLOCK, V())).toBe(annotateCryptoSlotRiskStatusForced(BLOCK, V()));
  });
});

// ==================== v2 — THE LIVE CONTEXT, THROUGH THE REAL FENCED ASSEMBLER ====================

// Render drivers: the verdict each row hands the assembler. They match what
// cryptoSlotVerdict.js returns for these books — except
// tiered.stock-swapout.btc-hold, which drives the swap-limit text through the
// assembler (that book has no trades; its real verdict is not_up). These rows
// prove the RENDER; verdict = gate is proven end to end in
// api/cron/agent-evaluate.cryptoSlotLine.test.js.
const CASE_VERDICTS = {
  'tiered.btc-swapout-stagnation.eth-down': V(),
  'tiered.btc-swapout-stagnation.eth-up': V({ canSwap: true, reason: null, benchDailyPct: 2.1 }),
  'tiered.btc-swapout-vwap.eth-down': V(),
  'tiered.all-hold': V(),
  'tiered.riskstatus-null': V(),
  'tiered.btc-locked': V({ reason: 'lock', benchDailyPct: 2.1 }),
  'tiered.stock-swapout.btc-hold': V({ reason: 'swap_cap' }),
  'tiered.btc-swapout.eth-cooldown': V({ reason: 'cooldown', benchDailyPct: 2.1 }),
  'tiered.btc-emergency': V(),
  'tiered.held-eth.unknown-sectors.btc-cooldown': V({ held: 'ETH', bench: 'BTC', reason: 'cooldown', benchDailyPct: -1.41 }),
};
// Where the annotation must land in each case (null: nowhere).
const ANNOTATED = {
  'tiered.btc-swapout-stagnation.eth-down': 'BTC: SWAP_OUT (stagnation)',
  'tiered.btc-swapout-vwap.eth-down': 'BTC: SWAP_OUT (vwap_failure)',
  'tiered.btc-swapout.eth-cooldown': 'BTC: SWAP_OUT (stagnation)',
  'tiered.held-eth.unknown-sectors.btc-cooldown': 'ETH: SWAP_OUT (stagnation)',
};
const TRIGGER_PART = 'TRIGGER (why you were woken up):\n- price_move: NVDA moved 1.0% since last eval';

async function renderCase(name, verdict) {
  const [battle, prices, riskStatus] = CASES[name]();
  const momentumData = momentumFor(riskStatus);
  if (verdict !== undefined) momentumData.cryptoSlotVerdict = verdict;
  return buildLiveContextBlock(battle, prices, MACRO, scoresFor(battle), TRIGGERS, [], battle.evaluations, momentumData, PRESET);
}

/** The flag-on text, built independently of the module's splice helper. */
function expectedFlagOn(name, verdict) {
  const captured = LIVE_GOLDENS.cases[name].text;
  const line = renderCryptoSlotCheckLineForced(verdict, tableFormat);
  let out = captured.includes('\n\nRISK STATUS:\n')
    ? captured.replace('\n\nRISK STATUS:\n', `\n\n${line}\n\nRISK STATUS:\n`)
    : captured.replace(TRIGGER_PART, `${TRIGGER_PART}\n\n${line}`);
  if (ANNOTATED[name]) out = out.replace(`\n${ANNOTATED[name]}`, `\n${ANNOTATED[name]}${ANNOTATION_OF_RECORD}`);
  return out;
}

describe('v2 — FLAG OFF: every captured live context is byte-identical (step 0.3 capture)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: NOW }); });
  afterEach(() => { vi.useRealTimers(); });

  it('the capture is the pre-change text of record: twelve cases, its own hashes, no line and no annotation', () => {
    expect(Object.keys(LIVE_GOLDENS.cases)).toEqual(Object.keys(CASES));
    expect(LIVE_GOLDENS.flags).toEqual({ CRYPTO_SLOT_PROMPT_ENABLED: false, PROFIT_TARGET_EXECUTOR_ENABLED: true });
    for (const { sha256, text } of Object.values(LIVE_GOLDENS.cases)) {
      expect(createHash('sha256').update(text, 'utf8').digest('hex')).toBe(sha256);
      expect(text).not.toContain(CRYPTO_SLOT_LINE_LEAD);
      expect(text).not.toContain(ANNOTATION_OF_RECORD);
    }
  });

  it.each(Object.keys(CASES))('%s: flag off renders the capture — with no verdict, and with a verdict on momentumData', async (name) => {
    flagState.crypto = false;
    expect(await renderCase(name)).toBe(LIVE_GOLDENS.cases[name].text);
    expect(await renderCase(name, CASE_VERDICTS[name] ?? V())).toBe(LIVE_GOLDENS.cases[name].text);
  });
});

describe('v2 — FLAG ON: the line sits once, before RISK STATUS; the annotation only where it applies', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: NOW }); flagState.crypto = true; });
  afterEach(() => { vi.useRealTimers(); });

  it.each(Object.keys(CASE_VERDICTS))('%s: === the capture with the line in the 3e3 slot (and the annotation where it applies)', async (name) => {
    const verdict = CASE_VERDICTS[name];
    const out = await renderCase(name, verdict);
    const expected = expectedFlagOn(name, verdict);
    expect(expected).not.toBe(LIVE_GOLDENS.cases[name].text);
    expect(out).toBe(expected);
    expect(out.split(CRYPTO_SLOT_LINE_LEAD)).toHaveLength(2);
    expect(out.split(ANNOTATION_OF_RECORD)).toHaveLength(ANNOTATED[name] ? 2 : 1);
    const lineAt = out.indexOf(CRYPTO_SLOT_LINE_LEAD);
    const riskAt = out.indexOf('RISK STATUS:');
    if (riskAt !== -1) expect(out.slice(lineAt, riskAt)).toBe(`${renderCryptoSlotCheckLineForced(verdict, tableFormat)}\n\n`);
    else expect(out.indexOf(TRIGGER_PART)).toBeLessThan(lineAt);
  });

  it.each(Object.keys(CASE_VERDICTS))('%s: the probe\'s live-context splice of the capture === the flag-on build, whatever the flag', async (name) => {
    const verdict = CASE_VERDICTS[name];
    const flagOnBuild = await renderCase(name, verdict);
    for (const state of [true, false]) {
      flagState.crypto = state;
      expect(spliceCryptoSlotLiveContext(LIVE_GOLDENS.cases[name].text, verdict, tableFormat)).toBe(flagOnBuild);
    }
  });

  it('the line\'s number is the BENCH table\'s own Daily% cell (formatPct passed through — §9)', async () => {
    for (const daily of [-1.12, -0.004, 0, 0.004, 0.005, 2.1, 12.345]) {
      const [battle, , riskStatus] = CASES['tiered.all-hold']();
      const prices = PRICES(daily);
      const momentumData = momentumFor(riskStatus);
      momentumData.cryptoSlotVerdict = V({ benchDailyPct: prices.ETH.changePercent || 0 });
      const out = await buildLiveContextBlock(battle, prices, MACRO, scoresFor(battle), TRIGGERS, [], [], momentumData, PRESET);
      const cell = out.split('\n').find((l) => l.startsWith('ETH,')).split(',')[3];
      expect(out).toContain(`— ETH is ${cell} on the day, and an incoming crypto must be up on the day. Hold it.`);
    }
  });

  it('never without a verdict: a held crypto with no verdict, and the no-crypto book, render the capture', async () => {
    for (const name of ['tiered.all-hold', 'tiered.btc-swapout-stagnation.eth-down', 'tiered.no-crypto-held']) {
      expect(await renderCase(name)).toBe(LIVE_GOLDENS.cases[name].text);
      expect(await renderCase(name, null)).toBe(LIVE_GOLDENS.cases[name].text);
    }
  });

  it('never in flat6 — even handed a verdict — and flat6 carries no "crypto" at all', async () => {
    const out = await renderCase('flat6.stock-swapout', V());
    expect(out).toBe(LIVE_GOLDENS.cases['flat6.stock-swapout'].text);
    expect(out).not.toMatch(/CRYPTO SLOT|crypto/i);
  });

  it('with an INTRADAY MOMENTUM SNAPSHOT and no RISK STATUS, the line follows the snapshot — production and the probe splice agree', async () => {
    const [battle, prices, riskStatus] = CASES['tiered.all-hold']();
    const momentumData = momentumFor(riskStatus);
    momentumData.vwap = { NVDA: { vwap: 231.5, vwapDeviation: 0.35 } };
    const args = () => [battle, prices, MACRO, scoresFor(battle), TRIGGERS, [], [], { ...momentumData }, PRESET];
    flagState.crypto = false;
    const off = await buildLiveContextBlock(...args());
    flagState.crypto = true;
    const onArgs = args();
    onArgs[7].cryptoSlotVerdict = V();
    const on = await buildLiveContextBlock(...onArgs);
    const line = renderCryptoSlotCheckLineForced(V(), tableFormat);
    expect(off).toContain('INTRADAY MOMENTUM SNAPSHOT:\nNVDA: VWAP: $231.50 (+0.35%)');
    expect(on).toBe(off.replace('INTRADAY MOMENTUM SNAPSHOT:\nNVDA: VWAP: $231.50 (+0.35%)', `INTRADAY MOMENTUM SNAPSHOT:\nNVDA: VWAP: $231.50 (+0.35%)\n\n${line}`));
    expect(spliceCryptoSlotLiveContext(off, V(), tableFormat)).toBe(on);
  });

  it('the probe splice refuses what it cannot place: no verdict, a line already present, a doubled RISK STATUS, no anchor', () => {
    const captured = LIVE_GOLDENS.cases['tiered.btc-swapout-stagnation.eth-down'].text;
    expect(spliceCryptoSlotLiveContext(captured, null, tableFormat)).toBeNull();
    expect(spliceCryptoSlotLiveContext(captured, V(), undefined)).toBeNull();
    const once = spliceCryptoSlotLiveContext(captured, V(), tableFormat);
    expect(once).not.toBeNull();
    expect(spliceCryptoSlotLiveContext(once, V(), tableFormat)).toBeNull();
    expect(spliceCryptoSlotLiveContext(`${captured}\n\nRISK STATUS:\nBTC: HOLD`, V(), tableFormat)).toBeNull();
    expect(spliceCryptoSlotLiveContext('ACTIVE POSITIONS:\nx', V(), tableFormat)).toBeNull();
    expect(spliceCryptoSlotLiveContext(undefined, V(), tableFormat)).toBeNull();
  });
});
