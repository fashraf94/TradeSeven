// scripts/declarationsWordingArms.mjs
//
// Declarations wording experiment — the tool arms (round 1 brief §2; round 2
// adds D2; Cockpit Build 1a adds the shipping '1A' arm for the round-3 replay).
//
// The arms differ ONLY in the `tools` array of an otherwise byte-identical
// recorded request. A and B are the HEAD tools themselves
// (api/_utils/agentEvalToolSchema.js buildTradeDecisionTool at 'off' and
// 'shadow'). C, D and D2 are B with DESCRIPTION overrides only — fields, types,
// enums, `required` and property order are B's, asserted by
// assertDescriptionOnlyDiff() before any model call. Any description not
// listed below keeps B's text.
//
// Build 1a (spec §3): the D arm's five overrides now LIVE IN the schema module
// (ARM_D_*), because the shipping 'on' text is D with exactly two edits and the
// two must share one source. This file imports them, so `armTool('D')` still
// serializes to the experiment's exact bytes (SHA-256 2a90e67b…, 13,565 chars —
// the replay comparator), and `armTool('1A')` is the schema module's own 'on'
// tool. This file is experiment-only: nothing in the product imports it.

import {
  buildTradeDecisionTool, buildArmDTool,
  ARM_D_DECLARATIONS, ARM_D_HORIZON_PHRASE, ARM_D_SAID, ARM_D_FORK, ARM_D_PLAYER_ASK,
} from '../api/_utils/agentEvalToolSchema.js';

export { ARM_D_DECLARATIONS, ARM_D_HORIZON_PHRASE, ARM_D_SAID, ARM_D_FORK, ARM_D_PLAYER_ASK };

// ---------------------------------------------------------------- arm C (§2.1)

export const ARM_C_DECLARATIONS =
  'Optional. Record the conditional calls you are holding right now, in addition to everything else in this response. ' +
  'Fill anticipationCandidates first, exactly as you would if this field did not exist; this block never replaces or reduces it. ' +
  'Declare whenever you hold a concrete if-then view on a held name or a bench candidate: a price level that would make you act, ' +
  'or make you hold. Most checks where a position is under pressure or a candidate is close to your entry qualify. ' +
  'Leave it null only when you have no conditional view. At most 6 called shots. These records are stored and later graded ' +
  'against real prices. They are not shown to the player, request no response, do not execute or schedule a trade, are not ' +
  'supplied to a later check, and do not change this check\'s decision.';

/** C's horizon text — the same sentence D carries (ARM_D_HORIZON_PHRASE, in the schema module). */
export const ARM_C_HORIZON_PHRASE = ARM_D_HORIZON_PHRASE;

export const ARM_C_SAID =
  'One sentence that states only what the typed fields state: the symbol, above or below the level, and the horizon you chose. ' +
  'Do not add conditions the fields do not hold, such as closes, holds, or confirmations. Stored only; not shown.';

// ---------------------------------------------------------------- arm D2 (round 2)

/** Round 2: D with exactly one override, the called-shot `said`. */
export const ARM_D2_SAID =
  'One sentence the player reads on the tile, under the call. Restate only the condition: the symbol, above or below the ' +
  'level, and the horizon. Never add volume, closing prices, candles, holding periods, or confirmation requirements. The ' +
  'call is graded only on the price crossing the level within the horizon.';

// ---------------------------------------------------------------- builders

/** B with the named description overrides applied. Structure untouched. */
function withOverrides({ declarations, horizonPhrase, said, fork, playerAsk }) {
  const tool = structuredClone(buildTradeDecisionTool({ declarations: 'shadow' }));
  const decl = tool.input_schema.properties.declarations;
  const shot = decl.properties.calledShots.items.properties;
  if (declarations !== undefined) decl.description = declarations;
  if (horizonPhrase !== undefined) shot.horizonPhrase.description = horizonPhrase;
  if (said !== undefined) shot.said.description = said;
  if (fork !== undefined) decl.properties.fork.description = fork;
  if (playerAsk !== undefined) decl.properties.playerAsk.description = playerAsk;
  return tool;
}

/** Round 1 ran A–D; round 2 runs A, D and D2; round 3 (not run by this build) compares the shipping 1A text against D's bars. */
export const ARMS = Object.freeze(['A', 'B', 'C', 'D']);
export const ARMS_ROUND2 = Object.freeze(['A', 'D', 'D2']);
export const ARMS_ROUND3 = Object.freeze(['A', 'D', '1A']);

export const ARM_LABELS = Object.freeze({
  A: 'off',
  B: 'shadow (current)',
  C: 'shadow, revised',
  D: 'on (draft)',
  D2: 'D + said override',
  '1A': 'on (Build 1a text — D minus the deferred promises)',
});

/** The tool object for one arm. A, B and 1A are the HEAD objects themselves. */
export function armTool(arm) {
  switch (arm) {
    case 'A': return buildTradeDecisionTool({ declarations: 'off' });
    case 'B': return buildTradeDecisionTool({ declarations: 'shadow' });
    case 'C': return withOverrides({ declarations: ARM_C_DECLARATIONS, horizonPhrase: ARM_C_HORIZON_PHRASE, said: ARM_C_SAID });
    case 'D': return buildArmDTool();
    case 'D2': return withOverrides({
      declarations: ARM_D_DECLARATIONS, horizonPhrase: ARM_D_HORIZON_PHRASE, said: ARM_D2_SAID, fork: ARM_D_FORK, playerAsk: ARM_D_PLAYER_ASK,
    });
    case '1A': return buildTradeDecisionTool({ declarations: 'on' });
    default: throw new Error(`unknown arm ${arm}`);
  }
}

/**
 * Remove every `description` key, recursively, preserving key order. Used to
 * prove C and D differ from B in descriptions only.
 */
export function stripDescriptions(value) {
  if (Array.isArray(value)) return value.map(stripDescriptions);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) if (k !== 'description') out[k] = stripDescriptions(v);
    return out;
  }
  return value;
}

/** Throws unless each arm equals B once descriptions are stripped (order-sensitive JSON). */
export function assertDescriptionOnlyDiff(arms = ['C', 'D']) {
  const b = JSON.stringify(stripDescriptions(armTool('B')));
  const result = {};
  for (const arm of arms) {
    const x = JSON.stringify(stripDescriptions(armTool(arm)));
    if (x !== b) throw new Error(`arm ${arm} differs from B beyond descriptions`);
    if (JSON.stringify(armTool(arm)) === JSON.stringify(armTool('B'))) throw new Error(`arm ${arm} is identical to B — overrides did not apply`);
    result[arm] = true;
  }
  return result;
}
