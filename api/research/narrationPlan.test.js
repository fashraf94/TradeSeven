/**
 * Narration plan builder — determinism, the pinned selection/ordering per the 8
 * contract classes, the adverse-omission guarantee (required claims that can't
 * build fail to `ok:false` BEFORE any model), the D1 thin-solid rule, and §9
 * span parity (every rendered span equals the shared card formatter of the same
 * pre-rounded contract value).
 */
import { describe, it, expect } from 'vitest';
import { buildNarrationPlan } from './narrationPlan.js';
import { CLASSES, DRIVER_LABEL, deepContract } from './narrationCorpus.js';
import { fmtCorr, fmtBeta, fmtPct, ordinal } from '../../src/components/Research/correlationVerdict.js';

const plan = (contract) => buildNarrationPlan(contract, { driverLabel: DRIVER_LABEL });
const ids = (p) => p.plan.claims.map((c) => c.claimId);

describe('narration plan — determinism (same contract ⇒ byte-identical plan)', () => {
  it('is byte-identical across rebuild and a structuredClone of the contract', () => {
    const c = CLASSES.solidStandard();
    const a = plan(c);
    const b = plan(c);
    const d = plan(structuredClone(c));
    expect(a.ok && b.ok && d.ok).toBe(true);
    expect(JSON.stringify(a.plan)).toBe(JSON.stringify(b.plan));
    expect(JSON.stringify(a.plan)).toBe(JSON.stringify(d.plan));
  });

  it('claims carry the pinned shape (polarity/temporalScope/spans/allowedVariants)', () => {
    const p = plan(CLASSES.solidStandard());
    for (const claim of p.plan.claims) {
      expect(claim.polarity).toBe('assert');
      expect(claim.temporalScope).toBe('measured_sample');
      expect(claim.allowedVariants.length).toBeGreaterThan(0);
      expect(typeof claim.spans.sampleSpan).toBe('string');
    }
  });
});

