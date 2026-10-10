// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomSweeps.guards.jsdom.test.jsx
//
// The follow-up pass before 'on' — the guard limits Astra's confirmation
// review found in the sweeps (docs/audits/20261009_ASTRA_CONFIRMATION_FILM_ROOM_A2_SCREEN.md
// §3), each closed with the exact bypass Astra reproduced as its first row:
//   B2  the stored-note number exemption (R1 / R9) is a BINDING — an element
//       bound to an R1 / R9 path whose text is the value stored there — never
//       a string found anywhere in the document; the forbidden-word scan stays
//       on stored notes
// A guard that cannot fail guards nothing: every exemption row has its bite.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Coverage, MissingInputs, StoredNote } from './FilmRoomKit';
import { mounter, sep23Tape, clone, sweepNumbers, sweepWords, storedNoteDefects, boundStoredNoteOf, SPEC_STORED_NOTE_PATHS } from './__fixtures__/filmRoomHarness';

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
    const named = ['coverage.checks.note', 'coverage.replay.note', 'actions[2].replay.reconciliation.soldAtSale.missingInputs[0]', 'actions[0].replay.reconciliation.boughtAtSale.missingInputs[3]', 'plans[4].price.missingInputs[1]', 'actions[1].replay.label'];
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
