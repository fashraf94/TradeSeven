// api/_utils/agentEvalToolSchema.build1a.test.js
//
// Cockpit Build 1a — THE TOOL TEXT (spec docs/COCKPIT_BUILD1A_SPEC_V1_2.md §3,
// §15.2): the three-mode builder, 'off' base-identical, 'shadow'/'on' with
// identical non-description structure, the 'on' text pinned by hash, and D's
// experimental bytes still reproducible for the replay (Astra B1R2-10,
// B1R2-11). The 'on' text is MODEL-VISIBLE: the pins below are what the
// fenced-class review confirms (the hash and the exact three-leaf delta from D).
//
// Cockpit Build 2a (spec docs/COCKPIT_BUILD2A_SPEC_V1_0.md S-8, ruling R2A-17):
// the 'on' text is now round 3's 1A-C — the Build 1a text (its two edits) plus
// the corrected answer sentence and the fork's player-facing `said`. The
// pre-port Build 1a text survives as the frozen round-3 arm '1A' (81499cbc…),
// pinned below beside the live text.
//
// Dependency-surface guard (BUILD_RULES §4): the imports of the schema module
// and of scripts/declarationsWordingArms.mjs are never mocked.

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildTradeDecisionTool, buildArmDTool, TRADE_DECISION_TOOL, DECLARATIONS_PROPERTY, DECLARATIONS_MODES,
  ARM_D_DECLARATIONS, ARM_D_HORIZON_PHRASE, ARM_D_SAID, ARM_D_FORK, ARM_D_PLAYER_ASK, ARM_D_OVERRIDES,
  TEXT_1A_DECLARATIONS, TEXT_1A_PLAYER_ASK, TEXT_1A_OVERRIDES, D_SENTENCE_REPLACED, TEXT_1A_SENTENCE, TEXT_1A_FORK_SAID,
} from './agentEvalToolSchema.js';
import {
  armTool, stripDescriptions, assertDescriptionOnlyDiff, ARMS_ROUND3, ARM_LABELS, FROZEN_1A_DECLARATIONS, FROZEN_1A_SENTENCE, ARM_1AC_FORK_SAID,
} from '../../scripts/declarationsWordingArms.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CRON = readFileSync(resolve(HERE, '../cron/agent-evaluate.js'), 'utf8');
const sha = (s) => createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
const ser = (v) => JSON.stringify(v);

/** THE REPLAY COMPARATOR — D's experimental serialization (Astra B1R2-10/11, reproduced here). */
const D_SHA256 = '2a90e67b34a8b1fa2f4d1ad38f3e978858e47b395dfb6762a3c554e2126a3ee3';
const D_CHARS = 13565;
const D_BYTES = 13575;
/** THE 'on' TEXT — round 3's 1A-C since Build 2a (S-8), pinned by hash and length. */
const TEXT_1A_SHA256 = '7388755a59d31522417f0a7501ec4d7c6601dd1f8138a70da8659c467ee293a6';
const TEXT_1A_CHARS = 13623;
const TEXT_1A_BYTES = 13633;
/** THE PRE-PORT Build 1a text — round 3's frozen '1A' arm (the Build 1a build report's pin). */
const FROZEN_1A_SHA256 = '81499cbcf2655ceba51a5b721d33ff918ce21382a4c3b76d9cc34e6bae1f1806';
const FROZEN_1A_CHARS = 13595;

/** Every differing leaf between two serialized trees, by dotted path. */
function leafDiff(a, b, path = '') {
  if (Array.isArray(a) && Array.isArray(b)) {
    const out = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) out.push(...leafDiff(a[i], b[i], `${path}[${i}]`));
    return out;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.flatMap((k) => leafDiff(a[k], b[k], path ? `${path}.${k}` : k));
  }
  return a === b ? [] : [{ path, before: a, after: b }];
}

