// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomStudy.jsdom.test.jsx
//
// Film Room A2 item 7 — STUDY (V1.2 §7; Amendment E BA-41 F1–F4, BA-45,
// BA-46, BA-47). Mounted from the A1 passes' own tapes.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import FilmRoomStudy from './FilmRoomStudy';
import { REPLAY_SENTENCE, LOCKED_BASIS_NOTE } from './filmRoomCopy';
import { INTRADAY_DIAGNOSTIC_HEADER } from '../../data/intradayDiagnosticCopy';
import { mounter, sep23Tape, emptyTape, clone, sweepNumbers, sweepWords, sweepSigns, quoteDefects, parseNumeral } from './__fixtures__/filmRoomHarness';
import { deriveHoldings, etClock } from './filmRoomModel';

// Whole-section mounts with every collapsible opened: CI headroom (the A1 suites' precedent).
vi.setConfig({ testTimeout: 20_000 });

const m = mounter();
beforeEach(() => m.setup());
afterEach(() => m.teardown());

const deeps = [];
function Harness({ tape }) {
  const [selected, setSelected] = React.useState(null);
  return <FilmRoomStudy tape={tape} selected={selected} onSelect={setSelected} onDeep={(s) => deeps.push(s)} jump={() => {}} />;
}
const card = (i) => m.q(`[data-swap-card="${i}"]`);
const before = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
/** A plan chip by its symbol (the chip also carries its count). */
const planChip = (s) => m.qa('[data-region="plan-chips"] button').find((b) => b.querySelector('[data-record-text]')?.textContent === s);
/** A section's count pill, and one named aggregate in it. */
const count = (id) => m.q(`#${id} [data-section-count]`);
const agg = (id, name) => m.q(`#${id} [data-section-count] [data-num-aggregate="${name}"]`);
const aggValue = (el) => Number(el.getAttribute('data-agg-value'));

describe('BA-45 — holdings at the day\'s start and end', () => {
  it('derived from the first and last risk records and the swaps, labelled derived; each changed slot shows who entered it and when', () => {
    m.render(<Harness tape={sep23Tape} />);
    const sec = m.q('#holdings');
    expect(sec.textContent).toContain('derived from recorded values');
    expect(sec.querySelector('[data-coverage]').getAttribute('data-coverage')).toBe('partial');   // the checks section is partial
    const text = m.q('[data-region="holdings"]').textContent;
    for (const s of ['MSFT', 'DE', 'ETN', 'CRWD', 'PLTR', 'PANW', 'INTC', 'AMD', 'META', 'BTC']) expect(text).toContain(s);
    expect(text).toContain('12:45');
    expect(text).toContain('rule');
    expect(text).toContain('agent');
  });

  it('review A2L4-3: each changed slot shows ITS maker and ITS time — bound slot by slot, not satisfied by the legend', () => {
    m.render(<Harness tape={sep23Tape} />);
    const h = deriveHoldings(sep23Tape);
    const words = { agent: 'agent', platform: 'rule', gameplan: 'meeting', unrecorded: 'not recorded' };
    h.slots.forEach((s, k) => {
      const chipEl = m.q(`[data-region="holdings"] [data-slot="${k}"]`);
      const label = m.q(`[data-slot-label="${k}"]`);
      expect(chipEl.textContent, `slot ${k}`).toBe(s.end);
      if (!s.change) { expect(chipEl.getAttribute('data-holding-tone')).toBe('held'); expect(label.textContent).toBe(''); return; }
      expect(chipEl.getAttribute('data-holding-tone'), `slot ${k}`).toBe(s.change.by);
      expect(label.textContent, `slot ${k}`).toBe(`${etClock(s.change.at).replace(/ [AP]M$/, '')}${words[s.change.by]}`);
    });
    expect(h.changes.map((c) => [c.symbolIn, c.by])).toEqual([['CRWD', 'platform'], ['PLTR', 'agent'], ['PANW', 'platform']]);
  });

  it('a record that does not reconcile: the grid is omitted behind its coverage line', () => {
    const t = clone(sep23Tape);
    delete t.checks[22].risk.PANW;
    m.render(<Harness tape={t} />);
    expect(m.q('[data-region="holdings"]')).toBeNull();
    expect(m.q('#holdings [data-coverage]').getAttribute('data-coverage')).toBe('unavailable');
    expect(m.q('#holdings').textContent).toContain('do not reconcile');
    expect(sweepWords(m.container, { tape: t })).toEqual([]);   // R8: the note spells no number as a word
  });
});

