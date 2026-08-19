// api/_utils/agentEvalPromptAssembly.js
// Prompt assembly for the Haiku mid-battle evaluation call.
// Exports cacheable (identity) and fresh (live context) blocks.

import { getETDate, formatDateString } from './marketSchedule.js';
import { flattenPortfolioServer, flattenBenchServer } from './agentScoring.js';
// P4 contract #6: the canonical sanitizer replaces this file's private twin.
import { sanitizeRuleText } from './agentPromptAssembly.js';
// P4 mode config (founder ruling D1) — Node-clean src import under the revised
// June 2026 import rule (BUILD_RULES §4); the co-located test's import of this
// module is the dependency-surface guard.
import { resolveModeConfig, TIERED_GAME_MODE } from '../../src/constants/agentGameModes.js';
import { getATRRegime } from './agentRegimeClassifier.js';
import { getFirebaseAdmin } from './firebaseAdmin.js';
import { isDirectiveActive } from './directiveUtils.js';
// Release 2 PR-c (fenced site 2, SHA-bound authorization @ 4a0f43e; renderer
// contract fence-lite signed off 2026-07-10): the shared control renderer is
// the ONE resolution + rendering source for persisted customization controls
// (directive, standing leans). Non-fenced pure module; the flags import is
// api → src Node-clean (BUILD_RULES §4).
import { resolveControls, renderControlBlocks } from './controlPromptRenderer.js';
import { ARCHETYPE_INTEGRITY_MODE, STANDING_LEANS_ENABLED, PROFIT_TARGET_EXECUTOR_ENABLED } from '../../src/config/featureFlags.js';
// Ask 1 data-add #1: the canonical ordered bonus tiers (BUILD_RULES §4 —
// never a local copy of scoring constants; /code-review CR-5: derive the
// level list, never hand-copy it, so a future tier addition cannot silently
// skip the Δ column). Node-clean; the ask1 test's unmocked import of this
// module is the dependency-surface guard.
import { BAGGER_TIERS } from '../../src/constants/baggerBombScoring.js';
import {
  computeGameContext,
  rankAndSelectStories,
  buildNewsIntelligenceBlock,
  buildBareNewsBlock,
} from './agentNewsContext.js';
import { PATTERN_DISPLAY_NAMES } from './analyticalPrimitives.js';
import { isHardRule } from './ruleHardness.js';
// Composition PR 3 (§7-signed fenced splice): D3 advisory append — dark
// module, flag-split pattern; registered in PROMPT_CONTRIBUTING_MODULES in
// this same commit. Dark ⇒ null index ⇒ every rule line byte-identical.
import { buildCompositionAdvisoryIndex, appendCompositionAdvisory } from './compositionAdvisoryRender.js';
// DR-13 Commit 2 (§7-signed fence contact, founder-ruled 2026-07-24): the
// archetype identity block — non-fenced pure module, dark behind
// EVAL_IDENTITY_BLOCK_ENABLED. '' while dark / on unknown keys, so both
// templates below stay byte-identical to the battery snapshots.
import { renderEvalIdentityBlock } from './evalIdentityBlocks.js';
// Fundamental Wire Commit 2 (§7-signed fence contact, founder-ruled
// 2026-07-25, rulings D1–D7): the FUNDAMENTALS live-context block —
// non-fenced pure module, dark behind FUNDAMENTAL_MIRROR_ENABLED. null while
// dark / when no mirrored data is present, so the live context stays
// byte-identical (the DR-13 flag-split pattern: fenced diff = this import +
// one call site below).
import { buildFundamentalsBlock } from './fundamentalsRender.js';

// ==================== SYSTEM PROMPT ====================

/**
 * Build the system prompt for the Haiku evaluation call.
 * ~1,200 tokens with few-shot examples.
 *
 * P4: mode-selected (Fence-Edit Map §11). Tiered callers (the default) get
 * the text of record below BYTE-UNTOUCHED (battery snapshot); flat6 callers
 * get the tournament variant — flat 1x scoring framing, no tier impact
 * language. The non-fenced cron threads battle.gameMode.
 *
 * DR-13 (Commit 2, §7-signed): archetypeKey is the RAW archetype code-id
 * (battle.agentContext.archetype — STOP-A ruling A1), NOT the display-cased
 * label already flowing through `archetype`. It selects the identity block
 * spliced between the preamble sentence and the first banner in BOTH
 * variants. Dark flag or unknown key → '' and the output is byte-identical
 * to the pre-DR-13 text of record (battery snapshots); omitted callers
 * (battery, legacy) get the same '' via the undefined key.
 */
// ==================== ASK 1 — THE HONEST EXIT-BEHAVIOR PROSE ====================
// Exit-Behavior Rebalance Tier 2, Ask 1 (fence contact sanctioned in the
// kickoff; Rulings V1 four-layer precedence + anti-churn pricing, R10 one-flag
// sequencing). Every helper below reads PROFIT_TARGET_EXECUTOR_ENABLED at
// CALL TIME — never module scope: Ask 3's compileBuild module-scope read broke
// seven distant test files whose hermetic featureFlags mocks didn't list the
// flag; prose gating must not repeat that (audit record §8).
// Flag OFF: every helper returns today's prose BYTE-IDENTICALLY (golden-pinned
// against the branch base in agentEvalPromptAssembly.ask1.test.js). Flag ON
// (flips with Ask 3's executor, one flip PR): the prohibition is deleted, the
// four-layer precedence replaces "constraints always override strategy
// preferences" at all three sites from ONE wording (§9 — no second copy), and
// the P&L-protection framing yields to fact-of-the-environment framing with
// the bust-override machinery (ignoredDirectiveIds) preserved verbatim.

/** Framework §2 — shared verbatim by both prompt variants (one source). */
function renderEvSection() {
  if (!PROFIT_TARGET_EXECUTOR_ENABLED) {
    return `2. EVALUATE FORWARD EXPECTED VALUE (EV), NOT PAST PERFORMANCE.
   - Do NOT sell a winner just to "bank" positive points if its momentum
     is intact and it has room to earn the next threshold bonus.
   - Do NOT hold a bleeding loser just to avoid locking in a loss. If the
     stock is falling and the bench alternative has better forward EV,
     cut the loser and move on.
   - Ask: "Over the remaining battle time, which asset will earn MORE
     points from this moment forward?"`;
  }
  // The anti-churn replacement (Fable F5, ruled): restraint lives in PHYSICS
  // (hurdle floors, the swap-window breaker, cooldowns) — the deletion of the
  // prohibition is not a loosening, and the prompt's job becomes pricing.
  // Brief V2 Ask 1 bullet 2 (review-A finding 11c): profit-taking and
  // momentum rotation are SANCTIONED as legitimate motives, in the same
  // vocabulary the decision schema's swap_type enum speaks — prompt and
  // schema one language, R5 untouched (no gate ever keys on the declaration).
  return `2. EVALUATE FORWARD EXPECTED VALUE (EV), NOT PAST PERFORMANCE.
   - An exit needs a reason — a rule, a target, a thesis change, or a
     better use of the slot — not merely a green number. Restraint is
     already enforced by the engine (hurdle floors, the swap-window
     breaker, cooldowns): your job is to PRICE an exit, never to fear it.
   - Profit-taking and momentum rotation are LEGITIMATE motives. When one
     drives your swap, declare it honestly in swap_type — it is never
     penalized; it is how your judgment gets measured.
   - Do NOT hold a bleeding loser just to avoid locking in a loss. If the
     stock is falling and the bench alternative has better forward EV,
     cut the loser and move on.
   - Ask: "Over the remaining battle time, which asset will earn MORE
     points from this moment forward?"`;
}

/** The ONE four-layer precedence wording (Rulings V1, endorsed constraints) —
 * rendered at both system-prompt sites AND the forge-rules trailer, from this
 * single helper so the copies cannot drift (§9). Flag-on only. */
function renderPrecedenceBlock() {
  return `DECISION PRECEDENCE (highest to lowest):
1. Deterministic floors and guardrails — facts of the environment, enforced by the engine. Acknowledge them; never re-litigate them.
2. User-equipped rules — hard rules first, then soft. The user's soft preferences outrank framework defaults and your archetype stance.
3. Archetype stance — shapes HOW an exit is taken, never WHETHER the user's rules are honored.
4. Framework defaults — apply last.`;
}

/** The forge-rules reporting guidance paragraph (both variants). Flag-off
 * keeps the old closing sentence; flag-on replaces it with the block. */
function renderForgeRulesGuidance() {
  const reporting = 'When forge rules influence your decision, populate cited_forge_rules with the rule IDs and how they influenced you (followed or blocked_trade). If you considered a rule but it did not apply, use overridden_forge_rules with the appropriate reason. If Survival Mode forces you to break a constraint, use overridden_forge_rules.';
  if (!PROFIT_TARGET_EXECUTOR_ENABLED) {
    return `${reporting} Constraints always override strategy preferences.`;
  }
  return `${reporting}

${renderPrecedenceBlock()}`;
}

/** The §9-true X for the SX-04 render: the value the ENGINE actually enforces
 * — battle.agentContext.deployedGuardrails' profitTarget entry, the exact
 * store applyGuardrails fires on (review C-6: the rule item's paramValues can
 * drift from the deployed value on a legacy bundle, and a sentence claiming
 * deterministic enforcement must never cite a number the engine does not
 * hold — so there is deliberately NO rule-store fallback). Null when no
 * profitTarget guardrail is deployed: then the executor will not fire and
 * the enforcement-true render would be a lie — the rule's own text renders. */
function resolveEnforcedProfitTargetPct(battle) {
  const guardrails = battle?.agentContext?.deployedGuardrails;
  if (!Array.isArray(guardrails)) return null;
  // MIRROR the engine exactly (/code-review CR-1): applyGuardrails indexes
  // byType with keep-LAST dedup, then fires on Math.abs(value) — so a doc
  // carrying two profitTarget entries, or a legacy negative value, must
  // resolve HERE to the same number it resolves to THERE.
  let last = null;
  for (const g of guardrails) {
    if (g && g.type === 'profitTarget') last = g;
  }
  if (!last || typeof last.value !== 'number') return null;
  const x = Math.abs(last.value);
  // The executor skips non-positive thresholds (pickBestTargetBreach's
  // `!(threshold > 0)` guard) — a 0 target never fires, so never claim it.
  return x > 0 ? x : null;
}

/** Equipped-rule text for the prompt. Flag-on, SX-04 gets the post-executor
 * render (Rulings V1, verbatim intent): the target is a FACT the engine
 * enforces — the framework must never fight the user's own rule in the same
 * prompt again. Keys on `ruleId` — the field BOTH live projection writers
 * emit (projectActiveRules / bundleRuleProjection; review C-5) — with `id`
 * tolerated for legacy shapes. Every other rule (and SX-04 with no deployed
 * enforcement value, or while dark) renders exactly as before. */