const off = () => buildTradeDecisionTool({ declarations: 'off' });
const shadow = () => buildTradeDecisionTool({ declarations: 'shadow' });
const on = () => buildTradeDecisionTool({ declarations: 'on' });

describe('buildTradeDecisionTool — three modes (spec §3)', () => {
  it("'off' is the frozen TRADE_DECISION_TOOL itself (identity) — and so is anything that is not 'shadow'/'on'/true", () => {
    expect(off()).toBe(TRADE_DECISION_TOOL);
    expect(buildTradeDecisionTool()).toBe(TRADE_DECISION_TOOL);
    for (const v of [false, 'OFF', 'bogus', null, undefined, 0, 1, 'ON']) expect(buildTradeDecisionTool({ declarations: v }), String(v)).toBe(TRADE_DECISION_TOOL);
    expect(DECLARATIONS_MODES).toEqual(['off', 'shadow', 'on']);
  });

  it("Build 0 boolean compatibility, explicit: `true` is the shadow tool (what true meant), never the 1a tool", () => {
    expect(buildTradeDecisionTool({ declarations: true })).toBe(shadow());
    expect(buildTradeDecisionTool({ declarations: true })).not.toBe(on());
  });

  it("'shadow' and 'on' are the same object each call (built once, deep-frozen) and share no object with each other or with 'off'", () => {
    expect(shadow()).toBe(shadow());
    expect(on()).toBe(on());
    expect(Object.isFrozen(on())).toBe(true);
    expect(Object.isFrozen(on().input_schema.properties.declarations)).toBe(true);
    expect(Object.isFrozen(on().input_schema.properties.declarations.properties.calledShots.items.properties.said)).toBe(true);
    expect(on().input_schema).not.toBe(shadow().input_schema);
    expect(on().input_schema.properties.declarations).not.toBe(DECLARATIONS_PROPERTY);
    expect(on().input_schema.required).not.toBe(TRADE_DECISION_TOOL.input_schema.required);
    expect(() => { on().input_schema.required.push('declarations'); }).toThrow();
    expect(TRADE_DECISION_TOOL.input_schema.required).not.toContain('declarations');
  });

  it("'shadow' and 'on' have IDENTICAL non-description structure, and stripping the declarations property from either yields the base", () => {
    expect(ser(stripDescriptions(on()))).toBe(ser(stripDescriptions(shadow())));
    for (const tool of [shadow(), on()]) {
      const clone = structuredClone(tool);
      delete clone.input_schema.properties.declarations;
      expect(ser(clone)).toBe(ser(TRADE_DECISION_TOOL));
      expect(Object.keys(tool.input_schema.properties).filter((k) => !(k in TRADE_DECISION_TOOL.input_schema.properties))).toEqual(['declarations']);
      expect(tool.input_schema.required).not.toContain('declarations');
    }
  });

  it("'shadow' is the Build 0 on-tool: the BR-3/C2 stored-only text, +4,627 chars over the base", () => {
    expect(shadow().input_schema.properties.declarations).toBe(DECLARATIONS_PROPERTY);
    expect(ser(shadow()).length - ser(TRADE_DECISION_TOOL).length).toBe(4627);
    expect(DECLARATIONS_PROPERTY.description).toContain('These fields are stored only');
  });
});

