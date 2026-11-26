// api/_utils/explore/matchRule.test.js
//
// Explore publish step — THE WORD-FOR-WORD RULE (build prompt K-6). Each step of the rule, and nothing looser.
// (Strings with typographic characters are written as escapes so this file holds no invisible byte.)

import { describe, it, expect } from 'vitest';
import { underRule, quoteIn, textHashOf, RULE_VERSION } from './matchRule.js';

const TEXT = underRule('Cloud revenue increased 48% \u2013 driven by \u201Cdata center\u201D demand, to $46.0\u00A0billion.\nCapital expenditures were $51.4 bil\u00ADlion.');

describe('the rule', () => {
  it('is version 1', () => { expect(RULE_VERSION).toBe(1); });

  it.each([
    ['NFKC (a full-width digit, a ligature)', '\uFF14\uFF18% \uFB01ne', '48% fine'],
    ['curly single and double quotes to straight ones', '\u2018a\u2019 \u201Cb\u201D \u201Ec\u201F', '\'a\' "b" "c"'],
    ['every dash and the minus sign to a hyphen', 'a\u2010b\u2011c\u2012d\u2013e\u2014f\u2015g\u2212h\uFE63i', 'a-b-c-d-e-f-g-h-i'],
    ['soft hyphens removed', 'bil\u00ADlion', 'billion'],
    ['a non-breaking space, a tab and a line break to one space', 'a\u00A0b\tc\nd\r\n\r\ne', 'a b c d e'],
    ['the ends trimmed', '  a  ', 'a'],
    ['case kept', 'Data Center', 'Data Center'],
    ['a non-string', null, ''],
  ])('%s', (_, input, expected) => {
    expect(underRule(input)).toBe(expected);
  });

  it.each([
    ['the quote with straight quotes and a hyphen', 'increased 48% - driven by "data center" demand', true],
    ['the quote as the page writes it', 'increased 48% \u2013 driven by \u201Cdata center\u201D demand', true],
    ['an em dash where the page has an en dash', 'increased 48% \u2014 driven', true],
    ['across the line break', 'to $46.0 billion. Capital expenditures', true],
    ['across the soft hyphen', 'were $51.4 billion.', true],
    ['one word different', 'Cloud revenue increased 49%', false],
    ['one word missing', 'Cloud revenue 48%', false],
    ['case changed', 'cloud revenue increased 48%', false],
    ['a space added inside a token', 'increased 48 %', false],
    ['a space removed', 'datacenter', false],
    ['an empty quote', '   ', false],
    ['not a string', 48, false],
  ])('%s → %s', (_, quote, expected) => {
    expect(quoteIn(TEXT, quote)).toBe(expected);
  });

  it('the text hash is the SHA-256 of the text under the rule', () => {
    expect(textHashOf('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
