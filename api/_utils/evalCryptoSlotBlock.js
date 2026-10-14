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
// Crypto Slot v2 (Fable build prompt + rulings, 14 Oct 2026; build report
// docs/audits/20261014_BUILD_CRYPTO_SLOT_CHECK_LINE.md) adds the two live-
// context renders the paragraph points at — the CRYPTO SLOT THIS CHECK line
// and the RISK STATUS annotation — and replaces the paragraph with v2. The
// line's verdict is computed by the cron with the model-swap gates' own
// functions (cryptoSlotVerdict.js); this module only renders it. Every
// sentence speaks of what the AGENT can do this check, never of what the
// engine will do (ruling R-a: a player's stop / target guardrail can still
// move the crypto afterwards on the same check — the protective-stop class).
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
// In the fenced live context (buildLiveContextBlock, section 3e3) the line
// renders as its own block immediately before RISK STATUS — in that slot
// whether or not RISK STATUS renders — and RISK STATUS passes through
// annotateCryptoSlotRiskStatus. Both are null / the input unchanged while dark.
//
// The flat6 (League Tournament) template never carries any of it: the
// tournament has no crypto (agentGameModes.js cryptoMandatory/benchCrypto
// false), and the two live-context renders refuse a flat6 battle outright.
// Registered in PROMPT_CONTRIBUTING_MODULES (__fixtures__/promptHonestyRegistry.js)
// in the same commit as the splice.
//
// IMPORTS: the flag and the game-mode table (api → src, Node-clean under
// BUILD_RULES §4; the unmocked import in evalCryptoSlotBlock.test.js is the
// dependency-surface guard) and the agent's crypto list. Nothing here touches
// Firebase or the network, so the offline replay probes
// (scripts/experiments/cryptoSlotProbe*.mjs) import this module in plain node.

import { CRYPTO_SLOT_PROMPT_ENABLED } from '../../src/config/featureFlags.js';
import { resolveModeConfig } from '../../src/constants/agentGameModes.js';
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
 * The paragraph text of record — v2 (Fable, 14 Oct 2026: build prompt §4,
 * bullet 2 as ruled in R-a; the build renders it, it does not re-word it).
 * Each sentence's backing is in the v2 build report §3. Every position is
 * stated as long because that is true for the agent today (Fable D-1); the
 * short task adds its half when the capability lands.
 */