describe('the swap cards (BA-6, BA-11, BA-38, BA-47; F1)', () => {
  it('one card per swap, addressable as #swap-n', () => {
    m.render(<Harness tape={sep23Tape} />);
    expect(m.qa('article[data-swap-card]').map((a) => a.id)).toEqual(['swap-1', 'swap-2', 'swap-3']);
    expect(m.q('#swap-2 a[href="#swap-2"]')).toBeTruthy();
  });

  it('addendum R4(a): "Swap 1 · 12:45 PM" — the ordinal is a marked number, derived, and #swap-n carries the same n', () => {
    m.render(<Harness tape={sep23Tape} />);
    sep23Tape.actions.forEach((a, i) => {
      const title = card(i).querySelector('[data-swap-title]');
      const n = title.querySelector('[data-num-aggregate="ordinal(actions[] in time order)"]');
      expect(Number(n.getAttribute('data-agg-value'))).toBe(i + 1);
      expect(n.getAttribute('data-num-class')).toBe('derived');
      expect(n.querySelector('[data-kind-mark]').getAttribute('data-kind-mark')).toBe('derived');
      expect(title.textContent).toMatch(new RegExp(`^Swap ${i + 1}\\s?D?\\s*· ${etClock(a.at)}$`));
      expect(card(i).id).toBe(`swap-${i + 1}`);
    });
    expect(card(0).querySelector('[data-swap-title]').textContent).toMatch(/^Swap 1\s?D?\s*· 12:45 PM$/);
  });

  it('review A2P2-1: the slot index is the tape\'s own number, by its path, recorded — never a computed count', () => {
    m.render(<Harness tape={sep23Tape} />);
    sep23Tape.actions.forEach((a, i) => {
      const el = card(i).querySelector(`[data-num="actions[${i}].slotIndex"]`);
      expect(el, `${i}`).toBeTruthy();
      expect(el.getAttribute('data-num-class')).toBe('recorded');
    });
    expect(m.qa('[data-swap-card] [data-num-aggregate]').map((e) => e.getAttribute('data-num-aggregate'))).toEqual(sep23Tape.actions.map(() => 'ordinal(actions[] in time order)'));
  });

  it('addendum R4(a): the ordinal is the TIME order, not the tape\'s row order — and the anchor follows it', () => {
    const t = clone(sep23Tape);
    t.actions.reverse();
    m.render(<Harness tape={t} />);
    const ordinalOf = (i) => Number(card(i).querySelector('[data-swap-title] [data-num-aggregate]').getAttribute('data-agg-value'));
    expect([0, 1, 2].map(ordinalOf)).toEqual([3, 2, 1]);
    expect([0, 1, 2].map((i) => card(i).id)).toEqual(['swap-3', 'swap-2', 'swap-1']);
  });

  it('the exit maker\'s label precedes the result on every card', () => {
    m.render(<Harness tape={sep23Tape} />);
    const want = ['Exit by platform rule · stagnation', 'Exit by the agent · its own decision', 'Exit by platform rule · stagnation'];
    sep23Tape.actions.forEach((_, i) => {
      const maker = card(i).querySelector('[data-exit-maker]');
      expect(maker.textContent).toBe(want[i]);
      for (const row of card(i).querySelectorAll('[data-result-row], [data-split]')) expect(before(maker, row), `card ${i}`).toBe(true);
      // every result NUMBER, wherever it sits, comes after the maker (review A2L4-9)
      for (const n of card(i).querySelectorAll(`[data-num="actions[${i}].lockedPoints"], [data-num*="replay"]`)) expect(before(maker, n), `card ${i} ${n.getAttribute('data-num')}`).toBe(true);
      expect(card(i).querySelector('[data-split="sale"]').textContent.startsWith('Split by cause · the sale')).toBe(true);
      expect(card(i).querySelector('[data-split="fill"]').textContent.startsWith('The fill')).toBe(true);
    });
  });

  it('F1: the split always shows the SOLD leg\'s sale — recorded exit, the bar at the swap, rescore, inputs part, price part — and the fill as its own rows, for every swap', () => {
    m.render(<Harness tape={sep23Tape} />);
    sep23Tape.actions.forEach((a, i) => {
      const sale = card(i).querySelector('[data-split="sale"]');
      const fill = card(i).querySelector('[data-split="fill"]');
      expect(sale.getAttribute('data-split-symbol')).toBe(a.symbolOut);
      expect(fill.getAttribute('data-split-symbol')).toBe(a.symbolIn);
      const base = `actions[${i}].replay.reconciliation`;
      const cls = { recordedPx: 'recorded', rebuiltPx: 'market', pxDelta: 'rebuilt', rescoredAtRecordedPx: 'derived', inputsDelta: 'derived', priceDelta: 'rebuilt' };
      for (const [k, c] of Object.entries(cls)) {
        const el = sale.querySelector(`[data-num="${base}.soldAtSale.${k}"]`);
        expect(el, `${i} sale ${k}`).toBeTruthy();
        expect(el.getAttribute('data-num-class')).toBe(c);
      }
      for (const [k, c] of Object.entries({ recordedPx: 'recorded', rebuiltPx: 'market', pxDelta: 'rebuilt' })) {
        const el = fill.querySelector(`[data-num="${base}.boughtAtSale.${k}"]`);
        expect(el, `${i} fill ${k}`).toBeTruthy();
        expect(el.getAttribute('data-num-class')).toBe(c);
      }
      expect(sale.querySelector('[data-num*="boughtAtSale"]')).toBeNull();
      expect(fill.querySelector('[data-num*="soldAtSale"]')).toBeNull();
      expect(sale.textContent).toContain(`Recorded exit · ${a.symbolOut}`);
      expect(fill.textContent).toContain(`Recorded fill · ${a.symbolIn}`);
    });
  });

  it('a swap whose fill and sale differ in sign shows each with its own sign, in its own group', () => {
    m.render(<Harness tape={sep23Tape} />);
    const i = sep23Tape.actions.findIndex((a) => Math.sign(a.replay.reconciliation.soldAtSale.pxDelta) !== Math.sign(a.replay.reconciliation.boughtAtSale.pxDelta));
    expect(i).toBeGreaterThanOrEqual(0);
    const r = sep23Tape.actions[i].replay.reconciliation;
    const sale = parseNumeral(card(i).querySelector(`[data-split="sale"] [data-num$="soldAtSale.pxDelta"] [data-num-text]`).textContent);
    const fill = parseNumeral(card(i).querySelector(`[data-split="fill"] [data-num$="boughtAtSale.pxDelta"] [data-num-text]`).textContent);
    expect(sale).toBe(r.soldAtSale.pxDelta);
    expect(fill).toBe(r.boughtAtSale.pxDelta);
    expect(Math.sign(sale)).not.toBe(Math.sign(fill));
  });

  it('BA-11: both rebuilt lines are dashed and labelled rebuilt; the gap and the agreement at the sale are shown, rebuilt; banked points recorded', () => {
    m.render(<Harness tape={sep23Tape} />);
    sep23Tape.actions.forEach((a, i) => {
      for (const line of ['hold', 'swap']) {
        const p = card(i).querySelector(`[data-line="${line}"]`);
        expect(p.hasAttribute('data-rebuilt')).toBe(true);
        expect(p.style.strokeDasharray, `${i} ${line}`).toMatch(/^\d/);   // a dash pattern, never 'none' (review A2L4-9)
      }
      expect(card(i).textContent).toContain('dashed · rebuilt from 1-minute bars');
      expect(card(i).querySelector(`[data-num="actions[${i}].replay.gapPoints"]`).getAttribute('data-num-class')).toBe('rebuilt');
      expect(card(i).querySelector(`[data-num="actions[${i}].replay.reconciliation.closedLegDelta"]`).getAttribute('data-num-class')).toBe('rebuilt');
      expect(card(i).querySelector(`[data-num="actions[${i}].lockedPoints"]`).getAttribute('data-num-class')).toBe('recorded');
      const holdEnd = card(i).querySelector(`[data-path-label="hold"] [data-num]`).getAttribute('data-num');
      expect(holdEnd).toBe(`actions[${i}].replay.holdPath[${a.replay.holdPath.length - 1}].points`);
      const swapEnd = card(i).querySelector(`[data-path-label="swap"] [data-num]`).getAttribute('data-num');
      expect(swapEnd).toBe(`actions[${i}].replay.swapPath[${a.replay.swapPath.length - 1}].points`);   // review A2L4-11
    });
  });

  it('the one-step-hypothetical sentence and the basis note appear on every swap card — the replay\'s own stored words', () => {
    expect(LOCKED_BASIS_NOTE).toBe(sep23Tape.actions[0].replay.lockedBasisNote);
    m.render(<Harness tape={sep23Tape} />);
    sep23Tape.actions.forEach((a, i) => {
      // the replay's stored label, verbatim, as the tape's own words (R1) — never the screen's sentence in its place
      const sentence = card(i).querySelector('[data-replay-sentence]');
      expect(sentence.textContent).toBe(a.replay.label);
      expect(sentence.querySelector('[data-record-text]').textContent).toBe(a.replay.label);
      expect(card(i).querySelector('[data-basis-note]').textContent).toBe(LOCKED_BASIS_NOTE);
    });
  });

  it('R8: a replay that stores no label shows the screen\'s own sentence — which spells no number as a word', () => {
    const t = clone(sep23Tape);
    delete t.actions[0].replay.label;
    m.render(<Harness tape={t} />);
    const sentence = card(0).querySelector('[data-replay-sentence]');
    expect(sentence.textContent).toBe(REPLAY_SENTENCE);
    expect(sentence.querySelector('[data-record-text]')).toBeNull();   // the screen's words, never marked as the record's
    expect(REPLAY_SENTENCE).not.toMatch(/\b(one|single)\b/i);
    expect(sweepWords(m.container, { tape: t })).toEqual([]);
  });

  it('a swap with no replay yet still carries the sentence and the note, and says it has no replay', () => {
    const t = clone(sep23Tape);
    t.actions[1].replay = null;
    m.render(<Harness tape={t} />);
    expect(card(1).textContent).toContain('No replay for this swap.');
    expect(card(1).querySelector('[data-replay-sentence]').textContent).toBe(REPLAY_SENTENCE);   // no replay: the screen's own sentence
    expect(card(1).querySelector('[data-basis-note]').textContent).toBe(LOCKED_BASIS_NOTE);
    expect(card(1).querySelector('[data-line]')).toBeNull();
  });

  it('subsequentTradesInSlot > 0 marks both continued lines hypothetical, with the derived count; 0 does not', () => {
    // each count on its own, so the row cannot pass by reading only one of them (review A2L4-9)
    for (const [rowN, replayN] of [[1, 0], [0, 1]]) {
      const v = clone(sep23Tape);
      v.actions[0].subsequentTradesInSlot = rowN;
      v.actions[0].replay.subsequentTradesInSlot = replayN;
      m.render(<Harness tape={v} />);
      expect(card(0).querySelector('[data-hypothetical]'), `${rowN}/${replayN}`).toBeTruthy();
    }
    const t = clone(sep23Tape);
    t.actions[0].subsequentTradesInSlot = 1;
    t.actions[0].replay.subsequentTradesInSlot = 1;
    m.render(<Harness tape={t} />);
    const c = card(0);
    expect(c.querySelector('[data-hypothetical]')).toBeTruthy();
    expect(c.querySelector('[data-hypothetical] [data-num]').getAttribute('data-num')).toBe('actions[0].subsequentTradesInSlot');
    expect(c.querySelector('[data-hypothetical] [data-num]').getAttribute('data-num-class')).toBe('derived');
    expect(c.querySelector('[data-path-label="hold"]').textContent).toContain('hypothetical');
    expect(c.querySelector('[data-path-label="swap"]').textContent).toContain('hypothetical');
    expect(card(1).querySelector('[data-hypothetical]')).toBeNull();
  });

  it('the empty day: the swaps section says none were recorded, under its coverage line', () => {
    m.render(<Harness tape={emptyTape} />);
    expect(m.q('#swaps').textContent).toContain('No swaps were recorded this day.');
    expect(m.q('#swaps [data-coverage]')).toBeTruthy();
  });
});

