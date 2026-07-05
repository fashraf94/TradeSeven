/**
 * correlationVerdict.js unit suite — the plain-language verdict template
 * (V1.1 Change C). Presentation-honesty surface: this locks the strength-band
 * edges, every clause's drop-out on null inputs, the corr60→corr20 fallback,
 * the freshness threshold, and the suppressed-inflections path.
 */
import { describe, it, expect } from 'vitest';
import { buildVerdictSentence, strengthBand, cohesionPhrase, breakStatePhrase, rsiDisplay } from './correlationVerdict.js';

// Minimal payload shaped like /api/research/correlation's response.
const mk = (over = {}) => ({
  byWindow: {
    corr20: { value: over.corr20 ?? null },
    corr60: { value: over.corr60 ?? null },
  },
  leadLag: over.leadLag ?? null,
  inflections: over.inflections ?? null,
  suppressed: over.suppressed ?? {},
  meta: {
    firstEligibleInflectionDate: over.since ?? null,
    joinedCloses: over.joined ?? null,
  },
});

describe('strengthBand — pinned |corr| band edges (H5: banded on the 2dp-rounded value)', () => {
  it('maps each band at its exact rounded boundary', () => {
    expect(strengthBand(0.7)).toBe('strong');
    expect(strengthBand(0.9)).toBe('strong');
    // H5 changed three of these: banding is now on Number(|corr|.toFixed(2)) —
    // the displayed value — so a value that ROUNDS onto an edge takes the upper
    // band. Values just below the rounded edge keep the lower band.
    expect(strengthBand(0.699999)).toBe('strong'); // rounds to 0.70 (pre-H5: 'moderate')
    expect(strengthBand(0.694)).toBe('moderate'); //  rounds to 0.69 — genuinely below the edge
    expect(strengthBand(0.4)).toBe('moderate');
    expect(strengthBand(0.399999)).toBe('moderate'); // rounds to 0.40 (pre-H5: 'loose')
    expect(strengthBand(0.394)).toBe('loose'); //      rounds to 0.39
    expect(strengthBand(0.15)).toBe('loose');
    expect(strengthBand(0.149999)).toBe('loose'); // rounds to 0.15 (pre-H5: null)
    expect(strengthBand(0.144)).toBeNull(); //      rounds to 0.14 → no reliable link
    expect(strengthBand(0)).toBeNull();
    expect(strengthBand(NaN)).toBeNull();
  });
});

describe('strengthBand — display/word agreement (H5, the rounding-family fix)', () => {
  // The founder-smoke property in test form: the band WORD may never contradict
  // the NUMBER the UI prints. Both derive from the same 2dp rounding, so the
  // agreement holds by construction — this sweeps the 0.395 / 0.695-class
  // boundary values across the 0.15 / 0.40 / 0.70 edges to prove it, and pins the
  // pre-H5 bug case (raw 0.395 displayed "0.40" yet banded 'loose').
  const displayed = (v) => Number(Math.abs(v).toFixed(2)); // exactly what fmtCorr prints, as a number
  const tierOfNumber = (n) =>
    n >= 0.7 ? 'strong' : n >= 0.4 ? 'moderate' : n >= 0.15 ? 'loose' : null;

  it('the band word matches the displayed number across the edge slivers (both signs)', () => {
    const samples = [
      0.395, -0.395, 0.404, 0.695, -0.695, 0.704, 0.145, 0.154, 0.149999, 0.204,
      0.196, 0.699999, 0.399999, 0.7, 0.4, 0.15,
    ];
    for (const v of samples) {
      expect(strengthBand(Math.abs(v))).toBe(tierOfNumber(displayed(v)));
    }
  });

  it('pins the pre-H5 bug case: raw 0.395 displays "0.40" and now bands moderate (never loose)', () => {
    expect((0.395).toFixed(2)).toBe('0.40');
    expect(strengthBand(0.395)).toBe('moderate');
  });
});

