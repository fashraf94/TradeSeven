// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomQuotation.writer.jsdom.test.jsx
//
// Amendment E addendum 2, R7 (Astra's A2 review, F1) — RECORDED WORDS, WRITER
// TO SCREEN. Each phrase on the forbidden list is written into every
// recorded-words channel of the Sep-23 day's SOURCE records — the agent's
// rationale and hypothesis, the player's message, the filed directive (and so
// the retained one), the agent's reply, the plans' signal and threshold, the
// platform's completion words — and the day goes through the REAL close pass
// (writeTapeDay) and candle pass (runCandlePass) by buildTapeDay. The tape
// they write is mounted collapsed, expanded and at desktop width:
//   (a) the phrase renders verbatim inside a quotation bound to its tape path,
//       attributed as the record says, and nowhere else (no other text, no
//       aria-label, no title);
//   (b) the screen's own voice — text, aria-label, title — holds no forbidden
//       word;
//   (c) the tape holds every planted string exactly as the source wrote it.
//
// DEPENDENCY-SURFACE GUARD (BUILD_RULES §4): the REAL passes, never mocked;
// only the writer flag is mocked on (spreading the real module).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

vi.mock('../../config/featureFlags.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get FILM_TAPE_WRITE_ENABLED() { return true; },
}));

import FilmRoomScreenV2 from './FilmRoomScreenV2';
import FilmRoomStudy from './FilmRoomStudy';
import FilmRoomDeepDive from './FilmRoomDeepDive';
import CheckDetail from './FilmRoomCheckDetail';
import { ResultCard } from './FilmRoomGlance';
import { deepSymbols, deriveHoldings } from './filmRoomModel';
import { sep23Day, sep23Bars, buildTapeDay, SEP23_NIGHT, SEP23_MORNING } from '../../../api/_utils/filmTape/__fixtures__/screenFixtures.js';
import { mounter, sweepWords, quoteDefects, boundQuotationOf, parsePath, battleOf, readersOf, NOW, SPEC_FORBIDDEN_WORDS } from './__fixtures__/filmRoomHarness';

vi.setConfig({ testTimeout: 90_000 });

const m = mounter();
beforeEach(() => m.setup());
afterEach(() => m.teardown());

/**
 * The Sep-23 day with `phrase` planted in every recorded-words channel of its source records. Returns the
 * fixture and every planted string by the tape path it must land at (filled in once the tape is written).
 */
async function plantedDay(phrase) {
  const fx = await sep23Day();
  const planted = [];   // { source, find(tape) → tape path }
  for (const e of fx.battle.evaluations) {
    if (e.haikuError) continue;   // the platform's failure text is never copied as the agent's words (BA-46)
    const seq = e.evalId.split(':e')[1];
    e.rationale = `Rationale at check ${seq}: ${phrase}.`;
    e.hypothesis = `Hypothesis at check ${seq}: ${phrase}.`;
    const row = (t) => t.rationale.findIndex((r) => r.evalId === e.evalId);
    planted.push({ source: e.rationale, at: (t) => ['rationale', row(t), 'rationale'] }, { source: e.hypothesis, at: (t) => ['rationale', row(t), 'hypothesis'] });
    (e.candidates || []).forEach((c, i) => {
      c.signalSummary = `Signal ${seq}/${i}: ${phrase}.`;
      c.threshold = `Threshold ${seq}/${i}: ${phrase}.`;
      const plan = (t) => t.plans.findIndex((p) => p.key === `${e.evalId}:${i}`);
      planted.push({ source: c.signalSummary, at: (t) => ['plans', plan(t), 'signalSummary'] }, { source: c.threshold, at: (t) => ['plans', plan(t), 'threshold'] });
    });
  }
  fx.battle.chatExchanges.forEach((x, k) => {
    x.userMessage = `Player message ${k}: ${phrase}.`;
    x.agentResponse = `Agent reply ${k}: ${phrase}.`;
    const card = (t) => t.directives.findIndex((d) => d.filedAt === x.timestamp);
    planted.push({ source: x.userMessage, at: (t) => ['directives', card(t), 'playerText'] }, { source: x.agentResponse, at: (t) => ['directives', card(t), 'agentReply'] });
    if (x.directive) {
      x.directive.text = `Filed directive: ${phrase}.`;
      planted.push({ source: x.directive.text, at: (t) => ['directives', card(t), 'canonicalText'] });
      // the no-change card after it retains the filed text (BA-9)
      planted.push({ source: x.directive.text, at: (t) => ['directives', t.directives.findIndex((d) => d.cardState === 'no_change'), 'retainedDirectiveText'] });
    }
  });
  const feed = fx.battle.statusFeed.find((s) => s.action === 'battle_complete');
  feed.message = `Platform at completion: ${phrase}.`;
  planted.push({ source: feed.message, at: () => ['battle', 'completionMessage', 'text'] });
  return { fx, planted };
}