describe('the swap card at desktop width — each path\'s end value beside the fork (design of record)', () => {
  function Desk({ tape }) {
    const [selected, setSelected] = React.useState(null);
    return <FilmRoomStudy tape={tape} desktop selected={selected} onSelect={setSelected} onDeep={() => {}} jump={() => {}} />;
  }
  const lastY = (row, k) => { const d = row.querySelector(`[data-line="${k}"]`).getAttribute('d').trim().split(/\s+/); return parseFloat(d[d.length - 1]); };

  it('beside the fork, in its row, each at its own end point\'s height — the same rebuilt number, by its path; none left under the fork', () => {
    m.render(<Desk tape={sep23Tape} />);
    sep23Tape.actions.forEach((a, i) => {
      const row = card(i).querySelector(`[data-fork-row="${i}"]`);
      const ends = row.querySelector('[data-fork-ends]');
      expect(ends.previousElementSibling.getAttribute('data-region')).toBe(`fork-${i}`);
      expect([ends.style.display, ends.style.width]).toEqual(['grid', '']);   // sized by its tags, never a fixed width they outgrow (review A2P3-2)
      for (const [k, key, label] of [['hold', 'holdPath', `Hold path · ${a.symbolOut}`], ['swap', 'swapPath', `Swap path · ${a.symbolIn}`]]) {
        const tag = ends.querySelector(`[data-fork-end="${k}"]`);
        const n = tag.querySelector('[data-num]');
        expect(n.getAttribute('data-num'), `${i} ${k}`).toBe(`actions[${i}].replay.${key}[${a.replay[key].length - 1}].points`);
        expect(n.getAttribute('data-num-class')).toBe('rebuilt');
        expect(tag.textContent.startsWith(label), `${i} ${k}`).toBe(true);
        expect(card(i).querySelector(`[data-path-label="${k}"] [data-num]`), `${i} ${k}`).toBeNull();
        expect(card(i).querySelector(`[data-path-label="${k}"]`)).toBeTruthy();   // the legend stays, without the number
      }
      const top = (k) => parseFloat(ends.querySelector(`[data-fork-end="${k}"]`).style.marginTop) + 8;
      const [yH, yS] = [lastY(row, 'hold'), lastY(row, 'swap')];
      if (Math.abs(yH - yS) >= 16) {
        expect(Math.abs(top('hold') - yH), `${i} hold`).toBeLessThan(0.06);
        expect(Math.abs(top('swap') - yS), `${i} swap`).toBeLessThan(0.06);
      } else {
        expect(Math.abs(Math.abs(top('hold') - top('swap')) - 16), `${i} spread`).toBeLessThan(1e-6);
        expect(Math.sign(top('hold') - top('swap')), `${i} order`).toBe(Math.sign(yH - yS) || -1);
      }
    });
    expect(sweepNumbers(m.container, { tape: sep23Tape })).toEqual([]);
    expect(sweepSigns(m.container)).toEqual([]);
  });

  it('two end values that would overlap are spread apart, keeping their order', () => {
    const t = clone(sep23Tape);
    const r = t.actions[0].replay;
    r.holdPath[r.holdPath.length - 1].points = 5;
    r.swapPath[r.swapPath.length - 1].points = 5.1;   // the same height on the fork's scale, within a hair
    m.render(<Desk tape={t} />);
    const ends = card(0).querySelector('[data-fork-ends]');
    const top = (k) => parseFloat(ends.querySelector(`[data-fork-end="${k}"]`).style.marginTop);
    expect(Math.abs(top('hold') - top('swap'))).toBeCloseTo(16, 6);
    expect(top('swap')).toBeLessThan(top('hold'));   // the swap path ends higher, so it stays above
  });

  it('review A2P2-9: two overlapping end values spread about THEIR own midpoint', () => {
    const t = clone(sep23Tape);
    const r = t.actions[0].replay;
    r.holdPath[r.holdPath.length - 1].points = 5;
    r.swapPath[r.swapPath.length - 1].points = 5.1;
    m.render(<Desk tape={t} />);
    const row = card(0).querySelector('[data-fork-row="0"]');
    const top = (k) => parseFloat(row.querySelector(`[data-fork-end="${k}"]`).style.marginTop) + 8;
    expect(Math.abs((top('hold') + top('swap')) / 2 - (lastY(row, 'hold') + lastY(row, 'swap')) / 2)).toBeLessThan(0.06);
  });

  it('review A2P2-9: at desktop, a replay with no fork drawn (no instants) keeps its end values, under where the fork would be', () => {
    const t = clone(sep23Tape);
    for (const p of [...t.actions[0].replay.holdPath, ...t.actions[0].replay.swapPath]) p.at = null;
    m.render(<Desk tape={t} />);
    const r = t.actions[0].replay;
    expect(card(0).querySelector('[data-fork-row]')).toBeNull();
    expect(card(0).querySelector(`[data-path-label="hold"] [data-num="actions[0].replay.holdPath[${r.holdPath.length - 1}].points"]`)).toBeTruthy();
    expect(card(0).querySelector(`[data-path-label="swap"] [data-num="actions[0].replay.swapPath[${r.swapPath.length - 1}].points"]`)).toBeTruthy();
  });

  it.each([['Sep-23', sep23Tape], ['empty', emptyTape]])('%s at desktop width, everything opened (review A2P2-3): every number marked, no sign colour astray, no forbidden word', (_l, tape) => {
    m.render(<Desk tape={tape} />);
    m.expandAll();
    if (tape.checks.length) m.click(m.q('[data-check-row="15"]'));
    expect(sweepNumbers(m.container, { tape })).toEqual([]);
    expect(sweepSigns(m.container)).toEqual([]);
    expect(sweepWords(m.container, { tape })).toEqual([]);
    expect(quoteDefects(m.container, { tape })).toEqual([]);
  });

  it('the phone keeps the end values under the fork (no column beside it)', () => {
    m.render(<Harness tape={sep23Tape} />);
    expect(m.q('[data-fork-ends]')).toBeNull();
    expect(card(0).querySelector('[data-path-label="hold"] [data-num]')).toBeTruthy();
  });
});

