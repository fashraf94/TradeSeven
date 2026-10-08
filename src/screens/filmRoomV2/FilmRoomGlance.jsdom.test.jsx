// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomGlance.jsdom.test.jsx
//
// Film Room A2 item 5 — GLANCE (V1.2 §7, BA-4; Amendment E F5, BA-41,
// BA-44). Mounted from the A1 passes' own tapes: the recorded score with its
// time, the day change with its basis, option B's score path over the check
// strip, option C's runs (state, span, count), a tapped check's record, and
// the final result APART from the day — only for a completed battle, with the
// platform's own words beside it.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import FilmRoomGlance from './FilmRoomGlance';
import { mounter, sep23Tape, emptyTape, clone, sweepNumbers, sweepWords, sweepSigns } from './__fixtures__/filmRoomHarness';

const m = mounter();
beforeEach(() => m.setup());
afterEach(() => m.teardown());

function Harness({ tape }) {
  const [selected, setSelected] = React.useState(null);
  return <FilmRoomGlance tape={tape} selected={selected} onSelect={setSelected} />;
}

describe('BA-4 — the recorded score, its time, the day change with its basis', () => {
  it('"Recorded score at 3:45 PM ET" — the last admitted check\'s total, recorded; the day change, derived, from the battle start', () => {
    m.render(<Harness tape={sep23Tape} />);
    const score = m.q('[data-region="recorded-score"]');
    expect(score.textContent).toContain('Recorded score at 3:45 PM ET');
    expect(score.querySelector('[data-num="score.lastCheck.total"]').getAttribute('data-num-class')).toBe('recorded');
    expect(score.textContent).toContain('Day change · from the battle start');
    expect(score.querySelector('[data-num="score.dayChange.value"]').getAttribute('data-num-class')).toBe('derived');
    expect(score.textContent).toContain('First check 10:15 AM');
  });

  it('addendum R4(c): the basis names its stored reference — "from the battle start (0)" — with that value\'s own marker', () => {
    m.render(<Harness tape={sep23Tape} />);
    const ref = m.q('[data-region="recorded-score"] [data-day-change-reference] [data-num]');
    expect(ref.getAttribute('data-num')).toBe('score.dayChange.reference');
    expect(ref.getAttribute('data-num-class')).toBe(sep23Tape.numberClasses['score.dayChange.reference']);
    expect(ref.querySelector('[data-kind-mark]').getAttribute('data-kind-mark')).toBe('recorded');
    expect(ref.querySelector('[data-num-text]').textContent).toBe('0');
    expect(m.q('[data-region="recorded-score"]').textContent).toMatch(/Day change · from the battle start \(0R?\)/);
    expect(ref.getAttribute('data-sign-color')).toBe('no');
  });

  it('addendum R4(c): a prior-day basis shows ITS reference, marked by the tape\'s own declaration for the reference path', () => {
    const t = clone(sep23Tape);
    t.score.dayChange = { value: -34, basis: 'prior_day_tape', reference: -13 };
    t.numberClasses['score.dayChange.reference'] = 'derived';   // a tape declaring it otherwise is labelled by its own declaration
    m.render(<Harness tape={t} />);
    const ref = m.q('[data-day-change-reference] [data-num]');
    expect(ref.querySelector('[data-num-text]').textContent).toBe('−13');
    expect(ref.querySelector('[data-kind-mark]').getAttribute('data-kind-mark')).toBe('derived');
    expect(m.q('[data-region="recorded-score"]').textContent).toContain("from the prior day's last recorded check (−13");
    expect(sweepNumbers(m.container, { tape: t })).toEqual([]);
  });

  it('a day change with no basis reads "unavailable" — never a silent substitute', () => {
    const t = clone(sep23Tape);
    t.score.dayChange = { value: null, basis: 'unavailable', reference: null };
    m.render(<Harness tape={t} />);
    const score = m.q('[data-region="recorded-score"]');
    expect(score.querySelector('[data-num="score.dayChange.value"]')).toBeNull();
    expect(score.textContent).toContain('Day changeunavailable');
    expect(score.textContent.split('unavailable').length - 1).toBe(1);   // said once, not twice (review A2L1-16)
    expect(score.querySelector('[data-day-change-reference]')).toBeNull();
  });

  it('the empty day: no recorded score, no checks, honest dashes', () => {
    m.render(<Harness tape={emptyTape} />);
    const score = m.q('[data-region="recorded-score"]');
    expect(score.textContent).toContain('Recorded score');
    expect(score.textContent).not.toContain('Recorded score at');
    expect(score.querySelector('[data-num]')).toBeNull();
    expect(m.container.textContent).toContain('no checks recorded');
  });
});

