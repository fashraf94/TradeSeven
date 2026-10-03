// api/_utils/callRecords/answers.test.js
//
// Cockpit Build 2a — THE ANSWER-LEGALITY TABLE (spec S-4; Amendment B §1,
// Amendment C-2): one home for the endpoint and the cockpit's tiles. The
// table row by row, the upside rule, and the tile's two-button order.
//
// Dependency-surface guard (BUILD_RULES §4 / spec S-7): this module is
// imported by the CLIENT, so its import graph must stay Node-clean and
// browser-clean — this test's import of it is that guard and is never mocked.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyAnswer, tileAnswersFor, isUpsideCall, ANSWERS_1A, DEFERRED_ANSWERS } from './answers.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const shot = (over = {}) => ({ kind: 'called_shot', symbol: 'AMD', direction: 'entry', defaultAction: 'act', ...over });
const pick = (over = {}) => ({ kind: 'pick', symbol: null, direction: null, defaultAction: null, options: [{ symbol: 'AMD' }], ...over });

describe('classifyAnswer — the table (Amendment B §1)', () => {
  it.each([
    ['act-default shot', shot(), { go: 'ack', hold: 'directive', go_now: null, pick: null, agree: null, disagree: null }],
    ['act-default confirmation', shot({ kind: 'confirmation', direction: 'exit' }), { go: 'ack', hold: 'directive', go_now: null, pick: null, agree: null, disagree: null }],
    ['hold-default shot', shot({ defaultAction: 'hold' }), { go: null, hold: 'ack', go_now: 'directive', pick: null, agree: null, disagree: null }],
    ['pick', pick(), { go: null, hold: null, go_now: null, pick: 'directive', agree: 'ack', disagree: 'ack' }],
    ['no default', shot({ defaultAction: null }), { go: null, hold: null, go_now: null, pick: null, agree: null, disagree: null }],
  ])('%s', (_label, call, want) => {
    for (const answer of ANSWERS_1A) expect(classifyAnswer(call, answer), answer).toBe(want[answer]);
  });

  it('Amendment C-2: EVERY answer on an upside call (heldAtMint) is illegal, whatever its default', () => {
    for (const defaultAction of ['act', 'hold']) {
      for (const answer of [...ANSWERS_1A, ...DEFERRED_ANSWERS]) {
        expect(classifyAnswer(shot({ heldAtMint: true, defaultAction }), answer), `${defaultAction}/${answer}`).toBeNull();
      }
    }
  });

  it('records without the field read as heldAtMint false; a pick is never an upside call', () => {
    expect(isUpsideCall(shot())).toBe(false);
    expect(isUpsideCall(shot({ heldAtMint: false }))).toBe(false);
    expect(isUpsideCall(shot({ heldAtMint: 'true' }))).toBe(false);
    expect(isUpsideCall(shot({ heldAtMint: true }))).toBe(true);
    expect(isUpsideCall(pick({ heldAtMint: true }))).toBe(false);
    expect(classifyAnswer(null, 'go')).toBeNull();
  });
});

describe('tileAnswersFor — the buttons a tile offers (spec §7.3)', () => {
  it('act default: Go (ack) then Hold off (directive); hold default: Hold (ack) then Go instead (directive)', () => {
    expect(tileAnswersFor(shot())).toEqual([{ answer: 'go', row: 'ack' }, { answer: 'hold', row: 'directive' }]);
    expect(tileAnswersFor(shot({ kind: 'confirmation', direction: 'exit' }))).toEqual([{ answer: 'go', row: 'ack' }, { answer: 'hold', row: 'directive' }]);
    expect(tileAnswersFor(shot({ defaultAction: 'hold' }))).toEqual([{ answer: 'hold', row: 'ack' }, { answer: 'go_now', row: 'directive' }]);
    expect(tileAnswersFor(shot({ direction: 'exit', defaultAction: 'hold' }))).toEqual([{ answer: 'hold', row: 'ack' }, { answer: 'go_now', row: 'directive' }]);
  });

  it('an upside call, a pick (not shown in 2a) and a call with no legal answer offer none', () => {
    expect(tileAnswersFor(shot({ heldAtMint: true }))).toEqual([]);
    expect(tileAnswersFor(pick())).toEqual([]);
    expect(tileAnswersFor(shot({ defaultAction: 'maybe' }))).toEqual([]);
    expect(tileAnswersFor(null)).toEqual([]);
  });

  it('every button the tile offers is a row the endpoint\'s own table accepts — by construction', () => {
    for (const call of [shot(), shot({ defaultAction: 'hold' }), shot({ kind: 'confirmation', direction: 'exit' })]) {
      for (const { answer, row } of tileAnswersFor(call)) expect(classifyAnswer(call, answer)).toBe(row);
    }
  });
});

describe('the module stays client-safe (spec S-7)', () => {
  it('imports nothing but copy.js, and uses no process / Buffer / SDK', () => {
    const src = readFileSync(resolve(HERE, 'answers.js'), 'utf8');
    const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports).toEqual(['./copy.js']);
    expect(src).not.toMatch(/\bprocess\.|\bBuffer\b|firebase|@anthropic/);
  });
});
