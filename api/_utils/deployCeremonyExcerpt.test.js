// api/_utils/deployCeremonyExcerpt.test.js
// Deploy Ceremony — unit tests for the pure brief-excerpt selector
// (DEPLOY_CEREMONY_SPEC_V1 §5 / Amendment A §4.6). The invariant under test is
// the honesty rule: the excerpt is ALWAYS a verbatim contiguous substring of the
// input (never rewritten, never appended-to), sentence-bounded within ~220 chars.

import { describe, it, expect } from 'vitest';
import { selectBriefExcerpt } from './deployCeremonyExcerpt.js';

describe('selectBriefExcerpt', () => {
  it('returns null for non-string / empty / whitespace input', () => {
    expect(selectBriefExcerpt(null)).toBe(null);
    expect(selectBriefExcerpt(undefined)).toBe(null);
    expect(selectBriefExcerpt(123)).toBe(null);
    expect(selectBriefExcerpt({})).toBe(null);
    expect(selectBriefExcerpt('')).toBe(null);
    expect(selectBriefExcerpt('   \n  ')).toBe(null);
  });

  it('returns a short brief verbatim (trimmed)', () => {
    expect(selectBriefExcerpt('Rotate into semis on the breakout.')).toBe(
      'Rotate into semis on the breakout.'
    );
    expect(selectBriefExcerpt('  Leading whitespace trimmed.  ')).toBe(
      'Leading whitespace trimmed.'
    );
  });

  it('cuts at the last sentence boundary within the cap', () => {
    const brief =
      'Market breadth is improving and semis lead. Rates are stable, which supports duration-sensitive names. ' +
      'We tilt toward high-conviction momentum with a defensive support sleeve, then round out with quality core positions to balance the book across sectors for resilience.';
    const out = selectBriefExcerpt(brief);
    // Ends on a sentence boundary, within the cap, and is a verbatim prefix.
    expect(brief.startsWith(out)).toBe(true);
    expect(out.length).toBeLessThanOrEqual(220);
    expect(out.endsWith('.')).toBe(true);
    expect(out).toBe(
      'Market breadth is improving and semis lead. Rates are stable, which supports duration-sensitive names.'
    );
  });

  it('never returns more than a verbatim substring (honesty invariant)', () => {
    const brief =
      'A'.repeat(50) + '. ' + 'B'.repeat(400); // early period, then a long tail
    const out = selectBriefExcerpt(brief);
    expect(brief.includes(out)).toBe(true);
    expect(out.length).toBeLessThanOrEqual(220);
  });

  it('does not treat a decimal point as a sentence boundary', () => {
    // > 220 chars, and the ONLY period within the first 220 is the decimal in
    // "3.5%"; the sentence-ending period sits beyond the cap.
    const brief =
      'The setup targets a 3.5% move with tight risk and a clean base under resistance ' +
      'and we size it for a measured push through the prior swing high on rising participation ' +
      'across the tape and into the close as momentum broadens out.';
    expect(brief.length).toBeGreaterThan(220);
    const out = selectBriefExcerpt(brief);
    // Must fall back to a word boundary, never cut after "3." mid-number.
    expect(brief.startsWith(out)).toBe(true);
    expect(out.endsWith('3.')).toBe(false);
    expect(out.endsWith(' ')).toBe(false); // trimmed
    expect(out.length).toBeLessThanOrEqual(220);
  });

  it('falls back to a word boundary when no sentence boundary is usable', () => {
    const brief = 'word '.repeat(100).trim(); // 500 chars, no punctuation
    const out = selectBriefExcerpt(brief);
    expect(brief.startsWith(out)).toBe(true);
    expect(out.length).toBeLessThanOrEqual(220);
    expect(out.endsWith(' ')).toBe(false);
    expect(out.endsWith('word')).toBe(true); // no mid-word cut
  });

  it('hard-cuts a single very long token at the cap', () => {
    const brief = 'X'.repeat(500);
    const out = selectBriefExcerpt(brief);
    expect(out).toBe('X'.repeat(220));
  });

  it('honours a custom maxChars', () => {
    const brief = 'One sentence here. Two sentences here. Three sentences here.';
    const out = selectBriefExcerpt(brief, 20);
    expect(brief.startsWith(out)).toBe(true);
    expect(out).toBe('One sentence here.');
  });
});
