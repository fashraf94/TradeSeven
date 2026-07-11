/**
 * Conformance validator — the honesty model, executable in BOTH directions:
 *   • Golden accept: each of the 8 contract classes → a known-good rendering that
 *     PASSES (and still passes through curly quotes / zero-width / NBSP noise).
 *   • Adversarial reject: the stance's attack classes — every one MUST fail, with
 *     the expected structured code where the first-failing check is deterministic.
 *
 * Cases 15 (plan-level adverse omission) and 16 (stale-validator cache hit) are
 * defended upstream and downstream of this module — asserted in
 * narrationPlan.test.js and correlation-narrate.test.js respectively.
 */
import { describe, it, expect } from 'vitest';
import { validateNarration } from './narrationConformance.js';
import { buildNarrationPlan } from './narrationPlan.js';
import { CLASSES, DRIVER_LABEL } from './narrationCorpus.js';
import { templateFor, fillSlots, CONNECTIVES } from './narrationPhrasebook.js';

const mkPlan = (make) => buildNarrationPlan(make(), { driverLabel: DRIVER_LABEL }).plan;

// A faithful rendering: variant[variantIndex] per claim, optional connectives.
function render(plan, { variantIndex = 0, connectives = null } = {}) {
  return {
    sentences: plan.claims.map((c, i) => {
      const vid = c.allowedVariants[Math.min(variantIndex, c.allowedVariants.length - 1)];
      const conn = connectives ? connectives[i] ?? '' : '';
      return { claimId: c.claimId, variantId: vid, text: conn + fillSlots(templateFor(c.claimId, vid), c.spans) };
    }),
  };
}

const CLASS_NAMES = [
  'solidStandard', 'fragileStandard', 'limitedStandard', 'inFluxStandard',
  'solidMarketProxy', 'fragileMarketProxy', 'inFluxMarketProxy', 'solidStandardTwoStrong',
  'tnxDriverContext',
];