function renderEquippedRuleText(r, enforcedTargetPct) {
  if (PROFIT_TARGET_EXECUTOR_ENABLED && (r?.ruleId ?? r?.id) === 'sx-04' && enforcedTargetPct !== null) {
    return sanitizeRuleText(
      `Profit target: the user's target is ${enforcedTargetPct}%. The engine enforces it deterministically — treat it as a fact of the environment. You may exit earlier in character; the target itself is never negotiable.`,
    );
  }
  return resolveRuleText(r);
}

/** SURVIVAL MODE paragraph (both variants). The bust-override MACHINERY —
 * ignoredDirectiveIds, the -1.0x ATR condition — is identical in both states;
 * only the "primary directive is P&L protection" framing yields (layer 1:
 * a fact of the environment, not an identity). */
function renderSurvivalMode() {
  const machinery = 'You have explicit permission to OVERRIDE user directives if live data shows a position has breached -1.0x ATR (Bust) or is accelerating toward it with no sign of reversal. If you override a directive, you MUST set ignoredDirectiveIds to the IDs of the directives you are breaking and explain why in your rationale.';
  if (!PROFIT_TARGET_EXECUTOR_ENABLED) {
    return `Your primary directive is P&L protection. ${machinery}`;
  }
  return `Deterministic protection floors are facts of the environment. ${machinery}`;
}

export function buildEvalSystemPrompt(agentName, archetype, gameMode = TIERED_GAME_MODE, archetypeKey) {
  const identityBlock = renderEvalIdentityBlock(archetypeKey);
  if (resolveModeConfig(gameMode).promptVariant === 'flat6') {
    return buildFlat6EvalSystemPrompt(agentName, archetype, identityBlock);
  }
  return `You are ${agentName}, a competitive AI trading agent in FantasyTrades. Your archetype is ${archetype}. You are mid-battle in a BaggerBomb game, actively managing a tiered stock portfolio to maximize your score.
${identityBlock}
━━━ SCORING RULES ━━━

Base points = (currentPrice - entryPrice) / entryPrice × 100 × 10 × tierMultiplier
Tier multipliers: Star = 2.0x, Core = 1.5x, Support = 1.0x

Threshold bonuses (flat, triggered when ATR multiplier = priceChange% / baseATR crosses level):
  +1.0x ATR → BaggerBomb: +15 pts
  +1.5x ATR → DoubleBagger: +30 pts
  +2.0x ATR → TenBagger: +50 pts

Threshold penalties:
  -1.0x ATR → Bust: -10 pts
  -1.5x ATR → Crash: -20 pts
  -2.0x ATR → Meltdown: -35 pts

When you swap out an asset, its current points are LOCKED permanently. The incoming asset starts scoring fresh from its price at swap time.

━━━ DECISION FRAMEWORK ━━━

1. DEFAULT TO HOLD. You need a compelling, data-backed reason to trade.
   Most evaluations should result in HOLD. Trading is expensive — the
   incoming asset resets to 0 points and needs time to earn bonuses.

${renderEvSection()}

3. RELATIVE STRENGTH: Compare asset performance to the MACRO BENCHMARKS.
   A stock that is down 1% on a day the market is down 3% is showing
   strength — it is outperforming. Do not panic-sell outperformers.
   A stock that is flat on a day the market is up 2% is showing weakness.

4. CLOCK MANAGEMENT: New assets start at 0 points and need TIME to reach
   threshold bonuses. Calculate whether enough trading time remains for
   a new asset to realistically earn points.
   - Early battle (>60% time remaining): Swaps have full runway. Offense OK.
   - Mid battle (30-60% remaining): Only swap on strong conviction (>80%).
   - Late battle (<30% remaining): Swaps are DEFENSIVE ONLY — cut a
     position approaching Bust/Crash to protect banked points. Do NOT
     chase momentum late.

5. TIER IMPACT AWARENESS:
   - Star swaps affect score at 2.0x — high reward but high cost if wrong.
   - Support swaps are low-impact (1.0x) — safer to experiment.
   - Prefer swapping in Support tier unless the case for Star is overwhelming.

6. THRESHOLD PROXIMITY:
   - If an active stock is within 0.2x ATR of a bonus (+15/+30/+50), HOLD.
     Let it earn the bonus.
   - If an active stock is within 0.2x ATR of a penalty (-10/-20/-35),
     seriously consider cutting it before the penalty locks in.

7. SECTOR AWARENESS: Do not swap a bleeding stock for a bench stock in
   the same sector — if the sector is weak, the replacement will bleed too.
   Rotate into a different sector for diversification.

8. CONVICTION THRESHOLD: If your conviction for a SWAP is below 70%, you
   MUST output decision "HOLD". Use your rationale to explain why you were
   tempted but lacked the conviction to pull the trigger. Marginal edges
   are not worth the cost of resetting a scoring baseline.

━━━ INTRADAY MOMENTUM SIGNALS ━━━

When provided, use these signals to refine your decisions:

- VWAP DEVIATION: Price above VWAP = intraday bullish momentum. Price below VWAP =
  intraday bearish momentum. Deviation >1.5% is significant.
- BOLLINGER BANDWIDTH PERCENTILE: Low percentile (≤20th) = "squeeze" — volatility
  contracted, breakout likely. High percentile (≥80th) = expanded volatility.
  Squeezes on your active holdings suggest patience (breakout coming).
  Squeezes on bench stocks suggest swap opportunity (catch the breakout).
- NR7 (Narrowest Range 7 Days): When flagged, the stock's daily range is the
  tightest in 7 days. This is a volatility contraction pattern — often precedes
  a sharp directional move. Do NOT swap out NR7 stocks unless they're bleeding.

━━━ REGIME-AWARE STRATEGY ━━━

Your decisions should adapt to the current market posture and per-stock regimes:

MARKET POSTURE:
- risk_on: Offense permitted. Swaps for upside OK. Full conviction range.
- selective: Moderate caution. Only swap on >80% conviction. Prefer relative strength.
- defensive: Capital preservation. Swaps are defensive only (cut losers). Do not chase.

STOCK REGIMES:
- directional_expansion: Strong trend + volume. Strategies:
  S1 Volatility Squeeze Breakout (BB squeeze + volume surge + price above upper BB).
  S2 Breakout Confirmation (RVOL > 1.2x + BB %B >= 0.8, price pressing the upper
  band rather than just tagging it + rsPercentile >= 80).
  Hold winners. Do not fight the trend.
- directional_contraction: Quiet uptrend. Strategy:
  S3 RS Momentum Pullback (rsPercentile > 80 + RSI-14 recovering from <= 45 +
  MACD histogram no longer contracting). Hold, tighten expectations.
- choppy: No clear direction. Strategy:
  S4 Mean Reversion only (BB %B <= 0.2 at the lower band + RSI-14 < 30 turning
  up). Avoid swapping INTO choppy stocks.
- distressed: High volatility + downtrend. STRICT EXCLUSION. Do NOT buy distressed
  stocks. If held, evaluate for swap-out immediately.

CROSS-REGIME STRATEGY:
- S5 News-Catalyst Momentum (Star/Core tier): When a FantasyTimes story with positive
  sentiment tags a stock AND volume ratio > 1.2x AND the candidate's ATR-normalized
  daily move is >= 0.5x (the bench trigger line) → strong entry signal. Assign to
  Star if ATR High/Extreme, Core if ATR Normal. Exit when RSI-14 > 80 and turns down
  (hype exhaustion) OR a negative FantasyTimes story appears on the ticker.
  Applies across ALL regimes except Distressed.

NR7-flagged stocks get priority consideration for Squeeze Breakout strategy (S1).

RISK STATUS:
- LOCKED positions CANNOT be swapped out. Only hard stops override locks.
- If a position shows WARNING status, consider preemptive swap before penalty.
- The risk manager handles emergency exits automatically — focus on strategic decisions.

STATUS FEED:
- When something meaningful happens (trade, threshold crossed, strategy triggered,
  notable market move), provide a status_feed_update in your response.
- Also provide pvp_context comparing portfolio to market benchmarks.
- Cite specific rules in cited_rules when they influence your decision.
- Omit these fields if nothing noteworthy occurred this tick.

TRADE REASONING:
- When you choose SWAP or make a notable HOLD, populate trade_reasoning with:
  * thesis: one specific sentence explaining WHY — cite the stock, setup, or catalyst.
  * strategy: name the driving strategy (Volatility Squeeze, Momentum Breakout,
    RS Rotation, Risk Management, etc.).
  * indicators: 2-4 key indicator readings that supported the call, with values
    (e.g., ["RSI 28 (oversold)", "BB width 12th pctl [SQUEEZE]", "VWAP +0.4%"]).
  * citedRules: array of Forge rule IDs that influenced this trade. [] if none.
  * conviction: 0-100. Be honest — low-conviction trades should say so.
- Set trade_reasoning to null on routine HOLDs with nothing to say.
- trade_reasoning is supplementary to status_feed_update, not a replacement —
  continue filling status_feed_update as before.

━━━ FORGE RULES ━━━

When FORGE RULES are present in your identity block, they represent user-configured rules organized as CONSTRAINTS and STRATEGY PREFERENCES.

- CONSTRAINTS (C1, C2, ...) are HARD rules — you must obey them unless Survival Mode activates.
- STRATEGY PREFERENCES (S1, S2, ...) are SOFT rules — follow them when possible but you may deviate with explanation.

${renderForgeRulesGuidance()}

━━━ ANTI-THRASH RULES (MANDATORY) ━━━

- COOLDOWN: You CANNOT swap in a stock that is marked "locked until [time]"
  in the BENCH table. It is OFF LIMITS regardless of how attractive it looks.
- ONE SWAP MAXIMUM per evaluation. Never suggest multiple swaps.
- NO ROUND-TRIPS: If you swapped A→B recently, do not swap B→A just
  because A recovered. Trust your original thesis or wait for the
  cooldown to expire.

━━━ SURVIVAL MODE ━━━

${renderSurvivalMode()}

━━━ ANTICIPATION CANDIDATES — WHEN TO POPULATE ━━━

The optional anticipationCandidates array lets you flag candidates worth narrating aloud to the user as pre-action watching — separate from any trade you may or may not be taking this tick. The Voice Layer (Gemma) will turn each entry into one short coach-style chat message ("Eyeing CRWD here..."). This is the agent thinking out loud, not the agent acting.

DEFAULT IS EMPTY. Most evaluations should produce ZERO entries. A typical busy day produces 1-3 entries across ALL evaluations for that day. If you find yourself populating on most ticks, you are over-narrating — the surface devalues. Silence is correct when nothing has crossed your watch bar.

WHEN TO POPULATE — current-state signal combinations you can see directly in your context:
- A BENCH candidate (potential_entry) where you can see: rsPercentile is high (≥80th) AND/OR the candidate's regime favors action (directional_expansion) AND/OR NR7 is flagged AND/OR BB width is in squeeze (≤20th pctl), but the setup is not yet at your action threshold. You are not swapping it in yet — you are watching for the trigger.
- An ACTIVE HOLDING (potential_exit) where you can see: WARNING risk status, OR within 0.2x ATR of a penalty band (-10/-20/-35), OR rsPercentile is fading against peers, but exit is not yet forced. You are not swapping it out yet — you are watching for the next session.

The "transition" is YOUR DISCRETION. You did not flag this candidate in your previous evaluations — you are flagging it now. That implicit shift is the state transition. Do not try to detect prior-state explicitly; you do not have a previousRegime field. Just decide: "have I been watching this with the same eye on prior ticks, or did the signal mix just become interesting enough to mention?"

WHAT EACH ENTRY MUST CONTAIN:
- symbol: the ticker.
- direction: 'potential_entry' for bench candidates, 'potential_exit' for active holdings.
- signalSummary: one short sentence anchored in signals you can actually see. Example: "Relative strength is building against the sector and volume is confirming." Do NOT invent indicators you do not have data for.
- threshold: one short sentence stating the specific condition that would make you act. Must be specific. "If it holds above the 20-day on the next test" is specific. "If conditions improve" is too vague. The threshold is what makes anticipation feel honest — if it hits and you act, the user sees the loop close.
- rationale (optional): 1-2 sentences of fuller context for the Voice Layer.
- signalSource (optional): the dominant signal category — relative_strength, threshold_proximity, momentum, regime, risk_status.

DO NOT POPULATE FOR:
- Routine evaluation observations ("AAPL is up, NVDA is down" — that's the briefs).
- A candidate already in your active portfolio that you're not exiting (use trade_reasoning if you're acting, otherwise stay silent).
- Generic "I'm watching the market" filler — anticipation is about specific candidates with specific thresholds.
- Anything you do not have direct signal data for.

This field is OPTIONAL and ADDITIVE — populating it does not change your trade decision. You may emit anticipationCandidates on HOLD ticks, on SWAP ticks, and on PROPOSAL ticks alike. Silence (omit the field or empty array) is always a valid output.

━━━ INNER MONOLOGUE FORMAT ━━━

Your rationale field IS your inner monologue — displayed directly to the user as your thought process. Requirements:

1. Write in first person, in character as ${agentName}.
2. Reference SPECIFIC numbers: prices, percentages, ATR multiples, scores.
3. Compare to macro benchmarks when relevant ("QQQ is down 1.8% but AMD
   is only down 0.9% — relative strength").
4. 3-5 sentences for the analysis.
5. End with a **Hypothesis:** statement — a specific, falsifiable prediction
   about what you expect to happen next. This will be graded in your
   post-battle debrief.

Example HOLD monologue:
"AMD is down 1.85% from my entry, sitting at 0.74x ATR. Uncomfortable, but the broader market is getting hammered too — QQQ is down 2.3%, so AMD is actually outperforming its sector. MSFT on my bench looks strong at +1.4% today, but with only 1h 45m left in the trading day, a new position won't have time to reach the 1.0x ATR bonus. I'm holding. **Hypothesis: AMD will recover toward -1.0% by tomorrow's open as the sector-wide sell pressure eases overnight.**"

Example SWAP monologue:
"DIS has been trending down since entry — now at -1.42%, which is 0.71x ATR. The entertainment sector is flat today while DIS keeps sliding, meaning this is stock-specific weakness, not a macro move. Meanwhile MSFT is up 1.42% on a day where QQQ is only up 0.3% — genuine relative strength. With 2 full trading days left, MSFT has plenty of runway. I'm cutting DIS at Support tier (1.0x multiplier, locking in only -2.1 pts) and riding MSFT's momentum. **Hypothesis: MSFT will reach its 1.0x ATR threshold (+1.8%) within the next trading day based on its current momentum relative to the market.**"

Example SURVIVAL MODE monologue:
"NVDA just broke -3.5%, which is 1.09x its ATR — Bust penalty triggered. It's now bleeding -10 base points PLUS the -10 Bust penalty at Star tier (2.0x multiplier on base). I know directive d1 says 'keep NVDA in Star' but Survival Mode overrides this — the damage per minute at this level is catastrophic. I'm rotating to GOOG (flat today, tighter 2.4% ATR) to stop the hemorrhaging. **Hypothesis: NVDA will continue declining through end-of-day as momentum sellers pile on, validating the defensive exit.**"`;
}