const valueAt = (doc, path) => path.reduce((n, k) => (n == null ? undefined : n[k]), doc);
const pathText = (path) => path.reduce((acc, s) => (typeof s === 'number' ? `${acc}[${s}]` : (acc ? `${acc}.${s}` : s)), '');

/** Every place `text` reaches the rendered output outside a bound quotation: a text node, an aria-label, a title. */
function strayCopies(container, docs, text) {
  const out = [];
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.includes(text) && !boundQuotationOf(n, docs)) out.push(`text: ${n.textContent.slice(0, 80)}`);
  for (const el of container.querySelectorAll('[aria-label], [title]')) {
    for (const a of ['aria-label', 'title']) if ((el.getAttribute(a) || '').includes(text)) out.push(`${a}: ${el.getAttribute(a).slice(0, 80)}`);
  }
  return out;
}

/** jsdom lays nothing out: report a clamped preview as running past its box, as a browser does for these words. */
async function withOverflowingPreviews(fn) {
  const saved = ['scrollHeight', 'clientHeight'].map((k) => [k, Object.getOwnPropertyDescriptor(Element.prototype, k)]);
  Object.defineProperty(Element.prototype, 'scrollHeight', { configurable: true, get() { return this.getAttribute('data-collapsed') === 'yes' ? 120 : 40; } });
  Object.defineProperty(Element.prototype, 'clientHeight', { configurable: true, get() { return 40; } });
  try { return await fn(); } finally {
    for (const [k, d] of saved) if (d) Object.defineProperty(Element.prototype, k, d); else delete Element.prototype[k];
  }
}

/** Each phrase's day, written once through the real passes and shared by the describes below. */
const days = new Map();
function dayOf(phrase) {
  if (!days.has(phrase)) {
    days.set(phrase, plantedDay(phrase).then(async ({ fx, planted }) => ({
      ...(await buildTapeDay(fx, { night: SEP23_NIGHT, morning: SEP23_MORNING, bars: sep23Bars() })),
      planted,
    })));
  }
  return days.get(phrase);
}

/** (a) and (b) over one mounted state. */
function expectQuotedAndSilent(tape, planted, phrase, state) {
  const docs = { tape };
  const glanceOnly = (p) => p.at(tape)[0] === 'battle';
  for (const p of planted.filter((x) => !glanceOnly(x))) {
    const where = pathText(p.at(tape));
    const q = m.q(`[data-quote-path="${where}"]`);
    expect(q, `${state}: ${where}`).toBeTruthy();
    expect(boundQuotationOf(q, docs), `${state}: ${where} bound`).toBe(q);
    expect(q.textContent, `${state}: ${where}`).toBe(valueAt(tape, p.at(tape)));
    expect(q.textContent.includes(phrase), `${state}: ${where}`).toBe(true);
  }
  expect(quoteDefects(m.container, docs), state).toEqual([]);
  for (const s of new Set(planted.filter((x) => !glanceOnly(x)).map((x) => x.source))) expect(strayCopies(m.container, docs, s), `${state}: ${s}`).toEqual([]);
  // (b) the screen's own voice holds no forbidden word — and the phrase IS on screen: unbound, the same sweep sees it
  expect(sweepWords(m.container, docs), state).toEqual([]);
  expect(sweepWords(m.container).length, `${state}: the control`).toBeGreaterThan(0);
}

