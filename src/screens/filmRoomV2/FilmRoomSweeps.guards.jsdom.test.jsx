// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomSweeps.guards.jsdom.test.jsx
//
// The follow-up pass before 'on' — the guard limits Astra's confirmation
// review found in the sweeps (docs/audits/20261009_ASTRA_CONFIRMATION_FILM_ROOM_A2_SCREEN.md
// §3), each closed with the exact bypass Astra reproduced as its first row:
//   B1  a bound quotation inside a heading is neither exempt from the sweeps
//       nor valid: the heading is the screen's voice
//   B3  the quantity words are a closed list (zero to ninety, hundred,
//       thousand, million, billion, dozen, single, half, double, triple,
//       twice); the copy inventory is filmRoomCopy.inventory.jsdom.test.jsx
//   B2  the stored-note number exemption (R1 / R9) is a BINDING — an element
//       bound to an R1 / R9 path whose text is the value stored there — never
//       a string found anywhere in the document; the forbidden-word scan stays
//       on stored notes
// A guard that cannot fail guards nothing: every exemption row has its bite.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Coverage, MissingInputs, StoredNote, Quotation } from './FilmRoomKit';
import { mounter, sep23Tape, clone, sweepNumbers, sweepWords, quoteDefects, boundQuotationOf, storedNoteDefects, boundStoredNoteOf, agentNameDefects, boundAgentNameOf, SPEC_STORED_NOTE_PATHS } from './__fixtures__/filmRoomHarness';

const box = (html) => { const el = document.createElement('div'); el.innerHTML = html; return el; };
const m = mounter();
beforeEach(() => m.setup());
afterEach(() => m.teardown());