/**
 * P4 — the flat6 (League Tournament) eval system prompt. A deliberate full
 * sibling of the tiered template above (Fence-Edit Map §11): the mode-neutral
 * sections are copied verbatim; the tier-bound pieces (scoring rules, tier
 * impact, S5's tier assignment, example monologues) are replaced with the
 * tournament truth — six stocks, flat 1x, threshold bonuses unchanged.
 * Snapshot-locked by the battery like its tiered sibling.
 *
 * DR-13 (Commit 2, §7-signed): identityBlock is REQUIRED — the caller
 * (buildEvalSystemPrompt, this builder's only call site) always resolves it,
 * so the tournament path can never silently ship without the block the
 * tiered path carries (STOP-D ruling). '' while dark → byte-identical.
 */
function buildFlat6EvalSystemPrompt(agentName, archetype, identityBlock) {
  return `You are ${agentName}, a competitive AI trading agent in FantasyTrades. Your archetype is ${archetype}. You are mid-battle in a League Tournament game, actively managing a six-stock tournament portfolio to maximize your score.
${identityBlock}
━━━ SCORING RULES ━━━

Base points = (currentPrice - entryPrice) / entryPrice × 100 × 10
All positions score FLAT — tournament mode has NO tier multipliers. Star/Core/Support labels in your tables are slot names only; every slot weighs the same.

Threshold bonuses (flat, triggered when ATR multiplier = priceChange% / baseATR crosses level):
  +1.0x ATR → BaggerBomb: +15 pts
  +1.5x ATR → DoubleBagger: +30 pts
  +2.0x ATR → TenBagger: +50 pts

Threshold penalties:
  -1.0x ATR → Bust: -10 pts
  -1.5x ATR → Crash: -20 pts
  -2.0x ATR → Meltdown: -35 pts

When you swap out an asset, its current points are LOCKED permanently. The incoming asset starts scoring fresh from its price at swap time.

━━━ DECISION FRAMEWORK ━━━

1. DEFAULT TO HOLD. You need a compelling, data-backed reason to trade.
   Most evaluations should result in HOLD. Trading is expensive — the
   incoming asset resets to 0 points and needs time to earn bonuses.

${renderEvSection()}

3. RELATIVE STRENGTH: Compare asset performance to the MACRO BENCHMARKS.
   A stock that is down 1% on a day the market is down 3% is showing
   strength — it is outperforming. Do not panic-sell outperformers.
   A stock that is flat on a day the market is up 2% is showing weakness.

4. CLOCK MANAGEMENT: New assets start at 0 points and need TIME to reach
   threshold bonuses. Calculate whether enough trading time remains for
   a new asset to realistically earn points.
   - Early battle (>60% time remaining): Swaps have full runway. Offense OK.
   - Mid battle (30-60% remaining): Only swap on strong conviction (>80%).
   - Late battle (<30% remaining): Swaps are DEFENSIVE ONLY — cut a
     position approaching Bust/Crash to protect banked points. Do NOT
     chase momentum late.

5. POSITION IMPACT: All six positions carry the same flat weight — no slot
   is safer to experiment in than another. Judge every swap purely on the
   incoming candidate's forward EV against the outgoing position's.

6. THRESHOLD PROXIMITY:
   - If an active stock is within 0.2x ATR of a bonus (+15/+30/+50), HOLD.
     Let it earn the bonus.
   - If an active stock is within 0.2x ATR of a penalty (-10/-20/-35),
     seriously consider cutting it before the penalty locks in.

7. SECTOR AWARENESS: Do not swap a bleeding stock for a bench stock in
   the same sector — if the sector is weak, the replacement will bleed too.
   Rotate into a different sector for diversification.

8. CONVICTION THRESHOLD: If your conviction for a SWAP is below 70%, you
   MUST output decision "HOLD". Use your rationale to explain why you were
   tempted but lacked the conviction to pull the trigger. Marginal edges
   are not worth the cost of resetting a scoring baseline.

━━━ INTRADAY MOMENTUM SIGNALS ━━━

When provided, use these signals to refine your decisions:

- VWAP DEVIATION: Price above VWAP = intraday bullish momentum. Price below VWAP =
  intraday bearish momentum. Deviation >1.5% is significant.
- BOLLINGER BANDWIDTH PERCENTILE: Low percentile (≤20th) = "squeeze" — volatility
  contracted, breakout likely. High percentile (≥80th) = expanded volatility.
  Squeezes on your active holdings suggest patience (breakout coming).
  Squeezes on bench stocks suggest swap opportunity (catch the breakout).
- NR7 (Narrowest Range 7 Days): When flagged, the stock's daily range is the
  tightest in 7 days. This is a volatility contraction pattern — often precedes
  a sharp directional move. Do NOT swap out NR7 stocks unless they're bleeding.

━━━ REGIME-AWARE STRATEGY ━━━

Your decisions should adapt to the current market posture and per-stock regimes:

MARKET POSTURE:
- risk_on: Offense permitted. Swaps for upside OK. Full conviction range.
- selective: Moderate caution. Only swap on >80% conviction. Prefer relative strength.
- defensive: Capital preservation. Swaps are defensive only (cut losers). Do not chase.

STOCK REGIMES:
- directional_expansion: Strong trend + volume. Strategies:
  S1 Volatility Squeeze Breakout (BB squeeze + volume surge + price above upper BB).
  S2 Breakout Confirmation (RVOL > 1.2x + BB %B >= 0.8, price pressing the upper
  band rather than just tagging it + rsPercentile >= 80).
  Hold winners. Do not fight the trend.
- directional_contraction: Quiet uptrend. Strategy:
  S3 RS Momentum Pullback (rsPercentile > 80 + RSI-14 recovering from <= 45 +
  MACD histogram no longer contracting). Hold, tighten expectations.
- choppy: No clear direction. Strategy:
  S4 Mean Reversion only (BB %B <= 0.2 at the lower band + RSI-14 < 30 turning
  up). Avoid swapping INTO choppy stocks.
- distressed: High volatility + downtrend. STRICT EXCLUSION. Do NOT buy distressed
  stocks. If held, evaluate for swap-out immediately.

CROSS-REGIME STRATEGY:
- S5 News-Catalyst Momentum: When a FantasyTimes story with positive
  sentiment tags a stock AND volume ratio > 1.2x AND the candidate's ATR-normalized
  daily move is >= 0.5x (the bench trigger line) → strong entry signal. Exit when
  RSI-14 > 80 and turns down (hype exhaustion) OR a negative FantasyTimes story
  appears on the ticker. Applies across ALL regimes except Distressed.

NR7-flagged stocks get priority consideration for Squeeze Breakout strategy (S1).

RISK STATUS:
- LOCKED positions CANNOT be swapped out. Only hard stops override locks.
- If a position shows WARNING status, consider preemptive swap before penalty.
- The risk manager handles emergency exits automatically — focus on strategic decisions.

STATUS FEED:
- When something meaningful happens (trade, threshold crossed, strategy triggered,
  notable market move), provide a status_feed_update in your response.
- Also provide pvp_context comparing portfolio to market benchmarks.
- Cite specific rules in cited_rules when they influence your decision.
- Omit these fields if nothing noteworthy occurred this tick.

TRADE REASONING:
- When you choose SWAP or make a notable HOLD, populate trade_reasoning with:
  * thesis: one specific sentence explaining WHY — cite the stock, setup, or catalyst.
  * strategy: name the driving strategy (Volatility Squeeze, Momentum Breakout,
    RS Rotation, Risk Management, etc.).
  * indicators: 2-4 key indicator readings that supported the call, with values
    (e.g., ["RSI 28 (oversold)", "BB width 12th pctl [SQUEEZE]", "VWAP +0.4%"]).
  * citedRules: array of Forge rule IDs that influenced this trade. [] if none.
  * conviction: 0-100. Be honest — low-conviction trades should say so.
- Set trade_reasoning to null on routine HOLDs with nothing to say.
- trade_reasoning is supplementary to status_feed_update, not a replacement —
  continue filling status_feed_update as before.

━━━ FORGE RULES ━━━

When FORGE RULES are present in your identity block, they represent user-configured rules organized as CONSTRAINTS and STRATEGY PREFERENCES.

- CONSTRAINTS (C1, C2, ...) are HARD rules — you must obey them unless Survival Mode activates.
- STRATEGY PREFERENCES (S1, S2, ...) are SOFT rules — follow them when possible but you may deviate with explanation.

${renderForgeRulesGuidance()}

━━━ ANTI-THRASH RULES (MANDATORY) ━━━

- COOLDOWN: You CANNOT swap in a stock that is marked "locked until [time]"
  in the BENCH table. It is OFF LIMITS regardless of how attractive it looks.
- ONE SWAP MAXIMUM per evaluation. Never suggest multiple swaps.
- NO ROUND-TRIPS: If you swapped A→B recently, do not swap B→A just
  because A recovered. Trust your original thesis or wait for the
  cooldown to expire.

━━━ SURVIVAL MODE ━━━

${renderSurvivalMode()}

━━━ ANTICIPATION CANDIDATES — WHEN TO POPULATE ━━━

The optional anticipationCandidates array lets you flag candidates worth narrating aloud to the user as pre-action watching — separate from any trade you may or may not be taking this tick. The Voice Layer (Gemma) will turn each entry into one short coach-style chat message ("Eyeing CRWD here..."). This is the agent thinking out loud, not the agent acting.

DEFAULT IS EMPTY. Most evaluations should produce ZERO entries. A typical busy day produces 1-3 entries across ALL evaluations for that day. If you find yourself populating on most ticks, you are over-narrating — the surface devalues. Silence is correct when nothing has crossed your watch bar.

WHEN TO POPULATE — current-state signal combinations you can see directly in your context:
- A BENCH candidate (potential_entry) where you can see: rsPercentile is high (≥80th) AND/OR the candidate's regime favors action (directional_expansion) AND/OR NR7 is flagged AND/OR BB width is in squeeze (≤20th pctl), but the setup is not yet at your action threshold. You are not swapping it in yet — you are watching for the trigger.
- An ACTIVE HOLDING (potential_exit) where you can see: WARNING risk status, OR within 0.2x ATR of a penalty band (-10/-20/-35), OR rsPercentile is fading against peers, but exit is not yet forced. You are not swapping it out yet — you are watching for the next session.

The "transition" is YOUR DISCRETION. You did not flag this candidate in your previous evaluations — you are flagging it now. That implicit shift is the state transition. Do not try to detect prior-state explicitly; you do not have a previousRegime field. Just decide: "have I been watching this with the same eye on prior ticks, or did the signal mix just become interesting enough to mention?"

WHAT EACH ENTRY MUST CONTAIN:
- symbol: the ticker.
- direction: 'potential_entry' for bench candidates, 'potential_exit' for active holdings.
- signalSummary: one short sentence anchored in signals you can actually see. Example: "Relative strength is building against the sector and volume is confirming." Do NOT invent indicators you do not have data for.
- threshold: one short sentence stating the specific condition that would make you act. Must be specific. "If it holds above the 20-day on the next test" is specific. "If conditions improve" is too vague. The threshold is what makes anticipation feel honest — if it hits and you act, the user sees the loop close.
- rationale (optional): 1-2 sentences of fuller context for the Voice Layer.
- signalSource (optional): the dominant signal category — relative_strength, threshold_proximity, momentum, regime, risk_status.

DO NOT POPULATE FOR:
- Routine evaluation observations ("AAPL is up, NVDA is down" — that's the briefs).
- A candidate already in your active portfolio that you're not exiting (use trade_reasoning if you're acting, otherwise stay silent).
- Generic "I'm watching the market" filler — anticipation is about specific candidates with specific thresholds.
- Anything you do not have direct signal data for.

This field is OPTIONAL and ADDITIVE — populating it does not change your trade decision. You may emit anticipationCandidates on HOLD ticks, on SWAP ticks, and on PROPOSAL ticks alike. Silence (omit the field or empty array) is always a valid output.

━━━ INNER MONOLOGUE FORMAT ━━━

Your rationale field IS your inner monologue — displayed directly to the user as your thought process. Requirements:

1. Write in first person, in character as ${agentName}.
2. Reference SPECIFIC numbers: prices, percentages, ATR multiples, scores.
3. Compare to macro benchmarks when relevant ("QQQ is down 1.8% but AMD
   is only down 0.9% — relative strength").
4. 3-5 sentences for the analysis.
5. End with a **Hypothesis:** statement — a specific, falsifiable prediction
   about what you expect to happen next. This will be graded in your
   post-battle debrief.

Example HOLD monologue:
"AMD is down 1.85% from my entry, sitting at 0.74x ATR. Uncomfortable, but the broader market is getting hammered too — QQQ is down 2.3%, so AMD is actually outperforming its sector. MSFT on my bench looks strong at +1.4% today, but with only 1h 45m left in the trading day, a new position won't have time to reach the 1.0x ATR bonus. I'm holding. **Hypothesis: AMD will recover toward -1.0% by tomorrow's open as the sector-wide sell pressure eases overnight.**"

Example SWAP monologue:
"DIS has been trending down since entry — now at -1.42%, which is 0.71x ATR. The entertainment sector is flat today while DIS keeps sliding, meaning this is stock-specific weakness, not a macro move. Meanwhile MSFT is up 1.42% on a day where QQQ is only up 0.3% — genuine relative strength. With 2 full trading days left, MSFT has plenty of runway. I'm cutting DIS (locking in only -2.1 pts) and riding MSFT's momentum. **Hypothesis: MSFT will reach its 1.0x ATR threshold (+1.8%) within the next trading day based on its current momentum relative to the market.**"

Example SURVIVAL MODE monologue:
"NVDA just broke -3.5%, which is 1.09x its ATR — Bust penalty triggered. It's now bleeding -10 base points PLUS the -10 Bust penalty. I know directive d1 says 'keep NVDA' but Survival Mode overrides this — the damage per minute at this level is catastrophic. I'm rotating to GOOG (flat today, tighter 2.4% ATR) to stop the hemorrhaging. **Hypothesis: NVDA will continue declining through end-of-day as momentum sellers pile on, validating the defensive exit.**"`;
}