describe('cohesionPhrase — group-cohesion interpretation (Build 5, sign-aware)', () => {
  it('maps each POSITIVE band to its pinned phrase', () => {
    expect(cohesionPhrase(0.85)).toBe('moving as one right now'); // strong
    expect(cohesionPhrase(0.55)).toBe('mostly moving together'); // moderate
    expect(cohesionPhrase(0.25)).toBe('loosely aligned — several stories in one group'); // loose
  });

  it('sub-floor magnitude (|v| < 0.15, either sign) → "not behaving as one group"', () => {
    expect(cohesionPhrase(0.1)).toBe('not behaving as one group right now');
    expect(cohesionPhrase(-0.1)).toBe('not behaving as one group right now');
    expect(cohesionPhrase(0)).toBe('not behaving as one group right now');
  });

  it('meaningful NEGATIVE cohesion → "pulling in opposite directions" (never a positive band word)', () => {
    // A group split into anti-correlated camps: the mean of SIGNED pairwise
    // correlations goes negative. |−0.85| bands 'strong', but the sign must win —
    // the word may never say "moving as one" against a printed "−0.85" (Rule 9).
    expect(cohesionPhrase(-0.85)).toBe('pulling in opposite directions right now');
    expect(cohesionPhrase(-0.55)).toBe('pulling in opposite directions right now');
    expect(cohesionPhrase(-0.2)).toBe('pulling in opposite directions right now'); // loose-magnitude negative
  });

  it('non-finite input → null (the caller renders "not enough shared history")', () => {
    expect(cohesionPhrase(null)).toBeNull();
    expect(cohesionPhrase(undefined)).toBeNull();
    expect(cohesionPhrase(NaN)).toBeNull();
  });

  it('bands on the DISPLAYED (2dp-rounded) value — the phrase flips exactly where fmtCorr flips', () => {
    expect(cohesionPhrase(0.395)).toBe('mostly moving together'); // prints "+0.40" → moderate
    expect(cohesionPhrase(0.699999)).toBe('moving as one right now'); // prints "+0.70" → strong
    expect(cohesionPhrase(0.1449)).toBe('not behaving as one group right now'); // prints "+0.14" → sub-floor
    expect(cohesionPhrase(0.149999)).toBe('loosely aligned — several stories in one group'); // prints "+0.15" → loose
    // Negative edges: the band-null (sub-floor) check runs BEFORE the sign check.
    expect(cohesionPhrase(-0.149999)).toBe('pulling in opposite directions right now'); // "−0.15" → loose mag → divided
    expect(cohesionPhrase(-0.1449)).toBe('not behaving as one group right now'); // "−0.14" → sub-floor → neutral
  });
});

describe('buildVerdictSentence — base clause', () => {
  it('null when there is no correlation at all (and null payload)', () => {
    expect(buildVerdictSentence(mk({}), 'Brent')).toBeNull();
    expect(buildVerdictSentence(null, 'Brent')).toBeNull();
  });

  it('"move with" + band for a positive corr60', () => {
    const s = buildVerdictSentence(mk({ corr60: 0.82 }), 'Brent');
    expect(s).toBe('Your stocks usually move with Brent (strong link over the past 3 months).');
  });

  it('"move opposite" for a negative corr60 (the VIX case)', () => {
    const s = buildVerdictSentence(mk({ corr60: -0.55 }), 'VIX');
    expect(s).toContain('move opposite VIX');
    expect(s).toContain('moderate link over the past 3 months');
  });

  it('"no reliable link" below the 0.15 floor', () => {
    const s = buildVerdictSentence(mk({ corr60: 0.05 }), 'Gold');
    expect(s).toBe('Your stocks show no reliable link to Gold over the past 3 months.');
  });

  it('falls back to corr20 with "past month" phrasing when corr60 is null', () => {
    const s = buildVerdictSentence(mk({ corr60: null, corr20: 0.5 }), 'Brent');
    expect(s).toContain('over the past month');
    expect(s).not.toContain('3 months');
    expect(s).not.toContain('this month.'); // change clause needs both windows → dropped
  });
});

