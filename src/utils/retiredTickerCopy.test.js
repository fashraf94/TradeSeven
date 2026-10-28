// src/utils/retiredTickerCopy.test.js — BaggerBomb cleanup C4: the two retired-ticker lines.
import { describe, it, expect } from 'vitest';
import { retiredDroppedLine, retiredEditorLine } from './retiredTickerCopy.js';

describe('retiredEditorLine', () => {
  it('names the one symbol to remove, in the ruled words', () => {
    expect(retiredEditorLine(['KRE'])).toBe('KRE is no longer available. Remove it to save.');
  });
  it('names several in a readable list', () => {
    expect(retiredEditorLine(['EA', 'WBA'])).toBe('EA and WBA are no longer available. Remove them to save.');
    expect(retiredEditorLine(['EA', 'WBA', 'KRE'])).toBe('EA, WBA and KRE are no longer available. Remove them to save.');
  });
  it('says nothing without a symbol', () => {
    for (const none of [null, undefined, [], [''], [' '], [3], 'KRE']) expect(retiredEditorLine(none)).toBe(null);
  });
});

describe('retiredDroppedLine', () => {
  it('says what was left out of the saved list', () => {
    expect(retiredDroppedLine(['EA'])).toBe('EA is no longer available, so it was left out of your watchlist.');
    expect(retiredDroppedLine(['EA', 'WBA'])).toBe('EA and WBA are no longer available, so they were left out of your watchlist.');
  });
  it('says nothing when nothing was dropped', () => {
    for (const none of [null, undefined, []]) expect(retiredDroppedLine(none)).toBe(null);
  });
});