describe('conformance — golden accept (the 8 contract classes)', () => {
  for (const name of CLASS_NAMES) {
    it(`${name}: a faithful rendering passes`, () => {
      const plan = mkPlan(CLASSES[name]);
      const res = validateNarration(render(plan), plan);
      expect(res.valid, JSON.stringify(res)).toBe(true);
      expect(res.variantsUsed).toHaveLength(plan.claims.length);
    });
  }

  it('accepts every variant choice and every approved connective', () => {
    const plan = mkPlan(CLASSES.fragileStandard);
    // second variant of each claim + rotating connectives
    const connectives = plan.claims.map((_, i) => CONNECTIVES[i % CONNECTIVES.length]);
    expect(validateNarration(render(plan, { variantIndex: 1, connectives }), plan).valid).toBe(true);
  });

  it('is robust to zero-width, NBSP, and curly-quote noise', () => {
    const plan = mkPlan(CLASSES.solidMarketProxy);
    const g = render(plan);
    g.sentences = g.sentences.map((s) => ({
      ...s,
      text: s.text.replace(/ /g, ' ​').replace(/'/g, '’'), // NBSP+ZWSP, curly apostrophe
    }));
    expect(validateNarration(g, plan).valid).toBe(true);
  });
});

describe('conformance — adversarial reject (each MUST fail)', () => {
  const pSolid = mkPlan(CLASSES.solidStandard); // [headline, capture, tail]
  const pFragile = mkPlan(CLASSES.fragileStandard); // [caveat_fragile, headline, capture, tail, closing]
  const pProxy = mkPlan(CLASSES.solidMarketProxy); // [proxy, headline, capture, tail]
  const pLimited = mkPlan(CLASSES.limitedStandard); // [caveat_limited, headline, capture, tail, closing]

  const betaDown = pSolid.claims[1].spans.betaDown; // e.g. +1.30 (capture down-day beta)
  const nDown = pSolid.claims[1].spans.nDown; // e.g. 120
  const tailN = pSolid.claims[2].spans.n; // e.g. 24
  const hlVal = pSolid.claims[0].spans.value; // corr, e.g. +0.55

  it('1 right-number-wrong-metric → E_NO_VARIANT_MATCH', () => {
    const g = render(pSolid);
    g.sentences[0].text = g.sentences[0].text.replace(hlVal, betaDown); // corr value → beta value
    expect(validateNarration(g, pSolid)).toMatchObject({ valid: false, code: 'E_NO_VARIANT_MATCH', claimIndex: 0 });
  });

  it('2 reversed chronology (wrong window) → E_NO_VARIANT_MATCH', () => {
    const g = render(pSolid);
    g.sentences[0].text = g.sentences[0].text.replace('over the past 3 months', 'over the past month');
    expect(validateNarration(g, pSolid).code).toBe('E_NO_VARIANT_MATCH');
  });

  it('3 negated disclosure → E_NO_VARIANT_MATCH', () => {
    const g = render(pProxy);
    g.sentences[0].text = g.sentences[0].text.replace('was effectively the market itself', 'was not the market itself');
    expect(validateNarration(g, pProxy)).toMatchObject({ valid: false, code: 'E_NO_VARIANT_MATCH', claimIndex: 0 });
  });

  it('4 disclosure-then-contradiction → E_NO_VARIANT_MATCH', () => {
    const g = render(pFragile);
    g.sentences[0].text += ' Actually the read was solid.';
    expect(validateNarration(g, pFragile).valid).toBe(false);
  });

  it('5 buried caveat (reordered) → E_POSITION', () => {
    const g = render(pFragile);
    const s = g.sentences;
    g.sentences = [s[1], s[2], s[0], s[3], s[4]]; // caveat pushed to index 2
    expect(validateNarration(g, pFragile)).toMatchObject({ valid: false, code: 'E_POSITION', claimIndex: 0 });
  });

  it('6 limited without its criterion → E_NO_VARIANT_MATCH', () => {
    const g = render(pLimited);
    g.sentences[0].text = 'This was a limited read across 250 sessions.'; // criterion dropped
    expect(validateNarration(g, pLimited)).toMatchObject({ valid: false, code: 'E_NO_VARIANT_MATCH', claimIndex: 0 });
  });

  it('7 n omitted → E_NO_VARIANT_MATCH', () => {
    const g = render(pSolid);
    g.sentences[1].text = g.sentences[1].text.replace(` on ${nDown} down days`, '');
    expect(validateNarration(g, pSolid)).toMatchObject({ valid: false, code: 'E_NO_VARIANT_MATCH', claimIndex: 1 });
  });

  it('8 borrowed n (another claim\'s n) → E_NO_VARIANT_MATCH', () => {
    expect(nDown).not.toBe(tailN);
    const g = render(pSolid);
    g.sentences[1].text = g.sentences[1].text.replace(nDown, tailN);
    expect(validateNarration(g, pSolid)).toMatchObject({ valid: false, code: 'E_NO_VARIANT_MATCH', claimIndex: 1 });
  });

  it('9 suppressed value recycled (adjusted stated in a proxy read) → E_NO_VARIANT_MATCH', () => {
    const g = render(pProxy);
    // graft a fabricated adjusted clause — hl_raw_adj is pruned for a proxy read
    g.sentences[1].text = 'The group moved with 10Y Yield over the past 3 months, a moderate link at +0.55, and it held moderate at +0.42 after adjusting for the market.';
    expect(validateNarration(g, pProxy)).toMatchObject({ valid: false, code: 'E_NO_VARIANT_MATCH', claimIndex: 1 });
  });

  it('10 present-tense universal → E_NO_VARIANT_MATCH', () => {
    const g = render(pSolid);
    g.sentences[0].text = g.sentences[0].text.replace('moved', 'moves');
    expect(validateNarration(g, pSolid).code).toBe('E_NO_VARIANT_MATCH');
  });

  it('11 causal claim appended → rejected', () => {
    const g = render(pSolid);
    g.sentences[0].text += ' because yields rose';
    expect(validateNarration(g, pSolid).valid).toBe(false);
  });

  it('12 imperative advice appended → rejected', () => {
    const g = render(pSolid);
    g.sentences[0].text += ' Consider the group.';
    expect(validateNarration(g, pSolid).valid).toBe(false);
  });

  it('13 digit-free comparison → E_NO_VARIANT_MATCH', () => {
    const g = render(pSolid);
    g.sentences[1].text = g.sentences[1].text.replace(`${betaDown} beta`, 'a strong beta');
    expect(validateNarration(g, pSolid).code).toBe('E_NO_VARIANT_MATCH');
  });

  it('14 quoted mandatory phrase → E_NO_VARIANT_MATCH', () => {
    const g = render(pFragile);
    g.sentences[0].text = `"${g.sentences[0].text}"`;
    expect(validateNarration(g, pFragile).code).toBe('E_NO_VARIANT_MATCH');
  });

  it('extra sentence → E_COUNT; malformed output → E_SHAPE', () => {
    const g = render(pSolid);
    g.sentences.push({ claimId: 'headline_link', variantId: 'hl_raw', text: 'extra.' });
    expect(validateNarration(g, pSolid).code).toBe('E_COUNT');
    expect(validateNarration({ parseError: true }, pSolid).code).toBe('E_SHAPE');
    expect(validateNarration({ sentences: 'nope' }, pSolid).code).toBe('E_SHAPE');
  });
});

describe('conformance — E_LEXICON defense-in-depth (banned token in a span)', () => {
  // A hypothetically-compromised span: reconstruct PASSES, but the lexicon scan
  // still rejects a banned token — the backstop the frame lint cannot cover.
  const lexPlan = {
    planBuilderVersion: '1',
    claims: [{
      claimId: 'closing_caveat', subjectId: 'x', metricId: 'x', fieldPath: 'x',
      polarity: 'assert', temporalScope: 'measured_sample',
      spans: { sampleSpan: 'because of drift' }, sampleSpan: 'because of drift',
      requiredPosition: null, allowedVariants: ['cc_a'], suppressedFamilies: [],
    }],
  };

  it('rejects a banned token smuggled through a span → E_LEXICON', () => {
    const out = { sentences: [{ claimId: 'closing_caveat', variantId: 'cc_a', text: 'All of this described the measured window because of drift.' }] };
    expect(validateNarration(out, lexPlan)).toMatchObject({ valid: false, code: 'E_LEXICON', detail: 'causal' });
  });

  it('still catches a zero-width-obfuscated banned token', () => {
    const out = { sentences: [{ claimId: 'closing_caveat', variantId: 'cc_a', text: 'All of this described the measured window be​cause of drift.' }] };
    expect(validateNarration(out, lexPlan).code).toBe('E_LEXICON');
  });
});