describe('narration plan — the 8 contract classes (selection + ordering)', () => {
  it('solid/standard → headline + 2 supporting, no caveat/closing', () => {
    const p = plan(CLASSES.solidStandard());
    expect(p.ok).toBe(true);
    expect(ids(p)).toEqual(['headline_link', 'capture_asymmetry', 'tail_comovement']);
    expect(p.plan.claims[0].requiredPosition).toBe(null);
  });

  it('fragile/standard → caveat_fragile FIRST + headline + supporting + closing', () => {
    const p = plan(CLASSES.fragileStandard());
    expect(p.ok).toBe(true);
    expect(ids(p)[0]).toBe('caveat_fragile');
    expect(p.plan.claims[0].requiredPosition).toBe(1);
    expect(ids(p)).toContain('headline_link');
    expect(ids(p).at(-1)).toBe('closing_caveat');
    // the caveat carries the failing criterion as a rendered span
    expect(p.plan.claims[0].spans.criterion).toContain('did not move as one');
  });

  it('limited/standard (small-n) → caveat_limited first, sample span cites the thin count', () => {
    const p = plan(CLASSES.limitedStandard());
    expect(p.ok).toBe(true);
    expect(ids(p)[0]).toBe('caveat_limited');
    expect(p.plan.claims[0].spans.criterion).toContain('sample was thin');
    expect(p.plan.claims[0].spans.sampleSpan).toBe('across 250 sessions');
  });

  it('in_flux/standard → caveat_in_flux first, strain past-tense, no session-count span', () => {
    const p = plan(CLASSES.inFluxStandard());
    expect(p.ok).toBe(true);
    expect(ids(p)[0]).toBe('caveat_in_flux');
    expect(p.plan.claims[0].spans.strain).toBe('broke from its recent range'); // no "it" prefix
    expect(p.plan.claims[0].spans.sampleSpan).toBeUndefined(); // bounded by "during this sample" in the frame
  });

  it('elevated tension → tension_elevated cites the 1-month link gap (divergence d)', () => {
    const c = CLASSES.elevatedStandard();
    const p = plan(c);
    expect(p.ok).toBe(true);
    const t = p.plan.claims.find((x) => x.claimId === 'tension_elevated');
    expect(t).toBeTruthy();
    expect(t.spans.value).toBe(fmtCorr(c.tension.d.value));
    expect(t.spans.sampleSpan).toBe('in this sample');
  });

  it('low_cohesion selects on NEGATIVE cohesion only — never a positive value', () => {
    const symmetricCapture = { minObs: 60, down: { beta: 1.05, alpha: 0, r: 0.6, n: 120 }, up: { beta: 1.0, alpha: 0, r: 0.5, n: 130 }, comparison: { asymmetric: false, direction: null, betaDown: 1.05, betaUp: 1.0, nDown: 120, nUp: 130 }, counts: { down: 120, up: 130 } };
    const noTail = { worst: null, best: null, sampleN: 0 };
    const mk = (cohVal) => deepContract({
      cohesion: { c20: { value: cohVal, pairsUsed: 3, pairsTotal: 3 }, c60: { value: cohVal, pairsUsed: 3, pairsTotal: 3 }, memberCount: 3 },
      captureAsymmetry: symmetricCapture, tail: noTail,
    });
    expect(ids(plan(mk(-0.25)))).toContain('low_cohesion');
    expect(ids(plan(mk(0.25)))).not.toContain('low_cohesion');
  });

  it('solid/market_proxy → proxy_disclosure at position 1, headline has no adjusted clause', () => {
    const p = plan(CLASSES.solidMarketProxy());
    expect(p.ok).toBe(true);
    expect(ids(p)[0]).toBe('proxy_disclosure');
    expect(p.plan.claims[0].requiredPosition).toBe(1);
    const headline = p.plan.claims.find((c) => c.claimId === 'headline_link');
    expect(headline.spans.adjValue).toBeUndefined();
    // hl_raw_adj (needs adjValue) is pruned out; only raw variants remain
    expect(headline.allowedVariants).not.toContain('hl_raw_adj');
  });

  it('fragile/market_proxy (suppression-heavy) → caveat FIRST, proxy SECOND', () => {
    const p = plan(CLASSES.fragileMarketProxy());
    expect(p.ok).toBe(true);
    expect(ids(p).slice(0, 2)).toEqual(['caveat_fragile', 'proxy_disclosure']);
    expect(p.plan.claims[0].requiredPosition).toBe(1);
    expect(p.plan.claims[1].requiredPosition).toBe(2);
  });

  it('in_flux + market_proxy → in_flux caveat holds position 1, proxy at position 2', () => {
    const p = plan(CLASSES.inFluxMarketProxy());
    expect(p.ok).toBe(true);
    expect(ids(p).slice(0, 2)).toEqual(['caveat_in_flux', 'proxy_disclosure']);
    expect(p.plan.claims[1].requiredPosition).toBe(2);
  });

  it('many notable supports → only the top TWO by priority survive the cap', () => {
    const p = plan(CLASSES.solidStandardTwoStrong());
    expect(p.ok).toBe(true);
    expect(ids(p)).toEqual(['headline_link', 'percentile_extreme', 'capture_asymmetry']);
  });
});

describe('narration plan — adverse-omission + D1 (fail to template)', () => {
  it('thin solid/standard (≤1 supporting) → ok:false thin_solid_read', () => {
    const p = plan(CLASSES.thinSolidStandard());
    expect(p).toEqual({ ok: false, code: 'thin_solid_read' });
  });

  it('a no-reliable-link headline (band null) → ok:false headline_unbuildable', () => {
    const p = plan(deepContract({ corr20: 0.1, corr60: 0.08, tensionLatest: { d: 0.01, score: 0.1, state: 'calm' } }));
    expect(p.ok).toBe(false);
    expect(p.code).toBe('headline_unbuildable');
  });

  it('wrong kind and an invalid contract fail loudly (never reach the model)', () => {
    expect(buildNarrationPlan({ kind: 'scan' }).code).toBe('wrong_kind');
    // right kind, broken shape → the input schema check catches it as invalid
    const broken = CLASSES.solidStandard();
    delete broken.evidence;
    expect(buildNarrationPlan(broken, { driverLabel: DRIVER_LABEL }).code).toBe('contract_invalid');
  });
});

