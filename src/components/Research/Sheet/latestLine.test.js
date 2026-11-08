// Research Modal Build C — BC-3, the latest sentence: quoted, never written.
// The split rule and the token rule are pinned here (spec BC-3 "split by a
// deterministic rule pinned by tests"; BC-10's token rule, applied to the
// rationale too — the build report names that reading).

import { describe, it, expect } from 'vitest';
import { splitSentences, namesSymbol, latestLineOf, SPLIT_EXCEPTIONS } from './latestLine.js';

const ev = (evalId, timestamp, over = {}) => ({ evalId, timestamp, ...over });

describe('the sentence rule (pinned)', () => {
  it('splits after . ! ? followed by whitespace and an uppercase letter, a digit, $ or an opening quote', () => {
    expect(splitSentences('Holding steady. EOG is above VWAP! Is XOM next? $160 is the line. 3 checks left.'))
      .toEqual(['Holding steady.', 'EOG is above VWAP!', 'Is XOM next?', '$160 is the line.', '3 checks left.']);
    // An opening quote or bracket starts a sentence too (review C7 — CL6).
    expect(splitSentences('Holding steady. “EOG leads.” (XOM lags.) Done.')).toEqual(['Holding steady.', '“EOG leads.”', '(XOM lags.)', 'Done.']);
  });
  it('never splits inside a decimal, before a lowercase word, or after a listed abbreviation', () => {
    expect(splitSentences('EOG at 161.48 vs. XOM at 110.2 holds. it is fine.')).toEqual(['EOG at 161.48 vs. XOM at 110.2 holds. it is fine.']);
    expect(splitSentences('Apple Inc. Shares rose.')).toEqual(['Apple Inc. Shares rose.']);
    expect(SPLIT_EXCEPTIONS).toContain('vs.');
  });
  it('a closing quote or bracket stays with its sentence, and every line break is a boundary', () => {
    expect(splitSentences('It said "hold." Then EOG ran.\nNew line here')).toEqual(['It said "hold."', 'Then EOG ran.', 'New line here']);
  });
  it('a piece is quoted as written — trimmed, never reworded', () => {
    const text = '  The trend holds, EOG stays — for now.   Next.';
    expect(splitSentences(text)[0]).toBe('The trend holds, EOG stays — for now.');
  });
});

describe('the token rule (BC-10, applied to BC-3)', () => {
  it('a whole uppercase token of three or more letters matches; a substring or a lowercase word does not', () => {
    expect(namesSymbol('EOG is above VWAP', 'EOG')).toBe(true);
    expect(namesSymbol('the $EOG trade', 'EOG')).toBe(true);
    expect(namesSymbol('ending at EOG.', 'EOG')).toBe(true);
    expect(namesSymbol('EOGX moved', 'EOG')).toBe(false);
    expect(namesSymbol('XEOG moved', 'EOG')).toBe(false);
    expect(namesSymbol('eog moved', 'EOG')).toBe(false);
  });
  it('two-letter and one-letter tickers never match by text (prose cannot be told apart from them)', () => {
    expect(namesSymbol('GE is strong', 'GE')).toBe(false);
    expect(namesSymbol('A stock to watch', 'A')).toBe(false);
    expect(namesSymbol('ON the move', 'ON')).toBe(false);
  });
  it('a hyphenated or dotted ticker matches only whole', () => {
    expect(namesSymbol('BRK-B looks heavy', 'BRK-B')).toBe(true);
    expect(namesSymbol('BRK-BX looks heavy', 'BRK-B')).toBe(false);
    expect(namesSymbol('BRK.B looks heavy', 'BRK.B')).toBe(true);
  });
});

