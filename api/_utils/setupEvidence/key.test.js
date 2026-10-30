// api/_utils/setupEvidence/key.test.js
//
// ID-1 Build 1 — the snapshot key: lossless over the whole triple, validated
// member by member, and rejecting what it would not have produced.

import { describe, it, expect } from 'vitest';
import { parseSnapshotId, ruleKeyOf, snapshotIdOf } from './key.js';
import { describeRuleSet } from '../setupEvaluator/thresholds.js';

const RULE_SET = { setupVersion: 'tf-setup-v1', thresholdsHash: '26f3f411b566', semanticsId: 'tf-setup-v1/sem-1' };
const KEY = { session: '2026-10-29', symbol: 'NVDA', ruleSet: RULE_SET };
const ID = '2026-10-29__NVDA__tf-setup-v1.26f3f411b566.tf-setup-v1~sem-1';

describe('the key round trip', () => {
  it('today\'s rule set: the id the contract spells, and parsing it returns the triple exactly', () => {
    expect(describeRuleSet()).toEqual(RULE_SET);
    expect(ruleKeyOf(describeRuleSet())).toBe('tf-setup-v1.26f3f411b566.tf-setup-v1~sem-1');
    expect(snapshotIdOf(KEY)).toBe(ID);
    expect(parseSnapshotId(ID)).toEqual(KEY);
  });
  it.each([['BRK-B'], ['BF.B'], ['A'], ['X2'], ['SPY']])('a symbol with its punctuation round-trips: %s', (symbol) => {
    expect(parseSnapshotId(snapshotIdOf({ ...KEY, symbol }))).toEqual({ ...KEY, symbol });
  });
  it('a later version, hash and semantics round-trip', () => {
    const ruleSet = { setupVersion: 'tf-setup-v12', thresholdsHash: 'abcdef012345', semanticsId: 'tf-setup-v12/sem-30' };
    expect(parseSnapshotId(snapshotIdOf({ ...KEY, ruleSet }))).toEqual({ ...KEY, ruleSet });
  });
  it('an id holds no character a Firestore document id forbids', () => {
    expect(snapshotIdOf(KEY)).not.toContain('/');
  });
});

describe('two triples never share an id', () => {
  it('differing only in the semantics prefix', () => {
    const a = snapshotIdOf(KEY);
    const b = snapshotIdOf({ ...KEY, ruleSet: { ...RULE_SET, semanticsId: 'tf-setup-v2/sem-1' } });
    expect(a).not.toBe(b);
    expect(parseSnapshotId(b).ruleSet.semanticsId).toBe('tf-setup-v2/sem-1');
  });
  it.each([
    ['setupVersion', { ...RULE_SET, setupVersion: 'tf-setup-v2' }],
    ['thresholdsHash', { ...RULE_SET, thresholdsHash: '26f3f411b567' }],
    ['the semantics number', { ...RULE_SET, semanticsId: 'tf-setup-v1/sem-2' }],
  ])('differing only in %s', (_label, ruleSet) => {
    expect(snapshotIdOf({ ...KEY, ruleSet })).not.toBe(snapshotIdOf(KEY));
  });
});

