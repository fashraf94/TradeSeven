// api/_utils/deployCeremonyExcerpt.test.js
// Deploy Ceremony — unit tests for the pure brief-excerpt selector
// (DEPLOY_CEREMONY_SPEC_V1 §5 / Amendment A §4.6 / A.2 §5). The invariants:
//   • every non-null return is a verbatim PREFIX of the brief (startsWith),
//   • a cut return TERMINATES AT A SENTENCE BOUNDARY,
//   • no sentence boundary within the cap → null (no misleading word-cut),
//   • slicing never INTRODUCES a lone trailing surrogate (a whole brief that fits
//     is returned verbatim, malformed or not — display agreement, A.3 §4a),
//   • a non-finite / non-positive maxChars fails closed to null (A.3 §4b).

import { describe, it, expect } from 'vitest';
import { selectBriefExcerpt, stripLoneSurrogate } from './deployCeremonyExcerpt.js';

// A brief long enough (>400) that its first sentence boundaries fall inside the
// cap and a later sentence overflows it.
const THREE_SENTENCES =
  'Market breadth is improving and semiconductors lead. ' +
  'Rates are stable, which supports duration-sensitive names. ' +
  'We tilt toward high-conviction momentum names today.';
const LONG_TAIL =
  ' The remainder of the book rounds out with quality core positions and a ' +
  'defensive support sleeve balanced across sectors so that a single-name shock ' +
  'never dominates the daily move and we retain reserve capacity for the next ' +
  'confirmed breakout.';
const MULTI_SENTENCE_BRIEF = THREE_SENTENCES + LONG_TAIL;