describe('Astra B2 — the stored-note number exemption is bound by path, never by a string found anywhere', () => {
  const noted = (note) => { const t = clone(sep23Tape); t.coverage.checks.note = note; return t; };

  it('Astra\'s bypass: with coverage.checks.note "one 73" stored, screen copy reading "one 73" (an unbound record) is swept by BOTH number sweeps', () => {
    const tape = noted('one 73');
    const unbound = box('<span data-record-text>one 73</span>');
    expect(sweepNumbers(unbound, { tape })).toEqual(['stray digit: “one 73”']);
    expect(sweepWords(unbound, { tape })).toEqual(['number word “one”: one 73']);
  });

  it('the same words BOUND to the stored note\'s path are the tape\'s own: exempt from both number sweeps, and bound', () => {
    const tape = noted('one 73');
    const bound = box('<span data-stored-note="coverage.checks.note" data-stored-doc="tape">one 73</span>');
    expect(sweepNumbers(bound, { tape })).toEqual([]);
    expect(sweepWords(bound, { tape })).toEqual([]);
    expect(storedNoteDefects(bound, { tape })).toEqual([]);
    expect(boundStoredNoteOf(bound.firstChild.firstChild, { tape })).toBe(bound.firstChild);
  });

  it('bites: screen words inside a bound note, a forged path, a path R1 / R9 does not name, a missing document', () => {
    const tape = noted('one 73');
    tape.battle.result.note = 'one 73';   // a stored note R1 / R9 does not name
    // screen words appended inside the note: its text is no longer the stored value
    const inside = box('<span data-stored-note="coverage.checks.note">one 73 · two more</span>');
    expect(sweepNumbers(inside, { tape })).toEqual(['stray digit: “one 73 · two more”']);
    expect(sweepWords(inside, { tape })).toEqual(['number word “one”: one 73 · two more']);
    expect(storedNoteDefects(inside, { tape })).toEqual(['coverage.checks.note: not bound — its text is not the stored value']);
    // a forged path: the note at coverage.checks.note does not read "two 74" (Astra's negative control)
    const forged = box('<span data-stored-note="coverage.checks.note">two 74</span>');
    expect(sweepNumbers(forged, { tape })).toEqual(['stray digit: “two 74”']);
    expect(sweepWords(forged, { tape })).toEqual(['number word “two”: two 74']);
    expect(storedNoteDefects(forged, { tape })).toEqual(['coverage.checks.note: not bound — its text is not the stored value']);
    // bound, but at a path the rulings do not exempt: the binding holds, the exemption does not
    const other = box('<span data-stored-note="battle.result.note">one 73</span>');
    expect(storedNoteDefects(other, { tape })).toEqual([]);
    expect(sweepNumbers(other, { tape })).toEqual(['stray digit: “one 73”']);
    expect(sweepWords(other, { tape })).toEqual(['number word “one”: one 73']);
    // no document to bind it to
    expect(sweepNumbers(box('<span data-stored-note="coverage.checks.note">one 73</span>'), {})).toEqual(['stray digit: “one 73”']);
  });

  it('the forbidden-word scan reads stored notes: a bound note "best one 73" is exempt from the number sweeps only', () => {
    const tape = noted('best one 73');
    const bound = box('<span data-stored-note="coverage.checks.note">best one 73</span>');
    expect(sweepNumbers(bound, { tape })).toEqual([]);
    expect(sweepWords(bound, { tape })).toEqual(['best']);
  });

  it('an attribute is always the screen\'s: a stored note\'s words copied into a title are swept', () => {
    const tape = noted('one 73');
    const attr = box('<span title="one 73"></span>');
    expect(sweepNumbers(attr, { tape })).toEqual(['stray digit in title: “one 73”']);
    expect(sweepWords(attr, { tape })).toEqual(['number word “one” in title: one 73']);
  });

  it('the rulings\' paths, pinned: coverage notes, each missing input by its index, each replay\'s label — nothing else', () => {
    const named = ['coverage.checks.note', 'coverage.replay.note', 'actions[2].replay.reconciliation.soldAtSale.missingInputs[0]', 'actions[0].replay.reconciliation.boughtAtSale.missingInputs[3]', 'plans[4].price.missingInputs[1]', 'actions[3].replay.missingInputs[1]', 'actions[1].replay.label'];
    const not = ['coverage.checks.status', 'coverage.checks', 'actions[0].replay.note', 'actions[0].replay.lockedBasisNote', 'plans[0].price.note', 'battle.result.note', 'actions[0].replay.reconciliation.soldAtSale.missingInputs', 'actions[0].symbolOut', 'passes.close.status', 'xcoverage.checks.note'];
    for (const p of named) expect(SPEC_STORED_NOTE_PATHS.some((re) => re.test(p)), p).toBe(true);
    for (const p of not) expect(SPEC_STORED_NOTE_PATHS.some((re) => re.test(p)), p).toBe(false);
  });

  it('the kit renders a stored note by its PATH: Coverage binds the section\'s note, MissingInputs each name, StoredNote the value and nothing else', () => {
    const tape = noted('one 73');
    tape.actions[0].replay.reconciliation.soldAtSale.missingInputs = ['bars:INTC', 'eodhd_1m'];
    m.render(
      <div>
        <Coverage doc={tape} at={['coverage', 'checks']} />
        <MissingInputs doc={tape} path={['actions', 0, 'replay', 'reconciliation', 'soldAtSale', 'missingInputs']} />
        <StoredNote doc={tape} path={['coverage', 'checks', 'status']} />
        <StoredNote doc={tape} path={['coverage', 'nope', 'note']} />
      </div>,
    );
    expect(m.q('[data-coverage] [data-stored-note]').getAttribute('data-stored-note')).toBe('coverage.checks.note');
    expect(m.q('[data-coverage] [data-stored-note]').textContent).toBe('one 73');
    expect(m.qa('[data-missing-inputs] [data-stored-note]').map((s) => [s.getAttribute('data-stored-note'), s.textContent]))
      .toEqual([['actions[0].replay.reconciliation.soldAtSale.missingInputs[0]', 'bars:INTC'], ['actions[0].replay.reconciliation.soldAtSale.missingInputs[1]', 'eodhd_1m']]);
    expect(m.q('[data-missing-inputs]').textContent).toBe('missing: bars:INTC, eodhd_1m');
    expect(m.qa('[data-stored-note]')).toHaveLength(4);   // the coverage note, two names, the status; a path with no text renders nothing
    const docs = { tape };
    expect(storedNoteDefects(m.container, docs)).toEqual([]);
    expect(sweepNumbers(m.container, docs)).toEqual([]);
    expect(sweepWords(m.container, docs)).toEqual([]);
  });

  it('a screen-made coverage (the derived holdings) keeps its note as the screen\'s own words — never bound, never exempt', () => {
    m.render(<Coverage coverage={{ status: 'unavailable', note: 'one 73' }} />);
    expect(m.q('[data-stored-note]')).toBeNull();
    expect(sweepNumbers(m.container, { tape: noted('one 73') })).toEqual(['stray digit: “one 73”']);
  });
});

describe('Astra B3 — the quantity words are a closed list: zero to ninety, hundred, thousand, million, billion, dozen, single, half, double, triple, twice', () => {
  it('Astra\'s bypass: screen-authored "ninety checks", "a hundred checks", "a thousand checks" each bite', () => {
    expect(sweepWords(box('<p>ninety checks</p>'))).toEqual(['number word “ninety”: ninety checks']);
    expect(sweepWords(box('<p>a hundred checks</p>'))).toEqual(['number word “hundred”: a hundred checks']);
    expect(sweepWords(box('<p>a thousand checks</p>'))).toEqual(['number word “thousand”: a thousand checks']);
  });

  it('every new word bites in text and in an attribute, and in its inflected forms', () => {
    for (const w of ['thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million', 'billion', 'half', 'double', 'triple', 'twice']) {
      expect(sweepWords(box(`<p>a ${w} of it</p>`)), w).toEqual([`number word “${w}”: a ${w} of it`]);
      expect(sweepWords(box(`<span aria-label="the ${w} mark"></span>`)), `${w} attr`).toEqual([`number word “${w}” in aria-label: the ${w} mark`]);
    }
    expect(sweepWords(box('<p>hundreds of checks</p>'))).toEqual(['number word “hundreds”: hundreds of checks']);
    expect(sweepWords(box('<p>in halves</p>'))).toEqual(['number word “halves”: in halves']);
    expect(sweepWords(box('<p>at sixes and sevens</p>'))).toEqual(['number word “sixes”: at sixes and sevens']);
    expect(sweepWords(box('<p>twenty-one checks</p>'))).toEqual(['number word “twenty”: twenty-one checks']);   // a compound is two listed words
    expect(sweepWords(box('<p>Doubled down</p>'))).toEqual([]);   // whole words only: "doubled" is not "double"
  });

  it('R12\'s "shown once", and positional words, are not quantity words', () => {
    expect(sweepWords(box('<p>Film Room · shown once</p><p>the first check · the last bar</p>'))).toEqual([]);
  });
});