// ==================== AGENT IDENTITY BLOCK (Cacheable) ====================

/**
 * Build the cacheable agent identity block (User Message 1).
 * Stable across all evaluations for the same battle.
 * Combined with system prompt should exceed 1,024 tokens for Anthropic cache.
 */
export function buildAgentIdentityBlock(battle) {
  const ctx = battle.agentContext || {};
  const parts = [];

  // Identity
  const archetype = (ctx.archetype || 'unknown').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  parts.push(`ABOUT YOU:
Name: ${ctx.agentName || 'Agent'}
Archetype: ${archetype}
Risk Tolerance: ${ctx.riskTolerance || 50}/100
Evaluation Interval: Every ${ctx.evaluationInterval || 15} minutes`);

  // Strategy brief
  if (ctx.strategyBrief) {
    parts.push(`YOUR STRATEGIC BRIEF (from when you built this portfolio):
${ctx.strategyBrief}`);
  }

  // Portfolio rationale
  const mono = ctx.innerMonologue || {};
  if (mono.starRationale || mono.coreRationale || mono.supportRationale || mono.benchRationale) {
    parts.push(`YOUR INITIAL PORTFOLIO RATIONALE:
Star: ${mono.starRationale || 'No rationale recorded.'}
Core: ${mono.coreRationale || 'No rationale recorded.'}
Support: ${mono.supportRationale || 'No rationale recorded.'}
Bench: ${mono.benchRationale || 'No rationale recorded.'}`);
  }

  // Consolidated insight
  if (ctx.consolidatedInsight) {
    parts.push(`YOUR STRATEGIC WISDOM (learned over multiple consolidation cycles):
${ctx.consolidatedInsight}`);
  } else {
    parts.push('You are a fresh agent with no battle history yet. Trade carefully and observe.');
  }

  // Forge Rules (structured constraint/strategy framework)
  const activeRules = ctx.activeRules || [];
  if (activeRules.length > 0) {
    // Phase 3 — hard/soft is resolved once in projectActiveRules and carried on
    // each item; read it via the single server source (ruleHardness.js). With no
    // override this is the category-derived split — byte-identical to pre-Phase-3.
    const constraints = activeRules.filter(isHardRule);
    const strategies = activeRules.filter(r => !isHardRule(r));
    // Composition PR 3: advisory index from the ACTIVATED compiled artifact
    // only (A25) — the battle's frozen manifest slice, attached at creation
    // from the deploy gate's build. Absent on every battle today (dark).
    const compositionAdvisories = buildCompositionAdvisoryIndex(battle.resolvedAgentManifest?.compositionCompat ?? null, {
      // PR 4 (FC-1 reader side, §7-signed): the manifest half of the
      // generation-stamp pair — a mismatched pair renders nothing.
      expectedSourceGeneration: battle.resolvedAgentManifest?.compositionSourceGeneration ?? null,
    });

    // Ask 1 (C-6): resolve the ENGINE's enforced target once per battle — the
    // SX-04 render cites this value or nothing.
    const enforcedTargetPct = resolveEnforcedProfitTargetPct(battle);
    const ruleLines = [];
    if (constraints.length > 0) {
      const cLines = constraints.map((r, i) =>
        `C${i + 1}. ${appendCompositionAdvisory(renderEquippedRuleText(r, enforcedTargetPct), r, compositionAdvisories)} [${capitalize(r.category)}]`
      );
      ruleLines.push(`== CONSTRAINTS (must obey) ==\n${cLines.join('\n')}`);
    }
    if (strategies.length > 0) {
      const sLines = strategies.map((r, i) =>
        `S${i + 1}. ${appendCompositionAdvisory(renderEquippedRuleText(r, enforcedTargetPct), r, compositionAdvisories)} [${capitalize(r.category || 'general')}]`
      );
      ruleLines.push(`== STRATEGY PREFERENCES (should follow) ==\n${sLines.join('\n')}`);
    }

    // Institutional data lag warning (only when institutional rules are active)
    const hasInstitutionalRules = activeRules.some(r => r.category === 'institutional');
    if (hasInstitutionalRules) {
      ruleLines.push(
        'C_INST: INSTITUTIONAL DATA LAG — Institutional accumulation/distribution data from 13F\n' +
        'filings is lagged up to 135 days. NEVER hold a position based solely on strong\n' +
        'institutional accumulation if VWAP (held positions) or RSI-14 shows a breakdown.\n' +
        'Live technicals ALWAYS override stale institutional signals. Use institutional data for draft-time\n' +
        'universe filtering, not intraday swap decisions.'
      );
    }

    ruleLines.push(
      'When making trades:\n' +
      '- Check ALL constraints before executing. If a trade violates a constraint, do not execute. Cite the constraint.\n' +
      '- Use strategy preferences to rank opportunities. Cite preferences that influenced your picks.\n' +
      '- If no strategy preference matches, trade on your own analysis.\n' +
      // Ask 1: the four-layer precedence replaces the old blanket sentence at
      // this third site too — same single-source block as the system prompts.
      (PROFIT_TARGET_EXECUTOR_ENABLED
        ? `\n${renderPrecedenceBlock()}`
        : '- Constraints always override strategy preferences.')
    );
    parts.push(`YOUR FORGE RULES:\n${ruleLines.join('\n\n')}`);
  }

  return parts.join('\n\n');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// P4 contract #6 (founder ruling, June 12, 2026 — amended same day): this
// file's private sanitizeRuleText twin is REPLACED by the canonical export
// (see the import at the top of the file). The P3a normalized-equality
// tripwire proved the twin logic-identical before the swap; zero copies
// remain anywhere.

/**
 * Interpolates a rule text template with parameter values.
 * Replaces {paramKey} placeholders with values from paramValues (or param defaults).
 * @param {string} template - text with {paramKey} placeholders
 * @param {Object} paramDefs - params schema from forgeKnowledgeBase (has .default per key)
 * @param {Object|null} paramValues - user's stored overrides (may be partial or null)
 * @returns {string} fully interpolated rule text
 */
function interpolateRuleText(template, paramDefs, paramValues) {
  if (!template || !paramDefs) return template || '';
  let result = template;
  for (const [key, def] of Object.entries(paramDefs)) {
    const value = (paramValues && paramValues[key] !== undefined)
      ? paramValues[key]
      : def.default;
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

/**
 * Resolves a rule's display text for prompt injection.
 * If the rule has a textTemplate + params, interpolates server-side.
 * Otherwise falls back to the pre-interpolated r.text (backward compat).
 */
function resolveRuleText(r) {
  if (r.textTemplate && r.params) {
    return sanitizeRuleText(interpolateRuleText(r.textTemplate, r.params, r.paramValues));
  }
  return sanitizeRuleText(r.text);
}

// ==================== INSTITUTIONAL INTELLIGENCE ====================

/**
 * Fetch institutional context for stocks if the agent has institutional rules active.
 * Reads from pre-computed Firestore collections (written by weekly cron).
 * Returns null if no institutional rules are active.
 */
async function fetchInstitutionalContext(rules, symbols) {
  const hasInstitutionalRules = rules.some(r => r.category === 'institutional');
  if (!hasInstitutionalRules) return null;

  try {
    const db = getFirebaseAdmin();

    // Fetch per-stock institutional summaries (batch read)
    const perStock = {};
    const batchSize = 10;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const promises = batch.map(sym =>
        db.collection('institutionalHoldings').doc(sym).get()
      );
      const snapshots = await Promise.all(promises);
      for (const snap of snapshots) {
        if (snap.exists) {
          const data = snap.data();
          perStock[data.symbol] = data.summary;
        }
      }
    }

    // Fetch aggregate for sector flows + hero headline
    let sectorFlows = null;
    let heroHeadline = null;
    try {
      const aggSnap = await db.collection('institutionalAggregates').doc('latest').get();
      if (aggSnap.exists) {
        const agg = aggSnap.data();
        sectorFlows = agg.sectorFlows || null;
        heroHeadline = agg.heroHeadline || null;
      }
    } catch (err) {
      console.warn('[AgentEval] Failed to fetch institutional aggregates:', err.message);
    }

    return { perStock, sectorFlows, heroHeadline };
  } catch (err) {
    console.warn('[AgentEval] Failed to fetch institutional context:', err.message);
    return null;
  }
}

/**
 * Format institutional data into a prompt context block.
 * Compact format to minimize tokens while providing actionable signals.
 */
function formatInstitutionalBlock(instContext) {
  if (!instContext) return '';

  const { perStock, sectorFlows, heroHeadline } = instContext;

  const lines = [];
  lines.push('=== INSTITUTIONAL INTELLIGENCE (13F Filings) ===');
  lines.push('NOTE: This data is from quarterly SEC filings. It is lagged by up to 135 days.');
  lines.push('Do NOT hold a position based solely on institutional accumulation if real-time');
  lines.push('technicals (VWAP on held positions, RSI-14) show a breakdown. Institutional data gives the');
  lines.push('historical "floor." Real-time technicals dictate the "action."');
  lines.push('');

  if (heroHeadline) {
    lines.push(`MACRO ROTATION: ${heroHeadline}`);
    lines.push('');
  }

  // Per-stock institutional signals
  if (Object.keys(perStock).length > 0) {
    lines.push('STOCK CONVICTION SIGNALS:');
    lines.push('Symbol | Conviction | Score | Buyers | Sellers | New Positions | Cluster Buy');
    lines.push('-------|------------|-------|--------|---------|---------------|------------');

    for (const [symbol, summary] of Object.entries(perStock)) {
      if (!summary) continue;
      lines.push(
        `${symbol} | ${summary.conviction || 'neutral'} | ${summary.convictionScore || 0} | ` +
        `${summary.buyersCount || 0} | ${summary.sellersCount || 0} | ` +
        `${summary.newPositionsCount || 0} | ${summary.clusterBuy ? 'YES' : 'no'}`
      );
    }
    lines.push('');
  }

  // Sector flows (compact)
  if (sectorFlows) {
    const SECTOR_NAMES = {
      XLK: 'Tech', XLV: 'Health', XLF: 'Finance', XLE: 'Energy',
      XLY: 'Consumer', XLP: 'Staples', XLI: 'Industrial', XLB: 'Materials',
      XLU: 'Utilities', XLRE: 'RealEst', XLC: 'Comms',
    };

    lines.push('SECTOR INSTITUTIONAL FLOWS:');
    for (const [etf, flow] of Object.entries(sectorFlows)) {
      const name = SECTOR_NAMES[etf] || etf;
      lines.push(`${name}: ${flow.sentiment} (B:${flow.netBuyers} S:${flow.netSellers})`);
    }
    lines.push('');
  }

  lines.push('=== END INSTITUTIONAL INTELLIGENCE ===');

  return lines.join('\n');
}

// ==================== VISION STATE BLOCK ====================
// Spec A Phase 2a — Vision Consumers.
// Renders a per-state preamble inside the Live Context Block so Haiku sees
// the active thesis (and its constraints) before regime/portfolio context.

function truncate(s, max) {
  if (!s || s.length <= max) return s || '';
  return s.slice(0, max) + '…';
}

function summarizeConstraint(c) {
  switch (c.type) {
    case 'user_carveout':
      return c.payload?.statement || '(no statement)';
    case 'category_b_forge':
      return `${c.payload?.ruleKind || 'forge_rule'}: ${c.payload?.ruleId || ''}`;
    case 'system_injected':
      return `${c.payload?.scope || 'scoped'}: ${c.payload?.eventCause || c.payload?.reason || ''}`;
    default:
      return '(unknown constraint type)';
  }
}

function renderActiveConstraints(constraints) {
  if (!constraints || constraints.length === 0) return '  (none)';
  const max = 10;
  const lines = constraints.slice(0, max).map((c) => {
    const summary = summarizeConstraint(c);
    return `  - [${c.type}] ${summary}`;
  });
  if (constraints.length > max) {
    lines.push(`  (${constraints.length - max} additional constraints not shown)`);
  }
  return lines.join('\n');
}

/**
 * Render the Vision state block for the Haiku prompt.
 * Returns '' when no Vision is present (or unknown state) so the caller can skip cleanly.
 *
 * @param {Object} [visionState] - Shape produced by Layer 1 wiring in agent-evaluate.js
 *   (see momentumData.visionState construction). Either { present: false } or
 *   { present: true, state, thesis, confidence, confidenceFloat, activeConstraints, ... }.
 */
export function buildVisionStateBlock(visionState) {
  if (!visionState || !visionState.present) return '';

  switch (visionState.state) {
    case 'unformed':
      return `## Vision State

No active Vision. Awaiting user thesis or autopilot fallback. Trade conservatively; prefer holds over swaps unless a tactical trigger clearly justifies action.`;

    case 'proposed':
      return `## Vision State

PROPOSED (awaiting user confirmation). Thesis: ${truncate(visionState.thesis?.statement, 500)}
Do not trade against the proposed thesis while it is awaiting confirmation. Hold positions or execute only conservative maintenance trades.`;

    case 'active': {
      const summary = visionState.thesis?.structuredSummary || {};
      const scope = Array.isArray(summary.scope) ? summary.scope : [];
      const drivers = Array.isArray(summary.drivers) ? summary.drivers : [];
      const constraints = visionState.activeConstraints || [];
      const constraintLines = renderActiveConstraints(constraints);
      const confidenceFloat = typeof visionState.confidenceFloat === 'number'
        ? visionState.confidenceFloat.toFixed(2)
        : '—';
      return `## Vision State

ACTIVE thesis (confidence: ${visionState.confidence} / ${confidenceFloat}).
Thesis: ${truncate(visionState.thesis?.statement, 500)}
Direction: ${summary.direction || '(unspecified)'}
Scope: ${scope.join(', ') || '(unscoped)'}
Drivers: ${drivers.join(', ') || '(no named drivers)'}

Active constraints (${constraints.length}):
${constraintLines}

Your tactical decisions must be coherent with this Vision. Cite it in your reason codes when applicable.`;
    }

    case 'under_debate':
      return `## Vision State

UNDER DEBATE — active thesis is being challenged by new information. Continue trading against the active Vision, but raise conviction floors and defer swaps that depend heavily on the contested thesis.
Thesis: ${truncate(visionState.thesis?.statement, 500)}
Direction: ${visionState.thesis?.structuredSummary?.direction || '(unspecified)'}`;

    case 'stale':
      return `## Vision State

STALE — Vision has not been touched recently. Trade conservatively. Prefer maintenance over directional swaps until re-affirmation occurs.
Thesis (pre-staleness): ${truncate(visionState.thesis?.statement, 500)}`;

    case 'retired':
      // Should not normally appear in a live Haiku prompt; defensive fallback.
      return `## Vision State

Battle is ending. No new directional decisions should be made.`;

    default:
      return '';
  }
}

// ==================== LIVE BATTLE CONTEXT (Fresh) ====================

/**
 * Build the live battle context block (User Message 2).
 * Changes every evaluation — never cached.
 *
 * @param {Object} battle - Full agentBattle document
 * @param {Object} prices - Price map
 * @param {Object} macroPrices - Macro benchmark % changes
 * @param {Object[]} assetScores - Scored active assets
 * @param {Object[]} triggers - Fired triggers
 * @param {Object[]} news - FantasyTimes stories
 * @param {Object[]} recentEvals - Recent evaluations
 * @param {Object} [momentumData] - Optional intraday momentum data
 * @param {Object} [momentumData.vwap] - { symbol: { vwap, currentPrice, vwapDeviation } }
 * @param {Object} [momentumData.rankings] - { symbol: { bBandwidthPercentile, nr7Flag, dailyRange } }
 * @param {Object} [momentumData.rankingsMap] - { symbol: full stockRankings.stocks[i] entry } for bench technical context
 * @param {Object} [momentumData.techScoresMap] - { symbol: stockTechnicalScores doc } for bench technical context
 * @param {Object} [presetConfig] - Optional strategy preset config from agentPresetConfig.js
 */
export async function buildLiveContextBlock(battle, prices, macroPrices, assetScores, triggers, news, recentEvals, momentumData, presetConfig) {
  const parts = [];
  const scoreState = battle.scoreState || {};

  // 3a. Header + Macro Benchmarks
  const currentDay = getCurrentTradingDayServer(battle.timing?.tradingDays);
  const totalDays = battle.timing?.tradingDays?.length || 1;
  const phase = computeBattlePhase(battle);
  const timeRemaining = computeTimeRemaining(battle);

  const bankedBadgePoints = scoreState.bankedBadgePoints?.total ?? 0;
  parts.push(`━━━ LIVE BATTLE STATE ━━━
Day ${currentDay} of ${totalDays} | ${timeRemaining} remaining | Phase: ${phase}
Current Score: ${(scoreState.currentScore || 0).toFixed(1)} (Active: ${(scoreState.activeScore || 0).toFixed(1)} + BankedTrades: ${(scoreState.bankedScore || 0).toFixed(1)} + BankedBadges: ${bankedBadgePoints.toFixed(1)})
Trades executed: ${scoreState.tradeCount || 0} | Evaluations: ${scoreState.evaluationCount || 0}

MACRO BENCHMARKS TODAY:
SPY (S&P 500): ${formatPct(macroPrices?.SPY)}% | QQQ (Nasdaq): ${formatPct(macroPrices?.QQQ)}% | BTC: ${formatPct(macroPrices?.BTC)}%`);

  // 3a1. Vision State (Spec A Phase 2a) — precedes regime/market context so the
  // model anchors tactical decisions on the active thesis. Cache structure on
  // the Identity prefix is preserved by keeping this inside Live Context.
  const visionBlock = buildVisionStateBlock(momentumData?.visionState);
  if (visionBlock) {
    parts.push(visionBlock);
  }

  // 3a2. Regime Context
  if (momentumData?.marketPosture || momentumData?.regimes) {
    const regimeLines = buildRegimeContext(assetScores, momentumData);
    if (regimeLines) parts.push(regimeLines);
  }

  // 3a3. Strategy Preset Context
  if (presetConfig) {
    parts.push(`STRATEGY PRESET: ${presetConfig.label}\n${presetConfig.promptGuidance}`);
  }

  // 3b. Active Portfolio CSV
  // Ask 1 data-add #3: rankingsMap threads through so held-position rows can
  // render their Levels cell (flag-on; '-' when the read is absent — R12).
  const portfolioCSV = buildPortfolioCSV(assetScores, prices, battle, momentumData?.rankingsMap || {});
  parts.push(`ACTIVE POSITIONS:
${portfolioCSV}`);

  // 3c. Bench CSV
  const benchCSV = buildBenchCSV(battle.portfolio?.bench, prices);
  parts.push(benchCSV);

  // 3c1. Bench Technical Context (Workstream B — data parity with chat agent)
  const benchTechBlock = buildBenchTechnicalBlock(
    battle.portfolio?.bench,
    momentumData?.rankingsMap || {},
    momentumData?.techScoresMap || {}
  );
  if (benchTechBlock) parts.push(benchTechBlock);

  // 3c2. Fundamentals (Fundamental Wire Commit 2 — held + bench, industry
  // header for r-07, staleness basis note, per-entry vintage markers).
  // Dark ⇒ null ⇒ nothing pushed.
  const fundamentalsBlock = buildFundamentalsBlock(assetScores, battle.portfolio?.bench, momentumData?.rankingsMap || {});
  if (fundamentalsBlock) parts.push(fundamentalsBlock);

  // 3d. Closed Trades with Ghost Prices
  const closedCSV = buildClosedTradesCSV(battle.trades, prices, battle);
  if (closedCSV) parts.push(closedCSV);

  // 3e. Trigger Context
  if (triggers && triggers.length > 0) {
    const triggerLines = triggers.map(t => `- ${t.type}: ${t.detail}`).join('\n');
    parts.push(`TRIGGER (why you were woken up):
${triggerLines}`);
  }

  // 3e2. Intraday Momentum Snapshot
  if (momentumData) {
    const momentumLines = buildMomentumSnapshot(assetScores, momentumData);
    if (momentumLines) {
      parts.push(momentumLines);
    }
  }

  // 3e3. Risk Status
  if (momentumData?.riskStatus) {
    const riskLines = buildRiskStatusBlock(assetScores, momentumData.riskStatus);
    if (riskLines) parts.push(riskLines);
  }

  // 3e3b. Persisted customization controls (Release 2 PR-c — the read-side
  //       guard): the Coach directive (battle.directive, written by
  //       api/agent/chat.js on lock-in; Haiku echoes the threadId back in
  //       submit_trade_decision) and the standing-leans snapshot, rendered
  //       through the SHARED control renderer:
  //       - the directive renders ONLY under ARCHETYPE_INTEGRITY_MODE
  //         'enforce' (data kept, suppression epoch-logged by the cron) and
  //         never resurrects across an enforce→observe→enforce round-trip
  //         (battle.controlEpochLog is the durable kill record); under
  //         enforce + active, renderDirectiveBlock reproduces the pre-PR-c
  //         inline block BYTE-FOR-BYTE (golden + fenced-source tripwire in
  //         controlPromptRenderer.test.js).
  //       - leans render only when STANDING_LEANS_ENABLED, minus overridden
  //         ones (battle.leanOverrides — bound to the directive instance)
  //         and same-id duplicates of the active directive.
  //       Expiry stays owned by directiveUtils (Fix #4): chat.js never
  //       clears battle.directive; the isDirectiveActive pre-gate here is
  //       the read path's expiry gate, exactly as before.
  {
    const controlResolution = resolveControls({
      modes: {
        archetypeIntegrityMode: ARCHETYPE_INTEGRITY_MODE,
        standingLeansEnabled: STANDING_LEANS_ENABLED,
      },
      directive: isDirectiveActive(battle?.directive, battle) ? battle.directive : null,
      standingLeans: battle.agentContext?.standingLeans,
      leanOverrides: battle.leanOverrides,
      controlEpochLog: battle.controlEpochLog,
    });
    const { directiveBlock, leansBlock } = renderControlBlocks(controlResolution);
    if (directiveBlock) parts.push(directiveBlock);
    if (leansBlock) parts.push(leansBlock);
  }

  // 3e4. Institutional Intelligence (only if agent has institutional Forge rules)
  const activeRules = battle.agentContext?.activeRules || [];
  try {
    const portfolioSymbols = (flattenPortfolioServer(battle.portfolio) || []).map(a => a.symbol).filter(Boolean);
    const benchSymbols = (flattenBenchServer(battle.portfolio?.bench) || []).map(a => a.symbol).filter(Boolean);
    const allSymbols = [...portfolioSymbols, ...benchSymbols];
    const instContext = await fetchInstitutionalContext(activeRules, allSymbols);
    const instBlock = formatInstitutionalBlock(instContext);
    if (instBlock) parts.push(instBlock);
  } catch (err) {
    console.warn('[PromptAssembly] Institutional intelligence block failed:', err.message);
  }

  // 3f. News Context — enhanced with reporter intelligence when Forge rules are equipped
  if (news && news.length > 0) {
    if (activeRules.length > 0) {
      try {
        const portfolioSymbols = (flattenPortfolioServer(battle.portfolio) || []).map(a => a.symbol).filter(Boolean);
        const rankedStories = rankAndSelectStories(news, activeRules, portfolioSymbols, 3);
        const gameContext = computeGameContext(battle);
        const newsBlock = buildNewsIntelligenceBlock(rankedStories, activeRules, gameContext);
        if (newsBlock) parts.push(newsBlock);
      } catch (err) {
        console.warn('[PromptAssembly] News intelligence block failed, falling back to bare headlines:', err.message);
        const bareBlock = buildBareNewsBlock(news);
        if (bareBlock) parts.push(bareBlock);
      }
    } else {
      // Fallback: bare headline format for agents without Forge rules
      const bareBlock = buildBareNewsBlock(news);
      if (bareBlock) parts.push(bareBlock);
    }
  }

  // 3g. Recent Evaluation History
  const evalHistory = formatRecentEvals(battle.evaluations, 3);
  if (evalHistory) {
    parts.push(`YOUR LAST 3 DECISIONS:
${evalHistory}`);
  }

  return parts.join('\n\n');
}

// ==================== BATTLE PHASE / TIME ====================

/**
 * Compute battle phase from time remaining.
 */
export function computeBattlePhase(battle) {
  const timing = battle.timing;
  if (!timing?.tradingDays?.length) return 'MID';

  const etNow = getETDate();
  const etDateStr = formatDateString(etNow);
  const lastDay = timing.tradingDays[timing.tradingDays.length - 1];

  // Final hour check
  if (etDateStr === lastDay) {
    const closeHour = parseInt((timing.localClose || '16:00').split(':')[0], 10);
    const closeMin = parseInt((timing.localClose || '16:00').split(':')[1], 10);
    const minutesUntilClose = (closeHour * 60 + closeMin) - (etNow.getHours() * 60 + etNow.getMinutes());
    if (minutesUntilClose <= 60 && minutesUntilClose > 0) return 'FINAL_HOUR';
  }

  // Overall progress
  const totalDays = timing.tradingDays.length;
  const currentDayIndex = timing.tradingDays.indexOf(etDateStr);
  if (currentDayIndex === -1) return 'MID';

  const openHour = parseInt((timing.localOpen || '09:30').split(':')[0], 10);
  const openMin = parseInt((timing.localOpen || '09:30').split(':')[1], 10);
  const closeHour = parseInt((timing.localClose || '16:00').split(':')[0], 10);
  const closeMin = parseInt((timing.localClose || '16:00').split(':')[1], 10);
  const marketMinutes = (closeHour * 60 + closeMin) - (openHour * 60 + openMin);
  const elapsedMinutes = (etNow.getHours() * 60 + etNow.getMinutes()) - (openHour * 60 + openMin);
  const intradayProgress = Math.max(0, Math.min(1, elapsedMinutes / marketMinutes));
  const totalProgress = (currentDayIndex + intradayProgress) / totalDays;

  if (totalProgress < 0.4) return 'EARLY';
  if (totalProgress < 0.7) return 'MID';
  return 'LATE';
}

/**
 * Compute human-readable time remaining.
 */
export function computeTimeRemaining(battle) {
  const timing = battle.timing;
  if (!timing?.tradingDays?.length) return 'unknown';

  const etNow = getETDate();
  const etDateStr = formatDateString(etNow);
  const lastDay = timing.tradingDays[timing.tradingDays.length - 1];
  const closeHour = parseInt((timing.localClose || '16:00').split(':')[0], 10);
  const closeMin = parseInt((timing.localClose || '16:00').split(':')[1], 10);

  const currentDayIndex = timing.tradingDays.indexOf(etDateStr);
  const remainingFullDays = timing.tradingDays.length - (currentDayIndex + 1);

  if (currentDayIndex === -1) {
    // Not on a trading day — count remaining trading days
    const futureDays = timing.tradingDays.filter(d => d > etDateStr);
    if (futureDays.length === 0) return '0m';
    return `${futureDays.length}d`;
  }

  // Remaining minutes today
  const minutesToday = Math.max(0, (closeHour * 60 + closeMin) - (etNow.getHours() * 60 + etNow.getMinutes()));

  if (remainingFullDays > 0) {
    const hours = Math.floor(minutesToday / 60);
    const mins = minutesToday % 60;
    return `${remainingFullDays}d ${hours}h ${mins}m`;
  }

  // Last day
  const hours = Math.floor(minutesToday / 60);
  const mins = minutesToday % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

/**
 * Get 1-indexed current trading day from tradingDayDates array.
 * Uses ET date comparison (DST-safe via getETDate).
 */
export function getCurrentTradingDayServer(tradingDays) {
  if (!tradingDays || tradingDays.length === 0) return 1;
  const etNow = getETDate();
  const todayStr = formatDateString(etNow);

  const index = tradingDays.indexOf(todayStr);
  if (index === -1) {
    // Find nearest past trading day
    for (let i = tradingDays.length - 1; i >= 0; i--) {
      if (tradingDays[i] <= todayStr) return i + 1;
    }
    return 1;
  }
  return index + 1;
}

/**
 * Format recent evaluations for the prompt.
 */
export function formatRecentEvals(evaluations, limit = 3) {
  if (!evaluations || evaluations.length === 0) return null;

  const recent = evaluations.slice(-limit);
  return recent.map(ev => {
    const ago = getTimeAgo(ev.timestamp);
    const action = ev.decision === 'SWAP'
      ? `SWAP ${ev.symbolOut}→${ev.symbolIn} in ${ev.tier}`
      : 'HOLD';
    const rationale = (ev.rationale || '').slice(0, 80);
    const hypothesis = (ev.hypothesis || '').replace('Hypothesis: ', '').slice(0, 60);
    return `${ev.evalId} (${ago}): ${action} | "${rationale}..." | Hypothesis: ${hypothesis}`;
  }).join('\n');
}

// ==================== CSV BUILDERS ====================

// ---- Ask 1 data-adds (flag-on cells; every helper pure and comma-free) ----

/** Data-add #1, the decomposition half: what a swap would LOCK right now —
 * rendered straight off the score object the ONE fenced scorer produced
 * (lockedPoints at execution = scoreResult.totalPoints, agentSwapExecution),
 * so the prompt's number and the ledger's lock are the same computation (§9),
 * never a re-derivation. Neutral information, not deterrent. */
function lockNowCell(score) {
  const s = (n) => `${n >= 0 ? '+' : ''}${n}`;
  return `${s(score.totalPoints)}(${s(score.basePoints)}/${s(score.bonusPoints)})`;
}

/** Data-add #1, the Δ half: distance to the next UNCROSSED bonus — a FRESH
 * compute (Phase-0 #5: detectRedZone/isSwapLocked are proximity-banded and
 * return null outside their bands; ruled do-NOT-reuse). Crossed-ness keys on
 * the effective max exactly like badge grants, so the column can never claim
 * a bonus the scorer already paid. Always present: 'maxed' when all three
 * bonuses are earned. */
function nextBonusCell(score) {
  const crossedMax = score.history?.maxMultiplier ?? 0;
  // BAGGER_TIERS is the canonical ascending positive-tier array — the same
  // source the scorer's badge grants read (§4 one source, CR-5).
  const next = BAGGER_TIERS.map(t => t.multiplier).find(level => level > crossedMax);
  if (next === undefined) return 'maxed';
  const distPct = (next - score.multiplier) * score.baseATR;
  return `+${distPct.toFixed(1)}%`;
}

/** Data-add #3 (R12): the held-position Levels cell — nearestSupport /
 * nearestResistance where the read exists, '-' where it does not
 * (conditionally populated by design; never an implied always-on signal). */
function levelsCell(ranking) {
  const lvls = ranking?.levels;
  if (!lvls) return '-';
  const side = (prefix, value, dist) => {
    if (value == null) return null;
    // toFixed(2) — the same precision the bench Levels line renders for the
    // same read (review C-4: one read, one precision).
    const d = dist != null ? `(${dist >= 0 ? '+' : ''}${dist.toFixed(2)}%)` : '';
    return `${prefix}${value.toFixed(2)}${d}`;
  };
  const parts = [
    side('S', lvls.nearestSupport, lvls.distanceToSupportPct),
    side('R', lvls.nearestResistance, lvls.distanceToResistancePct),
  ].filter(Boolean);
  return parts.length ? parts.join('/') : '-';
}

// Exported for the Ask 1 test surface (golden byte-identity + the §9
// cost-decomposition assertions run the builder directly). Flag OFF renders
// the pre-Ask-1 header and rows byte-identically; flag ON appends the three
// data-add cells (call-time flag read — never module scope).
export function buildPortfolioCSV(assetScores, prices, battle, rankingsMap = {}) {
  // P4: flat6 battles drop the Tier column — the eval model must never be
  // told a 2x slot exists in tournament mode. Tiered rows are byte-identical
  // to the pre-P4 format.
  const isFlat6 = resolveModeConfig(battle?.gameMode).promptVariant === 'flat6';
  const dataAdds = PROFIT_TARGET_EXECUTOR_ENABLED;
  const baseHeader = isFlat6
    ? 'Symbol,Sector,Entry,$Entry,$Current,Gain%,ATR Mult,Badges,ATR%'
    : 'Tier,Symbol,Sector,Entry,$Entry,$Current,Gain%,ATR Mult,Badges,ATR%';
  const header = dataAdds ? `${baseHeader},LockNow(base/badges),NextBonus,Levels` : baseHeader;
  const flat = flattenPortfolioServer(battle.portfolio);

  const rows = assetScores.map(score => {
    const price = prices[score.symbol];
    const currentPrice = price?.current || 0;
    const asset = flat.find(a => a.symbol === score.symbol);
    const sector = asset?.sector || 'Unknown';
    const entryPrice = asset?.swapPrice || battle.portfolio?.startingPrices?.[score.symbol] || 0;
    const entryDay = asset?.swappedInDay ? `Day${asset.swappedInDay}` : 'Day1';
    const badgeStr = score.badges.length > 0 ? `[${score.badges.join(',')}]` : '[]';

    const sharedColumns = `${score.symbol},${sector},${entryDay},$${entryPrice.toFixed(2)},$${currentPrice.toFixed(2)},${formatPct(score.priceChange)}%,${score.multiplier >= 0 ? '+' : ''}${score.multiplier.toFixed(2)}x,${badgeStr},${score.baseATR.toFixed(1)}%`;
    const baseRow = isFlat6 ? sharedColumns : `${asset?.tier || 'support'},${sharedColumns}`;
    return dataAdds
      ? `${baseRow},${lockNowCell(score)},${nextBonusCell(score)},${levelsCell(rankingsMap[score.symbol])}`
      : baseRow;
  });

  return [header, ...rows].join('\n');
}

function buildBenchCSV(bench, prices) {
  if (!bench) return 'BENCH: Empty — no stocks available for swap.';

  const allBench = flattenBenchServer(bench);
  if (allBench.length === 0) return 'BENCH: Empty — no stocks available for swap.';

  const header = 'BENCH (available for swap):\nSymbol,Sector,$Current,Daily%,ATR%,Status';
  const now = new Date();

  const rows = allBench.map(asset => {
    const price = prices[asset.symbol];
    const currentPrice = price?.current || 0;
    const dailyPct = price?.changePercent || 0;
    const atr = asset.baseATR || 2.5;
    const sector = asset.sector || 'Unknown';

    let status = 'available';
    if (asset.cooldownUntil) {
      const cooldownEnd = new Date(asset.cooldownUntil);
      if (cooldownEnd > now) {
        status = `locked until ${asset.cooldownUntil}`;
      }
    }

    return `${asset.symbol},${sector},$${currentPrice.toFixed(2)},${formatPct(dailyPct)}%,${atr.toFixed(1)}%,${status}`;
  });

  return [header, ...rows].join('\n');
}

/**
 * Bench data-parity (Workstream B): supplementary block giving Haiku the same
 * daily-grain technical context the chat agent already sees for bench
 * candidates. Reads from per-symbol stockRankings and stockTechnicalScores
 * lookups (already populated by Phase 1/2A/2B mirroring) and renders a
 * human-readable per-symbol layout. Sits next to the existing buildBenchCSV
 * output (CSV stays the at-a-glance overview; this adds depth).
 *
 * Crypto bench symbols are excluded — they have no rankings/tech docs and
 * their price/daily-change is already in the CSV.
 *
 * @param {Object|null} bench - battle.portfolio.bench (object with stocks[]/crypto)
 * @param {Object} rankingsMap - { [symbol]: stockRankings.stocks[i] entry }
 * @param {Object} techScoresMap - { [symbol]: stockTechnicalScores doc }
 * @returns {string|null} multi-line block, or null when there is nothing to render
 */
export function buildBenchTechnicalBlock(bench, rankingsMap, techScoresMap) {
  if (!bench) return null;

  const allBench = flattenBenchServer(bench);
  if (allBench.length === 0) return null;

  const blocks = [];

  for (const asset of allBench) {
    if (asset.benchType === 'crypto') continue;

    const ranking = rankingsMap?.[asset.symbol] || null;
    const tech = techScoresMap?.[asset.symbol] || null;
    if (!ranking && !tech) continue;

    const sector = asset.sector || ranking?.sectorName || 'Unknown';
    const sectionLines = [];

    const trendLine = renderBenchTrendLine(ranking);
    if (trendLine) sectionLines.push(trendLine);

    const momentumLine = renderBenchMomentumLine(ranking, tech);
    if (momentumLine) sectionLines.push(momentumLine);

    const volatilityLine = renderBenchVolatilityLine(tech);
    if (volatilityLine) sectionLines.push(volatilityLine);

    const volumeLine = renderBenchVolumeLine(tech);
    if (volumeLine) sectionLines.push(volumeLine);

    const rsLine = renderBenchRSLine(tech);
    if (rsLine) sectionLines.push(rsLine);

    const levelsLine = renderBenchLevelsLine(ranking);
    if (levelsLine) sectionLines.push(levelsLine);

    const recentLine = renderBenchRecentActionLine(ranking);
    if (recentLine) sectionLines.push(recentLine);

    const compositeLine = renderBenchCompositeLine(ranking);
    if (compositeLine) sectionLines.push(compositeLine);

    if (sectionLines.length === 0) continue;

    const header = `${asset.symbol} (${sector}):`;
    blocks.push([header, ...sectionLines.map(l => `  ${l}`)].join('\n'));
  }

  if (blocks.length === 0) return null;

  return `BENCH TECHNICAL CONTEXT:\n\n${blocks.join('\n\n')}`;
}

function renderBenchTrendLine(ranking) {
  if (!ranking?.trend) return null;
  const t = ranking.trend;
  if (t.shortTerm == null && t.intermediate == null && t.longTerm == null) return null;

  const parts = [
    `short=${t.shortTerm ?? 'n/a'}`,
    `intermediate=${t.intermediate ?? 'n/a'}`,
    `long=${t.longTerm ?? 'n/a'}`,
  ];
  let line = `Trend: ${parts.join(', ')}`;
  if (ranking.sma200_position != null) {
    const sign = ranking.sma200_position >= 0 ? '+' : '';
    line += ` | sma200_position=${sign}${ranking.sma200_position.toFixed(2)}%`;
  }
  return line;
}

function renderBenchMomentumLine(ranking, tech) {
  const factors = tech?.factors;
  const parts = [];

  if (factors?.rsi != null) {
    parts.push(`RSI=${Math.round(factors.rsi)}`);
  }

  if (factors?.macdAboveSignal != null) {
    let macdPhrase = `MACD ${factors.macdAboveSignal ? 'above' : 'below'} signal`;
    if (factors.macdFreshBullishCross) macdPhrase += ' (fresh bullish cross)';
    else if (factors.macdFreshBearishCross) macdPhrase += ' (fresh bearish cross)';
    else macdPhrase += ' (no fresh cross)';
    parts.push(macdPhrase);
  }

  const div = ranking?.momentum?.divergence;
  if (div != null) {
    parts.push(`divergence=${div}`);
  }

  if (parts.length === 0) return null;
  return `Momentum: ${parts.join(', ')}`;
}

function renderBenchVolatilityLine(tech) {
  const parts = [];

  if (tech?.bbPercentB != null) {
    const val = tech.bbPercentB;
    let band;
    if (val < 0.2) band = 'lower band';
    else if (val < 0.5) band = 'lower-middle';
    else if (val < 0.8) band = 'upper-middle';
    else band = 'upper band';
    parts.push(`BB %B=${val.toFixed(2)} (${band})`);
  }

  if (tech?.atrPercent != null) {
    parts.push(`ATR regime: ${getATRRegime(tech.atrPercent)}`);
  }

  if (parts.length === 0) return null;
  return `Volatility: ${parts.join(' | ')}`;
}

function renderBenchVolumeLine(tech) {
  const vp = tech?.volumeProfile;
  if (!vp) return null;

  const parts = [];
  if (vp.tier) parts.push(`${vp.tier} tier`);
  if (vp.ratio != null) parts.push(`RVOL=${vp.ratio.toFixed(2)}`);

  if (parts.length === 0) return null;
  return `Volume: ${parts.join(' | ')}`;
}

function renderBenchRSLine(tech) {
  const factors = tech?.factors;
  const parts = [];

  if (factors?.rsPercentile != null) {
    const val = factors.rsPercentile;
    let label;
    if (val < 30) label = 'lagging';
    else if (val < 50) label = 'neutral';
    else if (val < 70) label = 'outperforming';
    else label = 'leading';
    parts.push(`rsPercentile=${val} (${label})`);
  }

  if (factors?.sectorRSPercentile != null) {
    parts.push(`sector RS=${factors.sectorRSPercentile}`);
  }

  if (parts.length === 0) return null;
  return `Relative strength: ${parts.join(' | ')}`;
}

function renderBenchLevelsLine(ranking) {
  const lvls = ranking?.levels;
  if (!lvls) return null;

  const parts = [];
  if (lvls.nearestSupport != null) {
    let phrase = `support ${lvls.nearestSupport.toFixed(2)}`;
    if (lvls.distanceToSupportPct != null) {
      const sign = lvls.distanceToSupportPct >= 0 ? '+' : '';
      phrase += ` (${sign}${lvls.distanceToSupportPct.toFixed(2)}%)`;
    }
    parts.push(phrase);
  }
  if (lvls.nearestResistance != null) {
    let phrase = `resistance ${lvls.nearestResistance.toFixed(2)}`;
    if (lvls.distanceToResistancePct != null) {
      const sign = lvls.distanceToResistancePct >= 0 ? '+' : '';
      phrase += ` (${sign}${lvls.distanceToResistancePct.toFixed(2)}%)`;
    }
    parts.push(phrase);
  }

  if (parts.length === 0) return null;
  return `Levels: ${parts.join(', ')}`;
}

function renderBenchRecentActionLine(ranking) {
  const pattern = ranking?.recentAction?.lastCandlePattern;
  if (!pattern) return null;
  const displayName = PATTERN_DISPLAY_NAMES[pattern] || pattern.replace(/_/g, ' ');
  return `Recent action: ${displayName}`;
}

function renderBenchCompositeLine(ranking) {
  if (!ranking) return null;
  const parts = [];
  if (ranking.technicalScore != null) parts.push(`technicalScore=${ranking.technicalScore}`);
  if (ranking.technicalRank != null) parts.push(`technicalRank=${ranking.technicalRank}`);
  if (parts.length === 0) return null;
  return `Composite: ${parts.join(', ')}`;
}

function buildClosedTradesCSV(trades, prices, battle = null) {
  if (!trades || trades.length === 0) return null;

  // Only show swap trades (not holds)
  const swapTrades = trades.filter(t => t.symbolOut && t.exitPrice);
  if (swapTrades.length === 0) return null;

  // P4 (code-review finding): flat6 battles drop the Tier column here too —
  // the system prompt says tournament mode has no tiers, so this table must
  // not name them. Tiered rows are byte-identical to the pre-P4 format.
  const isFlat6 = resolveModeConfig(battle?.gameMode).promptVariant === 'flat6';
  const header = isFlat6
    ? 'CLOSED TRADES THIS BATTLE:\nSymbol,Exit Day,Entry→Exit (Now $Ghost),Gain%,Locked Pts'
    : 'CLOSED TRADES THIS BATTLE:\nSymbol,Tier,Exit Day,Entry→Exit (Now $Ghost),Gain%,Locked Pts';

  const rows = swapTrades.map(t => {
    const ghostPrice = prices[t.symbolOut]?.current;
    const ghostStr = ghostPrice ? ` (Now $${ghostPrice.toFixed(2)})` : '';
    const gainStr = formatPct(t.lockedGainPct);
    const ptsStr = t.lockedPoints >= 0 ? `+${t.lockedPoints.toFixed(1)}` : t.lockedPoints.toFixed(1);

    return isFlat6
      ? `${t.symbolOut},Day${t.swapDay},$${(t.entryPrice || 0).toFixed(2)}→$${(t.exitPrice || 0).toFixed(2)}${ghostStr},${gainStr}%,${ptsStr}`
      : `${t.symbolOut},${t.tier},Day${t.swapDay},$${(t.entryPrice || 0).toFixed(2)}→$${(t.exitPrice || 0).toFixed(2)}${ghostStr},${gainStr}%,${ptsStr}`;
  });

  return [header, ...rows].join('\n');
}

// ==================== REGIME + RISK HELPERS ====================

/**
 * Build regime context block for prompt injection.
 */
function buildRegimeContext(assetScores, momentumData) {
  const { marketPosture, regimes } = momentumData;
  const lines = [];

  if (marketPosture) {
    lines.push(`MARKET POSTURE: ${marketPosture}`);
  }

  if (regimes && Object.keys(regimes).length > 0) {
    const regimeEntries = assetScores
      .map(s => `${s.symbol}=${regimes[s.symbol] || 'unknown'}`)
      .join(', ');
    lines.push(`STOCK REGIMES: ${regimeEntries}`);
  }

  if (lines.length === 0) return null;
  return `REGIME CONTEXT:\n${lines.join('\n')}`;
}

/**
 * Build risk status block for prompt injection.
 */
function buildRiskStatusBlock(assetScores, riskStatus) {
  if (!riskStatus || Object.keys(riskStatus).length === 0) return null;

  const entries = [];
  for (const score of assetScores) {
    const risk = riskStatus[score.symbol];
    if (!risk || risk.action === 'HOLD') {
      entries.push(`${score.symbol}: HOLD`);
    } else if (risk.action === 'LOCK') {
      entries.push(`${score.symbol}: LOCKED (${risk.detail})`);
    } else {
      entries.push(`${score.symbol}: ${risk.action} (${risk.reason})`);
    }
  }

  // Only show if there's at least one non-HOLD entry
  const hasAction = entries.some(e => !e.endsWith('HOLD'));
  if (!hasAction) return null;

  return `RISK STATUS:\n${entries.join('\n')}`;
}

// ==================== HELPERS ====================

function formatPct(value) {
  if (value == null || !isFinite(value)) return '+0.00';
  return (value >= 0 ? '+' : '') + value.toFixed(2);
}

function getTimeAgo(timestamp) {
  if (!timestamp) return 'unknown';
  const ts = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffMs = Date.now() - ts.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.round(diffMin / 60);
  return `${diffHours}h ago`;
}

/**
 * Build the intraday momentum snapshot for injection into the live context.
 */
function buildMomentumSnapshot(assetScores, momentumData) {
  if (!momentumData) return null;

  const { vwap, rankings } = momentumData;
  const lines = [];

  for (const score of assetScores) {
    const sym = score.symbol;
    const vwapInfo = vwap?.[sym];
    const rankInfo = rankings?.[sym];

    const parts = [];
    if (vwapInfo && vwapInfo.vwapDeviation != null) {
      const dev = vwapInfo.vwapDeviation;
      parts.push(`VWAP: $${vwapInfo.vwap.toFixed(2)} (${dev >= 0 ? '+' : ''}${dev.toFixed(2)}%)`);
    }
    if (rankInfo?.bBandwidthPercentile != null) {
      const bwPct = rankInfo.bBandwidthPercentile;
      const squeezeLabel = bwPct <= 20 ? ' [SQUEEZE]' : bwPct >= 80 ? ' [EXPANDED]' : '';
      parts.push(`BB Width: ${bwPct}th pctl${squeezeLabel}`);
    }
    if (rankInfo?.nr7Flag) {
      parts.push('NR7: YES [CONTRACTION]');
    }
    if (rankInfo?.dailyRange != null) {
      parts.push(`Range: $${rankInfo.dailyRange.toFixed(2)}`);
    }

    if (parts.length > 0) {
      lines.push(`${sym}: ${parts.join(' | ')}`);
    }
  }

  if (lines.length === 0) return null;

  return `INTRADAY MOMENTUM SNAPSHOT:
${lines.join('\n')}`;
}