describe("the 'on' text — D with three description edits (Build 1a's two + the 1A-C port), pinned by hash", () => {
  it(`serializes to SHA-256 ${TEXT_1A_SHA256.slice(0, 8)}…, ${TEXT_1A_CHARS} chars / ${TEXT_1A_BYTES} UTF-8 bytes (JSON.stringify, no whitespace)`, () => {
    const s = ser(on());
    expect(sha(s)).toBe(TEXT_1A_SHA256);
    expect(s.length).toBe(TEXT_1A_CHARS);
    expect(Buffer.byteLength(s, 'utf8')).toBe(TEXT_1A_BYTES);
  });

  it("differs from D in EXACTLY three leaves — the block, the playerAsk and the fork's `said` description — with the exact sentences", () => {
    const diff = leafDiff(JSON.parse(ser(buildArmDTool())), JSON.parse(ser(on())));
    expect(diff.map((d) => d.path)).toEqual([
      'input_schema.properties.declarations.description',
      'input_schema.properties.declarations.properties.playerAsk.description',
      'input_schema.properties.declarations.properties.fork.properties.said.description',
    ]);
    expect(diff[0]).toEqual({ path: 'input_schema.properties.declarations.description', before: ARM_D_DECLARATIONS, after: TEXT_1A_DECLARATIONS });
    expect(diff[1]).toEqual({ path: 'input_schema.properties.declarations.properties.playerAsk.description', before: ARM_D_PLAYER_ASK, after: TEXT_1A_PLAYER_ASK });
    expect(diff[2]).toEqual({
      path: 'input_schema.properties.declarations.properties.fork.properties.said.description',
      before: shadow().input_schema.properties.declarations.properties.fork.properties.said.description,
      after: TEXT_1A_FORK_SAID,
    });
  });

  it("is round 3's 1A-C byte for byte, and differs from the frozen pre-port 1A at exactly the two 1A-C leaves (S-8)", () => {
    expect(ser(on())).toBe(ser(armTool('1A-C')));
    const diff = leafDiff(JSON.parse(ser(armTool('1A'))), JSON.parse(ser(on())));
    expect(diff.map((d) => d.path)).toEqual([
      'input_schema.properties.declarations.description',
      'input_schema.properties.declarations.properties.fork.properties.said.description',
    ]);
    expect(diff[0].before).toBe(FROZEN_1A_DECLARATIONS);
    expect(diff[0].after).toBe(TEXT_1A_DECLARATIONS);
    expect(diff[1].after).toBe(ARM_1AC_FORK_SAID);
    expect(TEXT_1A_FORK_SAID).toBe(ARM_1AC_FORK_SAID);
  });

  it('edit 1: the block drops "Ask me first" and (1A-C) says an answer reaches the agent only when it changes the default — the sentence is replaced, nothing else in the block moves', () => {
    expect(ARM_D_DECLARATIONS).toContain(D_SENTENCE_REPLACED);
    expect(D_SENTENCE_REPLACED).toBe('The player may answer Go, Hold off, or Ask me first; an answer reaches you as a directive at a later check.');
    expect(TEXT_1A_SENTENCE).toBe('The player may answer Go or Hold off; an answer that changes your default reaches you as a directive at a later check.');
    expect(FROZEN_1A_SENTENCE).toBe('The player may answer Go or Hold off; an answer reaches you as a directive at a later check.');
    expect(FROZEN_1A_DECLARATIONS.replace(FROZEN_1A_SENTENCE, TEXT_1A_SENTENCE)).toBe(TEXT_1A_DECLARATIONS);
    expect(ARM_D_DECLARATIONS.replace(D_SENTENCE_REPLACED, TEXT_1A_SENTENCE)).toBe(TEXT_1A_DECLARATIONS);
    expect(TEXT_1A_DECLARATIONS).not.toMatch(/ask me first/i);
    expect(TEXT_1A_DECLARATIONS).toContain(TEXT_1A_SENTENCE);
  });

  it('edit 2: playerAsk is stored and shown, and promises NO answer in this version', () => {
    expect(TEXT_1A_PLAYER_ASK).toBe('Optional. A research question you want the player\'s view on, with 2 to 4 possible answers. Stored and shown to the player; no answer is expected in this version.');
    expect(ARM_D_PLAYER_ASK).toBe('Optional. A research question you want the player\'s view on, with 2 to 4 possible answers. The player may answer it.');
    expect(TEXT_1A_PLAYER_ASK).not.toMatch(/may answer it/);
  });

  it("the other three D overrides ship unchanged in the 'on' text (horizonPhrase, said, fork)", () => {
    const shot = on().input_schema.properties.declarations.properties.calledShots.items.properties;
    expect(shot.horizonPhrase.description).toBe(ARM_D_HORIZON_PHRASE);
    expect(shot.said.description).toBe(ARM_D_SAID);
    expect(on().input_schema.properties.declarations.properties.fork.description).toBe(ARM_D_FORK);
    expect(TEXT_1A_OVERRIDES).toEqual({ ...ARM_D_OVERRIDES, declarations: TEXT_1A_DECLARATIONS, playerAsk: TEXT_1A_PLAYER_ASK, forkSaid: TEXT_1A_FORK_SAID });
  });

  it("the 'on' text names the answers 1a actually accepts and no deferred one; no description names a 20-day level", () => {
    const s = ser(on());
    expect(s).not.toMatch(/Ask me first/);
    expect(s).toMatch(/an answer that changes your default reaches you as a directive at a later check/);
    expect(s).not.toMatch(/an answer reaches you as a directive/);
    expect(s).not.toMatch(/20-day/);
  });
});