describe('R13\'s guard (review A2F1-5) — the agent\'s name, like a quotation, is exempt only outside a heading, and shown once', () => {
  const docs = { battle: { agentContext: { agentName: 'Best Twelve 47' } } };
  const named = (wrap) => box(wrap('<span data-agent-name="agentContext.agentName" data-agent-name-doc="battle">Best Twelve 47</span>'));

  it('a bound name in a heading (h1–h6, role="heading") is the screen\'s voice: swept, and a defect', () => {
    for (const wrap of [(s) => `<h1>${s}</h1>`, (s) => `<h4>${s}</h4>`, (s) => `<div role="heading" aria-level="2">${s}</div>`]) {
      const el = named(wrap);
      expect(sweepWords(el, docs)).toEqual(['best', 'number word “Twelve”: Best Twelve 47']);
      expect(sweepNumbers(el, docs)).toEqual(['stray digit: “Best Twelve 47”']);
      expect(agentNameDefects(el, docs)).toEqual(['agent name “Best Twelve 47”: inside a heading']);
      expect(boundAgentNameOf(el.querySelector('[data-agent-name]'), docs)).toBeNull();
    }
  });

  it('shown twice is a defect; the control — once, in a paragraph — is exempt and clean', () => {
    expect(agentNameDefects(named((s) => `<p>${s}</p><p>${s}</p>`), docs)).toEqual(['agent name shown 2 times']);
    const once = named((s) => `<p>${s}</p>`);
    expect([sweepWords(once, docs), sweepNumbers(once, docs), agentNameDefects(once, docs)]).toEqual([[], [], []]);
  });
});

describe('Astra B1 — a quotation inside a heading is the screen\'s voice: neither exempt nor valid', () => {
  const said = (words) => { const t = clone(sep23Tape); t.rationale[0].rationale = words; return t; };
  const quote = (tape) => <Quotation doc={tape} path={['rationale', 0, 'rationale']} by="agent" at={['rationale', 0, 'at']} />;

  it('Astra\'s repro: <h2><Quotation …/></h2> on a valid rationale reading "best one 73" — every sweep sees the words, the validator names the heading', () => {
    const tape = said('best one 73');
    m.render(<h2>{quote(tape)}</h2>);
    const docs = { tape };
    expect(m.q('h2 [data-quote-path]').textContent).toBe('best one 73');   // bound: the stored value, verbatim
    expect(sweepWords(m.container, docs)).toEqual(['best', 'number word “one”: best one 73']);
    expect(sweepNumbers(m.container, docs)).toEqual(['stray digit: “best one 73”']);
    expect(quoteDefects(m.container, docs)).toEqual(['rationale[0].rationale: inside a heading']);
    expect(boundQuotationOf(m.q('h2 [data-quote-path]'), docs)).toBeNull();
  });

  it('every heading level, and a role="heading" element, the same', () => {
    const tape = said('best one 73');
    for (const Tag of ['h1', 'h3', 'h4', 'h5', 'h6']) {
      m.render(<Tag>{quote(tape)}</Tag>);
      expect(quoteDefects(m.container, { tape }), Tag).toEqual(['rationale[0].rationale: inside a heading']);
      expect(sweepWords(m.container, { tape }), Tag).toContain('best');
    }
    m.render(<div role="heading" aria-level={2}>{quote(tape)}</div>);
    expect(quoteDefects(m.container, { tape })).toEqual(['rationale[0].rationale: inside a heading']);
    expect(sweepWords(m.container, { tape })).toContain('best');
  });

  it('the control: the same quotation outside a heading is the record\'s words — exempt and valid', () => {
    const tape = said('best one 73');
    m.render(<section><h2>Rationale</h2>{quote(tape)}</section>);
    const docs = { tape };
    expect(sweepWords(m.container, docs)).toEqual([]);
    expect(sweepNumbers(m.container, docs)).toEqual([]);
    expect(quoteDefects(m.container, docs)).toEqual([]);
  });
});