describe('selectBriefExcerpt', () => {
  it('returns null for non-string / empty / whitespace input', () => {
    expect(selectBriefExcerpt(null)).toBe(null);
    expect(selectBriefExcerpt(undefined)).toBe(null);
    expect(selectBriefExcerpt(123)).toBe(null);
    expect(selectBriefExcerpt({})).toBe(null);
    expect(selectBriefExcerpt('')).toBe(null);
    expect(selectBriefExcerpt('   \n  ')).toBe(null);
  });

  it('returns a brief that fits the cap verbatim (a prefix of itself)', () => {
    const brief = 'Rotate into semis on the breakout and hold the core.';
    expect(brief.length).toBeLessThanOrEqual(400);
    expect(selectBriefExcerpt(brief)).toBe(brief);
  });

  it('cuts at the LAST sentence boundary within the ~400 cap', () => {
    expect(MULTI_SENTENCE_BRIEF.length).toBeGreaterThan(400);
    const out = selectBriefExcerpt(MULTI_SENTENCE_BRIEF);
    expect(out).toBe(THREE_SENTENCES); // the long 4th sentence overflows and is dropped
    expect(out.length).toBeLessThanOrEqual(400);
    expect(MULTI_SENTENCE_BRIEF.startsWith(out)).toBe(true);
    expect(out.endsWith('.')).toBe(true);
  });

  it('returns null when no sentence boundary falls within the cap (no misleading cut)', () => {
    // One long clause with a trailing conditional that flips the meaning; its only
    // period is beyond the cap, so a word-boundary cut would assert what the brief
    // negates. A.2 §5.1: null, not "We are staying fully defensive and avoiding...".
    const inversion =
      'We are staying fully defensive and avoiding semiconductors and high beta ' +
      'cyclicals and speculative small caps and unprofitable growth and anything ' +
      'extended above its rising moving average across every major sector we track ' +
      'today and we would rather miss the first leg of a move than chase an ' +
      'unconfirmed bounce here unless breadth confirms the advance with a broad ' +
      'clean thrust and new highs expanding together over several sessions first.';
    expect(inversion.length).toBeGreaterThan(400);
    expect(inversion.indexOf('.')).toBeGreaterThan(400); // only period is past the cap
    expect(selectBriefExcerpt(inversion)).toBe(null);
  });

  it('does not treat a decimal point as a sentence boundary', () => {
    // Only in-window periods are decimals → no real boundary → null.
    const decimalsOnly =
      'Our models flag a 3.5 to 4.2 percent range with 1.5 percent stops and 2.0 ' +
      'percent targets and a 0.75 beta tilt and a 1.25 gross exposure cap while we ' +
      'keep 0.5 in reserve and watch the 3.5 pivot and the 4.0 shelf and the 2.5 ' +
      'floor and the 1.0 anchor and scale between 1.5 and 2.5 units per name while ' +
      'trimming anything past the 4.5 extension and reloading near the 2.0 zone and ' +
      'we hedge a 0.25 notional slice against a 1.75 downside scenario every session';
    expect(decimalsOnly.length).toBeGreaterThan(400);
    expect(selectBriefExcerpt(decimalsOnly)).toBe(null);
  });

  it('prefers a real sentence boundary over an earlier decimal', () => {
    const s1 = 'The setup targets a 3.5% move on rising volume and clean breadth.';
    const brief = s1 + ' ' + 'X'.repeat(420); // long tokenless tail overflows the cap
    const out = selectBriefExcerpt(brief);
    expect(out).toBe(s1); // cut at the real period, not after "3."
    expect(out.endsWith('3.')).toBe(false);
  });

  it('treats an abbreviation as a sentence end — a shorter (never longer) excerpt (known, safe)', () => {
    // "U.S." reads as a boundary; the excerpt is shorter than intended but never
    // altered or extended. Failure direction is safe (A.2 §5.5).
    const brief = 'U.S. large caps lead while ' + 'y '.repeat(220).trim() + ' rotates.';
    expect(brief.length).toBeGreaterThan(400);
    const out = selectBriefExcerpt(brief);
    expect(out).toBe('U.S.');
    expect(brief.startsWith(out)).toBe(true);
  });

  it('honours a custom maxChars', () => {
    const brief = 'One sentence here. Two sentences here. Three sentences here now.';
    expect(selectBriefExcerpt(brief, 20)).toBe('One sentence here.');
  });

  it('property: every non-null return is a verbatim prefix ending at a sentence boundary', () => {
    const cases = [
      MULTI_SENTENCE_BRIEF,
      'Short and complete.',
      THREE_SENTENCES,
      'A'.repeat(500) + '. tail',
      'First. ' + 'B'.repeat(500),
      '  Leading whitespace and then a sentence that is complete here.  ',
    ];
    for (const brief of cases) {
      const out = selectBriefExcerpt(brief);
      if (out === null) continue;
      expect(brief.startsWith(out)).toBe(true); // verbatim prefix
      if (brief.length > 400) {
        expect(/[.!?]$/.test(out)).toBe(true); // cut returns terminate at a boundary
      }
    }
  });

  it('slicing never introduces a lone surrogate; keeps valid pairs intact', () => {
    // stripLoneSurrogate direct behavior
    const rocket = '\u{1F680}'; // 🚀 = high+low pair
    expect(stripLoneSurrogate('done ' + rocket)).toBe('done ' + rocket); // pair kept
    expect(stripLoneSurrogate('bad\uD83D')).toBe('bad'); // lone high dropped
    expect(stripLoneSurrogate('bad\uDE80')).toBe('bad'); // lone low dropped
    expect(stripLoneSurrogate('plain text.')).toBe('plain text.'); // no-op
    // An emoji inside a returned sentence survives intact (not split).
    const brief = 'We ride the breakout ' + rocket + ' into strength. ' + 'z'.repeat(420);
    const out = selectBriefExcerpt(brief);
    expect(out).toBe('We ride the breakout ' + rocket + ' into strength.');
    expect(out.includes('�')).toBe(false); // no replacement char
  });

  it('returns a malformed short brief faithfully (whole-brief path bypasses the surrogate guard) (A.3 §4a)', () => {
    // brief fits the cap → returned VERBATIM, lone surrogate and all — the excerpt
    // equals the stored artifact (display agreement), not a scrubbed version.
    expect(selectBriefExcerpt('bad\uD83D')).toBe('bad\uD83D');
  });

  it('fails closed to null for a non-finite or non-positive maxChars (A.3 §4b)', () => {
    const brief = 'A complete sentence here. And another one that follows it.';
    expect(selectBriefExcerpt(brief, 0)).toBe(null);
    expect(selectBriefExcerpt(brief, -50)).toBe(null);
    expect(selectBriefExcerpt(brief, NaN)).toBe(null);
    expect(selectBriefExcerpt(brief, Infinity)).toBe(null);
  });
});