describe('buildVerdictSentence — change clause (corr20 vs corr60)', () => {
  it('"weakened" when the recent magnitude dropped and the gap ≥ 0.15', () => {
    const s = buildVerdictSentence(mk({ corr60: 0.7, corr20: 0.4 }), 'Brent');
    expect(s).toContain('— but that link has weakened this month');
  });

  it('"tightened" when the recent magnitude rose', () => {
    const s = buildVerdictSentence(mk({ corr60: 0.4, corr20: 0.7 }), 'Brent');
    expect(s).toContain('— but that link has tightened this month');
  });

  it('drops when the gap is under 0.15', () => {
    const s = buildVerdictSentence(mk({ corr60: 0.5, corr20: 0.55 }), 'Brent');
    expect(s).not.toContain('this month');
  });

  it('a positive link that inverts to strongly negative reads "weakened", not "tightened"', () => {
    // corr60 +0.5 → base "move with"; corr20 −0.7 is a sign flip (the link
    // reversed). Magnitude alone (|−0.7|>|0.5|) would wrongly say "tightened".
    const s = buildVerdictSentence(mk({ corr60: 0.5, corr20: -0.7 }), 'Brent');
    expect(s).toContain('move with Brent');
    expect(s).toContain('— but that link has weakened this month');
    expect(s).not.toContain('tightened');
  });

  it('a negative (opposite) link getting more negative reads "tightened"', () => {
    // corr60 −0.4 → base "move opposite"; corr20 −0.8 deepens the opposite link.
    const s = buildVerdictSentence(mk({ corr60: -0.4, corr20: -0.8 }), 'Brent');
    expect(s).toContain('move opposite Brent');
    expect(s).toContain('— but that link has tightened this month');
  });
});

describe('buildVerdictSentence — break clause', () => {
  const episodes = (lastStart, lastIdx, n) =>
    Array.from({ length: n }, (_, i) =>
      i === n - 1
        ? { startDate: lastStart, startCloseIndex: lastIdx }
        : { startDate: `2026-0${i + 1}-01`, startCloseIndex: 100 + i }
    );

  it('names the most recent break, its ordinal, and "since"; marks it fresh when ≤ 10 sessions old', () => {
    const s = buildVerdictSentence(
      mk({ corr60: 0.5, inflections: episodes('2026-07-01', 356, 3), since: '2025-01-15', joined: 360 }),
      'Brent'
    );
    expect(s).toContain('The most recent regime break was 2026-07-01 — the 3rd since 2025-01-15.');
    expect(s).toContain('That break is still fresh.');
  });

  it('omits "fresh" when the latest break is > 10 sessions old', () => {
    const s = buildVerdictSentence(
      mk({ corr60: 0.5, inflections: episodes('2026-05-01', 300, 2), since: '2025-01-15', joined: 360 }),
      'Brent'
    );
    expect(s).toContain('the 2nd since 2025-01-15.');
    expect(s).not.toContain('still fresh');
  });

  it('no break clause when there are zero episodes', () => {
    const s = buildVerdictSentence(mk({ corr60: 0.5, inflections: [] }), 'Brent');
    expect(s).not.toContain('regime break');
  });

  it('replaces the break clause with the suppressed reason', () => {
    const reason = 'insufficient joined history (250 closes, 300 required)';
    const s = buildVerdictSentence(mk({ corr60: 0.5, suppressed: { inflections: reason } }), 'Brent');
    expect(s).toContain(`Regime-break detection isn't available yet — ${reason}.`);
    expect(s).not.toContain('most recent regime break');
  });
});

describe('buildVerdictSentence — lead clause', () => {
  it('driver_leads names the driver; plural days', () => {
    const s = buildVerdictSentence(mk({ corr60: 0.5, leadLag: { verdict: 'driver_leads', bestLag: 2 } }), 'Brent');
    expect(s).toContain('Brent has tended to move first by 2 days.');
  });

  it('group_leads names the stocks; singular day', () => {
    const s = buildVerdictSentence(mk({ corr60: 0.5, leadLag: { verdict: 'group_leads', bestLag: -1 } }), 'Brent');
    expect(s).toContain('Your stocks have tended to move first by 1 day.');
  });

  it('drops for coincident / none / missing leadLag', () => {
    expect(buildVerdictSentence(mk({ corr60: 0.5, leadLag: { verdict: 'coincident', bestLag: 0 } }), 'Brent')).not.toContain('move first');
    expect(buildVerdictSentence(mk({ corr60: 0.5, leadLag: { verdict: 'none', bestLag: 0 } }), 'Brent')).not.toContain('move first');
    expect(buildVerdictSentence(mk({ corr60: 0.5, leadLag: null }), 'Brent')).not.toContain('move first');
  });
});