describe('R7 / F1 — each forbidden phrase in every recorded-words channel, written by the real passes, renders as attributed quotation', () => {
  it.each(SPEC_FORBIDDEN_WORDS)('“%s”', async (phrase) => {
    const { tape, planted } = await dayOf(phrase);

    // (c) the tape keeps every planted string exactly as the source wrote it
    expect(planted.length).toBeGreaterThan(30);
    for (const p of planted) {
      const path = p.at(tape);
      expect(path.every((s) => s !== -1), `${p.source} reached the tape`).toBe(true);
      expect(valueAt(tape, path), pathText(path)).toBe(p.source);
    }
    // every channel carries the phrase: rationale, hypothesis, the player's words, the filed and retained directive, the reply, both plan fields
    const channels = new Set(planted.map((p) => p.at(tape).filter((s) => typeof s === 'string').join('.')));
    expect([...channels].sort()).toEqual([
      'battle.completionMessage.text', 'directives.agentReply', 'directives.canonicalText', 'directives.playerText', 'directives.retainedDirectiveText',
      'plans.signalSummary', 'plans.threshold', 'rationale.hypothesis', 'rationale.rationale',
    ]);

    await withOverflowingPreviews(() => {
      // collapsed: every long quotation is a clamped preview of the FULL stored value
      m.render(<FilmRoomStudy tape={tape} selected={null} onSelect={() => {}} onDeep={() => {}} jump={() => {}} />);
      const previews = m.qa('[data-quote-path][data-collapsed="yes"]');
      expect(previews.length).toBeGreaterThan(10);
      for (const el of previews) {
        expect(el.style.display).toBe('-webkit-box');
        expect(el.textContent).toBe(valueAt(tape, parsePath(el.getAttribute('data-quote-path'))));
      }
      expectQuotedAndSilent(tape, planted, phrase, 'collapsed');

      // expanded: every "Read more" opened, the explainer too
      m.expandAll();
      expect(m.qa('[data-quote-path][data-collapsed="yes"]')).toEqual([]);
      expect(m.qa('[data-quote-path][data-collapsed="no"]').length).toBe(previews.length);
      expectQuotedAndSilent(tape, planted, phrase, 'expanded');
    });

    // desktop width, everything opened
    m.render(<FilmRoomStudy tape={tape} desktop selected={null} onSelect={() => {}} onDeep={() => {}} jump={() => {}} />);
    m.expandAll();
    expectQuotedAndSilent(tape, planted, phrase, 'desktop');

    // the platform's completion words (Glance's result card)
    m.render(<ResultCard tape={tape} />);
    const q = m.q('[data-quote-path="battle.completionMessage.text"]');
    expect(q.textContent).toBe(`Platform at completion: ${phrase}.`);
    expect(boundQuotationOf(q, { tape })).toBe(q);
    expect(quoteDefects(m.container, { tape })).toEqual([]);
    expect(strayCopies(m.container, { tape }, q.textContent)).toEqual([]);
    expect(sweepWords(m.container, { tape })).toEqual([]);
  });
});

/** Over the whole container: no forbidden word in the screen's own voice, every quotation bound and attributed, no planted string outside one. */
function expectSilentEverywhere(tape, planted, state) {
  const docs = { tape };
  expect(sweepWords(m.container, docs), state).toEqual([]);
  expect(quoteDefects(m.container, docs), state).toEqual([]);
  for (const s of new Set(planted.map((x) => x.source))) expect(strayCopies(m.container, docs, s), `${state}: ${s}`).toEqual([]);
}