describe("D's experimental bytes remain reproducible — the replay comparator (Astra B1R2-10/11)", () => {
  it(`buildArmDTool() serializes to SHA-256 ${D_SHA256.slice(0, 8)}…, ${D_CHARS} chars / ${D_BYTES} bytes`, () => {
    const s = ser(buildArmDTool());
    expect(sha(s)).toBe(D_SHA256);
    expect(s.length).toBe(D_CHARS);
    expect(Buffer.byteLength(s, 'utf8')).toBe(D_BYTES);
  });

  it("the experiment's arms module imports the D text from the schema module: armTool('D') is those bytes, armTool('1A') is the FROZEN pre-port text, A/B are the off/shadow objects", () => {
    expect(ser(armTool('D'))).toBe(ser(buildArmDTool()));
    expect(sha(ser(armTool('D')))).toBe(D_SHA256);
    // Build 2a (S-8): '1A' is frozen at the pre-port bytes so round 3 stays re-runnable; the live tool is 1A-C.
    expect(sha(ser(armTool('1A')))).toBe(FROZEN_1A_SHA256);
    expect(ser(armTool('1A')).length).toBe(FROZEN_1A_CHARS);
    expect(armTool('1A')).not.toBe(on());
    expect(armTool('A')).toBe(TRADE_DECISION_TOOL);
    expect(armTool('B')).toBe(shadow());
    expect(assertDescriptionOnlyDiff(['C', 'D', 'D2', '1A'])).toEqual({ C: true, D: true, D2: true, '1A': true });
    expect(ARMS_ROUND3).toEqual(['A', 'D', '1A']);
    expect(ARM_LABELS['1A']).toContain('Build 1a');
  });

  it('buildArmDTool() is a fresh unfrozen clone each call — the experiment may override it; the shipped tools cannot be mutated through it', () => {
    const a = buildArmDTool();
    expect(a).not.toBe(buildArmDTool());
    expect(Object.isFrozen(a)).toBe(false);
    a.input_schema.properties.declarations.description = 'mutated';
    expect(on().input_schema.properties.declarations.description).toBe(TEXT_1A_DECLARATIONS);
    expect(shadow().input_schema.properties.declarations.description).toBe(DECLARATIONS_PROPERTY.description);
  });
});

describe('the cron hands the builder the RESOLVED mode string (boolean caller migrated — spec §3)', () => {
  it('exactly one tools literal, carrying callsCtx.mode; no boolean caller remains', () => {
    expect(CRON.match(/buildTradeDecisionTool\(/g)).toHaveLength(1);
    expect(CRON).toContain('tools: [buildTradeDecisionTool({ declarations: callsCtx.mode })],');
    expect(CRON).not.toMatch(/buildTradeDecisionTool\(\{ declarations: callsActive/);
  });
});