describe('F5 — the score path with the check runs', () => {
  it('a point per scored check and a pip per check row, in the tape\'s order; carets for the three swaps, by who made them', () => {
    m.render(<Harness tape={sep23Tape} />);
    expect(m.qa('[data-score-point]')).toHaveLength(sep23Tape.checks.filter((c) => c.scores).length);
    expect(m.qa('[data-check-pip]')).toHaveLength(sep23Tape.checks.length);
    expect(m.qa('[data-swap-caret]').map((c) => c.getAttribute('data-swap-caret'))).toEqual(['platform', 'agent', 'platform']);
  });

  it('the runs: state, time span and count — the count of a run marked derived by the screen\'s one declaration', () => {
    m.render(<Harness tape={sep23Tape} />);
    const runs = m.qa('[data-run]');
    expect(runs.map((r) => r.getAttribute('data-run'))).toEqual(['gameplan_created', 'gameplan_pending', 'completed', 'no_trigger']);
    expect(runs[1].textContent).toContain('10:30 AM–11:45 AM · plan pending · awaiting approval · 6');
    expect(runs[2].textContent).toContain('12:00 PM–2:45 PM · completed · 12');
    expect(runs[2].textContent).toMatch(/9\s?D?\s*HOLD/);
    expect(runs[2].textContent).toContain('held by default');
    expect(runs[3].textContent).toContain('no trigger · no check woke · 4');
    for (const c of m.qa('[data-num-aggregate]')) expect(c.getAttribute('data-num-class')).toBe('derived');
  });

  it('BA-44: tapping a pip or a score point opens that check\'s record; tapping it again closes it', () => {
    m.render(<Harness tape={sep23Tape} />);
    m.click(m.q('[data-check-pip="15"]'));
    expect(m.q('[data-check-detail="15"]')).toBeTruthy();
    m.click(m.q('[data-check-pip="15"]'));
    expect(m.q('[data-check-detail]')).toBeNull();
    m.click(m.q('[data-score-point="10"]'));
    expect(m.q('[data-check-detail="10"]')).toBeTruthy();
  });

  it('the checks coverage line opens the section, and the "protections" note appears exactly once — with a check open too', () => {
    m.render(<Harness tape={sep23Tape} />);
    m.click(m.q('[data-check-pip="10"]'));
    expect(m.q('#glance-checks [data-coverage]').getAttribute('data-coverage')).toBe('partial');
    expect(m.q('#glance-checks').textContent).toContain(sep23Tape.coverage.checks.note);
    const n = m.container.textContent.split('This does not show which protections were armed or checked.').length - 1;
    expect(n).toBe(1);
  });
});