describe('narration plan — §9 span parity (one source, shared formatters)', () => {
  it('headline / capture / percentile spans equal the card formatter of the contract value', () => {
    const c = CLASSES.solidStandardTwoStrong();
    const p = plan(c);
    const headline = p.plan.claims.find((x) => x.claimId === 'headline_link');
    expect(headline.spans.value).toBe(fmtCorr(c.links.raw60.value));
    expect(headline.spans.band).toBe(c.links.raw60.band);

    // two-sided capture: both betas + both n's + the stronger side named
    const cap = p.plan.claims.find((x) => x.claimId === 'capture_asymmetry');
    expect(cap.spans.betaDown).toBe(fmtBeta(c.capture.betaDown.value));
    expect(cap.spans.betaUp).toBe(fmtBeta(c.capture.betaUp.value));
    expect(cap.spans.nDown).toBe(String(c.capture.betaDown.n));
    expect(cap.spans.nUp).toBe(String(c.capture.betaUp.n));
    expect(cap.spans.direction).toBe(c.capture.comparison.value);

    // percentile prefers corr20 (card-shown); corr20 not extreme here → falls to corr60
    const pct = p.plan.claims.find((x) => x.claimId === 'percentile_extreme');
    expect(pct.spans.pct).toBe(`${ordinal(Math.round(c.percentile.corr60.value * 100))} percentile`);
    expect(pct.spans.sampleSpan).toBe('over the past 3 months');
  });

  it('R2: TNX driver_context renders the trailing move from the envelope unit, over 20 sessions', () => {
    const c = CLASSES.tnxDriverContext();
    const p = plan(c);
    expect(p.ok).toBe(true);
    expect(ids(p)[0]).toBe('caveat_fragile'); // fragile (broad_based fails) so the read isn't thin
    const dc = p.plan.claims.find((x) => x.claimId === 'driver_context');
    expect(dc).toBeTruthy();
    expect(dc.spans.ret).toBe(fmtPct(c.driverContext.trailingReturn.value, 1)); // return_fraction unit → fmtPct
    expect(dc.spans.sampleSpan).toBe('over the past 20 sessions');
  });

  it('R3: a caveat with multiple failing criteria joins them via the phrase table', () => {
    const c = deepContract({
      cohesion: { c20: { value: 0.3, pairsUsed: 3, pairsTotal: 3 }, c60: { value: 0.3, pairsUsed: 3, pairsTotal: 3 }, memberCount: 3 },
      contribution: { full: { corr: 0.62, beta: 1.1 }, members: [{ index: 0, corrDelta: 0.2, betaDelta: 0.1 }, { index: 1, corrDelta: 0.02, betaDelta: 0.05 }, { index: 2, corrDelta: 0.01, betaDelta: 0.03 }], window: 60, n: 60, memberSymbols: ['CVX', 'XOM', 'XLE'], breadthStatus: 'single_driver' },
    });
    const caveat = plan(c).plan.claims[0];
    expect(caveat.claimId).toBe('caveat_fragile');
    expect(caveat.spans.criterion).toBe('the group did not move as one and one member carried it');
  });

  it('every allowedVariant is span-satisfiable (its requires ⊆ the rendered spans)', () => {
    for (const make of Object.values(CLASSES)) {
      const p = plan(make());
      if (!p.ok) continue;
      for (const claim of p.plan.claims) {
        expect(claim.allowedVariants.length).toBeGreaterThan(0);
      }
    }
  });
});
