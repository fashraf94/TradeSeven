// api/_utils/playerFieldReaders.test.js
//
// Integrity follow-up 2 (8 Oct 2026), Part B — the readers every server read
// of an owner-writable battle field goes through. Report:
// docs/audits/20261008_BUILD_INTEGRITY_FOLLOWUP_2.md.
//
// Each reader: a well-formed value comes back AS IT IS (the same reference, so
// every server path stays byte-identical); a malformed one reads as absent or
// as the caller's default, and never throws. The end-to-end rows (the
// evaluation cron saves its score, the daily review and the chat answer) are
// agent-evaluate.playerFieldShapes.test.js, agent-batch-review.playerFields.test.js
// and agent/chat.test.js "follow-up 2".
//
// Dependency-surface guard (BUILD_RULES §4): this import of the module the
// cron uses is never mocked.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PRESET, presetKeyOf, meetingOf, meetingLegsOf, historyListOf, battleLedgerOf,
  dailyGradesOf, dailyGradeEntryOf, gradedTradesOf, GRADE_LIST_MAX, GRADE_TEXT_MAX,
} from './playerFieldReaders.js';
import { PRESET_CONFIGS, getPresetConfig } from './agentPresetConfig.js';
import { buildReviewContext } from './voiceLayerPrompt.js';

/** The malformed shapes an owner can store in any field (Firestore has no undefined or functions). */
const SHAPES = [null, 0, 7, -1.5, true, false, '', 'x', 'x'.repeat(200_000), [], [null], [7, 'x'], { a: 1 }, { length: 3, 0: 'x' }, { constructor: 1, toString: 2, hasOwnProperty: 3 }, { toString: 1, valueOf: 2 }];

describe('presetKeyOf — an OWN key of the server\'s preset table, else balanced', () => {
  it('the three presets come back as they are; their configs are exactly what getPresetConfig gave before', () => {
    for (const key of Object.keys(PRESET_CONFIGS)) {
      expect(presetKeyOf(key)).toBe(key);
      expect(getPresetConfig(presetKeyOf(key))).toBe(getPresetConfig(key));
    }
  });

  it('inherited names resolve to balanced — before this build they returned a non-table, and the check threw', () => {
    for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', '__defineGetter__']) {
      expect(presetKeyOf(name), name).toBe(DEFAULT_PRESET);
      expect(getPresetConfig(presetKeyOf(name)).risk.vwapFailureTicks, name).toBe(2);
      // The pre-build lookup, for the record: a plain property read finds the inherited member.
      expect(PRESET_CONFIGS[name] === undefined || typeof PRESET_CONFIGS[name] === 'function' || name === '__proto__', name).toBe(true);
    }
  });

  it('every other string, and every non-string, selects the same balanced table it always did', () => {
    for (const v of [...SHAPES, 'custom', 'AGGRESSIVE', ' balanced', undefined]) {
      expect(getPresetConfig(presetKeyOf(v))).toBe(PRESET_CONFIGS.balanced);
    }
  });
});

describe('meetingOf / meetingLegsOf', () => {
  it('a plain object is the meeting (the same reference); anything else is no meeting', () => {
    const m = { id: 'gpm_1', status: 'approved' };
    expect(meetingOf(m)).toBe(m);
    for (const v of [null, undefined, 0, 7, 'x', true, [], [{ status: 'approved' }]]) expect(meetingOf(v)).toBeNull();
  });

  it('the legs are the plain-object entries of an array, each with its position; nothing else is a leg', () => {
    const a = { symbolOut: 'KO', symbolIn: 'AMD' };
    const b = { symbolOut: 'PG', symbolIn: 'JPM' };
    expect(meetingLegsOf({ suggestedSwaps: [a, null, 7, 'x', ['KO'], b] })).toEqual([{ index: 0, leg: a }, { index: 5, leg: b }]);
    expect(meetingLegsOf({ suggestedSwaps: [a] })[0].leg).toBe(a);
    for (const v of SHAPES) {
      if (Array.isArray(v)) continue;
      expect(meetingLegsOf({ suggestedSwaps: v }), JSON.stringify(v)?.slice(0, 30)).toEqual([]);
    }
    expect(meetingLegsOf(null)).toEqual([]);
    expect(meetingLegsOf({})).toEqual([]);
  });
});

describe('historyListOf — the stored list, else a fresh one (the server\'s append never throws)', () => {
  it('a list comes back as it is; anything else → []', () => {
    const list = [{ id: 'm1' }];
    expect(historyListOf(list)).toBe(list);
    for (const v of SHAPES) {
      if (Array.isArray(v)) { expect(historyListOf(v)).toBe(v); continue; }
      expect(historyListOf(v)).toEqual([]);
      expect(() => [...historyListOf(v), { id: 'row' }]).not.toThrow();
    }
  });
});