describe('BA-9 / F6 — directive cards from the tape\'s rows; the explainer\'s fixtures labelled', () => {
  it('committed (filed, heard), no change (retained), not filed — the player\'s words and the filed text two fields; the reply labelled', () => {
    m.render(<Harness tape={sep23Tape} />);
    const cards = m.qa('[data-directive-card]:not([data-directive-card^="example"])');
    expect(cards.map((c) => c.getAttribute('data-card-state'))).toEqual(['committed', 'no_change', 'not_filed']);
    expect(cards[0].textContent).toContain('You asked');
    // R7: the player's words, the stored directive and the reply are quotations of the row, each bound to its path
    const quoted = (c, key) => c.querySelector(`[data-quote-path$=".${key}"]`);
    expect(quoted(cards[0], 'playerText').textContent).toBe('Protect the lead into the close.');
    expect(quoted(cards[0], 'playerText').getAttribute('data-quote-path')).toBe('directives[0].playerText');
    expect(cards[0].textContent).toContain('Directive filed');
    expect(quoted(cards[0], 'canonicalText').textContent).toBe('Tighten the downside stop.');
    expect(quoted(cards[0], 'agentReply').textContent).toBe(sep23Tape.directives[0].agentReply);
    expect(quoteDefects(m.container, { tape: sep23Tape })).toEqual([]);
    expect(cards[0].querySelector('[data-heard]').textContent).toBe("Reached the agent's inputs at 1:45 PM");
    expect(cards[0].textContent).toContain('Chat reply at the time · not verified');
    expect(cards[1].textContent).toContain('No new directive filed');
    expect(cards[1].querySelector('[data-retained]').firstElementChild.textContent).toBe('Retained:');
    expect(quoted(cards[1], 'retainedDirectiveText').textContent).toBe('Tighten the downside stop.');
    expect(quoted(cards[1], 'retainedDirectiveText').parentElement.querySelector('[data-quote-attribution]').textContent).toBe('— the stored directive · 2:20 PM');
    expect(cards[2].textContent).toContain('No new directive filed');
    expect(cards[2].textContent).not.toContain('Directive filed');
    expect(cards[2].textContent).toContain('the reply at the time does not match it');
    expect(m.container.textContent).not.toMatch(/PARAPHRASE-OF-PLAYER|COUNTER-OFFER-TEXT|REJECTION-REASON-TEXT/);
    for (const k of ['checks', 'holds', 'swaps']) expect(cards[0].querySelector(`[data-num="directives[0].after.${k}"]`).getAttribute('data-num-class')).toBe('derived');
  });

  it('review A2A1-3: a card filed before the tape\'s day dates its quotations\' attributions, as its header does (A2L1-14)', () => {
    const t = clone(sep23Tape);
    t.directives[0].filedAt = '2026-09-23T00:30:00.000Z';   // 8:30 PM ET on Sep 22
    m.render(<Harness tape={t} />);
    const c = m.q('[data-directive-card="0"]');
    expect(c.textContent).toContain('Directive · Sep 22, 8:30 PM');
    expect([...c.querySelectorAll('[data-quote-attribution]')].map((a) => a.textContent))
      .toEqual(['— the player · Sep 22, 8:30 PM', '— the stored directive · Sep 22, 8:30 PM', '— the agent · Sep 22, 8:30 PM']);
    expect(quoteDefects(m.container, { tape: t })).toEqual([]);
  });

  it('the explainer ("How a directive card reads") shows the three states as clearly labelled fixtures, not this battle', () => {
    m.render(<Harness tape={sep23Tape} />);
    expect(m.q('[data-region="directive-explainer"]')).toBeNull();
    m.click(m.buttons('How a directive card reads')[0]);
    const ex = m.q('[data-region="directive-explainer"]');
    expect(ex.textContent).toContain('Example cards · a fixture, not this battle');
    expect([...ex.querySelectorAll('[data-directive-card]')].map((c) => c.getAttribute('data-card-state'))).toEqual(['committed', 'no_change', 'not_filed']);
    expect(ex.querySelector('[data-num]')).toBeNull();
    // F6 fixtures are the screen's own copy, never a quotation of the tape (R7)
    expect(ex.querySelector('[data-quotation], [data-quote-path]')).toBeNull();
    expect(ex.querySelectorAll('[data-example-words]').length).toBeGreaterThan(0);
  });
});