describe('addendum R4(a) — "Checks · n of m", a marked count of the record\'s own rows', () => {
  const agg = (name) => m.q(`#glance-checks [data-section-count] [data-num-aggregate="${name}"]`);
  it('Sep-23: "Checks · 23 of 23" — the rows with a record of the minted range passes.close records, each count marked derived', () => {
    m.render(<Harness tape={sep23Tape} />);
    expect(m.q('#glance-checks [data-section-count]').textContent).toMatch(/^23\s?D?\s*of\s*23\s?D?$/);
    expect(Number(agg('count(checks[] with a record)').getAttribute('data-agg-value'))).toBe(sep23Tape.checks.length);
    const [lo, hi] = sep23Tape.passes.close.tickSeqRange;
    expect(Number(agg('count(tickSeqs in the minted range)').getAttribute('data-agg-value'))).toBe(hi - lo + 1);
    for (const name of ['count(checks[] with a record)', 'count(tickSeqs in the minted range)']) {
      expect(agg(name).getAttribute('data-num-class')).toBe('derived');
      expect(agg(name).querySelector('[data-kind-mark]').getAttribute('data-kind-mark')).toBe('derived');
    }
  });

  it('a missing record and a deferral are not counted; the minted range is its size', () => {
    const t = clone(sep23Tape);
    t.checks[20].state = 'no_record';
    t.checks[21].state = 'deferred';
    m.render(<Harness tape={t} />);
    expect(agg('count(checks[] with a record)').getAttribute('data-agg-value')).toBe('21');
    expect(agg('count(tickSeqs in the minted range)').getAttribute('data-agg-value')).toBe('23');
    expect(m.q('#glance-checks [data-section-count]').textContent).toMatch(/^21\s?D?\s*of\s*23\s?D?$/);   // n first (review A2P2-4)
    expect(sweepNumbers(m.container, { tape: t })).toEqual([]);
  });

  it('review A2P1-1: a check known only by its evaluation entry cannot be placed in the range — "n recorded", never "n of n"', () => {
    const t = clone(sep23Tape);
    t.checks[0] = { ...t.checks[0], tickSeq: null, rowSource: 'entry' };
    t.checks[10] = { ...t.checks[10], state: 'no_record', rowSource: 'gap' };
    Object.assign(t.passes.close, { tickSeqRange: [2, 23], gaps: [11], unattributedGaps: [1] });
    m.render(<Harness tape={t} />);
    expect(m.q('#glance-checks [data-check-count]').getAttribute('data-check-count')).toBe('recorded');
    expect(m.q('#glance-checks [data-section-count]').textContent).toMatch(/^22\s?D?\s*recorded$/);
  });

  it('the empty day: no minted range recorded → "0 recorded", never a made-up "of"', () => {
    m.render(<Harness tape={emptyTape} />);
    expect(m.q('#glance-checks [data-check-count]').getAttribute('data-check-count')).toBe('recorded');
    expect(m.q('#glance-checks [data-section-count]').textContent).toMatch(/^0\s?D?\s*recorded$/);
    expect(agg('count(tickSeqs in the minted range)')).toBeNull();
  });
});

