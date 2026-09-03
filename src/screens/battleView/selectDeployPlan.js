// src/screens/battleView/selectDeployPlan.js
//
// The plan at deploy — Phase A2 (A2.1b, D-76). PURE.
//
// WHAT THIS IS. When a battle is deployed, two model calls write the plan the
// decider then carries for the whole battle: Sonnet's `strategyBrief` (the
// market read, ~200 words) and Haiku's per-TIER `innerMonologue` rationales.
// Both are frozen on the doc at creation (agentBattleService.js:184-185, from
// decide.js `lastDecision`) and both are in front of the decider on every
// tick — they are the cacheable identity block of the eval prompt
// (agentEvalPromptAssembly.js:759-771). They are the deploy decision's own
// persisted output, not narration written for a screen.
//
// WHY IT IS GATED (C1 — the agent's own words only). Two SYSTEM strings share
// these exact keys, and rendering either under the agent's name would put
// words in its mouth that no model wrote:
//
//   (a) The prescribed tournament deploy writes `strategyBrief: 'Prescribed
//       tournament deployment'` and `innerMonologue.strategy: 'Prescribed
//       tournament deployment — the drafted six.'` (decide.js:1335-1336).
//       Detected by `gameMode` — a battle-level fact, not a string match.
//   (b) The algorithmic FALLBACK portfolio writes template rationales whose
//       strategy begins `Algorithmic selection based on BaggerBomb fitness
//       scores…` (decide.js:1181-1187). No field distinguishes it — the doc
//       carries no `models` stamp — so the strategy string IS the gate. It is
//       brittle by nature; the source tripwire in the test file reds if
//       decide.js rewords it, rather than letting the gate fail open.
//
// AND A THIRD RULE, IN THE SHAPE OF THE DATA. The rationales are per TIER, not
// per position: `coreRationale` is about the two Core picks together. A row
// therefore renders only the SENTENCES OF ITS TIER'S RATIONALE THAT NAME ITS
// SYMBOL (the same one symbol rule the check extract uses), and nothing at all
// when none does. A tier rationale is never presented as a position's.
//
// Everything here is labelled with the deploy date and reads as history. It is
// never a current decision: that is the check's, and it lives in the panel's
// own block above this one.

import { FLAT6_GAME_MODE } from '../../constants/agentGameModes';
import { toIso } from '../../adapters/baggerbombAdapter';
import { extractSentences } from './selectWhyState';

/**
 * The prefix decide.js's algorithmic fallback stamps on `innerMonologue.strategy`
 * when no model authored the portfolio. Pinned by a source tripwire in
 * selectDeployPlan.test.js.
 */
export const FALLBACK_STRATEGY_PREFIX = 'Algorithmic selection';

/** The tier keys the board renders, mapped to their persisted rationale field. */
export const TIER_RATIONALE_KEY = Object.freeze({
  star: 'starRationale',
  core: 'coreRationale',
  support: 'supportRationale',
});

const cleanText = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * The battle's deploy plan, or null when it must not render.
 *
 * @param {object|null} battle the subscribed agentBattles doc
 * @returns {{
 *   activatedAt: string|null,
 *   brief: string|null,
 *   rationales: { star: string|null, core: string|null, support: string|null },
 * }|null}
 */
export function selectDeployPlan(battle) {
  const context = battle?.agentContext;
  if (!context || typeof context !== 'object') return null;

  // GATE (a) — a tournament battle's plan is a system string, never a model's.
  if (battle?.gameMode === FLAT6_GAME_MODE) return null;

  const monologue = context.innerMonologue && typeof context.innerMonologue === 'object'
    ? context.innerMonologue
    : {};

  // GATE (b) — the algorithmic fallback template.
  const strategy = cleanText(monologue.strategy);
  if (strategy && strategy.startsWith(FALLBACK_STRATEGY_PREFIX)) return null;

  const brief = cleanText(context.strategyBrief);
  const rationales = {
    star: cleanText(monologue[TIER_RATIONALE_KEY.star]),
    core: cleanText(monologue[TIER_RATIONALE_KEY.core]),
    support: cleanText(monologue[TIER_RATIONALE_KEY.support]),
  };

  // Nothing to show is not a plan. An empty brief and three empty rationales
  // is exactly the shape of a battle deployed before these fields existed.
  if (!brief && !rationales.star && !rationales.core && !rationales.support) return null;

  return {
    // The deploy instant on the doc the client reads (agentBattleService.js:140).
    // `createdAt` is the fallback for a doc activated in the same write.
    activatedAt: toIso(battle?.activatedAt) ?? toIso(battle?.createdAt) ?? null,
    brief,
    rationales,
  };
}

/**
 * The part of the plan that belongs to ONE piece: the sentences of its tier's
 * rationale that name it, verbatim, in order.
 *
 * Null — render nothing — when the tier has no rationale, or when the
 * rationale never names this piece. A tier rationale is about the tier; a row
 * only ever shows the part of it that is literally about the row.
 *
 * @returns {{ tier: string, sentences: string[] }|null}
 */
export function selectDeployPlanForSymbol(plan, symbol, tier) {
  if (!plan || !symbol || !tier) return null;
  const rationale = plan.rationales?.[tier] ?? null;
  if (!rationale) return null;
  const sentences = extractSentences(rationale, symbol);
  return sentences.length > 0 ? { tier, sentences } : null;
}

export default selectDeployPlan;
