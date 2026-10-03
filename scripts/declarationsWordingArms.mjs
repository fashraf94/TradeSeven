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
// (ARM_D_*), because the shipping 'on' text is built from D and the two must
// share one source. This file imports them, so `armTool('D')` still serializes
// to the experiment's exact bytes (SHA-256 2a90e67b…, 13,565 chars — the replay
// comparator). This file is experiment-only: nothing in the product imports it.
//
// Round 3 adds 1A-C (1A with two description overrides) and 1A-CF (1A-C with
// a new fork description and ONE added optional boolean, the only arm whose
// structure differs) — both gated by assertRound3Arms() before any call.
//
// Cockpit Build 2a (spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md S-8): the product's
// 'on' text IS NOW 1A-C (the port). Round 3's '1A' — PR #924's 'on' text, D
// with Build 1a's two edits — is therefore FROZEN HERE as its own arm, from its
// own verbatim strings (FROZEN_1A_*), so `armTool('1A')` still serializes to
// the bytes round 3 submitted (SHA-256 81499cbc…, 13,595 chars) and round 3's
// own gates (reuseGate3, assertRound3Arms, analyze's request re-hash) still
// pass. 1A-C and 1A-CF are built from the frozen 1A, exactly as round 3 built
// them from the then-live text.

import { createHash } from 'node:crypto';
import {
  buildTradeDecisionTool, buildArmDTool,
  ARM_D_DECLARATIONS, ARM_D_HORIZON_PHRASE, ARM_D_SAID, ARM_D_FORK, ARM_D_PLAYER_ASK,
} from '../api/_utils/agentEvalToolSchema.js';
// Round 3 only: read through the namespace, so a later rename of these two exports fails
// assertRound3Arms() instead of breaking this module's load (and rounds 1–2 with it).
import * as schema from '../api/_utils/agentEvalToolSchema.js';

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

// ---------------------------------------------------------------- round 3: 1A-C and 1A-CF
//
// Round 3 brief §1. 1A is PR #924's 'on' tool (the Build 1a text, SHA-256
// 81499cbc…) — frozen below since Build 2a ported 1A-C into the product. 1A-C
// corrects the two inaccuracies the Build 1a review found (build report §10.3
// item 6): (a) an answer reaches the agent only when it changes the default,
// and (b) the fork's `said` is read by the player. 1A-CF adds the fork nudge:
// a new fork description plus ONE optional boolean, `fork.respondsToDirective`.
// Every text below is the brief's, verbatim.

/**
 * THE FROZEN 1A TEXT (Build 2a S-8) — the Build 1a block sentence and block, as
 * they stood in api/_utils/agentEvalToolSchema.js before the 1A-C port
 * (TEXT_1A_SENTENCE / TEXT_1A_DECLARATIONS at 4dfc48d9), verbatim. Never edited:
 * these strings are what round 3 submitted as arm '1A'.
 */
export const FROZEN_1A_SENTENCE =
  'The player may answer Go or Hold off; an answer reaches you as a directive at a later check.';
export const FROZEN_1A_DECLARATIONS =
  'Optional. The conditional calls you are holding right now. The player sees each one as a tile in their cockpit and can ' +
  'answer it. Fill anticipationCandidates first, exactly as you would if this field did not exist; this block never replaces ' +
  'or reduces it. Declare whenever you hold a concrete if-then view on a held name or a bench candidate: a price level that ' +
  'would make you act, or make you hold. Most checks where a position is under pressure or a candidate is close to your entry ' +
  'qualify. Leave it null only when you have no conditional view. At most 6 called shots. Every call is graded against real ' +
  'prices. The player may answer Go or Hold off; an answer reaches you as a directive at a later check. ' +
  'Nothing in this block executes a trade by itself, and it does not change this check\'s decision.';
/** The frozen 1A playerAsk text (TEXT_1A_PLAYER_ASK at 4dfc48d9 — the port left it as it was), verbatim. */
export const FROZEN_1A_PLAYER_ASK =
  'Optional. A research question you want the player\'s view on, with 2 to 4 possible answers. Stored and shown to the ' +
  'player; no answer is expected in this version.';
/** The frozen 1A serialization round 3 submitted (its reuse gate's pin). */
export const FROZEN_1A_SHA256 = '81499cbcf2655ceba51a5b721d33ff918ce21382a4c3b76d9cc34e6bae1f1806';

/** (a) The 1a block sentence, corrected. Replaces FROZEN_1A_SENTENCE and nothing else. */
export const ARM_1AC_SENTENCE =
  'The player may answer Go or Hold off; an answer that changes your default reaches you as a directive at a later check.';