describe('buildVerdictSentence — full assembly (the energy-trio shape)', () => {
  it('stitches base + change + break(fresh) + lead into one paragraph', () => {
    const s = buildVerdictSentence(
      mk({
        corr60: 0.62,
        corr20: 0.44,
        inflections: [
          { startDate: '2026-03-01', startCloseIndex: 200 },
          { startDate: '2026-05-01', startCloseIndex: 280 },
          { startDate: '2026-07-01', startCloseIndex: 356 },
        ],
        since: '2025-01-15',
        joined: 360,
        leadLag: { verdict: 'driver_leads', bestLag: 2 },
      }),
      'Brent Crude'
    );
    expect(s).toBe(
      'Your stocks usually move with Brent Crude (moderate link over the past 3 months) — but that link has weakened this month. ' +
        'The most recent regime break was 2026-07-01 — the 3rd since 2025-01-15. That break is still fresh. ' +
        'Brent Crude has tended to move first by 2 days.'
    );
  });
});

// ── Build 3.1 Change B — the state-at-break phrase (presentation-honesty) ────
describe('breakStatePhrase — trend words lead, technical detail demoted', () => {
  const ctx = (over) => ({ vs50DMA: null, rsi14: null, rsiZone: null, ...over });

  it('maps the full uptrend / running-hot pair (spec example)', () => {
    expect(breakStatePhrase(ctx({ vs50DMA: 'above', rsi14: 73, rsiZone: 'overbought' }))).toEqual({
      primary: 'uptrend · running hot',
      secondary: 'above 50DMA · RSI 73',
    });
  });

  it('maps downtrend / washed-out (below + oversold)', () => {
    expect(breakStatePhrase(ctx({ vs50DMA: 'below', rsi14: 24, rsiZone: 'oversold' }))).toEqual({
      primary: 'downtrend · washed out',
      secondary: 'below 50DMA · RSI 24',
    });
  });

  it('neutral RSI omits the word from the primary line but keeps the number', () => {
    expect(breakStatePhrase(ctx({ vs50DMA: 'above', rsi14: 55, rsiZone: 'neutral' }))).toEqual({
      primary: 'uptrend',
      secondary: 'above 50DMA · RSI 55',
    });
  });

  it('a null 50DMA drops the trend word / smaBit but keeps the RSI parts', () => {
    expect(breakStatePhrase(ctx({ vs50DMA: null, rsi14: 72, rsiZone: 'overbought' }))).toEqual({
      primary: 'running hot',
      secondary: 'RSI 72',
    });
  });

  it('a null RSI drops the RSI parts but keeps the trend', () => {
    expect(breakStatePhrase(ctx({ vs50DMA: 'below', rsi14: null, rsiZone: null }))).toEqual({
      primary: 'downtrend',
      secondary: 'below 50DMA',
    });
  });

  it('an all-null / missing context returns null (cell renders a single "—")', () => {
    expect(breakStatePhrase(ctx())).toBeNull();
    expect(breakStatePhrase(null)).toBeNull();
    expect(breakStatePhrase(undefined)).toBeNull();
  });

  it('rsiDisplay renders 1dp only in the half-point sliver that would misread the zone', () => {
    expect(rsiDisplay(69.6, 'neutral')).toBe('69.6'); // round→70 would read overbought
    expect(rsiDisplay(30.4, 'neutral')).toBe('30.4'); // round→30 would read oversold
    expect(rsiDisplay(73.2, 'overbought')).toBe('73'); // no contradiction → integer
    expect(rsiDisplay(55, 'neutral')).toBe('55');
    // the sliver rule flows through breakStatePhrase's secondary line
    expect(breakStatePhrase(ctx({ vs50DMA: 'above', rsi14: 69.6, rsiZone: 'neutral' })).secondary).toBe(
      'above 50DMA · RSI 69.6'
    );
  });
});