describe('R7 / F1 (review A2A1-1) — the WHOLE screen, on the same writer days: every depth at both widths, every check\'s record, every Deep dive symbol', () => {
  it.each(SPEC_FORBIDDEN_WORDS)('“%s”', async (phrase) => {
    const { tape, series, planted } = await dayOf(phrase);
    for (const desktop of [false, true]) {
      const had = window.matchMedia;
      if (desktop) window.matchMedia = () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} });
      try {
        await withOverflowingPreviews(async () => {
          m.render(<FilmRoomScreenV2 battle={battleOf(tape)} onBack={() => {}} viewerId="r7" readers={readersOf({ [tape.etDate]: tape }, series)} nowMs={NOW} />);
          await m.flush();
          for (const label of ['Glance', 'Study', 'Deep dive']) {
            m.click(m.tab(label));
            await m.flush();
            m.expandAll();
            const pip = m.q('[data-check-pip="9"]') || m.q('[data-check-row="9"]');
            if (pip) m.click(pip);
            const mark = m.qa('[data-evidence-marker]')[0];
            if (mark) m.click(mark);
            expectSilentEverywhere(tape, planted, `${desktop ? 'desktop' : 'phone'} · ${label}`);
          }
        });
      } finally {
        window.matchMedia = had;
      }
      m.teardown();
      m.setup();
    }
    // every check's record at once (the depths open one at a time)
    m.render(<>{tape.checks.map((_, i) => <CheckDetail key={i} tape={tape} index={i} onClose={() => {}} />)}</>);
    expect(m.qa('[data-check-detail]')).toHaveLength(tape.checks.length);
    expectSilentEverywhere(tape, planted, 'every check detail');
    // every Deep dive symbol: its facts, its chart's labels, its first evidence stamp opened
    const symbols = deepSymbols(tape, series, deriveHoldings(tape));
    expect(symbols.length).toBeGreaterThan(8);
    for (const sym of symbols) {
      m.render(<FilmRoomDeepDive tape={tape} seriesState={{ status: 'ready', series }} sym={sym} onSym={() => {}} />);
      const mark = m.qa('[data-evidence-marker]')[0];
      if (mark) m.click(mark);
      expectSilentEverywhere(tape, planted, `deep dive · ${sym}`);
    }
  });
});