describe('BA-10 — plans: verbatim, the two market prices, the horizon note, no verdict', () => {
  it('every plan with its symbol, direction, signal, threshold and both prices (market); the note from the tape', () => {
    m.render(<Harness tape={sep23Tape} />);
    expect(m.qa('[data-plan]')).toHaveLength(sep23Tape.plans.length);
    expect(m.q('#plans').textContent).toContain("prices shown to the day's close, which is not the plan's horizon");
    sep23Tape.plans.forEach((p, i) => {
      const row = m.q(`[data-plan="${i}"]`);
      expect(row.textContent).toContain(p.signalSummary);
      expect(row.textContent).toContain(p.threshold);
      expect(row.querySelector(`[data-num="plans[${i}].price.atPlan.value"]`).getAttribute('data-num-class')).toBe('market');
      expect(row.querySelector(`[data-num="plans[${i}].price.atClose.value"]`).getAttribute('data-num-class')).toBe('market');
    });
  });

  it('the symbol chips filter the plans', () => {
    m.render(<Harness tape={sep23Tape} />);
    const chip = planChip('MU');
    m.click(chip);
    const shown = m.qa('[data-plan]').map((r) => sep23Tape.plans[Number(r.getAttribute('data-plan'))].symbol);
    expect(shown.length).toBeGreaterThan(0);
    expect(new Set(shown)).toEqual(new Set(['MU']));
  });
});