export function renderCryptoSlotParagraph() {
  return [
    `Your portfolio holds six stocks and one crypto, in your third Support slot. The crypto names in this game are ${cryptoSymbolList()} — go by the symbol, since the Sector column can read Unknown after a swap.`,
    '- A crypto can only be replaced by a crypto, and a stock by a stock. Any swap you propose that pairs a crypto with a stock is refused and ends as a HOLD.',
    '- Your crypto slot can hold, or swap for the one crypto on your bench. Each check tells you which you can do: read the CRYPTO SLOT THIS CHECK line. When it says you cannot swap, hold your crypto — even if RISK STATUS flags it SWAP_OUT. If you want to make a move that check, it has to be in a stock slot.',
    '- The SECTOR AWARENESS guidance and any sector-gap reasoning apply to your stock slots only.',
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

// ==================== THE PER-CHECK LINE (v2, D-5) ====================

export const CRYPTO_SLOT_LINE_LEAD = 'CRYPTO SLOT THIS CHECK: ';

/**
 * The "you cannot swap" reasons, in the model-swap gates' own order at HEAD
 * (ruling R-b: agent-evaluate.js LOCK → the validator's cooldown → the hurdle
 * floor's bench-positive step → its ATR margin → the swap cap). The verdict
 * names the FIRST that fails — the one production would record.
 */
export const CRYPTO_SLOT_REASONS = Object.freeze(['lock', 'cooldown', 'not_up', 'margin', 'swap_cap']);

/** The RISK STATUS annotation (D-6, as ruled in R-a). */
export const CRYPTO_SLOT_ANNOTATION = ' — you cannot swap it this check; hold';

const isFlat6 = (battle) => resolveModeConfig(battle?.gameMode).promptVariant === 'flat6';

/**
 * A verdict the line can render: { held, bench, canSwap, reason, benchDailyPct }
 * as cryptoSlotVerdict.js builds it. Anything else renders nothing — never a
 * guessed sentence.
 */
export function isRenderableCryptoSlotVerdict(verdict) {
  if (!verdict || typeof verdict !== 'object') return false;
  if (typeof verdict.held !== 'string' || !verdict.held || typeof verdict.bench !== 'string' || !verdict.bench) return false;
  if (typeof verdict.benchDailyPct !== 'number' || !Number.isFinite(verdict.benchDailyPct)) return false;
  if (verdict.canSwap === true) return verdict.reason === null;
  return verdict.canSwap === false && CRYPTO_SLOT_REASONS.includes(verdict.reason);
}

/**
 * The line's text for a verdict (Fable's final text, rulings R-a/R-b). The
 * bench crypto's daily move prints through `formatPct` — the caller passes the
 * BENCH table's own formatter (the fenced assembler's formatPct), so the
 * number on the line is the number in the table by construction (ruling R-d;
 * the verdict itself reads the raw change, as the gate does).
 *
 * @param {Object|null} verdict - from cryptoSlotVerdict.js
 * @param {(n:number) => string} formatPct - the BENCH table's Daily% formatter
 * @returns {string|null}
 */
export function renderCryptoSlotCheckLineForced(verdict, formatPct) {
  if (!isRenderableCryptoSlotVerdict(verdict) || typeof formatPct !== 'function') return null;
  const { held, bench } = verdict;
  const daily = `${formatPct(verdict.benchDailyPct)}%`;
  if (verdict.canSwap) {
    return `${CRYPTO_SLOT_LINE_LEAD}you can swap ${held} for ${bench} (${bench} ${daily} on the day, clears the hurdle). It needs conviction 70 or higher. Whether to do it is your call.`;
  }
  const reasonText = {
    lock: `${held} is LOCKED`,
    cooldown: `${bench} was swapped out less than 24 hours ago and is on cooldown`,
    not_up: `${bench} is ${daily} on the day, and an incoming crypto must be up on the day`,
    margin: `${bench} is up ${daily} on the day but does not clear ${held} by the hurdle margin`,
    swap_cap: 'you have reached the swap limit for this window',
  }[verdict.reason];
  return `${CRYPTO_SLOT_LINE_LEAD}you cannot swap ${held} this check — ${reasonText}. Hold it.`;
}

/**
 * The live-context line, or null while dark, for a flat6 battle, or without a
 * renderable verdict. Flag read at call time (renderCryptoSlotBlock's rule).
 */
export function renderCryptoSlotCheckLine(battle, verdict, formatPct) {
  if (!CRYPTO_SLOT_PROMPT_ENABLED) return null;
  if (isFlat6(battle)) return null;
  return renderCryptoSlotCheckLineForced(verdict, formatPct);
}

/**
 * The RISK STATUS annotation: when the verdict is "you cannot swap", the held
 * crypto's own `<HELD>: SWAP_OUT (<reason>)` line — matched on the rendered
 * block, i.e. on exactly what the model reads (BUILD_RULES §9) — gains
 * CRYPTO_SLOT_ANNOTATION. Any other input comes back unchanged: no block, a
 * "can swap" or unrenderable verdict, no SWAP_OUT line for the held crypto,
 * or more than one candidate line (never guess). A stock's line is never
 * touched — the match is on the held crypto's symbol.
 */
export function annotateCryptoSlotRiskStatusForced(riskBlock, verdict) {
  if (typeof riskBlock !== 'string' || !isRenderableCryptoSlotVerdict(verdict) || verdict.canSwap) return riskBlock;
  const lines = riskBlock.split('\n');
  const head = `${verdict.held}: SWAP_OUT (`;
  const hits = [];
  lines.forEach((line, i) => { if (i > 0 && line.startsWith(head) && line.endsWith(')')) hits.push(i); });
  if (lines[0] !== 'RISK STATUS:' || hits.length !== 1) return riskBlock;
  lines[hits[0]] = `${lines[hits[0]]}${CRYPTO_SLOT_ANNOTATION}`;
  return lines.join('\n');
}

/** The annotation as the fenced assembler applies it: the input unchanged while dark or for flat6. */
export function annotateCryptoSlotRiskStatus(battle, riskBlock, verdict) {
  if (!CRYPTO_SLOT_PROMPT_ENABLED) return riskBlock;
  if (isFlat6(battle)) return riskBlock;
  return annotateCryptoSlotRiskStatusForced(riskBlock, verdict);
}

const RISK_HEAD = 'RISK STATUS:\n';
/** The live-context blocks the line follows when RISK STATUS does not render
 *  (buildLiveContextBlock 3e2, then 3e) — single-paragraph blocks, so each
 *  ends at the next blank line. */
const LINE_FOLLOWS = ['INTRADAY MOMENTUM SNAPSHOT:\n', 'TRIGGER (why you were woken up):\n'];

/**
 * Offline-probe helper: reproduce the fenced live-context render on a
 * flag-off tiered live context (a stored request's third message) — the line
 * at its slot, and the RISK STATUS annotation where it applies. Locked to the
 * real fenced output by evalCryptoSlotBlock.test.js (splice of each captured
 * flag-off context === its flag-on build), the spliceCryptoSlotBlock
 * precedent. `formatPct` must print the bench crypto's daily move exactly as
 * that context's BENCH table does.
 *
 * Returns null whenever it cannot place the line with certainty: no
 * renderable verdict, a context already carrying a line, a RISK STATUS that
 * is not a block start or occurs twice, or no anchor block at all.
 */
export function spliceCryptoSlotLiveContext(liveContext, verdict, formatPct) {
  const line = renderCryptoSlotCheckLineForced(verdict, formatPct);
  if (typeof liveContext !== 'string' || line === null || liveContext.includes(CRYPTO_SLOT_LINE_LEAD)) return null;
  const riskAt = liveContext.indexOf(`\n\n${RISK_HEAD}`);
  if (riskAt !== -1) {
    if (liveContext.indexOf(`\n\n${RISK_HEAD}`, riskAt + 1) !== -1) return null;
    const blockStart = riskAt + 2;
    const blockEnd = liveContext.indexOf('\n\n', blockStart);
    const end = blockEnd === -1 ? liveContext.length : blockEnd;
    const annotated = annotateCryptoSlotRiskStatusForced(liveContext.slice(blockStart, end), verdict);
    return `${liveContext.slice(0, blockStart)}${line}\n\n${annotated}${liveContext.slice(end)}`;
  }
  for (const head of LINE_FOLLOWS) {
    let at;
    if (liveContext.startsWith(head)) at = 0;
    else {
      const found = liveContext.indexOf(`\n\n${head}`);
      if (found === -1) continue;
      at = found + 2;
    }
    const blockEnd = liveContext.indexOf('\n\n', at);
    const end = blockEnd === -1 ? liveContext.length : blockEnd;
    return `${liveContext.slice(0, end)}\n\n${line}${liveContext.slice(end)}`;
  }
  return null;
}