/** 1A-C's block description: the 1a block with sentence (a) swapped in (asserted equal to the replace). */
export const ARM_1AC_DECLARATIONS =
  'Optional. The conditional calls you are holding right now. The player sees each one as a tile in their cockpit and can ' +
  'answer it. Fill anticipationCandidates first, exactly as you would if this field did not exist; this block never replaces ' +
  'or reduces it. Declare whenever you hold a concrete if-then view on a held name or a bench candidate: a price level that ' +
  'would make you act, or make you hold. Most checks where a position is under pressure or a candidate is close to your entry ' +
  'qualify. Leave it null only when you have no conditional view. At most 6 called shots. Every call is graded against real ' +
  'prices. The player may answer Go or Hold off; an answer that changes your default reaches you as a directive at a later check. ' +
  'Nothing in this block executes a trade by itself, and it does not change this check\'s decision.';

/** (b) The fork's `said`. */
export const ARM_1AC_FORK_SAID =
  'One sentence the player reads with this choice. State only the slot, the options and why each fits; add no conditions.';

/** 1A-CF: the fork nudge. */
export const ARM_1ACF_FORK =
  'Optional. A choice you want the player\'s read on: 2 to 4 names from this battle that could replace swapOut in one slot. ' +
  'Offer one whenever the player\'s current directive rules out your first choice for a slot, or when two candidates for a ' +
  'slot are close. Set respondsToDirective to true only when the player\'s current directive is the reason you are offering ' +
  'this choice. The player picks one; the pick reaches you as a directive at a later check.';

/** 1A-CF: the one added property's description. */
export const ARM_1ACF_RESPONDS_TO_DIRECTIVE =
  'True only if the player\'s current directive is why you offer this choice; otherwise false or omit.';

/**
 * The frozen 1A tool: D with Build 1a's two edits — the frozen block and the
 * frozen playerAsk, both verbatim — built ONCE and deep-frozen, so
 * `armTool('1A')` is one object, as the live 'on' tool was.
 */
const FROZEN_1A_TOOL = deepFreezeArm((() => {
  const tool = structuredClone(buildArmDTool());
  const decl = tool.input_schema.properties.declarations;
  decl.description = FROZEN_1A_DECLARATIONS;
  decl.properties.playerAsk.description = FROZEN_1A_PLAYER_ASK;
  return tool;
})());

function deepFreezeArm(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreezeArm(v);
  }
  return value;
}

/** 1A-C: the frozen 1A tool with exactly the two description overrides (a) and (b). */
function build1AC() {
  const tool = structuredClone(FROZEN_1A_TOOL);
  const decl = tool.input_schema.properties.declarations;
  decl.description = ARM_1AC_DECLARATIONS;
  decl.properties.fork.properties.said.description = ARM_1AC_FORK_SAID;
  return tool;
}

/** 1A-CF: 1A-C with the fork description replaced and `respondsToDirective` added LAST in the fork's properties, never required. */
function build1ACF() {
  const tool = build1AC();
  const fork = tool.input_schema.properties.declarations.properties.fork;
  fork.description = ARM_1ACF_FORK;
  fork.properties.respondsToDirective = { type: 'boolean', description: ARM_1ACF_RESPONDS_TO_DIRECTIVE };
  return tool;
}

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

/**
 * Round 1 ran A–D; round 2 runs A, D and D2. ARMS_ROUND3 is Build 1a's comparator set (pinned by
 * agentEvalToolSchema.build1a.test.js); round 3 as run (brief §1) adds 1A-C and 1A-CF — the arms
 * it CALLS are ARMS_ROUND3_NEW, while A and D are REUSED from round 2's raw records, never re-run.
 */
export const ARMS = Object.freeze(['A', 'B', 'C', 'D']);
export const ARMS_ROUND2 = Object.freeze(['A', 'D', 'D2']);
export const ARMS_ROUND3 = Object.freeze(['A', 'D', '1A']);
export const ARMS_ROUND3_REUSED = Object.freeze(['A', 'D']);
export const ARMS_ROUND3_NEW = Object.freeze(['1A', '1A-C', '1A-CF']);
/** The synthetic-directive sub-sample's arms (brief §2): 1A-C is the no-nudge control on the same inputs. */
export const ARMS_ROUND3_S2 = Object.freeze(['1A-C', '1A-CF']);

export const ARM_LABELS = Object.freeze({
  A: 'off',
  B: 'shadow (current)',
  C: 'shadow, revised',
  D: 'on (draft)',
  D2: 'D + said override',
  '1A': 'on (Build 1a text — D minus the deferred promises)',
  '1A-C': '1A corrected (answer sentence, fork said)',
  '1A-CF': '1A-C + fork nudge (respondsToDirective)',
});