describe('a malformed member is rejected', () => {
  it.each([
    ['setupVersion missing', { thresholdsHash: RULE_SET.thresholdsHash, semanticsId: RULE_SET.semanticsId }],
    ['thresholdsHash missing', { setupVersion: RULE_SET.setupVersion, semanticsId: RULE_SET.semanticsId }],
    ['semanticsId missing', { setupVersion: RULE_SET.setupVersion, thresholdsHash: RULE_SET.thresholdsHash }],
    ['a fourth member', { ...RULE_SET, extra: 'x' }],
    ['setupVersion not a string', { ...RULE_SET, setupVersion: 1 }],
    ['setupVersion holding a dot', { ...RULE_SET, setupVersion: 'tf.setup-v1' }],
    ['setupVersion holding the separator', { ...RULE_SET, setupVersion: 'tf__setup-v1' }],
    ['setupVersion holding a tilde', { ...RULE_SET, setupVersion: 'tf~setup-v1' }],
    ['setupVersion with no version', { ...RULE_SET, setupVersion: 'tf-setup' }],
    ['setupVersion in capitals', { ...RULE_SET, setupVersion: 'TF-SETUP-V1' }],
    ['a short hash', { ...RULE_SET, thresholdsHash: '26f3f411b56' }],
    ['a long hash', { ...RULE_SET, thresholdsHash: '26f3f411b5660' }],
    ['a hash that is not hex', { ...RULE_SET, thresholdsHash: '26f3f411b56z' }],
    ['a hash in capitals', { ...RULE_SET, thresholdsHash: '26F3F411B566' }],
    ['semanticsId with no prefix', { ...RULE_SET, semanticsId: 'sem-1' }],
    ['semanticsId with two slashes', { ...RULE_SET, semanticsId: 'tf-setup-v1/sem/1' }],
    ['semanticsId already tilded', { ...RULE_SET, semanticsId: 'tf-setup-v1~sem-1' }],
    ['semanticsId holding the separator', { ...RULE_SET, semanticsId: 'tf__setup-v1/sem-1' }],
    ['semanticsId holding a dot', { ...RULE_SET, semanticsId: 'tf-setup-v1/sem.1' }],
    ['null', null],
    ['an array', ['tf-setup-v1', '26f3f411b566', 'tf-setup-v1/sem-1']],
  ])('rule set: %s', (_label, ruleSet) => {
    expect(() => ruleKeyOf(ruleSet)).toThrow(TypeError);
    expect(() => snapshotIdOf({ ...KEY, ruleSet })).toThrow(TypeError);
  });
  it.each([['lower case', 'nvda'], ['a slash', 'BRK/B'], ['the separator', 'BRK__B'], ['an underscore', 'BRK_B'], ['a space', 'BRK B'], ['empty', ''], ['the provider suffix', 'NVDA.US'], ['a leading dot', '.NVDA'], ['a trailing hyphen', 'NVDA-'], ['a double hyphen', 'BRK--B'], ['not a string', 7], ['undefined', undefined]])('symbol: %s', (_label, symbol) => {
    expect(() => snapshotIdOf({ ...KEY, symbol })).toThrow(TypeError);
  });
  it.each([['no dashes', '20261029'], ['an impossible date', '2026-02-30'], ['month 13', '2026-13-01'], ['a timestamp', '2026-10-29T00:00:00Z'], ['empty', ''], ['undefined', undefined]])('session: %s', (_label, session) => {
    expect(() => snapshotIdOf({ ...KEY, session })).toThrow(TypeError);
  });
  it('no arguments at all', () => {
    expect(() => snapshotIdOf()).toThrow(TypeError);
  });
});

describe('parseSnapshotId rejects what snapshotIdOf would not have produced', () => {
  it.each([
    ['not a string', 42],
    ['empty', ''],
    ['no separators', 'x'],
    ['two parts', '2026-10-29__NVDA'],
    ['four parts', `${ID}__extra`],
    ['a rule key of two members', '2026-10-29__NVDA__tf-setup-v1.26f3f411b566'],
    ['a rule key of four members', '2026-10-29__NVDA__tf-setup-v1.26f3f411b566.tf-setup-v1~sem-1.x'],
    ['an unencoded slash', '2026-10-29__NVDA__tf-setup-v1.26f3f411b566.tf-setup-v1/sem-1'],
    ['no tilde', '2026-10-29__NVDA__tf-setup-v1.26f3f411b566.sem-1'],
    ['two tildes', '2026-10-29__NVDA__tf-setup-v1.26f3f411b566.tf~setup-v1~sem-1'],
    ['a bad session', '2026-02-30__NVDA__tf-setup-v1.26f3f411b566.tf-setup-v1~sem-1'],
    ['a bad symbol', '2026-10-29__nvda__tf-setup-v1.26f3f411b566.tf-setup-v1~sem-1'],
  ])('%s', (_label, id) => {
    expect(() => parseSnapshotId(id)).toThrow(TypeError);
  });
});