describe('BA-46 / F3 — the rationale timeline', () => {
  it('addendum R6: recorded rationale is labelled and collapsed by default as a clamped preview — the hypothesis, the first lines, "Read more"', () => {
    // jsdom lays nothing out: while a preview is clamped, report it as running past its box, as a browser does for these words
    const saved = ['scrollHeight', 'clientHeight'].map((k) => [k, Object.getOwnPropertyDescriptor(Element.prototype, k)]);
    Object.defineProperty(Element.prototype, 'scrollHeight', { configurable: true, get() { return this.getAttribute('data-collapsed') === 'yes' ? 120 : 40; } });
    Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, get() { return 40; } });
    try {
      m.render(<Harness tape={sep23Tape} />);
      const entries = m.qa('[data-rationale]');
      expect(entries).toHaveLength(sep23Tape.rationale.length);
      entries.forEach((e, i) => {
        const r = sep23Tape.rationale[i];
        expect(e.textContent).toContain(`Recorded rationale at ${etClock(r.at)} · the agent's words at the time · not verified`);
        const words = e.querySelector('[data-rationale-body] [data-collapsed]');
        expect(words.textContent).toBe(r.rationale);
        expect(words.getAttribute('data-collapsed'), `entry ${i}`).toBe('yes');   // collapsed by default
        expect(e.querySelector('[data-rationale-body]').textContent.startsWith(r.hypothesis)).toBe(true);
        expect([...e.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Read more']);
      });
      const first = entries[0];
      m.click(first.querySelector('button'));
      expect(first.querySelector('[data-collapsed]').getAttribute('data-collapsed')).toBe('no');
      expect(first.querySelector('button').textContent).toBe('Show less');
      expect(entries[1].querySelector('[data-collapsed]').getAttribute('data-collapsed')).toBe('yes');   // one entry opens, not all
      m.click(first.querySelector('button'));
      expect(first.querySelector('[data-collapsed]').getAttribute('data-collapsed')).toBe('yes');
    } finally {
      for (const [k, d] of saved) if (d) Object.defineProperty(Element.prototype, k, d); else delete Element.prototype[k];
    }
  });

  it('review A2P3-1 / A2P3-5: a preview that comes to overflow when its box narrows gets its "Read more" — a disclosure button', () => {
    const observers = [];
    const hadRO = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb; observers.push(this); } observe() {} disconnect() { this.gone = true; } };
    let narrow = false;
    const saved = ['scrollHeight', 'clientHeight'].map((k) => [k, Object.getOwnPropertyDescriptor(Element.prototype, k)]);
    Object.defineProperty(Element.prototype, 'scrollHeight', { configurable: true, get() { return narrow && this.getAttribute('data-collapsed') === 'yes' ? 120 : 40; } });
    Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, get() { return 40; } });
    try {
      m.render(<Harness tape={sep23Tape} />);
      const e = m.q('[data-rationale="0"]');
      expect(e.querySelector('button')).toBeNull();          // at first the words fit their two lines
      narrow = true;                                           // the phone is turned: now they run past them
      act(() => { for (const o of observers.filter((x) => !x.gone)) o.cb([]); });
      const b = e.querySelector('button');
      expect(b.textContent).toBe('Read more');
      expect(b.getAttribute('aria-expanded')).toBe('false');
      expect(b.getAttribute('aria-controls')).toBe(e.querySelector('[data-collapsed]').id);
      m.click(b);
      expect(e.querySelector('button').getAttribute('aria-expanded')).toBe('true');
      expect(e.querySelector('[data-collapsed]').getAttribute('data-collapsed')).toBe('no');
    } finally {
      for (const [k, d] of saved) if (d) Object.defineProperty(Element.prototype, k, d); else delete Element.prototype[k];
      globalThis.ResizeObserver = hadRO;
    }
  });

  it('addendum R6 (review A2P2-7): the collapsed preview is clamped — two lines', () => {
    m.render(<Harness tape={sep23Tape} />);
    const previews = m.qa('[data-rationale-body] [data-collapsed="yes"]');
    expect(previews).toHaveLength(sep23Tape.rationale.filter((r) => r.rationale).length);
    for (const p of previews) {
      expect(p.style.display).toBe('-webkit-box');
      expect(p.style.webkitLineClamp).toBe('2');
      expect(p.style.overflow).toBe('hidden');
    }
  });

  it('addendum R6: words that fit their preview carry no "Read more" — the preview is the whole of them', () => {
    m.render(<Harness tape={sep23Tape} />);
    const e = m.q('[data-rationale="0"]');
    expect(e.querySelector('[data-collapsed]').getAttribute('data-collapsed')).toBe('yes');
    expect(e.querySelector('button')).toBeNull();
  });

  it('a model-failure check is a check STATE in the timeline — the platform\'s record, never agent words, never under Diagnostic', () => {
    m.render(<Harness tape={sep23Tape} />);
    const states = m.qa('[data-state-entry]');
    expect(states.map((s) => Number(s.getAttribute('data-state-entry')))).toEqual([8, 12]);
    for (const s of states) {
      expect(s.textContent).toContain('no usable model result · the system held by default');
      expect(s.textContent).toContain("the platform's record of the check · not the agent's words");
      expect(s.textContent).not.toContain("the agent's words at the time");
    }
    m.expandAll();
    expect(m.container.textContent).not.toMatch(/Haiku call failed|defaulting to HOLD/);
    // the Diagnostic area holds only its label and the presence statement — no check state, no failure (review A2L4-9)
    expect(m.q('[data-region="diagnostics"]').textContent).toBe(`${INTRADAY_DIAGNOSTIC_HEADER}Intraday diagnostic views were recorded for this battle-day.`);
    expect(m.q('#rationale').textContent).toContain("2 entr(y/ies) carried platform-written text (a placeholder or a guardrail override), not the agent's words — not copied");
  });

  it('tapping a state entry opens that check\'s record (BA-44)', () => {
    m.render(<Harness tape={sep23Tape} />);
    m.click(m.q('[data-state-entry="8"]'));
    expect(m.q('[data-check-detail="8"]')).toBeTruthy();
  });
});

