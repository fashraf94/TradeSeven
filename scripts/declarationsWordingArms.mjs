// scripts/declarationsWordingArms.mjs
//
// Declarations wording experiment — the four tool arms (experiment brief §2).
//
// The arms differ ONLY in the `tools` array of an otherwise byte-identical
// recorded request. A and B are the HEAD tools themselves
// (api/_utils/agentEvalToolSchema.js buildTradeDecisionTool). C and D are B
// with DESCRIPTION overrides only — fields, types, enums, `required` and
// property order are B's, asserted by assertDescriptionOnlyDiff() before any
// model call. Any description not listed below keeps B's text.
//
// This file is experiment-only. It does not edit, and is not imported by,
// agentEvalToolSchema.js; the winning wording ships later in its own build.

import { buildTradeDecisionTool } from '../api/_utils/agentEvalToolSchema.js';

// ---------------------------------------------------------------- arm C (§2.1)

export const ARM_C_DECLARATIONS =
  'Optional. Record the conditional calls you are holding right now, in addition to everything else in this response. ' +
  'Fill anticipationCandidates first, exactly as you would if this field did not exist; this block never replaces or reduces it. ' +
  'Declare whenever you hold a concrete if-then view on a held name or a bench candidate: a price level that would make you act, ' +
  'or make you hold. Most checks where a position is under pressure or a candidate is close to your entry qualify. ' +
  'Leave it null only when you have no conditional view. At most 6 called shots. These records are stored and later graded ' +
  'against real prices. They are not shown to the player, request no response, do not execute or schedule a trade, are not ' +
  'supplied to a later check, and do not change this check\'s decision.';

export const ARM_C_HORIZON_PHRASE =
  'How long the call stands. Choose the horizon your sentence actually means. this_session when the condition is about today: ' +
  'by the close, holds through the day, on the day. this_battle for a thesis that runs until the battle ends. explicit for a ' +
  'specific time, with expiresAtMs. next_check only when the call is about the very next 15-minute check, in which case it is ' +
  'judged once, by the first check that reaches it at or after that slot, from that check\'s own observation. Any call can be ' +
  'hit before its horizon ends.';

export const ARM_C_SAID =
  'One sentence that states only what the typed fields state: the symbol, above or below the level, and the horizon you chose. ' +
  'Do not add conditions the fields do not hold, such as closes, holds, or confirmations. Stored only; not shown.';

// ---------------------------------------------------------------- arm D (§2.2)

export const ARM_D_DECLARATIONS =
  'Optional. The conditional calls you are holding right now. The player sees each one as a tile in their cockpit and can ' +
  'answer it. Fill anticipationCandidates first, exactly as you would if this field did not exist; this block never replaces ' +
  'or reduces it. Declare whenever you hold a concrete if-then view on a held name or a bench candidate: a price level that ' +
  'would make you act, or make you hold. Most checks where a position is under pressure or a candidate is close to your entry ' +
  'qualify. Leave it null only when you have no conditional view. At most 6 called shots. Every call is graded against real ' +
  'prices. The player may answer Go, Hold off, or Ask me first; an answer reaches you as a directive at a later check. ' +
  'Nothing in this block executes a trade by itself, and it does not change this check\'s decision.';

export const ARM_D_HORIZON_PHRASE = ARM_C_HORIZON_PHRASE;

export const ARM_D_SAID =
  'One sentence the player reads on the tile. It states only what the typed fields state: the symbol, above or below the ' +
  'level, and the horizon you chose. Do not add conditions the fields do not hold, such as closes, holds, or confirmations.';

export const ARM_D_FORK =
  'Optional. A choice you want the player\'s read on: 2 to 4 names from this battle that could replace swapOut in one slot. ' +
  'The player picks one; the pick reaches you as a directive at a later check.';

export const ARM_D_PLAYER_ASK =
  'Optional. A research question you want the player\'s view on, with 2 to 4 possible answers. The player may answer it.';

// ---------------------------------------------------------------- builders

/** B with the named description overrides applied. Structure untouched. */
function withOverrides({ declarations, horizonPhrase, said, fork, playerAsk }) {
  const tool = structuredClone(buildTradeDecisionTool({ declarations: true }));
  const decl = tool.input_schema.properties.declarations;
  const shot = decl.properties.calledShots.items.properties;
  if (declarations !== undefined) decl.description = declarations;
  if (horizonPhrase !== undefined) shot.horizonPhrase.description = horizonPhrase;
  if (said !== undefined) shot.said.description = said;
  if (fork !== undefined) decl.properties.fork.description = fork;
  if (playerAsk !== undefined) decl.properties.playerAsk.description = playerAsk;
  return tool;
}

export const ARMS = Object.freeze(['A', 'B', 'C', 'D']);

export const ARM_LABELS = Object.freeze({
  A: 'off',
  B: 'shadow (current)',
  C: 'shadow, revised',
  D: 'on (draft)',
});

/** The tool object for one arm. A and B are the HEAD objects themselves. */
export function armTool(arm) {
  switch (arm) {
    case 'A': return buildTradeDecisionTool({ declarations: false });
    case 'B': return buildTradeDecisionTool({ declarations: true });
    case 'C': return withOverrides({ declarations: ARM_C_DECLARATIONS, horizonPhrase: ARM_C_HORIZON_PHRASE, said: ARM_C_SAID });
    case 'D': return withOverrides({
      declarations: ARM_D_DECLARATIONS, horizonPhrase: ARM_D_HORIZON_PHRASE, said: ARM_D_SAID, fork: ARM_D_FORK, playerAsk: ARM_D_PLAYER_ASK,
    });
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

/** Throws unless C and D equal B once descriptions are stripped (order-sensitive JSON). */
export function assertDescriptionOnlyDiff() {
  const b = JSON.stringify(stripDescriptions(armTool('B')));
  const result = {};
  for (const arm of ['C', 'D']) {
    const x = JSON.stringify(stripDescriptions(armTool(arm)));
    if (x !== b) throw new Error(`arm ${arm} differs from B beyond descriptions`);
    if (JSON.stringify(armTool(arm)) === JSON.stringify(armTool('B'))) throw new Error(`arm ${arm} is identical to B — overrides did not apply`);
    result[arm] = true;
  }
  return result;
}
