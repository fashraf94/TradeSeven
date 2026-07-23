// src/components/Dashboard/deployCeremony/ceremonyData.test.js
//
// Deploy Ceremony — pure data derivations. These lock the honesty-critical logic:
// picks derived by construction from the one stored portfolio object (§9),
// monologue suppressed whenever a fallback template stood in (§6), and the
// truncation indicator only when the excerpt is a real shorter prefix (§6/A.2 §5.3).
//
// The watchlist-symbol fetch pulls in the forge service transitively; mock it so
// this stays a pure unit test with no firebase import.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../services/forgeWatchlistService', () => ({ listWatchlists: vi.fn() }));

import { flattenPicks, firstSentence, getMonologueQuote, isExcerptTruncated } from './ceremonyData';

describe('flattenPicks', () => {
  it('flattens [star, core, support] → symbols, in tier order', () => {
    const portfolio = {
      star: [{ symbol: 'NVDA' }],
      core: [{ symbol: 'GEV' }, { symbol: 'CEG' }],
      support: [{ symbol: 'EMR' }],
    };
    expect(flattenPicks(portfolio)).toEqual(['NVDA', 'GEV', 'CEG', 'EMR']);
  });

  it('tolerates string entries and missing tiers', () => {
    expect(flattenPicks({ star: ['AAA'], support: [{ symbol: 'BBB' }] })).toEqual(['AAA', 'BBB']);
  });

  it('drops entries with no symbol and returns [] for junk', () => {
    expect(flattenPicks({ core: [{}, { symbol: 'X' }, null] })).toEqual(['X']);
    expect(flattenPicks(null)).toEqual([]);
    expect(flattenPicks([])).toEqual([]); // a flat array is not the tiered shape
  });
});

describe('firstSentence', () => {
  it('returns the first sentence up to terminal punctuation', () => {
    expect(firstSentence('Fade the obvious. Own the plumbing.')).toBe('Fade the obvious.');
    expect(firstSentence('Ready!')).toBe('Ready!');
  });
  it('returns the whole trimmed string when there is no terminator', () => {
    expect(firstSentence('  no terminator here  ')).toBe('no terminator here');
  });
  it('returns null for non-strings / empty', () => {
    expect(firstSentence('')).toBeNull();
    expect(firstSentence(null)).toBeNull();
    expect(firstSentence(undefined)).toBeNull();
  });
});

describe('getMonologueQuote — §6 monologue suppression', () => {
  const ld = { innerMonologue: { strategy: 'Everyone chases chips. I buy the grid.' } };

  it('returns the first sentence when the agent actually reasoned (fallbackKind null)', () => {
    expect(getMonologueQuote(ld, null)).toBe('Everyone chases chips.');
  });

  it('SUPPRESSES the quote whenever fallbackKind !== null (canned template)', () => {
    expect(getMonologueQuote(ld, 'strategy')).toBeNull();
    expect(getMonologueQuote(ld, 'construction')).toBeNull();
  });

  it('returns null for missing / empty monologue (never a placeholder)', () => {
    expect(getMonologueQuote({ innerMonologue: {} }, null)).toBeNull();
    expect(getMonologueQuote({ innerMonologue: { strategy: '   ' } }, null)).toBeNull();
    expect(getMonologueQuote(null, null)).toBeNull();
  });
});

describe('isExcerptTruncated — §6 truncation indicator', () => {
  it('true only when the excerpt is a real prefix shorter than the full brief', () => {
    expect(isExcerptTruncated('First sentence.', 'First sentence. And more.')).toBe(true);
  });
  it('false when excerpt equals the full brief', () => {
    expect(isExcerptTruncated('All of it.', 'All of it.')).toBe(false);
  });
  it('false when the full brief is unavailable (omit, never fabricate)', () => {
    expect(isExcerptTruncated('Something.', null)).toBe(false);
    expect(isExcerptTruncated(null, 'Something.')).toBe(false);
  });
});