describe('the six check-state swatches as a legend under the strip (design of record)', () => {
  // the design of record's six, in its order — with the screen's adopted words for a default hold (addendum R2)
  const SIX = [
    ['gameplan_created', 'plan', 'plan created'],
    ['gameplan_pending', 'planPending', 'plan pending · awaiting approval'],
    ['hold', 'hold', 'completed · HOLD'],
    ['swap', 'swap', 'completed · SWAP'],
    ['default_hold', 'failed', 'no usable model result · the system held by default'],
    ['no_trigger', 'quiet', 'no trigger · no check woke'],
  ];
  const legend = () => m.qa('[data-region="check-strip"] [data-region="strip-legend"] [data-legend-state]')
    .map((e) => [e.getAttribute('data-legend-state'), e.querySelector('[data-pip]').getAttribute('data-pip'), e.textContent]);

  it('under the strip, after its time ends: the six swatches in order, each with its state\'s words and its pip\'s look', () => {
    m.render(<Harness tape={sep23Tape} />);
    expect(legend()).toEqual(SIX);
    const strip = m.q('[data-region="check-strip"]');
    const pips = strip.querySelector('[data-check-pip]').parentElement;
    expect(pips.compareDocumentPosition(strip.querySelector('[data-region="strip-legend"]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('every pip on the strip has its swatch: the same look and the same words as its own state', () => {
    m.render(<Harness tape={sep23Tape} />);
    const byLabel = new Map(legend().map(([, tone, label]) => [label, tone]));
    for (const b of m.qa('[data-check-pip]')) {
      const label = b.getAttribute('aria-label').split(' · ').slice(1).join(' · ');
      expect(byLabel.get(label), label).toBe(b.querySelector('[data-pip]').getAttribute('data-pip'));
    }
  });

  it('a state outside the six that the day shows adds its own swatch, by its own words; the empty day keeps the six', () => {
    const t = clone(sep23Tape);
    t.checks[20].state = 'budget_skipped';
    t.checks[21].state = 'no_record';
    m.render(<Harness tape={t} />);
    expect(legend().slice(6)).toEqual([['budget_skipped', 'skipped', 'check skipped · budget'], ['no_record', 'gap', 'no record for this check']]);
    m.render(<Harness tape={emptyTape} />);
    expect(legend()).toEqual(SIX);
  });
});

describe('the final result, apart from the day (BA-4, BA-39)', () => {
  it('a completed battle: the result word, both recorded final scores, the platform\'s completion message labelled as the platform\'s', () => {
    m.render(<Harness tape={sep23Tape} />);
    const r = m.q('[data-region="final-result"]');
    expect(r.textContent).toContain("the battle's result, apart from this day's score");
    expect(r.querySelector('[data-result]').getAttribute('data-result')).toBe('win');
    expect(r.textContent).toContain('derived from the recorded final scores');
    expect(r.querySelector('[data-num="battle.final.total"]').getAttribute('data-num-class')).toBe('recorded');
    expect(r.querySelector('[data-num="battle.final.opponent"]').getAttribute('data-num-class')).toBe('recorded');
    expect(r.textContent).toContain('Platform recorded at completion');
    expect(r.textContent).toContain('“Battle complete. Agent: -47.0 pts vs CPU: -93.0 pts. Result: Win.”');
  });

  it('the empty day: result unavailable, the missing score named, the platform\'s "Result: Draw." beside it', () => {
    m.render(<Harness tape={emptyTape} />);
    const r = m.q('[data-region="final-result"]');
    expect(r.querySelector('[data-result]').getAttribute('data-result')).toBe('unavailable');
    expect(r.textContent).toContain('opponent score never recorded');
    expect(r.textContent).toContain('“Result: Draw.”');
    expect(r.querySelector('[data-num]')).toBeNull();
  });

  it('an active battle: no result card at all', () => {
    const t = clone(sep23Tape);
    t.battle = { status: 'active', completedAt: null, final: null, result: { value: null, basis: 'not_completed' }, completionMessage: null };
    m.render(<Harness tape={t} />);
    expect(m.q('[data-region="final-result"]')).toBeNull();
  });
});

describe('the sweeps (BA-42, BA-41)', () => {
  it.each([['Sep-23', sep23Tape], ['empty', emptyTape]])('%s: every number marked by its own class; no stray digit; no sign colour off a recorded score; no forbidden word', (_l, tape) => {
    m.render(<Harness tape={tape} />);
    if (tape.checks.length) m.click(m.q('[data-check-pip="12"]'));
    expect(sweepNumbers(m.container, { tape })).toEqual([]);
    expect(sweepSigns(m.container)).toEqual([]);
    expect(sweepWords(m.container)).toEqual([]);
  });

  it.each([['Sep-23', sep23Tape], ['empty', emptyTape]])('%s at desktop width (review A2P2-2): the same sweeps', (_l, tape) => {
    m.render(<FilmRoomGlance tape={tape} desktop selected={tape.checks.length ? 12 : null} onSelect={() => {}} />);
    expect(m.q('[data-depth="glance"]').style.display).toBe('grid');
    expect(sweepNumbers(m.container, { tape })).toEqual([]);
    expect(sweepSigns(m.container)).toEqual([]);
    expect(sweepWords(m.container)).toEqual([]);
  });

  it('recorded scores carry sign colour; the derived day change never does', () => {
    m.render(<Harness tape={sep23Tape} />);
    expect(m.q('[data-num="score.lastCheck.total"]').getAttribute('style')).toContain('var(--ft-danger)');
    expect(m.q('[data-num="score.firstCheck.total"]').getAttribute('style')).toContain('var(--ft-success)');
    expect(m.q('[data-num="score.dayChange.value"]').getAttribute('style')).not.toMatch(/var\(--ft-(success|danger)\)/);
  });
});

describe('review A2L4-10 — the Glance checks section opens with the tape\'s coverage line in all three states', () => {
  it.each(['complete', 'partial', 'unavailable'])('%s', (status) => {
    const t = clone(sep23Tape);
    t.coverage.checks = { ...t.coverage.checks, status, note: `${status} checks note` };
    m.render(<Harness tape={t} />);
    const line = m.q('#glance-checks [data-coverage]');
    expect(line.getAttribute('data-coverage')).toBe(status);
    expect(line.textContent).toContain(`${status} checks note`);
  });

  it('the empty day: the checks section still opens with its coverage line, unavailable', () => {
    m.render(<Harness tape={emptyTape} />);
    expect(m.q('#glance-checks [data-coverage]').getAttribute('data-coverage')).toBe('unavailable');
  });
});
