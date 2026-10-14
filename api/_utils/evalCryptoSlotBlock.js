// api/_utils/evalCryptoSlotBlock.js
//
// Crypto Slot paragraph (Fable build prompt, 14 Oct 2026; Phase 0
// docs/audits/20261014_PHASE0_CRYPTO_SLOT.md §3; build report
// docs/audits/20261014_BUILD_CRYPTO_SLOT_PROMPT.md). The tiered (BaggerBomb
// agent game) eval system prompt's YOUR CRYPTO SLOT block, which tells the
// Trading Brain what the game already enforces: the third Support slot holds
// the one crypto, the fenced validator refuses any swap that pairs a crypto
// with a stock (agentSwapExecution.js — the isCrypto match), and every agent
// position is long (no draft, tool or executor path sets a direction).
//
// THE SPLICE (DR-13 flag-split pattern, BUILD_RULES §1): the fenced tiered
// template in agentEvalPromptAssembly.js replaces the single blank line
// between the last SCORING RULES line and the ━━━ DECISION FRAMEWORK ━━━
// banner with `${renderCryptoSlotBlock()}`. '' (dark) reproduces that blank
// line byte-identically; a render yields
//
//   …starts scoring fresh from its price at swap time.
//
//   ━━━ YOUR CRYPTO SLOT ━━━
//
//   <paragraph>
//
//   ━━━ DECISION FRAMEWORK ━━━
//
// The flat6 (League Tournament) template never carries it: the tournament
// has no crypto (agentGameModes.js cryptoMandatory/benchCrypto false).
// Registered in PROMPT_CONTRIBUTING_MODULES (__fixtures__/promptHonestyRegistry.js)
// in the same commit as the splice.
//
// IMPORTS: the flag (api → src, Node-clean under BUILD_RULES §4; the
// unmocked import in evalCryptoSlotBlock.test.js is the dependency-surface
// guard) and the agent's crypto list. Nothing here touches Firebase or the
// network, so the offline replay probe (scripts/experiments/cryptoSlotProbe.mjs)
// imports this module in plain node.

import { CRYPTO_SLOT_PROMPT_ENABLED } from '../../src/config/featureFlags.js';
import { CRYPTO_ASSETS } from './agentCryptoAssets.js';

export const CRYPTO_SLOT_BANNER = '━━━ YOUR CRYPTO SLOT ━━━';

/**
 * The seven names as the paragraph prints them — "BTC, ETH, …, ADA and BNB".
 * Built from CRYPTO_ASSETS at call time, never typed, so the prose cannot
 * drift from the list the draft validator and the quote router use.
 */
export function cryptoSymbolList() {
  const symbols = CRYPTO_ASSETS.map((asset) => asset.symbol);
  if (symbols.length < 2) return symbols.join('');
  return `${symbols.slice(0, -1).join(', ')} and ${symbols[symbols.length - 1]}`;
}

/**
 * The paragraph text of record (Fable, 14 Oct 2026 — the build renders it,
 * it does not re-word it). Each sentence's backing is in the build report §2.
 * Every position is stated as long because that is true for the agent today
 * (Fable D-1); the short task adds its half when the capability lands.
 */
export function renderCryptoSlotParagraph() {
  return [
    `Your portfolio holds six stocks and one crypto. The crypto sits in your third Support slot. The crypto names in this game are ${cryptoSymbolList()} — go by the symbol, since the Sector column can read Unknown after a swap.`,
    '- Crypto swaps only for crypto, and a stock swaps only for a stock. The platform refuses any swap that pairs a crypto with a stock, and that check ends as a HOLD.',
    '- So your crypto slot has two moves: hold it, or swap it for the one crypto on your bench. The usual swap checks apply to that swap too: cooldown, conviction, and the hurdle floor (the incoming crypto must be up on the day and clear the one you hold by a margin).',
    '- The SECTOR AWARENESS guidance applies to your stock slots only.',
    '- Every position you hold, crypto included, is long. You cannot open or flip a short.',
  ].join('\n');
}

/**
 * Render the block for the tiered template, or '' while dark.
 *
 * @returns {string} '\n<banner>\n\n<paragraph>\n', or '' when the flag is off
 */
export function renderCryptoSlotBlock() {
  // Flag read at call time, never module scope (the Ask 3 compileBuild
  // lesson; the evalIdentityBlocks.js renderEvalIdentityBlock pattern), so
  // the on-state tests can force it through the vi.mock getter and per-call
  // resolution stays honest in production.
  if (!CRYPTO_SLOT_PROMPT_ENABLED) return '';
  return renderCryptoSlotBlockForced();
}

/**
 * The flag-blind render behind renderCryptoSlotBlock. Exported ONLY for
 * offline tooling that must build the flag-on prompt while the production
 * flag stays dark (the replay probe) and for its tests — the
 * renderEvalIdentityBlockForced precedent. Never call it from tick-side code.
 */
export function renderCryptoSlotBlockForced() {
  return `\n${CRYPTO_SLOT_BANNER}\n\n${renderCryptoSlotParagraph()}\n`;
}

/** The two lines the block goes between in the tiered template (agentEvalPromptAssembly.js). */
const SPLICE_BEFORE = 'starts scoring fresh from its price at swap time.\n';
const SPLICE_AFTER = '\n━━━ DECISION FRAMEWORK ━━━';
export const CRYPTO_SLOT_SPLICE_ANCHOR = `${SPLICE_BEFORE}${SPLICE_AFTER}`;
/** The tiered template's own scoring line; the flat6 sibling shares the anchor
 *  lines but never this one (p4Equivalence.battery.test.js asserts its absence). */
const TIERED_MARKER = 'Tier multipliers: Star = 2.0x, Core = 1.5x, Support = 1.0x';

/**
 * Offline-probe helper: reproduce the fenced splice on a flag-off tiered
 * system prompt (a stored request's `system` string) — the forced block goes
 * exactly where buildEvalSystemPrompt renders it with the flag on. Locked to
 * the real fenced output by evalCryptoSlotBlock.test.js (splice of each
 * flag-off prompt === its flag-on build, all six archetypes), so the probe's
 * prompts cannot drift from production assembly — the spliceEvalIdentityBlock
 * precedent.
 *
 * The prompt must be tiered and the anchor must occur exactly once; otherwise
 * null (never guess an insertion point — a flat6 prompt, a prompt already
 * carrying the block, or an edited template all return null).
 */
export function spliceCryptoSlotBlock(systemPrompt) {
  if (typeof systemPrompt !== 'string' || !systemPrompt.includes(TIERED_MARKER)) return null;
  const parts = systemPrompt.split(CRYPTO_SLOT_SPLICE_ANCHOR);
  if (parts.length !== 2 || systemPrompt.includes(CRYPTO_SLOT_BANNER)) return null;
  return `${parts[0]}${SPLICE_BEFORE}${renderCryptoSlotBlockForced()}${SPLICE_AFTER}${parts[1]}`;
}