describe('checks and diagnostics', () => {
  it('each check with its recorded risk decision; the protections note exactly once in Study, a check open too', () => {
    m.render(<Harness tape={sep23Tape} />);
    expect(m.qa('[data-check-row]')).toHaveLength(sep23Tape.checks.length);
    // each row's score is ITS check's (review A2L4-11)
    sep23Tape.checks.forEach((c, i) => { if (c.scores) expect(m.q(`[data-check-row="${i}"] [data-num]`).getAttribute('data-num'), `row ${i}`).toBe(`checks[${i}].scores.total`); });
    expect(m.q('[data-check-row="10"]').textContent).toContain('Risk decision recorded: MSFT SWAP_OUT · stagnation');
    m.click(m.q('[data-check-row="10"]'));
    expect(m.q('[data-check-detail="10"]')).toBeTruthy();
    expect(m.container.textContent.split('This does not show which protections were armed or checked.').length - 1).toBe(1);
  });

  it('F4: the Diagnostic area appears only when diagnostics.intradayViews is present, under its own label', () => {
    m.render(<Harness tape={sep23Tape} />);
    expect(m.q('[data-region="diagnostics"]').textContent).toContain(INTRADAY_DIAGNOSTIC_HEADER);
    expect(INTRADAY_DIAGNOSTIC_HEADER).toBe('Diagnostic · recorded at the check · not seen by the agent');
    for (const v of ['absent', 'unknown', undefined]) {
      const t = clone(sep23Tape);
      t.diagnostics = v === undefined ? undefined : { intradayViews: v };
      m.render(<Harness tape={t} />);
      expect(m.q('#diagnostics'), String(v)).toBeNull();
    }
  });
});