describe('BC-3 — each branch, in order', () => {
  const battle = (evaluations) => ({ evaluations });
  it('1. the first sentence of the LATEST check\'s rationale that names the symbol, verbatim, with the check\'s time', () => {
    const b = battle([
      ev('e1', '2026-10-14T15:00:00.000Z', { rationale: 'EOG first said here.' }),
      ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Midday chop. EOG keeps higher lows, so it stays. EOG again.' }),
    ]);
    expect(latestLineOf({ battle: b, symbol: 'EOG', held: true })).toEqual({ source: 'rationale', text: 'EOG keeps higher lows, so it stays.', atMs: Date.parse('2026-10-14T16:45:00.000Z'), recordId: 'e2' });
  });
  it('only the latest check is searched: an older rationale naming the symbol does not reach back', () => {
    const b = battle([
      ev('e1', '2026-10-14T15:00:00.000Z', { rationale: 'EOG said here.' }),
      ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Nothing about it.' }),
    ]);
    expect(latestLineOf({ battle: b, symbol: 'EOG', held: true }).source).not.toBe('rationale');
  });
  it('2. else the latest call record\'s `said` for this symbol (by mintedAt)', () => {
    const b = battle([ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Nothing about it.' })]);
    const calls = [
      { callId: 'c1', symbol: 'EOG', said: 'Older call.', mintedAt: 1000 },
      { callId: 'c2', symbol: 'EOG', said: '  If EOG loses $158 I take it off.  ', mintedAt: 2000 },
      { callId: 'c3', symbol: 'XOM', said: 'Other name.', mintedAt: 3000 },
    ];
    expect(latestLineOf({ battle: b, symbol: 'EOG', held: true, calls })).toEqual({ source: 'call', text: 'If EOG loses $158 I take it off.', atMs: 2000, recordId: 'c2' });
  });
  it('3. for a bench name, the latest candidates list\'s signalSummary', () => {
    const b = battle([
      ev('e1', '2026-10-14T15:00:00.000Z', { candidates: [{ symbol: 'NVDA', signalSummary: 'Old summary.' }] }),
      ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Nothing.', candidates: [{ symbol: 'NVDA', signalSummary: 'Volume 2× on a breakout.' }] }),
    ]);
    expect(latestLineOf({ battle: b, symbol: 'NVDA', held: false })).toEqual({ source: 'bench', text: 'Volume 2× on a breakout.', atMs: Date.parse('2026-10-14T16:45:00.000Z'), recordId: 'e2' });
  });
  it('a HELD name never takes the bench branch (its summary makes the template "last looked at", never "nothing said")', () => {
    const b = battle([ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Nothing.', candidates: [{ symbol: 'NVDA', signalSummary: 'x' }], evidence: { NVDA: { px: 1 } } })]);
    expect(latestLineOf({ battle: b, symbol: 'NVDA', held: true }).source).toBe('template_looked');
  });
  it('4a. a name a check looked at: the "checked, nothing said" template with that check\'s time (text null — the caller renders it)', () => {
    const b = battle([ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Nothing.', evidence: { EOG: { px: 160 } } })]);
    expect(latestLineOf({ battle: b, symbol: 'EOG', held: true })).toEqual({ source: 'template_checked', text: null, atMs: Date.parse('2026-10-14T16:45:00.000Z'), recordId: 'e2' });
  });
  it('4a. a name an earlier check looked at but no longer held (swapped out): still "checked", with THAT check\'s time', () => {
    const b = battle([
      ev('e1', '2026-10-13T15:00:00.000Z', { rationale: 'Nothing.', evidence: { XOM: { px: 110 } } }),
      ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Nothing either.', evidence: { EOG: { px: 160 } } }),
    ]);
    expect(latestLineOf({ battle: b, symbol: 'XOM', held: false })).toEqual({ source: 'template_checked', text: null, atMs: Date.parse('2026-10-13T15:00:00.000Z'), recordId: 'e1' });
  });
  it('4a. a HELD name no check looked at, under a latest check: "checked" at that check (BC-3 "held") — never "hasn\'t looked" (review C4 — CL4)', () => {
    const b = battle([ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Midday chop.', evidence: { EOG: { px: 160 } } })]);
    expect(latestLineOf({ battle: b, symbol: 'KO', held: true })).toEqual({ source: 'template_checked', text: null, atMs: Date.parse('2026-10-14T16:45:00.000Z'), recordId: 'e2' });
  });
  it('4b. a name never on a check: "hasn\'t looked"', () => {
    expect(latestLineOf({ battle: battle([ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Nothing.' })]), symbol: 'KO', held: false })).toEqual({ source: 'template_never', text: null, atMs: null, recordId: null });
    expect(latestLineOf({ battle: battle([]), symbol: 'KO', held: true }).source).toBe('template_never');
  });
  it('a two-letter held ticker named in the rationale falls through to the template (the token rule)', () => {
    const b = battle([ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'GE holds its gains.', evidence: { GE: { px: 1 } } })]);
    expect(latestLineOf({ battle: b, symbol: 'GE', held: true }).source).toBe('template_checked');
  });
});

describe('the order between branches, with the record in its delivered shapes (review C4)', () => {
  const battle = (evaluations) => ({ evaluations });
  it('a naming rationale AND a call: the rationale wins (rule 1 before rule 2)', () => {
    const b = battle([ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'EOG keeps higher lows.' })]);
    const calls = [{ callId: 'c9', symbol: 'EOG', said: 'If EOG loses $158 I take it off.', mintedAt: Date.parse('2026-10-14T17:00:00.000Z') }];
    expect(latestLineOf({ battle: b, symbol: 'EOG', held: true, calls }).source).toBe('rationale');
  });
  it('a bench summary AND a call: the call wins (rule 2 before rule 3)', () => {
    const b = battle([ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Nothing.', candidates: [{ symbol: 'NVDA', direction: 'potential_entry', signalSummary: 'Volume 2×.' }] })]);
    const calls = [{ callId: 'c4', symbol: 'NVDA', said: 'NVDA comes in for XOM.', mintedAt: 5 }];
    expect(latestLineOf({ battle: b, symbol: 'NVDA', held: false, calls })).toMatchObject({ source: 'call', text: 'NVDA comes in for XOM.', recordId: 'c4' });
  });
  it('calls as the reader delivers them (mintedAt DESCENDING): still the latest one', () => {
    const b = battle([ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Nothing.' })]);
    const calls = [
      { callId: 'c3', symbol: 'EOG', said: 'Newest call.', mintedAt: 3000 },
      { callId: 'c2', symbol: 'EOG', said: 'Middle call.', mintedAt: 2000 },
      { callId: 'c1', symbol: 'EOG', said: 'Oldest call.', mintedAt: 1000 },
    ];
    expect(latestLineOf({ battle: b, symbol: 'EOG', held: true, calls })).toMatchObject({ source: 'call', text: 'Newest call.', recordId: 'c3' });
  });
  it('only the LATEST candidates list is a bench flag: a name on an older list only is not quoted as flagged', () => {
    const b = battle([
      ev('e1', '2026-10-14T15:00:00.000Z', { candidates: [{ symbol: 'NVDA', direction: 'potential_entry', signalSummary: 'Old flag.' }] }),
      ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Nothing.', candidates: [{ symbol: 'AMD', direction: 'potential_entry', signalSummary: 'New flag.' }] }),
    ]);
    expect(latestLineOf({ battle: b, symbol: 'NVDA', held: false })).toEqual({ source: 'template_looked', text: null, atMs: Date.parse('2026-10-14T15:00:00.000Z'), recordId: 'e1' });
  });
});

describe('the template never claims "nothing said" about a check that said something (review A2, A4)', () => {
  const battle = (evaluations) => ({ evaluations });
  it('a newer budget-skipped rationale (no stamps): the template names THAT check — the one rule 1 searched — never the older one it did not', () => {
    const b = battle([
      ev('e1', '2026-10-14T16:45:00.000Z', { rationale: 'AAPL rides the trend, so it stays.', evidence: { AAPL: { px: 103 } } }),
      ev('e2', '2026-10-14T17:00:00.000Z', { rationale: 'Budget skipped this check.' }),
    ]);
    expect(latestLineOf({ battle: b, symbol: 'AAPL', held: true })).toEqual({ source: 'template_checked', text: null, atMs: Date.parse('2026-10-14T17:00:00.000Z'), recordId: 'e2' });
  });
  it('a FAILED or budget-skipped call (haikuError set: the cron\'s canned rationale) is not "the latest check": the check before it is quoted', () => {
    const b = battle([
      ev('e1', '2026-10-14T16:45:00.000Z', { rationale: 'AAPL rides the trend, so it stays.', evidence: { AAPL: { px: 103 } }, haikuError: null }),
      ev('e2', '2026-10-14T17:00:00.000Z', { rationale: 'Evaluation skipped — cron budget too low to start Haiku call. Defaulting to HOLD.', haikuError: { failureClass: 'budget_skipped', evalId: 'e2' }, holdKind: 'default_failure' }),
    ]);
    expect(latestLineOf({ battle: b, symbol: 'AAPL', held: true })).toEqual({ source: 'rationale', text: 'AAPL rides the trend, so it stays.', atMs: Date.parse('2026-10-14T16:45:00.000Z'), recordId: 'e1' });
  });
  it('a sold name whose last check named it (older than the latest rationale): "last looked at" that check, not "nothing said"', () => {
    const b = battle([
      ev('e1', '2026-10-13T15:00:00.000Z', { rationale: 'XOM lost VWAP, so it goes.', evidence: { XOM: { px: 110 } } }),
      ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Nothing about it.', evidence: { EOG: { px: 160 } } }),
    ]);
    expect(latestLineOf({ battle: b, symbol: 'XOM', held: false })).toEqual({ source: 'template_looked', text: null, atMs: Date.parse('2026-10-13T15:00:00.000Z'), recordId: 'e1' });
  });
  it('a potential_exit candidate is never a bench flag: its note is not quoted as one, and the template says "last looked at"', () => {
    const b = battle([ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Nothing.', candidates: [{ symbol: 'XOM', direction: 'potential_exit', signalSummary: 'Exit: lost VWAP twice.' }] })]);
    expect(latestLineOf({ battle: b, symbol: 'XOM', held: false })).toEqual({ source: 'template_looked', text: null, atMs: Date.parse('2026-10-14T16:45:00.000Z'), recordId: 'e2' });
  });
  it('a potential_entry candidate is the bench flag', () => {
    const b = battle([ev('e2', '2026-10-14T16:45:00.000Z', { rationale: 'Nothing.', candidates: [{ symbol: 'XOM', direction: 'potential_entry', signalSummary: 'Back above VWAP.' }] })]);
    expect(latestLineOf({ battle: b, symbol: 'XOM', held: false }).source).toBe('bench');
  });
});

describe('the split rule: an abbreviation after a bracket or an opening quote (review A10)', () => {
  it('"(vs. XLK)" and "“e.g. AAPL" never end a sentence', () => {
    expect(splitSentences('AAPL outperformed (vs. XLK) for a third session. It holds.')).toEqual(['AAPL outperformed (vs. XLK) for a third session.', 'It holds.']);
    expect(splitSentences('Leaders (“e.g. AAPL”) hold. Next.')).toEqual(['Leaders (“e.g. AAPL”) hold.', 'Next.']);
  });
  it('a word that merely ends in an abbreviation\'s letters still ends a sentence ("canvas." is not "vs.")', () => {
    expect(splitSentences('AAPL paints the canvas. Then it ran.')).toEqual(['AAPL paints the canvas.', 'Then it ran.']);
  });
});