/** The tool object for one arm. A and B are the HEAD objects themselves; 1A is the frozen pre-port object (Build 2a S-8). */
export function armTool(arm) {
  switch (arm) {
    case 'A': return buildTradeDecisionTool({ declarations: 'off' });
    case 'B': return buildTradeDecisionTool({ declarations: 'shadow' });
    case 'C': return withOverrides({ declarations: ARM_C_DECLARATIONS, horizonPhrase: ARM_C_HORIZON_PHRASE, said: ARM_C_SAID });
    case 'D': return buildArmDTool();
    case 'D2': return withOverrides({
      declarations: ARM_D_DECLARATIONS, horizonPhrase: ARM_D_HORIZON_PHRASE, said: ARM_D2_SAID, fork: ARM_D_FORK, playerAsk: ARM_D_PLAYER_ASK,
    });
    case '1A': return FROZEN_1A_TOOL;
    case '1A-C': return build1AC();
    case '1A-CF': return build1ACF();
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

/** Every differing leaf between two JSON trees, by dotted path, in key order; an added or removed key is one leaf. */
export function leafDiff(a, b, path = '') {
  if (Array.isArray(a) && Array.isArray(b)) {
    const out = [];
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) out.push(...leafDiff(a[i], b[i], `${path}[${i}]`));
    return out;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.flatMap((k) => leafDiff(a[k], b[k], path ? `${path}.${k}` : k));
  }
  return a === b ? [] : [{ path, before: a, after: b }];
}

const DECL = 'input_schema.properties.declarations';
const FORK = `${DECL}.properties.fork`;

/**
 * Round 3's structural gate (brief §1), thrown before any call: 1A-C differs from 1A in
 * descriptions only, at exactly the two named leaves; 1A-CF differs from 1A-C at exactly the
 * fork description plus the one added property — an optional boolean, last in the fork's
 * properties, absent from `required`.
 */
export function assertRound3Arms() {
  const tree = (arm) => JSON.parse(JSON.stringify(armTool(arm)));
  const fail = (msg) => { throw new Error(`round-3 arm gate: ${msg}`); };
  // Build 2a (S-8): 1A is the FROZEN pre-port text, checked against its own strings and its pinned bytes.
  if (FROZEN_1A_DECLARATIONS.split(FROZEN_1A_SENTENCE).length !== 2
    || FROZEN_1A_DECLARATIONS.replace(FROZEN_1A_SENTENCE, ARM_1AC_SENTENCE) !== ARM_1AC_DECLARATIONS) {
    fail('ARM_1AC_DECLARATIONS is not the frozen 1a block with exactly sentence (a) replaced');
  }
  if (armTool('1A') !== FROZEN_1A_TOOL) fail('1A is not the frozen pre-port tool');
  if (createHash('sha256').update(JSON.stringify(armTool('1A')), 'utf8').digest('hex') !== FROZEN_1A_SHA256) fail('the frozen 1A tool no longer serializes to its pinned bytes');
  const on = tree('1A');
  const c = tree('1A-C');
  const cf = tree('1A-CF');

  const dC = leafDiff(on, c);
  const wantC = [`${DECL}.description`, `${FORK}.properties.said.description`];
  if (JSON.stringify(dC.map((d) => d.path)) !== JSON.stringify(wantC)) fail(`1A → 1A-C leaves ${JSON.stringify(dC.map((d) => d.path))}`);
  if (dC[0].after !== ARM_1AC_DECLARATIONS || dC[1].after !== ARM_1AC_FORK_SAID) fail('1A-C override text');
  if (JSON.stringify(stripDescriptions(c)) !== JSON.stringify(stripDescriptions(on))) fail('1A-C differs from 1A beyond descriptions');

  const dF = leafDiff(c, cf);
  const wantF = [`${FORK}.description`, `${FORK}.properties.respondsToDirective`];
  if (JSON.stringify(dF.map((d) => d.path)) !== JSON.stringify(wantF)) fail(`1A-C → 1A-CF leaves ${JSON.stringify(dF.map((d) => d.path))}`);
  if (dF[0].after !== ARM_1ACF_FORK) fail('1A-CF fork description');
  if (dF[1].before !== undefined || JSON.stringify(dF[1].after) !== JSON.stringify({ type: 'boolean', description: ARM_1ACF_RESPONDS_TO_DIRECTIVE })) {
    fail('respondsToDirective is not exactly one added optional boolean');
  }
  const forkC = c.input_schema.properties.declarations.properties.fork;
  const forkF = cf.input_schema.properties.declarations.properties.fork;
  if (JSON.stringify(Object.keys(forkF.properties)) !== JSON.stringify([...Object.keys(forkC.properties), 'respondsToDirective'])) fail('respondsToDirective is not last');
  if (JSON.stringify(forkF.required) !== JSON.stringify(forkC.required) || forkF.required.includes('respondsToDirective')) fail('fork.required changed');
  const without = structuredClone(cf);
  delete without.input_schema.properties.declarations.properties.fork.properties.respondsToDirective;
  if (JSON.stringify(stripDescriptions(without)) !== JSON.stringify(stripDescriptions(c))) fail('1A-CF differs from 1A-C beyond the fork description and the added property');

  return {
    '1A-C': { vs: '1A', leaves: wantC, descriptionOnly: true },
    '1A-CF': { vs: '1A-C', leaves: wantF, addedProperty: 'fork.respondsToDirective' },
  };
}