describe('addendum R4(a) — the section counts, each a marked count of its own list', () => {
  it('"Holdings · 7 slots": the slots of the derived held set — the first risk record\'s names — marked derived', () => {
    m.render(<Harness tape={sep23Tape} />);
    const firstRisk = sep23Tape.checks.find((c) => c.risk && Object.keys(c.risk).length);
    const el = agg('holdings', 'count(slots of the derived held set)');
    expect(aggValue(el)).toBe(Object.keys(firstRisk.risk).length);
    expect(el.getAttribute('data-num-class')).toBe('derived');
    expect(count('holdings').textContent).toMatch(/^7\s?D?\s*slots$/);
  });

  it('the grid omitted → no slot count', () => {
    const t = clone(sep23Tape);
    delete t.checks[22].risk.PANW;
    m.render(<Harness tape={t} />);
    expect(count('holdings')).toBeNull();
  });

  it('"Swaps · n": the day\'s actions — not its directives or plans; none on a day with no swap', () => {
    m.render(<Harness tape={sep23Tape} />);
    expect(aggValue(agg('swaps', 'count(actions[])'))).toBe(sep23Tape.actions.length);
    const t = clone(sep23Tape);
    t.actions = t.actions.slice(0, 2);   // two swaps against three directives
    m.render(<Harness tape={t} />);
    expect(aggValue(agg('swaps', 'count(actions[])'))).toBe(2);
    expect(agg('swaps', 'count(actions[])').getAttribute('data-num-class')).toBe('derived');
    m.render(<Harness tape={emptyTape} />);
    expect(count('swaps')).toBeNull();
  });

  it('"Checks · n of m": rows with a record of the minted range — the range\'s size, widened by the gaps the close pass attributes', () => {
    const t = clone(sep23Tape);
    t.checks[0].state = 'no_record'; t.checks[1].state = 'no_record';
    t.passes.close.tickSeqRange = [3, 23];
    m.render(<Harness tape={t} />);
    expect(aggValue(agg('checks', 'count(checks[] with a record)'))).toBe(21);
    expect(aggValue(agg('checks', 'count(tickSeqs in the minted range)'))).toBe(21);
    t.passes.close.gaps = [1, 2];
    m.render(<Harness tape={clone(t)} />);
    expect(aggValue(agg('checks', 'count(tickSeqs in the minted range)'))).toBe(23);
    m.render(<Harness tape={emptyTape} />);
    expect(count('checks').textContent).toMatch(/^0\s?D?\s*recorded$/);
  });

  it('"Rationale · n": the recorded rationale entries — not the check states beside them in the timeline', () => {
    m.render(<Harness tape={sep23Tape} />);
    expect(m.qa('[data-state-entry]').length).toBeGreaterThan(0);
    expect(aggValue(agg('rationale', 'count(rationale[])'))).toBe(sep23Tape.rationale.length);
    m.render(<Harness tape={emptyTape} />);
    expect(count('rationale')).toBeNull();
  });

  it('review A2P2-6: each count is its own list even where the lists part — two plans at one time, a swap with no replay, an entry with no words', () => {
    const t = clone(sep23Tape);
    t.plans[1].symbol = t.plans[0].symbol;            // a second plan at the same check time
    t.actions[1].replay = null;                        // a swap not yet replayed still counts
    t.rationale[3].rationale = null;                   // an entry with a hypothesis and no words still counts
    m.render(<Harness tape={t} />);
    const s = t.plans[0].symbol;
    expect(t.plans[0].at).toBe(t.plans[1].at);
    expect(aggValue(planChip(s).querySelector('[data-num-aggregate]'))).toBe(t.plans.filter((p) => p.symbol === s).length);
    expect(aggValue(agg('swaps', 'count(actions[])'))).toBe(3);
    expect(aggValue(agg('rationale', 'count(rationale[])'))).toBe(t.rationale.length);
    expect(sweepNumbers(m.container, { tape: t })).toEqual([]);
  });

  it('the plan filter chips: each symbol\'s own plan count, marked derived; "All" carries none', () => {
    m.render(<Harness tape={sep23Tape} />);
    for (const s of new Set(sep23Tape.plans.map((p) => p.symbol))) {
      const el = planChip(s).querySelector('[data-num-aggregate="count(plans[] of the symbol)"]');
      expect(aggValue(el), s).toBe(sep23Tape.plans.filter((p) => p.symbol === s).length);
      expect(el.getAttribute('data-num-class')).toBe('derived');
    }
    expect(aggValue(planChip('PLTR').querySelector('[data-num-aggregate]'))).toBe(2);
    expect(m.qa('[data-region="plan-chips"] button')[0].querySelector('[data-num-aggregate]')).toBeNull();
  });
});

describe('BA-20 — coverage lines at every section, in all three states', () => {
  it.each(['complete', 'partial', 'unavailable'])('every Study section opens with its coverage line, %s', (status) => {
    const t = clone(sep23Tape);
    for (const k of Object.keys(t.coverage)) t.coverage[k] = { ...t.coverage[k], status, note: `${status} note for ${k}` };
    m.render(<Harness tape={t} />);
    for (const [id, key] of [['swaps', 'actions'], ['directives', 'directives'], ['plans', 'plans'], ['rationale', 'rationale'], ['checks', 'checks']]) {
      const line = m.q(`#${id} [data-coverage]`);
      expect(line.getAttribute('data-coverage'), id).toBe(status);
      expect(line.textContent, id).toContain(`${status} note for ${key}`);
    }
    expect(m.q('[data-coverage-of="replay"] [data-coverage]').getAttribute('data-coverage')).toBe(status);
    expect(m.q('#holdings [data-coverage]').getAttribute('data-coverage')).toBe(status);
  });
});

describe('the sweeps (BA-42, BA-41)', () => {
  it.each([['Sep-23', sep23Tape], ['empty', emptyTape]])('%s, everything opened: every number marked by its own class; no stray digit; no misplaced sign colour; no forbidden word', (_l, tape) => {
    m.render(<Harness tape={tape} />);
    m.expandAll();
    if (tape.checks.length) m.click(m.q('[data-check-row="15"]'));
    expect(sweepNumbers(m.container, { tape })).toEqual([]);
    expect(sweepSigns(m.container)).toEqual([]);
    expect(sweepWords(m.container, { tape })).toEqual([]);
    expect(quoteDefects(m.container, { tape })).toEqual([]);
  });

  it('BA-48: a tape whose stored declaration predates the reclass is labelled by its OWN declaration', () => {
    const t = clone(sep23Tape);
    t.numberClasses['actions[].replay.reconciliation.soldAtSale.inputsDelta'] = 'rebuilt';
    m.render(<Harness tape={t} />);
    expect(card(0).querySelector('[data-num="actions[0].replay.reconciliation.soldAtSale.inputsDelta"]').getAttribute('data-num-class')).toBe('rebuilt');
    expect(sweepNumbers(m.container, { tape: t })).toEqual([]);
  });
});
