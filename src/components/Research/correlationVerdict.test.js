/**
 * correlationVerdict.js unit suite — the plain-language verdict template
 * (V1.1 Change C). Presentation-honesty surface: this locks the strength-band
 * edges, every clause's drop-out on null inputs, the corr60→corr20 fallback,
 * the freshness threshold, and the suppressed-inflections path.
 */
import { describe, it, expect } from 'vitest';
import { buildVerdictSentence, strengthBand } from './correlationVerdict.js';

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

describe('strengthBand — pinned |corr| band edges', () => {
  it('maps each band at its exact boundary', () => {
    expect(strengthBand(0.7)).toBe('strong');
    expect(strengthBand(0.9)).toBe('strong');
    expect(strengthBand(0.699999)).toBe('moderate');
    expect(strengthBand(0.4)).toBe('moderate');
    expect(strengthBand(0.399999)).toBe('loose');
    expect(strengthBand(0.15)).toBe('loose');
    expect(strengthBand(0.149999)).toBeNull(); // < 0.15 → no reliable link
    expect(strengthBand(0)).toBeNull();
    expect(strengthBand(NaN)).toBeNull();
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