describe('battleLedgerOf — the plain-object entries of a list', () => {
  it('a list of objects comes back as it is; non-object entries are dropped; anything else → []', () => {
    const ledger = [{ type: 'debate' }, { type: 'mode_change' }];
    expect(battleLedgerOf(ledger)).toBe(ledger);
    expect(battleLedgerOf([null, { type: 'debate' }, 7])).toEqual([{ type: 'debate' }]);
    for (const v of SHAPES) {
      const out = battleLedgerOf(v);
      expect(Array.isArray(out)).toBe(true);
      expect(() => out.filter((e) => e.type === 'debate')).not.toThrow();
    }
  });
});

describe('dailyGrades — the map, its own entry for a day, the day\'s graded trades', () => {
  const MAP = { '2026-09-09': { trades: [{ tradeIndex: 0, grade: 'A' }], submittedAt: 'x' } };

  it('dailyGradesOf: a map comes back as it is; a list keeps its object entries (capped); anything else → the caller\'s default', () => {
    expect(dailyGradesOf(MAP, {})).toBe(MAP);
    const list = [{ symbol: 'KO', grade: 'A' }];
    expect(dailyGradesOf(list, [])).toBe(list);
    expect(dailyGradesOf([null, list[0], 7], [])).toEqual(list);
    expect(dailyGradesOf(Array.from({ length: GRADE_LIST_MAX + 10 }, (_, i) => ({ i })), [])).toHaveLength(GRADE_LIST_MAX);
    expect(dailyGradesOf([{ note: 'n'.repeat(GRADE_TEXT_MAX + 5) }], [])[0].note).toHaveLength(GRADE_TEXT_MAX);
    for (const v of [null, undefined, 0, 7, 'x', true]) {
      expect(dailyGradesOf(v, [])).toEqual([]);
      expect(dailyGradesOf(v, {})).toEqual({});
    }
  });

  it('dailyGradeEntryOf: the map\'s OWN entry for the date, when it is an object — never an inherited member', () => {
    expect(dailyGradeEntryOf(MAP, '2026-09-09')).toBe(MAP['2026-09-09']);
    expect(dailyGradeEntryOf(MAP, '2026-09-10')).toBeUndefined();
    expect(dailyGradeEntryOf({ '2026-09-09': 'x' }, '2026-09-09')).toBeUndefined();
    expect(dailyGradeEntryOf({}, 'constructor')).toBeUndefined();
    expect(dailyGradeEntryOf([MAP['2026-09-09']], '0')).toBeUndefined();
    for (const v of SHAPES) expect(() => dailyGradeEntryOf(v, '2026-09-09')).not.toThrow();
  });

  it('gradedTradesOf: the object entries of the entry\'s `trades` list', () => {
    expect(gradedTradesOf(MAP['2026-09-09'])).toBe(MAP['2026-09-09'].trades);
    expect(gradedTradesOf({ trades: [null, { grade: 'B' }] })).toEqual([{ grade: 'B' }]);
    for (const v of SHAPES) expect(gradedTradesOf({ trades: v }).every((t) => t && typeof t === 'object')).toBe(true);
    expect(gradedTradesOf(undefined)).toEqual([]);
  });

  it('the REAL voice-layer review context renders the reader\'s value for every shape — and threw on a raw `[null]`', () => {
    for (const v of [...SHAPES, MAP, [{ symbol: 'KO', grade: 'A', note: 'n' }]]) {
      expect(() => buildReviewContext({}, [], dailyGradesOf(v, [])), JSON.stringify(v)?.slice(0, 30)).not.toThrow();
    }
    // Without the reader, an owner-written list holding null — or an unconvertible field — broke the prompt build.
    expect(() => buildReviewContext({}, [], [null])).toThrow();
    expect(() => buildReviewContext({}, [], [{ symbol: { toString: 1 }, grade: 'A' }])).toThrow();
    expect(() => buildReviewContext({}, [], dailyGradesOf([{ symbol: { toString: 1 }, grade: 'A', note: { valueOf: 1 } }], []))).not.toThrow();
    expect(dailyGradesOf([{ symbol: { toString: 1 }, grade: 'A' }], [])).toEqual([{ grade: 'A' }]);
    // Well formed, byte for byte the same text through the reader as without it.
    const list = [{ symbol: 'KO', grade: 'A', note: 'n' }];
    expect(buildReviewContext({}, [], dailyGradesOf(list, []))).toBe(buildReviewContext({}, [], list));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integrity follow-up 2, review K5 (the mutation lens): rows that kill mutants
// the rows above let survive (report §12.3; the M5-n ids are its mutant table).
describe('K5 — dailyGradeEntryOf reads an OWN entry only, even when an inherited one is a plain object (nit: M5-163)', () => {
  it('an inherited plain-object entry for the day is absent', () => {
    const grades = Object.create({ '2026-09-09': { trades: [{ grade: 'A' }] } });
    expect(dailyGradeEntryOf(grades, '2026-09-09')).toBeUndefined();
  });
});