describe('R7\'s guard bites — only a bound quotation is exempt, and it must be attributed as the record says', () => {
  const tape = {
    etDate: '2026-09-23',
    rationale: [{ at: '2026-09-23T16:00:15.000Z', rationale: 'This is the best entry.', hypothesis: null }],
    directives: [
      { filedAt: '2026-09-23T17:40:00.000Z', playerText: 'Sell the worst name.' },
      { filedAt: '2026-09-23T00:30:00.000Z', playerText: 'Filed the evening before.' },   // 8:30 PM ET on Sep 22
    ],
    coverage: { checks: { note: 'the worst gap' } },
  };
  const docs = { tape };
  const box = (html) => { const el = document.createElement('div'); el.innerHTML = html; return el; };
  const attribution = (who, clock) => `<span data-quote-attribution="">— ${who} · <span data-time="">${clock}</span></span>`;
  const quotation = (by, path, text, attr) => `<div data-quotation="${by}"><p data-quote-path="${path}">${text}</p>${attr}</div>`;

  it('a bound, attributed quotation: its words are the record\'s — exempt from the word sweep, no defect', () => {
    const el = box(quotation('agent', 'rationale[0].rationale', 'This is the best entry.', attribution('the agent', '12:00 PM')));
    expect(sweepWords(el, docs)).toEqual([]);
    expect(quoteDefects(el, docs)).toEqual([]);
    expect(sweepWords(el)).toEqual(['best']);   // no document to bind it to: swept
  });

  it('a forged path (the text is not the value stored there) stays under the sweep, and is a defect', () => {
    const el = box(quotation('agent', 'rationale[0].rationale', 'The best entry, says the screen.', attribution('the agent', '12:00 PM')));
    expect(sweepWords(el, docs)).toEqual(['best']);
    expect(quoteDefects(el, docs)).toEqual(['rationale[0].rationale: not bound — its text is not the stored value']);
  });

  it('screen copy placed inside a quotation unbinds it', () => {
    const el = box(quotation('agent', 'rationale[0].rationale', 'This is the best entry. · not verified', attribution('the agent', '12:00 PM')));
    expect(sweepWords(el, docs)).toEqual(['best']);
    expect(quoteDefects(el, docs)[0]).toMatch(/not bound/);
  });

  it('review A2A1-4: an UNATTRIBUTED quotation, or one bound to a path that holds no one\'s words, is not exempt', () => {
    expect(sweepWords(box(quotation('agent', 'rationale[0].rationale', 'This is the best entry.', '')), docs)).toEqual(['best']);
    expect(sweepWords(box(quotation('platform', 'coverage.checks.note', 'the worst gap', attribution('the platform', '12:00 PM'))), docs)).toEqual(['worst']);
  });

  it('review A2A1-3: a record from before the tape\'s day is attributed with its date', () => {
    expect(quoteDefects(box(quotation('player', 'directives[1].playerText', 'Filed the evening before.', attribution('the player', 'Sep 22, 8:30 PM'))), docs)).toEqual([]);
    expect(quoteDefects(box(quotation('player', 'directives[1].playerText', 'Filed the evening before.', attribution('the player', '8:30 PM'))), docs))
      .toEqual(['directives[1].playerText: attributed “— the player · 8:30 PM”, the record says “— the player · Sep 22, 8:30 PM”']);
  });

  it('a path that is not the quotation component (no quotation root) is swept', () => {
    const el = box('<div><p data-quote-path="rationale[0].rationale">This is the best entry.</p></div>');
    expect(sweepWords(el, docs)).toEqual(['best']);
  });

  it('recorded words copied into an aria-label or a title are the screen\'s voice', () => {
    const el = box(`<div aria-label="This is the best entry.">${quotation('player', 'directives[0].playerText', 'Sell the worst name.', attribution('the player', '1:40 PM'))}</div><span title="Sell the worst name."></span>`);
    expect(sweepWords(el, docs)).toEqual(['best', 'worst']);
  });

  it('no attribution, the wrong author, or the wrong time is a defect', () => {
    expect(quoteDefects(box(quotation('agent', 'rationale[0].rationale', 'This is the best entry.', '')), docs)).toEqual(['rationale[0].rationale: no attribution']);
    expect(quoteDefects(box(quotation('agent', 'rationale[0].rationale', 'This is the best entry.', attribution('the platform', '12:00 PM'))), docs))
      .toEqual(['rationale[0].rationale: attributed “— the platform · 12:00 PM”, the record says “— the agent · 12:00 PM”']);
    expect(quoteDefects(box(quotation('player', 'directives[0].playerText', 'Sell the worst name.', attribution('the player', '1:45 PM'))), docs))
      .toEqual(['directives[0].playerText: attributed “— the player · 1:45 PM”, the record says “— the player · 1:40 PM”']);
    expect(quoteDefects(box(quotation('player', 'directives[0].playerText', 'Sell the worst name.', '<span data-quote-attribution="">— the player · 1:40 PM</span>')), docs))
      .toEqual(['directives[0].playerText: its time is not marked as an instant']);
    expect(quoteDefects(box(quotation('agent', 'rationale[0].hypothesis', 'This is the best entry.', attribution('the agent', '12:00 PM'))), docs)[0]).toMatch(/not bound/);
  });
});
