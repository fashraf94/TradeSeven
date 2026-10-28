// @vitest-environment jsdom
//
// src/screens/filmRoomV2/FilmRoomScreenV2.focus.jsdom.test.jsx
//
// Film Room B2.1 A8 — A2F2-5 / A2FV2-N2: a door inside the panel that changes
// the day or the depth unmounts the panel that held the keyboard focus. The
// focus is put on the NEW panel — or on the place the door opens — once it has
// rendered, never dropped to the page. The depth tabs themselves keep the ARIA
// tabs pattern (focus stays on the tab); nothing here changes them.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import FilmRoomScreenV2 from './FilmRoomScreenV2';
import { mounter, sep23Tape, sep23Series, clone, battleOf, readersOf, NOW } from './__fixtures__/filmRoomHarness';

const m = mounter();
beforeEach(() => { globalThis.localStorage.clear(); m.setup(); });
afterEach(() => m.teardown());

async function openScreen(battle, readers) {
  m.render(<FilmRoomScreenV2 battle={battle} onBack={() => {}} viewerId="viewer-1" readers={readers} nowMs={NOW} />);
  await m.flush();
}
const shownPanel = () => m.qa('[role="tabpanel"]').find((p) => !p.hidden);
const focusedIsShownPanel = () => document.activeElement === shownPanel();

describe('A2F2-5 — a door that changes the depth focuses the new panel', () => {
  it('Study\'s "Deep dive · DE" door: the Deep dive panel takes the focus (never the page)', async () => {
    await openScreen(battleOf(sep23Tape), readersOf({ [sep23Tape.etDate]: sep23Tape }, sep23Series));
    m.click(m.tab('Study')); await m.flush();
    const door = m.qa('button').find((b) => b.textContent.startsWith('Deep dive · DE'));
    door.focus();
    m.click(door);
    await m.flush();
    expect(m.tab('Deep dive').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).not.toBe(document.body);
    expect(focusedIsShownPanel()).toBe(true);
    expect(shownPanel().getAttribute('aria-labelledby')).toBe(m.tab('Deep dive').id);
  });

  it('a holdings chip (a door to its Deep dive) does the same', async () => {
    await openScreen(battleOf(sep23Tape), readersOf({ [sep23Tape.etDate]: sep23Tape }, sep23Series));
    m.click(m.tab('Study')); await m.flush();
    m.click(m.q('[data-region="holdings"] button'));
    await m.flush();
    expect(focusedIsShownPanel()).toBe(true);
  });
});

describe('A2F2-5 — a door that changes the day focuses the new panel', () => {
  it('an earlier day\'s "Open" door to the final result: the day changes and its panel takes the focus', async () => {
    const D1 = '2026-09-22';
    const early = clone(sep23Tape);
    early.etDate = D1;
    early.battle = { status: 'active', completedAt: null, final: null, result: { value: null, basis: 'not_completed' }, completionMessage: null };
    await openScreen(battleOf(sep23Tape, { timing: { tradingDays: [D1, sep23Tape.etDate] } }), readersOf({ [D1]: early, [sep23Tape.etDate]: sep23Tape }, sep23Series));
    m.click(m.qa('[data-region="day-picker"] button')[0]); await m.flush();
    const door = m.q('[data-result-elsewhere] button');
    door.focus();
    m.click(door);
    await m.flush();
    expect(m.q('[data-region="final-result"] [data-result="win"]')).toBeTruthy();
    expect(focusedIsShownPanel()).toBe(true);
  });
});

describe('the tabs and the in-panel jumps are unchanged', () => {
  it('Study\'s jump chips scroll and leave the focus where it is (they change neither the day nor the depth)', async () => {
    await openScreen(battleOf(sep23Tape), readersOf({ [sep23Tape.etDate]: sep23Tape }, sep23Series));
    m.click(m.tab('Study')); await m.flush();
    const chip = m.qa('[data-region="study-jumps"] button')[0];
    chip.focus();
    m.click(chip);
    await m.flush();
    expect(document.activeElement).toBe(chip);
  });
});
